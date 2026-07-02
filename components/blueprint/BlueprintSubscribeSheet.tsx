/**
 * BlueprintSubscribeSheet — the single subscribe surface for every blueprint
 * source (System-A peer, institutional Studio, marketplace).
 *
 * Subscribing is a *relationship*; steps enter the learner's timeline only on
 * the learner's terms. The sheet asks two questions before writing anything:
 *   1. Which interest should this plan live under? (author interest is the
 *      strong default; the learner may re-home it or mint a new interest)
 *   2. How do you want to begin? (first step / whole plan / just subscribe)
 *
 * No source auto-dumps its whole step list. See
 * docs/redesign/specs/BLUEPRINT_SUBSCRIBE_UNIFIED_FLOW_SPEC.md.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { STEP_COLORS } from '@/lib/step-theme';
import { useInterest } from '@/providers/InterestProvider';
import { useBlueprintSubscribe } from '@/hooks/useBlueprintSubscribe';
import type {
  BlueprintSystem,
  EntryGranularity,
  SubscribeToBlueprintResult,
} from '@/services/BlueprintSubscribeService';

export interface SubscribeSheetBlueprint {
  id: string;
  system: BlueprintSystem;
  title: string;
  authorInterestId?: string | null;
  authorInterestSlug?: string | null;
  authorInterestLabel?: string | null;
  /** Org label, for the institutional re-homing guardrail note. */
  orgLabel?: string | null;
}

interface BlueprintSubscribeSheetProps {
  visible: boolean;
  onClose: () => void;
  blueprint: SubscribeSheetBlueprint;
  viewedSeasonId?: string | null;
  onSubscribed?: (result: SubscribeToBlueprintResult) => void;
}

type SheetState = 'pick' | 'subscribing' | 'success' | 'error';

const GRANULARITY_OPTIONS: {
  value: EntryGranularity;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'first',
    title: 'Just the first step',
    subtitle: 'A gentle start — the rest stay pullable.',
    icon: 'play-outline',
  },
  {
    value: 'all',
    title: 'The whole plan',
    subtitle: 'Lay every step out on my timeline now.',
    icon: 'list-outline',
  },
  {
    value: 'none',
    title: 'Just subscribe',
    subtitle: 'No steps yet — pull them whenever I want.',
    icon: 'bookmark-outline',
  },
];

interface InterestChoice {
  id: string;
  slug: string | null;
  name: string;
  /** True when not yet in the learner's interests (selecting it mints it). */
  isNew: boolean;
}

