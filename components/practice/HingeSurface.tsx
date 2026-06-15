import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { StatePill } from '@/components/step-loop';
import { DayTile } from './DayTile';
import { HingeBookend } from './HingeBookend';
import type { BuiltHinge, HingeDay, HingeDayEntry } from '@/services/HingeBuildService';

export interface HingeSurfaceProps {
  hinge: BuiltHinge;
  onBack: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onSaveEntryToLibrary?: (entry: HingeDayEntry) => void;
  savingEntryId?: string | null;
  savedEntryIds?: ReadonlySet<string>;
}

export function HingeSurface({
  hinge,
  onBack,
  onPreviousStep,
  onNextStep,
  onSaveEntryToLibrary,
  savingEntryId,
  savedEntryIds,
}: HingeSurfaceProps) {
  const insets = useSafeAreaInsets();
  const hasEntries = hinge.days.some((day) => day.entries.length > 0);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
          <ChevronLeft size={20} color="#007AFF" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <StatePill variant="between" label="Between · settling" />
          <Text style={styles.title}>{hinge.titlePhrase}</Text>
          <Text style={styles.dates}>{hinge.datesLabel}</Text>
        </View>

        {hasEntries ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filmstrip}
          >
            {hinge.days.map((day: HingeDay) => {
              const entry = day.entries[0] ?? null;
              return (
                <DayTile
                  key={day.date}
                  day={day.dayLabel}
                  date={day.dateLabel}
                  entry={entry}
                  extraCount={Math.max(0, day.entries.length - 1)}
                  onSaveToLibrary={
                    entry && onSaveEntryToLibrary
                      ? () => onSaveEntryToLibrary(entry)
                      : undefined
                  }
                  saving={!!entry && savingEntryId === entry.id}
                  saved={!!entry && !!savedEntryIds?.has(entry.id)}
                />
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing captured in this beat yet</Text>
            <Text style={styles.emptyBody}>
              Flag a moment, jot a reflection, or add to your deck and it shows up here.
            </Text>
          </View>
        )}

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
  emptyState: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#9CA3AF',
  },
  bookendBlock: {
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 12,
  },
});
