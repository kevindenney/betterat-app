/**
 * CapabilityMix — the Tufte rebuild of the L3 capability chart.
 *
 * Replaces the serpentine "river" with an honest stacked-area chart:
 *   - X = week, Y = step count (zero baseline).
 *   - Each capability is one continuous stream stacked from the bottom.
 *   - In-band labels: the capability name is written *inside* its band
 *     at its widest week, in a darkened variant of the band color. No
 *     separate legend row underneath — the band labels itself.
 *   - Sparkline-style chrome: hairline x-axis, first/last/current week
 *     ticks only, no gridlines.
 *   - NOW: thin orange vertical rule + small "NOW" label above the chart.
 *
 * Drops the "river" framing entirely. The chart's job is "what mix of
 * capabilities did you practice each week" and the geometry tells that
 * story directly without metaphor.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { SeasonReflection, WeeklyCapabilityMix } from './types';

const NOW_COLOR = '#FF6B5A';
const AXIS_COLOR = 'rgba(0, 0, 0, 0.12)';
const MIN_LABEL_WIDTH_PX = 32;
const MIN_LABEL_HEIGHT_PX = 11;

export interface CapabilityMixMarker {
  id: string;
  /** 1-based week the marker pins to. */
  weekNumber: number;
  /** Short label written inline next to the glyph. */
  label: string;
  /** Color tint for the glyph stroke; defaults to gold. */
  color?: string;
}

interface CapabilityMixProps {
  weeklyCapabilities: WeeklyCapabilityMix[];
  /** 1-based current week — drives the NOW rule. */
  currentWeekNumber: number;
  totalWeeks: number;
  width: number;
  height?: number;
  reflections?: SeasonReflection[];
  markers?: CapabilityMixMarker[];
  /** Optional tap on a band — opens a deeper view for that capability. */
  onCapabilityPress?: (
    capabilityId: string,
    capabilityLabel: string,
    capabilityColor: string,
  ) => void;
  /**
   * Override the tick label for the x-axis. L3 defaults to "wk N";
   * L4 passes a function that returns the session label ("Winter '26",
   * "Fall '24") for each unit.
   */
  unitLabel?: (n: number) => string;
}

interface ResolvedBand {
  id: string;
  label: string;
  color: string;
  /** max(planned, proven) per week — drives stack layout + label placement. */
  perWeek: number[];
  /** Planned volume per week (capability_goals from the Plan tab). */
  perWeekPlanned: number[];
  /** Proven volume per week (confirmed step_capability_evidence from Reflect). */
  perWeekProven: number[];
}

/**
 * Rendering unit for one band's contribution in one week. We emit BOTH
 * a ghost rect (planned, faint outline) and a solid rect (proven,
 * saturated fill). When proven > planned, ghostHeight = 0 and the
 * solid extends to the full cell. When planned > proven, the solid
 * sits at the bottom and the ghost fills the remaining gap above —
 * "you planned X, proved Y, the gap is the rest."
 */
interface StackedRect {
  bandId: string;
  bandColor: string;
  bandLabel: string;
  x: number;
  /** Bottom y of the cell (solid fill bottom). */
  yBottom: number;
  w: number;
  /** Full cell height = scale(max(planned, proven)). */
  cellHeight: number;
  /** Solid (proven) fill height; from yBottom up. */
  solidHeight: number;
  /** Ghost (gap above solid) height; from solid top up to cell top. */
  ghostHeight: number;
}

