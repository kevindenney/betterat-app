/**
 * useCommunityFeed - React Query hooks for community knowledge feed
 *
 * Provides hooks for feed listing, post detail, voting, comments,
 * membership, topic tags, condition matching, and map pins.
 */

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { CommunityFeedService } from '@/services/venue/CommunityFeedService';
import { ConditionMatchingService } from '@/services/venue/ConditionMatchingService';
import { useAuth } from '@/providers/AuthProvider';
import type {
  FeedPost,
  FeedSortType,
  PostType,
  TopPeriod,
  CurrentConditions,
  CreatePostParams,
  UpdatePostParams,
  MapBounds,
  KnowledgeAnchor,
} from '@/types/community-feed';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const communityFeedKeys = {
  all: ['community-feed'] as const,
  feeds: () => [...communityFeedKeys.all, 'feed'] as const,
  feed: (venueId: string, filters?: {
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    racingAreaId?: string | null;
    topPeriod?: TopPeriod;
    catalogRaceId?: string;
  }) => [...communityFeedKeys.feeds(), venueId, filters] as const,
  // Community-based feed (non-venue communities)
  communityFeed: (communityId: string, filters?: {
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    topPeriod?: TopPeriod;
  }) => [...communityFeedKeys.feeds(), 'community', communityId, filters] as const,
  // Aggregated feed from joined communities
  joinedCommunitiesFeed: (communityIds: string[], filters?: {
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    topPeriod?: TopPeriod;
  }) => [...communityFeedKeys.feeds(), 'joined-communities', communityIds, filters] as const,
  raceFeed: (catalogRaceId: string) => [...communityFeedKeys.feeds(), 'race', catalogRaceId] as const,
  // Lives under feeds() so post/comment/vote mutations invalidate it too.
  placeKnowledge: (anchorKind: 'area' | 'poi', anchorId: string) =>
    [...communityFeedKeys.feeds(), 'place-knowledge', anchorKind, anchorId] as const,
  groupKnowledge: (scopeType: string, scopeId: string) =>
    [...communityFeedKeys.feeds(), 'group-knowledge', scopeType, scopeId] as const,
  aggregatedFeed: (venueIds: string[], filters?: {
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    topPeriod?: TopPeriod;
  }) => [...communityFeedKeys.feeds(), 'aggregated', venueIds, filters] as const,
  posts: () => [...communityFeedKeys.all, 'post'] as const,
  post: (postId: string) => [...communityFeedKeys.posts(), postId] as const,
  comments: (postId: string) => [...communityFeedKeys.all, 'comments', postId] as const,
  topicTags: (interestSlug: string) => [...communityFeedKeys.all, 'topic-tags', interestSlug] as const,
  membership: (venueId: string) => [...communityFeedKeys.all, 'membership', venueId] as const,
  mapPins: (venueId: string) => [...communityFeedKeys.all, 'map-pins', venueId] as const,
  authorStats: (authorId: string, venueId: string) =>
    [...communityFeedKeys.all, 'author-stats', authorId, venueId] as const,
  conditionsFeed: (venueId: string) => [...communityFeedKeys.all, 'conditions-feed', venueId] as const,
  userPosts: (userId: string) => [...communityFeedKeys.all, 'user-posts', userId] as const,
};

// ============================================================================
// FEED HOOKS
// ============================================================================

/**
 * Infinite-scrolling community feed with cursor pagination
 */
