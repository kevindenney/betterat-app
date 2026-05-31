/**
 * <PlanWhereCard> — canonical §11 "Where will you do this?" card. Sibling
 * component to PlanWithCard and follows the same self-contained pattern:
 * owns the LocationMapPicker modal state, receives the current location +
 * an onChange callback, and surfaces a single "Pick on map …" affordance
 * when nothing is set yet.
 *
 * Once a location is set, we surface the venue name bold with the
 * coordinates as a subtitle, plus a small change/clear affordance. The
 * social-proof tagline ("see what other sailors did here") sits under the
 * pick button as a hint — wiring the live count belongs to a follow-up
 * once step_location has enough rows to be meaningful.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

/** Quick-pick chip (e.g. an org's known venues like "RHKYC Clubhouse"). */
export interface PlanWhereQuickPick {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
}

/**
 * Precision levels surfaced in the picker. 'site' is intentionally omitted
 * until poi_id is wired (it would silently behave as 'exact'). Default is
 * 'exact' — we never coarsen a location the user already set without asking,
 * since legitimate venue pins (a marina, a course mark) want exact coords.
 */
const PRECISION_OPTIONS: {
  value: StepLocationPrecision;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'exact', label: 'Exact', hint: 'Your precise spot', icon: 'locate' },
  {
    value: 'neighborhood',
    label: 'Approximate',
    hint: 'Fuzzed ~500m',
    icon: 'shapes-outline',
  },
  { value: 'hidden', label: 'Hidden', hint: 'Off the map', icon: 'eye-off-outline' },
];

interface PlanWhereCardProps {
  location?: StepLocation;
  readOnly?: boolean;
  onChange: (next: StepLocation | undefined) => void;
  /** Optional pre-seeded venues (e.g. user's club's racing areas). */
  quickPicks?: PlanWhereQuickPick[];
}

export function PlanWhereCard({ location, readOnly, onChange, quickPicks }: PlanWhereCardProps) {
  const router = useRouter();
  const { vocab } = useVocabulary();
  const [pickerVisible, setPickerVisible] = useState(false);
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
        location_precision: location?.location_precision,
      });
      setPickerVisible(false);
    },
    [onChange, location?.venue_id, location?.location_precision],
  );

  /**
   * Per brief A9, the legacy LocationMapPicker modal is absorbed into
   * Atlas. When ATLAS_MAPLIBRE_CANVAS is on, "Pick on map" pushes to
   * /(tabs)/atlas?fromPlan=1, subscribes to AtlasPickerBus for the result,
   * and applies it via onChange. When the flag is off, the legacy modal
   * still opens (so this lands as additive — old path stays as fallback).
   */
  const handleOpenPicker = useCallback(() => {
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
        location_precision: location?.location_precision,
      });
    });
    router.push({ pathname: '/(tabs)/atlas', params: { fromPlan: '1' } });
  }, [router, onChange, location?.venue_id, location?.location_precision]);

  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const handlePrecision = useCallback(
    (next: StepLocationPrecision) => {
      if (!location) return;
      onChange({ ...location, location_precision: next });
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
        <Text style={styles.eyebrow}>Where will you do this?</Text>
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
                  {otherSailors} {otherSailors === 1 ? peersSingular : peersPlural} set steps within 5 km →
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
            {PRECISION_OPTIONS.map((opt) => {
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

      {!readOnly && quickPicks && quickPicks.length > 0 && (
        <View style={styles.quickPickRow}>
          {quickPicks.map((qp) => {
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
                    location_precision: location?.location_precision,
                  })
                }
              >
                <Ionicons
                  name="location"
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

      {!readOnly && (
        <Pressable style={styles.pickBtn} onPress={handleOpenPicker}>
          <Ionicons name="map-outline" size={16} color={STEP_COLORS.accent} />
          <Text style={styles.pickText}>
            {hasName ? 'Change location' : 'Pick on map'}
          </Text>
          {!hasName ? (
            <Text style={styles.pickHint}> · see what other sailors did here</Text>
          ) : null}
        </Pressable>
      )}

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
});
