/**
 * StepAddSheet — the "Add step" bottom sheet opened from the StepTaskBar ＋
 * on the merged Step level. One surface: compose the new step first, then
 * browse blueprint and cross-interest suggestions below it.
 *
 *   New step                   → inline what/why/how/when/where composer
 *   From your blueprints       → subscribed-blueprint next steps, adopt in place
 *   ⇄ From your other interests → cross-interest AI suggestions, apply in place
 *
 * The blueprint + cross-interest rows write a real timeline step (adopt /
 * apply) without leaving the sheet.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useInterest } from '@/hooks/useInterest';
import { useSuggestedNextSteps, useAdoptBlueprintStep } from '@/hooks/useBlueprint';
import { useAISuggestions } from '@/hooks/useAISuggestions';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { ComposerWhereField } from '@/components/capture/ComposerWhereField';
import { ComposerWhenField } from '@/components/capture/ComposerWhenField';
import { VoiceComposerV3Sheet } from '@/components/capture/VoiceComposerV3Sheet';
import { RaceCoursePicker } from '@/components/capture/RaceCoursePicker';
import { PlanStepRaceSelector } from '@/components/step/plan-tab/PlanStepRaceSelector';
import { StepVisibilityChip } from '@/components/step/StepVisibilityChip';
import { useDefaultStepVisibility } from '@/hooks/useDefaultStepVisibility';
import type { QuickCapturePayload } from '@/services/QuickCaptureService';
import type { BlueprintSuggestedNextStep } from '@/types/blueprint';
import type { AISuggestion } from '@/services/ai/crossInterestSuggestions';
import type { RacePlan, StepLocation } from '@/types/step-detail';
import type { TimelineStepVisibility } from '@/types/timeline-steps';

type BlankFieldKey = 'why' | 'how' | 'when' | 'where';

const BLANK_FIELDS: { key: BlankFieldKey; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'why', label: 'Why', placeholder: 'Why does this matter right now?', multiline: true },
  { key: 'how', label: 'How', placeholder: 'How will you do it? One step per line.', multiline: true },
  { key: 'when', label: 'When', placeholder: 'When will you do this?' },
  { key: 'where', label: 'Where', placeholder: 'Where will this happen?' },
];
const BLANK_FIELD_ORDER = BLANK_FIELDS.map((f) => f.key);

function emptyBlankValues(): Record<BlankFieldKey, string> {
  return { why: '', how: '', when: '', where: '' };
}

interface StepAddSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Writes the composed step. The single source of truth for saving — every
   * entry point (global +, timeline +, library +) passes
   * `useUniversalPlus().submit` so the optimistic-insert + toast + nav pipeline
   * is shared. Keeping the composer presentational (no internal
   * useUniversalPlus) avoids a capture-barrel import cycle.
   */
  onSave: (payload: QuickCapturePayload) => void | Promise<void>;
  /** Rare secondary path: build a first plan from an external URL/text source. */
  onStartFromLink?: () => void;
  /** Fired after a source row writes a real timeline step, with its id. */
  onStepAdded?: (stepId: string) => void;
  /** Sailing only — lets the user create either a plain step or a race step. */
  showRaceSelector?: boolean;
  /** Home venue — keys the racing-area lookup in the race course reveal. */
  venueId?: string | null;
  venueName?: string | null;
  /**
   * The arc the user is viewing on the timeline. Stamped as metadata.season_id
   * on every step created from this sheet so it lands in the arc on screen
   * instead of being date-bucketed into a neighboring one.
   */
  viewedSeasonId?: string | null;
}

