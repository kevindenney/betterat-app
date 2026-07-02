/**
 * CreatorMentoringPanel — Mentoring feedback panel for blueprint authors.
 *
 * Rendered below StepDetailContent (read-only) on the creator step view.
 * Lets the author approve/request revision, suggest next steps, and leave notes.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useAuth } from '@/providers/AuthProvider';
import { NotificationService } from '@/services/NotificationService';
import { getReviewSections, getReviewSectionContent } from '@/lib/step/getReviewSections';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type { StepMetadata } from '@/types/step-detail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InstructorReviewStatus = 'approved' | 'needs_revision';

interface ReviewMetadata {
  instructor_review_status?: InstructorReviewStatus;
  instructor_review_note?: string;
  instructor_review_at?: string;
  instructor_suggested_next?: string;
  overall_rating?: number;
  what_learned?: string;
  worked_to_plan?: boolean;
}

interface Props {
  stepId: string;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const C = {
  bg: '#FFFFFF',
  card: '#F8F7F6',
  cardBorder: '#E5E4E1',
  accent: '#00897B',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  orange: '#EA580C',
  orangeBg: '#FFF7ED',
  radius: 12,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RatingDots({ value }: { value: number }) {
  const dots: React.ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    dots.push(
      <View
        key={i}
        style={[
          styles.dot,
          i <= value ? styles.dotFilled : styles.dotEmpty,
        ]}
      />,
    );
  }
  return <View style={styles.dotRow}>{dots}</View>;
}

function StatusBadge({
  status,
  date,
}: {
  status: InstructorReviewStatus;
  date?: string;
}) {
  const isApproved = status === 'approved';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: isApproved ? C.greenBg : C.orangeBg },
      ]}
    >
      <Ionicons
        name={isApproved ? 'checkmark-circle' : 'alert-circle'}
        size={16}
        color={isApproved ? C.green : C.orange}
      />
      <Text
        style={[
          styles.badgeText,
          { color: isApproved ? C.green : C.orange },
        ]}
      >
        {isApproved ? 'Approved' : 'Needs Revision'}
      </Text>
      {date ? (
        <Text style={styles.badgeDate}>{formatDate(date)}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CreatorMentoringPanel({ stepId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: step } = useStepDetail(stepId);
  const updateMetadata = useUpdateStepMetadata(stepId);

  const review: ReviewMetadata =
    (step?.metadata as Record<string, unknown> | undefined)?.review as ReviewMetadata ?? {};

  // Step Arch E — read what_learned via selector (sections[] preferred over flat field).
  const whatLearnedFromSections = getReviewSectionContent(
    getReviewSections(step?.metadata as StepMetadata | undefined).sections,
    'what_did_you_learn',
  );
  const whatLearnedDisplay = whatLearnedFromSections ?? review.what_learned ?? null;

  // ---- Review decision state ----
  const [selectedStatus, setSelectedStatus] =
    useState<InstructorReviewStatus | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSaved, setReviewSaved] = useState(false);

  // ---- Suggested next state ----
  const [suggestedNext, setSuggestedNext] = useState(
    review.instructor_suggested_next ?? '',
  );
  const [suggestionSaved, setSuggestionSaved] = useState(false);

  // Sync suggested next when remote data loads
  useEffect(() => {
    if (review.instructor_suggested_next != null) {
      setSuggestedNext(review.instructor_suggested_next);
    }
  }, [review.instructor_suggested_next]);

  // ---- Handlers ----

  const handleSelectStatus = useCallback(
    (status: InstructorReviewStatus) => {
      setSelectedStatus(status);
      setReviewNote('');
      setReviewSaved(false);
    },
    [],
  );

  const handleSaveReview = useCallback(async () => {
    if (!selectedStatus) return;
    try {
      await updateMetadata.mutateAsync({
        review: {
          instructor_review_status: selectedStatus,
          instructor_review_note: reviewNote.trim() || undefined,
          instructor_review_at: new Date().toISOString(),
        },
      } as Record<string, unknown>);
    } catch (err: any) {
      showAlert(
        'Could Not Save Review',
        err?.message || 'Something went wrong. Please try again.',
      );
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['studio-author-subscriber-steps'] });
    setReviewSaved(true);
    setSelectedStatus(null);

    // Notify the mentee so their view refreshes in real time
    if (step?.user_id && user?.id && step.user_id !== user.id) {
      NotificationService.notifyStepReviewed({
        targetUserId: step.user_id,
        actorId: user.id,
        actorName: user.user_metadata?.full_name ?? 'Your instructor',
        stepId,
        stepTitle: step.title ?? 'Step',
        reviewStatus: selectedStatus,
        reviewNote: reviewNote.trim() || undefined,
        suggestedNext: suggestedNext.trim() || undefined,
      }).catch(() => {}); // fire-and-forget
    }
  }, [selectedStatus, reviewNote, suggestedNext, updateMetadata, queryClient, step?.title, step?.user_id, stepId, user?.id, user?.user_metadata?.full_name]);

  const handleSaveSuggestion = useCallback(async () => {
    try {
      await updateMetadata.mutateAsync({
        review: {
          instructor_suggested_next: suggestedNext.trim() || undefined,
        },
      } as Record<string, unknown>);
    } catch (err: any) {
      showAlert(
        'Could Not Save Suggestion',
        err?.message || 'Something went wrong. Please try again.',
      );
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['studio-author-subscriber-steps'] });
    setSuggestionSaved(true);
  }, [suggestedNext, updateMetadata, queryClient]);

  // ---- Render ----

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Ionicons
          name="clipboard-outline"
          size={20}
          color={C.labelDark}
        />
        <Text style={styles.sectionTitle}>Mentoring Feedback</Text>
      </View>

      {/* ---- Review Decision Card ---- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Review Decision</Text>

        {review.instructor_review_status && !selectedStatus && (
          <View style={styles.existingReview}>
            <StatusBadge
              status={review.instructor_review_status}
              date={review.instructor_review_at}
            />
            {review.instructor_review_note ? (
              <Text style={styles.existingNote}>
                {review.instructor_review_note}
              </Text>
            ) : null}
          </View>
        )}

        {reviewSaved && !selectedStatus ? (
          <View style={styles.confirmationRow}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={C.green}
            />
            <Text style={styles.confirmationText}>Review saved</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          <Pressable
            style={[
              styles.actionButton,
              styles.approveButton,
              selectedStatus === 'approved' && styles.approveButtonActive,
            ]}
            onPress={() => handleSelectStatus('approved')}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={
                selectedStatus === 'approved' ? C.bg : C.green
              }
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: selectedStatus === 'approved' ? C.bg : C.green },
              ]}
            >
              Approve
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              styles.revisionButton,
              selectedStatus === 'needs_revision' &&
                styles.revisionButtonActive,
            ]}
            onPress={() => handleSelectStatus('needs_revision')}
          >
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={
                selectedStatus === 'needs_revision'
                  ? C.bg
                  : C.orange
              }
            />
            <Text
              style={[
                styles.actionButtonText,
                {
                  color:
                    selectedStatus === 'needs_revision'
                      ? C.bg
                      : C.orange,
                },
              ]}
            >
              Request Revision
            </Text>
          </Pressable>
        </View>

        {/* Expanded note input */}
        {selectedStatus != null && (
          <View style={styles.noteSection}>
            <TextInput
              style={styles.textInput}
              placeholder="Add an optional note..."
              placeholderTextColor={C.labelLight}
              value={reviewNote}
              onChangeText={setReviewNote}
              multiline
              numberOfLines={3}
              {...Platform.select({
                web: { style: [styles.textInput, { outlineStyle: 'none' } as any] },
              })}
            />
            <Pressable
              style={[
                styles.saveButton,
                updateMetadata.isPending && styles.saveButtonDisabled,
              ]}
              onPress={handleSaveReview}
              disabled={updateMetadata.isPending}
            >
              {updateMetadata.isPending ? (
                <ActivityIndicator size="small" color={C.bg} />
              ) : (
                <Text style={styles.saveButtonText}>Save Review</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* ---- Suggested Next Card ---- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          What should they work on next?
        </Text>
        <TextInput
          style={styles.textInput}
          placeholder="Suggest a focus area or next step..."
          placeholderTextColor={C.labelLight}
          value={suggestedNext}
          onChangeText={(t) => {
            setSuggestedNext(t);
            setSuggestionSaved(false);
          }}
          multiline
          numberOfLines={3}
          {...Platform.select({
            web: { style: [styles.textInput, { outlineStyle: 'none' } as any] },
          })}
        />
        <View style={styles.suggestionFooter}>
          {suggestionSaved ? (
            <View style={styles.confirmationRow}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={C.green}
              />
              <Text style={styles.confirmationText}>Saved</Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            style={[
              styles.saveButton,
              updateMetadata.isPending && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveSuggestion}
            disabled={updateMetadata.isPending}
          >
            {updateMetadata.isPending ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <Text style={styles.saveButtonText}>Save Suggestion</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ---- Student's Review Summary (read-only) ---- */}
      {(review.overall_rating != null ||
        review.worked_to_plan != null ||
        whatLearnedDisplay) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Student's Review</Text>

          {review.overall_rating != null && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Overall rating</Text>
              <RatingDots value={review.overall_rating} />
            </View>
          )}

          {review.worked_to_plan != null && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Worked to plan</Text>
              <View style={styles.yesNoRow}>
                <Ionicons
                  name={
                    review.worked_to_plan
                      ? 'checkmark-circle'
                      : 'close-circle'
                  }
                  size={18}
                  color={review.worked_to_plan ? C.green : C.orange}
                />
                <Text
                  style={[
                    styles.yesNoText,
                    {
                      color: review.worked_to_plan
                        ? C.green
                        : C.orange,
                    },
                  ]}
                >
                  {review.worked_to_plan ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
          )}

          {whatLearnedDisplay ? (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>What they learned</Text>
              <Text style={styles.summaryText}>
                {whatLearnedDisplay}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: C.labelDark,
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: C.radius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.labelDark,
    marginBottom: 12,
  },

  // Existing review
  existingReview: {
    marginBottom: 12,
  },
  existingNote: {
    fontSize: 14,
    color: C.labelMid,
    marginTop: 8,
    lineHeight: 20,
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  badgeDate: {
    fontSize: 12,
    color: C.labelLight,
    marginLeft: 4,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  approveButton: {
    borderColor: C.green,
    backgroundColor: C.bg,
  },
  approveButtonActive: {
    backgroundColor: C.green,
  },
  revisionButton: {
    borderColor: C.orange,
    backgroundColor: C.bg,
  },
  revisionButtonActive: {
    backgroundColor: C.orange,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Note input
  noteSection: {
    marginTop: 12,
  },
  textInput: {
    backgroundColor: C.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 12,
    fontSize: 14,
    color: C.labelDark,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: 10,
    minWidth: 120,
    minHeight: 40,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: C.bg,
    fontSize: 14,
    fontWeight: '600',
  },

  // Suggestion footer
  suggestionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },

  // Confirmation
  confirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  confirmationText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.green,
  },

  // Student summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryBlock: {
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: C.labelMid,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    color: C.labelDark,
    lineHeight: 20,
    marginTop: 4,
  },

  // Rating dots
  dotRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotFilled: {
    backgroundColor: C.accent,
  },
  dotEmpty: {
    backgroundColor: C.cardBorder,
  },

  // Yes/No
  yesNoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  yesNoText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
