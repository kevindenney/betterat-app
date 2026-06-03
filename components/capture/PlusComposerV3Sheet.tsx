/**
 * PlusComposerV3Sheet — canonical Screen 11 from the v3 zoom screens.
 *
 * "The + button only ever does two things — ad-hoc at the timeline,
 * sub-step inside a step. Voice routes through one composer."
 *
 * This is the ad-hoc-at-timeline variant: a focused single-purpose
 * "Add a step" sheet replacing the legacy multi-option
 * UniversalPlusSheet. Composition top → bottom:
 *
 *   - Nav row: Cancel · "Add a step" title · Save
 *   - Lane chips: pre-filled interest + session ("⚲ Sailing · Spring Series '26")
 *   - Text field: serif italic when empty (the prompt copy from the design)
 *   - Suggested tag chips: "+ tactics", "+ Saturday", "+ Sam"
 *   - Lilac "❋ THE LIBRARIAN NOTICED" hint card with two CTAs
 *     (Keep standalone / Group as sub-step) — placeholder for now;
 *     real librarian routing wires in when the suggestion-AI lands.
 *   - Bottom row: photo · voice mic · share-link icons (mic is the
 *     focal affordance per the canonical)
 *
 * Behind FEATURE_FLAGS.PLUS_COMPOSER_V3. When off, the legacy
 * UniversalPlusSheet still renders.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type { QuickCapturePayload } from '@/services/QuickCaptureService';
import type { RacePlan, StepLocation } from '@/types/step-detail';
import { VoiceComposerV3Sheet } from './VoiceComposerV3Sheet';
import { ComposerWhereField } from './ComposerWhereField';
import { PlanStepRaceSelector } from '@/components/step/plan-tab/PlanStepRaceSelector';
import { RaceCoursePicker } from './RaceCoursePicker';

const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

const LILAC = '#AF52DE';
const LILAC_SOFT = 'rgba(175, 82, 222, 0.10)';
const LILAC_BORDER = 'rgba(175, 82, 222, 0.28)';

interface PlusComposerV3SheetProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (payload: QuickCapturePayload) => void;
  /** Rare secondary path: build a first plan from an external URL/text source. */
  onStartFromLink?: () => void;
  /** Pre-filled interest label for the lane chip, e.g. "Sailing". */
  interestLabel?: string | null;
  /** Pre-filled session/season label for the lane chip, e.g. "Spring Series '26". */
  sessionLabel?: string | null;
  /** Suggested field chips. v1 = hand-authored. v2 = AI-suggested from context. */
  suggestedFields?: string[];
  /**
   * Sailing only — renders the Step ⟷ Race selector at the top of the composer
   * (mockup 27). Choosing Race flags the new step `is_race`, giving it the ⛵
   * Atlas pin + course/marks/conditions cockpit. The course geometry itself is
   * authored later in the step's Plan tab; here we only set the flag.
   */
  showRaceSelector?: boolean;
  /**
   * The user's home venue — keys the racing-area lookup in the inline "Race
   * area & course" reveal. Only consumed when showRaceSelector is true and the
   * step is flagged a Race.
   */
  venueId?: string | null;
  venueName?: string | null;
  /**
   * AI librarian hint surfaced when the typed input looks like it belongs
   * under an existing step. v1 = absent; v2 = real AI routing. When passed,
   * the lilac card renders with the two CTAs.
   */
  librarianHint?: {
    body: string;
    onGroupAsSubStep: () => void;
  };
}

type ComposerFieldKey = 'why' | 'how' | 'when' | 'where';

const DEFAULT_SUGGESTED_FIELDS: ComposerFieldKey[] = ['why', 'how', 'when', 'where'];

const OPTIONAL_FIELDS: {
  key: ComposerFieldKey;
  label: string;
  placeholder: string;
  multiline?: boolean;
}[] = [
  { key: 'why', label: 'Why', placeholder: 'Why does this matter right now?', multiline: true },
  { key: 'how', label: 'How', placeholder: 'How will you do it?', multiline: true },
  { key: 'when', label: 'When', placeholder: 'When will you do this?' },
  { key: 'where', label: 'Where', placeholder: 'Where will this happen?' },
];

const FIELD_ORDER = OPTIONAL_FIELDS.map((field) => field.key);

function emptyFieldValues(): Record<ComposerFieldKey, string> {
  return {
    why: '',
    how: '',
    when: '',
    where: '',
  };
}

