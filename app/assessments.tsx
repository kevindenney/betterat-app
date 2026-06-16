import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useWorkspaceDomain } from '@/hooks/useWorkspaceDomain';
import {
  AssessmentDateWindow,
  AssessmentFocus,
  AssessmentRouteParams,
  AssessmentStatusFilter,
  buildAssessmentQueryFilters,
  buildClearDrillDownHref,
  parseAssessmentRouteState,
} from '@/lib/assessments/drillDown';
import { supabase } from '@/services/supabase';
import {
  AssessmentRecord,
  AssessmentRecordFilters,
  AssessmentStatus,
  OrganizationAssessmentSummary,
  ProgramTemplateRecord,
  ProgramParticipantRecord,
  ProgramRecord,
  ProgramSessionRecord,
  programService,
} from '@/services/ProgramService';

const emptySummary: OrganizationAssessmentSummary = {
  total: 0,
  draft: 0,
  submitted: 0,
  reviewed: 0,
  finalized: 0,
};

const STATUS_OPTIONS: (AssessmentStatus | 'all')[] = ['all', 'draft', 'submitted', 'reviewed', 'finalized'];

function getAssessmentDueDate(row: AssessmentRecord): Date | null {
  const evidence = (row.evidence as Record<string, unknown> | null) || {};
  const raw = String((evidence as any).due_at || (evidence as any).dueAt || row.assessed_at || row.created_at || '');
  if (!raw) return null;
  const due = new Date(raw);
  return Number.isNaN(due.getTime()) ? null : due;
}

