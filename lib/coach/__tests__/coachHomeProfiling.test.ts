import {
  COACH_HOME_P95_BUDGET_MS,
  profileCoachHomeStep,
  summarizeCoachHomeProfile,
  toCoachHomeBaselineInput,
} from '../coachHomeProfiling';

describe('coachHomeProfiling helpers', () => {
  it('records step duration samples', async () => {
    const samples: { step: any; durationMs: number }[] = [];
    const value = await profileCoachHomeStep('core_queries', async () => 42, samples as any);

    expect(value).toBe(42);
    expect(samples).toHaveLength(1);
    expect(samples[0].step).toBe('core_queries');
    expect(samples[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('marks budget exceeded when total duration is over threshold', () => {
    const summary = summarizeCoachHomeProfile(
      [
        { step: 'core_queries', durationMs: 300 },
        { step: 'assigned_program_preview', durationMs: 250 },
        { step: 'derive_retention_metrics', durationMs: 100 },
      ],
      COACH_HOME_P95_BUDGET_MS
    );

    expect(summary.totalMs).toBe(650);
    expect(summary.budgetExceeded).toBe(true);
    expect(summary.budgetMs).toBe(600);
  });

  it('exports deterministic baseline input payload shape', () => {
    const summary = summarizeCoachHomeProfile(
      [
        { step: 'core_queries', durationMs: 300 },
        { step: 'assigned_program_preview', durationMs: 120 },
      ],
      600
    );

    const payload = toCoachHomeBaselineInput(summary, 'run-001', '2026-03-03T13:05:00.000Z');

    expect(payload).toEqual({
      run_id: 'run-001',
      generated_at: '2026-03-03T13:05:00.000Z',
      budget_ms: 600,
      samples: [
        { step: 'core_queries', duration_ms: 300 },
        { step: 'assigned_program_preview', duration_ms: 120 },
      ],
    });
  });
});
