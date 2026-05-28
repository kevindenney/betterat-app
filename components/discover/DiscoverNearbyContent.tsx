/**
 * DiscoverNearbyContent — the Discover tab's "Nearby" segment.
 *
 * Surfaces discoverable content rooted in the user's geography:
 *   - Orgs near you (organization_locations bbox + haversine)
 *   - Sailors near you working a step (atlas_peer_steps_near; reuses
 *     the same RPC as Watch · Nearby + the per-step NEAR chip)
 *
 * Distinct from the rest of Discover (which is global / catalog-based)
 * — this answers "what's around me?" The data sources are the same
 * ones Atlas uses, just rendered as lists instead of map pins.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useNearbyOrganizations } from '@/hooks/useNearbyOrganizations';
import { useAtlasPeerSteps } from '@/hooks/useAtlasPeerSteps';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

interface DiscoverNearbyContentProps {
  homeVenueLat: number | null;
  homeVenueLng: number | null;
  homeVenueLabel: string | null;
}

export function DiscoverNearbyContent({
  homeVenueLat,
  homeVenueLng,
  homeVenueLabel,
}: DiscoverNearbyContentProps) {
  const hasVenue = homeVenueLat != null && homeVenueLng != null;

  const { data: orgs = [], isLoading: orgsLoading } = useNearbyOrganizations({
    lat: homeVenueLat,
    lng: homeVenueLng,
    radiusKm: 25,
    enabled: hasVenue,
  });

  const { data: peerSteps = [], isLoading: peersLoading } = useAtlasPeerSteps({
    lat: homeVenueLat,
    lng: homeVenueLng,
    radiusKm: 25,
    enabled: hasVenue,
  });
  const visiblePeerSteps = peerSteps.filter((s) => s.relationship !== 'self');

  if (!hasVenue) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="location-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>Set a home venue</Text>
        <Text style={styles.emptyCopy}>
          Nearby shows clubs, people, and activity around where you sail
          from. Add a home venue in settings to light up this segment.
        </Text>
      </View>
    );
  }

  const isLoading = orgsLoading && peersLoading;
  const hasNothing = orgs.length === 0 && visiblePeerSteps.length === 0;

  if (isLoading) {
    return <Text style={styles.loading}>Looking around {homeVenueLabel ?? 'you'}…</Text>;
  }

  if (hasNothing) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="locate-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>Quiet around {homeVenueLabel ?? 'you'}</Text>
        <Text style={styles.emptyCopy}>
          No clubs or sailors registered nearby yet. As more sailors and
          clubs join, this segment will fill in.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionHeader}>
        Within 25km · {homeVenueLabel ?? 'your area'}
      </Text>

      {orgs.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>
            {orgs.length === 1 ? '1 club nearby' : `${orgs.length} clubs nearby`}
          </Text>
          <View style={styles.list}>
            {orgs.map((org) => (
              <Pressable
                key={org.id}
                style={styles.row}
                onPress={() =>
                  router.push(`/discover/org/${org.slug ?? org.id}` as never)
                }
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="business" size={16} color="#1F6FEB" />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {org.shortName ?? org.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {[org.locationName, `${org.distanceKm.toFixed(1)} km away`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {visiblePeerSteps.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>
            {visiblePeerSteps.length === 1
              ? '1 sailor working a step nearby'
              : `${visiblePeerSteps.length} sailors working a step nearby`}
          </Text>
          <View style={styles.list}>
            {visiblePeerSteps.slice(0, 12).map((step) => (
              <Pressable
                key={step.step_id}
                style={styles.row}
                onPress={() => router.push(`/step/${step.step_id}` as never)}
              >
                <View style={[styles.iconCircle, styles.iconCirclePerson]}>
                  <Text style={styles.iconInitial}>
                    {(step.preview_name?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {step.preview_name ?? 'A sailor nearby'}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {step.loc_precision ?? 'Nearby'} · {step.relationship}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.lg,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    marginHorizontal: IOS_SPACING.md,
    marginBottom: IOS_SPACING.sm,
  },
  section: {
    marginBottom: IOS_SPACING.lg,
  },
  sectionEyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.1,
    marginHorizontal: IOS_SPACING.md,
    marginBottom: IOS_SPACING.sm,
  },
  list: {
    paddingHorizontal: IOS_SPACING.md,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31, 111, 235, 0.12)',
  },
  iconCirclePerson: {
    backgroundColor: '#22A06B',
  },
  iconInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
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
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
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

export default DiscoverNearbyContent;
