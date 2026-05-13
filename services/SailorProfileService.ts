/**
 * SailorProfileService
 *
 * Service for Strava-style sailor profiles:
 * - Profile data with extended fields
 * - Cached statistics
 * - Achievements/trophies
 * - Media gallery
 * - Follow counts and social stats
 */

import { supabase } from '@/services/supabase';
import { CrewFinderService } from '@/services/CrewFinderService';
import { createLogger } from '@/lib/utils/logger';
import { isMissingRelationError, isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';

const logger = createLogger('SailorProfileService');
const ENABLE_SAILOR_OPTIONAL_TABLES =
  String(process.env.EXPO_PUBLIC_ENABLE_SAILOR_PROFILE_TABLES || '').toLowerCase() === 'true';

const isSchemaUnavailableError = (error: any): boolean => {
  if (!error) return false;
  if (isMissingRelationError(error) || isMissingSupabaseColumn(error)) return true;

  const code = typeof error.code === 'string' ? error.code : '';
  if (code.startsWith('PGRST') || code === '42P01' || code === '42703') return true;

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    message.includes('does not exist') ||
    message.includes('could not find') ||
    message.includes('schema cache') ||
    message.includes('not found in the schema')
  );
};

// =============================================================================
// TYPES
// =============================================================================

export interface SailorProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  bio?: string;
  location?: string;
  sailingSince?: number;
  homeClubId?: string;
  homeClubName?: string;
  websiteUrl?: string;
  instagramHandle?: string;
  isProfilePublic: boolean;
}

export interface SailorStats {
  totalRaces: number;
  wins: number;
  podiums: number;
  averageFinish?: number;
  winRate?: number;
  seasonRaces: number;
  seasonWins: number;
  seasonPodiums: number;
  lastRaceDate?: string;
}

export type AchievementType =
  | 'first_race'
  | 'first_win'
  | 'first_podium'
  | 'race_milestone_10'
  | 'race_milestone_50'
  | 'race_milestone_100'
  | 'win_streak_3'
  | 'win_streak_5'
  | 'series_champion'
  | 'regatta_champion'
  | 'year_end_champion'
  | 'perfect_season'
  | 'comeback_victory'
  | 'most_improved';

export interface SailorAchievement {
  id: string;
  achievementType: AchievementType;
  title: string;
  description?: string;
  icon?: string;
  earnedAt: string;
  relatedRegattaId?: string;
  relatedRegattaName?: string;
}

export interface SailorMedia {
  id: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaType: 'image' | 'video';
  regattaId?: string;
  regattaName?: string;
  caption?: string;
  isFeatured: boolean;
  uploadDate: string;
}

export interface SailorBoat {
  id: string;
  sailNumber?: string;
  name?: string;
  classId: string;
  className: string;
  manufacturer?: string;
  year?: number;
}

export interface SailorRaceSummary {
  id: string;
  name: string;
  startDate: string;
  venue?: string;
  boatClass?: string;
  result?: number;
  fleetSize?: number;
  isPast: boolean;
}

