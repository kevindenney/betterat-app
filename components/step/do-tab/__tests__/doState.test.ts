import { deriveDoInteriorState, hasAnyDoCapture } from '../doState';
import type { StepActData } from '@/types/step-detail';

describe('doState', () => {
  describe('deriveDoInteriorState', () => {
    it('returns pre_activity when status is pending and act is empty', () => {
      expect(deriveDoInteriorState({ status: 'pending', act: {} })).toBe('pre_activity');
    });

    it('returns pre_activity when act is undefined', () => {
      expect(deriveDoInteriorState({ status: 'pending', act: undefined })).toBe('pre_activity');
    });

    it('returns live when status is in_progress', () => {
      expect(deriveDoInteriorState({ status: 'in_progress', act: {} })).toBe('live');
    });

    it('returns live when started_at is set even without status', () => {
      const act: StepActData = { started_at: '2026-05-16T10:00:00Z' };
      expect(deriveDoInteriorState({ act })).toBe('live');
    });

    it('returns live when captures exist but no started_at', () => {
      const act: StepActData = {
        observations: [{ id: 'a', text: 'first', timestamp: '2026-05-16T10:00:00Z' }],
      };
      expect(deriveDoInteriorState({ act })).toBe('live');
    });

    it('returns post_activity when activityEndedAt is set, overriding live', () => {
      const act: StepActData = { started_at: '2026-05-16T10:00:00Z' };
      expect(
        deriveDoInteriorState({
          status: 'in_progress',
          act,
          activityEndedAt: '2026-05-16T11:00:00Z',
        }),
      ).toBe('post_activity');
    });

    describe('when isTimed === false (untimed steps)', () => {
      it('ignores in_progress status and returns pre_activity when no captures', () => {
        expect(
          deriveDoInteriorState({ status: 'in_progress', act: {}, isTimed: false }),
        ).toBe('pre_activity');
      });

      it('ignores a stale started_at and returns pre_activity when no captures', () => {
        const act: StepActData = { started_at: '2026-05-16T10:00:00Z' };
        expect(deriveDoInteriorState({ act, isTimed: false })).toBe('pre_activity');
      });

      it('still returns live when captures exist (the stream view, no timer)', () => {
        const act: StepActData = {
          started_at: '2026-05-16T10:00:00Z',
          observations: [{ id: 'a', text: 'sketch', timestamp: '2026-05-16T10:05:00Z' }],
        };
        expect(
          deriveDoInteriorState({ status: 'in_progress', act, isTimed: false }),
        ).toBe('live');
      });
    });
  });

  describe('hasAnyDoCapture', () => {
    it('returns false for empty / undefined act', () => {
      expect(hasAnyDoCapture(undefined)).toBe(false);
      expect(hasAnyDoCapture(null)).toBe(false);
      expect(hasAnyDoCapture({})).toBe(false);
    });

    it('returns true when an observation has text', () => {
      expect(
        hasAnyDoCapture({
          observations: [{ id: 'a', text: 'note', timestamp: '2026-05-16T10:00:00Z' }],
        }),
      ).toBe(true);
    });

    it('ignores observations whose text is whitespace', () => {
      expect(
        hasAnyDoCapture({
          observations: [{ id: 'a', text: '   ', timestamp: '2026-05-16T10:00:00Z' }],
        }),
      ).toBe(false);
    });

    it('returns true when media_uploads has any entries', () => {
      expect(
        hasAnyDoCapture({
          media_uploads: [{ id: 'm', uri: 'x', type: 'photo' }],
        }),
      ).toBe(true);
    });

    it('returns true when notes has content', () => {
      expect(hasAnyDoCapture({ notes: 'something' })).toBe(true);
    });
  });
});
