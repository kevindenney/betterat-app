/**
 * TrophyScreen — canonical Trophy of Becoming surface with 4 state variants.
 *
 * The path-completion synthesis artifact: a quiet, vertically-centered
 * commemoration of a real shift in the user's practice. Six elements at
 * most; the coral 60×1 rule is the entire ornamental vocabulary.
 *
 * Variants (selected via the `variant` prop):
 *   first         — user's very first trophy. Above-title coral-haloed
 *                   eyebrow reading "Your first trophy". The dot has a
 *                   soft ring to read as first-of-kind, not live-now.
 *   canonical     — earned trophy with capability + context.
 *   mid-career    — same as canonical, plus carousel hint (5 dots + quiet
 *                   "Previous" affordance) so the user can navigate back
 *                   through prior trophies. No counter — the canonical
 *                   Trophy refused metrics; this respects that.
 *   named-absence — a stop, not an addition. The italic title names what
 *                   the user stopped doing; the capability eyebrow reads
 *                   "What you stopped doing" (or whatever the caller
 *                   passes). Same register weight as additive trophies
 *                   per the design's "stops are not lesser" principle.
 *   empty         — Trophy of Becoming opened without an earned trophy.
 *                   No quote, no capability, no context, no CTA. A quiet
 *                   coral rule sits where it always sits; the system
 *                   speaks once (upright SF Pro Text, not italic — the
 *                   product talking, not the user). The shape of the
 *                   room is preserved; the absences are the point.
 *
 * Earned-register exception:
 *   The italic title from user's voice is the *canonical Trophy register's*
 *   already-baked exception (predates the variants pass). Per architecture
 *   decision #3, no additional weight-up applies for variants: the surface
 *   carries zero actions (trophy-confer happens upstream in reflection
 *   synthesis), so neither irreversibility (a) nor primary-purpose-is-the-
 *   decision (b) condition is met.
 *
 * Visual source: Claude Design "Trophy · Variants · iOS register" handoff.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

/**
 * #FAFAFA — half-step warmer than system gray 6. Apple Books book-detail
 * trick: the warmth is below the conscious-attention threshold. If a
 * reviewer can name the color shift, it has gone too far.
 */
export const TROPHY_BG = '#FAFAFA';

export type TrophyVariant =
  | 'first'
  | 'canonical'
  | 'mid-career'
  | 'named-absence'
  | 'empty';

export interface TrophySeriesContext {
  /** Total trophies earned by this user (used for the carousel dot count). */
  total: number;
  /** Current trophy's 1-indexed position in the series. */
  currentIndex: number;
  /** Hides the Previous affordance when currentIndex === 1. */
  hasPrevious?: boolean;
  onPreviousPress?: () => void;
}

export interface TrophyContent {
  /**
   * The user's quoted reflection — italic display. Required for first /
   * canonical / mid-career / named-absence; ignored for empty.
   */
  quote?: string;
  /**
   * "From your Race 1 Debrief · Sunday, January 19" — pre-formatted by
   * caller so locale + separator rendering stays at the data boundary.
   */
  attribution?: string;
  /**
   * Capability eyebrow text. Defaults vary by variant:
   *   first / canonical / mid-career → capability name (e.g. "Upwind trim under pressure")
   *   named-absence                   → "What you stopped doing"
   *   empty                           → ignored
   */
  capabilityLabel?: string;
  /**
   * Context spans rendered with bullet separators between them. Example:
   * ["Week 1 of 12", "Spring Series", "RHKYC"]. Empty variant ignores this.
   */
  contextSpans?: string[];
}

interface Props {
  variant: TrophyVariant;
  content?: TrophyContent;
  /** Required for variant='mid-career'; ignored otherwise. */
  series?: TrophySeriesContext;
}

