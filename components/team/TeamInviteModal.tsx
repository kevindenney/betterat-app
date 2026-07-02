/**
 * TeamInviteModal
 *
 * Modal for generating and sharing team invite codes.
 * Allows the team creator to invite teammates to join.
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { X, Copy, Share2, Check, RefreshCw, Users } from 'lucide-react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import * as Clipboard from 'expo-clipboard';

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  gray: '#8E8E93',
  gray3: '#C7C7CC',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#48484A',
  teal: '#0D9488',
};

interface TeamInviteModalProps {
  visible: boolean;
  onClose: () => void;
  inviteCode: string | null;
  inviteLink: string | null;
  teamName: string;
  onGenerateCode: () => Promise<string>;
  isGenerating?: boolean;
}

export function TeamInviteModal({
  visible,
  onClose,
  inviteCode,
  inviteLink,
  teamName,
  onGenerateCode,
  isGenerating = false,
}: TeamInviteModalProps) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  /**
   * Copy invite code to clipboard
   */
  const handleCopyCode = useCallback(async () => {
    if (!inviteCode) return;

    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  /**
   * Share invite link
   */
  const handleShare = useCallback(async () => {
    if (!inviteCode) return;

    const message = `Join my team "${teamName}" for our upcoming race!\n\nUse invite code: ${inviteCode}\n\nOr tap this link: ${inviteLink || `betterat://join-team?code=${inviteCode}`}`;
    const title = `Join ${teamName}`;

    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav?.share) {
          await nav.share({ title, text: message });
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(message);
          showAlert('Copied', 'Invite link copied to clipboard');
        }
      } else {
        await Share.share({ message, title });
      }
    } catch (error) {
      // User cancelled or error
    }
  }, [inviteCode, inviteLink, teamName]);

  /**
   * Generate new invite code
   */
  const handleGenerateCode = useCallback(async () => {
    try {
      setGenerating(true);
      await onGenerateCode();
    } finally {
      setGenerating(false);
    }
  }, [onGenerateCode]);

  const isLoading = isGenerating || generating;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Users size={20} color={IOS_COLORS.teal} />
            <Text style={styles.headerTitle}>Invite Teammates</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={IOS_COLORS.gray} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.teamName}>{teamName}</Text>
          <Text style={styles.description}>
            Share this code with your teammates so they can join your race entry.
            Everyone on the team will see the same checklists and prep status.
          </Text>

          {/* Invite Code Display */}
          {inviteCode ? (
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <View style={styles.codeContainer}>
                <Text style={styles.codeText}>{inviteCode}</Text>
                <TouchableOpacity
                  style={styles.codeAction}
                  onPress={handleCopyCode}
                  disabled={copied}
                >
                  {copied ? (
                    <Check size={20} color={IOS_COLORS.green} />
                  ) : (
                    <Copy size={20} color={IOS_COLORS.blue} />
                  )}
                </TouchableOpacity>
              </View>
              {copied && (
                <Text style={styles.copiedText}>Copied to clipboard!</Text>
              )}
            </View>
          ) : (
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <View style={styles.noCodeContainer}>
                <Text style={styles.noCodeText}>
                  Generate a code to invite teammates
                </Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {inviteCode ? (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.shareButton]}
                  onPress={handleShare}
                >
                  <Share2 size={18} color="#FFFFFF" />
                  <Text style={styles.shareButtonText}>Share Invite</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.regenerateButton]}
                  onPress={handleGenerateCode}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={IOS_COLORS.blue} />
                  ) : (
                    <>
                      <RefreshCw size={16} color={IOS_COLORS.blue} />
                      <Text style={styles.regenerateButtonText}>
                        Generate New Code
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.generateButton]}
                onPress={handleGenerateCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.generateButtonText}>Generate Invite Code</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>How it works</Text>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>1</Text>
              <Text style={styles.instructionText}>
                Share the invite code with your teammates
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>2</Text>
              <Text style={styles.instructionText}>
                They enter the code in their BetterAt app
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>3</Text>
              <Text style={styles.instructionText}>
                Everyone sees the same race prep and checklists
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  teamName: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 22,
    marginBottom: 24,
  },
  codeSection: {
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 1,
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 16,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '700',
    color: IOS_COLORS.teal,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeAction: {
    padding: 8,
  },
  copiedText: {
    fontSize: 13,
    color: IOS_COLORS.green,
    marginTop: 8,
    textAlign: 'center',
  },
  noCodeContainer: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  noCodeText: {
    fontSize: 15,
    color: IOS_COLORS.gray,
  },
  actions: {
    gap: 12,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareButton: {
    backgroundColor: IOS_COLORS.teal,
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  regenerateButton: {
    backgroundColor: `${IOS_COLORS.blue}15`,
  },
  regenerateButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  generateButton: {
    backgroundColor: IOS_COLORS.teal,
  },
  generateButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  instructions: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  instructionNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: IOS_COLORS.teal,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
});

export default TeamInviteModal;
