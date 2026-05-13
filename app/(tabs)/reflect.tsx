/**
 * Reflect Tab - Personal Progress & Race History
 *
 * Similar to Strava's "You" tab, provides sailors with:
 * - Progress View: Weekly calendar, monthly stats, performance trends
 * - Race Log View: Searchable history of all races
 * - Profile View: User profile, statistics, venues, and boats
 *
 * Design follows Apple Human Interface Guidelines.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { useScrollToolbarHide } from '@/hooks/useScrollToolbarHide';
import { useReflectData, type RaceLogEntry } from '@/hooks/useReflectData';
import { useReflectProfile } from '@/hooks/useReflectProfile';
import { useCoachingInsights } from '@/hooks/useCoachingInsights';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useInterestEventConfig } from '@/hooks/useInterestEventConfig';
import { supabase } from '@/services/supabase';
import { showAlert, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';

import { CompetencyProgressSection } from '@/components/competency';
import {
  WeeklyCalendar,
  MonthlyStatsCard,
  PerformanceTrendChart,
  RaceLogCard,
  RelativeEffortCard,
  ReflectProfileHeader,
  StatisticsSection,
  VenuesVisitedSection,
  BoatsSection,
  AchievementsSection,
  PersonalRecordsCard,
  ChallengesSection,
  // Phase 4: Social
  SocialStatsCard,
  RecentActivitySection,
  // Phase 5: Goals, Insights, Comparisons, Sharing & Gear
  GoalsSection,
  InsightsCard,
  CoachingInsightCard,
  ComparisonCard,
  WeeklySummaryCard,
  GearManagementSection,
  // User-defined skill goals
  MySkillsSection,
  // Phase 6: Training, Heatmap, Recap, Records, Photos, Journal
  TrainingPlansSection,
  VenueHeatmap,
  SeasonRecapCard,
  CourseRecordsSection,
  PhotoGallerySection,
  RaceJournalSection,
} from '@/components/reflect';
import type { RecentActivity } from '@/components/reflect';
import type { SeasonGoal, PerformanceInsight, BoatWithMaintenance, MaintenanceLog } from '@/hooks/useReflectProfile';

// =============================================================================
// TYPES
// =============================================================================

type ReflectSegment = 'progress' | 'racelog' | 'profile';

/** Default segments — overridden per interest via reflectConfig.segments */
const DEFAULT_REFLECT_SEGMENTS = [
  { value: 'progress' as const, label: 'Progress' },
  { value: 'racelog' as const, label: 'Race Log' },
  { value: 'profile' as const, label: 'Profile' },
];

// =============================================================================
// PROGRESS VIEW
// =============================================================================

interface ProgressViewProps {
  toolbarHeight: number;
  onScroll: (event: any) => void;
  isDesktop: boolean;
}

