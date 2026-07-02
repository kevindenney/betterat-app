/**
 * Coaching Hub Screen - Tufte Edition
 *
 * Design principles:
 * 1. Maximum data-ink ratio - remove decorative elements
 * 2. Typography hierarchy - use weight/size instead of boxes
 * 3. Hairline borders (0.5px) or none
 * 4. Whitespace replaces boxes for separation
 * 5. Dense row layout - all data visible, scannable
 */

import { CoachDashboard } from '@/components/coaching/CoachDashboard';
import { TufteCoachRow } from '@/components/coaching/TufteCoachRow';
import { IOS_COLORS, TUFTE_BACKGROUND } from '@/components/cards/constants';
import { TufteTokens } from '@/constants/designSystem';
import {
  useCoachMetrics,
  useCoachResources,
  useCoachSpotlights,
  useRecentCoachSessions,
  useUpcomingCoachSessions,
} from '@/hooks/useCoachData';
import { useAuth } from '@/providers/AuthProvider';
import { CoachProfile, CoachingSession } from '@/services/CoachingService';
import { coachStrategyService } from '@/services/CoachStrategyService';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type DiscoverCoach = CoachProfile & {
  hourly_rate_usd?: number | null;
  rating?: number | null;
};

type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

type FeedbackItem = {
  id: string;
  coach: string;
  sailor: string;
  sessionType: string;
  summary: string;
  rating: number;
  date: string;
};

type ResourceItem = {
  id: string;
  title: string;
  category: string;
  readTime: string;
};

const MOCK_SESSIONS: CoachingSession[] = [
  {
    id: 'mock-session-1',
    coach_id: 'coach_emily',
    sailor_id: 'sailor_ava',
    session_type: 'strategy',
    duration_minutes: 75,
    scheduled_at: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
    status: 'confirmed',
    location_notes: 'Royal HKYC • Dock C',
    focus_areas: ['start_line', 'wind_shifts', 'mark_rounding'],
    goals: 'Build pre-start routine for oscillating breeze',
    currency: 'USD',
    paid: true,
    fee_amount: 22000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    coach: {
      id: 'coach_emily',
      display_name: 'Emily Carter',
      profile_photo_url: null,
    },
  },
  {
    id: 'mock-session-2',
    coach_id: 'coach_luke',
    sailor_id: 'sailor_mateo',
    session_type: 'video_review',
    duration_minutes: 60,
    scheduled_at: new Date(Date.now() + 1000 * 60 * 60 * 54).toISOString(),
    status: 'scheduled',
    location_notes: 'Zoom',
    focus_areas: ['downwind_modes', 'overtaking'],
    homework: 'Pull mark rounding clips',
    currency: 'USD',
    paid: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    coach: {
      id: 'coach_luke',
      display_name: 'Luke Anders',
      profile_photo_url: null,
    },
  },
  {
    id: 'mock-session-3',
    coach_id: 'coach_sophia',
    sailor_id: 'sailor_hannah',
    session_type: 'boat_setup',
    duration_minutes: 90,
    scheduled_at: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
    status: 'pending',
    location_notes: 'Dockside tuning',
    focus_areas: ['rig_tension', 'mast_rake'],
    goals: 'Baseline rig tune for 18-22kt',
    currency: 'USD',
    paid: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    coach: {
      id: 'coach_sophia',
      display_name: 'Sophia Lin',
      profile_photo_url: null,
    },
  },
] as CoachingSession[];

