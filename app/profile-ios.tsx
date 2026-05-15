/**
 * Profile — iOS register preview (flat-under-app route)
 *
 * Third sub-tab under Reflect (Progress / Race Log / Profile). Felix's
 * account surface: identity, interests, preferences, plan, exits.
 *
 * Practitioner-side of architecture decision #2 — standard iOS settings
 * density applies. No faculty-density calibration; not earned-register
 * exception territory. The register defers to platform here on purpose.
 *
 * Open at /profile-ios. Sample content drawn from the Claude Design
 * "Profile · Felix sailing · iOS register" handoff. Real account-state
 * wiring lands when the Reflect cutover commit pairs Profile with Race
 * Log iOS in app/(tabs)/reflect.tsx.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  ProfileScreen,
  type ProfileHero,
  type ProfileInterest,
  type ProfileIdentityFields,
  type ProfilePreferencesFields,
  type ProfileReflectFields,
  type ProfilePlan,
} from '@/components/ios-register';

interface Props {
  /**
   * When embedded inside the Reflect tab (after cutover), the preview
   * banner and close-X hide and the parent screen owns the chrome.
   */
  embedded?: boolean;
  /** Top inset forwarded to the inner ScrollView (e.g. toolbar height). */
  topInset?: number;
  /** Forwarded to the inner ScrollView (e.g. for scroll-driven toolbar hide). */
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll'];
}

const SAMPLE_HERO: ProfileHero = {
  initials: 'FB',
  name: 'Felix Brennan',
  handle: '@felix.brennan',
  metaSpans: ['Member since October 2024', 'Hong Kong'],
};

const SAMPLE_INTERESTS: ProfileInterest[] = [
  { id: 'sail', label: 'Sail racing', icon: 'boat', kind: 'primary' },
  { id: 'sc', label: 'Strength & conditioning', icon: 'barbell' },
  { id: 'reading', label: 'Reading', icon: 'book' },
  { id: 'film', label: 'Film photography', icon: 'camera' },
];

const SAMPLE_IDENTITY: ProfileIdentityFields = {
  name: 'Felix Brennan',
  handle: '@felix.brennan',
  email: 'felix.brennan@gmail.com',
  bio: 'Helm on Moonraker. Racing the Spring Series at RHKYC. Trying to get faster in heavy air.',
};

const SAMPLE_PLAN: ProfilePlan = {
  name: 'BetterAt Plus',
  sub: 'Yearly · renews Oct 5, 2026',
  badge: '+',
};

export function ProfileIosPreview({
  embedded = false,
  topInset,
  onScroll,
}: Props = {}) {
  const [windUnit, setWindUnit] = useState<'knots' | 'm/s' | 'mph'>('knots');
  const [distanceUnit, setDistanceUnit] = useState<'nautical' | 'metric'>(
    'nautical',
  );
  const [weeklyDigestOn, setWeeklyDigestOn] = useState(true);
  const [resurfaceOldOn, setResurfaceOldOn] = useState(true);
  const [privateOn, setPrivateOn] = useState(false);

  const preferences: ProfilePreferencesFields = {
    notificationsValue: 'Race & weekly',
    windUnit,
    distanceUnit,
    appearanceValue: 'System',
    languageValue: 'English (UK)',
  };

  const reflect: ProfileReflectFields = {
    captureStyleValue: 'Voice first',
    weeklyDigestOn,
    resurfaceOldCapturesOn: resurfaceOldOn,
    privateModeOn: privateOn,
  };

  return (
    <SafeAreaView
      style={styles.page}
      edges={embedded ? ['bottom'] : ['top', 'bottom']}
    >
      {!embedded && <Stack.Screen options={{ headerShown: false }} />}

      {!embedded && (
        <View style={styles.topChrome}>
          <View style={styles.leftPad} />
          <Pressable
            style={styles.glyphBtn}
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : null)}
            accessibilityLabel="Close iOS preview"
          >
            <Ionicons
              name="close"
              size={22}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
        </View>
      )}

      {!embedded && <PreviewBanner />}

      <ProfileScreen
        hero={SAMPLE_HERO}
        interests={SAMPLE_INTERESTS}
        identity={SAMPLE_IDENTITY}
        preferences={preferences}
        reflect={reflect}
        plan={SAMPLE_PLAN}
        topInset={topInset}
        onScroll={onScroll}
        onWindUnitChange={setWindUnit}
        onDistanceUnitChange={setDistanceUnit}
        onWeeklyDigestChange={setWeeklyDigestOn}
        onResurfaceOldCapturesChange={setResurfaceOldOn}
        onPrivateModeChange={setPrivateOn}
      />
    </SafeAreaView>
  );
}

function PreviewBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons
        name="information-circle"
        size={14}
        color={IOS_REGISTER.labelSecondary}
      />
      <Text style={styles.bannerText}>
        Preview: sample content drawn from the design handoff. Real account-
        state wires in when the Reflect cutover pairs Profile with Race Log.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftPad: { width: 22 },
  glyphBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
    letterSpacing: -0.05,
  },
});

// Default export for Expo Router (route file). Named export above is for
// the embedded render path that the Reflect cutover commit will wire into
// app/(tabs)/reflect.tsx.
export default ProfileIosPreview;
