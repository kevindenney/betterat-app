import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeatureCollection } from 'geojson';
import {
  AtlasMapLibreCanvas,
  type AtlasPinSpec,
} from '@/components/ios-register/atlas/AtlasMapLibreCanvas';
import { Ionicons } from '@expo/vector-icons';
import { useMarineSnapshot } from '@/hooks/useMarineSnapshot';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { deriveCourseStrategy, type CourseStrategy } from '@/lib/courseStrategy';
import { strategyHeadline } from '@/components/ios-register/atlas/CourseStrategyCard';
import { destinationPoint } from '@/services/CoursePositioningService';
import type { RacePlan } from '@/types/step-detail';

/**
 * Live Atlas map of a race's area + course, shown in the single step-detail
 * Plan tab once a race plan carries a center. Unlike the schematic
 * RaceCourseMiniMap (used on the timeline carousel cards, where N live WebGL
 * canvases would be too costly), this renders the real MapLibre Atlas canvas:
 * the race-area polygon + saved course geometry/marks, re-oriented to the
 * forecast wind AT RACE TIME, with explicit wind/current vectors.
 *
 * Conditions are forecast for the race's scheduled time (not "now"). With no
 * race time set, the course can't be oriented and the map says so instead of
 * implying the current weather is the race weather.
 *
 * Tapping the map opens the in-app race-course editor (RaceCoursePicker, via
 * onEditCourse) — the race already has an area/course, so editing it beats
 * dropping a fresh pin.
 */

const RACE = '#2563EB';
const EMPTY_ATLAS_PINS: AtlasPinSpec[] = [];
const PREVIEW_LEG_NM = 0.5;
const PREVIEW_HALF_LINE_NM = 0.04;

interface RaceCourseLiveMapProps {
  racePlan: Pick<
    RacePlan,
    'area_id' | 'area_name' | 'center' | 'course_label' | 'laps' | 'course_type'
  >;
  /** The race's scheduled time (step.starts_at). Drives the conditions forecast. */
  raceTime?: string | null;
  /** Opens the race area/course editor (RaceCoursePicker modal). */
  onEditCourse?: () => void;
  /** Opens Atlas centered on this race area/course. */
  onOpenAtlas?: () => void;
}

