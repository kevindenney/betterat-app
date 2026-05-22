/**
 * AtlasPins — pin atoms for the canonical Atlas surface.
 *
 * Pins are absolute-positioned overlays on top of an SVG map backdrop.
 * Each kind carries a different visual treatment matching the design's
 * pin grammar:
 *   you            — bright red filled circle, larger
 *   crew           — saturated red, medium
 *   fleet          — dark grey, medium (the broad sailing peer set)
 *   following      — dim grey, smaller (international or out-of-fleet)
 *   race-mark      — orange ring, small (course geometry only at z14+)
 *   sim            — purple, JH sim-suite specific
 *   jh-site        — white circle with purple JH badge
 *   osm-clinic     — white circle with hospital glyph (cold-mode)
 *   candidate      — large red drop-pin (commit-mode candidate)
 *   own            — own past step pin
 *
 * Coordinates are passed as left/top percentages so the same pin grammar
 * works regardless of frame container width.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

export type PinKind =
  | 'you'
  | 'crew'
  | 'fleet'
  | 'following'
  | 'race-mark'
  | 'sim'
  | 'jh-site'
  | 'osm-clinic'
  | 'candidate'
  | 'own';

export interface PinProps {
  kind: PinKind;
  leftPct: number;
  topPct: number;
  label?: string;
  sublabel?: string;
  badge?: string;
  selected?: boolean;
  onPress?: () => void;
}

const PIN_TONE: Record<PinKind, { dot: string; ring?: string; size: number }> = {
  you: { dot: '#FF3B30', ring: 'rgba(255, 59, 48, 0.20)', size: 14 },
  crew: { dot: '#FF3B30', size: 11 },
  fleet: { dot: 'rgba(40, 50, 70, 0.78)', size: 10 },
  following: { dot: 'rgba(60, 70, 90, 0.45)', size: 8 },
  'race-mark': { dot: '#E07A3C', size: 8 },
  sim: { dot: '#AF52DE', size: 12 },
  'jh-site': { dot: '#FFFFFF', ring: 'rgba(120, 100, 180, 0.40)', size: 16 },
  'osm-clinic': { dot: '#FFFFFF', ring: 'rgba(60, 60, 67, 0.35)', size: 14 },
  candidate: { dot: '#FF3B30', size: 22 },
  own: { dot: 'rgba(0, 122, 255, 0.85)', size: 10 },
};

export function AtlasPin({
  kind,
  leftPct,
  topPct,
  label,
  sublabel,
  badge,
  selected,
  onPress,
}: PinProps) {
  const tone = PIN_TONE[kind];

  if (kind === 'candidate') {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.absPin,
          {
            left: `${leftPct}%`,
            top: `${topPct}%`,
            marginLeft: -14,
            marginTop: -34,
          },
        ]}
      >
        <Ionicons name="location-sharp" size={34} color={tone.dot} />
      </View>
    );
  }

  if (kind === 'jh-site') {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.absPin, pinAt(leftPct, topPct, tone.size)]}
      >
        <View style={[styles.siteCircle, { borderColor: tone.ring }]}>
          <Ionicons name="medical" size={9} color="rgba(60, 60, 67, 0.62)" />
        </View>
        {badge ? (
          <View style={styles.jhBadge}>
            <Text style={styles.jhBadgeText}>{badge}</Text>
          </View>
        ) : null}
        {label ? <Text style={styles.siteLabel}>{label}</Text> : null}
      </Pressable>
    );
  }

  if (kind === 'osm-clinic') {
    return (
      <View
        pointerEvents="none"
        style={[styles.absPin, pinAt(leftPct, topPct, tone.size)]}
      >
        <View style={[styles.siteCircle, styles.siteCircleCold]}>
          <Ionicons name="medical-outline" size={8} color="rgba(60, 60, 67, 0.55)" />
        </View>
        {label ? <Text style={styles.osmLabel}>{label}</Text> : null}
      </View>
    );
  }

  if (kind === 'sim') {
    return (
      <Pressable onPress={onPress} style={[styles.absPin, pinAt(leftPct, topPct, tone.size)]}>
        <View style={[styles.simDot, { backgroundColor: tone.dot }]}>
          <Text style={styles.simBadgeText}>SIM</Text>
        </View>
        {label ? <Text style={styles.siteLabel}>{label}</Text> : null}
      </Pressable>
    );
  }

  if (kind === 'race-mark') {
    return (
      <View pointerEvents="none" style={[styles.absPin, pinAt(leftPct, topPct, tone.size)]}>
        <View
          style={{
            width: tone.size,
            height: tone.size,
            borderRadius: tone.size / 2,
            backgroundColor: tone.dot,
            borderWidth: 1.5,
            borderColor: '#FFF',
          }}
        />
      </View>
    );
  }

  // Standard peer pin (you/crew/fleet/following/own)
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.absPin,
        pinAt(leftPct, topPct, tone.size),
      ]}
    >
      {tone.ring ? (
        <View
          style={{
            position: 'absolute',
            width: tone.size + 10,
            height: tone.size + 10,
            borderRadius: (tone.size + 10) / 2,
            backgroundColor: tone.ring,
            left: -5,
            top: -5,
          }}
        />
      ) : null}
      {selected ? (
        <View
          style={{
            position: 'absolute',
            width: tone.size + 14,
            height: tone.size + 14,
            borderRadius: (tone.size + 14) / 2,
            borderWidth: 2,
            borderColor: IOS_REGISTER.accentUserAction,
            left: -7,
            top: -7,
          }}
        />
      ) : null}
      <View
        style={{
          width: tone.size,
          height: tone.size,
          borderRadius: tone.size / 2,
          backgroundColor: tone.dot,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.95)',
        }}
      />
      {label ? (
        <Text style={[styles.peerLabel, sublabel ? null : styles.peerLabelTight]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      {sublabel ? (
        <Text style={styles.peerSub} numberOfLines={1}>
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

function pinAt(leftPct: number, topPct: number, size: number) {
  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    marginLeft: -size / 2,
    marginTop: -size / 2,
  };
}

/**
 * NextEventTag — the amber NEXT · RACE 4 · SAT 10AM callout overlaid on
 * the highlighted venue. The only Atlas accent that uses amber per the
 * canonical grammar.
 */
