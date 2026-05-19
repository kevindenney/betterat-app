/**
 * <StepCard> — full-bleed white card sitting on a gray-6 screen ground.
 *
 * Anatomy: `.card`, `.state-head`, `.card-scroll`, `.card-footer` in
 *          docs/redesign/ios-register/legacy-reskin-common.css.
 * Spec:    docs/redesign/ios-register/phase-0-shared-chrome.md (§ <StepCard>)
 *
 * Slots, top → bottom:
 *   1. State header band   — `pill` (StatePill) + optional ⋮ menu
 *   2. Step strip          — optional, sub-context band
 *   3. Title block         — optional, surface-specific content
 *   4. Below-title band    — optional, quiet sub-band beneath title (e.g. WITH row)
 *   5. Phase tabs          — optional, PhaseTabs row
 *   6. Body                — `children`, scrollable inside the card
 *   7. Footer              — optional, anchored to bottom of card
 *
 * Sizing is a relative flex layout (flex: 1) rather than absolute
 * positioning so the card adapts to whatever container hosts it (screen
 * with safe-area inset, debug route, future modal). The brief's
 * `left:14 right:14 top:64 bottom:84` numbers are imposed by the caller's
 * layout — e.g. by placing <TopHeader> (52pt) above and reserving the
 * tab bar (~84pt) below.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { GRAY_5, LABEL_3 } from '@/lib/design-tokens-step-loop-ios';
import type { PhaseTabsProps } from './PhaseTabs';
import type { StatePillProps } from './StatePill';
import type { StepStripProps } from './StepStrip';

export interface StepCardProps {
  /** Header band — required (StatePill instance). */
  pill: React.ReactElement<StatePillProps>;
  onMenuPress?: () => void;
  /** Optional sub-context band beneath the state header. */
  stepStrip?: React.ReactElement<StepStripProps>;
  /** Optional surface-specific title content (read-only or editable). */
  titleBlock?: React.ReactNode;
  /**
   * Optional band between the title block and the phase tabs. Phase 1 uses
   * this to host <WithRow> (D12b). The slot renders nothing when omitted.
   */
  belowTitle?: React.ReactNode;
  /** Optional phase tab row sitting above the body. */
  phaseTabs?: React.ReactElement<PhaseTabsProps>;
  /** Body content. Caller decides whether to wrap in a ScrollView. */
  children: React.ReactNode;
  /** Optional CTA strip pinned at the bottom of the card. */
  footer?: React.ReactNode;
  /** Optional style override (e.g. extra horizontal inset). */
  style?: ViewStyle;
  testID?: string;
}

export function StepCard({
  pill,
  onMenuPress,
  stepStrip,
  titleBlock,
  belowTitle,
  phaseTabs,
  children,
  footer,
  style,
  testID,
}: StepCardProps) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.stateHead}>
        <View style={styles.pillSlot}>{pill}</View>
        {onMenuPress ? (
          <Pressable
            onPress={onMenuPress}
            accessibilityRole="button"
            accessibilityLabel="More actions"
            hitSlop={8}
            style={styles.menuButton}
          >
            <MoreVertical size={17} color={LABEL_3} />
          </Pressable>
        ) : null}
      </View>

      {stepStrip}
      {titleBlock ? <View style={styles.titleBlock}>{titleBlock}</View> : null}
      {belowTitle}
      {phaseTabs}

      <View style={styles.body}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 14,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 18px 38px -16px rgba(0,0,0,0.20), 0 4px 10px -4px rgba(0,0,0,0.08)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 6,
      },
    }),
  },
  stateHead: {
    paddingTop: 13,
    paddingBottom: 12,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pillSlot: {
    flex: 1,
  },
  menuButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  titleBlock: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
});