export interface FullSailorProfile extends SailorProfile {
  stats: SailorStats;
  achievements: SailorAchievement[];
  boats: SailorBoat[];
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  // Follow options (only meaningful when isFollowing === true)
  isFavorite: boolean;
  notificationsEnabled: boolean;
  isMuted: boolean;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class SailorProfileServiceClass {
  private sailorProfilesUnavailable = !ENABLE_SAILOR_OPTIONAL_TABLES;
  private sailorBoatsUnavailable = !ENABLE_SAILOR_OPTIONAL_TABLES;

  /**
   * Get complete sailor profile with stats, achievements, and social data
   */
  async getFullProfile(
    targetUserId: string,
    currentUserId?: string
  ): Promise<FullSailorProfile | null> {
    logger.info('Getting full profile', { targetUserId, currentUserId });

    // Fetch all data in parallel for performance
    const [profile, stats, achievements, boats, counts, isFollowing, followOptions] =
      await Promise.all([
        this.getProfile(targetUserId),
        this.getStats(targetUserId),
        this.getAchievements(targetUserId),
        this.getBoats(targetUserId),
        this.getFollowCounts(targetUserId),
        currentUserId && currentUserId !== targetUserId
          ? this.checkIsFollowing(currentUserId, targetUserId)
          : Promise.resolve(false),
        currentUserId && currentUserId !== targetUserId
          ? CrewFinderService.getFollowOptions(currentUserId, targetUserId)
          : Promise.resolve({ isFavorite: false, notificationsEnabled: false, isMuted: false }),
      ]);

    if (!profile) {
      logger.warn('Profile not found', { targetUserId });
      return null;
    }

    return {
      ...profile,
      stats: stats || {
        totalRaces: 0,
        wins: 0,
        podiums: 0,
        seasonRaces: 0,
        seasonWins: 0,
        seasonPodiums: 0,
      },
      achievements: achievements || [],
      boats: boats || [],
      followerCount: counts.followers,
      followingCount: counts.following,
      isFollowing,
      isOwnProfile: currentUserId === targetUserId,
      isFavorite: followOptions.isFavorite,
      notificationsEnabled: followOptions.notificationsEnabled,
      isMuted: followOptions.isMuted,
    };
  }

  /**
   * Get basic profile data
   */
  async getProfile(userId: string): Promise<SailorProfile | null> {
    // Fetch from users table (OAuth users only exist in 'users', not 'profiles')
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      logger.warn('Profile not found', { userId, error: profileError });
      return null;
    }

    let sailorProfile: any = null;
    if (!this.sailorProfilesUnavailable) {
      // Fetch sailor_profiles data
      let sailorProfileQuery = await supabase
        .from('sailor_profiles')
        .select(
          `
          user_id,
          display_name,
          avatar_url,
          avatar_emoji,
          avatar_color,
          bio,
          location,
          sailing_since,
          home_club_id,
          website_url,
          instagram_handle,
          is_profile_public
        `
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (sailorProfileQuery.error && isMissingSupabaseColumn(sailorProfileQuery.error)) {
        logger.warn('[diagnostic] getProfile fallback -> minimal sailor_profiles select', {
          userId,
          code: sailorProfileQuery.error.code,
          message: sailorProfileQuery.error.message,
        });
        sailorProfileQuery = await supabase
          .from('sailor_profiles')
          .select('user_id,display_name,is_profile_public')
          .eq('user_id', userId)
          .maybeSingle();
      }

      if (sailorProfileQuery.error) {
        if (isSchemaUnavailableError(sailorProfileQuery.error)) {
          this.sailorProfilesUnavailable = true;
          logger.warn('[diagnostic] getProfile disabling sailor_profiles queries for this session', {
            userId,
            code: sailorProfileQuery.error.code,
            message: sailorProfileQuery.error.message,
          });
        } else {
          logger.warn('Error fetching sailor_profiles', { userId, error: sailorProfileQuery.error });
        }
      } else {
        sailorProfile = sailorProfileQuery.data as any;
      }
    }

    // Fetch home club name if exists
    let homeClubName: string | undefined;
    if (sailorProfile?.home_club_id) {
      const { data: club } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', sailorProfile.home_club_id)
        .single();
      homeClubName = club?.name;
    }

    return {
      userId: profile.id,
      displayName: sailorProfile?.display_name || profile.full_name || 'Sailor',
      avatarUrl: sailorProfile?.avatar_url,
      avatarEmoji: sailorProfile?.avatar_emoji,
      avatarColor: sailorProfile?.avatar_color,
      bio: sailorProfile?.bio,
      location: sailorProfile?.location,
      sailingSince: sailorProfile?.sailing_since,
      homeClubId: sailorProfile?.home_club_id,
      homeClubName,
      websiteUrl: sailorProfile?.website_url,
      instagramHandle: sailorProfile?.instagram_handle,
      isProfilePublic: sailorProfile?.is_profile_public ?? true,
    };
  }

  /**
   * Get cached stats for a sailor
   */
  async getStats(userId: string): Promise<SailorStats | null> {
    const { data, error } = await supabase
      .from('sailor_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // Stats might not exist yet - return null
      if (error.code === 'PGRST116' || isMissingRelationError(error)) {
        return null;
      }
      logger.warn('Error fetching stats', { userId, error });
      return null;
    }

    return {
      totalRaces: data.total_races || 0,
      wins: data.wins || 0,
      podiums: data.podiums || 0,
      averageFinish: data.average_finish,
      winRate: data.win_rate,
      seasonRaces: data.season_races || 0,
      seasonWins: data.season_wins || 0,
      seasonPodiums: data.season_podiums || 0,
      lastRaceDate: data.last_race_date,
    };
  }

  /**
   * Get achievements for a sailor
   */
  async getAchievements(userId: string): Promise<SailorAchievement[]> {
    let result: { data: any[] | null; error: any } = await supabase
      .from('sailor_achievements')
      .select(
        `
        id,
        achievement_type,
        title,
        description,
        icon,
        earned_at,
        related_regatta_id,
        regattas(name)
      `
      )
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (result.error && isMissingSupabaseColumn(result.error)) {
      logger.info('[diagnostic] getAchievements fallback -> no regattas join', {
        userId,
        code: result.error.code,
        message: result.error.message,
      });
      result = await supabase
        .from('sailor_achievements')
        .select('id,achievement_type,title,description,icon,earned_at,related_regatta_id')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });
    }

