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
import { useRouter } from 'expo-router';

import {
  AtlasScreen,
  type AtlasFrameId,
} from '@/components/ios-register/atlas/AtlasScreen';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useAtlasNextEvent } from '@/hooks/useAtlasNextEvent';

// Interest-aware variant selection. Per the brief's "Universal empty-state
// formula" + per-persona empty states. The mapping below is the v1 lookup;
// Phase A1 replaces it with interest registry resolvers.
function pickFrameForInterest(slug: string | null): AtlasFrameId {
  const s = (slug ?? '').toLowerCase();
  if (s === 'nursing' || s === 'msn' || s === 'msn-nursing') return 'f4';
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

  // FloatingTabBar floats above the home-indicator safe area; clear both
  // plus a small buffer so the BottomSheet CTAs aren't covered.
  const tabBarSpace = FLOATING_TAB_BAR_HEIGHT + insets.bottom + 12;

  const frame = useMemo(
    () => pickFrameForInterest(currentInterest?.slug ?? null),
    [currentInterest?.slug],
  );
  const subtitleOverride = useMemo(
    () => buildSubtitle(currentInterest?.slug ?? null, currentInterest?.name ?? null),
    [currentInterest?.slug, currentInterest?.name],
  );

  const handlePrimary = useCallback(() => {
    // F1 + sailing: "Plan a step" → Practice tab (canonical add-step entry).
    // F4 + nursing: "Anchor · pick site" → also Practice; the location-pick
    //               flow into Plan tab's Where field is Phase A1 work.
    router.push('/(tabs)/practice');
  }, [router]);

  const handleSecondary = useCallback(() => {
    // F1: "Open Race 4" → Practice. Real next-event resolver lands in A1.
    // F4: "Skip" → no-op (stays on Atlas).
    if (frame === 'f4') return;
    router.push('/(tabs)/practice');
  }, [frame, router]);

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <View style={[styles.surface, { paddingBottom: tabBarSpace }]}>
        <AtlasScreen
          frame={frame}
          embedded
          subtitleOverride={subtitleOverride}
          nextEvent={nextEvent}
          avatarInitial={avatarInitial}
          onPrimaryAction={handlePrimary}
          onSecondaryAction={handleSecondary}
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
