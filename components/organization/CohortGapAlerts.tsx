/**
 * CohortGapAlerts - Shows competencies where the cohort is weakest.
 *
 * Displays alerts sorted by severity (lowest achievement first).
 * Tapping an alert expands to show affected students.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CohortGap, CohortCompetencyMatrix } from '@/types/cohortCompetency';

interface CohortGapAlertsProps {
  gaps: CohortGap[];
  totalStudents: number;
  /** Matrix data for showing affected students */
  matrix?: CohortCompetencyMatrix | null;
  /** Called when a student name is tapped */
  onStudentPress?: (userId: string) => void;
  /** Max alerts to show before "show more" */
  limit?: number;
}

function severityConfig(achievementRate: number, attemptRate: number) {
  if (attemptRate < 30) {
    return { icon: 'warning' as const, color: '#EF4444', bg: '#FEF2F2', label: 'Critical Gap' };
  }
  if (achievementRate < 20) {
    return { icon: 'alert-circle' as const, color: '#F97316', bg: '#FFF7ED', label: 'Low Achievement' };
  }
  if (achievementRate < 40) {
    return { icon: 'information-circle' as const, color: '#F59E0B', bg: '#FFFBEB', label: 'Needs Attention' };
  }
  return { icon: 'checkmark-circle' as const, color: '#10B981', bg: '#F0FDF4', label: 'On Track' };
}

function GapAlertCard({
  gap,
  totalStudents,
  matrix,
  onStudentPress,
}: {
  gap: CohortGap;
  totalStudents: number;
  matrix?: CohortCompetencyMatrix | null;
  onStudentPress?: (userId: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const config = severityConfig(gap.achievementRate, gap.attemptRate);
  const notAttempted = totalStudents > 0
    ? Math.round(((100 - gap.attemptRate) / 100) * totalStudents)
    : 0;

  const affectedStudents = useMemo(() => {
    if (!matrix || !expanded) return [];
    return matrix.students
      .filter(s => {
        const status = s.byCompetency[gap.competencyId] ?? 'not_started';
        return status === 'not_started' || status === 'learning';
      })
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { not_started: 0, learning: 1 };
        const ra = statusOrder[a.byCompetency[gap.competencyId] ?? 'not_started'] ?? 2;
        const rb = statusOrder[b.byCompetency[gap.competencyId] ?? 'not_started'] ?? 2;
        return ra - rb || a.userName.localeCompare(b.userName);
      })
      .slice(0, 10);
  }, [matrix, expanded, gap.competencyId]);

  const handlePress = useCallback(() => {
    if (matrix) setExpanded(prev => !prev);
  }, [matrix]);

  return (
    <TouchableOpacity
      activeOpacity={matrix ? 0.7 : 1}
      onPress={handlePress}
      style={[styles.alertCard, { backgroundColor: config.bg }]}
    >
      <View style={styles.alertHeader}>
        <Ionicons name={config.icon} size={18} color={config.color} />
        <Text style={[styles.alertLabel, { color: config.color }]}>{config.label}</Text>
        {matrix && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#94A3B8"
            style={styles.chevron}
          />
        )}
      </View>
      <Text style={styles.alertTitle}>{gap.competencyTitle}</Text>
      <Text style={styles.alertDomain}>{gap.domainTitle}</Text>
      <View style={styles.alertStats}>
        {gap.attemptRate < 50 && (
          <Text style={styles.alertStat}>
            {notAttempted} students ({100 - gap.attemptRate}%) have zero attempts
          </Text>
        )}
        <Text style={styles.alertStat}>
          Only {gap.achievementRate}% of cohort at validated or above
        </Text>
      </View>

      {expanded && affectedStudents.length > 0 && (
        <View style={styles.studentList}>
          <Text style={styles.studentListHeader}>Affected students:</Text>
          {affectedStudents.map(s => {
            const status = s.byCompetency[gap.competencyId] ?? 'not_started';
            return (
              <TouchableOpacity
                key={s.userId}
                style={styles.studentRow}
                onPress={() => onStudentPress?.(s.userId)}
              >
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{s.userName}</Text>
                  <View style={[
                    styles.statusPill,
                    status === 'not_started' ? styles.statusNotStarted : styles.statusLearning,
                  ]}>
                    <Text style={styles.statusPillText}>
                      {status === 'not_started' ? 'Not Started' : 'Learning'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function CohortGapAlerts({ gaps, totalStudents, matrix, onStudentPress, limit = 8 }: CohortGapAlertsProps) {
  const [showAll, setShowAll] = React.useState(false);
  const visibleGaps = showAll ? gaps : gaps.slice(0, limit);

  // Only show gaps that are actually concerning
  const alertGaps = visibleGaps.filter(g => g.achievementRate < 40 || g.attemptRate < 50);

  if (alertGaps.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
        <Text style={styles.emptyText}>No critical gaps detected</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {alertGaps.map(gap => (
        <GapAlertCard
          key={gap.competencyId}
          gap={gap}
          totalStudents={totalStudents}
          matrix={matrix}
          onStudentPress={onStudentPress}
        />
      ))}

      {!showAll && gaps.filter(g => g.achievementRate < 40 || g.attemptRate < 50).length > limit && (
        <Text style={styles.showMore} onPress={() => setShowAll(true)}>
          Show {gaps.filter(g => g.achievementRate < 40 || g.attemptRate < 50).length - limit} more alerts...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  emptyState: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  emptyText: { fontSize: 13, color: '#10B981', fontWeight: '500' },

  alertCard: {
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  alertDomain: { fontSize: 11, color: '#64748B' },
  alertStats: { marginTop: 4, gap: 2 },
  alertStat: { fontSize: 12, color: '#475569' },
  chevron: { marginLeft: 'auto' },

  studentList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: 4,
  },
  studentListHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusNotStarted: {
    backgroundColor: '#FEE2E2',
  },
  statusLearning: {
    backgroundColor: '#FEF3C7',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },

  showMore: { fontSize: 13, color: '#007AFF', fontWeight: '500', textAlign: 'center', paddingVertical: 8 },
});
