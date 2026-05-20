import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { InboxItem } from './types';

interface Props {
  item: InboxItem;
  onAdd?: () => void;
  onSaveToDeck?: () => void;
  onDismiss?: () => void;
}

const CHIP_STYLE: Record<
  InboxItem['kind'],
  { bg: string; dot: string; color: string }
> = {
  suggestion: {
    bg: 'rgba(175,82,222,0.14)',
    dot: '#AF52DE',
    color: '#5C2DAA',
  },
  plan_push: {
    bg: 'rgba(0,122,255,0.14)',
    dot: '#007AFF',
    color: '#0046A8',
  },
  on_deck: {
    bg: 'rgba(255,149,0,0.14)',
    dot: '#FF9500',
    color: '#9A6800',
  },
};

export function SuggestRow({ item, onAdd, onSaveToDeck, onDismiss }: Props) {
  const isDeck = item.kind === 'on_deck';
  const chip = CHIP_STYLE[item.kind];

  return (
    <View style={styles.card}>
      <View style={styles.srcLine}>
        {item.fromInitials ? (
          <View
            style={[styles.avXS, { backgroundColor: item.fromTint ?? '#5AC8FA' }]}
          >
            <Text style={styles.avXSText}>{item.fromInitials}</Text>
          </View>
        ) : null}
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <View style={[styles.chipDot, { backgroundColor: chip.dot }]} />
          <Text style={[styles.chipText, { color: chip.color }]}>
            {item.chipLabel}
          </Text>
        </View>
        <Text style={styles.context} numberOfLines={1}>
          {item.fromContext}
        </Text>
        <Text style={styles.when}>{item.when}</Text>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      {item.blurb ? (
        <Text style={styles.blurb} numberOfLines={3}>
          {item.blurb}
        </Text>
      ) : null}
      {item.fromLine ? (
        <Text style={styles.fromLine}>
          {item.fromLine}
          {item.fromEmail ? <Text style={styles.fromEmail}>  ·  {item.fromEmail}</Text> : null}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={onDismiss}
          style={styles.dismiss}
          accessibilityLabel="Dismiss"
          hitSlop={6}
        >
          <Ionicons name="close" size={16} color={IOS_COLORS.secondaryLabel} />
        </TouchableOpacity>
        {isDeck ? null : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onSaveToDeck}
            style={styles.secondary}
          >
            <Ionicons name="bookmark-outline" size={13} color={IOS_COLORS.label} />
            <Text style={styles.secondaryText}>Save to deck</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAdd}
          style={[styles.primary, isDeck ? styles.primaryWide : null]}
        >
          <Ionicons
            name={isDeck ? 'flag' : 'add'}
            size={isDeck ? 14 : 16}
            color="#FFFFFF"
          />
          <Text style={styles.primaryText}>
            {isDeck ? 'Place in timeline' : 'Add to timeline'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
    gap: 7,
  },
  srcLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avXS: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avXSText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  context: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    flex: 1,
    minWidth: 0,
  },
  when: {
    fontSize: 10.5,
    color: IOS_COLORS.tertiaryLabel,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
    lineHeight: 19,
  },
  blurb: {
    fontSize: 13.5,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  fromLine: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  fromEmail: {
    fontSize: 10.5,
    color: IOS_COLORS.tertiaryLabel,
    opacity: 0.75,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    marginTop: 4,
  },
  dismiss: {
    width: 36,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  primary: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#007AFF',
  },
  primaryWide: {
    flex: 2.4,
  },
  primaryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.05,
  },
});
