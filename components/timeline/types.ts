/**
 * Shared types for the horizontal step-card timeline (D31).
 */

export type StepPhaseState = 'done' | 'current' | 'next';

/** Plan / Do / Reflect phase progress per card. */
export type PhaseProgress = 'empty' | 'half' | 'full';

export interface StepCardH {
  id: string;
  title: string;
  stepNumber: number;
  totalSteps: number;
  /** done | current (NOW) | next (upcoming). Drives opacity, border, NOW divider position. */
  state: StepPhaseState;
  /** Pill label. Often matches state but can be a richer label like "Up Next" / "Settled". */
  pillLabel?: string;
  /** Meta string: e.g. "Settled · Apr 27 · 3 ideas saved" */
  meta?: string;
  /** Plan / Do / Reflect — three dots, ordered. */
  phaseDots?: [PhaseProgress, PhaseProgress, PhaseProgress];
  /** Plan-provenance stripe colour (left edge). e.g. coral / amber / gray. Optional. */
  stripeColor?: string;
  /** Short plan tag (top row, uppercase). e.g. "HKDW · STEP 4 OF 12" */
  planTag?: string;
}
