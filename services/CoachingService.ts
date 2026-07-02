/**
 * CoachingService
 *
 * Complete client management system for coaches including:
 * - Client relationships and tracking
 * - Session management and scheduling
 * - Progress metrics and analytics
 * - Feedback collection
 */

import { addDays } from 'date-fns';
import { supabase } from './supabase';
import { AvatarStorageService } from '@/services/storage/AvatarStorageService';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { createLogger } from '@/lib/utils/logger';
import type { CoachingFeedback, FrameworkScores } from '@/types/raceAnalysis';
import type {
  CoachProfile as MarketplaceCoachProfile,
  CoachSearchFilters,
  CoachSearchResult,
  CoachRegistrationForm,
  CoachProfileResponse,
  SearchResponse,
  CoachDashboardData,
  StudentDashboardData,
  SailingSpecialty,
  SailorProfile,
  CoachingSession as MarketplaceCoachingSession,
  SessionReview,
} from '@/types/coach';

const logger = createLogger('CoachingService');

export interface CoachProfile {
  id: string;
  user_id: string;
  display_name?: string | null;
  profile_photo_url?: string | null;
  bio?: string;
  specialties: string[];
  experience_years?: number;
  certifications: string[];
  available_for_sessions: boolean;
  hourly_rate?: number;
  currency: string;
  based_at?: string;
  available_locations?: string[];
  total_sessions: number;
  total_clients: number;
  average_rating?: number;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface SailorSummary {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  primary_boat_class?: string | null;
}

export interface CoachingClient {
  id: string;
  coach_id: string;
  sailor_id: string;
  status: 'active' | 'inactive' | 'completed';
  goals?: string;
  skill_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  primary_boat_class?: string;
  first_session_date?: string;
  last_session_date?: string;
  total_sessions: number;
  coach_notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  sailor?: {
    id: string;
    email?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface CoachingSession {
  id: string;
  coach_id: string;
  sailor_id: string;
  client_id?: string;
  session_type: 'on_water' | 'video_review' | 'strategy' | 'boat_setup' | 'fitness' | 'mental_coaching';
  duration_minutes: number;
  scheduled_at?: string;
  start_time?: string;
  end_time?: string;
  started_at?: string;
  completed_at?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'confirmed' | 'pending';
  venue_id?: string;
  location_notes?: string;
  focus_areas?: string[];
  goals?: string;
  pre_session_notes?: string;
  session_notes?: string;
  homework?: string;
  video_urls?: string[];
  document_ids?: string[];
  fee_amount?: number;
  currency: string;
  paid: boolean;
  payment_date?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  sailor?: {
    id: string;
    email?: string;
    full_name?: string;
    avatar_url?: string;
  };
  venue?: {
    id: string;
    name: string;
  };
  coach?: {
    id: string;
    display_name?: string | null;
    profile_photo_url?: string | null;
  } | null;
  feedback?: SessionFeedback;
}

export interface SessionFeedback {
  id: string;
  session_id: string;
  rating: number;
  feedback_text?: string;
  communication_rating?: number;
  expertise_rating?: number;
  value_rating?: number;
  skill_improvement?: 'significant' | 'moderate' | 'slight' | 'none';
  confidence_change?: 'increased' | 'same' | 'decreased';
  would_recommend?: boolean;
  public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientProgressMetric {
  id: string;
  client_id: string;
  session_id?: string;
  metric_type: 'race_result' | 'skill_assessment' | 'boat_handling' | 'tactics' | 'starts' | 'boat_speed' | 'fitness';
  score: number;
  raw_value?: any;
  notes?: string;
  benchmark?: string;
  recorded_at: string;
  created_at: string;
}

export interface ClientStats {
  activeClients: number;
  totalSessions: number;
  sessionsThisMonth: number;
  upcomingSessions: number;
  averageRating?: number;
}

export interface ClientDetails extends CoachingClient {
  sessions: CoachingSession[];
  progressMetrics: ClientProgressMetric[];
  stats: {
    totalSessions: number;
    completedSessions: number;
    upcomingSessions: number;
    averageRating?: number;
    lastSessionDate?: string;
    nextSessionDate?: string;
  };
  recentRaceAnalysis?: SharedRaceAnalysisSummary[];
  recentRaceStrategies?: SharedRaceStrategySummary[];
}

export interface SharedRaceAnalysisSummary {
  id: string;
  race_id: string;
  race_name?: string;
  regatta_name?: string;
  created_at: string;
  overall_satisfaction?: number;
  key_learnings?: string[];
  ai_coaching_feedback?: CoachingFeedback[];
  framework_scores?: FrameworkScores | null;
}

export interface SharedRaceStrategySummary {
  regatta_id: string;
  regatta_name?: string;
  generated_at?: string;
  strategy_type?: string | null;
  favored_end?: string | null;
  wind_strategy?: string | null;
  confidence_score?: number | null;
  strategy_content?: any;
}

export type CoachTransactionStatus =
  | 'scheduled'
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'refunded'
  | 'requires_action';

export interface CoachEarningsTransaction {
  id: string;
  clientName: string;
  sessionType: string;
  status: CoachTransactionStatus;
  paymentStatus?: string | null;
  amount: number;
  currency: string;
  date: string | null;
  payoutDate?: string | null;
}

export interface PeriodEarningsStats {
  total: number;
  sessions: number;
  averagePerSession: number;
}

export interface CoachEarningsSummary {
  period: {
    week: { current: PeriodEarningsStats; previous: PeriodEarningsStats };
    month: { current: PeriodEarningsStats; previous: PeriodEarningsStats };
    year: { current: PeriodEarningsStats; previous: PeriodEarningsStats };
  };
  totals: {
    lifetime: number;
    sessions: number;
    averagePerSession: number;
    pendingPayouts: number;
    nextPayoutDate: string | null;
  };
  breakdown: Record<string, number>;
  transactions: CoachEarningsTransaction[];
  pendingTransactions: CoachEarningsTransaction[];
}

/**
 * Custom charge definition for add-on fees
 */
interface CustomCharge {
  id: string;
  label: string;
  amount_cents: number;
  description?: string;
  is_active: boolean;
  session_types?: string[]; // If specified, only applies to these session types
}

class CoachingService {
  /**
   * Get authenticated user with session refresh.
   * Attempts to refresh the session if the token is expired.
   * Returns the user object, or null if authentication fails entirely.
   */
  private async getAuthenticatedUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user) return user;

    // Token may be expired — try refreshing
    if (error) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.user) {
        logger.warn('[CoachingService] Session refresh failed:', refreshError?.message || 'No user after refresh');
        return null;
      }
      return refreshData.user;
    }

    return null;
  }

  /**
   * Get authenticated user, throwing if not authenticated.
   * Use this in methods that require authentication.
   */
  private async requireAuth() {
    const user = await this.getAuthenticatedUser();
    if (!user) {
      throw new Error('Not authenticated. Please sign in again.');
    }
    return user;
  }

  /**
   * Get coach profile for current user
   */
  async getCoachProfile(userId: string): Promise<CoachProfile | null> {
    const { data, error } = await supabase
      .from('coach_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error('Error fetching coach profile:', error);
      return null;
    }

    return data;
  }

  /**
   * Get coach statistics
   */
  async getCoachStats(coachId: string): Promise<ClientStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [clientsResult, sessionsResult, monthSessionsResult, upcomingResult, coachSessionIdsResult] = await Promise.all([
      // Active clients count
      supabase
        .from('coaching_clients')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .eq('status', 'active'),

      // Total sessions
      supabase
        .from('coaching_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .eq('status', 'completed'),

      // Sessions this month
      supabase
        .from('coaching_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth.toISOString()),

      // Upcoming sessions (include confirmed and pending statuses too)
      supabase
        .from('coaching_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .in('status', ['scheduled', 'confirmed', 'pending'])
        .gte('scheduled_at', now.toISOString()),

      // Get session IDs for this coach (for feedback lookup)
      supabase
        .from('coaching_sessions')
        .select('id')
        .eq('coach_id', coachId)
    ]);

    // Get feedback only for this coach's sessions (server-side filtered)
    const coachSessionIds = (coachSessionIdsResult.data || []).map(s => s.id);
    let averageRating: number | undefined = undefined;
    if (coachSessionIds.length > 0) {
      const { data: coachFeedback } = await supabase
        .from('session_feedback')
        .select('rating')
        .in('session_id', coachSessionIds);

      if (coachFeedback && coachFeedback.length > 0) {
        averageRating = coachFeedback.reduce((sum, f) => sum + f.rating, 0) / coachFeedback.length;
      }
    }

    return {
      activeClients: clientsResult.count || 0,
      totalSessions: sessionsResult.count || 0,
      sessionsThisMonth: monthSessionsResult.count || 0,
      upcomingSessions: upcomingResult.count || 0,
      averageRating
    };
  }

  /**
   * Build an earnings + payouts snapshot for the earnings tab
   */
  async getCoachEarningsSummary(coachId: string): Promise<CoachEarningsSummary> {
    if (!coachId) {
      throw new Error('coachId is required to load earnings');
    }

    const { data: sessionRows, error } = await supabase
      .from('coaching_sessions')
      .select(`
        id,
        sailor_id,
        session_type,
        status,
        payment_status,
        fee_amount,
        total_amount,
        coach_payout,
        currency,
        scheduled_at,
        completed_at,
        created_at
      `)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching coach sessions for earnings summary:', error);
      throw error;
    }

    const amountOrZero = (value?: number | null, fallback?: number | null) => {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
      }
      if (typeof fallback === 'number' && !Number.isNaN(fallback)) {
        return fallback;
      }
      return 0;
    };

    const computePlatformFee = (session: {
      platform_fee?: number | null;
      total_amount?: number | null;
      fee_amount?: number | null;
      coach_payout?: number | null;
    }) => {
      if (typeof session.platform_fee === 'number' && !Number.isNaN(session.platform_fee)) {
        return session.platform_fee;
      }
      const total = amountOrZero(session.total_amount, session.fee_amount);
      const payout = amountOrZero(session.coach_payout, total > 0 ? Math.round(total * 0.85) : undefined);
      const fee = total - payout;
      return fee > 0 ? fee : 0;
    };

    const sessions = (sessionRows || []).map(session => ({
      ...session,
      platform_fee: computePlatformFee(session),
    }));
    const sailorIds = Array.from(new Set(sessions.map(row => row.sailor_id).filter(Boolean))) as string[];

    let sailorMap = new Map<string, { id: string; full_name?: string | null; email?: string | null }>();
    if (sailorIds.length > 0) {
      const { data: sailors, error: sailorsError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', sailorIds);

      if (sailorsError) {
        logger.warn('[CoachingService.getCoachEarningsSummary] Failed to fetch sailor details:', sailorsError.message);
      } else if (sailors) {
        sailorMap = new Map(sailors.map(s => [s.id, s]));
      }
    }

    const resolveDate = (value?: string | null) => (value ? new Date(value) : null);

    const paidStates = new Set(['captured', 'paid']);
    const now = new Date();

    const completedPaidSessions = sessions.filter(session =>
      paidStates.has(session.payment_status ?? '') && amountOrZero(session.coach_payout, session.fee_amount) > 0
    );

    const lifetimeEarnings = completedPaidSessions.reduce(
      (sum, session) => sum + amountOrZero(session.coach_payout, session.total_amount ? Math.round(session.total_amount * 0.85) : session.fee_amount),
      0
    );

    const lifetimeSessions = completedPaidSessions.length;
    const averagePerSession = lifetimeSessions > 0 ? lifetimeEarnings / lifetimeSessions : 0;

    const nextPayoutDate = (() => {
      const payout = new Date(now);
      const daysUntilFriday = ((5 - payout.getDay() + 7) % 7) || 7;
      payout.setDate(payout.getDate() + daysUntilFriday);
      payout.setHours(9, 0, 0, 0);
      return payout.toISOString();
    })();

    const makeStatsForRange = (start: Date, end: Date): PeriodEarningsStats => {
      const bucket = completedPaidSessions.filter(session => {
        const date = resolveDate(session.completed_at) || resolveDate(session.scheduled_at) || resolveDate(session.created_at);
        if (!date) return false;
        return date >= start && date < end;
      });

      const total = bucket.reduce((sum, session) => sum + amountOrZero(session.coach_payout, session.fee_amount), 0);
      const sessionsCount = bucket.length;

      return {
        total,
        sessions: sessionsCount,
        averagePerSession: sessionsCount > 0 ? total / sessionsCount : 0,
      };
    };

    const daysAgo = (days: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() - days);
      return date;
    };

    const weekStart = daysAgo(7);
    const prevWeekStart = daysAgo(14);
    const weekStats = makeStatsForRange(weekStart, now);
    const prevWeekStats = makeStatsForRange(prevWeekStart, weekStart);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthStats = makeStatsForRange(monthStart, now);
    const prevMonthStats = makeStatsForRange(prevMonthStart, monthStart);

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const yearStats = makeStatsForRange(yearStart, now);
    const prevYearStats = makeStatsForRange(prevYearStart, yearStart);

    const breakdown = sessions.reduce<Record<string, number>>((acc, session) => {
      const key = session.session_type || 'other';
      acc[key] = (acc[key] || 0) + amountOrZero(session.coach_payout, session.fee_amount);
      return acc;
    }, {});

    const deriveStatus = (session: any): CoachTransactionStatus => {
      if (session.payment_status === 'refunded') {
        return 'refunded';
      }
      if (session.status === 'cancelled') {
        return 'cancelled';
      }
      if (session.status === 'completed' && paidStates.has(session.payment_status ?? '')) {
        const completedDate = resolveDate(session.completed_at) || resolveDate(session.scheduled_at) || resolveDate(session.created_at);
        if (completedDate && (now.getTime() - completedDate.getTime()) > 7 * 24 * 60 * 60 * 1000) {
          return 'paid';
        }
        return 'pending';
      }
      if (session.payment_status === 'requires_action') {
        return 'requires_action';
      }
      return 'scheduled';
    };

    const buildTransaction = (session: any): CoachEarningsTransaction => {
      const sailor = session.sailor_id ? sailorMap.get(session.sailor_id) : null;
      const clientName = sailor?.full_name || sailor?.email || 'Unassigned Sailor';
      const status = deriveStatus(session);

      return {
        id: session.id,
        clientName,
        sessionType: session.session_type || 'Coaching Session',
        status,
        paymentStatus: session.payment_status,
        amount: amountOrZero(session.coach_payout, session.fee_amount),
        currency: session.currency || 'USD',
        date: session.completed_at || session.scheduled_at || session.created_at,
        payoutDate: status === 'pending' ? nextPayoutDate : null,
      };
    };

    const allTransactions = sessions.map(buildTransaction);
    const transactions: CoachEarningsTransaction[] = allTransactions.slice(0, 30);

    const pendingTransactions: CoachEarningsTransaction[] = allTransactions
      .filter(txn => txn.status === 'pending' || txn.status === 'requires_action')
      .slice(0, 20);

    const pendingPayouts = pendingTransactions
      .filter(txn => txn.status === 'pending')
      .reduce((sum, txn) => sum + txn.amount, 0);

    return {
      period: {
        week: { current: weekStats, previous: prevWeekStats },
        month: { current: monthStats, previous: prevMonthStats },
        year: { current: yearStats, previous: prevYearStats },
      },
      totals: {
        lifetime: lifetimeEarnings,
        sessions: lifetimeSessions,
        averagePerSession,
        pendingPayouts,
        nextPayoutDate,
      },
      breakdown,
      transactions,
      pendingTransactions,
    };
  }

