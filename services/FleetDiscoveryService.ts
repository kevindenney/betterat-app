/**
 * Fleet Discovery Service
 * Auto-suggest fleets based on location and boat class
 * Called by OnboardingAgent tools
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value?: string) => !!value && UUID_REGEX.test(value);
const logger = createLogger('FleetDiscoveryService');

export interface Fleet {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  class_id?: string;
  club_id?: string;
  organization_id?: string;
  region?: string;
  whatsapp_link?: string;
  visibility: 'public' | 'private' | 'club';
  metadata?: any;
  boat_classes?: {
    id: string;
    name: string;
    type?: string;
  };
  yacht_clubs?: {
    id: string;
    name: string;
    venue_id?: string;
  };
  /** The owning organization (yacht club), when the fleet is scoped to one. */
  organizations?: {
    id: string;
    name: string;
    slug: string | null;
  } | null;
  member_count?: number;
}

export interface InviteCandidate {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** "Dragon · RHKYC" — small context line under the name to help
   *  the inviter disambiguate two sailors with the same name. */
  context: string;
}

export interface FleetMembership {
  id: string;
  fleet_id: string;
  user_id: string;
  role: 'member' | 'owner' | 'captain' | 'coach' | 'support';
  status: 'active' | 'pending' | 'invited' | 'inactive';
  joined_at: string;
  notify_fleet_on_join?: boolean;
}

export class FleetDiscoveryService {
  /**
   * Discover fleets by venue and boat class
   */
  static async discoverFleets(
    venueId?: string,
    classId?: string,
    limit: number = 10
  ): Promise<Fleet[]> {
    try {
      // Left join boat_classes (not !inner): a fleet without a boat class is
      // still a valid public fleet and must remain discoverable. An inner join
      // silently dropped every class-less fleet (e.g. whole regions seeded
      // without a class), so browse only ever showed classed fleets.
      let query = supabase
        .from('fleets')
        .select(`
          *,
          boat_classes(id, name),
          organizations(id, name, slug)
        `)
        .in('visibility', ['public', 'club'])
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by boat class if provided
      if (classId) {
        query = query.eq('class_id', classId);
      }

      // Filter by region if provided
      if (venueId) {
        // Note: We filter by region since there's no direct venue relationship
        // This is a simplified approach - you may want to add a venue_id column to fleets
      }

      const { data: fleets, error } = await query;

      if (error) throw error;

      // Get member counts for each fleet
      const fleetsWithCounts = await Promise.all(
        (fleets || []).map(async (fleet: any) => {
          const { count } = await supabase
            .from('fleet_members')
            .select('*', { count: 'exact', head: true })
            .eq('fleet_id', fleet.id)
            .eq('status', 'active');

          return {
            ...fleet,
            member_count: count || 0,
          };
        })
      );

      // Sort by member count (popularity)
      return fleetsWithCounts.sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
    } catch (error) {
      logger.error('Error discovering fleets:', error);
      return [];
    }
  }

  /**
   * Get suggested fleets for a sailor based on their profile
   */
  static async getSuggestedFleets(sailorId: string): Promise<Fleet[]> {
    try {
      // Get sailor's boat classes
      const boatsResult = await supabase
        .from('sailor_boats')
        .select('class_id')
        .eq('sailor_id', sailorId)
        .in('status', ['active', 'racing']);

      const classIds = boatsResult.data?.map((b: any) => b.class_id) || [];

      if (classIds.length === 0) {
        return [];
      }

      // Find fleets matching sailor's boats
      const { data: fleets, error } = await supabase
        .from('fleets')
        .select(`
          *,
          boat_classes!inner(id, name),
          organizations(id, name, slug)
        `)
        .in('class_id', classIds)
        .in('visibility', ['public', 'club'])
        .limit(20);

      if (error) throw error;

      // Filter by region if sailor has locations
      let filteredFleets = fleets || [];
      // Note: Region-based filtering could be added here if needed

      // Get member counts and sort by popularity
      const fleetsWithCounts = await Promise.all(
        filteredFleets.map(async (fleet: any) => {
          const { count } = await supabase
            .from('fleet_members')
            .select('*', { count: 'exact', head: true })
            .eq('fleet_id', fleet.id)
            .eq('status', 'active');

          return {
            ...fleet,
            member_count: count || 0,
          };
        })
      );

      return fleetsWithCounts
        .sort((a, b) => (b.member_count || 0) - (a.member_count || 0))
        .slice(0, 10);
    } catch (error) {
      logger.error('Error getting suggested fleets:', error);
      return [];
    }
  }

  /**
   * Join a fleet
   */
  static async joinFleet(
    sailorId: string,
    fleetId: string,
    notifyFleet: boolean = false
  ): Promise<FleetMembership | null> {
    if (!isUuid(fleetId)) {
      logger.warn('Skipping joinFleet for non-UUID fleet id', { fleetId });
      return null;
    }

    try {
      const { data: membership, error } = await supabase
        .from('fleet_members')
        .insert({
          fleet_id: fleetId,
          user_id: sailorId,
          role: 'member',
          status: 'active',
          notify_fleet_on_join: notifyFleet,
        })
        .select()
        .single();

      if (error) throw error;

      return membership;
    } catch (error) {
      logger.error('Error joining fleet:', error);
      return null;
    }
  }

