/**
 * BetterAt — Public landing page for signed-out web visitors.
 * Signed-in users are redirected to their dashboard.
 * Native users are always redirected (to dashboard or login).
 */

import { DataBrowserLandingPage } from '@/components/landing/DataBrowserLandingPage';
import { ScrollFix } from '@/components/landing/ScrollFix';
import { SimpleLandingNav } from '@/components/landing/SimpleLandingNav';
import { DashboardSkeleton } from '@/components/ui/loading';
import { getLastTabRoute } from '@/lib/utils/userTypeRouting';
import { useAuth } from '@/providers/AuthProvider';
import { hasPersistedSessionHint, hasPersistedSessionHintAsync } from '@/services/supabase';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

export default function LandingPage() {
  const { signedIn, ready, userProfile, loading, isGuest, state } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(() => hasPersistedSessionHint());

  // Once we've confirmed the user is signed-out, never re-arm the
  // skeleton. Without this, the async `hasPersistedSessionHintAsync`
  // check (effect 2) and the "stale-hint clear" branch (effect 3)
  // ping-pong on stale persisted hints — the async resolves true,
  // re-arms the skeleton, the auth-resolved effect clears it, the
  // async re-fires (deps changed back), and the page flickers
  // forever. Visible on slower-settling Android Chrome.
  const skeletonLockedOff = useRef(false);
  const isNative = Platform.OS !== 'web';

  // Native: always redirect (to dashboard or login)
  useEffect(() => {
    if (!(isNative && ready && !loading && !isRedirecting)) return;

    setIsRedirecting(true);
    if (signedIn) {
      router.replace(getLastTabRoute(userProfile?.user_type ?? null));
    } else {
      router.replace('/(auth)/login');
    }
  }, [isNative, ready, loading, isRedirecting, signedIn, userProfile]);

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
      router.replace(getLastTabRoute(userProfile?.user_type ?? null));
    } else {
      // Session hint was stale (or never existed). Lock the skeleton
      // off so the async hint check can't re-arm it after this point.
      skeletonLockedOff.current = true;
      if (showSkeleton) setShowSkeleton(false);
    }
  }, [isNative, signedIn, ready, userProfile, loading, isRedirecting, showSkeleton]);

  // Native: skeleton while redirecting
  if (isNative) {
    return <DashboardSkeleton />;
  }

  // Web: skeleton while checking auth or redirecting
  if (!ready || showSkeleton || signedIn || isRedirecting) {
    return <DashboardSkeleton />;
  }

  // Web: public landing page for signed-out visitors
  return (
    <View style={styles.container}>
      <ScrollFix />
      <SimpleLandingNav />
      <DataBrowserLandingPage />
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