  /**
   * Get all clients for a coach
   */
  async getClients(coachId: string, status?: 'active' | 'inactive' | 'completed'): Promise<CoachingClient[]> {
    // WORKAROUND: Until foreign keys are added to coaching_clients table,
    // fetch clients and users separately, then join in code

    let clientsQuery = supabase
      .from('coaching_clients')
      .select('*')
      .eq('coach_id', coachId)
      .order('last_session_date', { ascending: false, nullsFirst: false });

    if (status) {
      clientsQuery = clientsQuery.eq('status', status);
    }

    const { data: clients, error: clientsError } = await clientsQuery;

    if (clientsError) {
      logger.error('Error fetching clients:', clientsError);
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      return [];
    }

    // Get sailor IDs
    const sailorIds = clients.map(c => c.sailor_id).filter(Boolean);

    if (sailorIds.length === 0) {
      return clients as CoachingClient[];
    }

    // Fetch sailor data separately
    const { data: sailors, error: sailorsError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', sailorIds);

    if (sailorsError) {
      logger.error('Error fetching sailors:', sailorsError);
      // Return clients without sailor data rather than failing
      return clients as CoachingClient[];
    }

    // Join in code
    const sailorMap = new Map(sailors?.map(s => [s.id, s]) || []);

    const result = clients.map(client => ({
      ...client,
      sailor: client.sailor_id ? sailorMap.get(client.sailor_id) : undefined,
    })) as CoachingClient[];

    return result;
  }

  /**
   * Get detailed client information with sessions and progress
   */
  async getClientDetails(clientId: string): Promise<ClientDetails | null> {
    const [clientResult, sessionsResult, metricsResult] = await Promise.all([
      // Client info (fetch sailor separately because FK isn't defined in Supabase)
      supabase
        .from('coaching_clients')
        .select('*')
        .eq('id', clientId)
        .single(),

      // All sessions (without JOINs for now - foreign keys not set up)
      supabase
        .from('coaching_sessions')
        .select('*')
        .eq('client_id', clientId)
        .order('scheduled_at', { ascending: false }),

      // Progress metrics
      supabase
        .from('client_progress_metrics')
        .select('*')
        .eq('client_id', clientId)
        .order('recorded_at', { ascending: false })
    ]);

    if (clientResult.error) {
      logger.error('Error fetching client:', clientResult.error);
      return null;
    }

    const rawClient = clientResult.data;

    if (!rawClient) {
      return null;
    }

    let clientSailor:
      | {
          id: string;
          email?: string;
          full_name?: string;
          avatar_url?: string;
        }
      | undefined;

    if (rawClient.sailor_id) {
      const { data: sailorData, error: sailorError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', rawClient.sailor_id)
        .maybeSingle();

      if (sailorError && sailorError.code !== 'PGRST116') {
        logger.warn('[CoachingService] Failed to load sailor profile for client', sailorError);
      } else if (sailorData) {
        clientSailor = sailorData;
      }
    }

    const sessions = sessionsResult.error ? [] : (sessionsResult.data || []);
    if (sessionsResult.error) {
      logger.warn('[CoachingService] Failed to load sessions for client', clientId, sessionsResult.error);
    }

    const progressMetrics = metricsResult.error ? [] : (metricsResult.data || []);
    if (metricsResult.error) {
      logger.warn('[CoachingService] Failed to load progress metrics for client', clientId, metricsResult.error);
    }

    const completedSessions = sessions.filter((session: CoachingSession & { completed_at?: string }) => session.status === 'completed');
    const upcomingSessions = sessions.filter((session: CoachingSession & { scheduled_at?: string }) => session.status === 'scheduled' && new Date(session.scheduled_at || '') > new Date());

    const feedbacks = sessions
      .map((session: CoachingSession) => session.feedback)
      .filter((feedback): feedback is SessionFeedback => Boolean(feedback));
    const averageRating = feedbacks.length > 0
      ? feedbacks.reduce((sum: number, feedback: SessionFeedback) => sum + (feedback.rating || 0), 0) / feedbacks.length
      : undefined;

    const lastSession = completedSessions.find(s => s.completed_at);
    const nextSession = upcomingSessions.find(s => s.scheduled_at);

    let recentRaceAnalysis: SharedRaceAnalysisSummary[] = [];
    let recentRaceStrategies: SharedRaceStrategySummary[] = [];

    try {
      const sailorUserId = rawClient?.sailor_id;

      if (sailorUserId) {
        const { data: sailorProfile } = await supabase
          .from('sailor_profiles')
          .select('id')
          .eq('user_id', sailorUserId)
          .maybeSingle();

        if (sailorProfile?.id) {
          let analysisRows: any[] = [];
          const primaryAnalysis = await supabase
            .from('race_analysis')
            .select(`
              id,
              race_id,
              created_at,
              overall_satisfaction,
              key_learnings,
              ai_coaching_feedback,
              framework_scores
            `)
            .eq('sailor_id', sailorProfile.id)
            .order('created_at', { ascending: false })
            .limit(5);

          if (!primaryAnalysis.error && primaryAnalysis.data) {
            analysisRows = primaryAnalysis.data;
          } else if (isMissingIdColumn(primaryAnalysis.error, 'race_analysis', 'race_id')) {
            const fallbackAnalysis = await supabase
              .from('race_analysis')
              .select(`
                id,
                regatta_id,
                created_at,
                overall_satisfaction,
                key_learnings,
                ai_coaching_feedback,
                framework_scores
              `)
              .eq('sailor_id', sailorProfile.id)
              .order('created_at', { ascending: false })
              .limit(5);
            analysisRows = fallbackAnalysis.data || [];
          }

          const raceIds = (analysisRows || [])
            .map((row: any) => row.race_id || row.regatta_id)
            .filter(Boolean);
          let raceMeta = new Map<string, { race_name?: string; regatta_name?: string }>();

          if (raceIds.length > 0) {
            const { data: racesData } = await supabase
              .from('regatta_races')
              .select(`
                id,
                race_name,
                regatta:regatta_id(name)
              `)
              .in('id', raceIds);

            racesData?.forEach((race: any) => {
              raceMeta.set(race.id, {
                race_name: race.race_name,
                regatta_name: race.regatta?.name,
              });
            });

            // Fallback when IDs refer to regattas instead of regatta_races
            const unresolvedRaceIds = raceIds.filter((id: string) => !raceMeta.has(id));
            if (unresolvedRaceIds.length > 0) {
              const { data: regattaRows } = await supabase
                .from('regattas')
                .select('id, name')
                .in('id', unresolvedRaceIds);
              regattaRows?.forEach((regatta: any) => {
                raceMeta.set(regatta.id, {
                  race_name: regatta.name,
                  regatta_name: regatta.name,
                });
              });
            }
          }

          recentRaceAnalysis = (analysisRows || []).map((row: any) => {
            const raceRef = row.race_id || row.regatta_id;
            const meta = raceMeta.get(raceRef) || {};
            return {
              id: row.id,
              race_id: raceRef,
              created_at: row.created_at,
              overall_satisfaction: row.overall_satisfaction,
              key_learnings: row.key_learnings || [],
              ai_coaching_feedback: row.ai_coaching_feedback || [],
              framework_scores: row.framework_scores || null,
              race_name: meta.race_name,
              regatta_name: meta.regatta_name,
            };
          });
        }

        const { data: strategyRows, error: strategyError } = await supabase
          .from('race_strategies')
          .select(`
            regatta_id,
            generated_at,
            strategy_type,
            favored_end,
            wind_strategy,
            confidence_score,
            strategy_content
          `)
          .eq('user_id', sailorUserId)
          .order('generated_at', { ascending: false })
          .limit(5);

        if (strategyError) {
          logger.warn('[CoachingService] Failed to load race strategies for sailor', sailorUserId, strategyError);
        }

        if (!strategyError && strategyRows?.length) {
          const regattaIds = strategyRows.map((row: any) => row.regatta_id).filter(Boolean);
          let regattaMeta = new Map<string, string>();

          if (regattaIds.length > 0) {
            const { data: regattaRows } = await supabase
              .from('regattas')
              .select('id, name')
              .in('id', regattaIds);

            regattaRows?.forEach((regatta: any) => {
              regattaMeta.set(regatta.id, regatta.name);
            });
          }

          recentRaceStrategies = strategyRows.map((row: any) => ({
            regatta_id: row.regatta_id,
            regatta_name: regattaMeta.get(row.regatta_id) || undefined,
            generated_at: row.generated_at,
            strategy_type: row.strategy_type,
            favored_end: row.favored_end,
            wind_strategy: row.wind_strategy,
            confidence_score: row.confidence_score,
            strategy_content: row.strategy_content,
          }));
        }
      }
    } catch (error) {
      logger.error('Error loading shared race insights:', error);
    }

    return {
      ...rawClient,
      sailor: clientSailor,
      sessions,
      progressMetrics,
      stats: {
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        upcomingSessions: upcomingSessions.length,
        averageRating,
        lastSessionDate: lastSession?.completed_at,
        nextSessionDate: nextSession?.scheduled_at
      },
      recentRaceAnalysis,
      recentRaceStrategies,
    };
  }

  /**
   * Get sessions for a client
   */
  async getClientSessions(
    clientId: string,
    options?: {
      status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
      limit?: number;
    }
  ): Promise<CoachingSession[]> {
    let query = supabase
      .from('coaching_sessions')
      .select(`
        *,
        sailor:sailor_id (
          id,
          email,
          full_name,
          avatar_url
        ),
        venue:sailing_venues (
          id,
          name
        ),
        feedback:session_feedback (*)
      `)
      .eq('client_id', clientId)
      .order('scheduled_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching sessions:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Create a new client relationship
   */
  async createClient(
    coachId: string,
    sailorId: string,
    details: Partial<CoachingClient>
  ): Promise<CoachingClient> {
    const { data, error } = await supabase
      .from('coaching_clients')
      .insert({
        coach_id: coachId,
        sailor_id: sailorId,
        ...details
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating client:', error);
      throw error;
    }

    return data;
  }

  /**
   * Search for sailors by name or email to attach to a coach
   */
  async searchSailors(query: string): Promise<SailorSummary[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return [];
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, primary_boat_class')
      .or(`email.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%`)
      .limit(10);

    if (error) {
      logger.error('Error searching sailors:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Update client details
   */
  async updateClient(clientId: string, updates: Partial<CoachingClient>): Promise<CoachingClient> {
    const { data, error } = await supabase
      .from('coaching_clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating client:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create a new coaching session
   */
  async createSession(sessionData: Partial<CoachingSession>): Promise<CoachingSession> {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      logger.error('Error creating session:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update coaching session
   */
  async updateSession(sessionId: string, updates: Partial<CoachingSession>): Promise<CoachingSession> {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating session:', error);
      throw error;
    }

    return data;
  }

  /**
   * Add session feedback
   */
  async addSessionFeedback(
    sessionId: string,
    feedback: Partial<SessionFeedback>
  ): Promise<SessionFeedback> {
    const { data, error } = await supabase
      .from('session_feedback')
      .insert({
        session_id: sessionId,
        ...feedback
      })
      .select()
      .single();

    if (error) {
      logger.error('Error adding feedback:', error);
      throw error;
    }

    return data;
  }

  /**
   * Add progress metric for a client
   */
  async addProgressMetric(
    clientId: string,
    metric: Partial<ClientProgressMetric>
  ): Promise<ClientProgressMetric> {
    const { data, error } = await supabase
      .from('client_progress_metrics')
      .insert({
        client_id: clientId,
        ...metric
      })
      .select()
      .single();

    if (error) {
      logger.error('Error adding progress metric:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get progress metrics for a client
   */
  async getClientProgress(
    clientId: string,
    metricType?: string
  ): Promise<ClientProgressMetric[]> {
    let query = supabase
      .from('client_progress_metrics')
      .select('*')
      .eq('client_id', clientId)
      .order('recorded_at', { ascending: true });

    if (metricType) {
      query = query.eq('metric_type', metricType);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching progress metrics:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get upcoming sessions for coach
   */
  async getUpcomingSessions(coachId: string, limit: number = 10): Promise<CoachingSession[]> {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select(`
        *,
        sailor:sailor_id (
          id,
          email,
          full_name,
          avatar_url
        ),
        venue:sailing_venues (
          id,
          name
        )
      `)
      .eq('coach_id', coachId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error('Error fetching upcoming sessions:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get recent sessions for coach
   */
  async getRecentSessions(coachId: string, limit: number = 10): Promise<CoachingSession[]> {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select(`
        *,
        sailor:sailor_id (
          id,
          email,
          full_name,
          avatar_url
        ),
        venue:sailing_venues (
          id,
          name
        ),
        feedback:session_feedback (*)
      `)
      .eq('coach_id', coachId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching recent sessions:', error);
      throw error;
    }

    return data || [];
  }

  // ============================================================================
  // Sailor Coach Relationships (sailor perspective)
  // ============================================================================

  /**
   * Get all coaching relationships for a sailor, with coach profile data.
   * Mirrors getClients() but from the sailor's perspective.
   */
  async getSailorCoachRelationships(
    sailorId: string,
    status?: 'active' | 'inactive' | 'completed'
  ): Promise<(CoachingClient & { coachProfile?: CoachProfile })[]> {
    let query = supabase
      .from('coaching_clients')
      .select('*')
      .eq('sailor_id', sailorId)
      .order('last_session_date', { ascending: false, nullsFirst: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: clients, error: clientsError } = await query;

    if (clientsError) {
      logger.error('Error fetching sailor coach relationships:', clientsError);
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      return [];
    }

    // Get unique coach IDs
    const coachIds = Array.from(new Set(clients.map(c => c.coach_id).filter(Boolean)));

    if (coachIds.length === 0) {
      return clients as (CoachingClient & { coachProfile?: CoachProfile })[];
    }

    // Fetch coach profile data
    const { data: coaches, error: coachesError } = await supabase
      .from('coach_profiles')
      .select('*')
      .in('id', coachIds);

    if (coachesError) {
      logger.error('Error fetching coach profiles for relationships:', coachesError);
      return clients as (CoachingClient & { coachProfile?: CoachProfile })[];
    }

    const coachMap = new Map((coaches || []).map(c => [c.id, c]));

    return clients.map(client => ({
      ...client,
      coachProfile: client.coach_id ? coachMap.get(client.coach_id) || undefined : undefined,
    })) as (CoachingClient & { coachProfile?: CoachProfile })[];
  }

  // ============================================================================
  // Coach Availability Management (NEW)
  // ============================================================================

  /**
   * Create availability slot for coach
   */
  async createAvailabilitySlot(
    coachId: string,
    startTime: Date,
    endTime: Date,
    options?: {
      recurringPattern?: 'none' | 'weekly' | 'biweekly' | 'monthly';
      notes?: string;
    }
  ): Promise<any> {
    const { data, error } = await supabase
      .from('coach_availability')
      .insert({
        coach_id: coachId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        is_active: true,
        recurring_pattern: options?.recurringPattern || 'none',
        notes: options?.notes,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating availability slot:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get coach availability slots
   */
  async getAvailabilitySlots(
    coachId: string,
    startDate?: Date,
    endDate?: Date,
    availableOnly: boolean = true
  ): Promise<any[]> {
    // Note: coach_availability uses day_of_week + time columns for recurring availability,
    // not timestamp columns. We query all slots and filter in memory if needed.
    let query = supabase
      .from('coach_availability')
      .select('*')
      .eq('coach_id', coachId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (availableOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching availability slots:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Update availability slot
   */
  async updateAvailabilitySlot(
    slotId: string,
    updates: {
      startTime?: Date;
      endTime?: Date;
      isAvailable?: boolean;
      notes?: string;
    }
  ): Promise<any> {
    const updateData: any = {};

    if (updates.startTime) updateData.start_time = updates.startTime.toISOString();
    if (updates.endTime) updateData.end_time = updates.endTime.toISOString();
    if (updates.isAvailable !== undefined) updateData.is_active = updates.isAvailable;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data, error } = await supabase
      .from('coach_availability')
      .update(updateData)
      .eq('id', slotId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating availability slot:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete availability slot
   */
  async deleteAvailabilitySlot(slotId: string): Promise<void> {
    const { error } = await supabase
      .from('coach_availability')
      .delete()
      .eq('id', slotId);

    if (error) {
      logger.error('Error deleting availability slot:', error);
      throw error;
    }
  }

  // ============================================================================
  // Session Booking Management (NEW)
  // ============================================================================

  /**
   * Create booking request (Sailor side)
   */
  async createBookingRequest(
    coachId: string,
    requestedStartTime: Date,
    requestedEndTime: Date,
    options: {
      sessionType: 'one_on_one' | 'group' | 'video_analysis' | 'race_debrief';
      message?: string;
      availabilitySlotId?: string;
      totalAmountCents: number;
      customCharges?: CustomCharge[];
    }
  ): Promise<any> {
    const user = await this.requireAuth();

    const { data, error } = await supabase
      .from('session_bookings')
      .insert({
        sailor_id: user.id,
        coach_id: coachId,
        requested_start_time: requestedStartTime.toISOString(),
        requested_end_time: requestedEndTime.toISOString(),
        session_type: options.sessionType,
        sailor_message: options.message,
        availability_slot_id: options.availabilitySlotId,
        total_amount_cents: options.totalAmountCents,
        status: 'pending',
      })
      .select(`
        *,
        coach:coach_profiles!coach_id (
          display_name,
          user_id,
          users!coach_profiles_user_id_fkey (
            email,
            full_name
          )
        ),
        sailor:users!sailor_id (
          email,
          full_name
        )
      `)
      .single();

    if (error) {
      logger.error('Error creating booking request:', error);
      throw error;
    }

    // Send notification to coach
    if (data?.coach?.users?.email) {
      const { emailService } = await import('./EmailService');
      await emailService.sendCoachNotification({
        coach_name: data.coach.users.full_name || data.coach.display_name || 'Coach',
        coach_email: data.coach.users.email,
        notification_type: 'new_booking',
        sailor_name: data.sailor?.full_name || 'Sailor',
        session_date: requestedStartTime.toISOString(),
        message: options.message,
      });
    }

    // Send push notification to coach
    if (data?.coach?.user_id) {
      const { PushNotificationService } = await import('./PushNotificationService');
      const sailorName = data.sailor?.full_name || 'A sailor';
      const dateStr = requestedStartTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      PushNotificationService.sendPushNotification(
        data.coach.user_id,
        'New Session Request',
        `${sailorName} requested a session for ${dateStr}`,
        { type: 'new_booking', route: '/(tabs)/schedule', booking_id: data.id },
        'booking_requests'
      ).catch(() => {});
    }

    return data;
  }

  /**
   * Get booking requests for sailor
   */
  async getSailorBookingRequests(status?: string): Promise<any[]> {
    const user = await this.requireAuth();

    let query = supabase
      .from('session_bookings')
      .select(`
        *,
        coach:coach_profiles!coach_id (
          id,
          display_name,
          profile_photo_url:profile_image_url,
          hourly_rate_usd
        )
      `)
      .eq('sailor_id', user.id)
      .order('requested_start_time', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching sailor booking requests:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get coaching sessions for a sailor (confirmed/completed)
   */
  async getSailorSessions(status?: 'scheduled' | 'completed' | 'pending'): Promise<CoachingSession[]> {
    const user = await this.requireAuth();

    let query = supabase
      .from('coaching_sessions')
      .select(`
        *,
        coach:coach_profiles!coach_id (
          id,
          display_name,
          profile_photo_url:profile_image_url
        )
      `)
      .eq('sailor_id', user.id)
      .order(status === 'scheduled' ? 'scheduled_at' : 'completed_at', { ascending: false, nullsFirst: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching sailor sessions:', error);
      throw error;
    }

    return (data as CoachingSession[]) || [];
  }

  /**
   * Get booking requests for coach
   */
  async getCoachBookingRequests(coachId: string, status?: string): Promise<any[]> {
    let query = supabase
      .from('session_bookings')
      .select(`
        *,
        sailor:auth.users!sailor_id (
          id,
          email
        )
      `)
      .eq('coach_id', coachId)
      .order('requested_start_time', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching coach booking requests:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Accept booking request (Coach side)
   */
  async acceptBookingRequest(bookingId: string): Promise<string> {
    const user = await this.requireAuth();

    // Get booking details before accepting
    const { data: booking } = await supabase
      .from('session_bookings')
      .select(`
        *,
        coach:coach_profiles!coach_id (
          display_name,
          user_id,
          users!coach_profiles_user_id_fkey (
            email
          )
        ),
        sailor:users!sailor_id (
          email,
          full_name
        )
      `)
      .eq('id', bookingId)
      .single();

    const { data, error } = await supabase.rpc('accept_booking', {
      p_booking_id: bookingId,
      p_coach_user_id: user.id,
    });

    if (error) {
      logger.error('Error accepting booking:', error);
      throw error;
    }

    // Send confirmation emails to both sailor and coach
    if (booking) {
      const { emailService } = await import('./EmailService');
      const { calendarService } = await import('./CalendarService');

      // Generate calendar file
      const calendarFile = calendarService.generateCoachingSessionCalendar({
        coachName: booking.coach?.display_name || 'Coach',
        coachEmail: booking.coach?.users?.email || '',
        sailorName: booking.sailor?.full_name || 'Sailor',
        sailorEmail: booking.sailor?.email || '',
        sessionType: booking.session_type,
        scheduledDate: booking.requested_start_time,
        durationMinutes: Math.round((new Date(booking.requested_end_time).getTime() - new Date(booking.requested_start_time).getTime()) / 60000),
        location: booking.location || 'TBD',
      });

      const emailData = {
        sailor_name: booking.sailor?.full_name || 'Sailor',
        sailor_email: booking.sailor?.email || '',
        coach_name: booking.coach?.display_name || 'Coach',
        coach_email: booking.coach?.users?.email || '',
        session_type: booking.session_type,
        scheduled_date: booking.requested_start_time,
        duration_minutes: Math.round((new Date(booking.requested_end_time).getTime() - new Date(booking.requested_start_time).getTime()) / 60000),
        location: booking.location || 'TBD',
        fee_amount: booking.total_amount_cents / 100,
        currency: 'USD',
        calendar_attachment: calendarFile,
      };

      // Send to sailor
      await emailService.sendCoachBookingConfirmationToSailor(emailData);

      // Send to coach
      await emailService.sendCoachBookingConfirmationToCoach(emailData);

      // Send system message in the coach-sailor conversation
      try {
        const { messagingService } = await import('./MessagingService');
        const sessionDate = booking.requested_start_time
          ? new Date(booking.requested_start_time).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            })
          : 'TBD';
        const sessionTime = booking.requested_start_time
          ? new Date(booking.requested_start_time).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit',
            })
          : '';
        await messagingService.sendSystemMessage(
          booking.coach?.user_id || user.id,
          booking.sailor_id,
          `Session booked for ${sessionDate}${sessionTime ? ` at ${sessionTime}` : ''}`,
          { booking_id: bookingId, session_id: data }
        );
      } catch (msgError) {
        logger.error('[acceptBookingRequest] Messaging error (non-fatal):', msgError);
      }

      // Send push notification to sailor
      try {
        const { PushNotificationService } = await import('./PushNotificationService');
        const coachName = booking.coach?.display_name || 'Your coach';
        const dateStr = booking.requested_start_time
          ? new Date(booking.requested_start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        PushNotificationService.sendPushNotification(
          booking.sailor_id,
          'Booking Confirmed',
          `${coachName} accepted your session request${dateStr ? ` for ${dateStr}` : ''}`,
          { type: 'booking_accepted', route: '/coach/my-bookings', booking_id: bookingId, session_id: data },
          'booking_requests'
        ).catch(() => {});
      } catch (pushError) {
        logger.error('[acceptBookingRequest] Push error (non-fatal):', pushError);
      }
    }

    return data; // Returns session ID
  }

  /**
   * Reject booking request (Coach side)
   */
  async rejectBookingRequest(bookingId: string, response: string): Promise<void> {
    const user = await this.requireAuth();

    // Get booking details before rejecting (for notification)
    const { data: booking } = await supabase
      .from('session_bookings')
      .select(`
        sailor_id,
        coach:coach_profiles!coach_id (display_name)
      `)
      .eq('id', bookingId)
      .single();

    const { error } = await supabase.rpc('reject_booking', {
      p_booking_id: bookingId,
      p_coach_user_id: user.id,
      p_response: response,
    });

    if (error) {
      logger.error('Error rejecting booking:', error);
      throw error;
    }

    // Send push notification to sailor
    if (booking?.sailor_id) {
      const { PushNotificationService } = await import('./PushNotificationService');
      const coachName = (booking.coach as any)?.display_name || 'Your coach';
      PushNotificationService.sendPushNotification(
        booking.sailor_id,
        'Booking Update',
        `${coachName} couldn't accommodate your request`,
        { type: 'booking_rejected', route: '/coach/discover', booking_id: bookingId },
        'booking_requests'
      ).catch(() => {});
    }
  }

  /**
   * Cancel booking request (Sailor side)
   */
  async cancelBookingRequest(bookingId: string, reason?: string): Promise<void> {
    // Get booking details
    const { data: booking } = await supabase
      .from('session_bookings')
      .select(`
        *,
        coach:coach_profiles!coach_id (
          display_name,
          user_id,
          users!coach_profiles_user_id_fkey (
            email,
            full_name
          )
        ),
        sailor:users!sailor_id (
          email,
          full_name
        )
      `)
      .eq('id', bookingId)
      .single();

    const { error } = await supabase
      .from('session_bookings')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      logger.error('Error cancelling booking:', error);
      throw error;
    }

    // Notify coach of cancellation
    if (booking?.coach?.users?.email) {
      const { emailService } = await import('./EmailService');
      await emailService.sendCoachNotification({
        coach_name: booking.coach.users.full_name || booking.coach.display_name || 'Coach',
        coach_email: booking.coach.users.email,
        notification_type: 'cancellation',
        sailor_name: booking.sailor?.full_name || 'Sailor',
        session_date: booking.requested_start_time,
        message: reason,
      });
    }
  }

  /**
   * Notify all active coaches when a sailor shares a new race analysis
   */
  async notifyCoachesOfRaceAnalysis(params: {
    sailorUserId: string;
    sailorName?: string | null;
    raceId: string;
    raceName?: string;
    regattaName?: string;
    analysisSummary?: string | null;
    highlights?: string[];
  }): Promise<void> {
    try {
      const { data: clientRows, error: clientsError } = await supabase
        .from('coaching_clients')
        .select('id, status, coach_id')
        .eq('sailor_id', params.sailorUserId)
        .eq('status', 'active');

      if (clientsError) {
        throw clientsError;
      }

      if (!clientRows?.length) {
        return;
      }

      const coachIds = Array.from(
        new Set(
          clientRows
            .map((row: any) => row.coach_id)
            .filter((id: string | null | undefined): id is string => Boolean(id))
        )
      );

      if (coachIds.length === 0) {
        return;
      }

      const { data: coachProfiles, error: coachError } = await supabase
        .from('coach_profiles')
        .select(`
          id,
          display_name,
          user_id,
          users:coach_profiles_user_id_fkey (
            email,
            full_name
          )
        `)
        .in('id', coachIds);

      if (coachError) {
        throw coachError;
      }

      const coachesById = new Map(
        (coachProfiles || []).map((coach: any) => [coach.id, coach])
      );

      const activeCoaches = clientRows
        .map((row: any) => ({
          ...row,
          coach: coachesById.get(row.coach_id),
        }))
        .filter((row: any) => row.coach?.users?.email);

      if (activeCoaches.length === 0) {
        return;
      }

      const { emailService } = await import('./EmailService');

      await Promise.all(
        activeCoaches.map(async (row: any) => {
          const coachEmail = row.coach?.users?.email;
          if (!coachEmail) return;

          await emailService.sendCoachNotification({
            coach_name: row.coach?.display_name || row.coach?.users?.full_name || 'Coach',
            coach_email: coachEmail,
            notification_type: 'analysis_shared',
            sailor_name: params.sailorName || 'Sailor',
            race_name: params.raceName,
            regatta_name: params.regattaName,
            analysis_summary: params.analysisSummary || undefined,
            highlights: params.highlights,
          });
        })
      );
    } catch (error) {
      logger.error('Error notifying coaches of shared race analysis:', error);
    }
  }

  // ============================================================================
  // Coach Discovery (NEW)
  // ============================================================================

  /**
   * Discover coaches with filters
   */
  async discoverCoaches(filters?: {
    location?: string;
    specializations?: string[];
    minRating?: number;
    maxHourlyRate?: number;
    languages?: string[];
    boatClass?: string;
    timezone?: string;
    availability?: 'next_7_days' | 'next_30_days' | 'flexible';
    sessionType?: string;
  }): Promise<CoachProfile[]> {
    let query = supabase
      .from('coach_profiles')
      .select('*')
      .eq('is_verified', true)
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (filters?.location) {
      query = query.or(`based_at.eq.${filters.location},available_locations.cs.{${filters.location}}`);
    }

    if (filters?.minRating) {
      query = query.gte('rating', filters.minRating);
    }

    if (filters?.maxHourlyRate) {
      query = query.lte('hourly_rate', filters.maxHourlyRate);
    }

    if (filters?.specializations && filters.specializations.length > 0) {
      query = query.contains('specialties', filters.specializations);
    }

    if (filters?.boatClass) {
      query = query.contains('boat_classes_coached', [filters.boatClass]);
    }

    if (filters?.timezone) {
      query = query.eq('timezone', filters.timezone);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error discovering coaches:', error);
      throw error;
    }

    let coaches = data || [];

    // Filter by availability window
    if (filters?.availability) {
      const now = new Date();
      let endDate: Date;

      if (filters.availability === 'next_7_days') {
        endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (filters.availability === 'next_30_days') {
        endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else {
        // 'flexible' - check for availability in next 90 days
        endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      }

      // For each coach, check if they have availability in the time window
      const coachesWithAvailability = await Promise.all(
        coaches.map(async (coach: CoachProfile) => {
          const slots = await this.getAvailabilitySlots(coach.id, now, endDate, true);
          return slots.length > 0 ? coach : null;
        })
      );

      coaches = coachesWithAvailability.filter((coach): coach is CoachProfile => coach !== null);
    }

    return coaches;
  }

  /**
   * Get coach public profile with availability
   */
  async getCoachPublicProfile(coachId: string): Promise<any> {
    const [profileResult, availabilityResult] = await Promise.all([
      supabase
        .from('coach_profiles')
        .select('*')
        .eq('id', coachId)
        .eq('is_verified', true)
        .single(),

      supabase
        .from('coach_availability')
        .select('*')
        .eq('coach_id', coachId)
        .eq('is_active', true)
        .order('start_time', { ascending: true })
        .limit(10),
    ]);

    if (profileResult.error) {
      logger.error('Error fetching coach profile:', profileResult.error);
      throw profileResult.error;
    }

    return {
      ...profileResult.data,
      availableSlots: availabilityResult.data || [],
    };
  }

  // ============================================================================
  // Payment-Integrated Booking Flow (NEW)
  // ============================================================================

  /**
   * Get coach availability with booked slots filtered out
   */
  async getCoachAvailability(
    coachId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Get availability slots
    const { data: slots, error: slotsError } = await supabase
      .from('coach_availability')
      .select('*')
      .eq('coach_id', coachId)
      .eq('is_active', true)
      .order('start_time', { ascending: true });

    if (slotsError) throw slotsError;

    // Get booked sessions in this timeframe
    const { data: bookedSessions, error: sessionsError } = await supabase
      .from('coaching_sessions')
      .select('scheduled_at, duration_minutes')
      .eq('coach_id', coachId)
      .in('status', ['confirmed', 'pending', 'scheduled'])
      .gte('scheduled_at', startDate.toISOString())
      .lte('scheduled_at', endDate.toISOString());

    if (sessionsError) throw sessionsError;

    // Filter out slots that overlap with booked sessions
    const availableSlots = (slots || []).filter(slot => {
      const slotStart = new Date(slot.start_time);
      const slotEnd = new Date(slot.end_time);

      // Check if any booked session overlaps with this slot
      const hasOverlap = (bookedSessions || []).some(session => {
        const sessionStart = new Date(session.scheduled_at);
        const sessionEnd = new Date(sessionStart.getTime() + session.duration_minutes * 60000);

        // Check for overlap
        return sessionStart < slotEnd && sessionEnd > slotStart;
      });

      return !hasOverlap;
    });

    return availableSlots;
  }

  /**
   * Book a coaching session with Stripe payment
   */
  async bookSession(booking: {
    coachId: string;
    sailorId: string;
    scheduledAt: Date;
    durationMinutes: number;
    sessionType: string;
    notes?: string;
  }): Promise<{
    session: CoachingSession;
    paymentIntentId: string;
    clientSecret: string;
  }> {
    // Get coach pricing
    const { data: coach, error: coachError } = await supabase
      .from('coach_profiles')
      .select('hourly_rate, stripe_account_id, user:users(full_name)')
      .eq('user_id', booking.coachId)
      .single();

    if (coachError || !coach) throw new Error('Coach not found');
    if (!coach.stripe_account_id) throw new Error('Coach has not set up payments');

    // Calculate price
    const priceAmount = (coach.hourly_rate * booking.durationMinutes) / 60;
    const platformFee = priceAmount * 0.15; // 15% platform fee

    // Create Stripe payment intent via Edge Function
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession) throw new Error('Not authenticated');

    const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-coaching-payment`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify({
        amount: Math.round(priceAmount * 100), // Convert to cents
        coachStripeAccountId: coach.stripe_account_id,
        platformFee: Math.round(platformFee * 100),
        metadata: {
          coachId: booking.coachId,
          sailorId: booking.sailorId,
          sessionType: booking.sessionType,
        },
      }),
    });

    const paymentData = await response.json();
    if (!response.ok) {
      throw new Error(paymentData.error || 'Failed to create payment intent');
    }

    // Create session record (payment pending)
    const { data: session, error: sessionError } = await supabase
      .from('coaching_sessions')
      .insert({
        coach_id: booking.coachId,
        sailor_id: booking.sailorId,
        scheduled_at: booking.scheduledAt.toISOString(),
        duration_minutes: booking.durationMinutes,
        session_type: booking.sessionType,
        status: 'pending',
        fee_amount: priceAmount,
        currency: 'usd',
        stripe_payment_intent_id: paymentData.paymentIntentId,
        pre_session_notes: booking.notes,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    return {
      session,
      paymentIntentId: paymentData.paymentIntentId,
      clientSecret: paymentData.clientSecret,
    };
  }

  /**
   * Confirm session after successful payment
   */
  async confirmSessionPayment(
    sessionId: string,
    paymentIntentId: string
  ): Promise<void> {
    // Verify payment with Stripe via Edge Function
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession) throw new Error('Not authenticated');

    const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-payment-intent`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify({ paymentIntentId }),
    });

    const { status } = await response.json();
    if (!response.ok || status !== 'succeeded') {
      throw new Error('Payment not completed');
    }

    // Update session status
    const { error } = await supabase
      .from('coaching_sessions')
      .update({
        status: 'confirmed',
        paid: true,
        payment_date: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;

    // Send confirmation emails
    await this.sendSessionConfirmationEmails(sessionId);
  }

  /**
   * Cancel session with refund logic
   */
  async cancelSession(
    sessionId: string,
    cancelledBy: 'coach' | 'sailor',
    reason?: string
  ): Promise<void> {
    const { data: session, error: fetchError } = await supabase
      .from('coaching_sessions')
      .select(`
        *,
        coach:users!coach_id(id, email, full_name),
        sailor:users!sailor_id(id, email, full_name)
      `)
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) throw new Error('Session not found');

    // Validate session status - can only cancel if not already completed or cancelled
    if (session.status === 'completed') {
      throw new Error('Cannot cancel a completed session');
    }
    if (session.status === 'cancelled') {
      throw new Error('This session has already been cancelled');
    }

    // Calculate refund based on cancellation policy
    const hoursUntilSession = (
      new Date(session.scheduled_at).getTime() - Date.now()
    ) / (1000 * 60 * 60);

    let refundAmount = 0;
    if (hoursUntilSession >= 24) {
      refundAmount = session.fee_amount; // Full refund
    } else if (hoursUntilSession >= 12) {
      refundAmount = session.fee_amount * 0.5; // 50% refund
    }
    // No refund if < 12 hours

    // Process refund if applicable
    if (refundAmount > 0 && session.stripe_payment_intent_id) {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) throw new Error('Not authenticated');

      const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/refund-payment`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          paymentIntentId: session.stripe_payment_intent_id,
          amount: Math.round(refundAmount * 100), // Convert to cents
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process refund');
      }
    }

    // Update session
    const { error: updateError } = await supabase
      .from('coaching_sessions')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: cancelledBy,
        cancelled_at: new Date().toISOString(),
        refund_amount: refundAmount,
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    // Send cancellation notifications
    await this.sendCancellationEmails(sessionId, refundAmount);
  }

  /**
   * Send session confirmation emails to both parties
   */
  private async sendSessionConfirmationEmails(sessionId: string): Promise<void> {
    const { data: session } = await supabase
      .from('coaching_sessions')
      .select(`
        *,
        coach:users!coach_id(email, full_name),
        sailor:users!sailor_id(email, full_name)
      `)
      .eq('id', sessionId)
      .single();

    if (!session) return;

    // In production, integrate with EmailService
  }

  /**
   * Send cancellation emails to both parties
   */
  private async sendCancellationEmails(sessionId: string, _refundAmount: number): Promise<void> {
    const { data: session } = await supabase
      .from('coaching_sessions')
      .select(`
        *,
        coach:users!coach_id(email, full_name),
        sailor:users!sailor_id(email, full_name)
      `)
      .eq('id', sessionId)
      .single();

    if (!session) return;

    // In production, integrate with EmailService
  }

  // ============================================================================
  // Session Completion Management (NEW)
  // ============================================================================

  /**
   * Complete a coaching session with notes and trigger payout
   */
  async completeSession(
    sessionId: string,
    completionData: {
      sessionNotes?: string;
      homework?: string;
      rating?: number;
    }
  ): Promise<void> {
    const { data: session, error: sessionError } = await supabase
      .from('coaching_sessions')
      .select(`
        *,
        coach:coach_profiles!coach_id (
          id,
          display_name,
          stripe_account_id,
          user_id,
          users!coach_profiles_user_id_fkey (
            email,
            full_name
          )
        ),
        sailor:users!sailor_id (
          email,
          full_name
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    // Update session to completed
    const { error: updateError } = await supabase
      .from('coaching_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        session_notes: completionData.sessionNotes,
        homework: completionData.homework,
      })
      .eq('id', sessionId);

    if (updateError) {
      logger.error('Error completing session:', updateError);
      throw updateError;
    }

    // Note: Trigger for updating coach stats already exists in migration

    // Send completion email to sailor
    try {
      const { emailService } = await import('./EmailService');
      await emailService.sendSessionCompletionNotification({
        sailor_name: session.sailor?.full_name || 'Sailor',
        sailor_email: session.sailor?.email || '',
        coach_name: session.coach?.display_name || 'Coach',
        session_type: session.session_type,
        session_date: session.scheduled_at || session.started_at || '',
        session_notes: completionData.sessionNotes,
        homework: completionData.homework,
      });

      // Request feedback from sailor
      await emailService.sendFeedbackRequest({
        sailor_name: session.sailor?.full_name || 'Sailor',
        sailor_email: session.sailor?.email || '',
        coach_name: session.coach?.display_name || 'Coach',
        session_id: sessionId,
      });
    } catch (emailError) {
      logger.error('Error sending completion emails:', emailError);
      // Don't throw - session is already marked complete
    }
  }

  /**
   * Get sessions requiring completion (for coach dashboard)
   */
  async getSessionsRequiringCompletion(coachId: string): Promise<CoachingSession[]> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('coaching_sessions')
      .select(`
        *,
        sailor:users!sailor_id (
          id,
          email,
          full_name,
          avatar_url
        ),
        venue:sailing_venues (
          id,
          name
        )
      `)
      .eq('coach_id', coachId)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())
      .gte('scheduled_at', oneDayAgo.toISOString())
      .order('scheduled_at', { ascending: false });

    if (error) {
      logger.error('Error fetching sessions requiring completion:', error);
      throw error;
    }

    return data || [];
  }

  // ============================================================================
  // RPC Helpers and View Mappers (NEW)
  // ============================================================================

  /**
   * Get complete coach dashboard data in a single RPC call
   * Uses the get_coach_dashboard_data RPC function for optimized data fetching
   */
  async getCoachDashboardData(coachId: string): Promise<any> {
    const { data, error } = await supabase.rpc('get_coach_dashboard_data', {
      p_coach_id: coachId,
    });

    if (error) {
      logger.error('Error fetching coach dashboard data:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get sailor's coaching overview in a single RPC call
   * Uses the get_sailor_coaching_overview RPC function
   */
  async getSailorCoachingOverview(sailorId: string): Promise<any> {
    const { data, error } = await supabase.rpc('get_sailor_coaching_overview', {
      p_sailor_id: sailorId,
    });

    if (error) {
      logger.error('Error fetching sailor coaching overview:', error);
      throw error;
    }

    return data;
  }

  /**
   * Search coaches with advanced filtering
   * Uses the search_coaches RPC function with ranking
   */
  async searchCoaches(params?: {
    specialties?: string[];
    minRating?: number;
    maxHourlyRate?: number;
    location?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { data, error } = await supabase.rpc('search_coaches', {
      p_specialties: params?.specialties || null,
      p_min_rating: params?.minRating || null,
      p_max_hourly_rate: params?.maxHourlyRate || null,
      p_location: params?.location || null,
      p_limit: params?.limit || 20,
      p_offset: params?.offset || 0,
    });

    if (error) {
      logger.error('Error searching coaches:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Query the coach_sailor_sessions_view directly
   * Provides access to the consolidated session view
   */
  async querySailorSessionsView(filters?: {
    coachId?: string;
    sailorId?: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    let query = supabase.from('coach_sailor_sessions_view').select('*');

    if (filters?.coachId) {
      query = query.eq('coach_id', filters.coachId);
    }

    if (filters?.sailorId) {
      query = query.eq('sailor_id', filters.sailorId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('scheduled_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error querying sailor sessions view:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get coach metrics from the aggregated view
   */
  async getCoachMetricsFromView(coachId: string): Promise<any> {
    const { data, error } = await supabase
      .from('coach_metrics_view')
      .select('*')
      .eq('coach_id', coachId)
      .single();

    if (error) {
      logger.error('Error fetching coach metrics:', error);
      return null;
    }

    return data;
  }

  /**
   * Get recent feedback from the feedback view
   */
  async getCoachFeedbackFromView(coachId: string, limit: number = 10): Promise<any[]> {
    const { data, error } = await supabase
      .from('coach_feedback_view')
      .select('*')
      .eq('coach_id', coachId)
      .order('feedback_date', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching coach feedback:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * DTO to view-model mapper for coaching sessions
   * Converts database DTOs to frontend-friendly view models
   */
  mapSessionToViewModel(session: any): any {
    return {
      id: session.session_id || session.id,
      coachId: session.coach_id,
      coachName: session.coach_name,
      coachPhoto: session.coach_photo,
      sailorId: session.sailor_id,
      sailorName: session.sailor_name,
      sailorEmail: session.sailor_email,
      sailorAvatar: session.sailor_avatar,
      type: session.session_type,
      duration: session.duration_minutes,
      scheduledAt: session.scheduled_at,
      completedAt: session.completed_at,
      status: session.status,
      location: session.location_notes,
      venueName: session.venue_name,
      venueLocation: session.venue_location,
      focusAreas: session.focus_areas || [],
      goals: session.goals,
      notes: session.session_notes,
      homework: session.homework,
      fee: {
        amount: session.fee_amount,
        currency: session.currency,
        paid: session.paid,
      },
      feedback: session.feedback_rating ? {
        rating: session.feedback_rating,
        text: session.feedback_text,
        skillImprovement: session.skill_improvement,
        wouldRecommend: session.would_recommend,
      } : null,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    };
  }

  /**
   * DTO to view-model mapper for coach profiles
   */
  mapCoachToViewModel(coach: any): any {
    return {
      id: coach.coach_id || coach.id,
      userId: coach.user_id,
      name: coach.display_name,
      photo: coach.profile_photo_url || coach.profile_image_url,
      bio: coach.bio,
      specialties: coach.specialties || [],
      hourlyRate: coach.hourly_rate,
      currency: coach.currency,
      location: coach.based_at,
      availableLocations: coach.available_locations || [],
      metrics: {
        rating: coach.average_rating,
        totalSessions: coach.total_sessions,
        totalClients: coach.total_clients,
        completedSessions: coach.total_completed_sessions,
        upcomingSessions: coach.upcoming_sessions,
      },
      verified: coach.verified,
      matchScore: coach.match_score,
    };
  }

  // ===== MARKETPLACE METHODS (migrated from CoachService.ts) =====

  /**
   * Register a new coach with complete profile
   */
  async registerCoach(formData: CoachRegistrationForm, userId: string): Promise<MarketplaceCoachProfile> {
    try {
      // 1. Create coach profile
      const coachProfileData = {
        user_id: userId,
        ...formData.personal_info,
        ...formData.credentials,
        ...formData.expertise,
        status: 'pending' as const,
        currency: 'USD',
      };

      const { data: coach, error: profileError } = await supabase
        .from('coach_profiles')
        .insert(coachProfileData)
        .select()
        .single();

      if (profileError) throw profileError;

      // 2. Create services
      if (formData.services.length > 0) {
        const servicesData = formData.services.map(service => ({
          ...service,
          coach_id: coach.id,
        }));

        const { error: servicesError } = await supabase
          .from('coach_services')
          .insert(servicesData);

        if (servicesError) throw servicesError;
      }

      // 3. Create availability slots
      if (formData.availability.length > 0) {
        const availabilityData = formData.availability.map(slot => ({
          ...slot,
          coach_id: coach.id,
        }));

        const { error: availabilityError } = await supabase
          .from('coach_availability')
          .insert(availabilityData);

        if (availabilityError) throw availabilityError;
      }

      return coach;
    } catch (error) {
      logger.error('Error registering coach:', error);
      throw error;
    }
  }

  /**
   * Get the sailor profile associated with a user
   */
  async getSailorProfile(userId: string): Promise<SailorProfile | null> {
    try {
      const { data, error } = await supabase
        .from('sailor_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return (data as SailorProfile) ?? null;
    } catch (error) {
      logger.error('Error fetching sailor profile:', error);
      return null;
    }
  }

  /**
   * Get coach profile by coach ID with all related data
   * (Different from getCoachProfile which looks up by user_id)
   */
  async getCoachProfileById(coachId: string): Promise<CoachProfileResponse> {
    try {
      // Get coach profile
      const { data: coach, error: coachError } = await supabase
        .from('coach_profiles')
        .select('*')
        .eq('id', coachId)
        .single();

      if (coachError) throw coachError;

      // Get services
      const { data: services, error: servicesError } = await supabase
        .from('coach_services')
        .select('*')
        .eq('coach_id', coachId)
        .eq('is_active', true);

      if (servicesError) throw servicesError;

      // Get availability
      const { data: availability, error: availabilityError } = await supabase
        .from('coach_availability')
        .select('*')
        .eq('coach_id', coachId);

      if (availabilityError) throw availabilityError;

      // Get recent reviews
      const { data: reviews, error: reviewsError } = await supabase
        .from('session_reviews')
        .select(`
          *,
          coaching_sessions!inner(coach_id)
        `)
        .eq('coaching_sessions.coach_id', coachId)
        .eq('reviewer_type', 'student')
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      if (reviewsError) throw reviewsError;

      return {
        coach,
        services: services || [],
        availability: availability || [],
        reviews: reviews || []
      };
    } catch (error) {
      logger.error('Error getting coach profile:', error);
      throw error;
    }
  }

  /**
   * Update coach profile by coach ID
   */
  async updateCoachProfile(coachId: string, updates: Partial<MarketplaceCoachProfile>): Promise<MarketplaceCoachProfile> {
    try {
      const { data, error } = await supabase
        .from('coach_profiles')
        .update(updates)
        .eq('id', coachId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating coach profile:', error);
      throw error;
    }
  }

  /**
   * Search coaches with marketplace filters
   * (Different from searchCoaches which uses RPC)
   */
  async searchCoachesMarketplace(
    filters: CoachSearchFilters = {},
    page: number = 1,
    perPage: number = 20
  ): Promise<SearchResponse> {
    try {
      let query = supabase
        .from('coach_profiles')
        .select(`
          *,
          coach_services!inner(*)
        `)
        .eq('status', 'active');

      // Apply filters
      if (filters.boat_classes?.length) {
        query = query.overlaps('boat_classes', filters.boat_classes);
      }

      if (filters.specialties?.length) {
        query = query.overlaps('specialties', filters.specialties);
      }

      if (filters.skill_levels?.length) {
        query = query.overlaps('skill_levels', filters.skill_levels);
      }

      if (filters.location) {
        query = query.ilike('location', `%${filters.location}%`);
      }

      if (filters.languages?.length) {
        query = query.overlaps('languages', filters.languages);
      }

      if (filters.rating) {
        query = query.gte('average_rating', filters.rating);
      }

      // Time zone filter
      if (filters.time_zone) {
        query = query.eq('time_zone', filters.time_zone);
      }

      // Apply price range filter on services
      if (filters.price_range) {
        query = query.gte('coach_services.base_price', filters.price_range[0])
                    .lte('coach_services.base_price', filters.price_range[1]);
      }

      // Session type filter - filter coaches who offer specific service types
      if (filters.session_types?.length) {
        query = query.in('coach_services.service_type', filters.session_types);
      }

      // Pagination
      const offset = (page - 1) * perPage;
      query = query.range(offset, offset + perPage - 1);

      // Order by rating and total reviews
      query = query.order('average_rating', { ascending: false })
                  .order('total_reviews', { ascending: false });

      const { data: coaches, error } = await query;

      if (error) throw error;

      const coachRows = coaches || [];
      const nextAvailableByCoach = await this.getNextAvailableSlotsForCoaches(
        coachRows.map((coach: any) => coach.id).filter(Boolean),
      );

      // Transform data to include services and batched next available slot.
      let searchResults: CoachSearchResult[] = coachRows.map((coach: any) => {
        const { coach_services: services = [], ...coachProfile } = coach;

        return {
          ...coachProfile,
          services,
          next_available: nextAvailableByCoach.get(coach.id),
          match_score: this.calculateMatchScore(coachProfile, filters)
        };
      });

      // Apply minimum match score filter if specified
      if (filters.min_match_score !== undefined) {
        searchResults = searchResults.filter(
          coach => (coach.match_score || 0) >= filters.min_match_score!
        );
      }

      return {
        coaches: searchResults,
        total_count: searchResults.length, // Update count after filtering
        page,
        per_page: perPage,
        filters_applied: filters
      };
    } catch (error) {
      logger.error('Error searching coaches:', error);
      throw error;
    }
  }

  /**
   * Get next available time slot for a coach
   */
  async getNextAvailableSlot(coachId: string): Promise<string | undefined> {
    const slotsByCoach = await this.getNextAvailableSlotsForCoaches([coachId]);
    return slotsByCoach.get(coachId);
  }

  private async getNextAvailableSlotsForCoaches(
    coachIds: string[],
  ): Promise<Map<string, string | undefined>> {
    const nextAvailableByCoach = new Map<string, string | undefined>();
    const uniqueCoachIds = Array.from(new Set(coachIds.filter(Boolean)));
    if (uniqueCoachIds.length === 0) return nextAvailableByCoach;

    try {
      const { data: availability, error: availabilityError } = await supabase
        .from('coach_availability')
        .select('coach_id, day_of_week, start_time')
        .in('coach_id', uniqueCoachIds)
        .eq('is_recurring', true);

      if (availabilityError) throw availabilityError;
      if (!availability?.length) return nextAvailableByCoach;

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const { data: bookings, error: bookingsError } = await supabase
        .from('coaching_sessions')
        .select('coach_id, scheduled_start, scheduled_end')
        .in('coach_id', uniqueCoachIds)
        .gte('scheduled_start', startDate.toISOString())
        .lte('scheduled_start', endDate.toISOString())
        .in('status', ['confirmed', 'pending']);

      if (bookingsError) throw bookingsError;

      const availabilityByCoach = new Map<string, any[]>();
      for (const slot of availability || []) {
        const slots = availabilityByCoach.get(slot.coach_id) || [];
        slots.push(slot);
        availabilityByCoach.set(slot.coach_id, slots);
      }

      const bookingsByCoach = new Map<string, any[]>();
      for (const booking of bookings || []) {
        const coachBookings = bookingsByCoach.get(booking.coach_id) || [];
        coachBookings.push(booking);
        bookingsByCoach.set(booking.coach_id, coachBookings);
      }

      const now = new Date();
      for (const coachId of uniqueCoachIds) {
        const coachAvailability = availabilityByCoach.get(coachId) || [];
        const coachBookings = bookingsByCoach.get(coachId) || [];

        for (let i = 0; i < 30; i++) {
          const checkDate = new Date(now);
          checkDate.setDate(checkDate.getDate() + i);
          const dayOfWeek = checkDate.getDay();

          const dayAvailability = coachAvailability.filter(slot => slot.day_of_week === dayOfWeek);

          for (const slot of dayAvailability) {
            const slotStart = new Date(checkDate);
            const [startHour, startMinute] = slot.start_time.split(':');
            slotStart.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

            const isBooked = coachBookings.some(booking => {
              const bookingStart = new Date(booking.scheduled_start);
              const bookingEnd = new Date(booking.scheduled_end);
              return slotStart >= bookingStart && slotStart < bookingEnd;
            });

            if (!isBooked && slotStart > now) {
              nextAvailableByCoach.set(coachId, slotStart.toISOString());
              break;
            }
          }

          if (nextAvailableByCoach.has(coachId)) break;
        }
      }

      return nextAvailableByCoach;
    } catch (error) {
      logger.error('Error getting next available slots:', error);
      return nextAvailableByCoach;
    }
  }

  /**
   * Calculate match score for coach based on search filters
   */
  private calculateMatchScore(coach: MarketplaceCoachProfile, filters: CoachSearchFilters): number {
    let score = 0;
    let maxScore = 0;

    // Boat class match
    if (filters.boat_classes?.length) {
      maxScore += 30;
      const matchingClasses = coach.boat_classes.filter(cls =>
        filters.boat_classes!.includes(cls)
      );
      score += (matchingClasses.length / filters.boat_classes.length) * 30;
    }

    // Specialty match
    if (filters.specialties?.length) {
      maxScore += 25;
      const matchingSpecialties = coach.specialties.filter(spec =>
        filters.specialties!.includes(spec)
      );
      score += (matchingSpecialties.length / filters.specialties.length) * 25;
    }

    // Rating weight
    maxScore += 20;
    score += (coach.average_rating / 5) * 20;

    // Experience weight
    maxScore += 15;
    score += Math.min(coach.years_coaching / 10, 1) * 15;

    // Location preference
    if (filters.location) {
      maxScore += 10;
      if (coach.location.toLowerCase().includes(filters.location.toLowerCase())) {
        score += 10;
      }
    }

    return maxScore > 0 ? score / maxScore : 0.5;
  }

  /**
   * Book a marketplace coaching session
   * (Different from bookSession which integrates with Stripe)
   */
  async bookMarketplaceSession(sessionData: Partial<MarketplaceCoachingSession>): Promise<MarketplaceCoachingSession> {
    try {
      const { data, error } = await supabase
        .from('coaching_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error booking session:', error);
      throw error;
    }
  }

  /**
   * Get coaching sessions for a user by role
   */
  async getUserSessions(userId: string, role: 'student' | 'coach'): Promise<MarketplaceCoachingSession[]> {
    try {
      let query = supabase
        .from('coaching_sessions')
        .select('*');

      if (role === 'student') {
        query = query.eq('student_id', userId);
      } else {
        query = query.eq('coach_id', userId);
      }

      const { data, error } = await query.order('scheduled_start', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      throw error;
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: MarketplaceCoachingSession['status'], notes?: string): Promise<MarketplaceCoachingSession> {
    try {
      const updateData: any = { status };
      if (notes) updateData.session_notes = notes;
      if (status === 'in_progress') updateData.actual_start = new Date().toISOString();
      if (status === 'completed') updateData.actual_end = new Date().toISOString();

      const { data, error } = await supabase
        .from('coaching_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating session status:', error);
      throw error;
    }
  }

  /**
   * Submit a session review
   */
  async submitReview(reviewData: Partial<SessionReview>): Promise<SessionReview> {
    try {
      const { data, error } = await supabase
        .from('session_reviews')
        .insert(reviewData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error submitting review:', error);
      throw error;
    }
  }

  /**
   * Get coach marketplace dashboard data
   * (Different from getCoachDashboardData which uses RPC)
   */
  async getCoachMarketplaceDashboard(coachId: string): Promise<CoachDashboardData> {
    try {
      // Get profile
      const { data: profile } = await supabase
        .from('coach_profiles')
        .select('*')
        .eq('id', coachId)
        .single();

      // Get upcoming sessions
      const { data: upcoming_sessions } = await supabase
        .from('coaching_sessions')
        .select('*')
        .eq('coach_id', coachId)
        .gte('scheduled_start', new Date().toISOString())
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_start')
        .limit(10);

      // Get monthly stats
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthly_sessions } = await supabase
        .from('coaching_sessions')
        .select('status, total_amount')
        .eq('coach_id', coachId)
        .gte('created_at', startOfMonth.toISOString());

      const monthly_earnings = monthly_sessions
        ?.filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + (s.total_amount * 0.85), 0) || 0; // 15% platform fee

      const session_stats = {
        total_this_month: monthly_sessions?.length || 0,
        completed_this_month: monthly_sessions?.filter(s => s.status === 'completed').length || 0,
        avg_rating_this_month: profile?.average_rating || 0
      };

      // Get pending reviews
      const { data: pending_reviews } = await supabase
        .from('session_reviews')
        .select(`
          *,
          coaching_sessions!inner(coach_id, student_id)
        `)
        .eq('coaching_sessions.coach_id', coachId)
        .eq('reviewer_type', 'student')
        .eq('moderation_status', 'pending')
        .limit(10);

      // Get recent reviews
      const { data: recent_reviews } = await supabase
        .from('session_reviews')
        .select(`
          *,
          coaching_sessions!inner(coach_id, student_id)
        `)
        .eq('coaching_sessions.coach_id', coachId)
        .eq('reviewer_type', 'student')
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        profile: profile!,
        upcoming_sessions: upcoming_sessions || [],
        pending_reviews: pending_reviews || [],
        monthly_earnings,
        session_stats,
        recent_reviews: recent_reviews || []
      };
    } catch (error) {
      logger.error('Error getting coach dashboard:', error);
      throw error;
    }
  }

  /**
   * Get student dashboard data
   * NOTE: Contains a known SQL injection vulnerability in the .not() call
   * that will be fixed separately.
   */
  async getStudentDashboard(userId: string): Promise<StudentDashboardData> {
    try {
      // Get upcoming sessions
      const { data: upcoming_sessions } = await supabase
        .from('coaching_sessions')
        .select(`
          *,
          coach_profiles!coaching_sessions_coach_id_fkey(first_name, last_name, profile_photo_url:profile_image_url)
        `)
        .eq('student_id', userId)
        .gte('scheduled_start', new Date().toISOString())
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_start')
        .limit(10);

      // Get recent sessions
      const { data: recent_sessions } = await supabase
        .from('coaching_sessions')
        .select(`
          *,
          coach_profiles!coaching_sessions_coach_id_fkey(first_name, last_name, profile_photo_url:profile_image_url)
        `)
        .eq('student_id', userId)
        .lt('scheduled_start', new Date().toISOString())
        .order('scheduled_start', { ascending: false })
        .limit(5);

      // Get favorite coaches (coaches with multiple sessions)
      const { data: sessions_by_coach } = await supabase
        .from('coaching_sessions')
        .select('id, coach_id')
        .eq('student_id', userId)
        .eq('status', 'completed');

      type CoachSessionCountRow = { coach_id: string | null };
      const coachCounts = (sessions_by_coach as CoachSessionCountRow[] | null)?.reduce<Record<string, number>>((acc, session) => {
        if (!session.coach_id) return acc;
        acc[session.coach_id] = (acc[session.coach_id] || 0) + 1;
        return acc;
      }, {}) || {};

      const favoriteCoachIds = Object.entries(coachCounts)
        .filter(([_, count]) => (count as number) >= 2)
        .slice(0, 5);

      let favorite_coaches: MarketplaceCoachProfile[] = [];
      if (favoriteCoachIds.length > 0) {
        const { data: favoriteCoachRows } = await supabase
          .from('coach_profiles')
          .select('*')
          .in('id', favoriteCoachIds.map(([coachId]) => String(coachId)));

        favorite_coaches = favoriteCoachRows ?? [];
      }

      // Get pending reviews (two-step approach to avoid SQL injection)
      const completedSessionIds = (sessions_by_coach || [])
        .map((session) => session.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      let reviewedIds: string[] = [];
      if (completedSessionIds.length > 0) {
        const { data: reviewedSessionIds } = await supabase
          .from('session_feedback')
          .select('session_id')
          .in('session_id', completedSessionIds);

        reviewedIds = (reviewedSessionIds || [])
          .map((row) => row.session_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
      }

      let pendingReviewsQuery = supabase
        .from('session_reviews')
        .select('*')
        .eq('reviewer_id', userId)
        .eq('reviewer_type', 'student')
        .eq('moderation_status', 'pending')
        .limit(5);

      if (reviewedIds.length > 0) {
        pendingReviewsQuery = pendingReviewsQuery.not('session_id', 'in', `(${reviewedIds.join(',')})`);
      }

      const { data: pending_reviews } = await pendingReviewsQuery;

      return {
        upcoming_sessions: upcoming_sessions || [],
        recent_sessions: recent_sessions || [],
        favorite_coaches: favorite_coaches || [],
        recommended_coaches: [], // TODO: Implement AI recommendations
        pending_reviews: pending_reviews || []
      };
    } catch (error) {
      logger.error('Error getting student dashboard:', error);
      throw error;
    }
  }

  /**
   * Get all sailing specialties
   */
  async getSailingSpecialties(): Promise<SailingSpecialty[]> {
    try {
      const { data, error } = await supabase
        .from('sailing_specialties')
        .select('*')
        .order('category, name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting sailing specialties:', error);
      return [];
    }
  }

  // ============================================================================
  // Sailor-side Active Coaches (NEW)
  // ============================================================================

  /**
   * Get active coaches for a sailor with ranking info
   * Used by CoachingSuggestionTile to show contextual coaching prompts
   */
  async getSailorActiveCoaches(sailorId: string): Promise<{
    id: string;
    coachId: string;
    displayName: string;
    avatarUrl?: string | null;
    specialties: string[];
    boatClasses: string[];
    totalSessions: number;
    lastSessionDate?: string | null;
  }[]> {
    // Fetch active coaching relationships
    const { data: clientRecords, error: clientError } = await supabase
      .from('coaching_clients')
      .select('id, coach_id, total_sessions, last_session_date')
      .eq('sailor_id', sailorId)
      .eq('status', 'active');

    if (clientError) {
      logger.error('[CoachingService.getSailorActiveCoaches] Error fetching clients:', clientError);
      throw clientError;
    }

    if (!clientRecords || clientRecords.length === 0) {
      return [];
    }

    // Get coach profile IDs
    const coachIds = clientRecords.map(c => c.coach_id).filter(Boolean);

    if (coachIds.length === 0) {
      return [];
    }

    // Fetch coach profiles
    const { data: coachProfiles, error: profileError } = await supabase
      .from('coach_profiles')
      .select('id, display_name, profile_photo_url:profile_image_url, specialties, boat_classes_coached')
      .in('id', coachIds);

    if (profileError) {
      logger.error('[CoachingService.getSailorActiveCoaches] Error fetching coach profiles:', profileError);
      throw profileError;
    }

    // Create a map for coach profiles
    const coachMap = new Map(
      (coachProfiles || []).map(c => [c.id, c])
    );

    // Build result array
    return clientRecords
      .map(client => {
        const coachProfile = coachMap.get(client.coach_id);
        if (!coachProfile) return null;

        return {
          id: client.id,
          coachId: coachProfile.id,
          displayName: coachProfile.display_name || 'Coach',
          avatarUrl: coachProfile.profile_photo_url,
          specialties: coachProfile.specialties || [],
          boatClasses: coachProfile.boat_classes_coached || [],
          totalSessions: client.total_sessions || 0,
          lastSessionDate: client.last_session_date,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }

  // ============================================================================
  // Coach Pricing Management
  // ============================================================================

  /**
   * Get coach pricing details including custom charges and session type rates
   */
  async getCoachPricing(coachId: string): Promise<{
    hourly_rate: number | null;
    currency: string;
    session_durations: number[];
    session_type_rates: Record<string, number>;
    custom_charges: CustomCharge[];
    package_pricing: Record<string, number>;
    pricing_history: any[];
    min_booking_notice_hours: number;
    cancellation_hours: number;
  } | null> {
    const { data, error } = await supabase
      .from('coach_profiles')
      .select(`
        hourly_rate,
        currency,
        session_durations,
        session_type_rates,
        custom_charges,
        package_pricing,
        pricing_history,
        min_booking_notice_hours,
        cancellation_hours
      `)
      .eq('id', coachId)
      .single();

    if (error) {
      logger.error('[CoachingService.getCoachPricing] Error:', error);
      return null;
    }

    return {
      hourly_rate: data.hourly_rate,
      currency: data.currency || 'USD',
      session_durations: data.session_durations || [60],
      session_type_rates: data.session_type_rates || {},
      custom_charges: data.custom_charges || [],
      package_pricing: data.package_pricing || {},
      pricing_history: data.pricing_history || [],
      min_booking_notice_hours: data.min_booking_notice_hours || 24,
      cancellation_hours: data.cancellation_hours || 24,
    };
  }

  /**
   * Update coach pricing settings
   * Automatically records history via database trigger
   */
  async updateCoachPricing(
    coachId: string,
    updates: {
      hourly_rate?: number;
      currency?: string;
      session_durations?: number[];
      session_type_rates?: Record<string, number>;
      custom_charges?: CustomCharge[];
      package_pricing?: Record<string, number>;
      min_booking_notice_hours?: number;
      cancellation_hours?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.requireAuth();

      const updateData: Record<string, any> = {};

      if (updates.hourly_rate !== undefined) updateData.hourly_rate = updates.hourly_rate;
      if (updates.currency !== undefined) updateData.currency = updates.currency;
      if (updates.session_durations !== undefined) updateData.session_durations = updates.session_durations;
      if (updates.session_type_rates !== undefined) updateData.session_type_rates = updates.session_type_rates;
      if (updates.custom_charges !== undefined) updateData.custom_charges = updates.custom_charges;
      if (updates.package_pricing !== undefined) updateData.package_pricing = updates.package_pricing;
      if (updates.min_booking_notice_hours !== undefined) updateData.min_booking_notice_hours = updates.min_booking_notice_hours;
      if (updates.cancellation_hours !== undefined) updateData.cancellation_hours = updates.cancellation_hours;

      const { error } = await supabase
        .from('coach_profiles')
        .update(updateData)
        .eq('id', coachId);

      if (error) {
        logger.error('[CoachingService.updateCoachPricing] Error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      logger.error('[CoachingService.updateCoachPricing] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Add a custom charge to coach's pricing
   */
  async addCustomCharge(
    coachId: string,
    charge: Omit<CustomCharge, 'id'>
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const pricing = await this.getCoachPricing(coachId);
      if (!pricing) {
        return { success: false, error: 'Coach profile not found' };
      }

      const newCharge: CustomCharge = {
        ...charge,
        id: crypto.randomUUID(),
      };

      const updatedCharges = [...pricing.custom_charges, newCharge];

      const result = await this.updateCoachPricing(coachId, {
        custom_charges: updatedCharges,
      });

      if (!result.success) {
        return result;
      }

      return { success: true, id: newCharge.id };
    } catch (err) {
      logger.error('[CoachingService.addCustomCharge] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Update a custom charge
   */
  async updateCustomCharge(
    coachId: string,
    chargeId: string,
    updates: Partial<Omit<CustomCharge, 'id'>>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const pricing = await this.getCoachPricing(coachId);
      if (!pricing) {
        return { success: false, error: 'Coach profile not found' };
      }

      const updatedCharges = pricing.custom_charges.map((charge) =>
        charge.id === chargeId ? { ...charge, ...updates } : charge
      );

      return await this.updateCoachPricing(coachId, {
        custom_charges: updatedCharges,
      });
    } catch (err) {
      logger.error('[CoachingService.updateCustomCharge] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Delete a custom charge
   */
  async deleteCustomCharge(
    coachId: string,
    chargeId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const pricing = await this.getCoachPricing(coachId);
      if (!pricing) {
        return { success: false, error: 'Coach profile not found' };
      }

      const updatedCharges = pricing.custom_charges.filter(
        (charge) => charge.id !== chargeId
      );

      return await this.updateCoachPricing(coachId, {
        custom_charges: updatedCharges,
      });
    } catch (err) {
      logger.error('[CoachingService.deleteCustomCharge] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  // ============================================================================
  // Coach Availability Management
  // ============================================================================

  /**
   * Get coach's weekly availability slots
   */
  async getCoachWeeklyAvailability(coachId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('coach_availability')
      .select('*')
      .eq('coach_id', coachId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      logger.error('[CoachingService.getCoachWeeklyAvailability] Error:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update coach's accepting clients status
   */
  async updateAcceptingClients(
    coachId: string,
    isAccepting: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.requireAuth();

      const { error } = await supabase
        .from('coach_profiles')
        .update({ is_accepting_clients: isAccepting })
        .eq('id', coachId);

      if (error) {
        logger.error('[CoachingService.updateAcceptingClients] Error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      logger.error('[CoachingService.updateAcceptingClients] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get coach's blocked dates (vacation, regatta days, etc.)
   */
  async getBlockedDates(coachId: string): Promise<{
    id: string;
    start_date: string;
    end_date: string;
    reason?: string;
    block_type: string;
  }[]> {
    const { data, error } = await supabase
      .from('coach_blocked_dates')
      .select('*')
      .eq('coach_id', coachId)
      .order('start_date', { ascending: true });

    if (error) {
      logger.error('[CoachingService.getBlockedDates] Error:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Add a blocked date range
   */
  async addBlockedDate(
    coachId: string,
    blockedDate: {
      start_date: string;
      end_date: string;
      reason?: string;
      block_type?: string;
    }
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      await this.requireAuth();

      const { data, error } = await supabase
        .from('coach_blocked_dates')
        .insert({
          coach_id: coachId,
          start_date: blockedDate.start_date,
          end_date: blockedDate.end_date,
          reason: blockedDate.reason,
          block_type: blockedDate.block_type || 'vacation',
        })
        .select()
        .single();

      if (error) {
        logger.error('[CoachingService.addBlockedDate] Error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, id: data.id };
    } catch (err) {
      logger.error('[CoachingService.addBlockedDate] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Delete a blocked date
   */
  async deleteBlockedDate(
    blockedDateId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.requireAuth();

      const { error } = await supabase
        .from('coach_blocked_dates')
        .delete()
        .eq('id', blockedDateId);

      if (error) {
        logger.error('[CoachingService.deleteBlockedDate] Error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      logger.error('[CoachingService.deleteBlockedDate] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Check if a date is blocked for a coach
   */
  async isDateBlocked(coachId: string, date: Date): Promise<boolean> {
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('coach_blocked_dates')
      .select('id')
      .eq('coach_id', coachId)
      .lte('start_date', dateStr)
      .gte('end_date', dateStr)
      .limit(1);

    if (error) {
      logger.error('[CoachingService.isDateBlocked] Error:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  }

  /**
   * Calculate session price with custom charges
   */
  calculateSessionPrice(
    pricing: {
      hourly_rate: number | null;
      session_type_rates: Record<string, number>;
      custom_charges: CustomCharge[];
    },
    sessionType: string,
    durationMinutes: number,
    selectedChargeIds: string[] = []
  ): {
    baseAmount: number;
    customChargesAmount: number;
    customChargesBreakdown: { id: string; label: string; amount: number }[];
    totalAmount: number;
  } {
    // Get the rate for this session type, or fall back to hourly rate
    const rate = pricing.session_type_rates[sessionType] || pricing.hourly_rate || 0;

    // Calculate base amount (rate is per hour, so adjust for duration)
    const baseAmount = Math.round((rate / 60) * durationMinutes);

    // Calculate custom charges
    const applicableCharges = pricing.custom_charges.filter((charge) => {
      if (!charge.is_active) return false;
      if (!selectedChargeIds.includes(charge.id)) return false;
      // If session_types is specified, check if this session type is included
      if (charge.session_types && charge.session_types.length > 0) {
        return charge.session_types.includes(sessionType);
      }
      return true;
    });

    const customChargesBreakdown = applicableCharges.map((charge) => ({
      id: charge.id,
      label: charge.label,
      amount: charge.amount_cents,
    }));

    const customChargesAmount = customChargesBreakdown.reduce(
      (sum, charge) => sum + charge.amount,
      0
    );

    return {
      baseAmount,
      customChargesAmount,
      customChargesBreakdown,
      totalAmount: baseAmount + customChargesAmount,
    };
  }

  /**
   * Share race debrief with a coach
   * Creates a notification for the coach to review the sailor's race analysis
   */
  async shareDebriefWithCoach(params: {
    coachId: string;
    raceId: string;
    sailorId: string;
    sailorName?: string;
    raceName?: string;
    message?: string;
  }): Promise<void> {
    try {
      // Get coach profile with user email
      const { data: coachProfile, error: profileError } = await supabase
        .from('coach_profiles')
        .select(`
          id,
          display_name,
          user_id,
          users:coach_profiles_user_id_fkey (
            email,
            full_name
          )
        `)
        .eq('id', params.coachId)
        .single();

      if (profileError || !coachProfile) {
        logger.error('[CoachingService.shareDebriefWithCoach] Error fetching coach profile:', profileError);
        throw new Error('Coach not found');
      }

      // Get race details for the notification
      const { data: raceData } = await supabase
        .from('regattas')
        .select('name, date')
        .eq('id', params.raceId)
        .single();

      const raceName = params.raceName || raceData?.name || 'Race';
      const sailorName = params.sailorName || 'Sailor';

      // Send email notification to coach
      const coachEmail = (coachProfile as any).users?.email;
      if (coachEmail) {
        const { emailService } = await import('./EmailService');
        await emailService.sendCoachNotification({
          coach_name: coachProfile.display_name || (coachProfile as any).users?.full_name || 'Coach',
          coach_email: coachEmail,
          notification_type: 'analysis_shared',
          sailor_name: sailorName,
          race_name: raceName,
          message: params.message || `${sailorName} has shared their race debrief with you.`,
        });
      }

      // Create in-app notification (if notifications table exists)
      try {
        await supabase.from('notifications').insert({
          user_id: coachProfile.user_id,
          type: 'debrief_shared',
          title: `${sailorName} shared a race debrief`,
          body: `Review their analysis for ${raceName}`,
          data: {
            raceId: params.raceId,
            sailorId: params.sailorId,
            sailorName,
            raceName,
          },
          read: false,
        });
      } catch (notificationError) {
        // Notifications table may not exist, continue without error
        logger.info('[CoachingService.shareDebriefWithCoach] Notification insert skipped:', notificationError);
      }

      // Send debrief share as a message in the coach-sailor conversation
      try {
        const { messagingService } = await import('./MessagingService');
        const coachUserId = coachProfile.user_id;
        const content = params.message || `${sailorName} shared their race debrief for ${raceName}`;
        await messagingService.sendMessage(
          await messagingService.getOrCreateConversation(coachUserId, params.sailorId),
          params.sailorId,
          content,
          'debrief_share',
          {
            race_id: params.raceId,
            race_name: raceName,
            sailor_name: sailorName,
          }
        );
      } catch (msgError) {
        logger.error('[shareDebriefWithCoach] Messaging error (non-fatal):', msgError);
      }
    } catch (error) {
      logger.error('[CoachingService.shareDebriefWithCoach] Error sharing debrief:', error);
      throw error;
    }
  }

  // ============================================================================
  // Session Lifecycle Management
  // ============================================================================

  /**
   * Complete a session with structured notes and engagement rating
   */
  async completeSessionWithNotes(
    sessionId: string,
    completionData: {
      actualDurationMinutes: number;
      structuredNotes: {
        what_was_covered?: string;
        what_went_well?: string;
        areas_to_work_on?: string;
        homework_next_steps?: string;
      };
      sailorEngagementRating?: number; // 1-5, private coach metric
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.requireAuth();

      // Get session details
      const { data: session, error: fetchError } = await supabase
        .from('coaching_sessions')
        .select(`
          *,
          sailor:users!sailor_id (
            id, email, full_name
          ),
          coach:coach_profiles!coach_id (
            id, display_name, user_id
          )
        `)
        .eq('id', sessionId)
        .single();

      if (fetchError || !session) {
        return { success: false, error: 'Session not found' };
      }

      // Validate session status - can only complete if not already completed or cancelled
      if (session.status === 'completed') {
        return { success: false, error: 'This session has already been completed' };
      }
      if (session.status === 'cancelled') {
        return { success: false, error: 'Cannot complete a cancelled session' };
      }

      // Update session to completed with structured notes
      const { error: updateError } = await supabase
        .from('coaching_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_duration_minutes: completionData.actualDurationMinutes,
          session_notes_structured: completionData.structuredNotes,
          sailor_engagement_rating: completionData.sailorEngagementRating,
          // Also save flat notes for backwards compatibility
          session_notes: [
            completionData.structuredNotes.what_was_covered,
            completionData.structuredNotes.what_went_well,
            completionData.structuredNotes.areas_to_work_on,
          ].filter(Boolean).join('\n\n'),
          homework: completionData.structuredNotes.homework_next_steps,
        })
        .eq('id', sessionId);

      if (updateError) {
        logger.error('[CoachingService.completeSessionWithNotes] Update error:', updateError);
        return { success: false, error: updateError.message };
      }

      // Trigger payment charge if not already processed
      // This would call the payment edge function
      // await this.triggerSessionPayment(sessionId);

      return { success: true };
    } catch (error: any) {
      logger.error('[CoachingService.completeSessionWithNotes] Error:', error);
      return { success: false, error: error.message || 'Failed to complete session' };
    }
  }

  /**
   * Send session summary to sailor
   */
  async sendSessionSummaryToSailor(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: session, error: fetchError } = await supabase
        .from('coaching_sessions')
        .select(`
          *,
          sailor:users!sailor_id (
            id, email, full_name
          ),
          coach:coach_profiles!coach_id (
            id, display_name, user_id
          )
        `)
        .eq('id', sessionId)
        .single();

      if (fetchError || !session) {
        return { success: false, error: 'Session not found' };
      }

      // Send email with session summary
      try {
        const { emailService } = await import('./EmailService');

        // Build session notes from structured data if available
        const structuredNotes = session.session_notes_structured as any;
        let notesText = session.session_notes || '';
        if (structuredNotes) {
          const parts = [];
          if (structuredNotes.what_was_covered) parts.push(`What was covered:\n${structuredNotes.what_was_covered}`);
          if (structuredNotes.what_went_well) parts.push(`What went well:\n${structuredNotes.what_went_well}`);
          if (structuredNotes.areas_to_work_on) parts.push(`Areas to work on:\n${structuredNotes.areas_to_work_on}`);
          if (parts.length > 0) notesText = parts.join('\n\n');
        }

        await emailService.sendSessionCompletionNotification({
          sailor_name: session.sailor?.full_name || 'Sailor',
          sailor_email: session.sailor?.email || '',
          coach_name: session.coach?.display_name || 'Coach',
          session_type: session.session_type,
          session_date: session.scheduled_at || session.started_at || '',
          session_notes: notesText,
          homework: structuredNotes?.homework_next_steps || session.homework,
        });
      } catch (emailError) {
        logger.error('[sendSessionSummaryToSailor] Email error:', emailError);
        // Continue - we'll mark it as sent anyway
      }

      // Mark summary as sent
      await supabase
        .from('coaching_sessions')
        .update({ summary_sent_to_sailor: true })
        .eq('id', sessionId);

      // Send session notes as a message in the conversation
      try {
        const { messagingService } = await import('./MessagingService');
        const coachUserId = session.coach?.user_id || (session as any).coach_id;
        const sailorId = session.sailor?.id || (session as any).sailor_id;
        if (coachUserId && sailorId) {
          const structuredNotes = session.session_notes_structured as any;
          const preview = structuredNotes?.what_was_covered
            || session.session_notes
            || 'Session notes shared';
          await messagingService.sendMessage(
            await messagingService.getOrCreateConversation(coachUserId, sailorId),
            coachUserId,
            preview,
            'session_note',
            {
              session_id: sessionId,
              session_date: session.scheduled_at || session.started_at,
              structured_notes: structuredNotes,
              homework: structuredNotes?.homework_next_steps || session.homework,
            }
          );
        }
      } catch (msgError) {
        logger.error('[sendSessionSummaryToSailor] Messaging error (non-fatal):', msgError);
      }

      // Send push notification to sailor
      try {
        const { PushNotificationService } = await import('./PushNotificationService');
        const coachName = session.coach?.display_name || 'Your coach';
        const sailorId = session.sailor?.id || (session as any).sailor_id;
        const coachUserId = session.coach?.user_id;
        if (sailorId) {
          // Build conversation deep link if possible
          let route = '/coach/my-bookings';
          if (coachUserId && sailorId) {
            try {
              const { messagingService } = await import('./MessagingService');
              const convoId = await messagingService.getOrCreateConversation(coachUserId, sailorId);
              route = `/coach/conversation/${convoId}`;
            } catch { /* fallback to bookings */ }
          }
          PushNotificationService.sendPushNotification(
            sailorId,
            'Session Notes Shared',
            `${coachName} shared notes from your session`,
            { type: 'session_summary', route, session_id: sessionId },
            'messages'
          ).catch(() => {});
        }
      } catch (pushError) {
        logger.error('[sendSessionSummaryToSailor] Push error (non-fatal):', pushError);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate refund amount for session cancellation
   * Returns the refund breakdown based on cancellation policy
   */
  calculateRefundAmount(
    sessionScheduledAt: string | Date,
    feeAmountCents: number
  ): {
    hoursUntilSession: number;
    refundPercentage: number;
    refundAmountCents: number;
    policy: string;
  } {
    const scheduledTime = new Date(sessionScheduledAt);
    const hoursUntilSession = (scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);

    let refundPercentage = 0;
    let policy = '';

    if (hoursUntilSession >= 24) {
      refundPercentage = 100;
      policy = 'Full refund (24+ hours notice)';
    } else if (hoursUntilSession >= 12) {
      refundPercentage = 50;
      policy = '50% refund (12-24 hours notice)';
    } else {
      refundPercentage = 0;
      policy = 'No refund (less than 12 hours notice)';
    }

    return {
      hoursUntilSession: Math.max(0, hoursUntilSession),
      refundPercentage,
      refundAmountCents: Math.round(feeAmountCents * (refundPercentage / 100)),
      policy,
    };
  }

  /**
   * Get session details for completion/cancellation UI
   */
  async getSessionDetails(sessionId: string): Promise<{
    id: string;
    status: string;
    scheduledAt: string;
    durationMinutes: number;
    sessionType: string;
    feeAmountCents: number;
    sailor: { id: string; name: string; email: string } | null;
    coach: { id: string; name: string } | null;
    notes: string | null;
    structuredNotes: any | null;
  } | null> {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select(`
        *,
        sailor:users!sailor_id (id, email, full_name),
        coach:coach_profiles!coach_id (id, display_name)
      `)
      .eq('id', sessionId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      status: data.status,
      scheduledAt: data.scheduled_at || data.start_time,
      durationMinutes: data.duration_minutes,
      sessionType: data.session_type,
      feeAmountCents: Math.round((data.fee_amount || data.price || 0) * 100),
      sailor: data.sailor ? {
        id: data.sailor.id,
        name: data.sailor.full_name || 'Unknown',
        email: data.sailor.email || '',
      } : null,
      coach: data.coach ? {
        id: data.coach.id,
        name: data.coach.display_name || 'Coach',
      } : null,
      notes: data.session_notes,
      structuredNotes: data.session_notes_structured,
    };
  }

  // ============================================================================
  // Booking Request Expiration Management
  // ============================================================================

  /**
   * Get time remaining until booking request expires
   */
  getBookingRequestExpiration(expiresAt: string | null): {
    isExpired: boolean;
    hoursRemaining: number;
    minutesRemaining: number;
    urgencyLevel: 'normal' | 'warning' | 'critical';
    displayText: string;
  } {
    if (!expiresAt) {
      return {
        isExpired: false,
        hoursRemaining: 48,
        minutesRemaining: 0,
        urgencyLevel: 'normal',
        displayText: 'Expires in 48 hours',
      };
    }

    const expirationTime = new Date(expiresAt);
    const now = Date.now();
    const msRemaining = expirationTime.getTime() - now;

    if (msRemaining <= 0) {
      return {
        isExpired: true,
        hoursRemaining: 0,
        minutesRemaining: 0,
        urgencyLevel: 'critical',
        displayText: 'Expired',
      };
    }

    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

    let urgencyLevel: 'normal' | 'warning' | 'critical' = 'normal';
    let displayText = '';

    if (hoursRemaining < 6) {
      urgencyLevel = 'critical';
      if (hoursRemaining < 1) {
        displayText = `Expires in ${minutesRemaining}m`;
      } else {
        displayText = `Expires in ${hoursRemaining}h ${minutesRemaining}m`;
      }
    } else if (hoursRemaining < 24) {
      urgencyLevel = 'warning';
      displayText = `Expires in ${hoursRemaining} hours`;
    } else {
      displayText = `Expires in ${hoursRemaining} hours`;
    }

    return {
      isExpired: false,
      hoursRemaining,
      minutesRemaining,
      urgencyLevel,
      displayText,
    };
  }

  /**
   * Manually expire a booking request (used by edge function)
   */
  async expireBookingRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('session_bookings')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('status', 'pending');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get pending booking requests with expiration info
   */
  async getPendingBookingRequestsWithExpiration(coachId: string): Promise<{
    id: string;
    sailorId: string;
    sailorName: string;
    requestedStartTime: string;
    requestedEndTime: string;
    message: string | null;
    createdAt: string;
    expiresAt: string | null;
    expiration: {
      isExpired: boolean;
      hoursRemaining: number;
      minutesRemaining: number;
      urgencyLevel: 'normal' | 'warning' | 'critical';
      displayText: string;
    };
  }[]> {
    const { data, error } = await supabase
      .from('session_bookings')
      .select(`
        *,
        sailor:users!sailor_id (id, email, full_name)
      `)
      .eq('coach_id', coachId)
      .eq('status', 'pending')
      .order('expires_at', { ascending: true });

    if (error || !data) return [];

    return data.map((request) => ({
      id: request.id,
      sailorId: request.sailor_id,
      sailorName: request.sailor?.full_name || request.sailor?.email || 'Unknown',
      requestedStartTime: request.requested_start_time,
      requestedEndTime: request.requested_end_time,
      message: request.sailor_message || request.message,
      createdAt: request.created_at,
      expiresAt: request.expires_at,
      expiration: this.getBookingRequestExpiration(request.expires_at),
    }));
  }

  // ============================================================================
  // Coach Profile Editor
  // ============================================================================

  /**
   * Get full coach profile for editing
   */
  async getCoachProfileForEdit(coachId: string): Promise<{
    id: string;
    displayName: string;
    profilePhotoUrl: string | null;
    bio: string | null;
    professionalTitle: string | null;
    specializations: string[];
    experienceYears: number | null;
    languages: string[];
    certifications: string[];
    boatClasses: string[];
    teachingModalities: string[];
    marketplaceVisible: boolean;
    isActive: boolean;
    hourlyRate: number | null;
    currency: string;
  } | null> {
    const { data, error } = await supabase
      .from('coach_profiles')
      .select(`
        id,
        display_name,
        profile_photo_url:profile_image_url,
        bio,
        professional_title,
        specializations,
        experience_years,
        languages,
        certifications,
        boat_classes,
        teaching_modalities,
        marketplace_visible,
        is_active,
        hourly_rate,
        currency
      `)
      .eq('id', coachId)
      .single();

    if (error || !data) {
      logger.error('[getCoachProfileForEdit] Error:', error);
      return null;
    }

    return {
      id: data.id,
      displayName: data.display_name || '',
      profilePhotoUrl: data.profile_photo_url,
      bio: data.bio,
      professionalTitle: data.professional_title,
      specializations: data.specializations || [],
      experienceYears: data.experience_years,
      languages: data.languages || ['English'],
      certifications: data.certifications || [],
      boatClasses: data.boat_classes || [],
      teachingModalities: data.teaching_modalities || ['on_water'],
      marketplaceVisible: data.marketplace_visible ?? true,
      isActive: data.is_active ?? true,
      hourlyRate: data.hourly_rate,
      currency: data.currency || 'USD',
    };
  }

  /**
   * Update coach profile with full editing capabilities
   */
  async updateCoachProfileFull(
    coachId: string,
    updates: {
      displayName?: string;
      profilePhotoUrl?: string | null;
      bio?: string;
      professionalTitle?: string;
      specializations?: string[];
      experienceYears?: number;
      languages?: string[];
      certifications?: string[];
      boatClasses?: string[];
      teachingModalities?: string[];
      marketplaceVisible?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.requireAuth();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
      if (updates.profilePhotoUrl !== undefined) updateData.profile_image_url = updates.profilePhotoUrl;
      if (updates.bio !== undefined) updateData.bio = updates.bio;
      if (updates.professionalTitle !== undefined) updateData.professional_title = updates.professionalTitle;
      if (updates.specializations !== undefined) updateData.specializations = updates.specializations;
      if (updates.experienceYears !== undefined) updateData.experience_years = updates.experienceYears;
      if (updates.languages !== undefined) updateData.languages = updates.languages;
      if (updates.certifications !== undefined) updateData.certifications = updates.certifications;
      if (updates.boatClasses !== undefined) updateData.boat_classes = updates.boatClasses;
      if (updates.teachingModalities !== undefined) updateData.teaching_modalities = updates.teachingModalities;
      if (updates.marketplaceVisible !== undefined) updateData.marketplace_visible = updates.marketplaceVisible;

      const { error } = await supabase
        .from('coach_profiles')
        .update(updateData)
        .eq('id', coachId);

      if (error) {
        logger.error('[updateCoachProfileFull] Error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      logger.error('[updateCoachProfileFull] Error:', error);
      return { success: false, error: error.message || 'Failed to update profile' };
    }
  }

  /**
   * Toggle marketplace visibility
   */
  async toggleMarketplaceVisibility(coachId: string, visible: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      await this.requireAuth();

      const { error } = await supabase
        .from('coach_profiles')
        .update({
          marketplace_visible: visible,
          updated_at: new Date().toISOString(),
        })
        .eq('id', coachId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload profile photo and get URL
   */
  async uploadProfilePhoto(_coachId: string, imageUri: string): Promise<{ url: string | null; error?: string }> {
    try {
      // Bucket INSERT RLS requires the first folder to be the uploader's
      // auth.uid(), so upload under the user's folder, not coach-photos/.
      const user = await this.requireAuth();
      const url = await AvatarStorageService.uploadAvatar(user.id, imageUri);
      return { url };
    } catch (error: any) {
      logger.error('[uploadProfilePhoto] Error:', error);
      return { url: null, error: error.message };
    }
  }
}

export const coachingService = new CoachingService();

// Backwards compatibility - CoachMarketplaceService methods are now on coachingService
// Existing imports use CoachMarketplaceService.methodName() (static-style calls),
// so this proxy object delegates to the coachingService singleton.
export const CoachMarketplaceService = {
  registerCoach: (...args: Parameters<typeof coachingService.registerCoach>) =>
    coachingService.registerCoach(...args),
  getSailorProfile: (...args: Parameters<typeof coachingService.getSailorProfile>) =>
    coachingService.getSailorProfile(...args),
  getCoachProfile: (...args: Parameters<typeof coachingService.getCoachProfileById>) =>
    coachingService.getCoachProfileById(...args),
  updateCoachProfile: (...args: Parameters<typeof coachingService.updateCoachProfile>) =>
    coachingService.updateCoachProfile(...args),
  searchCoaches: (...args: Parameters<typeof coachingService.searchCoachesMarketplace>) =>
    coachingService.searchCoachesMarketplace(...args),
  getNextAvailableSlot: (...args: Parameters<typeof coachingService.getNextAvailableSlot>) =>
    coachingService.getNextAvailableSlot(...args),
  bookSession: (...args: Parameters<typeof coachingService.bookMarketplaceSession>) =>
    coachingService.bookMarketplaceSession(...args),
  getUserSessions: (...args: Parameters<typeof coachingService.getUserSessions>) =>
    coachingService.getUserSessions(...args),
  updateSessionStatus: (...args: Parameters<typeof coachingService.updateSessionStatus>) =>
    coachingService.updateSessionStatus(...args),
  submitReview: (...args: Parameters<typeof coachingService.submitReview>) =>
    coachingService.submitReview(...args),
  getCoachDashboard: (...args: Parameters<typeof coachingService.getCoachMarketplaceDashboard>) =>
    coachingService.getCoachMarketplaceDashboard(...args),
  getStudentDashboard: (...args: Parameters<typeof coachingService.getStudentDashboard>) =>
    coachingService.getStudentDashboard(...args),
  getSailingSpecialties: (...args: Parameters<typeof coachingService.getSailingSpecialties>) =>
    coachingService.getSailingSpecialties(...args),
};

const LEGACY_DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const LEGACY_TIME_BLOCKS = [
  { key: 'morning', startHour: 8, endHour: 11 },
  { key: 'afternoon', startHour: 12, endHour: 16 },
  { key: 'evening', startHour: 17, endHour: 20 },
] as const;

function _expandLegacyAvailabilitySlots(records: Record<string, any>[], startDate?: Date, endDate?: Date) {
  if (!records.length) {
    return [];
  }

  const windowStart = startDate ? new Date(startDate) : new Date();
  const windowEnd = endDate ? new Date(endDate) : addDays(windowStart, 14);
  const slots: any[] = [];

  records.forEach((record) => {
    const enabledBlocks = LEGACY_TIME_BLOCKS.filter((block) => record[block.key]);
    if (!enabledBlocks.length) {
      return;
    }

    for (let cursor = new Date(windowStart); cursor <= windowEnd; cursor = addDays(cursor, 1)) {
      const dayKey = LEGACY_DAY_KEYS[cursor.getDay()];
      if (!record[dayKey]) continue;

      enabledBlocks.forEach((block) => {
        const slotStart = new Date(cursor);
        slotStart.setHours(block.startHour, 0, 0, 0);

        const slotEnd = new Date(cursor);
        slotEnd.setHours(block.endHour, 0, 0, 0);

        slots.push({
          id: `${record.id}-${dayKey}-${block.key}-${slotStart.getTime()}`,
          coach_id: record.coach_id,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          is_available: true,
          notes: record.notes || null,
          recurring_pattern: 'legacy',
        });
      });
    }
  });

  return slots.sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}
