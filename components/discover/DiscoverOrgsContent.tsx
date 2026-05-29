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
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  YACHT_CLUB_DEMO_NAME,
  YACHT_CLUB_DEMO_SLUG,
} from '@/services/YachtClubDemoService';
import {
  CanonicalList,
  CanonicalListEyebrow,
  CanonicalOrgRow,
  initialsForName,
  pickSquareMarkColor,
} from '@/components/discover/canonical';
import { CreateOrgSheet } from '@/components/discover/CreateOrgSheet';

// =============================================================================
// TYPES
// =============================================================================

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  join_mode: OrganizationJoinMode;
  organization_type?: string | null;
  status?: string | null;
  official?: boolean | null;
  claim_status?: string | null;
  source?: string | null;
}

interface DiscoverOrgsContentProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function isYachtClubPlaceholder(org: OrgRow): boolean {
  return (
    org.organization_type === 'yacht_club' &&
    (org.status === 'placeholder' || org.official === false || org.source === 'dragon_worlds_clubspot')
  );
}

function orgDescriptor(org: OrgRow): string {
  if (isYachtClubPlaceholder(org)) {
    if (org.claim_status === 'claim_pending') return 'Yacht club placeholder · claim pending';
    if (org.claim_status === 'rejected') return 'Yacht club placeholder · claim rejected';
    return 'Yacht club placeholder · unclaimed';
  }

  switch (org.join_mode) {
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
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

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

        let orgQuery = await supabase
          .from('organizations')
          .select('id, name, slug, join_mode, organization_type, status, official, claim_status, source')
          .eq('interest_slug', interestSlug)
          .eq('is_active', true)
          .order('name')
          .limit(30);

        if (
          orgQuery.error &&
          (
            isMissingSupabaseColumn(orgQuery.error, 'organizations.organization_type') ||
            isMissingSupabaseColumn(orgQuery.error, 'organizations.status') ||
            isMissingSupabaseColumn(orgQuery.error, 'organizations.official') ||
            isMissingSupabaseColumn(orgQuery.error, 'organizations.claim_status') ||
            isMissingSupabaseColumn(orgQuery.error, 'organizations.source')
          )
        ) {
          orgQuery = await supabase
            .from('organizations')
            .select('id, name, slug, join_mode')
            .eq('interest_slug', interestSlug)
            .eq('is_active', true)
            .order('name')
            .limit(30);
        }

        const { data, error } = orgQuery;
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
            organization_type: r.organization_type,
            status: r.status,
            official: r.official,
            claim_status: r.claim_status,
            source: r.source,
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
      if (!org.slug) return;
      if (isYachtClubPlaceholder(org)) {
        router.push(`/organizations/${org.slug}` as any);
        return;
      }
      router.push(`/discover/org/${org.slug}?from=orgs` as any);
    },
    [router]
  );

  const renderOrgRow = useCallback(
    (org: OrgRow, index: number) => {
      const initials = initialsForName(org.name);
      const markColor = pickSquareMarkColor(org.id || org.slug || org.name);
      const joinedLabel = memberOrgIds.has(org.id) ? 'Joined' : undefined;
      const rowKey = [org.id, org.slug, index].filter(Boolean).join(':');

      return (
        <CanonicalOrgRow
          key={rowKey}
          first={index === 0}
          initials={initials}
          markColor={markColor}
          name={org.name}
          descriptor={orgDescriptor(org)}
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
            <Pressable
              style={styles.demoPromo}
              onPress={() => router.push(`/organizations/${YACHT_CLUB_DEMO_SLUG}` as any)}
            >
              <View style={styles.demoPromoBadge}>
                <Ionicons name="sparkles-outline" size={14} color="#0B63CE" />
                <Text style={styles.demoPromoBadgeText}>Demo</Text>
              </View>
              <View style={styles.demoPromoBody}>
                <Text style={styles.demoPromoTitle}>{YACHT_CLUB_DEMO_NAME}</Text>
                <Text style={styles.demoPromoText}>
                  See the synthetic club example with contacts, fleets, a free placeholder tier, and the full pricing ladder.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={IOS_REGISTER.labelSecondary} />
            </Pressable>
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

        {/* Self-serve create — surfaced after a fruitless search or in a
            generally empty list. Search context pre-fills the new org's
            name so the user doesn't retype. */}
        {!loading && interestSlug && (
          <Pressable
            style={styles.createCta}
            onPress={() => setCreateSheetOpen(true)}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={IOS_COLORS.systemBlue}
            />
            <View style={styles.createCtaBody}>
              <Text style={styles.createCtaTitle}>
                {searchResults
                  ? `Don't see “${searchQuery}”? Add it.`
                  : "Don't see your org? Add it."}
              </Text>
              <Text style={styles.createCtaHint}>
                Start it now — a verified parent can adopt it later.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={IOS_REGISTER.labelSecondary}
            />
          </Pressable>
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

      <CreateOrgSheet
        visible={createSheetOpen}
        initialName={searchQuery.trim() || undefined}
        onClose={() => setCreateSheetOpen(false)}
      />
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

  demoPromo: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(11, 99, 206, 0.14)',
    backgroundColor: '#F7FAFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  demoPromoBadge: {
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    gap: 2,
  },
  demoPromoBadgeText: {
    color: '#0B63CE',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  demoPromoBody: {
    flex: 1,
    gap: 3,
  },
  demoPromoTitle: {
    color: IOS_REGISTER.label,
    fontSize: 16,
    fontWeight: '800',
  },
  demoPromoText: {
    color: IOS_REGISTER.labelSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

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

  // Self-serve create CTA — sits below the list and after empty states.
  createCta: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(11,99,206,0.18)',
    backgroundColor: '#F7FAFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createCtaBody: { flex: 1, gap: 2 },
  createCtaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  createCtaHint: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
});