export function TrophyScreen({ variant, content, series }: Props) {
  return (
    <View style={styles.composition}>
      {variant === 'first' && <FirstMark />}

      {variant === 'empty' ? (
        <EmptyVariant />
      ) : (
        <FilledVariant variant={variant} content={content} series={series} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

function FirstMark() {
  return (
    <View style={styles.firstMark}>
      <View style={styles.firstMarkDotWrap}>
        <View style={styles.firstMarkDot} />
      </View>
      <Text style={styles.firstMarkText}>Your first trophy</Text>
    </View>
  );
}

function FilledVariant({
  variant,
  content,
  series,
}: {
  variant: Exclude<TrophyVariant, 'empty'>;
  content?: TrophyContent;
  series?: TrophySeriesContext;
}) {
  const quote = content?.quote ?? '';
  const attribution = content?.attribution;
  const capability = content?.capabilityLabel ??
    (variant === 'named-absence' ? 'What you stopped doing' : undefined);
  const contextSpans = content?.contextSpans ?? [];

  return (
    <>
      {quote ? (
        <Text style={styles.title}>{`“${quote}”`}</Text>
      ) : null}
      {attribution ? (
        <Text style={styles.attribution}>{attribution}</Text>
      ) : null}

      <View style={styles.coralRule} />

      {capability ? (
        <Text style={styles.capability}>{capability}</Text>
      ) : null}

      {contextSpans.length > 0 ? (
        <View style={styles.contextRow}>
          {contextSpans.map((span, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <View style={styles.contextSep} /> : null}
              <Text style={styles.context}>{span}</Text>
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {variant === 'mid-career' && series ? (
        <CarouselStrip series={series} />
      ) : null}
    </>
  );
}

function CarouselStrip({ series }: { series: TrophySeriesContext }) {
  const dots = Array.from({ length: Math.max(1, series.total) }, (_, i) => i + 1);
  const hasPrevious = series.hasPrevious ?? series.currentIndex > 1;
  return (
    <View style={styles.carouselStrip}>
      <View
        style={styles.carouselDots}
        accessibilityLabel={`Trophy ${series.currentIndex} of ${series.total}`}
      >
        {dots.map((d) => (
          <View
            key={d}
            style={[
              styles.carouselDot,
              d === series.currentIndex && styles.carouselDotActive,
            ]}
          />
        ))}
      </View>
      {hasPrevious ? (
        <Pressable
          onPress={series.onPreviousPress}
          accessibilityRole="button"
          accessibilityLabel="Previous trophy"
          hitSlop={8}
          style={styles.previousLink}
        >
          <Ionicons
            name="chevron-back"
            size={14}
            color={IOS_REGISTER.accentUserAction}
          />
          <Text style={styles.previousLinkText}>Previous</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyVariant() {
  return (
    <>
      <Text style={styles.emptyEyebrow}>Trophy of Becoming</Text>
      <View style={[styles.coralRule, styles.coralRuleQuiet]} />
      <Text style={styles.emptyCopy}>
        Trophies appear when your reflection reveals something you{'’'}ve
        genuinely shifted.{' '}
        <Text style={styles.emptyCopyItalic}>
          Keep practicing — they come when they{'’'}re real.
        </Text>
      </Text>
    </>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  composition: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    transform: [{ translateY: -22 }],
  },
  // ----- First-trophy eyebrow -----
  firstMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  firstMarkDotWrap: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  firstMarkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  firstMarkText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#E85A5A',
  },
  // ----- Title (canonical italic exception) -----
  title: {
    fontSize: 32,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 38,
    letterSpacing: -0.7,
    color: '#1A1A1A',
    textAlign: 'center',
    maxWidth: 320,
  },
  attribution: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.08,
    textAlign: 'center',
    marginTop: 24,
  },
  coralRule: {
    width: 60,
    height: 1,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
    marginTop: 64,
  },
  coralRuleQuiet: {
    backgroundColor: 'rgba(255, 107, 107, 0.35)',
  },
  capability: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.label,
    marginTop: 26,
    textAlign: 'center',
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  context: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.08,
  },
  contextSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  // ----- Carousel strip (V2 only) -----
  carouselStrip: {
    marginTop: 48,
    alignItems: 'center',
    gap: 12,
  },
  carouselDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  carouselDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
  },
  carouselDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  previousLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previousLinkText: {
    fontSize: 13,
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.08,
  },
  // ----- Empty variant -----
  emptyEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelTertiary,
    textAlign: 'center',
  },
  emptyCopy: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    letterSpacing: -0.15,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    marginTop: 40,
    maxWidth: 268,
  },
  emptyCopyItalic: {
    fontStyle: 'italic',
    color: '#3A3A3A',
  },
});
