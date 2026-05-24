/**
 * Peer journey chart (L3 · Screen 09 · companion to CapabilityRiverChart).
 *
 * Parallel time axis below the capability river. Each row is one peer who
 * appeared this season:
 *   - Avatar bubble on the left with initials.
 *   - Horizontal line starting at their first week, dotted before that
 *     "appeared" point.
 *   - Per-week dots scaled by activity count (thicker = more shared steps
 *     that week). When a peer has no activity in a week the line dips to
 *     a hairline.
 *   - NOW bar at the current week, same x as the river above so the eye
 *     reads "this week" consistently.
 *   - Role label ("coach", "bow crew") as a small italic line under the
 *     name on hover/state — for v1 we just print it under the initials.
 *
 * The data shape comes from SeasonAnalysis.peers — first/repeat weeks +
 * counts. We don't render names in v1 because the canonical screenshot
 * just shows initials + role; full identity lives one tap deeper.
 */

import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { SeasonPeer } from './types';

const NOW_COLOR = '#FF6B5A';
const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

interface PeerJourneyChartProps {
  peers: SeasonPeer[];
  totalWeeks: number;
  currentWeekNumber: number;
  width: number;
}

const AVATAR_COL_WIDTH = 56;
const ROW_HEIGHT = 24;
const ROW_GAP = 6;

export function PeerJourneyChart({
  peers,
  totalWeeks,
  currentWeekNumber,
  width,
}: PeerJourneyChartProps) {
  const padX = 12;
  const innerWidth = Math.max(0, width - padX * 2 - AVATAR_COL_WIDTH);
  const colWidth = totalWeeks > 0 ? innerWidth / totalWeeks : 0;
  const chartLeft = padX + AVATAR_COL_WIDTH;
  const totalHeight = peers.length * ROW_HEIGHT + Math.max(0, peers.length - 1) * ROW_GAP;
  const nowX = chartLeft + (currentWeekNumber - 0.5) * colWidth;

  const maxAppearanceCount = useMemo(() => {
    let max = 1;
    for (const p of peers) {
      for (const w of p.weeklyAppearances) {
        if (w.count > max) max = w.count;
      }
    }
    return max;
  }, [peers]);

  if (peers.length === 0 || width <= 0) {
    return <View style={styles.empty} />;
  }

  return (
    <View style={[styles.wrap, { width, height: totalHeight }]}>
      {/* Avatar column — sits over the SVG so it can use real Text. */}
      <View style={[styles.avatarCol, { width: AVATAR_COL_WIDTH }]}>
        {peers.map((peer, i) => (
          <View
            key={peer.id}
            style={[
              styles.avatarRow,
              {
                top: i * (ROW_HEIGHT + ROW_GAP),
                height: ROW_HEIGHT,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: peer.color }]}>
              <Text style={styles.avatarText}>{peer.initials}</Text>
            </View>
            {peer.role ? (
              <Text style={styles.role} numberOfLines={1}>
                {peer.role}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <Svg width={width} height={totalHeight} style={styles.svg}>
        {peers.map((peer, i) => {
          const rowY = i * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
          const firstX = chartLeft + (peer.firstWeek - 0.5) * colWidth;
          // Pre-arrival dotted hairline from chartLeft to firstX.
          const elems: React.ReactNode[] = [];
          if (peer.firstWeek > 1) {
            elems.push(
              <Line
                key={`pre-${peer.id}`}
                x1={chartLeft}
                x2={firstX}
                y1={rowY}
                y2={rowY}
                stroke={IOS_REGISTER.separator}
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.7}
              />,
            );
          }
          // Solid line from firstX → right edge of chart (current week + a
          // little so the "ongoing" reads visually).
          const endX = chartLeft + Math.min(totalWeeks, currentWeekNumber) * colWidth;
          elems.push(
            <Line
              key={`line-${peer.id}`}
              x1={firstX}
              x2={endX}
              y1={rowY}
              y2={rowY}
              stroke={peer.color}
              strokeWidth={1.2}
              opacity={0.55}
            />,
          );
          // Per-week dots, sized by activity count.
          for (const w of peer.weeklyAppearances) {
            if (w.count <= 0) continue;
            const cx = chartLeft + (w.weekNumber - 0.5) * colWidth;
            const radius = 2 + (w.count / maxAppearanceCount) * 3.5;
            elems.push(
              <Circle
                key={`dot-${peer.id}-${w.weekNumber}`}
                cx={cx}
                cy={rowY}
                r={radius}
                fill={peer.color}
                opacity={0.95}
              />,
            );
          }
          return <React.Fragment key={`row-${peer.id}`}>{elems}</React.Fragment>;
        })}

        {/* NOW bar — same x as the river chart above */}
        <Line
          x1={nowX}
          x2={nowX}
          y1={-2}
          y2={totalHeight + 2}
          stroke={NOW_COLOR}
          strokeWidth={1.5}
          opacity={0.85}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  empty: {
    backgroundColor: 'transparent',
  },
  avatarCol: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    zIndex: 2,
  },
  avatarRow: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  role: {
    fontSize: 9.5,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
    fontFamily: SERIF_FAMILY,
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
