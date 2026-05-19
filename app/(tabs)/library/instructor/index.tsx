/**
 * Instructor Dashboard — aggregate view of all Playbooks shared with this user.
 *
 * Shows per-student: name/email, interest, concept count, resource count,
 * review count, latest review snippet. Each row links to the read-only
 * shared Playbook view.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInstructorDashboard } from '@/hooks/usePlaybook';

export default function InstructorDashboardScreen() {
  const { students, isLoading } = useInstructorDashboard();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={IOS_COLORS.systemBlue} />
        <Text style={styles.loadingText}>Loading student Playbooks…</Text>
      </View>
    );
  }

  if (students.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="people-outline" size={48} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>No students yet</Text>
        <Text style={styles.emptyText}>
          When students share their Playbooks with you, they'll appear here.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.6 }]}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/library')}
        >
          <Ionicons name="chevron-back" size={16} color={IOS_COLORS.systemBlue} />
          <Text style={styles.backLinkText}>Back to Playbook</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.6 }]}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/library')}
        >
          <Ionicons name="chevron-back" size={16} color={IOS_COLORS.systemBlue} />
          <Text style={styles.backLinkText}>Playbook</Text>
        </Pressable>
        <Text style={styles.heading}>Student Playbooks</Text>
        <Text style={styles.subtitle}>
          {students.length} student{students.length !== 1 ? 's' : ''} sharing with you
        </Text>
      </View>

      <View style={styles.list}>
        {students.map((student) => (
          <Pressable
            key={student.id}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            onPress={() =>
              router.push(`/library/shared/${student.playbook_id}` as any)
            }
          >
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(student.owner_name || student.owner_email)?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.studentName} numberOfLines={1}>
                  {student.owner_name || student.owner_email}
                </Text>
                <Text style={styles.studentMeta} numberOfLines={1}>
                  {student.interest_name}
                  {student.invite_status === 'pending' ? ' · Pending' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
            </View>

            <View style={styles.statsRow}>
              <StatBadge
                icon="bulb-outline"
                value={student.counts.concepts}
                label="Concepts"
              />
              <StatBadge
                icon="document-text-outline"
                value={student.counts.resources}
                label="Resources"
              />
              <StatBadge
                icon="trending-up-outline"
                value={student.counts.patterns}
                label="Patterns"
              />
              <StatBadge
                icon="calendar-outline"
                value={student.counts.reviews}
                label="Reviews"
              />
            </View>

            {student.competency && student.competency.total > 0 && (
              <View style={styles.competencyBar}>
                <View style={styles.competencyHeader}>
                  <Text style={styles.competencyLabel}>Competency progress</Text>
                  <Text style={styles.competencyPercent}>{student.competency.overallPercent}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  {student.competency.total > 0 && (
                    <>
                      <View
                        style={[
                          styles.progressFillValidated,
                          { flex: student.competency.validated || 0.001 },
                        ]}
                      />
                      <View
                        style={[
                          styles.progressFillPracticing,
                          { flex: student.competency.practicing || 0.001 },
                        ]}
                      />
                      <View
                        style={[
                          styles.progressFillLearning,
                          { flex: student.competency.learning || 0.001 },
                        ]}
                      />
                      <View
                        style={[
                          styles.progressFillEmpty,
                          {
                            flex:
                              Math.max(
                                0,
                                student.competency.total -
                                  student.competency.validated -
                                  student.competency.practicing -
                                  student.competency.learning,
                              ) || 0.001,
                          },
                        ]}
                      />
                    </>
                  )}
                </View>
                <View style={styles.competencyLegend}>
                  <LegendDot color={IOS_COLORS.systemGreen} label={`${student.competency.validated} validated`} />
                  <LegendDot color={IOS_COLORS.systemOrange} label={`${student.competency.practicing} practicing`} />
                  <LegendDot color={IOS_COLORS.systemBlue} label={`${student.competency.learning} learning`} />
                </View>
              </View>
            )}

            {student.latestReview && (
              <View style={styles.reviewSnippet}>
                <Text style={styles.reviewDate}>
                  Latest review: {new Date(student.latestReview.period_end).toLocaleDateString()}
                </Text>
                <Text style={styles.reviewText} numberOfLines={2}>
                  {student.latestReview.summary_md}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function StatBadge({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={IOS_COLORS.systemIndigo} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  content: {
    padding: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.xl,
    gap: IOS_SPACING.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: IOS_SPACING.xl,
    gap: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  loadingText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  emptyText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    maxWidth: 320,
  },
  header: {
    gap: 4,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: IOS_SPACING.sm,
    marginLeft: -4,
  },
  backLinkText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  subtitle: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  list: {
    gap: IOS_SPACING.md,
  },
  card: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: IOS_COLORS.systemIndigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardHeaderText: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  studentMeta: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  statsRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  statLabel: {
    fontSize: 10,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  competencyBar: {
    gap: 6,
  },
  competencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  competencyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  competencyPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.systemGreen,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: IOS_COLORS.systemGray5,
  },
  progressFillValidated: {
    backgroundColor: IOS_COLORS.systemGreen,
  },
  progressFillPracticing: {
    backgroundColor: IOS_COLORS.systemOrange,
  },
  progressFillLearning: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  progressFillEmpty: {
    backgroundColor: 'transparent',
  },
  competencyLegend: {
    flexDirection: 'row',
    gap: IOS_SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: IOS_COLORS.secondaryLabel,
  },
  reviewSnippet: {
    gap: 4,
    paddingTop: IOS_SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.systemGray4,
  },
  reviewDate: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.systemIndigo,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  reviewText: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
});
