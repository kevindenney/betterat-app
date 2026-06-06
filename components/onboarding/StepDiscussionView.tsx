/**
 * Surface C · Step Discussion — 4th tab next to Plan/Do/Reflect.
 *
 * Hero: step title + meta + "here-now" coral banner with avatar stack.
 * Tabs: Plan / Do / Reflect / Discussion (active).
 * Note feed: italic-serif body + evidence chips + threaded coach reply +
 * reaction row (fire / insight / question with on-states).
 * Composer pinned at bottom: avatar + input + mic + photo icons.
 */

import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fontFamily } from '@/lib/design-tokens-editorial';
import {
  ChevronLeft,
  CornerUpLeft,
  Flame,
  Gauge,
  Image as ImageIcon,
  Lightbulb,
  Mic,
  MessageCircle,
} from 'lucide-react-native';

export type StepDiscussionReaction = 'fire' | 'insight' | 'question';

export interface StepDiscussionEvidenceChip {
  kind: 'voice' | 'photo' | 'data';
  label: string;
}

export interface StepDiscussionNote {
  id: string;
  authorInitials: string;
  authorName: string;
  authorColorKey?: 'navy' | 'green' | 'purple' | 'brown' | 'gold';
  when: string;
  subContext?: string;
  body: string;
  evidence?: StepDiscussionEvidenceChip[];
  coachReply?: {
    authorInitials: string;
    authorName: string;
    body: string;
  };
  reactions: Record<StepDiscussionReaction, number>;
  viewerReactions: StepDiscussionReaction[];
}

export interface StepDiscussionViewProps {
  /** "Step 4" — top bar title. */
  topTitle?: string;
  /** "Plan" — back-button copy. */
  backLabel?: string;
  /** "Step 4 · Discussion" pre-title. */
  preTitle: string;
  /** "Boat-speed baseline · all points of sail" */
  stepTitle: string;
  /** "From Kevin's Prepare for the Worlds · 8 sailors on this step" */
  metaLine?: string;
  /** Avatars + "X sailors are working through Step Y right now" banner. */
  hereNow?: {
    avatars: { initials: string; colorKey?: StepDiscussionNote['authorColorKey'] }[];
    text: string;
  };
  /** "14" — count next to the Discussion tab. */
  discussionCount?: number;
  notes: StepDiscussionNote[];
  /** Composer placeholder. */
  composerPlaceholder?: string;
  /** Viewer avatar initials. */
  viewerInitials?: string;
  onBack?: () => void;
  /** When the viewer toggles a reaction. */
  onReact?: (noteId: string, kind: StepDiscussionReaction) => void;
  /** When the viewer submits the composer. */
  onSubmit?: (body: string) => void | Promise<void>;
}

const C = {
  page: '#F2F2F7',
  card: '#FFFFFF',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  label4: '#C7C7CC',
  line: '#E5E5EA',
  gray6: '#F2F2F7',
  blue: '#007AFF',
  blueDeep: '#0040DD',
  coral: '#FF6F61',
  coralDeep: '#A6362C',
  coralSoft: '#F7C9C3',
  coralTint: '#FDECEA',
  coach: '#C28A2A',
  serif: fontFamily.serif,
};

const AVATAR_BG: Record<NonNullable<StepDiscussionNote['authorColorKey']>, string> = {
  navy: '#4E6A85',
  green: '#3E6C4E',
  purple: '#5C3F7A',
  brown: '#4A3F2E',
  gold: '#8E6320',
};

