/**
 * Feature Flags
 *
 * Centralized feature flags for controlling experimental features.
 * These can be toggled without code changes via environment variables.
 */

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  return fallback;
}

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURE_FLAGS = {
  /**
   * Use the new CardGrid navigation system instead of DetailCardPager/RaceTimelineLayout
   * When true: Renders CardGrid with 2D navigation (horizontal races, vertical detail cards)
   * When false: Renders existing RaceTimelineLayout
   */
  USE_CARD_GRID_NAVIGATION: true,

  /**
   * Enable AI-powered strategy enhancement in strategy cards
   * When true: Shows "Enhance with AI" button in strategy cards
   * When false: Only shows static template content
   */
  ENABLE_AI_STRATEGY_ENHANCEMENT: true,

  /**
   * Persist card navigation state to AsyncStorage
   * When true: Remembers last viewed race and vertical position
   * When false: Always starts at first race, position 0
   */
  PERSIST_CARD_NAVIGATION: false, // Temporarily disabled to fix initial position

  /**
   * Enable haptic feedback for card navigation
   * When true: Vibrates on card snaps (native only)
   * When false: No haptic feedback
   */
  ENABLE_CARD_HAPTICS: true,

  /**
   * Use Apple-style race cards (iOS HIG-inspired design)
   * When true: Renders AppleRaceCard with clean, minimal iOS-style design
   * When false: Renders original RaceCardEnhanced
   */
  USE_APPLE_STYLE_CARDS: true,

  /**
   * Use refined Apple-style race cards (enhanced iOS HIG design)
   * When true: Renders AppleStyleRaceCard with improved hierarchy and typography
   * When false: Uses USE_APPLE_STYLE_CARDS setting
   */
  USE_REFINED_STYLE_CARDS: true,

  /**
   * Use Tufte-style single-page Add Race form
   * When true: Renders TufteAddRaceForm (single scrollable page)
   * When false: Renders multi-step AddRaceDialog wizard
   */
  USE_TUFTE_ADD_RACE_FORM: true,

  /**
   * Use temporal phase architecture for race cards
   * When true: RaceSummaryCard uses phase tabs (Days Before, Race Morning, On Water, After Race)
   *            Strategy cards are accessed via drill-down from Strategy Brief
   *            Vertical card count reduced from 11 to 6
   * When false: Traditional 11-card vertical stack with separate strategy cards
   */
  USE_TEMPORAL_PHASE_ARCHITECTURE: true,

  /**
   * Enable social sailing multi-timeline view
   * When true: Shows TimelineFeed with vertical swipe between followed users' timelines
   *            TikTok-style navigation: swipe up/down between timelines, left/right for races
   * When false: Standard single-user timeline view
   */
  ENABLE_SOCIAL_TIMELINE: true, // Integrated into CardGrid - timeline switching with full card content

  /**
   * Use full-screen iOS HIG races screen
   * When true: Renders IOSRacesScreen with full-screen swipeable race cards
   *            Minimal header, iOS-style page indicator, immersive experience
   * When false: Uses existing CardGrid or ScrollView navigation
   * NOTE: Disabled - the simplified screen lacks phase tabs, checklists, and timeline features
   */
  USE_IOS_RACES_SCREEN: false,

  /**
   * Use iOS HIG-style Add Race form
   * When true: Renders IOSAddRaceForm with Apple HIG-compliant design
   *            Inset grouped sections, iOS navigation, system colors
   * When false: Uses existing TufteAddRaceForm
   */
  USE_IOS_ADD_RACE_FORM: true,

  /**
   * Use grouped vertical race list instead of horizontal card carousel
   * When true: Renders RaceListSection with time-based grouping (Today/This Week/Later/Past)
   *            Tapping a race row navigates to /race/[id] detail screen
   * When false: Uses existing CardGrid horizontal carousel navigation
   */
  USE_RACE_LIST_VIEW: false,

  /**
   * Use grouped vertical list for Sailors/Discover tab
   * When true: Renders SailorsGroupedList with sections (Following, Fleet Activity, Class Experts, Discover)
   *            Scannable rows replace TikTok-style full-screen paging
   * When false: Uses existing DiscoverScreen with full-screen vertical pager
   */
  USE_GROUPED_DISCOVER_LIST: true,

  // =========================================================================
  // COLLABORATION FEATURES (Apple-style collaboration design)
  // =========================================================================

  /**
   * Show collaborator avatar row on race detail hero header
   * When true: Displays crew member avatars with presence dots below race metadata
   *            Tapping opens the collaboration popover
   * When false: Hero header shows only countdown, name, and metadata
   */
  ENABLE_CREW_AVATARS_HEADER: true,

  /**
   * Enable race crew chat (Messages-style conversation alongside race prep)
   * When true: Shows crew chat as a bottom sheet on race detail screen
   *            System messages auto-post when checklist items are completed
   * When false: No chat UI on race detail
   */
  ENABLE_RACE_CREW_CHAT: true,

  /**
   * Enable collaboration popover (Apple-style collaborator details)
   * When true: Tapping avatar row opens popover with crew list, recent activity, manage button
   * When false: Avatar row taps do nothing
   */
  ENABLE_COLLABORATION_POPOVER: true,

  /**
   * Enable realtime presence indicators on collaborator avatars
   * When true: Green dots on avatars of crew members currently viewing the race
   * When false: Avatars shown without presence state
   */
  ENABLE_RACE_PRESENCE: true,

  /**
   * Auto-post system messages to race_messages when checklist items are completed
   * When true: Completing a checklist item inserts a system message
   * When false: Checklist completions are not surfaced in chat
   */
  ENABLE_CHECKLIST_SYSTEM_MESSAGES: true,

  // =========================================================================
  // WEB LAYOUT FEATURES
  // =========================================================================

  /**
   * Use persistent sidebar navigation on web instead of bottom tab bar
   * When true: Web renders a 240px sidebar on the left with all nav items;
   *            bottom tab bar and More menu are hidden on web
   * When false: Web uses the same FloatingTabBar as mobile
   * NOTE: Only affects web platform (Platform.OS === 'web')
   */
  USE_WEB_SIDEBAR_LAYOUT: true,

  /**
   * Enable master-detail split view on web for list-to-detail screens
   * When true: On wide screens (>= 1024px), lists show detail in right pane
   * When false: All platforms use full-screen push navigation
   */
  USE_MASTER_DETAIL_LAYOUT: true,

  /**
   * Keep /race-management alias route as redirect-only to /programs.
   * When true: alias path records usage telemetry and immediately redirects.
   * When false: alias path renders Programs Experience directly.
   */
  RACE_MANAGEMENT_ALIAS_REDIRECT_ONLY: false,

  /**
   * Gate programs/program_sessions/program_participants backed paths.
   * Disable to revert UI to pre-program-model compatibility behavior.
   */
  PROGRAM_DATA_MODEL_V1: readBooleanEnv('EXPO_PUBLIC_FF_PROGRAM_DATA_MODEL_V1', true),

  /**
   * Gate coach-home shell features (counts, trends, retention loop).
   * Disable to fall back to legacy clients shell experience.
   */
  COACH_SHELL_V1: readBooleanEnv('EXPO_PUBLIC_FF_COACH_SHELL_V1', true),

  /**
   * Gate strict domain checks on sailing-only AI endpoints.
   * Disable only for emergency rollback.
   */
  DOMAIN_GATE_AI_STRICT_V1: readBooleanEnv('EXPO_PUBLIC_FF_DOMAIN_GATE_AI_STRICT_V1', true),

  /**
   * Gate secondary domain packs (drawing/fitness) on shared skeleton routes.
   * Keep false until secondary pack validation is complete.
   */
  SECONDARY_PACKS_V1: readBooleanEnv('EXPO_PUBLIC_FF_SECONDARY_PACKS_V1', false),

  /**
   * Cut Playbook home over to the iOS register layout (Apple Books library
   * treatment: Vision card + concept shelf + recent reflections + inbox
   * count badge). When true, the Playbook tab renders the iOS register
   * preview and the existing PlaybookHome eight-section layout is
   * suppressed. Defaults true (cutover live 2026-05-15); flip to false
   * via EXPO_PUBLIC_FF_PLAYBOOK_IOS_REGISTER=false to revert in one
   * toggle if anything breaks.
   */
  PLAYBOOK_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PLAYBOOK_IOS_REGISTER', true),
} as const;

// =============================================================================
// TYPES
// =============================================================================

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * Get all feature flags with their current values
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  return { ...FEATURE_FLAGS };
}

/**
 * Log current feature flag state (for debugging)
 */
export function logFeatureFlags(): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[FeatureFlags]', FEATURE_FLAGS);
  }
}

export default FEATURE_FLAGS;
