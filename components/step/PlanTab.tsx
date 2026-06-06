/**
 * PlanTab — 4 guided planning questions for a step.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { STEP_COLORS } from '@/lib/step-theme';
import { PlanQuestionCard } from './PlanQuestionCard';
import { SubStepEditor } from './SubStepEditor';
import { BrainDumpEntry } from './BrainDumpEntry';
import { ConversationalCapture } from './ConversationalCapture';
import type { PlaybookPickerSelection } from '@/components/playbook/PlaybookPicker';
import { AddToStepPlanSheet, type AddToStepPlanSelection } from './AddToStepPlanSheet';
import { ResourceTypeIcon } from '@/components/library-resources/ResourceTypeIcon';
import { getResourcesByIds } from '@/services/LibraryService';
import { addStepLink, removeStepLink, getStepConceptLinks, getStepLinks, linkConceptToStep, unlinkConceptFromStep } from '@/services/PlaybookService';
import { supabase } from '@/services/supabase';
import { CrossInterestSuggestions } from './CrossInterestSuggestions';
import { FromOtherPlaybooks } from './FromOtherPlaybooks';
import { DateEnrichmentCard } from './DateEnrichmentCard';
import { createStep } from '@/services/TimelineStepService';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import type { StepPlanData, StepCollaborator, StepLocation, SubStep, BrainDumpData, RacePlan } from '@/types/step-detail';
import type { LibraryResourceRecord } from '@/types/library';
import type { Competency } from '@/types/competency';
import { useCompetenciesForInterest } from '@/hooks/useCompetencies';
import { CollaboratorPicker } from './CollaboratorPicker';
import { LocationMapPicker as LocationMapPickerModal } from '@/components/races/LocationMapPicker';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { getStepCategoryLabels } from '@/lib/step-category-config';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { PlanTabInterior, PlanTabIOSRegisterInterior } from './plan-tab';
import { PlanWithCard } from './plan-tab/PlanWithCard';
import { PlanWhereCard } from './plan-tab/PlanWhereCard';
import { useLibraryBeforeBinding } from '@/hooks/useStepLibraryBefore';
import { useCrossInterestSuggestions } from '@/hooks/useCrossInterestSuggestions';
import { useStepBeatsBinding } from '@/hooks/useStepBeats';
import { BeatsList } from '@/components/step/do-tab/BeatsList';
import { CompetencyPickerModal } from '@/components/competency/CompetencyPickerModal';

interface PlanTabProps {
  stepId?: string;
  planData: StepPlanData;
  interestId: string | undefined;
  onUpdate: (data: Partial<StepPlanData>) => void;
  onNextTab?: () => void;
  readOnly?: boolean;
  footer?: React.ReactNode;
  /** Brain dump integration — shown as collapsible section at top */
  brainDumpData?: BrainDumpData;
  onBrainDumpChange?: (dump: BrainDumpData) => void;
  onStructureWithAI?: (dump: BrainDumpData) => void;
  isStructuring?: boolean;
  hasPlanContent?: boolean;
  interestSlug?: string;
  interestName?: string;
  /** When true, show conversational capture instead of brain dump for new steps */
  useConversationalCapture?: boolean;
  onConversationalCreate?: (planData: Partial<StepPlanData>, suggestedTitle?: string) => void;
  /** Step category for subtype-aware labels (e.g. 'nutrition', 'strength') */
  stepCategory?: string;
  /**
   * Phase N.4 — the Step ⟷ Race selector. Pass all three (sailing only) to
   * surface it at the top of the Plan tab; omit them on non-sailing interests
   * and the selector stays hidden. `isRace` reflects the step's is_race flag,
   * `onToggleRace` persists the change, `onOpenRaceCourse` opens the on-water
   * course/marks/conditions screen.
   */
  isRace?: boolean;
  onToggleRace?: (next: boolean) => void;
  onOpenRaceCourse?: () => void;
  /** Opens Atlas centered on the saved race area/course. */
  onOpenRaceCourseAtlas?: () => void;
  /** One-line summary of the saved race plan, shown on the reveal row. */
  courseSummary?: string;
  /** Saved race plan; drives the course map once an area is set. */
  racePlan?: Pick<
    RacePlan,
    'area_id' | 'area_name' | 'center' | 'course_label' | 'laps' | 'course_type'
  >;
  /** Render the live Atlas map instead of the schematic (detail view only). */
  liveMap?: boolean;
  /**
   * The race's scheduled time (step.starts_at). The live course map forecasts
   * wind/current/wave for THIS moment — not "now" — and orients the course to
   * the forecast wind. Null/absent ⇒ the map says conditions need a race time.
   */
  raceTime?: string | null;
  /**
   * Right gutter (pt) so the tab body clears the floating zoom rail on the
   * standalone step-detail screen. Forwarded to PlanTabIOSRegisterInterior.
   */
  rightInset?: number;
  /**
   * When true, the tab body renders without its own ScrollView so the
   * parent (e.g. StepCard scrollAsUnit) can scroll the whole card. Only
   * honored on the PRACTICE_STEP_LOOP_IOS_REGISTER branch.
   */
  embedded?: boolean;
}

const FREEFORM_CAPABILITY_PREFIX = 'capability-goal:';

function freeformCapabilityId(label: string): string {
  return `${FREEFORM_CAPABILITY_PREFIX}${label}`;
}

