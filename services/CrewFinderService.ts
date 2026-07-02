/**
 * CrewFinderService
 *
 * Service for crew discovery and search:
 * - Searching for users by name
 * - Getting members of fleets the user belongs to
 * - Getting public fleets to browse/join
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isUuid } from '@/utils/uuid';

const logger = createLogger('CrewFinderService');

function getValidUuidList(values: unknown[]): string[] {
  return Array.from(new Set(
    values
      .map((value) => String(value || '').trim())
      .filter((value) => isUuid(value))
  ));
}

/**
 * User profile data for crew finder
 */
export interface SailorProfileSummary {
  userId: string;
  fullName: string;
  avatarEmoji?: string;
  avatarColor?: string;
  sailingExperience?: string;
  email?: string;
}

/**
 * Fleet with members for crew finder
 */
export interface FleetWithMembers {
  id: string;
  name: string;
  description?: string;
  boatClassName?: string;
  memberCount: number;
  members: SailorProfileSummary[];
}

/**
 * Public fleet for browsing
 */
export interface PublicFleet {
  id: string;
  name: string;
  description?: string;
  boatClassName?: string;
  region?: string;
  memberCount: number;
  isJoined: boolean;
}

/**
 * User follow relationship
 */
export interface UserFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

/**
 * Extended user profile for discovery with club info
 */
export interface DiscoverableUser extends SailorProfileSummary {
  clubName?: string;
  boatClassName?: string;
  isFollowing: boolean;
  /** Number of races this user has */
  raceCount?: number;
  /** Preview of recent race names */
  recentRaces?: string[];
}

class CrewFinderServiceClass {
  /**
   * Search for users by name
   */
  async searchUsers(query: string, limit: number = 50): Promise<SailorProfileSummary[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    logger.info('[CrewFinderService] searchUsers called with query:', query);

    const trimmed = query.trim();

    // Search both `profiles` and `users` tables — names can be in either
    const [profilesResult, usersResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
        .limit(limit),
      supabase
        .from('users')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
        .limit(limit),
    ]);

    if (profilesResult.error) {
      logger.error('Failed to search profiles:', profilesResult.error);
    }

    // Merge results from both tables, preferring users.full_name (app-editable name)
    const userMap = new Map<string, { id: string; full_name: string | null; email: string | null }>();
    // Add profiles first
    for (const p of profilesResult.data ?? []) {
      userMap.set(p.id, { id: p.id, full_name: p.full_name, email: p.email });
    }
    // Overlay with users table (which has the editable display name)
    for (const u of usersResult.data ?? []) {
      const existing = userMap.get(u.id);
      userMap.set(u.id, {
        id: u.id,
        full_name: u.full_name || existing?.full_name || null,
        email: u.email || existing?.email || null,
      });
    }

    const allUserIds = Array.from(userMap.keys());
    if (allUserIds.length === 0) return [];

    // Fetch sailor_profiles for avatars
    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color, experience_level')
      .in('user_id', allUserIds);

    const sailorProfilesMap: Record<string, any> = {};
    if (sailorProfiles) {
      for (const sp of sailorProfiles) {
        sailorProfilesMap[sp.user_id] = sp;
      }
    }

    logger.info('[CrewFinderService] searchUsers found', allUserIds.length, 'users');

