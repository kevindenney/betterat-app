/**
 * CapabilitiesSurface — the generic Atlas "Capabilities" segment (the
 * non-nursing analogue of NursingCoverageSurface).
 *
 * Turns the user's logged steps into a framework-coverage view for the active
 * interest: a ring against the interest's capability framework, per-category
 * bars, the sites where each area was evidenced, and an honest gap card that
 * routes the biggest unevidenced area to "plan a step". All numbers are real
 * (from `useInterestCapabilityCoverage`); before the first attempt the ring
 * reads 0 / framework and every area is a gap — the truthful "am I ready?"
 * state. With no active interest it falls back to a general capability set.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import {
  useInterestCapabilityCoverage,
  type CapabilityCategoryCoverage,
} from '@/hooks/useInterestCapabilityCoverage';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

export interface CapabilitiesSurfaceProps {
  interestId: string | null;
  interestName: string;
  toolbarOffset?: number;
  bottomOffset?: number;
  /** Route to plan a step that can close the named gap area. */
  onPlanGap?: (category: string) => void;
  /** Tap a "By area" row → plan a step for that capability area. */
  onCategoryPress?: (category: string) => void;
  /** Tap an evidenced site → focus the map on it. */
  onSitePress?: (site: { poiId: string; name: string }) => void;
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

function CategoryBar({ row }: { row: CapabilityCategoryCoverage }) {
  const pct = row.total > 0 ? Math.round((row.evidenced / row.total) * 100) : 0;
  return (
    <View style={styles.catRow}>
      <View style={styles.catLab}>
        <Text style={styles.catName} numberOfLines={1}>
          {row.category}
        </Text>
        <Text style={styles.catCount}>
          {row.evidenced}/{row.total}
        </Text>
      </View>
      <View style={styles.catTrack}>
        <View style={[styles.catFill, { width: `${pct}%`, backgroundColor: pct > 0 ? '#16A34A' : 'transparent' }]} />
      </View>
    </View>
  );
}

