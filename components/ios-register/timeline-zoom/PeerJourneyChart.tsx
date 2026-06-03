/**
 * Peer journey chart (v3 — same-axis-with-river).
 *
 * Per-peer row of letter-coded dots pinned to the same time axis as
 * the CapabilityMix chart above. The eye reads "capabilities above ↔
 * fleet below" on a shared x-axis: "this week" is one vertical line
 * through both charts.
 *
 * Each row is one peer:
 *   - One avatar circle at their first appearance — same two-letter
 *     initials + identity color as the WHO SHAPED IT pill, so a person
 *     reads as one token across the lane and the pills. Size scales
 *     modestly with total contribution.
 *   - A thin hairline from first appearance → current week reads as the
 *     "still aboard" thread, tinted with the *capability* color so the
 *     thread says what they shaped while the dot says who. Dotted hairline
 *     before the first appearance reads as "not yet aboard". The active
 *     (tapped) peer's thread brightens + gets a halo ring so a pill tap
 *     visibly lights up the matching thread.
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
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { SeasonPeer } from './types';
import type { FleetRef } from '@/hooks/useViewerFleetCohort';

const NOW_COLOR = '#FF6B5A';
const NOW_BAND = 'rgba(255, 107, 90, 0.14)';

const OTHER_KEY = '__other__';

interface PeerJourneyChartProps {
  peers: SeasonPeer[];
  totalWeeks: number;
  currentWeekNumber: number;
  width: number;
  /** Compact reduces row height + dot size for L4 lifetime view. */
  compact?: boolean;
  /** Render the per-peer name·role legend below the chart. Off when a
   *  WHO SHAPED IT pill row already legends the chart (avoids listing the
   *  same people twice); the dots stay self-identifying via their initials. */
  showLegend?: boolean;
  /** Map of peer.id → fleets shared with the viewer. When non-empty
   *  for at least one peer, the chart renders one subheaded group per
   *  shared fleet (plus an unlabeled "Other" bucket). */
  peerSharedFleets?: Map<string, FleetRef[]>;
  /** Viewer's own active fleets, in declared order. Drives the group
   *  rendering order so the chart reads "your home fleet first". */
  viewerFleets?: FleetRef[];
  /**
   * When set, the chart isolates this peer: their row + legend entry
   * keep full saturation while every other peer dims to a context wash.
   * Mirrors CapabilityMix's isolatedCapabilityId so tapping a WHO SHAPED
   * IT pill lights up that person's thread in the spine.
   */
  isolatedPeerId?: string | null;
}

export function PeerJourneyChart({
  peers,
  totalWeeks,
  currentWeekNumber,
  width,
  compact = false,
  showLegend = true,
  peerSharedFleets,
  viewerFleets,
  isolatedPeerId = null,
}: PeerJourneyChartProps) {
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
        showLegend={showLegend}
        isolatedPeerId={isolatedPeerId}
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
              showLegend={showLegend}
              isolatedPeerId={isolatedPeerId}
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
  showLegend: boolean;
  isolatedPeerId: string | null;
}