const MOCK_COACHES: DiscoverCoach[] = [
  {
    id: 'coach_emily',
    user_id: 'user_emily',
    display_name: 'Emily Carter',
    profile_photo_url: null,
    bio: 'Olympic strategist · Match racing specialist',
    specialties: ['pre-starts', 'match_racing', 'race_strategy'],
    experience_years: 12,
    certifications: ['World Sailing L3 Coach'],
    available_for_sessions: true,
    hourly_rate: 24000,
    currency: 'USD',
    based_at: 'Hong Kong',
    available_locations: ['Asia Pacific'],
    total_sessions: 318,
    total_clients: 64,
    average_rating: 4.9,
    verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    hourly_rate_usd: 24000,
    rating: 4.9,
  },
  {
    id: 'coach_luke',
    user_id: 'user_luke',
    display_name: 'Luke Anders',
    profile_photo_url: null,
    bio: 'AC40 flight controller · Downwind VMG specialist',
    specialties: ['downwind_modes', 'foiling', 'video_analysis'],
    experience_years: 8,
    certifications: ['US Sailing L2 Coach'],
    available_for_sessions: true,
    hourly_rate: 20000,
    currency: 'USD',
    based_at: 'San Francisco',
    available_locations: ['Remote', 'San Francisco'],
    total_sessions: 204,
    total_clients: 51,
    average_rating: 4.8,
    verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    hourly_rate_usd: 20000,
    rating: 4.8,
  },
  {
    id: 'coach_sophia',
    user_id: 'user_sophia',
    display_name: 'Sophia Lin',
    profile_photo_url: null,
    bio: 'Former Volvo Ocean Race · Rig tuning expert',
    specialties: ['boat_speed', 'rig_tune', 'sail_shape'],
    experience_years: 15,
    certifications: ['RYA High Performance'],
    available_for_sessions: true,
    hourly_rate: 22000,
    currency: 'USD',
    based_at: 'Hong Kong',
    available_locations: ['Hong Kong', 'Singapore'],
    total_sessions: 412,
    total_clients: 83,
    average_rating: 5,
    verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    hourly_rate_usd: 22000,
    rating: 5,
  },
];

const MOCK_FEEDBACK: FeedbackItem[] = [
  {
    id: 'feedback-1',
    coach: 'Emily Carter',
    sailor: 'Ava Thompson',
    sessionType: 'Race Strategy',
    summary: 'Shift recognition routine locked in during practice.',
    rating: 5,
    date: format(new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), 'MMM d'),
  },
  {
    id: 'feedback-2',
    coach: 'Luke Anders',
    sailor: 'Mateo Ruiz',
    sessionType: 'Video Review',
    summary: 'Downwind mode selection breakthrough.',
    rating: 4,
    date: format(new Date(Date.now() - 1000 * 60 * 60 * 24 * 6), 'MMM d'),
  },
];

const MOCK_RESOURCES: ResourceItem[] = [
  {
    id: 'resource-1',
    title: 'Five drills to teach start line time-on-distance intuition',
    category: 'Training Plans',
    readTime: '7 min',
  },
  {
    id: 'resource-2',
    title: 'Using polar overlays to accelerate heavy-air coaching blocks',
    category: 'Analytics',
    readTime: '5 min',
  },
];

const MOCK_METRICS: DashboardMetric[] = [
  { label: 'Upcoming', value: '3', helper: 'sessions' },
  { label: 'Coaches', value: '6', helper: 'active' },
  { label: 'Rating', value: '4.8', helper: 'avg' },
  { label: 'Hours', value: '11.5', helper: 'this month' },
];

