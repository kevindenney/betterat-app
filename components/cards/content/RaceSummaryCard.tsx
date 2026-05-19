/**
 * RaceSummaryCard - Position 0 (Default View)
 *
 * Tufte-inspired race summary:
 * - Typography IS the interface (no colored badges)
 * - Maximum data density with sparklines
 * - Single encoding per concept (no icon + label)
 * - Every pixel shows data, not decoration
 */

import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Navigation,
  Trophy,
  Users,
  XCircle,
  Clock,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState, useRef, Component, ErrorInfo, useEffect, Suspense } from 'react';
import { ActionSheetIOS, LayoutAnimation, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView } from 'react-native-gesture-handler';
import { IOSSegmentedControl, PhaseTabsCanonical, type PhaseTabItem } from '@/components/ui/ios';
import { text } from '@/lib/design-tokens';
import { STEP_PALETTE } from '@/lib/step-theme';
import { showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { AddToBlueprintSheet } from '@/components/blueprint/AddToBlueprintSheet';
import { triggerHaptic } from '@/lib/haptics';
import { useRouter } from 'expo-router';

import { CrewHub } from '@/components/crew';
import type { CrewHubTab } from '@/components/crew';
import { DetailBottomSheet } from '@/components/races/DetailBottomSheet';
import { ModuleDetailBottomSheet } from '@/components/races/ModuleDetailBottomSheet';
import type { ModuleContentSummary } from '@/components/races/ModuleDetailBottomSheet';
import { RaceChatDrawer } from '@/components/races/RaceChatDrawer';
import { RaceStartInfoBar } from '@/components/races/RaceStartInfoBar';
import { CrewAvatarStack } from '@/components/races/CrewAvatarStack';
import { CollaborationPopover } from '@/components/races/CollaborationPopover';
import { useRaceCollaborators } from '@/hooks/useRaceCollaborators';
import { useRaceMessages } from '@/hooks/useRaceMessages';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { RaceCollaborationService } from '@/services/RaceCollaborationService';
import { useQueryClient } from '@tanstack/react-query';
import { DetailedReviewModal } from '@/components/races/DetailedReviewModal';
import { SuggestionsSection } from '@/components/races/suggestions/SuggestionsSection';
import { CardMenu, type CardMenuItem } from '@/components/shared/CardMenu';
import type { DetailCardType } from '@/constants/navigationAnimations';
import { useRaceAnalysisData } from '@/hooks/useRaceAnalysisData';
import { useRaceAnalysisState } from '@/hooks/useRaceAnalysisState';
import { useRacePreparation } from '@/hooks/useRacePreparation';
import { useRaceSeriesPosition } from '@/hooks/useRaceSeriesPosition';
import { useRaceStartOrder } from '@/hooks/useRaceStartOrder';
import { useRaceTuningRecommendation } from '@/hooks/useRaceTuningRecommendation';
import { useRaceWeatherForecast } from '@/hooks/useRaceWeatherForecast';
import { usePhaseCompletionCounts, formatPhaseCompletionLabel } from '@/hooks/usePhaseCompletionCounts';
import { NURSING_CORE_V1_CAPABILITIES } from '@/configs/competencies/nursing-core-v1';
import { detectRaceType } from '@/lib/races/raceDataUtils';
import {
  CardContentProps,
  RACE_PHASES,
  RacePhase,
  getCurrentPhaseForRace,
} from '../types';
import { useInterestEventConfig } from '@/hooks/useInterestEventConfig';
import { useInterest } from '@/providers/InterestProvider';
import { useVocabulary } from '@/hooks/useVocabulary';
import { CoachNudgeBanner } from '@/components/interest/CoachNudgeBanner';
import { useProactiveNudge } from '@/hooks/useProactiveNudge';
import { supabase } from '@/services/supabase';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';
import { isUuid } from '@/utils/uuid';
import { ConfigDrivenPhaseContent } from './phases';
import { StepPlanQuestions } from '@/components/step/StepPlanQuestions';
import { PlanQuestionCard } from '@/components/step/PlanQuestionCard';
import { StepDrawContent } from '@/components/step/StepDrawContent';
import { DateEnrichmentCard } from '@/components/step/DateEnrichmentCard';
import { DoTabIOSRegisterShell } from '@/components/step/do-tab';
import { ReflectTabIOSRegisterShell } from '@/components/step/reflect-tab';
import { StepCritiqueContent } from '@/components/step/StepCritiqueContent';
import { StepFocusConcepts } from '@/components/step/StepFocusConcepts';
import { StepProvenanceBanner } from '@/components/step/StepProvenanceBanner';
import { StepBlueprintChrome } from '@/components/step/StepBlueprintChrome';
import { StepDiscussionPeek } from '@/components/step/StepDiscussionPeek';
import { StepDiscussionInline } from '@/components/step/StepDiscussionInline';
import { StepCompleteCelebration } from '@/components/step/StepCompleteCelebration';
import { SinceLastVisitStrip } from '@/components/step/SinceLastVisitStrip';
import { useStepBlueprintChrome } from '@/hooks/useStepBlueprintChrome';
import { useStepDiscussionPeek } from '@/hooks/useStepDiscussionPeek';
import { useStepCompleteCelebration } from '@/hooks/useStepCompleteCelebration';
import { useContinueToNextBlueprintStep } from '@/hooks/useContinueToNextBlueprintStep';
import { useStepSinceVisitEvents } from '@/hooks/useStepSinceVisitEvents';
import { AIStructureReview } from '@/components/step/AIStructureReview';
import { CollaboratorPicker } from '@/components/step/CollaboratorPicker';
import { DueDatePickerModal } from '@/components/step/DueDatePickerModal';
import { SuggestStepSheet } from '@/components/step/SuggestStepSheet';
import type { BrainDumpData, StepMetadata, StepPlanData, StepCollaborator, SubStep } from '@/types/step-detail';
import { useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useUserBlueprints } from '@/hooks/useBlueprint';
import { useUpdateStep } from '@/hooks/useTimelineSteps';
import type { TimelineStepVisibility, TimelineStepSourceType } from '@/types/timeline-steps';
import { useAuth } from '@/providers/AuthProvider';
import { structureBrainDump } from '@/services/ai/StepPlanAIService';
import { saveUrlsToLibrary } from '@/services/ai/BrainDumpAIService';
import { resolveEntities, buildEntityInput } from '@/services/ai/EntityResolutionService';
import { enrichDateForSailing } from '@/services/ai/DateEnrichmentService';
import { NotificationService } from '@/services/NotificationService';
import { enableStepSharing } from '@/services/TimelineStepService';
import { sailorBoatService } from '@/services/SailorBoatService';
import { equipmentService } from '@/services/EquipmentService';
import type { AnyExtractedEntity, DateEnrichment, ExtractedPersonEntity } from '@/types/step-detail';

// Heavy sailing-only phase components are code-split: only one of the three is
// ever mounted at a time (based on the race's temporal phase), so lazy-loading
// saves ~6500 lines of component parse cost on first card render.
const AfterRaceContent = React.lazy(() => import('./phases/AfterRaceContent'));
const DaysBeforeContent = React.lazy(() => import('./phases/DaysBeforeContent'));
const OnWaterContent = React.lazy(() => import('./phases/OnWaterContent'));
// BrainDumpEntry now embedded in StepPlanQuestions/PlanTab

// =============================================================================
// iOS SYSTEM COLORS (Apple HIG)
// =============================================================================

const IOS_COLORS = {
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  purple: '#AF52DE',
  gray: '#8E8E93',
  gray2: '#AEAEB2',
  gray3: '#C7C7CC',
  gray4: '#D1D1D6',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
};

const NURSING_CAPABILITY_TITLE_BY_ID = new globalThis.Map(
  NURSING_CORE_V1_CAPABILITIES.map((capability) => [capability.id, capability.title])
);

// Phase labels are now driven by useInterestEventConfig() — see phaseTabs useMemo below

// =============================================================================
// ERROR BOUNDARY for phase content debugging
// =============================================================================

class PhaseContentErrorBoundary extends Component<
  { children: React.ReactNode; phase: string },
  { hasError: boolean; error: string | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PhaseContentErrorBoundary] ${this.props.phase} crashed:`, error.message, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 14, color: '#FF3B30', fontWeight: '600', marginBottom: 8 }}>
            Phase content error
          </Text>
          <Text style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center' }}>
            {this.state.error || 'Unknown error'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate countdown to race start
 */
function calculateCountdown(date: string, startTime?: string): {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  daysSince: number; // Days since race completed (for past races)
} {
  const now = new Date();
  const raceDate = new Date(date);

  // Guard against invalid dates (empty string, undefined, etc.)
  if (!date || Number.isNaN(raceDate.getTime())) {
    return { days: 0, hours: 0, minutes: 0, isPast: false, isToday: false, isTomorrow: false, daysSince: 0 };
  }

  // Set start time if provided
  if (startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    raceDate.setHours(hours || 0, minutes || 0, 0, 0);
  }

  const diffMs = raceDate.getTime() - now.getTime();
  const isPast = diffMs < 0;

  const absDiffMs = Math.abs(diffMs);
  const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));

  // Days since race (for past races)
  const daysSince = isPast ? days : 0;

  // Check if today or tomorrow
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const raceDayStart = new Date(raceDate);
  raceDayStart.setHours(0, 0, 0, 0);

  const isToday = raceDayStart.getTime() === today.getTime();
  const isTomorrow = raceDayStart.getTime() === tomorrow.getTime();

  return { days, hours, minutes, isPast, isToday, isTomorrow, daysSince };
}

/**
 * Format time for display
 */
function formatTime(time?: string): string {
  if (!time) return 'TBD';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function buildNormalizedRaceDateTime(date?: string, startTime?: string): Date | null {
  if (!date) return null;
  const base = new Date(date);
  if (Number.isNaN(base.getTime())) return null;

  // If date already includes a timestamp, trust it as the single source of truth.
  if (typeof date === 'string' && date.includes('T')) {
    return base;
  }

  // Date-only value: apply startTime (if present) in local time.
  const normalized = new Date(base);
  normalized.setHours(0, 0, 0, 0);
  if (startTime) {
    const [hh, mm] = startTime.split(':').map(Number);
    normalized.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  }
  return normalized;
}


function parseStringIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => entry.length > 0);
      }
    } catch {}
    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}


/**
 * Format countdown in full format: "3d 2h until race"
 * This is the restored Tufte-style countdown format
 */
function formatCountdownFull(countdown: {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
}): string {
  if (countdown.isPast) return 'Race completed';

  const parts: string[] = [];
  if (countdown.days > 0) parts.push(`${countdown.days}d`);
  if (countdown.hours > 0) parts.push(`${countdown.hours}h`);
  if (parts.length === 0) parts.push(`${countdown.minutes}m`);

  return `${parts.join(' ')} until race`;
}

/**
 * Format full date for display
 * "Saturday, Jan 25 at 3:00 PM"
 */
function formatFullDate(date: string, time?: string): string {
  const d = buildNormalizedRaceDateTime(date, time);
  if (!d) return 'Date TBD';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday}, ${month} ${day} at ${timeStr}`;
}

/**
/**
 * Tufte: Determine active phase for inline progress bar
 * Returns the first incomplete phase, or null if all complete
 */
function getActivePhaseForProgress(
  phaseCounts: Record<string, { completed: number; total: number }>,
  isPast: boolean
): { name: string; completed: number; total: number } | null {
  // For past races, show review if incomplete
  if (isPast) {
    const review = phaseCounts['after_race'];
    if (review && review.completed < review.total) {
      return { name: 'Review', ...review };
    }
    return null; // All done
  }

  // Show prep if incomplete (days_before phase)
  const prep = phaseCounts['days_before'];
  if (prep && prep.completed < prep.total) {
    return { name: 'Prep', ...prep };
  }

  // Show race if incomplete (on_water phase)
  const race = phaseCounts['on_water'];
  if (race && race.completed < race.total) {
    return { name: 'Race', ...race };
  }

  // Show review if incomplete (after_race phase)
  const review = phaseCounts['after_race'];
  if (review && review.completed < review.total) {
    return { name: 'Review', ...review };
  }

  return null; // All complete
}

/**
 * Get urgency color based on countdown (iOS system colors)
 */
function getUrgencyColor(days: number, hours: number, isPast: boolean): {
  bg: string;
  text: string;
  label: string;
} {
  if (isPast) {
    return { bg: IOS_COLORS.gray6, text: IOS_COLORS.gray, label: 'Completed' };
  }
  if (days === 0 && hours < 2) {
    return { bg: '#FFEBE9', text: IOS_COLORS.red, label: 'Starting Soon' };
  }
  // All upcoming races show green (Today, Tomorrow, This Week, Upcoming)
  if (days === 0) {
    return { bg: '#E8FAE9', text: IOS_COLORS.green, label: 'Today' };
  }
  if (days <= 1) {
    return { bg: '#E8FAE9', text: IOS_COLORS.green, label: 'Tomorrow' };
  }
  return { bg: '#E8FAE9', text: IOS_COLORS.green, label: 'Upcoming' };
}

/**
 * Get race type badge styling (iOS system colors)
 */
