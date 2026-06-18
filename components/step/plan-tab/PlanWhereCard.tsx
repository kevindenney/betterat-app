/**
 * <PlanWhereCard> — canonical §11 "Where will you do this?" card. Sibling
 * component to PlanWithCard and follows the same self-contained pattern:
 * owns the LocationMapPicker modal state, receives the current location +
 * an onChange callback, and surfaces a single "Pick on map …" affordance
 * when nothing is set yet.
 *
 * Once a location is set, we surface the venue name bold with the
 * coordinates as a subtitle, plus a small change/clear affordance. The
 * social-proof tagline ("see what other {peers} did here", vocab-aware) sits
 * under the pick button as a hint — wiring the live count belongs to a follow-up
 * once step_location has enough rows to be meaningful.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import type { StepLocation, StepLocationPrecision } from '@/types/step-detail';
import { LocationMapPicker as LocationMapPickerModal } from '@/components/races/LocationMapPicker';
import { useStepLocationNeighbors } from '@/hooks/useStepLocationNeighbors';
import {
  useNearestNamedPlace,
  isCoordOnlyLabel,
} from '@/hooks/useNearestNamedPlace';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { AtlasPickerBus, type AtlasPickerResult } from '@/services/AtlasPickerBus';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useAtlasPois } from '@/hooks/useAtlasPois';
import { useNursingCuratedSites } from '@/hooks/useNursingCuratedSites';
import {
  useUserSavedPlaces,
  findSavedPlaceAt,
  type SavedPlaceKind,
} from '@/hooks/useUserSavedPlaces';
import {
  subSiteConfigForInterest,
  readSubSiteAnchor,
  withSubSiteAnchor,
  numericSubSiteAnchor,
  type SubSiteAnchor,
} from '@/lib/atlas/subSiteAnchor';

/** Quick-pick chip (e.g. an org's known venues like "RHKYC Clubhouse"). */
export interface PlanWhereQuickPick {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
}

interface ClinicalSitePick {
  id: string;
  name: string;
  detail: string;
  lat?: number;
  lng?: number;
  source: 'curated' | 'poi' | 'quick-pick';
}

/**
 * Precision levels surfaced in the picker. 'At site' only renders when the
 * location carries a poi_id (otherwise the feed RPC would silently fall back
 * to exact). Default is 'exact' — we never coarsen a location the user
 * already set without asking, since legitimate venue pins (a marina, a
 * course mark) want exact coords.
 */
const PRECISION_OPTIONS: {
  value: StepLocationPrecision;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'exact', label: 'Exact', hint: 'Your precise spot', icon: 'locate' },
  {
    value: 'site',
    label: 'At site',
    hint: 'Shown at the named place',
    icon: 'business-outline',
  },
  {
    value: 'neighborhood',
    label: 'Approximate',
    hint: 'Fuzzed ~500m',
    icon: 'shapes-outline',
  },
  { value: 'hidden', label: 'Hidden', hint: 'Off the map', icon: 'eye-off-outline' },
];

/** 'site' can't survive a move to a place with no POI — fall back to exact. */
function carryPrecision(prev?: StepLocationPrecision): StepLocationPrecision | undefined {
  return prev === 'site' ? undefined : prev;
}

interface PlanWhereCardProps {
  location?: StepLocation;
  readOnly?: boolean;
  onChange: (next: StepLocation | undefined) => void;
  /** Optional pre-seeded venues (e.g. user's club's racing areas). */
  quickPicks?: PlanWhereQuickPick[];
  interestSlug?: string;
  interestName?: string;
  stepCategory?: string;
}

