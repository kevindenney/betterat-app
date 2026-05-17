import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest, type Interest } from '@/providers/InterestProvider';
import { IOSListSection } from '@/components/ui/ios/IOSListSection';
import { IOSListItem } from '@/components/ui/ios/IOSListItem';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { createLogger } from '@/lib/utils/logger';
import type { TimelineStepVisibility } from '@/types/timeline-steps';
import {
  getPrivacySettings,
  updateProfilePrivacy,
  setInterestDefault as setInterestDefaultApi,
  type PrivacySettings,
  type ProfilePrivacySettings,
} from '@/services/PrivacySettingsService';

const logger = createLogger('PrivacyScreen');

// =============================================================================
// Constants
// =============================================================================

const ICON_BACKGROUNDS = {
  blue: IOS_COLORS.systemBlue,
  green: IOS_COLORS.systemGreen,
  orange: IOS_COLORS.systemOrange,
  purple: IOS_COLORS.systemPurple,
  gray: IOS_COLORS.systemGray,
} as const;

const VISIBILITY_OPTIONS: { value: TimelineStepVisibility; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'crew', label: 'Crew' },
  { value: 'fleet', label: 'Fleet' },
  { value: 'public', label: 'Public' },
];

const INTEREST_VISIBILITY_OPTIONS: { value: TimelineStepVisibility | 'default'; label: string }[] = [
  { value: 'default', label: 'Use Profile Default' },
  ...VISIBILITY_OPTIONS,
];

function visibilityLabel(value: TimelineStepVisibility): string {
  return VISIBILITY_OPTIONS.find((o) => o.value === value)?.label ?? 'Private';
}

// =============================================================================
// Screen
// =============================================================================

