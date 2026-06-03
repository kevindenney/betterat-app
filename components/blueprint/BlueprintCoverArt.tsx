/**
 * BlueprintCoverArt — generated cover motif for blueprint cards.
 *
 * Covers used to be a flat author-tone color block. This overlays a subtle,
 * interest-keyed line motif (sailing → wind/wave lines, nursing → ECG pulse,
 * running → topo contours, fibre crafts → weave hatch, default → dot grid) so
 * every plan gets a distinctive cover with zero per-author asset work. It sits
 * on top of the tone fill the caller already paints and behind any cover title.
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

type Motif = 'waves' | 'pulse' | 'topo' | 'weave' | 'dots';

const W = 300;
const H = 140;
const STROKE = '#FFFFFF';

const SLUG_MOTIF: Record<string, Motif> = {
  'sail-racing': 'waves',
  sailing: 'waves',
  nursing: 'pulse',
  medicine: 'pulse',
  marathon: 'topo',
  running: 'topo',
  knitting: 'weave',
  crochet: 'weave',
};

function motifFor(slug?: string | null): Motif {
  if (!slug) return 'dots';
  const direct = SLUG_MOTIF[slug];
  if (direct) return direct;
  if (/sail|regatta|boat|yacht|row|kayak|surf/.test(slug)) return 'waves';
  if (/nurs|health|med|clinic|care|emt|pharm/.test(slug)) return 'pulse';
  if (/run|marathon|cycl|tri|hike|climb|ski|trail/.test(slug)) return 'topo';
  if (/knit|crochet|weav|sew|yarn|quilt|fibre|fiber/.test(slug)) return 'weave';
  return 'dots';
}

function sinePath(baseY: number, amp: number, wavelength: number, phase: number): string {
  let d = '';
  for (let x = 0; x <= W; x += 8) {
    const y = baseY + amp * Math.sin((x / wavelength) * Math.PI * 2 + phase);
    d += (x === 0 ? 'M' : ' L') + x + ',' + y.toFixed(1);
  }
  return d;
}

function ecgPath(): string {
  let d = `M0,${H / 2}`;
  for (let i = 0; i < 3; i++) {
    const x = i * 100;
    d += ` L${x + 34},${H / 2} L${x + 44},${H / 2 - 16} L${x + 54},${H / 2 + 30}`;
    d += ` L${x + 62},${H / 2 - 40} L${x + 72},${H / 2} L${x + 100},${H / 2}`;
  }
  return d;
}

function renderMotif(motif: Motif): React.ReactNode {
  switch (motif) {
    case 'waves':
      return [20, 50, 80, 110].map((baseY, i) => (
        <Path
          key={i}
          d={sinePath(baseY, 9, 150, i * 0.9)}
          stroke={STROKE}
          strokeWidth={2}
          strokeOpacity={0.16}
          fill="none"
        />
      ));
    case 'pulse':
      return (
        <Path d={ecgPath()} stroke={STROKE} strokeWidth={2.5} strokeOpacity={0.2} fill="none" />
      );
    case 'topo':
      return [34, 70, 106, 142, 178].map((r, i) => (
        <Circle
          key={i}
          cx={W - 20}
          cy={H}
          r={r}
          stroke={STROKE}
          strokeWidth={2}
          strokeOpacity={0.14}
          fill="none"
        />
      ));
    case 'weave': {
      const lines: React.ReactNode[] = [];
      for (let i = -H; i < W; i += 26) {
        lines.push(
          <Line key={`a${i}`} x1={i} y1={0} x2={i + H} y2={H} stroke={STROKE} strokeWidth={1.5} strokeOpacity={0.12} />,
        );
        lines.push(
          <Line key={`b${i}`} x1={i} y1={H} x2={i + H} y2={0} stroke={STROKE} strokeWidth={1.5} strokeOpacity={0.12} />,
        );
      }
      return lines;
    }
    case 'dots':
    default: {
      const dots: React.ReactNode[] = [];
      for (let y = 14; y < H; y += 26) {
        for (let x = 14; x < W; x += 26) {
          dots.push(<Circle key={`${x}-${y}`} cx={x} cy={y} r={2} fill={STROKE} fillOpacity={0.16} />);
        }
      }
      return dots;
    }
  }
}

interface BlueprintCoverArtProps {
  slug?: string | null;
  style?: StyleProp<ViewStyle>;
}

export function BlueprintCoverArt({ slug, style }: BlueprintCoverArtProps) {
  const motif = motifFor(slug);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {renderMotif(motif)}
      </Svg>
    </View>
  );
}
