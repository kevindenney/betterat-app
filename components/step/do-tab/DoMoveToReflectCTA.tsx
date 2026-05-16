import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IOS_BLUE = '#007AFF';

export interface DoMoveToReflectCTAProps {
  onPress?: () => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Phase B.7 · Frame 3 · F — Move to Reflect primary CTA.
 * Full-width solid iOS-blue rectangle, 50 px tall, r 14, trailing
 * arrow-right glyph at 18 px. Reverse polarity from Frame 2's Stop
 * capturing — that one was white-fill / coral-border because stopping
 * is a momentous local action; this one is solid blue because the
 * journey continues. Reads as forward motion, not commitment.
 */
export function DoMoveToReflectCTA({
  onPress,
  disabled,
  label = 'Move to Reflect',
}: DoMoveToReflectCTAProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.btn,
        pressed && !disabled && styles.btnPressed,
        disabled && styles.btnDisabled,
      ]}
      hitSlop={6}
    >
      <Text style={styles.label}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 50,
    backgroundColor: IOS_BLUE,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    // Explicit stretch so the Pressable fills its flex-column parent
    // width even when the parent doesn't propagate alignment.
    alignSelf: 'stretch',
    shadowColor: IOS_BLUE,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
});