export function NextEventTag({
  leftPct,
  topPct,
  eyebrow,
  detail,
}: {
  leftPct: number;
  topPct: number;
  eyebrow: string;
  detail?: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.absPin,
        {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          marginLeft: -64,
          marginTop: -16,
        },
      ]}
    >
      <View style={styles.nextEventTag}>
        <Text style={styles.nextEventEyebrow}>{eyebrow}</Text>
        {detail ? <Text style={styles.nextEventDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

/**
 * RacingAreaTag — small last-race label attached to a non-glowing area.
 * Used in F1 to show "Apr 14 · 3 from fleet" on Port Shelter etc.
 */
export function RacingAreaTag({
  leftPct,
  topPct,
  text,
}: {
  leftPct: number;
  topPct: number;
  text: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.absPin,
        {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          marginLeft: -50,
          marginTop: -8,
        },
      ]}
    >
      <View style={styles.racingAreaTag}>
        <Text style={styles.racingAreaText}>{text}</Text>
      </View>
    </View>
  );
}

/**
 * ClusterTag — F3 international-zoom cluster: bubble with fleet name +
 * sailor count.
 */
export function ClusterTag({
  leftPct,
  topPct,
  label,
  count,
  highlight,
}: {
  leftPct: number;
  topPct: number;
  label: string;
  count?: string;
  highlight?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.absPin,
        {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          marginLeft: -50,
          marginTop: -16,
        },
      ]}
    >
      <View style={[styles.cluster, highlight && styles.clusterHighlight]}>
        <View style={[styles.clusterDot, highlight && styles.clusterDotHighlight]} />
        <Text style={styles.clusterLabel}>{label}</Text>
      </View>
      {count ? <Text style={styles.clusterCount}>{count}</Text> : null}
    </Pressable>
  );
}

/**
 * GhostStampOverlay — F4 fallback: faded sample text overlay anchored
 * over the empty cohort region. Reads as "not yours" without disappearing.
 */
export function GhostStampOverlay({ leftPct, topPct }: { leftPct: number; topPct: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.absPin,
        {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          marginLeft: -84,
          marginTop: -16,
        },
      ]}
    >
      <View style={styles.ghostStamp}>
        <Text style={styles.ghostStampText}>SAMPLE · YOUR COHORT</Text>
        <Text style={styles.ghostStampText}>WOULD APPEAR HERE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  absPin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerLabel: {
    marginTop: 4,
    fontSize: 9.5,
    fontWeight: '500',
    color: 'rgba(60, 60, 67, 0.72)',
    letterSpacing: -0.1,
  },
  peerLabelTight: {
    marginTop: 4,
  },
  peerSub: {
    fontSize: 9,
    color: 'rgba(60, 60, 67, 0.52)',
    fontStyle: 'italic',
    marginTop: 1,
  },
  siteCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(120, 100, 180, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteCircleCold: {
    borderColor: 'rgba(60, 60, 67, 0.32)',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  siteLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(60, 60, 67, 0.72)',
    letterSpacing: -0.1,
  },
  osmLabel: {
    marginTop: 3,
    fontSize: 8.5,
    color: 'rgba(60, 60, 67, 0.55)',
    fontWeight: '500',
  },
  jhBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#AF52DE',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minWidth: 12,
    alignItems: 'center',
  },
  jhBadgeText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  simDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simBadgeText: {
    color: '#FFFFFF',
    fontSize: 6.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  nextEventTag: {
    backgroundColor: '#FFE6B0',
    borderColor: '#F0A93A',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    shadowColor: '#F0A93A',
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  nextEventEyebrow: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#8A4B00',
    letterSpacing: 0.7,
  },
  nextEventDetail: {
    fontSize: 8,
    color: '#8A4B00',
    marginTop: 1,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  racingAreaTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.22)',
  },
  racingAreaText: {
    fontSize: 8.5,
    color: 'rgba(60, 60, 67, 0.62)',
    fontWeight: '500',
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.22)',
  },
  clusterHighlight: {
    borderColor: '#FF3B30',
  },
  clusterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(40, 50, 70, 0.78)',
  },
  clusterDotHighlight: {
    backgroundColor: '#FF3B30',
  },
  clusterLabel: {
    fontSize: 8.5,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.78)',
    letterSpacing: 0.4,
  },
  clusterCount: {
    marginTop: 2,
    fontSize: 7.5,
    color: 'rgba(60, 60, 67, 0.55)',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  ghostStamp: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.18)',
    alignItems: 'center',
  },
  ghostStampText: {
    fontSize: 8,
    color: 'rgba(60, 60, 67, 0.45)',
    fontWeight: '600',
    letterSpacing: 1,
  },
});
