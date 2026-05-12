jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));
jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));
jest.mock('../fleetService', () => ({
  fleetService: {
    getFleetsForUser: jest.fn(),
    getFleetUpcomingRaces: jest.fn(),
  },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { raceSuggestionService } = require('../RaceSuggestionService');

describe('RaceSuggestionService.getSuggestionsForUser', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws a tagged service error when both cache and fresh generation fail', async () => {
    const service = raceSuggestionService as any;

    const cacheSpy = jest
      .spyOn(service, 'getCachedSuggestions')
      .mockRejectedValue(new Error('cache unavailable'));
    const freshSpy = jest
      .spyOn(service, 'generateFreshSuggestions')
      .mockRejectedValue(new Error('generation unavailable'));

    await expect(
      raceSuggestionService.getSuggestionsForUser('user-1'),
    ).rejects.toMatchObject({
      code: 'RACE_SUGGESTIONS_SERVICE_FAILURE',
    });

    // Cache failures are swallowed (a logged warning) so we expect retry-wrapped
    // calls only on the fresh path; cache is invoked but the suite tolerates retries.
    expect(cacheSpy).toHaveBeenCalled();
    expect(freshSpy).toHaveBeenCalled();
  });

  it('retries fresh generation once and returns recovered suggestions', async () => {
    const service = raceSuggestionService as any;

    jest.spyOn(service, 'getCachedSuggestions').mockResolvedValue({
      clubRaces: [],
      fleetRaces: [],
      communityRaces: [],
      catalogMatches: [],
      previousYearRaces: [],
      patterns: [],
      templates: [],
      total: 0,
    });

    const freshSpy = jest
      .spyOn(service, 'generateFreshSuggestions')
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce({
        clubRaces: [
          {
            id: 'club-1',
            type: 'club_event',
            confidenceScore: 0.9,
            raceData: { raceName: 'Harbor Regatta' },
            reason: 'Upcoming event at your club',
            canAddDirectly: true,
          },
        ],
        fleetRaces: [],
        communityRaces: [],
        catalogMatches: [],
        previousYearRaces: [],
        patterns: [],
        templates: [],
        total: 1,
      });

    const result = await raceSuggestionService.getSuggestionsForUser('user-2');

    expect(freshSpy).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(1);
    expect(result.clubRaces[0]?.raceData?.raceName).toBe('Harbor Regatta');
  });
});
