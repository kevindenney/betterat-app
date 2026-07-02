/**
 * Pick the craft — value-funnel screen 1 (replaces the sailing-only
 * showcase's front door; mock: public/onboarding-value-redesign.html).
 *
 * The pick is cached via the existing `onboarding_interest_slug` AsyncStorage
 * key (the same one signup dual-writes and post-signup steps read), so the
 * funnel exit lands the new account in the right interest with zero extra
 * steps. "I'll decide later" keeps the guest path alive with universal copy.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily } from '@/lib/design-tokens-editorial';
import { VALUE_STORY_CHIPS } from '@/lib/onboarding/valueStoryVocab';

const ACCENT = '#007AFF';

export default function PickCraftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  const continueWith = async (slug: string | null) => {
    if (slug) {
      await AsyncStorage.setItem('onboarding_interest_slug', slug).catch(() => {});
    }
    router.push(
      slug
        ? (`/onboarding/value/loop?interest=${slug}` as never)
        : ('/onboarding/value/loop' as never),
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>BETTERAT</Text>
        <Text style={styles.title}>What are you getting better at?</Text>
        <Text style={styles.subtitle}>
          One thing you’re working on. You can add more later.
        </Text>

        <View style={styles.chips}>
          {VALUE_STORY_CHIPS.map((story) => {
            const active = selected === story.slug;
            return (
              <Pressable
                key={story.slug}
                onPress={() => setSelected(active ? null : story.slug)}
                style={[styles.chip, active && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={story.chipLabel}
              >
                <Text style={styles.chipEmoji}>{story.emoji}</Text>
                <Text style={[styles.chipLabel, active && styles.chipLabelSelected]}>
                  {story.chipLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => continueWith(selected)}
          disabled={!selected}
          style={[styles.cta, !selected && styles.ctaDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
        <Pressable
          onPress={() => continueWith(null)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="I'll decide later"
        >
          <Text style={styles.skip}>I’ll decide later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: ACCENT,
    marginBottom: 10,
  },
  title: {
    fontFamily: fontFamily.serif,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
    color: '#1C1C1E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(60,60,67,0.6)',
    marginBottom: 24,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.16)',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  chipLabelSelected: {
    color: ACCENT,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 14,
  },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skip: {
    textAlign: 'center',
    fontSize: 13.5,
    color: 'rgba(60,60,67,0.5)',
  },
});
