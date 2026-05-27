/**
 * AtlasSearchSheet — search across places (clubs, marinas, sail
 * services, racing areas) and fly the map to the selected result.
 *
 * v1 scope: place search only. Peer + step search come next; both will
 * read from the same input via a segmented control.
 *
 * The sheet is dismissable (X) and renders absolute over the map.
 * Selecting a result fires onSelect with a target lng/lat the parent
 * can pipe into AtlasMapLibreCanvas's focusLocation prop.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

/**
 * Search-result discriminator. Person results don't carry lat/lng — they
 * route to a profile rather than a map fly-to, so the consumer branches
 * on `kind` to decide what to do.
 */
export type AtlasSearchResultKind =
  | 'person'
  | 'club'
  | 'marina'
  | 'sail_loft'
  | 'chandler'
  | 'rigging'
  | 'repair'
  | 'racing_area';

export interface AtlasSearchResult {
  id: string;
  kind: AtlasSearchResultKind;
  name: string;
  /** Optional sub-line (city / country / venue / "following you" / etc.). */
  detail?: string;
  /** Map coords — present for places, omitted for people. */
  lat?: number;
  lng?: number;
  /** Person userId (auth.users.id) — present for person results only. */
  userId?: string;
  /** True when the searching user already follows this person. */
  isFollowing?: boolean;
}

export interface AtlasSearchFilterChip {
  id: string;
  label: string;
  /**
   * Optional tone hint matching AtlasScreen's relationship chips ('you',
   * 'crew', 'fleet', 'following'). Maps to a colored dot when set.
   */
  tone?: 'you' | 'crew' | 'fleet' | 'following';
  active: boolean;
}

interface AtlasSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: AtlasSearchResult) => void;
  /** Optional country/region filter to scope results (e.g. 'HK'). */
  countryCode?: string;
  /**
   * Viewer's auth user id — used to fetch their follow list so people
   * results can be tagged "Following" and ranked first. Pass null/undef
   * for guest sessions; everything still works, just no follow signal.
   */
  viewerId?: string | null;
  /**
   * Relationship filter chips surfaced inside the search sheet so users
   * have a path to filters even when the standalone filter pill is
   * hidden (the pill only shows when a non-default filter is active).
   * Apple Maps does this — "Suggested / Open Now / Saved" lives in the
   * search experience, not as separate floating chrome.
   */
  filterChips?: AtlasSearchFilterChip[];
  /** Called with the new set of active chip ids when one is toggled. */
  onFilterChipsChange?: (activeIds: string[]) => void;
}

const CHIP_TONE_COLOR: Record<NonNullable<AtlasSearchFilterChip['tone']>, string> = {
  you: 'rgba(0, 122, 255, 0.95)',
  crew: 'rgba(56, 175, 122, 0.95)',
  fleet: 'rgba(231, 137, 60, 0.95)',
  following: 'rgba(124, 92, 196, 0.95)',
};

const KIND_GLYPH: Record<AtlasSearchResultKind, keyof typeof Ionicons.glyphMap> = {
  person: 'person-circle-outline',
  club: 'boat-outline',
  marina: 'water-outline',
  sail_loft: 'cut-outline',
  chandler: 'pricetag-outline',
  rigging: 'build-outline',
  repair: 'construct-outline',
  racing_area: 'flag-outline',
};

const KIND_TONE: Record<AtlasSearchResultKind, string> = {
  person: 'rgba(56, 175, 122, 0.95)',
  club: 'rgba(0, 122, 255, 0.95)',
  marina: 'rgba(0, 150, 160, 0.95)',
  sail_loft: 'rgba(124, 92, 196, 0.95)',
  chandler: 'rgba(204, 124, 36, 0.95)',
  rigging: 'rgba(204, 124, 36, 0.95)',
  repair: 'rgba(204, 124, 36, 0.95)',
  racing_area: 'rgba(231, 137, 60, 0.95)',
};

async function fetchFollowingIds(viewerId: string | null): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', viewerId);
  if (error || !data) return new Set();
  return new Set((data as { following_id: string }[]).map((r) => r.following_id));
}

