import { NURSING_CORE_V1_CAPABILITIES } from '@/configs/competencies/nursing-core-v1';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { isUuid } from '@/utils/uuid';
import { formatDistanceToNow } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type ReviewStatus = 'requested' | 'in_review' | 'completed' | 'cancelled';

type ReviewRequestRow = {
  id: string;
  artifact_id: string;
  requester_user_id: string;
  coach_user_id: string | null;
  status: ReviewStatus;
  note: string | null;
  created_at: string;
};

type ArtifactContent = {
  toolValues?: Record<string,unknown>;
  notes?: string;
  mappedCompetencyIds?: string[];
};

type ArtifactRow = {
  artifact_id: string;
  module_id: string;
  event_type: string;
  event_id: string;
  user_id: string;
  content: ArtifactContent;
};

type EvaluationScore = {
  competencyId: string;
  level: string | number;
  strengths?: string[];
  improvements?: string[];
};

type EvaluationResult = {
  scores?: EvaluationScore[];
  nextAction?: string;
};

type EvaluationRow = {
  id: string;
  result: EvaluationResult;
  created_at: string;
};

const COMPETENCY_TITLE_BY_ID: Record<string,string> = NURSING_CORE_V1_CAPABILITIES.reduce((acc, item) => {
  acc[item.id] = item.title;
  return acc;
}, {} as Record<string,string>);