export function StepAddSheet({
  visible,
  onClose,
  onSave,
  onStartFromLink,
  onStepAdded,
  showRaceSelector = false,
  venueId,
  venueName,
  viewedSeasonId = null,
}: StepAddSheetProps) {
  const router = useRouter();
  const { currentInterest } = useInterest();
  const accent = currentInterest?.accent_color ?? IOS_REGISTER.accentUserAction;

  const { data: nextSteps, isLoading: bpLoading } = useSuggestedNextSteps(currentInterest?.id);
  const { data: recentSteps = [] } = useMyTimeline(currentInterest?.id);
  const adoptStep = useAdoptBlueprintStep();
  const { suggestions, isLoading: aiLoading, applySuggestion } = useAISuggestions(visible);
  const voiceEnabled = FEATURE_FLAGS.VOICE_COMPOSER_V3;

  // Inline composer state. The what/why/how/when/where entry lives right here
  // so adding a step stays one surface across every entry point.
  const [isRace, setIsRace] = useState(false);
  const [racePlan, setRacePlan] = useState<RacePlan>({});
  const [whatText, setWhatText] = useState('');
  const [activeFields, setActiveFields] = useState<BlankFieldKey[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<BlankFieldKey, string>>(emptyBlankValues());
  const [whereLocation, setWhereLocation] = useState<StepLocation | undefined>(undefined);
  const [whenISO, setWhenISO] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  // Visibility chip — shows the user's resolved default (per-interest →
  // profile → private) so new steps are never silently private; an
  // override applies to this step only.
  const { data: defaultVisibility } = useDefaultStepVisibility(currentInterest?.id, visible);
  const [visibilityOverride, setVisibilityOverride] = useState<TimelineStepVisibility | null>(null);
  const visibility = visibilityOverride ?? defaultVisibility ?? 'private';
  const whatRef = useRef<TextInput | null>(null);
  const fieldRefs = useRef<Partial<Record<BlankFieldKey, TextInput | null>>>({});
  const sheetTranslateY = useRef(new Animated.Value(0)).current;

  const resetComposer = useCallback(() => {
    setIsRace(false);
    setRacePlan({});
    setWhatText('');
    setActiveFields([]);
    setFieldValues(emptyBlankValues());
    setWhereLocation(undefined);
    setWhenISO(null);
    setPhotoUri(undefined);
    setSaving(false);
    setVisibilityOverride(null);
  }, []);

  const handlePickPhoto = useCallback(async () => {
    if (Platform.OS === 'web') {
      showAlert('Photo', 'Adding a photo is available on iOS and Android.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoUri(result.assets[0].uri);
  }, []);

  const insertField = useCallback((key: BlankFieldKey) => {
    setActiveFields((prev) =>
      prev.includes(key)
        ? prev
        : [...prev, key].sort((a, b) => BLANK_FIELD_ORDER.indexOf(a) - BLANK_FIELD_ORDER.indexOf(b)),
    );
    requestAnimationFrame(() => fieldRefs.current[key]?.focus());
  }, []);

  const removeField = useCallback((key: BlankFieldKey) => {
    setActiveFields((prev) => prev.filter((k) => k !== key));
    setFieldValues((prev) => ({ ...prev, [key]: '' }));
    if (key === 'where') setWhereLocation(undefined);
    if (key === 'when') setWhenISO(null);
  }, []);

  const handleWhereChange = useCallback((next: StepLocation | undefined) => {
    setWhereLocation(next);
    setFieldValues((prev) => ({ ...prev, where: next?.name ?? '' }));
  }, []);

  // Group the flat next-step list by blueprint so each plan reads as one card.
  const blueprintGroups = useMemo(() => {
    const map = new Map<string, { title: string; steps: BlueprintSuggestedNextStep[] }>();
    for (const s of nextSteps ?? []) {
      const g = map.get(s.blueprint_id);
      if (g) g.steps.push(s);
      else map.set(s.blueprint_id, { title: s.blueprint_title, steps: [s] });
    }
    return Array.from(map.values());
  }, [nextSteps]);

  const recentStepPrompt = useMemo(() => {
    const step = recentSteps.find((s) => {
      const title = s.title?.trim();
      return title && s.status !== 'completed' && s.status !== 'settled';
    }) ?? recentSteps.find((s) => s.title?.trim());
    const title = step?.title?.trim();
    if (!title) return null;
    return `Continue from "${title}"`;
  }, [recentSteps]);

  const handleAdopt = async (s: BlueprintSuggestedNextStep) => {
    if (!currentInterest?.id || adoptStep.isPending) return;
    try {
      const created = await adoptStep.mutateAsync({
        sourceStepId: s.next_step_id,
        interestId: currentInterest.id,
        subscriptionId: s.subscription_id,
        blueprintId: s.blueprint_id,
        viewedSeasonId,
      });
      onStepAdded?.(created.id);
      onClose();
    } catch {
      // adopt mutation logs its own error; keep the sheet open so the user can retry
    }
  };

  const handleApplyCrossSuggestion = async (suggestion: AISuggestion) => {
    await onSave({
      kind: 'text',
      content: suggestion.title,
      why: suggestion.body || undefined,
      viewedSeasonId,
    });
    await applySuggestion(suggestion);
    resetComposer();
    onClose();
  };

  const closeSheet = useCallback(() => {
    resetComposer();
    onClose();
    requestAnimationFrame(() => sheetTranslateY.setValue(0));
  }, [resetComposer, sheetTranslateY, onClose]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dy > 0) sheetTranslateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy > 96 || gesture.vy > 1.1) {
            Animated.timing(sheetTranslateY, {
              toValue: 700,
              duration: 160,
              useNativeDriver: true,
            }).start(closeSheet);
            return;
          }
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }),
    [closeSheet, sheetTranslateY],
  );

  const goToBlueprints = useCallback(() => {
    closeSheet();
    router.push({ pathname: '/(tabs)/library', params: { zone: 'follow' } } as any);
  }, [closeSheet, router]);

  const goToBlueprintStudio = useCallback(() => {
    closeSheet();
    router.push('/studio/blueprints/new' as any);
  }, [closeSheet, router]);

  const goToOrgs = useCallback(() => {
    closeSheet();
    router.push({ pathname: '/(tabs)/library', params: { zone: 'orgs' } } as any);
  }, [closeSheet, router]);

  const goToInterests = useCallback(() => {
    closeSheet();
    router.push({ pathname: '/(tabs)/library', params: { zone: 'interests' } } as any);
  }, [closeSheet, router]);

  useEffect(() => {
    if (!visible) return;
    sheetTranslateY.setValue(0);
    setIsRace(false);
    setActiveFields([]);
    requestAnimationFrame(() => whatRef.current?.focus());
  }, [sheetTranslateY, visible]);

  const canSave = whatText.trim().length > 0 && !saving;

  const handleSaveBlank = async () => {
    const trimmed = whatText.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const payload: QuickCapturePayload = {
      kind: 'text',
      content: trimmed,
      why: fieldValues.why.trim() || undefined,
      how: fieldValues.how.trim() || undefined,
      scheduledAt: whenISO ?? undefined,
      location: whereLocation,
      isRace: showRaceSelector ? isRace : undefined,
      racePlan: showRaceSelector && isRace ? racePlan : undefined,
      imageUri: photoUri,
      viewedSeasonId,
      visibility,
    };

    // onSave() does the optimistic timeline insert before its first await.
    // Close this local modal immediately so its transparent layer cannot
    // keep intercepting touches while the network save finishes.
    closeSheet();
    void Promise.resolve(onSave(payload)).catch(() => {
      // onSave normally owns its toast/error handling; this catches any
      // unexpected rejection so background save work never becomes unhandled.
    });
  };

  const sourceSections = (
    <>
      <View style={styles.dsec}>
        <View style={styles.dsecHead}>
          <Text style={styles.dsecTitle}>From your blueprints</Text>
        </View>
        {bpLoading ? (
          <ActivityIndicator style={styles.loading} color={accent} />
        ) : blueprintGroups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No followed blueprints yet.</Text>
            <Text style={styles.emptyBody}>
              Blueprints are reusable step plans. Follow a published plan, join a club or
              program that shares official plans, or publish one from your own steps.
            </Text>
            <View style={styles.emptyLinkRow}>
              <Pressable
                style={[styles.emptyLink, { borderColor: hexWithAlpha(accent, 0.35) }]}
                onPress={goToBlueprints}
                accessibilityRole="button"
                accessibilityLabel="Find plans to follow"
              >
                <Text style={[styles.emptyLinkText, { color: accent }]}>Find plans</Text>
                <Ionicons name="arrow-forward" size={14} color={accent} />
              </Pressable>
              <Pressable
                style={[styles.emptyLink, { borderColor: hexWithAlpha(accent, 0.35) }]}
                onPress={goToOrgs}
                accessibilityRole="button"
                accessibilityLabel="Find clubs and programs"
              >
                <Text style={[styles.emptyLinkText, { color: accent }]}>Clubs</Text>
                <Ionicons name="arrow-forward" size={14} color={accent} />
              </Pressable>
              <Pressable
                style={[styles.emptyLink, { borderColor: hexWithAlpha(accent, 0.35) }]}
                onPress={goToBlueprintStudio}
                accessibilityRole="button"
                accessibilityLabel="Publish your own blueprint"
              >
                <Text style={[styles.emptyLinkText, { color: accent }]}>Publish yours</Text>
                <Ionicons name="arrow-forward" size={14} color={accent} />
              </Pressable>
            </View>
          </View>
        ) : (
          <>
          {blueprintGroups.map((g) => (
            <View key={g.title} style={styles.bpgroup}>
              <View style={styles.bph}>
                <View style={styles.bpLogo}>
                  <Text style={styles.bpLogoText}>{g.title.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.bpText}>
                  <Text style={styles.bpName} numberOfLines={1}>
                    {g.title}
                  </Text>
                  <Text style={styles.bpSub}>Subscribed blueprint</Text>
                </View>
                <Text style={styles.bpCount}>{g.steps.length}</Text>
              </View>
              {g.steps.map((s) => {
                const expanded = expandedCardId === s.next_step_id;
                return (
                  <View key={s.next_step_id} style={styles.aitem}>
                    <Pressable
                      style={styles.aitemText}
                      onPress={() => setExpandedCardId(expanded ? null : s.next_step_id)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      accessibilityLabel={expanded ? `Collapse ${s.next_step_title}` : `Read more: ${s.next_step_title}`}
                    >
                      <Text style={styles.aitemTitle} numberOfLines={expanded ? undefined : 2}>
                        {s.next_step_title}
                      </Text>
                      {s.next_step_description ? (
                        <Text style={styles.aitemSub} numberOfLines={expanded ? undefined : 2}>
                          {s.next_step_description}
                        </Text>
                      ) : null}
                      {s.next_step_description ? (
                        <View style={styles.aitemMoreRow}>
                          <Text style={[styles.aitemMore, { color: accent }]}>
                            {expanded ? 'Show less' : 'Read more'}
                          </Text>
                          <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={13}
                            color={accent}
                          />
                        </View>
                      ) : null}
                    </Pressable>
                    <Pressable
                      style={[styles.addBtn, { borderColor: hexWithAlpha(accent, 0.4) }]}
                      onPress={() => handleAdopt(s)}
                      disabled={adoptStep.isPending}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${s.next_step_title}`}
                    >
                      <Ionicons name="add" size={18} color={accent} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
          <Text style={styles.bpDisclosure}>
            The blueprint author can see your progress on these steps.
          </Text>
          </>
        )}
      </View>

      <View style={styles.dsec}>
        <View style={styles.dsecHead}>
          <Text style={styles.dsecTitle}>⇄ From your other interests</Text>
        </View>
        {aiLoading ? (
          <ActivityIndicator style={styles.loading} color={accent} />
        ) : suggestions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No suggestions yet.</Text>
            <Text style={styles.emptyBody}>
              Suggestions come from steps near you, people you follow, subscribed blueprints,
              and patterns across your other interests. Add another interest or follow others
              to start sending and receiving useful next-step ideas.
            </Text>
            <Pressable
              style={[styles.emptyLink, { borderColor: hexWithAlpha(accent, 0.35) }]}
              onPress={goToInterests}
              accessibilityRole="button"
              accessibilityLabel="Find more interests"
            >
              <Text style={[styles.emptyLinkText, { color: accent }]}>Find interests</Text>
              <Ionicons name="arrow-forward" size={14} color={accent} />
            </Pressable>
          </View>
        ) : (
          suggestions.map((s) => {
            const expanded = expandedCardId === s.id;
            return (
              <View key={s.id} style={styles.aitem}>
                <Pressable
                  style={styles.aitemText}
                  onPress={() => setExpandedCardId(expanded ? null : s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={expanded ? `Collapse ${s.title}` : `Read more: ${s.title}`}
                >
                  <View style={styles.crossTagRow}>
                    <View style={styles.crossTag}>
                      <Text style={styles.crossTagText}>CROSS</Text>
                    </View>
                    <Text style={styles.aitemTitle} numberOfLines={expanded ? undefined : 2}>
                      {s.title}
                    </Text>
                  </View>
                  {s.body ? (
                    <Text style={styles.aitemSub} numberOfLines={expanded ? undefined : 2}>
                      {s.body}
                    </Text>
                  ) : null}
                  <View style={styles.aitemMoreRow}>
                    <Text style={[styles.aitemMore, { color: accent }]}>
                      {expanded ? 'Show less' : 'Read more'}
                    </Text>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={13}
                      color={accent}
                    />
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.addBtn, { borderColor: hexWithAlpha(accent, 0.4) }]}
                  onPress={() => handleApplyCrossSuggestion(s)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Apply ${s.title}`}
                >
                  <Ionicons name="add" size={18} color={accent} />
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      <View style={styles.dim}>
        <Pressable
          style={styles.backdropHitArea}
          onPress={closeSheet}
          accessibilityLabel="Dismiss add step"
        />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={8}
          >
          <View style={styles.dragRegion} {...sheetPanResponder.panHandlers}>
            <View style={styles.grab} />
          </View>

          <View style={styles.sheeth}>
            <Pressable
              testID="step-add-cancel"
              onPress={closeSheet}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel new step"
              style={styles.backRow}
            >
              <Text style={[styles.cancel, { color: accent }]}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheethTitle}>{showRaceSelector && isRace ? 'New race' : 'New step'}</Text>
            <Pressable
              testID="step-add-save"
              onPress={handleSaveBlank}
              disabled={!canSave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Save step"
            >
              <Text style={[styles.save, { color: canSave ? accent : IOS_REGISTER.labelTertiary }]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
              style={styles.sbody}
              contentContainerStyle={styles.composeContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {currentInterest?.name ? (
                <View style={styles.laneRow}>
                  <View style={styles.laneChip}>
                    <Ionicons name="ellipse" size={8} color={IOS_REGISTER.label} />
                    <Text style={styles.laneChipText}>{currentInterest.name}</Text>
                  </View>
                </View>
              ) : null}

              {showRaceSelector ? (
                <View style={styles.kindBlock}>
                  <Text style={styles.fieldEyebrow}>TYPE</Text>
                  <PlanStepRaceSelector
                    isRace={isRace}
                    onChange={setIsRace}
                    hideCourseReveal
                  />
                  {isRace ? (
                    <View style={styles.raceCourseSlot}>
                      <RaceCoursePicker
                        venueId={venueId}
                        venueName={venueName}
                        value={racePlan}
                        onChange={setRacePlan}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.fieldEyebrow}>WHAT</Text>
              <TextInput
                testID="step-add-description-input"
                ref={whatRef}
                style={styles.whatInput}
                value={whatText}
                onChangeText={setWhatText}
                placeholder="What do you want to work on?"
                placeholderTextColor={IOS_REGISTER.labelTertiary}
                multiline
                accessibilityLabel="Step description"
              />
              {!whatText.trim() && recentStepPrompt ? (
                <View style={styles.whatNudge}>
                  <View style={styles.whatNudgeIcon}>
                    <Ionicons name="sparkles" size={14} color={accent} />
                  </View>
                  <View style={styles.whatNudgeCopy}>
                    <Text style={styles.whatNudgeEyebrow}>I noticed</Text>
                    <Text style={styles.whatNudgeText} numberOfLines={2}>
                      {recentStepPrompt}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.whatNudgeBtn, { backgroundColor: hexWithAlpha(accent, 0.12) }]}
                    onPress={() => setWhatText(recentStepPrompt)}
                    accessibilityRole="button"
                    accessibilityLabel="Use suggested step prompt"
                  >
                    <Text style={[styles.whatNudgeBtnText, { color: accent }]}>Use</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.optEyebrow}>DETAILS</Text>
              <View style={styles.chipRow}>
                {BLANK_FIELDS.map((f) => {
                  const active = activeFields.includes(f.key);
                  return (
                    <Pressable
                      key={f.key}
                      onPress={() => insertField(f.key)}
                      style={[
                        styles.chip,
                        active && { backgroundColor: accent, borderColor: accent },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${f.label}`}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.optEyebrow}>WHO CAN SEE IT</Text>
              <StepVisibilityChip
                visibility={visibility}
                interestSlug={currentInterest?.slug}
                onChange={setVisibilityOverride}
              />

              {activeFields.length > 0 ? (
                <View style={styles.fieldStack}>
                  {activeFields.map((key) => {
                    const config = BLANK_FIELDS.find((f) => f.key === key);
                    if (!config) return null;
                    return (
                      <View key={key} style={styles.fieldCard}>
                        <View style={styles.fieldHead}>
                          <Text style={styles.fieldLabel}>{config.label}</Text>
                          <Pressable
                            style={styles.fieldRemove}
                            onPress={() => removeField(key)}
                            accessibilityLabel={`Remove ${config.label}`}
                            hitSlop={6}
                          >
                            <Ionicons name="close" size={14} color={IOS_REGISTER.labelSecondary} />
                          </Pressable>
                        </View>
                        {key === 'where' ? (
                          <ComposerWhereField
                            value={whereLocation}
                            onChange={handleWhereChange}
                            inputRef={(node) => {
                              fieldRefs.current.where = node;
                            }}
                          />
                        ) : key === 'when' ? (
                          <ComposerWhenField
                            value={whenISO}
                            onChange={(next) => setWhenISO(next ?? null)}
                          />
                        ) : (
                          <TextInput
                            ref={(node) => {
                              fieldRefs.current[key] = node;
                            }}
                            style={[styles.fieldInput, config.multiline && styles.fieldInputMultiline]}
                            value={fieldValues[key]}
                            onChangeText={(value) =>
                              setFieldValues((prev) => ({ ...prev, [key]: value }))
                            }
                            placeholder={config.placeholder}
                            placeholderTextColor={IOS_REGISTER.labelTertiary}
                            multiline={Boolean(config.multiline)}
                            accessibilityLabel={config.label}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}
              <View style={styles.sourceStack}>{sourceSections}</View>
            </ScrollView>

            <View style={styles.footerRow}>
              <Pressable
                style={styles.footerAffordance}
                accessibilityLabel={photoUri ? 'Change photo' : 'Add a photo'}
                onPress={handlePickPhoto}
              >
                {photoUri ? (
                  <View style={styles.photoThumbWrap}>
                    <Image source={{ uri: photoUri }} style={styles.photoThumb} />
                    <Pressable
                      style={styles.photoThumbRemove}
                      accessibilityLabel="Remove photo"
                      hitSlop={8}
                      onPress={() => setPhotoUri(undefined)}
                    >
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.footerIcon}>
                    <Ionicons name="image-outline" size={20} color={IOS_REGISTER.labelSecondary} />
                  </View>
                )}
                <Text style={styles.footerLabel}>{photoUri ? 'Photo added' : 'Photo'}</Text>
              </Pressable>
              {voiceEnabled ? (
                <View style={styles.micWrap}>
                  <View style={styles.footerAffordance}>
                    <Pressable
                      style={styles.mic}
                      accessibilityLabel="Open voice composer"
                      onPress={() => setVoiceVisible(true)}
                    >
                      <Ionicons name="mic" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Text style={styles.footerLabel}>Voice</Text>
                  </View>
                </View>
              ) : null}
              {onStartFromLink ? (
                <Pressable
                  style={styles.footerAffordance}
                  accessibilityLabel="Start from a link"
                  onPress={() => {
                    closeSheet();
                    onStartFromLink();
                  }}
                >
                  <View style={styles.footerIcon}>
                    <Ionicons name="link-outline" size={20} color={IOS_REGISTER.labelSecondary} />
                  </View>
                  <Text style={styles.footerLabel}>Link</Text>
                </Pressable>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      {voiceEnabled ? (
        <VoiceComposerV3Sheet
          visible={voiceVisible}
          onDismiss={() => setVoiceVisible(false)}
          onAcceptSingle={() => setVoiceVisible(false)}
          onAcceptBlock={() => setVoiceVisible(false)}
        />
      ) : null}
    </Modal>
  );
}

/** Blend a hex color with white at the given alpha for a soft tint fill. */
function hexWithAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },
  backdropHitArea: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    height: '88%',
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  dragRegion: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  composeContent: {
    padding: 16,
    paddingBottom: 96,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  save: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  kindBlock: {
    marginBottom: 18,
  },
  fieldEyebrow: {
    fontSize: 10.5,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  whatInput: {
    fontSize: 17,
    lineHeight: 23,
    color: IOS_REGISTER.label,
    minHeight: 56,
    paddingVertical: 2,
  },
  whatNudge: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  whatNudgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
  },
  whatNudgeCopy: {
    flex: 1,
    minWidth: 0,
  },
  whatNudgeEyebrow: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
  },
  whatNudgeText: {
    marginTop: 1,
    fontSize: 13.5,
    lineHeight: 18,
    color: IOS_REGISTER.label,
  },
  whatNudgeBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  whatNudgeBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  optEyebrow: {
    fontSize: 10.5,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
    backgroundColor: 'transparent',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  fieldStack: {
    marginTop: 14,
    gap: 10,
  },
  fieldCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
  },
  fieldRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
  },
  fieldInput: {
    fontSize: 15.5,
    lineHeight: 21,
    color: IOS_REGISTER.label,
    minHeight: 24,
    paddingVertical: 0,
  },
  fieldInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sourceStack: {
    marginTop: 24,
    gap: 22,
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  sheeth: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  sheethTitle: {
    fontSize: 18,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
  },
  cancel: {
    fontSize: 15.5,
    fontWeight: '600',
  },
  sbody: {
    flex: 1,
  },
  sbodyContent: {
    padding: 16,
    paddingBottom: 96,
    gap: 22,
  },
  blankrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  blankIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankText: {
    flex: 1,
  },
  blankTitle: {
    fontSize: 16,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
  },
  blankSub: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 1,
  },
  dsec: {
    gap: 10,
  },
  dsecHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dsecTitle: {
    fontSize: 13,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
  },
  loading: {
    paddingVertical: 18,
  },
  empty: {
    fontSize: 13.5,
    color: IOS_REGISTER.labelTertiary,
    paddingVertical: 8,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: IOS_REGISTER.fillPill,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.1,
    color: IOS_REGISTER.label,
  },
  emptyBody: {
    fontSize: 13.5,
    lineHeight: 18,
    color: IOS_REGISTER.labelSecondary,
  },
  emptyLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  emptyLink: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
  },
  emptyLinkText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  bpgroup: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bph: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  bpLogo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: IOS_REGISTER.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bpLogoText: {
    fontSize: 14,
    fontWeight: '800',
    color: IOS_REGISTER.cardBg,
  },
  bpText: {
    flex: 1,
  },
  bpName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  bpSub: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 1,
  },
  bpDisclosure: {
    fontSize: 11.5,
    lineHeight: 15,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  bpCount: {
    fontSize: 13,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: IOS_REGISTER.labelTertiary,
  },
  aitem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  aitemText: {
    flex: 1,
  },
  aitemTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
  },
  aitemSub: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  aitemMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  aitemMore: {
    fontSize: 12,
    fontWeight: '600',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  crossTag: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  crossTagText: {
    fontSize: 9,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: '#7C3AED',
  },
  laneRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  laneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  laneChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.label,
  },
  raceCourseSlot: {
    marginTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  footerAffordance: {
    alignItems: 'center',
    gap: 4,
  },
  footerIcon: {
    padding: 10,
  },
  footerLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  photoThumbWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  photoThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  photoThumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: IOS_REGISTER.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micWrap: {
    flex: 1,
    alignItems: 'center',
  },
  mic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: IOS_REGISTER.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StepAddSheet;
