/**
 * InspirationCalendarStep — optional review before activation.
 *
 * Calendar rows are not written until the user confirms this screen.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type {
  InspirationCalendar,
  InspirationCalendarStep as CalendarStep,
} from '@/types/inspiration';

interface InspirationCalendarStepProps {
  calendar: InspirationCalendar | null | undefined;
  activating: boolean;
  onConfirm: (calendar: InspirationCalendar | null) => void;
}

type CalendarBucket = 'past' | 'future' | 'undated';

function bucketStep(step: CalendarStep): CalendarBucket {
  if (!step.date) return 'undated';
  return step.tense === 'past' ? 'past' : 'future';
}

function formatDate(date: string | null): string {
  if (!date) return 'No fixed date';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function InspirationCalendarStep({
  calendar,
  activating,
  onConfirm,
}: InspirationCalendarStepProps) {
  const initialSteps = calendar?.steps ?? [];
  const [steps, setSteps] = useState<CalendarStep[]>(initialSteps);

  const grouped = useMemo(() => {
    const bySeason = new Map<string, CalendarStep[]>();
    for (const step of steps) {
      const seasonName = step.season_name?.trim() || 'Unassigned work';
      const existing = bySeason.get(seasonName) ?? [];
      existing.push(step);
      bySeason.set(seasonName, existing);
    }
    return Array.from(bySeason.entries());
  }, [steps]);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const reviewedCalendar = useMemo<InspirationCalendar | null>(() => {
    if (!calendar || steps.length === 0) return null;
    const usedSeasonNames = new Set(
      steps.map((step) => step.season_name?.trim().toLowerCase()).filter(Boolean),
    );
    return {
      seasons: (calendar.seasons ?? []).filter((season) =>
        usedSeasonNames.has(season.name.trim().toLowerCase()),
      ),
      steps,
    };
  }, [calendar, steps]);

  if (!calendar || initialSteps.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={38} color={IOS_COLORS.systemGray2} />
        <Text style={styles.emptyTitle}>No dated work found</Text>
        <Text style={styles.emptyText}>
          The blueprint is ready, but this source did not contain enough reliable dates or recurring anchors to build a calendar.
        </Text>
        <Pressable
          onPress={() => onConfirm(null)}
          disabled={activating}
          style={[styles.primaryButton, activating && styles.buttonDisabled]}
        >
          {activating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create Plan</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>{steps.length} calendar items</Text>
        <View style={styles.summaryDot} />
        <Text style={styles.summaryText}>{calendar.seasons.length} seasons</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Review the calendar</Text>
        <Text style={styles.description}>
          Dates and recurring anchors are optional. Remove anything that looks guessed; undated steps stay ordered without fake dates.
        </Text>

        {grouped.map(([seasonName, seasonSteps]) => (
          <View key={seasonName} style={styles.seasonBlock}>
            <Text style={styles.seasonTitle}>{seasonName}</Text>
            {(['past', 'future', 'undated'] as CalendarBucket[]).map((bucket) => {
              const bucketSteps = seasonSteps.filter((step) => bucketStep(step) === bucket);
              if (bucketSteps.length === 0) return null;
              return (
                <View key={`${seasonName}-${bucket}`} style={styles.bucketBlock}>
                  <Text style={styles.bucketTitle}>
                    {bucket === 'past' ? 'Past' : bucket === 'future' ? 'Future anchors' : 'Undated sequence'}
                  </Text>
                  {bucketSteps.map((step) => {
                    const originalIndex = steps.indexOf(step);
                    const lowConfidence = step.confidence < 0.72;
                    return (
                      <View key={`${step.title}-${originalIndex}`} style={styles.stepCard}>
                        <View style={styles.stepIcon}>
                          <Ionicons
                            name={step.is_anchor ? 'flag-outline' : 'ellipse-outline'}
                            size={16}
                            color={step.is_anchor ? IOS_COLORS.systemPink : IOS_COLORS.systemBlue}
                          />
                        </View>
                        <View style={styles.stepBody}>
                          <View style={styles.stepTopRow}>
                            <Text style={styles.stepDate}>{formatDate(step.date)}</Text>
                            {lowConfidence && (
                              <View style={styles.lowBadge}>
                                <Text style={styles.lowBadgeText}>CHECK DATE</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.stepTitle}>{step.title}</Text>
                          <Text style={styles.stepMeta}>
                            {step.type_label || 'general'}
                            {step.recurrence ? ` · ${step.recurrence}` : ''}
                          </Text>
                          {step.source_span ? (
                            <Text style={styles.sourceSpan} numberOfLines={2}>{step.source_span}</Text>
                          ) : null}
                        </View>
                        <Pressable onPress={() => removeStep(originalIndex)} hitSlop={8}>
                          <Ionicons name="close-circle" size={20} color={IOS_COLORS.systemGray3} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => onConfirm(reviewedCalendar)}
          disabled={activating}
          style={[styles.primaryButton, activating && styles.buttonDisabled]}
        >
          {activating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.primaryButtonText}>Creating...</Text>
            </View>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Create Plan + Calendar</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  summaryText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  summaryDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_COLORS.systemGray3,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
    marginBottom: IOS_SPACING.md,
  },
  seasonBlock: {
    marginBottom: IOS_SPACING.lg,
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.sm,
  },
  bucketBlock: {
    marginBottom: IOS_SPACING.md,
  },
  bucketTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.md,
    marginBottom: IOS_SPACING.xs,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${IOS_COLORS.systemBlue}10`,
  },
  stepBody: {
    flex: 1,
    minWidth: 0,
  },
  stepTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  stepDate: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  lowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: `${IOS_COLORS.systemOrange}18`,
  },
  lowBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: IOS_COLORS.systemOrange,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  stepMeta: {
    fontSize: 12.5,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  sourceSpan: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 5,
    lineHeight: 16,
  },
  footer: {
    padding: IOS_SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: 15,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: IOS_SPACING.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginTop: IOS_SPACING.md,
  },
  emptyText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: IOS_SPACING.xs,
    marginBottom: IOS_SPACING.lg,
  },
});