function getRaceTypeBadge(raceType: 'fleet' | 'distance' | 'match' | 'team'): {
  bg: string;
  text: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
} {
  switch (raceType) {
    case 'distance':
      return {
        bg: '#F3E8FF',
        text: IOS_COLORS.purple,
        label: 'DISTANCE',
        icon: Navigation,
      };
    case 'match':
      return {
        bg: '#FFF4E5',
        text: IOS_COLORS.orange,
        label: 'MATCH',
        icon: Trophy,
      };
    case 'team':
      return {
        bg: '#E5F1FF',
        text: IOS_COLORS.blue,
        label: 'TEAM',
        icon: Users,
      };
    case 'fleet':
    default:
      return {
        bg: '#E8FAE9',
        text: IOS_COLORS.green,
        label: 'FLEET',
        icon: Flag,
      };
  }
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Calculate planned arrival time from race start and minutes before
 */
function calculateArrivalTime(raceDate: string, startTime: string | undefined, minutesBefore: number): string {
  const d = new Date(raceDate);
  if (startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    d.setHours(hours || 0, minutes || 0, 0, 0);
  }
  d.setMinutes(d.getMinutes() - minutesBefore);
  return d.toISOString();
}

// =============================================================================
// VISIBILITY OPTIONS
// =============================================================================

const VISIBILITY_OPTIONS: { value: TimelineStepVisibility; label: string; icon: string }[] = [
  { value: 'private', label: 'Private (only you)', icon: 'lock-closed-outline' },
  { value: 'crew', label: 'Crew', icon: 'people-outline' },
  { value: 'fleet', label: 'Fleet', icon: 'business-outline' },
  { value: 'public', label: 'Public', icon: 'globe-outline' },
];

// =============================================================================
// COMPONENT
// =============================================================================

function RaceSummaryCardImpl({
  race,
  cardType: _cardType,
  isActive,
  dimensions: _dimensions,
  canManage,
  // onEdit removed from menu — every field is now inline-editable on the cover.
  // Prop kept on the type for now; parent call sites can drop it in a follow-up.
  onEdit: _onEdit,
  onDelete,
  onRaceComplete: _onRaceComplete,
  onOpenPostRaceInterview,
  userId,
  onDismiss,
  seasonWeek,
  raceNumber,
  totalRaces,
  // Timeline navigation props (compact axis inside card footer)
  timelineRaces,
  currentRaceIndex,
  onSelectRace,
  nextRaceIndex,
  // Scroll handler forwarded from parent for toolbar hide/show
  onContentScroll,
  // Handler for card press (navigation to this card when clicking partially visible cards)
  onCardPress,
  // Refetch trigger for AfterRaceContent
  refetchTrigger,
  // Move Earlier / Move Later removed from menu — reordering happens via drag in
  // grid view. Props kept on the type for now; drop in a follow-up.
  onMoveStepEarlier: _onMoveStepEarlier,
  onMoveStepLater: _onMoveStepLater,
  onMoveStepToPlannedNext,
  onMoveStepToCompletedMostRecent,
  onSetDueDate,
  onNextStepCreated,
}: CardContentProps) {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { currentInterest } = useInterest();
  const eventConfig = useInterestEventConfig();
  const interestSlug = currentInterest?.slug || eventConfig.interestSlug || 'sail-racing';
  const isSailing = interestSlug === 'sail-racing';
  // Vocab follows the step's interest when present (e.g. viewing another user's
  // step from a different interest), otherwise the viewer's active interest.
  const { vocab: _vocab } = useVocabulary(race.interest_id ?? currentInterest?.id);

  // Temporal phase state — for timeline steps, map status to the right tab
  const isTimelineStep = Boolean(race.isTimelineStep);

  // Phase 10 PR-2/3 — Blueprint chrome + Discussion peek for subscribed-blueprint
  // steps. Both hooks return null when there's nothing to show, so the surfaces
  // are purely additive. Stored at module scope of the component so they fire
  // whether the step renders via RaceSummaryCard (carousel) or StepDetailContent
  // (direct route).
  const chromeStepId = isTimelineStep ? race.id : null;
  const { data: blueprintChrome } = useStepBlueprintChrome(chromeStepId);
  const { data: discussionPeek } = useStepDiscussionPeek(chromeStepId);
  const showBlueprintChrome =
    FEATURE_FLAGS.SUBSCRIBED_STEP_CHROME_V1 && Boolean(blueprintChrome);
  const showDiscussionPeek =
    FEATURE_FLAGS.STEP_DISCUSSION_V1 && Boolean(discussionPeek);
  const goBlueprintIndex = useCallback(() => {
    if (!blueprintChrome) return;
    router.push(`/(tabs)/playbook/blueprints/${blueprintChrome.blueprintId}/all-steps` as any);
  }, [blueprintChrome, router]);
  const goFleetView = useCallback(() => {
    if (!blueprintChrome) return;
    router.push(`/practice/blueprint/${blueprintChrome.blueprintId}/fleet` as any);
  }, [blueprintChrome, router]);

  // Discussion-tab state declared early so the peek's tap handler can
  // reference setDiscussionTabActive. Showability is gated by feature flag
  // + presence of blueprint chrome (subscribed-blueprint step only).
  const [discussionTabActive, setDiscussionTabActive] = useState(false);
  const showDiscussionTab =
    FEATURE_FLAGS.STEP_DISCUSSION_V1 && Boolean(blueprintChrome);

  // Phase 10 PR-4 — step-complete celebration data. Resolved whenever this
  // step is part of a subscribed blueprint; gated at render time by
  // status==='completed'. Source step id lives on the adopted copy's
  // source_id column (set by adoptStep).
  const celebrationSourceStepId =
    (race as { source_id?: string | null } | null)?.source_id ?? null;
  const { data: celebrationData, isLoading: celebrationLoading } =
    useStepCompleteCelebration({
      stepId: isTimelineStep ? race.id : null,
      blueprintId: blueprintChrome?.blueprintId ?? null,
      sourceStepId: celebrationSourceStepId,
    });
  const stepIsCompleted =
    (race.stepStatus ?? race.status) === 'completed' ||
    (race.stepStatus ?? race.status) === 'done';
  const showCelebration =
    isTimelineStep && Boolean(blueprintChrome) && stepIsCompleted;
  const continueNext = useContinueToNextBlueprintStep({
    blueprintId: blueprintChrome?.blueprintId ?? null,
    interestId: (race as { interest_id?: string | null } | null)?.interest_id ?? null,
    nextSourceStepId: celebrationData?.next?.sourceStepId ?? null,
    alreadyAdoptedStepId: celebrationData?.next?.alreadyAdoptedStepId ?? null,
  });

  // Phase 10 PR-4 — "since your last visit" strip on the Plan tab. Surfaces
  // peer notes + coach replies recent enough to be interesting. Hidden when
  // empty or on non-subscribed steps.
  const { data: sinceVisitEvents } = useStepSinceVisitEvents(
    isTimelineStep ? race.id : null,
  );
  // Phase check happens inside the Plan branch of renderPhaseContent, so we
  // don't gate on selectedPhase here (it's declared further down anyway).
  const showSinceLastVisit =
    Boolean(blueprintChrome) &&
    !discussionTabActive &&
    Array.isArray(sinceVisitEvents) &&
    sinceVisitEvents.length > 0;

  const goDiscussion = useCallback(() => {
    if (!isTimelineStep) return;
    // Switch the active phase tab to Discussion instead of pushing the
    // fullscreen route. The 4th-tab inline view is the canonical surface
    // for blueprint-subscribed step discussion; the fullscreen route is
    // kept for non-step entry points only.
    triggerHaptic('selection');
    setDiscussionTabActive(true);
  }, [isTimelineStep]);
  const stepStatus = race.stepStatus ?? race.status;
  const currentPhase = useMemo(() => {
    if (isTimelineStep) {
      if (stepStatus === 'completed' || stepStatus === 'done') return 'after_race' as RacePhase;
      if (stepStatus === 'in_progress') return 'on_water' as RacePhase;
      // Auto-advance overdue steps: if due date has passed, show Review tab
      const dueAt = race.due_at;
      if (dueAt && new Date(dueAt) < new Date()) return 'after_race' as RacePhase;
      return 'days_before' as RacePhase; // pending, planned, or any other
    }
    return getCurrentPhaseForRace(race.date ?? '', race.startTime);
  }, [race.date, race.startTime, isTimelineStep, stepStatus, race.due_at]);
  // Restore last-used tab for this step, falling back to status-derived default
  const [selectedPhase, setSelectedPhase] = useState<RacePhase>(() => {
    if (isTimelineStep && typeof window !== 'undefined') {
      const saved = window.localStorage?.getItem(`step_tab:${race.id}`);
      if (saved === 'days_before' || saved === 'on_water' || saved === 'after_race') return saved;
    }
    return currentPhase;
  });

  // Persist tab selection for timeline steps
  useEffect(() => {
    if (isTimelineStep && typeof window !== 'undefined') {
      window.localStorage?.setItem(`step_tab:${race.id}`, selectedPhase);
    }
  }, [selectedPhase, isTimelineStep, race.id]);

  // Proactive AI coaching nudge
  const stepInterestId = race.interest_id ?? currentInterest?.id;
  const { nudge: coachNudge, dismiss: dismissNudge } = useProactiveNudge(stepInterestId, selectedPhase);

  // Inline title editing for timeline steps
  const updateStepMutation = useUpdateStep();
  const queryClient = useQueryClient();
  const [editTitle, setEditTitle] = useState(race.name || '');
  const titleInputRef = useRef<TextInput>(null);
  // Track the last title we saved locally so we don't revert on prop re-sync
  const lastSavedTitle = useRef<string | null>(null);

  // Sync editTitle from race.name prop — but skip if we just saved locally
  useEffect(() => {
    if (lastSavedTitle.current !== null && race.name === lastSavedTitle.current) {
      // Prop caught up to our local save — clear the guard
      lastSavedTitle.current = null;
      return;
    }
    if (lastSavedTitle.current !== null) {
      // Prop changed but hasn't caught up to our save yet — keep local value
      return;
    }
    setEditTitle(race.name || '');
  }, [race.name]);

  // Ref forward-declarations so handleTitleSubmit can reach the metadata
  // updater (defined later in this component). Written by their respective
  // useEffect below.
  const placeholderTitleFlagRef = useRef<boolean>(false);
  const updateStepMetadataRef = useRef<
    ((partial: Record<string, unknown>) => void) | null
  >(null);

  const handleTitleSubmit = useCallback(() => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      // Revert to current name if blank
      setEditTitle(race.name || '');
      return;
    }
    if (trimmed === race.name) return;

    // Update local state immediately — this is what prevents the revert
    setEditTitle(trimmed);
    lastSavedTitle.current = trimmed;

    // Optimistically update all timeline-steps caches, and drop the
    // `_placeholder_title` metadata flag so the "Tap to name this step"
    // hint disappears even if the user re-saves "Untitled".
    queryClient.setQueriesData<any[]>(
      { queryKey: ['timeline-steps'] },
      (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((s) => {
          if (s.id !== race.id) return s;
          const meta = { ...(s.metadata || {}) } as Record<string, unknown>;
          if ('_placeholder_title' in meta) delete meta._placeholder_title;
          return { ...s, title: trimmed, metadata: meta };
        });
      },
    );

    updateStepMutation.mutate({ stepId: race.id, input: { title: trimmed } });
    // Clear the placeholder-title flag server-side so it doesn't reappear
    // after the row refetches.
    if (placeholderTitleFlagRef.current && updateStepMetadataRef.current) {
      updateStepMetadataRef.current({ _placeholder_title: null });
    }
  }, [editTitle, race.name, race.id, updateStepMutation, queryClient]);

  // Visibility change handler for timeline steps
  const currentVisibility = (race?.visibility as TimelineStepVisibility) ?? 'private';
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);

  const handleChangeVisibility = useCallback(() => {
    if (Platform.OS === 'ios') {
      const options = VISIBILITY_OPTIONS.map((o) =>
        o.value === currentVisibility ? `${o.label} ✓` : o.label
      );
      options.push('Cancel');
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Who can see this step?',
          options,
          cancelButtonIndex: options.length - 1,
        },
        (buttonIndex) => {
          if (buttonIndex < VISIBILITY_OPTIONS.length) {
            const selected = VISIBILITY_OPTIONS[buttonIndex].value;
            if (selected !== currentVisibility) {
              updateStepMutation.mutate({ stepId: race.id, input: { visibility: selected } });
            }
          }
        },
      );
    } else {
      // Android / web — show inline picker
      setShowVisibilityPicker(true);
    }
  }, [currentVisibility, race.id, updateStepMutation]);

  const handleSelectVisibility = useCallback((value: TimelineStepVisibility) => {
    setShowVisibilityPicker(false);
    if (value !== currentVisibility) {
      updateStepMutation.mutate({ stepId: race.id, input: { visibility: value } });
    }
  }, [currentVisibility, race.id, updateStepMutation]);

  // Brain dump state for timeline steps
  const metadata = race?.metadata as StepMetadata | undefined;
  const serverBrainDump = metadata?.brain_dump;
  // Local brain dump state tracks the latest data (server metadata may lag behind)
  const [localBrainDump, setLocalBrainDump] = useState<BrainDumpData | undefined>(serverBrainDump);
  const brainDumpData = localBrainDump ?? serverBrainDump;
  const _hasPlanContent = Boolean(
    metadata?.plan?.what_will_you_do?.trim() ||
    (metadata?.plan?.how_sub_steps?.length && metadata?.plan?.how_sub_steps.some((s) => s.text.trim())) ||
    metadata?.plan?.collaborators?.length ||
    metadata?.plan?.where_location?.name?.trim() ||
    metadata?.plan?.competency_ids?.length ||
    metadata?.plan?.linked_resource_ids?.length
  );
  const [showAiReview, setShowAiReview] = useState(false);

  // Sub-step progress for compact progress bar
  const subStepProgress = useMemo(() => {
    const steps = metadata?.plan?.how_sub_steps || [];
    const real = steps.filter((s: SubStep) => s.text?.trim());
    if (real.length === 0) return null;
    const completed = real.filter((s: SubStep) => s.completed).length;
    return { total: real.length, completed };
  }, [metadata?.plan?.how_sub_steps]);

  // Step collaborators (from metadata.plan.collaborators)
  const stepCollaborators: StepCollaborator[] = useMemo(
    () => metadata?.plan?.collaborators ?? [],
    [metadata?.plan?.collaborators],
  );
  const [showStepCollabPicker, setShowStepCollabPicker] = useState(false);
  const [showSuggestSheet, setShowSuggestSheet] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const stepCollabExistingIds = useMemo(
    () => new Set(stepCollaborators.map((c) => c.user_id || c.id)),
    [stepCollaborators],
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
  const updateStepMetadata = useUpdateStepMetadata(isTimelineStep ? race.id : '');
  const { data: userBlueprints } = useUserBlueprints();

  // Forward the placeholder-title flag + metadata updater to handleTitleSubmit.
  // `handleTitleSubmit` is declared earlier and can't reach these values by
  // scope, so we shuttle them through refs.
  const hasPlaceholderTitle = Boolean(
    (metadata as any)?._placeholder_title === true,
  );
  useEffect(() => {
    placeholderTitleFlagRef.current = hasPlaceholderTitle;
  }, [hasPlaceholderTitle]);
  useEffect(() => {
    updateStepMetadataRef.current = (partial) => {
      updateStepMetadata.mutate(partial as any);
    };
  }, [updateStepMetadata]);

  const handleStructureWithAI = useCallback(async (dump: BrainDumpData) => {
    updateStepMetadata.mutate({ brain_dump: dump });
    setAiStructuring(true);

    // Save extracted URLs to library in the background
    const resolvedInterestId = race.interest_id ?? currentInterest?.id;
    if (dump.extracted_urls.length > 0 && user?.id && resolvedInterestId) {
      saveUrlsToLibrary(dump.extracted_urls, user.id, resolvedInterestId)
        .then((savedIds) => {
          savedLibraryIdsRef.current = savedIds;
        })
        .catch(() => {});
    }

    try {
      const result = await structureBrainDump({
        brainDump: dump,
        interestName: currentInterest?.name ?? 'sailing',
        interestId: race.interest_id ?? currentInterest?.id,
        interestSlug: currentInterest?.slug,
        userId: user?.id ?? '',
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
      setAiSuggestedTitle(result.suggested_title || undefined);
      setResolvedEntities([]);
      setDateEnrichment(undefined);
      setEntityResolutionError(null);
      setShowAiReview(true);

      // Fire entity resolution async (updates state as results arrive)
      if (user?.id) {
        const entityInput = buildEntityInput(dump, result.extracted_entities, result.who_collaborators);
        setIsResolvingEntities(true);
        resolveEntities(entityInput, user.id)
          .then(async (resolution) => {
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
          })
          .catch((err) => {
            console.error('[EntityResolution] failed:', err);
            setEntityResolutionError(String(err));
          })
          .finally(() => setIsResolvingEntities(false));
      }
    } catch (err) {
      console.error('AI structuring failed:', err);
      const plan: StepPlanData = {
        what_will_you_do: dump.raw_text,
        who_collaborators: dump.extracted_people,
        capability_goals: dump.extracted_topics.length > 0 ? dump.extracted_topics : undefined,
      };
      setAiReviewPlan(plan);
      setShowAiReview(true);
    } finally {
      setAiStructuring(false);
    }
  }, [updateStepMetadata, currentInterest, race, user]);

  const handleConfirmAIPlan = useCallback((confirmedPlan: StepPlanData, title?: string) => {
    // Merge any saved library resource IDs into the plan
    let enrichedPlan: StepPlanData = savedLibraryIdsRef.current.length > 0
      ? { ...confirmedPlan, linked_resource_ids: [
          ...new Set([...(confirmedPlan.linked_resource_ids ?? []), ...savedLibraryIdsRef.current]),
        ]}
      : { ...confirmedPlan };

    // Convert who_collaborators strings to structured StepCollaborator entries
    // Use resolved person entities for platform user linking
    const personEntities = resolvedEntities.filter(
      (e): e is ExtractedPersonEntity => e.type === 'person',
    );
    if (personEntities.length > 0) {
      enrichedPlan.collaborators = personEntities.map((p, i) => ({
        id: p.matched_user_id || `external_${i}_${Date.now()}`,
        type: (p.matched_user_id ? 'platform' : 'external') as 'platform' | 'external',
        user_id: p.matched_user_id,
        display_name: p.matched_display_name || p.raw_text,
      }));
    } else if (enrichedPlan.who_collaborators?.length && !enrichedPlan.collaborators?.length) {
      enrichedPlan.collaborators = enrichedPlan.who_collaborators
        .filter((name) => name.trim())
        .map((name, i) => ({
          id: `external_${i}_${Date.now()}`,
          type: 'external' as const,
          display_name: name.trim(),
        }));
    }

    // Add entity context
    if (resolvedEntities.length > 0) {
      enrichedPlan.equipment_context = resolvedEntities;
    }
    if (dateEnrichment) {
      enrichedPlan.date_enrichment = dateEnrichment;
    }

    updateStepMetadata.mutate(
      {
        plan: enrichedPlan,
        brain_dump: { ...(brainDumpData ?? {} as BrainDumpData), ai_structured_at: new Date().toISOString() },
      },
      {
        onSuccess: () => {
          // Only transition after DB write + cache update complete
          // so StepPlanQuestions reads the confirmed plan from cache
          setAiReviewPlan(null);
          setShowAiReview(false);
          savedLibraryIdsRef.current = [];
          setResolvedEntities([]);
          // Keep dateEnrichment in local state so it persists across tab switches
          // (race.metadata won't refresh until the list query re-fetches)
        },
      },
    );

    // Update step title and optional starts_at from first date entity
    const stepUpdate: Record<string, any> = {};
    if (title) stepUpdate.title = title;
    const firstDate = resolvedEntities.find(
      (e): e is import('@/types/step-detail').ExtractedDateEntity => e.type === 'date',
    );
    if (firstDate?.parsed_iso) stepUpdate.starts_at = firstDate.parsed_iso;
    if (Object.keys(stepUpdate).length > 0) {
      updateStepMutation.mutate({ stepId: race.id, input: stepUpdate });
    }
  }, [race.id, brainDumpData, updateStepMetadata, updateStepMutation, resolvedEntities, dateEnrichment]);

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

  const handleBackToDump = useCallback(() => {
    setShowAiReview(false);
    setAiReviewPlan(null);
    setResolvedEntities([]);
    setDateEnrichment(undefined);
  }, []);

  const handleDraftChange = useCallback((dump: BrainDumpData) => {
    setLocalBrainDump(dump);
    updateStepMetadata.mutate({ brain_dump: dump });
  }, [updateStepMetadata]);

  const handleConversationalCreate = useCallback((conversationalPlan: Partial<StepPlanData>, suggestedTitle?: string) => {
    // eslint-disable-next-line no-console
    console.log('[RaceSummaryCard] handleConversationalCreate:', { suggestedTitle, planKeys: Object.keys(conversationalPlan) });
    const currentPlan = (metadata?.plan ?? {}) as StepPlanData;
    updateStepMetadata.mutate({ plan: { ...currentPlan, ...conversationalPlan } });
    if (suggestedTitle) {
      updateStepMutation.mutate({ stepId: race.id, input: { title: suggestedTitle } });
      setEditTitle(suggestedTitle); // Immediately update local title state
    }
  }, [metadata, updateStepMetadata, updateStepMutation, race.id]);

  // Detail bottom sheet state
  const [activeDetailSheet, setActiveDetailSheet] = useState<DetailCardType | null>(null);

  // Module detail sheet state (non-sailing interests)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  // Module content state (tracks user-entered content for tile previews)
  const [moduleContent, setModuleContent] = useState<Record<string, ModuleContentSummary>>({});
  const handleModuleContentChange = useCallback((modId: string, summary: ModuleContentSummary) => {
    setModuleContent((prev) => ({ ...prev, [modId]: summary }));
  }, []);
  const [advancedCompetencyCount, setAdvancedCompetencyCount] = useState(0);
  const [hasValidatedCompetency, setHasValidatedCompetency] = useState(false);
  const moduleArtifactContext = useMemo(() => {
    const source = String(race?._source || race?.source || race?.source_table || '').toLowerCase();
    const explicitType = String(race?.event_type || race?.eventType || race?.metadata?.event_type || '').toLowerCase();
    const explicitId = String(race?.event_id || race?.eventId || race?.metadata?.event_id || '').trim();
    const fallbackId = String(race?.id || '').trim();
    const eventId = explicitId || fallbackId;

    let eventType: 'regatta' | 'race_event' | null = null;
    if (explicitType === 'regatta' || explicitType === 'race_event') {
      eventType = explicitType;
    } else if (source.includes('race_event')) {
      eventType = 'race_event';
    } else if (source.includes('regatta') || eventId.length > 0) {
      eventType = 'regatta';
    }

    if (!eventType || !eventId) return null;
    return {
      eventType,
      eventId,
      userId: userId || null,
    };
  }, [race, userId]);

  useEffect(() => {
    let isCancelled = false;
    const loadAdvancedCount = async () => {
      if (
        interestSlug !== 'nursing'
        || !userId
        || !isUuid(userId)
        || !moduleArtifactContext?.eventId
        || !isUuid(moduleArtifactContext.eventId)
      ) {
        if (!isCancelled) {
          setAdvancedCompetencyCount(0);
          setHasValidatedCompetency(false);
        }
        return;
      }

      const primaryQuery = supabase
        .from('betterat_competency_attempts')
        .select('competency_id,artifact_id,status')
        .eq('user_id', userId)
        .eq('event_id', moduleArtifactContext.eventId)
        .eq('event_type', moduleArtifactContext.eventType);
      let { data, error } = await primaryQuery;
      if (error) {
        if (isMissingSupabaseColumn(error, 'betterat_competency_attempts.event_type')) {
          const fallback = await supabase
            .from('betterat_competency_attempts')
            .select('competency_id,artifact_id,status')
            .eq('user_id', userId)
            .eq('event_id', moduleArtifactContext.eventId);
          data = fallback.data;
          error = fallback.error;
        }
      }
      if (error) {
        if (!isCancelled) {
          setAdvancedCompetencyCount(0);
          setHasValidatedCompetency(false);
        }
        return;
      }

      const hasValidated = (data || []).some((row: any) => (
        typeof row.artifact_id === 'string'
        && row.artifact_id.length > 0
        && String(row.status || '') === 'validated'
      ));

      const uniqueIds = new Set(
        (data || [])
          .filter((row: any) => typeof row.artifact_id === 'string' && row.artifact_id.length > 0)
          .map((row: any) => String(row.competency_id || ''))
          .filter((id: string) => id.length > 0)
      );

      if (!isCancelled) {
        setAdvancedCompetencyCount(uniqueIds.size);
        setHasValidatedCompetency(hasValidated);
      }
    };

    loadAdvancedCount();

    return () => {
      isCancelled = true;
    };
  }, [interestSlug, moduleArtifactContext, userId]);

  // Detailed Review modal state
  const [showDetailedReview, setShowDetailedReview] = useState(false);

  // Crew Hub state (unified crew management)
  const [showCrewHub, setShowCrewHub] = useState(false);
  const [crewHubInitialTab, setCrewHubInitialTab] = useState<CrewHubTab>('roster');

  // Chat drawer state
  const [showChat, setShowChat] = useState(false);
  const [showCollabPopover, setShowCollabPopover] = useState(false);
  const { collaborators } = useRaceCollaborators(isTimelineStep ? null : race.id);

  // Messages for collaboration popover activity feed
  const { messages: raceMessages } = useRaceMessages({
    regattaId: isTimelineStep ? undefined : race.id,
    realtime: FEATURE_FLAGS.ENABLE_RACE_CREW_CHAT,
  });

  // Share handler
  const handleShare = useCallback(async () => {
    try {
      if (isTimelineStep) {
        // Timeline steps: share with a link to the step
        const { url } = await enableStepSharing(race.id);
        const planWhat = (metadata?.plan?.what_will_you_do || '').trim();
        const parts = [race.name || 'Untitled step'];
        if (planWhat) parts.push(planWhat);
        parts.push(url);
        parts.push('Shared from BetterAt');
        await Share.share({ message: parts.join('\n'), title: race.name, url });
      } else {
        const dateStr = new Date(race.date ?? '').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        const activityLabel = eventConfig.eventNoun || (isSailing ? 'Race' : 'Activity');
        const locationLabel = isSailing ? 'Venue' : 'Location';
        const sourceLabel = isSailing ? 'Shared from RegattaFlow' : 'Shared from BetterAt Clinical';
        const locationValue = race.venue || 'TBD';

        const parts = [`${activityLabel}: ${race.name}`, `${activityLabel} date: ${dateStr}`];
        parts.push(`${locationLabel}: ${locationValue}`);
        parts.push(sourceLabel);
        await Share.share({ message: parts.join('\n'), title: race.name });
      }
    } catch {
      // User cancelled — no-op
    }
  }, [eventConfig.eventNoun, isSailing, isTimelineStep, race.id, race.name, race.date, race.venue, metadata?.plan?.what_will_you_do]);

  // Extract collaboration flags from race
  const isOwner = race.isOwner ?? (isTimelineStep ? (race as any).user_id === user?.id : true);
  const isCollaborator = race.isCollaborator ?? false;
  const isPendingInvite = race.isPendingInvite ?? false;
  const collaboratorId = race.collaboratorId;

  // Accept/decline invite handlers
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const handleAcceptInvite = useCallback(async () => {
    if (!collaboratorId || isAccepting) return;
    setIsAccepting(true);
    try {
      await RaceCollaborationService.acceptInvite(collaboratorId);
      // Invalidate queries to refresh the races list
      queryClient.invalidateQueries({ queryKey: ['races'] });
      queryClient.invalidateQueries({ queryKey: ['race-collaborators', race.id] });
    } catch (error) {
      console.error('Failed to accept invite:', error);
    } finally {
      setIsAccepting(false);
    }
  }, [collaboratorId, isAccepting, queryClient, race.id]);

  const handleDeclineInvite = useCallback(async () => {
    if (!collaboratorId || isDeclining) return;
    setIsDeclining(true);
    try {
      await RaceCollaborationService.declineInvite(collaboratorId);
      // Invalidate queries to refresh the races list
      queryClient.invalidateQueries({ queryKey: ['races'] });
      queryClient.invalidateQueries({ queryKey: ['race-collaborators', race.id] });
    } catch (error) {
      console.error('Failed to decline invite:', error);
    } finally {
      setIsDeclining(false);
    }
  }, [collaboratorId, isDeclining, queryClient, race.id]);

  // Handler to open detail sheet
  const _handleOpenDetail = useCallback((type: DetailCardType) => {
    setActiveDetailSheet(type);
  }, []);

  // Handler to close detail sheet
  const handleCloseDetailSheet = useCallback(() => {
    setActiveDetailSheet(null);
  }, []);

  // Handler to open module detail sheet (non-sailing interests)
  const handleModulePress = useCallback((moduleId: string) => {
    setActiveModuleId(moduleId);
  }, []);

  // Handler to close module detail sheet
  const handleCloseModuleSheet = useCallback(() => {
    setActiveModuleId(null);
  }, []);

  // Handler for scroll position tracking (shows edge gradients + toolbar hide/show)
  const handleContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onContentScroll?.(event);
  }, [onContentScroll]);

  // Handler to open detailed review modal
  const _handleOpenDetailedReview = useCallback(() => {
    setShowDetailedReview(true);
  }, []);

  // Handler to close detailed review modal
  const handleCloseDetailedReview = useCallback(() => {
    setShowDetailedReview(false);
  }, []);

  // Handler for detailed review completion
  const handleDetailedReviewComplete = useCallback(() => {
    setShowDetailedReview(false);
    // The modal handles saving internally, just close it
  }, []);

  // Update selected phase when current phase changes (e.g., race day arrives)
  React.useEffect(() => {
    setSelectedPhase(currentPhase);
  }, [currentPhase]);

  // Arrival plan section state
  const [_arrivalExpanded, setArrivalExpanded] = useState(false);
  const [arrivalNotes, setArrivalNotes] = useState('');

  // Hook for race preparation data (includes arrival intentions)
  // Only load when this card is the active/selected one to avoid 69+ parallel requests
  const { intentions, updateArrivalIntention, isSaving: _isSaving } = useRacePreparation({
    regattaId: race.id,
    autoSave: true,
    debounceMs: 1000,
    enabled: isActive,
  });

  // Hook for race analysis state (Tufte "absence as interface")
  const { state: _analysisState } = useRaceAnalysisState(race.id, race.date, userId, isActive);

  // Hook for race analysis data (actual content for display)
  const { analysisData } = useRaceAnalysisData(race.id, userId, isActive);

  // Get current arrival intention
  const arrivalIntention = intentions.arrivalTime;

  // Sync local notes with saved intention — fires only when server notes change;
  // local arrivalNotes is the diff target, not a trigger.
  React.useEffect(() => {
    if (arrivalIntention?.notes !== undefined && arrivalIntention.notes !== arrivalNotes) {
      setArrivalNotes(arrivalIntention.notes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivalIntention?.notes]);

  // Handle selecting an arrival time option
  const _handleSelectArrivalTime = useCallback((minutesBefore: number) => {
    const plannedArrival = calculateArrivalTime(race.date ?? '', race.startTime, minutesBefore);
    updateArrivalIntention({
      plannedArrival,
      minutesBefore,
      notes: arrivalNotes,
    });
  }, [race.date, race.startTime, arrivalNotes, updateArrivalIntention]);

  // Handle notes change (on blur)
  const _handleArrivalNotesBlur = useCallback(() => {
    if (arrivalIntention) {
      updateArrivalIntention({
        ...arrivalIntention,
        notes: arrivalNotes,
      });
    }
  }, [arrivalIntention, arrivalNotes, updateArrivalIntention]);

  // Toggle arrival section
  const _toggleArrivalSection = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArrivalExpanded(prev => !prev);
  }, []);

  // Detect race type from name or explicit setting
  const detectedRaceType = useMemo(() => {
    const explicit = race.race_type as 'fleet' | 'distance' | 'match' | 'team' | undefined;
    const distance = race.total_distance_nm;
    return detectRaceType(race.name, explicit, distance) as 'fleet' | 'distance' | 'match' | 'team';
  }, [race.name, race.race_type, race.total_distance_nm]);

  const _isDistanceRace = detectedRaceType === 'distance';

  // Get phase completion counts for tab labels (Tufte: data in the labels)
  const { counts: phaseCounts } = usePhaseCompletionCounts({
    regattaId: race.id,
    raceType: detectedRaceType,
    enabled: isActive,
  });

  // Get race type badge styling
  const raceTypeBadge = useMemo(
    () => getRaceTypeBadge(detectedRaceType),
    [detectedRaceType]
  );

  // Calculate countdown.
  // For non-sailing steps, prefer the timestamp in `race.date` (start_date)
  // instead of legacy `startTime`, which can be stale in mixed schemas.
  const effectiveCountdownStartTime = useMemo(() => {
    if (!isSailing && typeof race.date === 'string' && race.date.includes('T')) {
      return undefined;
    }
    return race.startTime;
  }, [isSailing, race.date, race.startTime]);

  const countdown = useMemo(
    () => calculateCountdown(race.date ?? '', effectiveCountdownStartTime),
    [race.date, effectiveCountdownStartTime]
  );
  const rawTimelineStatus = String(race?.status || race?.metadata?.status || '').toLowerCase();
  const isExplicitlyCompleted = rawTimelineStatus === 'completed' || rawTimelineStatus === 'done';
  const isTimelineStepOverdue = isTimelineStep && !isExplicitlyCompleted && !!race.due_at && new Date(race.due_at) < new Date();
  const isOverdue = !isExplicitlyCompleted && ((countdown.isPast && !isTimelineStep) || isTimelineStepOverdue);
  const isTimelineDone = isExplicitlyCompleted;
  const eventSubtype = String(race?.metadata?.event_subtype || '').toLowerCase();
  const isBlankActivitySubtype = eventSubtype === 'blank_activity';
  const isGroupLearningCycleSubtype = eventSubtype === 'group_learning_cycle';
  const normalizedStepDateTime = useMemo(
    () => buildNormalizedRaceDateTime(race.date, race.startTime),
    [race.date, race.startTime]
  );
  const effectiveRaceName = race.name;
  const displayRaceName = (() => {
    const raw = String(effectiveRaceName || 'Step').replace(/^Activity/i, 'Step');

    if (isBlankActivitySubtype) {
      const isGenerated = /^Step\s*[-—]\s*\d{4}-\d{2}-\d{2}$/i.test(raw);
      if (!isGenerated) return raw;
      if (!normalizedStepDateTime) return 'Step';
      return `Step — ${normalizedStepDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }

    // Legacy records for non-nursing interests may still carry "Group Cycle".
    // Normalize the generated title so domain language stays consistent.
    if (!isSailing && isGroupLearningCycleSubtype) {
      const isLegacyGenerated = /^Group\s*Cycle\s*[-—]\s*\d{4}-\d{2}-\d{2}$/i.test(raw);
      if (isLegacyGenerated) {
        if (!normalizedStepDateTime) return 'Team Step';
        return `Team Step — ${normalizedStepDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
    }

    return race.name;
  })();

  // For timeline steps that aren't done, never show gray "past" styling —
  // the step is still active regardless of its calendar date.
  const effectiveIsPast = isTimelineStep ? isExplicitlyCompleted : countdown.isPast;

  // Get urgency colors
  const _urgency = useMemo(
    () => getUrgencyColor(countdown.days, countdown.hours, effectiveIsPast),
    [countdown.days, countdown.hours, effectiveIsPast]
  );

  // Extract distance race fields
  const totalDistanceNm = race.total_distance_nm;
  const timeLimitHours = race.time_limit_hours || race.time_limit_hours;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routeWaypoints = race.route_waypoints || [];
  const _numberOfLegs = race.number_of_legs || routeWaypoints.length || 0;

  // Extract conditions data
  const windData = race.wind;
  const tideData = race.tide;
  const vhfChannel = race.vhf_channel;

  // Check if we have any conditions to show
  const _hasConditions = windData || tideData || vhfChannel;

  // Fetch weather forecast for sparklines
  // Check multiple possible venue data sources (full venue object or raw coordinates)
  const venueObj = race.venue_data || race.venue_info;
  const venueCoords = race.venueCoordinates; // From useEnrichedRaces
  // Construct synthetic venue if we have coordinates but no full venue object
  // Use global region to trigger the global fallback weather model (GFS Global)
  // which works for any location without requiring specific country matching
  const venue = venueObj || (venueCoords ? {
    id: `race-${race.id}`,
    name: race.venue || 'Race Location',
    coordinates: venueCoords, // { lat, lng } format works with resolveVenueLocation
    region: 'global', // Use global fallback model - works anywhere
  } : null);

  const { data: forecastData } = useRaceWeatherForecast(venue, race.date, isActive && !!venue);

  // Extract additional data for Tufte density
  const _fleetSize = race.fleet_size || race.entry_count || race.competitors?.length;
  const courseType = race.course_type || race.course?.type;
  const _courseDistance = race.course_distance_nm || race.total_distance_nm;
  const boatClassName = race.boatClass || race.boat_class || race.class_name;

  // Get rig tuning recommendations (only for upcoming races)
  // Only fetch rig tuning when we have wind data to base recommendations on
  const hasWindData = !!(windData?.speedMin || windData?.speedMax);
  const { settings: _rigSettings } = useRaceTuningRecommendation({
    className: boatClassName,
    windMin: windData?.speedMin,
    windMax: windData?.speedMax,
    limit: 2,
    enabled: isActive && !countdown.isPast && !!boatClassName && hasWindData,
  });

  // Get race series/day position
  const seasonId = race.season_id;
  const { data: _seriesPosition } = useRaceSeriesPosition({
    raceId: race.id,
    raceDate: race.date ?? '',
    seasonId,
    enabled: isActive,
  });

  // Get start order info (only for upcoming races)
  const regattaId = race.regatta_id;
  const fleetName = race.fleet_name || race.fleet;
  const { data: startOrderData } = useRaceStartOrder({
    raceId: race.id,
    fleetName,
    boatClass: boatClassName,
    raceDate: race.date ?? '',
    regattaId,
    enabled: isActive && !countdown.isPast,
  });

  const openCrewHub = useCallback((tab: CrewHubTab = 'roster') => {
    setCrewHubInitialTab(tab);
    setShowCrewHub(true);
  }, []);

  // "Add to Blueprint" sheet state
  const [showBlueprintSheet, setShowBlueprintSheet] = useState(false);
  const handleAddToBlueprint = useCallback(() => {
    setShowBlueprintSheet(true);
  }, []);

  // Handle adding a step collaborator from the card-level picker
  const handleAddStepCollaborator = useCallback((collaborator: StepCollaborator) => {
    const existing = stepCollaborators;
    if (existing.some((c) => c.id === collaborator.id)) return;
    if (collaborator.user_id && existing.some((c) => c.user_id === collaborator.user_id)) return;
    const updated = [...existing, collaborator];
    updateStepMetadata.mutate({
      plan: {
        ...(metadata?.plan ?? {}),
        collaborators: updated,
        who_collaborators: updated.map((c) => c.display_name),
      },
    });
    // Notify the collaborator
    if (collaborator.type === 'platform' && collaborator.user_id && userId) {
      const userName = (user as any)?.user_metadata?.full_name || (user as any)?.email || 'Someone';
      NotificationService.notifyStepCollaboratorAdded({
        targetUserId: collaborator.user_id,
        actorId: userId,
        actorName: userName,
        stepId: race.id,
        stepTitle: race.name || 'Untitled step',
      }).catch(() => {});
    }
  }, [stepCollaborators, metadata?.plan, updateStepMetadata, userId, user, race.id, race.name]);

  // Build menu items for card management - permission-aware
  const noun = isTimelineStep ? 'Step' : eventConfig.eventNoun;
  const teamNoun = eventConfig.teamNoun ?? 'Team';
  const normalizedInterestSlug = String(interestSlug || '').trim().toLowerCase();
  const isNursingInterest = normalizedInterestSlug === 'nursing';
  const templateSuggestedCompetencyTitles = useMemo(() => {
    if (!isNursingInterest) return [];
    const metadata = (race?.metadata || {}) as Record<string, unknown>;
    const suggestedIds = parseStringIdList(metadata.org_template_suggested_competency_ids);
    return suggestedIds.map((id) => NURSING_CAPABILITY_TITLE_BY_ID.get(id) || id);
  }, [isNursingInterest, race]);
  const visibleTemplateSuggestedTitles = templateSuggestedCompetencyTitles.slice(0, 3);
  const hiddenTemplateSuggestedCount = Math.max(templateSuggestedCompetencyTitles.length - visibleTemplateSuggestedTitles.length, 0);
  const menuItems = useMemo((): CardMenuItem[] => {
    const items: CardMenuItem[] = [];
    // Team/Crew Chat — only for races (timeline steps have comments inline on the card)
    if (!isTimelineStep && FEATURE_FLAGS.ENABLE_RACE_CREW_CHAT) {
      items.push({ label: `${teamNoun} Chat`, icon: 'chatbubbles-outline', onPress: () => setShowChat(true) });
    }
    // Explicit collaborator entry point — step collaborator picker for timeline steps, crew hub for races
    items.push({
      label: 'Add Collaborators',
      icon: 'people-outline',
      onPress: isTimelineStep ? () => setShowStepCollabPicker(true) : () => openCrewHub('roster'),
    });
    // Share is always available
    items.push({ label: `Share ${noun}`, icon: 'share-outline', onPress: handleShare });
    // Suggest to another user — available for all timeline steps
    if (isTimelineStep) {
      items.push({ label: 'Suggest to...', icon: 'paper-plane-outline', onPress: () => setShowSuggestSheet(true) });
    }
    // Add to Blueprint — only for owners with published blueprints
    if (isOwner && isTimelineStep && (userBlueprints ?? []).some((b) => b.is_published)) {
      items.push({ label: 'Add to Blueprint', icon: 'book-outline', onPress: handleAddToBlueprint });
    }
    // Detail (scrollable view) — for races only; timeline steps use /step/:id
    if (!isNursingInterest && !isTimelineStep) {
      items.push({ label: `${noun} Detail`, icon: 'flag-outline', onPress: () => router.push(`/race/${race.id}` as any) });
    }
    // Only show edit/delete for owners
    if (isOwner) {
      // Mark Done / Mark Not Done handled by the status toggle in the header
      // Due date
      if (onSetDueDate && isTimelineStep) {
        const currentDueAt = race.due_at;
        if (currentDueAt) {
          const dueLabel = new Date(currentDueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          items.push({
            label: `Due: ${dueLabel}`,
            icon: 'calendar-outline',
            onPress: () => setShowDueDatePicker(true),
          });
        } else {
          items.push({
            label: 'Set Due Date',
            icon: 'calendar-outline',
            onPress: () => setShowDueDatePicker(true),
          });
        }
      }
      // Visibility picker
      if (isTimelineStep) {
        const visLabel = currentVisibility === 'private' ? 'Private' : currentVisibility.charAt(0).toUpperCase() + currentVisibility.slice(1);
        items.push({
          label: `Visibility: ${visLabel}`,
          icon: currentVisibility === 'private' ? 'lock-closed-outline' : 'eye-outline',
          onPress: handleChangeVisibility,
        });
      }
      // Edit removed — every field is now inline-editable on the step cover.
      if (onDelete) {
        items.push({ label: `Delete ${noun}`, icon: 'trash-outline', onPress: onDelete, variant: 'destructive' });
      }
    }
    // For demo races, show dismiss option instead of edit/delete
    if (race.isDemo && onDismiss) {
      items.push({ label: 'Dismiss sample', icon: 'close-outline', onPress: onDismiss });
    }
    return items;
  }, [
    onDelete,
    race,
    onDismiss,
    isOwner,
    handleShare,
    router,
    noun,
    teamNoun,
    openCrewHub,
    isNursingInterest,
    onSetDueDate,
    isTimelineStep,
    currentVisibility,
    handleChangeVisibility,
    userBlueprints,
    handleAddToBlueprint,
  ]);

  // Long-press handler to show context menu
  const handleLongPress = useCallback(() => {
    if (!canManage || menuItems.length === 0) return;

    triggerHaptic('impactMedium');

    if (Platform.OS === 'ios') {
      const options = menuItems.map(item => item.label);
      options.push('Cancel');

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: menuItems.findIndex(item => item.variant === 'destructive'),
        },
        (buttonIndex) => {
          if (buttonIndex < menuItems.length) {
            menuItems[buttonIndex].onPress?.();
          }
        }
      );
    } else {
      // Android/Web: Use cross-platform alert
      showAlertWithButtons(
        'Race Options',
        undefined,
        [
          ...menuItems.map(item => ({
            text: item.label,
            onPress: item.onPress,
            style: item.variant === 'destructive' ? ('destructive' as const) : ('default' as const),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    }
  }, [canManage, menuItems]);

  const handleOverdueBadgePress = useCallback(() => {
    if (!isOverdue) return;
    const actions: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [];
    if (onMoveStepToCompletedMostRecent) {
      actions.push({ text: 'Mark Done', onPress: () => onMoveStepToCompletedMostRecent(race.id) });
    }
    if (onMoveStepToPlannedNext) {
      actions.push({ text: 'Mark Not Done', onPress: () => onMoveStepToPlannedNext(race.id) });
    }
    if (onOpenPostRaceInterview) {
      actions.push({ text: 'Reflect + AI', onPress: onOpenPostRaceInterview });
    }
    actions.push({ text: 'Cancel', style: 'cancel' });
    showAlertWithButtons(
      isTimelineStep ? 'Overdue Step' : 'Review Due',
      'What would you like to do?',
      actions,
    );
  }, [isOverdue, isTimelineStep, onMoveStepToCompletedMostRecent, onMoveStepToPlannedNext, onOpenPostRaceInterview, race.id]);

  // Render race type badge component
  const _RaceTypeBadgeIcon = raceTypeBadge.icon;

  // Phase tabs data for IOSSegmentedControl — labels are universal across
  // interests per docs/redesign/PRACTICE_TIMELINE_CANONICAL.md.
  // The per-interest vocabulary ("Race Prep / On the Water / Debrief" etc.)
  // is intentionally not applied here — canonical labels are Plan / Do / Reflect
  // universally so the tab control reads the same regardless of practice domain.
  // Tufte: completion counts inline for information density.
  // Falls back to eventConfig for non-timeline sailing races (legacy path).
  const TIMELINE_STEP_PHASE_LABELS: Record<RacePhase, string> = {
    days_before: 'Plan',
    on_water: 'Do',
    after_race: 'Reflect',
  };

  const phaseTabs = useMemo(() => {
    return RACE_PHASES.map((phase) => {
      const count = phaseCounts[phase];
      const countLabel = formatPhaseCompletionLabel(count.completed, count.total);
      const phaseLabel = isTimelineStep
        ? TIMELINE_STEP_PHASE_LABELS[phase]
        : (eventConfig.phaseLabels[phase]?.short ?? phase);
      return {
        value: phase,
        label: `${phaseLabel}${countLabel}`,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseCounts, eventConfig.phaseLabels, isTimelineStep]);

  // Phase 10 PR-2b — Discussion is a 4th tab on subscribed-blueprint steps.
  // State + show-gate are declared near the top of the component so the
  // peek's tap handler can reference setDiscussionTabActive.

  // Canonical Practice Timeline phase tabs: underline pattern with green-dot
  // "done" state. Done = phase has user-produced content (total > 0). Strips
  // the inline completion counts shown on the segmented-control variant — the
  // canonical lets the green dot do all the "phase has content" signaling.
  type LocalTabValue = RacePhase | 'discussion';
  const canonicalPhaseTabs = useMemo<PhaseTabItem<LocalTabValue>[]>(() => {
    const phaseItems: PhaseTabItem<LocalTabValue>[] = RACE_PHASES.map((phase) => {
      const count = phaseCounts[phase];
      const isSelected = !discussionTabActive && phase === selectedPhase;
      const hasContent = count.total > 0 || count.completed > 0;
      return {
        value: phase,
        label: TIMELINE_STEP_PHASE_LABELS[phase],
        state: isSelected ? 'active' : hasContent ? 'done' : 'empty',
      };
    });
    if (showDiscussionTab) {
      const hasNotes =
        discussionPeek != null && discussionPeek.noteCount > 0;
      phaseItems.push({
        value: 'discussion',
        label: 'Discussion',
        state: discussionTabActive ? 'active' : hasNotes ? 'done' : 'empty',
      });
    }
    return phaseItems;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseCounts, selectedPhase, discussionTabActive, showDiscussionTab, discussionPeek]);

  // Handle phase tab change with haptic feedback
  const handlePhaseChange = useCallback(
    (phase: LocalTabValue) => {
      if (phase === 'discussion') {
        triggerHaptic('selection');
        setDiscussionTabActive(true);
        return;
      }
      setDiscussionTabActive(false);
      return handlePhaseChangeLegacy(phase);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Original handler renamed so the new wrapper can keep the existing signature
  // for non-discussion phases.
  const handlePhaseChangeLegacy = useCallback((phase: RacePhase) => {
    // DEBUG: Log phase tab selection
    if (typeof window !== 'undefined' && (window as any).__PERIOD_DEBUG__?.enabled) {
      (window as any).__PERIOD_DEBUG__.log('RaceSummaryCard.phaseTab', eventConfig.phaseLabels[phase]?.short ?? phase, { phase, raceId: race.id });
    }
    setSelectedPhase(phase);
    // eventConfig.phaseLabels is read only inside the debug branch; not worth re-creating the callback when phaseLabels change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.id]);

  // Helper to render phase tabs.
  // Timeline steps render the canonical underline pattern (Plan / Do / Reflect,
  // green-dot done state) per Practice Timeline canonical 2026-05-15.
  // Legacy non-timeline races keep the iOS segmented control with inline
  // completion counts.
  const renderPhaseTabs = () => {
    if (isTimelineStep) {
      return (
        <PhaseTabsCanonical
          tabs={canonicalPhaseTabs}
          onSelect={handlePhaseChange}
          style={{ marginTop: 4, marginBottom: 8 }}
        />
      );
    }
    return (
      <IOSSegmentedControl
        segments={phaseTabs}
        selectedValue={selectedPhase}
        onValueChange={handlePhaseChangeLegacy}
        style={{ marginTop: 12, marginBottom: 12, maxWidth: 322 }}
      />
    );
  };

  // Canonical card-head state-label row — dot + uppercase text above the
  // title, communicating the temporal state of this step's practice cycle.
  // Three weights, same grammar: planned (blue) / in-progress (coral with
  // halo) / completed (gray). Per Practice Timeline canonical 2026-05-15:
  // "state in the head, not the chrome".
  const renderStateLabel = () => {
    if (!isTimelineStep) return null;
    let label: string;
    let color: string;
    let dotColor: string;
    let halo = false;
    if (stepStatus === 'in_progress') {
      label = 'Live · in progress';
      color = '#FF6B6B';
      dotColor = '#FF6B6B';
      halo = true;
    } else if (stepStatus === 'completed' || stepStatus === 'done') {
      label = 'Step complete · debrief open';
      color = IOS_COLORS.tertiaryLabel;
      dotColor = IOS_COLORS.gray2;
    } else {
      label = 'Current step';
      color = IOS_COLORS.blue;
      dotColor = IOS_COLORS.blue;
    }
    return (
      <View style={styles.stateLabelRow}>
        <View style={[styles.stateLabelDot, { backgroundColor: dotColor }, halo && styles.stateLabelDotHalo]} />
        <Text style={[styles.stateLabelText, { color }]}>{label}</Text>
      </View>
    );
  };

  // Phase intro banner — shared "you are here" strip rendered above the phase
  // content for every tab. Without it, past-race cards and future-race cards
  // felt like completely different screens (one showed LOG/DEBRIEF/REVIEW
  // sections, the other RACE PREP/EQUIPMENT/CREW/STRATEGY) with nothing to
  // anchor the user. This banner frames whatever sections follow, so the
  // overall card structure is consistent regardless of the race's lifecycle
  // position: tabs → phase intro → sections. Content still swaps by phase.
  const phaseIntro = useMemo(() => {
    const accent: Record<RacePhase, string> = {
      days_before: '#007AFF',
      on_water: '#34C759',
      after_race: '#AF52DE',
    };
    const icons: Record<RacePhase, keyof typeof Ionicons.glyphMap> = {
      days_before: 'calendar-outline',
      on_water: 'flag-outline',
      after_race: 'book-outline',
    };
    // Descriptions never lead with the phase label (the pill above already
    // shows it). Reading "REFLECT — Reflect — critique what happened…" felt
    // like a stutter; the description should just extend the label.
    const defaultDescriptions: Record<RacePhase, string> = {
      days_before: 'Prep, equipment, crew, and strategy before the start',
      on_water: 'Strategy brief and live start tools for race day',
      after_race: 'Log results, debrief, and capture learnings',
    };
    const timelineStepDescriptions: Record<RacePhase, string> = {
      days_before: "What's the plan for this step?",
      on_water: 'Ready to start? Capture what you do or observe.',
      after_race: 'How did it go? Notes appear here after you have done some of the work.',
    };
    const label = isTimelineStep
      ? TIMELINE_STEP_PHASE_LABELS[selectedPhase]
      : (eventConfig.phaseLabels[selectedPhase]?.full
          ?? eventConfig.phaseLabels[selectedPhase]?.short
          ?? selectedPhase);
    const description = isTimelineStep
      ? timelineStepDescriptions[selectedPhase]
      : defaultDescriptions[selectedPhase];
    return {
      label,
      description,
      accent: accent[selectedPhase],
      icon: icons[selectedPhase],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhase, isTimelineStep, eventConfig.phaseLabels]);

  const _renderPhaseIntro = () => (
    <View style={[styles.phaseIntro, { borderLeftColor: phaseIntro.accent }]}>
      <View style={[styles.phaseIntroIconWrap, { backgroundColor: phaseIntro.accent + '18' }]}>
        <Ionicons name={phaseIntro.icon} size={14} color={phaseIntro.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.phaseIntroLabel, { color: phaseIntro.accent }]}>
          {String(phaseIntro.label).toUpperCase()}
        </Text>
        <Text style={styles.phaseIntroDescription} numberOfLines={2}>
          {phaseIntro.description}
        </Text>
      </View>
    </View>
  );

  // Convert race data to CardRaceData format for phase content
  const cardRaceData = useMemo(() => {
    const data = {
      id: race.id,
      name: race.name,
      date: race.date,
      startTime: race.startTime,
      venue: race.venue,
      vhf_channel: vhfChannel,
      race_type: detectedRaceType,
      boatClass: boatClassName,
      wind: windData,
      tide: tideData,
      isDemo: race.isDemo, // Preserve isDemo flag for demo race handling
      metadata: race.metadata, // Preserve metadata for coordinates/venue info
      venueCoordinates: race.venueCoordinates, // Preserve coordinates for weather fetching
      created_by: race.created_by, // Preserve for edit/delete permissions
      time_limit_hours: timeLimitHours, // Distance race duration for Forecast Check wizard
      boat_id: race.boat_id, // Preserve for sail selection/equipment
      class_id: race.class_id, // Preserve for tuning recommendations
      // Distance racing fields for Weather Routing wizard
      route_waypoints: routeWaypoints, // Already extracted above
      total_distance_nm: totalDistanceNm,
    };

    return data;
    // routeWaypoints uses `||` fallback to an array literal which changes identity per render;
    // wrapping in a separate useMemo would be churn for a hot path, so we accept the dep warning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race, vhfChannel, detectedRaceType, boatClassName, windData, tideData, timeLimitHours, routeWaypoints, totalDistanceNm]);

  // Helper to render phase-specific content
  const renderPhaseContent = () => {
    // Coach nudge banner — shown across all step types
    const nudgeBanner = coachNudge ? <CoachNudgeBanner insight={coachNudge} onDismiss={dismissNudge} /> : null;

    // Phase 10 PR-4 — step-complete celebration. Highest priority: when a
    // subscribed-blueprint step is closed, replace the regular phase
    // content with the celebration moment. Tabs remain available for
    // review; the user can still navigate to Plan/Do/Reflect to see what
    // was captured.
    if (showCelebration && !discussionTabActive && blueprintChrome) {
      return (
        <StepCompleteCelebration
          stepNumber={blueprintChrome.stepNumber}
          totalSteps={blueprintChrome.totalSteps}
          stepTitle={race.name ?? 'This step'}
          sessionCount={celebrationData?.sessionCount ?? 0}
          fleet={
            celebrationData?.fleet ?? {
              ahead: 0,
              sameStep: 0,
              behind: 0,
            }
          }
          next={
            celebrationData?.next
              ? {
                  stepNumber: celebrationData.next.stepNumber,
                  title: celebrationData.next.title,
                }
              : null
          }
          isLoadingNext={celebrationLoading || !celebrationSourceStepId}
          onContinue={continueNext.handleContinue}
          isContinuing={continueNext.isContinuing}
        />
      );
    }

    // Phase 10 PR-2b — Discussion tab takes precedence over the temporal
    // Plan/Do/Reflect phases when active. Renders the focused inline thread
    // view inside the same outer ScrollView.
    if (discussionTabActive && isTimelineStep && showDiscussionTab) {
      return <StepDiscussionInline stepId={race.id} />;
    }

    // Demo timeline steps: show phase-specific read-only content
    if (race.isDemo && isTimelineStep) {
      const plan = metadata?.plan as any;
      const demoMeta = metadata as any;

      // Clinical tab (on_water)
      if (selectedPhase === 'on_water') {
        const notes = demoMeta?.clinical_notes;
        if (!notes) {
          return (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Ionicons name="document-text-outline" size={32} color="#D1D5DB" />
              <Text style={{ fontSize: 15, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
                Clinical notes will appear here during and after your session.
              </Text>
            </View>
          );
        }
        return (
          <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
            <PlanQuestionCard icon="document-text-outline" title="Clinical Notes" isComplete>
              <Text style={{ fontSize: 15, lineHeight: 22, color: '#374151', letterSpacing: -0.2 }}>
                {notes}
              </Text>
            </PlanQuestionCard>
          </View>
        );
      }

      // Debrief tab (after_race)
      if (selectedPhase === 'after_race') {
        const reflection = demoMeta?.debrief_reflection;
        if (!reflection) {
          return (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color="#D1D5DB" />
              <Text style={{ fontSize: 15, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
                Reflect on what went well and what to improve next time.
              </Text>
            </View>
          );
        }
        return (
          <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
            <PlanQuestionCard icon="chatbubble-ellipses-outline" title="Reflection" isComplete>
              <Text style={{ fontSize: 15, lineHeight: 22, color: '#374151', letterSpacing: -0.2 }}>
                {reflection}
              </Text>
            </PlanQuestionCard>
          </View>
        );
      }

      // Prep tab (days_before) — full plan questions
      const whatText = plan?.what_will_you_do || '';
      const subSteps = plan?.how_sub_steps || [];
      const whyText = plan?.why_reasoning || '';
      const whereText = plan?.where_location?.name || '';
      const goals = plan?.capability_goals || [];
      // Serif body for prose values per audit §1.6 + mockup 06 (serif 16-17px primary).
      const proseStyle = { ...text.serifBody, fontSize: 16, lineHeight: 24, color: STEP_PALETTE.textPrimary };
      return (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          {nudgeBanner}
          {/* What */}
          <PlanQuestionCard icon="bulb-outline" title="what" isComplete={!!whatText}>
            <Text style={proseStyle}>
              {whatText}
            </Text>
          </PlanQuestionCard>

          {/* How — sub-steps */}
          {subSteps.length > 0 && (
            <PlanQuestionCard icon="list-outline" title="how" isComplete={subSteps.some((s: any) => s.completed)}>
              {subSteps.map((s: any) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <Ionicons
                    name={s.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={s.completed ? IOS_COLORS.green : '#9CA3AF'}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={{ ...proseStyle, fontSize: 15, color: s.completed ? STEP_PALETTE.textTertiary : STEP_PALETTE.textPrimary, flex: 1, textDecorationLine: s.completed ? 'line-through' : 'none' }}>
                    {s.text}
                  </Text>
                </View>
              ))}
            </PlanQuestionCard>
          )}

          {/* Why */}
          {!!whyText && (
            <PlanQuestionCard icon="help-circle-outline" title="why" isComplete>
              <Text style={proseStyle}>
                {whyText}
              </Text>
            </PlanQuestionCard>
          )}

          {/* Where */}
          {!!whereText && (
            <PlanQuestionCard icon="location-outline" title="where" isComplete>
              <Text style={proseStyle}>
                {whereText}
              </Text>
            </PlanQuestionCard>
          )}

          {/* Capability goals */}
          {goals.length > 0 && (
            <PlanQuestionCard icon="trophy-outline" title="building toward" isComplete>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {goals.map((g: string) => (
                  <View key={g} style={{ backgroundColor: STEP_PALETTE.bgInfo, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 13, color: STEP_PALETTE.textInfo, fontWeight: '500' }}>{g}</Text>
                  </View>
                ))}
              </View>
            </PlanQuestionCard>
          )}
        </View>
      );
    }

    // Timeline steps get dedicated step content per phase (all interests)
    if (isTimelineStep) {
      if (selectedPhase === 'days_before') {
        // AI review overlay — shown after "Structure with AI"
        if (showAiReview && aiReviewPlan) {
          return (
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
          );
        }
        // Unified view — plan questions always shown, brain dump collapsible at top
        return (
          <>
            {nudgeBanner}
            {showSinceLastVisit && sinceVisitEvents ? (
              <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
                <SinceLastVisitStrip
                  events={sinceVisitEvents}
                  onTapEvent={() => setDiscussionTabActive(true)}
                />
              </View>
            ) : null}
            <StepPlanQuestions
              stepId={race.id}
              interestId={race.interest_id ?? currentInterest?.id}
              readOnly={!isOwner}
              brainDumpData={brainDumpData}
              onBrainDumpChange={handleDraftChange}
              onStructureWithAI={handleStructureWithAI}
              isStructuring={aiStructuring}
              interestSlug={currentInterest?.slug}
              useConversationalCapture={isOwner}
              onConversationalCreate={isOwner ? handleConversationalCreate : undefined}
              onNextTab={isOwner ? () => setSelectedPhase('on_water') : undefined}
            />
          </>
        );
      }
      if (selectedPhase === 'on_water') {
        // Behind PRACTICE_DO_TAB_IOS_REGISTER the inline race-card Do
        // surface swaps to the same DoTabInterior + sheet + modal shell
        // ActTab mounts (see components/step/do-tab/DoTabIOSRegisterShell).
        // Flag off keeps the existing nudge + conditions + focus concepts
        // + StepDrawContent stack byte-identical.
        if (FEATURE_FLAGS.PRACTICE_DO_TAB_IOS_REGISTER) {
          return (
            <DoTabIOSRegisterShell
              stepId={race.id}
              readOnly={!isOwner}
              interestId={race.interest_id ?? currentInterest?.id}
              interestName={currentInterest?.name}
              interestSlug={currentInterest?.slug}
              onMoveToReflect={() => setSelectedPhase('after_race')}
            />
          );
        }
        const activeEnrichment = dateEnrichment ?? metadata?.plan?.date_enrichment;
        return (
          <>
            {nudgeBanner}
            {activeEnrichment && (activeEnrichment.wind || activeEnrichment.tide) && (
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <DateEnrichmentCard
                  dateLabel="today's session"
                  dateIso=""
                  enrichment={activeEnrichment}
                />
              </View>
            )}
            <StepFocusConcepts stepId={race.id} />
            <StepDrawContent stepId={race.id} readOnly={!isOwner} interestId={race.interest_id ?? currentInterest?.id} interestName={currentInterest?.name} interestSlug={currentInterest?.slug} />
          </>
        );
      }
      if (selectedPhase === 'after_race') {
        // Behind PRACTICE_STEP_LOOP_IOS_REGISTER the inline race-card
        // Reflect surface swaps to the same Phase 4 shell ReviewTab
        // mounts (see components/step/reflect-tab/ReflectTabIOSRegisterShell).
        // Flag off keeps the existing nudge + focus + StepCritiqueContent
        // stack byte-identical.
        if (FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER) {
          return (
            <ReflectTabIOSRegisterShell
              stepId={race.id}
              readOnly={!isOwner}
              onNextStepCreated={onNextStepCreated}
            />
          );
        }
        return (
          <>
            {nudgeBanner}
            <StepFocusConcepts stepId={race.id} variant="review" />
            <StepCritiqueContent stepId={race.id} onNextStepCreated={onNextStepCreated} readOnly={!isOwner} />
          </>
        );
      }
    }

    // Non-sailing interests use config-driven rendering;
    // blank_activity events also use config-driven rendering even for sailing
    const isBlankActivity = race?.metadata?.event_subtype === 'blank_activity';
    if (!isSailing || isBlankActivity) {
      // Non-timeline or inactive cards use config-driven rendering
      return (
        <ConfigDrivenPhaseContent
          phase={selectedPhase}
          config={eventConfig}
          race={cardRaceData}
          onModulePress={handleModulePress}
          moduleContent={moduleContent}
        />
      );
    }

    // Sailing retains rich hardcoded phase content
    switch (selectedPhase) {
      case 'days_before':
        return (
          <DaysBeforeContent
            race={cardRaceData}
          />
        );
      case 'on_water':
        return (
          <OnWaterContent
            race={cardRaceData}
            forecastData={forecastData}
            startOrderData={startOrderData}
          />
        );
      case 'after_race':
        return (
          <AfterRaceContent
            race={cardRaceData}
            userId={userId}
            onOpenPostRaceInterview={onOpenPostRaceInterview}
            refetchTrigger={refetchTrigger}
          />
        );
      default:
        return null;
    }
  };

  // Build race data for detail cards
  const raceDataForDetailCards = useMemo(() => {
    const data = {
      id: race.id,
      name: race.name,
      wind: windData,
      tide: tideData,
      courseName: race.course_name,
      courseType: courseType,
      vhfChannel: vhfChannel,
      fleetName: fleetName,
      race_type: detectedRaceType,
      total_distance_nm: totalDistanceNm,
      time_limit_hours: timeLimitHours,
      route_waypoints: routeWaypoints,
      venue: venue,
      date: race.date,
      // For Tufte race-window display - combines date + time into ISO string
      // race.date may be ISO timestamp "2025-12-13T00:00:00+00:00" or date string "2025-12-13"
      // race.startTime may be "08:25:00", "08:25", or "10:00 AM"
      start_time: (() => {
        if (!race.startTime || !race.date) return null;
        // Extract just the date part (YYYY-MM-DD) from race.date
        const dateStr = race.date.split('T')[0];
        // Normalize time to HH:mm:ss format
        let timeStr = race.startTime;
        // Handle "10:00 AM" format
        if (timeStr.includes('AM') || timeStr.includes('PM')) {
          const [time, period] = timeStr.split(' ');
          const [hours, mins] = time.split(':').map(Number);
          const h24 = period === 'PM' && hours !== 12 ? hours + 12 : (period === 'AM' && hours === 12 ? 0 : hours);
          timeStr = `${h24.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
        } else if (timeStr.split(':').length === 2) {
          timeStr = `${timeStr}:00`;
        }
        return `${dateStr}T${timeStr}`;
      })(),
    };

    return data;
    // race.course_name not in deps because it's bundled into `race.id`-keyed identity for this surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    race.id, race.name, race.date, race.startTime, windData, tideData, courseType,
    vhfChannel, fleetName, detectedRaceType, totalDistanceNm,
    timeLimitHours, routeWaypoints, venue,
  ]);

  // ==========================================================================
  // RENDER - Single full-height view with scrollable content
  // ==========================================================================

  // Build full countdown text (e.g., "3d 2h until race")
  const _fullCountdownText = useMemo(() => {
    return formatCountdownFull(countdown);
  }, [countdown]);

  // Build compact countdown text (e.g., "18h" or "2d") - for badges if needed
  const _compactCountdown = useMemo(() => {
    if (countdown.isPast) return null;
    if (countdown.days > 0) return `${countdown.days}d`;
    if (countdown.hours > 0) return `${countdown.hours}h`;
    return `${countdown.minutes}m`;
  }, [countdown]);

  // Get urgency color for countdown display
  const urgencyColor = useMemo(() => {
    return getUrgencyColor(countdown.days, countdown.hours, effectiveIsPast);
  }, [countdown.days, countdown.hours, effectiveIsPast]);

  // Build season context text (e.g., "W26 · Race 2/10")
  const _seasonContextText = useMemo(() => {
    const parts: string[] = [];
    if (seasonWeek) parts.push(seasonWeek);
    if (raceNumber && totalRaces) parts.push(`Race ${raceNumber}/${totalRaces}`);
    else if (raceNumber) parts.push(`Race ${raceNumber}`);
    return parts.join(' · ');
  }, [seasonWeek, raceNumber, totalRaces]);

  // Build venue + datetime subtitle (e.g., "Victoria Harbour · Sat, Jan 25 10:30 AM")
  const _raceSubtitle = useMemo(() => {
    const parts: string[] = [];

    // Get venue name from various possible sources, avoiding raw coordinates
    const venueInfo = race.venue_info || race.venue_data;
    const racingAreaName = race.racing_area_name;
    const rawVenue = race.venue;

    // Check if rawVenue looks like coordinates (e.g., "22.3361, 114.2911")
    const isCoordinates = rawVenue && /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(rawVenue.trim());

    // Priority: venue_info.name > racing_area_name > venue (if not coordinates)
    const venueName = venueInfo?.name || racingAreaName || (!isCoordinates ? rawVenue : null);

    if (venueName) parts.push(venueName);

    const normalized = buildNormalizedRaceDateTime(race.date, race.startTime);
    const dateStr = normalized
      ? normalized.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'Date TBD';
    const timeStr = normalized
      ? normalized.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : formatTime(race.startTime);
    parts.push(`${dateStr} ${timeStr}`);
    return parts.join(' · ');
    // race.venue_data is read as a fallback inside but doesn't need to re-trigger the memo on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.venue, race.date, race.startTime, race.venue_info, race.racing_area_name]);

  const nonSailingTypeLabel = useMemo(() => {
    if (isBlankActivitySubtype) return 'Step';
    // Check event_subtype in metadata, then category on the step record
    const subtypeId = race?.metadata?.event_subtype || race?.category;
    const subtypeMatch = subtypeId
      ? eventConfig.eventSubtypes.find((s) => s.id === subtypeId)
      : undefined;
    return (
      subtypeMatch?.label
      ?? eventConfig.eventNoun
    );
  }, [eventConfig.eventNoun, eventConfig.eventSubtypes, isBlankActivitySubtype, race]);

  // Get active phase for inline progress bar
  const _activePhase = useMemo(() => {
    return getActivePhaseForProgress(phaseCounts, effectiveIsPast);
  }, [phaseCounts, effectiveIsPast]);

  // Collaborator-only view: the current user is listed as a collaborator but
  // not the creator. Used to surface a "Shared with me" chip so the read-only
  // affordances (no status toggle, no edit menu) are self-explanatory.
  const isSharedWithMe = Boolean(
    isTimelineStep &&
      userId &&
      race.created_by &&
      race.created_by !== userId &&
      Array.isArray(race.collaborator_user_ids) &&
      (race.collaborator_user_ids as string[]).includes(userId),
  );

  return (
    <>
        <Pressable onPress={onCardPress || (() => {})} onLongPress={handleLongPress} delayLongPress={500} style={{ flex: 1, opacity: 1 }} disabled={isActive}>
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            nestedScrollEnabled={Platform.OS === 'android'}
            onScroll={handleContentScroll}
            scrollEventThrottle={16}
          >
            {/* Phase 10 PR-3 — Blueprint chrome (trophy / From / WITH-row).
                Renders only for steps adopted from a subscribed blueprint. */}
            {showBlueprintChrome && blueprintChrome ? (
              <StepBlueprintChrome
                blueprintShortName={blueprintChrome.blueprintShortName}
                positionLine={
                  blueprintChrome.stepNumber != null
                    ? `Step ${blueprintChrome.stepNumber} of ${blueprintChrome.totalSteps}`
                    : `${blueprintChrome.totalSteps} steps`
                }
                blueprintTitle={blueprintChrome.blueprintTitle}
                authorName={blueprintChrome.authorName}
                fleetCount={blueprintChrome.subscriberCount}
                onTapBlueprintStrip={goBlueprintIndex}
                onTapFleetChip={goFleetView}
              />
            ) : null}
            {showDiscussionPeek && discussionPeek ? (
              <StepDiscussionPeek
                noteCount={discussionPeek.noteCount}
                latestSnippet={discussionPeek.latest.body}
                latestAuthorName={discussionPeek.latest.authorName}
                onPress={goDiscussion}
              />
            ) : null}
            {/* Simplified Header: Race type badge + Countdown */}
            <View style={styles.simpleHeaderWrapper}>
            {/* NOW bookmark is now rendered by CardGrid on the card edge */}
            <View style={styles.simpleHeaderRow}>
          {/* Header chip group — all meta chips live on a single row under the
              header so status + category + provenance + flags share one visual
              line. Tightly grouped on the left; countdown stays on the right
              via the parent's space-between layout. Order:
                [Status | Overdue] [Category] [Shared] [Provenance] [Pinned]
              "UP NEXT" is no longer rendered here — the NOW divider between
              Done and Planned cards in the carousel already carries that signal.
          */}
          <View style={styles.headerChipGroup}>
            {/* Primary status chip
                - Timeline steps: always show Planned/Done (interactive when
                  ownable, read-only otherwise). Overdue takes precedence.
                - Regattas: show race-type / Review-Due / Done-with-position.
            */}
            {isTimelineStep ? (
              isOverdue && !isTimelineDone ? (
                <Pressable style={styles.overdueBadge} onPress={handleOverdueBadgePress}>
                  <Ionicons name="warning" size={13} color="#B45309" />
                  {!isBlankActivitySubtype && (
                    <Text style={styles.overdueBadgeText}>Overdue</Text>
                  )}
                </Pressable>
              ) : canManage && (onMoveStepToCompletedMostRecent || onMoveStepToPlannedNext) ? (
                <Pressable
                  onPress={() => {
                    triggerHaptic('impactLight');
                    if (isTimelineDone && onMoveStepToPlannedNext) {
                      onMoveStepToPlannedNext(race.id);
                    } else if (!isTimelineDone && onMoveStepToCompletedMostRecent) {
                      onMoveStepToCompletedMostRecent(race.id);
                    }
                  }}
                  style={[styles.statusToggle, isTimelineDone && styles.statusToggleDone]}
                  accessibilityLabel={isTimelineDone ? 'Mark as planned' : 'Mark as done'}
                  accessibilityRole="checkbox"
                >
                  <Ionicons
                    name={isTimelineDone ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={isTimelineDone ? STEP_PALETTE.textPrimary : STEP_PALETTE.textTertiary}
                  />
                  <Text style={[styles.statusToggleText, isTimelineDone && styles.statusToggleTextDone]}>
                    {isTimelineDone ? 'Done' : 'Planned'}
                  </Text>
                </Pressable>
              ) : (
                // Read-only status when user can't manage (e.g., collaborator view).
                // Same shape as the interactive toggle so owned / shared steps
                // read consistently.
                <View style={[styles.statusToggle, isTimelineDone && styles.statusToggleDone]}>
                  <Ionicons
                    name={isTimelineDone ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={isTimelineDone ? STEP_PALETTE.textPrimary : STEP_PALETTE.textTertiary}
                  />
                  <Text style={[styles.statusToggleText, isTimelineDone && styles.statusToggleTextDone]}>
                    {isTimelineDone ? 'Done' : 'Planned'}
                  </Text>
                </View>
              )
            ) : isTimelineDone ? (
              <View style={styles.pastRaceBadge}>
                <Ionicons name="checkmark-circle" size={14} color={IOS_COLORS.green} />
                <Text style={styles.pastBadgeText}>
                  {analysisData?.selfReportedPosition
                    ? `${analysisData.selfReportedPosition}${getOrdinalSuffix(analysisData.selfReportedPosition)}`
                    : 'DONE'}
                </Text>
              </View>
            ) : isOverdue ? (
              <Pressable style={styles.overdueBadge} onPress={handleOverdueBadgePress}>
                <Ionicons name="warning" size={13} color="#B45309" />
                {!isBlankActivitySubtype && (
                  <Text style={styles.overdueBadgeText}>Review Due</Text>
                )}
              </Pressable>
            ) : (
              <View style={styles.raceTypeBadge}>
                <Text style={[styles.raceTypeBadgeText, !isSailing && styles.raceTypeBadgeTextSubtle]}>
                  {isSailing
                    ? (detectedRaceType?.toUpperCase() || 'FLEET')
                    : nonSailingTypeLabel}
                </Text>
              </View>
            )}

            {/* Secondary category chip — non-sailing timeline steps only.
                Renders alongside status so the orthogonal facts (is-it-done
                vs what-kind-of-step) are both visible. Skipped for generic
                "Step" / blank-subtype cases. */}
            {isTimelineStep && !isSailing && nonSailingTypeLabel && nonSailingTypeLabel !== 'Step' && (
              <View style={styles.raceTypeBadge}>
                <Text style={[styles.raceTypeBadgeText, styles.raceTypeBadgeTextSubtle]}>
                  {nonSailingTypeLabel}
                </Text>
              </View>
            )}

            {/* Shared-with-me chip — explains why the card is read-only for
                collaborators who don't own the step. */}
            {isSharedWithMe && (
              <View style={styles.sharedChip}>
                <Ionicons name="people-outline" size={11} color={IOS_COLORS.secondaryLabel} />
                <Text style={styles.sharedChipText}>SHARED</Text>
              </View>
            )}

            {/* Provenance chip (Copied / From {blueprint}) — moved inline from
                its own row so all meta chips share a single line. */}
            {isTimelineStep && race.source_type && race.source_type !== 'manual' && (
              <StepProvenanceBanner
                sourceBlueprintId={race.source_blueprint_id}
                sourceType={race.source_type as TimelineStepSourceType}
                copiedFromUserId={race.copied_from_user_id}
                variant="compact"
              />
            )}

            {/* Pinned from another interest indicator */}
            {race.isPinned && (
              <View style={styles.pinnedBadge}>
                <Ionicons name="pin" size={11} color={IOS_COLORS.secondaryLabel} />
                <Text style={styles.pinnedBadgeText}>PINNED</Text>
              </View>
            )}
          </View>
        <View style={styles.simpleHeaderRight}>
            {/* Countdown: past = gray relative time; today = bold TODAY; future = large number */}
            {(isSailing || isTimelineDone) && !!race.date && (
            <View style={styles.countdownSimple}>
              {isTimelineDone ? (
                <Text style={styles.pastTimeLabel}>
                  {countdown.daysSince === 0
                    ? 'Today'
                    : countdown.daysSince === 1
                      ? 'Yesterday'
                      : countdown.daysSince <= 30
                        ? `${countdown.daysSince}d ago`
                        : 'Completed'}
                </Text>
              ) : countdown.isToday ? (
                <Text style={[styles.countdownTodayLabel, { color: urgencyColor.text }]}>
                  TODAY
                </Text>
              ) : countdown.isPast ? (
                // Past regatta that isn't explicitly completed — show "N days ago"
                // so the direction is unambiguous (previously rendered as bare
                // "5 days" which read identically to "5 days until").
                <Text style={styles.pastTimeLabel}>
                  {countdown.daysSince <= 30
                    ? `${countdown.daysSince}d ago`
                    : 'Past'}
                </Text>
              ) : (
                <>
                  <Text style={[styles.countdownNumberSimple, { color: urgencyColor.text }]}>
                    {countdown.days}
                  </Text>
                  <Text style={[styles.countdownLabelSimple, { color: urgencyColor.text }]}>
                    {countdown.days === 1 ? 'day' : 'days'}
                  </Text>
                </>
              )}
            </View>
            )}
            {/* Mark Done button replaced by status toggle in the left badge area */}
            {/* Three-dot menu (includes Share Race, Crew Chat) */}
            {menuItems.length > 0 && (
              <CardMenu items={menuItems} iconSize={20} iconColor={IOS_COLORS.gray} />
            )}
          </View>
        </View>
        </View>

        {race.isDemo && isGuest ? (
          <View style={styles.sampleGuestBanner}>
            <View style={styles.sampleGuestIcon}>
              <Ionicons name="sparkles-outline" size={15} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sampleGuestTitle}>This is a sample</Text>
              <Text style={styles.sampleGuestSubtitle}>
                Explore to see how it works, then create your own.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                const interestParam = currentInterest?.slug ? `?interest=${currentInterest.slug}` : '';
                router.push(`/(auth)/signup${interestParam}` as any);
              }}
              style={({ pressed }) => [styles.sampleGuestCta, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Sign up free"
            >
              <Text style={styles.sampleGuestCtaText}>Sign up free</Text>
            </Pressable>
          </View>
        ) : race.isDemo ? (
          <View style={styles.sampleBadge}>
            <Text style={styles.sampleBadgeText}>SAMPLE DATA</Text>
          </View>
        ) : null}

        {/* Canonical state-label — dot + uppercase text above the title.
            Surface decides weight; chrome stays still. */}
        {renderStateLabel()}

        {/* Full race/step name — always editable TextInput for timeline steps */}
        {isTimelineStep ? (
          <>
            <TextInput
              ref={titleInputRef}
              style={[styles.raceNameLarge, styles.raceNameInput]}
              value={editTitle}
              onChangeText={setEditTitle}
              onBlur={handleTitleSubmit}
              onSubmitEditing={handleTitleSubmit}
              returnKeyType="done"
              selectTextOnFocus
            />
            {hasPlaceholderTitle && editTitle === 'Untitled' ? (
              <Pressable
                onPress={() => titleInputRef.current?.focus()}
                hitSlop={6}
                style={styles.untitledHintPressable}
              >
                <Text style={styles.untitledHintText}>
                  ✎ Tap to name this step
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text
            style={styles.raceNameLarge}
            numberOfLines={2}
            ellipsizeMode="tail"
          >{displayRaceName || '[No Step Name]'}</Text>
        )}
        {/* Compact progress bar for sub-steps */}
        {isTimelineStep && subStepProgress && !isTimelineDone && (
          <View style={styles.detailProgressRow}>
            <View style={styles.detailProgressBar}>
              <View style={[styles.detailProgressFill, { width: `${(subStepProgress.completed / subStepProgress.total) * 100}%` as any }]} />
            </View>
            <Text style={styles.detailProgressLabel}>
              {subStepProgress.completed}/{subStepProgress.total} steps
            </Text>
          </View>
        )}

        {/* Due date chip on card */}
        {isTimelineStep && (race.due_at || onSetDueDate) && (() => {
          const dueAt = race.due_at as string | null;
          const isDueOverdue = Boolean(dueAt && stepStatus !== 'completed' && new Date(dueAt) < new Date());
          if (dueAt) {
            const dueDate = new Date(dueAt);
            const dueLabel = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const h = dueDate.getHours();
            const m = dueDate.getMinutes();
            const hasTime = !(h === 0 && m === 0) && !(h === 23 && m === 59);
            const timeLabel = hasTime
              ? ` ${(h % 12 || 12)}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
              : '';
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                <Pressable
                  onPress={onSetDueDate ? () => setShowDueDatePicker(true) : undefined}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
                    backgroundColor: isDueOverdue ? 'rgba(255,59,48,0.08)' : '#f5f5f5',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: isDueOverdue ? 'rgba(255,59,48,0.2)' : '#e0e0e0',
                  }}
                >
                  <Ionicons
                    name={isDueOverdue ? 'alert-circle' : 'calendar-outline'}
                    size={13}
                    color={isDueOverdue ? '#FF3B30' : '#8E8E93'}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '500', color: isDueOverdue ? '#FF3B30' : '#8E8E93' }}>
                    {isDueOverdue ? 'Overdue · ' : 'Due '}{dueLabel}{timeLabel}
                  </Text>
                </Pressable>
                {onSetDueDate && (
                  <Pressable onPress={() => onSetDueDate(race.id, null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={14} color="#C7C7CC" />
                  </Pressable>
                )}
              </View>
            );
          }
          return null;
        })()}
        {isNursingInterest && visibleTemplateSuggestedTitles.length > 0 ? (
          <View style={styles.templateSuggestedRow}>
            <Text style={styles.templateSuggestedLabel}>Suggested:</Text>
            {visibleTemplateSuggestedTitles.map((title) => (
              <View key={title} style={styles.templateSuggestedChip}>
                <Text style={styles.templateSuggestedChipText} numberOfLines={1}>{title}</Text>
              </View>
            ))}
            {hiddenTemplateSuggestedCount > 0 ? (
              <View style={styles.templateSuggestedChip}>
                <Text style={styles.templateSuggestedChipText}>+{hiddenTemplateSuggestedCount}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {interestSlug === 'nursing' && (advancedCompetencyCount > 0 || hasValidatedCompetency) ? (
          <View style={styles.nursingStatusRow}>
            {advancedCompetencyCount > 0 ? (
              <View style={styles.advancedBadge}>
                <Text style={styles.advancedBadgeText}>Advanced {advancedCompetencyCount}</Text>
              </View>
            ) : null}
            {hasValidatedCompetency ? (
              <View style={styles.validatedBadge}>
                <Text style={styles.validatedBadgeText}>Validated</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Location — hide for timeline steps with no venue; show "Venue TBD" only for sailing races */}
        {(venue?.name || race.venue) ? (
          <View style={styles.simpleDetailRow}>
            <Ionicons name="location-outline" size={16} color={IOS_COLORS.secondaryLabel} />
            <Text style={styles.simpleDetailText}>{venue?.name || race.venue}</Text>
          </View>
        ) : !isTimelineStep ? (
          <View style={styles.simpleDetailRow}>
            <Ionicons name="location-outline" size={16} color={IOS_COLORS.secondaryLabel} />
            <Text style={styles.simpleDetailText}>Venue TBD</Text>
          </View>
        ) : null}

        {/* Date/time — hide for timeline steps (they use created_at, not a scheduled date) */}
        {!isTimelineStep && (
          <View style={styles.simpleDetailRow}>
            <Ionicons name="calendar-outline" size={16} color={IOS_COLORS.secondaryLabel} />
            <Text style={styles.simpleDetailText}>{formatFullDate(race.date ?? '', race.startTime)}</Text>
          </View>
        )}

        {/* Collaborator avatar row — step collaborators for timeline steps, race crew for races */}
        {isTimelineStep && stepCollaborators.length > 0 && (
          <Pressable
            style={styles.stepCollabRow}
            onPress={() => setShowStepCollabPicker(true)}
          >
            <View style={styles.stepCollabAvatars}>
              {stepCollaborators.slice(0, 4).map((c) => (
                <View key={c.id} style={styles.stepCollabAvatar}>
                  {c.avatar_emoji ? (
                    <Text style={styles.stepCollabAvatarEmoji}>{c.avatar_emoji}</Text>
                  ) : (
                    <Text style={styles.stepCollabAvatarInitial}>
                      {(c.display_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              ))}
              {stepCollaborators.length > 4 && (
                <View style={[styles.stepCollabAvatar, styles.stepCollabOverflow]}>
                  <Text style={styles.stepCollabOverflowText}>+{stepCollaborators.length - 4}</Text>
                </View>
              )}
            </View>
            <Text style={styles.stepCollabLabel}>
              {stepCollaborators.length} collaborator{stepCollaborators.length !== 1 ? 's' : ''}
            </Text>
          </Pressable>
        )}
        {!isTimelineStep && FEATURE_FLAGS.ENABLE_CREW_AVATARS_HEADER && collaborators.length > 0 && (
          <View style={styles.crewAvatarRow}>
            <CrewAvatarStack
              collaborators={collaborators}
              maxVisible={5}
              size="xs"
              onPress={() => setShowCollabPopover(true)}
              showPendingBadge
            />
          </View>
        )}

        {/* Pill-style Phase Tabs (Prep/Race/Review) */}
        {renderPhaseTabs()}

        {/* Collaboration indicators (keep these as they provide important context) */}
        {!isOwner && isCollaborator && (
          <View style={styles.sharedBadge}>
            <Users size={12} color={IOS_COLORS.blue} />
            <Text style={styles.sharedBadgeText}>Shared</Text>
          </View>
        )}

        {/* Pending Invite Badge with Accept/Decline actions (important for interaction) */}
        {!isOwner && isPendingInvite && (
          <View style={styles.inviteBadgeContainer}>
            <View style={styles.inviteBadge}>
              <Clock size={12} color={IOS_COLORS.orange} />
              <Text style={styles.inviteBadgeText}>Crew Invite</Text>
            </View>
            <View style={styles.inviteActions}>
              <Pressable
                style={[styles.inviteAcceptButton, isAccepting && styles.inviteButtonDisabled]}
                onPress={handleAcceptInvite}
                disabled={isAccepting || isDeclining}
              >
                <CheckCircle size={14} color={IOS_COLORS.green} />
                <Text style={styles.inviteAcceptText}>{isAccepting ? 'Joining...' : 'Accept'}</Text>
              </Pressable>
              <Pressable
                style={[styles.inviteDeclineButton, isDeclining && styles.inviteButtonDisabled]}
                onPress={handleDeclineInvite}
                disabled={isAccepting || isDeclining}
              >
                <XCircle size={14} color={IOS_COLORS.red} />
                <Text style={styles.inviteDeclineText}>{isDeclining ? 'Declining...' : 'Decline'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Pill-style Phase Tabs moved above date row */}

        {/* (Removed redundant phase intro banner — countdown card + phase tabs
            already tell the user where they are in the race lifecycle.) */}

        {/* Race Start Info Bar - VHF, races, start sequence (only on Race tab for upcoming races) */}
        {!countdown.isPast && selectedPhase === 'on_water' && (
          <RaceStartInfoBar
            vhfChannel={vhfChannel}
            startOrder={startOrderData?.startOrder}
            totalFleets={startOrderData?.totalFleets}
            classFlag={startOrderData?.classFlag}
            startTime={startOrderData?.plannedStartTime || race.startTime}
            warningTime={startOrderData?.plannedWarningTime}
            compact
          />
        )}

        {/* Phase-Specific Content — lazy phase components need Suspense */}
        <PhaseContentErrorBoundary phase={selectedPhase}>
          <Suspense fallback={null}>
            {renderPhaseContent()}
          </Suspense>
        </PhaseContentErrorBoundary>

        {/* Suggestions from followers - only renders if pending suggestions exist */}
        <SuggestionsSection raceId={cardRaceData.id} />

        {/* Compact Timeline Navigation with Prev/Next (Tufte: direct manipulation) */}
        {timelineRaces && timelineRaces.length > 1 && onSelectRace && (
          <View style={styles.compactTimeline}>
            {/* Prev Button */}
            <Pressable
              style={[
                styles.timelineNavButton,
                currentRaceIndex === 0 && styles.timelineNavButtonDisabled,
              ]}
              onPress={() => {
                if (currentRaceIndex && currentRaceIndex > 0) {
                  triggerHaptic('impactLight');
                  onSelectRace(currentRaceIndex - 1);
                }
              }}
              disabled={!currentRaceIndex || currentRaceIndex === 0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft
                size={18}
                color={currentRaceIndex === 0 ? IOS_COLORS.gray4 : IOS_COLORS.blue}
              />
            </Pressable>

            {/* Timeline Track with Dots */}
            <View style={styles.compactTimelineCenter}>
              <View style={styles.compactTimelineTrack} />
              <View style={styles.compactTimelineDots}>
                {timelineRaces.map((tlRace, index) => {
                  const isSelected = index === currentRaceIndex;
                  const isNext = index === nextRaceIndex;
                  const raceDate = new Date(tlRace.date);
                  const dayLabel = raceDate.getDate().toString();
                  const monthLabel = raceDate.toLocaleDateString('en-US', { month: 'short' }).slice(0, 3);

                  return (
                    <Pressable
                      key={tlRace.id}
                      onPress={() => {
                        triggerHaptic('impactLight');
                        onSelectRace(index);
                      }}
                      style={[
                        styles.compactTimelineDot,
                        isSelected && styles.compactTimelineDotSelected,
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      {isNext && !isSelected && (
                        <View style={styles.compactTimelineNowIndicator} />
                      )}
                      <Text style={[
                        styles.compactTimelineDay,
                        isSelected && styles.compactTimelineDaySelected,
                        isNext && !isSelected && styles.compactTimelineDayNext,
                      ]}>
                        {dayLabel}
                      </Text>
                      {/* Show month for first, last, and selected dots */}
                      {(index === 0 || index === timelineRaces.length - 1 || isSelected) && (
                        <Text style={[
                          styles.compactTimelineMonth,
                          isSelected && styles.compactTimelineMonthSelected,
                        ]}>
                          {monthLabel}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Next Button */}
            <Pressable
              style={[
                styles.timelineNavButton,
                currentRaceIndex === timelineRaces.length - 1 && styles.timelineNavButtonDisabled,
              ]}
              onPress={() => {
                if (currentRaceIndex !== undefined && currentRaceIndex < timelineRaces.length - 1) {
                  triggerHaptic('impactLight');
                  onSelectRace(currentRaceIndex + 1);
                }
              }}
              disabled={currentRaceIndex === undefined || currentRaceIndex === timelineRaces.length - 1}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronRight
                size={18}
                color={currentRaceIndex === timelineRaces.length - 1 ? IOS_COLORS.gray4 : IOS_COLORS.blue}
              />
            </Pressable>
          </View>
        )}

          </ScrollView>
        </Pressable>

      {/* Detail Bottom Sheet for drill-down (sailing) */}
      <DetailBottomSheet
        type={activeDetailSheet}
        isOpen={activeDetailSheet !== null}
        onClose={handleCloseDetailSheet}
        raceId={race.id}
        raceData={raceDataForDetailCards}
      />

      {/* Module Detail Bottom Sheet for non-sailing interests + sailing blank_activity */}
      {(!isSailing || race?.metadata?.event_subtype === 'blank_activity') && (
        <ModuleDetailBottomSheet
          moduleId={activeModuleId}
          isOpen={activeModuleId !== null}
          onClose={handleCloseModuleSheet}
          config={eventConfig}
          stepMetadata={race?.metadata || null}
          artifactContext={moduleArtifactContext}
          onContentChange={handleModuleContentChange}
        />
      )}

      {/* Detailed Review Modal for full post-race analysis */}
      <DetailedReviewModal
        visible={showDetailedReview}
        raceId={race.id}
        raceName={race.name}
        venueId={venue?.id}
        conditions={windData ? {
          windSpeed: windData.speedMin || windData.speedMax,
          windDirection: parseFloat(windData.direction) || undefined,
        } : undefined}
        onClose={handleCloseDetailedReview}
        onComplete={handleDetailedReviewComplete}
      />

      {/* Crew Hub - Unified crew management */}
      <CrewHub
        sailorId={userId || ''}
        classId={race.class_id || ''}
        className={boatClassName}
        regattaId={race.id}
        raceName={race.name}
        isOpen={showCrewHub}
        onClose={() => setShowCrewHub(false)}
        initialTab={crewHubInitialTab}
      />

      {/* Race Chat Drawer — skip for timeline steps */}
      {!isTimelineStep && (
        <RaceChatDrawer
          regattaId={race.id}
          raceName={race.name}
          isOpen={showChat}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Collaboration Popover */}
      {FEATURE_FLAGS.ENABLE_COLLABORATION_POPOVER && (
        <CollaborationPopover
          visible={showCollabPopover}
          onClose={() => setShowCollabPopover(false)}
          collaborators={collaborators}
          recentMessages={raceMessages}
          currentUserId={userId}
          onOpenChat={() => {
            setShowCollabPopover(false);
            setShowChat(true);
          }}
          onManageCrew={() => {
            setShowCollabPopover(false);
            openCrewHub('roster');
          }}
        />
      )}

      {/* Add to Blueprint Sheet */}
      {isOwner && isTimelineStep && (
        <AddToBlueprintSheet
          visible={showBlueprintSheet}
          stepId={race.id}
          stepTitle={race.name || 'Untitled step'}
          onClose={() => setShowBlueprintSheet(false)}
        />
      )}

      {/* Step Collaborator Picker — for timeline steps */}
      {isTimelineStep && (
        <CollaboratorPicker
          visible={showStepCollabPicker}
          onClose={() => setShowStepCollabPicker(false)}
          onAdd={handleAddStepCollaborator}
          existingIds={stepCollabExistingIds}
        />
      )}

      {/* Suggest Step Sheet — for timeline steps */}
      {isTimelineStep && (
        <SuggestStepSheet
          visible={showSuggestSheet}
          onClose={() => setShowSuggestSheet(false)}
          stepId={race.id}
          stepTitle={race.name || 'Untitled step'}
          stepDescription={metadata?.plan?.what_will_you_do}
          interestId={currentInterest?.id}
        />
      )}

      {/* Due Date Picker */}
      {isTimelineStep && onSetDueDate && (
        <DueDatePickerModal
          visible={showDueDatePicker}
          currentDate={race.due_at || null}
          onSelect={(iso) => {
            onSetDueDate(race.id, iso);
            setShowDueDatePicker(false);
          }}
          onClear={() => {
            onSetDueDate(race.id, null);
            setShowDueDatePicker(false);
          }}
          onClose={() => setShowDueDatePicker(false)}
        />
      )}

      {/* Visibility Picker (Android / Web) */}
      {showVisibilityPicker && (
        <Pressable
          style={visPickerStyles.backdrop}
          onPress={() => setShowVisibilityPicker(false)}
        >
          <Pressable style={visPickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={visPickerStyles.title}>Who can see this step?</Text>
            {VISIBILITY_OPTIONS.map((o) => (
              <Pressable
                key={o.value}
                style={[
                  visPickerStyles.option,
                  o.value === currentVisibility && visPickerStyles.optionActive,
                ]}
                onPress={() => handleSelectVisibility(o.value)}
              >
                <Ionicons
                  name={o.icon as any}
                  size={18}
                  color={o.value === currentVisibility ? IOS_COLORS.blue : IOS_COLORS.gray}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[
                    visPickerStyles.optionText,
                    o.value === currentVisibility && visPickerStyles.optionTextActive,
                  ]}
                >
                  {o.label}
                </Text>
                {o.value === currentVisibility && (
                  <Ionicons name="checkmark" size={18} color={IOS_COLORS.blue} style={{ marginLeft: 'auto' }} />
                )}
              </Pressable>
            ))}
            <Pressable
              style={visPickerStyles.cancelBtn}
              onPress={() => setShowVisibilityPicker(false)}
            >
              <Text style={visPickerStyles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </>
  );
}

const visPickerStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 12,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  optionActive: {
    backgroundColor: '#f0f5ff',
  },
  optionText: {
    fontSize: 15,
    color: '#1c1c1e',
  },
  optionTextActive: {
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: IOS_COLORS.blue,
    fontWeight: '500',
  },
});

// =============================================================================
// STYLES (Apple HIG Compliant)
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },

  // ==========================================================================
  // PHASE INTRO BANNER (shared across Before / Racing / Review tabs)
  // ==========================================================================

  phaseIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  phaseIntroIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseIntroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  phaseIntroDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 16,
  },

  // ==========================================================================
  // TYPE + TIMING CONTEXT HEADER (e.g., "FLEET RACE · THIS WEEK")
  // ==========================================================================

  typeContextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  typeContextText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },

  // Full countdown row (e.g., "3d 2h until race")
  fullCountdown: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    fontVariant: ['tabular-nums'],
  },

  // Header right section (race position + menu)
  headerRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Race position with navigation (e.g., "Race 4/22 →")
  racePositionNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: `${IOS_COLORS.blue}10`,
  },
  racePositionText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.blue,
    fontVariant: ['tabular-nums'],
  },

  // Race meta row (date/time + venue on same line)
  raceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 4,
  },
  raceDateTimeText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  raceMetaSeparator: {
    fontSize: 15,
    color: IOS_COLORS.gray3,
  },

  // ==========================================================================
  // LEGACY COMPACT HEADER (kept for potential reuse)
  // ==========================================================================

  compactHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: 8,
  },

  compactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  compactHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Season context text (e.g., "W26 · Race 2/10")
  seasonContext: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.2,
  },

  // Compact countdown badge (e.g., "18h" or "2d")
  countdownBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countdownBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Icon-only quick actions in header
  quickActionsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  compactActionButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  compactActionButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },

  // Race name (Apple HIG - 20pt semibold, primary visual element)
  raceName: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 26,
    letterSpacing: -0.4,
    marginBottom: 4,
  },

  // Race subtitle (venue + datetime combined)
  raceSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 12,
  },

  // Badges Row (top of card)
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Expanded header (with menu)
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  // Race Name expanded (Apple typography)
  raceNameExpanded: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    lineHeight: 28,
    marginBottom: 6,
    letterSpacing: -0.3,
  },

  // Venue
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  venueText: {
    fontSize: 15,
    color: IOS_COLORS.gray,
    marginBottom: 12,
  },

  // Countdown Section
  countdownSection: {
    marginBottom: 16,
  },
  countdownPastContainer: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
  },
  countdownPast: {
    fontSize: 18,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    textAlign: 'center',
  },

  // Collapsed countdown (iOS blue styling)
  collapsedCountdown: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 16,
  },
  countdownPastCompact: {
    fontSize: 18,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    textAlign: 'center',
  },
  countdownCompactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.gray6,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 6,
  },
  countdownCompactUnit: {
    alignItems: 'center',
    minWidth: 48,
  },
  countdownCompactValue: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  countdownCompactLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  countdownCompactSeparator: {
    fontSize: 24,
    fontWeight: '300',
    color: IOS_COLORS.gray3,
    paddingBottom: 10,
  },

  // Tufte compact countdown (single line, maximizes data-ink ratio)
  countdownTufteRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.gray6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  countdownTufteValue: {
    fontSize: 32,
    fontWeight: '700',
    color: IOS_COLORS.blue,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  countdownTufteLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },

  // Conditions Preview (collapsed)
  conditionsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: IOS_COLORS.gray6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conditionText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },

  // Conditions Preview (expanded - more detail)
  conditionsPreviewExpanded: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: IOS_COLORS.gray6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  conditionItemExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conditionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  conditionValueExpanded: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },

  // Distance Race Info Row
  distanceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  distanceInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Date & Time Row
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTimeText: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },

  // Arrival Plan Section
  arrivalSection: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  arrivalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  arrivalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  arrivalHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  arrivalSetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8FAE9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  arrivalSetBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.green,
  },
  arrivalAddBadge: {
    backgroundColor: '#E5F1FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  arrivalAddBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  arrivalContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.gray5,
  },
  arrivalSubLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  arrivalOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  arrivalOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: IOS_COLORS.gray4,
    minWidth: 80,
  },
  arrivalOptionSelected: {
    backgroundColor: IOS_COLORS.blue,
    borderColor: IOS_COLORS.blue,
  },
  arrivalOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  arrivalOptionTextSelected: {
    color: '#FFFFFF',
  },
  arrivalOptionSubtext: {
    fontSize: 10,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    marginTop: 2,
  },
  arrivalOptionSubtextSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  arrivalNotesContainer: {
    marginTop: 4,
  },
  arrivalNotesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: IOS_COLORS.label,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  savingText: {
    fontSize: 11,
    color: IOS_COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
  },

  // ==========================================================================
  // TUFTE STYLES - Typography IS the interface
  // Maximum data-ink ratio, no decorative elements
  // ==========================================================================

  // Typographic header - race type as small caps text, not a badge
  tufteTypeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  // Tappable header area for expand/collapse
  tappableHeader: {
    marginBottom: 4,
  },

  // Right side of header (menu + chevron)
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Header row with type label and menu
  tufteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  // Race name - primary visual element, large and bold
  tufteRaceName: {
    fontSize: 24,
    fontWeight: '700',
    color: IOS_COLORS.label,
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  // Venue - secondary text, no icon
  tufteVenue: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 12,
  },

  // Countdown Hero (Apple HIG - prominent centered countdown)
  countdownHero: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 12,
  },
  countdownHeroValue: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    lineHeight: 56,
  },
  countdownHeroLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: IOS_COLORS.gray,
    marginTop: 2,
  },

  // Compact Inline Countdown (saves ~16px vertical space)
  countdownInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
  },
  countdownValue: {
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  countdownLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: IOS_COLORS.gray,
  },

  // Meta Row (location, date)
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
  },

  // Quick Actions Row (Compact - icon only, 44pt touch targets maintained)
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
    marginBottom: 12,
  },
  quickActionButton: {
    width: 44,  // Touch target maintained
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  quickActionButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.gray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },

  // Time block - contains countdown inline with date
  tufteTimeBlock: {
    marginBottom: 14,
  },

  // Countdown inline - single line format: "2h 47m to start · Wed, Jan 7 10:25 AM"
  tufteCountdownInline: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
  },

  // Countdown value - the actual time, emphasized
  tufteCountdownValue: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.blue,
    fontVariant: ['tabular-nums'],
  },

  // Past race text
  tufteCountdownPast: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    fontStyle: 'italic',
  },

  // Conditions grid - flat layout, no icons
  tufteConditionsGrid: {
    gap: 8,
    marginBottom: 12,
  },

  // Condition row - label, value, sparkline
  tufteConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Condition label - fixed width for alignment
  tufteConditionLabel: {
    width: 36,
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },

  // Condition value - the data
  tufteConditionValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    fontVariant: ['tabular-nums'],
  },

  // Data density row - additional info in one line
  tufteDataDensity: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS_COLORS.gray,
    marginBottom: 16,
  },

  // Section label - small caps header for sections
  tufteSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Expanded conditions container
  tufteConditionsExpanded: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.gray5,
  },

  // Expanded condition row - more space
  tufteConditionRowExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },

  // Expanded condition label
  tufteConditionLabelExpanded: {
    width: 44,
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },

  // Expanded condition value
  tufteConditionValueExpanded: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
    fontVariant: ['tabular-nums'],
  },

  // Trend annotation text
  tufteTrendText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    fontStyle: 'italic',
  },

  // ==========================================================================
  // TUFTE EXPANDED VIEW STYLES
  // ==========================================================================

  // Time block - inline countdown with date
  tufteTimeBlockExpanded: {
    marginBottom: 16,
    gap: 8,
  },
  tufteCountdownLineExpanded: {
    fontSize: 16,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
  },
  tufteCountdownValueExpanded: {
    fontSize: 24,
    fontWeight: '700',
    color: IOS_COLORS.blue,
    fontVariant: ['tabular-nums'],
  },
  tufteDistanceInfo: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  tufteStartAction: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.gray5,
    marginTop: 8,
  },
  tufteStartActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.blue,
    textAlign: 'center',
  },

  // Arrival row - flat inline
  tufteArrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.gray5,
  },
  tufteArrivalLabel: {
    width: 60,
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  tufteArrivalValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },

  // Arrival expanded options
  tufteArrivalExpanded: {
    paddingBottom: 16,
    gap: 12,
  },
  tufteArrivalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tufteArrivalOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray4,
    backgroundColor: '#FFFFFF',
  },
  tufteArrivalOptionSelected: {
    borderColor: IOS_COLORS.blue,
    backgroundColor: `${IOS_COLORS.blue}10`,
  },
  tufteArrivalOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  tufteArrivalOptionTextSelected: {
    color: IOS_COLORS.blue,
    fontWeight: '600',
  },
  tufteArrivalNotes: {
    fontSize: 14,
    color: IOS_COLORS.label,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray4,
    borderRadius: 8,
    padding: 12,
    minHeight: 50,
  },

  // ==========================================================================
  // TUFTE "ABSENCE AS INTERFACE" STYLES
  // Empty fields communicate incompleteness through visual sparseness
  // ==========================================================================

  // Temporal context - subtle gray text showing days since race
  tufteTemporalContext: {
    fontSize: 14,
    fontWeight: '400',
    color: IOS_COLORS.gray,
    marginBottom: 12,
  },

  // Absence fields container (collapsed)
  tufteAbsenceFields: {
    gap: 8,
  },

  // Absence row - label + placeholder
  tufteAbsenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Absence label - fixed width for alignment
  tufteAbsenceLabel: {
    width: 80,
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },

  // Absence placeholder - underscore line indicating missing data
  tufteAbsencePlaceholder: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: IOS_COLORS.gray3,
    letterSpacing: 2,
  },

  // Absence value - actual data when available (increases visual density)
  tufteAbsenceValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },

  // Absence fields container (expanded) - more space for interaction
  tufteAbsenceFieldsExpanded: {
    gap: 12,
    marginTop: 8,
  },

  // Absence row expanded - tappable to open post-race interview
  tufteAbsenceRowExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
  },

  // Absence label expanded
  tufteAbsenceLabelExpanded: {
    width: 90,
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },

  // Absence placeholder expanded
  tufteAbsencePlaceholderExpanded: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.gray3,
    letterSpacing: 2,
  },

  // Absence value expanded - actual data when available
  tufteAbsenceValueExpanded: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 20,
  },

  // ==========================================================================
  // PHASE CONTENT CONTAINER STYLES
  // ==========================================================================

  // ScrollView content container
  scrollContent: {
    paddingBottom: 120, // Clear floating tab bar + safe area insets
  },

  // Compact Timeline (inside card footer - Tufte-inspired)
  compactTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.gray5,
    gap: 8,
  },
  // Navigation buttons for timeline
  timelineNavButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: IOS_COLORS.gray6,
  },
  timelineNavButtonDisabled: {
    opacity: 0.4,
  },
  // Center section with track and dots
  compactTimelineCenter: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  compactTimelineTrack: {
    position: 'absolute',
    top: '40%',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: IOS_COLORS.gray5,
    borderRadius: 1,
  },
  compactTimelineDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  compactTimelineDot: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 32,
    paddingTop: 4,
  },
  compactTimelineDotSelected: {
    // Selected state handled by text styles
  },
  compactTimelineDay: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
    fontVariant: ['tabular-nums'],
  },
  compactTimelineDaySelected: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.blue,
  },
  compactTimelineDayNext: {
    color: '#10B981', // Next race green
    fontWeight: '600',
  },
  compactTimelineMonth: {
    fontSize: 9,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  compactTimelineMonthSelected: {
    color: IOS_COLORS.blue,
    fontWeight: '600',
  },
  compactTimelineNowIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginBottom: 4,
  },

  // Demo race badge (shown when user has no real races)
  demoBadge: {
    backgroundColor: '#FEF3C7', // Amber-100
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  demoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E', // Amber-800
    letterSpacing: 0.3,
  },
  demoHint: {
    fontSize: 11,
    color: '#B45309', // Amber-700
    marginTop: 2,
  },

  // Sample data badge (shown for seeded races from onboarding)
  sampleBadge: {
    backgroundColor: '#E0E7FF', // Indigo-100
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  sampleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338CA', // Indigo-700
    letterSpacing: 1,
  },

  // Guest sample CTA banner — replaces the small badge for guests
  sampleGuestBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  sampleGuestIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sampleGuestTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#0B1A33',
    marginBottom: 2,
  },
  sampleGuestSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 17,
  },
  sampleGuestCta: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(37, 99, 235, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  sampleGuestCtaText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#2563EB',
    letterSpacing: 0.1,
  },

  // ==========================================================================
  // COLLABORATION BADGE STYLES
  // ==========================================================================

  // "Shared with you" badge for accepted collaborators
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${IOS_COLORS.blue}15`,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  sharedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },

  // Pending invite badge container (contains badge + actions)
  inviteBadgeContainer: {
    marginBottom: 12,
  },
  inviteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${IOS_COLORS.orange}15`,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  inviteBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.orange,
  },

  // Accept/Decline action buttons
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  inviteAcceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${IOS_COLORS.green}15`,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteAcceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.green,
  },
  inviteDeclineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${IOS_COLORS.red}10`,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteDeclineText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.red,
  },
  inviteButtonDisabled: {
    opacity: 0.6,
  },

  // ==========================================================================
  // TUFTE MINIMALIST CARD STYLES
  // Maximum data density, typography IS the interface
  // ==========================================================================

  // Top row: temporal info left, race number + menu right
  tufteTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tufteTopRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tufteTemporalText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  tufteRaceNumber: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS_COLORS.gray,
  },

  // Simplified race name (larger, no club prefix)
  tufteRaceNameSimplified: {
    fontSize: 18,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 24,
    marginBottom: 12,
    letterSpacing: -0.3,
  },

  // Inline progress bar
  tufteProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  tuftePhaseName: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    width: 44, // Fixed width for alignment
  },
  tufteProgressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: IOS_COLORS.gray5,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tufteProgressFill: {
    height: 4,
    backgroundColor: IOS_COLORS.secondaryLabel,
    borderRadius: 2,
  },
  tufteProgressCount: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    width: 20, // Fixed width for alignment
    textAlign: 'right',
  },

  // Complete state
  tufteCompleteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  tufteCompleteText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },

  // ==========================================================================
  // SIMPLIFIED HEADER STYLES (Clean design: badge + countdown + name + details)
  // ==========================================================================

  simpleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  simpleHeaderWrapper: {
    position: 'relative',
  },
  nextBookmarkRibbon: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  nextBookmarkRibbonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.2,
  },
  raceTypeBadge: {
    backgroundColor: IOS_COLORS.gray5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  raceTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },
  raceTypeBadgeTextSubtle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    color: IOS_COLORS.tertiaryLabel,
  },
  simpleHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markDoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: `${IOS_COLORS.green}12`,
  },
  markDoneLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.green,
    letterSpacing: -0.2,
  },
  countdownSimple: {
    alignItems: 'center',
  },
  countdownNumberSimple: {
    fontSize: 28,
    fontWeight: '700',
  },
  countdownLabelSimple: {
    fontSize: 13,
    fontWeight: '500',
  },
  pastTimeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    letterSpacing: -0.1,
  },
  countdownTodayLabel: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pastRaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    // Status surfaced as text per redesign secondary-surfaces audit §4 commit 1
    // — no fill chip, just textTertiary label sitting inline.
  },
  pastBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: STEP_PALETTE.textTertiary,
    letterSpacing: 0.5,
  },
  headerChipGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  // Inline variant of sharedBadge for the header chip row (no marginBottom).
  sharedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sharedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    // Neutral pill — drop the green fill on "Done", let the inline glyph + label
    // carry status. Secondary-surfaces audit §4 commit 1.
    backgroundColor: 'transparent',
  },
  statusToggleDone: {
    backgroundColor: 'transparent',
  },
  statusToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_PALETTE.textSecondary,
    letterSpacing: -0.1,
  },
  statusToggleTextDone: {
    color: STEP_PALETTE.textPrimary,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pinnedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },
  overdueBadge: {
    backgroundColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  overdueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    letterSpacing: 0.2,
  },
  stateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  stateLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateLabelDotHalo: {
    // 3px coral ring around the live dot — pulse-of-life signal
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(255, 107, 107, 0.22)',
      } as any,
      default: {},
    }),
  },
  stateLabelText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  raceNameLarge: {
    // Serif title treatment per redesign commit 3 + mockup 01/06 — scaled to
    // serifSubtitle (22pt) for the card variant, since the card width is half
    // the full step-detail view where 28pt is used.
    ...text.serifSubtitle,
    color: IOS_COLORS.label,
    marginBottom: 10,
  },
  raceNameInput: {
    borderBottomWidth: 0,
    paddingVertical: 2,
    marginBottom: 8,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  untitledHintPressable: {
    marginTop: -4,
    marginBottom: 8,
  },
  untitledHintText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  detailProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: -4,
  },
  detailProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  detailProgressFill: {
    height: '100%',
    backgroundColor: IOS_COLORS.green,
    borderRadius: 2,
  },
  detailProgressLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.1,
  },
  templateSuggestedRow: {
    marginTop: -2,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  templateSuggestedLabel: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    fontWeight: '600',
  },
  templateSuggestedChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 170,
  },
  templateSuggestedChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  advancedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  advancedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  nursingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  validatedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  validatedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  simpleDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  simpleDetailText: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
  },
  crewAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  stepCollabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  stepCollabAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCollabAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8FAE9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  stepCollabAvatarEmoji: {
    fontSize: 12,
  },
  stepCollabAvatarInitial: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34C759',
  },
  stepCollabOverflow: {
    backgroundColor: IOS_COLORS.gray5,
  },
  stepCollabOverflowText: {
    fontSize: 9,
    fontWeight: '700',
    color: IOS_COLORS.gray,
  },
  stepCollabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    marginLeft: 6,
  },

});

// React.memo skips re-renders when props are shallow-equal. Useful for
// collaborator/read-only cards (canManage=false → callback props are stable
// `undefined`), and any case where upstream props genuinely haven't changed.
export const RaceSummaryCard = React.memo(RaceSummaryCardImpl);

export default RaceSummaryCard;
