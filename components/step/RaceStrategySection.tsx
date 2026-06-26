/**
 * RaceStrategySection — the race intelligence block on a race step's detail.
 *
 * Atlas already derives course strategy + race-time conditions for a race
 * PIN, but that surface is only reachable when the race renders as a
 * standalone pin; co-located races fold into a stack and the strategy
 * becomes unreachable. This block puts the same intelligence on the step
 * itself, so it's always one tap away regardless of how the pin folded.
 *
 * Self-contained: given the race's location + start time it fetches the
 * marine snapshot (forecast AT race start when the race is inside the
 * forecast horizon, else a live "now" nowcast) and feeds the same
 * deterministic deriveCourseStrategy the Atlas card uses.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CourseStrategyCard } from '@/components/ios-register/atlas/CourseStrategyCard';
import { RigTuneCard } from '@/components/step/RigTuneCard';
import { useMarineSnapshot } from '@/hooks/useMarineSnapshot';
import { deriveCourseStrategy } from '@/lib/courseStrategy';
import { rigTuneFor } from '@/lib/rigTune';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface Props {
  lat: number | null;
  lng: number | null;
  /** ISO race start; drives the forecast-at-race-time path. null → "now". */
  raceStartAt: string | null;
  /** "Victoria Harbour · Windward–Leeward · 3 laps" when a course is picked. */
  courseSummary?: string | null;
  /** Opens the race course in Atlas; omitted when the race has no center. */
  onOpenCourse?: () => void;
  /** Sailor's primary boat class — drives the per-class rig-tune baseline. */
  boatClass?: string | null;
  /**
   * The picked course's type. Coastal/distance races round fixed geography, so
   * upwind/downwind favored-side tactics don't apply — we keep wind/current +
   * start and drop the beat/run strategy.
   */
  courseType?: string | null;
}

function bearing(value: { degrees: number } | null | undefined): string {
  if (!value) return '—';
  return `${String(value.degrees).padStart(3, '0')}°`;
}

export function RaceStrategySection({
  lat,
  lng,
  raceStartAt,
  courseSummary,
  onOpenCourse,
  boatClass,
  courseType,
}: Props) {
  const enabled = lat != null && lng != null;
  const type = String(courseType ?? '').toLowerCase();
  const summary = String(courseSummary ?? '').toLowerCase();
  const isCoastalCourse =
    type === 'coastal' ||
    type === 'distance' ||
    summary.includes('coastal') ||
    summary.includes('distance');
  const { data: snapshot, isLoading } = useMarineSnapshot({
    lat,
    lng,
    enabled,
    targetTime: raceStartAt,
  });

  const strategy = React.useMemo(() => {
    if (!snapshot?.wind) return null;
    return deriveCourseStrategy({
      windDirection: snapshot.wind.degrees,
      windSpeedKn: snapshot.wind.knots,
      currentDirection: snapshot.current?.degrees,
      currentSpeedKn: snapshot.current?.knots,
    });
  }, [snapshot]);

  const rigTune = React.useMemo(
    () => rigTuneFor(boatClass, snapshot?.wind?.knots),
    [boatClass, snapshot?.wind?.knots],
  );

  // No mapped racing area — strategy is location-driven, so prompt for one.
  if (!enabled) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>RACE STRATEGY</Text>
        </View>
        <Text style={styles.muted}>
          Pick a racing area to see the start, beat, and run strategy for this
          race&apos;s wind and current.
        </Text>
        {onOpenCourse ? (
          <Pressable
            onPress={onOpenCourse}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel="Set the race course"
          >
            <Ionicons name="map-outline" size={15} color={IOS_REGISTER.accentUserAction} />
            <Text style={styles.ctaText}>Set the course</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const outOfRange = Boolean(raceStartAt && snapshot?.outOfRange);
  const conditionsLabel = outOfRange
    ? 'Race-start forecast not available yet'
    : raceStartAt
      ? 'Conditions · at race start'
      : 'Conditions · now';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>RACE STRATEGY</Text>
        {onOpenCourse ? (
          <Pressable
            onPress={onOpenCourse}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open the race course in Atlas"
            style={({ pressed }) => [styles.openCourse, pressed && styles.ctaPressed]}
          >
            <Ionicons name="map-outline" size={13} color={IOS_REGISTER.accentUserAction} />
            <Text style={styles.openCourseText}>Course</Text>
          </Pressable>
        ) : null}
      </View>

      {courseSummary ? <Text style={styles.courseSummary}>{courseSummary}</Text> : null}

      <Text style={styles.conditionsLabel}>{conditionsLabel}</Text>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
          <Text style={styles.muted}>Reading wind &amp; current…</Text>
        </View>
      ) : outOfRange ? (
        <Text style={styles.muted}>
          This race is outside the 16-day forecast window — check back closer to
          race day for wind, current, and strategy.
        </Text>
      ) : snapshot?.wind ? (
        <>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>WIND</Text>
              <Text style={styles.metricValue}>
                {bearing(snapshot.wind)} · {snapshot.wind.knots} kn
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>CURRENT</Text>
              <Text style={styles.metricValue}>
                {snapshot.current
                  ? `${bearing(snapshot.current)} · ${snapshot.current.knots} kn`
                  : '—'}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>SEA</Text>
              <Text style={styles.metricValue}>
                {snapshot.waves
                  ? `${snapshot.waves.heightMeters.toFixed(1)} m`
                  : '—'}
              </Text>
            </View>
          </View>
          {strategy ? (
            <CourseStrategyCard strategy={strategy} startOnly={isCoastalCourse} />
          ) : null}
          {rigTune ? (
            <RigTuneCard
              boatClass={rigTune.guide.boatClass}
              source={rigTune.guide.source}
              band={rigTune.band}
            />
          ) : null}
        </>
      ) : (
        <Text style={styles.muted}>
          No marine data for this spot yet — strategy needs wind and current to
          read the course.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#C2410C',
  },
  openCourse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  openCourseText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
  courseSummary: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  conditionsLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: IOS_REGISTER.labelTertiary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: IOS_REGISTER.labelTertiary,
  },
  metricValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  muted: {
    marginTop: 6,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 16,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  ctaPressed: {
    opacity: 0.55,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
  },
});

export default RaceStrategySection;
