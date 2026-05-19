/**
 * /practice/inbox — Practice Inbox screen (D27, canonical §8A).
 *
 * Three sources unified, segmented filter at top: All / From people /
 * From plans / On deck. Each SuggestRow primary-actions to "Add to
 * timeline", secondary to "Save to deck", icon-action to Dismiss.
 *
 * Reads from inbox_items view via useInboxItems(); falls back to an
 * empty list when the user has no pending items (the segmented filter
 * still shows zero counts so the layout doesn't jump).
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import type { InboxFilter } from '@/components/practice/types';
import { useInboxItems } from '@/hooks/useInboxItems';

const VALID_FILTERS: InboxFilter[] = ['all', 'people', 'plans', 'deck'];

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
  const { data: fetched, isLoading } = useInboxItems();
  // Locally-dismissed ids hide rows in the UI without yet writing the
  // status change back. Server-side dismiss lands with the "Step ⋮ →
  // Suggest to…" send-path follow-up so the loop stays consistent.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const items = useMemo(() => {
    const all = fetched ?? [];
    return all.filter((it) => !dismissedIds.has(it.id));
  }, [fetched, dismissedIds]);

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
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

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
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
            </View>
          ) : visible.length === 0 ? (
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
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});
