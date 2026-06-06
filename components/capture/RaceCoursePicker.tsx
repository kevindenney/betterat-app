/**
 * RaceCoursePicker — the inline "Race area & course" reveal that appears under
 * the Step ⟷ Race selector when a step is flagged a Race (mockup 27, frame 2).
 *
 * Lists the racing areas the user can pick — their own Atlas-drawn areas plus
 * the step venue's mapped areas (see useMyRacingAreas) — and offers a path to
 * draw a new one on the Atlas tab. Also captures course type + laps. Marks
 * geometry and live wind/tide are derived/live and refined later on the
 * on-water screen, so they are not edited here — this only emits a RacePlan.
 *
 * Emits a RacePlan up to the composer, which persists it to
 * metadata.race_plan + the display-only race_course_context chips on save.
 */

import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { RacingAreaGeometry } from '@/hooks/useVenueRacingAreas';
import { useMyRacingAreas } from '@/hooks/useMyRacingAreas';
import type { RacePlan } from '@/types/step-detail';

const RACE = '#2563EB';

/** Course types offered when an area declares none of its own. Order = display. */
const COURSE_TYPES: { key: string; label: string; laps: boolean }[] = [
  { key: 'windward_leeward', label: 'Windward–Leeward', laps: true },
  { key: 'triangle', label: 'Triangle', laps: true },
  { key: 'coastal', label: 'Coastal', laps: false },
  { key: 'distance', label: 'Distance', laps: false },
  { key: 'custom', label: 'Custom', laps: false },
];

function courseLabelFor(key: string): string {
  const known = COURSE_TYPES.find((c) => c.key === key);
  if (known) return known.label;
  // Title-case an area-supplied key like "around_the_cans".
  return key
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function courseHasLaps(key?: string): boolean {
  if (!key) return false;
  return COURSE_TYPES.find((c) => c.key === key)?.laps ?? false;
}

/**
 * Centroid of a racing-area geometry, in {lat,lng}. GeoJSON coordinates are
 * [lng,lat]; we average the ring/line points (Polygon uses its outer ring).
 */
function geometryCenter(geom?: RacingAreaGeometry): { lat: number; lng: number } | undefined {
  if (!geom?.coordinates) return undefined;
  const collect = (coords: any): number[][] => {
    if (typeof coords[0] === 'number') return [coords as number[]];
    return (coords as any[]).flatMap(collect);
  };
  let points: number[][] = [];
  if (geom.type === 'Point') {
    points = [geom.coordinates as number[]];
  } else if (geom.type === 'Polygon') {
    points = ((geom.coordinates as number[][][])[0] ?? []);
  } else {
    points = collect(geom.coordinates);
  }
  const valid = points.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (valid.length === 0) return undefined;
  const sum = valid.reduce((acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }), { lng: 0, lat: 0 });
  return { lat: sum.lat / valid.length, lng: sum.lng / valid.length };
}

interface RaceCoursePickerProps {
  venueId?: string | null;
  venueName?: string | null;
  value: RacePlan;
  onChange: (next: RacePlan) => void;
}