interface LabelPlacement {
  bandId: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

export function CapabilityMix({
  weeklyCapabilities,
  currentWeekNumber,
  totalWeeks,
  width,
  height = 168,
  markers = [],
  onCapabilityPress,
  unitLabel = (n) => `wk ${n}`,
}: CapabilityMixProps) {
  const padX = 12;
  // Top zone holds the NOW pill + marker labels; bottom holds the
  // sparse week-tick axis. The chart body is everything in between.
  const padTop = 22;
  const padBottom = 18;
  const innerWidth = Math.max(0, width - padX * 2);
  const innerHeight = Math.max(0, height - padTop - padBottom);
  const colWidth = totalWeeks > 0 ? innerWidth / totalWeeks : 0;

  // Resolve all capabilities present anywhere in the season. Each band
  // tracks planned + proven volumes separately so the chart can show
  // "intent vs evidence" as ghost outline + solid fill in the same
  // cell. `perWeek` carries max(planned, proven) for layout/labelling.
  const bands: ResolvedBand[] = useMemo(() => {
    const map = new Map<string, ResolvedBand>();
    weeklyCapabilities.forEach((w) => {
      for (const b of w.bands) {
        const id = b.capabilityId ?? b.capabilityColor;
        if (!map.has(id)) {
          map.set(id, {
            id,
            label: b.capabilityLabel ?? '',
            color: b.capabilityColor,
            perWeek: new Array(totalWeeks).fill(0),
            perWeekPlanned: new Array(totalWeeks).fill(0),
            perWeekProven: new Array(totalWeeks).fill(0),
          });
        }
      }
    });
    weeklyCapabilities.forEach((w) => {
      const idx = w.weekNumber - 1;
      if (idx < 0 || idx >= totalWeeks) return;
      for (const b of w.bands) {
        const id = b.capabilityId ?? b.capabilityColor;
        const band = map.get(id);
        if (!band) continue;
        const planned = b.plannedVolume ?? b.volume ?? 0;
        const proven = b.provenVolume ?? 0;
        band.perWeekPlanned[idx] = (band.perWeekPlanned[idx] ?? 0) + planned;
        band.perWeekProven[idx] = (band.perWeekProven[idx] ?? 0) + proven;
        band.perWeek[idx] = Math.max(
          band.perWeekPlanned[idx]!,
          band.perWeekProven[idx]!,
        );
      }
    });
    // Largest-total streams render at the bottom so the eye reads
    // the dominant story first. Ties broken by label for stability.
    return Array.from(map.values()).sort((a, b) => {
      const aTotal = a.perWeek.reduce((s, v) => s + v, 0);
      const bTotal = b.perWeek.reduce((s, v) => s + v, 0);
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.label.localeCompare(b.label);
    });
  }, [weeklyCapabilities, totalWeeks]);

  // Per-week total volume drives the y-scale.
  const maxStack = useMemo(() => {
    let max = 0;
    for (let i = 0; i < totalWeeks; i++) {
      let stack = 0;
      for (const band of bands) stack += band.perWeek[i] ?? 0;
      if (stack > max) max = stack;
    }
    return max || 1;
  }, [bands, totalWeeks]);

  // Build rendering rects. Each cell carries cellHeight (= max planned
  // proven), solidHeight (proven), and ghostHeight (planned-proven
  // gap above the solid, when planned > proven).
  const rects: StackedRect[] = useMemo(() => {
    const out: StackedRect[] = [];
    const scale = (v: number) => (v / maxStack) * innerHeight;
    for (let i = 0; i < totalWeeks; i++) {
      let yCursor = padTop + innerHeight;
      for (const band of bands) {
        const planned = band.perWeekPlanned[i] ?? 0;
        const proven = band.perWeekProven[i] ?? 0;
        const cellVol = Math.max(planned, proven);
        if (cellVol <= 0) continue;
        const cellH = scale(cellVol);
        const solidH = scale(proven);
        const ghostH = Math.max(0, cellH - solidH);
        const yBottom = yCursor;
        yCursor -= cellH;
        out.push({
          bandId: band.id,
          bandColor: band.color,
          bandLabel: band.label,
          x: padX + i * colWidth + 0.5,
          yBottom,
          w: Math.max(0, colWidth - 1),
          cellHeight: cellH,
          solidHeight: solidH,
          ghostHeight: ghostH,
        });
      }
    }
    return out;
  }, [bands, totalWeeks, padX, padTop, innerHeight, colWidth, maxStack]);

  // Place a label inside each band at the band's widest run. The
  // widest run is the longest contiguous stretch of consecutive weeks
  // with non-zero volume; we center the label on that stretch and
  // pick the mid-week's vertical band-center. Labels skip if the run
  // is too narrow or too short to read.
  const labels: LabelPlacement[] = useMemo(() => {
    const placements: LabelPlacement[] = [];
    bands.forEach((band) => {
      // Find longest non-zero run.
      let bestStart = -1;
      let bestEnd = -1;
      let curStart = -1;
      for (let i = 0; i <= totalWeeks; i++) {
        const v = i < totalWeeks ? (band.perWeek[i] ?? 0) : 0;
        if (v > 0 && curStart < 0) curStart = i;
        if ((v <= 0 || i === totalWeeks) && curStart >= 0) {
          const len = i - curStart;
          if (len > bestEnd - bestStart) {
            bestStart = curStart;
            bestEnd = i; // exclusive
          }
          curStart = -1;
        }
      }
      if (bestStart < 0) return;
      const runWidth = (bestEnd - bestStart) * colWidth;
      if (runWidth < MIN_LABEL_WIDTH_PX) return;

      // Center week of the run.
      const midIdx = Math.floor((bestStart + bestEnd - 1) / 2);

      // For that week, compute the vertical center of this band by
      // walking the stack — bands above this one push it lower.
      let stackTopOffset = 0;
      for (const other of bands) {
        if (other.id === band.id) break;
        stackTopOffset += other.perWeek[midIdx] ?? 0;
      }
      const thisVol = band.perWeek[midIdx] ?? 0;
      const localScale = (v: number) => (v / maxStack) * innerHeight;
      const bandTopY = padTop + innerHeight - localScale(stackTopOffset + thisVol);
      const bandHeight = localScale(thisVol);
      if (bandHeight < MIN_LABEL_HEIGHT_PX) return;

      placements.push({
        bandId: band.id,
        text: band.label || '·',
        x: padX + (midIdx + 0.5) * colWidth,
        y: bandTopY + bandHeight / 2 + 3.5, // +3.5 for visual baseline center
        color: darkenHex(band.color, 0.32),
      });
    });
    return placements;
  }, [bands, totalWeeks, padX, padTop, innerHeight, colWidth, maxStack]);

  // Sparkline-style x-axis ticks: only first, current, and last.
  const tickWeeks = useMemo(() => {
    const ticks = new Set<number>([1]);
    if (totalWeeks > 0) ticks.add(totalWeeks);
    ticks.add(currentWeekNumber);
    return Array.from(ticks).sort((a, b) => a - b);
  }, [totalWeeks, currentWeekNumber]);

  const nowX = padX + (currentWeekNumber - 0.5) * colWidth;
  const axisY = padTop + innerHeight + 0.5;

  if (width <= 0 || bands.length === 0 || totalWeeks <= 0) {
    return <View style={[styles.empty, { width, height }]} />;
  }

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        {/* Stacked-area bands rendered with dual encoding:
            - Ghost rect (faint fill) covers the planned portion above
              the solid — "what you set out to develop"
            - Solid rect (saturated fill) covers the proven portion at
              the bottom of the cell — "what you actually demonstrated"
            Where the ghost is gone (planned == proven == cellHeight)
            the band is fully solid = perfect alignment. Where the
            solid is short = unfulfilled plan. */}
        {rects.map((r) => {
          const solidY = r.yBottom - r.solidHeight;
          const ghostY = solidY - r.ghostHeight;
          return (
            <React.Fragment key={`${r.bandId}-${r.x}`}>
              {r.ghostHeight > 0 ? (
                <Rect
                  x={r.x}
                  y={ghostY}
                  width={r.w}
                  height={r.ghostHeight}
                  fill={r.bandColor}
                  opacity={0.22}
                />
              ) : null}
              {r.solidHeight > 0 ? (
                <Rect
                  x={r.x}
                  y={solidY}
                  width={r.w}
                  height={r.solidHeight}
                  fill={r.bandColor}
                  opacity={0.95}
                />
              ) : null}
            </React.Fragment>
          );
        })}

        {/* Single hairline x-axis at the baseline. */}
        <Line
          x1={padX}
          x2={padX + innerWidth}
          y1={axisY}
          y2={axisY}
          stroke={AXIS_COLOR}
          strokeWidth={StyleSheet.hairlineWidth}
        />

        {/* NOW indicator — thin orange rule + small label above. */}
        <Line
          x1={nowX}
          x2={nowX}
          y1={padTop - 4}
          y2={padTop + innerHeight + 4}
          stroke={NOW_COLOR}
          strokeWidth={1}
          opacity={0.85}
        />
        <SvgText
          x={nowX}
          y={padTop - 8}
          fontSize={9}
          fontWeight="700"
          fill={NOW_COLOR}
          textAnchor="middle"
          letterSpacing={0.4}
        >
          NOW
        </SvgText>

        {/* Week ticks under the axis. */}
        {tickWeeks.map((wk) => {
          const x = padX + (wk - 0.5) * colWidth;
          const isNow = wk === currentWeekNumber;
          return (
            <SvgText
              key={`tick-${wk}`}
              x={x}
              y={height - 4}
              fontSize={9}
              fill={isNow ? NOW_COLOR : IOS_REGISTER.labelTertiary}
              textAnchor="middle"
              fontWeight={isNow ? '700' : '400'}
            >
              {unitLabel(wk)}
            </SvgText>
          );
        })}

        {/* In-band labels. Each capability names itself in its band. */}
        {labels.map((l) => (
          <SvgText
            key={`label-${l.bandId}`}
            x={l.x}
            y={l.y}
            fontSize={11}
            fontWeight="600"
            fill={l.color}
            textAnchor="middle"
          >
            {l.text}
          </SvgText>
        ))}

        {/* Trophy / event markers — inline with the chart top, label to
            the right of the glyph rather than a separate floating row. */}
        {markers.map((m) => {
          const x = padX + (m.weekNumber - 0.5) * colWidth;
          const stroke = m.color ?? '#C99632';
          return (
            <React.Fragment key={`marker-${m.id}`}>
              <Path
                d={`M ${x - 4} ${padTop - 14} L ${x + 4} ${padTop - 14} L ${x + 4} ${padTop - 6} L ${x - 4} ${padTop - 6} Z`}
                fill={withAlpha(stroke, 0.2)}
                stroke={stroke}
                strokeWidth={0.8}
              />
              <SvgText
                x={x + 7}
                y={padTop - 7}
                fontSize={9}
                fontWeight="600"
                fill={stroke}
              >
                {m.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Invisible press targets per band. Each target is the band's
          stacked-area bounding box (not the full chart height), so two
          bands stacked at the same week have non-overlapping touch
          areas and the user can tap whichever band their finger is on.
          Previously every target was full innerHeight, so the last-
          rendered band swallowed every tap. */}
      {onCapabilityPress
        ? (() => {
            const bounds = new Map<
              string,
              { xMin: number; xMax: number; yMin: number; yMax: number }
            >();
            for (const r of rects) {
              const yTop = r.yBottom - r.cellHeight;
              const b = bounds.get(r.bandId);
              if (b) {
                if (r.x < b.xMin) b.xMin = r.x;
                if (r.x + r.w > b.xMax) b.xMax = r.x + r.w;
                if (yTop < b.yMin) b.yMin = yTop;
                if (r.yBottom > b.yMax) b.yMax = r.yBottom;
              } else {
                bounds.set(r.bandId, {
                  xMin: r.x,
                  xMax: r.x + r.w,
                  yMin: yTop,
                  yMax: r.yBottom,
                });
              }
            }
            return bands.map((band) => {
              const b = bounds.get(band.id);
              if (!b) return null;
              return (
                <Pressable
                  key={`tap-${band.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${band.label}`}
                  onPress={() => onCapabilityPress(band.id, band.label, band.color)}
                  style={({ pressed }) => [
                    styles.tapTarget,
                    {
                      left: b.xMin,
                      top: b.yMin,
                      width: Math.max(8, b.xMax - b.xMin),
                      height: Math.max(8, b.yMax - b.yMin),
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                />
              );
            });
          })()
        : null}
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
  tapTarget: {
    position: 'absolute',
  },
});

function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1]!, 16);
  const g = parseInt(m[2]!, 16);
  const b = parseInt(m[3]!, 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenHex(hex: string, amount: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const k = 1 - Math.max(0, Math.min(1, amount));
  const r = Math.round(parseInt(m[1]!, 16) * k);
  const g = Math.round(parseInt(m[2]!, 16) * k);
  const b = Math.round(parseInt(m[3]!, 16) * k);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

