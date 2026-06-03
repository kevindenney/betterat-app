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
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';
import { useSubscribedPlansForLibrary } from '@/hooks/useSubscribedPlansForLibrary';
import { useLifecycleConcepts } from '@/hooks/usePlaybook';
import { useLibraryResourcesPreview } from '@/hooks/useLibraryResourcesPreview';
import { useDiscoverBlueprints } from '@/hooks/useBlueprint';
import { useMarketplaceBlueprints, type MarketplaceBlueprint } from '@/hooks/useMarketplaceBlueprints';
import { useTopOrgsForInterest } from '@/hooks/useTopOrgsForInterest';
import { useUserFleets } from '@/hooks/useFleetData';
import { useInterest, type Interest } from '@/providers/InterestProvider';
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

/** The "yours ↔ the stacks" axis as a segmented control. */
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
              {key === 'yours' ? 'Yours' : 'The stacks'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AllZone({ counts, onJumpToZone, librarianSlot }: AllZoneProps) {
  const { currentInterest, allInterests, userInterests, addInterest } = useInterest();
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

  // Top-level "yours ↔ the stacks" axis, made literal as a segmented
  // control. Each half is a full screen so the user never scrolls their
  // own shelf to reach catalog content (or vice versa).
  const [topSegment, setTopSegment] = React.useState<'yours' | 'stacks'>('yours');

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
        foot: plan.progressContext ?? `${plan.doneCount} of ${plan.stepCount || '—'}`,
        route: `/(tabs)/library/blueprints/${plan.blueprintId}`,
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

      {/* ---------------------------------------------------------------- */}
      {/* The "yours ↔ the stacks" axis, made literal.                     */}
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

        </>
      ) : (
        <>
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
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
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
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 16,
    height: 32,
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