export function RaceCoursePicker({ venueId, value, onChange }: RaceCoursePickerProps) {
  const router = useRouter();
  const { racingAreas, isLoading } = useMyRacingAreas(venueId ?? undefined);

  const selectedArea = useMemo(
    () => racingAreas.find((a) => a.id === value.area_id),
    [racingAreas, value.area_id],
  );

  const openAtlasToDraw = () => {
    router.push({
      pathname: '/(tabs)/atlas',
      params: {
        intent: 'new-racing-area',
        ...(value.center
          ? {
              lat: String(value.center.lat),
              lng: String(value.center.lng),
            }
          : {}),
        ...(value.area_name ? { area: value.area_name } : {}),
      },
    } as any);
  };

  // Course options: the selected area's typicalCourses when present, else the
  // generic list. Always de-duped and resolved to {key,label}.
  const courseOptions = useMemo(() => {
    const keys = selectedArea?.typicalCourses?.length
      ? selectedArea.typicalCourses
      : COURSE_TYPES.map((c) => c.key);
    const seen = new Set<string>();
    return keys
      .filter((k) => (seen.has(k) ? false : (seen.add(k), true)))
      .map((k) => ({ key: k, label: courseLabelFor(k) }));
  }, [selectedArea]);

  const selectArea = (areaId: string) => {
    const area = racingAreas.find((a) => a.id === areaId);
    if (!area) return;
    const center =
      geometryCenter(area.geometry) ??
      (area.centerLat != null && area.centerLng != null
        ? { lat: area.centerLat, lng: area.centerLng }
        : undefined);
    onChange({
      ...value,
      area_id: area.id,
      area_name: area.areaName,
      center,
    });
  };

  const selectCourse = (key: string) => {
    onChange({
      ...value,
      course_type: key,
      course_label: courseLabelFor(key),
      laps: courseHasLaps(key) ? (value.laps ?? 2) : undefined,
    });
  };

  const bumpLaps = (delta: number) => {
    const next = Math.max(1, Math.min(9, (value.laps ?? 2) + delta));
    onChange({ ...value, laps: next });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>RACE AREA &amp; COURSE</Text>
        <Text style={styles.eyebrowQuiet}>race only</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={RACE} />
          <Text style={styles.note}>Loading racing areas…</Text>
        </View>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Racing area</Text>
          <View style={styles.chipRow}>
            {racingAreas.map((area) => {
              const active = area.id === value.area_id;
              return (
                <Pressable
                  key={area.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => selectArea(area.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {area.areaName}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.chip, styles.chipCreate]}
              onPress={openAtlasToDraw}
              accessibilityRole="button"
              accessibilityLabel="Create a new racing area on the Atlas tab"
            >
              <Ionicons name="add" size={13} color={RACE} />
              <Text style={[styles.chipText, styles.chipTextActive]}>New in Atlas</Text>
            </Pressable>
          </View>

          {racingAreas.length === 0 ? (
            <Text style={styles.note}>
              No racing areas yet. Draw one on the Atlas tab, or save the race and
              set its course later on the water.
            </Text>
          ) : null}

          {value.area_id ? (
            <>
              <Text style={styles.fieldLabel}>Course</Text>
              <View style={styles.chipRow}>
                {courseOptions.map((opt) => {
                  const active = opt.key === value.course_type;
                  return (
                    <Pressable
                      key={opt.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => selectCourse(opt.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {courseHasLaps(value.course_type) ? (
                <View style={styles.lapsRow}>
                  <Text style={styles.fieldLabel}>Laps</Text>
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => bumpLaps(-1)}
                      accessibilityLabel="Fewer laps"
                    >
                      <Ionicons name="remove" size={16} color={RACE} />
                    </Pressable>
                    <Text style={styles.stepperValue}>{value.laps ?? 2}</Text>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => bumpLaps(1)}
                      accessibilityLabel="More laps"
                    >
                      <Ionicons name="add" size={16} color={RACE} />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

          {value.area_name && value.course_label ? (
            <View style={styles.summary}>
              <Ionicons name="navigate-circle-outline" size={16} color={RACE} />
              <Text style={styles.summaryText}>
                {value.area_name} · {value.course_label}
                {courseHasLaps(value.course_type) && value.laps ? ` · ${value.laps} laps` : ''}
              </Text>
            </View>
          ) : (
            <Text style={styles.note}>
              Marks and live wind/tide attach to this area when you open the race
              on the water.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: IOS_SPACING.sm,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37,99,235,0.35)',
    backgroundColor: 'rgba(37,99,235,0.05)',
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  eyebrow: {
    fontSize: 10.5,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: RACE,
    textTransform: 'uppercase',
  },
  eyebrowQuiet: {
    fontSize: 10.5,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: 'rgba(37,99,235,0.5)',
    textTransform: 'uppercase',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  chipActive: {
    borderColor: RACE,
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  chipCreate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderColor: RACE,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  chipTextActive: {
    color: RACE,
  },
  lapsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37,99,235,0.4)',
    backgroundColor: IOS_COLORS.systemBackground,
  },
  stepperValue: {
    fontSize: 15,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.label,
    minWidth: 16,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(37,99,235,0.2)',
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: RACE,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  note: {
    fontSize: 11.5,
    lineHeight: 16,
    color: IOS_COLORS.secondaryLabel,
  },
});
