/**
 * GlobalSearchService
 *
 * Runs parallel ilike queries against regattas, profiles, sailing_venues,
 * and boat_classes. Returns categorised results for the search overlay.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { organizationDiscoveryService } from '@/services/OrganizationDiscoveryService';
import { fetchAssignedBlueprints } from '@/services/CohortBlueprintService';

const logger = createLogger('GlobalSearchService');

// ── Result types ──────────────────────────────────────────────────────

export interface RaceSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  raceDate?: string;
  status?: string;
}

export interface SailorSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  avatarEmoji?: string;
  avatarColor?: string;
}

export interface VenueSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  venueType?: string;
}

export interface BoatClassSearchResult {
  id: string;
  title: string;
}

export interface LibraryPlanSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  /** Override route. Institutional plans open the assigned-blueprint detail. */
  route?: string;
}

export interface LibraryConceptSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
}

export interface LibraryResourceSearchResult {
  id: string;
  title: string;
  subtitle?: string;
}

export interface OrganizationSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  slug?: string | null;
}

export interface GroupSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  route: string;
}

export interface SearchResults {
  races: RaceSearchResult[];
  sailors: SailorSearchResult[];
  venues: VenueSearchResult[];
  boatClasses: BoatClassSearchResult[];
  plans: LibraryPlanSearchResult[];
  concepts: LibraryConceptSearchResult[];
  resources: LibraryResourceSearchResult[];
  organizations: OrganizationSearchResult[];
  groups: GroupSearchResult[];
}

const EMPTY_RESULTS: SearchResults = {
  races: [],
  sailors: [],
  venues: [],
  boatClasses: [],
  plans: [],
  concepts: [],
  resources: [],
  organizations: [],
  groups: [],
};

// ── Service ───────────────────────────────────────────────────────────

export class GlobalSearchService {
  static async search(query: string, userId: string): Promise<SearchResults> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return EMPTY_RESULTS;

    const pattern = `%${trimmed}%`;

    const [
      racesResult,
      profilesResult,
      venuesResult,
      boatClassesResult,
      plansResult,
      institutionalPlansResult,
      marketplacePlansResult,
      conceptsResult,
      resourcesResult,
      organizationsResult,
      groupsResult,
    ] =
      await Promise.allSettled([
        // Races (regattas table) – scoped to current user
        supabase
          .from('regattas')
          .select('id, name, start_date, status, metadata')
          .eq('created_by', userId)
          .ilike('name', pattern)
          .order('start_date', { ascending: false })
          .limit(5),

        // Profiles – all users
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .ilike('full_name', pattern)
          .limit(5),

        // Venues – name, country, or region
        supabase
          .from('sailing_venues')
          .select('id, name, country, region, venue_type')
          .or(
            `name.ilike.${pattern},country.ilike.${pattern},region.ilike.${pattern}`,
          )
          .limit(5),

        // Boat classes
        supabase
          .from('boat_classes')
          .select('id, name')
          .ilike('name', pattern)
          .limit(5),

        searchLibraryPlans(trimmed, userId),
        searchInstitutionalBlueprints(trimmed, userId),
        searchMarketplaceBlueprints(trimmed),
        searchLibraryConcepts(trimmed, userId),
        searchLibraryResources(trimmed, userId),
        searchOrganizations(trimmed),
        searchGroups(trimmed, userId),
      ]);

    // ── Races (from regattas) ───────────────────────────────────────
    const races: RaceSearchResult[] = [];
    if (racesResult.status === 'fulfilled') {
      const { data, error } = racesResult.value;
      if (error) logger.warn('Race search error:', error.message);
      (data ?? []).forEach((r: any) => {
        const venueName =
          r.metadata?.venue_name ?? r.metadata?.venue ?? undefined;
        races.push({
          id: r.id,
          title: r.name,
          subtitle: venueName,
          raceDate: r.start_date ?? undefined,
          status: r.status ?? undefined,
        });
      });
    }

