export const COACH_HOME_P95_BUDGET_MS = 600;

export type CoachHomeProfileStep =
  | 'core_queries'
  | 'assigned_program_preview'
  | 'derive_retention_metrics'
  | 'state_commit';

export type CoachHomeProfileSample = {
  step: CoachHomeProfileStep;
  durationMs: number;
};

export type CoachHomeProfileSummary = {
  totalMs: number;
  budgetMs: number;
  budgetExceeded: boolean;
  steps: CoachHomeProfileSample[];
};

export type CoachHomeBaselineInput = {
  run_id: string;
  generated_at: string;
  budget_ms: number;
  samples: {
    step: CoachHomeProfileStep;
    duration_ms: number;
  }[];
};

export async function profileCoachHomeStep<T>(
  step: CoachHomeProfileStep,
  fn: () => Promise<T>,
  samples: CoachHomeProfileSample[]
): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    samples.push({
      step,
      durationMs: Math.max(0, Date.now() - started),
    });
  }
}

export function summarizeCoachHomeProfile(
  samples: CoachHomeProfileSample[],
  budgetMs: number = COACH_HOME_P95_BUDGET_MS
): CoachHomeProfileSummary {
  const steps = [...samples];
  const totalMs = steps.reduce((sum, row) => sum + row.durationMs, 0);
  return {
    totalMs,
    budgetMs,
    budgetExceeded: totalMs > budgetMs,
    steps,
  };
}

export function toCoachHomeBaselineInput(
  summary: CoachHomeProfileSummary,
  runId: string,
  generatedAt: string = new Date().toISOString()
): CoachHomeBaselineInput {
  return {
    run_id: String(runId || '').trim() || 'coach-home-profile-run',
    generated_at: generatedAt,
    budget_ms: summary.budgetMs,
    samples: summary.steps.map((row) => ({
      step: row.step,
      duration_ms: row.durationMs,
    })),
  };
}
