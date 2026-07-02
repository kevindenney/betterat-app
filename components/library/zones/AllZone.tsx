/**
 * <AllZone> — the unified Library feed (the "Librarian" / all landing).
 *
 * This is the curated front door of the consolidated Library tab. It is
 * organized on a single "yours ↔ blueprints" axis, and — crucially —
 * every section previews REAL top items as cards, never a bare "browse"
 * nav row:
 *
 *   Librarian      — the cross-cutting noticed card (passed in).
 *   YOURS
 *     Plans        — your subscribed Plans            → Blueprints zone
 *     Concepts     — mental models you're forming     → Concepts zone
 *     Resources    — things you've saved              → Resources zone
 *   BLUEPRINTS
 *     Plans to follow — published, subscribable Plans → Discover · plans
 *     Orgs            — orgs to join in this craft    → Discover · orgs
 *     Interests       — adjacent interests to add     → Discover · interests
 *
 * Each section self-collapses to a muted hint when it has no real data,
 * so the See-all link stays reachable without padding the feed with
 * empty cards. Copy says "Plans"; DB/code identifiers stay `blueprint_*`.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';
import { useSubscribedPlansForLibrary } from '@/hooks/useSubscribedPlansForLibrary';
import { useLifecycleConcepts } from '@/hooks/usePlaybook';
import { useUnsortedInboxCount } from '@/hooks/useInbox';
import { useLibraryResourcesPreview } from '@/hooks/useLibraryResourcesPreview';
import { useDiscoverBlueprints } from '@/hooks/useBlueprint';
import { useMarketplaceBlueprints, type MarketplaceBlueprint } from '@/hooks/useMarketplaceBlueprints';
import { useAssignedBlueprints, type AssignedBlueprint } from '@/hooks/useAssignedBlueprints';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BlueprintSubscribeSheet } from '@/components/blueprint/BlueprintSubscribeSheet';
import { addRemainingInstitutionalSteps } from '@/services/BlueprintSubscribeService';
import { useTopOrgsForInterest, type TopOrgRow } from '@/hooks/useTopOrgsForInterest';
import { useMyOrgs, type MyOrg } from '@/hooks/useMyOrgs';
import {
  useDiscoverableAffinityGroups,
  useUserAffinityGroups,
  type AffinityGroupKind,
  type UserAffinityGroup,
} from '@/hooks/useUserAffinityGroups';
import { useUserOrgCohorts, type UserOrgCohort } from '@/hooks/useUserOrgCohorts';
import {
  fetchOrgMembershipRows,
  orgMembershipsQueryKey,
} from '@/hooks/orgMembershipsQuery';
import { resolveOrgMembershipStatus } from '@/hooks/orgMembershipStatus';
import { initialsForGroup } from './groupInitials';
import { useInterest, type Interest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { PlanRowCard } from '@/components/library/plans/PlanRowCard';
import { ConceptCard } from '@/components/playbook/ConceptCard';
import { RecentItemRow } from '@/components/library/resources/RecentItemRow';
import {
  CanonicalList,
  CanonicalOrgRow,
  initialsForName,
  pickSquareMarkColor,
} from '@/components/discover/canonical';
import type { DiscoveredBlueprint } from '@/services/BlueprintService';

const PREVIEW_LIMIT = 3;

interface AllZoneProps {
  counts?: Partial<Record<LibraryZone, number>>;
  onJumpToZone: (zone: LibraryZone) => void;
  /** Librarian ask-strip + noticed card, rendered above the feed. */
  librarianSlot?: React.ReactNode;
  /** Optional deep-link target for the yours ↔ blueprints axis. */
  initialSegment?: 'yours' | 'stacks';
}

interface SectionHeaderProps {
  title: string;
  dotColor: string;
  count?: number;
  onSeeAll?: () => void;
}

function SectionHeader({ title, dotColor, count, onSeeAll }: SectionHeaderProps) {
  const showInlineCount = typeof count === 'number' && count > 0;
  return (
    <View style={styles.sectionHead}>
      <View style={styles.headLeft}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.eyebrow}>{title}</Text>
        {showInlineCount ? <Text style={styles.eyebrowCount}>{count}</Text> : null}
      </View>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="link"
          accessibilityLabel={`See all ${title}`}
          hitSlop={6}
          style={styles.seeAllBtn}
        >
          <Ionicons name="chevron-forward" size={12} color={IOS_COLORS.systemBlue} />
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.emptyHint}>{children}</Text>;
}

function SectionSubline({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionSubline}>{children}</Text>;
}

function CirclesHeader({
  title,
  scale,
}: {
  title: string;
  scale: string;
}) {
  return (
    <View style={styles.circlesHead}>
      <Text style={styles.circlesTitle}>{title}</Text>
      <View style={styles.circlesLine} />
      <Text style={styles.circlesScale}>{scale}</Text>
    </View>
  );
}

function LoadingRow() {
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
    </View>
  );
}

/** Catalog plan row (a Plan you could follow), distinct from PlanRowCard
 *  which renders a Plan you've already subscribed to. */
