/**
 * LinkBlueprintStepSheet — manual resolver for the blueprint_step
 * back-link on legacy timeline_steps.
 *
 * Older adopted rows shipped without source_blueprint_step_id because
 * adoptStep didn't populate it (fixed in TimelineStepService). On those
 * rows the Cohort tab and the cohort half of the WITH chip stay quiet
 * even though the step is blueprint-derived. The user can open this
 * sheet from the ⋮ menu, pick the canonical blueprint step that this
 * row should point at, and the linkage lights up.
 *
 * The sheet lists all blueprint_steps for the step's source blueprint,
 * sorted by sort_order, with the underlying canonical step's title.
 * Picking a row writes source_blueprint_step_id and invalidates the
 * relevant queries so the UI rerenders.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface LinkBlueprintStepSheetProps {
  visible: boolean;
  stepId: string;
  blueprintId: string;
  onDismiss: () => void;
  onLinked?: () => void;
}

interface BlueprintStepOption {
  blueprintStepId: string;
  canonicalStepId: string;
  title: string;
  sortOrder: number;
}

export function LinkBlueprintStepSheet({
  visible,
  stepId,
  blueprintId,
  onDismiss,
  onLinked,
}: LinkBlueprintStepSheetProps) {
  const queryClient = useQueryClient();

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['link-blueprint-step-options', blueprintId],
    enabled: visible && Boolean(blueprintId),
    staleTime: 60_000,
    queryFn: async (): Promise<BlueprintStepOption[]> => {
      const { data: bsRows, error: bsErr } = await supabase
        .from('blueprint_steps')
        .select('id, step_id, sort_order')
        .eq('blueprint_id', blueprintId)
        .order('sort_order', { ascending: true });
      if (bsErr) {
        console.warn('[link-blueprint-step] blueprint_steps query failed', bsErr);
        return [];
      }
      const rows = (bsRows ?? []) as {
        id: string;
        step_id: string;
        sort_order: number;
      }[];
      if (rows.length === 0) return [];
      const stepIds = rows.map((r) => r.step_id);
      const { data: srcRows } = await supabase
        .from('timeline_steps')
        .select('id, title')
        .in('id', stepIds);
      const titleById = new Map(
        ((srcRows ?? []) as { id: string; title: string | null }[]).map((r) => [
          r.id,
          r.title ?? 'Untitled step',
        ]),
      );
      return rows.map((r) => ({
        blueprintStepId: r.id,
        canonicalStepId: r.step_id,
        title: titleById.get(r.step_id) ?? 'Untitled step',
        sortOrder: r.sort_order,
      }));
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (blueprintStepId: string) => {
      const { error } = await supabase
        .from('timeline_steps')
        .update({ source_blueprint_step_id: blueprintStepId })
        .eq('id', stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['step-detail', stepId] });
      queryClient.invalidateQueries({ queryKey: ['timeline-step-blueprint-step-id', stepId] });
      queryClient.invalidateQueries({ queryKey: ['step-blueprint-step-link', stepId] });
      onLinked?.();
      onDismiss();
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={styles.host}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Link to a blueprint step</Text>
            <Text style={styles.subtitle}>
              Pick the canonical step this one came from to light up the
              cohort thread and cross-cohort headcounts.
            </Text>
          </View>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={IOS_REGISTER.label} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
          </View>
        ) : options.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="alert-circle-outline" size={28} color={IOS_REGISTER.labelTertiary} />
            <Text style={styles.emptyText}>
              No blueprint steps to link to — the source blueprint may have
              no canonical steps yet.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {options.map((opt) => (
              <Pressable
                key={opt.blueprintStepId}
                style={styles.row}
                onPress={() => linkMutation.mutate(opt.blueprintStepId)}
                disabled={linkMutation.isPending}
              >
                <View style={styles.indexBubble}>
                  <Text style={styles.indexText}>{opt.sortOrder}</Text>
                </View>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {opt.title}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={IOS_REGISTER.labelTertiary}
                />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.25,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: IOS_REGISTER.cardBg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  emptyText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  indexBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
  },
  indexText: {
    color: IOS_REGISTER.accentUserAction,
    fontWeight: '700',
    fontSize: 13,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
});

export default LinkBlueprintStepSheet;
