/**
 * LibraryNearbyContent — the Library tab's "Nearby" segment.
 *
 * Surfaces curriculum content rooted in the user's geography:
 *   - Blueprints from clubs near you (organizations within 25km that
 *     have published blueprints — composes useNearbyOrganizations
 *     with a blueprints lookup).
 *
 * Distinct from the rest of Library (which is the viewer's own saved
 * content) and from Discover (which is the global catalog) — this is
 * "what's your local network shipping?" Future sections will add
 * concepts and library items shared by nearby users.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useNearbyBlueprints } from '@/hooks/useNearbyBlueprints';
import { useVocabulary } from '@/hooks/useVocabulary';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

interface LibraryNearbyContentProps {
  homeVenueLat: number | null;
  homeVenueLng: number | null;
  homeVenueLabel: string | null;
}

export function LibraryNearbyContent({
  homeVenueLat,
  homeVenueLng,
  homeVenueLabel,
}: LibraryNearbyContentProps) {
  const { vocab } = useVocabulary();
  const hasVenue = homeVenueLat != null && homeVenueLng != null;

  const { data: blueprints = [], isLoading } = useNearbyBlueprints({
    lat: homeVenueLat,
    lng: homeVenueLng,
    radiusKm: 25,
    enabled: hasVenue,
  });

  if (!hasVenue) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="location-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>Set a home venue</Text>
        <Text style={styles.emptyCopy}>
          Nearby surfaces what your local organizations publish and what
          nearby {vocab('Peers')} save. Add a home venue in settings to
          light up this segment.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return <Text style={styles.loading}>Looking around {homeVenueLabel ?? 'you'}…</Text>;
  }

  if (blueprints.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="bookmark-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>
          Nothing published near {homeVenueLabel ?? 'you'} yet
        </Text>
        <Text style={styles.emptyCopy}>
          As organizations around you publish blueprints, they’ll appear
          here so you can subscribe and pull them into your own plan.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionHeader}>
        Within 25km · {homeVenueLabel ?? 'your area'}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>
          {blueprints.length === 1
            ? '1 blueprint from nearby organizations'
            : `${blueprints.length} blueprints from nearby organizations`}
        </Text>
        <View style={styles.list}>
          {blueprints.map((bp) => (
            <Pressable
              key={bp.id}
              style={styles.row}
              onPress={() =>
                bp.slug
                  ? router.push(`/blueprint/${bp.slug}` as never)
                  : router.push(`/blueprint/id/${bp.id}` as never)
              }
            >
              <View style={styles.iconCircle}>
                <Ionicons name="bookmark" size={16} color="#1F6FEB" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {bp.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {bp.organizationName}
                  {Number.isFinite(bp.organizationDistanceKm)
                    ? ` · ${bp.organizationDistanceKm.toFixed(1)} km away`
                    : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
            </Pressable>
          ))}
        </View>
      </View>
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

export default LibraryNearbyContent;
