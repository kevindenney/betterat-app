import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { StepPlanData } from '@/types/step-detail';

interface PlanStartingFrameRowProps {
  planData: StepPlanData;
  onPress?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** When provided, the How list renders as a tap-to-check checklist. */
  onToggleSubStep?: (subStepId: string, completed: boolean) => void;
}

export function hasPlanStartingFrameContent(planData: StepPlanData): boolean {
  if (planData.what_will_you_do?.trim()) return true;
  if (planData.why_reasoning?.trim()) return true;
  if (planData.how_sub_steps?.some((s) => s.text?.trim())) return true;
  return false;
}

function compactList(items: string[], fallback: string): string[] {
  const filtered = items.map((item) => item.trim()).filter(Boolean);
  return filtered.length > 0 ? filtered.slice(0, 3) : [fallback];
}

export function PlanStartingFrameRow({
  planData,
  onPress,
  disabled,
  readOnly,
  onToggleSubStep,
}: PlanStartingFrameRowProps) {
  const hasContent = hasPlanStartingFrameContent(planData);
  const isDisabled = disabled || !hasContent;
  const realSubSteps = (planData.how_sub_steps ?? []).filter((s) => s.text?.trim());
  const asChecklist = Boolean(onToggleSubStep) && realSubSteps.length > 0;
  const plannedSteps = compactList(
    (planData.how_sub_steps ?? []).map((step) => step.text),
    'No planned steps yet',
  );
  const collaborators = compactList(
    (planData.collaborators ?? []).map((person) =>
      person.role ? `${person.display_name} · ${person.role}` : person.display_name,
    ),
    'Just you for now',
  );
  const what = planData.what_will_you_do?.trim() || 'No plan summary yet';
  const why = planData.why_reasoning?.trim() || 'No reason written yet';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.glyph}>
          <Ionicons name="list" size={14} color="#FFFFFF" />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Plan for this attempt</Text>
          <Text style={styles.sub}>What, how, who, and why before you capture evidence.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>What</Text>
        <Text style={styles.body}>{what}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.sectionHalf}>
          <Text style={styles.label}>How</Text>
          {asChecklist
            ? realSubSteps.map((step) => (
                <Pressable
                  key={step.id}
                  style={styles.checkRow}
                  onPress={
                    readOnly
                      ? undefined
                      : () => onToggleSubStep?.(step.id, !step.completed)
                  }
                  disabled={readOnly}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: step.completed }}
                  accessibilityLabel={`Mark "${step.text}" ${step.completed ? 'not done' : 'done'}`}
                >
                  <View style={[styles.check, step.completed ? styles.checkDone : null]}>
                    {step.completed ? (
                      <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <Text
                    style={[styles.bullet, step.completed ? styles.bulletDone : null]}
                    numberOfLines={2}
                  >
                    {step.text}
                  </Text>
                </Pressable>
              ))
            : plannedSteps.map((step, index) => (
                <Text key={`${step}-${index}`} style={styles.bullet} numberOfLines={2}>
                  {index + 1}. {step}
                </Text>
              ))}
        </View>
        <View style={styles.sectionHalf}>
          <Text style={styles.label}>Who</Text>
          {collaborators.map((person, index) => (
            <Text key={`${person}-${index}`} style={styles.bullet} numberOfLines={2}>
              {person}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Why</Text>
        <Text style={styles.body}>{why}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.action,
          pressed && !isDisabled && styles.rowPressed,
          isDisabled && styles.rowDisabled,
        ]}
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel="Summarize the plan as a starting frame"
        accessibilityState={{ disabled: isDisabled }}
      >
        <Ionicons name="sparkles" size={13} color={IOS_COLORS.systemBlue} />
        <Text style={styles.actionText}>Summarize as starting note</Text>
        <Ionicons name="chevron-forward" size={14} color={IOS_COLORS.tertiaryLabel} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.md,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  glyph: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 122, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  sub: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  subEm: {
    fontStyle: 'italic',
    color: IOS_COLORS.label,
  },
  section: {
    gap: 3,
  },
  grid: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
  },
  sectionHalf: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.label,
  },
  bullet: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_COLORS.secondaryLabel,
    flexShrink: 1,
  },
  bulletDone: {
    textDecorationLine: 'line-through',
    color: IOS_COLORS.tertiaryLabel,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  check: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(60,60,67,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkDone: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  actionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: IOS_COLORS.systemBlue,
  },
});
