/**
 * Start Strategy Card - AI-Powered Start Line Analysis
 * Shows favored end, line bias, and recommended approach
 */

import { createLogger } from '@/lib/utils/logger';
import { useAuth } from '@/providers/AuthProvider';
import type { RaceConditions } from '@/services/ai/RaceStrategyEngine';
import { raceStrategyEngine } from '@/services/ai/RaceStrategyEngine';
import { postRaceLearningService } from '@/services/PostRaceLearningService';
import { strategicPlanningService } from '@/services/StrategicPlanningService';
import { supabase } from '@/services/supabase';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import type { LearningProfile } from '@/types/raceLearning';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StrategyCard } from './StrategyCard';

interface StartStrategyData {
  favoredEnd: 'pin' | 'boat' | 'middle';
  lineBias: number; // degrees, positive = pin favored, negative = boat favored
  approach: string;
  reasoning: string;
  confidence: number; // 0-100
  windDirection?: number;
  currentDirection?: number;
}

interface StartStrategyCardProps {
  raceId: string;
  raceName: string;
  raceStartTime?: string;
  venueId?: string;
  venueName?: string;
  venueCoordinates?: { lat: number; lng: number };
  racingAreaPolygon?: { lat: number; lng: number }[];
  weather?: {
    wind?: {
      speed: number;
      direction: string;
      speedMin: number;
      speedMax: number;
    };
    current?: {
      speed: number;
      direction: number;
    };
  };
  onGenerate?: () => void;
  sailorId?: string;
  raceEventId?: string;
}