function prettyStatus(value: string) {
  const lower = String(value || 'draft').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default function AssessmentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<AssessmentRouteParams>();
  const { user } = useAuth();
  const { activeOrganization, ready } = useOrganization();
  const { activeDomain, isSailingDomain } = useWorkspaceDomain();
  const isInstitutionWorkspace = Boolean(activeOrganization?.id) && !isSailingDomain;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState<OrganizationAssessmentSummary>(emptySummary);
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [sessions, setSessions] = useState<ProgramSessionRecord[]>([]);
  const [participants, setParticipants] = useState<ProgramParticipantRecord[]>([]);
  const [assessmentTemplates, setAssessmentTemplates] = useState<ProgramTemplateRecord[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<AssessmentStatusFilter>('all');
  const [selectedFocus, setSelectedFocus] = useState<AssessmentFocus>('all');
  const [selectedDateWindow, setSelectedDateWindow] = useState<AssessmentDateWindow>('all');
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<string | null>(null);
  const [selectedCompetencyTitle, setSelectedCompetencyTitle] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedProgramTitle, setSelectedProgramTitle] = useState<string | null>(null);
  const [selectedParticipantUserId, setSelectedParticipantUserId] = useState<string | null>(null);
  const [selectedParticipantName, setSelectedParticipantName] = useState<string | null>(null);
  const [dateFromOverride, setDateFromOverride] = useState<string | null>(null);
  const [dateToOverride, setDateToOverride] = useState<string | null>(null);
  const [competencyTitleById, setCompetencyTitleById] = useState<Record<string, string>>({});

  useEffect(() => {
    const routeState = parseAssessmentRouteState(params);
    setSelectedStatus(routeState.selectedStatus);
    setSelectedFocus(routeState.selectedFocus);
    setSelectedDateWindow(routeState.selectedDateWindow);
    setSelectedCompetencyId(routeState.selectedCompetencyId);
    setSelectedCompetencyTitle(routeState.selectedCompetencyTitle);
    setSelectedProgramId(routeState.selectedProgramId);
    setSelectedProgramTitle(routeState.selectedProgramTitle);
    setSelectedParticipantUserId(routeState.selectedParticipantUserId);
    setSelectedParticipantName(routeState.selectedParticipantName);
    setDateFromOverride(routeState.dateFromOverride);
    setDateToOverride(routeState.dateToOverride);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.competency_id,
    params.competency_title,
    params.program_id,
    params.program_title,
    params.participant_name,
    params.participant_user_id,
    params.date_from,
    params.date_to,
    params.date_window,
    params.focus,
    params.status,
  ]);

  const assessmentQueryFilters = useMemo<AssessmentRecordFilters>(() => ({
    ...buildAssessmentQueryFilters({
      selectedProgramId,
      selectedCompetencyId,
      selectedDateWindow,
      dateFromOverride,
      dateToOverride,
    }),
  }), [dateFromOverride, dateToOverride, selectedCompetencyId, selectedDateWindow, selectedProgramId]);
  const hasDrillDownFilters = useMemo(
    () =>
      Boolean(
        selectedCompetencyId ||
        selectedProgramId ||
        selectedParticipantUserId ||
        selectedDateWindow !== 'all' ||
        selectedFocus !== 'all' ||
        dateFromOverride ||
        dateToOverride
      ),
    [
      dateFromOverride,
      dateToOverride,
      selectedCompetencyId,
      selectedDateWindow,
      selectedFocus,
      selectedParticipantUserId,
      selectedProgramId,
    ]
  );

  const [showCreate, setShowCreate] = useState(false);
  const [newProgramId, setNewProgramId] = useState<string | null>(null);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);
  const [newParticipantId, setNewParticipantId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<AssessmentStatus>('draft');
  const [newScoreText, setNewScoreText] = useState('');
  const [newRubricLevel, setNewRubricLevel] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newActionPlan, setNewActionPlan] = useState('');
  const [newNextCheckInAt, setNewNextCheckInAt] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!ready || !activeOrganization?.id || !isInstitutionWorkspace) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const statusFilter = selectedStatus === 'all' ? null : selectedStatus;
        const queryFilters: AssessmentRecordFilters = {
          ...assessmentQueryFilters,
          status: statusFilter,
        };
        const [nextSummary, nextRecords, nextPrograms, nextSessions, nextTemplates] = await Promise.all([
          programService.getOrganizationAssessmentSummary(activeOrganization.id),
          programService.listOrganizationAssessmentRecords(activeOrganization.id, 200, queryFilters),
          programService.listPrograms(activeOrganization.id),
          programService.listOrganizationProgramSessions(activeOrganization.id, 400),
          programService.listProgramTemplates(activeOrganization.id, activeDomain, 'assessment', 100),
        ]);
        const visibleParticipantIds = Array.from(
          new Set(
            nextRecords
              .map((row) => row.participant_id)
              .filter((participantId): participantId is string => Boolean(participantId))
          )
        );
        const nextParticipants =
          visibleParticipantIds.length > 0
            ? await programService.listOrganizationProgramParticipantsByIds(
                activeOrganization.id,
                visibleParticipantIds,
                1000
              )
            : [];
        const competencyIds = Array.from(
          new Set(
            nextRecords
              .map((row) => row.competency_id)
              .filter((competencyId): competencyId is string => Boolean(competencyId))
          )
        );
        const competencyMap: Record<string, string> = {};
        if (competencyIds.length > 0) {
          const { data: competencyRows, error: competencyError } = await supabase
            .from('betterat_competencies')
            .select('id,title')
            .in('id', competencyIds);
          if (!competencyError) {
            for (const row of competencyRows || []) {
              const entry = row as { id?: string | null; title?: string | null };
              if (!entry.id) continue;
              competencyMap[entry.id] = entry.title || 'Competency';
            }
          }
        }
        setSummary(nextSummary);
        setRecords(nextRecords);
        setPrograms(nextPrograms);
        setSessions(nextSessions);
        setParticipants(nextParticipants);
        setAssessmentTemplates(nextTemplates);
        setCompetencyTitleById(competencyMap);
      } catch (error) {
        console.error('[assessments] Failed to load assessment records:', error);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeDomain, activeOrganization?.id, assessmentQueryFilters, isInstitutionWorkspace, ready, selectedStatus]);

  const participantById = useMemo(() => {
    const map = new Map<string, ProgramParticipantRecord>();
    for (const row of participants) map.set(row.id, row);
    return map;
  }, [participants]);

  const recentRecords = useMemo(() => {
    const base = selectedParticipantUserId
      ? records.filter((row) => {
          if (!row.participant_id) return false;
          const participant = participantById.get(row.participant_id);
          return participant?.user_id === selectedParticipantUserId;
        })
      : records;

    if (selectedFocus === 'all') {
      return base.slice(0, 30);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return base
      .filter((row) => {
        const due = getAssessmentDueDate(row);
        if (!due) return false;
        if (selectedFocus === 'due_today') {
          return due >= today && due < tomorrow;
        }
        return due < today;
      })
      .slice(0, 30);
  }, [participantById, records, selectedFocus, selectedParticipantUserId]);

  const programById = useMemo(() => {
    const map = new Map<string, ProgramRecord>();
    for (const row of programs) map.set(row.id, row);
    return map;
  }, [programs]);

  const sessionById = useMemo(() => {
    const map = new Map<string, ProgramSessionRecord>();
    for (const row of sessions) map.set(row.id, row);
    return map;
  }, [sessions]);

  const templateById = useMemo(() => {
    const map = new Map<string, ProgramTemplateRecord>();
    for (const row of assessmentTemplates) map.set(row.id, row);
    return map;
  }, [assessmentTemplates]);

  const sessionOptions = useMemo(
    () => sessions.filter((row) => !newProgramId || row.program_id === newProgramId),
    [sessions, newProgramId]
  );

  const participantOptions = useMemo(
    () => participants.filter((row) => !newProgramId || row.program_id === newProgramId),
    [participants, newProgramId]
  );

  const resetCreate = () => {
    setNewProgramId(null);
    setNewSessionId(null);
    setNewParticipantId(null);
    setSelectedTemplateId(null);
    setNewStatus('draft');
    setNewScoreText('');
    setNewRubricLevel('');
    setNewNotes('');
    setNewActionPlan('');
    setNewNextCheckInAt('');
  };

  const applyAssessmentTemplate = (template: ProgramTemplateRecord | null) => {
    setSelectedTemplateId(template?.id || null);
    if (!template) return;

    const content = (template.content || {}) as Record<string, unknown>;
    const contentStatus = String(content.status || '').toLowerCase();
    if ((['draft', 'submitted', 'reviewed', 'finalized'] as string[]).includes(contentStatus)) {
      setNewStatus(contentStatus as AssessmentStatus);
    }

    const contentScore = content.score;
    if (typeof contentScore === 'number' && Number.isFinite(contentScore)) {
      setNewScoreText(String(contentScore));
    }

    const contentRubricLevel = content.rubric_level;
    if (typeof contentRubricLevel === 'string') {
      setNewRubricLevel(contentRubricLevel);
    }

    const contentNotes = content.notes;
    if (typeof contentNotes === 'string') {
      setNewNotes(contentNotes);
    } else if (typeof template.description === 'string') {
      setNewNotes(template.description);
    }

    const contentActionPlan = content.action_plan;
    if (typeof contentActionPlan === 'string') {
      setNewActionPlan(contentActionPlan);
    }

    const contentNextCheckIn = content.next_check_in_at;
    if (typeof contentNextCheckIn === 'string') {
      setNewNextCheckInAt(contentNextCheckIn);
    }
  };

  useEffect(() => {
    const routeTemplateId = String(params.templateId || '');
    if (!routeTemplateId || assessmentTemplates.length === 0) return;
    const match = assessmentTemplates.find((row) => row.id === routeTemplateId);
    if (!match) return;
    applyAssessmentTemplate(match);
    setShowCreate(true);
  }, [assessmentTemplates, params.templateId]);

  const submitCreate = async () => {
    if (!activeOrganization?.id || !user?.id) {
      showAlert('Not ready', 'Authentication or organization context is missing.');
      return;
    }

    try {
      setSaving(true);
      const parsedScore = newScoreText.trim() ? Number(newScoreText.trim()) : null;
      if (parsedScore !== null && Number.isNaN(parsedScore)) {
        showAlert('Invalid score', 'Score must be numeric.');
        return;
      }

      await programService.createAssessmentRecord({
        organization_id: activeOrganization.id,
        evaluator_id: user.id,
        program_id: newProgramId,
        session_id: newSessionId,
        participant_id: newParticipantId,
        rubric_level: newRubricLevel.trim() || null,
        status: newStatus,
        score: parsedScore,
        notes: newNotes.trim() || null,
        evidence: {
          ...(selectedTemplateId ? { template_id: selectedTemplateId } : {}),
          ...(newActionPlan.trim() ? { action_plan: newActionPlan.trim() } : {}),
          ...(newNextCheckInAt.trim() ? { next_check_in_at: newNextCheckInAt.trim() } : {}),
        },
        assessed_at: new Date().toISOString(),
      });

      const statusFilter = selectedStatus === 'all' ? null : selectedStatus;
      const queryFilters: AssessmentRecordFilters = {
        ...assessmentQueryFilters,
        status: statusFilter,
      };
      const [nextSummary, nextRecords] = await Promise.all([
        programService.getOrganizationAssessmentSummary(activeOrganization.id),
        programService.listOrganizationAssessmentRecords(activeOrganization.id, 200, queryFilters),
      ]);
      const visibleParticipantIds = Array.from(
        new Set(
          nextRecords
            .map((row) => row.participant_id)
            .filter((participantId): participantId is string => Boolean(participantId))
        )
      );
      const nextParticipants =
        visibleParticipantIds.length > 0
          ? await programService.listOrganizationProgramParticipantsByIds(
              activeOrganization.id,
              visibleParticipantIds,
              1000
            )
          : [];
      const competencyIds = Array.from(
        new Set(
          nextRecords
            .map((row) => row.competency_id)
            .filter((competencyId): competencyId is string => Boolean(competencyId))
        )
      );
      const competencyMap: Record<string, string> = {};
      if (competencyIds.length > 0) {
        const { data: competencyRows, error: competencyError } = await supabase
          .from('betterat_competencies')
          .select('id,title')
          .in('id', competencyIds);
        if (!competencyError) {
          for (const row of competencyRows || []) {
            const entry = row as { id?: string | null; title?: string | null };
            if (!entry.id) continue;
            competencyMap[entry.id] = entry.title || 'Competency';
          }
        }
      }
      setSummary(nextSummary);
      setRecords(nextRecords);
      setParticipants(nextParticipants);
      setCompetencyTitleById(competencyMap);
      resetCreate();
      setShowCreate(false);
    } catch (error: any) {
      showAlert('Failed to create assessment', error?.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="assessments-back-button">
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>Assessments</ThemedText>
            <ThemedText style={styles.subtitle}>
              {activeOrganization?.name || 'Organization'} competency and evaluation records
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.createTopButton} onPress={() => setShowCreate((prev) => !prev)}>
            <Ionicons name={showCreate ? 'close' : 'add'} size={18} color="#FFFFFF" />
            <ThemedText style={styles.createTopButtonText}>{showCreate ? 'Close' : 'New'}</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <ThemedText style={styles.metricLabel}>Total</ThemedText>
            <ThemedText style={styles.metricValue}>{summary.total}</ThemedText>
          </View>
          <View style={styles.metricCard}>
            <ThemedText style={styles.metricLabel}>Submitted</ThemedText>
            <ThemedText style={styles.metricValue}>{summary.submitted}</ThemedText>
          </View>
          <View style={styles.metricCard}>
            <ThemedText style={styles.metricLabel}>Reviewed</ThemedText>
            <ThemedText style={styles.metricValue}>{summary.reviewed}</ThemedText>
          </View>
          <View style={styles.metricCard}>
            <ThemedText style={styles.metricLabel}>Finalized</ThemedText>
            <ThemedText style={styles.metricValue}>{summary.finalized}</ThemedText>
          </View>
        </View>

        <View style={styles.filterRow}>
          {STATUS_OPTIONS.map((status) => {
            const active = selectedStatus === status;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedStatus(status)}
              >
                <ThemedText style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {status === 'all' ? 'All' : prettyStatus(status)}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterRow}>
          {(['all', 'due_today', 'overdue'] as AssessmentFocus[]).map((focus) => {
            const active = selectedFocus === focus;
            const label = focus === 'all' ? 'All dates' : focus === 'due_today' ? 'Due today' : 'Overdue';
            return (
              <TouchableOpacity
                key={focus}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedFocus(focus)}
              >
                <ThemedText style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {hasDrillDownFilters ? (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.filterChip}
              testID="assessments-clear-drilldown-filters"
              onPress={() => {
                setSelectedFocus('all');
                setSelectedDateWindow('all');
                setSelectedCompetencyId(null);
                setSelectedCompetencyTitle(null);
                setSelectedProgramId(null);
                setSelectedProgramTitle(null);
                setSelectedParticipantUserId(null);
                setSelectedParticipantName(null);
                setDateFromOverride(null);
                setDateToOverride(null);
                router.replace(buildClearDrillDownHref(params) as any);
              }}
            >
              <ThemedText style={styles.filterChipText}>Clear drill-down filters</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {(['all', 'last_7_days', 'last_30_days', 'last_8_weeks', 'custom'] as AssessmentDateWindow[]).map((windowKey) => {
            const active = selectedDateWindow === windowKey;
            const label = windowKey === 'all'
              ? 'Any window'
              : windowKey === 'last_7_days'
                ? 'Last 7 days'
                : windowKey === 'last_30_days'
                  ? 'Last 30 days'
                  : windowKey === 'last_8_weeks'
                    ? 'Last 8 weeks'
                    : 'Custom window';
            return (
              <TouchableOpacity
                key={windowKey}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  setSelectedDateWindow(windowKey);
                  if (windowKey !== 'custom') {
                    setDateFromOverride(null);
                    setDateToOverride(null);
                  }
                }}
              >
                <ThemedText style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedCompetencyId ? (
          <View style={styles.filterRow}>
            <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]}>
              <ThemedText style={[styles.filterChipText, styles.filterChipTextActive]}>
                Competency: {competencyTitleById[selectedCompetencyId] || selectedCompetencyTitle || selectedCompetencyId}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => {
                setSelectedCompetencyId(null);
                setSelectedCompetencyTitle(null);
              }}
            >
              <ThemedText style={styles.filterChipText}>Clear competency</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedProgramId ? (
          <View style={styles.filterRow}>
            <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]}>
              <ThemedText style={[styles.filterChipText, styles.filterChipTextActive]}>
                Program: {selectedProgramTitle || programById.get(selectedProgramId)?.title || selectedProgramId}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => {
                setSelectedProgramId(null);
                setSelectedProgramTitle(null);
              }}
            >
              <ThemedText style={styles.filterChipText}>Clear program</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedParticipantUserId ? (
          <View style={styles.filterRow}>
            <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]}>
              <ThemedText style={[styles.filterChipText, styles.filterChipTextActive]}>
                Learner: {selectedParticipantName || selectedParticipantUserId}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => {
                setSelectedParticipantUserId(null);
                setSelectedParticipantName(null);
              }}
            >
              <ThemedText style={styles.filterChipText}>Clear learner</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        {showCreate ? (
          <View style={styles.createCard}>
            <ThemedText style={styles.createTitle}>New assessment</ThemedText>

            <ThemedText style={styles.fieldLabel}>Assessment template</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionChip, !selectedTemplateId && styles.optionChipActive]}
                onPress={() => applyAssessmentTemplate(null)}
              >
                <ThemedText style={[styles.optionChipText, !selectedTemplateId && styles.optionChipTextActive]}>
                  None
                </ThemedText>
              </TouchableOpacity>
              {assessmentTemplates.map((row) => {
                const active = selectedTemplateId === row.id;
                return (
                  <TouchableOpacity
                    key={row.id}
                    style={[styles.optionChip, active && styles.optionChipActive]}
                    onPress={() => applyAssessmentTemplate(row)}
                  >
                    <ThemedText style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                      {row.title}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ThemedText style={styles.fieldLabel}>Program</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionChip, !newProgramId && styles.optionChipActive]}
                onPress={() => {
                  setNewProgramId(null);
                  setNewSessionId(null);
                  setNewParticipantId(null);
                }}
              >
                <ThemedText style={[styles.optionChipText, !newProgramId && styles.optionChipTextActive]}>Unlinked</ThemedText>
              </TouchableOpacity>
              {programs.map((row) => {
                const active = newProgramId === row.id;
                return (
                  <TouchableOpacity
                    key={row.id}
                    style={[styles.optionChip, active && styles.optionChipActive]}
                    onPress={() => {
                      setNewProgramId(row.id);
                      setNewSessionId(null);
                      setNewParticipantId(null);
                    }}
                  >
                    <ThemedText style={[styles.optionChipText, active && styles.optionChipTextActive]}>{row.title}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ThemedText style={styles.fieldLabel}>Session</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionChip, !newSessionId && styles.optionChipActive]}
                onPress={() => setNewSessionId(null)}
              >
                <ThemedText style={[styles.optionChipText, !newSessionId && styles.optionChipTextActive]}>None</ThemedText>
              </TouchableOpacity>
              {sessionOptions.map((row) => {
                const active = newSessionId === row.id;
                return (
                  <TouchableOpacity
                    key={row.id}
                    style={[styles.optionChip, active && styles.optionChipActive]}
                    onPress={() => setNewSessionId(row.id)}
                  >
                    <ThemedText style={[styles.optionChipText, active && styles.optionChipTextActive]}>{row.title}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ThemedText style={styles.fieldLabel}>Participant</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionChip, !newParticipantId && styles.optionChipActive]}
                onPress={() => setNewParticipantId(null)}
              >
                <ThemedText style={[styles.optionChipText, !newParticipantId && styles.optionChipTextActive]}>None</ThemedText>
              </TouchableOpacity>
              {participantOptions.map((row) => {
                const active = newParticipantId === row.id;
                const label = row.display_name || row.email || row.role;
                return (
                  <TouchableOpacity
                    key={row.id}
                    style={[styles.optionChip, active && styles.optionChipActive]}
                    onPress={() => setNewParticipantId(row.id)}
                  >
                    <ThemedText style={[styles.optionChipText, active && styles.optionChipTextActive]}>{label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ThemedText style={styles.fieldLabel}>Status</ThemedText>
            <View style={styles.inlineRow}>
              {(['draft', 'submitted', 'reviewed', 'finalized'] as AssessmentStatus[]).map((status) => {
                const active = newStatus === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setNewStatus(status)}
                  >
                    <ThemedText style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {prettyStatus(status)}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ThemedText style={styles.fieldLabel}>Score (optional)</ThemedText>
            <TextInput
              value={newScoreText}
              onChangeText={setNewScoreText}
              placeholder="e.g. 4.5"
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor="#94A3B8"
            />

            <ThemedText style={styles.fieldLabel}>Rubric level (optional)</ThemedText>
            <TextInput
              value={newRubricLevel}
              onChangeText={setNewRubricLevel}
              placeholder="e.g. Exceeds expectations"
              style={styles.input}
              placeholderTextColor="#94A3B8"
            />

            <ThemedText style={styles.fieldLabel}>Notes</ThemedText>
            <TextInput
              value={newNotes}
              onChangeText={setNewNotes}
              placeholder="Add assessment notes"
              multiline
              style={[styles.input, styles.notesInput]}
              placeholderTextColor="#94A3B8"
            />

            <ThemedText style={styles.fieldLabel}>Action plan (optional)</ThemedText>
            <TextInput
              value={newActionPlan}
              onChangeText={setNewActionPlan}
              placeholder="Next concrete steps for learner"
              multiline
              style={[styles.input, styles.notesInput]}
              placeholderTextColor="#94A3B8"
            />

            <ThemedText style={styles.fieldLabel}>Next check-in at (optional)</ThemedText>
            <TextInput
              value={newNextCheckInAt}
              onChangeText={setNewNextCheckInAt}
              placeholder="ISO date/time e.g. 2026-03-10T15:00:00Z"
              style={styles.input}
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.createActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetCreate} disabled={saving}>
                <ThemedText style={styles.secondaryButtonText}>Reset</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={submitCreate} disabled={saving}>
                <ThemedText style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Create assessment'}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color="#007AFF" />
            <ThemedText style={styles.emptyText}>Loading assessments...</ThemedText>
          </View>
        ) : recentRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={32} color="#94A3B8" />
            <ThemedText style={styles.emptyTitle}>No assessment records yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Records will appear here after faculty, preceptors, or coaches submit evaluations.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.listColumn}>
            {recentRecords.map((row) => {
              const program = row.program_id ? programById.get(row.program_id) : null;
              const session = row.session_id ? sessionById.get(row.session_id) : null;
              const participant = row.participant_id ? participantById.get(row.participant_id) : null;
              const participantLabel = participant?.display_name || participant?.email || null;
              const templateId = String((row.evidence as Record<string, unknown> | null)?.template_id || '');
              const template = templateId ? templateById.get(templateId) : null;
              const actionPlan = String((row.evidence as Record<string, unknown> | null)?.action_plan || '').trim();
              const nextCheckInAt = String((row.evidence as Record<string, unknown> | null)?.next_check_in_at || '').trim();

              return (
                <View key={row.id} style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    <ThemedText style={styles.recordStatus}>{prettyStatus(row.status)}</ThemedText>
                    <ThemedText style={styles.recordTime}>
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.recordTitle}>{program?.title || 'Unlinked program'}</ThemedText>
                  <ThemedText style={styles.recordMeta}>
                    {session?.title || 'No session'}
                    {participantLabel ? ` • ${participantLabel}` : ''}
                    {row.score !== null ? ` • Score ${row.score}` : ''}
                    {row.rubric_level ? ` • ${row.rubric_level}` : ''}
                    {template ? ` • ${template.title}` : ''}
                  </ThemedText>
                  {row.notes ? <ThemedText style={styles.recordNotes}>{row.notes}</ThemedText> : null}
                  {actionPlan ? <ThemedText style={styles.recordPlan}>Action plan: {actionPlan}</ThemedText> : null}
                  {nextCheckInAt ? <ThemedText style={styles.recordPlan}>Next check-in: {nextCheckInAt}</ThemedText> : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  subtitle: { color: '#64748B', fontSize: 13 },
  createTopButton: {
    borderRadius: 10,
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  createTopButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    minWidth: 130,
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 4,
  },
  metricLabel: { fontSize: 12, color: '#64748B' },
  metricValue: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#DBEAFE',
  },
  filterChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  filterChipTextActive: { color: '#1D4ED8' },
  createCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
  },
  createTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  fieldLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  optionRow: { gap: 8, paddingRight: 6 },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  optionChipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#DBEAFE',
  },
  optionChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  optionChipTextActive: { color: '#1D4ED8' },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 13,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  listColumn: { gap: 10 },
  recordCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 6,
  },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordStatus: { fontSize: 11, fontWeight: '700', color: '#334155' },
  recordTime: { fontSize: 11, color: '#64748B' },
  recordTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  recordMeta: { fontSize: 12, color: '#64748B' },
  recordNotes: { fontSize: 12, color: '#334155', lineHeight: 18 },
  recordPlan: { fontSize: 12, color: '#1E40AF', lineHeight: 18 },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
});
