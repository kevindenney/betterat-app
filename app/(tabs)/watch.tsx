import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { LocationAnchor } from '@/components/ui/LocationAnchor';
import { HomeVenuePickerSheet } from '@/components/discover/HomeVenuePickerSheet';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { useUserHomeVenue, isSailingInterest } from '@/hooks/useUserHomeVenue';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
  useFollowedStepsFeed,
  type FollowedStepItem,
  type FollowedStepStatus,
} from '@/hooks/useFollowedStepsFeed';
import { useFleetStepFeed } from '@/hooks/useFleetStepFeed';
import { useUserFleets } from '@/hooks/useFleetData';
import type { FleetMembership } from '@/services/fleetService';
import { useBlueprintTitles } from '@/hooks/useBlueprintTitles';
import { useCohortStream, type CohortStreamItem } from '@/hooks/useCohortStream';
import {
  useFollowedPeopleForLibrary,
  type FollowedPersonRow,
} from '@/hooks/useFollowedPeopleForLibrary';
import { useAdoptStep } from '@/hooks/useTimelineSteps';
import { WatchNearbySection } from '@/components/watch/WatchNearbySection';
import { WatchFilterRow, type WatchFilterChip } from '@/components/watch/WatchFilterRow';
import { DiscoverPeopleContent } from '@/components/discover/DiscoverPeopleContent';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

const STATUS_META: Record<
  FollowedStepStatus,
  { label: string; color: string; background: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  planning: {
    label: 'Planning',
    color: '#8A4B08',
    background: '#FFF4D6',
    icon: 'time-outline',
  },
  doing: {
    label: 'Doing',
    color: '#0A6A56',
    background: '#DDF8F0',
    icon: 'play-circle-outline',
  },
  reflected: {
    label: 'Reflected',
    color: '#3155B5',
    background: '#E5EDFF',
    icon: 'sparkles-outline',
  },
  completed: {
    label: 'Completed',
    color: '#5B2C83',
    background: '#F0E6FF',
    icon: 'checkmark-done-outline',
  },
};

// The Watch lens. Each option's label always matches the feed rendered
// below it (People = who you follow + cohort, Nearby = by place, Groups =
// your fleets) — no more "Following" label sitting over cohort threads.
type GroupingId = 'all' | 'fleet' | 'location';

