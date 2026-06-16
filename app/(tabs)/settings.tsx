/**
 * Settings Screen
 *
 * For non-club users, redirects to the unified Account modal at /account.
 * Club users see the full settings screen for club administration.
 */

import { ClubAiAssistant } from '@/components/ai/ClubAiAssistant';
import { TeamSeatManager } from '@/components/subscription/TeamSeatManager';
import { useUserSettings, UNIT_SHORT_LABELS } from '@/hooks/useUserSettings';
import { useAuth } from '@/providers/AuthProvider';
import { createSailorSampleData } from '@/services/onboarding/SailorSampleDataService';
import { supabase } from '@/services/supabase';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { router, Redirect } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { user, userProfile, clubProfile, signOut, updateUserProfile, isDemoSession } = useAuth();
  const resolvedClubId = (clubProfile as any)?.yacht_club_id || clubProfile?.id || null;
  const { settings: userSettings } = useUserSettings();
  const [claimVisible, setClaimVisible] = useState(false);
  const [claimPassword, setClaimPassword] = useState('');
  const [claimPasswordConfirm, setClaimPasswordConfirm] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [resetSampleLoading, setResetSampleLoading] = useState(false);
  const [teamManagerVisible, setTeamManagerVisible] = useState(false);
  const [allowFollowerSharing, setAllowFollowerSharing] = useState(true);
  const [sharingSettingLoading, setSharingSettingLoading] = useState(false);

  // Load follower sharing setting on mount
  useEffect(() => {
    async function loadFollowerSharingSetting() {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from('sailor_profiles')
          .select('allow_follower_sharing')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          setAllowFollowerSharing(data.allow_follower_sharing ?? true);
        }
      } catch (error) {
        console.error('[Settings] Error loading follower sharing setting:', error);
      }
    }

    loadFollowerSharingSetting();
  }, [user?.id]);

  // Save follower sharing setting
  const applyFollowerSharing = async (value: boolean) => {
    setAllowFollowerSharing(value);
    setSharingSettingLoading(true);

    try {
      const { error } = await supabase
        .from('sailor_profiles')
        .update({ allow_follower_sharing: value })
        .eq('user_id', user?.id);

      if (error) {
        console.error('[Settings] Error saving follower sharing setting:', error);
        setAllowFollowerSharing(!value);
        showAlert('Error', 'Failed to save privacy setting. Please try again.');
      }
    } catch (error) {
      console.error('[Settings] Exception saving follower sharing setting:', error);
      setAllowFollowerSharing(!value);
    } finally {
      setSharingSettingLoading(false);
    }
  };

  const handleFollowerSharingChange = (value: boolean) => {
    if (value) {
      showConfirm(
        'Share with Followers',
        'Your preparation notes will be visible to people who follow you.',
        () => applyFollowerSharing(true),
      );
    } else {
      applyFollowerSharing(false);
    }
  };

  // Check if user has a team subscription
  const isTeamSubscriber = userProfile?.subscription_tier === 'team';

  const isDemoProfile = useMemo(
    () =>
      isDemoSession || (userProfile?.onboarding_step ?? '').toString().startsWith('demo'),
    [isDemoSession, userProfile?.onboarding_step]
  );

  // Redirect non-club users to the unified Account modal
  // Club users continue to see the full settings screen for club administration
  if (userProfile?.user_type !== 'club') {
    return <Redirect href="/account" />;
  }

  const handleSignOut = async () => {
    const doSignOut = async () => {
      try {
        await signOut();
        // AuthProvider will handle navigation via auth state change - no need for manual redirect
      } catch (error) {
        console.error('[SETTINGS] Fallback sign out error:', error);
        showAlert('Error', 'Failed to sign out. Please try again.');
      }
    };

    showConfirm(
      'Sign Out',
      'Are you sure you want to sign out?',
      doSignOut,
      { destructive: true, confirmText: 'Sign Out' }
    );
  };

  const handleClaimWorkspace = async () => {
    if (claimPassword.length < 6) {
      showAlert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    if (claimPassword !== claimPasswordConfirm) {
      showAlert('Mismatch', 'Passwords do not match.');
      return;
    }

    const fallbackEmail =
      userProfile?.email ||
      user?.email ||
      `regatta-${user?.id ?? 'demo'}@demo.regattaflow.io`;

    setClaimLoading(true);
    try {
      const updatePayload: {
        email?: string;
        password: string;
        data?: Record<string, unknown>;
      } = {
        password: claimPassword,
        data: {
          full_name: userProfile?.full_name || undefined,
          name: userProfile?.full_name || undefined,
        },
      };

      if (!user?.email && fallbackEmail) {
        updatePayload.email = fallbackEmail;
      }

      const { error } = await supabase.auth.updateUser(updatePayload);
      if (error) {
        throw error;
      }

      await updateUserProfile({
        onboarding_step: 'claimed',
        demo_converted_at: new Date().toISOString(),
      });

      showAlertWithButtons(
        'Workspace claimed',
        'Your password is set. Check your email for any verification requests.',
        [{ text: 'Great!', onPress: () => setClaimVisible(false) }]
      );
    } catch (error: any) {
      console.error('[Settings] Claim workspace error:', error);
      showAlert(
        'Unable to claim workspace',
        error?.message || 'Please try again or contact support.'
      );
    } finally {
      setClaimLoading(false);
      setClaimPassword('');
      setClaimPasswordConfirm('');
    }
  };

  const handleResetSampleData = async () => {
    showConfirm(
      'Reset Sample Data',
      'This will create sample races to help you explore the app. Any existing sample races will remain.',
      async () => {
        setResetSampleLoading(true);
        try {
          const result = await createSailorSampleData({
            userId: user!.id,
            userName: userProfile?.full_name || 'Sailor',
            force: true,
          });
          if (result.success) {
            showAlert('Success', 'Sample races have been created! Check your races list.');
          } else {
            showAlert('Error', result.error || 'Failed to create sample data.');
          }
        } catch (error: any) {
          console.error('[Settings] Reset sample data error:', error);
          showAlert('Error', 'Failed to create sample data. Please try again.');
        } finally {
          setResetSampleLoading(false);
        }
      },
      { confirmText: 'Create' }
    );
  };

  // Strava-style section header component
  const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title.toUpperCase()}</Text>
    </View>
  );

  const SettingItem = ({
    icon,
    title,
    subtitle,
    rightValue,
    onPress,
    showArrow = true,
    danger = false,
    loading = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    rightValue?: string;
    onPress?: () => void;
    showArrow?: boolean;
    danger?: boolean;
    loading?: boolean;
  }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={loading}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, danger && styles.dangerIcon]}>
          <Ionicons name={icon} size={20} color={danger ? '#EF4444' : '#3B82F6'} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingRight}>
        {loading && <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 8 }} />}
        {rightValue && !loading && <Text style={styles.rightValue}>{rightValue}</Text>}
        {showArrow && <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your account and preferences</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={32} color="#FFFFFF" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userProfile?.full_name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <Text style={styles.profileType}>
              {userProfile?.user_type?.charAt(0).toUpperCase() + userProfile?.user_type?.slice(1) || 'Sailor'}
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <SectionHeader title="Account" />

        {/* Prominent Subscription Card */}
        <TouchableOpacity style={styles.subscriptionCard} onPress={() => router.push('/subscription')}>
          <View style={styles.subscriptionIcon}>
            <Ionicons name="boat" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionTitle}>Your BetterAt Plan</Text>
            <Text style={styles.subscriptionSubtitle}>Explore and manage your subscription</Text>
          </View>
          <View style={styles.subscriptionBadge}>
            <Text style={styles.subscriptionBadgeText}>
              {userProfile?.subscription_status === 'trialing' ? 'Pro Trial'
                : userProfile?.subscription_tier === 'individual' ? 'Pro'
                : userProfile?.subscription_tier?.charAt(0).toUpperCase() + userProfile?.subscription_tier?.slice(1) || 'Free'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.settingsGroupNoPadding}>
          {!userProfile?.onboarding_completed && userProfile?.user_type === 'sailor' && (
            <SettingItem
              icon="checkmark-circle-outline"
              title="Complete Onboarding"
              subtitle="Finish setting up your sailing profile"
              onPress={() => router.push('/(auth)/sailor-onboarding-comprehensive')}
              showArrow
            />
          )}
          {isDemoProfile && (
            <SettingItem
              icon="flag-outline"
              title="Claim Workspace"
              subtitle="Set a password and keep your data"
              onPress={() => setClaimVisible(true)}
              showArrow
            />
          )}
          <SettingItem
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your personal information"
            onPress={() => router.push('/settings/edit-profile')}
            showArrow
          />
          <SettingItem
            icon="key-outline"
            title="Change Password"
            subtitle="Update your password"
            onPress={() => router.push('/settings/change-password')}
            showArrow
          />
          {isTeamSubscriber && (
            <SettingItem
              icon="people-outline"
              title="Manage Team"
              subtitle="Invite members and manage your team"
              onPress={() => setTeamManagerVisible(true)}
              showArrow
            />
          )}
          <SettingItem
            icon="bluetooth-outline"
            title="Connected Devices"
            subtitle="GPS, sensors, and wearable integrations"
            onPress={() => router.push('/settings/connected-devices')}
            showArrow
          />
          {userProfile?.user_type === 'sailor' && (
            <SettingItem
              icon="refresh-outline"
              title="Reset Sample Data"
              subtitle="Recreate sample races for exploring the app"
              onPress={handleResetSampleData}
              loading={resetSampleLoading}
            />
          )}
        </View>

        {/* My Learning */}
        {userProfile?.user_type === 'sailor' && (
          <>
            <SectionHeader title="My Learning" />
            <View style={styles.settingsGroupNoPadding}>
              <SettingItem
                icon="analytics-outline"
                title="Race Learning Insights"
                subtitle="View personalized coaching and practice recommendations"
                onPress={() => router.push('/my-learning')}
                showArrow
              />
            </View>
          </>
        )}

        {/* Preferences Section */}
        <SectionHeader title="Preferences" />
        <View style={styles.settingsGroupNoPadding}>
          <SettingItem
            icon="speedometer-outline"
            title="Units of Measurement"
            subtitle="Distance and speed display format"
            rightValue={UNIT_SHORT_LABELS[userSettings.units]}
            onPress={() => router.push('/settings/units')}
            showArrow
          />
          <SettingItem
            icon="notifications-outline"
            title="Notifications"
            subtitle="Configure your notification preferences"
            onPress={() => router.push('/settings/notifications')}
            showArrow
          />
        </View>

        {/* Privacy & Sharing */}
        {userProfile?.user_type === 'sailor' && (
          <>
            <SectionHeader title="Privacy & Sharing" />
            <View style={styles.settingsGroupNoPadding}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="people-outline" size={20} color="#3B82F6" />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>Share race prep with followers</Text>
                    <Text style={styles.settingSubtitle}>
                      {allowFollowerSharing
                        ? 'Followers can see your race preparation notes'
                        : 'Your race prep is private'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={allowFollowerSharing}
                  onValueChange={handleFollowerSharingChange}
                  trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
                  thumbColor="#FFFFFF"
                  disabled={sharingSettingLoading}
                />
              </View>
            </View>
          </>
        )}

        {/* Club Assistant */}
        <SectionHeader title="Club Assistant" />
        <View style={styles.aiSection}>
          <Text style={styles.aiSectionHelper}>
            Draft communications, plan events, or answer member questions using your club data.
          </Text>
          <ClubAiAssistant
            clubId={resolvedClubId}
            compact
            style={styles.aiAssistantContainer}
          />
        </View>

        {/* Support */}
        <SectionHeader title="Support" />
        <View style={styles.settingsGroupNoPadding}>
          <SettingItem
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Get help and contact support"
            onPress={() => showAlert('Support', 'Email us at support@regattaflow.com')}
          />
          <SettingItem
            icon="document-text-outline"
            title="Privacy Policy"
            subtitle="Read our privacy policy"
            onPress={() => router.push('/privacy')}
            showArrow
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Terms of Service"
            subtitle="Read our terms of service"
            onPress={() => router.push('/terms')}
            showArrow
          />
        </View>

        {/* Account Actions */}
        <SectionHeader title="Account Actions" />
        <View style={styles.settingsGroupNoPadding}>
          <SettingItem
            icon="log-out-outline"
            title="Sign Out"
            subtitle="Sign out of your account"
            onPress={handleSignOut}
            showArrow={false}
            danger={true}
          />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>BetterAt v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          <Text style={styles.appInfoText}>© {new Date().getFullYear()} BetterAt Inc.</Text>
        </View>
      </ScrollView>

      {/* Team Manager Modal */}
      <Modal
        visible={teamManagerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTeamManagerVisible(false)}
      >
        <TeamSeatManager onClose={() => setTeamManagerVisible(false)} />
      </Modal>

      <Modal
        visible={claimVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!claimLoading) {
            setClaimVisible(false);
            setClaimPassword('');
            setClaimPasswordConfirm('');
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Claim Your Workspace</Text>
            <Text style={styles.modalSubtitle}>
              Set a password so you can sign back in and keep the progress you’ve made in demo mode.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="New password (min 6 characters)"
              secureTextEntry
              value={claimPassword}
              onChangeText={setClaimPassword}
              editable={!claimLoading}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Confirm password"
              secureTextEntry
              value={claimPasswordConfirm}
              onChangeText={setClaimPasswordConfirm}
              editable={!claimLoading}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  if (!claimLoading) {
                    setClaimVisible(false);
                    setClaimPassword('');
                    setClaimPasswordConfirm('');
                  }
                }}
                disabled={claimLoading}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleClaimWorkspace}
                disabled={claimLoading}
              >
                {claimLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Set Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  aiSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  aiSectionHelper: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  aiAssistantContainer: {
    minHeight: 360,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: '0px 1px',
    elevation: 1,
    gap: 16,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  profileType: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  settingsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    boxShadow: '0px 1px',
    elevation: 1,
  },
  settingsGroupNoPadding: {
    backgroundColor: '#FFFFFF',
  },
  subscriptionCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  subscriptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  subscriptionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  subscriptionBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subscriptionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIcon: {
    backgroundColor: '#FEF2F2',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  dangerText: {
    color: '#EF4444',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightValue: {
    fontSize: 15,
    color: '#6B7280',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  appInfoText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#E2E8F0',
  },
  modalButtonSecondaryText: {
    color: '#1E293B',
    fontWeight: '600',
  },
  modalButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
