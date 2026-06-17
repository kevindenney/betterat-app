import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest, type Interest } from '@/providers/InterestProvider';
import { IOSListSection } from '@/components/ui/ios/IOSListSection';
import { IOSListItem } from '@/components/ui/ios/IOSListItem';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { createLogger } from '@/lib/utils/logger';
import type { TimelineStepVisibility } from '@/types/timeline-steps';
import type { StepLocationPrecision } from '@/types/step-detail';
import { getVisibilityLabels } from '@/lib/vocabulary';
import {
  getPrivacySettings,
  updateProfilePrivacy,
  setInterestDefault as setInterestDefaultApi,
  DEFAULT_SETTINGS,
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

// "Crew" / "Fleet" are sailing vernacular; resolve per interest so other
// interests read neutral words (Collaborators / Group). Pass no slug for the
// profile-wide default, which spans every interest.
function buildVisibilityOptions(
  interestSlug?: string | null,
): { value: TimelineStepVisibility; label: string }[] {
  const labels = getVisibilityLabels(interestSlug);
  return [
    { value: 'private', label: 'Private' },
    { value: 'crew', label: labels.crew },
    { value: 'fleet', label: labels.fleet },
    { value: 'public', label: 'Public' },
  ];
}

function buildInterestVisibilityOptions(
  interestSlug?: string | null,
): { value: TimelineStepVisibility | 'default'; label: string }[] {
  return [
    { value: 'default', label: 'Use Profile Default' },
    ...buildVisibilityOptions(interestSlug),
  ];
}

function visibilityLabel(value: TimelineStepVisibility, interestSlug?: string | null): string {
  return buildVisibilityOptions(interestSlug).find((o) => o.value === value)?.label ?? 'Private';
}

// Default coordinate precision for new step locations. Mirrors the per-step
// picker in PlanWhereCard. 'site' is intentionally omitted (needs a poi_id the
// app never sets, so it would silently behave as exact). `null` = Exact via the
// create RPC's COALESCE.
const PRECISION_OPTIONS: { value: StepLocationPrecision; label: string }[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'neighborhood', label: 'Approximate' },
  { value: 'hidden', label: 'Hidden' },
];

function precisionLabel(value: StepLocationPrecision | null): string {
  return PRECISION_OPTIONS.find((o) => o.value === (value ?? 'exact'))?.label ?? 'Exact';
}

// Per-section public-face toggles. Each gates whether a whole section appears
// on the public face (AND-ed with per-step visibility). Disabled while the
// profile is private, since there's no public face to shape yet.
type ToggleMeta = {
  key: keyof ProfilePrivacySettings;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
};

const SECTION_TOGGLES: ToggleMeta[] = [
  { key: 'show_framing', title: 'Framing', subtitle: 'Your intro and where you practice', icon: 'text-outline', color: ICON_BACKGROUNDS.blue },
  { key: 'show_working_on_now', title: 'Working On Now', subtitle: "What you're working on right now", icon: 'flask-outline', color: ICON_BACKGROUNDS.orange },
  { key: 'show_capabilities', title: 'Capabilities', subtitle: 'Skills backed by your evidence', icon: 'ribbon-outline', color: ICON_BACKGROUNDS.green },
  { key: 'show_practice_timeline', title: 'Practice Timeline', subtitle: 'Your completed and settled steps', icon: 'footsteps-outline', color: ICON_BACKGROUNDS.purple },
  { key: 'show_practice_circle', title: 'Practice Circle', subtitle: 'People you practice with', icon: 'people-circle-outline', color: ICON_BACKGROUNDS.blue },
  { key: 'show_orgs', title: 'Organizations', subtitle: "Clubs, schools, and programs you've joined", icon: 'business-outline', color: ICON_BACKGROUNDS.gray },
  { key: 'show_published_blueprints', title: 'Published Plans', subtitle: "Plans you've published for others", icon: 'documents-outline', color: ICON_BACKGROUNDS.orange },
  { key: 'show_events', title: 'Events', subtitle: "Events you've competed in or attended", icon: 'trophy-outline', color: ICON_BACKGROUNDS.green },
];

