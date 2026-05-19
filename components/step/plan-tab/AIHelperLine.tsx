/**
 * <AIHelperLine> — quiet italic helper at the top of the Plan body.
 *
 * Phase 1 · iOS register. Replaces the full purple AI Coach card per D5:
 * empty Plan should feel writable, not guided.
 *
 * State transitions:
 *   empty   → full sentence: "✦ Need help structuring this? Talk to AI Coach →"
 *   partial → shrinks to small link: "✦ Open AI Coach"
 *   filled  → returns null (lives inside More Options when needed)
 *
 * Canonical: docs/redesign/ios-register/step-loop-integration-canonical.html
 *            .ai-helper · line 679–691
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Sparkles } from 'lucide-react-native';
import { IOS_PURPLE, LABEL_2, LABEL_3 } from '@/lib/design-tokens-step-loop-ios';

export type AIHelperState = 'empty' | 'partial' | 'filled';

export interface AIHelperLineProps {
  state: AIHelperState;
  onOpenCoach: () => void;
  testID?: string;
}

export function AIHelperLine({ state, onOpenCoach, testID }: AIHelperLineProps) {
  if (state === 'filled') return null;

  if (state === 'partial') {
    return (
      <Pressable
        onPress={onOpenCoach}
        accessibilityRole="button"
        accessibilityLabel="Open AI Coach"
        hitSlop={6}
        style={styles.partial}
        testID={testID}
      >
        <Sparkles size={12} color={IOS_PURPLE} />
        <Text style={styles.partialText}>Open AI Coach</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onOpenCoach}
      accessibilityRole="button"
      accessibilityLabel="Open AI Coach"
      hitSlop={6}
      style={styles.empty}
      testID={testID}
    >
      <Sparkles size={12} color={IOS_PURPLE} />
      <Text style={styles.emptyLeading}>Need help structuring this? </Text>
      <Text style={styles.emptyEm}>Talk to AI Coach</Text>
      <View style={styles.arrow}>
        <ArrowRight size={12} color={LABEL_3} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 2,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  emptyLeading: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: LABEL_3,
    letterSpacing: -0.05,
  },
  emptyEm: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LABEL_2,
    letterSpacing: -0.05,
  },
  arrow: {
    marginLeft: 'auto',
  },
  partial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 2,
    marginBottom: 4,
  },
  partialText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LABEL_2,
    letterSpacing: -0.05,
  },
});
