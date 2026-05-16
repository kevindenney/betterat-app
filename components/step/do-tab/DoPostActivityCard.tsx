import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DoCaptureItem } from './doCaptureModel';
import { sortCapturesNewestFirst, summarizeCaptureBreakdown } from './doCaptureModel';
import { DoActivityCompletePill } from './DoActivityCompletePill';
import { DoStepContextStrip } from './DoStepContextStrip';
import { DoAutoSummaryCard } from './DoAutoSummaryCard';
import { DoCaptureRow } from './DoCaptureRow';
import { DoMoveToReflectCTA } from './DoMoveToReflectCTA';
import { DoSecondaryActions } from './DoSecondaryActions';

const GRAY_5 = '#E5E5EA';
const LABEL = '#1C1C1E';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';
const LABEL_4 = 'rgba(60, 60, 67, 0.30)';

export interface DoPostActivityCardProps {
  /** Final captures shown in the frozen stream. */
  captures: DoCaptureItem[];
  /** Step title rendered in the quiet context strip. */
  stepTitle: string;
  /** Trailing context segments after the step title (e.g. ["Race 4", "finished"]). */
  contextSegments?: string[];
  /** Snapshot of elapsed ms at the moment Stop was tapped — drives the right stat. */
  elapsedMs: number;
  /** Optional final stat number override (defaults to non-marker capture count). */
  captureCount?: number;
  /** Pre-written auto-summary narrative; falls back to no narrative when absent. */
  summaryText?: string;
  /** Step-context chip rendered to the right of the summary eyebrow. */
  summaryStepChipLabel?: string;
  /** When true the CTAs and secondary actions are disabled. */
  readOnly?: boolean;
  /** Now-anchor for relative-ago labels; pass for deterministic tests. */
  nowMs?: number;
  /** Voice-play callback forwarded to each voice capture row. */
  onPressPlayVoice?: (captureId: string) => void;
  /** Primary CTA — moves the user to the Reflect tab. */
  onMoveToReflect?: () => void;
  /** Sparkle button callback — open the refine-summary surface. */
  onRefineSummary?: () => void;
  /** Secondary additive action — re-opens the capture stream. */
  onAddAnotherCapture?: () => void;
  /** Secondary destructive action — drops the activity (long-press confirmation lives upstream). */
  onDiscardActivity?: () => void;
  /** Open the Mark-as-evidence sheet for the tapped capture. Hidden when omitted. */
  onMarkAsEvidence?: (captureId: string) => void;
}

/**
 * Phase B.7 · Frame 3 · Post-activity card.
 *
 * Composes the activity-complete pill, step-context strip, auto-summary
 * card, the now-frozen reverse-chronological capture stream, and the
 * primary Move-to-Reflect CTA with two quiet secondary actions. The
 * capture rows reuse {@link DoCaptureRow} from Frame 2 with the
 * `frozen` prop set so the topmost row drops the warm wash and any
 * coral chips collapse to the neutral gray-6 variant.
 */
