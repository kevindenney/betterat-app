import { supabase } from './supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { realtimeService } from './RealtimeService';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('FleetSocialService');

export type PostType = 'race_result' | 'tuning_guide' | 'check_in' | 'event' | 'announcement' | 'discussion';
export type PostVisibility = 'fleet' | 'public' | 'private';
export type NotificationType =
  | 'new_post' | 'post_like' | 'post_comment' | 'post_share'
  | 'tuning_guide_posted' | 'race_result_posted' | 'event_created'
  | 'member_check_in' | 'mention';

export interface FleetPost {
  id: string;
  fleetId: string;
  authorId: string;
  postType: PostType;
  content: string | null;
  metadata: Record<string, any>;
  visibility: PostVisibility;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;

  // Aggregated data (joined)
  author?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  isLikedByUser?: boolean;
  isBookmarkedByUser?: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;

  // Joined data
  author?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

export interface FleetNotification {
  id: string;
  userId: string;
  fleetId: string;
  notificationType: NotificationType;
  relatedPostId: string | null;
  relatedCommentId: string | null;
  actorId: string | null;
  message: string | null;
  isRead: boolean;
  createdAt: string;

  // Joined data
  actor?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  fleet?: {
    id: string;
    name: string;
  };
}

export interface CreatePostParams {
  fleetId: string;
  postType: PostType;
  content?: string;
  metadata?: Record<string, any>;
  visibility?: PostVisibility;
}

export interface CreateCommentParams {
  postId: string;
  content: string;
  parentCommentId?: string;
}

export interface CreateNotificationParams {
  userId: string;
  fleetId: string;
  notificationType: NotificationType;
  actorId?: string | null;
  relatedPostId?: string | null;
  relatedCommentId?: string | null;
  message?: string | null;
  isRead?: boolean;
}

class FleetSocialService {
  private fleetSocialEnabled = true;
  private fleetSocialWarningLogged = false;

  /**
   * Re-enable fleet social features after they were disabled due to an error.
   * Call this after database schema has been fixed.
   */
  resetFleetSocialState(): void {
    this.fleetSocialEnabled = true;
    this.fleetSocialWarningLogged = false;
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Fetch user data for author information
   * Works around PostgREST schema cache issues with auth.users joins
   */
  private async getUserData(userId: string): Promise<{ id: string; name: string; avatar_url?: string } | null> {
    try {
      // Query the profiles table instead of using admin API
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, email, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        // Fallback: try the users table
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', userId)
          .single();

        if (userError || !user) {
          logger.warn('[FleetSocialService] Could not fetch user data:', error, userError);
          return null;
        }

        return {
          id: user.id,
          name: user.full_name || user.email || 'Unknown',
        };
      }

      if (profile) {
        const name = profile.full_name || 
          [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 
          profile.email || 
          'Unknown';
        return {
          id: profile.id,
          name,
          avatar_url: profile.avatar_url || undefined,
        };
      }
    } catch (err) {
      logger.warn('[FleetSocialService] Could not fetch user data:', err);
    }
    return null;
  }

  // ==========================================
  // POSTS
  // ==========================================

  async getFeedPosts(fleetId: string, options?: {
    limit?: number;
    offset?: number;
    postType?: PostType;
    userId?: string;
  }): Promise<FleetPost[]> {
    if (!this.ensureFleetSocialAvailable()) {
      return [];
    }

    const userId = options?.userId;

    let query = supabase
      .from('fleet_posts')
      .select(`
        *,
        likes:fleet_post_likes(count),
        comments:fleet_post_comments(count),
        shares:fleet_post_shares(count)
      `)
      .eq('fleet_id', fleetId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.postType) {
      query = query.eq('post_type', options.postType);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 25) - 1);
    }

    const { data, error } = await query;

    if (error) {
      if (this.handleFleetSocialTableError(error, 'loading fleet posts')) {
        return [];
      }
      logger.error('Error fetching feed posts:', error);
      throw error;
    }

    // Get user's likes and bookmarks if userId provided
    let userLikes: Set<string> = new Set();
    let userBookmarks: Set<string> = new Set();

