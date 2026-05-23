/**
 * DiscoverOrgsContent — Orgs surface of the canonical Discover trio
 *
 * Pass 11 (docs/redesign/ios-register/discover-pass-11-brief.md):
 *
 *   - 44px square letter-mark, 16px name, 13px descriptor (join-mode signal).
 *   - Joined orgs sit mixed in the list, marked only by a small gray "Joined"
 *     tag — no chunk-up, no row tint, no section split (canonical position:
 *     mine-and-undiscovered share one scroll).
 *   - List eyebrow names the current interest context.
 *   - Join / Request-to-join CTAs moved to the Org detail page. Deciding to
 *     join is a tap-and-read decision, not a list-row decision.
 *   - Search moves to a quiet pill at the foot, after the list.
 *
 * Supabase wiring (orgs query, search) is preserved from the previous render
 * path; only the cell visual is replaced. Membership state comes from a
 * direct lookup so already-joined orgs render with the mine tag.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import {
  organizationDiscoveryService,
  type OrganizationJoinMode,
} from '@/services/OrganizationDiscoveryService';
import { supabase } from '@/services/supabase';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  CanonicalList,
  CanonicalListEyebrow,
  CanonicalOrgRow,
  initialsForName,
  pickSquareMarkColor,
} from '@/components/discover/canonical';

// =============================================================================
// TYPES
// =============================================================================

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  join_mode: OrganizationJoinMode;
}

interface DiscoverOrgsContentProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function joinModeDescriptor(mode: OrganizationJoinMode): string {
  switch (mode) {
    case 'open_join':
      return 'Open to join';
    case 'request_to_join':
      return 'Requires approval';
    case 'invite_only':
    default:
      return 'Invite only';
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DiscoverOrgsContent({
  toolbarOffset,
  onScroll,
}: DiscoverOrgsContentProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const interestSlug = currentInterest?.slug;
  const interestName = currentInterest?.name;

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrgRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [memberOrgIds, setMemberOrgIds] = useState<Set<string>>(new Set());

  // Load orgs for current interest
  useEffect(() => {
    let cancelled = false;
    const loadOrgs = async () => {
      setLoading(true);
      try {
        if (!interestSlug) {
          if (!cancelled) setOrgs([]);
          return;
        }

        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, slug, join_mode')
          .eq('interest_slug', interestSlug)
          .eq('is_active', true)
          .order('name')
          .limit(30);

        if (error) throw error;

        if (!cancelled) {
          setOrgs(
            (data || []).map((o) => ({
              ...o,
              join_mode: o.join_mode || 'invite_only',
            }))
          );
        }
      } catch (err) {
        console.error('[DiscoverOrgs] Error loading orgs:', err);
        if (!cancelled) setOrgs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadOrgs();
    return () => {
      cancelled = true;
    };
  }, [interestSlug]);

  // Load this user's existing org memberships so already-joined orgs render
  // with the mine tag even before they tap Join here.
  useEffect(() => {
    if (!user?.id) {
      setMemberOrgIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('organization_memberships')
          .select('organization_id, status, membership_status')
          .eq('user_id', user.id);
        if (error) throw error;
        if (cancelled) return;
        const ids = new Set<string>();
        for (const row of data || []) {
          const status = row.status || row.membership_status;
          if (status === 'active' || status === 'invite_accepted') {
            ids.add(row.organization_id);
          }
        }
        setMemberOrgIds(ids);
      } catch (err) {
        console.warn('[DiscoverOrgs] membership load failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Debounced cross-interest search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await organizationDiscoveryService.searchOrganizations({
          query: searchQuery,
          limit: 20,
        });
        setSearchResults(
          results.map((r) => ({
            id: r.id,
            name: r.name,
            slug: r.slug || '',
            join_mode: r.join_mode,
          }))
        );
      } catch (err) {
        console.error('[DiscoverOrgs] Search error:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openOrg = useCallback(
    (org: OrgRow) => {
      if (org.slug) router.push(`/discover/org/${org.slug}?from=orgs` as any);
    },
    [router]
  );

  const renderOrgRow = useCallback(
    (org: OrgRow, index: number) => {
      const initials = initialsForName(org.name);
      const markColor = pickSquareMarkColor(org.id || org.slug || org.name);
      const joinedLabel = memberOrgIds.has(org.id) ? 'Joined' : undefined;

      return (
        <CanonicalOrgRow
          key={org.id}
          first={index === 0}
          initials={initials}
          markColor={markColor}
          name={org.name}
          descriptor={joinModeDescriptor(org.join_mode)}
          joinedLabel={joinedLabel}
          onPress={() => openOrg(org)}
        />
      );
    },
    [memberOrgIds, openOrg]
  );

  // Cells to render — search results win when active
  const cells = useMemo(() => (searchResults ?? orgs), [searchResults, orgs]);

  const eyebrow = searchResults
    ? { plain: 'Search · ', em: `${searchResults.length} ${searchResults.length === 1 ? 'org' : 'orgs'}` }
    : interestName
      ? { plain: 'Around ', em: interestName }
      : { plain: 'Orgs in your register', em: '' };

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
        {!interestSlug && (
          <View style={styles.emptyContainer}>
            <Ionicons name="compass-outline" size={36} color={IOS_REGISTER.labelTertiary} />
            <Text style={styles.emptyText}>
              Pick an interest to see related orgs.
            </Text>
          </View>
        )}

        {loading && interestSlug && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
          </View>
        )}

        {!loading && interestSlug && cells.length > 0 && (
          <>
            <CanonicalListEyebrow {...eyebrow} />
            <CanonicalList>{cells.map(renderOrgRow)}</CanonicalList>
          </>
        )}

        {!loading && interestSlug && cells.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={searchResults ? 'search' : 'business-outline'}
              size={36}
              color={IOS_REGISTER.labelTertiary}
            />
            <Text style={styles.emptyText}>
              {searchResults
                ? `No orgs match “${searchQuery}” yet.`
                : 'No orgs for this interest yet.'}
            </Text>
          </View>
        )}

        {/* Pass 11 — search moves to a quiet pill at the foot. */}
        {interestSlug && (
          <View style={styles.searchOuter}>
            <View style={styles.searchBar}>
              <Ionicons
                name="search"
                size={16}
                color={IOS_REGISTER.labelSecondary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Find an org"
                placeholderTextColor={IOS_REGISTER.labelSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {searching ? (
                <ActivityIndicator size="small" color={IOS_REGISTER.labelSecondary} />
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
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

  // Search — quiet pill at the foot per Pass 11 brief
  searchOuter: {
    paddingTop: 16,
    paddingBottom: 4,
  },
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

  // Empty + loading
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
