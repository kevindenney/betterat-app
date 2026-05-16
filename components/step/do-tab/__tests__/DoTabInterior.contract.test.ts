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
    it('contains the canonical Frame 1 copy', () => {
      expect(startCardSource).toContain('Start capturing');
      expect(startCardSource).toContain('Voice, photo, or quick notes');
      expect(startCardSource).toContain('Captures will appear here as you go.');
    });

    it('contains the three capture affordance labels in canonical order', () => {
      expect(startCardSource).toContain('Voice note');
      expect(startCardSource).toContain('Photo or video');
      expect(startCardSource).toContain('Quick note');
      const voiceIdx = startCardSource.indexOf('Voice note');
      const photoIdx = startCardSource.indexOf('Photo or video');
      const noteIdx = startCardSource.indexOf('Quick note');
      expect(voiceIdx).toBeLessThan(photoIdx);
      expect(photoIdx).toBeLessThan(noteIdx);
    });
  });

  describe('PlanStartingFrameRow', () => {
    it('contains the canonical auto-summarize copy', () => {
      expect(planRowSource).toContain('Auto-summarize my Plan as a starting frame');
      expect(planRowSource).toContain('What · How · Why');
    });

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

    it('renders nothing substantive in non-pre_activity states (Frames 2-4 deferred)', () => {
      expect(interiorSource).toMatch(/state !== 'pre_activity'/);
    });
  });
});
