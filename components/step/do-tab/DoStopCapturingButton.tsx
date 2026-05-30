import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const CORAL = '#FF6B6B';
const CORAL_DEEP = '#E54848';

export interface DoStopCapturingButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Frame 2 · G — finish capture.
 * Reverse polarity (white fill, coral border) so the action reads serious
 * without competing with the LIVE pill or feeling like an alarm.
 */
export function DoStopCapturingButton({
  onPress,
  disabled,
  label = 'Finish capture',
}: DoStopCapturingButtonProps) {
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
      <View style={styles.sq} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CORAL,
    borderRadius: 14,
    paddingTop: 13,
    paddingBottom: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: CORAL,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  sq: {
    width: 11,
    height: 11,
    backgroundColor: CORAL,
    borderRadius: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: CORAL_DEEP,
  },
});
