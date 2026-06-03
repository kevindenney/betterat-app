/**
 * NursingCoverageSurface — the competency constellation (N3, Frame C).
 *
 * The "where" payoff: skills are *located*, so this surface turns the student's
 * logged shifts into a framework-coverage view — a ring against the JHSON
 * framework, per-category bars, the sites where each area was evidenced, and an
 * honest gap card that routes the biggest unevidenced area to "plan a step."
 * All numbers are real (from `useNursingCompetencyCoverage`); before the first
 * shift the ring reads 0 / framework and every area is a gap, which is the
 * truthful "am I ready?" state.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import {
  useNursingCompetencyCoverage,
  type CategoryCoverage,
} from '@/hooks/useNursingCompetencyCoverage';
import type { CoverageCluster } from '@/hooks/useNursingSiteCoverage';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

const CLUSTER_COLORS: Record<CoverageCluster, string> = {
  cardiac: '#E5484D',
  resp: '#0E7490',
  med: '#7C3AED',
  general: '#16A34A',
  assess: '#D97706',
};

export interface NursingCoverageSurfaceProps {
  toolbarOffset?: number;
  bottomOffset?: number;
  /** Route to plan a step for the named gap area. */
  onPlanGap?: (category: string) => void;
}

const RING_SIZE = 88;
const RING_STROKE = 9;

function CoverageRing({ evidenced, total }: { evidenced: number; total: number }) {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? evidenced / total : 0;
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          stroke="rgba(118,118,128,0.16)"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          stroke="#16A34A"
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c * (1 - pct)}`}
          strokeDashoffset={c * 0.25}
        />
      </Svg>
      <View style={styles.ringInner}>
        <Text style={styles.ringNum}>
          {evidenced}/{total}
        </Text>
        <Text style={styles.ringLab}>evidenced</Text>
      </View>
    </View>
  );
}

function summaryLine(evidenced: number, total: number, gaps: number): string {
  if (evidenced === 0) {
    return 'Log a clinical shift to start evidencing competencies. Each one is located to the site where you earned it.';
  }
  const pct = Math.round((evidenced / total) * 100);
  if (gaps === 0) {
    return `You're ${pct}% covered, with at least one competency evidenced in every framework area.`;
  }
  return `You're ${pct}% covered. ${gaps} framework area${gaps === 1 ? '' : 's'} have no evidence yet — see the gap below.`;
}

function CategoryRow({ row }: { row: CategoryCoverage }) {
  const color = CLUSTER_COLORS[row.cluster];
  const frac = row.total > 0 ? row.evidenced / row.total : 0;
  return (
    <View style={styles.catRow}>
      <View style={[styles.catDot, { backgroundColor: row.evidenced > 0 ? color : 'rgba(118,118,128,0.3)' }]} />
      <View style={styles.catBody}>
        <View style={styles.catTop}>
          <Text style={[styles.catName, row.evidenced === 0 && styles.catNameGap]} numberOfLines={1}>
            {row.category}
          </Text>
          <Text style={styles.catCount}>
            {row.evidenced} / {row.total}
          </Text>
        </View>
        <View style={styles.catTrack}>
          <View
            style={{
              width: `${Math.round(frac * 100)}%`,
              backgroundColor: color,
              height: '100%',
              borderRadius: 3,
            }}
          />
        </View>
      </View>
    </View>
  );
}

