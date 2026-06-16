/**
 * CommentComposer
 *
 * Inline reply input at the bottom of the post detail screen.
 * Shows "Replying to {name}" when replying to a specific comment.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TufteTokens } from '@/constants/designSystem';
import { useCreateComment } from '@/hooks/useCommunityFeed';
import { useToast } from '@/components/ui/AppToast';

interface CommentComposerProps {
  postId: string;
  replyingTo?: { id: string; authorName: string } | null;
  onCancelReply?: () => void;
  bottomInset?: number;
}

export function CommentComposer({
  postId,
  replyingTo,
  onCancelReply,
  bottomInset = 0,
}: CommentComposerProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const createComment = useCreateComment();
  const toast = useToast();

  // Focus input when replying to someone
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;

    try {
      await createComment.mutateAsync({
        postId,
        body: text.trim(),
        parentId: replyingTo?.id,
      });
      setText('');
      onCancelReply?.();
      toast.show('Comment posted', 'success');
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to post comment';
      toast.show(errorMessage, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, postId, replyingTo, createComment, onCancelReply]);

  return (
    <View style={[styles.container, { paddingBottom: TufteTokens.spacing.compact + bottomInset }]}>
      {/* Replying to indicator */}
      {replyingTo && (
        <View style={styles.replyingTo}>
          <Ionicons name="return-down-forward" size={12} color="#007AFF" />
          <Text style={styles.replyingToText}>
            Replying to {replyingTo.authorName}
          </Text>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <Ionicons name="close" size={14} color="#9CA3AF" />
          </Pressable>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={replyingTo ? `Reply to ${replyingTo.authorName}...` : 'Add a comment...'}
          placeholderTextColor="#9CA3AF"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={handleSubmit}
          disabled={!text.trim() || createComment.isPending}
        >
          {createComment.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={16} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: TufteTokens.backgrounds.paper,
    borderTopWidth: TufteTokens.borders.hairline,
    borderTopColor: TufteTokens.borders.colorSubtle,
    paddingHorizontal: TufteTokens.spacing.section,
    paddingVertical: TufteTokens.spacing.compact,
  },
  replyingTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: TufteTokens.spacing.compact,
  },
  replyingToText: {
    ...TufteTokens.typography.micro,
    color: '#007AFF',
    fontWeight: '500',
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: TufteTokens.spacing.compact,
  },
  input: {
    flex: 1,
    ...TufteTokens.typography.tertiary,
    color: '#374151',
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    maxHeight: 100,
    lineHeight: 18,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});

export default CommentComposer;
