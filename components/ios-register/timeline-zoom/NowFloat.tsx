/**
 * NowFloat — the floating "where am I in time" indicator for the merged Step
 * level (mockup #38 `.nowfloat`). Sits bottom-center, above the tab bar.
 *
 * Two reads:
 *   - The pill states the viewed step's relation to the canonical now-step:
 *     DONE (behind), NOW (on it), NEXT (ahead). This is the L2 done/planned
 *     split, expressed for a pager.
 *   - The pager is a compact minimap of the timeline, centered on the viewed
 *     step. Dots are tappable jump targets; the orange tick marks canonical
 *     now when it is inside the visible window.
 *
 * The pager windows around the now-step so long timelines stay compact.
 */

import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';

const DONE_COLOR = '#16A34A';
const NOW_COLOR = '#EA580C';
const NEXT_COLOR = IOS_REGISTER.accentUserAction;
const PAGER_WINDOW = 6;

export type NowRelation = 'done' | 'now' | 'next';

interface NowStripProps {
  relation: NowRelation;
  /** Index of the canonical now-step in the flat step list. */
  nowIndex: number;
  /** Index of the viewed/focused step in the flat step list. */
  viewedIndex: number;
  /** Total steps in the flat list. */
  total: number;
  onJumpToIndex?: (index: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

interface NowFloatProps extends NowStripProps {
  /**
   * Distance from the bottom edge, in points. Lets the host lift the float
   * above the floating tab bar. Defaults to 86 (legacy standalone placement).
   */
  bottomOffset?: number;
}

/**
 * The relation pill + minimap row, free of any floating chrome. Hosts choose
 * where it lives: inline in the StepTaskBar (web — chrome belongs in the
 * header band, floating it over cards kept occluding their text) or wrapped
 * by NowFloat as the bottom-center float (native).
 */
export function NowStrip({
  relation,
  nowIndex,
  viewedIndex,
  total,
  onJumpToIndex,
  onPrev,
  onNext,
}: NowStripProps) {
  const { start, end } = useMemo(() => {
    if (total <= PAGER_WINDOW) return { start: 0, end: total };
    const half = Math.floor(PAGER_WINDOW / 2);
    let s = Math.max(0, viewedIndex - half);
    const e = Math.min(total, s + PAGER_WINDOW);
    s = Math.max(0, e - PAGER_WINDOW);
    return { start: s, end: e };
  }, [total, viewedIndex]);

  const pillColor =
    relation === 'now' ? NOW_COLOR : relation === 'done' ? DONE_COLOR : NEXT_COLOR;
  const pillLabel = relation === 'now' ? '▸ NOW' : relation === 'done' ? '◂ DONE' : '▸ NEXT';
  const pillAction = relation === 'done' ? onPrev : relation === 'next' ? onNext : undefined;
  const pillDisabled = !pillAction;

  const dots: React.ReactNode[] = [];
  for (let i = start; i < end; i += 1) {
    const isViewed = i === viewedIndex;
    const isDone = nowIndex >= 0 && i < nowIndex;
    const canJump = Boolean(onJumpToIndex);
    dots.push(
      <Pressable
        testID={`timeline-now-step-${i + 1}`}
        key={i}
        accessibilityRole="button"
        accessibilityLabel={`Go to step ${i + 1}`}
        accessibilityState={{ selected: isViewed }}
        disabled={!canJump}
        hitSlop={8}
        onPress={() => onJumpToIndex?.(i)}
        style={styles.dotHit}
      >
        <View style={styles.dotSlot}>
          {i === nowIndex ? <View style={styles.nowtick} /> : null}
          <View
            style={[
              styles.dot,
              isDone && styles.dotDone,
              isViewed && styles.dotViewed,
            ]}
          />
        </View>
      </Pressable>,
    );
  }

  return (
    <View style={styles.strip}>
      <Pressable
        testID="timeline-now-primary-action"
        accessibilityRole="button"
        accessibilityLabel={
          relation === 'done'
            ? 'Previous step'
            : relation === 'next'
              ? 'Next step'
              : 'Current step'
        }
        disabled={pillDisabled}
        onPress={pillAction}
        style={[styles.np, { backgroundColor: pillColor }, pillDisabled && styles.npDisabled]}
      >
        <Text style={styles.npText}>{pillLabel}</Text>
      </Pressable>
      {total > 1 ? <View style={styles.pager}>{dots}</View> : null}
    </View>
  );
}

export function NowFloat({ bottomOffset = 86, ...strip }: NowFloatProps) {
  return (
    <View
      testID="timeline-now-float"
      style={[styles.wrap, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      <View style={styles.float}>
        <NowStrip {...strip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 45,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  float: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    ...Platform.select({
      ios: {
        shadowColor: '#141C2D',
        shadowOpacity: 0.16,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  np: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  npDisabled: {
    opacity: 0.72,
  },
  npText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  dotHit: {
    minWidth: 16,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotSlot: {
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  dotDone: {
    backgroundColor: DONE_COLOR,
  },
  dotViewed: {
    width: 18,
    height: 7,
    borderRadius: 4,
    backgroundColor: NEXT_COLOR,
  },
  nowtick: {
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: NOW_COLOR,
    marginHorizontal: 1,
  },
});

export default NowFloat;
