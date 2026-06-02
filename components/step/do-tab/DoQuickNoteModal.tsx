import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IOS_BLUE = '#007AFF';
const GRAY_5 = '#E5E5EA';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';
const SCRIM = 'rgba(15, 14, 12, 0.42)';
const SHEET_BG = '#FFFFFF';

export interface DoQuickNoteModalProps {
  /** Sheet visibility. */
  visible: boolean;
  /** Dismiss callback (X tap, scrim tap, hardware back, Cancel). */
  onClose: () => void;
  /** Submit callback — receives the trimmed note text. */
  onSubmit: (text: string) => void;
  /** Header title; defaults to "Add a quick note". */
  title?: string;
  /** Optional subtitle rendered under the title. */
  subtitle?: string;
  /** Placeholder rendered inside the TextInput. */
  placeholder?: string;
  /** Pre-fills the input when editing an existing note; empty for new captures. */
  initialText?: string;
}

/**
 * Phase B.7 · Quick-note capture input.
 *
 * Small modal used by the Frame 2 composer's quick-note + voice affordances
 * (voice routes here in v1 since no native voice capture exists for Practice
 * Do — see PHASE_B7_DO_TAB_INTERIOR_SPEC.md Commit 2 verification notes).
 * Submits a single trimmed string back to the caller, which writes it into
 * metadata.act.observations[] via StepDrawContent's existing
 * handleAddObservation path.
 */
export function DoQuickNoteModal({
  visible,
  onClose,
  onSubmit,
  title = 'Add a quick note',
  subtitle,
  placeholder = 'What did you notice?',
  initialText = '',
}: DoQuickNoteModalProps) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) setText(initialText);
    else setText('');
  }, [visible, initialText]);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSubmit(trimmed);
    setText('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable accessibilityLabel="Dismiss" onPress={onClose} style={styles.scrim}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kbWrap}
        >
          <Pressable
            accessibilityRole="none"
            onPress={(e: { stopPropagation?: () => void }) => e.stopPropagation?.()}
            style={styles.sheet}
          >
            <View style={styles.head}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={styles.dismiss}
                hitSlop={8}
              >
                <Ionicons name="close" size={15} color={LABEL_2} />
              </Pressable>
            </View>

            <TextInput
              accessibilityLabel="Quick note text"
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              placeholderTextColor={LABEL_3}
              multiline
              autoFocus
              style={styles.input}
            />

            <View style={styles.foot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save quick note"
                accessibilityState={{ disabled: !canSave }}
                disabled={!canSave}
                onPress={canSave ? handleSave : undefined}
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && canSave && styles.saveBtnPressed,
                  !canSave && styles.saveBtnDisabled,
                ]}
              >
                <Text style={styles.saveLbl}>Save note</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onClose}
                style={styles.cancelBtn}
                hitSlop={6}
              >
                <Text style={styles.cancelLbl}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: 'flex-end',
  },
  kbWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    paddingBottom: 24,
  },
  head: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  titleWrap: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.32,
    color: LABEL,
    lineHeight: 22,
  },
  sub: {
    fontSize: 12,
    color: LABEL_3,
    letterSpacing: -0.05,
  },
  dismiss: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GRAY_5,
  },
  input: {
    marginHorizontal: 16,
    marginTop: 14,
    minHeight: 96,
    fontSize: 15,
    lineHeight: 21,
    color: LABEL,
    letterSpacing: -0.15,
    textAlignVertical: 'top',
  },
  foot: {
    marginTop: 18,
    paddingHorizontal: 16,
    gap: 10,
  },
  saveBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: IOS_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  saveBtnPressed: {
    opacity: 0.85,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveLbl: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  cancelBtn: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLbl: {
    fontSize: 14,
    fontWeight: '500',
    color: LABEL_3,
  },
});
