/**
 * <GroupsZone> — the "Groups" full-zone list in Library.
 *
 * "Groups" is the generic, interest-agnostic name for the people-collective
 * primitive: a sailing "fleet", a reading "book club", a course "cohort" are
 * the same thing on different dials. This zone lists the groups the current
 * user belongs to and routes into the group hub.
 *
 * Reuses the CanonicalOrgRow cell so a group reads visually like an org in
 * the ORGS stack — same square-mark column, name, and descriptor.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import {
  useDiscoverableAffinityGroups,
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
import { AffinityGroupService } from '@/services/AffinityGroupService';
import { initialsForGroup } from './groupInitials';

export function GroupsZone() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const queryClient = useQueryClient();
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
  const [joiningId, setJoiningId] = React.useState<string | null>(null);
  const isSailRacing = currentInterest?.slug === 'sail-racing';
  const { groups: affinityGroups, isLoading: affinityGroupsLoading } =
    useUserAffinityGroups(currentInterest?.slug);
  const { groups: discoverableAffinityGroups, isLoading: discoverableGroupsLoading } =
    useDiscoverableAffinityGroups(currentInterest?.slug, 8);
  const { cohorts: orgCohorts, isLoading: orgCohortsLoading } =
    useUserOrgCohorts(currentInterest?.slug);
  const loading = affinityGroupsLoading || orgCohortsLoading;
  const visibleGroupRows = React.useMemo(() => {
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
  }, [affinityGroups, orgCohorts]);
  const hasGroups = visibleGroupRows.length > 0;
  const joinedAffinityGroupIds = React.useMemo(
    () => new Set(affinityGroups.map((g) => g.id)),
    [affinityGroups],
  );
  const joinableAffinityGroups = React.useMemo(
    () =>
      discoverableAffinityGroups
        .filter((group) => !joinedAffinityGroupIds.has(group.id))
        .slice(0, 8),
    [discoverableAffinityGroups, joinedAffinityGroupIds],
  );
  const hasJoinableGroups = joinableAffinityGroups.length > 0;

  const handleJoinAffinityGroup = React.useCallback(
    async (group: UserAffinityGroup) => {
      if (!user?.id) {
        showAlert('Sign in required', 'Sign in before joining a group.');
        return;
      }
      setJoiningId(`affinity:${group.id}`);
      try {
        await AffinityGroupService.join({ groupId: group.id, userId: user.id });
        await AffinityGroupService.seedFromBlueprint({ groupId: group.id, userId: user.id });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['user-affinity-groups'] }),
          queryClient.invalidateQueries({ queryKey: ['discoverable-affinity-groups'] }),
          queryClient.invalidateQueries({ queryKey: ['timeline-steps'] }),
        ]);
      } catch (error) {
        showAlert(
          'Could not join group',
          error instanceof Error ? error.message : 'Please try again.',
        );
      } finally {
        setJoiningId(null);
      }
    },
    [user?.id, queryClient],
  );

  // Discovery affordance — kept available whether or not the user already
  // belongs to groups, so "find more / start one" is reachable everywhere the
  // zone renders (notably web, which has no other fleet-discovery surface).
  const discoveryActions = (
    <View style={styles.emptyActions}>
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
              ? "You're not in any groups yet. Join one below or start your own and it'll live here."
              : currentInterest?.slug === 'nursing'
                ? "You're not in any cohorts or peer groups yet. Join one below or add a study group and it'll live here."
              : `Groups for ${currentInterest?.name ?? 'this interest'} will live here once you join or add one.`}
          </Text>
          <DiscoverableGroupsSection
            isSailRacing={isSailRacing}
            loading={discoverableGroupsLoading}
            affinityGroups={joinableAffinityGroups}
            joiningId={joiningId}
            currentInterestName={currentInterest?.name}
            onJoinAffinityGroup={handleJoinAffinityGroup}
          />
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
          {visibleGroupRows.map((group, idx) => (
            <CanonicalOrgRow
              key={group.id}
              first={idx === 0}
              initials={initialsForGroup(group.initialsSource, group.name)}
              markColor={pickSquareMarkColor(group.id)}
              name={group.name}
              descriptor={group.descriptor}
              onPress={() => router.push(group.route as never)}
            />
          ))}
        </CanonicalList>
        <View style={styles.listActions}>{discoveryActions}</View>
        <DiscoverableGroupsSection
          isSailRacing={isSailRacing}
          loading={discoverableGroupsLoading}
          affinityGroups={joinableAffinityGroups}
          joiningId={joiningId}
          currentInterestName={currentInterest?.name}
          onJoinAffinityGroup={handleJoinAffinityGroup}
          compact={!hasJoinableGroups}
        />
      </View>
      <CreateAffinityGroupSheet
        visible={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
      />
    </>
  );
}

function DiscoverableGroupsSection({
  isSailRacing,
  loading,
  affinityGroups,
  joiningId,
  currentInterestName,
  onJoinAffinityGroup,
  compact,
}: {
  isSailRacing: boolean;
  loading: boolean;
  affinityGroups: UserAffinityGroup[];
  joiningId: string | null;
  currentInterestName?: string | null;
  onJoinAffinityGroup: (group: UserAffinityGroup) => void;
  compact?: boolean;
}) {
  const hasRows = affinityGroups.length > 0;
  if (compact && !hasRows) return null;

  return (
    <View style={styles.discoverSection}>
      <Text style={styles.sectionEyebrow}>Groups to join</Text>
      {loading && !hasRows ? (
        <View style={styles.discoverLoading}>
          <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
        </View>
      ) : !hasRows ? (
        <Text style={styles.emptyText}>
          {isSailRacing
            ? 'Open crews and fleets will show up here when available.'
            : `Groups to join in ${currentInterestName ?? 'this interest'} will show up here when available.`}
        </Text>
      ) : (
        <CanonicalList>
          {affinityGroups.map((group, idx) => {
            const busy = joiningId === `affinity:${group.id}`;
            return (
              <CanonicalOrgRow
                key={group.id}
                first={idx === 0}
                initials={initialsForGroup(group.short_name, group.name)}
                markColor={pickSquareMarkColor(group.id)}
                name={group.name}
                descriptor={descriptorForDiscoverableAffinityGroup(group)}
                actionLabel={busy ? 'Joining' : 'Join'}
                onPress={() => {
                  if (!busy) onJoinAffinityGroup(group);
                }}
              />
            );
          })}
        </CanonicalList>
      )}
    </View>
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

function descriptorForDiscoverableAffinityGroup(group: UserAffinityGroup): string {
  const org = compactOrgName(group.parent_org_name);
  return [affinityGroupKindLabel(group.kind), org].filter(Boolean).join(' · ');
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
  discoverSection: {
    marginTop: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
  },
  discoverLoading: {
    paddingVertical: IOS_SPACING.md,
    alignItems: 'center',
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
  emptyActions: {
    marginTop: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
  },
  listActions: {
    marginTop: IOS_SPACING.md,
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
