import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { HingeSurface } from '@/components/practice';
import { buildHinge, decodeHingeId } from '@/services/HingeBuildService';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export default function HingeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const decoded = id ? decodeHingeId(id) : null;
  const flagOn = FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER;
  const enabled = Boolean(decoded && user?.id && flagOn);

  const { data: hinge, isLoading } = useQuery({
    queryKey: ['phase9-hinge', id, user?.id],
    queryFn: () =>
      buildHinge({
        userId: user!.id,
        previousStepId: decoded!.previousStepId,
        nextStepId: decoded!.nextStepId,
      }),
    enabled,
  });

  if (!flagOn) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Hinge', headerShown: true }} />
        <Text style={styles.disabledTitle}>Hinge surface is part of an upcoming refresh.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_PRACTICE_STEP_LOOP_IOS_REGISTER to preview.
        </Text>
      </View>
    );
  }

  if (!decoded) return null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {isLoading || !hinge ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <HingeSurface
          hinge={hinge}
          onBack={() => router.back()}
          onPreviousStep={() => router.push(`/step/${hinge.previousStepId}` as any)}
          onNextStep={() => router.push(`/step/${hinge.nextStepId}` as any)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 24,
    gap: 8,
  },
  disabledTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  disabledBody: {
    fontSize: 14,
    color: '#6B7280',
  },
});
