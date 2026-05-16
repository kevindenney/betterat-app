import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#34C759';
const GREEN_TINT = 'rgba(52, 199, 89, 0.14)';
const GREEN_SOFT = 'rgba(52, 199, 89, 0.22)';
const GREEN_DEEP = '#248A3D';

export interface DoActivityCompletePillProps {
  /** Label rendered to the right of the green tick. Defaults to canonical "Activity complete". */
  label?: string;
}

/**
 * Phase B.7 · Frame 3 · A — Activity-complete pill.
 * Replaces Frame 2's coral LIVE pulse. Calmer by an order of magnitude:
 * green tint background, green-soft border, static 14 px green tick disc.
 * No animation — the swap from coral pulse to green check is the entire
 * emotional payload.
 */
export function DoActivityCompletePill({
  label = 'Activity complete',
}: DoActivityCompletePillProps) {
  return (
    <View style={styles.pill} accessibilityLabel={label}>
      <View style={styles.tick} accessibilityElementsHidden importantForAccessibility="no">
        <Ionicons name="checkmark" size={9} color="#FFFFFF" />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 5,
    paddingRight: 11,
    paddingBottom: 5,
    paddingLeft: 8,
    borderRadius: 999,
    backgroundColor: GREEN_TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GREEN_SOFT,
    alignSelf: 'flex-start',
  },
  tick: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: GREEN_DEEP,
    textTransform: 'uppercase',
  },
});
