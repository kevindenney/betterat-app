/**
 * D11 — headline metric render block (per-persona North Star).
 *
 * A type-only card (no chart) that sits at the top of the L3/L4
 * practice surface, above the capability mix: a persona-native eyebrow
 * ("FORM" / "PROGRAM" / "EARNINGS" / "HANDICAP"), one strong figure, a
 * one-line caption, and an optional trend delta. Styled like the D7
 * money readout's total line but promoted to the top and larger.
 *
 * The renderer is dumb: tone (and therefore tint) is decided by the
 * resolver in `interestHeadline.ts`, because direction semantics are
 * metric-aware — a *down* handicap or a *down* finish position is good.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { HeadlineMetricValue } from './interestHeadline';

const TONE_COLOR: Record<NonNullable<HeadlineMetricValue['tone']>, string> = {
  positive: '#5BA46F',
  caution: '#C4842A',
  neutral: IOS_REGISTER.label,
};

const DELTA_GLYPH: Record<'up' | 'down' | 'flat', string> = {
  up: '▲',
  down: '▼',
  flat: '–',
};

export function HeadlineMetric({
  label,
  value,
}: {
  label: string;
  value: HeadlineMetricValue;
}) {
  const tone = value.tone ?? 'neutral';
  const figureColor = TONE_COLOR[tone];

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{label}</Text>
      <View style={styles.figureRow}>
        <Text style={[styles.figure, { color: figureColor }]} numberOfLines={1}>
          {value.value}
        </Text>
        {value.delta ? (
          <Text style={[styles.delta, { color: figureColor }]} numberOfLines={1}>
            {DELTA_GLYPH[value.delta.direction]} {value.delta.text}
          </Text>
        ) : null}
      </View>
      <Text style={styles.caption} numberOfLines={2}>
        {value.caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 6,
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  figure: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  delta: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  caption: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 3,
    letterSpacing: -0.1,
  },
});
