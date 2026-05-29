import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useUpdateStep } from '@/hooks/useTimelineSteps';
import { useInterest } from '@/providers/InterestProvider';
import {
  getInterestReflectTabConfig,
  type InterestReflectTabConfig,
} from '@/lib/interest-config';
import {
  REVIEW_PROMPT_LABELS,
  type ReviewSectionPrompt,
  getReviewSectionContent,
  getReviewSections,
} from '@/lib/step/getReviewSections';
import { draftReflectSynthesis } from '@/services/SynthesisService';
import {
  buildCapabilityEvidenceRows,
  writeStepCapabilityEvidence,
} from '@/services/CapabilityEvidenceService';
import { dropInsight } from '@/services/QuickCaptureService';
import { addConceptTrailQuote, getStepConceptLinks } from '@/services/PlaybookService';
import { supabase } from '@/services/supabase';
import { encodeHingeId } from '@/services/HingeBuildService';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import type {
  CapabilityEvidenceRow,
  EvidenceStrength,
} from './CapabilitiesPracticed';
import type {
  StepActData,
  StepMetadata,
  StepPlanData,
  StepReviewData,
  StepReviewSection,
} from '@/types/step-detail';

const SAVE_DEBOUNCE_MS = 500;

export type ReflectFieldId =
  | 'what_worked'
  | 'what_didnt'
  | 'anything_else'
  | 'key_takeaway'
  | 'teaching';

// Fields that live as flat columns on review (not prompt-keyed sections[]).
const FLAT_REVIEW_FIELDS: ReadonlySet<ReflectFieldId> = new Set<ReflectFieldId>([
  'key_takeaway',
  'teaching',
]);

const TEACHING_PROMPT =
  'If you taught this to someone else, how would you do it — and what evidence would you ask them to show?';
export type ReflectSynthesisState = 'idle' | 'drafting' | 'drafted' | 'dismissed';
export type ReflectPhase4State = 'ready' | 'settling' | 'settled';

export interface ReflectQuestionField {
  id: ReflectFieldId;
  prompt: string;
  value: string;
  isDrafted?: boolean;
}

export interface Phase4ReflectViewProps {
  config: InterestReflectTabConfig;
  state: ReflectPhase4State;
  capturesCount: number;
  fields: ReflectQuestionField[];
  activeFieldId?: ReflectFieldId;
  synthesisState: ReflectSynthesisState;
  capabilities: CapabilityEvidenceRow[];
  conceptPrompts: {
    conceptId: string;
    title: string;
    answer: boolean | null;
  }[];
  saveEnabled: boolean;
  disabledHint: string;
  readOnly?: boolean;
  onDismissSynthesis: () => void;
  onDraftSynthesis: () => Promise<string>;
  onChangeField: (id: ReflectFieldId, value: string, options?: { drafted?: boolean }) => void;
  onFocusField: (id: ReflectFieldId) => void;
  onSpawnAnythingElseField: () => ReflectFieldId;
  onTranscript: (id: string, text: string) => void;
  onToggleCapability: (id: string) => void;
  onChangeCapabilityStrength: (id: string, strength: EvidenceStrength) => void;
  onAddCapability: () => void;
  onMarkFieldAsConceptSeed: (id: ReflectFieldId) => Promise<void>;
  onAnswerConceptPrompt: (conceptId: string, answer: boolean) => void;
  onSettle: () => Promise<void>;
}

export interface UseStepReflectControllerInput {
  stepId: string;
  readOnly?: boolean;
  onGoToDo?: () => void;
  onNextStepCreated?: (newStepId: string) => void;
}

export interface StepReflectControllerView {
  loading: boolean;
  missing: boolean;
  reflectViewProps: Phase4ReflectViewProps;
  isSettling: boolean;
}

function promptForField(id: ReflectFieldId): ReviewSectionPrompt {
  if (id === 'what_worked') return 'what_worked';
  if (id === 'what_didnt') return 'what_didnt';
  return 'anything_else';
}