function PeerJourneyChartBlock({
  peers,
  totalWeeks,
  currentWeekNumber,
  width,
  compact,
  showLegend,
  isolatedPeerId,
}: BlockProps) {
  // padX must match CapabilityMix so the time axis lines up.
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
    <View style={[styles.wrap, { width }]}>
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
          const dimmed = isolatedPeerId !== null && peer.id !== isolatedPeerId;
          const isActive = isolatedPeerId === peer.id;
          const rowY = i * (rowHeight + rowGap) + rowHeight / 2;
          const firstX = padX + (peer.firstWeek - 0.5) * colWidth;
          const dotRadius = compact ? 7 : 9;
          // Same two-letter token as the WHO SHAPED IT pill avatar so the
          // eye reads "M" in the lane and "MT · Markus Tham" in the pill as
          // one person, not two.
          const initials = peer.initials.slice(0, 2).toUpperCase();
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

          // Avatar = identity (stable per peer) so the dot matches the
          // WHO SHAPED IT pill exactly. The thread carries the capability
          // color, so "who" (dot) and "what they shaped" (line) read as
          // two separate signals instead of collapsing into one hue.
          const identityColor = peer.color;
          const threadColor = peer.capabilityColor ?? peer.color;

          // Solid hairline from firstX → current week so the "still aboard"
          // thread reads even when weekly dots are sparse. The active peer's
          // thread brightens + thickens so a pill tap visibly lights it up.
          const endX = padX + Math.min(totalWeeks, currentWeekNumber) * colWidth;
          elems.push(
            <Line
              key={`line-${peer.id}`}
              x1={firstX}
              x2={endX}
              y1={rowY}
              y2={rowY}
              stroke={threadColor}
              strokeWidth={isActive ? (compact ? 1.8 : 2.2) : compact ? 0.8 : 1}
              opacity={isActive ? 0.95 : compact ? 0.35 : 0.45}
            />,
          );

          // First-dot-only — a single letter-coded circle at the peer's
          // first appearance, sized up modestly with total contribution.
          // Drawing a dot at every appearance week piled letters along the
          // row and forced the role text to float into the middle of the
          // lane; one dot + the still-aboard hairline + the legend below
          // reads far calmer and answers "who shaped this, and when did
          // they first show up" without the clutter.
          const totalCount = peer.weeklyAppearances.reduce(
            (n, w) => n + (w.count > 0 ? w.count : 0),
            0,
          );
          const sizeBoost = Math.min(1, (totalCount - 1) / 4);
          const radius = dotRadius + sizeBoost * (compact ? 1.2 : 1.6);
          // Halo ring on the active peer — the "you tapped this thread" cue.
          if (isActive) {
            elems.push(
              <Circle
                key={`halo-${peer.id}`}
                cx={firstX}
                cy={rowY}
                r={radius + 3}
                fill="none"
                stroke={identityColor}
                strokeWidth={1.5}
                opacity={0.5}
              />,
            );
          }
          elems.push(
            <Circle
              key={`dot-${peer.id}`}
              cx={firstX}
              cy={rowY}
              r={radius}
              fill={identityColor}
              opacity={0.95}
            />,
          );
          elems.push(
            <SvgText
              key={`letter-${peer.id}`}
              x={firstX}
              y={rowY + (compact ? 2.5 : 3)}
              fontSize={initials.length > 1 ? (compact ? 7 : 8) : compact ? 8 : 9}
              fontWeight="700"
              fill="#FFFFFF"
              textAnchor="middle"
              letterSpacing={0.1}
            >
              {initials}
            </SvgText>,
          );

          return (
            <G key={`row-${peer.id}`} opacity={dimmed ? 0.18 : 1}>
              {elems}
            </G>
          );
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

      {/* Legend — answers "who is each lettered dot." Suppressed when a
          WHO SHAPED IT pill row sits below the chart and already names
          everyone. Letter swatch matches the dot above; name + role read
          like a logbook key. */}
      {showLegend ? (
        <View style={styles.legend}>
          {peers.map((peer) => {
            const displayName = peer.name?.trim() || `Peer ${peer.initials}`;
            const dimmed = isolatedPeerId !== null && peer.id !== isolatedPeerId;
            return (
              <View
                key={`legend-${peer.id}`}
                style={[styles.legendItem, dimmed && styles.legendItemDimmed]}
              >
                <View
                  style={[styles.legendSwatch, { backgroundColor: peer.color }]}
                >
                  <Text style={styles.legendSwatchText}>
                    {peer.initials.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.legendName} numberOfLines={1}>
                  {displayName}
                </Text>
                {peer.role ? (
                  <Text style={styles.legendRole} numberOfLines={1}>
                    {peer.role}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendItemDimmed: {
    opacity: 0.3,
  },
  legendSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendSwatchText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  legendName: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  legendRole: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
    fontStyle: 'italic',
  },
});