export function BlueprintSubscribeSheet({
  visible,
  onClose,
  blueprint,
  viewedSeasonId,
  onSubscribed,
}: BlueprintSubscribeSheetProps) {
  const { userInterests, addInterest } = useInterest();
  const subscribe = useBlueprintSubscribe();

  const [state, setState] = useState<SheetState>('pick');
  const [selectedInterestId, setSelectedInterestId] = useState<string | null>(
    blueprint.authorInterestId ?? null,
  );
  const [granularity, setGranularity] = useState<EntryGranularity>('first');
  const [result, setResult] = useState<SubscribeToBlueprintResult | null>(null);

  // Author interest first (the author's framing is the strong default), then
  // the learner's other interests. The author interest may be one the learner
  // doesn't have yet — selecting it then mints it.
  const interestChoices = useMemo<InterestChoice[]>(() => {
    const owned = userInterests.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      isNew: false,
    }));
    const ownedIds = new Set(owned.map((i) => i.id));

    const choices: InterestChoice[] = [];
    if (blueprint.authorInterestId && !ownedIds.has(blueprint.authorInterestId)) {
      choices.push({
        id: blueprint.authorInterestId,
        slug: blueprint.authorInterestSlug ?? null,
        name: blueprint.authorInterestLabel ?? 'This plan’s interest',
        isNew: true,
      });
    }
    return [...choices, ...owned];
  }, [userInterests, blueprint.authorInterestId, blueprint.authorInterestSlug, blueprint.authorInterestLabel]);

  // Default the selection once choices are known.
  const effectiveSelectedId =
    selectedInterestId ?? blueprint.authorInterestId ?? interestChoices[0]?.id ?? null;

  const isInstitutional = blueprint.system !== 'timeline';
  const showRehomeNote =
    isInstitutional &&
    blueprint.authorInterestId != null &&
    effectiveSelectedId != null &&
    effectiveSelectedId !== blueprint.authorInterestId;

  const handleConfirm = useCallback(async () => {
    if (!effectiveSelectedId) return;
    setState('subscribing');
    try {
      const chosen = interestChoices.find((c) => c.id === effectiveSelectedId);
      // Minting: if the learner picked an interest they don't own yet, add it
      // before filing the plan under it.
      if (chosen?.isNew && chosen.slug) {
        await addInterest(chosen.slug);
      }
      const res = await subscribe.mutateAsync({
        blueprintId: blueprint.id,
        blueprintSystem: blueprint.system,
        targetInterestId: effectiveSelectedId,
        entryGranularity: granularity,
        viewedSeasonId,
      });
      setResult(res);
      setState('success');
      onSubscribed?.(res);
    } catch {
      setState('error');
    }
  }, [
    effectiveSelectedId,
    interestChoices,
    addInterest,
    subscribe,
    blueprint.id,
    blueprint.system,
    granularity,
    viewedSeasonId,
    onSubscribed,
  ]);

  const handleClose = useCallback(() => {
    setState('pick');
    setResult(null);
    setSelectedInterestId(blueprint.authorInterestId ?? null);
    setGranularity('first');
    onClose();
  }, [onClose, blueprint.authorInterestId]);

  const successCopy = useMemo(() => {
    if (!result) return '';
    if (result.materializedCount === 0) return 'Saved to your Library. Pull steps whenever you’re ready.';
    if (result.materializedCount === 1) return 'Step 1 is on your timeline. The rest stay pullable.';
    return `${result.materializedCount} steps are on your timeline.`;
  }, [result]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="add-circle-outline" size={20} color={STEP_COLORS.accent} />
            <Text style={styles.headerTitle}>Add to plan</Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={22} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        </View>

        <View style={styles.stepPreview}>
          <Ionicons name="book-outline" size={16} color={STEP_COLORS.secondaryLabel} />
          <Text style={styles.stepPreviewText} numberOfLines={1}>
            {blueprint.title || 'Untitled plan'}
          </Text>
        </View>

        {state === 'pick' && (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {/* Decision 1 — interest */}
            <Text style={styles.sectionLabel}>Which interest?</Text>
            {interestChoices.length === 0 ? (
              <Text style={styles.emptyHint}>No interests yet — add one first.</Text>
            ) : (
              interestChoices.map((choice) => {
                const selected = choice.id === effectiveSelectedId;
                return (
                  <Pressable
                    key={choice.id}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                    onPress={() => setSelectedInterestId(choice.id)}
                  >
                    <View style={styles.optionMain}>
                      <Text style={styles.optionTitle}>
                        {choice.isNew ? `Add as a new interest: ${choice.name}` : choice.name}
                      </Text>
                      {choice.id === blueprint.authorInterestId && (
                        <Text style={styles.optionBadge}>Author’s interest</Text>
                      )}
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? STEP_COLORS.accent : IOS_COLORS.systemGray3}
                    />
                  </Pressable>
                );
              })
            )}
            {showRehomeNote && (
              <View style={styles.guardrailNote}>
                <Ionicons name="information-circle-outline" size={15} color={IOS_COLORS.systemBlue} />
                <Text style={styles.guardrailText}>
                  This plan’s progress reports to {blueprint.orgLabel ?? 'the organization'}; keeping it
                  under the author’s interest keeps that link.
                </Text>
              </View>
            )}

            {/* Decision 2 — entry granularity */}
            <Text style={[styles.sectionLabel, { marginTop: IOS_SPACING.lg }]}>
              How do you want to begin?
            </Text>
            {GRANULARITY_OPTIONS.map((opt) => {
              const selected = opt.value === granularity;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.optionCard, selected && styles.optionCardSelected]}
                  onPress={() => setGranularity(opt.value)}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons name={opt.icon} size={20} color={STEP_COLORS.accent} />
                  </View>
                  <View style={styles.optionMain}>
                    <Text style={styles.optionTitle}>{opt.title}</Text>
                    <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={selected ? STEP_COLORS.accent : IOS_COLORS.systemGray3}
                  />
                </Pressable>
              );
            })}

            <Pressable
              style={[styles.confirmButton, !effectiveSelectedId && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={!effectiveSelectedId}
            >
              <Text style={styles.confirmButtonText}>Add to plan</Text>
            </Pressable>
          </ScrollView>
        )}

        {state === 'subscribing' && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={STEP_COLORS.accent} />
            <Text style={styles.addingText}>Adding to your plan…</Text>
          </View>
        )}

        {state === 'success' && (
          <View style={styles.centered}>
            <Ionicons name="checkmark-circle" size={56} color={STEP_COLORS.accent} />
            <Text style={styles.successTitle}>Added to your plan</Text>
            <Text style={styles.successSubtitle}>{successCopy}</Text>
            <Pressable style={styles.doneButton} onPress={handleClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        )}

        {state === 'error' && (
          <View style={styles.centered}>
            <Ionicons name="alert-circle" size={56} color={IOS_COLORS.systemRed} />
            <Text style={styles.successTitle}>Something went wrong</Text>
            <Text style={styles.successSubtitle}>Couldn’t add this plan. Please try again.</Text>
            <Pressable
              style={[styles.doneButton, { backgroundColor: IOS_COLORS.systemBlue }]}
              onPress={() => setState('pick')}
            >
              <Text style={styles.doneButtonText}>Try Again</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_COLORS.label,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: 'rgba(61,138,90,0.06)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  stepPreviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.label,
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: STEP_COLORS.accent,
    backgroundColor: 'rgba(61,138,90,0.06)',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: 'rgba(61,138,90,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionMain: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  optionSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  optionBadge: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    color: STEP_COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  guardrailNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,122,255,0.08)',
    padding: IOS_SPACING.sm,
    borderRadius: 12,
  },
  guardrailText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.systemBlue,
  },
  confirmButton: {
    backgroundColor: STEP_COLORS.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: IOS_SPACING.lg,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.xl,
  },
  addingText: {
    fontSize: 15,
    color: STEP_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneButton: {
    backgroundColor: STEP_COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: IOS_SPACING.md,
    minWidth: 120,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
