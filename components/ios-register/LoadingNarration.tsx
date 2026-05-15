/**
 * LoadingNarration — canonical iOS-register loading-state component.
 *
 * The visual treatment of the "Loading-state narration" cross-cutting
 * principle (see IOS_MIGRATION_PLAN.md). Every future AI-work loading state
 * in BetterAt inherits from this component.
 *
 * Reference pattern: OpenAI ChatGPT plan-ready flow — short status lines
 * that swap as the pipeline advances. The line itself is the progress
 * signal; no spinner anywhere.
 *
 * Voice rules:
 *   - Present continuous tense ("Reading", "Finding", "Drafting")
 *   - No exclamation marks
 *   - No progress percentages
 *   - No "Loading…" copy
 *   - Plain language — non-developer reads it and understands
 *   - Messages narrate what the system is actually doing, not abstract progress
 *
 * Motion: replace, not scroll, not carousel. The active line supersedes the
 * past one; the next line is visible-but-dim before the swap so the user
 * reads it half-consciously and the swap feels expected.
 *
 * Source: Claude Design "Discover · Get Inspired · running state · iOS
 * register" handoff. First surface against this principle was the Get
 * Inspired modal; the component is decoupled from that framing so any
 * future surface can mount it directly.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

/**
 * Slate-blue narration ink — the register's "system is talking now" color.
 * Sits between iOS blue (action) and label-secondary (chrome): close enough
 * to blue that it reads as system voice, muted enough that it doesn't beg
 * for a tap.
 */
const NARRATION_INK = '#4A6280';
const NARRATION_PAST = 'rgba(74, 98, 128, 0.32)';
const NARRATION_FUTURE = 'rgba(60, 60, 67, 0.18)';

interface Props {
  /** ALL-CAPS coral eyebrow label, e.g. "Working on this". */
  microLabel: string;
  /**
   * The current pipeline lines, ordered. The component picks the past /
   * active / next slice by `activeIndex`. Each line stays 1.5–2.5s
   * depending on the underlying pipeline stage's actual duration; below
   * 600ms it should still show for 600ms or the user reads it as a
   * flicker.
   */
  lines: string[];
  activeIndex: number;
  /**
   * Right-aligned meta under the step dots ("Step 3 of 5"). Optional —
   * caller passes the formatted string so localization stays at the
   * boundary.
   */
  stepMeta?: string;
}

export function LoadingNarration({
  microLabel,
  lines,
  activeIndex,
  stepMeta,
}: Props) {
  const safeIndex = Math.max(0, Math.min(activeIndex, lines.length - 1));
  const past = safeIndex > 0 ? lines[safeIndex - 1] : undefined;
  const active = lines[safeIndex];
  const next = safeIndex < lines.length - 1 ? lines[safeIndex + 1] : undefined;

  return (
    <View style={styles.narration}>
      <View style={styles.micro}>
        <PulseDot />
        <Text style={styles.microText}>{microLabel}</Text>
      </View>

      <View style={styles.lines}>
        {past ? (
          <Text style={[styles.line, styles.linePast]} numberOfLines={2}>
            {past}
          </Text>
        ) : null}
        <Text style={[styles.line, styles.lineActive]} numberOfLines={3}>
          {active}
          <Text style={styles.lineActiveCaret}>{'  '}●</Text>
        </Text>
        {next ? (
          <Text style={[styles.line, styles.lineNext]} numberOfLines={2}>
            {next}
          </Text>
        ) : null}
      </View>

      <View style={styles.dots}>
        {lines.map((_, i) => {
          if (i < safeIndex) {
            return <View key={i} style={[styles.dot, styles.dotDone]} />;
          }
          if (i === safeIndex) {
            return <ActiveDot key={i} />;
          }
          return <View key={i} style={styles.dot} />;
        })}
        {stepMeta ? (
          <Text style={styles.dotMeta}>{stepMeta}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PulseDot — 7px coral dot with a 1.8s breathing halo. Same component family
// as Race Prep's WorkingOnPill live-dot grammar.
// ---------------------------------------------------------------------------

function PulseDot() {
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo]);
  const scale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const opacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  return (
    <View style={styles.pulseDotWrap}>
      <Animated.View
        style={[
          styles.pulseDotHalo,
          { transform: [{ scale }], opacity },
        ]}
      />
      <View style={styles.pulseDotCore} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// ActiveDot — 10px coral-ringed white circle with a breathing halo. The step
// dots' active variant.
// ---------------------------------------------------------------------------

function ActiveDot() {
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo]);
  const scale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const opacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  return (
    <View style={styles.activeDotWrap}>
      <Animated.View
        style={[
          styles.activeDotHalo,
          { transform: [{ scale }], opacity },
        ]}
      />
      <View style={styles.activeDotCore} />
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  narration: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  micro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  microText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.accentMarkedContent,
  },
  lines: {
    minHeight: 132,
    justifyContent: 'center',
  },
  line: {
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.3,
    fontWeight: '400',
    color: NARRATION_INK,
  },
  linePast: {
    color: NARRATION_PAST,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  lineActive: {
    color: NARRATION_INK,
  },
  lineActiveCaret: {
    color: IOS_REGISTER.accentMarkedContent,
    fontSize: 12,
  },
  lineNext: {
    color: NARRATION_FUTURE,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    marginTop: 12,
  },
  dots: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D1D6',
  },
  dotDone: {
    backgroundColor: IOS_REGISTER.accentMarkedContent,
    opacity: 0.85,
  },
  dotMeta: {
    marginLeft: 'auto',
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
  },
  pulseDotWrap: {
    width: 7,
    height: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDotHalo: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  pulseDotCore: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  activeDotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDotHalo: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  activeDotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.accentMarkedContent,
  },
});