    // ── Profiles → Sailors ──────────────────────────────────────────
    const sailors: SailorSearchResult[] = [];
    if (profilesResult.status === 'fulfilled') {
      const { data: profiles, error } = profilesResult.value;
      if (error) logger.warn('Profile search error:', error.message);

      if (profiles && profiles.length > 0) {
        const userIds = profiles.map((p: any) => p.id);
        const { data: sailorProfiles } = await supabase
          .from('sailor_profiles')
          .select('user_id, avatar_emoji, avatar_color')
          .in('user_id', userIds);

        const spMap: Record<string, { avatar_emoji?: string; avatar_color?: string }> = {};
        (sailorProfiles ?? []).forEach((sp: any) => {
          spMap[sp.user_id] = sp;
        });

        profiles.forEach((p: any) => {
          const sp = spMap[p.id];
          sailors.push({
            id: p.id,
            title: p.full_name,
            subtitle: p.email ?? undefined,
            avatarEmoji: sp?.avatar_emoji ?? undefined,
            avatarColor: sp?.avatar_color ?? undefined,
          });
        });
      }
    }

    // ── Venues ──────────────────────────────────────────────────────
    const venues: VenueSearchResult[] = [];
    if (venuesResult.status === 'fulfilled') {
      const { data, error } = venuesResult.value;
      if (error) logger.warn('Venue search error:', error.message);
      (data ?? []).forEach((v: any) => {
        const parts = [v.region, v.country].filter(Boolean);
        venues.push({
          id: v.id,
          title: v.name,
          subtitle: parts.length > 0 ? parts.join(', ') : undefined,
          venueType: v.venue_type ?? undefined,
        });
      });
    }

    // ── Boat classes ────────────────────────────────────────────────
    const boatClasses: BoatClassSearchResult[] = [];
    if (boatClassesResult.status === 'fulfilled') {
      const { data, error } = boatClassesResult.value;
      if (error) logger.warn('Boat class search error:', error.message);
      (data ?? []).forEach((bc: any) =>
        boatClasses.push({ id: bc.id, title: bc.name }),
      );
    }

    const subscribedPlans: LibraryPlanSearchResult[] =
      plansResult.status === 'fulfilled' ? plansResult.value : [];
    if (plansResult.status === 'rejected') {
      logger.warn('Library plan search error:', String(plansResult.reason));
    }

    const institutionalPlans: LibraryPlanSearchResult[] =
      institutionalPlansResult.status === 'fulfilled' ? institutionalPlansResult.value : [];
    if (institutionalPlansResult.status === 'rejected') {
      logger.warn('Institutional blueprint search error:', String(institutionalPlansResult.reason));
    }

    const marketplacePlans: LibraryPlanSearchResult[] =
      marketplacePlansResult.status === 'fulfilled' ? marketplacePlansResult.value : [];
    if (marketplacePlansResult.status === 'rejected') {
      logger.warn('Marketplace blueprint search error:', String(marketplacePlansResult.reason));
    }

    // Merge subscribed (System-A), assigned institutional, and discoverable
    // marketplace plans, deduped by id.
    const seenPlanIds = new Set<string>();
    const plans: LibraryPlanSearchResult[] = [];
    for (const p of [...subscribedPlans, ...institutionalPlans, ...marketplacePlans]) {
      if (seenPlanIds.has(p.id)) continue;
      seenPlanIds.add(p.id);
      plans.push(p);
    }

    const concepts: LibraryConceptSearchResult[] =
      conceptsResult.status === 'fulfilled' ? conceptsResult.value : [];
    if (conceptsResult.status === 'rejected') {
      logger.warn('Library concept search error:', String(conceptsResult.reason));
    }

    const resources: LibraryResourceSearchResult[] =
      resourcesResult.status === 'fulfilled' ? resourcesResult.value : [];
    if (resourcesResult.status === 'rejected') {
      logger.warn('Library resource search error:', String(resourcesResult.reason));
    }

