/**
 * Step Detail Screen - Route wrapper
 *
 * Full-screen detail view for a single timeline step.
 * Reads `id` from route params and renders StepDetailContent
 * inside a SafeAreaView with a vocabulary-aware header.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StepDetailContent } from '@/components/step/StepDetailContent';
import { useVocabulary } from '@/hooks/useVocabulary';
import { getEventTabRoute } from '@/lib/navigation-config';

export default function StepDetailScreen() {
  const { id, readOnly } = useLocalSearchParams<{ id: string; readOnly?: string }>();
  const actualId = Array.isArray(id) ? id[0] : id;
  const isReadOnly = readOnly === 'true';
  const { vocab } = useVocabulary();

  if (!actualId) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Stack.Screen options={{ title: vocab('Learning Event'), headerShown: true, headerBackTitle: 'Back' }} />
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>No step ID provided</Text>
          <Text
            style={styles.errorLink}
            onPress={() => router.canGoBack() ? router.back() : router.replace(getEventTabRoute() as any)}
          >
            Go back
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: vocab('Learning Event'),
          headerShown: true,
          headerBackTitle: 'Back',
          ...Platform.select({
            web: {
              headerLeft: () => (
                <Text
                  style={styles.webBackButton}
                  onPress={() => router.canGoBack() ? router.back() : router.replace(getEventTabRoute() as any)}
                >
                  ← Back
                </Text>
              ),
            },
          }),
        }}
      />
      <StepDetailContent stepId={actualId} readOnly={isReadOnly} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  errorContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  errorLink: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 8,
  },
  webBackButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    paddingHorizontal: 8,
  },
});
