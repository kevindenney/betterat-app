/**
 * Team Invite Sheet Component
 *
 * Bottom sheet for inviting team members via email or invite code/link.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Share,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionTeamService } from '@/services/SubscriptionTeamService';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

interface TeamInviteSheetProps {
  teamId: string;
  inviteCode: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function TeamInviteSheet({
  teamId,
  inviteCode,
  onClose,
  onSuccess,
}: TeamInviteSheetProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [currentInviteCode, setCurrentInviteCode] = useState(inviteCode);
  const [regenerating, setRegenerating] = useState(false);

  const handleSendInvite = async () => {
    if (!email.trim()) {
      showAlert('Error', 'Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      const result = await SubscriptionTeamService.inviteByEmail(teamId, email.trim());
      if (result.success) {
        showAlert('Invite Sent', `An invitation has been sent to ${email.trim()}`);
        setEmail('');
        onSuccess();
      } else {
        showAlert('Error', result.error || 'Failed to send invite');
      }
    } catch (error) {
      showAlert('Error', 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    if (!currentInviteCode) return;

    const link = getInviteLink(currentInviteCode);
    await Clipboard.setStringAsync(link);
    showAlert('Copied', 'Invite link copied to clipboard');
  };

  const handleCopyCode = async () => {
    if (!currentInviteCode) return;

    await Clipboard.setStringAsync(currentInviteCode);
    showAlert('Copied', 'Invite code copied to clipboard');
  };

  const handleShare = async () => {
    if (!currentInviteCode) return;

    const link = getInviteLink(currentInviteCode);
    try {
      await Share.share({
        message: `Join my team on BetterAt! Use this link to join: ${link}`,
        url: Platform.OS === 'ios' ? link : undefined,
      });
    } catch (error) {
      // User cancelled or share failed
    }
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    try {
      const newCode = await SubscriptionTeamService.generateInviteCode(teamId);
      if (newCode) {
        setCurrentInviteCode(newCode);
        showAlert('Success', 'Invite code regenerated');
      } else {
        showAlert('Error', 'Failed to regenerate invite code');
      }
    } catch (error) {
      showAlert('Error', 'Failed to regenerate invite code');
    } finally {
      setRegenerating(false);
    }
  };

  const inviteLink = currentInviteCode ? getInviteLink(currentInviteCode) : '';

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Invite Team Member</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={IOS_COLORS.secondaryLabel} />
            </TouchableOpacity>
          </View>

          {/* Email Invite Section */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>INVITE BY EMAIL</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="teammate@email.com"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!sending}
              />
              <TouchableOpacity
                style={[styles.sendButton, !email.trim() && styles.sendButtonDisabled]}
                onPress={handleSendInvite}
                disabled={sending || !email.trim()}
              >
                {sending ? (
                  <Ionicons name="hourglass" size={20} color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Invite Code/Link Section */}
          {currentInviteCode && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>SHARE INVITE LINK</Text>

              {/* Invite Code */}
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Invite Code</Text>
                <View style={styles.codeRow}>
                  <Text style={styles.code}>{currentInviteCode}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopyCode}
                    hitSlop={8}
                  >
                    <Ionicons name="copy-outline" size={20} color={IOS_COLORS.systemBlue} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Invite Link */}
              <View style={styles.linkContainer}>
                <Text style={styles.linkLabel}>Invite Link</Text>
                <TouchableOpacity style={styles.linkRow} onPress={handleCopyLink}>
                  <Text style={styles.link} numberOfLines={1}>
                    {inviteLink}
                  </Text>
                  <Ionicons name="copy-outline" size={18} color={IOS_COLORS.systemBlue} />
                </TouchableOpacity>
              </View>

              {/* Share & Regenerate Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                >
                  <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.regenerateButton}
                  onPress={handleRegenerateCode}
                  disabled={regenerating}
                >
                  <Ionicons
                    name={regenerating ? 'hourglass' : 'refresh'}
                    size={20}
                    color={IOS_COLORS.systemBlue}
                  />
                  <Text style={styles.regenerateButtonText}>
                    {regenerating ? 'Generating...' : 'New Code'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Footer */}
          <Text style={styles.footer}>
            Invited members will receive the same subscription benefits as your Team plan.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getInviteLink(code: string): string {
  const baseUrl = Platform.OS === 'web'
    ? (typeof window !== 'undefined' ? window.location.origin : 'https://better.at')
    : 'https://better.at';
  return `${baseUrl}/team-invite/${code}`;
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    borderTopLeftRadius: IOS_RADIUS.xl,
    borderTopRightRadius: IOS_RADIUS.xl,
    paddingBottom: IOS_SPACING.xl + 20, // Extra padding for home indicator
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: IOS_COLORS.systemGray3,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  title: {
    ...IOS_TYPOGRAPHY.title3,
    color: IOS_COLORS.label,
  },
  section: {
    paddingTop: IOS_SPACING.lg,
    paddingHorizontal: IOS_SPACING.lg,
  },
  sectionHeader: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: IOS_SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm + 2,
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
  },
  sendButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    width: 44,
    height: 44,
    borderRadius: IOS_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray4,
  },
  codeContainer: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
    padding: IOS_SPACING.md,
    marginBottom: IOS_SPACING.sm,
  },
  codeLabel: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: IOS_SPACING.xs,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  code: {
    ...IOS_TYPOGRAPHY.title2,
    color: IOS_COLORS.label,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  copyButton: {
    padding: IOS_SPACING.xs,
  },
  linkContainer: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
    padding: IOS_SPACING.md,
    marginBottom: IOS_SPACING.md,
  },
  linkLabel: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: IOS_SPACING.xs,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  link: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.systemBlue,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: IOS_SPACING.sm + 2,
    borderRadius: IOS_RADIUS.md,
    gap: IOS_SPACING.xs,
  },
  shareButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
  },
  regenerateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    paddingVertical: IOS_SPACING.sm + 2,
    borderRadius: IOS_RADIUS.md,
    gap: IOS_SPACING.xs,
  },
  regenerateButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.systemBlue,
  },
  footer: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.lg,
  },
});

export default TeamInviteSheet;
