/**
 * <PlanRowCard> — Library Plans zone card.
 *
 * Per canonical §2: author chip (avatar + "From X · N steps"), bold plan
 * title, progress bar with "X of Y · status", a footer with subscriber
 * count and resources count, and a status pill (Active / Done / Paused).
 * Whole card is pressable — taps into /library/plans/[blueprintId].
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { useVocabulary } from '@/hooks/useVocabulary';
import type { SubscribedPlanRow } from '@/hooks/useSubscribedPlansForLibrary';

interface Props {
  plan: SubscribedPlanRow;
  onPress: () => void;
}

// Canonical .author-av / .av-stack .a backgrounds. Each variant is a
// 135deg linear gradient between two muted brand-adjacent tones. We
// deterministically pick a variant from a seed string (user id or
// initials) so the same person always gets the same gradient.
const AVATAR_GRADIENTS: readonly [string, string][] = [
  ['#4E6A85', '#7C7B6E'], // slate -> olive (default)
  ['#5A8C6A', '#3E6C4E'], // green
  ['#7C5E9A', '#5C3F7A'], // purple
  ['#6B5E48', '#4A3F2E'], // umber (subscriber-stack only in canonical)
];

function pickGradient(seed: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

interface GradientAvatarProps {
  seed: string;
  initials: string;
  size: number;
  fontSize: number;
  /** White ring around the avatar — used in overlapping subscriber stacks. */
  ring?: boolean;
}

function GradientAvatar({ seed, initials, size, fontSize, ring }: GradientAvatarProps) {
  const [from, to] = pickGradient(seed);
  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.gradientAvatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring ? 1.5 : 0,
        },
      ]}
    >
      <Text style={[styles.gradientAvatarText, { fontSize }]}>{initials}</Text>
    </LinearGradient>
  );
}

// Canonical §2: ACTIVE pill is light-blue (in-progress), DONE is green
// (a completed achievement reads as a win), PAUSED is muted gray.
// Labels render uppercase via CSS text-transform in the canonical
// mock (.zone-head .ttl + .badge text-transform: uppercase).
const STATUS_PILL: Record<
  SubscribedPlanRow['status'],
  { label: string; bg: string; fg: string }
> = {
  active: { label: 'ACTIVE', bg: 'rgba(0,122,255,0.12)', fg: '#0046A8' },
  done: { label: 'DONE', bg: 'rgba(52,199,89,0.14)', fg: '#10803F' },
  paused: { label: 'PAUSED', bg: 'rgba(142,142,147,0.18)', fg: '#5C5C61' },
};

export function PlanRowCard({ plan, onPress }: Props) {
  const { vocab } = useVocabulary();
  const pill = STATUS_PILL[plan.status];
  const progressPct = plan.stepCount > 0 ? Math.min(100, (plan.doneCount / plan.stepCount) * 100) : 0;

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.touchable, pressed && styles.touchablePressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${plan.title}`}
      >
      <View style={styles.head}>
        <GradientAvatar
          seed={plan.authorName || plan.blueprintId}
          initials={plan.authorInitials}
          size={28}
          fontSize={11}
        />
        <Text style={styles.authorLine} numberOfLines={1}>
          From <Text style={styles.authorName}>{plan.authorName}</Text>
          {plan.tagline ? ` · ${plan.tagline}` : ''}
          {' · '}
          {plan.stepCount > 0 ? `${plan.stepCount} steps` : 'no steps yet'}
        </Text>
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <View style={[styles.pillDot, { backgroundColor: pill.fg }]} />
          <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {plan.title}
      </Text>

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#34C759', '#007AFF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.progressFill, { width: `${progressPct}%` }]}
          />
        </View>
        <Text style={styles.progressMeta}>
          <Text style={styles.progressMetaEm}>
            {plan.doneCount} of {plan.stepCount || '—'}
          </Text>
          {plan.progressContext ? ` · ${plan.progressContext}` : ''}
        </Text>
      </View>

      <View style={styles.foot}>
        <View style={styles.footItem}>
          {plan.subscriberPreviews.length > 0 ? (
            <View style={styles.avatarStack}>
              {plan.subscriberPreviews.map((s, i) => (
                <View
                  key={s.id}
                  style={{
                    marginLeft: i === 0 ? 0 : -6,
                    zIndex: 10 - i,
                  }}
                >
                  <GradientAvatar
                    seed={s.id}
                    initials={s.initials}
                    size={20}
                    fontSize={9}
                    ring
                  />
                </View>
              ))}
            </View>
          ) : (
            <Ionicons name="people-outline" size={13} color={IOS_COLORS.secondaryLabel} />
          )}
          <Text style={styles.footText}>
            <Text style={styles.footEm}>{plan.subscriberCount}</Text>{' '}
            {plan.subscriberCount === 1 ? vocab('Peer') : vocab('Peers')}
          </Text>
        </View>
        {plan.resourceCount > 0 ? (
          <View style={styles.footItem}>
            <Ionicons name="library-outline" size={13} color={IOS_COLORS.secondaryLabel} />
            <Text style={styles.footText}>
              <Text style={styles.footEm}>{plan.resourceCount}</Text> resources
            </Text>
          </View>
        ) : null}
      </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Outer View owns the visible chrome AND the inner padding. Pressable
  // on Android doesn't reliably apply padding + backgroundColor + shadow
  // together, so we keep the Pressable as a pure touch overlay and put
  // all visual spacing on the wrapping View.
  card: {
    marginHorizontal: IOS_SPACING.lg,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  touchable: {
    borderRadius: 14,
    gap: 14,
  },
  touchablePressed: {
    opacity: 0.85,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradientAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#FFFFFF',
  },
  gradientAvatarText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  authorLine: {
    flex: 1,
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  authorName: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    // Canonical uses a serif at regular weight to give the title an
    // editorial feel — the card reads as a "plan you're walking",
    // not a list item.
    fontFamily: fontFamily.serif,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_COLORS.label,
    lineHeight: 22,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(60,60,67,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    // Color comes from the inline LinearGradient — no backgroundColor.
  },
  progressMeta: {
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
  },
  progressMetaEm: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footText: {
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  footEm: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
});
