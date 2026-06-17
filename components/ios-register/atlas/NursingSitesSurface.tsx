/**
 * NursingSitesSurface — the Sites-first home for the nursing Atlas frame (N1).
 *
 * Inverts the sailing hierarchy: instead of leading with a street map, a
 * nursing student lands on a structured list of their clinical sites, with the
 * next rotation as the hero. The MapLibre canvas is demoted to the `Map`
 * segment (owned by the parent FrameF4 — this component only renders the Sites
 * body).
 *
 * Data honesty (hybrid model): everything that reads as the student's own is
 * REAL — the "Your shifts" cards are derived entirely from logged shifts
 * (`useNursingLoggedSites`), and the hero is the real next event or a guided
 * prompt when none exists. The forward-looking richness a rotation schedule
 * would provide (upcoming blocks, cohort-mates rotating with you) is retained
 * only inside an explicitly-labeled EXAMPLE block, visually distinct so it can
 * never be mistaken for the student's data. The example auto-hides once a real
 * rotation-schedule source exists (`HAS_REAL_SCHEDULE`). See
 * `memory/project_nursing_demo_two_data_models.md`.
 */

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useNursingLoggedSites, type LoggedSite } from '@/hooks/useNursingLoggedSites';
import { useNursingCuratedSites, type CuratedSiteRole } from '@/hooks/useNursingCuratedSites';
import type { CoverageCluster } from '@/hooks/useNursingSiteCoverage';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { AtlasNextEvent } from '@/components/ios-register/atlas/AtlasScreen';

// Competency cluster colors — shared with the cohort heatmap legend so a
// cluster reads the same hue everywhere in the frame.
const CLUSTER_COLORS: Record<CoverageCluster, string> = {
  cardiac: '#E5484D',
  resp: '#0E7490',
  med: '#7C3AED',
  general: '#16A34A',
  assess: '#D97706',
};

// No real rotation-schedule source exists yet (no schedule table, no cohort
// co-presence). Until one does, the forward-looking rotation/cohort content is
// shown only as a labeled EXAMPLE. Flip to true (and wire real data) to retire
// the example block.
const HAS_REAL_SCHEDULE = false;

const CLUSTER_ORDER: CoverageCluster[] = ['cardiac', 'resp', 'assess', 'med', 'general'];

/**
 * Composition bar segments: each cluster's share of THIS site's evidenced
 * competencies, so the segments sum to a full bar and show the *mix* of what
 * was practiced — not progress against a fabricated target.
 */
function compositionSegments(
  byCluster: Record<CoverageCluster, number>,
  evidenced: number,
): { cluster: CoverageCluster; fraction: number }[] {
  const denom = evidenced > 0 ? evidenced : 1;
  return CLUSTER_ORDER.filter((c) => byCluster[c] > 0).map((cluster) => ({
    cluster,
    fraction: byCluster[cluster] / denom,
  }));
}

