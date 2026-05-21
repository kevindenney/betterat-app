/**
 * usePlanDetail — hydrates a single plan-detail page from a blueprint id.
 *
 * Returns three slices in parallel, each with its own loading state so the
 * page can render the tabs as their data lands:
 *   - `plan`        timeline_blueprints row + author identity + step count
 *   - `steps`       blueprint_steps joined to timeline_steps (for cards)
 *   - `subscribers` blueprint_subscriptions joined to users + sailor_profiles
 *   - `resources`   plan_resources rows (empty for blueprints without
 *                    bundled materials yet)
 *
 * Built on top of existing tables so we don't need a migration:
 *   timeline_blueprints / blueprint_steps / blueprint_subscriptions /
 *   plan_resources.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { initialsOf } from '@/lib/utils/initials';
import type {
  PlanResourceRow,
  PlanSummary,
  SubscriberRow as SubscriberRowData,
} from '@/components/library/plans/types';
import type { StepCardH } from '@/components/timeline/types';

const TINTS = [
  'rgba(0,122,255,0.18)',
  'rgba(52,199,89,0.18)',
  'rgba(255,149,0,0.18)',
  'rgba(175,82,222,0.18)',
  'rgba(255,59,48,0.18)',
];

interface PlanDetailData {
  plan: PlanSummary;
  steps: StepCardH[];
  subscribers: SubscriberRowData[];
  resources: PlanResourceRow[];
}

export function usePlanDetail(blueprintId: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<PlanDetailData | null>({
    queryKey: ['plan-detail', blueprintId, userId],
    enabled: Boolean(blueprintId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!blueprintId) return null;

      // 1. Blueprint
      const { data: bp, error: bpErr } = await supabase
        .from('timeline_blueprints')
        .select('id, title, user_id, subscriber_count, description')
        .eq('id', blueprintId)
        .maybeSingle();
      if (bpErr) throw bpErr;
      if (!bp) return null;

      // 2. Author
      let authorName = 'Anonymous';
      if (bp.user_id) {
        const { data: author } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', bp.user_id)
          .maybeSingle();
        if (author) {
          authorName = author.full_name || author.email || 'Anonymous';
        }
      }

      // 3. Steps (blueprint_steps → timeline_steps)
      const { data: bpSteps, error: bpStepsErr } = await supabase
        .from('blueprint_steps')
        .select('step_id, sort_order')
        .eq('blueprint_id', blueprintId)
        .order('sort_order', { ascending: true });
      if (bpStepsErr) throw bpStepsErr;
      const stepIds = (bpSteps ?? []).map((r: { step_id: string }) => r.step_id);

      let timelineSteps: {
        id: string;
        title: string;
        status: string | null;
      }[] = [];
      if (stepIds.length > 0) {
        const { data: ts } = await supabase
          .from('timeline_steps')
          .select('id, title, status')
          .in('id', stepIds);
        timelineSteps = (ts ?? []) as {
          id: string;
          title: string;
          status: string | null;
        }[];
      }
      const stepById = new Map(timelineSteps.map((s) => [s.id, s]));
      const totalSteps = stepIds.length;

      // 4. The current user's own adopted steps for this blueprint (for
      //    NOW positioning in the timeline)
      let myDoneIds = new Set<string>();
      let myCurrentSourceId: string | null = null;
      if (userId) {
        const { data: myAdopted } = await supabase
          .from('timeline_steps')
          .select('source_id, status')
          .eq('user_id', userId)
          .eq('source_blueprint_id', blueprintId);
        for (const r of (myAdopted ?? []) as {
          source_id: string | null;
          status: string | null;
        }[]) {
          if (!r.source_id) continue;
          if (r.status === 'completed' || r.status === 'settled') {
            myDoneIds.add(r.source_id);
          } else if (r.status === 'in_progress' && !myCurrentSourceId) {
            myCurrentSourceId = r.source_id;
          }
        }
      }

      const steps: StepCardH[] = (bpSteps ?? []).map(
        (r: { step_id: string; sort_order: number }, idx: number) => {
          const src = stepById.get(r.step_id);
          const isDone = myDoneIds.has(r.step_id);
          const isNow = myCurrentSourceId === r.step_id;
          const state: StepCardH['state'] = isDone
            ? 'done'
            : isNow
              ? 'now'
              : 'planned';
          return {
            id: r.step_id,
            title: src?.title ?? `Step ${idx + 1}`,
            stepNumber: idx + 1,
            totalSteps,
            state,
            pillLabel: isDone ? 'Done' : isNow ? 'Now' : 'Planned',
            meta: '',
            phaseDots: ['empty', 'empty', 'empty'],
          };
        },
      );

      // 5. Subscribers
      const { data: subs, error: subsErr } = await supabase
        .from('blueprint_subscriptions')
        .select('subscriber_id, subscribed_at')
        .eq('blueprint_id', blueprintId)
        .order('subscribed_at', { ascending: false });
      if (subsErr) throw subsErr;
      const subIds = (subs ?? [])
        .map((r: { subscriber_id: string }) => r.subscriber_id)
        .filter((id: string) => id !== userId);

      let subscribers: SubscriberRowData[] = [];
      if (subIds.length > 0) {
        const [{ data: subProfiles }, { data: subSailors }, { data: subSteps }] =
          await Promise.all([
            supabase.from('users').select('id, full_name, email').in('id', subIds),
            supabase
              .from('sailor_profiles')
              .select('user_id, home_club, location, avatar_color')
              .in('user_id', subIds),
            // Each subscriber's adopted steps on this blueprint — used to
            // surface their current step + done count.
            supabase
              .from('timeline_steps')
              .select('user_id, source_id, status, title')
              .in('user_id', subIds)
              .eq('source_blueprint_id', blueprintId),
          ]);

        const nameByUser = new Map<string, string>();
        for (const p of (subProfiles ?? []) as {
          id: string;
          full_name: string | null;
          email: string | null;
        }[]) {
          nameByUser.set(p.id, p.full_name || p.email || 'Anonymous');
        }
        const sailorByUser = new Map<
          string,
          { home_club?: string; location?: string; avatar_color?: string }
        >();
        for (const s of (subSailors ?? []) as {
          user_id: string;
          home_club: string | null;
          location: string | null;
          avatar_color: string | null;
        }[]) {
          sailorByUser.set(s.user_id, {
            home_club: s.home_club ?? undefined,
            location: s.location ?? undefined,
            avatar_color: s.avatar_color ?? undefined,
          });
        }
        const doneByUser = new Map<string, Set<string>>();
        const currentByUser = new Map<string, { title: string; sourceId: string }>();
        for (const r of (subSteps ?? []) as {
          user_id: string;
          source_id: string | null;
          status: string | null;
          title: string;
        }[]) {
          if (!r.source_id) continue;
          if (r.status === 'completed' || r.status === 'settled') {
            if (!doneByUser.has(r.user_id)) doneByUser.set(r.user_id, new Set());
            doneByUser.get(r.user_id)!.add(r.source_id);
          } else if (r.status === 'in_progress') {
            if (!currentByUser.has(r.user_id)) {
              currentByUser.set(r.user_id, { title: r.title, sourceId: r.source_id });
            }
          }
        }
        const orderById = new Map<string, number>(
          (bpSteps ?? []).map((r: { step_id: string; sort_order: number }) => [
            r.step_id,
            r.sort_order,
          ]),
        );

        subscribers = subIds.map((id: string, idx: number) => {
          const name = nameByUser.get(id) || 'Anonymous';
          const sailor = sailorByUser.get(id);
          const doneCount = doneByUser.get(id)?.size ?? 0;
          const current = currentByUser.get(id);
          const currentStepNumber = current
            ? (orderById.get(current.sourceId) ?? 0) + 1
            : doneCount + 1;
          return {
            id,
            name,
            initials: initialsOf(name),
            avatarTint: sailor?.avatar_color || TINTS[idx % TINTS.length],
            where: sailor?.home_club || sailor?.location,
            currentStepLabel: current?.title || (doneCount > 0 ? 'Step done' : 'Not started'),
            currentStepNumber,
            totalSteps,
            progressPct: totalSteps > 0 ? Math.min(100, (doneCount / totalSteps) * 100) : 0,
          };
        });
      }

      // 6. Resources
      const { data: resourceRows, error: resErr } = await supabase
        .from('plan_resources')
        .select('id, kind, title, url, linked_step_id, duration_min, position')
        .eq('plan_id', blueprintId)
        .order('position', { ascending: true });
      if (resErr) throw resErr;
      const resources: PlanResourceRow[] = (resourceRows ?? []).map(
        (r: {
          id: string;
          kind: string;
          title: string;
          url: string | null;
          linked_step_id: string | null;
          duration_min: number | null;
        }) => ({
          id: r.id,
          kind: (r.kind as PlanResourceRow['kind']) ?? 'link',
          title: r.title,
          durationMin: r.duration_min ?? undefined,
          linkedStepNumber: r.linked_step_id
            ? ((bpSteps ?? []) as { step_id: string; sort_order: number }[]).find(
                (bs) => bs.step_id === r.linked_step_id,
              )?.sort_order != null
              ? (((bpSteps ?? []) as {
                  step_id: string;
                  sort_order: number;
                }[]).find((bs) => bs.step_id === r.linked_step_id)!.sort_order +
                  1)
              : undefined
            : undefined,
        }),
      );

      const plan: PlanSummary = {
        id: bp.id,
        title: bp.title,
        authorName,
        authorInitials: initialsOf(authorName),
        stepCount: totalSteps,
        subscriberCount: bp.subscriber_count ?? subscribers.length,
        resourceCount: resources.length,
        meta: bp.description ?? undefined,
      };

      return { plan, steps, subscribers, resources };
    },
  });
}
