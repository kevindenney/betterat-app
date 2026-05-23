/**
 * parseTide — extracts set direction (degrees) and speed (knots) from
 * an AtlasNextEvent conditions snippet ("12kn ESE · ebb 0.4kn"). Tides
 * differ from wind: convention is "set" (the direction water FLOWS), so
 * the arrow rotation is unflipped. For Victoria Harbour: ebb → east
 * (90°), flood → west (270°), slack → no field rendered.
 */

import { parseTide } from '@/hooks/useTideOverlay';

describe('parseTide', () => {
  it('parses "ebb 0.4kn" → set 90° + 0.4kn', () => {
    expect(parseTide('ebb 0.4kn')).toEqual({ setDegrees: 90, knots: 0.4 });
  });

  it('parses "flood 0.6 kt" → set 270° + 0.6kn', () => {
    expect(parseTide('flood 0.6 kt')).toEqual({ setDegrees: 270, knots: 0.6 });
  });

  it('parses "slack" → 0 knots (renders nothing downstream)', () => {
    expect(parseTide('slack')).toEqual({ setDegrees: 90, knots: 0 });
  });

  it('falls back to ebb 0.5kn when no tide token', () => {
    expect(parseTide('12kn ESE')).toEqual({ setDegrees: 90, knots: 0.5 });
  });

  it('falls back to ebb 0.5kn with empty input', () => {
    expect(parseTide(undefined)).toEqual({ setDegrees: 90, knots: 0.5 });
  });

  it('case-insensitive', () => {
    expect(parseTide('EBB 0.3')).toEqual({ setDegrees: 90, knots: 0.3 });
  });

  it('combined wind + tide string picks tide value, ignores wind knots', () => {
    expect(parseTide('12kn ESE · ebb 0.4kn')).toEqual({ setDegrees: 90, knots: 0.4 });
  });

  it('handles flood with decimal speed in compound string', () => {
    expect(parseTide('8kt N flood 1.2')).toEqual({ setDegrees: 270, knots: 1.2 });
  });
});
