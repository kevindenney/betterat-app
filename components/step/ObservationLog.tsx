/**
 * ObservationLog — inline input for adding timestamped observations.
 * Matches Telegram's log_observation format so data flows seamlessly
 * between web and bot interfaces. Feed rendering moved to CaptureTimeline.
 */

import React, { useState, useCallback } from 'react';
import { View, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { STEP_PALETTE } from '@/lib/step-theme';
import type { Observation } from '@/types/step-detail';

interface ObservationLogProps {
  onAdd: (observation: Observation) => void;
  readOnly?: boolean;
}

export function ObservationLog({ onAdd, readOnly }: ObservationLogProps) {
  const [text, setText] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd({
      id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      timestamp: new Date().toISOString(),
      source: 'note',
    });
    setText('');
  }, [text, onAdd]);

  if (readOnly) return null;

  return (
    <View style={s.inputRow}>
      <TextInput
        style={s.input}
        value={text}
        onChangeText={setText}
        placeholder="Add a note…"
        placeholderTextColor={STEP_PALETTE.textTertiary}
        multiline
        blurOnSubmit
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
      />
      <Pressable
        style={[s.submitBtn, !text.trim() && s.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!text.trim()}
        accessibilityLabel="Add note"
      >
        <Ionicons
          name="arrow-up-circle"
          size={28}
          color={
            text.trim() ? STEP_PALETTE.textPrimary : STEP_PALETTE.borderSecondary
          }
        />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.serif,
    fontSize: 14,
    lineHeight: 22,
    color: STEP_PALETTE.textPrimary,
    backgroundColor: STEP_PALETTE.bgPrimary,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_PALETTE.borderTertiary,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    minHeight: 44,
    maxHeight: 120,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  submitBtn: {
    paddingBottom: Platform.OS === 'ios' ? 4 : 2,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
});
