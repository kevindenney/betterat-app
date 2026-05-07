import { ErrorBoundary } from '@/components/ui/error';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { NetworkStatusBanner } from '@/components/ui/network';
import { PushNotificationHandler } from '@/components/notifications/PushNotificationHandler';
import '@/global.css';
import { initializeImageCache } from '@/lib/imageConfig';
import { initSentry } from '@/lib/sentry';

// Initialize Sentry as early as possible
initSentry();
import {
  extractSessionTokensFromUrl,
  extractNextRedirectFromUrl,
  setSessionFromBridgeTokens,
  exchangeBridgeTokenForSession,
  cleanAuthTokensFromUrl,
  notifyAuthSuccess,
  notifyAuthFailure,
} from '@/lib/auth/firebaseBridge';
import { supabase } from '@/services/supabase';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { InterestProvider, useInterest } from '@/providers/InterestProvider';
import { OrganizationProvider } from '@/providers/OrganizationProvider';
import { InterestSelection } from '@/components/onboarding/InterestSelection';
import { ContextualHintProvider } from '@/providers/ContextualHintProvider';
import StripeProvider from '@/providers/StripeProvider';
import { initializeCrewMutationHandlers } from '@/services/crewManagementService';
import { initializeRaceRegistrationMutationHandlers } from '@/services/RaceRegistrationService';
import { initializeBoatMutationHandlers } from '@/services/SailorBoatService';
import { initializeMutationQueueHandlers } from '@/services/userManualClubsService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/AppToast';
import { WebAlertProvider } from '@/components/ui/WebAlertDialog';
import { Stack, router, useSegments } from 'expo-router';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Suppress known warnings for native modules not available in Expo Go
// These errors occur because expo-notifications and expo-device require a development build
LogBox.ignoreLogs([
  'Cannot find native module',
  'ExpoPushTokenManager',
  'ExpoDevice',
  'Notifications.addNotificationReceivedListener is not a function',
  'Push notifications',
  'RNMapsAirModule',
  'LocationPreviewMap',
  'PhaseContentErrorBoundary',
]);

// Suppress red box errors for native modules not available in Expo Go (native platforms only)
if (Platform.OS !== 'web' && __DEV__) {
  // ErrorUtils is a React Native global for error handling
  const RNErrorUtils = (global as any).ErrorUtils;
  if (RNErrorUtils) {
    const originalErrorHandler = RNErrorUtils.getGlobalHandler();
    RNErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
      // Suppress push notification native module errors in Expo Go
      if (
        error?.message?.includes('Cannot find native module') ||
        error?.message?.includes('ExpoPushTokenManager') ||
        error?.message?.includes('ExpoDevice') ||
        error?.message?.includes('is not a function (it is undefined)') ||
        error?.message?.includes('RNMapsAirModule') ||
        error?.message?.includes('LocationPreviewMap') ||
        error?.message?.includes('PhaseContentErrorBoundary')
      ) {
        // Log to console instead of showing red box
        console.log('[Suppressed] Push notification error (expected in Expo Go):', error.message);
        return;
      }
      // Pass other errors to the original handler
      originalErrorHandler(error, isFatal);
    });
  }
}

// Initialize i18n (must be imported before any components that use translations)
import '@/lib/i18n';

let FontFaceObserverModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FontFaceObserverModule = require('fontfaceobserver');
} catch (error) {
  FontFaceObserverModule = null;
}

// Configure React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Never retry 4xx client errors — they won't succeed on retry
        const status = (error as any)?.status ?? (error as any)?.code;
        if (typeof status === 'number' && status >= 400 && status < 500) return false;
        // For PostgREST errors with message containing status codes
        const msg = (error as any)?.message ?? '';
        if (/\b4\d{2}\b/.test(msg)) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
})