export default function PrivacyScreen(): React.ReactElement {
  const { user } = useAuth();
  const { userInterests } = useInterest();

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const prevSettings = useRef<PrivacySettings | null>(null);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getPrivacySettings(user.id);
      setSettings(data);
      prevSettings.current = data;
    } catch (err) {
      logger.error('Failed to load privacy settings', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ---------------------------------------------------------------------------
  // Save helpers
  // ---------------------------------------------------------------------------

  const updateSetting = useCallback(
    async <K extends keyof ProfilePrivacySettings>(
      key: K,
      value: ProfilePrivacySettings[K],
    ) => {
      if (!user || !settings) return;

      const updated = { ...settings, [key]: value };
      setSettings(updated); // optimistic

      try {
        await updateProfilePrivacy(user.id, { [key]: value });
        prevSettings.current = updated;
      } catch (err) {
        logger.error('Failed to save privacy setting', { key, error: err });
        setSettings(prevSettings.current);
        showAlert('Error', 'Failed to save setting. Please try again.');
      }
    },
    [user, settings],
  );

  const updateInterestDefault = useCallback(
    async (interestId: string, value: TimelineStepVisibility | null) => {
      if (!user || !settings) return;

      const updatedDefaults = { ...settings.interest_visibility_defaults };
      if (value === null) {
        delete updatedDefaults[interestId];
      } else {
        updatedDefaults[interestId] = value;
      }
      const updated = { ...settings, interest_visibility_defaults: updatedDefaults };
      setSettings(updated); // optimistic

      try {
        await setInterestDefaultApi(user.id, interestId, value);
        prevSettings.current = updated;
      } catch (err) {
        logger.error('Failed to save interest default', { interestId, error: err });
        setSettings(prevSettings.current);
        showAlert('Error', 'Failed to save setting. Please try again.');
      }
    },
    [user, settings],
  );

  // ---------------------------------------------------------------------------
  // Pickers
  // ---------------------------------------------------------------------------

  const showVisibilityPicker = useCallback(() => {
    if (!settings) return;

    const labels = VISIBILITY_OPTIONS.map((o) => o.label);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...labels, 'Cancel'],
          cancelButtonIndex: labels.length,
          title: 'Default Step Visibility',
        },
        (index) => {
          if (index < VISIBILITY_OPTIONS.length) {
            updateSetting('default_step_visibility', VISIBILITY_OPTIONS[index].value);
          }
        },
      );
    } else {
      // Web/Android: cycle through options
      const currentIdx = VISIBILITY_OPTIONS.findIndex(
        (o) => o.value === settings.default_step_visibility,
      );
      const nextIdx = (currentIdx + 1) % VISIBILITY_OPTIONS.length;
      updateSetting('default_step_visibility', VISIBILITY_OPTIONS[nextIdx].value);
    }
  }, [settings, updateSetting]);

  const showInterestPicker = useCallback(
    (interest: Interest) => {
      if (!settings) return;

      const labels = INTEREST_VISIBILITY_OPTIONS.map((o) => o.label);
      const currentValue = settings.interest_visibility_defaults[interest.id] ?? 'default';

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [...labels, 'Cancel'],
            cancelButtonIndex: labels.length,
            title: `Default for ${interest.name}`,
          },
          (index) => {
            if (index < INTEREST_VISIBILITY_OPTIONS.length) {
              const selected = INTEREST_VISIBILITY_OPTIONS[index].value;
              updateInterestDefault(
                interest.id,
                selected === 'default' ? null : (selected as TimelineStepVisibility),
              );
            }
          },
        );
      } else {
        // Web/Android: cycle through options
        const currentIdx = INTEREST_VISIBILITY_OPTIONS.findIndex(
          (o) => o.value === currentValue,
        );
        const nextIdx = (currentIdx + 1) % INTEREST_VISIBILITY_OPTIONS.length;
        const selected = INTEREST_VISIBILITY_OPTIONS[nextIdx].value;
        updateInterestDefault(
          interest.id,
          selected === 'default' ? null : (selected as TimelineStepVisibility),
        );
      }
    },
    [settings, updateInterestDefault],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading || !settings) {
    return (
      <>
        <Stack.Screen options={{ title: 'Privacy', headerShown: true, headerBackTitle: 'Settings' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
        </View>
      </>
    );
  }

  // Only show per-interest defaults if user has 2+ interests
  const showInterestDefaults = userInterests.length >= 2;

  return (
    <>
      <Stack.Screen options={{ title: 'Privacy', headerShown: true, headerBackTitle: 'Settings' }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {/* ── PROFILE ── */}
        <IOSListSection
          header="PROFILE"
          footer="When your profile is private, only your followers and organization members can find and view it."
        >
          <IOSListItem
            title="Public Profile"
            leadingIcon="globe-outline"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.blue}
            trailingAccessory="switch"
            switchValue={settings.profile_public}
            onSwitchChange={(v) => updateSetting('profile_public', v)}
          />
          <IOSListItem
            title="Share Activity with Followers"
            subtitle="Followers can see your non-private steps"
            leadingIcon="people-outline"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.green}
            trailingAccessory="switch"
            switchValue={settings.allow_follower_sharing}
            onSwitchChange={(v) => updateSetting('allow_follower_sharing', v)}
          />
        </IOSListSection>

        {/* ── PROGRAMS ── */}
        <IOSListSection
          header="PROGRAMS"
          footer="When disabled, others in the same program won't be able to see your progress on peer timelines."
        >
          <IOSListItem
            title="Show Progress to Peers"
            subtitle="Others in the same program can see your steps"
            leadingIcon="school-outline"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.purple}
            trailingAccessory="switch"
            switchValue={settings.allow_peer_visibility}
            onSwitchChange={(v) => updateSetting('allow_peer_visibility', v)}
          />
        </IOSListSection>

        {/* ── DEFAULTS ── */}
        <IOSListSection
          header="DEFAULTS"
          footer="Choose who can see new steps by default. You can always change visibility on individual steps."
        >
          <IOSListItem
            title="Default Step Visibility"
            subtitle={visibilityLabel(settings.default_step_visibility)}
            leadingIcon="eye-outline"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.orange}
            trailingAccessory="chevron"
            onPress={showVisibilityPicker}
          />
        </IOSListSection>

        {/* ── PER-INTEREST DEFAULTS ── */}
        {showInterestDefaults && (
          <IOSListSection
            header="PER-INTEREST DEFAULTS"
            footer="Override the default step visibility for specific interests. Tap to cycle through options."
          >
            {userInterests.map((interest) => {
              const override = settings.interest_visibility_defaults[interest.id];
              const displayValue = override
                ? visibilityLabel(override)
                : 'Profile Default';

              return (
                <IOSListItem
                  key={interest.id}
                  title={interest.name}
                  subtitle={displayValue}
                  leadingIcon="bookmark-outline"
                  leadingIconBackgroundColor={interest.accent_color || ICON_BACKGROUNDS.gray}
                  trailingAccessory="chevron"
                  onPress={() => showInterestPicker(interest)}
                />
              );
            })}
          </IOSListSection>
        )}
      </ScrollView>
    </>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
