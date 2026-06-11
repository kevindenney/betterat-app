/**
 * VenueMasterySheet — body of the racing-area bottom sheet (Phase V.2).
 * Three stacked reads about one stretch of water:
 *
 *   1. Conditions — at race time when this area hosts the viewer's next
 *      race and the forecast window is open; otherwise "now", honestly
 *      labeled. Includes the tide-flip warning when detected.
 *   2. Record here — the viewer's completed races at this area plus
 *      their most recent review note (the "what I learned last time"
 *      hook that makes the venue feel cumulative).
 *   3. Local knowledge — the existing PlaceKnowledgeSection, passed in
 *      as children so this component stays presentation-only on top of
 *      its one record query.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useVenueRecord } from '@/hooks/useVenueRecord';
import { useFleetVenueStats } from '@/hooks/useFleetVenueStats';
import type { MarineTrendPoint } from '@/hooks/useMarineSnapshot';
import type { CurrentConditions } from '@/types/community-feed';

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

function compassFromDegrees(degrees: number): string {
  return COMPASS_16[Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16];
}

export interface VenueRaceTimeConditions {
  /** "Sat 2pm" — the next race's display time. */
  whenLabel: string;
  point: MarineTrendPoint;
  /** "Tide flips ~3pm" when a stream reversal sits inside the race window. */
  flipLabel: string | null;
}

export function VenueMasterySheet({
  areaPoiId,
  raceTime,
  raceWindow,
  liveConditions,
  children,
}: {
  areaPoiId: string;
  /** Set when this area hosts the viewer's next race and the forecast is open. */
  raceTime: VenueRaceTimeConditions | null;
  /** Race-week window for the fleet "boats in" count, when a race is upcoming here. */
  raceWindow?: { startIso: string; endIso: string } | null;
  /** Fallback "now" conditions from the map's marine snapshot. */
  liveConditions: CurrentConditions | null;
  /** The local-knowledge section (PlaceKnowledgeSection). */
  children?: React.ReactNode;
}) {
  const { data: record } = useVenueRecord(areaPoiId);
  const { data: fleetStats } = useFleetVenueStats({
    areaPoiId,
    eventWindow: raceWindow ?? null,
  });

  const conditionParts: string[] = [];
  if (raceTime) {
    const { wind, current } = raceTime.point;
    if (wind) conditionParts.push(`${wind.knots} kn ${compassFromDegrees(wind.degrees)}`);
    if (current) conditionParts.push(`${current.knots.toFixed(1)} kn stream`);
  } else if (liveConditions) {
    if (liveConditions.windSpeed != null) {
      conditionParts.push(
        liveConditions.windDirection != null
          ? `${Math.round(liveConditions.windSpeed)} kn ${compassFromDegrees(liveConditions.windDirection)}`
          : `${Math.round(liveConditions.windSpeed)} kn`,
      );
    }
    if (liveConditions.currentSpeed != null) {
      conditionParts.push(`${liveConditions.currentSpeed.toFixed(1)} kn stream`);
    }
  }

  return (
    <View style={styles.wrap}>
      {conditionParts.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockHeading}>
            {raceTime ? `CONDITIONS · RACE TIME · ${raceTime.whenLabel.toUpperCase()}` : 'CONDITIONS · NOW'}
          </Text>
          <Text style={styles.conditionsLine}>{conditionParts.join(' · ')}</Text>
          {raceTime?.flipLabel ? (
            <View style={styles.flipPill}>
              <Ionicons name="warning-outline" size={11} color="#B25E09" />
              <Text style={styles.flipText} numberOfLines={1}>
                {raceTime.flipLabel}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {fleetStats ? (
        <View style={styles.block}>
          <Text style={styles.blockHeading}>{fleetStats.fleetName.toUpperCase()} HERE</Text>
          {raceWindow && fleetStats.plannedInWindow > 0 ? (
            <Text style={styles.recordLine}>
              {fleetStats.plannedInWindow} of {fleetStats.fleetSize} boats in for race week
            </Text>
          ) : null}
          {fleetStats.fleetmates.length > 0 ? (
            <Text style={styles.mutedLine}>
              Most races here:{' '}
              {fleetStats.fleetmates
                .slice(0, 2)
                .map((m) => `${m.displayName} (${m.completedCount})`)
                .join(' · ')}
            </Text>
          ) : null}
          {!(raceWindow && fleetStats.plannedInWindow > 0) && fleetStats.fleetmates.length === 0 ? (
            <Text style={styles.mutedLine}>No fleet activity logged here yet.</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.blockHeading}>YOUR RECORD HERE</Text>
        {record == null ? (
          <Text style={styles.mutedLine}>Loading…</Text>
        ) : record.raceCount === 0 ? (
          <Text style={styles.mutedLine}>No races logged here yet.</Text>
        ) : (
          <>
            <Text style={styles.recordLine}>
              {record.raceCount} {record.raceCount === 1 ? 'race' : 'races'} here
            </Text>
            {record.lastNote ? (
              <Text style={styles.noteLine} numberOfLines={2}>
                “{record.lastNote.body}” — {record.lastNote.stepTitle}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  block: {
    gap: 4,
  },
  blockHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: IOS_REGISTER.labelSecondary,
  },
  conditionsLine: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  flipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  flipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B25E09',
  },
  recordLine: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  noteLine: {
    fontSize: 13,
    fontStyle: 'italic',
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 18,
  },
  mutedLine: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
});

export default VenueMasterySheet;
