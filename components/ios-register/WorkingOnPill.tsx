/**
 * WorkingOnPill — system-gray-5 fill rounded pill with a leading glyph,
 * a name, an optional state suffix in iOS blue, and an optional 6px coral
 * live-dot signaling "this concept is active in the current step."
 *
 * Two variants:
 *   kind="capability" → blue glyph (e.g. run icon), no live-dot
 *   kind="concept"    → coral bubble glyph, live-dot allowed
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

export type WorkingOnPillKind = 'capability' | 'concept';

interface Props {
  kind: WorkingOnPillKind;
  name: string;
  /** e.g. "practicing" — rendered in iOS blue after the name */
  state?: string;
  /** When true, render the 6px coral live-dot to the left of the glyph */
  live?: boolean;
  /** Tabler-style glyph mapped to Ionicons */
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export function WorkingOnPill({
  kind,
  name,
  state,
  live,
  icon,
  onPress,
}: Props) {
  const glyphColor =
    kind === 'concept'
      ? IOS_REGISTER.accentMarkedContent
      : IOS_REGISTER.accentUserAction;

  const resolvedIcon =
    icon ?? (kind === 'concept' ? 'chatbubble-outline' : 'walk-outline');

  return (
    <Pressable
      onPress={onPress}
      style={styles.pill}
      accessibilityRole="button"
      accessibilityLabel={`${name}${state ? ' — ' + state : ''}`}
    >
      {live && <View style={styles.liveDot} />}
      <Ionicons name={resolvedIcon} size={15} color={glyphColor} />
      <Text style={styles.name}>{name}</Text>
      {state ? <Text style={styles.state}>{state}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 999,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  liveDot: {
    width: IOS_REGISTER.liveDotSize,
    height: IOS_REGISTER.liveDotSize,
    borderRadius: IOS_REGISTER.liveDotSize / 2,
    backgroundColor: IOS_REGISTER.liveDotColor,
    marginRight: -2,
  },
  name: {
    ...IOS_REGISTER_TEXT.pill,
    color: IOS_REGISTER.label,
  },
  state: {
    ...IOS_REGISTER_TEXT.pillState,
    color: IOS_REGISTER.accentUserAction,
    marginLeft: 4,
  },
});
