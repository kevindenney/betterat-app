/**
 * FacultyCohortDashboard - Main dashboard showing cohort competency data.
 *
 * Sections:
 *   1. KPI summary cards
 *   2. Competency heatmap (domains × students)
 *   3. Gap alerts
 *   4. NCLEX readiness view
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DashboardKPICard } from '@/components/dashboard/shared/DashboardKPICard';
import { CompetencyHeatmap } from '@/components/organization/CompetencyHeatmap';
import { CohortGapAlerts } from '@/components/organization/CohortGapAlerts';
import { NCLEXReadinessView } from '@/components/organization/NCLEXReadinessView';
import {
  getCohortCompetencyMatrix,
  getCohortSummary,
  getCohortGaps,
  getAtRiskStudents,
} from '@/services/CohortCompetencyService';
import type { CohortCompetencyMatrix, CohortSummary, CohortGap, AtRiskStudent } from '@/types/cohortCompetency';

interface FacultyCohortDashboardProps {
  cohortId: string;
  orgId: string;
}

type DashboardTab = 'overview' | 'nclex';

export function FacultyCohortDashboard({ cohortId, orgId }: FacultyCohortDashboardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const [matrix, setMatrix] = useState<CohortCompetencyMatrix | null>(null);
  const [summary, setSummary] = useState<CohortSummary | null>(null);
  const [gaps, setGaps] = useState<CohortGap[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matrixData, summaryData, gapsData, atRiskData] = await Promise.all([
        getCohortCompetencyMatrix(cohortId, orgId),
        getCohortSummary(cohortId, orgId),
        getCohortGaps(cohortId, orgId),
        getAtRiskStudents(cohortId, orgId, 50),
      ]);
      setMatrix(matrixData);
      setSummary(summaryData);
      setGaps(gapsData);
      setAtRiskStudents(atRiskData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [cohortId, orgId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStudentPress = useCallback((userId: string) => {
    router.push({ pathname: '/organization/student/[studentId]', params: { studentId: userId, orgId } });
  }, [router, orgId]);

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading cohort data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!summary || !matrix) return null;

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons name="grid-outline" size={16} color={activeTab === 'overview' ? '#007AFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'nclex' && styles.tabActive]}
          onPress={() => setActiveTab('nclex')}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={activeTab === 'nclex' ? '#007AFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'nclex' && styles.tabTextActive]}>NCLEX Readiness</Text>
          {atRiskStudents.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{atRiskStudents.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {activeTab === 'overview' ? (
          <>
            {/* KPI Cards */}
            <View style={styles.kpiRow}>
              <DashboardKPICard
                title="Students"
                value={summary.totalStudents}
                icon="people"
                iconColor="#007AFF"
              />
              <DashboardKPICard
                title="Achievement"
                value={`${summary.averageCompetencyPercent}%`}
                subtitle="avg validated+"
                icon="trending-up"
                iconColor="#10B981"
              />
            </View>
            <View style={styles.kpiRow}>
              <DashboardKPICard
                title="At Risk"
                value={summary.studentsAtRisk}
                subtitle="<30% validated"
                icon="alert-circle"
                iconColor="#EF4444"
              />
              <DashboardKPICard
                title="Excelling"
                value={summary.studentsExcelling}
                subtitle=">70% validated"
                icon="star"
                iconColor="#F59E0B"
              />
            </View>

            {/* Competency Heatmap */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Competency Heatmap</Text>
              <Text style={styles.sectionSubtitle}>
                {matrix.domains.length} AACN domains × {matrix.students.length} students
              </Text>
              <CompetencyHeatmap
                matrix={matrix}
                onStudentPress={handleStudentPress}
              />
            </View>

            {/* Gap Alerts */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gap Alerts</Text>
              <CohortGapAlerts gaps={gaps} totalStudents={summary.totalStudents} matrix={matrix} onStudentPress={handleStudentPress} />
            </View>

            {/* Domain Averages */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Domain Averages</Text>
              {summary.domainAverages.map(d => (
                <View key={d.domainId} style={styles.domainRow}>
                  <View style={styles.domainInfo}>
                    <Text style={styles.domainTitle} numberOfLines={1}>{d.domainTitle}</Text>
                    <Text style={styles.domainPercent}>{d.averagePercent}%</Text>
                  </View>
                  <View style={styles.domainBarBg}>
                    <View style={[styles.domainBarFill, {
                      width: `${d.averagePercent}%`,
                      backgroundColor: d.averagePercent >= 70 ? '#10B981' : d.averagePercent >= 40 ? '#F59E0B' : '#EF4444',
                    }]} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <NCLEXReadinessView
            atRiskStudents={atRiskStudents}
            totalStudents={summary.totalStudents}
            onStudentPress={handleStudentPress}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 12, paddingBottom: 40, gap: 16 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { fontSize: 13, color: '#64748B' },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center' },
  retryButton: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  tabTextActive: { color: '#007AFF', fontWeight: '600' },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5, marginLeft: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // KPIs
  kpiRow: { flexDirection: 'row', gap: 8 },

  // Sections
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  sectionSubtitle: { fontSize: 12, color: '#64748B' },

  // Domain averages
  domainRow: { gap: 4 },
  domainInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  domainTitle: { fontSize: 12, color: '#334155', flex: 1, marginRight: 8 },
  domainPercent: { fontSize: 12, fontWeight: '700', color: '#0F172A', minWidth: 36, textAlign: 'right' },
  domainBarBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  domainBarFill: { height: 6, borderRadius: 3 },
});
