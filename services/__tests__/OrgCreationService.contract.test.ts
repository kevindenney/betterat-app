const mockFrom = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { orgCreationService } = require('../OrgCreationService');

describe('OrgCreationService contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sanitizes punctuation before building the similar-org PostgREST OR filter', async () => {
    const limit = jest.fn().mockResolvedValue({ data: [], error: null });
    const order = jest.fn(() => ({ order, limit }));
    const eq = jest.fn(() => ({ order }));
    const or = jest.fn(() => ({ eq }));
    const select = jest.fn(() => ({ or }));

    mockFrom.mockReturnValue({ select });

    await orgCreationService.findSimilarOrgs('Johns Hopkins, School (Nursing)%_');

    expect(mockFrom).toHaveBeenCalledWith('organizations');
    expect(or).toHaveBeenCalledWith(
      'name.ilike.%Johns Hopkins School Nursing%,slug.ilike.%Johns Hopkins School Nursing%',
    );
  });
});
