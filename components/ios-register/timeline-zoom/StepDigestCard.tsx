/**
 * Step digest card — the canonical small step representation used by L2
 * (week carousel peek) and L3 (week section pairs). One card, three layouts:
 * compact (peek), full (focused), and section (L3 two-up).
 *
 * Matches Frame 2/3/6/7. Status dot, pre-title eyebrow, title, capability
 * chips, provenance footer, cohort avatars.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { Capability, CohortAvatar, StepStatus, TimelineStep } from './types';

const STATUS_VISUAL: Record<
  StepStatus,
  { label: string; color: string; dotColor: string }
> = {
  plan:      { label: 'Plan',      color: IOS_REGISTER.accentUserAction, dotColor: IOS_REGISTER.accentUserAction },
  do:        { label: 'Do',        color: '#FF9500',                     dotColor: '#FF9500' },
  reflect:   { label: 'Reflect',   color: '#5BA46F',                     dotColor: '#5BA46F' },
  reflected: { label: 'REFLECTED', color: IOS_REGISTER.labelSecondary,   dotColor: IOS_REGISTER.labelTertiary },
  done:      { label: 'Done',      color: IOS_REGISTER.labelSecondary,   dotColor: IOS_REGISTER.labelTertiary },
};

interface StepDigestCardProps {
  step: TimelineStep;
  /** Visually highlights the card with iOS-blue outline (the "came from" or "today" card). */
  highlighted?: boolean;
  /** L3 section layout — narrower, no capability chips, no provenance. */
  compact?: boolean;
  onPress?: () => void;
}

export function StepDigestCard({
  step,
  highlighted,
  compact,
  onPress,
}: StepDigestCardProps) {
  const status = STATUS_VISUAL[step.status];
  const isToday = step.preTitle?.startsWith('TODAY');

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        compact && styles.cardCompact,
        highlighted && styles.cardHighlighted,
      ]}
    >
      {step.preTitle ? (
        <Text
          style={[
            styles.eyebrow,
            isToday && styles.eyebrowToday,
          ]}
          numberOfLines={1}
        >
          {step.preTitle}
        </Text>
      ) : null}

      <Text style={styles.title} numberOfLines={3}>
        {step.title}
      </Text>

      <View style={styles.bottomBlock}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: status.dotColor }]} />
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>

        {!compact && step.capabilities?.length ? (
          <View style={styles.chipRow}>
            {step.capabilities.slice(0, 3).map((cap) => (
              <CapabilityChip key={cap.id} cap={cap} />
            ))}
          </View>
        ) : null}

        {!compact && step.from ? (
          <View style={styles.fromRow}>
            <Ionicons name="git-network-outline" size={11} color={IOS_REGISTER.labelTertiary} />
            <Text style={styles.fromText} numberOfLines={1}>
              {step.from.source}
            </Text>
          </View>
        ) : null}

        {!compact && step.cohortAvatars?.length ? (
          <View style={styles.cohortRow}>
            <AvatarStack avatars={step.cohortAvatars} />
            {step.cohortLabel ? (
              <Text style={styles.cohortLabel}>{step.cohortLabel}</Text>
            ) : null}
          </View>
        ) : null}

        {step.pinnedFromOtherInterest ? (
          <View style={styles.pinnedRow}>
            <Ionicons name="pin" size={10} color={IOS_REGISTER.labelTertiary} />
            <Text style={styles.pinnedLabel} numberOfLines={1}>
              Pinned from another interest
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function CapabilityChip({ cap }: { cap: Capability }) {
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(cap.color, 0.12) }]}>
      <Text style={[styles.chipText, { color: darken(cap.color) }]}>{cap.label}</Text>
    </View>
  );
}

function AvatarStack({ avatars }: { avatars: CohortAvatar[] }) {
  return (
    <View style={styles.avatarStack}>
      {avatars.slice(0, 3).map((av, idx) => (
        <View
          key={av.id}
          style={[
            styles.avatarBubble,
            { backgroundColor: av.color, marginLeft: idx === 0 ? 0 : -6 },
          ]}
        >
          <Text style={styles.avatarText}>{av.initials}</Text>
        </View>
      ))}
    </View>
  );
}

// Helpers — minimal color math; preview-fidelity only.
function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex: string): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = Math.round(parseInt(m[1], 16) * 0.7);
  const g = Math.round(parseInt(m[2], 16) * 0.7);
  const b = Math.round(parseInt(m[3], 16) * 0.7);
  return `rgb(${r}, ${g}, ${b})`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    padding: 14,
    minHeight: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    flex: 1,
  },
  cardCompact: {
    minHeight: 92,
    padding: 12,
    borderRadius: 12,
  },
  cardHighlighted: {
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 6,
  },
  eyebrowToday: {
    color: IOS_REGISTER.accentUserAction,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  bottomBlock: {
    gap: 8,
    marginTop: 'auto',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.05,
  },
  fromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fromText: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    flexShrink: 1,
  },
  cohortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatarBubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  cohortLabel: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    marginLeft: 4,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedLabel: {
    fontSize: 10.5,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
    flexShrink: 1,
  },
});
