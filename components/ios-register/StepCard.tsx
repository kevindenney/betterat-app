/**
 * StepCard — Apple Books library-density card for one step in a season arc.
 *
 * Pure presentational. Four status variants:
 *   debriefed   — past, debrief complete; cool/warm slate cover, green check pill
 *   in-progress — sailed, captures landed, debrief still pending; slate cover, amber pill
 *   current     — earned-exception treatment (2px iOS blue ring, semibold race name,
 *                 filled blue Current pill, "Open prep →" CTA, no scale-up so the
 *                 horizontal alignment in the scroller holds)
 *   planned     — future; pale cover with dark ink, neutral pill, no concepts spotlight
 *
 * 268pt wide, 232pt cover, 16pt corner radius. Visual source: Claude Design
 * "Race Prep cards · Felix sailing · iOS register" handoff. See docs/redesign/
 * IOS_MIGRATION_PLAN.md for the surface map and the earned-exception rule.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

export type StepCardStatus = 'debriefed' | 'in_progress' | 'current' | 'planned';

/**
 * Atmospheric cover tint — keyed to forecast feel, not status.
 * Status drives the pill + CTA; tint drives the cover gradient.
 */
export type StepCardCoverTint =
  | 'slate-deep' // heavy air, current
  | 'slate'      // building / moderate
  | 'slate-soft'
  | 'warm'       // light & shifty
  | 'cool'       // steady moderate
  | 'pale';      // unknown / planned

interface StepCardConcept {
  /** Display name, e.g. "Lane management" */
  name: string;
  /** Muted variant — tertiary bullet, used on planned cards */
  muted?: boolean;
}

interface Props {
  status: StepCardStatus;
  /** "RACE 4 OF 5" — already-formatted upper meta */
  raceOf: string;
  /** "04" — already-formatted ordinal mark */
  raceNum: string;
  /** Display name, e.g. "Spring Opener" */
  raceName: string;
  /** Cover atmospheric tint. Defaults derived from status when omitted. */
  coverTint?: StepCardCoverTint;
  /** Right-aligned date chip ("Dec 14", "Saturday"). Optional. */
  dateLabel?: string;
  /** Right-aligned wind chip ("18–22 kn NE", "Forecast pending"). Optional. */
  windLabel?: string;
  /**
   * Captures-row content. The component renders the leading icon + text;
   * callers pass a numeric count + optional pending suffix.
   *   debriefed: { count: 18 }                                  → "18 captures"
   *   progress:  { count: 12, pending: 'debrief pending' }      → "12 captures · debrief pending"
   *   current:   { plan: 'Plan in draft · 3 beats' }            → bypass count, show plan-state copy
   *   planned:   {} (renders "Not started" placeholder)
   */
  captures?: {
    count?: number;
    pending?: string;
    plan?: string;
  };
  /**
   * Up to ~2 capability/concept bullets. Coral by default; pass `muted: true`
   * on planned cards so the bullet sits behind the rest of the surface.
   */
  concepts?: StepCardConcept[];
  onPress?: () => void;
}

const COVER_GRADIENTS: Record<StepCardCoverTint, [string, string]> = {
  'slate-deep': ['#5A6D85', '#2F4258'],
  slate: ['#7891AF', '#5E7591'],
  'slate-soft': ['#8FA0B5', '#6E8298'],
  warm: ['#C8B391', '#9C8868'],
  cool: ['#ADBDC9', '#8FA0B5'],
  pale: ['#E2E1DC', '#CFCDC6'],
};

function defaultTintForStatus(status: StepCardStatus): StepCardCoverTint {
  switch (status) {
    case 'current':
      return 'slate-deep';
    case 'in_progress':
      return 'slate';
    case 'debriefed':
      return 'cool';
    case 'planned':
    default:
      return 'pale';
  }
}

