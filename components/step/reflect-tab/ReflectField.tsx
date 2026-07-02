import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  GRAY_5,
  IOS_PURPLE,
  IOS_PURPLE_TINT,
  LABEL,
  LABEL_3,
  LABEL_4,
} from '@/lib/design-tokens-step-loop-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

export interface ReflectFieldProps {
  id: string;
  qEye: string;
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: (id: ReflectFieldProps['id']) => void;
  placeholder?: string;
  index?: number;
  isDrafted?: boolean;
  readOnly?: boolean;
  seedSuggestion?: string;
  seedLabel?: string;
  /**
   * One AI surface at a time: while the capture-draft banner is on screen,
   * seed cards fold to a one-line "Seed available" link (tap to unfold this
   * one). Dismissing or using the banner unfolds every seed. Author
   * feedback is human, not AI — it never collapses.
   */
  seedCollapsed?: boolean;
  isLast?: boolean;
  onUseSeed?: () => void;
  onMarkAsConceptSeed?: () => void;
}

export function ReflectField({
  id,
  qEye,
  value,
  onChangeText,
  onFocus,
  placeholder = 'Tap to write · or hold to speak',
  index,
  isDrafted,
  readOnly,
  seedSuggestion,
  seedLabel,
  seedCollapsed,
  isLast,
  onUseSeed,
  onMarkAsConceptSeed,
}: ReflectFieldProps) {
  const hasSeed = Boolean(seedSuggestion?.trim()) && !value.trim() && !readOnly;
  const [seedUnfolded, setSeedUnfolded] = useState(false);
  const showSeed = hasSeed && (!seedCollapsed || seedUnfolded);
  const showSeedHint = hasSeed && !showSeed;
  return (
    <View style={[styles.section, isLast && styles.sectionLast]}>
      <View style={styles.questionRow}>
        {index ? <Text style={styles.questionIndex}>{index}</Text> : null}
        <Text style={styles.question}>{qEye}</Text>
      </View>
      {showSeedHint ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Show suggested answer for ${qEye}`}
          onPress={() => setSeedUnfolded(true)}
          hitSlop={6}
          style={styles.seedHint}
        >
          <Text style={styles.seedHintText}>✷ Seed available</Text>
        </Pressable>
      ) : null}
      {showSeed ? (
        <View style={styles.seedCard}>
          <Text style={styles.seedText}>
            <Text style={styles.seedLead}>{seedLabel ?? 'Seed'}</Text>
            {seedLabel ? ' ' : ': '}
            {seedSuggestion}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Use suggested answer for ${qEye}`}
            onPress={onUseSeed}
            hitSlop={6}
          >
            <Text style={styles.seedActionText}>Use</Text>
          </Pressable>
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => onFocus?.(id)}
        placeholder={placeholder}
        placeholderTextColor={LABEL_3}
        editable={!readOnly}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
        style={[styles.input, index && styles.inputIndented, isDrafted && styles.drafted]}
      />
      {isDrafted ? <Text style={styles.draftLabel}>AI draft · edit freely</Text> : null}
      {value.trim().length > 0 && onMarkAsConceptSeed ? (
        <Pressable onPress={onMarkAsConceptSeed} accessibilityRole="button">
          <Text style={styles.seedAction}>Mark as concept seed</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: GRAY_5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 9,
  },
  sectionLast: {
    borderBottomWidth: 0,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  questionIndex: {
    width: 16,
    paddingTop: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    color: '#007C92',
    textAlign: 'center',
  },
  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    letterSpacing: 0,
    color: LABEL,
  },
  input: {
    minHeight: 48,
    padding: 0,
    margin: 0,
    fontSize: 17,
    lineHeight: 25,
    color: LABEL,
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'none', overflow: 'hidden' } as any,
    }),
  },
  inputIndented: {
    marginLeft: 25,
  },
  drafted: {
    color: LABEL_3,
  },
  seedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(88, 86, 214, 0.28)',
    backgroundColor: IOS_PURPLE_TINT,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 25,
  },
  seedText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_PURPLE,
  },
  seedLead: {
    fontWeight: '800',
    color: IOS_PURPLE,
  },
  seedActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_PURPLE,
  },
  seedHint: {
    marginLeft: 25,
    alignSelf: 'flex-start',
  },
  seedHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_PURPLE,
    opacity: 0.75,
  },
  draftLabel: {
    fontSize: 11,
    color: LABEL_4,
    fontStyle: 'italic',
  },
  seedAction: {
    fontSize: 12,
    fontWeight: '600',
    color: LABEL_3,
  },
});
