import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SettledFoundationRowProps {
  name: string;
  settledAt: string;
  evidenceStepCount: number;
  onPress: () => void;
}

export function SettledFoundationRow({
  name,
  settledAt,
  evidenceStepCount,
  onPress,
}: SettledFoundationRowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.copy}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{settledAt} · {evidenceStepCount} steps</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>FOUNDATIONS</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 18,
    color: '#1C1C1E',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  meta: {
    fontSize: 12,
    color: 'rgba(60,60,67,0.6)',
  },
  badge: {
    borderRadius: 999,
    backgroundColor: 'rgba(52,199,89,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#248A3D',
    letterSpacing: 0.6,
  },
});
