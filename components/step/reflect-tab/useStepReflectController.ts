import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useInterest } from '@/providers/InterestProvider';
import { settleStepAndPlaceBeforeNow } from '@/services/TimelineStepService';
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
  autoTagAndWriteStepCapabilityEvidence,
  buildCapabilityEvidenceRows,
  fetchOwnerOrgCompetencies,
} from '@/services/CapabilityEvidenceService';
import { suggestCapabilityTags } from '@/services/CapabilityTagService';
import { extractInsightsFromStepReflection } from '@/services/AIMemoryService';
import { useAIUsage } from '@/hooks/useAIUsage';
import { useCompetenciesForInterest, useOwnerOrgCompetencies } from '@/hooks/useCompetencies';
import { dropInsight } from '@/services/QuickCaptureService';
import { showAlert, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { addConceptTrailQuote, getStepConceptLinks } from '@/services/PlaybookService';
import { supabase } from '@/services/supabase';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import type {
  CapabilityEvidenceRow,
  CapabilitySuggestState,
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
  seedSuggestion?: string;
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
  capabilitySuggestState: CapabilitySuggestState;
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
  capabilityPickerVisible: boolean;
  capabilityPickerInterestId: string | null;
  /** Org competency framework (org_competencies) the program grades against —
      surfaced at the top of the picker so the learner tags the right set. */
  orgCompetencySuggestions: { id: string; label: string; source?: string }[];
  onCloseCapabilityPicker: () => void;
  onPickCompetency: (competencyId: string, title: string) => void;
  onPickCapabilityLabel: (label: string) => void;
  onSuggestCapabilities: () => Promise<void>;
  onMarkFieldAsConceptSeed: (id: ReflectFieldId) => Promise<void>;
  onAnswerConceptPrompt: (conceptId: string, answer: boolean) => void;
  stepId: string;
  conceptInterestId: string | null;
  onConceptsChanged: () => void;
  onSettle: () => Promise<void>;
}

export interface UseStepReflectControllerInput {
  stepId: string;
  readOnly?: boolean;
  onGoToDo?: () => void;
  onNextStepCreated?: (newStepId: string) => void;
  /**
   * Fired once the step has settled. Carries the id of the step that was just
   * completed (settling re-sorts the timeline and the surface's live stepId can
   * drift to a neighbour, so the celebration must pin to this snapshot) plus the
   * next pending step in the same interest (or null when none) so the surface
   * can offer a "take a beat" hinge inside the celebration instead of a toast.
   */
  onSettled?: (info: { completedStepId: string; nextStepId: string | null }) => void;
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

function captureSnippets(act: StepActData): string[] {
  return [
    ...(act.observations ?? []).map((row) => row.text),
    ...(act.media_uploads ?? []).map((row) => row.caption),
    ...(act.media_links ?? []).map((row) => row.caption),
  ]
    .map((text) => text?.trim())
    .filter((text): text is string => Boolean(text))
    .slice(0, 4);
}

function reflectionTextFromFields(fields: ReflectQuestionField[]): string {
  return fields
    .map((field) => field.value.trim())
    .filter(Boolean)
    .join('\n');
}

function mergeCapabilityRows(
  base: CapabilityEvidenceRow[],
  incoming: CapabilityEvidenceRow[],
): CapabilityEvidenceRow[] {
  const present = new Set(base.map((row) => row.capabilityName.trim().toLowerCase()));
  const merged = [...base];
  for (const row of incoming) {
    const key = row.capabilityName.trim().toLowerCase();
    if (present.has(key)) continue;
    present.add(key);
    merged.push(row);
  }
  return merged;
}

function buildReviewFromFields(
  current: StepMetadata,
  fields: ReflectQuestionField[],
): StepReviewData {
  let working: StepMetadata = { ...current };
  for (const field of fields) {
    const review = FLAT_REVIEW_FIELDS.has(field.id)
      ? buildReviewWithFlatField(
          working,
          field.id as 'key_takeaway' | 'teaching',
          field.value,
        )
      : buildReviewWithSection(working, field.id, field.value);
    working = { ...working, review };
  }
  return (working.review ?? {}) as StepReviewData;
}

function buildSeedForField(
  id: ReflectFieldId,
  plan: StepPlanData,
  act: StepActData,
  capturesCount: number,
): string | undefined {
  const snippets = captureSnippets(act);
  const firstCapture = snippets[0];
  if (id === 'what_worked' && firstCapture) {
    return `Your captures mention: ${firstCapture}`;
  }
  if (id === 'what_didnt') {
    const capability = plan.capability_goals?.[0];
    if (capability) {
      return `${capability} has ${capturesCount} capture${capturesCount === 1 ? '' : 's'} so far — use that to decide what still needs practice.`;
    }
    if (capturesCount > 0) {
      return `${capturesCount} capture${capturesCount === 1 ? '' : 's'} from Do can point to the area that needs another rep.`;
    }
  }
  if (id === 'key_takeaway') {
    const doneSubStep = plan.how_sub_steps?.find((row) => row.completed)?.text?.trim();
    const firstSubStep = plan.how_sub_steps?.find((row) => row.text.trim())?.text?.trim();
    const source = doneSubStep || firstSubStep;
    if (source) return `Your plan centered on: ${source}`;
  }
  if (id === 'teaching') {
    const where = plan.where_location?.name?.trim();
    if (where && capturesCount > 0) {
      return `Your ${capturesCount} capture${capturesCount === 1 ? '' : 's'} at ${where} are the evidence to ask a learner to show.`;
    }
    if (capturesCount > 0) {
      return `Your ${capturesCount} capture${capturesCount === 1 ? '' : 's'} from Do are the evidence to ask a learner to show.`;
    }
  }
  return undefined;
}

export function useStepReflectController({
  stepId,
  readOnly,
  onSettled,
}: UseStepReflectControllerInput): StepReflectControllerView {
  const { data: step, isLoading } = useStepDetail(stepId);
  const updateMetadata = useUpdateStepMetadata(stepId);
  const queryClient = useQueryClient();
  const { currentInterest, allInterests } = useInterest();
  const aiUsage = useAIUsage();
  const [synthesisState, setSynthesisState] = useState<ReflectSynthesisState>('idle');
  const [activeFieldId, setActiveFieldId] = useState<ReflectFieldId | undefined>('what_worked');
  const [showAnythingElse, setShowAnythingElse] = useState(false);
  const [draftedFieldIds, setDraftedFieldIds] = useState<Set<ReflectFieldId>>(() => new Set());
  const [localFields, setLocalFields] = useState<Partial<Record<ReflectFieldId, string>>>({});
  const [localCapabilities, setLocalCapabilities] = useState<CapabilityEvidenceRow[] | null>(null);
  const [showCapabilityPicker, setShowCapabilityPicker] = useState(false);
  const [capabilitySuggestState, setCapabilitySuggestState] = useState<CapabilitySuggestState>('idle');
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
  const stepInterest = useMemo(
    () => allInterests.find((interest) => interest.id === step?.interest_id) ?? null,
    [allInterests, step?.interest_id],
  );
  const config = getInterestReflectTabConfig({
    interestId: step?.interest_id ?? currentInterest?.id,
    interestName: stepInterest?.name ?? currentInterest?.name,
    interestSlug: stepInterest?.slug ?? currentInterest?.slug,
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
        id: 'what_worked',
        prompt: config.questionPair[0],
        value: localFields.what_worked ?? serverWorked,
        seedSuggestion: buildSeedForField('what_worked', planData, actData, capturesCount),
        isDrafted: draftedFieldIds.has('what_worked'),
      },
      {
        id: 'what_didnt',
        prompt: config.questionPair[1],
        value: localFields.what_didnt ?? serverDidnt,
        seedSuggestion: buildSeedForField('what_didnt', planData, actData, capturesCount),
        isDrafted: draftedFieldIds.has('what_didnt'),
      },
    ];
    const anythingValue = localFields.anything_else ?? serverAnything;
    if (showAnythingElse || anythingValue.trim()) {
      nextFields.push({
        id: 'anything_else',
        prompt: 'Anything else?',
        value: anythingValue,
        seedSuggestion: buildSeedForField('anything_else', planData, actData, capturesCount),
        isDrafted: draftedFieldIds.has('anything_else'),
      });
    }
    // Key takeaway sits second-to-last — it distills everything above it —
    // then the teaching-transfer prompt closes the reflection.
    nextFields.push({
      id: 'key_takeaway',
      prompt: config.keyTakeawayPrompt ?? 'Key takeaway — the one thing to remember',
      value: localFields.key_takeaway ?? serverKeyTakeaway,
      seedSuggestion: buildSeedForField('key_takeaway', planData, actData, capturesCount),
      isDrafted: draftedFieldIds.has('key_takeaway'),
    });
    nextFields.push({
      id: 'teaching',
      prompt: config.teachingPrompt ?? TEACHING_PROMPT,
      value: localFields.teaching ?? serverTeaching,
      seedSuggestion: buildSeedForField('teaching', planData, actData, capturesCount),
      isDrafted: draftedFieldIds.has('teaching'),
    });
    return nextFields;
  }, [
    config.questionPair,
    config.keyTakeawayPrompt,
    config.teachingPrompt,
    planData,
    actData,
    capturesCount,
    draftedFieldIds,
    localFields,
    serverAnything,
    serverDidnt,
    serverWorked,
    serverKeyTakeaway,
    serverTeaching,
    showAnythingElse,
  ]);

  // competency_ids hold betterat_competencies UUIDs; resolve them to titles
  // so the panel shows "Customer discovery & interviews", not a raw UUID.
  const { data: interestCompetencies = [] } = useCompetenciesForInterest(
    step?.interest_id ?? undefined,
  );
  const competencyNameById = useMemo(
    () => new Map(interestCompetencies.map((c) => [c.id, c.title])),
    [interestCompetencies],
  );
  // The program's own competency framework (org_competencies) — the exact set
  // the org admin's rollup grades. Surface it in the picker so an institutional
  // learner tags against it instead of guessing free-text labels.
  const { data: orgCompetencies = [] } = useOwnerOrgCompetencies(
    step?.user_id,
    step?.interest_id,
  );
  const orgCompetencySuggestions = useMemo(
    () =>
      orgCompetencies.map((c) => {
        const label = (c.fullLabel || c.shortLabel).trim();
        const short = c.shortLabel.trim();
        return {
          id: `org:${c.id}`,
          label: label || short || 'Competency',
          source: short && short !== label ? short : undefined,
        };
      }),
    [orgCompetencies],
  );
  const orgCompetencyNameById = useMemo(
    () => new Map(orgCompetencies.map((c) => [c.id, c.fullLabel || c.shortLabel || c.id])),
    [orgCompetencies],
  );
  const seededCapabilities = useMemo(
    () =>
      buildCapabilityEvidenceRows({
        plan: planData,
        act: actData,
        review: reviewData,
        competencyNameById,
        orgCompetencyNameById,
      }),
    [planData, actData, reviewData, competencyNameById, orgCompetencyNameById],
  );
  const capabilities = localCapabilities ?? seededCapabilities;
  const state: ReflectPhase4State =
    step?.status === 'settled' || step?.status === 'completed'
      ? 'settled'
      : settling
        ? 'settling'
        : 'ready';

  const flushField = useCallback(
    (id: ReflectFieldId, value: string) => {
      if (readOnly) return;
      const current = metadataRef.current;
      const nextReview = FLAT_REVIEW_FIELDS.has(id)
        ? buildReviewWithFlatField(current, id as 'key_takeaway' | 'teaching', value)
        : buildReviewWithSection(current, id, value);
      updateMetadata.mutate(
        { review: nextReview },
        {
          // The L3/L4 librarian card's reflection-cadence signal reads
          // review off the timeline-steps list. The shared metadata
          // mutation only patches the detail cache (it warns metadata
          // isn't in the list), so refresh the list here on a reflect
          // write — debounced, so this is per-pause, not per-keystroke.
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
          },
        },
      );
    },
    [readOnly, updateMetadata, queryClient],
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
    if (readOnly) return;
    setShowCapabilityPicker(true);
  }, [readOnly]);

  const manualRow = useCallback(
    (capabilityId: string, capabilityName: string): CapabilityEvidenceRow => ({
      capabilityId,
      capabilityName,
      confirmed: true,
      strength: 'worth-noting',
      pipLevel: 2,
      evidenceCount: capturesCount,
      source: 'manual',
    }),
    [capturesCount],
  );

  const onPickCompetency = useCallback(
    (competencyId: string, title: string) => {
      setLocalCapabilities((current) => {
        const rows = current ?? seededCapabilities;
        if (rows.some((row) => row.capabilityId === competencyId)) {
          return rows.filter((row) => row.capabilityId !== competencyId);
        }
        return [...rows, manualRow(competencyId, title)];
      });
    },
    [manualRow, seededCapabilities],
  );

  const onPickCapabilityLabel = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      setLocalCapabilities((current) => {
        const rows = current ?? seededCapabilities;
        if (rows.some((row) => row.capabilityName.trim().toLowerCase() === key)) {
          return rows.filter((row) => row.capabilityName.trim().toLowerCase() !== key);
        }
        // capability_id is free-text for label-only capabilities — same
        // convention plan.capability_goals rows use in buildCapabilityEvidenceRows.
        return [...rows, manualRow(trimmed, trimmed)];
      });
    },
    [manualRow, seededCapabilities],
  );

  const onSuggestCapabilities = useCallback(async () => {
    if (readOnly || capabilitySuggestState === 'loading') return;
    if (!aiUsage.canUse('capability_tagging')) {
      showAlertWithButtons(
        'Monthly AI limit reached',
        "You've used all your free AI capability suggestions this month. Upgrade for unlimited AI coaching.",
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/subscription') },
        ],
      );
      return;
    }
    setCapabilitySuggestState('loading');
    try {
      const base = localCapabilities ?? seededCapabilities;
      const interestId = step?.interest_id ?? currentInterest?.id ?? null;
      const orgCompetencies = step?.user_id
        ? await fetchOwnerOrgCompetencies(step.user_id, interestId)
        : [];
      const suggestions = await suggestCapabilityTags({
        interestId,
        captures: captureSnippets(actData),
        reflection: reflectionTextFromFields(fields),
        existingNames: base.map((row) => row.capabilityName),
        capturesCount,
        orgCompetencies,
      });
      aiUsage.refresh();
      if (suggestions.length > 0) {
        setLocalCapabilities(mergeCapabilityRows(base, suggestions));
      }
    } finally {
      setCapabilitySuggestState('done');
    }
  }, [
    readOnly,
    capabilitySuggestState,
    localCapabilities,
    seededCapabilities,
    fields,
    step?.interest_id,
    step?.user_id,
    currentInterest?.id,
    actData,
    capturesCount,
    aiUsage,
  ]);

  const onMarkFieldAsConceptSeed = useCallback(async (id: ReflectFieldId) => {
    if (!step || readOnly) return;
    const field = fields.find((item) => item.id === id);
    const content = field?.value.trim();
    if (!content) return;
    try {
      await dropInsight({
        userId: step.user_id,
        interestId: step.interest_id,
        payload: { kind: 'text', content },
      });
      showAlert('Saved to Playbook', 'Concept seed added to Recent insights.');
      router.push('/(tabs)/library' as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save concept seed.';
      showAlert('Save failed', message);
    }
  }, [fields, readOnly, step]);

  const onAnswerConceptPrompt = useCallback((conceptId: string, answer: boolean) => {
    setConceptPrompts((current) =>
      current.map((prompt) => prompt.conceptId === conceptId ? { ...prompt, answer } : prompt),
    );
  }, []);

  // Loads the step's linked concepts into the Yes/No prompts. Exposed so the
  // reflect surface can re-run it after the user adds/removes links via the
  // ConceptLinkSheet, preserving any answers already given.
  const loadConceptPrompts = useCallback(async () => {
    if (!stepId) return;
    try {
      const links = await getStepConceptLinks(stepId);
      const conceptIds = links.map((link) => link.concept_id);
      if (conceptIds.length === 0) {
        setConceptPrompts([]);
        return;
      }
      const { data } = await supabase
        .from('playbook_concepts')
        .select('id,title')
        .in('id', conceptIds);
      setConceptPrompts((prev) => {
        const prevById = new Map(prev.map((p) => [p.conceptId, p]));
        return (data ?? []).map((concept: any) => ({
          conceptId: concept.id,
          title: concept.title,
          answer: prevById.get(concept.id)?.answer ?? null,
        }));
      });
    } catch {
      // Leave the current prompts in place on a transient fetch failure.
    }
  }, [stepId]);

  useEffect(() => {
    void loadConceptPrompts();
  }, [loadConceptPrompts]);

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
      }
      const review = buildReviewFromFields(metadataRef.current, fields);
      const updatedStep = await updateMetadata.mutateAsync({ review });
      const canTagWithAI = aiUsage.canUse('capability_tagging');
      const stepWithReview = {
        ...updatedStep,
        metadata: {
          ...((updatedStep.metadata ?? {}) as StepMetadata),
          review,
        },
      };
      if (canTagWithAI) {
        void extractInsightsFromStepReflection(
          stepWithReview.user_id,
          stepWithReview.interest_id,
          stepWithReview,
        );
      }
      const capabilityRowsToWrite = await autoTagAndWriteStepCapabilityEvidence({
        step: stepWithReview,
        baseRows: capabilities,
        canUseAI: canTagWithAI,
      });
      if (canTagWithAI) aiUsage.refresh();
      setLocalCapabilities(capabilityRowsToWrite);
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
      await settleStepAndPlaceBeforeNow(stepId);
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps', 'detail', stepId] });
      // The proven/evidence signal on the L3 librarian card reads
      // step_capability_evidence via useStepCapabilityEvidence; refresh it
      // so freshly auto-tagged rows light the card without a relaunch. Also
      // refresh the Atlas Capabilities ring and org competency rollup, which
      // read the same evidence (matching useRecordCompetencyEvidence).
      queryClient.invalidateQueries({ queryKey: ['step-capability-evidence'] });
      queryClient.invalidateQueries({ queryKey: ['interest-capability-coverage'] });
      queryClient.invalidateQueries({ queryKey: ['viewer-org-competency-evidence'] });

      let nextStepId: string | null = null;
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
          nextStepId = (nextRow as { id?: string } | null)?.id ?? null;
        } catch {
          // Best-effort: if the next-step lookup fails, leave the hinge absent.
        }
      }

      // The settle is the signature beat — hand it to the surface so it can
      // raise the step-complete celebration (which folds in the "take a beat"
      // hinge to the next step) instead of a transient toast.
      onSettled?.({ completedStepId: stepId, nextStepId });
    } finally {
      setSettling(false);
    }
  }, [step, readOnly, fields, stepId, updateMetadata, capabilities, actData.observations, actData.media_uploads, queryClient, conceptPrompts, onSettled, aiUsage]);

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
      capabilitySuggestState,
      conceptPrompts,
      saveEnabled: !readOnly && state !== 'settled' && fields.some((field) => field.value.trim()),
      disabledHint: 'Answer one question or hold to speak',
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
      capabilityPickerVisible: showCapabilityPicker,
      capabilityPickerInterestId: step?.interest_id ?? currentInterest?.id ?? null,
      orgCompetencySuggestions,
      onCloseCapabilityPicker: () => setShowCapabilityPicker(false),
      onPickCompetency,
      onPickCapabilityLabel,
      onSuggestCapabilities,
      onMarkFieldAsConceptSeed,
      onAnswerConceptPrompt,
      stepId,
      conceptInterestId: step?.interest_id ?? currentInterest?.id ?? null,
      onConceptsChanged: () => void loadConceptPrompts(),
      onSettle,
    },
    isSettling: settling,
  };
}