  /**
   * Leave a fleet
   */
  static async leaveFleet(sailorId: string, fleetId: string): Promise<boolean> {
    if (!isUuid(fleetId)) {
      logger.warn('Skipping leaveFleet for non-UUID fleet id', { fleetId });
      return false;
    }

    try {
      const { error } = await supabase
        .from('fleet_members')
        .delete()
        .eq('fleet_id', fleetId)
        .eq('user_id', sailorId);

      if (error) throw error;

      return true;
    } catch (error) {
      logger.error('Error leaving fleet:', error);
      return false;
    }
  }

  /**
   * Get sailor's fleet memberships
   */
  static async getSailorFleets(sailorId: string): Promise<Fleet[]> {
    try {
      const { data: memberships, error } = await supabase
        .from('fleet_members')
        .select(`
          fleet_id,
          fleets(
            *,
            boat_classes(id, name),
            organizations(id, name, slug)
          )
        `)
        .eq('user_id', sailorId)
        .eq('status', 'active');

      if (error) throw error;

      return memberships?.map((m: any) => m.fleets).filter(Boolean) || [];
    } catch (error) {
      logger.error('Error getting sailor fleets:', error);
      return [];
    }
  }

  /**
   * Search fleets by name, region, or boat class
   */
  static async searchFleets(query: string, limit: number = 10): Promise<Fleet[]> {
    try {
      const { data: fleets, error } = await supabase
        .from('fleets')
        .select(`
          *,
          boat_classes(id, name),
          organizations(id, name, slug)
        `)
        .or(`name.ilike.%${query}%,region.ilike.%${query}%,description.ilike.%${query}%`)
        .in('visibility', ['public', 'club'])
        .order('name', { ascending: true })
        .limit(limit);

      if (error) throw error;

      // Get member counts for each fleet
      const fleetsWithCounts = await Promise.all(
        (fleets || []).map(async (fleet: any) => {
          const { count } = await supabase
            .from('fleet_members')
            .select('*', { count: 'exact', head: true })
            .eq('fleet_id', fleet.id)
            .eq('status', 'active');

          return {
            ...fleet,
            member_count: count || 0,
          };
        })
      );

      return fleetsWithCounts;
    } catch (error) {
      logger.error('Error searching fleets:', error);
      return [];
    }
  }

