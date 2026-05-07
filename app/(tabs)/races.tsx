import {
  CardGrid,
  TUFTE_BACKGROUND,
  calculateCardDimensions,
  getCardContentComponent,
  type CardRaceData,
  type CardType
} from '@/components/cards';
import { IOS_COLORS } from '@/components/cards/constants';
import { TimelineGridView } from '@/components/cards/TimelineGridView';
import { openInterestSwitcher } from '@/components/InterestSwitcher';
import { BlueprintWelcomeCard } from '@/components/races/BlueprintWelcomeCard';

import {
  PreRaceStrategySection,
  RaceConditionsCard,
  RacePhaseHeader,
} from '@/components/race-detail';
import type { RaceDocument as RaceDocumentsCardDocument } from '@/components/race-detail/RaceDocumentsCard';
import {
  AddStepSheet,
  AIVenueInsightsCard,
  BoatSetupSection,
  ClassExpertsSection,
  CourseOutlineCard,
  DemoNotice,
  DemoRacesCarousel,
  DistanceRaceContentSection,
  FleetActivityFeed,
  FleetRaceContentSection,
  FleetStrategySection,
  PostRaceAnalysisSection,
  RaceModalsSection,
  RacesFloatingHeader,
  RealRacesCarousel,
  RegulatoryDigestCard,
  SocialTimelineView,
  TeamLogisticsSection,
} from '@/components/races';
import { RaceListSection } from '@/components/races/RaceListSection';
import { SeasonArchive } from '@/components/seasons/SeasonArchive';
import { IOSRacesScreen } from '@/components/races/ios';
import { AIPatternDetection } from '@/components/races/debrief/AIPatternDetection';
import { TourStep } from '@/components/onboarding/TourStep';
import { OnWaterTrackingView } from '@/components/races/OnWaterTrackingView';
import { calculatePerformanceMetrics } from '@/components/races/PerformanceMetrics';
import { PlanModeContent } from '@/components/races/plan';
import { TacticalCalculations } from '@/components/races/TacticalDataOverlay';
import { SeasonPickerModal } from '@/components/seasons/SeasonPickerModal';
import { SeasonSettingsModal } from '@/components/seasons/SeasonSettingsModal';
import SignupPromptModal from '@/components/auth/SignupPromptModal';
import { ErrorMessage } from '@/components/ui/error';
import { DashboardSkeleton } from '@/components/ui/loading';
import { MOCK_RACES } from '@/constants/mockData';
import { useRaceBriefSync } from '@/hooks/ai/useRaceBriefSync';
import { useActiveRaceSummary } from '@/hooks/useActiveRaceSummary';
import { useAddRace } from '@/hooks/useAddRace';
import { useCoachContext } from '@/hooks/useCoachContext';
import { useDashboardData } from '@/hooks/useData';
import { useEnrichedRaces } from '@/hooks/useEnrichedRaces';
import { useFollowedTimelines } from '@/hooks/useFollowedTimelines';
import { useGuestRaces } from '@/hooks/useGuestRaces';
import { useNextMarkData } from '@/hooks/useNextMarkData';
import { useOffline } from '@/hooks/useOffline';
import { usePostRaceInterview } from '@/hooks/usePostRaceInterview';
import { usePracticeSessions } from '@/hooks/usePracticeSessions';
import { useRaceBriefData } from '@/hooks/useRaceBriefData';
import { useRaceClassSelection } from '@/hooks/useRaceClassSelection';
import { useRaceCourse } from '@/hooks/useRaceCourse';
import { useRaceDebriefData } from '@/hooks/useRaceDebriefData';
import { useRaceDocuments } from '@/hooks/useRaceDocuments';
import { useRaceLayoutData } from '@/hooks/useRaceLayoutData';
import { DEMO_RACE, getDemoEvent, getDemoTimelineSteps, useRaceListData } from '@/hooks/useRaceListData';
import { useRaceMarks } from '@/hooks/useRaceMarks';
import { useRacePhaseDetection } from '@/hooks/useRacePhaseDetection';
import { useRacePhaseInput } from '@/hooks/useRacePhaseInput';
import { useRacePreparation } from '@/hooks/useRacePreparation';
import { useRacePreparationData } from '@/hooks/useRacePreparationData';
import { useLiveRaces, useUserRaceResults, withdrawFromRace } from '@/hooks/useRaceResults';
import { useRaceTuningRecommendation } from '@/hooks/useRaceTuningRecommendation';
import { useRaceWeather } from '@/hooks/useRaceWeather';
import { useSailorProfile } from '@/hooks/useSailorProfile';
import { useCurrentSeason, useUserSeasons, useSeasonRegattas } from '@/hooks/useSeason';
import { useStrategySharing } from '@/hooks/useStrategySharing';
import { useTacticalSnapshots } from '@/hooks/useTacticalSnapshots';
import { useTideDepthSnapshots } from '@/hooks/useTideDepthSnapshots';
import { useVenueCenter } from '@/hooks/useVenueCenter';
import { useVenueCoordinates } from '@/hooks/useVenueCoordinates';
import { useVenueDetection } from '@/hooks/useVenueDetection';
import { useVenueInsights } from '@/hooks/useVenueInsights';
import { useVenueLiveWeather } from '@/hooks/useVenueLiveWeather';
import { useQueryClient } from '@tanstack/react-query';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { createStep as createTimelineStep, deleteStep as deleteTimelineStep, updateStepMetadata } from '@/services/TimelineStepService';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import { RaceCollaborationService } from '@/services/RaceCollaborationService';
import { timelineStepsToCardRaceData } from '@/lib/timeline/timelineStepAdapter';
import { compareTimelineItems } from '@/lib/races/timelineCompare';
import { StepFilterBar, type StepFilters } from '@/components/step/StepFilterBar';
import { StepDetailContent } from '@/components/step/StepDetailContent';
// PeerTimelinesFooter peer sections now integrated into BlueprintProgressStrip
import { BlueprintProgressStrip } from '@/components/blueprint/BlueprintProgressStrip';
import { BlueprintPanelsStack } from '@/components/cards/BlueprintPanelsStack';
import { PublishBlueprintSheet } from '@/components/blueprint/PublishBlueprintSheet';
import { useUserBlueprints, useSubscribedBlueprints, useSuggestedNextSteps, useAdoptBlueprintStep, useDismissBlueprintStep, useAutoAdoptSubscribedSteps } from '@/hooks/useBlueprint';
import { useScrollToolbarHide } from '@/hooks/useScrollToolbarHide';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import {
  ADD_RACE_CARD_DISMISSED_KEY,
  SAMPLE_RACE_DISMISSED_KEY,
  normalizeDocumentType as normalizeDocumentTypeUtil,
  type RegulatoryAcknowledgements
} from '@/lib/races';
import { createLogger } from '@/lib/utils/logger';
import { isAbortError } from '@/lib/utils/fetchWithTimeout';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { useToast } from '@/components/ui/AppToast';
import { getLastViewState, saveLastViewState } from '@/lib/utils/lastViewState';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useInterestEventConfig } from '@/hooks/useInterestEventConfig';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useFeatureTourContext } from '@/providers/FeatureTourProvider';
import { DemoRaceService } from '@/services/DemoRaceService';
import { isDemoRaceId } from '@/lib/demo/demoRaceData';
import { getDemoRaceStartDateISO, getDemoRaceStartTimeLabel } from '@/lib/demo/demoDate';
// createSailorSampleData removed — new users see client-side demo race instead
import type { RaceDocumentWithDetails } from '@/services/RaceDocumentService';
import { supabase } from '@/services/supabase';
import { TacticalZoneGenerator } from '@/services/TacticalZoneGenerator';
import { useRaceConditions } from '@/stores/raceConditionsStore';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Animated, Dimensions, LayoutRectangle, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming, withSequence, withDelay, withRepeat, runOnJS, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const logger = createLogger('RacesScreen');

// Storage keys for the guest signup nudge.
// - LAST_SHOWN: timestamp (ms) of the most recent auto-fired signup modal,
//   used to enforce a 24h cross-session cooldown so we don't nag returning guests.
// - FIRST_SESSION_DONE: 'true' once the user has completed their first browsing
//   session (i.e. seen the modal at least once). Drives the welcome-back banner.
const SIGNUP_MODAL_LAST_SHOWN_KEY = '@betterat/signup_modal_last_shown_ms';
const GUEST_FIRST_SESSION_DONE_KEY = '@betterat/guest_first_session_done';
// Persisted tap counter — increments on every sample-step tap while the cooldown
// is active. When it crosses the threshold we re-fire the modal as a high-intent
// signal, even if the 24h cooldown hasn't elapsed yet.
const SIGNUP_MODAL_TAPS_KEY = '@betterat/signup_modal_taps_since_shown';
const SIGNUP_MODAL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const SIGNUP_MODAL_TAP_THRESHOLD = 5;

// Destructure tactical calculations for easy access
const { calculateDistance, calculateBearing } = TacticalCalculations;

// Types, constants, and utilities imported from @/lib/races:
// - ActiveRaceSummary, RaceBriefData, RigPreset, RegulatoryDigestData, RegulatoryAcknowledgements
// - TacticalWindSnapshot, TacticalCurrentSnapshot, GPSPoint, DebriefSplitTime
// - DOCUMENT_TYPE_OPTIONS, ADD_RACE_CARD_DISMISSED_KEY, MOCK_GPS_TRACK, MOCK_SPLIT_TIMES
// - normalizeDirection, pickNumeric, normalizeCurrentType, extractWindSnapshot
// - extractCurrentSnapshot, parseGpsTrack, parseSplitTimes, detectRaceType

/** Naive English plural — handles "Activity" → "Activities", "Race" → "Races" */
const pluralize = (noun: string): string => {
  if (noun.endsWith('y') && !/[aeiou]y$/i.test(noun)) {
    return noun.slice(0, -1) + 'ies';
  }
  if (noun.endsWith('s') || noun.endsWith('x') || noun.endsWith('sh') || noun.endsWith('ch')) {
    return noun + 'es';
  }
  return noun + 's';
};

// Local helper for RaceDocumentsCard type conversion
const normalizeDocumentType = (
  type: RaceDocumentWithDetails['documentType']
): RaceDocumentsCardDocument['type'] => {
  return normalizeDocumentTypeUtil(type) as RaceDocumentsCardDocument['type'];
};

// Stable empty array to avoid creating new reference when liveRaces is null/undefined
const EMPTY_RACES: any[] = [];