function toDisplayText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const entries = value.map((entry) => toDisplayText(entry)).filter((entry) => entry.length > 0);
    return entries.join(', ');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string,unknown>)
      .map(([k, v]) => {
        const text = toDisplayText(v);
        return text.length > 0 ? `${k}: ${text}` : '';
      })
      .filter(Boolean);
    return entries.join(' · ');
  }
  return '';
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export default function CoachArtifactReviewScreen() {
  const router = useRouter();
  const { artifactId } = useLocalSearchParams<{artifactId?: string}>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [notAssigned, setNotAssigned] = useState(false);

  const [requestRow, setRequestRow] = useState<ReviewRequestRow | null>(null);
  const [artifactRow, setArtifactRow] = useState<ArtifactRow | null>(null);
  const [evaluationRow, setEvaluationRow] = useState<EvaluationRow | null>(null);
  const [requesterLabel, setRequesterLabel] = useState<string>('');

  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  const mappedCompetencyLabels = useMemo(() => {
    const mappedIds = Array.isArray(artifactRow?.content?.mappedCompetencyIds)
      ? artifactRow?.content?.mappedCompetencyIds
      : [];
    return mappedIds.map((id) => COMPETENCY_TITLE_BY_ID[id] || id);
  }, [artifactRow]);

  const toolValueSections = useMemo(() => {
    const toolValues = artifactRow?.content?.toolValues || {};
    return Object.entries(toolValues)
      .map(([key, value]) => ({
        key,
        label: formatFieldLabel(key),
        value: toDisplayText(value),
      }))
      .filter((entry) => entry.value.length > 0);
  }, [artifactRow]);

  const scoreItems = useMemo(() => {
    const scores = Array.isArray(evaluationRow?.result?.scores) ? evaluationRow?.result?.scores : [];
    return scores.filter((score) => score && typeof score.competencyId === 'string');
  }, [evaluationRow]);

  const loadScreen = useCallback(async () => {
    if (!user?.id) {
      setErrorText('You must be signed in to review artifacts.');
      setLoading(false);
      return;
    }

    if (!artifactId || !isUuid(artifactId)) {
      setErrorText('Invalid artifact id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorText(null);
    setNotAssigned(false);

    try {
      const { data: requestData, error: requestError } = await supabase
        .from('betterat_artifact_review_requests')
        .select('id,artifact_id,requester_user_id,coach_user_id,status,note,created_at')
        .eq('artifact_id', artifactId)
        .eq('coach_user_id', user.id)
        .in('status', ['requested', 'in_review', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestError) {
        throw requestError;
      }

      if (!requestData) {
        setNotAssigned(true);
        setRequestRow(null);
        setArtifactRow(null);
        setEvaluationRow(null);
        setRequesterLabel('');
        return;
      }

      const request = requestData as ReviewRequestRow;
      setRequestRow(request);
      setNoteDraft(request.note || '');

      const { data: artifactData, error: artifactError } = await supabase
        .from('betterat_module_artifacts')
        .select('artifact_id,module_id,event_type,event_id,user_id,content')
        .eq('artifact_id', artifactId)
        .maybeSingle();

      if (artifactError) {
        throw artifactError;
      }

      setArtifactRow((artifactData as ArtifactRow | null) || null);

      const { data: evalRows, error: evalError } = await supabase
        .from('betterat_module_evaluations')
        .select('id,result,created_at')
        .eq('artifact_id', artifactId)
        .eq('prompt_version', 'v1')
        .eq('rubric_version', 'v1')
        .order('created_at', { ascending: false })
        .limit(1);

      if (evalError) {
        throw evalError;
      }

      setEvaluationRow((evalRows?.[0] as EvaluationRow | undefined) || null);

      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('id,full_name,email')
        .eq('id', request.requester_user_id)
        .maybeSingle();

      if (!userError && userRow) {
        const row = userRow as {id: string; full_name?: string | null; email?: string | null};
        setRequesterLabel(row.full_name || row.email || row.id);
      } else {
        setRequesterLabel(request.requester_user_id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load review.';
      setErrorText(message);
    } finally {
      setLoading(false);
    }
  }, [artifactId, user?.id]);

  useEffect(() => {
    loadScreen();
  }, [loadScreen]);

  const updateRequest = useCallback(async (updates: Partial<Pick<ReviewRequestRow,'status' | 'note'>>) => {
    if (!requestRow || !user?.id) return;

    const { data, error } = await supabase
      .from('betterat_artifact_review_requests')
      .update(updates)
      .eq('id', requestRow.id)
      .eq('coach_user_id', user.id)
      .select('id,artifact_id,requester_user_id,coach_user_id,status,note,created_at')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Not assigned. Unable to update this review request.');
    }

    const updated = data as ReviewRequestRow;
    setRequestRow(updated);
    if (typeof updated.note === 'string') {
      setNoteDraft(updated.note);
    }
  }, [requestRow, user?.id]);

  const handleStartReview = useCallback(async () => {
    if (!requestRow || requestRow.status !== 'requested') return;

    setUpdatingStatus(true);
    setErrorText(null);
    try {
      await updateRequest({ status: 'in_review' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start review.';
      setErrorText(message);
    } finally {
      setUpdatingStatus(false);
    }
  }, [requestRow, updateRequest]);

  const validateAttemptsForArtifact = useCallback(async () => {
    if (!artifactId || !isUuid(artifactId)) return;

    let updates: Record<string,unknown> = {
      status: 'validated',
      validated_at: new Date().toISOString(),
    };
    const filters: { column: string; value: string }[] = [
      { column: 'artifact_id', value: artifactId },
      { column: 'status', value: 'unvalidated' },
      { column: 'clinical_context', value: 'clinical_reasoning_feedback' },
    ];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      let query = supabase
        .from('betterat_competency_attempts')
        .update(updates);

      for (const filter of filters) {
        query = query.eq(filter.column, filter.value);
      }

      const { error } = await query;
      if (!error) return;
      if (!isMissingSupabaseColumn(error)) {
        throw error;
      }

      const message = String(error.message || '');
      let changed = false;
      for (const key of ['validated_at', 'status']) {
        if (message.includes(`betterat_competency_attempts.${key}`) && key in updates) {
          const nextUpdates = { ...updates };
          delete nextUpdates[key];
          updates = nextUpdates;
          changed = true;
        }
      }
      for (const key of ['artifact_id', 'status', 'clinical_context']) {
        if (message.includes(`betterat_competency_attempts.${key}`)) {
          const nextFilters = filters.filter((filter) => filter.column !== key);
          if (nextFilters.length !== filters.length) {
            filters = nextFilters;
            changed = true;
          }
        }
      }

      if (!changed) {
        throw error;
      }
    }

    throw new Error('Could not validate competency attempts after schema fallback retries.');
  }, [artifactId]);

  const handleMarkCompleted = useCallback(async () => {
    if (!requestRow) return;
    if (requestRow.status !== 'in_review') {
      setErrorText('Start review before marking this request as completed.');
      return;
    }

    setUpdatingStatus(true);
    setErrorText(null);
    setValidationWarning(null);
    try {
      await updateRequest({ status: 'completed' });
      if ((artifactRow?.module_id || '') === 'clinical_reasoning') {
        try {
          await validateAttemptsForArtifact();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Attempt validation failed.';
          setValidationWarning(`Review completed, but attempt validation failed: ${message}`);
          return;
        }
      }
      router.push('/coach/artifact-queue');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete review.';
      setErrorText(message);
    } finally {
      setUpdatingStatus(false);
    }
  }, [artifactRow?.module_id, requestRow, router, updateRequest, validateAttemptsForArtifact]);

  const handleSaveNote = useCallback(async () => {
    if (!requestRow) return;

    setSavingNote(true);
    setErrorText(null);
    try {
      await updateRequest({ note: noteDraft.trim() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save note.';
      setErrorText(message);
    } finally {
      setSavingNote(false);
    }
  }, [noteDraft, requestRow, updateRequest]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0A66C2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/coach/artifact-queue')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Clinical Reasoning</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {errorText ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        ) : null}

        {notAssigned ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Not assigned</Text>
            <Text style={styles.emptyText}>This artifact is not currently assigned to you.</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Request</Text>
              <Text style={styles.metaText}>Requester: {requesterLabel || requestRow?.requester_user_id || 'Unknown'}</Text>
              <Text style={styles.metaText}>
                Requested {requestRow?.created_at ? formatDistanceToNow(new Date(requestRow.created_at), { addSuffix: true }) : 'recently'}
              </Text>
              <Text style={styles.metaText}>Status: {requestRow?.status || 'unknown'}</Text>
              {requestRow?.status === 'requested' ? (
                <Text style={styles.metaText}>Next step: start review to unlock completion.</Text>
              ) : null}
              {requestRow?.status === 'completed' ? (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>Completed</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Artifact Summary</Text>
              <Text style={styles.metaText}>Module: {artifactRow?.module_id || 'clinical_reasoning'}</Text>
              <Text style={styles.metaText}>Event: {artifactRow?.event_type || '-'} / {artifactRow?.event_id || '-'}</Text>

              {mappedCompetencyLabels.length > 0 ? (
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>Maps to</Text>
                  {mappedCompetencyLabels.map((label) => (
                    <Text key={label} style={styles.bulletLine}>• {label}</Text>
                  ))}
                </View>
              ) : null}

              {toolValueSections.length > 0 ? (
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>Tool Values</Text>
                  {toolValueSections.map((entry) => (
                    <View key={entry.key} style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{entry.label}</Text>
                      <Text style={styles.fieldValue}>{entry.value}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.subsection}>
                  <Text style={styles.fieldValue}>No structured tool values found.</Text>
                </View>
              )}

              {typeof artifactRow?.content?.notes === 'string' && artifactRow.content.notes.trim().length > 0 ? (
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>Notes</Text>
                  <Text style={styles.fieldValue}>{artifactRow.content.notes}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Evaluation</Text>
              {scoreItems.length === 0 ? (
                <Text style={styles.fieldValue}>No evaluation found for v1 rubric.</Text>
              ) : (
                scoreItems.map((score, index) => (
                  <View key={`${score.competencyId}-${index}`} style={styles.scoreBlock}>
                    <Text style={styles.scoreTitle}>
                      {COMPETENCY_TITLE_BY_ID[score.competencyId] || score.competencyId}
                    </Text>
                    <Text style={styles.metaText}>Level: {String(score.level)}</Text>
                    {(score.improvements || []).slice(0, 2).map((item, improvementIndex) => (
                      <Text key={`${score.competencyId}-improvement-${improvementIndex}`} style={styles.bulletLine}>• {item}</Text>
                    ))}
                  </View>
                ))
              )}

              {typeof evaluationRow?.result?.nextAction === 'string' && evaluationRow.result.nextAction.trim().length > 0 ? (
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>Next action</Text>
                  <Text style={styles.fieldValue}>{evaluationRow.result.nextAction}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Coach Actions</Text>
              {validationWarning ? (
                <Text style={styles.warningText}>{validationWarning}</Text>
              ) : null}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton, (updatingStatus || requestRow?.status !== 'requested') && styles.disabledButton]}
                  onPress={handleStartReview}
                  disabled={updatingStatus || requestRow?.status !== 'requested'}
                >
                  <Text style={styles.secondaryButtonText}>Start review</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton, (updatingStatus || requestRow?.status !== 'in_review') && styles.disabledButton]}
                  onPress={handleMarkCompleted}
                  disabled={updatingStatus || requestRow?.status !== 'in_review'}
                >
                  <Text style={styles.primaryButtonText}>Mark completed</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.noteInput}
                multiline
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="Add coach note"
                placeholderTextColor="#98A2B3"
              />

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, savingNote && styles.disabledButton]}
                onPress={handleSaveNote}
                disabled={savingNote}
              >
                <Text style={styles.secondaryButtonText}>{savingNote ? 'Saving…' : 'Save note'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 14,
    color: '#0A66C2',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 12,
    padding: 14,
  },
  errorCard: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: '#B42318',
    fontSize: 13,
  },
  warningText: {
    color: '#B54708',
    fontSize: 13,
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subsection: {
    marginTop: 10,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#475467',
    marginBottom: 2,
  },
  fieldRow: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    color: '#101828',
    lineHeight: 20,
  },
  bulletLine: {
    fontSize: 13,
    color: '#344054',
    marginBottom: 3,
    lineHeight: 18,
  },
  scoreBlock: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0A66C2',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    minHeight: 88,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    color: '#101828',
    textAlignVertical: 'top',
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  completedBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#A4BCFD',
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3538CD',
  },
});