function ProgressView({ toolbarHeight, onScroll, isDesktop }: ProgressViewProps) {
  const { data, loading, refresh } = useReflectData();
  const { userProfile } = useAuth();
  const { currentInterest: _currentInterest } = useInterest();
  const progressEventConfig = useInterestEventConfig();
  const labels = progressEventConfig.reflectConfig?.progressLabels;
  const pStats = progressEventConfig.reflectConfig?.progressStats;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleSeeCalendar = () => {
    router.push('/(tabs)/races');
  };

  const handleSeeMonthStats = () => {
    router.push('/(tabs)/my-learning');
  };

  const handleSeePerformance = () => {
    router.push('/(tabs)/my-learning');
  };

  const handleSeeEffort = () => {
    router.push('/(tabs)/my-learning');
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: toolbarHeight + 20 }]}>
        <Text style={styles.loadingText}>Loading your data...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: toolbarHeight + 20 }]}>
        <Ionicons name={(labels?.emptyIcon ?? 'boat-outline') as any} size={48} color={IOS_COLORS.systemGray3} />
        <Text style={styles.emptyTitle}>No Data Yet</Text>
        <Text style={styles.emptySubtitle}>
          Start adding {progressEventConfig.eventNoun.toLowerCase()}s to see your progress here
        </Text>
        <TouchableOpacity style={styles.emptyPrimaryButton} onPress={() => router.push('/(tabs)/races')}>
          <Text style={styles.emptyPrimaryButtonText}>Go to {progressEventConfig.eventNoun} tab</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: toolbarHeight },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={IOS_COLORS.systemBlue}
        />
      }
    >
      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        {/* Capability Progress — Working On / All / Needs Attention */}
        <CompetencyProgressSection />

        {/* Weekly Activity Calendar */}
        <WeeklyCalendar
          sailingDays={data.sailingDays}
          onSeeMore={handleSeeCalendar}
          seeMoreText={labels?.seeMoreText}
          primaryLegend={labels?.primaryLegend}
          secondaryLegend={labels?.secondaryLegend}
        />

        {/* Monthly Stats */}
        <MonthlyStatsCard
          stats={data.currentMonthStats}
          onSeeMore={handleSeeMonthStats}
          eventVerb={labels?.eventVerb}
          stat1Label={labels?.stat1Label}
          stat2Label={labels?.stat2Label}
          stat3Label={labels?.stat3Label}
          stat4Label={labels?.stat4Label}
          comparisonNoun={labels?.comparisonNoun}
        />

        {/* Performance Trend Chart */}
        <PerformanceTrendChart
          trend={data.performanceTrend}
          onSeeMore={handleSeePerformance}
          subtitle={labels?.performanceSubtitle}
          emptyText={labels?.performanceEmpty}
        />

        {/* Coaching insight — pattern-based recommendations */}
        <CoachingInsightCard sailorId={userProfile?.id} />

        {/* My Skills — user-defined skill goals */}
        <MySkillsSection />

        {/* Relative Effort */}
        <RelativeEffortCard
          effort={data.relativeEffort}
          onSeeMore={handleSeeEffort}
          effortSubtitle={`Your ${(labels?.comparisonNoun ?? 'racing').replace(/s$/, '')} intensity based on weekly activity`}
          eventNounSingular={labels?.comparisonNoun?.replace(/s$/, '') ?? 'race'}
          eventNounPlural={labels?.comparisonNoun ?? 'races'}
        />

        {/* Year Stats Summary */}
        <View style={styles.yearStatsCard}>
          <Text style={styles.yearStatsTitle}>
            {new Date().getFullYear()} Summary
          </Text>
          <View style={styles.yearStatsGrid}>
            <View style={styles.yearStatItem}>
              <Text style={styles.yearStatValue}>
                {data.stats.totalRacesThisYear}
              </Text>
              <Text style={styles.yearStatLabel}>{pStats?.eventsLabel ?? 'Races'}</Text>
            </View>
            <View style={styles.yearStatItem}>
              <Text style={styles.yearStatValue}>
                {data.stats.totalPodiumsThisYear}
              </Text>
              <Text style={styles.yearStatLabel}>{labels?.stat2Label ?? 'Podiums'}</Text>
            </View>
            <View style={styles.yearStatItem}>
              <Text style={styles.yearStatValue}>
                {Math.round(data.stats.totalTimeOnWaterThisYear / 60)}h
              </Text>
              <Text style={styles.yearStatLabel}>{pStats?.hoursLabel ?? 'On Water'}</Text>
            </View>
            <View style={styles.yearStatItem}>
              <Text style={styles.yearStatValue}>
                {data.stats.currentStreak}
              </Text>
              <Text style={styles.yearStatLabel}>{pStats?.streakLabel ?? 'Week Streak'}</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// =============================================================================
// PROFILE VIEW
// =============================================================================

interface ProfileViewProps {
  toolbarHeight: number;
  onScroll: (event: any) => void;
  isDesktop: boolean;
}