export function CapabilitiesSurface({
  interestId,
  interestName,
  toolbarOffset = 0,
  bottomOffset = 0,
  onPlanGap,
  onCategoryPress,
  onSitePress,
}: CapabilitiesSurfaceProps) {
  const { coverage, isLoading } = useInterestCapabilityCoverage(interestId);

  if (isLoading || !coverage) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.muted}>{isLoading ? 'Loading capabilities…' : 'No framework found.'}</Text>
      </View>
    );
  }

  const { frameworkTotal, evidencedTotal, byCategory, sites, gaps, isGeneralFramework } = coverage;
  const remainingTotal = Math.max(frameworkTotal - evidencedTotal, 0);
  const topGap = gaps[0] ?? null;
  const evidencedSites = sites.slice(0, 3);
  const frameworkLabel = isGeneralFramework ? 'general capabilities' : `${interestName} capabilities`;

  const statusText =
    frameworkTotal === 0
      ? 'No framework'
      : remainingTotal === 0
        ? 'Complete'
        : evidencedTotal > 0
          ? 'In progress'
          : 'Start logging';
  const ringTitle =
    remainingTotal === 0
      ? `${interestName} framework covered`
      : `${interestName} framework coverage`;
  const ringSummary =
    remainingTotal === 0
      ? `All ${frameworkTotal} ${frameworkLabel} have evidence from your steps.`
      : evidencedTotal > 0
        ? `${remainingTotal} of ${frameworkTotal} ${frameworkLabel} still need evidence across ${gaps.length} gap ${gaps.length === 1 ? 'area' : 'areas'}.`
        : `Log a step to start building evidence against the ${frameworkTotal} ${frameworkLabel}.`;

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
          <Text style={styles.statusText}>{statusText}</Text>
          <Text style={styles.ringTitle}>{ringTitle}</Text>
          <Text style={styles.ringSummary}>{ringSummary}</Text>
        </View>
      </View>

      {/* Per-category bars */}
      <Text style={styles.eyebrow}>By area</Text>
      <View style={styles.card}>
        {byCategory.map((row, i) => (
          <View key={row.category}>
            {i > 0 ? <View style={styles.sep} /> : null}
            <Pressable
              style={({ pressed }) => [styles.catCell, styles.tapRow, pressed && styles.rowPressed]}
              onPress={() => (onCategoryPress ?? onPlanGap)?.(row.category)}
              accessibilityRole="button"
              accessibilityLabel={`Plan a step for ${row.category}`}
            >
              <View style={styles.catCellBody}>
                <CategoryBar row={row} />
              </View>
              <Ionicons name="chevron-forward" size={15} color={IOS_COLORS.tertiaryLabel} />
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={styles.eyebrow}>Where you&apos;ve evidenced this</Text>
      <View style={styles.card}>
        {evidencedSites.length > 0 ? (
          evidencedSites.map((row, i) => (
            <View key={row.poiId}>
              {i > 0 ? <View style={styles.sep} /> : null}
              <Pressable
                style={({ pressed }) => [styles.evRow, pressed && styles.rowPressed]}
                onPress={() => onSitePress?.({ poiId: row.poiId, name: row.name })}
                accessibilityRole="button"
                accessibilityLabel={`Show ${row.name} on the map`}
              >
                <View style={styles.evPin}>
                  <Ionicons name="location" size={15} color="#16A34A" />
                </View>
                <View style={styles.evBody}>
                  <Text style={styles.evName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={styles.evSub}>
                    {row.steps} step{row.steps === 1 ? '' : 's'} logged
                  </Text>
                </View>
                <Text style={styles.evCount}>×{row.competencies}</Text>
                <Ionicons name="chevron-forward" size={15} color={IOS_COLORS.tertiaryLabel} />
              </Pressable>
            </View>
          ))
        ) : (
          <View style={styles.emptyEvidence}>
            <Text style={styles.emptyEvidenceTitle}>No located evidence yet</Text>
            <Text style={styles.emptyEvidenceBody}>
              Log a step at a place and this list will show where each capability was evidenced.
            </Text>
          </View>
        )}
      </View>

      {/* Gap card — routes the biggest unevidenced area to plan a step */}
      <Pressable
        style={styles.gapCard}
        onPress={() => onPlanGap?.(topGap?.category ?? 'capability coverage')}
        accessibilityRole="button"
        accessibilityLabel={`Plan a step for ${topGap?.category ?? 'capability coverage'}`}
        testID="atlas-capabilities-gap-card"
      >
        <Text style={styles.gapKicker}>{topGap ? '⚠ Biggest gap' : 'Coverage ready'}</Text>
        <Text style={styles.gapTitle}>
          {topGap ? `${topGap.category} needs evidence.` : 'Every area has evidence.'}
        </Text>
        <Text style={styles.gapBody}>
          {topGap
            ? `${topGap.total} capabilit${topGap.total === 1 ? 'y' : 'ies'} in this area still need evidence. Plan a step so you know what to practice.`
            : 'Keep logging located steps so your coverage map stays current.'}
        </Text>
        <View style={styles.gapCta}>
          <Text style={styles.gapCtaText}>{topGap ? `Plan a ${topGap.category} step` : 'Plan a step'}</Text>
          <Ionicons name="arrow-forward" size={13} color="#B45309" />
        </View>
      </Pressable>

      <View style={styles.demoNote}>
        <Ionicons name="lock-closed" size={11} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.demoNoteText}>
          {isGeneralFramework
            ? 'These are general capabilities until you add an interest. Add one and its own framework takes over.'
            : `Coverage is computed from your logged steps against the ${interestName} framework. It grows as you add steps and library work.`}
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
  ringNum: { fontFamily: fontFamily.mono, fontSize: 18, fontWeight: '500', color: IOS_COLORS.label, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  ringLab: { fontSize: 9, color: IOS_COLORS.secondaryLabel, fontWeight: '600' },
  ringText: { flex: 1, gap: 4 },
  statusText: {
    alignSelf: 'flex-start',
    paddingHorizontal: 3,
    backgroundColor: 'rgba(22,163,74,0.12)',
    color: '#15803D',
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  ringTitle: { fontFamily: fontFamily.serif, fontSize: 17, fontWeight: '500', color: IOS_COLORS.label, letterSpacing: -0.3 },
  ringSummary: { fontSize: 12.5, color: IOS_COLORS.secondaryLabel, lineHeight: 18 },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
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
  tapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowPressed: { opacity: 0.55 },
  catCellBody: { flex: 1 },
  catCell: { paddingVertical: 11 },
  catRow: { gap: 6 },
  catLab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  catName: { fontSize: 14, fontWeight: '600', color: IOS_COLORS.label, letterSpacing: -0.2, flex: 1 },
  catCount: { fontFamily: fontFamily.mono, fontSize: 12, color: IOS_COLORS.secondaryLabel },
  catTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(60,60,67,0.10)',
    overflow: 'hidden',
  },
  catFill: { height: '100%', borderRadius: 4 },
  emptyEvidence: { paddingVertical: IOS_SPACING.md, gap: 4 },
  emptyEvidenceTitle: { fontSize: 14, fontWeight: '700', color: IOS_COLORS.label },
  emptyEvidenceBody: { fontSize: 12, color: IOS_COLORS.secondaryLabel, lineHeight: 17 },
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
  evCount: { fontFamily: fontFamily.mono, fontSize: 12, fontWeight: '500', color: IOS_COLORS.secondaryLabel },
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
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
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

export default CapabilitiesSurface;
