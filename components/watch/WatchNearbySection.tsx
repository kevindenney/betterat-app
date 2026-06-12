/**
 * WatchNearbySection — the Watch tab's "Nearby" segment.
 *
 * Rendered when the user selects the `Nearby` grouping chip. Queries
 * atlas_peer_steps_near for peer step pins within 25km of the user's
 * location focus, filters out the viewer's own pins, and lists what other
 * sailors are doing in the same place. Distinct from the Following
 * feed (which is graph-based) — this is proximity-based.
 *
 * Empty states:
 *   - No location set → prompt to set one.
 *   - Location set but no nearby peers → encouraging copy.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useAtlasPeerSteps,
  type AtlasPeerStep,
  type AtlasPeerRelationship,
  type AtlasPeerAudience,
} from '@/hooks/useAtlasPeerSteps';
import { WatchFilterRow, type WatchFilterChip } from '@/components/watch/WatchFilterRow';
import { LocationFocusSuggestionPill } from '@/components/discover/LocationFocusSuggestionPill';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { getVisibilityLabels } from '@/lib/vocabulary';

// Source filter for the Nearby feed. People = individual relationships
// (graph follows + your crew); Groups = fleets and cohorts. Orgs is a
// future addition pending an atlas_peer_steps_near migration that returns
// the org behind each step.
type NearbySource = 'all' | 'people' | 'groups';
const PEOPLE_RELS = new Set<AtlasPeerRelationship>(['following', 'crew']);
const GROUP_RELS = new Set<AtlasPeerRelationship>(['fleet', 'cohort']);

interface WatchNearbySectionProps {
  homeVenueLat: number | null;
  homeVenueLng: number | null;
  homeVenueLabel: string | null;
  /** Active interest slug — scopes the feed so a Golf user doesn't see
   *  sailing pins. Null = no interest filter (all visible peers). */
  interestSlug: string | null;
}

// Badge styling for the poster-chosen share scope (location_audience).
// This is the privacy state the poster picked, NOT the viewer relationship —
// relationship stays a filtering lens (People/Groups chips), never a badge.
// crew/fleet display labels resolve per-interest via getVisibilityLabels.
const AUDIENCE_META: Record<
  AtlasPeerAudience,
  { label: string; color: string; background: string }
