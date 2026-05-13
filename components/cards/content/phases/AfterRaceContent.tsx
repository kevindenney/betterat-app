/**
 * AfterRaceContent - After Race Phase Content
 *
 * Content shown when selectedPhase === 'after_race'
 * Tufte-inspired flat layout - all items visible, no hidden accordions.
 *
 * Includes:
 * - Race Result section
 * - Structured Debrief section
 * - Performance Analysis (flat checklist items)
 * - Learning & Improvement (flat checklist items)
 * - Equipment notes (flows to next race)
 * - AI analysis status
 * - Coach feedback
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Animated, Platform, UIManager, Modal, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, X } from 'lucide-react-native';

import { CardRaceData } from '../../types';
import { useRaceAnalysisState } from '@/hooks/useRaceAnalysisState';
import { useRaceAnalysisData } from '@/hooks/useRaceAnalysisData';
import { useEquipmentFlow } from '@/hooks/useEquipmentFlow';
import { useDebriefInterview } from '@/hooks/useDebriefInterview';
import { useEducationalChecklist } from '@/hooks/useEducationalChecklist';
import { Marginalia } from '@/components/ui/Marginalia';
import { RaceAnalysisService } from '@/services/RaceAnalysisService';
import { supabase } from '@/services/supabase';
import { StructuredDebriefInterview } from '@/components/races/review/StructuredDebriefInterview';
import { NextRaceFocusSection } from '@/components/races/review/NextRaceFocusSection';
import { GPSTrackTile } from '@/components/races/review/GPSTrackTile';
import { RaceContentActions } from '@/components/races/RaceContentActions';
import { EquipmentIssuesSheet } from '@/components/races/review/EquipmentIssuesSheet';
import { RaceResultDetailSheet } from '@/components/races/review/RaceResultDetailSheet';
import { EducationalChecklistSheet } from '@/components/races/review/EducationalChecklistSheet';
import { PrepChecklistSection } from '@/components/races/prep/PrepChecklistSection';
import type { ChecklistItemWithState } from '@/hooks/useRaceChecklist';
import { CoachSelectionSheet } from '@/components/races/coaching';
import { useSailorActiveCoaches } from '@/hooks/useSailorActiveCoaches';
import { coachingService } from '@/services/CoachingService';
import {
  POST_RACE_REVIEW_CONFIG,
  LEARNING_CAPTURE_CONFIG,
} from '@/lib/educationalChecklistConfig';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { signatureInsightService } from '@/services/SignatureInsightService';
import {
  useActiveFocusIntent,
  useFocusIntentFromRace,
} from '@/hooks/useFocusIntent';
import { inferRaceCountFromTitle } from '@/lib/utils/raceTitle';

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  purple: '#AF52DE',
  gray: '#8E8E93',
  gray3: '#C7C7CC',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  label: '#000000',
  secondaryLabel: '#3C3C43',
};

interface AfterRaceContentProps {
  race: CardRaceData;
  userId?: string;
  onOpenPostRaceInterview?: () => void;
  isExpanded?: boolean;
  /** Incrementing counter to trigger data refetch (e.g., after PostRaceInterview completes) */
  refetchTrigger?: number;
}

