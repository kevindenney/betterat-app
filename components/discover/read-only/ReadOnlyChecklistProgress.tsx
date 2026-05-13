/**
 * ReadOnlyChecklistProgress Component
 *
 * Displays sailor's checklist completion progress in read-only mode.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle, Circle } from 'lucide-react-native';
import { ChecklistSummary } from '@/hooks/usePublicSailorRaceJourney';
import { ChecklistCompletion } from '@/types/checklists';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

interface ReadOnlyChecklistProgressProps {
  checklistSummary: ChecklistSummary;
  completions?: Record<string, ChecklistCompletion>;
}

/**
 * Progress bar component
 */
function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${percentage}%` },
            percentage >= 100 && styles.progressBarComplete,
          ]}
        />
      </View>
      <Text style={styles.progressText}>{percentage}%</Text>
    </View>
  );
}

export function ReadOnlyChecklistProgress({
  checklistSummary,
  completions,
}: ReadOnlyChecklistProgressProps) {
  // Group completions by status
  const groupedCompletions = useMemo(() => {
    if (!completions) return { completed: [], pending: [] };

    const items = Object.entries(completions);
    const completed: { id: string; completion: ChecklistCompletion }[] = [];
    const pending: { id: string; completion: ChecklistCompletion }[] = [];

    items.forEach(([id, completion]) => {
      if (completion.completed || completion.status === 'completed') {
        completed.push({ id, completion });
      } else {
        pending.push({ id, completion });
      }
    });

    return { completed, pending };
  }, [completions]);

  return (
    <View style={styles.container}>
      {/* Summary Progress */}
      <View style={styles.summarySection}>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{checklistSummary.completedItems}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{checklistSummary.totalItems}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
        </View>
        <ProgressBar percentage={checklistSummary.percentage} />
      </View>

      {/* Completed Items */}
      {groupedCompletions.completed.length > 0 && (
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>
            Completed ({groupedCompletions.completed.length})
          </Text>
          {groupedCompletions.completed.slice(0, 5).map(({ id, completion }) => (
            <View key={id} style={styles.itemRow}>
              <CheckCircle size={16} color={IOS_COLORS.systemGreen} />
              <Text style={styles.itemText} numberOfLines={1}>
                {completion.notes || formatItemId(id)}
              </Text>
            </View>
          ))}
          {groupedCompletions.completed.length > 5 && (
            <Text style={styles.moreText}>
              +{groupedCompletions.completed.length - 5} more completed
            </Text>
          )}
        </View>
      )}

      {/* Pending Items */}
      {groupedCompletions.pending.length > 0 && (
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>
            Pending ({groupedCompletions.pending.length})
          </Text>
          {groupedCompletions.pending.slice(0, 3).map(({ id, completion }) => (
            <View key={id} style={styles.itemRow}>
              <Circle size={16} color={IOS_COLORS.systemGray3} />
              <Text style={[styles.itemText, styles.pendingText]} numberOfLines={1}>
                {completion.notes || formatItemId(id)}
              </Text>
            </View>
          ))}
          {groupedCompletions.pending.length > 3 && (
            <Text style={styles.moreText}>
              +{groupedCompletions.pending.length - 3} more pending
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Format item ID for display (convert snake_case to Title Case)
 */
function formatItemId(id: string): string {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  summarySection: {
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    padding: 14,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  statLabel: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: IOS_COLORS.systemGray4,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: IOS_COLORS.systemGray4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 4,
  },
  progressBarComplete: {
    backgroundColor: IOS_COLORS.systemGreen,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    width: 44,
    textAlign: 'right',
  },
  itemsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  itemText: {
    fontSize: 14,
    color: IOS_COLORS.label,
    flex: 1,
  },
  pendingText: {
    color: IOS_COLORS.secondaryLabel,
  },
  moreText: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default ReadOnlyChecklistProgress;