    const organizations: OrganizationSearchResult[] =
      organizationsResult.status === 'fulfilled' ? organizationsResult.value : [];
    if (organizationsResult.status === 'rejected') {
      logger.warn('Organization search error:', String(organizationsResult.reason));
    }

    const groups: GroupSearchResult[] =
      groupsResult.status === 'fulfilled' ? groupsResult.value : [];
    if (groupsResult.status === 'rejected') {
      logger.warn('Group search error:', String(groupsResult.reason));
    }

    return {
      races,
      sailors,
      venues,
      boatClasses,
      plans,
      concepts,
      resources,
      organizations,
      groups,
    };
  }
}

function includesQuery(value: unknown, query: string): boolean {
  return String(value ?? '').toLowerCase().includes(query);
}

async function searchLibraryPlans(
  query: string,
  userId: string,
): Promise<LibraryPlanSearchResult[]> {
  const needle = query.toLowerCase();
  const { data: subs, error: subsError } = await supabase
    .from('blueprint_subscriptions')
    .select('blueprint_id')
    .eq('subscriber_id', userId)
    .limit(200);
  if (subsError) throw subsError;

  const blueprintIds = (subs ?? [])
    .map((row: any) => row.blueprint_id)
    .filter(Boolean);
  if (blueprintIds.length === 0) return [];

  const { data: blueprints, error: blueprintError } = await supabase
    .from('timeline_blueprints')
    .select('id, title, tagline')
    .in('id', blueprintIds)
    .limit(100);
  if (blueprintError) throw blueprintError;

  return (blueprints ?? [])
    .filter((bp: any) =>
      includesQuery(bp.title, needle) || includesQuery(bp.tagline, needle),
    )
    .slice(0, 5)
    .map((bp: any) => ({
      id: bp.id,
      title: bp.title,
      subtitle: bp.tagline ? `Plan · ${bp.tagline}` : 'Plan',
    }));
}

// Institutional blueprints assigned to the student through any of their
// cohorts (live, with steps). These live in public.blueprints — not
// timeline_blueprints — so the subscribed-plan query above never finds them.
// Routed to the assigned-blueprint detail, which the same data set resolves.
async function searchInstitutionalBlueprints(
  query: string,
  userId: string,
): Promise<LibraryPlanSearchResult[]> {
  const needle = query.toLowerCase();
  const assigned = await fetchAssignedBlueprints(userId, null);
  return assigned
    .filter(
      (b) => includesQuery(b.title, needle) || includesQuery(b.description, needle),
    )
    .slice(0, 5)
    .map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.orgName ? `Program · ${b.orgName}` : 'Program',
      route: `/blueprint/assigned/${b.id}`,
    }));
}

async function searchMarketplaceBlueprints(
  query: string,
): Promise<LibraryPlanSearchResult[]> {
  const needle = query.toLowerCase();
  const { data, error } = await supabase.rpc('list_marketplace_blueprints', {
    p_interest_id: null,
  });
  if (error) throw error;

  return ((data?.blueprints ?? []) as any[])
    .filter((bp: any) =>
      includesQuery(bp.title, needle)
      || includesQuery(bp.description, needle)
      || includesQuery(bp.author_name, needle)
      || includesQuery(bp.interest_name, needle),
    )
    .slice(0, 5)
    .map((bp: any) => {
      const price =
        Number(bp.price_per_seat_cents ?? 0) > 0
          ? 'Paid plan'
          : 'Free plan';
      const byline = bp.author_name ? ` · ${bp.author_name}` : '';
      return {
        id: bp.id,
        title: bp.title,
        subtitle: `${price}${byline}`,
        route: `/marketplace/${bp.id}`,
      };
    });
}

