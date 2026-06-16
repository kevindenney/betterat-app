/**
 * Add Race Screen - First Activity Prompt
 * Final onboarding screen that encourages adding first race
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingProgressDots } from '@/components/onboarding/OnboardingProgressDots';
import { useWorkspaceDomain } from '@/hooks/useWorkspaceDomain';
import { guardOnboardingRouteForDomain } from '@/lib/utils/onboardingRouting';
import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService';

function SuccessIllustration() {
  const scale = useSharedValue(1);

  useEffect(() => {
    // Gentle pulse animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.illustrationContainer, animatedStyle]}>
      <LinearGradient
        colors={['#22C55E', '#16A34A']}
        style={styles.successCircle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="checkmark" size={64} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.sparkles}>
        <View style={[styles.sparkle, styles.sparkle1]} />
        <View style={[styles.sparkle, styles.sparkle2]} />
        <View style={[styles.sparkle, styles.sparkle3]} />
        <View style={[styles.sparkle, styles.sparkle4]} />
      </View>
    </Animated.View>
  );
}

export default function AddRaceScreen() {
  const router = useRouter();
  const { activeDomain } = useWorkspaceDomain();
  const params = useLocalSearchParams<{ domain?: string }>();
  const paramDomain = Array.isArray(params.domain) ? params.domain[0] : params.domain;
  const resolvedDomain = paramDomain || activeDomain;
  const isSailingDomain = String(resolvedDomain || '').toLowerCase().trim() === 'sailing';

  useEffect(() => {
    if (isSailingDomain) return;
    router.replace(guardOnboardingRouteForDomain('/onboarding/first-activity/add-race', resolvedDomain) as any);
  }, [isSailingDomain, resolvedDomain, router]);

  const handleAddRace = async () => {
    // Mark onboarding as seen for returning user detection
    await OnboardingStateService.markOnboardingSeen();
    // Clear onboarding state and navigate directly into add-race flow
    await OnboardingStateService.clearState();
    const returnTo = await AsyncStorage.getItem('post_onboarding_return_to');
    await AsyncStorage.removeItem('post_onboarding_return_to');
    if (returnTo) {
      router.replace(returnTo as any);
    } else {
      router.replace('/(tabs)/race/add-tufte');
    }
  };

  const handleExplore = async () => {
    // Mark onboarding as seen for returning user detection
    await OnboardingStateService.markOnboardingSeen();
    // Clear onboarding state and go to main app
    await OnboardingStateService.clearState();
    const returnTo = await AsyncStorage.getItem('post_onboarding_return_to');
    await AsyncStorage.removeItem('post_onboarding_return_to');
    if (returnTo) {
      router.replace(returnTo as any);
    } else {
      router.replace('/(tabs)/races');
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
            currentStep={10}
            totalSteps={11}
            activeColor="#22C55E"
            inactiveColor="#E2E8F0"
            completedColor="#86EFAC"
          />
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {/* Success Illustration */}
          <Animated.View
            entering={FadeIn.delay(100).duration(500)}
            style={styles.illustrationWrapper}
          >
            <SuccessIllustration />
          </Animated.View>

          {/* Success Message */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(400).springify()}
            style={styles.messageContainer}
          >
            <Text style={styles.title}>You're All Set!</Text>
            <Text style={styles.subtitle}>
              Your account is ready. Add your first race to start tracking your sailing journey.
            </Text>
          </Animated.View>

          {/* Feature Highlights */}
          <Animated.View
            entering={FadeIn.delay(500).duration(400)}
            style={styles.featuresContainer}
          >
            <View style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name="calendar" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.featureText}>Track races & results</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name="cloudy" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.featureText}>Get weather updates</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name="people" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.featureText}>Connect with sailors</Text>
            </View>
          </Animated.View>
        </View>

        {/* Footer Actions */}
        <Animated.View
          entering={FadeInUp.delay(700).duration(400)}
          style={styles.footer}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAddRace}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Add Your First Race</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleExplore}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Explore the App</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationWrapper: {
    marginBottom: 32,
  },
  illustrationContainer: {
    width: 140,
    height: 140,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  sparkles: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FCD34D',
  },
  sparkle1: {
    top: 10,
    left: 20,
  },
  sparkle2: {
    top: 20,
    right: 15,
  },
  sparkle3: {
    bottom: 25,
    left: 10,
  },
  sparkle4: {
    bottom: 15,
    right: 25,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  featuresContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 32,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
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
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
});
