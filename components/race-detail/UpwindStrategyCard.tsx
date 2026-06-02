/**
 * Upwind Strategy Card
 * Dedicated card for upwind beats strategy - extracted from TacticalPlanCard
 * Shows favored sides, shift playing tactics, theory + execution for each beat
 */

import { createLogger } from '@/lib/utils/logger';
import { useAuth } from '@/providers/AuthProvider';
import { strategicPlanningService } from '@/services/StrategicPlanningService';
import { supabase } from '@/services/supabase';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { 
  venueCommunityTipsService, 
  VenueCommunityTip,
  TIP_CATEGORIES 
} from '@/services/venue/VenueCommunityTipsService';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StrategyCard } from './StrategyCard';

const logger = createLogger('UpwindStrategyCard');

interface BeatRecommendation {
  leg: string; // 'Upwind Leg 1', 'Upwind Leg 2', etc.
  favoredSide: 'left' | 'right' | 'middle';
  reasoning: string;
  keyPoints: string[];
  confidence: number;
  theory?: string;
  execution?: string;
}

interface UpwindStrategyCardProps {
  raceId: string;
  raceName: string;
  sailorId?: string;
  raceEventId?: string;
  venueId?: string;
  venueName?: string;
}

const extractSideFromAction = (action: string): 'left' | 'right' | 'middle' | null => {
  if (!action) return null;
  const lowerAction = action.toLowerCase();
  if (lowerAction.includes('right') || lowerAction.includes('starboard')) return 'right';
  if (lowerAction.includes('left') || lowerAction.includes('port')) return 'left';
  if (lowerAction.includes('middle') || lowerAction.includes('center')) return 'middle';
  return null;
};

const extractSideFromBias = (favoredEnd: string): 'left' | 'right' | 'middle' | null => {
  if (!favoredEnd) return null;
  const lower = favoredEnd.toLowerCase();
  if (lower === 'pin' || lower === 'left') return 'left';
  if (lower === 'boat' || lower === 'committee' || lower === 'right') return 'right';
  if (lower === 'middle') return 'middle';
  return null;
};

