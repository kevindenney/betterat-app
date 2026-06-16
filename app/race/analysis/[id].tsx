import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Share2,
  FileText,
  Users,
  ChevronRight,
  Play,
  Pause,
  RotateCw,
  CheckCircle,
  AlertTriangle,
  Trophy,
  Clock,
  Navigation,
  Wind,
  Waves,
  Activity
} from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn, isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';

const logger = createLogger('PostRaceAnalysis');

interface RaceResult {
  id: string;
  race_id: string;
  position: number;
  finish_time: string;
  elapsed_time: number;
  average_speed: number;
  distance_sailed: number;
  tacks_count: number;
  gybes_count: number;
  strategy_execution: number;
  sailing_venue_id?: string;
}

interface GPSTrack {
  id: string;
  race_result_id: string;
  track_data: any;
  created_at: string;
}

interface TacticalDecision {
  timestamp: string;
  action: string;
  ai_recommendation: string;
  outcome: string;
  impact: 'positive' | 'negative' | 'neutral';
  isOptimal: boolean;
}

interface EquipmentSetup {
  mast_rake?: string;
  jib_lead?: string;
  main_trim?: string;
  upwind_speed_delta?: number;
  downwind_speed_delta?: number;
}

interface VenueStats {
  total_races: number;
  avg_position: number;
  best_finish: number;
  worst_finish: number;
  light_air_avg: number;
  medium_air_avg: number;
  heavy_air_avg: number;
}

