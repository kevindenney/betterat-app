/**
 * ReflectionSparkline — per-week reflection-density bar chart pinned
 * to the same x-axis as the capability bands above.
 *
 * Each bar = number of peer reflections that landed on a step from
 * that week. The lane is deliberately thin (28px tall) so it reads as
 * a *companion* to the bands, not a competing chart. A weeks-with-zero
 * bar is still drawn at min height (1px line) so the eye can see the
 * gap — that gap IS the signal.
 *
 * NOW indicator matches the bands above so the cross-lane scan reads:
 * "river above ↔ reflection density below" on a shared time axis.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

const NOW_COLOR = '#FF6B5A';
const NOW_BAND = 'rgba(255, 107, 90, 0.14)';
const BAR_COLOR = '#9D70C9'; // soft lilac, matches the LOGBOOK NOTICED accent
const BAR_EMPTY = 'rgba(60, 60, 67, 0.18)';

interface Props {
  density: { weekNumber: number; count: number }[];
  totalWeeks: number;
  currentWeekNumber: number;
  width: number;
  height?: number;
}

export function ReflectionSparkline({
  density,
  totalWeeks,
  currentWeekNumber,
  width,
  height = 28,
}: Props) {
  const padX = 12;
  const innerWidth = Math.max(0, width - padX * 2);
  const colWidth = totalWeeks > 0 ? innerWidth / totalWeeks : 0;
  const nowX = padX + (currentWeekNumber - 0.5) * colWidth;
  const nowBandWidth = Math.max(22, colWidth * 0.34);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const d of density) if (d.count > max) max = d.count;
    return max;
  }, [density]);

  if (width <= 0 || totalWeeks <= 0) {
    return <View style={[styles.host, { height }]} />;
  }

  const barMaxHeight = height - 4;
  // Cap the bar width so reflections read as thin "you paused here" ticks
  // rather than a competing bar chart — the design keeps them small and
  // quiet under the capability bands. Without the cap, a 4-week arc gives
  // each bar a fat column and the lane shouts louder than the river above.
  const barWidth = Math.min(5, Math.max(2, colWidth * 0.32));

  return (
    <View style={[styles.host, { height }]}>
      <Svg width={width} height={height}>
        {/* NOW band so the lane visually locks to the chart above. */}
        <Rect
          x={nowX - nowBandWidth / 2}
          y={0}
          width={nowBandWidth}
          height={height}
          fill={NOW_BAND}
        />
        <Line
          x1={nowX}
          x2={nowX}
          y1={0}
          y2={height}
          stroke={NOW_COLOR}
          strokeWidth={1}
          opacity={0.65}
        />

        {density.map((d) => {
          const cx = padX + (d.weekNumber - 0.5) * colWidth;
          const empty = d.count === 0;
          // Zero weeks still draw a 1px hairline so the gap is legible
          // ("you went quiet here"), not invisible.
          const barHeight = empty
            ? 1
            : Math.max(2, (d.count / Math.max(1, maxCount)) * barMaxHeight);
          return (
            <Rect
              key={`r-${d.weekNumber}`}
              x={cx - barWidth / 2}
              y={height - 2 - barHeight}
              width={barWidth}
              height={barHeight}
              fill={empty ? BAR_EMPTY : BAR_COLOR}
              opacity={empty ? 0.9 : 0.92}
              rx={1.5}
            />
          );
        })}

        {/* Baseline so empty rows still read as a line on the axis. */}
        <Line
          x1={padX}
          x2={padX + innerWidth}
          y1={height - 1.5}
          y2={height - 1.5}
          stroke={IOS_REGISTER.separator}
          strokeWidth={0.5}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    marginHorizontal: 0,
  },
});
