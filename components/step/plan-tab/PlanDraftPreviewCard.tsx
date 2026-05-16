import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StepPlanData, SubStep } from '@/types/step-detail';

const IOS_BLUE = '#007AFF';
const IOS_INDIGO = '#5856D6';
const IOS_CORAL = '#FF6B6B';
const IOS_CORAL_TINT = 'rgba(255, 107, 107, 0.10)';
const IOS_CORAL_BORDER = 'rgba(255, 107, 107, 0.45)';
const GRAY_3 = '#C7C7CC';
const GRAY_4 = '#D1D1D6';
const GRAY_5 = '#E5E5EA';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';

export interface PlanDraftPreview {
  /** Short title (3-8 words), used as the card heading. */
  suggestedTitle?: string;
  /** Structured plan ready to commit when the user taps Accept. */
  planData: Partial<StepPlanData>;
  /** Optional per-sub-step tags (capability hints). One tag per sub-step index. */
  subStepTags?: (string | null)[];
}

export interface PlanDraftPreviewCardProps {
  draft: PlanDraftPreview;
  /** Accept & add to plan — commits the draft into the step's plan. */
  onAccept: () => void;
  /** Keep refining — dismisses the draft so the conversation can continue. */
  onKeepRefining: () => void;
  disabled?: boolean;
}

/**
 * AI Coach · Frame 3 — inline draft preview rendered inside the conversation.
 *
 * Same field structure as the canonical Plan tab (What · How · Why ·
 * Capabilities), compressed to chat width with a gradient DRAFT badge
 * and two actions: Accept & add to plan (iOS-blue primary) and Keep
 * refining (text). When the user accepts the draft commits via
 * onCreateStep; when they choose Keep refining the card dismisses and
 * the conversation continues below.
 */
export function PlanDraftPreviewCard({
  draft,
  onAccept,
  onKeepRefining,
  disabled,
}: PlanDraftPreviewCardProps) {
  const { suggestedTitle, planData, subStepTags } = draft;
  const subSteps: SubStep[] = Array.isArray(planData.how_sub_steps)
    ? planData.how_sub_steps
    : [];
  const capabilities: string[] = Array.isArray(planData.capability_goals)
    ? planData.capability_goals
    : [];

  return (
    <View style={styles.card} accessibilityLabel="Draft plan preview">
      <View style={styles.badge} pointerEvents="none">
        <Ionicons name="sparkles" size={10} color="#FFFFFF" />
        <Text style={styles.badgeText}>DRAFT</Text>
      </View>

      {suggestedTitle ? (
        <Text style={styles.title} numberOfLines={2}>
          {suggestedTitle}
        </Text>
      ) : null}

      {planData.what_will_you_do ? (
        <Field label="What">
          <Text style={styles.fieldVal}>{planData.what_will_you_do}</Text>
        </Field>
      ) : null}

      {subSteps.length > 0 ? (
        <Field
          label={`How — ${subSteps.length} ${subSteps.length === 1 ? 'sub-step' : 'sub-steps'}`}
        >
          <View>
            {subSteps.map((step, i) => {
              const tag = subStepTags?.[i] ?? null;
              return (
                <View key={step.id ?? `sub_${i}`} style={styles.listRow}>
                  <View style={styles.check} />
                  <Text style={styles.listText}>
                    {step.text}
                    {tag ? <Text style={styles.listTag}>{`  ${tag}`}</Text> : null}
                  </Text>
                </View>
              );
            })}
          </View>
        </Field>
      ) : null}

      {planData.why_reasoning ? (
        <Field label="Why">
          <Text style={styles.fieldVal}>{planData.why_reasoning}</Text>
        </Field>
      ) : null}

      {capabilities.length > 0 ? (
        <Field label="Capabilities">
          <View style={styles.capRow}>
            {capabilities.map((cap, i) => (
              <View
                key={`${cap}_${i}`}
                style={[styles.capChip, i >= 2 && styles.capChipOutlined]}
              >
                <Text
                  style={[
                    styles.capChipText,
                    i >= 2 && styles.capChipTextOutlined,
                  ]}
                >
                  {cap}
                </Text>
              </View>
            ))}
          </View>
        </Field>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Accept and add to plan"
          accessibilityState={{ disabled: Boolean(disabled) }}
          style={[styles.accept, disabled && styles.acceptDisabled]}
          onPress={disabled ? undefined : onAccept}
          hitSlop={4}
        >
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          <Text style={styles.acceptLabel}>Accept &amp; add to plan</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keep refining"
          accessibilityState={{ disabled: Boolean(disabled) }}
          style={styles.refine}
          onPress={disabled ? undefined : onKeepRefining}
          hitSlop={4}
        >
          <Text style={styles.refineLabel}>Keep refining</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldKey}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_4,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -9,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IOS_INDIGO,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.25,
    color: LABEL,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 8,
  },
  field: {
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
  },
  fieldKey: {
    fontSize: 9,
    fontWeight: '700',
    color: LABEL_3,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  fieldVal: {
    fontSize: 12.5,
    lineHeight: 17,
    color: LABEL,
    letterSpacing: -0.12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingVertical: 2,
  },
  check: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: GRAY_3,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  listText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: LABEL_2,
    letterSpacing: -0.1,
  },
  listTag: {
    fontSize: 9.5,
    fontWeight: '600',
    color: IOS_CORAL,
    letterSpacing: 0.1,
  },
  capRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  capChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: IOS_CORAL_TINT,
  },
  capChipOutlined: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_CORAL_BORDER,
  },
  capChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: IOS_CORAL,
    letterSpacing: -0.05,
  },
  capChipTextOutlined: {
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  accept: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: IOS_BLUE,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: IOS_BLUE,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  acceptDisabled: {
    opacity: 0.5,
  },
  acceptLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  refine: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  refineLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.15,
    color: IOS_BLUE,
  },
});
