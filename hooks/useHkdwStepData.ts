/**
 * useHkdwStepData — Phase 10 real-data wiring for /practice/step/[id].
 *
 * Resolves a `timeline_steps` UUID to the data shape `HkdwStepCard` needs:
 * step content, blueprint context (title, short name, step number / total),
 * author byline, and subscriber count for the fleet chip.
 *
 * Returns null for steps that aren't in any published blueprint — the
 * route falls back to "step not found" in that case. The mock fast-path
 * at `/practice/step/boat-speed` skips this hook entirely.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface HkdwStepData {
  stepId: string;
  stepTitle: string;
  stepDescription: string | null;
  stepWhat: string | null;
  stepHowText: string | null;
  blueprintId: string;
  blueprintTitle: string;
  blueprintShortName: string;
  blueprintWeekLine: string;
  fromLine: string;
  stepCounter: string;
  stepNumber: number;
  totalSteps: number;
  subscriberCount: number;
  fleetChipLabel: string;
}

// Blueprint titles that have a known short-name (shown on the trophy strip).
// Extend this as more canonical blueprints land — the fallback is the full
// title which is usually fine on tablet but cramped on phone.
const BLUEPRINT_SHORT_NAMES: Record<string, string> = {
  'Prepare for the Dragon Worlds 2027.': 'HKDW Prep',
};

interface StepMetadataPlan {
  what_will_you_do?: string;
  how_sub_steps?: { text?: string }[];
}

interface StepMetadata {
  plan?: StepMetadataPlan;
}

function deriveWeekLine(stepNumber: number, totalSteps: number, durationMonths: number | null | undefined): string {
  if (!durationMonths || totalSteps <= 0) return `Step ${stepNumber} of ${totalSteps}`;
  const totalWeeks = Math.round(durationMonths * 4.33);
  const weeksPerStep = totalWeeks / totalSteps;
  const week = Math.max(1, Math.round((stepNumber - 1) * weeksPerStep) + 1);
  return `Week ${week} of ${totalWeeks}`;
}

function deriveHowText(plan: StepMetadataPlan | undefined): string | null {
  const subs = plan?.how_sub_steps ?? [];
  const texts = subs.map((s) => s?.text?.trim()).filter((t): t is string => !!t);
  if (texts.length === 0) return null;
  return texts.map((t) => `• ${t}`).join('\n');
}

export function useHkdwStepData(stepId: string | undefined) {
  return useQuery<HkdwStepData | null>({
    queryKey: ['hkdw-step', stepId],
    enabled: !!stepId,
    queryFn: async () => {
      const { data: step, error: stepErr } = await supabase
        .from('timeline_steps')
        .select('id, title, description, metadata')
        .eq('id', stepId!)
        .maybeSingle();
      if (stepErr || !step) return null;

      const { data: bpStep, error: bpStepErr } = await supabase
        .from('blueprint_steps')
        .select('blueprint_id, sort_order')
        .eq('step_id', stepId!)
        .maybeSingle();
      if (bpStepErr || !bpStep) return null;

      const { data: blueprint, error: bpErr } = await supabase
        .from('timeline_blueprints')
        .select('id, title, user_id, duration_months')
        .eq('id', bpStep.blueprint_id)
        .maybeSingle();
      if (bpErr || !blueprint) return null;

      const [authorRes, totalRes, positionRes, subsRes] = await Promise.all([
        blueprint.user_id
          ? supabase.from('profiles').select('full_name').eq('id', blueprint.user_id).maybeSingle()
          : Promise.resolve({ data: null as { full_name?: string | null } | null }),
        supabase
          .from('blueprint_steps')
          .select('id', { count: 'exact', head: true })
          .eq('blueprint_id', bpStep.blueprint_id),
        supabase
          .from('blueprint_steps')
          .select('id', { count: 'exact', head: true })
          .eq('blueprint_id', bpStep.blueprint_id)
          .lte('sort_order', bpStep.sort_order),
        supabase
          .from('blueprint_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('blueprint_id', bpStep.blueprint_id),
      ]);

      const authorName = (authorRes.data as { full_name?: string | null } | null)?.full_name ?? null;
      const totalSteps = totalRes.count ?? 0;
      const stepNumber = positionRes.count ?? 1;
      const subscriberCount = subsRes.count ?? 0;

      const cleanBlueprintTitle = blueprint.title.replace(/\.$/, '');
      const shortName =
        BLUEPRINT_SHORT_NAMES[blueprint.title] ?? cleanBlueprintTitle;
      const fromLine = authorName
        ? `From ${authorName}'s ${cleanBlueprintTitle}`
        : `From ${cleanBlueprintTitle}`;

      const metadata = (step.metadata ?? {}) as StepMetadata;
      const what = metadata?.plan?.what_will_you_do?.trim() || step.description || null;
      const howText = deriveHowText(metadata?.plan);

      return {
        stepId: step.id,
        stepTitle: step.title,
        stepDescription: step.description ?? null,
        stepWhat: what,
        stepHowText: howText,
        blueprintId: blueprint.id,
        blueprintTitle: blueprint.title,
        blueprintShortName: shortName,
        blueprintWeekLine: deriveWeekLine(stepNumber, totalSteps, blueprint.duration_months),
        fromLine,
        stepCounter: `Step ${stepNumber} of ${totalSteps}`,
        stepNumber,
        totalSteps,
        subscriberCount,
        fleetChipLabel: `Worlds Fleet · ${subscriberCount} sailor${subscriberCount === 1 ? '' : 's'}`,
      };
    },
  });
}
