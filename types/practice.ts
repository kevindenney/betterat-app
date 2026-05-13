/**
 * Practice Session Types
 *
 * Types for practice sessions with AI-suggested drills,
 * crew coordination, and learning integration.
 */

// =============================================================================
// ENUMS AND CONSTANTS
// =============================================================================

export type PracticeSessionType = 'scheduled' | 'logged';

export type PracticeStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Practice session phases - temporal phases that determine UI content
 * Parallels the race phase system (days_before, race_morning, on_water, after_race)
 */
export type PracticePhase =
  | 'practice_prepare'   // Before session day - equipment, planning, crew
  | 'practice_launch'    // Session day, before start - safety, warmup
  | 'practice_train'     // During session - minimal UI, drill completion
  | 'practice_reflect';  // After session - ratings, learnings, carryover

/**
 * Phase display labels for UI
 */
export const PRACTICE_PHASE_LABELS: Record<PracticePhase, string> = {
  practice_prepare: 'Prepare',
  practice_launch: 'Launch',
  practice_train: 'Train',
  practice_reflect: 'Reflect',
};

/**
 * Phase timing descriptions
 */
export const PRACTICE_PHASE_TIMING: Record<PracticePhase, string> = {
  practice_prepare: 'Before session day',
  practice_launch: 'Day of, before start',
  practice_train: 'During session',
  practice_reflect: 'After session',
};

/**
 * Determine current phase based on session status and timing
 * Auto-detects phase based on:
 * - Session status (completed, in_progress, cancelled, planned)
 * - Time until scheduled date
 */
export function getCurrentPracticePhase(session: {
  status: PracticeStatus;
  scheduledDate?: string | null;
  scheduledStartTime?: string | null;
}): PracticePhase {
  const now = new Date();

  // Completed sessions always show Reflect
  if (session.status === 'completed') return 'practice_reflect';

  // In progress = Train phase
  if (session.status === 'in_progress') return 'practice_train';

  // Cancelled = Reflect (for review)
  if (session.status === 'cancelled') return 'practice_reflect';

  // Planned session - time-based detection
  if (session.scheduledDate) {
    // Combine date and optional time
    let sessionDateTime: Date;
    if (session.scheduledStartTime) {
      sessionDateTime = new Date(`${session.scheduledDate}T${session.scheduledStartTime}`);
    } else {
      // Default to 9am if no time specified
      sessionDateTime = new Date(`${session.scheduledDate}T09:00:00`);
    }

    const hoursUntil = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil > 24) return 'practice_prepare';  // More than 1 day out
    if (hoursUntil > 0) return 'practice_launch';    // Day of, before start
    if (hoursUntil > -8) return 'practice_train';    // Started but within 8h window
    return 'practice_reflect';                        // Long past start time
  }

  return 'practice_prepare';  // Default for sessions without date
}

/**
 * Check if user can manually override to a phase
 * Some transitions don't make sense (e.g., completed session to Train)
 */
export function canOverrideToPhase(
  session: { status: PracticeStatus },
  targetPhase: PracticePhase
): boolean {
  // Completed/cancelled can only view Reflect
  if (session.status === 'completed' || session.status === 'cancelled') {
    return targetPhase === 'practice_reflect';
  }

  // In progress can view Train, Launch (for reference), or Reflect (early)
  if (session.status === 'in_progress') {
    return ['practice_train', 'practice_launch', 'practice_reflect'].includes(targetPhase);
  }

  // Planned can view any phase
  return true;
}

export type PracticeOrigin = 'ai_suggested' | 'user_created' | 'coach_assigned' | 'logged_adhoc';

export type PracticeMemberRole = 'organizer' | 'skipper' | 'crew' | 'coach' | 'observer';

export type RSVPStatus = 'pending' | 'accepted' | 'declined' | 'maybe';

export type DrillCategory =
  | 'starting'
  | 'upwind'
  | 'downwind'
  | 'mark_rounding'
  | 'boat_handling'
  | 'crew_work'
  | 'rules'
  | 'fitness'
  | 'general';

export type TemplateSource = 'regattaflow' | 'user' | 'ai' | 'coach';

export type DrillDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * Skill areas that match PostRaceLearningService metrics
 * These are used for mapping drills to focus areas
 */
