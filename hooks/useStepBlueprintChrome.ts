/**
 * useStepBlueprintChrome — resolve the blueprint context for a step so the
 * canonical subscribed-step chrome can render.
 *
 * Given a timeline_step id, returns the data needed by StepBlueprintChrome:
 *   - blueprint id + slug (for routing)
 *   - blueprint title + author name
 *   - the step's position within the blueprint ("Step N of M")
 *   - the subscriber count (for the WITH-row fleet chip)
 *
 * Returns null when the step has no source_blueprint_id (i.e. wasn't
 * adopted from a subscribed blueprint), so callers can skip rendering
 * the chrome entirely.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { isPersistedRaceId } from '@/lib/races/isPersistedRaceId';

export interface StepBlueprintChromeData {
  blueprintId: string;
  blueprintSlug: string | null;
  blueprintTitle: string;
  blueprintShortName: string;
  authorName: string | null;
  stepNumber: number | null;
  totalSteps: number;
  subscriberCount: number;
}

function shortNameFor(title: string): string {
  // First three words, capped at ~24 chars. Keeps "Achieving Peak Performance
  // at the Dragon Worlds" readable in the trophy strip without truncating
  // mid-word. The full title still appears in the "From X" line.
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length <= 3) return title;
  const candidate = words.slice(0, 3).join(' ');
  return candidate.length > 28 ? `${candidate.slice(0, 26)}…` : candidate;
}

export function useStepBlueprintChrome(stepId: string | null | undefined) {
  return useQuery<StepBlueprintChromeData | null>({
    queryKey: ['step-blueprint-chrome', stepId],
    queryFn: async () => {
      try {
      if (!stepId) return null;

      // 1. Look up the step's source_blueprint_id + source_id (source step id
      //    on the blueprint, set by adoptStep — used for position resolution).
      const { data: stepRow } = await supabase
        .from('timeline_steps')
        .select('id, source_blueprint_id, source_id, metadata')
        .eq('id', stepId)
        .maybeSingle();
      const blueprintId = (stepRow as { source_blueprint_id?: string | null } | null)
        ?.source_blueprint_id;
      const sourceStepIdFromColumn = (stepRow as { source_id?: string | null } | null)
        ?.source_id;
      if (!blueprintId) return null;

      // Steps 2, 4, 5 all key off blueprintId alone, so fire them together
      // instead of three sequential round-trips. (Author lookup in step 3
      // still has to wait — it needs the blueprint's user_id.)
      const [{ data: bp }, { data: bpStepsRows }, { count: subscriberCount }] =
        await Promise.all([
          // 2. Blueprint metadata
          supabase
            .from('timeline_blueprints')
            .select('id, title, slug, user_id')
            .eq('id', blueprintId)
            .maybeSingle(),
          // 4. Step position within the blueprint
          supabase
            .from('blueprint_steps')
            .select('step_id, sort_order')
            .eq('blueprint_id', blueprintId)
            .order('sort_order', { ascending: true }),
          // 5. Subscriber count
          supabase
            .from('blueprint_subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('blueprint_id', blueprintId),
        ]);

      if (!bp) return null;
      const blueprintRow = bp as {
        id: string;
        title: string;
        slug: string | null;
        user_id: string;
      };

      // 3. Author display name — fall back to null when the stored value
      //    is just an email. profiles.full_name often holds the seed
      //    sailor's email rather than a real display name (see memory
      //    feedback_seed_sailors_users_vs_profiles); rendering "by
      //    jhu2+denneyke@gmail.com" reads worse than dropping the clause
      //    entirely. IdentityDeck only renders "by X" when this is
      //    truthy, so returning null gracefully degrades.
      const { data: authorRow } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name')
        .eq('id', blueprintRow.user_id)
        .maybeSingle();
      const profileRow = authorRow as
        | { full_name?: string | null; first_name?: string | null; last_name?: string | null }
        | null;
      const rawFullName = profileRow?.full_name?.trim() ?? null;
      const composedName = [profileRow?.first_name, profileRow?.last_name]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join(' ');
      const looksLikeEmail = (s: string | null | undefined): boolean =>
        !!s && /\S+@\S+\.\S+/.test(s);
      const authorName =
        (composedName || (looksLikeEmail(rawFullName) ? null : rawFullName)) || null;

      const bpSteps =
        (bpStepsRows as { step_id: string; sort_order: number }[] | null) ?? [];
      const totalSteps = bpSteps.length;
      // Adopted steps are COPIES; their id won't appear in blueprint_steps.
      // Resolve position by the source step id, which adoptStep writes to
      // timeline_steps.source_id (preferred) and older paths may put in
      // metadata.{source_step_id, copied_from_step_id}.
      const meta = (stepRow as { metadata?: Record<string, unknown> } | null)
        ?.metadata as Record<string, unknown> | undefined;
      const sourceStepId =
        sourceStepIdFromColumn ??
        (meta?.source_step_id as string | undefined) ??
        (meta?.copied_from_step_id as string | undefined) ??
        null;
      const directIdx = bpSteps.findIndex((r) => r.step_id === stepId);
      let stepNumber: number | null = directIdx >= 0 ? directIdx + 1 : null;
      if (stepNumber == null && sourceStepId) {
        const sourceIdx = bpSteps.findIndex((r) => r.step_id === sourceStepId);
        if (sourceIdx >= 0) stepNumber = sourceIdx + 1;
      }

      return {
        blueprintId: blueprintRow.id,
        blueprintSlug: blueprintRow.slug,
        blueprintTitle: blueprintRow.title,
        blueprintShortName: shortNameFor(blueprintRow.title),
        authorName,
        stepNumber,
        totalSteps,
        subscriberCount: subscriberCount ?? 0,
      };
      } catch {
        // Defensive: never throw out of useQuery — return null so the
        // chrome simply doesn't render if anything in the join chain fails.
        return null;
      }
    },
    enabled: isPersistedRaceId(stepId),
    staleTime: 5 * 60 * 1000,
  });
}
