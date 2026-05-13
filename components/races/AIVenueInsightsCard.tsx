/**
 * AI Venue Insights Card
 *
 * Displays AI-generated venue intelligence including safety recommendations,
 * racing tips, and cultural notes.
 */

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Navigation, X, AlertTriangle, TrendingUp, Users, ChevronRight } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { Button, ButtonText, ButtonIcon } from '@/components/ui/button';
import { AccessibleTouchTarget } from '@/components/ui/AccessibleTouchTarget';

export interface VenueInsights {
  venueName: string;
  generatedAt?: string;
  recommendations?: {
    safety?: string;
    racing?: string;
    cultural?: string;
  };
}

export interface AIVenueInsightsCardProps {
  /** Venue insights data */
  venueInsights: VenueInsights;
  /** Whether insights are currently loading */
  loadingInsights: boolean;
  /** Callback when the card is dismissed */
  onDismiss: () => void;
  /** Callback to view full venue intelligence */
  onViewFullIntelligence: () => void;
  /** Callback to refresh/regenerate insights */
  onRefreshInsights: () => void;
}

/**
 * AI Venue Insights Card Component
 */
export function AIVenueInsightsCard({
  venueInsights,
  loadingInsights,
  onDismiss,
  onViewFullIntelligence,
  onRefreshInsights,
}: AIVenueInsightsCardProps) {
  return (
    <Card className="mb-4 p-4 border-2 border-purple-500" variant="elevated">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center">
          <Navigation color="#8B5CF6" size={20} />
          <Text className="text-lg font-bold ml-2">Venue Intelligence</Text>
        </View>
        <AccessibleTouchTarget
          onPress={onDismiss}
          accessibilityLabel="Dismiss venue intelligence"
          accessibilityHint="Hide this card"
        >
          <X color="#6B7280" size={20} />
        </AccessibleTouchTarget>
      </View>

      <Text className="font-bold text-purple-700 mb-1">{venueInsights.venueName}</Text>
      {venueInsights.generatedAt && (
        <Text className="text-xs text-gray-500 mb-2">
          Generated {new Date(venueInsights.generatedAt).toLocaleDateString()} at{' '}
          {new Date(venueInsights.generatedAt).toLocaleTimeString()}
        </Text>
      )}

      {/* Safety Recommendations */}
      {venueInsights.recommendations?.safety && (
        <View className="mb-3">
          <View className="flex-row items-center mb-1">
            <AlertTriangle color="#EF4444" size={16} />
            <Text className="font-bold text-red-600 ml-1">Safety</Text>
          </View>
          <Text className="text-sm text-gray-700 ml-5">
            {venueInsights.recommendations.safety.split('\n')[0]}
          </Text>
        </View>
      )}

      {/* Racing Tips */}
      {venueInsights.recommendations?.racing && (
        <View className="mb-3">
          <View className="flex-row items-center mb-1">
            <TrendingUp color="#10B981" size={16} />
            <Text className="font-bold text-green-600 ml-1">Racing Tips</Text>
          </View>
          <Text className="text-sm text-gray-700 ml-5">
            {venueInsights.recommendations.racing.split('\n')[0]}
          </Text>
        </View>
      )}

      {/* Cultural Notes */}
      {venueInsights.recommendations?.cultural && (
        <View className="mb-3">
          <View className="flex-row items-center mb-1">
            <Users color="#3B82F6" size={16} />
            <Text className="font-bold text-blue-600 ml-1">Cultural</Text>
          </View>
          <Text className="text-sm text-gray-700 ml-5">
            {venueInsights.recommendations.cultural.split('\n')[0]}
          </Text>
        </View>
      )}

      <View className="flex-row gap-2 mt-2">
        <Button
          action="secondary"
          variant="outline"
          size="sm"
          className="flex-1"
          onPress={onViewFullIntelligence}
        >
          <ButtonText>View Full Intelligence</ButtonText>
          <ButtonIcon as={ChevronRight} />
        </Button>
        <Button
          action="primary"
          variant="outline"
          size="sm"
          onPress={onRefreshInsights}
          disabled={loadingInsights}
        >
          {loadingInsights ? (
            <ActivityIndicator size="small" color="#8B5CF6" />
          ) : (
            <ButtonText>🔄</ButtonText>
          )}
        </Button>
      </View>
    </Card>
  );
}

export default AIVenueInsightsCard;