export type SkillArea =
  | 'equipment-prep'
  | 'pre-race-planning'
  | 'crew-coordination'
  | 'prestart-sequence'
  | 'start-execution'
  | 'upwind-execution'
  | 'shift-awareness'
  | 'windward-rounding'
  | 'downwind-speed'
  | 'leeward-rounding'
  | 'finish-execution';

/**
 * RegattaFlow Playbook frameworks that drills can target
 */
export type PlaybookFramework =
  | 'Puff Response Framework'
  | 'Delayed Tack'
  | 'Wind Shift Mathematics'
  | 'Shift Frequency Formula'
  | 'Downwind Shift Detection'
  | 'Getting In Phase'
  | 'Performance Pyramid';

// Color constants for practice cards
export const PRACTICE_COLORS = {
  primary: '#8B5CF6', // Purple for practice
  accent: '#A78BFA',
  shadow: 'rgba(139, 92, 246, 0.15)',
  badgeBg: '#F5F3FF',
  badgeText: '#7C3AED',
  // Status colors
  scheduled: '#22C55E', // Green
  scheduledSoon: '#F59E0B', // Orange
  inProgress: '#3B82F6', // Blue
  completed: '#6B7280', // Gray
  logged: '#14B8A6', // Teal
} as const;

// Skill area display labels
export const SKILL_AREA_LABELS: Record<SkillArea, string> = {
  'equipment-prep': 'Equipment Prep',
  'pre-race-planning': 'Race Planning',
  'crew-coordination': 'Crew Coordination',
  'prestart-sequence': 'Pre-Start Sequence',
  'start-execution': 'Start Execution',
  'upwind-execution': 'Upwind Sailing',
  'shift-awareness': 'Shift Awareness',
  'windward-rounding': 'Windward Mark',
  'downwind-speed': 'Downwind Speed',
  'leeward-rounding': 'Leeward Mark',
  'finish-execution': 'Finish',
};

// Skill area config with label property (used by detail cards)
export const SKILL_AREA_CONFIG: Record<SkillArea, { label: string }> = {
  'equipment-prep': { label: 'Equipment Prep' },
  'pre-race-planning': { label: 'Race Planning' },
  'crew-coordination': { label: 'Crew Coordination' },
  'prestart-sequence': { label: 'Pre-Start Sequence' },
  'start-execution': { label: 'Start Execution' },
  'upwind-execution': { label: 'Upwind Sailing' },
  'shift-awareness': { label: 'Shift Awareness' },
  'windward-rounding': { label: 'Windward Mark' },
  'downwind-speed': { label: 'Downwind Speed' },
  'leeward-rounding': { label: 'Leeward Mark' },
  'finish-execution': { label: 'Finish' },
};

// Drill category display labels and icons
export const DRILL_CATEGORY_META: Record<
  DrillCategory,
  { label: string; icon: string }
> = {
  starting: { label: 'Starting', icon: 'flag' },
  upwind: { label: 'Upwind', icon: 'arrow-up' },
  downwind: { label: 'Downwind', icon: 'arrow-down' },
  mark_rounding: { label: 'Marks', icon: 'navigation' },
  boat_handling: { label: 'Boat Handling', icon: 'boat' },
  crew_work: { label: 'Crew Work', icon: 'people' },
  rules: { label: 'Rules', icon: 'book' },
  fitness: { label: 'Fitness', icon: 'fitness' },
  general: { label: 'General', icon: 'flag-checkered' },
};

// Alias for DRILL_CATEGORY_META (used by detail cards)
export const DRILL_CATEGORY_CONFIG = DRILL_CATEGORY_META;

// =============================================================================
// DRILL TYPES
// =============================================================================

/**
 * A practice drill from the drill library
 */
