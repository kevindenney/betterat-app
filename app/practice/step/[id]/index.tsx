/**
 * Phase 10 · HKDW first-action step view.
 *
 * Web renders the HkdwStepCard with install-hint + WelcomeToast.
 * Native renders the HkdwStepCard with Worlds Fleet chip + AI helper.
 *
 * For the sample HKDW token this mounts mock data so reviewers can
 * see the canonical surface without round-tripping the database.
 */

import React, { useCallback } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { HkdwStepCard, SmartAppBanner, WelcomeToast } from '@/components/onboarding';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

const HKDW_SAMPLE_STEP_ID = 'boat-speed';

const MOCK_STEP = {
  blueprintShortName: 'HKDW Prep',
  blueprintWeekLine: 'Week 1 of 24',
  stepCounter: 'Step 1 of 12',
  stepTitle: 'Boat-speed baseline · all points of sail',
  fromLine: "Kevin's Prepare for the Worlds",
  fleetChipLabel: 'Worlds Fleet · 63 sailors',
  planWhatText:
    'Sail your boat for one hour, recording target speeds on each point of sail in 8–12 kt of breeze…',
  planHowText: "Sub-steps from Kevin's blueprint will appear here…",
  planHowTextNative: 'Tap the mic on the water — works offline, syncs back when you have signal.',
};

const APP_STORE_URL = 'https://apps.apple.com/app/betterat';

export default function HkdwStepRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const flagOn = FEATURE_FLAGS.HKDW_REDEEM_FLOW;

  const isWeb = Platform.OS === 'web';
  const isSample = id === HKDW_SAMPLE_STEP_ID;

  const goBlueprintIndex = useCallback(() => {
    router.push('/practice/blueprint/hkdw-prepare-for-the-worlds' as any);
  }, []);

  const goFleet = useCallback(() => {
    router.push('/practice/blueprint/hkdw-prepare-for-the-worlds/fleet' as any);
  }, []);

  const goDiscussion = useCallback(() => {
    router.push(`/practice/step/${id}/discussion` as any);
  }, [id]);

  if (!flagOn) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Step' }} />
        <Text style={styles.disabledTitle}>This step view isn't live yet.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_HKDW_REDEEM_FLOW in this environment to preview.
        </Text>
      </View>
    );
  }

  if (!id) return null;

  // Phase 10 mock fast-path. Real data wiring lands when blueprint
  // subscription joins are wired into the practice route.
  if (!isSample) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Step' }} />
        <Text style={styles.disabledTitle}>Step not found.</Text>
        <Text style={styles.disabledBody}>
          Open the sample at /practice/step/{HKDW_SAMPLE_STEP_ID} to preview the HKDW first-action card.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {isWeb ? (
        <SmartAppBanner
          appName="BetterAt"
          description="Open in app for voice capture & offline"
          installUrl={APP_STORE_URL}
          page={`practice/step/${id}`}
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        <WelcomeToast
          variant={isWeb ? 'subscription' : 'native-resume'}
          subscriptionSource={isWeb ? "Kevin's HKDW blueprint" : "Kevin's HKDW blueprint"}
          count={{ steps: 12, freeMonths: 3, fleetSize: 63 }}
        />

        <HkdwStepCard
          variant={isWeb ? 'web' : 'native'}
          blueprintShortName={MOCK_STEP.blueprintShortName}
          blueprintWeekLine={MOCK_STEP.blueprintWeekLine}
          eyebrow="Your first step"
          stepCounter={MOCK_STEP.stepCounter}
          preTitle="Current step"
          stepTitle={MOCK_STEP.stepTitle}
          fromLine={MOCK_STEP.fromLine}
          fleetChipLabel={MOCK_STEP.fleetChipLabel}
          planWhatText={MOCK_STEP.planWhatText}
          planHowText={isWeb ? MOCK_STEP.planHowText : MOCK_STEP.planHowTextNative}
          activePhase="plan"
          totalSailors={63}
          onTapBlueprintStrip={goBlueprintIndex}
          onTapFleetChip={goFleet}
          onTapDiscussion={goDiscussion}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scroll: {
    padding: 14,
    gap: 12,
    maxWidth: 460,
    alignSelf: 'center',
    width: '100%',
  },
  disabled: {
    flex: 1,
    padding: 24,
    gap: 8,
  },
  disabledTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  disabledBody: {
    fontSize: 14,
    color: '#6B7280',
  },
});
