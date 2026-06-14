/**
 * StepCompleteCelebration — Phase 10 PR-4 §A-phase-6 step-complete moment.
 *
 * Replaces the regular Plan/Do/Reflect/Discussion tab body when a step from a
 * subscribed blueprint is marked complete. Per the canonical Saturday-evening
 * scene:
 *
 *   • STEP N · CLOSED  eyebrow (replaces CURRENT STEP)
 *   • Trophy disc       (green circle, white trophy icon)
 *   • Italic-quoted step name: "Boat-speed baseline — done."
 *   • Session summary:  "5 sessions captured · target met on all four points"
 *   • Capability ring + delta line:
 *       "Capability · Boat speed / +22% this step · 75% to Worlds-ready"
 *     [Capability deltas come from the capability model when wired; until
 *      then we render only the rows we can derive: session count + fleet
 *      position.]
 *   • Fleet position row: "In the fleet · 2 ahead · 12 alongside · 19 catching up"
 *   • UP NEXT · WEEK N strip
 *   • Big "Continue to Step N+1 →" CTA
 *
 * No actions on the screen are irreversible — the back button takes the user
 * to the tab they were on before completion, and Continue queues + selects
 * the next step.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Trophy, Users } from 'lucide-react-native';
import { fontFamily } from '@/lib/design-tokens-editorial';

export interface StepCompleteCelebrationProps {
  /**
   * 'blueprint' — full cohort-shaped moment (fleet position + continue-to-next).
   * 'solo' — a plain step with no blueprint behind it: trophy + quoted title
   * only, dismissed back to the step's tabs. Defaults to 'blueprint'.
   */
  variant?: 'blueprint' | 'solo';
  /** Step number among the blueprint (1-indexed). */
  stepNumber: number | null;
  totalSteps: number | null;
  /** Step title to render inside italic quotes. */
  stepTitle: string;
  /** Number of distinct capture sessions logged on this step. */
  sessionCount: number;
  fleet: {
    ahead: number;
    sameStep: number;
    behind: number;
  };
  next: {
    stepNumber: number;
    title: string;
  } | null;
  /**
   * True while celebration data is still loading. When true we render the
   * trophy hero + stats but suppress the "BLUEPRINT COMPLETE" message so
   * users on mid-blueprint steps don't see a wrong "you finished it all".
   */
  isLoadingNext?: boolean;
  onContinue?: () => void;
  isContinuing?: boolean;
  /**
   * Interest-native word for the cohort moving through the blueprint together
   * ("fleet" for sailing, "group"/"cohort" elsewhere). Rendered as
   * "In the {groupLabel}". Defaults to "group".
   */
  groupLabel?: string;
  /** Dismiss the celebration back to the step's tabs. */
  onDismiss?: () => void;
}

