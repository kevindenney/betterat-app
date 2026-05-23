/**
 * parseWind — extracts direction (degrees) and speed (knots) from a
 * conditions snippet on the AtlasNextEvent ("12kn ESE · ebb 0.4kn").
 * Tests cover compass-token resilience (longest match wins so "ESE"
 * beats "E"), the fallback to HK summer trade wind when nothing matches,
 * and case-insensitivity.
 */

import { parseWind } from '@/hooks/useWindOverlay';

describe('parseWind', () => {
  it('parses "12kn ESE" → 112.5° + 12kn', () => {
    expect(parseWind('12kn ESE')).toEqual({ degrees: 112.5, knots: 12 });
  });

  it('parses "10-14 kts WSW" → 247.5° + 14kn (number adjacent to kts wins)', () => {
    // Regex captures the digit run immediately before "kts" — i.e. the
    // upper bound when a range like "10-14" is given. This is the safer
    // visualization choice (arrows render at the typical-stronger speed).
    expect(parseWind('10-14 kts WSW')).toEqual({ degrees: 247.5, knots: 14 });
  });

  it('case-insensitive', () => {
    expect(parseWind('8kn se')).toEqual({ degrees: 135, knots: 8 });
  });

  it('longest token wins (ESE beats E)', () => {
    expect(parseWind('12kn ESE · ebb 0.4kn').degrees).toBe(112.5);
  });

  it('falls back to ESE 12kn when no conditions string', () => {
    expect(parseWind(undefined)).toEqual({ degrees: 112.5, knots: 12 });
  });

  it('falls back to ESE 12kn when no compass token', () => {
    expect(parseWind('cloudy with rain')).toEqual({ degrees: 112.5, knots: 12 });
  });

  it('handles cardinal-only direction', () => {
    expect(parseWind('15kn N')).toEqual({ degrees: 0, knots: 15 });
  });

  it('parses N over NNE when bare', () => {
    expect(parseWind('5kn NNE')).toEqual({ degrees: 22.5, knots: 5 });
  });

  it('parses decimal knots', () => {
    expect(parseWind('7.5 kn SW')).toEqual({ degrees: 225, knots: 7.5 });
  });

  it('ignores letters inside other words', () => {
    // "WEATHER" should NOT match W or E as standalone tokens
    expect(parseWind('WEATHER: SE 8 KN').degrees).toBe(135);
  });
});
