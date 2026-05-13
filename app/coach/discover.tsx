import { useSailorDashboardData } from '@/hooks/useSailorDashboardData';
import { useSailorUpcomingSessions } from '@/hooks/useSailorCoachingSessions';
import { useAuth } from '@/providers/AuthProvider';
import { CoachProfile } from '@/services/CoachingService';
import { supabase } from '@/services/supabase';
import { TufteCoachRow } from '@/components/coach/TufteCoachRow';
import { TufteFiltersBar } from '@/components/coach/TufteFiltersBar';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoachWithScore extends CoachProfile {
  display_name?: string | null;
  profile_photo_url?: string | null;
  compatibilityScore?: number;
  matchReasoning?: string;
  recommendations?: string[];
  scoreBreakdown?: {
    experienceMatch: number;
    teachingStyleMatch: number;
    specialtyAlignment: number;
    successRateRelevance: number;
    availabilityMatch: number;
    locationConvenience: number;
    valueScore: number;
  };
  skillGaps?: { skill: string; priority: string; reasoning: string }[];
}

interface ActiveCoachRelationship {
  id: string;
  coach_id: string;
  status: string;
  total_sessions: number;
  last_session_date?: string;
  coach?: {
    id: string;
    display_name?: string;
    profile_photo_url?: string;
    specializations?: string[];
    rating?: number;
    hourly_rate?: number;
  };
}

type SortKey = 'rating' | 'sessions' | 'price' | 'name';

type CoachingStatus = 'loading' | 'no_coach' | 'has_coaches' | 'empty_platform' | 'error';

// ---------------------------------------------------------------------------
// Skill chips for needs-based discovery
// ---------------------------------------------------------------------------

const SKILL_CHIPS = [
  { key: 'starts', label: 'Starts' },
  { key: 'boat_speed', label: 'Boat Speed' },
  { key: 'race_tactics', label: 'Tactics' },
  { key: 'boat_handling', label: 'Boat Handling' },
  { key: 'race_management', label: 'Race Management' },
  { key: 'downwind', label: 'Downwind' },
  { key: 'upwind', label: 'Upwind' },
  { key: 'mental_coaching', label: 'Mental Game' },
] as const;

function normalizeArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
}

function scoreCoach(
  coach: CoachWithScore,
  context: {
    goals: string;
    selectedSkills: string[];
    sailorBoatClass?: string;
    sailorLocation?: string | null;
  }
) {
  const coachSpecialties = normalizeArray((coach as any).specialties || (coach as any).specializations);
  const coachBoatClasses = normalizeArray((coach as any).boat_classes);
  const selected = context.selectedSkills.map((entry) => entry.toLowerCase());
  const overlap = selected.filter((skill) => coachSpecialties.includes(skill));
  const boatClassMatch =
    context.sailorBoatClass && coachBoatClasses.includes(context.sailorBoatClass.toLowerCase());

  const experienceMatch = Math.max(30, Math.min(100, Math.round((Number((coach as any).years_coaching || 0) / 12) * 100)));
  const teachingStyleMatch = 72;
  const specialtyAlignment = selected.length > 0 ? Math.round((overlap.length / selected.length) * 100) : 60;
  const successRateRelevance = Math.max(40, Math.min(100, Math.round(Number((coach as any).average_rating || coach.rating || 0) * 20)));
  const availabilityMatch = (coach as any).is_accepting_clients === false ? 25 : 85;
  const locationConvenience =
    context.sailorLocation && (coach.location_name || '').toLowerCase().includes(context.sailorLocation.toLowerCase())
      ? 90
      : 65;
  const valueScore = Number((coach as any).hourly_rate || 0) > 0 ? 70 : 60;

  const overallScore = Math.round(
    experienceMatch * 0.2 +
    teachingStyleMatch * 0.1 +
    specialtyAlignment * 0.25 +
    successRateRelevance * 0.2 +
    availabilityMatch * 0.1 +
    locationConvenience * 0.05 +
    valueScore * 0.1 +
    (boatClassMatch ? 6 : 0)
  );

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    breakdown: {
      experienceMatch,
      teachingStyleMatch,
      specialtyAlignment,
      successRateRelevance,
      availabilityMatch,
      locationConvenience,
      valueScore,
    },
    reasoning: overlap.length > 0
      ? `Strong match on ${overlap.slice(0, 2).join(' and ')} with proven coaching history.`
      : `General fit based on coaching history and current goals: ${context.goals}.`,
    recommendations: overlap.length > 0
      ? [`Prioritize ${overlap[0]} in your first session`]
      : ['Book an intro session to validate coach fit'],
    skillGaps: selected
      .filter((skill) => !coachSpecialties.includes(skill))
      .map((skill) => ({
        skill,
        priority: 'medium',
        reasoning: 'This area is less explicit in coach specialties.',
      })),
  };
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

