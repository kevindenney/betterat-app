/**
 * CompetencyViewToggle — Segmented control for switching between
 * "Working On", "All", and "Needs Attention" views.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { CompetencyReflectView } from '@/hooks/useCompetencyReflectData';

interface Props {
  activeView: CompetencyReflectView;
  onViewChange: (view: CompetencyReflectView) => void;
  workingOnCount: number;
  needsAttentionCount: number;
}

const SEGMENTS: { key: CompetencyReflectView; label: string }[] = [
  { key: 'working_on', label: 'Working On' },
  { key: 'all', label: 'All' },
  { key: 'needs_attention', label: 'Needs Attention' },
];

export function CompetencyViewToggle({ activeView, onViewChange, workingOnCount, needsAttentionCount }: Props) {
  const getCount = (key: CompetencyReflectView): number | null => {
    if (key === 'working_on' && workingOnCount > 0) return workingOnCount;
    if (key === 'needs_attention' && needsAttentionCount > 0) return needsAttentionCount;
    return null;
  };

  return (
    <View style={styles.container}>
      {SEGMENTS.map((seg) => {
        const isActive = activeView === seg.key;
        const count = getCount(seg.key);
        return (
          <TouchableOpacity
            key={seg.key}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onViewChange(seg.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
              {seg.label}
            </Text>
            {count !== null && (
              <View style={[styles.badge, isActive && styles.badgeActive]}>
                <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeActive: {
    backgroundColor: '#007AFF',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
});