interface FollowRow {
  id: string;
  title: string;
  author: string;
  subscriberCount: number;
  badge: string | null;
  route: string;
}

interface LibraryGroupRow {
  id: string;
  name: string;
  initialsSource: string;
  descriptor: string;
  route: string;
}

function marketplaceToFollowRow(p: MarketplaceBlueprint): FollowRow {
  const cadence =
    p.billingCadence === 'monthly' ? '/mo' : p.billingCadence === 'annual' ? '/yr' : '';
  return {
    id: p.id,
    title: p.title,
    author: p.orgName ?? p.authorName,
    subscriberCount: p.activeSubscriberCount,
    badge: p.pricePerSeatCents > 0 ? `$${Math.round(p.pricePerSeatCents / 100)}${cadence}` : 'Free',
    route: `/marketplace/${p.id}`,
  };
}

function discoveredToFollowRow(bp: DiscoveredBlueprint): FollowRow {
  const badge =
    bp.access_level === 'paid'
      ? bp.price_cents && bp.price_cents > 0
        ? `${bp.currency?.toUpperCase() === 'USD' ? '$' : ''}${(bp.price_cents / 100).toFixed(0)}`
        : 'Paid'
      : bp.access_level === 'org_members'
        ? 'Members'
        : null;
  return {
    id: bp.id,
    title: bp.title,
    author: bp.organization_name ?? bp.author_name ?? 'Author',
    subscriberCount: bp.subscriber_count,
    badge,
    route: `/(tabs)/library/blueprints/${bp.id}`,
  };
}

function compactOrgName(name?: string | null): string | null {
  if (!name) return null;
  if (/Royal Hong Kong Yacht Club/i.test(name)) return 'RHKYC';
  if (/Johns Hopkins School of Nursing/i.test(name)) return 'JHU School of Nursing';
  if (name.length <= 18) return name;
  const initials = initialsForName(name);
  return initials.length >= 2 ? initials : name;
}

function formatOrgRole(role: string): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    default:
      return 'Member';
  }
}

