/**
 * <AllZone> — the unified Library feed (the "Librarian" / all landing).
 *
 * This is the curated front door of the consolidated Library tab. It is
 * organized on a single "yours ↔ the stacks" axis, and — crucially —
 * every section previews REAL top items as cards, never a bare "browse"
 * nav row:
 *
 *   Librarian      — the cross-cutting noticed card (passed in).
 *   YOURS
 *     Plans        — your subscribed Plans            → Blueprints zone
 *     Concepts     — mental models you're forming     → Concepts zone
 *     Resources    — things you've saved              → Resources zone
 *   THE STACKS
 *     Plans to follow — published, subscribable Plans → Discover · plans
 *     Orgs            — orgs to join in this craft    → Discover · orgs
 *     Interests       — adjacent interests to add     → Discover · interests
 *
 * Each section self-collapses to a muted hint when it has no real data,
 * so the See-all link stays reachable without padding the feed with
 * empty cards. Copy says "Plans"; DB/code identifiers stay `blueprint_*`.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';
import { useSubscribedPlansForLibrary } from '@/hooks/useSubscribedPlansForLibrary';
import { useLifecycleConcepts } from '@/hooks/usePlaybook';
import { useLibraryResourcesPreview } from '@/hooks/useLibraryResourcesPreview';
import { useDiscoverBlueprints } from '@/hooks/useBlueprint';
import { useMarketplaceBlueprints, type MarketplaceBlueprint } from '@/hooks/useMarketplaceBlueprints';
import { useTopOrgsForInterest } from '@/hooks/useTopOrgsForInterest';
import { useUserFleets } from '@/hooks/useFleetData';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { groupRoleDescriptor } from '@/components/library/zones/GroupsZone';
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
}

interface SectionHeaderProps {
  title: string;
  dotColor: string;
  count?: number;
  onSeeAll: () => void;
}

function SectionHeader({ title, dotColor, count, onSeeAll }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.headLeft}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.eyebrow}>{title}</Text>
      </View>
      <Pressable
        onPress={onSeeAll}
        accessibilityRole="link"
        accessibilityLabel={`See all ${title}`}
        hitSlop={6}
        style={styles.seeAllBtn}
      >
        <Text style={styles.seeAllText}>
          {typeof count === 'number' ? `See all ${count}` : 'See all'}
        </Text>
        <Ionicons name="chevron-forward" size={12} color={IOS_COLORS.systemBlue} />
      </Pressable>
    </View>
  );
}

function GroupDivider({ label }: { label: string }) {
  return <Text style={styles.groupLabel}>{label}</Text>;
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.emptyHint}>{children}</Text>;
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

export function AllZone({ counts, onJumpToZone, librarianSlot }: AllZoneProps) {
  const { currentInterest, allInterests, userInterests } = useInterest();
  const { user } = useAuth();
  const interestId = currentInterest?.id;
  const interestSlug = currentInterest?.slug;

  // Groups are interest-agnostic — getFleetsForUser is global, not
  // interest-scoped — so this preview is the same in every craft.
  const { fleets, loading: groupsLoading } = useUserFleets(user?.id);
  const groupPreview = fleets.slice(0, PREVIEW_LIMIT);

  const { data: plans, isLoading: plansLoading } =
    useSubscribedPlansForLibrary(interestId);
  const { data: concepts, isLoading: conceptsLoading } =
    useLifecycleConcepts(interestId);
  const { data: resources, isLoading: resourcesLoading } =
    useLibraryResourcesPreview(interestId, PREVIEW_LIMIT);
  const { data: catalog, isLoading: catalogLoading } =
    useDiscoverBlueprints(interestId);
  const { blueprints: marketPlans, loading: marketLoading } =
    useMarketplaceBlueprints(interestId ?? null);
  const { data: topOrgs, isLoading: orgsLoading } =
    useTopOrgsForInterest(interestSlug, PREVIEW_LIMIT);

  const planPreview = (plans ?? []).slice(0, PREVIEW_LIMIT);
  const conceptPreview = (concepts ?? []).slice(0, PREVIEW_LIMIT);
  const resourcePreview = resources ?? [];
  // "Plans to follow" unifies the real authored catalog (System B,
  // marketplace) with System-A discover blueprints — marketplace first,
  // deduped by title — so newly authored Plans surface here too.
  const followPreview = React.useMemo(() => {
    const rows: FollowRow[] = [];
    const seen = new Set<string>();
    const push = (row: FollowRow) => {
      const key = row.title.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    };
    for (const p of marketPlans) push(marketplaceToFollowRow(p));
    for (const bp of catalog ?? []) push(discoveredToFollowRow(bp));
    return rows.slice(0, PREVIEW_LIMIT);
  }, [marketPlans, catalog]);
  const orgPreview = topOrgs ?? [];

  // Adjacent interests = the catalog minus what the user already practices.
  const suggestedInterests = React.useMemo(() => {
    const owned = new Set(userInterests.map((i) => i.slug));
    return allInterests.filter((i) => !owned.has(i.slug)).slice(0, 6);
  }, [allInterests, userInterests]);

  return (
    <View style={styles.container}>
      {librarianSlot ? <View style={styles.librarian}>{librarianSlot}</View> : null}

      {/* This week — the timely editorial surface folded in from the old
          Discover "Today". One tap into the full-bleed zone. */}
      <Pressable
        style={styles.thisWeek}
        onPress={() => onJumpToZone('today')}
        accessibilityRole="button"
        accessibilityLabel="See what's worth your attention this week"
      >
        <View style={styles.thisWeekIcon}>
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.thisWeekText}>
          <Text style={styles.thisWeekTitle}>This week</Text>
          <Text style={styles.thisWeekSubtitle} numberOfLines={1}>
            What's worth your attention across your crafts
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
      </Pressable>

      {/* ---------------------------------------------------------------- */}
      {/* YOURS                                                            */}
      {/* ---------------------------------------------------------------- */}
      <GroupDivider label="YOURS" />

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
            Follow a coach-bundled Plan from the stacks below to see it here.
          </EmptyHint>
        ) : (
          <View style={styles.cardList}>
            {planPreview.map((plan) => (
              <PlanRowCard
                key={plan.blueprintId}
                plan={plan}
                onPress={() =>
                  router.push(`/(tabs)/library/blueprints/${plan.blueprintId}` as never)
                }
              />
            ))}
          </View>
        )}
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

      <View style={styles.section}>
        <SectionHeader
          title="GROUPS"
          dotColor="#14B8A6"
          count={fleets.length || undefined}
          onSeeAll={() => onJumpToZone('groups')}
        />
        {groupsLoading && fleets.length === 0 ? (
          <LoadingRow />
        ) : groupPreview.length === 0 ? (
          <EmptyHint>
            Fleets, clubs, and cohorts you belong to show up here.
          </EmptyHint>
        ) : (
          <CanonicalList>
            {groupPreview.map((m, idx) => (
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
        )}
      </View>

      {/* ---------------------------------------------------------------- */}
      {/* THE STACKS                                                       */}
      {/* ---------------------------------------------------------------- */}
      <GroupDivider label="THE STACKS" />

      <View style={styles.section}>
        <SectionHeader
          title="PLANS TO FOLLOW"
          dotColor="#0EA5E9"
          onSeeAll={() => onJumpToZone('follow')}
        />
        {(catalogLoading || marketLoading) && followPreview.length === 0 ? (
          <LoadingRow />
        ) : followPreview.length === 0 ? (
          <EmptyHint>
            No published {currentInterest?.name ?? ''} Plans yet — you'll be among the
            first to follow one when they land.
          </EmptyHint>
        ) : (
          <View style={styles.followList}>
            {followPreview.map((row) => (
              <FollowPlanRow key={`${row.route}:${row.id}`} row={row} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="ORGS"
          dotColor="#10B981"
          onSeeAll={() => onJumpToZone('orgs')}
        />
        {orgsLoading && !topOrgs ? (
          <LoadingRow />
        ) : orgPreview.length === 0 ? (
          <EmptyHint>
            Clubs, schools, and programs in {currentInterest?.name ?? 'this craft'} will
            show up here as they come online.
          </EmptyHint>
        ) : (
          <CanonicalList>
            {orgPreview.map((org, idx) => (
              <CanonicalOrgRow
                key={org.id}
                first={idx === 0}
                initials={initialsForName(org.name)}
                markColor={pickSquareMarkColor(org.id)}
                name={org.name}
                descriptor={describeOrgJoinMode(org.join_mode)}
                onPress={() =>
                  router.push(`/discover/org/${org.slug}?from=library` as never)
                }
              />
            ))}
          </CanonicalList>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="INTERESTS"
          dotColor="#F472B6"
          onSeeAll={() => onJumpToZone('interests')}
        />
        {suggestedInterests.length === 0 ? (
          <EmptyHint>You've added every interest we know about — nice.</EmptyHint>
        ) : (
          <View style={styles.interestWrap}>
            {suggestedInterests.map((interest) => (
              <Pressable
                key={interest.slug}
                style={[
                  styles.interestChip,
                  { borderColor: (interest.accent_color ?? IOS_COLORS.systemBlue) + '55' },
                ]}
                onPress={() => onJumpToZone('interests')}
              >
                <View
                  style={[
                    styles.interestDot,
                    { backgroundColor: interest.accent_color ?? IOS_COLORS.systemBlue },
                  ]}
                />
                <Text style={styles.interestChipText} numberOfLines={1}>
                  {interest.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
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
    gap: 12,
    marginHorizontal: IOS_SPACING.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
  },
  thisWeekIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
  },
  thisWeekText: {
    flex: 1,
    gap: 2,
  },
  thisWeekTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  thisWeekSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: IOS_COLORS.tertiaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
    marginBottom: -IOS_SPACING.sm,
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: IOS_COLORS.label,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: IOS_SPACING.md,
  },
  cardList: {
    gap: IOS_SPACING.md,
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
  interestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  interestChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    maxWidth: 160,
  },
});
