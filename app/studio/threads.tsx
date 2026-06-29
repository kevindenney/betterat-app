/**
 * Creator Studio · Threads (the reply surface)
 *
 * The author's "needs you" inbox: subscriber conversation on the steps of
 * blueprints this author owns. Each row is one blueprint_step thread that has a
 * non-author post; `awaiting` means the most recent post is a subscriber's and
 * the author hasn't replied yet. Tapping a thread opens the full conversation
 * and a reply box (author replies post as coach notes via postBlueprintStepNote).
 *
 *   StudioShell
 *     ├── sidebar (Blueprints / Subscribers / Threads* / …)
 *     └── main
 *           ├── StudioHeader ("Threads", N awaiting)
 *           └── desktop: thread list (340) + conversation (flex)
 *               compact: thread list, tap → conversation replaces it (back)
 *
 * Threads are sourced from useStudioHomeData().threads (studio_author_threads
 * RPC); the conversation is loaded per-thread via getBlueprintStepDiscussion.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { useStudioHomeData, StudioThread } from '@/hooks/useStudioHomeData';
import {
  StudioShell,
  StudioHeader,
  StudioNavSection,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';
import { showConfirm, showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  getBlueprintStepDiscussion,
  postBlueprintStepNote,
  StepDiscussionRow,
} from '@/services/StepDiscussionService';
import { Gradient } from '@/components/studio/Gradient';
import { fontFamily } from '@/lib/design-tokens-editorial';

export default function StudioThreadsPage() {
  const router = useRouter();
  const { user, userProfile, signOut } = useAuth();
  const menu = useProfileMenuData();
  const data = useStudioHomeData();
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!user || menu.loading) {
    return <StudioLoading />;
  }

  const displayName =
    userProfile?.full_name || userProfile?.display_name || user?.email || 'You';
  const initials = getInitials(displayName);
  const activeOrg = menu.activeOrg;
  const isInstitutional = !!activeOrg;

  const navSections: StudioNavSection[] = [
    {
      eyebrow: 'Studio',
      items: [
        {
          key: 'blueprints',
          icon: 'git-branch-outline',
          label: 'Blueprints',
          count: data.blueprintCount || undefined,
          onPress: () => router.push('/studio'),
        },
        {
          key: 'subscribers',
          icon: 'people-outline',
          label: 'Subscribers',
          count: data.kpis.activeSubscribers || undefined,
          onPress: () => router.push('/studio/subscribers'),
        },
        {
          key: 'threads',
          icon: 'chatbubbles-outline',
          label: 'Threads',
          count: data.threadAwaitingCount || undefined,
          countTone: data.threadAwaitingCount > 0 ? 'coral' : 'neutral',
          active: true,
        },
      ],
    },
    {
      eyebrow: 'Money',
      items: [
        {
          key: 'payouts',
          icon: 'cash-outline',
          label: 'Payouts',
          count: isInstitutional ? '—' : undefined,
          onPress: () => router.push('/studio/payouts'),
        },
        {
          key: 'earnings',
          icon: 'receipt-outline',
          label: 'Earnings',
          onPress: () => router.push('/studio/earnings'),
        },
      ],
    },
    {
      eyebrow: 'Co-authors',
      items: [
        { key: 'co-you', icon: 'person-circle-outline', label: 'You' },
        { key: 'co-invite', icon: 'add', label: 'Invite co-author', cta: true },
      ],
    },
  ];

  const awaiting = data.threadAwaitingCount;
  const statLine =
    data.threads.length === 0
      ? 'No subscriber threads yet'
      : `${data.threads.length} thread${data.threads.length === 1 ? '' : 's'} · ` +
        `${awaiting} awaiting you`;
  const subtitleParts: React.ReactNode[] = [
    <Text style={styles.subText} key="stat">
      {statLine}
    </Text>,
  ];

  const selectedThread = data.threads.find((t) => t.id === selectedId) ?? null;

  const list = (
    <ThreadList
      threads={data.threads}
      selectedId={selectedId}
      onSelect={setSelectedId}
      compact={compact}
    />
  );

  const conversation = selectedThread ? (
    <ConversationPane
      thread={selectedThread}
      userId={user.id}
      compact={compact}
      onBack={() => setSelectedId(null)}
    />
  ) : (
    <View style={styles.detailEmpty}>
      <Ionicons name="chatbubbles-outline" size={26} color="rgba(60,60,67,0.3)" />
      <Text style={styles.detailEmptyText}>Select a thread to reply</Text>
    </View>
  );

  // Phone: list, then the selected conversation replaces it (own back control).
  // Desktop: list (340) beside the conversation pane.
  const body = (
    <>
      {compact && selectedThread ? null : (
        <StudioHeader
          compact={compact}
          crumbs={['Creator Studio', 'Threads']}
          title="Threads"
          subtitleParts={subtitleParts}
          pill={
            isInstitutional
              ? { label: `${activeOrg!.org_name.split(' · ')[0]}-managed`, tone: 'purple' }
              : undefined
          }
        />
      )}

      {compact ? (
        selectedThread ? (
          conversation
        ) : (
          <View style={styles.listWrap}>{list}</View>
        )
      ) : (
        <View style={styles.twoPane}>
          <View style={styles.listPane}>{list}</View>
          <View style={styles.detailPane}>{conversation}</View>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.root}>
      <StudioShell
        accent="purple"
        org={{
          name: activeOrg ? activeOrg.org_name : 'Personal',
          role: `Studio · ${displayName.split(' ').slice(0, 2).join(' ')}`,
          mono: activeOrg ? activeOrg.org_short_name : initials,
          monoColor: activeOrg ? 'navy' : 'solo',
        }}
        ctxLens="studio"
        onCtxChange={(lens) => {
          if (lens === 'practice') router.push('/');
        }}
        navSections={navSections}
        compactBottomTabs={[
          {
            key: 'blueprints',
            icon: 'git-branch-outline',
            label: 'Blueprints',
            count: data.blueprintCount || undefined,
            onPress: () => router.push('/studio'),
          },
          {
            key: 'subscribers',
            icon: 'people-outline',
            label: 'Subscribers',
            count: data.kpis.activeSubscribers || undefined,
            onPress: () => router.push('/studio/subscribers'),
          },
          {
            key: 'threads',
            icon: 'chatbubbles-outline',
            label: 'Threads',
            count: data.threadAwaitingCount || undefined,
            active: true,
          },
          {
            key: 'payouts',
            icon: 'cash-outline',
            label: 'Payouts',
            onPress: () => router.push('/studio/payouts'),
          },
        ]}
        user={{ name: displayName, email: user?.email ?? '', initials }}
        onUserCardPress={() =>
          showConfirm('Sign out', `Sign out of ${displayName}?`, () => {
            void signOut();
          })
        }
      >
        {compact ? (
          <ScrollView
            style={styles.compactScroll}
            contentContainerStyle={styles.compactScrollInner}
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </StudioShell>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Thread list
// ---------------------------------------------------------------------------

function ThreadList({
  threads,
  selectedId,
  onSelect,
  compact,
}: {
  threads: StudioThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  compact: boolean;
}) {
  if (threads.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="chatbubbles-outline" size={26} color="rgba(107, 91, 191, 0.6)" />
        </View>
        <Text style={styles.emptyTitle}>No threads yet</Text>
        <Text style={styles.emptyBody}>
          When a subscriber comments on one of your blueprint steps, the
          conversation shows up here for you to reply to.
        </Text>
      </View>
    );
  }
  const rows = threads.map((t) => (
    <ThreadRow
      key={t.id}
      thread={t}
      active={t.id === selectedId}
      onPress={() => onSelect(t.id)}
    />
  ));
  if (compact) return <>{rows}</>;
  return <ScrollView showsVerticalScrollIndicator={false}>{rows}</ScrollView>;
}

function ThreadRow({
  thread,
  active,
  onPress,
}: {
  thread: StudioThread;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.threadRow, active && styles.threadRowActive]}
    >
      <Gradient colors={thread.gradient} style={styles.threadAvi}>
        <Text style={styles.threadAviText}>{thread.fromInitials}</Text>
      </Gradient>
      <View style={styles.threadContent}>
        <View style={styles.threadTopLine}>
          <Text style={styles.threadName} numberOfLines={1}>
            {thread.fromName}
          </Text>
          <Text style={styles.threadAge}>{thread.ageLabel}</Text>
        </View>
        <Text style={styles.threadLabel} numberOfLines={1}>
          {thread.blueprintLabel}
        </Text>
        <Text style={styles.threadPreview} numberOfLines={2}>
          {thread.preview}
        </Text>
      </View>
      {thread.awaiting ? <View style={styles.awaitingDot} /> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Conversation pane
// ---------------------------------------------------------------------------

function ConversationPane({
  thread,
  userId,
  compact,
  onBack,
}: {
  thread: StudioThread;
  userId: string;
  compact: boolean;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { data: notes, isLoading } = useQuery({
    queryKey: ['blueprint-step-discussion', thread.id],
    queryFn: () => getBlueprintStepDiscussion(thread.id, userId),
    staleTime: 15_000,
  });
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);

  const send = useCallback(async () => {
    const trimmed = reply.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await postBlueprintStepNote({
        blueprintStepId: thread.id,
        userId,
        body: trimmed,
        isCoachReply: true,
      });
      setReply('');
      await qc.invalidateQueries({ queryKey: ['blueprint-step-discussion', thread.id] });
      await qc.invalidateQueries({ queryKey: ['studio-author-threads', userId] });
    } catch {
      showAlert('Could not send', 'Your reply did not post. Please try again.');
    } finally {
      setPosting(false);
    }
  }, [reply, posting, thread.id, userId, qc]);

  // Roots come newest-first from the service; show oldest-first for reading.
  const ordered = (notes ?? []).slice().reverse();

  return (
    <View style={styles.convo}>
      <View style={styles.convoHead}>
        {compact ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color="#6F56D9" />
            <Text style={styles.backText}>Threads</Text>
          </Pressable>
        ) : null}
        <Text style={styles.convoTitle} numberOfLines={1}>
          {thread.blueprintLabel}
        </Text>
      </View>

      <ScrollView
        style={styles.convoScroll}
        contentContainerStyle={styles.convoScrollInner}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.convoLoading}>
            <ActivityIndicator color="#6F56D9" />
          </View>
        ) : ordered.length === 0 ? (
          <Text style={styles.convoEmpty}>No messages in this thread.</Text>
        ) : (
          ordered.map((note) => (
            <NoteThread key={note.id} note={note} viewerId={userId} />
          ))
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder="Reply to your subscriber…"
          placeholderTextColor="rgba(60,60,67,0.4)"
          style={styles.composerInput}
          multiline
          editable={!posting}
        />
        <Pressable
          onPress={send}
          disabled={!reply.trim() || posting}
          style={[
            styles.sendBtn,
            (!reply.trim() || posting) && styles.sendBtnDisabled,
          ]}
        >
          {posting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function NoteThread({
  note,
  viewerId,
}: {
  note: StepDiscussionRow;
  viewerId: string;
}) {
  return (
    <View style={styles.noteThread}>
      <NoteBubble note={note} viewerId={viewerId} />
      {(note.replies ?? []).map((r) => (
        <View key={r.id} style={styles.noteReplyWrap}>
          <NoteBubble note={r} viewerId={viewerId} />
        </View>
      ))}
    </View>
  );
}

function NoteBubble({
  note,
  viewerId,
}: {
  note: StepDiscussionRow;
  viewerId: string;
}) {
  const mine = note.user_id === viewerId;
  return (
    <View style={[styles.note, mine && styles.noteMine]}>
      <View style={styles.noteHead}>
        <Text style={[styles.noteAuthor, mine && styles.noteAuthorMine]}>
          {mine ? 'You' : note.author_name ?? 'Subscriber'}
        </Text>
        <Text style={styles.noteAge}>{relativeTime(note.created_at)}</Text>
      </View>
      <Text style={[styles.noteBody, mine && styles.noteBodyMine]}>{note.body}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFEAD8',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },

  subText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.6)' },

  compactScroll: { flex: 1 },
  compactScrollInner: { paddingBottom: 24 },

  listWrap: { flex: 1, marginTop: 10 },

  // Desktop two-pane
  twoPane: { flex: 1, flexDirection: 'row', gap: 16, marginTop: 12 },
  listPane: {
    width: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  detailPane: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  detailEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  detailEmptyText: { fontSize: 13, color: 'rgba(60,60,67,0.5)' },

  // Thread row
  threadRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  threadRowActive: { backgroundColor: 'rgba(107, 91, 191, 0.07)' },
  threadAvi: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAviText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 },
  threadContent: { flex: 1, minWidth: 0 },
  threadTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  threadName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  threadAge: { fontSize: 11, fontFamily: fontFamily.mono, color: 'rgba(60,60,67,0.5)' },
  threadLabel: { fontSize: 11.5, color: 'rgba(60,60,67,0.55)', marginTop: 2 },
  threadPreview: { fontSize: 12.5, color: 'rgba(60,60,67,0.7)', lineHeight: 17, marginTop: 3 },
  awaitingDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF6B6B',
    marginLeft: 4,
  },

  // Conversation
  convo: { flex: 1 },
  convoHead: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    gap: 6,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 14, color: '#6F56D9', fontWeight: '600' },
  convoTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  convoScroll: { flex: 1 },
  convoScrollInner: { padding: 14, gap: 12 },
  convoLoading: { paddingVertical: 32, alignItems: 'center' },
  convoEmpty: { fontSize: 13, color: 'rgba(60,60,67,0.5)', textAlign: 'center', paddingVertical: 24 },

  noteThread: { gap: 8 },
  noteReplyWrap: { paddingLeft: 22 },
  note: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '88%',
    alignSelf: 'flex-start',
  },
  noteMine: {
    backgroundColor: 'rgba(107, 91, 191, 0.12)',
    alignSelf: 'flex-end',
  },
  noteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 3 },
  noteAuthor: { fontSize: 12, fontWeight: '700', color: 'rgba(60,60,67,0.85)' },
  noteAuthorMine: { color: '#6F56D9' },
  noteAge: { fontSize: 10.5, fontFamily: fontFamily.mono, color: 'rgba(60,60,67,0.45)' },
  noteBody: { fontSize: 13.5, color: '#1C1C1E', lineHeight: 19 },
  noteBodyMine: { color: '#1C1C1E' },

  // Composer
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  composerInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.05)',
    fontSize: 14,
    color: '#1C1C1E',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6F56D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(107, 91, 191, 0.4)' },

  // Empty state
  emptyState: { paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(107, 91, 191, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: fontFamily.serif, fontWeight: '500', color: '#1C1C1E', letterSpacing: -0.3 },
  emptyBody: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
});
