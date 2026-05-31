import React, { useState } from 'react';
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
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { useUserHomeVenue, isSailingInterest } from '@/hooks/useUserHomeVenue';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
  useFollowedStepsFeed,
  type FollowedStepItem,
  type FollowedStepStatus,
} from '@/hooks/useFollowedStepsFeed';
import { useCohortStream, type CohortStreamItem } from '@/hooks/useCohortStream';
import { useFollowedPeopleForLibrary } from '@/hooks/useFollowedPeopleForLibrary';
import { WatchNearbySection } from '@/components/watch/WatchNearbySection';
import { DiscoverPeopleContent } from '@/components/discover/DiscoverPeopleContent';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

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

// Grouping options. Only 'all' is wired in v1; the rest render as
// disabled chips so the surface signals the planned shape.
type GroupingId = 'all' | 'fleet' | 'blueprint' | 'location';

const GROUPING_CHIPS: { id: GroupingId; label: string; ready: boolean }[] = [
  { id: 'all', label: 'Following', ready: true },
  { id: 'location', label: 'Nearby', ready: true },
  { id: 'fleet', label: 'By group', ready: false },
  { id: 'blueprint', label: 'By blueprint', ready: false },
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
  // People discovery (find new people to follow) was folded out of the
  // Discover tab into Watch — it opens as a focused full-bleed surface
  // over the feed, with a floating back pill (mirrors the Library zones).
  const [findPeopleOpen, setFindPeopleOpen] = useState(false);
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
  const { data: cohortStream = [] } = useCohortStream(currentInterest?.id);
  const { data: followedPeople = [] } = useFollowedPeopleForLibrary();
  const followingCount = followedPeople.length;

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
        <View style={styles.introCard}>
          <Text style={styles.eyebrow}>People you follow</Text>
          <Text style={styles.introTitle}>Watch</Text>
          <Text style={styles.introCopy}>
            See the steps your people are planning, doing, and reflecting on.
            Adapt anything useful into your own practice.
          </Text>
          <Pressable
            style={styles.followingLink}
            onPress={() => router.push('/discover/following' as never)}
            accessibilityRole="button"
            accessibilityLabel={`View who you follow, ${followingCount} ${followingCount === 1 ? 'person' : 'people'}`}
          >
            <Ionicons name="people-outline" size={16} color={IOS_COLORS.systemBlue} />
            <Text style={styles.followingLinkText}>Following</Text>
            <Text style={styles.followingCount}>{followingCount}</Text>
            <Ionicons name="chevron-forward" size={15} color={IOS_COLORS.tertiaryLabel} />
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {GROUPING_CHIPS.map((chip) => {
            const active = chip.id === grouping;
            const disabled = !chip.ready;
            return (
              <Pressable
                key={chip.id}
                onPress={() => {
                  if (!disabled) setGrouping(chip.id);
                }}
                style={[
                  styles.filterChip,
                  active && styles.filterChipActive,
                  disabled && styles.filterChipDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                    disabled && styles.filterChipTextDisabled,
                  ]}
                >
                  {chip.label}
                </Text>
                {disabled ? (
                  <Text style={styles.filterChipSoon}>soon</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

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

        {grouping === 'location' ? (
          <WatchNearbySection
            homeVenueLat={homeVenue?.lat ?? null}
            homeVenueLng={homeVenue?.lng ?? null}
            homeVenueLabel={homeVenue?.venue ?? homeVenue?.region ?? null}
            interestSlug={currentInterest?.slug ?? null}
          />
        ) : isLoading ? (
          <Text style={styles.emptyCopy}>Loading…</Text>
        ) : !hasFeed ? (
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
        ) : (
          <View style={styles.feed}>
            {feed.map((item) => (
              <WatchCard key={item.id} item={item} />
            ))}
          </View>
        )}
      </ScrollView>
      )}

      <TabScreenToolbar
        subtitleContent={
          homeVenue && isSailingInterest(currentInterest?.slug) ? (
            <LocationAnchor region={homeVenue.region} venue={homeVenue.venue} />
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

function WatchCard({ item }: { item: FollowedStepItem }) {
  const statusMeta = STATUS_META[item.status];
  const subtitle = [
    item.organizationName,
    formatRelativeTime(item.updatedAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/step/${item.id}` as never)}
    >
      <View style={styles.cardHeader}>
        <Pressable
          style={styles.personMark}
          onPress={() => router.push(`/sailor/${item.personId}` as never)}
          hitSlop={6}
        >
          {item.personAvatarUrl ? (
            <Image source={{ uri: item.personAvatarUrl }} style={styles.personAvatar} />
          ) : (
            <Text style={styles.personInitial}>{item.personInitial}</Text>
          )}
        </Pressable>
        <View style={styles.cardHeaderText}>
          <Text style={styles.personName} numberOfLines={1}>
            {item.personName}
          </Text>
          {subtitle ? (
            <Text style={styles.personMeta} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusMeta.background }]}>
          <Ionicons name={statusMeta.icon} size={13} color={statusMeta.color} />
          <Text style={[styles.statusText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      <Text style={styles.stepTitle} numberOfLines={2}>
        {item.stepTitle}
      </Text>

      {item.locationName ? (
        <View style={styles.metaWrap}>
          <View style={styles.metaPill}>
            <Ionicons name="location-outline" size={13} color={IOS_COLORS.secondaryLabel} />
            <Text style={styles.metaPillText} numberOfLines={1}>
              {item.locationName}
            </Text>
          </View>
        </View>
      ) : null}

      {item.description ? (
        <Text style={styles.bodyCopy} numberOfLines={3}>
          {item.description}
        </Text>
      ) : null}
    </Pressable>
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
  introCard: {
    marginHorizontal: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.md,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: IOS_COLORS.systemBlue,
  },
  introTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  introCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  followingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.12)',
  },
  followingLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  followingCount: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  filterChipActive: {
    backgroundColor: '#DCEAFE',
  },
  filterChipDisabled: {
    opacity: 0.55,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  filterChipTextActive: {
    color: IOS_COLORS.systemBlue,
  },
  filterChipTextDisabled: {
    color: IOS_COLORS.tertiaryLabel,
  },
  filterChipSoon: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
  },
  feed: {
    gap: 12,
    paddingHorizontal: IOS_SPACING.lg,
  },
  section: {
    marginBottom: IOS_SPACING.lg,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
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