export function StepCard({
  status,
  raceOf,
  raceNum,
  raceName,
  coverTint,
  dateLabel,
  windLabel,
  captures,
  concepts,
  onPress,
}: Props) {
  const tint = coverTint ?? defaultTintForStatus(status);
  const isPlanned = status === 'planned';
  const isCurrent = status === 'current';
  const inkOnCover = isPlanned ? darkInk : lightInk;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, isCurrent && styles.cardCurrent]}
      accessibilityRole="button"
      accessibilityLabel={`${raceOf} · ${raceName}`}
    >
      <LinearGradient
        colors={COVER_GRADIENTS[tint]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 0.9, y: 1.0 }}
        style={styles.cover}
      >
        {/* Faint diagonal streak for atmospheric feel — not slop, just air. */}
        <View pointerEvents="none" style={styles.coverStreak} />
        {/* Soft bottom darkening so the title always reads on the cover (skipped on planned). */}
        {!isPlanned && (
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.22)']}
            style={styles.coverShade}
            pointerEvents="none"
          />
        )}

        <View style={styles.coverTop}>
          <Text style={[styles.raceOf, { color: inkOnCover.raceOf }]}>{raceOf}</Text>
          <StatusPill status={status} />
        </View>
        <View style={styles.coverBottom}>
          <Text style={[styles.raceNum, { color: inkOnCover.raceNum }]}>{raceNum}</Text>
          <Text
            style={[
              styles.raceName,
              { color: inkOnCover.raceName },
              isCurrent && styles.raceNameCurrent,
            ]}
            numberOfLines={2}
          >
            {raceName}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.foot}>
        {(dateLabel || windLabel) && (
          <View style={styles.chips}>
            {dateLabel && (
              <View style={styles.chip}>
                <Ionicons name="calendar-outline" size={12} color={IOS_REGISTER.labelSecondary} />
                <Text style={styles.chipText}>{dateLabel}</Text>
              </View>
            )}
            {windLabel && (
              <View style={styles.chip}>
                <Ionicons name="navigate-outline" size={12} color={IOS_REGISTER.labelSecondary} />
                <Text style={styles.chipText}>{windLabel}</Text>
              </View>
            )}
          </View>
        )}

        <CapturesRow status={status} captures={captures} />

        {concepts && concepts.length > 0 && (
          <View style={styles.concepts}>
            {concepts.map((c) => (
              <View key={c.name} style={styles.conceptRow}>
                <View
                  style={[
                    styles.conceptDot,
                    c.muted && { backgroundColor: IOS_REGISTER.labelTertiary },
                  ]}
                />
                <Text style={styles.conceptText}>{c.name}</Text>
              </View>
            ))}
          </View>
        )}

        {isCurrent && (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Open prep</Text>
            <Ionicons
              name="arrow-forward"
              size={14}
              color={IOS_REGISTER.accentUserAction}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: StepCardStatus }) {
  if (status === 'debriefed') {
    return (
      <View style={[styles.pill, styles.pillLight]}>
        <Ionicons name="checkmark" size={11} color="#1F7A3A" />
        <Text style={[styles.pillText, { color: '#1F7A3A' }]}>Debriefed</Text>
      </View>
    );
  }
  if (status === 'in_progress') {
    return (
      <View style={[styles.pill, styles.pillLight]}>
        <View style={[styles.pillDot, { backgroundColor: '#8A6418' }]} />
        <Text style={[styles.pillText, { color: '#8A6418' }]}>In progress</Text>
      </View>
    );
  }
  if (status === 'current') {
    return (
      <View style={[styles.pill, styles.pillCurrent]}>
        <View style={[styles.pillDot, { backgroundColor: '#fff' }]} />
        <Text style={[styles.pillText, { color: '#fff' }]}>Current</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, styles.pillPlanned]}>
      <View style={[styles.pillDot, { backgroundColor: IOS_REGISTER.labelTertiary }]} />
      <Text style={[styles.pillText, { color: IOS_REGISTER.labelSecondary }]}>Planned</Text>
    </View>
  );
}

function CapturesRow({
  status,
  captures,
}: {
  status: StepCardStatus;
  captures?: Props['captures'];
}) {
  if (status === 'planned') {
    return (
      <View style={styles.capturesRow}>
        <Ionicons
          name="ellipse-outline"
          size={13}
          color={IOS_REGISTER.labelTertiary}
        />
        <Text style={styles.capturesText}>Not started</Text>
      </View>
    );
  }
  if (status === 'current') {
    const planText = captures?.plan ?? 'Plan in draft';
    return (
      <View style={styles.capturesRow}>
        <Ionicons
          name="create-outline"
          size={13}
          color={IOS_REGISTER.labelTertiary}
        />
        <Text style={styles.capturesText}>{planText}</Text>
      </View>
    );
  }
  // debriefed / in_progress
  const count = captures?.count ?? 0;
  return (
    <View style={styles.capturesRow}>
      <Ionicons
        name="chatbubble-outline"
        size={13}
        color={IOS_REGISTER.labelTertiary}
      />
      <Text style={styles.capturesText}>
        {count} {count === 1 ? 'capture' : 'captures'}
      </Text>
      {captures?.pending && (
        <>
          <Text style={styles.capturesText}> · </Text>
          <Text style={[styles.capturesText, styles.capturesPending]}>
            {captures.pending}
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

const lightInk = {
  raceOf: 'rgba(255,255,255,0.78)',
  raceNum: 'rgba(255,255,255,0.92)',
  raceName: '#FFFFFF',
};

const darkInk = {
  raceOf: 'rgba(60, 60, 67, 0.62)',
  raceNum: 'rgba(60, 60, 67, 0.32)',
  raceName: IOS_REGISTER.label,
};

const styles = StyleSheet.create({
  card: {
    flexBasis: 268,
    flexGrow: 0,
    flexShrink: 0,
    width: 268,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 10px rgba(0,0,0,0.05)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
      },
    }),
  },
  cardCurrent: {
    // Earned-exception: 2px iOS blue ring + lifted shadow tinted blue.
    // No size change so horizontal alignment in the scroller holds.
    borderWidth: 2,
    borderColor: IOS_REGISTER.accentUserAction,
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(0, 60, 140, 0.16)',
      } as any,
      default: {
        shadowColor: 'rgba(0, 60, 140, 0.4)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 18,
        elevation: 4,
      },
    }),
  },
  cover: {
    height: 232,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  coverStreak: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
    backgroundColor: 'transparent',
  },
  coverShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  coverTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  raceOf: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  coverBottom: {
    gap: 6,
  },
  raceNum: {
    fontSize: 56,
    fontWeight: '300',
    lineHeight: 56,
    letterSpacing: -2.2,
    marginBottom: -2,
  },
  raceName: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 21,
    letterSpacing: -0.34,
  },
  raceNameCurrent: {
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  // ----- pills -----
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  pillCurrent: {
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  pillPlanned: {
    backgroundColor: 'rgba(60, 60, 67, 0.10)',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // ----- foot -----
  foot: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 9,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: '#EFEFF4',
    borderRadius: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  capturesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  capturesText: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  capturesPending: {
    color: '#8A6418',
    fontWeight: '500',
  },
  concepts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingTop: 2,
  },
  conceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  conceptDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  conceptText: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
});
