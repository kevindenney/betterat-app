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
  useUserAffinityGroups,
  type AffinityGroupKind,
  type UserAffinityGroup,
} from '@/hooks/useUserAffinityGroups';
import { useUserOrgCohorts, type UserOrgCohort } from '@/hooks/useUserOrgCohorts';
import {
  CanonicalList,
  CanonicalOrgRow,
  initialsForName,
  pickSquareMarkColor,
} from '@/components/discover/canonical';
import { CreateAffinityGroupSheet } from '@/components/library/groups/CreateAffinityGroupSheet';
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
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
  const isSailRacing = currentInterest?.slug === 'sail-racing';
  const { fleets, loading: fleetsLoading } = useUserFleets(user?.id);
  const { groups: affinityGroups, isLoading: affinityGroupsLoading } =
    useUserAffinityGroups(currentInterest?.slug);
  const { cohorts: orgCohorts, isLoading: orgCohortsLoading } =
    useUserOrgCohorts(currentInterest?.slug);
  const loading = isSailRacing ? fleetsLoading : affinityGroupsLoading || orgCohortsLoading;
  const visibleFleets = isSailRacing ? fleets : [];
  const visibleCohortRows = React.useMemo(() => {
    if (isSailRacing) return [];
    const seen = new Set<string>();
    const keyFor = (name: string, orgId?: string | null) =>
      `${name.trim().toLowerCase()}::${orgId ?? ''}`;
    const rows: {
      id: string;
      name: string;
      initialsSource: string;
      descriptor: string;
      route: string;
    }[] = [];

    for (const group of affinityGroups) {
      seen.add(keyFor(group.name, group.parent_org_id));
      rows.push({
        id: `affinity:${group.id}`,
        name: group.name,
        initialsSource: group.short_name ?? group.name,
        descriptor: descriptorForAffinityGroup(group),
        route: `/group/${group.id}`,
      });
    }

    for (const cohort of orgCohorts) {
      const key = keyFor(cohort.name, cohort.org_id);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: `cohort:${cohort.id}`,
        name: cohort.name,
        initialsSource: cohort.name,
        descriptor: descriptorForOrgCohort(cohort),
        route: `/organization/cohort/${cohort.id}`,
      });
    }

    return rows;
  }, [isSailRacing, affinityGroups, orgCohorts]);
  const hasGroups = visibleFleets.length > 0 || visibleCohortRows.length > 0;

  // Discovery affordance — kept available whether or not the user already
  // belongs to groups, so "find more / start one" is reachable everywhere the
  // zone renders (notably web, which has no other fleet-discovery surface).
  const discoveryActions = isSailRacing ? (
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
  ) : (
    <View style={styles.emptyActions}>
      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/(tabs)/library?zone=all&segment=stacks' as never)}
      >
        <Ionicons name="search" size={16} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Find a group to join</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => setCreateGroupOpen(true)}
      >
        <Ionicons name="add" size={16} color={IOS_COLORS.systemBlue} />
        <Text style={styles.secondaryButtonText}>Add group</Text>
      </Pressable>
    </View>
  );

  if (loading && !hasGroups) {
    return (
      <>
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
        </View>
        <CreateAffinityGroupSheet
          visible={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
        />
      </>
    );
  }

  if (!hasGroups) {
    return (
      <>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {isSailRacing
              ? "You're not in any groups yet. Find one to join or start your own and it'll live here."
              : currentInterest?.slug === 'nursing'
                ? "You're not in any cohorts or peer groups yet. Find a group or add a study group and it'll live here."
              : `Groups for ${currentInterest?.name ?? 'this interest'} will live here once you join or add one.`}
          </Text>
          {discoveryActions}
        </View>
        <CreateAffinityGroupSheet
          visible={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.introText}>
          {isSailRacing
            ? "The crews and fleets you're in — the people on the start line with you."
            : currentInterest?.slug === 'nursing'
              ? "The cohorts and peer groups you're in — the people moving through the work with you."
              : "The groups you're in — the people moving through the work with you."}
        </Text>
        <CanonicalList>
          {isSailRacing
            ? visibleFleets.map((m, idx) => (
                <CanonicalOrgRow
                  key={m.fleet.id}
                  first={idx === 0}
                  initials={initialsForName(m.fleet.name)}
                  markColor={pickSquareMarkColor(m.fleet.id)}
                  name={m.fleet.name}
                  descriptor={[groupRoleDescriptor(m), compactOrgName(m.fleet.organization?.name)]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() => router.push('/(tabs)/fleet' as never)}
                />
              ))
            : visibleCohortRows.map((group, idx) => (
                <CanonicalOrgRow
                  key={group.id}
                  first={idx === 0}
                  initials={initialsForName(group.initialsSource)}
                  markColor={pickSquareMarkColor(group.id)}
                  name={group.name}
                  descriptor={group.descriptor}
                  onPress={() => router.push(group.route as never)}
                />
              ))}
        </CanonicalList>
        <View style={styles.listActions}>{discoveryActions}</View>
      </View>
      <CreateAffinityGroupSheet
        visible={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
      />
    </>
  );
}

function affinityGroupKindLabel(kind: AffinityGroupKind): string {
  switch (kind) {
    case 'cohort':
      return 'Cohort';
    case 'crew_pod':
      return 'Crew';
    case 'practice_group':
      return 'Practice group';
    case 'class_fleet':
    default:
      return 'Fleet';
  }
}

function affinityGroupRoleLabel(role?: string | null): string {
  switch (role) {
    case 'leader':
      return 'Leader';
    case 'coach':
      return 'Coach';
    default:
      return 'Member';
  }
}

function descriptorForAffinityGroup(group: UserAffinityGroup): string {
  return [
    group.role ? affinityGroupRoleLabel(group.role) : affinityGroupKindLabel(group.kind),
    compactOrgName(group.parent_org_name),
  ]
    .filter(Boolean)
    .join(' · ');
}

function descriptorForOrgCohort(cohort: UserOrgCohort): string {
  const role = cohort.role
    ? cohort.role.charAt(0).toUpperCase() + cohort.role.slice(1)
    : 'Member';
  return [role, compactOrgName(cohort.org_name)].filter(Boolean).join(' · ');
}

function compactOrgName(name?: string | null): string | null {
  if (!name) return null;
  if (/Royal Hong Kong Yacht Club/i.test(name)) return 'RHKYC';
  if (/Johns Hopkins School of Nursing/i.test(name)) return 'JHU School of Nursing';
  return name.length <= 18 ? name : initialsForName(name);
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  introText: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
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
  listActions: {
    marginTop: IOS_SPACING.md,
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
