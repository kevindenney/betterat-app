/**
 * Primary AI Coach
 * Hero wrapper around skill invocation that highlights the current tactical focus.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Minimize2,
} from 'lucide-react-native';
import type { RacePhase } from '@/services/ai/SkillManagementService';
import {
  buildQuickContext,
  invokeSkill,
  SKILL_DISPLAY,
  type CoachingSkillKey,
  type SkillAdvice,
} from '@/components/coaching/skillInvocation';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('PrimaryAICoach');

const PHASE_LABELS: Record<RacePhase, string> = {
  'pre-race': 'Pre-Race Preparation',
  'start-sequence': 'Start Sequence',
  'first-beat': 'First Beat',
  'weather-mark': 'Weather Mark Approach',
  reaching: 'Reaching Leg',
  running: 'Running Leg',
  'leeward-mark': 'Leeward Mark',
  'final-beat': 'Final Beat',
  finish: 'Finish',
};

const PHASE_THEMES: Record<
  RacePhase,
  { gradient: string[]; accent: string; icon: string }
> = {
  'pre-race': {
    gradient: ['#3730A3', '#1F2937'],
    accent: '#A855F7',
    icon: 'clipboard-check-outline',
  },
  'start-sequence': {
    gradient: ['#C026D3', '#701A75'],
    accent: '#F97316',
    icon: 'flag-checkered',
  },
  'first-beat': {
    gradient: ['#0C4A6E', '#082F49'],
    accent: '#38BDF8',
    icon: 'navigation-outline',
  },
  'weather-mark': {
    gradient: ['#1E293B', '#0F172A'],
    accent: '#8B5CF6',
    icon: 'weather-windy',
  },
  reaching: {
    gradient: ['#0369A1', '#0C4A6E'],
    accent: '#0EA5E9',
    icon: 'sail-boat',
  },
  running: {
    gradient: ['#155E75', '#0F172A'],
    accent: '#38BDF8',
    icon: 'waves',
  },
  'leeward-mark': {
    gradient: ['#1F2937', '#111827'],
    accent: '#F59E0B',
    icon: 'anchor',
  },
  'final-beat': {
    gradient: ['#0F172A', '#020617'],
    accent: '#10B981',
    icon: 'arrow-up-circle-outline',
  },
  finish: {
    gradient: ['#831843', '#581C34'],
    accent: '#F43F5E',
    icon: 'trophy-outline',
  },
};

const PHASE_TO_SKILL: Record<RacePhase, CoachingSkillKey> = {
  'pre-race': 'starting-line-mastery',
  'start-sequence': 'starting-line-mastery',
  'first-beat': 'upwind-strategic-positioning',
  'weather-mark': 'mark-rounding-execution',
  reaching: 'downwind-speed-and-position',
  running: 'downwind-speed-and-position',
  'leeward-mark': 'mark-rounding-execution',
  'final-beat': 'upwind-tactical-combat',
  finish: 'finishing-line-tactics',
};

const CONFIDENCE_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: '#10B981',
  medium: '#F59E0B',
  low: '#EF4444',
};

interface CoachAdvice extends SkillAdvice {
  skill: CoachingSkillKey;
  fetchedAt: Date;
}

interface PrimaryAICoachProps {
  raceId?: string | null;
  raceData?: any;
  phase: RacePhase;
  confidence?: 'high' | 'medium' | 'low';
  autoRefresh?: boolean;
  onAdviceReady?: (payload: CoachAdvice) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function PrimaryAICoach({
  raceId,
  raceData,
  phase,
  confidence = 'medium',
  autoRefresh = true,
  onAdviceReady,
  onCollapsedChange,
}: PrimaryAICoachProps) {
  const [advice, setAdvice] = useState<CoachAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const raceDataRef = useRef(raceData);
  const lastFetchPhaseRef = useRef<RacePhase | null>(null);

  useEffect(() => {
    raceDataRef.current = raceData;
  }, [raceData]);

  const skillForPhase = useMemo<CoachingSkillKey>(
    () => PHASE_TO_SKILL[phase] ?? 'starting-line-mastery',
    [phase]
  );

  const skillDefinition = SKILL_DISPLAY[skillForPhase];
  const theme = PHASE_THEMES[phase];

  const fetchAdvice = useCallback(
    async (reason: string) => {
      setLoading(true);
      setError(null);
      try {
        const quickContext = buildQuickContext(skillForPhase, raceDataRef.current);
        const context = {
          ...quickContext,
          phase,
          raceId,
          confidence,
          trigger: reason,
        };

        const result = await invokeSkill(skillForPhase, context);
        const payload: CoachAdvice = {
          ...result,
          skill: skillForPhase,
          fetchedAt: new Date(),
        };
        setAdvice(payload);
        onAdviceReady?.(payload);
        lastFetchPhaseRef.current = phase;
      } catch (err) {
        logger.error('Failed to get advice', err);
        setError(
          err instanceof Error ? err.message : 'AI analysis temporarily unavailable'
        );
        lastFetchPhaseRef.current = phase;
        setAdvice((prev) =>
          prev ?? {
            skill: skillForPhase,
            primary: 'AI analysis temporarily unavailable. Using fallback guidance.',
            confidence: 'low',
            fetchedAt: new Date(),
          }
        );
      } finally {
        setLoading(false);
      }
    },
    [skillForPhase, phase, raceId, confidence, onAdviceReady]
  );

  useEffect(() => {
    if (!autoRefresh) return;
    if (lastFetchPhaseRef.current === phase && advice) {
      return;
    }
    fetchAdvice('phase-change').catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoRefresh]);

  useEffect(() => {
    if (!autoRefresh && !advice) {
      fetchAdvice('initial').catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    fetchAdvice('manual-refresh').catch(() => null);
  };

  const handleCollapseToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      onCollapsedChange?.(next);
      return next;
    });
  };

  if (minimized) {
    return (
      <Pressable
        onPress={() => setMinimized(false)}
        style={styles.minimizedButton}
      >
        <Sparkles size={18} color="#FFFFFF" />
        <Text style={styles.minimizedText}>AI Analysis</Text>
        {advice?.confidence && (
          <View
            style={[
              styles.minimizedConfidence,
              { backgroundColor: `${CONFIDENCE_COLOR[advice.confidence]}33` },
            ]}
          >
            <MaterialCommunityIcons
              name="radar"
              size={12}
              color={CONFIDENCE_COLOR[advice.confidence]}
            />
            <Text
              style={[
                styles.minimizedConfidenceText,
                { color: CONFIDENCE_COLOR[advice.confidence] },
              ]}
            >
              {advice.confidence.toUpperCase()}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.wrapper}>
      <LinearGradient colors={theme.gradient} style={styles.gradientCard}>
        <View style={styles.headerRow}>
          <View style={styles.phaseInfo}>
            <View style={[styles.iconBadge, { backgroundColor: `${theme.accent}1A` }]}>
              <MaterialCommunityIcons
                name={theme.icon as any}
                size={26}
                color={theme.accent}
              />
            </View>
            <View>
              <Text style={styles.phaseLabel}>{PHASE_LABELS[phase]}</Text>
              <Text style={styles.skillFocusText}>
                Skill focus: {skillDefinition.label}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {loading && (
              <ActivityIndicator size="small" color="#F8FAFC" style={{ marginRight: 8 }} />
            )}
            <Pressable onPress={handleRefresh} style={styles.iconButton}>
              <RefreshCw size={18} color="#F8FAFC" />
            </Pressable>
            <Pressable onPress={handleCollapseToggle} style={styles.iconButton}>
              {collapsed ? (
                <ChevronDown size={20} color="#F8FAFC" />
              ) : (
                <ChevronUp size={20} color="#F8FAFC" />
              )}
            </Pressable>
            <Pressable onPress={() => setMinimized(true)} style={styles.iconButton}>
              <Minimize2 size={18} color="#F8FAFC" />
            </Pressable>
          </View>
        </View>

        {!collapsed && (
          <View style={styles.content}>
            {error && (
              <View style={styles.errorCard}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={20}
                  color="#F97316"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!error && advice && (
              <>
                <View style={styles.primaryCallout}>
                  <Text style={styles.primaryHeading}>Immediate Focus</Text>
                  <Text style={styles.primaryText}>{advice.primary}</Text>
                </View>

                {advice.details && (
                  <View style={styles.detailsCard}>
                    <Text style={styles.detailsText}>{advice.details}</Text>
                  </View>
                )}
              </>
            )}

            {!error && !advice && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#F8FAFC" />
                <Text style={styles.loadingText}>Analyzing conditions…</Text>
              </View>
            )}

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={16}
                  color="#E2E8F0"
                />
                <Text style={styles.metaText}>
                  {advice?.fetchedAt
                    ? `Updated ${formatRelativeTime(advice.fetchedAt)}`
                    : 'Awaiting update'}
                </Text>
              </View>

              <View style={styles.metaItem}>
                <MaterialCommunityIcons
                  name="radar"
                  size={16}
                  color={CONFIDENCE_COLOR[advice?.confidence ?? confidence]}
                />
                <Text
                  style={[
                    styles.metaText,
                    { color: CONFIDENCE_COLOR[advice?.confidence ?? confidence] },
                  ]}
                >
                  {(advice?.confidence ?? confidence).toUpperCase()} confidence
                </Text>
              </View>
            </View>
          </View>
        )}

        {collapsed && (
          <Pressable style={styles.collapsedSummary} onPress={handleCollapseToggle}>
            <Sparkles size={18} color={theme.accent} />
            <Text style={styles.collapsedText}>
              {loading
                ? 'Analyzing conditions…'
                : advice?.primary ?? 'Tap for AI tactical insight'}
            </Text>
          </Pressable>
        )}
      </LinearGradient>
    </View>
  );
}

function formatRelativeTime(date: Date) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradientCard: {
    borderRadius: 24,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  phaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  skillFocusText: {
    fontSize: 12,
    color: '#CBD5F5',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 6,
    borderRadius: 999,
  },
  content: {
    gap: 12,
  },
  primaryCallout: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
  },
  primaryHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E0F2FE',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  primaryText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#F8FAFC',
  },
  detailsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  detailsText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#E2E8F0',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 16,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  errorText: {
    color: '#FEE2E2',
    fontSize: 13,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  collapsedSummary: {
    marginTop: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  collapsedText: {
    color: '#E2E8F0',
    fontSize: 13,
    flex: 1,
  },
  minimizedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#4338CA',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  minimizedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  minimizedConfidence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  minimizedConfidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default PrimaryAICoach;