export function NursingCoverageSurface({
  toolbarOffset = 0,
  bottomOffset = 0,
  onPlanGap,
}: NursingCoverageSurfaceProps) {
  const { coverage, isLoading } = useNursingCompetencyCoverage();

  if (isLoading || !coverage) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.muted}>{isLoading ? 'Loading coverage…' : 'No framework found.'}</Text>
      </View>
    );
  }

  const { frameworkTotal, evidencedTotal, byCategory, sites, gaps } = coverage;
  const topGap = gaps[0] ?? null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: toolbarOffset + IOS_SPACING.sm, paddingBottom: bottomOffset + IOS_SPACING.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Ring + plain-language summary */}
      <View style={styles.ringWrap}>
        <CoverageRing evidenced={evidencedTotal} total={frameworkTotal} />
        <View style={styles.ringText}>
          <Text style={styles.ringTitle}>JHSON framework</Text>
          <Text style={styles.ringSummary}>
            {summaryLine(evidencedTotal, frameworkTotal, gaps.length)}
          </Text>
        </View>
      </View>

      {/* Per-category coverage */}
      <Text style={styles.eyebrow}>Coverage by area</Text>
      <View style={styles.card}>
        {byCategory.map((row, i) => (
          <View key={row.category}>
            {i > 0 ? <View style={styles.sep} /> : null}
            <CategoryRow row={row} />
          </View>
        ))}
      </View>

      {/* Where evidenced — real sites */}
      {sites.length > 0 ? (
        <>
          <Text style={styles.eyebrow}>Where you've evidenced this</Text>
          <View style={styles.card}>
            {sites.map((s, i) => (
              <View key={s.poiId}>
                {i > 0 ? <View style={styles.sep} /> : null}
                <View style={styles.evRow}>
                  <View style={styles.evPin}>
                    <Ionicons name="location" size={15} color="#16A34A" />
                  </View>
                  <View style={styles.evBody}>
                    <Text style={styles.evName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.evSub}>
                      {s.shifts} shift{s.shifts === 1 ? '' : 's'} logged
                    </Text>
                  </View>
                  <Text style={styles.evCount}>
                    {s.competencies} comp{s.competencies === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Gap card — routes the biggest unevidenced area to plan a step */}
      {topGap ? (
        <Pressable
          style={styles.gapCard}
          onPress={() => onPlanGap?.(topGap.category)}
          accessibilityRole="button"
          accessibilityLabel={`Plan a step for ${topGap.category}`}
        >
          <Text style={styles.gapKicker}>⚠ Biggest gap</Text>
          <Text style={styles.gapTitle}>
            {topGap.category} isn&apos;t evidenced yet
            {gaps.length > 1 ? ` (+${gaps.length - 1} more area${gaps.length - 1 === 1 ? '' : 's'})` : ''}.
          </Text>
          <Text style={styles.gapBody}>
            {topGap.total} competenc{topGap.total === 1 ? 'y' : 'ies'} in this area have no evidence.
            Plan a step at an upcoming rotation so it&apos;s ready when you arrive.
          </Text>
          <View style={styles.gapCta}>
            <Text style={styles.gapCtaText}>Plan a step</Text>
            <Ionicons name="arrow-forward" size={13} color="#B45309" />
          </View>
        </Pressable>
      ) : null}

      <View style={styles.demoNote}>
        <Ionicons name="lock-closed" size={11} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.demoNoteText}>
          Coverage is computed from your logged shifts against the JHSON framework. Site-level only —
          no patient, room, or unit detail.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { alignItems: 'center', justifyContent: 'center' },
  muted: { color: IOS_COLORS.secondaryLabel, fontSize: 13 },
  content: { paddingHorizontal: IOS_SPACING.md, gap: IOS_SPACING.sm },
  ringWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    padding: IOS_SPACING.md,
  },
  ringInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNum: { fontSize: 18, fontWeight: '800', color: IOS_COLORS.label, letterSpacing: -0.5 },
  ringLab: { fontSize: 9, color: IOS_COLORS.secondaryLabel, fontWeight: '600' },
  ringText: { flex: 1, gap: 4 },
  ringTitle: { fontSize: 16, fontWeight: '700', color: IOS_COLORS.label },
  ringSummary: { fontSize: 12.5, color: IOS_COLORS.secondaryLabel, lineHeight: 18 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    marginTop: IOS_SPACING.md,
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: IOS_SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: IOS_COLORS.separator },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  catDot: { width: 9, height: 9, borderRadius: 5 },
  catBody: { flex: 1, gap: 6 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  catName: { fontSize: 13, fontWeight: '600', color: IOS_COLORS.label, flex: 1 },
  catNameGap: { color: IOS_COLORS.tertiaryLabel, fontWeight: '500' },
  catCount: { fontSize: 12, color: IOS_COLORS.secondaryLabel, fontWeight: '600' },
  catTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(60,60,67,0.10)',
    overflow: 'hidden',
  },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  evPin: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(22,163,74,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evBody: { flex: 1, gap: 2 },
  evName: { fontSize: 14, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.2 },
  evSub: { fontSize: 12, color: IOS_COLORS.secondaryLabel },
  evCount: { fontSize: 12, fontWeight: '700', color: IOS_COLORS.secondaryLabel },
  gapCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,119,6,0.28)',
    borderRadius: 14,
    padding: 15,
    marginTop: IOS_SPACING.md,
    gap: 6,
  },
  gapKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#B45309',
  },
  gapTitle: { fontSize: 14.5, fontWeight: '700', color: '#7C2D12', lineHeight: 20 },
  gapBody: { fontSize: 12, color: '#9A3412', lineHeight: 18 },
  gapCta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  gapCtaText: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  demoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: IOS_SPACING.md,
    paddingHorizontal: 4,
  },
  demoNoteText: { flex: 1, fontSize: 11, color: IOS_COLORS.tertiaryLabel, lineHeight: 15 },
});

export default NursingCoverageSurface;
