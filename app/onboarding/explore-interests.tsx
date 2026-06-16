/**
 * Explore Interests Screen
 *
 * "Interested in anything else?" — shown near the end of onboarding.
 * Lets users discover and add additional interests before entering the app.
 * Completely skippable — a discovery moment, not a gate.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useInterest, type Interest } from '@/providers/InterestProvider';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';
import { supabase } from '@/services/supabase';
import { commitOnboardingInterest } from '@/services/onboarding/commitSignupContext';

const FALLBACK_ONBOARDING_INTERESTS: Interest[] = [
  {
    id: 'bec249c5-6412-4d16-bb84-bfcfb887ff67',
    slug: 'nursing',
    name: 'Nursing',
    description: null,
    parent_id: null,
    type: 'official',
    status: 'active',
    visibility: 'public',
    accent_color: '#0097A7',
    icon_name: 'pulse',
    organization_id: null,
    hero_tagline: null,
    pricing_text: null,
    web_app_url: null,
    created_at: '',
  },
  {
    id: '5e6b64c3-ea92-42a1-baf5-9342c53eb7d9',
    slug: 'sail-racing',
    name: 'Sail Racing',
    description: null,
    parent_id: null,
    type: 'official',
    status: 'active',
    visibility: 'public',
    accent_color: '#003DA5',
    icon_name: 'boat',
    organization_id: null,
    hero_tagline: null,
    pricing_text: null,
    web_app_url: null,
    created_at: '',
  },
  {
    id: 'b31dbc01-7892-4f63-9697-84b05546f595',
    slug: 'drawing',
    name: 'Drawing',
    description: null,
    parent_id: null,
    type: 'official',
    status: 'active',
    visibility: 'public',
    accent_color: '#F4511E',
    icon_name: 'pencil',
    organization_id: null,
    hero_tagline: null,
    pricing_text: null,
    web_app_url: null,
    created_at: '',
  },
  {
    id: 'f138e519-7ac9-4497-a0ee-fba242482bce',
    slug: 'fitness',
    name: 'Fitness',
    description: null,
    parent_id: null,
    type: 'official',
    status: 'active',
    visibility: 'public',
    accent_color: '#43A047',
    icon_name: 'barbell',
    organization_id: null,
    hero_tagline: null,
    pricing_text: null,
    web_app_url: null,
    created_at: '',
  },
];

export default function ExploreInterestsScreen() {
  const router = useRouter();
  const { allInterests, addInterest, switchInterest } = useInterest();

  const [interestSlug, setInterestSlug] = useState<string | null>(null);
  const [addedSlugs, setAddedSlugs] = useState<Set<string>>(new Set());
  const addedSlugsRef = useRef<Set<string>>(new Set());
  const [fallbackInterests, setFallbackInterests] = useState<Interest[]>([]);

  // Initialize with only the primary onboarding interest as selected
  useEffect(() => {
    AsyncStorage.getItem('onboarding_interest_slug').then((slug) => {
      setInterestSlug(slug);
      if (slug) {
        const next = new Set([slug]);
        addedSlugsRef.current = next;
        setAddedSlugs(next);
      }
    });
  }, []);

  const ctx = getOnboardingContext(interestSlug || undefined);
  const accentColor = ctx.color !== '#1A1A1A' ? ctx.color : '#007AFF';

  // Show public, active interests — exclude the domain-level parents
  const providerBrowsableInterests = useMemo(() => {
    return allInterests.filter(
      (i) =>
        i.status === 'active' &&
        i.visibility === 'public' &&
        i.type !== 'domain',
    );
  }, [allInterests]);

  useEffect(() => {
    if (providerBrowsableInterests.length > 0 || fallbackInterests.length > 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('interests')
        .select('id, slug, name, description, parent_id, type, status, visibility, accent_color, icon_name, organization_id, hero_tagline, pricing_text, web_app_url, created_at')
        .eq('status', 'active')
        .eq('visibility', 'public')
        .order('name');

      if (!cancelled && !error) {
        setFallbackInterests((data ?? []) as Interest[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providerBrowsableInterests.length, fallbackInterests.length]);

  const browsableInterests = useMemo(() => {
    const fallbackBrowsable = fallbackInterests.filter(
      (i) =>
        i.status === 'active' &&
        i.visibility === 'public' &&
        i.type !== 'domain',
    );
    if (providerBrowsableInterests.length > 0) return providerBrowsableInterests;
    if (fallbackBrowsable.length > 0) return fallbackBrowsable;
    return FALLBACK_ONBOARDING_INTERESTS;
  }, [fallbackInterests, providerBrowsableInterests]);

  const handleToggleInterest = useCallback(
    (interest: Interest) => {
      const isAdded = addedSlugs.has(interest.slug);

      // Don't allow removing the primary interest they signed up with
      if (isAdded && interest.slug === interestSlug) return;

      setAddedSlugs((prev) => {
        const next = new Set(prev);
        if (isAdded) {
          next.delete(interest.slug);
        } else {
          next.add(interest.slug);
        }
        addedSlugsRef.current = next;
        return next;
      });
    },
    [addedSlugs, interestSlug],
  );

  const handleContinue = useCallback(async () => {
    // Set primary interest FIRST — before hiding others — so the InterestProvider's
    // auto-set effect doesn't pick the first alphabetical interest (e.g. Drawing) when
    // activeSlug is null for new users.
    if (interestSlug) {
      await switchInterest(interestSlug);
    }

    // Add all selected interests to user_interests table
    const selectedSlugs = new Set(addedSlugsRef.current);
    if (interestSlug) selectedSlugs.add(interestSlug);
    const visibleSlugs = Array.from(selectedSlugs);
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData.session?.user.id;
    for (const slug of visibleSlugs) {
      if (sessionUserId) {
        await commitOnboardingInterest(sessionUserId, slug);
      } else {
        await addInterest(slug);
      }
    }

    // Store ordered interest slugs so manifesto screen can loop through them
    // Primary interest first
    const primaryFirst = [interestSlug, ...visibleSlugs.filter(s => s !== interestSlug)].filter(Boolean);
    await AsyncStorage.setItem('onboarding_interest_order', JSON.stringify(primaryFirst));

    // Continue to manifesto screen (skippable — handles its own nav to main app)
    router.replace('/onboarding/manifesto');
  }, [router, addInterest, switchInterest, interestSlug]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Headline */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(500).springify()}
            style={styles.headlineContainer}
          >
            <Text style={styles.headline}>Interested in anything else?</Text>
            <Text style={styles.subheadline}>
              BetterAt supports many interests. You can always add or remove these later.
            </Text>
          </Animated.View>

          {/* Interest Grid */}
          <Animated.View
            entering={FadeIn.delay(300).duration(400)}
            style={styles.grid}
          >
            {browsableInterests.map((interest, index) => {
              const isAdded = addedSlugs.has(interest.slug);
              const isPrimary = interest.slug === interestSlug;
              const chipColor = interest.accent_color || '#64748B';

              return (
                <Animated.View
                  key={interest.id}
                  entering={FadeIn.delay(350 + index * 40).duration(300)}
                >
                  <TouchableOpacity
                    testID={`explore-interest-${interest.slug}`}
                    style={[
                      styles.chip,
                      isAdded && { backgroundColor: chipColor + '15', borderColor: chipColor },
                    ]}
                    onPress={() => handleToggleInterest(interest)}
                    activeOpacity={0.7}
                    disabled={isPrimary}
                  >
                    {interest.icon_name && (
                      <Ionicons
                        name={(interest.icon_name as keyof typeof Ionicons.glyphMap) || 'compass'}
                        size={16}
                        color={isAdded ? chipColor : '#94A3B8'}
                      />
                    )}
                    <Text
                      style={[
                        styles.chipText,
                        isAdded && { color: chipColor, fontWeight: '600' },
                      ]}
                    >
                      {interest.name}
                    </Text>
                    {isAdded && (
                      <Ionicons
                        name={isPrimary ? 'star' : 'checkmark-circle'}
                        size={16}
                        color={chipColor}
                      />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.View>
        </ScrollView>

        {/* Footer */}
        <Animated.View
          entering={FadeIn.delay(500).duration(300)}
          style={styles.footer}
        >
          <TouchableOpacity
            testID="explore-interests-continue"
            style={[styles.continueButton, { backgroundColor: accentColor, shadowColor: accentColor }]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 24,
  },
  headlineContainer: {
    marginBottom: 32,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 36,
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
