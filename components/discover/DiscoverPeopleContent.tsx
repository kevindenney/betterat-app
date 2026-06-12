/**
 * DiscoverPeopleContent — People surface of the canonical Discover trio
 *
 * Pass 11 (docs/redesign/ios-register/discover-pass-11-brief.md):
 *
 *   - 44px full-round avatar with initials, 16px name, 13px context line.
 *   - No "Following" chip on the list view — following is a tap-deeper
 *     decision, not a list-row state. The Following chip stays on the
 *     Person detail page where the user actually toggles it.
 *   - No follower counts — engagement-metric named-absence rule. Peer
 *     signals (mutuals, similarity reason) stay; the metric goes.
 *   - The "Network browsing" promo entry card is gone — the whole surface
 *     is browsing; the card was redundant chrome on top of the chrome.
 *   - Followed and undiscovered peers mix in one list (canonical position:
 *     no section split).
 *   - Search moves to a quiet pill at the foot, after the list.
 *
 * Both the sailing live path (Supabase + `useSailorSuggestions`) and the
 * non-sailing demo path (from `connectDemoData`) render through the same
 * canonical cell.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

import { useSailorSuggestions } from '@/hooks/useSailorSuggestions';
import { useInterest } from '@/providers/InterestProvider';
import { getConnectDemoData } from '@/configs/connectDemoData';
import type { DemoPeer } from '@/configs/connectDemoData';
import { triggerHaptic } from '@/lib/haptics';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { SailorSuggestion } from '@/components/search/SailorSuggestionCard';
import {
  CanonicalList,
  CanonicalListEyebrow,
  CanonicalPersonRow,
  initialsForName,
  pickAvatarMarkColor,
  type PersonTag,
} from '@/components/discover/canonical';
import { DiscoverEmptyState } from '@/components/discover/DiscoverEmptyState';

// =============================================================================
// PROPS
// =============================================================================

interface DiscoverPeopleContentProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  followedIds: Set<string>;
  onToggleFollow: (id: string) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DiscoverPeopleContent({
  toolbarOffset,
  onScroll,
  followedIds,
  onToggleFollow,
}: DiscoverPeopleContentProps) {
  const { currentInterest } = useInterest();
  const rawSlug = currentInterest?.slug ?? 'sail-racing';
  const interestName = currentInterest?.name;
  const isSailingInterest = rawSlug === 'sail-racing';

  const demoData = useMemo(() => getConnectDemoData(rawSlug), [rawSlug]);

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  if (isSailingInterest) {
    return (
      <LivePath
        toolbarOffset={toolbarOffset}
        onScroll={onScroll}
        interestName={interestName}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
      />
    );
  }

  if (demoData) {
    return (
      <DemoPath
        toolbarOffset={toolbarOffset}
        onScroll={onScroll}
        peers={demoData.peers}
        interestName={interestName}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
        followedIds={followedIds}
        onToggleFollow={onToggleFollow}
      />
    );
  }

  // Non-sailing interest with no seeded demo community — show the honest
  // "you're early" state rather than leaking sailing's live suggestions
  // (which carry race counts and "Sailor in your community" descriptors).
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarOffset }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <DiscoverEmptyState
          icon="people-outline"
          title="Nobody here yet"
          body={`You're early in ${interestName ?? 'this register'}. Join an org or invite peers to start building your network.`}
        />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// DEMO PATH (non-sailing interests) — wired to connectDemoData
// =============================================================================

interface DemoPathProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  peers: DemoPeer[];
  interestName?: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchInputRef: React.RefObject<TextInput>;
  followedIds: Set<string>;
  onToggleFollow: (id: string) => void;
}

function DemoPath({
  toolbarOffset,
  onScroll,
  peers,
  interestName,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  followedIds: _followedIds,
  onToggleFollow: _onToggleFollow,
}: DemoPathProps) {
  const router = useRouter();
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return peers;
    const needle = searchQuery.toLowerCase();
    return peers.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.subtitle.toLowerCase().includes(needle)
    );
  }, [peers, searchQuery]);

  const eyebrow = searchQuery
    ? { plain: 'Search · ', em: `${filtered.length} ${filtered.length === 1 ? 'person' : 'people'}` }
    : interestName
      ? { plain: 'Other ', em: interestName, tail: ' practitioners' }
      : { plain: 'People in your register', em: '' };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarOffset }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search leads the surface — the foot placement read as "no search
            exists" in user testing (feedback_cta_on_visible_element_not_buried). */}
        <SearchField
          ref={searchInputRef}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {filtered.length > 0 ? (
          <>
            <CanonicalListEyebrow {...eyebrow} />
            <CanonicalList>
              {filtered.map((peer, idx) => {
                // Pass 11 — no Following chip on list view. Suggested stays as
                // the system-recommendation signal for not-yet-followed peers.
                const tag: PersonTag | undefined = { kind: 'weak', label: 'Suggested' };
                return (
                  <CanonicalPersonRow
                    key={peer.id}
                    first={idx === 0}
                    initials={peer.avatarInitials || initialsForName(peer.name)}
                    markColor={peer.avatarColor || pickAvatarMarkColor(peer.id)}
                    name={peer.name}
                    descriptor={
                      peer.stat ? `${peer.subtitle} · ${peer.stat}` : peer.subtitle
                    }
                    tag={tag}
                    onPress={() => {
                      triggerHaptic('selection');
                      const initials = peer.avatarInitials || initialsForName(peer.name);
                      const sub = peer.stat ? `${peer.subtitle} · ${peer.stat}` : peer.subtitle;
                      router.push(
                        `/discover/person/${peer.id}?from=people&name=${encodeURIComponent(peer.name)}&sub=${encodeURIComponent(sub)}&initials=${encodeURIComponent(initials)}` as any,
                      );
                    }}
                  />
                );
              })}
            </CanonicalList>
          </>
        ) : (
          <EmptyState
            label={searchQuery ? `No people match “${searchQuery}” yet.` : 'No people available.'}
          />
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// LIVE PATH (sailing) — wired to useSailorSuggestions
// =============================================================================

interface LivePathProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  interestName?: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchInputRef: React.RefObject<TextInput>;
}

function LivePath({
  toolbarOffset,
  onScroll,
  interestName,
  searchQuery,
  setSearchQuery,
  searchInputRef,
}: LivePathProps) {
  const router = useRouter();
  const { suggestions, isLoading, toggleFollow, followedIds } =
    useSailorSuggestions(searchQuery);

  const handlePersonPress = useCallback(
    (userId: string) => {
      router.push(`/discover/person/${userId}?from=people` as any);
    },
    [router]
  );

  const handleToggleFollow = useCallback(
    async (userId: string) => {
      triggerHaptic('selection');
      await toggleFollow(userId);
    },
    [toggleFollow]
  );

  // Pass 11 — no "Following" chip on the list view. Surface peer-overlap
  // signals (mutuals, similarity reason) only; following is a tap-deeper
  // decision that lives on the Person detail page.
  const tagFor = useCallback(
    (sailor: SailorSuggestion): PersonTag => {
      if (sailor.mutualConnections && sailor.mutualConnections > 0) {
        return {
          kind: 'mine',
          label:
            sailor.mutualConnections === 1
              ? '1 mutual'
              : `${sailor.mutualConnections} mutuals`,
          icon: 'swap-horizontal',
        };
      }
      const reason = sailor.similarityReason?.trim();
      if (reason) {
        // Heuristic: short reasons go in weak tag; long ones become the
        // descriptor line below, with a generic "Suggested" weak tag.
        if (reason.length <= 22) return { kind: 'weak', label: reason };
        return { kind: 'weak', label: 'Suggested' };
      }
      return { kind: 'weak', label: 'Suggested' };
    },
    []
  );

  const eyebrow = searchQuery
    ? { plain: 'Search · ', em: `${suggestions.length} ${suggestions.length === 1 ? 'person' : 'people'}` }
    : interestName
      ? { plain: 'Other ', em: interestName, tail: ' practitioners' }
      : { plain: 'People in your register', em: '' };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarOffset }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search leads the surface — the foot placement read as "no search
            exists" in user testing (feedback_cta_on_visible_element_not_buried). */}
        <SearchField
          ref={searchInputRef}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
          </View>
        ) : suggestions.length > 0 ? (
          <>
            <CanonicalListEyebrow {...eyebrow} />
            <CanonicalList>
              {suggestions.map((sailor, idx) => {
                const initials = initialsForName(sailor.fullName);
                const markColor =
                  sailor.avatarColor ?? pickAvatarMarkColor(sailor.userId);
                const tag = tagFor(sailor);
                const reason = sailor.similarityReason?.trim();
                const mutuals = sailor.mutualConnections ?? 0;
                const longReason = reason && reason.length > 22 ? reason : undefined;
                const descriptorParts: string[] = [];
                if (mutuals > 0) {
                  descriptorParts.push(
                    `${mutuals} mutual${mutuals === 1 ? '' : 's'}`
                  );
                }
                // Pass 11 — followerCount dropped from descriptor (engagement-
                // metric named-absence rule).
                if (longReason && descriptorParts.length === 0) {
                  descriptorParts.push(longReason);
                }
                if (descriptorParts.length === 0) {
                  descriptorParts.push('Sailor in your community');
                }
                return (
                  <CanonicalPersonRow
                    key={sailor.userId}
                    first={idx === 0}
                    initials={initials}
                    markColor={markColor}
                    name={sailor.fullName}
                    descriptor={descriptorParts.join(' · ')}
                    tag={tag}
                    onPress={() => handlePersonPress(sailor.userId)}
                  />
                );
              })}
            </CanonicalList>
            {/* Inline tap-to-toggle-follow row beneath each cell isn't part of
                the canonical (the tap target opens the Person detail); follow
                stays a one-tap-deeper interaction. Surfaced here as a quiet
                strip when the user has no follows yet so onboarding still
                has a clear next step. */}
            {followedIds.size === 0 && suggestions.length > 0 && (
              <View style={styles.followHint}>
                <Ionicons
                  name="information-circle"
                  size={14}
                  color={IOS_REGISTER.labelSecondary}
                />
                <Text style={styles.followHintText} onPress={() => handleToggleFollow(suggestions[0].userId)}>
                  Tap a sailor to open their profile and follow.
                </Text>
              </View>
            )}
          </>
        ) : (
          <EmptyState
            label={
              searchQuery
                ? `No people match “${searchQuery}” yet.`
                : 'No suggestions yet. Join a fleet or club to see people in your community.'
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

const SearchField = React.forwardRef<
  TextInput,
  { value: string; onChangeText: (v: string) => void }
>(function SearchField({ value, onChangeText }, ref) {
  return (
    <View style={styles.searchOuter}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={IOS_REGISTER.labelSecondary} />
        <TextInput
          ref={ref}
          style={styles.searchInput}
          placeholder="Find people"
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
});

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={36} color={IOS_REGISTER.labelTertiary} />
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

  followHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  followHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.labelSecondary,
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
