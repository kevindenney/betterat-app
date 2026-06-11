/**
 * VisionBlock — the VISION ↔ PROGRESS lane that sits at the top of
 * the L3 canvas, above PRACTICE LOG.
 *
 * Three modes:
 *   1. No vision set — quiet empty-state CTA: "Add a vision for this
 *      arc — what would 'done' look like?"
 *   2. Vision set, no competency anchors — italic-serif statement +
 *      weekly proven-evidence sparkline + velocity footer
 *      ("+N this week · M total · week X of Y")
 *   3. Vision set + competency anchors — italic-serif statement +
 *      per-competency row (label · weekly sparkline · season-to-date
 *      relative bar · running total · pace arrow) + same velocity
 *      footer summarized across anchored competencies.
 *
 * Tap anywhere → edit sheet opens.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { OrgCompetencyOption } from '@/hooks/useUserOrgCompetencies';

type Pace = 'up' | 'flat' | 'down' | 'none';
type PaceIconName = 'trending-up' | 'remove' | 'trending-down';

/**
 * Compare this-week's evidence count to the average of prior weeks in
 * the season. Returns 'none' when there's nothing meaningful to
 * compare (week 1, or all-zero history with no current). Else returns
 * a direction based on a ±25% band around the prior average.
 */
function computePace(trend: number[], currentWeek: number): Pace {
  if (currentWeek < 1 || trend.length < currentWeek) return 'none';
  const thisIdx = currentWeek - 1;
  if (thisIdx === 0) return 'none';
  const prior = trend.slice(0, thisIdx);
  const priorSum = prior.reduce((a, b) => a + b, 0);
  const priorAvg = priorSum / prior.length;
  const thisCount = trend[thisIdx] ?? 0;
  if (priorAvg === 0 && thisCount === 0) return 'none';
  if (priorAvg === 0 && thisCount > 0) return 'up';
  const ratio = thisCount / priorAvg;
  if (ratio >= 1.25) return 'up';
  if (ratio <= 0.75) return 'down';
  return 'flat';
}

const PACE_ICON: Record<Exclude<Pace, 'none'>, PaceIconName> = {
  up: 'trending-up',
  flat: 'remove',
  down: 'trending-down',
};

const PACE_COLOR: Record<Exclude<Pace, 'none'>, string> = {
  up: IOS_COLORS.systemGreen,
  flat: IOS_REGISTER.labelTertiary,
  down: IOS_COLORS.systemOrange,
};

const PACE_A11Y: Record<Exclude<Pace, 'none'>, string> = {
  up: 'trending up vs prior weeks',
  flat: 'on pace with prior weeks',
  down: 'below prior-week average',
};

interface Props {
  statement: string | null | undefined;
  /** Persona-native noun for the calendar block (arc / rotation /
   *  season / sketchbook / project). Keeps the empty-state CTA and edit
   *  labels in the interest's voice instead of the sailing default. */
  periodNoun: string;
  competencyIds: string[];
  /** All competencies the user could anchor to — used to resolve the
   *  selected ids to their display labels. Empty when the user has no
   *  institutional framework. */
  allCompetencies: OrgCompetencyOption[];
  /** Total weeks in the arc and how far through (1-indexed). Drives the
   *  velocity footer ("week X of Y"). */
  totalWeeks: number;
  currentWeek: number;
  /** Total proven evidence count across the arc. v1 aggregate denominator. */
  provenEvidenceCount: number;
  /** Proven evidence count keyed by org_competencies.id. Drives the
   *  per-competency season-to-date relative bar when anchored. */
  evidenceByCompetency: Record<string, number>;
  /** Weekly proven-evidence trend keyed by org_competencies.id. Each
   *  value is one number per L4 bucket, used to render the inline
   *  sparkline next to each anchored competency. */
  evidenceTrendByCompetency: Record<string, number[]>;
  /** Aggregate weekly proven-evidence count across every current-season
   *  step. Length = season bucket count. Drives the sparkline on the
   *  no-anchor path and the "+N this week" velocity number. */
  evidenceTrend: number[];
  onEdit: () => void;
}