export interface Drill {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions?: string;
  category: DrillCategory;
  difficulty: DrillDifficulty;
  durationMinutes: number;
  minCrew: number;
  maxCrew: number;
  requiresMarks: boolean;
  requiresCoachBoat: boolean;
  soloFriendly: boolean;
  linkedInteractiveId?: string;
  linkedLessonId?: string;
  linkedModuleId?: string;
  videoUrl?: string;
  diagramUrl?: string;
  tags: string[];
  source?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Database row type for drills
 */
export interface DrillRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string | null;
  category: string;
  difficulty: string;
  duration_minutes: number;
  min_crew: number;
  max_crew: number;
  requires_marks: boolean;
  requires_coach_boat: boolean;
  solo_friendly: boolean;
  linked_interactive_id: string | null;
  linked_lesson_id: string | null;
  linked_module_id: string | null;
  video_url: string | null;
  diagram_url: string | null;
  tags: string[];
  source: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Mapping between a drill and a skill area
 */
export interface DrillSkillMapping {
  id: string;
  drillId: string;
  skillArea: SkillArea;
  relevanceScore: number;
  framework?: PlaybookFramework;
}

/**
 * Database row type for drill_skill_mappings
 */
export interface DrillSkillMappingRow {
  id: string;
  drill_id: string;
  skill_area: string;
  relevance_score: number;
  framework: string | null;
}

// =============================================================================
// PRACTICE TEMPLATE TYPES (4Q Framework)
// =============================================================================

/**
 * A pre-built practice template from the catalog
 */
export interface PracticeTemplate {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: DrillCategory;
  difficulty: DrillDifficulty;
  estimatedDurationMinutes: number;
  recommendedCrewSize: number;
  requiresMarks: boolean;
  requiresCoachBoat: boolean;
  isFeatured: boolean;
  source: TemplateSource;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Loaded via joins
  drills?: PracticeTemplateDrill[];
}

/**
 * Database row type for practice_templates
 */
export interface PracticeTemplateRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  difficulty: string;
  estimated_duration_minutes: number;
  recommended_crew_size: number;
  requires_marks: boolean;
  requires_coach_boat: boolean;
  is_featured: boolean;
  source: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A drill within a practice template
 */
export interface PracticeTemplateDrill {
  id: string;
  templateId: string;
  drillId: string;
  orderIndex: number;
  durationMinutes?: number;
  repetitions?: number;
  defaultCrewTasks: DefaultCrewTask[];
  customInstructions?: string;
  successCriteria?: string;
  createdAt: string;
  // Loaded via joins
  drill?: Drill;
}

/**
 * Database row type for practice_template_drills
 */
export interface PracticeTemplateDrillRow {
  id: string;
  template_id: string;
  drill_id: string;
  order_index: number;
  duration_minutes: number | null;
  repetitions: number | null;
  default_crew_tasks: DefaultCrewTask[] | null;
  custom_instructions: string | null;
  success_criteria: string | null;
  created_at: string;
}

/**
 * Default crew task assignment in a template
 */
export interface DefaultCrewTask {
  role: PracticeMemberRole | string;
  task: string;
}

/**
 * Per-drill crew task assignment during a practice session
 */
export interface DrillCrewTask {
  id: string;
  sessionDrillId: string;
  memberId: string;
  taskDescription: string;
  isPrimary: boolean;
  completed: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Loaded via joins
  member?: PracticeSessionMember;
}

/**
 * Database row type for drill_crew_tasks
 */
export interface DrillCrewTaskRow {
  id: string;
  session_drill_id: string;
  member_id: string;
  task_description: string;
  is_primary: boolean;
  completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// PRACTICE SESSION TYPES
// =============================================================================

/**
 * A practice session (scheduled or logged)
 */
export interface PracticeSession {
  id: string;
  createdBy: string;
  sailorId?: string;
  sessionType: PracticeSessionType;
  status: PracticeStatus;
  // Scheduling
  scheduledDate?: string;
  scheduledStartTime?: string;
  durationMinutes?: number;
  actualDurationMinutes?: number;
  // Location
  venueId?: string;
  venueName?: string;
  location?: {
    lat: number;
    lng: number;
  };
  // Conditions
  windSpeedMin?: number;
  windSpeedMax?: number;
  windDirection?: number;
  // Metadata
  title?: string;
  notes?: string;
  inviteCode?: string;
  maxCrewSize: number;
  // AI
  aiSuggested: boolean;
  aiSuggestionContext?: Record<string, unknown>;
  // 4Q Framework (WHY)
  templateId?: string;
  aiReasoning?: string;
  // Reflection
  reflectionNotes?: string;
  overallRating?: number;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  // Loaded via joins
  members?: PracticeSessionMember[];
  focusAreas?: PracticeFocusArea[];
  drills?: PracticeSessionDrill[];
  template?: PracticeTemplate;
}

/**
 * Database row type for practice_sessions
 */
export interface PracticeSessionRow {
  id: string;
  created_by: string;
  sailor_id: string | null;
  session_type: string;
  status: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  duration_minutes: number | null;
  actual_duration_minutes: number | null;
  venue_id: string | null;
  venue_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  wind_speed_min: number | null;
  wind_speed_max: number | null;
  wind_direction: number | null;
  title: string | null;
  notes: string | null;
  invite_code: string | null;
  max_crew_size: number;
  ai_suggested: boolean;
  ai_suggestion_context: Record<string, unknown> | null;
  // 4Q Framework columns
  template_id: string | null;
  ai_reasoning: string | null;
  reflection_notes: string | null;
  overall_rating: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * A member of a practice session
 */
export interface PracticeSessionMember {
  id: string;
  sessionId: string;
  userId: string;
  displayName?: string;
  role?: PracticeMemberRole;
  rsvpStatus: RSVPStatus;
  attended?: boolean;
  joinedAt: string;
  // User profile data loaded via join
  profile?: {
    fullName?: string;
    avatarUrl?: string;
    email?: string;
  };
}

/**
 * Database row type for practice_session_members
 */
export interface PracticeSessionMemberRow {
  id: string;
  session_id: string;
  user_id: string;
  display_name: string | null;
  role: string | null;
  rsvp_status: string;
  attended: boolean | null;
  joined_at: string;
}

/**
 * A focus area in a practice session
 */
export interface PracticeFocusArea {
  id: string;
  sessionId: string;
  skillArea: SkillArea;
  priority: number;
  preSessionConfidence?: number;
  postSessionRating?: number;
  improvementNotes?: string;
  aiSuggested: boolean;
  suggestionReason?: string;
}

/**
 * Database row type for practice_session_focus_areas
 */
export interface PracticeFocusAreaRow {
  id: string;
  session_id: string;
  skill_area: string;
  priority: number;
  pre_session_confidence: number | null;
  post_session_rating: number | null;
  improvement_notes: string | null;
  ai_suggested: boolean;
  suggestion_reason: string | null;
}

/**
 * A drill performed in a practice session
 */
export interface PracticeSessionDrill {
  id: string;
  sessionId: string;
  drillId: string;
  orderIndex: number;
  plannedDurationMinutes?: number;
  actualDurationMinutes?: number;
  repetitions?: number;
  rating?: number;
  notes?: string;
  completed: boolean;
  skipped: boolean;
  skipReason?: string;
  // 4Q Framework (HOW)
  customInstructions?: string;
  successCriteria?: string;
  createdAt: string;
  // Loaded via joins
  drill?: Drill;
  crewTasks?: DrillCrewTask[];
}

/**
 * Database row type for practice_session_drills
 */
export interface PracticeSessionDrillRow {
  id: string;
  session_id: string;
  drill_id: string;
  order_index: number;
  planned_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  repetitions: number | null;
  rating: number | null;
  notes: string | null;
  completed: boolean;
  skipped: boolean;
  skip_reason: string | null;
  // 4Q Framework columns
  custom_instructions: string | null;
  success_criteria: string | null;
  created_at: string;
}

/**
 * Practice skill progress aggregation
 */
export interface PracticeSkillProgress {
  id: string;
  sailorId: string;
  skillArea: SkillArea;
  sessionsCount: number;
  totalPracticeMinutes: number;
  averageRating?: number;
  latestRating?: number;
  trend?: 'improving' | 'stable' | 'declining';
  lastPracticedAt?: string;
  updatedAt: string;
}

/**
 * Database row type for practice_skill_progress
 */
export interface PracticeSkillProgressRow {
  id: string;
  sailor_id: string;
  skill_area: string;
  sessions_count: number;
  total_practice_minutes: number;
  average_rating: number | null;
  latest_rating: number | null;
  trend: string | null;
  last_practiced_at: string | null;
  updated_at: string;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a practice session
 */
export interface CreatePracticeSessionInput {
  sessionType: PracticeSessionType;
  scheduledDate?: string;
  scheduledStartTime?: string;
  durationMinutes?: number;
  venueId?: string;
  venueName?: string;
  title?: string;
  notes?: string;
  aiSuggested?: boolean;
  aiSuggestionContext?: Record<string, unknown>;
  // Arrays of IDs or objects
  focusAreaIds?: SkillArea[];
  drillIds?: string[];
}

/**
 * Input for updating a practice session
 */
export interface UpdatePracticeSessionInput {
  scheduledDate?: string;
  scheduledStartTime?: string;
  durationMinutes?: number;
  actualDurationMinutes?: number;
  venueId?: string;
  venueName?: string;
  title?: string;
  notes?: string;
  status?: PracticeStatus;
  reflectionNotes?: string;
  overallRating?: number;
  windSpeedMin?: number;
  windSpeedMax?: number;
  windDirection?: number;
}

/**
 * Input for joining a practice session via invite code
 */
export interface JoinPracticeInput {
  inviteCode: string;
  displayName?: string;
  role?: PracticeMemberRole;
}

/**
 * Input for completing a practice session with reflection
 */
export interface SessionReflectionInput {
  actualDurationMinutes: number;
  overallRating?: number | null;
  reflectionNotes?: string | null;
  focusAreaRatings?: Record<string, number>;
  drillRatings?: Record<string, { rating: number; notes?: string; completed?: boolean }>;
}

/**
 * Input for logging an ad-hoc practice session
 */
export interface LogPracticeInput {
  focusAreas: SkillArea[];
  description?: string;
  durationMinutes: number;
  date: string;
  time?: string;
  overallRating: number;
  notes?: string;
  venueName?: string;
  windSpeedMin?: number;
  windSpeedMax?: number;
}

// =============================================================================
// 4Q FRAMEWORK INPUT TYPES
// =============================================================================

/**
 * WHAT step data - What are you going to practice?
 */
export interface WhatStepData {
  focusAreas: SkillArea[];
  templateId?: string; // If using a template
  drills: WhatStepDrill[];
  estimatedDurationMinutes: number;
}

/**
 * Drill selection in WHAT step
 */
export interface WhatStepDrill {
  drillId: string;
  orderIndex: number;
  durationMinutes?: number;
  repetitions?: number;
}

/**
 * WHO step data - Who are you going to practice with?
 */
export interface WhoStepData {
  members: WhoStepMember[];
  drillTaskAssignments: DrillTaskAssignment[];
}

/**
 * Member in WHO step
 */
export interface WhoStepMember {
  userId?: string; // Existing user
  displayName: string;
  role: PracticeMemberRole;
  email?: string; // For invites
}

/**
 * Per-drill task assignment in WHO step
 */
export interface DrillTaskAssignment {
  drillId: string;
  orderIndex: number;
  tasks: MemberTask[];
}

/**
 * Task for a specific member
 */
export interface MemberTask {
  memberIndex: number; // Index into WhoStepData.members
  taskDescription: string;
  isPrimary: boolean;
}

/**
 * WHY step data - Why will you do this practice?
 */
export interface WhyStepData {
  aiReasoning?: string; // AI-generated explanation
  userRationale?: string; // User's own reasoning
  linkedRaceIds?: string[]; // Race analysis that led to this
  linkedPerformanceMetrics?: PerformanceMetricLink[];
}

/**
 * Link to a performance metric that drove the suggestion
 */
export interface PerformanceMetricLink {
  skillArea: SkillArea;
  metricName: string;
  currentValue: number;
  targetValue?: number;
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * HOW step data - How to do the practice?
 */
export interface HowStepData {
  drillInstructions: DrillInstructions[];
  sessionNotes?: string;
}

/**
 * Custom instructions for a drill
 */
export interface DrillInstructions {
  drillId: string;
  orderIndex: number;
  customInstructions?: string; // Override drill default
  successCriteria?: string;
}

/**
 * Complete input for creating a practice session using 4Q framework
 */
export interface CreatePracticeSessionWithFramework {
  // Meta
  sessionType: PracticeSessionType;
  scheduledDate?: string;
  scheduledStartTime?: string;
  venueId?: string;
  venueName?: string;
  title?: string;
  // 4Q Framework data
  what: WhatStepData;
  who: WhoStepData;
  why: WhyStepData;
  how: HowStepData;
}

/**
 * Full practice session with 4Q framework data (for display)
 */
export interface PracticeSessionWith4Q extends PracticeSession {
  // Expanded 4Q data
  whatSummary: {
    focusAreas: PracticeFocusArea[];
    drills: PracticeSessionDrill[];
    template?: PracticeTemplate;
    totalDuration: number;
  };
  whoSummary: {
    members: PracticeSessionMember[];
    drillTasks: Map<string, DrillCrewTask[]>; // drillId -> tasks
  };
  whySummary: {
    aiReasoning?: string;
    userRationale?: string;
    linkedRaces?: { id: string; name: string; date: string }[];
  };
  howSummary: {
    drills: {
      drill: Drill;
      instructions?: string;
      successCriteria?: string;
    }[];
  };
}

// =============================================================================
// AI SUGGESTION TYPES
// =============================================================================

/**
 * An AI-generated practice suggestion
 */
export interface PracticeSuggestion {
  id: string;
  priority: number; // 1 = highest
  skillArea: SkillArea;
  skillAreaLabel: string;
  reason: string;
  suggestedDrills: SuggestedDrill[];
  linkedLessons: LinkedLesson[];
  estimatedDuration: number;
  contextualNotes?: string;
}

/**
 * A drill suggested by the AI with context
 */
export interface SuggestedDrill {
  drill: Drill;
  relevanceScore: number;
  suggestedDuration: number;
  suggestedRepetitions?: number;
  focus: string; // Specific aspect to focus on
}

/**
 * A learning lesson linked to a practice suggestion
 */
export interface LinkedLesson {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  interactiveId?: string;
  reason: string;
}

/**
 * Context for generating practice suggestions
 */
export interface SuggestionContext {
  availableTime?: number; // Minutes available
  crewSize?: number;
  hasMarks?: boolean;
  hasCoachBoat?: boolean;
  windConditions?: {
    speedMin: number;
    speedMax: number;
  };
  preferredDifficulty?: DrillDifficulty;
  excludeSkillAreas?: SkillArea[];
  focusOnRecent?: boolean;
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

/**
 * Props for the PracticeCard component
 */
export interface PracticeCardProps {
  id: string;
  status: PracticeStatus;
  sessionType: PracticeSessionType;
  // Schedule info
  scheduledDate?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  // Location
  venueName?: string;
  // Focus & Drill
  focusAreas: PracticeFocusArea[];
  primaryDrillName?: string;
  drillCount?: number;
  // Current skill level (1-5)
  currentSkillLevel?: number;
  targetSkillLevel?: number;
  // Crew
  crewMembers?: PracticeSessionMember[];
  inviteCode?: string;
  // AI Origin
  isAISuggested?: boolean;
  aiConfidence?: number;
  // Post-practice
  overallRating?: number;
  keyTakeaway?: string;
  // Styling
  isPrimary?: boolean;
  isSelected?: boolean;
  isDimmed?: boolean;
  cardWidth?: number;
  cardHeight?: number;
  // Callbacks
  onSelect?: () => void;
  onStartNow?: () => void;
  onInviteCrew?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// =============================================================================
// TRANSFORM FUNCTIONS
// =============================================================================

/**
 * Transform database row to Drill
 */
export function rowToDrill(row: DrillRow): Drill {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    instructions: row.instructions || undefined,
    category: row.category as DrillCategory,
    difficulty: row.difficulty as DrillDifficulty,
    durationMinutes: row.duration_minutes,
    minCrew: row.min_crew,
    maxCrew: row.max_crew,
    requiresMarks: row.requires_marks,
    requiresCoachBoat: row.requires_coach_boat,
    soloFriendly: row.solo_friendly,
    linkedInteractiveId: row.linked_interactive_id || undefined,
    linkedLessonId: row.linked_lesson_id || undefined,
    linkedModuleId: row.linked_module_id || undefined,
    videoUrl: row.video_url || undefined,
    diagramUrl: row.diagram_url || undefined,
    tags: row.tags || [],
    source: row.source || undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Transform database row to PracticeSession
 */
export function rowToPracticeSession(row: PracticeSessionRow): PracticeSession {
  return {
    id: row.id,
    createdBy: row.created_by,
    sailorId: row.sailor_id || undefined,
    sessionType: row.session_type as PracticeSessionType,
    status: row.status as PracticeStatus,
    scheduledDate: row.scheduled_date || undefined,
    scheduledStartTime: row.scheduled_start_time || undefined,
    durationMinutes: row.duration_minutes || undefined,
    actualDurationMinutes: row.actual_duration_minutes || undefined,
    venueId: row.venue_id || undefined,
    venueName: row.venue_name || undefined,
    location:
      row.location_lat && row.location_lng
        ? { lat: row.location_lat, lng: row.location_lng }
        : undefined,
    windSpeedMin: row.wind_speed_min || undefined,
    windSpeedMax: row.wind_speed_max || undefined,
    windDirection: row.wind_direction || undefined,
    title: row.title || undefined,
    notes: row.notes || undefined,
    inviteCode: row.invite_code || undefined,
    maxCrewSize: row.max_crew_size,
    aiSuggested: row.ai_suggested,
    aiSuggestionContext: row.ai_suggestion_context || undefined,
    // 4Q Framework fields
    templateId: row.template_id || undefined,
    aiReasoning: row.ai_reasoning || undefined,
    reflectionNotes: row.reflection_notes || undefined,
    overallRating: row.overall_rating || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || undefined,
  };
}

/**
 * Transform database row to PracticeSessionMember
 */
export function rowToPracticeSessionMember(
  row: PracticeSessionMemberRow
): PracticeSessionMember {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    displayName: row.display_name || undefined,
    role: row.role as PracticeMemberRole | undefined,
    rsvpStatus: row.rsvp_status as RSVPStatus,
    attended: row.attended || undefined,
    joinedAt: row.joined_at,
  };
}

/**
 * Transform database row to PracticeFocusArea
 */
export function rowToPracticeFocusArea(row: PracticeFocusAreaRow): PracticeFocusArea {
  return {
    id: row.id,
    sessionId: row.session_id,
    skillArea: row.skill_area as SkillArea,
    priority: row.priority,
    preSessionConfidence: row.pre_session_confidence || undefined,
    postSessionRating: row.post_session_rating || undefined,
    improvementNotes: row.improvement_notes || undefined,
    aiSuggested: row.ai_suggested,
    suggestionReason: row.suggestion_reason || undefined,
  };
}

/**
 * Transform database row to PracticeSessionDrill
 */
export function rowToPracticeSessionDrill(
  row: PracticeSessionDrillRow
): PracticeSessionDrill {
  return {
    id: row.id,
    sessionId: row.session_id,
    drillId: row.drill_id,
    orderIndex: row.order_index,
    plannedDurationMinutes: row.planned_duration_minutes || undefined,
    actualDurationMinutes: row.actual_duration_minutes || undefined,
    repetitions: row.repetitions || undefined,
    rating: row.rating || undefined,
    notes: row.notes || undefined,
    completed: row.completed,
    skipped: row.skipped,
    skipReason: row.skip_reason || undefined,
    // 4Q Framework fields (HOW)
    customInstructions: row.custom_instructions || undefined,
    successCriteria: row.success_criteria || undefined,
    createdAt: row.created_at,
  };
}

/**
 * Transform database row to PracticeSkillProgress
 */
export function rowToPracticeSkillProgress(
  row: PracticeSkillProgressRow
): PracticeSkillProgress {
  return {
    id: row.id,
    sailorId: row.sailor_id,
    skillArea: row.skill_area as SkillArea,
    sessionsCount: row.sessions_count,
    totalPracticeMinutes: row.total_practice_minutes,
    averageRating: row.average_rating || undefined,
    latestRating: row.latest_rating || undefined,
    trend: row.trend as 'improving' | 'stable' | 'declining' | undefined,
    lastPracticedAt: row.last_practiced_at || undefined,
    updatedAt: row.updated_at,
  };
}

/**
 * Transform database row to DrillSkillMapping
 */
export function rowToDrillSkillMapping(row: DrillSkillMappingRow): DrillSkillMapping {
  return {
    id: row.id,
    drillId: row.drill_id,
    skillArea: row.skill_area as SkillArea,
    relevanceScore: row.relevance_score,
    framework: row.framework as PlaybookFramework | undefined,
  };
}

// =============================================================================
// 4Q FRAMEWORK TRANSFORM FUNCTIONS
// =============================================================================

/**
 * Transform database row to PracticeTemplate
 */
export function rowToPracticeTemplate(row: PracticeTemplateRow): PracticeTemplate {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || undefined,
    category: row.category as DrillCategory,
    difficulty: row.difficulty as DrillDifficulty,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    recommendedCrewSize: row.recommended_crew_size,
    requiresMarks: row.requires_marks,
    requiresCoachBoat: row.requires_coach_boat,
    isFeatured: row.is_featured,
    source: row.source as TemplateSource,
    tags: row.tags || [],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Transform database row to PracticeTemplateDrill
 */
export function rowToPracticeTemplateDrill(row: PracticeTemplateDrillRow): PracticeTemplateDrill {
  return {
    id: row.id,
    templateId: row.template_id,
    drillId: row.drill_id,
    orderIndex: row.order_index,
    durationMinutes: row.duration_minutes || undefined,
    repetitions: row.repetitions || undefined,
    defaultCrewTasks: row.default_crew_tasks || [],
    customInstructions: row.custom_instructions || undefined,
    successCriteria: row.success_criteria || undefined,
    createdAt: row.created_at,
  };
}

/**
 * Transform database row to DrillCrewTask
 */
export function rowToDrillCrewTask(row: DrillCrewTaskRow): DrillCrewTask {
  return {
    id: row.id,
    sessionDrillId: row.session_drill_id,
    memberId: row.member_id,
    taskDescription: row.task_description,
    isPrimary: row.is_primary,
    completed: row.completed,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =============================================================================
// INTEREST-AWARE HELPERS
// =============================================================================

/**
 * Build a drill category lookup map from an interest's config.
 * Returns the same shape as DRILL_CATEGORY_META but driven by the interest config.
 *
 * Usage:
 *   const config = useInterestEventConfig();
 *   const categoryMeta = buildDrillCategoryMap(config.drillCategories);
 *   const label = categoryMeta['starting']?.label;
 */
export function buildDrillCategoryMap(
  categories: { id: string; label: string; icon: string }[]
): Record<string, { label: string; icon: string }> {
  const map: Record<string, { label: string; icon: string }> = {};
  for (const cat of categories) {
    map[cat.id] = { label: cat.label, icon: cat.icon };
  }
  return map;
}

/**
 * Build a skill area label map from an interest's config.
 * Returns the same shape as SKILL_AREA_LABELS but driven by the interest config.
 *
 * Usage:
 *   const config = useInterestEventConfig();
 *   const skillLabels = buildSkillAreaLabelMap(config.skillAreas);
 *   const label = skillLabels['equipment-prep'];
 */
export function buildSkillAreaLabelMap(
  skillAreas: { id: string; label: string }[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const area of skillAreas) {
    map[area.id] = area.label;
  }
  return map;
}

/**
 * Build a skill area config map from an interest's config.
 * Returns the same shape as SKILL_AREA_CONFIG but driven by the interest config.
 */
export function buildSkillAreaConfigMap(
  skillAreas: { id: string; label: string }[]
): Record<string, { label: string }> {
  const map: Record<string, { label: string }> = {};
  for (const area of skillAreas) {
    map[area.id] = { label: area.label };
  }
  return map;
}

/**
 * Get a drill category label from config, with fallback.
 * Convenience function for components that only need a single label.
 */
export function getDrillCategoryLabel(
  categoryId: string,
  categories: { id: string; label: string; icon: string }[]
): string {
  return categories.find((c) => c.id === categoryId)?.label ?? categoryId;
}

/**
 * Get a skill area label from config, with fallback.
 * Convenience function for components that only need a single label.
 */
export function getSkillAreaLabel(
  skillAreaId: string,
  skillAreas: { id: string; label: string }[]
): string {
  return skillAreas.find((s) => s.id === skillAreaId)?.label ?? skillAreaId;
}
