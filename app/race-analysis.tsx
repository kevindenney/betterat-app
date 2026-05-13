import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChevronLeft, Wind, Thermometer as _Thermometer, Droplets, Eye as _Eye, Clock as _Clock, MapPin, AlertTriangle, CheckCircle as _CheckCircle, XCircle as _XCircle, Sparkles, TrendingUp } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRaceTimerSession, useRaceAnalysis } from '@/hooks/useData';
import { Card } from '@/components/ui/card';
import { Badge, BadgeText } from '@/components/ui/badge';

const RaceAnalysisScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionId = params.sessionId as string || '';

  const [activeTab, setActiveTab] = useState('ai-coach');

  // Fetch session and analysis data
  const { data: session, loading: sessionLoading } = useRaceTimerSession(sessionId);
  const { data: analysis, loading: analysisLoading } = useRaceAnalysis(sessionId);

  const loading = sessionLoading || analysisLoading;

  // Format session data
  const raceData = session
    ? {
        id: session.id,
        date: new Date(session.start_time).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        venue: session.regattas?.name || 'Unknown Venue',
        fleetSize: session.fleet_size ?? 0,
        position: session.position ?? 0,
        elapsedTime: session.duration_seconds
          ? `${Math.floor(session.duration_seconds / 60)}:${(session.duration_seconds % 60)
              .toString()
              .padStart(2, '0')}`
          : '--:--',
      }
    : null;

  const conditions = session
    ? {
        windSpeed:
          session.wind_speed !== undefined && session.wind_speed !== null
            ? `${session.wind_speed} knots`
            : 'N/A',
        windDirection:
          session.wind_direction !== undefined && session.wind_direction !== null
            ? `${session.wind_direction}°`
            : 'N/A',
        waveHeight:
          session.wave_height !== undefined && session.wave_height !== null
            ? `${session.wave_height}m`
            : 'N/A',
      }
    : null;

  const renderAICoach = () => {
    if (!analysis) {
      return (
        <View className="items-center py-8">
          <Sparkles color="#9333EA" size={48} />
          <Text className="text-lg font-bold text-gray-800 mt-4">No Analysis Available</Text>
          <Text className="text-gray-600 text-center mt-2 px-4">
            Analysis will be generated automatically after race completion
          </Text>
        </View>
      );
    }

    const confidencePercent = Math.round((analysis.confidence_score || 0) * 100);

    return (
      <View className="gap-4">
        {/* Overall Summary */}
        <Card className="p-4">
          <View className="flex-row items-center mb-3">
            <View className="bg-purple-100 p-2 rounded-full mr-3">
              <Sparkles color="#9333EA" size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-800">Race Analysis</Text>
              <Badge
                action={confidencePercent >= 70 ? 'success' : confidencePercent >= 50 ? 'warning' : 'muted'}
                variant="solid"
                className="mt-1 self-start"
              >
                <BadgeText className="text-xs">{confidencePercent}% Confidence</BadgeText>
              </Badge>
            </View>
          </View>
          <Text className="text-gray-700 leading-6">{analysis.overall_summary}</Text>
        </Card>

        {/* Start Analysis */}
        {analysis.start_analysis && (
          <Card className="p-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">Start Performance</Text>
            <Text className="text-gray-700 leading-6">{analysis.start_analysis}</Text>
          </Card>
        )}

        {/* Upwind Analysis */}
        {analysis.upwind_analysis && (
          <Card className="p-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">Upwind Tactics</Text>
            <Text className="text-gray-700 leading-6">{analysis.upwind_analysis}</Text>
          </Card>
        )}

        {/* Downwind Analysis */}
        {analysis.downwind_analysis && (
          <Card className="p-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">Downwind Tactics</Text>
            <Text className="text-gray-700 leading-6">{analysis.downwind_analysis}</Text>
          </Card>
        )}

        {/* Tactical Decisions */}
        {analysis.tactical_decisions && (
          <Card className="p-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">Key Tactical Decisions</Text>
            <Text className="text-gray-700 leading-6">{analysis.tactical_decisions}</Text>
          </Card>
        )}

        {/* Boat Handling */}
        {analysis.boat_handling && (
          <Card className="p-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">Boat Handling</Text>
            <Text className="text-gray-700 leading-6">{analysis.boat_handling}</Text>
          </Card>
        )}

        {/* Recommendations */}
        {analysis.recommendations && analysis.recommendations.length > 0 && (
          <Card className="p-4">
            <View className="flex-row items-center mb-3">
              <TrendingUp color="#9333EA" size={20} />
              <Text className="text-lg font-bold text-gray-800 ml-2">Recommendations</Text>
            </View>
            {analysis.recommendations.map((rec, index) => (
              <View key={index} className="flex-row mb-3 last:mb-0">
                <Text className="text-purple-600 font-bold mr-2">{index + 1}.</Text>
                <Text className="text-gray-700 flex-1 leading-6">{rec}</Text>
              </View>
            ))}
          </Card>
        )}
      </View>
    );
  };

  const renderOverview = () => {
    if (!raceData) return null;

    return (
      <View className="gap-6">
        {/* Race Header */}
        <View className="bg-blue-50 p-4 rounded-xl">
          <Text className="text-2xl font-bold text-gray-800">{raceData.venue}</Text>
          <View className="flex-row justify-between mt-2">
            <View>
              <Text className="text-gray-600">{raceData.date}</Text>
            </View>
            {raceData.position > 0 && (
              <View className="items-end">
                <Text className="text-3xl font-bold text-blue-600">#{raceData.position}</Text>
                {raceData.fleetSize > 0 && (
                  <Text className="text-gray-600">of {raceData.fleetSize}</Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Performance Summary */}
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          <Text className="text-lg font-bold text-gray-800 mb-3">Performance Summary</Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Elapsed Time</Text>
            <Text className="font-medium">{raceData.elapsedTime}</Text>
          </View>
          {raceData.position > 0 && raceData.fleetSize > 0 && (
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Position</Text>
              <Text className="font-bold text-blue-600">#{raceData.position} of {raceData.fleetSize}</Text>
            </View>
          )}
        </View>

        {/* Key Metrics */}
        {conditions && (
          <View className="flex-row gap-4">
            <View className="flex-1 bg-white p-4 rounded-xl border border-gray-200 items-center">
              <Wind color="#2563EB" size={24} />
              <Text className="text-lg font-bold mt-2">{conditions.windSpeed}</Text>
              <Text className="text-gray-600 text-center">Wind Speed</Text>
            </View>
            <View className="flex-1 bg-white p-4 rounded-xl border border-gray-200 items-center">
              <Droplets color="#2563EB" size={24} />
              <Text className="text-lg font-bold mt-2">{conditions.waveHeight}</Text>
              <Text className="text-gray-600 text-center">Wave Height</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderConditions = () => {
    if (!conditions) return null;

    return (
      <View className="gap-4">
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          <Text className="text-lg font-bold text-gray-800 mb-3">Race Conditions</Text>
          <View className="gap-3">
            <View className="flex-row items-center">
              <Wind color="#2563EB" size={20} />
              <Text className="ml-2 text-gray-600 flex-1">Wind Speed</Text>
              <Text className="font-medium">{conditions.windSpeed}</Text>
            </View>
            <View className="flex-row items-center">
              <MapPin color="#2563EB" size={20} />
              <Text className="ml-2 text-gray-600 flex-1">Wind Direction</Text>
              <Text className="font-medium">{conditions.windDirection}</Text>
            </View>
            <View className="flex-row items-center">
              <Droplets color="#2563EB" size={20} />
              <Text className="ml-2 text-gray-600 flex-1">Wave Height</Text>
              <Text className="font-medium">{conditions.waveHeight}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };


  const renderTabContent = () => {
    switch (activeTab) {
      case 'ai-coach':
        return renderAICoach();
      case 'overview':
        return renderOverview();
      case 'conditions':
        return renderConditions();
      default:
        return renderAICoach();
    }
  };

  // Loading state
  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-gray-600 mt-3">Loading race analysis...</Text>
      </View>
    );
  }

  // No session found
  if (!session) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-4">
        <AlertTriangle color="#F59E0B" size={48} />
        <Text className="text-lg font-bold text-gray-800 mt-4">Race Session Not Found</Text>
        <Text className="text-gray-600 text-center mt-2">
          This race session could not be found
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-4 px-4 shadow-sm">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity className="p-2 -ml-2" onPress={() => router.back()}>
            <ChevronLeft color="#1F2937" size={24} />
          </TouchableOpacity>
          <View className="flex-1 ml-2">
            <Text className="text-xl font-bold text-gray-800">Race Analysis</Text>
            {raceData && <Text className="text-sm text-gray-600">{raceData.venue}</Text>}
          </View>
        </View>

        {/* Tab Navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row gap-2"
        >
          <TouchableOpacity
            className={`px-4 py-2 rounded-full ${activeTab === 'ai-coach' ? 'bg-purple-600' : 'bg-gray-200'}`}
            onPress={() => setActiveTab('ai-coach')}
          >
            <Text className={activeTab === 'ai-coach' ? 'text-white' : 'text-gray-700'}>Analysis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`px-4 py-2 rounded-full ${activeTab === 'overview' ? 'bg-blue-600' : 'bg-gray-200'}`}
            onPress={() => setActiveTab('overview')}
          >
            <Text className={activeTab === 'overview' ? 'text-white' : 'text-gray-700'}>Overview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`px-4 py-2 rounded-full ${activeTab === 'conditions' ? 'bg-blue-600' : 'bg-gray-200'}`}
            onPress={() => setActiveTab('conditions')}
          >
            <Text className={activeTab === 'conditions' ? 'text-white' : 'text-gray-700'}>Conditions</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      {/* Content */}
      <ScrollView className="flex-1 px-4 py-4">
        {renderTabContent()}
      </ScrollView>
    </View>
  );
};

export default RaceAnalysisScreen;
