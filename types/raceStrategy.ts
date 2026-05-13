/**
 * Race Strategy Types
 * Structures for strategy planning with AI recommendations and user notes
 *
 * Supports race-type-specific strategy sections:
 * - Fleet: Traditional buoy racing (START, UPWIND, DOWNWIND, MARK ROUNDING, FINISH)
 * - Distance: Offshore/passage racing with leg-by-leg strategy
 * - Match: 1-on-1 match racing tactics
 * - Team: Multi-boat team racing coordination
 */

import type { PerformanceTrend } from './raceLearning';

/**
 * Race format types
 */
export type RaceType = 'fleet' | 'distance' | 'match' | 'team';

/**
 * Past performance data for a strategy section
 */
export interface SectionPerformance {
  avgRating: number;
  trend: PerformanceTrend;
  sampleCount: number;
  lastRaceNote?: string;
}

/**
 * Individual strategy section with AI recommendation and user plan
 */
export interface StrategySectionNote {
  aiRecommendation?: string;
  userPlan?: string;
  pastPerformance?: SectionPerformance;
  updatedAt?: string;
}

/**
 * Strategy sections for Start phase
 */
export interface StartStrategyNotes {
  lineBias: StrategySectionNote;
  favoredEnd: StrategySectionNote;
  timingApproach: StrategySectionNote;
}

/**
 * Strategy sections for Upwind phase
 */
export interface UpwindStrategyNotes {
  favoredTack: StrategySectionNote;
  shiftStrategy: StrategySectionNote;
  laylineApproach: StrategySectionNote;
}

/**
 * Strategy sections for Downwind phase
 */
export interface DownwindStrategyNotes {
  favoredGybe: StrategySectionNote;
  pressureStrategy: StrategySectionNote;
  vmgApproach: StrategySectionNote;
}

/**
 * Strategy sections for Mark Rounding
 */
export interface MarkRoundingStrategyNotes {
  approach: StrategySectionNote;
  exitStrategy: StrategySectionNote;
  tacticalPosition: StrategySectionNote;
}

/**
 * Strategy sections for Finish
 */
export interface FinishStrategyNotes {
  lineBias: StrategySectionNote;
  finalApproach: StrategySectionNote;
}

/**
 * Complete strategy notes structure for all phases
 */
export interface RaceStrategyNotes {
  start: StartStrategyNotes;
  upwind: UpwindStrategyNotes;
  downwind: DownwindStrategyNotes;
  markRounding: MarkRoundingStrategyNotes;
  finish: FinishStrategyNotes;
  updatedAt?: string;
}

/**
 * Strategy section identifiers for lookup
 * Now flexible to support dynamic IDs for distance racing legs (e.g., 'leg.1.navigation')
 */
export type StrategySectionId = string;

/**
 * Fleet racing section IDs (for type safety when working with fleet races)
 */
export type FleetStrategySectionId =
  // Start
  | 'start.lineBias'
  | 'start.favoredEnd'
  | 'start.timingApproach'
  // Upwind
  | 'upwind.favoredTack'
  | 'upwind.shiftStrategy'
  | 'upwind.laylineApproach'
  // Downwind
  | 'downwind.favoredGybe'
  | 'downwind.pressureStrategy'
  | 'downwind.vmgApproach'
  // Mark Rounding
  | 'markRounding.approach'
  | 'markRounding.exitStrategy'
  | 'markRounding.tacticalPosition'
  // Finish
  | 'finish.lineBias'
  | 'finish.finalApproach';

/**
 * Strategy phase categories - expanded for all race types
 */
export type StrategyPhase =
  // Fleet racing phases (existing)
  | 'start'
  | 'upwind'
  | 'downwind'
  | 'markRounding'
  | 'finish'
  // Distance racing phases (new)
  | 'passage'
  | 'weatherRouting'
  | 'watchSchedule'
  | 'crewManagement'
  // Match racing phases (new)
  | 'preStart'
  | 'dialUp'
  | 'control'
  | 'coverage'
  // Team racing phases (new)
  | 'teamCoordination'
  | 'combinations'
  | 'passing';

/**
 * Dynamic phase key for distance racing legs and peaks
 * Format: 'leg-{number}' or 'peak-{peakId}'
 */
export type DynamicPhaseKey = `leg-${number}` | `peak-${string}`;

/**
 * Section metadata for UI rendering
 */
export interface StrategySectionMeta {
  id: StrategySectionId;
  phase: StrategyPhase | DynamicPhaseKey;
  title: string;
  icon: string;
  description: string;
  defaultTip: string; // Generic best practice when no history
  raceTypes?: RaceType[]; // Which race types use this section (undefined = all)
  legIndex?: number; // For distance racing leg sections
  peakId?: string; // For Four Peaks climbing sections
}

/**
 * Fleet racing strategy sections (legacy constant for backward compatibility)
 * For new code, use getStrategyConfig() from lib/strategy/strategyConfig.ts
 */
