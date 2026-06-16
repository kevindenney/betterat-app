import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, TrendingDown, Award, Target } from 'lucide-react-native';

export default function AnalyticsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800">Advanced Analytics</Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Performance Overview */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-800 mb-4">Performance Overview</Text>

          <View className="flex-row justify-between mb-3">
            <View className="flex-1 bg-green-50 rounded-lg p-3 mr-2">
              <View className="flex-row items-center mb-1">
                <TrendingUp size={16} color="#059669" />
                <Text className="text-gray-600 text-sm ml-1">Win Rate</Text>
              </View>
              <Text className="text-2xl font-bold text-gray-800">32%</Text>
            </View>

            <View className="flex-1 bg-blue-50 rounded-lg p-3 ml-2">
              <View className="flex-row items-center mb-1">
                <Award size={16} color="#007AFF" />
                <Text className="text-gray-600 text-sm ml-1">Avg Position</Text>
              </View>
              <Text className="text-2xl font-bold text-gray-800">4.2</Text>
            </View>
          </View>

          <View className="flex-row justify-between">
            <View className="flex-1 bg-yellow-50 rounded-lg p-3 mr-2">
              <View className="flex-row items-center mb-1">
                <Target size={16} color="#F59E0B" />
                <Text className="text-gray-600 text-sm ml-1">Races</Text>
              </View>
              <Text className="text-2xl font-bold text-gray-800">24</Text>
            </View>

            <View className="flex-1 bg-purple-50 rounded-lg p-3 ml-2">
              <View className="flex-row items-center mb-1">
                <TrendingUp size={16} color="#7C3AED" />
                <Text className="text-gray-600 text-sm ml-1">Improvement</Text>
              </View>
              <Text className="text-2xl font-bold text-gray-800">+12%</Text>
            </View>
          </View>
        </View>

        {/* Strengths & Weaknesses */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-800 mb-4">Performance Insights</Text>

          <View className="mb-4">
            <View className="flex-row items-center mb-2">
              <TrendingUp size={16} color="#059669" />
              <Text className="text-gray-800 font-semibold ml-2">Strengths</Text>
            </View>
            <Text className="text-gray-600 ml-6">• Upwind speed in 12-18 knots</Text>
            <Text className="text-gray-600 ml-6">• Starting consistency</Text>
            <Text className="text-gray-600 ml-6">• Mark roundings</Text>
          </View>

          <View>
            <View className="flex-row items-center mb-2">
              <TrendingDown size={16} color="#EF4444" />
              <Text className="text-gray-800 font-semibold ml-2">Areas for Improvement</Text>
            </View>
            <Text className="text-gray-600 ml-6">• Light air tactics</Text>
            <Text className="text-gray-600 ml-6">• Downwind VMG</Text>
            <Text className="text-gray-600 ml-6">• Shift detection</Text>
          </View>
        </View>

        {/* AI Recommendations */}
        <View className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4">
          <Text className="text-white text-lg font-bold mb-2">Recommendations</Text>
          <Text className="text-blue-100">
            Based on your recent performance, consider focusing on light air tactics training and booking a coaching session for downwind speed optimization.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
