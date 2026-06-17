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
import { useToast } from '@/components/ui/AppToast';
import { supabase } from '@/services/supabase';
import { IOS_SPACING } from '@/lib/design-tokens-ios';
import { gearErrorMessage, getGearLabels, hasGearConcept, type GearItem, type GearStatus } from '@/services/GearService';
import { GearEditorSheet, type GearEditorValues } from '@/components/discover/GearEditorSheet';
import {
  useCreateGearItem,
  useDeleteGearItem,
  useInterestGear,
  useSetPrimaryGearItem,
  useUpdateGearItem,
} from '@/hooks/useGear';
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

function outlineIconName(icon: string | null | undefined): string {
  const base = icon || 'compass';
  return base.endsWith('-outline') ? base : `${base}-outline`;
}

function interestCaption(slug: string, fallback: string | null | undefined): string {
  const normalized = slug.toLowerCase();
  if (normalized.includes('sail')) return 'Regattas · fleets · crews — your sailing vocabulary';
  if (normalized.includes('nurs')) return 'Rotations · competencies · shifts';
  if (normalized.includes('food')) return 'Products · FSSAI · home-scale batches';
  if (normalized.includes('golf')) return 'Practice · clubs · rounds';
  return fallback || 'Organizations · blueprints · practice';
}

