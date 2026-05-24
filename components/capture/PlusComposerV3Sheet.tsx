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

import React, { useCallback, useState } from 'react';
import {
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
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import type { QuickCapturePayload } from '@/services/QuickCaptureService';
import { VoiceComposerV3Sheet } from './VoiceComposerV3Sheet';

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
  /** Pre-filled interest label for the lane chip, e.g. "Sailing". */
  interestLabel?: string | null;
  /** Pre-filled session/season label for the lane chip, e.g. "Spring Series '26". */
  sessionLabel?: string | null;
  /** Suggested tag chips. v1 = hand-authored. v2 = AI-suggested from context. */
  suggestedTags?: string[];
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

const DEFAULT_SUGGESTED: string[] = ['+ tactics', '+ Sam', '+ Saturday', '+ Causeway Bay'];

export function PlusComposerV3Sheet({
  visible,
  onDismiss,
  onSave,
  interestLabel,
  sessionLabel,
  suggestedTags = DEFAULT_SUGGESTED,
  librarianHint,
}: PlusComposerV3SheetProps) {
  const [text, setText] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const voiceEnabled = FEATURE_FLAGS.VOICE_COMPOSER_V3;

  const handleSave = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      onDismiss();
      return;
    }
    const body = activeTags.length > 0
      ? `${trimmed}\n\n${activeTags.map((t) => `#${t.replace(/^[+\s]+/, '')}`).join(' ')}`
      : trimmed;
    onSave({ kind: 'text', content: body });
    setText('');
    setActiveTags([]);
  }, [text, activeTags, onSave, onDismiss]);

  const handleCancel = useCallback(() => {
    setText('');
    setActiveTags([]);
    onDismiss();
  }, [onDismiss]);

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const trimmedLength = text.trim().length;

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
          behavior={Platform.select({ ios: 'padding', default: undefined })}
        >
          <View style={styles.navBar}>
            <Pressable onPress={handleCancel} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.navTitle}>Add a <Text style={styles.navTitleItalic}>step</Text></Text>
            <Pressable onPress={handleSave} hitSlop={8} disabled={trimmedLength === 0}>
              <Text style={[styles.saveText, trimmedLength === 0 && styles.saveTextDisabled]}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
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

            <Text style={styles.eyebrow}>WHAT</Text>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Try Sunita's spinnaker tip on Saturday's downwind leg"
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              multiline
              autoFocus
              accessibilityLabel="Step description"
            />

            {suggestedTags.length > 0 ? (
              <View style={styles.tagRow}>
                {suggestedTags.map((tag) => {
                  const active = activeTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      style={[styles.tagChip, active && styles.tagChipActive]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                        {tag}
                      </Text>
                    </Pressable>
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
            <Pressable style={styles.footerIcon} accessibilityLabel="Add photo">
              <Ionicons name="image-outline" size={20} color={IOS_REGISTER.labelSecondary} />
            </Pressable>
            <View style={styles.micWrap}>
              <Pressable
                style={styles.mic}
                accessibilityLabel={
                  voiceEnabled
                    ? 'Open voice composer'
                    : 'Voice input — coming soon'
                }
                onPress={voiceEnabled ? () => setVoiceVisible(true) : undefined}
              >
                <Ionicons name="mic" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
            <Pressable style={styles.footerIcon} accessibilityLabel="Attach link">
              <Ionicons name="link-outline" size={20} color={IOS_REGISTER.labelSecondary} />
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
    minHeight: 80,
    paddingVertical: 4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 18,
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
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  footerIcon: {
    padding: 10,
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
