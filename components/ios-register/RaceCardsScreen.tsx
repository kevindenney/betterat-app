/**
 * RaceCardsScreen — iOS-register summary surface for the Race Prep cards path.
 *
 * Companion to /race/ios/[stepId]: where the detail surface is one step's plan
 * (composer + beats + forecast + AI prompt), this is the *arc view* —
 * five steps across a season, side-by-side, in Apple Books library density.
 * Felix opens this to answer "where am I in the season?"; he taps a card to
 * do the work.
 *
 * Layout (top → bottom):
 *   - Title block: ALL-CAPS eyebrow + 32pt large title + dual-line meta
 *   - Arc bar: thin season progress track (5 segments by default; one per step)
 *   - Horizontal step scroller: 268pt cards with scroll-snap-to-start
 *   - Across-the-arc summary: grouped white card with season-level synthesis rows
 *
 * Pure presentational. Wiring (data shaping, ordering, status derivation) is
 * the caller's job — typically races.tsx via FEATURE_FLAGS.RACE_PREP_IOS_REGISTER.
 *
 * Visual source: Claude Design "Race Prep cards · Felix sailing · iOS register"
 * handoff. See docs/redesign/IOS_MIGRATION_PLAN.md.
 */

import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';
import { StepCard, type StepCardStatus, type StepCardCoverTint } from './StepCard';

export interface RaceCardItem {
  /** Stable id — routed to /race/ios/[stepId] on tap. */
  id: string;
  status: StepCardStatus;
  /** "RACE 1 OF 5" — pre-formatted by caller (driven by season position, not status). */
  raceOf: string;
  /** "01" — pre-formatted ordinal. */
  raceNum: string;
  raceName: string;
  coverTint?: StepCardCoverTint;
  dateLabel?: string;
  windLabel?: string;
  captures?: {
    count?: number;
    pending?: string;
    plan?: string;
  };
  concepts?: { name: string; muted?: boolean }[];
}

export interface ArcSummaryRow {
  /** Stable key for list-rendering. */
  key: string;
  /** Icon glyph — Ionicons name. Defaults to chatbubble. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon tint tone — 'coral' (memory/concept), 'blue' (user action), 'gray' (status). */
  tone?: 'coral' | 'blue' | 'gray';
  name: string;
  sub?: string;
  /** Right side: numeric count (e.g. "39") OR show a chevron when row is tappable. */
  count?: string;
  onPress?: () => void;
}

interface Props {
  /** ALL-CAPS pre-formatted ("WINTER 2025–2026 · SPRING SERIES"). */
  eyebrow?: string;
  /** Large title — 32pt SF Pro 400. */
  title: string;
  /** First meta line — venue/class/fleet. */
  metaPrimary?: string;
  /** Second meta line — schedule position ("Week 7 of 12 · two races left"). */
  metaSecondary?: string;
  /** Arc-bar labels under the segments. Pass only when caller wants to render them. */
  arcLeftLabel?: string;
  arcRightLabel?: string;
  arcWhereLabel?: string;
  cards: RaceCardItem[];
  /** Tap a card → route to /race/ios/[stepId]. Caller wires the router. */
  onCardPress?: (item: RaceCardItem) => void;
  arcSummary?: ArcSummaryRow[];
  /** Optional eyebrow + right-meta for the across-the-arc section. */
  arcSummaryEyebrow?: string;
  arcSummaryMeta?: string;
  /** Hairline footer under the scroller — "Swipe horizontally · tap a card to open its plan". */
  showSwipeHint?: boolean;
  /**
   * Bottom inset so the last across-the-arc row clears the floating tab bar.
   * Caller passes safe-area + 64pt tab + 22pt float offset. Defaults to 130.
   */
  bottomPad?: number;
}

