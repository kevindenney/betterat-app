/**
 * Race Constants
 *
 * Shared constants and type definitions for race-related features.
 */

import type { RaceDocumentType } from '@/services/RaceDocumentService';

// =============================================================================
// DOCUMENT TYPES
// =============================================================================

export interface DocumentTypeOption {
  label: string;
  description: string;
  value: RaceDocumentType;
}

/**
 * Available document type options for race documents
 */
export const DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  {
    label: 'Sailing Instructions',
    description: 'Standard SI packets and updates',
    value: 'sailing_instructions',
  },
  {
    label: 'Notice of Race',
    description: 'NORs or addenda',
    value: 'nor',
  },
  {
    label: 'Course Diagram',
    description: 'Course charts or layouts',
    value: 'course_diagram',
  },
  {
    label: 'Amendment',
    description: 'Rule changes after publication',
    value: 'amendment',
  },
  {
    label: 'NOTAM',
    description: 'Notices to mariners / harbor ops',
    value: 'notam',
  },
  {
    label: 'Other',
    description: 'Anything else worth sharing',
    value: 'other',
  },
];

/**
 * Normalize document type from service to card format
 */
export function normalizeDocumentType(
  type: RaceDocumentType | string | undefined
): RaceDocumentType {
  switch (type) {
    case 'sailing_instructions':
    case 'nor':
    case 'course_diagram':
    case 'amendment':
    case 'notam':
      return type;
    default:
      return 'other';
  }
}

// =============================================================================
// STORAGE KEYS
// =============================================================================

/**
 * AsyncStorage key for dismissing AddRaceTimelineCard
 */
export const ADD_RACE_CARD_DISMISSED_KEY = '@regattaflow/add_race_card_dismissed';

/**
 * AsyncStorage key for dismissing the Sample Race card
 */
export const SAMPLE_RACE_DISMISSED_KEY = '@regattaflow/sample_race_dismissed';

/**
 * AsyncStorage key for races hidden from the user's timeline
 * Stores a JSON array of race IDs
 */
export const HIDDEN_RACES_KEY = '@regattaflow/hidden_races';

// =============================================================================
// UI INTERFACES
// =============================================================================

/**
 * Summary data for active race display
 */
export interface ActiveRaceSummary {
  id: string;
  name: string;
  series?: string;
  venue?: string;
  startTime?: string;
  warningSignal?: string;
  cleanRegatta?: boolean;
  lastUpdated?: string | null;
}

/**
 * Extended race brief data with countdown and weather
 */
export interface RaceBriefData extends ActiveRaceSummary {
  countdown?: {
    days: number;
    hours: number;
    minutes: number;
  };
  weatherSummary?: string;
  tideSummary?: string;
}

/**
 * Rig preset configuration
 */
export interface RigPreset {
  id: string;
  label: string;
  windRange: string;
  uppers: string;
  lowers: string;
  runners: string;
  ram: string;
  notes: string;
}

/**
 * Regulatory digest data for race compliance
 */
export interface RegulatoryDigestData {
  seriesName: string;
  venueArea: string;
  cleanRegatta: boolean;
  signOnWindow: string;
  entryNotes: string[];
  courseSelection: string;
  safetyNotes: string[];
  reference: string;
}

/**
 * User acknowledgements for regulatory requirements
 */
export interface RegulatoryAcknowledgements {
  cleanRegatta: boolean;
  signOn: boolean;
  safetyBriefing: boolean;
}

/**
 * Course outline group with courses
 */
export interface CourseOutlineGroup {
  group: string;
  description: string;
  courses: {
    name: string;
    sequence: string;
  }[];
}

// =============================================================================
// MOCK DATA (for testing/development)
// =============================================================================

/**
 * Mock GPS track data for DEBRIEF mode testing
 */
export const MOCK_GPS_TRACK = Array.from({ length: 100 }, (_, i) => {
  const t = i / 100;
  const baseTime = new Date('2024-06-15T14:00:00Z');

  return {
    latitude: 37.8 + Math.sin(t * Math.PI * 4) * 0.01 + t * 0.02,
    longitude: -122.4 + Math.cos(t * Math.PI * 4) * 0.01 + t * 0.015,
    timestamp: new Date(baseTime.getTime() + i * 30000), // 30 seconds apart
    speed: 5 + Math.random() * 3 + Math.sin(t * Math.PI * 2) * 2,
    heading: (t * 360) % 360,
    accuracy: 5 + Math.random() * 3,
  };
});

/**
 * Mock split times data for DEBRIEF mode testing
 */
export const MOCK_SPLIT_TIMES = [
  {
    markId: 'start',
    markName: 'Start Line',
    time: new Date('2024-06-15T14:00:00Z'),
    position: 8,
    roundingType: 'port' as const,
    roundingTime: 0,
  },
  {
    markId: 'mark1',
    markName: 'Windward Mark',
    time: new Date('2024-06-15T14:12:30Z'),
    position: 5,
    roundingType: 'port' as const,
    roundingTime: 4.2,
  },
  {
    markId: 'mark2',
    markName: 'Leeward Gate',
    time: new Date('2024-06-15T14:22:15Z'),
    position: 4,
    roundingType: 'starboard' as const,
    roundingTime: 6.8,
  },
  {
    markId: 'mark3',
    markName: 'Windward Mark',
    time: new Date('2024-06-15T14:34:45Z'),
    position: 3,
    roundingType: 'port' as const,
    roundingTime: 3.9,
  },
  {
    markId: 'finish',
    markName: 'Finish Line',
    time: new Date('2024-06-15T14:45:00Z'),
    position: 3,
    roundingType: 'port' as const,
    roundingTime: 0,
  },
];
