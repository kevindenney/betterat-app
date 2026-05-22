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

  const { data: blueprintsData, isLoading: blueprintsLoading } = useQuery({
    queryKey: ['studio-home-blueprints', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<StudioBlueprint[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('timeline_blueprints')
        .select(
          'id, title, tagline, description, is_published, subscriber_count, ' +
            'duration_weeks, updated_at, organization_id',
        )
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) {
        console.warn('[useStudioHomeData] blueprints query failed', error);
        return [];
      }
      type Row = {
        id: string;
        title: string | null;
        tagline: string | null;
        description: string | null;
        is_published: boolean | null;
        subscriber_count: number | null;
        duration_weeks: number | null;
        updated_at: string | null;
        organization_id: string | null;
      };
      return ((data ?? []) as Row[]).map((r): StudioBlueprint => {
        const status: BlueprintStatus = r.is_published ? 'live' : 'draft';
        return {
          id: r.id,
          title: r.title ?? 'Untitled blueprint',
          subtitle:
            r.tagline?.trim() ||
            r.description?.trim() ||
            (r.duration_weeks ? `${r.duration_weeks}-week module` : '—'),
          status,
          version: r.is_published ? 'v1.0' : null,
          subscriberCount: r.subscriber_count ?? 0,
          stepCount: 0,             // TODO: count from timeline_steps when wired
          totalSteps: null,
          coAuthors: [],            // TODO: blueprint_authors table doesn't exist yet
          coverGradient: gradientFor(r.id),
          orgShort: r.organization_id && activeOrgShort ? activeOrgShort : null,
          lastEditLabel: relativeEdit(r.updated_at),
        };
      });
    },
  });

  const blueprints = useMemo(() => blueprintsData ?? [], [blueprintsData]);

  // TODO: wire threads (step_discussions joined to authored blueprints).
  // Today: stub empty so the panel renders its empty state cleanly.
  const threads: StudioThread[] = [];

  const activeSubscribers = blueprints.reduce((sum, b) => sum + b.subscriberCount, 0);

  const kpis: StudioKpis = {
    activeSubscribers,
    activeSubscribersDelta: null,         // would need a week-over-week diff table
    stepsReflectedPct: null,              // needs step_reflections aggregate
    needAttention: null,                  // needs activity-staleness check
    avgSessionMinutes: null,              // needs session events
  };

  return {
    loading: menu.loading || blueprintsLoading,
    blueprints,
    threads,
    kpis,
    blueprintCount: blueprints.length,
    draftCount: blueprints.filter((b) => b.status === 'draft').length,
    threadAwaitingCount: threads.filter((t) => t.awaiting).length,
  };
}
