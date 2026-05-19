/**
 * StepCritiqueContent — Post-session reflection matching the Pencil Critique Tab design.
 *
 * Sections (top → bottom):
 *   1. Auto-save indicator
 *   2. Overall Rating — star rating with descriptive label
 *   3. Skill Progress — per-capability dot rating + progress bar
 *   4. Your Work — media thumbnails from act phase
 *   5. What went well? — green thumbs-up prompt
 *   6. What to improve? — coral target prompt
 *   7. AI Feedback — session analysis card with suggestion pill
 *   8. Save Review / Share with Coach buttons
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useUpdateStep } from '@/hooks/useTimelineSteps';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { createStep } from '@/services/TimelineStepService';
import { generateCritiqueInsight, gatherEnrichedContext } from '@/services/ai/StepPlanAIService';
import { markLessonCompleted } from '@/services/LibraryService';
import { syncStepReviewRatings } from '@/services/SkillGoalService';
import * as competencyService from '@/services/competencyService';
import { useCompetenciesForInterest } from '@/hooks/useCompetencies';
import { useQueryClient } from '@tanstack/react-query';
import type { StepReviewData, StepActData, StepPlanData, StepMetadata, BrainDumpData } from '@/types/step-detail';
import type { Competency } from '@/types/competency';
import {
  getReviewSections,
  getReviewSectionContent,
  REVIEW_PROMPTS,
  REVIEW_PROMPT_LABELS,
  type ReviewSectionPrompt,
} from '@/lib/step/getReviewSections';
import { ReviewPromptSection } from '@/components/step/ReviewPromptSection';
import { STEP_PALETTE } from '@/lib/step-theme';
import { ShareStepSheet } from '@/components/step/ShareStepSheet';
import { InstructorAssessmentSection } from '@/components/step/InstructorAssessmentSection';
import { MeasurementReview } from '@/components/step/MeasurementReview';
import { NutritionReview } from '@/components/step/NutritionReview';
import { extractMeasurements, getMeasurementHistory, type MeasurementHistorySummary } from '@/services/MeasurementExtractionService';
import { extractNutritionToStep } from '@/services/ai/NutritionExtractionService';
import { extractCompetencyAssessment } from '@/services/ai/CompetencyExtractionService';
import { PlaybookAIService } from '@/services/ai/PlaybookAIService';
import { getActiveConversation, completeConversation } from '@/services/AIConversationService';
import { extractInsights } from '@/services/AIMemoryService';
import { getDailyTargets } from '@/services/NutritionService';
import type { NutritionTargets } from '@/types/nutrition';

// ---------------------------------------------------------------------------
// After tab palette — neutralized to match the redesign (no green/coral/gold).
// Re-maps the legacy semantic keys onto STEP_PALETTE so every reference in
// this file picks up the new tones without touching every call site.
// See docs/audit/visual-redesign-gap-step-detail.md §2.4.
// ---------------------------------------------------------------------------
const C = {
  pageBg: STEP_PALETTE.bgPrimary,
  cardBg: STEP_PALETTE.bgPrimary,
  cardBorder: STEP_PALETTE.borderTertiary,
  sectionLabel: STEP_PALETTE.textTertiary,
  labelDark: STEP_PALETTE.textPrimary,
  labelMid: STEP_PALETTE.textSecondary,
  labelLight: STEP_PALETTE.textTertiary,
  // `accent`, `coral`, `gold` used to carry forest-green / warm-coral / amber
  // hues — now collapsed onto charcoal so prompts, stars, and target chevrons
  // read as quiet typography instead of chromatic accents.
  accent: STEP_PALETTE.textPrimary,
  accentGlow: STEP_PALETTE.bgSecondary,
  coral: STEP_PALETTE.textPrimary,
  gold: STEP_PALETTE.textPrimary,
  dotInactive: STEP_PALETTE.bgSecondary,
  suggestionBg: STEP_PALETTE.bgSecondary,
  badgeBg: STEP_PALETTE.bgSecondary,
  badgeText: STEP_PALETTE.textTertiary,
  radius: 12,
  radiusLg: 16,
} as const;

// ---------------------------------------------------------------------------
// Rating labels
// ---------------------------------------------------------------------------
const RATING_LABELS = [
  '',
  'Struggled today',
  'Below average',
  'Good — Making progress',
  'Great session',
  'Outstanding!',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: string }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

/** 5 stars — filled up to `value` */
function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={s.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={6}>
          <Ionicons
            name="star"
            size={36}
            color={i <= value ? C.gold : C.labelLight}
          />
        </Pressable>
      ))}
    </View>
  );
}

