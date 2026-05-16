/**
 * DiscoverOrgsContent — Orgs surface of the canonical Discover trio
 *
 * Renders the canonical Orgs cell from
 * `docs/redesign/ios-register/discover-trio-canonical.html`:
 *
 *   - 44px square letter-mark, 16px name, 13px descriptor (join-mode signal)
 *   - Joined orgs sit mixed in the list, marked only by a small gray "Joined"
 *     tag — no chunk-up, no row tint, no section split (canonical position:
 *     mine-and-undiscovered share one scroll)
 *   - List eyebrow names the current interest context
 *   - Search field placeholder is "Find an org"
 *
 * Supabase wiring (orgs query, search, join request) is preserved from the
 * previous render path; only the cell visual is replaced. Membership state
 * comes from `useOrgMemberships` so already-joined orgs render with the
 * mine tag regardless of how they were joined.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
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

type OrgJoinState = 'idle' | 'joining' | 'joined' | 'pending' | 'blocked';

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
  const { user, isGuest } = useAuth();
  const isLoggedIn = !!user && !isGuest;
  const { currentInterest } = useInterest();
  const interestSlug = currentInterest?.slug;
  const interestName = currentInterest?.name;

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrgRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [joinStates, setJoinStates] = useState<Record<string, OrgJoinState>>({});
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

  const handleJoin = useCallback(
    async (org: OrgRow) => {
      if (!isLoggedIn) {
        router.push('/(auth)/signup');
        return;
      }

      setJoinStates((prev) => ({ ...prev, [org.id]: 'joining' }));
      try {
        const result = await organizationDiscoveryService.requestJoin({
          orgId: org.id,
          mode: org.join_mode,
        });

        if (result.status === 'active' || result.status === 'existing') {
          setJoinStates((prev) => ({ ...prev, [org.id]: 'joined' }));
          setMemberOrgIds((prev) => new Set(prev).add(org.id));
        } else if (result.status === 'pending') {
          setJoinStates((prev) => ({ ...prev, [org.id]: 'pending' }));
        } else {
          setJoinStates((prev) => ({ ...prev, [org.id]: 'blocked' }));
        }
      } catch (err) {
        console.error('[DiscoverOrgs] Join error:', err);
        setJoinStates((prev) => ({ ...prev, [org.id]: 'idle' }));
      }
    },
    [isLoggedIn, router]
  );

  const openOrg = useCallback(
    (org: OrgRow) => {
      if (org.slug) router.push(`/org/${org.slug}` as any);
    },
    [router]
  );

  const resolveJoinedLabel = useCallback(
    (orgId: string): string | undefined => {
      const interactive = joinStates[orgId];
      if (interactive === 'joined') return 'Joined';
      if (interactive === 'pending') return 'Pending';
      if (memberOrgIds.has(orgId)) return 'Joined';
      return undefined;
    },
    [joinStates, memberOrgIds]
  );

  const renderOrgRow = useCallback(
    (org: OrgRow, index: number) => {
      const initials = initialsForName(org.name);
      const markColor = pickSquareMarkColor(org.id || org.slug || org.name);
      const joinedLabel = resolveJoinedLabel(org.id);
      const state = joinStates[org.id] ?? 'idle';

      return (
        <View key={org.id}>
          <CanonicalOrgRow
            first={index === 0}
            initials={initials}
            markColor={markColor}
            name={org.name}
            descriptor={joinModeDescriptor(org.join_mode)}
            joinedLabel={joinedLabel}
            onPress={() => openOrg(org)}
          />
          {/* Inline join affordance — quiet button below the row when not joined,
              shown only for open / request-to-join orgs (invite-only stays read-only) */}
          {!joinedLabel &&
            org.join_mode !== 'invite_only' &&
            state !== 'joining' && (
              <Pressable
                style={styles.inlineJoinBtn}
                onPress={() => handleJoin(org)}
                accessibilityRole="button"
                accessibilityLabel={`Join ${org.name}`}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={14}
                  color={IOS_COLORS.systemBlue}
                />
                <Text style={styles.inlineJoinBtnText}>
                  {org.join_mode === 'request_to_join' ? 'Request to join' : 'Join'}
                </Text>
              </Pressable>
            )}
          {state === 'joining' && (
            <View style={styles.inlineJoinBtn}>
              <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
            </View>
          )}
        </View>
      );
    },
    [handleJoin, joinStates, openOrg, resolveJoinedLabel]
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
        {/* Search — single field, surface-tuned placeholder per the canonical */}
        <View style={styles.searchOuter}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={16}
              color={IOS_REGISTER.labelSecondary}
              style={styles.searchLead}
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

  // Search — match canonical search field
  searchOuter: {
    paddingTop: 6,
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
  searchLead: {},
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

  // Inline join affordance under the row when unjoined + non-invite-only
  inlineJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 72, // align text past the 44px mark + leading padding
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  inlineJoinBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
    letterSpacing: -0.05,
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
