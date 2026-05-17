import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export interface FilterStripOption {
  key: string;
  label: string;
}

interface FilterStripProps {
  options: FilterStripOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export function FilterStrip({ options, selectedKey, onSelect }: FilterStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {options.map((option) => {
        const selected = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onSelect(option.key)}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
  },
  chipSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3C3C43',
  },
  labelSelected: {
    color: '#FFFFFF',
  },
});
