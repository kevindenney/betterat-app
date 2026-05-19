/**
 * SharedWithMeCard — sidebar card listing Playbooks that others have shared
 * with the current user. Each row links to the read-only shared view.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { usePlaybooksSharedWithMe } from '@/hooks/usePlaybook';

export function SharedWithMeCard() {
  const { data: shares = [] } = usePlaybooksSharedWithMe();

  if (shares.length === 0) return null;

  return (
    <View style={[styles.card, { width: '100%', maxWidth: 400 }]}>
      <View style={styles.header}>
        <Ionicons name="eye-outline" size={16} color={IOS_COLORS.systemIndigo} />
        <Text style={styles.title}>Shared with me</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{shares.length}</Text>
        </View>
      </View>
      <View style={styles.list}>
        {shares.map((share) => (
          <Pressable
            key={share.id}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() =>
              router.push(`/library/shared/${share.playbook_id}` as any)
            }
          >
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {share.interest_name}
              </Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                from {share.owner_email} · {share.invite_status === 'accepted' ? 'View-only' : 'Pending'}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={IOS_COLORS.tertiaryLabel}
            />
          </Pressable>
        ))}
      </View>
      {shares.length >= 2 && (
        <Pressable
          style={({ pressed }) => [styles.dashboardLink, pressed && { opacity: 0.6 }]}
          onPress={() => router.push('/library/instructor' as any)}
        >
          <Ionicons name="grid-outline" size={14} color={IOS_COLORS.systemBlue} />
          <Text style={styles.dashboardLinkText}>Student dashboard</Text>
          <Ionicons name="chevron-forward" size={12} color={IOS_COLORS.systemBlue} />
        </Pressable>
      )}
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
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(88, 86, 214, 0.12)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.systemIndigo,
  },
  list: {
    gap: IOS_SPACING.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.sm,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  itemPressed: {
    opacity: 0.7,
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
  dashboardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: IOS_SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.systemGray4,
  },
  dashboardLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
});