// Suppress React Native Web deprecation warnings and font loading errors
if (typeof window !== 'undefined' && Platform.OS === 'web') {
  if (FontFaceObserverModule?.prototype?.load) {
    const originalLoad = FontFaceObserverModule.prototype.load;
    FontFaceObserverModule.prototype.load = function patchedLoad(...args: any[]) {
      return originalLoad.apply(this, args).catch((error: Error) => {
        if (error?.message?.includes('timeout exceeded') ||
            error?.message?.includes('fontfaceobserver')) {
          return this;
        }
        throw error;
      });
    };
  }

  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('props.pointerEvents is deprecated') ||
       args[0].includes('"shadow*" style props are deprecated') ||
       args[0].includes('"textShadow*" style props are deprecated') ||
       args[0].includes('expo-av') ||
       args[0].includes('Expo AV has been deprecated') ||
       args[0].includes('Download the React DevTools') ||
       args[0].includes('useNativeDriver') ||
       args[0].includes('[Intervention] Slow network is detected') ||
       args[0].includes('[Layout children]: No route named'))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    // Suppress font loading timeout errors (non-critical)
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('timeout exceeded') ||
       args[0].includes('6000ms') ||
       args[0].includes('60000ms') ||
       args[0].includes('fontfaceobserver') ||
       args[0].includes('"shadow*" style props are deprecated') ||
       args[0].includes('"textShadow*" style props are deprecated') ||
       args[0].includes('A text node cannot be a child of a <View>') ||
       // React passes the property name as a separate %s arg, not inlined in args[0].
       // Match the template + check the substituted prop name in args[1].
       (args[0].includes('Invalid DOM property') && args[1] === 'transform-origin'))
    ) {
      return;
    }
    // Also check if it's an Error object
    if (args[0] instanceof Error &&
        (args[0].message?.includes('timeout exceeded') ||
         args[0].message?.includes('6000ms') ||
         args[0].message?.includes('60000ms') ||
         args[0].message?.includes('fontfaceobserver') ||
         args[0].message?.includes('shadow*') ||
         args[0].message?.includes('textShadow*') ||
         args[0].message?.includes('text node cannot be a child') ||
         args[0].message?.includes('transform-origin'))) {
      return;
    }
    originalError.apply(console, args);
  };

  // Catch unhandled promise rejections for font loading
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('timeout exceeded') ||
        event.reason?.message?.includes('6000ms') ||
        event.reason?.message?.includes('60000ms') ||
        event.reason?.message?.includes('fontfaceobserver')) {
      event.preventDefault();
      return;
    }
  });

  // Catch uncaught errors (including font loading and shadow deprecation)
  window.addEventListener('error', (event) => {
    if (event.message?.includes('timeout exceeded') ||
        event.message?.includes('6000ms') ||
        event.message?.includes('60000ms') ||
        event.message?.includes('fontfaceobserver') ||
        event.message?.includes('Unexpected text node') ||
        event.message?.includes('shadow*') ||
        event.message?.includes('textShadow*')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  });

  // Override ErrorUtils for React Native Web (suppress font loading and shadow deprecation errors in development)
  if (typeof window !== 'undefined' && (window as any).ErrorUtils) {
    const originalReportError = (window as any).ErrorUtils.reportError;
    (window as any).ErrorUtils.reportError = function(error: Error) {
      if (error.message?.includes('timeout exceeded') ||
          error.message?.includes('6000ms') ||
          error.message?.includes('60000ms') ||
          error.message?.includes('fontfaceobserver') ||
          error.message?.includes('Unexpected text node') ||
          error.message?.includes('shadow*') ||
          error.message?.includes('textShadow*')) {
        // Silently ignore font loading timeouts and shadow deprecation warnings
        return;
      }
      return originalReportError(error);
    };
  }
}

/**
 * FirebaseBridgeHandler - Handles Firebase auth bridge tokens for WebView embedding
 *
 * When Dragon Worlds app embeds RegattaFlow in a WebView, it passes auth tokens
 * in the URL. This component:
 * 1. Detects session tokens (new) or bridge token (legacy) in the URL
 * 2. Establishes a Supabase session with the tokens
 * 3. Cleans the URL and notifies the parent app
 */
