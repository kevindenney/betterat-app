/**
 * Pre-Race Strategy Section
 * 
 * A redesigned, unified component that combines skill selection
 * and AI coaching into a cohesive, modern interface.
 * 
 * Features:
 * - 2-column skill grid (all visible, no scroll)
 * - Inline expansion for AI coaching content
 * - Color-coded skill cards with left accent borders
 * - Phase-aware skill recommendations
 * - Smooth animations for expand/collapse
 * - Progressive disclosure (Quick Take → Full Details)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Sparkles, ChevronRight, ChevronDown, RefreshCw, Check, Zap } from 'lucide-react-native';
import {
  DEFAULT_SKILL_ORDER,
  SKILL_DISPLAY,
  buildQuickContext,
  invokeSkill,
  type CoachingSkillKey,
  type SkillDisplayDefinition,
} from '../coaching/skillInvocation';
import { RaceCoachingCard } from '@/components/races/RaceCoachingCard';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Filter out tidal analyst from main grid (it's situational)
const GRID_SKILLS: SkillDisplayDefinition[] = DEFAULT_SKILL_ORDER
  .filter(key => key !== 'tidal-opportunism-analyst')
  .map(key => SKILL_DISPLAY[key]);

type RacePhase = 'pre-race' | 'start-sequence' | 'racing' | 'post-race';

interface AdviceContent {
  primary: string;
  details?: string;
  actionItems?: string[];
  metrics?: Record<string, string>;
  confidence?: 'high' | 'medium' | 'low';
}

interface PreRaceStrategySectionProps {
  raceId?: string;
  raceData?: any;
  racePhase?: RacePhase;
  /** Boat class for coach filtering */
  boatClass?: string;
  /** Race plan data to share with coach */
  racePlanData?: any;
  onSkillInvoked?: (skillId: CoachingSkillKey, advice: AdviceContent) => void;
}

// Map race phase to recommended skill
const PHASE_RECOMMENDATIONS: Record<RacePhase, CoachingSkillKey> = {
  'pre-race': 'starting-line-mastery',
  'start-sequence': 'starting-line-mastery',
  'racing': 'upwind-strategic-positioning',
  'post-race': 'finishing-line-tactics',
};

