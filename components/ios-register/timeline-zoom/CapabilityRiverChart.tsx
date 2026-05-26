/**
 * Capability river chart (L3 · Screen 09 · VERB: REFLECTING ON NOW).
 *
 * Stacked area chart, one column per week of the season. The bands stack
 * vertically: each band's height = step count for that capability in that
 * week, color = capability color. The whole stack reads as a "river" of
 * practice volume that bends toward whatever the user worked on each week.
 *
 * Decorations:
 *   - NOW bar: vertical orange-pink rule at the current week, with a small
 *     "NOW" label at the top. Same grammar as L2's NOW bar so the user
 *     reads the chart on the same time axis.
 *   - Week tick eyebrow row (wk 1 / wk 4 / wk 7 etc.) under the chart so
 *     reflection captions land on a known x position.
 *   - Inline reflection quotes (italic-serif), each pinned to its week
 *     with a soft underline that ties down to the bottom of its band.
 *
 * The chart is render-only — no gestures, no tooltips. L3 surrounds it
 * with the librarian prompt + the compact week list for drill-in.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import Svg, { Path, Rect, Line, Text as SvgText } from 'react-native-svg';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type {
  SeasonPhase,
  SeasonReflection,
  WeeklyCapabilityMix,
} from './types';

const NOW_COLOR = '#FF6B5A';
const NOW_BAND = 'rgba(255, 107, 90, 0.14)';
const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

/**
 * Optional trophy / milestone marker pinned above the river at a given
 * unit (week for L3, session for L4). v1 renders trophies as a small
 * gold flag glyph above the band + a one-line label below.
 */
export interface RiverChartMarker {
  id: string;
  /** 1-based — same coordinate space as WeeklyCapabilityMix.weekNumber
      (or the lifetime sessionIndex when reused by L4). */
  unit: number;
  kind: 'trophy';
  label: string;
  /** Tint for the glyph stroke. Defaults to gold. */
  capabilityColor?: string;
}

interface CapabilityRiverChartProps {
  weeklyCapabilities: WeeklyCapabilityMix[];
  /** 1-based — drives the NOW bar position. */
  currentWeekNumber: number;
  totalWeeks: number;
  reflections?: SeasonReflection[];
  /** Trophy / milestone markers above the river. */
  markers?: RiverChartMarker[];
  /**
   * Named segments of the season rendered as labels under the river.
   * When provided in flow mode, each phase's color overrides the
   * per-week capability color so the river reads as a story of
   * named phases instead of an undecoded gradient.
   */
  phases?: SeasonPhase[];
  /**
   * When true, the wk-N axis moves to a small eyebrow row above the
   * river so the phase labels can own the bottom edge. Defaults to
   * true when `phases` is provided.
   */
  weekAxisOnTop?: boolean;
  /**
   * Render the NOW indicator as two stacked pills (eyebrow + pill on
   * the chart) instead of a single inline label. Matches the v3 design.
   */
  nowDoublePill?: boolean;
  height?: number;
  /** Chart width — comes from the surrounding layout. */
  width: number;
  /**
   * Override the under-chart tick labels. Defaults to "wk N" — L4 passes
   * a function that returns the session label ("Fall '24", etc).
   */
  tickLabel?: (unit: number) => string;
  /** Stride between ticks. Defaults to 4 (every fourth week). */
  tickEveryN?: number;
  /** Override the NOW label above the orange bar. */
  nowLabel?: string;
  /** L4 lifetime view can suppress the bottom tick row and rely on the top axis. */
  showBottomTicks?: boolean;
  /** Optional per-column horizontal overlap to soften the "brick" feel. */
  columnBleed?: number;
  /** Override the per-band corner radius. */
  bandRadius?: number;
  /** Override the fill opacity used for the capability bands. */
  bandOpacity?: number;
  /** Lifetime view uses calmer, below-the-river annotations instead of L3's in-chart notes. */
  annotationMode?: 'season' | 'lifetime';
  /** Lifetime view can render a continuous river instead of discrete blocks. */
  shapeMode?: 'columns' | 'flow';
  /**
   * Tap handler for phase labels under the river. When set, an invisible
   * press target overlays each phase's bottom-label region so the user
   * can jump to the corresponding range in the BROWSE WEEKS list.
   */
  onPhasePress?: (phase: SeasonPhase) => void;
}

interface RiverRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  key: string;
}