function displayInitials(value: string | null | undefined): string {
  const source = value?.trim();
  if (!source) return 'KD';
  const parts = source.includes('@')
    ? source.split('@')[0].split(/[._-]+/)
    : source.split(/\s+/);
  const letters = parts
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return letters || 'KD';
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
  showContextChrome?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DiscoverInterestsContent({
  toolbarOffset,
  onScroll,
  addedInterestSlugs,
  onAddInterest,
  showContextChrome = true,
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
  const toast = useToast();

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
  const [stepsThisWeekByInterest, setStepsThisWeekByInterest] = useState<Record<string, number>>({});

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

  // --- fetch: lightweight "steps this week" counts for the active summary ----
  useEffect(() => {
    if (!user?.id) {
      setStepsThisWeekByInterest({});
      return;
    }
    const since = new Date();
    since.setDate(since.getDate() - 7);
    supabase
      .from('timeline_steps')
      .select('interest_id')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())
      .then(({ data }) => {
        const next: Record<string, number> = {};
        for (const row of (data ?? []) as { interest_id: string | null }[]) {
          if (!row.interest_id) continue;
          next[row.interest_id] = (next[row.interest_id] ?? 0) + 1;
        }
        setStepsThisWeekByInterest(next);
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
  const visibleAddedSlugs = useMemo(() => {
    const next = new Set(userInterestSlugs);
    addedInterestSlugs?.forEach((slug) => next.add(slug));
    return next;
  }, [addedInterestSlugs, userInterestSlugs]);

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
    // Decouple add from activate: only auto-switch when the user has no active
    // interest yet (first add → the Practice tab needs one). Otherwise keep
    // their current context and offer an inline "Switch" via toast.
    const keepActive = !!currentInterest && currentInterest.slug !== slug;
    try {
      // The cached interest list can lag a freshly-created interest, so
      // confirm existence against the DB before deciding to propose a new one.
      let existsInDb = allInterests.some((i) => i.slug === slug);
      if (!existsInDb) {
        const { data } = await supabase
          .from('interests')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        existsInDb = !!data;
      }
      if (existsInDb) {
        if (!userInterestSlugs.has(slug)) await addInterest(slug);
        if (!keepActive) await switchInterest(slug);
        await refreshInterests();
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
        if (!keepActive) await switchInterest(slug).catch(() => {});
      }
      onAddInterest?.(slug);
      setTab('yours');
      setExpandedSlug(slug);
      if (keepActive) {
        toast.show(`Added ${name}`, 'success', {
          action: {
            label: 'Switch',
            onPress: () => {
              switchInterest(slug).catch(() => {});
            },
          },
        });
      }
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
    // The provider blocks removing the last interest by silently no-op'ing, so
    // explain the guard here rather than letting the confirm dialog do nothing.
    if (userInterests.length <= 1) {
      showAlert(
        'Keep one interest',
        'You need at least one interest. Add another before removing this one.',
      );
      return;
    }
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
      .filter((i) => !visibleAddedSlugs.has(i.slug))
      .filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [searchQuery, allInterests, orgsByInterest, realOrgSlugs, visibleAddedSlugs]);

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
    return userInterests
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => {
        if (a.slug === currentInterest?.slug) return -1;
        if (b.slug === currentInterest?.slug) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [currentInterest?.slug, userInterests, searchQuery]);

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
    const stepsThisWeek = stepsThisWeekByInterest[interest.id] ?? 0;

    const subtitle = interestCaption(slug, interest.hero_tagline || interest.description);
    const stats = [
      { value: joinedActive.length, label: 'Orgs joined' },
      { value: bps.length, label: bps.length === 1 ? 'Blueprint subscribed' : 'Blueprints' },
      ...(isActive || expanded ? [{ value: stepsThisWeek, label: 'Steps this week' }] : []),
      { value: available.length, label: available.length === 1 ? 'Org available' : 'Orgs available' },
    ];

    return (
      <View
        key={slug}
        style={[
          styles.icard,
          isActive && [styles.icardActive, { shadowColor: accent }],
          isDesktop && styles.icardDesktop,
          isDesktop && (isActive || expanded) && styles.icardFullDesktop,
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
              name={outlineIconName(interest.icon_name) as any}
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
          {stats.map((stat, index) => (
            <View key={stat.label} style={[styles.stat, index > 0 && styles.statBorder]}>
              <Text style={styles.statN}>{stat.value}</Text>
              <Text style={styles.statL}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {hasGearConcept(slug) && (
          <InterestGearPanel
            userId={user?.id ?? null}
            interestId={interest.id}
            interestSlug={slug}
            accent={accent}
            expanded={expanded}
          />
        )}

        {expanded && (
          <>
            {/* ORG tier */}
            {(mine.length > 0 || available.length > 0) && (
              <View style={styles.tier}>
                <View style={styles.tierLblRow}>
                  <Text style={styles.tierLbl}>
                    {mine.length > 0 ? 'Organizations · you' : 'Organizations · suggested'}
                  </Text>
                  {available.length > 0 ? (
                    <TouchableOpacity onPress={() => browseInterest(slug)}>
                      <Text style={[styles.tierLink, { color: accent }]}>
                        Browse all {available.length} →
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
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
                        <Ionicons
                          name={pending ? 'hourglass-outline' : 'checkmark'}
                          size={11}
                          color={pending ? C.amber : C.green}
                        />
                        <Text style={[styles.stateTxt, { color: pending ? C.amber : C.green }]}>
                          {pending ? 'Pending' : 'Joined'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {mine.length > 0 && available.length > 0 ? (
                  <Text style={styles.tierSubLbl}>Suggested</Text>
                ) : null}
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
                <View style={styles.tierLblRow}>
                  <Text style={styles.tierLbl}>Blueprints</Text>
                </View>
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
            <TouchableOpacity style={styles.btn} onPress={() => browseInterest(slug)}>
              <Text style={styles.btnTxt}>Open practice</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, styles.btnPri, { backgroundColor: accent, borderColor: accent }]}
              onPress={() => handleSetActive(slug)}
            >
              <Text style={[styles.btnTxt, { color: '#FFFFFF' }]}>Set active</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.btn}
            onPress={() => (isActive ? router.push('/atlas' as any) : setExpandedSlug(expanded ? null : slug))}
          >
            <Text style={styles.btnTxt}>{isActive ? 'View on Atlas' : 'Manage'}</Text>
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
          <Text style={styles.dorg} numberOfLines={1}>
            <Text style={{ color: item.accentColor }}>• </Text>
            {item.topOrg}
          </Text>
        ) : item.orgCount > 0 ? (
          <Text style={[styles.dorg, { color: C.ink3 }]} numberOfLines={1}>
            no orgs joined yet
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

  const renderDiscoverSection = (compact: boolean) => (
    <View style={[styles.section, compact && styles.discoverPeek]}>
      <View style={styles.secHead}>
        <Text style={styles.secTitle}>Discover more</Text>
        {discoverGroups.length > 1 ? (
          <Text style={styles.secCount}>grouped by domain</Text>
        ) : null}
      </View>
      {discoverGroups.length > 0 ? (
        discoverGroups.map((group) => (
          <View key={group.name} style={styles.domainGroup}>
            <View style={styles.domainRow}>
              <Text style={styles.domain}>{group.name}</Text>
              <View style={styles.domainRule} />
            </View>
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
      <View style={styles.legend}>
        <Text style={styles.legendStrong}>Verbs by tier:</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: C.ink3 }]} />
          <Text style={styles.legendText}><Text style={styles.legendBold}>Interest</Text> — add / remove</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: C.green }]} />
          <Text style={styles.legendText}><Text style={styles.legendBold}>Organization</Text> — join / request / apply / leave</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: C.azure }]} />
          <Text style={styles.legendText}><Text style={styles.legendBold}>Blueprint</Text> — subscribe / unsubscribe</Text>
        </View>
      </View>
      <Text style={styles.footnote}>
        Interest → organization → blueprint is one nested spine. The switcher flips context; this surface manages the relationships.
      </Text>
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
        <View style={styles.shell}>
          {showContextChrome ? (
            <View style={styles.contextChrome}>
              <TouchableOpacity
                style={styles.contextSwitcher}
                activeOpacity={0.75}
                onPress={() => setExpandedSlug(currentInterest?.slug ?? expandedSlug)}
              >
                <View
                  style={[
                    styles.contextIcon,
                    { backgroundColor: (currentInterest?.accent_color ?? C.azure) + '18' },
                  ]}
                >
                  <Ionicons
                    name={outlineIconName(currentInterest?.icon_name) as any}
                    size={17}
                    color={currentInterest?.accent_color ?? C.azure}
                  />
                </View>
                <Text style={styles.contextLabel}>{currentInterest?.name ?? 'Choose interest'}</Text>
                <Ionicons name="chevron-down" size={13} color={C.ink3} />
                {currentInterest ? (
                  <View style={styles.contextTag}>
                    <Text style={styles.contextTagText}>Active</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <View style={styles.contextAvatar}>
                <Text style={styles.contextAvatarText}>
                  {displayInitials((user as any)?.user_metadata?.full_name ?? user?.email)}
                </Text>
              </View>
            </View>
          ) : null}

        {/* header + segmented control */}
        <View style={styles.headWrap}>
          <Text style={styles.h1}>Interests</Text>
          <Text style={styles.sub}>
            Everything you’re working on, and everything you could. Add or remove an interest,
            join its organizations, and subscribe to blueprints — all in one place.
          </Text>

          <View style={styles.seg}>
            <TouchableOpacity
              style={[styles.segBtn, tab === 'yours' && styles.segBtnOn]}
              onPress={() => setTab('yours')}
            >
              <Text style={[styles.segTxt, tab === 'yours' && styles.segTxtOn]}>
                Yours
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

        <View style={styles.railWrap}>
          <Text style={styles.railLabel}>Jump back in</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            <TouchableOpacity style={styles.railPill} onPress={() => currentInterest && browseInterest(currentInterest.slug)}>
              <View style={[styles.railIcon, { backgroundColor: currentInterest?.accent_color ?? C.azure }]}>
                <Ionicons name={outlineIconName(currentInterest?.icon_name) as any} size={15} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.railTitle}>{currentInterest?.name ?? 'Active interest'}</Text>
                <Text style={styles.railSub}>{currentInterest ? 'Open practice' : 'Choose a context'}</Text>
              </View>
            </TouchableOpacity>
            {yourInterests.slice(0, 2).filter((interest) => interest.slug !== currentInterest?.slug).map((interest) => (
              <TouchableOpacity key={interest.slug} style={styles.railPill} onPress={() => handleSetActive(interest.slug)}>
                <View style={[styles.railIcon, { backgroundColor: interest.accent_color || C.green }]}>
                  <Ionicons name={outlineIconName(interest.icon_name) as any} size={15} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.railTitle}>{interest.name}</Text>
                  <Text style={styles.railSub}>Set active</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ===================== YOURS ===================== */}
        {tab === 'yours' && (
          <View style={styles.section}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>Your interests</Text>
              <Text style={styles.secCount}>
                {userInterests.length} added · {currentInterest ? '1 active' : '0 active'}
              </Text>
            </View>
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
        {tab === 'yours' ? renderDiscoverSection(true) : renderDiscoverSection(false)}
        </View>
      </ScrollView>
    </View>
  );
}

function gearSpecSummary(item: GearItem): string {
  const spec = item.spec ?? {};
  const parts = [
    spec.class_name,
    spec.sail_number,
    spec.model,
    spec.manufacturer,
    spec.subcategory,
  ]
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map(String)
    .filter((value) => value.trim().length > 0);
  if (item.status === 'loaned') parts.unshift('loaned');
  if (item.status === 'backup') parts.unshift('backup');
  if (item.status === 'retired') parts.unshift('retired');
  return parts.slice(0, 2).join(' · ');
}

function gearIconFor(item: Pick<GearItem, 'kind'>, slug?: string | null): string {
  const kind = item.kind.toLowerCase();
  if (kind.includes('boat') || slug?.includes('sail')) return 'boat-outline';
  if (kind.includes('sail') || kind.includes('jib') || kind.includes('rig')) return 'flag-outline';
  if (kind.includes('club') || slug?.includes('golf')) return 'golf-outline';
  if (kind.includes('kit') || slug?.includes('nursing')) return 'medkit-outline';
  if (kind.includes('vehicle')) return 'bicycle-outline';
  if (kind.includes('machine')) return 'cog-outline';
  return 'construct-outline';
}

function statusLabel(status: GearStatus): string {
  switch (status) {
    case 'loaned':
      return 'Loaned';
    case 'retired':
      return 'Retired';
    case 'backup':
      return 'Backup';
    case 'active':
      return 'Active';
  }
}

function InterestGearPanel({
  userId,
  interestId,
  interestSlug,
  accent,
  expanded,
}: {
  userId: string | null;
  interestId: string;
  interestSlug: string;
  accent: string;
  expanded: boolean;
}) {
  const labels = getGearLabels(interestSlug);
  const { data: items = [], isLoading } = useInterestGear(interestId, userId);
  const createGear = useCreateGearItem();
  const updateGear = useUpdateGearItem();
  const deleteGear = useDeleteGearItem();
  const setPrimary = useSetPrimaryGearItem();

  const roots = React.useMemo(
    () => items.filter((item) => !item.parent_id),
    [items],
  );
  const childrenByParent = React.useMemo(() => {
    const map = new Map<string, GearItem[]>();
    for (const item of items) {
      if (!item.parent_id) continue;
      const list = map.get(item.parent_id) ?? [];
      list.push(item);
      map.set(item.parent_id, list);
    }
    return map;
  }, [items]);
  const previewItems = roots.slice(0, 3);

  const [editor, setEditor] = React.useState<{ item: GearItem | null; parent: GearItem | null } | null>(null);

  const handleAdd = React.useCallback((parent?: GearItem | null) => {
    if (!userId) {
      router.push('/(auth)/signup');
      return;
    }
    setEditor({ item: null, parent: parent ?? null });
  }, [userId]);

  const handleEdit = React.useCallback((item: GearItem) => {
    setEditor({ item, parent: null });
  }, []);

  const handleEditorSave = React.useCallback((values: GearEditorValues) => {
    if (!editor) return;
    const onError = (error: unknown) =>
      showAlert('Could not save gear', gearErrorMessage(error));

    if (editor.item) {
      const item = editor.item;
      const makingPrimary = values.isPrimary && !item.is_primary;
      updateGear.mutate({
        id: item.id,
        patch: {
          name: values.name,
          kind: values.kind,
          spec: values.spec,
          status: values.status,
          notes: values.notes,
          ...(values.isPrimary ? {} : { is_primary: false }),
        },
      }, {
        onSuccess: (updated) => {
          setEditor(null);
          if (makingPrimary) setPrimary.mutate(updated, { onError });
        },
        onError,
      });
      return;
    }

    if (!userId) return;
    createGear.mutate({
      userId,
      interestId,
      kind: values.kind,
      name: values.name,
      parentId: editor.parent?.id ?? null,
      isPrimary: values.isPrimary,
      status: values.status,
      spec: values.spec,
      notes: values.notes,
    }, {
      onSuccess: () => setEditor(null),
      onError,
    });
  }, [createGear, editor, interestId, setPrimary, updateGear, userId]);

  const handleToggleRetired = React.useCallback((item: GearItem) => {
    const nextStatus: GearStatus = item.status === 'retired' ? 'active' : 'retired';
    updateGear.mutate({ id: item.id, patch: { status: nextStatus, is_primary: nextStatus === 'retired' ? false : item.is_primary } }, {
      onError: (error) => showAlert('Could not update gear', gearErrorMessage(error)),
    });
  }, [updateGear]);

  const handleDelete = React.useCallback((item: GearItem) => {
    showConfirm(
      'Delete gear?',
      `Delete ${item.name}? This also removes it from steps where it was selected.`,
      () => deleteGear.mutate(
        { id: item.id, userId: item.user_id, interestId: item.interest_id },
        { onError: (error) => showAlert('Could not delete gear', gearErrorMessage(error)) },
      ),
      { destructive: true, confirmText: 'Delete' },
    );
  }, [deleteGear]);

  return (
    <View style={styles.gearBlock}>
      <View style={styles.gearHeader}>
        <Text style={styles.gearLabel}>{labels.railLabel}</Text>
        <TouchableOpacity
          style={styles.gearAdd}
          onPress={() => handleAdd(null)}
          disabled={createGear.isPending}
        >
          <Ionicons name="add" size={14} color={accent} />
          <Text style={[styles.gearAddText, { color: accent }]}>
            {createGear.isPending ? 'Adding...' : labels.addLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Text style={styles.gearEmpty}>Loading {labels.railLabel.toLowerCase()}...</Text>
      ) : previewItems.length === 0 ? (
        <Text style={styles.gearEmpty}>{labels.emptyLabel}</Text>
      ) : (
        <View style={styles.gearRail}>
          {previewItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.gearTile,
                item.is_primary && { borderColor: accent + '55', backgroundColor: accent + '08' },
              ]}
              activeOpacity={0.75}
              onPress={() => handleEdit(item)}
            >
              <View style={styles.gearTileTop}>
                <Ionicons name={gearIconFor(item, interestSlug) as any} size={18} color={item.status === 'retired' ? C.ink3 : accent} />
                {item.is_primary ? <Ionicons name="star" size={13} color="#F59E0B" /> : null}
              </View>
              <Text style={styles.gearTileName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.gearTileMeta} numberOfLines={1}>{gearSpecSummary(item) || statusLabel(item.status)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {expanded ? (
        <View style={styles.gearManager}>
          {roots.length === 0 ? null : roots.map((item) => {
            const children = childrenByParent.get(item.id) ?? [];
            return (
              <View key={item.id} style={styles.gearManageGroup}>
                <View style={styles.gearManageRow}>
                  <View style={[styles.gearManageIcon, { backgroundColor: accent + '14' }]}>
                    <Ionicons name={gearIconFor(item, interestSlug) as any} size={16} color={accent} />
                  </View>
                  <TouchableOpacity style={styles.gearManageMeta} onPress={() => handleEdit(item)}>
                    <Text style={styles.gearManageName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.gearManageSub} numberOfLines={1}>{gearSpecSummary(item) || statusLabel(item.status)}</Text>
                  </TouchableOpacity>
                  {item.is_primary ? (
                    <View style={[styles.gearChip, styles.gearChipPrimary]}>
                      <Text style={styles.gearChipPrimaryText}>Primary</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.gearIconButton} onPress={() => setPrimary.mutate(item)}>
                      <Ionicons name="star-outline" size={16} color={C.ink3} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.gearIconButton} onPress={() => handleToggleRetired(item)}>
                    <Ionicons name={item.status === 'retired' ? 'refresh-outline' : 'archive-outline'} size={16} color={C.ink3} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.gearIconButton} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash-outline" size={16} color={C.rose} />
                  </TouchableOpacity>
                </View>
                {children.map((child) => (
                  <View key={child.id} style={[styles.gearManageRow, styles.gearChildRow]}>
                    <View style={styles.gearChildStem} />
                    <View style={styles.gearManageIcon}>
                      <Ionicons name={gearIconFor(child, interestSlug) as any} size={15} color={C.ink2} />
                    </View>
                    <TouchableOpacity style={styles.gearManageMeta} onPress={() => handleEdit(child)}>
                      <Text style={styles.gearManageName} numberOfLines={1}>{child.name}</Text>
                      <Text style={styles.gearManageSub} numberOfLines={1}>{gearSpecSummary(child) || statusLabel(child.status)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.gearIconButton} onPress={() => handleToggleRetired(child)}>
                      <Ionicons name={child.status === 'retired' ? 'refresh-outline' : 'archive-outline'} size={16} color={C.ink3} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.gearIconButton} onPress={() => handleDelete(child)}>
                      <Ionicons name="trash-outline" size={16} color={C.rose} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.gearNestedAdd} onPress={() => handleAdd(item)}>
                  <Ionicons name="add" size={13} color={accent} />
                  <Text style={[styles.gearNestedAddText, { color: accent }]}>Add sub-gear</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : null}

      <GearEditorSheet
        visible={editor !== null}
        labels={labels}
        item={editor?.item ?? null}
        parentName={editor?.parent?.name ?? null}
        suggestPrimary={!editor?.parent && roots.length === 0}
        saving={createGear.isPending || updateGear.isPending}
        onClose={() => setEditor(null)}
        onSave={handleEditorSave}
      />
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 240 },
  shell: {
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },

  // current context note
  contextChrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  contextSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: C.card,
    ...Platform.select({ web: { boxShadow: '0 1px 2px rgba(26,28,34,0.04), 0 8px 24px rgba(26,28,34,0.06)' } as any }),
  },
  contextIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  contextLabel: { fontSize: 15, fontWeight: '800', color: C.ink },
  contextTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: C.azureSoft,
  },
  contextTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.azure,
  },
  contextAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C8631A',
  },
  contextAvatarText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  // header
  headWrap: { paddingTop: 0 },
  h1: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6, color: C.ink },
  sub: { fontSize: 14.5, color: C.ink2, marginTop: 4, maxWidth: 620, lineHeight: 21 },

  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: '#F3F0EA',
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
  searchContainer: { paddingTop: 14, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: IOS_SPACING.sm,
    height: 38,
    borderWidth: 1,
    borderColor: C.hair,
    ...Platform.select({ web: { boxShadow: '0 1px 2px rgba(26,28,34,0.04), 0 8px 24px rgba(26,28,34,0.06)' } as any }),
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.ink,
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },

  // jump rail
  railWrap: { paddingTop: 22, paddingBottom: 14 },
  railLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.ink3,
    marginBottom: 10,
  },
  rail: { gap: 12, paddingRight: 16, paddingBottom: 4 },
  railPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: C.card,
    borderRadius: 999,
    paddingVertical: 8,
    paddingLeft: 9,
    paddingRight: 16,
    ...Platform.select({ web: { boxShadow: '0 1px 2px rgba(26,28,34,0.04), 0 8px 24px rgba(26,28,34,0.06)' } as any }),
  },
  railIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  railTitle: { fontSize: 13, fontWeight: '700', color: C.ink },
  railSub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },

  // sections
  section: { paddingTop: 14 },
  discoverPeek: { paddingTop: 34 },
  secHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  secTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2, color: C.ink },
  secCount: { fontSize: 13, fontWeight: '700', color: C.ink3 },

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
  icardFullDesktop: { width: '100%' as any, flexBasis: '100%' as any },
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

  // gear rail
  gearBlock: {
    borderTopWidth: 1,
    borderTopColor: C.hair2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  gearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  gearLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: C.ink3,
  },
  gearAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
  },
  gearAddText: { fontSize: 12.5, fontWeight: '700' },
  gearEmpty: { fontSize: 12.5, color: C.ink3 },
  gearRail: { flexDirection: 'row', gap: 8 },
  gearTile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: '#FEFEFE',
    borderRadius: 12,
    padding: 10,
    gap: 5,
  },
  gearTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 18,
  },
  gearTileName: { fontSize: 13, fontWeight: '800', color: C.ink },
  gearTileMeta: { fontSize: 11.5, color: C.ink3 },
  gearManager: { gap: 8 },
  gearManageGroup: {
    borderTopWidth: 1,
    borderTopColor: C.hair2,
    paddingTop: 8,
    gap: 6,
  },
  gearManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 38,
  },
  gearChildRow: { paddingLeft: 20 },
  gearChildStem: {
    width: 14,
    height: 1,
    backgroundColor: C.hair,
  },
  gearManageIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearManageMeta: { flex: 1, minWidth: 0 },
  gearManageName: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  gearManageSub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  gearChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gearChipPrimary: { backgroundColor: C.azureSoft },
  gearChipPrimaryText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.azure,
  },
  gearIconButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.paper,
  },
  gearNestedAdd: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingLeft: 52,
  },
  gearNestedAddText: { fontSize: 12, fontWeight: '700' },

  // nested tier
  tier: { borderTopWidth: 1, borderTopColor: C.hair2, paddingHorizontal: 16, paddingVertical: 12 },
  tierLblRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  tierLbl: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.ink3,
  },
  tierSubLbl: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.ink3,
    marginTop: 4,
    marginBottom: 4,
  },
  tierLink: { fontSize: 11.5, fontWeight: '800' },
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
  domainGroup: { marginBottom: 26 },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  domain: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink2,
    letterSpacing: -0.1,
  },
  domainRule: { flex: 1, height: 1, backgroundColor: C.hair },
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

  // legend
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: C.hair,
    paddingTop: 18,
    marginTop: 4,
  },
  legendStrong: { fontSize: 12, fontWeight: '800', color: C.ink },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendSwatch: { width: 11, height: 11, borderRadius: 4 },
  legendText: { fontSize: 12, color: C.ink2 },
  legendBold: { fontWeight: '800', color: C.ink },
  footnote: { fontSize: 11.5, lineHeight: 17, color: C.ink3, marginTop: 10 },

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
