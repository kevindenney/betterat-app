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
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
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
  const { fleets, loading } = useUserFleets(user?.id);

  if (loading && fleets.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
      </View>
    );
  }

  if (fleets.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          You're not in any groups yet. Join or create a fleet, club, or cohort
          and it'll live here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CanonicalList>
        {fleets.map((m, idx) => (
          <CanonicalOrgRow
            key={m.fleet.id}
            first={idx === 0}
            initials={initialsForName(m.fleet.name)}
            markColor={pickSquareMarkColor(m.fleet.id)}
            name={m.fleet.name}
            descriptor={groupRoleDescriptor(m)}
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
});
