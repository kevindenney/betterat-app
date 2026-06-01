import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkspaceDomain } from '@/hooks/useWorkspaceDomain';
import { supabase } from '@/services/supabase';
import {
  NotificationService,
  NotificationPreferences,
} from '@/services/NotificationService';
import { IOSListSection } from '@/components/ui/ios/IOSListSection';
import { IOSListItem } from '@/components/ui/ios/IOSListItem';
import { IOS_COLORS, IOS_TYPOGRAPHY, IOS_SPACING } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { createLogger } from '@/lib/utils/logger';

// Only import DateTimePicker on native platforms
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const logger = createLogger('NotificationsScreen');

// =============================================================================
// ICON BACKGROUND COLORS (Apple Settings style)
// =============================================================================

const ICON_BACKGROUNDS = {
  red: IOS_COLORS.systemRed,
  blue: IOS_COLORS.systemBlue,
  orange: IOS_COLORS.systemOrange,
  yellow: '#FFCC00',
  green: IOS_COLORS.systemGreen,
  teal: IOS_COLORS.systemTeal,
  purple: IOS_COLORS.systemPurple,
  gray: IOS_COLORS.systemGray,
} as const;

// =============================================================================
// TYPES
// =============================================================================

/** Settings stored in user_preferences JSONB */
interface UserPrefNotifications {
  race_reminders: boolean;
  weather_alerts: boolean;
  race_results: boolean;
  fleet_activity: boolean;
  coaching_updates: boolean;
  venue_intelligence: boolean;
}

type NotificationPreset = 'essential' | 'operational' | 'all';

const DEFAULT_USER_PREFS: UserPrefNotifications = {
  race_reminders: true,
  weather_alerts: true,
  race_results: true,
  fleet_activity: true,
  coaching_updates: true,
  venue_intelligence: true,
};

const PRESET_CONFIG: Record<
  NotificationPreset,
  {
    userPrefs: UserPrefNotifications;
    notifPrefs: Pick<
      NotificationPreferences,
      | 'newFollower'
      | 'followedUserRace'
      | 'raceLikes'
      | 'raceComments'
      | 'achievements'
      | 'directMessages'
      | 'groupMessages'
    >;
  }
> = {
  essential: {
    userPrefs: {
      race_reminders: true,
      weather_alerts: false,
      race_results: true,
      fleet_activity: false,
      coaching_updates: true,
      venue_intelligence: false,
    },
    notifPrefs: {
      newFollower: false,
      followedUserRace: false,
      raceLikes: false,
      raceComments: false,
      achievements: true,
      directMessages: true,
      groupMessages: true,
    },
  },
  operational: {
    userPrefs: {
      race_reminders: true,
      weather_alerts: true,
      race_results: true,
      fleet_activity: true,
      coaching_updates: true,
      venue_intelligence: true,
    },
    notifPrefs: {
      newFollower: false,
      followedUserRace: true,
      raceLikes: false,
      raceComments: false,
      achievements: true,
      directMessages: true,
      groupMessages: true,
    },
  },
  all: {
    userPrefs: {
      race_reminders: true,
      weather_alerts: true,
      race_results: true,
      fleet_activity: true,
      coaching_updates: true,
      venue_intelligence: true,
    },
    notifPrefs: {
      newFollower: true,
      followedUserRace: true,
      raceLikes: true,
      raceComments: true,
      achievements: true,
      directMessages: true,
      groupMessages: true,
    },
  },
};

// =============================================================================
// HELPERS
// =============================================================================