    return allUserIds.slice(0, limit).map((uid) => {
      const u = userMap.get(uid)!;
      const sp = sailorProfilesMap[uid];
      return {
        userId: uid,
        fullName: u.full_name || 'Unknown',
        avatarEmoji: sp?.avatar_emoji,
        avatarColor: sp?.avatar_color,
        sailingExperience: sp?.experience_level,
        email: u.email || undefined,
      };
    });
  }

  /**
   * Get all users (for browsing when no search query)
   */
  async getAllUsers(limit: number = 50, offset: number = 0): Promise<SailorProfileSummary[]> {
    logger.info('[CrewFinderService] getAllUsers called with limit:', limit, 'offset:', offset);

    // Use `users` table as the primary source (has the editable full_name)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to get users:', error);
      throw error;
    }

    if (!users || users.length === 0) return [];

    // Fetch sailor_profiles for avatars
    const userIds = users.map((u) => u.id);
    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color, experience_level')
      .in('user_id', userIds);

    const sailorProfilesMap: Record<string, any> = {};
    if (sailorProfiles) {
      for (const sp of sailorProfiles) {
        sailorProfilesMap[sp.user_id] = sp;
      }
    }

    logger.info('[CrewFinderService] getAllUsers found', users.length, 'users');

    return users.map((u: any) => {
      const sp = sailorProfilesMap[u.id];
      return {
        userId: u.id,
        fullName: u.full_name || 'Unknown',
        avatarEmoji: sp?.avatar_emoji,
        avatarColor: sp?.avatar_color,
        sailingExperience: sp?.experience_level,
        email: u.email,
      };
    });
  }

  /**
   * Get fleets with members that the current user belongs to
   */
  async getFleetMatesForUser(userId: string): Promise<FleetWithMembers[]> {
    logger.info('[CrewFinderService] getFleetMatesForUser called with userId:', userId);

    // First get the fleet IDs the user is a member of
    const { data: userMemberships, error: membershipError } = await supabase
      .from('fleet_members')
      .select('fleet_id')
      .eq('user_id', userId);

    logger.info('[CrewFinderService] getFleetMatesForUser - userMemberships:', userMemberships, 'error:', membershipError);

    if (membershipError) {
      logger.error('Failed to get user fleet memberships:', membershipError);
      throw membershipError;
    }

    if (!userMemberships || userMemberships.length === 0) {
      logger.info('[CrewFinderService] getFleetMatesForUser - No fleet memberships found for user');
      return [];
    }

    const fleetIds = userMemberships.map((m: any) => m.fleet_id).filter(Boolean);

    // Fetch fleet details separately
    const { data: fleets, error: fleetsError } = await supabase
      .from('fleets')
      .select('id, name, description, class_id')
      .in('id', fleetIds);

    if (fleetsError) {
      logger.error('Failed to get user fleets:', fleetsError);
      throw fleetsError;
    }

    if (!fleets || fleets.length === 0) {
      return [];
    }

    // Get boat class names if needed
    const classIds = fleets.map((f: any) => f.class_id).filter(Boolean);
    let boatClassMap: Record<string, string> = {};
    if (classIds.length > 0) {
      const { data: boatClasses } = await supabase
        .from('boat_classes')
        .select('id, name')
        .in('id', classIds);
      if (boatClasses) {
        boatClassMap = Object.fromEntries(boatClasses.map((bc: any) => [bc.id, bc.name]));
      }
    }

    // Create fleet lookup
    const userFleets = fleets.map((f: any) => ({
      fleet_id: f.id,
      fleets: {
        id: f.id,
        name: f.name,
        description: f.description,
        boat_classes: f.class_id ? { name: boatClassMap[f.class_id] } : null,
      },
    }));

    logger.info('[CrewFinderService] getFleetMatesForUser - querying fleet_members for fleetIds:', fleetIds);
    const { data: memberships, error: membersError } = await supabase
      .from('fleet_members')
      .select('fleet_id, user_id')
      .in('fleet_id', fleetIds);

    logger.info('[CrewFinderService] getFleetMatesForUser - memberships result:', { membershipCount: memberships?.length, error: membersError });

    if (membersError) {
      logger.error('Failed to get fleet members:', membersError);
      throw membersError;
    }

    // Get unique user IDs to fetch profiles and sailor_profiles
    const memberUserIds = [...new Set((memberships || []).map((m: any) => m.user_id))];
    logger.info('[CrewFinderService] getFleetMatesForUser - unique memberUserIds:', memberUserIds);
    let profilesMap: Record<string, any> = {};
    let sailorProfilesMap: Record<string, any> = {};

    if (memberUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberUserIds);

      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
      }

      // Fetch sailor_profiles separately (no FK relationship)
      const { data: sailorProfiles } = await supabase
        .from('sailor_profiles')
        .select('user_id, avatar_emoji, avatar_color, experience_level')
        .in('user_id', memberUserIds);

      if (sailorProfiles) {
        sailorProfilesMap = Object.fromEntries(sailorProfiles.map((sp: any) => [sp.user_id, sp]));
      }
    }

    // Group members by fleet
    const membersByFleet = new Map<string, SailorProfileSummary[]>();
    (memberships || []).forEach((m: any) => {
      if (!membersByFleet.has(m.fleet_id)) {
        membersByFleet.set(m.fleet_id, []);
      }
      const sailorProfile = sailorProfilesMap[m.user_id];
      const profile = profilesMap[m.user_id];
      // Only include users who have a profile and are not the current user
      if (m.user_id !== userId && profile?.full_name) {
        membersByFleet.get(m.fleet_id)!.push({
          userId: m.user_id,
          fullName: profile.full_name,
          avatarEmoji: sailorProfile?.avatar_emoji,
          avatarColor: sailorProfile?.avatar_color,
          sailingExperience: sailorProfile?.experience_level,
        });
      }
    });

    // Build fleet with members array
    const result = userFleets
      .filter((uf: any) => uf.fleets)
      .map((uf: any) => ({
        id: uf.fleet_id,
        name: uf.fleets.name,
        description: uf.fleets.description,
        boatClassName: uf.fleets.boat_classes?.name,
        memberCount: (membersByFleet.get(uf.fleet_id) || []).length + 1, // +1 for current user
        members: membersByFleet.get(uf.fleet_id) || [],
      }));

    logger.info('[CrewFinderService] getFleetMatesForUser - FINAL result:', result.map(f => ({ name: f.name, memberCount: f.members.length })));
    return result;
  }

  /**
   * Get public fleets for browsing
   */
  async getPublicFleets(
    userId: string,
    options?: { classId?: string; region?: string; limit?: number }
  ): Promise<PublicFleet[]> {
    let query = supabase
      .from('fleets')
      .select('id, name, description, region, class_id')
      .eq('is_public', true)
      .order('name', { ascending: true });

    if (options?.classId) {
      query = query.eq('class_id', options.classId);
    }

    if (options?.region) {
      query = query.ilike('region', `%${options.region}%`);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: fleets, error: fleetsError } = await query;

    if (fleetsError) {
      logger.error('Failed to get public fleets:', fleetsError);
      throw fleetsError;
    }

    if (!fleets || fleets.length === 0) {
      return [];
    }

    const fleetIds = fleets.map((f: any) => f.id);

    // Get boat class names
    const classIds = fleets.map((f: any) => f.class_id).filter(Boolean);
    let boatClassMap: Record<string, string> = {};
    if (classIds.length > 0) {
      const { data: boatClasses } = await supabase
        .from('boat_classes')
        .select('id, name')
        .in('id', classIds);
      if (boatClasses) {
        boatClassMap = Object.fromEntries(boatClasses.map((bc: any) => [bc.id, bc.name]));
      }
    }

    // Get member counts per fleet
    const { data: memberCounts } = await supabase
      .from('fleet_members')
      .select('fleet_id')
      .in('fleet_id', fleetIds);

    const memberCountMap: Record<string, number> = {};
    (memberCounts || []).forEach((m: any) => {
      memberCountMap[m.fleet_id] = (memberCountMap[m.fleet_id] || 0) + 1;
    });

    // Get the fleets the user is already a member of
    const { data: userMemberships } = await supabase
      .from('fleet_members')
      .select('fleet_id')
      .eq('user_id', userId);

    const joinedFleetIds = new Set((userMemberships || []).map((m: any) => m.fleet_id));

    return fleets.map((fleet: any) => ({
      id: fleet.id,
      name: fleet.name,
      description: fleet.description,
      boatClassName: fleet.class_id ? boatClassMap[fleet.class_id] : undefined,
      region: fleet.region,
      memberCount: memberCountMap[fleet.id] || 0,
      isJoined: joinedFleetIds.has(fleet.id),
    }));
  }

  /**
   * Join a fleet
   */
  async joinFleet(userId: string, fleetId: string): Promise<void> {
    const { error } = await supabase
      .from('fleet_members')
      .insert({
        user_id: userId,
        fleet_id: fleetId,
        role: 'member',
      });

    if (error) {
      logger.error('Failed to join fleet:', error);
      throw error;
    }

    logger.info('Joined fleet', { userId, fleetId });
  }

  /**
   * Get fleet members for a specific race via race_participants
   * This finds which fleets are associated with a race and returns their members
   * Falls back to club-based fleet lookup if race_participants has no fleet associations
   */
  async getFleetMembersForRace(
    userId: string,
    regattaId: string
  ): Promise<{ members: SailorProfileSummary[]; fleetNames: string[] }> {
    logger.info('[CrewFinderService] getFleetMembersForRace called with:', { userId, regattaId });

    // Step 1: Try to get fleet IDs via race_participants (primary approach)
    const { data: participants, error: participantsError } = await supabase
      .from('race_participants')
      .select('fleet_id')
      .eq('regatta_id', regattaId)
      .not('fleet_id', 'is', null);

    logger.info('[CrewFinderService] Step 1 (race_participants):', { participants, error: participantsError });

    if (participantsError) {
      logger.error('Failed to get race fleet IDs:', participantsError);
      throw participantsError;
    }

    let fleetIds = [...new Set((participants || []).map((p: any) => p.fleet_id).filter(Boolean))];
    logger.info('[CrewFinderService] Fleet IDs from race_participants:', fleetIds);

    // Step 2: Fallback - if no fleet associations, get fleets via regatta's club_id
    if (fleetIds.length === 0) {
      logger.info('[CrewFinderService] No fleet IDs from race_participants, trying club-based fallback');
      logger.info('No fleet associations in race_participants, trying club-based fallback', { regattaId });

      // Get the regatta's club_id
      const { data: regatta, error: regattaError } = await supabase
        .from('regattas')
        .select('club_id')
        .eq('id', regattaId)
        .single();

      logger.info('[CrewFinderService] Regatta club_id lookup:', { regatta, error: regattaError });

      if (regattaError) {
        logger.warn('Failed to get regatta club_id:', regattaError);
      }

      if (regatta?.club_id) {
        logger.info('[CrewFinderService] Found club_id:', regatta.club_id, '- looking up club fleets');
        // Find fleets belonging to this club (public or club-visible)
        const { data: clubFleets, error: clubFleetsError } = await supabase
          .from('fleets')
          .select('id')
          .eq('club_id', regatta.club_id);

        logger.info('[CrewFinderService] Club fleets lookup:', { clubFleets, error: clubFleetsError });

        if (clubFleetsError) {
          logger.warn('Failed to get club fleets:', clubFleetsError);
        } else {
          fleetIds = (clubFleets || []).map((f: any) => f.id);
          logger.info('Found club fleets for regatta', { clubId: regatta.club_id, fleetCount: fleetIds.length });
        }
      }
    }

    if (fleetIds.length === 0) {
      logger.info('[CrewFinderService] No fleetIds found, returning empty');
      return { members: [], fleetNames: [] };
    }

    logger.info('[CrewFinderService] Found fleetIds:', fleetIds);

    // Get fleet info for display
    const { data: fleets, error: fleetsError } = await supabase
      .from('fleets')
      .select('id, name')
      .in('id', fleetIds);

    logger.info('[CrewFinderService] Fleet info lookup:', { fleets, error: fleetsError });

    if (fleetsError) {
      logger.error('Failed to get fleet info:', fleetsError);
    }

    const fleetNames = (fleets || []).map((f: any) => f.name);
    // Get members from these fleets via fleet_members
    const { data: memberships, error: membersError } = await supabase
      .from('fleet_members')
      .select('fleet_id, user_id')
      .in('fleet_id', fleetIds)
      .neq('user_id', userId);

    logger.info('[CrewFinderService] Fleet memberships lookup:', { memberships, memberCount: memberships?.length, error: membersError });

    if (membersError) {
      logger.error('Failed to get fleet members:', membersError);
      throw membersError;
    }

    // Get unique user IDs to fetch profiles and sailor_profiles
    const memberUserIds = [...new Set((memberships || []).map((m: any) => m.user_id))];
    let profilesMap: Record<string, any> = {};
    let sailorProfilesMap: Record<string, any> = {};

    if (memberUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberUserIds);

      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
      }

      // Fill gaps from 'users' table for OAuth users missing from 'profiles'
      const missingIds = memberUserIds.filter((id) => !profilesMap[id]);
      if (missingIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', missingIds);
        (usersData || []).forEach((u: any) => { profilesMap[u.id] = u; });

        // Final fallback: user_profiles view (reads from auth.users)
        const stillMissing = missingIds.filter((id) => !profilesMap[id]);
        if (stillMissing.length > 0) {
          const { data: viewData } = await supabase
            .from('user_profiles')
            .select('id, full_name, email')
            .in('id', stillMissing);
          (viewData || []).forEach((u: any) => { profilesMap[u.id] = u; });
        }
      }

      // Fetch sailor_profiles separately (no FK relationship)
      const { data: sailorProfiles } = await supabase
        .from('sailor_profiles')
        .select('user_id, avatar_emoji, avatar_color, experience_level')
        .in('user_id', memberUserIds);

      if (sailorProfiles) {
        sailorProfilesMap = Object.fromEntries(sailorProfiles.map((sp: any) => [sp.user_id, sp]));
      }
    }

    // Build member list with fleet association
    const members: SailorProfileSummary[] = [];
    const seenUsers = new Set<string>();

    for (const m of memberships || []) {
      if (seenUsers.has(m.user_id)) continue;

      const sailorProfile = sailorProfilesMap[m.user_id];
      const profile = profilesMap[m.user_id];

      // Derive display name with email prefix fallback
      const displayName = profile?.full_name?.trim()
        || (profile?.email ? profile.email.split('@')[0] : '');
      if (!displayName) continue;

      seenUsers.add(m.user_id);
      members.push({
        userId: m.user_id,
        fullName: displayName,
        avatarEmoji: sailorProfile?.avatar_emoji,
        avatarColor: sailorProfile?.avatar_color,
        sailingExperience: sailorProfile?.experience_level,
        email: profile?.email,
      });
    }

    logger.info('[CrewFinderService] getFleetMembersForRace - FINAL result:', { memberCount: members.length, fleetNames, members: members.map(m => m.fullName) });
    return { members, fleetNames };
  }

  /**
   * Get suggested crew members for a user
   * Returns fleet mates and past race collaborators, deduplicated and ranked
   * Also boosts followed users higher in the results
   */
  async getSuggestedCrew(userId: string): Promise<SailorProfileSummary[]> {
    const suggestionsMap = new Map<string, SailorProfileSummary & { score: number; source: string }>();

    // 0. Get followed users to boost their scores
    let followingIds: string[] = [];
    try {
      followingIds = await this.getFollowingIds(userId);
    } catch (error) {
      logger.warn('Error fetching following IDs for suggestions:', error);
    }
    const followingSet = new Set(followingIds);

    // 1. Get fleet mates
    try {
      const fleets = await this.getFleetMatesForUser(userId);
      for (const fleet of fleets) {
        for (const member of fleet.members) {
          if (member.userId === userId) continue;

          const existing = suggestionsMap.get(member.userId);
          if (existing) {
            existing.score += 2; // Boost score for multiple fleet memberships
          } else {
            suggestionsMap.set(member.userId, {
              ...member,
              score: 3, // Base score for fleet mates
              source: `Fleet: ${fleet.name}`,
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Error fetching fleet mates for suggestions:', error);
    }

    // 2. Get past race collaborators (from race_collaborators table)
    try {
      const { data: collaboratorRaces, error: collabError } = await supabase
        .from('race_collaborators')
        .select(`
          regatta_id,
          user_id,
          regattas!inner(
            id,
            name
          )
        `)
        .eq('user_id', userId);

      if (!collabError && collaboratorRaces && collaboratorRaces.length > 0) {
        // Get race IDs where the user has collaborated
        const raceIds = getValidUuidList(collaboratorRaces.map((c: any) => c.regatta_id));
        if (raceIds.length === 0) {
          logger.debug('[CrewFinderService] Skipping collaborator lookup: no valid race UUIDs');
        } else {
          // Find other collaborators in those races
          const { data: otherCollaborators, error: othersError } = await supabase
            .from('race_collaborators')
            .select(`
              user_id,
              regattas!inner(
                id,
                name
              )
            `)
            .in('regatta_id', raceIds)
            .neq('user_id', userId);

          if (!othersError && otherCollaborators) {
            // Get unique user IDs
            const collabUserIds = [...new Set(otherCollaborators.map((c: any) => c.user_id))];

            if (collabUserIds.length > 0) {
              // Fetch profiles for these users
              const { data: profiles } = await supabase
                .from('profiles')
                .select(`
                  id,
                  full_name,
                  email,
                  sailor_profiles(
                    avatar_emoji,
                    avatar_color,
                    experience_level
                  )
                `)
                .in('id', collabUserIds);

              if (profiles) {
                for (const profile of profiles) {
                  if (profile.id === userId) continue;
                  const displayName = profile.full_name?.trim()
                    || (profile.email ? profile.email.split('@')[0] : '');
                  if (!displayName) continue;

                  const existing = suggestionsMap.get(profile.id);
                  const collab = otherCollaborators.find((c: any) => c.user_id === profile.id);
                  const raceName = (collab?.regattas as any)?.name || 'past race';

                  if (existing) {
                    existing.score += 1; // Boost for race collaboration
                  } else {
                    suggestionsMap.set(profile.id, {
                      userId: profile.id,
                      fullName: displayName,
                      avatarEmoji: (profile.sailor_profiles as any)?.avatar_emoji,
                      avatarColor: (profile.sailor_profiles as any)?.avatar_color,
                      sailingExperience: (profile.sailor_profiles as any)?.experience_level,
                      email: profile.email,
                      score: 2, // Base score for past collaborators
                      source: `Sailed with: ${raceName}`,
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Error fetching past race collaborators for suggestions:', error);
    }

    // 3. Apply follow boost to all suggestions
    for (const [memberId, suggestion] of suggestionsMap) {
      if (followingSet.has(memberId)) {
        suggestion.score += 4; // Significant boost for followed users
        suggestion.source = `Following • ${suggestion.source}`;
      }
    }

    // 4. Sort by score (highest first) and return
    const suggestions = Array.from(suggestionsMap.values())
      .sort((a, b) => b.score - a.score)
      .map(({ score: _score, source, ...profile }) => ({
        ...profile,
        source, // Keep source for display
      }));

    return suggestions as (SailorProfileSummary & { source?: string })[];
  }

  /**
   * Get suggested crew for a specific race
   * Prioritizes fleet members from the race's fleets, then user's fleets, then past collaborators
   * Also boosts followed users higher in the results
   */
  async getSuggestedCrewForRace(
    userId: string,
    regattaId?: string,
    regattaName?: string
  ): Promise<(SailorProfileSummary & { source?: string })[]> {
    logger.info('[CrewFinderService] getSuggestedCrewForRace called with:', { userId, regattaId, regattaName });
    const suggestionsMap = new Map<string, SailorProfileSummary & { score: number; source: string }>();

    // 0. Get followed users to boost their scores
    let followingIds: string[] = [];
    try {
      followingIds = await this.getFollowingIds(userId);
      logger.info('[CrewFinderService] User follows:', followingIds.length, 'users');
    } catch (error) {
      logger.warn('Error fetching following IDs:', error);
    }
    const followingSet = new Set(followingIds);

    // 1. If regattaId provided, get fleet members for this race (highest priority)
    if (regattaId) {
      try {
        logger.info('[CrewFinderService] Step 1: Getting fleet members for race...');
        const { members, fleetNames } = await this.getFleetMembersForRace(userId, regattaId);
        logger.info('[CrewFinderService] Step 1 result: members:', members.length, 'fleetNames:', fleetNames);
        const raceName = regattaName || 'this race';

        for (const member of members) {
          if (member.userId === userId) continue;

          suggestionsMap.set(member.userId, {
            ...member,
            score: 5, // Highest priority for race fleet members
            source: `Racing in: ${raceName}`,
          });
        }
      } catch (error) {
        logger.error('[CrewFinderService] Step 1 error:', error);
        logger.warn('Error fetching race fleet members:', error);
      }
    }

    // 2. Get user's own fleet mates
    try {
      logger.info('[CrewFinderService] Step 2: Getting user fleet mates...');
      const fleets = await this.getFleetMatesForUser(userId);
      logger.info('[CrewFinderService] Step 2 result: fleets:', fleets.length, fleets.map(f => ({ name: f.name, memberCount: f.members.length })));
      for (const fleet of fleets) {
        for (const member of fleet.members) {
          if (member.userId === userId) continue;

          const existing = suggestionsMap.get(member.userId);
          if (existing) {
            existing.score += 2; // Boost score for multiple sources
          } else {
            suggestionsMap.set(member.userId, {
              ...member,
              score: 3, // Base score for user's fleet mates
              source: `Fleet: ${fleet.name}`,
            });
          }
        }
      }
    } catch (error) {
      logger.error('[CrewFinderService] Step 2 error:', error);
      logger.warn('Error fetching fleet mates for suggestions:', error);
    }

    // 3. Get past race collaborators
    try {
      const { data: collaboratorRaces, error: collabError } = await supabase
        .from('race_collaborators')
        .select(`
          regatta_id,
          user_id,
          regattas!inner(
            id,
            name
          )
        `)
        .eq('user_id', userId);

      if (!collabError && collaboratorRaces && collaboratorRaces.length > 0) {
        const raceIds = getValidUuidList(collaboratorRaces.map((c: any) => c.regatta_id));
        if (raceIds.length === 0) {
          logger.debug('[CrewFinderService] Skipping collaborator lookup for race suggestions: no valid race UUIDs');
        } else {
          const { data: otherCollaborators, error: othersError } = await supabase
            .from('race_collaborators')
            .select(`
              user_id,
              regattas!inner(
                id,
                name
              )
            `)
            .in('regatta_id', raceIds)
            .neq('user_id', userId);

          if (!othersError && otherCollaborators) {
            const collabUserIds = [...new Set(otherCollaborators.map((c: any) => c.user_id))];

            if (collabUserIds.length > 0) {
              const { data: profiles } = await supabase
                .from('profiles')
                .select(`
                  id,
                  full_name,
                  email,
                  sailor_profiles(
                    avatar_emoji,
                    avatar_color,
                    experience_level
                  )
                `)
                .in('id', collabUserIds);

              if (profiles) {
                for (const profile of profiles) {
                  if (profile.id === userId) continue;
                  const displayName = profile.full_name?.trim()
                    || (profile.email ? profile.email.split('@')[0] : '');
                  if (!displayName) continue;

                  const existing = suggestionsMap.get(profile.id);
                  const collab = otherCollaborators.find((c: any) => c.user_id === profile.id);
                  const raceName = (collab?.regattas as any)?.name || 'past race';

                  if (existing) {
                    existing.score += 1;
                  } else {
                    suggestionsMap.set(profile.id, {
                      userId: profile.id,
                      fullName: displayName,
                      avatarEmoji: (profile.sailor_profiles as any)?.avatar_emoji,
                      avatarColor: (profile.sailor_profiles as any)?.avatar_color,
                      sailingExperience: (profile.sailor_profiles as any)?.experience_level,
                      email: profile.email,
                      score: 2,
                      source: `Sailed with: ${raceName}`,
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Error fetching past race collaborators for suggestions:', error);
    }

    // 4. Apply follow boost to all suggestions
    for (const [userId, suggestion] of suggestionsMap) {
      if (followingSet.has(userId)) {
        suggestion.score += 4; // Significant boost for followed users
        // Update source to indicate following
        suggestion.source = `Following • ${suggestion.source}`;
      }
    }

    // Sort by score (highest first) and return
    const suggestions = Array.from(suggestionsMap.values())
      .sort((a, b) => b.score - a.score)
      .map(({ score: _score, source, ...profile }) => ({
        ...profile,
        source,
      }));

    logger.info('[CrewFinderService] getSuggestedCrewForRace - FINAL result: suggestions count:', suggestions.length, suggestions.slice(0, 3).map(s => s.fullName));
    return suggestions;
  }

  // ===========================================================================
  // USER FOLLOW METHODS
  // ===========================================================================

  /**
   * Get all users for discovery (paginated)
   * Excludes the current user and includes follow status
   */
  async getAllUsersForDiscovery(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ users: DiscoverableUser[]; hasMore: boolean }> {
    logger.info('[CrewFinderService] getAllUsersForDiscovery called with userId:', userId, 'limit:', limit, 'offset:', offset);

    // Get the user's following list first
    let followingIds: string[] = [];
    try {
      followingIds = await this.getFollowingIds(userId);
      logger.info('[CrewFinderService] getAllUsersForDiscovery - got followingIds:', followingIds.length);
    } catch (followError) {
      logger.warn('[CrewFinderService] getAllUsersForDiscovery - getFollowingIds failed (might be new table):', followError);
      // Continue without following data
    }
    const followingSet = new Set(followingIds);

    // Query profiles (base data)
    logger.info('[CrewFinderService] getAllUsersForDiscovery - fetching profiles...');
    const { data: profiles, error, count } = await supabase
      .from('profiles')
      .select('id, full_name, email', { count: 'exact' })
      .not('full_name', 'is', null)
      .neq('id', userId)
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[CrewFinderService] getAllUsersForDiscovery - profiles query failed:', error);
      logger.error('Failed to get users for discovery:', error);
      throw error;
    }

    logger.info('[CrewFinderService] getAllUsersForDiscovery - got profiles:', profiles?.length, 'total count:', count);

    if (!profiles || profiles.length === 0) {
      return { users: [], hasMore: false };
    }

    const userIds = profiles.map((p) => p.id);

    // Fetch sailor_profiles separately (no FK relationship)
    logger.info('[CrewFinderService] getAllUsersForDiscovery - fetching sailor_profiles...');
    const { data: sailorProfiles, error: sailorError } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color, experience_level')
      .in('user_id', userIds);

    if (sailorError) {
      logger.warn('[CrewFinderService] getAllUsersForDiscovery - sailor_profiles query failed:', sailorError);
    }

    const sailorProfilesMap: Record<string, any> = {};
    if (sailorProfiles) {
      sailorProfiles.forEach((sp: any) => {
        sailorProfilesMap[sp.user_id] = sp;
      });
    }
    logger.info('[CrewFinderService] getAllUsersForDiscovery - got sailor_profiles:', sailorProfiles?.length || 0);

    // Fetch club memberships separately (clubs FK exists on club_members)
    logger.info('[CrewFinderService] getAllUsersForDiscovery - fetching club_members...');
    const { data: clubMemberships, error: clubError } = await supabase
      .from('club_members')
      .select('user_id, club_id')
      .in('user_id', userIds);

    if (clubError) {
      logger.warn('[CrewFinderService] getAllUsersForDiscovery - club_members query failed:', clubError);
    }

    // Fetch club names separately if we have memberships
    const clubMap: Record<string, string> = {};
    if (clubMemberships && clubMemberships.length > 0) {
      const clubIds = [...new Set(clubMemberships.map((cm: any) => cm.club_id).filter(Boolean))];
      if (clubIds.length > 0) {
        const { data: clubs } = await supabase
          .from('clubs')
          .select('id, name')
          .in('id', clubIds);

        const clubNameMap: Record<string, string> = {};
        if (clubs) {
          clubs.forEach((c: any) => {
            clubNameMap[c.id] = c.name;
          });
        }

        clubMemberships.forEach((cm: any) => {
          // Only store first club for each user
          if (!clubMap[cm.user_id] && cm.club_id && clubNameMap[cm.club_id]) {
            clubMap[cm.user_id] = clubNameMap[cm.club_id];
          }
        });
      }
    }
    logger.info('[CrewFinderService] getAllUsersForDiscovery - got club mappings:', Object.keys(clubMap).length);

    // Fetch race counts for each user (from regattas they created)
    logger.info('[CrewFinderService] getAllUsersForDiscovery - fetching race counts...');
    const { data: raceCounts, error: raceCountError } = await supabase
      .from('regattas')
      .select('created_by')
      .in('created_by', userIds);

    if (raceCountError) {
      logger.warn('[CrewFinderService] getAllUsersForDiscovery - race count query failed:', raceCountError);
    }

    // Count races per user
    const raceCountMap: Record<string, number> = {};
    if (raceCounts) {
      raceCounts.forEach((r: any) => {
        raceCountMap[r.created_by] = (raceCountMap[r.created_by] || 0) + 1;
      });
    }
    logger.info('[CrewFinderService] getAllUsersForDiscovery - got race counts for', Object.keys(raceCountMap).length, 'users');

    // Also fetch recent race names for users with races
    const usersWithRaces = Object.keys(raceCountMap);
    const recentRacesMap: Record<string, string[]> = {};
    if (usersWithRaces.length > 0) {
      const { data: recentRaces } = await supabase
        .from('regattas')
        .select('created_by, name')
        .in('created_by', usersWithRaces)
        .order('start_date', { ascending: false })
        .limit(100);

      if (recentRaces) {
        recentRaces.forEach((r: any) => {
          if (!recentRacesMap[r.created_by]) {
            recentRacesMap[r.created_by] = [];
          }
          if (recentRacesMap[r.created_by].length < 3) {
            recentRacesMap[r.created_by].push(r.name);
          }
        });
      }
    }

    const users: DiscoverableUser[] = profiles.map((profile: any) => {
      const sailorProfile = sailorProfilesMap[profile.id];

      return {
        userId: profile.id,
        fullName: profile.full_name || 'Unknown',
        avatarEmoji: sailorProfile?.avatar_emoji,
        avatarColor: sailorProfile?.avatar_color,
        sailingExperience: sailorProfile?.experience_level,
        email: profile.email,
        clubName: clubMap[profile.id],
        isFollowing: followingSet.has(profile.id),
        raceCount: raceCountMap[profile.id] || 0,
        recentRaces: recentRacesMap[profile.id] || [],
      };
    });

    logger.info('[CrewFinderService] getAllUsersForDiscovery - returning', users.length, 'users, hasMore:', count !== null ? offset + limit < count : false);

    // Sort: followed users first, then by race count (most active), then by name
    users.sort((a, b) => {
      // Following status first
      if (a.isFollowing && !b.isFollowing) return -1;
      if (!a.isFollowing && b.isFollowing) return 1;
      // Then by race count (descending)
      const aRaces = a.raceCount || 0;
      const bRaces = b.raceCount || 0;
      if (bRaces !== aRaces) return bRaces - aRaces;
      // Finally by name
      return a.fullName.localeCompare(b.fullName);
    });

    return {
      users,
      hasMore: count !== null ? offset + limit < count : false,
    };
  }

  /**
   * Follow a user
   */
  async followUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself');
    }

    const { error } = await supabase
      .from('user_follows')
      .insert({
        follower_id: followerId,
        following_id: followingId,
      });

    if (error) {
      // Handle duplicate follow gracefully
      if (error.code === '23505') {
        logger.info('Already following user', { followerId, followingId });
        return;
      }
      logger.error('Failed to follow user:', error);
      throw error;
    }

    logger.info('Followed user', { followerId, followingId });
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) {
      logger.error('Failed to unfollow user:', error);
      throw error;
    }

    logger.info('Unfollowed user', { followerId, followingId });
  }

  /**
   * Get list of user IDs that a user follows
   */
  async getFollowingIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (error) {
      logger.error('Failed to get following IDs:', error);
      throw error;
    }

    return (data || []).map((f: any) => f.following_id);
  }

  /**
   * Check if a user is following another user
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to check following status:', error);
      return false;
    }

    return !!data;
  }

  /**
   * Get follower count for a user
   */
  async getFollowerCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    if (error) {
      logger.error('Failed to get follower count:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get following count for a user
   */
  async getFollowingCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    if (error) {
      logger.error('Failed to get following count:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get follow options (favorite, notifications, muted) for a follow relationship
   */
  async getFollowOptions(
    followerId: string,
    followingId: string
  ): Promise<{ isFavorite: boolean; notificationsEnabled: boolean; isMuted: boolean }> {
    const { data, error } = await supabase
      .from('user_follows')
      .select('is_favorite, notifications_enabled, is_muted')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (error || !data) {
      return { isFavorite: false, notificationsEnabled: false, isMuted: false };
    }

    return {
      isFavorite: data.is_favorite ?? false,
      notificationsEnabled: data.notifications_enabled ?? false,
      isMuted: data.is_muted ?? false,
    };
  }

  /**
   * Toggle favorite status for a follow relationship
   */
  async toggleFavorite(followerId: string, followingId: string): Promise<boolean> {
    const current = await this.getFollowOptions(followerId, followingId);
    const newValue = !current.isFavorite;

    const { error } = await supabase
      .from('user_follows')
      .update({ is_favorite: newValue })
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) {
      logger.error('Failed to toggle favorite:', error);
      throw error;
    }

    return newValue;
  }

  /**
   * Toggle notifications for a follow relationship
   */
  async toggleNotifications(followerId: string, followingId: string): Promise<boolean> {
    const current = await this.getFollowOptions(followerId, followingId);
    const newValue = !current.notificationsEnabled;

    const { error } = await supabase
      .from('user_follows')
      .update({ notifications_enabled: newValue })
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) {
      logger.error('Failed to toggle notifications:', error);
      throw error;
    }

    return newValue;
  }

  /**
   * Toggle mute for a follow relationship
   */
  async toggleMute(followerId: string, followingId: string): Promise<boolean> {
    const current = await this.getFollowOptions(followerId, followingId);
    const newValue = !current.isMuted;

    const { error } = await supabase
      .from('user_follows')
      .update({ is_muted: newValue })
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) {
      logger.error('Failed to toggle mute:', error);
      throw error;
    }

    return newValue;
  }

  // ===========================================================================
  // SOCIAL SAILING / TIMELINE METHODS
  // ===========================================================================

  /**
   * Get followed users with their race timelines
   * Returns profiles of followed users along with their upcoming/recent races
   */
  async getFollowedUsersWithRaces(
    userId: string,
    options?: { includeRaces?: boolean; racesLimit?: number }
  ): Promise<FollowedUserTimeline[]> {
    const includeRaces = options?.includeRaces ?? true;
    const racesLimit = options?.racesLimit ?? 10;

    logger.info('[CrewFinderService] getFollowedUsersWithRaces called', { userId, includeRaces, racesLimit });

    // Step 1: Get list of followed user IDs
    const followingIds = await this.getFollowingIds(userId);

    if (followingIds.length === 0) {
      logger.info('[CrewFinderService] User follows no one');
      return [];
    }

    // Step 2: Get profiles for followed users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', followingIds);

    if (profilesError) {
      logger.error('Failed to get followed user profiles:', profilesError);
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      return [];
    }

    // Step 3: Get sailor_profiles for avatars
    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color, experience_level')
      .in('user_id', followingIds);

    const sailorProfilesMap: Record<string, any> = {};
    if (sailorProfiles) {
      sailorProfiles.forEach((sp: any) => {
        sailorProfilesMap[sp.user_id] = sp;
      });
    }

    // Step 4: Get races for followed users if requested
    let racesByUser: Record<string, any[]> = {};

    if (includeRaces) {
      // Get races created by followed users
      // Include races within a reasonable time window (past 30 days to future)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: races, error: racesError } = await supabase
        .from('regattas')
        .select('*')
        .in('created_by', followingIds)
        .gte('start_date', thirtyDaysAgo.toISOString())
        .order('start_date', { ascending: true });

      if (racesError) {
        logger.warn('Failed to get followed users races:', racesError);
      } else if (races) {
        // Group races by user
        races.forEach((race: any) => {
          const creatorId = race.created_by;
          if (!racesByUser[creatorId]) {
            racesByUser[creatorId] = [];
          }
          if (racesByUser[creatorId].length < racesLimit) {
            racesByUser[creatorId].push(race);
          }
        });
      }
    }

    // Step 5: Build result array
    const result: FollowedUserTimeline[] = profiles.map((profile: any) => {
      const sailorProfile = sailorProfilesMap[profile.id];
      return {
        user: {
          userId: profile.id,
          fullName: profile.full_name || 'Unknown',
          avatarEmoji: sailorProfile?.avatar_emoji,
          avatarColor: sailorProfile?.avatar_color,
          sailingExperience: sailorProfile?.experience_level,
        },
        races: racesByUser[profile.id] || [],
        raceCount: racesByUser[profile.id]?.length || 0,
      };
    });

    // Sort by users with most upcoming races first
    result.sort((a, b) => b.raceCount - a.raceCount);

    logger.info('[CrewFinderService] getFollowedUsersWithRaces result:', {
      followedCount: result.length,
      totalRaces: result.reduce((sum, u) => sum + u.raceCount, 0),
    });

    return result;
  }

  /**
   * Get similar sailors based on shared characteristics
   * Used for discovery/suggestions
   */
  async getSimilarSailors(
    userId: string,
    options?: { limit?: number }
  ): Promise<SimilarSailor[]> {
    const limit = options?.limit ?? 20;
    const scoreMap = new Map<string, { user: SailorProfileSummary; score: number; reasons: string[] }>();

    logger.info('[CrewFinderService] getSimilarSailors called', { userId, limit });

    // Get current user's data for comparison
    await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .single();

    // Get current user's boats (classes)
    const { data: userBoats } = await supabase
      .from('sailor_boats')
      .select('class_id')
      .eq('sailor_id', userId);

    const userClassIds = new Set((userBoats || []).map((b: any) => b.class_id).filter(Boolean));

    // Get current user's clubs
    const { data: userClubs } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', userId);

    const userClubIds = new Set((userClubs || []).map((c: any) => c.club_id).filter(Boolean));

    // Get current user's fleets
    const { data: userFleets } = await supabase
      .from('fleet_members')
      .select('fleet_id')
      .eq('user_id', userId);

    const userFleetIds = new Set((userFleets || []).map((f: any) => f.fleet_id).filter(Boolean));

    // Get current user's race collaborators (people they've raced with)
    const { data: userCollabs } = await supabase
      .from('race_collaborators')
      .select('user_id, regatta_id')
      .eq('user_id', userId);

    const userRaceIds = new Set(getValidUuidList((userCollabs || []).map((c: any) => c.regatta_id)));

    // Get users already following to exclude/mark
    const followingIds = await this.getFollowingIds(userId);
    const followingSet = new Set(followingIds);

    // SCORING CRITERIA:
    // 1. Same boat class: +5
    // 2. Same club: +4
    // 3. Same fleet: +3
    // 4. Raced together: +3
    // 5. Same region: +2

    // Score by boat class
    if (userClassIds.size > 0) {
      const { data: sameClassUsers } = await supabase
        .from('sailor_boats')
        .select('sailor_id, class_id, boat_classes(name)')
        .in('class_id', Array.from(userClassIds))
        .neq('sailor_id', userId)
        .limit(100);

      (sameClassUsers || []).forEach((sb: any) => {
        const existing = scoreMap.get(sb.sailor_id);
        const className = sb.boat_classes?.name || 'same class';
        if (existing) {
          existing.score += 5;
          if (!existing.reasons.includes(`Sails ${className}`)) {
            existing.reasons.push(`Sails ${className}`);
          }
        } else {
          scoreMap.set(sb.sailor_id, {
            user: { userId: sb.sailor_id, fullName: '' },
            score: 5,
            reasons: [`Sails ${className}`],
          });
        }
      });
    }

    // Score by club membership
    if (userClubIds.size > 0) {
      const clubIds = Array.from(userClubIds);
      const clubNamesById = new Map<string, string>();

      const { data: clubsData } = await supabase
        .from('clubs')
        .select('id, name, club_name')
        .in('id', clubIds);
      (clubsData || []).forEach((club: any) => {
        if (club?.id) {
          clubNamesById.set(club.id, club.name || club.club_name || 'same club');
        }
      });

      const missingClubIds = clubIds.filter((id) => !clubNamesById.has(id));
      if (missingClubIds.length > 0) {
        const { data: yachtClubsData } = await supabase
          .from('yacht_clubs')
          .select('id, name')
          .in('id', missingClubIds);
        (yachtClubsData || []).forEach((club: any) => {
          if (club?.id) {
            clubNamesById.set(club.id, club.name || 'same club');
          }
        });
      }

      const { data: sameClubUsers } = await supabase
        .from('club_members')
        .select('user_id, club_id')
        .in('club_id', clubIds)
        .neq('user_id', userId)
        .limit(100);

      (sameClubUsers || []).forEach((cm: any) => {
        const existing = scoreMap.get(cm.user_id);
        const clubName = clubNamesById.get(cm.club_id) || 'same club';
        if (existing) {
          existing.score += 4;
          if (!existing.reasons.includes(`Member of ${clubName}`)) {
            existing.reasons.push(`Member of ${clubName}`);
          }
        } else {
          scoreMap.set(cm.user_id, {
            user: { userId: cm.user_id, fullName: '' },
            score: 4,
            reasons: [`Member of ${clubName}`],
          });
        }
      });
    }

    // Score by fleet membership
    if (userFleetIds.size > 0) {
      const { data: sameFleetUsers } = await supabase
        .from('fleet_members')
        .select('user_id, fleet_id, fleets(name)')
        .in('fleet_id', Array.from(userFleetIds))
        .neq('user_id', userId)
        .limit(100);

      (sameFleetUsers || []).forEach((fm: any) => {
        const existing = scoreMap.get(fm.user_id);
        const fleetName = fm.fleets?.name || 'same fleet';
        if (existing) {
          existing.score += 3;
          if (!existing.reasons.includes(`In ${fleetName}`)) {
            existing.reasons.push(`In ${fleetName}`);
          }
        } else {
          scoreMap.set(fm.user_id, {
            user: { userId: fm.user_id, fullName: '' },
            score: 3,
            reasons: [`In ${fleetName}`],
          });
        }
      });
    }

    // Score by race collaboration (raced together)
    if (userRaceIds.size > 0) {
      const { data: sameRaceUsers } = await supabase
        .from('race_collaborators')
        .select('user_id, regatta_id')
        .in('regatta_id', Array.from(userRaceIds))
        .neq('user_id', userId)
        .limit(100);

      (sameRaceUsers || []).forEach((rc: any) => {
        const existing = scoreMap.get(rc.user_id);
        if (existing) {
          existing.score += 3;
          if (!existing.reasons.some(r => r.includes('Raced'))) {
            existing.reasons.push('Raced together');
          }
        } else {
          scoreMap.set(rc.user_id, {
            user: { userId: rc.user_id, fullName: '' },
            score: 3,
            reasons: ['Raced together'],
          });
        }
      });
    }

    // Get profiles for scored users
    const scoredUserIds = Array.from(scoreMap.keys());
    if (scoredUserIds.length === 0) {
      // No similarity matches found - fallback to "Active Sailors" (users with most races)
      logger.info('[CrewFinderService] No similar sailors found, falling back to active sailors');
      return this.getActiveSailors(userId, limit, followingSet);
    }

    // Try 'profiles' first, then fill missing entries from 'users' table,
    // then 'user_profiles' view (reads auth.users directly) as final fallback.
    // OAuth sign-ups may only exist in auth.users if handle_new_user trigger failed.
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', scoredUserIds);

    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    // Find scored users missing from profiles and look them up in users table
    const missingFromProfiles = scoredUserIds.filter((id) => !profilesMap.has(id));
    if (missingFromProfiles.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', missingFromProfiles);
      (usersData || []).forEach((u: any) => profilesMap.set(u.id, u));

      // Final fallback: user_profiles view (reads from auth.users)
      const stillMissing = missingFromProfiles.filter((id) => !profilesMap.has(id));
      if (stillMissing.length > 0) {
        const { data: viewData } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', stillMissing);
        (viewData || []).forEach((u: any) => profilesMap.set(u.id, u));
      }
    }

    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color, experience_level')
      .in('user_id', scoredUserIds);

    const sailorProfilesMap = new Map((sailorProfiles || []).map((sp: any) => [sp.user_id, sp]));

    // Build result array with full profile data
    const result: SimilarSailor[] = [];
    for (const [userId, data] of scoreMap) {
      const profile = profilesMap.get(userId);
      const sailorProfile = sailorProfilesMap.get(userId);

      // Derive a display name: prefer full_name, fall back to email prefix
      const displayName = profile?.full_name?.trim()
        || (profile?.email ? profile.email.split('@')[0] : '');
      if (!displayName) continue; // Skip only if we truly have nothing

      result.push({
        userId,
        fullName: displayName,
        avatarEmoji: sailorProfile?.avatar_emoji,
        avatarColor: sailorProfile?.avatar_color,
        sailingExperience: sailorProfile?.experience_level,
        similarityScore: data.score,
        similarityReasons: data.reasons,
        isFollowing: followingSet.has(userId),
      });
    }

    // Sort by score (highest first), then by name
    result.sort((a, b) => {
      if (b.similarityScore !== a.similarityScore) {
        return b.similarityScore - a.similarityScore;
      }
      return a.fullName.localeCompare(b.fullName);
    });

    // If we have fewer results than the limit, backfill with other users
    if (result.length < limit) {
      const existingIds = new Set(result.map((r) => r.userId));
      existingIds.add(userId); // Exclude self
      const backfill = await this.getRecentUsers(existingIds, limit - result.length, followingSet);
      result.push(...backfill);
    }

    return result.slice(0, limit);
  }

  /**
   * Subscribe to a fleet - batch follow all members
   */
  async subscribeToFleet(userId: string, fleetId: string): Promise<{ followed: number; errors: number }> {
    logger.info('[CrewFinderService] subscribeToFleet called', { userId, fleetId });

    // Get all fleet members except the current user
    const { data: members, error: membersError } = await supabase
      .from('fleet_members')
      .select('user_id')
      .eq('fleet_id', fleetId)
      .neq('user_id', userId);

    if (membersError) {
      logger.error('Failed to get fleet members:', membersError);
      throw membersError;
    }

    if (!members || members.length === 0) {
      return { followed: 0, errors: 0 };
    }

    // Get existing follows to avoid duplicates
    const existingFollows = await this.getFollowingIds(userId);
    const existingSet = new Set(existingFollows);

    // Filter to only new follows
    const newFollows = members
      .map((m: any) => m.user_id)
      .filter((id: string) => !existingSet.has(id));

    if (newFollows.length === 0) {
      logger.info('[CrewFinderService] Already following all fleet members');
      return { followed: 0, errors: 0 };
    }

    // Batch insert new follows
    const followRows = newFollows.map((followingId: string) => ({
      follower_id: userId,
      following_id: followingId,
    }));

    const { error: insertError } = await supabase
      .from('user_follows')
      .insert(followRows);

    if (insertError) {
      logger.error('Failed to batch follow fleet members:', insertError);
      // Attempt individual follows as fallback
      let followed = 0;
      let errors = 0;
      for (const followingId of newFollows) {
        try {
          await this.followUser(userId, followingId);
          followed++;
        } catch {
          errors++;
        }
      }
      return { followed, errors };
    }

    logger.info('[CrewFinderService] subscribeToFleet success', {
      fleetId,
      membersFollowed: newFollows.length,
    });

    return { followed: newFollows.length, errors: 0 };
  }

  /**
   * Copy a race to user's timeline
   * Creates a new race entry based on another user's race
   */
  async copyRaceToTimeline(
    userId: string,
    sourceRaceId: string
  ): Promise<{ raceId: string; success: boolean }> {
    logger.info('[CrewFinderService] copyRaceToTimeline called', { userId, sourceRaceId });

    // Get the source race
    const { data: sourceRace, error: sourceError } = await supabase
      .from('regattas')
      .select('*')
      .eq('id', sourceRaceId)
      .single();

    if (sourceError || !sourceRace) {
      logger.error('Failed to get source race:', sourceError);
      throw new Error('Source race not found');
    }

    // Create a copy with the new user as owner
    const newRace = {
      ...sourceRace,
      id: undefined, // Let Supabase generate a new ID
      created_by: userId,
      // Update metadata to indicate this is a copied race
      metadata: {
        ...sourceRace.metadata,
        copied_from: sourceRaceId,
        copied_at: new Date().toISOString(),
      },
      // Reset visibility to private for copied races
      content_visibility: 'private',
    };

    // Remove fields that shouldn't be copied
    delete newRace.id;
    delete newRace.created_at;
    delete newRace.updated_at;
    // Remove columns that may not exist in the schema
    delete newRace.source_regatta_id;
    delete newRace.is_copy;

    const { data: createdRace, error: createError } = await supabase
      .from('regattas')
      .insert(newRace)
      .select('id')
      .single();

    if (createError || !createdRace) {
      logger.error('Failed to create race copy:', createError);
      throw new Error('Failed to copy race to timeline');
    }

    logger.info('[CrewFinderService] copyRaceToTimeline success', {
      sourceRaceId,
      newRaceId: createdRace.id,
    });

    return { raceId: createdRace.id, success: true };
  }

  /**
   * Get public races for discovery feed (Instagram-style)
   * Returns races with content_visibility = 'public' from all users
   * Paginated for infinite scroll
   */
  async getPublicRaces(options: {
    limit?: number;
    offset?: number;
    excludeUserId?: string;
    excludeUserIds?: string[];
  }): Promise<{ races: PublicRacePreview[]; hasMore: boolean }> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const excludeUserId = options.excludeUserId;
    const excludeUserIds = options.excludeUserIds ?? [];

    logger.info('[CrewFinderService] getPublicRaces called', { limit, offset, excludeUserId });

    // Get following IDs if excludeUserId is provided (for follow status)
    let followingSet = new Set<string>();
    if (excludeUserId) {
      try {
        const followingIds = await this.getFollowingIds(excludeUserId);
        followingSet = new Set(followingIds);
      } catch (error) {
        logger.warn('Error fetching following IDs for public races:', error);
      }
    }

    // Build query for public races (from users who allow follower sharing)
    // Include races from past 30 days and all future races
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // First, get all users who have enabled sharing
    const { data: sharingProfiles, error: sharingError } = await supabase
      .from('sailor_profiles')
      .select('user_id')
      .eq('allow_follower_sharing', true);

    if (sharingError) {
      logger.warn('Error fetching sharing profiles for public races:', sharingError);
    }

    const sharingUserIds = (sharingProfiles || []).map((p: { user_id: string }) => p.user_id);

    // If no users allow sharing, return empty
    if (sharingUserIds.length === 0) {
      return { races: [], hasMore: false };
    }

    // Filter out excluded users
    let filteredSharingUserIds = sharingUserIds;
    if (excludeUserId) {
      filteredSharingUserIds = filteredSharingUserIds.filter(id => id !== excludeUserId);
    }
    if (excludeUserIds.length > 0) {
      const excludeSet = new Set(excludeUserIds);
      filteredSharingUserIds = filteredSharingUserIds.filter(id => !excludeSet.has(id));
    }

    if (filteredSharingUserIds.length === 0) {
      return { races: [], hasMore: false };
    }

    let query = supabase
      .from('regattas')
      .select('*', { count: 'exact' })
      .in('created_by', filteredSharingUserIds)
      .gte('start_date', thirtyDaysAgo.toISOString())
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: races, error: racesError, count } = await query;

    if (racesError) {
      logger.error('Failed to get public races:', racesError);
      throw racesError;
    }

    if (!races || races.length === 0) {
      return { races: [], hasMore: false };
    }

    // Get unique user IDs from races (created_by is the owner column)
    const userIds = [...new Set(races.map((r: any) => r.created_by).filter(Boolean))];

    // Fetch user profiles (for full_name)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    // Fetch users for avatar_url
    const { data: users } = await supabase
      .from('users')
      .select('id, avatar_url')
      .in('id', userIds);

    const usersMap = new Map((users || []).map((u: any) => [u.id, u]));

    // Fetch sailor profiles for avatars
    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color')
      .in('user_id', userIds);

    const sailorProfilesMap = new Map(
      (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
    );

    // Calculate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Transform races to PublicRacePreview
    const publicRaces: PublicRacePreview[] = races.map((race: any) => {
      const profile = profilesMap.get(race.created_by);
      const userRecord = usersMap.get(race.created_by);
      const sailorProfile = sailorProfilesMap.get(race.created_by);
      const startDate = new Date(race.start_date);
      const daysUntil = Math.ceil(
        (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: race.id,
        name: race.name,
        startDate: race.start_date,
        createdAt: race.created_at,
        venue: race.venue,
        userId: race.created_by,
        userName: profile?.full_name || 'Unknown Sailor',
        avatarUrl: userRecord?.avatar_url,
        avatarEmoji: sailorProfile?.avatar_emoji,
        avatarColor: sailorProfile?.avatar_color,
        boatClass: race.boat_class,
        hasPrepNotes: !!race.prep_notes,
        hasTuning: !!race.tuning_settings,
        hasPostRaceNotes: !!race.post_race_notes,
        hasLessons: Array.isArray(race.lessons_learned) && race.lessons_learned.length > 0,
        isPast: daysUntil < 0,
        daysUntil,
        isFollowing: followingSet.has(race.created_by),
        hasSchedule: false,
        hasCoursePlan: false,
      };
    });

    logger.info('[CrewFinderService] getPublicRaces result', {
      count: publicRaces.length,
      total: count,
      hasMore: count !== null ? offset + limit < count : false,
    });

    return {
      races: publicRaces,
      hasMore: count !== null ? offset + limit < count : false,
    };
  }

  /**
   * Get races from followed users for discovery feed
   * Returns races from users the current user follows
   */
  async getFollowedUsersRaces(options: {
    userId: string;
    limit?: number;
    offset?: number;
  }): Promise<{ races: PublicRacePreview[]; hasMore: boolean; followingCount: number }> {
    const { userId } = options;
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    logger.info('[CrewFinderService] getFollowedUsersRaces called', { userId, limit, offset });

    // Get following IDs
    const followingIds = await this.getFollowingIds(userId);

    if (followingIds.length === 0) {
      return { races: [], hasMore: false, followingCount: 0 };
    }

    // Filter followed users by those who have sharing enabled
    const { data: sharingProfiles, error: sharingError } = await supabase
      .from('sailor_profiles')
      .select('user_id')
      .in('user_id', followingIds)
      .eq('allow_follower_sharing', true);

    if (sharingError) {
      logger.warn('Error fetching sharing profiles for followed users:', sharingError);
    }

    const sharingFollowingIds = (sharingProfiles || []).map((p: { user_id: string }) => p.user_id);

    if (sharingFollowingIds.length === 0) {
      return { races: [], hasMore: false, followingCount: followingIds.length };
    }

    // Get races from followed users who allow sharing
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: races, error: racesError, count } = await supabase
      .from('regattas')
      .select('*', { count: 'exact' })
      .in('created_by', sharingFollowingIds)
      .gte('start_date', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (racesError) {
      logger.error('Failed to get followed users races:', racesError);
      throw racesError;
    }

    if (!races || races.length === 0) {
      return { races: [], hasMore: false, followingCount: followingIds.length };
    }

    // Get unique user IDs from races (created_by is the owner column)
    const userIds = [...new Set(races.map((r: any) => r.created_by).filter(Boolean))];

    // Fetch user profiles (for full_name)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    // Fetch users for avatar_url
    const { data: users } = await supabase
      .from('users')
      .select('id, avatar_url')
      .in('id', userIds);

    const usersMap = new Map((users || []).map((u: any) => [u.id, u]));

    // Fetch sailor profiles for avatars
    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color')
      .in('user_id', userIds);

    const sailorProfilesMap = new Map(
      (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
    );

    // Calculate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Transform races
    const publicRaces: PublicRacePreview[] = races.map((race: any) => {
      const profile = profilesMap.get(race.created_by);
      const userRecord = usersMap.get(race.created_by);
      const sailorProfile = sailorProfilesMap.get(race.created_by);
      const startDate = new Date(race.start_date);
      const daysUntil = Math.ceil(
        (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: race.id,
        name: race.name,
        startDate: race.start_date,
        createdAt: race.created_at,
        venue: race.venue,
        userId: race.created_by,
        userName: profile?.full_name || 'Unknown Sailor',
        avatarUrl: userRecord?.avatar_url,
        avatarEmoji: sailorProfile?.avatar_emoji,
        avatarColor: sailorProfile?.avatar_color,
        boatClass: race.boat_class,
        hasPrepNotes: !!race.prep_notes,
        hasTuning: !!race.tuning_settings,
        hasPostRaceNotes: !!race.post_race_notes,
        hasLessons: Array.isArray(race.lessons_learned) && race.lessons_learned.length > 0,
        isPast: daysUntil < 0,
        daysUntil,
        isFollowing: true, // All these races are from followed users
        // Rich data — conditions & location
        expectedWindSpeedMin: race.expected_wind_speed_min ?? null,
        expectedWindSpeedMax: race.expected_wind_speed_max ?? null,
        expectedWindDirection: race.expected_wind_direction ?? null,
        expectedConditions: race.expected_conditions ?? null,
        latitude: race.latitude ?? null,
        longitude: race.longitude ?? null,
        // Race details
        raceType: race.race_type ?? null,
        organizingAuthority: race.organizing_authority ?? null,
        scoringFormula: race.scoring_formula ?? null,
        // Content counts
        hasSchedule: !!race.schedule && Array.isArray(race.schedule) && race.schedule.length > 0,
        hasCoursePlan: !!race.prohibited_areas || !!race.start_area_name || !!race.tide_gates,
      };
    });

    logger.info('[CrewFinderService] getFollowedUsersRaces result', {
      count: publicRaces.length,
      total: count,
      followingCount: followingIds.length,
    });

    return {
      races: publicRaces,
      hasMore: count !== null ? offset + limit < count : false,
      followingCount: followingIds.length,
    };
  }

  /**
   * Get active sailors - users with the most races
   * Used as a fallback when no similarity matches are found
   */
  private async getActiveSailors(
    userId: string,
    limit: number,
    followingSet: Set<string>
  ): Promise<SimilarSailor[]> {
    logger.info('[CrewFinderService] getActiveSailors called', { userId, limit });

    // Find users with the most races (excluding current user)
    // IMPORTANT: Add limit to prevent unbounded query that hangs the UI
    const { data: racesByUser, error: racesError } = await supabase
      .from('regattas')
      .select('created_by')
      .neq('created_by', userId)
      .not('created_by', 'is', null)
      .limit(1000);

    if (racesError) {
      logger.error('Failed to get races for active sailors:', racesError);
      return [];
    }

    // Count races per user
    const raceCountMap = new Map<string, number>();
    (racesByUser || []).forEach((r: any) => {
      raceCountMap.set(r.created_by, (raceCountMap.get(r.created_by) || 0) + 1);
    });

    if (raceCountMap.size === 0) {
      return [];
    }

    // Sort by race count and take top users
    const sortedUserIds = Array.from(raceCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId]) => userId);

    // Get profiles — try 'profiles' first, fill gaps from 'users', then 'user_profiles' view
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', sortedUserIds);

    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const missingFromProfiles = sortedUserIds.filter((id) => !profilesMap.has(id));
    if (missingFromProfiles.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', missingFromProfiles);
      (usersData || []).forEach((u: any) => profilesMap.set(u.id, u));

      // Final fallback: user_profiles view (reads from auth.users)
      const stillMissing = missingFromProfiles.filter((id) => !profilesMap.has(id));
      if (stillMissing.length > 0) {
        const { data: viewData } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', stillMissing);
        (viewData || []).forEach((u: any) => profilesMap.set(u.id, u));
      }
    }

    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color, experience_level')
      .in('user_id', sortedUserIds);

    const sailorProfilesMap = new Map((sailorProfiles || []).map((sp: any) => [sp.user_id, sp]));

    // Build result array
    const result: SimilarSailor[] = [];
    for (const activeUserId of sortedUserIds) {
      const profile = profilesMap.get(activeUserId);
      const sailorProfile = sailorProfilesMap.get(activeUserId);
      const raceCount = raceCountMap.get(activeUserId) || 0;

      // Derive a display name: prefer full_name, fall back to email prefix
      const displayName = profile?.full_name?.trim()
        || (profile?.email ? profile.email.split('@')[0] : '');
      if (!displayName) continue;

      result.push({
        userId: activeUserId,
        fullName: displayName,
        avatarEmoji: sailorProfile?.avatar_emoji,
        avatarColor: sailorProfile?.avatar_color,
        sailingExperience: sailorProfile?.experience_level,
        // Use race count as similarity score for sorting
        similarityScore: raceCount,
        similarityReasons: [`${raceCount} race${raceCount !== 1 ? 's' : ''}`],
        isFollowing: followingSet.has(activeUserId),
      });
    }

    // Sort by race count (highest first)
    result.sort((a, b) => b.similarityScore - a.similarityScore);

    // If we have fewer results than the limit, backfill with recent users
    if (result.length < limit) {
      const existingIds = new Set(result.map((r) => r.userId));
      existingIds.add(userId); // Exclude self
      const backfill = await this.getRecentUsers(existingIds, limit - result.length, followingSet);
      result.push(...backfill);
    }

    logger.info('[CrewFinderService] getActiveSailors returning', { count: result.length });
    return result.slice(0, limit);
  }

  /**
   * Get recent users as a broad fallback for suggestions.
   * Includes any user with a profile, regardless of race/club/fleet membership.
   * Queries 'users' table first, then falls back to 'user_profiles' view
   * (which reads from auth.users) to catch OAuth users whose handle_new_user
   * trigger may have failed.
   */
  private async getRecentUsers(
    excludeIds: Set<string>,
    limit: number,
    followingSet: Set<string>
  ): Promise<SimilarSailor[]> {
    if (limit <= 0) return [];

    logger.info('[CrewFinderService] getRecentUsers called', { excludeCount: excludeIds.size, limit });

    // Query from 'users' table (where auth flow creates rows)
    const fetchLimit = limit + excludeIds.size + 20;
    const { data: recentProfiles, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .limit(fetchLimit);

    if (error) {
      logger.error('[CrewFinderService] getRecentUsers users table query error:', error);
    }

    // Merge into a map keyed by id
    const allUsersMap = new Map<string, { id: string; full_name: string | null; email: string | null }>();
    (recentProfiles || []).forEach((p: any) => allUsersMap.set(p.id, p));

    logger.info('[CrewFinderService] getRecentUsers fetched from users table:', {
      fetchedCount: allUsersMap.size,
      names: (recentProfiles || []).map((p: any) => p.full_name || p.email).slice(0, 10),
    });

    // Also query user_profiles view (reads from auth.users directly).
    // This catches OAuth users whose handle_new_user trigger may have failed
    // and who therefore only exist in auth.users but not in public.users.
    try {
      const { data: viewProfiles, error: viewError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .limit(fetchLimit);

      if (viewError) {
        logger.warn('[CrewFinderService] getRecentUsers user_profiles view query error:', viewError);
      } else if (viewProfiles && viewProfiles.length > 0) {
        let newFromView = 0;
        viewProfiles.forEach((p: any) => {
          if (!allUsersMap.has(p.id)) {
            allUsersMap.set(p.id, p);
            newFromView++;
          }
        });
        if (newFromView > 0) {
          logger.info('[CrewFinderService] getRecentUsers found', newFromView, 'additional users from user_profiles view');
        }
      }
    } catch (viewErr) {
      logger.warn('[CrewFinderService] getRecentUsers user_profiles view fallback failed:', viewErr);
    }

    if (allUsersMap.size === 0) {
      logger.warn('[CrewFinderService] getRecentUsers returned 0 rows from all sources');
      return [];
    }

    // Filter out excluded users
    const filtered = Array.from(allUsersMap.values()).filter((p) => !excludeIds.has(p.id));

    // Get sailor profiles for avatar data
    const filteredIds = filtered.slice(0, limit).map((p) => p.id);
    if (filteredIds.length === 0) return [];

    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color, experience_level')
      .in('user_id', filteredIds);

    const sailorProfilesMap = new Map((sailorProfiles || []).map((sp: any) => [sp.user_id, sp]));

    const result: SimilarSailor[] = [];
    for (const profile of filtered.slice(0, limit)) {
      const displayName = profile.full_name?.trim()
        || (profile.email ? profile.email.split('@')[0] : '');
      if (!displayName) continue;

      const sailorProfile = sailorProfilesMap.get(profile.id);
      result.push({
        userId: profile.id,
        fullName: displayName,
        avatarEmoji: sailorProfile?.avatar_emoji,
        avatarColor: sailorProfile?.avatar_color,
        sailingExperience: sailorProfile?.experience_level,
        similarityScore: 0,
        similarityReasons: ['On BetterAt'],
        isFollowing: followingSet.has(profile.id),
      });
    }

    logger.info('[CrewFinderService] getRecentUsers returning', { count: result.length });
    return result;
  }
}

/**
 * Followed user with their race timeline
 */
export interface FollowedUserTimeline {
  user: SailorProfileSummary;
  races: any[]; // Raw regatta data
  raceCount: number;
}

/**
 * Public race preview for discovery feed
 */
export interface PublicRacePreview {
  id: string;
  name: string;
  startDate: string;
  createdAt: string;
  venue?: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  boatClass?: string;
  // Content indicators
  hasPrepNotes: boolean;
  hasTuning: boolean;
  hasPostRaceNotes: boolean;
  hasLessons: boolean;
  // Race status
  isPast: boolean;
  daysUntil: number;
  // Follow status
  isFollowing: boolean;
  // Rich data — conditions & location
  expectedWindSpeedMin?: number | null;
  expectedWindSpeedMax?: number | null;
  expectedWindDirection?: string | null;
  expectedConditions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Race details
  raceType?: string | null;
  organizingAuthority?: string | null;
  scoringFormula?: string | null;
  // Content counts for richer preview
  hasSchedule: boolean;
  hasCoursePlan: boolean;
}

/**
 * Similar sailor with similarity scoring
 */
export interface SimilarSailor extends SailorProfileSummary {
  similarityScore: number;
  similarityReasons: string[];
  isFollowing: boolean;
}

// Export singleton instance
export const CrewFinderService = new CrewFinderServiceClass();

// Export type for dependency injection
export type CrewFinderServiceType = typeof CrewFinderService;
