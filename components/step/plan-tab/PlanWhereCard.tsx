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
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import type { StepLocation } from '@/types/step-detail';
import { LocationMapPicker as LocationMapPickerModal } from '@/components/races/LocationMapPicker';
import { useStepLocationNeighbors } from '@/hooks/useStepLocationNeighbors';

/** Quick-pick chip (e.g. an org's known venues like "RHKYC Clubhouse"). */
export interface PlanWhereQuickPick {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
}

interface PlanWhereCardProps {
  location?: StepLocation;
  readOnly?: boolean;
  onChange: (next: StepLocation | undefined) => void;
  /** Optional pre-seeded venues (e.g. user's club's racing areas). */
  quickPicks?: PlanWhereQuickPick[];
}

export function PlanWhereCard({ location, readOnly, onChange, quickPicks }: PlanWhereCardProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const { data: neighbors } = useStepLocationNeighbors(location?.lat, location?.lng, 5);
  // Subtract the current user's own pin if applicable — we want "OTHER sailors".
  const otherSailors = Math.max(0, (neighbors?.sailors ?? 0) - 1);

  const handlePicked = useCallback(
    (picked: { name: string; lat: number; lng: number }) => {
      onChange({
        name: picked.name,
        lat: picked.lat,
        lng: picked.lng,
        venue_id: location?.venue_id,
      });
      setPickerVisible(false);
    },
    [onChange, location?.venue_id],
  );

  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const hasName = Boolean(location?.name?.trim());
  const hasCoords = location?.lat != null && location?.lng != null;

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
            <Text style={styles.venueName} numberOfLines={1}>
              {location!.name}
            </Text>
            {hasCoords && otherSailors > 0 ? (
              <Text style={styles.venueSub} numberOfLines={1}>
                {otherSailors} {otherSailors === 1 ? 'sailor' : 'sailors'} set steps within 5 km
              </Text>
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
        <Pressable style={styles.pickBtn} onPress={() => setPickerVisible(true)}>
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
  venueSub: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 1,
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