/** Format "HH:MM" (24h) to "h:mm AM/PM" */
function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Parse "HH:MM" into a Date (today) for DateTimePicker */
function parseTimeToDate(time: string | null | undefined): Date {
  const d = new Date();
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

/** Format a Date to "HH:MM" */
function dateToTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// =============================================================================
// SCREEN
// =============================================================================

export default function NotificationsScreen(): React.ReactElement {
  const router = useRouter();
  const { user, userType, ready } = useAuth();
  const { isSailingPresentationDomain } = useWorkspaceDomain();

  // Settings screens are pushed onto the root stack (headerShown:false), and
  // the native back button is unreliable when arriving via the Account modal
  // or a direct deep-link. Always render an explicit back affordance that
  // falls back to /settings so the user is never trapped.
  const headerOptions = {
    title: 'Notifications',
    headerBackTitle: 'Settings',
    headerShown: true,
    headerLeft: () => (
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <Ionicons name="chevron-back" size={26} color={IOS_COLORS.systemBlue} />
        <Text style={{ color: IOS_COLORS.systemBlue, fontSize: 17 }}>Settings</Text>
      </TouchableOpacity>
    ),
  } as const;
  const isSailingCopy = isSailingPresentationDomain;
  const isClubPersona = userType === 'club';

  // Source A: user_preferences JSONB
  const [userPrefs, setUserPrefs] = useState<UserPrefNotifications>(DEFAULT_USER_PREFS);
  // Source B: notification_preferences table
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);

  const [loading, setLoading] = useState(true);
  const [presetSaving, setPresetSaving] = useState(false);

  // Time picker state
  const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | null>(null);
  const [webTimeInput, setWebTimeInput] = useState('');

  // Refs for reverting on error
  const prevUserPrefs = useRef<UserPrefNotifications>(DEFAULT_USER_PREFS);
  const prevNotifPrefs = useRef<NotificationPreferences | null>(null);

  // ---------------------------------------------------------------------------
  // LOAD
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    // Keep the spinner only while auth is still hydrating; the effect re-runs
    // when `ready`/`user` change. Once ready with no user, stop loading instead
    // of spinning forever (guards against a transient hot-reload null session).
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const [userPrefResult, notifPrefResult] = await Promise.all([
        supabase
          .from('user_preferences')
          .select('notification_preferences')
          .eq('user_id', user.id)
          .maybeSingle(),
        NotificationService.getPreferences(user.id),
      ]);

      if (userPrefResult.error && userPrefResult.error.code !== 'PGRST116') {
        logger.warn('Error loading user_preferences', { error: userPrefResult.error });
      }

      const up = {
        ...DEFAULT_USER_PREFS,
        ...(userPrefResult.data?.notification_preferences ?? {}),
      };
      setUserPrefs(up);
      prevUserPrefs.current = up;

      setNotifPrefs(notifPrefResult);
      prevNotifPrefs.current = notifPrefResult;
    } catch (err) {
      logger.error('Failed to load notification settings', { error: err });
    } finally {
      setLoading(false);
    }
  }, [user, ready]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // SAVE: user_preferences JSONB
  // ---------------------------------------------------------------------------

  const updateUserPref = useCallback(
    async (key: keyof UserPrefNotifications, value: boolean) => {
      if (!user) return;

      const updated = { ...userPrefs, [key]: value };
      setUserPrefs(updated); // optimistic

      try {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            notification_preferences: updated,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
        prevUserPrefs.current = updated;
      } catch (err) {
        logger.error('Failed to save user preference', { key, error: err });
        setUserPrefs(prevUserPrefs.current);
        showAlert('Error', 'Failed to save preference. Please try again.');
      }
    },
    [user, userPrefs],
  );

  // ---------------------------------------------------------------------------
  // SAVE: notification_preferences table
  // ---------------------------------------------------------------------------

  const updateNotifPref = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!user || !notifPrefs) return;

      const updated = { ...notifPrefs, ...patch };
      setNotifPrefs(updated); // optimistic

      try {
        await NotificationService.updatePreferences(user.id, patch);
        prevNotifPrefs.current = updated;
      } catch (err) {
        logger.error('Failed to save notification preference', { error: err });
        setNotifPrefs(prevNotifPrefs.current);
        showAlert('Error', 'Failed to save preference. Please try again.');
      }
    },
    [user, notifPrefs],
  );

  const getActivePreset = useCallback((): NotificationPreset | null => {
    if (!notifPrefs) return null;

    const matchesPreset = (preset: NotificationPreset): boolean => {
      const config = PRESET_CONFIG[preset];

      const userMatches = (Object.keys(config.userPrefs) as (keyof UserPrefNotifications)[]).every(
        (key) => userPrefs[key] === config.userPrefs[key]
      );
      if (!userMatches) return false;

      const notifMatches = (Object.keys(config.notifPrefs) as (keyof typeof config.notifPrefs)[]).every(
        (key) => notifPrefs[key] === config.notifPrefs[key]
      );
      return notifMatches;
    };

    if (matchesPreset('essential')) return 'essential';
    if (matchesPreset('operational')) return 'operational';
    if (matchesPreset('all')) return 'all';
    return null;
  }, [notifPrefs, userPrefs]);

  const activePreset = getActivePreset();

  const applyPreset = useCallback(
    async (preset: NotificationPreset) => {
      if (!user || !notifPrefs || presetSaving) return;

      const config = PRESET_CONFIG[preset];
      const previousUserPrefs = userPrefs;
      const previousNotifPrefs = notifPrefs;

      setPresetSaving(true);
      setUserPrefs(config.userPrefs);
      setNotifPrefs((prev) => (prev ? { ...prev, ...config.notifPrefs } : prev));

      try {
        await Promise.all([
          supabase.from('user_preferences').upsert({
            user_id: user.id,
            notification_preferences: config.userPrefs,
            updated_at: new Date().toISOString(),
          }),
          NotificationService.updatePreferences(user.id, config.notifPrefs),
        ]);
        prevUserPrefs.current = config.userPrefs;
        prevNotifPrefs.current = {
          ...previousNotifPrefs,
          ...config.notifPrefs,
        };
      } catch (err) {
        logger.error('Failed to apply notification preset', { preset, error: err });
        setUserPrefs(previousUserPrefs);
        setNotifPrefs(previousNotifPrefs);
        showAlert('Error', 'Failed to apply preset. Please try again.');
      } finally {
        setPresetSaving(false);
      }
    },
    [notifPrefs, presetSaving, user, userPrefs],
  );

  // ---------------------------------------------------------------------------
  // QUIET HOURS
  // ---------------------------------------------------------------------------

  const quietHoursEnabled = !!(notifPrefs?.quietHoursStart && notifPrefs?.quietHoursEnd);

  const toggleQuietHours = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        await updateNotifPref({ quietHoursStart: '22:00', quietHoursEnd: '07:00' });
      } else {
        await updateNotifPref({ quietHoursStart: null, quietHoursEnd: null });
      }
    },
    [updateNotifPref],
  );

  const handleNativeTimeChange = useCallback(
    (_event: any, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setActiveTimePicker(null);
      }
      if (!selectedDate || !activeTimePicker) return;

      const timeStr = dateToTimeString(selectedDate);
      if (activeTimePicker === 'start') {
        updateNotifPref({ quietHoursStart: timeStr });
      } else {
        updateNotifPref({ quietHoursEnd: timeStr });
      }

      if (Platform.OS === 'ios') {
        setActiveTimePicker(null);
      }
    },
    [activeTimePicker, updateNotifPref],
  );

  const confirmWebTime = useCallback(() => {
    if (!webTimeInput || !activeTimePicker) return;

    // Validate HH:MM format
    const match = webTimeInput.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      showAlert('Invalid Time', 'Please enter time in HH:MM format (e.g. 22:00).');
      return;
    }
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      showAlert('Invalid Time', 'Hours must be 0-23 and minutes 0-59.');
      return;
    }

    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (activeTimePicker === 'start') {
      updateNotifPref({ quietHoursStart: timeStr });
    } else {
      updateNotifPref({ quietHoursEnd: timeStr });
    }
    setWebTimeInput('');
    setActiveTimePicker(null);
  }, [activeTimePicker, webTimeInput, updateNotifPref]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (loading || !notifPrefs) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={headerOptions} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {/* ── DELIVERY CHANNELS ── */}
        <IOSListSection
          header="DELIVERY CHANNELS"
          footer="Choose how you'd like to receive notifications."
        >
          <IOSListItem
            title="Push Notifications"
            leadingIcon="notifications"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.red}
            trailingAccessory="switch"
            switchValue={notifPrefs.pushEnabled}
            onSwitchChange={(v) => updateNotifPref({ pushEnabled: v })}
          />
          <IOSListItem
            title="Email Notifications"
            leadingIcon="mail"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.blue}
            trailingAccessory="switch"
            switchValue={notifPrefs.emailEnabled}
            onSwitchChange={(v) => updateNotifPref({ emailEnabled: v })}
          />
        </IOSListSection>

        {/* ── ORGANIZATION PRESETS ── */}
        {isClubPersona && (
          <IOSListSection
            header="ORGANIZATION PRESETS"
            footer="Apply a simple notification profile for your workspace role. You can still customize below."
          >
            <IOSListItem
              title="Essential"
              subtitle="Critical reminders, outcomes, and direct/group messages only."
              leadingIcon="flash"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.blue}
              trailingAccessory="badge"
              badgeText={activePreset === 'essential' ? 'active' : 'apply'}
              badgeColor={activePreset === 'essential' ? IOS_COLORS.systemGreen : IOS_COLORS.systemBlue}
              onPress={() => applyPreset('essential')}
              disabled={presetSaving}
            />
            <IOSListItem
              title="Operational"
              subtitle="Adds operational updates and intelligence for day-to-day management."
              leadingIcon="construct"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.orange}
              trailingAccessory="badge"
              badgeText={activePreset === 'operational' ? 'active' : 'apply'}
              badgeColor={activePreset === 'operational' ? IOS_COLORS.systemGreen : IOS_COLORS.systemBlue}
              onPress={() => applyPreset('operational')}
              disabled={presetSaving}
            />
            <IOSListItem
              title="All Notifications"
              subtitle="Enable all activity, social, and operational notifications."
              leadingIcon="checkmark-done"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.purple}
              trailingAccessory="badge"
              badgeText={activePreset === 'all' ? 'active' : 'apply'}
              badgeColor={activePreset === 'all' ? IOS_COLORS.systemGreen : IOS_COLORS.systemBlue}
              onPress={() => applyPreset('all')}
              disabled={presetSaving}
            />
          </IOSListSection>
        )}

        {/* ── EVENT UPDATES ── */}
        <IOSListSection
          header={isSailingCopy ? 'RACING & WEATHER' : 'EVENT UPDATES'}
          footer={
            isSailingCopy
              ? 'Stay informed about upcoming races and conditions on the water.'
              : 'Stay informed about upcoming sessions, outcomes, and key context alerts.'
          }
        >
          <IOSListItem
            title={isSailingCopy ? 'Race Reminders' : isClubPersona ? 'Event Reminders' : 'Session Reminders'}
            leadingIcon="alarm"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.orange}
            trailingAccessory="switch"
            switchValue={userPrefs.race_reminders}
            onSwitchChange={(v) => updateUserPref('race_reminders', v)}
          />
          <IOSListItem
            title={isSailingCopy ? 'Race Results' : isClubPersona ? 'Event Outcome Updates' : 'Outcome Summaries'}
            leadingIcon="trophy"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.yellow}
            trailingAccessory="switch"
            switchValue={userPrefs.race_results}
            onSwitchChange={(v) => updateUserPref('race_results', v)}
          />
          <IOSListItem
            title={isSailingCopy ? 'Weather Alerts' : isClubPersona ? 'Operational Alerts' : 'Context Alerts'}
            leadingIcon="thunderstorm"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.teal}
            trailingAccessory="switch"
            switchValue={userPrefs.weather_alerts}
            onSwitchChange={(v) => updateUserPref('weather_alerts', v)}
          />
        </IOSListSection>

        {/* ── SOCIAL (not organization-admin focused) ── */}
        {!isClubPersona && (
          <IOSListSection
            header="SOCIAL"
            footer="Activity from people you follow and your published updates."
          >
            <IOSListItem
              title="New Followers"
              leadingIcon="person-add"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.blue}
              trailingAccessory="switch"
              switchValue={notifPrefs.newFollower}
              onSwitchChange={(v) => updateNotifPref({ newFollower: v })}
            />
            <IOSListItem
              title={isSailingCopy ? 'Race Activity' : 'Following Activity'}
              leadingIcon="pulse"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.green}
              trailingAccessory="switch"
              switchValue={notifPrefs.followedUserRace}
              onSwitchChange={(v) => updateNotifPref({ followedUserRace: v })}
            />
            <IOSListItem
              title="Likes"
              leadingIcon="heart"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.red}
              trailingAccessory="switch"
              switchValue={notifPrefs.raceLikes}
              onSwitchChange={(v) => updateNotifPref({ raceLikes: v })}
            />
            <IOSListItem
              title="Comments"
              leadingIcon="chatbubble"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.blue}
              trailingAccessory="switch"
              switchValue={notifPrefs.raceComments}
              onSwitchChange={(v) => updateNotifPref({ raceComments: v })}
            />
            <IOSListItem
              title="Achievements"
              leadingIcon="ribbon"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.purple}
              trailingAccessory="switch"
              switchValue={notifPrefs.achievements}
              onSwitchChange={(v) => updateNotifPref({ achievements: v })}
            />
          </IOSListSection>
        )}

        {/* ── MESSAGES ── */}
        <IOSListSection
          header="MESSAGES"
          footer={isSailingCopy ? 'Crew threads and direct messages.' : 'Direct and group messages.'}
        >
          <IOSListItem
            title="Direct Messages"
            leadingIcon="chatbubbles"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.green}
            trailingAccessory="switch"
            switchValue={notifPrefs.directMessages}
            onSwitchChange={(v) => updateNotifPref({ directMessages: v })}
          />
          <IOSListItem
            title={isSailingCopy ? 'Crew & Group Messages' : 'Group Messages'}
            leadingIcon="people"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.teal}
            trailingAccessory="switch"
            switchValue={notifPrefs.groupMessages}
            onSwitchChange={(v) => updateNotifPref({ groupMessages: v })}
          />
          {isSailingCopy && !isClubPersona && (
            <IOSListItem
              title="Fleet Activity"
              leadingIcon="flag"
              leadingIconBackgroundColor={ICON_BACKGROUNDS.orange}
              trailingAccessory="switch"
              switchValue={userPrefs.fleet_activity}
              onSwitchChange={(v) => updateUserPref('fleet_activity', v)}
            />
          )}
        </IOSListSection>

        {/* ── COACHING & LEARNING ── */}
        <IOSListSection
          header="COACHING & LEARNING"
          footer={
            isClubPersona
              ? 'Updates from instructors and workspace intelligence.'
              : 'Updates from coaches and AI-powered insights.'
          }
        >
          <IOSListItem
            title={isClubPersona ? 'Instructor Updates' : 'Coaching Updates'}
            leadingIcon="school"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.purple}
            trailingAccessory="switch"
            switchValue={userPrefs.coaching_updates}
            onSwitchChange={(v) => updateUserPref('coaching_updates', v)}
          />
          <IOSListItem
            title={isSailingCopy ? 'Venue Intelligence' : 'Insights'}
            leadingIcon="analytics"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.blue}
            trailingAccessory="switch"
            switchValue={userPrefs.venue_intelligence}
            onSwitchChange={(v) => updateUserPref('venue_intelligence', v)}
          />
        </IOSListSection>

        {/* ── QUIET HOURS ── */}
        <IOSListSection
          header="QUIET HOURS"
          footer="Silence notifications during these hours. Critical safety alerts will still come through."
        >
          <IOSListItem
            title="Enable Quiet Hours"
            leadingIcon="moon"
            leadingIconBackgroundColor={ICON_BACKGROUNDS.purple}
            trailingAccessory="switch"
            switchValue={quietHoursEnabled}
            onSwitchChange={toggleQuietHours}
          />
          {quietHoursEnabled && (
            <>
              <IOSListItem
                title="Start Time"
                leadingIcon="time"
                leadingIconBackgroundColor={ICON_BACKGROUNDS.gray}
                trailingAccessory="none"
                trailingComponent={
                  <Text style={styles.timeValueText}>
                    {formatTime(notifPrefs.quietHoursStart)}
                  </Text>
                }
                onPress={() => {
                  setWebTimeInput(notifPrefs.quietHoursStart || '22:00');
                  setActiveTimePicker('start');
                }}
              />
              <IOSListItem
                title="End Time"
                leadingIcon="time"
                leadingIconBackgroundColor={ICON_BACKGROUNDS.gray}
                trailingAccessory="none"
                trailingComponent={
                  <Text style={styles.timeValueText}>
                    {formatTime(notifPrefs.quietHoursEnd)}
                  </Text>
                }
                onPress={() => {
                  setWebTimeInput(notifPrefs.quietHoursEnd || '07:00');
                  setActiveTimePicker('end');
                }}
              />
            </>
          )}
        </IOSListSection>
      </ScrollView>

      {/* ── Native Time Picker ── */}
      {activeTimePicker && Platform.OS !== 'web' && DateTimePicker && (
        <DateTimePicker
          value={parseTimeToDate(
            activeTimePicker === 'start'
              ? notifPrefs.quietHoursStart
              : notifPrefs.quietHoursEnd,
          )}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleNativeTimeChange}
        />
      )}

      {/* ── Web Time Picker Modal ── */}
      {activeTimePicker && Platform.OS === 'web' && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveTimePicker(null)}
        >
          <TouchableOpacity
            style={styles.webPickerOverlay}
            activeOpacity={1}
            onPress={() => setActiveTimePicker(null)}
          >
            <View
              style={styles.webPickerContainer}
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.webPickerTitle}>
                {activeTimePicker === 'start' ? 'Start Time' : 'End Time'}
              </Text>
              <TextInput
                style={styles.webPickerInput}
                value={webTimeInput}
                onChangeText={setWebTimeInput}
                placeholder="HH:MM (24h format)"
                autoFocus
                onSubmitEditing={confirmWebTime}
              />
              <View style={styles.webPickerButtons}>
                <TouchableOpacity
                  style={styles.webPickerCancelButton}
                  onPress={() => {
                    setWebTimeInput('');
                    setActiveTimePicker(null);
                  }}
                >
                  <Text style={styles.webPickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.webPickerConfirmButton}
                  onPress={confirmWebTime}
                >
                  <Text style={styles.webPickerConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

// =============================================================================
// STYLES
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
  timeValueText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.systemBlue,
  },
  // Web time picker modal
  webPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: IOS_SPACING.xl,
    width: 300,
  },
  webPickerTitle: {
    ...IOS_TYPOGRAPHY.headline,
    marginBottom: IOS_SPACING.md,
    textAlign: 'center',
  },
  webPickerInput: {
    ...IOS_TYPOGRAPHY.body,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    borderRadius: 8,
    padding: IOS_SPACING.md,
    textAlign: 'center',
    marginBottom: IOS_SPACING.lg,
  },
  webPickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  webPickerCancelButton: {
    flex: 1,
    paddingVertical: IOS_SPACING.md,
    marginRight: IOS_SPACING.sm,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
  },
  webPickerCancelText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.systemRed,
  },
  webPickerConfirmButton: {
    flex: 1,
    paddingVertical: IOS_SPACING.md,
    marginLeft: IOS_SPACING.sm,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
  },
  webPickerConfirmText: {
    ...IOS_TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
