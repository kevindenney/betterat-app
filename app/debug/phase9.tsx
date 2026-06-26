import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { HingeSurface } from '@/components/practice';
import type { BuiltHinge, HingeDay } from '@/services/HingeBuildService';
import { titlePhraseFor } from '@/services/HingeBuildService';

type GapPreset = '1night' | '3day' | 'week' | '2month' | 'quiet';

const PRESETS: { id: GapPreset; label: string; days: number }[] = [
  { id: '1night', label: '1 night', days: 1 },
  { id: '3day', label: '3 days', days: 3 },
  { id: 'week', label: 'A week', days: 6 },
  { id: '2month', label: '2 months', days: 62 },
  { id: 'quiet', label: 'Quiet (empty)', days: 2 },
];

function buildMockDays(gapDays: number, empty = false): HingeDay[] {
  const days: HingeDay[] = [];
  const today = new Date();
  for (let i = 0; i <= gapDays; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    days.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      dayLabel: d.toLocaleDateString(undefined, { weekday: 'long' }),
      dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      entries: empty
        ? []
        : i === 0
          ? [
              {
                id: `mock-flag-${i}`,
                kind: 'flagged',
                body: 'That tack-in. Heard "two more boats coming" and let it pass.',
                provenance: 'Flagged · Race 3',
              },
            ]
          : i === 1
            ? [
                {
                  id: `mock-note-${i}`,
                  kind: 'note',
                  body: 'Tune jib telltale earlier next time. Rig was off.',
                  provenance: 'On-deck · kept',
                },
              ]
            : i === 2
              ? [
                  {
                    id: `mock-reflection-${i}`,
                    kind: 'reflection',
                    body: 'Right pressure builds at 8 kn — anchor decision-window early.',
                    provenance: 'Playbook · voice',
                  },
                ]
              : [],
    });
  }
  return days;
}

function mockHinge(preset: { id: GapPreset; days: number }): BuiltHinge {
  return {
    id: `mock-${preset.id}`,
    previousStepId: 'mock-prev',
    previousStepTitle: 'Race 3 · 12-14 kn N',
    nextStepId: 'mock-next',
    nextStepTitle: 'Race 4 · 18-22 kn NE',
    gapStart: new Date().toISOString(),
    gapEnd: new Date(Date.now() + preset.days * 86400_000).toISOString(),
    gapDays: preset.days,
    eyebrowLabel: 'Between Race 3 and Race 4',
    titlePhrase: titlePhraseFor(preset.days),
    datesLabel: `${preset.days + 1} days`,
    days: buildMockDays(preset.days, preset.id === 'quiet'),
  };
}

export default function Phase9Debug() {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<GapPreset>('3day');
  const hinge = useMemo(() => {
    const found = PRESETS.find((p) => p.id === preset);
    return found ? mockHinge(found) : mockHinge(PRESETS[0]);
  }, [preset]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.controls, { paddingTop: insets.top + 8 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlsRow}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.chip, p.id === preset && styles.chipActive]}
              onPress={() => setPreset(p.id)}
            >
              <Text style={[styles.chipText, p.id === preset && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.surfaceHost}>
        <HingeSurface
          hinge={hinge}
          onBack={() => undefined}
          onPreviousStep={() => undefined}
          onNextStep={() => undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  controls: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  controlsRow: {
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  chipActive: {
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  surfaceHost: {
    flex: 1,
  },
});
