/**
 * StepPlanScrollMemory — remembers PlanTab scroll position per stepId
 * across remounts caused by Atlas round-trips ("Pick on map").
 *
 * Flow: user scrolls to WHERE section → taps "Pick on map" → pushes to
 * /(tabs)/atlas?fromPlan=1 → step screen unmounts. After the pick,
 * router.back() remounts the step at y=0. Without this store the user
 * lands at the top and has to re-find the WHERE section to confirm the
 * location saved.
 *
 * The PlanTab writes its scroll y on every scroll, and on mount checks
 * this store for a saved entry matching its current stepId. If found,
 * it scrolls there and clears the entry so subsequent normal-flow
 * navigations don't restore stale positions.
 */

interface Saved {
  stepId: string;
  y: number;
  /** Wall-clock ms — entries older than this are ignored as stale. */
  savedAt: number;
}

const STALE_MS = 60_000;

let saved: Saved | null = null;

export const StepPlanScrollMemory = {
  remember(stepId: string, y: number): void {
    if (!stepId) return;
    saved = { stepId, y, savedAt: Date.now() };
  },
  /** One-shot consume. Returns null if no entry or stale or mismatched. */
  take(stepId: string): number | null {
    if (!saved || saved.stepId !== stepId) return null;
    if (Date.now() - saved.savedAt > STALE_MS) {
      saved = null;
      return null;
    }
    const { y } = saved;
    saved = null;
    return y;
  },
  clear(): void {
    saved = null;
  },
};
