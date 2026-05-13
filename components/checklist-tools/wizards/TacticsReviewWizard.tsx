/**
 * TacticsReviewWizard
 *
 * Interactive tactical briefing wizard for morning checklist.
 * Shows venue-specific insights, conditions-based recommendations,
 * and learning from past races. Allows crew to record key decisions.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  CheckCircle2,
  Wind,
  Sparkles,
  Check,
  BookOpen,
  MapPin,
  History,
  Flag,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useStrategyRecommendations } from '@/hooks/useStrategyRecommendations';
import { NudgeList } from '@/components/checklist-tools/NudgeBanner';
import { usePersonalizedNudges } from '@/hooks/useAdaptiveLearning';
import type { ChecklistToolProps } from '@/lib/checklists/toolRegistry';
import { sailorRacePreparationService } from '@/services/SailorRacePreparationService';
import type {
  TacticalIntention,
  TacticalBriefing,
  TacticalRecommendation,
} from '@/types/morningChecklist';

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  purple: '#AF52DE',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  yellow: '#FFCC00',
  gray: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  gray4: '#3A3A3C',
  gray5: '#2C2C2E',
  background: '#F2F2F7',
  secondaryBackground: '#FFFFFF',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
  separator: '#3C3C4349',
};

interface TacticsReviewWizardProps extends ChecklistToolProps {
  venueId?: string | null;
  venueName?: string | null;
  wind?: {
    direction?: string;
    speedMin?: number;
    speedMax?: number;
  };
  tideState?: string | null;
  existingIntention?: TacticalIntention | null;
}

type InsightCategory = 'venue' | 'conditions' | 'learning';

const CATEGORY_ICONS: Record<InsightCategory, React.ComponentType<any>> = {
  venue: MapPin,
  conditions: Wind,
  learning: History,
};

const CATEGORY_COLORS: Record<InsightCategory, string> = {
  venue: IOS_COLORS.blue,
  conditions: IOS_COLORS.orange,
  learning: IOS_COLORS.purple,
};

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  venue: 'Venue Insights',
  conditions: 'Conditions',
  learning: 'From Past Races',
};

export function TacticsReviewWizard({
  item,
  regattaId,
  boatId: _boatId,
  onComplete,
  onCancel,
  venueId,
  venueName,
  wind,
  tideState,
  existingIntention,
}: TacticsReviewWizardProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Fetch strategy recommendations
  const {
    sectionData,
    venueInsights: rawVenueInsights,
    conditionsInsights: rawConditionsInsights,
    isLoading: isLoadingRecommendations,
  } = useStrategyRecommendations(user?.id, {
    venueName: venueName || undefined,
    windSpeed: wind?.speedMin,
    windDirection: typeof wind?.direction === 'string' ? parseFloat(wind.direction) : undefined,
    enabled: !!user?.id,
  });

  // Fetch personalized nudges from adaptive learning
  const {
    venueInsights: venueNudges,
    conditionsInsights: conditionsNudges,
    reminders,
    isLoading: isLoadingNudges,
    recordDelivery,
  } = usePersonalizedNudges(regattaId || '', {
    venueId: venueId || undefined,
    forecast: wind?.speedMin ? {
      windSpeed: wind.speedMin,
      windDirection: typeof wind?.direction === 'string' ? parseFloat(wind.direction) : 0,
    } : undefined,
  });

  // Filter nudges relevant to tactics (strategies, venue learning, performance)
  const tacticalNudges = useMemo(() => {
    const allNudges = [
      ...(venueNudges || []),
      ...(conditionsNudges || []),
      ...(reminders || []),
    ];
    return allNudges.filter(
      (n) =>
        n.category === 'venue_learning' ||
        n.category === 'successful_strategy' ||
        n.category === 'performance_issue' ||
        n.category === 'decision_outcome'
    );
  }, [venueNudges, conditionsNudges, reminders]);

  // State
  const [expandedCategory, setExpandedCategory] = useState<InsightCategory | null>('venue');
  const [userNotes, setUserNotes] = useState(existingIntention?.userNotes || '');
  const [agreedDecisions, setAgreedDecisions] = useState<string[]>(
    existingIntention?.agreedDecisions || []
  );
  const [newDecision, setNewDecision] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Format conditions summary
  const conditionsSummary = useMemo(() => {
    const parts: string[] = [];
    if (wind?.direction) parts.push(wind.direction);
    if (wind?.speedMin && wind?.speedMax) {
      parts.push(`${wind.speedMin}-${wind.speedMax} kt`);
    }
    if (tideState) parts.push(tideState);
    return parts.length > 0 ? parts.join(', ') : 'Conditions not available';
  }, [wind, tideState]);

  // Build tactical briefing from section data and insights
  const tacticalBriefing = useMemo((): TacticalBriefing => {
    const briefing: TacticalBriefing = {
      venueInsights: [],
      conditionsInsights: [],
      learningInsights: [],
      keyDecisions: [],
      generatedAt: new Date().toISOString(),
    };

    // Convert venue insights to tactical recommendations
    if (rawVenueInsights && rawVenueInsights.insights.length > 0) {
      rawVenueInsights.insights.forEach((insightText) => {
        briefing.venueInsights.push({
          category: 'general' as any,
          recommendation: insightText,
          reasoning: '',
          source: 'venue_history',
          confidence: 70,
        });
      });
      // Add key learnings from venue as learning insights
      rawVenueInsights.keyLearnings.forEach((learning) => {
        briefing.learningInsights.push({
          category: 'general' as any,
          recommendation: learning,
          reasoning: '',
          source: 'learning',
          confidence: 70,
          pastPerformanceContext: `From ${rawVenueInsights.raceCount} races at this venue`,
        });
      });
    }

    // Convert conditions insights to tactical recommendations
    if (rawConditionsInsights && rawConditionsInsights.insights.length > 0) {
      rawConditionsInsights.insights.forEach((insightText) => {
        briefing.conditionsInsights.push({
          category: 'general' as any,
          recommendation: insightText,
          reasoning: '',
          source: 'conditions',
          confidence: 70,
        });
      });
      // Add key learnings from conditions
      rawConditionsInsights.keyLearnings.forEach((learning) => {
        briefing.learningInsights.push({
          category: 'general' as any,
          recommendation: learning,
          reasoning: '',
          source: 'learning',
          confidence: 70,
          pastPerformanceContext: `From ${rawConditionsInsights.raceCount} races in ${rawConditionsInsights.conditionLabel}`,
        });
      });
    }

    // Add AI recommendations from section data to venue insights (as general tactical advice)
    if (sectionData) {
      const startSection = sectionData['start.lineBias'] || sectionData['start.favoredEnd'];
      const upwindSection = sectionData['upwind.favoredTack'] || sectionData['upwind.shiftStrategy'];

      if (startSection?.aiRecommendation) {
        briefing.venueInsights.push({
          category: 'start',
          recommendation: startSection.aiRecommendation,
          reasoning: '',
          source: 'learning',
          confidence: startSection.pastPerformance?.sampleCount ? 80 : 60,
          pastPerformanceContext: startSection.pastPerformance?.avgRating
            ? `Your avg start rating: ${startSection.pastPerformance.avgRating.toFixed(1)}`
            : undefined,
        });
        briefing.keyDecisions.push(`Start: ${startSection.aiRecommendation.slice(0, 60)}...`);
      }

      if (upwindSection?.aiRecommendation) {
        briefing.venueInsights.push({
          category: 'upwind',
          recommendation: upwindSection.aiRecommendation,
          reasoning: '',
          source: 'learning',
          confidence: upwindSection.pastPerformance?.sampleCount ? 80 : 60,
          pastPerformanceContext: upwindSection.pastPerformance?.avgRating
            ? `Your avg upwind rating: ${upwindSection.pastPerformance.avgRating.toFixed(1)}`
            : undefined,
        });
        briefing.keyDecisions.push(`First beat: ${upwindSection.aiRecommendation.slice(0, 60)}...`);
      }
    }

    return briefing;
  }, [sectionData, rawVenueInsights, rawConditionsInsights]);

  // Add a new decision
  const handleAddDecision = useCallback(() => {
    if (newDecision.trim()) {
      setAgreedDecisions((prev) => [...prev, newDecision.trim()]);
      setNewDecision('');
    }
  }, [newDecision]);

  // Remove a decision
  const handleRemoveDecision = useCallback((index: number) => {
    setAgreedDecisions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (!user?.id) {
        showAlert('Sign in required', 'Please sign in to save tactical review.');
        return;
      }
      if (!regattaId) {
        showAlert('Race unavailable', 'Unable to save tactical review without a race id.');
        return;
      }

      const intention: TacticalIntention = {
        briefing: tacticalBriefing,
        userNotes,
        agreedDecisions,
        savedAt: new Date().toISOString(),
      };

      const persistedSummaryParts = [
        `Saved at: ${intention.savedAt}`,
        venueName ? `Venue: ${venueName}` : null,
        intention.userNotes ? `Crew Notes: ${intention.userNotes}` : null,
        intention.agreedDecisions.length > 0
          ? `Agreed Decisions: ${intention.agreedDecisions.join(' | ')}`
          : null,
      ].filter(Boolean) as string[];

      const saved = await sailorRacePreparationService.updateIntentions(regattaId, user.id, {
        strategyNotes: {
          [`morning_tactics_review:${item.id}`]: persistedSummaryParts.join('\n'),
        },
      });
      if (!saved) {
        showAlert('Unable to save', 'Tactical review could not be saved right now. Please try again.');
        return;
      }

      onComplete();
    } catch (error) {
      console.error('Failed to save tactical intention:', error);
      showAlert('Save failed', 'Failed to save tactical review. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, regattaId, tacticalBriefing, userNotes, agreedDecisions, venueName, item.id, onComplete]);

  // Handle learn more - navigate to Tactical Planning module in Race Preparation Mastery course
  const handleLearnMore = useCallback(() => {
    onCancel(); // Close modal first
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/learn/race-preparation-mastery' as any,
        params: {
          moduleId: 'module-13-2', // Tactical Planning module
        },
      });
    }, 150);
  }, [router, onCancel]);

  // Render an insight row
  const renderInsight = (insight: TacticalRecommendation, index: number) => (
    <View key={index} style={styles.insightRow}>
      <View style={styles.insightBullet} />
      <View style={styles.insightContent}>
        <Text style={styles.insightText}>{insight.recommendation}</Text>
        {insight.reasoning && (
          <Text style={styles.insightReasoning}>{insight.reasoning}</Text>
        )}
        {insight.pastPerformanceContext && (
          <View style={styles.pastContextRow}>
            <History size={12} color={IOS_COLORS.purple} />
            <Text style={styles.pastContextText}>
              {insight.pastPerformanceContext}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  // Render a category section
  const renderCategorySection = (
    category: InsightCategory,
    insights: TacticalRecommendation[]
  ) => {
    if (insights.length === 0) return null;

    const isExpanded = expandedCategory === category;
    const IconComponent = CATEGORY_ICONS[category];
    const color = CATEGORY_COLORS[category];
    const label = CATEGORY_LABELS[category];

    return (
      <View style={styles.categorySection}>
        <Pressable
          style={styles.categoryHeader}
          onPress={() => setExpandedCategory(isExpanded ? null : category)}
        >
          <View style={styles.categoryHeaderLeft}>
            <View style={[styles.categoryIconContainer, { backgroundColor: `${color}15` }]}>
              <IconComponent size={16} color={color} />
            </View>
            <Text style={styles.categoryTitle}>{label}</Text>
            <View style={styles.insightCountBadge}>
              <Text style={styles.insightCountText}>{insights.length}</Text>
            </View>
          </View>
          {isExpanded ? (
            <ChevronUp size={18} color={IOS_COLORS.gray} />
          ) : (
            <ChevronDown size={18} color={IOS_COLORS.gray} />
          )}
        </Pressable>

        {isExpanded && (
          <View style={styles.categoryContent}>
            {insights.map((insight, index) => renderInsight(insight, index))}
          </View>
        )}
      </View>
    );
  };

  // Render loading state
  if (isLoadingRecommendations) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={onCancel}>
            <X size={24} color={IOS_COLORS.gray} />
          </Pressable>
          <Text style={styles.headerTitle}>Tactics Briefing</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.blue} />
          <Text style={styles.loadingText}>Loading tactical insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeButton}
            onPress={onCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={IOS_COLORS.gray} />
          </Pressable>
          <Text style={styles.headerTitle}>Tactics Briefing</Text>
          <View style={styles.headerRight}>
            <Pressable style={styles.learnIconButton} onPress={handleLearnMore}>
              <BookOpen size={20} color={IOS_COLORS.purple} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentInner}
          keyboardShouldPersistTaps="handled"
        >
          {/* Venue & Conditions Header */}
          <View style={styles.conditionsCard}>
            <View style={styles.conditionsRow}>
              {venueName && (
                <View style={styles.venueTag}>
                  <MapPin size={14} color={IOS_COLORS.blue} />
                  <Text style={styles.venueText}>{venueName}</Text>
                </View>
              )}
              <Text style={styles.conditionsText}>{conditionsSummary}</Text>
            </View>
          </View>

          {/* Tactical Insights by Category */}
          <View style={styles.insightsContainer}>
            {renderCategorySection('venue', tacticalBriefing.venueInsights)}
            {renderCategorySection('conditions', tacticalBriefing.conditionsInsights)}
            {renderCategorySection('learning', tacticalBriefing.learningInsights)}
          </View>

          {/* Personalized Nudges from Past Races */}
          {tacticalNudges.length > 0 && (
            <NudgeList
              nudges={tacticalNudges}
              title="Reminders From Your Past Races"
              channel="briefing"
              maxVisible={4}
              isLoading={isLoadingNudges}
              onRecordDelivery={recordDelivery as any}
              showMatchReasons
            />
          )}

          {/* Key Decisions Section */}
          <View style={styles.decisionsSection}>
            <View style={styles.decisionsSectionHeader}>
              <Flag size={18} color={IOS_COLORS.green} />
              <Text style={styles.decisionsSectionTitle}>Key Decisions</Text>
            </View>
            <Text style={styles.decisionsSectionSubtitle}>
              Record what the crew agreed on
            </Text>

            {/* Existing decisions */}
            {agreedDecisions.map((decision, index) => (
              <View key={index} style={styles.decisionRow}>
                <Check size={16} color={IOS_COLORS.green} />
                <Text style={styles.decisionText}>{decision}</Text>
                <Pressable
                  style={styles.removeDecisionButton}
                  onPress={() => handleRemoveDecision(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color={IOS_COLORS.red} />
                </Pressable>
              </View>
            ))}

            {/* Add new decision */}
            <View style={styles.addDecisionRow}>
              <TextInput
                style={styles.addDecisionInput}
                value={newDecision}
                onChangeText={setNewDecision}
                placeholder="e.g., Start pin end, favor right side..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                onSubmitEditing={handleAddDecision}
                returnKeyType="done"
              />
              <Pressable
                style={[
                  styles.addDecisionButton,
                  !newDecision.trim() && styles.addDecisionButtonDisabled,
                ]}
                onPress={handleAddDecision}
                disabled={!newDecision.trim()}
              >
                <Plus size={20} color={newDecision.trim() ? '#FFFFFF' : IOS_COLORS.gray} />
              </Pressable>
            </View>
          </View>

          {/* User Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Crew Discussion Notes</Text>
            <Text style={styles.notesSubLabel}>
              Capture important points from your briefing
            </Text>
            <TextInput
              style={styles.notesInput}
              value={userNotes}
              onChangeText={setUserNotes}
              placeholder="e.g., Watch for wind shift at 15:00, stay in phase with fleet leaders..."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Tip */}
          <View style={styles.tipCard}>
            <Sparkles size={16} color={IOS_COLORS.purple} />
            <Text style={styles.tipText}>
              After the race, review which decisions paid off. Your feedback
              sharpens future recommendations.
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Action */}
        <View style={styles.bottomAction}>
          <Pressable
            style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle2 size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Save & Complete</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  closeButton: {
    padding: 4,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  learnIconButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: IOS_COLORS.secondaryLabel,
  },
  // Conditions
  conditionsCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  conditionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  venueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${IOS_COLORS.blue}10`,
    borderRadius: 8,
  },
  venueText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  conditionsText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  // Insights
  insightsContainer: {
    gap: 8,
    marginBottom: 20,
  },
  categorySection: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  insightCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: IOS_COLORS.background,
    borderRadius: 10,
  },
  insightCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.gray,
  },
  categoryContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    gap: 12,
    paddingTop: 12,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  insightBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.blue,
    marginTop: 7,
  },
  insightContent: {
    flex: 1,
  },
  insightText: {
    fontSize: 15,
    color: IOS_COLORS.label,
    lineHeight: 22,
  },
  insightReasoning: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
    lineHeight: 18,
  },
  pastContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  pastContextText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: IOS_COLORS.purple,
    flex: 1,
  },
  // Decisions
  decisionsSection: {
    marginBottom: 20,
  },
  decisionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  decisionsSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  decisionsSectionSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 12,
  },
  decisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: `${IOS_COLORS.green}10`,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  decisionText: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  removeDecisionButton: {
    padding: 4,
  },
  addDecisionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addDecisionInput: {
    flex: 1,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  addDecisionButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDecisionButtonDisabled: {
    backgroundColor: IOS_COLORS.gray3,
  },
  // Notes
  notesSection: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  notesSubLabel: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 10,
  },
  notesInput: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: IOS_COLORS.label,
    minHeight: 100,
    lineHeight: 22,
  },
  // Tip
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: `${IOS_COLORS.purple}08`,
    borderRadius: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  // Bottom Action
  bottomAction: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.green,
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: IOS_COLORS.gray,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TacticsReviewWizard;
