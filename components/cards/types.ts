/**
 * Card Navigation System - Type Definitions
 *
 * Simplified architecture: Horizontal race timeline only.
 * Each race has one full-height RaceSummaryCard with phase tabs.
 * Detail content accessed via DetailBottomSheet.
 */

import { SharedValue } from 'react-native-reanimated';
import { ViewStyle } from 'react-native';

// =============================================================================
// GESTURE AXIS
// =============================================================================

/**
 * Gesture axis for axis-locking behavior
 */
export type GestureAxis = 'horizontal' | 'vertical' | null;

/**
 * Return type for useAxisLock hook
 */
export interface UseAxisLockReturn {
  lockedAxis: SharedValue<GestureAxis>;
  updateLock: (translationX: number, translationY: number) => void;
  releaseLock: () => void;
  isLocked: () => boolean;
  getLockedAxis: () => GestureAxis;
}

// =============================================================================
// CARD TYPES (Simplified - single card type)
// =============================================================================

/**
 * Single card type - RaceSummaryCard handles all content via phase tabs
 */
export const CARD_TYPES = ['race_summary'] as const;

export type CardType = (typeof CARD_TYPES)[number];

export const CARD_COUNT = 1;

/**
 * Card type labels for display
 */
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  race_summary: 'Race Summary',
};

/**
 * Check if a race is in the past based on date/time
 */
export function isRacePast(date: string, startTime?: string): boolean {
  const raceDateStr = startTime
    ? `${date.split('T')[0]}T${startTime}`
    : date;
  const raceDate = new Date(raceDateStr);
  return raceDate.getTime() < Date.now();
}

// =============================================================================
// TEMPORAL PHASE SYSTEM
// =============================================================================

/**
 * Temporal phases for race preparation and execution
 * Organized by when information is most relevant (Tufte: information appears when needed)
 * Simplified to 3 phases: Prep (days_before), Race (on_water), Review (after_race)
 */
export type RacePhase = 'days_before' | 'on_water' | 'after_race';

/**
 * Phase labels for display
 */
export const RACE_PHASE_LABELS: Record<RacePhase, string> = {
  days_before: 'Days Before',
  on_water: 'On Water',
  after_race: 'After Race',
};

/**
 * Phase short labels for tabs (Apple HIG: concise, action-oriented)
 */
export const RACE_PHASE_SHORT_LABELS: Record<RacePhase, string> = {
  days_before: 'Before',
  on_water: 'Racing',
  after_race: 'Review',
};

/**
 * All phases in temporal order
 */
export const RACE_PHASES: RacePhase[] = ['days_before', 'on_water', 'after_race'];

/**
 * Determine the current phase for a race based on date/time
 *
 * Logic (simplified to 3 phases):
 * - after_race: Race start time + 8 hours has passed (race is definitively over)
 * - on_water: Within 2 hours before start to 8 hours after start
 * - days_before: Any time before the on_water window (includes race morning)
 */
export function getCurrentPhaseForRace(date: string, startTime?: string): RacePhase {
  const now = new Date();
  const raceDateOnly = date.split('T')[0];

  // Parse race date and time
  const raceDateStr = startTime
    ? `${raceDateOnly}T${startTime}`
    : `${raceDateOnly}T12:00:00`; // Default to noon if no start time
  const raceStart = new Date(raceDateStr);

  // Calculate time boundaries
  const twoHoursBeforeStart = new Date(raceStart.getTime() - 2 * 60 * 60 * 1000);
  const eightHoursAfterStart = new Date(raceStart.getTime() + 8 * 60 * 60 * 1000);

  // Determine phase
  if (now >= eightHoursAfterStart) {
    return 'after_race';
  }

  if (now >= twoHoursBeforeStart && now < eightHoursAfterStart) {
    return 'on_water';
  }

  return 'days_before';
}

/**
 * Get time until race starts (negative if race has started)
 * Returns milliseconds
 */
