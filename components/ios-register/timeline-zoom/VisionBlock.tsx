/**
 * VisionBlock — the VISION ↔ PROGRESS lane that sits at the top of
 * the L3 canvas, above PRACTICE LOG.
 *
 * Three modes:
 *   1. No vision set — quiet empty-state CTA: "Add a vision for this
 *      arc — what would 'done' look like?"
 *   2. Vision set, no competency anchors — italic-serif statement +
 *      aggregate progress strip ("12 capability evidences logged · 3
 *      of 7 weeks elapsed")
 *   3. Vision set + competency anchors — italic-serif statement +
 *      per-competency mini-bars (placeholder count for v1; real
 *      evidence joins land in v2)
 *
 * Tap anywhere → edit sheet opens.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { OrgCompetencyOption } from '@/hooks/useUserOrgCompetencies';

interface Props {
  statement: string | null | undefined;
  competencyIds: string[];
  /** All competencies the user could anchor to — used to resolve the
   *  selected ids to their display labels. Empty when the user has no
   *  institutional framework. */
  allCompetencies: OrgCompetencyOption[];
  /** Total weeks in the arc and how far through (1-indexed). Drives the
   *  aggregate progress strip. */
  totalWeeks: number;
  currentWeek: number;
  /** Total proven evidence count across the arc. v1 aggregate denominator. */
  provenEvidenceCount: number;
  onEdit: () => void;
}

export function VisionBlock({
  statement,
  competencyIds,
  allCompetencies,
  totalWeeks,
  currentWeek,
  provenEvidenceCount,
  onEdit,
}: Props) {
  const selectedCompetencies = useMemo(() => {
    if (competencyIds.length === 0) return [];
    const byId = new Map(allCompetencies.map((c) => [c.id, c]));
    return competencyIds
      .map((id) => byId.get(id))
      .filter((c): c is OrgCompetencyOption => c !== undefined);
  }, [competencyIds, allCompetencies]);

  const trimmed = statement?.trim() ?? '';

  if (!trimmed) {
    return (
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [styles.empty, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Add a vision for this arc"
      >
        <Ionicons
          name="flag-outline"
          size={16}
          color={IOS_REGISTER.labelSecondary}
        />
        <Text style={styles.emptyText}>
          Add a vision for this arc — what would &ldquo;done&rdquo; look like?
        </Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={IOS_REGISTER.labelTertiary}
        />
      </Pressable>
    );
  }

  const weekPct = totalWeeks > 0 ? Math.min(1, currentWeek / totalWeeks) : 0;

  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [styles.block, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Edit arc vision"
    >
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
          {selectedCompetencies.map((c) => (
            <View key={c.id} style={styles.compRow}>
              <Text style={styles.compLabel} numberOfLines={1}>
                {c.shortLabel || c.fullLabel}
              </Text>
              {/* v1 — empty progress bar; v2 joins to evidence */}
              <View style={styles.compBarTrack}>
                <View style={[styles.compBarFill, { width: '0%' }]} />
              </View>
              <Text style={styles.compCount}>—</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.aggregateRow}>
          <View style={styles.aggregateBarTrack}>
            <View
              style={[
                styles.aggregateBarFill,
                { width: `${Math.round(weekPct * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.aggregateMeta} numberOfLines={1}>
            week {currentWeek} of {totalWeeks} · {provenEvidenceCount}{' '}
            {provenEvidenceCount === 1 ? 'evidence' : 'evidences'} logged
          </Text>
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: 'rgba(120, 120, 130, 0.04)',
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(120, 120, 130, 0.06)',
    gap: 8,
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
  aggregateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  aggregateBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60,60,67,0.18)',
    overflow: 'hidden',
  },
  aggregateBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  aggregateMeta: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
  },
  compStack: { gap: 6, marginTop: 4 },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compLabel: {
    width: 96,
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
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
    width: 24,
    textAlign: 'right',
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
  },
});