// Per-interaction toggles. Each gates a public-face CTA others can use. These
// stay live even on a private profile, since followers still see the face.
const INTERACTION_TOGGLES: ToggleMeta[] = [
  { key: 'allow_follow', title: 'Allow Follows', subtitle: 'Let others follow your practice', icon: 'person-add-outline', color: ICON_BACKGROUNDS.blue },
  { key: 'allow_message', title: 'Allow Messages', subtitle: 'Let others message you directly', icon: 'chatbubble-outline', color: ICON_BACKGROUNDS.green },
  { key: 'allow_suggest_step', title: 'Allow Step Suggestions', subtitle: 'Let others suggest a step', icon: 'bulb-outline', color: ICON_BACKGROUNDS.orange },
  { key: 'allow_reflect', title: 'Allow Reflections', subtitle: 'Let others reflect on your practice', icon: 'create-outline', color: ICON_BACKGROUNDS.purple },
];

// =============================================================================
// Screen
// =============================================================================

export default function PrivacyScreen(): React.ReactElement {
  const { user, ready } = useAuth();
  const { userInterests } = useInterest();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const prevSettings = useRef<PrivacySettings | null>(null);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const loadSettings = useCallback(async () => {
    // Wait until auth has finished hydrating before deciding there's no user.
    // The effect re-runs when `ready`/`user` change, so we keep the spinner
    // only while the session is genuinely still resolving.
    if (!ready) return;
    // Ready but no session (signed-out, or a transient hot-reload null where
    // Supabase didn't re-emit the session). AuthGate normally bounces signed-
    // out users off this route, so this is a safety net: render defaults
    // instead of spinning forever.
    if (!user) {
      setSettings({ ...DEFAULT_SETTINGS });
      setLoading(false);
      return;
    }
    try {
      // Race the fetch against a timeout: a hung Supabase request (the query
      // is healthy server-side, so this is a network/connection stall) would
      // otherwise leave the screen on its spinner forever. Falling back to
      // DEFAULT_SETTINGS lets the screen render so the user isn't stuck.
      const data = await Promise.race([
        getPrivacySettings(user.id),
        new Promise<PrivacySettings>((resolve) =>
          setTimeout(() => {
            logger.warn('Privacy settings load timed out — using defaults');
            resolve({ ...DEFAULT_SETTINGS });
          }, 8000),
        ),
      ]);
      setSettings(data);
      prevSettings.current = data;
    } catch (err) {
      logger.error('Failed to load privacy settings', err);
      setSettings({ ...DEFAULT_SETTINGS });
    } finally {
      setLoading(false);
    }
  }, [user, ready]);

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
        // The public face reads these flags through a React-Query-cached RPC
        // (`person-public-sections`, 60s staleTime). Without an explicit
        // invalidation, the Preview-as-Public surface keeps serving the old
        // section/interaction values until the cache expires or the app is
        // relaunched. Drop every viewer/preview permutation so the preview
        // reflects the toggle immediately.
        queryClient.invalidateQueries({ queryKey: ['person-public-sections'] });
      } catch (err) {
        logger.error('Failed to save privacy setting', { key, error: err });
        setSettings(prevSettings.current);
        showAlert('Error', 'Failed to save setting. Please try again.');
      }
    },
    [user, settings, queryClient],
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
        queryClient.invalidateQueries({ queryKey: ['person-public-sections'] });
      } catch (err) {
        logger.error('Failed to save interest default', { interestId, error: err });
        setSettings(prevSettings.current);
        showAlert('Error', 'Failed to save setting. Please try again.');
      }
    },
    [user, settings, queryClient],
  );

  // ---------------------------------------------------------------------------
  // Pickers
  // ---------------------------------------------------------------------------

  const showVisibilityPicker = useCallback(() => {
    if (!settings) return;

    // Profile-wide default spans every interest → neutral labels (no slug).
    const options = buildVisibilityOptions();
    const labels = options.map((o) => o.label);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...labels, 'Cancel'],
          cancelButtonIndex: labels.length,
          title: 'Default Step Visibility',
        },
        (index) => {
          if (index < options.length) {
            updateSetting('default_step_visibility', options[index].value);
          }
        },
      );
    } else {
      // Web/Android: cycle through options
      const currentIdx = options.findIndex(
        (o) => o.value === settings.default_step_visibility,
      );
      const nextIdx = (currentIdx + 1) % options.length;
      updateSetting('default_step_visibility', options[nextIdx].value);
    }
  }, [settings, updateSetting]);

  const showPrecisionPicker = useCallback(() => {
    if (!settings) return;

    const labels = PRECISION_OPTIONS.map((o) => o.label);
    const current = settings.default_location_precision ?? 'exact';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...labels, 'Cancel'],
          cancelButtonIndex: labels.length,
          title: 'Default Location Sharing',
        },
        (index) => {
          if (index < PRECISION_OPTIONS.length) {
            const value = PRECISION_OPTIONS[index].value;
            // Store NULL for 'exact' so the create RPC's COALESCE keeps the
            // out-of-box behavior and we don't pin a literal default.
            updateSetting('default_location_precision', value === 'exact' ? null : value);
          }
        },
      );
    } else {
      const currentIdx = PRECISION_OPTIONS.findIndex((o) => o.value === current);
      const nextIdx = (currentIdx + 1) % PRECISION_OPTIONS.length;
      const value = PRECISION_OPTIONS[nextIdx].value;
      updateSetting('default_location_precision', value === 'exact' ? null : value);
    }
  }, [settings, updateSetting]);

  const showInterestPicker = useCallback(
    (interest: Interest) => {
      if (!settings) return;

      const options = buildInterestVisibilityOptions(interest.slug);
      const labels = options.map((o) => o.label);
      const currentValue = settings.interest_visibility_defaults[interest.id] ?? 'default';

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [...labels, 'Cancel'],
            cancelButtonIndex: labels.length,
            title: `Default for ${interest.name}`,
          },
          (index) => {
            if (index < options.length) {
              const selected = options[index].value;
              updateInterestDefault(
                interest.id,
                selected === 'default' ? null : (selected as TimelineStepVisibility),
              );
            }
          },
        );
      } else {
        // Web/Android: cycle through options
        const currentIdx = options.findIndex(
          (o) => o.value === currentValue,
        );
        const nextIdx = (currentIdx + 1) % options.length;
        const selected = options[nextIdx].value;
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

        {/* ── ON MY PUBLIC FACE ── */}
        <IOSListSection
          header="ON MY PUBLIC FACE"
          footer={
            settings.profile_public
              ? 'Choose which sections appear on your public face. Per-step privacy still applies within each section.'
              : 'Turn on Public Profile to choose which sections appear on your public face.'
          }
        >
          {SECTION_TOGGLES.map((t) => (
            <IOSListItem
              key={t.key}
              title={t.title}
              subtitle={t.subtitle}
              leadingIcon={t.icon}
              leadingIconBackgroundColor={t.color}
              trailingAccessory="switch"
              switchValue={settings[t.key] as boolean}
              disabled={!settings.profile_public}
              onSwitchChange={
                settings.profile_public ? (v) => updateSetting(t.key, v) : undefined
              }
            />
          ))}
          {user ? (
            <IOSListItem
              title="Preview as Public"
              subtitle="See your face the way others do"
              leadingIcon="eye-outline"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.gray}
              trailingAccessory="chevron"
              onPress={() => router.push(`/profile/${user.id}?preview=1` as any)}
            />
          ) : null}
        </IOSListSection>

        {/* ── WHO CAN INTERACT ── */}
        <IOSListSection
          header="WHO CAN INTERACT"
          footer="Choose which actions others can take from your public face."
        >
          {INTERACTION_TOGGLES.map((t) => (
            <IOSListItem
              key={t.key}
              title={t.title}
              subtitle={t.subtitle}
              leadingIcon={t.icon}
              leadingIconBackgroundColor={t.color}
              trailingAccessory="switch"
              switchValue={settings[t.key] as boolean}
              onSwitchChange={(v) => updateSetting(t.key, v)}
            />
          ))}
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
          footer="Choose who can see new steps by default, and how precisely their location is shown on the map. You can always change either on an individual step."
        >
          <IOSListItem
            title="Default Step Visibility"
            subtitle={visibilityLabel(settings.default_step_visibility)}
            leadingIcon="eye-outline"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.orange}
            trailingAccessory="chevron"
            onPress={showVisibilityPicker}
          />
          <IOSListItem
            title="Default Location Sharing"
            subtitle={precisionLabel(settings.default_location_precision)}
            leadingIcon="location-outline"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.blue}
            trailingAccessory="chevron"
            onPress={showPrecisionPicker}
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
                ? visibilityLabel(override, interest.slug)
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
