import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import type { ViewStyle } from 'react-native';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../services/supabase';
import { isAppleSignInAvailable } from '@/lib/auth/nativeOAuth';
import { getLastTabRoute } from '@/lib/utils/userTypeRouting';
import { useLocalSearchParams } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ONBOARDING_BLUEPRINT_KEY,
  commitOnboardingBlueprint,
} from '@/services/onboarding/commitSignupContext';

const cardShadowStyle: ViewStyle =
  Platform.OS === 'web'
    ? {
        boxShadow: '0px 18px 35px rgba(15, 23, 42, 0.08)',
      }
    : {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      };

const PASSWORD_RESET_RETURN_TO = '/settings/change-password?recovery=1';

const getPasswordResetRedirectUrl = () => {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : 'https://better.at';
  const callbackUrl = new URL('/callback', origin);
  callbackUrl.searchParams.set('returnTo', PASSWORD_RESET_RETURN_TO);
  return callbackUrl.toString();
};

// Helper to get user-friendly error messages
const getAuthErrorMessage = (error: any): string => {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code || '';

  // Email/password errors
  if (message.includes('invalid login credentials') || code === 'invalid_credentials') {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please check your email and click the confirmation link before signing in.';
  }
  if (message.includes('too many requests') || code === 'over_request_limit') {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your internet connection.';
  }
  if (message.includes('timeout')) {
    return 'The request timed out. Please try again.';
  }

  // Apple Sign-In specific errors (expo-apple-authentication)
  if (code === 'ERR_REQUEST_CANCELED' || message.includes('canceled') || message.includes('cancelled')) {
    return ''; // User cancelled - no error message needed
  }
  if (code === 'ERR_INVALID_RESPONSE' || message.includes('invalid response')) {
    return 'Apple Sign In returned an invalid response. Please try again.';
  }
  if (code === 'ERR_REQUEST_FAILED' || message.includes('request failed')) {
    return 'Apple Sign In request failed. Please check your internet connection and try again.';
  }
  if (code === 'ERR_REQUEST_NOT_HANDLED') {
    return 'Apple Sign In is not available. Please use another sign-in method.';
  }
  if (message.includes('authorization attempt failed') || message.includes('unknown reason')) {
    return 'Apple Sign In failed. Please ensure you are signed into iCloud and try again.';
  }
  if (message.includes('no identity token')) {
    return 'Apple Sign In did not return required credentials. Please try again.';
  }

  // Google Sign-In specific errors
  if (message.includes('google sign-in was cancelled') || message.includes('sign_in_cancelled')) {
    return ''; // User cancelled - no error message needed
  }
  if (message.includes('no id token')) {
    return 'Google Sign In did not return required credentials. Please try again.';
  }
  if (message.includes('play services')) {
    return 'Google Play Services is required. Please update and try again.';
  }

  return error?.message || 'Sign in failed. Please try again.';
};

