/**
 * StepDetailContent — Header + Plan/Act/Review tabs for a single step.
 */

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { IOS_COLORS as _IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS, STEP_PALETTE } from '@/lib/step-theme';
import { text } from '@/lib/design-tokens';
import { getStepCategoryLabels } from '@/lib/step-category-config';
import { IOSPillTabs, usePillTabs } from '@/components/ui/ios/IOSPillTabs';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useUpdateStep } from '@/hooks/useTimelineSteps';
import { PlanTab } from './PlanTab';
import { ActTab } from './ActTab';
import { ReviewTab } from './ReviewTab';
import { getReviewSections } from '@/lib/step/getReviewSections';
// BrainDumpEntry now embedded in PlanTab
import { AIStructureReview } from './AIStructureReview';
import type { StepPlanData, StepActData as _StepActData, StepReviewData as _StepReviewData, StepMetadata, BrainDumpData, StepCollaborator as _StepCollaborator, AnyExtractedEntity, DateEnrichment, ExtractedPersonEntity } from '@/types/step-detail';
import type { TimelineStepStatus } from '@/types/timeline-steps';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { CommentsSection } from '@/components/social/CommentsSection';
import { useStepComments, useAddStepComment, useDeleteStepComment } from '@/hooks/useStepComments';
import { structureBrainDump } from '@/services/ai/StepPlanAIService';
import { saveUrlsToLibrary } from '@/services/ai/BrainDumpAIService';
import { getSkillGoalTitles } from '@/services/SkillGoalService';
import { resolveEntities, buildEntityInput } from '@/services/ai/EntityResolutionService';
import { enrichDateForSailing } from '@/services/ai/DateEnrichmentService';
import { sailorBoatService } from '@/services/SailorBoatService';
import { equipmentService } from '@/services/EquipmentService';
import { StepPinInterests } from './StepPinInterests';
import { StepProvenanceBanner } from './StepProvenanceBanner';

type TabValue = 'plan' | 'act' | 'review';

function getDefaultTab(status?: TimelineStepStatus): TabValue {
  switch (status) {
    case 'in_progress': return 'act';
    case 'completed': return 'review';
    default: return 'plan';
  }
}

interface StepDetailContentProps {
  stepId: string;
  readOnly?: boolean;
}

