/**
 * NCLEXReadinessView - Flags at-risk students with competency gaps.
 *
 * Shows students below validation threshold with their specific
 * gap competencies and recommended remediation actions.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COMPETENCY_STATUS_CONFIG } from '@/types/competency';
import type { AtRiskStudent } from '@/types/cohortCompetency';

interface NCLEXReadinessViewProps {
  atRiskStudents: AtRiskStudent[];
  totalStudents: number;
  onStudentPress?: (userId: string) => void;
}

export function NCLEXReadinessView({ atRiskStudents, totalStudents, onStudentPress }: NCLEXReadinessViewProps) {
  const readyCount = totalStudents - atRiskStudents.length;
  const readyPercent = totalStudents > 0 ? Math.round((readyCount / totalStudents) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Summary banner */}
      <View style={[styles.banner, atRiskStudents.length > 0 ? styles.bannerWarning : styles.bannerSuccess]}>
        <Ionicons
          name={atRiskStudents.length > 0 ? 'alert-circle' : 'checkmark-circle'}
          size={28}
          color={atRiskStudents.length > 0 ? '#EF4444' : '#10B981'}
        />
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>
            {atRiskStudents.length > 0
              ? `${atRiskStudents.length} student${atRiskStudents.length !== 1 ? 's' : ''} at risk`
              : 'All students on track'}
          </Text>
          <Text style={styles.bannerSubtitle}>
            {readyCount} of {totalStudents} students ({readyPercent}%) have ≥50% competencies validated
          </Text>
        </View>
      </View>

      {/* Threshold explanation */}
      <View style={styles.thresholdCard}>
        <Ionicons name="information-circle-outline" size={16} color="#64748B" />
        <Text style={styles.thresholdText}>
          Students below 50% validated competencies are flagged. These students may need targeted
          remediation before NCLEX eligibility.
        </Text>
      </View>

      {/* At-risk student list */}
      {atRiskStudents.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark" size={48} color="#10B981" />
          <Text style={styles.emptyTitle}>Looking good!</Text>
          <Text style={styles.emptySubtitle}>All students in this cohort are above the readiness threshold.</Text>
        </View>
      ) : (
        atRiskStudents.map(student => (
          <TouchableOpacity
            key={student.userId}
            style={styles.studentCard}
            onPress={() => onStudentPress?.(student.userId)}
            activeOpacity={0.7}
          >
            <View style={styles.studentHeader}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.userName}</Text>
                <View style={styles.percentBadge}>
                  <Text style={styles.percentBadgeText}>{student.overallPercent}% validated</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </View>

            {/* Gap summary by category */}
            <View style={styles.gapSection}>
              <Text style={styles.gapSectionTitle}>
                {student.gapCompetencies.length} competencies need attention
              </Text>
              {/* Show top 5 gaps */}
              {student.gapCompetencies.slice(0, 5).map(gap => {
                const statusConfig = COMPETENCY_STATUS_CONFIG[gap.status];
                return (
                  <View key={gap.competencyId} style={styles.gapRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                    <Text style={styles.gapTitle} numberOfLines={1}>{gap.title}</Text>
                    <Text style={[styles.gapStatus, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                );
              })}
              {student.gapCompetencies.length > 5 && (
                <Text style={styles.moreGaps}>
                  + {student.gapCompetencies.length - 5} more
                </Text>
              )}
            </View>

            {/* Recommended action */}
            <View style={styles.recommendedAction}>
              <Ionicons name="bulb-outline" size={14} color="#007AFF" />
              <Text style={styles.recommendedText}>
                Schedule 1:1 with faculty to review competency gaps and create remediation plan
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  bannerWarning: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  bannerSuccess: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  bannerSubtitle: { fontSize: 12, color: '#475569' },

  // Threshold
  thresholdCard: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  thresholdText: { fontSize: 12, color: '#64748B', flex: 1, lineHeight: 18 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  emptySubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center' },

  // Student cards
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 14,
    gap: 10,
  },
  studentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studentInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  studentName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  percentBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  percentBadgeText: { fontSize: 11, fontWeight: '600', color: '#EF4444' },

  // Gaps
  gapSection: { gap: 4 },
  gapSectionTitle: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 2 },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  gapTitle: { fontSize: 12, color: '#334155', flex: 1 },
  gapStatus: { fontSize: 10, fontWeight: '600' },
  moreGaps: { fontSize: 11, color: '#64748B', fontStyle: 'italic', paddingTop: 2 },

  // Recommended action
  recommendedAction: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'flex-start',
  },
  recommendedText: { fontSize: 12, color: '#007AFF', flex: 1, lineHeight: 17 },
});
