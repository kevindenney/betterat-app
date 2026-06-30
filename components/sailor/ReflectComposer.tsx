/**
 * <ReflectComposer> — leave a peer reflection on another practitioner's work.
 *
 * Sibling to <SuggestStepComposer>: Suggest writes a forward-looking step into
 * the recipient's Inbox; Reflect writes a backward-looking note on what they've
 * already done. One `peer_reflections` row per send (via ReflectionService),
 * which surfaces in the recipient's Inbox Read segment.
 *
 * Body-only — there's no step picker, since a reflection is freeform prose, not
 * a forkable artifact.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReflectionService } from '@/services/ReflectionService';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import { useQueryClient } from '@tanstack/react-query';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';

export interface ReflectComposerProps {
  visible: boolean;
  onClose: () => void;
  /** Recipient's auth.users.id — whose practice this reflects on. */
  recipientId: string;
  /** Recipient display name — drives the title and the On: row. */
  recipientName: string;
  /** Optional recipient initials for the avatar circle. */
  recipientInitials?: string;
  /** Optional avatar tint background for the recipient. */
  recipientTint?: string;
}

export function ReflectComposer({
  visible,
  onClose,
  recipientId,
  recipientName,
  recipientInitials,
  recipientTint,
}: ReflectComposerProps) {
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
    try {
      await ReflectionService.leave({
        sourceUserId: user.id,
        targetUserId: recipientId,
        body: body.trim(),
      });
    } catch (e) {
      setSending(false);
      toast.show(e instanceof Error ? e.message : 'Could not send reflection', 'error');
      return;
    }
    setSending(false);
    qc.invalidateQueries({ queryKey: ['practice-inbox-items'] });
    qc.invalidateQueries({ queryKey: ['practice-inbox-count'] });
    toast.show(`Reflection sent to ${recipientName.split(' ')[0]}`, 'success');
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
              <Text style={styles.headerTitleItalic}>Reflect</Text> on {recipientName.split(' ')[0]}
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
              <Text style={styles.metaLabel}>On:</Text>
              <View style={styles.recipientChip}>
                <View style={[styles.recipientAvatar, { backgroundColor: tint }]}>
                  <Text style={styles.recipientAvatarText}>{initials}</Text>
                </View>
                <Text style={styles.recipientName} numberOfLines={1}>
                  {recipientName}
                </Text>
              </View>
            </View>

            <TextInput
              style={styles.body}
              value={body}
              onChangeText={setBody}
              placeholder={`What stood out about ${recipientName.split(' ')[0]}'s practice? What might help them next?`}
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </ScrollView>
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
  body: {
    minHeight: 200,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 14,
    fontSize: 16,
    lineHeight: 22,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
});