export function PreRaceStrategySection({
  raceId,
  raceData,
  racePhase = 'pre-race',
  boatClass,
  racePlanData,
  onSkillInvoked,
}: PreRaceStrategySectionProps) {
  const [selectedSkill, setSelectedSkill] = useState<CoachingSkillKey | null>(null);
  const [loadingSkill, setLoadingSkill] = useState<CoachingSkillKey | null>(null);
  const [advice, setAdvice] = useState<AdviceContent | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const recommendedSkill = PHASE_RECOMMENDATIONS[racePhase];

  // Animate advice panel when content changes
  useEffect(() => {
    if (advice) {
      Animated.spring(fadeAnim, {
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
        tension: 50,
        friction: 8,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advice]);

  const handleSkillPress = async (skill: SkillDisplayDefinition) => {
    // Configure layout animation
    LayoutAnimation.configureNext({
      duration: 300,
      update: { type: LayoutAnimation.Types.easeOut },
      create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
    });

    // If tapping same skill, collapse it
    if (selectedSkill === skill.id) {
      setSelectedSkill(null);
      setAdvice(null);
      setShowFullDetails(false);
      return;
    }

    // Select new skill
    setSelectedSkill(skill.id);
    setLoadingSkill(skill.id);
    setAdvice(null);
    setShowFullDetails(false);
    fadeAnim.setValue(0);

    try {
      const context = buildQuickContext(skill.id, raceData);
      const result = await invokeSkill(skill.id, context);

      // Parse the advice into structured format
      const adviceContent: AdviceContent = {
        primary: result.primary || 'Analyzing conditions...',
        details: result.details,
        confidence: result.confidence || 'high',
      };

      // Extract action items if present in details
      if (result.details) {
        const actionMatches = result.details.match(/(?:^|\. )([A-Z][^.]+\.)/g);
        if (actionMatches && actionMatches.length > 1) {
          adviceContent.actionItems = actionMatches.slice(0, 4).map(a => a.trim().replace(/^\. /, ''));
        }
      }

      setAdvice(adviceContent);
      onSkillInvoked?.(skill.id, adviceContent);
    } catch (error) {
      console.error('Error invoking skill:', error);
      setAdvice({
        primary: 'Unable to get advice at this time',
        confidence: 'low',
      });
    } finally {
      setLoadingSkill(null);
    }
  };

  const handleRefresh = async () => {
    if (!selectedSkill) return;
    const skill = SKILL_DISPLAY[selectedSkill];
    await handleSkillPress(skill);
  };

  const getSkillRow = (skills: SkillDisplayDefinition[], startIndex: number) => {
    return skills.slice(startIndex, startIndex + 2);
  };

  // Render a skill card
  const renderSkillCard = (skill: SkillDisplayDefinition) => {
    const isSelected = selectedSkill === skill.id;
    const isLoading = loadingSkill === skill.id;
    const isRecommended = skill.id === recommendedSkill && !selectedSkill;
    const isDisabled = loadingSkill !== null && loadingSkill !== skill.id;

    return (
      <Pressable
        key={skill.id}
        onPress={() => handleSkillPress(skill)}
        disabled={isDisabled}
        className="flex-1"
        style={{ opacity: isDisabled ? 0.5 : 1 }}
      >
        <View
          className="rounded-xl p-3 min-h-[72px]"
          style={{
            backgroundColor: isSelected ? `${skill.color}15` : '#FFFFFF',
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? skill.color : '#E5E7EB',
            borderLeftWidth: 4,
            borderLeftColor: skill.color,
          }}
        >
          {/* Recommended Badge */}
          {isRecommended && (
            <View
              className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full flex-row items-center gap-1"
              style={{ backgroundColor: skill.color }}
            >
              <Zap size={10} color="white" />
              <Text className="text-[9px] font-bold text-white">NOW</Text>
            </View>
          )}

          <View className="flex-row items-center gap-2">
            {/* Icon with background */}
            <View
              className="w-9 h-9 rounded-lg items-center justify-center"
              style={{ backgroundColor: `${skill.color}20` }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={skill.color} />
              ) : (
                <Text className="text-lg">{skill.icon}</Text>
              )}
            </View>

            {/* Content */}
            <View className="flex-1">
              <Text
                className="font-bold text-sm"
                style={{ color: isSelected ? skill.color : '#1F2937' }}
                numberOfLines={1}
              >
                {skill.label}
              </Text>
              <Text className="text-[11px] text-gray-500" numberOfLines={1}>
                {skill.description}
              </Text>
            </View>

            {/* Chevron */}
            {isSelected ? (
              <ChevronDown size={16} color={skill.color} />
            ) : (
              <ChevronRight size={16} color="#9CA3AF" />
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  // Render expanded advice panel
  const renderAdvicePanel = (afterSkillId: CoachingSkillKey) => {
    if (selectedSkill !== afterSkillId || !advice) return null;
    
    const skill = SKILL_DISPLAY[selectedSkill];

    return (
      <Animated.View
        style={{ opacity: fadeAnim }}
        className="mx-4 mb-3 -mt-1"
      >
        <View
          className="rounded-xl overflow-hidden"
          style={{
            borderWidth: 2,
            borderColor: skill.color,
            borderTopWidth: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          }}
        >
          {/* Quick Take */}
          <View
            className="p-4"
            style={{ backgroundColor: `${skill.color}08` }}
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Sparkles size={16} color={skill.color} />
              <Text className="text-sm font-bold" style={{ color: skill.color }}>
                Quick Take
              </Text>
              <View className="flex-1" />
              <Pressable onPress={handleRefresh} className="p-1">
                <RefreshCw size={14} color={skill.color} />
              </Pressable>
            </View>
            <Text className="text-sm text-gray-800 leading-5">
              {advice.primary}
            </Text>
          </View>

          {/* Details Section */}
          {advice.details && (
            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowFullDetails(!showFullDetails);
              }}
              className="px-4 py-3 bg-white border-t border-gray-100"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-gray-600">
                  {showFullDetails ? 'Hide Details' : 'Show Full Analysis'}
                </Text>
                <ChevronDown
                  size={14}
                  color="#6B7280"
                  style={{
                    transform: [{ rotate: showFullDetails ? '180deg' : '0deg' }],
                  }}
                />
              </View>
              
              {showFullDetails && (
                <Text className="text-sm text-gray-700 mt-2 leading-5">
                  {advice.details}
                </Text>
              )}
            </Pressable>
          )}

          {/* Action Items */}
          {advice.actionItems && advice.actionItems.length > 0 && (
            <View className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <Text className="text-xs font-bold text-gray-700 mb-2">
                ✓ Key Actions
              </Text>
              {advice.actionItems.slice(0, 4).map((item, i) => (
                <View key={i} className="flex-row items-start gap-2 mb-1.5">
                  <View
                    className="w-5 h-5 rounded-md items-center justify-center mt-0.5"
                    style={{ backgroundColor: `${skill.color}20` }}
                  >
                    <Text
                      className="text-[10px] font-bold"
                      style={{ color: skill.color }}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-700 flex-1 leading-4">
                    {item.replace(/\.$/, '')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Confidence Footer */}
          {advice.confidence && (
            <View className="px-4 py-2 bg-white border-t border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Check size={12} color="#10B981" />
                <Text className="text-[10px] text-gray-500">
                  Coaching advice
                </Text>
              </View>
              <ConfidenceBadge level={advice.confidence} />
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View className="mb-4">
      {/* Section Header */}
      <View className="flex-row items-center justify-between px-4 mb-3">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center">
            <Sparkles size={18} color="#9333EA" />
          </View>
          <View>
            <Text className="text-base font-bold text-gray-900">Race Coaching</Text>
            <Text className="text-xs text-gray-500">Tap any topic for instant advice</Text>
          </View>
        </View>
        <View className="bg-purple-100 px-2.5 py-1 rounded-full">
          <Text className="text-[10px] font-bold text-purple-700">
            {GRID_SKILLS.length} SKILLS
          </Text>
        </View>
      </View>

      {/* Skill Grid - 2 columns */}
      <View className="px-4">
        {/* Row 1: Start Strategy + Upwind Strategy */}
        <View className="flex-row gap-2 mb-2">
          {getSkillRow(GRID_SKILLS, 0).map(renderSkillCard)}
        </View>
        {/* Check if advice panel should appear after row 1 */}
        {(selectedSkill === 'starting-line-mastery' || selectedSkill === 'upwind-strategic-positioning') &&
          renderAdvicePanel(selectedSkill)}

        {/* Row 2: Upwind Tactics + Downwind */}
        <View className="flex-row gap-2 mb-2">
          {getSkillRow(GRID_SKILLS, 2).map(renderSkillCard)}
        </View>
        {/* Check if advice panel should appear after row 2 */}
        {(selectedSkill === 'upwind-tactical-combat' || selectedSkill === 'downwind-speed-and-position') &&
          renderAdvicePanel(selectedSkill)}

        {/* Row 3: Mark Rounding + Finish Tactics */}
        <View className="flex-row gap-2 mb-2">
          {getSkillRow(GRID_SKILLS, 4).map(renderSkillCard)}
        </View>
        {/* Check if advice panel should appear after row 3 */}
        {(selectedSkill === 'mark-rounding-execution' || selectedSkill === 'finishing-line-tactics') &&
          renderAdvicePanel(selectedSkill)}
      </View>

      {/* Empty State Hint */}
      {!selectedSkill && (
        <View className="mx-4 mt-2 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm">
              <Text className="text-xl">💡</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-800">
                Get race-winning advice
              </Text>
              <Text className="text-xs text-gray-600 mt-0.5">
                Select a topic above to receive tactical coaching
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Coaching Card - Prep Context */}
      {raceId && (
        <View className="px-4">
          <RaceCoachingCard
            raceId={raceId}
            context="prep"
            boatClass={boatClass}
            racePlanData={racePlanData || raceData}
          />
        </View>
      )}
    </View>
  );
}

// Helper: Confidence Badge
function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const configs = {
    high: { bg: '#D1FAE5', text: '#065F46', label: 'HIGH' },
    medium: { bg: '#FEF3C7', text: '#92400E', label: 'MED' },
    low: { bg: '#F3F4F6', text: '#4B5563', label: 'LOW' },
  };

  const config = configs[level];

  return (
    <View
      className="px-2 py-0.5 rounded-full"
      style={{ backgroundColor: config.bg }}
    >
      <Text
        className="text-[9px] font-bold"
        style={{ color: config.text }}
      >
        {config.label}
      </Text>
    </View>
  );
}

export default PreRaceStrategySection;

