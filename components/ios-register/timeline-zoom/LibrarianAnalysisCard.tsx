/**
 * Librarian analysis card (L3 · L4 bottom band) with a Story / Numbers
 * toggle.
 *
 *   • Story  — the qualitative italic-serif observation + CTAs (the same
 *     content the legacy SeasonLibrarianPrompt rendered).
 *   • Numbers — a quantified re-projection of the same data: planned-vs-
 *     proven capability bars, headline stat tiles, reflection cadence
 *     (season) / trajectory (lifetime), crew presence, and a derived
 *     "What to do next" list.
 *
 * The toggle only appears when a `quant` payload is supplied; otherwise
 * the card degrades to a Story-only card. Numbers are computed upstream
 * in realDataAdapter (SeasonQuant / LifetimeQuant) — this component is
 * pure presentation.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { ZOOM_RAIL_RESERVED_WIDTH } from './ZoomLevelPicker';
import type {
  LifetimeQuant,
  QuantCapabilityStat,
  QuantCrewMember,
  QuantNextAction,
  QuantStatTile,
  SeasonLibrarianPrompt as PromptData,
  SeasonQuant,
} from './types';

const LILAC = '#AF52DE';
const LILAC_SOFT = 'rgba(175, 82, 222, 0.14)';
const LILAC_BORDER = 'rgba(175, 82, 222, 0.30)';
const LILAC_HAIR = 'rgba(175, 82, 222, 0.16)';
const TRACK_BG = 'rgba(120, 120, 128, 0.12)';

const SERIF_FAMILY = fontFamily.serif;

interface LibrarianAnalysisCardProps {
  prompt: PromptData;
  quant?: SeasonQuant | LifetimeQuant;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export function LibrarianAnalysisCard({
  prompt,
  quant,
  onPrimary,
  onSecondary,
}: LibrarianAnalysisCardProps) {
  const [view, setView] = useState<'story' | 'numbers'>('story');
  const hasNumbers = !!quant && quant.capabilities.length > 0;
  const showNumbers = hasNumbers && view === 'numbers';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          ❋ {(prompt.eyebrow ?? 'THE LIBRARIAN NOTICED').toUpperCase()}
        </Text>
        {hasNumbers ? (
          <View style={styles.seg}>
            <SegButton label="Story" active={view === 'story'} onPress={() => setView('story')} />
            <SegButton label="Numbers" active={view === 'numbers'} onPress={() => setView('numbers')} />
          </View>
        ) : null}
      </View>

      {showNumbers && quant ? (
        quant.kind === 'season' ? (
          <SeasonNumbers quant={quant} />
        ) : (
          <LifetimeNumbers quant={quant} />
        )
      ) : (
        <StoryBody prompt={prompt} onPrimary={onPrimary} onSecondary={onSecondary} />
      )}
    </View>
  );
}

function SegButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.segBtn, active && styles.segBtnOn]} onPress={onPress}>
      <Text style={[styles.segText, active && styles.segTextOn]}>{label}</Text>
    </Pressable>
  );
}

/* ───────────────────────────── STORY ───────────────────────────── */

function StoryBody({
  prompt,
  onPrimary,
  onSecondary,
}: {
  prompt: PromptData;
  onPrimary?: () => void;
  onSecondary?: () => void;
}) {
  return (
    <View>
      <Text style={styles.body}>{prompt.body}</Text>
      {prompt.emphasisLine ? (
        <Text style={styles.emphasisLine}>{prompt.emphasisLine}</Text>
      ) : null}
      {prompt.supportingLine ? (
        <Text style={styles.supportingLine}>{prompt.supportingLine}</Text>
      ) : null}
      <View style={styles.actions}>
        {prompt.secondaryCta ? (
          <Pressable style={styles.secondaryBtn} onPress={onSecondary}>
            <Text style={styles.secondaryText}>{prompt.secondaryCta.label}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.primaryBtn} onPress={onPrimary}>
          <Text style={styles.primaryText}>{prompt.primaryCta.label}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ──────────────────────────── NUMBERS ───────────────────────────── */

function SeasonNumbers({ quant }: { quant: SeasonQuant }) {
  const maxScale = Math.max(1, ...quant.capabilities.map((c) => c.total));
  const maxCadence = Math.max(1, ...quant.cadence.map((c) => c.count));
  return (
    <View>
      <Metric first title="Capability mix · planned vs proven">
        {quant.capabilities.map((c) => (
          <PlannedProvenBar key={c.id} cap={c} maxScale={maxScale} />
        ))}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { opacity: 0.26 }]} />
            <Text style={styles.legendText}>Planned (goal)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendSwatch} />
            <Text style={styles.legendText}>Proven (evidence)</Text>
          </View>
        </View>
      </Metric>

      <Metric>
        <StatRow stats={quant.stats} />
      </Metric>

      <Metric title="Reflection cadence" valueLeft={quant.cadenceLabel}>
        <View style={styles.weekRow}>
          {quant.cadence.map((w) => (
            <View key={w.weekNumber} style={styles.weekCell}>
              <View style={[styles.weekBar, !w.filled && styles.weekBarEmpty]}>
                {w.filled ? (
                  <View
                    style={[
                      styles.weekFill,
                      { height: `${Math.max(18, (w.count / maxCadence) * 100)}%` },
                    ]}
                  />
                ) : null}
              </View>
              <Text style={[styles.weekLabel, w.isNow && styles.weekLabelNow]}>
                wk{w.weekNumber}
              </Text>
            </View>
          ))}
        </View>
      </Metric>

      {quant.crew.length > 0 ? (
        <Metric title={quant.crewHeader}>
          {quant.crew.map((p) => (
            <CrewRow key={p.id} member={p} />
          ))}
        </Metric>
      ) : null}

      <NextActions actions={quant.nextActions} />
    </View>
  );
}

