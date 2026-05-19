import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

export type PlanTabKey = 'steps' | 'subscribers' | 'resources';

interface Props {
  active: PlanTabKey;
  counts: { steps: number; subscribers: number; resources: number };
  onChange: (key: PlanTabKey) => void;
}

const TABS: PlanTabKey[] = ['steps', 'subscribers', 'resources'];
const LABELS: Record<PlanTabKey, string> = {
  steps: 'Steps',
  subscribers: 'Subscribers',
  resources: 'Resources',
};

export function PlanTabsBar({ active, counts, onChange }: Props) {
  return (
    <View style={styles.row}>
      {TABS.map((key) => {
        const isActive = key === active;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            activeOpacity={0.7}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>
              {LABELS[key]}
              <Text style={styles.count}>  {counts[key]}</Text>
            </Text>
            {isActive ? <View style={styles.underline} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    backgroundColor: IOS_COLORS.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.2)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  labelActive: {
    color: IOS_COLORS.label,
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
  },
  underline: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#007AFF',
    borderRadius: 1,
  },
});