export function PlusComposerV3Sheet({
  visible,
  onDismiss,
  onSave,
  onStartFromLink,
  interestLabel,
  sessionLabel,
  suggestedFields = DEFAULT_SUGGESTED_FIELDS,
  librarianHint,
  showRaceSelector = false,
  venueId,
  venueName,
}: PlusComposerV3SheetProps) {
  const [whatText, setWhatText] = useState('');
  const [isRace, setIsRace] = useState(false);
  const [racePlan, setRacePlan] = useState<RacePlan>({});
  const [activeFields, setActiveFields] = useState<ComposerFieldKey[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<ComposerFieldKey, string>>(emptyFieldValues);
  const [whereLocation, setWhereLocation] = useState<StepLocation | undefined>(undefined);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const voiceEnabled = FEATURE_FLAGS.VOICE_COMPOSER_V3;
  const whatInputRef = useRef<TextInput | null>(null);
  const optionalFieldRefs = useRef<Partial<Record<ComposerFieldKey, TextInput | null>>>({});

  const resetComposer = useCallback(() => {
    setWhatText('');
    setIsRace(false);
    setRacePlan({});
    setActiveFields([]);
    setFieldValues(emptyFieldValues());
    setWhereLocation(undefined);
    setPhotoUri(undefined);
  }, []);

  // A fully-specified race already names itself (area · course), so don't force
  // a separate WHAT title — fall back to the race plan when WHAT is blank.
  const raceTitleFallback =
    showRaceSelector && isRace
      ? [racePlan.area_name, racePlan.course_label].filter(Boolean).join(' · ')
      : '';

  const handleSave = useCallback(() => {
    const trimmedWhat = whatText.trim() || raceTitleFallback;
    if (!trimmedWhat) {
      onDismiss();
      return;
    }
    // Title = WHAT only. Why/How/When ride along as structured fields so the
    // save path maps them to plan + description instead of jamming everything
    // into the title.
    onSave({
      kind: 'text',
      content: trimmedWhat,
      location: whereLocation,
      why: fieldValues.why.trim() || undefined,
      how: fieldValues.how.trim() || undefined,
      when: fieldValues.when.trim() || undefined,
      isRace: showRaceSelector ? isRace : undefined,
      racePlan: showRaceSelector && isRace ? racePlan : undefined,
      imageUri: photoUri,
    });
    resetComposer();
  }, [whatText, raceTitleFallback, fieldValues, whereLocation, photoUri, showRaceSelector, isRace, racePlan, onSave, onDismiss, resetComposer]);

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

  const handleCancel = useCallback(() => {
    resetComposer();
    onDismiss();
  }, [onDismiss, resetComposer]);

  const insertField = useCallback((fieldKey: ComposerFieldKey) => {
    setActiveFields((prev) => {
      if (prev.includes(fieldKey)) return prev;
      return [...prev, fieldKey].sort(
        (a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b),
      );
    });
    requestAnimationFrame(() => {
      optionalFieldRefs.current[fieldKey]?.focus();
    });
  }, []);

  const removeField = useCallback((fieldKey: ComposerFieldKey) => {
    setActiveFields((prev) => prev.filter((key) => key !== fieldKey));
    setFieldValues((prev) => ({ ...prev, [fieldKey]: '' }));
    if (fieldKey === 'where') setWhereLocation(undefined);
    requestAnimationFrame(() => {
      whatInputRef.current?.focus();
    });
  }, []);

  const handleWhereChange = useCallback((next: StepLocation | undefined) => {
    setWhereLocation(next);
    // Keep the text payload in sync so the saved title still reads
    // "Where: <name>" even though the structured location is the source of truth.
    setFieldValues((prev) => ({ ...prev, where: next?.name ?? '' }));
  }, []);

  const canSave = (whatText.trim() || raceTitleFallback).length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.surface} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'android' ? 'height' : undefined}
        >
          <View style={styles.navBar}>
            <Pressable onPress={handleCancel} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.navTitle}>
              Add a <Text style={styles.navTitleItalic}>{showRaceSelector && isRace ? 'race' : 'step'}</Text>
            </Text>
            <Pressable onPress={handleSave} hitSlop={8} disabled={!canSave}>
              <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            {(interestLabel || sessionLabel) ? (
              <View style={styles.laneRow}>
                {interestLabel ? (
                  <View style={styles.laneChip}>
                    <Ionicons name="ellipse" size={8} color={IOS_REGISTER.label} />
                    <Text style={styles.laneChipText}>{interestLabel}</Text>
                  </View>
                ) : null}
                {sessionLabel ? (
                  <View style={styles.laneChip}>
                    <Text style={styles.laneChipText}>{sessionLabel}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {showRaceSelector ? (
              <View style={styles.raceSelectorSlot}>
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

            <Text style={styles.eyebrow}>WHAT</Text>
            <TextInput
              style={styles.input}
              ref={whatInputRef}
              value={whatText}
              onChangeText={setWhatText}
              placeholder="What do you want to work on?"
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              multiline
              autoFocus
              accessibilityLabel="Step description"
            />

            {suggestedFields.length > 0 ? (
              <>
                <Text style={styles.contextEyebrow}>OPTIONAL FIELDS</Text>
                <View style={styles.tagRow}>
                  {suggestedFields.map((field) => {
                    const config = OPTIONAL_FIELDS.find((item) => item.key === field);
                    if (!config) return null;
                    const active = activeFields.includes(field);
                    return (
                      <Pressable
                        key={field}
                        style={[styles.tagChip, active && styles.tagChipActive]}
                        onPress={() => insertField(field)}
                      >
                        <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                          {config.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {activeFields.length > 0 ? (
              <View style={styles.optionalFieldStack}>
                {activeFields.map((fieldKey) => {
                  const config = OPTIONAL_FIELDS.find((item) => item.key === fieldKey);
                  if (!config) return null;
                  return (
                    <View key={fieldKey} style={styles.optionalFieldCard}>
                      <View style={styles.optionalFieldHeader}>
                        <Text style={styles.optionalFieldLabel}>{config.label}</Text>
                        <Pressable
                          style={styles.optionalFieldRemove}
                          onPress={() => removeField(fieldKey)}
                          accessibilityLabel={`Remove ${config.label} field`}
                        >
                          <Ionicons name="close" size={14} color={IOS_REGISTER.labelSecondary} />
                        </Pressable>
                      </View>
                      {fieldKey === 'where' ? (
                        <ComposerWhereField
                          value={whereLocation}
                          onChange={handleWhereChange}
                          inputRef={(node) => {
                            optionalFieldRefs.current.where = node;
                          }}
                        />
                      ) : (
                        <TextInput
                          ref={(node) => {
                            optionalFieldRefs.current[fieldKey] = node;
                          }}
                          style={[
                            styles.optionalFieldInput,
                            config.multiline && styles.optionalFieldInputMultiline,
                          ]}
                          value={fieldValues[fieldKey]}
                          onChangeText={(value) => {
                            setFieldValues((prev) => ({ ...prev, [fieldKey]: value }));
                          }}
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

            {librarianHint ? (
              <View style={styles.librarianCard}>
                <Text style={styles.librarianEyebrow}>❋ THE LIBRARIAN NOTICED</Text>
                <Text style={styles.librarianBody}>{librarianHint.body}</Text>
                <View style={styles.librarianActions}>
                  <Pressable style={styles.ghostBtn} onPress={handleSave}>
                    <Text style={styles.ghostBtnText}>Keep standalone</Text>
                  </Pressable>
                  <Pressable
                    style={styles.lilacBtn}
                    onPress={librarianHint.onGroupAsSubStep}
                  >
                    <Text style={styles.lilacBtnText}>Group as sub-step</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Voice-first affordance row. v1 is a visual placeholder — the
              full Screen-13 voice-first composer ships in a follow-up. */}
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
            <Pressable
              style={styles.footerAffordance}
              accessibilityLabel="Start from a link"
              onPress={onStartFromLink}
              disabled={!onStartFromLink}
            >
              <View style={styles.footerIcon}>
                <Ionicons name="link-outline" size={20} color={IOS_REGISTER.labelSecondary} />
              </View>
              <Text style={styles.footerLabel}>Link</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {voiceEnabled ? (
        <VoiceComposerV3Sheet
          visible={voiceVisible}
          onDismiss={() => setVoiceVisible(false)}
          onAcceptSingle={() => {
            // v1: "just one step" from voice = no-op stub. Real flow
            // will pipe the transcript into onSave as a single step.
            setVoiceVisible(false);
          }}
          onAcceptBlock={() => {
            // v1: "add as N-step block" stub — real flow creates a
            // structured set of sub-steps from the AI proposal.
            setVoiceVisible(false);
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  flex: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  cancelText: {
    fontSize: 15,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  navTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
  },
  navTitleItalic: {
    fontStyle: 'italic',
  },
  saveText: {
    fontSize: 15,
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
  saveTextDisabled: {
    color: IOS_REGISTER.labelTertiary,
    fontWeight: '500',
  },
  body: {
    padding: IOS_SPACING.lg,
    paddingBottom: 40,
  },
  laneRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
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
  raceSelectorSlot: {
    marginBottom: 18,
  },
  raceCourseSlot: {
    marginTop: 12,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 6,
  },
  input: {
    fontSize: 18,
    lineHeight: 24,
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
    minHeight: 72,
    paddingVertical: 4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  contextEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 18,
    marginBottom: 2,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
    backgroundColor: 'transparent',
  },
  tagChipActive: {
    backgroundColor: IOS_REGISTER.accentMarkedContent,
    borderColor: IOS_REGISTER.accentMarkedContent,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  tagChipTextActive: {
    color: '#FFFFFF',
  },
  optionalFieldStack: {
    marginTop: 14,
    gap: 10,
  },
  optionalFieldCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  optionalFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  optionalFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
  },
  optionalFieldRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
  },
  optionalFieldInput: {
    fontSize: 16,
    lineHeight: 22,
    color: IOS_REGISTER.label,
    minHeight: 26,
    paddingVertical: 0,
  },
  optionalFieldInputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  librarianCard: {
    marginTop: 22,
    backgroundColor: LILAC_SOFT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
    borderRadius: 14,
    padding: 14,
  },
  librarianEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: LILAC,
    marginBottom: 8,
  },
  librarianBody: {
    fontSize: 13.5,
    lineHeight: 19,
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
  },
  librarianActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  ghostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
  },
  ghostBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  lilacBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: LILAC,
  },
  lilacBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: IOS_SPACING.lg,
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
  footerLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
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
