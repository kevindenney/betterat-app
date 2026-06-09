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

import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useNearbyOrganizations } from '@/hooks/useNearbyOrganizations';
import { useAtlasPeerSteps } from '@/hooks/useAtlasPeerSteps';
import { useAtlasOrgSteps } from '@/hooks/useAtlasOrgSteps';
import { useVocabulary } from '@/hooks/useVocabulary';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { HomeVenuePickerSheet } from '@/components/discover/HomeVenuePickerSheet';

interface DiscoverNearbyContentProps {
  homeVenueLat: number | null;
  homeVenueLng: number | null;
  homeVenueLabel: string | null;
  toolbarOffset?: number;
  /**
   * Extra bottom padding so the last rows clear floating chrome (the Atlas
   * tab bar + peer-step sheet) that overlaps this full-bleed list. Discover
   * has no overlay, so it defaults to 0.
   */
  bottomInset?: number;
  /**
   * Scopes the nearby peer-step list to a single interest. Without it the
   * sheet returns all-interest activity, which leaks sailing people into
   * the nursing frame (and vice versa). Null = all interests (Discover tab).
   */
  interestSlug?: string | null;
  /**
   * When provided (Atlas embeds this list over a live map), tapping a
   * nearby sailor flies the map to their step's coordinates instead of
   * navigating into the step editor. Absent on the Discover tab, where
   * there's no map to focus — those taps fall back to /step/[id].
   */
  onStepFocus?: (
    lat: number,
    lng: number,
    peer?: {
      stepId: string;
      relationship: string;
      name: string | null;
      setAt: string | null;
    },
  ) => void;
}

