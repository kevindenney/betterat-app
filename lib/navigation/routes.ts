/**
 * Type-safe navigation helpers for Expo Router
 *
 * This file provides compile-time type safety for navigation throughout the app.
 * Instead of using string literals with `router.push('/some/path')`, use the
 * navigateTo helper which ensures routes exist and parameters are correct.
 *
 * @example
 * // Before:
 * router.push('/boat/' + id); // No type safety
 * router.push('/(auth)/login' as any); // Unsafe cast
 *
 * // After:
 * navigateTo(router, '/boat/[id]', { id: '123' }); // Type-safe!
 * navigateTo(router, '/(auth)/login'); // Type-safe!
 */

import type { Router } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * All valid static routes in the app (no dynamic parameters)
 */
export type StaticRoute =
  | '/'
  | '/(auth)/login'
  | '/(auth)/signup'
  | '/(auth)/callback'
  | '/(auth)/coach-onboarding-pricing'
  | '/(auth)/coach-onboarding-profile-preview'
  | '/(auth)/sailor-onboarding-chat'
  | '/(tabs)/dashboard'
  | '/(tabs)/practice'
  | '/(tabs)/races'
  | '/(tabs)/schedule'
  | '/(tabs)/connect'
  | '/(tabs)/discuss'
  | '/(tabs)/settings'
  | '/(tabs)/more'
  | '/(tabs)/clubs'
  | '/(tabs)/clients'
  | '/(tabs)/coaching'
  | '/(tabs)/race-detail-demo'
  | '/(tabs)/boat/add'
  | '/(tabs)/coach/discover'
  | '/(tabs)/coach/bookings'
  | '/(tabs)/coach/availability'
  | '/settings'
  | '/settings/edit-profile'
  | '/settings/change-password'
  | '/settings/notifications'
  | '/settings/delete-account'
  | '/boats'
  | '/coaches'
  | '/calendar'
  | '/club-dashboard'
  | '/race-analysis'
  | '/location'
  | '/course-view'
  | '/results'
  | '/crew'
  | '/race-committee-dashboard'
  | '/entry-management'
  | '/club/event/create'
  | '/club/results/index'
  | '/club/earnings'
  | '/coach/discover'
  | '/coach/discover-enhanced'
  | '/coach/my-bookings'
  | '/debug/weather-test'
  | '/ai-strategy';

/**
 * All valid dynamic routes in the app (with parameters)
 */
export type DynamicRoute =
  | '/boat/[id]'
  | '/(tabs)/boat/[id]'
  | '/(tabs)/boat/edit/[id]'
  | '/(tabs)/race/[id]'
  | '/(tabs)/race/register/[id]'
  | '/race/timer/[id]'
  | '/race/simulation/[id]'
  | '/race/analysis/[id]'
  | '/race/edit/[id]'
  | '/race/validate/[id]'
  | '/club/race/control/[id]'
  | '/club/results/[raceId]'
  | '/club/event/[id]/index'
  | '/club/event/[id]/entries'
  | '/club/event/[id]/documents'
  | '/club/entries/[entryId]'
  | '/coach/client/[id]';

/**
 * All valid routes (static + dynamic)
 */
export type AppRoute = StaticRoute | DynamicRoute;

/**
 * Extract parameter names from a dynamic route
 * e.g., '/boat/[id]' => { id: string }
 */
type ExtractParams<T extends string> =
  T extends `${infer _Start}[${infer Param}]${infer Rest}`
    ? Record<Param | keyof ExtractParams<Rest>, string>
    : Record<never, never>;

/**
 * Parameters required for a given route
 */
export type RouteParams<T extends AppRoute> = T extends DynamicRoute
  ? ExtractParams<T>
  : never;

/**
 * Type-safe navigation helper
 *
 * @param router - Expo Router instance from useRouter()
 * @param route - The route to navigate to
 * @param params - Route parameters (required for dynamic routes)
 * @param options - Navigation options (e.g., replace instead of push)
 *
 * @example
 * const router = useRouter();
 *
 * // Static routes
 * navigateTo(router, '/(auth)/login');
 * navigateTo(router, '/(tabs)/practice');
 * navigateTo(router, '/(tabs)/races'); // legacy compatibility route
 *
 * // Dynamic routes
 * navigateTo(router, '/boat/[id]', { id: '123' });
 * navigateTo(router, '/race/timer/[id]', { id: raceId });
 *
 * // With options
 * navigateTo(router, '/(auth)/login', undefined, { replace: true });
 */
export function navigateTo<T extends AppRoute>(
  router: Router,
  route: T,
  ...args: T extends DynamicRoute
    ? [params: RouteParams<T>, options?: { replace?: boolean }]
    : [options?: { replace?: boolean }]
): void {
  const [paramsOrOptions, maybeOptions] = args as [any, any];

  let href: Href;
  let options: { replace?: boolean } | undefined;

  // Determine if this is a dynamic route
  if (route.includes('[')) {
    // Dynamic route - params are required
    const params = paramsOrOptions;
    options = maybeOptions;

    // Replace parameter placeholders with actual values
    let path = route as string;
    for (const [key, value] of Object.entries(params || {})) {
      path = path.replace(`[${key}]`, value as string);
    }
    href = path as Href;
  } else {
    // Static route - no params needed
    options = paramsOrOptions;
    href = route as Href;
  }

  // Navigate using push or replace
  if (options?.replace) {
    // eslint-disable-next-line no-restricted-properties -- navigateTo is the wrapper enforcing typed route safety.
    router.replace(href);
  } else {
    // eslint-disable-next-line no-restricted-properties -- navigateTo is the wrapper enforcing typed route safety.
    router.push(href);
  }
}

/**
 * Build a typed href for use in Link components
 *
 * @example
 * <Link href={buildHref('/boat/[id]', { id: '123' })}>View Boat</Link>
 */
export function buildHref<T extends AppRoute>(
  route: T,
  ...args: T extends DynamicRoute ? [params: RouteParams<T>] : []
): Href {
  const [params] = args;

  if (route.includes('[')) {
    let path = route as string;
    for (const [key, value] of Object.entries(params || {})) {
      path = path.replace(`[${key}]`, value as string);
    }
    return path as Href;
  }

  return route as Href;
}

/**
 * Check if a route requires parameters
 */
export function isDynamicRoute(route: string): route is DynamicRoute {
  return route.includes('[') && route.includes(']');
}
