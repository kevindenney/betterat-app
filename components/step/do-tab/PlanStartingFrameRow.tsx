import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { BeforeShiftItem } from '@/components/step/v2/plan/BeforeTheShiftCard';
import type { StepPlanData, SubStep } from '@/types/step-detail';
import type { DoCaptureItem } from './doCaptureModel';
import { RowAnnotations, RowPlusButton, type SubStepCaptureKind } from './RowAnnotations';

export type { SubStepCaptureKind };

interface PlanStartingFrameRowProps {
  planData: StepPlanData;
  readOnly?: boolean;
  /** When provided, the How list renders as a tap-to-check checklist. */
  onToggleSubStep?: (subStepId: string, completed: boolean) => void;
  /** Library items pinned to each How sub-step, keyed by sub-step id. */
  subStepRefs?: Record<string, BeforeShiftItem[]>;
  /** Open a pinned library item's resource viewer. */
  onOpenLibraryRef?: (libraryItemId: string) => void;
  /** Pin a library item to a specific How sub-step (opens the picker). */
  onAttachLibrary?: (subStepId: string) => void;
  /** Unpin a library item from a How sub-step (step_library_before row id). */
  onRemoveLibraryRef?: (rowId: string) => void;
  /** Capture an observation / photo / voice note against a How sub-step. */
  onSubStepCapture?: (subStepId: string, kind: SubStepCaptureKind) => void;
  /** Captures already logged against each sub-step, newest-first, keyed by id. */
  subStepCaptures?: Record<string, DoCaptureItem[]>;
  /** Show the Who + Why sections. Off on the Do tab (How is the focus there). */
  showWhoWhy?: boolean;
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
  readOnly,
  onToggleSubStep,
  subStepRefs,
  onOpenLibraryRef,
  onAttachLibrary,
  onRemoveLibraryRef,
  onSubStepCapture,
  subStepCaptures,
  showWhoWhy = true,
}: PlanStartingFrameRowProps) {
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
          <Text style={styles.sub}>
            {showWhoWhy
              ? 'What, how, who, and why before you capture evidence.'
              : 'Work through each step — pin references or capture evidence as you go.'}
          </Text>
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
                captures={subStepCaptures?.[step.id] ?? []}
                onToggle={() => onToggleSubStep?.(step.id, !step.completed)}
                onOpenLibraryRef={onOpenLibraryRef}
                onRemoveLibraryRef={onRemoveLibraryRef}
                onAttachLibrary={onAttachLibrary ? () => onAttachLibrary(step.id) : undefined}
                onCapture={
                  onSubStepCapture ? (kind) => onSubStepCapture(step.id, kind) : undefined
                }
              />
            ))}
          </View>
          {showWhoWhy ? (
            <View style={styles.section}>
              <Text style={styles.label}>Who</Text>
              {collaborators.map((person, index) => (
                <Text key={`${person}-${index}`} style={styles.bullet} numberOfLines={2}>
                  {person}
                </Text>
              ))}
            </View>
          ) : null}
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
          {showWhoWhy ? (
            <View style={styles.sectionHalf}>
              <Text style={styles.label}>Who</Text>
              {collaborators.map((person, index) => (
                <Text key={`${person}-${index}`} style={styles.bullet} numberOfLines={2}>
                  {person}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      )}

      {showWhoWhy ? (
        <View style={styles.section}>
          <Text style={styles.label}>Why</Text>
          <Text style={styles.body}>{why}</Text>
        </View>
      ) : null}
    </View>
  );
}

interface RichHowRowProps {
  step: SubStep;
  readOnly?: boolean;
  refs: BeforeShiftItem[];
  captures: DoCaptureItem[];
  onToggle: () => void;
  onOpenLibraryRef?: (libraryItemId: string) => void;
  onRemoveLibraryRef?: (rowId: string) => void;
  onAttachLibrary?: () => void;
  onCapture?: (kind: SubStepCaptureKind) => void;
}

function RichHowRow({
  step,
  readOnly,
  refs,
  captures,
  onToggle,
  onOpenLibraryRef,
  onRemoveLibraryRef,
  onAttachLibrary,
  onCapture,
}: RichHowRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = !readOnly && Boolean(onAttachLibrary || onCapture);

  return (
    <View style={styles.richRow}>
      <View style={styles.richHead}>
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

        {hasMenu ? (
          <RowPlusButton open={menuOpen} onPress={() => setMenuOpen((v) => !v)} />
        ) : null}
      </View>

      <RowAnnotations
        readOnly={readOnly}
        menuOpen={menuOpen}
        onCloseMenu={() => setMenuOpen(false)}
        refs={refs}
        captures={captures}
        onOpenLibraryRef={onOpenLibraryRef}
        onRemoveLibraryRef={onRemoveLibraryRef}
        onAttachLibrary={onAttachLibrary}
        onCapture={onCapture}
      />
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
  richHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
});