    if (result.error) {
      if (!isMissingRelationError(result.error)) {
        logger.warn('Error fetching achievements', { userId, error: result.error });
      }
      return [];
    }

    return ((result.data as any[]) || []).map((a: any) => ({
      id: a.id,
      achievementType: a.achievement_type,
      title: a.title,
      description: a.description,
      icon: a.icon,
      earnedAt: a.earned_at,
      relatedRegattaId: a.related_regatta_id,
      relatedRegattaName: a.regattas?.name,
    }));
  }

  /**
   * Get boats for a sailor
   */
  async getBoats(userId: string): Promise<SailorBoat[]> {
    if (this.sailorBoatsUnavailable) {
      return [];
    }

    let result = await supabase
      .from('sailor_boats')
      .select(
        `
        id,
        sail_number,
        name,
        class_id,
        manufacturer,
        year,
        boat_classes(id, name)
      `
      )
      .eq('sailor_id', userId);

    if (result.error && isMissingSupabaseColumn(result.error, 'sailor_boats.sailor_id')) {
      logger.info('[diagnostic] getBoats fallback -> sailor_id missing, trying user_id', {
        userId,
        code: result.error.code,
        message: result.error.message,
      });
      result = await supabase
        .from('sailor_boats')
        .select(
          `
          id,
          sail_number,
          name,
          class_id,
          manufacturer,
          year,
          boat_classes(id, name)
        `
        )
        .eq('user_id', userId);
    }

    if (result.error && (isMissingRelationError(result.error) || isMissingSupabaseColumn(result.error))) {
      // fallback without relational join
      logger.warn('[diagnostic] getBoats fallback -> relation-free select', {
        userId,
        code: result.error.code,
        message: result.error.message,
      });
      let fallback = await supabase
        .from('sailor_boats')
        .select('id,sail_number,name,class_id,manufacturer,year')
        .eq('sailor_id', userId);
      if (fallback.error && isMissingSupabaseColumn(fallback.error, 'sailor_boats.sailor_id')) {
        fallback = await supabase
          .from('sailor_boats')
          .select('id,sail_number,name,class_id,manufacturer,year')
          .eq('user_id', userId);
      }
      result = fallback as any;
    }

    if (result.error) {
      if (isSchemaUnavailableError(result.error)) {
        this.sailorBoatsUnavailable = true;
        logger.warn('[diagnostic] getBoats disabling sailor_boats queries for this session', {
          userId,
          code: result.error.code,
          message: result.error.message,
        });
      } else if (!isMissingRelationError(result.error)) {
        logger.warn('Error fetching boats', { userId, error: result.error });
      }
      return [];
    }

    return (((result.data as any[]) || [])).map((b: any) => ({
      id: b.id,
      sailNumber: b.sail_number,
      name: b.name,
      classId: b.class_id,
      className: b.boat_classes?.name || 'Unknown',
      manufacturer: b.manufacturer,
      year: b.year,
    }));
  }

  /**
   * Get media gallery for a sailor
   */
  async getMedia(
    userId: string,
    options?: { limit?: number; featuredOnly?: boolean }
  ): Promise<SailorMedia[]> {
    let query = supabase
      .from('sailor_media')
      .select(
        `
        id,
        media_url,
        thumbnail_url,
        media_type,
        regatta_id,
        caption,
        is_featured,
        upload_date,
        regattas(name)
      `
      )
      .eq('user_id', userId)
      .order('upload_date', { ascending: false });

    if (options?.featuredOnly) {
      query = query.eq('is_featured', true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn('Error fetching media', { userId, error });
      return [];
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      mediaUrl: m.media_url,
      thumbnailUrl: m.thumbnail_url,
      mediaType: m.media_type || 'image',
      regattaId: m.regatta_id,
      regattaName: m.regattas?.name,
      caption: m.caption,
      isFeatured: m.is_featured,
      uploadDate: m.upload_date,
    }));
  }

  /**
   * Get follow counts for a user
   */
  async getFollowCounts(userId: string): Promise<FollowCounts> {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    return {
      followers: followers || 0,
      following: following || 0,
    };
  }

  /**
   * Check if one user is following another
   */
  async checkIsFollowing(
    followerId: string,
    followingId: string
  ): Promise<boolean> {
    const { data } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    return !!data;
  }

  /**
   * Get race history for a sailor (paginated)
   */
  async getRaceHistory(
    userId: string,
    options?: { limit?: number; offset?: number; pastOnly?: boolean; upcomingOnly?: boolean }
  ): Promise<{ races: SailorRaceSummary[]; hasMore: boolean }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const now = new Date().toISOString();

    let query = supabase
      .from('regattas')
      .select('*', { count: 'exact' })
      .eq('created_by', userId)
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.pastOnly) {
      query = query.lt('start_date', now);
    } else if (options?.upcomingOnly) {
      query = query.gte('start_date', now);
    }

    let { data, error, count } = await query;

    if (error && isMissingSupabaseColumn(error, 'regattas.start_date')) {
      logger.info('[diagnostic] getRaceHistory fallback -> start_date missing, ordering by created_at', {
        userId,
        code: error.code,
        message: error.message,
      });
      const fallback = await supabase
        .from('regattas')
        .select('*', { count: 'exact' })
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      data = fallback.data as any;
      error = fallback.error as any;
      count = fallback.count as any;
    }

    if (error) {
      // Avoid throwing into UI for schema/permission differences.
      logger.warn('Error fetching race history', { userId, error });
      return { races: [], hasMore: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const races: SailorRaceSummary[] = (data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      startDate: r.start_date || r.event_date || r.created_at || new Date().toISOString(),
      venue: r.venue || r.start_area_name || r.venue_name,
      boatClass: r.boat_class || r.class_name,
      result: r.result_position,
      fleetSize: r.fleet_size,
      isPast: new Date(r.start_date || r.event_date || r.created_at || Date.now()) < today,
    }));

    return {
      races,
      hasMore: count !== null ? offset + limit < count : false,
    };
  }

  /**
   * Get followers list (paginated)
   */
  async getFollowers(
    userId: string,
    currentUserId?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{
    users: {
      userId: string;
      displayName: string;
      avatarUrl?: string;
      avatarEmoji?: string;
      avatarColor?: string;
      isFollowing: boolean;
    }[];
    hasMore: boolean;
  }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const { data, error, count } = await supabase
      .from('user_follows')
      .select('follower_id', { count: 'exact' })
      .eq('following_id', userId)
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error fetching followers', { userId, error });
      throw error;
    }

    if (!data || data.length === 0) {
      return { users: [], hasMore: false };
    }

    const followerIds = data.map((f: any) => f.follower_id);

    // Get current user's following list for status
    let currentUserFollowing = new Set<string>();
    if (currentUserId) {
      const { data: following } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', currentUserId);
      currentUserFollowing = new Set(
        (following || []).map((f: any) => f.following_id)
      );
    }

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', followerIds);

    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, display_name, avatar_url, avatar_emoji, avatar_color')
      .in('user_id', followerIds);

    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const sailorProfilesMap = new Map(
      (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
    );

    const users = followerIds.map((id: string) => {
      const profile = profilesMap.get(id);
      const sailorProfile = sailorProfilesMap.get(id);

      return {
        userId: id,
        displayName:
          sailorProfile?.display_name || profile?.full_name || 'Sailor',
        avatarUrl: sailorProfile?.avatar_url,
        avatarEmoji: sailorProfile?.avatar_emoji,
        avatarColor: sailorProfile?.avatar_color,
        isFollowing: currentUserFollowing.has(id),
      };
    });

    return {
      users,
      hasMore: count !== null ? offset + limit < count : false,
    };
  }

  /**
   * Get following list (paginated)
   */
  async getFollowing(
    userId: string,
    currentUserId?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{
    users: {
      userId: string;
      displayName: string;
      avatarUrl?: string;
      avatarEmoji?: string;
      avatarColor?: string;
      isFollowing: boolean;
    }[];
    hasMore: boolean;
  }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const { data, error, count } = await supabase
      .from('user_follows')
      .select('following_id', { count: 'exact' })
      .eq('follower_id', userId)
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error fetching following', { userId, error });
      throw error;
    }

    if (!data || data.length === 0) {
      return { users: [], hasMore: false };
    }

    const followingIds = data.map((f: any) => f.following_id);

    // Get current user's following list for status
    let currentUserFollowing = new Set<string>();
    if (currentUserId) {
      const { data: following } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', currentUserId);
      currentUserFollowing = new Set(
        (following || []).map((f: any) => f.following_id)
      );
    }

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', followingIds);

    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, display_name, avatar_url, avatar_emoji, avatar_color')
      .in('user_id', followingIds);

    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const sailorProfilesMap = new Map(
      (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
    );

    const users = followingIds.map((id: string) => {
      const profile = profilesMap.get(id);
      const sailorProfile = sailorProfilesMap.get(id);

      return {
        userId: id,
        displayName:
          sailorProfile?.display_name || profile?.full_name || 'Sailor',
        avatarUrl: sailorProfile?.avatar_url,
        avatarEmoji: sailorProfile?.avatar_emoji,
        avatarColor: sailorProfile?.avatar_color,
        isFollowing: currentUserFollowing.has(id),
      };
    });

    return {
      users,
      hasMore: count !== null ? offset + limit < count : false,
    };
  }

  /**
   * Update profile fields
   */
  async updateProfile(
    userId: string,
    updates: Partial<{
      displayName: string;
      bio: string;
      location: string;
      sailingSince: number;
      websiteUrl: string;
      instagramHandle: string;
      isProfilePublic: boolean;
    }>
  ): Promise<void> {
    const sailorProfileUpdates: Record<string, any> = {};

    if (updates.displayName !== undefined) {
      sailorProfileUpdates.display_name = updates.displayName;
    }
    if (updates.bio !== undefined) {
      sailorProfileUpdates.bio = updates.bio;
    }
    if (updates.location !== undefined) {
      sailorProfileUpdates.location = updates.location;
    }
    if (updates.sailingSince !== undefined) {
      sailorProfileUpdates.sailing_since = updates.sailingSince;
    }
    if (updates.websiteUrl !== undefined) {
      sailorProfileUpdates.website_url = updates.websiteUrl;
    }
    if (updates.instagramHandle !== undefined) {
      sailorProfileUpdates.instagram_handle = updates.instagramHandle;
    }
    if (updates.isProfilePublic !== undefined) {
      sailorProfileUpdates.is_profile_public = updates.isProfilePublic;
    }

    if (Object.keys(sailorProfileUpdates).length > 0) {
      const { error } = await supabase
        .from('sailor_profiles')
        .upsert({
          user_id: userId,
          ...sailorProfileUpdates,
        })
        .eq('user_id', userId);

      if (error) {
        logger.error('Error updating profile', { userId, error });
        throw error;
      }
    }

    logger.info('Profile updated', { userId });
  }

  /**
   * Add media to gallery
   */
  async addMedia(
    userId: string,
    media: {
      mediaUrl: string;
      thumbnailUrl?: string;
      mediaType?: 'image' | 'video';
      regattaId?: string;
      caption?: string;
      isFeatured?: boolean;
    }
  ): Promise<string> {
    const { data, error } = await supabase
      .from('sailor_media')
      .insert({
        user_id: userId,
        media_url: media.mediaUrl,
        thumbnail_url: media.thumbnailUrl,
        media_type: media.mediaType || 'image',
        regatta_id: media.regattaId,
        caption: media.caption,
        is_featured: media.isFeatured || false,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error adding media', { userId, error });
      throw error;
    }

    return data.id;
  }

  /**
   * Delete media from gallery
   */
  async deleteMedia(userId: string, mediaId: string): Promise<void> {
    const { error } = await supabase
      .from('sailor_media')
      .delete()
      .eq('id', mediaId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error deleting media', { userId, mediaId, error });
      throw error;
    }
  }

  /**
   * Set featured media
   */
  async setFeaturedMedia(
    userId: string,
    mediaId: string,
    featured: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('sailor_media')
      .update({ is_featured: featured })
      .eq('id', mediaId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error updating featured status', {
        userId,
        mediaId,
        error,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const SailorProfileService = new SailorProfileServiceClass();

// Export type for dependency injection
export type SailorProfileServiceType = typeof SailorProfileService;