export function DoPostActivityCard({
  captures,
  stepTitle,
  contextSegments,
  elapsedMs,
  captureCount,
  summaryText,
  summaryStepChipLabel,
  readOnly,
  nowMs,
  onPressPlayVoice,
  onMoveToReflect,
  onRefineSummary,
  onAddAnotherCapture,
  onDiscardActivity,
  onMarkAsEvidence,
}: DoPostActivityCardProps) {
  const ordered = sortCapturesNewestFirst(captures);
  const breakdown = summarizeCaptureBreakdown(ordered);
  const nonMarkerCount =
    captureCount ?? ordered.reduce((acc, c) => acc + (c.kind === 'time_marker' ? 0 : 1), 0);

  return (
    <View style={styles.wrap} accessibilityLabel="Do — post-activity">
      <View style={styles.card}>
        <View style={styles.doneHead}>
          <DoActivityCompletePill />
          <View style={styles.stats} accessibilityLabel="Final stats">
            <Stat num={String(nonMarkerCount)} label="Captures" />
            <View style={styles.statsSep} />
            <Stat num={formatStat(elapsedMs)} label="Elapsed" />
          </View>
        </View>

        <DoStepContextStrip stepTitle={stepTitle} contextSegments={contextSegments} />

        <DoAutoSummaryCard
          captures={ordered}
          narrative={summaryText}
          stepChipLabel={summaryStepChipLabel}
          onRefineSummary={onRefineSummary}
        />

        <View style={styles.streamWrap}>
          <View style={styles.streamEyebrow}>
            <Text style={styles.streamEyebrowLbl}>
              <Text style={styles.streamEyebrowArrow}>↓ </Text>
              NEWEST FIRST
            </Text>
            {ordered.length > 0 ? (
              <Text style={styles.streamTotal}>
                <Text style={styles.streamTotalEm}>{nonMarkerCount}</Text>
                {' captures'}
                {breakdown.marker > 0 ? (
                  <>
                    <Text> · </Text>
                    <Text style={styles.streamTotalEm}>{breakdown.marker}</Text>
                    <Text> {breakdown.marker === 1 ? 'marker' : 'markers'}</Text>
                  </>
                ) : null}
              </Text>
            ) : null}
          </View>

          {ordered.length === 0 ? (
            <View style={styles.emptyStream}>
              <Text style={styles.emptyStreamText}>
                No captures from this activity.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.stream}
              contentContainerStyle={styles.streamContent}
              showsVerticalScrollIndicator={false}
            >
              {ordered.map((c) => (
                <DoCaptureRow
                  key={c.id}
                  capture={c}
                  frozen
                  nowMs={nowMs}
                  onPressPlayVoice={onPressPlayVoice}
                  onMarkAsEvidence={readOnly ? undefined : onMarkAsEvidence}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <DoMoveToReflectCTA onPress={onMoveToReflect} disabled={readOnly} />
      </View>

      <View style={styles.secondaryWrap}>
        <DoSecondaryActions
          onAddAnotherCapture={onAddAnotherCapture}
          onDiscardActivity={onDiscardActivity}
          readOnly={readOnly}
        />
      </View>
    </View>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function formatStat(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  card: {
    // No `flex: 1` — the card sizes to its intrinsic content so the
    // Move-to-Reflect CTA and secondary actions below render at their
    // natural heights in any parent (ScrollView, tab container, etc.).
    // Frame 2's DoLiveCard can use flex: 1 because composer + Stop CTA
    // live inside its card; Frame 3 places the CTA outside per the
    // canonical, which exposed the flex collapse inside RaceSummaryCard's
    // ScrollView phase content.
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  doneHead: {
    paddingTop: 13,
    paddingRight: 18,
    paddingBottom: 12,
    paddingLeft: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  stat: {
    alignItems: 'flex-end',
  },
  statNum: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: LABEL,
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
  statLbl: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: LABEL_3,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  statsSep: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: GRAY_5,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  streamWrap: {
    // Intrinsic height — paired with `card` not using flex: 1 so the
    // CTA + secondary actions below the card always render fully.
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  streamEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
    marginHorizontal: 4,
    marginBottom: 6,
  },
  streamEyebrowLbl: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.7,
    color: LABEL_3,
  },
  streamEyebrowArrow: {
    color: LABEL_4,
  },
  streamTotal: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: LABEL_3,
    fontVariant: ['tabular-nums'],
  },
  streamTotalEm: {
    color: LABEL,
  },
  stream: {
    // No `flex: 1` — pairs with the card's intrinsic sizing so the
    // CTA + secondary actions below the card always render.
  },
  streamContent: {
    gap: 10,
    paddingBottom: 8,
  },
  emptyStream: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyStreamText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: LABEL_3,
    textAlign: 'center',
  },
  ctaWrap: {
    // Canonical insets the CTA at left/right 14 (anatomy callout F).
    paddingTop: 12,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
    // DEBUG: temporary magenta background to confirm the wrap is
    // rendering at non-zero height. Remove once Move-to-Reflect renders.
    backgroundColor: 'magenta',
    minHeight: 80,
  },
  secondaryWrap: {
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
  },
});