    if (userId && data && data.length > 0) {
      const postIds = data.map(p => p.id);

      const [likesRes, bookmarksRes] = await Promise.all([
        supabase
          .from('fleet_post_likes')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', postIds),
        supabase
          .from('fleet_post_bookmarks')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', postIds),
      ]);

      userLikes = new Set(likesRes.data?.map(l => l.post_id) || []);
      userBookmarks = new Set(bookmarksRes.data?.map(b => b.post_id) || []);
    }

    // Fetch author data for all unique author IDs
    const authorIds = [...new Set((data || []).map(p => p.author_id))];
    const authorsMap = new Map<string, { id: string; name: string; avatar_url?: string }>();

    if (authorIds.length > 0) {
      // First try profiles table
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, email, avatar_url')
        .in('id', authorIds);

      // Then try users table for any missing
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', authorIds);

      // Build map from profiles first
      profiles?.forEach(profile => {
        const name = profile.full_name || 
          [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 
          profile.email || 
          'Unknown';
        authorsMap.set(profile.id, {
          id: profile.id,
          name,
          avatar_url: profile.avatar_url || undefined,
        });
      });

      // Fill in from users table for any not in profiles
      users?.forEach(user => {
        if (!authorsMap.has(user.id)) {
          authorsMap.set(user.id, {
            id: user.id,
            name: user.full_name || user.email || 'Unknown',
          });
        }
      });
    }

    return (data || []).map(post => ({
      id: post.id,
      fleetId: post.fleet_id,
      authorId: post.author_id,
      postType: post.post_type,
      content: post.content,
      metadata: post.metadata || {},
      visibility: post.visibility,
      isPinned: post.is_pinned,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      author: authorsMap.get(post.author_id),
      likesCount: Array.isArray(post.likes) ? post.likes.length : (post.likes?.[0]?.count || 0),
      commentsCount: Array.isArray(post.comments) ? post.comments.length : (post.comments?.[0]?.count || 0),
      sharesCount: Array.isArray(post.shares) ? post.shares.length : (post.shares?.[0]?.count || 0),
      isLikedByUser: userLikes.has(post.id),
      isBookmarkedByUser: userBookmarks.has(post.id),
    }));
  }

  async createPost(params: CreatePostParams): Promise<FleetPost> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('fleet_posts')
      .insert({
        fleet_id: params.fleetId,
        author_id: userData.user.id,
        post_type: params.postType,
        content: params.content || null,
        metadata: params.metadata || {},
        visibility: params.visibility || 'fleet',
      })
      .select()
      .single();

    if (error) {
      if (this.handleFleetSocialTableError(error, 'creating a post')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error creating post:', error);
      throw error;
    }

    // Fetch author data separately
    const author = await this.getUserData(userData.user.id);

    // Notify fleet members based on post type
    this.notifyOnNewPost(data.id, data.fleet_id, data.post_type);
    this.notifyMentions(data.id, data.fleet_id, params.metadata, userData.user.id);

    return this.mapPost({ ...data, author });
  }

  async updatePost(postId: string, updates: {
    content?: string;
    metadata?: Record<string, any>;
    visibility?: PostVisibility;
  }): Promise<void> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { error } = await supabase
      .from('fleet_posts')
      .update({
        content: updates.content,
        metadata: updates.metadata,
        visibility: updates.visibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId);

    if (error) {
      if (this.handleFleetSocialTableError(error, 'updating a post')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error updating post:', error);
      throw error;
    }
  }

  async deletePost(postId: string): Promise<void> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { error } = await supabase
      .from('fleet_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      if (this.handleFleetSocialTableError(error, 'deleting a post')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error deleting post:', error);
      throw error;
    }
  }

  // ==========================================
  // LIKES
  // ==========================================

  async likePost(postId: string): Promise<void> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('fleet_post_likes')
      .insert({
        post_id: postId,
        user_id: userData.user.id,
      });

