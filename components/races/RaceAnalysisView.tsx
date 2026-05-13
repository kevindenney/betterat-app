/**
 * RaceAnalysisView Component
 * Displays AI-generated race analysis and coaching insights
 * Shows detailed breakdown of start, upwind, downwind, tactics, and recommendations
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import {
  TrendingUp,
  Flag,
  Wind,
  Waves,
  Target,
  Lightbulb,
  Clock,
  Award,
  RefreshCw,
  GitCompare,
} from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import { RaceAnalysisService } from '@/services/RaceAnalysisService';
import { createLogger } from '@/lib/utils/logger';

interface RaceAnalysisViewProps {
  sessionId: string;
  raceName?: string;
}

interface AICoachAnalysis {
  id: string;
  overall_summary: string;
  start_analysis: string;
  upwind_analysis: string;
  downwind_analysis: string;
  tactical_decisions: string;
  boat_handling: string;
  recommendations: string[];
  plan_vs_execution: string | null;
  confidence_score: number;
  created_at: string;
}

const logger = createLogger('RaceAnalysisView');
export function RaceAnalysisView({ sessionId, raceName }: RaceAnalysisViewProps) {
  const [analysis, setAnalysis] = useState<AICoachAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const loadAnalysis = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('ai_coach_analysis')
        .select('*')
        .eq('timer_session_id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setAnalysis(data);
      } else {
        // No analysis yet - might still be processing
        logger.debug('No analysis found for session:', sessionId);
      }
    } catch (error: any) {
      logger.error('Error loading analysis', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    showConfirm(
      'Regenerate Analysis',
      'This will create a new analysis. Continue?',
      async () => {
        try {
          setRegenerating(true);

          if (analysis) {
            const deleted = await RaceAnalysisService.deleteAnalysis(sessionId);
            if (!deleted) {
              showAlert('Error', 'Failed to clear previous analysis.');
              setRegenerating(false);
              return;
            }
          }

          const result = await RaceAnalysisService.analyzeRaceSession(sessionId, { force: true });

          if (result) {
            showAlert('Success', 'New analysis generated!');
            loadAnalysis();
          } else {
            showAlert('Error', 'Failed to generate analysis');
          }
        } catch (error: any) {
          logger.error('Error regenerating analysis', error);
          showAlert('Error', error?.message || 'Failed to regenerate analysis');
        } finally {
          setRegenerating(false);
        }
      },
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="text-gray-600 mt-4">Loading analysis...</Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Target size={48} color="#9ca3af" />
        <Text className="text-gray-600 text-lg font-semibold mt-4">
          No Analysis Available
        </Text>
        <Text className="text-gray-500 text-center mt-2 mb-6">
          Analysis hasn't been generated for this race yet.
        </Text>

        <TouchableOpacity
          onPress={async () => {
            try {
              setRegenerating(true);
              const result = await RaceAnalysisService.analyzeRaceSession(sessionId);

              if (result) {
                showAlert('Success', 'Race analysis generated successfully!');
                loadAnalysis();
              } else {
                showAlert('Error', 'Failed to generate analysis');
              }
            } catch (error: any) {
              logger.error('Error generating analysis', error);
              showAlert('Error', error?.message || 'Failed to generate analysis. Please try again.');
            } finally {
              setRegenerating(false);
            }
          }}
          disabled={regenerating}
          className="bg-sky-600 rounded-lg px-6 py-3 mb-3 flex-row items-center"
        >
          {regenerating ? (
            <>
              <ActivityIndicator size="small" color="white" />
              <Text className="text-white font-semibold ml-2">Generating...</Text>
            </>
          ) : (
            <Text className="text-white font-semibold">Generate Analysis</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={loadAnalysis}
          disabled={regenerating}
          className="border border-sky-600 rounded-lg px-6 py-3"
        >
          <Text className="text-sky-600 font-semibold">Check Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const confidencePercent = Math.round((analysis.confidence_score || 0) * 100);

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-sky-600 pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text className="text-white text-2xl font-bold">Race Analysis</Text>
            {raceName && (
              <Text className="text-white/90 text-sm mt-1">{raceName}</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleRegenerate}
            disabled={regenerating}
            className="bg-white/20 rounded-full p-2"
          >
            {regenerating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <RefreshCw size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {/* Confidence Score */}
        <View className="flex-row items-center mt-2">
          <Award size={16} color="white" />
          <Text className="text-white/90 text-sm ml-2">
            Confidence: {confidencePercent}%
          </Text>
        </View>

        {/* Analysis Date */}
        <View className="flex-row items-center mt-1">
          <Clock size={16} color="white" />
          <Text className="text-white/80 text-xs ml-2">
            {new Date(analysis.created_at).toLocaleDateString()} at{' '}
            {new Date(analysis.created_at).toLocaleTimeString()}
          </Text>
        </View>
      </View>

      <View className="p-4">
        {/* Overall Summary */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <View className="flex-row items-center mb-3">
            <TrendingUp size={24} color="#0284c7" />
            <Text className="text-lg font-bold text-gray-900 ml-2">
              Overall Performance
            </Text>
          </View>
          <Text className="text-gray-700 leading-6">{analysis.overall_summary}</Text>
        </View>

        {/* Start Analysis */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <View className="flex-row items-center mb-3">
            <Flag size={24} color="#10b981" />
            <Text className="text-lg font-bold text-gray-900 ml-2">Start</Text>
          </View>
          <Text className="text-gray-700 leading-6">{analysis.start_analysis}</Text>
        </View>

        {/* Upwind Analysis */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <View className="flex-row items-center mb-3">
            <Wind size={24} color="#3b82f6" />
            <Text className="text-lg font-bold text-gray-900 ml-2">Upwind</Text>
          </View>
          <Text className="text-gray-700 leading-6">{analysis.upwind_analysis}</Text>
        </View>

        {/* Downwind Analysis */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <View className="flex-row items-center mb-3">
            <Waves size={24} color="#0ea5e9" />
            <Text className="text-lg font-bold text-gray-900 ml-2">Downwind</Text>
          </View>
          <Text className="text-gray-700 leading-6">{analysis.downwind_analysis}</Text>
        </View>

        {/* Tactical Decisions */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <View className="flex-row items-center mb-3">
            <Target size={24} color="#8b5cf6" />
            <Text className="text-lg font-bold text-gray-900 ml-2">
              Tactical Decisions
            </Text>
          </View>
          <Text className="text-gray-700 leading-6">{analysis.tactical_decisions}</Text>
        </View>

        {/* Boat Handling */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <View className="flex-row items-center mb-3">
            <TrendingUp size={24} color="#f59e0b" />
            <Text className="text-lg font-bold text-gray-900 ml-2">
              Boat Handling
            </Text>
          </View>
          <Text className="text-gray-700 leading-6">{analysis.boat_handling}</Text>
        </View>

        {/* Plan vs Execution */}
        {analysis.plan_vs_execution && (
          <View className="bg-indigo-50 rounded-lg p-4 mb-4 border-2 border-indigo-200">
            <View className="flex-row items-center mb-3">
              <GitCompare size={24} color="#6366f1" />
              <Text className="text-lg font-bold text-indigo-900 ml-2">
                Plan vs Execution
              </Text>
            </View>
            <Text className="text-indigo-900 leading-6">{analysis.plan_vs_execution}</Text>
          </View>
        )}

        {/* Recommendations */}
        {analysis.recommendations && analysis.recommendations.length > 0 && (
          <View className="bg-amber-50 rounded-lg p-4 mb-4 border-2 border-amber-200">
            <View className="flex-row items-center mb-3">
              <Lightbulb size={24} color="#f59e0b" />
              <Text className="text-lg font-bold text-amber-900 ml-2">
                Key Recommendations
              </Text>
            </View>
            {analysis.recommendations.map((rec, index) => (
              <View key={index} className="flex-row mb-2">
                <Text className="text-amber-600 font-bold mr-2">•</Text>
                <Text className="text-amber-900 flex-1 leading-6">{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer Note */}
        <Text className="text-gray-500 text-xs text-center mb-4">
          🤖 Generated by Claude AI • Tap refresh to regenerate
        </Text>
      </View>
    </ScrollView>
  );
}
