/**
 * NursingMapSurface — Frame A2 from the nursing Atlas redesign.
 *
 * This is intentionally a node map, not a dense street chart. It keeps the
 * map useful for site geography and rotation sequence while routing detail
 * back to the Sites surface.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { NursingSiteDetailTarget } from './NursingSiteDetailSurface';

export interface NursingMapSurfaceProps {
  toolbarOffset?: number;
  bottomOffset?: number;
  onOpenSite: (site: NursingSiteDetailTarget) => void;
  onLogShift: (site: NursingSiteDetailTarget) => void;
  onPlanGap?: (site: NursingSiteDetailTarget) => void;
}

const JHH_SITE: NursingSiteDetailTarget = {
  id: 'jhh-4-south',
  name: 'Johns Hopkins Hospital',
  unit: '4 South · Cardiac telemetry',
  lat: 39.2966,
  lng: -76.5919,
};

const HOWARD_COUNTY_SITE: NursingSiteDetailTarget = {
  id: 'howard-county-general',
  name: 'Howard County General Hospital',
  unit: 'Clinical placement',
  statusLabel: 'Week 9',
  lat: 39.2137,
  lng: -76.8868,
};

function BuildingPin({
  left,
  top,
  label,
  badge,
  active,
  gap,
  onPress,
}: {
  left: `${number}%`;
  top: `${number}%`;
  label: string;
  badge?: string;
  active?: boolean;
  gap?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[styles.pinWrap, { left, top }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {gap ? (
        <View style={styles.gapBadge}>
          <Text style={styles.gapBadgeText}>{gap}</Text>
        </View>
      ) : null}
      <View style={[styles.pin, active && styles.pinActive]}>
        <Text style={styles.pinGlyph}>{badge ?? '🏥'}</Text>
        {active ? <View style={styles.countBadge}><Text style={styles.countBadgeText}>3</Text></View> : null}
      </View>
      <View style={styles.pinLabel}>
        <Text style={styles.pinLabelText} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function NursingMapSurface({
  toolbarOffset = 0,
  bottomOffset = 0,
  onOpenSite,
  onLogShift,
  onPlanGap,
}: NursingMapSurfaceProps) {
  return (
    <View style={[styles.root, { paddingTop: toolbarOffset + 82 }]}>
      <View style={styles.map}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 560" preserveAspectRatio="none">
          <Path
            d="M88 284 C148 218 158 172 230 126 C276 98 320 70 342 45"
            stroke="rgba(14,116,144,0.45)"
            strokeWidth="2"
            strokeDasharray="5 6"
            fill="none"
          />
          <Path
            d="M98 294 C158 298 218 276 270 236"
            stroke="rgba(14,116,144,0.22)"
            strokeWidth="6"
            fill="none"
          />
          <Circle cx="116" cy="334" r="58" fill="rgba(22,163,74,0.13)" />
          <Line x1="0" y1="238" x2="390" y2="184" stroke="rgba(120,105,80,0.18)" strokeWidth="2" />
          <Line x1="44" y1="0" x2="266" y2="560" stroke="rgba(120,105,80,0.14)" strokeWidth="2" />
          <Line x1="0" y1="340" x2="390" y2="318" stroke="rgba(120,105,80,0.12)" strokeWidth="1" />
          <Line x1="210" y1="0" x2="255" y2="560" stroke="rgba(120,105,80,0.10)" strokeWidth="1" />
        </Svg>

        <View style={styles.legend}>
          <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#DBEAFE' }]} /><Text style={styles.legendText}>Now</Text></View>
          <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#FFEDD5' }]} /><Text style={styles.legendText}>Upcoming</Text></View>
          <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#DCFCE7' }]} /><Text style={styles.legendText}>Done</Text></View>
        </View>

        <BuildingPin
          left="20%"
          top="44%"
          label="Howard County"
          badge="🩺"
          gap="closes 2 gaps"
          onPress={() => onPlanGap?.(HOWARD_COUNTY_SITE)}
        />
        <BuildingPin left="67%" top="40%" label="Bayview · Mon" badge="🫁" />
        <BuildingPin left="48%" top="56%" label="JHH · 4 South · now" badge="🫀" active onPress={() => onOpenSite(JHH_SITE)} />
        <BuildingPin left="58%" top="65%" label="Pinkard sim" badge="◈" />
        <BuildingPin left="30%" top="76%" label="Sibley · done" badge="✓" />
      </View>

      <View style={[styles.siteCard, { bottom: bottomOffset + 92 }]}>
        <View style={styles.cardHead}>
          <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>🫀</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Johns Hopkins Hospital</Text>
            <Text style={styles.cardSub}>4 South · Cardiac telemetry · 0.3 km</Text>
          </View>
          <Pressable style={styles.openSiteButton} onPress={() => onOpenSite(JHH_SITE)} accessibilityRole="button">
            <Text style={styles.openSiteText}>Open site</Text>
          </Pressable>
        </View>
        <View style={styles.coverageRow}>
          <Text style={styles.coverageText}><Text style={styles.coverageBold}>7</Text> of 12 competencies evidenced</Text>
          <Text style={styles.coverageMuted}>week 3 of 4</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.trackSeg, { width: '24%', backgroundColor: '#E5484D' }]} />
          <View style={[styles.trackSeg, { width: '16%', backgroundColor: '#D97706' }]} />
          <View style={[styles.trackSeg, { width: '14%', backgroundColor: '#7C3AED' }]} />
          <View style={[styles.trackSeg, { width: '5%', backgroundColor: '#16A34A' }]} />
        </View>
        <View style={styles.cardFoot}>
          <View style={styles.avatars}>
            {[
              ['LN', '#3F6FA8'],
              ['MR', '#9A5B9E'],
              ['AK', '#2B7A4B'],
            ].map(([label, color], index) => (
              <View key={label} style={[styles.avatar, { backgroundColor: color, marginLeft: index ? -6 : 0 }]}>
                <Text style={styles.avatarText}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.cardFootText}>5 cohort-mates here this block</Text>
          <Pressable style={styles.logMini} onPress={() => onLogShift(JHH_SITE)} accessibilityRole="button">
            <Ionicons name="add" size={13} color="#007AFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EFE7D7' },
  map: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#EFE7D7',
  },
  legend: {
    position: 'absolute',
    top: 8,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 3,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: IOS_COLORS.secondaryLabel, fontWeight: '600' },
  pinWrap: { position: 'absolute', alignItems: 'center', transform: [{ translateX: -42 }, { translateY: -26 }] },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pinActive: { borderColor: '#B8C7D9', shadowOpacity: 0.23 },
  pinGlyph: { fontSize: 20 },
  countBadge: {
    position: 'absolute',
    top: -7,
    left: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  countBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  gapBadge: {
    marginBottom: 4,
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  gapBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  pinLabel: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: 142,
  },
  pinLabelText: { fontSize: 10.5, fontWeight: '800', color: IOS_COLORS.label },
  siteCard: {
    position: 'absolute',
    left: IOS_SPACING.lg,
    right: IOS_SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: IOS_SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    shadowColor: '#000000',
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardBadge: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  cardBadgeText: { fontSize: 18 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: IOS_COLORS.label, lineHeight: 18 },
  cardSub: { fontSize: 12, color: IOS_COLORS.secondaryLabel },
  openSiteButton: { backgroundColor: '#EAF3FF', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  openSiteText: { color: '#007AFF', fontSize: 12, fontWeight: '800' },
  coverageRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10 },
  coverageText: { fontSize: 12, color: IOS_COLORS.secondaryLabel },
  coverageBold: { fontWeight: '800', color: IOS_COLORS.label },
  coverageMuted: { fontSize: 11, color: IOS_COLORS.secondaryLabel },
  track: { flexDirection: 'row', height: 7, borderRadius: 4, backgroundColor: 'rgba(60,60,67,0.10)', overflow: 'hidden', marginTop: 5 },
  trackSeg: { height: '100%' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  avatars: { flexDirection: 'row' },
  avatar: { width: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  avatarText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '800' },
  cardFootText: { flex: 1, fontSize: 12, color: IOS_COLORS.label, fontWeight: '700' },
  logMini: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
});

export default NursingMapSurface;