async function searchLibraryConcepts(
  query: string,
  userId: string,
): Promise<LibraryConceptSearchResult[]> {
  const needle = query.toLowerCase();
  const { data, error } = await supabase
    .from('playbook_concepts')
    .select('id, title, slug, body_md, state')
    .eq('user_id', userId)
    .limit(200);
  if (error) throw error;

  return (data ?? [])
    .filter((concept: any) =>
      includesQuery(concept.title, needle) || includesQuery(concept.body_md, needle),
    )
    .slice(0, 5)
    .map((concept: any) => ({
      id: concept.id,
      title: concept.title,
      slug: concept.slug,
      subtitle: concept.state ? `Concept · ${concept.state}` : 'Concept',
    }));
}

async function searchLibraryResources(
  query: string,
  userId: string,
): Promise<LibraryResourceSearchResult[]> {
  const needle = query.toLowerCase();
  const { data, error } = await supabase
    .from('library_items')
    .select('id, title, source_label, kind')
    .eq('user_id', userId)
    .limit(200);
  if (error) throw error;

  return (data ?? [])
    .filter((item: any) =>
      includesQuery(item.title, needle)
      || includesQuery(item.source_label, needle)
      || includesQuery(item.kind, needle),
    )
    .slice(0, 5)
    .map((item: any) => ({
      id: item.id,
      title: item.title,
      subtitle: [item.kind, item.source_label].filter(Boolean).join(' · ') || 'Resource',
    }));
}

async function searchOrganizations(query: string): Promise<OrganizationSearchResult[]> {
  const rows = await organizationDiscoveryService.searchOrganizations({
    query,
    limit: 5,
  });

  return rows.map((org) => ({
    id: org.id,
    title: org.name,
    slug: org.slug,
    subtitle: [org.organization_type, org.join_mode.replace(/_/g, ' ')]
      .filter(Boolean)
      .join(' · '),
  }));
}

function labelGroupKind(kind: unknown): string {
  switch (kind) {
    case 'class_fleet':
      return 'Fleet';
    case 'crew_pod':
      return 'Crew';
    case 'practice_group':
      return 'Practice group';
    case 'cohort':
      return 'Cohort';
    default:
      return 'Group';
  }
}

async function searchGroups(
  query: string,
  userId: string,
): Promise<GroupSearchResult[]> {
  const needle = query.toLowerCase();
  const [affinityResult, cohortResult] = await Promise.all([
    supabase
      .from('affinity_group_members')
      .select(`
        group_id,
        role,
        affinity_groups (
          id, kind, name, short_name, is_active
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(100),
    supabase
      .from('betterat_org_cohort_members')
      .select('cohort_id, role, betterat_org_cohorts(id, name)')
      .eq('user_id', userId)
      .limit(100),
  ]);

  if (affinityResult.error) throw affinityResult.error;
  if (cohortResult.error) throw cohortResult.error;

  const results: GroupSearchResult[] = [];
  const seen = new Set<string>();

  for (const row of (affinityResult.data ?? []) as any[]) {
    const group = Array.isArray(row.affinity_groups)
      ? row.affinity_groups[0]
      : row.affinity_groups;
    if (!group?.id || group.is_active === false) continue;
    if (
      !includesQuery(group.name, needle)
      && !includesQuery(group.short_name, needle)
    ) {
      continue;
    }

    const key = `affinity:${group.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      id: group.id,
      title: group.name,
      subtitle: [labelGroupKind(group.kind), row.role].filter(Boolean).join(' · '),
      route: `/group/${group.id}`,
    });
  }

  for (const row of (cohortResult.data ?? []) as any[]) {
    const cohort = Array.isArray(row.betterat_org_cohorts)
      ? row.betterat_org_cohorts[0]
      : row.betterat_org_cohorts;
    if (!cohort?.id || !includesQuery(cohort.name, needle)) continue;

    const key = `cohort:${cohort.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      id: cohort.id,
      title: cohort.name,
      subtitle: ['Cohort', row.role].filter(Boolean).join(' · '),
      route: `/organization/cohort/${cohort.id}`,
    });
  }

  return results.slice(0, 5);
}
