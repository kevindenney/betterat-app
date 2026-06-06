/**
 * LifetimeVisionEditSheet — edit user_interests.lifetime_vision_statement
 * for the active interest. Distinct from the season VisionEditSheet
 * (which writes vision_statement on a plan or user_interests) so each
 * surface owns its own anchor without mutual overwrite.
 *
 * Plain text-only sheet — lifetime vision is a single italic-serif
 * north-star sentence; no competency anchors or org-framework
 * coupling. Phase D D5 closer.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialStatement: string | null | undefined;
  /** Persona-aware placeholder prompt — passes vocab.verb.mid so the
   *  empty-state copy matches the surface's voice. */
  placeholder: string;
  onSave: (statement: string | null) => Promise<void> | void;
}

export function LifetimeVisionEditSheet({
  visible,
  onClose,
  initialStatement,
  placeholder,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [statement, setStatement] = useState(initialStatement ?? '');
  const [saving, setSaving] = useState(false);

  // Re-seed on open so reopening after edit-then-cancel shows the
  // saved value, not the abandoned draft.
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
          <Text style={styles.title}>Lifetime vision</Text>
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

        <View style={styles.body}>
          <View style={styles.eyebrowRow}>
            <Ionicons name="sparkles" size={12} color="#7B3FB0" />
            <Text style={styles.eyebrow}>Where you're going, long-term</Text>
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
            Big enough to outlast a single season. Small enough that you can
            picture it.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const SERIF = fontFamily.serif;

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
  body: {
    flex: 1,
    padding: IOS_SPACING.lg,
    gap: 12,
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

export default LifetimeVisionEditSheet;