export function StepDiscussionView({
  topTitle = 'Step',
  backLabel = 'Plan',
  preTitle,
  stepTitle,
  metaLine,
  hereNow,
  discussionCount,
  notes,
  composerPlaceholder = 'Share your reflection…',
  viewerInitials = 'KD',
  onBack,
  onReact,
  onSubmit,
}: StepDiscussionViewProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const body = draft.trim();
    if (!body || !onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(body);
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  }, [draft, onSubmit]);

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.back} onPress={onBack} hitSlop={8} disabled={!onBack}>
          <ChevronLeft size={18} color={C.blue} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
        <Text style={styles.topTtl}>{topTitle}</Text>
        <View style={styles.topRight} />
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.pre}>{preTitle}</Text>
        <Text style={styles.title}>{stepTitle}</Text>
        {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}

        {hereNow ? (
          <View style={styles.hereNow}>
            <View style={styles.avStack}>
              {hereNow.avatars.slice(0, 4).map((a, idx) => (
                <View
                  key={`${a.initials}-${idx}`}
                  style={[
                    styles.avStackItem,
                    { backgroundColor: AVATAR_BG[a.colorKey ?? 'navy'], marginLeft: idx === 0 ? 0 : -7 },
                  ]}
                >
                  <Text style={styles.avStackText}>{a.initials}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.hereNowText}>{hereNow.text}</Text>
          </View>
        ) : null}
      </View>

      {/* Phase tabs */}
      <View style={styles.tabs}>
        <PhaseTab label="Plan" />
        <PhaseTab label="Do" />
        <PhaseTab label="Reflect" />
        <PhaseTab label="Discussion" on count={discussionCount} />
      </View>

      {/* Feed */}
      <ScrollView style={styles.feedScroll} contentContainerStyle={styles.feed}>
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onReact={(kind) => onReact?.(note.id, kind)}
          />
        ))}
      </ScrollView>

      {/* Composer */}
      <View style={styles.composer}>
        <View style={[styles.avSm, { backgroundColor: AVATAR_BG.navy }]}>
          <Text style={styles.avSmText}>{viewerInitials}</Text>
        </View>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={composerPlaceholder}
          placeholderTextColor={C.label3}
          editable={!submitting}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
        />
        <Pressable hitSlop={6} style={styles.icBtn}>
          <Mic size={18} color={C.blue} />
        </Pressable>
        <Pressable hitSlop={6} style={styles.icBtn}>
          <ImageIcon size={18} color={C.blue} />
        </Pressable>
      </View>
    </View>
  );
}

function PhaseTab({
  label,
  on,
  count,
}: {
  label: string;
  on?: boolean;
  count?: number;
}) {
  return (
    <View style={[styles.tab, on && styles.tabOn]}>
      <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
      {typeof count === 'number' ? (
        <Text style={[styles.tabCount, on && styles.tabCountOn]}>{count}</Text>
      ) : null}
    </View>
  );
}