export default function Login() {
  const { signIn, signInWithGoogle, signInWithApple, loading, signedIn, ready, userProfile, user } = useAuth();
  const { returnTo, inviteToken, blueprint } = useLocalSearchParams<{
    returnTo?: string;
    inviteToken?: string;
    blueprint?: string;
  }>();
  const blueprintRef = typeof blueprint === 'string' ? blueprint : undefined;

  // Stash a ?blueprint= deep-link param into AsyncStorage so both the
  // email-login (below) and OAuth-callback paths can pick it up and create
  // the blueprint_subscriptions row after auth (onboarding plan §4 Step 3).
  useEffect(() => {
    if (!blueprintRef) return;
    AsyncStorage.setItem(ONBOARDING_BLUEPRINT_KEY, blueprintRef).catch(() => {});
  }, [blueprintRef]);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Apple Sign In is available on web and iOS, not Android
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(Platform.OS === 'web');

  useEffect(() => {
    // Check Apple Sign In availability on iOS
    if (Platform.OS === 'ios') {
      isAppleSignInAvailable().then(setAppleSignInAvailable);
    }
  }, []);

  // Once a session is established, drain any pending blueprint subscription
  // queued by a ?blueprint= deep-link before the redirect side-effect fires.
  // Safe across email + OAuth login (callback.tsx handles OAuth callback URLs,
  // but if a user lands here already signed-in or finishes an email login,
  // this is the only chance to commit). Idempotent on server.
  useEffect(() => {
    if (!ready || !signedIn || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const pending = await AsyncStorage.getItem(ONBOARDING_BLUEPRINT_KEY);
        if (cancelled || !pending) return;
        await commitOnboardingBlueprint(user.id, pending);
        await AsyncStorage.removeItem(ONBOARDING_BLUEPRINT_KEY);
      } catch {
        // Non-fatal — user can resubscribe in-app.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, signedIn, user?.id]);

  // Redirect after successful sign-in
  useEffect(() => {
    if (!ready || !signedIn) return;
    // If an invite token was provided, redirect to invite acceptance page
    if (inviteToken && typeof inviteToken === 'string') {
      router.replace(`/invite/${inviteToken}` as any);
      return;
    }
    // If a returnTo path was provided (e.g. from a landing page), go back there
    if (returnTo && typeof returnTo === 'string' && returnTo.startsWith('/')) {
      router.replace(returnTo as any);
      return;
    }
    // Also check window.location for returnTo on web (fallback for query string params)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlReturnTo = urlParams.get('returnTo');
      if (urlReturnTo && urlReturnTo.startsWith('/')) {
        router.replace(urlReturnTo as any);
        return;
      }
    }
    const destination = getLastTabRoute(userProfile?.user_type ?? null);
    router.replace(destination as any);
  }, [ready, signedIn, userProfile?.user_type, returnTo, inviteToken]);

  const onEmailLogin = async () => {
    setErrorMessage(null); // Clear previous errors

    if (!identifier || !password) {
      setErrorMessage('Please enter your email and password');
      return;
    }
    try {
      await signIn(identifier, password);
    } catch (e: any) {
      console.error('[LOGIN] Sign in failed:', e);
      const friendlyMessage = getAuthErrorMessage(e);
      setErrorMessage(friendlyMessage);
      // Also show alert for better visibility
      showAlert('Sign in failed', friendlyMessage);
    }
  };

  const onGoogleLogin = async () => {
    setErrorMessage(null);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const oauthReturnTo =
          returnTo && typeof returnTo === 'string' && returnTo.startsWith('/')
            ? returnTo
            : new URLSearchParams(window.location.search).get('returnTo');
        if (oauthReturnTo && oauthReturnTo.startsWith('/')) {
          window.sessionStorage.setItem('oauth_return_to', oauthReturnTo);
        }
      }
      await signInWithGoogle();
    } catch (e: any) {
      console.error('[LOGIN] Google sign in failed:', e);
      const friendlyMessage = getAuthErrorMessage(e);
      // Don't show error message if user cancelled
      if (friendlyMessage) {
        setErrorMessage(friendlyMessage);
        showAlert('Google sign-in failed', friendlyMessage);
      }
    }
  };

  const onAppleLogin = async () => {
    setErrorMessage(null);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const oauthReturnTo =
          returnTo && typeof returnTo === 'string' && returnTo.startsWith('/')
            ? returnTo
            : new URLSearchParams(window.location.search).get('returnTo');
        if (oauthReturnTo && oauthReturnTo.startsWith('/')) {
          window.sessionStorage.setItem('oauth_return_to', oauthReturnTo);
        }
      }
      await signInWithApple();
    } catch (e: any) {
      console.error('[LOGIN] Apple sign in failed:', e);
      const friendlyMessage = getAuthErrorMessage(e);
      // Don't show error message if user cancelled
      if (friendlyMessage) {
        setErrorMessage(friendlyMessage);
        showAlert('Apple sign-in failed', friendlyMessage);
      }
    }
  };

  const onForgotPassword = async () => {
    const email = identifier.includes('@') ? identifier : '';

    if (Platform.OS === 'web') {
      // Web: use window.prompt/confirm since Alert.alert doesn't work
      let emailToReset = email;
      if (!emailToReset) {
        emailToReset = window.prompt('Enter your email address to reset your password:') || '';
      }

      if (!emailToReset || !emailToReset.includes('@')) {
        setErrorMessage('Please enter a valid email address');
        return;
      }

      const confirmed = window.confirm(`Send password reset link to ${emailToReset}?`);
      if (confirmed) {
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(emailToReset, {
            redirectTo: getPasswordResetRedirectUrl(),
          });
          if (error) throw error;
          setErrorMessage(null);
          window.alert('Password reset link sent! Check your email.');
        } catch (error: any) {
          setErrorMessage(error?.message || 'Failed to send reset link');
        }
      }
    } else {
      // Mobile: use cross-platform alert
      if (email) {
        showConfirm(
          'Reset Password',
          `Send password reset link to ${email}?`,
          async () => {
            try {
              // supabase-js returns errors in { error } rather than throwing, so
              // a failed send (rate limit, SMTP outage) must be checked explicitly
              // or the user gets a false "Success" and waits for an email that
              // never arrives.
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: getPasswordResetRedirectUrl(),
              });
              if (error) throw error;
              showAlert('Success', 'Password reset link sent to your email');
            } catch (error) {
              showAlert('Error', error instanceof Error ? error.message : 'Failed to send reset link');
            }
          },
        );
      } else {
        showAlert('Reset Password', 'Enter your email address');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Header with close button */}
          <View style={styles.cardHeader}>
            <View style={styles.headerSpacer} />
            <TouchableOpacity
              testID="login-close-button"
              accessibilityRole="button"
              accessibilityLabel="Close sign in"
              // Web has a real marketing landing at `/`; native closes into
              // the value funnel (the shared pre-signup intro — /welcome is
              // now just an alias for it).
              onPress={() =>
                router.replace(
                  Platform.OS === 'web' ? '/' : '/onboarding/value/pick-craft',
                )
              }
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Image
            source={require('@/assets/images/brand-mark-large.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="BetterAt logo"
          />

          <Text testID="login-title" accessibilityRole="header" style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue to BetterAt</Text>

          {/* Error Message Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => setErrorMessage(null)} style={styles.errorDismiss}>
                <Text style={styles.errorDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Social Sign-in Buttons */}
          <View style={styles.socialButtonsContainer}>
            {/* Google Sign-in */}
            <TouchableOpacity
              testID="login-google-button"
              accessibilityRole="button"
              accessibilityLabel="google-sign-in"
              onPress={onGoogleLogin}
              disabled={loading}
              style={[styles.socialButton, styles.googleButton, loading && styles.buttonDisabled]}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Apple Sign-in - iOS native button or web fallback, hidden on Android */}
            {appleSignInAvailable && (
              Platform.OS === 'ios' ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={10}
                  style={[styles.appleNativeButton, loading && styles.buttonDisabled]}
                  onPress={onAppleLogin}
                />
              ) : (
                <TouchableOpacity
                  testID="login-apple-button"
                  accessibilityRole="button"
                  accessibilityLabel="apple-sign-in"
                  onPress={onAppleLogin}
                  disabled={loading}
                  style={[styles.socialButton, styles.appleButton, loading && styles.buttonDisabled]}
                >
                  <Text style={styles.appleIcon}></Text>
                  <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continue with Apple</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {/* Login Form */}
          <View
            accessible={true}
            accessibilityLabel="Login form"
          >
            {/* Username or Email */}
            <TextInput
              testID="login-identifier-input"
              accessibilityLabel="Username or email"
              style={styles.input}
              placeholder="Username or email"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="default"
              editable={!loading}
              textContentType="username"
              importantForAccessibility="yes"
            />

            {/* Password */}
            <View style={styles.passwordContainer}>
              <TextInput
                testID="login-password-input"
                accessibilityLabel="Password"
                style={styles.passwordInput}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                textContentType="password"
                importantForAccessibility="yes"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity testID="login-forgot-password" onPress={onForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="login-submit-button"
              accessibilityRole="button"
              accessibilityLabel="submit-sign-in"
              onPress={onEmailLogin}
              disabled={loading}
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              importantForAccessibility="yes"
            >
              <Text style={styles.primaryButtonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
            </TouchableOpacity>
          </View>

          {/* Sign-up link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to BetterAt?</Text>
            <TouchableOpacity
              testID="login-signup-link"
              accessibilityRole="button"
              accessibilityLabel="create-account"
              onPress={() => router.push('/(auth)/signup' as any)}
              disabled={loading}
            >
              <Text style={styles.linkText}>Create an account</Text>
            </TouchableOpacity>
          </View>

          {/* Marketing blurb */}
          <Text style={styles.marketingText}>
            Plan, Do, Review — get better at what matters to you.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: -8,
    marginRight: -8,
  },
  headerSpacer: {
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingVertical: 48,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#E5E7EB',
    ...cardShadowStyle
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: 16,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16
  },
  socialButtonsContainer: {
    marginBottom: 8,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 14,
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
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 15,
  },
  appleButtonText: {
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB'
  },
  dividerText: {
    marginHorizontal: 8,
    color: '#94A3B8'
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF'
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8
  },
  buttonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12
  },
  footerText: { color: '#64748B' },
  linkText: { color: '#007AFF', fontWeight: '600', marginLeft: 6 },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 8,
  },
  marketingText: {
    marginTop: 20,
    color: '#475569',
    fontSize: 12,
    lineHeight: 18
  },
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
