import {
  buildSuggestions,
  crossInterestToMentorInput,
} from '@/services/SuggestionsService';

describe('SuggestionsService', () => {
  it('returns empty when no sources are passed', () => {
    expect(buildSuggestions({})).toEqual([]);
  });

  it('caps the merged list at 3 by default', () => {
    const noop = () => undefined;
    const items = buildSuggestions({
      blueprints: [
        { id: 'b1', title: 'B1', byline: 'B', onPress: noop },
        { id: 'b2', title: 'B2', byline: 'B', onPress: noop },
      ],
      follows: [
        { id: 'f1', title: 'F1', byline: 'F', onPress: noop },
        { id: 'f2', title: 'F2', byline: 'F', onPress: noop },
      ],
      mentor: [
        { id: 'm1', title: 'M1', onPress: noop },
        { id: 'm2', title: 'M2', onPress: noop },
      ],
    });
    expect(items).toHaveLength(3);
  });

  it('interleaves sources round-robin so no single source crowds the result', () => {
    const noop = () => undefined;
    const items = buildSuggestions({
      blueprints: [
        { id: 'b1', title: 'B1', byline: 'B', onPress: noop },
        { id: 'b2', title: 'B2', byline: 'B', onPress: noop },
        { id: 'b3', title: 'B3', byline: 'B', onPress: noop },
      ],
      follows: [{ id: 'f1', title: 'F1', byline: 'F', onPress: noop }],
      mentor: [{ id: 'm1', title: 'M1', onPress: noop }],
    });
    expect(items.map((i) => i.kind)).toEqual(['blueprint', 'follow', 'mentor']);
  });

  it('sorts each source by recency before interleaving', () => {
    const noop = () => undefined;
    const items = buildSuggestions({
      blueprints: [
        { id: 'old', title: 'Old', byline: 'B', recency: 1, onPress: noop },
        { id: 'new', title: 'New', byline: 'B', recency: 5, onPress: noop },
      ],
      limit: 1,
    });
    expect(items[0].title).toBe('New');
  });

  it('crossInterestToMentorInput maps cross-interest suggestions to mentor input', () => {
    const noop = () => undefined;
    const mapped = crossInterestToMentorInput(
      [
        {
          suggestion: 'Try the upwind drill from sailing',
          sourceInterestName: 'Sail Racing',
        },
      ],
      noop,
    );
    expect(mapped).toHaveLength(1);
    expect(mapped[0].title).toBe('Try the upwind drill from sailing');
    expect(mapped[0].byline).toBe('From Sail Racing');
  });

  it('truncates long mentor titles to keep the row a single line', () => {
    const noop = () => undefined;
    const long = 'x'.repeat(120);
    const mapped = crossInterestToMentorInput(
      [{ suggestion: long, sourceInterestName: 'X' }],
      noop,
    );
    expect(mapped[0].title.endsWith('…')).toBe(true);
    expect(mapped[0].title.length).toBeLessThan(long.length);
  });
});