export function RaceCourseLiveMap({
  racePlan,
  raceTime,
  onEditCourse,
  onOpenAtlas,
}: RaceCourseLiveMapProps) {
  const lat = racePlan.center?.lat ?? null;
  const lng = racePlan.center?.lng ?? null;
  const hasRaceTime = Boolean(raceTime);

  // Memoize on primitives so the overlay hooks / canvas focusLocation don't see
  // a fresh object every render (feedback_live_preview_sheet_center_must_be_memoized).
  const center = useMemo(
    () => (lat != null && lng != null ? { lat, lng } : null),
    [lat, lng],
  );
  const focusLocation = useMemo(
    () => (center ? { lat: center.lat, lng: center.lng } : null),
    [center],
  );
  const mapFocusPadding = useMemo(
    () => ({ top: 24, bottom: 24, left: 24, right: 24 }),
    [],
  );

  // Fetch race-start conditions when a race time exists; otherwise fall back
  // to current conditions and label them as current.
  const { data: marine } = useMarineSnapshot({
    lat,
    lng,
    enabled: center != null,
    targetTime: raceTime ?? null,
  });

  const outOfRange = Boolean(marine?.outOfRange);
  const hasConditions = !outOfRange && marine != null;
  const courseType = String(racePlan.course_type ?? '').toLowerCase();
  const courseLabel = String(racePlan.course_label ?? '').toLowerCase();
  const isTriangleCourse = courseType === 'triangle' || courseLabel.includes('triangle');
  // Coastal / distance races run point-to-point around fixed geography, so the
  // windward-leeward grammar (course legs, layline-favored side, up/downwind
  // strategy) doesn't apply — only the start and the live conditions do.
  const isCoastalCourse =
    courseType === 'coastal' ||
    courseType === 'distance' ||
    courseLabel.includes('coastal') ||
    courseLabel.includes('distance');

  const courseValue = [
    racePlan.course_label,
    racePlan.laps
      ? `${racePlan.laps} lap${racePlan.laps === 1 ? '' : 's'}`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const forecastValues = [
    marine?.wind ? `Wind ${marine.wind.degrees}° · ${marine.wind.knots} kn` : null,
    marine?.current
      ? `Current ${marine.current.degrees}° · ${marine.current.knots} kn`
      : null,
    marine?.waves ? `Swell ${marine.waves.heightMeters} m` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const strategy = marine?.wind && hasConditions
    ? deriveCourseStrategy({
        windDirection: marine.wind.degrees,
        windSpeedKn: marine.wind.knots,
        currentDirection: marine.current?.degrees,
        currentSpeedKn: marine.current?.knots,
      })
    : null;

  const coursePreviewCollection = useMemo<FeatureCollection | null>(() => {
    if (!isTriangleCourse || !center) return null;
    const windDirection = hasConditions && marine?.wind?.degrees != null
      ? marine.wind.degrees
      : 180;
    const start = destinationPoint(
      center.lat,
      center.lng,
      windDirection + 180,
      PREVIEW_LEG_NM / 2,
    );
    const pin = destinationPoint(start.lat, start.lng, windDirection - 90, PREVIEW_HALF_LINE_NM);
    const committee = destinationPoint(start.lat, start.lng, windDirection + 90, PREVIEW_HALF_LINE_NM);
    const windward = destinationPoint(start.lat, start.lng, windDirection, PREVIEW_LEG_NM);
    const wingAxis = destinationPoint(start.lat, start.lng, windDirection, PREVIEW_LEG_NM * 0.5);
    const wing = destinationPoint(
      wingAxis.lat,
      wingAxis.lng,
      windDirection + 90,
      PREVIEW_LEG_NM * 0.866,
    );
    const point = (id: string, c: { lat: number; lng: number }, markType: string) => ({
      type: 'Feature' as const,
      id,
      properties: { type: 'course-mark', markType },
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
    });

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'plan-triangle-start-line',
          properties: { type: 'start-line' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [pin.lng, pin.lat],
              [committee.lng, committee.lat],
            ],
          },
        },
        {
          type: 'Feature',
          id: 'plan-triangle-leg',
          properties: { type: 'course-leg', courseType: 'triangle' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [start.lng, start.lat],
              [windward.lng, windward.lat],
              [wing.lng, wing.lat],
              [start.lng, start.lat],
            ],
          },
        },
        point('plan-triangle-pin', pin, 'pin'),
        point('plan-triangle-committee', committee, 'committee'),
        point('plan-triangle-windward', windward, 'windward'),
        point('plan-triangle-wing', wing, 'wing'),
      ],
    };
  }, [center, hasConditions, isTriangleCourse, marine?.wind?.degrees]);

  if (!center) return null;

  // Conditions line states. Scheduled races show the race-start forecast;
  // unscheduled races use current conditions and say so explicitly.
  const hasConditionValues = hasConditions && forecastValues.length > 0;
  let conditionsText: string;
  let conditionsMuted = false;
  if (outOfRange) {
    conditionsText = 'Forecast opens within 16 days of the race';
    conditionsMuted = true;
  } else if (hasConditionValues) {
    conditionsText = `${hasRaceTime ? 'At start' : 'Current'} · ${forecastValues}`;
  } else {
    conditionsText = hasRaceTime ? 'Fetching race-time conditions…' : 'Fetching current conditions…';
    conditionsMuted = true;
  }

  const orientationNote = outOfRange
      ? 'Orientation set nearer the race'
      : !hasConditionValues
        ? 'Orienting to forecast…'
        : null;

  return (
    <View style={styles.card}>
      <View style={styles.mapWrap}>
        <AtlasMapLibreCanvas
          frame="f2"
          focusLocation={focusLocation}
          showRaceAreas
          showCourse={!isTriangleCourse && !isCoastalCourse}
          coursePreviewCollection={coursePreviewCollection}
          courseWindDirectionDeg={hasConditions ? marine?.wind?.degrees : undefined}
          courseCurrentDirectionDeg={hasConditions ? marine?.current?.degrees : undefined}
          courseCurrentSpeedKn={hasConditions ? marine?.current?.knots : undefined}
          pins={EMPTY_ATLAS_PINS}
          focusPadding={mapFocusPadding}
          focusZoomLevel={13.2}
          hideArrowChips
        />
        {/* Transparent tap layer opens the in-app race-course editor. Sits over
            the canvas so a tap edits the course instead of panning the map. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onEditCourse}
          disabled={!onEditCourse}
          accessibilityRole="button"
          accessibilityLabel="Edit race area and course"
        />
        {racePlan.area_name ? (
          <View pointerEvents="none" style={styles.areaPill}>
            <Text style={styles.areaPillText} numberOfLines={1}>
              {racePlan.area_name.toUpperCase()}
            </Text>
          </View>
        ) : null}
        {hasConditions && marine?.wind ? (
          <View pointerEvents="none" style={[styles.mapConditionPill, styles.windPill]}>
            <Ionicons
              name="arrow-up"
              size={12}
              color="#2563EB"
              style={{ transform: [{ rotate: `${(marine.wind.degrees + 180) % 360}deg` }] }}
            />
            <Text style={styles.mapConditionText}>
              Wind {marine.wind.degrees}° · {Math.round(marine.wind.knots)} kn
            </Text>
          </View>
        ) : null}
        {hasConditions && marine?.current ? (
          <View pointerEvents="none" style={[styles.mapConditionPill, styles.currentPill]}>
            <Ionicons
              name="chevron-up"
              size={13}
              color="#00A8A8"
              style={{ transform: [{ rotate: `${marine.current.degrees}deg` }] }}
            />
            <Text style={styles.mapConditionText}>
              Current {marine.current.degrees}° · {marine.current.knots.toFixed(1)} kn
            </Text>
          </View>
        ) : null}
        {hasConditions && marine?.wind ? (
          <View pointerEvents="none" style={[styles.courseVector, styles.windVector]}>
            <View style={styles.vectorLabelWrap}>
              <Text style={[styles.vectorLabel, styles.windVectorLabel]}>WIND</Text>
            </View>
            <View style={[styles.vectorDisc, styles.windVectorDisc]}>
              <Ionicons
                name="arrow-up"
                size={28}
                color="#2563EB"
                style={{ transform: [{ rotate: `${(marine.wind.degrees + 180) % 360}deg` }] }}
              />
            </View>
          </View>
        ) : null}
        {hasConditions && marine?.current ? (
          <View pointerEvents="none" style={[styles.courseVector, styles.currentVector]}>
            <View style={styles.vectorLabelWrap}>
              <Text style={[styles.vectorLabel, styles.currentVectorLabel]}>CURRENT</Text>
            </View>
            <View style={[styles.vectorDisc, styles.currentVectorDisc]}>
              <Ionicons
                name="chevron-up"
                size={30}
                color="#00A8A8"
                style={{ transform: [{ rotate: `${marine.current.degrees}deg` }] }}
              />
            </View>
          </View>
        ) : null}
        {orientationNote ? (
          <View pointerEvents="none" style={styles.orientPill}>
            <Text style={styles.orientPillText} numberOfLines={1}>
              {orientationNote}
            </Text>
          </View>
        ) : null}
        {onEditCourse ? (
          <View pointerEvents="none" style={styles.editPill}>
            <Text style={styles.editPillText}>Edit course ›</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {courseValue ? (
          <View style={styles.footerRow}>
            <Text style={styles.footerKey}>Course</Text>
            <Text style={styles.footerVal}>{courseValue}</Text>
          </View>
        ) : null}
        <Text
          style={[styles.conditions, conditionsMuted && styles.conditionsMuted]}
          numberOfLines={1}
        >
          {conditionsText}
        </Text>
        {onOpenAtlas ? (
          <Pressable
            style={({ pressed }) => [styles.atlasButton, pressed && styles.atlasButtonPressed]}
            onPress={onOpenAtlas}
            accessibilityRole="button"
            accessibilityLabel="Open this race course on Atlas"
          >
            <Text style={styles.atlasButtonText}>Open in Atlas ›</Text>
          </Pressable>
        ) : null}
        {strategy ? (
          <CompactStrategyCard strategy={strategy} startOnly={isCoastalCourse} />
        ) : null}
      </View>
    </View>
  );
}

type StrategySectionId = 'start' | 'upwind' | 'downwind';

// startOnly: coastal/distance races round fixed geography, so only the start
// carries windward-leeward meaning — the up/down legs are dropped.
function CompactStrategyCard({ strategy, startOnly }: { strategy: CourseStrategy; startOnly?: boolean }) {
  const [open, setOpen] = useState<StrategySectionId | null>(null);
  const rows = useMemo(
    () => {
      const all = [
        {
          id: 'start' as const,
          title: 'Start',
          tag: strategy.start.favoredEnd === 'committee' ? 'BOAT' : strategy.start.favoredEnd.toUpperCase(),
          headline: strategy.start.text.split(/[.!?]/)[0],
          body: strategy.start.text,
        },
        {
          id: 'upwind' as const,
          title: 'Upwind',
          tag: strategy.upwind.favoredSide.toUpperCase(),
          headline: strategy.upwind.summary.split(/[.!?]/)[0],
          body: strategy.upwind.summary,
        },
        {
          id: 'downwind' as const,
          title: 'Downwind',
          tag: strategy.downwind.favoredSide.toUpperCase(),
          headline: strategy.downwind.summary.split(/[.!?]/)[0],
          body: strategy.downwind.summary,
        },
      ];
      return startOnly ? all.filter((row) => row.id === 'start') : all;
    },
    [strategy, startOnly],
  );

  return (
    <View style={styles.strategyWrap}>
      <View style={styles.strategyHeader}>
        <Text style={styles.strategyEyebrow}>Strategy</Text>
        <Text style={styles.strategyHeadline} numberOfLines={1}>
          {strategyHeadline(strategy, startOnly)}
        </Text>
      </View>
      <View style={styles.strategyRows}>
        {rows.map((row) => {
          const isOpen = open === row.id;
          return (
            <Pressable
              key={row.id}
              style={styles.strategyRow}
              onPress={() => setOpen(isOpen ? null : row.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <View style={styles.strategyRowTop}>
                <Text style={styles.strategySectionTitle}>{row.title}</Text>
                <Text style={styles.strategyRowHeadline} numberOfLines={1}>
                  {row.headline}
                </Text>
                <View style={styles.strategyTag}>
                  <Text style={styles.strategyTagText}>{row.tag}</Text>
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={IOS_COLORS.tertiaryLabel}
                />
              </View>
              {isOpen ? <Text style={styles.strategyRowBody}>{row.body}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
  },
  mapWrap: {
    height: 190,
    position: 'relative',
  },
  areaPill: {
    position: 'absolute',
    left: 8,
    top: 8,
    backgroundColor: 'rgba(14,33,56,0.78)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '70%',
  },
  areaPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: 'rgba(220,235,255,0.95)',
  },
  editPill: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  editPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: RACE,
  },
  mapConditionPill: {
    position: 'absolute',
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '78%',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  windPill: {
    top: 42,
  },
  currentPill: {
    top: 70,
  },
  mapConditionText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: IOS_COLORS.secondaryLabel,
  },
  courseVector: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
    zIndex: 4,
    transform: [{ translateX: -24 }, { translateY: -24 }],
  },
  windVector: {
    left: '61%',
    top: '33%',
  },
  currentVector: {
    left: '61%',
    top: '58%',
  },
  vectorDisc: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  windVectorDisc: {
    borderColor: 'rgba(37,99,235,0.38)',
  },
  currentVectorDisc: {
    borderColor: 'rgba(0,168,168,0.42)',
  },
  vectorLabelWrap: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  vectorLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0,
  },
  windVectorLabel: {
    color: '#2563EB',
  },
  currentVectorLabel: {
    color: '#008C8C',
  },
  orientPill: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(14,33,56,0.66)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '64%',
  },
  orientPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: 'rgba(220,235,255,0.95)',
  },
  footer: {
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 7,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerKey: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  footerVal: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  conditions: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  conditionsMuted: {
    fontStyle: 'italic',
    color: IOS_COLORS.tertiaryLabel,
  },
  strategyWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.systemGray5,
    paddingTop: 8,
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  strategyEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: RACE,
    textTransform: 'uppercase',
  },
  strategyHeadline: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
  },
  strategyRows: {
    marginTop: 6,
  },
  strategyRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.systemGray5,
    paddingVertical: 8,
  },
  strategyRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  strategySectionTitle: {
    width: 72,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#D2691E',
    textTransform: 'uppercase',
  },
  strategyRowHeadline: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  strategyTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52,199,89,0.45)',
  },
  strategyTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: IOS_COLORS.systemGreen,
  },
  strategyRowBody: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_COLORS.secondaryLabel,
  },
  atlasButton: {
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.systemGray5,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  atlasButtonPressed: {
    opacity: 0.65,
  },
  atlasButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: RACE,
  },
});
