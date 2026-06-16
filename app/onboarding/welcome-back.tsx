/**
 * Welcome Back Screen - Returning User Entry Point
 * Quick re-entry for users who have completed onboarding before
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService';

function LogoAnimation() {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const waveOffset = useSharedValue(0);

  useEffect(() => {
    // Logo entrance animation
    scale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
    });
    opacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.ease),
    });

    // Subtle wave animation
    waveOffset.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-5, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: waveOffset.value }],
  }));

  return (
    <Animated.View style={[styles.logoContainer, logoStyle]}>
      <LinearGradient
        colors={['#007AFF', '#1D4ED8']}
        style={styles.logoCircle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Stylized R with wave */}
        <View style={styles.logoInner}>
          <Text style={styles.logoText}>R</Text>
          <Animated.View style={[styles.logoWave, waveStyle]}>
            <View style={styles.waveLine} />
          </Animated.View>
        </View>
      </LinearGradient>

      {/* Decorative rings */}
      <View style={[styles.ring, styles.ring1]} />
      <View style={[styles.ring, styles.ring2]} />
    </Animated.View>
  );
}

export default function WelcomeBackScreen() {
  const router = useRouter();
  const [cachedName, setCachedName] = useState<string | null>(null);

  useEffect(() => {
    // Load cached username
    OnboardingStateService.getCachedUsername().then(setCachedName);
  }, []);

  const handleSignIn = () => {
    router.push('/onboarding/auth-choice-new');
  };

  const handleCreateAccount = () => {
    // New users go through full value showcase
    router.replace('/onboarding/value/track-races');
  };

  // Personalized greeting
  const greeting = cachedName
    ? `Welcome back, ${cachedName.split(' ')[0]}`
    : 'Welcome back';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo Animation */}
          <Animated.View
            entering={FadeIn.delay(100).duration(500)}
            style={styles.logoWrapper}
          >
            <LogoAnimation />
          </Animated.View>

          {/* Welcome Message */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(400).springify()}
            style={styles.messageContainer}
          >
            <Text style={styles.title}>{greeting}</Text>
            <Text style={styles.subtitle}>
              Ready to track your next adventure?
            </Text>
          </Animated.View>
        </View>

        {/* Footer Actions */}
        <Animated.View
          entering={FadeInUp.delay(600).duration(400)}
          style={styles.footer}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSignIn}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCreateAccount}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
            <Ionicons name="arrow-forward" size={18} color="#64748B" />
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: 48,
  },
  logoContainer: {
    width: 140,
    height: 140,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  logoWave: {
    position: 'absolute',
    bottom: 8,
    left: -10,
    right: -10,
  },
  waveLine: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
  },
  ring: {
    position: 'absolute',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.15)',
  },
  ring1: {
    width: 120,
    height: 120,
    top: 10,
    left: 10,
  },
  ring2: {
    width: 140,
    height: 140,
    top: 0,
    left: 0,
    borderColor: 'rgba(0, 122, 255, 0.08)',
  },
  messageContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 32,
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
});
