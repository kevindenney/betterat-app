import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  GRAY_5,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

export interface ReflectFieldProps {
  id: string;
  qEye: string;
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: (id: ReflectFieldProps['id']) => void;
  placeholder?: string;
  isDrafted?: boolean;
  readOnly?: boolean;
}

export function ReflectField({
  id,
  qEye,
  value,
  onChangeText,
  onFocus,
  placeholder = 'Tap to write',
  isDrafted,
  readOnly,
}: ReflectFieldProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.question}>{qEye}</Text>
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
        style={[styles.input, isDrafted && styles.drafted]}
      />
      {isDrafted ? <Text style={styles.draftLabel}>AI draft · edit freely</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: GRAY_5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  question: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: LABEL_2,
  },
  input: {
    minHeight: 76,
    padding: 0,
    margin: 0,
    fontSize: 18,
    lineHeight: 26,
    color: LABEL,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'none', overflow: 'hidden' } as any,
    }),
  },
  drafted: {
    color: LABEL_2,
  },
  draftLabel: {
    fontSize: 11,
    color: LABEL_3,
    fontStyle: 'italic',
  },
});
