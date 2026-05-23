/**
 * Direct sign-out route. Useful when the profile dropdown is broken or in
 * flux — deep-link to `betterat:///sign-out` (or web `/sign-out`) to force
 * a sign-out and bounce back to the auth welcome screen.
 *
 * No UI worth designing here: we just trigger signOut on mount and let the
 * AuthGate redirect.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

export default function SignOutRoute() {
  const { signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await signOut();
        if (cancelled) return;
        // Bounce to the auth welcome shell so the user can sign back in.
        router.replace('/(auth)/login' as any);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? 'Sign out failed.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.body}>
        {error ? (
          <>
            <Text style={styles.title}>Sign out failed</Text>
            <Text style={styles.message}>{error}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={IOS_REGISTER.label} />
            <Text style={styles.message}>Signing out…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IOS_REGISTER.groundBg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  title: { fontSize: 20, fontWeight: '600', color: IOS_REGISTER.label },
  message: { fontSize: 15, color: IOS_REGISTER.labelSecondary, textAlign: 'center' },
});
