import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fleetSocialService,
  FleetPost,
  PostType,
  CreatePostParams
} from '@/services/FleetSocialService';
import { useAuth } from '@/providers/AuthProvider';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useFleetSocial');

interface UseFleetPostsOptions {
  limit?: number;
  postType?: PostType;
}

export function useFleetPosts(fleetId?: string, options?: UseFleetPostsOptions) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FleetPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const loadRunIdRef = useRef(0);
  const subscriptionRunIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPosts = useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === loadRunIdRef.current;

    if (!fleetId) {
      if (!canCommit()) return;
      setPosts([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!canCommit()) return;
    setLoading(true);
    setError(null);

    try {
      const fetchedPosts = await fleetSocialService.getFeedPosts(fleetId, {
        limit: options?.limit,
        postType: options?.postType,
        userId: user?.id,
      });
      if (!canCommit()) return;
      setPosts(fetchedPosts);
    } catch (err) {
      logger.error('Error loading fleet posts', err);
      if (!canCommit()) return;
      setError(err as Error);
    } finally {
      if (!canCommit()) return;
      setLoading(false);
    }
  }, [fleetId, options?.limit, options?.postType, user?.id]);

  // Set up real-time subscription
  useEffect(() => {
    const runId = ++subscriptionRunIdRef.current;

    if (!fleetId) {
      if (!isMountedRef.current) return;
      setPosts([]);
      setError(null);
      setLoading(false);
      return;
    }

    // Load initial posts
    loadPosts();

    // Subscribe to new posts
    const unsubscribe = fleetSocialService.subscribeToFleetPosts(fleetId, (newPost) => {
      if (runId !== subscriptionRunIdRef.current) return;
      if (!isMountedRef.current) return;
      setPosts((prev) => {
        if (prev.some((post) => post.id === newPost.id)) {
          return prev;
        }
        return [newPost, ...prev];
      });
    });

    return () => {
      subscriptionRunIdRef.current += 1;
      unsubscribe();
    };
  }, [fleetId, loadPosts]);

  const createPost = useCallback(
    async (params: Omit<CreatePostParams, 'fleetId'>) => {
      if (!fleetId) throw new Error('No fleet ID');

      const newPost = await fleetSocialService.createPost({
        ...params,
        fleetId,
      });

      // Post will be added via real-time subscription
      return newPost;
    },
    [fleetId]
  );

  const likePost = useCallback(async (postId: string) => {
    await fleetSocialService.likePost(postId);

    // Update local state optimistically
    if (!isMountedRef.current) return;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              likesCount: (post.likesCount || 0) + 1,
              isLikedByUser: true,
            }
          : post
      )
    );
  }, []);

  const unlikePost = useCallback(async (postId: string) => {
    await fleetSocialService.unlikePost(postId);

    // Update local state optimistically
    if (!isMountedRef.current) return;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              likesCount: Math.max((post.likesCount || 0) - 1, 0),
              isLikedByUser: false,
            }
          : post
      )
    );
  }, []);

  const bookmarkPost = useCallback(async (postId: string) => {
    await fleetSocialService.bookmarkPost(postId);

    if (!isMountedRef.current) return;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, isBookmarkedByUser: true } : post
      )
    );
  }, []);

  const unbookmarkPost = useCallback(async (postId: string) => {
    await fleetSocialService.unbookmarkPost(postId);

    if (!isMountedRef.current) return;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, isBookmarkedByUser: false } : post
      )
    );
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    await fleetSocialService.deletePost(postId);

    // Remove from local state
    if (!isMountedRef.current) return;
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  }, []);

  return {
    posts,
    loading,
    error,
    refresh: loadPosts,
    createPost,
    likePost,
    unlikePost,
    bookmarkPost,
    unbookmarkPost,
    deletePost,
  };
}

export function usePostComments(postId?: string) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);
  const loadRunIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadComments = useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === loadRunIdRef.current;

    if (!postId) {
      if (!canCommit()) return;
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fetchedComments = await fleetSocialService.getComments(postId);
      if (!canCommit()) return;
      setComments(fetchedComments);
    } catch (err) {
      logger.error('Error loading comments', err);
    } finally {
      if (!canCommit()) return;
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const createComment = useCallback(
    async (content: string, parentCommentId?: string) => {
      if (!postId) throw new Error('No post ID');

      const newComment = await fleetSocialService.createComment({
        postId,
        content,
        parentCommentId,
      });

      if (isMountedRef.current) {
        setComments((prev) => [...prev, newComment]);
      }
      return newComment;
    },
    [postId]
  );

  const deleteComment = useCallback(async (commentId: string) => {
    await fleetSocialService.deleteComment(commentId);
    if (!isMountedRef.current) return;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }, []);

  return {
    comments,
    loading,
    refresh: loadComments,
    createComment,
    deleteComment,
  };
}
