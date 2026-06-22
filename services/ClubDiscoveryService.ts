/**
 * Club Discovery Service
 * Auto-suggest yacht clubs and class associations
 * Called by OnboardingAgent tools
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ClubDiscoveryService');

export interface YachtClub {
  id: string;
  name: string;
  venue_id?: string;
  website?: string;
  contact_email?: string;
  metadata?: any;
  sailing_venues?: {
    id: string;
    name: string;
    region?: string;
    country?: string;
  };
}

export interface ClassAssociation {
  id: string;
  name: string;
  class_id?: string;
  website?: string;
  racing_rules_url?: string;
  region?: string;
  boat_classes?: {
    id: string;
    name: string;
    type?: string;
  };
}

export interface SailorClubMembership {
  id: string;
  sailor_id: string;
  club_id?: string;
  association_id?: string;
  club_type: 'yacht_club' | 'class_association';
  auto_import_races: boolean;
  created_at: string;
  yacht_clubs?: YachtClub;
  class_associations?: ClassAssociation;
}

export class ClubDiscoveryService {
  private static async getVenueMap(venueIds: string[]): Promise<Map<string, YachtClub['sailing_venues']>> {
    const map = new Map<string, YachtClub['sailing_venues']>();
    if (venueIds.length === 0) return map;

    const { data } = await supabase
      .from('sailing_venues')
      .select('id, name, region, country')
      .in('id', venueIds);

    (data || []).forEach((venue: any) => {
      if (venue?.id) {
        map.set(venue.id, {
          id: venue.id,
          name: venue.name,
          region: venue.region || undefined,
          country: venue.country || undefined,
        });
      }
    });

    return map;
  }

  private static async getGlobalClubNameMap(clubIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (clubIds.length === 0) return map;
    const { data } = await supabase
      .from('global_clubs')
      .select('id, name')
      .in('id', clubIds);

    (data || []).forEach((club: any) => {
      if (club?.id && club?.name) map.set(club.id, club.name);
    });
    return map;
  }

  /**
   * Discover yacht clubs by venue
   */
  static async discoverClubsByVenue(venueId: string, limit: number = 10): Promise<YachtClub[]> {
    try {
      const { data: clubs, error } = await supabase
        .from('yacht_clubs')
        .select('*')
        .eq('venue_id', venueId)
        .limit(limit);

      if (error) throw error;

      const rows = clubs || [];
      const venueMap = await this.getVenueMap(
        Array.from(new Set(rows.map((club: any) => club?.venue_id).filter(Boolean)))
      );

      return rows.map((club: any) => ({
        ...club,
        sailing_venues: club?.venue_id ? venueMap.get(club.venue_id) : undefined,
      }));
    } catch (error) {
      logger.error('Error discovering clubs by venue:', error);
      return [];
    }
  }

  /**
   * Discover clubs by fleet (get the club that hosts the fleet)
   */
  static async discoverClubsByFleet(fleetId: string): Promise<YachtClub[]> {
    try {
      const { data: fleet, error: fleetError } = await supabase
        .from('fleets')
        .select('club_id')
        .eq('id', fleetId)
        .single();

      if (fleetError || !fleet?.club_id) return [];

      const { data: club, error: clubError } = await supabase
        .from('yacht_clubs')
        .select('*')
        .eq('id', fleet.club_id)
        .single();

      if (clubError) throw clubError;

      if (!club) return [];
      const venueMap = await this.getVenueMap(club.venue_id ? [club.venue_id] : []);
      return [{
        ...club,
        sailing_venues: club.venue_id ? venueMap.get(club.venue_id) : undefined,
      }];
    } catch (error) {
      logger.error('Error discovering clubs by fleet:', error);
      return [];
    }
  }

  /**
   * Discover class associations by boat class
   */
  static async discoverAssociationsByClass(classId: string): Promise<ClassAssociation[]> {
    try {
      const { data: associations, error } = await supabase
        .from('class_associations')
        .select(`
          *,
          boat_classes(id, name, type)
        `)
        .eq('class_id', classId);

      if (error) throw error;

      return associations || [];
    } catch (error) {
      logger.error('Error discovering associations by class:', error);
      return [];
    }
  }

  /**
   * Get suggested clubs and associations for a sailor
   */
  static async getSuggestedClubs(sailorId: string): Promise<{
    clubs: YachtClub[];
    associations: ClassAssociation[];
  }> {
    try {
      // Get sailor's locations and boats
      const [locationsResult, boatsResult] = await Promise.all([
        supabase
          .from('sailor_locations')
          .select('location_id')
          .eq('sailor_id', sailorId)
          .eq('is_active', true),
        supabase
          .from('sailor_boats')
          .select('class_id')
          .eq('sailor_id', sailorId)
          .in('status', ['active', 'racing']),
      ]);

      const venueIds = locationsResult.data?.map((l: any) => l.location_id) || [];
      const classIds = boatsResult.data?.map((b: any) => b.class_id) || [];

      // Get clubs from venues
      let clubs: YachtClub[] = [];
      if (venueIds.length > 0) {
        const { data: venueClubs } = await supabase
          .from('yacht_clubs')
          .select('*')
          .in('venue_id', venueIds);
        const rows = venueClubs || [];
        const venueMap = await this.getVenueMap(
          Array.from(new Set(rows.map((club: any) => club?.venue_id).filter(Boolean)))
        );
        clubs = rows.map((club: any) => ({
          ...club,
          sailing_venues: club?.venue_id ? venueMap.get(club.venue_id) : undefined,
        }));
      }

      // Get class associations from boat classes
      let associations: ClassAssociation[] = [];
      if (classIds.length > 0) {
        const { data: classAssociations } = await supabase
          .from('class_associations')
          .select(`
            *,
            boat_classes(id, name, type)
          `)
          .in('class_id', classIds);

        associations = classAssociations || [];
      }

      return { clubs, associations };
    } catch (error) {
      logger.error('Error getting suggested clubs:', error);
      return { clubs: [], associations: [] };
    }
  }

  /**
   * Add a yacht club membership for sailor
   */
  static async addYachtClubMembership(
    sailorId: string,
    clubId: string,
    autoImportRaces: boolean = true
  ): Promise<SailorClubMembership | null> {
    try {
      const { data: membership, error } = await supabase
        .from('sailor_clubs')
        .insert({
          sailor_id: sailorId,
          club_id: clubId,
          club_type: 'yacht_club',
          auto_import_races: autoImportRaces,
        })
        .select('*')
        .single();

      if (error) throw error;

      const typedMembership = membership as SailorClubMembership;
      if (!typedMembership?.club_id) {
        return typedMembership;
      }

      const { data: club } = await supabase
        .from('yacht_clubs')
        .select('*')
        .eq('id', typedMembership.club_id)
        .single();

      const venueMap = await this.getVenueMap(club?.venue_id ? [club.venue_id] : []);
      return {
        ...typedMembership,
        yacht_clubs: club
          ? {
              ...club,
              sailing_venues: club.venue_id ? venueMap.get(club.venue_id) : undefined,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Error adding yacht club membership:', error);
      return null;
    }
  }

  /**
   * Add a class association membership for sailor
   */
  static async addClassAssociationMembership(
    sailorId: string,
    associationId: string,
    autoImportRaces: boolean = true
  ): Promise<SailorClubMembership | null> {
    try {
      const { data: membership, error } = await supabase
        .from('sailor_clubs')
        .insert({
          sailor_id: sailorId,
          association_id: associationId,
          club_type: 'class_association',
          auto_import_races: autoImportRaces,
        })
        .select('*')
        .single();

      if (error) throw error;

      const typedMembership = membership as SailorClubMembership;
      if (!typedMembership?.association_id) {
        return typedMembership;
      }

      const { data: association } = await supabase
        .from('class_associations')
        .select('*')
        .eq('id', typedMembership.association_id)
        .maybeSingle();

      let boatClass: any = null;
      if (association?.class_id) {
        const { data: boatClassData } = await supabase
          .from('boat_classes')
          .select('id, name, type')
          .eq('id', association.class_id)
          .maybeSingle();
        boatClass = boatClassData || null;
      }

      return {
        ...typedMembership,
        class_associations: association
          ? {
              ...association,
              boat_classes: boatClass || undefined,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Error adding class association membership:', error);
      return null;
    }
  }

  /**
   * Remove a club membership
   */
  static async removeClubMembership(sailorId: string, membershipId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('sailor_clubs')
        .delete()
        .eq('id', membershipId)
        .eq('sailor_id', sailorId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Club membership not found.');

      return true;
    } catch (error) {
      logger.error('Error removing club membership:', error);
      return false;
    }
  }

  /**
   * Get all club memberships for a sailor
   */
  static async getSailorClubs(sailorId: string): Promise<SailorClubMembership[]> {
    try {
      const { data: memberships, error } = await supabase
        .from('sailor_clubs')
        .select('*')
        .eq('sailor_id', sailorId);

      if (error) throw error;
      const rows = (memberships || []) as SailorClubMembership[];

      const clubIds = Array.from(new Set(rows.map((m) => m.club_id).filter(Boolean))) as string[];
      const associationIds = Array.from(new Set(rows.map((m) => m.association_id).filter(Boolean))) as string[];

      const { data: clubsData } = clubIds.length > 0
        ? await supabase.from('yacht_clubs').select('*').in('id', clubIds)
        : { data: [] as any[] };
      const clubById = new Map<string, any>();
      (clubsData || []).forEach((club: any) => clubById.set(club.id, club));

      const venueMap = await this.getVenueMap(
        Array.from(new Set((clubsData || []).map((club: any) => club?.venue_id).filter(Boolean)))
      );

      const { data: associationsData } = associationIds.length > 0
        ? await supabase.from('class_associations').select('*, boat_classes(id, name, type)').in('id', associationIds)
        : { data: [] as any[] };
      const associationById = new Map<string, any>();
      (associationsData || []).forEach((association: any) => associationById.set(association.id, association));

      return rows.map((membership) => {
        const club = membership.club_id ? clubById.get(membership.club_id) : undefined;
        return {
          ...membership,
          yacht_clubs: club
            ? {
                ...club,
                sailing_venues: club?.venue_id ? venueMap.get(club.venue_id) : undefined,
              }
            : undefined,
          class_associations: membership.association_id
            ? associationById.get(membership.association_id)
            : undefined,
        };
      });
    } catch (error) {
      logger.error('Error getting sailor clubs:', error);
      return [];
    }
  }

  /**
   * Search yacht clubs by name
   */
  static async searchYachtClubs(query: string, limit: number = 10): Promise<YachtClub[]> {
    try {
      const { data: clubs, error } = await supabase
        .from('yacht_clubs')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(limit);

      if (error) throw error;

      const rows = clubs || [];
      const venueMap = await this.getVenueMap(
        Array.from(new Set(rows.map((club: any) => club?.venue_id).filter(Boolean)))
      );
      return rows.map((club: any) => ({
        ...club,
        sailing_venues: club?.venue_id ? venueMap.get(club.venue_id) : undefined,
      }));
    } catch (error) {
      logger.error('Error searching yacht clubs:', error);
      return [];
    }
  }

  /**
   * Search class associations by name
   */
  static async searchClassAssociations(query: string, limit: number = 10): Promise<ClassAssociation[]> {
    try {
      const { data: associations, error } = await supabase
        .from('class_associations')
        .select(`
          *,
          boat_classes(id, name, type)
        `)
        .ilike('name', `%${query}%`)
        .limit(limit);

      if (error) throw error;

      return associations || [];
    } catch (error) {
      logger.error('Error searching class associations:', error);
      return [];
    }
  }

  /**
   * Check if sailor is member of a yacht club
   */
  static async isYachtClubMember(sailorId: string, clubId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('sailor_clubs')
        .select('id')
        .eq('sailor_id', sailorId)
        .eq('club_id', clubId)
        .eq('club_type', 'yacht_club')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      logger.error('Error checking yacht club membership:', error);
      return false;
    }
  }

  /**
   * Check if sailor is member of a class association
   */
  static async isAssociationMember(sailorId: string, associationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('sailor_clubs')
        .select('id')
        .eq('sailor_id', sailorId)
        .eq('association_id', associationId)
        .eq('club_type', 'class_association')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      logger.error('Error checking class association membership:', error);
      return false;
    }
  }

  /**
   * Toggle auto-import races for a club membership
   */
  static async toggleAutoImportRaces(
    sailorId: string,
    membershipId: string,
    autoImport: boolean
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('sailor_clubs')
        .update({ auto_import_races: autoImport })
        .eq('id', membershipId)
        .eq('sailor_id', sailorId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Club membership not found.');

      return true;
    } catch (error) {
      logger.error('Error toggling auto-import races:', error);
      return false;
    }
  }

  // ===========================================================================
  // CLUB SEARCH METHODS (used by useClubSearch hook)
  // ===========================================================================

  /**
   * Search clubs with optional filters
   * Uses the unified global_clubs table
   * Used by the Search Tab's Clubs segment
   */
  static async searchClubs(options: {
    query?: string;
    region?: string;
    countryCode?: string;
    boatClassId?: string;
    limit?: number;
  }): Promise<{
    id: string;
    name: string;
    description?: string;
    region?: string;
    logoUrl?: string;
    memberCount: number;
    boatClassName?: string;
    source?: 'platform' | 'directory';
  }[]> {
    const { query, countryCode, boatClassId, limit = 100 } = options;
    const searchTerm = query?.trim() || '';

    try {
      // Build the query on global_clubs
      let clubsQuery = supabase
        .from('global_clubs')
        .select(`
          id,
          name,
          description,
          city,
          region,
          country,
          country_code,
          logo_url,
          platform_club_id,
          typical_classes
        `)
        .order('name');

      // Apply search filter
      if (searchTerm) {
        clubsQuery = clubsQuery.ilike('name', `%${searchTerm}%`);
      }

      // Apply country filter if provided
      if (countryCode) {
        clubsQuery = clubsQuery.eq('country_code', countryCode);
      }

      // Apply boat class filter if provided
      if (boatClassId) {
        clubsQuery = clubsQuery.contains('typical_classes', [boatClassId]);
      }

      clubsQuery = clubsQuery.limit(limit);

      const { data: clubs, error } = await clubsQuery;

      if (error) {
        logger.error('Error fetching global clubs:', error);
        return [];
      }

      // Get member counts from global_club_members
      const clubIds = (clubs || []).map((c: any) => c.id);
      let memberCountMap: Record<string, number> = {};

      if (clubIds.length > 0) {
        const { data: memberCounts } = await supabase
          .from('global_club_members')
          .select('global_club_id')
          .in('global_club_id', clubIds);

        (memberCounts || []).forEach((m: any) => {
          memberCountMap[m.global_club_id] = (memberCountMap[m.global_club_id] || 0) + 1;
        });
      }

      // Transform to return format
      return (clubs || []).map((club: any) => {
        // Build location string
        const locationParts = [club.city, club.region, club.country].filter(Boolean);
        const region = locationParts.length > 0 ? locationParts.slice(0, 2).join(', ') : undefined;

        return {
          id: club.id,
          name: club.name,
          description: club.description,
          region,
          logoUrl: club.logo_url,
          memberCount: memberCountMap[club.id] || 0,
          boatClassName: club.typical_classes?.[0] || undefined,
          // If it has a platform_club_id, it's a claimed/platform club, otherwise directory
          source: club.platform_club_id ? 'platform' as const : 'directory' as const,
        };
      });
    } catch (error) {
      logger.error('Error in searchClubs:', error);
      return [];
    }
  }

  /**
   * Get clubs a user is a member of
   * Uses the unified global_club_members table
   * Used by useClubSearch to check membership status
   */
  static async getUserClubs(userId: string): Promise<{ id: string; name: string }[]> {
    try {
      const { data: memberships, error } = await supabase
        .from('global_club_members')
        .select('global_club_id')
        .eq('user_id', userId);

      if (error) {
        logger.error('Error fetching user clubs:', error);
        return [];
      }

      const clubIds = Array.from(
        new Set((memberships || []).map((m: any) => m.global_club_id).filter(Boolean))
      ) as string[];
      const nameMap = await this.getGlobalClubNameMap(clubIds);

      return clubIds.map((id) => ({
        id,
        name: nameMap.get(id) || 'Club',
      }));
    } catch (error) {
      logger.error('Error in getUserClubs:', error);
      return [];
    }
  }

  /**
   * Join a club
   * Uses the unified global_club_members table
   */
  static async joinClub(userId: string, clubId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('global_club_members')
        .insert({
          user_id: userId,
          global_club_id: clubId,
          role: 'member',
        });

      // Ignore duplicate key error (already a member)
      if (error && error.code !== '23505') throw error;
    } catch (error) {
      logger.error('Error joining club:', error);
      throw error;
    }
  }

  /**
   * Leave a club
   * Uses the unified global_club_members table
   */
  static async leaveClub(userId: string, clubId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('global_club_members')
        .delete()
        .eq('user_id', userId)
        .eq('global_club_id', clubId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Global club membership not found.');
    } catch (error) {
      logger.error('Error leaving club:', error);
      throw error;
    }
  }

  // ===========================================================================
  // GLOBAL CLUBS METHODS (unified directory)
  // ===========================================================================

  /**
   * Search the global clubs directory
   * Uses the unified global_clubs table
   */
  static async searchGlobalClubs(options: {
    query?: string;
    country?: string;
    clubType?: string;
    verifiedOnly?: boolean;
    limit?: number;
  }): Promise<GlobalClubResult[]> {
    const { query, country, clubType, verifiedOnly = false, limit = 50 } = options;

    try {
      let clubQuery = supabase
        .from('global_clubs')
        .select(`
          id,
          name,
          short_name,
          description,
          club_type,
          country,
          country_code,
          region,
          city,
          website,
          logo_url,
          established_year,
          verified,
          platform_club_id,
          typical_classes,
          facilities
        `)
        .order('verified', { ascending: false })
        .order('name', { ascending: true })
        .limit(limit);

      // Apply filters
      if (query && query.trim().length > 0) {
        clubQuery = clubQuery.ilike('name', `%${query.trim()}%`);
      }
      if (country) {
        clubQuery = clubQuery.or(`country.ilike.%${country}%,country_code.eq.${country.toUpperCase()}`);
      }
      if (clubType) {
        clubQuery = clubQuery.eq('club_type', clubType);
      }
      if (verifiedOnly) {
        clubQuery = clubQuery.eq('verified', true);
      }

      const { data: clubs, error } = await clubQuery;

      if (error) {
        logger.error('Error searching global clubs:', error);
        return [];
      }

      if (!clubs || clubs.length === 0) {
        return [];
      }

      // Get member counts
      const clubIds = clubs.map((c: any) => c.id);
      const { data: memberCounts } = await supabase
        .from('global_club_members')
        .select('global_club_id')
        .in('global_club_id', clubIds);

      const memberCountMap: Record<string, number> = {};
      (memberCounts || []).forEach((m: any) => {
        memberCountMap[m.global_club_id] = (memberCountMap[m.global_club_id] || 0) + 1;
      });

      return clubs.map((club: any) => ({
        id: club.id,
        name: club.name,
        shortName: club.short_name,
        description: club.description,
        clubType: club.club_type,
        country: club.country,
        countryCode: club.country_code,
        region: club.region,
        city: club.city,
        website: club.website,
        logoUrl: club.logo_url,
        establishedYear: club.established_year,
        verified: club.verified,
        platformClubId: club.platform_club_id,
        memberCount: memberCountMap[club.id] || 0,
        typicalClasses: club.typical_classes || [],
        facilities: club.facilities || [],
        isClaimed: !!club.platform_club_id,
      }));
    } catch (error) {
      logger.error('Error in searchGlobalClubs:', error);
      return [];
    }
  }

  /**
   * Get a single global club by ID
   */
  static async getGlobalClub(clubId: string): Promise<GlobalClubResult | null> {
    try {
      const { data: club, error } = await supabase
        .from('global_clubs')
        .select('*')
        .eq('id', clubId)
        .single();

      if (error || !club) {
        return null;
      }

      // Get member count
      const { count } = await supabase
        .from('global_club_members')
        .select('*', { count: 'exact', head: true })
        .eq('global_club_id', clubId);

      return {
        id: club.id,
        name: club.name,
        shortName: club.short_name,
        description: club.description,
        clubType: club.club_type,
        country: club.country,
        countryCode: club.country_code,
        region: club.region,
        city: club.city,
        website: club.website,
        logoUrl: club.logo_url,
        establishedYear: club.established_year,
        verified: club.verified,
        platformClubId: club.platform_club_id,
        memberCount: count || 0,
        typicalClasses: club.typical_classes || [],
        facilities: club.facilities || [],
        isClaimed: !!club.platform_club_id,
      };
    } catch (error) {
      logger.error('Error getting global club:', error);
      return null;
    }
  }

  /**
   * Claim a club from the directory
   * Creates a platform club and links it to the global club entry
   */
  static async claimClub(
    userId: string,
    globalClubId: string,
    claimData: {
      email: string;
      role: string;
      message?: string;
    }
  ): Promise<{ success: boolean; platformClubId?: string; error?: string }> {
    try {
      // Get the global club
      const { data: globalClub, error: fetchError } = await supabase
        .from('global_clubs')
        .select('*')
        .eq('id', globalClubId)
        .single();

      if (fetchError || !globalClub) {
        return { success: false, error: 'Club not found' };
      }

      // Check if already claimed
      if (globalClub.platform_club_id) {
        return { success: false, error: 'This club has already been claimed' };
      }

      // Create a platform club
      const { data: platformClub, error: createError } = await supabase
        .from('clubs')
        .insert({
          name: globalClub.name,
          short_name: globalClub.short_name,
          description: globalClub.description,
          website: globalClub.website,
          email: claimData.email,
          logo_url: globalClub.logo_url,
          club_type: globalClub.club_type,
          established_year: globalClub.established_year,
          facilities: globalClub.facilities,
          location: {
            country: globalClub.country,
            city: globalClub.city,
            address: globalClub.address,
          },
          subscription_tier: 'free',
          subscription_status: 'trial',
        })
        .select('id')
        .single();

      if (createError || !platformClub) {
        logger.error('Error creating platform club:', createError);
        return { success: false, error: 'Failed to create club' };
      }

      // Link global club to platform club
      const { error: linkError } = await supabase
        .from('global_clubs')
        .update({
          platform_club_id: platformClub.id,
          claimed_at: new Date().toISOString(),
          claimed_by: userId,
        })
        .eq('id', globalClubId);

      if (linkError) {
        logger.error('Error linking clubs:', linkError);
      }

      // Add user as club owner
      await supabase
        .from('club_members')
        .insert({
          club_id: platformClub.id,
          user_id: userId,
          role: 'owner',
          is_active: true,
        });

      // Also add to global_club_members
      await supabase
        .from('global_club_members')
        .insert({
          global_club_id: globalClubId,
          user_id: userId,
          role: 'owner',
        });

      return { success: true, platformClubId: platformClub.id };
    } catch (error) {
      logger.error('Error claiming club:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Submit a new club to the directory
   */
  static async submitClub(
    userId: string,
    clubData: {
      name: string;
      shortName?: string;
      description?: string;
      clubType: string;
      country: string;
      countryCode?: string;
      region?: string;
      city?: string;
      website?: string;
      email?: string;
    }
  ): Promise<{ success: boolean; clubId?: string; error?: string }> {
    try {
      // Check for duplicates
      const { data: existing } = await supabase
        .from('global_clubs')
        .select('id, name')
        .ilike('name', clubData.name)
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'A club with this name already exists' };
      }

      // Insert the new club
      const { data: newClub, error } = await supabase
        .from('global_clubs')
        .insert({
          name: clubData.name,
          short_name: clubData.shortName,
          description: clubData.description,
          club_type: clubData.clubType,
          country: clubData.country,
          country_code: clubData.countryCode,
          region: clubData.region,
          city: clubData.city,
          website: clubData.website,
          email: clubData.email,
          source: 'user_submitted',
          verified: false,
        })
        .select('id')
        .single();

      if (error || !newClub) {
        logger.error('Error submitting club:', error);
        return { success: false, error: 'Failed to submit club' };
      }

      // Auto-join the submitter
      await supabase
        .from('global_club_members')
        .insert({
          global_club_id: newClub.id,
          user_id: userId,
          role: 'member',
        });

      return { success: true, clubId: newClub.id };
    } catch (error) {
      logger.error('Error submitting club:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Join a global club
   */
  static async joinGlobalClub(userId: string, globalClubId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('global_club_members')
        .insert({
          global_club_id: globalClubId,
          user_id: userId,
          role: 'member',
        });

      if (error && error.code !== '23505') {
        throw error;
      }
    } catch (error) {
      logger.error('Error joining global club:', error);
      throw error;
    }
  }

  /**
   * Leave a global club
   */
  static async leaveGlobalClub(userId: string, globalClubId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('global_club_members')
        .delete()
        .eq('user_id', userId)
        .eq('global_club_id', globalClubId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Global club membership not found.');
    } catch (error) {
      logger.error('Error leaving global club:', error);
      throw error;
    }
  }

  /**
   * Get user's global club memberships
   */
  static async getUserGlobalClubs(userId: string): Promise<{ id: string; name: string }[]> {
    try {
      const { data, error } = await supabase
        .from('global_club_members')
        .select('global_club_id')
        .eq('user_id', userId);

      if (error) {
        logger.error('Error getting user global clubs:', error);
        return [];
      }

      const clubIds = Array.from(
        new Set((data || []).map((m: any) => m.global_club_id).filter(Boolean))
      ) as string[];
      const nameMap = await this.getGlobalClubNameMap(clubIds);

      return clubIds.map((id) => ({
        id,
        name: nameMap.get(id) || 'Club',
      }));
    } catch (error) {
      logger.error('Error in getUserGlobalClubs:', error);
      return [];
    }
  }
}

// ===========================================================================
// TYPES
// ===========================================================================

export interface GlobalClubResult {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  clubType: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  website?: string;
  logoUrl?: string;
  establishedYear?: number;
  verified: boolean;
  platformClubId?: string;
  memberCount: number;
  typicalClasses: string[];
  facilities: string[];
  isClaimed: boolean;
}
