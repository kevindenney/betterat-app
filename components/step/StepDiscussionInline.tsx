/**
 * StepDiscussionInline — Discussion tab body for the main step card.
 *
 * Renders the canonical Discuss surface: an access card naming everyone
 * who can see the thread, the message feed (with optional cross-step
 * quote pull-quotes), and a composer that can quote one of the viewer's
 * own steps.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CornerUpLeft,
  Link as LinkIcon,
  MessageCircle,
  Send,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { supabase } from '@/services/supabase';
import {
  getBlueprintStepDiscussion,
  getStepDiscussion,
  postBlueprintStepNote,
  postStepNote,
  toggleStepReaction,
  type StepDiscussionRow,
  type StepDiscussionReactionKind,
} from '@/services/StepDiscussionService';
import type { TimelineStepRecord } from '@/types/timeline-steps';

export interface StepAccessPerson {
  userId: string;
  displayName: string;
  initials: string;
  avatarColor?: string | null;
  /** Normalized role from step_collaborators.role. Null for the owner. */
  role?: string | null;
  isOwner?: boolean;
}

export interface StepDiscussionInlineProps {
  stepId: string;
  /** Owner + collaborators with access to this step. */
  access?: StepAccessPerson[];
  /** Which scope to land on when the view first mounts. Used when
   *  routing in from a cohort-scoped surface (Watch stream item or a
   *  cohort_discussion_post notification). Ignored when the step
   *  isn't blueprint-derived (Cohort tab won't render anyway). */
  initialScope?: 'private' | 'cohort';
}

function shortAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const secs = Math.max(0, (Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return hrs < 2 ? 'this morning' : `${Math.round(hrs)}h ago`;
  const days = hrs / 24;
  if (days < 2) return 'yesterday';
  if (days < 7) return `${Math.round(days)} days ago`;
  return new Date(iso).toLocaleDateString();
}

function initialsFrom(name: string | null | undefined): string {
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

/**
 * Map normalized role → uppercase pill label. Owners and unclassified
 * collaborators get no pill — render the bare name.
 */
function roleLabel(role: string | null | undefined, isOwner?: boolean): string | null {
  if (isOwner) return null;
  if (!role) return null;
  const r = role.toLowerCase();
  if (r === 'collaborator' || r === 'other') return null;
  if (r === 'helm' || r === 'foredeck') return `CREW · ${r.toUpperCase()}`;
  return r.toUpperCase();
}

const AVATAR_COLORS = ['#1F6FEB', '#22A06B', '#F08C00', '#9333EA', '#DC2626'];
function fallbackAvatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] as string;
}

const REACTION_GLYPH: Record<StepDiscussionReactionKind, string> = {
  fire: '👍',
  insight: '💩',
  question: '🙏',
};

type DiscussionScope = 'private' | 'cohort';

