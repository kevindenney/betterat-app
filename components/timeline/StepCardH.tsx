import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import type { PhaseProgress, StepCardH as StepCardHData } from './types';

interface Props {
  card: StepCardHData;
  /** Editable user's own card → renders drag handle + opens long-press menu. */
  editable?: boolean;
  /** Read-only views render an "+ Add to my timeline" CTA in the footer. */
  showAdopt?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onAdopt?: () => void;
}

const CARD_WIDTH = 230;
const CARD_WIDTH_CURRENT = 256;

const PILL_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  done: { bg: 'rgba(52,199,89,0.16)', border: 'rgba(52,199,89,0.55)', color: '#1F8636' },
  current: { bg: 'rgba(0,122,255,0.14)', border: '#007AFF', color: '#0046A8' },
  now: { bg: 'rgba(0,122,255,0.14)', border: '#007AFF', color: '#0046A8' },
  next: { bg: '#F2F2F7', border: 'rgba(60,60,67,0.18)', color: IOS_COLORS.secondaryLabel },
};

export function StepCardH({
  card,
  editable = false,
  showAdopt = false,
  onPress,
  onLongPress,
  onAdopt,
}: Props) {
  const isCurrent = card.state === 'current';
  const isDone = card.state === 'done';
  const pillKey = (card.pillLabel ?? card.state).toLowerCase();
  const pillStyle = PILL_STYLES[pillKey] ?? PILL_STYLES.next;
  const pillLabel = (card.pillLabel ?? card.state).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={editable ? onLongPress : undefined}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.card,
        isCurrent ? styles.cardCurrent : null,
        isDone ? styles.cardDone : null,
        pressed ? styles.cardPressed : null,
      ]}
    >
      {card.stripeColor ? (
        <View style={[styles.stripe, { backgroundColor: card.stripeColor }]} />
      ) : null}

      <View style={styles.topRow}>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: pillStyle.bg,
              borderColor: pillStyle.border,
            },
          ]}
        >
          <View
            style={[styles.pillDot, { backgroundColor: pillStyle.color }]}
          />
          <Text style={[styles.pillText, { color: pillStyle.color }]}>
            {pillLabel}
          </Text>
        </View>
        <Text style={styles.stepNo}>
          {card.stepNumber} / {card.totalSteps}
        </Text>
      </View>

      {card.planTag ? <Text style={styles.planTag}>{card.planTag}</Text> : null}

      <Text style={styles.title} numberOfLines={isCurrent ? 4 : 3}>
        {card.title}
      </Text>

      {card.meta ? <Text style={styles.meta}>{card.meta}</Text> : null}

      {card.phaseDots ? (
        <View style={styles.phaseDots}>
          {card.phaseDots.map((p, i) => (
            <PhaseDot key={i} progress={p} done={isDone} />
          ))}
        </View>
      ) : null}

      <View style={styles.grow} />

      {editable ? (
        <View style={styles.footRow}>
          <View style={styles.dragHandle}>
            <Text style={styles.dragHandleIcon}>⋮⋮</Text>
          </View>
          <Text style={styles.openLink}>Open ›</Text>
        </View>
      ) : showAdopt ? (
        <Pressable
          onPress={onAdopt}
          style={({ pressed }) => [
            styles.adoptBtn,
            pressed ? styles.adoptBtnPressed : null,
          ]}
        >
          <Text style={styles.adoptBtnText}>+ Add to my timeline</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function PhaseDot({ progress, done }: { progress: PhaseProgress; done: boolean }) {
  if (progress === 'empty') {
    return <View style={[styles.dot, styles.dotEmpty]} />;
  }
  if (progress === 'half') {
    return <View style={[styles.dot, styles.dotHalf]} />;
  }
  return (
    <View
      style={[
        styles.dot,
        styles.dotFull,
        done ? styles.dotDone : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
    borderRadius: 14,
    padding: 12,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    overflow: 'hidden',
  },
  cardCurrent: {
    width: CARD_WIDTH_CURRENT,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    transform: [{ translateY: -4 }],
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  cardDone: {
    opacity: 0.72,
  },
  cardPressed: {
    opacity: 0.6,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 0.5,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  stepNo: {
    fontSize: 9.5,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.4,
  },
  planTag: {
    fontSize: 9.5,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '500',
    fontStyle: 'italic',
    color: IOS_COLORS.label,
    lineHeight: 18,
    letterSpacing: -0.15,
  },
  meta: {
    fontSize: 10.5,
    color: IOS_COLORS.tertiaryLabel,
    lineHeight: 14,
    marginTop: 7,
  },
  phaseDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    marginTop: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  dotEmpty: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.25,
    borderColor: 'rgba(60,60,67,0.28)',
  },
  dotHalf: {
    backgroundColor: '#007AFF',
    borderWidth: 1.25,
    borderColor: '#007AFF',
    opacity: 0.55,
  },
  dotFull: {
    backgroundColor: IOS_COLORS.label,
    borderWidth: 1.25,
    borderColor: IOS_COLORS.label,
  },
  dotDone: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  grow: {
    flex: 1,
    minHeight: 6,
  },
  footRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(60,60,67,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dragHandle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleIcon: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    transform: [{ rotate: '90deg' }],
  },
  openLink: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 'auto',
  },
  adoptBtn: {
    marginTop: 10,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adoptBtnPressed: {
    opacity: 0.7,
  },
  adoptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
});
