/**
 * Surface B · Worlds Fleet route — per-blueprint peer plans.
 *
 * Reads BlueprintService.getBlueprintFleetPeers() and projects rows into
 * the FleetPlansView shape. Falls back to a mock for the HKDW sample.
 */

import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  FleetPlansView,
  type FleetPeer,
  type FleetPeerStatus,
} from '@/components/onboarding';
import { useAuth } from '@/providers/AuthProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { getBlueprintWithAuthorById } from '@/services/BlueprintService';
import { getBlueprintFleetPeers } from '@/services/HkdwFleetService';

const HKDW_SAMPLE_IDS = new Set([
  'hkdw-prepare-for-the-worlds',
  'sample-blueprint',
]);

const HKDW_FLEET_MOCK: {
  heroTitle: string;
  metaLine: string;
  stats: { value: number; label: string }[];
  viewerCurrentStepNumber: number;
  peers: FleetPeer[];
} = {
  heroTitle: 'Worlds Fleet · "Prepare for the Worlds"',
  metaLine: '63 sailors subscribed · 8 in your week',
  stats: [
    { value: 63, label: 'Subscribed' },
    { value: 47, label: 'Active 7d' },
    { value: 8, label: 'On Step 4' },
  ],
  viewerCurrentStepNumber: 4,
  peers: [
    {
      id: 'phyl',
      initials: 'PL',
      avatarColorKey: 'green',
      name: 'Phyl Loong',
      whereLine: 'RHKYC · HKG-12',
      activityLine: 'On Step 4 · Boat-speed baseline · captured 2 sessions',
      currentStepNumber: 4,
      totalSteps: 12,
      status: 'same-step',
    },
    {
      id: 'bram',
      initials: 'BV',
      avatarColorKey: 'purple',
      name: 'Bram van der Veer',
      whereLine: 'KNZRV · NED-7',
      activityLine: 'Finished Step 5 · Light-air starts · 2 days ago',
      currentStepNumber: 5,
      totalSteps: 12,
      status: 'ahead',
    },
    {
      id: 'sara',
      initials: 'SN',
      avatarColorKey: 'brown',
      name: 'Sara Nilsson',
      whereLine: 'KSSS · SWE-3',
      activityLine: 'On Step 4 · Boat-speed baseline · reflecting now',
      currentStepNumber: 4,
      totalSteps: 12,
      status: 'same-step',
    },
    {
      id: 'karin',
      initials: 'KH',
      avatarColorKey: 'gold',
      name: 'Karin Høeg',
      whereLine: 'KDY · DEN-21',
      activityLine: 'On Step 6 · Heavy-air helm · reviewed this week',
      currentStepNumber: 6,
      totalSteps: 12,
      status: 'ahead',
    },
    {
      id: 'marco',
      initials: 'MO',
      avatarColorKey: 'navy',
      name: 'Marco Orsetti',
      whereLine: 'YCCS · ITA-4',
      activityLine: 'On Step 4 · Boat-speed baseline · last active 4d',
      currentStepNumber: 4,
      totalSteps: 12,
      status: 'same-step',
    },
    {
      id: 'tomi',
      initials: 'TS',
      avatarColorKey: 'green',
      name: 'Tomi Sato',
      whereLine: 'NYC · JPN-9',
      activityLine: 'Finished Step 3 · Rig tune · yesterday',
      currentStepNumber: 3,
      totalSteps: 12,
      status: 'behind',
    },
  ],
};

export default function BlueprintFleetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const flagOn = FEATURE_FLAGS.HKDW_REDEEM_FLOW;
  const isSample = Boolean(id && HKDW_SAMPLE_IDS.has(id));
  const realEnabled = Boolean(id && flagOn && !isSample && user?.id);

  const { data: blueprint } = useQuery({
    queryKey: ['phase10-blueprint', id],
    queryFn: () => getBlueprintWithAuthorById(id!),
    enabled: realEnabled,
  });

  const { data: peers, isLoading: peersLoading } = useQuery({
    queryKey: ['phase10-fleet-peers', id, user?.id],
    queryFn: () => getBlueprintFleetPeers(id!, user!.id),
    enabled: realEnabled,
  });

  const viewerCurrentStepNumber = useMemo(() => {
    if (isSample) return HKDW_FLEET_MOCK.viewerCurrentStepNumber;
    return undefined;
  }, [isSample]);

  const viewPeers = useMemo<FleetPeer[]>(() => {
    if (isSample) return HKDW_FLEET_MOCK.peers;
    if (!peers) return [];
    return peers
      .filter((p) => p.current_step_number != null)
      .map((p, idx) => ({
        id: p.user_id,
        initials: initialsFrom(p.name ?? '?'),
        avatarColorKey: pickColor(idx),
        name: p.name ?? 'Sailor',
        whereLine: '—',
        activityLine: `${p.current_step_title ?? 'Step'}${p.activity_line ? ` · ${p.activity_line}` : ''}`,
        currentStepNumber: p.current_step_number!,
        totalSteps: p.total_steps,
        status: p.status as FleetPeerStatus,
      }));
  }, [isSample, peers]);

  const heroTitle = isSample
    ? HKDW_FLEET_MOCK.heroTitle
    : `Fleet · ${blueprint?.title ?? 'Blueprint'}`;
  const metaLine = isSample
    ? HKDW_FLEET_MOCK.metaLine
    : `${viewPeers.length} sailors`;
  const stats = isSample
    ? HKDW_FLEET_MOCK.stats
    : [
        { value: viewPeers.length, label: 'Subscribed' },
        {
          value: viewPeers.filter((p) => p.status === 'same-step').length,
          label: 'On your step',
        },
        {
          value: viewPeers.filter((p) => p.status === 'ahead').length,
          label: 'Ahead',
        },
      ];

  const onBack = useCallback(() => router.back(), []);

  if (!flagOn) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Fleet' }} />
        <Text style={styles.disabledTitle}>This fleet view isn't live yet.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_HKDW_REDEEM_FLOW in this environment to preview.
        </Text>
      </View>
    );
  }

  if (!id) return null;

  if (!isSample && peersLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <FleetPlansView
        heroTitle={heroTitle}
        metaLine={metaLine}
        stats={stats}
        viewerCurrentStepNumber={viewerCurrentStepNumber}
        peers={viewPeers}
        onBack={onBack}
      />
    </View>
  );
}

function initialsFrom(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function pickColor(idx: number): NonNullable<FleetPeer['avatarColorKey']> {
  const ks: NonNullable<FleetPeer['avatarColorKey']>[] = [
    'navy',
    'green',
    'purple',
    'brown',
    'gold',
  ];
  return ks[idx % ks.length];
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
