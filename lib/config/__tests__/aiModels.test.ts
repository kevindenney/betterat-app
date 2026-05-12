import {
  BUDGET_MODEL,
  DEFAULT_MODEL,
  PREMIUM_MODEL,
  estimateCost,
  getModelConfig,
  getModelForTask,
} from '@/lib/config/aiModels';

describe('aiModels config', () => {
  describe('getModelForTask', () => {
    // Client config always returns gemini-2.5-flash (DEFAULT_MODEL === BUDGET_MODEL);
    // edge functions perform real provider routing via AI_PROVIDER / AI_TASK_* env vars.
    it('returns default model for simple tasks', () => {
      expect(getModelForTask('voice-transcription')).toBe(DEFAULT_MODEL);
      expect(getModelForTask('simple-extraction')).toBe(DEFAULT_MODEL);
    });

    it('returns default model for standard tasks', () => {
      expect(getModelForTask('race-strategy')).toBe(DEFAULT_MODEL);
      expect(getModelForTask('session-planning')).toBe(DEFAULT_MODEL);
    });

    it('returns default model for complex tasks (client routing is flat)', () => {
      expect(getModelForTask('multi-step-reasoning')).toBe(DEFAULT_MODEL);
      expect(getModelForTask('code-generation')).toBe(DEFAULT_MODEL);
    });

    it('falls back to default model for unknown tasks', () => {
      expect(getModelForTask('unknown-task-type')).toBe(DEFAULT_MODEL);
    });

    it('exposes a premium tier model id distinct from default', () => {
      expect(PREMIUM_MODEL).not.toBe(DEFAULT_MODEL);
      expect(BUDGET_MODEL).toBe(DEFAULT_MODEL);
    });
  });

  describe('getModelConfig', () => {
    it('returns config for known model id', () => {
      const config = getModelConfig(DEFAULT_MODEL);
      expect(config).toBeDefined();
      expect(config?.id).toBe(DEFAULT_MODEL);
    });

    it('returns undefined for unknown model id', () => {
      const unknown = getModelConfig('claude-3-5-sonnet-20241022');
      expect(unknown).toBeUndefined();
    });
  });

  describe('estimateCost', () => {
    it('returns zero when config is missing', () => {
      const cost = estimateCost('claude-3-5-sonnet-20241022', 5000, 2000);
      expect(cost).toBe(0);
    });

    it('calculates non-negative cost for known models', () => {
      // DEFAULT_MODEL is gemini-2.5-flash which is free tier (cost === 0).
      // Premium tier returns a positive cost.
      expect(estimateCost(DEFAULT_MODEL, 1000, 1000)).toBe(0);
      expect(estimateCost(PREMIUM_MODEL, 1000, 1000)).toBeGreaterThan(0);
    });
  });
});
