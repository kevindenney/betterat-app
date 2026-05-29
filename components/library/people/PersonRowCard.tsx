/**
 * <PersonRowCard> — Library People zone row.
 *
 * Per canonical §6: avatar, name + role/affiliation, a "last activity"
 * line, and a mutual-signal badge (Suggested N / Following) on the right.
 * Whole row is pressable — taps into a followee timeline view.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { FollowedPersonRow } from '@/hooks/useFollowedPeopleForLibrary';

interface Props {
  person: FollowedPersonRow;
  onPress: () => void;
}

export function PersonRowCard({ person, onPress }: Props) {
  const avatarBg = person.avatarColor || '#E5E7EB';
  const hasSuggestions = person.pendingSuggestions > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${person.displayName}`}
    >
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        {person.avatarEmoji ? (
          <Text style={styles.avatarEmoji}>{person.avatarEmoji}</Text>
        ) : (
          <Text style={styles.avatarText}>{person.initials}</Text>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {person.displayName}
        </Text>
        {person.role ? (
          <Text style={styles.role} numberOfLines={1}>
            {person.role}
          </Text>
        ) : null}
        {person.lastActivity ? (
          <Text style={styles.activity} numberOfLines={1}>
            {person.lastActivity}
          </Text>
        ) : (
          <Text style={styles.activityDim} numberOfLines={1}>
            No recent public activity
          </Text>
        )}
      </View>

      <View style={styles.right}>
        {hasSuggestions ? (
          <View style={styles.suggestPill}>
            <View style={styles.suggestDot} />
            <Text style={styles.suggestText}>Suggested {person.pendingSuggestions}</Text>
          </View>
        ) : (
          <View style={styles.followingPill}>
            <Text style={styles.followingText}>Following</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={14} color={IOS_COLORS.tertiaryLabel} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.md,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardPressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  role: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  activity: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  activityDim: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,69,58,0.14)',
  },
  suggestDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D70015',
  },
  suggestText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D70015',
  },
  followingPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(142,142,147,0.18)',
  },
  followingText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
});
