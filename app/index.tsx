/**
 * BetterAt — Public landing page for signed-out web visitors.
 * Signed-in users are redirected to their dashboard.
 * Native users are always redirected (to dashboard or login).
 */

import { BreadthLandingPage } from '@/components/landing/BreadthLandingPage';
import { DashboardSkeleton } from '@/components/ui/loading';
import { getLastTabRoute } from '@/lib/utils/userTypeRouting';
import { useAuth } from '@/providers/AuthProvider';
import { ASYNC_STORAGE_KEY as PREFERRED_INTEREST_KEY } from '@/providers/InterestProvider';
import { hasPersistedSessionHint, hasPersistedSessionHintAsync } from '@/services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * If the just-signed-in user is a demo persona, route them to the
 * persona-specific landing baked into user_metadata by the
 * mint-demo-session edge function. Returns true when handled so the
 * caller can skip the regular lastTab routing.
 *
 * Demo personas sign in via magic link and the link sets
 * user_metadata.demo_persona_landing on the auth user; we honor that
 * over any stale lastTab from an earlier browser session.
 */
function demoPersonaRedirect(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  const isDemo = meta.demo_persona === true;
  const landing = meta.demo_persona_landing;
  if (!isDemo || typeof landing !== 'string' || !landing.startsWith('/')) return false;
  router.replace(landing as never);
  return true;
}

// Magic links (incl. demo persona sign-in) land on bare `/#access_token=...`
// when the redirect path isn't on the Supabase URL allowlist. The supabase
// client is configured with detectSessionInUrl:false (services/supabase.ts),
// so the hash will sit unprocessed on the marketing landing forever. Forward
// it to the manual hash-parser at /(auth)/callback.
function forwardImplicitTokenHash(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location) return false;
  const hash = window.location.hash || '';
  if (!hash.startsWith('#') || !hash.includes('access_token=')) return false;
  const callbackUrl = new URL('/callback', window.location.origin);
  callbackUrl.hash = hash.slice(1);
  window.location.replace(callbackUrl.toString());
  return true;
}

export default function LandingPage() {
  const { signedIn, ready, userProfile, loading, user } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(() => hasPersistedSessionHint());
  const [forwardingHash] = useState(() => forwardImplicitTokenHash());

  // Once we've confirmed the user is signed-out, never re-arm the
  // skeleton. Without this, the async `hasPersistedSessionHintAsync`
  // check (effect 2) and the "stale-hint clear" branch (effect 3)
  // ping-pong on stale persisted hints — the async resolves true,
  // re-arms the skeleton, the auth-resolved effect clears it, the
  // async re-fires (deps changed back), and the page flickers
  // forever. Visible on slower-settling Android Chrome.
  const skeletonLockedOff = useRef(false);
  const isNative = Platform.OS !== 'web';

  // Native: always redirect (to dashboard, app, or welcome)
  useEffect(() => {
    if (!(isNative && ready && !loading && !isRedirecting)) return;

    setIsRedirecting(true);
    if (signedIn) {
      if (demoPersonaRedirect(user?.user_metadata as Record<string, unknown> | null)) return;
      router.replace(getLastTabRoute(userProfile?.user_type ?? null));
      return;
    }

    // Signed-out cold-open. A fresh install (no cached interest) sees the
    // pre-signup value funnel (pick your craft → the loop in that craft's
    // vocabulary → create account) — the single first-run intro shared with
    // the web landing's "Get started". /welcome redirects here too.
    //
    // A returning user who has signed out still has an interest cached. We
    // must NOT drop them onto a protected tab: AuthGate gates `(tabs)` behind
    // auth and bounces any signed-out visitor back to `/`, which re-mounts
    // this screen and spins an infinite redirect loop (index → /(tabs)/races
    // → AuthGate → / → …). Send returning signed-out users to the login
    // screen instead — the same destination sign-out.tsx and AuthProvider use.
    AsyncStorage.getItem(PREFERRED_INTEREST_KEY)
      .then((cachedSlug) =>
        router.replace(cachedSlug ? '/(auth)/login' : '/onboarding/value/pick-craft'),
      )
      .catch(() => router.replace('/onboarding/value/pick-craft'));
  }, [isNative, ready, loading, isRedirecting, signedIn, userProfile, user]);

  // Web: check for persisted session hint (one-shot)
  useEffect(() => {
    if (isNative || showSkeleton || skeletonLockedOff.current) return;
    hasPersistedSessionHintAsync().then((hasSession) => {
      if (hasSession && !skeletonLockedOff.current) setShowSkeleton(true);
    });
  }, [isNative, showSkeleton]);

  // Web: redirect signed-in users to dashboard
  useEffect(() => {
    if (isNative || !ready || loading || isRedirecting) return;

    if (signedIn) {
      setIsRedirecting(true);
      if (demoPersonaRedirect(user?.user_metadata as Record<string, unknown> | null)) return;
      router.replace(getLastTabRoute(userProfile?.user_type ?? null));
    } else {
      // Session hint was stale (or never existed). Lock the skeleton
      // off so the async hint check can't re-arm it after this point.
      skeletonLockedOff.current = true;
      if (showSkeleton) setShowSkeleton(false);
    }
  }, [isNative, signedIn, ready, userProfile, loading, isRedirecting, showSkeleton, user]);

  // Native: skeleton while redirecting
  if (isNative) {
    return <DashboardSkeleton />;
  }

  // Web: skeleton while checking auth, forwarding a magic-link hash, or redirecting
  if (!ready || showSkeleton || signedIn || isRedirecting || forwardingHash) {
    return <DashboardSkeleton />;
  }

  // Web: public landing page for signed-out visitors
  return (
    <View style={styles.container}>
      <BreadthLandingPage />
    </View>
  );
}

const styles = StyleSheet.create<{ container: ViewStyle }>({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    minHeight: '100vh' as any,
    width: '100%',
  },
});
