import { getSeriesLabel, getSeriesLabelPlural } from '../navigation-config';

describe('getSeriesLabel', () => {
  it('returns Season for sailing slugs', () => {
    expect(getSeriesLabel({ slug: 'sailing' })).toBe('Season');
    expect(getSeriesLabel({ slug: 'sail-racing' })).toBe('Season');
    expect(getSeriesLabel('sailing')).toBe('Season');
    expect(getSeriesLabel('SAIL-RACING')).toBe('Season');
  });

  it('returns Term for nursing', () => {
    expect(getSeriesLabel({ slug: 'nursing' })).toBe('Term');
    expect(getSeriesLabel('nursing')).toBe('Term');
  });

  it('returns Workshop for drawing', () => {
    expect(getSeriesLabel({ slug: 'drawing' })).toBe('Workshop');
    expect(getSeriesLabel('drawing')).toBe('Workshop');
  });

  it('returns Block for fitness', () => {
    expect(getSeriesLabel({ slug: 'fitness' })).toBe('Block');
    expect(getSeriesLabel({ slug: 'health-and-fitness' })).toBe('Block');
  });

  it('falls back to Series for unknown, missing, or empty inputs', () => {
    expect(getSeriesLabel({ slug: 'unknown' })).toBe('Series');
    expect(getSeriesLabel({ slug: null })).toBe('Series');
    expect(getSeriesLabel({ slug: '' })).toBe('Series');
    expect(getSeriesLabel({})).toBe('Series');
    expect(getSeriesLabel(null)).toBe('Series');
    expect(getSeriesLabel(undefined)).toBe('Series');
    expect(getSeriesLabel('')).toBe('Series');
  });
});

describe('getSeriesLabelPlural', () => {
  it('appends s to singular forms that do not already end in s', () => {
    expect(getSeriesLabelPlural({ slug: 'sailing' })).toBe('Seasons');
    expect(getSeriesLabelPlural({ slug: 'nursing' })).toBe('Terms');
    expect(getSeriesLabelPlural({ slug: 'drawing' })).toBe('Workshops');
    expect(getSeriesLabelPlural({ slug: 'fitness' })).toBe('Blocks');
  });

  it('does not double-pluralize the Series fallback', () => {
    expect(getSeriesLabelPlural({ slug: 'unknown' })).toBe('Series');
    expect(getSeriesLabelPlural(null)).toBe('Series');
  });
});
