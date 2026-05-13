/**
 * Race Intentions Types
 *
 * Types for structured user intentions across all detail cards.
 * Enables sailors to declare their race preparation plans in a structured way.
 */

import type { WatchSchedule } from './watchSchedule';
import type { ChecklistCompletion } from './checklists';
import type {
  HourlyDataPoint,
  TideTimeData,
  RaceWindowData,
} from '@/hooks/useRaceWeatherForecast';

/**
 * Arrival time intention for the Race Card
 */
export interface ArrivalTimeIntention {
  /** ISO timestamp for planned arrival at the start area */
  plannedArrival: string;
  /** Free-form notes about arrival approach */
  notes?: string;
  /** Minutes before warning signal */
  minutesBefore?: number;
}

/**
 * Sail selection intention for the Conditions Card
 * Equipment IDs reference the boat_equipment table
 */
export interface SailSelectionIntention {
  /** Selected mainsail equipment_id */
  mainsail?: string;
  /** Selected mainsail display name */
  mainsailName?: string;
  /** Selected jib/genoa equipment_id */
  jib?: string;
  /** Selected jib/genoa display name */
  jibName?: string;
  /** Selected spinnaker equipment_id */
  spinnaker?: string;
  /** Selected spinnaker display name */
  spinnakerName?: string;
  /** Free-form notes about sail selection rationale */
  notes?: string;
  /** Wind range this selection is optimized for */
  windRangeContext?: string;
}

/**
 * Status for individual rig setting intentions
 */
export type RigIntentionStatus = 'default' | 'adjusted' | 'monitoring';

/**
 * Individual rig setting intention
 */
export interface RigSettingIntention {
  /** Status of this setting: default (use recommended), adjusted (custom), or monitoring */
  status: RigIntentionStatus;
  /** Custom value if status is 'adjusted' */
  value?: string;
  /** Notes about this specific setting */
  notes?: string;
}

/**
 * Rig intentions for the Rig Card
 * Keys are rig setting keys (e.g., 'upper_shrouds', 'mast_rake', etc.)
 */
export interface RigIntentions {
  /** Map of setting key to intention */
  settings: Record<string, RigSettingIntention>;
  /** Overall notes about rig setup approach */
  overallNotes?: string;
}

/**
 * Course selection intention for the Course Card
 */
export interface CourseSelectionIntention {
  /** Selected course ID if from structured data */
  selectedCourseId?: string;
  /** Selected course name/label */
  selectedCourseName?: string;
  /** Course sequence (e.g., "Start - A - C - A - Finish") */
  selectedCourseSequence?: string;
  /** Whether this was identified from Sailing Instructions */
  identifiedFromSI?: boolean;
  /** Free-form notes about course understanding */
  notes?: string;
  /** Confirmed user has reviewed/understood the course */
  confirmed?: boolean;
}

/**
 * Strategy notes stored by section ID
 * Used by the new template-based strategy cards
 */
export type StrategyNotes = Record<string, string>;

/**
 * Snapshot of weather forecast data at a point in time
 * Used to track forecast changes as race day approaches
 */
export interface ForecastSnapshot {
  /** Unique identifier for this snapshot */
  id: string;
  /** ISO timestamp when snapshot was captured */
  capturedAt: string;
  /** Race event this snapshot is for */
  raceEventId: string;
  /** Venue ID for reference */
  venueId?: string;
  /** Hourly wind forecast data */
  windForecast: HourlyDataPoint[];
  /** Hourly tide forecast data */
  tideForecast: HourlyDataPoint[];
  /** Race-window specific values */
  raceWindow: RaceWindowData;
  /** Overall wind trend */
  windTrend: 'building' | 'steady' | 'easing';
  /** High tide time and height */
  highTide?: TideTimeData;
  /** Low tide time and height */
  lowTide?: TideTimeData;
  /** Data source */
  source?: 'openmeteo' | 'regional' | 'mock';
  /** Confidence level 0-1 */
  confidence?: number;
}

/**
 * AI-generated analysis comparing forecast snapshots
 */
export interface ForecastAnalysis {
  /** When the analysis was generated */
  analyzedAt: string;
  /** ID of previous snapshot compared */
  previousSnapshotId: string;
  /** ID of current snapshot compared */
  currentSnapshotId: string;
  /** One-sentence summary of key changes */
  summary: string;
  /** Tactical implications for race day */
  implications: string[];
  /** Overall change severity */
  alertLevel: 'stable' | 'minor_change' | 'significant_change';
  /** Specific changes detected */
  changes: {
    wind: { from: string; to: string; impact: string } | null;
    tide: { from: string; to: string; impact: string } | null;
    conditions: { from: string; to: string; impact: string } | null;
  };
}

/**
 * Forecast check intention - tracks weather snapshots over time
 */
export interface ForecastIntention {
  /** Saved forecast snapshots (max 3, FIFO) */
  snapshots: ForecastSnapshot[];
  /** Most recent AI analysis comparing snapshots */
  latestAnalysis?: ForecastAnalysis;
  /** When the user last checked the forecast */
  lastCheckedAt?: string;
}

/**
 * Strategy Brief intention - user's race focus and strategy checklist state
 */
export interface StrategyBriefIntention {
  /** User's primary focus/intention for the race (e.g., "Stay left on first beat") */
  raceIntention?: string;
  /** When the intention was last updated */
  intentionUpdatedAt?: string;
}

