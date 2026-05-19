/**
 * BeatLibraryPin (D37) — inline pinned library reference rendered inside
 * a Do-tab beat. e.g. "REFERENCE · bates' ch 8 §3 — Auscultation order: ..."
 * Tap opens the library item.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { FORMAT_ICON, FORMAT_TINT } from '@/components/library/resources/formatStyles';
import type { LibraryFormat } from '@/components/library/resources/types';

interface Props {
  format: LibraryFormat;
  preLabel: string;
  excerpt: string;
  onPress?: () => void;
}

export function BeatLibraryPin({ format, preLabel, excerpt, onPress }: Props) {
  const tint = FORMAT_TINT[format];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.pin, { backgroundColor: `${tint}14` }]}
    >
      <View style={[styles.ic, { backgroundColor: `${tint}26` }]}>
        <Ionicons name={FORMAT_ICON[format]} size={14} color={tint} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.pre, { color: tint }]} numberOfLines={1}>
          {preLabel}
        </Text>
        <Text style={styles.ttl} numberOfLines={3}>
          {excerpt}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pin: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  ic: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  pre: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  ttl: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.label,
    lineHeight: 17,
    fontStyle: 'italic',
  },
});
