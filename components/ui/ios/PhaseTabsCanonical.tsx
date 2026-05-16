import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

export type PhaseTabState = 'active' | 'done' | 'empty';

export interface PhaseTabItem<T extends string = string> {
  value: T;
  label: string;
  state: PhaseTabState;
}

interface PhaseTabsCanonicalProps<T extends string = string> {
  tabs: PhaseTabItem<T>[];
  onSelect: (value: T) => void;
  style?: object;
}

export function PhaseTabsCanonical<T extends string = string>({
  tabs,
  onSelect,
  style,
}: PhaseTabsCanonicalProps<T>) {
  return (
    <View style={[styles.strip, style]}>
      {tabs.map((tab) => {
        const isActive = tab.state === 'active';
        const isDone = tab.state === 'done';
        const textStyle = [
          styles.label,
          isActive && styles.labelActive,
          isDone && styles.labelDone,
        ];
        return (
          <Pressable
            key={tab.value}
            style={styles.tab}
            onPress={() => onSelect(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.row}>
              {isDone ? <View style={styles.doneDot} /> : null}
              <Text style={textStyle} numberOfLines={1}>
                {tab.label}
              </Text>
            </View>
            {isActive ? <View style={styles.underline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const HAIRLINE = StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    borderBottomWidth: HAIRLINE,
    borderBottomColor: IOS_COLORS.systemGray5,
    gap: 4,
  },
  tab: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
    position: 'relative',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {},
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  doneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.systemGreen,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: IOS_REGISTER.labelTertiary,
  },
  labelActive: {
    color: IOS_REGISTER.accentUserAction,
    fontWeight: '600',
  },
  labelDone: {
    color: IOS_REGISTER.labelSecondary,
  },
  underline: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: -HAIRLINE,
    height: 2,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
});

export default PhaseTabsCanonical;
