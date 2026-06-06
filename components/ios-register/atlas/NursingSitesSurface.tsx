/**
 * NursingSitesSurface — the Sites-first home for the nursing Atlas frame (N1).
 *
 * Inverts the sailing hierarchy: instead of leading with a street map, a
 * nursing student lands on a structured list of their clinical sites grouped
 * by rotation status (This block / Coming up / Completed), with the next
 * rotation as the hero. The MapLibre canvas is demoted to the `Map` segment
 * (owned by the parent FrameF4 — this component only renders the Sites body).
 *
 * Data honesty: site identity (name + coords) is REAL, sourced from
 * `useAtlasPois` (the JHSON clinical-site cluster). Per-site competency
 * coverage, cohort presence, and rotation grouping are demo-shaped today and
 * carry an explicit `demo` provenance line — exactly like the frame's NEXT
 * pill — because attempts aren't yet located (no attempt→site link) and the
 * demo persona has no logged shifts. The real numbers light up once N2's
 * Log-a-shift loop starts locating competencies. See
 * `memory/project_nursing_atlas_data_layer_verified.md`.
 */

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAtlasPois, type AtlasPoi } from '@/hooks/useAtlasPois';
import { useNursingSiteCoverage, type CoverageCluster } from '@/hooks/useNursingSiteCoverage';
import { useNursingCuratedSites, type CuratedSiteRole } from '@/hooks/useNursingCuratedSites';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { AtlasNextEvent } from '@/components/ios-register/atlas/AtlasScreen';

// Competency cluster colors — shared with the mockup (#23) and the cohort
// heatmap legend so a cluster reads the same hue everywhere in the frame.
const CLUSTER_COLORS = {
  cardiac: '#E5484D',
  resp: '#0E7490',
  med: '#7C3AED',
  general: '#16A34A',
  assess: '#D97706',
} as const;
type ClusterKey = keyof typeof CLUSTER_COLORS;

type RotationStatus = 'now' | 'soon' | 'done';

interface CoverageSegment {
  cluster: ClusterKey;
  /** 0–1 fraction of the bar width. */
  fraction: number;
}

// Turn the coverage hook's per-cluster distinct-competency counts into bar
// segments. Each segment's fraction is its share of the unit's framework total,
// so the filled width equals evidenced/total and the colors split by cluster.
const CLUSTER_ORDER: CoverageCluster[] = ['cardiac', 'resp', 'assess', 'med', 'general'];
function buildSegments(
  byCluster: Record<CoverageCluster, number>,
  total: number,
): CoverageSegment[] {
  const denom = total > 0 ? total : 1;
  return CLUSTER_ORDER.filter((c) => byCluster[c] > 0).map((cluster) => ({
    cluster,
    fraction: byCluster[cluster] / denom,
  }));
}

interface NursingSiteCard {
  /** Stable key — the real POI id when matched, else the canonical slug. */
  id: string;
  /** Canonical POI name match (substring) used to bind to a real atlas_poi. */
  match: string;
  /** Display name (real POI name wins; falls back to this). */
  name: string;
  unit: string;
  status: RotationStatus;
  /** Badge glyph (emoji) per the mockup. */
  glyph: string;
  /** Short status pill text, e.g. "Now", "Mon", "9 / 10". */
  statusLabel: string;
  lat?: number;
  lng?: number;
  /** Coverage line — present only for the active ("now") site in the demo. */
  coverage?: {
    evidenced: number;
    total: number;
    weekLabel: string;
    segments: CoverageSegment[];
  };
  /** Cohort-presence footer. */
  footer?: { initials: { text: string; color: string }[]; text: string };
}

interface SiteGroup {
  eyebrow: string;
  cards: NursingSiteCard[];
}