export function getTimeUntilRace(date: string, startTime?: string): number {
  const raceDateOnly = date.split('T')[0];
  const raceDateStr = startTime
    ? `${raceDateOnly}T${startTime}`
    : `${raceDateOnly}T12:00:00`;
  const raceStart = new Date(raceDateStr);
  return raceStart.getTime() - Date.now();
}

/**
 * Human-readable time until race
 */
export function formatTimeUntilRace(date: string, startTime?: string): string {
  const ms = getTimeUntilRace(date, startTime);

  if (ms < 0) {
    // Race has started
    const hoursAgo = Math.abs(ms) / (1000 * 60 * 60);
    if (hoursAgo < 1) return 'Just started';
    if (hoursAgo < 24) return `${Math.round(hoursAgo)}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo < 7) return `${daysAgo} days ago`;
    return 'Completed';
  }

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;

  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes}m`;
}

/**
 * Get time context for display (value + label)
 * Returns appropriate label based on whether race is past or future
 */
export function getTimeContext(date: string, startTime?: string): { value: string; label: string; isPast: boolean } {
  const ms = getTimeUntilRace(date, startTime);
  const isPast = ms < 0;
  const value = formatTimeUntilRace(date, startTime);

  if (isPast) {
    return { value, label: '', isPast: true };
  }

  return { value, label: 'until race', isPast: false };
}

// =============================================================================
// CARD POSITION AND DIMENSIONS
// =============================================================================

/**
 * Position in the card timeline (horizontal only)
 */
export interface CardPosition {
  /** Horizontal position (race index in timeline) */
  x: number;
  /** Vertical position (card detail level) */
  y: number;
}

/**
 * Calculated card dimensions based on screen size
 */
export interface CardDimensions {
  /** Card width in pixels (~85% screen width) */
  cardWidth: number;
  /** Card height in pixels (full available height) */
  cardHeight: number;
  /** Screen width */
  screenWidth: number;
  /** Screen height */
  screenHeight: number;
  /** Border radius (16px) */
  borderRadius: number;
  /** Horizontal peek amount in pixels */
  horizontalPeek: number;
  /** Horizontal snap interval (cardWidth + gap) */
  horizontalSnapInterval: number;
  /** Vertical snap interval (cardHeight + gap) */
  verticalSnapInterval: number;
  /** Left padding to center first card */
  contentPaddingLeft: number;
  /** Top padding */
  contentPaddingTop: number;
}

// =============================================================================
// NAVIGATION STATE
// =============================================================================

/**
 * Shared values for the card grid navigation state
 * All values run on UI thread for smooth 60fps animations
 */
export interface CardGridState {
  /** Current horizontal index (race) */
  currentRaceIndex: SharedValue<number>;
  /** Horizontal scroll offset in pixels */
  horizontalOffset: SharedValue<number>;
  /** Whether a gesture is currently active */
  isGestureActive: SharedValue<boolean>;
}

// =============================================================================
// RACE DATA
// =============================================================================

/**
 * Minimal race data interface for the card grid
 * Extended from actual race data in the app
 */
export interface CardRaceData {
  id: string;
  name: string;
  venue?: string;
  /** Explicit date (starts_at). Undefined means undated — ordered by sort_order only. */
  date?: string;
  startTime?: string;
  boatClass?: string;
  vhf_channel?: string;
  /** Race type for timer behavior selection */
  race_type?: 'fleet' | 'distance' | 'match' | 'team';
  /** Time limit in hours (for distance races) */
  time_limit_hours?: number;
  wind?: {
    direction: string;
    speedMin: number;
    speedMax: number;
  };
  tide?: {
    state: 'flooding' | 'ebbing' | 'slack' | 'high' | 'low';
    height?: number;
    direction?: string;
  };
  /** Expected fleet size for course positioning */
  expected_fleet_size?: number;
  /** User ID who created this race (for ownership checks) */
  created_by?: string;
  /** Whether this is a demo race (shown when user has no real races) */
  isDemo?: boolean;
  /**
   * Marker: this row represents a timeline_step (not a regatta/race_event).
   * Set by the step→card adapters. Used throughout races.tsx to branch
   * between the timeline_steps and race_events/regattas table paths.
   */
  isTimelineStep?: boolean;
  /** Free-form metadata blob (plan, weather, venue coords, capability goals, etc.) */
  metadata?: Record<string, any>;
  /** Legacy explicit start date (alias of `date` for race_events/regattas rows). */
  start_date?: string;
  /** Provenance hints populated by enrichment — used to pick the right Supabase table. */
  _source?: string;
  source?: string;
  source_table?: string;
  /** Venue coordinates attached by enrichment for NowBar weather fallback. */
  venueCoordinates?: { lat: number; lng: number } | null;
  /** Boat / class ids — both snake_case (canonical) and camelCase (legacy) appear. */
  boat_id?: string;
  class_id?: string;
  boatId?: string;
  classId?: string;
  /** Source blueprint id for steps adopted from a published blueprint. */
  source_blueprint_id?: string | null;
  /** Collaborator user ids — present on shared timeline steps. */
  collaborator_user_ids?: string[];

  // -------------------------------------------------------------------------
  // Timeline-step fields (present when isTimelineStep=true)
  // -------------------------------------------------------------------------
  /** Timeline step status — canonical pending/in_progress/completed/skipped. */
  stepStatus?: string;
  /** Loose status field — varies by source (regatta, event, step). */
  status?: string;
  /** Due date for timeline steps. */
  due_at?: string | null;
  /** Title of the subscribed-blueprint this step was adopted from. */
  blueprintTitle?: string;
  /** Interest that owns this step. */
  interest_id?: string;
  /** TimelineStepVisibility — 'private' | 'followers' | 'public'. */
  visibility?: string;
  /** Ownership / collaboration flags attached by the races tab. */
  isOwner?: boolean;
  isCollaborator?: boolean;
  isPendingInvite?: boolean;
  collaboratorId?: string;
  /** Ancestry for adopted steps. */
  source_type?: string;
  copied_from_user_id?: string | null;
  isPinned?: boolean;
  /** Step category key (e.g. "race_prep", "fitness"). */
  category?: string;
  /** Step long-form description. */
  description?: string | null;
  /** Step completion timestamp. */
  completed_at?: string | null;
  /** Legacy fleet identifier distinct from fleet_name. */
  fleet?: string;

  // -------------------------------------------------------------------------
  // Race / event fields
  // -------------------------------------------------------------------------
  /** Race type / event subtype discriminators. */
  event_type?: string;
  eventType?: string;
  event_id?: string;
  eventId?: string;
  /** Final / interim result strings surfaced on the review tile. */
  result?: string;
  finalResult?: string;
  /** Course geometry and marks. */
  course_name?: string;
  courseName?: string;
  course_type?: string;
  course?: { type?: string;[k: string]: unknown };
  course_distance_nm?: number;
  total_distance_nm?: number;
  route_waypoints?: unknown[];
  number_of_legs?: number;
  marks?: unknown[];
  /** Fleet / class / entrant info. */
  boat_class?: string;
  class_name?: string;
  fleet_size?: number;
  entry_count?: number;
  entries?: unknown[];
  competitors?: unknown[];
  fleet_name?: string;
  series_name?: string;
  /** Parent regatta/season ids. */
  season_id?: string;
  regatta_id?: string;
  /** Venue denormalized data attached by enrichment. */
  venue_data?: any;
  venue_info?: any;
  venue_id?: string;
  racing_area_name?: string;
  /** Direct lat/lng (used by demo races and some ingest paths). */
  latitude?: number | string;
  longitude?: number | string;
  /** Source document / notice-of-race URL. */
  notice_of_race_url?: string;
  /** Timeline ordering — integer sort_order from timeline_steps. */
  sort_order?: number;
  /** Any additional fields from the race */
  [key: string]: unknown;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

/**
 * Props for the CardShell component
 */
export interface CardShellProps {
  /** Card position in the timeline */
  position: CardPosition;
  /** Card dimensions */
  dimensions: CardDimensions;
  /** Grid navigation state */
  gridState: CardGridState;
  /** Card content */
  children: React.ReactNode;
  /** Additional styles */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
  /** Whether this is the next upcoming race (subtle background tint) */
  isNextRace?: boolean;
  /** Whether this is the most recently completed race */
  isLastDone?: boolean;
  /** Whether this race is in the past (warm off-white background) */
  isPast?: boolean;
  /** Whether this race is currently being deleted (show loading overlay) */
  isDeleting?: boolean;
  /** Callback to cancel an in-progress delete */
  onCancelDelete?: () => void;
}

/**
 * Props for the CardGrid component
 */
export interface CardGridProps {
  /** Array of race data */
  races: CardRaceData[];
  /** Initial race index */
  initialRaceIndex?: number;
  /** Callback when race changes */
  onRaceChange?: (index: number, race: CardRaceData) => void;
  /** Container style */
  style?: ViewStyle;
  /** Enable haptic feedback */
  enableHaptics?: boolean;
  /** Persist navigation state to storage */
  persistState?: boolean;
  /** Storage key for persistence */
  persistenceKey?: string;
  /** Test ID */
  testID?: string;
  /** Current user ID for ownership checks */
  userId?: string;
  /** Callback when edit is requested for a race */
  onEditRace?: (raceId: string) => void;
  /** Callback when delete is requested for a race */
  onDeleteRace?: (raceId: string, raceName: string) => void;
  /** Callback when document upload is requested for a race */
  onUploadDocument?: (raceId: string) => void;
  /** Callback when race timer completes (triggers post-race flow) */
  onRaceComplete?: (sessionId: string, raceName: string, raceId: string) => void;
  /** Callback to open post-race interview for a specific race */
  onOpenPostRaceInterview?: (raceId: string, raceName: string) => void;
  /** Index of the next upcoming race (for timeline NOW bar) */
  nextRaceIndex?: number | null;
  /** Race ID currently being deleted (for loading overlay) */
  deletingRaceId?: string | null;
  /** Callback when dismiss is requested for the sample race */
  onDismissSample?: () => void;
  /** Top inset to push card content below an absolutely-positioned toolbar */
  topInset?: number;
  /** Safe-area top inset (notch / Dynamic Island height) */
  safeAreaTop?: number;
  /** Whether the toolbar is currently hidden */
  toolbarHidden?: boolean;
  /** Scroll handler forwarded to card content for toolbar hide/show */
  onContentScroll?: (event: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void;
  /** Incrementing counter to trigger data refetch in AfterRaceContent */
  refetchTrigger?: number;
  /** Current weather for the NowBar display */
  nowBarWeather?: {
    windDirection: string;
    windSpeed: number;
    waveHeight?: number;
    tideState?: string;
    /** Where the weather data comes from: venue name or "Current location" */
    locationLabel?: string;
  } | null;
}

/**
 * Props for card content components
 */
export interface CardContentProps {
  /** Race data for this card */
  race: CardRaceData;
  /** Card type */
  cardType: CardType;
  /** Whether this card is currently active (fully visible) */
  isActive: boolean;
  /** Card dimensions for layout */
  dimensions: CardDimensions;
  /** Whether the current user can manage (edit/delete) this race */
  canManage?: boolean;
  /** Callback when edit is requested */
  onEdit?: () => void;
  /** Callback when delete is requested */
  onDelete?: () => void;
  /** Callback when document upload is requested */
  onUploadDocument?: () => void;
  /** Callback when race timer completes (triggers post-race flow with GPS session) */
  onRaceComplete?: (sessionId: string, raceName: string, raceId: string) => void;
  /** Callback to open post-race interview (for "absence as interface" empty fields) */
  onOpenPostRaceInterview?: () => void;
  /** Current user ID (for fetching user-specific analysis data) */
  userId?: string;
  /** Callback when dismiss is requested (for demo races) */
  onDismiss?: () => void;
  /** Season week identifier (e.g., "W26") for compact header */
  seasonWeek?: string;
  /** Race number in current season/series (e.g., 2 for "Race 2 of 10") */
  raceNumber?: number;
  /** Total races in current season/series (e.g., 10 for "Race 2 of 10") */
  totalRaces?: number;
  /** Timeline navigation - array of races for compact date axis */
  timelineRaces?: {
    id: string;
    date: string;
    raceType?: 'fleet' | 'distance' | 'match' | 'team';
    seriesName?: string;
    name?: string;
    interestSlug?: string;
    metadata?: Record<string,unknown>;
  }[];
  /** Timeline navigation - current race index */
  currentRaceIndex?: number;
  /** Timeline navigation - callback to jump to race */
  onSelectRace?: (index: number) => void;
  /** Timeline navigation - index of next upcoming race */
  nextRaceIndex?: number;
  /** Scroll handler forwarded from parent for toolbar hide/show */
  onContentScroll?: (event: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void;
  /** Handler for card press (navigation to this card when clicking partially visible cards) */
  onCardPress?: () => void;
  /** Incrementing counter to trigger data refetch (e.g., after PostRaceInterview completes) */
  refetchTrigger?: number;
  /**
   * Callbacks take the raceId so parents can pass stable handler refs.
   * The card curries these internally with its own race.id via useCallback.
   */
  onMoveStepEarlier?: (raceId: string) => void;
  onMoveStepLater?: (raceId: string) => void;
  onMoveStepToPlannedNext?: (raceId: string) => void;
  onMoveStepToCompletedMostRecent?: (raceId: string) => void;
  onSetDueDate?: (raceId: string, dateIso: string | null) => void;
  /** Callback when a next step is created from the review phase */
  onNextStepCreated?: (newStepId: string) => void;
}

// =============================================================================
// PERSISTENCE TYPES
// =============================================================================

/**
 * Persisted navigation state (simplified - horizontal only)
 */
export interface CardNavigationPersistedState {
  /** Last viewed race ID */
  lastRaceId: string | null;
  /** Last viewed race index */
  lastRaceIndex: number;
  /** Per-race vertical positions */
  verticalPositions?: Record<number, number>;
  /** Timestamp of last update */
  updatedAt: string;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

/**
 * Return type for useCardGrid hook
 */
export interface UseCardGridReturn {
  /** Grid navigation state */
  gridState: CardGridState;
  /** Calculated dimensions */
  dimensions: CardDimensions;
  /** Navigate to specific race */
  goToRace: (index: number, animated?: boolean) => void;
  /** Navigate to specific card (detail level) */
  goToCard: (index: number, animated?: boolean) => void;
  /** Navigate to specific position */
  goToPosition?: (position: CardPosition, animated?: boolean) => void;
  /** Current race index (JS thread value) */
  currentRaceIndex: number;
  /** Current card index (JS thread value) */
  currentCardIndex?: number;
  /** Current card type */
  currentCardType?: CardType;
  /** Save state to storage */
  saveState: () => Promise<void>;
  /** Load state from storage */
  loadState: () => Promise<void>;
}

/**
 * Return type for useCardPersistence hook
 */
export interface UseCardPersistenceReturn {
  /** Current persisted state */
  state: CardNavigationPersistedState | null;
  /** Whether state is loading */
  isLoading: boolean;
  /** Save full state */
  save: (state: CardNavigationPersistedState) => Promise<void>;
  /** Load state from storage */
  load: () => Promise<CardNavigationPersistedState | null>;
  /** Clear persisted state */
  clear: () => Promise<void>;
}
