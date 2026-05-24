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
import { StyleSheet, Text, View, Platform } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type {
  SeasonReflection,
  WeeklyCapabilityMix,
} from './types';

const NOW_COLOR = '#FF6B5A';
const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

interface CapabilityRiverChartProps {
  weeklyCapabilities: WeeklyCapabilityMix[];
  /** 1-based — drives the NOW bar position. */
  currentWeekNumber: number;
  totalWeeks: number;
  reflections?: SeasonReflection[];
  height?: number;
  /** Chart width — comes from the surrounding layout. */
  width: number;
}

export function CapabilityRiverChart({
  weeklyCapabilities,
  currentWeekNumber,
  totalWeeks,
  reflections = [],
  height = 120,
  width,
}: CapabilityRiverChartProps) {
  const padX = 12;
  const padTopForNow = 14;
  const padBottomForTicks = 20;
  const innerWidth = Math.max(0, width - padX * 2);
  const innerHeight = Math.max(0, height - padTopForNow - padBottomForTicks);
  const colWidth = totalWeeks > 0 ? innerWidth / totalWeeks : 0;

  // Compute max volume across weeks so we can scale to chart height.
  const maxVolume = useMemo(() => {
    let max = 0;
    for (const w of weeklyCapabilities) {
      const total = w.bands.reduce((s, b) => s + b.volume, 0);
      if (total > max) max = total;
    }
    return max || 1;
  }, [weeklyCapabilities]);

  // Pre-compute each band's rect for the SVG.
  const bandRects = useMemo(() => {
    const out: { x: number; y: number; w: number; h: number; color: string; key: string }[] = [];
    for (const w of weeklyCapabilities) {
      const colX = padX + (w.weekNumber - 1) * colWidth;
      let stackY = padTopForNow + innerHeight;
      for (let i = 0; i < w.bands.length; i++) {
        const band = w.bands[i];
        const h = (band.volume / maxVolume) * innerHeight;
        stackY -= h;
        out.push({
          x: colX + 0.5,
          y: stackY,
          w: Math.max(0, colWidth - 1),
          h,
          color: band.capabilityColor,
          key: `${w.weekNumber}-${i}-${band.capabilityColor}`,
        });
      }
    }
    return out;
  }, [weeklyCapabilities, colWidth, innerHeight, maxVolume, padX, padTopForNow]);

  const nowX = padX + (currentWeekNumber - 0.5) * colWidth;

  // Tick marks: every ~4 weeks + week 1 + last.
  const tickWeeks = useMemo(() => {
    const ticks = new Set<number>([1]);
    if (totalWeeks > 0) ticks.add(totalWeeks);
    for (let w = 4; w < totalWeeks; w += 4) ticks.add(w);
    ticks.add(currentWeekNumber);
    return Array.from(ticks).sort((a, b) => a - b);
  }, [totalWeeks, currentWeekNumber]);

  if (width <= 0 || weeklyCapabilities.length === 0) {
    return <View style={[styles.empty, { width, height }]} />;
  }

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        {/* Bands */}
        {bandRects.map((b) => (
          <Rect
            key={b.key}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={b.color}
            opacity={0.86}
            rx={1.5}
          />
        ))}

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
        <SvgText
          x={nowX}
          y={padTopForNow - 6}
          fontSize={9}
          fontWeight="700"
          fill={NOW_COLOR}
          textAnchor="middle"
        >
          NOW
        </SvgText>

        {/* Week tick labels */}
        {tickWeeks.map((wk) => {
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
              wk {wk}
            </SvgText>
          );
        })}
      </Svg>

      {/* Inline reflection quotes — absolutely positioned over the chart
          so they read as italic-serif annotations on the river. */}
      {reflections.map((r) => {
        const leftPct = totalWeeks > 0 ? ((r.weekNumber - 0.5) / totalWeeks) : 0;
        const left = padX + leftPct * innerWidth;
        // Keep the quote inside the chart bounds — clamp so it doesn't
        // overflow the right edge for late-season reflections.
        const maxQuoteWidth = 160;
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
                top: padTopForNow + innerHeight - 28,
                width: maxQuoteWidth,
              },
            ]}
          >
            <Text
              style={[
                styles.quote,
                r.capabilityColor ? { color: r.capabilityColor } : null,
              ]}
              numberOfLines={1}
            >
              &ldquo;{r.quote}&rdquo;
            </Text>
          </View>
        );
      })}
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
});
