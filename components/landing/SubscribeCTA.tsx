import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';
import { useAuth } from '@/providers/AuthProvider';
import { getDashboardRoute } from '@/lib/utils/userTypeRouting';

interface SubscribeCTAProps {
  accentColor?: string;
  interestSlug?: string;
}

export function SubscribeCTA({ accentColor = '#1A1A1A', interestSlug }: SubscribeCTAProps) {
  const ctx = getOnboardingContext(interestSlug);
  const { user, userProfile, isGuest } = useAuth();
  const isLoggedIn = !!user && !isGuest;
  const pathname = usePathname();

  const handleGetStarted = () => {
    if (interestSlug) {
      router.push(`/(auth)/signup?intent=create-org&interest=${interestSlug}` as any);
    } else {
      router.push('/(auth)/signup?intent=create-org' as any);
    }
  };

  const handleDashboard = () => {
    const dest = getDashboardRoute(userProfile?.user_type ?? null);
    router.push(dest as any);
  };

  if (isLoggedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>
          {interestSlug ? `Explore more in ${ctx.interestName}` : 'Welcome back'}
        </Text>
        <Text style={styles.subtext}>
          Track your own progress, subscribe to programs, and connect with others.
        </Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor }]}
            onPress={handleDashboard}
          >
            <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(tabs)/settings' as any)}
          >
            <Text style={[styles.secondaryButtonText, { color: accentColor }]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{ctx.cta.headline}</Text>
      <Text style={styles.subtext}>{ctx.cta.subtext}</Text>
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: accentColor }]}
          onPress={handleGetStarted}
        >
          <Text style={styles.primaryButtonText}>{ctx.cta.buttonLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: pathname } } as any)}
        >
          <Text style={[styles.secondaryButtonText, { color: accentColor }]}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
