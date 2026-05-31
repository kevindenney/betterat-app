/**
 * Auth Choice Screen - Redesigned (Strava-inspired)
 * Prominent social login buttons with email as secondary option
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { OnboardingProgressDots } from '@/components/onboarding/OnboardingProgressDots';
import { nativeAppleSignIn, nativeGoogleSignIn, isAppleSignInAvailable } from '@/lib/auth/nativeOAuth';
import { useGoogleAuth, useAppleAuth } from '@/lib/auth/useOAuth';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService';

// Icons as SVG paths for social buttons
const AppleLogo = () => (
  <View style={styles.socialIcon}>
    <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
  </View>
);

const GoogleLogo = () => (
  <View style={[styles.socialIcon, styles.googleIcon]}>
    <Text style={styles.googleG}>G</Text>
  </View>
);

export default function AuthChoiceNewScreen() {
  const router = useRouter();
  const { enterGuestMode } = useAuth();
  const [isLoading, setIsLoading] = useState<'apple' | 'google' | 'guest' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');

  // OAuth hooks for web fallback
  const { signInWithGoogle } = useGoogleAuth();
  const { signInWithApple } = useAppleAuth();

  // Check Apple Sign-In availability
  React.useEffect(() => {
    const checkApple = async () => {
      const available = await isAppleSignInAvailable();
      setAppleAvailable(available);
    };
    if (Platform.OS === 'ios') {
      checkApple();
    }
  }, []);

  const handleAppleSignIn = async () => {
    setIsLoading('apple');
    try {
      if (Platform.OS === 'ios') {
        await nativeAppleSignIn();
      } else {
        await signInWithApple();
      }
      // On success, navigate to profile setup
      router.push('/onboarding/profile/name-photo');
    } catch (error: any) {
      if (!error.message?.includes('cancelled')) {
        showAlert(
          'Sign In Failed',
          error.message || 'Failed to sign in with Apple. Please try again.'
        );
      }
    } finally {
      setIsLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading('google');
    try {
      if (Platform.OS !== 'web') {
        await nativeGoogleSignIn();
      } else {
        await signInWithGoogle();
      }
      // On success, navigate to profile setup
      router.push('/onboarding/profile/name-photo');
    } catch (error: any) {
      if (!error.message?.includes('cancelled')) {
        showAlert(
          'Sign In Failed',
          error.message || 'Failed to sign in with Google. Please try again.'
        );
      }
    } finally {
      setIsLoading(null);
    }
  };

  const handleEmailSignUp = () => {
    router.push('/(auth)/signup');
  };

  const handleSignIn = () => {
    router.push('/(auth)/login');
  };

  const handleBrowseAsGuest = async () => {
    setIsLoading('guest');
    try {
      // Mark onboarding as seen so they don't see it again
      await OnboardingStateService.markOnboardingSeen();
      // Enter guest mode
      enterGuestMode();
      // Navigate to races tab
      router.replace('/(tabs)/races');
    } catch (error) {
      console.error('Failed to enter guest mode:', error);
    } finally {
      setIsLoading(null);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <OnboardingProgressDots
            currentStep={3}
            totalSteps={11}
            activeColor="#3B82F6"
            inactiveColor="#E2E8F0"
            completedColor="#93C5FD"
          />
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {/* Hero Section */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400).springify()}
            style={styles.heroSection}
          >
            <View style={styles.logoContainer}>
              <Ionicons name="sparkles" size={48} color="#3B82F6" />
            </View>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>
              Join thousands tracking their progress and getting better
            </Text>
          </Animated.View>

          {/* Social Login Buttons */}
          <Animated.View
            entering={FadeIn.delay(300).duration(400)}
            style={styles.socialButtonsContainer}
          >
            {/* Apple Sign In (iOS only or web) */}
            {(appleAvailable || Platform.OS === 'web') && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={isLoading !== null}
                activeOpacity={0.8}
              >
                {isLoading === 'apple' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppleLogo />
                    <Text style={styles.socialButtonText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton]}
              onPress={handleGoogleSignIn}
              disabled={isLoading !== null}
              activeOpacity={0.8}
            >
              {isLoading === 'google' ? (
                <ActivityIndicator size="small" color="#1F2937" />
              ) : (
                <>
                  <GoogleLogo />
                  <Text style={[styles.socialButtonText, styles.googleButtonText]}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <Animated.View
            entering={FadeIn.delay(400).duration(300)}
            style={styles.dividerContainer}
          >
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </Animated.View>

          {/* Email Sign Up */}
          <Animated.View entering={FadeIn.delay(500).duration(400)}>
            <TouchableOpacity
              style={styles.emailButton}
              onPress={handleEmailSignUp}
              disabled={isLoading !== null}
              activeOpacity={0.8}
            >
              <Ionicons name="mail-outline" size={20} color="#3B82F6" />
              <Text style={styles.emailButtonText}>Sign up with Email</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Browse as Guest */}
          <Animated.View entering={FadeIn.delay(550).duration(400)}>
            <TouchableOpacity
              style={styles.guestButton}
              onPress={handleBrowseAsGuest}
              disabled={isLoading !== null}
              activeOpacity={0.8}
            >
              {isLoading === 'guest' ? (
                <ActivityIndicator size="small" color="#64748B" />
              ) : (
                <>
                  <Ionicons name="eye-outline" size={20} color="#64748B" />
                  <Text style={styles.guestButtonText}>Browse as Guest</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Terms */}
          <Animated.Text
            entering={FadeIn.delay(600).duration(300)}
            style={styles.termsText}
          >
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Animated.Text>
        </View>

        {/* Footer - Sign In Link */}
        <Animated.View
          entering={FadeInUp.delay(700).duration(400)}
          style={styles.footer}
        >
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={handleSignIn}>
            <Text style={styles.signInLink}>Sign In</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  socialButtonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  socialIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    backgroundColor: '#FFFFFF',
  },
  googleG: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  googleButtonText: {
    color: '#1F2937',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    gap: 10,
    marginBottom: 24,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    marginBottom: 24,
  },
  guestButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
  },
  termsText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerText: {
    fontSize: 15,
    color: '#64748B',
  },
  signInLink: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