interface FlowPath {
  key: string;
  color: string;
  path: string;
}

export function CapabilityRiverChart({
  weeklyCapabilities,
  currentWeekNumber,
  totalWeeks,
  reflections = [],
  markers = [],
  phases,
  weekAxisOnTop,
  nowDoublePill = false,
  height = 120,
  width,
  tickLabel = (n) => `wk ${n}`,
  tickEveryN = 4,
  nowLabel = 'NOW',
  showBottomTicks = true,
  columnBleed = 0,
  bandRadius = 1.5,
  bandOpacity = 0.86,
  annotationMode = 'season',
  shapeMode = 'columns',
  onPhasePress,
}: CapabilityRiverChartProps) {
  const hasPhases = !!phases && phases.length > 0;
  const phaseAxisOnBottom = hasPhases && showBottomTicks;
  // When phases own the bottom edge, week ticks float in a small eyebrow above the river.
  const resolvedWeekAxisOnTop = weekAxisOnTop ?? phaseAxisOnBottom;
  const padX = 12;
  // Top zone layout (top → bottom): top-week-axis · NOW indicator · river.
  // Markers (trophies) overlay the river itself so they don't need their own band.
  const padNowIndicator = nowDoublePill ? 32 : 14;
  const padWeekAxisTop = resolvedWeekAxisOnTop ? 14 : 0;
  const padTopForNow = padNowIndicator + padWeekAxisTop;
  const padBottomForPhases = phaseAxisOnBottom ? 22 : 0;
  const padBottomForTicks = (showBottomTicks && !phaseAxisOnBottom ? 20 : 0) + padBottomForPhases;
  const innerWidth = Math.max(0, width - padX * 2);
  const innerHeight = Math.max(0, height - padTopForNow - padBottomForTicks);
  const colWidth = totalWeeks > 0 ? innerWidth / totalWeeks : 0;

  // Phase color lookup keyed by weekNumber so the flow-mode renderer
  // can paint each stretch with its phase color (the "what does this
  // color mean" decoder is the label written under that stretch).
  const phaseColorByWeek = useMemo(() => {
    if (!hasPhases) return null;
    const map = new Map<number, string>();
    for (const phase of phases!) {
      for (let w = phase.startWeek; w <= phase.endWeek; w++) {
        map.set(w, phase.color);
      }
    }
    return map;
  }, [hasPhases, phases]);

  // Compute max volume across weeks so we can scale to chart height.
  const maxVolume = useMemo(() => {
    let max = 0;
    for (const w of weeklyCapabilities) {
      const total = w.bands.reduce((s, b) => s + b.volume, 0);
      if (total > max) max = total;
    }
    return max || 1;
  }, [weeklyCapabilities]);

  // Pre-compute each band's rect for the SVG. When phases are provided
  // they override the per-band capability color so the whole week-column
  // reads as the phase the user actually named.
  const bandRects = useMemo<RiverRect[]>(() => {
    const out: RiverRect[] = [];
    for (const w of weeklyCapabilities) {
      const colX = padX + (w.weekNumber - 1) * colWidth;
      let stackY = padTopForNow + innerHeight;
      const phaseColor = phaseColorByWeek?.get(w.weekNumber);
      for (let i = 0; i < w.bands.length; i++) {
        const band = w.bands[i];
        const h = (band.volume / maxVolume) * innerHeight;
        stackY -= h;
        const isFirst = w.weekNumber === 1;
        const isLast = w.weekNumber === totalWeeks;
        const bleedLeft = isFirst ? 0 : columnBleed / 2;
        const bleedRight = isLast ? 0 : columnBleed / 2;
        const fill = phaseColor ?? band.capabilityColor;
        out.push({
          x: colX + 0.5 - bleedLeft,
          y: stackY,
          w: Math.max(0, colWidth - 1 + bleedLeft + bleedRight),
          h,
          color: fill,
          key: `${w.weekNumber}-${i}-${fill}`,
        });
      }
    }
    return out;
  }, [
    weeklyCapabilities,
    colWidth,
    innerHeight,
    maxVolume,
    padX,
    padTopForNow,
    totalWeeks,
    columnBleed,
    phaseColorByWeek,
  ]);

  const lifetimeFlowPaths = useMemo<FlowPath[]>(() => {
    if (shapeMode !== 'flow' || weeklyCapabilities.length === 0) return [];
    const baseCenterY = padTopForNow + innerHeight * 0.58;
    const thicknessScale = innerHeight * 0.78;
    // Minimum thickness floor — the river never reads as anorexic / "data
    // ends". Low-volume weeks taper visually but stay readable as a band.
    const minThicknessRatio = 0.18;
    const scaledThickness = (volume: number) => {
      const ratio = Math.max(minThicknessRatio, Math.max(1, volume) / maxVolume);
      return ratio * thicknessScale;
    };
    return weeklyCapabilities.map((unit, idx) => {
      const prev = weeklyCapabilities[idx - 1] ?? unit;
      const next = weeklyCapabilities[idx + 1] ?? unit;
      const total = unit.bands.reduce((s, b) => s + b.volume, 0);
      const prevTotal = prev.bands.reduce((s, b) => s + b.volume, 0);
      const nextTotal = next.bands.reduce((s, b) => s + b.volume, 0);
      const currentThickness = scaledThickness(total);
      const prevThickness = scaledThickness(prevTotal);
      const nextThickness = scaledThickness(nextTotal);
      const centerX = padX + (unit.weekNumber - 0.5) * colWidth;
      const prevCenterX = padX + ((prev.weekNumber ?? unit.weekNumber) - 0.5) * colWidth;
      const nextCenterX = padX + ((next.weekNumber ?? unit.weekNumber) - 0.5) * colWidth;
      const leftEdge = idx === 0 ? padX : (prevCenterX + centerX) / 2;
      const rightEdge = idx === weeklyCapabilities.length - 1 ? padX + innerWidth : (centerX + nextCenterX) / 2;

      const positionRatio =
        weeklyCapabilities.length <= 1 ? 0.5 : idx / (weeklyCapabilities.length - 1);
      const centerTravel = (positionRatio - 0.5) * innerHeight * 0.1;
      const volumeTravel = (0.5 - Math.max(1, total) / maxVolume) * innerHeight * 0.08;
      const centerY = baseCenterY + centerTravel + volumeTravel;

      const prevPositionRatio =
        weeklyCapabilities.length <= 1 ? 0.5 : Math.max(0, idx - 1) / (weeklyCapabilities.length - 1);
      const prevCenterTravel = (prevPositionRatio - 0.5) * innerHeight * 0.1;
      const prevVolumeTravel = (0.5 - Math.max(1, prevTotal) / maxVolume) * innerHeight * 0.08;
      const prevCenterY = baseCenterY + prevCenterTravel + prevVolumeTravel;

      const nextPositionRatio =
        weeklyCapabilities.length <= 1 ? 0.5 : Math.min(weeklyCapabilities.length - 1, idx + 1) / (weeklyCapabilities.length - 1);
      const nextCenterTravel = (nextPositionRatio - 0.5) * innerHeight * 0.1;
      const nextVolumeTravel = (0.5 - Math.max(1, nextTotal) / maxVolume) * innerHeight * 0.08;
      const nextCenterY = baseCenterY + nextCenterTravel + nextVolumeTravel;

      const leftThickness = idx === 0 ? currentThickness : (prevThickness + currentThickness) / 2;
      const rightThickness =
        idx === weeklyCapabilities.length - 1 ? currentThickness : (currentThickness + nextThickness) / 2;

      const leftCenterY = idx === 0 ? centerY : (prevCenterY + centerY) / 2;
      const rightCenterY =
        idx === weeklyCapabilities.length - 1 ? centerY : (centerY + nextCenterY) / 2;

      const leftTop = leftCenterY - leftThickness / 2;
      const top = centerY - currentThickness / 2;
      const rightTop = rightCenterY - rightThickness / 2;
      const leftBottom = leftCenterY + leftThickness / 2;
      const bottom = centerY + currentThickness / 2;
      const rightBottom = rightCenterY + rightThickness / 2;

      const cpInset = Math.max(10, (rightEdge - leftEdge) * 0.26);
      const path = [
        `M ${leftEdge} ${leftTop}`,
        `C ${leftEdge + cpInset} ${leftTop}, ${centerX - cpInset} ${top}, ${centerX} ${top}`,
        `C ${centerX + cpInset} ${top}, ${rightEdge - cpInset} ${rightTop}, ${rightEdge} ${rightTop}`,
        `L ${rightEdge} ${rightBottom}`,
        `C ${rightEdge - cpInset} ${rightBottom}, ${centerX + cpInset} ${bottom}, ${centerX} ${bottom}`,
        `C ${centerX - cpInset} ${bottom}, ${leftEdge + cpInset} ${leftBottom}, ${leftEdge} ${leftBottom}`,
        'Z',
      ].join(' ');

      const phaseColor = phaseColorByWeek?.get(unit.weekNumber);
      const color =
        phaseColor ?? unit.bands[0]?.capabilityColor ?? IOS_REGISTER.accentUserAction;
      return {
        key: `${unit.weekNumber}-${color}`,
        color,
        path,
      };
    });
  }, [
    shapeMode,
    weeklyCapabilities,
    padTopForNow,
    innerHeight,
    maxVolume,
    padX,
    colWidth,
    innerWidth,
    phaseColorByWeek,
  ]);

  const nowX = padX + (currentWeekNumber - 0.5) * colWidth;
  const nowBandWidth = Math.max(22, colWidth * 0.34);
  // When NOW sits within ~24px of either chart edge, the double-pill
  // label clamps inward so it stays fully visible above the river. The
  // NOW bar still drops at the true week position; only the label x
  // shifts.
  const pillHalfWidth = 17;
  const pillLabelX = Math.min(
    Math.max(nowX, padX + pillHalfWidth + 2),
    padX + innerWidth - pillHalfWidth - 2,
  );

  // Tick marks: every tickEveryN units + first + last + current.
  const tickWeeks = useMemo(() => {
    const ticks = new Set<number>([1]);
    if (totalWeeks > 0) ticks.add(totalWeeks);
    for (let w = tickEveryN; w < totalWeeks; w += tickEveryN) ticks.add(w);
    ticks.add(currentWeekNumber);
    return Array.from(ticks).sort((a, b) => a - b);
  }, [totalWeeks, currentWeekNumber, tickEveryN]);

  if (width <= 0 || weeklyCapabilities.length === 0) {
    return <View style={[styles.empty, { width, height }]} />;
  }

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        {/* Bands */}
        {shapeMode === 'flow'
          ? lifetimeFlowPaths.map((b) => (
              <Path
                key={b.key}
                d={b.path}
                fill={b.color}
                opacity={bandOpacity}
              />
            ))
          : bandRects.map((b) => (
              <Rect
                key={b.key}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill={b.color}
                opacity={bandOpacity}
                rx={bandRadius}
              />
            ))}

        {/* NOW band */}
        <Rect
          x={nowX - nowBandWidth / 2}
          y={padTopForNow - 4}
          width={nowBandWidth}
          height={innerHeight + 12}
          rx={nowBandWidth / 2}
          fill={NOW_BAND}
        />

        {/* NOW bar */}
        <Line
          x1={nowX}
          x2={nowX}
          y1={padTopForNow - 4}
          y2={padTopForNow + innerHeight + 4}
          stroke={NOW_COLOR}
          strokeWidth={1.5}
          opacity={0.85}
        />

        {nowDoublePill ? (
          <React.Fragment>
            {/* Connector hairline from clamped label down to the true NOW x. */}
            {pillLabelX !== nowX ? (
              <Line
                x1={pillLabelX}
                x2={nowX}
                y1={padTopForNow - 2}
                y2={padTopForNow}
                stroke={NOW_COLOR}
                strokeWidth={1}
                opacity={0.7}
              />
            ) : null}
            <Rect
              x={pillLabelX - pillHalfWidth}
              y={padTopForNow - 32}
              width={pillHalfWidth * 2}
              height={14}
              rx={7}
              fill={NOW_COLOR}
            />
            <SvgText
              x={pillLabelX}
              y={padTopForNow - 22}
              fontSize={8.5}
              fontWeight="700"
              fill="#FFFFFF"
              textAnchor="middle"
              letterSpacing={0.4}
            >
              {nowLabel}
            </SvgText>
            <Rect
              x={pillLabelX - pillHalfWidth}
              y={padTopForNow - 16}
              width={pillHalfWidth * 2}
              height={14}
              rx={7}
              fill={NOW_COLOR}
            />
            <SvgText
              x={pillLabelX}
              y={padTopForNow - 6}
              fontSize={8.5}
              fontWeight="700"
              fill="#FFFFFF"
              textAnchor="middle"
              letterSpacing={0.4}
            >
              {nowLabel}
            </SvgText>
          </React.Fragment>
        ) : (
          <SvgText
            x={nowX}
            y={padTopForNow - 6}
            fontSize={9}
            fontWeight="700"
            fill={NOW_COLOR}
            textAnchor="middle"
          >
            {nowLabel}
          </SvgText>
        )}

        {/* Markers (trophies) — small flag icon pinned over the river at the marker week.
            The icon sits on the band itself rather than floating above so it reads as
            part of the river, the way the v3 mockup draws it. */}
        {markers.map((m) => {
          const x = padX + (m.unit - 0.5) * colWidth;
          const stroke = m.capabilityColor ?? '#C99632';
          // Pin the badge just above the top of the river so it overlaps the band.
          const y = padTopForNow - 2;
          return (
            <React.Fragment key={`marker-${m.id}`}>
              <Rect
                x={x - 10}
                y={y - 9}
                width={20}
                height={20}
                rx={6}
                fill="rgba(255,255,255,0.92)"
                stroke={withAlpha(stroke, 0.32)}
                strokeWidth={0.8}
              />
              <SvgText x={x} y={y + 4} fontSize={11} fill={stroke} textAnchor="middle">
                ★
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Week tick labels — bottom when no phases, top when phases own the bottom edge. */}
        {showBottomTicks && !phaseAxisOnBottom
          ? tickWeeks.map((wk) => {
              const x = padX + (wk - 0.5) * colWidth;
              return (
                <SvgText
                  key={`tick-${wk}`}
                  x={x}
                  y={height - 6}
                  fontSize={9}
                  fill={IOS_REGISTER.labelTertiary}
                  textAnchor="middle"
                >
                  {tickLabel(wk)}
                </SvgText>
              );
            })
          : null}
        {resolvedWeekAxisOnTop
          ? tickWeeks.map((wk) => {
              const x = padX + (wk - 0.5) * colWidth;
              const isCurrent = wk === currentWeekNumber;
              if (isCurrent) return null;
              // Sit week ticks in the eyebrow row just above the NOW indicator zone.
              const eyebrowY = padTopForNow - padNowIndicator - 2;
              return (
                <SvgText
                  key={`tick-top-${wk}`}
                  x={x}
                  y={eyebrowY}
                  fontSize={9}
                  fontStyle="italic"
                  fill={IOS_REGISTER.labelTertiary}
                  textAnchor="middle"
                >
                  {tickLabel(wk)}
                </SvgText>
              );
            })
          : null}

        {/* Phase labels under the river — these are the "what the color means" decoder.
            Phases that don't contain NOW are dimmed harder so the eye reads
            "where we are now" first and "where we've been / will be" second. */}
        {phaseAxisOnBottom
          ? phases!.map((phase) => {
              const midWeek = (phase.startWeek + phase.endWeek) / 2;
              const x = padX + (midWeek - 0.5) * colWidth;
              const containsNow =
                currentWeekNumber >= phase.startWeek && currentWeekNumber <= phase.endWeek;
              const startX = padX + (phase.startWeek - 1) * colWidth;
              const endX = padX + phase.endWeek * colWidth;
              const phasePixelWidth = endX - startX;
              const ruleY = padTopForNow + innerHeight + 3;
              // Truncate the label when its rendered width would overrun
              // the phase's slot. The ~5.5px-per-char heuristic suits the
              // 9.5pt label font; under that budget we drop characters
              // from the right and tack on a single trailing ellipsis.
              // The in-frame (containsNow) phase is exempt — it's the
              // one label the user most needs to read, so we let it
              // overflow into adjacent slots rather than hide its name.
              const charBudget = Math.max(3, Math.floor((phasePixelWidth - 4) / 5.5));
              const displayLabel =
                containsNow || phase.label.length <= charBudget
                  ? phase.label
                  : `${phase.label.slice(0, Math.max(1, charBudget - 1))}…`;
              return (
                <React.Fragment key={`phase-${phase.id}`}>
                  <Line
                    x1={startX + 1}
                    x2={endX - 1}
                    y1={ruleY}
                    y2={ruleY}
                    stroke={phase.color}
                    strokeWidth={containsNow ? 1.5 : 1}
                    opacity={containsNow ? 0.85 : 0.18}
                  />
                  <SvgText
                    x={x}
                    y={ruleY + 13}
                    fontSize={9.5}
                    fontWeight={containsNow ? '700' : '500'}
                    // Dimmed phases keep their phase color at low opacity
                    // (instead of going gray) so the eye can still link a
                    // label back to the colored band above the rule.
                    // Dimmed labels use a darkened phase color at moderate
                    // opacity. Pre-darkening preserves chroma when opacity
                    // drops, so "Practice" reads as a saturated dim green
                    // instead of washing out to gray on the light background.
                    fill={containsNow ? phase.color : darkenHex(phase.color, 0.22)}
                    textAnchor="middle"
                    opacity={containsNow ? 1 : 0.7}
                  >
                    {displayLabel}
                  </SvgText>
                </React.Fragment>
              );
            })
          : null}

        {annotationMode === 'lifetime'
          ? reflections.map((r) => {
              const x = padX + (r.weekNumber - 0.5) * colWidth;
              return (
                <Line
                  key={`reflection-anchor-${r.id}`}
                  x1={x}
                  x2={x}
                  y1={padTopForNow + innerHeight - 4}
                  y2={padTopForNow + innerHeight + 9}
                  stroke={r.capabilityColor ?? IOS_REGISTER.separator}
                  strokeWidth={1}
                  opacity={0.45}
                />
              );
            })
          : null}
      </Svg>

      {/* Inline reflection quotes — absolutely positioned over the chart
          so they read as italic-serif annotations on the river. */}
      {reflections.map((r) => {
        const leftPct = totalWeeks > 0 ? ((r.weekNumber - 0.5) / totalWeeks) : 0;
        const left = padX + leftPct * innerWidth;
        // Keep the quote inside the chart bounds — clamp so it doesn't
        // overflow the right edge for late-season reflections.
        const maxQuoteWidth = annotationMode === 'lifetime' ? 132 : 160;
        const clampedLeft = Math.min(
          Math.max(0, left - maxQuoteWidth / 2),
          width - maxQuoteWidth - padX,
        );
        return (
          <View
            key={r.id}
            pointerEvents="none"
            style={[
              styles.quoteWrap,
              {
                left: clampedLeft,
                top:
                  annotationMode === 'lifetime'
                    ? padTopForNow + innerHeight + 2
                    : padTopForNow + innerHeight - 28,
                width: maxQuoteWidth,
              },
            ]}
          >
            <Text
              style={[
                styles.quote,
                annotationMode === 'lifetime' && styles.quoteLifetime,
                r.capabilityColor ? { color: r.capabilityColor } : null,
              ]}
              numberOfLines={annotationMode === 'lifetime' ? 2 : 1}
            >
              &ldquo;{r.quote}&rdquo;
            </Text>
          </View>
        );
      })}

      {/* Phase press targets — absolutely positioned over the bottom phase
          label band so the user can tap any phase to jump to that range
          in the BROWSE WEEKS list. Rendered only when a press handler is
          supplied so static views (L4) stay non-interactive. */}
      {phaseAxisOnBottom && onPhasePress
        ? phases!.map((phase) => {
            const startX = padX + (phase.startWeek - 1) * colWidth;
            const phaseWidth = (phase.endWeek - phase.startWeek + 1) * colWidth;
            const top = padTopForNow + innerHeight + 3;
            const targetHeight = Math.max(16, padBottomForPhases - 3);
            return (
              <Pressable
                key={`phase-press-${phase.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${phase.label}`}
                onPress={() => onPhasePress(phase)}
                style={({ pressed }) => [
                  styles.phaseTarget,
                  {
                    left: startX,
                    top,
                    width: phaseWidth,
                    height: targetHeight,
                    opacity: pressed ? 0.5 : 1,
                  },
                ]}
              />
            );
          })
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
  phaseTarget: {
    position: 'absolute',
  },
  quoteWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  quote: {
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
    fontSize: 11,
    color: IOS_REGISTER.label,
    textAlign: 'center',
    backgroundColor: 'rgba(248, 245, 237, 0.94)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  quoteLifetime: {
    fontSize: 10,
    lineHeight: 12,
    backgroundColor: 'rgba(248, 245, 237, 0.86)',
    paddingHorizontal: 3,
  },
});

function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Multiply a hex color toward black by `amount` (0..1). Used to keep
 * chroma when rendering a color at lower opacity on a light background.
 */
function darkenHex(hex: string, amount: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const k = 1 - Math.max(0, Math.min(1, amount));
  const r = Math.round(parseInt(m[1], 16) * k);
  const g = Math.round(parseInt(m[2], 16) * k);
  const b = Math.round(parseInt(m[3], 16) * k);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