export function UpwindStrategyCard({
  raceId,
  raceEventId,
  venueId,
  venueName
}: UpwindStrategyCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [beats, setBeats] = useState<BeatRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userStrategy, setUserStrategy] = useState('');
  const [savingUserStrategy, setSavingUserStrategy] = useState(false);
  const [communityTips, setCommunityTips] = useState<VenueCommunityTip[]>([]);
  const [showCommunityTips, setShowCommunityTips] = useState(false);

  // Use refs to track state for polling without triggering re-renders
  const beatsRef = useRef<BeatRecommendation[]>([]);
  const loadingRef = useRef(true);
  const pollCountRef = useRef(0);
  const MAX_POLLS = 20; // Stop polling after 20 attempts

  // Update refs when state changes
  useEffect(() => {
    beatsRef.current = beats;
  }, [beats]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const loadUpwindStrategy = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const primary = await supabase
        .from('race_strategies')
        .select('strategy_content')
        .eq('regatta_id', raceId)
        .eq('user_id', user.id)
        .maybeSingle();
      let data = primary.data;
      let fetchError = primary.error;
      if (fetchError && isMissingIdColumn(fetchError, 'race_strategies', 'regatta_id')) {
        const fallback = await supabase
          .from('race_strategies')
          .select('strategy_content')
          .eq('race_id', raceId)
          .eq('user_id', user.id)
          .maybeSingle();
        data = fallback.data;
        fetchError = fallback.error;
      }

      if (fetchError) {
        console.error('[UpwindStrategyCard] Fetch error:', fetchError);
        throw fetchError;
      }

      if (data && data.strategy_content) {
        const strategyContent = data.strategy_content as any;

        let upwindBeats: BeatRecommendation[] = [];

        // Try new structure first: tacticalPlan.recommendations
        if (strategyContent.tacticalPlan?.recommendations) {
          upwindBeats = strategyContent.tacticalPlan.recommendations.filter(
            (rec: BeatRecommendation) => rec.leg.toLowerCase().includes('upwind')
          );
        }
        // Fallback to old structure: fullAIStrategy.strategy.beatStrategy
        else if (strategyContent.fullAIStrategy?.strategy?.beatStrategy) {
          // Transform beatStrategy to BeatRecommendation format
          const beatStrategy = strategyContent.fullAIStrategy.strategy.beatStrategy;
          upwindBeats = beatStrategy.map((beat: any, index: number) => ({
            leg: `Upwind Leg ${index + 1}`,
            favoredSide: extractSideFromAction(beat.action) || 'middle',
            reasoning: beat.reasoning || beat.theory || '',
            keyPoints: [
              beat.execution,
              beat.action,
              `Confidence: ${beat.confidence}%`
            ].filter(Boolean),
            confidence: beat.confidence || 70,
            theory: beat.theory,
            execution: beat.execution
          }));
        }
        // Also check startStrategy as a fallback
        else if (strategyContent.startStrategy) {
          // Create a single beat recommendation from start strategy
          upwindBeats = [{
            leg: 'First Upwind Leg',
            favoredSide: extractSideFromBias(strategyContent.startStrategy.favoredEnd) || 'middle',
            reasoning: strategyContent.startStrategy.reasoning || '',
            keyPoints: [
              strategyContent.startStrategy.approach,
              `Line bias: ${strategyContent.startStrategy.lineBias || 0}°`,
              `Favored end: ${strategyContent.startStrategy.favoredEnd}`
            ].filter(Boolean),
            confidence: strategyContent.startStrategy.confidence || 70,
            theory: strategyContent.startStrategy.reasoning,
            execution: strategyContent.startStrategy.approach
          }];
        }

        if (upwindBeats.length > 0) {
          setBeats(upwindBeats);
        } else {
          setError('No upwind strategy found. Generate your tactical plan first.');
        }
      } else {
        setError('No strategy found. Generate your tactical plan first.');
      }
    } catch (err) {
      console.error('[UpwindStrategyCard] Load error:', err);
      setError('Failed to load upwind strategy');
    } finally {
      setLoading(false);
    }
  }, [user, raceId]);

  useEffect(() => {
    loadUpwindStrategy();

    // Subscribe to realtime changes for this race's strategy
    const subscription = supabase
      .channel(`race_strategy_${raceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'race_strategies',
          filter: `regatta_id=eq.${raceId}`,
        },
        (payload) => {
          const payloadRaceId =
            (payload as any)?.new?.regatta_id ||
            (payload as any)?.new?.race_id ||
            (payload as any)?.old?.regatta_id ||
            (payload as any)?.old?.race_id;
          if (payloadRaceId !== raceId) return;
          // Reload strategy when it changes
          loadUpwindStrategy();
        }
      )
      .subscribe();

    // Poll for strategy updates with exponential backoff if no data yet
    // This handles the case where strategy is generated after component mounts
    // Reset poll count when race changes
    pollCountRef.current = 0;
    
    let pollInterval: NodeJS.Timeout;
    const pollWithBackoff = () => {
      if (beatsRef.current.length === 0 && !loadingRef.current && pollCountRef.current < MAX_POLLS) {
        pollCountRef.current += 1;
        const nextDelay = Math.min(2000 + pollCountRef.current * 1000, 10000); // 2s to 10s max
        loadUpwindStrategy();
        pollInterval = setTimeout(pollWithBackoff, nextDelay);
      }
    };
    // Start polling after initial delay (give StartStrategyCard time to begin generating)
    pollInterval = setTimeout(pollWithBackoff, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(pollInterval);
    };
  }, [raceId, loadUpwindStrategy]); // Only depend on raceId and loadUpwindStrategy

  // Load user's manual strategy
  // Note: sailor_race_preparation uses auth.uid() for RLS, so we use user.id
  useEffect(() => {
    if (!user?.id || !raceEventId) return;

    const loadUserStrategy = async () => {
      try {
        const prep = await strategicPlanningService.getPreparationWithStrategy(
          raceEventId,
          user.id // Use user.id (auth.uid) instead of sailorId for RLS compatibility
        );
        if (prep?.upwind_strategy) {
          setUserStrategy(prep.upwind_strategy);
        }
      } catch (err) {
        logger.error('[UpwindStrategyCard] Error loading user strategy', err);
      }
    };

    loadUserStrategy();
  }, [user?.id, raceEventId]);

  // Load community tips for the venue
  useEffect(() => {
    if (!venueId) return;

    const loadCommunityTips = async () => {
      try {
        const tips = await venueCommunityTipsService.getTipsForVenue(venueId, {
          category: 'tactical_tips', // Focus on upwind-relevant tips
          limit: 5,
          includeUserVotes: true
        });
        // Also get wind pattern tips
        const windTips = await venueCommunityTipsService.getTipsForVenue(venueId, {
          category: 'wind_patterns',
          limit: 3,
          includeUserVotes: true
        });
        setCommunityTips([...tips, ...windTips].slice(0, 5));
      } catch (err) {
        logger.warn('[UpwindStrategyCard] Error loading community tips', err);
      }
    };

    loadCommunityTips();
  }, [venueId]);

  // Auto-save user's strategy on change
  // Note: sailor_race_preparation uses auth.uid() for RLS, so we use user.id
  const handleUserStrategyChange = async (text: string) => {
    setUserStrategy(text);
    if (!user?.id || !raceEventId) return;

    setSavingUserStrategy(true);
    try {
      await strategicPlanningService.updatePhaseStrategy(
        raceEventId,
        user.id, // Use user.id (auth.uid) instead of sailorId for RLS compatibility
        'upwindStrategy',
        text
      );
    } catch (err) {
      logger.error('[UpwindStrategyCard] Error saving user strategy', err);
    } finally {
      setSavingUserStrategy(false);
    }
  };

  const getSideIcon = (side: string) => {
    switch (side) {
      case 'left': return 'arrow-left-bold';
      case 'right': return 'arrow-right-bold';
      case 'middle': return 'minus';
      default: return 'help-circle';
    }
  };

  const getSideColor = (side: string) => {
    switch (side) {
      case 'left': return '#10B981';
      case 'right': return '#3B82F6';
      case 'middle': return '#F59E0B';
      default: return '#64748B';
    }
  };

  const getCardStatus = () => {
    if (loading) return 'generating';
    if (error) return 'error';
    if (beats.length === 0) return 'not_set';
    return 'ready';
  };

  const getStatusMessage = () => {
    if (loading) return 'Loading upwind strategy...';
    if (error) return error;
    if (beats.length === 0) return 'Generate tactical plan first';
    return `${beats.length} beat${beats.length > 1 ? 's' : ''}`;
  };

  const renderUpwindContent = () => {
    // Only show spinner on initial load when we have no data
    if (loading && beats.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      );
    }

    // If we have no data but finished loading, show error/empty state
    if (beats.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="sail-boat" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            {error || 'No upwind strategy available yet'}
          </Text>
          <Text style={styles.emptyHint}>
            Generate your tactical plan to see upwind beat recommendations
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUpwindStrategy} disabled={loading}>
            <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.beatsContainer}>
        {beats.map((beat, index) => (
          <View key={index} style={styles.beatCard}>
            {/* Beat Header */}
            <View style={styles.beatHeader}>
              <Text style={styles.beatTitle}>{beat.leg}</Text>
              <View style={[
                styles.favoredSideBadge,
                { backgroundColor: getSideColor(beat.favoredSide) + '20' }
              ]}>
                <MaterialCommunityIcons
                  name={getSideIcon(beat.favoredSide)}
                  size={16}
                  color={getSideColor(beat.favoredSide)}
                />
                <Text style={[
                  styles.favoredSideText,
                  { color: getSideColor(beat.favoredSide) }
                ]}>
                  {beat.favoredSide.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Theory (What/Why) */}
            {beat.theory && (
              <View style={styles.theorySection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="lightbulb-on" size={16} color="#F59E0B" />
                  <Text style={styles.sectionLabel}>THEORY (What/Why)</Text>
                </View>
                <Text style={styles.theoryText}>{beat.theory}</Text>
              </View>
            )}

            {/* Execution (How) */}
            {beat.execution && (
              <View style={styles.executionSection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="rocket-launch" size={16} color="#3B82F6" />
                  <Text style={styles.sectionLabel}>EXECUTION (How)</Text>
                </View>
                <Text style={styles.executionText}>{beat.execution}</Text>
              </View>
            )}

            {/* Reasoning (fallback if no theory/execution) */}
            {!beat.theory && !beat.execution && beat.reasoning && (
              <Text style={styles.reasoningText}>{beat.reasoning}</Text>
            )}

            {/* Key Points */}
            {beat.keyPoints && beat.keyPoints.length > 0 && (
              <View style={styles.keyPointsList}>
                {beat.keyPoints.map((point, idx) => (
                  point && (
                    <View key={idx} style={styles.keyPoint}>
                      <MaterialCommunityIcons name="check-circle" size={14} color="#10B981" />
                      <Text style={styles.keyPointText}>{point}</Text>
                    </View>
                  )
                ))}
              </View>
            )}

            {/* Confidence */}
            <View style={styles.confidenceRow}>
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    {
                      width: `${beat.confidence}%`,
                      backgroundColor: beat.confidence > 70 ? '#10B981' :
                                     beat.confidence > 50 ? '#F59E0B' : '#EF4444'
                    }
                  ]}
                />
              </View>
              <Text style={styles.confidenceText}>{beat.confidence}%</Text>
            </View>
          </View>
        ))}

        {/* Community Local Knowledge Section */}
        {communityTips.length > 0 && (
          <View style={styles.communityTipsSection}>
            <TouchableOpacity 
              style={styles.communityTipsHeader}
              onPress={() => setShowCommunityTips(!showCommunityTips)}
            >
              <View style={styles.communityTipsHeaderLeft}>
                <MaterialCommunityIcons name="account-group" size={18} color="#8B5CF6" />
                <Text style={styles.communityTipsLabel}>Community Local Knowledge</Text>
              </View>
              <View style={styles.communityTipsBadge}>
                <Text style={styles.communityTipsBadgeText}>{communityTips.length} tips</Text>
                <MaterialCommunityIcons 
                  name={showCommunityTips ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color="#8B5CF6" 
                />
              </View>
            </TouchableOpacity>
            
            {showCommunityTips && (
              <View style={styles.communityTipsList}>
                {communityTips.map((tip) => (
                  <View key={tip.id} style={styles.communityTipItem}>
                    <View style={styles.communityTipHeader}>
                      <MaterialCommunityIcons 
                        name={(TIP_CATEGORIES[tip.category]?.icon || 'lightbulb') as any}
                        size={14}
                        color="#64748B"
                      />
                      <Text style={styles.communityTipTitle}>{tip.title}</Text>
                      {tip.verification_status === 'expert_verified' && (
                        <MaterialCommunityIcons name="check-decagram" size={12} color="#10B981" />
                      )}
                      {tip.verification_status === 'community_verified' && (
                        <MaterialCommunityIcons name="check-circle" size={12} color="#3B82F6" />
                      )}
                    </View>
                    <Text style={styles.communityTipDescription}>{tip.description}</Text>
                    <View style={styles.communityTipFooter}>
                      <View style={styles.communityTipVotes}>
                        <MaterialCommunityIcons name="thumb-up" size={12} color="#94A3B8" />
                        <Text style={styles.communityTipVoteCount}>{tip.upvotes - tip.downvotes}</Text>
                      </View>
                    </View>
                  </View>
                ))}
                {venueName && (
                  <Text style={styles.communityTipsHint}>
                    Tips from sailors who race at {venueName}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* User Strategy Input Section */}
        {user?.id && raceEventId && (
          <View style={styles.userStrategySection}>
            <View style={styles.userStrategyHeader}>
              <Text style={styles.userStrategyLabel}>Your Strategy Notes</Text>
              {savingUserStrategy && (
                <ActivityIndicator size="small" color="#3B82F6" />
              )}
            </View>
            <TextInput
              style={styles.userStrategyInput}
              value={userStrategy}
              onChangeText={handleUserStrategyChange}
              placeholder="Add your own strategy notes for upwind legs... (e.g., side preference, shift plan, tacking)"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <StrategyCard
      icon="sail-boat"
      title="Upwind Strategy"
      status={getCardStatus()}
      statusMessage={getStatusMessage()}
      expandable={false}
    >
      {renderUpwindContent()}
    </StrategyCard>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  beatsContainer: {
    gap: 16,
  },
  beatCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  beatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  beatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  favoredSideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  favoredSideText: {
    fontSize: 12,
    fontWeight: '700',
  },
  theorySection: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  executionSection: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  theoryText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  executionText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  reasoningText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  keyPointsList: {
    gap: 6,
  },
  keyPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  keyPointText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    minWidth: 40,
    textAlign: 'right',
  },
  userStrategySection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  userStrategyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userStrategyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userStrategyInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    lineHeight: 20,
  },
  // Community Tips Styles
  communityTipsSection: {
    marginTop: 16,
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    overflow: 'hidden',
  },
  communityTipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  communityTipsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  communityTipsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
  communityTipsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  communityTipsBadgeText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  communityTipsList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  communityTipItem: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  communityTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  communityTipTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  communityTipDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginLeft: 20,
  },
  communityTipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
    marginTop: 4,
  },
  communityTipVotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  communityTipVoteCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  communityTipsHint: {
    fontSize: 11,
    color: '#8B5CF6',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
