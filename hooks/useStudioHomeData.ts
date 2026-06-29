/**
 * useStudioHomeData
 *
 * Data shape for Creator Studio · Home (Frame 4). Queries real
 * timeline_blueprints rows authored by the signed-in user + their
 * subscriber counts. Threads and KPIs that don't have a clean
 * backing source yet stay stubbed — see TODOs below.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';

export type BlueprintStatus = 'live' | 'draft';

export interface StudioBlueprint {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string;
  status: BlueprintStatus;
  version: string | null;
  subscriberCount: number;
  stepCount: number;
  totalSteps: number | null;
  coAuthors: string[];
  coverGradient: [string, string];
  orgShort: string | null;
  lastEditLabel: string;
}

export interface StudioThread {
  id: string;
  fromInitials: string;
  fromName: string;
  blueprintLabel: string;
  preview: string;
  ageLabel: string;
  awaiting: boolean;
  gradient: [string, string];
}

export interface StudioKpis {
  activeSubscribers: number;
  activeSubscribersDelta: number | null;
  stepsReflectedPct: number | null;
  needAttention: number | null;
  avgSessionMinutes: number | null;
}

export interface StudioHomeData {
  loading: boolean;
  blueprints: StudioBlueprint[];
  threads: StudioThread[];
  kpis: StudioKpis;
  blueprintCount: number;
  draftCount: number;
  threadAwaitingCount: number;
}

// Deterministic gradient per blueprint id so authored covers stay stable.
const COVER_PALETTE: [string, string][] = [
  ['#7A6A8E', '#4E6A85'],
  ['#B85A66', '#7A6A8E'],
  ['#5A8DB8', '#28406B'],
  ['#6E8B5A', '#5A8B8B'],
  ['#8B6E5A', '#B8855A'],
];

function gradientFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[h % COVER_PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeEdit(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.round((Date.now() - d) / 60_000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function useStudioHomeData(): StudioHomeData {
  const { user } = useAuth();
  const menu = useProfileMenuData();
  const userId = user?.id;
  const activeOrgShort = menu.activeOrg?.org_short_name ?? null;
  const activeOrgId = menu.activeOrg?.org_id ?? null;
  const workspaceKey = activeOrgId ?? 'personal';

  const { data: blueprintsData, isLoading: blueprintsLoading } = useQuery({
    queryKey: ['studio-home-blueprints', userId, workspaceKey],
    enabled: !!userId && !menu.loading,
    staleTime: 30_000,
    queryFn: async (): Promise<StudioBlueprint[]> => {
      if (!userId) return [];
      // System B — the real authored catalog (public.blueprints), the same
      // table the editor and marketplace use. Studio Home previously read the
      // legacy timeline_blueprints, so a creator's actual authored Plans (and
      // their drafts) never showed here. blueprints_author_read RLS lets an
      // author read their own rows regardless of org (incl. null-org solo).
      let blueprintsQuery = supabase
        .from('blueprints')
        .select(
          'id, slug, title, description, status, version, step_count, ' +
            'org_id, last_edited_at, published_at',
        )
        .eq('author_user_id', userId)
        .order('last_edited_at', { ascending: false });
      blueprintsQuery = activeOrgId
        ? blueprintsQuery.eq('org_id', activeOrgId)
        : blueprintsQuery.is('org_id', null);
      const { data, error } = await blueprintsQuery;
      if (error) {
        console.warn('[useStudioHomeData] blueprints query failed', error);
        return [];
      }
      type Row = {
        id: string;
        slug: string | null;
        title: string | null;
        description: string | null;
        status: string | null;
        version: string | null;
        step_count: number | null;
        org_id: string | null;
        last_edited_at: string | null;
        published_at: string | null;
      };
      const rows = (data ?? []) as Row[];

      // Active-subscriber counts per blueprint. marketplace_subscriptions is
      // author-readable (mps_author_self_read); count active + trialing only.
      const subCountById = new Map<string, number>();
      const blueprintIds = rows.map((r) => r.id);
      if (blueprintIds.length > 0) {
        const { data: subs, error: subsError } = await supabase
          .from('marketplace_subscriptions')
          .select('blueprint_id')
          .eq('author_user_id', userId)
          .in('blueprint_id', blueprintIds)
          .in('status', ['active', 'trialing']);
        if (subsError) {
          console.warn('[useStudioHomeData] subscriber count query failed', subsError);
        } else {
          for (const s of (subs ?? []) as { blueprint_id: string }[]) {
            subCountById.set(s.blueprint_id, (subCountById.get(s.blueprint_id) ?? 0) + 1);
          }
        }
      }

      return rows.map((r): StudioBlueprint => {
        const status: BlueprintStatus = r.status === 'live' ? 'live' : 'draft';
        // Avoid surfacing the 'v0.1 draft' default on a live pill.
        const version =
          status === 'live'
            ? r.version && !/draft/i.test(r.version)
              ? r.version
              : 'v1.0'
            : null;
        return {
          id: r.id,
          slug: r.slug,
          title: r.title ?? 'Untitled blueprint',
          subtitle: r.description?.trim() || '—',
          status,
          version,
          subscriberCount: subCountById.get(r.id) ?? 0,
          stepCount: r.step_count ?? 0,
          totalSteps: null,
          coAuthors: [],            // TODO: blueprint co-authors table not wired yet
          coverGradient: gradientFor(r.id),
          orgShort: r.org_id && activeOrgShort ? activeOrgShort : null,
          lastEditLabel: relativeEdit(r.last_edited_at ?? r.published_at),
        };
      });
    },
  });

  const blueprints = useMemo(() => blueprintsData ?? [], [blueprintsData]);

  // Subscriber conversation on this author's blueprint steps. The
  // studio_author_threads RPC (SECURITY DEFINER, keyed off auth.uid() =
  // blueprints.author_user_id) returns one row per blueprint_step thread with a
  // non-author post, newest first. `awaiting` = the most recent post is a
  // subscriber's, i.e. the author hasn't replied yet.
  const { data: threadsData, isLoading: threadsLoading } = useQuery({
    queryKey: ['studio-author-threads', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<StudioThread[]> => {
      const { data, error } = await supabase.rpc('studio_author_threads', { p_limit: 20 });
      if (error) {
        console.warn('[useStudioHomeData] author threads RPC failed', error);
        return [];
      }
      type Row = {
        blueprint_step_id: string;
        blueprint_id: string;
        blueprint_title: string | null;
        step_title: string | null;
        last_post_id: string;
        last_post_body: string | null;
        last_poster_id: string;
        last_poster_name: string | null;
        last_post_at: string | null;
        awaiting: boolean;
        post_count: number;
      };
      return ((data ?? []) as Row[]).map((r): StudioThread => {
        const fromName = r.last_poster_name?.trim() || 'Subscriber';
        const blueprintLabel = r.step_title?.trim()
          ? `${r.blueprint_title ?? 'Blueprint'} · ${r.step_title.trim()}`
          : r.blueprint_title ?? 'Blueprint';
        return {
          id: r.blueprint_step_id,
          fromInitials: initialsFor(fromName),
          fromName,
          blueprintLabel,
          preview: r.last_post_body?.trim() || '—',
          ageLabel: relativeEdit(r.last_post_at),
          awaiting: r.awaiting,
          gradient: gradientFor(r.last_poster_id),
        };
      });
    },
  });

  const threads = useMemo(() => threadsData ?? [], [threadsData]);

  const activeSubscribers = blueprints.reduce((sum, b) => sum + b.subscriberCount, 0);

  const kpis: StudioKpis = {
    activeSubscribers,
    activeSubscribersDelta: null,         // would need a week-over-week diff table
    stepsReflectedPct: null,              // needs step_reflections aggregate
    needAttention: null,                  // needs activity-staleness check
    avgSessionMinutes: null,              // needs session events
  };

  return {
    loading: menu.loading || blueprintsLoading || threadsLoading,
    blueprints,
    threads,
    kpis,
    blueprintCount: blueprints.length,
    draftCount: blueprints.filter((b) => b.status === 'draft').length,
    threadAwaitingCount: threads.filter((t) => t.awaiting).length,
  };
}
