/**
 * Onboarding Index - Entry Point Router
 * Redirects to appropriate onboarding screen based on user status
 */

import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService';

export default function OnboardingIndex() {
  const router = useRouter();

  useEffect(() => {
    const redirectToStart = async () => {
      const startingRoute = await OnboardingStateService.getStartingRoute();
      router.replace(startingRoute as any);
    };

    redirectToStart();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
