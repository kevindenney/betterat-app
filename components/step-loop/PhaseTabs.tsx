/**
 * <PhaseTabs> — Plan / Do / Reflect tabs with ready / pending / live rings.
 *
 * Anatomy: `.phase-tabs` in docs/redesign/ios-register/legacy-reskin-common.css
 *          (target variant in step-loop-integration-canonical.html).
 * Spec:    docs/redesign/ios-register/phase-0-shared-chrome.md (§ <PhaseTabs>)
 *
 * Each tab carries a left-aligned 14×14 ring conveying phase state:
 *   pending → dashed gray-3 border (hollow)
 *   ready   → filled iOS-green disc + white check rotated -45°
 *   live    → filled iOS-coral disc + white center dot
 *
 * The active tab gets a 2px underline coloured by its phase:
 *   plan/do (default) → ios-blue
 *   active+live       → ios-coral
 *   active+ready+done → ios-green
 *
 * The component is presentational: state and active flow are owned by the
 * caller via `active` + `onTabPress`.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
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
export type PhaseId = 'plan' | 'do' | 'reflect';

export interface PhaseTabsProps {
  plan: PhaseState;
  do: PhaseState;
  reflect: PhaseState;
  active: PhaseId;
  onTabPress: (tab: PhaseId) => void;
  /** Optional override labels (defaults to "Plan" / "Do" / "Reflect"). */
  labels?: Partial<Record<PhaseId, string>>;
  testID?: string;
}

interface TabSpec {
  id: PhaseId;
  defaultLabel: string;
  state: PhaseState;
}

function Ring({ state }: { state: PhaseState }) {
  if (state === 'ready') {
    return (
      <View style={[styles.ring, styles.ringFilled, { backgroundColor: IOS_GREEN }]}>
        <Check size={9} color="#FFFFFF" strokeWidth={3} />
      </View>
    );
  }
  if (state === 'live') {
    return (
      <View style={[styles.ring, styles.ringFilled, { backgroundColor: IOS_CORAL }]}>
        <View style={styles.liveDot} />
      </View>
    );
  }
  return <View style={[styles.ring, styles.ringPending]} />;
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
  active,
  onTabPress,
  labels,
  testID,
}: PhaseTabsProps) {
  const specs: TabSpec[] = [
    { id: 'plan', defaultLabel: labels?.plan ?? 'Plan', state: plan },
    { id: 'do', defaultLabel: labels?.do ?? 'Do', state: doState },
    { id: 'reflect', defaultLabel: labels?.reflect ?? 'Reflect', state: reflect },
  ];

  return (
    <View style={styles.row} testID={testID}>
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
            <Ring state={tab.state} />
            <Text
              style={[
                styles.label,
                isActive && {
                  color: getActiveTextColor(tab.state),
                  fontWeight: '600',
                },
              ]}
            >
              {tab.defaultLabel}
            </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 10,
    position: 'relative',
  },
  ring: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPending: {
    borderWidth: 1.5,
    borderColor: GRAY_3,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  ringFilled: {
    // filled disc — children render the glyph/dot
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LABEL_3,
    letterSpacing: -0.1,
  },
  underline: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    height: 2,
    borderRadius: 2,
  },
});
