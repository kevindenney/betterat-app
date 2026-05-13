/**
 * PatternsList — AI-detected correlation cards. Each card shows title, body,
 * evidence chips, and pin/dismiss actions. Empty state invites the user to
 * run pattern detection (wired in Phase 7).
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import {
  usePlaybook,
  usePlaybookPatterns,
  useUpdatePatternStatus,
} from '@/hooks/usePlaybook';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { PlaybookAIService } from '@/services/ai/PlaybookAIService';
import type { PlaybookPatternRecord } from '@/types/playbook';

export function PatternsList() {
  const { currentInterest } = useInterest();
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const { data: patterns = [], isLoading } = usePlaybookPatterns(playbook?.id);
  const updateStatus = useUpdatePatternStatus();
  const queryClient = useQueryClient();
  const [detecting, setDetecting] = useState(false);

  const handlePin = (p: PlaybookPatternRecord) => {
    if (!playbook) return;
    const nextStatus: 'active' | 'pinned' = p.status === 'pinned' ? 'active' : 'pinned';
    updateStatus.mutate({ patternId: p.id, status: nextStatus, playbookId: playbook.id });
  };

  const handleDismiss = (p: PlaybookPatternRecord) => {
    if (!playbook) return;
    updateStatus.mutate({ patternId: p.id, status: 'dismissed', playbookId: playbook.id });
  };

  const handleDetect = async () => {
    if (!playbook || detecting) return;
    setDetecting(true);
    try {
      const res = await PlaybookAIService.detectPatterns(playbook.id);
      await queryClient.invalidateQueries({ queryKey: ['playbook'] });
      if (res.reason === 'insufficient_data') {
        showAlert('Not enough data', 'Add a few step debriefs first, then try again.');
      } else {
        showAlert('Done', `${res.suggestions_created} pattern suggestion${res.suggestions_created === 1 ? '' : 's'} queued.`);
      }
    } catch (err) {
      showAlert('Detection failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Patterns</Text>
        <Pressable
          onPress={handleDetect}
          disabled={detecting}
          style={({ pressed }) => [
            styles.runButton,
            detecting && styles.runButtonDisabled,
            pressed && !detecting && styles.pressed,
          ]}
        >
          {detecting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="sparkles" size={14} color="#fff" />
          )}
          <Text style={styles.runText}>
            {detecting ? 'Detecting…' : 'Detect patterns'}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <Text style={styles.loading}>Loading…</Text>
      ) : patterns.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="analytics-outline" size={36} color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.emptyTitle}>No patterns yet</Text>
          <Text style={styles.emptyText}>
            Once you have a handful of step debriefs, patterns surface here —
            things like "lane loss in breeze correlates with undertensioned
            vang."
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {patterns.map((p) => {
            const pinned = p.status === 'pinned';
            const evidenceCount = Array.isArray(p.evidence) ? p.evidence.length : 0;
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {p.title}
                  </Text>
                  <Pressable
                    onPress={() => handlePin(p)}
                    hitSlop={12}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Ionicons
                      name={pinned ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={pinned ? IOS_COLORS.systemBlue : IOS_COLORS.secondaryLabel}
                    />
                  </Pressable>
                </View>
                {p.body_md ? <Text style={styles.cardBody}>{p.body_md}</Text> : null}
                {evidenceCount > 0 ? (
                  <View style={styles.evidenceRow}>
                    <Ionicons name="link-outline" size={12} color={IOS_COLORS.secondaryLabel} />
                    <Text style={styles.evidenceText}>
                      {evidenceCount} piece{evidenceCount === 1 ? '' : 's'} of evidence
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => handleDismiss(p)}
                  style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
                >
                  <Text style={styles.dismissText}>Dismiss</Text>
                </Pressable>
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
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemPurple,
  },
  runButtonDisabled: {
    opacity: 0.6,
  },
  runText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  pressed: {
    opacity: 0.6,
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
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  evidenceText: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
  },
  dismiss: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  dismissText: {
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
