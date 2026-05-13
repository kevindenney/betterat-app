/**
 * Distance Racing Strategy Card
 * Dedicated card for distance/offshore racing strategy
 * Shows route planning, weather routing, tide strategy, and user notes
 * Uses long-distance-racing-analyst Anthropic AI skill automatically
 */

import { createLogger } from '@/lib/utils/logger';
import { useAuth } from '@/providers/AuthProvider';
import { raceStrategyEngine, type RaceConditions } from '@/services/ai/RaceStrategyEngine';
import { supabase } from '@/services/supabase';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StrategyCard } from './StrategyCard';

const logger = createLogger('DistanceRacingStrategyCard');

interface DistanceStrategyRecommendation {
  category: 'route_planning' | 'weather_routing' | 'tide_strategy' | 'crew_management' | 'safety' | 'finishing';
  title: string;
  content: string;
  keyPoints: string[];
  confidence: number;
  theory?: string;
  execution?: string;
}

interface DistanceRacingStrategy {
  overallApproach: string;
  routePlanning: {
    recommendedRoute: string;
    keyWaypoints: string[];
    decisionGates: { waypoint: string; decision: string }[];
  };
  weatherRouting: {
    strategy: string;
    forecastConfidence: 'high' | 'moderate' | 'low';
    keyChanges: string[];
  };
  tideStrategy: {
    approach: string;
    criticalTimings: string[];
  };
  recommendations: DistanceStrategyRecommendation[];
  confidence: number;
}

interface DistanceRacingStrategyCardProps {
  raceId: string;
  raceName: string;
  raceEventId?: string;
  routeWaypoints?: { name: string; latitude: number; longitude: number }[];
  totalDistanceNm?: number;
  raceDate?: string;
  venueId?: string;
}

