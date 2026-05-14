/**
 * IOSSegmentedControl - iOS-style segmented control component
 *
 * Supports two API styles:
 * 1. Original: segments with {key, label}, selectedKey, onSelect
 * 2. Alternative: segments with {value, label}, selectedValue, onValueChange
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { STEP_PALETTE } from '@/lib/step-theme';

interface SegmentWithKey {
  key: string;
  label: string;
  badge?: number;
}

interface SegmentWithValue<T extends string = string> {
  value: T;
  label: string;
  badge?: number;
}

type Segment<T extends string = string> = SegmentWithKey | SegmentWithValue<T>;

interface IOSSegmentedControlProps<T extends string = string> {
  segments: Segment<T>[];
  // Original API
  selectedKey?: string;
  onSelect?: (key: string) => void;
  // Alternative API (for compatibility)
  selectedValue?: T;
  onValueChange?: (value: T) => void;
  style?: object;
}

export function IOSSegmentedControl<T extends string = string>({
  segments,
  selectedKey,
  onSelect,
  selectedValue,
  onValueChange,
  style,
}: IOSSegmentedControlProps<T>) {
  const getSegmentKey = (segment: Segment<T>): string => {
    if ('key' in segment) return segment.key;
    if ('value' in segment) return segment.value;
    return '';
  };

  const currentSelectedKey = selectedKey ?? selectedValue;
  const handleSelect = (key: string) => {
    if (onSelect) {
      onSelect(key);
    } else if (onValueChange) {
      onValueChange(key as T);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {segments.map((segment) => {
        const segmentKey = getSegmentKey(segment);
        const isSelected = segmentKey === currentSelectedKey;

        return (
          <View
            key={segmentKey}
            style={[styles.segment, isSelected ? styles.selectedSegment : null]}
          >
            <Pressable
              style={styles.segmentTouchable}
              onPress={() => handleSelect(segmentKey)}
            >
              <Text
                style={[
                  styles.segmentText,
                  isSelected ? styles.selectedSegmentText : null,
                ]}
                numberOfLines={1}
              >
                {segment.label}
              </Text>
              {segment.badge != null && segment.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {segment.badge > 99 ? '99+' : segment.badge}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// Redesign palette per secondary-surfaces audit §2.4 — neutral track + cream
// pill, charcoal active text, info-violet badge. Single source-of-truth update
// reflects across all 12 callsites (Reflect sub-tabs, Settings tabs, etc.).
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: STEP_PALETTE.bgSecondary,
    borderRadius: 9,
    padding: 2,
    height: 36,
  },
  segment: {
    flex: 1,
    borderRadius: 7,
    overflow: 'hidden',
  },
  selectedSegment: {
    backgroundColor: STEP_PALETTE.bgPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(42,40,36,0.08)',
      } as any,
      default: {},
    }),
  },
  segmentTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {},
    }),
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: STEP_PALETTE.textTertiary,
  },
  selectedSegmentText: {
    fontWeight: '600',
    color: STEP_PALETTE.textPrimary,
  },
  badge: {
    backgroundColor: STEP_PALETTE.textInfo,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: STEP_PALETTE.ctaText,
  },
});

export default IOSSegmentedControl;