// Demo-shaped rotation surface. Names/units mirror mockup #23; real coords +
// canonical names are overlaid from useAtlasPois by `match`. Labeled demo
// until rotation + located-shift data seeds (N2/N4).
const DEMO_GROUPS: SiteGroup[] = [
  {
    eyebrow: 'This block',
    cards: [
      {
        id: 'jhh',
        match: 'Johns Hopkins Hospital',
        name: 'Johns Hopkins Hospital',
        unit: '4 South · Cardiac telemetry',
        status: 'now',
        glyph: '🫀',
        statusLabel: 'Now',
        coverage: {
          evidenced: 7,
          total: 12,
          weekLabel: 'week 3 of 4',
          segments: [
            { cluster: 'cardiac', fraction: 0.24 },
            { cluster: 'assess', fraction: 0.16 },
            { cluster: 'med', fraction: 0.14 },
            { cluster: 'general', fraction: 0.05 },
          ],
        },
        footer: {
          initials: [
            { text: 'LN', color: '#3F6FA8' },
            { text: 'MR', color: '#9A5B9E' },
            { text: 'AK', color: '#2B7A4B' },
          ],
          text: '5 cohort-mates here this block',
        },
      },
    ],
  },
  {
    eyebrow: 'Coming up',
    cards: [
      {
        id: 'bayview',
        match: 'Bayview',
        name: 'JH Bayview',
        unit: 'MICU · Critical care',
        status: 'soon',
        glyph: '🫁',
        statusLabel: 'Mon',
        footer: {
          initials: [],
          text: 'Week 5–8 · 4 cohort-mates · builds vent & central-line care',
        },
      },
    ],
  },
  {
    eyebrow: 'Completed',
    cards: [
      {
        id: 'sibley',
        match: 'Sibley',
        name: 'Sibley Memorial',
        unit: 'Med-Surg · 3 East',
        status: 'done',
        glyph: '✓',
        statusLabel: '9 / 10',
      },
    ],
  },
];

const ROLE_LABEL: Record<CuratedSiteRole, string> = {
  placement: 'Clinical placement',
  simulation: 'Simulation suite',
};