function NoteCard({
  note,
  onReact,
}: {
  note: StepDiscussionNote;
  onReact?: (kind: StepDiscussionReaction) => void;
}) {
  const isViewerReacted = (kind: StepDiscussionReaction) =>
    note.viewerReactions.includes(kind);

  return (
    <View style={styles.noteCard}>
      <View style={styles.headRow}>
        <View style={[styles.avSm, { backgroundColor: AVATAR_BG[note.authorColorKey ?? 'navy'] }]}>
          <Text style={styles.avSmText}>{note.authorInitials}</Text>
        </View>
        <Text style={styles.who}>{note.authorName}</Text>
        <Text style={styles.when}>{note.when}</Text>
      </View>
      {note.subContext ? <Text style={styles.subWho}>{note.subContext}</Text> : null}

      <Text style={styles.body}>{note.body}</Text>

      {note.evidence && note.evidence.length > 0 ? (
        <View style={styles.evidenceRow}>
          {note.evidence.map((chip, idx) => (
            <View key={idx} style={styles.evChip}>
              {chip.kind === 'voice' ? (
                <Mic size={11} color={C.label3} />
              ) : chip.kind === 'photo' ? (
                <ImageIcon size={11} color={C.label3} />
              ) : (
                <Gauge size={11} color={C.label3} />
              )}
              <Text style={styles.evChipText}>{chip.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {note.coachReply ? (
        <View style={styles.threadedReply}>
          <View style={[styles.avXs, styles.avXsCoach]}>
            <Text style={styles.avXsText}>{note.coachReply.authorInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.whoR}>
              {note.coachReply.authorName}
              <Text style={styles.coachPip}> COACH</Text>
            </Text>
            <Text style={styles.bodyR}>{note.coachReply.body}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.reactionRow}>
        <ReactionChip
          icon={<Flame size={11} color={isViewerReacted('fire') ? C.coral : C.label2} fill={isViewerReacted('fire') ? C.coral : 'transparent'} />}
          count={note.reactions.fire}
          on={isViewerReacted('fire')}
          onPress={() => onReact?.('fire')}
        />
        <ReactionChip
          icon={<Lightbulb size={11} color={isViewerReacted('insight') ? C.coral : C.label2} fill={isViewerReacted('insight') ? C.coral : 'transparent'} />}
          count={note.reactions.insight}
          on={isViewerReacted('insight')}
          onPress={() => onReact?.('insight')}
        />
        <ReactionChip
          icon={<MessageCircle size={11} color={isViewerReacted('question') ? C.coral : C.label2} fill={isViewerReacted('question') ? C.coral : 'transparent'} />}
          count={note.reactions.question}
          on={isViewerReacted('question')}
          onPress={() => onReact?.('question')}
        />
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={6} style={styles.reply}>
          <CornerUpLeft size={12} color={C.blue} />
          <Text style={styles.replyText}>Reply</Text>
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
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[styles.react, on && styles.reactOn]}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
    >
      {icon}
      <Text style={[styles.reactText, on && styles.reactTextOn]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.page,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    width: 100,
  },
  backText: {
    color: C.blue,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  topTtl: {
    fontSize: 16,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.25,
  },
  topRight: {
    width: 100,
  },
  hero: {
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  pre: {
    fontSize: 9.5,
    fontWeight: '700',
    color: C.blue,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.3,
    lineHeight: 21,
    marginBottom: 6,
  },
  meta: {
    fontSize: 11,
    color: C.label3,
    letterSpacing: -0.05,
  },
  hereNow: {
    marginTop: 10,
    backgroundColor: C.coralTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.coralSoft,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avStack: {
    flexDirection: 'row',
  },
  avStackItem: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avStackText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '700',
  },
  hereNowText: {
    flex: 1,
    fontSize: 11,
    color: C.coralDeep,
    lineHeight: 15,
    letterSpacing: -0.05,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 14,
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  tab: {
    paddingHorizontal: 9,
    paddingVertical: 9,
    paddingBottom: 11,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabOn: {
    borderBottomWidth: 2,
    borderBottomColor: C.coral,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: C.label3,
  },
  tabTextOn: {
    color: C.coralDeep,
    fontWeight: '600',
  },
  tabCount: {
    fontSize: 10.5,
    color: C.label3,
  },
  tabCountOn: {
    color: C.coral,
  },
  feedScroll: {
    flex: 1,
  },
  feed: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 110, // composer 56 + safe area
    gap: 8,
  },
  noteCard: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    padding: 12,
    paddingBottom: 11,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  avSm: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avSmText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  who: {
    fontSize: 12,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.1,
  },
  when: {
    fontSize: 10,
    color: C.label3,
    letterSpacing: -0.05,
    marginLeft: 'auto',
  },
  subWho: {
    fontSize: 10,
    color: C.label3,
    letterSpacing: -0.05,
    marginLeft: 34,
    marginBottom: 6,
  },
  body: {
    fontFamily: C.serif,
    fontStyle: 'italic',
    fontSize: 12.5,
    lineHeight: 18,
    color: C.label2,
    letterSpacing: -0.02,
    marginBottom: 8,
  },
  evidenceRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  evChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.gray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  evChipText: {
    fontSize: 10,
    color: C.label2,
    letterSpacing: -0.05,
  },
  threadedReply: {
    marginBottom: 8,
    backgroundColor: C.gray6,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  avXs: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E6A85',
  },
  avXsCoach: {
    backgroundColor: C.coach,
  },
  avXsText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  whoR: {
    fontSize: 11,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.1,
  },
  coachPip: {
    backgroundColor: C.coach,
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    paddingHorizontal: 5,
    borderRadius: 4,
    marginLeft: 5,
  },
  bodyR: {
    fontSize: 11,
    color: C.label2,
    letterSpacing: -0.05,
    lineHeight: 15,
    marginTop: 2,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  react: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.gray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  reactOn: {
    backgroundColor: C.coralTint,
    borderColor: C.coralSoft,
  },
  reactText: {
    fontSize: 10.5,
    color: C.label2,
    letterSpacing: -0.05,
  },
  reactTextOn: {
    color: C.coralDeep,
  },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  replyText: {
    color: C.blue,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.05,
  },
  composer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: Platform.select({ ios: 24, default: 9 }) as number,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: C.gray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 7, default: 5 }) as number,
    fontSize: 12.5,
    color: C.label,
    letterSpacing: -0.05,
  },
  icBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
