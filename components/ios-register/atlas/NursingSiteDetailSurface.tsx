/**
 * NursingSiteDetailSurface — Frame B from the nursing Atlas redesign.
 *
 * Site-level detail keeps the privacy floor structural: competencies, cohort
 * aggregates, and preceptors are attached to a named clinical site, never to a
 * patient, room, or live presence.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { PlaceKnowledgeSection } from '@/components/venue/PlaceKnowledgeSection';

// Sites opened from the Sites list carry a real atlas_pois uuid (name-bound in
// NursingSitesSurface); the mock node map passes slugs like 'jhh-4-south',
// which can't anchor knowledge.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLUSTER = {
  cardiac: '#E5484D',
  med: '#7C3AED',
  assess: '#D97706',
  general: '#16A34A',
} as const;

export interface NursingSiteDetailTarget {
  id: string;
  name: string;
  unit?: string;
  specialty?: string;
  statusLabel?: string;
  lat?: number;
  lng?: number;
}

export interface NursingSiteDetailSurfaceProps {
  site: NursingSiteDetailTarget;
  toolbarOffset?: number;
  bottomOffset?: number;
  onBack: () => void;
  onLogShift: (site: NursingSiteDetailTarget) => void;
}

const COMPETENCIES = [
  { name: 'Cardiac assessment', cluster: CLUSTER.cardiac, count: '×4', done: true },
  { name: 'Central-line care', cluster: CLUSTER.med, count: '×2', done: true },
  { name: 'Telemetry interpretation', cluster: CLUSTER.assess, count: '×5', done: true },
  { name: 'Medication administration', cluster: CLUSTER.general, count: '×6', done: true },
  { name: 'Chest-tube management', cluster: 'rgba(118,118,128,0.22)', count: 'not yet', done: false },
];

export function NursingSiteDetailSurface({
  site,
  toolbarOffset = 0,
  bottomOffset = 0,
  onBack,
  onLogShift,
}: NursingSiteDetailSurfaceProps) {
  const insets = useSafeAreaInsets();
  const unit = site.unit ?? '4 South · Cardiac telemetry';
  const [primaryUnit, secondaryUnit] = unit.split(' · ');
  const siteLabel = site.name
    .replace(/^Johns Hopkins Hospital\s+—\s+/i, '')
    .replace(/^Johns Hopkins\s+/i, '')
    .replace(/\s+Medical Center$/i, '')
    .trim();
  const title = primaryUnit
    ? `${siteLabel.includes('East Baltimore') ? 'JHH' : siteLabel} · ${primaryUnit}`
    : siteLabel;
  const statusText = site.statusLabel === 'Mon'
    ? 'Upcoming · week 5 of 8'
    : site.statusLabel === '9 / 10'
      ? 'Completed · week 2'
      : 'Now · week 3 of 4';
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: toolbarOffset + Math.max(insets.top, 44) }]}>
        <Pressable
          style={styles.back}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Atlas sites"
          testID="atlas-nursing-site-detail-back"
        >
          <Ionicons name="chevron-back" size={17} color="#007AFF" />
          <Text style={styles.backText}>Atlas</Text>
        </Pressable>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{statusText}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {[primaryUnit && secondaryUnit ? secondaryUnit : unit, site.name].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: bottomOffset + 118 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Competencies evidenced here</Text>
        <View style={styles.list}>
          {COMPETENCIES.map((item, index) => (
            <View key={item.name}>
              {index > 0 ? <View style={styles.sep} /> : null}
              <View style={styles.compRow}>
                <View style={[styles.dot, { backgroundColor: item.cluster }]} />
                <Text style={[styles.compName, !item.done && styles.compNameMuted]}>
                  {item.name}
                </Text>
                {item.done ? <Ionicons name="checkmark" size={13} color="#16A34A" /> : null}
                <Text style={[styles.compCount, !item.done && styles.compCountMuted]}>
                  {item.count}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.aggregateCard}>
          <Text style={styles.cardKicker}>Cohort · this week</Text>
          <Text style={styles.aggregateTitle}>21 of 30 practiced central-line care on this unit</Text>
          <View style={styles.hexRow}>
            {[
              ['8', CLUSTER.med],
              ['6', CLUSTER.cardiac],
              ['4', CLUSTER.assess],
              ['3', CLUSTER.general],
            ].map(([label, color]) => (
              <View key={label} style={[styles.hex, { backgroundColor: color }]}>
                <Text style={styles.hexText}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.privacyRow}>
            <Ionicons name="lock-closed" size={11} color={IOS_COLORS.tertiaryLabel} />
            <Text style={styles.privacyText}>Site-level aggregate · no patient or room detail, ever</Text>
          </View>
        </View>

        <Text style={styles.eyebrow}>Preceptors here</Text>
        <View style={styles.preceptor}>
          <View style={styles.preceptorDiamond} />
          <View>
            <Text style={styles.preceptorName}>Dr. Singh</Text>
            <Text style={styles.preceptorSub}>Respiratory · precepts Tue–Thu</Text>
          </View>
        </View>

        {UUID_RE.test(site.id) ? (
          <View style={styles.knowledgeCard}>
            <PlaceKnowledgeSection
              anchor={{ poiId: site.id }}
              conditions={null}
              interestSlug="nursing"
              onAddKnowledge={() =>
                router.push({
                  pathname: '/venue/post/create',
                  params: { poiId: site.id, poiName: site.name, interestSlug: 'nursing' },
                } as never)
              }
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomOffset + IOS_SPACING.sm }]}>
        <Pressable
          style={styles.logButton}
          onPress={() => onLogShift(site)}
          accessibilityRole="button"
          accessibilityLabel="Log a shift here"
        >
          <Text style={styles.logButtonText}>+ Log a shift here</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -4 },
  backText: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  statusPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,122,255,0.10)', borderRadius: 4, paddingHorizontal: 3 },
  statusPillText: { color: '#007AFF', fontSize: 13, fontWeight: '600' },
  title: { marginTop: 8, fontFamily: fontFamily.serif, fontSize: 25, fontWeight: '500', color: IOS_COLORS.label, letterSpacing: -0.3 },
  subtitle: { marginTop: 3, fontSize: 13, color: IOS_COLORS.secondaryLabel },
  body: { flex: 1 },
  eyebrow: {
    marginTop: IOS_SPACING.lg,
    marginHorizontal: IOS_SPACING.lg,
    marginBottom: 8,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
  },
  list: { backgroundColor: '#F2F2F7' },
  compRow: { flexDirection: 'row', alignItems: 'center', minHeight: 39, paddingHorizontal: IOS_SPACING.lg, gap: 10 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: IOS_COLORS.separator, marginLeft: IOS_SPACING.lg + 18 },
  dot: { width: 9, height: 9, borderRadius: 3 },
  compName: { flex: 1, fontSize: 14, fontWeight: '700', color: IOS_COLORS.label },
  compNameMuted: { color: IOS_COLORS.tertiaryLabel, fontWeight: '600' },
  compCount: { fontFamily: fontFamily.mono, minWidth: 28, textAlign: 'right', fontSize: 12, fontWeight: '500', color: IOS_COLORS.secondaryLabel },
  compCountMuted: { color: IOS_COLORS.tertiaryLabel, fontSize: 10 },
  aggregateCard: {
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: IOS_SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  cardKicker: { fontFamily: fontFamily.mono, fontSize: 10, fontWeight: '500', letterSpacing: 1, color: IOS_COLORS.tertiaryLabel, textTransform: 'uppercase' },
  aggregateTitle: { marginTop: 8, fontSize: 15, fontWeight: '800', color: IOS_COLORS.label, lineHeight: 20 },
  hexRow: { flexDirection: 'row', gap: 6, marginTop: IOS_SPACING.md },
  hex: { width: 28, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  hexText: { color: '#FFFFFF', fontFamily: fontFamily.mono, fontSize: 11, fontWeight: '500', fontVariant: ['tabular-nums'] },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: IOS_SPACING.md },
  privacyText: { flex: 1, fontSize: 10.5, color: IOS_COLORS.tertiaryLabel },
  preceptor: { flexDirection: 'row', alignItems: 'center', gap: 13, marginHorizontal: IOS_SPACING.lg, paddingVertical: IOS_SPACING.sm },
  knowledgeCard: {
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.sm,
    paddingTop: IOS_SPACING.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  preceptorDiamond: { width: 34, height: 34, borderRadius: 7, backgroundColor: CLUSTER.med, transform: [{ rotate: '45deg' }] },
  preceptorName: { fontSize: 14, fontWeight: '800', color: IOS_COLORS.label },
  preceptorSub: { marginTop: 2, fontSize: 12, color: IOS_COLORS.secondaryLabel },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.sm,
    backgroundColor: 'rgba(242,242,247,0.94)',
  },
  logButton: { height: 46, borderRadius: 11, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },
  logButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});

export default NursingSiteDetailSurface;
