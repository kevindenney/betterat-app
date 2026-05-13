/**
 * Race Analysis Card
 * Displays AI-generated race analysis with loading states
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Sparkles, TrendingUp, ChevronRight, AlertCircle, RefreshCw, Clock } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonText, ButtonIcon } from '@/components/ui/button';
import { useRaceAnalysis, useTriggerRaceAnalysis } from '@/hooks/useData';

interface AICoachCardProps {
  timerSessionId: string;
  raceName?: string;
  position?: number;
  onViewDetails?: () => void;
  autoTrigger?: boolean; // Auto-trigger analysis if not exists
}

export function AICoachCard({
  timerSessionId,
  raceName = 'Race',
  position: _position,
  onViewDetails,
  autoTrigger = false,
}: AICoachCardProps) {
  const { data: analysis, loading, error, refetch } = useRaceAnalysis(timerSessionId);
  const { mutate: triggerAnalysis, loading: triggering } = useTriggerRaceAnalysis();
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Auto-trigger analysis if enabled and no analysis exists
  useEffect(() => {
    if (autoTrigger && !analysis && !loading && !triggering && !autoTriggered && timerSessionId) {
      setAutoTriggered(true);
      triggerAnalysis(timerSessionId);
    }
  }, [autoTrigger, analysis, loading, triggering, autoTriggered, timerSessionId, triggerAnalysis]);

  const handleTriggerAnalysis = async () => {
    await triggerAnalysis(timerSessionId);
    await refetch();
  };

  const handleRefreshAnalysis = async () => {
    await triggerAnalysis(timerSessionId);
    await refetch();
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Loading state
  if (loading || triggering) {
    return (
      <Card className="mb-4 p-4" variant="elevated">
        <View className="flex-row items-center mb-3">
          <View className="bg-purple-100 p-2 rounded-full mr-3">
            <Sparkles color="#9333EA" size={20} />
          </View>
          <Text className="text-lg font-bold text-typography-900">Race Analysis</Text>
        </View>
        <View className="items-center py-6">
          <ActivityIndicator size="large" color="#9333EA" />
          <Text className="text-typography-500 mt-3 text-center">
            {triggering ? 'Analyzing your race performance...' : 'Loading analysis...'}
          </Text>
        </View>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="mb-4 p-4" variant="elevated">
        <View className="flex-row items-center mb-3">
          <View className="bg-red-100 p-2 rounded-full mr-3">
            <AlertCircle color="#EF4444" size={20} />
          </View>
          <Text className="text-lg font-bold text-typography-900">Race Analysis</Text>
        </View>
        <Text className="text-typography-500 mb-3">Unable to load analysis</Text>
        <Button action="primary" variant="outline" size="sm" onPress={handleTriggerAnalysis}>
          <ButtonText>Retry Analysis</ButtonText>
        </Button>
      </Card>
    );
  }

  // No analysis yet
  if (!analysis) {
    return (
      <Card className="mb-4 p-4" variant="elevated">
        <View className="flex-row items-center mb-3">
          <View className="bg-purple-100 p-2 rounded-full mr-3">
            <Sparkles color="#9333EA" size={20} />
          </View>
          <Text className="text-lg font-bold text-typography-900">Race Analysis</Text>
        </View>
        <Text className="text-typography-500 mb-3">
          Get personalized insights on your race performance
        </Text>
        <Button
          action="primary"
          variant="solid"
          size="md"
          onPress={handleTriggerAnalysis}
          className="bg-purple-600"
        >
          <ButtonIcon as={Sparkles} />
          <ButtonText>Generate Analysis</ButtonText>
        </Button>
      </Card>
    );
  }

  // Display analysis summary
  const topRecommendation = analysis.recommendations?.[0] || 'No recommendations';
  const confidencePercent = Math.round((analysis.confidence_score || 0) * 100);
  const analysisAge = analysis.created_at ? formatTimestamp(analysis.created_at) : '';

  return (
    <Card className="mb-4 p-4" variant="elevated">
      <TouchableOpacity onPress={onViewDetails}>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View className="bg-purple-100 p-2 rounded-full mr-3">
              <Sparkles color="#9333EA" size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-typography-900">Race Analysis</Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-typography-500 text-sm">{raceName}</Text>
                {analysisAge && (
                  <>
                    <Text className="text-typography-400 text-sm mx-1">•</Text>
                    <Clock color="#9CA3AF" size={12} />
                    <Text className="text-typography-400 text-xs ml-1">{analysisAge}</Text>
                  </>
                )}
              </View>
            </View>
          </View>
          <ChevronRight color="#6B7280" size={20} />
        </View>

        {/* Confidence Badge */}
        <Badge
          action={confidencePercent >= 70 ? 'success' : confidencePercent >= 50 ? 'warning' : 'muted'}
          variant="solid"
          className="mb-3 self-start"
        >
          <BadgeText className="text-xs">
            {confidencePercent}% Confidence
          </BadgeText>
        </Badge>

        {/* Performance Summary */}
        {analysis.overall_summary && (
          <View className="bg-purple-50 p-3 rounded-lg mb-3">
            <Text className="text-typography-700 text-sm" numberOfLines={3}>
              {analysis.overall_summary}
            </Text>
          </View>
        )}

        {/* Top Recommendation */}
        <View className="flex-row items-start mb-3">
          <TrendingUp color="#9333EA" size={16} className="mr-2 mt-1" />
          <View className="flex-1">
            <Text className="text-typography-500 text-xs font-semibold mb-1">
              TOP RECOMMENDATION
            </Text>
            <Text className="text-typography-900 text-sm">{topRecommendation}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row items-center justify-between">
          <Button action="primary" variant="link" size="sm" onPress={onViewDetails}>
            <ButtonText>View Full Analysis →</ButtonText>
          </Button>

          <TouchableOpacity
            onPress={handleRefreshAnalysis}
            className="flex-row items-center px-3 py-1.5 bg-gray-100 rounded-full"
          >
            <RefreshCw color="#6B7280" size={14} />
            <Text className="text-gray-600 text-xs ml-1">Refresh</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Card>
  );
}

/**
 * Compact version for dashboard
 */
export function AICoachSummary({
  timerSessionId,
  onViewDetails,
}: {
  timerSessionId: string;
  onViewDetails?: () => void;
}) {
  const { data: analysis, loading } = useRaceAnalysis(timerSessionId);
  const { mutate: triggerAnalysis, loading: triggering } = useTriggerRaceAnalysis();

  if (loading || triggering) {
    return (
      <View className="flex-row items-center py-2">
        <ActivityIndicator size="small" color="#9333EA" />
        <Text className="text-typography-500 text-sm ml-2">
          {triggering ? 'Generating insights...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <TouchableOpacity
        className="flex-row items-center py-2"
        onPress={() => triggerAnalysis(timerSessionId)}
      >
        <Sparkles color="#9333EA" size={16} />
        <Text className="text-purple-600 text-sm ml-2">Generate Insights</Text>
      </TouchableOpacity>
    );
  }

  const topRecommendation = analysis.recommendations?.[0] || 'View analysis';

  return (
    <TouchableOpacity className="py-2" onPress={onViewDetails}>
      <View className="flex-row items-center mb-1">
        <Sparkles color="#9333EA" size={14} />
        <Text className="text-typography-500 text-xs font-semibold ml-1">ANALYSIS</Text>
      </View>
      <Text className="text-typography-700 text-sm" numberOfLines={2}>
        {topRecommendation}
      </Text>
    </TouchableOpacity>
  );
}
