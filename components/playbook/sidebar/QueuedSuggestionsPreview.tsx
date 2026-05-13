/**
 * QueuedSuggestionsPreview — sidebar card showing the top 3 pending
 * suggestions for the playbook. Real Accept/Edit/Reject actions land in
 * Phase 6 (SuggestionDrawer); this card links into that drawer.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { usePlaybookSuggestions } from '@/hooks/usePlaybook';
import type { PlaybookSuggestionRecord } from '@/types/playbook';

interface QueuedSuggestionsPreviewProps {
  playbookId: string | undefined;
  onOpen: () => void;
}

function kindLabel(kind: PlaybookSuggestionRecord['kind']): string {
  switch (kind) {
    case 'concept_update':
      return 'Concept update';
    case 'concept_create':
      return 'New concept';
    case 'pattern_detected':
      return 'Pattern';
    case 'weekly_review':
      return 'Weekly review';
    case 'focus_suggestion':
      return 'Focus';
    case 'cross_interest_idea':
      return 'Cross-interest idea';
  }
}

function previewText(s: PlaybookSuggestionRecord): string {
  const p = (s.payload as Record<string, unknown>) ?? {};
  return (
    (p.title as string) ||
    (p.summary as string) ||
    (p.question as string) ||
    'Tap to review'
  );
}

export function QueuedSuggestionsPreview({
  playbookId,
  onOpen,
}: QueuedSuggestionsPreviewProps) {
  const { data: suggestions = [] } = usePlaybookSuggestions(playbookId);
  const top = suggestions.slice(0, 3);

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={16} color={IOS_COLORS.systemPurple} />
        <Text style={styles.title}>Suggestions</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{suggestions.length}</Text>
        </View>
      </View>
      {top.length === 0 ? (
        <Text style={styles.empty}>
          No pending suggestions. They'll appear here as you train and debrief.
        </Text>
      ) : (
        <View style={styles.list}>
          {top.map((s) => (
            <View key={s.id} style={styles.item}>
              <Text style={styles.itemKind}>{kindLabel(s.kind)}</Text>
              <Text style={styles.itemText} numberOfLines={2}>
                {previewText(s)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  cardPressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  countPill: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(175, 82, 222, 0.12)',
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.systemPurple,
  },
  empty: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  list: {
    gap: IOS_SPACING.sm,
  },
  item: {
    padding: IOS_SPACING.md,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    gap: 2,
  },
  itemKind: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: IOS_COLORS.systemPurple,
  },
  itemText: {
    fontSize: 13,
    color: IOS_COLORS.label,
  },
});
