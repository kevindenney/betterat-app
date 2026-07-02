/**
 * PostRaceLearningService
 *
 * Aggregates race history to detect recurring strengths and focus areas,
 * then optionally uses secure edge-function AI calls to generate personalized summaries.
 */

import { createLogger } from '@/lib/utils/logger';
import { supabase } from '@/services/supabase';
import type {
  RegattaFlowPlaybookFramework,
  CoachingFeedback,
  FrameworkScores,
  RaceAnalysis,
} from '@/types/raceAnalysis';
import type {
  AILearningSummary,
  LearningProfile,
  PerformancePattern,
  PerformanceSample,
  PerformanceTrend,
  RecurringInsight,
} from '@/types/raceLearning';

const logger = createLogger('PostRaceLearningService');

type NumericRatingKey = Extract<
  keyof RaceAnalysis,
  | 'equipment_rating'
  | 'planning_rating'
  | 'crew_rating'
  | 'prestart_rating'
  | 'start_rating'
  | 'upwind_rating'
  | 'upwind_shift_awareness'
  | 'windward_mark_rating'
  | 'downwind_rating'
  | 'leeward_mark_rating'
  | 'finish_rating'
  | 'overall_satisfaction'
>;

type NotesKey = Extract<
  keyof RaceAnalysis,
  | 'equipment_notes'
  | 'planning_notes'
  | 'crew_notes'
  | 'prestart_notes'
  | 'start_notes'
  | 'upwind_notes'
  | 'windward_mark_notes'
  | 'downwind_notes'
  | 'leeward_mark_notes'
  | 'finish_notes'
>;

interface RatingMetric {
  key: NumericRatingKey;
  notesKey?: NotesKey;
  id: string;
  label: string;
  category: PerformancePattern['category'];
}

interface FrameworkMapping {
  key: keyof FrameworkScores;
  framework: RegattaFlowPlaybookFramework;
}

interface RaceAnalysisRecord extends RaceAnalysis {
  created_at: string;
  race_id: string;
}

const RATING_METRICS: RatingMetric[] = [
  {
    key: 'equipment_rating',
    notesKey: 'equipment_notes',
    id: 'equipment-prep',
    label: 'Equipment preparation',
    category: 'preparation',
  },
  {
    key: 'planning_rating',
    notesKey: 'planning_notes',
    id: 'pre-race-planning',
    label: 'Pre-race planning',
    category: 'preparation',
  },
  {
    key: 'crew_rating',
    notesKey: 'crew_notes',
    id: 'crew-coordination',
    label: 'Crew coordination',
    category: 'crew',
  },
  {
    key: 'prestart_rating',
    notesKey: 'prestart_notes',
    id: 'prestart-sequence',
    label: 'Pre-start sequence',
    category: 'start',
  },
  {
    key: 'start_rating',
    notesKey: 'start_notes',
    id: 'start-execution',
    label: 'Start execution',
    category: 'start',
  },
  {
    key: 'upwind_rating',
    notesKey: 'upwind_notes',
    id: 'upwind-execution',
    label: 'Upwind execution',
    category: 'upwind',
  },
  {
    key: 'upwind_shift_awareness',
    notesKey: 'upwind_notes',
    id: 'shift-awareness',
    label: 'Shift awareness',
    category: 'upwind',
  },
  {
    key: 'windward_mark_rating',
    notesKey: 'windward_mark_notes',
    id: 'windward-rounding',
    label: 'Windward mark rounding',
    category: 'mark_rounding',
  },
  {
    key: 'downwind_rating',
    notesKey: 'downwind_notes',
    id: 'downwind-speed',
    label: 'Downwind speed and positioning',
    category: 'downwind',
  },
  {
    key: 'leeward_mark_rating',
    notesKey: 'leeward_mark_notes',
    id: 'leeward-rounding',
    label: 'Leeward mark rounding',
    category: 'mark_rounding',
  },
  {
    key: 'finish_rating',
    notesKey: 'finish_notes',
    id: 'finish-execution',
    label: 'Finish execution',
    category: 'overall',
  },
  {
    key: 'overall_satisfaction',
    id: 'overall-satisfaction',
    label: 'Overall satisfaction',
    category: 'overall',
  },
];

const FRAMEWORK_MAPPINGS: FrameworkMapping[] = [
  { key: 'puff_response', framework: 'Puff Response Framework' },
  { key: 'shift_awareness', framework: 'Wind Shift Mathematics' },
  { key: 'delayed_tack_usage', framework: 'Delayed Tack' },
  { key: 'downwind_detection', framework: 'Downwind Shift Detection' },
  { key: 'getting_in_phase', framework: 'Getting In Phase' },
  { key: 'covering_tactics', framework: 'Shift Frequency Formula' },
  { key: 'overall_framework_adoption', framework: 'Performance Pyramid' },
];

