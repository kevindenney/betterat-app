/**
 * CommentNode
 *
 * Single comment with indent by depth, upvote, reply button.
 * Max 3 levels of nesting. Recursive for replies.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TufteTokens } from '@/constants/designSystem';
import type { ThreadedComment } from '@/types/community-feed';

const MAX_DEPTH = 3;
const INDENT_WIDTH = 16;

interface CommentNodeProps {
  comment: ThreadedComment;
  depth: number;
  currentUserId?: string | null;
  onReply?: (comment: ThreadedComment) => void;
  onVote?: (commentId: string, vote: 1 | -1 | 0) => void;
  onEditComment?: (commentId: string, newBody: string) => void;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function CommentNode({ comment, depth, currentUserId, onReply, onVote, onEditComment }: CommentNodeProps) {
  const isUpvoted = comment.user_vote === 1;
  const isDownvoted = comment.user_vote === -1;
  const isAuthor = !!currentUserId && comment.author_id === currentUserId;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);
  const [showReplies, setShowReplies] = useState(true);
  const replyCount = comment.replies?.length || 0;

  const handleUpvote = () => {
    onVote?.(comment.id, isUpvoted ? 0 : 1);
  };

  const handleDownvote = () => {
    onVote?.(comment.id, isDownvoted ? 0 : -1);
  };

  const handleSaveEdit = useCallback(() => {
    if (!editText.trim()) return;
    onEditComment?.(comment.id, editText.trim());
    setIsEditing(false);
  }, [editText, comment.id, onEditComment]);

  const handleCancelEdit = useCallback(() => {
    setEditText(comment.body);
    setIsEditing(false);
  }, [comment.body]);

  const score = (comment.upvotes || 0) - (comment.downvotes || 0);

  return (
    <View style={[styles.container, { marginLeft: depth * INDENT_WIDTH }]}>
      {/* Thread line for nested comments */}
      {depth > 0 && <View style={styles.threadLine} />}

      <View style={styles.commentBody}>
        {/* Header: avatar, name, time */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(comment.author?.full_name || 'A')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.authorName}>
            {comment.author?.full_name || 'Anonymous'}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.time}>{timeAgo(comment.created_at)}</Text>
          {comment.updated_at && comment.created_at &&
            new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 60000 && (
            <>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="pencil" size={9} color="#9CA3AF" />
              <Text style={styles.editedLabel}>edited</Text>
            </>
          )}
        </View>

        {/* Comment text */}
        {isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              maxLength={2000}
            />
            <View style={styles.editActions}>
              <Pressable style={styles.editCancelButton} onPress={handleCancelEdit}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.editSaveButton, !editText.trim() && { opacity: 0.4 }]}
                onPress={handleSaveEdit}
                disabled={!editText.trim()}
              >
                <Text style={styles.editSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.text}>{comment.body}</Text>
        )}

        {/* Actions: vote, reply */}
        <View style={styles.actions}>
          <View style={styles.voteRow}>
            <Pressable style={styles.actionButton} onPress={handleUpvote}>
              <Ionicons
                name={isUpvoted ? 'arrow-up' : 'arrow-up-outline'}
                size={14}
                color={isUpvoted ? '#007AFF' : '#9CA3AF'}
              />
            </Pressable>
            {score !== 0 && (
              <Text style={[
                styles.scoreText,
                isUpvoted && { color: '#007AFF' },
                isDownvoted && { color: '#EF4444' },
              ]}>
                {score}
              </Text>
            )}
            <Pressable style={styles.actionButton} onPress={handleDownvote}>
              <Ionicons
                name={isDownvoted ? 'arrow-down' : 'arrow-down-outline'}
                size={14}
                color={isDownvoted ? '#EF4444' : '#9CA3AF'}
              />
            </Pressable>
          </View>

          {depth < MAX_DEPTH && onReply && (
            <Pressable
              style={styles.actionButton}
              onPress={() => onReply(comment)}
            >
              <Ionicons name="return-down-forward-outline" size={14} color="#9CA3AF" />
              <Text style={styles.actionText}>Reply</Text>
            </Pressable>
          )}

          {isAuthor && onEditComment && !isEditing && (
            <Pressable
              style={styles.actionButton}
              onPress={() => setIsEditing(true)}
            >
              <Ionicons name="pencil-outline" size={13} color="#9CA3AF" />
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Nested replies */}
      {replyCount > 0 && (
        <>
          <Pressable
            style={styles.collapseButton}
            onPress={() => setShowReplies(!showReplies)}
          >
            <Ionicons
              name={showReplies ? 'chevron-up' : 'chevron-down'}
              size={12}
              color="#9CA3AF"
            />
            <Text style={styles.collapseText}>
              {showReplies ? 'Hide' : 'Show'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </Text>
          </Pressable>
          {showReplies && (
            <View style={styles.replies}>
              {comment.replies!.map(reply => (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  currentUserId={currentUserId}
                  onReply={onReply}
                  onVote={onVote}
                  onEditComment={onEditComment}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  threadLine: {
    position: 'absolute',
    left: -INDENT_WIDTH / 2,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  commentBody: {
    paddingVertical: TufteTokens.spacing.compact,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
  },
  authorName: {
    ...TufteTokens.typography.micro,
    fontWeight: '600',
    color: '#374151',
  },
  dot: {
    ...TufteTokens.typography.micro,
    color: '#D1D5DB',
  },
  time: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
  },
  editedLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  text: {
    ...TufteTokens.typography.tertiary,
    color: '#374151',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: TufteTokens.spacing.standard,
    alignItems: 'center',
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    minWidth: 14,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  actionText: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 2,
  },
  collapseText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  editContainer: {
    gap: 6,
  },
  editInput: {
    ...TufteTokens.typography.tertiary,
    color: '#374151',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    lineHeight: 18,
    minHeight: 40,
    maxHeight: 120,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  editCancelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  editSaveButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  editSaveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  replies: {
    marginTop: 0,
  },
});

export default CommentNode;