export const STRATEGY_SECTIONS: StrategySectionMeta[] = [
  // Start
  {
    id: 'start.lineBias',
    phase: 'start',
    title: 'Line Bias',
    icon: 'scale-balance',
    description: 'Analyze wind direction relative to start line to determine favored end',
    defaultTip: 'Sail down the line before the start to check for bias. If one end is closer to the wind, start there.',
  },
  {
    id: 'start.favoredEnd',
    phase: 'start',
    title: 'Favored End',
    icon: 'flag-variant',
    description: 'Based on wind, current, and first leg strategy, recommend pin or boat end',
    defaultTip: 'Consider both line bias and your first leg strategy. Sometimes the less favored end gives cleaner air.',
  },
  {
    id: 'start.timingApproach',
    phase: 'start',
    title: 'Timing Approach',
    icon: 'timer-outline',
    description: 'Plan your final minute approach and acceleration',
    defaultTip: 'Practice your time-distance runs to build confidence. Know how long it takes to accelerate to full speed.',
  },
  // Upwind
  {
    id: 'upwind.favoredTack',
    phase: 'upwind',
    title: 'Favored Tack',
    icon: 'arrow-up-bold',
    description: 'Determine starboard or port tack advantage based on wind shifts and current',
    defaultTip: 'In oscillating breeze, favor the lifted tack. In persistent shift, get to the favored side early.',
  },
  {
    id: 'upwind.shiftStrategy',
    phase: 'upwind',
    title: 'Shift Strategy',
    icon: 'compass-outline',
    description: 'Plan how to play wind shifts - tack on headers or sail the lifts',
    defaultTip: 'Track compass headings to detect shifts early. Tack when headed 5-7° in oscillating conditions.',
  },
  {
    id: 'upwind.laylineApproach',
    phase: 'upwind',
    title: 'Layline Approach',
    icon: 'vector-line',
    description: 'When to approach the layline - early, late, or standard',
    defaultTip: 'Avoid early laylines in shifty conditions. Stay in the middle to keep options open.',
  },
  // Downwind
  {
    id: 'downwind.favoredGybe',
    phase: 'downwind',
    title: 'Favored Gybe',
    icon: 'arrow-down-bold',
    description: 'Determine port or starboard gybe advantage',
    defaultTip: 'Check apparent wind angle - gybe when it moves aft without getting stronger (you\'re being lifted).',
  },
  {
    id: 'downwind.pressureStrategy',
    phase: 'downwind',
    title: 'Pressure Strategy',
    icon: 'weather-windy',
    description: 'Plan to sail in pressure bands and puffs',
    defaultTip: 'Look upwind for pressure. Sail towards darker water and whitecaps to stay in the strongest wind.',
  },
  {
    id: 'downwind.vmgApproach',
    phase: 'downwind',
    title: 'VMG Approach',
    icon: 'speedometer',
    description: 'Balance between sailing deep vs hot angles',
    defaultTip: 'In light air, sail hotter angles for speed. In breeze, sail deeper to reduce distance.',
  },
  // Mark Rounding
  {
    id: 'markRounding.approach',
    phase: 'markRounding',
    title: 'Approach',
    icon: 'location-enter',
    description: 'Plan your entry angle and positioning',
    defaultTip: 'Approach wide to round tight. This gives you inside position and a better exit angle.',
  },
  {
    id: 'markRounding.exitStrategy',
    phase: 'markRounding',
    title: 'Exit Strategy',
    icon: 'location-exit',
    description: 'Plan your exit angle and next leg setup',
    defaultTip: 'Exit close to the mark to sail the shortest distance to the next mark.',
  },
  {
    id: 'markRounding.tacticalPosition',
    phase: 'markRounding',
    title: 'Tactical Position',
    icon: 'chess-knight',
    description: 'Position relative to competitors at the mark',
    defaultTip: 'Consider overlaps and rights. Sometimes giving up a position at the mark gains you more on the next leg.',
  },
  // Finish
  {
    id: 'finish.lineBias',
    phase: 'finish',
    title: 'Line Bias',
    icon: 'scale-balance',
    description: 'Identify the favored end of the finish line',
    defaultTip: 'Check the finish line bias as you approach. The closer end can save boat lengths.',
  },
  {
    id: 'finish.finalApproach',
    phase: 'finish',
    title: 'Final Approach',
    icon: 'flag-checkered',
    description: 'Plan your final tactical moves to the line',
    defaultTip: 'Protect your position on the final approach. A safe finish is often better than a risky gain.',
  },
];

/**
 * Get sections for a specific phase (fleet racing only - legacy function)
 * @deprecated Use getStrategyConfig() from lib/strategy/strategyConfig.ts
 */
export function getSectionsForPhase(phase: StrategyPhase): StrategySectionMeta[] {
  return STRATEGY_SECTIONS.filter((s) => s.phase === phase);
}

/**
 * Get section metadata by ID (fleet racing only - legacy function)
 * @deprecated Use getStrategyConfig() from lib/strategy/strategyConfig.ts
 */
export function getSectionMeta(id: StrategySectionId): StrategySectionMeta | undefined {
  return STRATEGY_SECTIONS.find((s) => s.id === id);
}

// =============================================================================
// RACE TYPE STRATEGY CONFIG INTERFACES
// =============================================================================

/**
 * Phase info for rendering in UI
 */
export interface PhaseInfo {
  key: StrategyPhase | DynamicPhaseKey;
  label: string;
}

/**
 * Data needed to generate dynamic sections for distance races
 */
export interface DistanceRaceData {
  routeWaypoints?: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    passingInstruction?: string;
  }[];
  legs?: {
    legNumber: number;
    name: string;
    startLocation: string;
    endLocation: string;
    estimatedDurationHours?: number;
    followedByPeak?: string | null;
  }[];
  peaks?: {
    id: string;
    name: string;
    location: string;
    estimatedClimbHours: number;
  }[];
  totalDistanceNm?: number;
  timeLimitHours?: number;
}

/**
 * Configuration for race-type-specific strategy
 */
export interface RaceTypeStrategyConfig {
  raceType: RaceType;
  phases: PhaseInfo[];
  staticSections: StrategySectionMeta[];
  generateDynamicSections?: (raceData: DistanceRaceData) => {
    phases: PhaseInfo[];
    sections: StrategySectionMeta[];
  };
}
