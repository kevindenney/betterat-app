/**
 * WatchNearbySection — the Watch tab's "Nearby" segment.
 *
 * Rendered when the user selects the `Nearby` grouping chip. Queries
 * atlas_peer_steps_near for peer step pins within 25km of the user's
 * home venue, filters out the viewer's own pins, and lists what other
 * sailors are doing in the same place. Distinct from the Following
 * feed (which is graph-based) — this is proximity-based.
 *
 * Empty states:
 *   - No home venue → prompt to set one in settings.
 *   - Have home venue but no nearby peers → encouraging copy.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useAtlasPeerSteps,
  type AtlasPeerStep,
  type AtlasPeerRelationship,
} from '@/hooks/useAtlasPeerSteps';
import { WatchFilterRow, type WatchFilterChip } from '@/components/watch/WatchFilterRow';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

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

const RELATIONSHIP_META: Record<
  AtlasPeerRelationship,
  { label: string; color: string; background: string }
> = {
  self: { label: 'You', color: '#3155B5', background: '#E5EDFF' },
  crew: { label: 'Crew', color: '#0A6A56', background: '#DDF8F0' },
  cohort: { label: 'Cohort', color: '#3155B5', background: '#E5EDFF' },
  fleet: { label: 'Fleet', color: '#8A4B08', background: '#FFF4D6' },
  following: { label: 'Following', color: '#5B2C83', background: '#F0E6FF' },
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
        <Text style={styles.emptyTitle}>Set a home venue</Text>
        <Text style={styles.emptyCopy}>
          Nearby surfaces people working steps around your home base. Add
          one in settings to light up this feed.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return <Text style={styles.loading}>Loading…</Text>;
  }

  if (visibleSteps.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="locate-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>Quiet around {homeVenueLabel ?? 'you'}</Text>
        <Text style={styles.emptyCopy}>
          Nobody nearby is working a step right now. Check back soon.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
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
            <NearbyStepCard key={step.step_id} step={step} />
          ))}
        </View>
      ) : (
        <Text style={styles.loading}>No nearby activity from this source.</Text>
      )}
    </View>
  );
}

function NearbyStepCard({ step }: { step: AtlasPeerStep }) {
  const rel = RELATIONSHIP_META[step.relationship];
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
        <View style={[styles.relPill, { backgroundColor: rel.background }]}>
          <Text style={[styles.relText, { color: rel.color }]}>{rel.label}</Text>
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
