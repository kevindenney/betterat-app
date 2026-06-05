/**
 * DiscoverInterestsContent — the Interests management surface
 *
 * Single home for the nested four-tier spine: an interest contains
 * organizations, which contain blueprints. Verbs split by tier —
 * interest add/remove, org join/request/apply, blueprint subscribe.
 * The interest switcher stays the fast context-flip gateway; this is
 * where the relationships are managed.
 *
 * Yours  — your added interests; each expands to show the orgs you've
 *          joined (with membership state), orgs you can join, and the
 *          blueprints you're subscribed to.
 * Discover — interests you haven't added yet, grouped by domain.
 *
 * Add / remove / set-active happen inline. Join / request / apply /
 * subscribe route to the org or blueprint detail where the real flow
 * lives — we don't reimplement the join state machine here.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

import { SAMPLE_INTERESTS } from '@/lib/landing/sampleData';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { supabase } from '@/services/supabase';
import { IOS_SPACING, IOS_RADIUS } from '@/lib/design-tokens-ios';
import {
  fetchOrgMembershipRows,
  type OrgMembershipRawRow,
  type OrgMembershipEmbeddedOrg,
} from '@/hooks/orgMembershipsQuery';

// =============================================================================
// LOCAL PALETTE (iOS-clean, accent-tinted state pills)
// =============================================================================

const C = {
  card: '#FFFFFF',
  ink: '#1A1C22',
  ink2: '#565B66',
  ink3: '#8A8F99',
  hair: '#ECECEF',
  hair2: '#F3F3F5',
  paper: '#F6F6F8',
  azure: '#2E62F0',
  azureSoft: '#EAF0FE',
  azureDeep: '#1B3FA8',
  green: '#1E9E6A',
  greenSoft: '#E5F4EC',
  amber: '#C8841F',
  amberSoft: '#FBEFDD',
  rose: '#D9476B',
  roseSoft: '#FBEEF1',
};

type JoinMode = 'open_join' | 'request_to_join' | 'invite_only' | string | null;

interface AvailableOrg {
  id: string;
  name: string;
  slug: string;
  interest_slug: string | null;
  organization_type: string | null;
  join_mode: JoinMode;
}

interface SubBlueprint {
  id: string;
  slug: string;
  title: string;
  interest_id: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function orgOf(m: OrgMembershipRawRow): OrgMembershipEmbeddedOrg | null {
  const o = m.organization;
  if (!o) return null;
  return Array.isArray(o) ? (o[0] ?? null) : o;
}

function isActiveMembership(m: OrgMembershipRawRow): boolean {
  return m.status === 'active' || m.membership_status === 'active';
}

function isPendingMembership(m: OrgMembershipRawRow): boolean {
  return !isActiveMembership(m) && (m.status === 'pending' || m.membership_status === 'pending');
}

function joinModeLabel(mode: JoinMode): string {
  switch (mode) {
    case 'open_join':
      return 'Join';
    case 'request_to_join':
      return 'Request';
    case 'invite_only':
      return 'By invite';
    default:
      return 'View';
  }
}

function orgInitial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

// Deterministic accent for an org avatar from its name.
const AV_COLORS = ['#1B3FA8', '#2E62F0', '#1E9E6A', '#C8631A', '#7B4FB5', '#0E7C86'];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

// =============================================================================
// PROPS
// =============================================================================

interface DiscoverInterestsContentProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  addedInterestSlugs?: Set<string>;
  onAddInterest?: (slug: string) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DiscoverInterestsContent({
  toolbarOffset,
  onScroll,
}: DiscoverInterestsContentProps) {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDesktop = mounted && width > 768;

  const {
    userInterests,
    allInterests,
    groupedInterests,
    addInterest,
    removeInterest,
    currentInterest,
    switchInterest,
    refreshInterests,
  } = useInterest();
  const { user, isGuest } = useAuth();
  const isLoggedIn = !!user && !isGuest;

  const [tab, setTab] = useState<'yours' | 'discover'>('yours');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  // Org rows by interest_slug (available-to-join candidates, full shape).
  const [orgsByInterest, setOrgsByInterest] = useState<Record<string, AvailableOrg[]>>({});
  // The viewer's org memberships (any status), normalized.
  const [memberships, setMemberships] = useState<OrgMembershipRawRow[]>([]);
  // The viewer's subscribed timeline blueprints.
  const [subBlueprints, setSubBlueprints] = useState<SubBlueprint[]>([]);

  // --- fetch: all active orgs grouped by interest_slug -----------------------
  useEffect(() => {
    supabase
      .from('organizations')
      .select('id, name, slug, interest_slug, organization_type, join_mode')
      .eq('is_active', true)
      .not('interest_slug', 'is', null)
      .then(({ data }) => {
        if (!data) return;
        const grouped: Record<string, AvailableOrg[]> = {};
        for (const o of data as AvailableOrg[]) {
          const key = o.interest_slug as string;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(o);
        }
        setOrgsByInterest(grouped);
      });
  }, []);

  // --- fetch: viewer memberships ---------------------------------------------
  useEffect(() => {
    if (!user?.id) {
      setMemberships([]);
      return;
    }
    fetchOrgMembershipRows(user.id)
      .then(setMemberships)
      .catch(() => setMemberships([]));
  }, [user?.id]);

  // --- fetch: viewer's subscribed blueprints ---------------------------------
  useEffect(() => {
    if (!user?.id) {
      setSubBlueprints([]);
      return;
    }
    supabase
      .from('blueprint_subscriptions')
      .select('blueprint:timeline_blueprints(id, slug, title, interest_id)')
      .eq('subscriber_id', user.id)
      .then(({ data }) => {
        const rows = (data ?? [])
          .map((r: any) => (Array.isArray(r.blueprint) ? r.blueprint[0] : r.blueprint))
          .filter(Boolean) as SubBlueprint[];
        setSubBlueprints(rows);
      });
  }, [user?.id]);

  // Default the active interest to expanded once it resolves.
  useEffect(() => {
    if (currentInterest?.slug) setExpandedSlug(currentInterest.slug);
  }, [currentInterest?.slug]);

  // If the user has no interests, land them on Discover.
  useEffect(() => {
    if (userInterests.length === 0) setTab('discover');
  }, [userInterests.length]);

  const userInterestSlugs = useMemo(
    () => new Set(userInterests.map((i) => i.slug)),
    [userInterests],
  );

  // interest_slug → real DB org slugs (used to keep Discover links honest).
  const realOrgSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const list of Object.values(orgsByInterest)) for (const o of list) s.add(o.slug);
    return s;
  }, [orgsByInterest]);

  // memberships grouped by the org's interest_slug
  const membershipsByInterest = useMemo(() => {
    const map = new Map<string, OrgMembershipRawRow[]>();
    for (const m of memberships) {
      const slug = orgOf(m)?.interest_slug;
      if (!slug) continue;
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug)!.push(m);
    }
    return map;
  }, [memberships]);

  // blueprints grouped by interest_id
  const blueprintsByInterestId = useMemo(() => {
    const map = new Map<string, SubBlueprint[]>();
    for (const b of subBlueprints) {
      if (!b.interest_id) continue;
      if (!map.has(b.interest_id)) map.set(b.interest_id, []);
      map.get(b.interest_id)!.push(b);
    }
    return map;
  }, [subBlueprints]);

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------

  const handleAddInterest = async (slug: string, name: string) => {
    if (!isLoggedIn) {
      router.push('/(auth)/signup');
      return;
    }
    if (busySlug) return;
    setBusySlug(slug);
    try {
      const existsInDb = allInterests.some((i) => i.slug === slug);
      if (existsInDb) {
        if (!userInterestSlugs.has(slug)) await addInterest(slug);
        await switchInterest(slug);
      } else {
        const sample = SAMPLE_INTERESTS.find((i) => i.slug === slug);
        const { error } = await supabase.from('interests').insert({
          slug,
          name,
          status: 'active',
          visibility: 'public',
          type: 'official',
          accent_color: sample?.color ?? '#4338CA',
          icon_name: sample?.icon ?? 'compass',
        });
        if (error) {
          showAlert('Coming Soon', `${name} will be available as an interest soon.`);
          return;
        }
        await refreshInterests();
        await switchInterest(slug).catch(() => {});
      }
      setTab('yours');
      setExpandedSlug(slug);
    } catch {
      showAlert('Error', 'Could not add interest. Please try again.');
    } finally {
      setBusySlug(null);
    }
  };

  const handleSetActive = async (slug: string) => {
    try {
      await switchInterest(slug);
      setExpandedSlug(slug);
    } catch {
      showAlert('Error', 'Could not switch interest.');
    }
  };

  const handleRemove = (slug: string, name: string) => {
    showConfirm(
      'Remove interest',
      `Remove ${name} from your interests? Your steps stay, but it leaves this list.`,
      async () => {
        try {
          await removeInterest(slug);
        } catch (e: any) {
          showAlert('Could not remove', e?.message ?? 'Keep at least one interest.');
        }
      },
      { destructive: true, confirmText: 'Remove' },
    );
  };

  const openOrg = (slug: string) => router.push(`/organizations/${slug}` as any);
  const openBlueprint = (slug: string) => router.push(`/blueprint/${slug}` as any);
  const browseInterest = (slug: string) => router.push(`/${slug}` as any);

  // ---------------------------------------------------------------------------
  // DERIVED: Discover groups (interests not yet added)
  // ---------------------------------------------------------------------------

  const discoverInterests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SAMPLE_INTERESTS.map((sample) => {
      const dbInterest = allInterests.find((i) => i.slug === sample.slug);
      const realOrgs = (orgsByInterest[sample.slug] ?? []).filter((o) => realOrgSlugs.has(o.slug));
      return {
        slug: sample.slug,
        name: sample.name,
        icon: sample.icon,
        accentColor: dbInterest?.accent_color || sample.color,
        orgCount: realOrgs.length,
        topOrg: realOrgs[0]?.name ?? null,
      };
    })
      .filter((i) => !userInterestSlugs.has(i.slug))
      .filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [searchQuery, allInterests, orgsByInterest, realOrgSlugs, userInterestSlugs]);

  const discoverGroups = useMemo(() => {
    const slugToDomain = new Map<string, { name: string; color: string }>();
    for (const group of groupedInterests)
      for (const interest of group.interests)
        slugToDomain.set(interest.slug, {
          name: group.domain.name,
          color: group.domain.accent_color,
        });

    const byDomain = new Map<string, typeof discoverInterests>();
    const order: string[] = [];
    for (const item of discoverInterests) {
      const key = slugToDomain.get(item.slug)?.name ?? 'More to explore';
      if (!byDomain.has(key)) {
        byDomain.set(key, []);
        order.push(key);
      }
      byDomain.get(key)!.push(item);
    }
    return order.map((name) => ({ name, items: byDomain.get(name)! }));
  }, [discoverInterests, groupedInterests]);

  // ---------------------------------------------------------------------------
  // DERIVED: Yours (your added interests, search-filtered)
  // ---------------------------------------------------------------------------

  const yourInterests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return userInterests.filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [userInterests, searchQuery]);

  // ---------------------------------------------------------------------------
  // RENDER: a single "Yours" interest card
  // ---------------------------------------------------------------------------

  const renderYourCard = (interest: (typeof userInterests)[0]) => {
    const slug = interest.slug;
    const accent = interest.accent_color || C.azure;
    const isActive = currentInterest?.slug === slug;
    const expanded = expandedSlug === slug;

    const mine = membershipsByInterest.get(slug) ?? [];
    const joinedActive = mine.filter(isActiveMembership);
    const joinedIds = new Set(mine.map((m) => orgOf(m)?.id).filter(Boolean) as string[]);
    const available = (orgsByInterest[slug] ?? []).filter((o) => !joinedIds.has(o.id));
    const bps = blueprintsByInterestId.get(interest.id) ?? [];

    const subtitle = interest.hero_tagline || interest.description || null;

    return (
      <View
        key={slug}
        style={[
          styles.icard,
          isActive && [styles.icardActive, { shadowColor: accent }],
          isDesktop && styles.icardDesktop,
        ]}
      >
        {/* header — tap toggles expand */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.icardTop}
          onPress={() => setExpandedSlug(expanded ? null : slug)}
        >
          <View style={[styles.badgeIc, { backgroundColor: accent + '18' }]}>
            <Ionicons
              name={`${interest.icon_name ?? 'compass'}-outline` as any}
              size={22}
              color={accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.icardTitle}>{interest.name}</Text>
              {isActive && (
                <View style={[styles.chipActive, { backgroundColor: accent + '18' }]}>
                  <Ionicons name="radio-button-on" size={10} color={accent} />
                  <Text style={[styles.chipActiveTxt, { color: accent }]}>Active</Text>
                </View>
              )}
            </View>
            {subtitle ? (
              <Text style={styles.vocab} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={C.ink3}
          />
        </TouchableOpacity>

        {/* stat strip */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statN}>{joinedActive.length}</Text>
            <Text style={styles.statL}>Orgs joined</Text>
          </View>
          <View style={[styles.stat, styles.statBorder]}>
            <Text style={styles.statN}>{bps.length}</Text>
            <Text style={styles.statL}>Blueprints</Text>
          </View>
          <View style={[styles.stat, styles.statBorder]}>
            <Text style={styles.statN}>{available.length}</Text>
            <Text style={styles.statL}>Orgs available</Text>
          </View>
        </View>

        {expanded && (
          <>
            {/* ORG tier */}
            {(mine.length > 0 || available.length > 0) && (
              <View style={styles.tier}>
                <Text style={styles.tierLbl}>Organizations</Text>
                {mine.map((m) => {
                  const org = orgOf(m);
                  if (!org) return null;
                  const pending = isPendingMembership(m);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.row}
                      activeOpacity={0.7}
                      onPress={() => org.slug && openOrg(org.slug)}
                    >
                      <View style={[styles.av, { backgroundColor: avatarColor(org.name) }]}>
                        <Text style={styles.avTxt}>{orgInitial(org.name)}</Text>
                      </View>
                      <View style={styles.rowMeta}>
                        <Text style={styles.rowNm} numberOfLines={1}>
                          {org.name}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {pending ? 'Request pending review' : 'Member'}
                        </Text>
                      </View>
                      <View style={[styles.state, pending ? styles.statePending : styles.stateJoined]}>
                        <Text style={[styles.stateTxt, { color: pending ? C.amber : C.green }]}>
                          {pending ? 'Pending' : 'Joined'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {available.slice(0, 3).map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => openOrg(o.slug)}
                  >
                    <View style={[styles.av, { backgroundColor: avatarColor(o.name) }]}>
                      <Text style={styles.avTxt}>{orgInitial(o.name)}</Text>
                    </View>
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowNm} numberOfLines={1}>
                        {o.name}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {o.join_mode === 'open_join'
                          ? 'Open to all'
                          : o.join_mode === 'request_to_join'
                            ? 'Request to join'
                            : 'By invitation'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.joinBtn,
                        o.join_mode === 'open_join' && { backgroundColor: accent, borderColor: accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.joinBtnTxt,
                          o.join_mode === 'open_join' && { color: '#FFFFFF' },
                        ]}
                      >
                        {joinModeLabel(o.join_mode)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {available.length > 3 && (
                  <Text style={styles.browseAll}>+{available.length - 3} more organizations</Text>
                )}
              </View>
            )}

            {/* BLUEPRINT tier */}
            {bps.length > 0 && (
              <View style={styles.tier}>
                <Text style={styles.tierLbl}>Blueprints</Text>
                {bps.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => openBlueprint(b.slug)}
                  >
                    <View style={[styles.av, { backgroundColor: accent }]}>
                      <Ionicons name="ribbon-outline" size={14} color="#FFFFFF" />
                    </View>
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowNm} numberOfLines={1}>
                        {b.title}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        Subscribed
                      </Text>
                    </View>
                    <View style={[styles.state, styles.stateSub]}>
                      <Ionicons name="star" size={10} color={C.azure} />
                      <Text style={[styles.stateTxt, { color: C.azure }]}>Subscribed</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {mine.length === 0 && available.length === 0 && bps.length === 0 && (
              <View style={styles.tier}>
                <Text style={styles.emptyTier}>
                  No organizations or blueprints here yet — this interest is yours to build.
                </Text>
              </View>
            )}
          </>
        )}

        {/* footer */}
        <View style={styles.icardFoot}>
          {isActive ? (
            <View style={[styles.footTag, { backgroundColor: accent + '14' }]}>
              <Text style={[styles.footTagTxt, { color: accent }]}>Active</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btn, styles.btnPri, { backgroundColor: accent, borderColor: accent }]}
              onPress={() => handleSetActive(slug)}
            >
              <Text style={[styles.btnTxt, { color: '#FFFFFF' }]}>Set active</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btn} onPress={() => browseInterest(slug)}>
            <Text style={styles.btnTxt}>View</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.ghost} onPress={() => handleRemove(slug, interest.name)}>
            <Text style={styles.ghostTxt}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // RENDER: a Discover (add) card
  // ---------------------------------------------------------------------------

  const renderDiscoverCard = (item: (typeof discoverInterests)[0]) => (
    <View key={item.slug} style={[styles.dcard, isDesktop && styles.dcardDesktop]}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={{ flex: 1 }}
        onPress={() => browseInterest(item.slug)}
      >
        <View style={[styles.dic, { backgroundColor: item.accentColor + '18' }]}>
          <Ionicons name={`${item.icon}-outline` as any} size={18} color={item.accentColor} />
        </View>
        <Text style={styles.dn}>{item.name}</Text>
        <Text style={styles.dm}>
          {item.orgCount === 0
            ? 'No organizations yet'
            : `${item.orgCount} organization${item.orgCount !== 1 ? 's' : ''}`}
        </Text>
        {item.topOrg ? (
          <Text style={[styles.dorg, { color: item.accentColor }]} numberOfLines={1}>
            {item.topOrg}
          </Text>
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.addBtn, { borderColor: item.accentColor + '55' }]}
        disabled={busySlug === item.slug}
        onPress={() => handleAddInterest(item.slug, item.name)}
      >
        <Ionicons name="add" size={15} color={item.accentColor} />
        <Text style={[styles.addBtnTxt, { color: item.accentColor }]}>
          {busySlug === item.slug ? 'Adding…' : 'Add interest'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ---------------------------------------------------------------------------

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
        {/* header + segmented control */}
        <View style={styles.headWrap}>
          <Text style={styles.h1}>Interests</Text>
          <Text style={styles.sub}>
            Add or remove an interest, join its organizations, and subscribe to blueprints — all in
            one place.
          </Text>

          <View style={styles.seg}>
            <TouchableOpacity
              style={[styles.segBtn, tab === 'yours' && styles.segBtnOn]}
              onPress={() => setTab('yours')}
            >
              <Text style={[styles.segTxt, tab === 'yours' && styles.segTxtOn]}>
                Yours · {userInterests.length}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, tab === 'discover' && styles.segBtnOn]}
              onPress={() => setTab('discover')}
            >
              <Text style={[styles.segTxt, tab === 'discover' && styles.segTxtOn]}>Discover</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* search */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={C.ink3} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={tab === 'yours' ? 'Search your interests…' : 'Search interests…'}
              placeholderTextColor={C.ink3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        </View>

        {/* ===================== YOURS ===================== */}
        {tab === 'yours' && (
          <View style={styles.section}>
            {yourInterests.length > 0 ? (
              <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
                {yourInterests.map(renderYourCard)}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="compass-outline" size={28} color={C.ink3} />
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? `No interests match "${searchQuery}"`
                    : 'You haven’t added any interests yet.'}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity style={styles.emptyCta} onPress={() => setTab('discover')}>
                    <Text style={styles.emptyCtaTxt}>Discover interests</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* ===================== DISCOVER ===================== */}
        {tab === 'discover' && (
          <View style={styles.section}>
            {discoverGroups.length > 0 ? (
              discoverGroups.map((group) => (
                <View key={group.name} style={{ marginBottom: 6 }}>
                  <Text style={styles.domain}>{group.name}</Text>
                  <View style={[styles.dgrid, isDesktop && styles.dgridDesktop]}>
                    {group.items.map(renderDiscoverCard)}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={28} color={C.ink3} />
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? `No interests match "${searchQuery}"`
                    : 'You’ve added everything available.'}
                </Text>
              </View>
            )}
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

  // header
  headWrap: { paddingHorizontal: IOS_SPACING.lg, paddingTop: IOS_SPACING.md },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, color: C.ink },
  sub: { fontSize: 14, color: C.ink2, marginTop: 4, maxWidth: 560, lineHeight: 20 },

  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: C.paper,
    borderRadius: 999,
    padding: 4,
    marginTop: 18,
    gap: 2,
    borderWidth: 1,
    borderColor: C.hair,
  },
  segBtn: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999 },
  segBtnOn: {
    backgroundColor: C.card,
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as any }),
  },
  segTxt: { fontSize: 13.5, fontWeight: '600', color: C.ink2 },
  segTxtOn: { color: C.ink },

  // search
  searchContainer: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: IOS_RADIUS.sm,
    paddingHorizontal: IOS_SPACING.sm,
    height: 38,
    borderWidth: 1,
    borderColor: C.hair,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.ink,
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },

  // sections
  section: { paddingHorizontal: 16, paddingTop: 14 },

  grid: { gap: 14 },
  gridDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },

  // your-interest card
  icard: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.hair,
    overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } as any }),
  },
  icardDesktop: { width: '48.5%' as any, flexGrow: 1, flexBasis: 380 },
  icardActive: {
    borderColor: '#C9D6FB',
    ...Platform.select({
      web: { boxShadow: '0 0 0 1px #C9D6FB, 0 10px 30px rgba(26,28,34,0.08)' } as any,
      default: { shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    }),
  },
  icardTop: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, paddingBottom: 12 },
  badgeIc: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icardTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, color: C.ink },
  chipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  chipActiveTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  vocab: { fontSize: 12.5, color: C.ink3, marginTop: 2 },

  // stat strip
  stats: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14 },
  stat: { flex: 1, paddingRight: 14 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: C.hair2, paddingLeft: 14 },
  statN: { fontSize: 18, fontWeight: '800', color: C.ink },
  statL: { fontSize: 11, fontWeight: '600', color: C.ink3, marginTop: 1 },

  // nested tier
  tier: { borderTopWidth: 1, borderTopColor: C.hair2, paddingHorizontal: 16, paddingVertical: 12 },
  tierLbl: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.ink3,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 8,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  av: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  rowMeta: { flex: 1, minWidth: 0 },
  rowNm: { fontSize: 13.5, fontWeight: '600', color: C.ink },
  rowSub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  stateJoined: { backgroundColor: C.greenSoft },
  statePending: { backgroundColor: C.amberSoft },
  stateSub: { backgroundColor: C.azureSoft },
  stateTxt: { fontSize: 11.5, fontWeight: '700' },
  joinBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: C.card,
  },
  joinBtnTxt: { fontSize: 12, fontWeight: '600', color: C.ink },
  browseAll: { fontSize: 12, color: C.ink3, marginTop: 6 },
  emptyTier: { fontSize: 12.5, color: C.ink3, lineHeight: 18 },

  // footer
  icardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.hair2,
    backgroundColor: '#FCFCFD',
  },
  btn: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: C.card,
  },
  btnPri: {},
  btnTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink },
  footTag: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 9 },
  footTagTxt: { fontSize: 12.5, fontWeight: '700' },
  ghost: { paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8 },
  ghostTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink3 },

  // discover
  domain: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink2,
    marginTop: 8,
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  dgrid: { gap: 12 },
  dgridDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dcard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.hair,
    padding: 14,
    gap: 8,
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } as any }),
  },
  dcardDesktop: { width: '31.5%' as any, flexGrow: 1, flexBasis: 240, maxWidth: 360 },
  dic: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dn: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2, color: C.ink },
  dm: { fontSize: 11.5, color: C.ink3 },
  dorg: { fontSize: 11.5, fontWeight: '500' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  addBtnTxt: { fontSize: 12.5, fontWeight: '700' },

  // empty
  emptyContainer: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: C.ink2, textAlign: 'center' },
  emptyCta: {
    marginTop: 4,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: C.azure,
  },
  emptyCtaTxt: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
});
