/**
 * BetterAt — Logo-only public page.
 * Signed-in users are redirected to their dashboard.
 * Everyone else sees just the logo.
 * Login is available at /(auth)/login for those who know the URL.
 */

import { BetterAtLogo } from '@/components/BetterAtLogo';
import { DashboardSkeleton } from '@/components/ui/loading';
import { getLastTabRoute } from '@/lib/utils/userTypeRouting';
import { useAuth } from '@/providers/AuthProvider';
import { hasPersistedSessionHint, hasPersistedSessionHintAsync } from '@/services/supabase';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

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

  // Public page: just the logo
  return (
    <View style={styles.container}>
      <View style={styles.centered}>
        <BetterAtLogo size={72} />
        <Text style={styles.wordmark}>BetterAt</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh' as any,
  },
  centered: {
    alignItems: 'center',
    gap: 16,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
});