const LENS_OPTIONS: { id: GroupingId; label: string }[] = [
  { id: 'all', label: 'People' },
  { id: 'location', label: 'Nearby' },
  { id: 'fleet', label: 'Groups' },
];

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const minutes = Math.floor((Date.now() - t) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function WatchScreen() {
  const insets = useSafeAreaInsets();
  const homeVenue = useUserHomeVenue();
  const { currentInterest } = useInterest();
  const { user } = useAuth();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [grouping, setGrouping] = useState<GroupingId>('all');
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  // People discovery (find new people to follow) was folded out of the
  // Discover tab into Watch — it opens as a focused full-bleed surface
  // over the feed, with a floating back pill (mirrors the Library zones).
  const [findPeopleOpen, setFindPeopleOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const onToggleFollow = (id: string) => {
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { data: feed = [], isLoading } = useFollowedStepsFeed(
    user?.id ?? null,
    currentInterest?.id,
  );

  // "By group" feed — fleetmates' steps, scoped to the active fleet. Fleets
  // aren't org_memberships (separate fleet_members table), so resolve them
  // here rather than from the org switcher.
  const { fleets } = useUserFleets(user?.id ?? null);
  const activeFleets = fleets.filter((f) => f.status === 'active');
  const resolvedFleetId =
    selectedFleetId && activeFleets.some((f) => f.fleet.id === selectedFleetId)
      ? selectedFleetId
      : activeFleets[0]?.fleet.id ?? null;
  const { data: fleetFeed = [], isLoading: fleetLoading } = useFleetStepFeed(
    grouping === 'fleet' ? resolvedFleetId : null,
    currentInterest?.id,
  );

  const { data: cohortStream = [] } = useCohortStream(currentInterest?.id);
  const { data: followedPeople = [] } = useFollowedPeopleForLibrary();
  const followingCount = followedPeople.length;

  // Resolve blueprint titles across the whole feed so every card can show
  // where it came from.
  const allBlueprintIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of feed) if (item.sourceBlueprintId) set.add(item.sourceBlueprintId);
    for (const item of fleetFeed) if (item.sourceBlueprintId) set.add(item.sourceBlueprintId);
    return Array.from(set);
  }, [feed, fleetFeed]);
  const { data: blueprintTitles } = useBlueprintTitles(allBlueprintIds);
  const blueprintTitleFor = (id: string | null): string | null =>
    id ? blueprintTitles?.get(id)?.title ?? null : null;

  // People-lens secondary filter: a category (all / direct-follow /
  // blueprint-sourced) or a single followed person (`person:<id>`).
  const [peopleFilter, setPeopleFilter] = useState<string>('all');
  // Groups-lens picker: tapping the group card reveals the switch list.
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  const peopleCategoryChips: WatchFilterChip[] = useMemo(
    () => [
      { id: 'all', label: 'All' },
      { id: 'following', label: 'Following' },
      { id: 'blueprint', label: 'From blueprints' },
    ],
    [],
  );

  // Person chips are derived from who actually appears in the feed, so
  // selecting one always yields rows. Avatar styling comes from the
  // followed-people list when available.
  const peoplePersonChips: WatchFilterChip[] = useMemo(() => {
    const seen = new Map<string, WatchFilterChip>();
    for (const item of feed) {
      if (!item.personId || seen.has(item.personId)) continue;
      const fp = followedPeople.find((p) => p.userId === item.personId);
      const firstName = (fp?.displayName ?? item.personName ?? '').trim().split(/\s+/)[0] || 'Person';
      seen.set(item.personId, {
        id: `person:${item.personId}`,
        label: firstName,
        avatar: {
          text: fp?.avatarEmoji || fp?.initials || item.personInitial || '?',
          color: fp?.avatarColor || '#3F6FA8',
        },
      });
    }
    return Array.from(seen.values());
  }, [feed, followedPeople]);

  const filteredFeed = useMemo(() => {
    if (peopleFilter === 'all') return feed;
    if (peopleFilter === 'following') return feed.filter((i) => !i.sourceBlueprintId);
    if (peopleFilter === 'blueprint') return feed.filter((i) => Boolean(i.sourceBlueprintId));
    if (peopleFilter.startsWith('person:')) {
      const pid = peopleFilter.slice('person:'.length);
      return feed.filter((i) => i.personId === pid);
    }
    return feed;
  }, [feed, peopleFilter]);

  const hasFeed = feed.length > 0;
  const hasCohort = cohortStream.length > 0;

  return (
    <View style={styles.container}>
      {findPeopleOpen ? (
        <DiscoverPeopleContent
          toolbarOffset={toolbarHeight + 48}
          followedIds={followedIds}
          onToggleFollow={onToggleFollow}
        />
      ) : (
      <ScrollView
        style={styles.body}
        contentContainerStyle={{
          paddingTop: toolbarHeight + IOS_SPACING.md,
          paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {grouping === 'all' ? (
          <WatchFollowingLine
            count={followingCount}
            people={followedPeople}
            onPress={() => router.push('/discover/following' as never)}
          />
        ) : null}

        <View style={styles.lensRow}>
          {LENS_OPTIONS.map((opt) => {
            const active = opt.id === grouping;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setGrouping(opt.id)}
                style={[styles.lensSeg, active && styles.lensSegActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.lensSegText, active && styles.lensSegTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {grouping === 'all' ? (
          <>
            {hasFeed ? (
              <View style={styles.section}>
                <WatchFilterRow
                  categories={peopleCategoryChips}
                  entities={peoplePersonChips}
                  selectedId={peopleFilter}
                  onSelect={setPeopleFilter}
                />
                <Text style={styles.sectionEyebrow}>Latest from your people</Text>
                {filteredFeed.length > 0 ? (
                  <View style={styles.feed}>
                    {filteredFeed.map((item) => (
                      <WatchCard
                        key={item.id}
                        item={item}
                        blueprintTitle={blueprintTitleFor(item.sourceBlueprintId)}
                        fallbackInterestId={currentInterest?.id ?? null}
                        relationshipLabel="you follow"
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyCopy}>
                    No steps match this filter yet.
                  </Text>
                )}
              </View>
            ) : null}

            {hasCohort ? (
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>From your cohorts</Text>
                <View style={styles.feed}>
                  {cohortStream.map((item) => (
                    <CohortStreamCard key={item.id} item={item} />
                  ))}
                </View>
              </View>
            ) : null}

            {!hasFeed && !hasCohort ? (
              isLoading ? (
                <Text style={styles.emptyCopy}>Loading…</Text>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="people-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
                  <Text style={styles.emptyTitle}>Nothing to watch yet</Text>
                  <Text style={styles.emptyCopy}>
                    Follow people and their step activity will appear here.
                  </Text>
                  <Pressable
                    style={styles.emptyAction}
                    onPress={() => setFindPeopleOpen(true)}
                  >
                    <Text style={styles.emptyActionText}>Find people to follow</Text>
                  </Pressable>
                </View>
              )
            ) : null}
          </>
        ) : grouping === 'location' ? (
          <WatchNearbySection
            homeVenueLat={homeVenue?.lat ?? null}
            homeVenueLng={homeVenue?.lng ?? null}
            homeVenueLabel={homeVenue?.venue ?? homeVenue?.region ?? null}
            interestSlug={currentInterest?.slug ?? null}
          />
        ) : activeFleets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="boat-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
            <Text style={styles.emptyTitle}>You&apos;re not in a group yet</Text>
            <Text style={styles.emptyCopy}>
              Join or create a group and your groupmates&apos; step activity will appear
              here.
            </Text>
            <Pressable
              style={styles.emptyAction}
              onPress={() => router.push('/(tabs)/fleet' as never)}
            >
              <Text style={styles.emptyActionText}>Go to groups</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <GroupPickerCard
              fleets={activeFleets}
              selectedFleetId={resolvedFleetId}
              open={groupPickerOpen}
              onToggle={() => setGroupPickerOpen((o) => !o)}
              onSelect={(id) => {
                setSelectedFleetId(id);
                setGroupPickerOpen(false);
              }}
              onOpenGroup={() => router.push('/(tabs)/fleet' as never)}
            />
            <Text style={styles.sectionEyebrow}>
              From {activeFleets.find((f) => f.fleet.id === resolvedFleetId)?.fleet.name ?? 'your group'}
            </Text>
            {fleetLoading ? (
              <Text style={styles.emptyCopy}>Loading…</Text>
            ) : fleetFeed.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
                <Text style={styles.emptyTitle}>No group activity yet</Text>
                <Text style={styles.emptyCopy}>
                  When your groupmates plan, do, and reflect on steps, you&apos;ll see them
                  here.
                </Text>
              </View>
            ) : (
              <View style={styles.feed}>
                {fleetFeed.map((item) => (
                  <WatchCard
                    key={item.id}
                    item={item}
                    blueprintTitle={blueprintTitleFor(item.sourceBlueprintId)}
                    fallbackInterestId={currentInterest?.id ?? null}
                    relationshipLabel="groupmate"
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      )}

      <TabScreenToolbar
        subtitleContent={
          homeVenue && isSailingInterest(currentInterest?.slug) ? (
            <LocationAnchor
              region={homeVenue.region}
              venue={homeVenue.venue}
              onPress={() => setLocationPickerOpen(true)}
            />
          ) : undefined
        }
        topInset={insets.top}
        backgroundColor="rgba(242, 242, 247, 0.94)"
        onMeasuredHeight={setToolbarHeight}
        actions={
          findPeopleOpen
            ? undefined
            : [
                {
                  icon: 'person-add-outline',
                  sfSymbol: 'person.badge.plus',
                  label: 'Find people to follow',
                  onPress: () => setFindPeopleOpen(true),
                },
              ]
        }
      />

      {/* Focused people-discovery surface owns its own scroll, so the
          back-to-feed affordance floats below the toolbar (mirrors the
          Library full-bleed zones). */}
      {findPeopleOpen ? (
        <View
          style={[styles.floatingBackHeader, { top: toolbarHeight + 4 }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.floatingBackPill}
            onPress={() => setFindPeopleOpen(false)}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={16} color={IOS_COLORS.systemBlue} />
            <Text style={styles.floatingBackPillText}>Watch</Text>
          </Pressable>
        </View>
      ) : null}

      <HomeVenuePickerSheet
        visible={locationPickerOpen}
        onDismiss={() => setLocationPickerOpen(false)}
      />
    </View>
  );
}

function WatchFollowingLine({
  count,
  people,
  onPress,
}: {
  count: number;
  people: FollowedPersonRow[];
  onPress: () => void;
}) {
  const stack = people.slice(0, 3);
  const overflow = count - stack.length;
  return (
    <Pressable
      style={styles.followingLine}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Manage who you follow, ${count} ${count === 1 ? 'person' : 'people'}`}
    >
      {stack.length > 0 ? (
        <View style={styles.followStack}>
          {stack.map((p, i) => (
            <View
              key={p.userId}
              style={[
                styles.followStackAvatar,
                { backgroundColor: p.avatarColor || '#3F6FA8', marginLeft: i === 0 ? 0 : -8 },
              ]}
            >
              <Text style={styles.followStackInitial}>
                {p.avatarEmoji || p.initials}
              </Text>
            </View>
          ))}
          {overflow > 0 ? (
            <View style={[styles.followStackAvatar, styles.followStackMore]}>
              <Text style={styles.followStackInitial}>+{overflow}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.followStackEmpty}>
          <Ionicons name="people-outline" size={18} color={IOS_COLORS.systemBlue} />
        </View>
      )}
      <View style={styles.followingLineText}>
        <Text style={styles.followingLineTitle}>
          {count > 0
            ? `${count} ${count === 1 ? 'person' : 'people'} you follow`
            : 'You don’t follow anyone yet'}
        </Text>
        <Text style={styles.followingLineSub}>
          {count > 0 ? 'Tap to manage who you watch' : 'Tap to find people to follow'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
    </Pressable>
  );
}

function groupInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

function GroupPickerCard({
  fleets,
  selectedFleetId,
  open,
  onToggle,
  onSelect,
  onOpenGroup,
}: {
  fleets: FleetMembership[];
  selectedFleetId: string | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onOpenGroup: () => void;
}) {
  const selected = fleets.find((f) => f.fleet.id === selectedFleetId) ?? fleets[0];
  const canSwitch = fleets.length > 1;
  if (!selected) return null;
  return (
    <View>
      <Pressable
        style={styles.groupPicker}
        onPress={canSwitch ? onToggle : onOpenGroup}
        accessibilityRole="button"
        accessibilityState={{ expanded: canSwitch ? open : undefined }}
      >
        <View style={styles.groupPickerAvatar}>
          <Text style={styles.groupPickerInitial}>{groupInitials(selected.fleet.name)}</Text>
        </View>
        <View style={styles.groupPickerText}>
          <Text style={styles.groupPickerName} numberOfLines={1}>
            {selected.fleet.name}
          </Text>
          <Text style={styles.groupPickerSub}>
            {canSwitch ? 'Switch group' : 'Open group'}
          </Text>
        </View>
        <Ionicons
          name={canSwitch ? (open ? 'chevron-up' : 'chevron-down') : 'chevron-forward'}
          size={16}
          color={IOS_COLORS.tertiaryLabel}
        />
      </Pressable>
      {open && canSwitch ? (
        <WatchFilterRow
          categories={fleets.map((f) => ({ id: f.fleet.id, label: f.fleet.name }))}
          selectedId={selectedFleetId ?? ''}
          onSelect={onSelect}
        />
      ) : null}
    </View>
  );
}

function CohortStreamCard({ item }: { item: CohortStreamItem }) {
  const context = [item.blueprintTitle, item.stepTitle]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(' · ');
  const handlePress = () => {
    // Prefer routing to the viewer's own forked step (their Discuss
    // tab will switch to Cohort on its own once they tap). When
    // viewer has no forked copy, we'd ideally land on a blueprint
    // preview; that surface doesn't exist yet, so this stays a no-op
    // for the v1 stream.
    if (item.viewerStepId) {
      router.push(`/step/${item.viewerStepId}?scope=cohort` as never);
    }
  };
  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <View style={styles.cardHeader}>
        <View style={styles.personMark}>
          {item.authorAvatarUrl ? (
            <Image source={{ uri: item.authorAvatarUrl }} style={styles.personAvatar} />
          ) : (
            <Text style={styles.personInitial}>{item.authorInitial}</Text>
          )}
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.personName} numberOfLines={1}>
            {item.authorName}
          </Text>
          <Text style={styles.personMeta} numberOfLines={1}>
            {`${formatRelativeTime(item.createdAt)} · cohort thread`}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: '#E5EDFF' }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={13} color="#3155B5" />
          <Text style={[styles.statusText, { color: '#3155B5' }]}>Cohort</Text>
        </View>
      </View>

      {context ? (
        <Text style={styles.stepTitle} numberOfLines={2}>
          {context}
        </Text>
      ) : null}

      <Text style={styles.bodyCopy} numberOfLines={3}>
        {item.bodyPreview}
      </Text>
    </Pressable>
  );
}

function WatchCard({
  item,
  blueprintTitle,
  fallbackInterestId,
  relationshipLabel,
}: {
  item: FollowedStepItem;
  blueprintTitle?: string | null;
  fallbackInterestId?: string | null;
  /** Viewer's relationship to the author ("you follow", "groupmate"),
   * shown in the byline. */
  relationshipLabel?: string | null;
}) {
  const statusMeta = STATUS_META[item.status];
  const adopt = useAdoptStep();
  const [adopted, setAdopted] = useState(false);
  const byline = [item.personName, relationshipLabel].filter(Boolean).join(' · ');
  // Provenance of the step: adopted from a blueprint vs an author's own step.
  // (Cohort provenance isn't carried on this feed shape yet.)
  const provenanceLabel = item.sourceBlueprintId ? 'Blueprint' : 'Step';
  const targetInterestId = item.interestId ?? fallbackInterestId ?? null;

  const openStep = () =>
    router.push(`/step/${item.id}?readOnly=true&origin=watch` as never);

  const handleAdopt = () => {
    if (adopted || adopt.isPending || !targetInterestId) return;
    adopt.mutate(
      { sourceStepId: item.id, interestId: targetInterestId },
      { onSuccess: () => setAdopted(true) },
    );
  };

  return (
    <View style={styles.wcard}>
      <View style={[styles.wcardSpine, { backgroundColor: statusMeta.color }]} />
      <View style={styles.wcardInner}>
        <Pressable onPress={openStep} accessibilityRole="button">
          <View style={styles.wcardCrown}>
            <View style={[styles.stateChip, { backgroundColor: statusMeta.background }]}>
              <View style={[styles.stateDot, { backgroundColor: statusMeta.color }]} />
              <Text style={[styles.stateChipText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
            <Text style={styles.wcardAgo}>{formatRelativeTime(item.updatedAt)}</Text>
          </View>

          <Text style={styles.wStepTitle} numberOfLines={2}>
            {item.stepTitle}
          </Text>

          <View style={styles.wByline}>
            <Pressable
              style={styles.wBylineAvatar}
              onPress={() => router.push(`/profile/${item.personId}` as never)}
              hitSlop={6}
            >
              {item.personAvatarUrl ? (
                <Image source={{ uri: item.personAvatarUrl }} style={styles.wBylineAvatarImg} />
              ) : (
                <Text style={styles.wBylineInitial}>{item.personInitial}</Text>
              )}
            </Pressable>
            <Text style={styles.wBylineText} numberOfLines={1}>
              {byline}
            </Text>
            <View style={styles.provChip}>
              <Text style={styles.provChipText}>{provenanceLabel}</Text>
            </View>
          </View>

          {item.locationName || blueprintTitle ? (
            <View style={styles.metaWrap}>
              {blueprintTitle ? (
                <View style={styles.metaPill}>
                  <Ionicons name="documents-outline" size={13} color={IOS_COLORS.secondaryLabel} />
                  <Text style={styles.metaPillText} numberOfLines={1}>
                    {blueprintTitle}
                  </Text>
                </View>
              ) : null}
              {item.locationName ? (
                <View style={styles.metaPill}>
                  <Ionicons name="location-outline" size={13} color={IOS_COLORS.secondaryLabel} />
                  <Text style={styles.metaPillText} numberOfLines={1}>
                    {item.locationName}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {item.description ? (
            <Text style={styles.bodyCopy} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </Pressable>

        <View style={styles.wFoot}>
          <Pressable
            style={[styles.adaptBtn, adopted && styles.adaptBtnDone]}
            onPress={handleAdopt}
            disabled={adopted || adopt.isPending || !targetInterestId}
            accessibilityRole="button"
            accessibilityLabel={adopted ? 'Added to your practice' : 'Adapt this step to your practice'}
          >
            <Ionicons
              name={adopted ? 'checkmark-circle' : 'add-circle-outline'}
              size={16}
              color={adopted ? '#1B9E4B' : IOS_COLORS.systemBlue}
            />
            <Text style={[styles.adaptBtnText, adopted && styles.adaptBtnTextDone]}>
              {adopted
                ? 'Added to your practice'
                : adopt.isPending
                  ? 'Adding…'
                  : 'Adapt to my practice'}
            </Text>
          </Pressable>
          <Pressable style={styles.peekBtn} onPress={openStep} hitSlop={6}>
            <Ionicons name="arrow-forward" size={15} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  body: {
    flex: 1,
  },
  followingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.md,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
  },
  followStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  followStackAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  followStackMore: {
    backgroundColor: '#8A8A8E',
    marginLeft: -8,
  },
  followStackInitial: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  followStackEmpty: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EEF9',
  },
  followingLineText: {
    flex: 1,
    gap: 1,
  },
  followingLineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  followingLineSub: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
  },
  groupPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginHorizontal: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.md,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
  },
  groupPickerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2BA98E',
  },
  groupPickerInitial: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  groupPickerText: {
    flex: 1,
    gap: 1,
  },
  groupPickerName: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  groupPickerSub: {
    fontSize: 11,
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
  lensRow: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    marginHorizontal: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.md,
    borderRadius: 11,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  lensSeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 9,
  },
  lensSegActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  lensSegText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  lensSegTextActive: {
    color: IOS_COLORS.label,
  },
  feed: {
    gap: 12,
    paddingHorizontal: IOS_SPACING.lg,
  },
  section: {
    marginBottom: IOS_SPACING.lg,
  },
  sectionEyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
    marginBottom: 8,
  },
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EEF9',
    overflow: 'hidden',
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  personInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: IOS_COLORS.systemBlue,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  personMeta: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  metaPillText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  bodyCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  // Step-led Watch card (verb-state spine, step headline, byline, Adapt).
  wcard: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    overflow: 'hidden',
  },
  wcardSpine: {
    width: 4,
  },
  wcardInner: {
    flex: 1,
    padding: 14,
    gap: 9,
  },
  wcardCrown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateChipText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  wcardAgo: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    color: IOS_COLORS.tertiaryLabel,
  },
  wStepTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: IOS_COLORS.label,
  },
  wByline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  wBylineAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EEF9',
    overflow: 'hidden',
  },
  wBylineAvatarImg: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  wBylineInitial: {
    fontSize: 9,
    fontWeight: '800',
    color: IOS_COLORS.systemBlue,
  },
  wBylineText: {
    flex: 1,
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  provChip: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  provChipText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
  wFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.12)',
  },
  adaptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(0,122,255,0.10)',
  },
  adaptBtnDone: {
    backgroundColor: 'rgba(52,199,89,0.12)',
  },
  adaptBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  adaptBtnTextDone: {
    color: '#1B9E4B',
  },
  peekBtn: {
    width: 36,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(118,118,128,0.10)',
  },
  emptyCard: {
    marginHorizontal: IOS_SPACING.lg,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  emptyAction: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  floatingBackHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  floatingBackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 242, 247, 0.94)',
  },
  floatingBackPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
});
