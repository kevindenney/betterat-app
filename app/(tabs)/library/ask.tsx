/**
 * /library/ask — Librarian answer screen.
 *
 * Renders the "An answer" surface from the canonical Librarian register:
 * back to Library, share affordance, then a <LibrarianAnswer> body. The
 * body is the design's voice — italic-serif purple synthesis above a
 * stack of cited corpus rows. Today the data is the canonical example
 * (light-air starts); when the librarian gets a corpus reader this will
 * be replaced with a real synthesis keyed off `?q=` and the user's
 * library + practice history.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { LibrarianAnswer, type LibrarianAnswerData } from '@/components/library/librarian/LibrarianAnswer';

export default function LibrarianAskScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const rawQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const q = rawQ?.trim() || 'Have I written about light-air starts before?';

  const answer = buildAnswer(q);

  return (
    <View style={styles.screen}>
      <View style={[styles.toolbar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/library')
          }
          accessibilityRole="button"
          accessibilityLabel="Back to Library"
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={IOS_COLORS.systemBlue} />
          <Text style={styles.backText}>Library</Text>
        </Pressable>
        <View style={styles.toolbarRight}>
          <Pressable
            onPress={() => showAlert('Share', 'Sharing librarian answers is coming soon.')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share answer"
            style={styles.iconBtn}
          >
            <Ionicons name="share-outline" size={20} color={IOS_COLORS.systemBlue} />
          </Pressable>
          <Pressable
            onPress={() => showAlert('More', 'More actions coming soon.')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More"
            style={styles.iconBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={IOS_COLORS.systemBlue} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <LibrarianAnswer answer={answer} />
      </ScrollView>
    </View>
  );
}

function buildAnswer(question: string): LibrarianAnswerData {
  // Canonical example from the register. Until the librarian has a real
  // corpus reader the surface is wired to the design's exemplar answer
  // regardless of question — this lets the voice and citation contract
  // ship before the retrieval layer does.
  return {
    question,
    questionEmphasise: extractEmphasis(question),
    synthesis: [
      'Three times, across two seasons. The thread:',
      'You think faster in light air than in heavy — when the boat is slow you have time to read the breeze, but you also second-guess the line you picked. Last summer Sam Cooke flagged this as your fingerprint: "you start light-air races right and finish them somewhere else." The concept it points to is forming — "Boat speed is permission to think" — but you haven\'t tested it in a light-air race since September.',
    ],
    synthesisEmphasise: [
      'second-guess',
      'Boat speed is permission to think',
    ],
    draftedFrom:
      'drafted from 3 reflections · 1 concept · 1 saved resource · synthesized just now',
    citations: [
      {
        id: 'concept-boat-speed',
        kind: 'concept',
        state: 'forming',
        contextLabel: 'started Apr 22',
        headline: 'Boat speed is permission to think.',
        quote:
          'Felt myself stop thinking when we dropped behind in the third beat.',
        sourceLabel: 'Sam Cooke session · Apr 22',
      },
      {
        id: 'reflection-race-8',
        kind: 'reflection',
        contextLabel: 'Race 8 · Jan 30',
        headline:
          'Won the start, lost the leg.',
        quote:
          'I always pick the lane that opens up by the first cross — and then I argue with it for the next twenty minutes.',
        sourceLabel: 'After-race debrief · Jan 30',
      },
      {
        id: 'reflection-sept-14',
        kind: 'reflection',
        contextLabel: 'Sept 14 · last season',
        headline: 'You start light-air races right and finish them somewhere else.',
        quote: 'Sam said: you start light-air races right and finish them somewhere else.',
        sourceLabel: 'Coaching session · Sept 14 2024',
      },
    ],
    onPromoteToConcept: () =>
      showAlert(
        'Promote to concept',
        'When the librarian is wired to your corpus, this will mint a forming concept from the synthesis above.',
      ),
  };
}

function extractEmphasis(question: string): string[] {
  // Best-effort: italicise the noun phrase after "about" so the question
  // header echoes the design's "light-air starts" highlight without
  // hard-coding it.
  const m = question.match(/\babout\s+([^?.!]+)/i);
  if (!m) return [];
  return [m[1].trim()];
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBtn: {
    padding: 4,
  },
  body: {
    paddingBottom: 48,
  },
});
