/**
 * StepPlanQuestions — 4 guided planning questions embedded in the card view.
 * Renders above the config-driven phase tiles on the Plan tab.
 *
 * Uses local state for all text inputs to avoid cursor jumps / keystroke loss
 * caused by React Query refetches. Local state syncs FROM server on mount and
 * syncs TO server via debounced mutations.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Linking, Share, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import { PlanQuestionCard } from './PlanQuestionCard';
import { SubStepEditor } from './SubStepEditor';
import { CollaboratorPicker } from './CollaboratorPicker';
import { CollaboratorRolePicker } from './plan-tab/CollaboratorRolePicker';
import { AddPeoplePicker } from './plan-tab/AddPeoplePicker';
import { PlanWhereCard } from './plan-tab/PlanWhereCard';
import { PlanInServiceOfCard } from './plan-tab/PlanInServiceOfCard';
import { CourseContextSheet } from './CourseContextSheet';
import type { PlaybookPickerSelection } from '@/components/playbook/PlaybookPicker';
import { AddToStepPlanSheet, type AddToStepPlanSelection } from './AddToStepPlanSheet';
import { ResourceTypeIcon } from '@/components/library-resources/ResourceTypeIcon';
import { addStepLink, removeStepLink, getStepLinks } from '@/services/PlaybookService';
import { router } from 'expo-router';
import { FromOtherPlaybooks } from './FromOtherPlaybooks';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useUpdateStep } from '@/hooks/useTimelineSteps';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { getResourcesByIds } from '@/services/LibraryService';
import { gatherEnrichedContext, generatePlanFromResource, generateEnrichedPlanSuggestion, generateChatPlanSuggestion } from '@/services/ai/StepPlanAIService';
import { getCompetencies } from '@/services/competencyService';
import { getSkillGoalTitles } from '@/services/SkillGoalService';
import type { StepPlanData, StepMetadata, SubStep, StepCollaborator, StepLocation, BrainDumpData, ChatMessage } from '@/types/step-detail';
import { BrainDumpEntry } from './BrainDumpEntry';
import { ConversationalCapture } from './ConversationalCapture';
import { CrossInterestSuggestions } from './CrossInterestSuggestions';
import { DateEnrichmentCard } from './DateEnrichmentCard';
import { CompetencyPickerModal } from '@/components/competency/CompetencyPickerModal';
import { createStep, enableStepSharing } from '@/services/TimelineStepService';
import { LocationMapPicker as LocationMapPickerModal } from '@/components/races/LocationMapPicker';
import { supabase } from '@/services/supabase';
import { getStepCategoryLabels } from '@/lib/step-category-config';
import type { LibraryResourceRecord } from '@/types/library';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { PlanTabInterior, PlanTabIOSRegisterInterior } from './plan-tab';
import { buildSuggestions, crossInterestToMentorInput } from '@/services/SuggestionsService';
import { useCrossInterestSuggestions } from '@/hooks/useCrossInterestSuggestions';
import { useAIUsage } from '@/hooks/useAIUsage';
import { useLibraryBeforeBinding } from '@/hooks/useStepLibraryBefore';
import { useStepLocationSuggestions } from '@/hooks/useStepLocationSuggestions';
import { showAlert, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { stepTitleFromText } from '@/lib/utils/stepTitle';
import { getAtlasStepData, isAtlasRaceCourseStep } from '@/lib/atlasRaceStep';

function normalizeCapabilityLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface StepPlanQuestionsProps {
  stepId: string;
  interestId: string | undefined;
  readOnly?: boolean;
  /** Brain dump integration — shown as collapsible section at top */
  brainDumpData?: BrainDumpData;
  onBrainDumpChange?: (dump: BrainDumpData) => void;
  onStructureWithAI?: (dump: BrainDumpData) => void;
  isStructuring?: boolean;
  interestSlug?: string;
  /** When true, show conversational capture instead of brain dump */
  useConversationalCapture?: boolean;
  onConversationalCreate?: (planData: Partial<StepPlanData>, suggestedTitle?: string) => void;
  /**
   * Switch the parent carousel from Plan → Do. When provided, the Phase 1
   * BottomCTA at the foot of the Plan body renders enabled (once a WHAT is
   * filled). Consumers in race-card carousels typically pass
   * `() => setSelectedPhase('on_water')`.
   */
  onNextTab?: () => void;
  /**
   * Right gutter (pt) forwarded to PlanTabIOSRegisterInterior so the HOW-row
   * controls clear the floating zoom rail when embedded in the timeline-zoom
   * canvas. Pass ZOOM_RAIL_RESERVED_WIDTH from RaceSummaryCard.
   */
  rightInset?: number;
}

