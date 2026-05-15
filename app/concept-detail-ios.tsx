/**
 * Concept variants — iOS register preview
 *
 * Variant-cycling preview surface for the three Concept detail iOS state
 * variants (new / dormant / breakthrough). Sample content drawn directly
 * from the Claude Design "Concept · Variants · iOS register" handoff so
 * the surface can be reviewed without data wiring.
 *
 * The canonical, data-wired Concept detail still lives at
 * `/concept-ios/[slug]` — that route reads real concept + reflection data
 * and renders the "practicing" mid-voice case. This route exists to
 * exercise the variant-specific structural branches that don't appear
 * yet in real data (forming / dormant / breakthrough).
 *
 * Open at /concept-variants-ios. Variant selectable via
 * ?variant=new|dormant|breakthrough.
 *
 * Wire-up status: visual-only. Real variant selection lands when the
 * data layer ships per-user concept state (forming / practicing / learning /
 * breakthrough) and the dormancy timestamp. The canonical route will
 * consume ConceptDetailScreen with variant + content from a hook.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  ConceptDetailScreen,
  type ConceptDetailContent,
  type ConceptDetailVariant,
} from '@/components/ios-register';

const VALID_VARIANTS: ConceptDetailVariant[] = ['new', 'dormant', 'breakthrough'];

const SAMPLE_CONTENT: Record<ConceptDetailVariant, ConceptDetailContent> = {
  new: {
    title: 'Read the boat before the breeze.',
    stateKind: 'forming',
    metaSpans: ['Named yesterday', '1 reflection'],
    synthesisParagraphs: [
      "One reflection isn't enough to write back to you in your own voice. Keep noting how this shows up — the line will sharpen.",
    ],
    synthesisStamp: 'not yet',
    suggestNextCopy:
      'Note how this came up the next time you practice — even one line. The pattern needs two or three angles before it can be a claim.',
    reflections: [
      {
        id: 'new-1',
        whenParts: ['Yesterday', 'during Race 5'],
        body: 'I was so busy reading the wind, I missed that the boat had already told me what to do.',
        source: 'voice',
        provenance: 'Race 5 Debrief · on the mooring',
        origin: true,
      },
    ],
  },
  dormant: {
    title: 'Start lines reward patience, not aggression.',
    stateKind: 'practicing',
    metaSpans: ['First written Jan 12', '5 reflections'],
    synthesisParagraphs: [
      "The boats that win the start aren't the boats hitting the line at full speed — they're the boats with somewhere to go thirty seconds later. Speed at the gun is a trap if it costs you the lane.",
      'Patience here means holding a hole, not holding back. The aggression I can afford is in the build — not the bang.',
    ],
    synthesisStamp: '4 months ago',
    dormantFooterStamp: 'Last reflection 4 months ago',
    dormantFooterAsk: 'Worth revisiting?',
    totalReflections: 5,
    reflections: [
      {
        id: 'dormant-1',
        whenParts: ['Jan 19', '4 months ago'],
        body: 'Two boats blew past us at the gun and were dead in irons fifteen seconds later. The third boat — the one that held the hole — won the leg.',
        source: 'note',
        provenance: 'Reflect · weeknight note',
      },
      {
        id: 'dormant-2',
        whenParts: ['Jan 15', '4 months ago'],
        body: 'I wanted the bang. The bang cost me the lane.',
        source: 'voice',
        provenance: 'Race 2 Debrief · mooring',
      },
      {
        id: 'dormant-3',
        whenParts: ['Jan 12', '4 months ago'],
        body: 'Patience is a position, not a feeling. Hold the hole.',
        source: 'voice',
        provenance: 'Race 1 Debrief · mooring',
        origin: true,
      },
    ],
  },
  breakthrough: {
    title: 'Lay the boat down, then trim.',
    stateKind: 'breakthrough',
    metaSpans: ['First written Feb 2', '11 reflections'],
    synthesisParagraphs: [
      "Heel sets the shape of the boat in the water. Trim adjusts inside that shape. Trimming a boat that's wrong-heeled is rearranging chairs — the shape was already deciding.",
      'Set the angle first, then ask the sails what they want. The order is the thing.',
    ],
    synthesisStamp: 'yesterday',
    aiOfferLabel: 'We noticed a shift',
    aiOfferBody:
      'Three of your recent reflections cluster around lay the boat down, then trim moving from practicing to settled. Want to write what changed?',
    totalReflections: 11,
    reflections: [
      {
        id: 'br-1',
        whenParts: ['Yesterday', 'Race 6'],
        body: "I didn't think about trim once on the third leg. The boat was already where it needed to be.",
        source: 'voice',
        provenance: 'Race 6 Debrief · mooring',
      },
      {
        id: 'br-2',
        whenParts: ['Last Sunday', 'Race 5'],
        body: "Sam noticed mid-beat that I'd stopped chasing the traveler. The heel was right, so the sails were right. First time I felt that as cause-and-effect.",
        source: 'note',
        provenance: 'Reflect · Sunday evening',
      },
      {
        id: 'br-3',
        whenParts: ['Two Sundays ago', 'Race 4'],
        body: "I'm not trimming a wrong-heeled boat anymore. The heel comes first.",
        source: 'voice',
        provenance: 'Race 4 Debrief · mooring',
      },
    ],
  },
};

function resolveVariant(raw: unknown): ConceptDetailVariant {
  if (typeof raw === 'string' && (VALID_VARIANTS as string[]).includes(raw)) {
    return raw as ConceptDetailVariant;
  }
  return 'new';
}

export default function ConceptVariantsIosPreview() {
  const params = useLocalSearchParams<{ variant?: string }>();
  const variant = resolveVariant(params.variant);
  const content = SAMPLE_CONTENT[variant];

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.previewChrome}>
          <VariantSelector active={variant} />
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : null)}
            accessibilityLabel="Close iOS preview"
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Ionicons
              name="close"
              size={22}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
        </View>

        <ConceptDetailScreen
          variant={variant}
          content={content}
          mode="read"
          onBack={() => (router.canGoBack() ? router.back() : null)}
        />
      </SafeAreaView>
    </View>
  );
}

function VariantSelector({ active }: { active: ConceptDetailVariant }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.variantsRow}
    >
      {VALID_VARIANTS.map((v) => {
        const on = v === active;
        return (
          <Pressable
            key={v}
            onPress={() => router.setParams({ variant: v })}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>
              {variantLabel(v)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function variantLabel(v: ConceptDetailVariant): string {
  switch (v) {
    case 'new':
      return 'New';
    case 'dormant':
      return 'Dormant';
    case 'breakthrough':
      return 'Breakthrough';
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  safe: { flex: 1 },
  previewChrome: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  closeBtn: {
    padding: 6,
  },
  variantsRow: {
    gap: 6,
    paddingRight: 4,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(60, 60, 67, 0.06)',
  },
  chipOn: {
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
  },
  chipTextOn: {
    color: IOS_REGISTER.label,
  },
});
