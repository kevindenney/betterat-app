/**
 * StepDiscussionInline — Discussion tab body for the main step card.
 *
 * Compact version of the fullscreen Discussion view. No top-bar / hero /
 * tab bar — just the feed of notes (with reactions + Reply) and a composer.
 * Designed to be embedded as the 4th tab next to Plan/Do/Reflect, scrolling
 * with the parent step card.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CornerUpLeft,
  Flame,
  Lightbulb,
  MessageCircle,
  Send,
} from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import {
  getStepDiscussion,
  postStepNote,
  toggleStepReaction,
  type StepDiscussionRow,
  type StepDiscussionReactionKind,
} from '@/services/StepDiscussionService';

export interface StepDiscussionInlineProps {
  stepId: string;
}

function shortAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const secs = Math.max(0, (Date.now() - ts) / 1000);
  if (secs < 60) return `${Math.round(secs)}s`;
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)}m`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h`;
  const days = hrs / 24;
  if (days < 7) return `${Math.round(days)}d`;
  return new Date(iso).toLocaleDateString();
}

function initialsFrom(name: string | null): string {
  if (!name) return '?';
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export function StepDiscussionInline({ stepId }: StepDiscussionInlineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<{
    noteId: string;
    authorName: string;
  } | null>(null);

  const { data: feedRows, isLoading } = useQuery({
    queryKey: ['phase10-step-discussion', stepId, user?.id],
    queryFn: () => getStepDiscussion(stepId, user?.id ?? null),
    enabled: Boolean(stepId),
    staleTime: 30 * 1000,
  });

  const postMutation = useMutation({
    mutationFn: async (input: { body: string; parentId?: string | null }) => {
      if (!user?.id) throw new Error('Sign in to post.');
      return postStepNote({
        stepId,
        userId: user.id,
        body: input.body,
        parentId: input.parentId ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phase10-step-discussion', stepId] });
      queryClient.invalidateQueries({ queryKey: ['step-discussion-peek', stepId] });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async (input: {
      discussionId: string;
      kind: StepDiscussionReactionKind;
      shouldSet: boolean;
    }) => {
      if (!user?.id) throw new Error('Sign in to react.');
      await toggleStepReaction({
        discussionId: input.discussionId,
        userId: user.id,
        kind: input.kind,
        shouldSet: input.shouldSet,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phase10-step-discussion', stepId] });
    },
  });

  const handleSubmit = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    await postMutation.mutateAsync({
      body,
      parentId: replyingTo?.noteId ?? null,
    });
    setDraft('');
    setReplyingTo(null);
  }, [draft, replyingTo, postMutation]);

  const handleReact = useCallback(
    (noteId: string, kind: StepDiscussionReactionKind, isOn: boolean) => {
      reactMutation.mutate({ discussionId: noteId, kind, shouldSet: !isOn });
    },
    [reactMutation],
  );

  const handleReply = useCallback((note: StepDiscussionRow) => {
    setReplyingTo({
      noteId: note.id,
      authorName: note.author_name ?? 'Sailor',
    });
  }, []);

  const viewerInitials = useMemo(() => {
    const name = (user?.user_metadata?.full_name as string | undefined) ?? null;
    return initialsFrom(name);
  }, [user?.user_metadata?.full_name]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={C.label2} />
      </View>
    );
  }

  const notes = feedRows ?? [];
  const isEmpty = notes.length === 0;

  return (
    <View style={styles.wrap}>
      {isEmpty ? (
        <View style={styles.empty}>
          <MessageCircle size={28} color={C.label3} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>No notes yet</Text>
          <Text style={styles.emptyBody}>
            Share a reflection below to start the discussion for this step.
          </Text>
        </View>
      ) : (
        <View style={styles.feed}>
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              viewerUserId={user?.id ?? null}
              onReact={(kind, isOn) => handleReact(note.id, kind, isOn)}
              onReply={() => handleReply(note)}
            />
          ))}
        </View>
      )}

      {replyingTo ? (
        <View style={styles.replyHeader}>
          <CornerUpLeft size={12} color={C.blue} />
          <Text style={styles.replyHeaderText}>
            Replying to <Text style={styles.replyHeaderStrong}>{replyingTo.authorName}</Text>
          </Text>
          <Pressable
            hitSlop={6}
            onPress={() => setReplyingTo(null)}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
          >
            <Text style={styles.replyHeaderCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.composer}>
        <View style={styles.composerAvatar}>
          <Text style={styles.composerAvatarText}>{viewerInitials}</Text>
        </View>
        <TextInput
          style={styles.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={
            replyingTo
              ? `Reply to ${replyingTo.authorName}…`
              : 'Share your reflection…'
          }
          placeholderTextColor={C.label3}
          editable={!postMutation.isPending}
          multiline
          maxLength={4000}
        />
        <Pressable
          style={[
            styles.sendButton,
            (!draft.trim() || postMutation.isPending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!draft.trim() || postMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Post"
          hitSlop={6}
        >
          {postMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={14} color="#FFFFFF" strokeWidth={2.2} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

interface NoteCardProps {
  note: StepDiscussionRow;
  viewerUserId: string | null;
  onReact: (kind: StepDiscussionReactionKind, isOn: boolean) => void;
  onReply: () => void;
}

function NoteCard({ note, viewerUserId, onReact, onReply }: NoteCardProps) {
  const initials = note.author_initials ?? initialsFrom(note.author_name);
  const isMine = viewerUserId != null && note.user_id === viewerUserId;
  const isViewerReacted = (kind: StepDiscussionReactionKind) =>
    note.viewer_reactions.includes(kind);

  return (
    <View style={styles.noteCard}>
      <View style={styles.noteHeader}>
        <View
          style={[
            styles.noteAvatar,
            isMine ? styles.noteAvatarMine : styles.noteAvatarOther,
          ]}
        >
          <Text style={styles.noteAvatarText}>{initials}</Text>
        </View>
        <View style={styles.noteHeaderText}>
          <Text style={styles.noteAuthor} numberOfLines={1}>
            {note.author_name ?? 'Sailor'}
          </Text>
          <Text style={styles.noteWhen}>{shortAgo(note.created_at)}</Text>
        </View>
      </View>

      <Text style={styles.noteBody}>{note.body}</Text>

      {note.replies && note.replies.length > 0 ? (
        <View style={styles.replies}>
          {note.replies.map((reply) => {
            const replyInitials =
              reply.author_initials ?? initialsFrom(reply.author_name);
            return (
              <View key={reply.id} style={styles.replyRow}>
                <View style={styles.replyAvatar}>
                  <Text style={styles.replyAvatarText}>{replyInitials}</Text>
                </View>
                <View style={styles.replyBody}>
                  <Text style={styles.replyAuthor}>
                    {reply.author_name ?? 'Sailor'}
                  </Text>
                  <Text style={styles.replyText}>{reply.body}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.reactionRow}>
        <ReactionChip
          icon={
            <Flame
              size={11}
              color={isViewerReacted('fire') ? C.coral : C.label2}
              fill={isViewerReacted('fire') ? C.coral : 'transparent'}
            />
          }
          count={note.reaction_counts.fire}
          on={isViewerReacted('fire')}
          onPress={() => onReact('fire', isViewerReacted('fire'))}
        />
        <ReactionChip
          icon={
            <Lightbulb
              size={11}
              color={isViewerReacted('insight') ? C.coral : C.label2}
              fill={isViewerReacted('insight') ? C.coral : 'transparent'}
            />
          }
          count={note.reaction_counts.insight}
          on={isViewerReacted('insight')}
          onPress={() => onReact('insight', isViewerReacted('insight'))}
        />
        <ReactionChip
          icon={
            <MessageCircle
              size={11}
              color={isViewerReacted('question') ? C.coral : C.label2}
              fill={isViewerReacted('question') ? C.coral : 'transparent'}
            />
          }
          count={note.reaction_counts.question}
          on={isViewerReacted('question')}
          onPress={() => onReact('question', isViewerReacted('question'))}
        />
        <View style={{ flex: 1 }} />
        <Pressable
          style={styles.replyButton}
          onPress={onReply}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Reply"
        >
          <CornerUpLeft size={12} color={C.blue} />
          <Text style={styles.replyButtonText}>Reply</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReactionChip({
  icon,
  count,
  on,
  onPress,
}: {
  icon: React.ReactNode;
  count: number;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.reactionChip, on && styles.reactionChipOn]}
      onPress={onPress}
      hitSlop={4}
    >
      {icon}
      <Text style={[styles.reactionCount, on && styles.reactionCountOn]}>
        {count}
      </Text>
    </Pressable>
  );
}

const C = {
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  line: '#E5E5EA',
  gray6: '#F2F2F7',
  blue: '#007AFF',
  blueTint: '#E6F0FF',
  coral: '#FF3B30',
  coralSoft: '#FDDBDA',
  card: '#FFFFFF',
  greenDeep: '#0A6B2A',
  purpleSoft: '#D7D6F4',
  purpleTint: '#EFEFFB',
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  loading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.label,
  },
  emptyBody: {
    fontSize: 13,
    color: C.label3,
    textAlign: 'center',
    lineHeight: 18,
  },
  feed: {
    gap: 10,
  },
  noteCard: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteAvatarMine: {
    backgroundColor: C.blueTint,
  },
  noteAvatarOther: {
    backgroundColor: C.gray6,
  },
  noteAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.label,
    letterSpacing: 0.2,
  },
  noteHeaderText: {
    flex: 1,
  },
  noteAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: C.label,
  },
  noteWhen: {
    fontSize: 11,
    color: C.label3,
    marginTop: 1,
  },
  noteBody: {
    fontSize: 14,
    lineHeight: 20,
    color: C.label,
    letterSpacing: -0.1,
  },
  replies: {
    gap: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: C.line,
  },
  replyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  replyAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.gray6,
  },
  replyAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: C.label,
  },
  replyBody: {
    flex: 1,
    gap: 2,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: C.label2,
  },
  replyText: {
    fontSize: 13,
    color: C.label,
    lineHeight: 18,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  reactionChipOn: {
    backgroundColor: C.coralSoft,
    borderColor: C.coral,
  },
  reactionCount: {
    fontSize: 11,
    color: C.label2,
    fontWeight: '600',
  },
  reactionCountOn: {
    color: C.coral,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  replyButtonText: {
    fontSize: 12,
    color: C.blue,
    fontWeight: '500',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.blueTint,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  replyHeaderText: {
    flex: 1,
    fontSize: 12,
    color: C.label2,
  },
  replyHeaderStrong: {
    fontWeight: '600',
    color: C.label,
  },
  replyHeaderCancel: {
    fontSize: 12,
    color: C.blue,
    fontWeight: '500',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
  composerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.blueTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.label,
  },
  composerInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 14,
    color: C.label,
    backgroundColor: C.gray6,
    maxHeight: 120,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
