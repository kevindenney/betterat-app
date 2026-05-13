/**
 * Smart Race Coach Component
 * Ready-to-use AI coaching component that automatically provides
 * context-aware tactical advice based on race phase
 *
 * Usage:
 * <SmartRaceCoach
 *   raceId={raceId}
 *   position={gpsPosition}
 *   minimal={false}
 * />
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { Sparkles, ChevronDown, ChevronUp, X, RefreshCw } from 'lucide-react-native';

// Types
type RacePhase =
  | 'pre-race'
  | 'start-sequence'
  | 'first-beat'
  | 'weather-mark'
  | 'reaching'
  | 'running'
  | 'leeward-mark'
  | 'final-beat'
  | 'finish';

interface SmartRaceCoachProps {
  raceId: string;
  raceData?: {
    startTime?: Date | string;
    course?: any;
    marks?: any[];
    fleetSize?: number;
    windData?: any;
  };
  position?: { lat: number; lon: number };
  minimal?: boolean;
  autoRefresh?: boolean;
}

interface Advice {
  phase: RacePhase;
  primary: string;
  details?: string;
  actionItems?: string[];
  metrics?: Record<string, string>;
  confidence?: 'high' | 'medium' | 'low';
  timestamp: Date;
}

// Skill Registry (from SkillManagementService)
// Using built-in skills for instant, offline advice
const SKILL_IDS = {
  'starting-line-mastery': 'skill_builtin_starting_line_mastery',
  'upwind-strategic-positioning': 'skill_builtin_upwind_strategic_positioning',
  'upwind-tactical-combat': 'skill_builtin_upwind_tactical_combat',
  'downwind-speed-and-position': 'skill_builtin_downwind_speed_and_position',
  'mark-rounding-execution': 'skill_builtin_mark_rounding_execution',
  'finishing-line-tactics': 'skill_builtin_finishing_line_tactics',
};

const PHASE_TO_SKILL: Record<RacePhase, keyof typeof SKILL_IDS> = {
  'pre-race': 'starting-line-mastery',
  'start-sequence': 'starting-line-mastery',
  'first-beat': 'upwind-strategic-positioning',
  'weather-mark': 'mark-rounding-execution',
  'reaching': 'downwind-speed-and-position',
  'running': 'downwind-speed-and-position',
  'leeward-mark': 'mark-rounding-execution',
  'final-beat': 'finishing-line-tactics',
  'finish': 'finishing-line-tactics',
};

export function SmartRaceCoach({
  raceId: _raceId,
  raceData,
  position,
  minimal = false,
  autoRefresh = true,
}: SmartRaceCoachProps) {
  const [phase, setPhase] = useState<RacePhase>('pre-race');
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!minimal);
  const [dismissed, setDismissed] = useState(false);
  const [_error, _setError] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(1))[0]; // Start visible!
  const canUseNativeDriver = Platform.OS !== 'web';

  // Initial fetch on mount
  useEffect(() => {
    fetchAdvice(phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect race phase
  useEffect(() => {
    const detectedPhase = detectPhase(raceData, position);
    if (detectedPhase !== phase) {
      setPhase(detectedPhase);
      if (autoRefresh) {
        fetchAdvice(detectedPhase);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceData?.startTime, position, autoRefresh]);

  // Auto-expand on new advice
  useEffect(() => {
    if (advice && !minimal) {
      setExpanded(true);
      animateIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advice, minimal]);

  const animateIn = () => {
    Animated.spring(fadeAnim, {
      toValue: 1,
      useNativeDriver: canUseNativeDriver,
      tension: 50,
      friction: 7,
    }).start();
  };

  const fetchAdvice = async (currentPhase: RacePhase) => {
    setLoading(true);
    try {
      const skillName = PHASE_TO_SKILL[currentPhase];
      const context = buildContext(currentPhase, raceData, position);
      const result = await invokeSkill(skillName, context);

      setAdvice({
        phase: currentPhase,
        primary: result.primary || result.advice || 'Analyzing conditions...',
        details: result.details,
        actionItems: result.actionItems || [],
        metrics: result.metrics,
        confidence: result.confidence,
        timestamp: new Date(),
      });
      setDismissed(false);
    } catch (error) {
      console.error('Failed to fetch advice:', error);
      setAdvice({
        phase: currentPhase,
        primary: 'Coaching temporarily unavailable. Using fallback guidance.',
        confidence: 'low',
        timestamp: new Date(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAdvice(phase);
  };

  if (dismissed) {
    return (
      <Pressable
        onPress={() => {
          setDismissed(false);
          setExpanded(true);
        }}
        className="flex-row items-center gap-2 bg-purple-600 px-4 py-3 rounded-full shadow-lg"
      >
        <Sparkles size={20} color="white" />
        <Text className="text-white font-semibold">Ask for advice</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View
      style={{ opacity: fadeAnim }}
      className="bg-white border-2 border-purple-300 rounded-2xl shadow-xl overflow-hidden"
    >
      {/* Header */}
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-2">
          <Sparkles size={24} color="white" />
          <View>
            <Text className="text-white font-bold text-base">Race Coaching</Text>
            <Text className="text-purple-200 text-xs">{getPhaseLabel(phase)}</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          {loading && <ActivityIndicator size="small" color="white" />}
          <Pressable onPress={handleRefresh} className="p-1">
            <RefreshCw size={18} color="white" />
          </Pressable>
          <Pressable onPress={() => setDismissed(true)} className="p-1">
            <X size={18} color="white" />
          </Pressable>
          {expanded ? (
            <ChevronUp size={20} color="white" />
          ) : (
            <ChevronDown size={20} color="white" />
          )}
        </View>
      </Pressable>

      {/* Quick Summary (Always Visible) */}
      {!expanded && (
        <View className="px-4 py-3 bg-purple-50">
          <Text className="text-sm font-semibold text-purple-900">
            {loading ? 'Getting tactical advice...' : advice?.primary || 'Tap to get tactical advice'}
          </Text>
        </View>
      )}

      {/* Expanded Content */}
      {expanded && (loading || advice) && (
        <ScrollView className="max-h-96">
          <View className="p-4 space-y-4">
            {/* Loading State */}
            {loading && !advice && (
              <View className="bg-purple-50 p-6 rounded-xl border border-purple-200 items-center">
                <ActivityIndicator size="large" color="#9333ea" />
                <Text className="text-purple-900 mt-3 font-medium">
                  Analyzing conditions...
                </Text>
                <Text className="text-purple-700 text-xs mt-1">
                  Getting tactical advice
                </Text>
              </View>
            )}

            {/* Primary Advice */}
            {advice && (
              <View className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <Text className="text-base font-bold text-purple-900 mb-2">
                  💡 Quick Take
                </Text>
                <Text className="text-sm text-gray-800 leading-5">
                  {advice.primary}
                </Text>
              </View>
            )}

            {/* Details */}
            {advice?.details && (
              <View className="bg-gray-50 p-4 rounded-xl">
                <Text className="text-sm text-gray-700 leading-5">
                  {advice.details}
                </Text>
              </View>
            )}

            {/* Action Items */}
            {advice?.actionItems && advice.actionItems.length > 0 && (
              <View>
                <Text className="text-sm font-bold text-gray-900 mb-3">
                  ✓ Action Items
                </Text>
                {advice.actionItems.map((item, i) => (
                  <View key={i} className="flex-row items-start gap-3 mb-3">
                    <View className="w-6 h-6 bg-purple-600 rounded-full items-center justify-center">
                      <Text className="text-white text-xs font-bold">{i + 1}</Text>
                    </View>
                    <Text className="text-sm text-gray-700 flex-1 leading-5">
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Key Metrics */}
            {advice?.metrics && Object.keys(advice.metrics).length > 0 && (
              <View className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl">
                <Text className="text-sm font-bold text-gray-900 mb-3">
                  📊 Key Numbers
                </Text>
                <View className="space-y-2">
                  {Object.entries(advice.metrics).map(([key, value]) => (
                    <View key={key} className="flex-row justify-between items-center">
                      <Text className="text-xs text-gray-600 flex-1">{key}</Text>
                      <Text className="text-lg font-mono font-bold text-purple-900">
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Confidence Indicator */}
            {advice?.confidence && (
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-gray-500">
                  Updated {formatTimestamp(advice.timestamp)}
                </Text>
                <ConfidenceBadge level={advice.confidence} />
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

// Helper Components
function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const configs = {
    high: { bg: 'bg-green-100', text: 'text-green-800', label: 'HIGH' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'MED' },
    low: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'LOW' },
  };

  const config = configs[level];

  return (
    <View className={`${config.bg} px-3 py-1 rounded-full`}>
      <Text className={`text-xs font-bold ${config.text}`}>
        {config.label} CONFIDENCE
      </Text>
    </View>
  );
}

// Helper Functions
function detectPhase(raceData: any, position?: any): RacePhase {
  if (!raceData?.startTime) return 'pre-race';

  const now = new Date();
  const startTime = new Date(raceData.startTime);
  const minutesToStart = (startTime.getTime() - now.getTime()) / 1000 / 60;

  // Pre-race planning
  if (minutesToStart > 10) return 'pre-race';

  // Start sequence
  if (minutesToStart > 0 && minutesToStart <= 10) return 'start-sequence';

  // After start - would need GPS position to determine phase
  // For now, default to first beat
  if (position && raceData.marks) {
    // TODO: Calculate position relative to marks
    // This is simplified - real implementation would be more sophisticated
  }

  return 'first-beat';
}

function buildContext(phase: RacePhase, raceData: any, position?: any): any {
  const baseContext = {
    phase,
    timestamp: new Date().toISOString(),
  };

  switch (phase) {
    case 'pre-race':
    case 'start-sequence':
      return {
        ...baseContext,
        fleetSize: raceData?.fleetSize || 20,
        timeToStart: calculateTimeToStart(raceData?.startTime),
        windData: raceData?.windData,
      };

    case 'first-beat':
    case 'final-beat':
      return {
        ...baseContext,
        windData: raceData?.windData,
        position: position,
      };

    default:
      return baseContext;
  }
}

async function invokeSkill(skillName: keyof typeof SKILL_IDS, context: any): Promise<any> {
  const skillId = SKILL_IDS[skillName];

  // Check if this is a built-in skill (placeholder ID)
  if (skillId.startsWith('skill_builtin_')) {
    const advice = getBuiltInSkillAdvice(skillName, context);
    return advice;
  }

  // Build a natural language prompt
  const prompt = buildPrompt(skillName, context);

  try {
    // Call through Edge Function proxy instead of direct API call
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/anthropic-skills-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'messages',
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        skills: [
          {
            type: 'custom',
            custom_skill_id: skillId,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge Function error:', errorText);
      throw new Error(`Edge Function failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || 'No advice available';

    // Parse response into structured format
    return parseAdvice(content);
  } catch (error) {
    console.error('Skill invocation error:', error);
    return {
      primary: 'Unable to get advice at this time',
      confidence: 'low',
    };
  }
}

/**
 * Generate advice locally for built-in skills (without API call)
 */
function getBuiltInSkillAdvice(skillName: keyof typeof SKILL_IDS, context: any): any {
  switch (skillName) {
    case 'finishing-line-tactics':
      return {
        primary: 'Approach finish on four-laylines concept - analyze wind bias for favored end',
        details: `Based on RegattaFlow Coach championship tactics: Check finish line bias using the long-tack method. The downwind end is typically favored (opposite of start). Consider tactical ducking if favored end advantage exceeds 5+ boat lengths.`,
        actionItems: [
          'Determine favored end using long-tack or Sindle method',
          'Calculate four laylines (port-to-port, starboard-to-port, port-to-starboard, starboard-to-starboard)',
          'Evaluate ducking vs. tacking decisions based on net gain',
          'Monitor competitors on opposite tack approaching finish',
        ],
        metrics: {
          'Technique': 'Four-laylines navigation',
          'Key Decision': 'Favored end vs tactical position',
          'Reference': 'Buddy Friedrichs 1968 Olympics',
        },
        confidence: 'high' as const,
      };

    case 'starting-line-mastery':
      return {
        primary: 'Identify favored end and plan starting position to maximize advantage',
        details: `Assess line bias early and choose your approach. Aim for front row at favored end with clear air. Time your final approach to hit the line at full speed.`,
        actionItems: [
          'Check line bias using transit or long tack method',
          'Identify clear lane with no boats to leeward',
          'Position 2-3 boat lengths behind line at 1 minute',
          'Accelerate to full speed before gun',
        ],
        metrics: {
          'Time to start': `${Math.round(context?.timeToStart || 0)} min`,
          'Fleet size': `${context?.fleetSize || 'unknown'}`,
          'Priority': 'Clear air + favored end',
        },
        confidence: 'high' as const,
      };

    case 'upwind-strategic-positioning':
      return {
        primary: 'Sail toward the favored side of the course based on wind shifts and current',
        details: `Identify persistent wind shifts and current advantages. Position yourself to benefit from the favored side while maintaining options to tack if conditions change.`,
        actionItems: [
          'Monitor wind direction for persistent shifts',
          'Check current direction and strength',
          'Position on lifted tack toward favored side',
          'Maintain tactical flexibility to tack on headers',
        ],
        metrics: {
          'Strategy': 'Ladder rungs approach',
          'Key factor': 'Wind shifts + current',
          'Tacking': 'Only on headers or obstacles',
        },
        confidence: 'high' as const,
      };

    case 'upwind-tactical-combat':
      return {
        primary: 'Cover competitors behind you while maintaining clear air and speed',
        details: `When ahead, use loose cover to protect your position. When behind, create separation through splits or use speed to break through.`,
        actionItems: [
          'If ahead: Tack to cover when boats approach within 5 lengths',
          'If behind: Split early or sail fast in clear air',
          'Avoid tacking duels that slow both boats',
          'Use luffing rights defensively when overlapped',
        ],
        metrics: {
          'Covering': 'Loose cover preferred',
          'Breaking cover': 'Speed + tactical split',
          'Wind shadow': 'Extends 3-4 mast heights',
        },
        confidence: 'high' as const,
      };

    case 'downwind-speed-and-position':
      return {
        primary: 'Optimize VMG by sailing proper angles and positioning for pressure',
        details: `Sail by-the-lee in light air, higher angles in breeze. Hunt for pressure patches and position for favored gybe based on next mark approach.`,
        actionItems: [
          'Adjust sailing angle based on wind strength',
          'Hunt for darker water indicating more pressure',
          'Plan gybe approach to round next mark on inside',
          'Avoid blanketing boats ahead - find clear air',
        ],
        metrics: {
          'Light air': 'By-the-lee, low angles',
          'Heavy air': 'Higher, faster angles',
          'Strategy': 'Pressure hunting + positioning',
        },
        confidence: 'high' as const,
      };

    case 'mark-rounding-execution':
      return {
        primary: 'Execute wide entry, tight exit for optimal rounding speed and position',
        details: `Approach wide to maintain speed through the turn. Exit tight to the mark to prevent boats from rounding inside you. Accelerate early on new leg.`,
        actionItems: [
          'Enter wide (2-3 boat lengths) to maintain boat speed',
          'Turn smoothly - avoid over-steering',
          'Exit tight (within 1 length) to block inside',
          'Trim for new leg and accelerate immediately',
        ],
        metrics: {
          'Technique': 'Wide and close',
          'Speed loss': 'Minimize through smooth turn',
          'Overlap rule': '2 boat lengths',
        },
        confidence: 'high' as const,
      };

    default:
      return {
        primary: `Tactical advice for ${skillName.replace(/-/g, ' ')}`,
        details: 'Advanced racing tactics based on championship-proven strategies.',
        confidence: 'medium' as const,
      };
  }
}

function buildPrompt(skillName: string, context: any): string {
  const prompts = {
    'starting-line-mastery': `
Provide concise starting line strategy for this situation:
- Time to start: ${context.timeToStart || 'unknown'} minutes
- Fleet size: ${context.fleetSize || 'unknown'}
- Wind: ${JSON.stringify(context.windData || 'unknown')}

Return in format:
PRIMARY: [one sentence action]
DETAILS: [2-3 sentences explanation]
ACTIONS:
- [specific action 1]
- [specific action 2]
METRICS:
key1: value1
key2: value2
`,
    'upwind-strategic-positioning': `
Provide upwind strategy for current conditions:
- Wind data: ${JSON.stringify(context.windData || 'unknown')}
- Position: ${context.position || 'unknown'}

Return concise tactical guidance in same format as above.
`,
    'upwind-tactical-combat': `
Provide tactical guidance for boat-on-boat situation:
- Context: ${JSON.stringify(context)}

Return actionable tactics in same format.
`,
    'downwind-speed-and-position': `
Provide downwind strategy:
- Context: ${JSON.stringify(context)}

Return VMG and positioning guidance in same format.
`,
    'mark-rounding-execution': `
Provide mark rounding guidance:
- Context: ${JSON.stringify(context)}

Return rounding technique in same format.
`,
  };

  return prompts[skillName] || JSON.stringify(context);
}

function parseAdvice(content: string): any {
  // Simple parser - extracts PRIMARY, DETAILS, ACTIONS, METRICS
  const primary = content.match(/PRIMARY:\s*(.+?)(?:\n|$)/)?.[1] || content.split('\n')[0];
  const details = content.match(/DETAILS:\s*(.+?)(?:\nACTIONS|\n\n|$)/s)?.[1]?.trim();

  const actionsMatch = content.match(/ACTIONS:\s*([\s\S]+?)(?:\nMETRICS|\n\n|$)/);
  const actionItems = actionsMatch?.[1]
    ?.split('\n')
    .filter((line) => line.trim().startsWith('-'))
    .map((line) => line.trim().replace(/^-\s*/, ''));

  const metricsMatch = content.match(/METRICS:\s*([\s\S]+?)$/);
  const metrics: Record<string, string> = {};
  if (metricsMatch) {
    metricsMatch[1].split('\n').forEach((line) => {
      const [key, value] = line.split(':').map((s) => s.trim());
      if (key && value) metrics[key] = value;
    });
  }

  return {
    primary,
    details,
    actionItems,
    metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
    confidence: 'medium' as const,
  };
}

function getPhaseLabel(phase: RacePhase): string {
  const labels: Record<RacePhase, string> = {
    'pre-race': 'Pre-Race Planning',
    'start-sequence': 'Starting Soon',
    'first-beat': 'First Beat',
    'weather-mark': 'Weather Mark',
    'reaching': 'Reaching',
    'running': 'Running',
    'leeward-mark': 'Leeward Mark',
    'final-beat': 'Final Beat',
    'finish': 'Finish Line',
  };
  return labels[phase];
}

function calculateTimeToStart(startTime?: Date | string): number {
  if (!startTime) return 0;
  const start = new Date(startTime);
  const now = new Date();
  return Math.max(0, (start.getTime() - now.getTime()) / 1000 / 60);
}

function formatTimestamp(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
