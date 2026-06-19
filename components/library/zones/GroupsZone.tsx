/**
 * <GroupsZone> — the "Groups" full-zone list in Library.
 *
 * "Groups" is the generic, interest-agnostic name for the people-collective
 * primitive: a sailing "fleet", a reading "book club", a course "cohort" are
 * the same thing on different dials. This zone lists the groups the current
 * user belongs to and routes into the group hub (today: /(tabs)/fleet).
 *
 * Reuses the CanonicalOrgRow cell so a group reads visually like an org in
 * the ORGS stack — same square-mark column, name, and descriptor.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useUserFleets } from '@/hooks/useFleetData';
import {
  CanonicalList,
  CanonicalOrgRow,
  initialsForName,
  pickSquareMarkColor,
} from '@/components/discover/canonical';
import type { FleetMembership } from '@/services/fleetService';

/** Short role label for a group membership ("Owner" / "Captain" / "Member"). */
export function groupRoleDescriptor(m: FleetMembership): string {
  switch (m.role) {
    case 'owner':
      return 'Owner';
    case 'captain':
      return 'Captain';
    case 'coach':
      return 'Coach';
    default:
      return 'Member';
  }
}

export function GroupsZone() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const { fleets, loading } = useUserFleets(user?.id);
  const isSailRacing = currentInterest?.slug === 'sail-racing';
  const visibleFleets = isSailRacing ? fleets : [];

  if (loading && visibleFleets.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
      </View>
    );
  }

  if (visibleFleets.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {isSailRacing
            ? "You're not in any groups yet. Find one to join or start your own and it'll live here."
            : `Groups for ${currentInterest?.name ?? 'this interest'} will live here once you join one.`}
        </Text>
        {isSailRacing ? (
          <View style={styles.emptyActions}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/(tabs)/fleet/select' as never)}
            >
              <Ionicons name="search" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Find a group to join</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/(tabs)/fleet/create' as never)}
            >
              <Ionicons name="add" size={16} color={IOS_COLORS.systemBlue} />
              <Text style={styles.secondaryButtonText}>Create a group</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CanonicalList>
        {visibleFleets.map((m, idx) => (
          <CanonicalOrgRow
            key={m.fleet.id}
            first={idx === 0}
            initials={initialsForName(m.fleet.name)}
            markColor={pickSquareMarkColor(m.fleet.id)}
            name={m.fleet.name}
            descriptor={[groupRoleDescriptor(m), m.fleet.organization?.name]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => router.push('/(tabs)/fleet' as never)}
          />
        ))}
      </CanonicalList>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: IOS_SPACING.lg,
  },
  loading: {
    paddingVertical: IOS_SPACING.xl,
    alignItems: 'center',
  },
  empty: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  emptyActions: {
    marginTop: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
});
