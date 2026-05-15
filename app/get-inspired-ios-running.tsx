/**
 * Get Inspired — iOS register · running state preview
 *
 * Third state of the Get Inspired modal (after empty CTA and filled CTA):
 * shown while BetterAt actively builds a plan from the user's submitted
 * link, during the Claude API call (typically 4–12 seconds).
 *
 * This is the **canonical visual treatment of the "Loading-state narration"
 * cross-cutting principle** in docs/redesign/IOS_MIGRATION_PLAN.md. Every
 * future AI-work loading state in BetterAt inherits from this surface.
 * Reference pattern: OpenAI ChatGPT plan-ready flow.
 *
 * What this preview shows:
 *   - Sparkle header with running halo (coral ring around the rounded sparkle)
 *   - "Building your plan" title + supporting copy
 *   - Submitted-link reference card (the user's URL, demoted so they stay
 *     oriented but no longer beg for re-edit)
 *   - LoadingNarration block — the five-step pipeline, mid-transition
 *     (third of five active)
 *   - Footer: estimate + quiet "Stop" affordance (no CTA in running state)
 *
 * Wire-up: visual-only preview. The actual fetch/analyze/build-plan pipeline
 * is a separate Phase 5+ service; this surface only renders the visual
 * grammar for that pipeline's progress.
 *
 * Open at /get-inspired-ios-running.
 */

import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { LoadingNarration } from '@/components/ios-register';

/**
 * The canonical narration sequence for Get Inspired. Each line is the
 * pipeline-stage's purpose expressed in plain present-continuous voice.
 * See the design's "narration sequence, in order" rail block for the why
 * behind each line.
 */
const NARRATION_LINES = [
  'Reading the link',
  'Finding the practice in it',
  'Pulling out the useful details',
  'Drafting your plan',
  'Shaping the first step',
];

/**
 * Stage timings (ms) — each stage holds 1.5–2.5s except the last one,
 * which holds slightly longer so the handoff to the plan-ready surface
 * doesn't feel rushed. Below 600ms the user reads it as a flicker, not a
 * status, so this floor is enforced.
 */
const STAGE_DURATIONS_MS = [1800, 1600, 2200, 2400, 1800];

interface Props {
  /**
   * When embedded in the real flow (after wiring), the parent controls
   * which line is active based on the actual pipeline stage. The preview
   * route advances on its own timer so reviewers can see the motion.
   */
  embedded?: boolean;
  /** Override the active stage when embedded. Ignored in preview mode. */
  activeIndex?: number;
  /** Override the user-submitted link in preview mode. */
  submittedUrl?: string;
  /** Override the estimated time-remaining string. */
  estimateLabel?: string;
  /** Caller wires the actual abort when embedded. */
  onStop?: () => void;
}

export default function GetInspiredIosRunningPreview(props: Props = {}) {
  const {
    embedded = false,
    activeIndex,
    submittedUrl = 'sailingworld.com/heavy-air-starts-andrew-campbell',
    estimateLabel = 'About 8 seconds left. You can leave this open.',
    onStop,
  } = props;

  // Preview-mode auto-advance — cycles the active index so reviewers can
  // see the line replacement motion without wiring the real pipeline.
  const [previewIndex, setPreviewIndex] = useState(2);
  useEffect(() => {
    if (embedded) return;
    const duration = STAGE_DURATIONS_MS[previewIndex] ?? 1800;
    const handle = setTimeout(() => {
      setPreviewIndex((i) => (i + 1) % NARRATION_LINES.length);
    }, duration);
    return () => clearTimeout(handle);
  }, [embedded, previewIndex]);

  const resolvedIndex = embedded
    ? Math.max(0, Math.min(activeIndex ?? 0, NARRATION_LINES.length - 1))
    : previewIndex;

  return (
    <View style={styles.modal}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <View style={styles.grabberRow}>
          <View style={styles.grabber} />
        </View>

        {/* Top-right Cancel is intentionally hidden in the running state;
            the stop affordance moves to the footer so it doesn't compete
            with the narration for attention. The grabber stays so the user
            can swipe-down to dismiss. */}
        <View style={styles.sheetChrome} />

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
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

          <LoadingNarration
            microLabel="Working on this"
            lines={NARRATION_LINES}
            activeIndex={resolvedIndex}
            stepMeta={`Step ${resolvedIndex + 1} of ${NARRATION_LINES.length}`}
          />
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.runningFoot}>
            <Text style={styles.estimateText}>
              <Text style={styles.estimateStrong}>{splitEstimate(estimateLabel).strong}</Text>
              {splitEstimate(estimateLabel).rest}
            </Text>
            <Pressable
              onPress={() => {
                if (onStop) {
                  onStop();
                  return;
                }
                if (!embedded) {
                  if (router.canGoBack()) router.back();
                }
              }}
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
 * Split the estimate label into a leading "About 8 seconds left." segment
 * and a trailing supportive clause. The leading half is rendered in a
 * stronger ink; the trailing half stays tertiary. Caller passes the joined
 * string so localization handles the period placement; this helper just
 * splits on the first period.
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
    height: 24,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  // ----- header -----
  header: {
    paddingHorizontal: 4,
    paddingBottom: 24,
  },
  sparkleWrap: {
    width: 44,
    height: 44,
    marginBottom: 18,
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
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 33,
    letterSpacing: -0.42,
    color: IOS_REGISTER.label,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.34,
    color: IOS_REGISTER.labelSecondary,
  },
  // ----- submitted link card -----
  submitted: {
    marginTop: 4,
    marginBottom: 24,
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
    paddingTop: 18,
    paddingBottom: 28,
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

// Keep IOS_COLORS import referenced in case future variants need raw HIG
// tokens (haptic disabled state, etc.); explicit suppression so the lint
// rule doesn't flag a token boundary import.
void IOS_COLORS;