export default function RacesScreen() {
  const auth = useAuth();
  const { user, userProfile, signedIn, ready, isDemoSession, userType, isGuest, enterGuestMode, wasAuthenticated } = auth;
  const { isTourActive, currentStep, triggerPricingPrompt } = useFeatureTourContext();
  const eventConfig = useInterestEventConfig();
  const { currentInterest, effectiveInterestIds, viewMode, toggleDomainView, domainInterestIds, getDomainForInterest } = useInterest();
  const currentDomain = currentInterest ? getDomainForInterest(currentInterest.id) : null;
  const hasSiblingInterests = domainInterestIds.length > 1;
  const { activeOrganization, activeMembership } = useOrganization();
  const { vocab } = useVocabulary();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Blueprint publishing
  const [showBlueprintSheet, setShowBlueprintSheet] = useState(false);
  const { data: userBlueprints } = useUserBlueprints();
  const existingBlueprintsForInterest = userBlueprints?.filter(
    (bp) => bp.interest_id === currentInterest?.id,
  ) ?? [];
  const existingBlueprint = existingBlueprintsForInterest[0] ?? null;

  // Subscribed blueprints (for per-card blueprint chip lookup)
  const { data: subscribedBlueprints } = useSubscribedBlueprints(viewMode === 'domain' ? null : currentInterest?.id);

  // Smart Add Step Sheet: suggested next steps from subscribed blueprints
  const [showAddStepSheet, setShowAddStepSheet] = useState(false);
  const { data: suggestedNextSteps } = useSuggestedNextSteps(viewMode === 'domain' ? null : currentInterest?.id);
  const adoptBlueprintStep = useAdoptBlueprintStep();
  const dismissBlueprintStep = useDismissBlueprintStep();

  // Faculty blueprint guidance banner
  const FACULTY_ROLES = useMemo(() => new Set([
    'faculty', 'instructor', 'lead-instructor', 'clinical-instructor',
    'preceptor', 'evaluator', 'workshop-leader', 'master-printer',
    'head-grower', 'head-chef', 'lead-facilitator', 'pattern-designer',
    'teaching-professional', 'head-professional', 'head-trainer',
    'personal-trainer', 'studio-director', 'guild-master',
  ]), []);
  const isFacultyMember = activeMembership?.role
    ? FACULTY_ROLES.has(activeMembership.role.toLowerCase())
    : false;
  const hasPublishedBlueprint = existingBlueprintsForInterest.some((bp) => bp.is_published);
  const [facultyBannerDismissed, setFacultyBannerDismissed] = useState(false);
  const showFacultyBanner = isFacultyMember && !hasPublishedBlueprint && !facultyBannerDismissed;

  // Program-aware faculty banner: look up the program from the faculty's accepted invite
  const [facultyProgramName, setFacultyProgramName] = useState<string | null>(null);
  useEffect(() => {
    if (!showFacultyBanner || !user?.id || !activeOrganization?.id) {
      setFacultyProgramName(null);
      return;
    }
    // Query the most recent accepted invite for this user+org that has a program_id
    (async () => {
      try {
        const { data: invite } = await supabase
          .from('organization_invites')
          .select('program_id')
          .eq('organization_id', activeOrganization.id)
          .eq('status', 'accepted')
          .not('program_id', 'is', null)
          .order('responded_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (invite?.program_id) {
          const { data: prog } = await supabase
            .from('programs')
            .select('title')
            .eq('id', invite.program_id)
            .single();
          setFacultyProgramName(prog?.title ?? null);
        }
      } catch {
        // Non-critical
      }
    })();
  }, [showFacultyBanner, user?.id, activeOrganization?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Safe area insets for proper header spacing
  const insets = useSafeAreaInsets();

  // State for dismissing the demo notice
  const [demoNoticeDismissed, setDemoNoticeDismissed] = useState(false);

  // First-run: prompt guests to sign up after they explore a sample step.
  // - One-shot per session to avoid nagging within a session
  // - 24h cooldown across cold launches so returning guests aren't re-nagged
  // - Records "first session completed" so we can switch the banner copy on
  //   subsequent visits (welcome-back variant)
  const [showSampleSignupPrompt, setShowSampleSignupPrompt] = useState(false);
  const sampleSignupShownRef = React.useRef(false);
  const signupModalLastShownRef = React.useRef<number | null>(null);
  const sampleTapCountRef = React.useRef<number>(0);
  const [isReturningGuest, setIsReturningGuest] = useState(false);

  // Persist these flags so the nudge is well-mannered across cold launches.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lastShownStr, firstSessionDone, tapCountStr] = await Promise.all([
          AsyncStorage.getItem(SIGNUP_MODAL_LAST_SHOWN_KEY),
          AsyncStorage.getItem(GUEST_FIRST_SESSION_DONE_KEY),
          AsyncStorage.getItem(SIGNUP_MODAL_TAPS_KEY),
        ]);
        if (cancelled) return;
        const lastShown = lastShownStr ? Number(lastShownStr) : null;
        signupModalLastShownRef.current = Number.isFinite(lastShown) ? lastShown : null;
        const tapCount = tapCountStr ? Number(tapCountStr) : 0;
        sampleTapCountRef.current = Number.isFinite(tapCount) ? tapCount : 0;
        if (firstSessionDone === 'true') {
          setIsReturningGuest(true);
        }
      } catch {
        // Storage failures are non-fatal — fall back to default behavior
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pulse animation overlaid on the toolbar + button. Triggered after the
  // sample-signup modal is dismissed so the user knows where to create their own.
  const addPulseProgress = useSharedValue(0);
  const [showAddPulse, setShowAddPulse] = useState(false);
  const triggerAddButtonPulse = useCallback(() => {
    setShowAddPulse(true);
    addPulseProgress.value = 0;
    addPulseProgress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) }),
      3,
      false,
      (finished) => {
        if (finished) {
          runOnJS(setShowAddPulse)(false);
        }
      },
    );
  }, [addPulseProgress]);

  const addPulseRingStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - addPulseProgress.value),
    transform: [{ scale: 1 + addPulseProgress.value * 0.9 }],
  }));

  // Season archive modal
  const [showFullArchive, setShowFullArchive] = useState(false);

  // Season state and hooks
  const [showSeasonSettings, setShowSeasonSettings] = useState(false);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [showStepPicker, setShowStepPicker] = useState(false);
  const [isGridView, setIsGridView] = useState(() => {
    const saved = getLastViewState();
    return saved?.isGridView ?? true;
  });
  const [stepFilters, setStepFilters] = useState<StepFilters>({ status: null, capabilityGoal: null });
  const [timelineStatusOverrides, setTimelineStatusOverrides] = useState<Record<string, {
    status: 'completed' | 'pending';
    startDateIso: string;
    startTimeLabel: string;
  }>>({});

  // isGridView is now restored from localStorage — no mount override needed

  // filterSeasonId: null = "All Races", undefined = use current season, string = specific season
  const [filterSeasonId, setFilterSeasonId] = useState<string | null | undefined>(undefined);
  const { data: currentSeason, isLoading: loadingCurrentSeason, refetch: refetchCurrentSeason } = useCurrentSeason();
  const { data: userSeasons, refetch: refetchSeasons } = useUserSeasons();

  // Use demo season for guest users
  const effectiveSeason = useMemo(() => {
    if (isGuest) {
      return DemoRaceService.getDemoSeason() as any; // Cast to match SeasonWithSummary type
    }
    return currentSeason;
  }, [isGuest, currentSeason]);

  // Determine the actual season to use for filtering
  // If filterSeasonId is undefined, use current season (default behavior)
  // If filterSeasonId is null, show all races (no filter)
  // If filterSeasonId is a string, filter by that specific season
  const activeFilterSeasonId = filterSeasonId === undefined
    ? effectiveSeason?.id ?? null // Default to current season, or null if no current season
    : filterSeasonId;

  // Get the display season for the header (either the filter season or current season)
  const displaySeason = useMemo(() => {
    if (activeFilterSeasonId === null) {
      // "All Races" mode - no specific season
      return null;
    }
    if (activeFilterSeasonId === effectiveSeason?.id) {
      return effectiveSeason;
    }
    // Find the season in userSeasons
    const found = userSeasons?.find(s => s.id === activeFilterSeasonId);
    if (found) {
      // Convert SeasonListItem to SeasonWithSummary-like structure for SeasonHeader
      return {
        ...found,
        summary: {
          regatta_count: found.regatta_count,
          total_races: found.race_count,
          completed_races: found.completed_count,
          upcoming_races: found.race_count - found.completed_count,
        },
      } as any;
    }
    return effectiveSeason;
  }, [activeFilterSeasonId, effectiveSeason, userSeasons]);

  // Get regattas linked to the filter season for filtering
  const { data: seasonRegattas } = useSeasonRegattas(activeFilterSeasonId || undefined);
  const seasonRegattaIds = useMemo(() => {
    if (!seasonRegattas) return new Set<string>();
    return new Set(seasonRegattas.map(sr => sr.regatta_id));
  }, [seasonRegattas]);

  const fetchUserProfileRef = useRef(auth.fetchUserProfile);
  useEffect(() => {
    fetchUserProfileRef.current = auth.fetchUserProfile;
  }, [auth.fetchUserProfile]);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const searchParams = useLocalSearchParams<{ selected?: string }>();
  const [showCalendarImport, setShowCalendarImport] = useState(false);
  const mainScrollViewRef = useRef<ScrollView>(null); // Main vertical ScrollView
  const raceCardsScrollViewRef = useRef<ScrollView>(null); // Horizontal race cards ScrollView
  const demoRaceCardsScrollViewRef = useRef<ScrollView>(null); // Horizontal demo race cards ScrollView
  const hasAutoCenteredNextRace = useRef(false);
  // hasTriedSampleCreation and creatingSampleData removed — no longer auto-seeding
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

  // Mobile detection - only actual native mobile platforms (not web at any size)
  const isMobileNative = Platform.OS === 'ios' || Platform.OS === 'android';

  // Two-zone layout constants: 70% hero (race cards), 30% detail cards
  // Cards should dominate the screen for easy viewing and swiping
  const HEADER_HEIGHT = Platform.OS === 'ios' ? 140 : 120; // Including safe area, nav header, and venue display
  const TAB_BAR_HEIGHT = 80; // Bottom tab bar
  const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - TAB_BAR_HEIGHT;
  const HERO_ZONE_HEIGHT = Math.floor(AVAILABLE_HEIGHT * 0.72); // 72% for race card + timeline dots
  const DETAIL_ZONE_HEIGHT = AVAILABLE_HEIGHT - HERO_ZONE_HEIGHT; // Remaining 28% for detail cards
  const RACE_CARD_HEIGHT = HERO_ZONE_HEIGHT - 50; // Leave room for timeline dots only (header moved outside)

  // Full-screen card dimensions - cards take up most of the screen
  // Calculate centering padding so cards snap to center of screen
  const MOBILE_CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 375); // Card width
  const MOBILE_CARD_GAP = 16; // Gap between cards (Apple HIG: sufficient space for shadows to breathe)
  const MOBILE_CENTERING_PADDING = (SCREEN_WIDTH - MOBILE_CARD_WIDTH) / 2; // Padding to center cards
  const MOBILE_SNAP_INTERVAL = MOBILE_CARD_WIDTH + MOBILE_CARD_GAP;

  // Web dimensions - also use full-screen cards
  const DESKTOP_RACE_CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 375);
  const DESKTOP_RACE_CARD_TOTAL_WIDTH = DESKTOP_RACE_CARD_WIDTH + MOBILE_CARD_GAP;

  // Dynamic values - same for all platforms now (full-screen cards)
  const RACE_CARD_WIDTH = MOBILE_CARD_WIDTH;
  const RACE_CARD_TOTAL_WIDTH = MOBILE_SNAP_INTERVAL;

  // State for horizontal scroll arrows
  const [scrollX, setScrollX] = useState(0);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);

  const [regulatorySectionY, setRegulatorySectionY] = useState(0);
  const [logisticsSectionY, setLogisticsSectionY] = useState(0);

  // Add race state is now provided by useAddRace hook below
  // Post-race interview state is now provided by usePostRaceInterview hook below

  // Toolbar measured height for content padding
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const { toolbarHidden, handleScroll: handleToolbarScroll } = useScrollToolbarHide();
  // Single-line toolbar mode: season context is in toolbar subtitle.
  const totalHeaderHeight = toolbarHeight;

  // Filter bar hide animation — slides up and collapses alongside the toolbar.
  const [filterBarHeight, setFilterBarHeight] = useState(0);
  const animatedFilterBarStyle = useAnimatedStyle(() => {
    const collapse = toolbarHidden && filterBarHeight > 0 ? -filterBarHeight : 0;
    return {
      transform: [{ translateY: withTiming(collapse, { duration: 250 }) }],
      marginBottom: withTiming(collapse, { duration: 250 }),
    };
  }, [toolbarHidden, filterBarHeight]);

  // Selected race detail state — restore from localStorage on web refresh
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(() => {
    if (typeof searchParams?.selected === 'string') return null; // route param takes priority
    const saved = getLastViewState();
    return saved?.selectedStepId ?? null;
  });
  const hasActiveRace = selectedRaceId !== null;
  const [selectedRaceData, setSelectedRaceData] = useState<any>(null);
  const [selectedRaceMarks, setSelectedRaceMarks] = useState<any[]>([]);
  const [loadingRaceDetail, setLoadingRaceDetail] = useState(false);
  // raceDocuments, loadingRaceDocuments, raceDocumentsError, upload handlers are now provided by useRaceDocuments hook below
  const [selectedDemoRaceId, setSelectedDemoRaceId] = useState<string | null>(MOCK_RACES[0]?.id ?? null);
  const [deletingRaceId, setDeletingRaceId] = useState<string | null>(null);
  const isDeletingRace = deletingRaceId !== null;
  // Legacy: timelineCustomOrderIds was used for client-side reorder persistence.
  // Now sort_order in DB is the source of truth, so this is no longer needed.
  const [raceDetailReloadKey, setRaceDetailReloadKey] = useState(0);
  const fetchedRaceDetailIdRef = useRef<string | null>(null);
  // When a handler sets step data directly, store the ID here so the fetch effect skips overwriting it
  const skipFetchForStepRef = useRef<string | null>(null);
  // Trigger for AfterRaceContent to refetch data after PostRaceInterview completes
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const triggerRaceDetailReload = useCallback(() => {
    setRaceDetailReloadKey((prev) => prev + 1);
  }, []);
  const [hasManuallySelected, setHasManuallySelected] = useState(() => {
    // If we restored a selectedRaceId from saved state, treat it as a manual selection
    // so auto-select doesn't override it
    if (typeof searchParams?.selected === 'string') return false;
    const saved = getLastViewState();
    return !!saved?.selectedStepId;
  });
  const hasAssignedFallbackRole = useRef(false);
  const initialSelectedRaceParam = useRef<string | null>(
    typeof searchParams?.selected === 'string' ? searchParams.selected : null
  );

  // Keep the ref in sync when searchParams.selected changes (e.g. navigating back to this tab)
  useEffect(() => {
    if (typeof searchParams?.selected === 'string' && searchParams.selected) {
      initialSelectedRaceParam.current = searchParams.selected;
    }
  }, [searchParams?.selected]);

  // Live race execution state
  const [gpsPosition, setGpsPosition] = useState<any>(null);
  const [gpsTrail, setGpsTrail] = useState<any[]>([]);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [isGPSTracking, setIsGPSTracking] = useState(false);
  const [gpsTrackSessionId, setGpsTrackSessionId] = useState<string | null>(null);
  // sailorId is now provided by useSailorProfile hook below
  // showCoachSelectionModal, sharingStrategy, sharingRaceEventId are now provided by useStrategySharing hook below
  const [showBoatClassSelector, setShowBoatClassSelector] = useState(false);
  const [addRaceCardDismissed, setAddRaceCardDismissed] = useState(false);
  const [sampleRaceDismissed, setSampleRaceDismissed] = useState(false);
  const updateRacePosition = useRaceConditions(state => state.updatePosition);
  const updateEnvironment = useRaceConditions(state => state.updateEnvironment);
  const updateCourse = useRaceConditions(state => state.updateCourse);
  const setTacticalZones = useRaceConditions(state => state.setTacticalZones);
  const resetRaceConditions = useRaceConditions(state => state.reset);
  const setDraft = useRaceConditions(state => state.setDraft);
  const currentDraft = useRaceConditions(state => state.draft);
  const lastHeadingRef = useRef<number | null>(null);
  const fallbackPositionInitializedRef = useRef(false);
  const previousCourseKeyRef = useRef<string | null>(null);
  const previousEnvironmentKeyRef = useRef<string | null>(null);
  const previousZonesKeyRef = useRef<string | null>(null);

  // Load AddRaceCard dismissal state from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(ADD_RACE_CARD_DISMISSED_KEY).then((value) => {
      if (value === 'true') {
        setAddRaceCardDismissed(true);
      }
    });
  }, []);

  // Handler to dismiss the AddRaceCard
  const handleDismissAddRaceCard = useCallback(async () => {
    setAddRaceCardDismissed(true);
    await AsyncStorage.setItem(ADD_RACE_CARD_DISMISSED_KEY, 'true');
  }, []);

  // Load Sample Race dismissal state from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(SAMPLE_RACE_DISMISSED_KEY).then((value) => {
      if (value === 'true') {
        setSampleRaceDismissed(true);
      }
    });
  }, []);

  // Handler to dismiss the Sample Race card
  const handleDismissSampleRace = useCallback(async () => {
    setSampleRaceDismissed(true);
    await AsyncStorage.setItem(SAMPLE_RACE_DISMISSED_KEY, 'true');
  }, []);


  // Tips dismissal state - TODO: implement when TufteTipsCarousel is created
  // const TIPS_DISMISSED_KEY = 'regattaflow_tips_dismissed';
  // const [tipsDismissed, setTipsDismissed] = useState(false);

  // Add button layout for floating header
  const [addButtonLayout, setAddButtonLayout] = useState<LayoutRectangle | null>(null);

  // Persist selected step and interest to localStorage so page refresh restores position
  useEffect(() => {
    if (selectedRaceId) {
      saveLastViewState({ selectedStepId: selectedRaceId });
    }
  }, [selectedRaceId]);

  useEffect(() => {
    if (currentInterest?.slug) {
      saveLastViewState({ interestSlug: currentInterest.slug });
    }
  }, [currentInterest?.slug]);

  useEffect(() => {
    saveLastViewState({ isGridView });
  }, [isGridView]);

  // Clear any stuck loading states on mount

  useEffect(() => {
    resetRaceConditions();
    setTacticalZones([]);
  }, [selectedRaceId]);

  // documentTypeResolverRef cleanup is now handled by useRaceDocuments hook

  // Use race preparation hook for persistent storage
  const {
    rigNotes,
    setRigNotes,
    selectedRigPresetId: selectedRigBand,
    setSelectedRigPresetId: setSelectedRigBand,
    acknowledgements: regattaAcknowledgements,
    setAcknowledgements: setRegattaAcknowledgements,
    toggleAcknowledgement,
    updateRaceBrief,
    isLoading: isLoadingPreparation,
    isSaving: isSavingPreparation,
  } = useRacePreparation({
    regattaId: selectedRaceData?.id || null,
    autoSave: true,
    debounceMs: 1000,
  });

  // Real-time race updates - moved early to avoid hoisting issues with callbacks
  // For guests, use the guest races hook (demo races + local guest race).
  // Pass the active interest slug so non-sailing interests (e.g. nursing,
  // drawing) don't get the sailing demo races leaked into their view.
  const guestRacesResult = useGuestRaces(currentInterest?.slug);
  const authenticatedRacesResult = useLiveRaces(user?.id);

  // Select the appropriate races based on auth state
  const {
    liveRaces,
    loading: liveRacesLoading,
    isRefreshing: liveRacesRefreshing,
    refresh: refetchRaces,
  } = isGuest
      ? {
        liveRaces: guestRacesResult.liveRaces,
        loading: guestRacesResult.loading,
        isRefreshing: false as boolean,
        refresh: guestRacesResult.refresh,
      }
      : authenticatedRacesResult;

  // Filter races by interest: show sailing regattas for sailing interest,
  // and events matching the active interest's slug for all others.
  // Use currentInterest?.slug directly to avoid the 'sail-racing' fallback in
  // eventConfig when interest hasn't loaded yet, which would show sailing data
  // for non-sailing interests during the loading window.
  const interestSlug = currentInterest?.slug ?? eventConfig.interestSlug;
  const isSailingInterest = interestSlug === 'sail-racing';

  const timelineOrderStorageKey = useMemo(
    () => `timeline_custom_order:${user?.id || 'guest'}:${interestSlug}`,
    [interestSlug, user?.id],
  );
  // Fetch user's timeline steps for the current interest
  const _timelineInterestParam = viewMode === 'domain' && effectiveInterestIds.length > 1 ? effectiveInterestIds : currentInterest?.id;
  const { data: myTimelineSteps } = useMyTimeline(_timelineInterestParam);
  // Backfill: auto-adopt steps for subscriptions that predate the auto-adopt feature
  useAutoAdoptSubscribedSteps(currentInterest?.id, myTimelineSteps);
  // Lookup map: blueprint_id → title (from own + subscribed blueprints)
  const blueprintTitleById = useMemo(() => {
    const map = new Map<string, string>();
    (userBlueprints ?? []).forEach((bp) => { if (bp.id && bp.title) map.set(bp.id, bp.title); });
    (subscribedBlueprints ?? []).forEach((sub) => {
      if (sub.blueprint_id && sub.blueprint_title) map.set(sub.blueprint_id, sub.blueprint_title);
    });
    return map;
  }, [userBlueprints, subscribedBlueprints]);
  const timelineStepCards = useMemo(
    () => {
      if (!myTimelineSteps?.length) return EMPTY_RACES;
      const cards = timelineStepsToCardRaceData(myTimelineSteps);
      return cards.map((card) => {
        const bpId = card.source_blueprint_id;
        const bpTitle = bpId ? blueprintTitleById.get(bpId) : null;
        return bpTitle ? { ...card, blueprintTitle: bpTitle } : card;
      });
    },
    [myTimelineSteps, blueprintTitleById],
  );

  const interestFilteredRaces = useMemo(() => {
    let regattas: any[];
    if (isSailingInterest) {
      // For sailing, show races that either have no interest_slug (legacy) or match sailing
      regattas = (liveRaces ?? EMPTY_RACES).filter((race: any) => {
        const slugTag = race.metadata?.interest_slug;
        return !slugTag || slugTag === 'sail-racing';
      });
    } else {
      // For non-sailing interests, show events whose metadata.interest_slug matches
      if (!liveRaces) {
        regattas = EMPTY_RACES;
      } else {
        const filtered = liveRaces.filter((race: any) => {
          const meta = race.metadata;
          return meta && meta.interest_slug === interestSlug;
        });
        regattas = filtered.length > 0 ? filtered : EMPTY_RACES;
      }
    }

    // Merge timeline steps, deduplicating by id
    if (timelineStepCards.length === 0) return regattas.length > 0 ? regattas : EMPTY_RACES;
    const existingIds = new Set(regattas.map((r: any) => r.id));
    const newSteps = timelineStepCards.filter((s) => !existingIds.has(s.id));
    if (newSteps.length === 0) return regattas.length > 0 ? regattas : EMPTY_RACES;
    // Unified comparator (see lib/races/timelineCompare.ts):
    //   [past dated ASC] | [undated DESC by sort_order] | [future dated ASC]
    // Shared with the grid view so both always show the same sequence.
    const nowMs = Date.now();
    const merged = [...regattas, ...newSteps].sort((a: any, b: any) =>
      compareTimelineItems(a, b, nowMs),
    );
    // Final dedup pass — guard against same ID appearing from multiple sources
    const seen = new Set<string>();
    const result = merged.filter((r: any) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return result;
  }, [liveRaces, isSailingInterest, interestSlug, timelineStepCards]);

  // Track if races have been loaded at least once to prevent flash of demo content
  const hasLoadedRacesOnce = useRef(false);
  useEffect(() => {
    if (!liveRacesLoading && interestFilteredRaces !== undefined) {
      hasLoadedRacesOnce.current = true;
    }
  }, [liveRacesLoading, interestFilteredRaces]);

  // Clear any stale AsyncStorage custom order from previous versions
  useEffect(() => {
    void AsyncStorage.removeItem(timelineOrderStorageKey).catch(() => {});
  }, [timelineOrderStorageKey]);

  const scrollToPosition = useCallback((position: number) => {
    if (!mainScrollViewRef.current) {
      return;
    }

    const target = position > 0 ? Math.max(position - 24, 0) : 0;

    try {
      mainScrollViewRef.current.scrollTo?.({ y: target, animated: true });
    } catch (error) {
      logger.warn('Unable to scroll to position', { position, error });
    }
  }, []);

  const handleShowRegulatoryDigest = useCallback(() => {
    scrollToPosition(regulatorySectionY);
  }, [regulatorySectionY, scrollToPosition]);

  const handleShowRigPlanner = useCallback(() => {
    scrollToPosition(logisticsSectionY);
  }, [logisticsSectionY, scrollToPosition]);

  // handleAddRaceNavigation, handleQuickAddRaceSubmit, handleAddRaceDialogSave
  // are now provided by useAddRace hook

  const handleOpenCalendarImport = useCallback(() => {
    setShowCalendarImport(true);
  }, []);

  const handleManageCrewNavigation = useCallback(
    ({
      raceId,
      classId,
      className,
      raceName,
      raceDate,
    }: {
      raceId: string;
      classId?: string | null;
      className?: string | null;
      raceName?: string | null;
      raceDate?: string | null;
    }) => {
      if (!raceId) {
        logger.warn('handleManageCrewNavigation called without raceId');
        return;
      }

      const params: Record<string, string> = {
        fromRaceId: raceId,
      };

      if (classId) {
        params.classId = String(classId);
      }
      if (className) {
        params.className = String(className);
      }
      if (raceName) {
        params.raceName = String(raceName);
      }
      if (raceDate) {
        params.raceDate = String(raceDate);
      }

      routerRef.current.push({
        pathname: '/(tabs)/crew',
        params,
      });
    },
    []
  );

  // loadUserPostRaceSession, handleOpenPostRaceInterviewManually, and sailorId fetch
  // are now provided by usePostRaceInterview and useSailorProfile hooks

  // Racing area drawing state
  const [drawingRacingArea, setDrawingRacingArea] = useState<Array<{ lat: number, lng: number }>>([]);

  // Combined auth and onboarding check - prevents multiple re-renders
  React.useEffect(() => {
    const checkAuthAndOnboarding = async () => {
      // Wait for auth to be ready
      if (!ready) return;

      // Redirect non-sailor users to their appropriate home page
      // This page is only for sailors
      if (userType === 'club') {
        logger.debug('Club user on races page, redirecting to events');
        routerRef.current.replace('/(tabs)/events');
        return;
      }
      // Note: Coaches are now sailors with coaching capability, so they can access races
      // No redirect needed for coaches anymore

      if (isDemoSession) {
        logger.debug('Demo session detected, skipping Supabase onboarding checks');
        return;
      }

      // First-time/signed-out visitors should enter guest mode instead of being forced to login.
      // This keeps refreshes on /races in the guest experience.
      // BUT if the user was previously authenticated (token expired), don't enter guest mode —
      // the AuthProvider already redirects to landing/login, and entering guest mode would
      // wipe React Query cache (RLS-blocked refetches overwrite cached data with nulls).
      if (!signedIn && !isGuest && ready && !wasAuthenticated) {
        logger.debug('User not authenticated on /races, entering guest mode');
        enterGuestMode();
        return;
      }

      // If not ready or signed out but not ready, don't redirect yet
      // This prevents redirecting to login during sign-out process
      if (!signedIn && !ready) {
        logger.debug('Auth not ready yet, skipping redirect');
        return;
      }

      // Check onboarding status
      if (!user?.id) return;

      try {
        const { data: userData } = await supabase
          .from('users')
          .select('onboarding_completed, user_type')
          .eq('id', user.id)
          .single();

        logger.debug('User onboarding status:', userData);

        // If no user type selected, redirect to persona selection
        if (!userData?.user_type && !hasAssignedFallbackRole.current) {
          logger.debug('No user type, assigning sailor persona fallback');
          hasAssignedFallbackRole.current = true;
          try {
            await supabase
              .from('users')
              .update({
                user_type: 'sailor',
                onboarding_completed: true,
              })
              .eq('id', user.id);
            await fetchUserProfileRef.current?.(user.id);
          } catch (assignError) {
            logger.error('Unable to assign default persona:', assignError);
          }
        }
      } catch (error) {
        logger.error('Error checking onboarding status:', error);
      }
    };

    checkAuthAndOnboarding();
  }, [ready, signedIn, isGuest, user?.id, isDemoSession, userType, enterGuestMode]);

  // Fetch data from API
  const {
    profile,
    nextRace,
    recentRaces,
    recentTimerSessions,
    performanceHistory,
    boats,
    fleets,
    loading,
    error,
    refreshing,
    onRefresh,
    refetch
  } = useDashboardData();

  // Log dashboard errors only when they change (not on every render)
  useEffect(() => {
    if (error && !isAbortError(error)) {
      logger.error('Dashboard error:', error?.message || error, { name: error?.name });
    }
  }, [error]);

  // Refetch races when dashboard comes into focus (after navigation back from race creation)
  // Skip the initial mount to prevent unnecessary refetch.
  // Use refs for refetch/refetchRaces to keep the callback identity stable and avoid
  // useFocusEffect re-running on every render (which caused an infinite render loop).
  const isInitialMount = useRef(true);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const refetchRacesRef = useRef(refetchRaces);
  refetchRacesRef.current = refetchRaces;
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      logger.debug('Screen focused - refetching races');
      refetchRef.current?.();
      refetchRacesRef.current?.(); // Also refresh live races list
      if (selectedRaceId) {
        logger.debug('Screen focused - refreshing selected race detail');
        triggerRaceDetailReload();
      }
    }, [selectedRaceId, triggerRaceDetailReload])
  );

  // GPS Venue Detection
  const { currentVenue, isDetecting, confidence, error: venueError } = useVenueDetection();

  // Venue AI Insights (extracted to useVenueInsights hook)
  const {
    venueInsights,
    loadingInsights,
    showInsights,
    handleGetVenueInsights,
    handleDismissInsights,
  } = useVenueInsights({
    currentVenue,
    confidence,
  });

  // Offline support
  const { isOnline, cacheNextRace } = useOffline();

  // Enrich races with real weather data
  // Use stable empty array fallback to avoid creating a new reference each render
  const racesForEnrichment = interestFilteredRaces || EMPTY_RACES;
  const { races: enrichedRaces, loading: weatherEnrichmentLoading } = useEnrichedRaces(racesForEnrichment);

  // Social timeline: get all timelines (current user + followed users)
  const { allTimelines, isLoading: loadingFollowedTimelines } = useFollowedTimelines(enrichedRaces);
  // allTimelines[0] is always the current user - check if there are OTHER users to browse
  const hasFollowedUsers = allTimelines.length > 1;

  // Timeline switching state - 0 is your timeline, 1+ are followed users
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState(0);
  const currentTimeline = allTimelines[currentTimelineIndex] || allTimelines[0];
  const isViewingOtherTimeline = currentTimelineIndex > 0 && currentTimeline?.user?.isCurrentUser === false;

  // Race list data (extracted to useRaceListData hook)
  const {
    pastRaceIds,
    normalizedLiveRaces,
    safeRecentRaces,
    safeNextRace,
    nextActionItem,
    nextRacePreview,
    hasRealRaces,
    recentRace,
  } = useRaceListData({
    liveRaces: interestFilteredRaces,
    enrichedRaces,
    recentRaces: isSailingInterest ? recentRaces : EMPTY_RACES,
  });

  // Track if we're showing the demo race (no real races)
  const isShowingDemoRace = safeRecentRaces.length === 0;

  // Note: Auto-seeding of sample data was removed in favor of the client-side
  // demo race card. New users see an empty-state prompt with a single demo race
  // they can explore, rather than having fake data inserted into their account.

  // Fetch user results for past races
  const { results: userRaceResults } = useUserRaceResults(user?.id, pastRaceIds);

  // Fetch practice sessions for timeline
  const { upcomingSessions: practiceSessions } = usePracticeSessions();

  // Real-time weather for next race
  const { weather: raceWeather, loading: weatherLoading, error: weatherError } = useRaceWeather(
    currentVenue,
    nextRace?.date
  );

  // AI Venue Analysis state/handlers now provided by useVenueInsights hook above

  // Total race count (real or demo) for header
  const displayRaceCount = hasRealRaces ? safeRecentRaces.length : MOCK_RACES.length;

  // Count upcoming items (start date in the future) — includes both races and steps
  const upcomingRacesCount = useMemo(() => {
    const now = new Date();
    return safeRecentRaces.filter((race: any) => {
      const raceDate = new Date(race.start_date || race.date);
      return raceDate > now;
    }).length;
  }, [safeRecentRaces]);

  // headerTotalRaces and headerCurrentRaceIndex are computed later
  // (after filteredCardGridRaces) so they reflect the sorted card order.

  // Jump-to navigation handler — switches to a race/step by id.
  // The picker iterates the unified `orderedBaseCardGridRaces` list (steps + regattas),
  // so this works for both timeline steps and regatta cards.
  const handleGoToStep = useCallback((stepId: string) => {
    setSelectedRaceId(stepId);
    setHasManuallySelected(true);
  }, []);

  // Season-filtered race counts for display in header
  // When a season filter is active, show only races in that season
  const seasonFilteredRaces = useMemo(() => {
    if (!activeFilterSeasonId) {
      // "All Races" mode or no season filter - return all races
      return safeRecentRaces;
    }
    // Filter races that belong to the selected filter season
    return safeRecentRaces.filter((race: any) => {
      // Timeline steps without a season always pass through
      if (race.isTimelineStep && !race.season_id) {
        return true;
      }
      // Check if race has season_id matching the filter season (race_events)
      if (race.season_id === activeFilterSeasonId ||
          race.metadata?.season_id === activeFilterSeasonId) {
        return true;
      }
      // Check if regatta is linked to the season via season_regattas table
      if (seasonRegattaIds.has(race.id)) {
        return true;
      }
      return false;
    });
  }, [safeRecentRaces, activeFilterSeasonId, seasonRegattaIds]);

  const seasonFilteredRacesCount = seasonFilteredRaces.length;

  const seasonUpcomingRacesCount = useMemo(() => {
    const now = new Date();
    return seasonFilteredRaces.filter((race: any) => {
      const raceDate = new Date(race.start_date || race.date);
      return raceDate > now;
    }).length;
  }, [seasonFilteredRaces]);

  const seasonToolbarLabel = useMemo(() => {
    if (!activeFilterSeasonId) {
      return `All ${pluralize(eventConfig.eventNoun)}`;
    }
    return (displaySeason as any)?.short_name || displaySeason?.name || undefined;
  }, [activeFilterSeasonId, displaySeason, eventConfig.eventNoun]);

  const selectedDemoRace = useMemo(
    () => selectedDemoRaceId ? MOCK_RACES.find(race => race.id === selectedDemoRaceId) ?? null : null,
    [selectedDemoRaceId]
  );

  // ==========================================================================
  // CARD GRID NAVIGATION (Feature Flag)
  // ==========================================================================

  // Calculate card dimensions for CardGrid
  const cardGridDimensions = useMemo(
    () => calculateCardDimensions(SCREEN_WIDTH, SCREEN_HEIGHT),
    [SCREEN_WIDTH, SCREEN_HEIGHT]
  );

  // Base race data for CardGrid (without detailed enrichment)
  // This is used initially; enrichment happens in cardGridRacesEnriched below
  // When no races exist, show a demo race so users can explore the UI
  // When viewing another user's timeline, use their races instead
  const baseCardGridRaces: CardRaceData[] = useMemo(() => {
    // When viewing another user's timeline, use their races
    const racesToShow = isViewingOtherTimeline && currentTimeline?.races
      ? currentTimeline.races
      : safeRecentRaces;

    // If no races and sample race not dismissed (only for own timeline), show demo data
    // Skip sample data if user has subscribed blueprints — the FOR YOU section provides real content
    const hasSubscriptions = (subscribedBlueprints ?? []).length > 0;
    if (racesToShow.length === 0 && !sampleRaceDismissed && !isViewingOtherTimeline && !hasSubscriptions) {
      // For interests with demo timeline steps, show those instead of a race card
      const demoSteps = getDemoTimelineSteps(eventConfig.interestSlug);
      if (demoSteps) return demoSteps;

      const demoIso = getDemoRaceStartDateISO(7, 11, 0);
      const demoEvent = getDemoEvent(eventConfig.interestSlug, eventConfig.eventNoun);
      const isSailing = eventConfig.interestSlug === 'sail-racing';
      return [{
        id: DEMO_RACE.id || 'demo-race',
        name: demoEvent.name || `Sample ${eventConfig.eventNoun}`,
        venue: demoEvent.venue || vocab('Institution'),
        date: DEMO_RACE.date || demoIso,
        startTime: DEMO_RACE.startTime || getDemoRaceStartTimeLabel(11, 0),
        boatClass: isSailing ? 'Your Boat Class' : undefined,
        race_type: (eventConfig.defaultSubtype || 'fleet') as const,
        isDemo: true,
        vhf_channel: isSailing ? 'Ch 72' : undefined,
        // Sample weather data (sailing-specific fields only when relevant)
        boat_id: isSailing ? 'demo-boat-j70' : undefined,
        class_id: isSailing ? 'demo-class-j70' : undefined,
        wind: isSailing ? { direction: 'NE', speedMin: 12, speedMax: 18 } : undefined,
        tide: isSailing ? { state: 'flooding' as const, height: 1.8, direction: 'NW' } : undefined,
        // Sample regulatory documents (sailing only)
        regulatory: isSailing ? {
          documents: [
            { id: 'demo-nor', name: 'Notice of Race', type: 'nor', uploadedAt: new Date().toISOString() },
            { id: 'demo-si', name: 'Sailing Instructions', type: 'si', uploadedAt: new Date().toISOString() },
            { id: 'demo-course', name: 'Course Layout', type: 'course', uploadedAt: new Date().toISOString() },
          ],
          vhfChannel: 'Ch 72',
          protestDeadline: '30 min after finish',
        } : undefined,
        // Sample fleet/group info (sailing only)
        fleet: isSailing ? {
          totalCompetitors: 24,
          fleetName: 'Main Fleet',
          isRegistered: false,
        } : undefined,
        // No created_by so delete/edit menu won't appear
      }];
    }

    const mapped = racesToShow.map((race: any) => ({
      ...(timelineStatusOverrides[race.id] ? {
        status: timelineStatusOverrides[race.id].status,
        start_date: timelineStatusOverrides[race.id].startDateIso,
        start_time: timelineStatusOverrides[race.id].startDateIso,
      } : null),
      id: race.id,
      name: race.name || race.race_name || `Unnamed ${eventConfig.eventNoun}`,
      venue: race.venue || race.venue_name,
      status: timelineStatusOverrides[race.id]?.status || race.status,
      date: timelineStatusOverrides[race.id]?.startDateIso || race.start_date || race.date || (race.isTimelineStep ? undefined : new Date().toISOString()),
      startTime: timelineStatusOverrides[race.id]?.startTimeLabel || race.start_time || race.startTime,
      boatClass: race.boat_class || race.boatClass,
      vhf_channel: race.vhf_channel || race.critical_details?.vhf_channel,
      race_type: race.race_type, // Preserve race type (fleet, distance, match, team)
      time_limit_hours: race.time_limit_hours, // Distance race duration
      wind: race.wind,
      tide: race.tide,
      waves: race.waves,
      temperature: race.temperature || race.waterTemperature,
      critical_details: race.critical_details,
      venueCoordinates: race.venueCoordinates,
      created_by: race.created_by,
      metadata: race.metadata, // Preserve metadata for sample detection
      notice_of_race_url: race.notice_of_race_url, // Source document URL from AI extraction
      expected_fleet_size: race.expected_fleet_size,
      boat_id: race.boat_id || race.boatId,
      class_id: race.class_id || race.classId,
      // Basic defaults for new cards (will be enriched for selected race later)
      rigSettings: race.rigSettings || race.tuningRecommendation,
      fleet: race.fleet || {
        totalCompetitors: race.competitor_count || race.entry_count || 0,
        fleetName: race.fleet_name,
        isRegistered: race.is_registered,
      },
      regulatory: race.regulatory || {
        documents: race.documents || [],
        vhfChannel: race.vhf_channel || race.critical_details?.vhf_channel,
        protestDeadline: race.protest_deadline || race.critical_details?.protest_deadline,
      },
      // Timeline step fields — pass through so detail view can distinguish steps from regattas
      ...(race.isTimelineStep ? {
        isTimelineStep: true,
        stepStatus: timelineStatusOverrides[race.id]?.status || race.stepStatus,
        sort_order: race.sort_order,
        description: race.description,
        due_at: race.due_at,
        completed_at: race.completed_at,
        // Provenance fields for StepProvenanceBanner
        source_type: race.source_type,
        source_blueprint_id: race.source_blueprint_id,
        copied_from_user_id: race.copied_from_user_id,
      } : null),
    }));

    // Unified comparator — same rules as the primary merge sort above.
    const nowMsMapped = Date.now();
    mapped.sort((a: any, b: any) => compareTimelineItems(a, b, nowMsMapped));
    return mapped;
  }, [safeRecentRaces, sampleRaceDismissed, isViewingOtherTimeline, currentTimeline, timelineStatusOverrides, eventConfig.interestSlug, eventConfig.eventNoun, eventConfig.defaultSubtype, subscribedBlueprints]);

  // Use the chronological order from baseCardGridRaces (which comes from
  // interestFilteredRaces sorted by: completed first, then date, then sort_order).
  // The reorder mode persists sort_order to the DB, so the chronological sort
  // naturally picks up reordered positions as tie-breakers within same-date items.
  const orderedBaseCardGridRaces: CardRaceData[] = baseCardGridRaces;

  const handleTimelineGridReorder = useCallback(async (orderedRaceIds: string[]) => {
    if (isViewingOtherTimeline) return;
    const byId = new Map(baseCardGridRaces.map((race) => [race.id, race]));
    const deduped: string[] = [];
    for (const id of orderedRaceIds) {
      if (!byId.has(id) || deduped.includes(id)) continue;
      deduped.push(id);
    }

    // Persist sort_order to the correct table per id. Steps go to
    // timeline_steps; regattas go to regattas. sort_order is the primary
    // sort key everywhere, so this assignment fully determines visual order.
    const updates = deduped.map((id, idx) => {
      const row = byId.get(id);
      return {
        id,
        sort_order: idx + 1,
        table: row?.isTimelineStep ? 'timeline_steps' as const : 'regattas' as const,
      };
    });

    Promise.all(
      updates.map(({ id, sort_order, table }) =>
        supabase.from(table).update({ sort_order }).eq('id', id)
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      // useLiveRaces is a custom realtime hook (not React Query), so refetch
      // its loader directly to pick up regatta sort_order updates.
      void refetchRaces?.();
    }).catch((err) => {
      console.error('[Reorder] DB persistence failed:', err);
    });
  }, [baseCardGridRaces, isViewingOtherTimeline, queryClient, refetchRaces]);

  // Move a step one position earlier or later in the custom order
  const handleMoveStep = useCallback((raceId: string, direction: 'earlier' | 'later') => {
    if (isViewingOtherTimeline) return;
    const currentOrder = orderedBaseCardGridRaces.map((r) => r.id);
    const idx = currentOrder.indexOf(raceId);
    if (idx < 0) return;
    const swapIdx = direction === 'earlier' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= currentOrder.length) return;
    const next = [...currentOrder];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    void handleTimelineGridReorder(next);
  }, [orderedBaseCardGridRaces, isViewingOtherTimeline, handleTimelineGridReorder]);

  const handleMoveStepEarlier = useCallback((raceId: string) => handleMoveStep(raceId, 'earlier'), [handleMoveStep]);
  const handleMoveStepLater = useCallback((raceId: string) => handleMoveStep(raceId, 'later'), [handleMoveStep]);

  // Calculate current season week (ISO week number with 'W' prefix)
  const currentSeasonWeek = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `W${weekNumber}`;
  }, []);

  const applyTimelineStepStatus = useCallback(async (
    raceId: string,
    status: 'completed' | 'pending',
    opts?: {indexHint?: number}
  ) => {
    const race = orderedBaseCardGridRaces.find((entry) => entry.id === raceId);
    const nowIso = new Date().toISOString();
    if (race?.isTimelineStep) {
      const stepPayload: Record<string, unknown> = {
        status,
        completed_at: status === 'completed' ? nowIso : null,
      };
      const { error } = await supabase
        .from('timeline_steps')
        .update(stepPayload)
        .eq('id', raceId)
        .select('id')
        .single();
      if (error) {
        throw new Error('Failed to update step timeline status');
      }
    } else {
      // Legacy race_events / regattas path — keep date manipulation for non-step items
      const idx = opts?.indexHint ?? 0;
      const nowMs = Date.now();
      const rawDate = race?.start_date || race?.date || race?.startTime;
      const parsed = rawDate ? new Date(rawDate) : null;
      const existingMs = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null;
      const nextMs =
        status === 'completed'
          ? Math.min(existingMs ?? Number.MAX_SAFE_INTEGER, nowMs - (idx + 1) * 60 * 1000)
          : Math.max(existingMs ?? 0, nowMs + (idx + 1) * 2 * 60 * 60 * 1000);
      const nextStart = new Date(nextMs).toISOString();
      const eventDate = nextStart.slice(0, 10);

      const sourceRaw = String(race?._source || race?.source || race?.source_table || '').toLowerCase();
      const primaryTable: 'race_events' | 'regattas' = sourceRaw.includes('race_event') ? 'race_events' : 'regattas';
      const fallbackTable: 'race_events' | 'regattas' = primaryTable === 'race_events' ? 'regattas' : 'race_events';

      const tryUpdate = async (table: 'race_events' | 'regattas') => {
        const initialPayload = table === 'race_events'
          ? { event_date: eventDate, start_time: nextStart }
          : { start_date: nextStart };
        const initialResult = await supabase
          .from(table)
          .update(initialPayload as any)
          .eq('id', raceId)
          .select('id')
          .maybeSingle();
        if (!initialResult.error) {
          return initialResult;
        }

        if (
          table === 'race_events' &&
          isMissingSupabaseColumn(initialResult.error, 'race_events.start_time')
        ) {
          const fallbackPayload = { event_date: eventDate };
          return await supabase
            .from(table)
            .update(fallbackPayload as any)
            .eq('id', raceId)
            .select('id')
            .maybeSingle();
        }

        return initialResult;
      };

      const primary = await tryUpdate(primaryTable);
      if (!primary.data?.id) {
        const fallback = await tryUpdate(fallbackTable);
        if (!fallback.data?.id) {
          throw primary.error || fallback.error || new Error('Failed to update step timeline status');
        }
      }
    }

    const displayStatus = status === 'pending' ? 'pending' : status;
    setTimelineStatusOverrides((prev) => ({
      ...prev,
      [raceId]: {
        status: displayStatus,
        startDateIso: race?.start_date || race?.date || nowIso,
        startTimeLabel: race?.startTime || race?.start_time || '',
      },
    }));

    setSelectedRaceData((prev: any) => {
      if (!prev || prev.id !== raceId) return prev;
      return {
        ...prev,
        status: displayStatus,
        completed_at: status === 'completed' ? nowIso : null,
        metadata: {
          ...(prev.metadata && typeof prev.metadata === 'object' ? prev.metadata : {}),
          status: displayStatus,
        },
      };
    });
  }, [orderedBaseCardGridRaces]);

  const handleMoveStepToPlannedNext = useCallback((raceId: string) => {
    if (!raceId) return;
    void (async () => {
      try {
        await applyTimelineStepStatus(raceId, 'pending');
        await refetchRacesRef.current?.();
      } catch (error: any) {
        showAlert('Update failed', error?.message || 'Could not mark this step not done.');
      }
    })();
  }, [applyTimelineStepStatus]);

  const handleMoveStepToCompletedMostRecent = useCallback((raceId: string) => {
    if (!raceId) return;
    void (async () => {
      try {
        await applyTimelineStepStatus(raceId, 'completed');
        await refetchRacesRef.current?.();
      } catch (error: any) {
        showAlert('Update failed', error?.message || 'Could not mark this step done.');
      }
    })();
  }, [applyTimelineStepStatus]);

  const handleTimelineGridBulkStatusUpdate = useCallback(async (
    raceIds: string[],
    status: 'completed' | 'pending'
  ) => {
    if (raceIds.length === 0) return;
    try {
      await Promise.all(
        raceIds.map((raceId, idx) => applyTimelineStepStatus(raceId, status, { indexHint: idx }))
      );
      await refetchRacesRef.current?.();
    } catch (error: any) {
      showAlert('Bulk update failed', error?.message || 'Could not update selected steps.');
    }
  }, [applyTimelineStepStatus]);

  const handleSetDueDate = useCallback(async (raceId: string, dateIso: string | null) => {
    const race = orderedBaseCardGridRaces.find((entry) => entry.id === raceId);
    if (!race?.isTimelineStep) return;
    try {
      const { error } = await supabase
        .from('timeline_steps')
        .update({ due_at: dateIso })
        .eq('id', raceId);
      if (error) throw error;
      await refetchRacesRef.current?.();
    } catch (error: any) {
      showAlert('Update failed', error?.message || 'Could not set due date.');
    }
  }, [orderedBaseCardGridRaces]);

  // Pending-step ref and its stable setter. Declared before renderCardGridContent
  // because it references handleNextStepCreatedForCard in its dep array — must
  // be initialized first to avoid a TDZ error on render.
  const pendingNewStepIdRef = useRef<string | null>(null);
  const handleNextStepCreatedForCard = useCallback((newStepId: string) => {
    pendingNewStepIdRef.current = newStepId;
  }, []);

  // Render card content for CardGrid
  const renderCardGridContent = useCallback(
    (
      race: CardRaceData,
      cardType: CardType,
      isActive: boolean,
      canManage: boolean,
      onEdit?: () => void,
      onDelete?: () => void,
      onUploadDocument?: () => void,
      onRaceComplete?: (sessionId: string, raceName: string, raceId: string) => void,
      onOpenPostRaceInterview?: () => void,
      userId?: string,
      onDismiss?: () => void,
      raceIndex?: number,
      totalRaces?: number,
      // Timeline navigation props
      _timelineRaces?: any[],
      _currentRaceIndex?: number,
      _onSelectRace?: (index: number) => void,
      nextRaceIndex?: number,
      // Handler for card press (navigation to this card when clicking partially visible cards)
      onCardPress?: () => void,
      // Refetch trigger for AfterRaceContent
      refetchTrigger?: number
    ) => {
      const ContentComponent = getCardContentComponent(cardType);
      return (
        <ContentComponent
          race={race}
          cardType={cardType}
          isActive={isActive}
          dimensions={cardGridDimensions}
          canManage={canManage}
          onEdit={onEdit}
          onDelete={onDelete}
          onUploadDocument={onUploadDocument}
          onRaceComplete={onRaceComplete}
          onOpenPostRaceInterview={onOpenPostRaceInterview}
          userId={userId}
          onDismiss={onDismiss}
          seasonWeek={currentSeasonWeek}
          raceNumber={raceIndex !== undefined ? raceIndex + 1 : undefined}
          totalRaces={totalRaces}
          nextRaceIndex={nextRaceIndex}
          onCardPress={onCardPress}
          refetchTrigger={refetchTrigger}
          onContentScroll={handleToolbarScroll}
          onMoveStepEarlier={canManage ? handleMoveStepEarlier : undefined}
          onMoveStepLater={canManage ? handleMoveStepLater : undefined}
          onMoveStepToPlannedNext={canManage ? handleMoveStepToPlannedNext : undefined}
          onMoveStepToCompletedMostRecent={canManage ? handleMoveStepToCompletedMostRecent : undefined}
          onSetDueDate={canManage ? handleSetDueDate : undefined}
          onNextStepCreated={handleNextStepCreatedForCard}
        />
      );
    },
    [cardGridDimensions, currentSeasonWeek, handleMoveStepEarlier, handleMoveStepLater, handleMoveStepToCompletedMostRecent, handleMoveStepToPlannedNext, handleSetDueDate, handleToolbarScroll, handleNextStepCreatedForCard]
  );

  // Handle race change from CardGrid
  const handleCardGridRaceChange = useCallback(
    (index: number, race: CardRaceData) => {
      setHasManuallySelected(true);
      setSelectedRaceId(race.id);
    },
    []
  );

  // Handle card (vertical) change from CardGrid
  const handleCardGridCardChange = useCallback(
    (cardType: CardType, cardIndex: number) => {
      logger.debug('Card changed:', { cardType, cardIndex });
    },
    []
  );

  // Active race summary (extracted to useActiveRaceSummary hook)
  const { activeRace } = useActiveRaceSummary({
    selectedRaceData,
    nextRace,
    selectedDemoRace,
    currentVenue,
  });

  // Race brief data (extracted to useRaceBriefData hook)
  const { raceBrief } = useRaceBriefData({
    activeRace,
    raceWeather,
    selectedRaceData,
    nextRace,
    selectedDemoRace,
  });

  // Sync race brief data to preparation service for AI context
  useEffect(() => {
    if (raceBrief && selectedRaceData?.id) {
      updateRaceBrief(raceBrief);
    }
  }, [raceBrief, selectedRaceData?.id]);

  // Use race brief sync for AI chat integration
  const { getAIContext, isStale: isRaceBriefStale, refreshContext } = useRaceBriefSync({
    regattaId: selectedRaceData?.id || null,
    raceBrief,
    enabled: true,
  });

  // Compute derived race preparation data
  const {
    rigPresets,
    isGenericDefaults: isGenericDefaultsFromMetadata,
    regulatoryDigest,
    courseOutlineGroups,
    hasStrategyGenerated,
    hasPostAnalysis,
    hasCrewReady,
    hasRegulatoryAcknowledged,
  } = useRacePreparationData({
    selectedRaceData,
    selectedRaceMarks,
    regattaAcknowledgements,
    activeRace,
  });

  // Sync state from race metadata
  useEffect(() => {
    if (!selectedRaceData) {
      setSelectedRigBand(null);
      setRigNotes('');
      setRegattaAcknowledgements({
        cleanRegatta: false,
        signOn: false,
        safetyBriefing: false,
      });
      return;
    }

    const metadata = (selectedRaceData.metadata || {}) as Record<string, any>;
    if (metadata.selected_rig_band) {
      setSelectedRigBand(metadata.selected_rig_band);
    } else {
      setSelectedRigBand(null);
    }
    if (typeof metadata.rig_notes === 'string') {
      setRigNotes(metadata.rig_notes);
    } else {
      setRigNotes('');
    }

    setRegattaAcknowledgements({
      cleanRegatta: metadata.clean_regatta_ack === true,
      signOn: metadata.sign_on_ack === true,
      safetyBriefing: metadata.safety_briefing_ack === true,
    });
  }, [selectedRaceData]);

  useEffect(() => {
    if (!rigPresets.length) {
      return;
    }

    if (selectedRigBand && rigPresets.some((preset) => preset.id === selectedRigBand)) {
      return;
    }

    const fallback = rigPresets.find((preset) => preset.id === 'medium') || rigPresets[0];
    setSelectedRigBand(fallback.id);
  }, [rigPresets, selectedRigBand]);

  // Status flags (hasStrategyGenerated, hasPostAnalysis, hasCrewReady, hasRegulatoryAcknowledged)
  // are now provided by useRacePreparationData hook above

  // Determine race status (past, next, future)
  const getRaceStatus = (raceDate: string, isNextRace: boolean, raceStartTime?: string): 'past' | 'next' | 'future' => {
    if (isNextRace) return 'next';

    // Compare full datetime including time to correctly identify past races
    const now = new Date();
    const raceDateTime = new Date(raceDate);

    // If we have a start time, use it for more accurate comparison
    if (raceStartTime && typeof raceStartTime === 'string') {
      const timeParts = raceStartTime.split(':');
      if (timeParts.length >= 2) {
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
          raceDateTime.setHours(hours, minutes, 0, 0);
        }
      }
    }

    // Race is "past" if estimated end time (start + 3 hours) has passed
    const raceEndEstimate = new Date(raceDateTime.getTime() + 3 * 60 * 60 * 1000);
    if (raceEndEstimate < now) return 'past';

    return 'future';
  };

  // handleRaceComplete and handlePostRaceInterviewComplete are now provided by usePostRaceInterview hook

  const handleOpenChatFromRigPlanner = useCallback(async () => {
    try {
      // Get AI context with race preparation data before opening chat
      const context = await getAIContext('rig_planning');

      // TODO: Pass context to chat/messages screen via route params or global state
      // For now, just navigate to messages - the chat will use useRaceBriefSync to get context
      routerRef.current.push('/messages' as any);

      logger.info('Opened chat with race context', {
        hasContext: !!context,
        isStale: isRaceBriefStale,
      });
    } catch (error) {
      logger.warn('Unable to navigate to chat from rig planner', error);
    }
  }, [getAIContext, isRaceBriefStale]);

  const handleToggleAcknowledgement = useCallback((key: keyof RegulatoryAcknowledgements) => {
    toggleAcknowledgement(key);
  }, [toggleAcknowledgement]);

  const handleEditRace = useCallback((raceId: string) => {
    if (!raceId) return;

    try {
      if (currentInterest?.slug === 'nursing') {
        routerRef.current.push(`/(tabs)/race/add-tufte?editId=${raceId}`);
        return;
      }
      routerRef.current.push(`/race/edit/${raceId}`);
    } catch (error) {
      logger.error('Error navigating to edit race:', error);
    }
  }, [currentInterest?.slug]);

  // Navigate to the comprehensive edit flow for the selected race
  const handleEditSelectedRace = useCallback(() => {
    if (!selectedRaceId) return;
    handleEditRace(selectedRaceId);
  }, [handleEditRace, selectedRaceId]);

  // Practice session handlers
  const handleSelectPractice = useCallback((sessionId: string) => {
    routerRef.current.push({
      pathname: '/practice/[id]',
      params: { id: sessionId },
    });
  }, []);

  const handleAddPractice = useCallback(async () => {
    if (!user?.id || !currentInterest?.id) return;

    try {
      const practiceLabel = vocab('Practice');
      const newStep = await createTimelineStep({
        user_id: user.id,
        interest_id: currentInterest.id,
        title: `New ${practiceLabel}`,
        category: 'practice',
        status: 'pending',
        metadata: { plan: {}, act: {}, review: {} },
      });

      // Set step data directly so StepDetailContent renders immediately
      // Mark the ref so the fetch effect doesn't overwrite our data
      skipFetchForStepRef.current = newStep.id;
      setSelectedRaceId(newStep.id);
      setSelectedRaceData({
        id: newStep.id,
        name: newStep.title,
        date: newStep.due_at || undefined,
        isTimelineStep: true,
        stepStatus: 'pending',
        status: 'pending',
        metadata: newStep.metadata,
      });
      setHasManuallySelected(true);
      setIsGridView(false);

      // Refetch in background so the step appears in the card grid
      queryClient.refetchQueries({ queryKey: ['timeline-steps'] });
    } catch (err) {
      console.error('Failed to create practice step:', err);
      showAlert('Error', 'Failed to create practice session. Please try again.');
    }
  }, [user?.id, currentInterest?.id, vocab, queryClient]);

  // Quick-create a timeline step — optionally pre-filled from a template
  const handleAddStep = useCallback(async () => {
    if (!user?.id || !currentInterest?.id) return;

    // ---------------------------------------------------------------------
    // Optimistic add: the card appears instantly under a `temp-` id, then
    // the RPC runs in the background. On success we swap the temp row for
    // the server row in every cache (and re-point selection/refs) so the
    // user never sees a blank moment while supabase is round-tripping.
    // On slow-network warnings (30s supabase timeout), the old implementation
    // made the user wait the full latency before any UI changed.
    // ---------------------------------------------------------------------
    const interestId = currentInterest.id;
    const tempId = `temp-${
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    }`;
    const nowIso = new Date().toISOString();
    // Matches the RPC's epoch-delta-seconds sort_order so the optimistic
    // row slots into the same place the server row will.
    const EPOCH_2024 = Date.UTC(2024, 0, 1) / 1000;
    const optimisticSortOrder = Math.floor(Date.now() / 1000 - EPOCH_2024);
    const optimisticMetadata: Record<string, unknown> = {
      plan: {},
      act: {},
      review: {},
      brain_dump: {
        raw_text: '',
        extracted_urls: [],
        extracted_people: [],
        extracted_topics: [],
        created_at: nowIso,
      },
      // Marks the title as an auto-generated placeholder so RaceSummaryCard
      // can render the "Tap to name this step" hint. Cleared on first edit.
      _placeholder_title: true,
    };
    const optimisticStep: TimelineStepRecord = {
      id: tempId,
      user_id: user.id,
      interest_id: interestId,
      organization_id: null,
      program_session_id: null,
      source_type: 'manual',
      source_id: null,
      title: 'Untitled',
      description: null,
      category: 'general',
      status: 'pending',
      starts_at: null,
      ends_at: null,
      location_name: null,
      location_lat: null,
      location_lng: null,
      location_place_id: null,
      visibility: 'followers',
      share_approximate_location: false,
      copied_from_user_id: null,
      source_blueprint_id: null,
      sort_order: optimisticSortOrder,
      metadata: optimisticMetadata,
      collaborator_user_ids: [],
      completed_at: null,
      due_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const matchesMineQuery = (query: { queryKey: readonly unknown[] }) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key.length < 3) return false;
      if (key[0] !== 'timeline-steps' || key[1] !== 'mine') return false;
      const interestParam = key[2];
      if (interestParam === 'all') return true;
      if (typeof interestParam === 'string') {
        return interestParam.split(',').includes(interestId);
      }
      return false;
    };

    // Insert the synthetic row into every matching list cache, prime the
    // detail cache, and select the card — all before the network call.
    queryClient.setQueriesData<TimelineStepRecord[]>(
      { predicate: matchesMineQuery },
      (old) => {
        if (!old) return old;
        if (old.some((s) => s.id === tempId)) return old;
        // Append, not prepend: undated steps sort to the tail of the
        // carousel (next to TODAY), and the auto-scroll target derives
        // its index from this same list.
        return [...old, optimisticStep];
      },
    );
    queryClient.setQueryData(['timeline-steps', 'detail', tempId], optimisticStep);

    skipFetchForStepRef.current = tempId;
    setSelectedRaceId(tempId);
    setSelectedRaceData({
      id: tempId,
      name: optimisticStep.title,
      date: undefined,
      isTimelineStep: true,
      stepStatus: 'pending',
      status: 'pending',
      metadata: optimisticMetadata,
    });
    setHasManuallySelected(true);
    setIsGridView(false);
    pendingNewStepIdRef.current = tempId;

    try {
      const newStep = await createTimelineStep({
        user_id: user.id,
        interest_id: interestId,
        title: 'Untitled',
        category: 'general',
        status: 'pending',
        metadata: optimisticMetadata,
      });

      // Swap temp row → server row in list caches (by id).
      queryClient.setQueriesData<TimelineStepRecord[]>(
        { predicate: matchesMineQuery },
        (old) => {
          if (!old) return old;
          const hasTemp = old.some((s) => s.id === tempId);
          const hasReal = old.some((s) => s.id === newStep.id);
          if (!hasTemp) return hasReal ? old : [...old, newStep];
          return old.map((s) => (s.id === tempId ? newStep : s));
        },
      );
      queryClient.removeQueries({ queryKey: ['timeline-steps', 'detail', tempId] });
      queryClient.setQueryData(['timeline-steps', 'detail', newStep.id], newStep);

      // Re-point selection and scroll refs to the real id — but only if the
      // user hasn't manually navigated away from the temp card in the meantime.
      setSelectedRaceId((prev) => (prev === tempId ? newStep.id : prev));
      setSelectedRaceData((prev) =>
        prev?.id === tempId
          ? {
              id: newStep.id,
              name: newStep.title,
              date: newStep.due_at || undefined,
              isTimelineStep: true,
              stepStatus: 'pending',
              status: 'pending',
              metadata: newStep.metadata,
            }
          : prev,
      );
      if (pendingNewStepIdRef.current === tempId) {
        pendingNewStepIdRef.current = newStep.id;
      }
      if (skipFetchForStepRef.current === tempId) {
        skipFetchForStepRef.current = newStep.id;
      }
    } catch (err) {
      console.error('Failed to create step:', err);
      // Roll back optimistic insert so the ghost card disappears.
      queryClient.setQueriesData<TimelineStepRecord[]>(
        { predicate: matchesMineQuery },
        (old) => (old ? old.filter((s) => s.id !== tempId) : old),
      );
      queryClient.removeQueries({ queryKey: ['timeline-steps', 'detail', tempId] });
      setSelectedRaceId((prev) => (prev === tempId ? null : prev));
      setSelectedRaceData((prev) => (prev?.id === tempId ? null : prev));
      if (pendingNewStepIdRef.current === tempId) {
        pendingNewStepIdRef.current = null;
      }
      if (skipFetchForStepRef.current === tempId) {
        skipFetchForStepRef.current = null;
      }
      showAlert('Error', 'Failed to create step. Please try again.');
    }
  }, [user?.id, currentInterest?.id, queryClient]);

  // Quick-create a race day checklist step, auto-dated from the nearest upcoming race
  const handleAddRaceDayChecklist = useCallback(async () => {
    if (!user?.id || !currentInterest?.id) return;

    try {
      // Find nearest upcoming race for date/name context
      const now = new Date();
      const upcomingRace = (liveRaces ?? []).find(
        (r: any) => r.date && new Date(r.date) > now,
      );

      const newStep = await createTimelineStep({
        user_id: user.id,
        interest_id: currentInterest.id,
        title: upcomingRace?.name
          ? `Race Day Checks — ${upcomingRace.name}`
          : 'Race Day Checklist',
        category: 'race_day_check',
        status: 'pending',
        starts_at: upcomingRace?.date ?? null,
        metadata: {
          plan: {},
          act: {},
          review: {},
          brain_dump: {
            raw_text: '',
            extracted_urls: [],
            extracted_people: [],
            extracted_topics: [],
            created_at: new Date().toISOString(),
          },
        },
      });

      skipFetchForStepRef.current = newStep.id;
      setSelectedRaceId(newStep.id);
      setSelectedRaceData({
        id: newStep.id,
        name: newStep.title,
        date: newStep.due_at || undefined,
        isTimelineStep: true,
        stepStatus: 'pending',
        status: 'pending',
        metadata: newStep.metadata,
      });
      setHasManuallySelected(true);
      setIsGridView(false);
      pendingNewStepIdRef.current = newStep.id;
      queryClient.refetchQueries({ queryKey: ['timeline-steps'] });

      // Offer to share with race crew if crew exists on the upcoming race
      if (upcomingRace?.id) {
        try {
          const crewList = await RaceCollaborationService.getCollaborators(upcomingRace.id);
          const acceptedCrew = crewList.filter(
            (c) => c.status === 'accepted' && c.userId,
          );
          if (acceptedCrew.length > 0) {
            const names = acceptedCrew
              .map((c) => c.displayName || 'crew member')
              .join(' & ');
            showConfirm(
              'Share with crew?',
              `Share this checklist with ${names}?`,
              async () => {
                try {
                  await updateStepMetadata(newStep.id, {
                    plan: {
                      collaborators: acceptedCrew.map((c) => ({
                        id: `platform_${c.userId}`,
                        type: 'platform' as const,
                        user_id: c.userId!,
                        display_name: c.displayName || 'Crew',
                      })),
                    },
                  });
                  queryClient.refetchQueries({ queryKey: ['timeline-steps'] });
                } catch (shareErr) {
                  console.error('Failed to share with crew:', shareErr);
                }
              },
            );
          }
        } catch {
          // Non-critical — skip crew sharing if lookup fails
        }
      }
    } catch (err) {
      console.error('Failed to create race day checklist:', err);
      showAlert('Error', 'Failed to create checklist. Please try again.');
    }
  }, [user?.id, currentInterest?.id, liveRaces, queryClient]);

  // Quick-create a step with a specific event subtype (e.g. Nutrition, Strength)
  const handleAddStepWithSubtype = useCallback(async (subtypeId: string, subtypeLabel: string) => {
    if (!user?.id || !currentInterest?.id) return;

    try {
      const newStep = await createTimelineStep({
        user_id: user.id,
        interest_id: currentInterest.id,
        title: `New ${subtypeLabel} Step`,
        category: subtypeId,
        status: 'pending',
        metadata: {
          plan: {},
          act: {},
          review: {},
          brain_dump: {
            raw_text: '',
            extracted_urls: [],
            extracted_people: [],
            extracted_topics: [],
            created_at: new Date().toISOString(),
          },
        },
      });

      skipFetchForStepRef.current = newStep.id;
      setSelectedRaceId(newStep.id);
      setSelectedRaceData({
        id: newStep.id,
        name: newStep.title,
        date: newStep.due_at || undefined,
        isTimelineStep: true,
        stepStatus: 'pending',
        status: 'pending',
        metadata: newStep.metadata,
      });
      setHasManuallySelected(true);
      setIsGridView(false);
      pendingNewStepIdRef.current = newStep.id;
      queryClient.refetchQueries({ queryKey: ['timeline-steps'] });
    } catch (err) {
      console.error('Failed to create step:', err);
      showAlert('Error', 'Failed to create step. Please try again.');
    }
  }, [user?.id, currentInterest?.id, queryClient]);

  // Navigate to the next upcoming item when "X upcoming" is tapped
  const handleUpcomingPress = useCallback(() => {
    if (nextActionItem?.id) {
      setSelectedRaceId(nextActionItem.id);
      setHasManuallySelected(true);
      if (isGridView) setIsGridView(false); // switch to card view to show detail
    }
  }, [nextActionItem?.id, isGridView]);

  // Toggle grid/card view.
  // Android's slowness on this toggle is dominated by (1) React re-rendering
  // the whole races screen tree and (2) the Grid remount animation. We defer
  // the state flip by one frame on Android so the Pressable's press feedback
  // paints immediately instead of being starved by the re-render work.
  const handleToggleGridView = useCallback(() => {
    const apply = () => {
      // Pre-select the Next item when zooming in from grid so the card view
      // lands on something sensible (formerly done inside the setter).
      if (isGridView && !selectedRaceId && nextActionItem?.id) {
        setSelectedRaceId(nextActionItem.id);
        setHasManuallySelected(true);
      }
      setIsGridView(v => !v);
    };
    if (Platform.OS === 'android') {
      requestAnimationFrame(apply);
    } else {
      apply();
    }
  }, [isGridView, selectedRaceId, nextActionItem?.id]);

  // Open boat class selector modal
  const handleSetBoatClass = useCallback(() => {
    if (!selectedRaceId) return;
    setShowBoatClassSelector(true);
  }, [selectedRaceId]);

  // Handle boat class selection
  const handleBoatClassSelected = useCallback(async (classId: string, className: string) => {
    logger.info('Boat class selected:', { classId, className, raceId: selectedRaceId });

    // Refresh race data to show updated class
    if (selectedRaceId) {
      triggerRaceDetailReload();

      // Also update local state immediately for better UX
      setSelectedRaceData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          class_id: classId,
          metadata: {
            ...prev.metadata,
            class_id: classId,
            class_name: className,
          },
        };
      });
    }
  }, [selectedRaceId, triggerRaceDetailReload]);

  const handleHideRace = useCallback(async (raceId: string, raceName?: string) => {
    if (!raceId || !user?.id) {
      return;
    }

    const friendlyName = raceName || 'this race';
    const confirmationMessage = `Hide "${friendlyName}" from your timeline? You can rejoin later from the race discovery page.`;

    showConfirm(
      'Hide from Timeline',
      confirmationMessage,
      async () => {
        const result = await withdrawFromRace(user.id, raceId);
        if (result.success) {
          // Clear selection if the hidden race was selected
          if (selectedRaceId === raceId) {
            setSelectedRaceId(null);
          }
          // Refresh the race list
          refetchRaces?.();
          showAlert('Hidden', `"${friendlyName}" has been removed from your timeline.`);
        } else {
          showAlert('Error', result.error || 'Failed to hide race');
        }
      },
      { confirmText: 'Hide' }
    );
  }, [refetchRaces, selectedRaceId, user?.id]);

  const deleteRaceById = useCallback(async (
    raceId: string,
    raceName?: string,
    options?: { showSuccessAlert?: boolean; skipRefetch?: boolean }
  ) => {
    if (!raceId || isDeletingRace) return false;

    const friendlyName = raceName || 'this race';
    const showSuccessAlert = options?.showSuccessAlert ?? true;
    const skipRefetch = options?.skipRefetch ?? false;

    setDeletingRaceId(raceId);
    try {
      // First, try to delete race_events linked to this regatta (if it's a regatta)
      const { data: linkedRaceEvents, error: linkedEventsError } = await supabase
        .from('race_events')
        .select('id')
        .eq('regatta_id', raceId);

      if (linkedEventsError) {
        logger.warn('Error fetching linked race_events:', linkedEventsError);
      }

      const linkedEventIds = (linkedRaceEvents || []).map((event: { id: string }) => event.id);

      if (linkedEventIds.length > 0) {
        const { error: deleteLinkedError } = await supabase
          .from('race_events')
          .delete()
          .in('id', linkedEventIds);

        if (deleteLinkedError) {
          logger.warn('Error deleting linked race_events:', deleteLinkedError);
        }
      }

      // Also try to delete the race_event directly by ID (for races created via Add Race flow)
      const { error: deleteDirectEventError } = await supabase
        .from('race_events')
        .delete()
        .eq('id', raceId);

      if (deleteDirectEventError) {
        logger.debug('Direct race_event delete result:', deleteDirectEventError.message);
      }

      // Try to delete from regattas table
      const { error: deleteRegattaError } = await supabase
        .from('regattas')
        .delete()
        .eq('id', raceId);

      if (deleteRegattaError) {
        logger.debug('Regatta delete result:', deleteRegattaError.message);
      }

      if (selectedRaceId === raceId) {
        setSelectedRaceId(null);
        setSelectedRaceData(null);
        setSelectedRaceMarks([]);
        setHasManuallySelected(false);
      }

      if (!skipRefetch) {
        await refetchRaces();
      }

      if (showSuccessAlert) {
        toast.show(`"${friendlyName}" deleted`, 'success');
      }
      return true;
    } catch (error: any) {
      logger.error('Error deleting race:', error);
      toast.show(error?.message || 'Unable to delete race', 'error');
      return false;
    } finally {
      setDeletingRaceId(prev => (prev === raceId ? null : prev));
    }
  }, [isDeletingRace, refetchRaces, selectedRaceId, toast]);

  const handleDeleteRace = useCallback((raceId: string, raceName?: string) => {
    if (!raceId || isDeletingRace) {
      return;
    }

    const friendlyName = raceName || 'this step';
    const race = orderedBaseCardGridRaces.find((row) => row.id === raceId);
    const isStep = race?.isTimelineStep;

    // Races still get the modal — they're higher-stakes (crew, results,
    // attached docs) and rarely deleted by accident.
    if (!isStep) {
      const confirmationMessage = `Are you sure you want to delete "${friendlyName}"? This action cannot be undone.`;
      showConfirm(
        'Delete race?',
        confirmationMessage,
        () => {
          void deleteRaceById(raceId, friendlyName);
        },
        { destructive: true, confirmText: 'Delete' }
      );
      return;
    }

    // Steps always use the optimistic-delete + Undo toast flow — no modal.
    // The Undo window IS the safety net. Pattern matches Mail, Linear,
    // Notion: instant action, easy reversal, network call deferred until
    // the toast expires so Undo is a pure cache restore.
    const snapshot = queryClient.getQueriesData<TimelineStepRecord[]>({
      queryKey: ['timeline-steps', 'mine'],
    });
    const detailSnapshot = queryClient.getQueryData<TimelineStepRecord>(
      ['timeline-steps', 'detail', raceId],
    );
    const wasSelected = selectedRaceId === raceId;
    const prevSelectedData = wasSelected ? selectedRaceData : null;

    // Optimistic removal — card disappears instantly
    queryClient.setQueriesData<TimelineStepRecord[]>(
      { queryKey: ['timeline-steps', 'mine'] },
      (old) => (old ? old.filter((s) => s.id !== raceId) : old),
    );
    queryClient.removeQueries({ queryKey: ['timeline-steps', 'detail', raceId] });

    if (wasSelected) {
      // Focus the next chronological step, falling back to the previous one.
      // orderedBaseCardGridRaces is captured pre-optimistic-update, so the
      // deleted row is still at `idx` — idx+1/idx-1 are safe siblings.
      const visible = orderedBaseCardGridRaces;
      const idx = visible.findIndex((row) => row.id === raceId);
      const candidate = idx >= 0 ? (visible[idx + 1] ?? visible[idx - 1] ?? null) : null;

      if (candidate && candidate.id !== raceId) {
        // setSelectedRaceId triggers the effect that loads selectedRaceData
        // and persists selectedStepId via saveLastViewState.
        setSelectedRaceId(candidate.id);
        setSelectedRaceData(null);
        setSelectedRaceMarks([]);
        setHasManuallySelected(true);
      } else {
        setSelectedRaceId(null);
        setSelectedRaceData(null);
        setSelectedRaceMarks([]);
        setHasManuallySelected(false);
        saveLastViewState({ selectedStepId: null });
      }
    }

    let undone = false;
    const restore = () => {
      undone = true;
      snapshot.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      if (detailSnapshot) {
        queryClient.setQueryData(['timeline-steps', 'detail', raceId], detailSnapshot);
      }
      if (wasSelected && prevSelectedData) {
        setSelectedRaceId(raceId);
        setSelectedRaceData(prevSelectedData);
      }
    };

    const commit = async () => {
      setDeletingRaceId(raceId);
      try {
        await deleteTimelineStep(raceId);
        void queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
        void refetchRaces();
      } catch (error: any) {
        restore();
        toast.show(error?.message || 'Unable to delete step', 'error');
      } finally {
        setDeletingRaceId(prev => (prev === raceId ? null : prev));
      }
    };

    toast.show('Step deleted', 'success', {
      duration: 6000,
      action: {
        label: 'Undo',
        onPress: restore,
      },
      onDismiss: () => {
        if (!undone) {
          void commit();
        }
      },
    });
  }, [deleteRaceById, isDeletingRace, orderedBaseCardGridRaces, refetchRaces, selectedRaceId, selectedRaceData, queryClient, toast]);

  const handleTimelineGridBulkDelete = useCallback((raceIds: string[]) => {
    const uniqueIds = [...new Set(raceIds)];
    if (!uniqueIds.length) return;

    const count = uniqueIds.length;
    const noun = count === 1 ? 'step' : 'steps';
    const stepIds = new Set(
      uniqueIds.filter((raceId) => {
        const race = orderedBaseCardGridRaces.find((row) => row.id === raceId);
        return race?.isTimelineStep;
      }),
    );

    const deletedIdSet = new Set(uniqueIds);

    showConfirm(
      'Delete selected?',
      `Delete ${count} selected ${noun}? This cannot be undone.`,
      () => {
        void (async () => {
          // If the currently selected step is in the delete set, shift focus
          // to the nearest visible step that is NOT being deleted — next
          // chronologically, falling back to previous.
          if (selectedRaceId && deletedIdSet.has(selectedRaceId)) {
            const visible = orderedBaseCardGridRaces;
            const selectedIdx = visible.findIndex((row) => row.id === selectedRaceId);
            let candidate: (typeof visible)[number] | null = null;
            if (selectedIdx >= 0) {
              for (let i = selectedIdx + 1; i < visible.length; i++) {
                if (!deletedIdSet.has(visible[i].id)) { candidate = visible[i]; break; }
              }
              if (!candidate) {
                for (let i = selectedIdx - 1; i >= 0; i--) {
                  if (!deletedIdSet.has(visible[i].id)) { candidate = visible[i]; break; }
                }
              }
            }
            if (candidate) {
              setSelectedRaceId(candidate.id);
              setSelectedRaceData(null);
              setSelectedRaceMarks([]);
              setHasManuallySelected(true);
            } else {
              setSelectedRaceId(null);
              setSelectedRaceData(null);
              setSelectedRaceMarks([]);
              setHasManuallySelected(false);
              saveLastViewState({ selectedStepId: null });
            }
          }

          // Snapshot + optimistic bulk removal so all cards disappear at once
          const snapshot = queryClient.getQueriesData<TimelineStepRecord[]>({
            queryKey: ['timeline-steps', 'mine'],
          });
          if (stepIds.size > 0) {
            queryClient.setQueriesData<TimelineStepRecord[]>(
              { queryKey: ['timeline-steps', 'mine'] },
              (old) => (old ? old.filter((s) => !stepIds.has(s.id)) : old),
            );
            stepIds.forEach((id) => {
              queryClient.removeQueries({ queryKey: ['timeline-steps', 'detail', id] });
            });
          }

          try {
            for (const raceId of uniqueIds) {
              if (stepIds.has(raceId)) {
                await deleteTimelineStep(raceId);
              } else {
                const race = orderedBaseCardGridRaces.find((row) => row.id === raceId);
                await deleteRaceById(raceId, race?.name, { showSuccessAlert: false, skipRefetch: true });
              }
            }
            toast.show(`${count} ${noun} deleted`, 'success');
            void queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
            void refetchRacesRef.current?.();
          } catch (error: any) {
            // Restore cache on failure
            snapshot.forEach(([key, value]) => {
              queryClient.setQueryData(key, value);
            });
            toast.show(error?.message || 'Could not delete selected steps', 'error');
          }
        })();
      },
      { destructive: true, confirmText: 'Delete' }
    );
  }, [orderedBaseCardGridRaces, deleteRaceById, queryClient, selectedRaceId, toast]);

  // Delete the currently selected race with confirmation
  const handleDeleteSelectedRace = useCallback(() => {
    if (!selectedRaceId) {
      return;
    }

    handleDeleteRace(selectedRaceId, selectedRaceData?.name);
  }, [handleDeleteRace, selectedRaceData?.name, selectedRaceId]);

  // Handle racing area drawing
  const handleRacingAreaChange = useCallback((polygon: Array<{ lat: number, lng: number }>) => {
    setDrawingRacingArea(polygon);
  }, []);

  // Handle saving racing area to database
  const handleSaveRacingArea = useCallback(async (polygonPoints?: Array<{ lat: number, lng: number }>) => {
    // Use passed points or fall back to state
    const pointsToSave = polygonPoints || drawingRacingArea;

    logger.debug('[handleSaveRacingArea] Called with:', {
      selectedRaceId,
      passedPointsLength: polygonPoints?.length,
      statePointsLength: drawingRacingArea.length,
      usingPoints: pointsToSave.length
    });

    if (!selectedRaceId) {
      logger.warn('[handleSaveRacingArea] No selectedRaceId, aborting');
      showAlert('Error', 'No race selected');
      return;
    }

    if (pointsToSave.length < 3) {
      logger.warn('[handleSaveRacingArea] Not enough points:', pointsToSave.length);
      showAlert('Error', `Need at least 3 points to save racing area. Currently have ${pointsToSave.length} points.`);
      return;
    }

    try {
      logger.debug('Saving racing area:', pointsToSave);

      // Convert to GeoJSON format
      const coordinates = pointsToSave.map(point => [point.lng, point.lat]);
      const polygonGeoJSON = {
        type: 'Polygon',
        coordinates: [[...coordinates, coordinates[0]]] // Close the polygon
      };

      // Calculate centroid from the polygon for venue coordinates
      // This enables tide/weather APIs to fetch data for this location
      const centroidLat = pointsToSave.reduce((sum, p) => sum + p.lat, 0) / pointsToSave.length;
      const centroidLng = pointsToSave.reduce((sum, p) => sum + p.lng, 0) / pointsToSave.length;

      logger.debug('[handleSaveRacingArea] Extracted centroid:', { centroidLat, centroidLng });

      // Get current metadata to preserve existing fields
      const currentMetadata = selectedRaceData?.metadata || {};

      // Only update venue coordinates if not already set (don't override user-specified venue)
      const shouldUpdateVenueCoords = !currentMetadata.venue_lat || !currentMetadata.venue_lng;

      const updatedMetadata = shouldUpdateVenueCoords ? {
        ...currentMetadata,
        venue_lat: centroidLat,
        venue_lng: centroidLng,
        venue_coords_source: 'racing_area_centroid', // Track where coords came from
      } : currentMetadata;

      // Save racing area polygon AND update metadata with venue coordinates
      const { error } = await supabase
        .from('regattas')
        .update({
          racing_area_polygon: polygonGeoJSON,
          metadata: updatedMetadata
        })
        .eq('id', selectedRaceId);

      if (error) {
        logger.error('[handleSaveRacingArea] Supabase error:', error);
        showAlert('Error Saving', `Failed to save racing area: ${error.message}`);
        throw error;
      }

      logger.debug('Racing area saved successfully', {
        updatedVenueCoords: shouldUpdateVenueCoords,
        centroid: { lat: centroidLat, lng: centroidLng }
      });

      // Update local state immediately to prevent racing area from disappearing
      setSelectedRaceData((prev: any) => ({
        ...prev,
        racing_area_polygon: polygonGeoJSON,
        metadata: updatedMetadata
      }));

      // Clear drawing state
      setDrawingRacingArea([]);

      // Refresh race data in background (use ref for stable callback identity)
      refetchRef.current?.();

      const coordsMessage = shouldUpdateVenueCoords
        ? `\n\nVenue coordinates auto-detected from racing area center for tide/weather data.`
        : '';
      showAlert('Success', `Racing area saved!${coordsMessage}`);
    } catch (error) {
      logger.error('Error saving racing area:', error);
    }
  }, [selectedRaceId, drawingRacingArea]);

  const ensureRaceEventId = useCallback(async (): Promise<string | null> => {
    logger.debug('[ensureRaceEventId] START', { selectedRaceId });

    if (!selectedRaceId) {
      logger.warn('[ensureRaceEventId] Attempted to ensure race event without selected race');
      return null;
    }

    logger.debug('[ensureRaceEventId] Querying for existing race_event...');
    // Use .limit(1) to handle potential duplicates gracefully
    const { data: existingRaceEvents, error: existingRaceEventError } = await supabase
      .from('race_events')
      .select('id')
      .eq('regatta_id', selectedRaceId)
      .order('created_at', { ascending: false })
      .limit(1);

    logger.debug('[ensureRaceEventId] Query result', { existingRaceEvents, existingRaceEventError });

    if (existingRaceEventError) {
      logger.error('[ensureRaceEventId] Error querying existing race_event:', existingRaceEventError);
      throw existingRaceEventError;
    }

    if (existingRaceEvents && existingRaceEvents.length > 0) {
      const existingRaceEvent = existingRaceEvents[0];
      logger.debug('[ensureRaceEventId] Found existing race_event', { raceEventId: existingRaceEvent.id });
      return existingRaceEvent.id;
    }

    logger.debug('[ensureRaceEventId] No existing race_event found, creating new one', {
      selectedRaceId,
      raceName: selectedRaceData?.name,
    });

    const startDateObj = selectedRaceData?.start_date
      ? new Date(selectedRaceData.start_date)
      : null;

    const startTime = startDateObj && !Number.isNaN(startDateObj.getTime())
      ? startDateObj.toISOString().split('T')[1]?.split('Z')[0]?.split('.')[0] || '00:00:00'
      : '00:00:00';

    const eventDate = startDateObj && !Number.isNaN(startDateObj.getTime())
      ? startDateObj.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const insertPayload = {
      regatta_id: selectedRaceId,
      name: `${selectedRaceData?.name || 'Race'} - Event 1`,
      start_time: startTime,
      event_date: eventDate,
    };
    logger.debug('[ensureRaceEventId] Insert payload prepared', insertPayload);

    logger.debug('[ensureRaceEventId] Executing insert');
    const { data: newRaceEvent, error: createError } = await supabase
      .from('race_events')
      .insert(insertPayload)
      .select()
      .single();

    logger.debug('[ensureRaceEventId] Insert result', { newRaceEvent, createError });

    if (createError) {
      logger.error('[ensureRaceEventId] Error creating race_event:', createError);
      throw createError;
    }

    logger.debug('[ensureRaceEventId] Created new race_event', { raceEventId: newRaceEvent.id });
    return newRaceEvent.id;
  }, [selectedRaceData?.name, selectedRaceData?.start_date, selectedRaceId]);

  // Race marks handlers (extracted to useRaceMarks hook)
  const {
    handleMarkAdded,
    handleMarkUpdated,
    handleMarkDeleted,
    handleBulkMarksUpdate,
  } = useRaceMarks({
    selectedRaceId,
    ensureRaceEventId,
    setMarks: setSelectedRaceMarks,
  });

  // Venue coordinates (extracted to useVenueCoordinates hook)
  const { venueCoordinates: selectedRaceVenueCoordinates } = useVenueCoordinates({
    selectedRaceData,
    drawingRacingArea,
  });

  // handleOpenStrategySharing is now provided by useStrategySharing hook

  // Utility functions (normalizeCourseMarkType) imported from @/lib/races
  // Mark handlers and venue coordinates are now provided by extracted hooks above
  // - useRaceMarks: handleMarkAdded, handleMarkUpdated, handleMarkDeleted, handleBulkMarksUpdate
  // - useVenueCoordinates: selectedRaceVenueCoordinates

  // Get enriched weather data for the selected race from safeRecentRaces
  // This ensures RaceConditionsCard uses the same fresh weather data as RaceCard
  const selectedRaceEnrichedWeather = useMemo(() => {
    if (!selectedRaceId) return null;
    const enrichedRace = safeRecentRaces.find((r: any) => r.id === selectedRaceId);
    if (enrichedRace) {
      return {
        wind: enrichedRace.wind || null,
        tide: enrichedRace.tide || null,
        weatherFetchedAt: enrichedRace.weatherFetchedAt || null,
      };
    }
    return null;
  }, [selectedRaceId, safeRecentRaces]);

  // Memoized navigation handlers
  const handleVenuePress = useCallback(() => {
    routerRef.current.push('/connect');
  }, []);

  // Venue insights handlers (loadCachedInsights, handleGetVenueInsights) and
  // related effects are now managed by useVenueInsights hook above

  // Cache next race for offline use when it loads
  React.useEffect(() => {
    if (nextRace && user) {
      cacheNextRace(nextRace.id, user.id).catch(err =>
        logger.error('Failed to cache race:', err)
      );
    }
  }, [nextRace, user]);

  // Auto-select first race when races load (only runs once when loading completes)
  // Using useRef to track if auto-selection has happened to prevent re-running
  const autoSelectDatasetKeyRef = useRef<string | null>(null);
  const autoSelectLastAppliedIdRef = useRef<string | null>(null);
  // Auto-select when data changes; omit selectedRaceId dependency to avoid loops when we set it here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (loading || safeRecentRaces.length === 0) {
      return;
    }

    const datasetKey = safeRecentRaces.map((race: any) => race?.id ?? 'unknown').join('|');
    const datasetChanged = autoSelectDatasetKeyRef.current !== datasetKey;
    if (datasetChanged) {
      autoSelectDatasetKeyRef.current = datasetKey;
    }

    // Keep current selection if it is still present in the latest dataset
    const selectionStillValid = selectedRaceId
      ? safeRecentRaces.some((race: any) => race?.id === selectedRaceId)
      : false;

    // If the user already has a valid selection, preserve it - don't override with auto-select
    if (selectionStillValid) {
      return;
    }

    // If dataset is unchanged and we're already on the desired target, no work needed.
    const routeTargetId = initialSelectedRaceParam.current;
    const raceToSelect =
      (routeTargetId && safeRecentRaces.find((race: any) => race?.id === routeTargetId)) ||
      (nextActionItem?.id && safeRecentRaces.find((race: any) => race?.id === nextActionItem.id)) ||
      safeRecentRaces[0];

    const targetId = raceToSelect?.id ?? null;

    if (!targetId) {
      return;
    }

    if (!datasetChanged && autoSelectLastAppliedIdRef.current === targetId) {
      return;
    }

    if (targetId === selectedRaceId) {
      autoSelectLastAppliedIdRef.current = targetId;
      return;
    }

    logger.debug('[races.tsx] Auto-selecting race:', raceToSelect?.name, targetId, {
      datasetChanged,
      selectionStillValid,
      previousKey: autoSelectDatasetKeyRef.current,
    });
    autoSelectLastAppliedIdRef.current = targetId;
    // Only mark as auto if we truly changed the selection here
    setHasManuallySelected(false);
    setSelectedRaceId(targetId);
  }, [loading, safeRecentRaces, nextRace]);

  useEffect(() => {
    if (selectedRaceId) {
      autoSelectLastAppliedIdRef.current = selectedRaceId;
    }
  }, [selectedRaceId]);

  // Handle deep links that request a specific race selection (e.g., after creation)
  // Also handles subsequent navigations with ?selected= while tab is already mounted
  useEffect(() => {
    const targetId = initialSelectedRaceParam.current || (typeof searchParams?.selected === 'string' ? searchParams.selected : null);
    if (!targetId || loading) {
      return;
    }

    // Match against both safeRecentRaces AND myTimelineSteps — adopted
    // curriculum steps live in myTimelineSteps and don't always surface
    // in safeRecentRaces, so a deep link from e.g. the peer sheet would
    // otherwise bail silently and leave ?selected= in the URL.
    const matchingRace =
      safeRecentRaces.find((race: any) => race.id === targetId) ??
      myTimelineSteps?.find((s) => s.id === targetId);
    if (!matchingRace) {
      return;
    }

    logger.debug('[races.tsx] Selecting race from route params:', targetId);
    setSelectedRaceId(targetId);
    setHasManuallySelected(true);
    initialSelectedRaceParam.current = null;

    // Clear the ?selected= param via the router so expo-router's internal
    // searchParams state stays in sync. Using window.history.replaceState
    // here desyncs expo-router (the hook still reports the old value), which
    // breaks subsequent router.push calls that reuse the same id.
    if (typeof searchParams?.selected === 'string') {
      router.setParams({ selected: undefined });
    }
  }, [loading, safeRecentRaces, myTimelineSteps, searchParams?.selected, router]);

  useEffect(() => {
    if (hasRealRaces) {
      if (selectedDemoRaceId) {
        setSelectedDemoRaceId(null);
      }
      return;
    }

    if (!loading && !selectedDemoRaceId && MOCK_RACES.length > 0) {
      setSelectedDemoRaceId(MOCK_RACES[0].id);
    }
  }, [hasRealRaces, loading, selectedDemoRaceId]);

  // Scroll to race detail when a race is selected (but not on initial auto-select)
  React.useEffect(() => {
    if (hasManuallySelected && selectedRaceId && mainScrollViewRef.current) {
      // Simple scroll - just scroll down a fixed amount to show the detail section
      // This works reliably on both native and web
      setTimeout(() => {
        mainScrollViewRef.current?.scrollTo({
          y: 500, // Approximate position of race detail section
          animated: true,
        });
      }, 100);
    }
  }, [selectedRaceId, hasManuallySelected]);

  // Fetch race detail when selected race changes
  React.useEffect(() => {
    const fetchRaceDetail = async () => {
      // Track the selection value at the beginning of this fetch to prevent stale updates
      const selectionAtStart = selectedRaceId;
      logger.debug('=====================================');
      logger.debug('[races.tsx] 📥 FETCHING RACE DETAILS');
      logger.debug('[races.tsx] selectedRaceId:', selectedRaceId);

      if (!selectedRaceId) {
        logger.debug('[races.tsx] No selectedRaceId, clearing data');
        fetchedRaceDetailIdRef.current = null;
        setSelectedRaceData(null);
        setSelectedRaceMarks([]);
        return;
      }

      // If a handler (handleAddPractice/handleAddStep) already set step data
      // for this ID, skip the fetch to avoid overwriting it.
      // Don't clear the ref on the first skip — keep it until the timeline
      // data has caught up (prevents race condition where intermediate
      // re-renders overwrite isTimelineStep before the step is in the local data).
      if (skipFetchForStepRef.current === selectedRaceId) {
        const stepInData = timelineStepCards.some((s) => s.id === selectedRaceId)
          || myTimelineSteps?.some((s) => s.id === selectedRaceId);
        if (stepInData) {
          // Data has caught up — safe to clear the skip guard
          skipFetchForStepRef.current = null;
        }
        logger.debug('[races.tsx] ⏭️ Step data already set for', selectedRaceId, '— skipping fetch');
        return;
      }

      // First check if this race is in our local safeRecentRaces (might be fallback data or race_event)
      const localRace = safeRecentRaces.find((r: any) => r.id === selectedRaceId);

      // If it's a timeline step, use local data directly — no DB query needed
      const isStep = localRace?.isTimelineStep
        || timelineStepCards.some((s) => s.id === selectedRaceId)
        || myTimelineSteps?.some((s) => s.id === selectedRaceId);
      if (isStep) {
        const stepData = localRace || timelineStepCards.find((s) => s.id === selectedRaceId);
        logger.debug('[races.tsx] Using timeline step local data:', stepData?.name);
        setLoadingRaceDetail(false);
        setSelectedRaceData(stepData ? { ...stepData, isTimelineStep: true } : null);
        setSelectedRaceMarks([]);
        return;
      }

      // If we already fetched this race from Supabase and raceDetailReloadKey
      // hasn't changed, skip re-fetching (avoids duplicate queries when
      // safeRecentRaces updates due to enrichment).
      if (fetchedRaceDetailIdRef.current === `${selectedRaceId}:${raceDetailReloadKey}`) {
        return;
      }

      // If it's a race_event (user-created race), use local data directly
      if (localRace && localRace._source === 'race_events') {
        logger.debug('[races.tsx] 📦 Using race_event local data:', localRace.name);
        setLoadingRaceDetail(false);
        setSelectedRaceData(localRace);
        setSelectedRaceMarks([]);
        return;
      }

      if (isDemoRaceId(selectedRaceId)) {
        // Demo race IDs are not valid UUIDs — never send them to Supabase
        if (localRace) {
          logger.debug('[races.tsx] 📦 Using local race data (demo race):', localRace.name);
          setSelectedRaceData(localRace);
        } else {
          logger.debug('[races.tsx] ⚠️ Demo race not yet in local data, skipping DB query');
          setSelectedRaceData(null);
        }
        setLoadingRaceDetail(false);
        setSelectedRaceMarks([]);
        return;
      }

      setLoadingRaceDetail(true);
      try {
        logger.debug('[races.tsx] Querying database for race ID:', selectedRaceId);
        const { data, error } = await supabase
          .from('regattas')
          .select('*')
          .eq('id', selectedRaceId)
          .maybeSingle();

        if (error || !data) {
          logger.warn('[races.tsx] ⚠️ Regatta fetch failed, trying race_events');
          // If regatta query fails, try race_events table
          const { data: raceEventData, error: raceEventError } = await supabase
            .from('race_events')
            .select('*')
            .eq('id', selectedRaceId)
            .maybeSingle();

          if (!raceEventError && raceEventData) {
            logger.debug('[races.tsx] 📦 Found in race_events:', raceEventData.name);
            // Normalize race_event data
            const normalizedData = {
              ...raceEventData,
              start_date: raceEventData.start_time || raceEventData.event_date,
              race_name: raceEventData.name,
              created_by: raceEventData.user_id,
              _source: 'race_events',
            };
            setSelectedRaceData(normalizedData);
            setSelectedRaceMarks([]);
            setLoadingRaceDetail(false);
            return;
          }

          // If both fail, try local data as last fallback
          if (localRace) {
            logger.debug('[races.tsx] 📦 Using local race data as fallback:', localRace.name);
            setLoadingRaceDetail(false);
            setSelectedRaceData(localRace);
            setSelectedRaceMarks([]);
            return;
          }
          // May be a timeline step that hasn't loaded into timelineStepCards yet — silently skip
          logger.debug('[races.tsx] ⚠️ No data found for ID, may be a timeline step loading:', selectedRaceId);
          setSelectedRaceData(null);
          setSelectedRaceMarks([]);
          setLoadingRaceDetail(false);
          return;
        }
        // If the selection changed during the fetch, ignore this result
        if (selectionAtStart !== selectedRaceId) {
          logger.debug(
            '[races.tsx] ⏭️ Ignoring stale fetch result for',
            data?.name,
            'selection changed to',
            selectedRaceId
          );
          return;
        }
        fetchedRaceDetailIdRef.current = `${selectedRaceId}:${raceDetailReloadKey}`;
        setSelectedRaceData(data);

        // Try to find associated race_event for marks
        const { data: raceEvent } = await supabase
          .from('race_events')
          .select('id')
          .eq('regatta_id', selectedRaceId)
          .maybeSingle();

        if (raceEvent) {
          // Load race marks
          const { data: marksData, error: marksError } = await supabase
            .from('race_marks')
            .select('*')
            .eq('race_id', raceEvent.id)
            .order('name', { ascending: true });

          if (!marksError && marksData) {
            // Convert race_marks format to component format
            const convertedMarks = marksData.map((mark: any) => ({
              id: mark.id,
              mark_name: mark.name,
              mark_type: mark.mark_type,
              latitude: mark.latitude,
              longitude: mark.longitude,
              sequence_order: 0,
            }));

            // Deduplicate marks: Keep only unique combinations of name + mark_type
            // This prevents rendering duplicate courses if the database has duplicates
            const uniqueMarks = convertedMarks.filter((mark, index, self) => {
              const markKey = `${mark.mark_name}:${mark.mark_type}`;
              return index === self.findIndex(m =>
                `${m.mark_name}:${m.mark_type}` === markKey
              );
            });

            if (uniqueMarks.length < convertedMarks.length) {
              logger.warn(
                `[races.tsx] ⚠️ Deduplicated marks: ${convertedMarks.length} -> ${uniqueMarks.length}`
              );
            }

            setSelectedRaceMarks(uniqueMarks);
            logger.debug('[races.tsx] Marks loaded:', uniqueMarks.length);
          }
        }
      } catch (error) {
        logger.error('[races.tsx] ❌ Error fetching race detail:', error);
        setSelectedRaceData(null);
        setSelectedRaceMarks([]);
      } finally {
        setLoadingRaceDetail(false);
        logger.debug('[races.tsx] 🏁 Fetch complete');
        logger.debug('=====================================');
      }
    };

    fetchRaceDetail();
    // safeRecentRaces, timelineStepCards & myTimelineSteps included so the effect
    // re-runs once async data arrives (otherwise the closure captures empty arrays
    // on first render and the timeline-step early-return never fires).
  }, [selectedRaceId, raceDetailReloadKey, safeRecentRaces, timelineStepCards, myTimelineSteps]);

  // Race documents loading and upload are now handled by useRaceDocuments hook

  // Race class selection (extracted to useRaceClassSelection hook)
  const {
    selectedRaceClassId,
    selectedRaceClassName,
  } = useRaceClassSelection({
    selectedRaceData,
  });

  const matchedEnrichedRace = useMemo(() => {
    if (!selectedRaceId || !Array.isArray(enrichedRaces)) {
      return null;
    }
    return enrichedRaces.find((race: any) => race.id === selectedRaceId) ?? null;
  }, [selectedRaceId, enrichedRaces]);

  // Tactical snapshots (extracted to useTacticalSnapshots hook)
  const {
    selectedRaceWeather,
    windSnapshot,
    currentSnapshot,
    boatDraftValue,
    boatLengthValue,
    timeToStartMinutes,
    boatSpeedKnots,
  } = useTacticalSnapshots({
    selectedRaceData,
    matchedEnrichedRace,
    raceWeather,
    selectedDemoRace,
    gpsPosition,
  });

  // Post-race interview (extracted to usePostRaceInterview hook)
  const {
    showPostRaceInterview,
    completedSessionId,
    completedRaceName,
    completedRaceId,
    completedSessionGpsPoints,
    userPostRaceSession,
    loadingUserPostRaceSession,
    handleOpenPostRaceInterviewManually,
    handleRaceComplete,
    handlePostRaceInterviewComplete,
    handleClosePostRaceInterview,
    setShowPostRaceInterview,
    setCompletedRaceName,
  } = usePostRaceInterview({
    selectedRaceId,
    selectedRaceData,
    user,
    refetch,
  });

  // Wrapper to trigger AfterRaceContent refetch when PostRaceInterview completes
  const handlePostRaceInterviewCompleteWithRefetch = useCallback(() => {
    handlePostRaceInterviewComplete();
    // Increment trigger to cause AfterRaceContent to refetch its data
    setRefetchTrigger(prev => prev + 1);
  }, [handlePostRaceInterviewComplete]);

  // Sailor profile (extracted to useSailorProfile hook)
  const { sailorId } = useSailorProfile({ user });

  // Strategy sharing (extracted to useStrategySharing hook)
  const {
    showCoachSelectionModal,
    sharingStrategy,
    sharingRaceEventId,
    handleOpenStrategySharing,
    handleCloseStrategySharing,
  } = useStrategySharing({
    selectedRaceId,
    sailorId,
    selectedRaceData,
    ensureRaceEventId,
  });

  // Add race (extracted to useAddRace hook)
  const {
    showAddRaceSheet,
    isAddingRace,
    familyButtonExpanded,
    showSignupPrompt,
    handleShowAddRaceSheet,
    handleCloseAddRaceSheet,
    handleAddRaceNavigation,
    handleQuickAddRaceSubmit,
    handleAddRaceDialogSave,
    setFamilyButtonExpanded,
    setShowSignupPrompt,
  } = useAddRace({
    refetchRaces,
    onRaceCreated: (raceId) => {
      // Auto-select the newly created race to center on it
      setSelectedRaceId(raceId);
      setHasManuallySelected(true);
      void triggerPricingPrompt();
    },
  });

  // Smart Add Step: adopt suggestion from blueprint
  const handleAdoptSuggestion = useCallback(async (suggestion: import('@/types/blueprint').BlueprintSuggestedNextStep) => {
    if (!currentInterest?.id) return;
    try {
      const adopted = await adoptBlueprintStep.mutateAsync({
        sourceStepId: suggestion.next_step_id,
        interestId: currentInterest.id,
        subscriptionId: suggestion.subscription_id,
        blueprintId: suggestion.blueprint_id,
      });
      // Navigate to the newly adopted step
      skipFetchForStepRef.current = adopted.id;
      setSelectedRaceId(adopted.id);
      setSelectedRaceData({
        id: adopted.id,
        name: adopted.title,
        date: adopted.due_at || undefined,
        isTimelineStep: true,
        stepStatus: 'pending',
        status: 'pending',
        metadata: adopted.metadata,
      });
      setHasManuallySelected(true);
      setIsGridView(false);
      queryClient.refetchQueries({ queryKey: ['timeline-steps'] });
    } catch (err) {
      console.error('Failed to adopt suggested step:', err);
      showAlert('Error', 'Failed to add step to timeline. Please try again.');
    }
  }, [currentInterest?.id, adoptBlueprintStep, queryClient]);

  // Smart Add Step: dismiss/skip suggestion
  const handleDismissSuggestion = useCallback((suggestion: import('@/types/blueprint').BlueprintSuggestedNextStep) => {
    dismissBlueprintStep.mutate({
      subscriptionId: suggestion.subscription_id,
      sourceStepId: suggestion.next_step_id,
    });
  }, [dismissBlueprintStep]);

  // NowBar weather: fetch live weather for the next upcoming race's venue,
  // falling back to browser/device geolocation when no venue coordinates exist.
  const nextRaceVenueCoords = useMemo(() => {
    if (!safeNextRace) return null;
    const coords = safeNextRace.venueCoordinates;
    if (coords?.lat && coords?.lng) return coords;
    // Fallback to metadata
    const meta = safeNextRace.metadata;
    if (meta?.venue_lat && meta?.venue_lng) {
      return { lat: parseFloat(meta.venue_lat), lng: parseFloat(meta.venue_lng) };
    }
    return null;
  }, [safeNextRace]);

  // Device geolocation fallback when no venue coordinates
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    // Only request geolocation if we have no venue coords
    if (nextRaceVenueCoords) {
      setDeviceCoords(null);
      return;
    }

    if (Platform.OS === 'web') {
      // Web: use navigator.geolocation
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setDeviceCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          },
          () => setDeviceCoords(null),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
        );
      }
    } else {
      // Native: use expo-location (check permission without prompting)
      (async () => {
        try {
          const Location = await import('expo-location');
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const loc = await Location.getLastKnownPositionAsync();
          if (loc) {
            setDeviceCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          }
        } catch {
          // Silently fail
        }
      })();
    }
  }, [nextRaceVenueCoords]);

  const nowBarCoordsSource = nextRaceVenueCoords ? 'venue' : (deviceCoords ? 'location' : null);
  const nowBarCoords = nextRaceVenueCoords || deviceCoords;

  const { weather: nowBarLiveWeather } = useVenueLiveWeather(
    nowBarCoords?.lat,
    nowBarCoords?.lng,
  );

  const nowBarWeather = useMemo(() => {
    if (!nowBarLiveWeather) return null;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const compassDir = dirs[Math.round(nowBarLiveWeather.windDirection / 45) % 8];

    // Capitalize tide state for display
    const tideState = nowBarLiveWeather.tidalState
      ? nowBarLiveWeather.tidalState.charAt(0).toUpperCase() + nowBarLiveWeather.tidalState.slice(1)
      : undefined;

    return {
      windDirection: compassDir,
      windSpeed: nowBarLiveWeather.windSpeed,
      waveHeight: nowBarLiveWeather.waveHeight,
      tideState,
      locationLabel: nowBarCoordsSource === 'location' ? 'Current location' : undefined,
    };
  }, [nowBarLiveWeather, nowBarCoordsSource]);

  // Race documents hook (handles fetching, uploading, and deleting)
  const {
    documents: raceDocuments,
    loading: loadingRaceDocuments,
    error: raceDocumentsError,
    isUploading: isUploadingRaceDocument,
    typePickerVisible: documentTypePickerVisible,
    refresh: handleRefreshRaceDocuments,
    upload: handleUploadRaceDocument,
    selectType: handleDocumentTypeOptionSelect,
    dismissTypePicker: handleDismissDocumentTypePicker,
  } = useRaceDocuments({
    raceId: selectedRaceId,
    userId: user?.id,
    isDemoSession,
  });

  // Track pending document upload (for race switching)
  const pendingDocumentUploadRef = useRef<boolean>(false);

  // Handle document upload from CardGrid
  // If uploading for a different race, select that race first
  const handleCardGridUploadDocument = useCallback(
    (raceId: string) => {
      // If this is a different race, select it first and mark upload pending
      if (raceId !== selectedRaceId) {
        setSelectedRaceId(raceId);
        setHasManuallySelected(true);
        pendingDocumentUploadRef.current = true;
      } else {
        handleUploadRaceDocument();
      }
    },
    [selectedRaceId, handleUploadRaceDocument]
  );

  // Trigger pending document upload after race selection changes
  useEffect(() => {
    if (pendingDocumentUploadRef.current && selectedRaceId) {
      pendingDocumentUploadRef.current = false;
      // Small delay to ensure hook has updated
      setTimeout(() => {
        handleUploadRaceDocument();
      }, 50);
    }
  }, [selectedRaceId, handleUploadRaceDocument]);

  // Transform raw documents into display format
  const raceDocumentsForDisplay = useMemo<RaceDocumentsCardDocument[]>(() => {
    if (!raceDocuments?.length) {
      return [];
    }

    return raceDocuments.map((doc) => {
      const mergedMetadata = ((doc.document?.metadata || doc.metadata) ?? {}) as Record<string, any>;

      const deriveName = (): string => {
        const candidates = [mergedMetadata.displayName, mergedMetadata.title, doc.document?.filename];
        const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
        return found ? (found as string) : 'Document';
      };

      const deriveSize = (): number => {
        const sizeCandidate =
          doc.document?.file_size ?? mergedMetadata.file_size ?? mergedMetadata.size ?? mergedMetadata.fileSize;
        return typeof sizeCandidate === 'number' && Number.isFinite(sizeCandidate) ? sizeCandidate : 0;
      };

      const uploadedTimestamp = (doc.document?.created_at as string) ?? doc.createdAt;

      return {
        id: doc.id,
        name: deriveName(),
        type: normalizeDocumentType(doc.documentType),
        size: deriveSize(),
        uploadedAt: uploadedTimestamp,
        uploadedBy: (doc.document?.user_id as string) ?? doc.userId,
        aiProcessed: Boolean(
          mergedMetadata.aiProcessed ??
          mergedMetadata.ai_processed ??
          mergedMetadata.course_extract_id ??
          mergedMetadata.course_extracted ??
          mergedMetadata.ai_ready
        ),
        hasExtractedCourse: Boolean(mergedMetadata.course_extract_id ?? mergedMetadata.course_extracted),
      } satisfies RaceDocumentsCardDocument;
    });
  }, [raceDocuments]);

  const initialConditionsSnapshot = useMemo(() => {
    if (!selectedRaceData && !matchedEnrichedRace) {
      return null;
    }

    const metadata = (selectedRaceData?.metadata || {}) as Record<string, any>;
    const enrichedWind =
      matchedEnrichedRace?.wind ??
      (selectedRaceData as any)?.wind ??
      metadata?.wind ??
      metadata?.weather?.wind ??
      null;
    const enrichedTide =
      matchedEnrichedRace?.tide ??
      (selectedRaceData as any)?.tide ??
      metadata?.tide ??
      metadata?.weather?.tide ??
      null;

    if (!enrichedWind && !enrichedTide) {
      return null;
    }

    return {
      wind: enrichedWind ?? undefined,
      tide: enrichedTide ?? undefined,
      fetchedAt: metadata?.weather_fetched_at ?? metadata?.weather?.fetched_at ?? undefined,
      provider: metadata?.weather_provider ?? metadata?.weather?.provider ?? undefined,
    };
  }, [matchedEnrichedRace, selectedRaceData]);

  // Tactical snapshots (selectedRaceWeather, windSnapshot, currentSnapshot, boatDraftValue,
  // boatLengthValue, timeToStartMinutes, boatSpeedKnots) are now provided by useTacticalSnapshots hook above

  // Venue center (extracted to useVenueCenter hook)
  const { venueCenter } = useVenueCenter({
    selectedRaceData,
    selectedRaceMarks,
  });

  // Race course (extracted to useRaceCourse hook)
  const { raceCourseForConsole } = useRaceCourse({
    selectedRaceId,
    selectedRaceData,
    selectedRaceMarks,
    windSnapshot,
  });

  // Layout data (extracted to useRaceLayoutData hook)
  const {
    courseHeading,
    layoutWindData,
    layoutCurrentData,
    vhfChannel,
  } = useRaceLayoutData({
    raceCourseForConsole,
    windSnapshot,
    currentSnapshot,
    selectedRaceData,
  });

  // Next mark calculations (extracted to useNextMarkData hook)
  const {
    nextMarkForCalculations,
    overlayNextMark,
    quickActionNextMark,
  } = useNextMarkData({
    raceMarks: selectedRaceMarks,
    gpsPosition,
  });

  // Tide and depth snapshots (extracted to useTideDepthSnapshots hook)
  const {
    effectiveDraft,
    tideSnapshot,
    depthSnapshot,
  } = useTideDepthSnapshots({
    selectedRaceData,
    boatDraftValue,
    currentDraft,
  });

  // Coach context (extracted to useCoachContext hook)
  const { coachContext } = useCoachContext({
    selectedRaceId,
    selectedRaceData,
    raceCourseForConsole,
    selectedRaceWeather,
    tideSnapshot,
    venueCenter,
    gpsPosition,
    boatLengthValue,
    effectiveDraft,
  });

  const fallbackPosition = useMemo(() => {
    if (venueCenter) {
      return {
        latitude: venueCenter.latitude,
        longitude: venueCenter.longitude,
        heading: raceCourseForConsole?.startLine?.heading,
      };
    }
    return null;
  }, [venueCenter, raceCourseForConsole]);

  useEffect(() => {
    fallbackPositionInitializedRef.current = false;
  }, [fallbackPosition?.latitude, fallbackPosition?.longitude, hasActiveRace]);

  // Race phase input (extracted to useRacePhaseInput hook)
  const { phaseDetectionMarks, racePhaseInput } = useRacePhaseInput({
    raceCourseForConsole,
    selectedRaceData,
    gpsPosition,
    fallbackPosition,
    lastHeadingRef,
    boatSpeedKnots,
  });

  const racePhaseContext = useRacePhaseDetection(racePhaseInput);

  // Debrief data (extracted to useRaceDebriefData hook)
  const {
    currentGpsTrack,
    currentSplitTimes,
    timeToStartSeconds,
  } = useRaceDebriefData({
    selectedRaceData,
    timeToStartMinutes,
  });

  useEffect(() => {
    if (typeof boatDraftValue === 'number' && Math.abs(boatDraftValue - currentDraft) > 0.01) {
      setDraft(boatDraftValue);
    }
  }, [boatDraftValue, currentDraft]);

  useEffect(() => {
    if (!hasActiveRace) {
      return;
    }

    const envUpdateBase: Record<string, any> = {};

    if (windSnapshot) {
      envUpdateBase.wind = {
        trueSpeed: windSnapshot.speed,
        trueDirection: windSnapshot.direction,
        apparentSpeed: windSnapshot.speed,
        apparentAngle: 0,
        speed: windSnapshot.speed,
        direction: windSnapshot.direction,
        gust: windSnapshot.gust,
        forecast: windSnapshot.forecast,
      };
    }

    if (currentSnapshot) {
      const strength = currentSnapshot.speed >= 1.5 ? 'strong' : currentSnapshot.speed >= 0.7 ? 'moderate' : 'weak';
      envUpdateBase.current = {
        speed: currentSnapshot.speed,
        direction: currentSnapshot.direction,
        phase: currentSnapshot.type ?? 'slack',
        strength,
        trend: 'slack',
        type: currentSnapshot.type,
      };
    }

    if (tideSnapshot) {
      envUpdateBase.tide = { ...tideSnapshot };
    }

    const depthPayload = depthSnapshot ?? {
      current: effectiveDraft + 3,
      minimum: effectiveDraft + 1,
      trend: 0,
      clearance: 3,
    };

    envUpdateBase.depth = {
      ...depthPayload,
      clearance:
        (depthPayload.current ?? depthPayload.minimum ?? (effectiveDraft + 3)) -
        effectiveDraft,
    };

    if (Object.keys(envUpdateBase).length > 0) {
      try {
        const serialized = JSON.stringify(envUpdateBase);
        if (previousEnvironmentKeyRef.current === serialized) {
          return;
        }
        previousEnvironmentKeyRef.current = serialized;
      } catch (error) {
        logger.warn('Failed to serialize environment update', error);
      }
      updateEnvironment(envUpdateBase);
    }
  }, [
    hasActiveRace,
    windSnapshot,
    currentSnapshot,
    tideSnapshot,
    depthSnapshot,
    effectiveDraft,
    updateEnvironment,
  ]);

  useEffect(() => {
    if (!hasActiveRace || !raceCourseForConsole) {
      return;
    }
    try {
      const serialized = JSON.stringify({
        id: raceCourseForConsole.id,
        marks: raceCourseForConsole.marks,
        legs: raceCourseForConsole.legs,
        startLine: raceCourseForConsole.startLine,
        laps: raceCourseForConsole.laps,
      });
      if (previousCourseKeyRef.current === serialized) {
        return;
      }
      previousCourseKeyRef.current = serialized;
    } catch (error) {
      logger.warn('Failed to serialize course for cache comparison', error);
    }
    updateCourse(raceCourseForConsole);
  }, [hasActiveRace, raceCourseForConsole, updateCourse]);

  useEffect(() => {
    if (!hasActiveRace) {
      return;
    }

    if (!windSnapshot || !currentSnapshot || !raceCourseForConsole || !venueCenter) {
      setTacticalZones([]);
      return;
    }

    const venueFeaturesRaw = (selectedRaceData?.metadata as Record<string, any> | undefined)?.venue_features;
    const venueFeatures = Array.isArray(venueFeaturesRaw)
      ? venueFeaturesRaw.map((feature: any) => String(feature))
      : typeof venueFeaturesRaw === 'string'
        ? venueFeaturesRaw.split(',').map((item: string) => item.trim()).filter(Boolean)
        : undefined;

    const zones = TacticalZoneGenerator.generateZones({
      wind: {
        speed: windSnapshot.speed,
        direction: windSnapshot.direction,
      } as any,
      current: {
        speed: currentSnapshot.speed,
        direction: currentSnapshot.direction,
        phase: currentSnapshot.type ?? 'slack',
      } as any,
      tide: tideSnapshot ?? undefined,
      depth: depthSnapshot ?? undefined,
      course: raceCourseForConsole as any,
      venue: venueCenter
        ? {
          center: venueCenter,
          features: venueFeatures,
        }
        : undefined,
    });

    try {
      const serialized = JSON.stringify(zones);
      if (previousZonesKeyRef.current === serialized) {
        return;
      }
      previousZonesKeyRef.current = serialized;
    } catch (error) {
      logger.warn('Failed to serialize tactical zones', error);
    }

    setTacticalZones(zones);
  }, [
    hasActiveRace,
    windSnapshot,
    currentSnapshot,
    tideSnapshot,
    depthSnapshot,
    raceCourseForConsole,
    venueCenter,
    selectedRaceData,
    setTacticalZones,
  ]);

  useEffect(() => {
    if (!hasActiveRace) return;
    if (Platform.OS !== 'web') return;
    if (gpsPosition) return;
    if (!fallbackPosition) return;
    if (fallbackPositionInitializedRef.current) return;

    updateRacePosition({
      latitude: fallbackPosition.latitude,
      longitude: fallbackPosition.longitude,
      speed: 0,
      heading: fallbackPosition.heading ?? 0,
      timestamp: new Date(),
    });
    fallbackPositionInitializedRef.current = true;
  }, [hasActiveRace, fallbackPosition, gpsPosition]);

  const handleShareRaceAnalysis = useCallback(async () => {
    const raceName =
      selectedRaceData?.name ||
      selectedRaceData?.metadata?.race_name ||
      selectedDemoRace?.name ||
      'Race Analysis';

    const raceStartIso = selectedRaceData?.start_date || selectedDemoRace?.date;
    const raceDate =
      raceStartIso && !Number.isNaN(new Date(raceStartIso).valueOf())
        ? new Date(raceStartIso)
        : null;
    const raceDateLabel = raceDate
      ? raceDate.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
      : null;

    const venueName =
      selectedRaceData?.metadata?.venue_name ||
      selectedRaceData?.venue_name ||
      selectedDemoRace?.venue ||
      currentVenue?.name ||
      null;

    const metrics = calculatePerformanceMetrics(
      currentGpsTrack,
      selectedRaceWeather?.wind?.direction
    );

    const finishSplit =
      currentSplitTimes.length > 0
        ? currentSplitTimes[currentSplitTimes.length - 1]
        : null;
    const startSplit = currentSplitTimes.length > 0 ? currentSplitTimes[0] : null;
    const positionsDelta =
      finishSplit && startSplit ? startSplit.position - finishSplit.position : null;

    let windLine: string | null = null;
    if (selectedRaceWeather?.wind) {
      const baseSpeed =
        typeof selectedRaceWeather.wind.speed === 'number'
          ? selectedRaceWeather.wind.speed.toFixed(1)
          : selectedRaceWeather.wind.speed?.toString?.() ?? '';
      const gustPart =
        typeof selectedRaceWeather.wind.gust === 'number'
          ? ` (gusts ${selectedRaceWeather.wind.gust.toFixed(1)} kts)`
          : '';
      windLine = baseSpeed
        ? `Wind: ${baseSpeed} kts${gustPart} @ ${Math.round(selectedRaceWeather.wind.direction)}°`
        : null;
    }

    const lines = [
      `${raceName} – Race Debrief`,
      raceDateLabel ? `When: ${raceDateLabel}` : null,
      venueName ? `Venue: ${venueName}` : null,
      `Duration: ${metrics.totalTime}`,
      `Average Speed: ${metrics.avgSpeed} kts (max ${metrics.maxSpeed} kts)`,
      `Distance Sailed: ${metrics.totalDistance} nm`,
      `VMG Efficiency: ${metrics.vmgEfficiency}%`,
      positionsDelta !== null
        ? `Positions gained: ${positionsDelta > 0 ? `+${positionsDelta}` : positionsDelta}`
        : null,
      finishSplit ? `Finish Position: ${finishSplit.position}` : null,
      windLine,
    ].filter(Boolean) as string[];

    if (lines.length === 0) {
      showAlert('Share', 'Nothing to share yet—run a race first!');
      return;
    }

    const message = lines.join('\n');
    const shareTitle = `${raceName} – Race Debrief`;

    try {
      if (Platform.OS === 'web') {
        const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
        const shareUrl =
          typeof window !== 'undefined' && window.location
            ? window.location.href
            : undefined;

        if (nav?.share) {
          await nav.share({
            title: shareTitle,
            text: message,
            url: shareUrl,
          });
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(message);
          showAlert('Copied', 'Race summary copied to your clipboard for easy sharing.');
        } else {
          showAlert('Race Debrief', message);
        }
      } else {
        await Share.share({
          title: shareTitle,
          message,
        });
      }

      logger.info('[races.tsx] Race analysis shared');
    } catch (error) {
      logger.error('[races.tsx] Failed to share race analysis', error);
      showAlert('Share failed', 'Unable to share race analysis right now. Please try again later.');
    }
  }, [
    selectedRaceData,
    selectedDemoRace,
    currentVenue?.name,
    currentGpsTrack,
    currentSplitTimes,
    selectedRaceWeather,
  ]);

  const handlePositionUpdate = useCallback((position: any) => {
    const speedKnots =
      typeof position.speed === 'number'
        ? position.speed * 1.94384
        : null;

    setGpsPosition({
      ...position,
      speed: speedKnots !== null && Number.isFinite(speedKnots) ? speedKnots : null,
    });

    if (!hasActiveRace) {
      return;
    }

    const heading =
      typeof position.heading === 'number'
        ? position.heading
        : lastHeadingRef.current ?? 0;

    if (typeof position.heading === 'number') {
      lastHeadingRef.current = position.heading;
    }

    updateRacePosition({
      latitude: position.latitude,
      longitude: position.longitude,
      speed: speedKnots !== null && Number.isFinite(speedKnots) ? speedKnots : 0,
      heading,
      timestamp: position.timestamp ? new Date(position.timestamp) : new Date(),
    });
  }, [hasActiveRace, updateRacePosition]);

  // Extract weather data for rig tuning
  // selectedRaceWeather has a different structure: { wind: { speed, direction, gust }, current: {...} }
  const wind = selectedRaceWeather?.wind;
  const current = selectedRaceWeather?.current;

  // Calculate wind range - if we have speed and gust, use those as min/max
  const windSpeed = wind?.speed;
  const windGust = wind?.gust;
  const windMin = windSpeed ? Math.round(windSpeed * 0.9) : undefined; // Estimate min as 90% of speed
  const windMax = windGust || (windSpeed ? Math.round(windSpeed * 1.1) : undefined); // Use gust or 110% of speed
  const averageWindSpeed = windSpeed;

  const {
    recommendation: selectedRaceTuningRecommendation,
    loading: selectedRaceTuningLoading,
    error: selectedRaceTuningError,
    refresh: refreshSelectedRaceTuning,
  } = useRaceTuningRecommendation({
    classId: selectedRaceClassId,
    className: selectedRaceClassName,
    averageWindSpeed,
    windMin,
    windMax,
    windDirection: wind?.direction,
    gusts: windGust,
    currentSpeed: current?.speed,
    currentDirection: current?.direction,
    pointsOfSail: 'upwind',
    enabled: !!(selectedRaceClassId || selectedRaceClassName),
  });

  // Enriched CardGrid races - merges detailed data for the selected race
  const cardGridRaces: CardRaceData[] = useMemo(() => {
    return orderedBaseCardGridRaces.map((race) => {
      // Only enrich the selected race with detailed data from hooks
      if (race.id === selectedRaceId) {
        return {
          ...race,
          // Rig settings from tuning recommendation hook
          rigSettings: selectedRaceTuningRecommendation ? {
            boatClassName: selectedRaceClassName,
            conditionSummary: selectedRaceTuningRecommendation.conditionSummary,
            settings: selectedRaceTuningRecommendation.settings,
            isAIGenerated: selectedRaceTuningRecommendation.isAIGenerated,
            confidence: selectedRaceTuningRecommendation.confidence,
            guideName: selectedRaceTuningRecommendation.guideTitle,
          } : race.rigSettings,
          // Fleet data from selected race detail
          fleet: {
            totalCompetitors: selectedRaceData?.entry_count || selectedRaceData?.competitor_count || race.fleet?.totalCompetitors || 0,
            confirmedCount: selectedRaceData?.confirmed_count || race.fleet?.confirmedCount || 0,
            fleetName: selectedRaceData?.fleet?.name || race.fleet?.fleetName,
            isRegistered: selectedRaceData?.is_registered ?? race.fleet?.isRegistered,
            competitors: selectedRaceData?.competitors || race.fleet?.competitors || [],
          },
          // Regulatory data from documents hook and race metadata
          regulatory: {
            documents: raceDocumentsForDisplay?.length > 0
              ? raceDocumentsForDisplay.map(doc => ({
                id: doc.id,
                name: doc.name,
                type: doc.type as any,
                uploadedAt: doc.uploadedAt,
              }))
              : race.regulatory?.documents || [],
            vhfChannel: selectedRaceData?.metadata?.vhf_channel || race.regulatory?.vhfChannel,
            protestDeadline: selectedRaceData?.metadata?.protest_deadline || race.regulatory?.protestDeadline,
          },
        };
      }
      return race;
    });
  }, [orderedBaseCardGridRaces, selectedRaceId, selectedRaceData, selectedRaceTuningRecommendation, selectedRaceClassName, raceDocumentsForDisplay]);

  // Step filter: collect available capability goals from timeline steps
  const availableCapabilityGoals = useMemo(() => {
    const goals = new Set<string>();
    for (const race of cardGridRaces) {
      if (!race.isTimelineStep) continue;
      const capGoals: string[] = race.metadata?.plan?.capability_goals ?? [];
      for (const g of capGoals) {
        if (g) goals.add(g);
      }
    }
    return Array.from(goals).sort();
  }, [cardGridRaces]);

  // Determine if there are timeline steps (used to show filter bar for non-sailing)
  const hasTimelineSteps = useMemo(
    () => cardGridRaces.some((r: any) => r.isTimelineStep),
    [cardGridRaces],
  );

  // Apply step filters to cardGridRaces.
  // Demo entries are dropped the moment the user has any real entry — we don't
  // want the app to keep looking like a demo once they've created their first
  // real Learning Event.
  const filteredCardGridRaces = useMemo(() => {
    const hasRealEntry = cardGridRaces.some((r: any) => !r.isDemo);
    const baseList = hasRealEntry
      ? cardGridRaces.filter((r: any) => !r.isDemo)
      : cardGridRaces;

    if (!hasTimelineSteps || isSailingInterest) return baseList;
    const { status, capabilityGoal } = stepFilters;
    if (status === null && capabilityGoal === null) return baseList;

    return baseList.filter((race: any) => {
      // Non-timeline items always pass through
      if (!race.isTimelineStep) return true;

      // Status filter: map our filter keys to the stepStatus field
      if (status !== null) {
        const stepStatus = race.stepStatus ?? race.status;
        // pending maps to "pending" or "scheduled"
        if (status === 'pending' && stepStatus !== 'pending' && stepStatus !== 'scheduled') return false;
        if (status === 'in_progress' && stepStatus !== 'in_progress') return false;
        if (status === 'completed' && stepStatus !== 'completed') return false;
      }

      // Capability goal filter
      if (capabilityGoal !== null) {
        const goals: string[] = race.metadata?.plan?.capability_goals ?? [];
        if (!goals.includes(capabilityGoal)) return false;
      }

      return true;
    });
  }, [cardGridRaces, stepFilters, hasTimelineSteps, isSailingInterest]);

  // True when the timeline has only demo/sample content — used to hide power-user
  // chrome (filters, bulk edit, reorder, season label) that adds noise for new guests.
  const isShowingOnlyDemos = filteredCardGridRaces.length > 0 && filteredCardGridRaces.every((r: any) => r.isDemo);

  // Header counter — uses filteredCardGridRaces so position reflects sorted card order.
  const headerTotalRaces = filteredCardGridRaces.length;
  const headerCurrentRaceIndex = useMemo(() => {
    if (!selectedRaceId || headerTotalRaces <= 0) return undefined;
    const idx = filteredCardGridRaces.findIndex((r: any) => r.id === selectedRaceId);
    return idx >= 0 ? idx + 1 : undefined;
  }, [selectedRaceId, headerTotalRaces, filteredCardGridRaces]);

  // Stable initial card index — only changes when the target race actually moves
  // in the array, NOT on every data refetch that produces a new array reference.
  const initialCardIndex = useMemo(() => {
    const targetId = selectedRaceId || nextActionItem?.id;
    if (!targetId || cardGridRaces.length === 0) return 0;
    const idx = cardGridRaces.findIndex(r => r.id === targetId);
    return idx >= 0 ? idx : 0;
  }, [selectedRaceId, nextActionItem?.id, cardGridRaces]);

  // Next race index — falls back to demo-aware calculation when safeNextRace is empty
  const effectiveNextRaceIndex = useMemo((): number | null => {
    if (!isViewingOtherTimeline && safeNextRace?.id) {
      const idx = cardGridRaces.findIndex(r => r.id === safeNextRace.id);
      return idx >= 0 ? idx : null;
    }
    // For demo steps, find the first future/non-completed step
    if (isShowingDemoRace && cardGridRaces.length > 0) {
      const now = new Date();
      const idx = cardGridRaces.findIndex((r: any) => {
        if (r.stepStatus === 'completed' || r.status === 'completed') return false;
        const d = new Date(r.date || '');
        return d > now || r.stepStatus === 'pending' || r.status === 'scheduled';
      });
      return idx >= 0 ? idx : null;
    }
    return null;
  }, [isViewingOtherTimeline, safeNextRace?.id, cardGridRaces, isShowingDemoRace]);

  // Carousel-space versions of the indices above.
  // The carousel renders `filteredCardGridRaces` (same array the grid receives),
  // which can differ from `cardGridRaces` when demos are filtered out. Translating
  // by id keeps both views pointed at the same race even when indices diverge.
  const carouselInitialCardIndex = useMemo(() => {
    const target = cardGridRaces[initialCardIndex];
    if (!target) return 0;
    const idx = filteredCardGridRaces.findIndex((r: any) => r.id === target.id);
    return idx >= 0 ? idx : 0;
  }, [cardGridRaces, filteredCardGridRaces, initialCardIndex]);

  const carouselNextRaceIndex = useMemo(() => {
    if (effectiveNextRaceIndex == null) return null;
    const target = cardGridRaces[effectiveNextRaceIndex];
    if (!target) return null;
    const idx = filteredCardGridRaces.findIndex((r: any) => r.id === target.id);
    return idx >= 0 ? idx : null;
  }, [cardGridRaces, filteredCardGridRaces, effectiveNextRaceIndex]);

  const profileOnboardingStep = (profile as { onboarding_step?: string } | null | undefined)?.onboarding_step;

  const isDemoProfile = (profileOnboardingStep ?? '').toString().startsWith('demo');

  const handleClaimWorkspace = useCallback(() => {
    routerRef.current.push('/account');
  }, []);

  // Select a newly created step once it appears in the card grid, then scroll to it
  useEffect(() => {
    const pendingId = pendingNewStepIdRef.current;
    if (!pendingId) return;

    const foundIndex = safeRecentRaces.findIndex((r: any) => r.id === pendingId);
    if (foundIndex !== -1) {
      setSelectedRaceId(pendingId);
      setHasManuallySelected(true);
      pendingNewStepIdRef.current = null;

      // Scroll to the new step after a brief delay for layout
      setTimeout(() => {
        if (raceCardsScrollViewRef.current) {
          const scrollX =
            foundIndex * RACE_CARD_TOTAL_WIDTH - SCREEN_WIDTH / 2 + RACE_CARD_WIDTH / 2;
          raceCardsScrollViewRef.current.scrollTo({
            x: Math.max(0, scrollX),
            y: 0,
            animated: true,
          });
        }
      }, 150);
    }
  }, [safeRecentRaces, SCREEN_WIDTH]);

  // Clear old details immediately on selection change to avoid showing stale details
  // Skip clearing when we just created a new step (pendingNewStepIdRef is set)
  React.useEffect(() => {
    if (pendingNewStepIdRef.current === selectedRaceId) return;
    logger.debug('[races.tsx] 🔄 Selection changed, clearing previous details for ID:', selectedRaceId);
    setSelectedRaceData(null);
    setSelectedRaceMarks([]);
  }, [selectedRaceId]);

  // Auto-scroll to center on next race
  useEffect(() => {
    // Skip auto-centering once the user has manually interacted or after the first center
    if (
      loading ||
      !nextRace ||
      safeRecentRaces.length === 0 ||
      hasManuallySelected ||
      hasAutoCenteredNextRace.current
    ) {
      return;
    }

    const nextRaceIndex = safeRecentRaces.findIndex((race: any) => race.id === safeNextRace?.id);
    if (nextRaceIndex === -1) {
      return;
    }

    const scrollX =
      nextRaceIndex * RACE_CARD_TOTAL_WIDTH - SCREEN_WIDTH / 2 + RACE_CARD_WIDTH / 2;

    const timer = setTimeout(() => {
      if (raceCardsScrollViewRef.current) {
        raceCardsScrollViewRef.current.scrollTo({
          x: Math.max(0, scrollX),
          y: 0,
          animated: true,
        });
        hasAutoCenteredNextRace.current = true;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [nextRace, safeRecentRaces, loading, hasManuallySelected, SCREEN_WIDTH]);

  // Keep the selected race visible by centering it when selection changes
  useEffect(() => {
    if (!selectedRaceId || !raceCardsScrollViewRef.current || safeRecentRaces.length === 0) {
      return;
    }

    const selectedIndex = safeRecentRaces.findIndex((race: any) => race.id === selectedRaceId);
    if (selectedIndex === -1) {
      return;
    }

    const scrollX =
      selectedIndex * RACE_CARD_TOTAL_WIDTH - SCREEN_WIDTH / 2 + RACE_CARD_WIDTH / 2;

    raceCardsScrollViewRef.current.scrollTo({
      x: Math.max(0, scrollX),
      y: 0,
      animated: true,
    });
  }, [selectedRaceId, safeRecentRaces, SCREEN_WIDTH]);

  // Auth loading state - show while auth is being initialized
  if (!ready) {
    return <DashboardSkeleton />;
  }

  // Loading state - AFTER all hooks
  // Show skeleton if:
  // 1. Dashboard is loading and no profile yet, OR
  // 2. User is signed in but races haven't loaded yet (prevents flash of demo content)
  if ((loading && !profile) || (signedIn && liveRacesLoading && !hasLoadedRacesOnce.current)) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (error && !profile) {
    return (
      <View className="flex-1 bg-background-0 items-center justify-center">
        <ErrorMessage
          title="Unable to load dashboard"
          message={error.message || 'Please check your connection and try again'}
          type="network"
          onRetry={onRefresh}
        />
      </View>
    );
  }

  // iOS Races Screen - Full-screen immersive design
  if (FEATURE_FLAGS.USE_IOS_RACES_SCREEN && Platform.OS !== 'web') {
    // Transform race data for IOSRacesScreen
    const iosRaces = safeRecentRaces.map((race: any) => {
      const now = new Date();
      const raceDate = new Date(race.start_date || race.date);
      const diffMs = raceDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      // Determine status
      let status: 'upcoming' | 'today' | 'past' = 'upcoming';
      if (diffDays < 0) {
        status = 'past';
      } else if (diffDays === 0) {
        status = 'today';
      }

      return {
        id: race.id,
        name: race.name || race.regatta_name || 'Untitled Race',
        venue: race.venue || race.location,
        date: race.start_date || race.date,
        startTime: race.start_time || race.startTime || '10:00',
        raceType: race.race_type as 'fleet' | 'distance' | 'match' | 'team' | undefined,
        status,
        daysUntil: Math.max(0, diffDays),
        hoursUntil: status === 'today' ? Math.max(0, diffHours) : undefined,
        minutesUntil: status === 'today' && diffHours < 1 ? Math.max(0, diffMinutes) : undefined,
        wind: race.wind_speed ? { direction: race.wind_direction || 'N', speed: race.wind_speed } : undefined,
        numberOfRaces: race.number_of_races,
        progress: race.prepProgress || 0,
      };
    });

    return (
      <IOSRacesScreen
        races={iosRaces}
        onRacePress={(race) => {
          setSelectedRaceId(race.id);
          setHasManuallySelected(true);
          // Navigate to race detail
          router.push(`/race/${race.id}`);
        }}
        onAddRace={handleShowAddRaceSheet}
        isLoading={loading || liveRacesLoading}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: TUFTE_BACKGROUND }}>
      {/* Fixed status bar background — keeps safe area opaque when toolbar hides */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          zIndex: 99,
          backgroundColor: 'rgba(242, 242, 247, 0.94)',
        }}
      />

      {/* Main Content first — flows behind absolutely-positioned toolbar */}
      {FEATURE_FLAGS.USE_RACE_LIST_VIEW ? (
        // Grouped vertical list view — progressive disclosure design
        <RaceListSection
          races={cardGridRaces}
          onRacePress={(raceId) => {
            setSelectedRaceId(raceId);
            setHasManuallySelected(true);
            router.push(`/race/${raceId}`);
          }}
          onRaceMorePress={(raceId) => {
            const options = ['Race Courses', 'Race Detail', 'Cancel'];
            const cancelButtonIndex = 2;

            if (Platform.OS === 'ios') {
              ActionSheetIOS.showActionSheetWithOptions(
                { options, cancelButtonIndex },
                (buttonIndex) => {
                  if (buttonIndex === 0) {
                    router.push('/race-courses');
                  } else if (buttonIndex === 1) {
                    router.push(`/race/${raceId}`);
                  }
                },
              );
            } else {
              showAlertWithButtons('Race Options', undefined, [
                { text: 'Race Courses', onPress: () => router.push('/race-courses') },
                { text: 'Race Detail', onPress: () => router.push(`/race/${raceId}`) },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }
          }}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      ) : FEATURE_FLAGS.USE_CARD_GRID_NAVIGATION ? (
        // New CardGrid 2D navigation system
        <View
          style={{ flex: 1 }}
        >
          {/* Backdrop spotlight (TourBackdrop) now handles target highlighting */}

          {/* Timeline header when viewing another user */}
          {isViewingOtherTimeline && currentTimeline && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: '#EFF6FF',
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: '#BFDBFE',
            }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: currentTimeline?.user?.avatar?.color || '#3B82F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}>
                <Text style={{ fontSize: 16 }}>{currentTimeline?.user?.avatar?.emoji || '⛵'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E40AF' }}>
                  Viewing {currentTimeline?.user?.name || 'someone'}'s timeline
                </Text>
                <Text style={{ fontSize: 11, color: '#3B82F6' }}>
                  {currentTimeline?.races?.length || 0} {(currentTimeline?.races?.length || 0) === 1 ? 'item' : 'items'} · Read only
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCurrentTimelineIndex(0)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: '#3B82F6',
                  borderRadius: 16,
                }}
              >
                <Ionicons name="arrow-back" size={14} color="#FFFFFF" />
                <Text style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '600' }}>My Timeline</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tour anchor: pinned to race-card region; height covers visible card area for spotlight */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: totalHeaderHeight + 52,
              left: 16,
              right: 16,
              zIndex: 60,
            }}
          >
            <TourStep
              step="race_timeline"
              position="bottom"
            >
              <View style={{ height: 260, opacity: 0 }} />
            </TourStep>
          </View>

          {/* Tour anchor: prep_overview spotlight on detail zone below race cards */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: totalHeaderHeight + 132,
              left: 16,
              right: 16,
              zIndex: 60,
            }}
          >
            <TourStep
              step="prep_overview"
              position="top"
            >
              <View style={{ height: 56, opacity: 0 }} />
            </TourStep>
          </View>

          {isGridView ? (
            <View style={{ flex: 1 }}>

              {!isSailingInterest && hasTimelineSteps && (
                <Reanimated.View
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (h > 0 && h !== filterBarHeight) setFilterBarHeight(h);
                  }}
                  style={animatedFilterBarStyle}
                >
                <View style={{ paddingTop: totalHeaderHeight + 8 }}>
                  {/* Faculty banner: nudge to publish blueprint */}
                  {showFacultyBanner && (
                    <View style={{
                      marginHorizontal: 16,
                      marginBottom: 12,
                      backgroundColor: '#EFF6FF',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#BFDBFE',
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: '#DBEAFE',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="megaphone-outline" size={18} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E40AF', marginBottom: 2 }}>
                          {facultyProgramName
                            ? `Ready to share your ${facultyProgramName} timeline?`
                            : 'Ready to share your timeline?'}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#3B82F6', lineHeight: 18 }}>
                          Tap <Text style={{ fontWeight: '600' }}>+</Text> → <Text style={{ fontWeight: '600' }}>Publish as Blueprint</Text> to let students subscribe.
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setFacultyBannerDismissed(true)}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Ionicons name="close" size={18} color="#93C5FD" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {/* First-run sample banner: shown when every visible step is a sample */}
                  {isShowingOnlyDemos && (
                    <View style={{
                      marginHorizontal: 16,
                      marginBottom: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      backgroundColor: 'rgba(37, 99, 235, 0.06)',
                      borderWidth: 1,
                      borderColor: 'rgba(37, 99, 235, 0.18)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      <View style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: 'rgba(37, 99, 235, 0.12)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="sparkles-outline" size={15} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#0B1A33', marginBottom: 1 }}>
                          {isReturningGuest
                            ? `Welcome back — ready for your first ${vocab('Learning Event').toLowerCase()}?`
                            : `Here's what a ${vocab('Learning Event').toLowerCase()} looks like`}
                        </Text>
                        <Text style={{ fontSize: 12.5, color: '#64748B', lineHeight: 17 }}>
                          {isReturningGuest
                            ? 'Add yours to start tracking real progress.'
                            : 'Tap any sample to explore, or add your own to get started.'}
                        </Text>
                        {/* Escape hatch for guests who picked the wrong interest in the welcome flow */}
                        {isGuest && (
                          <Pressable
                            onPress={openInterestSwitcher}
                            hitSlop={6}
                            style={({ pressed }) => ({
                              marginTop: 6,
                              alignSelf: 'flex-start',
                              opacity: pressed ? 0.6 : 1,
                            })}
                            accessibilityRole="button"
                            accessibilityLabel="Pick a different interest"
                          >
                            <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600' }}>
                              Wrong interest?{' '}
                              <Text style={{ textDecorationLine: 'underline' }}>
                                Pick a different one
                              </Text>
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      <Pressable
                        onPress={() => {
                          if (isSailingInterest) {
                            handleShowAddRaceSheet();
                          } else {
                            setShowAddStepSheet(true);
                          }
                        }}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          backgroundColor: 'rgba(37, 99, 235, 0.10)',
                          borderWidth: 1,
                          borderColor: 'rgba(37, 99, 235, 0.25)',
                          opacity: pressed ? 0.7 : 1,
                        })}
                        accessibilityRole="button"
                        accessibilityLabel={`Add your first ${vocab('Learning Event').toLowerCase()}`}
                      >
                        <Ionicons name="add" size={16} color="#2563EB" />
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#2563EB', letterSpacing: 0.1 }}>
                          Add yours
                        </Text>
                      </Pressable>
                    </View>
                  )}
                  {/* Hide filter bar when showing only sample content — reduces visual noise */}
                  {!isShowingOnlyDemos && (
                  <StepFilterBar
                    filters={stepFilters}
                    onFiltersChange={setStepFilters}
                    availableGoals={availableCapabilityGoals}
                  />
                  )}
                </View>
                </Reanimated.View>
              )}
              {/* Nutrition tracking is handled per-step via nutrition category steps */}
              <TimelineGridView
                races={filteredCardGridRaces}
                selectedRaceId={selectedRaceId || undefined}
                nextRaceIndex={effectiveNextRaceIndex != null ? filteredCardGridRaces.findIndex(r => r.id === cardGridRaces[effectiveNextRaceIndex]?.id) : null}
                onSelectRace={(index, race) => {
                  setSelectedRaceId(race.id);
                  setHasManuallySelected(true);
                  setIsGridView(false); // zoom back in

                  // First-run signup nudge: if a guest taps a sample to explore it,
                  // give them a moment to see the detail, then offer to save their work.
                  // - One-shot per session
                  // - 24h cross-session cooldown (no nagging on every cold launch)
                  // - Tap counter trips after N sample taps even within cooldown,
                  //   so high-engagement guests see the prompt sooner
                  // - Marks "first session done" so the banner copy switches on
                  //   subsequent visits
                  if (
                    isGuest &&
                    race.isDemo &&
                    !sampleSignupShownRef.current
                  ) {
                    const lastShown = signupModalLastShownRef.current;
                    const withinCooldown =
                      lastShown != null && Date.now() - lastShown < SIGNUP_MODAL_COOLDOWN_MS;
                    const newTapCount = sampleTapCountRef.current + 1;
                    const tapTriggered = newTapCount >= SIGNUP_MODAL_TAP_THRESHOLD;

                    if (!withinCooldown || tapTriggered) {
                      // Fire the modal — either cooldown elapsed or high intent
                      sampleSignupShownRef.current = true;
                      const now = Date.now();
                      signupModalLastShownRef.current = now;
                      sampleTapCountRef.current = 0;
                      // Persist async — we don't await; failures are non-fatal
                      AsyncStorage.setItem(
                        SIGNUP_MODAL_LAST_SHOWN_KEY,
                        String(now),
                      ).catch(() => {});
                      AsyncStorage.setItem(
                        GUEST_FIRST_SESSION_DONE_KEY,
                        'true',
                      ).catch(() => {});
                      AsyncStorage.setItem(
                        SIGNUP_MODAL_TAPS_KEY,
                        '0',
                      ).catch(() => {});
                      setTimeout(() => setShowSampleSignupPrompt(true), 1800);
                    } else {
                      // Cooldown active and threshold not yet reached — count and wait
                      sampleTapCountRef.current = newTapCount;
                      AsyncStorage.setItem(
                        SIGNUP_MODAL_TAPS_KEY,
                        String(newTapCount),
                      ).catch(() => {});
                    }
                  }
                }}
                userId={user?.id}
                onEditRace={isViewingOtherTimeline ? undefined : handleEditRace}
                onDeleteRace={isViewingOtherTimeline ? undefined : handleDeleteRace}
                onHideRace={isViewingOtherTimeline ? undefined : handleHideRace}
                onMarkDone={isViewingOtherTimeline ? undefined : handleMoveStepToCompletedMostRecent}
                onMarkNotDone={isViewingOtherTimeline ? undefined : handleMoveStepToPlannedNext}
                onBulkUpdateStatus={isViewingOtherTimeline || isShowingOnlyDemos ? undefined : handleTimelineGridBulkStatusUpdate}
                onBulkDeleteRaces={isViewingOtherTimeline || isShowingOnlyDemos ? undefined : handleTimelineGridBulkDelete}
                onReorderRaces={isViewingOtherTimeline || isShowingOnlyDemos ? undefined : handleTimelineGridReorder}
                topInset={!isSailingInterest && hasTimelineSteps ? 0 : totalHeaderHeight}
                onContentScroll={handleToolbarScroll}
                // Auto-scroll the grid to a freshly-created step so the user
                // never has to hunt for it — mirrors the carousel's existing
                // pendingNewStepIdRef scroll target.
                pendingNewStepId={pendingNewStepIdRef.current}
                onPendingScrollConsumed={() => { pendingNewStepIdRef.current = null; }}
                renderFooter={!isViewingOtherTimeline ? () => (
                  <BlueprintPanelsStack
                    interestId={currentInterest?.id}
                    subscribedBlueprints={subscribedBlueprints ?? []}
                    myTimelineSteps={myTimelineSteps}
                    onOpenAdoptedStep={(stepId) => {
                      // Directly select + scroll to the step in-place. We set
                      // the pending-scroll ref so TimelineGridView's scroll
                      // effect triggers; otherwise selectedRaceId only
                      // highlights the tile and the user sees no change if
                      // the step is below the fold.
                      pendingNewStepIdRef.current = stepId;
                      setSelectedRaceId(stepId);
                      setHasManuallySelected(true);
                    }}
                  />
                ) : undefined}
              />
            </View>
          ) : (
            <CardGrid
              races={filteredCardGridRaces}
              renderCardContent={renderCardGridContent}
              onRaceChange={handleCardGridRaceChange}
              onCardChange={handleCardGridCardChange}
              initialRaceIndex={carouselInitialCardIndex}
              nextRaceIndex={carouselNextRaceIndex}
              enableHaptics={FEATURE_FLAGS.ENABLE_CARD_HAPTICS}
              persistState={FEATURE_FLAGS.PERSIST_CARD_NAVIGATION && !isViewingOtherTimeline}
              style={{ flex: 1 }}
              userId={user?.id}
              topInset={totalHeaderHeight}
              safeAreaTop={insets.top}
              toolbarHidden={toolbarHidden}
              onContentScroll={handleToolbarScroll}
              onEditRace={isViewingOtherTimeline ? undefined : handleEditRace}
              onDeleteRace={isViewingOtherTimeline ? undefined : handleDeleteRace}
              deletingRaceId={deletingRaceId}
              onUploadDocument={isViewingOtherTimeline ? undefined : handleCardGridUploadDocument}
              onRaceComplete={isViewingOtherTimeline ? undefined : handleRaceComplete}
              onOpenPostRaceInterview={isViewingOtherTimeline ? undefined : (raceId, _raceName) => {
                // Find the race data from cardGridRaces to pass directly (avoids stale closure issues)
                const raceData = cardGridRaces.find(r => r.id === raceId);
                // Select the race if different
                if (raceId !== selectedRaceId) {
                  setSelectedRaceId(raceId);
                  setHasManuallySelected(true);
                }
                // Pass raceId and raceData directly to avoid stale closure issues with setTimeout
                handleOpenPostRaceInterviewManually(raceId, raceData ? { name: raceData.name, start_date: raceData.start_date || raceData.date } : undefined);
              }}
              onDismissSample={isViewingOtherTimeline ? undefined : handleDismissSampleRace}
              refetchTrigger={refetchTrigger}
              nowBarWeather={nowBarWeather}
            />
          )}
        </View>
      ) : (
        <ScrollView
          ref={mainScrollViewRef}
          className="flex-1 px-4 py-4"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563EB"
            />
          }
          showsVerticalScrollIndicator={false}
          onScroll={handleToolbarScroll}
          scrollEventThrottle={16}
        >
          {/* Demo notice */}
          <DemoNotice
            visible={isDemoProfile && !demoNoticeDismissed}
            onDismiss={() => setDemoNoticeDismissed(true)}
            onClaimWorkspace={handleClaimWorkspace}
          />

          {/* Fleet Activity Feed - Auto-surfaces fleet mates' race prep (Inner Circle discovery) */}
          {!isGuest && hasRealRaces && (
            <FleetActivityFeed
              maxItems={6}
              onRaceSelect={(race) => {
                // Navigate to view the fleet mate's race
                logger.info('Fleet activity race selected:', race.name, race.userId);
              }}
            />
          )}

          {/* Class Experts Section - Discover top sailors in your boat class */}
          {!isGuest && hasRealRaces && (
            <ClassExpertsSection
              limit={5}
              onExpertSelect={(expert) => {
                logger.info('Class expert selected:', expert.userName, expert.expertScore);
              }}
            />
          )}

          {/* RACE CARDS - MULTIPLE RACES SIDE-BY-SIDE */}
          {hasRealRaces ? (
            // Legacy carousel with detail zone
            <>
              <RealRacesCarousel
                races={orderedBaseCardGridRaces}
                practiceSessions={practiceSessions}
                onSelectPractice={handleSelectPractice}
                nextRace={safeNextRace}
                selectedRaceId={selectedRaceId}
                onSelectRace={(id) => {
                  setHasManuallySelected(true);
                  setSelectedRaceId(id);
                }}
                selectedRaceData={selectedRaceData}
                selectedRaceMarks={selectedRaceMarks}
                raceDocuments={raceDocuments}
                userRaceResults={userRaceResults}
                userId={user?.id}
                hasActiveRace={hasActiveRace}
                isMobileNative={isMobileNative}
                getRaceStatus={getRaceStatus}
                onEditRace={handleEditRace}
                onDeleteRace={handleDeleteRace}
                deletingRaceId={deletingRaceId}
                useTimelineLayout={true}
                useAppleStyle={FEATURE_FLAGS.USE_APPLE_STYLE_CARDS}
                useRefinedStyle={FEATURE_FLAGS.USE_REFINED_STYLE_CARDS}
                pastRaceIds={pastRaceIds}
                onAddDebrief={(raceId) => {
                  // Find the race data to pass directly (avoids stale closure issues)
                  const raceData = safeRecentRaces.find(r => r.id === raceId);
                  // Ensure the race is selected
                  if (raceId !== selectedRaceId) {
                    setSelectedRaceId(raceId);
                  }
                  // Pass raceId and raceData directly to avoid stale closure issues with setTimeout
                  handleOpenPostRaceInterviewManually(raceId, raceData ? { name: raceData.name, start_date: raceData.start_date || raceData.date } : undefined);
                }}
              />

              {/* Inline Comprehensive Race Detail Section */}
              {loadingRaceDetail && !selectedRaceData && (
                <View className="items-center justify-center py-8">
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text className="text-gray-500 mt-2">Loading race details...</Text>
                </View>
              )}

              {/* Timeline step detail — full Plan/Do/Review tabs inline */}
              {selectedRaceData?.isTimelineStep && selectedRaceId && (
                <StepDetailContent stepId={selectedRaceId} />
              )}

              {selectedRaceData && !selectedRaceData.isTimelineStep && (() => {
                // Compute race status for the selected race
                const isNextRace = safeNextRace?.id === selectedRaceData.id;
                const selectedRaceStatus = getRaceStatus(
                  selectedRaceData.start_date || selectedRaceData.date || new Date().toISOString(),
                  isNextRace,
                  selectedRaceData.start_time || selectedRaceData.startTime
                );
                const isRacePast = selectedRaceStatus === 'past';
                const isRaceFuture = selectedRaceStatus === 'future' || selectedRaceStatus === 'next';

                return (
                  <PlanModeContent
                    raceData={selectedRaceData}
                    raceId={selectedRaceData.id}
                    raceStatus={isRacePast ? 'completed' : 'upcoming'}
                    hasPostRaceData={isRacePast}
                    sections={{
                      courseAndStrategy: (
                        <>

                          {/* Distance Racing vs Fleet Racing Content */}
                          {selectedRaceData.race_type === 'distance' ? (
                            <DistanceRaceContentSection
                              raceData={selectedRaceData}
                              isRaceFuture={isRaceFuture}
                              userId={user?.id}
                              enrichedWeather={selectedRaceEnrichedWeather}
                              onRaceDataUpdate={setSelectedRaceData}
                              onEditRoute={() => router.push(`/race/edit/${selectedRaceData.id}`)}
                            />
                          ) : (
                            <FleetRaceContentSection
                              raceData={selectedRaceData}
                              marks={selectedRaceMarks}
                              drawingRacingArea={drawingRacingArea}
                              onMarksUpdate={setSelectedRaceMarks}
                              onRaceDataUpdate={setSelectedRaceData}
                              ensureRaceEventId={ensureRaceEventId}
                              onRacingAreaChange={handleRacingAreaChange}
                              onSaveRacingArea={handleSaveRacingArea}
                              onMarkAdded={handleMarkAdded}
                              onMarkUpdated={handleMarkUpdated}
                              onMarkDeleted={handleMarkDeleted}
                              onMarksBulkUpdate={handleBulkMarksUpdate}
                            />
                          )}

                          {/* ============================================ */}
                          {/*  PRE-RACE STRATEGY SECTION                 */}
                          {/* ============================================ */}
                          {/* Fleet Racing AI Coach - Only for fleet races AND future races */}
                          {/* Hide AI strategy guidance for past races - no longer actionable */}
                          {selectedRaceData.race_type !== 'distance' && isRaceFuture && (
                            <>
                              <RacePhaseHeader
                                icon="chess-knight"
                                title="Pre-Race Strategy"
                                subtitle="AI-generated plan based on conditions"
                                badge="Ready"
                                phase="upcoming"
                              />

                              {/* AI Race Coach - Unified Strategy Section (Redesigned) */}
                              <PreRaceStrategySection
                                raceId={selectedRaceData.id}
                                raceData={{
                                  name: selectedRaceData.name,
                                  startTime: selectedRaceData.start_date,
                                  fleetSize: selectedRaceData.metadata?.fleet_size,
                                  course: selectedRaceData.metadata?.course_type,
                                  marks: selectedRaceMarks,
                                  weather: {
                                    windSpeed: selectedRaceData.metadata?.expected_wind_speed,
                                    windDirection: selectedRaceData.metadata?.expected_wind_direction,
                                  },
                                  venue: selectedRaceData.metadata?.venue_name ? {
                                    name: selectedRaceData.metadata.venue_name,
                                    lat: selectedRaceData.metadata.venue_lat,
                                    lng: selectedRaceData.metadata.venue_lng,
                                  } : undefined,
                                }}
                                racePhase={
                                  selectedRaceData.raceStatus === 'in_progress' ? 'racing' :
                                    selectedRaceData.raceStatus === 'completed' ? 'post-race' :
                                      'pre-race'
                                }
                                onSkillInvoked={(skillId, advice) => {
                                  logger.info('AI Skill invoked:', skillId, advice.primary);
                                }}
                              />
                            </>
                          )}

                          {/* Fleet Racing Strategy Cards */}
                          <FleetStrategySection
                            isRaceFuture={isRaceFuture}
                            raceData={selectedRaceData}
                            sailorId={sailorId}
                          />

                          {/* Learning Patterns - For Future Races: Inform Strategy Planning */}
                          {isRaceFuture && (
                            <View className="mt-4">
                              <Text className="text-sm font-semibold text-gray-700 mb-2 px-4">
                                📊 Learning from Past Races
                              </Text>
                              <AIPatternDetection />
                            </View>
                          )}

                          {/* Share Strategy - only for future races */}
                          {isRaceFuture && sailorId && selectedRaceData?.id && (
                            <View style={{ marginTop: 16, marginBottom: 8 }}>
                              <TouchableOpacity
                                style={{
                                  backgroundColor: '#3B82F6',
                                  paddingVertical: 14,
                                  paddingHorizontal: 20,
                                  borderRadius: 12,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 8,
                                }}
                                onPress={handleOpenStrategySharing}
                                disabled={sharingStrategy}
                              >
                                <MaterialCommunityIcons name="share-variant" size={20} color="white" />
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                                  Share Strategy
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </>
                      ),
                      conditions: (
                        <>
                          {/* Unified Race Conditions - Wind, Tide & Waves Timeline */}
                          <RaceConditionsCard
                            raceId={selectedRaceData.id}
                            raceTime={selectedRaceData.start_date}
                            venueCoordinates={selectedRaceVenueCoordinates}
                            venue={selectedRaceVenueCoordinates ? {
                              id: `venue-${selectedRaceVenueCoordinates.lat}-${selectedRaceVenueCoordinates.lng}`,
                              name: selectedRaceData.metadata?.venue_name || 'Race Venue',
                              coordinates: {
                                latitude: selectedRaceVenueCoordinates.lat,
                                longitude: selectedRaceVenueCoordinates.lng
                              },
                              region: 'asia_pacific',
                              country: 'HK'
                            } : undefined}
                            warningSignalTime={selectedRaceData.warning_signal_time}
                            expectedDurationMinutes={
                              // For distance races: use time_limit_hours (in minutes) or estimate from distance
                              // For fleet races: use time_limit_minutes or default 90 min
                              selectedRaceData.race_type === 'distance'
                                ? (selectedRaceData.time_limit_hours
                                  ? selectedRaceData.time_limit_hours * 60
                                  : selectedRaceData.total_distance_nm
                                    ? Math.round(selectedRaceData.total_distance_nm / 5 * 60) // ~5 knots avg speed
                                    : 360) // Default 6 hours for distance races
                                : (selectedRaceData.time_limit_minutes || 90)
                            }
                            savedWind={selectedRaceEnrichedWeather?.wind || selectedRaceData.metadata?.wind}
                            savedTide={selectedRaceEnrichedWeather?.tide || selectedRaceData.metadata?.tide}
                            savedWeatherFetchedAt={selectedRaceEnrichedWeather?.weatherFetchedAt || selectedRaceData.metadata?.weather_fetched_at}
                            raceStatus={selectedRaceData.raceStatus}
                          />
                        </>
                      ),
                      boatSetup: (
                        <BoatSetupSection
                          isRaceFuture={isRaceFuture}
                          raceId={selectedRaceData.id}
                          selectedRaceClassId={selectedRaceClassId}
                          selectedRaceClassName={selectedRaceClassName}
                          onSetBoatClass={handleSetBoatClass}
                          rigPresets={rigPresets}
                          selectedRigBand={selectedRigBand}
                          onSelectBand={(bandId) => setSelectedRigBand(bandId)}
                          rigNotes={rigNotes}
                          onChangeNotes={setRigNotes}
                          selectedRaceTuningRecommendation={selectedRaceTuningRecommendation}
                          selectedRaceTuningLoading={selectedRaceTuningLoading}
                          selectedRaceTuningErrorMessage={selectedRaceTuningError?.message ?? null}
                          onRefreshTuning={selectedRaceClassId ? refreshSelectedRaceTuning : undefined}
                          onOpenChat={handleOpenChatFromRigPlanner}
                          isGenericDefaults={isGenericDefaultsFromMetadata && !selectedRaceTuningRecommendation}
                          onAddTuningGuide={() => {
                            router.push('/(tabs)/tuning-guides');
                          }}
                        />
                      ),
                      teamAndLogistics: (
                        <TeamLogisticsSection
                          raceId={selectedRaceData.id}
                          classId={selectedRaceData.class_id || selectedRaceData.metadata?.class_id}
                          className={selectedRaceData.metadata?.class_name}
                          raceDate={selectedRaceData.start_date}
                          raceName={selectedRaceData.name || selectedRaceData.race_name}
                          venueId={selectedRaceData.metadata?.venue_id}
                          onManageCrew={() =>
                            handleManageCrewNavigation({
                              raceId: selectedRaceData.id,
                              classId: selectedRaceData.class_id || selectedRaceData.metadata?.class_id,
                              className: selectedRaceClassName || selectedRaceData.metadata?.class_name,
                              raceName: selectedRaceData.name || selectedRaceData.race_name,
                              raceDate: selectedRaceData.start_date,
                            })
                          }
                          onLayout={(y) => setLogisticsSectionY((prev) => (Math.abs(prev - y) > 4 ? y : prev))}
                        />
                      ),
                      regulatory: (
                        <>
                          <View
                            onLayout={({ nativeEvent }) => {
                              const positionY = nativeEvent.layout.y;
                              setRegulatorySectionY((prev) => (Math.abs(prev - positionY) > 4 ? positionY : prev));
                            }}
                            className="mt-6"
                          >
                            <RegulatoryDigestCard
                              digest={regulatoryDigest}
                              acknowledgements={regattaAcknowledgements}
                              onToggle={handleToggleAcknowledgement}
                            />

                            <CourseOutlineCard groups={courseOutlineGroups} />
                          </View>
                        </>
                      ),
                      raceExecution: (
                        <>
                          {/* Timer removed - use the timer in the Race Card above */}
                          <View style={{ height: 600 }}>
                            <OnWaterTrackingView
                              sessionId={gpsTrackSessionId || selectedRaceData?.id}
                              isTracking={isGPSTracking}
                              courseMarks={selectedRaceMarks}
                              initialRegion={
                                selectedRaceData?.venue ? {
                                  latitude: selectedRaceData.venue.coordinates_lat || 22.3193,
                                  longitude: selectedRaceData.venue.coordinates_lng || 114.1694,
                                  latitudeDelta: 0.05,
                                  longitudeDelta: 0.05,
                                } : undefined
                              }
                            />
                          </View>
                        </>
                      ),
                      // Only show Post-Race Analysis for past/completed races
                      postRaceAnalysis: isRacePast ? (
                        <PostRaceAnalysisSection
                          raceId={selectedRaceData.id}
                          raceName={selectedRaceData.name}
                          raceStartTime={selectedRaceData.start_date}
                          currentUserId={user?.id}
                          gpsTrack={currentGpsTrack}
                          weather={selectedRaceWeather}
                          splitTimes={currentSplitTimes}
                          onShareAnalysis={handleShareRaceAnalysis}
                          onViewSession={(sessionId) =>
                            router.push({
                              pathname: '/(tabs)/race-session/[sessionId]',
                              params: { sessionId },
                            })
                          }
                        />
                      ) : undefined,
                    }}
                  />
                );
              })()}
            </>
          ) : (
            // User has no races - show mock race cards horizontally with fixed hero height
            <DemoRacesCarousel
              selectedDemoRaceId={selectedDemoRaceId}
              onSelectDemoRace={setSelectedDemoRaceId}
              selectedDemoRace={selectedDemoRace}
              onAddRace={handleShowAddRaceSheet}
              onAddRaceNavigation={handleAddRaceNavigation}
              onLogisticsSectionLayout={(y) => setLogisticsSectionY((prev) => (Math.abs(prev - y) > 4 ? y : prev))}
              onRegulatorySectionLayout={(y) => setRegulatorySectionY((prev) => (Math.abs(prev - y) > 4 ? y : prev))}
            />
          )}

          {/* AI Venue Insights Card */}
          {showInsights && venueInsights && (
            <AIVenueInsightsCard
              venueInsights={venueInsights}
              loadingInsights={loadingInsights}
              onDismiss={handleDismissInsights}
              onViewFullIntelligence={handleVenuePress}
              onRefreshInsights={() => handleGetVenueInsights(true)}
            />
          )}
        </ScrollView>
      )}

      {/* Floating Header rendered last — absolutely positioned over content */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 }}
        pointerEvents="box-none"
      >
        <RacesFloatingHeader
          topInset={insets.top}
          loadingInsights={loadingInsights}
          weatherLoading={weatherLoading}
          isOnline={isOnline}
          isGridView={isGridView}
          onToggleGridView={handleToggleGridView}
          onAddPress={() => setShowAddStepSheet(true)}
          onAddRace={isSailingInterest ? handleShowAddRaceSheet : handleAddStep}
          onAddStep={isSailingInterest ? handleAddStep : undefined}
          onAddButtonLayout={setAddButtonLayout}
          totalRaces={headerTotalRaces}
          upcomingRaces={seasonUpcomingRacesCount}
          currentRaceIndex={headerCurrentRaceIndex}
          onUpcomingPress={handleUpcomingPress}
          seasonLabel={isShowingOnlyDemos ? undefined : seasonToolbarLabel}
          onSeasonPress={isShowingOnlyDemos ? undefined : () => setShowSeasonPicker(true)}
          onStepPickerPress={orderedBaseCardGridRaces.length > 0 ? () => setShowStepPicker(true) : undefined}
          onMeasuredHeight={setToolbarHeight}
          hidden={toolbarHidden}
          isDomainView={viewMode === 'domain'}
          onToggleDomainView={hasSiblingInterests ? toggleDomainView : undefined}
          domainLabel={currentDomain ? `All ${currentDomain.name}` : undefined}
          onPublishBlueprint={currentInterest?.id ? () => setShowBlueprintSheet(true) : undefined}
          blueprintLabel={existingBlueprintsForInterest && existingBlueprintsForInterest.length > 0 ? 'Manage Blueprint' : 'Publish as Blueprint'}
          isBlueprintPublished={existingBlueprintsForInterest?.some(bp => bp.is_published)}
        />

        {/* One-shot welcome card shown after a sailor lands via the HKDW
            auto-subscribe flow. Floats below the toolbar so it doesn't shift
            the timeline; dismissible. */}
        {isSailingInterest && (
          <View
            style={{
              position: 'absolute',
              top: toolbarHeight + 4,
              left: 0,
              right: 0,
              zIndex: 90,
            }}
          >
            <BlueprintWelcomeCard enabled={isSailingInterest} />
          </View>
        )}

        {/* One-shot pulse ring drawn on top of the toolbar + button after the
            sample-signup nudge is dismissed. Pure visual hint, ignores touches. */}
        {showAddPulse && addButtonLayout && (
          <Reanimated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: addButtonLayout.x - 6,
                top: addButtonLayout.y - 6,
                width: addButtonLayout.width + 12,
                height: addButtonLayout.height + 12,
                borderRadius: (addButtonLayout.width + 12) / 2,
                borderWidth: 2,
                borderColor: '#7C3AED',
                backgroundColor: 'rgba(124, 58, 237, 0.18)',
              },
              addPulseRingStyle,
            ]}
          />
        )}
      </View>

      <RaceModalsSection
        // Document Type Picker
        documentTypePickerVisible={documentTypePickerVisible}
        onDismissDocumentTypePicker={handleDismissDocumentTypePicker}
        onDocumentTypeSelect={handleDocumentTypeOptionSelect}
        isUploadingDocument={isUploadingRaceDocument}
        // Calendar Import
        showCalendarImport={showCalendarImport}
        onCalendarImportClose={() => setShowCalendarImport(false)}
        onCalendarImportComplete={() => onRefresh()}
        // Post-Race Interview
        showPostRaceInterview={showPostRaceInterview}
        completedSessionId={completedSessionId}
        completedRaceName={completedRaceName}
        completedRaceId={completedRaceId}
        completedSessionGpsPoints={completedSessionGpsPoints}
        onPostRaceInterviewClose={handleClosePostRaceInterview}
        onPostRaceInterviewComplete={handlePostRaceInterviewCompleteWithRefetch}
        // Strategy Sharing
        showCoachSelectionModal={showCoachSelectionModal}
        sailorId={sailorId}
        sharingRaceEventId={sharingRaceEventId}
        selectedRaceData={selectedRaceData}
        selectedRaceEnrichedWeather={selectedRaceEnrichedWeather}
        onStrategySharingClose={handleCloseStrategySharing}
        // Boat Class Selector
        showBoatClassSelector={showBoatClassSelector}
        selectedRaceId={selectedRaceId}
        onBoatClassSelectorClose={() => setShowBoatClassSelector(false)}
        onBoatClassSelected={handleBoatClassSelected}
      />



      {/* Blueprint Publish Sheet */}
      {currentInterest && (
        <PublishBlueprintSheet
          visible={showBlueprintSheet}
          onClose={() => setShowBlueprintSheet(false)}
          interestId={currentInterest.id}
          interestName={currentInterest.name}
          existingBlueprints={existingBlueprintsForInterest}
          existingBlueprint={null}
        />
      )}

      {/* Smart Add Step Sheet */}
      <AddStepSheet
        visible={showAddStepSheet}
        onClose={() => setShowAddStepSheet(false)}
        suggestedNextSteps={suggestedNextSteps ?? []}
        onAdoptSuggestion={handleAdoptSuggestion}
        onDismissSuggestion={handleDismissSuggestion}
        onAddStep={isSailingInterest ? handleAddStep : handleAddStep}
        onAddRace={isSailingInterest ? handleShowAddRaceSheet : undefined}
        onPublishBlueprint={currentInterest?.id ? () => setShowBlueprintSheet(true) : undefined}
        blueprintLabel={existingBlueprintsForInterest && existingBlueprintsForInterest.length > 0 ? 'Manage Blueprint' : 'Publish as Blueprint'}
      />

      {/* Season Picker Modal - Select which season to filter by */}
      <SeasonPickerModal
        visible={showSeasonPicker}
        selectedSeasonId={activeFilterSeasonId}
        currentSeason={effectiveSeason}
        allSeasons={userSeasons ?? []}
        isLoading={loadingCurrentSeason}
        onClose={() => setShowSeasonPicker(false)}
        onSelectSeason={(seasonId) => {
          logger.info('[RacesScreen] Season filter changed', { seasonId });
          setFilterSeasonId(seasonId);
        }}
        onManageSeasons={() => setShowSeasonSettings(true)}
        eventNounPlural={pluralize(eventConfig.eventNoun)}
        periodTerm={vocab('Period')}
      />

      {/* Step Picker Modal — jump to any step in the timeline */}
      <Modal
        visible={showStepPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStepPicker(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setShowStepPicker(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%' }}
          >
            {/* Handle bar */}
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Jump to</Text>
              <Pressable onPress={() => setShowStepPicker(false)} hitSlop={12}>
                <Ionicons name="close-circle" size={24} color="#D1D5DB" />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              {orderedBaseCardGridRaces.map((item: any, i: number) => {
                const isSelected = item.id === selectedRaceId;
                const isCompleted = item.stepStatus === 'completed' || item.status === 'completed';
                const isNext = effectiveNextRaceIndex != null && effectiveNextRaceIndex >= 0 && cardGridRaces[effectiveNextRaceIndex]?.id === item.id;
                const isStep = item.isTimelineStep === true;
                const itemDate = item.date || item.start_date;
                const itemTitle = item.name && item.name !== String(i + 1) ? item.name : (isStep ? `Step ${i + 1}` : `Race ${i + 1}`);
                const statusLabel = isCompleted ? 'Done' : isSelected ? 'Viewing' : isNext ? 'Up Next' : 'Planned';
                const statusColor = isCompleted ? '#16A34A' : isSelected ? '#2563EB' : '#9CA3AF';
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      handleGoToStep(item.id);
                      if (isGridView) setIsGridView(false);
                      setShowStepPicker(false);
                    }}
                    style={[
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        marginBottom: 4,
                        borderRadius: 10,
                      },
                      isSelected && { backgroundColor: '#EFF6FF' },
                    ]}
                  >
                    {/* Item indicator: numbered circle for steps, flag icon for regattas */}
                    <View style={{
                      width: 28, height: 28, borderRadius: 14, marginRight: 12,
                      backgroundColor: isCompleted ? '#16A34A' : isSelected ? '#2563EB' : '#F3F4F6',
                      borderWidth: !isCompleted && !isSelected ? 1.5 : 0,
                      borderColor: '#D1D5DB',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      ) : isStep ? (
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#fff' : '#6B7280' }}>
                          {i + 1}
                        </Text>
                      ) : (
                        <Ionicons
                          name="flag-outline"
                          size={14}
                          color={isSelected ? '#fff' : '#6B7280'}
                        />
                      )}
                    </View>
                    {/* Title and date */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: isSelected ? '600' : '500', color: isSelected ? '#1E40AF' : '#111827' }} numberOfLines={1}>
                        {itemTitle}
                      </Text>
                      <Text style={{ fontSize: 12, color: statusColor, fontWeight: '500', marginTop: 1 }}>
                        {statusLabel}
                        {itemDate ? ` · ${new Date(itemDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                      </Text>
                    </View>
                    {/* Selection indicator */}
                    {isSelected && (
                      <Ionicons name="radio-button-on" size={18} color="#2563EB" />
                    )}
                  </Pressable>
                );
              })}
              <View style={{ height: 20 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Season Settings Modal - Create/Edit/End Season */}
      <SeasonSettingsModal
        visible={showSeasonSettings}
        season={currentSeason ?? null}
        onClose={() => setShowSeasonSettings(false)}
        onSeasonCreated={(seasonId) => {
          logger.info('[RacesScreen] Season created', { seasonId });
          refetchCurrentSeason();
          refetchSeasons();
          // Set the filter to the newly created season
          setFilterSeasonId(seasonId);
        }}
        onSeasonUpdated={(seasonId) => {
          logger.info('[RacesScreen] Season updated', { seasonId });
          refetchCurrentSeason();
          refetchSeasons();
        }}
        onSeasonEnded={(seasonId) => {
          logger.info('[RacesScreen] Season ended', { seasonId });
          refetchCurrentSeason();
          refetchSeasons();
          // Reset filter to undefined (will use next current season)
          setFilterSeasonId(undefined);
        }}
      />

      {/* Full Season Archive Modal - shown from Progress segment */}
      <Modal
        visible={showFullArchive}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFullArchive(false)}
      >
        <SeasonArchive
          seasons={userSeasons ?? []}
          isLoading={false}
          onRefresh={() => refetchSeasons()}
          onSeasonPress={(seasonId) => {
            // Set the filter to view races from the selected season
            setFilterSeasonId(seasonId);
            setShowFullArchive(false);
          }}
          onBackPress={() => setShowFullArchive(false)}
        />
      </Modal>

      {/* Signup Prompt Modal - shown when guest tries to add 2nd race */}
      <SignupPromptModal
        visible={showSignupPrompt}
        onClose={() => setShowSignupPrompt(false)}
        feature="multiple_races"
      />

      {/* Signup Prompt Modal - shown after a guest taps a sample to explore it */}
      <SignupPromptModal
        visible={showSampleSignupPrompt}
        onClose={() => {
          setShowSampleSignupPrompt(false);
          // After dismissing the soft signup nudge, briefly pulse the toolbar +
          // button so guests know exactly where to add their own work next.
          if (addButtonLayout) {
            triggerAddButtonPulse();
          }
        }}
        title={`Like what you see?`}
        message={`Sign up free to start your own ${vocab('Learning Event').toLowerCase()}s and keep your progress.`}
      />

      {/* </PlanModeLayout> - temporarily removed */}
    </View>
  );
}
