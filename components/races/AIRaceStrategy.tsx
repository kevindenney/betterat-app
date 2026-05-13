import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/card';
import { Button, ButtonText } from '@/components/ui/button';
import { Sparkles, Brain, AlertCircle } from 'lucide-react-native';
import { enhancedAIClient } from '@/services/ai';
import { createLogger } from '@/lib/utils/logger';

interface AIRaceStrategyProps {
  race: any;
  weatherData?: any;
  tidalData?: any;
}

const logger = createLogger('AIRaceStrategy');

export function AIRaceStrategy({ race, weatherData: _weatherData, tidalData: _tidalData }: AIRaceStrategyProps) {
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  async function generateStrategy() {
    setLoading(true);
    setError(null);

    try {
      // Build comprehensive prompt
      const prompt = `Analyze this race and provide a complete tactical strategy:

## Race Details
- **Name**: ${race.name || race.title}
- **Type**: ${race.type || 'Regatta'}
- **Start Time**: ${race.startTime || race.date}
- **Wind**: ${race.wind?.speedMin || 10}-${race.wind?.speedMax || 15} knots from ${race.wind?.direction || 'NW'}
${race.currentSpeed ? `- **Current**: ${race.currentSpeed} knots` : ''}

Please provide:

1. **START LINE STRATEGY**
   - Favored end analysis
   - Approach plan
   - Timing recommendations

2. **UPWIND TACTICS**
   - Side to favor and why
   - Shift strategy
   - Current considerations

3. **DOWNWIND PLAN**
   - VMG strategy
   - Pressure lanes
   - Mode changes

4. **KEY TIMING**
   - Critical decision points
   - Maneuver windows
   - What to watch for

5. **CONTINGENCIES**
   - If wind shifts
   - If behind/ahead
   - Emergency tactics

Be specific, actionable, and reference the proven frameworks from your knowledge.`;

      // Call Claude with race strategy skills
      const response = await enhancedAIClient.createEnhancedMessage({
        model: 'claude-3-5-sonnet-20240620',
        messages: [{
          role: 'user',
          content: prompt
        }],
        skills: [
          { skillId: 'skill_01JKNbWxtu6YNNGyUwHAAnRw' } // race-strategy-analyst
        ],
        enableCodeExecution: true,
        maxTokens: 4096,
      });

      setStrategy(response.text);

    } catch (err) {
      logger.error('Error generating strategy', err);
      setError(err instanceof Error ? err.message : 'Failed to generate strategy');
    } finally {
      setLoading(false);
    }
  }

  if (!strategy && !loading) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Sparkles size={24} color="#8b5cf6" />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
              Race Strategy
            </Text>
          </View>
        </View>

        <Text className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Get expert race strategy analysis using championship frameworks from RegattaFlow Playbook,
          RegattaFlow Coach, and Olympic-level coaches.
        </Text>

        <Button
          onPress={generateStrategy}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <View className="flex-row items-center gap-2">
            <Brain size={20} color="white" />
            <ButtonText className="text-white font-semibold">
              Generate Race Strategy
            </ButtonText>
          </View>
        </Button>

        <View className="mt-3 flex-row items-center gap-2 bg-purple-100/50 dark:bg-purple-900/20 p-2 rounded-lg">
          <AlertCircle size={16} color="#8b5cf6" />
          <Text className="text-xs text-purple-700 dark:text-purple-300 flex-1">
            This will analyze start line, upwind/downwind tactics, and timing
          </Text>
        </View>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-800 p-6 mb-4">
        <View className="items-center justify-center py-8">
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text className="text-gray-600 dark:text-gray-400 mt-4 text-center">
            Analyzing race conditions...
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-500 mt-2 text-center">
            Consulting championship frameworks and tactical expertise
          </Text>
        </View>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 dark:bg-red-950/30 p-4 mb-4">
        <View className="flex-row items-center gap-2 mb-2">
          <AlertCircle size={20} color="#ef4444" />
          <Text className="text-red-900 dark:text-red-200 font-semibold">
            Error Generating Strategy
          </Text>
        </View>
        <Text className="text-red-700 dark:text-red-300 text-sm mb-3">
          {error}
        </Text>
        <Button onPress={generateStrategy} variant="outline">
          <ButtonText>Try Again</ButtonText>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800 mb-4">
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="p-4 flex-row items-center justify-between border-b border-gray-200 dark:border-gray-700"
      >
        <View className="flex-row items-center gap-2">
          <Sparkles size={24} color="#8b5cf6" />
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            Race Strategy
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-full">
            <Text className="text-xs font-medium text-green-700 dark:text-green-300">
              ✓ Generated
            </Text>
          </View>
          <Text className="text-gray-400">
            {expanded ? '▼' : '▶'}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <ScrollView className="p-4 max-h-96">
          <Text className="text-gray-800 dark:text-gray-200 leading-6">
            {strategy}
          </Text>

          <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onPress={generateStrategy}
              variant="outline"
              size="sm"
              className="flex-row items-center gap-2"
            >
              <Brain size={16} color="#8b5cf6" />
              <ButtonText className="text-purple-600 dark:text-purple-400">
                Regenerate Strategy
              </ButtonText>
            </Button>
          </View>
        </ScrollView>
      )}
    </Card>
  );
}