const STRENGTH_AVERAGE_THRESHOLD = 4;
const STRENGTH_RECENT_THRESHOLD = 3.6;
const FOCUS_AVERAGE_THRESHOLD = 2.5;
const FOCUS_RECENT_THRESHOLD = 3;
const RATING_TREND_TOLERANCE = 0.25;
const FRAMEWORK_TREND_TOLERANCE = 5;

function average(values: number[]): number {
  if (!values.length) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function determineTrend(values: number[], tolerance: number): PerformanceTrend {
  if (values.length < 3) {
    return 'stable';
  }

  const recentCount = Math.max(2, Math.floor(values.length / 3));
  const previous = values.slice(0, values.length - recentCount);
  const recent = values.slice(-recentCount);

  if (previous.length === 0) {
    return 'stable';
  }

  const recentAvg = average(recent);
  const previousAvg = average(previous);
  const delta = recentAvg - previousAvg;

  if (Math.abs(delta) <= tolerance) {
    return 'stable';
  }

  return delta > 0 ? 'improving' : 'declining';
}

function buildSamples(
  analyses: RaceAnalysisRecord[],
  key: NumericRatingKey,
  notesKey?: NotesKey
): PerformanceSample[] {
  return analyses
    .filter((analysis) => typeof analysis[key] === 'number')
    .map((analysis) => ({
      raceId: analysis.race_id,
      createdAt: analysis.created_at,
      value: Number(analysis[key]),
      notes: notesKey ? (analysis[notesKey] as string | undefined) : undefined,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function samplesToPattern(
  metric: RatingMetric,
  samples: PerformanceSample[]
): PerformancePattern | null {
  if (!samples.length) {
    return null;
  }

  const values = samples.map((sample) => sample.value);
  const avg = average(values);
  const latest = samples[samples.length - 1]?.value ?? null;
  const trend = determineTrend(values, RATING_TREND_TOLERANCE);

  const confidence =
    samples.length >= 6 ? 'high' : samples.length >= 3 ? 'medium' : 'low';

  const message = `${metric.label}: ${avg.toFixed(1)} average across ${samples.length} races${trend !== 'stable' ? ` (${trend})` : ''}.`;

  return {
    id: metric.id,
    label: metric.label,
    category: metric.category,
    average: Number(avg.toFixed(2)),
    latest,
    trend,
    sampleCount: samples.length,
    confidence,
    supportingSamples: samples.slice(-5),
    message,
  };
}

function deriveRecurringInsightsFromPatterns(
  patterns: PerformancePattern[],
  type: RecurringInsight['type']
): RecurringInsight[] {
  return patterns.map((pattern) => ({
    id: `${type}-${pattern.id}`,
    type,
    summary: pattern.message ?? pattern.label,
    supportingRaces: pattern.supportingSamples.map((sample) => ({
      raceId: sample.raceId,
      createdAt: sample.createdAt,
    })),
  }));
}

function buildStrengthsAndFocus(patterns: PerformancePattern[]) {
  const strengths: PerformancePattern[] = [];
  const focus: PerformancePattern[] = [];

  for (const pattern of patterns) {
    const { average: avg, latest, trend } = pattern;

    const qualifiesAsStrength =
      avg >= STRENGTH_AVERAGE_THRESHOLD ||
      (trend === 'improving' && (latest ?? 0) >= STRENGTH_RECENT_THRESHOLD);

    const qualifiesAsFocus =
      avg <= FOCUS_AVERAGE_THRESHOLD ||
      (trend === 'declining' && (latest ?? 5) <= FOCUS_RECENT_THRESHOLD);

    if (qualifiesAsStrength) {
      strengths.push(pattern);
      continue;
    }

    if (qualifiesAsFocus) {
      focus.push(pattern);
    }
  }

  strengths.sort((a, b) => b.average - a.average);
  focus.sort((a, b) => a.average - b.average);

  return {
    strengths: strengths.slice(0, 4),
    focusAreas: focus.slice(0, 4),
  };
}

function calculateFrameworkTrends(analyses: RaceAnalysisRecord[]) {
  return FRAMEWORK_MAPPINGS.map((mapping) => {
    const values: { value: number; createdAt: string }[] = analyses
      .map((analysis) => {
        const score = analysis.framework_scores?.[mapping.key];
        if (typeof score !== 'number') {
          return null;
        }
        return { value: score, createdAt: analysis.created_at };
      })
      .filter((entry): entry is { value: number; createdAt: string } => entry !== null)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (!values.length) {
      return null;
    }

    const scoreSeries = values.map((entry) => entry.value);
    const avg = average(scoreSeries);
    const latest = values[values.length - 1]?.value ?? 0;
    const first = values[0]?.value ?? latest;
    const delta = latest - first;
    const trend = determineTrend(scoreSeries, FRAMEWORK_TREND_TOLERANCE);

    return {
      framework: mapping.framework,
      races_analyzed: values.length,
      trend,
      average_score: Number(avg.toFixed(1)),
      latest_score: Number(latest.toFixed(1)),
      change_percentage: Number(delta.toFixed(1)),
    };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function collectRecentRaces(analyses: RaceAnalysisRecord[]) {
  const recent = analyses.slice(-5);
  return recent.map((analysis) => ({
    raceId: analysis.race_id,
    createdAt: analysis.created_at,
    startRating: analysis.start_rating ?? null,
    upwindRating: analysis.upwind_rating ?? null,
    downwindRating: analysis.downwind_rating ?? null,
    keyLearnings: analysis.key_learnings ?? [],
    nextRaceFocus: (analysis.ai_coaching_feedback as CoachingFeedback[] | null)?.map(
      (feedback) => feedback.next_race_focus
    ) ?? [],
  }));
}

function formatPatternsForAi(patterns: PerformancePattern[]) {
  return patterns.map((pattern) => ({
    id: pattern.id,
    label: pattern.label,
    category: pattern.category,
    average: pattern.average,
    latest: pattern.latest ?? null,
    trend: pattern.trend,
    sampleCount: pattern.sampleCount,
    confidence: pattern.confidence,
    summary: pattern.message,
  }));
}

function formatInsightsForAi(insights: RecurringInsight[]) {
  return insights.map((insight) => ({
    id: insight.id,
    summary: insight.summary,
    supportingRaces: insight.supportingRaces,
  }));
}

class PostRaceLearningService {
  constructor() {}

  async getLearningProfileForUser(userId: string): Promise<LearningProfile | null> {
    try {
      const sailorId = await this.getSailorProfileId(userId);
      if (!sailorId) {
        logger.debug('PostRaceLearningService: No sailor profile found for user:', userId);
        return null;
      }

      const analyses = await this.fetchRaceAnalyses(sailorId);
      if (!analyses.length) {
        return {
          sailorId,
          racesAnalyzed: 0,
          strengths: [],
          focusAreas: [],
          frameworkTrends: [],
          recurringWins: [],
          recurringChallenges: [],
          lastUpdated: new Date().toISOString(),
        };
      }

      const ratingPatterns = RATING_METRICS.map((metric) =>
        samplesToPattern(metric, buildSamples(analyses, metric.key, metric.notesKey))
      ).filter((pattern): pattern is PerformancePattern => Boolean(pattern));

      const { strengths, focusAreas } = buildStrengthsAndFocus(ratingPatterns);
      const frameworkTrends = calculateFrameworkTrends(analyses);

      const recurringWins = deriveRecurringInsightsFromPatterns(strengths, 'win');
      const recurringChallenges = deriveRecurringInsightsFromPatterns(focusAreas, 'challenge');

      const profile: LearningProfile = {
        sailorId,
        racesAnalyzed: analyses.length,
        lastRaceCompletedAt: analyses[analyses.length - 1]?.created_at,
        strengths,
        focusAreas,
        frameworkTrends,
        recurringWins,
        recurringChallenges,
        lastUpdated: new Date().toISOString(),
      };

      const aiSummary = await this.generateAISummary(profile, analyses);
      if (aiSummary) {
        profile.aiSummary = aiSummary;
      }

      return profile;
    } catch (error) {
      logger.error('PostRaceLearningService: Failed to build learning profile', error);
      return null;
    }
  }

  /**
   * Get phase-specific performance insights and AI suggestions for strategy planning
   */
  async getPhaseSpecificInsights(
    userId: string,
    phase: 'rigTuning' | 'prestart' | 'start' | 'upwind' | 'windwardMark' | 'downwind' | 'leewardMark' | 'finish'
  ): Promise<{
    pattern: PerformancePattern | null;
    aiSuggestion: string | null;
  }> {
    try {
      const sailorId = await this.getSailorProfileId(userId);
      if (!sailorId) {
        return { pattern: null, aiSuggestion: null };
      }

      const analyses = await this.fetchRaceAnalyses(sailorId);
      if (!analyses.length) {
        return { pattern: null, aiSuggestion: null };
      }

      // Map phase to rating metric
      const phaseMetricMap: Record<typeof phase, RatingMetric | null> = {
        rigTuning: RATING_METRICS.find(m => m.key === 'equipment_rating') ?? null,
        prestart: RATING_METRICS.find(m => m.key === 'prestart_rating') ?? null,
        start: RATING_METRICS.find(m => m.key === 'start_rating') ?? null,
        upwind: RATING_METRICS.find(m => m.key === 'upwind_rating') ?? null,
        windwardMark: RATING_METRICS.find(m => m.key === 'windward_mark_rating') ?? null,
        downwind: RATING_METRICS.find(m => m.key === 'downwind_rating') ?? null,
        leewardMark: RATING_METRICS.find(m => m.key === 'leeward_mark_rating') ?? null,
        finish: RATING_METRICS.find(m => m.key === 'finish_rating') ?? null,
      };

      const metric = phaseMetricMap[phase];
      if (!metric) {
        return { pattern: null, aiSuggestion: null };
      }

      // Build performance pattern for this phase
      const samples = buildSamples(analyses, metric.key, metric.notesKey);
      const pattern = samplesToPattern(metric, samples);

      if (!pattern) {
        return { pattern: null, aiSuggestion: null };
      }

      // Generate AI suggestion for this specific phase
      const aiSuggestion = await this.generatePhaseSuggestion(phase, pattern, analyses);

      return { pattern, aiSuggestion };
    } catch (error) {
      logger.error('PostRaceLearningService: Failed to get phase-specific insights', error);
      return { pattern: null, aiSuggestion: null };
    }
  }

  /**
   * Get venue-specific insights from past races at the same venue
   */
  async getVenueSpecificInsights(
    userId: string,
    venueName: string
  ): Promise<{
    raceCount: number;
    insights: string[];
    averagePerformance: number | null;
    keyLearnings: string[];
  }> {
    try {
      const sailorId = await this.getSailorProfileId(userId);
      if (!sailorId || !venueName) {
        return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [] };
      }

      // Get all race analyses for this sailor
      const analyses = await this.fetchRaceAnalyses(sailorId);
      if (!analyses.length) {
        return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [] };
      }

      // Get races (regattas) that match the venue name
      const { data: races, error } = await supabase
        .from('regattas')
        .select('id, name, venue_name, metadata')
        .eq('created_by', userId)
        .or(`venue_name.ilike.%${venueName}%,metadata->>venue_name.ilike.%${venueName}%`);

      if (error || !races || races.length === 0) {
        logger.debug('PostRaceLearningService: No races found for venue:', venueName);
        return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [] };
      }

      const raceIds = races.map((r: any) => r.id);
      
      // Filter analyses to only those from matching venues
      const venueAnalyses = analyses.filter(a => raceIds.includes(a.race_id));
      
      if (venueAnalyses.length === 0) {
        return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [] };
      }

      // Calculate average overall performance at this venue
      const overallRatings = venueAnalyses
        .map(a => a.overall_satisfaction)
        .filter((r): r is number => typeof r === 'number');
      const averagePerformance = overallRatings.length > 0
        ? Number((overallRatings.reduce((s, r) => s + r, 0) / overallRatings.length).toFixed(1))
        : null;

      // Collect key learnings from venue races
      const keyLearnings = venueAnalyses
        .flatMap(a => a.key_learnings ?? [])
        .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
        .slice(0, 5);

      // Generate venue-specific insights
      const insights: string[] = [];
      
      if (venueAnalyses.length >= 2) {
        // Analyze start performance at venue
        const startRatings = venueAnalyses.map(a => a.start_rating).filter((r): r is number => typeof r === 'number');
        if (startRatings.length > 0) {
          const avgStart = average(startRatings);
          if (avgStart >= 4) {
            insights.push(`Your starts at ${venueName} are strong (${avgStart.toFixed(1)} avg)`);
          } else if (avgStart <= 3) {
            insights.push(`Starts at ${venueName} need attention (${avgStart.toFixed(1)} avg)`);
          }
        }

        // Analyze upwind performance at venue  
        const upwindRatings = venueAnalyses.map(a => a.upwind_rating).filter((r): r is number => typeof r === 'number');
        if (upwindRatings.length > 0) {
          const avgUpwind = average(upwindRatings);
          if (avgUpwind >= 4) {
            insights.push(`You sail the upwind legs well at ${venueName}`);
          } else if (avgUpwind <= 3) {
            insights.push(`Focus on upwind technique at ${venueName}`);
          }
        }
      }

      if (venueAnalyses.length === 1) {
        insights.push(`You have 1 previous race at ${venueName} to reference`);
      } else if (venueAnalyses.length > 1) {
        insights.push(`You've raced ${venueAnalyses.length} times at ${venueName}`);
      }

      return {
        raceCount: venueAnalyses.length,
        insights,
        averagePerformance,
        keyLearnings,
      };
    } catch (error) {
      logger.error('PostRaceLearningService: Failed to get venue-specific insights', error);
      return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [] };
    }
  }

  /**
   * Get conditions-specific insights from past races with similar wind conditions
   */
  async getConditionsSpecificInsights(
    userId: string,
    windSpeed: number,
    windDirection?: number
  ): Promise<{
    raceCount: number;
    insights: string[];
    averagePerformance: number | null;
    keyLearnings: string[];
    conditionLabel: string;
  }> {
    try {
      const sailorId = await this.getSailorProfileId(userId);
      if (!sailorId) {
        return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [], conditionLabel: '' };
      }

      // Determine wind condition category
      let conditionLabel: string;
      let windMin: number;
      let windMax: number;
      
      if (windSpeed <= 6) {
        conditionLabel = 'light air';
        windMin = 0;
        windMax = 8;
      } else if (windSpeed <= 12) {
        conditionLabel = 'medium breeze';
        windMin = 5;
        windMax = 15;
      } else if (windSpeed <= 20) {
        conditionLabel = 'fresh breeze';
        windMin = 10;
        windMax = 22;
      } else {
        conditionLabel = 'heavy air';
        windMin = 18;
        windMax = 50;
      }

      // Get all race analyses for this sailor
      const analyses = await this.fetchRaceAnalyses(sailorId);
      if (!analyses.length) {
        return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [], conditionLabel };
      }

      // Get races with similar wind conditions from metadata
      const { data: races, error } = await supabase
        .from('regattas')
        .select('id, name, metadata')
        .eq('created_by', userId);

      if (error || !races || races.length === 0) {
        return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [], conditionLabel };
      }

      // Filter races by wind speed range (from metadata)
      const matchingRaces = races.filter((race: any) => {
        const meta = race.metadata;
        if (!meta) return false;
        
        // Check various wind metadata fields
        const raceWindSpeed = 
          meta.expected_wind_speed_min ?? 
          meta.wind_speed ?? 
          meta.wind?.speed ??
          null;
        
        if (typeof raceWindSpeed !== 'number') return false;
        
        return raceWindSpeed >= windMin && raceWindSpeed <= windMax;
      });

      if (matchingRaces.length === 0) {
        return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [], conditionLabel };
      }

      const raceIds = matchingRaces.map((r: any) => r.id);
      
      // Filter analyses to only those from matching conditions
      const conditionAnalyses = analyses.filter(a => raceIds.includes(a.race_id));
      
      if (conditionAnalyses.length === 0) {
        return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [], conditionLabel };
      }

      // Calculate average overall performance in these conditions
      const overallRatings = conditionAnalyses
        .map(a => a.overall_satisfaction)
        .filter((r): r is number => typeof r === 'number');
      const averagePerformance = overallRatings.length > 0
        ? Number((overallRatings.reduce((s, r) => s + r, 0) / overallRatings.length).toFixed(1))
        : null;

      // Collect key learnings from matching conditions
      const keyLearnings = conditionAnalyses
        .flatMap(a => a.key_learnings ?? [])
        .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
        .slice(0, 5);

      // Generate condition-specific insights
      const insights: string[] = [];
      
      if (conditionAnalyses.length >= 2) {
        // For light air, check boat handling
        if (windSpeed <= 6) {
          const ratings = conditionAnalyses.map(a => a.upwind_rating).filter((r): r is number => typeof r === 'number');
          if (ratings.length > 0 && average(ratings) <= 3) {
            insights.push(`In light air, your upwind VMG tends to suffer - focus on sail trim and smooth tacks`);
          }
        }
        
        // For heavy air, check downwind
        if (windSpeed >= 18) {
          const ratings = conditionAnalyses.map(a => a.downwind_rating).filter((r): r is number => typeof r === 'number');
          if (ratings.length > 0 && average(ratings) <= 3) {
            insights.push(`In heavy air, your downwind legs need attention - consider more conservative angles`);
          }
        }
        
        // General performance insight
        if (averagePerformance !== null) {
          if (averagePerformance >= 4) {
            insights.push(`You perform well in ${conditionLabel} (${averagePerformance} avg) - trust your instincts`);
          } else if (averagePerformance <= 3) {
            insights.push(`${conditionLabel} conditions have been challenging (${averagePerformance} avg) - review past notes`);
          }
        }
      }

      if (conditionAnalyses.length === 1) {
        insights.push(`You have 1 race in similar ${conditionLabel} conditions to reference`);
      } else if (conditionAnalyses.length > 1) {
        insights.push(`You've raced ${conditionAnalyses.length} times in ${conditionLabel} conditions`);
      }

      return {
        raceCount: conditionAnalyses.length,
        insights,
        averagePerformance,
        keyLearnings,
        conditionLabel,
      };
    } catch (error) {
      logger.error('PostRaceLearningService: Failed to get conditions-specific insights', error);
      return { raceCount: 0, insights: [], averagePerformance: null, keyLearnings: [], conditionLabel: '' };
    }
  }

  private async getSailorProfileId(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('sailor_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        logger.error('PostRaceLearningService: Error fetching sailor profile', error);
        return null;
      }

      return data?.id ?? null;
    } catch (error) {
      logger.error('PostRaceLearningService: Exception fetching sailor profile', error);
      return null;
    }
  }

  private async fetchRaceAnalyses(sailorId: string): Promise<RaceAnalysisRecord[]> {
    try {
      const { data, error } = await supabase
        .from('race_analysis')
        .select('*')
        .eq('sailor_id', sailorId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('PostRaceLearningService: Error fetching race analyses', error);
        return [];
      }

      return (data ?? []) as RaceAnalysisRecord[];
    } catch (error) {
      logger.error('PostRaceLearningService: Exception fetching race analyses', error);
      return [];
    }
  }

  /**
   * Calculate planning insights from sailor_race_preparation records
   */
  private async calculatePlanningInsights(sailorId: string, analyses: RaceAnalysisRecord[]) {
    try {
      // Get all race preparation records for this sailor
      const { data: preparations, error } = await supabase
        .from('sailor_race_preparation')
        .select('*')
        .eq('sailor_id', sailorId)
        .order('created_at', { ascending: true });

      if (error || !preparations || preparations.length === 0) {
        return {
          planningCompletionRate: 0,
          planDetailLevel: 'none' as const,
          mostPlannedPhases: [] as string[],
          leastPlannedPhases: [] as string[],
        };
      }

      const planningPhases = [
        'rig_tuning_strategy',
        'prestart_strategy',
        'start_strategy',
        'upwind_strategy',
        'windward_mark_strategy',
        'downwind_strategy',
        'leeward_mark_strategy',
        'finish_strategy',
      ];

      // Calculate completion rate (races with any strategy vs total races)
      const racesWithPlanning = preparations.filter((prep: any) =>
        planningPhases.some(phase => prep[phase] && (prep[phase] as string).trim().length > 0)
      ).length;
      const planningCompletionRate = Math.round((racesWithPlanning / analyses.length) * 100);

      // Calculate average plan length to determine detail level
      const totalLength = preparations.reduce((sum: number, prep: any) => {
        return sum + planningPhases.reduce((phaseSum, phase) => {
          const text = prep[phase] as string | null;
          return phaseSum + (text?.trim().length || 0);
        }, 0);
      }, 0);
      const avgLength = preparations.length > 0 ? totalLength / preparations.length : 0;
      const planDetailLevel = avgLength < 100 ? 'short' : avgLength < 300 ? 'medium' : 'detailed';

      // Count which phases are most/least planned
      const phaseCounts = planningPhases.reduce((counts, phase) => {
        counts[phase] = preparations.filter((prep: any) => {
          const text = prep[phase] as string | null;
          return text && text.trim().length > 0;
        }).length;
        return counts;
      }, {} as Record<string, number>);

      const sortedPhases = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1]);
      const mostPlannedPhases = sortedPhases.slice(0, 3).map(([phase]) =>
        phase.replace(/_strategy$/, '').replace(/_/g, ' ')
      );
      const leastPlannedPhases = sortedPhases.slice(-3).map(([phase]) =>
        phase.replace(/_strategy$/, '').replace(/_/g, ' ')
      );

      return {
        planningCompletionRate,
        planDetailLevel,
        mostPlannedPhases,
        leastPlannedPhases,
      };
    } catch (error) {
      logger.error('PostRaceLearningService: Failed to calculate planning insights', error);
      return {
        planningCompletionRate: 0,
        planDetailLevel: 'none' as const,
        mostPlannedPhases: [] as string[],
        leastPlannedPhases: [] as string[],
      };
    }
  }

  /**
   * Calculate execution insights from race_analysis execution fields
   */
  private calculateExecutionInsights(analyses: RaceAnalysisRecord[]) {
    const executionPhases = [
      'rig_tuning_execution_rating',
      'prestart_execution_rating',
      'start_execution_rating',
      'upwind_execution_rating',
      'windward_mark_execution_rating',
      'downwind_execution_rating',
      'leeward_mark_execution_rating',
      'finish_execution_rating',
    ];

    // Filter analyses that have execution ratings
    const analysesWithExecution = analyses.filter((analysis: any) =>
      executionPhases.some(phase => typeof analysis[phase] === 'number')
    );

    if (analysesWithExecution.length === 0) {
      return {
        avgExecutionRating: 0,
        executionCompletionRate: 0,
        planVsExecutionGap: 0,
        bestExecutedPhases: [] as string[],
        poorlyExecutedPhases: [] as string[],
        adaptabilityScore: 0,
      };
    }

    // Calculate average execution rating
    let totalRatings = 0;
    let ratingCount = 0;
    analysesWithExecution.forEach((analysis: any) => {
      executionPhases.forEach(phase => {
        const rating = analysis[phase];
        if (typeof rating === 'number') {
          totalRatings += rating;
          ratingCount++;
        }
      });
    });
    const avgExecutionRating = ratingCount > 0 ? Number((totalRatings / ratingCount).toFixed(2)) : 0;

    // Calculate execution completion rate
    const executionCompletionRate = Math.round((analysesWithExecution.length / analyses.length) * 100);

    // Calculate phase-specific execution averages
    const phaseAverages = executionPhases.map(phase => {
      const ratings = analysesWithExecution
        .map((a: any) => a[phase])
        .filter((r): r is number => typeof r === 'number');
      const avg = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
      return {
        phase: phase.replace(/_execution_rating$/, '').replace(/_/g, ' '),
        avg,
      };
    }).filter(p => p.avg > 0);

    const sortedPhases = phaseAverages.sort((a, b) => b.avg - a.avg);
    const bestExecutedPhases = sortedPhases.filter(p => p.avg >= 4).slice(0, 3).map(p => p.phase);
    const poorlyExecutedPhases = sortedPhases.filter(p => p.avg <= 3).slice(-3).map(p => p.phase);

    // Estimate plan vs execution gap (if we had both planning and execution data)
    // For now, use a placeholder based on execution quality
    const planVsExecutionGap = avgExecutionRating > 0 ? Number((5 - avgExecutionRating).toFixed(2)) : 0;

    // Adaptability score (placeholder - would need conditions_changed tracking)
    // For now, base it on consistency of execution ratings
    const executionVariance = phaseAverages.length > 0
      ? Math.sqrt(phaseAverages.reduce((sum, p) => sum + Math.pow(p.avg - avgExecutionRating, 2), 0) / phaseAverages.length)
      : 0;
    const adaptabilityScore = Math.max(0, Math.min(100, Math.round(100 - (executionVariance * 20))));

    return {
      avgExecutionRating,
      executionCompletionRate,
      planVsExecutionGap,
      bestExecutedPhases,
      poorlyExecutedPhases,
      adaptabilityScore,
    };
  }

  private async invokeLearningChat(prompt: string, maxTokens: number): Promise<string> {
    const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
      body: {
        prompt,
        max_tokens: maxTokens,
      },
    });

    if (error) {
      throw new Error(error.message || 'Learning AI invocation failed');
    }

    const text = typeof data?.text === 'string' ? data.text : '';
    if (!text) {
      throw new Error('Learning AI returned empty response');
    }

    return text;
  }

  /**
   * Generate AI suggestion for a specific race phase based on past performance
   */
  private async generatePhaseSuggestion(
    phase: string,
    pattern: PerformancePattern,
    analyses: RaceAnalysisRecord[]
  ): Promise<string | null> {
    // Return fallback suggestion based on pattern data if AI call fails
    const buildFallbackSuggestion = () => {
      const isStrength = pattern.average >= 4.0;
      const isFocusArea = pattern.average <= 3.0;

      if (isStrength) {
        return `You excel at ${pattern.label.toLowerCase()} (${pattern.average.toFixed(1)} avg across ${pattern.sampleCount} races). Leverage this strength - continue your consistent approach while looking for micro-optimizations.`;
      }

      if (isFocusArea) {
        const trendText = pattern.trend === 'declining' ? ' and declining' : pattern.trend === 'improving' ? ' but improving' : '';
        return `${pattern.label} needs focus (${pattern.average.toFixed(1)} avg${trendText}). Prioritize specific technique improvements in this phase - break it down into smaller skills you can practice.`;
      }

      return `Your ${pattern.label.toLowerCase()} performance: ${pattern.average.toFixed(1)} avg across ${pattern.sampleCount} races. ${pattern.trend === 'improving' ? 'Trending up - keep the momentum!' : pattern.trend === 'declining' ? 'Trending down - refocus on fundamentals.' : 'Stable performance.'}`;
    };

    try {
      const phaseLabels: Record<string, string> = {
        rigTuning: 'Rig Tuning',
        prestart: 'Pre-Start',
        start: 'Start',
        upwind: 'Upwind',
        windwardMark: 'Windward Mark',
        downwind: 'Downwind',
        leewardMark: 'Leeward Mark',
        finish: 'Finish',
      };

      // Collect recent notes for this phase
      const recentNotes = pattern.supportingSamples
        .filter(s => s.notes && s.notes.trim().length > 0)
        .slice(-3)
        .map(s => s.notes);

      const prompt = `You are a sailing coach providing brief, specific strategic advice for a sailor planning their next race. Be encouraging but direct. Focus on actionable tactics.

Based on past performance, provide ONE concise strategic suggestion (2-3 sentences max) for the ${phaseLabels[phase]} phase.

Performance data:
- Average rating: ${pattern.average.toFixed(1)}/5.0
- Trend: ${pattern.trend}
- Races analyzed: ${pattern.sampleCount}
- Recent notes: ${recentNotes.length > 0 ? recentNotes.join(' | ') : 'None'}

${pattern.average >= 4.0 ? 'This is a STRENGTH - help them leverage it.' : pattern.average <= 3.0 ? 'This is a FOCUS AREA - provide specific technique advice.' : 'Provide balanced guidance for improvement.'}

Return ONLY the suggestion text, no preamble.`;

      const text = await this.invokeLearningChat(prompt, 300);
      return text.trim() || null;
    } catch (error) {
      logger.error('PostRaceLearningService: Failed to generate phase suggestion', error);
      return buildFallbackSuggestion();
    }
  }

  private async generateAISummary(
    profile: LearningProfile,
    analyses: RaceAnalysisRecord[]
  ): Promise<AILearningSummary | undefined> {
    try {
      // Calculate planning and execution insights
      const planningInsights = await this.calculatePlanningInsights(profile.sailorId, analyses);
      const executionInsights = this.calculateExecutionInsights(analyses);

      const payload = {
        meta: {
          racesAnalyzed: profile.racesAnalyzed,
          lastRaceCompletedAt: profile.lastRaceCompletedAt,
          lastUpdated: profile.lastUpdated,
        },
        strengthPatterns: formatPatternsForAi(profile.strengths),
        focusPatterns: formatPatternsForAi(profile.focusAreas),
        frameworkTrends: profile.frameworkTrends,
        recurringWins: formatInsightsForAi(profile.recurringWins),
        recurringChallenges: formatInsightsForAi(profile.recurringChallenges),
        recentRaces: collectRecentRaces(analyses),
        planningInsights,
        executionInsights,
      };

      const prompt = `You are BetterAt's race learning analyst. Blend BetterAt Playbook theory with on-boat execution detail. You MUST respond with ONLY valid JSON - no explanatory text before or after the JSON object.

Analyze the race data and return a JSON object with this exact structure:
{
  "headline": "string - concise one-line summary",
  "keepDoing": ["string array - things going well"],
  "focusNext": ["string array - areas to improve"],
  "practiceIdeas": ["string array - specific drills/exercises"],
  "planningFeedback": "string - advice on pre-race planning",
  "preRaceReminder": "string - reminder for next race"
}

Race data:
${JSON.stringify(payload, null, 2)}

Return ONLY the JSON object, no other text.`;

      const combinedText = await this.invokeLearningChat(prompt, 1200);
      if (!combinedText) {
        logger.warn('PostRaceLearningService: Learning AI response returned no text');
        return undefined;
      }

      const jsonMatch = combinedText.match(/\{[\s\S]*\}$/);
      const rawJson = jsonMatch ? jsonMatch[0] : combinedText;

      try {
        const parsed = JSON.parse(rawJson);
        return {
          headline: parsed.headline ?? '',
          keepDoing: Array.isArray(parsed.keepDoing) ? parsed.keepDoing : [],
          focusNext: Array.isArray(parsed.focusNext) ? parsed.focusNext : [],
          practiceIdeas: Array.isArray(parsed.practiceIdeas) ? parsed.practiceIdeas : undefined,
          planningFeedback:
            typeof parsed.planningFeedback === 'string' ? parsed.planningFeedback : undefined,
          preRaceReminder:
            typeof parsed.preRaceReminder === 'string' ? parsed.preRaceReminder : undefined,
          rawResponse: rawJson,
        };
      } catch (parseError) {
        logger.error('PostRaceLearningService: Failed to parse Claude JSON response', parseError);
        return {
          headline: 'Learning summary available',
          keepDoing: [],
          focusNext: [],
          planningFeedback: undefined,
          preRaceReminder: undefined,
          rawResponse: combinedText,
        };
      }
    } catch (error) {
      logger.error('PostRaceLearningService: Claude summary generation failed', error);
      return undefined;
    }
  }
}

export const postRaceLearningService = new PostRaceLearningService();
