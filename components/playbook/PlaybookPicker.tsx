/**
 * PlaybookPicker — tabbed modal for linking Playbook items to a timeline step.
 *
 * Replaces the old library-only ResourcePicker. Tabs:
 *   - Resources   → playbook_resources
 *   - Concepts    → playbook_concepts (owned + inherited baselines)
 *   - Q&A         → playbook_qa (pinned/saved answers)
 *   - Debriefs    → recent timeline_steps with a debrief (past_learning)
 *
 * Selections are returned as `{ item_type, item_id, label }` tuples so the
 * PlanTab can write them to `step_playbook_links`. Multi-select across tabs.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import {
  usePlaybook,
  usePlaybookResources,
  usePlaybookConcepts,
  usePlaybookQA,
  usePlaybookRecentDebriefs,
} from '@/hooks/usePlaybook';
import type { StepPlaybookLinkType } from '@/types/playbook';

export interface PlaybookPickerSelection {
  item_type: StepPlaybookLinkType;
  item_id: string;
  label: string;
}

interface PlaybookPickerProps {
  visible: boolean;
  interestId: string | undefined;
  excludeKeys?: string[]; // "{type}:{id}" strings already linked
  onSelect: (selections: PlaybookPickerSelection[]) => void;
  onClose: () => void;
}

type Tab = 'resource' | 'concept' | 'qa' | 'past_learning';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'resource', label: 'Resources', icon: 'library-outline' },
  { key: 'concept', label: 'Concepts', icon: 'book-outline' },
  { key: 'qa', label: 'Q&A', icon: 'help-circle-outline' },
  { key: 'past_learning', label: 'Debriefs', icon: 'time-outline' },
];

function keyFor(type: StepPlaybookLinkType, id: string): string {
  return `${type}:${id}`;
}

export function PlaybookPicker({
  visible,
  interestId,
  excludeKeys = [],
  onSelect,
  onClose,
}: PlaybookPickerProps) {
  const { currentInterest } = useInterest();
  const resolvedInterestId = interestId || currentInterest?.id;
  const { data: playbook } = usePlaybook(resolvedInterestId);
  const playbookId = playbook?.id;

  const { data: resources = [], isLoading: resLoading } = usePlaybookResources(playbookId);
  const { data: concepts = [], isLoading: conceptsLoading } = usePlaybookConcepts(
    playbookId,
    resolvedInterestId,
  );
  const { data: qa = [], isLoading: qaLoading } = usePlaybookQA(playbookId);
  const { data: debriefs = [], isLoading: debriefsLoading } = usePlaybookRecentDebriefs(
    resolvedInterestId,
  );

  const [tab, setTab] = useState<Tab>('resource');
  const [selected, setSelected] = useState<Map<string, PlaybookPickerSelection>>(
    new Map(),
  );

  const excludeSet = useMemo(() => new Set(excludeKeys), [excludeKeys]);

  const toggle = (sel: PlaybookPickerSelection) => {
    const k = keyFor(sel.item_type, sel.item_id);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(k)) next.delete(k);
      else next.set(k, sel);
      return next;
    });
  };

  const handleDone = () => {
    onSelect(Array.from(selected.values()));
    setSelected(new Map());
  };

  const handleClose = () => {
    setSelected(new Map());
    onClose();
  };

  const counts: Record<Tab, number> = {
    resource: resources.length,
    concept: concepts.length,
    qa: qa.length,
    past_learning: debriefs.length,
  };

  const isLoading =
    (tab === 'resource' && resLoading) ||
    (tab === 'concept' && conceptsLoading) ||
    (tab === 'qa' && qaLoading) ||
    (tab === 'past_learning' && debriefsLoading);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add from Playbook</Text>
          <Pressable onPress={handleDone} disabled={selected.size === 0}>
            <Text
              style={[
                styles.doneText,
                selected.size === 0 && styles.doneTextDisabled,
              ]}
            >
              Add ({selected.size})
            </Text>
          </Pressable>
        </View>

        <View style={styles.tabsRow}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Ionicons
                  name={t.icon}
                  size={14}
                  color={active ? IOS_COLORS.systemBlue : IOS_COLORS.secondaryLabel}
                />
                <Text
                  style={[styles.tabText, active && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {t.label} {counts[t.key] ? `· ${counts[t.key]}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={IOS_COLORS.systemBlue} />
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {tab === 'resource' &&
              resources.map((r) => {
                const k = keyFor('resource', r.id);
                if (excludeSet.has(k)) return null;
                const isSel = selected.has(k);
                return (
                  <PickerRow
                    key={k}
                    title={r.title}
                    subtitle={r.resource_type}
                    selected={isSel}
                    onPress={() =>
                      toggle({ item_type: 'resource', item_id: r.id, label: r.title })
                    }
                  />
                );
              })}
            {tab === 'concept' &&
              concepts.map((c) => {
                const k = keyFor('concept', c.id);
                if (excludeSet.has(k)) return null;
                const isSel = selected.has(k);
                return (
                  <PickerRow
                    key={k}
                    title={c.title}
                    subtitle={c.origin}
                    selected={isSel}
                    onPress={() =>
                      toggle({ item_type: 'concept', item_id: c.id, label: c.title })
                    }
                  />
                );
              })}
            {tab === 'qa' &&
              qa.map((q) => {
                const k = keyFor('qa', q.id);
                if (excludeSet.has(k)) return null;
                const isSel = selected.has(k);
                return (
                  <PickerRow
                    key={k}
                    title={q.question}
                    subtitle={q.pinned ? 'Pinned' : 'Saved'}
                    selected={isSel}
                    onPress={() =>
                      toggle({ item_type: 'qa', item_id: q.id, label: q.question })
                    }
                  />
                );
              })}
            {tab === 'past_learning' &&
              debriefs.map((d) => {
                const k = keyFor('past_learning', d.id);
                if (excludeSet.has(k)) return null;
                const isSel = selected.has(k);
                const label = d.title ?? 'Untitled step';
                return (
                  <PickerRow
                    key={k}
                    title={label}
                    subtitle={
                      d.step_date
                        ? new Date(d.step_date).toLocaleDateString()
                        : 'Debrief'
                    }
                    selected={isSel}
                    onPress={() =>
                      toggle({
                        item_type: 'past_learning',
                        item_id: d.id,
                        label,
                      })
                    }
                  />
                );
              })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

interface PickerRowProps {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

function PickerRow({ title, subtitle, selected, onPress }: PickerRowProps) {
  return (
    <Pressable style={[styles.row, selected && styles.rowSelected]} onPress={onPress}>
      <View style={styles.checkCircle}>
        {selected ? (
          <Ionicons name="checkmark-circle" size={24} color={IOS_COLORS.systemBlue} />
        ) : (
          <Ionicons name="ellipse-outline" size={24} color={IOS_COLORS.systemGray3} />
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  cancelText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  doneTextDisabled: {
    color: IOS_COLORS.systemGray3,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.sm,
    gap: IOS_SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  tabActive: {
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  tabTextActive: {
    color: IOS_COLORS.systemBlue,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.xs,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
  },
  rowSelected: {
    backgroundColor: 'rgba(0,122,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.2)',
  },
  checkCircle: {
    width: 24,
  },
  rowInfo: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  rowSubtitle: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'capitalize',
  },
});