export function DistanceRacingStrategyCard({
  raceId,
  raceName,
  raceEventId: _raceEventId,
  routeWaypoints = [],
  totalDistanceNm,
  raceDate,
  venueId
}: DistanceRacingStrategyCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<DistanceRacingStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userStrategy, setUserStrategy] = useState('');
  const [savingUserStrategy, setSavingUserStrategy] = useState(false);

  // Use refs to track state for polling without triggering re-renders
  const strategyRef = useRef<DistanceRacingStrategy | null>(null);
  const loadingRef = useRef(true);
  const pollCountRef = useRef(0);
  const MAX_POLLS = 20; // Stop polling after 20 attempts

  // Update refs when state changes
  useEffect(() => {
    strategyRef.current = strategy;
  }, [strategy]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const loadStrategyContent = useCallback(async () => {
    if (!user?.id) return null;

    const primary = await supabase
      .from('race_strategies')
      .select('strategy_content')
      .eq('regatta_id', raceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (primary.error && isMissingIdColumn(primary.error, 'race_strategies', 'regatta_id')) {
      const fallback = await supabase
        .from('race_strategies')
        .select('strategy_content')
        .eq('race_id', raceId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      return fallback.data;
    }

    if (primary.error) throw primary.error;
    return primary.data;
  }, [raceId, user?.id]);

  const upsertStrategyContent = useCallback(async (strategyContent: any, confidenceScore: number, aiGenerated: boolean) => {
    if (!user?.id) return;

    const primaryUpsert = await supabase
      .from('race_strategies')
      .upsert({
        regatta_id: raceId,
        user_id: user.id,
        strategy_type: 'pre_race',
        strategy_content: strategyContent,
        confidence_score: confidenceScore,
        ai_generated: aiGenerated,
      }, {
        onConflict: 'regatta_id,user_id'
      });

    if (primaryUpsert.error && isMissingIdColumn(primaryUpsert.error, 'race_strategies', 'regatta_id')) {
      const fallbackUpsert = await supabase
        .from('race_strategies')
        .upsert({
          race_id: raceId,
          user_id: user.id,
          strategy_type: 'pre_race',
          strategy_content: strategyContent,
          confidence_score: confidenceScore,
          ai_generated: aiGenerated,
        } as any, {
          onConflict: 'race_id,user_id'
        });
      if (fallbackUpsert.error) throw fallbackUpsert.error;
      return;
    }

    if (primaryUpsert.error) throw primaryUpsert.error;
  }, [raceId, user?.id]);

  const loadDistanceStrategy = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await loadStrategyContent();

      if (data && data.strategy_content) {
        const strategyContent = data.strategy_content as any;

        // Try to extract distance racing strategy
        if (strategyContent.distanceRacingStrategy) {
          setStrategy(strategyContent.distanceRacingStrategy);
        } else if (strategyContent.fullAIStrategy) {
          // Transform full AI strategy to distance racing format
          const aiStrategy = strategyContent.fullAIStrategy;
          const transformed = transformAIStrategyToDistanceFormat(aiStrategy);
          if (transformed) {
            setStrategy(transformed);
          } else {
            setError('No distance racing strategy found. Generate your tactical plan first.');
          }
        } else {
          setError('No distance racing strategy found. Generate your tactical plan first.');
        }
      } else {
        setError('No strategy found. Generate your tactical plan first.');
      }
    } catch (err) {
      console.error('[DistanceRacingStrategyCard] Load error:', err);
      const message = err instanceof Error ? err.message : 'Failed to load distance racing strategy';
      setError(message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loadStrategyContent]);

  useEffect(() => {
    loadDistanceStrategy();

    // Subscribe to realtime changes for this race's strategy
    const subscription = supabase
      .channel(`race_strategy_${raceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'race_strategies',
        },
        (payload) => {
          const payloadRaceId =
            (payload as any)?.new?.regatta_id ||
            (payload as any)?.new?.race_id ||
            (payload as any)?.old?.regatta_id ||
            (payload as any)?.old?.race_id;
          if (payloadRaceId !== raceId) return;
          // Reload strategy when it changes
          loadDistanceStrategy();
        }
      )
      .subscribe();

    // Poll for strategy updates with exponential backoff if no data yet
    pollCountRef.current = 0;
    
    let pollInterval: NodeJS.Timeout;
    const pollWithBackoff = () => {
      if (strategyRef.current === null && !loadingRef.current && pollCountRef.current < MAX_POLLS) {
        pollCountRef.current += 1;
        const nextDelay = Math.min(2000 + pollCountRef.current * 1000, 10000); // 2s to 10s max
        logger.debug(`Polling for strategy updates... (${pollCountRef.current}/${MAX_POLLS}, next in ${nextDelay/1000}s)`);
        loadDistanceStrategy();
        pollInterval = setTimeout(pollWithBackoff, nextDelay);
      } else if (pollCountRef.current >= MAX_POLLS) {
        logger.debug('Max poll attempts reached, stopping polling');
      }
    };
    // Start polling after initial delay (give TacticalPlanCard time to begin generating)
    pollInterval = setTimeout(pollWithBackoff, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(pollInterval);
    };
  }, [raceId, loadDistanceStrategy]);

  // Load user's manual strategy notes
  useEffect(() => {
    if (!user?.id) return;

    const loadUserStrategy = async () => {
      try {
        const data = await loadStrategyContent();

        if (data?.strategy_content) {
          const strategyContent = data.strategy_content as any;
          if (strategyContent.userNotes) {
            setUserStrategy(strategyContent.userNotes);
          }
        }
      } catch (err) {
        logger.error('[DistanceRacingStrategyCard] Error loading user strategy', err);
      }
    };

    loadUserStrategy();
  }, [loadStrategyContent, user?.id]);

  // Auto-generate strategy if not exists (only once on mount)
  const hasAttemptedGeneration = useRef(false);
  useEffect(() => {
    if (!loading && !strategy && !error && user && !hasAttemptedGeneration.current) {
      hasAttemptedGeneration.current = true;
      logger.debug('[DistanceRacingStrategyCard] Auto-generating distance racing strategy on mount');
      generateStrategy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, strategy, error, user]);

  const generateStrategy = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      logger.debug('[DistanceRacingStrategyCard] Generating AI-powered distance racing strategy...');

      // Fetch race data for context
      const { data: raceData, error: raceError } = await supabase
        .from('regattas')
        .select('*')
        .eq('id', raceId)
        .single();

      if (raceError) {
        logger.error('[DistanceRacingStrategyCard] Failed to fetch race data:', raceError);
        throw new Error(`Failed to load race data: ${raceError.message}`);
      }

      if (!raceData) {
        throw new Error('Race data not found');
      }

      // Build race conditions from available data
      const currentConditions: RaceConditions = {
        wind: {
          speed: 12, // Default values - should come from weather service
          direction: 45,
          forecast: {
            nextHour: { speed: 13, direction: 50 },
            nextThreeHours: { speed: 14, direction: 55 }
          },
          confidence: 0.8
        },
        current: {
          speed: 0.5,
          direction: 180,
          tidePhase: 'ebb'
        },
        waves: {
          height: 0.5,
          period: 4,
          direction: 45
        },
        visibility: 10,
        temperature: 18,
        weatherRisk: 'low'
      };

      // Generate strategy using AI - this will automatically use long-distance-racing-analyst skill
      // for distance races (detected via race_type='distance' or course length > 20nm)
      const racingAreaPolygon = (() => {
        const polygonCoords = raceData.racing_area_polygon?.coordinates?.[0];
        if (!Array.isArray(polygonCoords) || polygonCoords.length < 3) {
          return undefined;
        }
        const base = (polygonCoords as number[][]).map(([lng, lat]) => ({ lat, lng }));
        if (base.length >= 2) {
          const first = base[0];
          const last = base[base.length - 1];
          if (first.lat === last.lat && first.lng === last.lng) {
            base.pop();
          }
        }
        return base;
      })();

      const resolvedVenueId = raceData.venue_id || venueId;
      if (!resolvedVenueId) {
        throw new Error('Venue is missing. Add a venue to this race to generate distance strategy.');
      }
      logger.debug('[DistanceRacingStrategyCard] Using venue:', resolvedVenueId);

      // Add timeout to prevent infinite loading
      // Pass courseLengthNm to help detect distance race type for skill selection
      const strategyPromise = raceStrategyEngine.generateVenueBasedStrategy(
        resolvedVenueId,
        currentConditions,
        {
          raceName: raceData.name || raceName,
          raceDate: new Date(raceData.start_time || raceDate || new Date()),
          raceTime: new Date(raceData.start_time || raceDate || new Date()).toLocaleTimeString(),
          boatType: 'Keelboat',
          fleetSize: 20,
          importance: 'series',
          racingAreaPolygon,
          // Pass distance race indicators to help skill selection
          courseLengthNm: totalDistanceNm,
          waypoints: routeWaypoints.length,
          // @ts-ignore - raceType not in interface but getSkillForRaceType checks for it
          raceType: 'distance'
        }
      );

      // Add 60 second timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Strategy generation timed out after 60 seconds')), 60000);
      });

      const aiStrategy = await Promise.race([strategyPromise, timeoutPromise]) as Awaited<ReturnType<typeof raceStrategyEngine.generateVenueBasedStrategy>>;

      // Transform AI strategy to distance racing format
      const distanceStrategy: DistanceRacingStrategy = {
        overallApproach: aiStrategy.strategy.overallApproach || 'Optimize VMG and position for weather changes',
        routePlanning: {
          recommendedRoute: routeWaypoints.length > 0 
            ? `Follow waypoints: ${routeWaypoints.map(w => w.name).join(' → ')}`
            : 'Optimize route for favorable current and wind angles',
          keyWaypoints: routeWaypoints.map(w => w.name),
          decisionGates: routeWaypoints.slice(1, -1).map(w => ({
            waypoint: w.name,
            decision: `Assess conditions and route choice at ${w.name}`
          }))
        },
        weatherRouting: {
          strategy: 'Monitor forecast evolution and sail current conditions while positioning for predicted changes',
          forecastConfidence: 'moderate' as const,
          keyChanges: ['Track wind shifts throughout race', 'Position for new wind when confidence is high']
        },
        tideStrategy: {
          approach: 'Time waypoint passages for favorable current',
          criticalTimings: routeWaypoints.length > 0 
            ? routeWaypoints.map(w => `Check tide at ${w.name}`)
            : ['Check tide tables for each leg']
        },
        recommendations: [
          {
            category: 'route_planning',
            title: 'Route Planning',
            content: totalDistanceNm 
              ? `Optimize ${totalDistanceNm}nm course for VMG. Plan each leg carefully.`
              : 'Optimize for VMG and favorable current',
            keyPoints: [
              'Sail the wind, not the forecast',
              'Position for weather changes',
              'Minimize distance while maximizing speed'
            ],
            confidence: 75,
            theory: 'Distance races are won by being closest to finish when conditions change',
            execution: 'Stay closer to rhumb line when forecast confidence is low, position for new wind when confidence is high'
          },
          {
            category: 'weather_routing',
            title: 'Weather Monitoring',
            content: 'Track wind shifts throughout the race. Be prepared to adjust sail trim for changing conditions.',
            keyPoints: [
              'Monitor barometric trends',
              'Watch for cloud formations',
              'Track forecast evolution'
            ],
            confidence: 70
          },
          {
            category: 'tide_strategy',
            title: 'Tide & Current Strategy',
            content: 'Time waypoint passages for favorable current. Check tide tables for each leg.',
            keyPoints: [
              'Plan around tide gates',
              'Use current to your advantage',
              'Avoid fighting strong current'
            ],
            confidence: 80
          }
        ],
        confidence: Math.round(aiStrategy.confidence * 100)
      };

      // Save to database - preserve existing strategy_content to avoid overwriting other cards' data
      const existingData = await loadStrategyContent();

      // Preserve existing data (e.g., tacticalPlan from TacticalPlanCard, startStrategy from StartStrategyCard)
      const strategyContent = existingData?.strategy_content || {};
      (strategyContent as any).distanceRacingStrategy = distanceStrategy;
      (strategyContent as any).fullAIStrategy = aiStrategy; // Save full AI strategy for reference

      await upsertStrategyContent(strategyContent, distanceStrategy.confidence, true);

      setStrategy(distanceStrategy);
      logger.debug('[DistanceRacingStrategyCard] Skill enabled:', raceStrategyEngine.isSkillReady());
      logger.debug('[DistanceRacingStrategyCard] Using distance racing skill for distance race');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('[DistanceRacingStrategyCard] Generate error:', err);
      console.error('[DistanceRacingStrategyCard] Full error details:', err);
      
      // Provide more specific error messages
      let userFriendlyError = 'Failed to generate distance racing strategy';
      if (errorMessage.includes('timeout')) {
        userFriendlyError = 'Strategy generation timed out. Please try again.';
      } else if (errorMessage.includes('API') || errorMessage.includes('400') || errorMessage.includes('401')) {
        userFriendlyError = 'Strategy service temporarily unavailable. Using fallback strategy.';
        // Generate fallback strategy
        generateFallbackStrategy();
        return;
      } else if (errorMessage.includes('credit') || errorMessage.includes('balance')) {
        userFriendlyError = 'Strategy service credits exhausted. Using fallback strategy.';
        generateFallbackStrategy();
        return;
      }
      
      setError(userFriendlyError);
    } finally {
      setLoading(false);
    }
  };

  // Generate a fallback strategy without AI if AI generation fails
  const generateFallbackStrategy = async () => {
    if (!user) return;

    try {
      logger.debug('[DistanceRacingStrategyCard] Generating fallback strategy...');
      
      const fallbackStrategy: DistanceRacingStrategy = {
        overallApproach: 'Optimize VMG and position for weather changes. Sail the wind, not the forecast.',
        routePlanning: {
          recommendedRoute: routeWaypoints.length > 0 
            ? `Follow waypoints: ${routeWaypoints.map(w => w.name).join(' → ')}`
            : 'Optimize route for favorable current and wind angles',
          keyWaypoints: routeWaypoints.map(w => w.name),
          decisionGates: routeWaypoints.slice(1, -1).map(w => ({
            waypoint: w.name,
            decision: `Assess conditions and route choice at ${w.name}`
          }))
        },
        weatherRouting: {
          strategy: 'Monitor forecast evolution and sail current conditions while positioning for predicted changes. Track barometric trends and cloud formations.',
          forecastConfidence: 'moderate' as const,
          keyChanges: [
            'Track wind shifts throughout race',
            'Position for new wind when confidence is high',
            'Stay closer to rhumb line when forecast confidence is low'
          ]
        },
        tideStrategy: {
          approach: 'Time waypoint passages for favorable current. Check tide tables for each leg.',
          criticalTimings: routeWaypoints.length > 0 
            ? routeWaypoints.map(w => `Check tide at ${w.name}`)
            : ['Check tide tables for each leg']
        },
        recommendations: [
          {
            category: 'route_planning',
            title: 'Route Planning',
            content: totalDistanceNm 
              ? `Optimize ${totalDistanceNm}nm course for VMG. Plan each leg carefully.`
              : 'Optimize for VMG and favorable current',
            keyPoints: [
              'Sail the wind, not the forecast',
              'Position for weather changes',
              'Minimize distance while maximizing speed',
              'Distance races are won by being closest to finish when conditions change'
            ],
            confidence: 75,
            theory: 'Distance races are won by being closest to finish when conditions change',
            execution: 'Stay closer to rhumb line when forecast confidence is low, position for new wind when confidence is high'
          },
          {
            category: 'weather_routing',
            title: 'Weather Monitoring',
            content: 'Track wind shifts throughout the race. Be prepared to adjust sail trim for changing conditions.',
            keyPoints: [
              'Monitor barometric trends',
              'Watch for cloud formations',
              'Track forecast evolution',
              'Sail current conditions while preparing for predicted changes'
            ],
            confidence: 70,
            theory: 'Coastal forecasting is difficult - many races lost by boats in perfect position for change that never arrives',
            execution: 'Sail current conditions while preparing for predicted changes'
          },
          {
            category: 'tide_strategy',
            title: 'Tide & Current Strategy',
            content: 'Time waypoint passages for favorable current. Check tide tables for each leg.',
            keyPoints: [
              'Plan around tide gates',
              'Use current to your advantage',
              'Avoid fighting strong current',
              'Time passages for maximum benefit'
            ],
            confidence: 80,
            theory: 'Current can provide significant advantage or disadvantage depending on timing',
            execution: 'Check tide tables before race and plan waypoint passages accordingly'
          }
        ],
        confidence: 75
      };

      // Save fallback strategy to database
      const existingData = await loadStrategyContent();

      const strategyContent = existingData?.strategy_content || {};
      (strategyContent as any).distanceRacingStrategy = fallbackStrategy;
      (strategyContent as any).isFallback = true; // Mark as fallback

      try {
        await upsertStrategyContent(strategyContent, fallbackStrategy.confidence, false);
      } catch (upsertError) {
        logger.error('[DistanceRacingStrategyCard] Failed to save fallback strategy:', upsertError);
      }

      setStrategy(fallbackStrategy);
      setError(null); // Clear error since we have a fallback
      logger.debug('[DistanceRacingStrategyCard] Fallback strategy generated successfully');
    } catch (fallbackErr) {
      logger.error('[DistanceRacingStrategyCard] Failed to generate fallback strategy:', fallbackErr);
      setError('Unable to generate strategy. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Transform AI strategy response to distance racing format
  const transformAIStrategyToDistanceFormat = (aiStrategy: any): DistanceRacingStrategy | null => {
    if (!aiStrategy || !aiStrategy.strategy) return null;

    // Extract relevant information from AI strategy
    const strategy = aiStrategy.strategy;
    
    return {
      overallApproach: strategy.overallApproach || 'Optimize VMG and position for weather changes',
      routePlanning: {
        recommendedRoute: 'Follow optimized route based on conditions',
        keyWaypoints: routeWaypoints.map(w => w.name),
        decisionGates: []
      },
      weatherRouting: {
        strategy: 'Monitor and adapt to weather changes',
        forecastConfidence: 'moderate' as const,
        keyChanges: []
      },
      tideStrategy: {
        approach: 'Time passages for favorable current',
        criticalTimings: []
      },
      recommendations: [],
      confidence: Math.round((aiStrategy.confidence || 0.7) * 100)
    };
  };

  // Auto-save user's strategy on change
  const handleUserStrategyChange = async (text: string) => {
    setUserStrategy(text);
    if (!user?.id) return;

    setSavingUserStrategy(true);
    try {
      // Store user notes in race_strategies.strategy_content.userNotes
      const existingData = await loadStrategyContent();
      const strategyContent = existingData?.strategy_content || {};
      (strategyContent as any).userNotes = text;
      (strategyContent as any).distanceRacingStrategy = strategy; // Preserve strategy

      await upsertStrategyContent(
        strategyContent,
        strategy?.confidence || 0,
        Boolean((strategyContent as any).fullAIStrategy) && !(strategyContent as any).isFallback
      );
    } catch (err) {
      logger.error('[DistanceRacingStrategyCard] Error saving user strategy', err);
    } finally {
      setSavingUserStrategy(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'route_planning': return 'map-marker-path';
      case 'weather_routing': return 'weather-partly-cloudy';
      case 'tide_strategy': return 'waves';
      case 'crew_management': return 'account-group';
      case 'safety': return 'shield-check';
      case 'finishing': return 'flag-checkered';
      default: return 'sail-boat';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'route_planning': return '#3B82F6';
      case 'weather_routing': return '#8B5CF6';
      case 'tide_strategy': return '#10B981';
      case 'crew_management': return '#F59E0B';
      case 'safety': return '#EF4444';
      case 'finishing': return '#EC4899';
      default: return '#64748B';
    }
  };

  const getCardStatus = () => {
    if (loading) return 'generating';
    if (error) return 'error';
    if (!strategy) return 'not_set';
    return 'ready';
  };

  const getStatusMessage = () => {
    if (loading) return 'Generating strategy...';
    if (error) return error;
    if (!strategy) return 'Generate strategy first';
    return `${strategy.recommendations.length} recommendations`;
  };

  const renderStrategyContent = () => {
    // Only show spinner on initial load when we have no data
    if (loading && !strategy) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.loadingText}>Generating distance racing strategy...</Text>
          <Text style={styles.loadingHint}>Using long-distance-racing-analyst skill</Text>
        </View>
      );
    }

    // If we have no data but finished loading, show error/empty state
    if (!strategy) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="sail-boat" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            {error || 'No distance racing strategy available yet'}
          </Text>
          <Text style={styles.emptyHint}>
            {error 
              ? 'Please check your connection and try again, or use the fallback strategy.'
              : 'Generate your tactical plan to see distance racing recommendations'}
          </Text>
          {error && (
            <TouchableOpacity 
              style={[styles.generateButton, styles.fallbackButton]} 
              onPress={generateFallbackStrategy}
            >
              <Text style={styles.generateButtonText}>Use Fallback Strategy</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.generateButton} onPress={generateStrategy}>
            <Text style={styles.generateButtonText}>
              {error ? 'Retry Generation' : 'Generate Strategy'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.strategyContainer}>
        {/* Overall Approach */}
        {strategy.overallApproach && (
          <View style={styles.overallSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="compass-outline" size={18} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Overall Approach</Text>
            </View>
            <Text style={styles.overallText}>{strategy.overallApproach}</Text>
          </View>
        )}

        {/* Route Planning */}
        {strategy.routePlanning && (
          <View style={styles.recommendationCard}>
            <View style={styles.recommendationHeader}>
              <MaterialCommunityIcons name="map-marker-path" size={18} color="#3B82F6" />
              <Text style={styles.recommendationTitle}>Route Planning</Text>
            </View>
            <Text style={styles.recommendationContent}>{strategy.routePlanning.recommendedRoute}</Text>
            {strategy.routePlanning.keyWaypoints.length > 0 && (
              <View style={styles.waypointsList}>
                {strategy.routePlanning.keyWaypoints.map((wp, idx) => (
                  <View key={idx} style={styles.waypointItem}>
                    <MaterialCommunityIcons name="map-marker" size={14} color="#3B82F6" />
                    <Text style={styles.waypointText}>{wp}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Weather Routing */}
        {strategy.weatherRouting && (
          <View style={styles.recommendationCard}>
            <View style={styles.recommendationHeader}>
              <MaterialCommunityIcons name="weather-partly-cloudy" size={18} color="#8B5CF6" />
              <Text style={styles.recommendationTitle}>Weather Routing</Text>
              <View style={[styles.confidenceBadge, { backgroundColor: strategy.weatherRouting.forecastConfidence === 'high' ? '#10B98120' : strategy.weatherRouting.forecastConfidence === 'moderate' ? '#F59E0B20' : '#EF444420' }]}>
                <Text style={[styles.confidenceBadgeText, { color: strategy.weatherRouting.forecastConfidence === 'high' ? '#10B981' : strategy.weatherRouting.forecastConfidence === 'moderate' ? '#F59E0B' : '#EF4444' }]}>
                  {strategy.weatherRouting.forecastConfidence.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.recommendationContent}>{strategy.weatherRouting.strategy}</Text>
          </View>
        )}

        {/* Recommendations */}
        {strategy.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationCard}>
            <View style={styles.recommendationHeader}>
              <MaterialCommunityIcons 
                name={getCategoryIcon(rec.category) as any} 
                size={18} 
                color={getCategoryColor(rec.category)} 
              />
              <Text style={styles.recommendationTitle}>{rec.title}</Text>
            </View>

            {/* Theory (What/Why) */}
            {rec.theory && (
              <View style={styles.theorySection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="lightbulb-on" size={16} color="#F59E0B" />
                  <Text style={styles.sectionLabel}>THEORY (What/Why)</Text>
                </View>
                <Text style={styles.theoryText}>{rec.theory}</Text>
              </View>
            )}

            {/* Execution (How) */}
            {rec.execution && (
              <View style={styles.executionSection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="rocket-launch" size={16} color="#3B82F6" />
                  <Text style={styles.sectionLabel}>EXECUTION (How)</Text>
                </View>
                <Text style={styles.executionText}>{rec.execution}</Text>
              </View>
            )}

            {/* Content (fallback if no theory/execution) */}
            {!rec.theory && !rec.execution && rec.content && (
              <Text style={styles.recommendationContent}>{rec.content}</Text>
            )}

            {/* Key Points */}
            {rec.keyPoints && rec.keyPoints.length > 0 && (
              <View style={styles.keyPointsList}>
                {rec.keyPoints.map((point, idx) => (
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
                      width: `${rec.confidence}%`,
                      backgroundColor: rec.confidence > 70 ? '#10B981' :
                                     rec.confidence > 50 ? '#F59E0B' : '#EF4444'
                    }
                  ]}
                />
              </View>
              <Text style={styles.confidenceText}>{rec.confidence}%</Text>
            </View>
          </View>
        ))}

        {/* User Strategy Input Section */}
        {user?.id && (
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
              placeholder="Add your own strategy notes for distance racing... (e.g., route preferences, weather observations, crew notes)"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <StrategyCard
      icon="navigation"
      title="Distance Racing Strategy"
      status={getCardStatus()}
      statusMessage={getStatusMessage()}
      expandable={false}
    >
      {renderStrategyContent()}
    </StrategyCard>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  loadingHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
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
  generateButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  fallbackButton: {
    backgroundColor: '#10B981',
    marginBottom: 8,
  },
  generateButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  strategyContainer: {
    gap: 16,
  },
  overallSection: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
  },
  overallText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  recommendationCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  recommendationContent: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
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
  waypointsList: {
    marginTop: 8,
    gap: 6,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waypointText: {
    fontSize: 13,
    color: '#64748B',
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
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confidenceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    lineHeight: 20,
  },
});
