/**
 * Season Types
 *
 * Data model for season-based race architecture.
 * Sailors think in seasons ("Winter 2024-25"), not flat race lists.
 */

// =============================================================================
// SEASON STATUS
// =============================================================================

export type SeasonStatus = 'draft' | 'upcoming' | 'active' | 'completed' | 'archived';

// =============================================================================
// CORE SEASON TYPE
// =============================================================================

export interface Season {
  id: string;
  name: string;                    // "Winter Series 2024-25"
  short_name?: string | null;      // "Winter 24-25"
  year: number;                    // 2024
  year_end?: number | null;        // 2025 (if spans years)

  user_id?: string | null;         // Personal season
  club_id?: string | null;         // Club season

  start_date: string;              // ISO date
  end_date: string;                // ISO date
  status: SeasonStatus;

  scoring_rules?: SeasonScoringRules | null;
  discard_rules?: DiscardRules | null;

  description?: string | null;

  /** Free-text vision — what the user wants this arc to add up to. */
  vision_statement?: string | null;
  /** Optional anchors to org_competencies(id) — drives per-competency
   *  progress bars on the L3 VISION lane when present. */
  vision_competency_ids?: string[];

  created_at: string;
  updated_at: string;
}

// =============================================================================
// SCORING RULES
// =============================================================================

export interface SeasonScoringRules {
  /** How to aggregate points across regattas */
  aggregation: 'sum' | 'average' | 'best_n';

  /** Number of best results to count (if aggregation is 'best_n') */
  best_n?: number;

  /** Custom weights per regatta ID */
  regatta_weights?: Record<string, number>;

  /** Multiplier for championship regattas */
  championship_multiplier?: number;
}

export interface DiscardRules {
  /** Type of discard rule */
  type: 'none' | 'worst_n' | 'percentage';

  /** Number of worst results to discard (if type is 'worst_n') */
  count?: number;

  /** Percentage of results to discard (if type is 'percentage') */
  percentage?: number;

  /** Minimum races before discards apply */
  min_races_for_discard?: number;
}

// =============================================================================
// SEASON WITH COMPUTED SUMMARY
// =============================================================================

export interface SeasonSummary {
  regatta_count: number;
  total_races: number;
  completed_races: number;
  upcoming_races: number;

  /** User's standing in this season (if applicable) */
  user_standing?: {
    rank: number;
    total_entries: number;
    net_points: number;
    wins: number;
    podiums: number;
    best_finish: number;
  };

  /** Results sequence for sparkline display: [2, 4, 1, null, 3, 2, 5, 1] */
  results?: (number | null)[];

  /** Aggregated conditions for the season */
  conditions?: {
    avg_wind_speed: number;
    wind_range: [number, number];
    predominant_direction: string;
    light_days: number;        // < 10kt
    heavy_days: number;        // > 15kt
  };
}

export interface SeasonWithSummary extends Season {
  summary: SeasonSummary;
}

// =============================================================================
// SEASON REGATTA (JUNCTION)
// =============================================================================

export interface SeasonRegatta {
  id: string;
  season_id: string;
  regatta_id: string;
  sequence: number;
  weight: number;
  is_championship: boolean;
  created_at: string;

  /** Joined regatta data (when fetched with join) */
  regatta?: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    status: string;
    club_id?: string;
    race_count?: number;
  };
}

// =============================================================================
// SEASON STANDINGS
// =============================================================================

export interface SeasonStanding {
  id: string;
  season_id: string;
  user_id?: string | null;
  entry_id?: string | null;

  // Display info
  sailor_name: string;
  boat_name?: string | null;
  sail_number?: string | null;
  division?: string | null;
  fleet?: string | null;

  // Aggregated results
  rank: number;
  total_points: number;
  net_points: number;          // After discards
  races_sailed: number;
  races_counted: number;       // After discards

  // Detailed breakdown
  regatta_results: RegattaResult[];
  race_results: RaceResult[];
  discards: number[];          // Indices of discarded results

  // Stats
  wins: number;
  podiums: number;             // Top 3 finishes
  best_finish: number;
  worst_finish: number;

  computed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegattaResult {
  regatta_id: string;
  regatta_name: string;
  position: number;
  points: number;
  races_in_regatta: number;
}

export interface RaceResult {
  regatta_id?: string;
  race_id?: string;
  race_number: number;
  race_date: string;
  position: number | null;     // null = DNS/DNF/etc
  points: number;
  status_code?: string;        // 'DNS', 'DNF', 'DSQ', 'OCS', etc.
  is_discarded?: boolean;
  conditions?: {
    wind_speed: number;
    wind_direction: string;
  };
}

// =============================================================================
// HELPER TYPES
// =============================================================================

/** Season list item for archive display */
export interface SeasonListItem {
  id: string;
  name: string;
  short_name?: string | null;
  year: number;
  status: SeasonStatus;
  start_date: string;
  end_date: string;

  // Summary counts
  regatta_count: number;
  race_count: number;
  completed_count: number;

  // User's result (if applicable)
  user_position?: number | null;
  user_points?: number | null;
}

/** Create season input */
export interface CreateSeasonInput {
  name: string;
  short_name?: string;
  year: number;
  year_end?: number;
  start_date: string;
  end_date: string;
  club_id?: string;
  description?: string;
  scoring_rules?: SeasonScoringRules;
  discard_rules?: DiscardRules;
}

/** Update season input */
export interface UpdateSeasonInput {
  name?: string;
  short_name?: string;
  start_date?: string;
  end_date?: string;
  status?: SeasonStatus;
  description?: string;
  scoring_rules?: SeasonScoringRules;
  discard_rules?: DiscardRules;
  vision_statement?: string | null;
  vision_competency_ids?: string[];
}
