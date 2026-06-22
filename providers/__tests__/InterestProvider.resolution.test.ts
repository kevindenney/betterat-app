import {
  hasExistingProfileSignal,
  selectDefaultInterestForExistingUser,
  selectExplicitInterestFromSignals,
} from '../InterestProvider.logic';

interface TestInterest {
  id: string;
  slug: string;
  name: string;
}

const makeInterest = (overrides: Partial<TestInterest>): TestInterest => ({
  id: overrides.id ?? 'interest-1',
  slug: overrides.slug ?? 'nursing',
  name: overrides.name ?? 'Nursing',
});

describe('InterestProvider active-interest resolution helpers', () => {
  const nursing = makeInterest({id: 'nursing-id', slug: 'nursing', name: 'Nursing'});
  const sailing = makeInterest({id: 'sailing-id', slug: 'sail-racing', name: 'Sail Racing'});
  const golf = makeInterest({id: 'golf-id', slug: 'golf', name: 'Golf'});

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('treats completed onboarding as an existing-profile signal', () => {
    expect(hasExistingProfileSignal({onboarding_completed: true})).toBe(true);
  });

  it('does not treat a fresh mostly empty profile as an existing-profile signal', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-22T12:00:00.000Z'));
    expect(
      hasExistingProfileSignal({
        created_at: '2026-06-22T11:59:00.000Z',
        full_name: 'Kevin',
      }),
    ).toBe(false);
  });

  it('uses normalized profile interest slugs before metadata slugs', () => {
    expect(
      selectExplicitInterestFromSignals({
        profile: {active_interest_slug: ' Nursing '},
        metadata: {active_interest_slug: 'golf'},
        interests: [golf, nursing],
      }),
    ).toBe(nursing);
  });

  it('falls back to metadata interest slug when profile has no match', () => {
    expect(
      selectExplicitInterestFromSignals({
        profile: {active_interest_slug: 'unknown-interest'},
        metadata: {interest_slug: 'golf'},
        interests: [nursing, golf],
      }),
    ).toBe(golf);
  });

  it('chooses the first added interest before catalog fallbacks', () => {
    expect(
      selectDefaultInterestForExistingUser({
        userInterests: [golf],
        interests: [nursing, sailing],
      }),
    ).toBe(golf);
  });

  it('falls back to sail racing, then first catalog interest, for existing users with no added interests', () => {
    expect(
      selectDefaultInterestForExistingUser({
        userInterests: [],
        interests: [nursing, sailing],
      }),
    ).toBe(sailing);

    expect(
      selectDefaultInterestForExistingUser({
        userInterests: [],
        interests: [nursing],
      }),
    ).toBe(nursing);
  });
});
