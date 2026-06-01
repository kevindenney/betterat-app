/**
 * ThisWeekFocusCard — prominent hero card showing the latest accepted or pending
 * focus_suggestion from the weekly review. Matches the mockup's "This week's
 * focus" treatment: AI-suggested badge, title, body, accept/edit/dismiss actions.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { ActivityIndicator, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { STEP_PALETTE } from '@/lib/step-theme';
import { showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { usePlaybookSuggestions, useAcceptSuggestion, useRejectSuggestion } from '@/hooks/usePlaybook';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { useAuth } from '@/providers/AuthProvider';
import { createStep, updateStepMetadata } from '@/services/TimelineStepService';

interface ThisWeekFocusCardProps {
  playbookId: string | undefined;
  interestId: string | undefined;
  onOpenDrawer: () => void;
}

/** Simple inline markdown: handles **bold** segments only. */
function renderBoldSegments(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={{ fontWeight: '700' }}>{part}</Text>
    ) : (
      <Text key={i}>{part}</Text>
    ),
  );
}

export function ThisWeekFocusCard({ playbookId, interestId, onOpenDrawer }: ThisWeekFocusCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: suggestions = [] } = usePlaybookSuggestions(playbookId);
  const { data: steps = [] } = useMyTimeline(interestId);
  const { mutate: accept } = useAcceptSuggestion();
  const { mutate: reject } = useRejectSuggestion();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Find the latest focus_suggestion — prefer accepted, then pending
  const focusSuggestion = useMemo(() => {
    const focusSuggestions = suggestions.filter((s) => s.kind === 'focus_suggestion');
    const accepted = focusSuggestions.find((s) => s.status === 'accepted');
    if (accepted) return accepted;
    return focusSuggestions.find((s) => s.status === 'pending') ?? null;
  }, [suggestions]);

  // Recent/upcoming steps for "add to existing" picker
  const recentSteps = useMemo(() => {
    const now = Date.now();
    return steps
      .filter((s) => s.status !== 'completed')
      .sort((a, b) => {
        const aTime = a.starts_at ? new Date(a.starts_at).getTime() : new Date(a.created_at).getTime();
        const bTime = b.starts_at ? new Date(b.starts_at).getTime() : new Date(b.created_at).getTime();
        // Prefer upcoming over past
        const aFuture = aTime > now ? 0 : 1;
        const bFuture = bTime > now ? 0 : 1;
        if (aFuture !== bFuture) return aFuture - bFuture;
        return Math.abs(aTime - now) - Math.abs(bTime - now);
      })
      .slice(0, 5);
  }, [steps]);

  const acceptAndAttachToStep = useCallback(
    async (stepId: string, focusText: string) => {
      if (!focusSuggestion) return;
      setActionLoading(true);
      setActionError(null);
      try {
        await updateStepMetadata(stepId, {
          plan: { focus_md: focusText },
        });
        accept({ suggestion: focusSuggestion });
        queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      } catch (err) {
        console.warn('[ThisWeekFocusCard] Failed to attach focus to step', err);
        setActionError('Couldn\u2019t save focus. Tap Accept to try again.');
      } finally {
        setActionLoading(false);
      }
    },
    [focusSuggestion, accept, queryClient],
  );

  const createNewStepWithFocus = useCallback(
    async (focusText: string, focusTitle: string) => {
      if (!user?.id || !interestId || !focusSuggestion) return;
      setActionLoading(true);
      setActionError(null);
      try {
        await createStep({
          user_id: user.id,
          interest_id: interestId,
          title: focusTitle,
          category: 'practice',
          status: 'pending',
          metadata: {
            plan: { focus_md: focusText },
            act: {},
            review: {},
            brain_dump: { entries: [] },
          },
        });
        accept({ suggestion: focusSuggestion });
        queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      } catch (err) {
        console.warn('[ThisWeekFocusCard] Failed to create step from focus', err);
        setActionError('Couldn\u2019t create step. Tap Accept to try again.');
      } finally {
        setActionLoading(false);
      }
    },
    [user, interestId, focusSuggestion, accept, queryClient],
  );

  const handleAccept = useCallback(() => {
    if (!focusSuggestion) return;
    const payload = focusSuggestion.payload as { focus_md?: string };
    const rawFocus = (payload.focus_md ?? '').replace(/^[-*•]\s+/, '').trim();
    // Derive a short title from the focus text
    const dotMatch = rawFocus.match(/^(.{10,}?[.:])\s/);
    const focusTitle = dotMatch && dotMatch[1].length <= 80
      ? dotMatch[1]
      : rawFocus.slice(0, 70) + (rawFocus.length > 70 ? '…' : '');

    if (recentSteps.length === 0) {
      // No existing steps — create new directly
      createNewStepWithFocus(rawFocus, focusTitle);
      return;
    }

    // Build buttons for step picker
    const buttons = [
      {
        text: 'Create new step',
        onPress: () => createNewStepWithFocus(rawFocus, focusTitle),
      },
      ...recentSteps.slice(0, 3).map((step) => ({
        text: `Add to: ${(step.title ?? 'Untitled').slice(0, 40)}`,
        onPress: () => acceptAndAttachToStep(step.id, rawFocus),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ];

    showAlertWithButtons(
      'Accept focus',
      'Create a new step or add this focus to an existing one?',
      buttons,
    );
  }, [focusSuggestion, recentSteps, createNewStepWithFocus, acceptAndAttachToStep]);

  const handleDismiss = useCallback(() => {
    if (!focusSuggestion || !playbookId) return;
    reject({ suggestionId: focusSuggestion.id, playbookId });
  }, [focusSuggestion, playbookId, reject]);

  if (!focusSuggestion) return null;

  const rawFocusMd = (focusSuggestion.payload as { focus_md?: string }).focus_md ?? '';
  // Strip leading markdown bullets/dashes
  const focusMd = rawFocusMd.replace(/^[-*•]\s+/, '').trim();
  const isPending = focusSuggestion.status === 'pending';

  // Split into title (first sentence, up to first period or colon) + body
  const splitMatch = focusMd.match(/^(.{10,}?[.:])\s/);
  const title = splitMatch && splitMatch[1].length <= 80
    ? splitMatch[1]
    : focusMd.slice(0, 70) + (focusMd.length > 70 ? '…' : '');
  const body = splitMatch && splitMatch[1].length <= 80
    ? focusMd.slice(splitMatch[1].length).trim()
    : (focusMd.length > 70 ? focusMd.slice(70).trim() : '');

  // Find associated weekly review date for provenance
  const weeklyReview = suggestions.find(
    (s) => s.kind === 'weekly_review' && s.status !== 'rejected',
  );
  const reviewDate = weeklyReview
    ? new Date(weeklyReview.created_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Ionicons name="compass" size={22} color="#8a5a00" />
      </View>
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>THIS WEEK'S FOCUS</Text>
        </View>
        <Text style={styles.title}>{renderBoldSegments(title)}</Text>
        {body ? (
          <Text style={styles.bodyText}>{renderBoldSegments(body)}</Text>
        ) : null}
        {actionError ? (
          <Text style={styles.actionError}>{actionError}</Text>
        ) : null}
        <View style={styles.actions}>
          {isPending ? (
            <>
              <Pressable
                style={[styles.acceptBtn, actionLoading && { opacity: 0.5 }]}
                onPress={handleAccept}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={STEP_PALETTE.ctaText} />
                ) : (
                  <Text style={styles.acceptBtnText}>Accept focus</Text>
                )}
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={onOpenDrawer} disabled={actionLoading}>
                <Text style={styles.secondaryBtnText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={handleDismiss} disabled={actionLoading}>
                <Text style={styles.secondaryBtnText}>Dismiss</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.acceptedChip}>
              <Ionicons name="checkmark-circle" size={12} color={STEP_PALETTE.textPrimary} />
              <Text style={styles.acceptedText}>Accepted</Text>
            </View>
          )}
          {reviewDate ? (
            <Text style={styles.provenance}>From weekly review · {reviewDate}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: STEP_PALETTE.bgPrimary,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
    flexDirection: 'row',
    gap: IOS_SPACING.md,
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_PALETTE.borderTertiary,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff6e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: STEP_PALETTE.textTertiary,
  },
  aiBadge: {
    backgroundColor: '#fff6e5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#8a5a00',
  },
  title: {
    // Card title: serif body per audit §2.5 (mockup body-prose treatment).
    fontFamily: fontFamily.serif,
    fontSize: 19,
    fontWeight: '500',
    color: STEP_PALETTE.textPrimary,
    lineHeight: 26,
  },
  bodyText: {
    // Body prose: serif 16pt primary per audit §2.3.
    fontFamily: fontFamily.serif,
    fontSize: 16,
    color: STEP_PALETTE.textSecondary,
    lineHeight: 24,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  acceptBtn: {
    // Primary CTA charcoal per redesign §2.4 (ctaBg / ctaText).
    backgroundColor: STEP_PALETTE.ctaBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: STEP_PALETTE.ctaText,
  },
  secondaryBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_PALETTE.borderSecondary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: STEP_PALETTE.textPrimary,
  },
  acceptedChip: {
    // Accepted-state pill: neutral on bgSecondary instead of the green fill.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: STEP_PALETTE.bgSecondary,
  },
  acceptedText: {
    fontSize: 11,
    fontWeight: '700',
    color: STEP_PALETTE.textSecondary,
  },
  actionError: {
    fontSize: 12,
    color: IOS_COLORS.systemRed ?? '#FF3B30',
    marginTop: 4,
  },
  provenance: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
});