export default function CoachingHubScreen() {
  // === ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS ===

  const router = useRouter();
  const { user, isGuest, capabilities } = useAuth();
  const isAuthenticated = !!user && !isGuest;

  const [isCoach, setIsCoach] = useState(false);
  const [checkingCoachStatus, setCheckingCoachStatus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function checkCoachStatus() {
      if (!user?.id) {
        setCheckingCoachStatus(false);
        return;
      }

      const profile = await coachStrategyService.getCoachProfileByUserId(user.id);
      setIsCoach(!!profile);
      setCheckingCoachStatus(false);
    }

    checkCoachStatus();
  }, [user?.id]);

  const {
    data: upcomingSessionsData = [],
    isLoading: loadingUpcomingSessions,
    error: upcomingSessionsError,
    refetch: refetchUpcomingSessions,
  } = useUpcomingCoachSessions(8);

  const {
    data: recentSessionsData = [],
    isLoading: loadingRecentSessions,
    error: recentSessionsError,
    refetch: refetchRecentSessions,
  } = useRecentCoachSessions(6);

  const {
    data: coaches = [],
    isLoading: loadingCoaches,
    error: coachesError,
    refetch: refetchCoaches,
  } = useCoachSpotlights({
    minRating: 4,
    availability: 'next_30_days',
  });

  const { data: metricsData, isLoading: loadingMetrics } = useCoachMetrics();
  const { data: resources = [] } = useCoachResources();

  const loading = loadingUpcomingSessions || loadingRecentSessions || loadingCoaches || loadingMetrics;
  const error = upcomingSessionsError || recentSessionsError || coachesError;

  const upcomingSource = upcomingSessionsData.length > 0 ? upcomingSessionsData : MOCK_SESSIONS;
  const recentSource = recentSessionsData.length > 0
    ? recentSessionsData
    : upcomingSessionsData.length > 0 ? upcomingSessionsData : MOCK_SESSIONS;
  const coachesToUse = coaches.length > 0
    ? coaches.map((coach) => ({
        ...coach,
        hourly_rate_usd: coach.hourly_rate ?? null,
        rating: coach.average_rating ?? null,
      }))
    : MOCK_COACHES;

  const allSessionsData = [...upcomingSessionsData, ...recentSessionsData];

  const upcomingSessions = useMemo(() => {
    return (upcomingSource || [])
      .filter((session) =>
        ['scheduled', 'confirmed', 'pending'].includes((session.status || '').toLowerCase())
      )
      .sort(
        (a, b) => sessionScheduledDate(a).getTime() - sessionScheduledDate(b).getTime()
      )
      .slice(0, 4);
  }, [upcomingSource]);

  const feedbackItems = useMemo(() => {
    const completed = (recentSource || []).filter(
      (session) => (session.status || '').toLowerCase() === 'completed'
    );
    if (completed.length === 0) return MOCK_FEEDBACK;
    return completed
      .map((session) => ({
        id: session.id,
        coach: session.coach?.display_name || 'Coach',
        sailor: session.sailor?.full_name || session.sailor?.email || 'Sailor',
        sessionType: formatSessionType(session.session_type || ''),
        summary: session.session_notes || 'Feedback shared with sailor.',
        rating: session.feedback?.rating ?? 5,
        date: format(sessionCompletedDate(session), 'MMM d'),
      }))
      .slice(0, 2);
  }, [recentSource]);

  const metrics = useMemo<DashboardMetric[]>(() => {
    if (metricsData) {
      return [
        { label: 'Upcoming', value: `${metricsData.upcomingSessions || 0}`, helper: 'sessions' },
        { label: 'Coaches', value: `${metricsData.activeClients || 0}`, helper: 'active' },
        { label: 'Rating', value: metricsData.averageRating ? metricsData.averageRating.toFixed(1) : '—', helper: 'avg' },
        { label: 'Sessions', value: `${metricsData.sessionsThisMonth || 0}`, helper: 'this month' },
      ];
    }

    if (!allSessionsData || allSessionsData.length === 0) return MOCK_METRICS;

    const scheduled = upcomingSessions.length;
    const uniqueCoaches = new Set(
      allSessionsData.map((session) => session.coach?.id || session.coach_id).filter(Boolean)
    ).size;
    const totalMinutes = allSessionsData.reduce(
      (sum, session) => sum + (session.duration_minutes || 0), 0
    );
    const ratings = allSessionsData
      .filter((session) => session.feedback?.rating)
      .map((session) => session.feedback?.rating || 0);
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : '—';

    return [
      { label: 'Upcoming', value: `${scheduled}`, helper: 'sessions' },
      { label: 'Coaches', value: `${Math.max(uniqueCoaches, 1)}`, helper: 'active' },
      { label: 'Rating', value: avgRating, helper: 'avg' },
      { label: 'Hours', value: `${(totalMinutes / 60).toFixed(1)}`, helper: 'this month' },
    ];
  }, [metricsData, allSessionsData, upcomingSessions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchUpcomingSessions(),
      refetchRecentSessions(),
      refetchCoaches(),
    ]);
    setRefreshing(false);
  };

  // === EARLY RETURNS ===

  // Guest/unauthenticated view
  if (!isAuthenticated) {
    return (
      <GuestCoachingView
        coaches={coachesToUse}
        loading={loadingCoaches}
        onSignUp={() => router.push('/(auth)/signup')}
        onLogIn={() => router.push('/(auth)/login')}
        onBecomeCoach={() => router.push('/(auth)/coach-onboarding-welcome')}
        onCoachPress={(coachId) => router.push(`/coach/${coachId}`)}
      />
    );
  }

  if (checkingCoachStatus) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={IOS_COLORS.blue} />
      </View>
    );
  }

  if (isCoach) {
    return <CoachDashboard />;
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={IOS_COLORS.blue} />
        <Text style={styles.loadingText}>Loading coaching workspace…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={IOS_COLORS.blue} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Coaching</Text>
          <Text style={styles.headerSubtitle}>
            Book sessions with world-class coaches
          </Text>
        </View>

        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Showing sample data while reconnecting…
            </Text>
          </View>
        )}

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          {metrics.map((metric, index) => (
            <View key={metric.label} style={styles.metricItem}>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricHelper}>{metric.helper}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <TufteSection
          title="QUICK ACTIONS"
          action="Manage"
          onActionPress={() => router.push('/coach/my-bookings')}
        >
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity
              style={styles.quickActionRow}
              onPress={() => router.push('/coach/discover')}
            >
              <View style={styles.quickActionLeft}>
                <Ionicons name="search-outline" size={18} color={IOS_COLORS.secondaryLabel} />
                <Text style={styles.quickActionLabel}>Discover coaches</Text>
              </View>
              <Text style={styles.quickActionChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionRow}
              onPress={() => router.push('/coach/my-bookings')}
            >
              <View style={styles.quickActionLeft}>
                <Ionicons name="clipboard-outline" size={18} color={IOS_COLORS.secondaryLabel} />
                <Text style={styles.quickActionLabel}>Manage sessions</Text>
              </View>
              <Text style={styles.quickActionChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionRow}
              onPress={() => router.push('/coach/book')}
            >
              <View style={styles.quickActionLeft}>
                <Ionicons name="cloud-upload-outline" size={18} color={IOS_COLORS.secondaryLabel} />
                <Text style={styles.quickActionLabel}>Upload race video</Text>
              </View>
              <Text style={styles.quickActionChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionRow}
              onPress={() => router.push('/coach/confirmation')}
            >
              <View style={styles.quickActionLeft}>
                <Ionicons name="chatbubbles-outline" size={18} color={IOS_COLORS.secondaryLabel} />
                <Text style={styles.quickActionLabel}>Share feedback</Text>
              </View>
              <Text style={styles.quickActionChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionRow, styles.quickActionRowLast]}
              onPress={() => router.push('/coach/profile-edit')}
            >
              <View style={styles.quickActionLeft}>
                <Ionicons name="person-circle-outline" size={18} color={IOS_COLORS.secondaryLabel} />
                <Text style={styles.quickActionLabel}>Edit Profile</Text>
              </View>
              <Text style={styles.quickActionChevron}>›</Text>
            </TouchableOpacity>
          </View>
        </TufteSection>

        {/* Upcoming Sessions */}
        <TufteSection
          title="UPCOMING SESSIONS"
          action="Calendar"
          onActionPress={() => router.push('/coach/my-bookings')}
        >
          <View style={styles.sessionsContainer}>
            {upcomingSessions.map((session, index) => (
              <TufteSessionRow
                key={session.id}
                session={session}
                onPress={() => router.push('/coach/my-bookings')}
                isLast={index === upcomingSessions.length - 1}
              />
            ))}
            {upcomingSessions.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No upcoming sessions</Text>
              </View>
            )}
          </View>
        </TufteSection>

        {/* Featured Coaches */}
        <TufteSection
          title="FEATURED COACHES"
          action="See all"
          onActionPress={() => router.push('/coach/discover-enhanced')}
        >
          <View style={styles.coachesContainer}>
            {coachesToUse.slice(0, 4).map((coach, index) => (
              <TufteCoachRow
                key={coach.id}
                name={coach.display_name || 'Coach'}
                bio={coach.bio}
                specialties={coach.specialties}
                rating={coach.average_rating}
                totalSessions={coach.total_sessions}
                hourlyRate={coach.hourly_rate}
                currency={coach.currency}
                location={coach.based_at || coach.available_locations?.[0]}
                onPress={() => router.push(`/coach/${coach.id}`)}
                onContact={() => router.push(`/coach/${coach.id}?action=book`)}
                isLast={index === Math.min(coachesToUse.length, 4) - 1}
              />
            ))}
          </View>
        </TufteSection>

        {/* Recent Feedback */}
        <TufteSection title="RECENT FEEDBACK">
          <View style={styles.feedbackContainer}>
            {feedbackItems.map((item, index) => (
              <TufteFeedbackRow
                key={item.id}
                feedback={item}
                isLast={index === feedbackItems.length - 1}
              />
            ))}
          </View>
        </TufteSection>

        {/* Resources */}
        <TufteSection
          title="RESOURCES"
          action="Library"
          onActionPress={() => router.push('/coach/discover-enhanced')}
        >
          <View style={styles.resourcesContainer}>
            {(resources.length > 0 ? resources : MOCK_RESOURCES).map((resource, index, arr) => (
              <TufteResourceRow
                key={resource.id}
                resource={resource}
                isLast={index === arr.length - 1}
              />
            ))}
          </View>
        </TufteSection>

        {/* Become a Coach CTA - only for sailors without coaching capability */}
        {!capabilities?.hasCoaching && (
          <TufteSection title="BECOME A COACH">
            <View style={styles.becomeCoachContainer}>
              <View style={styles.becomeCoachContent}>
                <Text style={styles.becomeCoachTitle}>Share Your Expertise</Text>
                <Text style={styles.becomeCoachDescription}>
                  Turn your sailing knowledge into income. Coach sailors worldwide, set your own rates, and build your reputation on BetterAt.
                </Text>
                <TouchableOpacity
                  style={styles.becomeCoachButton}
                  onPress={() => router.push('/(auth)/coach-onboarding-welcome')}
                >
                  <Text style={styles.becomeCoachButtonText}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </TufteSection>
        )}

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// TUFTE COMPONENTS
// =============================================================================

