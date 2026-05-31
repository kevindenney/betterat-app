/**
 * useCohortStream — recent cohort discussion posts on blueprints the
 * viewer is on (active plan or legacy subscription), excluding the
 * viewer's own posts.
 *
 * Drives the "From your cohorts" stream on the Watch tab — the
 * surface where you see "Markus just posted in HK Dragons · Race 3".
 *
 * Returns enriched rows with author display, blueprint + step
 * context, and a body preview. Falls back gracefully when the
 * blueprint row is dangling (subscription exists but blueprint
 * deleted — render whatever we can).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface CohortStreamItem {
  id: string; // step_discussions.id
  blueprintStepId: string;
  blueprintId: string;
  blueprintTitle: string | null;
  stepTitle: string | null;
  body: string;
  bodyPreview: string;
  createdAt: string;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorInitial: string;
  /** A timeline_step id from the viewer's own forked instance of
   *  this blueprint_step, if it exists — lets the stream card route
   *  the viewer directly to their step's Discuss tab. Null if the
   *  viewer has no forked copy (rare; can still link to a generic
   *  blueprint preview later). */
  viewerStepId: string | null;
}

const STALE_MS = 30_000;
const MAX_ITEMS = 50;
const PREVIEW_CHARS = 140;

function initialFrom(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function trimmedPreview(body: string): string {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (compact.length <= PREVIEW_CHARS) return compact;
  return compact.slice(0, PREVIEW_CHARS - 1).trimEnd() + '…';
}

export function useCohortStream(interestId?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cohort-stream', user?.id ?? 'anon', interestId ?? null],
    enabled: Boolean(user?.id),
    staleTime: STALE_MS,
    queryFn: async (): Promise<CohortStreamItem[]> => {
      const viewerId = user!.id;

      // 1. Resolve which blueprints the viewer is on (plan OR legacy
      //    subscription) — union, dedup.
      const [planRes, subRes] = await Promise.all([
        supabase
          .from('plans')
          .select('source_blueprint_id')
          .eq('user_id', viewerId)
          .eq('status', 'active'),
        supabase
          .from('blueprint_subscriptions')
          .select('blueprint_id')
          .eq('subscriber_id', viewerId),
      ]);
      const blueprintIds = new Set<string>();
      for (const r of (planRes.data ?? []) as { source_blueprint_id: string | null }[]) {
        if (r.source_blueprint_id) blueprintIds.add(r.source_blueprint_id);
      }
      for (const r of (subRes.data ?? []) as { blueprint_id: string }[]) {
        if (r.blueprint_id) blueprintIds.add(r.blueprint_id);
      }
      if (blueprintIds.size === 0) return [];

      // 2. Get the blueprint_step ids under those blueprints.
      const { data: bsRows } = await supabase
        .from('blueprint_steps')
        .select('id, blueprint_id, step_id')
        .in('blueprint_id', Array.from(blueprintIds));
      const blueprintStepIds = ((bsRows ?? []) as {
        id: string;
        blueprint_id: string;
        step_id: string;
      }[]);
      if (blueprintStepIds.length === 0) return [];
      const idsOnly = blueprintStepIds.map((r) => r.id);
      const blueprintIdByStepId = new Map(
        blueprintStepIds.map((r) => [r.id, r.blueprint_id]),
      );
      const canonicalStepIdByBlueprintStepId = new Map(
        blueprintStepIds.map((r) => [r.id, r.step_id]),
      );

      // 2b. Scope to the active interest via the canonical step's interest.
      //     The viewer's subscriptions span every interest they're on, so
      //     without this the feed pools (e.g.) nursing cohort posts atop a
      //     Lac Craft Business surface. Blueprints carry no interest_id, but
      //     blueprint_steps.step_id → timeline_steps.interest_id does.
      let scopedBlueprintStepIds = idsOnly;
      if (interestId) {
        const canonicalIds = Array.from(
          new Set(blueprintStepIds.map((r) => r.step_id).filter(Boolean)),
        );
        const { data: stepInterests } = canonicalIds.length
          ? await supabase
              .from('timeline_steps')
              .select('id, interest_id')
              .in('id', canonicalIds)
          : { data: [] as { id: string; interest_id: string | null }[] };
        const interestByStepId = new Map(
          ((stepInterests ?? []) as { id: string; interest_id: string | null }[]).map(
            (r) => [r.id, r.interest_id],
          ),
        );
        scopedBlueprintStepIds = idsOnly.filter((bsId) => {
          const stepId = canonicalStepIdByBlueprintStepId.get(bsId);
          return stepId != null && interestByStepId.get(stepId) === interestId;
        });
        if (scopedBlueprintStepIds.length === 0) return [];
      }

      // 3. Recent cohort posts on those blueprint_steps, excluding
      //    the viewer's own posts.
      const { data: discussions } = await supabase
        .from('step_discussions')
        .select(
          'id, blueprint_step_id, user_id, body, created_at',
        )
        .in('blueprint_step_id', scopedBlueprintStepIds)
        .not('blueprint_step_id', 'is', null)
        .neq('user_id', viewerId)
        .order('created_at', { ascending: false })
        .limit(MAX_ITEMS);
      const rows = (discussions ?? []) as {
        id: string;
        blueprint_step_id: string;
        user_id: string;
        body: string;
        created_at: string;
      }[];
      if (rows.length === 0) return [];

      // 4. Enrich: blueprint titles, step titles (via canonical),
      //    author profiles, viewer's forked timeline_steps.
      const blueprintIdSet = new Set<string>();
      const canonicalStepIdSet = new Set<string>();
      const authorIdSet = new Set<string>();
      for (const r of rows) {
        const bid = blueprintIdByStepId.get(r.blueprint_step_id);
        if (bid) blueprintIdSet.add(bid);
        const cid = canonicalStepIdByBlueprintStepId.get(r.blueprint_step_id);
        if (cid) canonicalStepIdSet.add(cid);
        authorIdSet.add(r.user_id);
      }

      const [blueprintsRes, stepsRes, profilesRes, viewerStepsRes] = await Promise.all([
        blueprintIdSet.size > 0
          ? supabase.from('blueprints').select('id, title').in('id', Array.from(blueprintIdSet))
          : Promise.resolve({ data: [] as { id: string; title: string | null }[] }),
        canonicalStepIdSet.size > 0
          ? supabase
              .from('timeline_steps')
              .select('id, title')
              .in('id', Array.from(canonicalStepIdSet))
          : Promise.resolve({ data: [] as { id: string; title: string | null }[] }),
        authorIdSet.size > 0
          ? supabase
              .from('profiles')
              .select('id, full_name, first_name, last_name, avatar_url')
              .in('id', Array.from(authorIdSet))
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('timeline_steps')
          .select('id, source_blueprint_step_id')
          .eq('user_id', viewerId)
          .in('source_blueprint_step_id', idsOnly),
      ]);
      const blueprintTitleById = new Map(
        ((blueprintsRes as any).data ?? []).map((r: { id: string; title: string | null }) => [
          r.id,
          r.title,
        ]),
      );
      const stepTitleByCanonicalId = new Map(
        ((stepsRes as any).data ?? []).map((r: { id: string; title: string | null }) => [
          r.id,
          r.title,
        ]),
      );
      const profileById = new Map(
        ((profilesRes as any).data ?? []).map((p: any) => [p.id, p]),
      );
      const viewerStepIdByBlueprintStepId = new Map<string, string>();
      for (const r of ((viewerStepsRes as any).data ?? []) as {
        id: string;
        source_blueprint_step_id: string;
      }[]) {
        viewerStepIdByBlueprintStepId.set(r.source_blueprint_step_id, r.id);
      }

      return rows.map((r): CohortStreamItem => {
        const blueprintId = blueprintIdByStepId.get(r.blueprint_step_id) ?? '';
        const canonicalStepId = canonicalStepIdByBlueprintStepId.get(r.blueprint_step_id);
        const profile = profileById.get(r.user_id) ?? null;
        const authorName =
          ((profile as any)?.full_name as string | null)?.trim() ||
          [
            (profile as any)?.first_name,
            (profile as any)?.last_name,
          ]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          'A cohort member';
        return {
          id: r.id,
          blueprintStepId: r.blueprint_step_id,
          blueprintId,
          blueprintTitle: blueprintTitleById.get(blueprintId) ?? null,
          stepTitle: canonicalStepId
            ? (stepTitleByCanonicalId.get(canonicalStepId) ?? null)
            : null,
          body: r.body,
          bodyPreview: trimmedPreview(r.body),
          createdAt: r.created_at,
          authorUserId: r.user_id,
          authorName,
          authorAvatarUrl: ((profile as any)?.avatar_url as string | null) ?? null,
          authorInitial: initialFrom(authorName),
          viewerStepId: viewerStepIdByBlueprintStepId.get(r.blueprint_step_id) ?? null,
        };
      });
    },
  });
}