function FirebaseBridgeHandler() {
  const bridgeProcessedRef = useRef(false);

  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    // Prevent duplicate processing
    if (bridgeProcessedRef.current) {
      return;
    }

    const handleBridgeToken = async () => {
      const currentUrl = window.location.href;
      const tokens = extractSessionTokensFromUrl(currentUrl);

      if (!tokens) {
        return; // No tokens present
      }

      // Capture optional `next` redirect target before we strip query params.
      // This lets HKDW (or any caller) hand off to a specific in-app path
      // (e.g. /blueprint/dragon-worlds-2027-peak-performance?auto_subscribe=1)
      // instead of the default Discuss landing.
      const nextRedirect = extractNextRedirectFromUrl(currentUrl);

      bridgeProcessedRef.current = true;
      console.log('[FirebaseBridge] Processing auth tokens from URL, type:', tokens.type);

      // Always strip bridge tokens from the URL — whether the exchange
      // succeeds or fails. Leaving stale `rf_access_token=` in the address
      // bar (a) leaks them in browser history and (b) traps any downstream
      // page logic that gates on "wait for bridge to finish" (e.g. the
      // blueprint auto-subscribe effect) because it never sees the URL
      // get cleaned on the failure path. Cleaning here lets the page
      // fall through to its normal signed-out flow.
      const stripBridgeTokensFromUrl = () => {
        try {
          const cleanUrl = cleanAuthTokensFromUrl(window.location.href);
          if (cleanUrl !== window.location.href) {
            window.history.replaceState(null, '', cleanUrl);
          }
        } catch (e) {
          console.warn('[FirebaseBridge] Failed to clean URL:', e);
        }
      };

      try {
        let success = false;

        if (tokens.type === 'session' && tokens.accessToken && tokens.refreshToken) {
          // New format: Real Supabase session tokens
          console.log('[FirebaseBridge] Using real session tokens');
          success = await setSessionFromBridgeTokens(tokens.accessToken, tokens.refreshToken);
        } else if (tokens.bridgeToken) {
          // Legacy format: Bridge token that needs to be exchanged
          console.log('[FirebaseBridge] Using legacy bridge token');
          success = await exchangeBridgeTokenForSession(tokens.bridgeToken);
        }

        if (success) {
          console.log('[FirebaseBridge] Session established successfully');
          stripBridgeTokensFromUrl();

          // Verify the session is actually working by checking getUser()
          const maxAttempts = 10;
          let attempts = 0;
          const verifySession = async (): Promise<boolean> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              console.log('[FirebaseBridge] Session verified, user:', user.id);
              return true;
            }
            return false;
          };

          // Poll until session is verified or max attempts reached
          const waitForSession = async () => {
            while (attempts < maxAttempts) {
              attempts++;
              const verified = await verifySession();
              if (verified) {
                // Notify parent app (Dragon Worlds WebView) of success
                notifyAuthSuccess('session-established');

                // Decide where to land:
                //   1. Explicit `?next=...` from caller → honor it (sanitized,
                //      same-origin, path-only — see extractNextRedirectFromUrl).
                //   2. Otherwise stay on the current path. The URL has already
                //      been cleaned of tokens above, so deep links like
                //      /blueprint/...?rf_access_token=... and
                //      /community/<slug>?rf_access_token=... just render where
                //      the user landed once the session is live.
                if (nextRedirect) {
                  console.log('[FirebaseBridge] Navigating to next redirect:', nextRedirect);
                  router.replace(nextRedirect as any);
                } else {
                  console.log('[FirebaseBridge] No redirect; staying on current path');
                }
                return;
              }
              // Wait 200ms before next attempt
              await new Promise((resolve) => setTimeout(resolve, 200));
            }

            // Session verification failed after max attempts
            console.error('[FirebaseBridge] Session verification failed after', maxAttempts, 'attempts');
            notifyAuthFailure('Session verification timeout');
          };

          waitForSession();
        } else {
          console.error('[FirebaseBridge] Failed to establish session');
          stripBridgeTokensFromUrl();
          notifyAuthFailure('Session exchange failed');
        }
      } catch (error) {
        console.error('[FirebaseBridge] Error processing auth tokens:', error);
        stripBridgeTokensFromUrl();
        notifyAuthFailure(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    handleBridgeToken();
  }, []);

  return null; // This component doesn't render anything
}

