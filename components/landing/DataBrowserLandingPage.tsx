import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SimpleLandingNav } from './SimpleLandingNav';
import { ScrollFix } from './ScrollFix';
import { SearchBar } from './SearchBar';
import { SAMPLE_INTERESTS, INTEREST_DOMAINS } from '@/lib/landing/sampleData';
import { useMarketplaceBlueprints, type MarketplaceBlueprint, type AuthorTone } from '@/hooks/useMarketplaceBlueprints';

// ── palette (from mockup 24) ──────────────────────────────────────────
const HERO = '#15161B';
const BLUE = '#2E5FE8';
const INK = '#14161A';
const INK2 = '#3C4048';
const INK3 = '#6B7079';
const INK4 = '#9AA0A8';
const LINE = '#E6E4DD';
const LINE2 = '#EFEDE6';
const PAPER2 = '#FAF9F5';
const PAPER3 = '#F3F1EA';

function authorToneColor(tone: AuthorTone): string {
  switch (tone) {
    case 'brown': return '#8B5A3C';
    case 'warm': return '#B8855A';
    case 'green': return '#6E8B5A';
    case 'purple': return '#7A5A8B';
    default: return '#28406B';
  }
}

function formatPrice(cents: number, cadence: 'monthly' | 'annual' | 'one_time'): string {
  const dollars = (cents / 100).toFixed(0);
  if (cadence === 'one_time') return `$${dollars}`;
  if (cadence === 'annual') return `$${dollars}/yr`;
  return `$${dollars}/mo`;
}

// Universality proof — the "same engine, different domain" story.
const PROOF_CARDS = [
  {
    name: 'Nursing',
    org: 'Johns Hopkins School of Nursing',
    color: '#0097A7',
    icon: 'medkit' as const,
    rows: [
      ['Organization', 'Hospital / School'],
      ['Program', 'MSN cohort'],
      ['Step', 'Clinical shift'],
      ['Competency', 'AACN domain'],
    ],
  },
  {
    name: 'Sail Racing',
    org: 'Royal Hong Kong Yacht Club',
    color: '#003DA5',
    icon: 'boat' as const,
    rows: [
      ['Organization', 'Yacht club'],
      ['Program', 'Race series'],
      ['Step', 'Race / practice'],
      ['Competency', 'Boat-handling skill'],
    ],
  },
  {
    name: 'Drawing',
    org: 'Independent authors',
    color: '#E64A19',
    icon: 'color-palette' as const,
    rows: [
      ['Organization', 'Art school'],
      ['Program', 'Fundamentals course'],
      ['Step', 'Daily exercise'],
      ['Competency', 'Proportion · value'],
    ],
  },
];

