/**
 * GetInspiredRunningScreen — production-shaped iOS-register surface for
 * the Get Inspired modal's "building your plan" wait state.
 *
 * The canonical visual implementation of the cross-cutting Loading-state
 * Narration principle (IOS_MIGRATION_PLAN.md), scoped to the Get Inspired
 * pipeline. Pure presentational — no router calls, no preview-cycling, no
 * fixture defaults that could leak in production. Consumers pass real
 * `submittedUrl` and `onStop` handlers; the surface narrates the
 * pipeline stage via `activeIndex`.
 *
 * Two consumers:
 *   - `app/get-inspired-ios-running.tsx` — preview route. Mounts this
 *     component with fixture URL + auto-cycling activeIndex so the
 *     motion is visible in design review.
 *   - `components/inspiration/InspirationCaptureStep.tsx` — production
 *     wizard. Mounts this component with the user's real submitted URL
 *     and a real cancel handler.
 *
 * Production code MUST NOT import from the preview route — that pattern
 * produced the Reflect preview-component-in-production bug we just paid
 * to fix. See CUTOVER_PATTERN.md.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { LoadingNarration } from './LoadingNarration';

/**
 * The canonical narration sequence for Get Inspired. Each line is the
 * pipeline-stage's purpose expressed in plain present-continuous voice.
 * Exported so the preview route can drive auto-cycling against the same
 * line set.
 */
export const GET_INSPIRED_NARRATION_LINES: readonly string[] = [
  'Reading the link',
  'Finding the practice in it',
  'Pulling out the useful details',
  'Drafting your plan',
  'Shaping the first step',
];

/**
 * Stage durations (ms) — each stage holds 1.5–2.5s except the last one,
 * which holds slightly longer so the handoff to the plan-ready surface
 * doesn't feel rushed. Below 600ms the user reads it as a flicker, not a
 * status, so this floor is enforced. Exported for the preview route's
 * auto-cycling timer.
 */
export const GET_INSPIRED_STAGE_DURATIONS_MS: readonly number[] = [
  1800, 1600, 2200, 2400, 1800,
];

interface Props {
  /** The user's submitted URL or content reference (production: real input). */
  submittedUrl: string;
  /** Caller-owned abort handler. Wired to the real cancel flow in production. */
  onStop: () => void;
  /**
   * Hint that the surface is mounted inside another modal (e.g. the
   * production wizard). Reserved for future kit-variant adjustments;
   * currently does not change rendering. Defaults to false.
   */
  embedded?: boolean;
  /**
   * Active narration line index. Defaults to 0 because the production
   * extraction pipeline does not emit real progress events yet; the
   * preview route drives this via auto-cycling.
   */
  activeIndex?: number;
  /**
   * Estimate copy rendered under the actions area. Defaults to a generic
   * production-safe copy. The preview route overrides with a more
   * specific fixture string ("About 8 seconds left.").
   */
  estimateLabel?: string;
}

export function GetInspiredRunningScreen({
  submittedUrl,
  onStop,
  embedded: _embedded = false,
  activeIndex = 0,
  estimateLabel = 'Plan in progress. You can leave this open.',
}: Props) {
  const resolvedIndex = Math.max(
    0,
    Math.min(activeIndex, GET_INSPIRED_NARRATION_LINES.length - 1),
  );

  return (
    <View style={styles.modal}>
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <View style={styles.grabberRow}>
          <View style={styles.grabber} />
        </View>

        {/* Top-right Cancel is intentionally hidden in the running state;
            the stop affordance moves to the footer so it doesn't compete
            with the narration for attention. The grabber stays so the
            user can swipe-down to dismiss. */}
        <View style={styles.sheetChrome} />

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topStack}>
            <View style={styles.header}>
              <View style={styles.sparkleWrap}>
                <View style={styles.sparkleHalo} />
                <View style={styles.sparkle}>
                  <Ionicons
                    name="sparkles"
                    size={24}
                    color={IOS_REGISTER.accentMarkedContent}
                  />
                </View>
              </View>
              <Text style={styles.title}>Building your plan</Text>
              <Text style={styles.subtitle}>
                Reading what you sent and turning it into something you can
                practice.
              </Text>
            </View>

            <View style={styles.submitted}>
              <View style={styles.submittedIco}>
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color={IOS_REGISTER.labelSecondary}
                />
              </View>
              <View style={styles.submittedMeta}>
                <Text style={styles.submittedTop}>From your link</Text>
                <Text style={styles.submittedUrl} numberOfLines={1}>
                  {submittedUrl}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.progressCard}>
            <LoadingNarration
              microLabel="Working on this"
              lines={[...GET_INSPIRED_NARRATION_LINES]}
              activeIndex={resolvedIndex}
              stepMeta={`Step ${resolvedIndex + 1} of ${GET_INSPIRED_NARRATION_LINES.length}`}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.runningFoot}>
            <Text style={styles.estimateText}>
              <Text style={styles.estimateStrong}>
                {splitEstimate(estimateLabel).strong}
              </Text>
              {splitEstimate(estimateLabel).rest}
            </Text>
            <Pressable
              onPress={onStop}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Stop building plan"
            >
              <Text style={styles.stopText}>Stop</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Split the estimate label into a leading "X seconds left." segment and
 * a trailing supportive clause. Caller passes the joined string so
 * localization handles the period placement; this helper just splits on
 * the first period.
 */
function splitEstimate(label: string): { strong: string; rest: string } {
  const idx = label.indexOf('.');
  if (idx === -1) return { strong: label, rest: '' };
  return {
    strong: label.slice(0, idx + 1),
    rest: label.slice(idx + 1),
  };
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  safe: {
    flex: 1,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(60, 60, 67, 0.30)',
  },
  sheetChrome: {
    height: 12,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 16,
  },
  topStack: {
    gap: 16,
  },
  // ----- header -----
  header: {
    paddingHorizontal: 6,
    paddingBottom: 2,
  },
  sparkleWrap: {
    width: 44,
    height: 44,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleHalo: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 107, 0.35)',
  },
  sparkle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.accentMarkedContentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 31,
    letterSpacing: -0.5,
    color: IOS_REGISTER.label,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.34,
    color: IOS_REGISTER.labelSecondary,
  },
  // ----- submitted link card -----
  submitted: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  submittedIco: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  submittedMeta: {
    flex: 1,
    minWidth: 0,
  },
  progressCard: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.10)',
  },
  submittedTop: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 1,
  },
  submittedUrl: {
    fontSize: 14,
    letterSpacing: -0.1,
    color: IOS_REGISTER.label,
  },
  // ----- footer -----
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
    backgroundColor: 'rgba(248, 248, 250, 0.92)',
  },
  runningFoot: {
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  estimateText: {
    flex: 1,
    fontSize: 13,
    letterSpacing: -0.08,
    color: IOS_REGISTER.labelTertiary,
    lineHeight: 18,
  },
  estimateStrong: {
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '500',
  },
  stopText: {
    fontSize: 15,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
    paddingVertical: 6,
  },
});
