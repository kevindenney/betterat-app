/**
 * AccountModalContent
 *
 * Apple HIG-style unified account & settings screen presented as a modal.
 * Uses inset grouped IOSListSections with IOSListItems.
 * Merges functionality from both Account and Settings screens.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeamSeatManager } from '@/components/subscription/TeamSeatManager';
import { HomeVenuePickerSheet } from '@/components/discover/HomeVenuePickerSheet';
import { useUserSettings, UNIT_SHORT_LABELS } from '@/hooks/useUserSettings';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { getSafeImageUri } from '@/lib/utils/safeImageUri';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { supabase } from '@/services/supabase';

import { IOSListItem } from '@/components/ui/ios/IOSListItem';
import { IOSListSection } from '@/components/ui/ios/IOSListSection';
import { TourPricingCard } from '@/components/onboarding/TourPricingCard';
import { accountStyles, getInitials } from './accountStyles';

export default function AccountModalContent() {
  const { user, userProfile, updateUserProfile, isDemoSession, capabilities, coachProfile, removeCapability } = useAuth();
  const { currentInterest } = useInterest();
  const { activeDomain } = useOrganization();
  const { vocab } = useVocabulary();
  const profileMenu = useProfileMenuData();
  const homeVenue = useUserHomeVenue();
  // User settings (tips, learning links, units)
  const { settings: userSettings } = useUserSettings(currentInterest?.slug);
  const insets = useSafeAreaInsets();

  // State
  const [claimVisible, setClaimVisible] = useState(false);
  const [claimPassword, setClaimPassword] = useState('');
  const [claimPasswordConfirm, setClaimPasswordConfirm] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  // Settings-related state
  const [pricingVisible, setPricingVisible] = useState(false);
  const [teamManagerVisible, setTeamManagerVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);

  // Derived state
  const isDemoProfile = useMemo(
    () => isDemoSession || (userProfile?.onboarding_step ?? '').toString().startsWith('demo'),
    [isDemoSession, userProfile?.onboarding_step]
  );

  const subscriptionTier = useMemo(() => {
    const tier = userProfile?.subscription_tier || 'free';
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }, [userProfile?.subscription_tier]);

  // Check if user has a team subscription
  const isTeamSubscriber = userProfile?.subscription_tier === 'team';
  const interestSlug = String(currentInterest?.slug || '').toLowerCase();
  const isSailingInterest = interestSlug === 'sail-racing' || interestSlug.includes('sail');
  const showOrganizationAccessSetting =
    activeDomain === 'nursing' || String(currentInterest?.slug || '').toLowerCase() === 'nursing';

  // Load Telegram link status
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('telegram_links')
      .select('telegram_username, linked_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.linked_at) {
          setTelegramLinked(true);
          setTelegramUsername(data.telegram_username);
        } else {
          setTelegramLinked(false);
        }
      });
  }, [user?.id]);

  // Handlers
  const handleClaimWorkspace = useCallback(async () => {
    if (claimPassword.length < 6) {
      showAlert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (claimPassword !== claimPasswordConfirm) {
      showAlert('Mismatch', 'Passwords do not match.');
      return;
    }

    const fallbackEmail =
      userProfile?.email || user?.email || `regatta-${user?.id ?? 'demo'}@demo.regattaflow.io`;

    setClaimLoading(true);
    try {
      const updatePayload: { email?: string; password: string; data?: Record<string, unknown> } = {
        password: claimPassword,
        data: { full_name: userProfile?.full_name || undefined },
      };
      if (!user?.email && fallbackEmail) {
        updatePayload.email = fallbackEmail;
      }

      const { error } = await supabase.auth.updateUser(updatePayload);
      if (error) throw error;

      await updateUserProfile({
        onboarding_step: 'claimed',
        demo_converted_at: new Date().toISOString(),
      });

      showAlert('Workspace claimed', 'Your password is set.');
      setClaimVisible(false);
    } catch (error: any) {
      showAlert('Unable to claim workspace', error?.message || 'Please try again.');
    } finally {
      setClaimLoading(false);
      setClaimPassword('');
      setClaimPasswordConfirm('');
    }
  }, [claimPassword, claimPasswordConfirm, user, userProfile, updateUserProfile]);

  const handleDone = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/races');
    }
  }, []);

  const handleDeleteAccount = useCallback(() => {
    showConfirm(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      async () => {
        router.push('/settings/delete-account');
      },
      { destructive: true, confirmText: 'Continue' }
    );
  }, []);

  // ── Trailing value component helper ──────────────────────────────
  const trailingValue = (text: string) => (
    <Text style={accountStyles.trailingValueText}>{text}</Text>
  );

  // Early return for unauthenticated - show sign-in options
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={styles.dragHandle} />
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }} />
            <Text style={styles.headerTitle} testID="account-modal-title">Account</Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <TouchableOpacity onPress={handleDone} hitSlop={8}>
                <Text style={styles.doneButton}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="person-circle-outline" size={64} color={IOS_COLORS.systemGray3} style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 20, fontWeight: '600', color: IOS_COLORS.label, marginBottom: 8 }}>
            Sign In
          </Text>
          <Text style={{ fontSize: 14, color: IOS_COLORS.secondaryLabel, textAlign: 'center', marginBottom: 24 }}>
            Sign in to manage your account, track your races, and sync across devices.
          </Text>
          <TouchableOpacity
            testID="account-sign-in-button"
            style={{
              backgroundColor: IOS_COLORS.systemBlue,
              paddingVertical: 14,
              paddingHorizontal: 32,
              borderRadius: 12,
              marginBottom: 12,
              minWidth: 200,
              alignItems: 'center',
            }}
            onPress={() => {
              handleDone();
              router.push('/(auth)/login');
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="account-create-account-button"
            style={{
              paddingVertical: 12,
              paddingHorizontal: 32,
            }}
            onPress={() => {
              handleDone();
              router.push('/(auth)/signup');
            }}
          >
            <Text style={{ color: IOS_COLORS.systemBlue, fontSize: 16, fontWeight: '500' }}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Modal Header: drag handle + Done button */}
      <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.dragHandle} />
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <Text style={styles.headerTitle} testID="account-modal-title">Account</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <TouchableOpacity onPress={handleDone} hitSlop={8}>
              <Text style={styles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={accountStyles.scrollContent}
      >
        {/* ── Profile Pointer ──────────────────────────────────── */}
        <IOSListSection>
          <IOSListItem
            title={userProfile?.full_name || 'User'}
            subtitle="Public profile & photo — edit in one place"
            leadingComponent={
              <ProfileAvatar
                name={userProfile?.full_name || user?.email || 'User'}
                avatarUrl={userProfile?.avatar_url}
              />
            }
            trailingAccessory="chevron"
            onPress={() => router.push('/settings/public-face')}
          />
        </IOSListSection>

        {/* ── Practice ─────────────────────────────────────────── */}
        <IOSListSection header="Practice">
          {isSailingInterest && (
            <IOSListItem
              title="Boats & gear"
              subtitle="Moved to your interest card"
              leadingIcon="boat-outline"
              leadingIconColor={IOS_COLORS.secondaryLabel}
              trailingAccessory="chevron"
              onPress={() => router.push('/(tabs)/library?zone=interests')}
            />
          )}
          <IOSListItem
            title="Location"
            leadingIcon="location-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingComponent={trailingValue(
              homeVenue?.venue || userProfile?.home_venue || userProfile?.home_club || 'Not set',
            )}
            onPress={() => setLocationPickerVisible(true)}
          />
          <IOSListItem
            title="Subscribed blueprints"
            leadingIcon="git-branch-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingComponent={trailingValue(String(profileMenu.counts.subscribedBlueprints))}
            onPress={() => router.push('/(tabs)/library?zone=plans')}
          />
        </IOSListSection>

        {/* ── Subscription ─────────────────────────────────────── */}
        <IOSListSection header="Subscription">
          <IOSListItem
            title="Plan"
            leadingIcon="star-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingAccessory="none"
            trailingComponent={trailingValue(
              userProfile?.subscription_tier && userProfile.subscription_tier !== 'free'
                ? `${subscriptionTier} · ${userProfile?.subscription_status === 'active' ? 'Active' : 'Expired'}`
                : `${subscriptionTier} Plan`
            )}
          />
          {userProfile?.subscription_tier === 'free' ? (
            <IOSListItem
              title="Plans & Pricing"
              leadingIcon="pricetags-outline"
              leadingIconColor={IOS_COLORS.secondaryLabel}
              trailingAccessory="chevron"
              onPress={() => setPricingVisible(true)}
            />
          ) : (
            <IOSListItem
              title="Manage Subscription"
              leadingIcon="arrow-up-circle-outline"
              leadingIconColor={IOS_COLORS.secondaryLabel}
              trailingAccessory="chevron"
              onPress={() => router.push('/subscription')}
            />
          )}
        </IOSListSection>

        {/* ── General ──────────────────────────────────────────── */}
        <IOSListSection header="General">
          <IOSListItem
            title="Units"
            leadingIcon="speedometer-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingComponent={trailingValue(UNIT_SHORT_LABELS[userSettings.units])}
            onPress={() => router.push('/settings/units')}
          />
          <IOSListItem
            title="Notification Preferences"
            leadingIcon="notifications-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingAccessory="chevron"
            onPress={() => router.push('/settings/notifications')}
          />
          <IOSListItem
            title="Connected services"
            subtitle="Telegram assistant"
            leadingIcon="paper-plane-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingAccessory={telegramLinked ? 'none' : 'chevron'}
            trailingComponent={
              telegramLinked
                ? trailingValue(telegramUsername ? `@${telegramUsername}` : 'Connected')
                : telegramLinked === false
                  ? trailingValue('Connect')
                  : undefined
            }
            onPress={() => {
              if (telegramLinked) {
                router.push('/settings/telegram');
              } else {
                const botUsername = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || 'betterat_bot';
                Linking.openURL(`https://t.me/${botUsername}`);
              }
            }}
          />
        </IOSListSection>

        {/* ── Organization Access (institutional orgs only) ────── */}
        {showOrganizationAccessSetting && (
          <IOSListSection header="Interests">
            <IOSListItem
              title="Organization Access"
              leadingIcon="business-outline"
              leadingIconColor={IOS_COLORS.secondaryLabel}
              trailingAccessory="chevron"
              onPress={() => router.push('/settings/organization-access')}
            />
          </IOSListSection>
        )}

        {/* ── Privacy & Security ──────────────────────────────── */}
        <IOSListSection header="Privacy & Security">
          <IOSListItem
            title="Public Face"
            subtitle="Profile, interests, visibility, and interactions"
            leadingIcon="shield-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingAccessory="chevron"
            onPress={() => router.push('/settings/public-face')}
          />
          <IOSListItem
            title="Change Password"
            leadingIcon="lock-closed-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingAccessory="chevron"
            onPress={() => router.push('/settings/change-password')}
          />
          {isTeamSubscriber && (
            <IOSListItem
              title="Manage Team"
              leadingIcon="people-outline"
              leadingIconColor={IOS_COLORS.secondaryLabel}
              trailingAccessory="chevron"
              onPress={() => setTeamManagerVisible(true)}
            />
          )}
          {isDemoProfile && (
            <IOSListItem
              title="Claim Workspace"
              leadingIcon="key-outline"
              leadingIconColor={IOS_COLORS.secondaryLabel}
              trailingAccessory="chevron"
              onPress={() => setClaimVisible(true)}
            />
          )}
          {!userProfile?.onboarding_completed && userProfile?.user_type === 'sailor' && (
            <IOSListItem
              title="Complete Onboarding"
              leadingIcon="checkmark-circle-outline"
              leadingIconColor={IOS_COLORS.secondaryLabel}
              trailingAccessory="chevron"
              onPress={() => router.push('/(auth)/sailor-onboarding-comprehensive')}
            />
          )}
        </IOSListSection>

        {/* ── Coaching (only for users who already coach) ──────── */}
        {(capabilities?.hasCoaching || coachProfile) && (
          <IOSListSection header="Coaching">
            {(capabilities?.hasCoaching || coachProfile?.profile_published) ? (
              <>
                <IOSListItem
                  title="Coach Dashboard"
                  leadingIcon="easel-outline"
                  leadingIconColor={IOS_COLORS.secondaryLabel}
                  trailingAccessory="chevron"
                  onPress={() => router.push('/(tabs)/coaching')}
                />
                <IOSListItem
                  title="Edit Coach Profile"
                  leadingIcon="person-circle-outline"
                  leadingIconColor={IOS_COLORS.secondaryLabel}
                  trailingAccessory="chevron"
                  onPress={() => router.push('/coach/profile-edit')}
                />
              </>
            ) : (
              // Has coach profile but not published - show resume onboarding
              <IOSListItem
                title="Complete Coach Setup"
                leadingIcon="school-outline"
                leadingIconColor={IOS_COLORS.secondaryLabel}
                trailingAccessory="chevron"
                onPress={() => router.push('/(auth)/coach-onboarding-profile-preview')}
              />
            )}
          </IOSListSection>
        )}

        {/* ── Mentoring (only for users who already mentor) ────── */}
        {capabilities?.hasMentoring && (
          <IOSListSection
            header="Mentoring"
            footer={`Other ${vocab('Peers')} see a MENTOR badge next to your name when they add people to a step.`}
          >
            <IOSListItem
              title="Stop offering mentoring"
              leadingIcon="people-outline"
              leadingIconColor={IOS_COLORS.secondaryLabel}
              trailingAccessory="none"
              onPress={() => {
                showConfirm(
                  'Stop mentoring?',
                  'You can turn this back on anytime. Existing mentor badges on others’ timelines will disappear.',
                  async () => {
                    try {
                      await removeCapability('mentoring');
                    } catch {
                      showAlert('Error', 'Could not update mentoring status. Please try again.');
                    }
                  },
                  { destructive: true },
                );
              }}
            />
          </IOSListSection>
        )}

        {/* ── Support ─────────────────────────────────────────── */}
        <IOSListSection header="Support">
          <IOSListItem
            title="Help & Support"
            leadingIcon="help-circle-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingAccessory="chevron"
            onPress={() => showAlert('Support', 'Email us at info@better.at')}
          />
          <IOSListItem
            title="Privacy Policy"
            leadingIcon="document-text-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingAccessory="chevron"
            onPress={() => router.push('/privacy')}
          />
          <IOSListItem
            title="Terms of Service"
            leadingIcon="shield-checkmark-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            trailingAccessory="chevron"
            onPress={() => router.push('/terms')}
          />
        </IOSListSection>

        {/* ── Account ──────────────────────────────────────────── */}
        <IOSListSection header="Account">
          <IOSListItem
            title="Delete Account"
            leadingIcon="trash-outline"
            leadingIconColor={IOS_COLORS.secondaryLabel}
            titleStyle={accountStyles.signOutText}
            trailingAccessory="chevron"
            onPress={handleDeleteAccount}
          />
        </IOSListSection>

        {/* ── App Info Footer ──────────────────────────────────── */}
        <View style={accountStyles.appInfo}>
          <Text style={accountStyles.appInfoText}>BetterAt v1.0.0</Text>
          <Text style={accountStyles.appInfoText}>© {new Date().getFullYear()} BetterAt Inc.</Text>
        </View>
      </ScrollView>

      {/* Plans & Pricing Modal */}
      <Modal
        visible={pricingVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPricingVisible(false)}
      >
        <TourPricingCard
          visible={pricingVisible}
          standalone={false}
          onStartTrial={() => {
            setPricingVisible(false);
            router.push('/subscription');
          }}
          onContinueFree={() => setPricingVisible(false)}
          onClose={() => setPricingVisible(false)}
        />
      </Modal>

      {/* Team Manager Modal */}
      <Modal
        visible={teamManagerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTeamManagerVisible(false)}
      >
        <TeamSeatManager onClose={() => setTeamManagerVisible(false)} />
      </Modal>

      <HomeVenuePickerSheet
        visible={locationPickerVisible}
        onDismiss={() => setLocationPickerVisible(false)}
      />

      {/* Claim Workspace Modal */}
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
        <View style={accountStyles.modalOverlay}>
          <View style={accountStyles.modalContent}>
            <View style={accountStyles.claimModalHeader}>
              <Text style={accountStyles.claimModalTitle}>Claim Your Workspace</Text>
              <TouchableOpacity
                style={accountStyles.claimModalCloseButton}
                onPress={() => {
                  if (!claimLoading) {
                    setClaimVisible(false);
                    setClaimPassword('');
                    setClaimPasswordConfirm('');
                  }
                }}
              >
                <Ionicons name="close" size={24} color={IOS_COLORS.systemGray} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: IOS_COLORS.secondaryLabel, marginBottom: 16 }}>
              Set a password so you can sign back in and keep your progress.
            </Text>

            <View style={accountStyles.formGroup}>
              <Text style={accountStyles.formLabel}>Password</Text>
              <TextInput
                style={accountStyles.formInput}
                placeholder="Min 6 characters"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                secureTextEntry
                value={claimPassword}
                onChangeText={setClaimPassword}
                editable={!claimLoading}
              />
            </View>

            <View style={accountStyles.formGroup}>
              <Text style={accountStyles.formLabel}>Confirm Password</Text>
              <TextInput
                style={accountStyles.formInput}
                placeholder="Confirm password"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                secureTextEntry
                value={claimPasswordConfirm}
                onChangeText={setClaimPasswordConfirm}
                editable={!claimLoading}
              />
            </View>

            <TouchableOpacity
              style={accountStyles.primaryButton}
              onPress={handleClaimWorkspace}
              disabled={claimLoading}
            >
              {claimLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={accountStyles.primaryButtonText}>Set Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ProfileAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const safeAvatarUrl = getSafeImageUri(avatarUrl);

  if (safeAvatarUrl) {
    return <Image source={{ uri: safeAvatarUrl }} style={styles.profilePointerAvatar} />;
  }

  return (
    <View style={styles.profilePointerAvatar}>
      <Text style={styles.profilePointerAvatarText}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  modalHeader: {
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: IOS_COLORS.systemGray4,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  doneButton: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  profilePointerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePointerAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
