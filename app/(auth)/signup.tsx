import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../providers/AuthProvider';
import { isAppleSignInAvailable } from '@/lib/auth/nativeOAuth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePersonaParam, type PersonaRole } from '@/lib/auth/signupPersona';
import { PENDING_CREATE_ORG_KEY } from '@/services/onboarding/commitSignupContext';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';
import { SAMPLE_INTERESTS, INTEREST_DOMAINS } from '@/lib/landing/sampleData';
import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService';
import { FeatureTourService } from '@/services/onboarding/FeatureTourService';
import { commitSignupContext } from '@/services/onboarding/commitSignupContext';

// Helper to get user-friendly error messages for signup
const getSignupErrorMessage = (error: any): string => {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code || '';

  if (message.includes('registered') || message.includes('duplicate') || message.includes('already') || code === 'user_already_exists') {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (message.includes('invalid email') || message.includes('email')) {
    return 'Please enter a valid email address.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your internet connection.';
  }
  if (message.includes('timeout')) {
    return 'The request timed out. Please try again.';
  }
  return error?.message || 'Unable to create your account. Please try again.';
};

type SignupStep = 'interest' | 'persona';

export default function SignUp() {
  const { signUp, signInWithGoogle, signInWithApple, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{
    persona?: string;
    interest?: string;
    inviteToken?: string;
    plan?: string;
    org?: string;
    orgName?: string;
    returnTo?: string;
    blueprint?: string;
    blueprintName?: string;
    intent?: string;
  }>();

  // If interest comes from URL, skip the interest picker step
  const paramInterest = params.interest || undefined;
  const inviteToken = params.inviteToken || undefined;
  const returnTo = params.returnTo || undefined;
  const blueprintRef = params.blueprint || undefined;
  const blueprintName = params.blueprintName || undefined;
  const wantsCreateOrg = params.intent === 'create-org';

  const [selectedInterest, setSelectedInterest] = useState<string | undefined>(paramInterest);
  const [step, setStep] = useState<SignupStep>(paramInterest ? 'persona' : 'interest');

  const interestCtx = getOnboardingContext(selectedInterest);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [persona, setPersona] = useState<PersonaRole>(normalizePersonaParam(params.persona));
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(Platform.OS === 'web');

  const isLoading = loading || authLoading;

  useEffect(() => {
    if (Platform.OS === 'ios') {
      isAppleSignInAvailable().then(setAppleSignInAvailable);
    }
  }, []);

  useEffect(() => {
    setPersona(normalizePersonaParam(params.persona));
  }, [params.persona]);

  // Generic subtitles on signup — interest-specific terminology is for inside the app
  const personaSubtitles = {
    sailor: 'Start learning and tracking your progress',
    coach: 'Set up your coaching profile',
    club: 'Set up your organization',
  };

  const getSubtitle = () => personaSubtitles[persona];

  const getButtonText = () => {
    if (isLoading) return 'Creating account...';
    return 'Create Account';
  };

  const handleSelectInterest = (slug: string) => {
    setSelectedInterest(slug);
    setStep('persona');
  };

  const handleSignUp = async () => {
    setErrorMessage(null);
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!trimmedUsername) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (trimmedUsername.length < 3) {
      setErrorMessage('Name must be at least 3 characters long.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(trimmedEmail, trimmedUsername, password, persona);

      if (!selectedInterest) {
        console.warn('[Signup] selectedInterest is falsy — NOT committing onboarding_interest_slug');
      }

      // Persist interest + org + returnTo (AsyncStorage dual-write) and commit
      // the interest to user_interests immediately on the email path where we
      // already have the userId. See services/onboarding/commitSignupContext.
      const commit = await commitSignupContext({
        userId: result?.user?.id ?? null,
        interestSlug: selectedInterest,
        orgSlug: params.org ?? null,
        returnTo: returnTo ?? null,
        blueprintRef: blueprintRef ?? null,
      });
      if (commit.interestSkipReason && commit.interestSkipReason !== 'no-slug') {
        console.warn('[Signup] interest commit skipped:', commit.interestSkipReason);
      }
      if (commit.blueprintSkipReason && commit.blueprintSkipReason !== 'no-ref') {
        console.warn('[Signup] blueprint subscribe skipped:', commit.blueprintSkipReason);
      }

      if (inviteToken) {
        router.replace(`/invite/${inviteToken}` as any);
        return;
      }

      if (persona === 'sailor') {
        // Profile, trial, and onboarding_completed are all set in the AuthProvider's
        // upsert (same DB call that creates the user row) to avoid race conditions.
        // Here we just handle AsyncStorage-based state and navigation.
        const userId = result?.user?.id;
        if (userId) {
          try {
            await OnboardingStateService.setUserInfo(userId, trimmedUsername);
            await OnboardingStateService.completeStep('profile-setup');

            // Suppress the duplicate pricing prompt — user will see trial-activation next.
            await FeatureTourService.markPricingPromptSeen();
          } catch (profileErr) {
            console.warn('[Signup] Post-signup state save failed, continuing:', profileErr);
          }
        }
        if (wantsCreateOrg) {
          // Came from a "set up your org" CTA: skip the learner trial
          // celebration and drop straight onto the orgs surface, which
          // auto-opens CreateOrgSheet via the pending flag.
          await AsyncStorage.setItem(PENDING_CREATE_ORG_KEY, '1');
          router.replace('/(tabs)/library?zone=orgs' as any);
          return;
        }
        router.replace('/onboarding/trial-activation');
      } else if (persona === 'club') {
        const chatRoute = selectedInterest
          ? `/(auth)/club-onboarding-chat?interest=${selectedInterest}`
          : '/(auth)/club-onboarding-chat';
        router.replace(chatRoute as any);
      }
    } catch (error: any) {
      console.error('[Signup] Account creation error:', error);
      const friendlyMessage = getSignupErrorMessage(error);
      setErrorMessage(friendlyMessage);
      showAlert('Signup error', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErrorMessage(null);
    try {
      if (wantsCreateOrg) await AsyncStorage.setItem(PENDING_CREATE_ORG_KEY, '1');
      await signInWithGoogle(persona);
      // OAuth has no userId until callback.tsx runs after the redirect;
      // dual-write AsyncStorage now, DB commit happens post-callback.
      await commitSignupContext({
        interestSlug: selectedInterest,
        orgSlug: params.org ?? null,
        returnTo: returnTo ?? null,
        blueprintRef: blueprintRef ?? null,
      });
    } catch (error: any) {
      console.error('[Signup] Google sign-up error:', error);
      const friendlyMessage = getSignupErrorMessage(error);
      setErrorMessage(friendlyMessage);
    }
  };

  const handleAppleSignUp = async () => {
    setErrorMessage(null);
    try {
      if (wantsCreateOrg) await AsyncStorage.setItem(PENDING_CREATE_ORG_KEY, '1');
      await signInWithApple(persona);
      await commitSignupContext({
        interestSlug: selectedInterest,
        orgSlug: params.org ?? null,
        returnTo: returnTo ?? null,
        blueprintRef: blueprintRef ?? null,
      });
    } catch (error: any) {
      console.error('[Signup] Apple sign-up error:', error);
      const friendlyMessage = getSignupErrorMessage(error);
      setErrorMessage(friendlyMessage);
    }
  };

  // ---- Interest Picker Step ----
  if (step === 'interest') {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.cardHeader}>
              <View style={styles.headerSpacer} />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close sign up"
                onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text testID="signup-title" style={styles.title}>What are you working on?</Text>
            <Text style={styles.subtitle}>
              Pick an interest to get started. You can add more later.
            </Text>

            {INTEREST_DOMAINS.map((domain) => {
              const domainInterests = domain.slugs
                .map((slug) => SAMPLE_INTERESTS.find((i) => i.slug === slug))
                .filter((i): i is (typeof SAMPLE_INTERESTS)[number] => !!i);
              if (domainInterests.length === 0) return null;
              return (
                <View key={domain.name} style={styles.domainSection}>
                  <Text style={[styles.domainHeader, { color: domain.color }]}>
                    {domain.name}
                  </Text>
                  <View style={styles.interestGrid}>
                    {domainInterests.map((interest) => (
                      <TouchableOpacity
                        testID={`signup-interest-${interest.slug}`}
                        key={interest.slug}
                        style={styles.interestCard}
                        onPress={() => handleSelectInterest(interest.slug)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${interest.name}`}
                      >
                        <View style={[styles.interestIcon, { backgroundColor: interest.color + '18' }]}>
                          <Ionicons
                            name={(interest.icon + '-outline') as any}
                            size={24}
                            color={interest.color}
                          />
                        </View>
                        <Text style={styles.interestName}>{interest.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              testID="signup-skip-interest"
              style={styles.skipButton}
              onPress={() => setStep('persona')}
            >
              <Text style={styles.skipButtonText}>Skip — I'll choose later</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="signup-signin-link"
              style={styles.linkButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---- Persona + Form Step ----
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Header with close/back buttons */}
          <View style={styles.cardHeader}>
            {!paramInterest && (
              <TouchableOpacity
                testID="signup-back-to-interests"
                accessibilityRole="button"
                accessibilityLabel="Back to interest picker"
                onPress={() => { setStep('interest'); setSelectedInterest(undefined); }}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={20} color="#64748B" />
              </TouchableOpacity>
            )}
            <View style={styles.headerSpacer} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close sign up"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Interest badge */}
          {selectedInterest && (
            <View style={styles.interestBadgeRow}>
              <View style={[styles.interestBadge, { backgroundColor: 'rgba(37, 99, 235, 0.08)', borderColor: 'rgba(37, 99, 235, 0.25)' }]}>
                <Text style={[styles.interestBadgeText, { color: '#2563EB' }]}>
                  {interestCtx.interestName}
                </Text>
              </View>
            </View>
          )}

          {/* Org context badge */}
          {params.orgName && (
            <View style={styles.orgContextRow}>
              <View style={styles.orgContextBadge}>
                <Ionicons name="business-outline" size={14} color="#2563EB" />
                <Text style={[styles.orgContextText, { color: '#2563EB' }]}>
                  Joining {params.orgName}
                </Text>
              </View>
            </View>
          )}

          {/* Blueprint context badge — shown when arriving from a path share link */}
          {(blueprintName || blueprintRef) && (
            <View style={styles.orgContextRow}>
              <View style={styles.orgContextBadge}>
                <Ionicons name="map-outline" size={14} color="#2563EB" />
                <Text style={[styles.orgContextText, { color: '#2563EB' }]}>
                  Subscribing to {blueprintName || 'this path'}
                </Text>
              </View>
            </View>
          )}

          <Text testID="signup-title" style={styles.title}>Create your account</Text>
          <Text key={persona} style={styles.subtitle}>{getSubtitle()}</Text>

          {/* Error Message Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => setErrorMessage(null)} style={styles.errorDismiss}>
                <Text style={styles.errorDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Social Sign-up Options (above form) */}
          <View style={styles.socialContainer}>
            <TouchableOpacity
              testID="signup-google-button"
              style={[styles.socialButton, styles.googleButton, isLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignUp}
              disabled={isLoading}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {appleSignInAvailable && (
              Platform.OS === 'ios' ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={10}
                  style={[styles.appleNativeButton, isLoading && styles.buttonDisabled]}
                  onPress={handleAppleSignUp}
                />
              ) : (
                <TouchableOpacity
                  style={[styles.socialButton, styles.appleButton, isLoading && styles.buttonDisabled]}
                  onPress={handleAppleSignUp}
                  disabled={isLoading}
                >
                  <Text style={styles.appleIcon}>{'\uF8FF'}</Text>
                  <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continue with Apple</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.divider} />
          </View>

          {/* Form Fields */}
          <Text style={styles.sectionLabel}>Full Name *</Text>
          <TextInput
            testID="signup-name-input"
            style={styles.input}
            placeholder="Your name"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="name"
            editable={!isLoading}
          />

          <Text style={styles.sectionLabel}>Email *</Text>
          <TextInput
            testID="signup-email-input"
            style={styles.input}
            placeholder="your.email@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isLoading}
          />

          <Text style={styles.sectionLabel}>Password *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              testID="signup-password-input"
              accessibilityLabel="Password"
              style={styles.passwordInput}
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="password"
              editable={!isLoading}
              importantForAccessibility="yes"
            />
            <TouchableOpacity
              testID="signup-password-toggle"
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              style={styles.eyeButton}
              onPress={() => setShowPassword((value) => !value)}
              disabled={isLoading}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            testID="signup-submit-button"
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {getButtonText()}
            </Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            By signing up, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>

          {/* Login Link */}
          <TouchableOpacity
            testID="signup-signin-link"
            style={styles.linkButton}
            onPress={() => router.push('/(auth)/login')}
            disabled={isLoading}
          >
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },

  // Interest Picker
  domainSection: {
    marginBottom: 20,
  },
  domainHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  interestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  interestIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // Interest Badge (persona step)
  interestBadgeRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  interestBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  interestBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Org Context Badge
  orgContextRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  orgContextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  orgContextText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Social Buttons
  socialContainer: {
    marginBottom: 4,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  appleNativeButton: {
    width: '100%',
    height: 48,
    marginTop: 8,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: 12,
  },
  appleIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    marginRight: 12,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  appleButtonText: {
    color: '#FFFFFF',
  },

  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: '#94A3B8',
  },

  // Form
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  // Buttons
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Terms
  termsText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  termsLink: {
    color: '#2563EB',
    fontWeight: '500',
  },

  // Link
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },

  // Error Banner
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  errorDismiss: {
    marginLeft: 12,
    padding: 4,
  },
  errorDismissText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
});
