import {
  getOnboardingStartRoute,
  getOrganizationOnboardingRoute,
  guardOnboardingRouteForDomain,
} from '../onboardingRouting';

jest.mock('../userTypeRouting', () => ({
  getDashboardRoute: () => '/(tabs)/dashboard',
}));

describe('onboarding routing domain guard', () => {
  it('keeps sailing sailor onboarding start route unchanged', () => {
    expect(getOnboardingStartRoute('sailor', 'sailing')).toBe('/onboarding/profile/name-photo');
  });

  it('pins nursing sailor onboarding start route to non-sailing context', () => {
    expect(getOnboardingStartRoute('sailor', 'nursing')).toBe('/onboarding/profile/name-photo?domain=nursing');
  });

  it('normalizes institution hint to nursing for sailor onboarding', () => {
    expect(getOnboardingStartRoute('sailor', 'institution')).toBe('/onboarding/profile/name-photo?domain=nursing');
  });

  it('keeps sailing organization onboarding route unchanged', () => {
    expect(getOrganizationOnboardingRoute('sailing')).toBe('/(auth)/club-onboarding-enhanced');
  });

  it('routes nursing organization onboarding with explicit domain', () => {
    expect(getOrganizationOnboardingRoute('nursing')).toBe('/(auth)/club-onboarding-enhanced?domain=nursing');
  });

  it('blocks sailing-first onboarding routes for nursing domains', () => {
    expect(guardOnboardingRouteForDomain('/onboarding/find-races', 'nursing')).toBe(
      '/onboarding/profile/name-photo?domain=nursing'
    );
    expect(guardOnboardingRouteForDomain('/onboarding/boat-class', 'institution')).toBe(
      '/onboarding/profile/name-photo?domain=nursing'
    );
  });

  it('preserves sailing-first route for sailing domains', () => {
    expect(guardOnboardingRouteForDomain('/onboarding/find-races', 'sailing')).toBe('/onboarding/find-races');
  });
});