export function PlanWhereCard({
  location,
  readOnly,
  onChange,
  quickPicks,
  interestSlug,
  interestName,
  stepCategory,
}: PlanWhereCardProps) {
  const router = useRouter();
  const { vocab } = useVocabulary();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [clinicalSitePickerVisible, setClinicalSitePickerVisible] = useState(false);
  const isNursing =
    interestSlug?.toLowerCase().includes('nurs') ||
    interestName?.toLowerCase().includes('nurs') ||
    stepCategory === 'clinical';
  const { pois } = useAtlasPois();
  const { partner, sites: curatedSites } = useNursingCuratedSites();
  const { places: savedPlaces, savePlace, removePlace } = useUserSavedPlaces();
  // A place saved without an interest (or matching this one) is offered here.
  const relevantSavedPlaces = useMemo(
    () =>
      savedPlaces.filter(
        (p) => !p.interest_slug || !interestSlug || p.interest_slug === interestSlug,
      ),
    [savedPlaces, interestSlug],
  );
  const savedHere = findSavedPlaceAt(
    relevantSavedPlaces,
    location?.lat,
    location?.lng,
  );
  const { data: neighbors } = useStepLocationNeighbors(location?.lat, location?.lng, 5);
  // Subtract the current user's own pin if applicable — we want "OTHER peers".
  const otherSailors = Math.max(0, (neighbors?.sailors ?? 0) - 1);
  const peersPlural = vocab('Peers');
  const peersSingular = peersPlural.replace(/s$/, '');
  // Resolve raw "Dropped pin (lat, lng)" stamps to a nearby venue name
  // when one's in range. Skips the query when the stored name is already
  // a real venue (most cases). Tight 0.5 km radius — we want "this IS
  // the venue", not "this is near the venue".
  const needsResolve = isCoordOnlyLabel(location?.name);
  const resolved = useNearestNamedPlace({
    lat: needsResolve ? location?.lat : null,
    lng: needsResolve ? location?.lng : null,
    // 1km radius — wide enough to catch "I dropped a pin near Hebe
    // Haven from the parking lot" but tight enough that we don't claim
    // a venue when the pin is actually out on the racecourse.
    maxKm: 1.0,
  });
  const displayName =
    needsResolve && resolved
      ? resolved.short_name ?? resolved.name
      : location?.name;

  const handlePicked = useCallback(
    (picked: { name: string; lat: number; lng: number }) => {
      onChange({
        name: picked.name,
        lat: picked.lat,
        lng: picked.lng,
        venue_id: location?.venue_id,
        poi_id: undefined,
        location_precision: carryPrecision(location?.location_precision),
      });
      setPickerVisible(false);
    },
    [onChange, location?.venue_id, location?.location_precision],
  );

  const clinicalSites = useMemo<ClinicalSitePick[]>(() => {
    if (!isNursing) return [];
    const byId = new Map<string, ClinicalSitePick>();
    for (const site of curatedSites) {
      byId.set(site.poiId, {
        id: site.poiId,
        name: site.label,
        detail:
          site.role === 'simulation'
            ? 'Simulation suite'
            : partner?.name
              ? `${partner.name} clinical placement`
              : 'Clinical placement',
        lat: site.lat ?? undefined,
        lng: site.lng ?? undefined,
        source: 'curated',
      });
    }
    if (byId.size === 0) {
      for (const poi of pois) {
        if (!poi.is_healthcare_site) continue;
        byId.set(poi.id, {
          id: poi.id,
          name: poi.name,
          detail:
            poi.kind === 'sim_lab'
              ? 'Simulation suite'
              : poi.org_name
                ? `${poi.org_name} site`
                : 'Clinical site',
          lat: poi.lat,
          lng: poi.lng,
          source: 'poi',
        });
      }
    }
    for (const pick of quickPicks ?? []) {
      if (byId.has(pick.id)) continue;
      byId.set(pick.id, {
        id: pick.id,
        name: pick.name,
        detail: 'Saved site',
        lat: pick.lat,
        lng: pick.lng,
        source: 'quick-pick',
      });
    }
    const sourceRank: Record<ClinicalSitePick['source'], number> = {
      curated: 0,
      poi: 1,
      'quick-pick': 2,
    };
    return Array.from(byId.values()).sort((a, b) => {
      if (a.source !== b.source) return sourceRank[a.source] - sourceRank[b.source];
      return a.name.localeCompare(b.name);
    });
  }, [curatedSites, isNursing, partner?.name, pois, quickPicks]);

  const handleClinicalSitePick = useCallback(
    (site: ClinicalSitePick) => {
      // Quick-picks aren't atlas_pois rows, so they can't snap — only
      // curated/poi sources get a poi_id and the 'site' default.
      const isPoi = site.source !== 'quick-pick';
      onChange({
        name: site.name,
        lat: site.lat,
        lng: site.lng,
        venue_id: site.id,
        poi_id: isPoi ? site.id : undefined,
        location_precision: isPoi ? 'site' : undefined,
      });
      setClinicalSitePickerVisible(false);
    },
    [onChange],
  );

  /**
   * Per brief A9, the legacy LocationMapPicker modal is absorbed into
   * Atlas. When ATLAS_MAPLIBRE_CANVAS is on, "Pick on map" pushes to
   * /(tabs)/atlas?fromPlan=1, subscribes to AtlasPickerBus for the result,
   * and applies it via onChange. When the flag is off, the legacy modal
   * still opens (so this lands as additive — old path stays as fallback).
   */
  const handleOpenPicker = useCallback(() => {
    if (isNursing) {
      setClinicalSitePickerVisible(true);
      return;
    }
    if (!FEATURE_FLAGS.ATLAS_MAPLIBRE_CANVAS) {
      setPickerVisible(true);
      return;
    }
    AtlasPickerBus.awaitResult((result: AtlasPickerResult) => {
      onChange({
        name: result.place ?? `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`,
        lat: result.lat,
        lng: result.lng,
        venue_id: location?.venue_id,
        poi_id: undefined,
        location_precision: carryPrecision(location?.location_precision),
      });
    });
    router.push({
      // Root-level alias: pushing the tab route would POP the step screen
      // (killing the bus subscription above), so the pick was never applied.
      pathname: '/atlas-picker',
      params: { fromPlan: '1' },
    });
  }, [router, onChange, location?.venue_id, location?.location_precision, isNursing]);

  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const handleSavePlace = useCallback(
    (kind: SavedPlaceKind) => {
      if (location?.lat == null || location?.lng == null) return;
      const label =
        kind === 'home'
          ? 'Home'
          : kind === 'club'
            ? 'Club'
            : !isCoordOnlyLabel(location.name) && location.name?.trim()
              ? location.name.trim()
              : 'Saved spot';
      savePlace({
        label,
        kind,
        lat: location.lat,
        lng: location.lng,
        placeName: location.name ?? null,
        interestSlug: interestSlug ?? null,
      });
    },
    [savePlace, location, interestSlug],
  );

  // Saved places lead the quick-pick row; passed-in picks that duplicate a
  // saved place (same name) are dropped.
  const mergedQuickPicks = useMemo(() => {
    const savedNames = new Set(relevantSavedPlaces.map((p) => p.label.toLowerCase()));
    const saved = relevantSavedPlaces.map((p) => ({
      id: `saved:${p.id}`,
      name: p.label,
      lat: p.lat,
      lng: p.lng,
      icon: (p.kind === 'home'
        ? 'home'
        : p.kind === 'club'
          ? 'business'
          : 'bookmark') as keyof typeof Ionicons.glyphMap,
    }));
    const rest = (quickPicks ?? [])
      .filter((qp) => !savedNames.has(qp.name.toLowerCase()))
      .map((qp) => ({
        ...qp,
        icon: 'location' as keyof typeof Ionicons.glyphMap,
      }));
    return [...saved, ...rest];
  }, [relevantSavedPlaces, quickPicks]);

  const handlePrecision = useCallback(
    (next: StepLocationPrecision) => {
      if (!location) return;
      onChange({ ...location, location_precision: next });
    },
    [onChange, location],
  );

  // Sub-site ("place within a place"): for interests whose sites have a
  // meaningful internal unit (a golf hole, a market stall), let the user
  // refine the chosen place down to that unit. Nursing keeps its richer
  // clinical-site flow, so subSiteConfigForInterest returns null for it.
  const subSiteConfig = useMemo(
    () => subSiteConfigForInterest(interestSlug),
    [interestSlug],
  );
  const subSiteAnchor = readSubSiteAnchor(location);
  const handleSetSubSite = useCallback(
    (anchor: SubSiteAnchor | null) => {
      if (!location) return;
      onChange(withSubSiteAnchor(location, anchor));
    },
    [onChange, location],
  );

  const hasName = Boolean(location?.name?.trim());
  const hasCoords = location?.lat != null && location?.lng != null;

  // Tap-to-explore: tapping the venue name OR the "X sailors set steps"
  // subtitle pushes the user to Atlas focused on this lat/lng so they can
  // scout the venue + see peer activity in context. Falls back to a no-op
  // when no coords are stored.
  const handleOpenOnAtlas = useCallback(() => {
    if (!hasCoords) return;
    router.push({
      pathname: '/(tabs)/atlas',
      params: { lat: String(location!.lat), lng: String(location!.lng) },
    });
  }, [router, hasCoords, location]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="location-outline" size={12} color={STEP_COLORS.secondaryLabel} />
        <Text style={styles.eyebrow}>
          {isNursing ? 'Where is this clinical step?' : 'Where will you do this?'}
        </Text>
      </View>

      {hasName ? (
        <View style={styles.venueRow}>
          <Ionicons name="sparkles" size={14} color={STEP_COLORS.accent} />
          <View style={styles.venueText}>
            <Pressable onPress={handleOpenOnAtlas} disabled={!hasCoords} hitSlop={6}>
              <Text
                style={[styles.venueName, hasCoords && styles.venueNameLink]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
            </Pressable>
            {hasCoords && otherSailors > 0 ? (
              <Pressable onPress={handleOpenOnAtlas} hitSlop={6}>
                <Text style={[styles.venueSub, styles.venueSubLink]} numberOfLines={1}>
                  {isNursing
                    ? 'Open Atlas to compare site coverage →'
                    : `${otherSailors} ${otherSailors === 1 ? peersSingular : peersPlural} set steps within 5 km →`}
                </Text>
              </Pressable>
            ) : hasCoords ? (
              <Text style={styles.venueSub} numberOfLines={1}>
                {location!.lat!.toFixed(4)}, {location!.lng!.toFixed(4)}
              </Text>
            ) : null}
          </View>
          {!readOnly && (
            <Pressable onPress={handleClear} hitSlop={6}>
              <Ionicons name="close-circle" size={18} color={IOS_COLORS.systemGray3} />
            </Pressable>
          )}
        </View>
      ) : null}

      {hasName && hasCoords && !readOnly ? (
        <View style={styles.precisionBlock}>
          <Text style={styles.precisionEyebrow}>Who sees the exact spot?</Text>
          <View style={styles.precisionRow}>
            {PRECISION_OPTIONS.filter(
              (opt) =>
                opt.value !== 'site' ||
                Boolean(location?.poi_id) ||
                location?.location_precision === 'site',
            ).map((opt) => {
              const active = (location?.location_precision ?? 'exact') === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.precisionChip, active && styles.precisionChipActive]}
                  onPress={() => handlePrecision(opt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.label} — ${opt.hint}`}
                >
                  <Ionicons
                    name={opt.icon}
                    size={13}
                    color={active ? STEP_COLORS.accent : IOS_COLORS.secondaryLabel}
                  />
                  <Text
                    style={[
                      styles.precisionLabel,
                      active && styles.precisionLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {hasName && subSiteConfig && !readOnly ? (
        <View style={styles.subSiteBlock}>
          <Text style={styles.subSiteEyebrow}>{subSiteConfig.prompt}</Text>
          {subSiteConfig.mode === 'numeric' ? (
            <View style={styles.subSiteGrid}>
              <Pressable
                style={[
                  styles.subSiteChip,
                  !subSiteAnchor && styles.subSiteChipActive,
                ]}
                onPress={() => handleSetSubSite(null)}
                accessibilityRole="button"
                accessibilityState={{ selected: !subSiteAnchor }}
              >
                <Text
                  style={[
                    styles.subSiteChipText,
                    !subSiteAnchor && styles.subSiteChipTextActive,
                  ]}
                >
                  {subSiteConfig.wholeSiteLabel}
                </Text>
              </Pressable>
              {Array.from({ length: subSiteConfig.count ?? 0 }, (_, i) => i + 1).map(
                (n) => {
                  const active = subSiteAnchor?.index === n;
                  return (
                    <Pressable
                      key={n}
                      style={[styles.subSiteChip, active && styles.subSiteChipActive]}
                      onPress={() =>
                        handleSetSubSite(
                          active ? null : numericSubSiteAnchor(subSiteConfig, n),
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${subSiteConfig.unit} ${n}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.subSiteChipText,
                          active && styles.subSiteChipTextActive,
                        ]}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          ) : (
            <TextInput
              style={styles.subSiteInput}
              value={subSiteAnchor?.label ?? ''}
              onChangeText={(text) =>
                handleSetSubSite(text.trim() ? { label: text } : null)
              }
              placeholder={`${subSiteConfig.unit} name or number`}
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              returnKeyType="done"
            />
          )}
        </View>
      ) : null}

      {!readOnly && mergedQuickPicks.length > 0 && (
        <View style={styles.quickPickRow}>
          {mergedQuickPicks.map((qp) => {
            const isActive = location?.name === qp.name;
            return (
              <Pressable
                key={qp.id}
                style={[styles.quickPickChip, isActive && styles.quickPickChipActive]}
                onPress={() =>
                  onChange({
                    name: qp.name,
                    lat: qp.lat,
                    lng: qp.lng,
                    venue_id: location?.venue_id,
                    poi_id: undefined,
                    location_precision: carryPrecision(location?.location_precision),
                  })
                }
              >
                <Ionicons
                  name={qp.icon}
                  size={12}
                  color={isActive ? STEP_COLORS.accent : IOS_COLORS.secondaryLabel}
                />
                <Text
                  style={[
                    styles.quickPickText,
                    isActive && styles.quickPickTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {qp.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {hasName && hasCoords && !readOnly ? (
        savedHere ? (
          <Pressable
            style={styles.saveRow}
            onPress={() => removePlace(savedHere.id)}
            accessibilityRole="button"
            accessibilityLabel={`Remove saved place ${savedHere.label}`}
          >
            <Ionicons name="bookmark" size={13} color={STEP_COLORS.accent} />
            <Text style={styles.savedText}>
              Saved as {savedHere.label} · tap to remove
            </Text>
          </Pressable>
        ) : (
          <View style={styles.saveRow}>
            <Ionicons
              name="bookmark-outline"
              size={13}
              color={IOS_COLORS.secondaryLabel}
            />
            <Text style={styles.saveLabel}>Save as</Text>
            {(
              [
                { kind: 'home' as SavedPlaceKind, label: 'Home', icon: 'home-outline' },
                { kind: 'club' as SavedPlaceKind, label: 'Club', icon: 'business-outline' },
                { kind: 'custom' as SavedPlaceKind, label: 'Spot', icon: 'bookmark-outline' },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.kind}
                style={styles.saveChip}
                onPress={() => handleSavePlace(opt.kind)}
                accessibilityRole="button"
                accessibilityLabel={`Save this place as ${opt.label}`}
              >
                <Ionicons
                  name={opt.icon}
                  size={12}
                  color={IOS_COLORS.secondaryLabel}
                />
                <Text style={styles.saveChipText}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {!readOnly && (
        <Pressable style={styles.pickBtn} onPress={handleOpenPicker}>
          <Ionicons name="map-outline" size={16} color={STEP_COLORS.accent} />
          <Text style={styles.pickText}>
            {hasName
              ? (isNursing ? 'Change clinical site' : 'Change location')
              : (isNursing ? 'Pick clinical site' : 'Pick on map')}
          </Text>
          {!hasName ? (
            <Text style={styles.pickHint}>
              {isNursing ? ' · choose from your clinical sites' : ` · see what other ${peersPlural} did here`}
            </Text>
          ) : null}
        </Pressable>
      )}

      <Modal
        visible={clinicalSitePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClinicalSitePickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setClinicalSitePickerVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close clinical site picker"
          />
          <View style={styles.siteSheet}>
            <View style={styles.sheetHandleRow}>
              <View style={styles.sheetHandle} />
              <Pressable
                style={styles.sheetClose}
                onPress={() => setClinicalSitePickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={IOS_COLORS.secondaryLabel} />
              </Pressable>
            </View>
            <Text style={styles.sheetTitle}>Pick clinical site</Text>
            <Text style={styles.sheetSubtitle}>
              Choose the ward, hospital, or sim site where this step will happen.
            </Text>
            <ScrollView
              style={styles.siteList}
              contentContainerStyle={styles.siteListContent}
              showsVerticalScrollIndicator={false}
            >
              {clinicalSites.length > 0 ? (
                clinicalSites.map((site) => {
                  const selected = location?.venue_id === site.id || location?.name === site.name;
                  return (
                    <Pressable
                      key={site.id}
                      style={[styles.siteRow, selected && styles.siteRowActive]}
                      onPress={() => handleClinicalSitePick(site)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View style={[styles.siteIcon, selected && styles.siteIconActive]}>
                        <Ionicons
                          name={site.detail.includes('Simulation') ? 'flask-outline' : 'medical-outline'}
                          size={18}
                          color={selected ? '#FFFFFF' : STEP_COLORS.accent}
                        />
                      </View>
                      <View style={styles.siteText}>
                        <Text style={styles.siteName} numberOfLines={1}>
                          {site.name}
                        </Text>
                        <Text style={styles.siteSub} numberOfLines={1}>
                          {site.detail}
                        </Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark" size={20} color={STEP_COLORS.accent} />
                      ) : null}
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.siteEmpty}>
                  <Ionicons name="medical-outline" size={22} color={IOS_COLORS.secondaryLabel} />
                  <Text style={styles.siteEmptyText}>
                    No clinical sites are available yet. Add a site to your nursing Atlas, then pick it here.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <LocationMapPickerModal
        visible={pickerVisible}
        initialLocation={
          location?.lat != null && location?.lng != null
            ? { lat: location.lat, lng: location.lng }
            : null
        }
        initialName={location?.name}
        onClose={() => setPickerVisible(false)}
        onSelectLocation={handlePicked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: STEP_COLORS.secondaryLabel,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  venueText: {
    flex: 1,
    minWidth: 0,
  },
  venueName: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  venueNameLink: {
    color: '#007AFF',
  },
  venueSub: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 1,
  },
  venueSubLink: {
    color: '#007AFF',
  },
  quickPickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickPickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quickPickChipActive: {
    backgroundColor: STEP_COLORS.accentLight,
    borderColor: STEP_COLORS.accent,
  },
  quickPickText: {
    fontSize: 13,
    color: IOS_COLORS.label,
    maxWidth: 180,
  },
  quickPickTextActive: {
    color: STEP_COLORS.accent,
    fontWeight: '600',
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  saveLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  saveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saveChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  savedText: {
    fontSize: 11,
    color: STEP_COLORS.accent,
    fontWeight: '500',
  },
  precisionBlock: {
    gap: 6,
  },
  precisionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: STEP_COLORS.secondaryLabel,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  precisionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  precisionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  precisionChipActive: {
    backgroundColor: STEP_COLORS.accentLight,
    borderColor: STEP_COLORS.accent,
  },
  precisionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  precisionLabelActive: {
    color: STEP_COLORS.accent,
    fontWeight: '600',
  },
  subSiteBlock: {
    gap: 6,
  },
  subSiteEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: STEP_COLORS.secondaryLabel,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  subSiteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subSiteChip: {
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subSiteChipActive: {
    backgroundColor: STEP_COLORS.accentLight,
    borderColor: STEP_COLORS.accent,
  },
  subSiteChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  subSiteChipTextActive: {
    color: STEP_COLORS.accent,
  },
  subSiteInput: {
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: IOS_COLORS.label,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.xs,
    flexWrap: 'wrap',
  },
  pickText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
  pickHint: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  siteSheet: {
    maxHeight: '74%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  sheetHandleRow: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.systemGray4,
  },
  sheetClose: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemGray6,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  sheetSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  siteList: {
    marginTop: 14,
  },
  siteListContent: {
    gap: 8,
    paddingBottom: 8,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
    backgroundColor: '#FFFFFF',
  },
  siteRowActive: {
    borderColor: STEP_COLORS.accent,
    backgroundColor: STEP_COLORS.accentLight,
  },
  siteIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STEP_COLORS.accentLight,
  },
  siteIconActive: {
    backgroundColor: STEP_COLORS.accent,
  },
  siteText: {
    flex: 1,
    minWidth: 0,
  },
  siteName: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  siteSub: {
    marginTop: 2,
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  siteEmpty: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  siteEmptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
});
