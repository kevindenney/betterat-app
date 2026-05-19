/**
 * /practice/inbox — Practice Inbox screen (D27, canonical §8A).
 *
 * Three sources unified, segmented filter at top: All / From people /
 * From plans / On deck. Each SuggestRow primary-actions to "Add to
 * timeline", secondary to "Save to deck", icon-action to Dismiss.
 *
 * Wave 3: UI complete; real read from `inbox_items` view lands as a
 * follow-up.
 */

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { SuggestRow } from '@/components/practice/SuggestRow';
import type { InboxFilter, InboxItem } from '@/components/practice/types';

const VALID_FILTERS: InboxFilter[] = ['all', 'people', 'plans', 'deck'];

const DEMO_ITEMS: InboxItem[] = [
  {
    id: 'i1',
    kind: 'suggestion',
    chipLabel: 'Suggested',
    fromInitials: 'SC',
    fromTint: '#FF9500',
    fromContext: 'Sam Cooke · mentor',
    when: '2 days ago',
    title: 'Try the pre-start lane drill before next Saturday',
    blurb:
      'You\'re hesitating at the pin in shifty light. Same drill Phyl logged last month — 25 min, 6 boats. Run it once and we\'ll talk.',
    fromLine: "Suggested step from Sam Cooke's Heavy-air path · Step 7 of 9",
  },
  {
    id: 'i2',
    kind: 'suggestion',
    chipLabel: 'Suggested',
    fromInitials: 'EG',
    fromTint: '#AF52DE',
    fromContext: 'Emma Greene · follow',
    when: 'yesterday',
    title: '"Mark roundings under pressure" — try her version',
    blurb:
      'My take is different from Kevin\'s — I lean harder on the inside-overlap rule. Worth comparing if Race 5 has a crowded weather mark.',
    fromLine: "Forked from Emma's Step 6 · would land as Solo step",
  },
  {
    id: 'i3',
    kind: 'plan_push',
    chipLabel: 'New plan step',
    fromContext: 'Kevin Ho · HKDW prep',
    when: 'this morning',
    title: 'Step 5 unlocked · Heavy-air upwind technique — 18+ kn',
    blurb:
      'Now that you\'ve settled lane choice, here\'s the next layer. Builds on what we did Saturday. Aim for Week 7.',
    fromLine: 'From Worlds 2027 prep plan · Step 5 of 12 · would queue Next up',
  },
  {
    id: 'i4',
    kind: 'on_deck',
    chipLabel: 'On deck',
    fromContext: "Saved by you · from Phyl's Step 4",
    when: 'last week',
    title: '"Pick the favored end. Bail without losing a length."',
    fromLine: "Forked from Phyl Loong's Step 4 · Worlds 2027",
  },
];

const FILTER_LABELS: Record<InboxFilter, string> = {
  all: 'All',
  people: 'From people',
  plans: 'From plans',
  deck: 'On deck',
};

export default function PracticeInboxScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string }>();
  const initialFilter: InboxFilter =
    params.filter && (VALID_FILTERS as string[]).includes(params.filter)
      ? (params.filter as InboxFilter)
      : 'all';
  const [filter, setFilter] = useState<InboxFilter>(initialFilter);
  const [items, setItems] = useState(DEMO_ITEMS);

  const counts = useMemo(
    () => ({
      all: items.length,
      people: items.filter((i) => i.kind === 'suggestion').length,
      plans: items.filter((i) => i.kind === 'plan_push').length,
      deck: items.filter((i) => i.kind === 'on_deck').length,
    }),
    [items]
  );

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'people') return items.filter((i) => i.kind === 'suggestion');
    if (filter === 'plans') return items.filter((i) => i.kind === 'plan_push');
    return items.filter((i) => i.kind === 'on_deck');
  }, [items, filter]);

  const dismiss = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const subtitle =
    `${counts.people} from people you follow · ${counts.plans} from your plans · ${counts.deck} saved by you`;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.hero}>
          <View style={styles.topbar}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/practice'))}
              hitSlop={8}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={20} color="#007AFF" />
              <Text style={styles.backText}>Practice</Text>
            </Pressable>
            <Text style={styles.topTitle}>Inbox</Text>
            <TouchableOpacity hitSlop={8} activeOpacity={0.6}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>
            "{counts.all} steps waiting for your call."
          </Text>
          <Text style={styles.heroSub}>{subtitle}</Text>

          <View style={styles.segRow}>
            {VALID_FILTERS.map((f) => {
              const isActive = f === filter;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  activeOpacity={0.7}
                  style={[styles.seg, isActive ? styles.segActive : null]}
                >
                  <Text
                    style={[
                      styles.segLabel,
                      isActive ? styles.segLabelActive : null,
                    ]}
                  >
                    {FILTER_LABELS[f]}
                    <Text style={styles.segCount}>  {counts[f]}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ScrollView style={styles.body}>
          {visible.length === 0 ? (
            <Text style={styles.empty}>Nothing waiting in this filter.</Text>
          ) : (
            visible.map((it) => (
              <SuggestRow
                key={it.id}
                item={it}
                onAdd={() => dismiss(it.id)}
                onSaveToDeck={() => dismiss(it.id)}
                onDismiss={() => dismiss(it.id)}
              />
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  hero: {
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 6,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
    marginTop: 6,
    lineHeight: 27,
  },
  heroSub: {
    fontSize: 12.5,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },
  segRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    marginBottom: 6,
  },
  seg: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.15)',
  },
  segActive: {
    backgroundColor: IOS_COLORS.label,
    borderColor: IOS_COLORS.label,
  },
  segLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  segLabelActive: {
    color: '#FFFFFF',
  },
  segCount: {
    fontSize: 11,
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    color: IOS_COLORS.tertiaryLabel,
    fontSize: 13,
    padding: 32,
  },
});
