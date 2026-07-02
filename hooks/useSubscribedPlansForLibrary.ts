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
import { initialsOf } from '@/lib/utils/initials';
import { fetchAssignedBlueprints } from '@/services/CohortBlueprintService';

export interface SubscriberPreview {
  id: string;
  initials: string;
  /** rgba string used as the avatar background tint. */
  tint: string;
}

export interface SubscribedPlanRow {
  blueprintId: string;
  source?: 'timeline' | 'marketplace';
  route?: string;
  title: string;
  /** Short theme phrase shown as middle segment of author line ("Worlds 2027 prep"). */
  tagline: string | null;
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
  /**
   * Time-context tail for the progress row. Examples per canonical:
   *   "Week 6 of 24" while mid-flight
   *   "3 weeks left"  when ≤3 weeks remain
   *   "done"          once all steps complete
   *   null            if duration_weeks is unset on the blueprint
   */
  progressContext: string | null;
  /** Up to 3 most-recent OTHER subscribers, for the overlapping avatar stack. */
  subscriberPreviews: SubscriberPreview[];
}

function deriveProgressContext(
  subscribedAt: string,
  durationWeeks: number | null,
  doneCount: number,
  stepCount: number,
): string | null {
  if (stepCount > 0 && doneCount >= stepCount) return 'done';
  if (!durationWeeks || durationWeeks <= 0) return null;
  const subscribedMs = subscribedAt ? Date.parse(subscribedAt) : NaN;
  if (Number.isNaN(subscribedMs)) return null;
  const daysElapsed = (Date.now() - subscribedMs) / (1000 * 60 * 60 * 24);
  const weekElapsed = Math.max(1, Math.floor(daysElapsed / 7) + 1);
  const weeksRemaining = durationWeeks - weekElapsed + 1;
  if (weeksRemaining <= 0) return 'overdue';
  if (weeksRemaining <= 3) {
    return weeksRemaining === 1 ? '1 week left' : `${weeksRemaining} weeks left`;
  }
  return `Week ${weekElapsed} of ${durationWeeks}`;
}

const PREVIEW_TINTS = [
  'rgba(0,122,255,0.18)',
  'rgba(52,199,89,0.18)',
  'rgba(255,149,0,0.18)',
  'rgba(175,82,222,0.18)',
  'rgba(255,59,48,0.18)',
];
const PREVIEW_LIMIT = 3;

