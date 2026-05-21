/**
 * useSubscribedPlansForLibrary — hydrated plan rows for the Library Plans zone.
 *
 * Combines a user's blueprint subscriptions with the joined detail each
 * canonical Plans-zone card needs:
 *   - author chip (name + initials)
 *   - plan title
 *   - step count + the user's own progress (X of Y)
 *   - total subscriber count
 *   - status pill (active / done / paused — derived from local step state)
 *
 * Resources count is left at undefined for now (plan_resources is empty
 * in production). Add it once we wire bundled materials.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface SubscriberPreview {
  id: string;
  initials: string;
  /** rgba string used as the avatar background tint. */
  tint: string;
}

export interface SubscribedPlanRow {
  blueprintId: string;
  title: string;
  authorName: string;
  authorInitials: string;
  stepCount: number;
  /** Steps the current user has marked completed against this blueprint. */
  doneCount: number;
  subscriberCount: number;
  /** Materials bundled with this plan (plan_resources count). */
  resourceCount: number;
  status: 'active' | 'done' | 'paused';
  subscribedAt: string;
  /** Up to 3 most-recent OTHER subscribers, for the overlapping avatar stack. */
  subscriberPreviews: SubscriberPreview[];
}

const PREVIEW_TINTS = [
  'rgba(0,122,255,0.18)',
  'rgba(52,199,89,0.18)',
  'rgba(255,149,0,0.18)',
  'rgba(175,82,222,0.18)',
  'rgba(255,59,48,0.18)',
];
const PREVIEW_LIMIT = 3;

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function useSubscribedPlansForLibrary(interestId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<SubscribedPlanRow[]>({
    queryKey: ['library-plans', userId, interestId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return [];

      // 1. user's subscriptions
      const { data: subs, error: subsErr } = await supabase
        .from('blueprint_subscriptions')
        .select('blueprint_id, subscribed_at')
        .eq('subscriber_id', userId);
      if (subsErr) throw subsErr;
      if (!subs || subs.length === 0) return [];

      const blueprintIds = subs.map((s: { blueprint_id: string }) => s.blueprint_id);

      // 2. blueprint metadata + author
      let bpQuery = supabase
        .from('timeline_blueprints')
        .select('id, title, user_id, interest_id, subscriber_count')
        .in('id', blueprintIds)
        .eq('is_published', true);
      if (interestId) bpQuery = bpQuery.eq('interest_id', interestId);
      const { data: bps, error: bpsErr } = await bpQuery;
      if (bpsErr) throw bpsErr;
      if (!bps || bps.length === 0) return [];

      const authorIds = Array.from(
        new Set(
          (bps as { user_id: string | null }[])
            .map((b) => b.user_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const authorMap = new Map<string, { name: string | null }>();
      if (authorIds.length > 0) {
        const { data: authors } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', authorIds);
        for (const a of (authors ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
          authorMap.set(a.id, { name: a.full_name || a.email });
        }
      }

      // 3. step count per blueprint
      const { data: stepRows, error: stepErr } = await supabase
        .from('blueprint_steps')
        .select('blueprint_id')
        .in('blueprint_id', blueprintIds);
      if (stepErr) throw stepErr;
      const stepCountByBp = new Map<string, number>();
      for (const r of (stepRows ?? []) as { blueprint_id: string }[]) {
        stepCountByBp.set(r.blueprint_id, (stepCountByBp.get(r.blueprint_id) ?? 0) + 1);
      }

      // 3b. resources count per blueprint (plan_resources)
      const { data: resRows } = await supabase
        .from('plan_resources')
        .select('plan_id')
        .in('plan_id', blueprintIds);
      const resCountByBp = new Map<string, number>();
      for (const r of (resRows ?? []) as { plan_id: string }[]) {
        resCountByBp.set(r.plan_id, (resCountByBp.get(r.plan_id) ?? 0) + 1);
      }

      // 4. user's done count per blueprint (via adopted timeline steps)
      const { data: doneRows, error: doneErr } = await supabase
        .from('timeline_steps')
        .select('source_blueprint_id, status')
        .eq('user_id', userId)
        .in('source_blueprint_id', blueprintIds);
      if (doneErr) throw doneErr;
      const doneByBp = new Map<string, number>();
      for (const r of (doneRows ?? []) as { source_blueprint_id: string | null; status: string }[]) {
        if (!r.source_blueprint_id) continue;
        if (r.status === 'completed' || r.status === 'settled') {
          doneByBp.set(r.source_blueprint_id, (doneByBp.get(r.source_blueprint_id) ?? 0) + 1);
        }
      }

      // 5. Subscriber previews — pull the most recent OTHER subscribers
      //    per blueprint (top 3) for the overlapping avatar stack. Single
      //    query sorted desc; we group client-side and slice 3 per bp
      //    since Supabase has no "limit per group" primitive.
      const { data: previewSubs } = await supabase
        .from('blueprint_subscriptions')
        .select('blueprint_id, subscriber_id, subscribed_at')
        .in('blueprint_id', blueprintIds)
        .neq('subscriber_id', userId)
        .order('subscribed_at', { ascending: false });

      const previewsByBp = new Map<string, string[]>();
      // Total OTHER-subscriber count per blueprint (used as a fallback for
      // blueprints whose denormalized subscriber_count column was never
      // populated). The current user is +1 since we're in their plan list.
      const otherCountByBp = new Map<string, number>();
      for (const r of (previewSubs ?? []) as {
        blueprint_id: string;
        subscriber_id: string;
      }[]) {
        const list = previewsByBp.get(r.blueprint_id) ?? [];
        if (list.length < PREVIEW_LIMIT) {
          list.push(r.subscriber_id);
          previewsByBp.set(r.blueprint_id, list);
        }
        otherCountByBp.set(
          r.blueprint_id,
          (otherCountByBp.get(r.blueprint_id) ?? 0) + 1,
        );
      }

      const previewUserIds = Array.from(
        new Set(Array.from(previewsByBp.values()).flat()),
      );
      const previewNameByUser = new Map<string, string>();
      const previewTintByUser = new Map<string, string>();
      if (previewUserIds.length > 0) {
        const [{ data: previewUsers }, { data: previewSailors }] = await Promise.all([
          supabase.from('users').select('id, full_name, email').in('id', previewUserIds),
          supabase
            .from('sailor_profiles')
            .select('user_id, avatar_color')
            .in('user_id', previewUserIds),
        ]);
        for (const u of (previewUsers ?? []) as {
          id: string;
          full_name: string | null;
          email: string | null;
        }[]) {
          previewNameByUser.set(u.id, u.full_name || u.email || 'Anonymous');
        }
        for (const s of (previewSailors ?? []) as {
          user_id: string;
          avatar_color: string | null;
        }[]) {
          if (s.avatar_color) previewTintByUser.set(s.user_id, s.avatar_color);
        }
      }

      // Merge into final rows
      const subByBp = new Map<string, string>(
        (subs as { blueprint_id: string; subscribed_at: string }[]).map((s) => [
          s.blueprint_id,
          s.subscribed_at,
        ]),
      );

      return (bps as {
        id: string;
        title: string;
        user_id: string | null;
        subscriber_count: number | null;
      }[]).map<SubscribedPlanRow>((bp) => {
        const author = bp.user_id ? authorMap.get(bp.user_id) : null;
        const authorName = author?.name || 'Anonymous';
        const stepCount = stepCountByBp.get(bp.id) ?? 0;
        const doneCount = doneByBp.get(bp.id) ?? 0;
        const status: SubscribedPlanRow['status'] =
          stepCount > 0 && doneCount >= stepCount ? 'done' : 'active';
        const previewIds = previewsByBp.get(bp.id) ?? [];
        const subscriberPreviews: SubscriberPreview[] = previewIds.map((sid, i) => {
          const name = previewNameByUser.get(sid) || 'Anonymous';
          return {
            id: sid,
            initials: initialsOf(name),
            tint: previewTintByUser.get(sid) || PREVIEW_TINTS[i % PREVIEW_TINTS.length],
          };
        });
        const derivedSubscriberCount = (otherCountByBp.get(bp.id) ?? 0) + 1;
        return {
          blueprintId: bp.id,
          title: bp.title,
          authorName,
          authorInitials: initialsOf(authorName),
          stepCount,
          doneCount,
          subscriberCount: bp.subscriber_count ?? derivedSubscriberCount,
          resourceCount: resCountByBp.get(bp.id) ?? 0,
          status,
          subscribedAt: subByBp.get(bp.id) ?? '',
          subscriberPreviews,
        };
      });
    },
  });
}