export function DataBrowserLandingPage() {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDesktop = mounted && width > 768;

  const { blueprints } = useMarketplaceBlueprints();

  // Live blueprint inventory per interest slug — closes the loop the
  // redesign is about: interest cards advertise real sellable supply.
  const bpCountBySlug = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const bp of blueprints) {
      if (bp.interestSlug) map[bp.interestSlug] = (map[bp.interestSlug] ?? 0) + 1;
    }
    return map;
  }, [blueprints]);

  // Featured first, then fill to four for the homepage rail.
  const featured = React.useMemo(() => {
    const f = blueprints.filter((b) => b.isFeatured);
    const rest = blueprints.filter((b) => !b.isFeatured);
    return [...f, ...rest].slice(0, 4);
  }, [blueprints]);

  const domains = React.useMemo(
    () =>
      INTEREST_DOMAINS.map((d) => ({
        ...d,
        interests: d.slugs
          .map((slug) => SAMPLE_INTERESTS.find((i) => i.slug === slug))
          .filter((i): i is (typeof SAMPLE_INTERESTS)[number] => !!i),
      })).filter((d) => d.interests.length > 0),
    [],
  );

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && <ScrollFix />}
      <SimpleLandingNav />

      {/* ── HERO ─────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroInner}>
          <Text style={styles.heroEyebrow}>DELIBERATE PRACTICE PLATFORM</Text>
          <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]}>
            Get measurably better at anything you practice.
          </Text>
          <Text style={styles.heroLede}>
            One model for every craft — organizations, groups, people, and timelines.
            Subscribe to a blueprint from a practitioner who's already walked the path,
            and work it step by step.
          </Text>

          <View style={styles.heroSearch}>
            <SearchBar />
          </View>

          <View style={[styles.heroCta, !isDesktop && styles.heroCtaMobile]}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => router.push('/marketplace' as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Browse the marketplace</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhostDark]}
              onPress={() => router.push('/institutions/pricing' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.btnGhostDarkText}>For organizations</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroFoot}>
            Free to start · blueprints from independent authors and growing
          </Text>
        </View>
      </View>

      {/* ── UNIVERSALITY PROOF ───────────────────────────── */}
      <View style={styles.proof}>
        <View style={styles.proofHead}>
          <Text style={styles.proofLbl}>ONE ENGINE, EVERY DOMAIN</Text>
          <Text style={[styles.h2, !isDesktop && styles.h2Mobile]}>
            The same structure, in your field's words
          </Text>
          <Text style={styles.proofSub}>
            Whether you're a nurse, a sailor, or learning to draw — the four tiers stay the
            same. Only the vocabulary changes.
          </Text>
        </View>
        <View style={[styles.proofGrid, isDesktop && styles.proofGridDesktop]}>
          {PROOF_CARDS.map((c) => (
            <View key={c.name} style={[styles.proofCard, isDesktop && styles.proofCardDesktop]}>
              <View style={styles.proofCardTop}>
                <View style={[styles.proofIc, { backgroundColor: c.color }]}>
                  <Ionicons name={`${c.icon}-outline` as any} size={18} color="#fff" />
                </View>
                <View>
                  <Text style={styles.proofCardName}>{c.name}</Text>
                  <Text style={styles.proofCardOrg}>{c.org}</Text>
                </View>
              </View>
              <View style={styles.proofRows}>
                {c.rows.map(([term, val], i) => (
                  <View
                    key={term}
                    style={[styles.prow, i === c.rows.length - 1 && styles.prowLast]}
                  >
                    <Text style={styles.prowTerm}>{term.toUpperCase()}</Text>
                    <Text style={styles.prowVal}>{val}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── BROWSE BY INTEREST ───────────────────────────── */}
      <View style={styles.browse}>
        <View style={[styles.browseHead, isDesktop && styles.browseHeadDesktop]}>
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.h2, !isDesktop && styles.h2Mobile]}>Browse by interest</Text>
            <Text style={styles.browseSub}>
              Each interest opens its marketplace — the blueprints, organizations, and people
              working in that field.
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/interests' as any)} activeOpacity={0.7}>
            <Text style={styles.browseAll}>{'View all interests →'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cat}>
          {domains.map((domain) => (
            <View key={domain.name} style={styles.catBlock}>
              <View style={styles.catTitleRow}>
                <View style={[styles.catDot, { backgroundColor: domain.color }]} />
                <Text style={[styles.catTitle, { color: domain.color }]}>
                  {domain.name.toUpperCase()}
                </Text>
              </View>
              <View style={[styles.catRow, isDesktop && styles.catRowDesktop]}>
                {domain.interests.map((interest) => {
                  const orgCount = interest.organizations.length;
                  const bpCount = bpCountBySlug[interest.slug] ?? 0;
                  const leadOrgs = interest.organizations
                    .slice(0, 2)
                    .map((o) => o.name)
                    .join(' · ');
                  const moreOrgs = orgCount > 2 ? ` +${orgCount - 2}` : '';
                  return (
                    <TouchableOpacity
                      key={interest.slug}
                      style={[styles.icard, isDesktop && styles.icardDesktop]}
                      onPress={() => router.push(`/${interest.slug}` as any)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.ihead}>
                        <View style={[styles.iic, { backgroundColor: interest.color }]}>
                          <Ionicons
                            name={`${interest.icon}-outline` as any}
                            size={20}
                            color="#fff"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.iname}>{interest.name}</Text>
                          {leadOrgs ? (
                            <Text style={styles.istat} numberOfLines={1}>
                              {leadOrgs}
                              {moreOrgs}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.ifoot}>
                        <View style={styles.ipills}>
                          {bpCount > 0 ? (
                            <View style={styles.pill}>
                              <Text style={styles.pillText}>
                                {bpCount} blueprint{bpCount === 1 ? '' : 's'}
                              </Text>
                            </View>
                          ) : null}
                          {orgCount > 0 ? (
                            <View style={styles.pill}>
                              <Text style={styles.pillText}>
                                {orgCount} org{orgCount === 1 ? '' : 's'}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.iexp, { color: interest.color }]}>
                          {'Open →'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── FEATURED MARKETPLACE BLUEPRINTS ──────────────── */}
      {featured.length > 0 ? (
        <View style={styles.feat}>
          <View style={styles.featHead}>
            <Text style={styles.featLbl}>FROM THE MARKETPLACE</Text>
            <Text style={[styles.h2, !isDesktop && styles.h2Mobile]}>Featured blueprints</Text>
            <Text style={styles.featSub}>
              Practical, step-by-step paths authored by practitioners. Subscribe
              month-to-month — 70% routes to the author via Stripe.
            </Text>
          </View>
          <View style={[styles.bpGrid, isDesktop && styles.bpGridDesktop]}>
            {featured.map((bp) => (
              <BlueprintCard key={bp.id} bp={bp} isDesktop={isDesktop} />
            ))}
          </View>
        </View>
      ) : null}

      {/* ── PRICING TEASER ───────────────────────────────── */}
      <View style={styles.priceBand}>
        <View style={styles.pbHead}>
          <Text style={[styles.h2Light, !isDesktop && styles.h2Mobile]}>
            Two things you can pay for — kept separate
          </Text>
          <Text style={styles.pbSub}>
            The platform plan powers your tools. Blueprint subscriptions pay the authors. They
            never get confused.
          </Text>
        </View>
        <View style={[styles.pbTwo, isDesktop && styles.pbTwoDesktop]}>
          <View style={styles.pbCard}>
            <View style={styles.pbCardHead}>
              <Ionicons name="rocket-outline" size={18} color="#7FA8FF" />
              <Text style={styles.pbCardTitle}>Your BetterAt plan</Text>
            </View>
            <Text style={styles.pbCardSub}>Free · Plus $9/mo · Pro $29/mo</Text>
            {['Unlimited interests & steps', 'AI insights, capture & the Telegram assistant', 'Atlas, analytics, offline'].map((l) => (
              <View key={l} style={styles.pbLine}>
                <Ionicons name="checkmark" size={16} color="#7FA8FF" />
                <Text style={styles.pbLineText}>{l}</Text>
              </View>
            ))}
            <Text style={styles.pbFoot}>Billed by BetterAt. Powers the app, not the content.</Text>
          </View>
          <View style={styles.pbCard}>
            <View style={styles.pbCardHead}>
              <Ionicons name="storefront-outline" size={18} color="#7FA8FF" />
              <Text style={styles.pbCardTitle}>Blueprint subscriptions</Text>
            </View>
            <Text style={styles.pbCardSub}>Set by each author · $5–$24/mo</Text>
            {['Subscribe per blueprint, month-to-month', 'Steps land in your timeline; cancel anytime', '70% to the author via Stripe, 30% platform'].map((l) => (
              <View key={l} style={styles.pbLine}>
                <Ionicons name="checkmark" size={16} color="#7FA8FF" />
                <Text style={styles.pbLineText}>{l}</Text>
              </View>
            ))}
            <Text style={styles.pbFoot}>Billed through the author's Stripe Connect account.</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/pricing' as any)} activeOpacity={0.7}>
          <Text style={styles.splitNote}>{'See full individual and institutional pricing →'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── ORG BAND ─────────────────────────────────────── */}
      <View style={styles.orgBand}>
        <View style={[styles.orgInner, isDesktop && styles.orgInnerDesktop]}>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.orgTitle}>Run a school, club, or program?</Text>
            <Text style={styles.orgCopy}>
              Give students, faculty, or members a Pro seat under one bill — plus a member
              dashboard, usage analytics, and SSO. Publish your own blueprints to your cohort.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => router.push('/institutions/pricing' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>View institutional plans</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <View style={styles.foot}>
        <Text style={styles.footBrand}>BetterAt</Text>
        <Text style={styles.footLinks}>Interests · Marketplace · Pricing · For organizations · © 2026</Text>
      </View>
    </View>
  );
}

function BlueprintCard({ bp, isDesktop }: { bp: MarketplaceBlueprint; isDesktop: boolean }) {
  const tone = authorToneColor(bp.authorTone);
  return (
    <TouchableOpacity
      style={[styles.bp, isDesktop && styles.bpDesktop]}
      onPress={() => router.push(`/marketplace/${bp.id}` as any)}
      activeOpacity={0.85}
    >
      <View style={[styles.bpCover, { backgroundColor: tone }]}>
        {bp.isFeatured ? (
          <View style={styles.bpTag}>
            <Ionicons name="sparkles" size={11} color="#fff" />
            <Text style={styles.bpTagText}>Featured</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.bpBody}>
        <Text style={styles.bpTitle}>{bp.title}</Text>
        <View style={styles.bpAuthor}>
          <View style={[styles.bpAvi, { backgroundColor: tone }]}>
            <Text style={styles.bpAviText}>{bp.authorInitials}</Text>
          </View>
          <Text style={styles.bpAuthorName} numberOfLines={1}>
            {bp.authorName}
            {bp.orgName ? ` · ${bp.orgName}` : ''}
          </Text>
        </View>
        {bp.description ? (
          <Text style={styles.bpDesc} numberOfLines={3}>
            {bp.description}
          </Text>
        ) : null}
        <View style={styles.bpMeta}>
          {bp.ratingCount > 0 ? (
            <View style={styles.bpMetaItem}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.bpMetaText}>
                {(bp.ratingAvg ?? 0).toFixed(1)} ({bp.ratingCount})
              </Text>
            </View>
          ) : (
            <View style={styles.bpMetaItem}>
              <Ionicons name="sparkles-outline" size={12} color={INK4} />
              <Text style={styles.bpMetaText}>Be the first to try this</Text>
            </View>
          )}
          {bp.activeSubscriberCount > 0 ? (
            <View style={styles.bpMetaItem}>
              <Ionicons name="people-outline" size={12} color={INK4} />
              <Text style={styles.bpMetaText}>{bp.activeSubscriberCount} subscribers</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.bpFoot}>
        <Text style={styles.bpPrice}>{formatPrice(bp.pricePerSeatCents, bp.billingCadence)}</Text>
        <View style={styles.bpFootRight}>
          {bp.trialDays > 0 && bp.billingCadence !== 'one_time' ? (
            <Text style={styles.bpTrial}>{bp.trialDays}-day trial</Text>
          ) : null}
          <View style={[styles.btn, styles.btnPrimary, styles.btnSm]}>
            <Text style={styles.btnPrimaryText}>Subscribe</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0 4px 16px rgba(20,22,26,0.05)' } as any,
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // shared headings
  h2: { fontSize: 32, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  h2Light: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.6, textAlign: 'center' },
  h2Mobile: { fontSize: 24 },

  // buttons
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  btnSm: { paddingVertical: 9, paddingHorizontal: 14 },
  btnPrimary: { backgroundColor: BLUE },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnGhostDark: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.25)' },
  btnGhostDarkText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // hero
  hero: { backgroundColor: HERO, paddingTop: 132, paddingBottom: 80, paddingHorizontal: 24 },
  heroInner: { maxWidth: 720, width: '100%', alignSelf: 'center', alignItems: 'center', gap: 0 },
  heroEyebrow: {
    fontSize: 12.5,
    letterSpacing: 3,
    color: '#7FA8FF',
    fontWeight: '700',
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 46,
    marginTop: 20,
  },
  heroTitleDesktop: { fontSize: 60, lineHeight: 64, letterSpacing: -2 },
  heroLede: {
    fontSize: 18,
    lineHeight: 29,
    color: '#AFB4BF',
    textAlign: 'center',
    maxWidth: 640,
    marginTop: 22,
  },
  heroSearch: { width: '100%', maxWidth: 580, marginTop: 32 },
  heroCta: { flexDirection: 'row', gap: 12, marginTop: 22 },
  heroCtaMobile: { flexDirection: 'column', alignSelf: 'stretch', maxWidth: 580 },
  heroFoot: { marginTop: 28, fontSize: 13, color: '#80868F', textAlign: 'center' },

  // universality proof
  proof: { backgroundColor: '#fff', paddingVertical: 72, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: LINE2 },
  proofHead: { maxWidth: 760, alignSelf: 'center', alignItems: 'center', gap: 10 },
  proofLbl: { fontSize: 12.5, letterSpacing: 2.4, color: BLUE, fontWeight: '700' },
  proofSub: { fontSize: 16.5, color: INK2, textAlign: 'center', lineHeight: 26 },
  proofGrid: { maxWidth: 1060, alignSelf: 'center', width: '100%', gap: 18, marginTop: 40 },
  proofGridDesktop: { flexDirection: 'row' },
  proofCard: { borderWidth: 1, borderColor: LINE, borderRadius: 16, backgroundColor: PAPER2, overflow: 'hidden' },
  proofCardDesktop: { flex: 1 },
  proofCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: LINE },
  proofIc: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  proofCardName: { fontSize: 15, fontWeight: '700', color: INK },
  proofCardOrg: { fontSize: 12, color: INK3 },
  proofRows: { paddingHorizontal: 18, paddingBottom: 8, paddingTop: 2 },
  prow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: LINE, borderStyle: 'dashed' },
  prowLast: { borderBottomWidth: 0 },
  prowTerm: { fontSize: 11, letterSpacing: 0.6, color: INK4, fontWeight: '600' },
  prowVal: { fontSize: 13.5, fontWeight: '700', color: INK, textAlign: 'right' },

  // browse by interest
  browse: { backgroundColor: PAPER2, paddingVertical: 72, paddingHorizontal: 24 },
  browseHead: { maxWidth: 1060, alignSelf: 'center', width: '100%', gap: 12 },
  browseHeadDesktop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  browseSub: { fontSize: 15, color: INK2, marginTop: 6, maxWidth: 520, lineHeight: 22 },
  browseAll: { fontSize: 14, color: BLUE, fontWeight: '700' },
  cat: { maxWidth: 1060, alignSelf: 'center', width: '100%', marginTop: 34, gap: 26 },
  catBlock: { gap: 14 },
  catTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catDot: { width: 9, height: 9, borderRadius: 5 },
  catTitle: { fontSize: 12, letterSpacing: 1.2, fontWeight: '700' },
  catRow: { gap: 14 },
  catRowDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  icard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    padding: 18,
    gap: 14,
    ...(CARD_SHADOW ?? {}),
  },
  icardDesktop: { flexGrow: 1, flexBasis: 300, maxWidth: '33%' as any },
  ihead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iic: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  iname: { fontSize: 16.5, fontWeight: '700', color: INK },
  istat: { fontSize: 12.5, color: INK3, marginTop: 2 },
  ifoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE2, paddingTop: 12 },
  ipills: { flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap' },
  pill: { backgroundColor: PAPER3, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 },
  pillText: { fontSize: 11, fontWeight: '600', color: INK2 },
  iexp: { fontSize: 13, fontWeight: '700' },

  // featured blueprints
  feat: { backgroundColor: '#fff', paddingVertical: 72, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: LINE2 },
  featHead: { maxWidth: 1060, alignSelf: 'center', alignItems: 'center', gap: 8 },
  featLbl: { fontSize: 12.5, letterSpacing: 2.4, color: BLUE, fontWeight: '700' },
  featSub: { fontSize: 15.5, color: INK2, textAlign: 'center', maxWidth: 560, lineHeight: 24 },
  bpGrid: { maxWidth: 1060, alignSelf: 'center', width: '100%', gap: 18, marginTop: 36 },
  bpGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  bp: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
    ...(CARD_SHADOW ?? {}),
  },
  bpDesktop: { flexGrow: 1, flexBasis: 460, maxWidth: '49%' as any },
  bpCover: { height: 110, padding: 16, justifyContent: 'flex-start' },
  bpTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 9 },
  bpTagText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  bpBody: { padding: 18, gap: 10 },
  bpTitle: { fontSize: 18, fontWeight: '700', color: INK, letterSpacing: -0.2 },
  bpAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bpAvi: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bpAviText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bpAuthorName: { fontSize: 13, color: INK2, flex: 1 },
  bpDesc: { fontSize: 13.5, color: INK3, lineHeight: 20 },
  bpMeta: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  bpMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bpMetaText: { fontSize: 12.5, color: INK3 },
  bpFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE2, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: PAPER2 },
  bpPrice: { fontSize: 18, fontWeight: '800', color: INK },
  bpFootRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bpTrial: { fontSize: 12, color: INK3 },

  // pricing teaser
  priceBand: { backgroundColor: HERO, paddingVertical: 68, paddingHorizontal: 24 },
  pbHead: { maxWidth: 920, alignSelf: 'center', alignItems: 'center', gap: 10 },
  pbSub: { fontSize: 16, color: '#AFB4BF', textAlign: 'center', lineHeight: 24 },
  pbTwo: { maxWidth: 920, alignSelf: 'center', width: '100%', gap: 18, marginTop: 34 },
  pbTwoDesktop: { flexDirection: 'row' },
  pbCard: { flex: 1, backgroundColor: '#1E2027', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 },
  pbCardHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pbCardTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  pbCardSub: { fontSize: 13.5, color: '#9AA0AC', marginTop: 4, marginBottom: 12 },
  pbLine: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  pbLineText: { fontSize: 14, color: '#D6D9E0', flex: 1 },
  pbFoot: { fontSize: 12.5, color: '#80868F', marginTop: 16 },
  splitNote: { maxWidth: 920, alignSelf: 'center', textAlign: 'center', fontSize: 13, color: '#9AC0FF', marginTop: 18, ...Platform.select({ web: { cursor: 'pointer' } as any }) },

  // org band
  orgBand: { backgroundColor: '#fff', paddingVertical: 56, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: LINE2 },
  orgInner: { maxWidth: 1060, alignSelf: 'center', width: '100%', backgroundColor: PAPER3, borderWidth: 1, borderColor: LINE, borderRadius: 18, padding: 30, gap: 20 },
  orgInnerDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orgTitle: { fontSize: 26, fontWeight: '800', color: INK, marginBottom: 6, letterSpacing: -0.4 },
  orgCopy: { fontSize: 15, color: INK2, maxWidth: 560, lineHeight: 23 },

  // footer
  foot: { backgroundColor: HERO, paddingVertical: 36, paddingHorizontal: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  footBrand: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footLinks: { color: '#9AA0AC', fontSize: 13 },
});