const SPARK_HEIGHT = 14;
const SPARK_MIN_BAR = 2;
const AGGREGATE_SPARK_HEIGHT = 22;

function PaceIcon({ pace, size = 12 }: { pace: Pace; size?: number }) {
  if (pace === 'none') return null;
  return (
    <Ionicons
      name={PACE_ICON[pace]}
      size={size}
      color={PACE_COLOR[pace]}
      accessibilityLabel={PACE_A11Y[pace]}
    />
  );
}

export function VisionBlock({
  statement,
  periodNoun,
  competencyIds,
  allCompetencies,
  totalWeeks,
  currentWeek,
  provenEvidenceCount,
  evidenceByCompetency,
  evidenceTrendByCompetency,
  evidenceTrend,
  onEdit,
}: Props) {
  const selectedCompetencies = useMemo(() => {
    if (competencyIds.length === 0) return [];
    const byId = new Map(allCompetencies.map((c) => [c.id, c]));
    return competencyIds
      .map((id) => byId.get(id))
      .filter((c): c is OrgCompetencyOption => c !== undefined);
  }, [competencyIds, allCompetencies]);

  // Max evidence count across the anchored set — drives bar fill ratio
  // so the most-evidenced competency reads as "full". When every anchor
  // is at 0, bars stay empty (no fake progress).
  const maxAnchorCount = useMemo(() => {
    let max = 0;
    for (const c of selectedCompetencies) {
      const n = evidenceByCompetency[c.id] ?? 0;
      if (n > max) max = n;
    }
    return max;
  }, [selectedCompetencies, evidenceByCompetency]);

  // Max single-week count across all anchored sparklines — scales every
  // row's sparkline against the same ceiling so a competency with 3
  // evidences in one week reads visibly taller than one with 1.
  const maxWeeklyAcrossAnchors = useMemo(() => {
    let max = 0;
    for (const c of selectedCompetencies) {
      const trend = evidenceTrendByCompetency[c.id];
      if (!trend) continue;
      for (const n of trend) if (n > max) max = n;
    }
    return max;
  }, [selectedCompetencies, evidenceTrendByCompetency]);

  // This week's count (1-indexed currentWeek → 0-indexed trend slot).
  // Drives the velocity footer.
  const thisWeekCount =
    currentWeek > 0 && evidenceTrend.length >= currentWeek
      ? evidenceTrend[currentWeek - 1] ?? 0
      : 0;

  const maxAggregateWeekly = useMemo(() => {
    let max = 0;
    for (const n of evidenceTrend) if (n > max) max = n;
    return max;
  }, [evidenceTrend]);

  const aggregatePace = useMemo(
    () => computePace(evidenceTrend, currentWeek),
    [evidenceTrend, currentWeek],
  );

  const trimmed = statement?.trim() ?? '';

  if (!trimmed) {
    return (
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Add a vision for this ${periodNoun}`}
      >
        {({ pressed }) => (
          // Row layout lives on this View, not the Pressable: a function-form
          // Pressable `style` silently drops flexDirection:'row', which stacked
          // the flag / text / chevron vertically.
          <View style={[styles.empty, pressed && styles.pressed]}>
            <Ionicons
              name="flag-outline"
              size={16}
              color={IOS_REGISTER.labelSecondary}
            />
            <Text style={styles.emptyText}>
              Add a vision for this {periodNoun} — what would &ldquo;done&rdquo;
              look like?
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={IOS_REGISTER.labelTertiary}
            />
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${periodNoun} vision`}
    >
      {({ pressed }) => (
      // Card chrome lives on this View, not the Pressable: a function-form
      // Pressable `style` silently drops margins/background (same trap as
      // the empty-state branch above), leaving the statement flush against
      // the screen edge.
      <View style={[styles.block, pressed && styles.pressed]}>
      <View style={styles.headRow}>
        <Text style={styles.eyebrow}>VISION</Text>
        <Ionicons
          name="create-outline"
          size={14}
          color={IOS_REGISTER.labelTertiary}
        />
      </View>
      <Text style={styles.statement}>{trimmed}</Text>

      {selectedCompetencies.length > 0 ? (
        <View style={styles.compStack}>
          {selectedCompetencies.map((c) => {
            const count = evidenceByCompetency[c.id] ?? 0;
            const pct = maxAnchorCount > 0 ? count / maxAnchorCount : 0;
            const trend = evidenceTrendByCompetency[c.id] ?? [];
            const pace = computePace(trend, currentWeek);
            return (
              <View key={c.id} style={styles.compRow}>
                <Text style={styles.compLabel} numberOfLines={1}>
                  {c.shortLabel || c.fullLabel}
                </Text>
                <View style={styles.spark}>
                  {trend.map((n, i) => {
                    const h =
                      maxWeeklyAcrossAnchors > 0
                        ? Math.max(
                            SPARK_MIN_BAR,
                            (n / maxWeeklyAcrossAnchors) * SPARK_HEIGHT,
                          )
                        : SPARK_MIN_BAR;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.sparkBar,
                          { height: h, opacity: n > 0 ? 1 : 0.22 },
                        ]}
                      />
                    );
                  })}
                </View>
                <View style={styles.compBarTrack}>
                  <View
                    style={[
                      styles.compBarFill,
                      { width: `${Math.round(pct * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.compCount}>{count}</Text>
                <View style={styles.compPace}>
                  <PaceIcon pace={pace} />
                </View>
              </View>
            );
          })}
        </View>
      ) : maxAggregateWeekly > 0 ? (
        // All-zero trends render as one faint full-width 2px bar that reads
        // as a stray separator line — skip the sparkline until evidence lands.
        <View style={styles.aggregateSpark}>
          {evidenceTrend.map((n, i) => {
            const h =
              maxAggregateWeekly > 0
                ? Math.max(
                    SPARK_MIN_BAR,
                    (n / maxAggregateWeekly) * AGGREGATE_SPARK_HEIGHT,
                  )
                : SPARK_MIN_BAR;
            const isCurrent = i === currentWeek - 1;
            return (
              <View
                key={i}
                style={[
                  styles.aggregateSparkBar,
                  {
                    height: h,
                    opacity: n > 0 ? 1 : 0.22,
                  },
                  isCurrent && styles.aggregateSparkBarCurrent,
                ]}
              />
            );
          })}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        {provenEvidenceCount === 0 ? (
          <Text style={styles.footer} numberOfLines={1}>
            week {currentWeek} of {totalWeeks} · log a reflection to start tracking
          </Text>
        ) : (
          <>
            <Text style={styles.footerStrong} numberOfLines={1}>
              +{thisWeekCount} this week
            </Text>
            <PaceIcon pace={aggregatePace} size={13} />
            <Text style={styles.footer} numberOfLines={1}>
              · {provenEvidenceCount} total · week {currentWeek} of {totalWeeks}
            </Text>
          </>
        )}
      </View>
      </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(120, 120, 130, 0.14)',
    backgroundColor: 'rgba(120, 120, 130, 0.06)',
  },
  emptyText: {
    flex: 1,
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    fontStyle: 'italic',
  },
  block: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(120, 120, 130, 0.14)',
    backgroundColor: 'rgba(120, 120, 130, 0.06)',
    gap: 10,
  },
  pressed: { opacity: 0.7 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  statement: {
    fontSize: 16,
    lineHeight: 22,
    color: IOS_REGISTER.label,
    fontStyle: 'italic',
    letterSpacing: -0.2,
  },
  aggregateSpark: {
    height: AGGREGATE_SPARK_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginTop: 2,
  },
  aggregateSparkBar: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  aggregateSparkBarCurrent: {
    backgroundColor: IOS_REGISTER.label,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  footer: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
  },
  footerStrong: {
    fontSize: 11.5,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  compStack: { gap: 6, marginTop: 4 },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compLabel: {
    width: 88,
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
  },
  spark: {
    width: 56,
    height: SPARK_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 1,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  compBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60,60,67,0.18)',
    overflow: 'hidden',
  },
  compBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  compCount: {
    width: 22,
    textAlign: 'right',
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
  },
  compPace: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
