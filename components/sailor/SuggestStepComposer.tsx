/**
 * <SuggestStepComposer> — verb-first compose sheet from design screens 02/03.
 *
 * "Suggest a step is a first-class verb on the third-person view."
 *   — docs/redesign/v3 · screens 02–03
 *
 * Modal slides up over the public-face surface. Fields:
 *   - To:  (read-only) recipient avatar + name
 *   - re:  optional recipient-step context chip (display-only in v1)
 *   - Body voice-or-text input
 *   - Send → inserts into step_suggestions and lands in recipient's Inbox
 *
 * source_step_id is nullable as of migration
 * 20260524220000_v3_peer_reflections_and_freeform_suggestions — Send writes
 * NULL so the recipient sees a true free-form suggestion rather than a
 * sender-side step shoehorned in.
 */

import React, { useCallback, useState } from 'react';
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
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import { useQueryClient } from '@tanstack/react-query';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';

export interface SuggestStepComposerProps {
  visible: boolean;
  onClose: () => void;
  /** Recipient's auth.users.id. */
  recipientId: string;
  /** Recipient display name — drives the title and the To: row. */
  recipientName: string;
  /** Optional recipient initials for the avatar circle. */
  recipientInitials?: string;
  /** Optional avatar tint background for the recipient. */
  recipientTint?: string;
  /** Optional "re:" context label — usually what the recipient is working on. */
  reContext?: string | null;
}

export function SuggestStepComposer({
  visible,
  onClose,
  recipientId,
  recipientName,
  recipientInitials,
  recipientTint,
  reContext,
}: SuggestStepComposerProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = body.trim().length > 0 && !sending;

  const handleClose = useCallback(() => {
    if (sending) return;
    setBody('');
    onClose();
  }, [sending, onClose]);

  const handleSend = useCallback(async () => {
    if (!user?.id) return;
    setSending(true);
    const { error } = await supabase.from('step_suggestions').insert({
      source_user_id: user.id,
      target_user_id: recipientId,
      source_step_id: null,
      message: body.trim(),
      status: 'pending',
    });
    setSending(false);
    if (error) {
      toast.show('Could not send suggestion', 'error');
      return;
    }
    qc.invalidateQueries({ queryKey: ['practice-inbox-items'] });
    qc.invalidateQueries({ queryKey: ['practice-inbox-count'] });
    toast.show(`Suggestion sent to ${recipientName.split(' ')[0]}`, 'success');
    setBody('');
    onClose();
  }, [user?.id, recipientId, recipientName, body, toast, qc, onClose]);

  const initials = recipientInitials ?? recipientName.charAt(0).toUpperCase();
  const tint = recipientTint ?? IOS_COLORS.systemGray3;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
          <View style={styles.headerBar}>
            <Pressable onPress={handleClose} hitSlop={8} disabled={sending}>
              <Text style={[styles.headerBtn, sending && styles.headerBtnDisabled]}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Suggest a <Text style={styles.headerTitleItalic}>step</Text> to {recipientName.split(' ')[0]}
            </Text>
            <Pressable onPress={handleSend} hitSlop={8} disabled={!canSend}>
              {sending ? (
                <ActivityIndicator color={IOS_COLORS.systemBlue} size="small" />
              ) : (
                <Text style={[styles.headerBtn, !canSend && styles.headerBtnDisabled]}>Send</Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>To:</Text>
              <View style={styles.recipientChip}>
                <View style={[styles.recipientAvatar, { backgroundColor: tint }]}>
                  <Text style={styles.recipientAvatarText}>{initials}</Text>
                </View>
                <Text style={styles.recipientName} numberOfLines={1}>
                  {recipientName}
                </Text>
              </View>
              {reContext ? (
                <>
                  <Text style={styles.metaLabel}>re:</Text>
                  <View style={styles.reChip}>
                    <Ionicons name="flag-outline" size={12} color={IOS_REGISTER.labelSecondary} />
                    <Text style={styles.reChipText} numberOfLines={1}>
                      {reContext}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            <TextInput
              style={styles.body}
              value={body}
              onChangeText={setBody}
              placeholder="A sub-step on… From what I saw in… might be worth a look before…"
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable hitSlop={8} style={styles.footerIcon}>
              <Ionicons name="image-outline" size={20} color={IOS_REGISTER.labelSecondary} />
            </Pressable>
            <View style={styles.footerMic}>
              <Ionicons name="mic" size={20} color="#FFFFFF" />
            </View>
            <Pressable hitSlop={8} style={styles.footerIcon}>
              <Ionicons name="link-outline" size={20} color={IOS_REGISTER.labelSecondary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: IOS_REGISTER.cardBg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
    gap: 10,
  },
  headerBtn: {
    fontSize: 15,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  headerBtnDisabled: {
    color: IOS_REGISTER.labelTertiary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  headerTitleItalic: {
    fontStyle: 'italic',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 12 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 12,
    paddingBottom: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  recipientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  recipientAvatar: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientAvatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  recipientName: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    maxWidth: 180,
  },
  reChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  reChipText: {
    fontSize: 13,
    color: IOS_REGISTER.label,
    fontWeight: '500',
    maxWidth: 180,
  },
  body: {
    minHeight: 160,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 14,
    fontSize: 16,
    lineHeight: 22,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  footerIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerMic: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