export function RaceCardsScreen({
  eyebrow,
  title,
  metaPrimary,
  metaSecondary,
  arcLeftLabel,
  arcRightLabel,
  arcWhereLabel,
  cards,
  onCardPress,
  arcSummary,
  arcSummaryEyebrow = 'Across the arc',
  arcSummaryMeta,
  showSwipeHint = true,
  bottomPad = 130,
}: Props) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleBlock}>
        {eyebrow ? <Text style={styles.titleEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.titleH1}>{title}</Text>
        {(metaPrimary || metaSecondary) && (
          <View style={styles.titleMeta}>
            {metaPrimary ? (
              <Text style={styles.titleMetaLine}>{metaPrimary}</Text>
            ) : null}
            {metaSecondary ? (
              <Text style={styles.titleMetaLine}>{metaSecondary}</Text>
            ) : null}
          </View>
        )}
      </View>

      <ArcBar cards={cards} />
      {(arcLeftLabel || arcWhereLabel || arcRightLabel) && (
        <View style={styles.arcFoot}>
          <Text style={styles.arcFootLabel}>{arcLeftLabel ?? ''}</Text>
          <Text style={styles.arcFootWhere}>{arcWhereLabel ?? ''}</Text>
          <Text style={styles.arcFootLabel}>{arcRightLabel ?? ''}</Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollerContent}
        decelerationRate="fast"
        snapToInterval={268 + 12}
        snapToAlignment="start"
      >
        {cards.map((item) => (
          <StepCard
            key={item.id}
            status={item.status}
            raceOf={item.raceOf}
            raceNum={item.raceNum}
            raceName={item.raceName}
            coverTint={item.coverTint}
            dateLabel={item.dateLabel}
            windLabel={item.windLabel}
            captures={item.captures}
            concepts={item.concepts}
            onPress={onCardPress ? () => onCardPress(item) : undefined}
          />
        ))}
        {/* trailing breathing room so the last card can snap left-aligned */}
        <View style={{ width: 8 }} />
      </ScrollView>

      {showSwipeHint && (
        <View style={styles.swipeHint}>
          <Ionicons
            name="hand-left-outline"
            size={13}
            color={IOS_REGISTER.labelTertiary}
          />
          <Text style={styles.swipeHintText}>
            Swipe horizontally · tap a card to open its plan
          </Text>
        </View>
      )}

      {arcSummary && arcSummary.length > 0 && (
        <>
          <View style={styles.sectHead}>
            <Text style={styles.sectHeadText}>
              {arcSummaryEyebrow.toUpperCase()}
            </Text>
            {arcSummaryMeta ? (
              <Text style={styles.sectHeadMeta}>{arcSummaryMeta}</Text>
            ) : null}
          </View>
          <View style={styles.arcSummary}>
            {arcSummary.map((row, idx) => (
              <ArcSummaryItem key={row.key} row={row} isFirst={idx === 0} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Arc bar — thin season progress track. One segment per card; visual state
// derived from status alone, no extra props.
//   debriefed   → solid label-color (ink)
//   in_progress → 60% gradient ink → fill-3
//   current     → solid iOS blue with trailing ring node
//   planned     → fill-3
// ---------------------------------------------------------------------------

function ArcBar({ cards }: { cards: RaceCardItem[] }) {
  return (
    <View style={styles.arc}>
      {cards.map((c) => {
        if (c.status === 'current') {
          return (
            <View key={c.id} style={styles.arcSegCurrent}>
              <View style={styles.arcCurrentNode} />
            </View>
          );
        }
        if (c.status === 'debriefed') {
          return <View key={c.id} style={[styles.arcSeg, styles.arcSegDone]} />;
        }
        if (c.status === 'in_progress') {
          // 60% ink, 40% fill — approximated with two stacked bars since RN
          // can't do `background: linear-gradient(90deg, ...)` cleanly.
          return (
            <View key={c.id} style={styles.arcSeg}>
              <View style={styles.arcSegProgressFill} />
            </View>
          );
        }
        return <View key={c.id} style={styles.arcSeg} />;
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------

function ArcSummaryItem({
  row,
  isFirst,
}: {
  row: ArcSummaryRow;
  isFirst: boolean;
}) {
  const iconTone = row.tone ?? 'coral';
  const iconBg =
    iconTone === 'blue'
      ? IOS_REGISTER.accentUserAction + '1A' // 10% tint
      : iconTone === 'gray'
      ? '#E5E5EA'
      : IOS_REGISTER.accentMarkedContentTint;
  const iconColor =
    iconTone === 'blue'
      ? IOS_REGISTER.accentUserAction
      : iconTone === 'gray'
      ? IOS_REGISTER.labelSecondary
      : IOS_REGISTER.accentMarkedContent;
  const glyph = row.icon ?? 'chatbubble-outline';

  return (
    <View
      style={[
        styles.arcRow,
        !isFirst && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: IOS_REGISTER.separator,
        },
      ]}
    >
      <View style={[styles.arcRowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={glyph} size={15} color={iconColor} />
      </View>
      <View style={styles.arcRowInfo}>
        <Text style={styles.arcRowName}>{row.name}</Text>
        {row.sub ? <Text style={styles.arcRowSub}>{row.sub}</Text> : null}
      </View>
      {row.count ? (
        <Text style={styles.arcRowCount}>{row.count}</Text>
      ) : (
        <Ionicons
          name="chevron-forward"
          size={17}
          color={IOS_REGISTER.labelTertiary}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  // ----- title block -----
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  titleEyebrow: {
    ...IOS_REGISTER_TEXT.titleEyebrow,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  titleH1: {
    ...IOS_REGISTER_TEXT.title,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  titleMeta: {
    gap: 2,
  },
  titleMetaLine: {
    ...IOS_REGISTER_TEXT.titleMeta,
    color: IOS_REGISTER.labelSecondary,
  },
  // ----- arc bar -----
  arc: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  arcSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E5EA',
    overflow: 'hidden',
  },
  arcSegDone: {
    backgroundColor: IOS_REGISTER.label,
  },
  arcSegProgressFill: {
    width: '60%',
    height: '100%',
    backgroundColor: IOS_REGISTER.label,
  },
  arcSegCurrent: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.accentUserAction,
    position: 'relative',
  },
  arcCurrentNode: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: IOS_REGISTER.accentUserAction,
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.22)',
      } as any,
      default: {
        // RN doesn't do ring shadows cleanly; settle for elevation/lift.
        shadowColor: IOS_REGISTER.accentUserAction,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  arcFoot: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  arcFootLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
  },
  arcFootWhere: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  // ----- horizontal scroller -----
  scrollerContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
    gap: 12,
  },
  swipeHint: {
    paddingHorizontal: 20,
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipeHintText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  // ----- across-the-arc summary -----
  sectHead: {
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectHeadText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
  },
  sectHeadMeta: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.3,
    color: IOS_REGISTER.labelTertiary,
  },
  arcSummary: {
    marginHorizontal: 16,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  arcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  arcRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcRowInfo: {
    flex: 1,
    minWidth: 0,
  },
  arcRowName: {
    fontSize: 15,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  arcRowSub: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  arcRowCount: {
    fontSize: 15,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
});