/** Dot rating (1-5 filled circles) */
function DotRating({
  value,
  color,
  onChange,
}: {
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={s.dotRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={6}>
          <View
            style={[
              s.dot,
              { backgroundColor: i <= value ? color : C.dotInactive },
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

/** Horizontal progress bar */
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={s.progressBarTrack}>
      <View style={[s.progressBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Instructor "Suggest Next Step" sub-component
// ---------------------------------------------------------------------------

function InstructorSuggestNext({
  stepId,
  existingSuggestion,
}: {
  stepId: string;
  existingSuggestion?: string;
}) {
  const updateMetadata = useUpdateStepMetadata(stepId);
  const { data: step } = useStepDetail(stepId);
  const [suggestion, setSuggestion] = useState(existingSuggestion ?? '');
  const [saved, setSaved] = useState(Boolean(existingSuggestion));

  const handleSave = useCallback(() => {
    if (!suggestion.trim() || !step) return;
    const metadata = (step.metadata ?? {}) as any;
    updateMetadata.mutate(
      {
        review: {
          ...(metadata.review ?? {}),
          instructor_suggested_next: suggestion.trim(),
        },
      },
      { onSuccess: () => setSaved(true) },
    );
  }, [suggestion, step, updateMetadata]);

  return (
    <View style={s.sectionWrap}>
      <SectionLabel>SUGGEST NEXT STEP</SectionLabel>
      <TextInput
        style={s.inputBox}
        value={suggestion}
        onChangeText={(text) => { setSuggestion(text); setSaved(false); }}
        placeholder="Suggest what the student should work on next..."
        placeholderTextColor={C.labelLight}
        multiline
        textAlignVertical="top"
      />
      {suggestion.trim() && !saved && (
        <Pressable style={s.suggestSaveButton} onPress={handleSave}>
          <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />
          <Text style={s.suggestSaveText}>Save Suggestion</Text>
        </Pressable>
      )}
      {saved && (
        <View style={s.suggestSavedBadge}>
          <Ionicons name="checkmark-circle" size={14} color={C.accent} />
          <Text style={s.suggestSavedText}>Suggestion saved — student will see this</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface StepCritiqueContentProps {
  stepId: string;
  onNextStepCreated?: (newStepId: string) => void;
  readOnly?: boolean;
}

export function StepCritiqueContent({ stepId, onNextStepCreated, readOnly }: StepCritiqueContentProps) {
  const { data: step } = useStepDetail(stepId);
  const updateMetadata = useUpdateStepMetadata(stepId);
  const updateStep = useUpdateStep();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const queryClient = useQueryClient();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const [playbookIngesting, setPlaybookIngesting] = useState(false);

  const metadata = React.useMemo(
    () => (step?.metadata ?? {}) as StepMetadata,
    [step?.metadata],
  );
  const planData: StepPlanData = React.useMemo(() => metadata.plan ?? {}, [metadata.plan]);
  const actData: StepActData = React.useMemo(() => metadata.act ?? {}, [metadata.act]);
  const reviewData: StepReviewData = React.useMemo(
    () => metadata.review ?? {},
    [metadata.review],
  );
  // Step A (read-side compat): normalized view of review across v1 flat fields
  // and v2 sections[]. Seed effect below reads from this, so once Step B starts
  // dual-writing sections[], the Critique tab will pick up the v2 shape with no
  // further changes. For current production rows (v1 only) the synthesized
  // sections content equals the flat-field strings, so behavior is identical.
  const normalizedReview = React.useMemo(
    () => getReviewSections(step?.metadata, step?.completed_at ?? step?.updated_at ?? null),
    [step?.metadata, step?.completed_at, step?.updated_at],
  );

  // Local state
  const [overallRating, setOverallRating] = useState(0);
  const [localWentWell, setLocalWentWell] = useState('');
  const [localToImprove, setLocalToImprove] = useState('');
  const [localNextNotes, setLocalNextNotes] = useState('');
  const [localCapabilityRatings, setLocalCapabilityRatings] = useState<Record<string, number>>({});
  const [lastSavedLabel, setLastSavedLabel] = useState('');
  const [measurementHistory, setMeasurementHistory] = useState<MeasurementHistorySummary | undefined>();
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets | undefined>();

  // Load measurement history and nutrition targets
  useEffect(() => {
    if (!user?.id || !step?.interest_id) return;
    getMeasurementHistory(user.id, step.interest_id)
      .then(setMeasurementHistory)
      .catch(() => {});
    getDailyTargets(user.id, step.interest_id)
      .then(setNutritionTargets)
      .catch(() => {});
  }, [user?.id, step?.interest_id]);

  // Auto-complete any active train conversation and trigger extraction when Review tab mounts
  const extractionTriggeredRef = useRef(false);
  useEffect(() => {
    if (readOnly || extractionTriggeredRef.current || !user?.id || !step?.interest_id || !stepId) return;
    // Skip if we already have extracted data
    if (actData.measurements?.extracted?.length || actData.nutrition?.entries?.length) return;
    extractionTriggeredRef.current = true;

    (async () => {
      const conversation = await getActiveConversation(user.id, step.interest_id, 'train', stepId);
      if (!conversation || conversation.messages.length < 2) return;

      // Complete the conversation
      await completeConversation(conversation.id).catch(() => {});
      const completed = { ...conversation, messages: conversation.messages, status: 'completed' as const };

      // Trigger extractions in parallel
      const interestSlug = currentInterest?.slug;
      await Promise.allSettled([
        interestSlug
          ? extractMeasurements(user.id, step.interest_id, stepId, completed, interestSlug)
          : Promise.resolve(),
        extractNutritionToStep(user.id, step.interest_id, stepId, completed),
        extractInsights(user.id, step.interest_id, completed),
      ]);

      // Refetch step data so extracted results appear
      queryClient.invalidateQueries({ queryKey: ['timeline-steps', 'detail', stepId] });
    })();
    // queryClient is a stable singleton; intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, user?.id, step?.interest_id, stepId, actData.measurements, actData.nutrition, currentInterest?.slug]);

  // Competency assessment extraction — runs independently of conversation extraction
  const competencyExtractionRef = useRef(false);
  useEffect(() => {
    if (readOnly || competencyExtractionRef.current || !user?.id || !step?.interest_id || !stepId) return;
    if (!planData.competency_ids?.length && !planData.capability_goals?.length) return;
    // Skip if already assessed
    if (reviewData.competency_assessment?.assessed_at) {
      const age = Date.now() - new Date(reviewData.competency_assessment.assessed_at).getTime();
      if (age < 24 * 60 * 60 * 1000) return;
    }
    competencyExtractionRef.current = true;

    (async () => {
      const result = await extractCompetencyAssessment(
        user.id, step.interest_id, stepId, planData, actData,
        currentInterest?.name ?? '', reviewData.competency_assessment?.assessed_at,
      );
      if (result) {
        queryClient.invalidateQueries({ queryKey: ['timeline-steps', 'detail', stepId] });
      }
    })();
    // One-shot extraction gated by competencyExtractionRef; intentionally
    // reads stable-at-mount snapshots of planData/actData/reviewData.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, user?.id, step?.interest_id, stepId, planData.competency_ids, planData.capability_goals]);

  // Seed from server. Read prompt-keyed content through the selector so that
  // v2 sections[] take precedence when present (Step B+). For current v1 rows
  // the selector synthesizes sections from the flat fields, so this is a no-op.
  useEffect(() => {
    if (step && !initializedRef.current) {
      setOverallRating(reviewData.overall_rating ?? 0);
      setLocalWentWell(
        getReviewSectionContent(normalizedReview.sections, 'what_did_you_learn')
          ?? reviewData.what_learned
          ?? '',
      );
      setLocalToImprove(
        getReviewSectionContent(normalizedReview.sections, 'what_didnt')
          ?? reviewData.deviation_reason
          ?? '',
      );
      setLocalNextNotes(
        getReviewSectionContent(normalizedReview.sections, 'anything_else')
          ?? reviewData.next_step_notes
          ?? '',
      );
      setLocalCapabilityRatings(reviewData.capability_progress ?? {});
      initializedRef.current = true;
    }
    // One-shot seed gated by initializedRef; the reviewData/normalizedReview
    // dependencies are intentionally omitted so later writes don't clobber
    // local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const debouncedSaveReview = useCallback(
    (partial: Partial<StepReviewData>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const current = metadataRef.current;
        updateMetadata.mutate({ review: { ...(current.review ?? {}), ...partial } });
        setLastSavedLabel('Saved just now');
      }, 600);
    },
    [updateMetadata],
  );

  /**
   * Step Arch E — upsert a single `source: 'in_app'` section for the given
   * prompt. Replaces any prior in_app entry for that prompt (one editable
   * section per prompt); empty content removes the entry entirely. Bot
   * sections (source: 'telegram'/'voice'/etc.) are append-only and untouched.
   */
  const debouncedSaveSection = useCallback(
    (prompt: ReviewSectionPrompt, content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const current = metadataRef.current;
        const review = (current.review ?? {}) as StepReviewData;
        const existing = Array.isArray(review.sections) ? review.sections : [];
        const filtered = existing.filter(
          (s) => !(s && s.prompt === prompt && s.source === 'in_app'),
        );
        const trimmed = content.trim();
        const nextSections = trimmed.length > 0
          ? [
              ...filtered,
              {
                prompt,
                prompt_label: REVIEW_PROMPT_LABELS[prompt],
                content,
                source: 'in_app' as const,
                captured_at: new Date().toISOString(),
              },
            ]
          : filtered;
        const nextReview: StepReviewData = { ...review, sections: nextSections };
        if (typeof review.composed_at !== 'string') {
          nextReview.composed_at = new Date().toISOString();
        }
        nextReview.composed_via = 'in_app';
        updateMetadata.mutate({ review: nextReview });
        setLastSavedLabel('Saved just now');
      }, 600);
    },
    [updateMetadata],
  );

  // Handlers
  const handleOverallRating = useCallback(
    (value: number) => {
      setOverallRating(value);
      debouncedSaveReview({ overall_rating: value });
    },
    [debouncedSaveReview],
  );

  const handleWentWellChange = useCallback(
    (text: string) => {
      setLocalWentWell(text);
      debouncedSaveSection('what_did_you_learn', text);
    },
    [debouncedSaveSection],
  );

  const handleToImproveChange = useCallback(
    (text: string) => {
      setLocalToImprove(text);
      debouncedSaveSection('what_didnt', text);
    },
    [debouncedSaveSection],
  );

  const handleNextNotesChange = useCallback(
    (text: string) => {
      setLocalNextNotes(text);
      debouncedSaveSection('anything_else', text);
    },
    [debouncedSaveSection],
  );

  // Per-prompt render config for the canonical review-prompt loop.
  // Three prompts bind to legacy flat-field state + handlers (writes stay flat
  // until Step E flips to sections[]). The other two are read-only views over
  // captured sections from the bot/voice channels (Step B+).
  const promptRenderConfig: Record<
    ReviewSectionPrompt,
    {
      icon?: { name: React.ComponentProps<typeof Ionicons>['name']; color: string };
      editable?: { value: string; onChange: (next: string) => void; placeholder: string };
    }
  > = {
    what_happened: {},
    what_worked: {
      icon: { name: 'thumbs-up', color: C.accent },
    },
    what_didnt: {
      icon: { name: 'locate-outline', color: C.coral },
      editable: {
        value: localToImprove,
        onChange: handleToImproveChange,
        placeholder: 'Need to slow down on contour edges...',
      },
    },
    what_did_you_learn: {
      icon: { name: 'school-outline', color: C.accent },
      editable: {
        value: localWentWell,
        onChange: handleWentWellChange,
        placeholder: 'My line weight was much more consistent today...',
      },
    },
    anything_else: {
      editable: {
        value: localNextNotes,
        onChange: handleNextNotesChange,
        placeholder: 'What do you want to focus on next time?',
      },
    },
  };

  const handleCapabilityRating = useCallback(
    (goal: string, rating: number) => {
      setLocalCapabilityRatings((prev) => {
        const updated = { ...prev, [goal]: rating };
        debouncedSaveReview({ capability_progress: updated });
        return updated;
      });
    },
    [debouncedSaveReview],
  );

  // Sub-step summary
  const subSteps = planData.how_sub_steps ?? [];
  const subStepProgress = React.useMemo(
    () => actData.sub_step_progress ?? {},
    [actData.sub_step_progress],
  );
  const completedCount = subSteps.filter((ss) => subStepProgress[ss.id]).length;

  // Capability goals (free-text + structured competencies)
  const competencyIds = React.useMemo(
    () => planData.competency_ids ?? [],
    [planData.competency_ids],
  );
  const { data: allCompetencies } = useCompetenciesForInterest(step?.interest_id);
  const mappedCompetencies = React.useMemo(() => {
    if (!allCompetencies || competencyIds.length === 0) return [];
    return competencyIds
      .map((id) => allCompetencies.find((c: Competency) => c.id === id))
      .filter((c): c is Competency => Boolean(c));
  }, [allCompetencies, competencyIds]);
  // Merge structured competency titles into capability goals for the rating UI
  const structuredCompTitles = mappedCompetencies.map((c) => c.title);
  const capabilityGoals = [
    ...(planData.capability_goals ?? []),
    ...structuredCompTitles.filter((t) => !(planData.capability_goals ?? []).includes(t)),
  ];

  // Complete / save review
  const isSaving = playbookIngesting || updateStep.isPending;
  const handleSaveReview = useCallback(() => {
    if (playbookIngesting || updateStep.isPending) return;
    // Fire Playbook debrief ingest immediately — independent of the status update
    // so re-saving a completed step still triggers a fresh AI pass.
    setPlaybookIngesting(true);
    PlaybookAIService.ingestDebrief(stepId)
      .then(() => {
        // Auto-refresh suggestion counts so user sees new suggestions immediately
        queryClient.invalidateQueries({
          predicate: (query) => {
            const first = query.queryKey[0];
            return typeof first === 'string' && first.startsWith('playbook');
          },
        });
      })
      .catch((err) => {
        console.warn('[StepCritique] Playbook ingest-debrief failed:', err);
      })
      .finally(() => setPlaybookIngesting(false));
    updateStep.mutate(
      { stepId, input: { status: 'completed' } },
      {
        onSuccess: () => {
          const courseCtx = (step?.metadata as any)?.course_context;
          if (courseCtx?.resource_id && courseCtx?.lesson_id) {
            markLessonCompleted(courseCtx.resource_id, courseCtx.lesson_id).catch(() => {});
          }
          // Sync capability ratings to user skill goals
          const resolvedInterestId = step?.interest_id || currentInterest?.id;
          if (user?.id && resolvedInterestId && Object.keys(localCapabilityRatings).length > 0) {
            syncStepReviewRatings(user.id, resolvedInterestId, localCapabilityRatings).catch(() => {});
          }
          // Auto-log competency attempts for each mapped competency
          if (user?.id && mappedCompetencies.length > 0) {
            for (const comp of mappedCompetencies) {
              const dotRating = localCapabilityRatings[comp.title] ?? 0;
              const selfRating = dotRating >= 4 ? 'confident' : dotRating >= 3 ? 'proficient' : dotRating >= 2 ? 'developing' : 'needs_practice';
              competencyService.logAttempt(user.id, {
                competency_id: comp.id,
                self_rating: selfRating as any,
                self_notes: localWentWell || undefined,
                clinical_context: step?.title,
              }).catch((err) => console.warn('[StepCritique] Failed to log competency attempt:', err));
            }
          }
        },
      },
    );
  }, [stepId, updateStep, step, user?.id, currentInterest?.id, localCapabilityRatings, mappedCompetencies, localWentWell, playbookIngesting, queryClient]);

  const isCompleted = step?.status === 'completed';

  // --- AI Insight ---
  const [aiInsight, setAiInsight] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiInsight = useCallback(async () => {
    if (aiLoading || !user?.id || !step) return;
    setAiLoading(true);
    setAiInsight('');
    setAiSuggestion('');
    try {
      const resolvedInterestId = step.interest_id || currentInterest?.id;
      const enriched = resolvedInterestId
        ? await gatherEnrichedContext(user.id, resolvedInterestId)
        : { stepHistory: [], orgCompetencies: [], followedUsersActivity: [], orgPrograms: [], userCapabilityProgress: [], libraryResources: [] };

      // Fetch planned competency definitions for this step
      const plannedCompetencies = planData.competency_ids?.length && resolvedInterestId
        ? await competencyService.getCompetencies(resolvedInterestId)
            .then(all => all
              .filter(c => planData.competency_ids!.includes(c.id))
              .map(c => ({ id: c.id, title: c.title, category: c.category, description: c.description })))
            .catch(() => [])
        : [];

      // Summarize evidence for AI context
      const nutritionEntries = actData.nutrition?.entries ?? [];
      const actNutritionSummary = nutritionEntries.length
        ? `${nutritionEntries.length} entries, ~${nutritionEntries.reduce((sum, e) => sum + (e.calories ?? 0), 0)} cal`
        : undefined;

      const measurements = actData.measurements?.extracted ?? [];
      const actMeasurementSummary = measurements.length
        ? measurements.slice(0, 5).map(m => m.extracted_from_text || '').filter(Boolean).join('; ')
        : undefined;

      const text = await generateCritiqueInsight({
        interestName: currentInterest?.name || 'this interest',
        stepTitle: step.title,
        planWhat: planData.what_will_you_do ?? '',
        actNotes: actData.notes ?? '',
        subStepsCompleted: completedCount,
        subStepsTotal: subSteps.length,
        workedToPlan: null,
        deviationReason: localToImprove,
        whatLearned: localWentWell,
        capabilityRatings: localCapabilityRatings,
        stepHistory: enriched.stepHistory,
        plannedCompetencies,
        userCompetencyProgress: enriched.userCapabilityProgress,
        orgCompetencies: enriched.orgCompetencies,
        mediaUploads: actData.media_uploads?.map(m => ({ caption: m.caption, type: m.type })),
        actNutritionSummary,
        actMeasurementSummary,
        planCapabilityGoals: planData.capability_goals,
      });

      // Try to split out a suggestion line (last sentence starting with "Suggested" or "Try")
      const lines = text.split('\n').filter(Boolean);
      const suggestionIdx = lines.findIndex((l) => /^(Suggested|Try|Next:)/i.test(l.trim()));
      if (suggestionIdx >= 0) {
        setAiSuggestion(lines[suggestionIdx].trim());
        setAiInsight(lines.filter((_, i) => i !== suggestionIdx).join('\n'));
      } else {
        setAiInsight(text);
      }
    } catch {
      setAiInsight('Could not generate insight right now. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, user?.id, step, currentInterest, planData, actData, completedCount, subSteps.length, localToImprove, localWentWell, localCapabilityRatings]);

  // Auto-trigger AI insight when the tab is first opened and has content
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (!autoTriggeredRef.current && step && (localWentWell || localToImprove) && user?.id) {
      autoTriggeredRef.current = true;
      // Small delay to let the UI render first
      const t = setTimeout(handleAiInsight, 500);
      return () => clearTimeout(t);
    }
    // One-shot auto-trigger gated by autoTriggeredRef; handleAiInsight is
    // intentionally read at mount and not added to deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, localWentWell, localToImprove, user?.id]);

  // --- Share ---
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  // --- Create Next Step ---
  const [createdNextId, setCreatedNextId] = useState<string | null>(null);
  const [creatingNext, setCreatingNext] = useState(false);

  const handleCreateNextStep = useCallback(async () => {
    if (!user?.id || !step || createdNextId || creatingNext) return;
    setCreatingNext(true);
    try {
      const unfinished = (planData.how_sub_steps ?? [])
        .filter((ss) => !subStepProgress[ss.id])
        .map((ss) => ({ ...ss, completed: false }));
      const rawTitle = `Follow-up: ${step.title}`;
      const title = rawTitle.length > 60 ? rawTitle.slice(0, 57) + '...' : rawTitle;
      const nextPlan: StepPlanData = {
        what_will_you_do: (getReviewSectionContent(normalizedReview.sections, 'anything_else') ?? reviewData.next_step_notes ?? ''),
        how_sub_steps: unfinished,
        linked_resource_ids: planData.linked_resource_ids ?? [],
        capability_goals: planData.capability_goals ?? [],
      };
      const brainDump: BrainDumpData = {
        raw_text: (getReviewSectionContent(normalizedReview.sections, 'anything_else') ?? reviewData.next_step_notes ?? ''),
        extracted_urls: [],
        extracted_people: planData.who_collaborators ?? [],
        extracted_topics: planData.capability_goals ?? [],
        source_step_id: step.id,
        source_review_notes: (getReviewSectionContent(normalizedReview.sections, 'anything_else') ?? reviewData.next_step_notes ?? ''),
        created_at: new Date().toISOString(),
      };
      const created = await createStep({
        user_id: user.id,
        interest_id: step.interest_id,
        title,
        status: 'pending',
        source_type: 'manual',
        metadata: { plan: nextPlan, brain_dump: brainDump },
      });
      setCreatedNextId(created.id);
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      onNextStepCreated?.(created.id);
    } catch {
      setCreatingNext(false);
    }
  }, [user?.id, step, createdNextId, creatingNext, planData, subStepProgress, reviewData, normalizedReview.sections, queryClient, onNextStepCreated]);

  // Media from act phase
  const actMedia: string[] = (actData as any).media_urls ?? [];

  if (!step) return null;

  return (
    <View style={s.container}>
      {/* Auto-save indicator */}
      {lastSavedLabel !== '' && (
        <View style={s.autoSave}>
          <Ionicons name="cloud-outline" size={12} color={C.labelLight} />
          <Text style={s.autoSaveText}>{lastSavedLabel}</Text>
        </View>
      )}

      {/* ── OVERALL RATING ── */}
      <View style={s.sectionWrap}>
        <SectionLabel>OVERALL RATING</SectionLabel>
        <View style={s.overallCard}>
          <Text style={s.overallQuestion}>How did this session go?</Text>
          <StarRating value={overallRating} onChange={readOnly ? () => {} : handleOverallRating} />
          <Text style={s.overallLabel}>
            {RATING_LABELS[overallRating] || 'Tap a star to rate'}
          </Text>
        </View>
      </View>

      {/* ── SKILL PROGRESS ── */}
      {capabilityGoals.length > 0 && (
        <View style={s.sectionWrap}>
          <SectionLabel>SKILL PROGRESS</SectionLabel>
          {capabilityGoals.map((goal, idx) => {
            const rating = localCapabilityRatings[goal] ?? 0;
            const color = idx % 2 === 0 ? C.accent : C.coral;
            const hint =
              rating >= 3
                ? 'Improving steadily — good consistency'
                : rating > 0
                ? 'Needs work — keep practicing'
                : 'Rate your progress';
            return (
              <View key={goal} style={s.skillCard}>
                <View style={s.skillHeader}>
                  <Text style={s.skillName} numberOfLines={1}>{goal}</Text>
                  <DotRating
                    value={rating}
                    color={color}
                    onChange={readOnly ? () => {} : (v) => handleCapabilityRating(goal, v)}
                  />
                </View>
                <ProgressBar value={rating} max={5} color={color} />
                <Text style={s.skillHint}>{hint}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── YOUR WORK ── */}
      {actMedia.length > 0 && (
        <View style={s.sectionWrap}>
          <SectionLabel>YOUR WORK</SectionLabel>
          <View style={s.thumbRow}>
            {actMedia.slice(0, 2).map((url, i) => (
              <View key={url} style={s.thumb}>
                <Text style={s.thumbLabel}>Step {i + 1}</Text>
              </View>
            ))}
            <View style={[s.thumb, s.thumbAdd]}>
              <Ionicons name="add" size={24} color={C.accent} />
              <Text style={s.thumbAddLabel}>Add</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── SESSION DATA (AI-extracted measurements) ── */}
      {actData.measurements?.extracted?.length ? (
        <View style={s.sectionWrap}>
          <MeasurementReview
            measurements={actData.measurements}
            history={measurementHistory}
            readOnly={readOnly}
            onUpdate={(updated) => {
              if (readOnly) return;
              updateMetadata.mutate({
                act: {
                  measurements: {
                    ...actData.measurements!,
                    extracted: updated,
                  },
                },
              });
            }}
          />
        </View>
      ) : null}

      {/* ── SESSION NUTRITION (AI-extracted nutrition) ── */}
      {actData.nutrition?.entries?.length ? (
        <View style={s.sectionWrap}>
          <NutritionReview
            nutrition={actData.nutrition}
            targets={nutritionTargets}
            readOnly={readOnly}
            onUpdate={(updated) => {
              if (readOnly) return;
              updateMetadata.mutate({
                act: {
                  nutrition: {
                    ...actData.nutrition!,
                    entries: updated,
                  },
                },
              });
            }}
            onReExtract={readOnly ? undefined : async () => {
              if (!user?.id || !step?.interest_id || !stepId) return;
              // Fetch the conversation used for original extraction (or the latest completed one)
              const convId = actData.nutrition?.extraction_conversation_id;
              const conversation = convId
                ? await getActiveConversation(user.id, step.interest_id, 'train', stepId)
                : await getActiveConversation(user.id, step.interest_id, 'train', stepId);
              if (!conversation || conversation.messages.length < 2) return;
              const completed = { ...conversation, messages: conversation.messages, status: 'completed' as const };
              // Clear existing entries so extraction runs fresh
              await updateMetadata.mutateAsync({ act: { nutrition: { entries: [], last_extracted_at: undefined } } });
              // Re-run extraction with the now-higher max_tokens
              await extractNutritionToStep(user.id, step.interest_id, stepId, completed);
              queryClient.invalidateQueries({ queryKey: ['timeline-steps', 'detail', stepId] });
            }}
          />
        </View>
      ) : null}

      {/* ── REVIEW PROMPTS (canonical 5, dynamic) ──
          Captured sections (bot/voice) render as cards; three of the prompts
          also accept user edits that still write the legacy flat fields. Step E
          will flip writes to sections[] and retire the flat fields. */}
      {REVIEW_PROMPTS.map((prompt) => {
        const sectionsForPrompt = normalizedReview.sections.filter((sec) => sec.prompt === prompt);
        const promptCfg = promptRenderConfig[prompt];
        const editable = promptCfg.editable
          ? {
              value: promptCfg.editable.value,
              onChange: promptCfg.editable.onChange,
              placeholder: promptCfg.editable.placeholder,
              editable: !readOnly,
            }
          : undefined;
        return (
          <ReviewPromptSection
            key={prompt}
            prompt={prompt}
            label={REVIEW_PROMPT_LABELS[prompt]}
            sections={sectionsForPrompt}
            icon={promptCfg.icon}
            editable={editable}
          />
        );
      })}

      {/* ── AI FEEDBACK ── (hidden for read-only / non-owners) */}
      {!readOnly && (
        <View style={s.sectionWrap}>
          <SectionLabel>FEEDBACK</SectionLabel>
          {aiInsight ? (
            <View style={s.aiCard}>
              <View style={s.aiCardHeader}>
                <Ionicons name="sparkles" size={18} color={C.accent} />
                <Text style={s.aiCardTitle}>Session Analysis</Text>
              </View>
              <Text style={s.aiBody}>{aiInsight}</Text>
              {aiSuggestion !== '' && (
                <View style={s.aiSuggestionPill}>
                  <Ionicons name="bulb-outline" size={16} color={C.gold} />
                  <Text style={s.aiSuggestionText}>{aiSuggestion}</Text>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              style={[s.aiTrigger, aiLoading && { opacity: 0.7 }]}
              onPress={handleAiInsight}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <Ionicons name="sparkles" size={16} color={C.accent} />
              )}
              <Text style={s.aiTriggerText}>
                {aiLoading ? 'Analyzing...' : 'Analyze My Progress'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── COMPETENCY ASSESSMENT ── */}
      {reviewData.competency_assessment && (
        <View style={s.sectionWrap}>
          <SectionLabel>COMPETENCY ASSESSMENT</SectionLabel>
          <View style={s.aiCard}>
            {/* Planned competency results */}
            {reviewData.competency_assessment.planned_competency_results.map((item, idx) => {
              const levelColor = item.demonstrated_level === 'proficient' ? C.accent
                : item.demonstrated_level === 'developing' ? C.gold
                : item.demonstrated_level === 'initial_exposure' ? '#7C8BA1'
                : C.labelLight;
              const levelLabel = item.demonstrated_level === 'not_demonstrated' ? 'Not demonstrated'
                : item.demonstrated_level.replace('_', ' ');
              return (
                <View key={`planned-${idx}`} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <View style={{ backgroundColor: levelColor, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>{levelLabel}</Text>
                    </View>
                    <Text style={{ color: C.labelDark, fontSize: 14, fontWeight: '600', flex: 1 }}>{item.competency_title}</Text>
                  </View>
                  {item.evidence_basis ? (
                    <Text style={{ color: C.labelMid, fontSize: 12, marginLeft: 4 }}>{item.evidence_basis}</Text>
                  ) : null}
                  {item.advancement_suggestion ? (
                    <Text style={{ color: C.accent, fontSize: 12, marginLeft: 4, marginTop: 2 }}>Next: {item.advancement_suggestion}</Text>
                  ) : null}
                </View>
              );
            })}

            {/* Additional competencies found */}
            {(reviewData.competency_assessment.additional_competencies_found?.length ?? 0) > 0 && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.cardBorder }}>
                <Text style={{ color: C.labelMid, fontSize: 11, fontWeight: '600', marginBottom: 6 }}>ALSO DEMONSTRATED</Text>
                {reviewData.competency_assessment.additional_competencies_found.map((item, idx) => (
                  <View key={`extra-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="add-circle-outline" size={14} color={C.accent} />
                    <Text style={{ color: C.labelDark, fontSize: 13 }}>{item.competency_title}</Text>
                    <Text style={{ color: C.labelMid, fontSize: 11 }}>({item.demonstrated_level.replace('_', ' ')})</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Gap summary */}
            {reviewData.competency_assessment.gap_summary ? (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.cardBorder }}>
                <Text style={{ color: C.labelMid, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>GAPS</Text>
                <Text style={{ color: C.labelDark, fontSize: 13 }}>{reviewData.competency_assessment.gap_summary}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* ── INSTRUCTOR REVIEW STATUS (shown to student) ── */}
      {!readOnly && reviewData.instructor_review_status && (
        <View style={s.sectionWrap}>
          <SectionLabel>INSTRUCTOR REVIEW</SectionLabel>
          <View style={[
            s.instructorReviewBanner,
            reviewData.instructor_review_status === 'approved'
              ? s.approvedBanner
              : s.revisionBanner,
          ]}>
            <Ionicons
              name={reviewData.instructor_review_status === 'approved' ? 'shield-checkmark' : 'refresh-circle'}
              size={20}
              color={reviewData.instructor_review_status === 'approved' ? C.accent : C.coral}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[
                s.instructorReviewStatusText,
                { color: reviewData.instructor_review_status === 'approved' ? C.accent : C.coral },
              ]}>
                {reviewData.instructor_review_status === 'approved' ? 'Approved by Instructor' : 'Revision Requested'}
              </Text>
              {reviewData.instructor_review_note && (
                <Text style={s.instructorReviewNote}>{reviewData.instructor_review_note}</Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ── INSTRUCTOR SUGGESTION (shown to student) ── */}
      {!readOnly && reviewData.instructor_suggested_next && (
        <View style={s.sectionWrap}>
          <SectionLabel>INSTRUCTOR SUGGESTION</SectionLabel>
          <View style={s.instructorSuggestionCard}>
            <Ionicons name="school-outline" size={16} color={C.accent} />
            <Text style={s.instructorSuggestionText}>
              {reviewData.instructor_suggested_next}
            </Text>
          </View>
        </View>
      )}

      {/* ── INSTRUCTOR ASSESSMENT ── (for blueprint authors viewing student steps with competencies) */}
      {readOnly && mappedCompetencies.length > 0 && (
        <InstructorAssessmentSection
          stepId={stepId}
          competencies={mappedCompetencies}
          studentSelfRatings={localCapabilityRatings}
          existingAssessment={reviewData.instructor_assessment}
        />
      )}

      {/* ── INSTRUCTOR SUGGESTED NEXT STEP ── */}
      {readOnly && (
        <InstructorSuggestNext
          stepId={stepId}
          existingSuggestion={reviewData.instructor_suggested_next}
        />
      )}

      {/* ── BUTTONS ── (hidden for collaborators) */}
      {readOnly ? null : !isCompleted ? (
        <View style={s.buttonGroup}>
          <Pressable
            style={[s.saveButton, isSaving && { opacity: 0.6 }]}
            onPress={handleSaveReview}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            )}
            <Text style={s.saveButtonText}>Complete & Save Review</Text>
          </Pressable>
          <Pressable style={s.shareButton} onPress={() => setShareSheetOpen(true)}>
            <Ionicons name="share-outline" size={18} color={C.labelMid} />
            <Text style={s.shareButtonText}>Share with Coach</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.buttonGroup}>
          <View style={s.completedBadge}>
            <Ionicons name="checkmark-circle" size={18} color={C.accent} />
            <Text style={s.completedText}>Review Complete</Text>
          </View>
          <Pressable
            style={[s.shareButton, isSaving && { opacity: 0.5 }]}
            onPress={handleSaveReview}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={C.labelMid} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={C.labelMid} />
            )}
            <Text style={s.shareButtonText}>
              {isSaving ? 'Updating…' : 'Update Review'}
            </Text>
          </Pressable>
          {!createdNextId ? (
            <Pressable
              style={[s.saveButton, creatingNext && { opacity: 0.6 }]}
              onPress={handleCreateNextStep}
              disabled={creatingNext}
            >
              {creatingNext ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-forward-circle" size={18} color="#FFFFFF" />
              )}
              <Text style={s.saveButtonText}>
                {creatingNext ? 'Creating...' : 'Create Next Step'}
              </Text>
            </Pressable>
          ) : (
            <View style={s.nextCreatedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={C.accent} />
              <Text style={s.nextCreatedText}>Next step created!</Text>
            </View>
          )}
          <Pressable style={s.shareButton} onPress={() => setShareSheetOpen(true)}>
            <Ionicons name="share-outline" size={18} color={C.labelMid} />
            <Text style={s.shareButtonText}>Share with Coach</Text>
          </Pressable>
        </View>
      )}

      <ShareStepSheet
        isOpen={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        stepId={stepId}
        stepTitle={step.title}
        planData={planData}
        actData={actData}
        reviewData={reviewData}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 0,
  },

  // Auto-save
  autoSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingVertical: 4,
  },
  autoSaveText: {
    fontSize: 11,
    color: C.labelLight,
  },

  // Section wrappers
  sectionWrap: {
    gap: 12,
    paddingTop: 16,
  },
  sectionWrapTight: {
    gap: 8,
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.sectionLabel,
    letterSpacing: 1,
  },

  // Overall rating card
  overallCard: {
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: C.radiusLg,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(26,25,24,0.03)' } as any,
    }),
  },
  overallQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: C.labelDark,
  },
  starRow: {
    flexDirection: 'row',
    gap: 12,
  },
  overallLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: C.labelMid,
  },

  // Skill progress
  skillCard: {
    backgroundColor: C.cardBg,
    borderRadius: C.radius,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  skillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skillName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.labelDark,
    flex: 1,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 100,
    backgroundColor: C.dotInactive,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 100,
  },
  skillHint: {
    fontSize: 12,
    color: C.labelMid,
  },

  // Your Work thumbnails
  thumbRow: {
    flexDirection: 'row',
    gap: 12,
  },
  thumb: {
    flex: 1,
    height: 120,
    backgroundColor: C.cardBg,
    borderRadius: C.radius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  thumbLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: C.labelMid,
  },
  thumbAdd: {
    borderColor: C.accent,
    borderWidth: 1.5,
    borderStyle: 'dashed' as any,
  },
  thumbAddLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: C.accent,
  },

  // Prompt sections (went well / improve)
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promptTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.labelDark,
  },
  inputBox: {
    fontSize: 13,
    color: C.labelDark,
    lineHeight: 20,
    backgroundColor: C.cardBg,
    borderRadius: C.radius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    minHeight: 80,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'vertical' } as any,
    }),
  },

  // AI Feedback
  aiCard: {
    backgroundColor: C.cardBg,
    borderRadius: C.radiusLg,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: C.accentGlow,
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(26,25,24,0.03)' } as any,
    }),
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.accent,
  },
  aiBody: {
    fontSize: 13,
    lineHeight: 20,
    color: C.labelDark,
  },
  aiSuggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.suggestionBg,
    borderRadius: 10,
    padding: 12,
  },
  aiSuggestionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: C.labelMid,
  },
  aiTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(61,138,90,0.08)',
    borderRadius: C.radius,
    paddingVertical: 14,
  },
  aiTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.accent,
  },

  // Buttons
  buttonGroup: {
    gap: 8,
    paddingTop: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: C.radius,
    paddingVertical: 14,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(61,138,90,0.25)' } as any,
    }),
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.cardBg,
    borderRadius: C.radius,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: C.labelMid,
  },

  // Completed state
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(61,138,90,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },
  nextCreatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(61,138,90,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  nextCreatedText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },

  // Instructor suggestion (shown to student)
  instructorReviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: C.radius,
    padding: 14,
    borderWidth: 1,
  },
  approvedBanner: {
    backgroundColor: 'rgba(61,138,90,0.06)',
    borderColor: 'rgba(61,138,90,0.2)',
  },
  revisionBanner: {
    backgroundColor: 'rgba(216,149,117,0.06)',
    borderColor: 'rgba(216,149,117,0.2)',
  },
  instructorReviewStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  instructorReviewNote: {
    fontSize: 13,
    color: C.labelMid,
    lineHeight: 18,
  },
  instructorSuggestionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(61,138,90,0.06)',
    borderRadius: C.radius,
    padding: 14,
    borderWidth: 1,
    borderColor: C.accentGlow,
  },
  instructorSuggestionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: C.labelDark,
    fontWeight: '500',
  },

  // Instructor "Suggest Next Step" (in readOnly mode)
  suggestSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  suggestSaveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  suggestSavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  suggestSavedText: {
    fontSize: 12,
    color: C.accent,
    fontWeight: '500',
  },
});
