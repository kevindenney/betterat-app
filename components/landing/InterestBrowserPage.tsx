import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SimpleLandingNav } from './SimpleLandingNav';
import { ScrollFix } from './ScrollFix';
import { getInterest } from '@/lib/landing/sampleData';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { supabase } from '@/services/supabase';
import { useMarketplaceBlueprints, blueprintDetailHref, type AuthorTone, type MarketplaceBlueprint } from '@/hooks/useMarketplaceBlueprints';
import { pickSquareMarkColor, pickAvatarMarkColor, initialsForName } from '@/components/discover/canonical/CanonicalDiscoverCells';
import { fontFamily } from '@/lib/design-tokens-editorial';

interface InterestBrowserPageProps {
  slug: string;
}

// Groups identity — teal, matching the app's mobile Groups zone (#14B8A6).
const GROUP_TEAL = '#14B8A6';
const GROUP_TEAL_SOFT = '#DAF5F1';
const GROUP_TEAL_DEEP = '#0F766E';
const GROUP_COHORT = '#5C6BC0';
const AXIS_PEER = '#2E7D32';
const AXIS_SEASONAL = '#0EA5E9';

// An org's `groups` are only joinable peer-groups (fleets, circles, chapters)
// when the label isn't one of these structural/curriculum/retail buckets.
// Denylist (not allowlist) so a new persona group-noun is included by default.
const STRUCTURAL_GROUP_LABELS = new Set([
  'Programs', 'Departments', 'Units', 'Products', 'Studios',
  'Workshops', 'Collections', 'Concentrations', 'Retreats', 'Courses',
]);

function singularize(label: string): string {
  if (label.endsWith('ies')) return `${label.slice(0, -3)}y`;
  if (label.endsWith('s')) return label.slice(0, -1);
  return label;
}

type GroupArchetype = 'peer' | 'cohort';

interface GroupVM {
  key: string;
  title: string;
  noun: string;          // singular persona noun: Fleet, Circle, Cohort
  pluralNoun: string;    // band key: Fleets, Circles, Cohorts
  orgName: string;
  orgSlug: string;
  archetype: GroupArchetype;
  markColor: string;
  initials: string;
  roster: { initials: string; tone: string }[];
  memberCount: number;
}

interface GroupBand {
  label: string;
  archetype: GroupArchetype;
  items: GroupVM[];
}

// Marketing/route slug → DB interest-catalog slug. The app routes and code maps
// (vocabulary, interestContext, skillTaxonomy) use the richer left-hand slugs,
// but the interests table stores the coarser right-hand ones. Without this,
// these pages can't resolve their interest row and would leak the whole catalog.
const INTEREST_SLUG_ALIASES: Record<string, string> = {
  'health-and-fitness': 'fitness',
  'fiber-arts': 'creative-arts',
  'painting-printing': 'painting',
  'lifelong-learning': 'education-learning',
  'regenerative-agriculture': 'agriculture-environment',
};

type TierTab = 'blueprints' | 'organizations' | 'groups' | 'people' | 'about';

// Author-avatar tone → hex, mirrors app/marketplace/index.tsx so the same
// blueprint renders identically on the interest page and the storefront.
function aviTone(tone: AuthorTone): string {
  switch (tone) {
    case 'brown': return '#8B5A3C';
    case 'warm': return '#B8855A';
    case 'green': return '#6E8B5A';
    case 'purple': return '#7A5A8B';
    default: return '#28406B';
  }
}

function priceFooter(cents: number, cadence: 'monthly' | 'annual' | 'one_time'): { amount: string; suffix: string } {
  if (cents <= 0) return { amount: 'Free', suffix: '' };
  const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  if (cadence === 'one_time') return { amount: `$${dollars}`, suffix: '' };
  if (cadence === 'annual') return { amount: `$${dollars}`, suffix: '/yr' };
  return { amount: `$${dollars}`, suffix: '/mo' };
}

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

// ── Shared blueprint card (cover band → body → price + Subscribe footer) ──

