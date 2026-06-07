/**
 * Choose Starting Timeline Screen
 *
 * After vision entries, the user picks which interest timeline to land on.
 * Shows a card for each selected interest — tap one to begin.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInterest, type Interest } from '@/providers/InterestProvider';
import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService';

export default function ChooseStartScreen() {
  const router = useRouter();
  const { allInterests, switchInterest } = useInterest();

  const [orderedInterests, setOrderedInterests] = useState<Interest[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const orderedSetRef = useRef(false);

  // Load ordered interest slugs from AsyncStorage
  useEffect(() => {
    if (orderedSetRef.current || allInterests.length === 0) return;
    Promise.all([
      AsyncStorage.getItem('onboarding_interest_order'),
      AsyncStorage.getItem('onboarding_interest_slug'),
    ]).then(([raw, primarySlug]) => {
      if (orderedSetRef.current) return;
      const bySlug = new Map(allInterests.map((i) => [i.slug, i]));

      let slugs: string[] = [];
      if (raw) {
        try {
          slugs = JSON.parse(raw);
        } catch {}
      }

      if (primarySlug) {
        slugs = [primarySlug, ...slugs.filter((s) => s !== primarySlug)];
      }
      if (slugs.length === 0 && primarySlug) {
        slugs = [primarySlug];
      }

      const ordered = slugs
        .map((s) => bySlug.get(s))
        .filter((i): i is Interest => !!i);

      if (ordered.length > 0) {
        orderedSetRef.current = true;
        setOrderedInterests(ordered);
        setSelectedSlug(ordered[0].slug); // default to primary
      }
    });
  }, [allInterests]);

  const handleSelect = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const handleGo = useCallback(async () => {
    if (!selectedSlug || isNavigating) return;
    setIsNavigating(true);

    await switchInterest(selectedSlug);
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
      // Final onboarding beat: offer Telegram capture before entering the app.
      router.replace('/onboarding/connect-telegram');
    }
  }, [router, selectedSlug, switchInterest, isNavigating]);

  // If only one interest, skip choice and go straight
  useEffect(() => {
    if (orderedInterests.length === 1 && !isNavigating) {
      handleGo();
    }
  }, [orderedInterests, handleGo, isNavigating]);

  const selectedInterest = orderedInterests.find((i) => i.slug === selectedSlug);
  const accentColor = selectedInterest?.accent_color || '#2563EB';

  return (
    <View style={styles.container}>
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
            <View style={[styles.iconCircle, { backgroundColor: accentColor + '15' }]}>
              <Ionicons name="rocket-outline" size={32} color={accentColor} />
            </View>
            <Text style={styles.headline}>Where do you want to start?</Text>
            <Text style={styles.subheadline}>
              Pick the timeline you'd like to dive into first. You can switch anytime.
            </Text>
          </Animated.View>

          {/* Interest cards */}
          <View style={styles.cardList}>
            {orderedInterests.map((interest, index) => {
              const isSelected = interest.slug === selectedSlug;
              const color = interest.accent_color || '#64748B';

              return (
                <Animated.View
                  key={interest.id}
                  entering={FadeIn.delay(250 + index * 80).duration(350)}
                >
                  <TouchableOpacity
                    style={[
                      styles.card,
                      isSelected && {
                        borderColor: color,
                        backgroundColor: color + '08',
                        shadowColor: color,
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 4,
                      },
                    ]}
                    onPress={() => handleSelect(interest.slug)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.cardIcon, { backgroundColor: color + '15' }]}>
                      <Ionicons
                        name={
                          (interest.icon_name as keyof typeof Ionicons.glyphMap) ||
                          'compass'
                        }
                        size={24}
                        color={color}
                      />
                    </View>
                    <View style={styles.cardContent}>
                      <Text style={[styles.cardTitle, isSelected && { color }]}>
                        {interest.name}
                      </Text>
                      {interest.description ? (
                        <Text style={styles.cardDescription} numberOfLines={2}>
                          {interest.description}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={color} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>

        {/* Footer */}
        <Animated.View
          entering={FadeIn.delay(500).duration(300)}
          style={styles.footer}
        >
          <TouchableOpacity
            style={[
              styles.goButton,
              { backgroundColor: accentColor, shadowColor: accentColor },
            ]}
            onPress={handleGo}
            activeOpacity={0.85}
            disabled={isNavigating || !selectedSlug}
          >
            <Text style={styles.goButtonText}>
              {isNavigating ? 'Loading...' : "Let's go"}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 24,
  },
  headlineContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
    maxWidth: 340,
  },
  cardList: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 36,
  },
  goButton: {
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
  goButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
