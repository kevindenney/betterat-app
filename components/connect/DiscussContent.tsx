/**
 * DiscussContent — Forums surface of the canonical Discover trio
 *
 * Renders the canonical Forums cell from
 * `docs/redesign/ios-register/discover-trio-canonical.html`:
 *
 *   - 44px square topic glyph mark on a tinted ground (the unit is a topic,
 *     not a person)
 *   - Name, broader-interest descriptor, activity row (thread count + last
 *     activity) — the canonical's "activity meaningful for a topic, not a
 *     thread"
 *   - Joined topics carry a gray "Following" mine tag plus the 8px coral
 *     unread dot when there is new activity (the only coral on the trio's
 *     cell metadata)
 *   - Concept-matching topics carry a coral "Matches your concept" fit tag;
 *     own-club topics carry "From your club"
 *   - Joined + undiscovered mix in one list (canonical position: no section
 *     split). The downstream Topic detail surface is where threads live.
 *
 * The in-tab feed sub-segment, sort pills, post composer, and post detail
 * modal that previously lived on the Forums surface are intentionally
 * removed: per the canonical, threads live in Topic detail, not here. The
 * compose action and feed are still reachable from the per-community
 * detail screen.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

import {
  useUserCommunities,
  usePopularCommunities,
  useCommunitySearch,
} from '@/hooks/useCommunities';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

import type { Community } from '@/types/community';
import { useInterest } from '@/providers/InterestProvider';
import { useVocabulary } from '@/hooks/useVocabulary';
import { getConnectDemoData } from '@/configs/connectDemoData';
import type { DemoCommunity, InterestConnectData } from '@/configs/connectDemoData';
import {
  CanonicalForumRow,
  CanonicalList,
  CanonicalListEyebrow,
  type ForumTag,
} from '@/components/discover/canonical';

// =============================================================================
// PROPS
// =============================================================================

interface DiscussContentProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Lifted join state for non-sailing (demo) interests */
  joinedIds: Set<string>;
  onToggleJoin: (id: string) => void;
}

// =============================================================================
// GLYPH MAPPING — Community.icon_url isn't a glyph; map via category_icon when
// possible, else infer from category_name keywords, else fall back to a calm
// default. The canonical's mark glyphs are intentionally subject-shaped, not
// person-shaped.
// =============================================================================

type GlyphName = keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
const CATEGORY_KEYWORD_GLYPHS: [RegExp, GlyphName][] = [
  [/setup|rigging|tuning|gear/i, 'construct-outline'],
  [/start|tactic/i, 'flag-outline'],
  [/wind|breeze/i, 'flag-outline'],
  [/mark|rounding/i, 'reload-outline'],
  [/club|fleet/i, 'compass-outline'],
  [/safety|storm|squall|weather/i, 'thunderstorm-outline'],
  [/rule|protest/i, 'book-outline'],
  [/coach|teach|learn/i, 'school-outline'],
  [/event|race/i, 'trophy-outline'],
];

function glyphForCommunity(community: Community): GlyphName {
  const categoryIcon = (community as Community & { category_icon?: string | null })
    .category_icon as keyof typeof import('@expo/vector-icons').Ionicons.glyphMap | undefined;
  if (categoryIcon && typeof categoryIcon === 'string') {
    return categoryIcon as keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  }
  const haystack = `${community.category_name ?? ''} ${community.name}`;
  for (const [pattern, glyph] of CATEGORY_KEYWORD_GLYPHS) {
    if (pattern.test(haystack)) return glyph;
  }
  return 'people-circle-outline';
}

function glyphForDemoCommunity(community: DemoCommunity): GlyphName {
  if (community.icon) {
    return community.icon as keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  }
  return 'people-circle-outline';
}