function ProfileView({ toolbarHeight, onScroll, isDesktop }: ProfileViewProps) {
  const { data, loading, refresh } = useReflectProfile();
  const { userProfile } = useAuth();
  const { vocab } = useVocabulary();
  const {
    insights: coachingInsights,
    coachingData,
  } = useCoachingInsights(userProfile?.id);
  const [refreshing, setRefreshing] = useState(false);
  const isFreeUser = !userProfile?.subscription_tier || userProfile?.subscription_tier === 'free';

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleEditProfile = () => {
    router.push('/account');
  };

  const handleSeeAllStats = () => {
    router.push('/(tabs)/my-learning');
  };

  const handleSeeAllVenues = () => {
    router.push('/(tabs)/community');
  };

  const handleAddBoat = () => {
    router.push('/(tabs)/boat');
  };

  const handleSeeAllBoats = () => {
    router.push('/(tabs)/boat');
  };

  const handleSeeAllAchievements = () => {
    router.push('/(tabs)/my-learning');
  };

  const handleAchievementPress = (achievement: any) => {
    const relatedRaceId = achievement.relatedRegattaId || achievement.regattaId;
    showAlertWithButtons(
      achievement.title,
      `${achievement.description}\n\nEarned: ${new Date(achievement.earnedAt).toLocaleDateString()}${
        achievement.relatedRegattaName ? `\n\nRace: ${achievement.relatedRegattaName}` : ''
      }`,
      [
        { text: 'Close', style: 'cancel' },
        ...(relatedRaceId
          ? [{
              text: 'Open Race',
              onPress: () => router.push(`/(tabs)/race/${relatedRaceId}` as any),
            }]
          : []),
      ]
    );
  };

  const handleSeeAllRecords = () => {
    router.push('/(tabs)/my-learning');
  };

  const handleSeeAllChallenges = () => {
    router.push('/(tabs)/my-learning');
  };

  const handleJoinChallenge = () => {
    router.push('/(tabs)/my-learning');
  };

  // Phase 4: Social handlers
  const handleSeeAllActivity = () => {
    router.push('/social-notifications');
  };

  const handleActivityPress = (activity: RecentActivity) => {
    // Navigate based on activity type
    if (activity.relatedRegattaId) {
      router.push(`/(tabs)/race/${activity.relatedRegattaId}`);
    } else if (activity.relatedUserId) {
      router.push(`/sailor/${activity.relatedUserId}`);
    }
  };

  // Phase 5: Goals handlers
  const handleSeeAllGoals = () => {
    router.push('/(tabs)/my-learning');
  };

  const handleGoalPress = (goal: SeasonGoal) => {
    showAlertWithButtons(
      goal.title,
      `${goal.description || ''}\n\nProgress: ${goal.currentValue}/${goal.targetValue} ${goal.unit}\nPeriod: ${goal.period}`,
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Open Race Log',
          onPress: () => router.push('/(tabs)/races'),
        },
      ]
    );
  };

  const handleAddGoal = () => {
    router.push('/(tabs)/my-learning');
  };

  // Phase 5: Insights handlers
  const handleSeeAllInsights = () => {
    router.push('/(tabs)/my-learning');
  };

  const handleInsightPress = useCallback(
    async (insight: PerformanceInsight) => {
      // Check if this is a coaching insight card
      if (insight.id.startsWith('coaching-insight-')) {
        const matchingData = coachingData.find(
          (d) => d.insightId === insight.id
        );
        if (!matchingData) {
          showAlert(insight.title, insight.description);
          return;
        }

        if (matchingData.variant === 'has_coach_right_specialty') {
          // Share trend with coach via notification
          if (!matchingData.coachUserId) {
            showAlert('Error', 'Could not identify the coach to share with.');
            return;
          }
          try {
            const { error } = await supabase.from('notifications').insert({
              user_id: matchingData.coachUserId,
              type: 'trend_shared',
              title: 'Performance Trend Shared',
              message: `Your sailor shared a ${matchingData.phase} performance trend with you.`,
              data: {
                sailor_id: userProfile?.id,
                phase: matchingData.phase,
                weak_race_count: matchingData.weakRaceCount,
                total_recent_races: matchingData.totalRecentRaces,
              },
              read: false,
            });

            if (error) throw error;

            showAlert(
              'Trend Shared',
              `Your ${matchingData.phase} trend has been shared with ${matchingData.coachName || 'your coach'}.`
            );
          } catch (err) {
            console.error('[handleInsightPress] Error sharing trend:', err);
            showAlert('Error', 'Could not share this trend. Please try again.');
          }
          return;
        }

        if (matchingData.variant === 'has_coach_wrong_specialty') {
          // Show dialog with two options
          showAlertWithButtons(
            insight.title,
            insight.description,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: `Message ${matchingData.coachName || 'Coach'}`,
                onPress: () => {
                  router.push('/social-notifications');
                },
              },
              {
                text: 'Find Specialist',
                onPress: () => {
                  router.push(
                    `/coach/discover?skill=${matchingData.skillChipKey}` as any
                  );
                },
              },
            ]
          );
          return;
        }

        // no_coach variant — default: show alert
        showAlert(insight.title, insight.description);
        return;
      }

      // Default: non-coaching insight
      showAlert(insight.title, insight.description);
    },
    [coachingData, userProfile?.id]
  );

  // Phase 5: Comparison handlers
  const handleSeeAllComparisons = () => {
    router.push('/(tabs)/my-learning');
  };

  // Phase 5: Weekly Summary handlers
  const handleShareWeeklySummary = () => {
    // The WeeklySummaryCard has built-in share functionality
  };

  const handleSeeWeekDetails = () => {
    router.push('/(tabs)/my-learning');
  };

  // Phase 5: Gear Management handlers
  const handleBoatMaintenancePress = (boat: BoatWithMaintenance) => {
    router.push(`/(tabs)/boat/edit/${boat.id}`);
  };

  const handleMaintenanceLogPress = (log: MaintenanceLog) => {
    const relatedBoatId = (log as any).boatId;
    showAlertWithButtons(
      log.title,
      `${log.description || ''}\n\nType: ${log.type}\nDate: ${new Date(log.date).toLocaleDateString()}\nStatus: ${log.status}${log.cost ? `\nCost: $${log.cost}` : ''}${log.vendor ? `\nVendor: ${log.vendor}` : ''}`,
      [
        { text: 'Close', style: 'cancel' },
        ...(relatedBoatId
          ? [{
              text: 'Open Boat',
              onPress: () => router.push(`/(tabs)/boat/edit/${relatedBoatId}` as any),
            }]
          : []),
      ]
    );
  };

  const handleAddMaintenance = (boatId: string) => {
    router.push(`/(tabs)/boat/edit/${boatId}` as any);
  };

  const handleSeeAllMaintenance = () => {
    router.push('/(tabs)/boat');
  };

  // Phase 6: Training Plans handlers
  const handleStartPlan = (_planId: string) => {
    router.push('/(tabs)/my-learning');
  };

  const handleCompleteActivity = (_planId: string, _activityId: string) => {
    router.push('/(tabs)/my-learning');
  };

  const handleViewPlanDetails = (_planId: string) => {
    // Modal opens in the component
  };

  const handleCreatePlan = () => {
    router.push('/(tabs)/my-learning');
  };

  // Phase 6: Venue Heatmap handlers
  const handleVenuePress = (_venueId: string) => {
    router.push('/(tabs)/community');
  };

  // Phase 6: Season Recap handlers
  const handleShareRecap = () => {
    // Built-in share functionality in component
  };

  const handleViewFullRecap = () => {
    // Modal opens in the component
  };

  // Phase 6: Course Records handlers
  const handleRecordPress = (_recordId: string) => {
    router.push('/(tabs)/my-learning');
  };

  // Phase 6: Photo Gallery handlers
  const handlePhotoPress = (_photoId: string) => {
    // Lightbox opens in the component
  };

  const handleAddPhoto = () => {
    router.push('/(tabs)/races');
  };

  // Phase 6: Race Journal handlers
  const handleJournalEntryPress = (_entryId: string) => {
    // Modal opens in the component
  };

  const handleAddJournalEntry = () => {
    router.push('/(tabs)/races');
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: toolbarHeight + 20 }]}>
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: toolbarHeight + 20 }]}>
        <Ionicons name="person-outline" size={48} color={IOS_COLORS.systemGray3} />
        <Text style={styles.emptyTitle}>Profile Not Available</Text>
        <Text style={styles.emptySubtitle}>
          Sign in to see your sailing profile
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: toolbarHeight },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={IOS_COLORS.systemBlue}
        />
      }
    >
      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        {/* Profile Header */}
        <ReflectProfileHeader
          profile={data.profile}
          stats={data.stats}
          onEditProfile={handleEditProfile}
          vocab={vocab}
        />

        {/* Upgrade Plan Card for free users */}
        {isFreeUser && (
          <TouchableOpacity
            style={styles.upgradePlanCard}
            onPress={() => router.push('/pricing')}
            activeOpacity={0.7}
          >
            <View style={styles.upgradePlanContent}>
              <Ionicons name="rocket-outline" size={24} color="#2563EB" />
              <View style={styles.upgradePlanText}>
                <Text style={styles.upgradePlanTitle}>Upgrade Plan</Text>
                <Text style={styles.upgradePlanSubtitle}>Unlock unlimited races, insights, and more</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* Phase 4: Social Stats */}
        <SocialStatsCard
          userId={data.profile.userId}
          followersCount={data.profile.followerCount}
          followingCount={data.profile.followingCount}
          isOwnProfile={true}
        />

        {/* Phase 4: Recent Activity */}
        <RecentActivitySection
          activities={data.recentActivity}
          onSeeMore={handleSeeAllActivity}
          onActivityPress={handleActivityPress}
        />

        {/* Statistics Section */}
        <StatisticsSection
          stats={data.stats}
          onSeeMore={handleSeeAllStats}
        />

        {/* Venues Visited */}
        <VenuesVisitedSection
          venues={data.venuesVisited}
          onSeeMore={handleSeeAllVenues}
        />

        {/* Boats */}
        <BoatsSection
          boats={data.boats}
          onAddBoat={handleAddBoat}
          onSeeMore={handleSeeAllBoats}
        />

        {/* Phase 3: Achievements */}
        <AchievementsSection
          achievements={data.achievements}
          onSeeMore={handleSeeAllAchievements}
          onAchievementPress={handleAchievementPress}
        />

        {/* Phase 3: Personal Records */}
        <PersonalRecordsCard
          records={data.personalRecords}
          onSeeMore={handleSeeAllRecords}
        />

        {/* Phase 3: Challenges */}
        <ChallengesSection
          challenges={data.challenges}
          onSeeMore={handleSeeAllChallenges}
          onJoinChallenge={handleJoinChallenge}
        />

        {/* Phase 5: Weekly Summary */}
        <WeeklySummaryCard
          summary={data.weeklySummary}
          onShare={handleShareWeeklySummary}
          onSeeDetails={handleSeeWeekDetails}
        />

        {/* Phase 5: Season Goals */}
        <GoalsSection
          goals={data.goals}
          onSeeMore={handleSeeAllGoals}
          onGoalPress={handleGoalPress}
          onAddGoal={handleAddGoal}
        />

        {/* Phase 5: AI Insights */}
        <InsightsCard
          insights={[...coachingInsights, ...data.insights]}
          onSeeMore={handleSeeAllInsights}
          onInsightPress={handleInsightPress}
        />

        {/* Phase 5: Fleet & Sailor Comparisons */}
        <ComparisonCard
          fleetComparison={data.fleetComparison}
          sailorComparisons={data.sailorComparisons}
          onSeeMore={handleSeeAllComparisons}
        />

        {/* Phase 5: Gear Management */}
        <GearManagementSection
          boats={data.boatsWithMaintenance}
          onBoatPress={handleBoatMaintenancePress}
          onMaintenancePress={handleMaintenanceLogPress}
          onAddMaintenance={handleAddMaintenance}
          onSeeAllMaintenance={handleSeeAllMaintenance}
        />

        {/* Phase 6: Training Plans */}
        <TrainingPlansSection
          plans={data.trainingPlans}
          onStartPlan={handleStartPlan}
          onCompleteActivity={handleCompleteActivity}
          onViewPlanDetails={handleViewPlanDetails}
          onCreatePlan={handleCreatePlan}
        />

        {/* Phase 6: Venue Heatmap */}
        <VenueHeatmap
          venues={data.venuesWithCoordinates}
          onVenuePress={handleVenuePress}
        />

        {/* Phase 6: Season Recap */}
        <SeasonRecapCard
          recap={data.seasonRecap}
          onShare={handleShareRecap}
          onViewFullRecap={handleViewFullRecap}
        />

        {/* Phase 6: Course Records */}
        <CourseRecordsSection
          records={data.courseRecords}
          onRecordPress={handleRecordPress}
        />

        {/* Phase 6: Photo Gallery */}
        <PhotoGallerySection
          photos={data.racePhotos}
          onPhotoPress={handlePhotoPress}
          onAddPhoto={handleAddPhoto}
        />

        {/* Phase 6: Race Journal */}
        <RaceJournalSection
          entries={data.raceJournal}
          onEntryPress={handleJournalEntryPress}
          onAddEntry={handleAddJournalEntry}
        />
      </View>
    </ScrollView>
  );
}

