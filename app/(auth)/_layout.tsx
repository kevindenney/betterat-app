import { roleHome } from '@/lib/gates';
import { useAuth } from '@/providers/AuthProvider';
import { SUPABASE_CONFIG_ERROR } from '@/services/supabase';
import { router, Stack, useSegments, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

const ONBOARDING_ROUTES = new Set([
  // Club onboarding wizard
  'club-onboarding',
  'step-1-basics',
  'step-2-details',
  'step-3-contact',
  'step-4-launch',
  // Club onboarding chat
  'club-onboarding-chat',
  'club-onboarding-enhanced',
  'club-onboarding-website-verification',
  // Coach onboarding
  'coach-onboarding-welcome',
  'coach-onboarding-expertise',
  'coach-onboarding-pricing',
  'coach-onboarding-availability',
  'coach-onboarding-payment-setup',
  'coach-onboarding-profile-preview',
  'coach-onboarding-stripe-callback',
  'coach-onboarding-complete',
  // Sailor onboarding
  'sailor-onboarding-comprehensive',
  // Post-onboarding welcome
  'org-welcome',
]);

// Routes that should be accessible while signed out (OAuth callback needs to run)
const AUTH_ENTRY_ROUTES = new Set(['login', 'signup', 'callback']);

export default function AuthLayout() {
  const { state, userType } = useAuth();
  const segments = useSegments();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const currentRoute = segments[segments.length - 1];
  const onboardingRoutes = ONBOARDING_ROUTES;
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Track if we've entered an onboarding flow - once in, stay in until explicitly navigating out
  const hasEnteredOnboarding = useRef(false);

  // Check if any segment is an onboarding route (handles navigation transitions)
  const isInOnboardingFlow = segments.some(segment => onboardingRoutes.has(segment));

  // Once we enter onboarding, mark it and stay in until we explicitly leave the (auth) group
  if (isInOnboardingFlow && !hasEnteredOnboarding.current) {
    hasEnteredOnboarding.current = true;
  }

  // Pre-mark onboarding intent for club/coach signup to prevent flash of main app
  // When state becomes 'ready' while still on signup page, the user is about to be
  // redirected to their onboarding flow — mark it now to prevent a render cycle
  // where the auth layout briefly returns null and the tabs layout flashes.
  const isAuthEntryPoint = AUTH_ENTRY_ROUTES.has(currentRoute ?? '');
  if (
    state === 'ready' &&
    userType &&
    isAuthEntryPoint &&
    !hasEnteredOnboarding.current &&
    (userType === 'club' || userType === 'coach')
  ) {
    hasEnteredOnboarding.current = true;
  }

  // Check if we're in the (auth) group at all
  const isInAuthGroup = (segments as string[]).includes('(auth)');

  // Detect if auth is taking too long (potential config issue)
  useEffect(() => {
    if (SUPABASE_CONFIG_ERROR) return; // Skip if config error
    if (state === 'checking') {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
        console.warn('[AUTH_LAYOUT] Auth initialization timeout - checking environment config');
      }, 8000); // 8 second timeout
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [state]);

  // Imperative redirect for signed_out to prevent any rendering
  // EXCEPT for login and signup pages
  useEffect(() => {
    if (SUPABASE_CONFIG_ERROR) return; // Skip if config error
    const isAuthEntryPoint = AUTH_ENTRY_ROUTES.has(currentRoute ?? '');

    if (state === 'signed_out' && !isAuthEntryPoint) {
      router.replace('/');
    } else if (
      state === 'ready' &&
      userType &&
      currentRoute && // Don't redirect during navigation transitions when route is not yet determined
      !isInOnboardingFlow && // Use the broader check that looks at all segments
      !hasEnteredOnboarding.current // If we've ever entered onboarding this session, don't redirect
    ) {
      // If the login/signup page has a returnTo param, honor it
      const returnToParam = returnTo
        || (Platform.OS === 'web' && typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('returnTo')
          : null);

      if (returnToParam && typeof returnToParam === 'string' && returnToParam.startsWith('/')) {
        router.replace(returnToParam as any);
        return;
      }

      // Don't redirect if we're in the (auth) group — let the flow complete
      if (isInAuthGroup) return;

      const destination = roleHome(userType);
      const destinationSegment = destination.split('/').pop();

      if (destinationSegment && destinationSegment === currentRoute) {
        return;
      }

      router.replace(destination);
    }
  }, [state, userType, currentRoute, isInOnboardingFlow, isInAuthGroup, returnTo]);

  // Show config error immediately if Supabase can't initialize
  if (SUPABASE_CONFIG_ERROR) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Configuration Error</Text>
        <Text style={styles.errorText}>{SUPABASE_CONFIG_ERROR}</Text>
        <Text style={styles.errorHint}>
          Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
          are set in your Vercel environment variables.
        </Text>
        {Platform.OS === 'web' && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => window.location.reload()}
          >
            <Text style={styles.retryText}>Refresh Page</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Show loading indicator while checking auth state
  if (state === 'checking') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>
          {loadingTimeout ? 'Still loading...' : 'Loading...'}
        </Text>
        {loadingTimeout && (
          <View style={styles.timeoutContainer}>
            <Text style={styles.timeoutText}>
              Taking longer than expected. Check your network connection.
            </Text>
            {Platform.OS === 'web' && (
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => window.location.reload()}
              >
                <Text style={styles.retryText}>Refresh Page</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  // Don't render if signed out AND not on login/signup
  if (state === 'signed_out' && !isAuthEntryPoint) {
    return null;
  }

  // Only return null if user is ready AND has a userType AND not in onboarding flow
  // If userType is missing, we need to show the page (login/signup)
  // Also don't return null if we've entered onboarding or are in the (auth) group
  if (state === 'ready' && userType && !isInOnboardingFlow && !hasEnteredOnboarding.current && !isInAuthGroup) {
    return null;
  }

  // Render Stack for signed-out users on login/signup pages
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackVisible: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="callback" />
      <Stack.Screen name="club-onboarding-chat" />
      <Stack.Screen name="club-onboarding-enhanced" />
      <Stack.Screen name="club-onboarding-website-verification" />
      <Stack.Screen name="coach-onboarding-welcome" />
      <Stack.Screen name="coach-onboarding-expertise" />
      <Stack.Screen name="coach-onboarding-pricing" />
      <Stack.Screen name="coach-onboarding-availability" />
      <Stack.Screen name="coach-onboarding-payment-setup" />
      <Stack.Screen name="coach-onboarding-profile-preview" />
      <Stack.Screen name="coach-onboarding-stripe-callback" />
      <Stack.Screen name="coach-onboarding-complete" />
      <Stack.Screen name="sailor-onboarding-comprehensive" />
      <Stack.Screen name="org-welcome" />
  </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  timeoutContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  timeoutText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorHint: {
    fontSize: 14,
    color: '#7F1D1D',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 400,
    lineHeight: 20,
  },
});
