/**
 * FollowerPostService
 *
 * CRUD service for follower posts — updates sailors publish to their followers.
 * Follows the singleton pattern used by CrewFinderService.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('FollowerPostService');

// =============================================================================
// TYPES
// =============================================================================

export type FollowerPostType =
  | 'general'
  | 'race_recap'
  | 'tip'
  | 'gear_update'
  | 'milestone';

export interface FollowerPost {
  id: string;
  userId: string;
  content: string;
  imageUrls: string[];
  linkedRaceId: string | null;
  postType: FollowerPostType;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  userName?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  linkedRaceName?: string;
}

export interface CreateFollowerPostInput {
  content: string;
  postType?: FollowerPostType;
  linkedRaceId?: string;
  imageUrls?: string[];
}

// =============================================================================
// SERVICE
// =============================================================================

class FollowerPostServiceClass {
  /**
   * Create a new follower post
   */
  async createPost(input: CreateFollowerPostInput): Promise<FollowerPost | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.warn('createPost called without authenticated user');
      return null;
    }

    const { data, error } = await supabase
      .from('follower_posts')
      .insert({
        user_id: user.id,
        content: input.content,
        post_type: input.postType || 'general',
        linked_race_id: input.linkedRaceId || null,
        image_urls: input.imageUrls || [],
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating follower post:', error);
      return null;
    }

    return this.transformRow(data);
  }

  /**
   * Delete a follower post (owner only — enforced by RLS)
   */
  async deletePost(postId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('follower_posts')
      .delete()
      .eq('id', postId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Error deleting follower post:', error);
      return false;
    }
    if (!data) return false;

    return true;
  }

  /**
   * Get posts from a list of user IDs (for the merged feed).
   * Joins profile data for display.
   */
  async getFollowerPosts(
    userIds: string[],
    limit: number = 20,
    offset: number = 0
  ): Promise<{ posts: FollowerPost[]; hasMore: boolean }> {
    if (userIds.length === 0) {
      return { posts: [], hasMore: false };
    }

    const { data, error } = await supabase
      .from('follower_posts')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      logger.error('Error fetching follower posts:', error);
      return { posts: [], hasMore: false };
    }

    if (!data || data.length === 0) {
      return { posts: [], hasMore: false };
    }

    // Fetch profile data for post authors
    const authorIds = [...new Set(data.map((r: any) => r.user_id))];
    const profiles = await this.fetchProfiles(authorIds);

    // Fetch linked race names
    const raceIds = data
      .filter((r: any) => r.linked_race_id)
      .map((r: any) => r.linked_race_id);
    const raceNames = raceIds.length > 0 ? await this.fetchRaceNames(raceIds) : new Map();

    const posts = data.map((row: any) => {
      const profile = profiles.get(row.user_id);
      return {
        ...this.transformRow(row),
        userName: profile?.fullName || 'Unknown Sailor',
        avatarUrl: profile?.avatarUrl,
        avatarEmoji: profile?.avatarEmoji,
        avatarColor: profile?.avatarColor,
        linkedRaceName: row.linked_race_id ? raceNames.get(row.linked_race_id) : undefined,
      };
    });

    return {
      posts,
      hasMore: data.length > limit,
    };
  }

  /**
   * Get posts by a specific user
   */
  async getUserPosts(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ posts: FollowerPost[]; hasMore: boolean }> {
    return this.getFollowerPosts([userId], limit, offset);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private transformRow(row: any): FollowerPost {
    return {
      id: row.id,
      userId: row.user_id,
      content: row.content,
      imageUrls: row.image_urls || [],
      linkedRaceId: row.linked_race_id,
      postType: row.post_type,
      likeCount: row.like_count || 0,
      commentCount: row.comment_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async fetchProfiles(
    userIds: string[]
  ): Promise<Map<string, { fullName: string; avatarUrl?: string; avatarEmoji?: string; avatarColor?: string }>> {
    const map = new Map<string, { fullName: string; avatarUrl?: string; avatarEmoji?: string; avatarColor?: string }>();

    if (userIds.length === 0) return map;

    // Fetch from users table (includes avatar_url)
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    // Fetch from sailor_profiles for avatar emoji/color
    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, avatar_emoji, avatar_color')
      .in('user_id', userIds);

    const sailorMap = new Map(
      (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
    );

    for (const user of users || []) {
      const sailor = sailorMap.get(user.id);
      map.set(user.id, {
        fullName: user.full_name || 'Unknown Sailor',
        avatarUrl: user.avatar_url,
        avatarEmoji: sailor?.avatar_emoji,
        avatarColor: sailor?.avatar_color,
      });
    }

    return map;
  }

  private async fetchRaceNames(raceIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (raceIds.length === 0) return map;

    const { data } = await supabase
      .from('regattas')
      .select('id, name')
      .in('id', raceIds);

    for (const row of data || []) {
      map.set(row.id, row.name);
    }

    return map;
  }
}

export const FollowerPostService = new FollowerPostServiceClass();
