import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { CapabilityMapEntry } from '@/services/CapabilityAggregationService';

interface Props {
  entry: CapabilityMapEntry;
  expanded?: boolean;
  onPress?: () => void;
}

export function CapabilityRow({ entry, expanded, onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.row}
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : undefined}
      >
        <View style={styles.main}>
          <View style={styles.topRow}>
            <Text style={styles.name}>{entry.name}</Text>
            <View style={styles.topMeta}>
              {entry.isJustEarned ? (
                <View style={styles.justEarnedChip}>
                  <Text style={styles.justEarnedText}>JUST EARNED</Text>
                </View>
              ) : null}
              <LevelChip label={entry.level} />
            </View>
          </View>

          <View style={styles.bottomRow}>
            <Pips on={entry.pipsOn} total={entry.pipsTotal} />
            <Text style={styles.meta}>
              {entry.evidenceCount} evidence · {entry.evidenceStepCount} step{entry.evidenceStepCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        {onPress ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-forward'}
            size={16}
            color={IOS_REGISTER.labelTertiary}
          />
        ) : null}
      </Pressable>

      {expanded && entry.recentEvidence.length > 0 ? (
        <View style={styles.trail}>
          {entry.recentEvidence.map((evidence) => (
            <View key={evidence.id} style={styles.trailRow}>
              <View style={styles.trailDot} />
              <View style={styles.trailBody}>
                <Text style={styles.trailTitle}>{evidence.stepTitle}</Text>
                <Text style={styles.trailMeta}>
                  {formatDate(evidence.capturedAt)} · {strengthLabel(evidence.strength)} · {evidence.evidenceCount} capture{evidence.evidenceCount === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Pips({ on, total }: { on: number; total: number }) {
  return (
    <View style={styles.pips}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[styles.pip, index < on && styles.pipOn]}
        />
      ))}
    </View>
  );
}

function LevelChip({ label }: { label: string }) {
  return (
    <View style={styles.levelChip}>
      <Text style={styles.levelChipText}>{label}</Text>
    </View>
  );
}

function strengthLabel(value: string) {
  if (value === 'strong') return 'Strong';
  if (value === 'material') return 'Material';
  return 'Worth noting';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  main: {
    flex: 1,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  levelChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.separator,
  },
  levelChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
    color: IOS_REGISTER.labelSecondary,
  },
  justEarnedChip: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(52, 199, 89, 0.14)',
  },
  justEarnedText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#1B8F46',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
  pips: {
    flexDirection: 'row',
    gap: 4,
  },
  pip: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D9DCE3',
  },
  pipOn: {
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  trail: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  trailDot: {
    marginTop: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#7C3AED',
  },
  trailBody: {
    flex: 1,
    gap: 2,
  },
  trailTitle: {
    fontSize: 13,
    color: IOS_REGISTER.label,
    fontWeight: '600',
  },
  trailMeta: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
});
