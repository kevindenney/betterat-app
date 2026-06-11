import type { StepPlanData, SubStep } from '@/types/step-detail';

/**
 * Blueprint-authored and seeded plans sometimes persist how_sub_steps as bare
 * `{ text }` rows with no id. Renderers key rows by `id` and the Do-tab toggle
 * matches rows by `id`, so missing ids collapse every row into one (checking
 * one box flips them all). Fill the missing SubStep fields deterministically
 * by position so the same row always resolves to the same id.
 */
export function normalizeHowSubSteps(subs: StepPlanData['how_sub_steps']): SubStep[] {
  return (subs ?? []).map((s, i) => ({
    ...s,
    id: s.id ?? `how-${i}`,
    sort_order: s.sort_order ?? i,
    completed: s.completed ?? false,
  }));
}