export function StepDiscussionInline({
  stepId,
  access = [],
  initialScope = 'private',
}: StepDiscussionInlineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<DiscussionScope>(initialScope);
  const [draft, setDraft] = useState('');

  // Resolve the blueprint_step link so we know whether to surface the
  // Cohort tab. Null = step isn't blueprint-derived (or its forked
  // copy was never linked back to a canonical blueprint_step), so the
  // shared thread has no home and we render only Private.
  const { data: blueprintStepId = null } = useQuery({
    queryKey: ['step-blueprint-step-link', stepId],
    enabled: Boolean(stepId),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from('timeline_steps')
        .select('source_blueprint_step_id')
        .eq('id', stepId)
        .maybeSingle();
      return (data as { source_blueprint_step_id?: string | null } | null)
        ?.source_blueprint_step_id ?? null;
    },
  });
  const hasCohort = Boolean(blueprintStepId);
  // Snap back to Private if the user is somehow on Cohort but the
  // link goes away (rename, delete, etc.).
  const effectiveScope: DiscussionScope = hasCohort ? scope : 'private';

  // Realtime cohort subscription — when the user is viewing the
  // Cohort tab on a blueprint-linked step, subscribe to inserts on
  // step_discussions WHERE blueprint_step_id matches. New posts from
  // anyone else trigger a refetch so the thread updates without the
  // viewer having to reload.
  useEffect(() => {
    if (!blueprintStepId || effectiveScope !== 'cohort') return;
    const channel = supabase
      .channel(`cohort-discussion:${blueprintStepId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'step_discussions',
          filter: `blueprint_step_id=eq.${blueprintStepId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['phase10-blueprint-step-discussion', blueprintStepId],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [blueprintStepId, effectiveScope, queryClient]);
  const [replyingTo, setReplyingTo] = useState<{
    noteId: string;
    authorName: string;
  } | null>(null);
  const [pendingQuote, setPendingQuote] = useState<{
    stepId: string;
    stepTitle: string | null;
    stepNumber: number | null;
    body: string;
  } | null>(null);
  const [quotePickerOpen, setQuotePickerOpen] = useState(false);

  const { data: feedRows, isLoading } = useQuery({
    queryKey:
      effectiveScope === 'cohort'
        ? ['phase10-blueprint-step-discussion', blueprintStepId, user?.id]
        : ['phase10-step-discussion', stepId, user?.id],
    queryFn: () =>
      effectiveScope === 'cohort' && blueprintStepId
        ? getBlueprintStepDiscussion(blueprintStepId, user?.id ?? null)
        : getStepDiscussion(stepId, user?.id ?? null),
    enabled:
      Boolean(stepId) && (effectiveScope === 'private' || Boolean(blueprintStepId)),
    staleTime: 30 * 1000,
  });

  const postMutation = useMutation({
    mutationFn: async (input: {
      body: string;
      parentId?: string | null;
      quotedStepId?: string | null;
      quoteBody?: string | null;
    }) => {
      if (!user?.id) throw new Error('Sign in to post.');
      if (effectiveScope === 'cohort' && blueprintStepId) {
        return postBlueprintStepNote({
          blueprintStepId,
          userId: user.id,
          body: input.body,
          parentId: input.parentId ?? null,
          quotedStepId: input.quotedStepId ?? null,
          quoteBody: input.quoteBody ?? null,
        });
      }
      return postStepNote({
        stepId,
        userId: user.id,
        body: input.body,
        parentId: input.parentId ?? null,
        quotedStepId: input.quotedStepId ?? null,
        quoteBody: input.quoteBody ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phase10-step-discussion', stepId] });
      queryClient.invalidateQueries({
        queryKey: ['phase10-blueprint-step-discussion', blueprintStepId],
      });
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
      quotedStepId: pendingQuote?.stepId ?? null,
      quoteBody: pendingQuote?.body ?? null,
    });
    setDraft('');
    setReplyingTo(null);
    setPendingQuote(null);
  }, [draft, replyingTo, pendingQuote, postMutation]);

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

  // Map author_user_id → role for per-message pill rendering.
  const accessByUser = useMemo(() => {
    const m = new Map<string, StepAccessPerson>();
    for (const p of access) m.set(p.userId, p);
    return m;
  }, [access]);

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
      {hasCohort ? (
        <View style={styles.scopeRow}>
          <View style={styles.scopePillGroup}>
            <Pressable
              onPress={() => setScope('private')}
              style={[
                styles.scopePill,
                effectiveScope === 'private' && styles.scopePillActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: effectiveScope === 'private' }}
            >
              <Text
                style={[
                  styles.scopePillText,
                  effectiveScope === 'private' && styles.scopePillTextActive,
                ]}
              >
                Mine
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setScope('cohort')}
              style={[
                styles.scopePill,
                effectiveScope === 'cohort' && styles.scopePillActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: effectiveScope === 'cohort' }}
            >
              <Text
                style={[
                  styles.scopePillText,
                  effectiveScope === 'cohort' && styles.scopePillTextActive,
                ]}
              >
                Cohort
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        // No cohort thread for this step — surface a small hint so the
        // absence of the toggle reads as deliberate ("you're not in a
        // shared template here") rather than missing.
        <Text style={styles.scopeHint}>
          MINE · no cohort thread to share into
        </Text>
      )}

      {isEmpty ? (
        <View style={styles.empty}>
          <MessageCircle size={28} color={C.label3} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>
            {effectiveScope === 'cohort'
              ? 'No cohort posts yet'
              : 'No notes yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {effectiveScope === 'cohort'
              ? 'Be the first to share with everyone subscribed to this plan.'
              : 'Capture a private note below — only people with direct access to this step will see it.'}
          </Text>
        </View>
      ) : (
        <View style={styles.feed}>
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              viewerUserId={user?.id ?? null}
              accessEntry={accessByUser.get(note.user_id) ?? null}
              onReact={(kind, isOn) => handleReact(note.id, kind, isOn)}
              onReply={() => handleReply(note)}
            />
          ))}
        </View>
      )}

      {pendingQuote ? (
        <View style={styles.quoteChip}>
          <LinkIcon size={12} color={C.blue} />
          <Text style={styles.quoteChipText} numberOfLines={2}>
            <Text style={styles.quoteChipLabel}>
              {pendingQuote.stepNumber != null
                ? `From my Step ${pendingQuote.stepNumber}: `
                : 'From my step: '}
            </Text>
            “{pendingQuote.body}”
          </Text>
          <Pressable
            onPress={() => setPendingQuote(null)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Remove quote"
          >
            <X size={12} color={C.label3} />
          </Pressable>
        </View>
      ) : null}

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
          style={styles.quoteButton}
          onPress={() => setQuotePickerOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Quote a step"
        >
          <LinkIcon size={14} color={C.label2} />
        </Pressable>
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

      <QuoteStepPicker
        visible={quotePickerOpen}
        onClose={() => setQuotePickerOpen(false)}
        excludeStepId={stepId}
        onPick={(picked) => {
          setPendingQuote(picked);
          setQuotePickerOpen(false);
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

interface NoteCardProps {
  note: StepDiscussionRow;
  viewerUserId: string | null;
  accessEntry: StepAccessPerson | null;
  onReact: (kind: StepDiscussionReactionKind, isOn: boolean) => void;
  onReply: () => void;
}

function NoteCard({ note, viewerUserId, accessEntry, onReact, onReply }: NoteCardProps) {
  const initials = note.author_initials ?? initialsFrom(note.author_name);
  const isMine = viewerUserId != null && note.user_id === viewerUserId;
  const isViewerReacted = (kind: StepDiscussionReactionKind) =>
    note.viewer_reactions.includes(kind);
  const pill = roleLabel(accessEntry?.role, accessEntry?.isOwner);
  const avatarColor =
    accessEntry?.avatarColor ?? fallbackAvatarColor(note.user_id);

  return (
    <View style={styles.noteCard}>
      <View style={styles.noteHeader}>
        <View
          style={[
            styles.noteAvatar,
            { backgroundColor: avatarColor },
          ]}
        >
          <Text style={styles.noteAvatarText}>{initials}</Text>
        </View>
        <View style={styles.noteHeaderText}>
          <View style={styles.noteAuthorRow}>
            <Text style={styles.noteAuthor} numberOfLines={1}>
              {note.author_name ?? 'Sailor'}
            </Text>
            {pill ? (
              <View style={styles.rolePill}>
                <View style={styles.rolePillDot} />
                <Text style={styles.rolePillText}>{pill}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.noteWhen}>{shortAgo(note.created_at)}</Text>
        </View>
      </View>

      {note.quote ? (
        <View style={styles.quoteBlock}>
          <Text style={styles.quoteIntro}>
            {note.quote.step_number != null
              ? `From ${isMine ? 'my' : 'their'} Step ${note.quote.step_number}: `
              : `From ${isMine ? 'my' : 'their'} step: `}
            <Text style={styles.quoteBody}>“{note.quote.body}”</Text>
          </Text>
        </View>
      ) : null}

      <Text style={styles.noteBody}>{note.body}</Text>

      {note.replies && note.replies.length > 0 ? (
        <View style={styles.replies}>
          {note.replies.map((reply) => {
            const replyInitials =
              reply.author_initials ?? initialsFrom(reply.author_name);
            return (
              <View key={reply.id} style={styles.replyRow}>
                <View
                  style={[
                    styles.replyAvatar,
                    { backgroundColor: fallbackAvatarColor(reply.user_id) },
                  ]}
                >
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
        {(['fire', 'insight', 'question'] as StepDiscussionReactionKind[]).map((kind) => (
          <ReactionChip
            key={kind}
            glyph={REACTION_GLYPH[kind]}
            count={note.reaction_counts[kind]}
            on={isViewerReacted(kind)}
            onPress={() => onReact(kind, isViewerReacted(kind))}
          />
        ))}
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
  glyph,
  count,
  on,
  onPress,
}: {
  glyph: string;
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
      <Text style={styles.reactionGlyph}>{glyph}</Text>
      {count > 0 ? (
        <Text style={[styles.reactionCount, on && styles.reactionCountOn]}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// QuoteStepPicker — modal listing viewer's recent steps so they can drop a
// pull-quote into the composer.
// ---------------------------------------------------------------------------

interface QuoteStepPickerProps {
  visible: boolean;
  onClose: () => void;
  excludeStepId: string;
  onPick: (picked: {
    stepId: string;
    stepTitle: string | null;
    stepNumber: number | null;
    body: string;
  }) => void;
}

function QuoteStepPicker({ visible, onClose, excludeStepId, onPick }: QuoteStepPickerProps) {
  const { data: steps, isLoading } = useMyTimeline(null);
  const [selectedStep, setSelectedStep] = useState<TimelineStepRecord | null>(null);
  const [quoteText, setQuoteText] = useState('');

  const candidates = useMemo(
    () => (steps ?? []).filter((s) => s.id !== excludeStepId).slice(0, 30),
    [steps, excludeStepId],
  );

  const reset = useCallback(() => {
    setSelectedStep(null);
    setQuoteText('');
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedStep) return;
    const body = quoteText.trim();
    if (!body) return;
    onPick({
      stepId: selectedStep.id,
      stepTitle: selectedStep.title ?? null,
      stepNumber: (selectedStep as any).sort_order ?? null,
      body,
    });
    reset();
  }, [selectedStep, quoteText, onPick, reset]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedStep ? 'Pick a quote' : 'Quote one of your steps'}
            </Text>
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={C.label2} />
            </Pressable>
          </View>

          {!selectedStep ? (
            <View style={styles.modalBody}>
              {isLoading ? (
                <ActivityIndicator color={C.label2} />
              ) : candidates.length === 0 ? (
                <Text style={styles.modalEmpty}>
                  You don't have other steps yet. Add one to quote from it.
                </Text>
              ) : (
                <View style={styles.pickerList}>
                  {candidates.map((step) => (
                    <Pressable
                      key={step.id}
                      style={styles.pickerRow}
                      onPress={() => {
                        setSelectedStep(step);
                        const seed =
                          (step as any).description ??
                          (step as any).metadata?.plan?.what_will_you_do ??
                          '';
                        setQuoteText(typeof seed === 'string' ? seed.slice(0, 240) : '');
                      }}
                    >
                      <Text style={styles.pickerRowTitle} numberOfLines={1}>
                        {step.title || 'Untitled step'}
                      </Text>
                      {(step as any).starts_at ? (
                        <Text style={styles.pickerRowMeta}>
                          {new Date((step as any).starts_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.modalBody}>
              <Text style={styles.pickerSubLabel} numberOfLines={1}>
                Quoting: {selectedStep.title || 'Untitled step'}
              </Text>
              <TextInput
                style={styles.pickerQuoteInput}
                value={quoteText}
                onChangeText={setQuoteText}
                placeholder="Type or edit the line you want to quote…"
                placeholderTextColor={C.label3}
                multiline
                maxLength={600}
                autoFocus
              />
              <View style={styles.pickerActions}>
                <Pressable style={styles.pickerSecondary} onPress={reset}>
                  <Text style={styles.pickerSecondaryText}>Pick another step</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.pickerPrimary,
                    !quoteText.trim() && styles.pickerPrimaryDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={!quoteText.trim()}
                >
                  <Text style={styles.pickerPrimaryText}>Use quote</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  quoteBg: '#F8F8FA',
  quoteBorder: '#D9D9DF',
};

const styles = StyleSheet.create({
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  scopePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scopePillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  scopePillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: '#64748B',
  },
  scopePillTextActive: {
    color: '#0F172A',
  },
  scopeHint: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: '#94A3B8',
    marginBottom: 10,
  },
  scopePillGroup: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(120, 120, 130, 0.08)',
  },
  cohortMates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  cohortMatesStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cohortMateAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cohortMateAvatarOverlap: {
    marginLeft: -8,
  },
  cohortMateInitial: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cohortMatesLabel: {
    fontSize: 11.5,
    color: '#64748B',
    flexShrink: 1,
  },
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
  },
  loading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 24,
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
  // -------- Access card --------
  accessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    padding: 12,
  },
  accessChat: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.gray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessText: {
    flex: 1,
    gap: 2,
  },
  accessTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.label,
  },
  accessSummary: {
    fontSize: 12,
    color: C.label3,
    lineHeight: 16,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.card,
  },
  stackAvatarRemainder: {
    backgroundColor: C.gray6,
  },
  stackAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // -------- Note card --------
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
    gap: 10,
  },
  noteAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  noteHeaderText: {
    flex: 1,
  },
  noteAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: C.label,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: C.blueTint,
  },
  rolePillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.blue,
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: C.blue,
    letterSpacing: 0.4,
  },
  noteWhen: {
    fontSize: 11,
    color: C.label3,
    marginTop: 1,
  },
  quoteBlock: {
    backgroundColor: C.quoteBg,
    borderLeftWidth: 3,
    borderLeftColor: C.quoteBorder,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  quoteIntro: {
    fontSize: 12,
    color: C.label2,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  quoteBody: {
    color: C.label,
    fontStyle: 'italic',
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
  },
  replyAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: C.blueTint,
    borderColor: C.blue,
  },
  reactionGlyph: {
    fontSize: 13,
  },
  reactionCount: {
    fontSize: 11,
    color: C.label2,
    fontWeight: '600',
  },
  reactionCountOn: {
    color: C.blue,
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
  // -------- Reply / quote chips above composer --------
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
  quoteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: C.quoteBg,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: C.quoteBorder,
  },
  quoteChipText: {
    flex: 1,
    fontSize: 12,
    color: C.label2,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  quoteChipLabel: {
    fontStyle: 'italic',
    color: C.label3,
  },
  // -------- Composer --------
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
  quoteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.gray6,
    alignItems: 'center',
    justifyContent: 'center',
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
  // -------- Quote step picker modal --------
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.label,
  },
  modalBody: {
    paddingTop: 8,
    gap: 8,
  },
  modalEmpty: {
    fontSize: 13,
    color: C.label3,
    textAlign: 'center',
    paddingVertical: 24,
  },
  pickerList: {
    gap: 4,
  },
  pickerRow: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  pickerRowTitle: {
    fontSize: 14,
    color: C.label,
    fontWeight: '500',
  },
  pickerRowMeta: {
    fontSize: 11,
    color: C.label3,
    marginTop: 2,
  },
  pickerSubLabel: {
    fontSize: 12,
    color: C.label3,
  },
  pickerQuoteInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 10,
    backgroundColor: C.gray6,
    padding: 10,
    fontSize: 14,
    color: C.label,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  pickerSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickerSecondaryText: {
    fontSize: 13,
    color: C.label2,
    fontWeight: '500',
  },
  pickerPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.blue,
    borderRadius: 10,
  },
  pickerPrimaryDisabled: {
    opacity: 0.4,
  },
  pickerPrimaryText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
