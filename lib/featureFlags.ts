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

  /**
   * Cut the Race tab's cards-grid render path over to the iOS register
   * horizontal-scroller season view (Race Prep cards). When true, the
   * cards mode of the Race tab renders the new <RaceCardsScreen /> with
   * four-state status grammar + earned-exception current card. When
   * false, the legacy <CardGrid /> renders. Other Race tab render paths
   * (TimelineGridView, USE_RACE_LIST_VIEW, IOSRacesScreen) are unaffected.
   * Defaults false after the 2026-05-15 layout-regression review; flip to
   * true via EXPO_PUBLIC_FF_RACE_PREP_IOS_REGISTER=true while the card detail
   * pattern is reworked.
   */
  RACE_PREP_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_RACE_PREP_IOS_REGISTER', false),

  /**
   * Gate the canonical Practice Add Step floating action button. When true,
   * the Practice implementation can show the bottom-right + affordance and
   * canonical two-path creation sheet. Default flipped to true 2026-05-16
   * once the Add Step Flow canonical (FAB + action sheet + AI Coach
   * conversation) was ready to be the default Add Step path.
   */
  PRACTICE_ADD_STEP_FAB: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_ADD_STEP_FAB', true),

  /**
   * Gate the canonical Plan tab interior: AI Coach as the primary empty-state
   * path, manual What/How/Why as secondary, and optional add-ons collapsed under
   * More options. Default flipped to true 2026-05-16 — required for the Add
   * Step Flow canonical to function end-to-end (the "Build with AI Coach" path
   * lands users on this Plan tab and expects ConversationalCapture as the
   * empty state).
   */
  PRACTICE_PLAN_TAB_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_PLAN_TAB_IOS_REGISTER', true),

  /**
   * Gate the canonical Do tab interior: pre-activity capture affordances, a
   * live reverse-chronological capture stream, post-activity auto-summary,
   * and capability evidence marking. Defaults false because this changes the
   * main capture workflow, live-state signaling, capture ordering, and the
   * Do-to-Reflect handoff. See docs/redesign/specs/PHASE_B7_DO_TAB_INTERIOR_SPEC.md.
   */
  PRACTICE_DO_TAB_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER', false),

  /**
   * Gate the per-step timing model for the Do tab. When ON: the auto-stamp of
   * metadata.act.started_at and the live header / stop-capturing UI only run
   * for steps where `timeline_steps.is_timed === true`. Untimed steps (the
   * default for new steps post-migration 20260517110000) render the capture
   * affordances without a running timer, no implicit "activity started" state,
   * and no Stop button. Designed for the reality that only ~15-20% of steps
   * even in sail racing are stopwatch activities. Default true: the auto-start
   * + always-running-timer model was wrong for the majority of steps and was
   * stamping started_at on drawing/reading/reflection steps the moment Do was
   * opened. deriveDoInteriorState additionally ignores stale started_at on
   * untimed steps so already-affected rows un-stick on next render.
   */
  PRACTICE_DO_TAB_PER_STEP_TIMING: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_DO_TAB_PER_STEP_TIMING', true),

  /**
   * Gate the canonical Reflect tab interior: AI-drafted summary, What worked
   * / What to improve prompt groups, Mark Reflect complete CTA, and the
   * post-completion digest + Carry forward card. Defaults false because this
   * replaces the OVERALL-RATING-stars review surface, swaps prompt-answer
   * persistence onto the v2 sections[] upsert path, and re-routes the
   * completion side effects (Playbook ingest, lesson completion, capability
   * ratings sync, competency-attempt logging) through a fresh controller.
   * See docs/redesign/specs/PHASE_B10_REFLECT_TAB_INTERIOR_SPEC.md.
   */
  PRACTICE_REFLECT_TAB_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_REFLECT_TAB_IOS_REGISTER', false),

  /**
   * Stage the Race Log iOS register surface (chronological multi-season
   * archive). This flag exists for the Reflect-tab cutover, which ships
   * Race Log + Profile together; the render switch in the Reflect parent
   * is wired in a follow-up commit once Profile iOS is also staged. Until
   * then, the flag is reachable only via the preview route at
   * /race-log-ios. Defaults true; flip to false via
   * EXPO_PUBLIC_FF_RACE_LOG_IOS_REGISTER=false to revert in one toggle.
   */
  RACE_LOG_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_RACE_LOG_IOS_REGISTER', true),

  /**
   * Stage the Get Inspired iOS register **running state** — the canonical
   * visual treatment of the "Loading-state narration" cross-cutting
   * principle (see IOS_MIGRATION_PLAN.md). When the actual analyze/build-
   * plan pipeline is wired, this flag gates the running-state surface
   * appearing inside the existing Get Inspired modal. Until then, the
   * flag is reachable only via the preview route at /get-inspired-ios-running.
   * Defaults true; flip to false via
   * EXPO_PUBLIC_FF_GET_INSPIRED_IOS_REGISTER=false to revert.
   */
  GET_INSPIRED_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_GET_INSPIRED_IOS_REGISTER', true),

  /**
   * Stage the Trophy of Becoming iOS register surface with all four state
   * variants (first / canonical / mid-career / named-absence / empty).
   * Variant selection is driven by trophy state from the data layer; the
   * preview route exposes a chip selector so reviewers can cycle the
   * variants. Until the path-completion synthesis service lands, the
   * surface is reachable only via /trophy-ios. Defaults true; flip to
   * false via EXPO_PUBLIC_FF_TROPHY_IOS_REGISTER=false to revert.
   *
   * Earned-register exception: the italic title from user voice is the
   * canonical Trophy register's already-baked exception (predates the
   * variants pass). No additional weight-up per architecture decision
   * #3 — the surface carries zero actions, so neither irreversibility
   * (a) nor primary-purpose-is-the-decision (b) condition is met.
   */
  TROPHY_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_TROPHY_IOS_REGISTER', true),

  /**
   * Stage the Concept detail iOS register surface with three state
   * variants (new / dormant / breakthrough). Variant selection is driven
   * by per-user concept state from the data layer (forming / practicing /
   * learning / breakthrough) + a dormancy timestamp. Until the per-user
   * concept state schema and dormancy heuristic land, the surface is
   * reachable only via the preview route at /concept-detail-ios; the
   * canonical /concept-ios/[slug] route stays on its current data path.
   *
   * This is a **detail** surface per architecture decision #4 — distinct
   * from any summary-card representation of a concept. Summary and detail
   * are different jobs, not scaled versions.
   *
   * Defaults true; flip to false via
   * EXPO_PUBLIC_FF_CONCEPT_IOS_REGISTER=false to revert.
   */
  CONCEPT_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_CONCEPT_IOS_REGISTER', true),

  /**
   * Stage the Profile iOS register surface — third sub-tab under Reflect
   * (Progress / Race Log / Profile). Felix's account surface: identity,
   * interests, preferences, plan, account exits. Practitioner-side of
   * architecture decision #2 — standard iOS settings density applies; not
   * faculty-density. No earned-register exception (Profile is utility
   * chrome, not poetry).
   *
   * The Reflect-tab cutover commit ships this together with Race Log
   * (already staged). Until then the surface is reachable only via the
   * preview route at /profile-ios. Defaults true; flip to false via
   * EXPO_PUBLIC_FF_PROFILE_IOS_REGISTER=false to revert.
   */
  PROFILE_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PROFILE_IOS_REGISTER', true),

  /**
   * Stage the JHU-style Org Admin onboarding card at the top of the
   * organization cohort dashboard. When true, the dashboard's canView
   * branch renders a dismissible welcome card with a four-minute tour
   * offer above the cohort selector. Dismissal is persisted per
   * organization so the card does not reappear on reload for the same
   * org. Defaults false — this is a new visual surface with persistence
   * and does not qualify for the mechanical-only exception.
   */
  JHU_ADMIN_DASHBOARD_IOS: readBooleanEnv('EXPO_PUBLIC_FF_JHU_ADMIN_DASHBOARD_IOS', false),

  /**
   * Stage the canonical Series feature treatment over the existing Season
   * infrastructure: white Series strip in the zoomed-out timeline (Frame 1),
   * iOS-native switch-Series action sheet (Frame 2), Series context on step
   * cards (Frame 3), and the canonical `Jump to` picker (Frame 4). Per
   * `series-feature-canonical.html`. Defaults false — this is a substantive
   * visual and control-flow change.
   */
  PRACTICE_SERIES_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER', false),

  /**
   * Phase P HKDW /redeem flow. When true, /redeem renders the Dragon Worlds
   * sailor landing and /practice can show the server-persisted welcome banner.
   * Defaults false so the May 20 cutover can be controlled by build env.
   */
  REDEEM: ['1', 'true', 'yes', 'on'].includes(
    String(process.env.EXPO_PUBLIC_FF_REDEEM ?? '').trim().toLowerCase()
  ),

  /**
   * Phase 0 of the iOS register migration — shared chrome primitives
   * (StatePill / StepStrip / TopHeader / PhaseTabs / StepCard). When true:
   *   • The first tab label reads "Practice" universally, regardless of
   *     domain (overrides the sailing "Race" default).
   *   • Step detail (StepDetailContent) wraps its existing PlanTab/ActTab/
   *     ReviewTab interior in the new <StepCard> shell with <TopHeader>
   *     above. Internal tab body contents are unchanged.
   * Off by default — when off, zero visual change anywhere. Per
   * docs/redesign/ios-register/phase-0-shared-chrome.md.
   */
  PRACTICE_STEP_LOOP_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_STEP_LOOP_IOS_REGISTER', false),

  /**
   * Phase 10 — HKDW (Hong Kong Dragon Worlds) → BetterAt onboarding flow.
   *
   * When on:
   *   - /r/[token] redeem route resolves valid tokens to a session-level
   *     account + blueprint subscription + first-step landing.
   *   - Smart App Banner renders on web pages.
   *   - InstallSheet rises on the Do tab in web.
   *   - betterat://r/[token] deep link is wired.
   *
   * Off by default in production until the partnership ships. Per
   * docs/redesign/ios-register/phase-10-hkdw-onboarding.md.
   */
  HKDW_REDEEM_FLOW: readBooleanEnv('EXPO_PUBLIC_FF_HKDW_REDEEM_FLOW', false),

  /**
   * Phase 10 PR-1 — Blueprint Index & Worlds Fleet on real data.
   *
   * When on:
   *   - Playbook tab's blueprint detail screen gains a "View all 12 steps"
   *     button that pushes the canonical BlueprintIndexScreen.
   *   - The WITH-row "Worlds Fleet · N sailors" chip on a step card pushes
   *     the canonical FleetPlansScreen (live peer data, not mock).
   *   - BlueprintFleetService.getBlueprintPeers backs both screens for any
   *     blueprint, not just the HKDW sample.
   *
   * Off by default in production until QA signs off. Per the dragon-worlds
   * canonical §B-A (Blueprint Index) and §B-B (Fleet Plans).
   */
  BLUEPRINT_INDEX_FLEET_V2: readBooleanEnv(
    'EXPO_PUBLIC_FF_BLUEPRINT_INDEX_FLEET_V2',
    false,
  ),

  /**
   * Phase 10 PR-3 — Step chrome for subscribed-blueprint steps.
   *
   * When on, steps with source_blueprint_id render canonical chrome
   * above the Plan/Do/Reflect tabs:
   *   - Trophy strip ("HKDW Prep · Step N of M") → Blueprint Index
   *   - Title block ("From <Author's Blueprint Title>")
   *   - WITH-row chip ("Fleet · N sailors") → Worlds Fleet view
   *   - SinceLastVisitStrip on the Plan tab (when there's news)
   *
   * Off by default in production. Per dragon-worlds canonical §A-phase-5.
   */
  SUBSCRIBED_STEP_CHROME_V1: readBooleanEnv(
    'EXPO_PUBLIC_FF_SUBSCRIBED_STEP_CHROME_V1',
    false,
  ),
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