function formatAffinityGroupRole(role?: string | null): string {
  switch (role) {
    case 'leader':
      return 'Leader';
    case 'coach':
      return 'Coach';
    default:
      return 'Member';
  }
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

function descriptorForMyOrg(org: MyOrg, interestSlug?: string | null): string {
  const role = formatOrgRole(org.role);
  if (interestSlug === 'nursing') return `${role} · issues your curriculum and placements`;
  if (interestSlug === 'sail-racing') return `${role} · publishes your race calendar`;
  return `${role} · runs the program`;
}

function descriptorForUserAffinityGroup(group: UserAffinityGroup): string {
  const org = compactOrgName(group.parent_org_name);
  return [formatAffinityGroupRole(group.role), org].filter(Boolean).join(' · ');
}

function descriptorForUserOrgCohort(cohort: UserOrgCohort): string {
  const role = cohort.role
    ? cohort.role.charAt(0).toUpperCase() + cohort.role.slice(1)
    : 'Member';
  const org = compactOrgName(cohort.org_name);
  return [role, org].filter(Boolean).join(' · ');
}

function descriptorForDiscoverableAffinityGroup(group: UserAffinityGroup): string {
  const org = compactOrgName(group.parent_org_name);
  return [affinityGroupKindLabel(group.kind), org].filter(Boolean).join(' · ');
}

function FollowPlanRow({ row }: { row: FollowRow }) {
  return (
    <Pressable
      style={styles.followPlanRow}
      onPress={() => router.push(row.route as never)}
    >
      <View style={styles.followPlanText}>
        <Text style={styles.followPlanTitle} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={styles.followPlanMeta} numberOfLines={1}>
          {row.author}
          {row.subscriberCount > 0
            ? ` · ${row.subscriberCount} subscriber${row.subscriberCount !== 1 ? 's' : ''}`
            : ''}
        </Text>
      </View>
      {row.badge ? (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{row.badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
      )}
    </Pressable>
  );
}

/** A blueprint a student was assigned through one of their cohorts. Unlike
 *  the marketplace "follow" rows, these are institution-managed: the action is
 *  to materialize the blueprint's steps straight into the student's own plan. */
function AssignedBlueprintRow({
  blueprint,
  pending,
  onAdopt,
  onOpen,
}: {
  blueprint: AssignedBlueprint;
  pending: boolean;
  onAdopt: () => void;
  onOpen: () => void;
}) {
  const fullyAdopted =
    blueprint.adoptedSteps >= blueprint.totalSteps && blueprint.totalSteps > 0;
  const remaining = blueprint.totalSteps - blueprint.adoptedSteps;
  const viaLabel = [blueprint.orgName, blueprint.cohortName]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.followPlanRow}>
      <Pressable
        style={styles.followPlanText}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Preview ${blueprint.title}`}
      >
        <Text style={styles.followPlanTitle} numberOfLines={2}>
          {blueprint.title}
        </Text>
        <Text style={styles.followPlanMeta} numberOfLines={1}>
          {viaLabel ? `${viaLabel} · ` : ''}
          {blueprint.totalSteps} step{blueprint.totalSteps !== 1 ? 's' : ''}
        </Text>
      </Pressable>
      {fullyAdopted ? (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{`Added · ${blueprint.totalSteps}`}</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.assignedAddBtn, pending && styles.assignedAddBtnPending]}
          disabled={pending}
          onPress={onAdopt}
          accessibilityRole="button"
          accessibilityLabel={`Add ${blueprint.title} to my plan`}
        >
          {pending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.assignedAddText}>
              {blueprint.adoptedSteps > 0 ? `Add ${remaining} more` : 'Add to plan'}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

/** Authoring affordance under YOURS → Plans. Distinct from the subscribed
 *  cards above it: following a Plan and publishing your own are different
 *  intents, so this reads as a dashed "+" action, not another plan card. */
function CreatePlanRow() {
  return (
    <Pressable
      style={styles.createPlanRow}
      onPress={() => router.push('/studio/blueprints/new' as never)}
      accessibilityRole="button"
      accessibilityLabel="Create a plan to publish"
    >
      <Ionicons name="add-circle-outline" size={20} color={IOS_COLORS.systemBlue} />
      <Text style={styles.createPlanText}>Create a plan</Text>
    </Pressable>
  );
}

interface RecentTile {
  key: string;
  kind: 'Concept' | 'Plan' | 'Resource';
  dot: string;
  title: string;
  foot: string;
  route: string;
}

/** Horizontal "jump back in" rail — the freshest item from each of the
 *  user's own surfaces, so the top of the feed is a way back into recent
 *  work rather than another browse list. */
function JumpBackInRail({ tiles }: { tiles: RecentTile[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.railContent}
    >
      {tiles.map((tile) => (
        <Pressable
          key={tile.key}
          style={styles.tile}
          onPress={() => router.push(tile.route as never)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${tile.title}`}
        >
          <View style={styles.tileKind}>
            <View style={[styles.tileDot, { backgroundColor: tile.dot }]} />
            <Text style={[styles.tileKindText, { color: tile.dot }]}>
              {tile.kind.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.tileTitle} numberOfLines={2}>
            {tile.title}
          </Text>
          <Text style={styles.tileFoot} numberOfLines={1}>
            {tile.foot}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** The "yours ↔ blueprints" axis as a segmented control. */
function TopSegment({
  value,
  onChange,
}: {
  value: 'yours' | 'stacks';
  onChange: (next: 'yours' | 'stacks') => void;
}) {
  return (
    <View style={styles.seg}>
      {(['yours', 'stacks'] as const).map((key) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            style={[styles.segItem, active && styles.segItemActive]}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>
              {key === 'yours' ? 'Yours' : 'Blueprints'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AllZone({
  counts,
  onJumpToZone,
  librarianSlot,
  initialSegment = 'yours',
}: AllZoneProps) {
  const { currentInterest, allInterests, userInterests, addInterest } = useInterest();
  const { user } = useAuth();
  const interestId = currentInterest?.id;
  const interestSlug = currentInterest?.slug;
  const isSailRacing = interestSlug === 'sail-racing';
  // Typographic arrow, not ASCII "->" — the scale hint sits in user-facing
  // chrome and the code-y form read as a leaked dev annotation.
  const circlesScale = isSailRacing ? 'crew → club' : interestSlug === 'nursing' ? 'cohort → school' : 'group → org';

  const { groups: userAffinityGroups, isLoading: affinityGroupsLoading } =
    useUserAffinityGroups(interestSlug);
  const { cohorts: userOrgCohorts, isLoading: orgCohortsLoading } =
    useUserOrgCohorts(interestSlug);
  const groupsLoading = affinityGroupsLoading || orgCohortsLoading;
  const groupRows = React.useMemo<LibraryGroupRow[]>(() => {
    const seen = new Set<string>();
    const keyFor = (name: string, orgId?: string | null) =>
      `${name.trim().toLowerCase()}::${orgId ?? ''}`;
    const rows: LibraryGroupRow[] = [];

    for (const group of userAffinityGroups) {
      seen.add(keyFor(group.name, group.parent_org_id));
      rows.push({
        id: `affinity:${group.id}`,
        name: group.name,
        initialsSource: group.short_name ?? group.name,
        descriptor: descriptorForUserAffinityGroup(group),
        route: `/group/${group.id}`,
      });
    }

    for (const cohort of userOrgCohorts) {
      const key = keyFor(cohort.name, cohort.org_id);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: `cohort:${cohort.id}`,
        name: cohort.name,
        initialsSource: cohort.name,
        descriptor: descriptorForUserOrgCohort(cohort),
        route: `/organization/cohort/${cohort.id}`,
      });
    }

    return rows;
  }, [userAffinityGroups, userOrgCohorts]);
  const groupPreview = groupRows.slice(0, PREVIEW_LIMIT);
  const groupCount = groupRows.length;
  const joinedAffinityGroupIds = React.useMemo(
    () => new Set(userAffinityGroups.map((g) => g.id)),
    [userAffinityGroups],
  );
  const { groups: discoverableAffinityGroups, isLoading: discoverableGroupsLoading } =
    useDiscoverableAffinityGroups(interestSlug, 8);

  const { data: plans, isLoading: plansLoading } =
    useSubscribedPlansForLibrary(interestId);
  const { data: concepts, isLoading: conceptsLoading } =
    useLifecycleConcepts(interestId);
  const { data: resources, isLoading: resourcesLoading } =
    useLibraryResourcesPreview(interestId, PREVIEW_LIMIT);
  const { data: inboxCount = 0 } = useUnsortedInboxCount();
  const { data: catalog, isLoading: catalogLoading } =
    useDiscoverBlueprints(interestId);
  const { blueprints: marketPlans, loading: marketLoading } =
    useMarketplaceBlueprints(interestId ?? null);
  const { assigned: assignedBlueprints } = useAssignedBlueprints(interestId);
  const queryClient = useQueryClient();
  const [subscribeSheetBp, setSubscribeSheetBp] = React.useState<AssignedBlueprint | null>(null);
  const [addingRemainingId, setAddingRemainingId] = React.useState<string | null>(null);

  const handleAddRemaining = React.useCallback(
    async (bp: AssignedBlueprint) => {
      if (!user?.id) return;
      setAddingRemainingId(bp.id);
      try {
        await addRemainingInstitutionalSteps(user.id, bp.id, bp.interestId);
        queryClient.invalidateQueries({ queryKey: ['timeline-steps'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['assigned-blueprints', user.id] });
        queryClient.invalidateQueries({ queryKey: ['library-plans'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['library-counts'], refetchType: 'all' });
      } finally {
        setAddingRemainingId(null);
      }
    },
    [user?.id, queryClient],
  );
  const { data: topOrgs, isLoading: orgsLoading } =
    useTopOrgsForInterest(interestSlug, PREVIEW_LIMIT);
  const { data: myOrgs } = useMyOrgs();
  // Same cached read OrganizationProvider uses — lets the org rows show the
  // viewer's own standing ("Member" / "Request pending") instead of only the
  // org's join mode.
  const { data: membershipRows } = useQuery({
    queryKey: orgMembershipsQueryKey(user?.id),
    enabled: !!user?.id,
    queryFn: () => fetchOrgMembershipRows(user!.id),
  });
  const membershipStatusByOrgId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of membershipRows ?? []) {
      const status = resolveOrgMembershipStatus(row);
      if (status) map.set(row.organization_id, status);
    }
    return map;
  }, [membershipRows]);

  const planPreview = (plans ?? []).slice(0, PREVIEW_LIMIT);
  const conceptPreview = (concepts ?? []).slice(0, PREVIEW_LIMIT);
  const resourcePreview = resources ?? [];
  // "Blueprints to follow" unifies the real authored catalog (System B)
  // with System-A discover blueprints — independent first, deduped by title.
  const followPreview = React.useMemo(() => {
    const rows: FollowRow[] = [];
    const seen = new Set<string>();
    const subscribedIds = new Set((plans ?? []).map((plan) => plan.blueprintId));
    const push = (row: FollowRow) => {
      if (subscribedIds.has(row.id)) return;
      const key = row.title.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    };
    for (const p of marketPlans) push(marketplaceToFollowRow(p));
    for (const bp of catalog ?? []) push(discoveredToFollowRow(bp));
    return rows.slice(0, PREVIEW_LIMIT);
  }, [marketPlans, catalog, plans]);
  const myOrgRows = React.useMemo(
    () => (myOrgs ?? []).filter((org) => org.interest_slug === interestSlug).slice(0, PREVIEW_LIMIT),
    [myOrgs, interestSlug],
  );
  const orgPreview = React.useMemo(
    () => (topOrgs ?? []).filter((org) => membershipStatusByOrgId.get(org.id) !== 'active'),
    [topOrgs, membershipStatusByOrgId],
  );
  const groupJoinPreview = React.useMemo(
    () =>
      discoverableAffinityGroups
        .filter((group) => !joinedAffinityGroupIds.has(group.id))
        .slice(0, PREVIEW_LIMIT),
    [discoverableAffinityGroups, joinedAffinityGroupIds],
  );

  // Top-level "yours ↔ blueprints" axis, made literal as a segmented
  // control. Each half is a full screen so the user never scrolls their
  // own shelf to reach catalog content (or vice versa).
  const [topSegment, setTopSegment] = React.useState<'yours' | 'stacks'>(initialSegment);

  React.useEffect(() => {
    setTopSegment(initialSegment);
  }, [initialSegment]);

  // Jump-back-in: the freshest real item from each of the user's own
  // surfaces. Not true "last-opened" (we don't track opens yet) — this is
  // the latest concept / active plan / latest resource, so it's honest
  // "pick up your recent work" without fabricating history.
  const recentItems = React.useMemo<RecentTile[]>(() => {
    const tiles: RecentTile[] = [];
    const concept = (concepts ?? [])[0];
    if (concept) {
      tiles.push({
        key: `concept:${concept.id}`,
        kind: 'Concept',
        dot: '#A855F7',
        title: concept.title ?? 'Untitled concept',
        foot: `${concept.linked_step_count ?? 0} steps`,
        route: `/(tabs)/library/concept/${concept.id}`,
      });
    }
    const plan = (plans ?? [])[0];
    if (plan) {
      tiles.push({
        key: `plan:${plan.blueprintId}`,
        kind: 'Plan',
        dot: '#3B82F6',
        title: plan.title,
        // Mirror PlanRowCard: a step-less plan has no progress fraction to
        // show — "0 of —" reads as broken.
        foot:
          plan.progressContext ??
          (plan.stepCount > 0 ? `${plan.doneCount} of ${plan.stepCount}` : 'no steps yet'),
        route: plan.route ?? `/(tabs)/library/blueprints/${plan.blueprintId}`,
      });
    }
    const resource = (resources ?? [])[0];
    if (resource) {
      tiles.push({
        key: `resource:${resource.id}`,
        kind: 'Resource',
        dot: '#F59E0B',
        title: resource.title,
        foot: resource.capturedAt ?? 'saved',
        route: `/library/items/${resource.id}`,
      });
    }
    return tiles;
  }, [concepts, plans, resources]);

  // Adjacent interests = the catalog minus what the user already practices,
  // ranked by relatedness to the interests they DO practice (shared domain /
  // parent) so "suggested" means adjacent, not just alphabetically-first.
  const suggestedInterests = React.useMemo(() => {
    const owned = new Set(userInterests.map((i) => i.slug));
    const ownedDomainIds = new Set(
      userInterests.map((i) => i.parent_id).filter((id): id is string => !!id),
    );
    const ownedIds = new Set(userInterests.map((i) => i.id));
    const relatedness = (cand: Interest): number => {
      let score = 0;
      if (cand.parent_id && ownedDomainIds.has(cand.parent_id)) score += 3; // sibling under a domain you practice
      if (cand.parent_id && ownedIds.has(cand.parent_id)) score += 2; // child of an interest you practice
      return score;
    };
    return allInterests
      .filter((i) => !owned.has(i.slug))
      .map((i) => ({ i, score: relatedness(i) }))
      .sort((a, b) => b.score - a.score || a.i.name.localeCompare(b.i.name))
      .slice(0, 6)
      .map((x) => x.i);
  }, [allInterests, userInterests]);

  // Tapping a suggested chip ADDS the interest inline (the four-tier verb is
  // "add interests"), with an optimistic confirmation pill — no longer a dead
  // end into the generic browse list.
  const [addingSlugs, setAddingSlugs] = React.useState<Set<string>>(() => new Set());
  const [addedConfirmation, setAddedConfirmation] = React.useState<string | null>(null);
  const confirmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddInterest = React.useCallback(
    (interest: Interest) => {
      if (addingSlugs.has(interest.slug)) return;
      setAddingSlugs((prev) => new Set(prev).add(interest.slug));
      setAddedConfirmation(interest.name);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setAddedConfirmation(null), 2600);
      void Promise.resolve(addInterest(interest.slug)).finally(() => {
        setAddingSlugs((prev) => {
          const next = new Set(prev);
          next.delete(interest.slug);
          return next;
        });
      });
    },
    [addInterest, addingSlugs],
  );

  React.useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  return (
    <View style={styles.container}>
      {librarianSlot ? <View style={styles.librarian}>{librarianSlot}</View> : null}

      {/* This week — the timely editorial surface folded in from the old
          Discover "Today". A slim neutral ribbon, not a blue-sparkles card:
          the librarian register owns the purple voice above it, so this
          stays quiet rather than competing as a second "intelligence" tile. */}
      <Pressable
        style={styles.thisWeek}
        onPress={() => onJumpToZone('today')}
        accessibilityRole="button"
        accessibilityLabel="See what's worth your attention this week"
      >
        <Ionicons name="calendar-outline" size={16} color={IOS_COLORS.secondaryLabel} />
        <Text style={styles.thisWeekTitle}>This week</Text>
        <Text style={styles.thisWeekHint} numberOfLines={1}>
          What's worth your attention
        </Text>
        <Ionicons name="chevron-forward" size={15} color={IOS_COLORS.tertiaryLabel} />
      </Pressable>

      {/* Inbox — the capture-first pile. A quiet ribbon (mirrors This week)
          so the unsorted dump is one tap from the feed without competing
          with the librarian voice. The count nudges triage when it's growing. */}
      <Pressable
        style={styles.thisWeek}
        onPress={() => onJumpToZone('inbox')}
        accessibilityRole="button"
        accessibilityLabel="Open your capture inbox"
      >
        <Ionicons name="file-tray-outline" size={16} color={IOS_COLORS.secondaryLabel} />
        <Text style={styles.thisWeekTitle}>Inbox</Text>
        <Text style={styles.thisWeekHint} numberOfLines={1}>
          {inboxCount > 0
            ? `${inboxCount} to sort`
            : 'Dump links & ideas to sort later'}
        </Text>
        {inboxCount > 0 ? (
          <View style={styles.inboxCountPill}>
            <Text style={styles.inboxCountText}>{inboxCount}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={15} color={IOS_COLORS.tertiaryLabel} />
        )}
      </Pressable>

      {/* ---------------------------------------------------------------- */}
      {/* The "yours ↔ blueprints" axis, made literal.                     */}
      {/* ---------------------------------------------------------------- */}
      <View style={styles.segWrap}>
        <TopSegment value={topSegment} onChange={setTopSegment} />
      </View>

      {topSegment === 'yours' ? (
        <>
      {recentItems.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.railLabel}>JUMP BACK IN</Text>
          <JumpBackInRail tiles={recentItems} />
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="PLANS"
          dotColor="#3B82F6"
          count={counts?.plans}
          onSeeAll={() => onJumpToZone('plans')}
        />
        {plansLoading && !plans ? (
          <LoadingRow />
        ) : planPreview.length === 0 ? (
          <EmptyHint>
            Follow a blueprint below to see it here.
          </EmptyHint>
        ) : (
          <View style={styles.cardList}>
            {planPreview.map((plan) => (
              <PlanRowCard
                key={plan.blueprintId}
                plan={plan}
                onPress={() =>
                  router.push((plan.route ?? `/(tabs)/library/blueprints/${plan.blueprintId}`) as never)
                }
              />
            ))}
          </View>
        )}
        <CreatePlanRow />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="CONCEPTS"
          dotColor="#A855F7"
          count={counts?.concepts}
          onSeeAll={() => onJumpToZone('concepts')}
        />
        {conceptsLoading && !concepts ? (
          <LoadingRow />
        ) : conceptPreview.length === 0 ? (
          <EmptyHint>Capture an insight from the universal + to start a concept.</EmptyHint>
        ) : (
          <View style={styles.conceptList}>
            {conceptPreview.map((concept) => (
              <ConceptCard
                key={concept.id}
                state={concept.state}
                title={concept.title}
                meta={[
                  { icon: 'steps', label: `${concept.linked_step_count} steps` },
                  { icon: 'quotes', label: `${concept.quote_count} quotes` },
                ]}
                onPress={() =>
                  router.push(`/(tabs)/library/concept/${concept.id}` as never)
                }
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="RESOURCES"
          dotColor="#F59E0B"
          count={counts?.resources}
          onSeeAll={() => onJumpToZone('resources')}
        />
        {resourcesLoading && !resources ? (
          <LoadingRow />
        ) : resourcePreview.length === 0 ? (
          <EmptyHint>Articles, videos, drills you've saved to come back to.</EmptyHint>
        ) : (
          <View style={styles.resourceList}>
            {resourcePreview.map((item) => (
              <RecentItemRow
                key={item.id}
                item={item}
                onPress={() => router.push(`/library/items/${item.id}` as never)}
              />
            ))}
          </View>
        )}
      </View>

      <CirclesHeader title="Your circles" scale={circlesScale} />

      <View style={styles.section}>
        <SectionHeader
          title="GROUPS"
          dotColor="#14B8A6"
          count={groupCount || undefined}
          onSeeAll={() => onJumpToZone('groups')}
        />
        {groupsLoading && groupCount === 0 ? (
          <LoadingRow />
        ) : groupCount === 0 ? (
          <EmptyHint>
            {isSailRacing
              ? "The crews and fleets you're in — the people on the start line with you."
              : interestSlug === 'nursing'
                ? 'Your cohorts will show up here — the people moving through the rotation with you.'
                : `Groups for ${currentInterest?.name ?? 'this interest'} will show up here once you join one.`}
          </EmptyHint>
        ) : (
          <>
          <SectionSubline>
            {isSailRacing
              ? 'The people you train alongside.'
              : 'The people moving through the work with you.'}
          </SectionSubline>
          <CanonicalList>
            {groupPreview.map((group, idx) => (
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
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="ORGS"
          dotColor="#10B981"
          count={myOrgRows.length || undefined}
          onSeeAll={() => onJumpToZone('orgs')}
        />
        {myOrgRows.length === 0 ? (
          <EmptyHint>
            {isSailRacing
              ? "The clubs and class associations you've joined — they own the calendar and publish the plans."
              : interestSlug === 'nursing'
                ? "The schools and programs you've joined — they issue curriculum and placements."
                : `Organizations you belong to in ${currentInterest?.name ?? 'this interest'} will show up here.`}
          </EmptyHint>
        ) : (
          <>
            <SectionSubline>
              {isSailRacing
                ? 'The institutions that run the program.'
                : interestSlug === 'nursing'
                  ? 'The schools and programs that run the curriculum.'
                  : 'The institutions that run the program.'}
            </SectionSubline>
            <CanonicalList>
              {myOrgRows.map((org, idx) => (
                <CanonicalOrgRow
                  key={org.id}
                  first={idx === 0}
                  initials={initialsForName(org.name)}
                  markColor={pickSquareMarkColor(org.id)}
                  name={org.name}
                  descriptor={descriptorForMyOrg(org, interestSlug)}
                  joinedLabel={formatOrgRole(org.role)}
                  onPress={() =>
                    org.slug
                      ? router.push(`/discover/org/${org.slug}?from=library-yours` as never)
                      : undefined
                  }
                />
              ))}
            </CanonicalList>
          </>
        )}
      </View>

        </>
      ) : (
        <>
      {assignedBlueprints.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="ASSIGNED TO YOU" dotColor="#7C3AED" />
          <SectionSubline>
            Published by your program — add it to start the steps.
          </SectionSubline>
          <View style={styles.followList}>
            {assignedBlueprints.map((bp) => (
              <AssignedBlueprintRow
                key={bp.id}
                blueprint={bp}
                pending={addingRemainingId === bp.id}
                onAdopt={() =>
                  bp.adoptedSteps > 0
                    ? handleAddRemaining(bp)
                    : setSubscribeSheetBp(bp)
                }
                onOpen={() => router.push(`/blueprint/assigned/${bp.id}` as never)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader
          title="BLUEPRINTS TO FOLLOW"
          dotColor="#0EA5E9"
          onSeeAll={() => onJumpToZone('follow')}
        />
        {(catalogLoading || marketLoading) && followPreview.length === 0 ? (
          <LoadingRow />
        ) : followPreview.length === 0 ? (
          <EmptyHint>
            No published {currentInterest?.name ?? ''} blueprints yet — you'll be among
            the first to follow one when they land.
          </EmptyHint>
        ) : (
          <View style={styles.followList}>
            {followPreview.map((row) => (
              <FollowPlanRow key={`${row.route}:${row.id}`} row={row} />
            ))}
          </View>
        )}
      </View>

      <CirclesHeader title="Circles to join" scale={circlesScale} />

      <View style={styles.section}>
        <SectionHeader
          title="GROUPS TO JOIN"
          dotColor="#14B8A6"
          onSeeAll={() => onJumpToZone('groups')}
        />
        {discoverableGroupsLoading && groupJoinPreview.length === 0 ? (
          <LoadingRow />
        ) : groupJoinPreview.length === 0 ? (
          <EmptyHint>
            {isSailRacing
              ? 'Crews near you taking on members will show up here.'
              : `Groups to join in ${currentInterest?.name ?? 'this interest'} will show up here when available.`}
          </EmptyHint>
        ) : (
          <>
            <SectionSubline>
              {isSailRacing
                ? 'Crews near you taking on members.'
                : 'People you could practice with next.'}
            </SectionSubline>
          <CanonicalList>
              {groupJoinPreview.map((group, idx) => (
                <CanonicalOrgRow
                  key={group.id}
                  first={idx === 0}
                  initials={initialsForGroup(group.short_name, group.name)}
                  markColor={pickSquareMarkColor(group.id)}
                  name={group.name}
                  descriptor={descriptorForDiscoverableAffinityGroup(group)}
                  onPress={() => router.push(`/group/${group.id}` as never)}
                />
              ))}
          </CanonicalList>
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="ORGS TO JOIN"
          dotColor="#10B981"
          onSeeAll={() => onJumpToZone('orgs')}
        />
        {orgsLoading && !topOrgs ? (
          <LoadingRow />
        ) : orgPreview.length === 0 ? (
          <EmptyHint>
            {isSailRacing
              ? 'Clubs and schools that own the calendar will show up here.'
              : interestSlug === 'nursing'
                ? 'Schools and programs you can join will show up here.'
                : `Organizations in ${currentInterest?.name ?? 'this craft'} will show up here as they come online.`}
          </EmptyHint>
        ) : (
          <>
          <SectionSubline>
            {isSailRacing
              ? 'Clubs and schools that own the calendar.'
              : interestSlug === 'nursing'
                ? 'Schools and programs that run the curriculum.'
                : 'Institutions that run the program.'}
          </SectionSubline>
          <CanonicalList>
            {orgPreview.map((org, idx) => (
              <CanonicalOrgRow
                key={org.id}
                first={idx === 0}
                initials={initialsForName(org.name)}
                markColor={pickSquareMarkColor(org.id)}
                name={org.name}
                descriptor={describeOrgStanding(
                  membershipStatusByOrgId.get(org.id),
                  org,
                )}
                onPress={() =>
                  router.push(`/discover/org/${org.slug}?from=library` as never)
                }
              />
            ))}
          </CanonicalList>
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="INTERESTS"
          dotColor="#F472B6"
          onSeeAll={() => onJumpToZone('interests')}
        />
        {addedConfirmation ? (
          <View style={styles.addedPill}>
            <Ionicons name="checkmark-circle" size={15} color="#34C759" />
            <Text style={styles.addedPillText}>
              Added {addedConfirmation} to your interests
            </Text>
          </View>
        ) : null}
        {suggestedInterests.length === 0 ? (
          <EmptyHint>You've added every interest we know about — nice.</EmptyHint>
        ) : (
          <View style={styles.interestWrap}>
            {suggestedInterests.map((interest) => {
              const accent = interest.accent_color ?? IOS_COLORS.systemBlue;
              const adding = addingSlugs.has(interest.slug);
              return (
                <Pressable
                  key={interest.slug}
                  style={[
                    styles.interestChip,
                    { borderColor: accent + '55' },
                    adding && styles.interestChipAdding,
                  ]}
                  onPress={() => handleAddInterest(interest)}
                  disabled={adding}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${interest.name} to your interests`}
                >
                  {adding ? (
                    <ActivityIndicator size="small" color={accent} style={styles.interestSpinner} />
                  ) : (
                    <Ionicons name="add" size={14} color={accent} />
                  )}
                  <Text style={styles.interestChipText} numberOfLines={1}>
                    {interest.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
        </>
      )}

      {subscribeSheetBp ? (
        <BlueprintSubscribeSheet
          visible={!!subscribeSheetBp}
          onClose={() => setSubscribeSheetBp(null)}
          blueprint={{
            id: subscribeSheetBp.id,
            system: 'institutional',
            title: subscribeSheetBp.title,
            authorInterestId: subscribeSheetBp.interestId,
            authorInterestSlug: subscribeSheetBp.interestSlug,
            authorInterestLabel: subscribeSheetBp.interestName,
            orgLabel: subscribeSheetBp.orgName,
          }}
        />
      ) : null}
    </View>
  );
}

function describeOrgStanding(
  membershipStatus: string | undefined,
  org: TopOrgRow,
): string {
  if (membershipStatus === 'active') return 'Member';
  if (membershipStatus === 'pending') return 'Request pending';
  if (isOrgPlaceholder(org)) {
    if (org.organization_type === 'yacht_club') {
      if (org.claim_status === 'claim_pending') return 'Yacht club placeholder · claim pending';
      if (org.claim_status === 'rejected') return 'Yacht club placeholder · claim rejected';
      return 'Unclaimed placeholder';
    }
    return 'Unclaimed placeholder';
  }
  return describeOrgJoinMode(org.join_mode);
}

function isOrgPlaceholder(org: TopOrgRow): boolean {
  return (
    org.status === 'placeholder' ||
    org.official === false ||
    org.claim_status === 'unclaimed' ||
    org.source === 'dragon_worlds_clubspot'
  );
}

function describeOrgJoinMode(mode: string): string {
  switch (mode) {
    case 'open':
    case 'public':
      return 'Open to join';
    case 'request':
    case 'request_to_join':
      return 'Request to join';
    case 'invite_only':
      return 'Invite only';
    default:
      return 'Organization';
  }
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: IOS_SPACING.md,
    gap: IOS_SPACING.xl,
  },
  librarian: {
    gap: IOS_SPACING.md,
  },
  thisWeek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: IOS_SPACING.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
  },
  thisWeekTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  thisWeekHint: {
    flex: 1,
    fontSize: 12.5,
    color: IOS_COLORS.tertiaryLabel,
  },
  inboxCountPill: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  segWrap: {
    paddingHorizontal: IOS_SPACING.lg,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: 11,
    padding: 3,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  segItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  segText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  segTextActive: {
    color: IOS_COLORS.label,
  },
  railLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: IOS_COLORS.tertiaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
  },
  railContent: {
    gap: 11,
    paddingHorizontal: IOS_SPACING.lg,
  },
  tile: {
    width: 132,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 11,
  },
  tileKind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  tileDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tileKindText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 17,
    minHeight: 34,
    marginBottom: 6,
  },
  tileFoot: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
  },
  section: {
    gap: IOS_SPACING.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: IOS_COLORS.label,
  },
  eyebrowCount: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    paddingVertical: 4,
  },
  emptyHint: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
  },
  sectionSubline: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
    marginTop: -4,
  },
  circlesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: IOS_SPACING.lg,
    marginBottom: -4,
  },
  circlesTitle: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: IOS_COLORS.tertiaryLabel,
  },
  circlesLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.18)',
  },
  circlesScale: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: IOS_SPACING.md,
  },
  cardList: {
    gap: IOS_SPACING.md,
  },
  createPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: IOS_SPACING.lg,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: 'rgba(10,132,255,0.4)',
    backgroundColor: 'rgba(10,132,255,0.04)',
  },
  createPlanText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  conceptList: {
    gap: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.lg,
  },
  resourceList: {
    marginHorizontal: IOS_SPACING.lg,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  followList: {
    marginHorizontal: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
  },
  followPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 14,
  },
  followPlanText: {
    flex: 1,
    gap: 3,
  },
  followPlanTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  followPlanMeta: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  planBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  assignedAddBtn: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  assignedAddBtnPending: {
    opacity: 0.6,
  },
  assignedAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
  },
  interestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: IOS_SPACING.lg,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  interestChipAdding: {
    opacity: 0.6,
  },
  interestSpinner: {
    width: 14,
    height: 14,
  },
  interestChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    maxWidth: 160,
  },
  addedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginHorizontal: IOS_SPACING.lg,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(52,199,89,0.12)',
  },
  addedPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B7A38',
  },
});
