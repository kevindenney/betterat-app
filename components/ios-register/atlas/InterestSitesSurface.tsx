/**
 * InterestSitesSurface — the Sites-first home for the generic Atlas frame (F1),
 * the non-nursing analogue of NursingSitesSurface.
 *
 * Inverts the map-first sailing hierarchy: instead of landing on the chart, the
 * user lands on a structured list of the interest's sites — the places where
 * their located steps live, with the rest of the interest's nearby POIs below.
 * Each site row shows how many of the viewer's steps are anchored there. The
 * MapLibre canvas is demoted to the `Map` segment (owned by the parent frame).
 *
 * Everything here is REAL: site rows come from the frame's own pins, step counts
 * from the viewer's located steps. No demo/example blocks — generic interests
 * have no rotation-schedule fiction to stand in for.
 */

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';
import { isSitePoiPin } from '@/components/ios-register/atlas/atlasStepSitePins';
import type { PickerStep } from '@/hooks/useUserAtlasSteps';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

interface SiteRow {
  poiId: string;
  name: string;
  lat: number;
  lng: number;
  stepCount: number;
}

export interface InterestSitesSurfaceProps {
  interestName: string;
  framePins: AtlasPinSpec[];
  steps: PickerStep[];
  toolbarOffset?: number;
  bottomOffset?: number;
  onSitePress?: (site: { id: string; name: string; lat: number; lng: number }) => void;
  onPlanStep?: () => void;
}

