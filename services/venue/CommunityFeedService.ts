/**
 * CommunityFeedService
 *
 * Primary service for the Reddit-style community knowledge feed.
 * Wraps and extends VenueDiscussionService with post types, topic tags,
 * condition tags, sorting algorithms, map pins, and membership checks.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type {
  FeedPost,
  FeedQueryParams,
  CreatePostParams,
  UpdatePostParams,
  ConditionTag,
  TopicTag,
  ThreadedComment,
  AuthorVenueStats,
  MembershipStatus,
  MapBounds,
  FeedSortType,
  PostType,
  TopPeriod,
  VenueRole,
  AreaKnowledgeSummary,
  GroupKnowledgePlace,
  KnowledgeAnchor,
  KnowledgeScopeType,
} from '@/types/community-feed';

const logger = createLogger('CommunityFeedService');

class CommunityFeedServiceClass {
  // ============================================================================
  // FEED
  // ============================================================================

  /**
   * Get paginated feed with sorting, filtering, and tag joins
   */
  async getFeed(params: FeedQueryParams): Promise<{ data: FeedPost[]; count: number; nextPage: number | null }> {
    const {
      venueId,
      sort = 'hot',
      postType,
      tagIds,
      racingAreaId,
      topPeriod = 'all',
      catalogRaceId,
      scopeType,
      scopeId,
      page = 0,
      limit = 20,
    } = params;

    const offset = page * limit;

    let query = supabase
      .from('venue_discussions')
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        ),
        racing_area:venue_racing_areas!racing_area_id (
          id,
          area_name
        )
      `, { count: 'exact' })
      .eq('venue_id', venueId);

    // Audience visibility is enforced by RLS (scope_type/scope_id);
    // optionally narrow to a single scope (e.g. a fleet page section).
    if (scopeType) {
      query = query.eq('scope_type', scopeType);
    }
    if (scopeId) {
      query = query.eq('scope_id', scopeId);
    }

    // Filter by post type
    if (postType) {
      query = query.eq('post_type', postType);
    }

    // Filter by catalog race
    if (catalogRaceId) {
      query = query.eq('catalog_race_id', catalogRaceId);
    }

    // Filter by racing area
    if (racingAreaId) {
      query = query.or(`racing_area_id.eq.${racingAreaId},racing_area_id.is.null`);
    }

    // Time period filter for 'top' and 'rising'
    if (sort === 'rising') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', oneDayAgo);
    } else if (sort === 'top' && topPeriod !== 'all') {
      const periodMs: Record<TopPeriod, number> = {
        today: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        all: 0,
      };
      const since = new Date(Date.now() - periodMs[topPeriod]).toISOString();
      query = query.gte('created_at', since);
    }

    // Sort
    switch (sort) {
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'top':
        query = query.order('upvotes', { ascending: false });
        break;
      case 'rising':
      case 'hot':
      default:
        // Hot: pinned first, then by a score approximation
        // We order by pinned desc, then by last_activity weighted with upvotes
        query = query
          .order('pinned', { ascending: false })
          .order('last_activity_at', { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[CommunityFeedService] Error fetching feed:', error);
      throw error;
    }

    let posts: FeedPost[] = (data || []).map((d: any) => ({
      ...d,
      post_type: d.post_type || 'discussion',
      view_count: d.view_count || 0,
      is_resolved: d.is_resolved || false,
      accepted_answer_id: d.accepted_answer_id || null,
      location_lat: d.location_lat || null,
      location_lng: d.location_lng || null,
      location_label: d.location_label || null,
    }));

    // If sorting by hot, compute hot score client-side and re-sort
    if (sort === 'hot' || sort === 'rising') {
      posts = posts.map(p => ({
        ...p,
        hot_score: this.computeHotScore(p),
      }));
      posts.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
    }

    // Get user votes
    const { data: { user } } = await supabase.auth.getUser();
    if (user && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      const { data: votes } = await supabase
        .from('venue_discussion_votes')
        .select('target_id, vote')
        .eq('user_id', user.id)
        .eq('target_type', 'discussion')
        .in('target_id', postIds);

      const voteMap = new Map(votes?.map(v => [v.target_id, v.vote]) || []);
      posts = posts.map(p => ({ ...p, user_vote: voteMap.get(p.id) || null }));
    }

    // Load topic tags for posts
    if (posts.length > 0) {
      posts = await this.attachTopicTags(posts);
    }

    // Filter by tag IDs (client-side after join)
    if (tagIds && tagIds.length > 0) {
      posts = posts.filter(p =>
        p.topic_tags?.some(t => tagIds.includes(t.id))
      );
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    return {
      data: posts,
      count: totalCount,
      nextPage: hasMore ? page + 1 : null,
    };
  }

  /**
   * Get aggregated feed across multiple venues
   */
  async getAggregatedFeed(params: {
    venueIds: string[];
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    topPeriod?: TopPeriod;
    page?: number;
    limit?: number;
  }): Promise<{ data: FeedPost[]; count: number; nextPage: number | null }> {
    const {
      venueIds,
      sort = 'hot',
      postType,
      tagIds,
      topPeriod = 'all',
      page = 0,
      limit = 20,
    } = params;

    if (venueIds.length === 0) {
      return { data: [], count: 0, nextPage: null };
    }

    const offset = page * limit;

    let query = supabase
      .from('venue_discussions')
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        ),
        racing_area:venue_racing_areas!racing_area_id (
          id,
          area_name
        )
      `, { count: 'exact' })
      .in('venue_id', venueIds);

    if (postType) {
      query = query.eq('post_type', postType);
    }

    if (sort === 'rising') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', oneDayAgo);
    } else if (sort === 'top' && topPeriod !== 'all') {
      const periodMs: Record<TopPeriod, number> = {
        today: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        all: 0,
      };
      const since = new Date(Date.now() - periodMs[topPeriod]).toISOString();
      query = query.gte('created_at', since);
    }

    switch (sort) {
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'top':
        query = query.order('upvotes', { ascending: false });
        break;
      case 'rising':
      case 'hot':
      default:
        query = query
          .order('pinned', { ascending: false })
          .order('last_activity_at', { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[CommunityFeedService] Error fetching aggregated feed:', error);
      throw error;
    }

    let posts: FeedPost[] = (data || []).map((d: any) => ({
      ...d,
      post_type: d.post_type || 'discussion',
      view_count: d.view_count || 0,
      is_resolved: d.is_resolved || false,
      accepted_answer_id: d.accepted_answer_id || null,
      location_lat: d.location_lat || null,
      location_lng: d.location_lng || null,
      location_label: d.location_label || null,
    }));

    // Join venue names
    const uniqueVenueIds = [...new Set(posts.map(p => p.venue_id))];
    if (uniqueVenueIds.length > 0) {
      const { data: venues } = await supabase
        .from('sailing_venues')
        .select('id, name, country, region')
        .in('id', uniqueVenueIds);

      if (venues) {
        const venueMap = new Map(venues.map(v => [v.id, v]));
        posts = posts.map(p => ({
          ...p,
          venue: venueMap.get(p.venue_id) || undefined,
        }));
      }
    }

    if (sort === 'hot' || sort === 'rising') {
      posts = posts.map(p => ({
        ...p,
        hot_score: this.computeHotScore(p),
      }));
      posts.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
    }

    // Get user votes
    const { data: { user } } = await supabase.auth.getUser();
    if (user && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      const { data: votes } = await supabase
        .from('venue_discussion_votes')
        .select('target_id, vote')
        .eq('user_id', user.id)
        .eq('target_type', 'discussion')
        .in('target_id', postIds);

      const voteMap = new Map(votes?.map(v => [v.target_id, v.vote]) || []);
      posts = posts.map(p => ({ ...p, user_vote: voteMap.get(p.id) || null }));
    }

    // Load topic tags
    if (posts.length > 0) {
      posts = await this.attachTopicTags(posts);
    }

    // Filter by tag IDs (client-side)
    if (tagIds && tagIds.length > 0) {
      posts = posts.filter(p =>
        p.topic_tags?.some(t => tagIds.includes(t.id))
      );
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    return {
      data: posts,
      count: totalCount,
      nextPage: hasMore ? page + 1 : null,
    };
  }

  /**
   * Get posts authored by a specific user, paginated
   */
  async getUserPosts(
    userId: string,
    page = 0,
    limit = 20,
  ): Promise<{ data: FeedPost[]; count: number; nextPage: number | null }> {
    const offset = page * limit;

    const { data, error, count } = await supabase
      .from('venue_discussions')
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        ),
        racing_area:venue_racing_areas!racing_area_id (
          id,
          area_name
        )
      `, { count: 'exact' })
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[CommunityFeedService] Error fetching user posts:', error);
      throw error;
    }

    let posts: FeedPost[] = (data || []).map((d: any) => ({
      ...d,
      post_type: d.post_type || 'discussion',
      view_count: d.view_count || 0,
      is_resolved: d.is_resolved || false,
      accepted_answer_id: d.accepted_answer_id || null,
      location_lat: d.location_lat || null,
      location_lng: d.location_lng || null,
      location_label: d.location_label || null,
    }));

    // Join venue names
    const uniqueVenueIds = [...new Set(posts.map(p => p.venue_id))];
    if (uniqueVenueIds.length > 0) {
      const { data: venues } = await supabase
        .from('sailing_venues')
        .select('id, name, country, region')
        .in('id', uniqueVenueIds);

      if (venues) {
        const venueMap = new Map(venues.map(v => [v.id, v]));
        posts = posts.map(p => ({
          ...p,
          venue: venueMap.get(p.venue_id) || undefined,
        }));
      }
    }

    // Load topic tags
    if (posts.length > 0) {
      posts = await this.attachTopicTags(posts);
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    return {
      data: posts,
      count: totalCount,
      nextPage: hasMore ? page + 1 : null,
    };
  }

  /**
   * Get a single post by ID with all joined data
   */
  async getPostById(postId: string): Promise<FeedPost | null> {
    const { data, error } = await supabase
      .from('venue_discussions')
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        ),
        racing_area:venue_racing_areas!racing_area_id (
          id,
          area_name
        ),
        community:communities!community_id (
          id,
          name,
          slug,
          community_type
        )
      `)
      .eq('id', postId)
      .single();

    if (error) {
      logger.error('[CommunityFeedService] Error fetching post:', error);
      return null;
    }

    let post: FeedPost = {
      ...data,
      post_type: data.post_type || 'discussion',
      view_count: data.view_count || 0,
      is_resolved: data.is_resolved || false,
      accepted_answer_id: data.accepted_answer_id || null,
      location_lat: data.location_lat || null,
      location_lng: data.location_lng || null,
      location_label: data.location_label || null,
    };

    // Get user vote
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: voteData } = await supabase
        .from('venue_discussion_votes')
        .select('vote')
        .eq('user_id', user.id)
        .eq('target_type', 'discussion')
        .eq('target_id', postId)
        .maybeSingle();

      post.user_vote = voteData?.vote || null;
    }

    // Attach topic tags
    const [withTags] = await this.attachTopicTags([post]);
    post = withTags;

    // Attach condition tags
    const { data: condTags } = await supabase
      .from('venue_post_condition_tags')
      .select('*')
      .eq('discussion_id', postId);

    post.condition_tags = condTags || [];

    // Increment view count (fire and forget)
    supabase
      .from('venue_discussions')
      .update({ view_count: (post.view_count || 0) + 1 })
      .eq('id', postId)
      .then();

    return post;
  }

  /**
   * RLS hides scoped posts entirely, so a non-member deep link is
   * indistinguishable from a deleted post client-side. The RPC reveals
   * existence only (visible / members_only / not_found), never content.
   */
  async getPostVisibility(postId: string): Promise<'visible' | 'members_only' | 'not_found'> {
    const { data, error } = await supabase.rpc('venue_post_visibility', {
      p_post_id: postId,
    });
    if (error) {
      logger.error('[CommunityFeedService] Error checking post visibility:', error);
      return 'not_found';
    }
    return (data as 'visible' | 'members_only' | 'not_found') ?? 'not_found';
  }

  // ============================================================================
  // CREATE / UPDATE / DELETE
  // ============================================================================

  /**
   * Create a new post with all associated data
   */
  async createPost(params: CreatePostParams): Promise<FeedPost> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to create a post');

    // A post must hang off something findable: a sailing venue, a
    // community, or a generic Atlas place (poi).
    if (!params.venue_id && !params.community_id && !params.poi_id) {
      throw new Error('Post must be associated with a venue, a community, or a place');
    }

    const { topic_tag_ids, condition_tags, catalog_race_id, ...postData } = params;

    // Create the discussion
    const { data, error } = await supabase
      .from('venue_discussions')
      .insert({
        venue_id: postData.venue_id || null,
        community_id: postData.community_id || null,
        author_id: user.id,
        title: postData.title,
        body: postData.body || null,
        post_type: postData.post_type,
        category: postData.category || 'general',
        scope_type: postData.scope_type || 'public',
        scope_id: postData.scope_id || null,
        racing_area_id: postData.racing_area_id || null,
        poi_id: postData.poi_id || null,
        location_lat: postData.location_lat || null,
        location_lng: postData.location_lng || null,
        location_label: postData.location_label || null,
        catalog_race_id: catalog_race_id || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('[CommunityFeedService] Error creating post:', error);

      // Check for common constraint/permission errors and provide user-friendly messages
      const errorMessage = error.message?.toLowerCase() || '';
      const errorCode = error.code?.toLowerCase() || '';

      // RLS policy violation or constraint error - usually means not a member
      if (
        errorCode === '42501' || // insufficient_privilege
        errorCode === '23503' || // foreign_key_violation
        errorCode === '23514' || // check_violation
        errorMessage.includes('policy') ||
        errorMessage.includes('permission') ||
        errorMessage.includes('violates') ||
        errorMessage.includes('constraint')
      ) {
        throw new Error('You must join this community before you can post. Tap the "Join" button to become a member.');
      }

      throw error;
    }

    // Attach topic tags
    if (topic_tag_ids && topic_tag_ids.length > 0) {
      const tagRows = topic_tag_ids.map(tagId => ({
        discussion_id: data.id,
        tag_id: tagId,
      }));
      await supabase.from('venue_discussion_tags').insert(tagRows);
    }

    // Attach condition tags
    if (condition_tags && condition_tags.length > 0) {
      const condRows = condition_tags.map(ct => ({
        ...ct,
        discussion_id: data.id,
      }));
      await supabase.from('venue_post_condition_tags').insert(condRows);
    }

    return {
      ...data,
      post_type: data.post_type || 'discussion',
      view_count: 0,
      is_resolved: false,
      accepted_answer_id: null,
      location_lat: data.location_lat || null,
      location_lng: data.location_lng || null,
      location_label: data.location_label || null,
    };
  }

  /**
   * Update a post
   */
  async updatePost(postId: string, updates: UpdatePostParams): Promise<FeedPost> {
    const { data, error } = await supabase
      .from('venue_discussions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .select()
      .single();

    if (error) {
      logger.error('[CommunityFeedService] Error updating post:', error);
      throw error;
    }

    return data as FeedPost;
  }

  /**
   * Delete a post
   */
  async deletePost(postId: string): Promise<void> {
    const { error } = await supabase
      .from('venue_discussions')
      .delete()
      .eq('id', postId);

    if (error) {
      logger.error('[CommunityFeedService] Error deleting post:', error);
      throw error;
    }
  }

  // ============================================================================
  // VOTING
  // ============================================================================

  /**
   * Vote on a post or comment (1 = upvote, -1 = downvote, 0 = remove)
   */
  async vote(targetType: 'discussion' | 'comment', targetId: string, vote: 1 | -1 | 0): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to vote');

    try {
      if (vote === 0) {
        const { error } = await supabase
          .from('venue_discussion_votes')
          .delete()
          .eq('user_id', user.id)
          .eq('target_type', targetType)
          .eq('target_id', targetId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('venue_discussion_votes')
          .upsert({
            user_id: user.id,
            target_type: targetType,
            target_id: targetId,
            vote,
          }, {
            onConflict: 'user_id,target_type,target_id',
          });

        if (error) throw error;
      }
    } catch (error: any) {
      logger.error('[CommunityFeedService] Error voting:', error);

      const errorMessage = error.message?.toLowerCase() || '';
      const errorCode = error.code?.toLowerCase() || '';

      // RLS policy violation or constraint error
      if (
        errorCode === '42501' ||
        errorCode === '23503' ||
        errorCode === '23514' ||
        errorMessage.includes('policy') ||
        errorMessage.includes('permission') ||
        errorMessage.includes('violates') ||
        errorMessage.includes('constraint')
      ) {
        throw new Error('You must join this community before you can vote. Tap the "Join" button to become a member.');
      }

      throw error;
    }
  }

  // ============================================================================
  // COMMENTS
  // ============================================================================

  /**
   * Get threaded comments for a post
   */
  async getComments(postId: string): Promise<ThreadedComment[]> {
    const { data, error } = await supabase
      .from('venue_discussion_comments')
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('discussion_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('[CommunityFeedService] Error fetching comments:', error);
      throw error;
    }

    let comments = data || [];

    // Get user votes
    const { data: { user } } = await supabase.auth.getUser();
    if (user && comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      const { data: votes } = await supabase
        .from('venue_discussion_votes')
        .select('target_id, vote')
        .eq('user_id', user.id)
        .eq('target_type', 'comment')
        .in('target_id', commentIds);

      const voteMap = new Map(votes?.map(v => [v.target_id, v.vote]) || []);
      comments = comments.map(c => ({
        ...c,
        user_vote: voteMap.get(c.id) || null,
      }));
    }

    return this.buildCommentTree(comments);
  }

  /**
   * Create a comment
   */
  async createComment(postId: string, body: string, parentId?: string): Promise<ThreadedComment> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to comment');

    const { data, error } = await supabase
      .from('venue_discussion_comments')
      .insert({
        discussion_id: postId,
        author_id: user.id,
        body,
        parent_id: parentId || null,
      })
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      logger.error('[CommunityFeedService] Error creating comment:', error);

      // Check for common constraint/permission errors and provide user-friendly messages
      const errorMessage = error.message?.toLowerCase() || '';
      const errorCode = error.code?.toLowerCase() || '';

      // RLS policy violation or constraint error - usually means not a member
      if (
        errorCode === '42501' || // insufficient_privilege
        errorCode === '23503' || // foreign_key_violation
        errorCode === '23514' || // check_violation
        errorMessage.includes('policy') ||
        errorMessage.includes('permission') ||
        errorMessage.includes('violates') ||
        errorMessage.includes('constraint')
      ) {
        throw new Error('You must join this community before you can comment. Tap the "Join" button to become a member.');
      }

      // Generic database error
      if (errorMessage.includes('database')) {
        throw new Error('Unable to post your comment. Please make sure you have joined this community first.');
      }

      throw error;
    }

    return { ...data, depth: 0, replies: [] };
  }

  /**
   * Update a comment's body
   */
  async updateComment(commentId: string, body: string): Promise<void> {
    const { error } = await supabase
      .from('venue_discussion_comments')
      .update({ body, updated_at: new Date().toISOString() })
      .eq('id', commentId);

    if (error) {
      logger.error('[CommunityFeedService] Error updating comment:', error);
      throw error;
    }
  }

  // ============================================================================
  // CONDITION TAGS
  // ============================================================================

  /**
   * Set condition tags for a post (replaces existing)
   */
  async setConditionTags(postId: string, tags: Omit<ConditionTag, 'id' | 'discussion_id'>[]): Promise<void> {
    // Delete existing
    await supabase
      .from('venue_post_condition_tags')
      .delete()
      .eq('discussion_id', postId);

    // Insert new
    if (tags.length > 0) {
      const rows = tags.map(t => ({ ...t, discussion_id: postId }));
      await supabase.from('venue_post_condition_tags').insert(rows);
    }
  }

  // ============================================================================
  // TOPIC TAGS
  // ============================================================================

  /**
   * Get all topic tags
   */
  // Defaults to sail-racing so legacy venue surfaces keep their full chip set.
  async getTopicTags(interestSlug: string = 'sail-racing'): Promise<TopicTag[]> {
    const { data, error } = await supabase
      .from('venue_topic_tags')
      .select('*')
      .or(`interest_slug.is.null,interest_slug.eq.${interestSlug}`)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('[CommunityFeedService] Error fetching topic tags:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Set topic tags for a post (replaces existing)
   */
  async setTopicTags(postId: string, tagIds: string[]): Promise<void> {
    await supabase
      .from('venue_discussion_tags')
      .delete()
      .eq('discussion_id', postId);

    if (tagIds.length > 0) {
      const rows = tagIds.map(tagId => ({
        discussion_id: postId,
        tag_id: tagId,
      }));
      await supabase.from('venue_discussion_tags').insert(rows);
    }
  }

  // ============================================================================
  // MODERATION
  // ============================================================================

  /**
   * Pin/unpin a post (moderator only)
   */
  async pinPost(postId: string, pinned: boolean): Promise<void> {
    const { error } = await supabase
      .from('venue_discussions')
      .update({ pinned })
      .eq('id', postId);

    if (error) {
      logger.error('[CommunityFeedService] Error pinning post:', error);
      throw error;
    }
  }

  // ============================================================================
  // MEMBERSHIP
  // ============================================================================

  /**
   * Check if current user is a member of a venue
   */
  async checkMembership(venueId: string): Promise<MembershipStatus> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { isMember: false, isModerator: false, roles: [] };
    }

    // Check saved venues
    const { data: savedVenue } = await supabase
      .from('saved_venues')
      .select('id')
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
      .maybeSingle();

    // Check roles
    const { data: roleData } = await supabase
      .from('venue_member_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('venue_id', venueId);

    const roles = (roleData || []).map(r => r.role as VenueRole);
    const isModerator = roles.includes('moderator');
    const isMember = !!savedVenue || roles.length > 0;

    return { isMember, isModerator, roles };
  }

  // ============================================================================
  // AUTHOR STATS
  // ============================================================================

  /**
   * Get an author's racing stats at a venue
   */
  async getAuthorVenueStats(authorId: string, venueId: string): Promise<AuthorVenueStats | null> {
    const { data, error } = await supabase
      .rpc('get_author_venue_stats', {
        p_author_id: authorId,
        p_venue_id: venueId,
      });

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      race_count: Number(row.race_count) || 0,
      avg_finish: row.avg_finish ? Number(row.avg_finish) : null,
      best_finish: row.best_finish ? Number(row.best_finish) : null,
    };
  }

  // ============================================================================
  // MAP
  // ============================================================================

  /**
   * Get posts that have map pin locations within bounds
   */
  async getMapPinnedPosts(venueId: string, bounds?: MapBounds): Promise<FeedPost[]> {
    let query = supabase
      .from('venue_discussions')
      .select(`
        id, title, post_type, upvotes, comment_count,
        location_lat, location_lng, location_label,
        created_at, pinned,
        author:users!author_id (id, full_name)
      `)
      .eq('venue_id', venueId)
      .not('location_lat', 'is', null)
      .not('location_lng', 'is', null);

    if (bounds) {
      query = query
        .gte('location_lat', bounds.south)
        .lte('location_lat', bounds.north)
        .gte('location_lng', bounds.west)
        .lte('location_lng', bounds.east);
    }

    query = query.order('created_at', { ascending: false }).limit(50);

    const { data, error } = await query;

    if (error) {
      logger.error('[CommunityFeedService] Error fetching map posts:', error);
      return [];
    }

    return (data || []) as unknown as FeedPost[];
  }

  // ============================================================================
  // PLACE LOCAL KNOWLEDGE
  // ============================================================================

  /**
   * Knowledge summary for one place — a sailing racing area or any Atlas
   * POI (hospital, haat, market, course…): top visible posts plus
   * per-scope counts. Visibility is whatever RLS grants the caller.
   */
  async getPlaceKnowledge(anchor: KnowledgeAnchor, limit = 5): Promise<AreaKnowledgeSummary> {
    const anchorColumn = anchor.racingAreaId ? 'racing_area_id' : 'poi_id';
    const anchorId = anchor.racingAreaId ?? anchor.poiId;
    const [postsRes, countsRes] = await Promise.all([
      supabase
        .from('venue_discussions')
        .select(`
          *,
          author:users!author_id (
            id,
            full_name,
            avatar_url
          ),
          racing_area:venue_racing_areas!racing_area_id (
            id,
            area_name
          ),
          poi:atlas_pois!poi_id (
            id,
            name,
            kind
          ),
          condition_tags:venue_post_condition_tags (*)
        `)
        .eq(anchorColumn, anchorId)
        .order('pinned', { ascending: false })
        .order('last_activity_at', { ascending: false })
        .limit(limit),
      supabase
        .from('venue_discussions')
        .select('scope_type')
        .eq(anchorColumn, anchorId),
    ]);

    if (postsRes.error) {
      logger.error('[CommunityFeedService] Error fetching area knowledge:', postsRes.error);
      throw postsRes.error;
    }
    if (countsRes.error) {
      logger.error('[CommunityFeedService] Error counting area knowledge:', countsRes.error);
      throw countsRes.error;
    }

    const countsByScope: AreaKnowledgeSummary['countsByScope'] = {};
    for (const row of countsRes.data || []) {
      const scope = row.scope_type as KnowledgeScopeType;
      countsByScope[scope] = (countsByScope[scope] || 0) + 1;
    }

    return {
      posts: (postsRes.data || []) as unknown as FeedPost[],
      countsByScope,
      totalVisible: (countsRes.data || []).length,
    };
  }

  /**
   * A group's (fleet/org/blueprint) knowledge posts, bucketed by place
   * (racing area or Atlas POI). RLS hides the rows entirely from
   * non-members, so callers can render unconditionally and let an empty
   * result collapse the section.
   */
  async getGroupKnowledge(
    scopeType: Extract<KnowledgeScopeType, 'fleet' | 'org' | 'blueprint' | 'cohort'>,
    scopeId: string,
  ): Promise<GroupKnowledgePlace[]> {
    const { data, error } = await supabase
      .from('venue_discussions')
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        ),
        racing_area:venue_racing_areas!racing_area_id (
          id,
          area_name
        ),
        poi:atlas_pois!poi_id (
          id,
          name,
          kind
        )
      `)
      .eq('scope_type', scopeType)
      .eq('scope_id', scopeId)
      .order('last_activity_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('[CommunityFeedService] Error fetching group knowledge:', error);
      throw error;
    }

    const posts = ((data || []) as unknown as FeedPost[]).map((p) => ({
      ...p,
      hot_score: this.computeHotScore(p),
    }));

    const buckets = new Map<string | null, GroupKnowledgePlace>();
    for (const post of posts) {
      const key = post.racing_area_id ?? post.poi_id ?? null;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          racingAreaId: post.racing_area_id ?? null,
          poiId: post.poi_id ?? null,
          placeName: post.racing_area?.area_name ?? post.poi?.name ?? null,
          placeKind: post.racing_area_id ? 'racing_area' : (post.poi?.kind ?? null),
          posts: [],
        };
        buckets.set(key, bucket);
      }
      bucket.posts.push(post);
    }
    for (const bucket of buckets.values()) {
      bucket.posts.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
    }
    // Named places first, busiest first; venue-wide (no place) bucket last.
    return [...buckets.values()].sort((a, b) => {
      const aPlaced = a.racingAreaId || a.poiId;
      const bPlaced = b.racingAreaId || b.poiId;
      if (!aPlaced !== !bPlaced) return aPlaced ? -1 : 1;
      return b.posts.length - a.posts.length;
    });
  }

  // ============================================================================
  // RACE-TAGGED POSTS
  // ============================================================================

  /**
   * Get posts for a specific community (by community_id)
   * This supports non-venue communities like boat classes, sailmakers, etc.
   */
  async getCommunityPosts(
    communityId: string,
    options: {
      sort?: FeedSortType;
      postType?: PostType;
      tagIds?: string[];
      topPeriod?: TopPeriod;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: FeedPost[]; count: number; nextPage: number | null }> {
    const {
      sort = 'hot',
      postType,
      tagIds,
      topPeriod = 'all',
      page = 0,
      limit = 20,
    } = options;

    const offset = page * limit;

    let query = supabase
      .from('venue_discussions')
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('community_id', communityId);

    if (postType) {
      query = query.eq('post_type', postType);
    }

    if (sort === 'rising') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', oneDayAgo);
    } else if (sort === 'top' && topPeriod !== 'all') {
      const periodMs: Record<TopPeriod, number> = {
        today: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        all: 0,
      };
      const since = new Date(Date.now() - periodMs[topPeriod]).toISOString();
      query = query.gte('created_at', since);
    }

    switch (sort) {
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'top':
        query = query.order('upvotes', { ascending: false });
        break;
      case 'rising':
      case 'hot':
      default:
        query = query
          .order('pinned', { ascending: false })
          .order('last_activity_at', { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[CommunityFeedService] Error fetching community posts:', error);
      throw error;
    }

    let posts: FeedPost[] = (data || []).map((d: any) => ({
      ...d,
      post_type: d.post_type || 'discussion',
      view_count: d.view_count || 0,
      is_resolved: d.is_resolved || false,
      accepted_answer_id: d.accepted_answer_id || null,
      location_lat: d.location_lat || null,
      location_lng: d.location_lng || null,
      location_label: d.location_label || null,
    }));

    if (sort === 'hot' || sort === 'rising') {
      posts = posts.map(p => ({
        ...p,
        hot_score: this.computeHotScore(p),
      }));
      posts.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
    }

    // Get user votes
    const { data: { user } } = await supabase.auth.getUser();
    if (user && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      const { data: votes } = await supabase
        .from('venue_discussion_votes')
        .select('target_id, vote')
        .eq('user_id', user.id)
        .eq('target_type', 'discussion')
        .in('target_id', postIds);

      const voteMap = new Map(votes?.map(v => [v.target_id, v.vote]) || []);
      posts = posts.map(p => ({ ...p, user_vote: voteMap.get(p.id) || null }));
    }

    // Load topic tags
    if (posts.length > 0) {
      posts = await this.attachTopicTags(posts);
    }

    // Filter by tag IDs (client-side)
    if (tagIds && tagIds.length > 0) {
      posts = posts.filter(p =>
        p.topic_tags?.some(t => tagIds.includes(t.id))
      );
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    return {
      data: posts,
      count: totalCount,
      nextPage: hasMore ? page + 1 : null,
    };
  }

  /**
   * Get aggregated feed from communities the user has joined
   */
  async getJoinedCommunitiesFeed(params: {
    communityIds: string[];
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    topPeriod?: TopPeriod;
    page?: number;
    limit?: number;
  }): Promise<{ data: FeedPost[]; count: number; nextPage: number | null }> {
    const {
      communityIds,
      sort = 'hot',
      postType,
      tagIds,
      topPeriod = 'all',
      page = 0,
      limit = 20,
    } = params;

    if (communityIds.length === 0) {
      return { data: [], count: 0, nextPage: null };
    }

    const offset = page * limit;

    let query = supabase
      .from('venue_discussions')
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        )
      `, { count: 'exact' })
      .in('community_id', communityIds);

    if (postType) {
      query = query.eq('post_type', postType);
    }

    if (sort === 'rising') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', oneDayAgo);
    } else if (sort === 'top' && topPeriod !== 'all') {
      const periodMs: Record<TopPeriod, number> = {
        today: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        all: 0,
      };
      const since = new Date(Date.now() - periodMs[topPeriod]).toISOString();
      query = query.gte('created_at', since);
    }

    switch (sort) {
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'top':
        query = query.order('upvotes', { ascending: false });
        break;
      case 'rising':
      case 'hot':
      default:
        query = query
          .order('pinned', { ascending: false })
          .order('last_activity_at', { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[CommunityFeedService] Error fetching joined communities feed:', error);
      throw error;
    }

    let posts: FeedPost[] = (data || []).map((d: any) => ({
      ...d,
      post_type: d.post_type || 'discussion',
      view_count: d.view_count || 0,
      is_resolved: d.is_resolved || false,
      accepted_answer_id: d.accepted_answer_id || null,
      location_lat: d.location_lat || null,
      location_lng: d.location_lng || null,
      location_label: d.location_label || null,
    }));

    // Join community info
    const uniqueCommunityIds = [...new Set(posts.map(p => p.community_id).filter(Boolean))];
    if (uniqueCommunityIds.length > 0) {
      const { data: communities } = await supabase
        .from('communities')
        .select('id, name, slug, community_type')
        .in('id', uniqueCommunityIds);

      if (communities) {
        const communityMap = new Map(communities.map(c => [c.id, c]));
        posts = posts.map(p => ({
          ...p,
          community: p.community_id ? communityMap.get(p.community_id) : undefined,
        }));
      }
    }

    if (sort === 'hot' || sort === 'rising') {
      posts = posts.map(p => ({
        ...p,
        hot_score: this.computeHotScore(p),
      }));
      posts.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
    }

    // Get user votes
    const { data: { user } } = await supabase.auth.getUser();
    if (user && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      const { data: votes } = await supabase
        .from('venue_discussion_votes')
        .select('target_id, vote')
        .eq('user_id', user.id)
        .eq('target_type', 'discussion')
        .in('target_id', postIds);

      const voteMap = new Map(votes?.map(v => [v.target_id, v.vote]) || []);
      posts = posts.map(p => ({ ...p, user_vote: voteMap.get(p.id) || null }));
    }

    // Load topic tags
    if (posts.length > 0) {
      posts = await this.attachTopicTags(posts);
    }

    // Filter by tag IDs (client-side)
    if (tagIds && tagIds.length > 0) {
      posts = posts.filter(p =>
        p.topic_tags?.some(t => tagIds.includes(t.id))
      );
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    return {
      data: posts,
      count: totalCount,
      nextPage: hasMore ? page + 1 : null,
    };
  }

  /**
   * Get posts tagged with a specific catalog race
   */
  async getPostsByRace(
    catalogRaceId: string,
    page = 0,
    limit = 20,
  ): Promise<{ data: FeedPost[]; count: number; nextPage: number | null }> {
    const offset = page * limit;

    const { data, error, count } = await supabase
      .from('venue_discussions')
      .select(`
        *,
        author:users!author_id (
          id,
          full_name,
          avatar_url
        ),
        racing_area:venue_racing_areas!racing_area_id (
          id,
          area_name
        )
      `, { count: 'exact' })
      .eq('catalog_race_id', catalogRaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[CommunityFeedService] Error fetching race posts:', error);
      throw error;
    }

    let posts: FeedPost[] = (data || []).map((d: any) => ({
      ...d,
      post_type: d.post_type || 'discussion',
      view_count: d.view_count || 0,
      is_resolved: d.is_resolved || false,
      accepted_answer_id: d.accepted_answer_id || null,
      location_lat: d.location_lat || null,
      location_lng: d.location_lng || null,
      location_label: d.location_label || null,
    }));

    // Join venue names
    const uniqueVenueIds = [...new Set(posts.map(p => p.venue_id))];
    if (uniqueVenueIds.length > 0) {
      const { data: venues } = await supabase
        .from('sailing_venues')
        .select('id, name, country, region')
        .in('id', uniqueVenueIds);

      if (venues) {
        const venueMap = new Map(venues.map(v => [v.id, v]));
        posts = posts.map(p => ({
          ...p,
          venue: venueMap.get(p.venue_id) || undefined,
        }));
      }
    }

    // Load topic tags
    if (posts.length > 0) {
      posts = await this.attachTopicTags(posts);
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    return {
      data: posts,
      count: totalCount,
      nextPage: hasMore ? page + 1 : null,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Compute hot score client-side
   * Formula: (upvotes*2 + comments*3 + min(views,100)) / (age_hours+2)^1.5
   * Pinned posts get infinity score
   */
  private computeHotScore(post: FeedPost): number {
    if (post.pinned) return 999999999;

    const ageMs = Date.now() - new Date(post.created_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    const score = (
      (post.upvotes || 0) * 2 +
      (post.comment_count || 0) * 3 +
      Math.min(post.view_count || 0, 100)
    ) / Math.pow(ageHours + 2, 1.5);

    return score;
  }

  /**
   * Attach topic tags to an array of posts
   */
  private async attachTopicTags(posts: FeedPost[]): Promise<FeedPost[]> {
    const postIds = posts.map(p => p.id);

    const { data: tagJoins } = await supabase
      .from('venue_discussion_tags')
      .select(`
        discussion_id,
        tag:venue_topic_tags (*)
      `)
      .in('discussion_id', postIds);

    if (!tagJoins || tagJoins.length === 0) return posts;

    const tagMap = new Map<string, TopicTag[]>();
    for (const join of tagJoins) {
      const existing = tagMap.get(join.discussion_id) || [];
      if (join.tag) {
        existing.push(join.tag as unknown as TopicTag);
      }
      tagMap.set(join.discussion_id, existing);
    }

    return posts.map(p => ({
      ...p,
      topic_tags: tagMap.get(p.id) || [],
    }));
  }

  /**
   * Build threaded comment tree from flat array
   */
  private buildCommentTree(comments: any[]): ThreadedComment[] {
    const commentMap = new Map<string, ThreadedComment>();
    const rootComments: ThreadedComment[] = [];

    // First pass: create map with depth 0
    for (const c of comments) {
      commentMap.set(c.id, { ...c, depth: 0, replies: [] });
    }

    // Second pass: build tree and calculate depth
    for (const c of comments) {
      const node = commentMap.get(c.id)!;
      if (c.parent_id) {
        const parent = commentMap.get(c.parent_id);
        if (parent) {
          node.depth = parent.depth + 1;
          parent.replies = parent.replies || [];
          parent.replies.push(node);
        } else {
          rootComments.push(node);
        }
      } else {
        rootComments.push(node);
      }
    }

    return rootComments;
  }
}

export const CommunityFeedService = new CommunityFeedServiceClass();
