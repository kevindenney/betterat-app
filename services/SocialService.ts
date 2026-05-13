/**
 * SocialService
 *
 * Service for social interactions on races:
 * - Likes/kudos on regattas
 * - Comments (threaded)
 * - Enhanced follow options (favorite, notifications, mute)
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('SocialService');

// =============================================================================
// TYPES
// =============================================================================

export interface RegattaLike {
  id: string;
  regattaId: string;
  userId: string;
  createdAt: string;
}

export interface RegattaComment {
  id: string;
  regattaId: string;
  userId: string;
  parentId?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  userName?: string;
  userAvatarUrl?: string;
  userAvatarEmoji?: string;
  userAvatarColor?: string;
  replyCount?: number;
  replies?: RegattaComment[];
}

export interface FollowOptions {
  isFavorite: boolean;
  notificationsEnabled: boolean;
  isMuted: boolean;
}

export interface UserFollowWithOptions {
  id: string;
  followerId: string;
  followingId: string;
  isFavorite: boolean;
  notificationsEnabled: boolean;
  isMuted: boolean;
  createdAt: string;
}

export interface LikeInfo {
  hasLiked: boolean;
  likeCount: number;
  recentLikers?: {
    userId: string;
    displayName: string;
    avatarEmoji?: string;
  }[];
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class SocialServiceClass {
  // ===========================================================================
  // LIKES
  // ===========================================================================

  /**
   * Like a regatta
   */
  async likeRegatta(userId: string, regattaId: string): Promise<void> {
    const { error } = await supabase.from('regatta_likes').insert({
      user_id: userId,
      regatta_id: regattaId,
    });

    if (error) {
      // Handle duplicate like gracefully
      if (error.code === '23505') {
        logger.info('Already liked regatta', { userId, regattaId });
        return;
      }
      logger.error('Failed to like regatta', { userId, regattaId, error });
      throw error;
    }

    logger.info('Liked regatta', { userId, regattaId });
  }

  /**
   * Unlike a regatta
   */
  async unlikeRegatta(userId: string, regattaId: string): Promise<void> {
    const { error } = await supabase
      .from('regatta_likes')
      .delete()
      .eq('user_id', userId)
      .eq('regatta_id', regattaId);

    if (error) {
      logger.error('Failed to unlike regatta', { userId, regattaId, error });
      throw error;
    }

    logger.info('Unliked regatta', { userId, regattaId });
  }

  /**
   * Toggle like on a regatta
   */
  async toggleLike(
    userId: string,
    regattaId: string
  ): Promise<{ liked: boolean }> {
    const hasLiked = await this.hasUserLiked(userId, regattaId);

    if (hasLiked) {
      await this.unlikeRegatta(userId, regattaId);
      return { liked: false };
    } else {
      await this.likeRegatta(userId, regattaId);
      return { liked: true };
    }
  }

  /**
   * Check if user has liked a regatta
   */
  async hasUserLiked(userId: string, regattaId: string): Promise<boolean> {
    const { data } = await supabase
      .from('regatta_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('regatta_id', regattaId)
      .maybeSingle();

    return !!data;
  }

  /**
   * Get like count for a regatta
   */
  async getLikeCount(regattaId: string): Promise<number> {
    const { count, error } = await supabase
      .from('regatta_likes')
      .select('*', { count: 'exact', head: true })
      .eq('regatta_id', regattaId);

    if (error) {
      logger.warn('Error getting like count', { regattaId, error });
      return 0;
    }

    return count || 0;
  }

  /**
   * Get like info (count + user status + recent likers)
   */
  async getLikeInfo(regattaId: string, userId?: string): Promise<LikeInfo> {
    // Get count and recent likers in parallel
    const [countResult, { data: recentLikes }] = await Promise.all([
      supabase
        .from('regatta_likes')
        .select('*', { count: 'exact', head: true })
        .eq('regatta_id', regattaId),
      supabase
        .from('regatta_likes')
        .select('user_id')
        .eq('regatta_id', regattaId)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    // Check if current user has liked
    let hasLiked = false;
    if (userId) {
      const { data } = await supabase
        .from('regatta_likes')
        .select('id')
        .eq('user_id', userId)
        .eq('regatta_id', regattaId)
        .maybeSingle();
      hasLiked = !!data;
    }

    // Get names for recent likers
    let recentLikers: LikeInfo['recentLikers'] = [];
    if (recentLikes && recentLikes.length > 0) {
      const userIds = recentLikes.map((l: any) => l.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const { data: sailorProfiles } = await supabase
        .from('sailor_profiles')
        .select('user_id, display_name, avatar_emoji')
        .in('user_id', userIds);

      const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const sailorProfilesMap = new Map(
        (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
      );

      recentLikers = userIds.map((id: string) => ({
        userId: id,
        displayName:
          sailorProfilesMap.get(id)?.display_name ||
          profilesMap.get(id)?.full_name ||
          'Sailor',
        avatarEmoji: sailorProfilesMap.get(id)?.avatar_emoji,
      }));
    }

    return {
      hasLiked,
      likeCount: countResult.count || 0,
      recentLikers,
    };
  }

  /**
   * Get users who liked a regatta
   */
  async getLikers(
    regattaId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<
    { userId: string; displayName: string; avatarEmoji?: string }[]
  > {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const { data: likes, error } = await supabase
      .from('regatta_likes')
      .select('user_id')
      .eq('regatta_id', regattaId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !likes || likes.length === 0) {
      return [];
    }

    const userIds = likes.map((l: any) => l.user_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, display_name, avatar_emoji')
      .in('user_id', userIds);

    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const sailorProfilesMap = new Map(
      (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
    );

    return userIds.map((id: string) => ({
      userId: id,
      displayName:
        sailorProfilesMap.get(id)?.display_name ||
        profilesMap.get(id)?.full_name ||
        'Sailor',
      avatarEmoji: sailorProfilesMap.get(id)?.avatar_emoji,
    }));
  }

  // ===========================================================================
  // COMMENTS
  // ===========================================================================

  /**
   * Add a comment to a regatta
   */
  async addComment(
    userId: string,
    regattaId: string,
    content: string,
    parentId?: string
  ): Promise<RegattaComment> {
    const { data, error } = await supabase
      .from('regatta_comments')
      .insert({
        user_id: userId,
        regatta_id: regattaId,
        content,
        parent_id: parentId,
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to add comment', { userId, regattaId, error });
      throw error;
    }

    logger.info('Added comment', { userId, regattaId, commentId: data.id });

    return {
      id: data.id,
      regattaId: data.regatta_id,
      userId: data.user_id,
      parentId: data.parent_id,
      content: data.content,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Update a comment
   */
  async updateComment(
    userId: string,
    commentId: string,
    content: string
  ): Promise<void> {
    const { error } = await supabase
      .from('regatta_comments')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to update comment', { userId, commentId, error });
      throw error;
    }

    logger.info('Updated comment', { userId, commentId });
  }

  /**
   * Delete (soft) a comment
   */
  async deleteComment(userId: string, commentId: string): Promise<void> {
    const { error } = await supabase
      .from('regatta_comments')
      .update({ is_deleted: true })
      .eq('id', commentId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete comment', { userId, commentId, error });
      throw error;
    }

    logger.info('Deleted comment', { userId, commentId });
  }

  /**
   * Get comments for a regatta (threaded)
   */
  async getComments(
    regattaId: string,
    options?: { limit?: number; includeReplies?: boolean }
  ): Promise<RegattaComment[]> {
    const limit = options?.limit ?? 100;
    const includeReplies = options?.includeReplies ?? true;

    // Get all comments (both top-level and replies)
    const { data, error } = await supabase
      .from('regatta_comments')
      .select('*')
      .eq('regatta_id', regattaId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error('Failed to get comments', { regattaId, error });
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Get user info
    const userIds = [...new Set(data.map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const { data: sailorProfiles } = await supabase
      .from('sailor_profiles')
      .select('user_id, display_name, avatar_url, avatar_emoji, avatar_color')
      .in('user_id', userIds);

    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const sailorProfilesMap = new Map(
      (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
    );

    // Transform and thread comments
    const commentsMap = new Map<string, RegattaComment>();
    const topLevelComments: RegattaComment[] = [];

    data.forEach((c: any) => {
      const sailorProfile = sailorProfilesMap.get(c.user_id);
      const profile = profilesMap.get(c.user_id);

      const comment: RegattaComment = {
        id: c.id,
        regattaId: c.regatta_id,
        userId: c.user_id,
        parentId: c.parent_id,
        content: c.content,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        userName: sailorProfile?.display_name || profile?.full_name || 'Sailor',
        userAvatarUrl: sailorProfile?.avatar_url,
        userAvatarEmoji: sailorProfile?.avatar_emoji,
        userAvatarColor: sailorProfile?.avatar_color,
        replyCount: 0,
        replies: [],
      };

      commentsMap.set(c.id, comment);

      if (!c.parent_id) {
        topLevelComments.push(comment);
      }
    });

    // Thread replies if requested
    if (includeReplies) {
      data.forEach((c: any) => {
        if (c.parent_id) {
          const parent = commentsMap.get(c.parent_id);
          const reply = commentsMap.get(c.id);
          if (parent && reply) {
            parent.replies = parent.replies || [];
            parent.replies.push(reply);
            parent.replyCount = (parent.replyCount || 0) + 1;
          }
        }
      });
    }

    return topLevelComments;
  }

  /**
   * Get comment count for a regatta
   */
  async getCommentCount(regattaId: string): Promise<number> {
    const { count, error } = await supabase
      .from('regatta_comments')
      .select('*', { count: 'exact', head: true })
      .eq('regatta_id', regattaId)
      .eq('is_deleted', false);

    if (error) {
      logger.warn('Error getting comment count', { regattaId, error });
      return 0;
    }

    return count || 0;
  }

  // ===========================================================================
  // ENHANCED FOLLOW OPTIONS
  // ===========================================================================

  /**
   * Get follow relationship with options
   */
  async getFollowOptions(
    followerId: string,
    followingId: string
  ): Promise<FollowOptions | null> {
    const { data, error } = await supabase
      .from('user_follows')
      .select('is_favorite, notifications_enabled, is_muted')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      isFavorite: data.is_favorite || false,
      notificationsEnabled: data.notifications_enabled || false,
      isMuted: data.is_muted || false,
    };
  }

  /**
   * Update follow options
   */
  async updateFollowOptions(
    followerId: string,
    followingId: string,
    options: Partial<FollowOptions>
  ): Promise<void> {
    const updates: Record<string, any> = {};

    if (options.isFavorite !== undefined) {
      updates.is_favorite = options.isFavorite;
    }
    if (options.notificationsEnabled !== undefined) {
      updates.notifications_enabled = options.notificationsEnabled;
    }
    if (options.isMuted !== undefined) {
      updates.is_muted = options.isMuted;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    const { error } = await supabase
      .from('user_follows')
      .update(updates)
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) {
      logger.error('Failed to update follow options', {
        followerId,
        followingId,
        error,
      });
      throw error;
    }

    logger.info('Updated follow options', { followerId, followingId, options });
  }

  /**
   * Set favorite status
   */
  async setFavorite(
    followerId: string,
    followingId: string,
    isFavorite: boolean
  ): Promise<void> {
    await this.updateFollowOptions(followerId, followingId, { isFavorite });
  }

  /**
   * Set notification status
   */
  async setNotifications(
    followerId: string,
    followingId: string,
    enabled: boolean
  ): Promise<void> {
    await this.updateFollowOptions(followerId, followingId, {
      notificationsEnabled: enabled,
    });
  }

  /**
   * Set mute status
   */
  async setMuted(
    followerId: string,
    followingId: string,
    isMuted: boolean
  ): Promise<void> {
    await this.updateFollowOptions(followerId, followingId, { isMuted });
  }

  /**
   * Get favorite follows for a user (for feed ordering)
   */
  async getFavoriteFollowIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)
      .eq('is_favorite', true);

    if (error) {
      logger.warn('Error getting favorites', { userId, error });
      return [];
    }

    return (data || []).map((f: any) => f.following_id);
  }

  /**
   * Get muted follows for a user (for feed filtering)
   */
  async getMutedFollowIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)
      .eq('is_muted', true);

    if (error) {
      logger.warn('Error getting muted users', { userId, error });
      return [];
    }

    return (data || []).map((f: any) => f.following_id);
  }

  /**
   * Get follows with notification enabled for a user
   */
  async getNotificationEnabledFollowers(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', userId)
      .eq('notifications_enabled', true);

    if (error) {
      logger.warn('Error getting notification followers', { userId, error });
      return [];
    }

    return (data || []).map((f: any) => f.follower_id);
  }

  // ===========================================================================
  // BULK FOLLOW OPERATIONS
  // ===========================================================================

  /**
   * Follow multiple users at once
   */
  async followMultipleUsers(
    followerId: string,
    followingIds: string[]
  ): Promise<{ followed: number; errors: number }> {
    if (followingIds.length === 0) {
      return { followed: 0, errors: 0 };
    }

    // Filter out self-follows
    const validIds = followingIds.filter((id) => id !== followerId);

    if (validIds.length === 0) {
      return { followed: 0, errors: 0 };
    }

    // Get existing follows to avoid duplicates
    const { data: existing } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', followerId)
      .in('following_id', validIds);

    const existingSet = new Set((existing || []).map((f: any) => f.following_id));
    const newFollows = validIds.filter((id) => !existingSet.has(id));

    if (newFollows.length === 0) {
      return { followed: 0, errors: 0 };
    }

    // Batch insert
    const rows = newFollows.map((followingId) => ({
      follower_id: followerId,
      following_id: followingId,
    }));

    const { error } = await supabase.from('user_follows').insert(rows);

    if (error) {
      logger.error('Failed to batch follow', { followerId, error });
      // Attempt individual follows as fallback
      let followed = 0;
      let errors = 0;

      for (const followingId of newFollows) {
        try {
          const { error: individualError } = await supabase
            .from('user_follows')
            .insert({ follower_id: followerId, following_id: followingId });
          if (individualError) {
            errors++;
          } else {
            followed++;
          }
        } catch {
          errors++;
        }
      }

      return { followed, errors };
    }

    logger.info('Batch followed users', {
      followerId,
      count: newFollows.length,
    });
    return { followed: newFollows.length, errors: 0 };
  }
}

// Export singleton instance
export const SocialService = new SocialServiceClass();

// Export type for dependency injection
export type SocialServiceType = typeof SocialService;
