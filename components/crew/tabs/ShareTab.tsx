/**
 * ShareTab Component
 *
 * Combines race sharing functionality with collaborator management.
 * Allows users to:
 * - Create and share invite codes via multiple channels
 * - View and manage collaborators
 * - Quick share to WhatsApp, email, etc.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Share2,
  Copy,
  MessageCircle,
  Mail,
  UserPlus,
  Users,
  Clock,
  CheckCircle2,
  Trash2,
  Eye,
  Shield,
  Search,
} from 'lucide-react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { IOS_COLORS } from '@/components/cards/constants';
import { useRaceCollaboration } from '@/hooks/useRaceCollaboration';
import { Avatar, AvatarFallbackText } from '@/components/ui/avatar';
import { RaceCollaborator, AccessLevel } from '@/types/raceCollaboration';
import { CoachFinderModal } from '@/components/crew/CoachFinderModal';

// =============================================================================
// TYPES
// =============================================================================

interface ShareTabProps {
  regattaId: string;
  raceName?: string;
  currentUserId?: string | null;
}

interface ShareChannel {
  id: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SHARE_CHANNELS: ShareChannel[] = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
  { id: 'copy', label: 'Copy Link', icon: Copy, color: IOS_COLORS.blue },
  { id: 'email', label: 'Email', icon: Mail, color: IOS_COLORS.orange },
  { id: 'more', label: 'More', icon: Share2, color: IOS_COLORS.gray },
];

// =============================================================================
// HELPERS
// =============================================================================

function getInitials(collaborator: RaceCollaborator): string {
  if (collaborator.displayName) {
    const parts = collaborator.displayName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return collaborator.displayName.substring(0, 2).toUpperCase();
  }
  if (collaborator.profile?.fullName) {
    const parts = collaborator.profile.fullName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return collaborator.profile.fullName.substring(0, 2).toUpperCase();
  }
  return '??';
}

function getDisplayName(collaborator: RaceCollaborator): string {
  return (
    collaborator.displayName ||
    collaborator.profile?.fullName ||
    'Pending invite'
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ShareTab({
  regattaId,
  raceName,
  currentUserId,
}: ShareTabProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [showCoachFinder, setShowCoachFinder] = useState(false);

  const {
    collaborators,
    isLoading,
    isOwner,
    createInvite,
    removeCollaborator,
    updateAccessLevel,
  } = useRaceCollaboration(regattaId);

  // ---------------------------------------------------------------------------
  // INVITE CODE HANDLING
  // ---------------------------------------------------------------------------

  const handleCreateInvite = useCallback(async () => {
    setIsCreatingInvite(true);
    try {
      const code = await createInvite('view');
      setInviteCode(code);
    } catch (error) {
      console.error('Failed to create invite:', error);
      showAlert('Error', 'Failed to create invite code');
    } finally {
      setIsCreatingInvite(false);
    }
  }, [createInvite]);

  const getShareUrl = useCallback((code: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return `${window.location.origin}/join-race/${code}`;
    }
    return `https://better.at/join-race/${code}`;
  }, []);

  const getShareMessage = useCallback((code: string) => {
    const url = getShareUrl(code);
    const raceText = raceName ? ` "${raceName}"` : '';
    return `Join my race${raceText} on BetterAt!\n\nInvite code: ${code}\n\nOr tap: ${url}`;
  }, [raceName, getShareUrl]);

  // ---------------------------------------------------------------------------
  // SHARE CHANNEL HANDLERS
  // ---------------------------------------------------------------------------

  const handleShareChannel = useCallback(async (channelId: string) => {
    // Create invite if we don't have one
    let code = inviteCode;
    if (!code) {
      setIsCreatingInvite(true);
      try {
        code = await createInvite('view');
        setInviteCode(code);
      } catch (error) {
        console.error('Failed to create invite:', error);
        showAlert('Error', 'Failed to create invite code');
        setIsCreatingInvite(false);
        return;
      }
      setIsCreatingInvite(false);
    }

    const message = getShareMessage(code);
    switch (channelId) {
      case 'whatsapp':
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
        try {
          const canOpen = await Linking.canOpenURL(whatsappUrl);
          if (canOpen) {
            await Linking.openURL(whatsappUrl);
          } else {
            await Share.share({
              message,
              title: raceName ? `Join: ${raceName}` : 'Join my race',
            });
          }
        } catch (error) {
          showAlert('Share Unavailable', 'Could not open WhatsApp. Try Copy Link or Email.');
        }
        break;

      case 'copy':
        await Clipboard.setStringAsync(message);
        showAlert('Copied!', 'Invite link copied to clipboard');
        break;

      case 'email':
        const emailSubject = raceName ? `Join my race: ${raceName}` : 'Join my race on BetterAt';
        const emailUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(message)}`;
        try {
          await Linking.openURL(emailUrl);
        } catch (error) {
          showAlert('Error', 'Could not open email client');
        }
        break;

      case 'more':
        try {
          const title = raceName ? `Join: ${raceName}` : 'Join my race';
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
          console.error('Share failed:', error);
        }
        break;
    }
  }, [inviteCode, createInvite, getShareMessage, raceName]);

  // ---------------------------------------------------------------------------
  // COLLABORATOR HANDLERS
  // ---------------------------------------------------------------------------

  const handleRemoveCollaborator = useCallback((collaboratorId: string) => {
    showConfirm(
      'Remove Collaborator',
      'Are you sure you want to remove this person from the race?',
      () => removeCollaborator(collaboratorId),
      { destructive: true }
    );
  }, [removeCollaborator]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  const acceptedCollaborators = collaborators.filter((c) => c.status === 'accepted');
  const pendingCollaborators = collaborators.filter((c) => c.status === 'pending');

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={IOS_COLORS.blue} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Quick Share Section */}
      {isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Share</Text>
          <View style={styles.shareGrid}>
            {SHARE_CHANNELS.map((channel) => {
              const IconComponent = channel.icon;
              return (
                <TouchableOpacity
                  key={channel.id}
                  style={styles.shareButton}
                  onPress={() => handleShareChannel(channel.id)}
                  disabled={isCreatingInvite}
                >
                  <View style={[styles.shareIconContainer, { backgroundColor: `${channel.color}15` }]}>
                    {isCreatingInvite && channel.id === 'whatsapp' ? (
                      <ActivityIndicator size="small" color={channel.color} />
                    ) : (
                      <IconComponent size={22} color={channel.color} />
                    )}
                  </View>
                  <Text style={styles.shareLabel}>{channel.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Current Invite Code Display */}
          {inviteCode && (
            <View style={styles.inviteCodeCard}>
              <Text style={styles.inviteCodeLabel}>Current Invite Code</Text>
              <Text style={styles.inviteCode}>{inviteCode}</Text>
              <TouchableOpacity
                style={styles.newCodeButton}
                onPress={handleCreateInvite}
                disabled={isCreatingInvite}
              >
                <Text style={styles.newCodeButtonText}>Generate New Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Find Coach Button */}
          <TouchableOpacity
            style={styles.findCoachButton}
            onPress={() => setShowCoachFinder(true)}
          >
            <Search size={18} color={IOS_COLORS.purple} />
            <Text style={styles.findCoachText}>Find a Coach</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Collaborators Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Shared With ({collaborators.length})
        </Text>

        {collaborators.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={40} color={IOS_COLORS.gray3} />
            <Text style={styles.emptyTitle}>No one has joined yet</Text>
            <Text style={styles.emptyText}>
              Share the invite code with your crew to let them view and collaborate on this race.
            </Text>
          </View>
        ) : (
          <View style={styles.collaboratorList}>
            {/* Accepted */}
            {acceptedCollaborators.map((collaborator) => (
              <CollaboratorRow
                key={collaborator.id}
                collaborator={collaborator}
                isOwner={isOwner}
                onRemove={handleRemoveCollaborator}
              />
            ))}

            {/* Pending */}
            {pendingCollaborators.length > 0 && (
              <>
                {acceptedCollaborators.length > 0 && (
                  <Text style={styles.subSectionTitle}>Pending Invites</Text>
                )}
                {pendingCollaborators.map((collaborator) => (
                  <CollaboratorRow
                    key={collaborator.id}
                    collaborator={collaborator}
                    isOwner={isOwner}
                    onRemove={handleRemoveCollaborator}
                    isPending
                  />
                ))}
              </>
            )}
          </View>
        )}
      </View>

      {/* Coach Finder Modal */}
      <CoachFinderModal
        regattaId={regattaId}
        isVisible={showCoachFinder}
        onClose={() => setShowCoachFinder(false)}
      />
    </ScrollView>
  );
}

// =============================================================================
// COLLABORATOR ROW COMPONENT
// =============================================================================

interface CollaboratorRowProps {
  collaborator: RaceCollaborator;
  isOwner: boolean;
  onRemove?: (collaboratorId: string) => void;
  isPending?: boolean;
}

function CollaboratorRow({
  collaborator,
  isOwner,
  onRemove,
  isPending = false,
}: CollaboratorRowProps) {
  return (
    <View style={styles.collaboratorRow}>
      <Avatar
        size="sm"
        style={{
          backgroundColor: collaborator.profile?.avatarColor || IOS_COLORS.blue,
        }}
      >
        {collaborator.profile?.avatarEmoji ? (
          <AvatarFallbackText>{collaborator.profile.avatarEmoji}</AvatarFallbackText>
        ) : (
          <AvatarFallbackText>{getInitials(collaborator)}</AvatarFallbackText>
        )}
      </Avatar>

      <View style={styles.collaboratorInfo}>
        <Text style={styles.collaboratorName}>{getDisplayName(collaborator)}</Text>
        <View style={styles.collaboratorMeta}>
          {collaborator.role && (
            <Text style={styles.collaboratorRole}>{collaborator.role}</Text>
          )}
          {isPending ? (
            <View style={styles.pendingBadge}>
              <Clock size={10} color={IOS_COLORS.orange} />
              <Text style={styles.pendingBadgeText}>Pending</Text>
            </View>
          ) : (
            <View style={styles.accessBadge}>
              {collaborator.accessLevel === 'full' ? (
                <>
                  <Shield size={10} color={IOS_COLORS.green} />
                  <Text style={[styles.accessBadgeText, { color: IOS_COLORS.green }]}>
                    Full access
                  </Text>
                </>
              ) : (
                <>
                  <Eye size={10} color={IOS_COLORS.blue} />
                  <Text style={[styles.accessBadgeText, { color: IOS_COLORS.blue }]}>
                    View only
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      </View>

      {isOwner && onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(collaborator.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={18} color={IOS_COLORS.red} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: IOS_COLORS.gray,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    marginTop: 8,
    marginBottom: 4,
  },
  shareGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shareButton: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  shareIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  inviteCodeCard: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  inviteCodeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteCode: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: 4,
    marginVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  newCodeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newCodeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  findCoachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${IOS_COLORS.purple}10`,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.purple}30`,
    marginTop: 4,
  },
  findCoachText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.purple,
  },
  collaboratorList: {
    gap: 8,
  },
  collaboratorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: IOS_COLORS.systemBackground,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
  },
  collaboratorInfo: {
    flex: 1,
  },
  collaboratorName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  collaboratorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  collaboratorRole: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${IOS_COLORS.orange}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.orange,
  },
  accessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accessBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  emptyText: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

export default ShareTab;