export function useSubscribedPlansForLibrary(interestId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<SubscribedPlanRow[]>({
    queryKey: ['library-plans', userId, interestId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return [];
      const rows: SubscribedPlanRow[] = [];

      // 1. user's legacy/timeline subscriptions
      const { data: subs, error: subsErr } = await supabase
        .from('blueprint_subscriptions')
        .select('blueprint_id, subscribed_at')
        .eq('subscriber_id', userId);
      if (subsErr) throw subsErr;
      const legacySubs = (subs ?? []) as { blueprint_id: string; subscribed_at: string }[];

      if (legacySubs.length > 0) {
        const blueprintIds = legacySubs.map((s) => s.blueprint_id);

        // 2. blueprint metadata + author
        let bpQuery = supabase
          .from('timeline_blueprints')
          .select('id, title, tagline, duration_weeks, user_id, interest_id, subscriber_count')
          .in('id', blueprintIds)
          .eq('is_published', true);
        if (interestId) bpQuery = bpQuery.eq('interest_id', interestId);
        const { data: bps, error: bpsErr } = await bpQuery;
        if (bpsErr) throw bpsErr;

        if (bps && bps.length > 0) {
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
            legacySubs.map((s) => [
              s.blueprint_id,
              s.subscribed_at,
            ]),
          );

          rows.push(...(bps as {
            id: string;
            title: string;
            tagline: string | null;
            duration_weeks: number | null;
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
            const subscribedAt = subByBp.get(bp.id) ?? '';
            return {
              blueprintId: bp.id,
              source: 'timeline',
              route: `/(tabs)/library/blueprints/${bp.id}`,
              title: bp.title,
              tagline: bp.tagline,
              authorName,
              authorInitials: initialsOf(authorName),
              stepCount,
              doneCount,
              subscriberCount: bp.subscriber_count ?? derivedSubscriberCount,
              resourceCount: resCountByBp.get(bp.id) ?? 0,
              status,
              subscribedAt,
              progressContext: deriveProgressContext(
                subscribedAt,
                bp.duration_weeks,
                doneCount,
                stepCount,
              ),
              subscriberPreviews,
            };
          }));
        }
      }

      // 6. independent Studio blueprint subscriptions
      const { data: marketplaceSubs, error: marketplaceErr } = await supabase
        .from('marketplace_subscriptions')
        .select('blueprint_id, created_at, status')
        .eq('buyer_user_id', userId)
        .in('status', ['active', 'trialing']);
      if (marketplaceErr) throw marketplaceErr;
      const paidIndependentSubs = (marketplaceSubs ?? []) as {
        blueprint_id: string;
        created_at: string;
      }[];
      const { data: freeMarketplaceSubs, error: freeMarketplaceErr } = await supabase
        .from('blueprint_subscriptions')
        .select('blueprint_id, subscribed_at')
        .eq('subscriber_id', userId)
        .eq('blueprint_system', 'marketplace');
      if (freeMarketplaceErr) throw freeMarketplaceErr;

      const independentSubByBlueprint = new Map<string, string>();
      for (const sub of paidIndependentSubs) {
        independentSubByBlueprint.set(sub.blueprint_id, sub.created_at);
      }
      for (const sub of (freeMarketplaceSubs ?? []) as {
        blueprint_id: string;
        subscribed_at: string;
      }[]) {
        if (!independentSubByBlueprint.has(sub.blueprint_id)) {
          independentSubByBlueprint.set(sub.blueprint_id, sub.subscribed_at);
        }
      }
      const independentSubs = Array.from(independentSubByBlueprint.entries()).map(
        ([blueprint_id, created_at]) => ({ blueprint_id, created_at }),
      );

      if (independentSubs.length > 0) {
        const blueprintIds = independentSubs.map((s) => s.blueprint_id);
        let bpQuery = supabase
          .from('blueprints')
          .select('id, title, description, author_user_id, interest_id, step_count')
          .in('id', blueprintIds)
          .eq('status', 'live');
        if (interestId) bpQuery = bpQuery.eq('interest_id', interestId);
        const { data: bps, error: bpsErr } = await bpQuery;
        if (bpsErr) throw bpsErr;

        if (bps && bps.length > 0) {
          const marketIds = (bps as { id: string }[]).map((bp) => bp.id);
          const authorIds = Array.from(
            new Set(
              (bps as { author_user_id: string | null }[])
                .map((bp) => bp.author_user_id)
                .filter((id): id is string => Boolean(id)),
            ),
          );
          const [{ data: authors }, { data: templates }, { data: previewSubs }] = await Promise.all([
            authorIds.length > 0
              ? supabase.from('users').select('id, full_name, email').in('id', authorIds)
              : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
            supabase
              .from('blueprint_step_templates')
              .select('id, blueprint_id')
              .in('blueprint_id', marketIds),
            supabase
              .from('marketplace_subscriptions')
              .select('blueprint_id, buyer_user_id, created_at')
              .in('blueprint_id', marketIds)
              .neq('buyer_user_id', userId)
              .in('status', ['active', 'trialing'])
              .order('created_at', { ascending: false }),
          ]);

          const authorMap = new Map<string, { name: string | null }>();
          for (const a of (authors ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
            authorMap.set(a.id, { name: a.full_name || a.email });
          }

          const stepCountByBp = new Map<string, number>();
          const templateBpById = new Map<string, string>();
          for (const t of (templates ?? []) as { id: string; blueprint_id: string }[]) {
            stepCountByBp.set(t.blueprint_id, (stepCountByBp.get(t.blueprint_id) ?? 0) + 1);
            templateBpById.set(t.id, t.blueprint_id);
          }

          const templateIds = Array.from(templateBpById.keys());
          const doneByBp = new Map<string, number>();
          if (templateIds.length > 0) {
            const { data: doneRows, error: doneErr } = await supabase
              .from('timeline_steps')
              .select('source_id, status')
              .eq('user_id', userId)
              .eq('source_type', 'marketplace_copy')
              .in('source_id', templateIds);
            if (doneErr) throw doneErr;
            for (const r of (doneRows ?? []) as { source_id: string | null; status: string }[]) {
              if (!r.source_id) continue;
              const bpId = templateBpById.get(r.source_id);
              if (!bpId) continue;
              if (r.status === 'completed' || r.status === 'settled') {
                doneByBp.set(bpId, (doneByBp.get(bpId) ?? 0) + 1);
              }
            }
          }

          const previewsByBp = new Map<string, string[]>();
          const otherCountByBp = new Map<string, number>();
          for (const r of (previewSubs ?? []) as { blueprint_id: string; buyer_user_id: string }) {
            const list = previewsByBp.get(r.blueprint_id) ?? [];
            if (list.length < PREVIEW_LIMIT) {
              list.push(r.buyer_user_id);
              previewsByBp.set(r.blueprint_id, list);
            }
            otherCountByBp.set(r.blueprint_id, (otherCountByBp.get(r.blueprint_id) ?? 0) + 1);
          }

          const previewUserIds = Array.from(new Set(Array.from(previewsByBp.values()).flat()));
          const previewNameByUser = new Map<string, string>();
          const previewTintByUser = new Map<string, string>();
          if (previewUserIds.length > 0) {
            const [{ data: previewUsers }, { data: previewSailors }] = await Promise.all([
              supabase.from('users').select('id, full_name, email').in('id', previewUserIds),
              supabase.from('sailor_profiles').select('user_id, avatar_color').in('user_id', previewUserIds),
            ]);
            for (const u of (previewUsers ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
              previewNameByUser.set(u.id, u.full_name || u.email || 'Anonymous');
            }
            for (const s of (previewSailors ?? []) as { user_id: string; avatar_color: string | null }[]) {
              if (s.avatar_color) previewTintByUser.set(s.user_id, s.avatar_color);
            }
          }

          const subByBp = new Map<string, string>(
            independentSubs.map((s) => [s.blueprint_id, s.created_at]),
          );

          rows.push(...(bps as {
            id: string;
            title: string;
            description: string | null;
            author_user_id: string | null;
            step_count: number | null;
          }[]).map<SubscribedPlanRow>((bp) => {
            const author = bp.author_user_id ? authorMap.get(bp.author_user_id) : null;
            const authorName = author?.name || 'Independent author';
            const stepCount = stepCountByBp.get(bp.id) ?? bp.step_count ?? 0;
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
            const subscribedAt = subByBp.get(bp.id) ?? '';
            return {
              blueprintId: bp.id,
              source: 'marketplace',
              route: `/marketplace/${bp.id}`,
              title: bp.title,
              tagline: bp.description,
              authorName,
              authorInitials: initialsOf(authorName),
              stepCount,
              doneCount,
              subscriberCount: (otherCountByBp.get(bp.id) ?? 0) + 1,
              resourceCount: 0,
              status,
              subscribedAt,
              progressContext: stepCount > 0 && doneCount >= stepCount ? 'done' : null,
              subscriberPreviews,
            };
          }));
        }
      }

      // 7. institution-managed blueprints assigned through the user's cohorts.
      //    Under the unified subscribe model these list when the learner has a
      //    relationship row (any entry granularity, so "just subscribe / first"
      //    still shows with progress) OR — for plans adopted before the unified
      //    table existed — when they've already materialized ≥1 step. These
      //    never get a marketplace_subscriptions row, so they need their own
      //    branch. Reuses the same assignment read the "ASSIGNED TO YOU" section
      //    is built on, so the two stay consistent.
      const { data: instSubs } = await supabase
        .from('blueprint_subscriptions')
        .select('blueprint_id')
        .eq('subscriber_id', userId)
        .eq('blueprint_system', 'institutional');
      const subscribedInstIds = new Set(
        ((instSubs ?? []) as { blueprint_id: string }[]).map((r) => r.blueprint_id),
      );
      const assigned = await fetchAssignedBlueprints(userId, interestId ?? null);
      for (const bp of assigned) {
        if (bp.adoptedSteps <= 0 && !subscribedInstIds.has(bp.id)) continue;
        const authorName = bp.orgName || 'Your program';
        rows.push({
          blueprintId: bp.id,
          source: 'timeline',
          // Institutional blueprints have no marketplace listing (no Stripe
          // price) and don't live in the System-A blueprint detail (different
          // table — would render empty). Their detail is the assigned-blueprint
          // preview, which lists the authored steps + an "Open in Practice" CTA.
          route: `/blueprint/assigned/${bp.id}`,
          title: bp.title,
          tagline: bp.cohortName,
          authorName,
          authorInitials: initialsOf(authorName),
          stepCount: bp.totalSteps,
          doneCount: bp.doneSteps,
          subscriberCount: 1,
          resourceCount: 0,
          status: bp.totalSteps > 0 && bp.doneSteps >= bp.totalSteps ? 'done' : 'active',
          subscribedAt: new Date().toISOString(),
          progressContext:
            bp.totalSteps > 0 && bp.doneSteps >= bp.totalSteps ? 'done' : null,
          subscriberPreviews: [],
        });
      }

      return rows.sort((a, b) => Date.parse(b.subscribedAt) - Date.parse(a.subscribedAt));
    },
  });
}
