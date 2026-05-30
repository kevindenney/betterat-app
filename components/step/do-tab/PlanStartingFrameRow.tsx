import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { FORMAT_ICON, FORMAT_TINT } from '@/components/library/resources/formatStyles';
import type { BeforeShiftItem } from '@/components/step/v2/plan/BeforeTheShiftCard';
import type { StepPlanData, SubStep } from '@/types/step-detail';

export type SubStepCaptureKind = 'note' | 'photo' | 'voice';

interface PlanStartingFrameRowProps {
  planData: StepPlanData;
  onPress?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** When provided, the How list renders as a tap-to-check checklist. */
  onToggleSubStep?: (subStepId: string, completed: boolean) => void;
  /** Library items pinned to each How sub-step, keyed by sub-step id. */
  subStepRefs?: Record<string, BeforeShiftItem[]>;
  /** Open a pinned library item's resource viewer. */
  onOpenLibraryRef?: (libraryItemId: string) => void;
  /** Pin a library item to a specific How sub-step (opens the picker). */
  onAttachLibrary?: (subStepId: string) => void;
  /** Capture an observation / photo / voice note against a How sub-step. */
  onSubStepCapture?: (subStepId: string, kind: SubStepCaptureKind) => void;
  /** Count of captures already logged against each sub-step, keyed by id. */
  subStepCaptureCount?: Record<string, number>;
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
  subStepRefs,
  onOpenLibraryRef,
  onAttachLibrary,
  onSubStepCapture,
  subStepCaptureCount,
}: PlanStartingFrameRowProps) {
  const hasContent = hasPlanStartingFrameContent(planData);
  const isDisabled = disabled || !hasContent;
  const realSubSteps = (planData.how_sub_steps ?? []).filter((s) => s.text?.trim());
  const asChecklist = Boolean(onToggleSubStep) && realSubSteps.length > 0;
  // Rich mode: each How row carries pinned library items + per-row capture
  // affordances. Renders full-width (the compact How|Who grid can't hold the
  // chips + action bar). Falls back to the simple checklist/list otherwise.
  const richHow = asChecklist && Boolean(onAttachLibrary || onSubStepCapture);
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

      {richHow ? (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>How</Text>
            {realSubSteps.map((step) => (
              <RichHowRow
                key={step.id}
                step={step}
                readOnly={readOnly}
                refs={subStepRefs?.[step.id] ?? []}
                captureCount={subStepCaptureCount?.[step.id] ?? 0}
                onToggle={() => onToggleSubStep?.(step.id, !step.completed)}
                onOpenLibraryRef={onOpenLibraryRef}
                onAttachLibrary={onAttachLibrary ? () => onAttachLibrary(step.id) : undefined}
                onCapture={
                  onSubStepCapture ? (kind) => onSubStepCapture(step.id, kind) : undefined
                }
              />
            ))}
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Who</Text>
            {collaborators.map((person, index) => (
              <Text key={`${person}-${index}`} style={styles.bullet} numberOfLines={2}>
                {person}
              </Text>
            ))}
          </View>
        </>
      ) : (
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
      )}

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

interface RichHowRowProps {
  step: SubStep;
  readOnly?: boolean;
  refs: BeforeShiftItem[];
  captureCount: number;
  onToggle: () => void;
  onOpenLibraryRef?: (libraryItemId: string) => void;
  onAttachLibrary?: () => void;
  onCapture?: (kind: SubStepCaptureKind) => void;
}

function RichHowRow({
  step,
  readOnly,
  refs,
  captureCount,
  onToggle,
  onOpenLibraryRef,
  onAttachLibrary,
  onCapture,
}: RichHowRowProps) {
  return (
    <View style={styles.richRow}>
      <Pressable
        style={styles.checkRow}
        onPress={readOnly ? undefined : onToggle}
        disabled={readOnly}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: step.completed }}
        accessibilityLabel={`Mark "${step.text}" ${step.completed ? 'not done' : 'done'}`}
      >
        <View style={[styles.check, step.completed ? styles.checkDone : null]}>
          {step.completed ? <Ionicons name="checkmark" size={11} color="#FFFFFF" /> : null}
        </View>
        <Text
          style={[styles.bullet, step.completed ? styles.bulletDone : null]}
          numberOfLines={2}
        >
          {step.text}
        </Text>
      </Pressable>

      {refs.length > 0 ? (
        <View style={styles.refChips}>
          {refs.map((ref) => {
            const tint = FORMAT_TINT[ref.format];
            return (
              <Pressable
                key={ref.id}
                style={styles.refChip}
                onPress={
                  onOpenLibraryRef && ref.libraryItemId
                    ? () => onOpenLibraryRef(ref.libraryItemId!)
                    : undefined
                }
                disabled={!onOpenLibraryRef || !ref.libraryItemId}
                accessibilityRole="button"
                accessibilityLabel={`Open ${ref.title}`}
              >
                <View style={[styles.refGlyph, { backgroundColor: `${tint}22` }]}>
                  <Ionicons name={FORMAT_ICON[ref.format]} size={11} color={tint} />
                </View>
                <Text style={styles.refTitle} numberOfLines={1}>
                  {ref.title}
                </Text>
                {ref.read ? (
                  <Ionicons name="checkmark-circle" size={12} color="#34C759" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!readOnly && (onAttachLibrary || onCapture) ? (
        <View style={styles.actionBar}>
          {onAttachLibrary ? (
            <Pressable
              style={styles.iconBtn}
              onPress={onAttachLibrary}
              accessibilityRole="button"
              accessibilityLabel="Attach a library item to this step"
            >
              <Ionicons name="link" size={15} color={IOS_COLORS.systemBlue} />
            </Pressable>
          ) : null}
          {onCapture ? (
            <>
              <Pressable
                style={styles.iconBtn}
                onPress={() => onCapture('note')}
                accessibilityRole="button"
                accessibilityLabel="Log an observation for this step"
              >
                <Ionicons name="create-outline" size={15} color={IOS_COLORS.systemBlue} />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                onPress={() => onCapture('photo')}
                accessibilityRole="button"
                accessibilityLabel="Capture a photo for this step"
              >
                <Ionicons name="camera-outline" size={15} color={IOS_COLORS.systemBlue} />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                onPress={() => onCapture('voice')}
                accessibilityRole="button"
                accessibilityLabel="Capture a voice note for this step"
              >
                <Ionicons name="mic-outline" size={15} color={IOS_COLORS.systemBlue} />
              </Pressable>
            </>
          ) : null}
          {captureCount > 0 ? (
            <View style={styles.countBadge}>
              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              <Text style={styles.countText}>{captureCount}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
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
  richRow: {
    gap: 6,
    paddingVertical: 4,
  },
  refChips: {
    gap: 4,
    marginLeft: 22,
  },
  refChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  refGlyph: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 22,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: '#34C759',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
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
