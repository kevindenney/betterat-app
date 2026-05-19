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
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { HkdwStepCard, SmartAppBanner, WelcomeToast } from '@/components/onboarding';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useHkdwStepData } from '@/hooks/useHkdwStepData';

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

  // Real-data fetch — skipped for the sample fast-path so the demo route
  // never hits the network. `useHkdwStepData` joins timeline_steps →
  // blueprint_steps → timeline_blueprints + counts subscribers.
  const { data: liveStep, isLoading: liveLoading } = useHkdwStepData(
    isSample ? undefined : id,
  );

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

  if (!isSample && liveLoading) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: 'Step' }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSample && !liveStep) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Step' }} />
        <Text style={styles.disabledTitle}>Step not found.</Text>
        <Text style={styles.disabledBody}>
          This step isn't in a blueprint you have access to. Open the sample at
          /practice/step/{HKDW_SAMPLE_STEP_ID} to preview the HKDW first-action card.
        </Text>
      </View>
    );
  }

  const cardProps = isSample
    ? {
        blueprintShortName: MOCK_STEP.blueprintShortName,
        blueprintWeekLine: MOCK_STEP.blueprintWeekLine,
        stepCounter: MOCK_STEP.stepCounter,
        stepTitle: MOCK_STEP.stepTitle,
        fromLine: MOCK_STEP.fromLine,
        fleetChipLabel: MOCK_STEP.fleetChipLabel,
        planWhatText: MOCK_STEP.planWhatText,
        planHowText: isWeb ? MOCK_STEP.planHowText : MOCK_STEP.planHowTextNative,
        totalSailors: 63,
      }
    : {
        blueprintShortName: liveStep!.blueprintShortName,
        blueprintWeekLine: liveStep!.blueprintWeekLine,
        stepCounter: liveStep!.stepCounter,
        stepTitle: liveStep!.stepTitle,
        fromLine: liveStep!.fromLine,
        fleetChipLabel: liveStep!.fleetChipLabel,
        planWhatText: liveStep!.stepWhat ?? undefined,
        planHowText: liveStep!.stepHowText ?? undefined,
        totalSailors: liveStep!.subscriberCount,
      };

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
          subscriptionSource={
            isSample
              ? "Kevin's HKDW blueprint"
              : liveStep!.fromLine.replace(/^From\s+/, '')
          }
          count={{
            steps: isSample ? 12 : liveStep!.totalSteps,
            freeMonths: 3,
            fleetSize: cardProps.totalSailors,
          }}
        />

        <HkdwStepCard
          variant={isWeb ? 'web' : 'native'}
          blueprintShortName={cardProps.blueprintShortName}
          blueprintWeekLine={cardProps.blueprintWeekLine}
          eyebrow="Your first step"
          stepCounter={cardProps.stepCounter}
          preTitle="Current step"
          stepTitle={cardProps.stepTitle}
          fromLine={cardProps.fromLine}
          fleetChipLabel={cardProps.fleetChipLabel}
          planWhatText={cardProps.planWhatText}
          planHowText={cardProps.planHowText}
          activePhase="plan"
          totalSailors={cardProps.totalSailors}
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
