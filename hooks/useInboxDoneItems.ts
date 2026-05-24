/**
 * useInboxDoneItems — items that have already left the Act/Read segments:
 * step_suggestions in adopted/saved/dismissed and peer_reflections in archived.
 *
 * Drives the v3 Inbox Done segment. Mirrors useInboxItems' hydration pattern
 * (auth.users + sailor_profiles + timeline_steps) but queries the source
 * tables directly rather than going through the inbox_items view, which
 * only surfaces still-active rows.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { InboxItem, InboxItemKind } from '@/components/practice/types';

interface SuggestionRow {
  id: string;
  source_user_id: string;
  target_user_id: string;
  source_step_id: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

interface ReflectionRow {
  id: string;
  source_user_id: string;
  target_user_id: string;
  target_step_id: string | null;
  body: string;
  status: string;
  created_at: string;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface SailorRow {
  user_id: string;
  avatar_color: string | null;
}

interface StepRow {
  id: string;
  title: string | null;
  description: string | null;
  interest_id: string | null;
}

const TINT_FALLBACK = '#5AC8FA';

function initialsFor(name: string | null | undefined): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function whenLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const hours = diffMs / 36e5;
  if (hours < 1) return 'just now';
  if (hours < 6) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return `${Math.floor(days)} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

const SUGGESTION_DONE_STATUSES = ['adopted', 'saved', 'dismissed'];
const REFLECTION_DONE_STATUSES = ['archived'];

export function useInboxDoneItems() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<InboxItem[]>({
    queryKey: ['practice-inbox-done', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return [];

      const [{ data: suggestionRows }, { data: reflectionRows }] = await Promise.all([
        supabase
          .from('step_suggestions')
          .select('id, source_user_id, target_user_id, source_step_id, message, status, created_at')
          .eq('target_user_id', userId)
          .in('status', SUGGESTION_DONE_STATUSES)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('peer_reflections')
          .select('id, source_user_id, target_user_id, target_step_id, body, status, created_at')
          .eq('target_user_id', userId)
          .in('status', REFLECTION_DONE_STATUSES)
          .order('created_at', { ascending: false })
          .limit(40),
      ]);

      const suggestions = (suggestionRows ?? []) as SuggestionRow[];
      const reflections = (reflectionRows ?? []) as ReflectionRow[];

      const fromUserIds = Array.from(
        new Set(
          [
            ...suggestions.map((s) => s.source_user_id),
            ...reflections.map((r) => r.source_user_id),
          ].filter(Boolean),
        ),
      );
      const stepIds = Array.from(
        new Set(
          [
            ...suggestions.map((s) => s.source_step_id),
            ...reflections.map((r) => r.target_step_id),
          ].filter((id): id is string => Boolean(id)),
        ),
      );

      const [{ data: userRows }, { data: sailorRows }, { data: stepRows }] = await Promise.all([
        fromUserIds.length > 0
          ? supabase.from('users').select('id, full_name, email').in('id', fromUserIds)
          : Promise.resolve({ data: [] as UserRow[], error: null }),
        fromUserIds.length > 0
          ? supabase
              .from('sailor_profiles')
              .select('user_id, avatar_color')
              .in('user_id', fromUserIds)
          : Promise.resolve({ data: [] as SailorRow[], error: null }),
        stepIds.length > 0
          ? supabase
              .from('timeline_steps')
              .select('id, title, description, interest_id')
              .in('id', stepIds)
          : Promise.resolve({ data: [] as StepRow[], error: null }),
      ]);

      const usersById = new Map<string, UserRow>();
      (userRows ?? []).forEach((u: UserRow) => usersById.set(u.id, u));
      const sailorsByUser = new Map<string, SailorRow>();
      (sailorRows ?? []).forEach((s: SailorRow) => sailorsByUser.set(s.user_id, s));
      const stepsById = new Map<string, StepRow>();
      (stepRows ?? []).forEach((s: StepRow) => stepsById.set(s.id, s));

      const items: InboxItem[] = [];

      for (const s of suggestions) {
        const user = usersById.get(s.source_user_id);
        const sailor = sailorsByUser.get(s.source_user_id);
        const step = s.source_step_id ? stepsById.get(s.source_step_id) : undefined;
        const fromName = user?.full_name?.trim() || user?.email?.split('@')[0] || null;
        const blurb = s.message?.trim() || undefined;
        const title =
          step?.title?.trim() ||
          blurb?.split(/[.!?]/)[0]?.trim() ||
          'Free-form suggestion';

        items.push({
          id: s.id,
          kind: 'suggestion' as InboxItemKind,
          chipLabel:
            s.status === 'adopted'
              ? 'Accepted'
              : s.status === 'saved'
                ? 'Saved'
                : 'Declined',
          fromInitials: initialsFor(fromName),
          fromTint: sailor?.avatar_color || TINT_FALLBACK,
          fromContext: fromName ?? 'A teammate',
          when: whenLabel(s.created_at),
          title,
          blurb,
          fromLine: fromName
            ? `Suggested step from ${fromName}`
            : 'Suggested step from a teammate',
          raw: {
            interestId: step?.interest_id ?? null,
            sourceStepId: s.source_step_id ?? '',
            sourceUserId: s.source_user_id,
            sourceDescription: step?.description ?? null,
          },
        });
      }

      for (const r of reflections) {
        const user = usersById.get(r.source_user_id);
        const sailor = sailorsByUser.get(r.source_user_id);
        const step = r.target_step_id ? stepsById.get(r.target_step_id) : undefined;
        const fromName = user?.full_name?.trim() || user?.email?.split('@')[0] || null;
        const blurb = r.body?.trim() || undefined;
        const title = step?.title?.trim() || 'your practice';

        items.push({
          id: r.id,
          kind: 'reflection' as InboxItemKind,
          chipLabel: 'Archived',
          fromInitials: initialsFor(fromName),
          fromTint: sailor?.avatar_color || TINT_FALLBACK,
          fromContext: fromName ?? 'A peer',
          when: whenLabel(r.created_at),
          title,
          blurb,
          fromLine: fromName
            ? `Reflection from ${fromName}`
            : 'Reflection from a peer',
          raw: {
            interestId: step?.interest_id ?? null,
            sourceStepId: r.target_step_id ?? '',
            sourceUserId: r.source_user_id,
            sourceDescription: step?.description ?? null,
          },
        });
      }

      // Each source query is already sorted desc, and InboxItem doesn't
      // carry created_at through to the UI. Leave the union as
      // suggestions-then-reflections rather than interleaving — fine for
      // the Done segment.
      return items;
    },
  });
}
