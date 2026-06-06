/**
 * <PhaseTabs> — Plan / Do / Reflect tabs with ready / pending / live pips.
 *
 * Anatomy: `.phase-tabs` in docs/redesign/ios-register/legacy-reskin-common.css
 *          (target variant in step-loop-integration-canonical.html).
 * Spec:    docs/redesign/ios-register/phase-0-shared-chrome.md (§ <PhaseTabs>)
 * Refinements: docs/redesign/ios-register/phase-1-refinements.md (§ D27)
 *
 * Each tab carries a left-aligned 14×14 hit area with a 6px pip conveying
 * phase state:
 *   pending → gray-3 outline pip (hollow)
 *   ready   → iOS-green filled pip
 *   live    → iOS-coral filled pip
 *
 * The active tab gets a 1.5px underline coloured by its phase:
 *   plan/do (default) → ios-blue
 *   active+live       → ios-coral
 *   active+ready+done → ios-green
 *
 * The component is presentational: state and active flow are owned by the
 * caller via `active` + `onTabPress`.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import {
  GRAY_3,
  GRAY_5,
  IOS_GREEN,
  IOS_PURPLE,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';
import { STEP_STATE, REFLECT } from '@/lib/design-tokens-ios';

/**
 * Per-phase signal colors (redesign §11 "color is signal"). The active stage
 * is the only saturated element in the row: Plan indigo, Do amber, Review clay.
 */
const PHASE_COLORS: Record<'plan' | 'do' | 'reflect', { base: string; tint: string; ink: string }> = {
  plan: { base: STEP_STATE.plan, tint: STEP_STATE.planTint, ink: STEP_STATE.planInk },
  do: { base: STEP_STATE.do, tint: STEP_STATE.doTint, ink: STEP_STATE.doInk },
  reflect: { base: REFLECT.base, tint: REFLECT.tint, ink: REFLECT.ink },
};

function phaseColors(id: PhaseId) {
  return PHASE_COLORS[id === 'discussion' ? 'plan' : id];
}

export type PhaseState = 'pending' | 'ready' | 'live';
export type PhaseId = 'plan' | 'do' | 'reflect' | 'discussion';

export interface PhaseTabsProps {
  plan: PhaseState;
  do: PhaseState;
  reflect: PhaseState;
  /**
   * Optional 4th Discussion tab. When omitted, only Plan / Do / Reflect
   * render — preserves backwards compatibility for surfaces that don't have
   * a subscribed-blueprint discussion thread.
   */
  discussion?: PhaseState;
  active: PhaseId;
  onTabPress: (tab: PhaseId) => void;
  /** Optional override labels (defaults to "Plan" / "Do" / "Reflect" / "Discussion"). */
  labels?: Partial<Record<PhaseId, string>>;
  /** Optional count badge rendered in the Discussion thread bubble. */
  discussionCount?: number;
  testID?: string;
}

interface TabSpec {
  id: PhaseId;
  defaultLabel: string;
  state: PhaseState;
  badge?: number;
}

type PipVariant = 'done' | 'todo' | 'active' | 'live';

function Pip({ variant, index, id }: { variant: PipVariant; index: number; id: PhaseId }) {
  if (variant === 'done') {
    return (
      <View style={[styles.pip, styles.pipDone]}>
        <Text style={styles.pipReadyText}>✓</Text>
      </View>
    );
  }
  if (variant === 'active' || variant === 'live') {
    return (
      <View style={[styles.pip, { backgroundColor: phaseColors(id).base }]}>
        <Text style={styles.pipNumber}>{index}</Text>
      </View>
    );
  }
  return <View style={[styles.pip, styles.pipPending]} />;
}

export function PhaseTabs({
  plan,
  do: doState,
  reflect,
  discussion,
  active,
  onTabPress,
  labels,
  discussionCount,
  testID,
}: PhaseTabsProps) {
  const specs: TabSpec[] = [
    { id: 'plan', defaultLabel: labels?.plan ?? 'Plan', state: plan },
    { id: 'do', defaultLabel: labels?.do ?? 'Do', state: doState },
    { id: 'reflect', defaultLabel: labels?.reflect ?? 'Reflect', state: reflect },
  ];
  if (discussion !== undefined) {
    specs.push({
      id: 'discussion',
      defaultLabel: labels?.discussion ?? 'Discuss',
      state: discussion,
      badge: discussionCount && discussionCount > 0 ? discussionCount : undefined,
    });
  }
  const lifecycleSpecs = specs.filter((tab) => tab.id !== 'discussion');
  const discussionSpec = specs.find((tab) => tab.id === 'discussion');

  return (
    <View style={styles.rail} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <View style={styles.lifecycleRow}>
          {lifecycleSpecs.map((tab, index) => {
            const isActive = tab.id === active;
            const variant: PipVariant = isActive
              ? 'active'
              : tab.state === 'ready'
                ? 'done'
                : tab.state === 'live'
                  ? 'live'
                  : 'todo';
            const phase = phaseColors(tab.id);
            return (
              <View key={tab.id} style={styles.lifecycleSegment}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => onTabPress(tab.id)}
                  style={[
                    styles.tab,
                    isActive && { backgroundColor: phase.tint },
                  ]}
                  hitSlop={4}
                >
                  <View style={styles.pipHost}>
                    <Pip variant={variant} index={index + 1} id={tab.id} />
                  </View>
                  <Text
                    style={[
                      styles.label,
                      isActive && { color: phase.ink },
                      variant === 'done' && styles.labelDone,
                      variant === 'live' && { color: phase.ink },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.defaultLabel}
                  </Text>
                </Pressable>
                {index < lifecycleSpecs.length - 1 ? (
                  <ChevronRight
                    size={16}
                    color={GRAY_3}
                    strokeWidth={2.4}
                    style={styles.connector}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
        {discussionSpec ? (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={`${discussionSpec.defaultLabel} thread${
              discussionSpec.badge ? `, ${discussionSpec.badge} updates` : ''
            }`}
            accessibilityState={{ selected: active === 'discussion' }}
            onPress={() => onTabPress('discussion')}
            style={[
              styles.discussionChip,
              active === 'discussion' && styles.discussionChipActive,
            ]}
            hitSlop={4}
          >
            <MessageCircle
              size={15}
              color={active === 'discussion' ? IOS_PURPLE : LABEL_3}
              strokeWidth={2.2}
            />
            {discussionSpec.badge ? (
              <View style={styles.discussionBadge}>
                <Text style={styles.discussionBadgeText}>
                  {discussionSpec.badge > 99 ? '99+' : discussionSpec.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lifecycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lifecycleSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  pipHost: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pip: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipPending: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: GRAY_3,
    backgroundColor: 'transparent',
  },
  pipDone: {
    backgroundColor: IOS_GREEN,
  },
  pipReadyText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
  },
  pipNumber: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: LABEL_3,
    letterSpacing: 0,
  },
  labelDone: {
    color: 'rgba(60, 60, 67, 0.62)',
  },
  connector: {
    marginHorizontal: 1,
  },
  discussionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 28,
    minWidth: 32,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: '#F7F7FA',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  discussionChipActive: {
    backgroundColor: 'rgba(88, 86, 214, 0.10)',
    borderColor: 'rgba(88, 86, 214, 0.28)',
  },
  discussionBadge: {
    minWidth: 17,
    height: 17,
    paddingHorizontal: 5,
    borderRadius: 8.5,
    backgroundColor: IOS_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
