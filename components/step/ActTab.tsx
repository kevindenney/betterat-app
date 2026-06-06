/**
 * ActTab — Execution phase wrapping StepDrawContent.
 *
 * Behind the PRACTICE_DO_TAB_IOS_REGISTER flag the body mounts the new
 * presentational DoTabInterior driven by useStepActCaptureController.
 * Flag-off rendering is byte-identical to the pre-Phase-B.7 surface.
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_PALETTE } from '@/lib/step-theme';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { StepDrawContent } from './StepDrawContent';
import { StepFocusConcepts } from './StepFocusConcepts';
import { DateEnrichmentCard } from './DateEnrichmentCard';
import { DoTabIOSRegisterShell } from './do-tab';
import { RaceDoTabSection } from './RaceDoTabSection';
import type { DateEnrichment } from '@/types/step-detail';

interface ActTabProps {
  stepId: string;
  dateEnrichment?: DateEnrichment;
  onNextTab?: () => void;
  readOnly?: boolean;
  footer?: React.ReactNode;
  interestId?: string;
  interestName?: string;
  interestSlug?: string;
  /** When true, the tab body renders without its own ScrollView. */
  embedded?: boolean;
  /** Race steps swap the Do tab for the on-water capture cockpit. */
  isRace?: boolean;
}

export function ActTab({ stepId, dateEnrichment, onNextTab, readOnly, footer, interestId, interestName, interestSlug, embedded, isRace }: ActTabProps) {
  // Race steps keep the mostly-standard Do tab, just with the START SEQUENCE
  // and LIVE TRACKING cards prepended (the full atmospheric cockpit lives only
  // on the standalone /race/ios/water route now).
  const raceSection = isRace ? (
    <RaceDoTabSection stepId={stepId} readOnly={readOnly} />
  ) : null;

  if (FEATURE_FLAGS.PRACTICE_DO_TAB_IOS_REGISTER) {
    const shell = (
      <DoTabIOSRegisterShell
        stepId={stepId}
        readOnly={readOnly}
        interestId={interestId}
        interestName={interestName}
        interestSlug={interestSlug}
        onMoveToReflect={onNextTab}
        footer={footer}
        embedded={embedded}
      />
    );
    if (!raceSection) return shell;
    return embedded ? (
      <>
        {raceSection}
        {shell}
      </>
    ) : (
      <View style={styles.container}>
        {raceSection}
        {shell}
      </View>
    );
  }

  const hasConditions = dateEnrichment && (dateEnrichment.wind || dateEnrichment.tide);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {raceSection}

      {/* Conditions reference card */}
      {hasConditions ? (
        <View style={styles.conditionsContainer}>
          <DateEnrichmentCard
            dateLabel="today's session"
            dateIso=""
            enrichment={dateEnrichment}
          />
        </View>
      ) : dateEnrichment && !hasConditions ? (
        <View style={styles.conditionsUnavailable}>
          <Ionicons name="cloud-offline-outline" size={16} color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.conditionsUnavailableText}>Conditions data unavailable for this date</Text>
        </View>
      ) : null}

      <StepFocusConcepts stepId={stepId} />

      <StepDrawContent stepId={stepId} readOnly={readOnly} interestId={interestId} interestName={interestName} interestSlug={interestSlug} />

      {/* Next tab CTA */}
      {onNextTab && !readOnly && (
        <View style={styles.nextCtaContainer}>
          <Pressable style={styles.nextCtaPrimary} onPress={onNextTab}>
            <Ionicons name="checkmark-done" size={18} color={STEP_PALETTE.ctaText} />
            <Text style={styles.nextCtaPrimaryText}>Save & Reflect</Text>
          </Pressable>
        </View>
      )}
      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: IOS_SPACING.md,
    paddingBottom: 100,
  },
  conditionsContainer: {
    paddingHorizontal: IOS_SPACING.md,
    marginBottom: IOS_SPACING.md,
  },
  conditionsUnavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 10,
    marginBottom: IOS_SPACING.sm,
  },
  conditionsUnavailableText: {
    fontSize: 13,
    color: STEP_PALETTE.textTertiary,
  },
  nextCtaContainer: {
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.lg,
    gap: 8,
  },
  nextCtaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: STEP_PALETTE.ctaBg,
    borderRadius: 12,
    paddingVertical: 14,
  },
  nextCtaPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: STEP_PALETTE.ctaText,
  },
});
