/**
 * L4 — every season as a lane of capability-tinted bricks. The archive
 * lives here.
 *
 * Frame 4/8. "All your steps" headline + N seasons · M steps · since DATE.
 * Lifetime axis + capability river + peer timeline + librarian reflection
 * prompt, then arc lanes below. Tap any brick → zoom to L1 with that step
 * focused.
 *
 * Section D drag-reorder (Frame 13 within the current lane only): long-
 * press a brick in the current rotation to lift it, then drag along the
 * row to reorder. Cross-season "drop into another season" (Frame 14)
 * isn't wired yet — timeline_steps don't have a season_id column, so
 * re-seasoning needs a schema decision before it can be built.
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { CapabilityMix } from './CapabilityMix';
import { SnakeNodeRiver, type SnakeNode } from './SnakeTimeline';
import { LibrarianAnalysisCard } from './LibrarianAnalysisCard';
import {
  detectMilestoneTitles,
  detectPhaseLabelFromTitles,
  resolveInterestVocab,
  type InterestVocab,
} from './interestVocab';
import {
  formatMoney,
  hasMoneyLane,
  resolveLoanTier,
  resolveMoneyConfig,
  type MoneyConfig,
} from './interestMoney';
import { HeadlineMetric } from './HeadlineMetric';
import { hasHeadlineMetric, resolveHeadlineMetric } from './interestHeadline';
import { LifetimeVisionEditSheet } from './LifetimeVisionEditSheet';
import { LifetimeReflectionSheet } from './LifetimeReflectionSheet';
import { useUpdateLifetimeVision } from '@/hooks/useInterestVision';
import type {
  LifetimeFinance,
  LifetimePeer,
  LifetimeSession,
  TimelineDataset,
  TimelineSeason,
  WeeklyCapabilityMix,
} from './types';

/**
 * Format a lifetime duration string for the L4 subtitle ("2 years",
 * "8 months", "3 weeks"). Returns null when the timestamp is missing
 * so the caller can fall back to the legacy "{N} arcs · {M} steps"
 * subtitle.
 */
// Season-identity hues for the all-time node river, cycled by chronological
// arc position (mirrors the s0–s3 palette in the timeline-zoom mockups).
const SEASON_PALETTE = ['#1E9E6A', '#2E62F0', '#E08A2B', '#8B5CF6', '#FF6B5A', '#0EA5A5'];

/** Trim a milestone title to a node label that fits two short lines. */
function shortenLabel(title: string): string {
  const t = title.trim();
  return t.length <= 22 ? t : `${t.slice(0, 21).trimEnd()}…`;
}

function formatLifetimeDuration(isoStart: string | undefined): string | null {
  if (!isoStart) return null;
  const start = Date.parse(isoStart);
  if (Number.isNaN(start)) return null;
  const elapsedMs = Date.now() - start;
  if (elapsedMs <= 0) return null;
  const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  if (days < 14) return `${Math.max(1, days)} ${days === 1 ? 'day' : 'days'}`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  const years = elapsedMs / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) {
    const months = Math.max(1, Math.round(days / 30));
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  const rounded = Math.round(years);
  return `${rounded} ${rounded === 1 ? 'year' : 'years'}`;
}

interface L4YearsViewProps {
  dataset: TimelineDataset;
  /**
   * Drill into one chapter — whole-card tap navigates to that arc at L3.
   * The lifetime surface is reflective, so its only primary action is
   * "open this chapter"; week-granular step interaction (drag, select)
   * lives at L3 where the brick wall earns its place.
   */
  onOpenSeason?: (seasonId: string) => void;
  /** Lifetime librarian primary CTA — "Start a reflection". */
  onLibrarianPrimary?: () => void;
  /** Lifetime librarian "Not now" tap. */
  onLibrarianSecondary?: () => void;
  /** "+ New arc" affordance, surfaced inside Edit mode on the chapter list. */
  onAddArc?: () => void;
  /** Per-chapter edit affordance, surfaced inside Edit mode. */
  onEditArc?: (arcId: string) => void;
}

/**
 * Build the lifetime "drift river" — one column per ARC (not per
 * session), each column carrying the full capability mix of that arc.
 * This is the L4-native representation: it shows how the dominant
 * capability *drifted* between chapters. Reuses the CapabilityMix
 * stacked-area chart, but feeds it arc-granularity columns so the
 * streams join across arcs into a readable river.
 *
 * Distinct from the old per-session adapter, which gave each session a
 * single dominant-color band — at one arc that read as an empty chart
 * on a long ruler. Here each arc aggregates its bricks by capability
 * label, so a single arc still has internal mix and two+ arcs show the
 * genuine cross-chapter drift.
 *
 * `seasons` arrives newest-first; we reverse to chronological so the
 * river reads left→right oldest→now. Returns null when fewer than two
 * arcs carry labeled capability data (drift needs at least two points).
 */
