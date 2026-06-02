import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SimpleLandingNav } from './SimpleLandingNav';
import { ScrollFix } from './ScrollFix';
import { OrganizationPreviewCard } from './OrganizationPreviewCard';
import { ProgramCard } from './ProgramCard';
import { AffiliationGroup } from './AffiliationGroup';
import { IndependentPractitionersSection } from './IndependentPractitionersSection';
import { SubscribeCTA } from './SubscribeCTA';
import { getInterest } from '@/lib/landing/sampleData';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { supabase } from '@/services/supabase';
import { useMarketplaceBlueprints } from '@/hooks/useMarketplaceBlueprints';
import type { BlueprintRecord } from '@/types/blueprint';

interface InterestBrowserPageProps {
  slug: string;
}

// ── Blueprint Timeline Row (mirrors PersonTimelineRow for real blueprint data) ──

interface BlueprintTimelineRowProps {
  blueprint: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    user_id: string;
    author_name?: string;
    author_bio?: string;
    access_level: string;
    price_cents: number | null;
    subscriber_count: number;
    steps: { id: string; title: string; status: string; sort_order: number }[];
  };
  accentColor: string;
}

function BlueprintTimelineRow({ blueprint, accentColor }: BlueprintTimelineRowProps) {
  const bp = blueprint;
  const authorDisplay = bp.author_name || 'Creator';
  const initials = authorDisplay
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const statusColor = (status: string) => {
    if (status === 'completed') return accentColor;
    if (status === 'in_progress') return accentColor;
    return '#E5E7EB';
  };

  const statusLabel = (status: string) => {
    if (status === 'completed') return 'DONE';
    if (status === 'in_progress') return 'NOW';
    return null;
  };

  const priceLabel = bp.access_level === 'paid' && bp.price_cents
    ? `$${(bp.price_cents / 100).toFixed(bp.price_cents % 100 === 0 ? 0 : 2)}`
    : null;

  return (
    <View style={bpRowStyles.container}>
      {/* Header: Blueprint title + price badge */}
      <TouchableOpacity
        style={bpRowStyles.header}
        onPress={() => router.push(`/blueprint/${bp.slug}` as any)}
        activeOpacity={0.7}
      >
        <View style={bpRowStyles.headerLeft}>
          <Text style={[bpRowStyles.blueprintTitle, { color: '#1F2937' }]} numberOfLines={1}>
            {bp.title}
          </Text>
          {priceLabel ? (
            <View style={[bpRowStyles.priceBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>
                {priceLabel}
              </Text>
            </View>
          ) : (
            <View style={[bpRowStyles.priceBadge, { backgroundColor: '#ECFDF5' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>Free</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: accentColor }}>View →</Text>
      </TouchableOpacity>

      {/* Author row */}
      <View style={bpRowStyles.authorRow}>
        <View style={[bpRowStyles.avatar, { backgroundColor: accentColor + '18' }]}>
          <Text style={[bpRowStyles.initials, { color: accentColor }]}>{initials}</Text>
        </View>
        <View style={bpRowStyles.nameColumn}>
          <Text style={bpRowStyles.name} numberOfLines={1}>{authorDisplay}</Text>
          {bp.author_bio ? (
            <Text style={bpRowStyles.role} numberOfLines={1}>{bp.author_bio}</Text>
          ) : null}
        </View>
        {bp.subscriber_count > 0 && (
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
            {bp.subscriber_count} {bp.subscriber_count === 1 ? 'subscriber' : 'subscribers'}
          </Text>
        )}
      </View>

      {/* Step cards band */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={bpRowStyles.timeline}
        contentContainerStyle={bpRowStyles.timelineContent}
      >
        {bp.steps.map((step) => {
          const label = statusLabel(step.status);
          const isUpcoming = !label;
          return (
            <TouchableOpacity
              key={step.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/blueprint/${bp.slug}` as any)}
              style={[
                bpRowStyles.stepCard,
                {
                  borderColor: step.status === 'in_progress'
                    ? accentColor
                    : step.status === 'completed'
                      ? accentColor + '35'
                      : '#E5E7EB',
                  borderWidth: step.status === 'in_progress' ? 2 : 1,
                  backgroundColor: step.status === 'completed'
                    ? accentColor + '06'
                    : '#FFFFFF',
                },
              ]}
            >
              {label ? (
                <View style={[bpRowStyles.badge, { backgroundColor: statusColor(step.status) }]}>
                  <Text style={bpRowStyles.badgeText}>{label}</Text>
                </View>
              ) : (
                <View style={bpRowStyles.badge}>
                  <View style={bpRowStyles.badgeLine} />
                </View>
              )}
              <Text
                style={[bpRowStyles.stepLabel, { color: isUpcoming ? '#9CA3AF' : '#374151' }]}
                numberOfLines={2}
              >
                {step.title}
              </Text>
            </TouchableOpacity>
          );
        })}
        {bp.steps.length === 0 && (
          <Text style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', paddingVertical: 16 }}>
            No steps curated yet
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const bpRowStyles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 11,
    fontWeight: '700',
  },
  nameColumn: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  role: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
    lineHeight: 14,
  },
  timeline: {
    ...Platform.select({
      web: {
        overflowX: 'auto',
        overflowY: 'hidden',
      } as any,
    }),
  },
  timelineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
  },
  stepCard: {
    width: 90,
    height: 56,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      } as any,
    }),
  },
  badge: {
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginBottom: 2,
    minWidth: 28,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  badgeText: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  badgeLine: {
    width: 20,
    height: 2,
    backgroundColor: '#D1D5DB',
    borderRadius: 1,
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
  blueprintTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  priceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
});

export function InterestBrowserPage({ slug }: InterestBrowserPageProps) {
  const interest = getInterest(slug);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const { userInterests, allInterests, addInterest, switchInterest, currentInterest, refreshInterests, getDomainForInterest } = useInterest();
  const { user, isGuest } = useAuth();
  const isLoggedIn = !!user && !isGuest;
  const isInUserInterests = userInterests.some((i) => i.slug === slug);
  const existsInDb = allInterests.some((i) => i.slug === slug);
  const isCurrent = currentInterest?.slug === slug;

  // Resolve parent domain for breadcrumb
  const dbInterest = allInterests.find((i) => i.slug === slug);
  const parentDomain = dbInterest ? getDomainForInterest(dbInterest.id) : null;

  // Real subscribable plans from the authored-blueprint catalog (System B / Stripe),
  // scoped to this interest. This is the catalog the marketplace + checkout read.
  const { blueprints: marketPlans } = useMarketplaceBlueprints(dbInterest?.id ?? null);
  const interestPlans = marketPlans.filter((p) => !dbInterest || p.interestSlug === slug);

  // Fetch real DB orgs for this interest (not just sample data)
  const [extraOrgs, setExtraOrgs] = useState<{ slug: string; name: string; groupLabel: string; groups: any[] }[]>([]);
  useEffect(() => {
    if (!interest) return;
    supabase
      .from('organizations')
      .select('name, slug')
      .eq('interest_slug', slug)
      .eq('is_active', true)
      .then(({ data }) => {
        if (!data) return;
        const sampleSlugs = new Set(interest.organizations.map((o) => o.slug));
        const extras = data
          .filter((o) => !sampleSlugs.has(o.slug))
          .map((o) => ({ slug: o.slug, name: o.name, groupLabel: 'Programs' as const, groups: [] }));
        setExtraOrgs(extras);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, interest?.name]);

  // Merged organizations = sample + real DB orgs
  const mergedOrganizations = interest
    ? [...interest.organizations, ...extraOrgs]
    : [];

  // Fetch published blueprints for all orgs in this interest (single query, no per-card fetching)
  const [orgBlueprintsMap, setOrgBlueprintsMap] = useState<Record<string, BlueprintRecord[]>>({});
  useEffect(() => {
    if (!interest) return;
    let cancelled = false;

    const loadOrgBlueprints = async () => {
      try {
        // Look up org IDs by matching all org slugs (sample + real) to DB orgs
        const orgSlugs = mergedOrganizations.map((o) => o.slug);
        const { data: dbOrgs } = await supabase
          .from('organizations')
          .select('id, slug')
          .in('slug', orgSlugs)
          .eq('is_active', true);

        if (cancelled || !dbOrgs || dbOrgs.length === 0) return;

        // Use the RPC to get counts (bypasses RLS for org_members blueprints)
        // Then also fetch any public blueprints the user CAN see
        const orgIds = dbOrgs.map((o: any) => o.id);
        const { data: blueprints } = await supabase
          .from('timeline_blueprints')
          .select('*')
          .in('organization_id', orgIds)
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (cancelled) return;

        // Also get counts via RPC for blueprints hidden by RLS
        const countPromises = dbOrgs.map(async (org: any) => {
          const { data } = await supabase.rpc('get_org_blueprint_count', { org_uuid: org.id });
          return { slug: org.slug, count: typeof data === 'number' ? data : 0 };
        });
        const counts = await Promise.all(countPromises);

        if (cancelled) return;

        // Group blueprints by org slug
        const slugById = new Map(dbOrgs.map((o: any) => [o.id, o.slug]));
        const map: Record<string, BlueprintRecord[]> = {};
        for (const bp of (blueprints ?? []) as BlueprintRecord[]) {
          const orgSlug = slugById.get(bp.organization_id ?? '');
          if (orgSlug) {
            if (!map[orgSlug]) map[orgSlug] = [];
            map[orgSlug].push(bp);
          }
        }

        // For orgs with counts but no visible blueprints, add a placeholder
        for (const { slug: orgSlug, count } of counts) {
          if (count > 0 && (!map[orgSlug] || map[orgSlug].length === 0)) {
            // Store count as a fake blueprint record for the teaser
            map[orgSlug] = Array.from({ length: count }, (_, i) => ({
              id: `hidden-${orgSlug}-${i}`,
              user_id: '',
              interest_id: '',
              slug: '',
              title: '',
              description: null,
              cover_image_url: null,
              is_published: true,
              subscriber_count: 0,
              organization_id: null,
              program_id: null,
              access_level: 'org_members' as const,
              created_at: '',
              updated_at: '',
            }));
          }
        }

        setOrgBlueprintsMap(map);
      } catch (err) {
        console.error('[InterestBrowserPage] Error loading org blueprints:', err);
      }
    };

    loadOrgBlueprints();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interest?.name, extraOrgs.length]);

  // Fetch community (self-published) blueprints — no organization_id
  // Enriched with author profile + curated step titles for timeline display
  interface CommunityBlueprintStep { id: string; title: string; status: string; sort_order: number }
  interface CommunityBlueprintData extends BlueprintRecord {
    author_name?: string;
    author_bio?: string;
    step_count: number;
    steps: CommunityBlueprintStep[];
  }
  const [communityBlueprints, setCommunityBlueprints] = useState<CommunityBlueprintData[]>([]);
  useEffect(() => {
    if (!dbInterest) return;
    let cancelled = false;
    (async () => {
      const { data: bps } = await supabase
        .from('timeline_blueprints')
        .select('*')
        .eq('interest_id', dbInterest.id)
        .eq('is_published', true)
        .is('organization_id', null)
        .order('subscriber_count', { ascending: false });
      if (cancelled || !bps?.length) return;

      // Batch-fetch author profiles
      const userIds = [...new Set(bps.map((b: any) => b.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, bio')
        .in('id', userIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      // Batch-fetch curated steps with titles and statuses
      const bpIds = bps.map((b: any) => b.id);
      const { data: bpStepRows } = await supabase
        .from('blueprint_steps')
        .select('blueprint_id, step_id, sort_order, timeline_steps!inner(id, title, status)')
        .in('blueprint_id', bpIds)
        .order('sort_order', { ascending: true });

      const stepsMap = new Map<string, CommunityBlueprintStep[]>();
      for (const row of (bpStepRows ?? [])) {
        const ts = (row as any).timeline_steps;
        if (!ts) continue;
        const arr = stepsMap.get(row.blueprint_id) ?? [];
        arr.push({ id: ts.id, title: ts.title, status: ts.status, sort_order: row.sort_order });
        stepsMap.set(row.blueprint_id, arr);
      }

      if (!cancelled) {
        setCommunityBlueprints(bps.map((b: any) => {
          const profile = profileMap.get(b.user_id);
          const steps = stepsMap.get(b.id) ?? [];
          return {
            ...b,
            author_name: profile?.full_name ?? undefined,
            author_bio: profile?.bio ?? undefined,
            step_count: steps.length,
            steps,
          };
        }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbInterest?.id]);

  const handleAddInterest = async () => {
    if (!isLoggedIn) {
      router.push({ pathname: '/(auth)/signup', params: { interest: slug } } as any);
      return;
    }
    try {
      if (existsInDb) {
        // If hidden, un-hide it first
        if (!isInUserInterests) {
          await addInterest(slug);
        }
        await switchInterest(slug);
        showAlert('Interest Active', `${interest?.name ?? slug} is now your active interest.`);
      } else {
        // Interest exists in sample data but not yet in DB — create it
        const { error } = await supabase
          .from('interests')
          .insert({
            slug,
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

        // Refresh interests from DB, then switch
        await refreshInterests();
        // Small delay for the query to propagate
        setTimeout(async () => {
          try {
            await switchInterest(slug);
          } catch {
            // May not be available yet in the provider cache
          }
        }, 500);
        showAlert('Interest Added', `${interest?.name ?? slug} has been added and is now active.`);
      }
    } catch (err) {
      console.warn('[InterestBrowserPage] handleAddInterest error:', err);
      showAlert('Error', 'Could not add interest. Please try again.');
    }
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

  const content = (
    <>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: interest.color }]}>
        <View style={styles.heroContent}>
          {/* Breadcrumbs */}
          <View style={styles.breadcrumbs}>
            <TouchableOpacity onPress={() => router.push('/' as any)}>
              <Text style={styles.breadcrumbLink}>BetterAt</Text>
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.5)" />
            {parentDomain && (
              <>
                <TouchableOpacity onPress={() => router.push('/interests' as any)}>
                  <Text style={styles.breadcrumbLink}>{parentDomain.name}</Text>
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.5)" />
              </>
            )}
            <Text style={styles.breadcrumbCurrent}>{interest.name}</Text>
          </View>

          <Text style={styles.interestName}>{interest.name}</Text>
          <Text style={styles.interestDesc}>
            Explore programs, organizations, and see how people progress through{' '}
            {interest.name.toLowerCase()} with structured timelines.
          </Text>
          {isLoggedIn && (
            <TouchableOpacity
              style={[
                styles.addInterestBtn,
                isCurrent && styles.addInterestBtnAdded,
              ]}
              onPress={isCurrent ? undefined : handleAddInterest}
              activeOpacity={isCurrent ? 1 : 0.7}
              disabled={isCurrent}
            >
              <Ionicons
                name={isCurrent ? 'checkmark-circle' : isInUserInterests ? 'swap-horizontal' : 'add-circle-outline'}
                size={18}
                color={isCurrent ? interest.color : '#FFFFFF'}
              />
              <Text style={[styles.addInterestBtnText, isCurrent && { color: interest.color }]}>
                {isCurrent
                  ? 'Active Interest'
                  : isInUserInterests
                    ? `Switch to ${interest.name}`
                    : `Add ${interest.name} to My Interests`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.body, isDesktop && styles.bodyDesktop]}>
        {/* Plans — real subscribable catalog (System B / Stripe), scoped to this interest */}
        {interestPlans.length > 0 && (
          <View style={styles.section}>
            <View style={styles.plansHeaderRow}>
              <Text style={styles.sectionTitle}>Plans</Text>
              <TouchableOpacity onPress={() => router.push(`/marketplace?interest=${slug}` as any)}>
                <Text style={[styles.seeAllLink, { color: interest.color }]}>See all plans →</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.planGrid, isDesktop && styles.planGridDesktop]}>
              {interestPlans.map((plan) => {
                const priceLabel = plan.pricePerSeatCents > 0
                  ? `$${(plan.pricePerSeatCents / 100).toFixed(plan.pricePerSeatCents % 100 === 0 ? 0 : 2)}${plan.billingCadence === 'monthly' ? '/mo' : plan.billingCadence === 'annual' ? '/yr' : ''}`
                  : 'Free';
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[styles.planCard, isDesktop && styles.planCardDesktop]}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/marketplace/${plan.id}` as any)}
                  >
                    <View style={styles.planCardHeader}>
                      <Text style={styles.planCardTitle} numberOfLines={2}>{plan.title}</Text>
                      <View style={[styles.priceBadge, { backgroundColor: plan.pricePerSeatCents > 0 ? '#FEF3C7' : '#ECFDF5' }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: plan.pricePerSeatCents > 0 ? '#92400E' : '#059669' }}>
                          {priceLabel}
                        </Text>
                      </View>
                    </View>
                    {plan.description ? (
                      <Text style={styles.planCardDesc}>
                        {plan.description.length > 72 ? `${plan.description.slice(0, 72).trimEnd()}…` : plan.description}
                      </Text>
                    ) : null}
                    <View style={styles.planCardFooter}>
                      <View style={[styles.avatar, { backgroundColor: interest.color + '18' }]}>
                        <Text style={[styles.initials, { color: interest.color }]}>{plan.authorInitials}</Text>
                      </View>
                      <Text style={styles.planAuthorName} numberOfLines={1}>{plan.authorName}</Text>
                      {plan.activeSubscriberCount > 0 && (
                        <Text style={styles.planSubscribers}>
                          {plan.activeSubscriberCount} {plan.activeSubscriberCount === 1 ? 'subscriber' : 'subscribers'}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Programs & Offerings (only when enriched data exists) */}
        {interest.programs && interest.programs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Programs & Offerings</Text>
            <View style={styles.programGrid}>
              {interest.programs.map((program) => (
                <ProgramCard
                  key={program.slug}
                  program={program}
                  organizations={mergedOrganizations}
                  interestSlug={slug}
                  accentColor={interest.color}
                />
              ))}
            </View>
          </View>
        )}

        {/* Organizations — grouped by affiliation if available, flat grid otherwise */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organizations</Text>
          {interest.affiliations && interest.affiliations.length > 0 ? (
            <>
              {interest.affiliations.map((aff) => (
                <AffiliationGroup
                  key={aff.name}
                  affiliation={aff}
                  organizations={mergedOrganizations}
                  interestSlug={slug}
                  accentColor={interest.color}
                />
              ))}
              {/* Render unaffiliated orgs standalone */}
              {(() => {
                const affiliatedSlugs = new Set(interest.affiliations.flatMap((a) => a.orgSlugs));
                const unaffiliated = mergedOrganizations.filter((o) => !affiliatedSlugs.has(o.slug));
                if (unaffiliated.length === 0) return null;
                return (
                  <View style={[styles.orgGrid, isDesktop && styles.orgGridDesktop]}>
                    {unaffiliated.map((org) => (
                      <OrganizationPreviewCard
                        key={org.slug}
                        organization={org}
                        interestSlug={slug}
                        accentColor={interest.color}
                        blueprints={orgBlueprintsMap[org.slug]}
                      />
                    ))}
                  </View>
                );
              })()}
            </>
          ) : (
            <View style={[styles.orgGrid, isDesktop && styles.orgGridDesktop]}>
              {mergedOrganizations.map((org) => (
                <OrganizationPreviewCard
                  key={org.slug}
                  organization={org}
                  interestSlug={slug}
                  accentColor={interest.color}
                  blueprints={orgBlueprintsMap[org.slug]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Independent Practitioners */}
        {interest.independentPractitioners && interest.independentPractitioners.length > 0 && (
          <IndependentPractitionersSection
            people={interest.independentPractitioners}
            interestSlug={slug}
            interestName={interest.name}
            accentColor={interest.color}
          />
        )}

        {/* Community Blueprints — self-published, no org */}
        {communityBlueprints.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Community Blueprints</Text>
            <Text style={styles.sectionSubtitle}>
              Published by independent creators in {interest.name.toLowerCase()}
            </Text>
            <View style={styles.communityCard2}>
              {communityBlueprints.map((bp) => (
                <BlueprintTimelineRow
                  key={bp.id}
                  blueprint={bp}
                  accentColor={interest.color}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      <SubscribeCTA accentColor={interest.color} interestSlug={slug} />
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
    <ScrollView style={styles.container}>
      <SimpleLandingNav currentInterestSlug={slug} />
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  hero: {
    paddingTop: 100,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  heroContent: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  breadcrumbLink: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  breadcrumbCurrent: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  interestName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  interestDesc: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    maxWidth: 600,
    lineHeight: 26,
  },
  body: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    padding: 24,
  },
  bodyDesktop: {
    padding: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
  },
  programGrid: {
    gap: 20,
  },
  plansHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  seeAllLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  planGrid: {
    gap: 16,
  },
  planGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    gap: 10,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      } as any,
    }),
  },
  planCardDesktop: {
    width: 320,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  planCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  planCardDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  planCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planAuthorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  planSubscribers: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  orgGrid: {
    gap: 20,
  },
  orgGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  addInterestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  addInterestBtnAdded: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  addInterestBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  notFoundText: {
    fontSize: 18,
    color: '#6B7280',
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: -12,
    marginBottom: 16,
  },
  communityGrid: {
    gap: 16,
  },
  communityCard2: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      } as any,
    }),
  },
  communityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  communityCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  communityCardBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  communityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  communitySubscribers: {
    fontSize: 12,
    color: '#6B7280',
  },
  communityCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  communityCardDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  communityCardFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  communityViewLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
