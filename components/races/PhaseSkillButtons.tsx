/**
 * Phase Skill Buttons
 * Phase-aware quick access to AI skills with large touch targets.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RacePhase } from '@/services/ai/SkillManagementService';
import {
  DEFAULT_SKILL_ORDER,
  SKILL_DISPLAY,
  buildQuickContext,
  invokeSkill,
  type CoachingSkillKey,
  type SkillAdvice,
  type SkillDisplayDefinition,
} from '@/components/coaching/skillInvocation';
import { createLogger } from '@/lib/utils/logger';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

const logger = createLogger('PhaseSkillButtons');

interface PhaseSkillButtonsProps {
  phase: RacePhase;
  confidence?: 'high' | 'medium' | 'low';
  raceData?: any;
  onSkillInvoked?: (skillId: CoachingSkillKey, advice: SkillAdvice) => void;
}

const PHASE_LABELS: Record<RacePhase, string> = {
  'pre-race': 'Pre-Race Prep',
  'start-sequence': 'Start Sequence',
  'first-beat': 'First Beat',
  'weather-mark': 'Weather Mark',
  'reaching': 'Reaching Leg',
  'running': 'Running Leg',
  'leeward-mark': 'Leeward Mark',
  'final-beat': 'Final Beat',
  finish: 'Finish',
};

const PHASE_SKILL_MAP: Partial<Record<RacePhase, CoachingSkillKey[]>> = {
  'pre-race': [
    'starting-line-mastery',
    'upwind-strategic-positioning',
    'tidal-opportunism-analyst',
  ],
  'start-sequence': [
    'starting-line-mastery',
    'upwind-tactical-combat',
    'tidal-opportunism-analyst',
  ],
  'first-beat': [
    'upwind-strategic-positioning',
    'upwind-tactical-combat',
    'tidal-opportunism-analyst',
  ],
  'weather-mark': [
    'mark-rounding-execution',
    'upwind-tactical-combat',
  ],
  reaching: [
    'downwind-speed-and-position',
    'mark-rounding-execution',
  ],
  running: [
    'downwind-speed-and-position',
    'tidal-opportunism-analyst',
  ],
  'leeward-mark': [
    'mark-rounding-execution',
    'downwind-speed-and-position',
  ],
  'final-beat': [
    'upwind-tactical-combat',
    'upwind-strategic-positioning',
  ],
  finish: [
    'finishing-line-tactics',
    'downwind-speed-and-position',
  ],
};

const CONFIDENCE_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: '#10B981',
  medium: '#F59E0B',
  low: '#EF4444',
};

export function PhaseSkillButtons({
  phase,
  confidence = 'medium',
  raceData,
  onSkillInvoked,
}: PhaseSkillButtonsProps) {
  const [loadingSkill, setLoadingSkill] = useState<CoachingSkillKey | null>(null);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;

  const skillDefinitions = useMemo<SkillDisplayDefinition[]>(() => {
    const priority = PHASE_SKILL_MAP[phase] ?? [];
    const merged = [...priority, ...DEFAULT_SKILL_ORDER];
    const deduped: CoachingSkillKey[] = [];

    for (const skill of merged) {
      if (!deduped.includes(skill) && SKILL_DISPLAY[skill]) {
        deduped.push(skill);
      }
    }

    const limit = isTablet ? 6 : 4;
    return deduped.slice(0, limit).map((key) => SKILL_DISPLAY[key]);
  }, [phase, isTablet]);

  const handleSkillPress = async (skillId: CoachingSkillKey) => {
    setLoadingSkill(skillId);

    try {
      const context = buildQuickContext(skillId, raceData);
      const advice = await invokeSkill(skillId, context);

      onSkillInvoked?.(skillId, advice);

      const definition = SKILL_DISPLAY[skillId];
      const title = `${definition.icon} ${definition.label}`;
      const message = advice.details
        ? `${advice.primary}\n\n${advice.details}`
        : advice.primary;

      showAlert(title, message);
    } catch (error) {
      logger.error('Skill invocation failed', error);
      const message = 'Unable to get advice right now. Please try again.';
      showAlert('Coaching unavailable', message);
    } finally {
      setLoadingSkill(null);
    }
  };

  const handleSkillDetails = (skillId: CoachingSkillKey) => {
    const definition = SKILL_DISPLAY[skillId];
    if (!definition) return;

    const title = `${definition.icon} ${definition.label}`;
    showAlert(title, definition.description);
  };

  const renderSkillButton = (definition: SkillDisplayDefinition) => {
    const isLoading = loadingSkill === definition.id;
    return (
      <Pressable
        key={definition.id}
        onPress={() => handleSkillPress(definition.id)}
        onLongPress={() => handleSkillDetails(definition.id)}
        disabled={loadingSkill !== null && !isLoading}
        style={[
          styles.skillButton,
          {
            borderColor: isLoading ? definition.color : 'rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            opacity: loadingSkill !== null && !isLoading ? 0.5 : 1,
          },
        ]}
      >
        <Text style={styles.skillIcon}>{definition.icon}</Text>
        <Text style={styles.skillLabel}>{definition.label}</Text>
        <Text style={styles.skillDescription}>{definition.description}</Text>
        {isLoading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color={definition.color} />
          </View>
        )}
      </Pressable>
    );
  };

  const content = isTablet ? (
    <View
      style={[
        styles.skillsGrid,
        isLandscape && styles.skillsGridLandscape,
      ]}
    >
      {skillDefinitions.map(renderSkillButton)}
    </View>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.skillsScrollContent}
    >
      {skillDefinitions.map(renderSkillButton)}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>
          Phase Focus: {PHASE_LABELS[phase] ?? 'Race'}
        </Text>
        <View
          style={[
            styles.confidencePill,
            { backgroundColor: `${CONFIDENCE_COLOR[confidence]}1A` },
          ]}
        >
          <MaterialCommunityIcons
            name="radar"
            size={14}
            color={CONFIDENCE_COLOR[confidence]}
          />
          <Text
            style={[
              styles.confidenceText,
              { color: CONFIDENCE_COLOR[confidence] },
            ]}
          >
            {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
          </Text>
        </View>
      </View>

      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  skillsScrollContent: {
    gap: 10,
    paddingRight: 16,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skillsGridLandscape: {
    justifyContent: 'space-between',
  },
  skillButton: {
    minWidth: 140,
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  skillIcon: {
    fontSize: 28,
  },
  skillLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F9FAFB',
    textAlign: 'center',
  },
  skillDescription: {
    fontSize: 12,
    color: '#CBD5F5',
    textAlign: 'center',
  },
  loadingIndicator: {
    marginTop: 4,
  },
});

export default PhaseSkillButtons;
