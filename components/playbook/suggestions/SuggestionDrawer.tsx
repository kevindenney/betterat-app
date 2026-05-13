/**
 * SuggestionDrawer — right-anchored modal listing all pending suggestions
 * for a playbook, grouped by kind. Each suggestion renders a SuggestionCard
 * with Accept / Edit / Reject.
 *
 * Uses a plain React Native Modal rather than the Gluestack drawer — keeps
 * the component footprint small and matches ConceptEditor's sheet pattern.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { usePlaybookSuggestions } from '@/hooks/usePlaybook';
import type { PlaybookSuggestionRecord, SuggestionKind } from '@/types/playbook';
import { SuggestionCard } from './SuggestionCard';

interface SuggestionDrawerProps {
  visible: boolean;
  onClose: () => void;
  playbookId: string | undefined;
}

const KIND_ORDER: SuggestionKind[] = [
  'concept_update',
  'concept_create',
  'pattern_detected',
  'weekly_review',
  'focus_suggestion',
  'cross_interest_idea',
];

const KIND_HEADINGS: Record<SuggestionKind, string> = {
  concept_update: 'Concept updates',
  concept_create: 'New concepts',
  pattern_detected: 'Patterns detected',
  weekly_review: 'Weekly reviews',
  focus_suggestion: 'Focus suggestions',
  cross_interest_idea: 'Cross-interest ideas',
};

export function SuggestionDrawer({
  visible,
  onClose,
  playbookId,
}: SuggestionDrawerProps) {
  const { width } = useWindowDimensions();
  const { data: suggestions = [] } = usePlaybookSuggestions(playbookId);

  const grouped = useMemo(() => {
    const buckets = new Map<SuggestionKind, PlaybookSuggestionRecord[]>();
    for (const s of suggestions) {
      const list = buckets.get(s.kind) ?? [];
      list.push(s);
      buckets.set(s.kind, list);
    }
    return buckets;
  }, [suggestions]);

  const sheetWidth = Math.min(width, 560);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <View style={[styles.sheet, { width: sheetWidth }]}>
          <View style={styles.header}>
            <View style={styles.headerIconBubble}>
              <Ionicons name="sparkles" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Suggestion queue</Text>
              <Text style={styles.headerSubtitle}>
                {suggestions.length} pending · every AI write lands here first
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={IOS_COLORS.label} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            {suggestions.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons
                  name="sparkles-outline"
                  size={32}
                  color={IOS_COLORS.tertiaryLabel}
                />
                <Text style={styles.emptyTitle}>No pending suggestions</Text>
                <Text style={styles.emptyBody}>
                  Edits, new concepts, patterns, and weekly reviews queue here
                  as you train and debrief.
                </Text>
              </View>
            ) : (
              KIND_ORDER.filter((k) => (grouped.get(k)?.length ?? 0) > 0).map(
                (kind) => {
                  const items = grouped.get(kind) ?? [];
                  return (
                    <View key={kind} style={styles.section}>
                      <Text style={styles.sectionHeading}>
                        {KIND_HEADINGS[kind]} · {items.length}
                      </Text>
                      <View style={styles.sectionList}>
                        {items.map((s) => (
                          <SuggestionCard key={s.id} suggestion={s} />
                        ))}
                      </View>
                    </View>
                  );
                },
              )
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
    flex: 1,
    maxWidth: 560,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.xl,
    paddingTop: IOS_SPACING.xl + 8,
    paddingBottom: IOS_SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  headerIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  headerSubtitle: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: IOS_SPACING.xl,
    gap: IOS_SPACING.xl,
  },
  section: {
    gap: IOS_SPACING.md,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: IOS_COLORS.secondaryLabel,
  },
  sectionList: {
    gap: IOS_SPACING.md,
  },
  empty: {
    alignItems: 'center',
    gap: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.xl * 2,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  emptyBody: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: IOS_SPACING.xl,
  },
});