export default function PostRaceAnalysisScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [gpsTrack, setGPSTrack] = useState<GPSTrack | null>(null);
  const [tacticalDecisions, setTacticalDecisions] = useState<TacticalDecision[]>([]);
  const [equipmentSetup, setEquipmentSetup] = useState<EquipmentSetup | null>(null);
  const [venueStats, setVenueStats] = useState<VenueStats | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const isMountedRef = useRef(true);
  const loadRunIdRef = useRef(0);
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      loadRunIdRef.current += 1;
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
    };
  }, []);

  const loadRaceAnalysisData = useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const canCommit = () => isMountedRef.current && loadRunIdRef.current === runId;

    if (!id) return;

    try {
      if (canCommit()) {
        setLoading(true);
      }

      // Load race result
      const { data: resultData, error: resultError } = await supabase
        .from('race_results')
        .select('*')
        .eq('id', id)
        .single();

      if (resultError) throw resultError;
      if (!canCommit()) return;
      setRaceResult(resultData);

      // Load GPS track if available
      const { data: trackData, error: trackError } = await supabase
        .from('gps_tracks')
        .select('*')
        .eq('race_result_id', id)
        .single();

      if (!trackError && trackData) {
        if (!canCommit()) return;
        setGPSTrack(trackData);
      }

      // Load tactical decisions (from race_strategies table)
      let strategyData: any = null;
      const strategyRegattaId = resultData?.regatta_id || resultData?.race_id;
      if (strategyRegattaId) {
        const primaryStrategy = await supabase
          .from('race_strategies')
          .select('strategy_content')
          .eq('regatta_id', strategyRegattaId)
          .maybeSingle();

        if (!primaryStrategy.error) {
          strategyData = primaryStrategy.data;
        } else if (isMissingIdColumn(primaryStrategy.error, 'race_strategies', 'regatta_id')) {
          // Backward-compat fallback for older schema versions
          const legacyStrategy = await supabase
            .from('race_strategies')
            .select('tactical_recommendations')
            .eq('race_id', strategyRegattaId)
            .maybeSingle();
          strategyData = legacyStrategy.data;
        }
      }

      const tacticalRecommendations =
        strategyData?.tactical_recommendations ||
        strategyData?.strategy_content?.tactical_recommendations ||
        strategyData?.strategy_content?.key_tactical_points;

      if (tacticalRecommendations) {
        if (!canCommit()) return;
        setTacticalDecisions(generateTacticalDecisions(tacticalRecommendations));
      }

      // Load equipment setup
      const { data: equipmentData } = await supabase
        .from('boat_equipment')
        .select('setup_notes')
        .eq('race_result_id', id)
        .single();

      if (equipmentData) {
        if (!canCommit()) return;
        setEquipmentSetup(parseEquipmentSetup(equipmentData.setup_notes));
      }

      // Load venue statistics
      if (resultData.sailing_venue_id) {
        let venueRaces: any[] | null = null;
        const primaryVenue = await supabase
          .from('race_results')
          .select('position, conditions')
          .eq('sailing_venue_id', resultData.sailing_venue_id);
        venueRaces = primaryVenue.data;

        if (isMissingSupabaseColumn(primaryVenue.error, 'race_results.conditions')) {
          const fallbackVenue = await supabase
            .from('race_results')
            .select('position')
            .eq('sailing_venue_id', resultData.sailing_venue_id);
          venueRaces = fallbackVenue.data;
        }

        if (venueRaces) {
          if (!canCommit()) return;
          setVenueStats(calculateVenueStats(venueRaces));
        }
      }

    } catch (error) {
      console.error('Error loading race analysis:', error);
    } finally {
      if (canCommit()) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    void loadRaceAnalysisData();
  }, [loadRaceAnalysisData]);

  const generateTacticalDecisions = (_recommendations: any): TacticalDecision[] => {
    // Mock tactical decisions based on strategy recommendations
    return [
      {
        timestamp: '13:00:00',
        action: 'Pin-end start',
        ai_recommendation: 'Pin end favored by 8°',
        outcome: 'Gained 3 boat lengths at start',
        impact: 'positive',
        isOptimal: true
      },
      {
        timestamp: '13:05:30',
        action: 'Tacked to port',
        ai_recommendation: 'Stay on starboard for lift',
        outcome: 'Lost 2 positions',
        impact: 'negative',
        isOptimal: false
      },
      {
        timestamp: '13:18:00',
        action: 'Right gate mark',
        ai_recommendation: 'Right gate for current advantage',
        outcome: 'Better angle upwind',
        impact: 'positive',
        isOptimal: true
      }
    ];
  };

  const parseEquipmentSetup = (_setupNotes: string): EquipmentSetup => {
    // Parse equipment setup from notes
    return {
      mast_rake: '4.5"',
      jib_lead: 'Hole 8',
      main_trim: 'Medium',
      upwind_speed_delta: 0.2,
      downwind_speed_delta: -0.1
    };
  };

  const calculateVenueStats = (races: any[]): VenueStats => {
    const positions = races.map(r => r.position);
    const lightAirRaces = races.filter(r => r.conditions?.includes('light'));
    const mediumAirRaces = races.filter(r => r.conditions?.includes('medium'));
    const heavyAirRaces = races.filter(r => r.conditions?.includes('heavy'));

    return {
      total_races: races.length,
      avg_position: positions.reduce((a, b) => a + b, 0) / positions.length,
      best_finish: Math.min(...positions),
      worst_finish: Math.max(...positions),
      light_air_avg: lightAirRaces.length > 0 ? lightAirRaces.reduce((a, b) => a + b.position, 0) / lightAirRaces.length : 0,
      medium_air_avg: mediumAirRaces.length > 0 ? mediumAirRaces.reduce((a, b) => a + b.position, 0) / mediumAirRaces.length : 0,
      heavy_air_avg: heavyAirRaces.length > 0 ? heavyAirRaces.reduce((a, b) => a + b.position, 0) / heavyAirRaces.length : 0
    };
  };

  const toggleReplay = useCallback(() => {
    if (isReplaying) {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
      setIsReplaying(false);
      return;
    }

    // Start replay animation
    setIsReplaying(true);
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
    }
    replayIntervalRef.current = setInterval(() => {
      setReplayProgress(prev => {
        if (prev >= 100) {
          if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current);
            replayIntervalRef.current = null;
          }
          setIsReplaying(false);
          return 0;
        }
        return prev + (1 * replaySpeed);
      });
    }, 100);
  }, [isReplaying, replaySpeed]);

  const resetReplay = useCallback(() => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setReplayProgress(0);
    setIsReplaying(false);
  }, []);

  const shareAnalysis = async () => {
    if (!raceResult) return;
    try {
      const summary = [
        `Race Analysis #${id}`,
        `Position: ${raceResult.position}`,
        `Elapsed: ${Math.floor(raceResult.elapsed_time / 60)}m`,
        `Average Speed: ${raceResult.average_speed.toFixed(1)}kt`,
        `Distance: ${raceResult.distance_sailed.toFixed(1)} NM`,
        `Tacks/Gybes: ${raceResult.tacks_count}/${raceResult.gybes_count}`,
        `Strategy Execution: ${raceResult.strategy_execution}%`,
      ].join('\n');

      await Share.share({
        message: summary,
        title: `Race Analysis #${id}`,
      });
    } catch (error) {
      logger.error('Failed to share analysis', error);
    }
  };

  const saveToNotes = async () => {
    if (!raceResult) return;
    try {
      const note = [
        `Post-race summary (${new Date().toLocaleDateString()})`,
        `Position ${raceResult.position}, strategy ${raceResult.strategy_execution}%`,
        `Speed ${raceResult.average_speed.toFixed(1)}kt over ${raceResult.distance_sailed.toFixed(1)}nm`,
        `Maneuvers: ${raceResult.tacks_count} tacks, ${raceResult.gybes_count} gybes`,
      ].join(' • ');

      const raceTargetId = raceResult.race_id;
      if (!raceTargetId) {
        throw new Error('Race reference missing');
      }

      const { error } = await supabase
        .from('regattas')
        .update({
          post_race_notes: note,
          updated_at: new Date().toISOString(),
        })
        .eq('id', raceTargetId);

      if (error) {
        throw error;
      }

      logger.debug('Saved analysis summary to regatta notes', { raceTargetId });
    } catch (error) {
      logger.error('Failed to save analysis notes', error);
    }
  };

  const compareToFleet = () => {
    if (raceResult?.race_id) {
      router.push(`/club/results/${raceResult.race_id}` as any);
      return;
    }
    router.push('/(tabs)/events');
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-gray-600 mt-4">Loading race analysis...</Text>
      </View>
    );
  }

  if (!raceResult) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-6">
        <AlertTriangle color="#F59E0B" size={48} />
        <Text className="text-xl font-bold mt-4">Race Not Found</Text>
        <Text className="text-gray-600 text-center mt-2">
          Unable to load race analysis data
        </Text>
        <TouchableOpacity
          className="bg-blue-600 px-6 py-3 rounded-lg mt-6"
          onPress={() => router.back()}
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-6 px-4">
        <Text className="text-white text-2xl font-bold">Post-Race Analysis</Text>
        <Text className="text-blue-200 mt-1">Race #{id}</Text>
      </View>

      {/* 1. RACE SUMMARY CARD */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <View className="items-center">
            <Trophy color="#007AFF" size={32} />
            <Text className="text-3xl font-bold mt-2">{raceResult.position}</Text>
            <Text className="text-gray-600 text-sm">Position</Text>
          </View>
          <View className="items-center">
            <Clock color="#10B981" size={32} />
            <Text className="text-xl font-bold mt-2">{Math.floor(raceResult.elapsed_time / 60)}m</Text>
            <Text className="text-gray-600 text-sm">Elapsed</Text>
          </View>
          <View className="items-center">
            <Navigation color="#F59E0B" size={32} />
            <Text className="text-xl font-bold mt-2">{raceResult.average_speed.toFixed(1)}kt</Text>
            <Text className="text-gray-600 text-sm">Avg Speed</Text>
          </View>
          <View className="items-center">
            <Activity color="#8B5CF6" size={32} />
            <Text className="text-xl font-bold mt-2">{raceResult.strategy_execution}%</Text>
            <Text className="text-gray-600 text-sm">Strategy</Text>
          </View>
        </View>

        <View className="pt-4 border-t border-gray-200">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Distance Sailed</Text>
            <Text className="font-bold">{raceResult.distance_sailed.toFixed(1)} NM</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-600">Tacks / Gybes</Text>
            <Text className="font-bold">{raceResult.tacks_count} / {raceResult.gybes_count}</Text>
          </View>
        </View>
      </View>

      {/* 2. GPS TRACK REPLAY */}
      {gpsTrack && (
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
          <Text className="text-lg font-bold mb-3">GPS Track Replay</Text>

          {/* Track visualization placeholder */}
          <View className="bg-gray-100 h-64 rounded-lg mb-4 items-center justify-center">
            <Text className="text-gray-500">Track visualization</Text>
            <Text className="text-gray-400 text-sm mt-1">Speed colorized: Red (slow) → Green (fast)</Text>
          </View>

          {/* Replay controls */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <TouchableOpacity
                className="bg-blue-600 p-3 rounded-full"
                onPress={toggleReplay}
              >
                {isReplaying ? (
                  <Pause color="white" size={20} />
                ) : (
                  <Play color="white" size={20} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-gray-200 p-3 rounded-full"
                onPress={resetReplay}
              >
                <RotateCw color="#374151" size={20} />
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center space-x-2">
              <Text className="text-gray-600 text-sm">Speed:</Text>
              {[1, 2, 4].map(speed => (
                <TouchableOpacity
                  key={speed}
                  className={`px-3 py-1 rounded ${replaySpeed === speed ? 'bg-blue-600' : 'bg-gray-200'}`}
                  onPress={() => setReplaySpeed(speed)}
                >
                  <Text className={`font-bold ${replaySpeed === speed ? 'text-white' : 'text-gray-700'}`}>
                    {speed}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Progress bar */}
          <View className="mt-4">
            <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
              <View
                className="bg-blue-600 h-full"
                style={{ width: `${replayProgress}%` }}
              />
            </View>
          </View>
        </View>
      )}

      {/* 3. TACTICAL DECISION ANALYSIS */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
        <Text className="text-lg font-bold mb-3">Tactical Decisions</Text>

        {tacticalDecisions.map((decision, index) => (
          <View key={index} className="mb-4 pb-4 border-b border-gray-200 last:border-b-0">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-bold">{decision.action}</Text>
              <View className="flex-row items-center">
                <Text className="text-gray-500 text-sm mr-2">{decision.timestamp}</Text>
                {decision.isOptimal ? (
                  <CheckCircle color="#10B981" size={16} />
                ) : (
                  <AlertTriangle color="#F59E0B" size={16} />
                )}
              </View>
            </View>

            <View className="bg-blue-50 p-2 rounded mb-1">
              <Text className="text-blue-800 text-sm">
                <Text className="font-bold">AI: </Text>
                {decision.ai_recommendation}
              </Text>
            </View>

            <View className={`p-2 rounded ${
              decision.impact === 'positive' ? 'bg-green-50' :
              decision.impact === 'negative' ? 'bg-red-50' : 'bg-gray-50'
            }`}>
              <Text className={`text-sm ${
                decision.impact === 'positive' ? 'text-green-800' :
                decision.impact === 'negative' ? 'text-red-800' : 'text-gray-800'
              }`}>
                <Text className="font-bold">Outcome: </Text>
                {decision.outcome}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* 4. EQUIPMENT CORRELATION */}
      {equipmentSetup && (
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
          <Text className="text-lg font-bold mb-3">Equipment Performance</Text>

          <View className="bg-gray-50 p-3 rounded-lg mb-3">
            <Text className="font-bold mb-2">Today's Setup</Text>
            <View className="space-y-1">
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Mast Rake</Text>
                <Text className="font-medium">{equipmentSetup.mast_rake}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Jib Lead</Text>
                <Text className="font-medium">{equipmentSetup.jib_lead}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Main Trim</Text>
                <Text className="font-medium">{equipmentSetup.main_trim}</Text>
              </View>
            </View>
          </View>

          <View className="space-y-2">
            <View className={`flex-row items-center justify-between p-3 rounded-lg ${
              equipmentSetup.upwind_speed_delta && equipmentSetup.upwind_speed_delta > 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <View className="flex-row items-center">
                <Wind color={equipmentSetup.upwind_speed_delta && equipmentSetup.upwind_speed_delta > 0 ? '#10B981' : '#EF4444'} size={20} />
                <Text className="ml-2 font-medium">Upwind</Text>
              </View>
              <View className="flex-row items-center">
                <Text className={`font-bold ${
                  equipmentSetup.upwind_speed_delta && equipmentSetup.upwind_speed_delta > 0 ? 'text-green-800' : 'text-red-800'
                }`}>
                  {equipmentSetup.upwind_speed_delta && equipmentSetup.upwind_speed_delta > 0 ? '+' : ''}
                  {equipmentSetup.upwind_speed_delta?.toFixed(1)}kt vs fleet
                </Text>
                {equipmentSetup.upwind_speed_delta && equipmentSetup.upwind_speed_delta > 0 ? (
                  <CheckCircle color="#10B981" size={16} className="ml-2" />
                ) : (
                  <AlertTriangle color="#EF4444" size={16} className="ml-2" />
                )}
              </View>
            </View>

            <View className={`flex-row items-center justify-between p-3 rounded-lg ${
              equipmentSetup.downwind_speed_delta && equipmentSetup.downwind_speed_delta > 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <View className="flex-row items-center">
                <Waves color={equipmentSetup.downwind_speed_delta && equipmentSetup.downwind_speed_delta > 0 ? '#10B981' : '#EF4444'} size={20} />
                <Text className="ml-2 font-medium">Downwind</Text>
              </View>
              <View className="flex-row items-center">
                <Text className={`font-bold ${
                  equipmentSetup.downwind_speed_delta && equipmentSetup.downwind_speed_delta > 0 ? 'text-green-800' : 'text-red-800'
                }`}>
                  {equipmentSetup.downwind_speed_delta && equipmentSetup.downwind_speed_delta > 0 ? '+' : ''}
                  {equipmentSetup.downwind_speed_delta?.toFixed(1)}kt vs fleet
                </Text>
                {equipmentSetup.downwind_speed_delta && equipmentSetup.downwind_speed_delta > 0 ? (
                  <CheckCircle color="#10B981" size={16} className="ml-2" />
                ) : (
                  <AlertTriangle color="#EF4444" size={16} className="ml-2" />
                )}
              </View>
            </View>
          </View>

          <View className="mt-3 bg-blue-50 p-3 rounded-lg">
            <Text className="text-blue-800 font-bold mb-1">AI Recommendations for Next Race</Text>
            <Text className="text-blue-700 text-sm">
              • Increase jib lead by 1 hole for better pointing in similar conditions
              • Current setup optimal for upwind performance
            </Text>
          </View>
        </View>
      )}

      {/* 5. VENUE PERFORMANCE TRACKING */}
      {venueStats && (
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
          <Text className="text-lg font-bold mb-3">Performance at This Venue</Text>

          <View className="flex-row justify-between mb-4">
            <View className="items-center">
              <Text className="text-2xl font-bold">{venueStats.total_races}</Text>
              <Text className="text-gray-600 text-sm">Total Races</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold">{venueStats.avg_position.toFixed(1)}</Text>
              <Text className="text-gray-600 text-sm">Avg Position</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">{venueStats.best_finish}</Text>
              <Text className="text-gray-600 text-sm">Best</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-red-600">{venueStats.worst_finish}</Text>
              <Text className="text-gray-600 text-sm">Worst</Text>
            </View>
          </View>

          <View className="space-y-2">
            <View className="flex-row items-center justify-between p-2 bg-gray-50 rounded">
              <Text className="text-gray-700">Light Air (0-10kt)</Text>
              <Text className="font-bold">{venueStats.light_air_avg.toFixed(1)} avg</Text>
            </View>
            <View className="flex-row items-center justify-between p-2 bg-gray-50 rounded">
              <Text className="text-gray-700">Medium Air (10-15kt)</Text>
              <Text className="font-bold">{venueStats.medium_air_avg.toFixed(1)} avg</Text>
            </View>
            <View className="flex-row items-center justify-between p-2 bg-gray-50 rounded">
              <Text className="text-gray-700">Heavy Air (15kt+)</Text>
              <Text className="font-bold">{venueStats.heavy_air_avg.toFixed(1)} avg</Text>
            </View>
          </View>

          {/* Improvement trend chart */}
          <View className="mt-4">
            <Text className="font-bold mb-2">Improvement Trend</Text>
            <LineChart
              data={{
                labels: ['Race 1', 'Race 2', 'Race 3', 'Race 4', 'Today'],
                datasets: [{
                  data: [8, 6, 5, 4, raceResult.position]
                }]
              }}
              width={screenWidth - 64}
              height={180}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: '#2563EB'
                }
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
            />
          </View>
        </View>
      )}

      {/* ACTIONS */}
      <View className="mx-4 mt-4 mb-6 space-y-3">
        <TouchableOpacity
          className="bg-blue-600 p-4 rounded-xl flex-row items-center justify-between"
          onPress={shareAnalysis}
        >
          <View className="flex-row items-center">
            <Share2 color="white" size={20} />
            <Text className="text-white font-bold ml-3">Share Analysis</Text>
          </View>
          <ChevronRight color="white" size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-purple-600 p-4 rounded-xl flex-row items-center justify-between"
          onPress={saveToNotes}
        >
          <View className="flex-row items-center">
            <FileText color="white" size={20} />
            <Text className="text-white font-bold ml-3">Save to Notes</Text>
          </View>
          <ChevronRight color="white" size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-green-600 p-4 rounded-xl flex-row items-center justify-between"
          onPress={compareToFleet}
        >
          <View className="flex-row items-center">
            <Users color="white" size={20} />
            <Text className="text-white font-bold ml-3">Compare to Fleet</Text>
          </View>
          <ChevronRight color="white" size={20} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
