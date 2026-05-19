import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { BecomingArcData } from '@/services/BecomingArcService';

export interface BecomingHeroProps
  extends Pick<
    BecomingArcData,
    | 'startedAt'
    | 'evidencePoints'
    | 'settledRanges'
    | 'nowAt'
    | 'bezierPath'
    | 'settledWashPath'
    | 'plotPoints'
    | 'settledMarkers'
    | 'nowPoint'
    | 'yearTicks'
  > {
  interestName: string;
  capabilityCount: number;
  evidenceCount: number;
  pathsSettledCount: number;
  onPress?: () => void;
}

export function BecomingHero({
  interestName,
  startedAt,
  evidencePoints,
  settledRanges,
  bezierPath,
  settledWashPath,
  plotPoints,
  settledMarkers,
  nowPoint,
  yearTicks,
  evidenceCount,
  pathsSettledCount,
  onPress,
}: BecomingHeroProps) {
  const yearsInInterest = yearCountFrom(startedAt);
  const title = `${yearsInInterest} year${yearsInInterest === 1 ? '' : 's'} in ${interestName}`;
  const empty = evidencePoints.length === 0;

  const body = (
    <View style={styles.card}>
      <View style={styles.eyebrowRow}>
        <View style={styles.sparkle}>
          <Ionicons name="sparkles" size={10} color="#7C3AED" />
        </View>
        <Text style={styles.eyebrow}>Profile of Becoming</Text>
      </View>
      <Text style={styles.title}>
        {title.split(interestName)[0]}
        <Text style={styles.titleEmphasis}>{interestName}</Text>
      </Text>
      <Text style={styles.lede}>
        {empty
          ? 'Your line starts the first time you settle a step.'
          : 'Your capability line is drawn from every confirmed evidence point across the active interest.'}
      </Text>

      <View style={styles.canvasWrap}>
        <Svg width="100%" height={132} viewBox="0 0 320 120">
          <Line
            x1="4"
            y1="100"
            x2="316"
            y2="100"
            stroke="#D9D2C6"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {settledWashPath ? (
            <Path d={settledWashPath} fill="rgba(52, 199, 89, 0.10)" />
          ) : null}
          <Path
            d={bezierPath}
            fill="none"
            stroke={empty ? '#D9D2C6' : '#8B7355'}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={empty ? '3 3' : undefined}
          />

          {plotPoints.map((point) => (
            <Circle
              key={`${point.capabilityId}-${point.capturedAt}`}
              cx={point.x}
              cy={point.y}
              r={point.strength === 'strong' ? 2.6 : 2.4}
              fill="#7C3AED"
            />
          ))}

          {settledMarkers.map((marker) => (
            <Circle
              key={`${marker.pathName}-${marker.capturedAt}`}
              cx={marker.x}
              cy={marker.y}
              r="2.8"
              fill="#34C759"
            />
          ))}

          <Circle cx={nowPoint.x} cy={nowPoint.y} r="6" fill="rgba(0, 122, 255, 0.12)" />
          <Circle cx={nowPoint.x} cy={nowPoint.y} r="3.2" fill="#007AFF" />

          {yearTicks.map((tick) => (
            <React.Fragment key={tick.label}>
              <Line
                x1={tick.x}
                x2={tick.x}
                y1="100"
                y2="106"
                stroke="#B8A88F"
                strokeWidth="1"
              />
              <SvgText
                x={tick.x}
                y="118"
                fontSize="8"
                fill="#8A8478"
                textAnchor="middle"
              >
                {tick.label}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      </View>

      <View style={styles.legend}>
        <LegendDot color="#7C3AED" label={`Evidence · ${evidenceCount}`} />
        <LegendDot color="#34C759" label={`Paths settled · ${pathsSettledCount}`} />
        <LegendDot color="#007AFF" label="Active" />
      </View>

      {!empty && settledRanges.length > 0 ? (
        <Text style={styles.foot}>
          {settledRanges.length} settled path{settledRanges.length === 1 ? '' : 's'} are shaded into the line.
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.pressable}>
      {body}
    </Pressable>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function yearCountFrom(startedAt: string) {
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return 1;
  const now = new Date();
  return Math.max(
    1,
    Math.round((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFF9F1',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139, 115, 85, 0.18)',
    gap: 10,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sparkle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.10)',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: '#7C3AED',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    color: IOS_REGISTER.label,
    letterSpacing: -0.5,
  },
  titleEmphasis: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  lede: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.labelSecondary,
  },
  canvasWrap: {
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
  foot: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
  },
});