export function StepPlanQuestions({
  stepId, interestId, readOnly,
  brainDumpData: brainDumpProp, onBrainDumpChange, onStructureWithAI,
  isStructuring, interestSlug,
  useConversationalCapture, onConversationalCreate,
  onNextTab,
  rightInset,
}: StepPlanQuestionsProps) {
  const { data: step } = useStepDetail(stepId);
  const updateMetadata = useUpdateStepMetadata(stepId);
  const updateStep = useUpdateStep();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const aiUsage = useAIUsage();
  const { currentInterest, userInterests } = useInterest();
  const catLabels = getStepCategoryLabels(step?.category);
  const libraryBefore = useLibraryBeforeBinding(stepId, interestId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addPickerDestination, setAddPickerDestination] = useState<string | null>(null);
  const openAddPicker = useCallback((destination: string) => setAddPickerDestination(destination), []);
  const closeAddPicker = useCallback(() => setAddPickerDestination(null), []);
  const [showCompetencyPicker, setShowCompetencyPicker] = useState(false);
  const [linkedResources, setLinkedResources] = useState<LibraryResourceRecord[]>([]);
  const [linkedConcepts, setLinkedConcepts] = useState<{ id: string; title: string; slug?: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [_aiSuggestion, setAiSuggestion] = useState('');
  const [showManualFields, setShowManualFields] = useState(false);
  const [refinementChat, setRefinementChat] = useState<ChatMessage[]>([]);
  const [refinementInput, setRefinementInput] = useState('');
  const [localGoals, setLocalGoals] = useState<string[]>([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [suggestedCompetencies, setSuggestedCompetencies] = useState<string[]>([]);
  const [suggestedUserSkills, setSuggestedUserSkills] = useState<string[]>([]);
  const competencyMapRef = useRef<Map<string, string>>(new Map()); // title → id
  const autoMatchedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Local state for text inputs — prevents cursor jumps from query refetches
  // ---------------------------------------------------------------------------
  const [localWhat, setLocalWhat] = useState('');
  const [localWhy, setLocalWhy] = useState('');
  const [localSubSteps, setLocalSubSteps] = useState<SubStep[]>([]);
  const [localCollaborators, setLocalCollaborators] = useState<StepCollaborator[]>([]);
  const [localConnectionSpace, setLocalConnectionSpace] = useState('');
  const [showCollaboratorPicker, setShowCollaboratorPicker] = useState(false);
  const [showAddPeoplePicker, setShowAddPeoplePicker] = useState(false);
  const [roleEditing, setRoleEditing] = useState<StepCollaborator | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [localWhereLocation, setLocalWhereLocation] = useState<StepLocation | undefined>(undefined);
  const [showCourseContext, setShowCourseContext] = useState(false);
  const [orgLocations, setOrgLocations] = useState<{ id: string; name: string; description?: string; lat?: number; lng?: number }[]>([]);
  const initializedRef = useRef(false);

  const metadata = useMemo(
    () => (step?.metadata ?? {}) as StepMetadata,
    [step?.metadata],
  );
  const planData: StepPlanData = metadata.plan ?? {};
  const atlasData = useMemo(() => getAtlasStepData(metadata), [metadata]);
  const isAtlasRaceStep = useMemo(() => isAtlasRaceCourseStep(metadata), [metadata]);
  const locationSuggestions = useStepLocationSuggestions({
    interestSlug: String(interestSlug || currentInterest?.slug || '').toLowerCase() || null,
    stepTitle: step?.title ?? localWhat,
  });
  const atlasSpatialSummary = useMemo(() => {
    const anchors = planData.spatial_anchors ?? [];
    if (anchors.length === 0) return null;
    const markCount = anchors.filter((anchor) =>
      anchor.kind === 'race-mark' || anchor.kind === 'gate-mark' || anchor.kind === 'line-end',
    ).length;
    const lineCount = anchors.filter((anchor) =>
      anchor.kind === 'start-line' || anchor.kind === 'route-leg',
    ).length;
    const noteCount = anchors.filter((anchor) => anchor.kind === 'local-note').length;
    return {
      anchorCount: anchors.length,
      markCount,
      lineCount,
      noteCount,
    };
  }, [planData.spatial_anchors]);
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  // Seed local state from server data on first load AND when plan changes externally
  // (e.g. ConversationalCapture populates fields, AI structuring fills plan)
  const serverWhat = ((step?.metadata as StepMetadata)?.plan ?? {}).what_will_you_do ?? '';
  useEffect(() => {
    if (!step) return;
    const plan = (step.metadata as StepMetadata)?.plan ?? {};

    // Re-sync when plan content arrives externally (e.g., from ConversationalCapture or AI structuring)
    // Detects: local "what" is empty but server now has content → external update happened
    const externalUpdate = initializedRef.current && !localWhat.trim() && !!plan.what_will_you_do?.trim();

    if (!initializedRef.current || externalUpdate) {
      setLocalWhat(plan.what_will_you_do ?? '');
      setLocalWhy(plan.why_reasoning ?? '');
      setLocalSubSteps(plan.how_sub_steps ?? []);
      setLocalConnectionSpace(plan.connection_space ?? '');
      // Migrate legacy who_collaborators to structured collaborators
      if (plan.collaborators?.length) {
        setLocalCollaborators(plan.collaborators);
      } else if (plan.who_collaborators?.length) {
        setLocalCollaborators(
          plan.who_collaborators
            .filter((name) => name.trim())
            .map((name, i) => ({
              id: `legacy_${i}_${Date.now()}`,
              type: 'external' as const,
              display_name: name.trim(),
            }))
        );
      }
      setLocalGoals(plan.capability_goals ?? []);
      setLocalWhereLocation(plan.where_location);
      // Allow skill auto-matching to re-run after external updates
      if (externalUpdate) autoMatchedRef.current = false;
      initializedRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, serverWhat]);

  // Load org-defined locations for quick pick — only for interests with org-scoped locations (e.g. nursing clinical sites)
  const normalizedSlug = String(interestSlug || currentInterest?.slug || '').toLowerCase();
  const isOrgLocationInterest = normalizedSlug === 'nursing';
  // Phase N.4 — the Step ⟷ Race selector is sailing-only: a race is the one
  // step distinction that carries venue/course/marks/conditions for Atlas.
  const showRaceSelector = normalizedSlug === 'sail-racing';
  // One-line summary of the saved race plan for the "Race area & course" reveal
  // row, so a picked course reads as saved rather than the generic prompt.
  const raceCourseSummary = useMemo(() => {
    if (!showRaceSelector) return undefined;
    const plan = (step?.metadata as StepMetadata | undefined)?.race_plan;
    if (!plan) return undefined;
    const parts: string[] = [];
    if (plan.area_name) parts.push(plan.area_name);
    if (plan.course_label) parts.push(plan.course_label);
    if (plan.laps) parts.push(`${plan.laps} lap${plan.laps === 1 ? '' : 's'}`);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }, [showRaceSelector, step?.metadata]);
  // Structured race plan for the schematic course map (area polygon + marks).
  const racePlanForMap = useMemo(
    () =>
      showRaceSelector
        ? (step?.metadata as StepMetadata | undefined)?.race_plan
        : undefined,
    [showRaceSelector, step?.metadata],
  );
  useEffect(() => {
    if (!user?.id || !isOrgLocationInterest) return;
    const loadOrgLocations = async () => {
      try {
        const { data } = await supabase
          .from('organization_locations')
          .select('id, name, description, lat, lng')
          .order('sort_order', { ascending: true });
        if (data?.length) setOrgLocations(data);
      } catch {}
    };
    loadOrgLocations();
  }, [user?.id, isOrgLocationInterest]);

  // Load org competencies + user skill goals as suggestions for capability goals
  useEffect(() => {
    const resolvedId = interestId || currentInterest?.id;
    if (!resolvedId) return;

    const loadSuggestions = async () => {
      const orgTitles: string[] = [];
      const userTitles: string[] = [];

      // Org competencies
      try {
        const comps = await getCompetencies(resolvedId);
        const titleIdMap = new Map<string, string>();
        comps.forEach((c) => {
          if (c.title) {
            orgTitles.push(c.title);
            titleIdMap.set(c.title, c.id);
          }
        });
        competencyMapRef.current = titleIdMap;
      } catch {}

      // User skill goals
      if (user?.id) {
        try {
          const goals = await getSkillGoalTitles(user.id, resolvedId);
          goals.forEach((t) => userTitles.push(t));
        } catch {}
      }

      setSuggestedCompetencies(orgTitles);
      setSuggestedUserSkills(userTitles);
    };

    loadSuggestions();
  }, [interestId, currentInterest?.id, user?.id]);

  // Use a ref for the latest planData so debounced saves always merge with current server state
  const planDataRef = useRef(planData);
  planDataRef.current = planData;

  // Accumulate pending changes so rapid saves for different fields don't cancel each other
  const pendingChangesRef = useRef<Partial<StepPlanData>>({});

  // Phase 1 · iOS register — mentor-channel suggestions for <SuggestionsRow>.
  const { suggestions: crossInterestSuggestions } = useCrossInterestSuggestions(
    stepId,
    interestId,
  );

  // Debounced save — accumulates partial updates, then flushes everything at once
  const debouncedSave = useCallback((partial: Partial<StepPlanData>) => {
    if (readOnly) return;
    // Merge into pending changes (latest value wins per field)
    pendingChangesRef.current = { ...pendingChangesRef.current, ...partial };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const merged = { ...planDataRef.current, ...pendingChangesRef.current };
      pendingChangesRef.current = {};
      updateMetadata.mutate({ plan: merged });
    }, 800);
  }, [updateMetadata, readOnly]);

  // Keep a ref to updateMetadata so the cleanup effect uses the latest instance
  const updateMetadataRef = useRef(updateMetadata);
  updateMetadataRef.current = updateMetadata;

  // Flush pending changes on unmount — prevents data loss when navigating away
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (Object.keys(pendingChangesRef.current).length > 0) {
        const merged = { ...planDataRef.current, ...pendingChangesRef.current };
        pendingChangesRef.current = {};
        updateMetadataRef.current.mutate({ plan: merged });
      }
    };
  }, [stepId]);

  // Auto-attach relevant Reflect skills when step has a description but no goals yet
  useEffect(() => {
    if (autoMatchedRef.current) return;
    if (suggestedUserSkills.length === 0) return;
    if (localGoals.length > 0) {
      autoMatchedRef.current = true;
      return;
    }
    // Need a description to match against
    const description = (localWhat || step?.title || '').toLowerCase();
    if (!description.trim()) return;

    // Tokenize: extract meaningful words (3+ chars) from the step description
    const descWords = description
      .split(/[\s,.\-—/()]+/)
      .filter((w) => w.length >= 3)
      .map((w) => w.replace(/s$/, '')); // rough singularize

    // Score each skill by keyword overlap
    const scored = suggestedUserSkills
      .map((skill) => {
        const skillWords = skill
          .toLowerCase()
          .split(/[\s,.\-—/()]+/)
          .filter((w) => w.length >= 3)
          .map((w) => w.replace(/s$/, ''));
        const matches = skillWords.filter((sw) =>
          descWords.some((dw) => sw.includes(dw) || dw.includes(sw)),
        );
        return { skill, score: matches.length };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const matched = scored.map((s) => s.skill);
      setLocalGoals(matched);
      debouncedSave({ capability_goals: matched });
    }

    autoMatchedRef.current = true;
  }, [suggestedUserSkills, localWhat, step?.title, localGoals.length, debouncedSave]);

  // Load linked resources
  const linkedIds = planData.linked_resource_ids ?? [];
  useEffect(() => {
    if (linkedIds.length === 0) {
      setLinkedResources([]);
      return;
    }
    getResourcesByIds(linkedIds).then(setLinkedResources).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedIds.join(',')]);

  // Load linked concepts from step_playbook_links
  useEffect(() => {
    let cancelled = false;
    async function loadConcepts() {
      try {
        const links = await getStepLinks(stepId);
        const conceptLinks = links.filter((l) => l.item_type === 'concept');
        if (conceptLinks.length === 0) {
          if (!cancelled) setLinkedConcepts([]);
          return;
        }
        const conceptIds = conceptLinks.map((l) => l.item_id);
        const { data } = await supabase
          .from('playbook_concepts')
          .select('id, title, slug')
          .in('id', conceptIds);
        if (!cancelled) {
          setLinkedConcepts(
            (data || []).map((c: any) => ({ id: c.id, title: c.title, slug: c.slug }))
          );
        }
      } catch {
        if (!cancelled) setLinkedConcepts([]);
      }
    }
    loadConcepts();
    return () => { cancelled = true; };
  }, [stepId]);

  const handleRemoveConcept = useCallback(async (conceptId: string) => {
    setLinkedConcepts((prev) => prev.filter((c) => c.id !== conceptId));
    await removeStepLink(stepId, 'concept', conceptId).catch(() => {});
  }, [stepId]);

  const handleWhatChange = useCallback((text: string) => {
    setLocalWhat(text);
    debouncedSave({ what_will_you_do: text });
  }, [debouncedSave]);

  const handleWhyChange = useCallback((text: string) => {
    setLocalWhy(text);
    debouncedSave({ why_reasoning: text });
  }, [debouncedSave]);

  const handleAddCollaborator = useCallback((collaborator: StepCollaborator) => {
    setLocalCollaborators((prev) => {
      // Prevent duplicates
      if (prev.some((c) => c.id === collaborator.id)) return prev;
      if (collaborator.user_id && prev.some((c) => c.user_id === collaborator.user_id)) return prev;
      const updated = [...prev, collaborator];
      debouncedSave({
        collaborators: updated,
        who_collaborators: updated.map((c) => c.display_name),
      });
      // The collaborator-added notification is fired centrally by
      // syncStepCollaborators (via updateStepMetadata) so it can't be
      // bypassed and won't double-fire across the picker entry points.
      return updated;
    });
  }, [debouncedSave]);

  const handleRemoveCollaborator = useCallback((collaboratorId: string) => {
    setLocalCollaborators((prev) => {
      const updated = prev.filter((c) => c.id !== collaboratorId);
      debouncedSave({
        collaborators: updated,
        who_collaborators: updated.map((c) => c.display_name),
      });
      return updated;
    });
  }, [debouncedSave]);

  const handleSetCollaboratorRole = useCallback(
    (collaboratorId: string, role: string | undefined) => {
      setLocalCollaborators((prev) => {
        const updated = prev.map((c) =>
          c.id === collaboratorId ? { ...c, role: role || undefined } : c,
        );
        debouncedSave({ collaborators: updated });
        return updated;
      });
    },
    [debouncedSave],
  );

  const handleConfirmCollaborators = useCallback(
    (next: StepCollaborator[]) => {
      // AddPeoplePicker returns the full intended set for platform users and
      // any external collaborators added in the sheet. Preserve older external
      // chips that were not visible to the picker, without duplicating new ones.
      setLocalCollaborators((prev) => {
        const seen = new Set(next.map((c) => c.id));
        const preservedExternals = prev.filter((c) => c.type === 'external' && !seen.has(c.id));
        const merged = [...next, ...preservedExternals];
        debouncedSave({
          collaborators: merged,
          who_collaborators: merged.map((c) => c.display_name),
        });
        return merged;
      });
    },
    [debouncedSave],
  );

  const handleShareWithCollaborator = useCallback(async (collaboratorName: string) => {
    if (!step) return;
    try {
      const { url } = await enableStepSharing(step.id);
      const message = `Hey ${collaboratorName}, here's our plan for "${step.title}": ${url}`;
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: step.title ?? 'Untitled step', text: message, url });
        } else {
          await navigator.clipboard.writeText(url);
        }
      } else {
        await Share.share({ message, url });
      }
    } catch (err) {
      console.error('Failed to share with collaborator:', err);
    }
  }, [step]);

  const handleConnectionSpaceChange = useCallback((text: string) => {
    setLocalConnectionSpace(text);
    debouncedSave({ connection_space: text });
  }, [debouncedSave]);

  const handleLocationChange = useCallback((location: StepLocation | undefined) => {
    setLocalWhereLocation(location);
    debouncedSave({ where_location: location });
  }, [debouncedSave]);

  const handleTargetEventChange = useCallback(
    (next: { kind: StepPlanData['target_event_kind']; id: string } | null) => {
      debouncedSave({
        target_event_kind: next?.kind ?? null,
        target_event_id: next?.id ?? null,
      });
    },
    [debouncedSave],
  );

  const handleOpenRaceMap = useCallback(() => {
    router.push({ pathname: '/(tabs)/atlas', params: { frame: 'f2' } } as any);
  }, []);

  const handlePlanLiveTracking = useCallback(() => {
    const currentAtlas = getAtlasStepData(metadataRef.current);
    updateMetadata.mutate({
      atlas: {
        ...(currentAtlas ?? {}),
        live_tracking: {
          ...(currentAtlas?.live_tracking ?? {}),
          status:
            currentAtlas?.live_tracking?.status === 'completed'
              ? 'completed'
              : 'planned',
          provider:
            currentAtlas?.live_tracking?.provider ?? 'betterat_phone_gps',
          planned_at:
            currentAtlas?.live_tracking?.planned_at ??
            new Date().toISOString(),
        },
      },
    });
    router.push(`/race/ios/water/${stepId}` as any);
  }, [stepId, updateMetadata]);

  const handleSelectPlaybookItems = useCallback(async (selections: PlaybookPickerSelection[]) => {
    // Write typed step_playbook_links for every selection (await so other tabs see them)
    await Promise.all(
      selections.map((s) =>
        addStepLink(stepId, s.item_type, s.item_id).catch((err) => {
          console.error('[StepPlanQuestions] addStepLink failed:', s.item_type, s.item_id, err);
        })
      )
    );

    // Optimistically add concept selections to the UI immediately
    const conceptSelections = selections.filter((s) => s.item_type === 'concept');
    if (conceptSelections.length > 0) {
      setLinkedConcepts((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newConcepts = conceptSelections
          .filter((s) => !existingIds.has(s.item_id))
          .map((s) => ({ id: s.item_id, title: s.label }));
        return [...prev, ...newConcepts];
      });
    }

    // Dual-write linked_resource_ids for resource-type selections (one-release migration safety)
    const newResourceIds = selections
      .filter((s) => s.item_type === 'resource')
      .map((s) => s.item_id);

    // Resolve resource records for the auto-plan pathway below
    const resources: LibraryResourceRecord[] = newResourceIds.length
      ? await getResourcesByIds(newResourceIds).catch(() => [])
      : [];

    const existingIds = planDataRef.current.linked_resource_ids ?? [];
    const mergedIds = [...new Set([...existingIds, ...newResourceIds])];
    debouncedSave({ linked_resource_ids: mergedIds });

    // If plan fields are mostly empty, auto-generate from the first new resource
    const currentPlan = planDataRef.current;
    const hasWhat = Boolean(currentPlan.what_will_you_do?.trim());
    const hasSubSteps = Boolean(currentPlan.how_sub_steps?.length && currentPlan.how_sub_steps.some((s) => s.text.trim()));
    const firstNew = resources[0];

    if (!hasWhat && !hasSubSteps && firstNew) {
      setAiLoading(true);
      try {
        const resolvedInterestId = interestId || currentInterest?.id;
        const enriched = resolvedInterestId && user?.id
          ? await gatherEnrichedContext(user.id, resolvedInterestId)
          : { stepHistory: [], orgCompetencies: [], followedUsersActivity: [], orgPrograms: [], userCapabilityProgress: [], libraryResources: [] };

        const plan = await generatePlanFromResource({
          resource: firstNew,
          interestName: currentInterest?.name || 'this interest',
          stepHistory: enriched.stepHistory,
          existingSkillGoals: suggestedUserSkills,
        });

        // Populate the plan fields
        if (plan.what_will_you_do) {
          setLocalWhat(plan.what_will_you_do);
          debouncedSave({ what_will_you_do: plan.what_will_you_do });
        }
        if (plan.how_sub_steps.length) {
          const subSteps: SubStep[] = plan.how_sub_steps.map((text, idx) => ({
            id: `sub-${Date.now()}-${idx}`,
            text,
            sort_order: idx,
            completed: false,
          }));
          setLocalSubSteps(subSteps);
          debouncedSave({ how_sub_steps: subSteps });
        }
        if (plan.why_reasoning) {
          setLocalWhy(plan.why_reasoning);
          debouncedSave({ why_reasoning: plan.why_reasoning });
        }
        if (plan.capability_goals.length) {
          setLocalGoals((prev) => {
            const merged = [...new Set([...prev, ...plan.capability_goals])];
            debouncedSave({ capability_goals: merged });
            return merged;
          });
        }
      } catch (err) {
        console.error('Auto-plan from resource failed:', err);
      } finally {
        setAiLoading(false);
      }
    }
  }, [debouncedSave, interestId, currentInterest, user?.id, stepId, suggestedUserSkills]);

  const handleRemoveResource = useCallback((resourceId: string) => {
    const updated = (planDataRef.current.linked_resource_ids ?? []).filter((id) => id !== resourceId);
    debouncedSave({ linked_resource_ids: updated });
    removeStepLink(stepId, 'resource', resourceId).catch(() => {});
  }, [debouncedSave, stepId]);

  const handleSubStepsChange = useCallback((subSteps: SubStep[]) => {
    setLocalSubSteps(subSteps);
    debouncedSave({ how_sub_steps: subSteps });
  }, [debouncedSave]);

  const handleAddGoal = useCallback((goalText: string) => {
    const trimmed = goalText.trim();
    if (!trimmed) return;
    setLocalGoals((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      // Also track structured competency_id if this matches an org competency
      const compId = competencyMapRef.current.get(trimmed);
      if (compId) {
        const existingIds = planDataRef.current.competency_ids ?? [];
        if (!existingIds.includes(compId)) {
          debouncedSave({ capability_goals: updated, competency_ids: [...existingIds, compId] });
          return updated;
        }
      }
      debouncedSave({ capability_goals: updated });
      return updated;
    });
    setNewGoalText('');
  }, [debouncedSave]);

  const handleRemoveGoal = useCallback((goal: string) => {
    setLocalGoals((prev) => {
      const updated = prev.filter((g) => g !== goal);
      // Also remove structured competency_id if this matches an org competency
      const compId = competencyMapRef.current.get(goal);
      if (compId) {
        const existingIds = planDataRef.current.competency_ids ?? [];
        const updatedIds = existingIds.filter((id) => id !== compId);
        debouncedSave({ capability_goals: updated, competency_ids: updatedIds });
        return updated;
      }
      debouncedSave({ capability_goals: updated });
      return updated;
    });
  }, [debouncedSave]);

  const handleToggleCompetency = useCallback((compId: string, compTitle: string) => {
    const existingIds = planDataRef.current.competency_ids ?? [];
    if (existingIds.includes(compId)) {
      handleRemoveGoal(compTitle);
      return;
    }
    competencyMapRef.current.set(compTitle, compId);
    setLocalGoals((prev) => {
      const updated = prev.includes(compTitle) ? prev : [...prev, compTitle];
      debouncedSave({
        capability_goals: updated,
        competency_ids: [...existingIds, compId],
      });
      return updated;
    });
  }, [debouncedSave, handleRemoveGoal]);

  const handleToggleSuggestedCapability = useCallback((label: string) => {
    const trimmed = label.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;
    if (localGoals.some((goal) => normalizeCapabilityLabel(goal) === normalizeCapabilityLabel(trimmed))) {
      handleRemoveGoal(trimmed);
      return;
    }
    handleAddGoal(trimmed);
  }, [handleAddGoal, handleRemoveGoal, localGoals]);

  // Build enriched context for AI — reused by both initial suggest and refinement
  const buildEnrichedCtx = useCallback(async () => {
    if (!user?.id || !step) return null;
    const resolvedInterestId = interestId || currentInterest?.id;
    const enriched = resolvedInterestId
      ? await gatherEnrichedContext(user.id, resolvedInterestId)
      : { stepHistory: [], orgCompetencies: [], followedUsersActivity: [], orgPrograms: [], userCapabilityProgress: [], libraryResources: [] };
    return {
      interestName: currentInterest?.name || 'this interest',
      interestId: resolvedInterestId,
      stepTitle: step.title ?? 'Untitled step',
      currentWhat: localWhat || undefined,
      linkedResources,
      capabilityGoals: localGoals,
      ...enriched,
    };
  }, [user?.id, step, interestId, currentInterest, localWhat, linkedResources, localGoals]);

  const handleAISuggest = useCallback(async () => {
    if (aiLoading) return;
    if (!aiUsage.canUse('plan_generation')) {
      showAlertWithButtons(
        'Monthly AI limit reached',
        'You\'ve used all your free AI plan suggestions this month. Upgrade for unlimited AI coaching.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/subscription') },
        ],
      );
      return;
    }
    setAiLoading(true);
    setAiSuggestion('');
    setRefinementChat([]);
    try {
      const ctx = await buildEnrichedCtx();
      if (!ctx) return;
      const text = await generateEnrichedPlanSuggestion(ctx);
      aiUsage.refresh();

      // Parse title from first line (AI returns: title\n\nbody)
      const lines = text.split('\n');
      const firstLine = lines[0]?.trim() || '';
      const bodyStart = lines.findIndex((l, i) => i > 0 && l.trim() !== '');
      const body = bodyStart >= 0 ? lines.slice(bodyStart).join('\n').trim() : text;
      const suggestedTitle = firstLine.length > 0 && firstLine.length <= 80 ? firstLine : '';

      // Auto-fill the "what" field with the suggestion body
      setLocalWhat(body);
      debouncedSave({ what_will_you_do: body });

      // Update the step title with the AI-suggested title
      if (suggestedTitle) {
        // Optimistically update timeline-steps caches so card title updates immediately
        queryClient.setQueriesData<any[]>(
          { queryKey: ['timeline-steps'] },
          (old) => {
            if (!Array.isArray(old)) return old;
            return old.map((s) => (s.id === stepId ? { ...s, title: suggestedTitle } : s));
          },
        );
        updateStep.mutate({ stepId, input: { title: suggestedTitle } });
      }

      setAiSuggestion(text);
      // Seed the refinement chat with the initial exchange
      setRefinementChat([
        { role: 'assistant', content: text, timestamp: new Date().toISOString() },
      ]);
    } catch (err) {
      console.error('AI suggestion failed:', err);
      setAiSuggestion('Unable to generate suggestion. Please try again.');
    } finally {
      setAiLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiLoading, buildEnrichedCtx, debouncedSave, step?.title, stepId, updateStep]);

  const handleRefinementSend = useCallback(async () => {
    const trimmed = refinementInput.trim();
    if (!trimmed || aiLoading) return;
    setRefinementInput('');

    const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: new Date().toISOString() };
    const updatedChat = [...refinementChat, userMsg];
    setRefinementChat(updatedChat);
    setAiLoading(true);

    try {
      const ctx = await buildEnrichedCtx();
      if (!ctx) return;
      const text = await generateChatPlanSuggestion(ctx, updatedChat);
      const assistantMsg: ChatMessage = { role: 'assistant', content: text, timestamp: new Date().toISOString() };
      setRefinementChat((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('AI refinement failed:', err);
      const errorMsg: ChatMessage = { role: 'assistant', content: 'Unable to respond. Try again.', timestamp: new Date().toISOString() };
      setRefinementChat((prev) => [...prev, errorMsg]);
    } finally {
      setAiLoading(false);
    }
  }, [refinementInput, aiLoading, refinementChat, buildEnrichedCtx]);

  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [whyLoading, setWhyLoading] = useState(false);
  const handleGenerateWhy = useCallback(async () => {
    if (whyLoading || !localWhat.trim()) return;
    setWhyLoading(true);
    try {
      const ctx = await buildEnrichedCtx();
      if (!ctx) return;
      const text = await generateChatPlanSuggestion(ctx, [
        { role: 'user', content: `Based on my plan "${localWhat.trim()}" and my goals/history, write a brief 1-2 sentence explanation of why this is the right focus for this session. Be specific — reference my goals, recent progress, or competency gaps. Keep it concise and personal.`, timestamp: new Date().toISOString() },
      ]);
      handleWhyChange(text);
    } catch (err) {
      console.error('AI why generation failed:', err);
    } finally {
      setWhyLoading(false);
    }
  }, [whyLoading, localWhat, buildEnrichedCtx, handleWhyChange]);

  const handleGenerateExercises = useCallback(async () => {
    if (exercisesLoading || !localWhat.trim()) return;
    setExercisesLoading(true);
    try {
      const ctx = await buildEnrichedCtx();
      if (!ctx) return;
      const category = step?.category || 'general';
      const isNutrition = category === 'nutrition';

      const isReading = category === 'reading' || category === 'reading_study';
      let prompt: string;
      if (isNutrition) {
        prompt = `Based on my nutrition plan "${localWhat.trim()}", generate a structured meal list for the day.

RULES:
- Output ONLY meals/snacks, one per line
- Format: "Meal name: specific foods with portions" (e.g. "Breakfast: 1/2C oats + 1 banana + 1 scoop whey + 1C milk")
- Include macro estimates if possible (e.g. "~35g protein, 50g carbs")
- Cover all meals: breakfast, lunch, dinner, snacks
- NO advice, NO explanations, NO commentary, NO numbering
- Just the meal lines, nothing else`;
      } else if (isReading) {
        prompt = `Based on my reading plan "${localWhat.trim()}", generate a focused list of reading tasks and reflection exercises.

RULES:
- Output ONLY actionable tasks, one per line
- Include specific reading assignments (chapters, pages, sections)
- Include reflection prompts or application exercises tied to the reading
- Format: clear action item (e.g. "Read Chapter 3: The Power of Yet")
- 4-6 items total
- NO advice, NO explanations, NO commentary, NO numbering
- Just the task lines, nothing else`;
      } else {
        const isFitness = ['strength', 'cardio', 'flexibility', 'workout', 'training', 'exercise'].includes(category);
        if (isFitness) {
          prompt = `Based on my plan "${localWhat.trim()}", generate ONLY a list of exercises with sets, reps, and weights. Use my measurement history for progressive overload.

RULES:
- Output ONLY exercises, one per line
- Format: "Exercise name: SetsxReps @ Weight" (e.g. "Bench press: 4x8 @ 155 lbs")
- For bodyweight exercises: "Dips: 3x failure" or "Plank: 3x 45 sec"
- Include warmup sets as separate lines (e.g. "Bench press (warmup): 2x5 @ 95 lbs")
- NO advice, NO explanations, NO commentary, NO separators, NO numbering
- Just the exercise lines, nothing else`;
        } else {
          prompt = `Based on my plan "${localWhat.trim()}", generate a focused list of actionable sub-steps to accomplish this.

RULES:
- Output ONLY actionable steps, one per line
- Each step should be specific and completable
- Format: clear action item (e.g. "Review patient chart and identify relevant history")
- 4-8 items total, ordered logically
- NO advice, NO explanations, NO commentary, NO numbering
- Just the step lines, nothing else`;
        }
      }

      const text = await generateChatPlanSuggestion(ctx, [
        { role: 'user', content: prompt, timestamp: new Date().toISOString() },
      ]);
      // Parse response into sub-steps, filtering non-content lines
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => {
        if (l.length === 0 || l.length > 150) return false;
        if (/^[-–—=]+$/.test(l)) return false; // separators
        // Reading/general: accept any substantive line; fitness/nutrition: require structured format
        if (isReading || category === 'general') return l.length >= 10;
        return l.includes(':') || /\d+x\d+/.test(l) || /\d+\s*sets?/i.test(l) || /\d+[gG]\b/.test(l);
      });
      const newSubSteps: SubStep[] = lines.map((line, i) => ({
        id: `ai_${Date.now()}_${i}`,
        text: line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^[""]|[""]$/g, ''),
        sort_order: i,
        completed: false,
      }));
      if (newSubSteps.length > 0) {
        // Merge with existing sub-steps (append AI-generated ones)
        const existing = localSubSteps;
        const nonEmpty = existing.filter((s) => s.text.trim());
        const merged = nonEmpty.length > 0
          ? [...nonEmpty, ...newSubSteps.map((s, i) => ({ ...s, sort_order: nonEmpty.length + i }))]
          : newSubSteps;
        handleSubStepsChange(merged);
      }
    } catch (err) {
      console.error('AI exercise generation failed:', err);
    } finally {
      setExercisesLoading(false);
    }
  }, [exercisesLoading, localWhat, buildEnrichedCtx, localSubSteps, handleSubStepsChange, step?.category]);

  const q1Complete = Boolean(localWhat.trim() || linkedIds.length > 0);
  const q2Complete = Boolean(localSubSteps.length && localSubSteps.some((s) => s.text.trim()));
  const q3Complete = Boolean(localWhy.trim());
  const q4Complete = localCollaborators.length > 0;
  const qWhereComplete = Boolean(localWhereLocation?.name?.trim());
  const q5Complete = localGoals.length > 0;

  // Build a set of already-added collaborator identifiers for the picker
  const collaboratorExistingIds = useMemo(() => {
    const ids = new Set<string>();
    localCollaborators.forEach((c) => {
      ids.add(c.id);
      if (c.user_id) ids.add(c.user_id);
    });
    return ids;
  }, [localCollaborators]);

  // Filter suggestions to only show ones not already added
  const availableOrgSuggestions = suggestedCompetencies.filter((s) => !localGoals.includes(s));
  const availableSkillSuggestions = suggestedUserSkills.filter((s) => !localGoals.includes(s) && !suggestedCompetencies.includes(s));
  const competencyPickerSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const suggestions: { id: string; label: string; source?: string }[] = [];
    const addSuggestion = (label: string, source: string) => {
      const clean = label.trim().replace(/\s+/g, ' ');
      const key = normalizeCapabilityLabel(clean);
      if (!clean || seen.has(key)) return;
      seen.add(key);
      suggestions.push({ id: `capability:${source}:${key}`, label: clean, source });
    };
    suggestedUserSkills.forEach((label) => addSuggestion(label, 'Your skills'));
    suggestedCompetencies.forEach((label) => addSuggestion(label, 'Organization framework'));
    return suggestions;
  }, [suggestedCompetencies, suggestedUserSkills]);

  // Brain dump section — use prop data or fall back to step metadata
  const brainDumpData = brainDumpProp ?? (metadata?.brain_dump as BrainDumpData | undefined);
  const showBrainDump = Boolean(brainDumpData !== undefined && onStructureWithAI && !readOnly && !useConversationalCapture);
  const localHasPlanContent = q1Complete || q2Complete || q4Complete || qWhereComplete || q5Complete;
  const [brainDumpExpanded, setBrainDumpExpanded] = useState(!localHasPlanContent);
  const showConversational = Boolean(useConversationalCapture && interestId && currentInterest?.name && !readOnly && !localHasPlanContent && onConversationalCreate);

  if (!step) return null;

  // Course context (if this step was created from a course)
  const courseCtx = (metadata as any)?.course_context as
    | { resource_id: string; course_title?: string; author_or_creator?: string; lesson_id?: string; lesson_index?: number; total_lessons?: number }
    | undefined;

  // Phase 1 · iOS register — when the step-loop flag is on, route through
  // PlanTabIOSRegisterInterior. Same canonicalPlanData/handlers as the
  // PRACTICE_PLAN_TAB branch below so persistence is unchanged.
  if (FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER) {
    const canonicalPlanData: StepPlanData = {
      ...planData,
      what_will_you_do: localWhat,
      how_sub_steps: localSubSteps,
      why_reasoning: localWhy,
      collaborators: localCollaborators,
      capability_goals: localGoals,
      where_location: localWhereLocation,
      connection_space: localConnectionSpace,
    };

    const competencyChips = (planData.competency_ids ?? [])
      .map((id) => {
        const title = Array.from(competencyMapRef.current.entries())
          .find(([, mappedId]) => mappedId === id)?.[0];
        return title ? { id: `comp:${id}`, label: title } : null;
      })
      .filter((x): x is { id: string; label: string } => x !== null);
    const selectedCompetencyLabels = new Set(
      competencyChips.map((chip) => normalizeCapabilityLabel(chip.label)),
    );
    const goalChips = (localGoals ?? [])
      .filter((goal) => !selectedCompetencyLabels.has(normalizeCapabilityLabel(goal)))
      .map((goal) => ({
        id: `goal:${goal}`,
        label: goal,
      }));
    const capabilityChips = [...goalChips, ...competencyChips];

    const handleStepLoopUpdate = (partial: Partial<StepPlanData>) => {
      if (partial.what_will_you_do !== undefined) handleWhatChange(partial.what_will_you_do);
      if (partial.how_sub_steps !== undefined) handleSubStepsChange(partial.how_sub_steps);
      if (partial.why_reasoning !== undefined) handleWhyChange(partial.why_reasoning);
      const remaining = { ...partial };
      delete remaining.what_will_you_do;
      delete remaining.how_sub_steps;
      delete remaining.why_reasoning;
      if (Object.keys(remaining).length > 0) {
        debouncedSave(remaining);
      }
    };

  const handleStepLoopConversationalCreate = (
      conversationalPlan: Partial<StepPlanData>,
      suggestedTitle?: string,
    ) => {
      if (conversationalPlan.what_will_you_do !== undefined) setLocalWhat(conversationalPlan.what_will_you_do);
      if (conversationalPlan.how_sub_steps !== undefined) setLocalSubSteps(conversationalPlan.how_sub_steps);
      if (conversationalPlan.why_reasoning !== undefined) setLocalWhy(conversationalPlan.why_reasoning);
      if (conversationalPlan.collaborators !== undefined) setLocalCollaborators(conversationalPlan.collaborators);
      if (conversationalPlan.capability_goals !== undefined) setLocalGoals(conversationalPlan.capability_goals);
      if (conversationalPlan.where_location !== undefined) setLocalWhereLocation(conversationalPlan.where_location);
      if (conversationalPlan.connection_space !== undefined) setLocalConnectionSpace(conversationalPlan.connection_space);
      debouncedSave(conversationalPlan);
      onConversationalCreate?.(conversationalPlan, suggestedTitle);
    };

    const createSuggestionStepInInterest = async (
      suggestion: { suggestion: string; suggestedCategory?: string },
      targetInterestId: string,
    ) => {
      if (!user?.id) return undefined;
      try {
        const created = await createStep({
          user_id: user.id,
          interest_id: targetInterestId,
          title: stepTitleFromText(suggestion.suggestion),
          status: 'pending',
          source_type: 'manual',
          category: suggestion.suggestedCategory || 'general',
          metadata: { plan: { what_will_you_do: suggestion.suggestion } },
        });
        queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
        return created.id;
      } catch {
        showAlert('Could not create step', 'Please try again.');
        return undefined;
      }
    };

    const handleCreateSuggestionFromRow = (suggestion: {
      sourceInterestSlug: string;
      sourceInterestName: string;
      suggestion: string;
      suggestedCategory?: string;
    }) => {
      const sourceInterest = userInterests.find((i) => i.slug === suggestion.sourceInterestSlug);
      const currentInterestId = interestId;
      const buttons = [];

      if (currentInterestId) {
        buttons.push({
          text: `Create in ${currentInterest?.name || 'this interest'}`,
          onPress: () => {
            void createSuggestionStepInInterest(suggestion, currentInterestId);
          },
        });
      }

      if (sourceInterest?.id && sourceInterest.id !== currentInterestId) {
        buttons.push({
          text: `Create in ${suggestion.sourceInterestName}`,
          onPress: () => {
            void createSuggestionStepInInterest(suggestion, sourceInterest.id);
          },
        });
      }

      buttons.push({ text: 'Cancel', style: 'cancel' as const });

      showAlertWithButtons(
        'Create step from suggestion',
        suggestion.suggestion,
        buttons,
      );
    };

    const mentorInput = crossInterestToMentorInput(
      crossInterestSuggestions ?? [],
      handleCreateSuggestionFromRow,
    );
    const suggestions = buildSuggestions({ mentor: mentorInput });

    // Auto-focus the WHAT field when the step is a freshly-created draft
    // with no plan content yet. The draft flag is set by Universal Plus
    // quick capture; once the user types anything, canonicalPlanData
    // .what_will_you_do flips truthy and subsequent mounts won't refocus
    // (RN's TextInput autoFocus only fires on mount anyway, but gating
    // on emptiness prevents revisits from yanking the keyboard up).
    const stepMetadata = (step.metadata as { draft?: boolean } | null) ?? null;
    const isFreshDraft = Boolean(stepMetadata?.draft);
    const autoFocusWhat =
      isFreshDraft && !canonicalPlanData.what_will_you_do?.trim();

    return (
      <>
        <PlanTabIOSRegisterInterior
          embedded
          rightInset={rightInset}
          autoFocusWhat={autoFocusWhat}
          libraryBefore={libraryBefore}
          planData={canonicalPlanData}
          onUpdate={handleStepLoopUpdate}
          readOnly={readOnly}
          interestId={interestId}
          interestName={currentInterest?.name}
          stepTitle={step.title ?? undefined}
          stepCategory={step.category}
          onConversationalCreate={useConversationalCapture ? handleStepLoopConversationalCreate : undefined}
          capabilities={capabilityChips}
          onRemoveCapability={(id) => {
            if (id.startsWith('goal:')) {
              handleRemoveGoal(id.slice(5));
              return;
            }
            const rawId = id.startsWith('comp:') ? id.slice(5) : id;
            const title = competencyChips.find((chip) => chip.id === `comp:${rawId}`)?.label;
            if (title) {
              handleRemoveGoal(title);
              return;
            }
            const updated = (planData.competency_ids ?? []).filter((c) => c !== rawId);
            debouncedSave({ competency_ids: updated });
          }}
          onAddCapabilityPress={() => setShowCompetencyPicker(true)}
          suggestions={suggestions}
          contextRows={
            <>
              {isAtlasRaceStep ? (
                <View style={styles.atlasRaceCard}>
                  <View style={styles.phase1ContextHead}>
                    <Ionicons name="map-outline" size={12} color={STEP_COLORS.secondaryLabel} />
                    <Text style={styles.phase1ContextEye}>Atlas race context</Text>
                  </View>

                  <Text style={styles.atlasRaceTitle}>
                    {atlasData?.next_event?.label ?? step.title}
                  </Text>
                  <Text style={styles.atlasRaceBody}>
                    {atlasData?.race_course_context?.scrub_title ??
                      'This step came from the race-course map. Start tracking on the water, then save local knowledge back onto the course as its own note layer.'}
                  </Text>

                  <View style={styles.atlasRaceMetaRow}>
                    {atlasData?.race_course_context?.scrub_label ? (
                      <View style={styles.atlasRaceMetaPill}>
                        <Text style={styles.atlasRaceMetaText}>
                          {atlasData.race_course_context.scrub_label.toUpperCase()}
                        </Text>
                      </View>
                    ) : null}
                    {atlasData?.race_course_context?.wind_chip ? (
                      <View style={styles.atlasRaceMetaPill}>
                        <Text style={styles.atlasRaceMetaText}>
                          {atlasData.race_course_context.wind_chip}
                        </Text>
                      </View>
                    ) : null}
                    {atlasData?.race_course_context?.tide_chip ? (
                      <View style={styles.atlasRaceMetaPill}>
                        <Text style={styles.atlasRaceMetaText}>
                          {atlasData.race_course_context.tide_chip}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.atlasRaceHint}>
                    {atlasSpatialSummary
                      ? `${atlasSpatialSummary.markCount} marks · ${atlasSpatialSummary.lineCount} course lines${atlasSpatialSummary.noteCount > 0 ? ` · ${atlasSpatialSummary.noteCount} local notes` : ''} attached to this step’s map plan.`
                      : (atlasData?.local_knowledge_notes?.length ?? 0) > 0
                        ? `${atlasData?.local_knowledge_notes?.length ?? 0} local note${(atlasData?.local_knowledge_notes?.length ?? 0) === 1 ? '' : 's'} saved to this step`
                        : 'GPS tracking, live notes, and post-race notes stay attached to this race-course context as evidence.'}
                  </Text>

                  {!readOnly ? (
                    <View style={styles.atlasRaceActions}>
                      <Pressable
                        style={styles.atlasRacePrimaryButton}
                        onPress={handlePlanLiveTracking}
                      >
                        <Ionicons name="radio-outline" size={15} color="#FFFFFF" />
                        <Text style={styles.atlasRacePrimaryButtonText}>
                          {atlasData?.live_tracking?.status === 'tracking'
                            ? 'Resume GPS track'
                            : 'Track GPS on the water'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.atlasRaceSecondaryButton}
                        onPress={handleOpenRaceMap}
                      >
                        <Ionicons
                          name="navigate-outline"
                          size={15}
                          color={STEP_COLORS.accent}
                        />
                        <Text style={styles.atlasRaceSecondaryButtonText}>
                          Open course map
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.phase1ContextCard}>
                <View style={styles.phase1ContextHead}>
                  <Ionicons name="people-outline" size={12} color={STEP_COLORS.secondaryLabel} />
                  <Text style={styles.phase1ContextEye}>With whom will you do this?</Text>
                </View>

                {localCollaborators.length > 0 ? (
                  <View style={styles.collaboratorChipContainer}>
                    {localCollaborators.map((collab) => (
                      <Pressable
                        key={collab.id}
                        onPress={readOnly ? undefined : () => setRoleEditing(collab)}
                        accessibilityRole={readOnly ? undefined : 'button'}
                        accessibilityLabel={
                          collab.role
                            ? `Change ${collab.display_name}'s role (currently ${collab.role})`
                            : `Assign a role to ${collab.display_name}`
                        }
                        style={[
                          styles.collaboratorChip,
                          collab.type === 'platform' ? styles.collaboratorChipPlatform : styles.collaboratorChipExternal,
                        ]}
                      >
                        {collab.type === 'platform' ? (
                          collab.avatar_emoji ? (
                            <Text style={styles.collaboratorChipEmoji}>{collab.avatar_emoji}</Text>
                          ) : (
                            <Ionicons name="person" size={14} color={STEP_COLORS.accent} />
                          )
                        ) : (
                          <Ionicons name="person-outline" size={14} color={IOS_COLORS.secondaryLabel} />
                        )}
                        <Text
                          style={[
                            styles.collaboratorChipText,
                            collab.type === 'platform' ? styles.collaboratorChipTextPlatform : styles.collaboratorChipTextExternal,
                          ]}
                          numberOfLines={1}
                        >
                          {collab.display_name}
                        </Text>
                        {collab.role ? (
                          <Text style={styles.collaboratorRoleTag} numberOfLines={1}>
                            {collab.role}
                          </Text>
                        ) : null}
                        {collab.type === 'external' && !readOnly && (
                          <Pressable
                            onPress={() => handleShareWithCollaborator(collab.display_name)}
                            hitSlop={6}
                            style={styles.sendLinkButton}
                          >
                            <Ionicons name="send-outline" size={13} color={STEP_COLORS.accent} />
                          </Pressable>
                        )}
                        {!readOnly && (
                          <Pressable onPress={() => handleRemoveCollaborator(collab.id)} hitSlop={6}>
                            <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                          </Pressable>
                        )}
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.phase1ContextHint}>No collaborators yet.</Text>
                )}

                {!readOnly && (
                  <Pressable
                    style={styles.addPeopleButton}
                    onPress={() => setShowAddPeoplePicker(true)}
                  >
                    <Ionicons name="person-add-outline" size={18} color={STEP_COLORS.accent} />
                    <Text style={styles.addPeopleText}>Add people</Text>
                  </Pressable>
                )}
              </View>

              <PlanWhereCard
                location={localWhereLocation}
                readOnly={readOnly}
                onChange={handleLocationChange}
                interestSlug={normalizedSlug || undefined}
                interestName={currentInterest?.name}
                quickPicks={[
                  ...orgLocations.map((loc) => ({
                    id: loc.id,
                    name: loc.name,
                    lat: loc.lat ?? undefined,
                    lng: loc.lng ?? undefined,
                  })),
                  ...locationSuggestions.map((s) => ({
                    id: s.id,
                    name: s.name,
                    lat: s.lat,
                    lng: s.lng,
                  })),
                ]}
              />

              <PlanInServiceOfCard
                targetEventKind={planData.target_event_kind ?? null}
                targetEventId={planData.target_event_id ?? null}
                readOnly={readOnly}
                onChange={handleTargetEventChange}
              />
            </>
          }
          onNextPhase={onNextTab}
          isTimed={Boolean(step.is_timed)}
          onToggleTimed={(next) => {
            queryClient.setQueryData<TimelineStepRecord | undefined>(
              ['timeline-steps', 'detail', step.id],
              (prev) => (prev ? { ...prev, is_timed: next } : prev),
            );
            updateStep.mutate({ stepId: step.id, input: { is_timed: next } });
          }}
          isRace={showRaceSelector ? Boolean(step.is_race) : undefined}
          onToggleRace={
            showRaceSelector
              ? (next) => {
                  queryClient.setQueryData<TimelineStepRecord | undefined>(
                    ['timeline-steps', 'detail', step.id],
                    (prev) => (prev ? { ...prev, is_race: next } : prev),
                  );
                  updateStep.mutate({ stepId: step.id, input: { is_race: next } });
                }
              : undefined
          }
          onOpenRaceCourse={
            showRaceSelector ? () => router.push(`/race/ios/water/${step.id}` as any) : undefined
          }
          courseSummary={raceCourseSummary}
          racePlan={racePlanForMap}
        />

        {!readOnly && (
          <AddToStepPlanSheet
            visible={addPickerDestination !== null}
            destinationLabel={addPickerDestination ?? ''}
            destinationContext={localWhat.trim() || step.title || undefined}
            interestId={interestId}
            excludeKeys={[
              ...linkedIds.map((id) => `resource:${id}`),
              ...linkedConcepts.map((c) => `concept:${c.id}`),
            ]}
            onSelect={(selections: AddToStepPlanSelection[]) => {
              handleSelectPlaybookItems(selections as PlaybookPickerSelection[]);
              closeAddPicker();
            }}
            onClose={closeAddPicker}
          />
        )}

        {!readOnly && (
          <>
            <CollaboratorPicker
              visible={showCollaboratorPicker}
              onClose={() => setShowCollaboratorPicker(false)}
              onAdd={handleAddCollaborator}
              existingIds={collaboratorExistingIds}
            />
            <CollaboratorRolePicker
              visible={!!roleEditing}
              collaboratorName={roleEditing?.display_name ?? ''}
              currentRole={roleEditing?.role}
              onClose={() => setRoleEditing(null)}
              onSelect={(role) => {
                if (roleEditing) {
                  handleSetCollaboratorRole(roleEditing.id, role);
                }
              }}
            />
            <AddPeoplePicker
              visible={showAddPeoplePicker}
              existingUserIds={localCollaborators
                .filter((c) => c.type === 'platform' && c.user_id)
                .map((c) => c.user_id as string)}
              existingRoles={Object.fromEntries(
                localCollaborators
                  .filter((c) => c.type === 'platform' && c.user_id)
                  .map((c) => [c.user_id as string, c.role]),
              )}
              onClose={() => setShowAddPeoplePicker(false)}
              onConfirm={handleConfirmCollaborators}
            />
            <CompetencyPickerModal
              visible={showCompetencyPicker}
              onClose={() => setShowCompetencyPicker(false)}
              selectedIds={planData.competency_ids ?? []}
              onToggle={handleToggleCompetency}
              interestId={interestId ?? ''}
              suggestedCapabilities={competencyPickerSuggestions}
              selectedSuggestedLabels={localGoals}
              onToggleSuggested={handleToggleSuggestedCapability}
            />
            <LocationMapPickerModal
              visible={showLocationPicker}
              onClose={() => setShowLocationPicker(false)}
              onSelectLocation={(loc: { name: string; lat: number; lng: number }) => {
                handleLocationChange({ name: loc.name, lat: loc.lat, lng: loc.lng });
                setShowLocationPicker(false);
              }}
              initialLocation={
                localWhereLocation?.lat != null && localWhereLocation?.lng != null
                  ? { lat: localWhereLocation.lat, lng: localWhereLocation.lng }
                  : null
              }
              initialName={localWhereLocation?.name}
            />
          </>
        )}
      </>
    );
  }

  if (FEATURE_FLAGS.PRACTICE_PLAN_TAB_IOS_REGISTER) {
    const canonicalPlanData: StepPlanData = {
      ...planData,
      what_will_you_do: localWhat,
      how_sub_steps: localSubSteps,
      why_reasoning: localWhy,
      collaborators: localCollaborators,
      capability_goals: localGoals,
      where_location: localWhereLocation,
      connection_space: localConnectionSpace,
    };

    const handleCanonicalUpdate = (partial: Partial<StepPlanData>) => {
      if (partial.what_will_you_do !== undefined) {
        handleWhatChange(partial.what_will_you_do);
      }
      if (partial.how_sub_steps !== undefined) {
        handleSubStepsChange(partial.how_sub_steps);
      }
      if (partial.why_reasoning !== undefined) {
        handleWhyChange(partial.why_reasoning);
      }

      const remaining = { ...partial };
      delete remaining.what_will_you_do;
      delete remaining.how_sub_steps;
      delete remaining.why_reasoning;
      if (Object.keys(remaining).length > 0) {
        debouncedSave(remaining);
      }
    };

    const handleCanonicalConversationalCreate = (conversationalPlan: Partial<StepPlanData>, suggestedTitle?: string) => {
      if (conversationalPlan.what_will_you_do !== undefined) {
        setLocalWhat(conversationalPlan.what_will_you_do);
      }
      if (conversationalPlan.how_sub_steps !== undefined) {
        setLocalSubSteps(conversationalPlan.how_sub_steps);
      }
      if (conversationalPlan.why_reasoning !== undefined) {
        setLocalWhy(conversationalPlan.why_reasoning);
      }
      if (conversationalPlan.collaborators !== undefined) {
        setLocalCollaborators(conversationalPlan.collaborators);
      } else if (conversationalPlan.who_collaborators !== undefined) {
        setLocalCollaborators(
          conversationalPlan.who_collaborators
            .filter((name) => name.trim())
            .map((name, i) => ({
              id: `conv_${i}_${Date.now()}`,
              type: 'external' as const,
              display_name: name.trim(),
            })),
        );
      }
      if (conversationalPlan.capability_goals !== undefined) {
        setLocalGoals(conversationalPlan.capability_goals);
      }
      if (conversationalPlan.where_location !== undefined) {
        setLocalWhereLocation(conversationalPlan.where_location);
      }
      if (conversationalPlan.connection_space !== undefined) {
        setLocalConnectionSpace(conversationalPlan.connection_space);
      }

      debouncedSave(conversationalPlan);
      onConversationalCreate?.(conversationalPlan, suggestedTitle);
    };

    const optionalAddOns = (
      <>
        {courseCtx && courseCtx.course_title && (
          <Pressable
            style={styles.courseContextBanner}
            onPress={() => setShowCourseContext(true)}
          >
            <Ionicons name="school-outline" size={16} color={IOS_COLORS.systemPurple} />
            <Text style={styles.courseContextText}>
              Lesson {(courseCtx.lesson_index ?? 0) + 1} of {courseCtx.total_lessons ?? '?'} in{' '}
              {courseCtx.author_or_creator ? `${courseCtx.author_or_creator}'s ` : ''}
              {courseCtx.course_title}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.systemPurple} />
          </Pressable>
        )}

        {courseCtx && courseCtx.resource_id && (
          <CourseContextSheet
            visible={showCourseContext}
            onClose={() => setShowCourseContext(false)}
            courseContext={courseCtx as { resource_id: string; course_title: string; author_or_creator?: string; lesson_id?: string; lesson_index?: number; total_lessons?: number }}
          />
        )}

        {(linkedResources.length > 0 || linkedConcepts.length > 0 || !readOnly) && (
          <PlanQuestionCard
            icon="library-outline"
            title="ALSO RELEVANT FOR"
            isComplete={linkedResources.length > 0 || linkedConcepts.length > 0}
          >
            {linkedResources.length > 0 && (
              <View style={styles.chipContainer}>
                {linkedResources.map((resource) => (
                  <Pressable
                    key={resource.id}
                    style={styles.resourceChip}
                    onPress={() => { if (resource.url) Linking.openURL(resource.url); }}
                  >
                    <ResourceTypeIcon type={resource.resource_type} size={14} />
                    <Text style={styles.chipText} numberOfLines={1}>{resource.title}</Text>
                    {!readOnly && (
                      <Pressable onPress={() => handleRemoveResource(resource.id)} hitSlop={6}>
                        <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                      </Pressable>
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {linkedConcepts.length > 0 && (
              <View style={styles.conceptsSection}>
                <Text style={styles.conceptsSectionLabel}>FOCUS CONCEPTS</Text>
                {linkedConcepts.map((concept) => (
                  <Pressable
                    key={concept.id}
                    style={styles.conceptCard}
                    onPress={() => {
                      if (concept.slug) {
                        router.push(`/(tabs)/library/concept/${concept.slug}` as any);
                      }
                    }}
                  >
                    <Ionicons name="book-outline" size={16} color={STEP_COLORS.accent} />
                    <Text style={styles.conceptCardTitle} numberOfLines={2}>{concept.title}</Text>
                    {!readOnly && (
                      <Pressable onPress={() => handleRemoveConcept(concept.id)} hitSlop={6}>
                        <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                      </Pressable>
                    )}
                    {concept.slug && <Ionicons name="chevron-forward" size={14} color={IOS_COLORS.systemGray3} />}
                  </Pressable>
                ))}
              </View>
            )}

            {!readOnly && (
              <Pressable style={styles.addLibraryButton} onPress={() => openAddPicker('Also relevant for')}>
                <Ionicons name="bookmarks-outline" size={18} color={STEP_COLORS.accent} />
                <Text style={styles.addLibraryText}>Add from library</Text>
              </Pressable>
            )}
          </PlanQuestionCard>
        )}

        <PlanQuestionCard icon="people-outline" title="WITH WHOM (optional)" isComplete={q4Complete}>
          {localCollaborators.length > 0 && (
            <View style={styles.collaboratorChipContainer}>
              {localCollaborators.map((collab) => (
                <View
                  key={collab.id}
                  style={[
                    styles.collaboratorChip,
                    collab.type === 'platform' ? styles.collaboratorChipPlatform : styles.collaboratorChipExternal,
                  ]}
                >
                  {collab.type === 'platform' ? (
                    collab.avatar_emoji ? (
                      <Text style={styles.collaboratorChipEmoji}>{collab.avatar_emoji}</Text>
                    ) : (
                      <Ionicons name="person" size={14} color={STEP_COLORS.accent} />
                    )
                  ) : (
                    <Ionicons name="person-outline" size={14} color={IOS_COLORS.secondaryLabel} />
                  )}
                  <Text
                    style={[
                      styles.collaboratorChipText,
                      collab.type === 'platform' ? styles.collaboratorChipTextPlatform : styles.collaboratorChipTextExternal,
                    ]}
                    numberOfLines={1}
                  >
                    {collab.display_name}
                  </Text>
                  {collab.type === 'external' && !readOnly && (
                    <Pressable
                      onPress={() => handleShareWithCollaborator(collab.display_name)}
                      hitSlop={6}
                      style={styles.sendLinkButton}
                    >
                      <Ionicons name="send-outline" size={13} color={STEP_COLORS.accent} />
                    </Pressable>
                  )}
                  {!readOnly && (
                    <Pressable onPress={() => handleRemoveCollaborator(collab.id)} hitSlop={6}>
                      <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

          {!readOnly && (
            <Pressable style={styles.addPeopleButton} onPress={() => setShowCollaboratorPicker(true)}>
              <Ionicons name="person-add-outline" size={18} color={STEP_COLORS.accent} />
              <Text style={styles.addPeopleText}>Add people</Text>
            </Pressable>
          )}

          <TextInput
            style={[styles.connectionSpaceInput, readOnly && styles.readOnlyInput]}
            value={localConnectionSpace}
            onChangeText={readOnly ? undefined : handleConnectionSpaceChange}
            placeholder={readOnly ? '' : 'Where will you connect? (online or in person)'}
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            editable={!readOnly}
          />
        </PlanQuestionCard>

        <PlanQuestionCard icon="location-outline" title="WHERE (optional)" isComplete={qWhereComplete}>
          <TextInput
            style={[styles.textArea, { minHeight: 44 }, readOnly && styles.readOnlyInput]}
            value={localWhereLocation?.name ?? ''}
            onChangeText={readOnly ? undefined : (text) => {
              if (!text.trim()) {
                handleLocationChange(undefined);
              } else {
                handleLocationChange({
                  ...(localWhereLocation ?? { name: '' }),
                  name: text,
                });
              }
            }}
            placeholder={readOnly ? '' : 'Location, venue, or address...'}
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            editable={!readOnly}
          />

          {!readOnly && orgLocations.length > 0 && (
            <View style={styles.orgLocationChips}>
              {orgLocations.map((loc) => {
                const isSelected = localWhereLocation?.name === loc.name;
                return (
                  <Pressable
                    key={loc.id}
                    style={[styles.orgLocationChip, isSelected && styles.orgLocationChipSelected]}
                    onPress={() => handleLocationChange({
                      name: loc.name,
                      lat: loc.lat ?? undefined,
                      lng: loc.lng ?? undefined,
                    })}
                  >
                    <Ionicons
                      name="location"
                      size={13}
                      color={isSelected ? STEP_COLORS.accent : IOS_COLORS.secondaryLabel}
                    />
                    <Text
                      style={[styles.orgLocationChipText, isSelected && styles.orgLocationChipTextSelected]}
                      numberOfLines={1}
                    >
                      {loc.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {!readOnly && (
            <Pressable style={styles.addPeopleButton} onPress={() => setShowLocationPicker(true)}>
              <Ionicons name="map-outline" size={18} color={STEP_COLORS.accent} />
              <Text style={styles.addPeopleText}>Pick on map</Text>
            </Pressable>
          )}
        </PlanQuestionCard>

        <PlanQuestionCard icon="trophy-outline" title="CAPABILITIES THIS DEVELOPS" isComplete={q5Complete}>
          {localGoals.length > 0 ? (
            <View style={styles.goalChipContainer}>
              {localGoals.map((goal) => (
                <View key={goal} style={styles.goalChip}>
                  <Text style={styles.goalChipText} numberOfLines={1}>{goal}</Text>
                  {!readOnly && (
                    <Pressable onPress={() => handleRemoveGoal(goal)} hitSlop={6}>
                      <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.goalHint}>No capabilities inferred — tap + to tag</Text>
          )}

          {!readOnly && (
            <>
              <View style={styles.addGoalRow}>
                <TextInput
                  style={styles.addGoalInput}
                  value={newGoalText}
                  onChangeText={setNewGoalText}
                  onSubmitEditing={() => handleAddGoal(newGoalText)}
                  placeholder="Type a skill to track..."
                  placeholderTextColor={IOS_COLORS.tertiaryLabel}
                  returnKeyType="done"
                />
                <Pressable
                  style={[styles.addGoalButton, !newGoalText.trim() && styles.addGoalButtonDisabled]}
                  onPress={() => handleAddGoal(newGoalText)}
                  disabled={!newGoalText.trim()}
                >
                  <Ionicons name="add" size={20} color={newGoalText.trim() ? '#FFFFFF' : IOS_COLORS.systemGray3} />
                </Pressable>
              </View>

              {(availableSkillSuggestions.length > 0 || availableOrgSuggestions.length > 0) && (
                <View style={styles.suggestionsSection}>
                  <Text style={styles.suggestionsLabel}>Suggested capabilities:</Text>
                  <View style={styles.suggestionsWrap}>
                    {[...availableSkillSuggestions, ...availableOrgSuggestions].slice(0, 8).map((skill) => (
                      <Pressable key={skill} style={styles.suggestionChip} onPress={() => handleAddGoal(skill)}>
                        <Ionicons name="add-circle-outline" size={14} color={STEP_COLORS.accent} />
                        <Text style={styles.suggestionChipText} numberOfLines={1}>{skill}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {interestId && (
                <Pressable style={styles.browseCompetenciesBtn} onPress={() => setShowCompetencyPicker(true)}>
                  <Ionicons name="grid-outline" size={14} color={STEP_COLORS.accent} />
                  <Text style={styles.browseCompetenciesText}>Browse All Competencies</Text>
                </Pressable>
              )}
            </>
          )}
        </PlanQuestionCard>

        {planData.date_enrichment && (planData.date_enrichment.wind || planData.date_enrichment.tide || planData.date_enrichment.rig_suggestion || planData.date_enrichment.sail_suggestion) && (
          <View style={styles.conditionsContainer}>
            <DateEnrichmentCard dateLabel="this session" dateIso="" enrichment={planData.date_enrichment} />
          </View>
        )}

        {!readOnly && <FromOtherPlaybooks stepId={stepId} />}

        {!readOnly && (
          <CrossInterestSuggestions
            stepId={stepId}
            interestId={interestId}
            onApplyToStep={(text) => {
              const existing = localSubSteps;
              const newSubStep: SubStep = {
                id: `cross_${Date.now()}`,
                text,
                sort_order: existing.length,
                completed: false,
              };
              const updated = [...existing, newSubStep];
              setLocalSubSteps(updated);
              debouncedSave({ how_sub_steps: updated });
            }}
            onCreateStep={async (suggestion) => {
              if (!user?.id) return undefined;
              const targetInterest = userInterests.find((i) => i.slug === suggestion.sourceInterestSlug);
              if (!targetInterest) return undefined;
              try {
                const created = await createStep({
                  user_id: user.id,
                  interest_id: targetInterest.id,
                  title: stepTitleFromText(suggestion.suggestion),
                  status: 'pending',
                  source_type: 'manual',
                  category: suggestion.suggestedCategory || 'general',
                  metadata: { plan: { what_will_you_do: suggestion.suggestion } },
                });
                return created.id;
              } catch {
                return undefined;
              }
            }}
          />
        )}

        {!readOnly && (
          <>
            <CollaboratorPicker
              visible={showCollaboratorPicker}
              onClose={() => setShowCollaboratorPicker(false)}
              onAdd={handleAddCollaborator}
              existingIds={collaboratorExistingIds}
            />
            <CompetencyPickerModal
              visible={showCompetencyPicker}
              onClose={() => setShowCompetencyPicker(false)}
              selectedIds={planData.competency_ids ?? []}
              onToggle={handleToggleCompetency}
              interestId={interestId ?? ''}
              suggestedCapabilities={competencyPickerSuggestions}
              selectedSuggestedLabels={localGoals}
              onToggleSuggested={handleToggleSuggestedCapability}
            />
          </>
        )}

        {!readOnly && showLocationPicker && (
          <LocationMapPickerModal
            visible={showLocationPicker}
            onClose={() => setShowLocationPicker(false)}
            onSelectLocation={(loc: { name: string; lat: number; lng: number }) => {
              handleLocationChange({ name: loc.name, lat: loc.lat, lng: loc.lng });
              setShowLocationPicker(false);
            }}
            initialLocation={
              localWhereLocation?.lat != null && localWhereLocation?.lng != null
                ? { lat: localWhereLocation.lat, lng: localWhereLocation.lng }
                : null
            }
            initialName={localWhereLocation?.name}
          />
        )}

        {!readOnly && (
          <AddToStepPlanSheet
            visible={addPickerDestination !== null}
            destinationLabel={addPickerDestination ?? ''}
            destinationContext={localWhat.trim() || step?.title || undefined}
            interestId={interestId}
            excludeKeys={[
              ...linkedIds.map((id) => `resource:${id}`),
              ...linkedConcepts.map((c) => `concept:${c.id}`),
            ]}
            onSelect={(selections: AddToStepPlanSelection[]) => {
              handleSelectPlaybookItems(selections as PlaybookPickerSelection[]);
              closeAddPicker();
            }}
            onClose={closeAddPicker}
          />
        )}
      </>
    );

    return (
      <PlanTabInterior
        planData={canonicalPlanData}
        onUpdate={handleCanonicalUpdate}
        readOnly={readOnly}
        interestId={interestId}
        interestName={currentInterest?.name}
        stepTitle={step.title ?? undefined}
        stepCategory={step.category}
        onConversationalCreate={useConversationalCapture ? handleCanonicalConversationalCreate : undefined}
        optionalAddOns={optionalAddOns}
        isTimed={Boolean(step.is_timed)}
        onToggleTimed={(next) => {
          // Optimistic cache write so the Switch flips immediately;
          // useUpdateStep invalidates on success and the refetch confirms.
          queryClient.setQueryData<TimelineStepRecord | undefined>(
            ['timeline-steps', 'detail', step.id],
            (prev) => (prev ? { ...prev, is_timed: next } : prev),
          );
          updateStep.mutate({ stepId: step.id, input: { is_timed: next } });
        }}
        isRace={showRaceSelector ? Boolean(step.is_race) : undefined}
        onToggleRace={
          showRaceSelector
            ? (next) => {
                queryClient.setQueryData<TimelineStepRecord | undefined>(
                  ['timeline-steps', 'detail', step.id],
                  (prev) => (prev ? { ...prev, is_race: next } : prev),
                );
                updateStep.mutate({ stepId: step.id, input: { is_race: next } });
              }
            : undefined
        }
        onOpenRaceCourse={
          showRaceSelector ? () => router.push(`/race/ios/water/${step.id}` as any) : undefined
        }
        courseSummary={raceCourseSummary}
        racePlan={racePlanForMap}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Section header — warmer when empty */}
      <View style={styles.sectionHeader}>
        <Text style={showConversational ? styles.sectionTitleWelcome : styles.sectionTitle}>
          {showConversational ? 'Plan this step' : catLabels.planHeader}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {showConversational
            ? 'Talk it through, or fill in the fields below'
            : catLabels.planSubheader}
        </Text>
      </View>

      {/* Course context banner — tap to see full course */}
      {courseCtx && courseCtx.course_title && (
        <Pressable
          style={styles.courseContextBanner}
          onPress={() => setShowCourseContext(true)}
        >
          <Ionicons name="school-outline" size={16} color={IOS_COLORS.systemPurple} />
          <Text style={styles.courseContextText}>
            Lesson {(courseCtx.lesson_index ?? 0) + 1} of {courseCtx.total_lessons ?? '?'} in{' '}
            {courseCtx.author_or_creator ? `${courseCtx.author_or_creator}'s ` : ''}
            {courseCtx.course_title}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.systemPurple} />
        </Pressable>
      )}

      {/* Course context sheet */}
      {courseCtx && courseCtx.resource_id && (
        <CourseContextSheet
          visible={showCourseContext}
          onClose={() => setShowCourseContext(false)}
          courseContext={courseCtx as { resource_id: string; course_title: string; author_or_creator?: string; lesson_id?: string; lesson_index?: number; total_lessons?: number }}
        />
      )}

      {/* Conversational Capture — chat-first step creation */}
      {showConversational && (
        <View style={styles.brainDumpSection}>
          <ConversationalCapture
            interestId={interestId!}
            interestName={currentInterest?.name || 'this interest'}
            stepTitle={localWhat || 'New step'}
            onCreateStep={onConversationalCreate!}
            embedded
            stepCategory={step?.category}
            // The user just created this step (showConversational gates on
            // "no plan content yet") — drop them straight into the input
            // so a single typing gesture replaces 5 form fields.
            autoFocus
          />
        </View>
      )}

      {/* Brain dump section — collapsible at top (legacy fallback) */}
      {showBrainDump && (
        <View style={styles.brainDumpSection}>
          <Pressable
            style={styles.brainDumpHeader}
            onPress={() => setBrainDumpExpanded((prev) => !prev)}
          >
            <Ionicons name="bulb" size={18} color={STEP_COLORS.accent} />
            <Text style={styles.brainDumpHeaderText}>Quick Capture</Text>
            {brainDumpData?.raw_text?.trim() && (
              <View style={styles.brainDumpBadge}>
                <Ionicons name="checkmark-circle" size={14} color={STEP_COLORS.accent} />
              </View>
            )}
            <Ionicons
              name={brainDumpExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={STEP_COLORS.secondaryLabel}
              style={{ marginLeft: 'auto' }}
            />
          </Pressable>
          {brainDumpExpanded && (
            <BrainDumpEntry
              initialData={brainDumpData}
              onStructureWithAI={onStructureWithAI!}
              onDraftChange={onBrainDumpChange}
              isStructuring={isStructuring}
              interestSlug={interestSlug}
              embedded
            />
          )}
        </View>
      )}

      {/* Manual fields toggle — when conversational input is shown, collapse form fields */}
      {showConversational && !showManualFields && (
        <Pressable
          style={styles.manualFieldsToggle}
          onPress={() => setShowManualFields(true)}
        >
          <Ionicons name="create-outline" size={16} color={IOS_COLORS.systemBlue} />
          <Text style={styles.manualFieldsToggleText}>Fill in manually</Text>
          <Ionicons name="chevron-down" size={14} color={IOS_COLORS.systemBlue} style={{ marginLeft: 'auto' }} />
        </Pressable>
      )}

      {/* Q1: What will you do? — hidden behind toggle when conversational input is the entry point */}
      {(!showConversational || showManualFields) && (<>

      {/* Q1: What will you do? */}
      <PlanQuestionCard
        icon="bulb-outline"
        title="what"
        isComplete={q1Complete}
        defaultExpanded={!q1Complete}
      >
        <TextInput
          style={[styles.textArea, readOnly && styles.readOnlyInput]}
          value={localWhat}
          onChangeText={readOnly ? undefined : handleWhatChange}
          placeholder={readOnly ? '' : catLabels.placeholders.what}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          multiline
          textAlignVertical="top"
          editable={!readOnly}
        />

        {/* AI refinement chat */}
        {!readOnly && refinementChat.length === 0 && (
          <Pressable
            style={styles.aiSuggestButton}
            onPress={handleAISuggest}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={IOS_COLORS.systemPurple} />
                <Text style={styles.aiSuggestText}>Suggest what to focus on</Text>
              </>
            )}
          </Pressable>
        )}

        {refinementChat.length > 0 && (
          <View style={styles.refinementContainer}>
            <View style={styles.aiSuggestionHeader}>
              <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
              <Text style={styles.aiSuggestionLabel}>Suggestion</Text>
            </View>

            {/* Chat thread */}
            {refinementChat.map((msg, i) => (
              <View
                key={`ref_${i}`}
                style={[
                  styles.refinementBubble,
                  msg.role === 'user' ? styles.refinementBubbleUser : styles.refinementBubbleAssistant,
                ]}
              >
                <Text
                  style={[
                    styles.refinementBubbleText,
                    msg.role === 'user' ? styles.refinementBubbleTextUser : styles.refinementBubbleTextAssistant,
                  ]}
                >
                  {msg.content}
                </Text>
              </View>
            ))}

            {aiLoading && (
              <View style={[styles.refinementBubble, styles.refinementBubbleAssistant]}>
                <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
              </View>
            )}

            {/* Refinement input */}
            {!readOnly && (
              <View style={styles.refinementInputRow}>
                <TextInput
                  style={styles.refinementInput}
                  value={refinementInput}
                  onChangeText={setRefinementInput}
                  placeholder={catLabels.refinementPlaceholder}
                  placeholderTextColor={IOS_COLORS.tertiaryLabel}
                  onSubmitEditing={handleRefinementSend}
                  returnKeyType="send"
                  editable={!aiLoading}
                />
                <Pressable
                  style={[styles.refinementSendButton, (!refinementInput.trim() || aiLoading) && styles.refinementSendDisabled]}
                  onPress={handleRefinementSend}
                  disabled={!refinementInput.trim() || aiLoading}
                >
                  <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            )}
          </View>
        )}

        {linkedResources.length > 0 && (
          <View style={styles.chipContainer}>
            {linkedResources.map((resource) => (
              <Pressable
                key={resource.id}
                style={styles.resourceChip}
                onPress={() => { if (resource.url) Linking.openURL(resource.url); }}
              >
                <ResourceTypeIcon type={resource.resource_type} size={14} />
                <Text style={styles.chipText} numberOfLines={1}>{resource.title}</Text>
                {!readOnly && (
                  <Pressable onPress={() => handleRemoveResource(resource.id)} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                  </Pressable>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {linkedConcepts.length > 0 && (
          <View style={styles.conceptsSection}>
            <Text style={styles.conceptsSectionLabel}>FOCUS CONCEPTS</Text>
            {linkedConcepts.map((concept) => (
              <Pressable
                key={concept.id}
                style={styles.conceptCard}
                onPress={() => {
                  if (concept.slug) {
                    router.push(`/(tabs)/library/concept/${concept.slug}` as any);
                  }
                }}
              >
                <Ionicons name="book-outline" size={16} color={STEP_COLORS.accent} />
                <Text style={styles.conceptCardTitle} numberOfLines={2}>{concept.title}</Text>
                {!readOnly && (
                  <Pressable onPress={() => handleRemoveConcept(concept.id)} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                  </Pressable>
                )}
                {concept.slug && <Ionicons name="chevron-forward" size={14} color={IOS_COLORS.systemGray3} />}
              </Pressable>
            ))}
          </View>
        )}

        {!readOnly && (
          <Pressable
            style={styles.addLibraryButton}
            onPress={() => openAddPicker('What')}
          >
            <Ionicons name="bookmarks-outline" size={18} color={STEP_COLORS.accent} />
            <Text style={styles.addLibraryText}>Add from library</Text>
          </Pressable>
        )}
      </PlanQuestionCard>

      {/* Q2: How will you do it? */}
      <PlanQuestionCard
        icon="list-outline"
        title="how"
        isComplete={q2Complete}
        defaultExpanded={q1Complete && !q2Complete}
      >
        <SubStepEditor
          subSteps={localSubSteps}
          onChange={readOnly ? () => {} : handleSubStepsChange}
          readOnly={readOnly}
        />
        {!readOnly && localWhat.trim() && (
          <Pressable
            style={styles.aiSuggestButton}
            onPress={handleGenerateExercises}
            disabled={exercisesLoading}
          >
            {exercisesLoading ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={IOS_COLORS.systemPurple} />
                <Text style={styles.aiSuggestText}>
                  {(() => {
                    const cat = step?.category || 'general';
                    const isReadingCat = cat === 'reading' || cat === 'reading_study';
                    const isFitness = ['strength', 'cardio', 'flexibility', 'workout', 'training', 'exercise'].includes(cat);
                    const label = isReadingCat ? 'tasks' : cat === 'nutrition' ? 'meals' : isFitness ? 'exercises' : 'sub-steps';
                    return q2Complete ? `Regenerate ${label}` : `Generate ${label}`;
                  })()}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </PlanQuestionCard>

      {/* Q3: Why is this next? */}
      <PlanQuestionCard
        icon="help-circle-outline"
        title="why"
        isComplete={q3Complete}
      >
        <TextInput
          style={[styles.textArea, readOnly && styles.readOnlyInput]}
          value={localWhy}
          onChangeText={readOnly ? undefined : handleWhyChange}
          placeholder={readOnly ? '' : catLabels.placeholders.why}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          multiline
          textAlignVertical="top"
          editable={!readOnly}
        />
        {!readOnly && localWhat.trim() && (
          <Pressable
            style={styles.aiSuggestButton}
            onPress={handleGenerateWhy}
            disabled={whyLoading}
          >
            {whyLoading ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={IOS_COLORS.systemPurple} />
                <Text style={styles.aiSuggestText}>
                  {localWhy.trim() ? 'Regenerate why' : 'Generate why'}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </PlanQuestionCard>

      {/* Q4: Who will you do this with? */}
      <PlanQuestionCard
        icon="people-outline"
        title="who"
        isComplete={q4Complete}
      >
        {/* Collaborator chips */}
        {localCollaborators.length > 0 && (
          <View style={styles.collaboratorChipContainer}>
            {localCollaborators.map((collab) => (
              <View
                key={collab.id}
                style={[
                  styles.collaboratorChip,
                  collab.type === 'platform' ? styles.collaboratorChipPlatform : styles.collaboratorChipExternal,
                ]}
              >
                {collab.type === 'platform' ? (
                  collab.avatar_emoji ? (
                    <Text style={styles.collaboratorChipEmoji}>{collab.avatar_emoji}</Text>
                  ) : (
                    <Ionicons name="person" size={14} color={STEP_COLORS.accent} />
                  )
                ) : (
                  <Ionicons name="person-outline" size={14} color={IOS_COLORS.secondaryLabel} />
                )}
                <Text
                  style={[
                    styles.collaboratorChipText,
                    collab.type === 'platform' ? styles.collaboratorChipTextPlatform : styles.collaboratorChipTextExternal,
                  ]}
                  numberOfLines={1}
                >
                  {collab.display_name}
                </Text>
                {collab.type === 'external' && !readOnly && (
                  <Pressable
                    onPress={() => handleShareWithCollaborator(collab.display_name)}
                    hitSlop={6}
                    style={styles.sendLinkButton}
                  >
                    <Ionicons name="send-outline" size={13} color={STEP_COLORS.accent} />
                  </Pressable>
                )}
                {!readOnly && (
                  <Pressable onPress={() => handleRemoveCollaborator(collab.id)} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Add people button */}
        {!readOnly && (
          <Pressable
            style={styles.addPeopleButton}
            onPress={() => setShowCollaboratorPicker(true)}
          >
            <Ionicons name="person-add-outline" size={18} color={STEP_COLORS.accent} />
            <Text style={styles.addPeopleText}>Add people</Text>
          </Pressable>
        )}

        {/* Connection space */}
        <TextInput
          style={[styles.connectionSpaceInput, readOnly && styles.readOnlyInput]}
          value={localConnectionSpace}
          onChangeText={readOnly ? undefined : handleConnectionSpaceChange}
          placeholder={readOnly ? '' : "Where will you connect? (online or in person)"}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          editable={!readOnly}
        />
      </PlanQuestionCard>

      {/* Collaborator picker modal */}
      {!readOnly && (
        <CollaboratorPicker
          visible={showCollaboratorPicker}
          onClose={() => setShowCollaboratorPicker(false)}
          onAdd={handleAddCollaborator}
          existingIds={collaboratorExistingIds}
        />
      )}

      {/* Where will you do this? */}
      <PlanQuestionCard
        icon="location-outline"
        title="where"
        isComplete={qWhereComplete}
      >
        <TextInput
          style={[styles.textArea, { minHeight: 44 }, readOnly && styles.readOnlyInput]}
          value={localWhereLocation?.name ?? ''}
          onChangeText={readOnly ? undefined : (text) => {
            if (!text.trim()) {
              handleLocationChange(undefined);
            } else {
              handleLocationChange({
                ...(localWhereLocation ?? { name: '' }),
                name: text,
              });
            }
          }}
          placeholder={readOnly ? '' : "Location, venue, or address..."}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          editable={!readOnly}
        />

        {/* Org-defined location quick picks */}
        {!readOnly && orgLocations.length > 0 && (
          <View style={styles.orgLocationChips}>
            {orgLocations.map((loc) => {
              const isSelected = localWhereLocation?.name === loc.name;
              return (
                <Pressable
                  key={loc.id}
                  style={[styles.orgLocationChip, isSelected && styles.orgLocationChipSelected]}
                  onPress={() => handleLocationChange({
                    name: loc.name,
                    lat: loc.lat ?? undefined,
                    lng: loc.lng ?? undefined,
                  })}
                >
                  <Ionicons
                    name="location"
                    size={13}
                    color={isSelected ? STEP_COLORS.accent : IOS_COLORS.secondaryLabel}
                  />
                  <Text
                    style={[styles.orgLocationChipText, isSelected && styles.orgLocationChipTextSelected]}
                    numberOfLines={1}
                  >
                    {loc.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Map preview when coordinates are set */}
        {localWhereLocation?.lat != null && localWhereLocation?.lng != null && (
          <View style={styles.mapPreview}>
            <View style={styles.mapPreviewPin}>
              <Ionicons name="location" size={20} color={STEP_COLORS.accent} />
              <Text style={styles.mapPreviewCoords}>
                {localWhereLocation.lat.toFixed(4)}, {localWhereLocation.lng.toFixed(4)}
              </Text>
            </View>
            {!readOnly && (
              <Pressable
                onPress={() => handleLocationChange({
                  ...localWhereLocation!,
                  lat: undefined,
                  lng: undefined,
                })}
                hitSlop={6}
              >
                <Ionicons name="close-circle" size={18} color={IOS_COLORS.systemGray3} />
              </Pressable>
            )}
          </View>
        )}

        {!readOnly && (
          <Pressable
            style={styles.addPeopleButton}
            onPress={() => setShowLocationPicker(true)}
          >
            <Ionicons name="map-outline" size={18} color={STEP_COLORS.accent} />
            <Text style={styles.addPeopleText}>Pick on map</Text>
          </Pressable>
        )}
      </PlanQuestionCard>

      {/* Location map picker modal */}
      {!readOnly && showLocationPicker && (
        <LocationMapPickerModal
          visible={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          onSelectLocation={(loc: { name: string; lat: number; lng: number }) => {
            handleLocationChange({ name: loc.name, lat: loc.lat, lng: loc.lng });
            setShowLocationPicker(false);
          }}
          initialLocation={
            localWhereLocation?.lat != null && localWhereLocation?.lng != null
              ? { lat: localWhereLocation.lat, lng: localWhereLocation.lng }
              : null
          }
          initialName={localWhereLocation?.name}
        />
      )}

      {/* Q5: What skills are you developing? */}
      <PlanQuestionCard
        icon="trophy-outline"
        title="building toward"
        isComplete={q5Complete}
      >
        {/* Current goals as chips */}
        {localGoals.length > 0 && (
          <View style={styles.goalChipContainer}>
            {localGoals.map((goal) => (
              <View key={goal} style={styles.goalChip}>
                <Text style={styles.goalChipText} numberOfLines={1}>{goal}</Text>
                {!readOnly && (
                  <Pressable onPress={() => handleRemoveGoal(goal)} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {!readOnly && (
          <>
            {/* Add custom goal */}
            <View style={styles.addGoalRow}>
              <TextInput
                style={styles.addGoalInput}
                value={newGoalText}
                onChangeText={setNewGoalText}
                onSubmitEditing={() => handleAddGoal(newGoalText)}
                placeholder="Type a skill to track..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                returnKeyType="done"
              />
              <Pressable
                style={[styles.addGoalButton, !newGoalText.trim() && styles.addGoalButtonDisabled]}
                onPress={() => handleAddGoal(newGoalText)}
                disabled={!newGoalText.trim()}
              >
                <Ionicons name="add" size={20} color={newGoalText.trim() ? '#FFFFFF' : IOS_COLORS.systemGray3} />
              </Pressable>
            </View>

            {/* Suggestions from user's Reflect skills */}
            {availableSkillSuggestions.length > 0 && (
              <View style={styles.suggestionsSection}>
                <Text style={styles.suggestionsLabel}>From your skills:</Text>
                <View style={styles.suggestionsWrap}>
                  {availableSkillSuggestions.slice(0, 8).map((skill) => (
                    <Pressable
                      key={skill}
                      style={styles.suggestionChip}
                      onPress={() => handleAddGoal(skill)}
                    >
                      <Ionicons name="add-circle-outline" size={14} color={STEP_COLORS.accent} />
                      <Text style={styles.suggestionChipText} numberOfLines={1}>{skill}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Suggestions from org competencies */}
            {availableOrgSuggestions.length > 0 && (
              <View style={styles.suggestionsSection}>
                <Text style={styles.suggestionsLabel}>From your organization:</Text>
                <View style={styles.suggestionsWrap}>
                  {availableOrgSuggestions.slice(0, 8).map((comp) => (
                    <Pressable
                      key={comp}
                      style={styles.suggestionChip}
                      onPress={() => handleAddGoal(comp)}
                    >
                      <Ionicons name="add-circle-outline" size={14} color={STEP_COLORS.accent} />
                      <Text style={styles.suggestionChipText} numberOfLines={1}>{comp}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {localGoals.length === 0 && availableSkillSuggestions.length === 0 && availableOrgSuggestions.length === 0 && (
              <Text style={styles.goalHint}>
                Add skills you want to improve. You'll rate your progress during review.
              </Text>
            )}

            {/* Browse all competencies button */}
            {interestId && (
              <Pressable
                style={styles.browseCompetenciesBtn}
                onPress={() => setShowCompetencyPicker(true)}
              >
                <Ionicons name="grid-outline" size={14} color={STEP_COLORS.accent} />
                <Text style={styles.browseCompetenciesText}>Browse All Competencies</Text>
              </Pressable>
            )}

            <CompetencyPickerModal
              visible={showCompetencyPicker}
              onClose={() => setShowCompetencyPicker(false)}
              selectedIds={planData.competency_ids ?? []}
              onToggle={handleToggleCompetency}
              interestId={interestId ?? ''}
              suggestedCapabilities={competencyPickerSuggestions}
              selectedSuggestedLabels={localGoals}
              onToggleSuggested={handleToggleSuggestedCapability}
            />
          </>
        )}
      </PlanQuestionCard>

      {/* Conditions card (wind, tide, rig/sail) */}
      {planData.date_enrichment && (planData.date_enrichment.wind || planData.date_enrichment.tide || planData.date_enrichment.rig_suggestion || planData.date_enrichment.sail_suggestion) && (
        <View style={styles.conditionsContainer}>
          <DateEnrichmentCard
            dateLabel="this session"
            dateIso=""
            enrichment={planData.date_enrichment}
          />
        </View>
      )}

      {/* From other Playbooks — cross_interest_idea suggestions from the AI queue */}
      {!readOnly && <FromOtherPlaybooks stepId={stepId} />}

      {/* Cross-interest suggestions */}
      {!readOnly && <CrossInterestSuggestions
        stepId={stepId}
        interestId={interestId}
        onApplyToStep={(text) => {
          // Add the suggestion as a sub-step so it's visible in "How will you do it?"
          const existing = localSubSteps;
          const newSubStep: SubStep = {
            id: `cross_${Date.now()}`,
            text,
            sort_order: existing.length,
            completed: false,
          };
          const updated = [...existing, newSubStep];
          setLocalSubSteps(updated);
          debouncedSave({ how_sub_steps: updated });
        }}
        onCreateStep={async (suggestion) => {
          if (!user?.id) return undefined;
          const targetInterest = userInterests.find((i) => i.slug === suggestion.sourceInterestSlug);
          if (!targetInterest) return undefined;
          try {
            const created = await createStep({
              user_id: user.id,
              interest_id: targetInterest.id,
              title: stepTitleFromText(suggestion.suggestion),
              status: 'pending',
              source_type: 'manual',
              category: suggestion.suggestedCategory || 'general',
              metadata: { plan: { what_will_you_do: suggestion.suggestion } },
            });
            return created.id;
          } catch {
            return undefined;
          }
        }}
      />}

      </>)}

      {/* iOS-register Add-to-step-plan sheet */}
      {!readOnly && (
        <AddToStepPlanSheet
          visible={addPickerDestination !== null}
          destinationLabel={addPickerDestination ?? ''}
          destinationContext={localWhat.trim() || step?.title || undefined}
          interestId={interestId}
          excludeKeys={[
            ...linkedIds.map((id) => `resource:${id}`),
            ...linkedConcepts.map((c) => `concept:${c.id}`),
          ]}
          onSelect={(selections: AddToStepPlanSelection[]) => {
            handleSelectPlaybookItems(selections as PlaybookPickerSelection[]);
            closeAddPicker();
          }}
          onClose={closeAddPicker}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.md,
  },
  brainDumpSection: {
    backgroundColor: STEP_COLORS.headerBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STEP_COLORS.border,
    marginBottom: IOS_SPACING.md,
    overflow: 'hidden',
  },
  brainDumpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.sm,
  },
  brainDumpHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: STEP_COLORS.label,
  },
  brainDumpBadge: {
    marginLeft: 4,
  },
  manualFieldsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  manualFieldsToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
  sectionHeader: {
    marginBottom: IOS_SPACING.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },
  sectionTitleWelcome: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
  },
  courseContextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(175,82,222,0.08)',
    borderRadius: 10,
    padding: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.sm,
  },
  courseContextText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.systemPurple,
    lineHeight: 18,
  },
  textArea: {
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    padding: IOS_SPACING.sm,
    minHeight: 80,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        resize: 'vertical',
      } as any,
    }),
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.xs,
    marginTop: IOS_SPACING.sm,
  },
  resourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  conceptsSection: {
    gap: 6,
    marginTop: 4,
  },
  conceptsSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 1,
  },
  conceptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  conceptCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
  },
  chipText: {
    fontSize: 13,
    color: IOS_COLORS.label,
    fontWeight: '500',
    flexShrink: 1,
  },
  aiSuggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(175,82,222,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: IOS_SPACING.xs,
  },
  aiSuggestText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemPurple,
  },
  aiSuggestionBox: {
    backgroundColor: 'rgba(175,82,222,0.06)',
    borderRadius: 10,
    padding: IOS_SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.15)',
    marginTop: IOS_SPACING.xs,
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  aiSuggestionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.systemPurple,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiSuggestionText: {
    fontSize: 14,
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
  // Refinement chat
  refinementContainer: {
    backgroundColor: 'rgba(175,82,222,0.06)',
    borderRadius: 10,
    padding: IOS_SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.15)',
    marginTop: IOS_SPACING.xs,
    gap: 8,
  },
  refinementBubble: {
    borderRadius: 10,
    padding: 10,
    maxWidth: '88%',
  } as any,
  refinementBubbleAssistant: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.12)',
  },
  refinementBubbleUser: {
    backgroundColor: IOS_COLORS.systemPurple,
    alignSelf: 'flex-end',
  },
  refinementBubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  refinementBubbleTextAssistant: {
    color: IOS_COLORS.label,
  },
  refinementBubbleTextUser: {
    color: '#FFFFFF',
  },
  refinementInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  refinementInput: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.label,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  refinementSendButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: IOS_COLORS.systemPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refinementSendDisabled: {
    opacity: 0.35,
  },
  addLibraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.xs,
  },
  addLibraryText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
  goalChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.xs,
    marginBottom: IOS_SPACING.sm,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,149,0,0.1)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  goalChipText: {
    fontSize: 13,
    color: IOS_COLORS.systemOrange,
    fontWeight: '600',
    flexShrink: 1,
  },
  addGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  addGoalInput: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 8,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  addGoalButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.systemOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGoalButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray5,
  },
  suggestionsSection: {
    marginTop: IOS_SPACING.sm,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: STEP_COLORS.accentLight,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: STEP_COLORS.accentLight,
  },
  suggestionChipText: {
    fontSize: 12,
    color: STEP_COLORS.accent,
    fontWeight: '500',
    maxWidth: 160,
  },
  goalHint: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
    marginTop: 4,
  },
  browseCompetenciesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_COLORS.accent,
    alignSelf: 'flex-start',
  },
  browseCompetenciesText: {
    fontSize: 13,
    color: STEP_COLORS.accent,
    fontWeight: '600',
  },
  collaboratorChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.xs,
    marginBottom: IOS_SPACING.sm,
  },
  collaboratorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  collaboratorChipPlatform: {
    backgroundColor: STEP_COLORS.accentLight,
  },
  collaboratorChipExternal: {
    backgroundColor: IOS_COLORS.systemGray6,
  },
  sendLinkButton: {
    marginLeft: 2,
    padding: 2,
  },
  collaboratorChipEmoji: {
    fontSize: 14,
  },
  collaboratorChipText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  collaboratorRoleTag: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.2,
    textTransform: 'lowercase',
    marginLeft: 2,
  },
  collaboratorChipTextPlatform: {
    color: STEP_COLORS.accent,
  },
  collaboratorChipTextExternal: {
    color: IOS_COLORS.label,
  },
  addPeopleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.xs,
  },
  addPeopleText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
  connectionSpaceInput: {
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 8,
    marginTop: IOS_SPACING.sm,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  orgLocationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: IOS_SPACING.xs,
  },
  orgLocationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  orgLocationChipSelected: {
    backgroundColor: STEP_COLORS.accentLight,
    borderColor: STEP_COLORS.accent,
  },
  orgLocationChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    maxWidth: 180,
  },
  orgLocationChipTextSelected: {
    color: STEP_COLORS.accent,
    fontWeight: '600',
  },
  mapPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: STEP_COLORS.accentLight,
    borderRadius: 8,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 8,
    marginTop: IOS_SPACING.xs,
  },
  mapPreviewPin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapPreviewCoords: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  phase1ContextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  atlasRaceCard: {
    backgroundColor: '#FFF8EE',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(190, 144, 72, 0.34)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  atlasRaceTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '700',
    color: STEP_COLORS.label,
    letterSpacing: -0.2,
  },
  atlasRaceBody: {
    fontSize: 13,
    lineHeight: 19,
    color: IOS_COLORS.secondaryLabel,
  },
  atlasRaceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  atlasRaceMetaPill: {
    backgroundColor: 'rgba(190, 144, 72, 0.14)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  atlasRaceMetaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A6C20',
    letterSpacing: 0.2,
  },
  atlasRaceHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  atlasRaceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  atlasRacePrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: STEP_COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  atlasRacePrimaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  atlasRaceSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  atlasRaceSecondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_COLORS.accent,
  },
  phase1ContextHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phase1ContextEye: {
    fontSize: 10,
    fontWeight: '700',
    color: STEP_COLORS.secondaryLabel,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  phase1ContextHint: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  phase1ContextInput: {
    fontSize: 13.5,
    color: STEP_COLORS.label,
    letterSpacing: -0.05,
    lineHeight: 19,
    padding: 0,
    minHeight: 22,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'none', overflow: 'hidden' } as any,
    }),
  },
  conditionsContainer: {
    marginTop: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.sm,
  },
  readOnlyInput: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: IOS_COLORS.secondaryLabel,
  },
});
