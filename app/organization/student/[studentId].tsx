/**
 * Faculty view of an individual student's competency progress.
 *
 * Fetches competency data for the specified student (not the logged-in user)
 * and renders the existing CompetencyDashboard component.
 * Tapping a competency opens a review panel with evidence and approve/revise actions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CompetencyDashboard } from '@/components/competency';
import {
  getUserCompetencyProgress,
  getCompetencyDashboardSummary,
  submitFacultyReview,
} from '@/services/competencyService';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { COMPETENCY_STATUS_CONFIG } from '@/types/competency';
import type {
  CompetencyWithProgress,
  CompetencyDashboardSummary,
  CompetencyStatus,
  FacultyDecision,
} from '@/types/competency';

// Step evidence for a competency
interface StepEvidence {
  stepId: string;
  title: string;
  date: string;
  status: string;
  assessment?: {
    demonstrated_level: string;
    evidence_basis: string;
    advancement_suggestion?: string;
  };
}

export default function StudentDetailScreen() {
  const { studentId, orgId } = useLocalSearchParams<{ studentId: string; orgId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('Student');
  const [competencies, setCompetencies] = useState<CompetencyWithProgress[]>([]);
  const [summary, setSummary] = useState<CompetencyDashboardSummary | null>(null);

  // Review modal state
  const [selectedComp, setSelectedComp] = useState<CompetencyWithProgress | null>(null);
  const [evidence, setEvidence] = useState<StepEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!studentId || !orgId) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch student name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', studentId)
        .maybeSingle();
      if (profile?.full_name) setStudentName(profile.full_name);

      // Find the interest_id for this org's competencies
      const { data: compRow } = await supabase
        .from('betterat_competencies')
        .select('interest_id')
        .eq('organization_id', orgId)
        .limit(1)
        .maybeSingle();

      if (!compRow?.interest_id) {
        setError('No competencies found for this organization');
        return;
      }

      const interestId = compRow.interest_id;

      // Fetch competency progress for this student
      const [progressData, summaryData] = await Promise.all([
        getUserCompetencyProgress(studentId, interestId),
        getCompetencyDashboardSummary(studentId, interestId),
      ]);

      setCompetencies(progressData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load student data');
    } finally {
      setLoading(false);
    }
  }, [studentId, orgId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load evidence when a competency is selected
  const handleSelectCompetency = useCallback(async (comp: CompetencyWithProgress) => {
    setSelectedComp(comp);
    setReviewNotes('');
    setEvidenceLoading(true);
    setEvidence([]);

    try {
      // Find steps where this competency was planned and has assessment data
      const { data: steps } = await supabase
        .from('timeline_steps')
        .select('id, title, status, starts_at, metadata')
        .eq('user_id', studentId!)
        .in('status', ['completed', 'in_progress'])
        .order('starts_at', { ascending: false })
        .limit(20);

      const relevant: StepEvidence[] = [];
      for (const step of steps ?? []) {
        const meta = (step.metadata as Record<string, any>) ?? {};
        const planCompIds = (meta.plan?.competency_ids as string[]) ?? [];
        if (!planCompIds.includes(comp.id)) continue;

        // Check for competency assessment in review data
        const assessmentResults = (meta.review?.competency_assessment?.planned_competency_results ?? []) as any[];
        const match = assessmentResults.find((r: any) =>
          (r.competency_id && r.competency_id === comp.id) ||
          (!r.competency_id && r.competency_title && r.competency_title === comp.title)
        );

        relevant.push({
          stepId: step.id,
          title: step.title,
          date: step.starts_at ? new Date(step.starts_at).toLocaleDateString() : '',
          status: step.status,
          assessment: match ? {
            demonstrated_level: match.demonstrated_level,
            evidence_basis: match.evidence_basis,
            advancement_suggestion: match.advancement_suggestion,
          } : undefined,
        });
      }
      setEvidence(relevant);
    } catch {
      setEvidence([]);
    } finally {
      setEvidenceLoading(false);
    }
  }, [studentId]);

  const handleReviewDecision = useCallback(async (decision: FacultyDecision) => {
    if (!selectedComp?.progress?.id || !user?.id) return;
    setSubmitting(true);
    try {
      await submitFacultyReview(user.id, {
        progress_id: selectedComp.progress.id,
        decision,
        notes: reviewNotes.trim() || undefined,
      });

      // Map faculty decision to new competency status for optimistic update
      const newStatus: CompetencyStatus =
        decision === 'approved' ? 'competent'
          : decision === 'needs_more_practice' ? 'practicing'
            : 'learning'; // remediation_required

      // Optimistically update the competency in local state
      setCompetencies(prev => prev.map(c =>
        c.id === selectedComp.id && c.progress
          ? { ...c, progress: { ...c.progress, status: newStatus } }
          : c
      ));

      // Update the selected comp so the modal reflects the change immediately
      setSelectedComp(prev =>
        prev?.progress
          ? { ...prev, progress: { ...prev.progress, status: newStatus } }
          : prev
      );

      showAlert(
        'Review Submitted',
        decision === 'approved'
          ? `${selectedComp.title} marked as competent.`
          : decision === 'needs_more_practice'
            ? `Sent back for more practice.`
            : `Remediation required — student notified.`,
      );
      // Reload data in background to sync with server
      void loadData();
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }, [selectedComp, reviewNotes, user?.id, loadData]);

  const compStatus = (selectedComp?.progress?.status ?? 'not_started') as CompetencyStatus;
  const statusCfg = COMPETENCY_STATUS_CONFIG[compStatus];
  const canReview = compStatus === 'checkoff_ready' || compStatus === 'validated' || compStatus === 'practicing';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{studentName}</Text>
          <Text style={styles.headerSubtitle}>Competency Progress</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.stateText}>Loading student data...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <CompetencyDashboard
            competencies={competencies}
            summary={summary}
            onSelectCompetency={handleSelectCompetency}
          />
        </ScrollView>
      )}

      {/* Faculty Review Modal */}
      <Modal
        visible={!!selectedComp}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedComp(null)}
      >
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            {/* Modal header */}
            <View style={modal.header}>
              <View style={{ flex: 1 }}>
                <Text style={modal.title} numberOfLines={2}>{selectedComp?.title}</Text>
                <Text style={modal.category}>{selectedComp?.category}</Text>
              </View>
              <Pressable onPress={() => setSelectedComp(null)} style={modal.closeBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            {/* Status + attempts */}
            <View style={modal.statusRow}>
              <View style={[modal.statusBadge, { backgroundColor: statusCfg.bg }]}>
                <Ionicons name={statusCfg.icon as any} size={14} color={statusCfg.color} />
                <Text style={[modal.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
              </View>
              <Text style={modal.attempts}>
                {selectedComp?.progress?.attempts_count ?? 0} attempts
              </Text>
            </View>

            {/* Description */}
            {selectedComp?.description ? (
              <Text style={modal.description}>{selectedComp.description}</Text>
            ) : null}

            <ScrollView style={modal.evidenceScroll} showsVerticalScrollIndicator={false}>
              {/* Evidence section */}
              <Text style={modal.sectionLabel}>EVIDENCE FROM STEPS</Text>
              {evidenceLoading ? (
                <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 12 }} />
              ) : evidence.length === 0 ? (
                <Text style={modal.emptyText}>No step evidence found for this competency.</Text>
              ) : (
                evidence.map((e) => (
                  <View key={e.stepId} style={modal.evidenceCard}>
                    <View style={modal.evidenceHeader}>
                      <Text style={modal.evidenceTitle} numberOfLines={1}>{e.title}</Text>
                      <Text style={modal.evidenceDate}>{e.date}</Text>
                    </View>
                    {e.assessment ? (
                      <>
                        <View style={modal.levelRow}>
                          <View style={[
                            modal.levelPill,
                            {
                              backgroundColor:
                                e.assessment.demonstrated_level === 'proficient' ? '#D1FAE5'
                                  : e.assessment.demonstrated_level === 'developing' ? '#FEF3C7'
                                    : e.assessment.demonstrated_level === 'initial_exposure' ? '#E0E7FF'
                                      : '#F3F4F6',
                            },
                          ]}>
                            <Text style={[
                              modal.levelText,
                              {
                                color:
                                  e.assessment.demonstrated_level === 'proficient' ? '#065F46'
                                    : e.assessment.demonstrated_level === 'developing' ? '#92400E'
                                      : e.assessment.demonstrated_level === 'initial_exposure' ? '#3730A3'
                                        : '#6B7280',
                              },
                            ]}>
                              {e.assessment.demonstrated_level.replace(/_/g, ' ')}
                            </Text>
                          </View>
                        </View>
                        <Text style={modal.evidenceBasis}>{e.assessment.evidence_basis}</Text>
                        {e.assessment.advancement_suggestion ? (
                          <Text style={modal.suggestion}>Next: {e.assessment.advancement_suggestion}</Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={modal.noAssessment}>No assessment yet</Text>
                    )}
                  </View>
                ))
              )}

              {/* Review actions */}
              {canReview && (
                <View style={modal.reviewSection}>
                  <Text style={modal.sectionLabel}>FACULTY REVIEW</Text>
                  <TextInput
                    style={modal.notesInput}
                    placeholder="Optional notes for the student..."
                    placeholderTextColor="#9CA3AF"
                    value={reviewNotes}
                    onChangeText={setReviewNotes}
                    multiline
                    numberOfLines={3}
                  />
                  <View style={modal.actionRow}>
                    <Pressable
                      style={[modal.actionBtn, modal.approveBtn]}
                      onPress={() => handleReviewDecision('approved')}
                      disabled={submitting}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={modal.actionBtnText}>Approve</Text>
                    </Pressable>
                    <Pressable
                      style={[modal.actionBtn, modal.practiceBtn]}
                      onPress={() => handleReviewDecision('needs_more_practice')}
                      disabled={submitting}
                    >
                      <Ionicons name="refresh-circle" size={18} color="#FFFFFF" />
                      <Text style={modal.actionBtnText}>More Practice</Text>
                    </Pressable>
                    <Pressable
                      style={[modal.actionBtn, modal.remediationBtn]}
                      onPress={() => handleReviewDecision('remediation_required')}
                      disabled={submitting}
                    >
                      <Ionicons name="alert-circle" size={18} color="#FFFFFF" />
                      <Text style={modal.actionBtnText}>Remediate</Text>
                    </Pressable>
                  </View>
                  {submitting && <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 8 }} />}
                </View>
              )}

              {!canReview && selectedComp && (
                <View style={modal.reviewSection}>
                  <Text style={modal.sectionLabel}>FACULTY REVIEW</Text>
                  <Text style={modal.emptyText}>
                    {compStatus === 'competent'
                      ? 'Already approved as competent.'
                      : compStatus === 'not_started' || compStatus === 'learning'
                        ? 'Student needs more practice before review.'
                        : 'Not ready for review.'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { padding: 4 },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSubtitle: { fontSize: 12, color: '#64748B' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  stateText: { fontSize: 13, color: '#64748B' },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center' },
  retryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  category: { fontSize: 12, color: '#64748B', marginTop: 2 },
  closeBtn: { padding: 4, marginLeft: 8 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  attempts: { fontSize: 12, color: '#64748B' },
  description: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 16,
  },
  evidenceScroll: { flex: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  emptyText: { fontSize: 13, color: '#94A3B8', marginBottom: 16 },
  evidenceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  evidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  evidenceTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A', flex: 1 },
  evidenceDate: { fontSize: 11, color: '#94A3B8', marginLeft: 8 },
  levelRow: { marginBottom: 4 },
  levelPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  evidenceBasis: { fontSize: 12, color: '#475569', lineHeight: 17, marginTop: 4 },
  suggestion: { fontSize: 12, color: '#0097A7', marginTop: 4 },
  noAssessment: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  reviewSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  approveBtn: { backgroundColor: '#059669' },
  practiceBtn: { backgroundColor: '#D97706' },
  remediationBtn: { backgroundColor: '#DC2626' },
});