// =============================================================================
// RACE LOG VIEW
// =============================================================================

interface RaceLogViewProps {
  toolbarHeight: number;
  onScroll: (event: any) => void;
  isDesktop: boolean;
}

function RaceLogView({ toolbarHeight, onScroll, isDesktop }: RaceLogViewProps) {
  const { data, loading, refresh } = useReflectData();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const filteredRaces = useMemo(() => {
    if (!data?.raceLog) return [];
    if (!searchQuery.trim()) return data.raceLog;

    const query = searchQuery.toLowerCase();
    return data.raceLog.filter(
      (race) =>
        race.name.toLowerCase().includes(query) ||
        race.venueName?.toLowerCase().includes(query) ||
        race.boatClass?.toLowerCase().includes(query)
    );
  }, [data?.raceLog, searchQuery]);

  const handleRacePress = (race: RaceLogEntry) => {
    if (race.regattaId) {
      router.push(`/(tabs)/race/${race.regattaId}`);
    }
  };

  const renderRace = useCallback(
    ({ item }: { item: RaceLogEntry }) => (
      <RaceLogCard race={item} onPress={() => handleRacePress(item)} />
    ),
    []
  );

  const keyExtractor = useCallback((item: RaceLogEntry) => item.id, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: toolbarHeight + 20 }]}>
        <Text style={styles.loadingText}>Loading your race history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.raceLogContainer}>
      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          { marginTop: toolbarHeight + 8 },
          isDesktop && styles.searchContainerDesktop,
        ]}
      >
        <View style={styles.searchInputContainer}>
          <Ionicons
            name="search"
            size={16}
            color={IOS_COLORS.secondaryLabel}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, venue, or class"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Race Count Header */}
      <View style={[styles.raceCountHeader, isDesktop && styles.contentDesktop]}>
        <Text style={styles.raceCountText}>
          {filteredRaces.length} {filteredRaces.length === 1 ? 'race' : 'races'}
          {searchQuery ? ' found' : ''}
        </Text>
      </View>

      {/* Race List */}
      <FlatList
        data={filteredRaces}
        renderItem={renderRace}
        keyExtractor={keyExtractor}
        style={styles.raceList}
        contentContainerStyle={[
          styles.raceListContent,
          isDesktop && styles.contentDesktop,
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={IOS_COLORS.systemBlue}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Ionicons
              name="search-outline"
              size={32}
              color={IOS_COLORS.systemGray3}
            />
            <Text style={styles.emptyListText}>
              {searchQuery
                ? 'No races match your search'
                : 'No races in your history yet'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.emptyInlineButton} onPress={() => router.push('/(tabs)/races')}>
                <Text style={styles.emptyInlineButtonText}>Create your first race</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function ReflectScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const { toolbarHidden, handleScroll: handleToolbarScroll } = useScrollToolbarHide();
  const [activeSegment, setActiveSegment] = useState<ReflectSegment>('progress');
  const eventConfig = useInterestEventConfig();

  // Use interest-specific segment labels from config, falling back to defaults
  const reflectSegments = useMemo(() => {
    const configSegments = eventConfig.reflectConfig?.segments;
    if (configSegments && configSegments.length > 0) {
      return configSegments.map((s) => ({
        value: s.value as ReflectSegment,
        label: s.label,
      }));
    }
    return DEFAULT_REFLECT_SEGMENTS;
  }, [eventConfig.reflectConfig?.segments]);

  const isDesktop = width > 768;

  return (
    <View style={styles.container}>
      {/* Content */}
      {activeSegment === 'progress' && (
        <ProgressView
          toolbarHeight={toolbarHeight}
          onScroll={handleToolbarScroll}
          isDesktop={isDesktop}
        />
      )}
      {activeSegment === 'racelog' && (
        <RaceLogView
          toolbarHeight={toolbarHeight}
          onScroll={handleToolbarScroll}
          isDesktop={isDesktop}
        />
      )}
      {activeSegment === 'profile' && (
        <ProfileView
          toolbarHeight={toolbarHeight}
          onScroll={handleToolbarScroll}
          isDesktop={isDesktop}
        />
      )}

      {/* Toolbar */}
      <TabScreenToolbar
        title="Reflect"
        topInset={insets.top}
        onMeasuredHeight={setToolbarHeight}
        hidden={toolbarHidden}
        actions={[
          {
            icon: 'share-outline',
            sfSymbol: 'square.and.arrow.up',
            label: 'Export progress',
            onPress: () => router.push('/account'),
          },
        ]}
      >
        {/* Segmented Control */}
        <View style={styles.segmentedControlContainer}>
          <IOSSegmentedControl
            segments={reflectSegments}
            selectedValue={activeSegment}
            onValueChange={setActiveSegment}
          />
        </View>
      </TabScreenToolbar>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  segmentedControlContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  content: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  contentDesktop: {
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  emptyPrimaryButton: {
    marginTop: 6,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Year Stats Card
  yearStatsCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  yearStatsTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
    marginBottom: 16,
  },
  yearStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  yearStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  yearStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: IOS_COLORS.systemBlue,
    letterSpacing: -0.5,
  },
  yearStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Race Log View
  raceLogContainer: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchContainerDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  raceCountHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  raceCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  raceList: {
    flex: 1,
  },
  raceListContent: {
    paddingBottom: 120,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    maxWidth: 1200,
    alignSelf: 'center',
    width: 'calc(100% - 32px)',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyListText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  emptyInlineButton: {
    marginTop: 2,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyInlineButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Upgrade Plan Card
  upgradePlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  upgradePlanContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  upgradePlanText: {
    flex: 1,
  },
  upgradePlanTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
  },
  upgradePlanSubtitle: {
    fontSize: 13,
    color: '#3B82F6',
    marginTop: 2,
  },
});
