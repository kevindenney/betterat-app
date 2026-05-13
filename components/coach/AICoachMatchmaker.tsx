import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { CoachMarketplaceService } from '@/services/CoachingService';
import AICoachMatchingService from '@/services/AICoachMatchingService';
import { CoachSearchResult, SailorProfile } from '@/types/coach';
import CoachCard from './CoachCard';

interface MatchingPreferences {
  targetSkills: string[];
  learningStyle: 'visual' | 'hands-on' | 'analytical' | 'collaborative';
  upcomingEvents: string[];
  budgetRange: { min: number; max: number };
  availabilityPreference: 'weekday' | 'weekend' | 'flexible';
  urgencyLevel: 'low' | 'medium' | 'high';
}

interface CoachMatch {
  coach: CoachSearchResult;
  compatibilityScore: number;
  matchReason: string;
  recommendedSessionPlan: {
    sessionPlan: string;
    focusAreas: string[];
    expectedOutcomes: string[];
    preparationTips: string[];
  };
}

const SKILL_OPTIONS = [
  'Race Starts',
  'Tactical Decision Making',
  'Boat Handling',
  'Spinnaker Work',
  'Upwind Speed',
  'Downwind Technique',
  'Mark Roundings',
  'Weather Reading',
  'Rules Knowledge',
  'Mental Preparation',
  'Team Coordination',
  'Equipment Tuning',
];

const LEARNING_STYLES = [
  { key: 'visual', label: 'Visual', description: 'Charts, diagrams, videos' },
  { key: 'hands-on', label: 'Hands-On', description: 'Practice and demonstration' },
  { key: 'analytical', label: 'Analytical', description: 'Data and strategic analysis' },
  { key: 'collaborative', label: 'Collaborative', description: 'Group learning and discussion' },
] as const;

