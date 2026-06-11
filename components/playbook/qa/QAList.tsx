/**
 * QAList — list of saved Q&A entries with pin/delete + sources panel.
 * "Ask a question" button scrolls-to-top / links back to PlaybookHome's
 * AskYourPlaybook card.
 */

import React from 'react';
import { View, Text, Pressable, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import {
  usePlaybook,
  usePlaybookQA,
  useSetQAPinned,
  useDeleteQA,
} from '@/hooks/usePlaybook';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import type { PlaybookQARecord } from '@/types/playbook';

export function QAList() {
  const { currentInterest } = useInterest();
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const { data: entries = [], isLoading } = usePlaybookQA(playbook?.id);
  const pinMutation = useSetQAPinned();
  const deleteMutation = useDeleteQA();

  const handlePin = (q: PlaybookQARecord) => {
    if (!playbook) return;
    pinMutation.mutate({ qaId: q.id, pinned: !q.pinned, playbookId: playbook.id });
  };

  const handleDelete = (q: PlaybookQARecord) => {
    if (!playbook) return;
    showConfirm(
      'Delete question?',
      'This removes the saved answer from your Playbook.',
      () =>
        deleteMutation.mutate({ qaId: q.id, playbookId: playbook.id }),
      { destructive: true },
    );
  };

  const handleAsk = () => {
    router.push('/library' as any);
  };

  // Sort: pinned first, newest first within each group.
  const sorted = [...entries].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Q&A</Text>
        <TouchableOpacity
          onPress={handleAsk}
          style={styles.askButton}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-outline" size={14} color="#fff" />
          <Text style={styles.askText}>Ask a question</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Text style={styles.loading}>Loading…</Text>
      ) : sorted.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="help-circle-outline" size={36} color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.emptyTitle}>No saved questions yet</Text>
          <Text style={styles.emptyText}>
            Ask your Playbook anything — it reads your concepts, resources, and
            recent debriefs, then answers with citations. Pin answers you want
            to keep.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {sorted.map((q) => {
            const sourceCount = Array.isArray(q.sources) ? q.sources.length : 0;
            return (
              <View key={q.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.question} numberOfLines={3}>
                    {q.question}
                  </Text>
                  <Pressable onPress={() => handlePin(q)} hitSlop={12}>
                    <Ionicons
                      name={q.pinned ? 'pin' : 'pin-outline'}
                      size={18}
                      color={q.pinned ? IOS_COLORS.systemBlue : IOS_COLORS.secondaryLabel}
                    />
                  </Pressable>
                </View>
                <Text style={styles.answer}>{q.answer_md}</Text>
                <View style={styles.footerRow}>
                  <Text style={styles.meta}>
                    {sourceCount} source{sourceCount === 1 ? '' : 's'} ·{' '}
                    {new Date(q.created_at).toLocaleDateString()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDelete(q)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  content: {
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemPurple,
  },
  askText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  loading: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  list: {
    gap: IOS_SPACING.md,
  },
  card: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: IOS_SPACING.md,
  },
  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  answer: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemRed,
  },
  empty: {
    alignItems: 'center',
    padding: IOS_SPACING.xl,
    gap: IOS_SPACING.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  emptyText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 18,
  },
});
