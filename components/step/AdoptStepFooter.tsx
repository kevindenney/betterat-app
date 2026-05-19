/**
 * AdoptStepFooter (D28) — shared component rendered at the bottom of every
 * read-only step view: subscriber timeline step, followee timeline step,
 * suggestion row, map sheet, inbox row.
 *
 * Primary: "Add this step to my timeline" (forks into the user's own steps
 * with source_type + source_id provenance).
 * Secondary: "Save idea as concept seed" (writes to step_deck or seeds a
 * Forming concept).
 *
 * Pure UI here — caller wires the actual mutations.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

interface Props {
  onAddToTimeline: () => void;
  onSaveAsConceptSeed: () => void;
  /** Provenance line shown above the buttons. e.g. "Forked from Phyl Loong's Step 4". */
  provenance?: string;
  /** Override primary button label if needed (e.g. plain "Adopt step"). */
  primaryLabel?: string;
  /** Override secondary button label. */
  secondaryLabel?: string;
  disabled?: boolean;
}

export function AdoptStepFooter({
  onAddToTimeline,
  onSaveAsConceptSeed,
  provenance,
  primaryLabel = 'Add this step to my timeline',
  secondaryLabel = 'Save idea as concept seed',
  disabled = false,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      {provenance ? (
        <Text style={styles.provenance} numberOfLines={2}>
          {provenance}
        </Text>
      ) : null}
      <View style={styles.btnRow}>
        <Pressable
          onPress={onSaveAsConceptSeed}
          disabled={disabled}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            pressed ? styles.btnPressed : null,
          ]}
          accessibilityLabel={secondaryLabel}
        >
          <Ionicons name="sparkles-outline" size={14} color="#5C2DAA" />
          <Text style={[styles.btnText, styles.btnTextSecondary]} numberOfLines={1}>
            {secondaryLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={onAddToTimeline}
          disabled={disabled}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            pressed ? styles.btnPressed : null,
          ]}
          accessibilityLabel={primaryLabel}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={[styles.btnText, styles.btnTextPrimary]} numberOfLines={1}>
            {primaryLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.2)',
    gap: 8,
  },
  provenance: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: -0.05,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    flex: 1,
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnSecondary: {
    backgroundColor: 'rgba(175,82,222,0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(175,82,222,0.35)',
  },
  btnPrimary: {
    backgroundColor: '#007AFF',
    flex: 1.3,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  btnTextSecondary: {
    color: '#5C2DAA',
  },
  btnTextPrimary: {
    color: '#FFFFFF',
  },
});
