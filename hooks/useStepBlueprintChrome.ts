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

      // 1. Look up the step's source_blueprint_id
      const { data: stepRow } = await supabase
        .from('timeline_steps')
        .select('id, source_blueprint_id')
        .eq('id', stepId)
        .maybeSingle();
      const blueprintId = (stepRow as { source_blueprint_id?: string | null } | null)
        ?.source_blueprint_id;
      if (!blueprintId) return null;

      // 2. Blueprint metadata
      const { data: bp } = await supabase
        .from('timeline_blueprints')
        .select('id, title, slug, user_id')
        .eq('id', blueprintId)
        .maybeSingle();
      if (!bp) return null;
      const blueprintRow = bp as {
        id: string;
        title: string;
        slug: string | null;
        user_id: string;
      };

      // 3. Author display name
      const { data: authorRow } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', blueprintRow.user_id)
        .maybeSingle();
      const authorName =
        ((authorRow as { full_name?: string | null } | null)?.full_name) ?? null;

      // 4. Step position within the blueprint
      const { data: bpStepsRows } = await supabase
        .from('blueprint_steps')
        .select('step_id, sort_order')
        .eq('blueprint_id', blueprintId)
        .order('sort_order', { ascending: true });
      const bpSteps =
        (bpStepsRows as { step_id: string; sort_order: number }[] | null) ?? [];
      const totalSteps = bpSteps.length;
      const idx = bpSteps.findIndex((r) => r.step_id === stepId);
      // We adopted a COPY of the step, so the adopted step's id won't be in
      // blueprint_steps. Fall back to matching by the source step id stored
      // in metadata if the direct match misses.
      let stepNumber: number | null = idx >= 0 ? idx + 1 : null;
      if (stepNumber == null) {
        const { data: adoptedRow } = await supabase
          .from('timeline_steps')
          .select('metadata')
          .eq('id', stepId)
          .maybeSingle();
        const meta = (adoptedRow as { metadata?: Record<string, unknown> } | null)
          ?.metadata as Record<string, unknown> | undefined;
        const sourceStepId =
          (meta?.source_step_id as string | undefined) ??
          (meta?.copied_from_step_id as string | undefined);
        if (sourceStepId) {
          const sourceIdx = bpSteps.findIndex((r) => r.step_id === sourceStepId);
          if (sourceIdx >= 0) stepNumber = sourceIdx + 1;
        }
      }

      // 5. Subscriber count
      const { count: subscriberCount } = await supabase
        .from('blueprint_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('blueprint_id', blueprintId);

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
    enabled: Boolean(stepId),
    staleTime: 5 * 60 * 1000,
  });
}