    if (error) {
      if (error.code === '23505') {
        return; // Ignore duplicate key errors
      }
      if (this.handleFleetSocialTableError(error, 'liking a post')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error liking post:', error);
      throw error;
    }

    // Notify post author about the like (best-effort)
    try {
      const { data: postInfo } = await supabase
        .from('fleet_posts')
        .select('author_id, fleet_id')
        .eq('id', postId)
        .single();

      if (postInfo && postInfo.author_id && postInfo.author_id !== userData.user.id) {
        await this.createNotification({
          userId: postInfo.author_id,
          fleetId: postInfo.fleet_id,
          notificationType: 'post_like',
          actorId: userData.user.id,
          relatedPostId: postId,
          message: 'Your post was liked',
        });
      }
    } catch (notificationError) {
      logger.error('Error creating like notification:', notificationError);
    }
  }

  async unlikePost(postId: string): Promise<void> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('fleet_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userData.user.id);

    if (error) {
      if (this.handleFleetSocialTableError(error, 'unliking a post')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error unliking post:', error);
      throw error;
    }
  }

  // ==========================================
  // COMMENTS
  // ==========================================

  async getComments(postId: string): Promise<PostComment[]> {
    if (!this.ensureFleetSocialAvailable()) {
      return [];
    }

    const { data, error } = await supabase
      .from('fleet_post_comments')
      .select()
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      if (this.handleFleetSocialTableError(error, 'loading comments')) {
        return [];
      }
      logger.error('Error fetching comments:', error);
      throw error;
    }

    // Fetch author data for all unique author IDs
    const authorIds = [...new Set((data || []).map(c => c.author_id))];
    const authorsMap = new Map<string, { id: string; name: string; avatar_url?: string }>();

    if (authorIds.length > 0) {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const relevantUsers = users?.filter(u => authorIds.includes(u.id)) || [];

      relevantUsers.forEach(user => {
        authorsMap.set(user.id, {
          id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Unknown',
          avatar_url: user.user_metadata?.avatar_url,
        });
      });
    }

    return (data || []).map(comment => ({
      id: comment.id,
      postId: comment.post_id,
      authorId: comment.author_id,
      content: comment.content,
      parentCommentId: comment.parent_comment_id,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      author: authorsMap.get(comment.author_id),
    }));
  }

  async createComment(params: CreateCommentParams): Promise<PostComment> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('fleet_post_comments')
      .insert({
        post_id: params.postId,
        author_id: userData.user.id,
        content: params.content,
        parent_comment_id: params.parentCommentId || null,
      })
      .select()
      .single();

    if (error) {
      if (this.handleFleetSocialTableError(error, 'creating a comment')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error creating comment:', error);
      throw error;
    }

    // Fetch author data separately
    const author = await this.getUserData(userData.user.id);

    // Notify post author about new comment (best-effort, non-blocking)
    try {
      const { data: postInfo } = await supabase
        .from('fleet_posts')
        .select('author_id, fleet_id, metadata')
        .eq('id', params.postId)
        .single();

      if (postInfo && postInfo.author_id && postInfo.author_id !== userData.user.id) {
        await this.createNotification({
          userId: postInfo.author_id,
          fleetId: postInfo.fleet_id,
          notificationType: 'post_comment',
          actorId: userData.user.id,
          relatedPostId: params.postId,
          relatedCommentId: data.id,
          message: 'New comment on your post',
        });
      }

      // Mention notifications (if comment metadata includes mentions)
      this.notifyMentions(params.postId, postInfo?.fleet_id, (params as any)?.metadata, userData.user.id);
    } catch (notificationError) {
      logger.error('Error creating comment notification:', notificationError);
    }

    return {
      id: data.id,
      postId: data.post_id,
      authorId: data.author_id,
      content: data.content,
      parentCommentId: data.parent_comment_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      author,
    };
  }

