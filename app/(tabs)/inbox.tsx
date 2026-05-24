/**
 * /(tabs)/inbox — v3 Inbox tab (Screen 04 from the v3 screen designs).
 *
 * "Act / Read / Done. The Act headline is *suggestions waiting*; the Read
 * headline is *peer reflections*. Source is metadata."
 *
 * Verb-first triage with practice-grouping as the secondary cut. Suggestions
 * get a coral border-left (Discover-accent grammar); reflections get a lilac
 * border-left (AI/synthesis grammar). One-tap accept on every suggestion.
 *
 * v1 wiring reads from the existing inbox_items view via useInboxItems and
 * routes accept/decline through useInboxActions. Read and Done are skeletal
 * — peer_reflections schema lands in a follow-up.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInboxItems } from '@/hooks/useInboxItems';
import { useInboxActions } from '@/hooks/useInboxActions';
import type { InboxItem } from '@/components/practice/types';

type Segment = 'act' | 'read' | 'done';

const CORAL = IOS_REGISTER.accentMarkedContent; // suggestion border-left
const LILAC = '#AF52DE'; // reflection / AI border-left

export default function InboxTabScreen() {
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('act');
  const { data: fetched, isLoading } = useInboxItems();
  const inboxActions = useInboxActions();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const items = useMemo(
    () => (fetched ?? []).filter((it) => !dismissedIds.has(it.id)),
    [fetched, dismissedIds],
  );

  // v1: every live inbox_items row is "Act". Read/Done are stubs until
  // peer_reflections + a per-user inbox state column ship.
  const actCount = items.length;
  const readCount = 0;

  // Practice grouping — design key is "the practice each item is about."
  // The closest analog in the current data model is the source step the
  // suggestion attaches to. Fold same-source items together.
  const groups = useMemo(() => {
    const byKey = new Map<string, { title: string; items: InboxItem[] }>();
    items.forEach((it) => {
      const key = it.raw.sourceStepId || it.title;
      const existing = byKey.get(key);
      if (existing) {
        existing.items.push(it);
      } else {
        byKey.set(key, { title: it.title, items: [it] });
      }
    });
    return Array.from(byKey.values());
  }, [items]);

  const optimisticHide = (id: string) =>
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const handleAccept = (it: InboxItem) => {
    optimisticHide(it.id);
    inboxActions.accept(it).catch(() => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(it.id);
        return next;
      });
    });
  };
  const handleDecline = (it: InboxItem) => {
    optimisticHide(it.id);
    inboxActions.dismiss(it).catch(() => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(it.id);
        return next;
      });
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Inbox</Text>
          <View style={styles.segRow}>
            <SegmentPill
              label="Act"
              count={actCount}
              active={segment === 'act'}
              onPress={() => setSegment('act')}
            />
            <SegmentPill
              label="Read"
              count={readCount}
              active={segment === 'read'}
              onPress={() => setSegment('read')}
            />
            <SegmentPill
              label="Done"
              active={segment === 'done'}
              onPress={() => setSegment('done')}
            />
          </View>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={{
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + 32,
          }}
        >
          {segment === 'act' && (
            <ActPanel
              isLoading={isLoading}
              count={actCount}
              groups={groups}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          )}
          {segment === 'read' && <ReadPanel />}
          {segment === 'done' && <DonePanel />}
        </ScrollView>
      </View>
    </>
  );
}

function SegmentPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.seg, active && styles.segActive]}
    >
      <Text style={[styles.segLabel, active && styles.segLabelActive]}>
        {label}
        {count != null && count > 0 ? (
          <Text style={[styles.segCount, active && styles.segCountActive]}>
            {'  '}
            {count}
          </Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

function ActPanel({
  isLoading,
  count,
  groups,
  onAccept,
  onDecline,
}: {
  isLoading: boolean;
  count: number;
  groups: { title: string; items: InboxItem[] }[];
  onAccept: (it: InboxItem) => void;
  onDecline: (it: InboxItem) => void;
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
      </View>
    );
  }
  if (count === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Nothing waiting.</Text>
        <Text style={styles.emptyBody}>
          Suggestions from peers and AI surfacings land here.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>SUGGESTIONS WAITING</Text>
        <View style={styles.eyebrowPip}>
          <Text style={styles.eyebrowPipText}>{count}</Text>
        </View>
      </View>
      {groups.map((g, idx) => (
        <View key={idx} style={styles.group}>
          <Text style={styles.groupHeader}>
            re: <Text style={styles.groupHeaderTitle}>{g.title}</Text>
            {g.items.length > 1 ? ` · ${g.items.length} suggestions` : ''}
          </Text>
          {g.items.map((it) => (
            <SuggestionCard
              key={it.id}
              item={it}
              onAccept={() => onAccept(it)}
              onDecline={() => onDecline(it)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function SuggestionCard({
  item,
  onAccept,
  onDecline,
}: {
  item: InboxItem;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: item.fromTint || IOS_COLORS.systemGray3 }]}>
          <Text style={styles.avatarText}>{item.fromInitials || '·'}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardFrom}>
            <Text style={styles.cardFromName}>
              {item.fromContext.split('·')[0]?.trim() || 'A teammate'}
            </Text>
            <Text style={styles.cardFromVerb}>
              {' '}
              {item.kind === 'on_deck' ? 'saved a step' : 'suggested a step'}
            </Text>
          </Text>
        </View>
        <Text style={styles.cardWhen}>{item.when}</Text>
      </View>

      <Text style={styles.cardTitle}>{item.title}</Text>
      {item.blurb ? <Text style={styles.cardBody}>{item.blurb}</Text> : null}
      <Text style={styles.cardAttach}>
        would attach to <Text style={styles.cardAttachTitle}>{item.title}</Text>
      </Text>

      <View style={styles.cardActions}>
        <Pressable onPress={onAccept} style={styles.actionPrimary}>
          <Text style={styles.actionPrimaryText}>Accept</Text>
        </Pressable>
        <Pressable onPress={onDecline} style={styles.actionSecondary}>
          <Text style={styles.actionSecondaryText}>Decline</Text>
        </Pressable>
        <Pressable style={styles.actionSecondary}>
          <Text style={styles.actionSecondaryText}>Reply</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReadPanel() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>No peer reflections yet.</Text>
      <Text style={styles.emptyBody}>
        Reflections from the people you share an interest with will land here.
      </Text>
    </View>
  );
}

function DonePanel() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>Nothing here.</Text>
      <Text style={styles.emptyBody}>Accepted and dismissed items archive here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  header: {
    backgroundColor: IOS_REGISTER.cardBg,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.5,
  },
  segRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  seg: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  segActive: {
    backgroundColor: IOS_REGISTER.label,
  },
  segLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  segLabelActive: {
    color: '#FFFFFF',
  },
  segCount: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
  },
  segCountActive: {
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 18,
    paddingBottom: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
  },
  eyebrowPip: {
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: CORAL,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowPipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  group: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 6,
  },
  groupHeader: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  groupHeaderTitle: {
    fontStyle: 'italic',
    color: IOS_REGISTER.label,
  },
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: CORAL,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardFrom: {
    fontSize: 14,
    color: IOS_REGISTER.label,
  },
  cardFromName: {
    fontWeight: '600',
  },
  cardFromVerb: {
    color: IOS_REGISTER.labelSecondary,
  },
  cardWhen: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginTop: 8,
    letterSpacing: -0.2,
  },
  cardBody: {
    fontSize: 14,
    color: IOS_REGISTER.label,
    marginTop: 4,
    lineHeight: 19,
  },
  cardAttach: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 8,
  },
  cardAttachTitle: {
    fontStyle: 'italic',
    color: IOS_REGISTER.label,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionPrimary: {
    backgroundColor: IOS_REGISTER.label,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionSecondary: {
    backgroundColor: IOS_REGISTER.fillPill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  actionSecondaryText: {
    color: IOS_REGISTER.label,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingTop: 64,
    paddingHorizontal: IOS_SPACING.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 13.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
});
// Mark LILAC as future-use; consumed by ReadPanel cards when peer_reflections lands.
void LILAC;
