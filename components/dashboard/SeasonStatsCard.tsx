import { Card } from '@/components/ui/card';
import { ChevronRight, Flag, MapPin, TrendingUp, Trophy } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface SeasonStatsCardProps {
  races: number;
  venues: number;
  avgPosition: number | null;
  ranking: number | null;
  onRacesPress: () => void;
  onVenuesPress: () => void;
  onAvgPositionPress: () => void;
  onRankingPress: () => void;
  onViewDetailsPress: () => void;
}

export const SeasonStatsCard: React.FC<SeasonStatsCardProps> = ({
  races,
  venues,
  avgPosition,
  ranking,
  onRacesPress,
  onVenuesPress,
  onAvgPositionPress,
  onRankingPress,
  onViewDetailsPress,
}) => {
  return (
    <Card className="mb-4 p-4" variant="elevated">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-lg font-bold">Season Performance</Text>
        <TouchableOpacity
          onPress={onViewDetailsPress}
          accessibilityLabel="View detailed performance statistics"
          accessibilityRole="button"
          style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}
        >
          <View className="flex-row items-center">
            <Text className="text-primary-600 text-sm mr-1">View Details</Text>
            <ChevronRight color="#007AFF" size={16} />
          </View>
        </TouchableOpacity>
      </View>

      <View className="flex-row">
        {/* Races */}
        <TouchableOpacity
          className="flex-1 items-center py-3"
          onPress={onRacesPress}
          accessibilityLabel={`${races} races completed this season. Tap to view race history.`}
          accessibilityRole="button"
          style={{ minHeight: 44 }}
        >
          <View className="mb-2">
            <Flag color="#007AFF" size={20} />
          </View>
          <Text className="text-2xl font-bold text-typography-900">{races}</Text>
          <Text className="text-typography-500 text-xs mt-1">Races</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View className="w-px bg-outline-200" />

        {/* Venues */}
        <TouchableOpacity
          className="flex-1 items-center py-3"
          onPress={onVenuesPress}
          accessibilityLabel={`${venues} venues sailed. Tap to view venue list.`}
          accessibilityRole="button"
          style={{ minHeight: 44 }}
        >
          <View className="mb-2">
            <MapPin color="#10B981" size={20} />
          </View>
          <Text className="text-2xl font-bold text-typography-900">
            {venues > 0 ? venues : '—'}
          </Text>
          <Text className="text-typography-500 text-xs mt-1">Venues</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View className="w-px bg-outline-200" />

        {/* Avg Position */}
        <TouchableOpacity
          className="flex-1 items-center py-3"
          onPress={onAvgPositionPress}
          accessibilityLabel={
            avgPosition
              ? `Average position ${avgPosition.toFixed(1)}. Tap to view position trends.`
              : 'No average position yet. Tap to learn more.'
          }
          accessibilityRole="button"
          style={{ minHeight: 44 }}
        >
          <View className="mb-2">
            <TrendingUp color="#F59E0B" size={20} />
          </View>
          <Text className="text-2xl font-bold text-typography-900">
            {avgPosition ? avgPosition.toFixed(1) : '—'}
          </Text>
          <Text className="text-typography-500 text-xs mt-1">Avg Pos</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View className="w-px bg-outline-200" />

        {/* Ranking */}
        <TouchableOpacity
          className="flex-1 items-center py-3"
          onPress={onRankingPress}
          accessibilityLabel={
            ranking ? `Ranking ${ranking}. Tap to view leaderboard.` : 'No ranking yet. Tap to learn more.'
          }
          accessibilityRole="button"
          style={{ minHeight: 44 }}
        >
          <View className="mb-2">
            <Trophy color="#EF4444" size={20} />
          </View>
          <Text className="text-2xl font-bold text-typography-900">
            {ranking ? ranking : '—'}
          </Text>
          <Text className="text-typography-500 text-xs mt-1">Ranking</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};
