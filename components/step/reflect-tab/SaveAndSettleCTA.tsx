import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { GRAY_5, LABEL_3 } from '@/lib/design-tokens-step-loop-ios';
import { REFLECT } from '@/lib/design-tokens-ios';

export interface SaveAndSettleCTAProps {
  enabled: boolean;
  label?: string;
  disabledHint: string;
  onSettle: () => Promise<void>;
}

export function SaveAndSettleCTA({
  enabled,
  label = 'Mark done',
  disabledHint,
  onSettle,
}: SaveAndSettleCTAProps) {
  const [saving, setSaving] = useState(false);
  const disabled = !enabled || saving;

  const handlePress = async () => {
    if (disabled) return;
    setSaving(true);
    try {
      await onSettle();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={handlePress}
        style={[
          styles.button,
          disabled && styles.buttonDisabled,
        ]}
      >
        <Text style={[styles.text, disabled && styles.textDisabled]}>
          {saving ? 'Saving…' : label}
        </Text>
        <ArrowRight size={18} color={disabled ? LABEL_3 : '#FFFFFF'} strokeWidth={2.6} />
      </Pressable>
      {!enabled ? <Text style={styles.hint}>{disabledHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 7,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: REFLECT.base,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: REFLECT.base,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonDisabled: {
    backgroundColor: GRAY_5,
    shadowOpacity: 0,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  textDisabled: {
    color: LABEL_3,
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
    color: LABEL_3,
    fontStyle: 'italic',
  },
});
