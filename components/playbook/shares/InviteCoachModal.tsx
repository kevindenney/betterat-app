/**
 * InviteCoachModal — simple email-based invite flow for playbook shares.
 *
 * Creates a pending `playbook_shares` row via `useCreatePlaybookShare`. v1 is
 * `role='view'` only. A follow-up can add user search against profiles + an
 * email notification via the existing `send-email` edge function; for now the
 * invitee accepts by navigating to `/library/shared/:playbookId` while
 * authenticated as the invited email.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useCreatePlaybookShare } from '@/hooks/usePlaybook';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { supabase } from '@/services/supabase';

interface InviteCoachModalProps {
  visible: boolean;
  playbookId: string | undefined;
  onClose: () => void;
}

export function InviteCoachModal({
  visible,
  playbookId,
  onClose,
}: InviteCoachModalProps) {
  const [email, setEmail] = useState('');
  const createShare = useCreatePlaybookShare();

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed || !playbookId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showAlert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    try {
      await createShare.mutateAsync({
        playbook_id: playbookId,
        shared_with_email: trimmed,
      });
      // Send invite email (fire-and-forget — share already created)
      const shareUrl = `${window.location.origin}/playbook/shared/${playbookId}`;
      supabase.functions.invoke('send-email', {
        body: {
          to: trimmed,
          subject: 'You\'ve been invited to view a Playbook on BetterAt',
          html: `<p>Someone shared their Playbook with you on BetterAt.</p>
<p><a href="${shareUrl}">View Playbook</a></p>
<p>Sign in with this email address (${trimmed}) to access it.</p>`,
        },
      }).catch(() => {});
      setEmail('');
      onClose();
      showAlert(
        'Invite sent',
        `${trimmed} now has read-only access and will receive an email with the link.`,
      );
    } catch (err) {
      showAlert(
        'Invite failed',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  };

  const handleClose = () => {
    setEmail('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Invite</Text>
          <Pressable
            onPress={handleInvite}
            disabled={!email.trim() || createShare.isPending}
          >
            {createShare.isPending ? (
              <ActivityIndicator color={IOS_COLORS.systemBlue} />
            ) : (
              <Text
                style={[
                  styles.doneText,
                  !email.trim() && styles.doneDisabled,
                ]}
              >
                Send
              </Text>
            )}
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="coach@example.com"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Text style={styles.helper}>
            They'll get read-only access to every concept, resource, pattern,
            review, and saved Q&A in this Playbook. They can't see your
            suggestion queue or raw inbox, and they can't make edits.
          </Text>
        </View>
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  cancelText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  doneDisabled: {
    color: IOS_COLORS.systemGray3,
  },
  body: {
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: IOS_COLORS.secondaryLabel,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    fontSize: 16,
    color: IOS_COLORS.label,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray4,
  },
  helper: {
    fontSize: 13,
    lineHeight: 19,
    color: IOS_COLORS.secondaryLabel,
  },
});
