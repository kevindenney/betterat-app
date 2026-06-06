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
import { useUserUpcomingEvents } from '@/hooks/useUserUpcomingEvents';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { NursingSiteDetailTarget } from './NursingSiteDetailSurface';

export interface NursingCoverageSurfaceProps {
  toolbarOffset?: number;
  bottomOffset?: number;
  /** Route to plan a step at the site that can close the gap. */
  onPlanGap?: (site: NursingSiteDetailTarget, suggestedTitle: string) => void;
}

const FALLBACK_GAP_SITE: NursingSiteDetailTarget = {
  id: 'howard-county-general',
  name: 'Howard County General Hospital',
  unit: 'Clinical placement',
  statusLabel: 'Week 9',
  lat: 39.2137,
  lng: -76.8868,
};

const RING_SIZE = 88;
const RING_STROKE = 9;

function gapStepTitle(gap: CategoryCoverage | null): string {
  if (!gap) return 'Review nursing competency coverage';
  return gap.category;
}

function gapHeadline(gap: CategoryCoverage | null): string {
  if (!gap) return 'Every framework area has evidence.';
  return `${gap.category} needs evidence.`;
}

function gapBody(gap: CategoryCoverage | null, site: NursingSiteDetailTarget): string {
  if (!gap) {
    return 'Keep logging site-level shifts so your coverage map stays current.';
  }
  const count = `${gap.total} competenc${gap.total === 1 ? 'y' : 'ies'}`;
  return `${count} in this framework area still need evidence. Plan a step at ${site.name} so you know what to practice when you arrive.`;
}

function upcomingSiteFromEvent(raw: {
  id: string;
  label: string;
  subtitle?: string;
  lat?: number;
  lng?: number;
}): NursingSiteDetailTarget | null {
  if (raw.lat == null || raw.lng == null) return null;
  const firstSubtitle = raw.subtitle?.split(' · ')[0]?.trim();
  return {
    id: `upcoming-${raw.id}`,
    name: firstSubtitle || raw.label,
    unit: raw.label,
    statusLabel: 'Upcoming',
    lat: raw.lat,
    lng: raw.lng,
  };
}

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

export function NursingCoverageSurface({
  toolbarOffset = 0,
  bottomOffset = 0,
  onPlanGap,
}: NursingCoverageSurfaceProps) {
  const { coverage, isLoading } = useNursingCompetencyCoverage();
  const { data: upcomingEvents = [] } = useUserUpcomingEvents();

  if (isLoading || !coverage) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.muted}>{isLoading ? 'Loading coverage…' : 'No framework found.'}</Text>
      </View>
    );
  }

  const evidencedTotal = coverage.evidencedTotal;
  const frameworkTotal = coverage.frameworkTotal;
  const remainingTotal = Math.max(frameworkTotal - evidencedTotal, 0);
  const gapCount = coverage.gaps.length;
  const topGap = coverage.gaps[0] ?? null;
  const evidencedSites = coverage.sites.slice(0, 3);
  const upcomingGapSite =
    upcomingEvents
      .filter((event) => ['clinical_shift', 'sim_session', 'assessment'].includes(event.kind))
      .map(upcomingSiteFromEvent)
      .find((site): site is NursingSiteDetailTarget => Boolean(site)) ?? null;
  const gapSite = upcomingGapSite ?? FALLBACK_GAP_SITE;
  const suggestedGapTitle = gapStepTitle(topGap);
  const statusText =
    frameworkTotal === 0
      ? 'No framework'
      : remainingTotal === 0
        ? 'Complete'
        : evidencedTotal > 0
          ? 'In progress'
          : 'Start logging';
  const ringTitle = remainingTotal === 0 ? 'JHSON framework covered' : 'JHSON framework coverage';
  const ringSummary =
    remainingTotal === 0
      ? `All ${frameworkTotal} framework competencies have evidence from logged shifts.`
      : evidencedTotal > 0
        ? `${remainingTotal} of ${frameworkTotal} framework competencies still need evidence across ${gapCount} gap ${gapCount === 1 ? 'area' : 'areas'}.`
        : `Log a shift to start evidence against the ${frameworkTotal}-competency JHSON framework.`;

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

      <Text style={styles.eyebrow}>Where you&apos;ve evidenced this</Text>
      <View style={styles.card}>
        {evidencedSites.length > 0 ? (
          evidencedSites.map((row, i) => (
            <View key={row.poiId}>
              {i > 0 ? <View style={styles.sep} /> : null}
              <View style={styles.evRow}>
                <View style={styles.evPin}>
                  <Ionicons name="medkit" size={15} color="#16A34A" />
                </View>
                <View style={styles.evBody}>
                  <Text style={styles.evName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={styles.evSub}>
                    {row.shifts} logged shift{row.shifts === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={styles.evCount}>×{row.competencies}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyEvidence}>
            <Text style={styles.emptyEvidenceTitle}>No logged-shift evidence yet</Text>
            <Text style={styles.emptyEvidenceBody}>
              Log a site-level shift and this list will show where each competency was evidenced.
            </Text>
          </View>
        )}
      </View>

      {/* Gap card — routes the biggest unevidenced area to plan a step */}
      <Pressable
        style={styles.gapCard}
        onPress={() => onPlanGap?.(gapSite, suggestedGapTitle)}
        accessibilityRole="button"
        accessibilityLabel={`Plan a step for ${topGap?.category ?? 'nursing competency coverage'}`}
        accessibilityHint={`Opens a planned nursing step at ${gapSite.name}`}
        testID="atlas-nursing-coverage-gap-card"
      >
        <Text style={styles.gapKicker}>{topGap ? '⚠ Biggest gap' : 'Coverage ready'}</Text>
        <Text style={styles.gapTitle}>{gapHeadline(topGap)}</Text>
        <Text style={styles.gapBody}>{gapBody(topGap, gapSite)}</Text>
        <View style={styles.gapCta}>
          <Text style={styles.gapCtaText}>Plan at {gapSite.name}</Text>
          <Ionicons name="arrow-forward" size={13} color="#B45309" />
        </View>
      </Pressable>

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

export default NursingCoverageSurface;
