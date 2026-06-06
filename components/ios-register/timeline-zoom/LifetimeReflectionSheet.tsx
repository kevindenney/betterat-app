/**
 * LifetimeReflectionSheet — the destination for the L4 librarian's
 * "Start a reflection" CTA. A reflection is the *backward* pass across
 * the whole practice; the lifetime vision is the *forward* statement it
 * earns. So this sheet opens on a recap of where you've been (real
 * scale numbers + the through-line capability), offers a few questions
 * to think with, then lands on a single input whose output IS the
 * lifetime vision (user_interests.lifetime_vision_statement).
 *
 * Lightweight by design: the reflection refines the vision rather than
 * persisting a separate dated logbook entry. Reuses the same save path
 * as LifetimeVisionEditSheet so reflecting and editing write the same
 * field — graduating to a stored reflection history is a later step.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

export interface ReflectionRecap {
  totalSteps: number;
  arcCount: number;
  peopleCount: number;
  throughLine: { label: string; color: string } | null;
  duration: string | null;
  since: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  interestLabel: string;
  recap: ReflectionRecap;
  initialStatement: string | null | undefined;
  /** Persona-aware placeholder for the forward statement. */
  placeholder: string;
  onSave: (statement: string | null) => Promise<void> | void;
}

const LILAC = '#AF52DE';
const SERIF = fontFamily.serif;

// Universal reflection prompts — read-only scaffolding to think with.
// Persona-neutral so they work across sailor / nurse / entrepreneur;
// the input below them is where the answer lands as the vision.
const PROMPTS = [
  "What's changed in how you practice since you started?",
  "Who's mattered most along the way?",
  'What are you really building toward now?',
];

export function LifetimeReflectionSheet({
  visible,
  onClose,
  interestLabel,
  recap,
  initialStatement,
  placeholder,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [statement, setStatement] = useState(initialStatement ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setStatement(initialStatement ?? '');
  }, [visible, initialStatement]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const trimmed = statement.trim();
      await onSave(trimmed.length > 0 ? trimmed : null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const stepsWord = recap.totalSteps === 1 ? 'step' : 'steps';
  const peopleWord = recap.peopleCount === 1 ? 'person' : 'people';
  const recapSentence = `You're ${recap.totalSteps} ${stepsWord} into ${interestLabel}${
    recap.duration ? `, over ${recap.duration}` : ''
  }.`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.host}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable hitSlop={8} onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Reflection</Text>
          <Pressable
            hitSlop={8}
            onPress={handleSave}
            disabled={saving}
            style={styles.headerBtn}
          >
            {saving ? (
              <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
            ) : (
              <Text style={styles.save}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Looking back — the recap that earns the forward statement. */}
          <View style={styles.eyebrowRow}>
            <Ionicons name="book-outline" size={12} color={LILAC} />
            <Text style={styles.eyebrow}>Looking back</Text>
          </View>
          <Text style={styles.recapSentence}>{recapSentence}</Text>
          <View style={styles.recapMeta}>
            {recap.throughLine ? (
              <View style={styles.recapMetaRow}>
                <View
                  style={[
                    styles.recapDot,
                    { backgroundColor: recap.throughLine.color },
                  ]}
                />
                <Text style={styles.recapMetaText}>
                  <Text style={styles.recapMetaStrong}>
                    {recap.throughLine.label}
                  </Text>{' '}
                  has been your through-line.
                </Text>
              </View>
            ) : null}
            {recap.peopleCount > 0 ? (
              <Text style={styles.recapMetaText}>
                <Text style={styles.recapMetaStrong}>{recap.peopleCount}</Text>{' '}
                {peopleWord} along the way
                {recap.since ? ` · since ${recap.since}` : ''}.
              </Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* A few questions to think with — not stored, just scaffolding. */}
          <Text style={styles.promptsEyebrow}>Worth sitting with</Text>
          <View style={styles.prompts}>
            {PROMPTS.map((p) => (
              <View key={p} style={styles.promptRow}>
                <Text style={styles.promptBullet}>—</Text>
                <Text style={styles.promptText}>{p}</Text>
              </View>
            ))}
          </View>

          {/* Looking forward — the answer that becomes the lifetime vision. */}
          <View style={[styles.eyebrowRow, styles.forwardEyebrowRow]}>
            <Ionicons name="sparkles" size={12} color="#7B3FB0" />
            <Text style={styles.forwardEyebrow}>Where you're going now</Text>
          </View>
          <TextInput
            style={styles.input}
            value={statement}
            onChangeText={setStatement}
            placeholder={placeholder}
            placeholderTextColor={IOS_REGISTER.labelTertiary}
            multiline
            autoFocus
            scrollEnabled
            textAlignVertical="top"
          />
          <Text style={styles.hint}>
            This becomes your lifetime vision — big enough to outlast a single
            season, small enough that you can picture it.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
    backgroundColor: IOS_REGISTER.cardBg,
  },
  headerBtn: {
    minWidth: 60,
  },
  cancel: {
    fontSize: 15,
    color: IOS_REGISTER.labelSecondary,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  save: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_REGISTER.accentUserAction,
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: IOS_SPACING.lg,
    paddingBottom: 60,
    gap: 10,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: LILAC,
  },
  recapSentence: {
    fontFamily: SERIF,
    fontSize: 19,
    lineHeight: 26,
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  recapMeta: {
    gap: 5,
    marginTop: 2,
  },
  recapMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  recapDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recapMetaText: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  recapMetaStrong: {
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_REGISTER.separator,
    marginVertical: 6,
  },
  promptsEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
  },
  prompts: {
    gap: 6,
  },
  promptRow: {
    flexDirection: 'row',
    gap: 8,
  },
  promptBullet: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.labelTertiary,
  },
  promptText: {
    flex: 1,
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.labelSecondary,
  },
  forwardEyebrowRow: {
    marginTop: 8,
  },
  forwardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#7B3FB0',
  },
  input: {
    minHeight: 120,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    padding: IOS_SPACING.md,
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 26,
    color: IOS_REGISTER.label,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  hint: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
});

export default LifetimeReflectionSheet;
