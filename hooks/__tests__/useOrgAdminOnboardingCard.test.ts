import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useOrgAdminOnboardingCard } from '../useOrgAdminOnboardingCard';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => storage.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        storage.delete(key);
      }),
    },
    __mockStorage: storage,
  };
});

const asyncStorageMock = jest.requireMock(
  '@react-native-async-storage/async-storage',
) as { __mockStorage: Map<string, string> };

const mockStorage = asyncStorageMock.__mockStorage;

describe('useOrgAdminOnboardingCard', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('returns shouldShow=false and ready=true immediately when no organizationId', () => {
    const { result } = renderHook(() => useOrgAdminOnboardingCard(null));
    expect(result.current.shouldShow).toBe(false);
    expect(result.current.ready).toBe(true);
  });

  it('starts not-ready then resolves to shouldShow=true on a fresh org', async () => {
    const { result } = renderHook(() => useOrgAdminOnboardingCard('org-1'));
    expect(result.current.ready).toBe(false);
    expect(result.current.shouldShow).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.shouldShow).toBe(true);
  });

  it('returns shouldShow=false when storage already has dismissal for the org', async () => {
    mockStorage.set('betterat.orgAdminOnboarding.dismissed:org-2', '1');
    const { result } = renderHook(() => useOrgAdminOnboardingCard('org-2'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.shouldShow).toBe(false);
  });

  it('dismiss() persists per-org and hides the card on next render', async () => {
    const { result } = renderHook(() => useOrgAdminOnboardingCard('org-3'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.shouldShow).toBe(true);

    await act(async () => {
      await result.current.dismiss();
    });

    expect(result.current.shouldShow).toBe(false);
    expect(mockStorage.get('betterat.orgAdminOnboarding.dismissed:org-3')).toBe('1');
  });

  it('dismissal is per-organization, not global', async () => {
    mockStorage.set('betterat.orgAdminOnboarding.dismissed:org-A', '1');

    const dismissed = renderHook(() => useOrgAdminOnboardingCard('org-A'));
    await waitFor(() => expect(dismissed.result.current.ready).toBe(true));
    expect(dismissed.result.current.shouldShow).toBe(false);

    const fresh = renderHook(() => useOrgAdminOnboardingCard('org-B'));
    await waitFor(() => expect(fresh.result.current.ready).toBe(true));
    expect(fresh.result.current.shouldShow).toBe(true);
  });

  it('dismiss() is a no-op when no organizationId is provided', async () => {
    const { result } = renderHook(() => useOrgAdminOnboardingCard(null));
    await act(async () => {
      await result.current.dismiss();
    });
    expect(mockStorage.size).toBe(0);
  });
});