> = {
  private: { label: 'Private', color: IOS_COLORS.secondaryLabel, background: '#EFEFF3' },
  crew: { label: 'Crew', color: '#0A6A56', background: '#DDF8F0' },
  cohort: { label: 'Cohort', color: '#3155B5', background: '#E5EDFF' },
  program: { label: 'Program', color: '#3155B5', background: '#E5EDFF' },
  following: { label: 'Followers', color: '#5B2C83', background: '#F0E6FF' },
  fleet: { label: 'Fleet', color: '#8A4B08', background: '#FFF4D6' },
  public: { label: 'Public', color: IOS_COLORS.secondaryLabel, background: '#EFEFF3' },
};

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const minutes = Math.floor((Date.now() - t) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function WatchNearbySection({
  homeVenueLat,
  homeVenueLng,
  homeVenueLabel,
  interestSlug,
}: WatchNearbySectionProps) {
  const hasVenue = homeVenueLat != null && homeVenueLng != null;
  const [source, setSource] = useState<NearbySource>('all');

  const { data: peerSteps = [], isLoading } = useAtlasPeerSteps({
    lat: homeVenueLat,
    lng: homeVenueLng,
    radiusKm: 25,
    interestSlug,
    enabled: hasVenue,
  });

  const visibleSteps = useMemo(
    () =>
      peerSteps
        .filter((s) => s.relationship !== 'self')
        .sort((a, b) => b.set_at.localeCompare(a.set_at)),
    [peerSteps],
  );

  // Only offer a source chip when that source actually has nearby rows —
  // matches the "drop empty pills" rule from the redesign.
  const sourceChips = useMemo<WatchFilterChip[]>(() => {
    const chips: WatchFilterChip[] = [{ id: 'all', label: 'All' }];
    if (visibleSteps.some((s) => PEOPLE_RELS.has(s.relationship))) {
      chips.push({ id: 'people', label: 'People' });
    }
    if (visibleSteps.some((s) => GROUP_RELS.has(s.relationship))) {
      chips.push({ id: 'groups', label: 'Groups' });
    }
    return chips;
  }, [visibleSteps]);

  const shownSteps = useMemo(() => {
    if (source === 'people') return visibleSteps.filter((s) => PEOPLE_RELS.has(s.relationship));
    if (source === 'groups') return visibleSteps.filter((s) => GROUP_RELS.has(s.relationship));
    return visibleSteps;
  }, [visibleSteps, source]);

  if (!hasVenue) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="location-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>Set your location</Text>
        <Text style={styles.emptyCopy}>
          Nearby surfaces people working steps around your current location.
          Set yours to light up this feed.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return <Text style={styles.loading}>Loading…</Text>;
  }

  if (visibleSteps.length === 0) {
    return (
      <View>
        <LocationFocusSuggestionPill focusLat={homeVenueLat} focusLng={homeVenueLng} />
        <View style={styles.emptyCard}>
          <Ionicons name="locate-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.emptyTitle}>Quiet around {homeVenueLabel ?? 'you'}</Text>
          <Text style={styles.emptyCopy}>
            Nobody nearby is working a step right now. Check back soon.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <LocationFocusSuggestionPill focusLat={homeVenueLat} focusLng={homeVenueLng} />
      {sourceChips.length > 1 ? (
        <WatchFilterRow
          categories={sourceChips}
          selectedId={source}
          onSelect={(id) => setSource(id as NearbySource)}
        />
      ) : null}
      <Text style={styles.sectionEyebrow}>
        Within 25km · {homeVenueLabel ?? 'your area'}
      </Text>
      {shownSteps.length > 0 ? (
        <View style={styles.feed}>
          {shownSteps.map((step) => (
            <NearbyStepCard key={step.step_id} step={step} interestSlug={interestSlug} />
          ))}
        </View>
      ) : (
        <Text style={styles.loading}>No nearby activity from this source.</Text>
      )}
    </View>
  );
}

function NearbyStepCard({
  step,
  interestSlug,
}: {
  step: AtlasPeerStep;
  interestSlug: string | null;
}) {
  // Badge = the share scope the poster chose, not the viewer relationship.
  // Fallback covers stale cached rows fetched before `audience` existed.
  const audienceMeta = AUDIENCE_META[step.audience] ?? AUDIENCE_META.private;
  const visLabels = getVisibilityLabels(interestSlug);
  const audienceLabel =
    step.audience === 'crew'
      ? visLabels.crew
      : step.audience === 'fleet'
        ? visLabels.fleet
        : audienceMeta.label;
  const handlePress = () => {
    router.push(`/step/${step.step_id}?readOnly=true&origin=watch` as never);
  };
  const previewName = step.preview_name ?? 'Someone nearby';
  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <View style={styles.cardHeader}>
        <View style={styles.personMark}>
          <Text style={styles.personInitial}>
            {(previewName[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.personName} numberOfLines={1}>
            {previewName}
          </Text>
          <Text style={styles.personMeta} numberOfLines={1}>
            {step.loc_precision ?? 'Nearby'} · {formatRelativeTime(step.set_at)}
          </Text>
        </View>
        <View style={[styles.relPill, { backgroundColor: audienceMeta.background }]}>
          <Text style={[styles.relText, { color: audienceMeta.color }]}>{audienceLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: IOS_SPACING.lg,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    marginHorizontal: IOS_SPACING.md,
    marginBottom: IOS_SPACING.sm,
  },
  feed: {
    paddingHorizontal: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: IOS_SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F6FEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitial: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardHeaderText: {
    flex: 1,
  },
  personName: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  personMeta: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  relPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  relText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: IOS_SPACING.lg,
    paddingHorizontal: IOS_SPACING.lg,
    marginHorizontal: IOS_SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptyCopy: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 18,
  },
  loading: {
    color: IOS_COLORS.secondaryLabel,
    fontSize: 13,
    paddingHorizontal: IOS_SPACING.md,
  },
});

export default WatchNearbySection;
