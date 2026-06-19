/**
 * CapabilityAreaSheet — the detail view a user sees when they tap a capability
 * area in the Atlas "Capabilities" segment.
 *
 * Replaces the old tap-to-auto-create behavior: tapping an area now *reveals*
 * what's in it (the framework competencies, which are evidenced vs. still a
 * gap, and where the framework comes from) instead of silently minting a step.
 * Planning a step is a single, deliberate button at the bottom — the only path
 * that creates anything.
 */

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { CapabilityCategoryCoverage } from '@/hooks/useInterestCapabilityCoverage';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

export interface CapabilityAreaSheetProps {
  row: CapabilityCategoryCoverage | null;
  interestName: string;
  isGeneralFramework: boolean;
  onClose: () => void;
  onPlanStep: (row: CapabilityCategoryCoverage) => void;
}

export function CapabilityAreaSheet({
  row,
  interestName,
  isGeneralFramework,
  onClose,
  onPlanStep,
}: CapabilityAreaSheetProps) {
  const open = row != null;
  const pct = row && row.total > 0 ? Math.round((row.evidenced / row.total) * 100) : 0;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        {row ? (
          <>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>Capability area</Text>
                <Text style={styles.title}>{row.category}</Text>
                <Text style={styles.sub}>
                  {row.evidenced} of {row.total} evidenced{row.evidenced === 0 ? ' · all a gap' : ''}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={IOS_COLORS.secondaryLabel} />
              </Pressable>
            </View>

            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct}%`, backgroundColor: row.evidenced > 0 ? '#16A34A' : 'transparent' },
                ]}
              />
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {row.competencies.map((comp) => (
                <View key={comp.id} style={styles.compRow}>
                  <Ionicons
                    name={comp.evidenced ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={comp.evidenced ? '#16A34A' : IOS_COLORS.tertiaryLabel}
                  />
                  <Text style={[styles.compTitle, !comp.evidenced && styles.compTitleGap]} numberOfLines={2}>
                    {comp.title}
                  </Text>
                </View>
              ))}
              {row.competencies.length === 0 ? (
                <Text style={styles.empty}>No capabilities defined in this area yet.</Text>
              ) : null}
            </ScrollView>

            <View style={styles.provenance}>
              <Ionicons name="information-circle-outline" size={13} color={IOS_COLORS.tertiaryLabel} />
              <Text style={styles.provenanceText}>
                {isGeneralFramework
                  ? 'These are general capabilities until you add an interest. Add one and its framework takes over.'
                  : `Part of the ${interestName} framework. Joining an org or subscribing a blueprint can extend it.`}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.planBtn, pressed && styles.planBtnPressed]}
              onPress={() => onPlanStep(row)}
              accessibilityRole="button"
              accessibilityLabel={`Plan a step for ${row.category}`}
              testID="atlas-capability-area-plan"
            >
              <Text style={styles.planBtnText}>Plan a {row.category} step</Text>
              <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },
  sheet: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: 8,
    paddingBottom: 34,
    maxHeight: '78%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(60,60,67,0.3)',
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 3 },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
  title: { fontFamily: fontFamily.serif, fontSize: 22, fontWeight: '500', color: IOS_COLORS.label, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: IOS_COLORS.secondaryLabel },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(118,118,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(60,60,67,0.10)',
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 4,
  },
  fill: { height: '100%', borderRadius: 4 },
  list: { marginTop: 8 },
  listContent: { gap: 2, paddingVertical: 4 },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  compTitle: { flex: 1, fontSize: 14, color: IOS_COLORS.label, letterSpacing: -0.2 },
  compTitleGap: { color: IOS_COLORS.secondaryLabel },
  empty: { fontSize: 13, color: IOS_COLORS.secondaryLabel, paddingVertical: 12 },
  provenance: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, paddingHorizontal: 2 },
  provenanceText: { flex: 1, fontSize: 11, color: IOS_COLORS.tertiaryLabel, lineHeight: 15 },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#007AFF',
    borderRadius: 13,
    paddingVertical: 14,
    marginTop: 16,
  },
  planBtnPressed: { opacity: 0.85 },
  planBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});

export default CapabilityAreaSheet;
