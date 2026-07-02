/**
 * Coach Onboarding - Payment Setup (Step 5 of 5)
 *
 * Tufte-inspired design with clean iOS styling
 * Single-focus Stripe Connect flow
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  StyleSheet,
  Platform,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCoachOnboardingState } from '@/hooks/useCoachOnboardingState';
import { useAuth } from '@/providers/AuthProvider';
import { StripeConnectService } from '@/services/StripeConnectService';
import { supabase } from '@/services/supabase';

// Design tokens (consistent with other screens)
const COLORS = {
  primary: '#007AFF',
  primaryLight: '#E5F1FF',
  background: '#F2F2F7',
  card: '#FFFFFF',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#8E8E93',
  separator: '#C6C6C8',
  success: '#34C759',
  warning: '#FF9500',
  selected: '#007AFF',
  selectedBg: '#007AFF',
  unselected: '#E5E5EA',
  border: '#D1D1D6',
};

const STEP_COUNT = 5;
const CURRENT_STEP = 5;

type PaymentSetupStatus = 'not_started' | 'in_progress' | 'complete' | 'error';

const getPublicAppUrl = () =>
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : 'https://better.at';

const CoachOnboardingPaymentSetup = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { state, updatePaymentSetup, loading } = useCoachOnboardingState();

  const [setupStatus, setSetupStatus] = useState<PaymentSetupStatus>('not_started');
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [coachProfileId, setCoachProfileId] = useState<string | null>(null);

  useEffect(() => {
    checkStripeStatus();
  }, [user]);

  const checkStripeStatus = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('coach_profiles')
        .select('id, stripe_account_id, stripe_onboarding_complete, stripe_onboarding_skipped')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setCoachProfileId(profile.id);

        if (profile.stripe_onboarding_complete) {
          setSetupStatus('complete');
          setStripeStatus({
            connected: true,
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
          });
        } else if (profile.stripe_account_id) {
          const status = await StripeConnectService.getConnectStatus(profile.id);
          setStripeStatus({
            connected: status.connected,
            chargesEnabled: status.chargesEnabled || false,
            payoutsEnabled: status.payoutsEnabled || false,
            detailsSubmitted: status.detailsSubmitted || false,
          });

          if (status.detailsSubmitted && status.chargesEnabled) {
            setSetupStatus('complete');
          } else if (status.connected) {
            setSetupStatus('in_progress');
          }
        }
      }
    } catch (error) {
      console.error('Error checking Stripe status:', error);
    }
  };

  const handleStartStripeConnect = async () => {
    if (!user) {
      showAlert('Error', 'Please sign in to continue');
      return;
    }

    setIsConnecting(true);

    try {
      let profileId = coachProfileId;

      if (!profileId) {
        const { data: profile, error: profileError } = await supabase
          .from('coach_profiles')
          .upsert({
            user_id: user.id,
            full_name: state.welcome?.fullName || user.user_metadata?.full_name || 'Coach',
            professional_title: state.welcome?.professionalTitle || 'Sailing Coach',
            experience_level: state.welcome?.experience || '1-2 years',
            organization: state.welcome?.organization || null,
            phone: state.welcome?.phone || null,
            languages: state.welcome?.languages || ['English'],
            profile_completed: false,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (profileError || !profile) {
          throw new Error('Failed to create coach profile');
        }

        profileId = profile.id;
        setCoachProfileId(profileId);
      }

      if (!profileId) {
        throw new Error('Failed to get or create coach profile');
      }

      const appUrl = getPublicAppUrl();
      const result = await StripeConnectService.startOnboarding(
        profileId,
        `${appUrl}/coach-onboarding-stripe-callback?fromPaymentSetup=true`,
        `${appUrl}/coach-onboarding-payment-setup`
      );

      if (!result.success || !result.url) {
        throw new Error(result.error || 'Failed to start Stripe onboarding');
      }

      updatePaymentSetup({ stripeOnboardingStarted: true });

      if (typeof window !== 'undefined') {
        window.location.href = result.url;
      } else {
        await Linking.openURL(result.url);
      }
    } catch (error: any) {
      console.error('Error starting Stripe Connect:', error);
      showAlert('Error', error.message || 'Failed to start payment setup');
      setSetupStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSkipForNow = async () => {
    showConfirm(
      'Skip Payment Setup?',
      "You won't be able to accept paid bookings until you complete payment setup. You can set this up later from your dashboard.",
      async () => {
        try {
          if (coachProfileId) {
            await supabase
              .from('coach_profiles')
              .update({
                stripe_onboarding_skipped: true,
                stripe_onboarding_skipped_at: new Date().toISOString(),
              })
              .eq('id', coachProfileId);
          }

          updatePaymentSetup({ stripeOnboardingSkipped: true });
          router.push('/(auth)/coach-onboarding-profile-preview');
        } catch (error) {
          console.error('Error skipping payment setup:', error);
          router.push('/(auth)/coach-onboarding-profile-preview');
        }
      },
      { destructive: true, confirmText: 'Skip' }
    );
  };

  const handleContinue = () => {
    router.push('/(auth)/coach-onboarding-profile-preview');
  };

  // Get pricing info for net earnings display
  const getNetEarnings = () => {
    if (!state.pricing) return '85%';
    return '85%';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.stepIndicator}>Step {CURRENT_STEP} of {STEP_COUNT}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(CURRENT_STEP / STEP_COUNT) * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconContainer}>
            <Ionicons name="card" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.heroTitle}>Payments</Text>
          <Text style={styles.heroSubtitle}>
            Connect your bank account to receive payouts
          </Text>
        </View>

        {/* Status Card */}
        {setupStatus === 'complete' && (
          <View style={styles.successCard}>
            <View style={styles.statusHeader}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              <Text style={styles.statusTitle}>Payments Enabled</Text>
            </View>
            <Text style={styles.statusDescription}>
              Your Stripe account is connected and ready to receive payments.
            </Text>
          </View>
        )}

        {setupStatus === 'in_progress' && (
          <View style={styles.warningCard}>
            <View style={styles.statusHeader}>
              <Ionicons name="alert-circle" size={24} color={COLORS.warning} />
              <Text style={styles.statusTitleWarning}>Setup In Progress</Text>
            </View>
            <Text style={styles.statusDescriptionWarning}>
              Your account needs a few more details to be fully activated.
            </Text>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleStartStripeConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.completeButtonText}>Complete Setup</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Info Section */}
        {setupStatus !== 'complete' && (
          <View style={styles.section}>
            <Text style={styles.infoText}>
              Stripe handles all payments securely. You'll earn {getNetEarnings()} of each session fee, deposited weekly.
            </Text>

            <View style={styles.requirementsCard}>
              <Text style={styles.requirementsTitle}>REQUIREMENTS</Text>

              <View style={styles.requirementRow}>
                <Ionicons name="checkmark" size={16} color={COLORS.tertiaryLabel} />
                <Text style={styles.requirementText}>Bank account details</Text>
              </View>

              <View style={styles.requirementRow}>
                <Ionicons name="checkmark" size={16} color={COLORS.tertiaryLabel} />
                <Text style={styles.requirementText}>Government ID verification</Text>
              </View>

              <View style={styles.requirementRow}>
                <Ionicons name="checkmark" size={16} color={COLORS.tertiaryLabel} />
                <Text style={styles.requirementText}>Takes about 5 minutes</Text>
              </View>
            </View>
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {setupStatus === 'complete' ? (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.stripeButton, isConnecting && styles.stripeButtonDisabled]}
              onPress={handleStartStripeConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="card" size={20} color="#FFFFFF" />
                  <Text style={styles.stripeButtonText}>Connect with Stripe</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipForNow}
              disabled={isConnecting}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>

            <View style={styles.skipWarning}>
              <Ionicons name="information-circle" size={14} color={COLORS.tertiaryLabel} />
              <Text style={styles.skipWarningText}>
                Required to accept paid bookings
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.secondaryLabel,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  headerRight: {
    width: 44,
  },

  // Progress
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.unselected,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.label,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: COLORS.secondaryLabel,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Status Cards
  successCard: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#166534',
    marginLeft: 8,
  },
  statusDescription: {
    fontSize: 15,
    color: '#166534',
    lineHeight: 22,
  },

  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusTitleWarning: {
    fontSize: 17,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 8,
  },
  statusDescriptionWarning: {
    fontSize: 15,
    color: '#92400E',
    lineHeight: 22,
    marginBottom: 12,
  },
  completeButton: {
    backgroundColor: COLORS.warning,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  infoText: {
    fontSize: 15,
    color: COLORS.secondaryLabel,
    lineHeight: 22,
    marginBottom: 20,
  },

  // Requirements
  requirementsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondaryLabel,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 15,
    color: COLORS.label,
    marginLeft: 10,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.separator,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stripeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#635BFF', // Stripe brand color
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  stripeButtonDisabled: {
    backgroundColor: COLORS.unselected,
  },
  stripeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipButtonText: {
    fontSize: 15,
    color: COLORS.primary,
  },
  skipWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  skipWarningText: {
    fontSize: 13,
    color: COLORS.tertiaryLabel,
  },
});

export default CoachOnboardingPaymentSetup;
