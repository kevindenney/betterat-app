/**
 * SharedWithCard — sidebar card listing coach/teammate read-only shares on
 * this playbook, with an "Invite coach or teammate" footer button.
 *
 * Full invite + revoke modals land in Phase 8.5; for now the buttons show a
 * coming-soon alert.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { usePlaybookShares } from '@/hooks/usePlaybook';
import { InviteCoachModal } from '@/components/playbook/shares/InviteCoachModal';
import { ManageSharesModal } from '@/components/playbook/shares/ManageSharesModal';
import type { PlaybookShareRecord } from '@/types/playbook';

interface SharedWithCardProps {
  playbookId: string | undefined;
}

function shareLabel(share: PlaybookShareRecord): string {
  return (
    share.shared_with_email ||
    (share.shared_with_user_id
      ? share.shared_with_user_id.slice(0, 8)
      : 'Invited collaborator')
  );
}

export function SharedWithCard({ playbookId }: SharedWithCardProps) {
  const { data: shares = [] } = usePlaybookShares(playbookId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const handleInvite = () => setInviteOpen(true);
  const handleManage = () => setManageOpen(true);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="people-outline" size={16} color={IOS_COLORS.systemBlue} />
        <Text style={styles.title}>Shared with</Text>
      </View>
      {shares.length === 0 ? (
        <Text style={styles.empty}>
          Nobody yet. Invite a coach or teammate for read-only access to
          everything in this Playbook.
        </Text>
      ) : (
        <View style={styles.list}>
          {shares.map((share) => (
            <View key={share.id} style={styles.item}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={14} color={IOS_COLORS.secondaryLabel} />
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {shareLabel(share)}
                </Text>
                <Text style={styles.itemMeta}>
                  View-only ·{' '}
                  {share.invite_status === 'accepted' ? 'Accepted' : 'Pending'}
                </Text>
              </View>
              <Pressable onPress={handleManage} hitSlop={8}>
                <Text style={styles.manageLink}>Manage</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity
        onPress={handleInvite}
        style={styles.inviteButton}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={18} color={IOS_COLORS.systemBlue} />
        <Text style={styles.inviteButtonText}>Invite coach or teammate</Text>
      </TouchableOpacity>
      <InviteCoachModal
        visible={inviteOpen}
        playbookId={playbookId}
        onClose={() => setInviteOpen(false)}
      />
      <ManageSharesModal
        visible={manageOpen}
        playbookId={playbookId}
        onClose={() => setManageOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  empty: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  list: {
    gap: IOS_SPACING.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.sm,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  itemMeta: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
  },
  manageLink: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  inviteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
});