export function DiscoverNearbyContent({
  homeVenueLat,
  homeVenueLng,
  homeVenueLabel,
  toolbarOffset = 0,
  bottomInset = 0,
  interestSlug = null,
  onStepFocus,
}: DiscoverNearbyContentProps) {
  const { vocab } = useVocabulary();
  const [pickerOpen, setPickerOpen] = useState(false);
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
    interestSlug,
    enabled: hasVenue,
  });

  // Org-published located events ("what's my org doing nearby") — the
  // attendable-activity lens that makes a bare org-HQ directory worth keeping.
  const { data: orgSteps = [], isLoading: orgStepsLoading } = useAtlasOrgSteps({
    lat: homeVenueLat,
    lng: homeVenueLng,
    radiusKm: 25,
    interestSlug,
    enabled: hasVenue,
  });
  // One row per sailor: a person working several steps nearby returned a
  // row each, so the list showed the same person two or three times. Keep
  // the first (nearest/most-recent per the RPC's order) step per sailor.
  const visiblePeerSteps = (() => {
    const seen = new Set<string>();
    const out: typeof peerSteps = [];
    for (const s of peerSteps) {
      if (s.relationship === 'self') continue;
      if (seen.has(s.set_by)) continue;
      seen.add(s.set_by);
      out.push(s);
    }
    return out;
  })();

  if (!hasVenue) {
    return (
      <>
        <View style={[styles.emptyCard, { marginTop: toolbarOffset + IOS_SPACING.md }]}>
          <Ionicons name="location-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.emptyTitle}>Set a home venue</Text>
          <Text style={styles.emptyCopy}>
            Nearby shows organizations, {vocab('Peers').toLowerCase()}, and
            activity around your home base. Set a home venue to light up this
            segment.
          </Text>
          <Pressable style={styles.setVenueBtn} onPress={() => setPickerOpen(true)}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.setVenueBtnText}>Set home venue</Text>
          </Pressable>
        </View>
        <HomeVenuePickerSheet visible={pickerOpen} onDismiss={() => setPickerOpen(false)} />
      </>
    );
  }

  const isLoading = orgsLoading || peersLoading || orgStepsLoading;
  const hasNothing =
    orgs.length === 0 && visiblePeerSteps.length === 0 && orgSteps.length === 0;

  if (isLoading) {
    return (
      <Text style={[styles.loading, { marginTop: toolbarOffset + IOS_SPACING.md }]}>
        Looking around {homeVenueLabel ?? 'you'}…
      </Text>
    );
  }

  if (hasNothing) {
    return (
      <View style={[styles.emptyCard, { marginTop: toolbarOffset + IOS_SPACING.md }]}>
        <Ionicons name="locate-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>Quiet around {homeVenueLabel ?? 'you'}</Text>
        <Text style={styles.emptyCopy}>
          No organizations or {vocab('Peers').toLowerCase()} registered
          nearby yet. As more join, this segment will fill in.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: toolbarOffset + IOS_SPACING.sm, paddingBottom: IOS_SPACING.lg + bottomInset },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionHeader}>
        Within 25km · {homeVenueLabel ?? 'your area'}
      </Text>

      {orgSteps.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>
            {orgSteps.length === 1
              ? '1 session from your organizations'
              : `${orgSteps.length} sessions from your organizations`}
          </Text>
          <View style={styles.list}>
            {orgSteps.slice(0, 12).map((ev) => {
              const place = ev.place_name?.trim();
              const provenance = ev.blueprint_title?.trim();
              return (
                <Pressable
                  key={ev.step_id}
                  style={styles.row}
                  onPress={() => {
                    // An org event is attendable at an exact spot — on Atlas,
                    // fly the map there; everywhere else, open the step detail.
                    if (
                      onStepFocus &&
                      Number.isFinite(ev.lat) &&
                      Number.isFinite(ev.lng)
                    ) {
                      onStepFocus(ev.lat, ev.lng);
                      return;
                    }
                    router.push(`/step/${ev.step_id}` as never);
                  }}
                >
                  <View style={[styles.iconCircle, styles.iconCircleOrg]}>
                    <Ionicons name="calendar" size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {ev.title?.trim() || 'Organization session'}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[place, provenance].filter(Boolean).join(' · ')}
                    </Text>
                    <View style={styles.orgBadge}>
                      <Ionicons name="business" size={10} color="#1F6FEB" />
                      <Text style={styles.orgBadgeText} numberOfLines={1}>
                        {ev.org_name ?? 'Organization'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {visiblePeerSteps.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>
            {visiblePeerSteps.length === 1
              ? `1 ${vocab('Peer').toLowerCase()} working a step nearby`
              : `${visiblePeerSteps.length} ${vocab('Peers').toLowerCase()} working a step nearby`}
          </Text>
          <View style={styles.list}>
            {visiblePeerSteps.slice(0, 12).map((step) => {
              const sailorName =
                step.set_by_name?.trim() || `A ${vocab('Peer').toLowerCase()} nearby`;
              const place = step.preview_name?.trim();
              const meta = place ? `${place} · ${step.relationship}` : step.relationship;
              return (
                <Pressable
                  key={step.step_id}
                  style={styles.row}
                  onPress={() => {
                    // Over a live map (Atlas), fly to the sailor's step
                    // instead of opening the editor. Elsewhere (Discover),
                    // drill into the step.
                    if (
                      onStepFocus &&
                      Number.isFinite(step.lat) &&
                      Number.isFinite(step.lng)
                    ) {
                      onStepFocus(step.lat, step.lng, {
                        stepId: step.step_id,
                        relationship: step.relationship,
                        name: step.preview_name ?? step.set_by_name ?? null,
                        setAt: step.set_at ?? null,
                      });
                      return;
                    }
                    router.push(`/step/${step.step_id}` as never);
                  }}
                >
                  {step.set_by_avatar ? (
                    <Image source={{ uri: step.set_by_avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.iconCircle, styles.iconCirclePerson]}>
                      <Text style={styles.iconInitial}>
                        {(sailorName[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {sailorName}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {meta}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {orgs.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrowQuiet}>
            Clubs &amp; venues to explore
          </Text>
          <View style={styles.list}>
            {orgs.map((org) => (
              <Pressable
                key={org.id}
                style={styles.rowQuiet}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.lg,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
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
  // Demoted discovery header — the org-HQ list is a thin "new to town, which
  // clubs exist?" affordance, not co-equal with attendable activity above.
  sectionEyebrowQuiet: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
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
  rowQuiet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  // Org-event marker — calendar glyph on an accent fill, distinct from the
  // faint org-HQ business glyph so attendable activity reads as "go to this."
  iconCircleOrg: {
    backgroundColor: '#0A84FF',
  },
  orgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(31, 111, 235, 0.10)',
  },
  orgBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F6FEB',
    letterSpacing: -0.1,
    maxWidth: 180,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.separator,
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
  setVenueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: IOS_SPACING.sm,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#0A84FF',
  },
  setVenueBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  loading: {
    color: IOS_COLORS.secondaryLabel,
    fontSize: 13,
    paddingHorizontal: IOS_SPACING.md,
  },
});

export default DiscoverNearbyContent;