function buildReviewWithSection(
  current: StepMetadata,
  id: ReflectFieldId,
  content: string,
): StepReviewData {
  const review = (current.review ?? {}) as StepReviewData;
  const prompt = promptForField(id);
  const existing = Array.isArray(review.sections) ? review.sections : [];
  const filtered = existing.filter(
    (section) => !(section.prompt === prompt && section.source === 'in_app'),
  );
  const trimmed = content.trim();
  const sections: StepReviewSection[] = trimmed
    ? [
        ...filtered,
        {
          prompt,
          prompt_label: REVIEW_PROMPT_LABELS[prompt],
          content,
          source: 'in_app',
          captured_at: new Date().toISOString(),
        },
      ]
    : filtered;

  const nextReview: StepReviewData = {
    ...review,
    sections,
    composed_via: 'in_app',
    composed_at: review.composed_at ?? new Date().toISOString(),
    overall_rating: undefined,
  };

  const writable = nextReview as StepReviewData & {
    what_worked?: string;
    what_didnt?: string;
    feedback_visibility?: string;
  };
  if (id === 'what_worked') writable.what_worked = content;
  if (id === 'what_didnt') writable.what_didnt = content;
  if (id === 'what_worked') writable.what_learned = content;
  if (id === 'what_didnt') writable.deviation_reason = content;
  if (id === 'anything_else') writable.next_step_notes = content;
  writable.feedback_visibility = 'private';

  return nextReview;
}

function buildReviewWithFlatField(
  current: StepMetadata,
  id: 'key_takeaway' | 'teaching',
  content: string,
): StepReviewData {
  const review = (current.review ?? {}) as StepReviewData;
  const trimmed = content.trim();
  const value = trimmed.length > 0 ? content : undefined;
  if (id === 'key_takeaway') return { ...review, key_takeaway: value };
  return { ...review, teaching_reflection: value };
}

function getCaptureCount(act: StepActData): number {
  return (
    (act.observations?.length ?? 0) +
    (act.media_uploads?.length ?? 0) +
    (act.media_links?.length ?? 0)
  );
}

