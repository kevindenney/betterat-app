import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { StatePill } from '@/components/step-loop';
import { DayTile } from './DayTile';
import { HingeBookend } from './HingeBookend';
import type { BuiltHinge, HingeDay } from '@/services/HingeBuildService';

export interface HingeSurfaceProps {
  hinge: BuiltHinge;
  onBack: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
}

export function HingeSurface({ hinge, onBack, onPreviousStep, onNextStep }: HingeSurfaceProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
          <ChevronLeft size={20} color="#007AFF" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <StatePill variant="between" label="Between · settling" />
          <Text style={styles.eyebrow}>{hinge.eyebrowLabel}</Text>
          <Text style={styles.title}>{hinge.titlePhrase}</Text>
          <Text style={styles.dates}>{hinge.datesLabel}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filmstrip}
        >
          {hinge.days.map((day: HingeDay) => (
            <DayTile
              key={day.date}
              day={day.dayLabel}
              date={day.dateLabel}
              entry={day.entries[0] ?? null}
            />
          ))}
        </ScrollView>

        <View style={styles.bookendBlock}>
          <HingeBookend
            kind="before"
            label="Settled · before this hinge"
            stepTitle={hinge.previousStepTitle}
            onPress={onPreviousStep}
          />
          <HingeBookend
            kind="after"
            label="Opens · after this hinge"
            stepTitle={hinge.nextStepTitle}
            onPress={onNextStep}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 15,
    color: '#007AFF',
    marginLeft: -2,
  },
  scrollContent: {
    paddingBottom: 48,
    gap: 18,
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '400',
    color: '#111827',
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
  },
  dates: {
    fontSize: 13,
    color: '#6B7280',
  },
  filmstrip: {
    paddingHorizontal: 16,
    gap: 10,
  },
  bookendBlock: {
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 12,
  },
});