export function StepCompleteCelebration({
  variant = 'blueprint',
  stepNumber,
  totalSteps,
  stepTitle,
  sessionCount,
  fleet,
  next,
  isLoadingNext,
  onContinue,
  isContinuing,
  groupLabel = 'group',
  onDismiss,
}: StepCompleteCelebrationProps) {
  const isSolo = variant === 'solo';
  const positionLabel =
    stepNumber != null && totalSteps != null
      ? `STEP ${stepNumber} · CLOSED`
      : 'STEP CLOSED';
  const upNextEyebrow = next
    ? `UP NEXT · STEP ${next.stepNumber} OF ${totalSteps ?? '?'}`
    : null;
  const sessionLabel = `${sessionCount} ${
    sessionCount === 1 ? 'session captured' : 'sessions captured'
  }`;
  const trophyOuterEyebrow =
    stepNumber != null && totalSteps != null
      ? `STEP COMPLETE · ${stepNumber} OF ${totalSteps}`
      : 'STEP COMPLETE';

  return (
    <View style={styles.wrap}>
      <Text style={styles.topEyebrow}>{trophyOuterEyebrow}</Text>

      <View style={styles.heroCard}>
        <View style={styles.trophyHalo}>
          <View style={styles.trophyDisc}>
            <Trophy size={26} color="#FFFFFF" strokeWidth={2} />
          </View>
        </View>
        <Text style={styles.closedEyebrow}>{positionLabel}</Text>
        <Text style={styles.stepTitleQuoted}>
          {`"${stepTitle.trim().replace(/[.!?]*$/, '')} — done."`}
        </Text>
        {sessionCount > 0 ? (
          <Text style={styles.sessionLine}>{sessionLabel}</Text>
        ) : null}
      </View>

      {isSolo ? (
        <Pressable
          style={({ pressed }) => [
            styles.continueBtn,
            pressed && styles.continueBtnPressed,
          ]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.continueLbl}>Done</Text>
        </Pressable>
      ) : (
        <>
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <Users size={14} color={C.label2} />
          <Text style={styles.statsLabel}>In the {groupLabel}</Text>
        </View>
        <View style={styles.fleetGrid}>
          <FleetStat num={fleet.ahead} label="ahead" tone="muted" />
          <View style={styles.fleetDivider} />
          <FleetStat num={fleet.sameStep} label="alongside" tone="bold" />
          <View style={styles.fleetDivider} />
          <FleetStat num={fleet.behind} label="catching up" tone="muted" />
        </View>
      </View>

      {next ? (
        <View style={styles.upNextCard}>
          {upNextEyebrow ? <Text style={styles.upNextEyebrow}>{upNextEyebrow}</Text> : null}
          <Text style={styles.upNextTitle}>{next.title}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              pressed && styles.continueBtnPressed,
              isContinuing && styles.continueBtnDisabled,
            ]}
            onPress={isContinuing ? undefined : onContinue}
            disabled={isContinuing}
            accessibilityRole="button"
            accessibilityLabel={`Continue to Step ${next.stepNumber}`}
          >
            {isContinuing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueLbl}>Continue to Step {next.stepNumber}</Text>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.2} />
              </>
            )}
          </Pressable>
        </View>
      ) : isLoadingNext ? (
        <View style={styles.upNextCard}>
          <Text style={styles.upNextEyebrow}>UP NEXT</Text>
          <ActivityIndicator size="small" color={C.label3} />
        </View>
      ) : (
        <View style={styles.upNextCard}>
          <Text style={styles.upNextEyebrow}>BLUEPRINT COMPLETE</Text>
          <Text style={styles.upNextTitle}>
            You worked through every step in this blueprint.
          </Text>
        </View>
      )}
      {onDismiss ? (
        <Pressable
          style={styles.dismissBtn}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Back to step"
        >
          <Text style={styles.dismissLbl}>Back to step</Text>
        </Pressable>
      ) : null}
        </>
      )}
    </View>
  );
}

function FleetStat({
  num,
  label,
  tone,
}: {
  num: number;
  label: string;
  tone: 'bold' | 'muted';
}) {
  return (
    <View style={styles.fleetStat}>
      <Text style={[styles.fleetNum, tone === 'bold' && styles.fleetNumBold]}>
        {num}
      </Text>
      <Text style={styles.fleetLbl}>{label}</Text>
    </View>
  );
}

const C = {
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  line: '#E5E5EA',
  gray6: '#F2F2F7',
  blue: '#007AFF',
  blueTint: '#E6F0FF',
  greenDeep: '#0A6B2A',
  green: '#34C759',
  greenSoft: '#B7E8C2',
  greenTint: '#E8F8EC',
  card: '#FFFFFF',
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  topEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: C.greenDeep,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  heroCard: {
    backgroundColor: C.greenTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.greenSoft,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 10,
  },
  trophyHalo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.green,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  trophyDisc: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: C.greenDeep,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  stepTitleQuoted: {
    fontFamily: fontFamily.serif,
    fontSize: 19,
    fontStyle: 'italic',
    color: C.label,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: -0.2,
    paddingHorizontal: 4,
  },
  sessionLine: {
    fontSize: 13,
    color: C.label2,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  statsCard: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.label2,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fleetGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.gray6,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  fleetStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  fleetNum: {
    fontSize: 18,
    fontWeight: '600',
    color: C.label2,
    letterSpacing: -0.4,
  },
  fleetNumBold: {
    fontWeight: '700',
    color: C.label,
    fontSize: 22,
  },
  fleetLbl: {
    fontSize: 11,
    color: C.label3,
    letterSpacing: -0.05,
  },
  fleetDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: C.line,
  },
  upNextCard: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 10,
  },
  upNextEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: C.blue,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  upNextTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.blue,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  continueBtnPressed: {
    opacity: 0.85,
  },
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueLbl: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  dismissBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  dismissLbl: {
    fontSize: 14,
    fontWeight: '500',
    color: C.label3,
    letterSpacing: -0.1,
  },
});