function relativeTime(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return undefined;
  const deltaMs = Date.now() - then;
  if (deltaMs < 0) return 'Active just now';
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'Active just now';
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Active ${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Active ${weeks}w ago`;
  return 'Active a while ago';
}

function formatThreadCount(postCount: number, vocabThreads: string): string {
  return `${postCount.toLocaleString()} ${postCount === 1 ? vocabThreads.replace(/s$/, '') : vocabThreads}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DiscussContent({
  toolbarOffset,
  onScroll,
  joinedIds,
  onToggleJoin,
}: DiscussContentProps) {
  const { currentInterest } = useInterest();
  const rawSlug = currentInterest?.slug ?? 'sail-racing';
  const interestName = currentInterest?.name;
  const isSailingInterest = rawSlug === 'sail-racing';
  const { vocab } = useVocabulary();

  const demoData = useMemo(
    () => (!isSailingInterest ? getConnectDemoData(rawSlug) : null),
    [isSailingInterest, rawSlug]
  );

  if (!isSailingInterest && demoData) {
    return (
      <DemoPath
        toolbarOffset={toolbarOffset}
        onScroll={onScroll}
        demoData={demoData}
        joinedIds={joinedIds}
        onToggleJoin={onToggleJoin}
        interestName={interestName}
        vocab={vocab}
      />
    );
  }

  return (
    <LivePath
      toolbarOffset={toolbarOffset}
      onScroll={onScroll}
      interestName={interestName}
      vocab={vocab}
    />
  );
}

// =============================================================================
// DEMO PATH (non-sailing interests)
// =============================================================================

interface DemoPathProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  demoData: InterestConnectData;
  joinedIds: Set<string>;
  onToggleJoin: (id: string) => void;
  interestName?: string;
  vocab: (term: string) => string;
}

function DemoPath({
  toolbarOffset,
  onScroll,
  demoData,
  joinedIds,
  onToggleJoin,
  interestName,
  vocab,
}: DemoPathProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const list = demoData.communities;
    if (!searchQuery.trim()) return list;
    const needle = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.description.toLowerCase().includes(needle)
    );
  }, [demoData.communities, searchQuery]);

  // Mine first, then undiscovered — single mixed list per canonical
  const ordered = useMemo(() => {
    const mine: DemoCommunity[] = [];
    const others: DemoCommunity[] = [];
    for (const c of filtered) {
      (joinedIds.has(c.id) ? mine : others).push(c);
    }
    return [...mine, ...others];
  }, [filtered, joinedIds]);

  const threadsWord = vocab('thread').toLowerCase().endsWith('s')
    ? vocab('thread').toLowerCase()
    : `${vocab('thread').toLowerCase()}s`;

  const eyebrow = searchQuery
    ? { plain: 'Search · ', em: `${ordered.length} ${ordered.length === 1 ? 'topic' : 'topics'}` }
    : interestName
      ? { plain: 'Topics around ', em: interestName }
      : { plain: 'Topics in your register', em: '' };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarOffset }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <SearchField value={searchQuery} onChangeText={setSearchQuery} />

        {ordered.length > 0 ? (
          <>
            <CanonicalListEyebrow {...eyebrow} />
            <CanonicalList>
              {ordered.map((community, idx) => {
                const isFollowing = joinedIds.has(community.id);
                const tag: ForumTag | undefined = isFollowing
                  ? { kind: 'mine', label: 'Following', icon: 'checkmark' }
                  : undefined;
                return (
                  <CanonicalForumRow
                    key={community.id}
                    first={idx === 0}
                    glyph={glyphForDemoCommunity(community)}
                    name={community.name}
                    descriptor={`${community.description.split('.')[0]} · ${community.memberCount.toLocaleString()} members`}
                    activity={{
                      threads: `${community.postCount.toLocaleString()} ${community.postCount === 1 ? threadsWord.replace(/s$/, '') : threadsWord}`,
                    }}
                    tag={tag}
                    onPress={() => onToggleJoin(community.id)}
                  />
                );
              })}
            </CanonicalList>
          </>
        ) : (
          <EmptyState
            label={searchQuery ? `No topics match “${searchQuery}” yet.` : 'No topics available.'}
          />
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// LIVE PATH (sailing) — wired to community hooks
// =============================================================================

interface LivePathProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  interestName?: string;
  vocab: (term: string) => string;
}

function LivePath({ toolbarOffset, onScroll, interestName, vocab }: LivePathProps) {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const isFiltering = searchQuery.trim().length >= 2;

  const {
    data: userCommunities,
    isLoading: isLoadingUserCommunities,
    refetch: refetchUserCommunities,
  } = useUserCommunities();
  const { data: popularCommunities, isLoading: isLoadingPopular } = usePopularCommunities(20);
  const { data: searchResults, isLoading: isSearching } = useCommunitySearch(
    searchQuery,
    {},
    isFiltering
  );
  // Mine + undiscovered mixed in one list per canonical; dedupe by id.
  const ordered = useMemo(() => {
    if (isFiltering) return searchResults?.data ?? [];
    const seen = new Set<string>();
    const result: Community[] = [];
    for (const c of userCommunities?.joined ?? []) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        result.push(c);
      }
    }
    for (const c of popularCommunities ?? []) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        result.push(c);
      }
    }
    return result;
  }, [isFiltering, searchResults?.data, userCommunities?.joined, popularCommunities]);

  const isLoading = isLoadingUserCommunities || isLoadingPopular || (isFiltering && isSearching);

  const onPressCommunity = useCallback(
    (community: Community) => {
      router.push(`/community/${community.slug}`);
    },
    [router]
  );

  const threadsWord = vocab('thread').toLowerCase().endsWith('s')
    ? vocab('thread').toLowerCase()
    : `${vocab('thread').toLowerCase()}s`;

  const eyebrow = isFiltering
    ? { plain: 'Search · ', em: `${ordered.length} ${ordered.length === 1 ? 'topic' : 'topics'}` }
    : interestName
      ? { plain: 'Topics around ', em: interestName }
      : { plain: 'Topics in your register', em: '' };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarOffset }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refetchUserCommunities()}
            tintColor={IOS_COLORS.systemBlue}
          />
        }
      >
        <SearchField value={searchQuery} onChangeText={setSearchQuery} />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
          </View>
        ) : ordered.length > 0 ? (
          <>
            <CanonicalListEyebrow {...eyebrow} />
            <CanonicalList>
              {ordered.map((community, idx) => {
                const isMember = community.is_member ?? false;
                const tag: ForumTag | undefined = isMember
                  ? { kind: 'mine', label: 'Following', icon: 'checkmark' }
                  : undefined;
                const descriptorParts: string[] = [];
                if (community.category_name) descriptorParts.push(community.category_name);
                descriptorParts.push(
                  `${community.member_count.toLocaleString()} sailors`
                );
                const lastActivity = relativeTime(community.last_activity_at);
                const unread = false; // No first-class "new since last visit" signal yet
                return (
                  <CanonicalForumRow
                    key={community.id}
                    first={idx === 0}
                    glyph={glyphForCommunity(community)}
                    name={community.name}
                    descriptor={descriptorParts.join(' · ')}
                    activity={{
                      threads: formatThreadCount(community.post_count, threadsWord),
                      lastActivity,
                    }}
                    tag={tag}
                    unread={unread && isMember}
                    onPress={() => onPressCommunity(community)}
                  />
                );
              })}
            </CanonicalList>
          </>
        ) : (
          <EmptyState
            label={
              isFiltering
                ? `No topics match “${searchQuery}” yet.`
                : 'No topics in your register yet.'
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// CHROME
// =============================================================================

function SearchField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.searchOuter}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={IOS_REGISTER.labelSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Find a topic"
          placeholderTextColor={IOS_REGISTER.labelSecondary}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
    </View>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={36} color={IOS_REGISTER.labelTertiary} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  searchOuter: { paddingTop: 6, paddingBottom: 4 },
  searchBar: {
    marginHorizontal: 16,
    height: 36,
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
    paddingVertical: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {},
    }),
  },

  loadingContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
