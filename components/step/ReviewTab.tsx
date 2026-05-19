/**
 * ReviewTab — Reflection phase wrapping StepCritiqueContent.
 *
 * Behind the PRACTICE_STEP_LOOP_IOS_REGISTER flag the body swaps to the
 * canonical ReflectTabIOSRegisterShell. Flag-off rendering is preserved
 * byte-identical (InstructorFeedbackCard + StepFocusConcepts +
 * StepCritiqueContent + footer).
 */

import React from 'react';
import { ScrollView, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_SPACING } from '@/lib/design-tokens-ios';
import { useStepDetail } from '@/hooks/useTimelineSteps';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { StepCritiqueContent } from './StepCritiqueContent';
import { StepFocusConcepts } from './StepFocusConcepts';
import { ReflectTabIOSRegisterShell } from './reflect-tab';

interface ReviewTabProps {
  stepId: string;
  readOnly?: boolean;
  footer?: React.ReactNode;
  /** When true, the tab body renders without its own ScrollView. */
  embedded?: boolean;
}

export function ReviewTab({ stepId, readOnly, footer, embedded }: ReviewTabProps) {
  if (FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER) {
    return (
      <ReflectTabIOSRegisterShell
        stepId={stepId}
        readOnly={readOnly}
        footer={footer}
        embedded={embedded}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <InstructorFeedbackCard stepId={stepId} />
      <StepFocusConcepts stepId={stepId} variant="review" />
      <StepCritiqueContent stepId={stepId} readOnly={readOnly} />
      {footer}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Instructor Feedback Card — shown when blueprint author has left feedback
// ---------------------------------------------------------------------------

const FC = {
  green: '#16A34A',
  greenBg: '#DCFCE7',
  orange: '#EA580C',
  orangeBg: '#FFF7ED',
  accent: '#00897B',
  accentBg: 'rgba(0,137,123,0.08)',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  border: '#E5E4E1',
} as const;

function InstructorFeedbackCard({ stepId }: { stepId: string }) {
  const { data: step } = useStepDetail(stepId);
  const review = (step?.metadata as any)?.review;

  if (!review) return null;

  const status = review.instructor_review_status as string | undefined;
  const note = review.instructor_review_note as string | undefined;
  const suggestedNext = review.instructor_suggested_next as string | undefined;

  if (!status && !suggestedNext) return null;

  const isApproved = status === 'approved';
  const isRevision = status === 'needs_revision';

  return (
    <View style={styles.feedbackCard}>
      <View style={styles.feedbackHeader}>
        <Ionicons name="school-outline" size={16} color={FC.accent} />
        <Text style={styles.feedbackTitle}>Instructor Feedback</Text>
      </View>

      {/* Review status */}
      {(isApproved || isRevision) && (
        <View style={[
          styles.statusBadge,
          { backgroundColor: isApproved ? FC.greenBg : FC.orangeBg },
        ]}>
          <Ionicons
            name={isApproved ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={isApproved ? FC.green : FC.orange}
          />
          <Text style={[styles.statusText, { color: isApproved ? FC.green : FC.orange }]}>
            {isApproved ? 'Approved' : 'Revision Requested'}
          </Text>
        </View>
      )}

      {/* Review note */}
      {note ? (
        <Text style={styles.feedbackNote}>{note}</Text>
      ) : null}

      {/* Suggested next */}
      {suggestedNext ? (
        <View style={styles.suggestedBox}>
          <Text style={styles.suggestedLabel}>Suggested next</Text>
          <Text style={styles.suggestedText}>{suggestedNext}</Text>
        </View>
      ) : null}
    </View>
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
  feedbackCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: FC.accentBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FC.border,
    padding: 14,
    gap: 10,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: FC.accent,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackNote: {
    fontSize: 14,
    color: FC.labelDark,
    lineHeight: 20,
  },
  suggestedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  suggestedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: FC.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  suggestedText: {
    fontSize: 14,
    color: FC.labelDark,
    lineHeight: 20,
  },
});
