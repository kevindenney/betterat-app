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
import {
  GRAY_3,
  GRAY_5,
  IOS_BLUE,
  IOS_CORAL,
  IOS_CORAL_DEEP,
  IOS_GREEN,
  IOS_GREEN_DEEP,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

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
  /** Optional unread-count badge rendered next to the Discussion tab label. */
  discussionCount?: number;
  testID?: string;
}

interface TabSpec {
  id: PhaseId;
  defaultLabel: string;
  state: PhaseState;
  badge?: number;
}

function Pip({ state }: { state: PhaseState }) {
  if (state === 'ready') {
    return <View style={[styles.pip, styles.pipFilled, { backgroundColor: IOS_GREEN }]} />;
  }
  if (state === 'live') {
    return <View style={[styles.pip, styles.pipFilled, { backgroundColor: IOS_CORAL }]} />;
  }
  return <View style={[styles.pip, styles.pipPending]} />;
}

function getUnderlineColor(state: PhaseState): string {
  if (state === 'live') return IOS_CORAL;
  if (state === 'ready') return IOS_GREEN;
  return IOS_BLUE;
}

function getActiveTextColor(state: PhaseState): string {
  if (state === 'live') return IOS_CORAL_DEEP;
  if (state === 'ready') return IOS_GREEN_DEEP;
  return IOS_BLUE;
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

  return (
    <View style={styles.rail} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {specs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onTabPress(tab.id)}
            style={styles.tab}
            hitSlop={4}
          >
            <View style={styles.pipHost}>
              <Pip state={tab.state} />
            </View>
            <Text
              style={[
                styles.label,
                isActive && { color: getActiveTextColor(tab.state) },
              ]}
            >
              {tab.defaultLabel}
            </Text>
            {tab.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
              </View>
            ) : null}
            {isActive ? (
              <View
                style={[
                  styles.underline,
                  { backgroundColor: getUnderlineColor(tab.state) },
                ]}
              />
            ) : null}
          </Pressable>
        );
        })}
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
    gap: 4,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 10,
    position: 'relative',
  },
  pipHost: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pipPending: {
    borderWidth: 1,
    borderColor: GRAY_3,
    backgroundColor: 'transparent',
  },
  pipFilled: {
    // filled disc — color set inline
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: LABEL_3,
    letterSpacing: -0.1,
  },
  underline: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    height: 1.5,
    borderRadius: 1.5,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: IOS_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
