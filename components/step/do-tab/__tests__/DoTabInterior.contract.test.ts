import fs from 'fs';
import path from 'path';

const interiorSource = fs.readFileSync(
  path.join(__dirname, '..', 'DoTabInterior.tsx'),
  'utf8',
);
const startCardSource = fs.readFileSync(
  path.join(__dirname, '..', 'DoStartCard.tsx'),
  'utf8',
);
const planRowSource = fs.readFileSync(
  path.join(__dirname, '..', 'PlanStartingFrameRow.tsx'),
  'utf8',
);
const combined = `${interiorSource}\n${startCardSource}\n${planRowSource}`;

describe('Phase B.7 Frame 1 contract', () => {
  describe('DoStartCard', () => {
    it('contains the quick-note-first Frame 1 copy', () => {
      expect(startCardSource).toContain('Capture evidence');
      expect(startCardSource).toContain('Jot a quick note');
      expect(startCardSource).toContain('Add note');
    });

    it('contains the three capture affordance labels in quick-note-first order', () => {
      expect(startCardSource).toContain('Quick note');
      expect(startCardSource).toContain('Voice');
      expect(startCardSource).toContain('Photo or video');
      const noteIdx = startCardSource.indexOf('accessibilityLabel="Quick note"');
      const voiceIdx = startCardSource.indexOf('label="Voice"');
      const photoIdx = startCardSource.indexOf('label="Photo or video"');
      expect(noteIdx).toBeLessThan(voiceIdx);
      expect(voiceIdx).toBeLessThan(photoIdx);
    });
  });

  describe('PlanStartingFrameRow', () => {
    it('exports a hasPlanStartingFrameContent predicate', () => {
      expect(planRowSource).toMatch(/export function hasPlanStartingFrameContent/);
    });
  });

  describe('DoTabInterior state gating', () => {
    it('only renders Frame 1 content when state is pre_activity', () => {
      expect(interiorSource).toMatch(/state === 'pre_activity'/);
      expect(combined).toContain('DoStartCard');
      expect(combined).toContain('PlanStartingFrameRow');
    });

    it('dispatches to DoLiveCard when state is live (Frame 2)', () => {
      expect(interiorSource).toMatch(/state === 'live'/);
      expect(interiorSource).toContain('DoLiveCard');
    });

    it('dispatches to DoPostActivityCard when state is post_activity (Frame 3)', () => {
      expect(interiorSource).toMatch(/state === 'post_activity'/);
      expect(interiorSource).toContain('DoPostActivityCard');
    });
  });
});
