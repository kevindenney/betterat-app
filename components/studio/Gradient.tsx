/**
 * Gradient — thin wrapper over expo-linear-gradient so Studio surfaces can
 * render real linear gradients instead of approximating them with a base
 * color + opacity overlay (the original Phase 2/3/5 covers).
 *
 * The Studio + Discover cover gradients use a consistent 160° angle to
 * match the design canonical, which renders as start={[0, 0]}, end={[1, 1]}
 * with a slight horizontal lift — close enough that the eye reads it as
 * "the gradient direction in the design."
 */

import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ViewStyle, StyleProp } from 'react-native';

export interface GradientProps {
  colors: [string, string] | string[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  angleDegrees?: number;            // defaults to 160° to match cover design
}

function angleToVec(deg: number): { start: [number, number]; end: [number, number] } {
  // expo-linear-gradient takes start/end as 0..1 normalized vectors.
  // 0° = top→bottom; 90° = left→right; 180° = bottom→top; 270° = right→left.
  // Convert clockwise CSS-style degree to start + end.
  const rad = ((deg - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  // Normalize so the gradient spans the bounding box; use 0.5 ± component.
  return {
    start: [0.5 - dx / 2, 0.5 - dy / 2],
    end: [0.5 + dx / 2, 0.5 + dy / 2],
  };
}

export function Gradient({ colors, style, children, angleDegrees = 160 }: GradientProps) {
  const { start, end } = angleToVec(angleDegrees);
  return (
    <LinearGradient
      colors={colors as [string, string, ...string[]]}
      start={{ x: start[0], y: start[1] }}
      end={{ x: end[0], y: end[1] }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
