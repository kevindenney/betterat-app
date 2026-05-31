/**
 * Privacy Quick-Set Screen
 *
 * Lightweight privacy awareness screen shown between trial-activation and
 * org-welcome/org-discovery. Lets users quickly set key privacy preferences
 * without the full settings page.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Switch,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/providers/AuthProvider';
import { updateProfilePrivacy } from '@/services/PrivacySettingsService';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';
import { getVisibilityLabels } from '@/lib/vocabulary';
import type { TimelineStepVisibility } from '@/types/timeline-steps';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('PrivacyQuickSet');

const VISIBILITY_OPTIONS: { value: TimelineStepVisibility; label: string; description: string }[] = [
  { value: 'private', label: 'Private', description: 'Only you' },
  { value: 'crew', label: 'Collaborators', description: 'People you practice with' },
  { value: 'fleet', label: 'Group', description: 'Your active group or cohort' },
  { value: 'public', label: 'Public', description: 'Anyone who can view your public steps' },
];

export default function PrivacyQuickSetScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [interestSlug, setInterestSlug] = useState<string | null>(null);
  const [profilePublic, setProfilePublic] = useState(false);
  const [peerVisibility, setPeerVisibility] = useState(true);
  const [stepVisibility, setStepVisibility] = useState<TimelineStepVisibility>('private');
  const [isSaving, setIsSaving] = useState(false);
  // Prevent click-through from previous screen on web (events bleed through during transitions)
  const [interactable, setInteractable] = useState(Platform.OS !== 'web');
  const hasNavigatedRef = React.useRef(false);

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => setInteractable(true), 400);
      return () => clearTimeout(timer);
    }
  }, []);

  // Load interest slug for theming
  React.useEffect(() => {
    AsyncStorage.getItem('onboarding_interest_slug').then(setInterestSlug);
  }, []);

  const ctx = getOnboardingContext(interestSlug || undefined);
  const accentColor = ctx.color !== '#1A1A1A' ? ctx.color : '#2563EB';

  const navigateNext = useCallback(async () => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;

    const orgSlug = await AsyncStorage.getItem('onboarding_org_slug');
    const interest = await AsyncStorage.getItem('onboarding_interest_slug');

    if (orgSlug) {
      router.replace('/onboarding/org-welcome');
    } else if (interest) {
      router.replace('/onboarding/org-discovery');
    } else {
      router.replace('/onboarding/explore-interests');
    }
  }, [router]);

  const handleContinue = useCallback(async () => {
    if (!user?.id) {
      await navigateNext();
      return;
    }

    setIsSaving(true);
    try {
      await updateProfilePrivacy(user.id, {
        profile_public: profilePublic,
        allow_peer_visibility: peerVisibility,
        default_step_visibility: stepVisibility,
      });
    } catch (err) {
      logger.warn('Failed to save privacy settings, continuing anyway', err);
    } finally {
      setIsSaving(false);
      await navigateNext();
    }
  }, [user?.id, profilePublic, peerVisibility, stepVisibility, navigateNext]);

  const handleSkip = useCallback(async () => {
    await navigateNext();
  }, [navigateNext]);

  const cycleVisibility = useCallback(() => {
    const currentIndex = VISIBILITY_OPTIONS.findIndex((o) => o.value === stepVisibility);
    const nextIndex = (currentIndex + 1) % VISIBILITY_OPTIONS.length;
    setStepVisibility(VISIBILITY_OPTIONS[nextIndex].value);
  }, [stepVisibility]);

  const currentVisibilityOption = VISIBILITY_OPTIONS.find((o) => o.value === stepVisibility);
  const visLabels = getVisibilityLabels(interestSlug);
  const currentVisibilityLabel =
    stepVisibility === 'crew'
      ? visLabels.crew
      : stepVisibility === 'fleet'
        ? visLabels.fleet
        : currentVisibilityOption?.label;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Icon */}
          <Animated.View
            entering={FadeIn.delay(100).duration(400)}
            style={styles.iconContainer}
          >
            <View style={[styles.iconCircle, { backgroundColor: accentColor + '15' }]}>
              <Ionicons name="shield-checkmark" size={36} color={accentColor} />
            </View>
          </Animated.View>

          {/* Headline */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(500).springify()}
            style={styles.headlineContainer}
          >
            <Text style={styles.headline}>Your privacy, your choice</Text>
            <Text style={styles.subheadline}>
              Choose who can see your profile and progress. You can always change these later in Settings.
            </Text>
          </Animated.View>

          {/* Settings */}
          <Animated.View
            entering={FadeIn.delay(400).duration(400)}
            style={styles.settingsContainer}
          >
            {/* Profile Public */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: '#3B82F615' }]}>
                  <Ionicons name="person" size={18} color="#3B82F6" />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Profile visible to others</Text>
                  <Text style={styles.settingDescription}>
                    Let others find you by name
                  </Text>
                </View>
              </View>
              <Switch
                value={profilePublic}
                onValueChange={setProfilePublic}
                trackColor={{ false: '#E2E8F0', true: accentColor + '60' }}
                thumbColor={profilePublic ? accentColor : '#F4F4F5'}
              />
            </View>

            {/* Peer Visibility */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: '#8B5CF615' }]}>
                  <Ionicons name="people" size={18} color="#8B5CF6" />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Share progress with peers</Text>
                  <Text style={styles.settingDescription}>
                    Others in your program can see your progress
                  </Text>
                </View>
              </View>
              <Switch
                value={peerVisibility}
                onValueChange={setPeerVisibility}
                trackColor={{ false: '#E2E8F0', true: accentColor + '60' }}
                thumbColor={peerVisibility ? accentColor : '#F4F4F5'}
              />
            </View>

            {/* Step Visibility */}
            <TouchableOpacity style={styles.settingRow} onPress={cycleVisibility} activeOpacity={0.7}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: '#059669' + '15' }]}>
                  <Ionicons name="eye" size={18} color="#059669" />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Default step visibility</Text>
                  <Text style={styles.settingDescription}>
                    Who sees your new timeline steps
                  </Text>
                </View>
              </View>
              <View style={styles.visibilityPill}>
                <Text style={[styles.visibilityPillText, { color: accentColor }]}>
                  {currentVisibilityLabel}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={accentColor} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Footer */}
        <Animated.View
          entering={FadeIn.delay(600).duration(300)}
          style={styles.footer}
        >
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton} disabled={!interactable}>
            <Text style={styles.skipText}>Keep defaults</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: accentColor, shadowColor: accentColor }]}
            onPress={handleContinue}
            disabled={isSaving || !interactable}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>
              {isSaving ? 'Saving...' : 'Continue'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
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
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 40 : 48,
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headlineContainer: {
    marginBottom: 36,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subheadline: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
  },
  settingsContainer: {
    gap: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 17,
  },
  visibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  visibilityPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 36,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  skipText: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },
  continueButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