function lastActiveLabel(iso: string | null): string {
  if (!iso) return 'Logged';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'Logged';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 14) return 'Last week';
  if (days < 56) return `${Math.floor(days / 7)}w ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
  const { sites: loggedSites } = useNursingLoggedSites();
  const { partner, sites: curatedSites } = useNursingCuratedSites();

  // The hero is honest only when nextEvent is a real upcoming event. The demo
  // fallback tags itself via source_label ("From: demo cohort schedule") — when
  // that's present (or there's no event at all) we show a guided prompt instead
  // of a fabricated rotation.
  const isDemoNext = !nextEvent?.label || /demo/i.test(nextEvent.source_label ?? '');
  const hasRealNext = !isDemoNext;

  const loggedShiftTotal = loggedSites.reduce((sum, s) => sum + s.shifts, 0);
  const evidenceStatus =
    loggedShiftTotal > 0
      ? `${loggedShiftTotal} logged shift${loggedShiftTotal === 1 ? '' : 's'} across ${loggedSites.length} site${loggedSites.length === 1 ? '' : 's'}`
      : 'No shifts logged yet · log one to start building real evidence';

  // Drop sites already shown as "Your shifts" from the curated partner list so
  // that section reads as "the rest of your network".
  const extraCurated = useMemo(() => {
    if (!partner) return [];
    const shown = new Set(loggedSites.map((s) => s.poiId));
    return curatedSites.filter((s) => !shown.has(s.poiId));
  }, [partner, curatedSites, loggedSites]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: toolbarOffset + IOS_SPACING.sm, paddingBottom: bottomOffset + IOS_SPACING.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — real next rotation, or a guided prompt when none is scheduled. */}
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>▸ {hasRealNext ? 'Next rotation' : 'Plan ahead'}</Text>
        {hasRealNext ? (
          <>
            <Text style={styles.heroTitle}>{nextEvent.label}</Text>
            <Text style={styles.heroWhere}>
              {[nextEvent.where, nextEvent.when ? `starts ${nextEvent.when}` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
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
          </>
        ) : (
          <>
            <Text style={styles.heroTitle}>Your next rotation</Text>
            <Text style={styles.heroWhere}>
              Plan a step for an upcoming clinical day, then log the shift afterward to evidence
              competencies at that site.
            </Text>
            <View style={styles.heroCta}>
              <Pressable style={styles.heroPrimary} onPress={onPlanStep} accessibilityRole="button">
                <Text style={styles.heroPrimaryText}>Plan a step</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <View style={[styles.evidenceBanner, loggedShiftTotal > 0 && styles.evidenceBannerLive]}>
        <Ionicons
          name={loggedShiftTotal > 0 ? 'checkmark-circle' : 'information-circle'}
          size={14}
          color={loggedShiftTotal > 0 ? '#16A34A' : IOS_COLORS.secondaryLabel}
        />
        <Text style={[styles.evidenceBannerText, loggedShiftTotal > 0 && styles.evidenceBannerTextLive]}>
          {evidenceStatus}
        </Text>
      </View>

      {/* Your shifts — REAL, derived entirely from logged shifts. */}
      <Text style={styles.eyebrow}>Your shifts</Text>
      {loggedSites.length > 0 ? (
        loggedSites.map((site) => (
          <LoggedSiteCard
            key={site.poiId}
            site={site}
            onPress={() =>
              onSitePress?.({
                id: site.poiId,
                name: site.name,
                unit: site.unit ?? undefined,
                statusLabel: lastActiveLabel(site.lastShiftAt),
              })
            }
          />
        ))
      ) : (
        <Pressable
          style={styles.emptyCard}
          onPress={onPlanStep}
          accessibilityRole="button"
          accessibilityLabel="Log your first clinical shift"
        >
          <View style={styles.emptyIcon}>
            <Ionicons name="add-circle" size={22} color="#007AFF" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.emptyTitle}>Log your first shift</Text>
            <Text style={styles.emptyBody}>
              After a clinical day, log the site and the competencies you practiced. Each site you
              log appears here with its real coverage.
            </Text>
          </View>
        </Pressable>
      )}

      {/* Coming up — EXAMPLE only. Retained for the forward-looking story but
          unmistakably not the student's data, until a real schedule exists. */}
      {!HAS_REAL_SCHEDULE ? <ExampleRotationBlock partnerName={partner?.name} /> : null}

      {/* Curated partner network (N4) — gated, real. */}
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
          {extraCurated.map((site) => (
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
                style={[styles.partnerBadge, site.role === 'simulation' && styles.partnerBadgeSim]}
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
              <Ionicons name="add-circle-outline" size={18} color={IOS_COLORS.tertiaryLabel} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Honest provenance footer. */}
      <View style={styles.demoNote}>
        <Ionicons name="lock-closed" size={11} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.demoNoteText}>
          Your shifts and coverage are real, derived from what you log. Upcoming rotations and
          cohort presence are an example until your program shares a schedule. Site-level only — no
          patient, room, or unit detail.
        </Text>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Real "Your shifts" card.
// ---------------------------------------------------------------------------

function LoggedSiteCard({ site, onPress }: { site: LoggedSite; onPress: () => void }) {
  const segments = compositionSegments(site.byCluster, site.evidenced);
  return (
    <Pressable
      style={styles.site}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${site.name}${site.unit ? `, ${site.unit}` : ''}`}
      testID={`atlas-nursing-loggedsite-${site.poiId}`}
    >
      <View style={styles.siteHead}>
        <View style={styles.badge}>
          <Ionicons name="medkit" size={18} color="#16A34A" />
        </View>
        <View style={styles.siteBody}>
          <Text style={styles.siteName} numberOfLines={1}>
            {site.name}
          </Text>
          {site.unit ? (
            <Text style={styles.siteUnit} numberOfLines={1}>
              {site.unit}
            </Text>
          ) : null}
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statPillText}>{lastActiveLabel(site.lastShiftAt)}</Text>
        </View>
      </View>

      <View style={styles.cov}>
        <View style={styles.covLab}>
          <Text style={styles.covLabText}>
            <Text style={styles.covLabBold}>{site.evidenced}</Text> competenc
            {site.evidenced === 1 ? 'y' : 'ies'} evidenced
          </Text>
          <Text style={styles.covLabMuted}>
            {site.shifts} shift{site.shifts === 1 ? '' : 's'}
          </Text>
        </View>
        {segments.length > 0 ? (
          <View style={styles.track}>
            {segments.map((seg, i) => (
              <View
                key={`${seg.cluster}-${i}`}
                style={{
                  width: `${Math.round(seg.fraction * 100)}%`,
                  backgroundColor: CLUSTER_COLORS[seg.cluster],
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Example (preview) rotation block — explicitly not the student's data.
// ---------------------------------------------------------------------------

function ExampleRotationBlock({ partnerName }: { partnerName?: string }) {
  return (
    <View style={styles.exampleWrap}>
      <View style={styles.exampleHead}>
        <Text style={styles.eyebrowMuted}>Coming up</Text>
        <View style={styles.exampleBadge}>
          <Text style={styles.exampleBadgeText}>EXAMPLE</Text>
        </View>
      </View>
      <Text style={styles.exampleIntro}>
        Once {partnerName ?? 'your school'} publishes your rotation schedule, your upcoming blocks
        and the cohort-mates rotating with you will appear here. This is a preview.
      </Text>

      <View style={styles.exampleCard}>
        <View style={styles.siteHead}>
          <View style={styles.exampleGlyph}>
            <Text style={styles.badgeGlyph}>🫁</Text>
          </View>
          <View style={styles.siteBody}>
            <Text style={styles.exampleName} numberOfLines={1}>
              JH Bayview · MICU
            </Text>
            <Text style={styles.siteUnit} numberOfLines={1}>
              Critical care · Week 5–8
            </Text>
          </View>
          <View style={styles.examplePill}>
            <Text style={styles.examplePillText}>Mon</Text>
          </View>
        </View>
        <View style={styles.foot}>
          <View style={styles.avatars}>
            {[
              { text: 'LN', color: '#3F6FA8' },
              { text: 'MR', color: '#9A5B9E' },
              { text: 'AK', color: '#2B7A4B' },
            ].map((a, i) => (
              <View
                key={a.text}
                style={[styles.avatar, { backgroundColor: a.color, marginLeft: i === 0 ? 0 : -6 }]}
              >
                <Text style={styles.avatarText}>{a.text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.footText}>4 cohort-mates rotate here · builds vent & line care</Text>
        </View>
      </View>
    </View>
  );
}

export default NursingSitesSurface;

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
  heroWhere: { color: 'rgba(235,235,245,0.7)', fontSize: 13, lineHeight: 18 },
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
  eyebrowMuted: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
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
    backgroundColor: 'rgba(22,163,74,0.10)',
  },
  badgeGlyph: { fontSize: 18 },
  siteBody: { flex: 1, gap: 2 },
  siteName: { fontSize: 15, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.2 },
  siteUnit: { fontSize: 12, color: IOS_COLORS.secondaryLabel },
  statPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(22,163,74,0.10)',
  },
  statPillText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    color: '#16A34A',
  },
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
  emptyCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: IOS_SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    alignItems: 'flex-start',
  },
  emptyIcon: { marginTop: 1 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.2 },
  emptyBody: { fontSize: 12, color: IOS_COLORS.secondaryLabel, lineHeight: 17 },
  // Example block
  exampleWrap: {
    marginTop: IOS_SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.18)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(120,120,128,0.04)',
    padding: IOS_SPACING.md,
    gap: 8,
  },
  exampleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exampleBadge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(120,120,128,0.16)',
  },
  exampleBadgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
  },
  exampleIntro: { fontSize: 12, color: IOS_COLORS.secondaryLabel, lineHeight: 17 },
  exampleCard: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
    opacity: 0.85,
  },
  exampleGlyph: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120,120,128,0.10)',
  },
  exampleName: { fontSize: 15, fontWeight: '700', color: IOS_COLORS.secondaryLabel, letterSpacing: -0.2 },
  examplePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(120,120,128,0.12)',
  },
  examplePillText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
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
  demoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: IOS_SPACING.md,
    paddingHorizontal: 4,
  },
  demoNoteText: { flex: 1, fontSize: 11, color: IOS_COLORS.tertiaryLabel, lineHeight: 15 },
});
