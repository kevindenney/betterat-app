/**
 * InviteMemberSheet
 *
 * Bottom sheet for org admins to invite new members.
 * Creates an invite with a shareable link.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { organizationInviteService } from '@/services/OrganizationInviteService';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';
import { NotificationService } from '@/services/NotificationService';
import { useOrgPrograms } from '@/hooks/usePrograms';
import { supabase } from '@/services/supabase';
import * as Clipboard from 'expo-clipboard';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

interface InviteMemberSheetProps {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName?: string | null;
  interestSlug?: string | null;
}

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function InviteMemberSheet({
  visible,
  onClose,
  organizationId,
  organizationName,
  interestSlug,
}: InviteMemberSheetProps) {
  const ctx = getOnboardingContext(interestSlug || undefined);
  const roles = ctx.leaderRoles;

  const { data: orgPrograms } = useOrgPrograms(organizationId);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState(roles[roles.length - 1]?.id || 'member');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedRoleLabel = roles.find((r) => r.id === selectedRole)?.label || 'Team Member';

  const handleSend = async () => {
    if (!name.trim() && !email.trim()) {
      showAlert('Missing info', 'Please enter a name or email address.');
      return;
    }

    setSending(true);
    try {
      const token = generateToken();
      await organizationInviteService.createInvite({
        organization_id: organizationId,
        program_id: selectedProgramId,
        invitee_name: name.trim() || null,
        invitee_email: email.trim() || null,
        invite_token: token,
        role_key: selectedRole,
        role_label: selectedRoleLabel,
        channel: email.trim() ? 'email' : 'link',
        notes: message.trim() || null,
      });

      const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://better.at';
      setInviteLink(`${baseUrl}/invite/${token}`);

      // Send in-app notification to invitee if they have an account (non-blocking)
      if (email.trim()) {
        try {
          const lookupEmail = email.trim().toLowerCase();
          const { data: inviteeUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', lookupEmail)
            .single();
          if (inviteeUser?.id) {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const { data: inviterProfile } = await supabase
              .from('users')
              .select('full_name')
              .eq('id', currentUser?.id || '')
              .single();
            await NotificationService.notifyOrgInviteReceived({
              targetUserId: inviteeUser.id,
              inviterName: inviterProfile?.full_name || 'Someone',
              inviterId: currentUser?.id || '',
              organizationId,
              organizationName: organizationName || 'an organization',
              roleLabel: selectedRoleLabel,
              inviteToken: token,
            });
          }
        } catch (notifErr) {
          console.error('[InviteMemberSheet] Notification error:', notifErr);
        }
      }
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to create invite');
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setMessage('');
    setInviteLink(null);
    setCopied(false);
    setSelectedRole(roles[roles.length - 1]?.id || 'member');
    setSelectedProgramId(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Invite Member</Text>
            <Text style={styles.subtitle}>
              Send an invitation to join your {ctx.organizationLabel}.
            </Text>

            {inviteLink ? (
              // Success state — show copyable link
              <View style={styles.successSection}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
                </View>
                <Text style={styles.successTitle}>Invite Created!</Text>
                <Text style={styles.successText}>
                  Share this link with {name.trim() || 'the invitee'}:
                </Text>
                <View style={styles.linkRow}>
                  <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
                  <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                    <Ionicons
                      name={copied ? 'checkmark' : 'copy-outline'}
                      size={18}
                      color={copied ? '#16A34A' : '#007AFF'}
                    />
                    <Text style={[styles.copyButtonText, copied && styles.copiedText]}>
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Form state
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  autoCapitalize="words"
                  autoCorrect={false}
                />

                <Text style={styles.label}>Email (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />

                <Text style={styles.label}>Role</Text>
                <View style={styles.rolesRow}>
                  {roles.map((role) => (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.rolePill, selectedRole === role.id && styles.rolePillActive]}
                      onPress={() => setSelectedRole(role.id)}
                    >
                      <Text style={[styles.rolePillText, selectedRole === role.id && styles.rolePillTextActive]}>
                        {role.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {orgPrograms && orgPrograms.length > 0 && (
                  <>
                    <Text style={styles.label}>Program (optional)</Text>
                    <View style={styles.rolesRow}>
                      <TouchableOpacity
                        style={[styles.rolePill, selectedProgramId === null && styles.rolePillActive]}
                        onPress={() => setSelectedProgramId(null)}
                      >
                        <Text style={[styles.rolePillText, selectedProgramId === null && styles.rolePillTextActive]}>
                          None
                        </Text>
                      </TouchableOpacity>
                      {orgPrograms.map((prog) => (
                        <TouchableOpacity
                          key={prog.id}
                          style={[styles.rolePill, selectedProgramId === prog.id && styles.rolePillActive]}
                          onPress={() => setSelectedProgramId(prog.id)}
                        >
                          <Text style={[styles.rolePillText, selectedProgramId === prog.id && styles.rolePillTextActive]}>
                            {prog.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.label}>Message (optional)</Text>
                <TextInput
                  style={[styles.input, styles.messageInput]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Add a personal note..."
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[styles.sendButton, sending && styles.buttonDisabled]}
                  onPress={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sendButtonText}>Create Invite Link</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  messageInput: {
    minHeight: 80,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rolePill: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  rolePillActive: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  rolePillText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  rolePillTextActive: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Success state
  successSection: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  successIcon: {
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  successText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    width: '100%',
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  copiedText: {
    color: '#16A34A',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