// Two-letter badge initials from a site label (e.g. "Pinkard Sim Suite" → "PK").
function siteInitials(label: string): string {
  const words = label.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '··';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const STATUS_BG: Record<RotationStatus, string> = {
  now: 'rgba(0,122,255,0.10)',
  soon: 'rgba(217,119,6,0.12)',
  done: 'rgba(22,163,74,0.10)',
};
const STATUS_FG: Record<RotationStatus, string> = {
  now: '#007AFF',
  soon: '#D97706',
  done: '#16A34A',
};

export interface NursingSitesSurfaceProps {
  nextEvent: AtlasNextEvent;
  toolbarOffset?: number;
  bottomOffset?: number;
  onSitePress?: (site: {
    id: string;
    name: string;
    lat?: number;
    lng?: number;
    unit?: string;
    statusLabel?: string;
  }) => void;
  /** Open the log-shift sheet for a site. Preferred over onSitePress when set. */
  onLogShift?: (site: {
    id: string;
    name: string;
    lat?: number;
    lng?: number;
    unit?: string;
    specialty?: string;
  }) => void;
  onPlanStep?: () => void;
  onPrepPress?: () => void;
}

export function NursingSitesSurface({
  nextEvent,
  toolbarOffset = 0,
  bottomOffset = 0,
  onSitePress,
  onLogShift,
  onPlanStep,
  onPrepPress,
}: NursingSitesSurfaceProps) {
  const { pois } = useAtlasPois();
  const { coverage } = useNursingSiteCoverage();
  const { partner, sites: curatedSites } = useNursingCuratedSites();

  // Bind each demo card to a real POI by name substring so the cards carry
  // real coordinates (for the map handoff) and the canonical site name.
  const groups = useMemo<SiteGroup[]>(() => {
    const healthcare = pois.filter((p) => p.is_healthcare_site && p.kind === 'hospital');
    const findPoi = (match: string): AtlasPoi | undefined =>
      healthcare.find((p) => p.name.toLowerCase().includes(match.toLowerCase()));
    return DEMO_GROUPS.map((g) => ({
      ...g,
      cards: g.cards.map((c) => {
        const poi = findPoi(c.match);
        return {
          ...c,
          id: poi?.id ?? c.id,
          name: poi?.name ?? c.name,
          lat: poi?.lat ?? c.lat,
          lng: poi?.lng ?? c.lng,
        };
      }),
    }));
  }, [pois]);

  // Curated partner network (N4) — the authoritative site list, gated on a
  // nursing-institution partnership. Drop sites already surfaced as rotation
  // cards above so the section reads as "the rest of your network" (notably the
  // simulation suites the rotation grouping never shows).
  const extraCurated = useMemo(() => {
    if (!partner) return [];
    const shown = new Set(groups.flatMap((g) => g.cards.map((c) => c.id)));
    return curatedSites.filter((s) => !shown.has(s.poiId));
  }, [partner, curatedSites, groups]);

  const heroTitle = nextEvent.label === 'Clinical' ? 'MICU · Bayview' : nextEvent.label;
  const heroWhere =
    nextEvent.label === 'Clinical'
      ? 'Johns Hopkins Bayview Medical Center'
      : (nextEvent.where ?? 'Your next rotation');
  const liveCoverageSites = Object.keys(coverage).length;
  const liveLoggedShifts = Object.values(coverage).reduce((sum, site) => sum + site.shifts, 0);
  const evidenceStatus =
    liveLoggedShifts > 0
      ? `${liveLoggedShifts} logged shift${liveLoggedShifts === 1 ? '' : 's'} across ${liveCoverageSites} site${liveCoverageSites === 1 ? '' : 's'}`
      : 'Demo rotation shape · log a shift to make coverage live';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: toolbarOffset + IOS_SPACING.sm, paddingBottom: bottomOffset + IOS_SPACING.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — NEXT rotation */}
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>▸ Next rotation</Text>
        <Text style={styles.heroTitle}>{heroTitle}</Text>
        <Text style={styles.heroWhere}>
          {[heroWhere, nextEvent.when ? `starts ${nextEvent.when}` : null].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.heroMeta}>
          <Text style={styles.heroMetaItem}>👥 4 cohort-mates rotate here</Text>
          <Text style={styles.heroMetaItem}>🎯 builds 5 competencies</Text>
        </View>
        <View style={styles.heroCta}>
          <Pressable style={styles.heroPrimary} onPress={onPlanStep} accessibilityRole="button">
            <Text style={styles.heroPrimaryText}>Plan a step</Text>
          </Pressable>
          <Pressable style={styles.heroSecondary} onPress={onPrepPress} accessibilityRole="button">
            <Text style={styles.heroSecondaryText}>What to prep</Text>
          </Pressable>
        </View>
        {nextEvent.source_label ? (
          <Text style={styles.provenance}>{nextEvent.source_label}</Text>
        ) : null}
      </View>

      <View style={[styles.evidenceBanner, liveLoggedShifts > 0 && styles.evidenceBannerLive]}>
        <Ionicons
          name={liveLoggedShifts > 0 ? 'checkmark-circle' : 'information-circle'}
          size={14}
          color={liveLoggedShifts > 0 ? '#16A34A' : IOS_COLORS.secondaryLabel}
        />
        <Text style={[styles.evidenceBannerText, liveLoggedShifts > 0 && styles.evidenceBannerTextLive]}>
          {evidenceStatus}
        </Text>
      </View>

      {groups.map((group) => (
        <View key={group.eyebrow}>
          <Text style={styles.eyebrow}>{group.eyebrow}</Text>
          {group.cards.map((card) => {
            // Real located coverage (from logged shifts) wins over the demo
            // shape when this site POI has evidenced attempts. The bar total is
            // the unit's framework target — keep the demo total when present,
            // else a sensible default so a single logged shift reads as progress.
            const real = coverage[card.id];
            const total = card.coverage?.total ?? 12;
            const display = real
              ? (card.coverage ?? {
                  evidenced: real.evidenced,
                  total,
                  weekLabel: `${real.shifts} shift${real.shifts === 1 ? '' : 's'} logged`,
                  segments: buildSegments(real.byCluster, total),
                })
              : card.coverage ?? null;
            const press = () =>
              onSitePress?.({
                id: card.id,
                name: card.name,
                lat: card.lat,
                lng: card.lng,
                unit: card.unit,
                statusLabel: card.statusLabel,
              });
            return (
            <Pressable
              key={card.id}
              style={styles.site}
              onPress={press}
              accessibilityRole="button"
              accessibilityLabel={`${card.name}, ${card.unit}`}
              testID={`atlas-nursing-site-${card.match.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              <View style={styles.siteHead}>
                <View style={[styles.badge, { backgroundColor: STATUS_BG[card.status] }]}>
                  <Text style={styles.badgeGlyph}>{card.glyph}</Text>
                </View>
                <View style={styles.siteBody}>
                  <Text style={styles.siteName} numberOfLines={1}>
                    {card.name}
                  </Text>
                  <Text style={styles.siteUnit} numberOfLines={1}>
                    {card.unit}
                  </Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: STATUS_BG[card.status] }]}>
                  <Text style={[styles.statPillText, { color: STATUS_FG[card.status] }]}>
                    {card.statusLabel}
                  </Text>
                </View>
              </View>

              {display ? (
                <View style={styles.cov}>
                  <View style={styles.covLab}>
                    <Text style={styles.covLabText}>
                      <Text style={styles.covLabBold}>{display.evidenced}</Text> of{' '}
                      {display.total} competencies evidenced
                    </Text>
                    <Text style={styles.covLabMuted}>{display.weekLabel}</Text>
                  </View>
                  <View style={styles.track}>
                    {display.segments.map((seg, i) => (
                      <View
                        key={`${seg.cluster}-${i}`}
                        style={{
                          width: `${Math.round(seg.fraction * 100)}%`,
                          backgroundColor: CLUSTER_COLORS[seg.cluster],
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {card.footer ? (
                <View style={styles.foot}>
                  {card.footer.initials.length > 0 ? (
                    <View style={styles.avatars}>
                      {card.footer.initials.map((a, i) => (
                        <View
                          key={`${a.text}-${i}`}
                          style={[styles.avatar, { backgroundColor: a.color, marginLeft: i === 0 ? 0 : -6 }]}
                        >
                          <Text style={styles.avatarText}>{a.text}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.footText}>{card.footer.text}</Text>
                </View>
              ) : null}
            </Pressable>
            );
          })}
        </View>
      ))}

      {/* Curated partner network (N4) — gated, real. The official sites the
          partner institution publishes, including simulation suites the
          rotation grouping never surfaces. */}
      {partner && extraCurated.length > 0 ? (
        <View style={styles.partnerSection}>
          <View style={styles.partnerHead}>
            <View style={styles.partnerGlyph}>
              <Ionicons name="shield-checkmark" size={13} color="#0E7490" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerTitle}>Partner network</Text>
              <Text style={styles.partnerSub} numberOfLines={1}>
                {curatedSites.length} curated sites · {partner.name}
              </Text>
            </View>
          </View>
          {extraCurated.map((site) => {
            const real = coverage[site.poiId];
            return (
              <Pressable
                key={site.poiId}
                style={styles.partnerRow}
                accessibilityRole="button"
                accessibilityLabel={`${site.label}, ${ROLE_LABEL[site.role]}`}
                onPress={() =>
                  onLogShift?.({
                    id: site.poiId,
                    name: site.name,
                    lat: site.lat ?? undefined,
                    lng: site.lng ?? undefined,
                  })
                }
              >
                <View
                  style={[
                    styles.partnerBadge,
                    site.role === 'simulation' && styles.partnerBadgeSim,
                  ]}
                >
                  <Text style={styles.partnerBadgeText}>{siteInitials(site.label)}</Text>
                </View>
                <View style={styles.partnerBody}>
                  <Text style={styles.partnerName} numberOfLines={1}>
                    {site.label}
                  </Text>
                  <Text style={styles.partnerRole} numberOfLines={1}>
                    {ROLE_LABEL[site.role]}
                  </Text>
                </View>
                {real ? (
                  <Text style={styles.partnerCov}>{real.evidenced} evidenced</Text>
                ) : (
                  <Ionicons name="add-circle-outline" size={18} color={IOS_COLORS.tertiaryLabel} />
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Honest provenance for the coverage + cohort numbers. */}
      <View style={styles.demoNote}>
        <Ionicons name="lock-closed" size={11} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.demoNoteText}>
          Sites are live; coverage fills in from the shifts you log — cohort presence stays
          demo until your cohort logs too. Site-level only — no patient, room, or unit detail.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: IOS_SPACING.md, gap: IOS_SPACING.sm },
  hero: {
    backgroundColor: '#0B1220',
    borderRadius: 18,
    padding: IOS_SPACING.lg,
    gap: 6,
  },
  heroKicker: {
    color: '#7FB2FF',
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  heroTitle: { color: '#FFFFFF', fontFamily: fontFamily.serif, fontSize: 23, fontWeight: '500', letterSpacing: -0.3 },
  heroWhere: { color: 'rgba(235,235,245,0.7)', fontSize: 13 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  heroMetaItem: { color: 'rgba(235,235,245,0.85)', fontSize: 12 },
  heroCta: { flexDirection: 'row', gap: 8, marginTop: IOS_SPACING.sm },
  heroPrimary: {
    backgroundColor: '#007AFF',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  heroPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  heroSecondary: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  heroSecondaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  provenance: {
    color: 'rgba(235,235,245,0.5)',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  evidenceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  evidenceBannerLive: {
    backgroundColor: 'rgba(22,163,74,0.08)',
    borderColor: 'rgba(22,163,74,0.22)',
  },
  evidenceBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
  },
  evidenceBannerTextLive: {
    color: '#166534',
  },
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
  site: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  siteHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 18 },
  siteBody: { flex: 1, gap: 2 },
  siteName: { fontSize: 15, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.2 },
  siteUnit: { fontSize: 12, color: IOS_COLORS.secondaryLabel },
  statPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  statPillText: { fontFamily: fontFamily.mono, fontSize: 12, fontWeight: '500', textTransform: 'uppercase' },
  cov: { gap: 6 },
  covLab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  covLabText: { fontSize: 12, color: IOS_COLORS.label },
  covLabBold: { fontWeight: '700' },
  covLabMuted: { fontFamily: fontFamily.mono, fontSize: 11, color: IOS_COLORS.secondaryLabel },
  track: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(60,60,67,0.10)',
    overflow: 'hidden',
  },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  footText: { flex: 1, fontSize: 12, color: IOS_COLORS.secondaryLabel },
  partnerSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: IOS_SPACING.md,
    marginTop: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  partnerHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partnerGlyph: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,116,144,0.10)',
  },
  partnerTitle: { fontSize: 14, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.2 },
  partnerSub: { fontSize: 11, color: IOS_COLORS.secondaryLabel },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partnerBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3F6FA8',
  },
  partnerBadgeSim: { backgroundColor: '#7C3AED' },
  partnerBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  partnerBody: { flex: 1, gap: 1 },
  partnerName: { fontSize: 14, fontWeight: '600', color: IOS_COLORS.label, letterSpacing: -0.2 },
  partnerRole: { fontSize: 11, color: IOS_COLORS.secondaryLabel },
  partnerCov: { fontFamily: fontFamily.mono, fontSize: 12, fontWeight: '500', color: '#16A34A' },
  demoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: IOS_SPACING.md,
    paddingHorizontal: 4,
  },
  demoNoteText: { flex: 1, fontSize: 11, color: IOS_COLORS.tertiaryLabel, lineHeight: 15 },
});

export default NursingSitesSurface;
