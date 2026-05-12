import {
  deriveConfidencePercent,
  deriveStrategySummary,
  isDocumentSelectionCancelled,
  normalizeStrategyUploadError,
} from '@/lib/ai-strategy.utils';
import type { RaceStrategy } from '@/services/aiService';

describe('ai-strategy upload utils', () => {
  it('detects document picker cancellation message', () => {
    expect(isDocumentSelectionCancelled({ message: 'Document selection canceled' })).toBe(true);
    expect(isDocumentSelectionCancelled({ message: 'Other error' })).toBe(false);
    expect(isDocumentSelectionCancelled(null)).toBe(false);
  });

  it('normalizes upload error messages with fallback', () => {
    // Messages mentioning "network" get expanded to a connectivity hint.
    expect(normalizeStrategyUploadError({ message: ' Network issue ' })).toBe(
      'Network issue while generating strategy. Check your connection and retry.'
    );
    expect(normalizeStrategyUploadError({ message: ' Some other error ' })).toBe(
      'Some other error'
    );
    expect(normalizeStrategyUploadError({ message: '' })).toBe(
      'Unable to generate strategy from this document.'
    );
    expect(normalizeStrategyUploadError(undefined)).toBe(
      'Unable to generate strategy from this document.'
    );
  });

  it('derives strategy summary from best available fields', () => {
    const strategy = {
      pre_start_plan: { positioning: 'Own pin-end lane' },
      upwind_strategy: { tack_plan: 'Protect right shift' },
    } as unknown as RaceStrategy;
    expect(deriveStrategySummary(strategy)).toBe('Own pin-end lane');

    const strategyFallback = {
      pre_start_plan: { positioning: '' },
      upwind_strategy: { tack_plan: 'Sail lifted tack' },
    } as unknown as RaceStrategy;
    expect(deriveStrategySummary(strategyFallback)).toBe('Sail lifted tack');
  });

  it('converts confidence score into bounded percentage', () => {
    expect(deriveConfidencePercent(0.83)).toBe(83);
    expect(deriveConfidencePercent(83)).toBe(83);
    expect(deriveConfidencePercent(1.5)).toBe(100);
    expect(deriveConfidencePercent(1.01)).toBe(100);
    expect(deriveConfidencePercent(-0.2)).toBe(0);
    expect(deriveConfidencePercent(150)).toBe(100);
    expect(deriveConfidencePercent(undefined)).toBe(0);
  });
});