function TufteSection({
  title,
  action,
  onActionPress,
  children,
}: {
  title: string;
  action?: string;
  onActionPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && onActionPress && (
          <TouchableOpacity onPress={onActionPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.sectionAction}>{action}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function TufteSessionRow({
  session,
  onPress,
  isLast,
}: {
  session: CoachingSession;
  onPress: () => void;
  isLast: boolean;
}) {
  const scheduledDate = sessionScheduledDate(session);
  const coachName = session.coach?.display_name || 'Coach pending';
  const sessionType = formatSessionType(session.session_type || '');
  const location = session.location_notes || '';

  const statusColor = session.status === 'confirmed'
    ? IOS_COLORS.green
    : session.status === 'pending'
      ? IOS_COLORS.orange
      : IOS_COLORS.blue;

  return (
    <TouchableOpacity
      style={[styles.sessionRow, isLast && styles.sessionRowLast]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.sessionLeft}>
        <View style={styles.sessionDateBox}>
          <Text style={styles.sessionDateDay}>{format(scheduledDate, 'd')}</Text>
          <Text style={styles.sessionDateMonth}>{format(scheduledDate, 'MMM')}</Text>
        </View>
      </View>
      <View style={styles.sessionContent}>
        <View style={styles.sessionTopRow}>
          <Text style={styles.sessionCoach}>{coachName}</Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>
        <Text style={styles.sessionType}>{sessionType}</Text>
        <Text style={styles.sessionMeta}>
          {format(scheduledDate, 'h:mm a')}
          {location ? ` · ${location}` : ''}
        </Text>
      </View>
      <Text style={styles.sessionChevron}>›</Text>
    </TouchableOpacity>
  );
}

function TufteFeedbackRow({
  feedback,
  isLast,
}: {
  feedback: FeedbackItem;
  isLast: boolean;
}) {
  return (
    <View style={[styles.feedbackRow, isLast && styles.feedbackRowLast]}>
      <View style={styles.feedbackTop}>
        <Text style={styles.feedbackCoach}>{feedback.coach}</Text>
        <View style={styles.feedbackRating}>
          <Text style={styles.feedbackRatingText}>★ {feedback.rating.toFixed(1)}</Text>
          <Text style={styles.feedbackDate}>{feedback.date}</Text>
        </View>
      </View>
      <Text style={styles.feedbackType}>{feedback.sessionType}</Text>
      <Text style={styles.feedbackSummary} numberOfLines={2}>{feedback.summary}</Text>
    </View>
  );
}

function TufteResourceRow({
  resource,
  isLast,
}: {
  resource: ResourceItem;
  isLast: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.resourceRow, isLast && styles.resourceRowLast]} activeOpacity={0.6}>
      <View style={styles.resourceContent}>
        <Text style={styles.resourceCategory}>{resource.category}</Text>
        <Text style={styles.resourceTitle} numberOfLines={2}>{resource.title}</Text>
      </View>
      <View style={styles.resourceRight}>
        <Text style={styles.resourceTime}>{resource.readTime}</Text>
        <Text style={styles.resourceChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// GUEST VIEW COMPONENT
// =============================================================================

interface GuestCoachingViewProps {
  coaches: DiscoverCoach[];
  loading: boolean;
  onSignUp: () => void;
  onLogIn: () => void;
  onBecomeCoach: () => void;
  onCoachPress: (coachId: string) => void;
}

function GuestCoachingView({
  coaches,
  loading,
  onSignUp,
  onLogIn,
  onBecomeCoach,
  onCoachPress,
}: GuestCoachingViewProps) {
  const benefits = [
    { icon: 'videocam-outline' as const, text: 'Video analysis & race debriefs' },
    { icon: 'boat-outline' as const, text: 'On-water & remote sessions' },
    { icon: 'shield-checkmark-outline' as const, text: 'Secure payments & scheduling' },
    { icon: 'star-outline' as const, text: 'Verified coach reviews' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.guestScrollContent}>
        {/* Hero Section */}
        <View style={styles.guestHero}>
          <View style={styles.guestHeroIcon}>
            <Ionicons name="school" size={48} color={IOS_COLORS.blue} />
          </View>
          <Text style={styles.guestHeroTitle}>Find Your Perfect Coach</Text>
          <Text style={styles.guestHeroSubtitle}>
            Connect with Olympic coaches, match racing pros, and foiling experts for personalized training sessions.
          </Text>
        </View>

        {/* Featured Coaches Preview */}
        <TufteSection title="FEATURED COACHES">
          <View style={styles.coachesContainer}>
            {loading ? (
              <View style={styles.guestLoadingCoaches}>
                <ActivityIndicator size="small" color={IOS_COLORS.blue} />
                <Text style={styles.guestLoadingText}>Loading coaches...</Text>
              </View>
            ) : (
              coaches.slice(0, 3).map((coach, index) => (
                <TouchableOpacity
                  key={coach.id}
                  style={[styles.guestCoachRow, index === Math.min(coaches.length, 3) - 1 && styles.guestCoachRowLast]}
                  onPress={() => onCoachPress(coach.id)}
                  activeOpacity={0.6}
                >
                  <View style={styles.guestCoachAvatar}>
                    <Ionicons name="person" size={24} color={IOS_COLORS.secondaryLabel} />
                  </View>
                  <View style={styles.guestCoachInfo}>
                    <View style={styles.guestCoachNameRow}>
                      <Text style={styles.guestCoachName}>{coach.display_name}</Text>
                      {coach.average_rating && (
                        <Text style={styles.guestCoachRating}>★ {coach.average_rating.toFixed(1)}</Text>
                      )}
                    </View>
                    <Text style={styles.guestCoachBio} numberOfLines={1}>{coach.bio}</Text>
                    <Text style={styles.guestCoachMeta}>
                      {coach.based_at} · {coach.total_sessions || 0} sessions
                    </Text>
                  </View>
                  <Text style={styles.guestCoachChevron}>›</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </TufteSection>

        {/* Benefits Section */}
        <TufteSection title="WHY REGATTAFLOW COACHING">
          <View style={styles.guestBenefitsContainer}>
            {benefits.map((benefit, index) => (
              <View
                key={benefit.text}
                style={[styles.guestBenefitRow, index === benefits.length - 1 && styles.guestBenefitRowLast]}
              >
                <Ionicons name={benefit.icon} size={20} color={IOS_COLORS.blue} />
                <Text style={styles.guestBenefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>
        </TufteSection>

        {/* CTA Section */}
        <View style={styles.guestCTAContainer}>
          <TouchableOpacity style={styles.guestPrimaryButton} onPress={onSignUp}>
            <Text style={styles.guestPrimaryButtonText}>Sign Up to Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.guestSecondaryButton} onPress={onLogIn}>
            <Text style={styles.guestSecondaryButtonText}>Already have an account? Log In</Text>
          </TouchableOpacity>
        </View>

        {/* Become a Coach Section */}
        <View style={styles.guestBecomeCoachSection}>
          <View style={styles.guestBecomeCoachContent}>
            <Ionicons name="trophy-outline" size={28} color={IOS_COLORS.blue} style={{ marginBottom: 12 }} />
            <Text style={styles.guestBecomeCoachTitle}>Are you a coach?</Text>
            <Text style={styles.guestBecomeCoachDescription}>
              Share your expertise and earn money coaching sailors worldwide on BetterAt.
            </Text>
            <TouchableOpacity style={styles.guestBecomeCoachButton} onPress={onBecomeCoach}>
              <Text style={styles.guestBecomeCoachButtonText}>Become a Coach</Text>
              <Ionicons name="arrow-forward" size={16} color={IOS_COLORS.blue} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TUFTE_BACKGROUND,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: TUFTE_BACKGROUND,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },

  // Header
  header: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: TufteTokens.spacing.section,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.color,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
  },

  // Error banner
  errorBanner: {
    paddingVertical: 8,
    paddingHorizontal: TufteTokens.spacing.section,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: '#FDE68A',
  },
  errorText: {
    fontSize: 13,
    color: '#92400E',
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: TufteTokens.spacing.section,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.color,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  metricHelper: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 1,
  },

  // Section
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: 8,
    paddingHorizontal: TufteTokens.spacing.section,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },

  // Quick Actions
  quickActionsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: TufteTokens.borders.hairline,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: TufteTokens.spacing.section,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
    minHeight: 44,
  },
  quickActionRowLast: {
    borderBottomWidth: 0,
  },
  quickActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickActionLabel: {
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  quickActionChevron: {
    fontSize: 18,
    color: IOS_COLORS.gray3,
  },

  // Sessions
  sessionsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: TufteTokens.borders.hairline,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: TufteTokens.spacing.section,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
    minHeight: 72,
  },
  sessionRowLast: {
    borderBottomWidth: 0,
  },
  sessionLeft: {
    marginRight: 12,
  },
  sessionDateBox: {
    width: 40,
    alignItems: 'center',
  },
  sessionDateDay: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  sessionDateMonth: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
  sessionContent: {
    flex: 1,
    gap: 2,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionCoach: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sessionType: {
    fontSize: 13,
    color: IOS_COLORS.blue,
  },
  sessionMeta: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  sessionChevron: {
    fontSize: 18,
    color: IOS_COLORS.gray3,
    marginLeft: 8,
  },

  // Coaches
  coachesContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: TufteTokens.borders.hairline,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
  },

  // Feedback
  feedbackContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: TufteTokens.borders.hairline,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
  },
  feedbackRow: {
    paddingVertical: 12,
    paddingHorizontal: TufteTokens.spacing.section,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
  },
  feedbackRowLast: {
    borderBottomWidth: 0,
  },
  feedbackTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  feedbackCoach: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  feedbackRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackRatingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F59E0B',
  },
  feedbackDate: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  feedbackType: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  feedbackSummary: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },

  // Resources
  resourcesContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: TufteTokens.borders.hairline,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: TufteTokens.spacing.section,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
    minHeight: 56,
  },
  resourceRowLast: {
    borderBottomWidth: 0,
  },
  resourceContent: {
    flex: 1,
    gap: 2,
  },
  resourceCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resourceTitle: {
    fontSize: 14,
    color: IOS_COLORS.label,
    lineHeight: 18,
  },
  resourceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  resourceTime: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  resourceChevron: {
    fontSize: 18,
    color: IOS_COLORS.gray3,
  },

  // Empty state
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: IOS_COLORS.tertiaryLabel,
  },

  // ==========================================================================
  // GUEST VIEW STYLES
  // ==========================================================================

  guestScrollContent: {
    paddingBottom: 40,
  },

  // Guest Hero
  guestHero: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: TufteTokens.spacing.section,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.color,
  },
  guestHeroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  guestHeroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: IOS_COLORS.label,
    textAlign: 'center',
    marginBottom: 12,
  },
  guestHeroSubtitle: {
    fontSize: 16,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },

  // Guest Loading Coaches
  guestLoadingCoaches: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  guestLoadingText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },

  // Guest Coach Row
  guestCoachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: TufteTokens.spacing.section,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
  },
  guestCoachRowLast: {
    borderBottomWidth: 0,
  },
  guestCoachAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  guestCoachInfo: {
    flex: 1,
    gap: 2,
  },
  guestCoachNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guestCoachName: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  guestCoachRating: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F59E0B',
  },
  guestCoachBio: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  guestCoachMeta: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  guestCoachChevron: {
    fontSize: 20,
    color: IOS_COLORS.gray3,
    marginLeft: 8,
  },

  // Guest Benefits
  guestBenefitsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: TufteTokens.borders.hairline,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
  },
  guestBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: TufteTokens.spacing.section,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
    gap: 12,
  },
  guestBenefitRowLast: {
    borderBottomWidth: 0,
  },
  guestBenefitText: {
    fontSize: 15,
    color: IOS_COLORS.label,
  },

  // Guest CTA
  guestCTAContainer: {
    paddingVertical: 32,
    paddingHorizontal: TufteTokens.spacing.section,
    gap: 12,
  },
  guestPrimaryButton: {
    backgroundColor: IOS_COLORS.blue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  guestPrimaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  guestSecondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  guestSecondaryButtonText: {
    fontSize: 15,
    color: IOS_COLORS.blue,
  },

  // Guest Become a Coach
  guestBecomeCoachSection: {
    marginHorizontal: TufteTokens.spacing.section,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TufteTokens.borders.color,
    overflow: 'hidden',
  },
  guestBecomeCoachContent: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  guestBecomeCoachTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  guestBecomeCoachDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  guestBecomeCoachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: IOS_COLORS.blue,
  },
  guestBecomeCoachButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },

  // ==========================================================================
  // BECOME A COACH SECTION (Authenticated Sailor)
  // ==========================================================================

  becomeCoachContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: TufteTokens.borders.hairline,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
  },
  becomeCoachContent: {
    paddingVertical: 20,
    paddingHorizontal: TufteTokens.spacing.section,
  },
  becomeCoachTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  becomeCoachDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
    marginBottom: 16,
  },
  becomeCoachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 20,
  },
  becomeCoachButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

// =============================================================================
// HELPERS
// =============================================================================

const sessionScheduledDate = (session: CoachingSession) => {
  if (session.scheduled_at) return new Date(session.scheduled_at);
  if (session.start_time) return new Date(session.start_time);
  if ((session as any).session_date) return new Date((session as any).session_date);
  return new Date();
};

const sessionCompletedDate = (session: CoachingSession) => {
  if (session.completed_at) return new Date(session.completed_at);
  if ((session as any).updated_at) return new Date((session as any).updated_at);
  return sessionScheduledDate(session);
};

const formatSessionType = (type: string) => {
  const mapping: Record<string, string> = {
    on_water: 'On-Water Training',
    video_review: 'Video Review',
    strategy: 'Race Strategy',
    boat_setup: 'Boat Setup',
    fitness: 'Fitness Coaching',
    mental_coaching: 'Mental Coaching',
    one_on_one: 'One-on-One',
    group: 'Group Session',
    race_debrief: 'Race Debrief',
  };
  return mapping[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
};
