/**
 * Manifesto Onboarding Screen
 *
 * "What's your vision?" — shown after explore-interests.
 * Loops through each selected interest, prompting the user to write a manifesto.
 * Fully skippable — they can always fill it in later from Library.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInterest, type Interest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { getOrCreateManifesto, updateManifesto, parseManifestoWithAI } from '@/services/ManifestoService';
import { useUpdateLifetimeVision } from '@/hooks/useInterestVision';
import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService';

export default function ManifestoOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { allInterests, switchInterest } = useInterest();
  const updateLifetimeVision = useUpdateLifetimeVision();

  const [orderedInterests, setOrderedInterests] = useState<Interest[]>([]);
  const orderedSetRef = useRef(false);
  const [interestIndex, setInterestIndex] = useState(0);
  const [text, setText] = useState('');
  const [manifestoId, setManifestoId] = useState<string | null>(null);
  const [philosophies, setPhilosophies] = useState<string[]>([]);
  const [roleModels, setRoleModels] = useState<string[]>([]);
  const [cadence, setCadence] = useState<Record<string, number | string | undefined>>({});
  const [isSaving, setIsSaving] = useState(false);
  const parseTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Prevent click-through from previous screen on web (events bleed through during transitions)
  const [interactable, setInteractable] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => setInteractable(true), 400);
      return () => clearTimeout(timer);
    }
  }, []);

  const activeInterest = orderedInterests[interestIndex] ?? null;
  const totalInterests = orderedInterests.length;
  const interestName = activeInterest?.name || 'your interest';
  const accentColor = activeInterest?.accent_color || '#007AFF';

  // Load ordered interest slugs from AsyncStorage and match to Interest objects (set once).
  // Reads both the ordered list and the primary slug to guarantee primary is always first.
  useEffect(() => {
    if (orderedSetRef.current || allInterests.length === 0) return;
    Promise.all([
      AsyncStorage.getItem('onboarding_interest_order'),
      AsyncStorage.getItem('onboarding_interest_slug'),
    ]).then(([raw, primarySlug]) => {
      if (orderedSetRef.current) return;
      const bySlug = new Map(allInterests.map(i => [i.slug, i]));

      let slugs: string[] = [];
      if (raw) {
        try { slugs = JSON.parse(raw); } catch {}
      }

      // Ensure primary slug is present and first
      if (primarySlug) {
        slugs = [primarySlug, ...slugs.filter(s => s !== primarySlug)];
      }

      // Fall back to just the primary interest if no order was stored
      if (slugs.length === 0 && primarySlug) {
        slugs = [primarySlug];
      }

      const ordered = slugs
        .map(s => bySlug.get(s))
        .filter((i): i is Interest => !!i);
      if (ordered.length > 0) {
        orderedSetRef.current = true;
        setOrderedInterests(ordered);
      }
    });
  }, [allInterests]);

  // Reset form state when activeInterest changes
  useEffect(() => {
    setText('');
    setManifestoId(null);
    setPhilosophies([]);
    setRoleModels([]);
    setCadence({});
  }, [activeInterest?.id]);

  // Initialize manifesto for current interest
  useEffect(() => {
    if (!user?.id || !activeInterest?.id) return;
    getOrCreateManifesto(user.id, activeInterest.id)
      .then((m) => {
        setManifestoId(m.id);
        if (m.content?.trim()) {
          setText(m.content);
          setPhilosophies(m.philosophies ?? []);
          setRoleModels(m.role_models ?? []);
          setCadence(m.weekly_cadence ?? {});
        }
      })
      .catch(() => {});
  }, [user?.id, activeInterest?.id]);

  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);

      // Debounce AI parsing
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
      parseTimerRef.current = setTimeout(async () => {
        if (!newText.trim() || !manifestoId) return;
        try {
          const extracted = await parseManifestoWithAI(newText, interestName);
          setPhilosophies(extracted.philosophies);
          setRoleModels(extracted.role_models);
          setCadence(extracted.weekly_cadence);
        } catch {}
      }, 2000);
    },
    [manifestoId, interestName],
  );

  const finalizeOnboarding = useCallback(async () => {
    // If multiple interests, let user choose which timeline to start with
    if (orderedInterests.length > 1) {
      router.replace('/onboarding/choose-start');
      return;
    }

    // Single interest — go straight to app
    if (orderedInterests.length > 0) {
      await switchInterest(orderedInterests[0].slug);
    }
    await OnboardingStateService.markOnboardingSeen();
    const returnTo = await AsyncStorage.getItem('post_onboarding_return_to');
    await Promise.all([
      AsyncStorage.removeItem('onboarding_org_slug'),
      AsyncStorage.removeItem('onboarding_interest_slug'),
      AsyncStorage.removeItem('onboarding_interest_order'),
      AsyncStorage.removeItem('post_onboarding_return_to'),
    ]);
    if (returnTo) {
      router.replace(returnTo as any);
    } else {
      router.replace('/(tabs)/races');
    }
  }, [router, orderedInterests, switchInterest]);

  const saveCurrentAndAdvance = useCallback(async () => {
    // Save current manifesto if there's content
    if (manifestoId && text.trim()) {
      setIsSaving(true);
      try {
        await updateManifesto(manifestoId, {
          content: text,
          philosophies,
          role_models: roleModels,
          weekly_cadence: cadence,
        });
        // The "What's your vision?" prompt is the user's lifetime
        // trajectory for this interest — surface it as the L4 banner.
        // (Onboarding intentionally doesn't capture a season goal, so
        // the L3 season vision stays as its own "add a vision" CTA.)
        if (activeInterest?.id) {
          await updateLifetimeVision.mutateAsync({
            interestId: activeInterest.id,
            lifetime_vision_statement: text.trim(),
          });
        }
      } catch {}
      setIsSaving(false);
    }

    // More interests remaining? Advance index. Otherwise finalize.
    if (interestIndex < totalInterests - 1) {
      setInterestIndex(prev => prev + 1);
    } else {
      await finalizeOnboarding();
    }
  }, [finalizeOnboarding, manifestoId, text, philosophies, roleModels, cadence, interestIndex, totalInterests, activeInterest?.id, updateLifetimeVision]);

  const handleSkip = useCallback(async () => {
    // Skip this interest's manifesto — advance to next or finalize
    if (interestIndex < totalInterests - 1) {
      setInterestIndex(prev => prev + 1);
    } else {
      await finalizeOnboarding();
    }
  }, [finalizeOnboarding, interestIndex, totalInterests]);

  const hasPills = philosophies.length > 0 || roleModels.length > 0 || Object.keys(cadence).length > 0;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Progress indicator */}
            {totalInterests > 1 && (
              <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.progressRow}>
                {orderedInterests.map((interest, i) => (
                  <View
                    key={interest.id}
                    style={[
                      styles.progressDot,
                      i <= interestIndex
                        ? { backgroundColor: accentColor }
                        : { backgroundColor: '#E2E8F0' },
                    ]}
                  />
                ))}
                <Text style={styles.progressText}>
                  {interestIndex + 1} of {totalInterests}
                </Text>
              </Animated.View>
            )}

            {/* Header */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(500).springify()}
              style={styles.headlineContainer}
            >
              <View style={[styles.iconCircle, { backgroundColor: accentColor + '15' }]}>
                <Ionicons name="compass" size={32} color={accentColor} />
              </View>
              <Text style={styles.headline}>What's your vision?</Text>
              <Text style={styles.subheadline}>
                Share what you're working toward in {interestName}. This shapes every suggestion.
              </Text>
            </Animated.View>

            {/* Textarea */}
            <Animated.View
              entering={FadeIn.delay(300).duration(400)}
              style={styles.editorContainer}
            >
              <TextInput
                style={styles.textArea}
                value={text}
                onChangeText={handleTextChange}
                placeholder={`What are your goals? What approach do you follow? What does a good week look like?\n\nE.g., "I want to master clinical assessment skills. I'm focused on building confidence with patient interactions, practicing 3x/week in simulation lab..."`}
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                autoFocus={Platform.OS === 'web'}
              />

              {/* AI-extracted pills */}
              {hasPills && (
                <Animated.View entering={FadeIn.duration(300)} style={styles.pillsContainer}>
                  {philosophies.length > 0 && (
                    <View style={styles.pillSection}>
                      <Text style={styles.pillLabel}>PHILOSOPHIES</Text>
                      <View style={styles.pillRow}>
                        {philosophies.map((p, i) => (
                          <View key={i} style={[styles.pill, { backgroundColor: accentColor + '12' }]}>
                            <Ionicons name="bulb-outline" size={11} color={accentColor} />
                            <Text style={[styles.pillText, { color: accentColor }]}>{p}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {roleModels.length > 0 && (
                    <View style={styles.pillSection}>
                      <Text style={styles.pillLabel}>ROLE MODELS</Text>
                      <View style={styles.pillRow}>
                        {roleModels.map((r, i) => (
                          <View key={i} style={[styles.pill, { backgroundColor: '#FFF7ED' }]}>
                            <Ionicons name="person-outline" size={11} color="#D97706" />
                            <Text style={[styles.pillText, { color: '#92400E' }]}>{r}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {Object.keys(cadence).length > 0 && (
                    <View style={styles.pillSection}>
                      <Text style={styles.pillLabel}>WEEKLY CADENCE</Text>
                      <View style={styles.pillRow}>
                        {Object.entries(cadence)
                          .filter(([, v]) => v != null)
                          .map(([key, val], i) => (
                          <View key={i} style={[styles.pill, { backgroundColor: '#F0FDF4' }]}>
                            <Ionicons name="calendar-outline" size={11} color="#16A34A" />
                            <Text style={[styles.pillText, { color: '#166534' }]}>{key}: {String(val)}x/wk</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </Animated.View>
              )}
            </Animated.View>
          </ScrollView>

          {/* Footer */}
          <Animated.View
            entering={FadeIn.delay(500).duration(300)}
            style={styles.footer}
          >
            <TouchableOpacity
              testID="manifesto-skip"
              style={styles.skipButton}
              onPress={handleSkip}
              activeOpacity={0.7}
              disabled={!interactable}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="manifesto-continue"
              style={[
                styles.continueButton,
                { backgroundColor: accentColor, shadowColor: accentColor },
                !text.trim() && styles.continueButtonDisabled,
              ]}
              onPress={saveCurrentAndAdvance}
              activeOpacity={0.85}
              disabled={isSaving || !interactable}
            >
              <Text style={styles.continueButtonText}>
                {isSaving ? 'Saving...' : text.trim() ? 'Save & Continue' : 'Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: 24,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 4,
  },
  headlineContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 360,
  },
  editorContainer: {
    gap: 16,
  },
  textArea: {
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    minHeight: 160,
    lineHeight: 22,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'vertical' } as any,
    }),
  },
  pillsContainer: {
    gap: 12,
  },
  pillSection: {
    gap: 6,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 36,
    gap: 12,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#94A3B8',
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
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
