/**
 * PostDetailScreen
 *
 * Full post view with voting, comments, author stats, and actions.
 * Used by the route app/venue/post/[id].tsx
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TufteTokens } from '@/constants/designSystem';
import { triggerHaptic } from '@/lib/haptics';
import { POST_TYPE_CONFIG } from '@/types/community-feed';
import {
  usePostDetail,
  usePostVisibility,
  usePostComments,
  useVotePost,
  useAuthorVenueStats,
  useUpdateComment,
  useVenueMembership,
} from '@/hooks/useCommunityFeed';
import { CommunityFeedService } from '@/services/venue/CommunityFeedService';
import { useToast } from '@/components/ui/AppToast';
import { useAuth } from '@/providers/AuthProvider';
import { CommentList } from '../comments/CommentList';
import { CommentComposer } from '../comments/CommentComposer';
import { PostComposer } from './PostComposer';
import type { ThreadedComment } from '@/types/community-feed';

interface PostDetailScreenProps {
  postId: string;
  onBack?: () => void;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function PostDetailScreen({ postId, onBack }: PostDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: post, isLoading: postLoading } = usePostDetail(postId);
  const { data: visibility } = usePostVisibility(postId, !postLoading && !post);
  const { data: comments, isLoading: commentsLoading } = usePostComments(postId);
  const voteMutation = useVotePost();
  const updateCommentMutation = useUpdateComment();
  const toast = useToast();

  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null);
  const [showEditComposer, setShowEditComposer] = useState(false);
  const [isPinning, setIsPinning] = useState(false);

  const isAuthor = useMemo(() => {
    return !!user && !!post && post.author_id === user.id;
  }, [user, post]);

  const { data: membership } = useVenueMembership(post?.venue_id || '');
  const isModerator = membership?.isModerator || false;

  const handlePinToggle = useCallback(async () => {
    if (!post || isPinning) return;
    triggerHaptic('impactMedium');
    setIsPinning(true);
    try {
      await CommunityFeedService.pinPost(post.id, !post.pinned);
      toast.show(post.pinned ? 'Post unpinned' : 'Post pinned', 'success');
    } catch {
      toast.show('Failed to update pin', 'error');
    } finally {
      setIsPinning(false);
    }
  }, [post, isPinning, toast]);

  const { data: authorStats } = useAuthorVenueStats(
    post?.author_id || null,
    post?.venue_id || ''
  );

  const handleUpvote = useCallback(() => {
    if (!post) return;
    triggerHaptic('impactLight');
    const newVote = post.user_vote === 1 ? 0 : 1;
    voteMutation.mutate({
      targetType: 'discussion',
      targetId: post.id,
      vote: newVote as 0 | 1,
    });
  }, [post, voteMutation]);

  const handleDownvote = useCallback(() => {
    if (!post) return;
    triggerHaptic('impactLight');
    const newVote = post.user_vote === -1 ? 0 : -1;
    voteMutation.mutate({
      targetType: 'discussion',
      targetId: post.id,
      vote: newVote as 0 | -1,
    });
  }, [post, voteMutation]);

  const handleShare = useCallback(async () => {
    if (!post) return;
    try {
      await Share.share({
        message: `${post.title} - RegattaFlow`,
      });
    } catch {
      // User cancelled
    }
  }, [post]);

  const handleReply = useCallback((comment: ThreadedComment) => {
    setReplyingTo({
      id: comment.id,
      authorName: comment.author?.full_name || 'Anonymous',
    });
  }, []);

  const handleEditComment = useCallback((commentId: string, newBody: string) => {
    updateCommentMutation.mutate({ commentId, body: newBody });
  }, [updateCommentMutation]);

  if (postLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B7280" />
      </View>
    );
  }

  if (!post) {
    const membersOnly = visibility === 'members_only';
    return (
      <View style={styles.loadingContainer}>
        <Ionicons
          name={membersOnly ? 'lock-closed-outline' : 'alert-circle-outline'}
          size={32}
          color="#D1D5DB"
        />
        <Text style={styles.errorText}>
          {membersOnly ? 'Shared with a group' : 'Post not found'}
        </Text>
        {membersOnly ? (
          <Text style={styles.errorDetailText}>
            This note is shared with a group you're not part of. Join the
            group to see what they know.
          </Text>
        ) : null}
        {onBack ? (
          <Pressable style={styles.backButton} onPress={onBack} accessibilityRole="button">
            <Ionicons name="chevron-back" size={20} color="#374151" />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const typeConfig = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.discussion;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + TufteTokens.spacing.compact }]}>
          {onBack && (
            <Pressable style={styles.backButton} onPress={onBack}>
              <Ionicons name="chevron-back" size={24} color="#374151" />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
          )}
        </View>

        {/* Post content */}
        <View style={styles.postSection}>
          {/* Pinned */}
          {post.pinned && (
            <View style={styles.pinnedRow}>
              <Ionicons name="pin" size={12} color="#059669" />
              <Text style={styles.pinnedLabel}>Pinned by moderator</Text>
            </View>
          )}

          {/* Type badge + community name */}
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: typeConfig.bgColor }]}>
              <Ionicons name={typeConfig.icon as any} size={12} color={typeConfig.color} />
              <Text style={[styles.typeText, { color: typeConfig.color }]}>
                {typeConfig.label}
              </Text>
            </View>
            {post.community?.name && (
              <View style={styles.communityBadge}>
                <Ionicons name="people-outline" size={11} color="#6B7280" />
                <Text style={styles.communityName}>{post.community.name}</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{post.title}</Text>

          {/* Author line with stats */}
          <View style={styles.authorRow}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorInitial}>
                {(post.author?.full_name || 'A')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>
                {post.author?.full_name || 'Anonymous'}
              </Text>
              <Text style={styles.authorMeta}>
                {timeAgo(post.created_at)}
                {post.updated_at && post.created_at &&
                  new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60000 &&
                  ' · edited'}
                {post.view_count > 0 && ` · ${post.view_count} views`}
              </Text>
              <Text style={styles.authorDate}>
                {new Date(post.created_at).toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {authorStats && authorStats.race_count > 0 && (
              <View style={styles.statsBadge}>
                <Ionicons name="trophy-outline" size={10} color="#D97706" />
                <Text style={styles.statsText}>
                  {authorStats.race_count} races
                  {authorStats.avg_finish && `, avg ${authorStats.avg_finish}th`}
                </Text>
              </View>
            )}
          </View>

          {/* Body */}
          {post.body && (
            <Text style={styles.body}>{post.body}</Text>
          )}

          {/* Topic tags */}
          {post.topic_tags && post.topic_tags.length > 0 && (
            <View style={styles.tagRow}>
              {post.topic_tags.map(tag => (
                <View key={tag.id} style={[styles.tag, { backgroundColor: `${tag.color}15` }]}>
                  {tag.icon && (
                    <Ionicons name={tag.icon as any} size={10} color={tag.color || '#6B7280'} />
                  )}
                  <Text style={[styles.tagText, { color: tag.color || '#6B7280' }]}>
                    {tag.display_name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Condition tags */}
          {post.condition_tags && post.condition_tags.length > 0 && (
            <View style={styles.conditionRow}>
              <Ionicons name="cloudy-outline" size={12} color="#6B7280" />
              {post.condition_tags.map(ct => (
                ct.label && (
                  <Text key={ct.id} style={styles.conditionLabel}>
                    {ct.label}
                  </Text>
                )
              ))}
            </View>
          )}

          {/* Location */}
          {post.location_label && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color="#6B7280" />
              <Text style={styles.locationText}>{post.location_label}</Text>
            </View>
          )}

          {/* Place anchor (racing area, hospital, …) */}
          {post.poi?.name && (
            <View style={styles.locationRow}>
              <Ionicons name="navigate-outline" size={12} color="#6B7280" />
              <Text style={styles.locationText}>{post.poi.name}</Text>
            </View>
          )}

          {/* Action bar */}
          <View style={styles.actionBar}>
            {/* Voting capsule */}
            <View style={styles.voteCapsule}>
              <Pressable style={styles.voteButton} onPress={handleUpvote}>
                <Ionicons
                  name={post.user_vote === 1 ? 'arrow-up' : 'arrow-up-outline'}
                  size={18}
                  color={post.user_vote === 1 ? '#007AFF' : '#6B7280'}
                />
              </Pressable>
              <Text style={[
                styles.voteScore,
                post.user_vote === 1 && { color: '#007AFF' },
                post.user_vote === -1 && { color: '#EF4444' },
              ]}>
                {(post.upvotes || 0) - (post.downvotes || 0)}
              </Text>
              <Pressable style={styles.voteButton} onPress={handleDownvote}>
                <Ionicons
                  name={post.user_vote === -1 ? 'arrow-down' : 'arrow-down-outline'}
                  size={18}
                  color={post.user_vote === -1 ? '#EF4444' : '#6B7280'}
                />
              </Pressable>
            </View>

            <View style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={16} color="#6B7280" />
              <Text style={styles.actionText}>{post.comment_count}</Text>
            </View>

            <Pressable style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={16} color="#6B7280" />
              <Text style={styles.actionText}>Share</Text>
            </Pressable>

            {isAuthor && (
              <Pressable style={styles.actionButton} onPress={() => setShowEditComposer(true)}>
                <Ionicons name="pencil-outline" size={16} color="#6B7280" />
                <Text style={styles.actionText}>Edit</Text>
              </Pressable>
            )}

            {isModerator && (
              <Pressable style={styles.actionButton} onPress={handlePinToggle} disabled={isPinning}>
                <Ionicons
                  name={post.pinned ? 'pin' : 'pin-outline'}
                  size={16}
                  color={post.pinned ? '#059669' : '#6B7280'}
                />
                <Text style={[styles.actionText, post.pinned && { color: '#059669' }]}>
                  {post.pinned ? 'Unpin' : 'Pin'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            {post.comment_count} {post.comment_count === 1 ? 'Comment' : 'Comments'}
          </Text>

          {commentsLoading ? (
            <ActivityIndicator size="small" color="#6B7280" style={{ padding: 20 }} />
          ) : (
            <CommentList
              comments={comments || []}
              currentUserId={user?.id}
              onReply={handleReply}
              onVote={(commentId, vote: 1 | -1 | 0) => {
                voteMutation.mutate({
                  targetType: 'comment',
                  targetId: commentId,
                  vote,
                  postId,
                });
              }}
              onEditComment={handleEditComment}
            />
          )}
        </View>
      </ScrollView>

      {/* Comment composer */}
      <CommentComposer
        postId={postId}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        bottomInset={insets.bottom}
      />

      {/* Edit post modal */}
      {post && (
        <PostComposer
          visible={showEditComposer}
          venueId={post.venue_id}
          communityId={post.community_id || undefined}
          editingPost={{
            id: post.id,
            title: post.title,
            body: post.body,
            post_type: post.post_type,
          }}
          onDismiss={() => setShowEditComposer(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TufteTokens.backgrounds.paper,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
    ...Platform.select({
      web: { maxWidth: 640, width: '100%', alignSelf: 'center' } as any,
      default: {},
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: TufteTokens.spacing.standard,
  },
  errorText: {
    ...TufteTokens.typography.secondary,
    color: '#9CA3AF',
  },
  errorDetailText: {
    ...TufteTokens.typography.secondary,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TufteTokens.spacing.section,
    paddingVertical: TufteTokens.spacing.compact,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: TufteTokens.spacing.tight,
  },
  backLabel: {
    fontSize: 17,
    color: '#374151',
    letterSpacing: -0.4,
  },
  // Post
  postSection: {
    paddingHorizontal: TufteTokens.spacing.section,
    gap: TufteTokens.spacing.compact,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedLabel: {
    ...TufteTokens.typography.micro,
    color: '#059669',
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: TufteTokens.borderRadius.minimal,
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  communityName: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
    fontWeight: '500',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    ...TufteTokens.typography.primary,
    fontSize: 18,
    lineHeight: 24,
    color: '#111827',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TufteTokens.spacing.compact,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorInitial: {
    ...TufteTokens.typography.tertiary,
    fontWeight: '600',
    color: '#6B7280',
  },
  authorInfo: {
    flex: 1,
    gap: 1,
  },
  authorName: {
    ...TufteTokens.typography.tertiary,
    fontWeight: '600',
    color: '#374151',
  },
  authorMeta: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
  },
  authorDate: {
    fontSize: 10,
    color: '#C7C7CC',
    marginTop: 1,
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FEF3C7',
    borderRadius: TufteTokens.borderRadius.minimal,
  },
  statsText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#D97706',
  },
  body: {
    ...TufteTokens.typography.secondary,
    color: '#374151',
    lineHeight: 20,
    marginTop: TufteTokens.spacing.compact,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: TufteTokens.spacing.compact,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: TufteTokens.borderRadius.minimal,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: TufteTokens.spacing.compact,
  },
  conditionLabel: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
    backgroundColor: TufteTokens.backgrounds.subtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: TufteTokens.borderRadius.minimal,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
  },
  // Actions
  actionBar: {
    flexDirection: 'row',
    gap: TufteTokens.spacing.section,
    paddingTop: TufteTokens.spacing.standard,
    marginTop: TufteTokens.spacing.compact,
    borderTopWidth: TufteTokens.borders.hairline,
    borderTopColor: TufteTokens.borders.colorSubtle,
  },
  voteCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  voteButton: {
    padding: 6,
  },
  voteScore: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    minWidth: 20,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: TufteTokens.spacing.tight,
  },
  actionText: {
    ...TufteTokens.typography.tertiary,
    color: '#6B7280',
  },
  // Comments
  commentsSection: {
    marginTop: TufteTokens.spacing.section,
    paddingHorizontal: TufteTokens.spacing.section,
  },
  commentsTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#8E8E93',
    marginBottom: TufteTokens.spacing.standard,
  },
});

export default PostDetailScreen;