/**
 * Recovery net for signed-in users whose preferred interest is missing.
 *
 * This used to fire for guests too, but first-time guests now go through the
 * `/welcome` flow (see `app/index.tsx`), and returning guests already have an
 * interest cached in AsyncStorage. So the modal is reserved for the edge case
 * where a signed-in account ends up with no interest (data loss / new account
 * with incomplete onboarding).
 */
function InterestSelectionGate() {
  const { user } = useAuth();
  const { currentInterest, loading: interestLoading, userInterests } = useInterest();
  const [dismissed, setDismissed] = useState(false);
  const segments = useSegments();

  // Suppress during onboarding, auth, welcome, and public content flows
  const firstSegment = segments[0] ?? '';
  const suppressRoutes = ['onboarding', '(auth)', 'welcome', 'blueprint', 'org', 'person'];
  const isSuppressedRoute = suppressRoutes.includes(firstSegment);

  // Also suppress while user interests are still loading / being resolved
  // (avoids flash of the picker before interests populate)
  const interestsStillResolving = !!user && userInterests.length === 0 && interestLoading;

  const shouldShow =
    !!user &&
    !interestLoading &&
    !currentInterest &&
    !dismissed &&
    !isSuppressedRoute &&
    !interestsStillResolving;

  return (
    <InterestSelection
      visible={shouldShow}
      onComplete={() => setDismissed(true)}
    />
  );
}

/**
 * Global auth guard — unauthenticated users on non-public routes get sent to `/`.
 * Public routes: index (logo page), (auth) screens, callback, privacy, welcome.
 */
function AuthGate() {
  const { signedIn, ready, loading, isGuest, state } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!ready || loading) return;

    // Hold off if the FirebaseBridgeHandler is about to sign the user in from
    // URL tokens. Otherwise we race with the bridge: AuthGate redirects to /
    // first because signedIn is still false, then the bridge finishes auth and
    // the user lands on the wrong page (tab default instead of the deep link).
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      (window.location.search.includes('rf_access_token=') ||
        window.location.search.includes('rf_bridge_token='))
    ) {
      return;
    }

    const firstSegment = segments[0] ?? '';
    // `blueprint` is a public marketing page that handles its own
    // signed-out → /(auth)/login?returnTo=... redirect (with auto_subscribe
    // round-trip support). Letting AuthGate redirect to `/` would clobber
    // the auto_subscribe deep-link from HKDW.
    //
    // `community` deep-links from HKDW Discuss (`/community/<slug>?post=<id>`)
    // also need to round-trip through login so the post detail opens after
    // sign-in. The community screen redirects signed-out visitors to
    // `/(auth)/login?returnTo=...` itself.
    const publicSegments = ['index', '(auth)', 'privacy', 'welcome', 'callback', 'blueprint', 'community'];
    const isPublicRoute = !firstSegment || publicSegments.includes(firstSegment);

    if (isPublicRoute) return;

    // Not signed in and on a protected route → send to index (logo page)
    if (!signedIn || isGuest || state === 'guest') {
      router.replace('/');
    }
  }, [ready, loading, signedIn, isGuest, state, segments]);

  return null;
}

