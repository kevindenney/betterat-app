/**
 * IOSSegmentedControl - iOS-style segmented control component
 *
 * Supports two API styles:
 * 1. Original: segments with {key, label}, selectedKey, onSelect
 * 2. Alternative: segments with {value, label}, selectedValue, onValueChange
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

interface SegmentWithKey {
  key: string;
  label: string;
  badge?: number;
}

interface SegmentWithValue<T extends string = string> {
  value: T;
  label: string;
  /**
   * Optional count to render inline AFTER the label in a quieter weight
   * — gives the canonical "Plans 3" treatment where the word and count
   * read as visually distinct types.
   */
  count?: number;
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
                {'count' in segment && segment.count != null && (
                  <Text style={styles.segmentCount}>
                    {' '}
                    {segment.count}
                  </Text>
                )}
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

// iOS register palette (Phase 1b, supersedes audit commit 1478a03c) — iOS-
// native track (system gray 5) + white pill + iOS blue active text, with
// coral badges for "marked content" notification counts. Two accents, two
// jobs: blue = user-actions/active-state, coral = AI-questions/marked-content.
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.systemGray5,
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
    backgroundColor: IOS_REGISTER.cardBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
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
    color: IOS_REGISTER.labelSecondary,
  },
  selectedSegmentText: {
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  // Inline count that follows the segment label. Quieter weight and
  // tertiary color so "Plans" reads as the word and "3" reads as a
  // secondary annotation.
  segmentCount: {
    fontWeight: '400',
    color: IOS_REGISTER.labelTertiary,
  },
  badge: {
    backgroundColor: IOS_REGISTER.accentMarkedContent,
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
    color: '#FFFFFF',
  },
});

export default IOSSegmentedControl;