function LifetimeNumbers({ quant }: { quant: LifetimeQuant }) {
  const maxScale = Math.max(1, ...quant.capabilities.map((c) => c.total));
  return (
    <View>
      <Metric first title={quant.capabilitiesHeader || 'Where your steps went'}>
        {quant.capabilities.map((c) => (
          <DistributionBar key={c.id} cap={c} maxScale={maxScale} />
        ))}
      </Metric>

      <Metric>
        <StatRow stats={quant.stats} />
      </Metric>

      {quant.trajectoryNote ? (
        <Metric title="Trajectory">
          <Text style={styles.trajectory}>{quant.trajectoryNote}</Text>
        </Metric>
      ) : null}

      {quant.crew.length > 0 ? (
        <Metric title={quant.crewHeader}>
          {quant.crew.map((p) => (
            <CrewRow key={p.id} member={p} />
          ))}
        </Metric>
      ) : null}

      <NextActions actions={quant.nextActions} />
    </View>
  );
}

function Metric({
  title,
  valueLeft,
  first,
  children,
}: {
  title?: string;
  valueLeft?: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.metric, first && styles.metricFirst]}>
      {title ? (
        <View style={styles.metricHead}>
          <Text style={styles.metricTitle}>{title}</Text>
          {valueLeft ? <Text style={styles.metricValue}>{valueLeft}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function PlannedProvenBar({ cap, maxScale }: { cap: QuantCapabilityStat; maxScale: number }) {
  return (
    <View style={styles.capRow}>
      <View style={styles.capName}>
        <View style={[styles.capDot, { backgroundColor: cap.color }]} />
        <Text style={styles.capLabel} numberOfLines={1}>
          {cap.label}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.barPlanned,
            { width: `${(cap.planned / maxScale) * 100}%`, backgroundColor: cap.color },
          ]}
        />
        <View
          style={[
            styles.barProven,
            { width: `${(cap.proven / maxScale) * 100}%`, backgroundColor: cap.color },
          ]}
        />
      </View>
      <Text style={styles.capCount}>
        <Text style={styles.capCountStrong}>{cap.proven}</Text>/{cap.total}
      </Text>
    </View>
  );
}

function DistributionBar({ cap, maxScale }: { cap: QuantCapabilityStat; maxScale: number }) {
  return (
    <View style={styles.capRow}>
      <View style={styles.capName}>
        <View style={[styles.capDot, { backgroundColor: cap.color }]} />
        <Text style={styles.capLabel} numberOfLines={1}>
          {cap.label}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.barProven,
            { width: `${(cap.total / maxScale) * 100}%`, backgroundColor: cap.color },
          ]}
        />
      </View>
      <Text style={styles.capCount}>
        <Text style={styles.capCountStrong}>{cap.total}</Text> · {Math.round(cap.share * 100)}%
      </Text>
    </View>
  );
}

function StatRow({ stats }: { stats: QuantStatTile[] }) {
  return (
    <View style={styles.statRow}>
      {stats.map((s, i) => (
        <StatTile key={`${s.label}-${i}`} stat={s} />
      ))}
    </View>
  );
}

