/**
 * Feature Flags
 *
 * Centralized feature flags for controlling experimental features.
 * These can be toggled without code changes via environment variables.
 */

// IMPORTANT: pass the env var via a STATIC `process.env.EXPO_PUBLIC_*` member
// access at the call site, never a dynamic `process.env[name]` lookup. Only
// static accesses are inlined by babel-preset-expo at build time; a dynamic
// lookup resolves to `undefined` in a production export (there is no runtime
// `process.env` on native), so every flag would silently collapse to its
// fallback. Dev hides this because Metro populates a runtime `process.env`.
function readBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return fallback;
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
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
   * Phase A context switcher: one Workspace x Surface chip replacing the
   * interest-only header pill, plus a slim profile menu and header inbox bell.
   */
  CONTEXT_SWITCHER_V1: readBooleanEnv(process.env.EXPO_PUBLIC_FF_CONTEXT_SWITCHER_V1, true),

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
  PROGRAM_DATA_MODEL_V1: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PROGRAM_DATA_MODEL_V1, true),

  /**
   * Gate coach-home shell features (counts, trends, retention loop).
   * Disable to fall back to legacy clients shell experience.
   */
  COACH_SHELL_V1: readBooleanEnv(process.env.EXPO_PUBLIC_FF_COACH_SHELL_V1, true),

  /**
   * Gate strict domain checks on sailing-only AI endpoints.
   * Disable only for emergency rollback.
   */
  DOMAIN_GATE_AI_STRICT_V1: readBooleanEnv(process.env.EXPO_PUBLIC_FF_DOMAIN_GATE_AI_STRICT_V1, true),

  /**
   * Gate secondary domain packs (drawing/fitness) on shared skeleton routes.
   * Keep false until secondary pack validation is complete.
   */
  SECONDARY_PACKS_V1: readBooleanEnv(process.env.EXPO_PUBLIC_FF_SECONDARY_PACKS_V1, false),

  /**
   * Cut Playbook home over to the iOS register layout (Apple Books library
   * treatment: Vision card + concept shelf + recent reflections + inbox
   * count badge). When true, the Playbook tab renders the iOS register
   * preview and the existing PlaybookHome eight-section layout is
   * suppressed. Defaults true (cutover live 2026-05-15); flip to false
   * via EXPO_PUBLIC_FF_PLAYBOOK_IOS_REGISTER=false to revert in one
   * toggle if anything breaks.
   */
  PLAYBOOK_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PLAYBOOK_IOS_REGISTER, true),

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
  RACE_PREP_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_RACE_PREP_IOS_REGISTER, false),

  /**
   * Gate the canonical Practice Add Step floating action button. When true,
   * the Practice implementation can show the bottom-right + affordance and
   * canonical two-path creation sheet. Default flipped to true 2026-05-16
   * once the Add Step Flow canonical (FAB + action sheet + AI Coach
   * conversation) was ready to be the default Add Step path.
   */
  PRACTICE_ADD_STEP_FAB: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PRACTICE_ADD_STEP_FAB, true),

  /**
   * Gate the canonical Plan tab interior: AI Coach as the primary empty-state
   * path, manual What/How/Why as secondary, and optional add-ons collapsed under
   * More options. Default flipped to true 2026-05-16 — required for the Add
   * Step Flow canonical to function end-to-end (the "Build with AI Coach" path
   * lands users on this Plan tab and expects ConversationalCapture as the
   * empty state).
   */
  PRACTICE_PLAN_TAB_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PRACTICE_PLAN_TAB_IOS_REGISTER, true),

  /**
   * Gate the canonical Do tab interior: pre-activity capture affordances, a
   * live reverse-chronological capture stream, post-activity auto-summary,
   * and capability evidence marking. Defaults false because this changes the
   * main capture workflow, live-state signaling, capture ordering, and the
   * Do-to-Reflect handoff. See docs/redesign/specs/PHASE_B7_DO_TAB_INTERIOR_SPEC.md.
   */
  PRACTICE_DO_TAB_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER, true),

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
  PRACTICE_DO_TAB_PER_STEP_TIMING: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PRACTICE_DO_TAB_PER_STEP_TIMING, true),

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
  PRACTICE_REFLECT_TAB_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PRACTICE_REFLECT_TAB_IOS_REGISTER, false),

  /**
   * Stage the Race Log iOS register surface (chronological multi-season
   * archive). This flag exists for the Reflect-tab cutover, which ships
   * Race Log + Profile together; the render switch in the Reflect parent
   * is wired in a follow-up commit once Profile iOS is also staged. Until
   * then, the flag is reachable only via the preview route at
   * /race-log-ios. Defaults true; flip to false via
   * EXPO_PUBLIC_FF_RACE_LOG_IOS_REGISTER=false to revert in one toggle.
   */
  RACE_LOG_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_RACE_LOG_IOS_REGISTER, true),

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
  GET_INSPIRED_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_GET_INSPIRED_IOS_REGISTER, true),

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
  TROPHY_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_TROPHY_IOS_REGISTER, true),

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
  CONCEPT_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_CONCEPT_IOS_REGISTER, true),

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
  PROFILE_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PROFILE_IOS_REGISTER, true),

  /**
   * Stage the JHU-style Org Admin onboarding card at the top of the
   * organization cohort dashboard. When true, the dashboard's canView
   * branch renders a dismissible welcome card with a four-minute tour
   * offer above the cohort selector. Dismissal is persisted per
   * organization so the card does not reappear on reload for the same
   * org. Defaults false — this is a new visual surface with persistence
   * and does not qualify for the mechanical-only exception.
   */
  JHU_ADMIN_DASHBOARD_IOS: readBooleanEnv(process.env.EXPO_PUBLIC_FF_JHU_ADMIN_DASHBOARD_IOS, false),

  /**
   * Stage the canonical Series feature treatment over the existing Season
   * infrastructure: white Series strip in the zoomed-out timeline (Frame 1),
   * iOS-native switch-Series action sheet (Frame 2), Series context on step
   * cards (Frame 3), and the canonical `Jump to` picker (Frame 4). Per
   * `series-feature-canonical.html`. Defaults false — this is a substantive
   * visual and control-flow change.
   */
  PRACTICE_SERIES_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PRACTICE_SERIES_IOS_REGISTER, true),

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
  PRACTICE_STEP_LOOP_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PRACTICE_STEP_LOOP_IOS_REGISTER, true),

  /**
   * Timeline Zoom — practice tab as a single zoomable canvas with four
   * deliberate depths (L1 Step → L2 Week → L3 Season → L4 Years). Pinch is
   * the primary gesture; a right-rail 1/2/3/4 pill stack is the secondary
   * affordance (tap to jump, long-press to fan open a labeled menu). Per
   * the May 2026 Timeline Zoom & Admin handoff (Sections A–C).
   *
   * When on: the preview route at /timeline-zoom-ios renders the
   * <TimelineZoomCanvas /> with sample data drawn from Emily's nursing year.
   * The canonical Practice-tab cutover (replacing today's two-state taskbar
   * toggle with the canvas) lands in a follow-up commit once the gesture +
   * snap behavior is validated end-to-end. Defaults true; flip to false via
   * EXPO_PUBLIC_FF_TIMELINE_ZOOM_IOS_REGISTER=false to revert.
   */
  TIMELINE_ZOOM_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_TIMELINE_ZOOM_IOS_REGISTER, true),

  /**
   * Timeline Zoom — canonical Practice tab cutover. When on, the Practice
   * tab renders <TimelineZoomPracticeScreen /> (canvas wired to the
   * signed-in user's real timeline-steps + seasons) instead of the legacy
   * RacesScreen body. When off, the legacy view renders unchanged.
   *
   * Defaults true 2026-05-22. Flip to false via
   * EXPO_PUBLIC_FF_TIMELINE_ZOOM_PRACTICE_CUTOVER=false to revert without a
   * deploy. The /timeline-zoom-ios preview route remains available either
   * way (gated separately by TIMELINE_ZOOM_IOS_REGISTER).
   */
  TIMELINE_ZOOM_PRACTICE_CUTOVER: readBooleanEnv(
    process.env.EXPO_PUBLIC_FF_TIMELINE_ZOOM_PRACTICE_CUTOVER,
    true,
  ),

  /**
   * Phase 11 — Atlas tab iOS register preview. The fifth lens ("where"),
   * centered between Library and Discover. Renders the canonical six-frame
   * surface at the preview route /atlas-ios:
   *   F1 Felix · Causeway Bay overview      F4 Emily · Baltimore cold
   *   F2 Felix · race-marks zoom           F5 Emily · JHU curated
   *   F3 Felix · world Dragon              F6 commit-mode (from Plan)
   * Static demo data with stylized SVG-rendered map illustrations —
   * MapLibre tiles, atlas_pois schema, peer-steps RPC, healthcare lint,
   * and Cohort materialized view land in Phase A1 alongside the actual
   * fifth-tab wiring. Per docs/redesign/ios-register/atlas-tab-brief.md.
   * Defaults true; flip to false via
   * EXPO_PUBLIC_FF_ATLAS_IOS_REGISTER=false to revert in one toggle.
   */
  ATLAS_IOS_REGISTER: readBooleanEnv(process.env.EXPO_PUBLIC_FF_ATLAS_IOS_REGISTER, true),

  /**
   * Phase 11 follow-up — render a real MapLibre tile canvas on the live
   * /(tabs)/atlas surface instead of the static stylized SVG. The
   * /atlas-ios preview keeps the SVG for canonical handoff fidelity. Web
   * platform also keeps the SVG (the maplibre-gl/react-map-gl web bridge
   * lands separately). When this flag is off, the live tab falls back to
   * the SVG too — useful if the native MapLibre canvas crashes or the
   * tile endpoint is unreachable. Defaults true.
   */
  ATLAS_MAPLIBRE_CANVAS: readBooleanEnv(process.env.EXPO_PUBLIC_FF_ATLAS_MAPLIBRE_CANVAS, true),

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
  // Default ON in dev (__DEV__ === true) so the canonical /r/[token] flow,
  // SmartAppBanner, InstallSheet, WelcomeToast, and the /practice/step sample
  // mock-fast-path light up without anyone setting an env var. Production
  // builds (__DEV__ === false) keep it gated behind the env var until the
  // partnership ships.
  HKDW_REDEEM_FLOW: readBooleanEnv(process.env.EXPO_PUBLIC_FF_HKDW_REDEEM_FLOW, true),

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
    process.env.EXPO_PUBLIC_FF_BLUEPRINT_INDEX_FLEET_V2,
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
    process.env.EXPO_PUBLIC_FF_SUBSCRIBED_STEP_CHROME_V1,
    false,
  ),

  /**
   * Phase 10 PR-2 — Step Discussion peek + entry.
   *
   * When on, steps with new discussion activity render a "💬 Discussion · N
   * notes" peek strip beneath the step chrome on Plan/Do/Reflect. Tap opens
   * the existing fullscreen Discussion at /practice/step/[id]/discussion.
   *
   * Off by default in production. Per dragon-worlds canonical Surface C.
   */
  STEP_DISCUSSION_V1: readBooleanEnv(
    process.env.EXPO_PUBLIC_FF_STEP_DISCUSSION_V1,
    false,
  ),

  /**
   * v3 screen-designs Phase E — Connect WhatsApp / Telegram UI.
   *
   * When on: the avatar menu (ProfileDropdown) gains a "Connected services"
   * row that routes to /account/connected-services, where the user can
   * preview the canonical Connect-WhatsApp flow (QR + 6-digit code +
   * deep-link), the confirmed-state pane (three toggles: peer suggestions,
   * daily prompt, SHG bridge), and a chat-as-client preview of how the
   * bot appears in Lakshmi's WhatsApp.
   *
   * v1 is UI-only behind this flag — no bot infra, no real code-pairing,
   * no message routing. The "Mark as connected" button on the connect
   * pane flips a local AsyncStorage key so reviewers can walk the
   * connected-state UX without a backend. Production wiring (BSP
   * webhook, code verification, message ingestion) is a follow-up.
   *
   * Per the WhatsApp Business Platform ToS analysis (2026-05-24): Screen
   * 06 (BetterAt Bridge inside the SHG group) is intentionally NOT built.
   * The Groups API has 100K+ business-initiated-conversation gating, an
   * 8-participant cap, and the "bot joins user-owned group" pattern isn't
   * supported. The same UX outcome ships via 1:1 relay (Sunita's bot
   * routes a suggestion to Lakshmi's bot, already supported by Phase A's
   * inbox surface).
   *
   * Off by default. Flip via EXPO_PUBLIC_FF_WHATSAPP_CONNECT_V3=true.
   * Per docs/redesign/v3 · The reflecting & suggesting system, screens
   * 05, 14, 15, 17.
   */
  WHATSAPP_CONNECT_V3: readBooleanEnv(process.env.EXPO_PUBLIC_FF_WHATSAPP_CONNECT_V3, false),

  /**
   * v3 screen-designs Screens 11–13 · the universal `+` composer.
   *
   * Canonical: "the + button only ever does two things — ad-hoc at the
   * timeline, sub-step inside a step. Voice routes through one composer."
   *
   * v1 ships Screen 11 only (the ad-hoc-at-timeline composer): a focused
   * sheet with lane chips (interest + session), a single text field,
   * suggested tag chips, an AI-librarian "group as sub-step?" hint card,
   * and a voice-mic affordance at the bottom. Save commits a real step
   * via the existing createDraftStep() pipeline — same data path as the
   * legacy UniversalPlusSheet.
   *
   * Replaces the legacy multi-option UniversalPlusSheet when on. The
   * canvas's `+` button (CanvasTopBar) keeps calling useUniversalPlus().open();
   * the provider routes that to the new sheet under the flag.
   *
   * Screens 12 (inline sub-step composer) and 13 (full-screen voice-first)
   * are deferred — Screen 12 needs Plan-tab coupling, Screen 13 needs a
   * speech-recognition adapter.
   *
   * Off by default. Flip via EXPO_PUBLIC_FF_PLUS_COMPOSER_V3=true.
   */
  PLUS_COMPOSER_V3: readBooleanEnv(process.env.EXPO_PUBLIC_FF_PLUS_COMPOSER_V3, false),

  /**
   * v3 screen-designs Screen 13 · full-screen voice-first composer.
   *
   * Canonical: "Tell me what you're planning." Mic centered (locked
   * component grammar — the lone mic), waveform animation, recording
   * timer. The lilac AI offer card reads the input and proposes either
   * a single step or a structured block of N steps. One-tap accept on
   * the proposal; one-tap "just one step" to override.
   *
   * v1 ships UI-only: the modal renders, the waveform animates, the
   * timer counts up, the AI proposal is a hand-authored mock ("a
   * 4-week light-air block before HKDW"). No real audio capture, no
   * speech-to-text, no AI proposal generation — all of those need
   * adapters that aren't here yet. Explicit "preview" footnote.
   *
   * Wired as the mic button on the PlusComposerV3Sheet footer (Screen
   * 11). Tapping the mic on Screen 11 → opens the Screen 13 modal.
   *
   * Off by default. Flip via EXPO_PUBLIC_FF_VOICE_COMPOSER_V3=true.
   */
  VOICE_COMPOSER_V3: readBooleanEnv(process.env.EXPO_PUBLIC_FF_VOICE_COMPOSER_V3, false),

  /**
   * v3 screen-designs Phase C — third-person timeline + Suggest verb.
   *
   * When on: the public-face hero on /profile/[userId] gains a dual-CTA row
   * — Suggest a step (filled, opens composer modal) + Reflect (outline,
   * opens a "coming soon" stub for v1). The composer is the verb-first
   * sheet from design screens 02–03: To (recipient, locked), re (optional
   * recipient-step context), body textarea, Send. Send inserts a
   * step_suggestions row using the sender's most-recent in-progress step
   * as source_step_id (a v1 fallback — schema update for free-form
   * suggestions is a follow-up). Lands in the recipient's Inbox via the
   * existing inbox_items pipeline.
   *
   * Off by default. Flip via EXPO_PUBLIC_FF_SUGGEST_VERB_V3=true.
   * Per docs/redesign/v3 · The reflecting & suggesting system, screens 02–03.
   */
  SUGGEST_VERB_V3: readBooleanEnv(process.env.EXPO_PUBLIC_FF_SUGGEST_VERB_V3, false),

  /**
   * v3 screen-designs Phase B — step cover identity deck.
   *
   * When on (and PRACTICE_STEP_LOOP_IOS_REGISTER is also on, since this
   * gates inside the iOS-register branch of StepDetailContent): the step
   * cover above PhaseTabs becomes a two-piece identity deck —
   *   1. <IdentityDeck>          — sub-step counter, large serif title,
   *                                 blueprint provenance, peer count,
   *                                 cross-interest chip
   *   2. <PeerReflectionQuote>   — lilac italic-serif quote of the latest
   *                                 peer comment on this step, only when
   *                                 discussionPeek surfaces one
   *
   * On by default — Screen 01 (the step cover identity deck) is the
   * canonical L1 surface for the zoom canvas; the existing Plan body
   * (Pin from library, beats, capabilities, cross-interest suggestions,
   * etc.) keeps rendering underneath the deck unchanged. Flip
   * EXPO_PUBLIC_FF_STEP_IDENTITY_DECK_V3=false to revert to the legacy
   * headerInner + belowTitleRow chrome.
   * Per docs/redesign/v3 · The reflecting & suggesting system, screen 01.
   */
  STEP_IDENTITY_DECK_V3: readBooleanEnv(process.env.EXPO_PUBLIC_FF_STEP_IDENTITY_DECK_V3, true),

  /**
   * v3 screen-designs Phase A — Inbox as the 5th bottom tab.
   *
   * When on: the sailor/guest tab bar drops Profile (reflect) from the bar
   * and adds Inbox at the rightmost position with a red-dot badge. Profile
   * stays addressable via /reflect (deep link) and will move under the
   * avatar in Phase B. The new tab renders <InboxScreen /> with Act / Read /
   * Done segmentation and practice-grouped cards (lift of the design's
   * SCREEN 04 surface). Reads from the existing inbox_items view via
   * useInboxItems — no schema changes in this phase.
   *
   * On by default — Screen 07 canonical bottom-tab grammar shows
   * "Inbox (3)" in place of Profile, and Phase A has shipped. Flip
   * EXPO_PUBLIC_FF_INBOX_TAB_V3=false to revert to the legacy bar.
   * Per docs/redesign/v3 · The reflecting & suggesting system, screen 04.
   */
  INBOX_TAB_V3: readBooleanEnv(process.env.EXPO_PUBLIC_FF_INBOX_TAB_V3, true),

  /**
   * Phone parity for admin/studio management surfaces.
   *
   * When on: StudioShell (and the AdminShell that wraps it) render a
   * responsive compact layout below 600pt — the fixed 248px sidebar
   * collapses into a top bar + slide-over drawer and the main pane goes
   * full-width single-column — so Org admin / People, Creator Studio,
   * Cohorts, Billing, etc. are usable on phone. iPad portrait (≥600pt)
   * keeps the two-pane layout. Replaces the old on-register desktop gate
   * (DESKTOP_GATE_ON_REGISTER); the gate components have been removed.
   *
   * On by default. Flip EXPO_PUBLIC_FF_ADMIN_PHONE_PARITY=false to fall
   * back to the un-reflowed desktop layout (cramped on phone).
   */
  ADMIN_PHONE_PARITY: readBooleanEnv(process.env.EXPO_PUBLIC_FF_ADMIN_PHONE_PARITY, true),

  /**
   * Atlas NEXT event sourced from the canonical race-step spine.
   *
   * When on: useAtlasNextEvent resolves the sailing NEXT event from upcoming
   * `timeline_steps` where is_race=true (ordered by starts_at), so the step's
   * race_plan.course_id flows to AtlasNextEvent.course_id and the amber NEXT
   * marker locks to that exact course's committee boat instead of guessing by
   * proximity. When off (or when the user has no upcoming race step), the
   * legacy regattas/race_events resolver path is the fallback.
   *
   * Defaults false — Commit 1 of ATLAS_RACE_SOURCE_OF_TRUTH_SPEC. Flip
   * EXPO_PUBLIC_FF_ATLAS_NEXT_FROM_STEPS=true to source from steps.
   */
  ATLAS_NEXT_FROM_STEPS: readBooleanEnv(process.env.EXPO_PUBLIC_FF_ATLAS_NEXT_FROM_STEPS, false),
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
