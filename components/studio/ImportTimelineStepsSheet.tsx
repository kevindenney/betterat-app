/**
 * ImportTimelineStepsSheet — pick steps from the author's own timeline and copy
 * them into the blueprint as authored step templates. Lets a creator seed a new
 * blueprint from work they've already done rather than re-authoring every step
 * blank. Multi-select; copies title + description, category defaults to "other"
 * (timeline categories are interest-specific and don't map to the template enum).
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { getUserTimeline } from '@/services/TimelineStepService';

interface ImportTimelineStepsSheetProps {
  visible: boolean;
  importing: boolean;
  onClose: () => void;
  onConfirm: (picks: { title: string; description: string | null }[]) => void;
}

function formatStepDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ImportTimelineStepsSheet({
  visible,
  importing,
  onClose,
  onConfirm,
}: ImportTimelineStepsSheetProps) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ['import-timeline-steps', user?.id],
    enabled: visible && !!user?.id,
    staleTime: 30_000,
    queryFn: () => getUserTimeline(user!.id),
  });

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    setSelected(new Set());
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    const picks = steps
      .filter((s) => selected.has(s.id))
      .map((s) => ({ title: s.title ?? 'Untitled step', description: s.description }));
    onConfirm(picks);
  }, [steps, selected, onConfirm]);

  const count = selected.size;
  const sortedSteps = useMemo(
    () => steps.filter((s) => (s.title ?? '').trim().length > 0),
    [steps],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="albums-outline" size={20} color={IOS_COLORS.systemBlue} />
            <Text style={styles.headerTitle}>Add from my timeline</Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={22} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        </View>

        <Text style={styles.subhead}>
          Pick steps you&apos;ve already done. They&apos;re copied into this blueprint as new
          steps you can edit — your timeline isn&apos;t changed.
        </Text>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
          </View>
        ) : sortedSteps.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="albums-outline" size={48} color={IOS_COLORS.systemGray3} />
            <Text style={styles.emptyTitle}>No timeline steps</Text>
            <Text style={styles.emptySubtitle}>
              Once you have steps in your own timeline, you can pull them in here.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {sortedSteps.map((step) => {
              const on = selected.has(step.id);
              const dateLabel = formatStepDate(step.starts_at);
              const meta = [step.category, dateLabel].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={step.id}
                  style={[styles.row, on && styles.rowOn]}
                  onPress={() => toggle(step.id)}
                >
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {step.title}
                    </Text>
                    {!!meta && (
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {meta}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <Pressable
            style={[styles.confirmButton, (count === 0 || importing) && styles.confirmDisabled]}
            onPress={handleConfirm}
            disabled={count === 0 || importing}
          >
            {importing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmText}>
                {count === 0
                  ? 'Select steps to add'
                  : `Add ${count} step${count !== 1 ? 's' : ''} to blueprint`}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground },
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subhead: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.xl,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: IOS_COLORS.label },
  emptySubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: { flex: 1 },
  listContent: { padding: IOS_SPACING.md, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: IOS_SPACING.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowOn: { borderColor: IOS_COLORS.systemBlue, backgroundColor: 'rgba(0, 122, 255, 0.06)' },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.systemGray3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: IOS_COLORS.systemBlue, borderColor: IOS_COLORS.systemBlue },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: IOS_COLORS.label },
  rowMeta: { fontSize: 12, color: IOS_COLORS.secondaryLabel, textTransform: 'capitalize' },
  footer: {
    padding: IOS_SPACING.md,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.systemGray4,
  },
  confirmButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