function StatTile({ stat }: { stat: QuantStatTile }) {
  const pct = stat.value.endsWith('%');
  const main = pct ? stat.value.slice(0, -1) : stat.value;
  return (
    <View style={styles.stat}>
      <Text style={styles.statBig}>
        {main}
        {pct ? <Text style={styles.statPct}>%</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{stat.label}</Text>
      {stat.note ? <Text style={styles.statNote}>{stat.note}</Text> : null}
    </View>
  );
}

function CrewRow({ member }: { member: QuantCrewMember }) {
  return (
    <View style={styles.peerRow}>
      <View style={[styles.peerAvatar, { backgroundColor: member.color }]}>
        <Text style={styles.peerInitials}>{member.initials}</Text>
      </View>
      <View style={styles.peerNameWrap}>
        <Text style={styles.peerName} numberOfLines={1}>
          {member.name}
          {member.role ? <Text style={styles.peerRole}> · {member.role}</Text> : null}
        </Text>
      </View>
      <View style={styles.peerBar}>
        <View
          style={[styles.peerFill, { width: `${member.ratio * 100}%`, backgroundColor: member.color }]}
        />
      </View>
      <Text style={styles.peerCount}>{member.valueLabel}</Text>
    </View>
  );
}

function NextActions({ actions }: { actions: QuantNextAction[] }) {
  if (actions.length === 0) return null;
  return (
    <View style={styles.next}>
      <Text style={styles.nextHead}>WHAT TO DO NEXT</Text>
      {actions.map((a) => (
        <View key={a.id} style={styles.nextRow}>
          <View style={[styles.nextDot, { backgroundColor: a.color }]} />
          <Text style={styles.nextText}>
            <Text style={styles.nextTitle}>{a.title}. </Text>
            <Text style={styles.nextDetail}>{a.detail}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: LILAC_SOFT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 10,
    shadowColor: '#7B3FB0',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
    // Clear the floating ALL/ARC/STEP zoom rail (reserves the right edge).
    // Card insets are 28 (marginHorizontal 16 + paddingHorizontal 12), so
    // subtract them from the rail's reserved width.
    paddingRight: ZOOM_RAIL_RESERVED_WIDTH - 28,
  },
  eyebrow: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: LILAC,
  },
  // segmented toggle
  seg: {
    flexShrink: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(175, 82, 222, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
    borderRadius: 999,
    padding: 2,
    gap: 2,
  },
  segBtn: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
  },
  segBtnOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  segText: {
    fontSize: 11,
    fontWeight: '700',
    color: LILAC,
  },
  segTextOn: {
    color: IOS_REGISTER.label,
  },
  // story
  body: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
  },
  emphasisLine: {
    marginTop: 3,
    fontSize: 13.5,
    lineHeight: 18,
    color: IOS_REGISTER.accentUserAction,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
  },
  supportingLine: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.label,
  },
  actions: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 9,
    justifyContent: 'flex-end',
  },
  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: LILAC,
  },
  primaryText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // numbers — metric block
  metric: {
    paddingTop: 11,
    marginTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LILAC_HAIR,
  },
  metricFirst: {
    paddingTop: 4,
    marginTop: 4,
    borderTopWidth: 0,
  },
  metricHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricTitle: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
  },
  metricValue: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    fontFamily: SERIF_FAMILY,
  },
  // capability bars
  capRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginVertical: 4,
  },
  capName: {
    width: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capDot: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  capLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  track: {
    flex: 1,
    height: 14,
    backgroundColor: TRACK_BG,
    borderRadius: 7,
    overflow: 'hidden',
  },
  barPlanned: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 7,
    opacity: 0.26,
  },
  barProven: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 7,
  },
  capCount: {
    width: 56,
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'right',
  },
  capCountStrong: {
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
    marginLeft: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 16,
    height: 9,
    borderRadius: 3,
    backgroundColor: LILAC,
  },
  legendText: {
    fontSize: 10,
    color: IOS_REGISTER.labelTertiary,
  },
  // stat tiles
  statRow: {
    flexDirection: 'row',
    gap: 9,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_HAIR,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statBig: {
    fontFamily: SERIF_FAMILY,
    fontSize: 22,
    lineHeight: 24,
    color: IOS_REGISTER.label,
  },
  statPct: {
    fontSize: 13,
    color: IOS_REGISTER.labelTertiary,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelTertiary,
    marginTop: 6,
  },
  statNote: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 3,
    lineHeight: 14,
  },
  // week cadence
  weekRow: {
    flexDirection: 'row',
    gap: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: 'stretch',
  },
  weekBar: {
    height: 26,
    borderRadius: 5,
    backgroundColor: TRACK_BG,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  weekBarEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: LILAC_BORDER,
  },
  weekFill: {
    borderRadius: 5,
    backgroundColor: LILAC,
  },
  weekLabel: {
    fontSize: 9,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  weekLabelNow: {
    color: IOS_REGISTER.accentUserAction,
    fontWeight: '800',
  },
  // peer rows
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginVertical: 5,
  },
  peerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerInitials: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  peerNameWrap: {
    flex: 1,
  },
  peerName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  peerRole: {
    fontWeight: '400',
    color: IOS_REGISTER.labelTertiary,
  },
  peerBar: {
    width: 64,
    height: 8,
    backgroundColor: TRACK_BG,
    borderRadius: 5,
    overflow: 'hidden',
  },
  peerFill: {
    height: '100%',
    borderRadius: 5,
  },
  peerCount: {
    width: 52,
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'right',
  },
  // next actions
  next: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_HAIR,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  nextHead: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: LILAC,
    marginBottom: 6,
  },
  nextRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    marginVertical: 5,
  },
  nextDot: {
    width: 7,
    height: 7,
    borderRadius: 3,
    marginTop: 5,
  },
  nextText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  nextTitle: {
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  nextDetail: {
    color: IOS_REGISTER.labelSecondary,
  },
  trajectory: {
    fontSize: 14,
    lineHeight: 19,
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
  },
});