export default function AICoachMatchmaker() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sailorProfile, setSailorProfile] = useState<SailorProfile | null>(null);
  const [preferences, setPreferences] = useState<MatchingPreferences>({
    targetSkills: [],
    learningStyle: 'hands-on',
    upcomingEvents: [],
    budgetRange: { min: 5000, max: 15000 }, // $50-$150 per hour
    availabilityPreference: 'flexible',
    urgencyLevel: 'medium',
  });
  const [matches, setMatches] = useState<CoachMatch[]>([]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyzingStyle, setAnalyzingStyle] = useState(false);

  useEffect(() => {
    if (user) {
      loadSailorProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadSailorProfile = async () => {
    if (!user) return;

    try {
      const profile = await CoachMarketplaceService.getSailorProfile(user.id);
      setSailorProfile(profile);

      // Auto-analyze learning style
      if (profile) {
        await analyzeLearningingStyle(profile);
      }
    } catch (error) {
      console.error('Error loading sailor profile:', error);
    }
  };

  const analyzeLearningingStyle = async (profile: SailorProfile) => {
    setAnalyzingStyle(true);
    try {
      const analysis = await AICoachMatchingService.analyzeLearningStyle(profile);
      setPreferences(prev => ({ ...prev, learningStyle: analysis.primaryStyle }));

      // Show analysis results
      showAlert(
        'Learning Style Detected',
        `Based on your sailing profile, we've identified your primary learning style as ${analysis.primaryStyle}. This helps us match you with compatible coaches.\n\nConfidence: ${(analysis.confidence * 100).toFixed(0)}%`
      );
    } catch (error) {
      console.error('Error analyzing learning style:', error);
    } finally {
      setAnalyzingStyle(false);
    }
  };

  const findMatches = async () => {
    if (!sailorProfile || !user) {
      showAlert('Error', 'Please complete your sailing profile first');
      return;
    }

    setLoading(true);
    try {
      // Get available coaches
      const searchResponse = await CoachMarketplaceService.searchCoaches({
        location: sailorProfile.location,
        boat_classes: sailorProfile.boat_classes || [],
        specialties: preferences.targetSkills,
        price_range: [preferences.budgetRange.min, preferences.budgetRange.max],
      });

      const coaches = searchResponse.coaches ?? [];

      if (coaches.length === 0) {
        showAlert('No Coaches Found', 'Try adjusting your preferences to see more options');
        setLoading(false);
        return;
      }

      // Get AI compatibility scores
      const compatibilityScores = await AICoachMatchingService.generateCoachCompatibilityScores(
        {
          sailorProfile,
          targetSkills: preferences.targetSkills,
          learningStyle: preferences.learningStyle,
          upcomingEvents: preferences.upcomingEvents,
          preferredLocation: sailorProfile.location ?? '',
          budgetRange: preferences.budgetRange,
          availabilityPreference: preferences.availabilityPreference,
        },
        coaches
      );

      // Generate session recommendations for top matches
      const topMatches = compatibilityScores.slice(0, 5);
      const matchesWithRecommendations: CoachMatch[] = [];

      for (const score of topMatches) {
        const coach = coaches.find(c => c.id === score.coachId);
        if (!coach) continue;

        const sessionPlan = await AICoachMatchingService.generateSessionRecommendations(
          sailorProfile,
          coach,
          preferences.targetSkills
        );

        matchesWithRecommendations.push({
          coach,
          compatibilityScore: score.overallScore,
          matchReason: score.reasoning,
          recommendedSessionPlan: sessionPlan,
        });
      }

      setMatches(matchesWithRecommendations);
    } catch (error) {
      console.error('Error finding matches:', error);
      showAlert('Error', 'Failed to find coach matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setPreferences(prev => ({
      ...prev,
      targetSkills: prev.targetSkills.includes(skill)
        ? prev.targetSkills.filter(s => s !== skill)
        : [...prev.targetSkills, skill],
    }));
  };

  const renderPreferencesModal = () => (
    <Modal
      visible={showPreferences}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPreferences(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowPreferences(false)}>
            <Text style={styles.modalCloseButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Matching Preferences</Text>
          <TouchableOpacity
            onPress={() => {
              setShowPreferences(false);
              findMatches();
            }}
          >
            <Text style={styles.modalSaveButton}>Save & Search</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          {/* Target Skills */}
          <View style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Skills to Improve</Text>
            <Text style={styles.sectionSubtitle}>Select areas you want to focus on</Text>
            <View style={styles.skillGrid}>
              {SKILL_OPTIONS.map((skill) => (
                <TouchableOpacity
                  key={skill}
                  style={[
                    styles.skillChip,
                    preferences.targetSkills.includes(skill) && styles.skillChipSelected,
                  ]}
                  onPress={() => toggleSkill(skill)}
                >
                  <Text
                    style={[
                      styles.skillChipText,
                      preferences.targetSkills.includes(skill) && styles.skillChipTextSelected,
                    ]}
                  >
                    {skill}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Learning Style */}
          <View style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Learning Style</Text>
            <Text style={styles.sectionSubtitle}>How do you learn best?</Text>
            {LEARNING_STYLES.map((style) => (
              <TouchableOpacity
                key={style.key}
                style={[
                  styles.learningStyleOption,
                  preferences.learningStyle === style.key && styles.learningStyleSelected,
                ]}
                onPress={() => setPreferences(prev => ({ ...prev, learningStyle: style.key }))}
              >
                <View style={styles.learningStyleContent}>
                  <Text style={styles.learningStyleLabel}>{style.label}</Text>
                  <Text style={styles.learningStyleDescription}>{style.description}</Text>
                </View>
                {preferences.learningStyle === style.key && (
                  <Text style={styles.selectedIndicator}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Budget Range */}
          <View style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Budget Range</Text>
            <Text style={styles.sectionSubtitle}>
              ${(preferences.budgetRange.min / 100).toFixed(0)} - ${(preferences.budgetRange.max / 100).toFixed(0)} per hour
            </Text>
            {/* Note: In a real implementation, you'd add slider components here */}
          </View>

          {/* Availability */}
          <View style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Availability Preference</Text>
            <View style={styles.availabilityOptions}>
              {[
                { key: 'weekday', label: 'Weekdays' },
                { key: 'weekend', label: 'Weekends' },
                { key: 'flexible', label: 'Flexible' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.availabilityOption,
                    preferences.availabilityPreference === option.key && styles.availabilitySelected,
                  ]}
                  onPress={() => setPreferences(prev => ({ ...prev, availabilityPreference: option.key as any }))}
                >
                  <Text
                    style={[
                      styles.availabilityText,
                      preferences.availabilityPreference === option.key && styles.availabilityTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const renderMatchCard = (match: CoachMatch, index: number) => (
    <View key={match.coach.id} style={styles.matchCard}>
      {/* Match Score Badge */}
      <View style={styles.matchScoreBadge}>
        <Text style={styles.matchScoreText}>{match.compatibilityScore.toFixed(0)}% Match</Text>
        <Text style={styles.matchRankText}>#{index + 1} Recommendation</Text>
      </View>

      {/* Coach Card */}
      <CoachCard
        coach={match.coach}
        onPress={() => {/* Navigate to coach profile */}}
        onBookPress={() => {/* Navigate to booking */}}
      />

      {/* AI Insights */}
      <View style={styles.aiInsights}>
        <Text style={styles.insightsTitle}>Why This Match?</Text>
        <Text style={styles.insightsText} numberOfLines={3}>
          {match.matchReason}
        </Text>

        <Text style={styles.insightsTitle}>Recommended Session Focus</Text>
        <View style={styles.focusAreas}>
          {match.recommendedSessionPlan.focusAreas.slice(0, 3).map((area, idx) => (
            <View key={idx} style={styles.focusChip}>
              <Text style={styles.focusChipText}>{area}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  if (!sailorProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Coach Matchmaker</Text>
        <Text style={styles.subtitle}>
          Find coaches perfectly matched to your learning style and goals
        </Text>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{preferences.targetSkills.length}</Text>
            <Text style={styles.statLabel}>Skills Selected</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{preferences.learningStyle}</Text>
            <Text style={styles.statLabel}>Learning Style</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${(preferences.budgetRange.max / 100).toFixed(0)}</Text>
            <Text style={styles.statLabel}>Max Budget</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.preferencesButton]}
          onPress={() => setShowPreferences(true)}
        >
          <Text style={styles.preferencesButtonText}>Set Preferences</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.findButton]}
          onPress={findMatches}
          disabled={loading || preferences.targetSkills.length === 0}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.findButtonText}>Find My Matches</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Learning Style Analysis */}
      {analyzingStyle && (
        <View style={styles.analysisContainer}>
          <ActivityIndicator size="small" color="#0066CC" />
          <Text style={styles.analysisText}>Analyzing your learning style...</Text>
        </View>
      )}

      {/* Results */}
      <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
        {matches.length > 0 ? (
          <>
            <Text style={styles.resultsTitle}>
              {matches.length} AI-Matched Coaches Found
            </Text>
            {matches.map((match, index) => renderMatchCard(match, index))}
          </>
        ) : (
          !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Ready to Find Your Perfect Coach?</Text>
              <Text style={styles.emptyStateText}>
                Set your preferences and let our AI find coaches that match your learning style and goals.
              </Text>
            </View>
          )
        )}
      </ScrollView>

      {/* Preferences Modal */}
      {renderPreferencesModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  preferencesButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  preferencesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  findButton: {
    backgroundColor: '#0066CC',
  },
  findButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  analysisContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#E6F3FF',
    marginHorizontal: 20,
    borderRadius: 8,
  },
  analysisText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#0066CC',
  },
  results: {
    flex: 1,
    padding: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    boxShadow: '0px 2px',
    elevation: 3,
  },
  matchScoreBadge: {
    backgroundColor: '#00AA33',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  matchScoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  matchRankText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  aiInsights: {
    padding: 16,
    backgroundColor: '#F8F9FA',
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  insightsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  focusAreas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusChip: {
    backgroundColor: '#E6F3FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  focusChipText: {
    fontSize: 12,
    color: '#0066CC',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalSaveButton: {
    fontSize: 16,
    color: '#0066CC',
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  preferenceSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skillChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  skillChipSelected: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  skillChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  skillChipTextSelected: {
    color: '#FFFFFF',
  },
  learningStyleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    marginBottom: 12,
  },
  learningStyleSelected: {
    backgroundColor: '#E6F3FF',
    borderWidth: 2,
    borderColor: '#0066CC',
  },
  learningStyleContent: {
    flex: 1,
  },
  learningStyleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  learningStyleDescription: {
    fontSize: 14,
    color: '#666',
  },
  selectedIndicator: {
    fontSize: 18,
    color: '#0066CC',
    fontWeight: 'bold',
  },
  availabilityOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  availabilityOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  availabilitySelected: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  availabilityText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  availabilityTextSelected: {
    color: '#FFFFFF',
  },
});
