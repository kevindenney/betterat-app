/**
 * EvidenceStepPickerSheet — pick one of your timeline steps to attach
 * as evidence for a librarian-noticed concept.
 *
 * Backed by step_concept_links (one row per step ↔ concept). The
 * existing linkConceptToStep service handles the insert and bumps the
 * concept's lifecycle state from forming → testing if it isn't already
 * settled. Selecting a step here:
 *   1. Inserts step_concept_links (ignores 23505 dup)
 *   2. Auto-promotes concept state to 'testing' if not 'settled'
 *   3. Invalidates the playbook caches so the concept's evidence
 *      count + state refresh in the Library
 *
 * v1 lists the viewer's most recent timeline_steps for the active
 * interest. v2 will broaden to debriefs and saved resources.
 */

import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { linkConceptToStep } from '@/services/PlaybookService';
import { KEYS as PLAYBOOK_KEYS } from '@/hooks/usePlaybook';
import {
  LIBRARIAN_PURPLE,
  LIBRARIAN_PURPLE_INK,
  LIBRARIAN_PURPLE_TINT_18,
} from './librarianTokens';

interface Props {
  visible: boolean;
  conceptId: string;
  conceptTitle: string;
  interestId?: string | null;
  playbookId?: string | null;
  onClose: () => void;
  onLinked?: (stepId: string) => void;
}

interface StepRowProps {
  id: string;
  title: string;
  startsAt: string | null;
  saving: boolean;
  onPress: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StepRow({ id, title, startsAt, saving, onPress }: StepRowProps) {
  return (
    <Pressable
      key={id}
      onPress={onPress}
      disabled={saving}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title || 'Untitled step'}
        </Text>
        {startsAt ? (
          <Text style={styles.rowMeta}>{formatDate(startsAt)}</Text>
        ) : null}
      </View>
      <Ionicons name="add-circle-outline" size={22} color={LIBRARIAN_PURPLE_INK} />
    </Pressable>
  );
}

export function EvidenceStepPickerSheet({
  visible,
  conceptId,
  conceptTitle,
  interestId,
  playbookId,
  onClose,
  onLinked,
}: Props) {
  const queryClient = useQueryClient();
  const { data: steps = [], isLoading } = useMyTimeline(interestId ?? null);
  const [savingStepId, setSavingStepId] = React.useState<string | null>(null);

  const handlePick = async (stepId: string) => {
    setSavingStepId(stepId);
    try {
      await linkConceptToStep(stepId, conceptId);
      // Invalidate the playbook caches the librarian cares about so
      // the concept's evidence count + lifecycle state refresh.
      if (playbookId) {
        queryClient.invalidateQueries({
          queryKey: PLAYBOOK_KEYS.concepts(playbookId),
        });
        queryClient.invalidateQueries({
          queryKey: PLAYBOOK_KEYS.sectionCounts(playbookId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: PLAYBOOK_KEYS.stepConceptLinks(stepId),
      });
      // useLifecycleConcepts is what the Concepts zone + the Librarian
      // anchor pick read — its linked_step_count feeds the observation
      // copy. Prefix-invalidate by user id (interestId may be absent).
      queryClient.invalidateQueries({
        queryKey: ['playbook-lifecycle-concepts'],
      });
      onLinked?.(stepId);
      onClose();
    } catch (err) {
      showAlert(
        'Could not attach evidence',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSavingStepId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Attach evidence</Text>
              <Text style={styles.title}>{conceptTitle}</Text>
              <Text style={styles.hint}>
                Pick a step where you exercised or contradicted this concept.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={IOS_COLORS.secondaryLabel} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={LIBRARIAN_PURPLE_INK} />
            </View>
          ) : steps.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No steps yet</Text>
              <Text style={styles.emptyBody}>
                Plan or log a step in this interest first, then come back to
                attach it as evidence.
              </Text>
            </View>
          ) : (
            <FlatList
              data={steps}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <StepRow
                  id={item.id}
                  title={item.title ?? ''}
                  startsAt={item.starts_at ?? item.created_at ?? null}
                  saving={savingStepId === item.id}
                  onPress={() => handlePick(item.id)}
                />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              style={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: LIBRARIAN_PURPLE,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  hint: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  list: {
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: LIBRARIAN_PURPLE_TINT_18,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  rowMeta: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.12)',
  },
  loading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  empty: {
    padding: 24,
    gap: 6,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
});