export function useStepReflectController({
  stepId,
  readOnly,
}: UseStepReflectControllerInput): StepReflectControllerView {
  const { data: step, isLoading } = useStepDetail(stepId);
  const updateMetadata = useUpdateStepMetadata(stepId);
  const updateStep = useUpdateStep();
  const queryClient = useQueryClient();
  const { currentInterest } = useInterest();
  const [synthesisState, setSynthesisState] = useState<ReflectSynthesisState>('idle');
  const [activeFieldId, setActiveFieldId] = useState<ReflectFieldId | undefined>('what_worked');
  const [showAnythingElse, setShowAnythingElse] = useState(false);
  const [draftedFieldIds, setDraftedFieldIds] = useState<Set<ReflectFieldId>>(() => new Set());
  const [localFields, setLocalFields] = useState<Partial<Record<ReflectFieldId, string>>>({});
  const [localCapabilities, setLocalCapabilities] = useState<CapabilityEvidenceRow[] | null>(null);
  const [settling, setSettling] = useState(false);
  const [conceptPrompts, setConceptPrompts] = useState<{ conceptId: string; title: string; answer: boolean | null }[]>([]);
  const timersRef = useRef<Partial<Record<ReflectFieldId, ReturnType<typeof setTimeout>>>>({});

  const metadata = useMemo(() => (step?.metadata ?? {}) as StepMetadata, [step?.metadata]);
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;
  const planData = useMemo(() => metadata.plan ?? {}, [metadata.plan]) as StepPlanData;
  const actData = useMemo(() => metadata.act ?? {}, [metadata.act]) as StepActData;
  const reviewData = useMemo(() => metadata.review ?? {}, [metadata.review]) as StepReviewData;

  const normalized = useMemo(
    () => getReviewSections(metadata, step?.completed_at ?? step?.updated_at ?? null),
    [metadata, step?.completed_at, step?.updated_at],
  );
  const config = getInterestReflectTabConfig({
    interestId: step?.interest_id ?? currentInterest?.id,
    interestName: currentInterest?.name,
    interestSlug: currentInterest?.slug,
  });
  const capturesCount = getCaptureCount(actData);

  const serverWorked = getReviewSectionContent(normalized.sections, 'what_worked')
    ?? reviewData.what_learned
    ?? '';
  const serverDidnt = getReviewSectionContent(normalized.sections, 'what_didnt')
    ?? reviewData.deviation_reason
    ?? '';
  const serverAnything = getReviewSectionContent(normalized.sections, 'anything_else')
    ?? reviewData.next_step_notes
    ?? '';
  const serverKeyTakeaway = reviewData.key_takeaway ?? '';
  const serverTeaching = reviewData.teaching_reflection ?? '';

  const fields: ReflectQuestionField[] = useMemo(() => {
    const nextFields: ReflectQuestionField[] = [
      {
        id: 'key_takeaway',
        prompt: 'Key takeaway — the one thing to remember',
        value: localFields.key_takeaway ?? serverKeyTakeaway,
        isDrafted: draftedFieldIds.has('key_takeaway'),
      },
      {
        id: 'what_worked',
        prompt: config.questionPair[0],
        value: localFields.what_worked ?? serverWorked,
        isDrafted: draftedFieldIds.has('what_worked'),
      },
      {
        id: 'what_didnt',
        prompt: config.questionPair[1],
        value: localFields.what_didnt ?? serverDidnt,
        isDrafted: draftedFieldIds.has('what_didnt'),
      },
    ];
    const anythingValue = localFields.anything_else ?? serverAnything;
    if (showAnythingElse || anythingValue.trim()) {
      nextFields.push({
        id: 'anything_else',
        prompt: 'Anything else?',
        value: anythingValue,
        isDrafted: draftedFieldIds.has('anything_else'),
      });
    }
    nextFields.push({
      id: 'teaching',
      prompt: TEACHING_PROMPT,
      value: localFields.teaching ?? serverTeaching,
      isDrafted: draftedFieldIds.has('teaching'),
    });
    return nextFields;
  }, [
    config.questionPair,
    draftedFieldIds,
    localFields,
    serverAnything,
    serverDidnt,
    serverWorked,
    serverKeyTakeaway,
    serverTeaching,
    showAnythingElse,
  ]);

  const seededCapabilities = useMemo(
    () => buildCapabilityEvidenceRows({ plan: planData, act: actData, review: reviewData }),
    [planData, actData, reviewData],
  );
  const capabilities = localCapabilities ?? seededCapabilities;
  const state: ReflectPhase4State =
    step?.status === 'settled' || step?.status === 'completed'
      ? 'settled'
      : settling || updateStep.isPending
        ? 'settling'
        : 'ready';

  const flushField = useCallback(
    (id: ReflectFieldId, value: string) => {
      if (readOnly) return;
      const current = metadataRef.current;
      const nextReview = FLAT_REVIEW_FIELDS.has(id)
        ? buildReviewWithFlatField(current, id as 'key_takeaway' | 'teaching', value)
        : buildReviewWithSection(current, id, value);
      updateMetadata.mutate({ review: nextReview });
    },
    [readOnly, updateMetadata],
  );

  const onChangeField = useCallback(
    (id: ReflectFieldId, value: string, options?: { drafted?: boolean }) => {
      if (readOnly) return;
      setLocalFields((current) => ({ ...current, [id]: value }));
      if (options?.drafted) {
        setDraftedFieldIds((current) => new Set(current).add(id));
      } else {
        setDraftedFieldIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
      const existing = timersRef.current[id];
      if (existing) clearTimeout(existing);
      timersRef.current[id] = setTimeout(() => {
        delete timersRef.current[id];
        flushField(id, value);
      }, SAVE_DEBOUNCE_MS);
    },
    [flushField, readOnly],
  );

  const onDraftSynthesis = useCallback(async () => {
    if (!step || readOnly) return '';
    setSynthesisState('drafting');
    setActiveFieldId('what_worked');
    const draft = await draftReflectSynthesis({
      stepTitle: step.title ?? 'Untitled step',
      interestName: currentInterest?.name,
      plan: planData,
      act: actData,
    });
    setLocalFields((current) => ({ ...current, what_worked: draft }));
    setDraftedFieldIds((current) => new Set(current).add('what_worked'));
    const existing = timersRef.current.what_worked;
    if (existing) {
      clearTimeout(existing);
      delete timersRef.current.what_worked;
    }
    flushField('what_worked', draft);
    setSynthesisState('drafted');
    return draft;
  }, [step, readOnly, currentInterest?.name, planData, actData, flushField]);

  const onSpawnAnythingElseField = useCallback((): ReflectFieldId => {
    setShowAnythingElse(true);
    setActiveFieldId('anything_else');
    return 'anything_else';
  }, []);

  const onTranscript = useCallback(
    (id: string, text: string) => {
      const fieldId = id as ReflectFieldId;
      const current = fields.find((field) => field.id === fieldId)?.value ?? '';
      const next = [current.trim(), text.trim()].filter(Boolean).join('\n');
      onChangeField(fieldId, next);
    },
    [fields, onChangeField],
  );

  const onToggleCapability = useCallback((id: string) => {
    setLocalCapabilities((current) =>
      (current ?? seededCapabilities).map((row) =>
        row.capabilityId === id ? { ...row, confirmed: !row.confirmed } : row,
      ),
    );
  }, [seededCapabilities]);

  const onChangeCapabilityStrength = useCallback((id: string, strength: EvidenceStrength) => {
    setLocalCapabilities((current) =>
      (current ?? seededCapabilities).map((row) =>
        row.capabilityId === id
          ? {
              ...row,
              strength,
              pipLevel: strength === 'strong' ? 5 : strength === 'material' ? 3 : 2,
            }
          : row,
      ),
    );
  }, [seededCapabilities]);

  const onAddCapability = useCallback(() => {
    setLocalCapabilities((current) => {
      const rows = current ?? seededCapabilities;
      if (rows.some((row) => row.capabilityId === 'reflect-added-capability')) return rows;
      return [
        ...rows,
        {
          capabilityId: 'reflect-added-capability',
          capabilityName: 'Reflective judgment',
          confirmed: true,
          strength: 'worth-noting',
          pipLevel: 2,
          evidenceCount: capturesCount,
        },
      ];
    });
  }, [capturesCount, seededCapabilities]);

  const onMarkFieldAsConceptSeed = useCallback(async (id: ReflectFieldId) => {
    if (!step || readOnly) return;
    const field = fields.find((item) => item.id === id);
    const content = field?.value.trim();
    if (!content) return;
    await dropInsight({
      userId: step.user_id,
      interestId: step.interest_id,
      payload: { kind: 'text', content },
    });
    router.push('/(tabs)/library' as any);
  }, [fields, readOnly, step]);

  const onAnswerConceptPrompt = useCallback((conceptId: string, answer: boolean) => {
    setConceptPrompts((current) =>
      current.map((prompt) => prompt.conceptId === conceptId ? { ...prompt, answer } : prompt),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!stepId) return undefined;
    (async () => {
      try {
        const links = await getStepConceptLinks(stepId);
        const conceptIds = links.map((link) => link.concept_id);
        if (conceptIds.length === 0) {
          if (!cancelled) setConceptPrompts([]);
          return;
        }
        const { data } = await supabase
          .from('playbook_concepts')
          .select('id,title')
          .in('id', conceptIds);
        if (!cancelled) {
          setConceptPrompts(
            (data ?? []).map((concept: any) => ({
              conceptId: concept.id,
              title: concept.title,
              answer: null,
            })),
          );
        }
      } catch {
        if (!cancelled) setConceptPrompts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stepId]);

  const onSettle = useCallback(async () => {
    if (!step || readOnly) return;
    setSettling(true);
    try {
      for (const field of fields) {
        const timer = timersRef.current[field.id];
        if (timer) {
          clearTimeout(timer);
          delete timersRef.current[field.id];
        }
        flushField(field.id, field.value);
      }
      await writeStepCapabilityEvidence({ stepId, rows: capabilities });
      const observations = actData.observations ?? [];
      const uploads = actData.media_uploads ?? [];
      const firstObservation = observations[0]?.text?.trim();
      const firstUploadCaption = uploads[0]?.caption?.trim();
      const fallbackQuote = firstObservation || firstUploadCaption || step.title || 'Untitled step';
      await Promise.all(
        conceptPrompts
          .filter((prompt) => prompt.answer)
          .map((prompt) =>
            addConceptTrailQuote({
              conceptId: prompt.conceptId,
              captureId: observations[0]?.id ?? uploads[0]?.id ?? stepId,
              quoteText: fallbackQuote,
              sourceLabel: `${step.title} · Reflect`,
            }).catch(() => undefined),
          ),
      );
      await updateStep.mutateAsync({ stepId, input: { status: 'settled' } });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });

      if (FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER && step.user_id && step.interest_id) {
        try {
          const { data: nextRow } = await supabase
            .from('timeline_steps')
            .select('id')
            .eq('user_id', step.user_id)
            .eq('interest_id', step.interest_id)
            .in('status', ['pending', 'in_progress'])
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          const nextStepId = (nextRow as { id?: string } | null)?.id;
          if (nextStepId) {
            router.push(`/practice/hinges/${encodeHingeId(stepId, nextStepId)}` as any);
          }
        } catch {
          // Best-effort: if the next-step lookup fails, leave the user on Reflect.
        }
      }
    } finally {
      setSettling(false);
    }
  }, [step, readOnly, fields, flushField, stepId, capabilities, updateStep, queryClient, actData.observations, actData.media_uploads, conceptPrompts]);

  return {
    loading: isLoading,
    missing: !isLoading && !step,
    reflectViewProps: {
      config,
      state,
      capturesCount,
      fields,
      activeFieldId,
      synthesisState,
      capabilities,
      conceptPrompts,
      saveEnabled: !readOnly && state !== 'settled',
      disabledHint: 'Write a line or hold to speak',
      readOnly,
      onDismissSynthesis: () => setSynthesisState('dismissed'),
      onDraftSynthesis,
      onChangeField,
      onFocusField: setActiveFieldId,
      onSpawnAnythingElseField,
      onTranscript,
      onToggleCapability,
      onChangeCapabilityStrength,
      onAddCapability,
      onMarkFieldAsConceptSeed,
      onAnswerConceptPrompt,
      onSettle,
    },
    isSettling: settling || updateStep.isPending,
  };
}
