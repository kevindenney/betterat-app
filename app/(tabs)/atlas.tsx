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

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtlasScreen } from '@/components/ios-register/atlas/AtlasScreen';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

export default function AtlasTab() {
  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <View style={styles.surface}>
        <AtlasScreen frame="f1" embedded />
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
    paddingBottom: FLOATING_TAB_BAR_HEIGHT,
  },
});
