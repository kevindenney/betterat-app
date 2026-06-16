/**
 * CommunityAreaBadge
 *
 * Displays verification status for community-created racing areas.
 * Tufte-inspired: minimal chrome, maximum information.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TufteTokens } from '@/constants/designSystem';

export type VerificationStatus = 'pending' | 'verified' | 'disputed';

interface CommunityAreaBadgeProps {
  source: 'official' | 'community' | 'imported';
  verificationStatus: VerificationStatus;
  confirmationCount: number;
  confirmationThreshold?: number;
  userHasConfirmed?: boolean;
  onConfirm?: () => void;
  compact?: boolean;
}

const CONFIRMATION_THRESHOLD = 3;

export function CommunityAreaBadge({
  source,
  verificationStatus,
  confirmationCount,
  confirmationThreshold = CONFIRMATION_THRESHOLD,
  userHasConfirmed = false,
  onConfirm,
  compact = false,
}: CommunityAreaBadgeProps) {
  // Official areas don't need badges
  if (source === 'official') {
    return compact ? null : (
      <View style={styles.officialBadge}>
        <Ionicons name="shield-checkmark" size={12} color="#059669" />
        <Text style={styles.officialText}>Official</Text>
      </View>
    );
  }

  // Verified community areas
  if (verificationStatus === 'verified') {
    return (
      <View style={styles.verifiedBadge}>
        <Ionicons name="checkmark-circle" size={12} color="#059669" />
        {!compact && <Text style={styles.verifiedText}>Verified</Text>}
      </View>
    );
  }

  // Disputed areas
  if (verificationStatus === 'disputed') {
    return (
      <View style={styles.disputedBadge}>
        <Ionicons name="warning" size={12} color="#D97706" />
        {!compact && <Text style={styles.disputedText}>Disputed</Text>}
      </View>
    );
  }

  // Pending community areas - show confirmation progress
  if (compact) {
    return (
      <Pressable
        style={[styles.pendingBadge, userHasConfirmed && styles.pendingBadgeConfirmed]}
        onPress={!userHasConfirmed ? onConfirm : undefined}
        disabled={userHasConfirmed}
      >
        <Text style={styles.pendingCountCompact}>
          {confirmationCount}/{confirmationThreshold}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.pendingContainer}>
      <View style={styles.pendingBadge}>
        <Ionicons name="people-outline" size={12} color="#6B7280" />
        <Text style={styles.pendingText}>
          {confirmationCount}/{confirmationThreshold} confirmed
        </Text>
      </View>
      {!userHasConfirmed && onConfirm && (
        <Pressable style={styles.confirmButton} onPress={onConfirm}>
          <Ionicons name="checkmark" size={14} color="#007AFF" />
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </Pressable>
      )}
      {userHasConfirmed && (
        <View style={styles.confirmedIndicator}>
          <Ionicons name="checkmark-circle" size={14} color="#059669" />
          <Text style={styles.confirmedText}>You confirmed</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Official badge
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#ECFDF5',
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  officialText: {
    ...TufteTokens.typography.micro,
    color: '#059669',
  },

  // Verified badge
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#ECFDF5',
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  verifiedText: {
    ...TufteTokens.typography.micro,
    color: '#059669',
  },

  // Disputed badge
  disputedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FFFBEB',
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  disputedText: {
    ...TufteTokens.typography.micro,
    color: '#D97706',
  },

  // Pending badge
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#F3F4F6',
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  pendingBadgeConfirmed: {
    backgroundColor: '#ECFDF5',
  },
  pendingText: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
  },
  pendingCountCompact: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Confirm button
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  confirmButtonText: {
    ...TufteTokens.typography.micro,
    color: '#007AFF',
    fontWeight: '600',
  },

  // Confirmed indicator
  confirmedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  confirmedText: {
    ...TufteTokens.typography.micro,
    color: '#059669',
  },
});

export default CommunityAreaBadge;