const logger = createLogger('StartStrategyCard');
export function StartStrategyCard({
  raceId,
  raceName,
  raceStartTime,
  venueId,
  venueName,
  venueCoordinates: _venueCoordinates,
  racingAreaPolygon,
  weather,
  onGenerate,
  sailorId: _sailorId,
  raceEventId
}: StartStrategyCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<StartStrategyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userStrategy, setUserStrategy] = useState('');
  const [savingUserStrategy, setSavingUserStrategy] = useState(false);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const resolveVenueId = useCallback(async (): Promise<string | null> => {
    if (venueId) return venueId;

    const trimmedVenueName = venueName?.trim();
    if (!trimmedVenueName) return null;

    const exact = await supabase
      .from('sailing_venues')
      .select('id')
      .ilike('name', trimmedVenueName)
      .limit(1)
      .maybeSingle();

    if (exact.data?.id) return exact.data.id;

    const fuzzy = await supabase
      .from('sailing_venues')
      .select('id')
      .ilike('name', `%${trimmedVenueName}%`)
      .limit(1)
      .maybeSingle();

    return fuzzy.data?.id || null;
  }, [venueId, venueName]);

  const loadStrategy = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const primary = await supabase
        .from('race_strategies')
        .select('*')
        .eq('regatta_id', raceId)
        .eq('user_id', user.id)
        .maybeSingle();
      let data = primary.data;
      let fetchError = primary.error;
      const status = (primary as any).status;
      const statusText = (primary as any).statusText;
      if (fetchError && isMissingIdColumn(fetchError, 'race_strategies', 'regatta_id')) {
        const fallback = await supabase
          .from('race_strategies')
          .select('*')
          .eq('race_id', raceId)
          .eq('user_id', user.id)
          .maybeSingle();
        data = fallback.data;
        fetchError = fallback.error;
      }

      if (fetchError) {
        logger.warn('[StartStrategyCard] Supabase returned error when loading strategy', {
          raceId,
          userId: user.id,
          status,
          statusText,
          code: fetchError.code,
          details: fetchError.details
        });
        throw fetchError;
      }

      logger.debug('[StartStrategyCard] Supabase load response', {
        raceId,
        userId: user.id,
        status,
        hasData: Boolean(data)
      });

      if (data && data.favored_end) {
        // Extract start strategy from database
        setStrategy({
          favoredEnd: data.favored_end as 'pin' | 'boat' | 'middle',
          lineBias: parseFloat(data.start_line_bias) || 0,
          approach: data.layline_approach || '',
          reasoning: data.wind_strategy || '',
          confidence: data.confidence_score || 0,
        });
      }
    } catch (err) {
      console.error('[StartStrategyCard] Load error:', err);
      const message = err instanceof Error ? err.message : 'Failed to load strategy';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, raceId]);

  useEffect(() => {
    loadStrategy();
  }, [loadStrategy]);

  // Load sailor's learning profile for personalized recommendations
  useEffect(() => {
    if (!user?.id) return;

    const loadLearningProfile = async () => {
      try {
        logger.debug('[StartStrategyCard] Loading sailor learning profile');
        const profile = await postRaceLearningService.getLearningProfileForUser(user.id);
        if (profile && profile.racesAnalyzed > 0) {
          setLearningProfile(profile);
          logger.info('[StartStrategyCard] Loaded learning profile', {
            racesAnalyzed: profile.racesAnalyzed,
            strengthsCount: profile.strengths.length,
            focusAreasCount: profile.focusAreas.length
          });
        }
      } catch (err) {
        logger.warn('[StartStrategyCard] Could not load learning profile', err);
        // Non-blocking - strategy will work without personalization
      }
    };

    loadLearningProfile();
  }, [user?.id]);

  // Load user's manual strategy
  // Note: sailor_race_preparation uses auth.uid() for RLS, so we use user.id
  useEffect(() => {
    if (!user?.id || !raceEventId) {
      return;
    }

    const loadUserStrategy = async () => {
      try {
        const prep = await strategicPlanningService.getPreparationWithStrategy(
          raceEventId,
          user.id // Use user.id (auth.uid) instead of sailorId for RLS compatibility
        );
        if (prep?.start_strategy) {
          setUserStrategy(prep.start_strategy);
        }
      } catch (err) {
        logger.error('[StartStrategyCard] Error loading user strategy', err);
      }
    };

    loadUserStrategy();
  }, [user?.id, raceEventId]);

  // Auto-save user's strategy on change
  // Note: sailor_race_preparation uses auth.uid() for RLS, so we use user.id
  const handleUserStrategyChange = async (text: string) => {
    setUserStrategy(text);

    if (!user?.id || !raceEventId) {
      return;
    }

    setSavingUserStrategy(true);
    try {
      await strategicPlanningService.updatePhaseStrategy(
        raceEventId,
        user.id, // Use user.id (auth.uid) instead of sailorId for RLS compatibility
        'startStrategy',
        text
      );
    } catch (err) {
      logger.error('[StartStrategyCard] Error saving user strategy', err);
    } finally {
      setSavingUserStrategy(false);
    }
  };

  // Auto-generate strategy if not exists
  useEffect(() => {
    if (!loading && !strategy && !error && user) {
      logger.debug('[StartStrategyCard] Auto-generating strategy on mount');
      generateStrategy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, strategy, error, user]);

  const generateStrategy = async () => {
    if (!user) {
      logger.error('[generateStrategy] No user - cannot generate');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      logger.info('[generateStrategy] Starting strategy generation', {
        raceId,
        userId: user.id,
        raceName,
        venueId,
        venueName,
        hasWeather: !!weather
      });

      // Prepare race conditions for AI
      const windDirectionDegrees = convertWindDirectionToDegrees(weather?.wind?.direction || 'SW');
      const conditions: RaceConditions = {
        wind: {
          speed: weather?.wind?.speed || ((weather?.wind?.speedMin || 0) + (weather?.wind?.speedMax || 0)) / 2 || 12,
          direction: windDirectionDegrees,
          forecast: {
            nextHour: { speed: weather?.wind?.speed || 12, direction: windDirectionDegrees },
            nextThreeHours: { speed: weather?.wind?.speed || 12, direction: windDirectionDegrees }
          },
          confidence: 0.8
        },
        current: {
          speed: weather?.current?.speed || 0.5,
          direction: weather?.current?.direction || 90,
          tidePhase: 'flood' as const
        },
        waves: {
          height: 0.8,
          period: 5,
          direction: windDirectionDegrees
        },
        visibility: 10,
        temperature: 22,
        weatherRisk: 'low' as const
      };

      logger.debug('[generateStrategy] Race conditions prepared', conditions);

      // Build sailor profile for personalized recommendations
      const sailorProfileForAI = learningProfile && learningProfile.racesAnalyzed > 0 ? {
        strengths: learningProfile.strengths.map(s => ({
          metric: s.label, // PerformancePattern uses 'label' not 'metric'
          average: s.average,
          trend: s.trend
        })),
        focusAreas: learningProfile.focusAreas.map(f => ({
          metric: f.label, // PerformancePattern uses 'label' not 'metric'
          average: f.average,
          trend: f.trend
        })),
        recurringWins: learningProfile.recurringWins?.map(w => w.summary),
        recurringChallenges: learningProfile.recurringChallenges?.map(c => c.summary),
        racesAnalyzed: learningProfile.racesAnalyzed
      } : undefined;

      if (sailorProfileForAI) {
        logger.info('[generateStrategy] Including sailor learning profile for personalization', {
          racesAnalyzed: sailorProfileForAI.racesAnalyzed,
          strengthsCount: sailorProfileForAI.strengths.length,
          focusAreasCount: sailorProfileForAI.focusAreas.length
        });
      }

      const resolvedVenueId = await resolveVenueId();
      if (!resolvedVenueId) {
        throw new Error('Venue is missing. Add a venue to this race to generate AI start strategy.');
      }

      // Generate venue-based strategy using AI
      const startTime = Date.now();
      logger.info('[generateStrategy] Calling AI strategy engine - START', {
        venueId: resolvedVenueId,
        raceName
      });
      logger.debug('⏳ Starting AI strategy generation...');
      
      const aiStrategy = await raceStrategyEngine.generateVenueBasedStrategy(
        resolvedVenueId,
        conditions,
        {
          raceName,
          raceDate: raceStartTime ? new Date(raceStartTime) : new Date(),
          raceTime: raceStartTime ? new Date(raceStartTime).toTimeString().split(' ')[0] : '11:00:00',
          boatType: 'Keelboat',
          fleetSize: 20,
          importance: 'series',
          racingAreaPolygon,
          sailorProfile: sailorProfileForAI
        }
      );

      const elapsedTime = Date.now() - startTime;
      // Track if this strategy is personalized
      setIsPersonalized(!!sailorProfileForAI);

      logger.info('[generateStrategy] AI strategy received', {
        hasStrategy: !!aiStrategy,
        hasStartStrategy: !!aiStrategy?.strategy?.startStrategy,
        elapsedMs: elapsedTime
      });
      logger.debug(`✅ AI strategy generated in ${(elapsedTime / 1000).toFixed(1)}s`);

      // Extract start strategy from full AI strategy
      const startStrat = aiStrategy.strategy.startStrategy;
      const extractedStrategy: StartStrategyData = {
        favoredEnd: extractFavoredEnd(startStrat.action),
        lineBias: extractLineBias(startStrat.action),
        approach: startStrat.execution || startStrat.action,
        reasoning: `${startStrat.theory || ''}\n\n${startStrat.rationale || ''}`.trim(),
        confidence: startStrat.confidence || 75,
        windDirection: conditions.wind.direction,
        currentDirection: conditions.current.direction,
      };

      logger.debug('[generateStrategy] Extracted strategy', extractedStrategy);

      // Save to database
      // First, get existing strategy_content to preserve other data
      logger.info('[generateStrategy] Fetching existing strategy from database');
      const primaryExistingData = await supabase
        .from('race_strategies')
        .select('strategy_content')
        .eq('regatta_id', raceId)
        .eq('user_id', user.id)
        .maybeSingle();
      let existingData = primaryExistingData.data;
      if (
        primaryExistingData.error &&
        isMissingIdColumn(primaryExistingData.error, 'race_strategies', 'regatta_id')
      ) {
        const fallbackExistingData = await supabase
          .from('race_strategies')
          .select('strategy_content')
          .eq('race_id', raceId)
          .eq('user_id', user.id)
          .maybeSingle();
        existingData = fallbackExistingData.data;
      }

      logger.debug('[generateStrategy] Existing data', { hasExisting: !!existingData });

      // Preserve existing strategy_content and add fullAIStrategy
      const strategyContent = existingData?.strategy_content || {};
      (strategyContent as any).fullAIStrategy = aiStrategy; // Save full AI strategy for other cards
      (strategyContent as any).startStrategy = extractedStrategy; // Also save extracted start strategy

      // IMPORTANT: Preserve tacticalPlan if it exists (from TacticalPlanCard)
      // This ensures multiple cards don't overwrite each other's data

      const upsertData = {
        regatta_id: raceId,
        user_id: user.id,
        strategy_type: 'pre_race',
        favored_end: extractedStrategy.favoredEnd,
        start_line_bias: extractedStrategy.lineBias.toString(),
        layline_approach: extractedStrategy.approach,
        wind_strategy: extractedStrategy.reasoning,
        confidence_score: extractedStrategy.confidence,
        strategy_content: strategyContent, // Include full AI strategy
        ai_generated: true,
        // Note: ai_model and generated_at columns don't exist yet - removed until migration runs
      };

      logger.info('[generateStrategy] Upserting to database', {
        regatta_id: upsertData.regatta_id,
        user_id: upsertData.user_id,
        strategy_type: upsertData.strategy_type,
        favored_end: upsertData.favored_end,
        hasStrategyContent: !!upsertData.strategy_content
      });

      const primaryUpsert = await supabase
        .from('race_strategies')
        .upsert(upsertData, {
          onConflict: 'regatta_id,user_id'
        });
      let upsertError = primaryUpsert.error;
      if (upsertError && isMissingIdColumn(upsertError, 'race_strategies', 'regatta_id')) {
        const fallbackUpsertData = {
          ...upsertData,
          race_id: raceId,
          regatta_id: undefined,
        } as any;
        const fallbackUpsert = await supabase
          .from('race_strategies')
          .upsert(fallbackUpsertData, {
            onConflict: 'race_id,user_id'
          });
        upsertError = fallbackUpsert.error;
      }

      if (upsertError) {
        logger.error('[generateStrategy] Database upsert error', {
          error: upsertError,
          message: upsertError.message,
          details: upsertError.details,
          hint: upsertError.hint,
          code: upsertError.code
        });
        throw upsertError;
      }

      logger.info('[generateStrategy] Strategy saved successfully');

      setStrategy(extractedStrategy);
      onGenerate?.();

    } catch (err) {
      logger.error('[StartStrategyCard] Generate error', {
        error: err,
        message: (err as Error)?.message,
        stack: (err as Error)?.stack
      });
      console.error('[StartStrategyCard] Generate error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate strategy';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert wind direction string to degrees
  const convertWindDirectionToDegrees = (direction: string): number => {
    const directions: { [key: string]: number } = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    };
    return directions[direction.toUpperCase()] || 225; // Default SW
  };

  // Helper to extract favored end from AI action text
  const extractFavoredEnd = (action: string): 'pin' | 'boat' | 'middle' => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('pin')) return 'pin';
    if (lowerAction.includes('boat') || lowerAction.includes('committee')) return 'boat';
    return 'middle';
  };

  // Helper to extract line bias from AI action text
  const extractLineBias = (action: string): number => {
    const match = action.match(/(\d+)°/);
    if (match) {
      const degrees = parseInt(match[1]);
      // If mentions pin, bias is positive; if boat, negative
      return action.toLowerCase().includes('pin') ? degrees : -degrees;
    }
    return 0;
  };

  const getCardStatus = () => {
    if (loading) return 'generating';
    if (error) return 'error';
    if (!strategy) return 'not_set';
    return 'ready';
  };

  const getStatusMessage = () => {
    if (loading) return 'Analyzing start line...';
    if (error) return error;
    if (!strategy) return 'Tap to generate';
    return `${strategy.confidence}% confidence`;
  };

  const getFavoredEndIcon = () => {
    switch (strategy?.favoredEnd) {
      case 'pin': return 'pin';
      case 'boat': return 'flag';
      case 'middle': return 'circle-outline';
      default: return 'help-circle';
    }
  };

  const getFavoredEndColor = () => {
    switch (strategy?.favoredEnd) {
      case 'pin': return '#10B981'; // Green
      case 'boat': return '#3B82F6'; // Blue
      case 'middle': return '#F59E0B'; // Yellow
      default: return '#64748B';
    }
  };

  // Helper to convert degrees to compass direction
  const degreesToCompass = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  // Generate sailor-friendly explanation for why this end is favored
  const generateWhyExplanation = (): string[] => {
    if (!strategy) return [];
    
    const explanations: string[] = [];
    const { favoredEnd, windDirection, currentDirection } = strategy;
    
    if (favoredEnd === 'boat') {
      // Wind factor explanation
      if (windDirection !== undefined) {
        const compass = degreesToCompass(windDirection);
        if (windDirection >= 180 && windDirection <= 270) {
          explanations.push(`Wind from ${compass} (${windDirection}°) creates a starboard tack advantage — starting at the boat end gives you right-of-way over port tack boats.`);
        } else if (windDirection > 270 || windDirection < 90) {
          explanations.push(`Wind from ${compass} (${windDirection}°) may be veering right, making the starboard side of the course more favorable after the start.`);
        } else {
          explanations.push(`Wind from ${compass} (${windDirection}°) combined with local conditions favors the committee boat end.`);
        }
      }
      
      // Current factor explanation
      if (currentDirection !== undefined) {
        const currentCompass = degreesToCompass(currentDirection);
        if (currentDirection >= 45 && currentDirection <= 135) {
          explanations.push(`Easterly current (${currentCompass}, ${currentDirection}°) pushes boats to the left — starting at the boat end keeps you "up-current" with less sideways drift.`);
        } else if (currentDirection >= 225 && currentDirection <= 315) {
          explanations.push(`Westerly current (${currentCompass}, ${currentDirection}°) creates favorable positioning at the boat end for the first leg.`);
        } else {
          explanations.push(`Current from ${currentCompass} (${currentDirection}°) affects boat positioning — the boat end minimizes adverse current effects.`);
        }
      }
      
      explanations.push(`Combined advantage: Cleaner air off the line and better positioning toward the first mark.`);
      
    } else if (favoredEnd === 'pin') {
      // Wind factor explanation
      if (windDirection !== undefined) {
        const compass = degreesToCompass(windDirection);
        if (windDirection >= 90 && windDirection <= 180) {
          explanations.push(`Wind from ${compass} (${windDirection}°) creates a port-favored line — starting at the pin gives you extra distance toward the windward mark.`);
        } else {
          explanations.push(`Wind from ${compass} (${windDirection}°) combined with line bias makes the pin end geometrically advantageous.`);
        }
      }
      
      // Current factor explanation
      if (currentDirection !== undefined) {
        const currentCompass = degreesToCompass(currentDirection);
        explanations.push(`Current from ${currentCompass} (${currentDirection}°) favors the left side — the pin end sets you up for the advantageous side of the course.`);
      }
      
      explanations.push(`Combined advantage: Shorter distance to the first mark and favorable positioning for the beat.`);
      
    } else {
      // Middle
      explanations.push(`Line appears relatively square — starting in the middle provides flexibility to go either direction.`);
      explanations.push(`Middle starts offer cleaner air with more escape routes if congested at the ends.`);
      if (windDirection !== undefined) {
        explanations.push(`Wind shifts expected — a middle position lets you react to changes without committing early.`);
      }
    }
    
    return explanations;
  };

  const renderStrategyContent = () => {
    // Show error state
    if (error) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={generateStrategy}
            disabled={loading}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Show loading state
    if (!strategy) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.emptyText}>
            Generating start strategy based on wind, current, and course layout...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.strategyContent}>
        {/* Personalization Badge */}
        {isPersonalized && learningProfile && (
          <View style={styles.personalizationBadge}>
            <MaterialCommunityIcons name="account-check" size={14} color="#8B5CF6" />
            <Text style={styles.personalizationText}>
              Personalized based on {learningProfile.racesAnalyzed} past race{learningProfile.racesAnalyzed !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Favored End Indicator */}
        <View style={styles.favoredEndSection}>
          <View style={styles.favoredEndHeader}>
            <Text style={styles.sectionTitle}>Favored End</Text>
            <TouchableOpacity
              style={styles.regenerateButton}
              onPress={generateStrategy}
              disabled={loading}
            >
              <MaterialCommunityIcons name="refresh" size={16} color="#3B82F6" />
              <Text style={styles.regenerateButtonText}>Regenerate</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.favoredEndDisplay}>
            <View style={[
              styles.favoredEndBadge,
              { backgroundColor: getFavoredEndColor() + '20' }
            ]}>
              <MaterialCommunityIcons
                name={getFavoredEndIcon()}
                size={32}
                color={getFavoredEndColor()}
              />
              <Text style={[
                styles.favoredEndText,
                { color: getFavoredEndColor() }
              ]}>
                {strategy.favoredEnd.toUpperCase()} END
              </Text>
            </View>

            {/* Why This End? - Expandable Explanation */}
            <TouchableOpacity 
              style={styles.whySection}
              onPress={() => setShowExplanation(!showExplanation)}
              activeOpacity={0.7}
            >
              <View style={styles.whySectionHeader}>
                <MaterialCommunityIcons name="lightbulb-outline" size={18} color="#F59E0B" />
                <Text style={styles.whyTitle}>Why {strategy.favoredEnd} end?</Text>
                <MaterialCommunityIcons 
                  name={showExplanation ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color="#64748B" 
                />
              </View>
            </TouchableOpacity>

            {showExplanation && (
              <View style={styles.explanationBox}>
                {generateWhyExplanation().map((explanation, index) => (
                  <View key={index} style={styles.explanationItem}>
                    <Text style={styles.explanationBullet}>•</Text>
                    <Text style={styles.explanationText}>{explanation}</Text>
                  </View>
                ))}
              </View>
            )}

            {strategy.lineBias !== 0 && (
              <View style={styles.lineBiasContainer}>
                <Text style={styles.lineBiasLabel}>Line Bias</Text>
                <Text style={styles.lineBiasValue}>
                  {Math.abs(strategy.lineBias)}° {strategy.lineBias > 0 ? '→ PIN' : '→ BOAT'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Recommended Approach */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Approach</Text>
          <View style={styles.approachBox}>
            <MaterialCommunityIcons name="compass" size={20} color="#3B82F6" />
            <Text style={styles.approachText}>{strategy.approach}</Text>
          </View>
        </View>

        {/* Reasoning */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analysis</Text>
          <Text style={styles.reasoningText}>{strategy.reasoning}</Text>
        </View>

        {/* Environmental Factors */}
        {(strategy.windDirection || strategy.currentDirection) && (
          <View style={styles.factorsRow}>
            {strategy.windDirection && (
              <View style={styles.factorBadge}>
                <MaterialCommunityIcons name="weather-windy" size={16} color="#64748B" />
                <Text style={styles.factorText}>Wind {strategy.windDirection}°</Text>
              </View>
            )}
            {strategy.currentDirection && (
              <View style={styles.factorBadge}>
                <MaterialCommunityIcons name="waves" size={16} color="#64748B" />
                <Text style={styles.factorText}>Current {strategy.currentDirection}°</Text>
              </View>
            )}
          </View>
        )}

        {/* Confidence Bar */}
        <View style={styles.confidenceSection}>
          <View style={styles.confidenceHeader}>
            <Text style={styles.confidenceLabel}>Confidence</Text>
            <Text style={styles.confidenceValue}>{strategy.confidence}%</Text>
          </View>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${strategy.confidence}%`,
                  backgroundColor: strategy.confidence > 70 ? '#10B981' :
                                 strategy.confidence > 50 ? '#F59E0B' : '#EF4444'
                }
              ]}
            />
          </View>
        </View>

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
              placeholder="Add your own strategy notes for the start... (e.g., favored end, timing, positioning)"
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
      icon="flag-checkered"
      title="Start Strategy"
      status={getCardStatus()}
      statusMessage={getStatusMessage()}
      expandable={false}
    >
      {renderStrategyContent()}
    </StrategyCard>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  strategyContent: {
    gap: 20,
  },
  personalizationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 4,
  },
  personalizationText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '500',
  },
  favoredEndSection: {
    gap: 12,
  },
  favoredEndHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  regenerateButtonText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  favoredEndDisplay: {
    gap: 12,
  },
  favoredEndBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  favoredEndText: {
    fontSize: 18,
    fontWeight: '700',
  },
  lineBiasContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lineBiasLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  lineBiasValue: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '600',
    marginTop: 4,
  },
  whySection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    overflow: 'hidden',
  },
  whySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  whyTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  explanationBox: {
    backgroundColor: '#FEFCE8',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  explanationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  explanationBullet: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '600',
    lineHeight: 20,
  },
  explanationText: {
    flex: 1,
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  section: {
    gap: 8,
  },
  approachBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  approachText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  reasoningText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  factorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  factorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  factorText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  confidenceSection: {
    gap: 8,
    marginTop: 8,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  confidenceValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  confidenceBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
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
});
