/**
 * useReflectProfile - Hook for fetching profile data for the Reflect tab
 *
 * Provides user profile, career stats, venues visited, boats, achievements,
 * personal records, and challenges for Phases 2 & 3.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { useReflectDataMock } from './useReflectData';

const logger = createLogger('useReflectProfile');

// =============================================================================
// TYPES
// =============================================================================

// Achievement types (matching SailorProfileService)
export type AchievementType =
  | 'first_race'
  | 'first_win'
  | 'first_podium'
  | 'race_milestone_10'
  | 'race_milestone_50'
  | 'race_milestone_100'
  | 'win_streak_3'
  | 'win_streak_5'
  | 'series_champion'
  | 'regatta_champion'
  | 'year_end_champion'
  | 'perfect_season'
  | 'comeback_victory'
  | 'most_improved';

export interface Achievement {
  id: string;
  type: AchievementType;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
  relatedRegattaId?: string;
  relatedRegattaName?: string;
}

export interface PersonalRecord {
  id: string;
  label: string;
  value: string | number;
  detail?: string;
  date?: string;
  regattaName?: string;
  icon: string;
  color: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'race_count' | 'podium_count' | 'win_count' | 'streak' | 'venue_count' | 'custom';
  targetValue: number;
  currentValue: number;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
  completedAt?: string;
  reward?: string;
  icon: string;
}

export interface ProfileStats {
  // Career totals
  totalRaces: number;
  totalWins: number;
  totalPodiums: number;
  averageFinish: number | null;
  winRate: number | null;
  // Season (current year)
  seasonRaces: number;
  seasonWins: number;
  seasonPodiums: number;
  seasonAverageFinish: number | null;
  // Streaks
  currentStreak: number;
  longestStreak: number;
  // Time stats
  totalTimeOnWater: number; // Minutes
  memberSince: string | null;
}

export interface VenueVisited {
  id: string;
  name: string;
  location: string | null;
  raceCount: number;
  lastRaceDate: string;
  bestFinish: number | null;
  averageFinish: number | null;
}

export interface UserBoat {
  id: string;
  name: string | null;
  className: string;
  sailNumber: string | null;
  isPrimary: boolean;
  raceCount: number;
  winCount: number;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
  avatarInitials: string;
  bio: string | null;
  location: string | null;
  homeClub: string | null;
  sailingSince: number | null;
  followerCount: number;
  followingCount: number;
}

// Phase 4: Recent Activity types
export type RecentActivityType =
  | 'race_completed'
  | 'achievement_earned'
  | 'new_follower'
  | 'followed_user'
  | 'comment_received'
  | 'liked_post'
  | 'shared_result';

export interface RecentActivity {
  id: string;
  type: RecentActivityType;
  title: string;
  description?: string;
  timestamp: string;
  relatedUserId?: string;
  relatedUserName?: string;
  relatedUserAvatar?: string;
  relatedRegattaId?: string;
  relatedRegattaName?: string;
  metadata?: Record<string, unknown>;
}

// Phase 5: Goals & Training
export type GoalType = 'races' | 'wins' | 'podiums' | 'time_on_water' | 'venues' | 'improvement' | 'custom';
export type GoalPeriod = 'weekly' | 'monthly' | 'season' | 'yearly';

export interface SeasonGoal {
  id: string;
  type: GoalType;
  title: string;
  description?: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
  completedAt?: string;
  icon: string;
  color: string;
}

// Phase 5: Insights & Analytics
export type InsightType = 'trend' | 'milestone' | 'recommendation' | 'comparison' | 'streak' | 'improvement';
export type InsightSentiment = 'positive' | 'neutral' | 'needs_attention';

export interface PerformanceInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  sentiment: InsightSentiment;
  metric?: string;
  metricValue?: string | number;
  metricChange?: number; // percentage change
  actionLabel?: string;
  actionRoute?: string;
  icon: string;
  color: string;
  generatedAt: string;
}

// Phase 5: Comparisons
export interface FleetComparison {
  fleetName: string;
  fleetSize: number;
  yourRank: number;
  yourPercentile: number;
  avgFinish: number;
  fleetAvgFinish: number;
  topSailorName?: string;
  topSailorWins?: number;
}

export interface SailorComparison {
  sailorId: string;
  sailorName: string;
  sailorAvatar?: string;
  yourWins: number;
  theirWins: number;
  headToHeadRaces: number;
  lastRaceResult?: 'won' | 'lost' | 'tied';
}

// Phase 5: Weekly Summary
export interface WeeklySummary {
  weekStartDate: string;
  weekEndDate: string;
  racesCompleted: number;
  wins: number;
  podiums: number;
  avgFinish: number | null;
  timeOnWater: number; // minutes
  highlightRace?: {
    name: string;
    position: number;
    fleetSize: number;
  };
  streakDays: number;
  comparedToLastWeek: {
    races: number;
    avgFinish: number | null;
  };
  isShareable: boolean;
}

// Phase 5: Gear Management
export type MaintenanceType = 'inspection' | 'repair' | 'replacement' | 'upgrade' | 'cleaning' | 'tuning';
export type MaintenanceStatus = 'scheduled' | 'completed' | 'overdue';

export interface MaintenanceLog {
  id: string;
  boatId: string;
  type: MaintenanceType;
  title: string;
  description?: string;
  date: string;
  status: MaintenanceStatus;
  cost?: number;
  vendor?: string;
  nextDueDate?: string;
  photos?: string[];
}

export interface BoatWithMaintenance extends UserBoat {
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  maintenanceLogs: MaintenanceLog[];
  totalMaintenanceCost?: number;
  healthScore?: number; // 0-100
}

// =============================================================================
// PHASE 6 TYPES
// =============================================================================

// Training Plans
export type TrainingActivityType = 'video' | 'article' | 'drill' | 'workout' | 'race_review' | 'mental';
export type TrainingPlanStatus = 'not_started' | 'in_progress' | 'completed';

export interface TrainingActivity {
  id: string;
  type: TrainingActivityType;
  title: string;
  description?: string;
  duration?: number; // minutes
  isCompleted: boolean;
  completedAt?: string;
  resourceUrl?: string;
  icon: string;
}

export interface TrainingPlan {
  id: string;
  title: string;
  description?: string;
  targetRace?: string;
  targetDate?: string;
  status: TrainingPlanStatus;
  activities: TrainingActivity[];
  totalActivities: number;
  completedActivities: number;
  estimatedDuration: number; // total minutes
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// Venue Heatmap
export interface VenueWithCoordinates extends VenueVisited {
  latitude: number;
  longitude: number;
  intensity: number; // 0-1, based on race count relative to max
}

// Season Recap / Year in Review
export interface SeasonHighlight {
  type: 'best_race' | 'longest_streak' | 'most_races_month' | 'biggest_improvement' | 'new_venue' | 'milestone';
  title: string;
  value: string | number;
  date?: string;
  detail?: string;
  icon: string;
}

export interface SeasonRecap {
  year: number;
  totalRaces: number;
  totalWins: number;
  totalPodiums: number;
  averageFinish: number | null;
  timeOnWater: number; // minutes
  venuesVisited: number;
  newVenues: string[];
  bestMonth: string;
  bestMonthRaces: number;
  highlights: SeasonHighlight[];
  topRaces: {
    name: string;
    position: number;
    fleetSize: number;
    date: string;
    venue: string;
  }[];
  comparedToPreviousYear: {
    races: number;
    wins: number;
    avgFinish: number | null;
  } | null;
  isShareable: boolean;
}

// Course Records / Personal Bests
export interface CourseRecord {
  id: string;
  courseName: string;
  venueName: string;
  venueId?: string;
  bestPosition: number;
  fleetSize: number;
  date: string;
  conditions?: {
    windSpeed?: number;
    windDirection?: string;
    waveHeight?: number;
  };
  previousBest?: number;
  timesRaced: number;
  avgPosition: number;
}

// Photo Gallery
export type PhotoSource = 'upload' | 'race_result' | 'shared' | 'club';

export interface RacePhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  takenAt: string;
  uploadedAt: string;
  source: PhotoSource;
  regattaId?: string;
  regattaName?: string;
  venueName?: string;
  tags?: string[];
  width?: number;
  height?: number;
}

// Race Journal
export type JournalMood = 'great' | 'good' | 'neutral' | 'challenging' | 'difficult';

export interface RaceJournalEntry {
  id: string;
  regattaId: string;
  regattaName: string;
  raceDate: string;
  position?: number;
  fleetSize?: number;
  mood: JournalMood;
  preRaceNotes?: string;
  postRaceNotes?: string;
  whatWorked?: string[];
  whatToImprove?: string[];
  conditions?: {
    windSpeed?: number;
    windDirection?: string;
    waveHeight?: number;
    current?: string;
  };
  tuningSettings?: Record<string, string | number>;
  keyMoments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReflectProfileData {
  profile: UserProfile;
  stats: ProfileStats;
  venuesVisited: VenueVisited[];
  boats: UserBoat[];
  // Phase 3: Achievements
  achievements: Achievement[];
  personalRecords: PersonalRecord[];
  challenges: Challenge[];
  // Phase 4: Recent Activity
  recentActivity: RecentActivity[];
  // Phase 5: Goals, Insights, Comparisons, Summary, Gear
  goals: SeasonGoal[];
  insights: PerformanceInsight[];
  fleetComparison?: FleetComparison;
  sailorComparisons: SailorComparison[];
  weeklySummary?: WeeklySummary;
  boatsWithMaintenance: BoatWithMaintenance[];
  // Phase 6: Training, Heatmap, Recap, Records, Photos, Journal
  trainingPlans: TrainingPlan[];
  venuesWithCoordinates: VenueWithCoordinates[];
  seasonRecap?: SeasonRecap;
  courseRecords: CourseRecord[];
  racePhotos: RacePhoto[];
  raceJournal: RaceJournalEntry[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

function getDefaultAchievementTitle(type: AchievementType): string {
  const titles: Record<AchievementType, string> = {
    first_race: 'First Race',
    first_win: 'First Victory',
    first_podium: 'First Podium',
    race_milestone_10: '10 Races',
    race_milestone_50: '50 Races',
    race_milestone_100: '100 Races',
    win_streak_3: 'Hot Streak',
    win_streak_5: 'On Fire',
    series_champion: 'Series Champion',
    regatta_champion: 'Regatta Champion',
    year_end_champion: 'Year-End Champion',
    perfect_season: 'Perfect Season',
    comeback_victory: 'Comeback Victory',
    most_improved: 'Most Improved',
  };
  return titles[type] || type;
}

function getDefaultAchievementDescription(type: AchievementType): string {
  const descriptions: Record<AchievementType, string> = {
    first_race: 'Completed your first race',
    first_win: 'Won your first race',
    first_podium: 'Finished on the podium',
    race_milestone_10: 'Completed 10 races',
    race_milestone_50: 'Completed 50 races',
    race_milestone_100: 'Completed 100 races',
    win_streak_3: '3 consecutive wins',
    win_streak_5: '5 consecutive wins',
    series_champion: 'Won a race series',
    regatta_champion: 'Won a regatta championship',
    year_end_champion: 'Season champion',
    perfect_season: 'Won every race in a series',
    comeback_victory: 'Won from behind',
    most_improved: 'Most improved sailor',
  };
  return descriptions[type] || '';
}

function getDefaultAchievementIcon(type: AchievementType): string {
  const icons: Record<AchievementType, string> = {
    first_race: 'flag',
    first_win: 'trophy',
    first_podium: 'medal',
    race_milestone_10: 'star',
    race_milestone_50: 'star',
    race_milestone_100: 'star',
    win_streak_3: 'flame',
    win_streak_5: 'flame',
    series_champion: 'ribbon',
    regatta_champion: 'ribbon',
    year_end_champion: 'trophy',
    perfect_season: 'sparkles',
    comeback_victory: 'trending-up',
    most_improved: 'trending-up',
  };
  return icons[type] || 'star';
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useReflectProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<ReflectProfileData | null>(null);

  const userId = user?.id;

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);

      // Fetch profile data (use maybeSingle to handle missing profiles gracefully)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .eq('id', userId)
        .maybeSingle();

      // Only throw for actual errors, not missing profile (PGRST116)
      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      // Fetch sailor profile extensions
      const { data: sailorProfile } = await supabase
        .from('sailor_profiles')
        .select('avatar_emoji, avatar_color, bio, location, home_club_id')
        .eq('user_id', userId)
        .single();

      // Fetch home club name if exists
      let homeClubName: string | null = null;
      if (sailorProfile?.home_club_id) {
        const { data: club } = await supabase
          .from('clubs')
          .select('name')
          .eq('id', sailorProfile.home_club_id)
          .single();
        homeClubName = club?.name || null;
      }

      // Fetch follow counts
      const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
        supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId),
        supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId),
      ]);

      // Fetch all user regattas for stats calculation
      const { data: regattas, error: regattasError } = await supabase
        .from('regattas')
        .select('*')
        .eq('created_by', userId)
        .order('start_date', { ascending: false });

      if (regattasError) throw regattasError;

      // Fetch race results
      const { data: participants } = await supabase
        .from('race_participants')
        .select('regatta_id, finish_position, status')
        .eq('user_id', userId)
        .neq('status', 'withdrawn');

      // Fetch timer sessions for time on water
      const { data: sessions } = await supabase
        .from('race_timer_sessions')
        .select('start_time, end_time')
        .eq('sailor_id', userId);

      // Calculate stats
      const finishedRaces = (regattas || []).filter(
        (r: any) => new Date(r.start_date) <= now
      );
      const seasonRaces = finishedRaces.filter(
        (r: any) => new Date(r.start_date) >= yearStart
      );

      const participantsMap = new Map(
        (participants || []).map((p: any) => [p.regatta_id, p])
      );

      let totalWins = 0;
      let totalPodiums = 0;
      let seasonWins = 0;
      let seasonPodiums = 0;
      const allPositions: number[] = [];
      const seasonPositions: number[] = [];

      finishedRaces.forEach((race: any) => {
        const p = participantsMap.get(race.id);
        if (p?.finish_position) {
          allPositions.push(p.finish_position);
          if (p.finish_position === 1) totalWins++;
          if (p.finish_position <= 3) totalPodiums++;

          if (new Date(race.start_date) >= yearStart) {
            seasonPositions.push(p.finish_position);
            if (p.finish_position === 1) seasonWins++;
            if (p.finish_position <= 3) seasonPodiums++;
          }
        }
      });

      const averageFinish =
        allPositions.length > 0
          ? Math.round((allPositions.reduce((a, b) => a + b, 0) / allPositions.length) * 10) / 10
          : null;

      const seasonAverageFinish =
        seasonPositions.length > 0
          ? Math.round((seasonPositions.reduce((a, b) => a + b, 0) / seasonPositions.length) * 10) / 10
          : null;

      const winRate =
        finishedRaces.length > 0
          ? Math.round((totalWins / finishedRaces.length) * 100) / 100
          : null;

      // Calculate time on water
      let totalTimeOnWater = 0;
      (sessions || []).forEach((s: any) => {
        if (s.start_time && s.end_time) {
          const duration =
            (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000;
          totalTimeOnWater += duration;
        }
      });

      // Build venues visited from race data
      const venueMap = new Map<string, {
        name: string;
        location: string | null;
        races: { date: string; position: number | null }[];
      }>();

      (regattas || []).forEach((race: any) => {
        const venueName = race.metadata?.venue_name || race.venue_name;
        if (!venueName) return;

        const venueKey = venueName.toLowerCase();
        const p = participantsMap.get(race.id);

        if (!venueMap.has(venueKey)) {
          venueMap.set(venueKey, {
            name: venueName,
            location: race.metadata?.location || null,
            races: [],
          });
        }

        venueMap.get(venueKey)!.races.push({
          date: race.start_date,
          position: p?.finish_position || null,
        });
      });

      const venuesVisited: VenueVisited[] = Array.from(venueMap.entries())
        .map(([id, venue]) => {
          const positions = venue.races
            .filter((r) => r.position !== null)
            .map((r) => r.position!);
          const avgFinish =
            positions.length > 0
              ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
              : null;
          const bestFinish = positions.length > 0 ? Math.min(...positions) : null;

          return {
            id,
            name: venue.name,
            location: venue.location,
            raceCount: venue.races.length,
            lastRaceDate: venue.races[0]?.date || '',
            bestFinish,
            averageFinish: avgFinish,
          };
        })
        .sort((a, b) => b.raceCount - a.raceCount);

      // Fetch boats
      const { data: boatsData } = await supabase
        .from('sailor_boats')
        .select(`
          id,
          name,
          sail_number,
          class_id,
          boat_classes:boat_classes(name)
        `)
        .eq('sailor_id', userId);

      // Count races per boat class (from race metadata)
      const boatClassRaces = new Map<string, { count: number; wins: number }>();
      (regattas || []).forEach((race: any) => {
        const boatClass = race.metadata?.boat_class;
        if (!boatClass) return;
        const p = participantsMap.get(race.id);
        if (!boatClassRaces.has(boatClass)) {
          boatClassRaces.set(boatClass, { count: 0, wins: 0 });
        }
        const stats = boatClassRaces.get(boatClass)!;
        stats.count++;
        if (p?.finish_position === 1) stats.wins++;
      });

      const boats: UserBoat[] = (boatsData || []).map((b: any) => {
        const className = b.boat_classes?.name || 'Unknown';
        const classStats = boatClassRaces.get(className) || { count: 0, wins: 0 };
        return {
          id: b.id,
          name: b.name,
          className,
          sailNumber: b.sail_number,
          isPrimary: false,
          raceCount: classStats.count,
          winCount: classStats.wins,
        };
      });

      const displayName = profileData?.full_name || 'Sailor';

      // Fetch achievements from database
      const { data: achievementsData } = await supabase
        .from('sailor_achievements')
        .select(`
          id,
          achievement_type,
          title,
          description,
          icon,
          earned_at,
          related_regatta_id,
          regattas(name)
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      const achievements: Achievement[] = (achievementsData || []).map((a: any) => ({
        id: a.id,
        type: a.achievement_type,
        title: a.title || getDefaultAchievementTitle(a.achievement_type),
        description: a.description || getDefaultAchievementDescription(a.achievement_type),
        icon: a.icon || getDefaultAchievementIcon(a.achievement_type),
        earnedAt: a.earned_at,
        relatedRegattaId: a.related_regatta_id,
        relatedRegattaName: a.regattas?.name,
      }));

      // Calculate personal records from race data
      const personalRecords: PersonalRecord[] = [];

      // Best finish
      if (allPositions.length > 0) {
        const bestPosition = Math.min(...allPositions);
        const bestRace = finishedRaces.find((r: any) => {
          const p = participantsMap.get(r.id);
          return p?.finish_position === bestPosition;
        });
        personalRecords.push({
          id: 'pr-best-finish',
          label: 'Best Finish',
          value: getOrdinal(bestPosition),
          detail: bestRace?.metadata?.fleet_size ? `in ${bestRace.metadata.fleet_size} boat fleet` : undefined,
          date: bestRace?.start_date,
          regattaName: bestRace?.name,
          icon: 'trophy',
          color: 'systemYellow',
        });
      }

      // Most wins in a season (current year)
      if (seasonWins > 0) {
        personalRecords.push({
          id: 'pr-season-wins',
          label: 'Season Wins',
          value: seasonWins,
          detail: `${new Date().getFullYear()} season`,
          icon: 'ribbon',
          color: 'systemOrange',
        });
      }

      // Total podiums
      if (totalPodiums > 0) {
        personalRecords.push({
          id: 'pr-total-podiums',
          label: 'Career Podiums',
          value: totalPodiums,
          detail: `${Math.round((totalPodiums / finishedRaces.length) * 100)}% podium rate`,
          icon: 'medal',
          color: 'systemBlue',
        });
      }

      // Venues raced
      if (venuesVisited.length > 0) {
        personalRecords.push({
          id: 'pr-venues',
          label: 'Venues Raced',
          value: venuesVisited.length,
          detail: 'different clubs',
          icon: 'location',
          color: 'systemGreen',
        });
      }

      // =========================================================================
      // FETCH CHALLENGES FROM DATABASE
      // =========================================================================
      const { data: challengesData } = await supabase
        .from('sailor_challenges')
        .select('*')
        .eq('user_id', userId)
        .order('end_date', { ascending: true });

      const challenges: Challenge[] = (challengesData || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        type: c.type,
        targetValue: c.target_value,
        currentValue: c.current_value,
        startDate: c.start_date,
        endDate: c.end_date,
        isCompleted: c.is_completed,
        completedAt: c.completed_at,
        reward: c.reward,
        icon: c.icon || 'flag',
      }));

      // =========================================================================
      // FETCH GOALS FROM DATABASE
      // =========================================================================
      const { data: goalsData } = await supabase
        .from('sailor_goals')
        .select('*')
        .eq('user_id', userId)
        .order('end_date', { ascending: true });

      const goals: SeasonGoal[] = (goalsData || []).map((g: any) => ({
        id: g.id,
        type: g.type,
        title: g.title,
        description: g.description,
        targetValue: g.target_value,
        currentValue: g.current_value,
        unit: g.unit,
        period: g.period,
        startDate: g.start_date,
        endDate: g.end_date,
        isCompleted: g.is_completed,
        completedAt: g.completed_at,
        icon: g.icon || 'flag',
        color: g.color || 'systemBlue',
      }));

      // =========================================================================
      // BUILD RECENT ACTIVITY FROM MULTIPLE SOURCES
      // =========================================================================
      const recentActivity: RecentActivity[] = [];

      // Fetch recent races completed (from user's own regattas)
      const recentRaces = finishedRaces.slice(0, 5);
      recentRaces.forEach((race: any) => {
        const p = participantsMap.get(race.id);
        if (p?.finish_position) {
          recentActivity.push({
            id: `race-${race.id}`,
            type: 'race_completed',
            title: `Finished ${getOrdinal(p.finish_position)} in ${race.name}`,
            description: race.venue_name || race.metadata?.venue_name,
            timestamp: race.start_date,
            relatedRegattaId: race.id,
            relatedRegattaName: race.name,
          });
        }
      });

      // Fetch recent followers (user_follows FKs point to auth.users, not profiles/sailor_profiles,
      // so we fetch follows first then look up profile data separately)
      const { data: recentFollows } = await supabase
        .from('user_follows')
        .select('id, created_at, follower_id')
        .eq('following_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      const followerIds = (recentFollows || []).map((f: any) => f.follower_id).filter(Boolean);
      let followerProfiles: Record<string, { full_name?: string; avatar_url?: string }> = {};
      if (followerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .in('id', followerIds);
        (profilesData || []).forEach((p: any) => {
          followerProfiles[p.id] = {
            ...followerProfiles[p.id],
            full_name: p.full_name,
            avatar_url: p.avatar_url,
          };
        });
      }

      (recentFollows || []).forEach((f: any) => {
        const profile = followerProfiles[f.follower_id];
        recentActivity.push({
          id: `follow-${f.id}`,
          type: 'new_follower',
          title: `${profile?.full_name || 'Someone'} started following you`,
          timestamp: f.created_at,
          relatedUserId: f.follower_id,
          relatedUserName: profile?.full_name,
          relatedUserAvatar: profile?.avatar_url,
        });
      });

      // Sort all activity by timestamp
      recentActivity.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Deduplicate activity by ID (in case of data inconsistencies)
      const seenActivityIds = new Set<string>();
      const uniqueRecentActivity = recentActivity.filter((activity) => {
        if (seenActivityIds.has(activity.id)) {
          return false;
        }
        seenActivityIds.add(activity.id);
        return true;
      });

      // =========================================================================
      // CALCULATE WEEKLY SUMMARY
      // =========================================================================
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = new Date();

      const weekRaces = finishedRaces.filter(
        (r: any) => new Date(r.start_date) >= weekStart
      );

      let weeklyWins = 0;
      let weeklyPodiums = 0;
      const weeklyPositions: number[] = [];
      let highlightRace: { name: string; position: number; fleetSize: number } | undefined;

      weekRaces.forEach((race: any) => {
        const p = participantsMap.get(race.id);
        if (p?.finish_position) {
          weeklyPositions.push(p.finish_position);
          if (p.finish_position === 1) weeklyWins++;
          if (p.finish_position <= 3) weeklyPodiums++;

          // Track best race of the week
          if (!highlightRace || p.finish_position < highlightRace.position) {
            highlightRace = {
              name: race.name,
              position: p.finish_position,
              fleetSize: race.metadata?.fleet_size || 0,
            };
          }
        }
      });

      // Calculate previous week for comparison
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekRaces = finishedRaces.filter(
        (r: any) => new Date(r.start_date) >= prevWeekStart && new Date(r.start_date) < weekStart
      );
      const prevWeekPositions: number[] = [];
      prevWeekRaces.forEach((race: any) => {
        const p = participantsMap.get(race.id);
        if (p?.finish_position) {
          prevWeekPositions.push(p.finish_position);
        }
      });

      const prevWeekAvg = prevWeekPositions.length > 0
        ? prevWeekPositions.reduce((a, b) => a + b, 0) / prevWeekPositions.length
        : null;
      const weekAvg = weeklyPositions.length > 0
        ? Math.round((weeklyPositions.reduce((a, b) => a + b, 0) / weeklyPositions.length) * 10) / 10
        : null;

      const weeklySummary: WeeklySummary | undefined = weekRaces.length > 0 ? {
        weekStartDate: weekStart.toISOString(),
        weekEndDate: weekEnd.toISOString(),
        racesCompleted: weekRaces.length,
        wins: weeklyWins,
        podiums: weeklyPodiums,
        avgFinish: weekAvg,
        timeOnWater: 0, // Would need to calculate from timer sessions
        highlightRace,
        streakDays: 0, // TODO: Calculate actual streak days
        comparedToLastWeek: {
          races: weekRaces.length - prevWeekRaces.length,
          avgFinish: prevWeekAvg && weekAvg ? weekAvg - prevWeekAvg : null,
        },
        isShareable: weekRaces.length > 0,
      } : undefined;

      // =========================================================================
      // CALCULATE SEASON RECAP (Previous Year)
      // =========================================================================
      const lastYear = now.getFullYear() - 1;
      const lastYearStart = new Date(lastYear, 0, 1);
      const lastYearEnd = new Date(lastYear, 11, 31);

      const lastYearRaces = finishedRaces.filter(
        (r: any) => {
          const d = new Date(r.start_date);
          return d >= lastYearStart && d <= lastYearEnd;
        }
      );

      let lastYearWins = 0;
      let lastYearPodiums = 0;
      const lastYearPositions: number[] = [];
      const monthlyRaces = new Map<string, number>();
      const lastYearVenues = new Set<string>();

      lastYearRaces.forEach((race: any) => {
        const p = participantsMap.get(race.id);
        if (p?.finish_position) {
          lastYearPositions.push(p.finish_position);
          if (p.finish_position === 1) lastYearWins++;
          if (p.finish_position <= 3) lastYearPodiums++;
        }

        // Track monthly activity
        const month = new Date(race.start_date).toLocaleString('default', { month: 'long' });
        monthlyRaces.set(month, (monthlyRaces.get(month) || 0) + 1);

        // Track venues
        const venueName = race.venue_name || race.metadata?.venue_name;
        if (venueName) {
          lastYearVenues.add(venueName);
        }
      });

      // Find best month
      let bestMonth = '';
      let bestMonthCount = 0;
      monthlyRaces.forEach((count, month) => {
        if (count > bestMonthCount) {
          bestMonth = month;
          bestMonthCount = count;
        }
      });

      // Get top 3 races by position
      const topRaces = lastYearRaces
        .map((race: any) => ({
          race,
          position: participantsMap.get(race.id)?.finish_position,
        }))
        .filter((r) => r.position)
        .sort((a, b) => (a.position || 99) - (b.position || 99))
        .slice(0, 3)
        .map(({ race, position }) => ({
          name: race.name,
          position: position!,
          fleetSize: race.metadata?.fleet_size || 0,
          date: race.start_date,
          venue: race.venue_name || race.metadata?.venue_name || '',
        }));

      const lastYearAvg = lastYearPositions.length > 0
        ? Math.round((lastYearPositions.reduce((a, b) => a + b, 0) / lastYearPositions.length) * 10) / 10
        : null;

      // Calculate previous year comparison (year before last)
      const twoYearsAgo = lastYear - 1;
      const twoYearsAgoRaces = finishedRaces.filter(
        (r: any) => new Date(r.start_date).getFullYear() === twoYearsAgo
      );
      let twoYearsAgoWins = 0;
      const twoYearsAgoPositions: number[] = [];
      twoYearsAgoRaces.forEach((race: any) => {
        const p = participantsMap.get(race.id);
        if (p?.finish_position) {
          twoYearsAgoPositions.push(p.finish_position);
          if (p.finish_position === 1) twoYearsAgoWins++;
        }
      });
      const twoYearsAgoAvg = twoYearsAgoPositions.length > 0
        ? twoYearsAgoPositions.reduce((a, b) => a + b, 0) / twoYearsAgoPositions.length
        : null;

      const seasonRecap: SeasonRecap | undefined = lastYearRaces.length > 0 ? {
        year: lastYear,
        totalRaces: lastYearRaces.length,
        totalWins: lastYearWins,
        totalPodiums: lastYearPodiums,
        averageFinish: lastYearAvg,
        timeOnWater: 0, // Would need to calculate from timer sessions
        venuesVisited: lastYearVenues.size,
        newVenues: [], // Would need to compare with previous years
        bestMonth,
        bestMonthRaces: bestMonthCount,
        highlights: [
          ...(lastYearWins > 0 ? [{
            type: 'best_race' as const,
            title: 'Season Wins',
            value: lastYearWins,
            icon: 'trophy',
          }] : []),
          ...(bestMonth ? [{
            type: 'most_races_month' as const,
            title: 'Most Active Month',
            value: bestMonth,
            detail: `${bestMonthCount} races completed`,
            icon: 'calendar',
          }] : []),
        ],
        topRaces,
        comparedToPreviousYear: twoYearsAgoRaces.length > 0 ? {
          races: lastYearRaces.length - twoYearsAgoRaces.length,
          wins: lastYearWins - twoYearsAgoWins,
          avgFinish: lastYearAvg && twoYearsAgoAvg ? lastYearAvg - twoYearsAgoAvg : null,
        } : null,
        isShareable: lastYearRaces.length > 0,
      } : undefined;

      // =========================================================================
      // CALCULATE COURSE RECORDS
      // =========================================================================
      const courseMap = new Map<string, {
        courseName: string;
        venueName: string;
        venueId: string;
        races: { position: number; fleetSize: number; date: string; conditions?: any }[];
      }>();

      finishedRaces.forEach((race: any) => {
        const p = participantsMap.get(race.id);
        if (!p?.finish_position) return;

        const venueName = race.venue_name || race.metadata?.venue_name;
        const courseName = race.metadata?.course_type || 'Standard';
        if (!venueName) return;

        const courseKey = `${venueName}-${courseName}`.toLowerCase();

        if (!courseMap.has(courseKey)) {
          courseMap.set(courseKey, {
            courseName,
            venueName,
            venueId: venueName.toLowerCase().replace(/\s+/g, '-'),
            races: [],
          });
        }

        courseMap.get(courseKey)!.races.push({
          position: p.finish_position,
          fleetSize: race.metadata?.fleet_size || 0,
          date: race.start_date,
          conditions: race.metadata?.conditions,
        });
      });

      const courseRecords: CourseRecord[] = Array.from(courseMap.entries())
        .map(([id, course]) => {
          const bestRace = course.races.reduce((best, current) =>
            current.position < best.position ? current : best
          );
          const avgPosition = course.races.reduce((sum, r) => sum + r.position, 0) / course.races.length;

          return {
            id,
            courseName: course.courseName,
            venueName: course.venueName,
            venueId: course.venueId,
            bestPosition: bestRace.position,
            fleetSize: bestRace.fleetSize,
            date: bestRace.date,
            conditions: bestRace.conditions,
            timesRaced: course.races.length,
            avgPosition: Math.round(avgPosition * 10) / 10,
          };
        })
        .sort((a, b) => a.bestPosition - b.bestPosition)
        .slice(0, 10); // Top 10 course records

      // =========================================================================
      // FETCH RACE PHOTOS FROM SAILOR_MEDIA
      // =========================================================================
      const { data: photosData, error: photosError } = await supabase
        .from('sailor_media')
        .select(`
          id,
          media_url,
          thumbnail_url,
          caption,
          upload_date,
          regatta_id,
          metadata,
          regattas(name)
        `)
        .eq('user_id', userId)
        .eq('media_type', 'image')
        .order('upload_date', { ascending: false })
        .limit(20);

      if (photosError) {
        logger.debug('sailor_media query unavailable', photosError.message);
      }

      const racePhotos: RacePhoto[] = (photosData || []).map((p: any) => ({
        id: p.id,
        url: p.media_url,
        thumbnailUrl: p.thumbnail_url,
        caption: p.caption,
        takenAt: p.metadata?.taken_at || p.upload_date,
        uploadedAt: p.upload_date,
        source: p.metadata?.source || 'upload',
        regattaId: p.regatta_id,
        regattaName: p.regattas?.name,
        venueName: undefined,
        tags: p.metadata?.tags || [],
        width: p.metadata?.width,
        height: p.metadata?.height,
      }));

      // =========================================================================
      // FETCH RACE JOURNAL ENTRIES
      // =========================================================================
      const { data: journalData } = await supabase
        .from('race_journals')
        .select('*')
        .eq('user_id', userId)
        .order('race_date', { ascending: false })
        .limit(20);

      const raceJournal: RaceJournalEntry[] = (journalData || []).map((j: any) => ({
        id: j.id,
        regattaId: j.regatta_id,
        regattaName: j.regatta_name,
        raceDate: j.race_date,
        position: j.position,
        fleetSize: j.fleet_size,
        mood: j.mood,
        preRaceNotes: j.pre_race_notes,
        postRaceNotes: j.post_race_notes,
        whatWorked: j.what_worked || [],
        whatToImprove: j.what_to_improve || [],
        conditions: j.conditions,
        tuningSettings: j.tuning_settings,
        keyMoments: j.key_moments || [],
        createdAt: j.created_at,
        updatedAt: j.updated_at,
      }));

      // =========================================================================
      // FETCH TRAINING PLANS WITH ACTIVITIES
      // =========================================================================
      const { data: plansData } = await supabase
        .from('training_plans')
        .select(`
          *,
          training_activities(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const trainingPlans: TrainingPlan[] = (plansData || []).map((plan: any) => {
        const activities = (plan.training_activities || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((a: any) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            description: a.description,
            duration: a.duration,
            isCompleted: a.is_completed,
            completedAt: a.completed_at,
            resourceUrl: a.resource_url,
            icon: a.icon || 'play-circle',
          }));

        const completedCount = activities.filter((a: any) => a.isCompleted).length;
        const totalDuration = activities.reduce((sum: number, a: any) => sum + (a.duration || 0), 0);

        return {
          id: plan.id,
          title: plan.title,
          description: plan.description,
          targetRace: plan.target_race,
          targetDate: plan.target_date,
          status: plan.status,
          activities,
          totalActivities: activities.length,
          completedActivities: completedCount,
          estimatedDuration: totalDuration,
          createdAt: plan.created_at,
          startedAt: plan.started_at,
          completedAt: plan.completed_at,
        };
      });

      // =========================================================================
      // BUILD VENUES WITH COORDINATES (using known HK venues)
      // =========================================================================
      const VENUE_COORDINATES: Record<string, { lat: number; lng: number }> = {
        'royal hong kong yacht club': { lat: 22.2855, lng: 114.1713 },
        'rhkyc': { lat: 22.2855, lng: 114.1713 },
        'aberdeen boat club': { lat: 22.2480, lng: 114.1494 },
        'abc': { lat: 22.2480, lng: 114.1494 },
        'hebe haven yacht club': { lat: 22.3679, lng: 114.2900 },
        'hhyc': { lat: 22.3679, lng: 114.2900 },
        'middle island yacht club': { lat: 22.2405, lng: 114.1926 },
        'myc': { lat: 22.2405, lng: 114.1926 },
        'clearwater bay country club': { lat: 22.2775, lng: 114.2983 },
        'discovery bay marina club': { lat: 22.2897, lng: 114.0089 },
      };

      const maxRaceCount = Math.max(...venuesVisited.map(v => v.raceCount), 1);
      const venuesWithCoordinates: VenueWithCoordinates[] = venuesVisited
        .map(venue => {
          const coords = VENUE_COORDINATES[venue.name.toLowerCase()] ||
                        VENUE_COORDINATES[venue.id.toLowerCase()];
          if (!coords) return null;
          return {
            ...venue,
            latitude: coords.lat,
            longitude: coords.lng,
            intensity: venue.raceCount / maxRaceCount,
          };
        })
        .filter((v): v is VenueWithCoordinates => v !== null);

      // =========================================================================
      // FETCH BOATS WITH MAINTENANCE (from sail_inspections)
      // =========================================================================
      const boatsWithMaintenance: BoatWithMaintenance[] = await Promise.all(
        boats.map(async (boat) => {
          // Try to find sail inspections for this boat
          const { data: inspections } = await supabase
            .from('sail_inspections')
            .select('*')
            .eq('sailor_id', userId)
            .order('inspection_date', { ascending: false })
            .limit(5);

          const logs: MaintenanceLog[] = (inspections || []).map((i: any) => ({
            id: i.id,
            boatId: boat.id,
            type: 'inspection' as const,
            title: `${i.inspection_type.charAt(0).toUpperCase() + i.inspection_type.slice(1)} Inspection`,
            description: i.notes,
            date: i.inspection_date,
            status: 'completed' as const,
          }));

          const lastInspection = logs[0];

          return {
            ...boat,
            lastMaintenanceDate: lastInspection?.date,
            healthScore: inspections?.[0]?.overall_condition_score,
            maintenanceLogs: logs,
          };
        })
      );

      // =========================================================================
      // GENERATE INSIGHTS FROM STATS
      // =========================================================================
      const insights: PerformanceInsight[] = [];

      // Approaching milestone
      if (finishedRaces.length > 0 && finishedRaces.length < 100) {
        const nextMilestone = finishedRaces.length < 10 ? 10 :
                             finishedRaces.length < 50 ? 50 : 100;
        const remaining = nextMilestone - finishedRaces.length;
        if (remaining <= 15) {
          insights.push({
            id: 'insight-milestone',
            type: 'milestone',
            title: `Approaching ${nextMilestone} Races`,
            description: `You're only ${remaining} races away from your ${nextMilestone}-race milestone!`,
            sentiment: 'positive',
            metric: 'Total Races',
            metricValue: finishedRaces.length,
            icon: 'star',
            color: 'systemPurple',
            generatedAt: new Date().toISOString(),
          });
        }
      }

      // Improvement insight
      if (seasonAverageFinish && averageFinish && seasonAverageFinish < averageFinish) {
        const improvement = Math.round((averageFinish - seasonAverageFinish) * 10) / 10;
        insights.push({
          id: 'insight-improvement',
          type: 'trend',
          title: 'Strong Season Performance',
          description: `Your average finish has improved by ${improvement} positions this season compared to your career average.`,
          sentiment: 'positive',
          metric: 'Average Finish',
          metricValue: seasonAverageFinish,
          metricChange: -Math.round((improvement / averageFinish) * 100),
          icon: 'trending-up',
          color: 'systemGreen',
          generatedAt: new Date().toISOString(),
        });
      }

      // Win rate insight
      if (winRate && winRate > 0.15) {
        insights.push({
          id: 'insight-winrate',
          type: 'comparison',
          title: 'Top Competitor',
          description: `Your ${Math.round(winRate * 100)}% win rate puts you among the top performers in your fleet.`,
          sentiment: 'positive',
          metric: 'Win Rate',
          metricValue: `${Math.round(winRate * 100)}%`,
          icon: 'trophy',
          color: 'systemYellow',
          generatedAt: new Date().toISOString(),
        });
      }

      setData({
        profile: {
          userId,
          displayName,
          email: profileData?.email || null,
          avatarUrl: null,
          avatarEmoji: sailorProfile?.avatar_emoji || null,
          avatarColor: sailorProfile?.avatar_color || null,
          avatarInitials: getInitials(displayName),
          bio: sailorProfile?.bio || null,
          location: sailorProfile?.location || null,
          homeClub: homeClubName,
          sailingSince: null,
          followerCount: followerCount || 0,
          followingCount: followingCount || 0,
        },
        stats: {
          totalRaces: finishedRaces.length,
          totalWins,
          totalPodiums,
          averageFinish,
          winRate,
          seasonRaces: seasonRaces.length,
          seasonWins,
          seasonPodiums,
          seasonAverageFinish,
          currentStreak: 0, // TODO: Calculate actual streak
          longestStreak: 0,
          totalTimeOnWater: Math.round(totalTimeOnWater),
          memberSince: profileData?.created_at || null,
        },
        venuesVisited,
        boats,
        achievements,
        personalRecords,
        challenges,
        recentActivity: uniqueRecentActivity.slice(0, 10), // Limit to 10 most recent
        goals,
        insights,
        fleetComparison: undefined, // Complex to compute, would need fleet membership data
        sailorComparisons: [], // Complex to compute, would need head-to-head race data
        weeklySummary,
        boatsWithMaintenance,
        trainingPlans,
        venuesWithCoordinates,
        seasonRecap,
        courseRecords,
        racePhotos,
        raceJournal,
      });
    } catch (err) {
      logger.error('Error loading profile data:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refresh: loadData,
  };
}

// =============================================================================
// MOCK DATA HOOK (for demo purposes)
// =============================================================================

export function useReflectProfileMock(): {
  data: ReflectProfileData;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  const { data: reflectData } = useReflectDataMock();

  const mockData: ReflectProfileData = useMemo(() => ({
    profile: {
      userId: 'mock-user',
      displayName: 'Alex Chen',
      email: 'alex@sailing.com',
      avatarUrl: null,
      avatarInitials: 'AC',
      bio: 'Weekend warrior sailor based in Hong Kong. J/80 enthusiast.',
      location: 'Hong Kong',
      homeClub: 'Royal Hong Kong Yacht Club',
      sailingSince: 2018,
      followerCount: 42,
      followingCount: 38,
    },
    stats: {
      totalRaces: 87,
      totalWins: 12,
      totalPodiums: 28,
      averageFinish: 4.2,
      winRate: 0.14,
      seasonRaces: reflectData.stats.totalRacesThisYear,
      seasonWins: 3,
      seasonPodiums: reflectData.stats.totalPodiumsThisYear,
      seasonAverageFinish: 3.8,
      currentStreak: reflectData.stats.currentStreak,
      longestStreak: 8,
      totalTimeOnWater: reflectData.stats.totalTimeOnWaterThisYear,
      memberSince: '2018-03-15T00:00:00Z',
    },
    venuesVisited: [
      {
        id: 'rhkyc',
        name: 'Royal Hong Kong Yacht Club',
        location: 'Victoria Harbour',
        raceCount: 45,
        lastRaceDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        bestFinish: 1,
        averageFinish: 3.8,
      },
      {
        id: 'abc',
        name: 'Aberdeen Boat Club',
        location: 'Aberdeen',
        raceCount: 22,
        lastRaceDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        bestFinish: 2,
        averageFinish: 4.5,
      },
      {
        id: 'hhyc',
        name: 'Hebe Haven Yacht Club',
        location: 'Sai Kung',
        raceCount: 12,
        lastRaceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        bestFinish: 1,
        averageFinish: 3.2,
      },
      {
        id: 'myc',
        name: 'Middle Island Yacht Club',
        location: 'Repulse Bay',
        raceCount: 8,
        lastRaceDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        bestFinish: 3,
        averageFinish: 5.1,
      },
    ],
    boats: [
      {
        id: 'boat-1',
        name: 'Wind Dancer',
        className: 'J/80',
        sailNumber: 'HKG 1234',
        isPrimary: true,
        raceCount: 65,
        winCount: 10,
      },
      {
        id: 'boat-2',
        name: 'Silver Arrow',
        className: 'Laser',
        sailNumber: 'HKG 567',
        isPrimary: false,
        raceCount: 22,
        winCount: 2,
      },
    ],
    // Phase 3: Achievements
    achievements: [
      {
        id: 'ach-1',
        type: 'first_win',
        title: 'First Victory',
        description: 'Won your first race',
        icon: 'trophy',
        earnedAt: '2019-06-15T14:30:00Z',
        relatedRegattaName: 'Summer Series Race 3',
      },
      {
        id: 'ach-2',
        type: 'race_milestone_50',
        title: '50 Races',
        description: 'Completed 50 races',
        icon: 'star',
        earnedAt: '2022-09-20T12:00:00Z',
      },
      {
        id: 'ach-3',
        type: 'series_champion',
        title: 'Series Champion',
        description: 'Won a race series',
        icon: 'ribbon',
        earnedAt: '2024-11-30T16:00:00Z',
        relatedRegattaName: 'Autumn Championship',
      },
      {
        id: 'ach-4',
        type: 'win_streak_3',
        title: 'Hot Streak',
        description: '3 consecutive wins',
        icon: 'flame',
        earnedAt: '2024-08-10T15:00:00Z',
      },
      {
        id: 'ach-5',
        type: 'first_podium',
        title: 'First Podium',
        description: 'Finished in top 3 for the first time',
        icon: 'medal',
        earnedAt: '2019-04-20T13:00:00Z',
        relatedRegattaName: 'Spring Opener',
      },
      {
        id: 'ach-6',
        type: 'first_race',
        title: 'Getting Started',
        description: 'Completed your first race',
        icon: 'flag',
        earnedAt: '2018-03-25T11:00:00Z',
        relatedRegattaName: 'Beginner Regatta',
      },
    ],
    personalRecords: [
      {
        id: 'pr-1',
        label: 'Best Finish',
        value: '1st',
        detail: 'in 45 boat fleet',
        date: '2024-11-30',
        regattaName: 'Autumn Championship Finals',
        icon: 'trophy',
        color: 'systemYellow',
      },
      {
        id: 'pr-2',
        label: 'Best Win Streak',
        value: 5,
        detail: 'consecutive wins',
        date: '2024-08-10',
        icon: 'flame',
        color: 'systemOrange',
      },
      {
        id: 'pr-3',
        label: 'Largest Fleet Win',
        value: '1st of 52',
        detail: 'Around the Island Race',
        date: '2023-10-15',
        regattaName: 'Around the Island Race',
        icon: 'people',
        color: 'systemBlue',
      },
      {
        id: 'pr-4',
        label: 'Best Season',
        value: '2024',
        detail: '8 wins, 67% podium rate',
        icon: 'calendar',
        color: 'systemGreen',
      },
      {
        id: 'pr-5',
        label: 'Best Average Finish',
        value: '2.3',
        detail: 'Winter Series 2024',
        date: '2024-02-28',
        icon: 'analytics',
        color: 'systemPurple',
      },
    ],
    challenges: [
      {
        id: 'ch-1',
        title: 'January Racing',
        description: 'Complete 5 races this month',
        type: 'race_count',
        targetValue: 5,
        currentValue: 3,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        isCompleted: false,
        icon: 'flag',
      },
      {
        id: 'ch-2',
        title: 'Podium Hunter',
        description: 'Finish on the podium 10 times',
        type: 'podium_count',
        targetValue: 10,
        currentValue: 10,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        isCompleted: true,
        completedAt: '2025-11-15',
        reward: 'Podium Pro Badge',
        icon: 'medal',
      },
      {
        id: 'ch-3',
        title: 'Venue Explorer',
        description: 'Race at 5 different venues',
        type: 'venue_count',
        targetValue: 5,
        currentValue: 4,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCompleted: false,
        icon: 'location',
      },
    ],
    // Phase 4: Recent Activity
    recentActivity: [
      {
        id: 'act-1',
        type: 'race_completed',
        title: 'Finished 2nd in Spring Series Race 4',
        description: 'Royal Hong Kong Yacht Club',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        relatedRegattaId: 'reg-123',
        relatedRegattaName: 'Spring Series Race 4',
      },
      {
        id: 'act-2',
        type: 'new_follower',
        title: 'Sarah Wong started following you',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        relatedUserId: 'user-456',
        relatedUserName: 'Sarah Wong',
        relatedUserAvatar: 'https://i.pravatar.cc/150?u=sarah',
      },
      {
        id: 'act-3',
        type: 'achievement_earned',
        title: 'Earned "Hot Streak" achievement',
        description: '3 consecutive wins',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      },
      {
        id: 'act-4',
        type: 'comment_received',
        title: 'Mike Lee commented on your race',
        description: '"Great finish! The start was amazing."',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        relatedUserId: 'user-789',
        relatedUserName: 'Mike Lee',
        relatedUserAvatar: 'https://i.pravatar.cc/150?u=mike',
      },
      {
        id: 'act-5',
        type: 'liked_post',
        title: 'Emma Chen liked your race result',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        relatedUserId: 'user-012',
        relatedUserName: 'Emma Chen',
        relatedUserAvatar: 'https://i.pravatar.cc/150?u=emma',
      },
      {
        id: 'act-6',
        type: 'followed_user',
        title: 'You started following James Tan',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
        relatedUserId: 'user-345',
        relatedUserName: 'James Tan',
        relatedUserAvatar: 'https://i.pravatar.cc/150?u=james',
      },
    ],
    // Phase 5: Goals
    goals: [
      {
        id: 'goal-1',
        type: 'races',
        title: '50 Races This Season',
        description: 'Complete 50 races in 2026',
        targetValue: 50,
        currentValue: 12,
        unit: 'races',
        period: 'season',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCompleted: false,
        icon: 'flag',
        color: 'systemBlue',
      },
      {
        id: 'goal-2',
        type: 'wins',
        title: 'Win 10 Races',
        description: 'Achieve 10 race victories this year',
        targetValue: 10,
        currentValue: 3,
        unit: 'wins',
        period: 'season',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCompleted: false,
        icon: 'trophy',
        color: 'systemYellow',
      },
      {
        id: 'goal-3',
        type: 'improvement',
        title: 'Improve Average Finish',
        description: 'Get average finish under 3.5',
        targetValue: 3.5,
        currentValue: 3.8,
        unit: 'avg position',
        period: 'season',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCompleted: false,
        icon: 'trending-up',
        color: 'systemGreen',
      },
      {
        id: 'goal-4',
        type: 'time_on_water',
        title: '100 Hours On Water',
        description: 'Spend 100 hours racing and training',
        targetValue: 100,
        currentValue: 32,
        unit: 'hours',
        period: 'season',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCompleted: false,
        icon: 'time',
        color: 'systemTeal',
      },
    ],
    // Phase 5: Insights
    insights: [
      {
        id: 'insight-1',
        type: 'trend',
        title: 'Strong Start to 2026',
        description: 'Your average finish has improved by 15% compared to the same period last year.',
        sentiment: 'positive',
        metric: 'Average Finish',
        metricValue: 3.8,
        metricChange: -15,
        icon: 'trending-up',
        color: 'systemGreen',
        generatedAt: new Date().toISOString(),
      },
      {
        id: 'insight-2',
        type: 'recommendation',
        title: 'Focus on Starts',
        description: 'Analysis shows you lose an average of 2 positions in the first leg. Working on starts could boost your results.',
        sentiment: 'needs_attention',
        actionLabel: 'View Start Tips',
        actionRoute: '/learn',
        icon: 'bulb',
        color: 'systemOrange',
        generatedAt: new Date().toISOString(),
      },
      {
        id: 'insight-3',
        type: 'milestone',
        title: 'Approaching 100 Races',
        description: "You're only 13 races away from your 100th race milestone!",
        sentiment: 'positive',
        metric: 'Total Races',
        metricValue: 87,
        icon: 'star',
        color: 'systemPurple',
        generatedAt: new Date().toISOString(),
      },
      {
        id: 'insight-4',
        type: 'streak',
        title: 'Consistent Racing',
        description: "You've raced every week for 3 weeks straight. Keep the momentum going!",
        sentiment: 'positive',
        metric: 'Week Streak',
        metricValue: 3,
        icon: 'flame',
        color: 'systemRed',
        generatedAt: new Date().toISOString(),
      },
    ],
    // Phase 5: Fleet Comparison
    fleetComparison: {
      fleetName: 'HK Dragon Association',
      fleetSize: 28,
      yourRank: 5,
      yourPercentile: 82,
      avgFinish: 3.8,
      fleetAvgFinish: 5.2,
      topSailorName: 'Sarah Chen',
      topSailorWins: 15,
    },
    // Phase 5: Sailor Comparisons
    sailorComparisons: [
      {
        sailorId: 'sailor-1',
        sailorName: 'Sarah Chen',
        sailorAvatar: 'https://i.pravatar.cc/150?u=sarah-chen',
        yourWins: 3,
        theirWins: 5,
        headToHeadRaces: 12,
        lastRaceResult: 'lost',
      },
      {
        sailorId: 'sailor-2',
        sailorName: 'Mike Thompson',
        sailorAvatar: 'https://i.pravatar.cc/150?u=mike-t',
        yourWins: 4,
        theirWins: 3,
        headToHeadRaces: 8,
        lastRaceResult: 'won',
      },
      {
        sailorId: 'sailor-3',
        sailorName: 'James Wong',
        sailorAvatar: 'https://i.pravatar.cc/150?u=james-w',
        yourWins: 2,
        theirWins: 2,
        headToHeadRaces: 6,
        lastRaceResult: 'tied',
      },
    ],
    // Phase 5: Weekly Summary
    weeklySummary: {
      weekStartDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      weekEndDate: new Date().toISOString(),
      racesCompleted: 2,
      wins: 0,
      podiums: 1,
      avgFinish: 2.5,
      timeOnWater: 240, // 4 hours
      highlightRace: {
        name: 'Spring Series Race 4',
        position: 2,
        fleetSize: 18,
      },
      streakDays: 3,
      comparedToLastWeek: {
        races: 1,
        avgFinish: -0.5,
      },
      isShareable: true,
    },
    // Phase 5: Boats with Maintenance
    boatsWithMaintenance: [
      {
        id: 'boat-1',
        name: 'Wind Dancer',
        className: 'J/80',
        sailNumber: 'HKG 1234',
        isPrimary: true,
        raceCount: 65,
        winCount: 10,
        lastMaintenanceDate: '2026-01-15',
        nextMaintenanceDate: '2026-04-15',
        healthScore: 92,
        totalMaintenanceCost: 2500,
        maintenanceLogs: [
          {
            id: 'maint-1',
            boatId: 'boat-1',
            type: 'inspection',
            title: 'Pre-season Inspection',
            description: 'Full hull and rigging inspection before racing season',
            date: '2026-01-15',
            status: 'completed',
            cost: 350,
            vendor: 'RHKYC Marine Services',
          },
          {
            id: 'maint-2',
            boatId: 'boat-1',
            type: 'tuning',
            title: 'Rig Tuning',
            description: 'Adjusted shroud tension and mast rake',
            date: '2026-01-10',
            status: 'completed',
            cost: 200,
          },
          {
            id: 'maint-3',
            boatId: 'boat-1',
            type: 'replacement',
            title: 'Replace Main Halyard',
            description: 'New Dyneema halyard installed',
            date: '2025-12-20',
            status: 'completed',
            cost: 450,
            vendor: 'Sail Supplies HK',
          },
        ],
      },
      {
        id: 'boat-2',
        name: 'Silver Arrow',
        className: 'Laser',
        sailNumber: 'HKG 567',
        isPrimary: false,
        raceCount: 22,
        winCount: 2,
        lastMaintenanceDate: '2025-11-01',
        nextMaintenanceDate: '2026-02-01',
        healthScore: 78,
        totalMaintenanceCost: 800,
        maintenanceLogs: [
          {
            id: 'maint-4',
            boatId: 'boat-2',
            type: 'cleaning',
            title: 'Hull Cleaning',
            description: 'Bottom cleaned and waxed',
            date: '2025-11-01',
            status: 'completed',
            cost: 150,
          },
          {
            id: 'maint-5',
            boatId: 'boat-2',
            type: 'inspection',
            title: 'Annual Inspection',
            description: 'Check all fittings and sail condition',
            date: '2026-02-01',
            status: 'scheduled',
            nextDueDate: '2026-02-01',
          },
        ],
      },
    ],
    // Phase 6: Training Plans
    trainingPlans: [
      {
        id: 'plan-1',
        title: 'Spring Championship Prep',
        description: 'Comprehensive training plan for the upcoming Spring Championship',
        targetRace: 'Spring Championship',
        targetDate: '2026-03-15',
        status: 'in_progress',
        totalActivities: 8,
        completedActivities: 3,
        estimatedDuration: 420,
        createdAt: '2026-01-10T00:00:00Z',
        startedAt: '2026-01-15T00:00:00Z',
        activities: [
          {
            id: 'act-1',
            type: 'video',
            title: 'Starting Line Tactics',
            description: 'Watch expert analysis of championship-level starts',
            duration: 45,
            isCompleted: true,
            completedAt: '2026-01-16T10:00:00Z',
            resourceUrl: '/learn/videos/starting-tactics',
            icon: 'play-circle',
          },
          {
            id: 'act-2',
            type: 'drill',
            title: 'Practice Starts',
            description: 'Complete 10 timed practice starts',
            duration: 60,
            isCompleted: true,
            completedAt: '2026-01-18T14:00:00Z',
            icon: 'timer',
          },
          {
            id: 'act-3',
            type: 'article',
            title: 'Weather Pattern Analysis',
            description: 'Learn to read local weather patterns',
            duration: 30,
            isCompleted: true,
            completedAt: '2026-01-20T09:00:00Z',
            resourceUrl: '/learn/articles/weather',
            icon: 'document-text',
          },
          {
            id: 'act-4',
            type: 'workout',
            title: 'Hiking Strength',
            description: 'Complete hiking fitness routine',
            duration: 45,
            isCompleted: false,
            icon: 'fitness',
          },
          {
            id: 'act-5',
            type: 'mental',
            title: 'Race Visualization',
            description: 'Practice mental race preparation',
            duration: 20,
            isCompleted: false,
            icon: 'eye',
          },
        ],
      },
      {
        id: 'plan-2',
        title: 'Light Wind Mastery',
        description: 'Improve performance in light air conditions',
        status: 'not_started',
        totalActivities: 5,
        completedActivities: 0,
        estimatedDuration: 180,
        createdAt: '2026-01-25T00:00:00Z',
        activities: [
          {
            id: 'act-6',
            type: 'video',
            title: 'Light Air Trim',
            duration: 30,
            isCompleted: false,
            icon: 'play-circle',
          },
          {
            id: 'act-7',
            type: 'drill',
            title: 'Roll Tacking Practice',
            duration: 45,
            isCompleted: false,
            icon: 'repeat',
          },
        ],
      },
    ],
    // Phase 6: Venues with Coordinates (for heatmap)
    venuesWithCoordinates: [
      {
        id: 'rhkyc',
        name: 'Royal Hong Kong Yacht Club',
        location: 'Victoria Harbour',
        raceCount: 45,
        lastRaceDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        bestFinish: 1,
        averageFinish: 3.8,
        latitude: 22.2855,
        longitude: 114.1713,
        intensity: 1.0,
      },
      {
        id: 'abc',
        name: 'Aberdeen Boat Club',
        location: 'Aberdeen',
        raceCount: 22,
        lastRaceDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        bestFinish: 2,
        averageFinish: 4.5,
        latitude: 22.2480,
        longitude: 114.1494,
        intensity: 0.49,
      },
      {
        id: 'hhyc',
        name: 'Hebe Haven Yacht Club',
        location: 'Sai Kung',
        raceCount: 12,
        lastRaceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        bestFinish: 1,
        averageFinish: 3.2,
        latitude: 22.3679,
        longitude: 114.2900,
        intensity: 0.27,
      },
      {
        id: 'myc',
        name: 'Middle Island Yacht Club',
        location: 'Repulse Bay',
        raceCount: 8,
        lastRaceDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        bestFinish: 3,
        averageFinish: 5.1,
        latitude: 22.2405,
        longitude: 114.1926,
        intensity: 0.18,
      },
    ],
    // Phase 6: Season Recap (2025)
    seasonRecap: {
      year: 2025,
      totalRaces: 42,
      totalWins: 8,
      totalPodiums: 18,
      averageFinish: 4.1,
      timeOnWater: 5040, // 84 hours
      venuesVisited: 4,
      newVenues: ['Middle Island Yacht Club'],
      bestMonth: 'October',
      bestMonthRaces: 8,
      highlights: [
        {
          type: 'best_race',
          title: 'Season Best',
          value: '1st of 45',
          date: '2025-11-30',
          detail: 'Autumn Championship Finals',
          icon: 'trophy',
        },
        {
          type: 'longest_streak',
          title: 'Win Streak',
          value: 5,
          date: '2025-08-10',
          detail: 'Summer Series',
          icon: 'flame',
        },
        {
          type: 'most_races_month',
          title: 'Most Active Month',
          value: 'October',
          detail: '8 races completed',
          icon: 'calendar',
        },
        {
          type: 'biggest_improvement',
          title: 'Improved Avg Finish',
          value: '-0.8',
          detail: 'From 4.9 to 4.1',
          icon: 'trending-up',
        },
        {
          type: 'milestone',
          title: 'Career Milestone',
          value: '75 races',
          detail: 'Reached 75 total races',
          icon: 'star',
        },
      ],
      topRaces: [
        {
          name: 'Autumn Championship Finals',
          position: 1,
          fleetSize: 45,
          date: '2025-11-30',
          venue: 'Royal Hong Kong Yacht Club',
        },
        {
          name: 'Summer Series Race 5',
          position: 1,
          fleetSize: 32,
          date: '2025-08-10',
          venue: 'Royal Hong Kong Yacht Club',
        },
        {
          name: 'Around the Island Race',
          position: 2,
          fleetSize: 52,
          date: '2025-10-15',
          venue: 'Aberdeen Boat Club',
        },
      ],
      comparedToPreviousYear: {
        races: 5,
        wins: 3,
        avgFinish: -0.4,
      },
      isShareable: true,
    },
    // Phase 6: Course Records
    courseRecords: [
      {
        id: 'cr-1',
        courseName: 'Victoria Harbour Triangle',
        venueName: 'Royal Hong Kong Yacht Club',
        venueId: 'rhkyc',
        bestPosition: 1,
        fleetSize: 45,
        date: '2025-11-30',
        conditions: {
          windSpeed: 12,
          windDirection: 'NE',
        },
        previousBest: 3,
        timesRaced: 18,
        avgPosition: 4.2,
      },
      {
        id: 'cr-2',
        courseName: 'Aberdeen Outer Course',
        venueName: 'Aberdeen Boat Club',
        venueId: 'abc',
        bestPosition: 2,
        fleetSize: 28,
        date: '2025-09-20',
        conditions: {
          windSpeed: 8,
          windDirection: 'S',
        },
        timesRaced: 12,
        avgPosition: 5.1,
      },
      {
        id: 'cr-3',
        courseName: 'Sai Kung Bay Circuit',
        venueName: 'Hebe Haven Yacht Club',
        venueId: 'hhyc',
        bestPosition: 1,
        fleetSize: 22,
        date: '2025-07-15',
        conditions: {
          windSpeed: 15,
          windDirection: 'E',
          waveHeight: 1.2,
        },
        timesRaced: 8,
        avgPosition: 3.5,
      },
      {
        id: 'cr-4',
        courseName: 'Repulse Bay Sprint',
        venueName: 'Middle Island Yacht Club',
        venueId: 'myc',
        bestPosition: 3,
        fleetSize: 18,
        date: '2025-06-01',
        timesRaced: 5,
        avgPosition: 6.2,
      },
    ],
    // Phase 6: Race Photos
    racePhotos: [
      {
        id: 'photo-1',
        url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
        thumbnailUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200',
        caption: 'Crossing the finish line at Autumn Championship',
        takenAt: '2025-11-30T15:30:00Z',
        uploadedAt: '2025-11-30T18:00:00Z',
        source: 'club',
        regattaId: 'reg-autumn-finals',
        regattaName: 'Autumn Championship Finals',
        venueName: 'Royal Hong Kong Yacht Club',
        tags: ['finish', 'win', 'championship'],
        width: 1600,
        height: 1067,
      },
      {
        id: 'photo-2',
        url: 'https://images.unsplash.com/photo-1500930287596-c1ecaa373bb2?w=800',
        thumbnailUrl: 'https://images.unsplash.com/photo-1500930287596-c1ecaa373bb2?w=200',
        caption: 'Rounding the windward mark',
        takenAt: '2025-10-15T14:15:00Z',
        uploadedAt: '2025-10-15T20:00:00Z',
        source: 'upload',
        regattaId: 'reg-island-race',
        regattaName: 'Around the Island Race',
        venueName: 'Aberdeen Boat Club',
        tags: ['mark rounding', 'upwind'],
        width: 1600,
        height: 1200,
      },
      {
        id: 'photo-3',
        url: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=800',
        thumbnailUrl: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=200',
        caption: 'Sunset sailing after the race',
        takenAt: '2025-08-10T18:45:00Z',
        uploadedAt: '2025-08-10T21:00:00Z',
        source: 'upload',
        venueName: 'Royal Hong Kong Yacht Club',
        tags: ['sunset', 'post-race'],
        width: 1600,
        height: 900,
      },
      {
        id: 'photo-4',
        url: 'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800',
        thumbnailUrl: 'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=200',
        caption: 'Starting line action',
        takenAt: '2025-07-15T10:02:00Z',
        uploadedAt: '2025-07-15T19:00:00Z',
        source: 'club',
        regattaId: 'reg-summer-series-5',
        regattaName: 'Summer Series Race 5',
        venueName: 'Hebe Haven Yacht Club',
        tags: ['start', 'fleet'],
        width: 1600,
        height: 1067,
      },
    ],
    // Phase 6: Race Journal
    raceJournal: [
      {
        id: 'journal-1',
        regattaId: 'reg-spring-4',
        regattaName: 'Spring Series Race 4',
        raceDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        position: 2,
        fleetSize: 18,
        mood: 'good',
        preRaceNotes: 'Wind forecast showing NE 10-12 knots. Plan to start at pin end.',
        postRaceNotes: 'Great start but lost a position on the final downwind leg. Need to work on gybes in pressure.',
        whatWorked: ['Pin end start', 'Upwind boat speed', 'Mark roundings'],
        whatToImprove: ['Downwind gybes in gusts', 'Final leg tactics'],
        conditions: {
          windSpeed: 11,
          windDirection: 'NE',
          waveHeight: 0.5,
        },
        tuningSettings: {
          'Jib Lead': 'Hole 3',
          'Backstay': '8/10',
          'Outhaul': 'Medium',
          'Cunningham': 'Off',
        },
        keyMoments: [
          'Won the pin by 2 boat lengths',
          'Gained 3 boats on first beat',
          'Lost to Sarah on final run',
        ],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'journal-2',
        regattaId: 'reg-spring-3',
        regattaName: 'Spring Series Race 3',
        raceDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
        position: 1,
        fleetSize: 16,
        mood: 'great',
        preRaceNotes: 'Light wind day. Focus on keeping the boat moving.',
        postRaceNotes: 'Executed the plan perfectly. Light air trim changes made the difference.',
        whatWorked: ['Boat handling in light air', 'Current awareness', 'Patience'],
        whatToImprove: ['Could have extended lead on second beat'],
        conditions: {
          windSpeed: 6,
          windDirection: 'S',
        },
        keyMoments: [
          'Found better pressure on the right side',
          'Perfect gybe at the leeward mark',
          'Led from start to finish',
        ],
        createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'journal-3',
        regattaId: 'reg-spring-2',
        regattaName: 'Spring Series Race 2',
        raceDate: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
        position: 5,
        fleetSize: 20,
        mood: 'challenging',
        preRaceNotes: 'Expecting strong winds. Need to be conservative at the start.',
        postRaceNotes: 'Got caught in a bad position at the start and never recovered. Struggled with overpowered conditions.',
        whatWorked: ['Boat handling improved as race went on'],
        whatToImprove: ['Start positioning in strong winds', 'Depowering earlier', 'Hiking endurance'],
        conditions: {
          windSpeed: 18,
          windDirection: 'E',
          waveHeight: 1.0,
        },
        tuningSettings: {
          'Jib Lead': 'Hole 2',
          'Backstay': '10/10',
          'Outhaul': 'Max',
          'Cunningham': 'On',
        },
        keyMoments: [
          'Got squeezed out at start',
          'Capsized on first run',
          'Recovered well in final leg',
        ],
        createdAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  }), [reflectData]);

  return {
    data: mockData,
    loading: false,
    error: null,
    refresh: () => {},
  };
}