async function fetchSearchResults(
  query: string,
  viewerId: string | null,
  countryCode?: string,
): Promise<AtlasSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const like = `%${trimmed}%`;

  // People first — per the four-tier model, sailors search to find each
  // other, not chandlers. Place results stay below as scaffolding.
  const [peopleRes, followingIds, clubsRes, sailingRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, username')
      .ilike('full_name', like)
      .limit(15),
    fetchFollowingIds(viewerId),
    supabase
      .from('clubs')
      .select('id, name, short_name, city, country, latitude, longitude, country_code')
      .or(`name.ilike.${like},short_name.ilike.${like}`)
      .limit(15),
    supabase
      .from('sailing_pois')
      .select('id, kind, name, short_name, city, country, latitude, longitude, country_code')
      .or(`name.ilike.${like},short_name.ilike.${like}`)
      .limit(15),
  ]);

  const out: AtlasSearchResult[] = [];

  if (!peopleRes.error && peopleRes.data) {
    for (const p of peopleRes.data as Record<string, unknown>[]) {
      const userId = String(p.id);
      // Skip self — searching for yourself in the open results is noise.
      if (viewerId && userId === viewerId) continue;
      const name = String(p.full_name ?? p.username ?? 'Sailor');
      const isFollowing = followingIds.has(userId);
      out.push({
        id: `person:${userId}`,
        kind: 'person',
        name,
        detail: isFollowing ? 'Following' : undefined,
        userId,
        isFollowing,
      });
    }
  }

  if (!clubsRes.error && clubsRes.data) {
    for (const club of clubsRes.data as Record<string, unknown>[]) {
      const lat = Number(club.latitude);
      const lng = Number(club.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (countryCode && club.country_code && club.country_code !== countryCode) continue;
      out.push({
        id: `club:${club.id}`,
        kind: 'club',
        name: String(club.short_name ?? club.name ?? 'Club'),
        detail: [club.city, club.country].filter(Boolean).join(' · ') || undefined,
        lat,
        lng,
      });
    }
  }

  if (!sailingRes.error && sailingRes.data) {
    for (const poi of sailingRes.data as Record<string, unknown>[]) {
      const lat = Number(poi.latitude);
      const lng = Number(poi.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (countryCode && poi.country_code && poi.country_code !== countryCode) continue;
      out.push({
        id: `poi:${poi.id}`,
        kind: poi.kind as AtlasSearchResultKind,
        name: String(poi.short_name ?? poi.name ?? 'Place'),
        detail: [poi.city, poi.country].filter(Boolean).join(' · ') || undefined,
        lat,
        lng,
      });
    }
  }

  // Two-level sort: section by category priority (people first, places
  // last), then prefix-match within each section so the most relevant
  // person/place leads.
  const needle = trimmed.toLowerCase();
  const sectionRank = (k: AtlasSearchResultKind): number => (k === 'person' ? 0 : 2);
  return out.sort((a, b) => {
    const section = sectionRank(a.kind) - sectionRank(b.kind);
    if (section !== 0) return section;
    // People: followed first within the people section
    if (a.kind === 'person' && b.kind === 'person') {
      if (a.isFollowing !== b.isFollowing) return a.isFollowing ? -1 : 1;
    }
    const aPrefix = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
    return aPrefix - bPrefix || a.name.localeCompare(b.name);
  });
}

export function AtlasSearchSheet({
  visible,
  onClose,
  onSelect,
  countryCode,
  viewerId,
  filterChips,
  onFilterChipsChange,
}: AtlasSearchSheetProps) {
  const toggleChip = (id: string) => {
    if (!onFilterChipsChange || !filterChips) return;
    // Mirror AtlasScreen's chip semantics: 'all' is mutually exclusive
    // with the relationship chips. Tapping 'all' clears everything else;
    // tapping a relationship chip clears 'all'.
    const wasActive = filterChips.find((c) => c.id === id)?.active ?? false;
    const next = new Set(filterChips.filter((c) => c.active).map((c) => c.id));
    if (wasActive) next.delete(id);
    else next.add(id);
    if (id === 'all') {
      onFilterChipsChange(['all']);
      return;
    }
    next.delete('all');
    const out = Array.from(next);
    onFilterChipsChange(out.length === 0 ? ['all'] : out);
  };
  const [query, setQuery] = useState('');
  // Reset input when the sheet closes — re-opening should feel fresh.
  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const trimmed = query.trim();
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['atlas-search', trimmed, countryCode ?? 'all', viewerId ?? 'guest'],
    queryFn: () => fetchSearchResults(trimmed, viewerId ?? null, countryCode),
    enabled: visible && trimmed.length >= 2,
    staleTime: 30 * 1000,
  });

  const showEmptyHint = visible && trimmed.length < 2;
  const showNoMatches =
    visible && trimmed.length >= 2 && !isFetching && results.length === 0;
  const containerStyle = useMemo(
    () => [styles.container, !visible && styles.hidden],
    [visible],
  );

  return (
    <View style={containerStyle} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.header}>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={16} color="rgba(60, 60, 67, 0.55)" />
          <TextInput
            style={styles.input}
            placeholder="Search people, places…"
            placeholderTextColor="rgba(60, 60, 67, 0.45)"
            value={query}
            onChangeText={setQuery}
            autoFocus={visible}
            autoCorrect={false}
            returnKeyType="search"
          />
          {isFetching ? (
            <ActivityIndicator size="small" color="rgba(60, 60, 67, 0.55)" />
          ) : null}
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Cancel</Text>
        </Pressable>
      </View>
      {filterChips && filterChips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
        >
          {filterChips.map((chip) => {
            const toneColor = chip.tone ? CHIP_TONE_COLOR[chip.tone] : null;
            return (
              <Pressable
                key={chip.id}
                style={[styles.chip, chip.active && styles.chipActive]}
                onPress={() => toggleChip(chip.id)}
                hitSlop={4}
              >
                {toneColor ? (
                  <View style={[styles.chipDot, { backgroundColor: toneColor }]} />
                ) : null}
                <Text
                  style={[styles.chipText, chip.active && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <ScrollView
        style={styles.results}
        contentContainerStyle={styles.resultsContent}
        keyboardShouldPersistTaps="handled"
      >
        {showEmptyHint ? (
          <Text style={styles.hint}>
            Type to search across people, then places (clubs, marinas, sail lofts).
          </Text>
        ) : null}
        {showNoMatches ? (
          <Text style={styles.hint}>No places match "{trimmed}". Try a shorter term.</Text>
        ) : null}
        {(() => {
          // Section results by category — people first, places last —
          // with light headers so users scan top-down by intent.
          const people = results.filter((r) => r.kind === 'person');
          const places = results.filter((r) => r.kind !== 'person');
          const renderRow = (r: AtlasSearchResult) => (
            <Pressable
              key={r.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onSelect(r)}
            >
              <View
                style={[
                  styles.glyph,
                  { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: KIND_TONE[r.kind] },
                ]}
              >
                <Ionicons name={KIND_GLYPH[r.kind]} size={14} color={KIND_TONE[r.kind]} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {r.name}
                </Text>
                {r.detail ? (
                  <Text style={styles.rowDetail} numberOfLines={1}>
                    {r.detail}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgba(60, 60, 67, 0.35)" />
            </Pressable>
          );
          return (
            <>
              {people.length > 0 ? (
                <>
                  <Text style={styles.sectionHeader}>People</Text>
                  {people.map(renderRow)}
                </>
              ) : null}
              {places.length > 0 ? (
                <>
                  <Text style={styles.sectionHeader}>Places</Text>
                  {places.map(renderRow)}
                </>
              ) : null}
            </>
          );
        })()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(242, 242, 247, 0.97)',
    zIndex: 50,
    paddingTop: 56,
  },
  hidden: {
    opacity: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: IOS_REGISTER.label,
  },
  closeBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  chipRow: {
    flexGrow: 0,
    marginTop: 10,
    paddingLeft: 12,
  },
  chipRowContent: {
    gap: 6,
    paddingRight: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
  },
  chipActive: {
    backgroundColor: '#007AFF',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.85)',
    letterSpacing: -0.1,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  results: {
    flex: 1,
    marginTop: 12,
  },
  resultsContent: {
    paddingHorizontal: 12,
    paddingBottom: 80,
  },
  hint: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.65)',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.55)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowPressed: {
    backgroundColor: 'rgba(118, 118, 128, 0.10)',
  },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_REGISTER.label,
  },
  rowDetail: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 1,
  },
});