/**
 * Get ordinal suffix
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}


function AfterRaceContentImpl({
  race,
  userId: propsUserId,
  onOpenPostRaceInterview: _onOpenPostRaceInterview,
  isExpanded = true,
  refetchTrigger,
}: AfterRaceContentProps) {
  // Get current user if userId not provided
  const { user } = useAuth();
  const { activeInterestSlug, activeDomain } = useOrganization();
  const userId = propsUserId || user?.id;
  const activeInterestId = activeInterestSlug || activeDomain || 'sailing';
  const router = useRouter();

  // Extract race location coordinates (available via useEnrichedRaces → venueCoordinates)
  const raceCoordinates = useMemo(() => {
    const vc = race.venueCoordinates as { lat: number; lng: number } | undefined;
    if (vc && typeof vc.lat === 'number' && typeof vc.lng === 'number') return vc;
    // Fallback: top-level latitude/longitude columns on regattas table
    const lat = race.latitude as number | undefined;
    const lng = race.longitude as number | undefined;
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    // Fallback: check metadata sources
    const meta = race.metadata as Record<string, any> | undefined;
    if (meta?.venue_lat && meta?.venue_lng) return { lat: meta.venue_lat, lng: meta.venue_lng };
    if (meta?.venue_coordinates?.lat && meta?.venue_coordinates?.lng) return meta.venue_coordinates;
    if (meta?.start_coordinates?.lat && meta?.start_coordinates?.lng) return meta.start_coordinates;
    return null;
  }, [race.venueCoordinates, race.metadata, race.latitude, race.longitude]);

  // Analysis state and data
  const { state: analysisState, refetch: refetchState } = useRaceAnalysisState(race.id, race.date, userId);
  const { analysisData, refetch: refetchData } = useRaceAnalysisData(race.id, userId);

  // Structured debrief interview
  const {
    progress: debriefProgress,
    isComplete: debriefComplete,
    isLoading: debriefLoading,
    refetch: refetchDebrief,
  } = useDebriefInterview({
    raceId: race.id,
    userId,
  });

  // Refetch all data when refetchTrigger changes (e.g., after PostRaceInterview completes)
  useEffect(() => {
    if (refetchTrigger !== undefined && refetchTrigger > 0) {
      refetchState();
      refetchData();
      refetchDebrief();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchTrigger]); // Only trigger on refetchTrigger change, not callback changes

  // Modal state for interview
  const [showInterviewModal, setShowInterviewModal] = useState(false);

  // Result detail sheet state
  const [showResultSheet, setShowResultSheet] = useState(false);

  // Equipment sheet state
  const [showEquipmentSheet, setShowEquipmentSheet] = useState(false);

  // Next Race Focus modal
  const [showFocusModal, setShowFocusModal] = useState(false);

  // Share insights modal
  const [showShareModal, setShowShareModal] = useState(false);

  // Educational checklist sheets
  const [showPerformanceSheet, setShowPerformanceSheet] = useState(false);
  const [showLearningSheet, setShowLearningSheet] = useState(false);

  // Coach selection sheet
  const [showCoachSheet, setShowCoachSheet] = useState(false);

  // Active coaches for coaching suggestion tile
  const {
    hasCoach,
    primaryCoach,
    activeCoaches,
  } = useSailorActiveCoaches({
    raceBoatClass: race.boatClass,
    phase: 'review',
  });

  // Content status for share tile (loaded from Supabase)
  const [contentStatus, setContentStatus] = useState({ hasPrepNotes: false, hasPostRaceNotes: false });
  useEffect(() => {
    if (!race.id) return;
    supabase
      .from('regattas')
      .select('prep_notes, post_race_notes')
      .eq('id', race.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setContentStatus({
            hasPrepNotes: !!data.prep_notes,
            hasPostRaceNotes: !!data.post_race_notes,
          });
        }
      });
  }, [race.id]);

  // Focus intent hooks for tile status
  const { activeIntent } = useActiveFocusIntent();
  const { intent: intentFromThisRace } = useFocusIntentFromRace(race.id);

  // Equipment flow for cross-race issue tracking
  const {
    carryoverIssues,
    currentRaceIssues,
    addIssue,
    resolveIssue,
    removeIssue,
  } = useEquipmentFlow({
    userId,
    currentRaceId: race.id,
  });

  // Analysis generation state
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [_analysisError, setAnalysisError] = useState<string | null>(null);

  // Track when AI analysis is newly generated (for visual highlight)
  const [_isAIAnalysisNew, setIsAIAnalysisNew] = useState(false);

  // Toast notification for AI analysis completion
  const [showAIToast, setShowAIToast] = useState(false);
  const aiToastOpacity = useRef(new Animated.Value(0)).current;
  const [signatureInsightConfirmation, setSignatureInsightConfirmation] = useState<{
    message: string;
    principle: string;
  } | null>(null);

  // Enable LayoutAnimation on Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Show AI analysis success feedback (toast + highlight)
  const showAIAnalysisSuccess = useCallback(() => {
    // Show toast notification
    setShowAIToast(true);
    Animated.sequence([
      Animated.timing(aiToastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(aiToastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setShowAIToast(false));

    // Mark as new for tile badge
    setIsAIAnalysisNew(true);
    setTimeout(() => setIsAIAnalysisNew(false), 6000);
  }, [aiToastOpacity]);

  // Trigger AI analysis generation
  const triggerAnalysis = useCallback(async () => {
    const timerSessionId = analysisData?.timerSessionId;
    if (!timerSessionId) {
      setAnalysisError('No race session found');
      return;
    }

    setIsGeneratingAnalysis(true);
    setAnalysisError(null);

    try {
      const result = await RaceAnalysisService.analyzeRaceSession(timerSessionId, { force: true });
      if (result) {
        // Refresh both hooks to pick up the new analysis
        refetchState();
        refetchData();
        // Show success feedback
        showAIAnalysisSuccess();
      } else {
        setAnalysisError('Analysis generation failed');
      }
    } catch (err) {
      console.error('Error generating analysis:', err);
      setAnalysisError('Failed to generate analysis');
    } finally {
      setIsGeneratingAnalysis(false);
    }
  }, [analysisData?.timerSessionId, refetchState, refetchData, showAIAnalysisSuccess]);

  // Derived data
  const hasResult = analysisState?.hasResult;
  const hasAIAnalysis = analysisState?.hasAIAnalysis;
  const coachAnnotations = analysisState?.coachAnnotations || [];

  // Auto-generate AI analysis when debrief is completed
  // Track the last raceId we triggered analysis for to avoid re-triggering
  const lastAutoTriggeredRaceId = useRef<string | null>(null);
  React.useEffect(() => {
    // Only auto-trigger when all conditions are met and we haven't triggered for this race yet
    const shouldTrigger =
      debriefComplete &&
      hasResult &&
      !hasAIAnalysis &&
      !isGeneratingAnalysis &&
      analysisData?.timerSessionId &&
      lastAutoTriggeredRaceId.current !== race.id;

    if (shouldTrigger) {
      lastAutoTriggeredRaceId.current = race.id;
      // eslint-disable-next-line no-console
      console.log('[AfterRaceContent] Auto-triggering AI analysis for race:', race.id);
      triggerAnalysis();
    }
  }, [debriefComplete, hasResult, hasAIAnalysis, isGeneratingAnalysis, analysisData?.timerSessionId, triggerAnalysis, race.id]);

  // How many races the step covers. Prefer saved raceCount, but fall back to
  // parsing the step title (e.g. "Moonraker Races 5 & 6" → 2) so the progress
  // nudge works even before the sailor opens the result sheet for the first
  // time. Kept in sync with inferRaceCountFromTitle in RaceResultDetailSheet.
  const stepRaceCount = useMemo(() => {
    if (analysisData?.raceCount && analysisData.raceCount > 1) {
      return analysisData.raceCount;
    }
    return inferRaceCountFromTitle(race.name);
  }, [analysisData?.raceCount, race.name]);

  // How many of those races have a position recorded.
  const recordedRaceCount = useMemo(() => {
    const perRace = analysisData?.raceResults?.filter(
      (r) => r.position != null && r.fleetSize != null,
    ).length ?? 0;
    if (perRace > 0) return perRace;
    // Single-race fallback — the legacy selfReportedPosition/selfReportedFleetSize
    // path used before raceResults existed.
    if (analysisData?.selfReportedPosition && analysisData?.selfReportedFleetSize) {
      return 1;
    }
    return 0;
  }, [analysisData?.raceResults, analysisData?.selfReportedPosition, analysisData?.selfReportedFleetSize]);

  // Log section is only "complete" when every race in the step has a result.
  const allRaceResultsRecorded = recordedRaceCount >= stepRaceCount;

  // Format result for the checklist row status text
  const resultText = useMemo(() => {
    if (stepRaceCount > 1) {
      // Multi-race day — always show progress so sailors know to come back
      // for race 2/3 instead of thinking "done" after race 1.
      return `${recordedRaceCount}/${stepRaceCount} recorded`;
    }
    if (!hasResult) return null;
    if (analysisData?.selfReportedPosition && analysisData?.selfReportedFleetSize) {
      return `${analysisData.selfReportedPosition}${getOrdinalSuffix(analysisData.selfReportedPosition)} of ${analysisData.selfReportedFleetSize}`;
    }
    return 'Recorded';
  }, [hasResult, analysisData, stepRaceCount, recordedRaceCount]);

  // ==========================================================================
  // Educational checklist progress and toggles
  // ==========================================================================
  const {
    completedCount: performanceCompletedCount,
    totalCount: performanceTotalCount,
    isCompleted: isPerformanceItemCompleted,
    toggleCompletion: togglePerformanceItem,
  } = useEducationalChecklist({
    raceId: race.id,
    userId,
    sectionId: POST_RACE_REVIEW_CONFIG.id,
    items: POST_RACE_REVIEW_CONFIG.items,
  });

  const {
    completedCount: learningCompletedCount,
    totalCount: learningTotalCount,
    isCompleted: isLearningItemCompleted,
    toggleCompletion: toggleLearningItem,
  } = useEducationalChecklist({
    raceId: race.id,
    userId,
    sectionId: LEARNING_CAPTURE_CONFIG.id,
    items: LEARNING_CAPTURE_CONFIG.items,
  });

  const maybeEmitChecklistCompletionSignatureInsight = useCallback(
    async (input: { sectionId: string; itemId: string; itemLabel: string; wasCompleted: boolean }) => {
      if (input.wasCompleted) return;
      if (!hasAIAnalysis || !userId) return;

      const evidence = `AI analysis is available for your completed ${input.sectionId} timeline step "${input.itemLabel}".`;
      const principle = `After completing ${input.sectionId} steps, lock one repeatable adjustment before your next race.`;
      const message = `You're getting better at ${input.sectionId} execution because ${evidence}`;

      try {
        await signatureInsightService.logSignatureInsightEvent({
          userId,
          interestId: activeInterestId,
          raceEventId: race.id,
          sourceKind: 'timeline_step_completion',
          insightText: message,
          principleText: principle,
          evidenceText: evidence,
          confidenceScore: 0.6,
          metadata: {
            sectionId: input.sectionId,
            checklistItemId: input.itemId,
            checklistItemLabel: input.itemLabel,
            source: 'educational_checklist_sheet',
          },
        });
        setSignatureInsightConfirmation({ message, principle });
      } catch (error) {
        // Ignore duplicate or transient event-write failures; checklist completion remains primary.
      }
    },
    [activeInterestId, hasAIAnalysis, race.id, userId]
  );

  const handlePerformanceToggle = useCallback(
    async (itemId: string) => {
      const item = POST_RACE_REVIEW_CONFIG.items.find((row) => row.id === itemId);
      const wasCompleted = isPerformanceItemCompleted(itemId);
      await togglePerformanceItem(itemId);
      await maybeEmitChecklistCompletionSignatureInsight({
        sectionId: POST_RACE_REVIEW_CONFIG.id,
        itemId,
        itemLabel: item?.label || itemId,
        wasCompleted,
      });
    },
    [isPerformanceItemCompleted, maybeEmitChecklistCompletionSignatureInsight, togglePerformanceItem]
  );

  const handleLearningToggle = useCallback(
    async (itemId: string) => {
      const item = LEARNING_CAPTURE_CONFIG.items.find((row) => row.id === itemId);
      const wasCompleted = isLearningItemCompleted(itemId);
      await toggleLearningItem(itemId);
      await maybeEmitChecklistCompletionSignatureInsight({
        sectionId: LEARNING_CAPTURE_CONFIG.id,
        itemId,
        itemLabel: item?.label || itemId,
        wasCompleted,
      });
    },
    [isLearningItemCompleted, maybeEmitChecklistCompletionSignatureInsight, toggleLearningItem]
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  // Focus intent derived state
  const _hasPreviousFocus = !!activeIntent && activeIntent.status === 'active' && activeIntent.sourceRaceId !== race.id;
  const hasFocusSet = !!intentFromThisRace;

  // AI enabled when result + debrief complete
  const equipmentIssueCount = currentRaceIssues.length + carryoverIssues.length;
  const canGenerateAI = !!(hasResult && debriefComplete);

  // Section completion states
  const debriefSectionComplete = debriefComplete;
  const reviewSectionComplete = !!hasAIAnalysis;
  const focusSectionComplete = hasFocusSet;

  // Helper: create a synthetic ChecklistItemWithState for PrepChecklistSection
  const makeItem = useCallback(
    (id: string, label: string, isCompleted: boolean): ChecklistItemWithState => ({
      id,
      label,
      priority: 'high' as const,
      raceTypes: ['fleet', 'distance', 'match', 'team'],
      phase: 'after_race' as const,
      category: 'review' as const,
      isCompleted,
    }),
    []
  );

  // Review items can't be "toggled" — completion is driven by data entered via the
  // sheet/modal. Route checkbox taps to the same handlers as the row tap so the
  // circle opens the tool instead of sitting inert.
  const handleLogToggle = useCallback((itemId: string) => {
    if (itemId === 'record_result') setShowResultSheet(true);
    if (itemId === 'equipment_issues') setShowEquipmentSheet(true);
  }, []);

  const handleDebriefToggle = useCallback((itemId: string) => {
    if (itemId === 'structured_debrief') setShowInterviewModal(true);
    if (itemId === 'performance_review') setShowPerformanceSheet(true);
    if (itemId === 'learning_capture') setShowLearningSheet(true);
  }, []);

  const handleFocusToggle = useCallback((itemId: string) => {
    if (itemId === 'set_focus') setShowFocusModal(true);
    if (itemId === 'share_insights') setShowShareModal(true);
  }, []);

  const handleReviewToggle = useCallback(
    (itemId: string) => {
      if (itemId === 'ai_analysis') {
        if (hasAIAnalysis && analysisData?.timerSessionId) {
          router.push(`/(tabs)/race-session/${analysisData.timerSessionId}` as any);
        } else if (canGenerateAI && !isGeneratingAnalysis) {
          triggerAnalysis();
        }
      }
      if (itemId === 'share_with_coach') {
        if (hasCoach && activeCoaches.length === 1 && primaryCoach) {
          coachingService.shareDebriefWithCoach({
            coachId: primaryCoach.coachId,
            raceId: race.id,
            sailorId: userId || '',
            raceName: race.name,
          });
        } else if (hasCoach && activeCoaches.length > 1) {
          setShowCoachSheet(true);
        } else {
          router.push(`/coach/discover?boatClass=${encodeURIComponent(race.boatClass || '')}&source=review` as any);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      hasAIAnalysis,
      analysisData?.timerSessionId,
      canGenerateAI,
      isGeneratingAnalysis,
      triggerAnalysis,
      hasCoach,
      activeCoaches,
      primaryCoach,
      race.id,
      race.name,
      race.boatClass,
      userId,
    ],
  );

  return (
    <View style={styles.container}>

      {/* ================================================================ */}
      {/* SECTION 1: LOG YOUR RACE                                        */}
      {/* ================================================================ */}
      <PrepChecklistSection
        title="Log Your Race"
        subtitle="Record results and equipment status"
        accentColor={IOS_COLORS.blue}
        isComplete={allRaceResultsRecorded && !!hasResult}
        onToggle={handleLogToggle}
        onOpenTool={(item) => {
          if (item.id === 'record_result') setShowResultSheet(true);
          if (item.id === 'equipment_issues') setShowEquipmentSheet(true);
        }}
        items={[
          {
            item: makeItem('record_result', 'Record your result', !!hasResult),
            statusText: resultText || undefined,
            // Orange when partially filled (e.g. 1/2) to nudge the sailor to finish.
            statusColor:
              stepRaceCount > 1 && recordedRaceCount > 0 && recordedRaceCount < stepRaceCount
                ? IOS_COLORS.orange
                : IOS_COLORS.blue,
            hasTool: true,
          },
          {
            item: makeItem('equipment_issues', 'Record equipment issues', equipmentIssueCount > 0),
            statusText: equipmentIssueCount > 0 ? `${equipmentIssueCount} issue${equipmentIssueCount !== 1 ? 's' : ''}` : undefined,
            statusColor: IOS_COLORS.orange,
            hasTool: true,
          },
        ]}
      >
        {coachAnnotations.find(a => a.field === 'result') && (
          <Marginalia
            author="Coach"
            comment={coachAnnotations.find(a => a.field === 'result')!.comment}
            isNew={!coachAnnotations.find(a => a.field === 'result')!.isRead}
            variant="compact"
          />
        )}
      </PrepChecklistSection>

      {/* ================================================================ */}
      {/* SECTION 2: DEBRIEF                                              */}
      {/* ================================================================ */}
      <PrepChecklistSection
        title="Debrief"
        subtitle={
          debriefLoading
            ? 'Loading debrief…'
            : debriefComplete
              ? 'Debrief complete'
              : `Reflect on what happened — ${debriefProgress.answeredCount}/${debriefProgress.total} answered`
        }
        accentColor={IOS_COLORS.orange}
        isComplete={debriefSectionComplete}
        onToggle={handleDebriefToggle}
        onOpenTool={(item) => {
          if (item.id === 'structured_debrief') setShowInterviewModal(true);
          if (item.id === 'performance_review') setShowPerformanceSheet(true);
          if (item.id === 'learning_capture') setShowLearningSheet(true);
        }}
        items={[
          {
            item: makeItem('structured_debrief', 'Structured debrief', debriefComplete),
            statusText: debriefLoading ? 'Loading…' : debriefComplete ? 'Complete' : `${debriefProgress.answeredCount}/${debriefProgress.total}`,
            statusColor: debriefLoading ? IOS_COLORS.gray : debriefComplete ? IOS_COLORS.green : IOS_COLORS.orange,
            hasTool: true,
          },
          {
            item: makeItem(
              'performance_review',
              'Review performance',
              performanceCompletedCount === performanceTotalCount && performanceTotalCount > 0,
            ),
            statusText: `${performanceCompletedCount}/${performanceTotalCount}`,
            statusColor: IOS_COLORS.blue,
            hasTool: true,
          },
          {
            item: makeItem(
              'learning_capture',
              'Capture learnings',
              learningCompletedCount === learningTotalCount && learningTotalCount > 0,
            ),
            statusText: `${learningCompletedCount}/${learningTotalCount}`,
            statusColor: IOS_COLORS.purple,
            hasTool: true,
          },
        ]}
      >
        {/* GPS Track as debrief visual aid */}
        {isExpanded && (
          <GPSTrackTile
            raceId={race.id}
            userId={userId}
            timerSessionId={analysisData?.timerSessionId}
            raceLatitude={raceCoordinates?.lat}
            raceLongitude={raceCoordinates?.lng}
            raceVenue={race.venue}
            onPress={() => {
              if (analysisData?.timerSessionId) {
                router.push(`/(tabs)/race-session/${analysisData.timerSessionId}` as any);
              }
            }}
          />
        )}
      </PrepChecklistSection>

      {/* ================================================================ */}
      {/* SECTION 3: RACE REVIEW                                          */}
      {/* ================================================================ */}
      <PrepChecklistSection
        title="Race Review"
        subtitle={
          hasAIAnalysis
            ? 'Insights and race summary'
            : canGenerateAI
              ? 'Generating analysis...'
              : 'Complete debrief to unlock analysis'
        }
        accentColor={IOS_COLORS.purple}
        isComplete={reviewSectionComplete}
        onToggle={handleReviewToggle}
        onOpenTool={(item) => {
          if (item.id === 'ai_analysis') {
            if (hasAIAnalysis && analysisData?.timerSessionId) {
              router.push(`/(tabs)/race-session/${analysisData.timerSessionId}` as any);
            } else if (canGenerateAI && !isGeneratingAnalysis) {
              triggerAnalysis();
            }
          }
          if (item.id === 'share_with_coach') {
            if (hasCoach && activeCoaches.length === 1 && primaryCoach) {
              coachingService.shareDebriefWithCoach({
                coachId: primaryCoach.coachId,
                raceId: race.id,
                sailorId: userId || '',
                raceName: race.name,
              });
            } else if (hasCoach && activeCoaches.length > 1) {
              setShowCoachSheet(true);
            } else {
              router.push(`/coach/discover?boatClass=${encodeURIComponent(race.boatClass || '')}&source=review` as any);
            }
          }
        }}
        items={[
          {
            item: makeItem('ai_analysis', 'Race analysis', !!hasAIAnalysis),
            statusText: isGeneratingAnalysis
              ? 'Generating...'
              : hasAIAnalysis
                ? 'Ready'
                : canGenerateAI
                  ? 'Tap to generate'
                  : 'Locked',
            statusColor: hasAIAnalysis ? IOS_COLORS.green : isGeneratingAnalysis ? IOS_COLORS.orange : IOS_COLORS.gray,
            hasTool: true,
          },
          ...(debriefComplete
            ? [
                {
                  item: makeItem('share_with_coach', 'Share with coach', false),
                  statusText: hasCoach
                    ? primaryCoach?.displayName || 'Coach'
                    : 'Find a coach',
                  statusColor: IOS_COLORS.blue,
                  hasTool: true,
                },
              ]
            : []),
        ]}
      >
        {/* Coach Feedback */}
        {coachAnnotations.find(a => a.field === 'general') && (
          <Marginalia
            author="Coach"
            comment={coachAnnotations.find(a => a.field === 'general')!.comment}
            isNew={!coachAnnotations.find(a => a.field === 'general')!.isRead}
            variant="compact"
          />
        )}
      </PrepChecklistSection>

      {/* ================================================================ */}
      {/* SECTION 4: NEXT RACE FOCUS                                      */}
      {/* ================================================================ */}
      <PrepChecklistSection
        title="Next Race Focus"
        subtitle={
          hasFocusSet
            ? 'Focus set — ready for next race'
            : 'Set your intent for deliberate improvement'
        }
        accentColor={IOS_COLORS.green}
        isComplete={focusSectionComplete}
        onToggle={handleFocusToggle}
        onOpenTool={(item) => {
          if (item.id === 'set_focus') setShowFocusModal(true);
          if (item.id === 'share_insights') setShowShareModal(true);
        }}
        items={[
          {
            item: makeItem('set_focus', 'Set next race focus', hasFocusSet),
            statusText: intentFromThisRace?.focusText
              ? intentFromThisRace.focusText.slice(0, 30) + (intentFromThisRace.focusText.length > 30 ? '...' : '')
              : undefined,
            statusColor: IOS_COLORS.green,
            hasTool: true,
          },
          {
            item: makeItem('share_insights', 'Share insights', contentStatus.hasPostRaceNotes),
            statusText: contentStatus.hasPostRaceNotes ? 'Shared' : undefined,
            statusColor: IOS_COLORS.blue,
            hasTool: true,
          },
        ]}
      />

      {/* Equipment Issues Sheet */}
      <EquipmentIssuesSheet
        isOpen={showEquipmentSheet}
        onClose={() => setShowEquipmentSheet(false)}
        carryoverIssues={carryoverIssues}
        currentRaceIssues={currentRaceIssues}
        onAddIssue={(desc, priority) => addIssue(desc, priority, race.id, race.name)}
        onResolveIssue={(id) => resolveIssue(id, race.id)}
        onRemoveIssue={removeIssue}
        raceName={race.name}
      />

      {/* Race Result Detail Sheet */}
      <RaceResultDetailSheet
        isOpen={showResultSheet}
        onClose={() => setShowResultSheet(false)}
        raceId={race.id}
        raceName={race.name}
        raceDate={race.date ?? ''}
        userId={userId}
        analysisData={analysisData}
        timerSessionId={analysisData?.timerSessionId}
        onSaveComplete={() => {
          refetchState();
          refetchData();
        }}
      />

      {/* Structured Debrief Interview Modal */}
      {/* Always render modal to prevent unmount/remount issues - control visibility only via visible prop */}
      <StructuredDebriefInterview
        visible={showInterviewModal && !!userId}
        raceId={race.id}
        userId={userId || ''}
        raceName={race.name}
        onClose={() => {
          setShowInterviewModal(false);
          // Refetch in case user answered questions before closing
          refetchDebrief();
          refetchData();
        }}
        onComplete={() => {
          setShowInterviewModal(false);
          // Refetch all data to update UI and trigger auto-analysis
          refetchDebrief();
          refetchState();
          refetchData(); // Needed to get timerSessionId for AI analysis
        }}
      />

      {/* Next Race Focus Modal */}
      <Modal
        visible={showFocusModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFocusModal(false)}
      >
        <View style={styles.focusModalContainer}>
          <View style={styles.focusModalHeader}>
            <Text style={styles.focusModalTitle}>Next Race Focus</Text>
            <Pressable
              style={styles.focusModalClose}
              onPress={() => setShowFocusModal(false)}
              hitSlop={8}
            >
              <X size={24} color={IOS_COLORS.gray} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.focusModalScroll}
            contentContainerStyle={styles.focusModalContent}
          >
            <NextRaceFocusSection
              raceId={race.id}
              userId={userId}
              isExpanded={true}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Share Insights Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.focusModalContainer}>
          <View style={styles.focusModalHeader}>
            <Text style={styles.focusModalTitle}>Share Insights</Text>
            <Pressable
              style={styles.focusModalClose}
              onPress={() => setShowShareModal(false)}
              hitSlop={8}
            >
              <X size={24} color={IOS_COLORS.gray} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.focusModalScroll}
            contentContainerStyle={styles.focusModalContent}
          >
            <RaceContentActions
              regattaId={race.id}
              raceName={race.name}
              raceDate={race.date ?? ''}
              variant="full"
              onContentSaved={() => {
                // Refresh content status for the tile
                supabase
                  .from('regattas')
                  .select('prep_notes, post_race_notes')
                  .eq('id', race.id)
                  .maybeSingle()
                  .then(({ data }) => {
                    if (data) {
                      setContentStatus({
                        hasPrepNotes: !!data.prep_notes,
                        hasPostRaceNotes: !!data.post_race_notes,
                      });
                    }
                  });
              }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Performance Review Checklist Sheet */}
      <EducationalChecklistSheet
        isOpen={showPerformanceSheet}
        onClose={() => setShowPerformanceSheet(false)}
        title="Performance Review"
        subtitle="Review each aspect of your race to identify areas for improvement. Tap items to expand and learn more."
        accentColor="#007AFF"
        items={POST_RACE_REVIEW_CONFIG.items}
        isItemCompleted={isPerformanceItemCompleted}
        toggleItem={handlePerformanceToggle}
        completedCount={performanceCompletedCount}
        totalCount={performanceTotalCount}
        signatureInsightConfirmation={signatureInsightConfirmation}
      />

      {/* Learning Capture Checklist Sheet */}
      <EducationalChecklistSheet
        isOpen={showLearningSheet}
        onClose={() => setShowLearningSheet(false)}
        title="Learning & Improvement"
        subtitle="Capture your key learnings while they're fresh. Tap items to expand and see guidance."
        accentColor="#AF52DE"
        items={LEARNING_CAPTURE_CONFIG.items}
        isItemCompleted={isLearningItemCompleted}
        toggleItem={handleLearningToggle}
        completedCount={learningCompletedCount}
        totalCount={learningTotalCount}
        signatureInsightConfirmation={signatureInsightConfirmation}
      />

      {/* Coach Selection Sheet (for multiple coaches) */}
      <CoachSelectionSheet
        isOpen={showCoachSheet}
        onClose={() => setShowCoachSheet(false)}
        coaches={activeCoaches}
        phase="review"
        raceId={race.id}
        raceBoatClass={race.boatClass}
        onSelectCoach={(coach, action) => {
          if (action === 'share') {
            coachingService.shareDebriefWithCoach({
              coachId: coach.coachId,
              raceId: race.id,
              sailorId: userId || '',
              raceName: race.name,
            });
          } else {
            // Message action - navigate to coach messaging
            router.push(`/coach/${coach.coachId}?action=message&context=race_review&raceId=${race.id}` as any);
          }
        }}
      />

      {/* Toast notification for AI Analysis completion */}
      {showAIToast && (
        <Animated.View style={[styles.aiToast, { opacity: aiToastOpacity }]}>
          <View style={styles.aiToastContent}>
            <Sparkles size={16} color="#FFFFFF" />
            <Text style={styles.aiToastText}>Analysis ready!</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 20,
  },

  // Focus modal
  focusModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  focusModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
  },
  focusModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  focusModalClose: {
    padding: 4,
  },
  focusModalScroll: {
    flex: 1,
  },
  focusModalContent: {
    padding: 16,
  },

  // Toast notification for AI Analysis
  aiToast: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  aiToastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.purple,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  aiToastText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

// Phase components re-render whenever their parent RaceSummaryCard re-renders.
// Memoize so we skip when the handful of props passed in haven't changed.
export const AfterRaceContent = React.memo(AfterRaceContentImpl);

export default AfterRaceContent;