export function useCommunityFeed(
  venueId: string,
  options: {
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    racingAreaId?: string | null;
    topPeriod?: TopPeriod;
    currentConditions?: CurrentConditions;
    enabled?: boolean;
  } = {}
) {
  const {
    sort = 'hot',
    postType,
    tagIds,
    racingAreaId,
    topPeriod,
    currentConditions,
    enabled = true,
  } = options;

  const isConditionsSort = sort === 'conditions_match' && currentConditions;

  return useInfiniteQuery({
    queryKey: isConditionsSort
      ? communityFeedKeys.conditionsFeed(venueId)
      : communityFeedKeys.feed(venueId, { sort, postType, tagIds, racingAreaId, topPeriod }),
    queryFn: async ({ pageParam = 0 }) => {
      if (isConditionsSort && currentConditions) {
        return ConditionMatchingService.getConditionMatchedFeed(
          venueId,
          currentConditions,
          pageParam,
          20
        );
      }

      return CommunityFeedService.getFeed({
        venueId,
        sort,
        postType,
        tagIds,
        racingAreaId,
        topPeriod,
        page: pageParam,
        limit: 20,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && !!venueId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Aggregated feed across multiple venues (for Discuss tab)
 */
export function useAggregatedFeed(
  venueIds: string[],
  options: {
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    topPeriod?: TopPeriod;
    enabled?: boolean;
  } = {}
) {
  const {
    sort = 'hot',
    postType,
    tagIds,
    topPeriod,
    enabled = true,
  } = options;

  return useInfiniteQuery({
    queryKey: communityFeedKeys.aggregatedFeed(venueIds, { sort, postType, tagIds, topPeriod }),
    queryFn: async ({ pageParam = 0 }) => {
      return CommunityFeedService.getAggregatedFeed({
        venueIds,
        sort,
        postType,
        tagIds,
        topPeriod,
        page: pageParam,
        limit: 20,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && venueIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Feed of posts authored by a specific user
 */
export function useUserPosts(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: communityFeedKeys.userPosts(userId || ''),
    queryFn: async ({ pageParam = 0 }) => {
      return CommunityFeedService.getUserPosts(userId!, pageParam, 20);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Feed of posts tagged with a specific catalog race
 */
export function useRaceFeed(catalogRaceId: string | undefined) {
  return useInfiniteQuery({
    queryKey: communityFeedKeys.raceFeed(catalogRaceId || ''),
    queryFn: async ({ pageParam = 0 }) => {
      return CommunityFeedService.getPostsByRace(catalogRaceId!, pageParam, 20);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!catalogRaceId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Local-knowledge summary for one place — a sailing racing area or any
 * Atlas POI (hospital, haat, market, course…): top visible posts +
 * per-scope counts (public / fleet / org / blueprint). RLS already
 * limits rows to scopes the viewer belongs to.
 */
export function usePlaceKnowledge(anchor: KnowledgeAnchor | undefined, limit = 5) {
  return useQuery({
    queryKey: communityFeedKeys.placeKnowledge(
      anchor?.racingAreaId ? 'area' : 'poi',
      anchor?.racingAreaId ?? anchor?.poiId ?? '',
    ),
    queryFn: () => CommunityFeedService.getPlaceKnowledge(anchor!, limit),
    enabled: !!anchor,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * A group's (fleet/org/blueprint/cohort) knowledge posts bucketed by place
 * (racing area or Atlas POI). RLS returns zero rows to non-members, so
 * the section simply collapses for viewers outside the group.
 */
export function useGroupKnowledge(
  scopeType: 'fleet' | 'org' | 'blueprint' | 'cohort',
  scopeId: string | undefined,
) {
  return useQuery({
    queryKey: communityFeedKeys.groupKnowledge(scopeType, scopeId || ''),
    queryFn: () => CommunityFeedService.getGroupKnowledge(scopeType, scopeId!),
    enabled: !!scopeId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Feed of posts for a specific community (by community_id)
 * Use this for non-venue communities like boat classes, sailmakers, etc.
 */
export function useCommunityPostsFeed(
  communityId: string | undefined,
  options: {
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    topPeriod?: TopPeriod;
    enabled?: boolean;
  } = {}
) {
  const {
    sort = 'hot',
    postType,
    tagIds,
    topPeriod,
    enabled = true,
  } = options;

  return useInfiniteQuery({
    queryKey: communityFeedKeys.communityFeed(communityId || '', { sort, postType, tagIds, topPeriod }),
    queryFn: async ({ pageParam = 0 }) => {
      return CommunityFeedService.getCommunityPosts(communityId!, {
        sort,
        postType,
        tagIds,
        topPeriod,
        page: pageParam,
        limit: 20,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && !!communityId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Aggregated feed from communities the user has joined
 * Use this for the main "Feed" tab showing posts from all joined communities
 */
export function useJoinedCommunitiesFeed(
  communityIds: string[],
  options: {
    sort?: FeedSortType;
    postType?: PostType;
    tagIds?: string[];
    topPeriod?: TopPeriod;
    enabled?: boolean;
  } = {}
) {
  const {
    sort = 'hot',
    postType,
    tagIds,
    topPeriod,
    enabled = true,
  } = options;

  return useInfiniteQuery({
    queryKey: communityFeedKeys.joinedCommunitiesFeed(communityIds, { sort, postType, tagIds, topPeriod }),
    queryFn: async ({ pageParam = 0 }) => {
      return CommunityFeedService.getJoinedCommunitiesFeed({
        communityIds,
        sort,
        postType,
        tagIds,
        topPeriod,
        page: pageParam,
        limit: 20,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && communityIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });
}

// ============================================================================
// POST DETAIL
// ============================================================================

/**
 * Fetch a single post with all joined data
 */
export function usePostDetail(postId: string, enabled = true) {
  return useQuery({
    queryKey: communityFeedKeys.post(postId),
    queryFn: () => CommunityFeedService.getPostById(postId),
    enabled: enabled && !!postId,
    staleTime: 1000 * 60,
  });
}

/**
 * Distinguish "post doesn't exist" from "post is scoped to a group you're
 * not in". Only enable once the detail fetch has come back empty — the
 * happy path never needs the extra RPC.
 */
export function usePostVisibility(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...communityFeedKeys.post(postId), 'visibility'] as const,
    queryFn: () => CommunityFeedService.getPostVisibility(postId),
    enabled: enabled && !!postId,
    staleTime: 1000 * 60,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new post
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreatePostParams) => CommunityFeedService.createPost(params),
    onSuccess: (_data, variables) => {
      // Invalidate all feed queries
      queryClient.invalidateQueries({ queryKey: communityFeedKeys.feeds() });
      // Only invalidate map pins if post has a venue_id
      if (variables.venue_id) {
        queryClient.invalidateQueries({ queryKey: communityFeedKeys.mapPins(variables.venue_id) });
      }
    },
  });
}

/**
 * Update a post
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, updates }: { postId: string; updates: UpdatePostParams }) =>
      CommunityFeedService.updatePost(postId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: communityFeedKeys.post(data.id) });
      queryClient.invalidateQueries({ queryKey: communityFeedKeys.feeds() });
    },
  });
}

/**
 * Delete a post
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => CommunityFeedService.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityFeedKeys.feeds() });
    },
  });
}

/**
 * Vote on a post with optimistic update
 */
export function useVotePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetType, targetId, vote }: {
      targetType: 'discussion' | 'comment';
      targetId: string;
      vote: 1 | -1 | 0;
      postId?: string;
    }) => CommunityFeedService.vote(targetType, targetId, vote),
    onMutate: async ({ targetType, targetId, vote }) => {
      if (targetType !== 'discussion') return;

      await queryClient.cancelQueries({ queryKey: communityFeedKeys.post(targetId) });

      const previousPost = queryClient.getQueryData<FeedPost>(
        communityFeedKeys.post(targetId)
      );

      if (previousPost) {
        const prevVote = previousPost.user_vote ?? 0;
        // Calculate deltas based on previous and new vote
        let upvoteDelta = 0;
        let downvoteDelta = 0;

        // Remove old vote effect
        if (prevVote === 1) upvoteDelta -= 1;
        if (prevVote === -1) downvoteDelta -= 1;

        // Apply new vote effect
        if (vote === 1) upvoteDelta += 1;
        if (vote === -1) downvoteDelta += 1;

        queryClient.setQueryData<FeedPost>(
          communityFeedKeys.post(targetId),
          {
            ...previousPost,
            user_vote: vote === 0 ? null : vote,
            upvotes: Math.max(0, previousPost.upvotes + upvoteDelta),
            downvotes: Math.max(0, (previousPost.downvotes || 0) + downvoteDelta),
          }
        );
      }

      return { previousPost };
    },
    onError: (_err, variables, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(
          communityFeedKeys.post(variables.targetId),
          context.previousPost
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      if (variables.targetType === 'discussion') {
        queryClient.invalidateQueries({ queryKey: communityFeedKeys.post(variables.targetId) });
      }
      if (variables.targetType === 'comment' && variables.postId) {
        queryClient.invalidateQueries({ queryKey: communityFeedKeys.comments(variables.postId) });
      }
      queryClient.invalidateQueries({ queryKey: communityFeedKeys.feeds() });
    },
  });
}

// ============================================================================
// COMMENTS
// ============================================================================

/**
 * Fetch threaded comments for a post
 */
export function usePostComments(postId: string, enabled = true) {
  return useQuery({
    queryKey: communityFeedKeys.comments(postId),
    queryFn: () => CommunityFeedService.getComments(postId),
    enabled: enabled && !!postId,
    staleTime: 1000 * 30,
  });
}

/**
 * Create a comment
 */
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, body, parentId }: {
      postId: string;
      body: string;
      parentId?: string;
    }) => CommunityFeedService.createComment(postId, body, parentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: communityFeedKeys.comments(variables.postId) });
      queryClient.invalidateQueries({ queryKey: communityFeedKeys.post(variables.postId) });
      queryClient.invalidateQueries({ queryKey: communityFeedKeys.feeds() });
    },
  });
}

/**
 * Update a comment
 */
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      CommunityFeedService.updateComment(commentId, body),
    onSuccess: (_data, _variables) => {
      // Invalidate all comment queries (we don't know which post)
      queryClient.invalidateQueries({ queryKey: communityFeedKeys.all });
    },
  });
}

// ============================================================================
// MEMBERSHIP & ROLES
// ============================================================================

/**
 * Check if current user is a member of a venue
 */
export function useVenueMembership(venueId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: communityFeedKeys.membership(venueId),
    queryFn: () => CommunityFeedService.checkMembership(venueId),
    enabled: !!venueId && !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================================================
// TOPIC TAGS
// ============================================================================

/**
 * Get topic tags for an interest (universal tags + interest-scoped; cached globally)
 */
export function useTopicTags(interestSlug?: string | null) {
  const slug = interestSlug ?? 'sail-racing';
  return useQuery({
    queryKey: communityFeedKeys.topicTags(slug),
    queryFn: () => CommunityFeedService.getTopicTags(slug),
    staleTime: Infinity,
  });
}

// ============================================================================
// MAP PINS
// ============================================================================

/**
 * Get geo-pinned posts for map overlay
 */
export function useMapPinnedPosts(venueId: string, bounds?: MapBounds) {
  return useQuery({
    queryKey: communityFeedKeys.mapPins(venueId),
    queryFn: () => CommunityFeedService.getMapPinnedPosts(venueId, bounds),
    enabled: !!venueId,
    staleTime: 1000 * 60 * 2,
  });
}

// ============================================================================
// AUTHOR STATS
// ============================================================================

/**
 * Get author's racing stats at a venue
 */
export function useAuthorVenueStats(authorId: string | null, venueId: string) {
  return useQuery({
    queryKey: communityFeedKeys.authorStats(authorId || '', venueId),
    queryFn: () => CommunityFeedService.getAuthorVenueStats(authorId!, venueId),
    enabled: !!authorId && !!venueId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
