import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DoCaptureItem } from './doCaptureModel';
import { summarizeCaptureBreakdown } from './doCaptureModel';

const IOS_BLUE = '#007AFF';
const GRAY_1 = '#8E8E93';
const GRAY_5 = '#E5E5EA';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';
const LABEL_4 = 'rgba(60, 60, 67, 0.30)';
const BLUE_TINT_TOP = 'rgba(0, 122, 255, 0.06)';
const BLUE_TINT_BOTTOM = 'rgba(0, 122, 255, 0.02)';
const BLUE_BORDER = 'rgba(0, 122, 255, 0.18)';
const BLUE_DASH = 'rgba(0, 122, 255, 0.20)';

export interface DoAutoSummaryCardProps {
  /** Captures the summary describes — drives the breakdown row counts. */
  captures: DoCaptureItem[];
  /** Optional pre-written narrative (2–3 sentences). Falls back to a deterministic minimum if absent. */
  narrative?: string;
  /** Step context chip on the right of the eyebrow (e.g. "Light-air starts"). Hidden when omitted. */
  stepChipLabel?: string;
  /** Refine summary callback — hidden when omitted. */
  onRefineSummary?: () => void;
}

/**
 * Phase B.7 · Frame 3 · C + D — Auto-summary card with type breakdown.
 * The only blue-tinted surface inside the post-activity card; visually
 * leans toward the Move to Reflect CTA below.
 */
export function DoAutoSummaryCard({
  captures,
  narrative,
  stepChipLabel,
  onRefineSummary,
}: DoAutoSummaryCardProps) {
  const breakdown = summarizeCaptureBreakdown(captures);
  const items: { kind: 'voice' | 'note' | 'photo' | 'marker'; n: number; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { kind: 'voice', n: breakdown.voice, label: breakdown.voice === 1 ? 'voice' : 'voice', icon: 'mic', color: IOS_BLUE },
    { kind: 'note', n: breakdown.note, label: breakdown.note === 1 ? 'note' : 'notes', icon: 'create-outline', color: GRAY_1 },
    { kind: 'photo', n: breakdown.photo, label: breakdown.photo === 1 ? 'photo' : 'photos', icon: 'camera-outline', color: LABEL_2 },
    { kind: 'marker', n: breakdown.marker, label: breakdown.marker === 1 ? 'marker' : 'markers', icon: 'flag-outline', color: LABEL_3 },
  ].filter((i) => i.n > 0);

  return (
    <View style={styles.card} accessibilityLabel="Auto-summary of this activity">
      <View style={styles.head}>
        <View style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no">
          <Ionicons name="sparkles" size={12} color="#FFFFFF" />
        </View>
        <Text style={styles.lbl}>Auto-summary</Text>
        {stepChipLabel ? (
          <View style={styles.stepChip}>
            <Ionicons name="flag-outline" size={10} color={LABEL_3} />
            <Text style={styles.stepChipText} numberOfLines={1}>
              {stepChipLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {narrative ? <Text style={styles.narrative}>{narrative}</Text> : null}

      {items.length > 0 ? (
        <View style={styles.breakdown} accessibilityLabel="Breakdown by capture type">
          {items.map((it, idx) => (
            <React.Fragment key={it.kind}>
              {idx > 0 ? <Text style={styles.dot}>·</Text> : null}
              <View style={styles.item}>
                <Ionicons name={it.icon} size={11} color={it.color} />
                <Text style={styles.itemText}>
                  <Text style={styles.itemN}>{it.n}</Text>
                  {' '}
                  {it.label}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {onRefineSummary ? (
        <Pressable
          onPress={onRefineSummary}
          accessibilityRole="button"
          accessibilityLabel="Refine summary"
          style={({ pressed }) => [styles.refine, pressed && styles.refinePressed]}
          hitSlop={6}
        >
          <Text style={styles.refineText}>Refine summary</Text>
          <Ionicons name="arrow-forward" size={12} color={IOS_BLUE} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    marginHorizontal: 14,
    marginBottom: 4,
    paddingTop: 12,
    paddingRight: 13,
    paddingBottom: 12,
    paddingLeft: 13,
    backgroundColor: BLUE_TINT_TOP,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BLUE_BORDER,
    // Canonical uses a gradient (6% → 2%); RN approximates with the top tint for v1.
    // The bottom tint constant stays for future linear-gradient backing.
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 7,
  },
  glyph: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: IOS_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbl: {
    fontSize: 10.5,
    fontWeight: '700',
    color: IOS_BLUE,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepChip: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
    paddingBottom: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    maxWidth: 168,
  },
  stepChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: LABEL_2,
    letterSpacing: -0.05,
    flexShrink: 1,
  },
  narrative: {
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
    color: LABEL,
  },
  breakdown: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BLUE_DASH,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 4,
    columnGap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemText: {
    fontSize: 11,
    color: LABEL_2,
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  itemN: {
    fontWeight: '700',
    color: LABEL,
  },
  dot: {
    fontSize: 11,
    color: LABEL_4,
  },
  refine: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
  },
  refinePressed: {
    opacity: 0.7,
  },
  refineText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_BLUE,
    letterSpacing: -0.05,
  },
});

// Constant retained for documentation/future gradient backing of the canonical's blue-tint surface.
void BLUE_TINT_BOTTOM;