  async deleteComment(commentId: string): Promise<void> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { error } = await supabase
      .from('fleet_post_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      if (this.handleFleetSocialTableError(error, 'deleting a comment')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error deleting comment:', error);
      throw error;
    }
  }

  // ==========================================
  // BOOKMARKS
  // ==========================================

  async bookmarkPost(postId: string): Promise<void> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('fleet_post_bookmarks')
      .insert({
        post_id: postId,
        user_id: userData.user.id,
      });

    if (error) {
      if (error.code === '23505') {
        return;
      }
      if (this.handleFleetSocialTableError(error, 'bookmarking a post')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error bookmarking post:', error);
      throw error;
    }
  }

  async unbookmarkPost(postId: string): Promise<void> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('fleet_post_bookmarks')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userData.user.id);

    if (error) {
      if (this.handleFleetSocialTableError(error, 'removing a bookmark')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error removing bookmark:', error);
      throw error;
    }
  }

  async getBookmarkedPosts(userId: string): Promise<FleetPost[]> {
    if (!this.ensureFleetSocialAvailable()) {
      return [];
    }

    const { data, error } = await supabase
      .from('fleet_post_bookmarks')
      .select('post_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false});

    if (error) {
      if (this.handleFleetSocialTableError(error, 'loading bookmarked posts')) {
        return [];
      }
      logger.error('Error fetching bookmarked posts:', error);
      throw error;
    }

    // Fetch the posts separately
    const postIds = (data || []).map(b => b.post_id);
    if (postIds.length === 0) return [];

    const { data: posts, error: postsError } = await supabase
      .from('fleet_posts')
      .select()
      .in('id', postIds);

    if (postsError) {
      logger.error('Error fetching bookmarked posts details:', postsError);
      return [];
    }

    // Fetch author data
    const authorIds = [...new Set((posts || []).map(p => p.author_id))];
    const authorsMap = new Map<string, { id: string; name: string; avatar_url?: string }>();

    if (authorIds.length > 0) {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const relevantUsers = users?.filter(u => authorIds.includes(u.id)) || [];

      relevantUsers.forEach(user => {
        authorsMap.set(user.id, {
          id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Unknown',
          avatar_url: user.user_metadata?.avatar_url,
        });
      });
    }

    return (posts || []).map(post => this.mapPost({ ...post, author: authorsMap.get(post.author_id) }));
  }

  // ==========================================
  // SHARES
  // ==========================================

  async sharePost(postId: string, targetFleetId: string, message?: string): Promise<void> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('fleet_post_shares')
      .insert({
        post_id: postId,
        shared_by: userData.user.id,
        target_fleet_id: targetFleetId,
        message: message || null,
      });

    if (error) {
      if (this.handleFleetSocialTableError(error, 'sharing a post')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error sharing post:', error);
      throw error;
    }
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  async getNotifications(userId: string, options?: {
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<FleetNotification[]> {
    let query = supabase
      .from('fleet_notifications')
      .select(`
        *,
        actor:actor_id (id, full_name, avatar_url),
        fleet:fleet_id (id, name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching notifications:', error);
      throw error;
    }

    return (data || []).map(notif => ({
      id: notif.id,
      userId: notif.user_id,
      fleetId: notif.fleet_id,
      notificationType: notif.notification_type,
      relatedPostId: notif.related_post_id,
      relatedCommentId: notif.related_comment_id,
      actorId: notif.actor_id,
      message: notif.message,
      isRead: notif.is_read,
      createdAt: notif.created_at,
      actor: notif.actor ? {
        id: notif.actor.id,
        name: notif.actor.full_name || 'Someone',
        avatar_url: notif.actor.avatar_url,
      } : undefined,
      fleet: notif.fleet ? {
        id: notif.fleet.id,
        name: notif.fleet.name,
      } : undefined,
    }));
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('fleet_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('fleet_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // ==========================================
  // REAL-TIME SUBSCRIPTIONS
  // ==========================================

  subscribeToFleetPosts(fleetId: string, callback: (post: FleetPost) => void): () => void {
    const channelName = `fleet_posts:${fleetId}`;
    const handler = async (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
      // Fetch full post with author data
      const newRow = payload.new as { id: string };
      const { data } = await supabase
        .from('fleet_posts')
        .select()
        .eq('id', newRow.id)
        .single();

      if (data) {
        const author = await this.getUserData(data.author_id);
        callback(this.mapPost({ ...data, author }));
      }
    };

    realtimeService.subscribe(
      channelName,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'fleet_posts',
        filter: `fleet_id=eq.${fleetId}`,
      },
      handler
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handler);
    };
  }

  subscribeToPostLikes(postId: string, callback: (count: number) => void): () => void {
    const channelName = `post_likes:${postId}`;
    const handler = async () => {
      const { count } = await supabase
        .from('fleet_post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      callback(count || 0);
    };

    realtimeService.subscribe(
      channelName,
      {
        event: '*',
        schema: 'public',
        table: 'fleet_post_likes',
        filter: `post_id=eq.${postId}`,
      },
      handler
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handler);
    };
  }

  subscribeToNotifications(userId: string, callback: (notification: FleetNotification) => void): () => void {
    const channelName = `notifications:${userId}`;
    const handler = async (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
      const newRow = payload.new as { id: string };
      const { data } = await supabase
        .from('fleet_notifications')
        .select(`
          *,
          actor:actor_id (id, full_name, avatar_url),
          fleet:fleet_id (id, name)
        `)
        .eq('id', newRow.id)
        .single();

      if (data) {
        callback({
          id: data.id,
          userId: data.user_id,
          fleetId: data.fleet_id,
          notificationType: data.notification_type,
          relatedPostId: data.related_post_id,
          relatedCommentId: data.related_comment_id,
          actorId: data.actor_id,
          message: data.message,
          isRead: data.is_read,
          createdAt: data.created_at,
          actor: data.actor ? {
            id: data.actor.id,
            name: data.actor.full_name || 'Someone',
            avatar_url: data.actor.avatar_url,
          } : undefined,
          fleet: data.fleet ? {
            id: data.fleet.id,
            name: data.fleet.name,
          } : undefined,
        });
      }
    };

    realtimeService.subscribe(
      channelName,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'fleet_notifications',
        filter: `user_id=eq.${userId}`,
      },
      handler
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handler);
    };
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private ensureFleetSocialAvailable(): boolean {
    return this.fleetSocialEnabled;
  }

  private isFleetSocialTableMissing(error: any): boolean {
    if (!error) return false;
    const code = error.code;
    const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    
    // Only treat as "table missing" for specific PostgREST/Postgres errors:
    // PGRST205 = Could not find a relationship (missing foreign key)
    // 42P01 = undefined_table
    // PGRST116 = The result contains 0 rows (not an error, just empty)
    
    // Check for actual schema/table issues, not just any 400 error
    const isSchemaError = 
      code === 'PGRST205' ||  // relationship not found
      code === '42P01' ||     // undefined table
      code === 'PGRST204' ||  // column not found
      (message.includes('relation') && message.includes('does not exist')) ||
      (message.includes('column') && message.includes('does not exist'));
    
    return isSchemaError;
  }

  private handleFleetSocialTableError(error: any, context: string): boolean {
    if (this.isFleetSocialTableMissing(error)) {
      if (!this.fleetSocialWarningLogged) {
        logger.warn(
          `[FleetSocialService] fleet social tables missing while ${context}. Disabling fleet feed features for this session.`
        );
        this.fleetSocialWarningLogged = true;
      }
      this.fleetSocialEnabled = false;
      return true;
    }
    return false;
  }

  private fleetSocialDisabledError() {
    return new Error('Fleet social feed is not available in this environment yet.');
  }

  private mapPost(data: any): FleetPost {
    return {
      id: data.id,
      fleetId: data.fleet_id,
      authorId: data.author_id,
      postType: data.post_type,
      content: data.content,
      metadata: data.metadata || {},
      visibility: data.visibility,
      isPinned: data.is_pinned,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      author: data.author ? {
        id: data.author.id,
        name: data.author.full_name || 'Unknown',
        avatar_url: data.author.avatar_url,
      } : undefined,
    };
  }

  /**
   * Best-effort mention notifications based on metadata. Expects metadata.mentions as an array of user IDs.
   */
  private async notifyMentions(
    postId: string,
    fleetId: string,
    metadata: Record<string, any> | undefined,
    actorId: string
  ) {
    if (!metadata || !Array.isArray(metadata.mentions) || metadata.mentions.length === 0) {
      return;
    }

    const uniqueMentions = Array.from(new Set(metadata.mentions)).filter((id) => id && id !== actorId);
    if (uniqueMentions.length === 0) return;

    await Promise.all(
      uniqueMentions.map((userId) =>
        this.createNotification({
          userId,
          fleetId,
          notificationType: 'mention',
          actorId,
          relatedPostId: postId,
          message: 'You were mentioned in a post',
        }).catch((err) => logger.error('Error notifying mention', userId, err))
      )
    );
  }

  private mapNotification(data: any): FleetNotification {
    return {
      id: data.id,
      userId: data.user_id,
      fleetId: data.fleet_id,
      notificationType: data.notification_type,
      relatedPostId: data.related_post_id,
      relatedCommentId: data.related_comment_id,
      actorId: data.actor_id,
      message: data.message,
      isRead: data.is_read,
      createdAt: data.created_at,
      actor: data.actor ? {
        id: data.actor.id,
        name: data.actor.full_name || 'Unknown',
        avatar_url: data.actor.avatar_url,
      } : undefined,
      fleet: data.fleet ? {
        id: data.fleet.id,
        name: data.fleet.name,
      } : undefined,
    };
  }

  async createNotification(params: CreateNotificationParams): Promise<FleetNotification> {
    if (!this.ensureFleetSocialAvailable()) {
      throw this.fleetSocialDisabledError();
    }

    const { data: userData } = await supabase.auth.getUser();
    const actorId = params.actorId !== undefined ? params.actorId : userData.user?.id ?? null;

    const { data, error } = await supabase
      .from('fleet_notifications')
      .insert({
        user_id: params.userId,
        fleet_id: params.fleetId,
        notification_type: params.notificationType,
        actor_id: actorId,
        related_post_id: params.relatedPostId ?? null,
        related_comment_id: params.relatedCommentId ?? null,
        message: params.message ?? null,
        is_read: params.isRead ?? false,
      })
      .select(`
        *,
        actor:actor_id (id, full_name, avatar_url),
        fleet:fleet_id (id, name)
      `)
      .single();

    if (error) {
      if (this.handleFleetSocialTableError(error, 'creating a notification')) {
        throw this.fleetSocialDisabledError();
      }
      logger.error('Error creating notification:', error);
      throw error;
    }

    return this.mapNotification(data);
  }

  private async notifyOnNewPost(postId: string, fleetId: string, postType: PostType): Promise<void> {
    // Get fleet followers who want notifications for this post type
    const { data: followers } = await supabase
      .from('fleet_followers')
      .select('follower_id, notify_on_documents, notify_on_announcements, notify_on_events')
      .eq('fleet_id', fleetId);

    if (!followers) return;

    const { data: userData } = await supabase.auth.getUser();
    const actorId = userData.user?.id;

    // Determine notification type and filter
    let notificationType: NotificationType;
    let shouldNotify = () => false;

    switch (postType) {
      case 'tuning_guide':
        notificationType = 'tuning_guide_posted';
        shouldNotify = (f) => f.notify_on_documents;
        break;
      case 'race_result':
        notificationType = 'race_result_posted';
        shouldNotify = () => true; // Always notify on race results
        break;
      case 'event':
        notificationType = 'event_created';
        shouldNotify = (f) => f.notify_on_events;
        break;
      default:
        notificationType = 'new_post';
        shouldNotify = () => true;
    }

    // Create notifications for eligible followers (best-effort)
    const targets = followers.filter(shouldNotify);
    if (targets.length === 0) return;

    await Promise.all(
      targets.map((f) =>
        this.createNotification({
          userId: f.follower_id,
          fleetId,
          notificationType,
          actorId: actorId ?? null,
          relatedPostId: postId,
        }).catch((err) => {
          logger.error('Error notifying follower', f.follower_id, err);
        })
      )
    );
  }
}

export const fleetSocialService = new FleetSocialService();
