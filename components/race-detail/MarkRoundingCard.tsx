/**
 * Mark Rounding Card
 * Dedicated card for mark rounding tactics - extracted from TacticalPlanCard
 * Shows approach & exit strategies with championship techniques
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StrategyCard } from './StrategyCard';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { strategicPlanningService } from '@/services/StrategicPlanningService';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

const logger = createLogger('MarkRoundingCard');

interface MarkRounding {
  mark: string; // 'Windward Mark', 'Leeward Gate', etc.
  approach?: string;
  rounding?: string;
  exit?: string;
  theory?: string;
  execution?: string;
  championStory?: string;
  confidence: number;
}

interface MarkRoundingCardProps {
  raceId: string;
  raceName: string;
  sailorId?: string;
  raceEventId?: string;
}

export function MarkRoundingCard({
  raceId,
  raceEventId
}: MarkRoundingCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roundings, setRoundings] = useState<MarkRounding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userWindwardStrategy, setUserWindwardStrategy] = useState('');
  const [userLeewardStrategy, setUserLeewardStrategy] = useState('');
  const [savingWindward, setSavingWindward] = useState(false);
  const [savingLeeward, setSavingLeeward] = useState(false);

  // Use refs to track state for polling without triggering re-renders
  const roundingsRef = useRef<MarkRounding[]>([]);
  const loadingRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const pollCountRef = useRef(0);
  const MAX_POLLS = 20; // Stop polling after 20 attempts (60+ seconds with exponential backoff)

  // Update refs when state changes
  useEffect(() => {
    roundingsRef.current = roundings;
  }, [roundings]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const loadMarkRoundings = useCallback(async () => {
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

      if (fetchError) throw fetchError;

      if (data && data.strategy_content) {
        const strategyContent = data.strategy_content as any;

        // Extract mark roundings from full AI strategy
        if (strategyContent.fullAIStrategy?.strategy?.markRoundings) {
          const markData = strategyContent.fullAIStrategy.strategy.markRoundings.map((mr: any) => ({
            mark: mr.phase === 'mark_rounding' ? 'Mark Rounding' : mr.phase,
            approach: mr.action,
            theory: mr.theory,
            execution: mr.execution,
            championStory: mr.championStory,
            confidence: mr.confidence || 75
          }));
          setRoundings(markData);
        } else {
          // Fallback: Try to extract from tactical plan if available
          setError('No mark rounding strategy found. Generate your tactical plan first.');
        }
      } else {
        setError('No strategy found. Generate your tactical plan first.');
      }
    } catch (err) {
      console.error('[MarkRoundingCard] Load error:', err);
      setError('Failed to load mark rounding strategy');
    } finally {
      setLoading(false);
    }
  }, [user, raceId]);

  // Store loadMarkRoundings in a ref to avoid effect re-runs
  const loadMarkRoundingsRef = useRef(loadMarkRoundings);
  useEffect(() => {
    loadMarkRoundingsRef.current = loadMarkRoundings;
  }, [loadMarkRoundings]);

  useEffect(() => {
    // Reset poll count when race changes
    pollCountRef.current = 0;
    hasLoadedRef.current = false;
    
    // Initial load
    loadMarkRoundingsRef.current();

    // Subscribe to realtime changes for this race's strategy
    const subscription = supabase
      .channel(`race_strategy_marks_${raceId}`)
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
          loadMarkRoundingsRef.current();
        }
      )
      .subscribe();

    // Poll for strategy updates with exponential backoff if no data yet
    // This handles the case where strategy is generated after component mounts
    // Stop polling after MAX_POLLS attempts to prevent infinite polling
    // Use exponential backoff: 2s, 3s, 4s, 5s... to be patient with AI generation
    let pollInterval: NodeJS.Timeout;
    const pollWithBackoff = () => {
      if (roundingsRef.current.length === 0 && !loadingRef.current && pollCountRef.current < MAX_POLLS) {
        pollCountRef.current += 1;
        const nextDelay = Math.min(2000 + pollCountRef.current * 1000, 10000); // 2s to 10s max
        loadMarkRoundingsRef.current();
        pollInterval = setTimeout(pollWithBackoff, nextDelay);
      }
    };
    // Start polling after initial delay (give StartStrategyCard time to begin generating)
    pollInterval = setTimeout(pollWithBackoff, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(pollInterval);
    };
  }, [raceId]); // Only re-run when raceId changes, not when loadMarkRoundings changes

  // Load user's manual strategy for marks
  useEffect(() => {
    if (!user?.id || !raceEventId) return;

    const loadUserStrategy = async () => {
      try {
        const prep = await strategicPlanningService.getPreparationWithStrategy(
          raceEventId,
          user.id
        );
        if (prep?.windward_mark_strategy) {
          setUserWindwardStrategy(prep.windward_mark_strategy);
        }
        if (prep?.leeward_mark_strategy) {
          setUserLeewardStrategy(prep.leeward_mark_strategy);
        }
      } catch (err) {
        logger.error('[MarkRoundingCard] Error loading user strategy', err);
      }
    };

    loadUserStrategy();
  }, [raceEventId, user?.id]);

  // Auto-save windward mark strategy
  const handleWindwardStrategyChange = async (text: string) => {
    setUserWindwardStrategy(text);
    if (!user?.id || !raceEventId) return;

    setSavingWindward(true);
    try {
      await strategicPlanningService.updatePhaseStrategy(
        raceEventId,
        user.id,
        'windwardMarkStrategy',
        text
      );
    } catch (err) {
      logger.error('[MarkRoundingCard] Error saving windward strategy', err);
    } finally {
      setSavingWindward(false);
    }
  };

  // Auto-save leeward mark strategy
  const handleLeewardStrategyChange = async (text: string) => {
    setUserLeewardStrategy(text);
    if (!user?.id || !raceEventId) return;

    setSavingLeeward(true);
    try {
      await strategicPlanningService.updatePhaseStrategy(
        raceEventId,
        user.id,
        'leewardMarkStrategy',
        text
      );
    } catch (err) {
      logger.error('[MarkRoundingCard] Error saving leeward strategy', err);
    } finally {
      setSavingLeeward(false);
    }
  };

  const getCardStatus = () => {
    if (loading) return 'generating';
    if (error) return 'error';
    if (roundings.length === 0) return 'not_set';
    return 'ready';
  };

  const getStatusMessage = () => {
    if (loading) return 'Loading mark tactics...';
    if (error) return error;
    if (roundings.length === 0) return 'Generate tactical plan first';
    return `${roundings.length} mark${roundings.length > 1 ? 's' : ''}`;
  };

  const renderMarkContent = () => {
    // Only show spinner on initial load when we have no data
    if (loading && roundings.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      );
    }

    // If we have no data but finished loading, show error/empty state
    if (roundings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="flag-checkered" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            {error || 'No mark rounding strategy available yet'}
          </Text>
          <Text style={styles.emptyHint}>
            Generate your tactical plan to see mark rounding recommendations
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMarkRoundings} disabled={loading}>
            <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.roundingsContainer}>
        {roundings.map((rounding, index) => (
          <View key={index} style={styles.roundingCard}>
            {/* Mark Header */}
            <View style={styles.markHeader}>
              <MaterialCommunityIcons name="flag-checkered" size={20} color="#3B82F6" />
              <Text style={styles.markTitle}>{rounding.mark}</Text>
            </View>

            {/* Theory (What/Why) */}
            {rounding.theory && (
              <View style={styles.theorySection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="lightbulb-on" size={16} color="#F59E0B" />
                  <Text style={styles.sectionLabel}>THEORY (What/Why)</Text>
                </View>
                <Text style={styles.theoryText}>{rounding.theory}</Text>
              </View>
            )}

            {/* Execution (How) */}
            {rounding.execution && (
              <View style={styles.executionSection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="steering" size={16} color="#8B5CF6" />
                  <Text style={styles.sectionLabel}>EXECUTION (How)</Text>
                </View>
                <Text style={styles.executionText}>{rounding.execution}</Text>
              </View>
            )}

            {/* Approach/Exit (fallback) */}
            {!rounding.theory && !rounding.execution && rounding.approach && (
              <View style={styles.approachSection}>
                <Text style={styles.approachLabel}>APPROACH & ROUNDING</Text>
                <Text style={styles.approachText}>{rounding.approach}</Text>
              </View>
            )}

            {/* Champion Story */}
            {rounding.championStory && (
              <View style={styles.championBox}>
                <View style={styles.championHeader}>
                  <MaterialCommunityIcons name="trophy" size={18} color="#F59E0B" />
                  <Text style={styles.championLabel}>Championship Technique</Text>
                </View>
                <Text style={styles.championText}>{rounding.championStory}</Text>
              </View>
            )}

            {/* Mark Rounding Tips */}
            <View style={styles.tipsGrid}>
              <View style={styles.tipItem}>
                <MaterialCommunityIcons name="check-circle" size={14} color="#10B981" />
                <Text style={styles.tipItemText}>Wide entry, tight exit</Text>
              </View>
              <View style={styles.tipItem}>
                <MaterialCommunityIcons name="check-circle" size={14} color="#10B981" />
                <Text style={styles.tipItemText}>Maintain boat speed</Text>
              </View>
              <View style={styles.tipItem}>
                <MaterialCommunityIcons name="check-circle" size={14} color="#10B981" />
                <Text style={styles.tipItemText}>Set up for next leg</Text>
              </View>
              <View style={styles.tipItem}>
                <MaterialCommunityIcons name="check-circle" size={14} color="#10B981" />
                <Text style={styles.tipItemText}>Protect inside position</Text>
              </View>
            </View>

            {/* Confidence */}
            <View style={styles.confidenceRow}>
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    {
                      width: `${rounding.confidence}%`,
                      backgroundColor: rounding.confidence > 70 ? '#10B981' :
                                     rounding.confidence > 50 ? '#F59E0B' : '#EF4444'
                    }
                  ]}
                />
              </View>
              <Text style={styles.confidenceText}>{rounding.confidence}%</Text>
            </View>
          </View>
        ))}

        {/* User Strategy Input Section */}
        {user?.id && raceEventId && (
          <>
            {/* Windward Mark Notes */}
            <View style={styles.userStrategySection}>
              <View style={styles.userStrategyHeader}>
                <Text style={styles.userStrategyLabel}>Windward Mark Notes</Text>
                {savingWindward && (
                  <ActivityIndicator size="small" color="#3B82F6" />
                )}
              </View>
              <TextInput
                style={styles.userStrategyInput}
                value={userWindwardStrategy}
                onChangeText={handleWindwardStrategyChange}
                placeholder="Add your own notes for windward mark rounding... (e.g., approach angle, positioning)"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Leeward Mark Notes */}
            <View style={styles.userStrategySection}>
              <View style={styles.userStrategyHeader}>
                <Text style={styles.userStrategyLabel}>Leeward Mark Notes</Text>
                {savingLeeward && (
                  <ActivityIndicator size="small" color="#3B82F6" />
                )}
              </View>
              <TextInput
                style={styles.userStrategyInput}
                value={userLeewardStrategy}
                onChangeText={handleLeewardStrategyChange}
                placeholder="Add your own notes for leeward mark rounding... (e.g., approach angle, positioning)"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <StrategyCard
      icon="flag-checkered"
      title="Mark Rounding"
      status={getCardStatus()}
      statusMessage={getStatusMessage()}
      expandable={false}
    >
      {renderMarkContent()}
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
  roundingsContainer: {
    gap: 16,
  },
  roundingCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  markHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  markTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  theorySection: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  executionSection: {
    backgroundColor: '#F5F3FF',
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
    color: '#5B21B6',
    lineHeight: 18,
  },
  approachSection: {
    gap: 6,
  },
  approachLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  approachText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  championBox: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  championHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  championLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  championText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  tipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tipItemText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
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
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    lineHeight: 20,
  },
});