/**
 * CoachDiscoveryScreen - Needs-based coach discovery
 *
 * Adapts based on sailor's coaching status:
 * - NO COACH: Needs-based matching flow with skill chips + AI results
 * - HAS COACHES: Shows active coaches + "Explore More" discovery
 * - EMPTY PLATFORM: Matching input with waitlist CTA
 */
export default function CoachDiscoveryScreen() {
  const router = useRouter();
  const { skill: skillParam } = useLocalSearchParams<{ skill?: string }>();
  const { user } = useAuth();
  const sailorData = useSailorDashboardData();
  const { data: upcomingSessions } = useSailorUpcomingSessions();

  // Coaching status
  const [coachingStatus, setCoachingStatus] = useState<CoachingStatus>('loading');
  const [activeCoaches, setActiveCoaches] = useState<ActiveCoachRelationship[]>([]);

  // Needs-based discovery
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');
  const [hasSubmittedNeeds, setHasSubmittedNeeds] = useState(false);

  // Coach data
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState<CoachWithScore[]>([]);
  const [aiMatches, setAiMatches] = useState<CoachWithScore[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContext, setAiContext] = useState<string>('Based on your sailing profile');

  // Refine filters (secondary)
  const [showRefine, setShowRefine] = useState(false);
  const [filters, setFilters] = useState({
    location: '',
    specialty: '',
    maxRate: '',
    boatClass: '',
  });

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('rating');

  // Waitlist state (empty platform)
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  // -------------------------------------------------------------------------
  // Determine coaching status on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    determineCoachingStatus();
    // determineCoachingStatus closes over user; keying on user is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    loadCoaches();
    // loadCoaches uses filters; keying on filters is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Auto-apply skill from URL param (e.g. from coaching insight cards)
  useEffect(() => {
    if (
      skillParam &&
      SKILL_CHIPS.some((c) => c.key === skillParam) &&
      !hasSubmittedNeeds
    ) {
      setSelectedSkills([skillParam]);
      setHasSubmittedNeeds(true);
    }
    // Fires only when the URL skill param changes; hasSubmittedNeeds checked inside is a snapshot guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillParam]);

  // Auto-run matching when skills are submitted
  useEffect(() => {
    if (hasSubmittedNeeds && user) {
      runAIMatching();
    }
    // Fires only when hasSubmittedNeeds flips; user + runAIMatching read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubmittedNeeds]);

  // Auto-run matching for returning users
  useEffect(() => {
    if (coachingStatus === 'has_coaches' && user && sailorData.classes.length > 0) {
      runAIMatching();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachingStatus, user, sailorData.classes.length]);

  const determineCoachingStatus = async () => {
    if (!user) {
      setCoachingStatus('no_coach');
      return;
    }

    try {
      // Check for active coaching relationships
      const { data: relationships, error } = await supabase
        .from('coaching_clients')
        .select(`
          id,
          coach_id,
          status,
          total_sessions,
          last_session_date
        `)
        .eq('sailor_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      if (relationships && relationships.length > 0) {
        // Fetch coach details for each relationship (enriched with specialties, hourly_rate, bio)
        const coachIds = relationships.map(r => r.coach_id);
        const { data: coachProfiles } = await supabase
          .from('coach_profiles')
          .select('id, display_name, profile_photo_url:profile_image_url, specializations, specialties, rating, hourly_rate, bio, total_sessions')
          .in('id', coachIds);

        const enriched = relationships.map(rel => ({
          ...rel,
          coach: coachProfiles?.find(c => c.id === rel.coach_id) || undefined,
        }));

        setActiveCoaches(enriched);
        setCoachingStatus('has_coaches');
      } else {
        setCoachingStatus('no_coach');
      }
    } catch (error) {
      console.error('Error checking coaching status:', error);
      setCoachingStatus('error');
    }
  };

  // -------------------------------------------------------------------------
  // Load all coaches
  // -------------------------------------------------------------------------

  const loadCoaches = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('coach_profiles')
        .select('*')
        .eq('is_verified', true)
        .eq('is_active', true)
        .eq('is_accepting_clients', true)
        .eq('marketplace_visible', true);

      if (filters.location) {
        query = query.ilike('location_name', `%${filters.location}%`);
      }
      if (filters.specialty) {
        query = query.contains('specializations', [filters.specialty]);
      }
      if (filters.maxRate) {
        query = query.lte('hourly_rate', parseInt(filters.maxRate));
      }

      const { data: results, error } = await query.order('rating', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const coachesWithNames = (results || []).map(coach => ({
        ...coach,
        average_rating: coach.rating ? parseFloat(coach.rating) : 0,
        specialties: coach.specializations || [],
        based_at: coach.location_name,
      }));

      setCoaches(coachesWithNames);

      // If zero coaches on platform, switch to empty state
      if (coachesWithNames.length === 0 && !filters.location && !filters.specialty && !filters.maxRate) {
        setCoachingStatus(prev => prev === 'loading' ? 'empty_platform' : prev);
      }
    } catch (error) {
      console.error('Error loading coaches:', error);
      setCoachingStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // AI Matching
  // -------------------------------------------------------------------------

  const runAIMatching = async () => {
    if (!user) return;

    try {
      setAiLoading(true);

      const { data: sailorProfile, error: profileError } = await supabase
        .from('sailor_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !sailorProfile) {
        setAiLoading(false);
        return;
      }

      // Build context description
      const boatClass = sailorProfile.boat_classes?.[0] || sailorData.classes[0]?.name;
      const venue = sailorData.venues.currentVenue?.name;
      if (boatClass && venue) {
        setAiContext(`Based on your ${boatClass} racing at ${venue}`);
      } else if (boatClass) {
        setAiContext(`Based on your ${boatClass} sailing`);
      }

      // Build goals from selected skills + free text
      const skillGoals = selectedSkills.length > 0
        ? `Improve: ${selectedSkills.map(s => SKILL_CHIPS.find(c => c.key === s)?.label || s).join(', ')}`
        : sailorProfile.goals || 'Improve racing performance';
      const combinedGoals = freeText ? `${skillGoals}. ${freeText}` : skillGoals;

      const matchedCoaches: CoachWithScore[] = coaches.map((coach) => {
        const score = scoreCoach(coach, {
          goals: combinedGoals,
          selectedSkills,
          sailorBoatClass: sailorProfile.boat_classes?.[0] || sailorData.classes[0]?.name,
          sailorLocation: sailorProfile.location || sailorProfile.home_port,
        });
        return {
          ...coach,
          compatibilityScore: score.overallScore / 100,
          matchReasoning: score.reasoning,
          recommendations: score.recommendations,
          scoreBreakdown: score.breakdown,
          skillGaps: score.skillGaps,
        };
      });

      matchedCoaches.sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0));
      setAiMatches(matchedCoaches);
      saveMatchScores(matchedCoaches, {
        recentResults: [],
        trends: {},
      });
    } catch (error) {
      console.error('AI matching error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const saveMatchScores = async (matchedCoaches: CoachWithScore[], agentData: any) => {
    if (!user) return;

    try {
      const matchRecords = matchedCoaches
        .filter(coach => coach.compatibilityScore !== undefined)
        .map(coach => ({
          user_id: user.id,
          coach_id: coach.id,
          compatibility_score: coach.compatibilityScore,
          skill_gap_analysis: agentData.skillGaps || null,
          match_reasoning: coach.matchReasoning || '',
          performance_data_used: {
            trends: agentData.trends || {},
            recentResults: agentData.recentResults || [],
          },
          score_breakdown: coach.scoreBreakdown || null,
        }));

      await supabase
        .from('coach_match_scores')
        .upsert(matchRecords, { onConflict: 'user_id,coach_id' });
    } catch (error) {
      console.error('Error saving match scores:', error);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSkillToggle = useCallback((skillKey: string) => {
    setSelectedSkills(prev =>
      prev.includes(skillKey)
        ? prev.filter(s => s !== skillKey)
        : [...prev, skillKey]
    );
  }, []);

  const handleFindCoaches = useCallback(() => {
    if (selectedSkills.length === 0) return;
    setHasSubmittedNeeds(true);
  }, [selectedSkills]);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleCoachPress = useCallback((coachId: string) => {
    router.push(`/coach/${coachId}`);
  }, [router]);

  const handleBookSession = useCallback((coachId: string) => {
    router.push(`/coach/${coachId}?action=book`);
  }, [router]);

  const handleMessage = useCallback((coachId: string) => {
    router.push(`/coach/${coachId}?action=message`);
  }, [router]);

  const handleOpenArtifactQueue = useCallback(() => {
    router.push('/coach/artifact-queue');
  }, [router]);

  const handleWaitlistSubmit = useCallback(async () => {
    if (!user || (selectedSkills.length === 0 && !freeText)) return;

    try {
      await supabase.from('coach_waitlist').insert({
        user_id: user.id,
        skills_wanted: selectedSkills,
        free_text: freeText,
      });
      setWaitlistSubmitted(true);
    } catch (error) {
      console.error('Error submitting waitlist:', error);
      // Still show confirmation UX even if insert fails
      setWaitlistSubmitted(true);
    }
  }, [user, selectedSkills, freeText]);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const sortedCoaches = useMemo(() => {
    return [...coaches].sort((a, b) => {
      switch (sortKey) {
        case 'rating':
          return (b.average_rating || 0) - (a.average_rating || 0);
        case 'sessions':
          return (b.total_sessions || 0) - (a.total_sessions || 0);
        case 'price':
          return (a.hourly_rate || 0) - (b.hourly_rate || 0);
        case 'name':
          return (a.display_name || '').localeCompare(b.display_name || '');
        default:
          return 0;
      }
    });
  }, [coaches, sortKey]);

  const aiMatchIds = useMemo(() => new Set(aiMatches.map(c => c.id)), [aiMatches]);
  const activeCoachIds = useMemo(() => new Set(activeCoaches.map(ac => ac.coach_id)), [activeCoaches]);

  const filteredCoaches = useMemo(() => {
    return sortedCoaches.filter(c => !aiMatchIds.has(c.id) && !activeCoachIds.has(c.id));
  }, [sortedCoaches, aiMatchIds, activeCoachIds]);

  const existingSpecialties = useMemo(() => {
    return activeCoaches.flatMap(ac => ac.coach?.specializations || []);
  }, [activeCoaches]);

  // -------------------------------------------------------------------------
  // Sub-components
  // -------------------------------------------------------------------------

  const renderNeedsInput = (headerText: string, subtitleText?: string) => (
    <View style={styles.needsSection}>
      <Text style={styles.needsHeader}>{headerText}</Text>
      {subtitleText && (
        <Text style={styles.needsSubtitle}>{subtitleText}</Text>
      )}

      {/* Skill chips */}
      <View style={styles.chipGrid}>
        {SKILL_CHIPS.map(chip => {
          const isSelected = selectedSkills.includes(chip.key);
          const isExisting = existingSpecialties.includes(chip.key);
          return (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
                isExisting && styles.chipExisting,
              ]}
              onPress={() => handleSkillToggle(chip.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                  isExisting && styles.chipTextExisting,
                ]}
              >
                {chip.label}
              </Text>
              {isExisting && (
                <Text style={styles.chipExistingBadge}>covered</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Free text input */}
      <View style={styles.freeTextContainer}>
        <TextInput
          style={styles.freeTextInput}
          placeholder="Tell us more about what you're working on..."
          placeholderTextColor={c.textLight}
          value={freeText}
          onChangeText={setFreeText}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
      </View>

      {/* Action button */}
      {coachingStatus !== 'empty_platform' ? (
        <TouchableOpacity
          style={[
            styles.matchButton,
            selectedSkills.length === 0 && styles.matchButtonDisabled,
          ]}
          onPress={handleFindCoaches}
          disabled={selectedSkills.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.matchButtonText}>
            {aiLoading ? 'Finding matches...' : 'Find My Coaches'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.waitlistButton,
            waitlistSubmitted && styles.waitlistButtonDone,
            (selectedSkills.length === 0 && !freeText) && styles.matchButtonDisabled,
          ]}
          onPress={handleWaitlistSubmit}
          disabled={waitlistSubmitted || (selectedSkills.length === 0 && !freeText)}
          activeOpacity={0.8}
        >
          <Text style={styles.waitlistButtonText}>
            {waitlistSubmitted ? 'We\'ll notify you!' : 'Notify Me When Available'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAIMatchResults = () => {
    if (!hasSubmittedNeeds && coachingStatus === 'no_coach') return null;
    if (!aiLoading && aiMatches.length === 0 && coachingStatus !== 'has_coaches') return null;

    return (
      <View style={styles.matchResultsSection}>
        {/* Section header */}
        <View style={styles.matchResultsHeader}>
          <View style={styles.matchResultsHeaderLeft}>
            <Text style={styles.matchResultsContext}>{aiContext}</Text>
          </View>
        </View>

        {/* Loading state */}
        {aiLoading ? (
          <View style={styles.aiLoadingContainer}>
            <ActivityIndicator size="small" color={c.ai} />
            <Text style={styles.aiLoadingText}>Analyzing your needs and finding matches...</Text>
          </View>
        ) : (
          aiMatches.map((coach) => (
            <AIMatchCoachCard
              key={coach.id}
              coach={coach}
              onViewProfile={() => handleCoachPress(coach.id)}
              onBookSession={() => handleBookSession(coach.id)}
            />
          ))
        )}
      </View>
    );
  };

  const renderActiveCoaches = () => {
    if (activeCoaches.length === 0) return null;

    return (
      <View style={styles.activeCoachesSection}>
        <Text style={styles.sectionTitle}>Your Coaches</Text>
        {activeCoaches.map(relationship => (
          <ActiveCoachCard
            key={relationship.id}
            relationship={relationship}
            nextSessionDate={getNextSessionForCoach(relationship.coach_id)}
            onBook={() => handleBookSession(relationship.coach_id)}
            onMessage={() => handleMessage(relationship.coach_id)}
            onViewProfile={() => handleCoachPress(relationship.coach_id)}
          />
        ))}
      </View>
    );
  };

  const renderRefineAndBrowse = () => (
    <>
      {/* Refine toggle */}
      <TouchableOpacity
        style={styles.refineToggle}
        onPress={() => setShowRefine(!showRefine)}
        activeOpacity={0.7}
      >
        <Text style={styles.refineToggleText}>
          {showRefine ? 'Hide Filters' : 'Refine Results'}
        </Text>
        <Text style={styles.refineChevron}>{showRefine ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {showRefine && (
        <TufteFiltersBar
          filters={filters}
          onFilterChange={handleFilterChange}
        />
      )}

      {/* Sort controls */}
      <View style={styles.sortBar}>
        <Text style={styles.resultCount}>
          {loading ? 'Loading...' : `${filteredCoaches.length} coaches`}
        </Text>
        <View style={styles.sortButtons}>
          {(['rating', 'sessions', 'price'] as SortKey[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.sortButton,
                sortKey === key && styles.sortButtonActive,
              ]}
              onPress={() => setSortKey(key)}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  sortKey === key && styles.sortButtonTextActive,
                ]}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Coach list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#666" />
        </View>
      ) : filteredCoaches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No additional coaches found. Try adjusting your filters.
          </Text>
        </View>
      ) : (
        filteredCoaches.map((coach) => (
          <TufteCoachRow
            key={coach.id}
            coach={coach}
            onPress={() => handleCoachPress(coach.id)}
          />
        ))
      )}
    </>
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  const handleGoBack = () => {
    router.back();
  };

  const handleRetry = useCallback(() => {
    setCoachingStatus('loading');
    determineCoachingStatus();
    loadCoaches();
    // determineCoachingStatus + loadCoaches read latest user/filters at call time; stable identity not required for this retry handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Helper: get next upcoming session date for a given coach
  const getNextSessionForCoach = useCallback((coachId: string): string | null => {
    if (!upcomingSessions || upcomingSessions.length === 0) return null;
    const session = upcomingSessions.find(s => s.coach_id === coachId);
    return session?.scheduled_at || null;
  }, [upcomingSessions]);

  if (coachingStatus === 'loading') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Find a Coach</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#666" />
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // ERROR STATE
  // -------------------------------------------------------------------------

  if (coachingStatus === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Find a Coach</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <TouchableOpacity style={styles.queueEntryButton} onPress={handleOpenArtifactQueue} activeOpacity={0.8}>
            <Text style={styles.queueEntryText}>Open Review Queue</Text>
          </TouchableOpacity>
          <Ionicons name="cloud-offline-outline" size={48} color={c.textLight} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            We couldn't load coaching data. Check your connection and try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
            <Ionicons name="refresh" size={18} color="#ffffff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // EMPTY PLATFORM STATE
  // -------------------------------------------------------------------------

  if (coachingStatus === 'empty_platform') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Find a Coach</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.queueEntryContainer}>
            <TouchableOpacity style={styles.queueEntryButton} onPress={handleOpenArtifactQueue} activeOpacity={0.8}>
              <Text style={styles.queueEntryText}>Open Review Queue</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyPlatformBanner}>
            <Text style={styles.emptyPlatformTitle}>
              We're growing our coach network
            </Text>
            <Text style={styles.emptyPlatformSubtitle}>
              Tell us what you need and we'll notify you when a match is available.
            </Text>
          </View>

          {renderNeedsInput(
            'What do you want to improve?',
            'Select the areas you\'d like coaching in'
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // NO COACH — FIRST TIME
  // -------------------------------------------------------------------------

  if (coachingStatus === 'no_coach') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Find a Coach</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.queueEntryContainer}>
            <TouchableOpacity style={styles.queueEntryButton} onPress={handleOpenArtifactQueue} activeOpacity={0.8}>
              <Text style={styles.queueEntryText}>Open Review Queue</Text>
            </TouchableOpacity>
          </View>
          {!hasSubmittedNeeds ? (
            // Step 1: Needs input
            renderNeedsInput(
              'What do you want to improve?',
              'Select your focus areas and we\'ll match you with the right coach'
            )
          ) : (
            // Step 2: AI results + browse
            <>
              {/* Compact summary of selected needs */}
              <View style={styles.needsSummary}>
                <View style={styles.needsSummaryChips}>
                  {selectedSkills.map(sk => (
                    <View key={sk} style={styles.needsSummaryChip}>
                      <Text style={styles.needsSummaryChipText}>
                        {SKILL_CHIPS.find(c => c.key === sk)?.label || sk}
                      </Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setHasSubmittedNeeds(false)}>
                  <Text style={styles.needsEditLink}>Edit</Text>
                </TouchableOpacity>
              </View>

              {renderAIMatchResults()}

              {/* Browse section divider */}
              <View style={styles.sectionDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ALL COACHES</Text>
                <View style={styles.dividerLine} />
              </View>

              {renderRefineAndBrowse()}
            </>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // HAS COACH(ES) — RETURNING
  // -------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Coaching</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        <View style={styles.queueEntryContainer}>
          <TouchableOpacity style={styles.queueEntryButton} onPress={handleOpenArtifactQueue} activeOpacity={0.8}>
            <Text style={styles.queueEntryText}>Open Review Queue</Text>
          </TouchableOpacity>
        </View>
        {/* Active coach cards */}
        {renderActiveCoaches()}

        {/* Expand coaching team section */}
        <View style={styles.expandSection}>
          <View style={styles.expandHeader}>
            <Text style={styles.expandTitle}>Explore More Coaches</Text>
            <Text style={styles.expandSubtitle}>
              Expand your coaching team to cover more areas
            </Text>
          </View>

          {renderNeedsInput(
            'What else do you want to improve?',
            existingSpecialties.length > 0
              ? 'Skills marked "covered" are addressed by your current coaches'
              : undefined
          )}
        </View>

        {/* AI match results */}
        {renderAIMatchResults()}

        {/* Browse section divider */}
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ALL COACHES</Text>
          <View style={styles.dividerLine} />
        </View>

        {renderRefineAndBrowse()}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AI Match Coach Card
// ---------------------------------------------------------------------------

function AIMatchCoachCard({
  coach,
  onViewProfile,
  onBookSession,
}: {
  coach: CoachWithScore;
  onViewProfile: () => void;
  onBookSession: () => void;
}) {
  const displayName = coach.display_name || 'Coach';
  const matchPercent = coach.compatibilityScore
    ? Math.round(coach.compatibilityScore * 100)
    : null;
  const rating = coach.average_rating?.toFixed(1) || '0.0';
  const reviewCount = coach.total_sessions || 0;
  const hourlyRate = coach.hourly_rate;
  const specialties = coach.specialties?.slice(0, 3).map(s =>
    s.replace(/_/g, ' ')
  ) || [];

  return (
    <View style={styles.aiMatchCard}>
      <TouchableOpacity
        onPress={onViewProfile}
        activeOpacity={0.7}
        style={styles.aiMatchCardInner}
      >
        {/* Photo */}
        <View style={styles.aiMatchPhoto}>
          {coach.profile_photo_url ? (
            <Image
              source={{ uri: coach.profile_photo_url }}
              style={styles.aiMatchPhotoImage}
            />
          ) : (
            <View style={styles.aiMatchPhotoPlaceholder}>
              <Text style={styles.aiMatchPhotoInitial}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.aiMatchInfo}>
          <View style={styles.aiMatchNameRow}>
            <Text style={styles.aiMatchName} numberOfLines={1}>{displayName}</Text>
            {matchPercent && (
              <Text style={styles.aiMatchPercent}>{matchPercent}% match</Text>
            )}
          </View>

          {/* Specialty tags */}
          <View style={styles.aiMatchTags}>
            {specialties.map((spec, i) => (
              <View key={i} style={styles.aiMatchTag}>
                <Text style={styles.aiMatchTagText}>{spec}</Text>
              </View>
            ))}
          </View>

          {/* Rating, review count, hourly rate row */}
          <View style={styles.aiMatchMetaRow}>
            <Text style={styles.aiMatchRating}>{rating} ★</Text>
            <Text style={styles.aiMatchReviewCount}>({reviewCount} sessions)</Text>
            {hourlyRate != null && (
              <Text style={styles.aiMatchRate}>${hourlyRate}/hr</Text>
            )}
          </View>

          {/* AI reason */}
          {coach.matchReasoning && (
            <Text style={styles.aiMatchReason} numberOfLines={1}>
              {coach.matchReasoning}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={styles.aiMatchActions}>
        <TouchableOpacity style={styles.aiMatchActionPrimary} onPress={onBookSession} activeOpacity={0.7}>
          <Text style={styles.aiMatchActionPrimaryText}>Book Session</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.aiMatchActionSecondary} onPress={onViewProfile} activeOpacity={0.7}>
          <Text style={styles.aiMatchActionSecondaryText}>View Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Active Coach Card
// ---------------------------------------------------------------------------

function ActiveCoachCard({
  relationship,
  nextSessionDate,
  onBook,
  onMessage,
  onViewProfile,
}: {
  relationship: ActiveCoachRelationship;
  nextSessionDate: string | null;
  onBook: () => void;
  onMessage: () => void;
  onViewProfile: () => void;
}) {
  const coach = relationship.coach;
  const displayName = coach?.display_name || 'Coach';
  const specialties = (coach?.specializations || []).slice(0, 2).map(s =>
    s.replace(/_/g, ' ')
  );
  const rating = coach?.rating ? parseFloat(String(coach.rating)).toFixed(1) : null;
  const hourlyRate = coach?.hourly_rate;

  const formatSessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <TouchableOpacity
      style={styles.activeCoachCard}
      onPress={onViewProfile}
      activeOpacity={0.85}
    >
      <View style={styles.activeCoachTop}>
        {/* Photo */}
        <View style={styles.activeCoachPhoto}>
          {coach?.profile_photo_url ? (
            <Image
              source={{ uri: coach.profile_photo_url }}
              style={styles.activeCoachPhotoImage}
            />
          ) : (
            <View style={styles.activeCoachPhotoPlaceholder}>
              <Text style={styles.activeCoachPhotoInitial}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Name & details */}
        <View style={styles.activeCoachInfo}>
          <Text style={styles.activeCoachName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.activeCoachMeta} numberOfLines={1}>
            {specialties.join(', ')}
            {rating && ` · ${rating} ★`}
            {relationship.total_sessions > 0 && ` · ${relationship.total_sessions} sessions`}
          </Text>
          {/* Hourly rate + next session row */}
          <View style={styles.activeCoachDetailRow}>
            {hourlyRate != null && (
              <Text style={styles.activeCoachRate}>${hourlyRate}/hr</Text>
            )}
            {nextSessionDate && (
              <View style={styles.activeCoachNextSession}>
                <Ionicons name="calendar-outline" size={12} color={c.match} />
                <Text style={styles.activeCoachNextSessionText}>
                  Next: {formatSessionDate(nextSessionDate)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.activeCoachActions}>
        <TouchableOpacity style={styles.actionButton} onPress={onBook} activeOpacity={0.7}>
          <Text style={styles.actionButtonText}>Book Session</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonSecondary} onPress={onMessage} activeOpacity={0.7}>
          <Text style={styles.actionButtonSecondaryText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonGhost} onPress={onViewProfile} activeOpacity={0.7}>
          <Text style={styles.actionButtonGhostText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Colors & Styles
// ---------------------------------------------------------------------------

const c = {
  text: IOS_COLORS.label,
  textSecondary: IOS_COLORS.secondaryLabel,
  textLight: IOS_COLORS.systemGray,
  border: IOS_COLORS.separator,
  borderSubtle: IOS_COLORS.systemGray6,
  bg: IOS_COLORS.systemBackground,
  bgSubtle: IOS_COLORS.secondarySystemBackground,
  bgTertiary: IOS_COLORS.systemGray6,
  accent: IOS_COLORS.systemBlue,
  accentLight: '#dbeafe', // No direct IOS_COLORS equivalent for tinted blue bg
  ai: IOS_COLORS.systemPurple,
  aiLight: '#f3e8ff',
  aiBorder: '#e9d5ff',
  aiText: '#7e22ce',
  match: IOS_COLORS.systemGreen,
  matchLight: '#dcfce7',
  star: IOS_COLORS.systemYellow,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: c.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerSpacer: {
    width: 32, // Balance the back button width
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: c.text,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  queueEntryContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  queueEntryButton: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: c.bgSubtle,
  },
  queueEntryText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.accent,
  },

  // ---------------------------------------------------------------------------
  // Needs-based input section
  // ---------------------------------------------------------------------------
  needsSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  needsHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: c.text,
    marginBottom: 4,
  },
  needsSubtitle: {
    fontSize: 13,
    color: c.textSecondary,
    marginBottom: 16,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bg,
  },
  chipSelected: {
    borderColor: c.accent,
    backgroundColor: c.accentLight,
  },
  chipExisting: {
    borderColor: c.borderSubtle,
    backgroundColor: c.bgTertiary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textSecondary,
  },
  chipTextSelected: {
    color: c.accent,
  },
  chipTextExisting: {
    color: c.textLight,
  },
  chipExistingBadge: {
    fontSize: 10,
    color: c.match,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },

  // Free text
  freeTextContainer: {
    marginBottom: 16,
  },
  freeTextInput: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: c.text,
    minHeight: 56,
    backgroundColor: c.bg,
  },

  // Match button
  matchButton: {
    backgroundColor: c.ai,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  matchButtonDisabled: {
    opacity: 0.4,
  },
  matchButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Waitlist button
  waitlistButton: {
    backgroundColor: c.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  waitlistButtonDone: {
    backgroundColor: c.match,
  },
  waitlistButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Needs summary (after submission)
  needsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: c.bgSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  needsSummaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 12,
  },
  needsSummaryChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: c.accentLight,
  },
  needsSummaryChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: c.accent,
  },
  needsEditLink: {
    fontSize: 13,
    color: c.accent,
    fontWeight: '500',
  },

  // ---------------------------------------------------------------------------
  // AI Match results section
  // ---------------------------------------------------------------------------
  matchResultsSection: {
    backgroundColor: c.bg,
  },
  matchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: c.aiLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.aiBorder,
  },
  matchResultsHeaderLeft: {
    flex: 1,
  },
  aiBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: c.aiBorder,
    marginBottom: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: c.aiText,
    letterSpacing: 0.5,
  },
  matchResultsContext: {
    fontSize: 12,
    color: c.textSecondary,
  },
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  aiLoadingText: {
    fontSize: 13,
    color: c.textSecondary,
    fontStyle: 'italic',
  },

  // AI Match coach card
  aiMatchCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: c.bg,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    }),
  } as any,
  aiMatchCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiMatchPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    overflow: 'hidden',
  },
  aiMatchPhotoImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  aiMatchPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiMatchPhotoInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: c.textSecondary,
  },
  aiMatchInfo: {
    flex: 1,
  },
  aiMatchNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  aiMatchName: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    flex: 1,
    marginRight: 8,
  },
  aiMatchPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: c.match,
  },
  aiMatchTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  aiMatchTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: c.bgTertiary,
  },
  aiMatchTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: c.textSecondary,
    textTransform: 'capitalize',
  },
  aiMatchRating: {
    fontSize: 12,
    color: c.star,
    fontWeight: '500',
  },
  aiMatchReason: {
    fontSize: 13,
    color: c.ai,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  aiMatchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  aiMatchReviewCount: {
    fontSize: 12,
    color: c.textSecondary,
  },
  aiMatchRate: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text,
    marginLeft: 'auto',
  } as any,
  aiMatchActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    marginTop: 10,
  },
  aiMatchActionPrimary: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: c.accent,
  },
  aiMatchActionPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  aiMatchActionSecondary: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: c.border,
    backgroundColor: c.bgSubtle,
  },
  aiMatchActionSecondaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: c.text,
  },

  // ---------------------------------------------------------------------------
  // Active coaches section (returning users)
  // ---------------------------------------------------------------------------
  activeCoachesSection: {
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: c.bg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  activeCoachCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.bg,
    overflow: 'hidden',
  },
  activeCoachTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  activeCoachPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    overflow: 'hidden',
  },
  activeCoachPhotoImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  activeCoachPhotoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCoachPhotoInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: c.textSecondary,
  },
  activeCoachInfo: {
    flex: 1,
  },
  activeCoachName: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    marginBottom: 2,
  },
  activeCoachMeta: {
    fontSize: 13,
    color: c.textSecondary,
    textTransform: 'capitalize',
  },
  activeCoachDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  activeCoachRate: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text,
  },
  activeCoachNextSession: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeCoachNextSessionText: {
    fontSize: 12,
    fontWeight: '500',
    color: c.match,
  },
  activeCoachActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: c.accent,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButtonSecondary: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: c.border,
    backgroundColor: c.bgSubtle,
  },
  actionButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: c.text,
  },
  actionButtonGhost: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: c.border,
  },
  actionButtonGhostText: {
    fontSize: 13,
    fontWeight: '500',
    color: c.textSecondary,
  },

  // ---------------------------------------------------------------------------
  // Expand coaching team section
  // ---------------------------------------------------------------------------
  expandSection: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  expandHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  expandTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
    marginBottom: 2,
  },
  expandSubtitle: {
    fontSize: 13,
    color: c.textSecondary,
  },

  // ---------------------------------------------------------------------------
  // Empty platform state
  // ---------------------------------------------------------------------------
  emptyPlatformBanner: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 8,
    alignItems: 'center',
  },
  emptyPlatformTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: c.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyPlatformSubtitle: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },

  // ---------------------------------------------------------------------------
  // Refine toggle
  // ---------------------------------------------------------------------------
  refineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    gap: 6,
  },
  refineToggleText: {
    fontSize: 13,
    color: c.textSecondary,
    fontWeight: '500',
  },
  refineChevron: {
    fontSize: 8,
    color: c.textLight,
  },

  // ---------------------------------------------------------------------------
  // Section divider
  // ---------------------------------------------------------------------------
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: c.bg,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: c.textLight,
    letterSpacing: 1,
    paddingHorizontal: 12,
  },

  // ---------------------------------------------------------------------------
  // Sort bar
  // ---------------------------------------------------------------------------
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  resultCount: {
    fontSize: 13,
    color: c.textSecondary,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  sortButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  sortButtonActive: {
    backgroundColor: c.bgTertiary,
  },
  sortButtonText: {
    fontSize: 12,
    color: c.textLight,
  },
  sortButtonTextActive: {
    color: c.text,
    fontWeight: '500',
  },

  // ---------------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------------
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: c.text,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
