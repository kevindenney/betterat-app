/**
 * useInboxItems — paged read of the Practice Inbox from the inbox_items
 * view, joined with auth-side names + sailor_profiles avatar fields +
 * timeline_steps for the title. Drives /practice/inbox.
 *
 * The view returns rows of two shapes:
 *   - kind='suggestion'  → step_suggestions (from_user_id present, step_id is the source step)
 *   - kind='on_deck'     → step_deck       (from_user_id null, step_id is the source step)
 *
 * Plan-push pending entries are not yet wired into the view, so the
 * 'plan_push' branch from components/practice/types.ts is reserved for
 * a follow-up.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { InboxItem, InboxItemKind } from '@/components/practice/types';

interface InboxRow {
  id: string;
  kind: 'suggestion' | 'on_deck';
  user_id: string;
  from_user_id: string | null;
  from_plan_id: string | null;
  step_id: string;
  body: string | null;
  status: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
}

interface SailorProfileRow {
  user_id: string;
  avatar_emoji: string | null;
  avatar_color: string | null;
}

interface StepRow {
  id: string;
  title: string | null;
  description: string | null;
  interest_id: string | null;
}

interface DeckRow {
  id: string;
  interest_id: string | null;
}

const KIND_CHIP: Record<InboxItemKind, string> = {
  suggestion: 'Suggested',
  plan_push: 'New plan step',
  on_deck: 'On deck',
};

const TINT_FALLBACK = '#5AC8FA';

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
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

function toInboxItem(
  row: InboxRow,
  profile: ProfileRow | undefined,
  sailor: SailorProfileRow | undefined,
  step: StepRow | undefined,
  deck: DeckRow | undefined,
): InboxItem {
  const fromName = profile?.full_name?.trim() || null;
  const kind: InboxItemKind = row.kind === 'suggestion' ? 'suggestion' : 'on_deck';
  const stepTitle = step?.title?.trim() || 'Untitled step';
  const blurb = row.body?.trim() || undefined;
  const raw = {
    interestId: kind === 'on_deck' ? deck?.interest_id ?? null : step?.interest_id ?? null,
    sourceStepId: row.step_id,
    sourceUserId: row.from_user_id,
    sourceDescription: step?.description ?? null,
  };

  if (kind === 'suggestion') {
    return {
      id: row.id,
      kind,
      chipLabel: KIND_CHIP.suggestion,
      fromInitials: initials(fromName),
      fromTint: sailor?.avatar_color || TINT_FALLBACK,
      fromContext: fromName ? `${fromName}` : 'A teammate',
      when: whenLabel(row.created_at),
      title: stepTitle,
      blurb,
      fromLine: fromName
        ? `Suggested step from ${fromName}`
        : 'Suggested step from a teammate',
      raw,
    };
  }

  // on_deck
  return {
    id: row.id,
    kind,
    chipLabel: KIND_CHIP.on_deck,
    fromContext: 'Saved by you',
    when: whenLabel(row.created_at),
    title: stepTitle,
    blurb,
    fromLine: `Forked from "${stepTitle}"`,
    raw,
  };
}

export function useInboxItems() {
  return useQuery<InboxItem[]>({
    queryKey: ['practice-inbox-items'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('inbox_items')
        .select('id, kind, user_id, from_user_id, from_plan_id, step_id, body, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const safeRows = (rows ?? []) as InboxRow[];
      if (safeRows.length === 0) return [];

      // Hydrate joined data in parallel.
      const fromUserIds = Array.from(
        new Set(safeRows.map((r) => r.from_user_id).filter((id): id is string => !!id))
      );
      const stepIds = Array.from(new Set(safeRows.map((r) => r.step_id).filter(Boolean)));

      const deckIds = Array.from(
        new Set(
          safeRows
            .filter((r) => r.kind === 'on_deck')
            .map((r) => r.id)
            .filter(Boolean)
        )
      );

      const [usersRes, sailorsRes, stepsRes, decksRes] = await Promise.all([
        fromUserIds.length > 0
          ? supabase.from('users').select('id, full_name').in('id', fromUserIds)
          : Promise.resolve({ data: [] as ProfileRow[], error: null }),
        fromUserIds.length > 0
          ? supabase
              .from('sailor_profiles')
              .select('user_id, avatar_emoji, avatar_color')
              .in('user_id', fromUserIds)
          : Promise.resolve({ data: [] as SailorProfileRow[], error: null }),
        stepIds.length > 0
          ? supabase
              .from('timeline_steps')
              .select('id, title, description, interest_id')
              .in('id', stepIds)
          : Promise.resolve({ data: [] as StepRow[], error: null }),
        deckIds.length > 0
          ? supabase.from('step_deck').select('id, interest_id').in('id', deckIds)
          : Promise.resolve({ data: [] as DeckRow[], error: null }),
      ]);

      const profilesById = new Map<string, ProfileRow>();
      (usersRes.data ?? []).forEach((p: ProfileRow) => profilesById.set(p.id, p));
      const sailorsByUser = new Map<string, SailorProfileRow>();
      (sailorsRes.data ?? []).forEach((s: SailorProfileRow) =>
        sailorsByUser.set(s.user_id, s)
      );
      const stepsById = new Map<string, StepRow>();
      (stepsRes.data ?? []).forEach((s: StepRow) => stepsById.set(s.id, s));
      const decksById = new Map<string, DeckRow>();
      (decksRes.data ?? []).forEach((d: DeckRow) => decksById.set(d.id, d));

      return safeRows.map((row) =>
        toInboxItem(
          row,
          row.from_user_id ? profilesById.get(row.from_user_id) : undefined,
          row.from_user_id ? sailorsByUser.get(row.from_user_id) : undefined,
          stepsById.get(row.step_id),
          row.kind === 'on_deck' ? decksById.get(row.id) : undefined,
        ),
      );
    },
  });
}
