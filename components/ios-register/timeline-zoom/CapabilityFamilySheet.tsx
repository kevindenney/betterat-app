/**
 * CapabilityFamilySheet — drill-down for a tapped capability band.
 *
 * Tapping a band on CapabilityMix (e.g. "Procedures" on a nursing
 * chart) opens this sheet showing:
 *   - Color swatch + canonical family name as header
 *   - The raw capability labels that folded into this family (so the
 *     user can see "Smooth catheter advancement", "Troubleshooting
 *     catheter placement" all live under Procedures)
 *   - The steps in this arc that contributed, grouped by week
 *
 * Lets a sailor confirm "yes, this family really is what it sounds
 * like" without forcing them to scroll the Browse Weeks list and
 * filter mentally.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { TimelineSeason, TimelineStep } from './types';
import {
  isCrossInterestCapabilityLabel,
  resolveCapabilityVisuals,
  type InterestVocab,
} from './interestVocab';

interface Props {
  visible: boolean;
  onClose: () => void;
  season: TimelineSeason | null;
  capabilityId: string | null;
  capabilityLabel: string | null;
  capabilityColor: string | null;
  interestVocab: InterestVocab;
  onOpenStep: (stepId: string) => void;
}

interface MatchedStep {
  step: TimelineStep;
  weekNumber: number;
  rawLabels: string[];
}

export function CapabilityFamilySheet({
  visible,
  onClose,
  season,
  capabilityId,
  capabilityLabel,
  capabilityColor,
  interestVocab,
  onOpenStep,
}: Props) {
  const insets = useSafeAreaInsets();

  const { rawLabels, matches } = useMemo(() => {
    if (!season || !capabilityId) return { rawLabels: [], matches: [] as MatchedStep[] };
    const rawSet = new Set<string>();
    const out: MatchedStep[] = [];
    season.weeks.forEach((week, idx) => {
      for (const step of week.steps) {
        const stepRawLabels: string[] = [];
        for (const cap of step.capabilities ?? []) {
          if (cap.label === 'Practice' || cap.label === 'General') continue;
          if (isCrossInterestCapabilityLabel(cap.label)) continue;
          const v = resolveCapabilityVisuals(cap.label, interestVocab);
          const id = v.canonicalLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          if (id === capabilityId) {
            stepRawLabels.push(cap.label);
            rawSet.add(cap.label);
          }
        }
        if (stepRawLabels.length > 0) {
          out.push({ step, weekNumber: idx + 1, rawLabels: stepRawLabels });
        }
      }
    });
    return { rawLabels: Array.from(rawSet).sort(), matches: out };
  }, [season, capabilityId, interestVocab]);

  if (!capabilityId || !capabilityLabel) return null;

  const color = capabilityColor ?? IOS_REGISTER.labelSecondary;
  const showFolding = rawLabels.length > 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {capabilityLabel}
              </Text>
              <Text style={styles.subtitle}>
                {matches.length} {matches.length === 1 ? 'step' : 'steps'} in
                this {interestVocab.periodNoun}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={22}
                color={IOS_REGISTER.labelTertiary}
              />
            </Pressable>
          </View>

          {showFolding ? (
            <View style={styles.foldBlock}>
              <Text style={styles.foldEyebrow}>FOLDED FROM</Text>
              <View style={styles.foldChips}>
                {rawLabels.map((label) => (
                  <View key={label} style={styles.foldChip}>
                    <Text style={styles.foldChipText} numberOfLines={1}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {matches.length === 0 ? (
              <Text style={styles.empty}>
                No steps in this {interestVocab.periodNoun} touched this family
                yet.
              </Text>
            ) : (
              matches.map(({ step, weekNumber, rawLabels: srl }) => (
                <Pressable
                  key={step.id}
                  style={styles.row}
                  onPress={() => {
                    onClose();
                    onOpenStep(step.id);
                  }}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {step.title}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      week {weekNumber}
                      {srl.length > 0 ? ` · ${srl.join(' · ')}` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={IOS_REGISTER.labelTertiary}
                  />
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separator,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 10,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
  foldBlock: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 6,
  },
  foldEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  foldChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  foldChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  foldChipText: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
  },
  empty: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});
