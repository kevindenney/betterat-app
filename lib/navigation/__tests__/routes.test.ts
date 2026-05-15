/**
 * Tests and examples for type-safe navigation
 *
 * These tests verify that the navigation helpers provide proper type safety
 * and work as expected at runtime.
 */
/* eslint-disable no-restricted-properties -- This file asserts the router calls produced by navigateTo/buildHref. */

import { navigateTo, buildHref, isDynamicRoute } from '../routes';
import type { Router } from 'expo-router';

// Mock router for testing
const createMockRouter = () => {
  const calls: { method: 'push' | 'replace'; href: string }[] = [];

  const router = {
    push: jest.fn((href: string) => {
      calls.push({ method: 'push', href });
    }),
    replace: jest.fn((href: string) => {
      calls.push({ method: 'replace', href });
    }),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
    calls,
  } as unknown as Router;

  return router;
};

describe('navigateTo', () => {
  it('navigates to static routes', () => {
    const router = createMockRouter();

    navigateTo(router, '/(auth)/login');
    expect(router.push).toHaveBeenCalledWith('/(auth)/login');

    navigateTo(router, '/(tabs)/races');
    expect(router.push).toHaveBeenCalledWith('/(tabs)/races');

    navigateTo(router, '/(tabs)/practice');
    expect(router.push).toHaveBeenCalledWith('/(tabs)/practice');
  });

  it('navigates to dynamic routes with params', () => {
    const router = createMockRouter();

    navigateTo(router, '/boat/[id]', { id: '123' });
    expect(router.push).toHaveBeenCalledWith('/boat/123');

    navigateTo(router, '/race/timer/[id]', { id: 'race-456' });
    expect(router.push).toHaveBeenCalledWith('/race/timer/race-456');
  });

  it('supports replace option for static routes', () => {
    const router = createMockRouter();

    navigateTo(router, '/(tabs)/dashboard', { replace: true });
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/dashboard');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('supports replace option for dynamic routes', () => {
    const router = createMockRouter();

    navigateTo(router, '/boat/[id]', { id: '789' }, { replace: true });
    expect(router.replace).toHaveBeenCalledWith('/boat/789');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('handles routes with multiple segments', () => {
    const router = createMockRouter();

    navigateTo(router, '/club/results/[raceId]', { raceId: 'abc-123' });
    expect(router.push).toHaveBeenCalledWith('/club/results/abc-123');
  });
});

describe('buildHref', () => {
  it('builds static route hrefs', () => {
    const href = buildHref('/(auth)/login');
    expect(href).toBe('/(auth)/login');
  });

  it('builds dynamic route hrefs with params', () => {
    const href = buildHref('/boat/[id]', { id: '123' });
    expect(href).toBe('/boat/123');
  });

  it('handles complex dynamic routes', () => {
    const href = buildHref('/club/event/[id]/entries', { id: 'event-456' });
    expect(href).toBe('/club/event/event-456/entries');
  });
});

describe('isDynamicRoute', () => {
  it('identifies dynamic routes', () => {
    expect(isDynamicRoute('/boat/[id]')).toBe(true);
    expect(isDynamicRoute('/race/timer/[id]')).toBe(true);
    expect(isDynamicRoute('/club/event/[id]/entries')).toBe(true);
  });

  it('identifies static routes', () => {
    expect(isDynamicRoute('/(auth)/login')).toBe(false);
    expect(isDynamicRoute('/(tabs)/practice')).toBe(false);
    expect(isDynamicRoute('/(tabs)/races')).toBe(false);
    expect(isDynamicRoute('/settings')).toBe(false);
  });
});

describe('Type Safety Examples', () => {
  // These are compile-time tests - if they compile, the types are correct

  it('enforces correct params for dynamic routes', () => {
    const router = createMockRouter();

    // ✅ This should compile
    navigateTo(router, '/boat/[id]', { id: '123' });

    // ❌ These should NOT compile (uncomment to test):
    // navigateTo(router, '/boat/[id]'); // Missing params
    // navigateTo(router, '/boat/[id]', { wrongParam: '123' }); // Wrong param name
    // navigateTo(router, '/boat/[id]', { id: 123 }); // Wrong param type
  });

  it('prevents params on static routes', () => {
    const router = createMockRouter();

    // ✅ This should compile
    navigateTo(router, '/(tabs)/practice');
    navigateTo(router, '/(tabs)/races');
    navigateTo(router, '/(tabs)/races', { replace: true });

    // ❌ These should NOT compile (uncomment to test):
    // navigateTo(router, '/(tabs)/races', { id: '123' }); // Static routes don't take params
  });

  it('provides autocomplete for routes', () => {
    const router = createMockRouter();

    // Your IDE should autocomplete these:
    navigateTo(router, '/(auth)/login');
    navigateTo(router, '/(tabs)/dashboard');
    navigateTo(router, '/boat/[id]', { id: '123' });
    navigateTo(router, '/race/timer/[id]', { id: '456' });

    // ❌ This should error (uncomment to test):
    // navigateTo(router, '/invalid/route'); // Route doesn't exist
  });
});

/**
 * Example usage patterns for documentation
 */
describe('Usage Examples', () => {
  it('example: navigation after authentication', () => {
    const router = createMockRouter();

    // After successful login, replace current route
    navigateTo(router, '/(tabs)/dashboard', { replace: true });

    expect(router.replace).toHaveBeenCalledWith('/(tabs)/dashboard');
  });

  it('example: navigation with dynamic data', () => {
    const router = createMockRouter();
    const boatId = '123';
    const raceId = '456';

    // Navigate to boat detail
    navigateTo(router, '/boat/[id]', { id: boatId });

    // Start race timer
    navigateTo(router, '/race/timer/[id]', { id: raceId });

    expect(router.push).toHaveBeenCalledWith('/boat/123');
    expect(router.push).toHaveBeenCalledWith('/race/timer/456');
  });

  it('example: conditional navigation', () => {
    const router = createMockRouter();
    const userType = 'coach';

    if (userType === 'coach') {
      navigateTo(router, '/(tabs)/dashboard');
    } else {
      navigateTo(router, '/(tabs)/races');
    }

    expect(router.push).toHaveBeenCalledWith('/(tabs)/dashboard');
  });
});