/**
 * A Playbook concept linked to a race as a focus area.
 * Connects the learning loop (Playbook) to race-day execution.
 */
export interface RaceFocusConcept {
  /** Playbook concept ID (FK to playbook_concepts.id) */
  conceptId: string;
  /** Concept title snapshot (for display even if concept is later deleted) */
  title: string;
  /** User's one-line race-day reminder for this concept */
  reminder?: string;
  /** Concept slug for deep-linking back to Playbook */
  slug?: string;
  /** ISO timestamp when linked */
  linkedAt: string;
}

/**
 * Pre-Start Specification - HOW the user will accomplish a pre-start check item
 */
export interface PreStartSpecification {
  /** The pre-start checklist item ID this specification belongs to */
  itemId: string;
  /** User's specification of HOW they will accomplish this (e.g., "VHF 72 at -10 min") */
  specification: string;
  /** ISO timestamp when the specification was set */
  specifiedAt: string;
}

/**
 * Briefing Schedule - user-entered schedule data from Pre-Race Briefing wizard
 */
export interface BriefingSchedule {
  /** Time to meet at the dock */
  meetAtDockTime?: string;
  /** Time to depart to race area */
  departDockTime?: string;
  /** Number of races planned */
  numberOfRaces?: number;
  /** Number of classes racing */
  numberOfClasses?: number;
  /** Class start order list */
  startOrder?: string[];
  /** Which start number is the user's class */
  myClassStartNumber?: number;
  /** Class flag description */
  classFlag?: string;
  /** Social events list */
  socialEvents?: { time: string; event: string; location?: string }[];
}

/**
 * Briefing Comms - user-entered communications data from Pre-Race Briefing wizard
 */
export interface BriefingComms {
  /** Safety/rescue VHF channel */
  safetyChannel?: string;
  /** Race Officer phone number */
  roPhone?: string;
  /** WhatsApp group link or name */
  whatsAppGroup?: string;
  /** Additional VHF backup channel */
  backupChannel?: string;
  /** General comms notes */
  notes?: string;
}

/**
 * Complete race intentions structure
 * Stored in sailor_race_preparation.user_intentions JSONB column
 */
export interface RaceIntentions {
  /** Race Card - arrival time intention */
  arrivalTime?: ArrivalTimeIntention;

  /** Conditions Card - sail selection from boat inventory */
  sailSelection?: SailSelectionIntention;

  /** Rig Card - per-item intentions for rig settings */
  rigIntentions?: RigIntentions;

  /** Course Card - course identification from SI */
  courseSelection?: CourseSelectionIntention;

  /** Strategy Cards - per-section user notes (keyed by section ID) */
  strategyNotes?: StrategyNotes;

  /** Watch Schedule - crew watch rotation for distance races */
  watchSchedule?: WatchSchedule;

  /** Checklist Completions - keyed by checklist item ID */
  checklistCompletions?: Record<string, ChecklistCompletion>;

  /** Forecast Check - weather snapshots and AI analysis */
  forecastCheck?: ForecastIntention;

  /** Strategy Brief - race intention and strategy checklist */
  strategyBrief?: StrategyBriefIntention;

  /** Pre-Start Specifications - HOW user will accomplish pre-start checks (keyed by item ID) */
  preStartSpecifications?: Record<string, PreStartSpecification>;

  /** Briefing Schedule - user-entered schedule data from Pre-Race Briefing wizard */
  briefingSchedule?: BriefingSchedule;

  /** Briefing Comms - user-entered communications data from Pre-Race Briefing wizard */
  briefingComms?: BriefingComms;

  /** Briefing Sections Reviewed - which sections of the Pre-Race Briefing have been marked reviewed */
  briefingSectionsReviewed?: string[];

  /** Playbook concepts the sailor wants to focus on during this race */
  raceFocusConcepts?: RaceFocusConcept[];

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Partial update type for individual intention updates
 */
export type RaceIntentionUpdate = Partial<Omit<RaceIntentions, 'updatedAt'>>;

/**
 * Sail inventory item from boat_equipment
 */
export interface SailInventoryItem {
  id: string;
  customName?: string;
  category: 'mainsail' | 'jib' | 'genoa' | 'spinnaker' | 'code_zero';
  manufacturer?: string;
  model?: string;
  conditionRating?: number;
  status: 'active' | 'backup' | 'retired' | 'sold';
  totalRacesUsed?: number;
  lastUsedDate?: string;
  /** Sail cloth weight — critical for selection in different conditions */
  sailWeight?: 'light' | 'medium' | 'heavy';
  notes?: string;
}

/**
 * Grouped sail inventory by category
 */
export interface GroupedSailInventory {
  mainsails: SailInventoryItem[];
  jibs: SailInventoryItem[];
  genoas: SailInventoryItem[];
  spinnakers: SailInventoryItem[];
  codeZeros: SailInventoryItem[];
}

/**
 * Default empty intentions object
 */
export const DEFAULT_RACE_INTENTIONS: RaceIntentions = {
  updatedAt: new Date().toISOString(),
};

/**
 * Helper to create a new intentions object with current timestamp
 */
export function createRaceIntentions(
  partial?: RaceIntentionUpdate
): RaceIntentions {
  return {
    ...partial,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to merge intention updates
 */
export function mergeRaceIntentions(
  existing: RaceIntentions | undefined,
  update: RaceIntentionUpdate
): RaceIntentions {
  return {
    ...existing,
    ...update,
    updatedAt: new Date().toISOString(),
  };
}