function siteInitials(label: string): string {
  const words = label.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '··';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function InterestSitesSurface({
  interestName,
  framePins,
  steps,
  toolbarOffset = 0,
  bottomOffset = 0,
  onSitePress,
  onPlanStep,
}: InterestSitesSurfaceProps) {
  const { yourSites, moreSites, nextStep } = useMemo(() => {
    // Steps anchored at each site, keyed by poi_id (exact site identity).
    const stepsByPoi = new Map<string, number>();
    for (const s of steps) {
      if (s.poi_id) stepsByPoi.set(s.poi_id, (stepsByPoi.get(s.poi_id) ?? 0) + 1);
    }

    const rows: SiteRow[] = [];
    const seen = new Set<string>();
    for (const p of framePins) {
      if (!isSitePoiPin(p)) continue;
      const poiId = p.id.slice('poi:'.length);
      if (seen.has(poiId)) continue;
      seen.add(poiId);
      rows.push({
        poiId,
        name: p.label ?? 'Site',
        lat: p.lat,
        lng: p.lng,
        stepCount: stepsByPoi.get(poiId) ?? 0,
      });
    }

    const your = rows
      .filter((r) => r.stepCount > 0)
      .sort((a, b) => b.stepCount - a.stepCount || a.name.localeCompare(b.name));
    const more = rows
      .filter((r) => r.stepCount === 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    // The hero is the next planned located step, else the earliest planned one.
    const next =
      steps.find((s) => s.status === 'planned-next') ??
      steps.find((s) => s.status === 'planned-week' && s.lat != null) ??
      steps.find((s) => s.lat != null) ??
      null;

    return { yourSites: your, moreSites: more, nextStep: next };
  }, [framePins, steps]);

  const yourStepTotal = yourSites.reduce((sum, s) => sum + s.stepCount, 0);
  const statusLine =
    yourStepTotal > 0
      ? `${yourStepTotal} step${yourStepTotal === 1 ? '' : 's'} across ${yourSites.length} site${yourSites.length === 1 ? '' : 's'}`
      : 'No located steps yet · plan one to start mapping your work';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: toolbarOffset + IOS_SPACING.sm, paddingBottom: bottomOffset + IOS_SPACING.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — next located step, or a guided prompt when none exists. */}
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>▸ {nextStep ? 'Up next' : 'Plan ahead'}</Text>
        {nextStep ? (
          <>
            <Text style={styles.heroTitle}>{nextStep.title}</Text>
            <Text style={styles.heroWhere}>
              {nextStep.location_name || 'Anchored to a site'}
            </Text>
          </>
        ) : (
          <Text style={styles.heroWhere}>
            Plan a step at a place — a course, a market, a venue — and it appears here, anchored to
            its site.
          </Text>
        )}
        <View style={styles.heroCta}>
          <Pressable style={styles.heroPrimary} onPress={onPlanStep} accessibilityRole="button">
            <Text style={styles.heroPrimaryText}>Plan a step</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.banner, yourStepTotal > 0 && styles.bannerLive]}>
        <Ionicons
          name={yourStepTotal > 0 ? 'checkmark-circle' : 'information-circle'}
          size={14}
          color={yourStepTotal > 0 ? '#16A34A' : IOS_COLORS.secondaryLabel}
        />
        <Text style={[styles.bannerText, yourStepTotal > 0 && styles.bannerTextLive]}>{statusLine}</Text>
      </View>

      {/* Your sites — REAL, derived from located steps. */}
      <Text style={styles.eyebrow}>Your sites</Text>
      {yourSites.length > 0 ? (
        yourSites.map((site) => (
          <SiteCard
            key={site.poiId}
            site={site}
            onPress={() => onSitePress?.({ id: site.poiId, name: site.name, lat: site.lat, lng: site.lng })}
          />
        ))
      ) : (
        <Pressable
          style={styles.emptyCard}
          onPress={onPlanStep}
          accessibilityRole="button"
          accessibilityLabel="Plan your first located step"
        >
          <View style={styles.emptyIcon}>
            <Ionicons name="add-circle" size={22} color="#007AFF" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.emptyTitle}>Plan your first located step</Text>
            <Text style={styles.emptyBody}>
              Anchor a step to a place and it shows up here with its real activity.
            </Text>
          </View>
        </Pressable>
      )}

      {/* More interest sites nearby — real POIs with no steps yet. */}
      {moreSites.length > 0 ? (
        <>
          <Text style={styles.eyebrow}>More {interestName.toLowerCase()} sites nearby</Text>
          <View style={styles.card}>
            {moreSites.map((site, i) => (
              <View key={site.poiId}>
                {i > 0 ? <View style={styles.sep} /> : null}
                <Pressable
                  style={styles.moreRow}
                  accessibilityRole="button"
                  accessibilityLabel={site.name}
                  onPress={() => onSitePress?.({ id: site.poiId, name: site.name, lat: site.lat, lng: site.lng })}
                >
                  <View style={styles.moreBadge}>
                    <Text style={styles.moreBadgeText}>{siteInitials(site.name)}</Text>
                  </View>
                  <Text style={styles.moreName} numberOfLines={1}>
                    {site.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.demoNote}>
        <Ionicons name="location" size={11} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.demoNoteText}>
          Your sites and step counts are real, derived from what you plan and log.
        </Text>
      </View>
    </ScrollView>
  );
}

function SiteCard({ site, onPress }: { site: SiteRow; onPress: () => void }) {
  return (
    <Pressable
      style={styles.site}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={site.name}
      testID={`atlas-interest-site-${site.poiId}`}
    >
      <View style={styles.badge}>
        <Ionicons name="location" size={18} color="#16A34A" />
      </View>
      <View style={styles.siteBody}>
        <Text style={styles.siteName} numberOfLines={1}>
          {site.name}
        </Text>
        <Text style={styles.siteSub}>
          {site.stepCount} of your step{site.stepCount === 1 ? '' : 's'} here
        </Text>
      </View>
      <View style={styles.statPill}>
        <Text style={styles.statPillText}>{site.stepCount}</Text>
      </View>
    </Pressable>
  );
}

export default InterestSitesSurface;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: IOS_SPACING.md, gap: IOS_SPACING.sm },
  hero: { backgroundColor: '#0B1220', borderRadius: 18, padding: IOS_SPACING.lg, gap: 6 },
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
  heroPrimary: { backgroundColor: '#007AFF', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10 },
  heroPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  banner: {
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
  bannerLive: { backgroundColor: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.22)' },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '700', color: IOS_COLORS.secondaryLabel },
  bannerTextLive: { color: '#166534' },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: IOS_SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,163,74,0.10)',
  },
  siteBody: { flex: 1, gap: 2 },
  siteName: { fontSize: 15, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.2 },
  siteSub: { fontSize: 12, color: IOS_COLORS.secondaryLabel },
  statPill: {
    minWidth: 30,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(22,163,74,0.10)',
    alignItems: 'center',
  },
  statPillText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: '500',
    color: '#16A34A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: IOS_SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: IOS_COLORS.separator },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  moreBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  moreBadgeText: { fontSize: 11, fontWeight: '700', color: IOS_COLORS.secondaryLabel },
  moreName: { flex: 1, fontSize: 14, fontWeight: '600', color: IOS_COLORS.label, letterSpacing: -0.2 },
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
  demoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: IOS_SPACING.md,
    paddingHorizontal: 4,
  },
  demoNoteText: { flex: 1, fontSize: 11, color: IOS_COLORS.tertiaryLabel, lineHeight: 15 },
});
