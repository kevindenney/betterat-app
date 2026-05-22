/**
 * Step Detail Screen - Route wrapper
 *
 * Full-screen detail view for a single timeline step.
 * Reads `id` from route params and renders StepDetailContent
 * inside a SafeAreaView with a vocabulary-aware header.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StepDetailContent } from '@/components/step/StepDetailContent';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useStepBlueprintChrome } from '@/hooks/useStepBlueprintChrome';
import { getEventTabRoute } from '@/lib/navigation-config';

export default function StepDetailScreen() {
  const { id, readOnly, tab } = useLocalSearchParams<{ id: string; readOnly?: string; tab?: string }>();
  const actualId = Array.isArray(id) ? id[0] : id;
  const isReadOnly = readOnly === 'true';
  const initialTab = (Array.isArray(tab) ? tab[0] : tab) as
    | 'plan'
    | 'act'
    | 'review'
    | 'discussion'
    | undefined;
  const { vocab } = useVocabulary();
  // When the step has a blueprint parent, the back label switches from
  // generic "Practice" → "← Pre-Clinical" so the canonical context line
  // sits in the native nav header instead of duplicating below the title.
  const { data: blueprintChrome } = useStepBlueprintChrome(actualId);
  const backLabel = blueprintChrome?.blueprintShortName ?? 'Practice';

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

  // Always render an explicit headerLeft so the user has a way out of the
  // standalone step screen — when nav history is empty (cold-load via deep
  // link or restored last-route), the default iOS back button doesn't show
  // and the user gets trapped with no escape. We fall back to the main
  // Practice tab in that case.
  const handleBack = () =>
    router.canGoBack()
      ? router.back()
      : router.replace(getEventTabRoute() as any);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          // Title hidden so the canonical chrome reads "← {parent}" without
          // a competing centered title. Falls back to vocab when needed for
          // accessibility / breadcrumb consumers.
          title: blueprintChrome?.blueprintTitle ?? vocab('Learning Event'),
          headerTitle: '',
          headerShown: true,
          headerBackTitle: backLabel,
          headerLeft: () =>
            Platform.OS === 'web' ? (
              <Text style={styles.webBackButton} onPress={handleBack}>
                ← {backLabel}
              </Text>
            ) : (
              <Pressable
                onPress={handleBack}
                style={styles.nativeBackBtn}
                accessibilityRole="button"
                accessibilityLabel={`Back to ${backLabel}`}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color="#007AFF" />
                <Text style={styles.nativeBackLabel}>{backLabel}</Text>
              </Pressable>
            ),
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/race/ios/${actualId}` as any)}
              style={styles.iosPreviewBtn}
              accessibilityLabel="Preview in iOS register"
              hitSlop={8}
            >
              <Ionicons name="sparkles-outline" size={18} color="#007AFF" />
              <Text style={styles.iosPreviewLabel}>iOS</Text>
            </Pressable>
          ),
        }}
      />
      <StepDetailContent stepId={actualId} readOnly={isReadOnly} initialTab={initialTab} />
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
  nativeBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  nativeBackLabel: {
    fontSize: 16,
    color: '#007AFF',
    letterSpacing: -0.2,
  },
  iosPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  iosPreviewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: -0.1,
  },
});
