import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Sparkles } from 'lucide-react-native';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { StatePill } from '@/components/step-loop';
import { DayTile } from './DayTile';
import { HingeBookend } from './HingeBookend';
import type { BuiltHinge, HingeDay, HingeDayEntry } from '@/services/HingeBuildService';

/** A pending step suggestion to surface as an adoptable next step. */
export interface HingeSuggestionView {
  id: string;
  title: string;
  /** "Sam Cooke · mentor" — who suggested it and in what role. */
  fromLabel: string;
  blurb?: string;
  /** Mentor/coach suggestions get priority styling. */
  isMentor?: boolean;
}

export interface HingeSurfaceProps {
  hinge: BuiltHinge;
  onBack: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onSaveEntryToLibrary?: (entry: HingeDayEntry) => void;
  savingEntryId?: string | null;
  savedEntryIds?: ReadonlySet<string>;
  /** Pending suggestions (mentors first) the user can adopt as their next step. */
  suggestions?: HingeSuggestionView[];
  onAdoptSuggestion?: (id: string) => void;
  adoptingSuggestionId?: string | null;
  /** Create a fresh next step from scratch. */
  onAddNextStep?: () => void;
}

export function HingeSurface({
  hinge,
  onBack,
  onPreviousStep,
  onNextStep,
  onSaveEntryToLibrary,
  savingEntryId,
  savedEntryIds,
  suggestions,
  onAdoptSuggestion,
  adoptingSuggestionId,
  onAddNextStep,
}: HingeSurfaceProps) {
  const insets = useSafeAreaInsets();
  const hasEntries = hinge.days.some((day) => day.entries.length > 0);
  const pendingSuggestions = suggestions ?? [];

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
          <Text style={styles.explainer}>
            A beat is the pause between steps — let what you just did settle, then choose
            what&rsquo;s next.
          </Text>
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
            <Text style={styles.emptyTitle}>This beat is quiet</Text>
            <Text style={styles.emptyBody}>
              A beat gathers what you flag or save during a step — flag a moment or save an
              insight and it&rsquo;ll show up here. That&rsquo;s fine too; a beat can just be a
              breath.
            </Text>
            <Pressable style={styles.emptyAction} onPress={onPreviousStep} hitSlop={6}>
              <ChevronLeft size={15} color="#007AFF" />
              <Text style={styles.emptyActionText}>Go to your last step</Text>
            </Pressable>
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

        {(pendingSuggestions.length > 0 || onAddNextStep) && (
          <View style={styles.nextBlock}>
            <Text style={styles.nextHeader}>Choose what&rsquo;s next</Text>

            {pendingSuggestions.map((s) => {
              const adopting = adoptingSuggestionId === s.id;
              return (
                <View
                  key={s.id}
                  style={[styles.suggestionCard, s.isMentor && styles.suggestionCardMentor]}
                >
                  <View style={styles.suggestionHead}>
                    <Sparkles size={13} color={s.isMentor ? '#7C4DFF' : '#6B7280'} />
                    <Text
                      style={[styles.suggestionFrom, s.isMentor && styles.suggestionFromMentor]}
                      numberOfLines={1}
                    >
                      {s.fromLabel}
                    </Text>
                  </View>
                  <Text style={styles.suggestionTitle}>{s.title}</Text>
                  {s.blurb ? (
                    <Text style={styles.suggestionBlurb} numberOfLines={2}>
                      {s.blurb}
                    </Text>
                  ) : null}
                  <Pressable
                    style={[styles.adoptButton, adopting && styles.adoptButtonBusy]}
                    onPress={() => onAdoptSuggestion?.(s.id)}
                    disabled={adopting || !onAdoptSuggestion}
                    hitSlop={6}
                  >
                    {adopting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.adoptButtonText}>Make this my next step</Text>
                    )}
                  </Pressable>
                </View>
              );
            })}

            {onAddNextStep ? (
              <Pressable style={styles.addStepButton} onPress={onAddNextStep} hitSlop={6}>
                <Plus size={16} color="#007AFF" />
                <Text style={styles.addStepText}>Add your own next step</Text>
              </Pressable>
            ) : null}
          </View>
        )}
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
  explainer: {
    fontSize: 13,
    lineHeight: 19,
    color: '#8E8E93',
    marginTop: 2,
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
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginTop: 8,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  bookendBlock: {
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 12,
  },
  nextBlock: {
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 8,
  },
  nextHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#8E8E93',
    paddingHorizontal: 2,
  },
  suggestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    padding: 14,
    gap: 6,
  },
  suggestionCardMentor: {
    borderColor: '#C9B8FF',
    backgroundColor: '#FBFAFF',
  },
  suggestionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  suggestionFrom: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  suggestionFromMentor: {
    color: '#7C4DFF',
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    lineHeight: 21,
  },
  suggestionBlurb: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  adoptButton: {
    marginTop: 4,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  adoptButtonBusy: {
    opacity: 0.7,
  },
  adoptButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#B5D6FF',
    borderStyle: 'dashed',
    backgroundColor: '#F2F8FF',
  },
  addStepText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
});
