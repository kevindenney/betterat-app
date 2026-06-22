/**
 * CommunityService
 *
 * Service for managing communities (Reddit-style groups).
 * Handles CRUD operations, membership, search, and discovery.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type {
  Community,
  CommunityCategory,
  CommunityMembership,
  CommunityFlair,
  CommunityType,
  CommunityMemberRole,
  CreateCommunityParams,
  UpdateCommunityParams,
  CommunitySearchParams,
  CommunitiesListParams,
  CommunityListResponse,
  UserCommunitiesResponse,
} from '@/types/community';

const logger = createLogger('CommunityService');

class CommunityServiceClass {
  // ============================================================================
  // CATEGORIES
  // ============================================================================

  /**
   * Get all community categories
   */
  async getCategories(): Promise<CommunityCategory[]> {
    const { data, error } = await supabase
      .from('community_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('[CommunityService] Error fetching categories:', error);
      throw error;
    }

    return data || [];
  }

  // ============================================================================
  // COMMUNITY CRUD
  // ============================================================================

  /**
   * Get a community by slug
   */
  async getCommunityBySlug(slug: string): Promise<Community | null> {
    const { data, error } = await supabase
      .from('communities_with_stats')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('[CommunityService] Error fetching community:', error);
      throw error;
    }

    // Get user membership status
    const { data: { user } } = await supabase.auth.getUser();
    if (user && data) {
      const membership = await this.getMembership(user.id, data.id);
      return {
        ...data,
        is_member: !!membership,
        user_role: membership?.role || null,
      };
    }

    return data;
  }

  /**
   * Get a community by ID
   */
  async getCommunityById(id: string): Promise<Community | null> {
    const { data, error } = await supabase
      .from('communities_with_stats')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('[CommunityService] Error fetching community:', error);
      throw error;
    }

    // Get user membership status
    const { data: { user } } = await supabase.auth.getUser();
    if (user && data) {
      const membership = await this.getMembership(user.id, data.id);
      return {
        ...data,
        is_member: !!membership,
        user_role: membership?.role || null,
      };
    }

    return data;
  }

  /**
   * Get community by linked entity (venue, boat class, etc.)
   */
  async getCommunityByLinkedEntity(
    entityType: string,
    entityId: string
  ): Promise<Community | null> {
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('linked_entity_type', entityType)
      .eq('linked_entity_id', entityId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('[CommunityService] Error fetching community by entity:', error);
      throw error;
    }

    return data;
  }

  /**
   * List communities with filters
   */
  async getCommunities(params: CommunitiesListParams = {}): Promise<CommunityListResponse> {
    const {
      category_id,
      community_type,
      sort = 'popular',
      limit = 20,
      offset = 0,
    } = params;

    let query = supabase
      .from('communities_with_stats')
      .select('*', { count: 'exact' });

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (community_type) {
      query = query.eq('community_type', community_type);
    }

    // Sorting
    switch (sort) {
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'active':
        query = query.order('last_activity_at', { ascending: false });
        break;
      case 'alphabetical':
        query = query.order('name', { ascending: true });
        break;
      case 'popular':
      default:
        query = query.order('member_count', { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[CommunityService] Error listing communities:', error);
      throw error;
    }

    // Get user memberships for the returned communities
    const communities = await this.attachUserMemberships(data || []);

    return {
      data: communities,
      count: count || 0,
      hasMore: (offset + limit) < (count || 0),
    };
  }

  /**
   * Search communities by name
   */
  async searchCommunities(params: CommunitySearchParams): Promise<CommunityListResponse> {
    const {
      query: searchQuery,
      category_id,
      community_type,
      is_official,
      limit = 20,
      offset = 0,
    } = params;

    let query = supabase
      .from('communities_with_stats')
      .select('*', { count: 'exact' });

    if (searchQuery && searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery.trim()}%`);
    }

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (community_type) {
      query = query.eq('community_type', community_type);
    }

    if (is_official !== undefined) {
      query = query.eq('is_official', is_official);
    }

    query = query
      .order('member_count', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[CommunityService] Error searching communities:', error);
      throw error;
    }

    const communities = await this.attachUserMemberships(data || []);

    return {
      data: communities,
      count: count || 0,
      hasMore: (offset + limit) < (count || 0),
    };
  }

  /**
   * Create a new community
   */
  async createCommunity(params: CreateCommunityParams): Promise<Community> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to create a community');

    // Generate slug from name
    const slug = this.generateSlug(params.name);

    const { data, error } = await supabase
      .from('communities')
      .insert({
        name: params.name,
        slug,
        description: params.description || null,
        community_type: params.community_type,
        category_id: params.category_id || null,
        icon_url: params.icon_url || null,
        banner_url: params.banner_url || null,
        created_by: user.id,
        linked_entity_type: params.linked_entity_type || null,
        linked_entity_id: params.linked_entity_id || null,
        metadata: params.metadata || {},
      })
      .select()
      .single();

    if (error) {
      logger.error('[CommunityService] Error creating community:', error);
      throw error;
    }

    // Auto-join creator as admin
    await this.joinCommunity(data.id, 'admin');

    return data;
  }

  /**
   * Update a community
   */
  async updateCommunity(communityId: string, params: UpdateCommunityParams): Promise<Community> {
    const { data, error } = await supabase
      .from('communities')
      .update({
        ...params,
        updated_at: new Date().toISOString(),
      })
      .eq('id', communityId)
      .select()
      .single();

    if (error) {
      logger.error('[CommunityService] Error updating community:', error);
      throw error;
    }

    return data;
  }

  // ============================================================================
  // MEMBERSHIP
  // ============================================================================

  /**
   * Get user's membership in a community
   */
  async getMembership(userId: string, communityId: string): Promise<CommunityMembership | null> {
    const { data, error } = await supabase
      .from('community_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('community_id', communityId)
      .maybeSingle();

    if (error) {
      logger.error('[CommunityService] Error getting membership:', error);
      return null;
    }

    return data;
  }

  /**
   * Join a community
   */
  async joinCommunity(communityId: string, role: CommunityMemberRole = 'member'): Promise<void> {
    logger.info('[CommunityService] joinCommunity called, communityId:', communityId, 'role:', role);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    logger.info('[CommunityService] getUser result, user:', user?.id, 'authError:', authError);

    if (!user) {
      logger.error('[CommunityService] No user found - must be logged in to join');
      throw new Error('Must be logged in to join a community');
    }

    logger.info('[CommunityService] Upserting membership for user:', user.id);
    const { data, error } = await supabase
      .from('community_memberships')
      .upsert({
        user_id: user.id,
        community_id: communityId,
        role,
        notifications_enabled: true,
      }, {
        onConflict: 'user_id,community_id',
      })
      .select();

    logger.info('[CommunityService] Upsert result, data:', data, 'error:', error);

    if (error) {
      logger.error('[CommunityService] Error joining community:', error);
      throw error;
    }

    logger.info('[CommunityService] Successfully joined community');
  }

  /**
   * Leave a community
   */
  async leaveCommunity(communityId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to leave a community');

    const { data, error } = await supabase
      .from('community_memberships')
      .delete()
      .eq('user_id', user.id)
      .eq('community_id', communityId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('[CommunityService] Error leaving community:', error);
      throw error;
    }
    if (!data) throw new Error('Community membership not found.');
  }

  /**
   * Auto-join a community by slug if user is not already a member
   * Used for Dragon Worlds integration where users are auto-joined on first auth
   *
   * @param slug - The community slug to join
   * @returns The community if joined successfully, null if already a member or not found
   */
  async autoJoinCommunityBySlug(slug: string): Promise<Community | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.warn('[CommunityService] Cannot auto-join: not logged in');
      return null;
    }

    // Find the community
    const community = await this.getCommunityBySlug(slug);
    if (!community) {
      logger.warn(`[CommunityService] Community not found: ${slug}`);
      return null;
    }

    // Check if already a member
    const membership = await this.getMembership(user.id, community.id);
    if (membership) {
      logger.info(`[CommunityService] Already a member of ${slug}`);
      return community;
    }

    // Join the community
    try {
      await this.joinCommunity(community.id);
      logger.info(`[CommunityService] Auto-joined community: ${slug}`);

      // Return the community with updated membership status
      return {
        ...community,
        is_member: true,
        user_role: 'member',
      };
    } catch (error) {
      logger.error(`[CommunityService] Failed to auto-join ${slug}:`, error);
      return null;
    }
  }

  /**
   * Check if user is from Dragon Worlds (Firebase auth bridge)
   * and auto-join them to the Dragon Worlds community if needed
   *
   * @param dragonWorldsSlug - Optional custom slug (defaults to '2027-hk-dragon-worlds')
   * @returns True if user was auto-joined or already a member
   */
  async handleDragonWorldsAutoJoin(
    dragonWorldsSlug: string = '2027-hk-dragon-worlds'
  ): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    // Check if user is from Dragon Worlds
    const authSource = user.user_metadata?.auth_source;
    const isDragonWorldsUser = authSource === 'dragon_worlds';

    // Also check the users table for firebase_uid
    const { data: profile } = await supabase
      .from('users')
      .select('firebase_uid, auth_source')
      .eq('id', user.id)
      .maybeSingle();

    const hasFirebaseUid = !!profile?.firebase_uid;
    const isFromDragonWorlds = isDragonWorldsUser || hasFirebaseUid || profile?.auth_source === 'dragon_worlds';

    if (!isFromDragonWorlds) {
      // Not a Dragon Worlds user, no auto-join needed
      return false;
    }

    // Auto-join the Dragon Worlds community
    const community = await this.autoJoinCommunityBySlug(dragonWorldsSlug);
    return community !== null;
  }

  /**
   * Get all communities the current user has joined
   * @param userId - Optional user ID to fetch communities for (uses Supabase auth if not provided)
   */
  async getUserCommunities(userId?: string): Promise<UserCommunitiesResponse> {
    let userIdToUse = userId;

    // If no userId provided, try to get from Supabase auth
    if (!userIdToUse) {
      const { data: { user } } = await supabase.auth.getUser();
      userIdToUse = user?.id;
    }

    if (!userIdToUse) {
      return { joined: [], moderated: [] };
    }

    const { data, error } = await supabase
      .from('community_memberships')
      .select(`
        *,
        community:communities_with_stats (*)
      `)
      .eq('user_id', userIdToUse)
      .order('joined_at', { ascending: false });

    if (error) {
      logger.error('[CommunityService] Error getting user communities:', error);
      throw error;
    }

    const memberships = data || [];
    const joined: Community[] = [];
    const moderated: Community[] = [];

    for (const m of memberships) {
      if (m.community) {
        const community: Community = {
          ...m.community,
          is_member: true,
          user_role: m.role,
        };
        joined.push(community);
        if (m.role === 'moderator' || m.role === 'admin') {
          moderated.push(community);
        }
      }
    }

    return { joined, moderated };
  }

  /**
   * Get community members
   */
  async getCommunityMembers(
    communityId: string,
    limit = 50,
    offset = 0
  ): Promise<{ data: CommunityMembership[]; count: number }> {
    const { data, error, count } = await supabase
      .from('community_memberships')
      .select(`
        *,
        user:profiles!user_id (
          id,
          full_name,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('community_id', communityId)
      .order('joined_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[CommunityService] Error getting community members:', error);
      throw error;
    }

    return {
      data: data || [],
      count: count || 0,
    };
  }

  /**
   * Toggle notification settings for a membership
   */
  async toggleNotifications(communityId: string, enabled: boolean): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in');

    const { data, error } = await supabase
      .from('community_memberships')
      .update({ notifications_enabled: enabled })
      .eq('user_id', user.id)
      .eq('community_id', communityId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('[CommunityService] Error toggling notifications:', error);
      throw error;
    }
    if (!data) throw new Error('Community membership not found.');
  }

  // ============================================================================
  // FLAIRS
  // ============================================================================

  /**
   * Get flairs for a community
   */
  async getCommunityFlairs(communityId: string): Promise<CommunityFlair[]> {
    const { data, error } = await supabase
      .from('community_flairs')
      .select('*')
      .eq('community_id', communityId)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('[CommunityService] Error getting flairs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create a flair
   */
  async createFlair(
    communityId: string,
    name: string,
    displayName: string,
    color = '#6B7280'
  ): Promise<CommunityFlair> {
    const { data, error } = await supabase
      .from('community_flairs')
      .insert({
        community_id: communityId,
        name,
        display_name: displayName,
        color,
      })
      .select()
      .single();

    if (error) {
      logger.error('[CommunityService] Error creating flair:', error);
      throw error;
    }

    return data;
  }

  // ============================================================================
  // DISCOVERY
  // ============================================================================

  /**
   * Get popular communities for discovery
   */
  async getPopularCommunities(limit = 10): Promise<Community[]> {
    const { data, error } = await supabase
      .from('communities_with_stats')
      .select('*')
      .order('member_count', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[CommunityService] Error getting popular communities:', error);
      return [];
    }

    return this.attachUserMemberships(data || []);
  }

  /**
   * Get trending communities (most new members recently)
   */
  async getTrendingCommunities(limit = 10): Promise<Community[]> {
    const { data, error } = await supabase
      .from('communities_with_stats')
      .select('*')
      .order('new_members_7d', { ascending: false })
      .order('posts_last_24h', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[CommunityService] Error getting trending communities:', error);
      return [];
    }

    return this.attachUserMemberships(data || []);
  }

  /**
   * Get communities by category for discovery
   */
  async getCommunitiesByCategory(categoryId: string, limit = 10): Promise<Community[]> {
    const { data, error } = await supabase
      .from('communities_with_stats')
      .select('*')
      .eq('category_id', categoryId)
      .order('member_count', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[CommunityService] Error getting communities by category:', error);
      return [];
    }

    return this.attachUserMemberships(data || []);
  }

  /**
   * Get communities by type
   */
  async getCommunitiesByType(type: CommunityType, limit = 20): Promise<Community[]> {
    const { data, error } = await supabase
      .from('communities_with_stats')
      .select('*')
      .eq('community_type', type)
      .order('member_count', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[CommunityService] Error getting communities by type:', error);
      return [];
    }

    return this.attachUserMemberships(data || []);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Generate a URL-friendly slug from a name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Attach user membership status to communities
   */
  private async attachUserMemberships(communities: Community[]): Promise<Community[]> {
    if (communities.length === 0) return communities;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return communities.map(c => ({ ...c, is_member: false, user_role: null }));
    }

    const communityIds = communities.map(c => c.id);
    const { data: memberships } = await supabase
      .from('community_memberships')
      .select('community_id, role')
      .eq('user_id', user.id)
      .in('community_id', communityIds);

    const membershipMap = new Map(
      (memberships || []).map(m => [m.community_id, m.role])
    );

    return communities.map(c => ({
      ...c,
      is_member: membershipMap.has(c.id),
      user_role: membershipMap.get(c.id) || null,
    }));
  }
}

export const CommunityService = new CommunityServiceClass();
