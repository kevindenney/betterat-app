/**
 * Phase Header
 * Glanceable banner for current race phase, countdowns, and critical comms.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RacePhase } from '@/services/ai/SkillManagementService';

type Confidence = 'high' | 'medium' | 'low';

interface WindSummary {
  speed?: number;
  direction?: number;
  gust?: number;
}

interface PhaseHeaderProps {
  phase: RacePhase;
  confidence: Confidence;
  timeToStartSeconds?: number | null;
  timeInPhaseSeconds?: number;
  nextPhase?: RacePhase;
  wind?: WindSummary;
  heading?: number;
  vhfChannel?: string | null;
}

const PHASE_CONFIG: Record<
  RacePhase,
  { label: string; shortLabel: string; icon: string; accent: string }
> = {
  'pre-race': {
    label: 'Pre-Race Prep',
    shortLabel: 'Pre-Race',
    icon: 'clipboard-text-outline',
    accent: '#3B82F6',
  },
  'start-sequence': {
    label: 'Start Sequence',
    shortLabel: 'Start',
    icon: 'flag-checkered',
    accent: '#F97316',
  },
  'first-beat': {
    label: 'First Beat',
    shortLabel: 'First Beat',
    icon: 'arrow-up-bold',
    accent: '#10B981',
  },
  'weather-mark': {
    label: 'Weather Mark',
    shortLabel: 'Weather Mark',
    icon: 'weather-windy-variant',
    accent: '#8B5CF6',
  },
  'reaching': {
    label: 'Reaching Leg',
    shortLabel: 'Reaching',
    icon: 'sail-boat',
    accent: '#0EA5E9',
  },
  'running': {
    label: 'Running Leg',
    shortLabel: 'Running',
    icon: 'weather-windy',
    accent: '#007AFF',
  },
  'leeward-mark': {
    label: 'Leeward Mark',
    shortLabel: 'Leeward Mark',
    icon: 'anchor',
    accent: '#F59E0B',
  },
  'final-beat': {
    label: 'Final Beat',
    shortLabel: 'Final Beat',
    icon: 'arrow-up-circle-outline',
    accent: '#14B8A6',
  },
  finish: {
    label: 'Finish',
    shortLabel: 'Finish',
    icon: 'trophy-outline',
    accent: '#F43F5E',
  },
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high: '#10B981',
  medium: '#F59E0B',
  low: '#EF4444',
};

const CONFIDENCE_BACKGROUND: Record<Confidence, string> = {
  high: 'rgba(16, 185, 129, 0.12)',
  medium: 'rgba(245, 158, 11, 0.12)',
  low: 'rgba(239, 68, 68, 0.12)',
};

export function PhaseHeader({
  phase,
  confidence,
  timeToStartSeconds,
  timeInPhaseSeconds,
  nextPhase,
  wind,
  heading,
  vhfChannel,
}: PhaseHeaderProps) {
  const config = PHASE_CONFIG[phase] ?? PHASE_CONFIG['pre-race'];

  const countdownLabel = formatCountdownLabel(phase, timeToStartSeconds, timeInPhaseSeconds);

  const nextPhaseLabel =
    nextPhase && PHASE_CONFIG[nextPhase]
      ? PHASE_CONFIG[nextPhase].shortLabel
      : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={[styles.phaseBadge, { borderColor: config.accent, backgroundColor: `${config.accent}1A` }]}>
          <MaterialCommunityIcons
            name={config.icon}
            size={20}
            color={config.accent}
          />
          <View>
            <Text style={styles.phaseLabel}>{config.label}</Text>
            {nextPhaseLabel && (
              <Text style={styles.nextPhaseText}>Next: {nextPhaseLabel}</Text>
            )}
          </View>
        </View>

        <View style={styles.countdownBlock}>
          <Text style={styles.countdownText}>{countdownLabel.value}</Text>
          <Text style={styles.countdownSubtext}>{countdownLabel.caption}</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        {vhfChannel && (
          <MetricChip
            icon="radio"
            label={`VHF ${vhfChannel}`}
            caption="Race Committee"
          />
        )}

        {wind && typeof wind.speed === 'number' && typeof wind.direction === 'number' && (
          <MetricChip
            icon="weather-windy"
            label={`${wind.speed.toFixed(1)} kt`}
            caption={`@ ${Math.round(wind.direction)}°${formatGust(wind.gust)}`}
          />
        )}

        {typeof heading === 'number' && (
          <MetricChip
            icon="navigation"
            label={`${Math.round(heading)}°`}
            caption="COG"
          />
        )}

        <MetricChip
          icon="check-decagram"
          label={`${CONFIDENCE_LABEL[confidence]} confidence`}
          caption="Phase detection"
          backgroundColor={CONFIDENCE_BACKGROUND[confidence]}
          color={CONFIDENCE_COLOR[confidence]}
        />
      </View>
    </View>
  );
}

interface MetricChipProps {
  icon: string;
  label: string;
  caption?: string;
  backgroundColor?: string;
  color?: string;
}

function MetricChip({
  icon,
  label,
  caption,
  backgroundColor = 'rgba(255, 255, 255, 0.04)',
  color = '#F9FAFB',
}: MetricChipProps) {
  return (
    <View style={[styles.metricChip, { backgroundColor }]}>
      <MaterialCommunityIcons name={icon} size={16} color={color} style={styles.metricIcon} />
      <View>
        <Text style={[styles.metricLabel, { color }]}>{label}</Text>
        {caption && (
          <Text style={[styles.metricCaption, { color: `${color}CC` }]}>{caption}</Text>
        )}
      </View>
    </View>
  );
}

function formatCountdownLabel(
  phase: RacePhase,
  timeToStartSeconds?: number | null,
  timeInPhaseSeconds?: number
) {
  if (phase === 'pre-race' || phase === 'start-sequence') {
    if (typeof timeToStartSeconds === 'number') {
      const prefix = timeToStartSeconds < 0 ? '+' : '';
      return {
        value: `${prefix}${formatDuration(Math.abs(timeToStartSeconds))}`,
        caption: timeToStartSeconds >= 0 ? 'To start' : 'After start',
      };
    }
    return {
      value: '--:--',
      caption: 'To start',
    };
  }

  return {
    value: formatDuration(timeInPhaseSeconds ?? 0),
    caption: 'Time in phase',
  };
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatGust(gust?: number) {
  if (typeof gust !== 'number') {
    return '';
  }
  return ` (G ${gust.toFixed(1)})`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(12, 17, 28, 0.92)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  phaseLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  nextPhaseText: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 2,
  },
  countdownBlock: {
    alignItems: 'flex-end',
  },
  countdownText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F9FAFB',
    fontVariant: ['tabular-nums'],
  },
  countdownSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  metricIcon: {
    marginTop: -1,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  metricCaption: {
    fontSize: 11,
    color: '#D1D5DB',
  },
});

export default PhaseHeader;
