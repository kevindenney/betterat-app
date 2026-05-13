/**
 * Race Learning Profile Types
 * Structures for aggregating post-race patterns and AI-driven summaries.
 */

import type { FrameworkTrend } from './raceAnalysis';

export type PerformanceTrend = 'improving' | 'stable' | 'declining';

export interface PerformanceSample {
  raceId: string;
  createdAt: string;
  value: number;
  notes?: string | null;
}

export type PatternCategory =
  | 'preparation'
  | 'start'
  | 'upwind'
  | 'downwind'
  | 'mark_rounding'
  | 'boat_handling'
  | 'crew'
  | 'overall';

export interface PerformancePattern {
  id: string;
  label: string;
  category: PatternCategory;
  average: number;
  latest?: number | null;
  trend: PerformanceTrend;
  sampleCount: number;
  confidence: 'high' | 'medium' | 'low';
  supportingSamples: PerformanceSample[];
  message?: string;
}

export interface RecurringInsight {
  id: string;
  type: 'win' | 'challenge';
  summary: string;
  supportingRaces: { raceId: string; createdAt?: string }[];
}

export interface AILearningSummary {
  headline: string;
  keepDoing: string[];
  focusNext: string[];
  practiceIdeas?: string[];
  planningFeedback?: string;
  preRaceReminder?: string;
  rawResponse?: string;
}

export interface LearningProfile {
  sailorId: string;
  racesAnalyzed: number;
  lastRaceCompletedAt?: string;
  strengths: PerformancePattern[];
  focusAreas: PerformancePattern[];
  frameworkTrends: FrameworkTrend[];
  recurringWins: RecurringInsight[];
  recurringChallenges: RecurringInsight[];
  aiSummary?: AILearningSummary;
  lastUpdated: string;
}
