import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/Colors';
import { strategicPlanningService, RaceStrategyPlan, AIStrategySuggestions } from '@/services/StrategicPlanningService';
import { postRaceLearningService } from '@/services/PostRaceLearningService';
import { StrategyPhaseSuggestion } from '@/components/races/StrategyPhaseSuggestion';
import type { PerformancePattern } from '@/types/raceLearning';
import { useAuth } from '@/providers/AuthProvider';

interface StrategyPlanningCardProps {
  raceEventId: string;
  sailorId: string;
  coachId?: string;
  onPlanUpdated?: () => void;
}

interface PhaseConfig {
  key: keyof RaceStrategyPlan;
  title: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const RACE_PHASES: PhaseConfig[] = [
  {
    key: 'rigTuningStrategy',
    title: 'Rig Tuning',
    placeholder: 'What rig settings will you use? (e.g., tension, mast rake, forestay)',
    icon: 'settings-outline',
  },
  {
    key: 'prestartStrategy',
    title: 'Pre-Start',
    placeholder: 'How will you prepare before the start sequence? (e.g., line bias check, wind reading)',
    icon: 'time-outline',
  },
  {
    key: 'startStrategy',
    title: 'Start',
    placeholder: 'What is your starting plan? (e.g., favored end, timing, positioning)',
    icon: 'flag-outline',
  },
  {
    key: 'upwindStrategy',
    title: 'Upwind',
    placeholder: 'What is your upwind strategy? (e.g., side preference, shift plan, tacking)',
    icon: 'arrow-up-outline',
  },
  {
    key: 'windwardMarkStrategy',
    title: 'Windward Mark',
    placeholder: 'How will you approach the windward mark? (e.g., layline, traffic, inside/outside)',
    icon: 'navigate-circle-outline',
  },
  {
    key: 'downwindStrategy',
    title: 'Downwind',
    placeholder: 'What is your downwind strategy? (e.g., angles, gybing, pressure)',
    icon: 'arrow-down-outline',
  },
  {
    key: 'leewardMarkStrategy',
    title: 'Leeward Mark',
    placeholder: 'How will you round the leeward mark? (e.g., approach angle, positioning)',
    icon: 'navigate-circle-outline',
  },
  {
    key: 'finishStrategy',
    title: 'Finish',
    placeholder: 'What is your finish line strategy? (e.g., favored end, timing)',
    icon: 'checkmark-circle-outline',
  },
];

export function StrategyPlanningCard({ raceEventId, sailorId, coachId, onPlanUpdated }: StrategyPlanningCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [_saving, _setSaving] = useState(false);
  const [plan, setPlan] = useState<RaceStrategyPlan>({});
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AIStrategySuggestions | null>(null);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [sharingWithCoach, setSharingWithCoach] = useState(false);

  // Phase-specific performance insights
  const [phaseInsights, setPhaseInsights] = useState<Record<string, { pattern: PerformancePattern | null; aiSuggestion: string | null }>>({});
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadStrategy();
    loadPhaseInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceEventId, sailorId]);

  const loadStrategy = async () => {
    try {
      setLoading(true);
      const preparation = await strategicPlanningService.getPreparationWithStrategy(raceEventId, sailorId);

      if (preparation) {
        setPlan({
          rigTuningStrategy: preparation.rig_tuning_strategy,
          prestartStrategy: preparation.prestart_strategy,
          startStrategy: preparation.start_strategy,
          upwindStrategy: preparation.upwind_strategy,
          windwardMarkStrategy: preparation.windward_mark_strategy,
          downwindStrategy: preparation.downwind_strategy,
          leewardMarkStrategy: preparation.leeward_mark_strategy,
          finishStrategy: preparation.finish_strategy,
        });

        setAiSuggestions(preparation.ai_strategy_suggestions || null);
        setIsShared(preparation.shared_with_coach || false);
      }
    } catch (error) {
      console.error('Error loading strategy:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPhaseInsights = async () => {
    if (!user?.id) return;

    try {
      setLoadingInsights(true);
      const insights: Record<string, { pattern: PerformancePattern | null; aiSuggestion: string | null }> = {};

      // Load insights for each phase
      const phaseKeys = RACE_PHASES.map(p => p.key);

      // Map strategy keys to phase keys for the service
      const phaseMap: Record<string, 'rigTuning' | 'prestart' | 'start' | 'upwind' | 'windwardMark' | 'downwind' | 'leewardMark' | 'finish'> = {
        rigTuningStrategy: 'rigTuning',
        prestartStrategy: 'prestart',
        startStrategy: 'start',
        upwindStrategy: 'upwind',
        windwardMarkStrategy: 'windwardMark',
        downwindStrategy: 'downwind',
        leewardMarkStrategy: 'leewardMark',
        finishStrategy: 'finish',
      };

      for (const phaseKey of phaseKeys) {
        const mappedPhase = phaseMap[phaseKey];
        if (mappedPhase) {
          const insight = await postRaceLearningService.getPhaseSpecificInsights(user.id, mappedPhase);
          insights[phaseKey] = insight;
        }
      }

      setPhaseInsights(insights);
    } catch (error) {
      console.error('Error loading phase insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const updatePhaseStrategy = async (phase: keyof RaceStrategyPlan, value: string) => {
    try {
      // Update local state immediately for responsive UI
      setPlan((prev) => ({ ...prev, [phase]: value }));

      // Save to database
      const success = await strategicPlanningService.updatePhaseStrategy(
        raceEventId,
        sailorId,
        phase,
        value
      );

      if (success && onPlanUpdated) {
        onPlanUpdated();
      }
    } catch (error) {
      console.error('Error updating phase strategy:', error);
      showAlert('Error', 'Failed to save strategy. Please try again.');
    }
  };

  const getCompletionPercentage = (): number => {
    const phases = Object.values(plan);
    const completedPhases = phases.filter((p) => p && p.trim().length > 0).length;
    return Math.round((completedPhases / RACE_PHASES.length) * 100);
  };

  const togglePhase = (phaseKey: string) => {
    setExpandedPhase(expandedPhase === phaseKey ? null : phaseKey);
  };

  const toggleInsight = (phaseKey: string) => {
    setExpandedInsights(prev => ({
      ...prev,
      [phaseKey]: !prev[phaseKey],
    }));
  };

  const handleShareToggle = async () => {
    if (!coachId) {
      showAlert(
        'No Coach Assigned',
        'You need to assign a coach before sharing your strategy plan.'
      );
      return;
    }

    try {
      setSharingWithCoach(true);

      if (isShared) {
        // Unshare
        const success = await strategicPlanningService.unshareFromCoach(raceEventId, sailorId);
        if (success) {
          setIsShared(false);
          showAlert('Success', 'Strategy plan unshared from coach');
        }
      } else {
        // Share
        const success = await strategicPlanningService.shareWithCoach(raceEventId, sailorId, coachId);
        if (success) {
          setIsShared(true);
          showAlert('Success', 'Strategy plan shared with your coach');
        }
      }
    } catch (error) {
      console.error('Error toggling share:', error);
      showAlert('Error', 'Failed to update sharing. Please try again.');
    } finally {
      setSharingWithCoach(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary.default} />
      </View>
    );
  }

  const completionPercentage = getCompletionPercentage();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary.default} />
          <Text style={styles.title}>Race Strategy Plan</Text>
        </View>
        <View style={styles.completionBadge}>
          <Text style={styles.completionText}>{completionPercentage}%</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Document your strategic plan for each phase of the race. This will help you stay focused and
        provide context for post-race analysis.
      </Text>

      {completionPercentage < 100 && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${completionPercentage}%` }]} />
        </View>
      )}

      <ScrollView style={styles.phasesContainer} showsVerticalScrollIndicator={false}>
        {RACE_PHASES.map((phase) => {
          const isExpanded = expandedPhase === phase.key;
          const hasContent = plan[phase.key] && plan[phase.key]!.trim().length > 0;
          const aiSuggestion = aiSuggestions?.[phase.key.replace('Strategy', '') as keyof AIStrategySuggestions];
          const insight = phaseInsights[phase.key];
          const insightExpanded = expandedInsights[phase.key] ?? true;

          return (
            <View key={phase.key} style={styles.phaseCard}>
              {/* Performance Insight Banner */}
              {insight && (insight.pattern || insight.aiSuggestion) && (
                <StrategyPhaseSuggestion
                  phase={phase.key}
                  phaseLabel={phase.title}
                  pattern={insight.pattern}
                  aiSuggestion={insight.aiSuggestion}
                  loading={loadingInsights}
                  expanded={insightExpanded}
                  onToggle={() => toggleInsight(phase.key)}
                />
              )}

              <TouchableOpacity
                style={styles.phaseHeader}
                onPress={() => togglePhase(phase.key)}
                activeOpacity={0.7}
              >
                <View style={styles.phaseHeaderLeft}>
                  <Ionicons
                    name={phase.icon}
                    size={18}
                    color={hasContent ? colors.primary.default : colors.text.tertiary}
                  />
                  <Text style={[styles.phaseTitle, hasContent && styles.phaseTitleCompleted]}>
                    {phase.title}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.phaseContent}>
                  <TextInput
                    style={styles.input}
                    value={plan[phase.key] || ''}
                    onChangeText={(value) => updatePhaseStrategy(phase.key, value)}
                    placeholder={phase.placeholder}
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  {aiSuggestion && showAiSuggestions && (
                    <View style={styles.aiSuggestionBox}>
                      <View style={styles.aiSuggestionHeader}>
                        <Ionicons name="bulb-outline" size={14} color={colors.accent.default} />
                        <Text style={styles.aiSuggestionLabel}>Suggestion</Text>
                      </View>
                      <Text style={styles.aiSuggestionText}>{aiSuggestion}</Text>
                    </View>
                  )}
                </View>
              )}

              {!isExpanded && hasContent && (
                <Text style={styles.phasePreview} numberOfLines={2}>
                  {plan[phase.key]}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {aiSuggestions && (
        <TouchableOpacity
          style={styles.aiToggleButton}
          onPress={() => setShowAiSuggestions(!showAiSuggestions)}
        >
          <Ionicons
            name={showAiSuggestions ? 'eye-off-outline' : 'eye-outline'}
            size={16}
            color={colors.accent.default}
          />
          <Text style={styles.aiToggleText}>
            {showAiSuggestions ? 'Hide' : 'Show'} AI Suggestions
          </Text>
        </TouchableOpacity>
      )}

      {/* Share with Coach */}
      {completionPercentage > 0 && (
        <TouchableOpacity
          style={[styles.shareButton, isShared && styles.shareButtonActive]}
          onPress={handleShareToggle}
          disabled={sharingWithCoach}
        >
          {sharingWithCoach ? (
            <ActivityIndicator size="small" color={isShared ? colors.text.inverse : colors.primary.default} />
          ) : (
            <>
              <Ionicons
                name={isShared ? 'person-remove-outline' : 'share-social-outline'}
                size={16}
                color={isShared ? colors.text.inverse : colors.primary.default}
              />
              <Text style={[styles.shareButtonText, isShared && styles.shareButtonTextActive]}>
                {isShared ? 'Unshare from Coach' : 'Share with Coach'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = {
  container: {
    backgroundColor: colors.background.elevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  completionBadge: {
    backgroundColor: colors.primary.default,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.inverse,
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border.light,
    borderRadius: 2,
    overflow: 'hidden' as const,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.default,
  },
  phasesContainer: {
    maxHeight: 600,
  },
  phaseCard: {
    backgroundColor: colors.background.default,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  phaseHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  phaseHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  phaseTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text.secondary,
  },
  phaseTitleCompleted: {
    color: colors.text.primary,
    fontWeight: '600' as const,
  },
  phaseContent: {
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.background.elevated,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  phasePreview: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 8,
    lineHeight: 18,
  },
  aiSuggestionBox: {
    backgroundColor: colors.accent.light,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.default,
  },
  aiSuggestionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 6,
  },
  aiSuggestionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.accent.dark,
  },
  aiSuggestionText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  aiToggleButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  aiToggleText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.accent.default,
  },
  shareButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: colors.background.default,
    borderWidth: 1,
    borderColor: colors.primary.default,
  },
  shareButtonActive: {
    backgroundColor: colors.primary.default,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary.default,
  },
  shareButtonTextActive: {
    color: colors.text.inverse,
  },
};