export function StepDetailContent({ stepId, readOnly: readOnlyProp }: StepDetailContentProps) {
  const { user } = useAuth();
  const { currentInterest } = useInterest();

  const { data: step, isLoading, error } = useStepDetail(stepId);

  // Use the step's own interest for vocabulary so labels match the step's
  // domain (e.g. sail-racing labels for a sailing step, even when the viewer's
  // active interest is nursing).
  const { vocab } = useVocabulary(step?.interest_id);
  const queryClient = useQueryClient();
  const updateMetadata = useUpdateStepMetadata(stepId);
  const updateStep = useUpdateStep();

  // Ownership detection — readOnlyProp forces read-only mode (e.g. blueprint author viewing subscriber step)
  const isOwner = readOnlyProp ? false : (!step || user?.id === step.user_id);
  const isCollaborator = !isOwner && !readOnlyProp && Boolean(
    step?.collaborator_user_ids?.includes(user?.id ?? '')
  );

  // Debounce timer ref for auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const pendingTitleRef = useRef<string | null>(null);

  // Reset editingTitle when switching steps
  useEffect(() => {
    setEditingTitle(null);
    pendingTitleRef.current = null;
  }, [stepId]);

  // Helper to save title with optimistic cache update
  const saveTitle = useCallback((text: string) => {
    // Optimistically update the step detail cache so the header shows immediately
    queryClient.setQueryData(
      ['timeline-steps', 'detail', stepId],
      (old: any) => old ? { ...old, title: text } : old,
    );
    // Also update all list caches so the grid view reflects the new title immediately
    queryClient.setQueriesData<any[]>(
      { queryKey: ['timeline-steps'] },
      (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((s) => (s.id === stepId ? { ...s, title: text } : s));
      },
    );
    updateStep.mutate(
      { stepId, input: { title: text } },
      {
        onSuccess: () => {
          // Clear local editing state — server is now the source of truth
          setEditingTitle(null);
          setLastSavedWithFlash(new Date());
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, updateStep, queryClient]);

  const handleTitleChange = useCallback((text: string) => {
    setEditingTitle(text);
    pendingTitleRef.current = text;
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      pendingTitleRef.current = null;
      saveTitle(text);
    }, 800);
  }, [saveTitle]);

  const handleTitleBlur = useCallback(() => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    if (pendingTitleRef.current !== null) {
      const text = pendingTitleRef.current;
      pendingTitleRef.current = null;
      saveTitle(text);
    }
  }, [saveTitle]);

  // Keep refs to the latest functions so the unmount cleanup uses stable references
  const updateStepRef = useRef(updateStep);
  updateStepRef.current = updateStep;
  const saveTitleRef = useRef(saveTitle);
  saveTitleRef.current = saveTitle;

  // Flush any pending title save on unmount
  useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (pendingTitleRef.current !== null) {
        // Use saveTitle (via ref) so optimistic cache updates happen immediately —
        // without this, navigating away before the debounce fires would show stale
        // title in the timeline grid until a refetch.
        saveTitleRef.current(pendingTitleRef.current);
      }
    };
  }, [stepId]);

  // Default tab based on step status
  const defaultTab = useMemo(() => getDefaultTab(step?.status), [step?.status]);
  const [activeTab, setActiveTab] = usePillTabs<TabValue>(defaultTab);

  const metadata = (step?.metadata ?? {}) as StepMetadata;
  const serverPlanData: StepPlanData = useMemo(() => metadata.plan ?? {}, [metadata.plan]);
  const actData = metadata.act ?? {};
  const reviewData = metadata.review ?? {};
  const brainDumpData = metadata.brain_dump;

  // Brain dump state — unified with plan view (no separate phases)
  const hasPlanContent = Boolean(
    serverPlanData.what_will_you_do?.trim() ||
    (serverPlanData.how_sub_steps?.length && serverPlanData.how_sub_steps.some((s) => s.text.trim())) ||
    serverPlanData.collaborators?.length ||
    serverPlanData.where_location?.name?.trim() ||
    serverPlanData.competency_ids?.length ||
    serverPlanData.linked_resource_ids?.length
  );
  const [aiReviewPlan, setAiReviewPlan] = useState<StepPlanData | null>(null);
  const [aiSuggestedTitle, setAiSuggestedTitle] = useState<string | undefined>();
  const [aiStructuring, setAiStructuring] = useState(false);
  const savedLibraryIdsRef = useRef<string[]>([]);
  const [resolvedEntities, setResolvedEntities] = useState<AnyExtractedEntity[]>([]);
  const [dateEnrichment, setDateEnrichment] = useState<DateEnrichment | undefined>();
  const [isEnrichingDate, setIsEnrichingDate] = useState(false);
  const [isResolvingEntities, setIsResolvingEntities] = useState(false);
  const [entityResolutionError, setEntityResolutionError] = useState<string | null>(null);
  const [showAiReview, setShowAiReview] = useState(false);

  // Standalone function for entity resolution — called directly from handleStructureWithAI
  const runEntityResolution = useCallback(async (
    dump: BrainDumpData,
    aiEntities: any,
    aiCollaborators: string[] | undefined,
  ) => {
    if (!user?.id) return;

    const entityInput = buildEntityInput(dump, aiEntities, aiCollaborators);
    setIsResolvingEntities(true);
    setEntityResolutionError(null);

    try {
      const resolution = await resolveEntities(entityInput, user.id);
      setResolvedEntities(resolution.entities);

      // Date enrichment for sailing
      const isSailing = currentInterest?.slug?.includes('sail') || currentInterest?.name?.toLowerCase().includes('sail');
      if (isSailing && resolution.firstDateIso && resolution.resolvedLocationCoords) {
        setIsEnrichingDate(true);
        try {
          let userBoats: any[] = [];
          let userEquipment: any[] = [];
          try {
            userBoats = await sailorBoatService.listBoatsForSailor(user.id);
            const primaryBoat = userBoats.find((b: any) => b.is_primary) || userBoats[0];
            if (primaryBoat) {
              userEquipment = await equipmentService.getEquipmentForBoat(primaryBoat.id);
            }
          } catch {}

          const enrichment = await enrichDateForSailing({
            dateIso: resolution.firstDateIso!,
            coordinates: resolution.resolvedLocationCoords!,
            venueId: resolution.resolvedVenueId,
            userBoats,
            userEquipment,
          });
          setDateEnrichment(enrichment);
        } finally {
          setIsEnrichingDate(false);
        }
      }
    } catch (err) {
      console.error('[EntityResolution] failed:', err);
      setEntityResolutionError(String(err));
    } finally {
      setIsResolvingEntities(false);
    }
  }, [user?.id, currentInterest]);

  const handleStructureWithAI = useCallback(async (dump: BrainDumpData) => {
    updateMetadata.mutate({ brain_dump: dump });
    setAiStructuring(true);

    // Save extracted URLs to library in the background
    if (dump.extracted_urls.length > 0 && user?.id && currentInterest?.id) {
      saveUrlsToLibrary(dump.extracted_urls, user.id, currentInterest.id)
        .then((savedIds) => {
          // eslint-disable-next-line no-console
          console.log('[BrainDump] Library save returned IDs:', savedIds);
          savedLibraryIdsRef.current = savedIds;
        })
        .catch((err) => console.error('[BrainDump] Library save failed:', err));
    }

    try {
      // Fetch existing skill goals to pass to AI for name reuse
      let existingSkills: string[] = [];
      if (user?.id && currentInterest?.id) {
        try {
          existingSkills = await getSkillGoalTitles(user.id, currentInterest.id);
        } catch {}
      }

      const result = await structureBrainDump({
        brainDump: dump,
        interestName: currentInterest?.name ?? 'learning',
        interestId: currentInterest?.id,
        interestSlug: currentInterest?.slug,
        userId: user?.id ?? '',
        existingSkillGoals: existingSkills,
      });

      const plan: StepPlanData = {
        what_will_you_do: result.what_will_you_do,
        how_sub_steps: result.how_sub_steps.map((text, i) => ({
          id: `ai_${i}_${Date.now()}`,
          text,
          sort_order: i,
          completed: false,
        })),
        who_collaborators: result.who_collaborators,
        why_reasoning: result.why_reasoning,
        capability_goals: result.capability_goals.length > 0 ? result.capability_goals : undefined,
      };

      setAiReviewPlan(plan);
      // Always provide a title: use AI suggestion, or derive from "what" content
      const derivedTitle = result.suggested_title
        || result.what_will_you_do.split(/[.\n]/).filter(Boolean)[0]?.trim().slice(0, 80)
        || undefined;
      setAiSuggestedTitle(derivedTitle);
      // Apply title immediately — don't wait for review confirmation
      if (derivedTitle) {
        saveTitle(derivedTitle);
      }
      setResolvedEntities([]);
      setDateEnrichment(undefined);
      setEntityResolutionError(null);
      setShowAiReview(true);

      // Fire entity resolution (runs async, updates state as results arrive)
      runEntityResolution(dump, result.extracted_entities, result.who_collaborators).catch(() => {});
    } catch (err) {
      console.error('AI structuring failed:', err);
      const plan: StepPlanData = {
        what_will_you_do: dump.raw_text,
        who_collaborators: dump.extracted_people,
        capability_goals: dump.extracted_topics.length > 0 ? dump.extracted_topics : undefined,
      };
      setAiReviewPlan(plan);
      // Derive title from topics or raw text for fallback
      const fallbackTitle = dump.extracted_topics[0]
        || dump.raw_text.split(/[.\n]/).filter(Boolean)[0]?.trim().slice(0, 80)
        || undefined;
      setAiSuggestedTitle(fallbackTitle);
      if (fallbackTitle) {
        saveTitle(fallbackTitle);
      }
      setShowAiReview(true);
    } finally {
      setAiStructuring(false);
    }
  }, [updateMetadata, currentInterest, user, runEntityResolution, saveTitle]);

  const handleConfirmAIPlan = useCallback((confirmedPlan: StepPlanData, title?: string) => {
    // Merge any saved library resource IDs into the plan
    let enrichedPlan: StepPlanData = savedLibraryIdsRef.current.length > 0
      ? { ...confirmedPlan, linked_resource_ids: [
          ...new Set([...(confirmedPlan.linked_resource_ids ?? []), ...savedLibraryIdsRef.current]),
        ]}
      : { ...confirmedPlan };

    // Convert who_collaborators strings to structured StepCollaborator entries
    // Use resolved person entities for platform matches when available
    if (enrichedPlan.who_collaborators?.length) {
      const personEntities = resolvedEntities.filter(
        (e): e is ExtractedPersonEntity => e.type === 'person',
      );

      enrichedPlan.collaborators = enrichedPlan.who_collaborators
        .filter((name) => name.trim())
        .map((name, i) => {
          // Try to find a resolved platform match
          const matched = personEntities.find(
            (p) => p.raw_text.toLowerCase() === name.toLowerCase() &&
              p.confidence !== 'unmatched' && p.matched_user_id,
          );
          if (matched?.matched_user_id) {
            return {
              id: `platform_${matched.matched_user_id}`,
              type: 'platform' as const,
              user_id: matched.matched_user_id,
              display_name: matched.matched_display_name || name.trim(),
            };
          }
          return {
            id: `external_${i}_${Date.now()}`,
            type: 'external' as const,
            display_name: name.trim(),
          };
        });
    }

    // Attach resolved entity context + date enrichment
    if (resolvedEntities.length > 0) {
      enrichedPlan.equipment_context = resolvedEntities;
    }
    if (dateEnrichment) {
      enrichedPlan.date_enrichment = dateEnrichment;
    }

    // Set starts_at from first detected date
    const firstDate = resolvedEntities.find(
      (e): e is import('@/types/step-detail').ExtractedDateEntity => e.type === 'date',
    );

    updateMetadata.mutate(
      {
        plan: enrichedPlan,
        brain_dump: { ...(brainDumpData ?? {} as BrainDumpData), ai_structured_at: new Date().toISOString() },
      },
      {
        onSuccess: () => {
          setAiReviewPlan(null);
          setShowAiReview(false);
          savedLibraryIdsRef.current = [];
          setResolvedEntities([]);
          setDateEnrichment(undefined);
        },
      },
    );

    // Update step title using saveTitle for optimistic cache update
    const effectiveTitle = title
      || enrichedPlan.what_will_you_do?.split(/[.\n]/).filter(Boolean)[0]?.trim().slice(0, 80);
    if (effectiveTitle) {
      saveTitle(effectiveTitle);
    }
    // Update starts_at separately if needed
    if (firstDate?.parsed_iso) {
      updateStep.mutate({ stepId, input: { starts_at: firstDate.parsed_iso } });
    }
  }, [stepId, brainDumpData, updateMetadata, updateStep, saveTitle, resolvedEntities, dateEnrichment]);

  const handleResolveAmbiguousPerson = useCallback((rawText: string, userId: string, displayName: string) => {
    setResolvedEntities((prev) =>
      prev.map((e) => {
        if (e.type === 'person' && e.raw_text === rawText) {
          return {
            ...e,
            matched_user_id: userId,
            matched_display_name: displayName,
            confidence: 'exact',
            ambiguous_matches: undefined,
          } as ExtractedPersonEntity;
        }
        return e;
      }),
    );
  }, []);

  // Handle conversational capture creating a plan
  const handleConversationalCreate = useCallback((conversationalPlan: Partial<StepPlanData>, suggestedTitle?: string) => {
    updateMetadata.mutate({ plan: { ...serverPlanData, ...conversationalPlan } });
    if (suggestedTitle) {
      saveTitle(suggestedTitle);
    }
  }, [serverPlanData, updateMetadata, saveTitle]);

  const handleBackToDump = useCallback(() => {
    setShowAiReview(false);
    setAiReviewPlan(null);
    setResolvedEntities([]);
    setDateEnrichment(undefined);
  }, []);

  const handleDraftChange = useCallback((dump: BrainDumpData) => {
    updateMetadata.mutate({ brain_dump: dump });
  }, [updateMetadata]);

  // Optimistic local plan state so TextInputs are responsive while saving
  const [localPlanOverrides, setLocalPlanOverrides] = useState<Partial<StepPlanData>>({});
  const planData: StepPlanData = useMemo(
    () => ({ ...serverPlanData, ...localPlanOverrides }),
    [serverPlanData, localPlanOverrides],
  );

  // Sync: clear local overrides when server data catches up
  useEffect(() => {
    setLocalPlanOverrides({});
  }, [serverPlanData]);

  // Determine tab completion states
  const isPlanComplete = Boolean(
    planData.what_will_you_do?.trim() ||
    (planData.how_sub_steps?.length && planData.how_sub_steps.some((s) => s.text.trim()))
  );
  const isActComplete = Boolean(
    actData.notes?.trim() ||
    actData.media_uploads?.length ||
    actData.media_links?.length ||
    (actData.sub_step_progress && Object.values(actData.sub_step_progress).some(Boolean))
  );
  // Step Arch E — read review presence through the selector so v2 sections[]
  // and pre-backfill flat fields both count. The selector synthesizes from
  // flat fields when sections[] is missing.
  const isReviewComplete = Boolean(
    getReviewSections(metadata).sections.length > 0 ||
    (reviewData.capability_progress && Object.keys(reviewData.capability_progress).length > 0)
  );

  // Category-aware labels (nutrition steps get different text than strength steps)
  const categoryLabels = useMemo(() => getStepCategoryLabels(step?.category), [step?.category]);

  const tabs = useMemo(() => [
    { value: 'plan' as const, label: categoryLabels.tabs.plan !== 'Before' ? categoryLabels.tabs.plan : vocab('Plan Phase'), completed: isPlanComplete },
    { value: 'act' as const, label: categoryLabels.tabs.act !== 'During' ? categoryLabels.tabs.act : vocab('Do Phase'), completed: isActComplete },
    { value: 'review' as const, label: categoryLabels.tabs.review !== 'After' ? categoryLabels.tabs.review : vocab('Review Phase'), completed: isReviewComplete },
  ], [vocab, isPlanComplete, isActComplete, isReviewComplete, categoryLabels]);

  // Auto-save status tracking — flash "Saved" for 3 seconds then fade
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setLastSavedWithFlash = useCallback((date: Date) => {
    setLastSaved(date);
    if (saveFlashTimerRef.current) clearTimeout(saveFlashTimerRef.current);
    saveFlashTimerRef.current = setTimeout(() => setLastSaved(null), 3000);
  }, []);

  // Step date (starts_at) management
  const handleSetStepDate = useCallback((dateStr: string) => {
    if (!step || !isOwner) return;
    const startsAt = dateStr ? new Date(dateStr + 'T00:00:00').toISOString() : null;
    queryClient.setQueryData(
      ['timeline-steps', 'detail', stepId],
      (old: any) => old ? { ...old, starts_at: startsAt } : old,
    );
    queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
    updateStep.mutate({ stepId, input: { starts_at: startsAt } });
  }, [step, stepId, isOwner, updateStep, queryClient]);

  const handlePromptStepDate = useCallback(() => {
    if (!step || !isOwner) return;
    const existing = step.starts_at ? new Date(step.starts_at).toISOString().slice(0, 10) : '';
    if (Platform.OS === 'web') {
      const input = window.prompt('Set date (YYYY-MM-DD):', existing);
      if (input === null) return;
      handleSetStepDate(input.trim());
      return;
    }
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Set date',
        'YYYY-MM-DD',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: (text) => { if (text != null) handleSetStepDate(text.trim()); } },
        ],
        'plain-text',
        existing,
      );
      return;
    }
    showAlert('Set date', 'Date editing is available on iOS and the web. Android picker is coming soon.');
  }, [step, isOwner, handleSetStepDate]);

  const handleClearStepDate = useCallback(() => {
    handleSetStepDate('');
  }, [handleSetStepDate]);

  // Due date management
  const isOverdue = Boolean(
    step?.due_at && step.status !== 'completed' && new Date(step.due_at) < new Date()
  );

  const handleSetDueDate = useCallback((dateStr: string) => {
    if (!step || !isOwner) return;
    const dueAt = dateStr ? new Date(dateStr + 'T23:59:59').toISOString() : null;
    queryClient.setQueryData(
      ['timeline-steps', 'detail', stepId],
      (old: any) => old ? { ...old, due_at: dueAt } : old,
    );
    updateStep.mutate({ stepId, input: { due_at: dueAt } });
  }, [step, stepId, isOwner, updateStep, queryClient]);

  const handlePromptDueDate = useCallback(() => {
    if (!step || !isOwner) return;
    const existing = step.due_at ? new Date(step.due_at).toISOString().slice(0, 10) : '';
    if (Platform.OS === 'web') {
      const input = window.prompt('Set due date (YYYY-MM-DD):', existing);
      if (input === null) return;
      handleSetDueDate(input.trim());
      return;
    }
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Set due date',
        'YYYY-MM-DD',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: (text) => { if (text != null) handleSetDueDate(text.trim()); } },
        ],
        'plain-text',
        existing,
      );
      return;
    }
    showAlert('Set due date', 'Due-date editing is available on iOS and the web. Android picker is coming soon.');
  }, [step, isOwner, handleSetDueDate]);

  const handleClearDueDate = useCallback(() => {
    handleSetDueDate('');
  }, [handleSetDueDate]);

  // Done toggle — toggle between completed and pending
  const handleToggleDone = useCallback(() => {
    if (!step || !isOwner) return;
    const nextStatus: TimelineStepStatus = step.status === 'completed' ? 'pending' : 'completed';
    // Optimistic update
    queryClient.setQueryData(
      ['timeline-steps', 'detail', stepId],
      (old: any) => old ? { ...old, status: nextStatus, completed_at: nextStatus === 'completed' ? new Date().toISOString() : null } : old,
    );
    updateStep.mutate({ stepId, input: { status: nextStatus } });
  }, [step, stepId, isOwner, updateStep, queryClient]);
  const _prevSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs so debounced timeouts and unmount cleanup always see latest values
  const serverPlanDataRef = useRef(serverPlanData);
  serverPlanDataRef.current = serverPlanData;
  const updateMetadataRef = useRef(updateMetadata);
  updateMetadataRef.current = updateMetadata;

  // Debounced auto-save for plan data — update local state immediately, persist after debounce
  const pendingPlanRef = useRef<Partial<StepPlanData> | null>(null);
  const handlePlanUpdate = useCallback((partial: Partial<StepPlanData>) => {
    setLocalPlanOverrides((prev) => {
      const merged = { ...prev, ...partial };
      pendingPlanRef.current = merged;
      return merged;
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingPlanRef.current;
      pendingPlanRef.current = null;
      // Use refs to avoid stale closures in the timeout
      updateMetadataRef.current.mutate(
        { plan: { ...serverPlanDataRef.current, ...pending } },
        { onSuccess: () => setLastSavedWithFlash(new Date()) },
      );
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush any pending plan save on unmount only
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingPlanRef.current !== null) {
        updateMetadataRef.current.mutate({ plan: { ...serverPlanDataRef.current, ...pendingPlanRef.current } });
      }
    };
  }, [stepId]);

  // Navigate to next tab
  const handleNextTab = useCallback((next: TabValue) => {
    setActiveTab(next);
  }, [setActiveTab]);

  // Step comments (discussion thread) — visible to owner, collaborators, and blueprint authors (readOnly)
  const showComments = isOwner || isCollaborator || readOnlyProp;
  const { data: commentsData, isLoading: commentsLoading } = useStepComments(showComments ? stepId : undefined);
  const addComment = useAddStepComment(stepId);
  const deleteComment = useDeleteStepComment(stepId);

  const handleAddComment = useCallback(async (text: string, parentId?: string | null) => {
    await addComment.mutateAsync({ content: text, parentId });
  }, [addComment]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    await deleteComment.mutateAsync(commentId);
  }, [deleteComment]);

  // Map step comments to CommentsSection format
  const mappedComments = useMemo(() =>
    (commentsData ?? []).map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.userName,
      userAvatarEmoji: c.userAvatarEmoji,
      userAvatarColor: c.userAvatarColor,
      userAvatarUrl: c.userAvatarUrl,
      content: c.content,
      createdAt: c.createdAt,
      parentId: c.parentId,
    })),
    [commentsData],
  );

  const commentsFooter = useMemo(() => {
    if (!showComments) return null;
    return (
      <View style={styles.discussionSection}>
        <CommentsSection
          comments={mappedComments}
          isLoading={commentsLoading}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          totalCount={mappedComments.length}
        />
      </View>
    );
  }, [showComments, mappedComments, commentsLoading, handleAddComment, handleDeleteComment]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={STEP_COLORS.accent} />
      </View>
    );
  }

  if (error || !step) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={STEP_COLORS.coral} />
        <Text style={styles.errorText}>Step not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.sessionRow}>
          <View style={styles.sessionBadge}>
            <Text style={styles.sessionBadgeText}>STEP</Text>
          </View>
          {isOwner && lastSaved && (
            <View style={styles.autoSaveIndicator}>
              <Ionicons name="cloud-done-outline" size={12} color={STEP_COLORS.tertiaryLabel} />
              <Text style={styles.autoSaveText}>Saved</Text>
            </View>
          )}
          {isOwner && (
            <Pressable
              style={[
                styles.doneToggle,
                step.status === 'completed' && styles.doneToggleActive,
              ]}
              onPress={handleToggleDone}
            >
              <Ionicons
                name={step.status === 'completed' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={16}
                color={step.status === 'completed' ? '#34C759' : STEP_COLORS.tertiaryLabel}
              />
              <Text style={[
                styles.doneToggleText,
                step.status === 'completed' && styles.doneToggleTextActive,
              ]}>
                {step.status === 'completed' ? 'Done' : 'Mark Done'}
              </Text>
            </Pressable>
          )}
          <Pressable
            style={styles.menuButton}
            onPress={() => router.push('/library')}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={STEP_COLORS.secondaryLabel} />
          </Pressable>
        </View>
        {isOwner ? (
          <TextInput
            style={styles.titleInput}
            value={editingTitle ?? step.title}
            onChangeText={handleTitleChange}
            onBlur={handleTitleBlur}
            onSubmitEditing={handleTitleBlur}
            placeholder={`${vocab('Learning Event')} title...`}
            placeholderTextColor={STEP_COLORS.tertiaryLabel}
            selectTextOnFocus
          />
        ) : (
          <Text style={styles.titleInput}>{step.title || `${vocab('Learning Event')}`}</Text>
        )}
        {step.description && (
          <Text style={styles.description} numberOfLines={2}>{step.description}</Text>
        )}
        {/* Date chips row */}
        {(step.starts_at || step.due_at || isOwner) && (
          <View style={styles.dueDateRow}>
            {/* Step date (starts_at) */}
            {step.starts_at ? (
              <Pressable
                style={styles.dueDateChip}
                onPress={isOwner ? handlePromptStepDate : undefined}
              >
                <Ionicons name="calendar" size={13} color={STEP_COLORS.accent} />
                <Text style={[styles.dueDateText, { color: STEP_COLORS.accent }]}>
                  {new Date(step.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
                {isOwner && (
                  <Pressable onPress={handleClearStepDate} hitSlop={8}>
                    <Ionicons name="close-circle" size={14} color={STEP_COLORS.tertiaryLabel} />
                  </Pressable>
                )}
              </Pressable>
            ) : isOwner ? (
              <Pressable
                style={styles.addDueDateButton}
                onPress={handlePromptStepDate}
              >
                <Ionicons name="calendar-outline" size={13} color={STEP_COLORS.tertiaryLabel} />
                <Text style={styles.addDueDateText}>Add date</Text>
              </Pressable>
            ) : null}
            {/* Due date */}
            {step.due_at ? (
              <Pressable
                style={[styles.dueDateChip, isOverdue && styles.dueDateChipOverdue]}
                onPress={isOwner ? handlePromptDueDate : undefined}
              >
                <Ionicons
                  name={isOverdue ? 'alert-circle' : 'time-outline'}
                  size={13}
                  color={isOverdue ? '#FF3B30' : STEP_COLORS.secondaryLabel}
                />
                <Text style={[styles.dueDateText, isOverdue && styles.dueDateTextOverdue]}>
                  {isOverdue ? 'Overdue · ' : 'Due '}
                  {new Date(step.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
                {isOwner && (
                  <Pressable onPress={handleClearDueDate} hitSlop={8}>
                    <Ionicons name="close-circle" size={14} color={STEP_COLORS.tertiaryLabel} />
                  </Pressable>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
        {isOwner && <StepPinInterests stepId={stepId} stepInterestId={step.interest_id} />}
        {isCollaborator && (() => {
          const planCollabs = serverPlanData.collaborators ?? [];
          const ownerCollab = planCollabs.find(
            (c) => c.type === 'platform' && c.user_id === step.user_id,
          );
          const ownerName = ownerCollab?.display_name;
          return (
            <View style={styles.collaboratorBanner}>
              <Ionicons name="people-outline" size={16} color={STEP_COLORS.accent} />
              <Text style={styles.collaboratorBannerText}>
                {ownerName ? `Shared by ${ownerName}` : 'Shared with you'}
              </Text>
            </View>
          );
        })()}

        {/* Step provenance — source blueprint OR follow-up chain */}
        {(step.source_type !== 'manual' || brainDumpData?.source_step_id) && (
          <StepProvenanceBanner
            sourceBlueprintId={step.source_blueprint_id}
            sourceType={step.source_type}
            copiedFromUserId={step.copied_from_user_id}
            followUpToStepId={brainDumpData?.source_step_id ?? null}
            variant="full"
          />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <IOSPillTabs
          tabs={tabs}
          selectedValue={activeTab}
          onChange={setActiveTab}
          compact
          accentColor={STEP_PALETTE.textPrimary}
          unselectedBgColor="transparent"
          unselectedBorderColor={STEP_PALETTE.borderTertiary}
        />
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {/* AI review overlay — shown when AI structures brain dump */}
        {activeTab === 'plan' && isOwner && showAiReview && aiReviewPlan && (
          <AIStructureReview
            planData={aiReviewPlan}
            suggestedTitle={aiSuggestedTitle}
            resolvedEntities={resolvedEntities}
            dateEnrichment={dateEnrichment}
            isEnrichingDate={isEnrichingDate}
            isResolvingEntities={isResolvingEntities}
            entityResolutionError={entityResolutionError}
            onResolveAmbiguousPerson={handleResolveAmbiguousPerson}
            onConfirm={handleConfirmAIPlan}
            onBack={handleBackToDump}
          />
        )}
        {/* Unified plan view — brain dump at top + plan fields below */}
        {activeTab === 'plan' && !(isOwner && showAiReview && aiReviewPlan) && (
          <PlanTab
            stepId={stepId}
            planData={planData}
            interestId={step.interest_id}
            onUpdate={handlePlanUpdate}
            onNextTab={() => handleNextTab('act')}
            readOnly={!isOwner}
            footer={commentsFooter}
            brainDumpData={isOwner ? brainDumpData : undefined}
            onBrainDumpChange={isOwner ? handleDraftChange : undefined}
            onStructureWithAI={isOwner ? handleStructureWithAI : undefined}
            isStructuring={aiStructuring}
            hasPlanContent={hasPlanContent}
            interestSlug={currentInterest?.slug}
            interestName={currentInterest?.name}
            useConversationalCapture={isOwner}
            onConversationalCreate={isOwner ? handleConversationalCreate : undefined}
            stepCategory={step.category}
          />
        )}
        {activeTab === 'act' && (
          <ActTab stepId={stepId} dateEnrichment={planData.date_enrichment} onNextTab={() => handleNextTab('review')} readOnly={!isOwner} footer={commentsFooter} interestId={step.interest_id} interestName={currentInterest?.name} interestSlug={currentInterest?.slug} />
        )}
        {activeTab === 'review' && <ReviewTab stepId={stepId} readOnly={!isOwner} footer={commentsFooter} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: STEP_PALETTE.bgPrimary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.sm,
  },
  errorText: {
    fontSize: 16,
    color: STEP_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  header: {
    backgroundColor: STEP_PALETTE.bgPrimary,
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: STEP_PALETTE.borderTertiary,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: IOS_SPACING.xs,
  },
  sessionBadge: {
    backgroundColor: STEP_PALETTE.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sessionBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: STEP_PALETTE.textSecondary,
    letterSpacing: 1,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  dueDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: STEP_COLORS.headerBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_COLORS.border,
  },
  dueDateChipOverdue: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  dueDateText: {
    fontSize: 12,
    color: STEP_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  dueDateTextOverdue: {
    color: '#FF3B30',
  },
  addDueDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  addDueDateText: {
    fontSize: 12,
    color: STEP_COLORS.tertiaryLabel,
    fontWeight: '400',
  },
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_COLORS.border,
    marginRight: 4,
  },
  doneToggleActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  doneToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: STEP_COLORS.tertiaryLabel,
  },
  doneToggleTextActive: {
    color: '#34C759',
  },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInput: {
    ...text.serifTitle,
    color: STEP_PALETTE.textPrimary,
    padding: 0,
    margin: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  description: {
    fontSize: 14,
    color: STEP_PALETTE.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  tabsWrapper: {
    backgroundColor: STEP_PALETTE.bgPrimary,
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.xs,
    paddingBottom: IOS_SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: STEP_PALETTE.borderTertiary,
  },
  tabContent: {
    flex: 1,
  },
  autoSaveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    marginRight: IOS_SPACING.sm,
  },
  autoSaveText: {
    fontSize: 11,
    color: STEP_COLORS.tertiaryLabel,
    fontWeight: '400',
  },
  discussionSection: {
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.lg,
  },
  collaboratorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: STEP_PALETTE.bgSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: IOS_SPACING.sm,
  },
  collaboratorBannerText: {
    fontSize: 13,
    fontWeight: '500',
    color: STEP_PALETTE.textPrimary,
  },
});
