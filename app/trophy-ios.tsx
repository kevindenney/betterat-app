/**
 * Trophy of Becoming — iOS register preview
 *
 * Ninth iOS-register preview surface. Path-completion synthesis artifact.
 * Six elements on the surface; four typographic, one 60×1px line, one
 * floating nav. The whole composition vertically centered.
 *
 * Architectural commitments (from the design's side rail):
 *   - Italic 32px title — the only iOS register that breaks upright.
 *     Licensed because the title is literal user speech, not chrome.
 *   - Full-bleed #FAFAFA (half-step warmer than system gray 6 — Apple
 *     Books book-detail trick). If you can name the color shift
 *     consciously, it's gone too far.
 *   - Trophy doesn't scroll. What you see is the whole surface.
 *   - The coral rule is the entire ornamental vocabulary. 60px wide,
 *     1px tall. Not a divider; a margin pencil mark.
 *
 * Four state variants ship behind FEATURE_FLAGS.TROPHY_IOS_REGISTER:
 *   first         — Felix's very first trophy ever (above-title eyebrow)
 *   canonical     — earned trophy with capability + context
 *   mid-career    — canonical + carousel dots + Previous affordance
 *   named-absence — italic quote names a stop; "What you stopped doing" eyebrow
 *   empty         — no trophy yet; system speaks once in upright voice
 *
 * Open at /trophy-ios. Variant selectable via ?variant=first|canonical|mid-career|named-absence|empty.
 *
 * Wire-up status:
 *   - Variant + content + series come from the data layer via the
 *     TrophyScreen props in a follow-up wiring commit. Real Trophy data
 *     depends on a completed-path synthesis service that doesn't exist
 *     yet — it would extract one standout sentence from path-completion
 *     reflections + map to the completed capability + path metadata.
 */

import React from 'react';
import { View, Pressable, StyleSheet, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  TrophyScreen,
  TROPHY_BG,
  type TrophyVariant,
  type TrophyContent,
  type TrophySeriesContext,
} from '@/components/ios-register';

const VALID_VARIANTS: TrophyVariant[] = [
  'first',
  'canonical',
  'mid-career',
  'named-absence',
  'empty',
];

// Sample fixtures drawn straight from the design HTML; real Trophy data
// comes from the path-completion synthesis service when it lands.
const SAMPLE_CONTENT: Record<TrophyVariant, TrophyContent> = {
  first: {
    quote: 'I’m not pinching anymore when the gust hits.',
    attribution: 'From your Race 1 Debrief · Sunday, January 19',
    capabilityLabel: 'Upwind trim under pressure',
    contextSpans: ['Week 1 of 12', 'Spring Series', 'RHKYC'],
  },
  canonical: {
    quote: 'I can read the shift now before I have to commit.',
    attribution: 'From your Race 4 Debrief · Sunday, March 23',
    capabilityLabel: 'Heavy-air helm work',
    contextSpans: ['Week 7 of 12', 'Spring Series', 'RHKYC'],
  },
  'mid-career': {
    quote: 'I can read the shift now before I have to commit.',
    attribution: 'From your Race 4 Debrief · Sunday, March 23',
    capabilityLabel: 'Heavy-air helm work',
    contextSpans: ['Week 7 of 12', 'Spring Series', 'RHKYC'],
  },
  'named-absence': {
    quote: 'I stopped trying to muscle through and just trusted the boat.',
    attribution: 'From your Race 6 Debrief · Sunday, April 6',
    capabilityLabel: 'What you stopped doing',
    contextSpans: ['Week 9 of 12', 'Spring Series', 'RHKYC'],
  },
  empty: {},
};

const SAMPLE_MID_CAREER_SERIES: TrophySeriesContext = {
  total: 5,
  currentIndex: 5,
  hasPrevious: true,
};

function resolveVariant(raw: unknown): TrophyVariant {
  if (typeof raw === 'string' && (VALID_VARIANTS as string[]).includes(raw)) {
    return raw as TrophyVariant;
  }
  return 'canonical';
}

export default function TrophyIosPreview() {
  const params = useLocalSearchParams<{ variant?: string }>();
  const variant = resolveVariant(params.variant);
  const content = SAMPLE_CONTENT[variant];
  const series = variant === 'mid-career' ? SAMPLE_MID_CAREER_SERIES : undefined;

  return (
    <View style={[styles.page, { backgroundColor: TROPHY_BG }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topChrome}>
          <VariantSelector activeVariant={variant} />
          <Pressable
            style={styles.glyphBtn}
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : null)}
            accessibilityLabel="Close iOS preview"
          >
            <Ionicons
              name="close"
              size={22}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
        </View>

        <TrophyScreen
          variant={variant}
          content={content}
          series={series}
        />
      </SafeAreaView>
    </View>
  );
}

/**
 * Tiny preview-mode picker so reviewers can cycle the four variants without
 * editing the URL. Hidden in any data-driven wiring path; the cutover-time
 * Trophy entry point passes the variant directly to TrophyScreen.
 */
function VariantSelector({ activeVariant }: { activeVariant: TrophyVariant }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.variantsRow}
    >
      {VALID_VARIANTS.map((v) => {
        const on = v === activeVariant;
        return (
          <Pressable
            key={v}
            onPress={() => router.setParams({ variant: v })}
            style={[styles.variantChip, on && styles.variantChipOn]}
          >
            <Text style={[styles.variantChipText, on && styles.variantChipTextOn]}>
              {variantLabel(v)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function variantLabel(v: TrophyVariant): string {
  switch (v) {
    case 'first':
      return 'First';
    case 'canonical':
      return 'Canonical';
    case 'mid-career':
      return 'Mid-career';
    case 'named-absence':
      return 'Absence';
    case 'empty':
      return 'Empty';
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    gap: 8,
  },
  glyphBtn: { padding: 6 },
  variantsRow: {
    gap: 6,
    paddingRight: 4,
    alignItems: 'center',
  },
  variantChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(60, 60, 67, 0.06)',
  },
  variantChipOn: {
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
  },
  variantChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
  },
  variantChipTextOn: {
    color: IOS_REGISTER.label,
  },
});
