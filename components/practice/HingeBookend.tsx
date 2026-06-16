import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Check, ChevronRight } from 'lucide-react-native';

export interface HingeBookendProps {
  kind: 'before' | 'after';
  label: string;
  stepTitle: string;
  onPress: () => void;
}

export function HingeBookend({ kind, label, stepTitle, onPress }: HingeBookendProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.icon, kind === 'before' ? styles.iconBefore : styles.iconAfter]}>
        {kind === 'before' ? (
          <Check size={14} color="#FFFFFF" strokeWidth={3} />
        ) : (
          <ArrowRight size={14} color="#FFFFFF" strokeWidth={2.6} />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.title}>{stepTitle}</Text>
      </View>
      <ChevronRight size={16} color="#9CA3AF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBefore: {
    backgroundColor: '#16A34A',
  },
  iconAfter: {
    backgroundColor: '#007AFF',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#6B7280',
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
});
