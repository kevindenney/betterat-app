/**
 * Peer journey chart (v3 — same-axis-with-river).
 *
 * Per-peer row of letter-coded dots pinned to the same time axis as
 * the CapabilityRiverChart above. The eye reads "river above ↔ fleet
 * below" on a shared x-axis: "this week" is one vertical line through
 * both charts.
 *
 * Each row is one peer:
 *   - Letter-coded circles (peer.initials char 0) at every week they
 *     appeared, tinted with the peer's color. Size scales modestly
 *     with that week's activity count.
 *   - A thin tinted hairline from first appearance → current week
 *     reads as the "still aboard" thread; dotted hairline before the
 *     first appearance reads as "not yet aboard".
 *   - Optional role text appears just to the left of the first dot.
 *   - NOW bar/band match the river above so the eye lines them up.
 *
 * Grouping (sailing personas in particular): when `peerSharedFleets`
 * is supplied, peers cluster under the fleet they share with the
 * viewer (e.g. "Etchells · RHKYC", "Dragons · RHKYC"). Peers with no
 * shared fleet land in an unlabeled "Other" group at the bottom.
 * When every peer is "Other" — which is what happens before any
 * fleet seed exists — we render the flat single-block layout with
 * no subheaders so nothing changes visually for those personas.
 */

import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { SeasonPeer } from './types';
import type { FleetRef } from '@/hooks/useViewerFleetCohort';

const NOW_COLOR = '#FF6B5A';
const NOW_BAND = 'rgba(255, 107, 90, 0.14)';
const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

const OTHER_KEY = '__other__';

interface PeerJourneyChartProps {
  peers: SeasonPeer[];
  totalWeeks: number;
  currentWeekNumber: number;
  width: number;
  /** Compact reduces row height + dot size for L4 lifetime view. */
  compact?: boolean;
  /** Show small italic-serif role text next to first appearance. */
  showRole?: boolean;
  /** Map of peer.id → fleets shared with the viewer. When non-empty
   *  for at least one peer, the chart renders one subheaded group per
   *  shared fleet (plus an unlabeled "Other" bucket). */
  peerSharedFleets?: Map<string, FleetRef[]>;
  /** Viewer's own active fleets, in declared order. Drives the group
   *  rendering order so the chart reads "your home fleet first". */
  viewerFleets?: FleetRef[];
}

export function PeerJourneyChart({
  peers,
  totalWeeks,
  currentWeekNumber,
  width,
  compact = false,
  showRole = true,
  peerSharedFleets,
  viewerFleets,
}: PeerJourneyChartProps) {
  const maxAppearanceCount = useMemo(() => {
    let max = 1;
    for (const p of peers) {
      for (const w of p.weeklyAppearances) {
        if (w.count > max) max = w.count;
      }
    }
    return max;
  }, [peers]);

  // Build group buckets — keyed by fleet id, with OTHER_KEY for
  // peers that share no fleet with the viewer. The viewer's own
  // fleet order wins; OTHER always renders last.
  const groups = useMemo(() => {
    const byKey = new Map<string, { fleet: FleetRef | null; peers: SeasonPeer[] }>();
    for (const peer of peers) {
      const shared = peerSharedFleets?.get(peer.id) ?? [];
      // A peer in multiple shared fleets renders in the first one
      // (viewer's declared order) — duplicating across groups would
      // double-count and noise the chart.
      const primary = shared[0] ?? null;
      const key = primary?.id ?? OTHER_KEY;
      const entry = byKey.get(key);
      if (entry) entry.peers.push(peer);
      else byKey.set(key, { fleet: primary, peers: [peer] });
    }
    const orderedKeys: string[] = [];
    if (viewerFleets) {
      for (const f of viewerFleets) {
        if (byKey.has(f.id)) orderedKeys.push(f.id);
      }
    } else {
      for (const key of byKey.keys()) {
        if (key !== OTHER_KEY) orderedKeys.push(key);
      }
    }
    if (byKey.has(OTHER_KEY)) orderedKeys.push(OTHER_KEY);
    return orderedKeys
      .map((k) => byKey.get(k))
      .filter(
        (g): g is { fleet: FleetRef | null; peers: SeasonPeer[] } => g !== undefined,
      );
  }, [peers, peerSharedFleets, viewerFleets]);

  if (peers.length === 0 || width <= 0) {
    return <View style={styles.empty} />;
  }

  // No named groups → flat render, no subheaders (visual parity with
  // the pre-grouping behavior so nothing regresses before fleet seed
  // exists).
  const isFlat = groups.length <= 1;

  if (isFlat) {
    return (
      <PeerJourneyChartBlock
        peers={peers}
        totalWeeks={totalWeeks}
        currentWeekNumber={currentWeekNumber}
        width={width}
        compact={compact}
        showRole={showRole}
        maxAppearanceCount={maxAppearanceCount}
      />
    );
  }

  return (
    <View style={{ width }}>
      {groups.map((g, idx) => {
        const isOther = g.fleet === null;
        return (
          <View
            key={g.fleet?.id ?? OTHER_KEY}
            style={idx > 0 ? styles.groupSpacer : undefined}
          >
            {isOther ? (
              groups.some((other) => other.fleet !== null) ? (
                <Text style={styles.groupHeaderOther}>Other</Text>
              ) : null
            ) : (
              <Text style={styles.groupHeader}>{g.fleet!.name}</Text>
            )}
            <PeerJourneyChartBlock
              peers={g.peers}
              totalWeeks={totalWeeks}
              currentWeekNumber={currentWeekNumber}
              width={width}
              compact={compact}
              showRole={showRole}
              maxAppearanceCount={maxAppearanceCount}
            />
          </View>
        );
      })}
    </View>
  );
}

