/**
 * Pick the craft — value-funnel screen 1 (replaces the sailing-only
 * showcase's front door; mock: public/onboarding-value-redesign.html).
 *
 * The pick is cached via the existing `onboarding_interest_slug` AsyncStorage
 * key (the same one signup dual-writes and post-signup steps read), so the
 * funnel exit lands the new account in the right interest with zero extra
 * steps. "I'll decide later" keeps the guest path alive with universal copy.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { VALUE_STORY_CHIPS } from '@/lib/onboarding/valueStoryVocab';
import { useInterest } from '@/providers/InterestProvider';

const ACCENT = '#007AFF';

// The chip register is emoji-first; Interest rows carry Ionicons names, so
// map the catalog slugs by hand and fall back to a neutral spark.
const EMOJI_BY_SLUG: Record<string, string> = {
  nursing: '🩺',
  'global-health': '🌍',
  drawing: '✏️',
  design: '🎨',
  knitting: '🧶',
  'fiber-arts': '🪡',
  'painting-printing': '🖌️',
  'sail-racing': '⛵️',
  golf: '⛳️',
  'health-and-fitness': '💪',
  fitness: '🏋️',
  running: '🏃',
  'lifelong-learning': '📚',
  'self-mastery': '🧭',
  'college-career-planning': '🎓',
  'lac-craft-business': '🪔',
  'food-processing': '🫙',
  'textile-weaving': '🧵',
  'regenerative-agriculture': '🌱',
  entrepreneur: '💼',
  gardening: '🥕',
  painting: '🖼️',
  tailoring: '✂️',
};
const FALLBACK_EMOJI = '✨';

interface ChipItem {
  slug: string;
  label: string;
  emoji: string;
}

interface ChipSection {
  key: string;
  title: string | null;
  chips: ChipItem[];
}

export default function PickCraftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const { groupedInterests } = useInterest();

  // Full catalog grouped by domain — the same list the in-app interest
  // picker shows. Until it loads (or if it fails), fall back to the seven
  // curated story chips so the funnel never renders empty.
  const sections = useMemo<ChipSection[]>(() => {
    const grouped = groupedInterests
      .map((group) => ({
        key: group.domain.slug,
        title: group.domain.name,
        // Pre-signup surface: official catalog only — user-proposed
        // interests (someone's "Team Racing" proposal) don't belong on
        // the marketing funnel.
        chips: group.interests
          .filter((i) => i.type === 'official')
          .map((i) => ({
            slug: i.slug,
            label: i.name,
            emoji: EMOJI_BY_SLUG[i.slug] ?? FALLBACK_EMOJI,
          })),
      }))
      .filter((s) => s.chips.length > 0);
    if (grouped.length > 0) return grouped;
    return [
      {
        key: 'fallback',
        title: null,
        chips: VALUE_STORY_CHIPS.map((story) => ({
          slug: story.slug,
          label: story.chipLabel,
          emoji: story.emoji,
        })),
      },
    ];
  }, [groupedInterests]);

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
        <View style={styles.brandRow}>
          <BrandMark size={28} />
          <Text style={styles.brandWordmark}>BetterAt</Text>
        </View>
        <Text style={styles.title}>What are you getting better at?</Text>
        <Text style={styles.subtitle}>
          One thing you’re working on. You can add more later.
        </Text>

        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            {section.title ? (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            ) : null}
            <View style={styles.chips}>
              {section.chips.map((chip) => {
                const active = selected === chip.slug;
                return (
                  <Pressable
                    key={chip.slug}
                    onPress={() => setSelected(active ? null : chip.slug)}
                    style={[styles.chip, active && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={chip.label}
                  >
                    <Text style={styles.chipEmoji}>{chip.emoji}</Text>
                    <Text style={[styles.chipLabel, active && styles.chipLabelSelected]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },
  brandWordmark: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#0B1A33',
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
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(60,60,67,0.45)',
    marginBottom: 10,
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