function normalizeCapability(label: string): string {
  return label.trim().toLowerCase();
}

function titleCaseCapability(raw: string): string {
  return raw
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function addCapabilityCandidate(
  out: { id: string; label: string; source?: string }[],
  label: string,
  source?: string,
) {
  const clean = titleCaseCapability(label);
  if (clean.length < 3) return;
  if (out.some((item) => normalizeCapability(item.label) === normalizeCapability(clean))) return;
  out.push({
    id: `suggested:${normalizeCapability(clean).replace(/\s+/g, '-')}`,
    label: clean,
    source,
  });
}

function buildSuggestedCapabilityTags({
  planData,
  suggestions,
}: {
  planData: StepPlanData;
  suggestions: { suggestion: string; sourceInterestName?: string }[];
}): { id: string; label: string; source?: string }[] {
  const out: { id: string; label: string; source?: string }[] = [];
  for (const goal of planData.capability_goals ?? []) {
    addCapabilityCandidate(out, goal, 'Already on this step');
  }

  const text = [
    planData.what_will_you_do,
    planData.why_reasoning,
    ...suggestions.map((s) => s.suggestion),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('first aid')) addCapabilityCandidate(out, 'First aid readiness', 'Suggested from step text');
  if (text.includes('rescue')) addCapabilityCandidate(out, 'Rescue fundamentals', 'Suggested from step text');
  if (text.includes('emergenc')) addCapabilityCandidate(out, 'Emergency response', 'Suggested from step text');
  if (text.includes('visual') || text.includes('infographic') || text.includes('diagram')) {
    addCapabilityCandidate(out, 'Visual instruction', 'Suggested from network');
  }
  if (text.includes('carry') || text.includes('transfer')) {
    addCapabilityCandidate(out, 'Safe transfer mechanics', 'Suggested from network');
  }
  if (text.includes('culturally') || text.includes('sensitive')) {
    addCapabilityCandidate(out, 'Culturally responsive care', 'Suggested from network');
  }

  for (const s of suggestions) {
    const firstPhrase = s.suggestion.split(/[,.;:()]/)[0] ?? '';
    addCapabilityCandidate(
      out,
      firstPhrase
        .replace(/^(design|create|practice|research|learn|review|build)\s+/i, '')
        .replace(/\b(clear|basic|new)\b/gi, ''),
      s.sourceInterestName ? `From ${s.sourceInterestName}` : 'Suggested from network',
    );
  }

  return out.slice(0, 8);
}

export function PlanTab({
  stepId, planData, interestId, onUpdate, onNextTab, readOnly, footer,
  brainDumpData, onBrainDumpChange, onStructureWithAI,
  isStructuring, hasPlanContent, interestSlug, interestName,
  useConversationalCapture, onConversationalCreate, stepCategory,
  isRace, onToggleRace, onOpenRaceCourse, onOpenRaceCourseAtlas, courseSummary, racePlan, liveMap,
  raceTime, rightInset,
  embedded,
}: PlanTabProps) {
  const { user } = useAuth();
  const catLabels = getStepCategoryLabels(stepCategory);
  const { userInterests } = useInterest();
  const [addPickerDestination, setAddPickerDestination] = useState<string | null>(null);
  const openAddPicker = useCallback((destination: string) => setAddPickerDestination(destination), []);
  const closeAddPicker = useCallback(() => setAddPickerDestination(null), []);
  const [showCollaboratorPicker, setShowCollaboratorPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showCompetencyPicker, setShowCompetencyPicker] = useState(false);
  const [linkedResources, setLinkedResources] = useState<LibraryResourceRecord[]>([]);
  const [linkedConcepts, setLinkedConcepts] = useState<{ id: string; title: string; slug?: string }[]>([]);
  const { data: availableCompetencies } = useCompetenciesForInterest(interestId);
  const [competencySearch, setCompetencySearch] = useState('');

  // Load linked resources on mount and when IDs change
  const linkedIds = planData.linked_resource_ids ?? [];
  useEffect(() => {
    if (linkedIds.length === 0) {
      setLinkedResources([]);
      return;
    }
    getResourcesByIds(linkedIds).then(setLinkedResources).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedIds.join(',')]);

  // Load linked concepts from step_concept_links (Phase 6), falling back to the
  // older generic typed links when the dedicated table is not available yet.
  useEffect(() => {
    if (!stepId) return;
    let cancelled = false;
    async function loadConcepts() {
      try {
        let conceptIds: string[] = [];
        try {
          const links = await getStepConceptLinks(stepId!);
          conceptIds = links.map((l) => l.concept_id);
        } catch {
          const links = await getStepLinks(stepId!);
          conceptIds = links.filter((l) => l.item_type === 'concept').map((l) => l.item_id);
        }
        if (conceptIds.length === 0) {
          if (!cancelled) setLinkedConcepts([]);
          return;
        }
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

  const handleSelectPlaybookItems = useCallback(async (selections: PlaybookPickerSelection[]) => {
    // Dual-write: maintain linked_resource_ids for resource-type selections (one-release migration safety)
    const newResourceIds = selections
      .filter((s) => s.item_type === 'resource')
      .map((s) => s.item_id);
    if (newResourceIds.length > 0) {
      const existingIds = planData.linked_resource_ids ?? [];
      const mergedIds = [...new Set([...existingIds, ...newResourceIds])];
      onUpdate({ linked_resource_ids: mergedIds });
    }
    // Write concept links through the Phase 6 dedicated table (which also
    // dual-writes the older generic step_playbook_links table internally).
    if (stepId) {
      await Promise.all(
        selections.map((s) =>
          s.item_type === 'concept'
            ? linkConceptToStep(stepId!, s.item_id).catch((err) => {
                console.error('[PlanTab] linkConceptToStep failed:', s.item_id, err);
              })
            : addStepLink(stepId!, s.item_type, s.item_id).catch((err) => {
                console.error('[PlanTab] addStepLink failed:', s.item_type, s.item_id, err);
              })
        )
      );
    }
    // Optimistically add concept selections to the UI
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
  }, [planData.linked_resource_ids, onUpdate, stepId]);

  const handleRemoveResource = useCallback((resourceId: string) => {
    const updated = (planData.linked_resource_ids ?? []).filter((id) => id !== resourceId);
    onUpdate({ linked_resource_ids: updated });
  }, [planData.linked_resource_ids, onUpdate]);

  const handleRemoveConcept = useCallback(async (conceptId: string) => {
    setLinkedConcepts((prev) => prev.filter((c) => c.id !== conceptId));
    if (stepId) {
      await unlinkConceptFromStep(stepId, conceptId).catch(() => removeStepLink(stepId, 'concept', conceptId).catch(() => {}));
    }
  }, [stepId]);

  const handleSubStepsChange = useCallback((subSteps: SubStep[]) => {
    onUpdate({ how_sub_steps: subSteps });
  }, [onUpdate]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const collaborators = planData.collaborators ?? [];
  const existingCollaboratorIds = useMemo(
    () => new Set(collaborators.map((c) => c.user_id ?? c.id)),
    [collaborators]
  );

  const handleAddCollaborator = useCallback((collab: StepCollaborator) => {
    const updated = [...(planData.collaborators ?? []), collab];
    const legacyNames = updated.map((c) => c.display_name);
    onUpdate({ collaborators: updated, who_collaborators: legacyNames });
  }, [planData.collaborators, onUpdate]);

  const handleRemoveCollaborator = useCallback((collabId: string) => {
    const updated = (planData.collaborators ?? []).filter((c) => c.id !== collabId);
    const legacyNames = updated.map((c) => c.display_name);
    onUpdate({ collaborators: updated, who_collaborators: legacyNames });
  }, [planData.collaborators, onUpdate]);

  const handleLocationChange = useCallback((location: StepLocation | undefined) => {
    onUpdate({ where_location: location });
  }, [onUpdate]);

  const handleCollaboratorsChange = useCallback(
    (next: StepCollaborator[]) => {
      // Metadata write also triggers step_collaborators sync — see
      // updateStepMetadata in services/TimelineStepService.ts.
      onUpdate({
        collaborators: next,
        who_collaborators: next.map((c) => c.display_name),
      });
    },
    [onUpdate],
  );

  // Brain dump visibility — expanded by default when plan is empty, collapsed when has content
  const showBrainDump = Boolean(brainDumpData !== undefined && onStructureWithAI);
  const [brainDumpExpanded, setBrainDumpExpanded] = useState(!hasPlanContent);

  const q1Complete = Boolean(planData.what_will_you_do?.trim() || linkedIds.length > 0);
  const q2Complete = Boolean(planData.how_sub_steps?.length && planData.how_sub_steps.some((s) => s.text.trim()));
  const q3Complete = Boolean(planData.why_reasoning?.trim());
  const q4Complete = Boolean(collaborators.length > 0 || (planData.who_collaborators?.length && planData.who_collaborators.some((c) => c.trim())));
  const q5Complete = Boolean(planData.where_location?.name?.trim());

  // Mentor-channel suggestions for the Phase 1 SuggestionsRow.
  const { suggestions: crossInterestSuggestions } = useCrossInterestSuggestions(
    stepId,
    interestId,
    planData.what_will_you_do,
  );

  // D37 "Before the shift" library checklist binding. Resolved once at this
  // level so both the step-loop and PRACTICE_PLAN_TAB branches can pass it
  // down — hook always runs, the body just reads `items.length > 0`.
  const libraryBefore = useLibraryBeforeBinding(stepId, interestId);

  // Phase 1 · iOS register — Plan tab body rebuild. When the step-loop flag
  // is on this branch takes precedence over the older PRACTICE_PLAN_TAB
  // path; off-flag, both this and the PRACTICE_PLAN_TAB branch below are
  // skipped and the legacy question-card render at the bottom of this file
  // runs unchanged.
  if (FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER) {
    const capabilityChips = (planData.competency_ids ?? [])
      .map((id) => {
        const comp = (availableCompetencies ?? []).find((c: Competency) => c.id === id);
        return comp ? { id: comp.id, label: comp.title } : null;
      })
      .filter((x): x is { id: string; label: string } => x !== null)
      .concat(
        (planData.capability_goals ?? []).map((label) => ({
          id: freeformCapabilityId(label),
          label,
        })),
      );
    const suggestedCapabilities = buildSuggestedCapabilityTags({
      planData,
      suggestions: crossInterestSuggestions ?? [],
    });

    return (
      <>
        <PlanTabIOSRegisterInterior
          embedded={embedded}
          planData={planData}
          onUpdate={onUpdate}
          readOnly={readOnly}
          interestId={interestId}
          interestSlug={interestSlug}
          interestName={interestName}
          stepTitle={planData.what_will_you_do || 'New step'}
          stepCategory={stepCategory}
          onConversationalCreate={useConversationalCapture ? onConversationalCreate : undefined}
          isRace={isRace}
          onToggleRace={onToggleRace}
          onOpenRaceCourse={onOpenRaceCourse}
          onOpenRaceCourseAtlas={onOpenRaceCourseAtlas}
          courseSummary={courseSummary}
          racePlan={racePlan}
          liveMap={liveMap}
          raceTime={raceTime}
          rightInset={rightInset}
          capabilities={capabilityChips}
          onRemoveCapability={(id) => {
            if (id.startsWith(FREEFORM_CAPABILITY_PREFIX)) {
              const label = id.slice(FREEFORM_CAPABILITY_PREFIX.length);
              onUpdate({
                capability_goals: (planData.capability_goals ?? []).filter(
                  (goal) => normalizeCapability(goal) !== normalizeCapability(label),
                ),
              });
              return;
            }
            const updated = (planData.competency_ids ?? []).filter((c) => c !== id);
            onUpdate({ competency_ids: updated });
          }}
          onAddCapabilityPress={() => setShowCompetencyPicker(true)}
          workingWithConcepts={linkedConcepts.map((concept) => ({
            id: concept.id,
            title: concept.title,
          }))}
          onPressWorkingConcept={(conceptId) => {
            router.push(`/(tabs)/library/concept/${conceptId}` as any);
          }}
          onNextPhase={onNextTab}
          libraryBefore={libraryBefore}
          contextRows={
            <>
              <PlanWithCard
                collaborators={collaborators}
                readOnly={readOnly}
                onChange={handleCollaboratorsChange}
                interestSlug={interestSlug}
                interestName={interestName}
                stepCategory={stepCategory}
              />
              <PlanWhereCard
                location={planData.where_location}
                readOnly={readOnly}
                onChange={handleLocationChange}
                interestSlug={interestSlug}
                interestName={interestName}
                stepCategory={stepCategory}
              />
              {/* Beats render on Plan as well as Do — the run-through
                  belongs in planning, and the same per-step beats are
                  surfaced live on Do for capture. Single shared dataset
                  keyed by stepId. Hidden when no stepId (new-step
                  composer). */}
              {stepId ? (
                <PlanBeatsSection
                  stepId={stepId}
                  readOnly={readOnly}
                  interestId={interestId}
                  interestName={interestName}
                  interestSlug={interestSlug}
                />
              ) : null}
            </>
          }
        />
        {interestId ? (
          <CompetencyPickerModal
            visible={showCompetencyPicker}
            onClose={() => setShowCompetencyPicker(false)}
            selectedIds={planData.competency_ids ?? []}
            interestId={interestId}
            suggestedCapabilities={suggestedCapabilities}
            selectedSuggestedLabels={planData.capability_goals ?? []}
            onToggle={(competencyId) => {
              const existing = planData.competency_ids ?? [];
              const next = existing.includes(competencyId)
                ? existing.filter((id) => id !== competencyId)
                : [...existing, competencyId];
              onUpdate({ competency_ids: next });
            }}
            onToggleSuggested={(label) => {
              const existing = planData.capability_goals ?? [];
              const normalized = normalizeCapability(label);
              const next = existing.some((goal) => normalizeCapability(goal) === normalized)
                ? existing.filter((goal) => normalizeCapability(goal) !== normalized)
                : [...existing, label];
              onUpdate({ capability_goals: next });
            }}
          />
        ) : null}
      </>
    );
  }

  if (FEATURE_FLAGS.PRACTICE_PLAN_TAB_IOS_REGISTER) {
    const optionalAddOns = (
      <>
        {(linkedResources.length > 0 || linkedConcepts.length > 0 || !readOnly) && (
          <PlanQuestionCard
            icon="book-outline"
            title="also relevant for"
            isComplete={linkedResources.length > 0 || linkedConcepts.length > 0}
          >
            {linkedResources.length > 0 && (
              <View style={styles.chipContainer}>
                {linkedResources.map((resource) => (
                  <Pressable
                    key={resource.id}
                    style={styles.resourceChip}
                    onPress={() => {
                      if (resource.url) Linking.openURL(resource.url);
                    }}
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
          {collaborators.length > 0 && (
            <View style={styles.chipContainer}>
              {collaborators.map((collab) => (
                <View
                  key={collab.id}
                  style={[
                    styles.collaboratorChip,
                    collab.type === 'platform' ? styles.collaboratorChipLinked : styles.collaboratorChipExternal,
                  ]}
                >
                  {collab.type === 'platform' ? (
                    <View style={[styles.collabAvatar, { backgroundColor: collab.avatar_color || IOS_COLORS.systemGray5 }]}>
                      {collab.avatar_emoji ? (
                        <Text style={styles.collabAvatarEmoji}>{collab.avatar_emoji}</Text>
                      ) : (
                        <Ionicons name="person" size={10} color="#FFFFFF" />
                      )}
                    </View>
                  ) : (
                    <Ionicons name="person-outline" size={12} color={STEP_COLORS.accent} />
                  )}
                  <Text style={styles.chipText} numberOfLines={1}>{collab.display_name}</Text>
                  {collab.type === 'platform' && (
                    <Ionicons name="checkmark-circle" size={12} color={STEP_COLORS.accent} />
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
              <Text style={styles.addLibraryText}>Add people</Text>
            </Pressable>
          )}
        </PlanQuestionCard>

        <PlanQuestionCard icon="location-outline" title="WHERE (optional)" isComplete={q5Complete}>
          <TextInput
            style={[styles.textArea, { minHeight: 44 }, readOnly && styles.readOnlyInput]}
            value={planData.where_location?.name ?? ''}
            onChangeText={readOnly ? undefined : (text) => {
              if (!text.trim()) {
                handleLocationChange(undefined);
              } else {
                handleLocationChange({
                  ...(planData.where_location ?? { name: '' }),
                  name: text,
                });
              }
            }}
            placeholder={readOnly ? '' : 'Location, venue, or address...'}
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            editable={!readOnly}
          />
          {!readOnly && (
            <Pressable style={styles.addPeopleButton} onPress={() => setShowLocationPicker(true)}>
              <Ionicons name="map-outline" size={18} color={STEP_COLORS.accent} />
              <Text style={styles.addLibraryText}>Pick on map</Text>
            </Pressable>
          )}
        </PlanQuestionCard>

        <PlanQuestionCard
          icon="school-outline"
          title="CAPABILITIES THIS DEVELOPS"
          isComplete={Boolean(planData.competency_ids?.length)}
        >
          {(availableCompetencies ?? []).length > 0 && (planData.competency_ids ?? []).length > 0 ? (
            <View style={styles.chipContainer}>
              {(planData.competency_ids ?? []).map((compId) => {
                const comp = (availableCompetencies ?? []).find((c: Competency) => c.id === compId);
                if (!comp) return null;
                return (
                  <View key={compId} style={styles.resourceChip}>
                    <Text style={styles.chipText} numberOfLines={1}>{comp.title}</Text>
                    {!readOnly && (
                      <Pressable
                        onPress={() => {
                          const updated = (planData.competency_ids ?? []).filter((id) => id !== compId);
                          onUpdate({ competency_ids: updated });
                        }}
                        hitSlop={6}
                      >
                        <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.goalHint}>No capabilities inferred — tap + to tag</Text>
          )}
        </PlanQuestionCard>

        {planData.date_enrichment && (
          <View style={styles.conditionsContainer}>
            <DateEnrichmentCard
              dateLabel={planData.date_enrichment.wind || planData.date_enrichment.tide ? 'this session' : 'session'}
              dateIso=""
              enrichment={planData.date_enrichment}
            />
          </View>
        )}

        {stepId && !readOnly && <FromOtherPlaybooks stepId={stepId} />}

        {stepId && !readOnly && (
          <CrossInterestSuggestions
            stepId={stepId}
            interestId={interestId}
            onApplyToStep={(text) => {
              const existing = planData.how_sub_steps ?? [];
              const newSubStep: SubStep = {
                id: `cross_${Date.now()}`,
                text,
                sort_order: existing.length,
                completed: false,
              };
              onUpdate({ how_sub_steps: [...existing, newSubStep] });
            }}
            onCreateStep={async (suggestion) => {
              if (!user?.id) return undefined;
              const targetInterest = userInterests.find((i) => i.slug === suggestion.sourceInterestSlug);
              if (!targetInterest) return undefined;
              try {
                const created = await createStep({
                  user_id: user.id,
                  interest_id: targetInterest.id,
                  title: suggestion.suggestion.slice(0, 80),
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

        {onNextTab && !readOnly && (
          <View style={styles.nextCtaContainer}>
            <Pressable style={styles.nextCtaButton} onPress={onNextTab}>
              <Text style={styles.nextCtaText}>Next: Do</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {!readOnly && (
          <>
            <AddToStepPlanSheet
              visible={addPickerDestination !== null}
              destinationLabel={addPickerDestination ?? ''}
              destinationContext={planData.what_will_you_do || undefined}
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
            <CollaboratorPicker
              visible={showCollaboratorPicker}
              onClose={() => setShowCollaboratorPicker(false)}
              onAdd={(collab) => {
                handleAddCollaborator(collab);
              }}
              existingIds={existingCollaboratorIds}
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
              planData.where_location?.lat != null && planData.where_location?.lng != null
                ? { lat: planData.where_location.lat, lng: planData.where_location.lng }
                : null
            }
            initialName={planData.where_location?.name}
          />
        )}
      </>
    );

    return (
      <PlanTabInterior
        stepId={stepId}
        planData={planData}
        onUpdate={onUpdate}
        readOnly={readOnly}
        interestId={interestId}
        interestName={interestName}
        stepTitle={planData.what_will_you_do || 'New step'}
        stepCategory={stepCategory}
        onConversationalCreate={useConversationalCapture ? onConversationalCreate : undefined}
        optionalAddOns={optionalAddOns}
        footer={footer}
        isRace={isRace}
        onToggleRace={onToggleRace}
        onOpenRaceCourse={onOpenRaceCourse}
        onOpenRaceCourseAtlas={onOpenRaceCourseAtlas}
        courseSummary={courseSummary}
        racePlan={racePlan}
        libraryBefore={libraryBefore}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Conversational Capture — chat-first step creation for new steps */}
      {useConversationalCapture && interestId && interestName && !readOnly && !hasPlanContent && onConversationalCreate && (
        <View style={styles.brainDumpSection}>
          <ConversationalCapture
            interestId={interestId}
            interestName={interestName}
            stepTitle={planData.what_will_you_do || 'New step'}
            onCreateStep={onConversationalCreate}
            embedded
            stepCategory={stepCategory}
          />
        </View>
      )}

      {/* Brain dump section — collapsible at top (legacy / fallback) */}
      {showBrainDump && !useConversationalCapture && (
        <View style={styles.brainDumpSection}>
          <Pressable
            style={styles.brainDumpHeader}
            onPress={() => setBrainDumpExpanded((prev) => !prev)}
          >
            <Ionicons
              name="bulb"
              size={18}
              color={STEP_COLORS.accent}
            />
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

      {/* The WhyWithWhereSummary italic-serif line sits at the top of the
          Plan body for non-v3 surfaces. When STEP_IDENTITY_DECK_V3 is on,
          the canonical Screen 01 (Identity Deck 05C+) uses the lilac
          latest-peer-reflection quote *above* the phase tabs to carry
          that narrative role — surfacing both would double-narrate the
          step's "why." Suppress the inline summary in that case. */}
      {!FEATURE_FLAGS.STEP_IDENTITY_DECK_V3 ? (
        <WhyWithWhereSummary
          why={planData.why_reasoning}
          collaborators={collaborators}
          location={planData.where_location?.name ?? null}
        />
      ) : null}

      {/* Q1: What will you do? */}
      <PlanQuestionCard
        icon="bulb-outline"
        title="what"
        isComplete={q1Complete}
        defaultExpanded={!q1Complete}
      >
        <TextInput
          style={[styles.textArea, readOnly && styles.readOnlyInput]}
          value={planData.what_will_you_do ?? ''}
          onChangeText={readOnly ? undefined : (text) => onUpdate({ what_will_you_do: text })}
          placeholder={readOnly ? '' : catLabels.placeholders.what}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          multiline
          textAlignVertical="top"
          editable={!readOnly}
        />

        {/* Linked resources chips */}
        {linkedResources.length > 0 && (
          <View style={styles.chipContainer}>
            {linkedResources.map((resource) => (
              <Pressable
                key={resource.id}
                style={styles.resourceChip}
                onPress={() => {
                  if (resource.url) Linking.openURL(resource.url);
                }}
              >
                <ResourceTypeIcon type={resource.resource_type} size={14} />
                <Text style={styles.chipText} numberOfLines={1}>{resource.title}</Text>
                {!readOnly && (
                  <Pressable
                    onPress={() => handleRemoveResource(resource.id)}
                    hitSlop={6}
                  >
                    <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                  </Pressable>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Linked concepts */}
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
          subSteps={planData.how_sub_steps ?? []}
          onChange={readOnly ? () => {} : handleSubStepsChange}
          readOnly={readOnly}
        />
      </PlanQuestionCard>

      {/* Q4: Who will you do this with? */}
      <PlanQuestionCard
        icon="people-outline"
        title="who"
        isComplete={q4Complete}
      >
        {/* Collaborator pills */}
        {collaborators.length > 0 && (
          <View style={styles.chipContainer}>
            {collaborators.map((collab) => (
              <View
                key={collab.id}
                style={[
                  styles.collaboratorChip,
                  collab.type === 'platform' ? styles.collaboratorChipLinked : styles.collaboratorChipExternal,
                ]}
              >
                {collab.type === 'platform' ? (
                  <View
                    style={[
                      styles.collabAvatar,
                      { backgroundColor: collab.avatar_color || IOS_COLORS.systemGray5 },
                    ]}
                  >
                    {collab.avatar_emoji ? (
                      <Text style={styles.collabAvatarEmoji}>{collab.avatar_emoji}</Text>
                    ) : (
                      <Ionicons name="person" size={10} color="#FFFFFF" />
                    )}
                  </View>
                ) : (
                  <Ionicons name="person-outline" size={12} color={STEP_COLORS.accent} />
                )}
                <Text style={styles.chipText} numberOfLines={1}>{collab.display_name}</Text>
                {collab.type === 'platform' && (
                  <Ionicons name="checkmark-circle" size={12} color={STEP_COLORS.accent} />
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
          <Pressable
            style={styles.addPeopleButton}
            onPress={() => setShowCollaboratorPicker(true)}
          >
            <Ionicons name="person-add-outline" size={18} color={STEP_COLORS.accent} />
            <Text style={styles.addLibraryText}>Add people</Text>
          </Pressable>
        )}
      </PlanQuestionCard>

      {/* Q5: Where will you do this? */}
      <PlanQuestionCard
        icon="location-outline"
        title="where"
        isComplete={q5Complete}
      >
        <TextInput
          style={[styles.textArea, { minHeight: 44 }, readOnly && styles.readOnlyInput]}
          value={planData.where_location?.name ?? ''}
          onChangeText={readOnly ? undefined : (text) => {
            if (!text.trim()) {
              handleLocationChange(undefined);
            } else {
              handleLocationChange({
                ...(planData.where_location ?? { name: '' }),
                name: text,
              });
            }
          }}
          placeholder={readOnly ? '' : "Location, venue, or address..."}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          editable={!readOnly}
        />

        {/* Map preview when coordinates are set */}
        {planData.where_location?.lat != null && planData.where_location?.lng != null && (
          <View style={styles.mapPreview}>
            <View style={styles.mapPreviewPin}>
              <Ionicons name="location" size={20} color={STEP_COLORS.accent} />
              <Text style={styles.mapPreviewCoords}>
                {planData.where_location.lat.toFixed(4)}, {planData.where_location.lng.toFixed(4)}
              </Text>
            </View>
            {!readOnly && (
              <Pressable
                onPress={() => handleLocationChange({
                  ...planData.where_location!,
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
            <Text style={styles.addLibraryText}>Pick on map</Text>
          </Pressable>
        )}
      </PlanQuestionCard>

      {/* Q3: Why is this next? — moved to the bottom of the task questions
          per canonical Screen 01 ordering. With the lilac peer-reflection
          quote above the phase tabs already carrying the why, the editable
          why card stays available but doesn't crowd the task-first
          arrangement of what / how / who / where. */}
      <PlanQuestionCard
        icon="help-circle-outline"
        title="why"
        isComplete={q3Complete}
      >
        <TextInput
          style={[styles.textArea, readOnly && styles.readOnlyInput]}
          value={planData.why_reasoning ?? ''}
          onChangeText={readOnly ? undefined : (text) => onUpdate({ why_reasoning: text })}
          placeholder={readOnly ? '' : catLabels.placeholders.why}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          multiline
          textAlignVertical="top"
          editable={!readOnly}
        />
      </PlanQuestionCard>

      {/* Q5: Competencies */}
      {(availableCompetencies ?? []).length > 0 && (
        <PlanQuestionCard
          icon="school-outline"
          title="building toward"
          isComplete={Boolean(planData.competency_ids?.length)}
        >
          {/* Selected competency pills */}
          {(planData.competency_ids ?? []).length > 0 && (
            <View style={styles.chipContainer}>
              {(planData.competency_ids ?? []).map((compId) => {
                const comp = (availableCompetencies ?? []).find((c: Competency) => c.id === compId);
                if (!comp) return null;
                return (
                  <View key={compId} style={styles.resourceChip}>
                    <Text style={styles.chipText} numberOfLines={1}>{comp.title}</Text>
                    {!readOnly && (
                      <Pressable
                        onPress={() => {
                          const updated = (planData.competency_ids ?? []).filter((id) => id !== compId);
                          onUpdate({ competency_ids: updated });
                        }}
                        hitSlop={6}
                      >
                        <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Searchable competency list — only when editing */}
          {!readOnly && (
            <View style={styles.competencyPickerWrap}>
              <TextInput
                style={styles.competencySearchInput}
                value={competencySearch}
                onChangeText={setCompetencySearch}
                placeholder="Search competencies..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
              />
              {(() => {
                const filtered = (availableCompetencies ?? [])
                  .filter((c: Competency) =>
                    !(planData.competency_ids ?? []).includes(c.id) &&
                    (!competencySearch.trim() ||
                      c.title.toLowerCase().includes(competencySearch.toLowerCase()))
                  );
                const shown = filtered.slice(0, 8);
                return (
                  <>
                    {shown.map((comp: Competency) => (
                      <Pressable
                        key={comp.id}
                        style={styles.competencyOption}
                        onPress={() => {
                          const existing = planData.competency_ids ?? [];
                          onUpdate({ competency_ids: [...existing, comp.id] });
                          setCompetencySearch('');
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={16} color={STEP_COLORS.accent} />
                        <Text style={styles.competencyOptionText} numberOfLines={1}>{comp.title}</Text>
                      </Pressable>
                    ))}
                    {filtered.length > 8 && (
                      <Text style={{ fontSize: 12, color: IOS_COLORS.secondaryLabel, paddingVertical: 4, paddingHorizontal: 4 }}>
                        Showing 8 of {filtered.length} — type to narrow
                      </Text>
                    )}
                  </>
                );
              })()}
            </View>
          )}
        </PlanQuestionCard>
      )}

      {/* Conditions card (wind, tide, rig/sail) */}
      {planData.date_enrichment && (
        <View style={styles.conditionsContainer}>
          <DateEnrichmentCard
            dateLabel={planData.date_enrichment.wind || planData.date_enrichment.tide ? 'this session' : 'session'}
            dateIso=""
            enrichment={planData.date_enrichment}
          />
        </View>
      )}

      {/* From other Playbooks — cross_interest_idea suggestions from the AI queue */}
      {stepId && !readOnly && (
        <FromOtherPlaybooks stepId={stepId} />
      )}

      {/* Cross-interest suggestions */}
      {stepId && !readOnly && (
        <CrossInterestSuggestions
          stepId={stepId}
          interestId={interestId}
          onApplyToStep={(text) => {
            // Add the suggestion as a sub-step so it's visible in "How will you do it?"
            const existing = planData.how_sub_steps ?? [];
            const newSubStep: SubStep = {
              id: `cross_${Date.now()}`,
              text,
              sort_order: existing.length,
              completed: false,
            };
            onUpdate({ how_sub_steps: [...existing, newSubStep] });
          }}
          onCreateStep={async (suggestion) => {
            if (!user?.id) return undefined;
            const targetInterest = userInterests.find((i) => i.slug === suggestion.sourceInterestSlug);
            if (!targetInterest) return undefined;
            try {
              const created = await createStep({
                user_id: user.id,
                interest_id: targetInterest.id,
                title: suggestion.suggestion.slice(0, 80),
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

      {/* Next tab CTA */}
      {onNextTab && !readOnly && (
        <View style={styles.nextCtaContainer}>
          <Pressable style={styles.nextCtaButton} onPress={onNextTab}>
            <Text style={styles.nextCtaText}>Next: Do</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {footer}

      {/* iOS-register Add-to-step-plan sheet (library + capture-new) */}
      {!readOnly && (
        <AddToStepPlanSheet
          visible={addPickerDestination !== null}
          destinationLabel={addPickerDestination ?? ''}
          destinationContext={planData.what_will_you_do || undefined}
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

      {/* Collaborator picker modal */}
      {!readOnly && (
        <CollaboratorPicker
          visible={showCollaboratorPicker}
          onClose={() => setShowCollaboratorPicker(false)}
          onAdd={(collab) => {
            handleAddCollaborator(collab);
          }}
          existingIds={existingCollaboratorIds}
        />
      )}

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
            planData.where_location?.lat != null && planData.where_location?.lng != null
              ? { lat: planData.where_location.lat, lng: planData.where_location.lng }
              : null
          }
          initialName={planData.where_location?.name}
        />
      )}
    </ScrollView>
  );
}

/**
 * WhyWithWhereSummary — canonical Screen 07 inline at the top of the
 * Plan body: `"why-quote" · people · location` in italic-serif. Read-
 * only; the editable sections (WHY / WITH / WHERE) still render below
 * via the existing PlanQuestionCards. When all three fields are
 * empty the row collapses entirely.
 */
const SERIF_FAMILY = fontFamily.serif;

function WhyWithWhereSummary({
  why,
  collaborators,
  location,
}: {
  why: string | null | undefined;
  collaborators: { display_name?: string | null }[];
  location: string | null;
}) {
  const whyText = why?.trim() || '';
  const names = collaborators
    .map((c) => c.display_name?.trim())
    .filter((n): n is string => !!n);
  const namesText = names.length === 0
    ? ''
    : names.length <= 3
      ? names.join(', ')
      : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
  const locationText = location?.trim() || '';
  const parts = [
    whyText ? `"${whyText.length > 40 ? whyText.slice(0, 38).trimEnd() + '…' : whyText}"` : '',
    namesText,
    locationText,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.text} numberOfLines={2}>
        {parts.join('  ·  ')}
      </Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 12,
  },
  text: {
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 19,
    color: STEP_COLORS.secondaryLabel,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: IOS_SPACING.md,
    paddingBottom: 100,
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
  textArea: {
    fontSize: 14,
    color: STEP_COLORS.label,
    backgroundColor: STEP_COLORS.pageBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STEP_COLORS.border,
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
  goalHint: {
    fontSize: 13,
    lineHeight: 18,
    color: STEP_COLORS.secondaryLabel,
  },
  addLibraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    marginTop: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
  },
  addLibraryText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
  nextCtaContainer: {
    marginTop: IOS_SPACING.md,
    paddingTop: IOS_SPACING.sm,
  },
  nextCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: STEP_COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(61,138,90,0.25)' } as any,
      default: {
        shadowColor: STEP_COLORS.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  nextCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  conditionsContainer: {
    marginTop: IOS_SPACING.sm,
  },
  readOnlyInput: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: STEP_COLORS.secondaryLabel,
  },
  competencyPickerWrap: {
    gap: 4,
    marginTop: IOS_SPACING.xs,
  },
  competencySearchInput: {
    fontSize: 13,
    color: STEP_COLORS.label,
    backgroundColor: STEP_COLORS.pageBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STEP_COLORS.border,
    padding: IOS_SPACING.xs,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  collaboratorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  collaboratorChipLinked: {
    backgroundColor: STEP_COLORS.accentLight,
  },
  collaboratorChipExternal: {
    backgroundColor: IOS_COLORS.systemGray6,
  },
  collabAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collabAvatarEmoji: {
    fontSize: 10,
  },
  addPeopleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    marginTop: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
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
    color: STEP_COLORS.secondaryLabel,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  competencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  competencyOptionText: {
    fontSize: 13,
    color: STEP_COLORS.label,
    flex: 1,
  },
});

/**
 * <PlanBeatsSection> — mounts BeatsList on the Plan tab with the same
 * binding the Do tab uses. Hook usage requires a sub-component since
 * useStepBeatsBinding needs a stable stepId at call time and the parent
 * renders multiple PlanTab branches conditionally.
 */
function PlanBeatsSection({
  stepId,
  readOnly,
  interestId,
  interestName,
  interestSlug,
}: {
  stepId: string;
  readOnly?: boolean;
  interestId?: string;
  interestName?: string;
  interestSlug?: string;
}) {
  const beats = useStepBeatsBinding(stepId);
  return (
    <BeatsList
      beats={beats.beats}
      readOnly={readOnly}
      interestSlug={interestSlug ?? null}
      interestName={interestName ?? null}
      interestId={interestId ?? null}
      onAdd={beats.onAdd}
      onEdit={beats.onEdit}
      onDelete={beats.onDelete}
      onToggleDone={beats.onToggleDone}
      onReorder={beats.onReorder}
    />
  );
}