interface BlockProps {
  peers: SeasonPeer[];
  totalWeeks: number;
  currentWeekNumber: number;
  width: number;
  compact: boolean;
  showRole: boolean;
  maxAppearanceCount: number;
}

function PeerJourneyChartBlock({
  peers,
  totalWeeks,
  currentWeekNumber,
  width,
  compact,
  showRole,
  maxAppearanceCount,
}: BlockProps) {
  // padX must match CapabilityRiverChart so the time axis lines up.
  const padX = 12;
  const rowHeight = compact ? 16 : 22;
  const rowGap = compact ? 2 : 4;
  const innerWidth = Math.max(0, width - padX * 2);
  const colWidth = totalWeeks > 0 ? innerWidth / totalWeeks : 0;
  const totalHeight = peers.length * rowHeight + Math.max(0, peers.length - 1) * rowGap;
  const nowX = padX + (currentWeekNumber - 0.5) * colWidth;
  const nowBandWidth = Math.max(22, colWidth * 0.34);

  if (peers.length === 0 || width <= 0) {
    return <View style={styles.empty} />;
  }

  return (
    <View style={[styles.wrap, { width, height: totalHeight }]}>
      <Svg width={width} height={totalHeight}>
        {/* NOW band — soft pill on the time axis, behind everything else. */}
        <Line
          x1={nowX - nowBandWidth / 2}
          x2={nowX - nowBandWidth / 2}
          y1={0}
          y2={totalHeight}
          stroke={NOW_BAND}
          strokeWidth={nowBandWidth}
          strokeLinecap="round"
        />

        {peers.map((peer, i) => {
          const rowY = i * (rowHeight + rowGap) + rowHeight / 2;
          const firstX = padX + (peer.firstWeek - 0.5) * colWidth;
          const dotRadius = compact ? 7 : 9;
          const letter = peer.initials.charAt(0).toUpperCase();
          const elems: React.ReactNode[] = [];

          // Pre-arrival dotted hairline from chart start to firstX.
          if (peer.firstWeek > 1) {
            elems.push(
              <Line
                key={`pre-${peer.id}`}
                x1={padX}
                x2={firstX}
                y1={rowY}
                y2={rowY}
                stroke={IOS_REGISTER.separator}
                strokeWidth={compact ? 0.6 : 0.8}
                strokeDasharray="2 3"
                opacity={compact ? 0.5 : 0.7}
              />,
            );
          }

          // Capability color encodes "what they shaped" — fall back to
          // identity color when the capability isn't known (free-form
          // suggestion, inbound suggestion whose source step we don't
          // have locally, untagged step).
          const dotColor = peer.capabilityColor ?? peer.color;

          // Solid hairline from firstX → current week so the "still aboard"
          // thread reads even when weekly dots are sparse.
          const endX = padX + Math.min(totalWeeks, currentWeekNumber) * colWidth;
          elems.push(
            <Line
              key={`line-${peer.id}`}
              x1={firstX}
              x2={endX}
              y1={rowY}
              y2={rowY}
              stroke={dotColor}
              strokeWidth={compact ? 0.8 : 1}
              opacity={compact ? 0.35 : 0.45}
            />,
          );

          // Letter-coded circle at each appearance week.
          for (const w of peer.weeklyAppearances) {
            if (w.count <= 0) continue;
            const cx = padX + (w.weekNumber - 0.5) * colWidth;
            const sizeBoost = (w.count - 1) / Math.max(1, maxAppearanceCount - 1);
            const radius = dotRadius + sizeBoost * (compact ? 1.2 : 1.6);
            elems.push(
              <Circle
                key={`dot-${peer.id}-${w.weekNumber}`}
                cx={cx}
                cy={rowY}
                r={radius}
                fill={dotColor}
                opacity={0.95}
              />,
            );
            elems.push(
              <SvgText
                key={`letter-${peer.id}-${w.weekNumber}`}
                x={cx}
                y={rowY + (compact ? 2.5 : 3)}
                fontSize={compact ? 8 : 9}
                fontWeight="700"
                fill="#FFFFFF"
                textAnchor="middle"
                letterSpacing={0.1}
              >
                {letter}
              </SvgText>,
            );
          }

          // Optional role text floating left of the first dot.
          if (showRole && peer.role) {
            const roleX = firstX - dotRadius - 4;
            if (roleX > padX + 4) {
              elems.push(
                <SvgText
                  key={`role-${peer.id}`}
                  x={roleX}
                  y={rowY + (compact ? 2.5 : 3)}
                  fontSize={compact ? 8.5 : 9.5}
                  fontFamily={SERIF_FAMILY}
                  fontStyle="italic"
                  fill={IOS_REGISTER.labelTertiary}
                  textAnchor="end"
                >
                  {peer.role}
                </SvgText>,
              );
            }
          }

          return <React.Fragment key={`row-${peer.id}`}>{elems}</React.Fragment>;
        })}

        {/* NOW bar — same x as the river above */}
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
  groupHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 4,
  },
  groupHeaderOther: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 4,
  },
  groupSpacer: {
    marginTop: 12,
  },
});