  /**
   * Fleets owned by an organization (yacht club). Returns whatever the viewer is
   * allowed to see under RLS: public org fleets to anyone, plus club-visibility
   * org fleets to that org's members. Used by the org page and the discovery
   * screen's "Fleets at {your club}" section.
   */
  static async getFleetsByOrganization(
    organizationId: string,
    limit: number = 50
  ): Promise<Fleet[]> {
    if (!isUuid(organizationId)) return [];
    try {
      const { data: fleets, error } = await supabase
        .from('fleets')
        .select(`
          *,
          boat_classes(id, name),
          organizations(id, name, slug)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const fleetsWithCounts = await Promise.all(
        (fleets || []).map(async (fleet: any) => {
          const { count } = await supabase
            .from('fleet_members')
            .select('*', { count: 'exact', head: true })
            .eq('fleet_id', fleet.id)
            .eq('status', 'active');

          return {
            ...fleet,
            member_count: count || 0,
          };
        })
      );

      return fleetsWithCounts.sort(
        (a, b) => (b.member_count || 0) - (a.member_count || 0)
      );
    } catch (error) {
      logger.error('Error getting fleets by organization:', error);
      return [];
    }
  }

  /**
   * Create a new fleet
   */
  static async createFleet(
    creatorId: string,
    fleet: {
      name: string;
      description?: string;
      class_id?: string;
      club_id?: string;
      organization_id?: string;
      region?: string;
      whatsapp_link?: string;
      visibility?: 'public' | 'private' | 'club';
    }
  ): Promise<Fleet | null> {
    try {
      // Create fleet. slug is generated DB-side by trg_fleets_set_slug;
      // is_public is the crew-finder discovery flag, so derive it from the
      // chosen access tier or a "public" fleet is born undiscoverable.
      const visibility = fleet.visibility || 'public';
      const { data: newFleet, error: fleetError } = await supabase
        .from('fleets')
        .insert({
          ...fleet,
          created_by: creatorId,
          visibility,
          is_public: visibility === 'public',
        })
        .select()
        .single();

      if (fleetError) throw fleetError;

      // Add creator as owner
      const { error: ownerError } = await supabase.from('fleet_members').insert({
        fleet_id: newFleet.id,
        user_id: creatorId,
        role: 'owner',
        status: 'active',
      });
      if (ownerError) throw ownerError;

      return newFleet;
    } catch (error) {
      logger.error('Error creating fleet:', error);
      return null;
    }
  }

  /**
   * Search profiles to invite to a fleet — typed query matches against
   * full_name / first_name / last_name (case-insensitive). Restricted
   * to profile_public=true so we don't leak private sailors into the
   * picker; results that are already members (active or invited) are
   * filtered out client-side so the inviter doesn't double-add.
   */
  static async searchInviteCandidates(
    fleetId: string,
    query: string,
    limit: number = 20,
  ): Promise<InviteCandidate[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    try {
      // Existing members + invitees — exclude from results.
      const { data: existing } = await supabase
        .from('fleet_members')
        .select('user_id')
        .eq('fleet_id', fleetId);
      const excludedIds = new Set(
        ((existing ?? []) as { user_id: string }[]).map((r) => r.user_id),
      );

      const wildcard = `%${q.replace(/[%_]/g, '\\$&')}%`;
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, first_name, last_name, avatar_url, sailing_class, sailing_club',
        )
        .eq('profile_public', true)
        .or(
          `full_name.ilike.${wildcard},first_name.ilike.${wildcard},last_name.ilike.${wildcard}`,
        )
        .limit(limit * 2);
      if (error) throw error;
      return ((data ?? []) as {
        id: string;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
        sailing_class: string | null;
        sailing_club: string | null;
      }[])
        .filter((row) => !excludedIds.has(row.id))
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          displayName:
            row.full_name?.trim() ||
            [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
            'Sailor',
          avatarUrl: row.avatar_url,
          context: [row.sailing_class, row.sailing_club]
            .filter((s): s is string => Boolean(s && s.trim()))
            .join(' · '),
        }));
    } catch (error) {
      logger.error('Error searching invite candidates:', error);
      return [];
    }
  }

  /**
   * Invite a user to a fleet — calls the SECURITY DEFINER RPC that
   * checks the caller is fleet owner/captain and inserts a row with
   * status='invited'. Returns the fleet_members row id (existing or
   * new) or null on error.
   */
  static async inviteMember(
    fleetId: string,
    inviteeUserId: string,
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('invite_fleet_member', {
        p_fleet_id: fleetId,
        p_user_id: inviteeUserId,
      });
      if (error) throw error;
      return (data as string | null) ?? null;
    } catch (error) {
      logger.error('Error inviting fleet member:', error);
      return null;
    }
  }

  /**
   * Check if user is a member of a fleet
   */
  static async isMember(sailorId: string, fleetId: string): Promise<boolean> {
    if (!isUuid(fleetId)) {
      logger.warn('Skipping isMember check for non-UUID fleet id', { fleetId });
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('fleet_members')
        .select('id')
        .eq('fleet_id', fleetId)
        .eq('user_id', sailorId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        throw error;
      }

      return !!data;
    } catch (error) {
      logger.error('Error checking fleet membership:', error);
      return false;
    }
  }

  /**
   * Discover fleets by club
   */
  static async discoverFleetsByClub(clubId: string, limit: number = 20): Promise<Fleet[]> {
    try {
      const { data: fleets, error } = await supabase
        .from('fleets')
        .select(`
          *,
          boat_classes(id, name, type)
        `)
        .eq('club_id', clubId)
        .in('visibility', ['public', 'club'])
        .limit(limit);

      if (error) throw error;

      // Get member counts for each fleet
      const fleetsWithCounts = await Promise.all(
        (fleets || []).map(async (fleet: any) => {
          const { count } = await supabase
            .from('fleet_members')
            .select('*', { count: 'exact', head: true })
            .eq('fleet_id', fleet.id)
            .eq('status', 'active');

          return {
            ...fleet,
            member_count: count || 0,
          };
        })
      );

      // Sort by member count (popularity)
      return fleetsWithCounts.sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
    } catch (error) {
      logger.error('Error discovering fleets by club:', error);
      return [];
    }
  }

  /**
   * Discover fleets by venue
   */
  static async discoverFleetsByVenue(venueId: string, limit: number = 20): Promise<Fleet[]> {
    try {
      // Get clubs at this venue
      const { data: clubs, error: clubsError } = await supabase
        .from('yacht_clubs')
        .select('id')
        .eq('venue_id', venueId);

      if (clubsError) throw clubsError;

      const clubIds = (clubs || []).map((c: any) => c.id);

      if (clubIds.length === 0) {
        return [];
      }

      // Get fleets for these clubs
      const { data: fleets, error } = await supabase
        .from('fleets')
        .select(`
          *,
          boat_classes(id, name, type)
        `)
        .in('club_id', clubIds)
        .in('visibility', ['public', 'club'])
        .limit(limit);

      if (error) throw error;

      // Get member counts for each fleet
      const fleetsWithCounts = await Promise.all(
        (fleets || []).map(async (fleet: any) => {
          const { count } = await supabase
            .from('fleet_members')
            .select('*', { count: 'exact', head: true })
            .eq('fleet_id', fleet.id)
            .eq('status', 'active');

          return {
            ...fleet,
            member_count: count || 0,
          };
        })
      );

      // Sort by member count (popularity)
      return fleetsWithCounts.sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
    } catch (error) {
      logger.error('Error discovering fleets by venue:', error);
      return [];
    }
  }
}
