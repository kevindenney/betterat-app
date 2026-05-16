import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IOS_BLUE = '#007AFF';

export interface DoMoveToReflectCTAProps {
  onPress?: () => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Phase B.7 · Frame 3 · F — Move to Reflect primary CTA.
 *
 * Full-width solid iOS-blue rectangle, 50 px tall, r 14, trailing
 * arrow-right glyph at 18 px. Reverse polarity from Frame 2's Stop
 * capturing — that one was white-fill / coral-border because stopping
 * is a momentous local action; this one is solid blue because the
 * journey continues. Reads as forward motion, not commitment.
 *
 * Uses TouchableOpacity rather than Pressable because the Pressable
 * function-style API (`style={({pressed}) => [...]}`) was silently
 * failing to apply `styles.btn` on iOS in this RN version — the
 * children rendered but the background / height / flexDirection were
 * never set. TouchableOpacity takes a static style array directly,
 * which renders reliably.
 */
export function DoMoveToReflectCTA({
  onPress,
  disabled,
  label = 'Move to Reflect',
}: DoMoveToReflectCTAProps) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[styles.btn, disabled && styles.btnDisabled]}
      hitSlop={6}
    >
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 50,
    backgroundColor: IOS_BLUE,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignSelf: 'stretch',
    shadowColor: IOS_BLUE,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
});
