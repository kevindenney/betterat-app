import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { RedeemLanding } from '@/components/onboarding';
import {
  consumeTokenForUser,
  loadBlueprintPreview,
  resolveToken,
} from '@/services/RedeemService';
import { trackRedeemEvent } from '@/services/RedeemTelemetry';
import { useAuth } from '@/providers/AuthProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { supabase } from '@/services/supabase';

const FLEET_SAMPLE = [
  { initials: 'PL', color: '#4E6A85' },
  { initials: 'BV', color: '#3E6C4E' },
  { initials: 'SN', color: '#5C3F7A' },
  { initials: 'KH', color: '#4A3F2E' },
];

const HKDW_COPY = {
  authorRole: 'your Worlds coach',
  blueprintSubtitle:
    "A path through the conditions you'll race in November — boat speed, heavy-air helm work, starts, fleet tactics.",
  blueprintVersionLine: 'Updated April · v3.2',
  welcomePillText: 'Welcoming you · 90 days free',
  fleetTagline: 'Worlds sailors already started',
  fleetSubline: 'Same race · same conditions · same fleet',
};

export default function RedeemRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flagOn = FEATURE_FLAGS.HKDW_REDEEM_FLOW;
  const enabled = Boolean(token && flagOn);

  const { data: tokenInfo, isLoading: loadingToken } = useQuery({
    queryKey: ['phase10-redeem-token', token],
    queryFn: () => resolveToken(token!),
    enabled,
    retry: false,
  });

  const { data: preview, isLoading: loadingPreview } = useQuery({
    queryKey: ['phase10-redeem-preview', tokenInfo?.blueprintId],
    queryFn: () => loadBlueprintPreview(tokenInfo!.blueprintId),
    enabled: Boolean(tokenInfo?.blueprintId),
  });

  useEffect(() => {
    if (!token || !flagOn) return;
    trackRedeemEvent({ name: 'redeem_attempted', token, success: Boolean(tokenInfo) });
  }, [token, tokenInfo, flagOn]);

  const handleAccept = useCallback(async () => {
    if (!token || !tokenInfo || !preview) return;
    if (!user?.id) {
      setError('Sign in to accept this invitation.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await consumeTokenForUser({ token, userId: user.id });
      if (result.alreadyUsed) {
        setError('This invitation has already been used.');
        return;
      }
      trackRedeemEvent({
        name: 'redeem_completed',
        token,
        userId: user.id,
        blueprintId: result.blueprintId,
      });
      // Sample fast-path: `sample-blueprint` is the dev mock id (not a real
      // UUID), so the subscribe / firstStepIdFor / blueprint detail paths
      // all fail. Skip them and route straight to the canonical first-step
      // preview at /practice/step/boat-speed.
      if (result.blueprintId === 'sample-blueprint') {
        trackRedeemEvent({ name: 'first_step_written', userId: user.id, stepId: 'boat-speed' });
        router.replace('/practice/step/boat-speed' as any);
        return;
      }
      const subscriptionId = await subscribeUserToBlueprint(user.id, result.blueprintId);
      const stepId = result.firstStepId ?? (await firstStepIdFor(result.blueprintId));
      if (stepId) {
        trackRedeemEvent({ name: 'first_step_written', userId: user.id, stepId });
        router.replace(`/practice/step/${stepId}` as any);
      } else {
        router.replace(`/library/blueprints/${result.blueprintId}` as any);
      }
      // Touch subscriptionId so the linter sees it; future telemetry payloads
      // can route off it.
      void subscriptionId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not accept invitation.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [token, tokenInfo, preview, user?.id]);

  if (!flagOn) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Invitation' }} />
        <Text style={styles.disabledTitle}>This invitation type isn't live yet.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_HKDW_REDEEM_FLOW in this environment to preview.
        </Text>
      </View>
    );
  }

  if (loadingToken || loadingPreview) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: 'Invitation' }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (!tokenInfo) {
    return (
      <View style={styles.invalid}>
        <Stack.Screen options={{ title: 'Invitation' }} />
        <Text style={styles.invalidTitle}>This invitation has expired or already been used</Text>
        <Text style={styles.invalidBody}>
          Reach out to whoever shared it for a fresh link, or learn more about BetterAt.
        </Text>
        <Pressable style={styles.invalidCta} onPress={() => router.replace('/' as any)}>
          <Text style={styles.invalidCtaText}>Explore BetterAt</Text>
        </Pressable>
      </View>
    );
  }

  if (!preview) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: 'Invitation' }} />
        <ActivityIndicator />
      </View>
    );
  }

  const isHkdwSource = tokenInfo.source === 'hkdw-2026';
  const fleetCountLabel = isHkdwSource
    ? `${preview.subscriberCount} ${HKDW_COPY.fleetTagline}`
    : `${preview.subscriberCount} sailors already started`;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <RedeemLanding
        token={token!}
        blueprintAuthor={{
          name: preview.authorName,
          affiliation: preview.authorAffiliation,
          avatarInitials: preview.authorInitials,
          role: isHkdwSource ? HKDW_COPY.authorRole : undefined,
        }}
        blueprint={{
          id: preview.id,
          title: preview.title,
          stepCount: preview.stepCount,
          durationMonths: preview.durationMonths,
          capabilities: preview.capabilities,
        }}
        fleetCount={preview.subscriberCount}
        fleetSampleAvatars={FLEET_SAMPLE}
        freeMonths={3}
        postFreePrice="$9/mo"
        welcomePillText={isHkdwSource ? HKDW_COPY.welcomePillText : undefined}
        fleetTagline={fleetCountLabel}
        fleetSubline={isHkdwSource ? HKDW_COPY.fleetSubline : undefined}
        blueprintSubtitle={isHkdwSource ? HKDW_COPY.blueprintSubtitle : undefined}
        blueprintVersionLine={isHkdwSource ? HKDW_COPY.blueprintVersionLine : undefined}
        onAccept={handleAccept}
        onSkip={() => router.replace('/' as any)}
      />
      {error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {busy ? (
        <View style={styles.busyOverlay}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

async function subscribeUserToBlueprint(userId: string, blueprintId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('blueprint_subscriptions')
    .insert({ subscriber_id: userId, blueprint_id: blueprintId })
    .select('id')
    .maybeSingle();
  if (error) return null;
  return (data as { id: string } | null)?.id ?? null;
}

async function firstStepIdFor(blueprintId: string): Promise<string | null> {
  const { data } = await supabase
    .from('blueprint_steps')
    .select('step_id, sort_order')
    .eq('blueprint_id', blueprintId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { step_id: string } | null)?.step_id ?? null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loading: {
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
  invalid: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  invalidTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  invalidBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  invalidCta: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  invalidCtaText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorBlock: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.35)',
  },
});