function buildDriftMix(
  seasons: TimelineSeason[],
): { mix: WeeklyCapabilityMix[]; labelByColumn: Map<number, string> } | null {
  const chronological = [...seasons].reverse();
  const mix: WeeklyCapabilityMix[] = [];
  const labelByColumn = new Map<number, string>();

  chronological.forEach((season, idx) => {
    const column = idx + 1;
    labelByColumn.set(column, season.title);
    const byLabel = new Map<
      string,
      { id: string; label: string; color: string; volume: number }
    >();
    for (const brick of season.bricks) {
      const label = brick.capabilityLabel?.trim();
      if (!label) continue;
      const existing = byLabel.get(label);
      if (existing) existing.volume += 1;
      else
        byLabel.set(label, {
          id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          label,
          color: brick.capabilityColor,
          volume: 1,
        });
    }
    const bands = Array.from(byLabel.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map((b) => ({
        capabilityId: b.id,
        capabilityLabel: b.label,
        capabilityColor: b.color,
        volume: b.volume,
      }));
    mix.push({ weekNumber: column, bands });
  });

  const columnsWithData = mix.filter((m) => m.bands.length > 0).length;
  if (columnsWithData < 2) return null;
  return { mix, labelByColumn };
}

/**
 * Aggregate every brick across every arc into the single dominant
 * capability of the whole practice — the poster's "through-line". Also
 * returns the latest arc's dominant so the drift caption can name a
 * shift. Null when no labeled bricks exist anywhere.
 */
function resolveLifetimeDominant(seasons: TimelineSeason[]): {
  label: string;
  color: string;
  latestLabel: string | null;
} | null {
  const totals = new Map<string, { label: string; color: string; count: number }>();
  for (const season of seasons) {
    for (const brick of season.bricks) {
      const label = brick.capabilityLabel?.trim();
      if (!label) continue;
      const existing = totals.get(label);
      if (existing) existing.count += 1;
      else totals.set(label, { label, color: brick.capabilityColor, count: 1 });
    }
  }
  let dominant: { label: string; color: string; count: number } | null = null;
  for (const bucket of totals.values()) {
    if (!dominant || bucket.count > dominant.count) dominant = bucket;
  }
  if (!dominant) return null;
  // Latest arc dominant (seasons[0] is newest).
  const latest = seasons[0];
  let latestLabel: string | null = null;
  if (latest) {
    const latestTotals = new Map<string, number>();
    for (const brick of latest.bricks) {
      const label = brick.capabilityLabel?.trim();
      if (!label) continue;
      latestTotals.set(label, (latestTotals.get(label) ?? 0) + 1);
    }
    let best = 0;
    for (const [label, count] of latestTotals) {
      if (count > best) {
        best = count;
        latestLabel = label;
      }
    }
  }
  return { label: dominant.label, color: dominant.color, latestLabel };
}

export function L4YearsView({
  dataset,
  onOpenSeason,
  onLibrarianPrimary,
  onLibrarianSecondary,
  onAddArc,
  onEditArc,
}: L4YearsViewProps) {
  const [chartWidth, setChartWidth] = useState(0);
  // Editing is deferred behind an "Edit" affordance the way Photos /
  // Notes hide chapter management — the default state reads the
  // practice; manage mode reveals "+ New arc" and per-chapter edit.
  const [manageMode, setManageMode] = useState(false);

  const onAnalysisLayout = useCallback((e: LayoutChangeEvent) => {
    // The rail's lane is now reserved by the canvas container (paddingRight),
    // so this measured width already excludes it — use it as-is.
    const w = Math.max(0, e.nativeEvent.layout.width);
    if (w !== chartWidth) setChartWidth(w);
  }, [chartWidth]);

  const lifetime = dataset.lifetime;

  // Lifetime vision banner — now reads its own dedicated field on
  // user_interests (D5 follow-up). Distinct from the season-bound
  // vision_statement that anchors L3, so a sailor's L3 ("Finish top
  // of HK worlds 2026") and L4 ("Race the Dragon Worlds every year
  // through age 60") can each be honest.
  const lifetimeVisionStatement =
    dataset.lifetimeVisionStatement?.trim() || null;
  const [lifetimeVisionEditOpen, setLifetimeVisionEditOpen] = useState(false);
  // "Start a reflection" lands here — a backward recap that culminates
  // in writing the lifetime vision. "Not now" dismisses the librarian
  // card for this mount (persisting the dismissal is a later step).
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [librarianDismissed, setLibrarianDismissed] = useState(false);
  const updateLifetimeVision = useUpdateLifetimeVision();

  // Demo datasets carry no editable user_interests row, so vision and
  // reflection writes no-op there (matches the vision banner gate).
  const canEditVision =
    dataset.interest.id !== 'live' && dataset.interest.id !== 'sample';

  // Resolve interest-native vocab — L4 is by definition the reflective
  // view, so we always use the late-tier verb and the persona's native
  // librarian eyebrow.
  const interestVocab = resolveInterestVocab(
    dataset.interest.id,
    dataset.interest.label,
  );

  // Lifetime "drift river" — per-ARC capability mix (only meaningful at
  // 2+ arcs). Replaces the old per-session single-band chart that read
  // as an empty ruler at one arc.
  const drift = useMemo(
    () => buildDriftMix(dataset.seasons),
    [dataset.seasons],
  );

  // Whole-practice dominant capability + latest-arc dominant — powers
  // the poster through-line sentence and the drift caption. Single-arc
  // practices prefer the capability-goal through-line (lifetime.throughLine)
  // so L4 names the same lead as the L3 chips ("Boat handling") instead of
  // the coarse category brick dominant ("Training"); multi-arc keeps the
  // cross-season brick aggregation, which spans archived arcs the per-season
  // ranking can't see.
  const lifetimeDominant = useMemo(() => {
    if (dataset.seasons.length <= 1 && lifetime?.throughLine) {
      return {
        label: lifetime.throughLine.label,
        color: lifetime.throughLine.color,
        latestLabel: null,
      };
    }
    return resolveLifetimeDominant(dataset.seasons);
  }, [lifetime, dataset.seasons]);

  // Poster scale figures. arcCount drives the adaptive one-arc vs
  // many-arc copy; the metric trio reads steps · arcs · people.
  const arcCount = dataset.seasons.length;
  const peopleCount = lifetime?.peers.length ?? 0;
  const lifetimeDuration = formatLifetimeDuration(dataset.sinceTimestamp);
  const periodNoun = interestVocab.periodNoun;
  const periodPlural = arcCount === 1 ? periodNoun : `${periodNoun}s`;

  // Trajectory arrow — D5 closer. Names the *change* the lifetime
  // ladder produced ("Started Spring '24 with Tactics → now in Race
  // execution"). Renders between the aspirational vision (where
  // you're going) and the historical arcs (where you've been), so the
  // eye can hand off from one to the other without losing the thread.
  // Only meaningful with 2+ sessions and labeled dominant capabilities
  // on both ends — otherwise the sentence reads as a stub.
  const trajectory = useMemo(() => {
    if (!lifetime || lifetime.sessions.length < 2) return null;
    const first = lifetime.sessions[0];
    const last = lifetime.sessions[lifetime.sessions.length - 1];
    if (!first || !last) return null;
    const firstLabel = first.dominantCapabilityLabel?.trim() || null;
    const lastLabel = last.dominantCapabilityLabel?.trim() || null;
    if (!firstLabel || !lastLabel || firstLabel === lastLabel) return null;
    return {
      fromLabel: firstLabel,
      fromColor: first.dominantCapabilityColor,
      toLabel: lastLabel,
      toColor: last.dominantCapabilityColor,
      fromSession: first.label,
    };
  }, [lifetime]);

  // All-time "step river" — every step across every arc strung into one
  // NOW-anchored snake (oldest → newest). Steps shrink to season-tinted
  // nodes; milestones earn a star + label, the focused step is the red
  // NOW node. The solid thread covers everything done up to NOW. This is
  // the snaking-timeline twin of the brick-lane archive below, so the
  // whole practice reads as one continuous line, not a stack of chapters.
  const allTimeRiver = useMemo(() => {
    const chrono = [...dataset.seasons].reverse(); // oldest → now
    const allTitles = chrono.flatMap((s) =>
      s.weeks.flatMap((w) => w.steps.map((st) => st.title)),
    );
    const milestoneSet = new Set(
      detectMilestoneTitles(allTitles, interestVocab, 999).map((t) =>
        t.trim().toLowerCase(),
      ),
    );
    const seasonByStep = new Map<string, string>();
    const nodes: SnakeNode[] = [];
    const seasonKeys: { title: string; color: string }[] = [];
    let progressCount = 0;
    let runningIndex = 0;
    chrono.forEach((season, si) => {
      const color = SEASON_PALETTE[si % SEASON_PALETTE.length];
      const steps = season.weeks.flatMap((w) => w.steps);
      if (steps.length > 0) seasonKeys.push({ title: season.title, color });
      steps.forEach((step, j) => {
        seasonByStep.set(step.id, step.seasonId ?? season.id);
        const isNow = step.id === dataset.focusStepId;
        const isMilestone = milestoneSet.has(step.title.trim().toLowerCase());
        const firstOfSeason = j === 0;
        const label = isNow
          ? 'NOW'
          : isMilestone
            ? shortenLabel(step.title)
            : firstOfSeason
              ? season.title
              : '';
        nodes.push({
          id: step.id,
          label,
          color,
          big: isMilestone || isNow,
          milestone: isMilestone || firstOfSeason,
          star: isMilestone ? '★' : undefined,
          now: isNow,
        });
        runningIndex += 1;
        if (isNow) progressCount = runningIndex;
      });
    });
    if (progressCount === 0) {
      // Focus not in this dataset — fall back to "all finished work".
      let done = 0;
      for (const s of chrono)
        for (const w of s.weeks)
          for (const st of w.steps)
            if (st.status === 'done' || st.status === 'reflected') done += 1;
      progressCount = done;
    }
    return { nodes, progressCount, seasonByStep, seasonKeys };
  }, [dataset.seasons, dataset.focusStepId, interestVocab]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        {/* The view-title used to repeat the interest name with a
            dropdown chevron — but the AppChromeRow above already shows
            the InterestSwitcher pill for the same interest. Two copies
            of the same picker on one screen reads as a bug. At L4
            there's nothing to switch *to* below the interest level
            anyway, so we name the *view* ("All time") here and let the
            chrome row own the interest pill. */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            All time
          </Text>
        </View>
        <Text style={styles.subtitle}>
          {`${dataset.totalSeasons} ${periodPlural} · ${dataset.totalSteps} step${dataset.totalSteps === 1 ? '' : 's'}${lifetimeDuration ? ` · ${lifetimeDuration}` : ''}`}
        </Text>
      </View>

      <LifetimePoster
        interestLabel={dataset.interest.label}
        arcCount={arcCount}
        totalSteps={dataset.totalSteps}
        peopleCount={peopleCount}
        periodNoun={periodNoun}
        periodPlural={periodPlural}
        duration={lifetimeDuration}
        sinceDate={dataset.sinceDate}
        dominant={lifetimeDominant}
      />

      <Pressable
        style={styles.lifetimeVisionBanner}
        onPress={canEditVision ? () => setLifetimeVisionEditOpen(true) : undefined}
        accessibilityRole="button"
        accessibilityLabel={
          lifetimeVisionStatement ? 'Edit lifetime vision' : 'Set lifetime vision'
        }
      >
        <Text style={styles.lifetimeVisionEyebrow}>Lifetime vision</Text>
        {lifetimeVisionStatement ? (
          <Text style={styles.lifetimeVisionStatement}>
            {lifetimeVisionStatement}
          </Text>
        ) : (
          <Text style={styles.lifetimeVisionPrompt}>
            What are you {interestVocab.id === 'default' ? 'building' : interestVocab.verb.mid.toLowerCase()} toward, long-term?
          </Text>
        )}
      </Pressable>

      {trajectory ? (
        <View style={styles.trajectoryRow}>
          <View
            style={[styles.trajectoryDot, { backgroundColor: trajectory.fromColor }]}
          />
          <Text style={styles.trajectoryText} numberOfLines={1}>
            Started{' '}
            <Text style={styles.trajectoryWhen}>{trajectory.fromSession}</Text>{' '}
            with{' '}
            <Text style={styles.trajectoryLabel}>{trajectory.fromLabel}</Text>
          </Text>
          <Ionicons
            name="arrow-forward"
            size={11}
            color={IOS_REGISTER.labelTertiary}
            style={styles.trajectoryArrow}
          />
          <Text style={styles.trajectoryText} numberOfLines={1}>
            now in{' '}
            <Text style={styles.trajectoryLabel}>{trajectory.toLabel}</Text>
          </Text>
          <View
            style={[styles.trajectoryDot, { backgroundColor: trajectory.toColor }]}
          />
        </View>
      ) : null}

      {hasHeadlineMetric(interestVocab.id)
        ? (() => {
            const cfg = resolveHeadlineMetric(interestVocab.id)!;
            const v = cfg.resolveLifetime(dataset);
            return v ? <HeadlineMetric label={cfg.label} value={v} /> : null;
          })()
        : null}

      {hasMoneyLane(interestVocab.id) && dataset.lifetimeFinance ? (
        <MoneyReadout
          finance={dataset.lifetimeFinance}
          config={resolveMoneyConfig(interestVocab.id)!}
        />
      ) : null}

      <LifetimeVisionEditSheet
        visible={lifetimeVisionEditOpen}
        initialStatement={lifetimeVisionStatement}
        placeholder={
          interestVocab.visionPrompt ?? 'What are you building toward, long-term?'
        }
        onClose={() => setLifetimeVisionEditOpen(false)}
        onSave={async (next) => {
          if (
            dataset.interest.id === 'live' ||
            dataset.interest.id === 'sample'
          ) {
            return;
          }
          await updateLifetimeVision.mutateAsync({
            interestId: dataset.interest.id,
            lifetime_vision_statement: next,
          });
        }}
      />

      <LifetimeReflectionSheet
        visible={reflectionOpen}
        interestLabel={dataset.interest.label}
        recap={{
          totalSteps: dataset.totalSteps,
          arcCount,
          peopleCount,
          throughLine: lifetimeDominant
            ? { label: lifetimeDominant.label, color: lifetimeDominant.color }
            : null,
          duration: lifetimeDuration,
          since: dataset.sinceDate,
        }}
        initialStatement={lifetimeVisionStatement}
        placeholder={
          interestVocab.visionPrompt ?? 'What are you building toward, long-term?'
        }
        onClose={() => setReflectionOpen(false)}
        onSave={async (next) => {
          if (!canEditVision) return;
          await updateLifetimeVision.mutateAsync({
            interestId: dataset.interest.id,
            lifetime_vision_statement: next,
          });
        }}
      />

      <View style={styles.analysisBlock} onLayout={onAnalysisLayout}>
        {/* Drift river — how the dominant capability shifted between
            arcs. Only at 2+ arcs (drift needs two points); one arc
            shows the poster + chapter alone, never an empty chart. */}
        {drift ? (
          <>
            <Text style={styles.sectionEyebrow}>How your focus drifted</Text>
            <CapabilityMix
              weeklyCapabilities={drift.mix}
              totalWeeks={drift.mix.length}
              currentWeekNumber={drift.mix.length}
              unitLabel={(unit) => drift.labelByColumn.get(unit) ?? `arc ${unit}`}
              width={chartWidth}
              height={150}
            />
            {lifetimeDominant ? (
              <Text style={styles.driftCaption}>
                <Text
                  style={[styles.driftCaptionAccent, { color: lifetimeDominant.color }]}
                >
                  {lifetimeDominant.label}
                </Text>
                {lifetimeDominant.latestLabel &&
                lifetimeDominant.latestLabel !== lifetimeDominant.label
                  ? ` ran through your practice; ${lifetimeDominant.latestLabel} leads now.`
                  : ` ran through your whole practice.`}
              </Text>
            ) : null}
          </>
        ) : null}

        {/* People as constancy sentences — the genuine lifetime payoff.
            Renders its own header + only the peers who span 2+ arcs;
            empty at one arc, where the chapter chips carry "N with
            people" instead. The faint per-session dot chart is gone. */}
        {lifetime ? (
          <PeerConstancyList
            peers={lifetime.peers}
            sessions={lifetime.sessions}
            vocab={interestVocab}
            header={interestVocab.crewHeader}
          />
        ) : null}

        {lifetime?.librarianPrompt && !librarianDismissed ? (
          <LibrarianAnalysisCard
            prompt={{
              ...lifetime.librarianPrompt,
              eyebrow: interestVocab.librarianEyebrow.replace(
                /^This arc/i,
                'Across your practice',
              ),
            }}
            quant={lifetime.quant}
            onPrimary={
              onLibrarianPrimary ??
              (canEditVision ? () => setReflectionOpen(true) : undefined)
            }
            onSecondary={
              onLibrarianSecondary ?? (() => setLibrarianDismissed(true))
            }
          />
        ) : null}
      </View>

      {allTimeRiver.nodes.length > 1 ? (
        <View style={styles.riverSection}>
          <Text style={styles.sectionEyebrow}>EVERY STEP</Text>
          <Text style={styles.sectionSubeyebrow}>
            Your whole practice as one line — done, now, and what&apos;s ahead.
          </Text>
          <View style={styles.riverPad}>
            <SnakeNodeRiver
              nodes={allTimeRiver.nodes}
              progressCount={allTimeRiver.progressCount}
              onPressNode={(id) => {
                const seasonId = allTimeRiver.seasonByStep.get(id);
                if (seasonId) onOpenSeason?.(seasonId);
              }}
            />
          </View>
          <View style={styles.riverLegend}>
            {allTimeRiver.seasonKeys.map((k) => (
              <View key={k.title} style={styles.riverLegendKey}>
                <View
                  style={[styles.riverLegendSwatch, { backgroundColor: k.color }]}
                />
                <Text style={styles.riverLegendText} numberOfLines={1}>
                  {k.title}
                </Text>
              </View>
            ))}
            <View style={styles.riverLegendKey}>
              <Text style={styles.riverLegendStar}>★</Text>
              <Text style={styles.riverLegendText}>milestone</Text>
            </View>
            <View style={styles.riverLegendKey}>
              <View
                style={[styles.riverLegendSwatch, { backgroundColor: '#FF6B5A' }]}
              />
              <Text style={styles.riverLegendText}>now</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.chaptersHeaderRow}>
        <Text style={styles.chaptersTitle} numberOfLines={1}>
          {capitalize(`${periodNoun}s`)}
        </Text>
        {onAddArc || onEditArc ? (
          <Pressable
            onPress={() => setManageMode((m) => !m)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={manageMode ? 'Done editing chapters' : 'Edit chapters'}
          >
            <Text style={styles.chaptersEditLabel}>
              {manageMode ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {manageMode && onAddArc ? (
        <View style={styles.manageActionsRow}>
          <Pressable
            style={styles.selectPill}
            onPress={onAddArc}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`New ${periodNoun}`}
          >
            <Ionicons name="add" size={14} color={IOS_REGISTER.accentUserAction} />
            <Text style={styles.selectPillLabel}>New {periodNoun}</Text>
          </Pressable>
        </View>
      ) : null}

      {dataset.seasons.map((season, idx) => (
        <ChapterCard
          key={season.id}
          season={season}
          isCurrent={idx === 0}
          vocab={interestVocab}
          manageMode={manageMode}
          onOpen={() => onOpenSeason?.(season.id)}
          onEdit={onEditArc ? () => onEditArc(season.id) : undefined}
        />
      ))}
    </ScrollView>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Lifetime poster — the L4 "Years" hero. Photos opens its Years view on
 * a single hero image + a word, not a grid of thumbnails; this is the
 * same move for a practice. A serif sentence states the scale of the
 * whole thing ("You're 240 steps into sail racing — Tactics is the
 * through-line so far") over a quiet gradient tinted by the dominant
 * capability, with a metric trio (steps · arcs · people) beneath.
 *
 * The sentence is adaptive: at one arc it leans on the through-line
 * capability ("…is the through-line so far"); at 2+ arcs it states the
 * scale across chapters and elapsed time. Replaces the old per-session
 * chart that led the view with an apologetic near-empty ruler.
 */
interface LifetimePosterProps {
  interestLabel: string;
  arcCount: number;
  totalSteps: number;
  peopleCount: number;
  periodNoun: string;
  periodPlural: string;
  duration: string | null;
  sinceDate: string | null;
  dominant: { label: string; color: string; latestLabel: string | null } | null;
}

function LifetimePoster({
  interestLabel,
  arcCount,
  totalSteps,
  peopleCount,
  periodNoun,
  periodPlural,
  duration,
  sinceDate,
  dominant,
}: LifetimePosterProps) {
  const tint = dominant?.color ?? '#9D70C9';
  const stepsWord = totalSteps === 1 ? 'step' : 'steps';

  // Adaptive headline. One arc → lean on the through-line capability so
  // a young practice still reads as having a spine. Many arcs → state
  // the scale across chapters + elapsed time.
  const headline =
    arcCount <= 1
      ? dominant
        ? `You're ${totalSteps} ${stepsWord} into ${interestLabel} — ${dominant.label} is the through-line so far.`
        : `You're ${totalSteps} ${stepsWord} into ${interestLabel}.`
      : `${totalSteps} ${stepsWord} across ${arcCount} ${periodPlural}${duration ? `, over ${duration}` : ''}.`;

  const metrics: { value: string; label: string }[] = [
    { value: String(totalSteps), label: stepsWord },
    { value: String(arcCount), label: arcCount === 1 ? periodNoun : periodPlural },
  ];
  if (peopleCount > 0) {
    metrics.push({
      value: String(peopleCount),
      label: peopleCount === 1 ? 'person' : 'people',
    });
  }

  return (
    <LinearGradient
      colors={[withAlpha(tint, 0.22), withAlpha(tint, 0.06)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.poster}
    >
      <Text style={styles.posterHeadline}>{headline}</Text>
      <View style={styles.posterMetrics}>
        {metrics.map((m, i) => (
          <React.Fragment key={m.label}>
            {i > 0 ? <View style={styles.posterMetricDivider} /> : null}
            <View style={styles.posterMetric}>
              <Text style={styles.posterMetricValue}>{m.value}</Text>
              <Text style={styles.posterMetricLabel}>{m.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      {sinceDate ? (
        <Text style={styles.posterSince}>since {sinceDate}</Text>
      ) : null}
    </LinearGradient>
  );
}

/**
 * People constancy list — the emotional payoff for L4 ("Markus has
 * crewed 18 races across 4 campaigns"). Sibling to PeerJourneyChart:
 * the chart shows *when* people showed up; this list says it in
 * sentences so the reader feels the constancy in words.
 *
 * Only renders peers who appear in 2+ arcs. Single-arc peers belong
 * on L3 (the per-arc COHORT lane), not L4 (cross-arc relationships).
 */
interface PeerConstancyListProps {
  peers: LifetimePeer[];
  sessions: LifetimeSession[];
  vocab: InterestVocab;
  /** Optional eyebrow rendered above the rows, only when rows exist. */
  header?: string;
}

function PeerConstancyList({ peers, sessions, vocab, header }: PeerConstancyListProps) {
  const rows = useMemo(() => {
    const sessionLabelByIndex = new Map(
      sessions.map((s) => [s.sessionIndex, s.label] as const),
    );
    // Persona vocab for "arc"-noun. The L4 surface already uses
    // "ARCS" as the universal noun (BROWSE ARCS), so default to that;
    // override per-persona where the native word is sharper.
    const arcNoun = vocab.id === 'nursing' ? 'rotations' : 'arcs';
    const arcNounSingular = vocab.id === 'nursing' ? 'rotation' : 'arc';
    return peers
      .filter((p) => p.sessionAppearances.length >= 2)
      .slice(0, 6)
      .map((p) => {
        const arcs = p.sessionAppearances.length;
        const steps = p.sessionAppearances.reduce((n, s) => n + s.count, 0);
        const firstLabel = sessionLabelByIndex.get(p.firstSessionIndex);
        return {
          id: p.id,
          name: p.name?.trim() || p.initials,
          initials: p.initials,
          color: p.color,
          role: p.role,
          summary: `${steps} step${steps === 1 ? '' : 's'} · ${arcs} ${arcs === 1 ? arcNounSingular : arcNoun}${firstLabel ? ` · since ${firstLabel}` : ''}`,
        };
      });
  }, [peers, sessions, vocab.id]);

  if (rows.length === 0) return null;

  return (
    <View style={styles.constancyList}>
      {header ? (
        <Text style={styles.constancyHeader}>{header}</Text>
      ) : null}
      {rows.map((row) => (
        <View key={row.id} style={styles.constancyRow}>
          <View style={[styles.constancyAvatar, { backgroundColor: row.color }]}>
            <Text style={styles.constancyAvatarLabel}>{row.initials}</Text>
          </View>
          <View style={styles.constancyText}>
            <View style={styles.constancyNameRow}>
              <Text style={styles.constancyName} numberOfLines={1}>
                {row.name}
              </Text>
              {row.role ? (
                <Text style={styles.constancyRole} numberOfLines={1}>
                  · {row.role}
                </Text>
              ) : null}
            </View>
            <Text style={styles.constancySummary} numberOfLines={1}>
              {row.summary}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * D7 lifetime money readout — the L4 dignity surface for a money-on
 * persona. Two beats: ₹ earned per season (a compact bar row that
 * shows the business growing season over season) and the loan-tier
 * progression ("Shishu repaid · 60% toward Kishore") with a thin
 * progress bar. For Savitri her trajectory *is* her case for the next
 * loan — this is the readout a stakeholder cut (D8) will later share.
 *
 * Renders nothing on personas without a money lane; the caller already
 * gates on hasMoneyLane, so this is purely a defensive empty-finance
 * guard.
 */
function MoneyReadout({
  finance,
  config,
}: {
  finance: LifetimeFinance;
  config: MoneyConfig;
}) {
  const perSeason = finance.perSeason;
  if (perSeason.length === 0) return null;
  const maxNet = Math.max(1, ...perSeason.map((s) => s.net));
  const tier = resolveLoanTier(finance.totalEarned, config);
  const BAR_MAX = 44;

  return (
    <View style={styles.moneyReadout}>
      <View style={styles.moneyReadoutHeader}>
        <Text style={styles.moneyReadoutEyebrow}>MONEY OVER TIME</Text>
        <Text style={styles.moneyReadoutTotal}>
          {formatMoney(finance.totalEarned, config, { compact: true })} earned
        </Text>
      </View>

      <View style={styles.moneySeasonRow}>
        {perSeason.map((s) => {
          const h = Math.max(3, (s.net / maxNet) * BAR_MAX);
          return (
            <View key={s.seasonId ?? s.label} style={styles.moneySeasonCol}>
              <Text style={styles.moneySeasonAmount} numberOfLines={1}>
                {formatMoney(s.net, config, { compact: true })}
              </Text>
              <View style={[styles.moneySeasonBar, { height: h }]} />
              <Text style={styles.moneySeasonLabel} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>

      {tier ? (
        <View style={styles.loanTierBlock}>
          <Text style={styles.loanTierLine} numberOfLines={1}>
            <Text style={styles.loanTierCurrent}>{tier.current.label}</Text>
            {tier.next
              ? ` reached · ${Math.round(tier.fraction * 100)}% toward `
              : ' — top tier reached'}
            {tier.next ? (
              <Text style={styles.loanTierNext}>{tier.next.label}</Text>
            ) : null}
          </Text>
          {tier.next ? (
            <View style={styles.loanTierTrack}>
              <View
                style={[
                  styles.loanTierFill,
                  { width: `${Math.round(tier.fraction * 100)}%` },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Chapter card — the L4 unit replacing the brick lane. Reads like a
 * Photos/Notes chapter: persona-native title + date, one human subtitle
 * ("14 steps · Gesture · solo"), a single proportional capability
 * mix-strip (not a wall of bricks), and the chapter's first milestone.
 * The whole card is the tap target → drill into that arc at L3, where
 * week-granular bricks earn their place. Per-chapter editing hides
 * behind the list's Edit toggle.
 */
interface ChapterCardProps {
  season: TimelineSeason;
  isCurrent: boolean;
  vocab: InterestVocab;
  manageMode: boolean;
  onOpen: () => void;
  onEdit?: () => void;
}

function ChapterCard({
  season,
  isCurrent,
  vocab,
  manageMode,
  onOpen,
  onEdit,
}: ChapterCardProps) {
  const summary = useMemo(() => {
    const labelCounts = new Map<
      string,
      { label: string; color: string; count: number }
    >();
    const titles: string[] = [];
    let withOthersCount = 0;
    let doneCount = 0;
    for (const brick of season.bricks) {
      if (brick.capabilityLabel) {
        const existing = labelCounts.get(brick.capabilityLabel);
        if (existing) existing.count += 1;
        else
          labelCounts.set(brick.capabilityLabel, {
            label: brick.capabilityLabel,
            color: brick.capabilityColor,
            count: 1,
          });
      }
      if (brick.title) titles.push(brick.title);
      if (brick.withOthers) withOthersCount += 1;
      if (brick.status === 'done' || brick.status === 'reflected') doneCount += 1;
    }
    let categoryDominant: { label: string; color: string; count: number } | null =
      null;
    for (const bucket of labelCounts.values()) {
      if (!categoryDominant || bucket.count > categoryDominant.count)
        categoryDominant = bucket;
    }
    // Prefer the title-pattern label ("Tactics", "Starts") over the
    // often-generic category for the subtitle's middle phrase.
    const titleBasedLabel = detectPhaseLabelFromTitles(titles, vocab);
    const milestone = detectMilestoneTitles(titles, vocab, 1)[0] ?? null;
    // Proportional mix-strip — top capabilities by share, normalized so
    // the bar fills regardless of unlabeled bricks.
    const sorted = Array.from(labelCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const shownTotal = sorted.reduce((n, b) => n + b.count, 0);
    const bands =
      shownTotal > 0
        ? sorted.map((b) => ({ color: b.color, fraction: b.count / shownTotal }))
        : [];
    return {
      dominantLabel: titleBasedLabel ?? categoryDominant?.label ?? null,
      accentColor: categoryDominant?.color ?? null,
      withOthersCount,
      doneCount,
      totalCount: season.bricks.length,
      milestone,
      bands,
    };
  }, [season.bricks, vocab]);

  const accent = summary.accentColor ?? IOS_REGISTER.labelTertiary;
  const stepCount = season.bricks.length;
  const peoplePhrase =
    summary.withOthersCount > 0
      ? `${summary.withOthersCount} with people`
      : 'solo';
  const dateLabel = isCurrent
    ? `${season.dateRange.split('—')[0].trim()} – now`
    : season.dateRange;

  return (
    <Pressable
      style={[styles.card, isCurrent && styles.cardCurrent]}
      onPress={manageMode ? undefined : onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${season.title}`}
    >
      <View style={[styles.cardAccentBar, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {season.title}
            </Text>
            {isCurrent ? (
              <Text style={[styles.currentFlag, { color: accent }]}>CURRENT</Text>
            ) : null}
          </View>
          <Text style={styles.cardDate} numberOfLines={1}>
            {dateLabel}
          </Text>
        </View>

        <Text style={styles.cardSubtitle} numberOfLines={1}>
          <Text style={styles.cardSubtitleStrong}>
            {stepCount} step{stepCount === 1 ? '' : 's'}
          </Text>
          {summary.dominantLabel ? ` · ${summary.dominantLabel}` : ''}
          {` · ${peoplePhrase}`}
        </Text>

        {summary.bands.length > 0 ? (
          <View style={styles.mixStrip}>
            {summary.bands.map((b, i) => (
              <View
                key={`${b.color}-${i}`}
                style={{
                  width: `${(b.fraction * 100).toFixed(2)}%` as `${number}%`,
                  backgroundColor: b.color,
                  height: '100%',
                }}
              />
            ))}
          </View>
        ) : null}

        {summary.milestone ? (
          <View style={styles.cardMilestoneRow}>
            <Ionicons name="sparkles" size={11} color={accent} />
            <Text style={styles.cardMilestoneText} numberOfLines={1}>
              {summary.milestone}
            </Text>
          </View>
        ) : null}
      </View>

      {manageMode && onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${season.title}`}
          style={({ pressed }) => [styles.cardTrailing, pressed && styles.lanePressed]}
        >
          <Ionicons name="pencil-outline" size={16} color={IOS_REGISTER.labelSecondary} />
        </Pressable>
      ) : (
        <View style={styles.cardTrailing}>
          <Ionicons name="chevron-forward" size={16} color={IOS_REGISTER.labelTertiary} />
        </View>
      )}
    </Pressable>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.55,
    color: IOS_REGISTER.labelTertiary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
    flexShrink: 1,
  },
  titleChevron: {
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  analysisBlock: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 10,
  },
  riverSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  riverPad: {
    paddingHorizontal: 12,
  },
  riverLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    rowGap: 6,
    marginTop: 12,
    marginHorizontal: 16,
  },
  riverLegendKey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  riverLegendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  riverLegendStar: {
    fontSize: 10,
    color: IOS_REGISTER.labelSecondary,
  },
  riverLegendText: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.1,
  },
  sectionEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginLeft: 16,
    marginBottom: 6,
  },
  sectionEyebrowSpace: {
    marginTop: 18,
  },
  sectionSubeyebrow: {
    fontSize: 11,
    fontStyle: 'italic',
    color: IOS_REGISTER.labelTertiary,
    marginLeft: 16,
    marginTop: -2,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  // Lifetime poster — the L4 hero. Serif scale sentence over a quiet
  // capability-tinted gradient + a metric trio. Leads the view the way
  // Photos' Years view leads on a hero image, not a chart.
  poster: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 16,
  },
  posterHeadline: {
    fontFamily: fontFamily.serif,
    fontSize: 21,
    lineHeight: 28,
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  posterMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 14,
  },
  posterMetric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  posterMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.4,
  },
  posterMetricLabel: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  posterMetricDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: IOS_REGISTER.separator,
  },
  posterSince: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 10,
    letterSpacing: 0.05,
  },
  // Drift caption — one sentence under the per-arc river naming the
  // whole-practice through-line and, when it shifted, the latest lead.
  driftCaption: {
    fontSize: 12.5,
    lineHeight: 18,
    color: IOS_REGISTER.labelSecondary,
    marginHorizontal: 16,
    marginTop: 8,
    letterSpacing: -0.05,
  },
  driftCaptionAccent: {
    fontWeight: '700',
  },
  // Eyebrow above the people-constancy rows; only rendered when at
  // least one cross-arc peer exists.
  constancyHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 2,
  },
  // Chapter list header — persona-native section title ("Sketchbooks",
  // "Rotations") + a deferred "Edit" toggle. Replaces the old uppercase
  // "BROWSE ARCS" eyebrow with a heading you read, not jargon.
  chaptersHeaderRow: {
    paddingLeft: 16,
    // Right inset keeps the Edit/Done affordance clear of the floating
    // ZoomLevelPicker rail (which hovers over the right edge at every level).
    paddingRight: 56,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chaptersTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: IOS_REGISTER.label,
    flexShrink: 1,
  },
  chaptersEditLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  manageActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  // Chapter card — the L4 unit. Capability-accent bar + body + trailing
  // chevron (or pencil in manage mode). Whole card taps to the arc (L3).
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    overflow: 'hidden',
  },
  cardCurrent: {
    borderColor: 'rgba(123, 63, 176, 0.32)',
  },
  cardAccentBar: {
    width: 3,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
    flexShrink: 1,
  },
  currentFlag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardDate: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  cardSubtitleStrong: {
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  mixStrip: {
    flexDirection: 'row',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: IOS_REGISTER.fillPill,
    marginTop: 1,
  },
  cardMilestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardMilestoneText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  cardTrailing: {
    paddingRight: 12,
    paddingLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Lifetime vision banner — D5 second cut. Italic-serif statement at
  // the top of L4 anchoring the chapter ledger beneath it. Quiet
  // prompt when unset so it doesn't feel like a stub.
  lifetimeVisionBanner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(123, 63, 176, 0.06)',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  lifetimeVisionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#7B3FB0',
    marginBottom: 6,
  },
  lifetimeVisionStatement: {
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 24,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  lifetimeVisionPrompt: {
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.labelTertiary,
  },
  // Trajectory arrow — D5 closer. Single horizontal line between the
  // aspirational vision and the historical arcs, naming where you
  // started → where you are now in the persona's own capability
  // vocabulary.
  trajectoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: -2,
  },
  trajectoryDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  trajectoryText: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
    flexShrink: 1,
  },
  trajectoryWhen: {
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  trajectoryLabel: {
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  trajectoryArrow: {
    marginHorizontal: 1,
  },
  // People-constancy list — sibling readout to PeerJourneyChart that
  // names the relationships in sentences instead of lines. Sits
  // directly below the chart so the eye can match a line to a row.
  constancyList: {
    marginTop: 10,
    marginHorizontal: 16,
    gap: 8,
  },
  constancyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  constancyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  constancyAvatarLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  constancyText: {
    flex: 1,
    minWidth: 0,
  },
  constancyNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  constancyName: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  constancyRole: {
    fontSize: 12,
    fontStyle: 'italic',
    color: IOS_REGISTER.labelTertiary,
    flexShrink: 1,
  },
  constancySummary: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 1,
    letterSpacing: 0.05,
  },
  // D7 lifetime money readout — ₹ per season bars + loan-tier
  // progression. Sits between the trajectory arrow and the analysis
  // block so the money story reads alongside the capability story.
  moneyReadout: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingTop: 2,
  },
  moneyReadoutHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  moneyReadoutEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  moneyReadoutTotal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3F8F5E',
    letterSpacing: -0.2,
  },
  moneySeasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  moneySeasonCol: {
    flex: 1,
    alignItems: 'center',
  },
  moneySeasonAmount: {
    fontSize: 9.5,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 3,
  },
  moneySeasonBar: {
    width: '70%',
    borderRadius: 2,
    backgroundColor: '#5BA46F',
  },
  moneySeasonLabel: {
    fontSize: 9,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 4,
  },
  loanTierBlock: {
    gap: 5,
  },
  loanTierLine: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  loanTierCurrent: {
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  loanTierNext: {
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  loanTierTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.fillPill,
    overflow: 'hidden',
  },
  loanTierFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5BA46F',
  },
  lanePressed: {
    opacity: 0.55,
  },
  selectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  selectPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
});
