/**
 * DiscussContent — Forums surface of the canonical Discover trio
 *
 * Pass 11 (docs/redesign/ios-register/discover-pass-11-brief.md):
 *
 *   - 44px square topic glyph mark on a tinted ground (the unit is a topic,
 *     not a person).
 *   - Name + broader-interest descriptor. Thread-count and active-time
 *     badges are gone — engagement-metric named-absence rule. The downstream
 *     Topic detail surface is where threads live.
 *   - No "Following" chip on the list view — following is a tap-deeper
 *     decision, not a list-row state. The Following chip stays on the Topic
 *     detail page where the user actually toggles it.
 *   - Joined + undiscovered mix in one list (canonical position: no section
 *     split).
 *   - Search moves to a quiet pill at the foot, after the list.
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
import { getConnectDemoData } from '@/configs/connectDemoData';
import type { DemoCommunity, InterestConnectData } from '@/configs/connectDemoData';
import {
  CanonicalForumRow,
  CanonicalList,
  CanonicalListEyebrow,
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
      />
    );
  }

  return (
    <LivePath
      toolbarOffset={toolbarOffset}
      onScroll={onScroll}
      interestName={interestName}
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
}

function DemoPath({
  toolbarOffset,
  onScroll,
  demoData,
  joinedIds,
  onToggleJoin: _onToggleJoin,
  interestName,
}: DemoPathProps) {
  const router = useRouter();
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
        {ordered.length > 0 ? (
          <>
            <CanonicalListEyebrow {...eyebrow} />
            <CanonicalList>
              {ordered.map((community, idx) => (
                <CanonicalForumRow
                  key={community.id}
                  first={idx === 0}
                  glyph={glyphForDemoCommunity(community)}
                  name={community.name}
                  descriptor={community.description.split('.')[0]}
                  onPress={() =>
                    router.push(
                      `/discover/topic/${community.id}?from=forums&name=${encodeURIComponent(community.name)}` as any,
                    )
                  }
                />
              ))}
            </CanonicalList>
          </>
        ) : (
          <EmptyState
            label={searchQuery ? `No topics match “${searchQuery}” yet.` : 'No topics available.'}
          />
        )}

        {/* Pass 11 — search moves to a quiet pill at the foot. */}
        <SearchField value={searchQuery} onChangeText={setSearchQuery} />
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
}

function LivePath({ toolbarOffset, onScroll, interestName }: LivePathProps) {
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
      router.push(`/discover/topic/${community.slug}?from=forums` as any);
    },
    [router]
  );

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
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
          </View>
        ) : ordered.length > 0 ? (
          <>
            <CanonicalListEyebrow {...eyebrow} />
            <CanonicalList>
              {ordered.map((community, idx) => {
                const descriptorParts: string[] = [];
                if (community.category_name) descriptorParts.push(community.category_name);
                descriptorParts.push(
                  `${community.member_count.toLocaleString()} sailors`
                );
                return (
                  <CanonicalForumRow
                    key={community.id}
                    first={idx === 0}
                    glyph={glyphForCommunity(community)}
                    name={community.name}
                    descriptor={descriptorParts.join(' · ')}
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

        {/* Pass 11 — search moves to a quiet pill at the foot. */}
        <SearchField value={searchQuery} onChangeText={setSearchQuery} />
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

  searchOuter: { paddingTop: 16, paddingBottom: 4 },
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
