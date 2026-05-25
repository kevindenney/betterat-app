/**
 * /(tabs)/atlas — Atlas tab live route
 *
 * Phase 11 wiring of the canonical Atlas surface as the centered fifth tab:
 *   Practice · Library · Atlas · Discover · Profile
 *
 * Gated on FEATURE_FLAGS.ATLAS_IOS_REGISTER via the navigation-config
 * insertion. The Tabs.Screen entry in (tabs)/_layout.tsx is unconditional
 * (Expo Router needs the screen registered so the route file resolves);
 * the flag controls whether the tab button is visible in the tab bar.
 *
 * Current data source: F1 (Felix · Causeway Bay overview) with static
 * sample pins. Real MapLibre tiles, atlas_pois, peer-steps RPC, and the
 * universal empty-state formula (home_geography/base/active_locations/
 * peers/next_event resolvers) land in Phase A1 — see
 * docs/redesign/ios-register/atlas-tab-brief.md.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  AtlasScreen,
  type AtlasFrameId,
} from '@/components/ios-register/atlas/AtlasScreen';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useAtlasNextEvent } from '@/hooks/useAtlasNextEvent';
import { AtlasPickerBus } from '@/services/AtlasPickerBus';

// Interest-aware variant selection. Per the brief's "Universal empty-state
// formula" + per-persona empty states. The mapping below is the v1 lookup;
// Phase A1 replaces it with interest registry resolvers.
function pickFrameForInterest(slug: string | null): AtlasFrameId {
  const s = (slug ?? '').toLowerCase();
  if (s === 'nursing' || s === 'msn' || s === 'msn-nursing') return 'f4';
  if (
    s === 'entrepreneur' ||
    s === 'micro-entrepreneur' ||
    s === 'home-entrepreneur' ||
    s === 'small-business' ||
    s === 'lac-craft-business' ||
    s.includes('craft') ||
    s.includes('artisan')
  ) {
    return 'f7';
  }
  // Sailing, drawing, fitness, default → sailor first-run shape (F1)
  return 'f1';
}

// Build the top subtitle line from the current interest. Falls back to the
// frame-specific default if no interest is resolved (e.g. guest with no
// selection yet).
function buildSubtitle(slug: string | null, name: string | null): string | undefined {
  if (!slug) return undefined;
  const s = slug.toLowerCase();
  if (s === 'nursing' || s === 'msn' || s === 'msn-nursing') {
    return `${name ?? 'Nursing'} · MSN · Baltimore`;
  }
  if (s === 'sailing' || s === 'sail-racing' || s === 'sail') {
    return `${name ?? 'Sailing'} · RHKYC · Hong Kong`;
  }
  if (
    s === 'entrepreneur' ||
    s === 'micro-entrepreneur' ||
    s === 'home-entrepreneur' ||
    s === 'small-business' ||
    s === 'lac-craft-business' ||
    s.includes('craft') ||
    s.includes('artisan')
  ) {
    return `${name ?? 'Entrepreneur'} · Jharkhand · Network`;
  }
  // For interests without a curated empty-state yet (drawing, fitness, etc.)
  // we surface just the interest name — Atlas still renders a sailor-shape
  // frame, but the subtitle reads honest.
  return name ?? undefined;
}

// Single-letter avatar from the signed-in user. Prefers user_metadata.
// full_name, then user_metadata.name, then the local part of email; falls
// back to "?" so the chrome never renders an empty disc.
function deriveAvatarInitial(user: { email?: string; user_metadata?: Record<string, unknown> | null } | null): string {
  if (!user) return '?';
  const meta = user.user_metadata ?? {};
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : undefined;
  const name = typeof meta.name === 'string' ? meta.name : undefined;
  const source = (fullName || name || user.email || '').trim();
  if (!source) return '?';
  return source.charAt(0).toUpperCase();
}

export default function AtlasTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const nextEvent = useAtlasNextEvent();
  const avatarInitial = deriveAvatarInitial(user as any);
  // ?fromPlan=1 — PlanWhereCard pushed us here expecting a location result.
  // The commit-mode "Use this location" CTA emits to AtlasPickerBus and
  // router.back()s instead of starting an add-step flow.
  const params = useLocalSearchParams<{ fromPlan?: string }>();
  const isFromPlan = params.fromPlan === '1';

  // FloatingTabBar floats above the home-indicator safe area; clear both
  // plus a small buffer so the BottomSheet CTAs aren't covered.
  const tabBarSpace = FLOATING_TAB_BAR_HEIGHT + insets.bottom + 12;

  const frame = useMemo(
    () => (isFromPlan ? 'f6' : pickFrameForInterest(currentInterest?.slug ?? null)),
    [isFromPlan, currentInterest?.slug],
  );
  const subtitleOverride = useMemo(
    () => buildSubtitle(currentInterest?.slug ?? null, currentInterest?.name ?? null),
    [currentInterest?.slug, currentInterest?.name],
  );

  const handlePrimary = useCallback(
    (pin?: { lat: number; lng: number; place?: string }) => {
      // Round-trip mode — PlanWhereCard pushed here expecting a result.
      // Emit to the picker bus and pop back; PlanWhereCard's awaiting
      // listener applies the coords to the step's location field.
      if (isFromPlan) {
        if (pin) AtlasPickerBus.emit({ lat: pin.lat, lng: pin.lng, place: pin.place });
        else AtlasPickerBus.cancel();
        if (router.canGoBack()) router.back();
        return;
      }
      // F1 + sailing: "Plan a step" → Practice tab (canonical add-step entry).
      // F4 + nursing: "Anchor · pick site" → also Practice.
      //
      // When a compose-at-location pin is present, push the coords as URL
      // params and auto-open the add-step sheet so the user lands on the
      // creation flow with their dropped pin remembered. When a nextEvent
      // exists, also pre-link the new step to it (target_event_kind/id) —
      // dropping a pin during regatta week auto-anchors the new step
      // to the upcoming regatta.
      const queryParams: Record<string, string> = { openAddStep: '1' };
      if (pin) {
        queryParams.pinLat = String(pin.lat);
        queryParams.pinLng = String(pin.lng);
        if (pin.place) queryParams.pinPlace = pin.place;
      }
      if (nextEvent?.event_kind && nextEvent.event_id) {
        queryParams.targetEventKind = nextEvent.event_kind;
        queryParams.targetEventId = nextEvent.event_id;
      }
      router.push({ pathname: '/(tabs)/practice', params: queryParams });
    },
    [isFromPlan, router, nextEvent?.event_kind, nextEvent?.event_id],
  );

  const handleSecondary = useCallback(() => {
    // F1: "Open Race 4" → Practice. Real next-event resolver lands in A1.
    // F4: "Skip" → no-op (stays on Atlas).
    if (frame === 'f4') return;
    router.push('/(tabs)/practice');
  }, [frame, router]);

  const handleAvatarPress = useCallback(() => {
    // /account is the canonical account modal; /(tabs)/profile is a
    // legacy stub with placeholder "John Sailor" data.
    router.push('/account');
  }, [router]);

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <View style={styles.surface}>
        <AtlasScreen
          frame={frame}
          embedded
          subtitleOverride={subtitleOverride}
          nextEvent={nextEvent}
          avatarInitial={avatarInitial}
          useMapLibre={FEATURE_FLAGS.ATLAS_MAPLIBRE_CANVAS}
          initialCommitMode={isFromPlan}
          onPrimaryAction={handlePrimary}
          onSecondaryAction={handleSecondary}
          onAvatarPress={handleAvatarPress}
          bottomSheetOffset={tabBarSpace}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  surface: {
    flex: 1,
  },
});
