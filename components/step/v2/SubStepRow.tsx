import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import type { SubStep } from './types';

interface Props {
  step: SubStep;
  onToggle?: () => void;
}

const FORMAT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  video: 'play-circle',
  article: 'document-text-outline',
  book: 'book-outline',
  pdf: 'document-outline',
  audio: 'mic-outline',
  drill: 'flag-outline',
};

export function SubStepRow({ step, onToggle }: Props) {
  const isConcept = step.kind === 'concept';
  const isResource = step.kind === 'resource';

  return (
    <View style={[styles.row, step.done ? styles.rowDone : null]}>
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={8}
        style={[
          styles.check,
          step.done ? styles.checkDone : null,
          isConcept ? styles.checkConcept : null,
          isResource ? styles.checkResource : null,
        ]}
      >
        {step.done ? (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        ) : null}
      </TouchableOpacity>
      <View style={styles.content}>
        <Text
          style={[styles.text, step.done ? styles.textDone : null]}
          numberOfLines={4}
        >
          {step.text}
        </Text>

        {isConcept && step.conceptTitle ? (
          <View style={[styles.libChip, styles.libChipConcept]}>
            <Ionicons name="sparkles-outline" size={11} color="#5C2DAA" />
            <Text style={styles.libChipText} numberOfLines={1}>
              {step.conceptTitle}
            </Text>
          </View>
        ) : null}

        {isResource && step.resourceTitle ? (
          <View style={[styles.libChip, styles.libChipResource]}>
            <Ionicons
              name={
                step.resourceFormat
                  ? FORMAT_ICON[step.resourceFormat] ?? 'document-outline'
                  : 'document-outline'
              }
              size={11}
              color="#9A6800"
            />
            <Text style={styles.libChipText} numberOfLines={1}>
              {step.resourceTitle}
            </Text>
          </View>
        ) : null}

        {step.resourceSource || step.conceptSource ? (
          <Text style={styles.src}>
            {step.resourceSource ?? step.conceptSource}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  rowDone: {
    opacity: 0.65,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(60,60,67,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 1,
  },
  checkDone: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkConcept: {
    borderColor: '#AF52DE',
  },
  checkResource: {
    borderColor: '#FF9500',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  text: {
    fontSize: 14,
    lineHeight: 19,
    color: IOS_COLORS.label,
  },
  textDone: {
    textDecorationLine: 'line-through',
    color: IOS_COLORS.tertiaryLabel,
  },
  libChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  libChipConcept: {
    backgroundColor: 'rgba(175,82,222,0.12)',
  },
  libChipResource: {
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  libChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.05,
    maxWidth: 240,
  },
  src: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: -0.05,
  },
});
