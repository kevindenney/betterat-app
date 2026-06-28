/**
 * Invite-link landing — redeems an affinity-group invite token and drops the
 * viewer into the group. This is the ONLY join path for an invite-only peer
 * group: the link itself is the access grant (no open-join queue to police).
 *
 * Unauthenticated visitors bounce to login with returnTo set back here, so the
 * link resolves the same way once they're signed in.
 *
 * Navigation is declarative (<Redirect>) rather than imperative router.replace:
 * a hard-load of this deep route runs effects before the root navigator's Slot
 * is ready, and an imperative replace there throws "navigate before mounting
 * the Root Layout". <Redirect> defers until the navigator is mounted.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { AffinityGroupService } from '@/services/AffinityGroupService';

const C = { bg: '#F7FAFC', ink: '#172033', muted: '#667085', blue: '#007AFF' } as const;

export default function GroupJoinByTokenPage(): React.ReactElement {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token.trim() : '';
  const { user, loading: authLoading } = useAuth();
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  // Redeem-once guard: auth state can settle in multiple renders, but the join
  // RPC should fire a single time.
  const redeemed = useRef(false);

  useEffect(() => {
    if (authLoading || !token || !user?.id || redeemed.current) return;
    redeemed.current = true;
    void (async () => {
      try {
        setJoinedGroupId(await AffinityGroupService.joinByToken(token));
      } catch (err) {
        redeemed.current = false;
        setErrorText((err as Error)?.message || 'This invite link is invalid or expired.');
      }
    })();
  }, [authLoading, token, user?.id]);

  if (!token) {
    return <ErrorState message="This invite link is incomplete." />;
  }
  if (errorText) {
    return <ErrorState message={errorText} />;
  }
  if (joinedGroupId) {
    return <Redirect href={`/group/${joinedGroupId}` as never} />;
  }
  if (!authLoading && !user?.id) {
    return <Redirect href={`/(auth)/login?returnTo=/group/join/${token}` as never} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: 'Join group' }} />
      <View style={styles.center}>
        <ActivityIndicator color={C.blue} />
        <Text style={styles.body}>Joining the group…</Text>
      </View>
    </SafeAreaView>
  );
}

function ErrorState({ message }: { message: string }): React.ReactElement {
  const [leave, setLeave] = useState(false);
  if (leave) return <Redirect href={'/(tabs)/atlas' as never} />;
  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: 'Join group' }} />
      <View style={styles.center}>
        <Ionicons name="link-outline" size={40} color={C.muted} />
        <Text style={styles.title}>Can’t open this invite</Text>
        <Text style={styles.body}>{message}</Text>
        <Pressable style={styles.button} onPress={() => setLeave(true)}>
          <Text style={styles.buttonText}>Go to Atlas</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { color: C.ink, fontSize: 20, fontWeight: '800' },
  body: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: {
    marginTop: 8,
    backgroundColor: C.blue,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