function StackWithSplash() {
  const {state} = useAuth()

  return (
    <>
      <FirebaseBridgeHandler />
      <NetworkStatusBanner />
      <AuthGate />
      <InterestSelectionGate />
      <Stack screenOptions={{headerShown: false}}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="account" options={{ presentation: 'transparentModal', headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="venue/post/create" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="org-welcome-modal" options={{ presentation: 'transparentModal', headerShown: false, animation: 'fade' }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  // Load Manrope font family from Google Fonts
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  // Initialize image cache and inject global CSS for web
  useEffect(() => {
    // Initialize expo-image cache for optimal performance
    initializeImageCache();

    // Initialize mutation queue for offline sync
    initializeMutationQueueHandlers();
    initializeCrewMutationHandlers();
    initializeBoatMutationHandlers();
    initializeRaceRegistrationMutationHandlers();

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: auto;
          font-size: 110%;
          zoom: 1.0;
        }
        #root {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .venueSplit {
          display: grid;
          grid-template-columns: 1fr 440px;
          height: 100vh;
        }
        #venue-map {
          min-height: 300px;
        }
      `;
      document.head.appendChild(style);

      // Set custom BetterAt favicon (b with underline in circle)
      const betterAtSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%25" stop-color="%23007AFF"/><stop offset="100%25" stop-color="%235856D6"/></linearGradient></defs><rect width="32" height="32" rx="7" fill="url(%23bg)"/><text x="16" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="white">b</text><rect x="9" y="23.5" width="14" height="2" rx="1" fill="white"/></svg>`;
      const existingFavicon = document.querySelector('link[rel="icon"]');
      if (existingFavicon) {
        existingFavicon.remove();
      }
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/svg+xml';
      favicon.href = `data:image/svg+xml,${betterAtSvg}`;
      document.head.appendChild(favicon);

      // Register Service Worker for offline bathymetry tile caching (prod only)
      if ('serviceWorker' in navigator) {
        if (process.env.NODE_ENV === 'production') {
          // Use base path for service worker (supports /regattaflow base path)
          const basePath = window.location.pathname.startsWith('/regattaflow') ? '/regattaflow' : '';
          navigator.serviceWorker
            .register(`${basePath}/bathymetry-sw.js`)
            .catch((error) => {
              console.warn('[BathymetrySW] Failed to register service worker', error);
            });
        } else {
          // Ensure dev sessions don't keep an old bathymetry SW around
          navigator.serviceWorker
            .getRegistrations()
            .then((registrations) => {
              registrations
                .filter((reg) => reg?.scope?.includes('bathymetry'))
                .forEach((reg) => reg.unregister());
            })
            .catch(() => {
              // No-op
            });
        }
      }

      // On web, Expo Router keeps inactive routes mounted with aria-hidden="true". If focus
      // remains inside those hidden trees, Chrome emits "Blocked aria-hidden" warnings. Blur the
      // focused element and move focus to a safe fallback whenever focus enters an aria-hidden
      // ancestor.
      const handleFocusIn = (event: FocusEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const hiddenAncestor = target.closest('[aria-hidden="true"]');
        if (!hiddenAncestor) return;

        requestAnimationFrame(() => {
          target.blur();
          if (!document.body.hasAttribute('tabindex')) {
            document.body.setAttribute('tabindex', '-1');
          }
          document.body.focus();
        });
      };

      // Also check for elements that are already focused when they become aria-hidden
      const handleAriaHiddenChange = () => {
        const activeElement = document.activeElement as HTMLElement | null;
        if (!activeElement) return;
        
        const hiddenAncestor = activeElement.closest('[aria-hidden="true"]');
        if (hiddenAncestor) {
          requestAnimationFrame(() => {
            activeElement.blur();
            if (!document.body.hasAttribute('tabindex')) {
              document.body.setAttribute('tabindex', '-1');
            }
            document.body.focus();
          });
        }
      };

      // Use MutationObserver to watch for aria-hidden changes
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
            handleAriaHiddenChange();
          }
        }
      });

      // Observe the entire document for aria-hidden attribute changes
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['aria-hidden'],
        subtree: true,
      });

      document.addEventListener('focusin', handleFocusIn, true);

      return () => {
        document.head.removeChild(style);
        document.removeEventListener('focusin', handleFocusIn, true);
        observer.disconnect();
        const addedFavicon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
        if (addedFavicon) {
          addedFavicon.remove();
        }
      };
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GluestackUIProvider mode="light">
            <StripeProvider>
              <AuthProvider>
                <OrganizationProvider>
                  <InterestProvider>
                  <ContextualHintProvider>
                  <ToastProvider>
                    <WebAlertProvider>
                    <PushNotificationHandler>
                      <StackWithSplash />
                    </PushNotificationHandler>
                    </WebAlertProvider>
                  </ToastProvider>
                  </ContextualHintProvider>
                </InterestProvider>
                </OrganizationProvider>
              </AuthProvider>
            </StripeProvider>
          </GluestackUIProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