function BlueprintMarketCard({ plan, wide }: { plan: MarketplaceBlueprint; wide: boolean }) {
  const tone = aviTone(plan.authorTone);
  const { amount, suffix } = priceFooter(plan.pricePerSeatCents, plan.billingCadence);
  const subscriberLabel = plan.activeSubscriberCount > 0
    ? `${plan.activeSubscriberCount} ${plan.activeSubscriberCount === 1 ? 'subscriber' : 'subscribers'}`
    : 'Be the first to try this';

  return (
    <View style={[styles.bp, wide && styles.bpWide]}>
      <View
        style={[
          styles.bpCover,
          { backgroundColor: tone },
          Platform.select({ web: { backgroundImage: `linear-gradient(135deg, ${tone}, ${tone}CC)` } as any }),
        ]}
      />
      <View style={styles.bpBody}>
        <Text style={styles.bpTitle} numberOfLines={2}>{plan.title}</Text>
        <View style={styles.bpAuthorRow}>
          <View style={[styles.bpAvi, { backgroundColor: tone }]}>
            <Text style={styles.bpAviText}>{plan.authorInitials}</Text>
          </View>
          <Text style={styles.bpAuthorName} numberOfLines={1}>{plan.authorName}</Text>
        </View>
        {plan.description ? (
          <View style={styles.bpDescClip}>
            <Text style={styles.bpDesc} numberOfLines={3}>{plan.description}</Text>
          </View>
        ) : null}
        <View style={styles.bpMeta}>
          <View style={styles.bpMetaItem}>
            <Ionicons name="sparkles-outline" size={13} color="#6B7079" />
            <Text style={styles.bpMetaText}>{subscriberLabel}</Text>
          </View>
          {plan.trialDays > 0 ? (
            <View style={styles.bpMetaItem}>
              <Ionicons name="time-outline" size={13} color="#6B7079" />
              <Text style={styles.bpMetaText}>{plan.trialDays}-day trial</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.bpFoot}>
        <Text style={styles.bpPrice}>
          {amount}
          {suffix ? <Text style={styles.bpPriceSuffix}>{suffix}</Text> : null}
        </Text>
        <TouchableOpacity
          style={styles.subscribeBtn}
          activeOpacity={0.85}
          onPress={() => router.push(blueprintDetailHref(plan) as any)}
        >
          <Text style={styles.subscribeBtnText}>Subscribe</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Group card (square mark → kind line → axis chips → roster + CTA) ──
// One card type for fleets and cohorts; the three axis chips are data, and
// they compute the footer CTA (peer→Join, program-owned→Placed by program).

function AxisChip({ icon, label, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; tint: string }) {
  return (
    <View style={styles.axisChip}>
      <Ionicons name={icon} size={12} color={tint} />
      <Text style={styles.axisChipText}>{label}</Text>
    </View>
  );
}

function GroupCard({ group, onJoin }: { group: GroupVM; onJoin: () => void }) {
  const peer = group.archetype === 'peer';
  return (
    <View style={styles.gcard}>
      <View style={styles.ghead}>
        <View style={[styles.gmark, { backgroundColor: group.markColor }]}>
          <Text style={styles.gmarkText}>{group.initials}</Text>
        </View>
        <View style={styles.gheadCol}>
          <Text style={styles.gtitle} numberOfLines={2}>{group.title}</Text>
          <Text style={styles.gkind} numberOfLines={1}>{group.noun} · {group.orgName}</Text>
        </View>
      </View>
      <View style={styles.axes}>
        {peer ? (
          <>
            <AxisChip icon="time-outline" label="Standing" tint={GROUP_TEAL} />
            <AxisChip icon="cash-outline" label="Members pay" tint="#9AA0A8" />
            <AxisChip icon="git-network-outline" label="Peer-run" tint={AXIS_PEER} />
          </>
        ) : (
          <>
            <AxisChip icon="time-outline" label="Seasonal" tint={AXIS_SEASONAL} />
            <AxisChip icon="cash-outline" label="Program owns seats" tint="#9AA0A8" />
            <AxisChip icon="git-network-outline" label="Faculty-led" tint={GROUP_COHORT} />
          </>
        )}
      </View>
      <View style={styles.gfoot}>
        <View style={styles.roster}>
          {group.roster.map((m, i) => (
            <View key={i} style={[styles.rosterAvi, { backgroundColor: m.tone }, i > 0 && styles.rosterAviOverlap]}>
              <Text style={styles.rosterAviText}>{m.initials}</Text>
            </View>
          ))}
          <Text style={styles.rosterMore}>{group.memberCount} {peer ? 'members' : 'students'}</Text>
        </View>
        {peer ? (
          <TouchableOpacity style={styles.joinBtn} activeOpacity={0.85} onPress={onJoin}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placedPill}>
            <Text style={styles.placedPillText}>Placed by program</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// react-native-web makes <body> the scroll container while
// document.scrollingElement stays <html> (which isn't scrollable here), so
// window.scrollTo and even native smooth scrollIntoView/scrollTo silently
// no-op on the document. Resolve the real scrollable ancestor and animate its
// scrollTop ourselves so tier-tab clicks reliably jump to their section.
function scrollAnchorIntoView(el: HTMLElement, offset = 0) {
  let scroller: HTMLElement | null = el.parentElement;
  while (scroller) {
    const oy = getComputedStyle(scroller).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && scroller.scrollHeight > scroller.clientHeight) break;
    scroller = scroller.parentElement;
  }
  const container: HTMLElement = scroller ?? document.body;
  const target =
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    offset;
  const start = container.scrollTop;
  const max = container.scrollHeight - container.clientHeight;
  const end = Math.max(0, Math.min(target, max));
  const dist = end - start;
  if (Math.abs(dist) < 2) return;
  // Backgrounded tabs throttle requestAnimationFrame to zero, so the smooth
  // animation below would never tick. Jump instantly when hidden; a focused
  // user (the only one who can click a tab) still gets the animation.
  if (typeof document !== 'undefined' && document.hidden) {
    container.scrollTop = end;
    return;
  }
  const duration = 320;
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    container.scrollTop = start + dist * eased;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function InterestBrowserPage({ slug }: InterestBrowserPageProps) {
  const interest = getInterest(slug);
  // Marketing/route slugs are richer than the DB interest catalog (the code
  // canonicalizes on these, the DB rows are coarser). Resolve the route slug
  // to its DB-catalog slug so interest lookups + plan scoping line up.
  const dbSlug = INTEREST_SLUG_ALIASES[slug] ?? slug;
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const { userInterests, allInterests, addInterest, switchInterest, currentInterest, refreshInterests, getDomainForInterest } = useInterest();
  const { user, isGuest } = useAuth();
  const isLoggedIn = !!user && !isGuest;
  const isInUserInterests = userInterests.some((i) => i.slug === dbSlug);
  const existsInDb = allInterests.some((i) => i.slug === dbSlug);
  const isCurrent = currentInterest?.slug === dbSlug;

  const [activeTab, setActiveTab] = useState<TierTab>('blueprints');
  const scrollRef = useRef<ScrollView>(null);
  const bodyTop = useRef(0);
  const bodyInnerTop = useRef(0);
  const sectionRelY = useRef<Record<TierTab, number>>({ blueprints: 0, organizations: 0, groups: 0, people: 0, about: 0 });

  const goToTab = (key: TierTab) => {
    setActiveTab(key);
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        const el = document.getElementById(`ip-section-${key}`);
        if (el) scrollAnchorIntoView(el, 16);
      }
      return;
    }
    const y = bodyTop.current + bodyInnerTop.current + sectionRelY.current[key];
    scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
  };

  // Resolve parent domain for breadcrumb
  const dbInterest = allInterests.find((i) => i.slug === dbSlug);
  const parentDomain = dbInterest ? getDomainForInterest(dbInterest.id) : null;

  // Real subscribable plans from the authored-blueprint catalog (System B / Stripe),
  // scoped to this interest by id — the exact RPC the marketplace uses. An
  // unresolved interest shows none (never the whole catalog).
  const { blueprints: marketPlans } = useMarketplaceBlueprints(dbInterest?.id ?? null);
  const interestPlans = useMemo(() => (dbInterest ? marketPlans : []), [dbInterest, marketPlans]);

  // Real DB orgs for this interest, merged with curated sample orgs.
  const [extraOrgs, setExtraOrgs] = useState<{ slug: string; name: string; description: string | null }[]>([]);
  useEffect(() => {
    if (!interest) return;
    supabase
      .from('organizations')
      .select('name, slug, description')
      .eq('interest_slug', slug)
      .eq('is_active', true)
      .then(({ data }) => {
        if (!data) return;
        const sampleSlugs = new Set(interest.organizations.map((o) => o.slug));
        setExtraOrgs(
          data
            .filter((o) => !sampleSlugs.has(o.slug))
            .map((o) => ({ slug: o.slug, name: o.name, description: (o as any).description ?? null })),
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, interest?.name]);

  const organizations = useMemo(() => {
    if (!interest) return [];
    const sample = interest.organizations.map((o) => ({
      slug: o.slug,
      name: o.name,
      description: o.groupLabel ? `${o.groupLabel} in ${interest.name.toLowerCase()}.` : null,
    }));
    return [...sample, ...extraOrgs];
  }, [interest, extraOrgs]);

  // People = blueprint authors (creators) + curated independent practitioners,
  // deduped. There is no dedicated practitioner table, so authors are the
  // authoritative "who" for this interest.
  const people = useMemo(() => {
    const map = new Map<string, {
      key: string; name: string; initials: string; role: string;
      tone: string; userId: string | null; isCreator: boolean;
    }>();
    for (const p of interestPlans) {
      const key = p.authorUserId ?? p.authorName;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: p.authorName,
          initials: p.authorInitials || initialsOf(p.authorName),
          role: `Author · ${p.title}`,
          tone: aviTone(p.authorTone),
          userId: p.authorUserId,
          isCreator: true,
        });
      }
    }
    for (const pr of interest?.independentPractitioners ?? []) {
      const key = pr.userId ?? pr.name;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: pr.name,
          initials: initialsOf(pr.name),
          role: pr.role,
          tone: interest?.color ?? '#28406B',
          userId: pr.userId ?? null,
          isCreator: false,
        });
      }
    }
    return [...map.values()];
  }, [interestPlans, interest]);

  // Groups = fleets/circles (peer) + cohorts (placed), derived from the same
  // sample orgs the page already uses. Fleets live as joinable peer-groups
  // under orgs; cohorts are program-owned. No interest-scoped public RPC yet,
  // so this mirrors how Organizations/People are sourced on this page.
  const groupBands = useMemo<GroupBand[]>(() => {
    if (!interest) return [];
    const makeVM = (
      title: string,
      org: { slug: string; name: string },
      archetype: GroupArchetype,
      noun: string,
      pluralNoun: string,
      members: { name: string }[] | undefined,
    ): GroupVM => ({
      key: `${org.slug}:${title}`,
      title,
      noun,
      pluralNoun,
      orgName: org.name,
      orgSlug: org.slug,
      archetype,
      markColor: pickSquareMarkColor(title),
      initials: initialsForName(title),
      roster: (members ?? []).slice(0, 4).map((m) => ({
        initials: initialsForName(m.name),
        tone: pickAvatarMarkColor(m.name),
      })),
      memberCount: (members ?? []).length,
    });

    const vms: GroupVM[] = [];
    for (const org of interest.organizations) {
      if (!STRUCTURAL_GROUP_LABELS.has(org.groupLabel)) {
        for (const g of org.groups ?? []) {
          vms.push(makeVM(g.name, org, 'peer', singularize(org.groupLabel), org.groupLabel, g.people));
        }
      }
      for (const c of org.cohorts ?? []) {
        vms.push(makeVM(c.name, org, 'cohort', 'Cohort', 'Cohorts', c.people));
      }
    }

    const order: string[] = [];
    const byBand = new Map<string, GroupVM[]>();
    for (const vm of vms) {
      if (!byBand.has(vm.pluralNoun)) {
        byBand.set(vm.pluralNoun, []);
        order.push(vm.pluralNoun);
      }
      byBand.get(vm.pluralNoun)!.push(vm);
    }
    return order.map((label) => ({
      label,
      archetype: byBand.get(label)![0].archetype,
      items: byBand.get(label)!,
    }));
  }, [interest]);

  const groupCount = useMemo(
    () => groupBands.reduce((n, b) => n + b.items.length, 0),
    [groupBands],
  );

  // Stat counters
  const fromPrice = useMemo(() => {
    const paid = interestPlans.filter((p) => p.pricePerSeatCents > 0);
    if (paid.length === 0) return interestPlans.length > 0 ? 'Free' : '—';
    const min = Math.min(...paid.map((p) => p.pricePerSeatCents));
    return `$${(min / 100).toFixed(min % 100 === 0 ? 0 : 2)}`;
  }, [interestPlans]);

  const handleAddInterest = async () => {
    if (!isLoggedIn) {
      router.push({ pathname: '/(auth)/signup', params: { interest: slug } } as any);
      return;
    }
    try {
      if (existsInDb) {
        if (!isInUserInterests) await addInterest(dbSlug);
        await switchInterest(dbSlug);
        showAlert('Interest Active', `${interest?.name ?? slug} is now your active interest.`);
      } else {
        const { error } = await supabase
          .from('interests')
          .insert({
            slug: dbSlug,
            name: interest?.name ?? slug,
            status: 'active',
            visibility: 'public',
            type: 'official',
            accent_color: interest?.color ?? '#4338CA',
            icon_name: interest?.icon ?? 'compass',
          })
          .select('id, slug')
          .single();
        if (error) {
          console.warn('[InterestBrowserPage] Could not create interest:', error.message);
          showAlert('Coming Soon', `${interest?.name ?? slug} will be available as an interest soon.`);
          return;
        }
        await refreshInterests();
        setTimeout(async () => {
          try { await switchInterest(dbSlug); } catch { /* not in cache yet */ }
        }, 500);
        showAlert('Interest Added', `${interest?.name ?? slug} has been added and is now active.`);
      }
    } catch (err) {
      console.warn('[InterestBrowserPage] handleAddInterest error:', err);
      showAlert('Error', 'Could not add interest. Please try again.');
    }
  };

  const handleStartPracticing = async () => {
    if (!isLoggedIn) {
      router.push({ pathname: '/(auth)/signup', params: { interest: slug } } as any);
      return;
    }
    await handleAddInterest();
    router.push('/(tabs)' as any);
  };

  if (!interest) {
    return (
      <View style={styles.container}>
        <SimpleLandingNav />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Interest not found</Text>
        </View>
      </View>
    );
  }

  const blurb = `Explore the blueprints, organizations, and people building skill in ${interest.name.toLowerCase()}.`;

  const tabs: { key: TierTab; label: string; verb?: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'blueprints', label: 'Blueprints', verb: 'subscribe', icon: 'map-outline' },
    { key: 'organizations', label: 'Organizations', verb: 'join', icon: 'business-outline' },
    { key: 'groups', label: 'Groups', verb: 'join', icon: 'flag-outline' },
    { key: 'people', label: 'People', verb: 'follow', icon: 'people-outline' },
    { key: 'about', label: 'About', icon: 'information-circle-outline' },
  ];

  const content = (
    <>
      {/* Hero header */}
      <View style={styles.hero}>
        <View style={styles.heroInner}>
          <View style={styles.breadcrumbs}>
            <TouchableOpacity onPress={() => router.push('/marketplace' as any)}>
              <Text style={styles.crumbLink}>Marketplace</Text>
            </TouchableOpacity>
            <Text style={styles.crumbSep}>›</Text>
            {parentDomain && (
              <>
                <TouchableOpacity onPress={() => router.push('/interests' as any)}>
                  <Text style={styles.crumbLink}>{parentDomain.name}</Text>
                </TouchableOpacity>
                <Text style={styles.crumbSep}>›</Text>
              </>
            )}
            <Text style={styles.crumbCurrent}>{interest.name}</Text>
          </View>

          <View style={[styles.heroTop, !isDesktop && styles.heroTopStack]}>
            <View style={[styles.iconTile, { backgroundColor: interest.color }]}>
              <Ionicons name={interest.icon as keyof typeof Ionicons.glyphMap} size={30} color="#FFFFFF" />
            </View>
            <View style={styles.heroTitleCol}>
              <Text style={styles.heroH1}>{interest.name}</Text>
              <Text style={styles.heroSub}>{blurb}</Text>
            </View>
            <View style={[styles.heroActions, !isDesktop && styles.heroActionsStack]}>
              <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.8} onPress={handleAddInterest}>
                <Ionicons
                  name={isCurrent ? 'checkmark' : isInUserInterests ? 'swap-horizontal' : 'add'}
                  size={16}
                  color="#14161A"
                />
                <Text style={styles.ghostBtnText}>
                  {isCurrent ? 'Active interest' : isInUserInterests ? 'Switch here' : 'Add interest'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: interest.color }]}
                activeOpacity={0.85}
                onPress={handleStartPracticing}
              >
                <Text style={styles.primaryBtnText}>Start practicing</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{interestPlans.length}</Text>
              <Text style={styles.statLabel}>{interestPlans.length === 1 ? 'Blueprint' : 'Blueprints'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{organizations.length}</Text>
              <Text style={styles.statLabel}>{organizations.length === 1 ? 'Organization' : 'Organizations'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{groupCount}</Text>
              <Text style={styles.statLabel}>{groupCount === 1 ? 'Group' : 'Groups'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{people.length}</Text>
              <Text style={styles.statLabel}>{people.length === 1 ? 'Person' : 'People'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{fromPrice}</Text>
              <Text style={styles.statLabel}>From / month</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tier tabs */}
      <View style={styles.tabsBar}>
        <View style={styles.tabsInner}>
          {tabs.map((t) => {
            const on = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, on && { borderBottomColor: interest.color }]}
                activeOpacity={0.7}
                onPress={() => goToTab(t.key)}
              >
                <Ionicons name={t.icon} size={16} color={on ? '#14161A' : '#6B7079'} />
                <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
                {t.verb ? <Text style={styles.tabVerb}>{t.verb}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Body */}
      <View style={styles.body} onLayout={(e) => { bodyTop.current = e.nativeEvent.layout.y; }}>
        <View style={styles.bodyInner} onLayout={(e) => { bodyInnerTop.current = e.nativeEvent.layout.y; }}>
          <View
            nativeID="ip-section-blueprints"
            onLayout={(e) => { sectionRelY.current.blueprints = e.nativeEvent.layout.y; }}
            style={[styles.section, styles.sectionAnchor]}
          >
              <View style={styles.secHead}>
                <View style={styles.secHeadLeft}>
                  <Text style={styles.secTitle}>Blueprints</Text>
                  <View style={styles.verbPill}><Text style={styles.verbPillText}>subscribe</Text></View>
                </View>
                <TouchableOpacity onPress={() => router.push('/marketplace' as any)}>
                  <Text style={[styles.seeAll, { color: interest.color }]}>See all in marketplace →</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.bpGrid, isDesktop && styles.bpGridDesktop]}>
                {interestPlans.map((plan) => (
                  <BlueprintMarketCard key={plan.id} plan={plan} wide={isDesktop} />
                ))}
                {/* Authoring invite */}
                <View style={[styles.authorCard, isDesktop && styles.bpWide]}>
                  <View style={styles.authorIcon}>
                    <Ionicons name="create-outline" size={20} color="#2E5FE8" />
                  </View>
                  <Text style={styles.authorCardTitle}>Know {interest.name.toLowerCase()} well?</Text>
                  <Text style={styles.authorCardDesc}>
                    Publish a blueprint for {interest.name}. Authors keep 70% of subscriptions.
                  </Text>
                  <TouchableOpacity
                    style={styles.authorCta}
                    activeOpacity={0.8}
                    onPress={() => router.push((isLoggedIn ? '/creator' : '/(auth)/signup') as any)}
                  >
                    <Text style={styles.authorCtaText}>Become an author</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

          <View
            nativeID="ip-section-organizations"
            onLayout={(e) => { sectionRelY.current.organizations = e.nativeEvent.layout.y; }}
            style={[styles.section, styles.sectionAnchor]}
          >
              <View style={styles.secHead}>
                <View style={styles.secHeadLeft}>
                  <Text style={styles.secTitle}>Organizations</Text>
                  <View style={styles.verbPill}><Text style={styles.verbPillText}>join</Text></View>
                </View>
              </View>
              {organizations.length === 0 ? (
                <Text style={styles.emptyText}>No organizations listed for {interest.name.toLowerCase()} yet.</Text>
              ) : (
                <View style={[styles.row3, isDesktop && styles.row3Desktop]}>
                  {organizations.map((org) => (
                    <View key={org.slug} style={styles.mini}>
                      <View style={styles.miniHead}>
                        <View style={[styles.miniIcon, { backgroundColor: interest.color }]}>
                          <Ionicons name="business" size={16} color="#FFFFFF" />
                        </View>
                        <Text style={styles.miniTitle} numberOfLines={2}>{org.name}</Text>
                      </View>
                      {org.description ? (
                        <Text style={styles.miniDesc} numberOfLines={2}>{org.description}</Text>
                      ) : null}
                      <View style={styles.miniFoot}>
                        <View style={styles.miniMeta}>
                          <Ionicons name="people-outline" size={13} color="#9AA0A8" />
                          <Text style={styles.miniMetaText}>Open to all</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.miniBtn}
                          activeOpacity={0.8}
                          onPress={() => router.push(`/${slug}/${org.slug}` as any)}
                        >
                          <Text style={styles.miniBtnText}>Join</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

          <View
            nativeID="ip-section-groups"
            onLayout={(e) => { sectionRelY.current.groups = e.nativeEvent.layout.y; }}
            style={[styles.section, styles.sectionAnchor]}
          >
              <View style={styles.secHead}>
                <View style={styles.secHeadLeft}>
                  <Text style={styles.secTitle}>Groups</Text>
                  <View style={styles.verbPillTeal}><Text style={styles.verbPillTealText}>join</Text></View>
                </View>
              </View>
              <Text style={styles.secNote}>
                A group is the unit you move through the work with — a sailor&apos;s fleet, a student&apos;s
                cohort. Join one to share a calendar, adopt the same blueprints, and track progress together.
              </Text>
              {groupBands.length === 0 ? (
                <Text style={styles.emptyText}>No groups listed for {interest.name.toLowerCase()} yet.</Text>
              ) : (
                groupBands.map((band) => (
                  <View key={band.label}>
                    <View style={styles.grpBand}>
                      <View style={[styles.grpBandDot, { backgroundColor: band.archetype === 'peer' ? GROUP_TEAL : GROUP_COHORT }]} />
                      <Text style={styles.grpBandLabel}>{band.label}</Text>
                      <Text style={styles.grpBandCaption}>
                        {band.archetype === 'peer' ? 'members-run · join to take part' : 'placed by program'}
                      </Text>
                      <View style={styles.grpBandRule} />
                    </View>
                    <View style={[styles.row2, isDesktop && styles.row2Desktop]}>
                      {band.items.map((g) => (
                        <GroupCard
                          key={g.key}
                          group={g}
                          onJoin={() => {
                            if (!isLoggedIn) {
                              router.push({ pathname: '/(auth)/signup', params: { interest: slug } } as any);
                              return;
                            }
                            router.push(`/${slug}/${g.orgSlug}` as any);
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>

          <View
            nativeID="ip-section-people"
            onLayout={(e) => { sectionRelY.current.people = e.nativeEvent.layout.y; }}
            style={[styles.section, styles.sectionAnchor]}
          >
              <View style={styles.secHead}>
                <View style={styles.secHeadLeft}>
                  <Text style={styles.secTitle}>People</Text>
                  <View style={styles.verbPill}><Text style={styles.verbPillText}>follow</Text></View>
                </View>
              </View>
              {people.length === 0 ? (
                <Text style={styles.emptyText}>No people to follow in {interest.name.toLowerCase()} yet.</Text>
              ) : (
                <View style={[styles.row3, isDesktop && styles.row3Desktop]}>
                  {people.map((p) => (
                    <TouchableOpacity
                      key={p.key}
                      style={styles.person}
                      activeOpacity={p.userId ? 0.7 : 1}
                      onPress={() => {
                        if (!p.userId) return;
                        router.push((p.isCreator ? `/creator/${p.userId}` : `/person/${p.userId}`) as any);
                      }}
                    >
                      <View style={[styles.personAvi, { backgroundColor: p.tone }]}>
                        <Text style={styles.personAviText}>{p.initials}</Text>
                      </View>
                      <View style={styles.personCol}>
                        <Text style={styles.personName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.personRole} numberOfLines={1}>{p.role}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.followBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (!isLoggedIn) {
                            router.push({ pathname: '/(auth)/signup', params: { interest: slug } } as any);
                            return;
                          }
                          if (p.userId) router.push((p.isCreator ? `/creator/${p.userId}` : `/person/${p.userId}`) as any);
                        }}
                      >
                        <Text style={styles.followBtnText}>Follow</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

          <View
            nativeID="ip-section-about"
            onLayout={(e) => { sectionRelY.current.about = e.nativeEvent.layout.y; }}
            style={[styles.section, styles.sectionAnchor]}
          >
              <View style={styles.secHead}>
                <View style={styles.secHeadLeft}>
                  <Text style={styles.secTitle}>About {interest.name}</Text>
                </View>
              </View>
              <Text style={styles.aboutBody}>{blurb}</Text>
              <Text style={styles.aboutBody}>
                This page is the marketplace, filtered to {interest.name.toLowerCase()}. Subscribe to a blueprint to
                get a structured plan, join an organization to learn alongside a cohort, or follow the people building
                skill here.
              </Text>
            </View>
        </View>
      </View>

      <View style={styles.foot}>
        <Text style={styles.footBrand}>BetterAt</Text>
        <Text style={styles.footText}>The marketplace, filtered to {interest.name.toLowerCase()}.</Text>
      </View>
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <ScrollFix />
        <SimpleLandingNav currentInterestSlug={slug} />
        {content}
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.container}>
      <SimpleLandingNav currentInterestSlug={slug} />
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F5',
  },
  // ── Hero ──
  hero: {
    paddingTop: 92,
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEDE6',
    backgroundColor: '#FBF7EE',
  },
  heroInner: {
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  crumbLink: {
    fontSize: 13,
    color: '#2E5FE8',
    fontWeight: '600',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  crumbSep: {
    fontSize: 13,
    color: '#9AA0A8',
  },
  crumbCurrent: {
    fontSize: 13,
    color: '#6B7079',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  heroTopStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  iconTile: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleCol: {
    flex: 1,
  },
  heroH1: {
    fontFamily: fontFamily.serif,
    fontSize: 40,
    fontWeight: '500',
    letterSpacing: -0.8,
    color: '#14161A',
  },
  heroSub: {
    fontSize: 15,
    color: '#3C4048',
    marginTop: 4,
    lineHeight: 22,
    maxWidth: 560,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },
  heroActionsStack: {
    marginLeft: 0,
    marginTop: 16,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E6E4DD',
    backgroundColor: '#FFFFFF',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#14161A',
  },
  primaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 9,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 22,
    flexWrap: 'wrap',
  },
  stat: {
    minWidth: 64,
  },
  statNum: {
    fontFamily: fontFamily.serif,
    fontSize: 26,
    fontWeight: '500',
    color: '#14161A',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7079',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  // ── Tabs ──
  tabsBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFEDE6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    ...Platform.select({ web: { position: 'sticky', top: 56, zIndex: 20 } as any }),
  },
  sectionAnchor: {
    ...Platform.select({ web: { scrollMarginTop: 124 } as any }),
  },
  tabsInner: {
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7079',
  },
  tabLabelOn: {
    color: '#14161A',
  },
  tabVerb: {
    fontSize: 11,
    color: '#9AA0A8',
    fontWeight: '500',
  },
  // ── Body ──
  body: {
    paddingHorizontal: 24,
    paddingVertical: 30,
    backgroundColor: '#FAF9F5',
  },
  bodyInner: {
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: 34,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  secHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#14161A',
  },
  verbPill: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: '#EAF0FE',
  },
  verbPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#2E5FE8',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7079',
    fontStyle: 'italic',
  },
  // ── Blueprint card ──
  bpGrid: {
    gap: 18,
  },
  bpGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bp: {
    borderWidth: 1,
    borderColor: '#E6E4DD',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  bpWide: {
    width: 360,
  },
  bpCover: {
    height: 120,
  },
  bpBody: {
    padding: 18,
    gap: 10,
    flex: 1,
  },
  bpTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#14161A',
  },
  bpAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bpAvi: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bpAviText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bpAuthorName: {
    fontSize: 13,
    color: '#3C4048',
    flex: 1,
  },
  bpDesc: {
    fontSize: 13.5,
    color: '#6B7079',
    lineHeight: 20,
  },
  // RNW's numberOfLines on Text ellipsizes line 3 but still paints line 4
  // (overflow stays `visible`), which overlaps the meta row. A wrapping View
  // honors overflow:hidden, so cap it to 3 line-heights (3 × 20).
  bpDescClip: {
    ...Platform.select({ web: { maxHeight: 60, overflow: 'hidden' } as any }),
  },
  bpMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  bpMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bpMetaText: {
    fontSize: 12.5,
    color: '#6B7079',
  },
  bpFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EFEDE6',
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#FAF9F5',
  },
  bpPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#14161A',
  },
  bpPriceSuffix: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7079',
  },
  subscribeBtn: {
    backgroundColor: '#2E5FE8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  subscribeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // ── Authoring invite card ──
  authorCard: {
    borderWidth: 1,
    borderColor: '#E6E4DD',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#FAF9F5',
    padding: 18,
    gap: 8,
    justifyContent: 'center',
    minHeight: 200,
  },
  authorIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#EAF0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14161A',
  },
  authorCardDesc: {
    fontSize: 13.5,
    color: '#6B7079',
    lineHeight: 20,
  },
  authorCta: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E4DD',
    backgroundColor: '#FFFFFF',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  authorCtaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#14161A',
  },
  // ── Org mini cards ──
  row3: {
    gap: 14,
  },
  row3Desktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mini: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E4DD',
    borderRadius: 14,
    padding: 16,
    gap: 9,
    ...Platform.select({ web: { width: 'calc(33.333% - 10px)' as any, minWidth: 240 } }),
  },
  miniHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#14161A',
    flex: 1,
  },
  miniDesc: {
    fontSize: 13,
    color: '#6B7079',
    lineHeight: 20,
  },
  miniFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EFEDE6',
    paddingTop: 11,
    marginTop: 'auto',
  },
  miniMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  miniMetaText: {
    fontSize: 12,
    color: '#9AA0A8',
  },
  miniBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E4DD',
    backgroundColor: '#FFFFFF',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  miniBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#14161A',
  },
  // ── Person cards ──
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E4DD',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
    ...Platform.select({ web: { width: 'calc(33.333% - 10px)' as any, minWidth: 240, cursor: 'pointer' } }),
  },
  personAvi: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAviText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  personCol: {
    flex: 1,
  },
  personName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#14161A',
  },
  personRole: {
    fontSize: 12,
    color: '#6B7079',
    marginTop: 1,
  },
  followBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E4DD',
    backgroundColor: '#FFFFFF',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#14161A',
  },
  // ── Groups tier ──
  verbPillTeal: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: GROUP_TEAL_SOFT,
  },
  verbPillTealText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: GROUP_TEAL_DEEP,
  },
  secNote: {
    fontSize: 13.5,
    color: '#6B7079',
    lineHeight: 20,
    marginTop: -6,
    marginBottom: 16,
    maxWidth: 640,
  },
  grpBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 14,
    marginBottom: 12,
  },
  grpBandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  grpBandLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#6B7079',
  },
  grpBandCaption: {
    fontSize: 11,
    color: '#9AA0A8',
  },
  grpBandRule: {
    flex: 1,
    height: 1,
    backgroundColor: '#E6E4DD',
  },
  row2: {
    gap: 14,
  },
  row2Desktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gcard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E4DD',
    borderRadius: 14,
    padding: 16,
    gap: 11,
    ...Platform.select({ web: { width: 'calc(50% - 7px)' as any, minWidth: 280 } }),
  },
  ghead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  gmark: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gmarkText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  gheadCol: {
    flex: 1,
  },
  gtitle: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.1,
    lineHeight: 20,
    color: '#14161A',
  },
  gkind: {
    fontSize: 12.5,
    color: '#6B7079',
    marginTop: 2,
  },
  axes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  axisChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingLeft: 7,
    paddingRight: 9,
    borderRadius: 7,
    backgroundColor: '#F3F1EA',
  },
  axisChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3C4048',
  },
  gfoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EFEDE6',
    paddingTop: 12,
  },
  roster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rosterAvi: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterAviOverlap: {
    marginLeft: -7,
  },
  rosterAviText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rosterMore: {
    fontSize: 12,
    color: '#6B7079',
    marginLeft: 8,
  },
  joinBtn: {
    backgroundColor: GROUP_TEAL,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placedPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F1EA',
  },
  placedPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#9AA0A8',
  },
  // ── About ──
  aboutBody: {
    fontSize: 15,
    color: '#3C4048',
    lineHeight: 24,
    marginBottom: 12,
    maxWidth: 720,
  },
  // ── Footer ──
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
    paddingHorizontal: 40,
    backgroundColor: '#14161A',
    flexWrap: 'wrap',
    gap: 8,
  },
  footBrand: {
    fontFamily: fontFamily.serif,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footText: {
    fontSize: 13,
    color: '#9AA0A8',
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  notFoundText: {
    fontSize: 18,
    color: '#6B7079',
  },
});
