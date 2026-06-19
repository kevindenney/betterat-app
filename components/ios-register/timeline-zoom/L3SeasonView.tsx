/**
 * L3 — VERB: REFLECTING ON NOW (Screen 09 of v3 screen designs).
 *
 * "Zoom isn't a density slider — it's a verb slider." L3 isn't a smaller
 * L2; it's the mini-REFLECT scoped to the current session. The capability
 * river + peer journey chart + librarian prompt at the top tell the user
 * what this season *means*; the existing week-section list lives below
 * for drill-in and drag-reorder.
 *
 * Composition:
 *   - Header block — title, org chip, "wk N of M"
 *   - Capability-mix chart (CapabilityMix) — stacked-area per week with
 *     planned-vs-proven dual encoding, NOW rule, in-band labels
 *   - Peer journey chart (PeerJourneyChart) — crew arrival timeline
 *   - Season librarian prompt (SeasonLibrarianPrompt) — lilac mid-season
 *     "what do you want this season to add up to?" CTA
 *   - Browse-weeks list — the previous L3 layout, now scrolled below the
 *     analysis layer. Drag-reorder + multi-select still work.
 *
 * When `season.analysis` is absent (data adapter hasn't filled it in
 * yet, or the season is too sparse) the analysis layer is omitted and
 * the view falls back to the original toolbar + week-list.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { SnakeReorderList } from './SnakeTimeline';
import { LinearWorkColumn, WorkColumnLegend } from './LinearWorkColumn';
import { CapabilityMix } from './CapabilityMix';
import { PeerJourneyChart } from './PeerJourneyChart';
import { CrewSparseList } from './CrewSparseList';
import { ANALYSIS_MIN_STEPS, stepHasOwnerReflection } from './realDataAdapter';
import { ReflectionSparkline } from './ReflectionSparkline';
import { VisionBlock } from './VisionBlock';
import { CollapsibleModule } from './CollapsibleModule';
import { VisionEditSheet } from './VisionEditSheet';
import { useUpdateInterestVision } from '@/hooks/useInterestVision';
import { useUpdatePlan, useCreatePlan } from '@/hooks/usePlan';
import { useUserOrgCompetencies } from '@/hooks/useUserOrgCompetencies';
import { useViewerFleetCohort } from '@/hooks/useViewerFleetCohort';
import { LibrarianAnalysisCard } from './LibrarianAnalysisCard';
import { SeasonLibrarianPrompt } from './SeasonLibrarianPrompt';
import { SeasonHeaderChips } from './SeasonHeaderChips';
import { PickerListSheet } from './PickerListSheet';
import { ZOOM_RAIL_RESERVED_WIDTH } from './ZoomLevelPicker';
import { resolveInterestVocab } from './interestVocab';
import {
  anchorIconName,
  getAnchorsForRange,
  type ResolvedAnchor,
} from './interestAnchors';
import {
  formatMoney,
  hasMoneyLane,
  resolveMoneyConfig,
  type MoneyConfig,
} from './interestMoney';
import { HeadlineMetric } from './HeadlineMetric';
import { hasHeadlineMetric, resolveHeadlineMetric } from './interestHeadline';
import type {
  SeasonFinance,
  TimelineDataset,
  TimelineSeason,
  TimelineStep,
} from './types';

/** A step sits behind NOW once it's been acted on — done, reflected, or in
 * review. Everything else (plan/do) is still queued ahead of NOW. Mirrors
 * SnakeTimeline.isPastNow so the partition matches where the river draws NOW. */
function isBehindNow(status: TimelineStep['status']): boolean {
  return status === 'done' || status === 'reflected' || status === 'reflect';
}

interface CapabilityFamily {
  id: string;
  label: string;
  color: string;
  volume: number;
  weeksPresent: number;
}

interface PersonFamily {
  id: string;
  name: string;
  initials: string;
  /** Identity color for the avatar bubble (stable per person). */
  color: string;
  /** "preceptor", "cohort", "faculty", "crew"… — small meta after the name. */
  role?: string;
  /** Total contributions across elapsed weeks — the pill's count. */
  count: number;
}

interface L3SeasonViewProps {
  dataset: TimelineDataset;
  focusStepId: string;
  /**
   * Currently displayed season. Lifted to the canvas so the choice
   * survives zoom-level changes. Falls back to dataset.currentSeasonId.
   */
  selectedSeasonId?: string;
  onSelectSeason?: (seasonId: string) => void;
  onOpenStep: (stepId: string) => void;
  /** Open a step's Reflect tab to capture evidence + a reflection. Drives
   *  the librarian card's capture CTAs. */
  onReflectOnStep?: (stepId: string) => void;
  onEnterSelectMode?: () => void;
  /**
   * Reorder commit. The L3 view resolves the neighbor step IDs from
   * its flat current-season ordering and hands those to the canvas
   * owner, which writes a sort_order between them.
   */
  onReorderStep?: (
    stepId: string,
    beforeStepId: string | null,
    afterStepId: string | null,
  ) => void;
  /**
   * Reorder-time status flip + placement. Fires when a step is dragged across
   * the NOW divider in reorder mode — `toBehind` true means it was dropped
   * into the done-behind zone (intent: mark done), false into the queued-ahead
   * zone (intent: reopen). `beforeStepId`/`afterStepId` are the drop's
   * neighbours WITHIN the target zone, so the owner can land the step where it
   * was dropped (not auto-append). The owner confirms + writes status (and
   * captures), since completion carries side effects a silent flip shouldn't
   * trigger. When omitted, a cross-NOW drag stays on its own side.
   */
  onMoveAcrossNow?: (
    stepId: string,
    toBehind: boolean,
    beforeStepId: string | null,
    afterStepId: string | null,
  ) => void;
  /** Frame 12 multi-select — when true, taps toggle selection instead of opening. */
  selectEnabled?: boolean;
  isSelected?: (stepId: string) => boolean;
  onToggleSelect?: (stepId: string) => void;
  /** Librarian primary CTA tap — defaults to no-op (preview surface). */
  onLibrarianPrimary?: () => void;
  /** Librarian "Not now" tap — defaults to no-op. */
  onLibrarianSecondary?: () => void;
  /** Picker footer "+ New arc" — opens parent's SeasonEditSheet in add mode. */
  onAddArc?: () => void;
  /** Picker per-row pencil — opens parent's SeasonEditSheet in edit mode for this arc. */
  onEditArc?: (arcId: string) => void;
  onAddStep?: () => void;
  /** The parent chrome already owns scope selection; hide the inline counter row. */
  hideInlineCounter?: boolean;
  /** Floating-tab-bar clearance — added to the scroll content's bottom
   *  padding so the last snake row clears the hovering tab bar. */
  bottomInset?: number;
}

export function L3SeasonView({
  dataset,
  focusStepId,
  selectedSeasonId,
  onSelectSeason,
  onOpenStep,
  onReflectOnStep,
  onEnterSelectMode,
  onReorderStep,
  onMoveAcrossNow,
  selectEnabled = false,
  isSelected,
  onToggleSelect,
  onLibrarianPrimary,
  onLibrarianSecondary,
  onAddArc,
  onEditArc,
  onAddStep,
  hideInlineCounter,
  bottomInset = 0,
}: L3SeasonViewProps) {
  const effectiveSeasonId = selectedSeasonId ?? dataset.currentSeasonId;
  const season = dataset.seasons.find((s) => s.id === effectiveSeasonId)
    ?? dataset.seasons.find((s) => s.id === dataset.currentSeasonId);

  const [openPicker, setOpenPicker] = useState<
    'season' | 'step' | 'reflect' | null
  >(null);
  // Active capability thread — set when the user taps a band on the
  // CapabilityMix chart or a chip below it. Drives chart isolation AND
  // inline filtering of the BROWSE WEEKS list (the unified surface: the
  // chart is the selector for the log), replacing the old drill-in sheet.
  const [activeThread, setActiveThread] = useState<
    { id: string; label: string; color: string } | null
  >(null);
  // Active person filter — set when the user taps a WHO SHAPED IT pill.
  // Mutually exclusive with activeThread: the log filters by capability
  // OR by person, never both, so the filter bar reads as one clear lens.
  const [activePerson, setActivePerson] = useState<
    { id: string; name: string; color: string } | null
  >(null);
  const toggleThread = useCallback(
    (next: { id: string; label: string; color: string }) => {
      setActivePerson(null);
      setActiveThread((prev) => (prev?.id === next.id ? null : next));
    },
    [],
  );
  const togglePerson = useCallback(
    (next: { id: string; name: string; color: string }) => {
      setActiveThread(null);
      setActivePerson((prev) => (prev?.id === next.id ? null : next));
    },
    [],
  );
  // VISION lane edit sheet open state + handlers.
  const [visionEditOpen, setVisionEditOpen] = useState(false);
  const updateInterestVision = useUpdateInterestVision();
  const updatePlan = useUpdatePlan();
  const createPlan = useCreatePlan();
  const { data: orgCompetencies = [] } = useUserOrgCompetencies(dataset.interest.slug);
  // FLEET section grouping — falls back to flat render when the
  // viewer has no fleets or no shared-fleet peers.
  const { data: fleetCohort } = useViewerFleetCohort();
  const scrollRef = useRef<ScrollView>(null);

  // Reorder mode — long-press a snake card (or the "Reorder" toolbar
  // button) flattens THE WORK into a single-column drag list. While a
  // row is lifted, the outer ScrollView is frozen so the finger drives
  // the drag, not the scroll.
  const [isReordering, setIsReordering] = useState(false);
  const [reorderDragging, setReorderDragging] = useState(false);

  // Flatten the current season's steps into one ordered list. The drag
  // hook reasons in this flat coordinate space; the UI still renders
  // them grouped by week. Row layouts are stored per step id so the
  // grouping doesn't matter for hit-testing.
  const flatSteps: TimelineStep[] = useMemo(() => {
    if (!season) return [];
    return season.weeks.flatMap((w) => w.steps);
  }, [season]);

  // Reflect-picker target — the step the card's CTA pre-selects (option A
  // default inside the option-B picker). Prefer the most-recent elapsed
  // step (non-'plan') that still lacks an owner reflection, so the nudge
  // lands on the freshest gap. Fall back to the focused step, then the
  // last step in the season.
  const reflectTargetId: string | undefined = useMemo(() => {
    if (flatSteps.length === 0) return undefined;
    for (let i = flatSteps.length - 1; i >= 0; i -= 1) {
      const s = flatSteps[i];
      if (s.pinnedFromOtherInterest) continue;
      if (s.status === 'plan') continue;
      if (!stepHasOwnerReflection(s)) return s.id;
    }
    if (focusStepId && flatSteps.some((s) => s.id === focusStepId)) {
      return focusStepId;
    }
    return flatSteps[flatSteps.length - 1]?.id;
  }, [flatSteps, focusStepId]);

  // BROWSE WEEKS, filtered to the active capability thread. A step
  // belongs to the thread when any of its capabilities shares the
  // thread's id (clean palette case) or color (steps that author a
  // bespoke capability sharing the family's hue, e.g. "Cardio
  // assessment" under Cardio). Whole empty weeks drop out so the log
  // collapses to just the weeks that touched the thread.
  const visibleWeeks = useMemo(() => {
    const weeks = season?.weeks ?? [];
    if (activeThread) {
      return weeks
        .map((w) => ({
          ...w,
          steps: w.steps.filter((s) =>
            (s.capabilities ?? []).some(
              (c) => c.id === activeThread.id || c.color === activeThread.color,
            ),
          ),
        }))
        .filter((w) => w.steps.length > 0);
    }
    if (activePerson) {
      // A step belongs to a person when they're tagged on it (cohort
      // avatar id matches the peer id) or — for blueprint-author peers
      // (`bp:<name>`) — when the step came from a blueprint they wrote.
      const pid = activePerson.id;
      const matchesPerson = (s: TimelineStep) => {
        if ((s.cohortAvatars ?? []).some((a) => a.id === pid)) return true;
        const author = s.from?.suggestedBy?.trim().toLowerCase();
        return Boolean(author) && `bp:${author}` === pid;
      };
      return weeks
        .map((w) => ({ ...w, steps: w.steps.filter(matchesPerson) }))
        .filter((w) => w.steps.length > 0);
    }
    return weeks;
  }, [season?.weeks, activeThread, activePerson]);

  // THE WORK renders as a NOW-anchored snake river. The river assumes a clean
  // done → NOW → planned ordering, but `sort_order` is a fluid working queue
  // where completed prep can sit anywhere. Partition the flat list so every
  // step you've already done sits behind NOW and everything still queued sits
  // ahead, preserving each group's own sort_order — so the thread reads as a
  // single behind/ahead sequence around NOW instead of a jumble of pills.
  const snakeSteps = useMemo(() => {
    const flat = visibleWeeks.flatMap((w) => w.steps);
    const behindNow = flat.filter((s) => isBehindNow(s.status));
    const ahead = flat.filter((s) => !isBehindNow(s.status));
    return [...behindNow, ...ahead];
  }, [visibleWeeks]);

  // Reorder list order MUST match the work view (snakeSteps), or dragging
  // reads as scrambled — the river shows done-behind then queued-ahead, but
  // raw sort_order interleaves the two. Same partition as snakeSteps, off the
  // unfiltered list (reorder is only offered unfiltered).
  const orderedSteps = useMemo(() => {
    const behindNow = flatSteps.filter((s) => isBehindNow(s.status));
    const ahead = flatSteps.filter((s) => !isBehindNow(s.status));
    return [...behindNow, ...ahead];
  }, [flatSteps]);

  // Reorder commit. The drag hook reasons in index space over the SAME list we
  // render (orderedSteps). The canvas owner writes sort_order between two
  // neighbours — but sort_order only orders WITHIN a partition (done-behind vs
  // queued-ahead), never across NOW. So we resolve the moved step's nearest
  // SAME-partition neighbours; a cross-partition neighbour would write an
  // out-of-range position that the next render's partition would snap back.
  const handleReorder = useCallback(
    (stepId: string, fromIndex: number, toIndex: number) => {
      if (!onReorderStep || fromIndex === toIndex) return;
      const next = [...orderedSteps];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);
      const pos = next.findIndex((s) => s.id === stepId);
      if (pos < 0) return;
      const movedBehind = isBehindNow(moved.status);

      // Did the drop land on the OTHER side of NOW? orderedSteps is
      // [behind…, ahead…]; after removing the moved step, the behind zone is
      // [0 … remainingBehind-1] and the drop slot is "behind" when its index
      // falls inside it. A side change is an intent to flip status (mark done
      // / reopen) — but it's ALSO a placement: the step should land where it
      // was dropped, in the NEW zone. So resolve neighbours in the target
      // partition and hand both the flip and the drop position to the owner's
      // guarded flow; skip the normal same-side sort_order write.
      // Neighbours are resolved in the DROP zone (targetBehind) — which equals
      // the step's own zone for a same-side reorder, or the new zone for a
      // cross-NOW flip, so placement is correct either way.
      const behindCount = orderedSteps.filter((s) => isBehindNow(s.status)).length;
      const remainingBehind = behindCount - (movedBehind ? 1 : 0);
      const targetBehind = toIndex < remainingBehind;
      let beforeStepId: string | null = null;
      for (let i = pos - 1; i >= 0; i -= 1) {
        if (isBehindNow(next[i].status) === targetBehind) {
          beforeStepId = next[i].id;
          break;
        }
      }
      let afterStepId: string | null = null;
      for (let i = pos + 1; i < next.length; i += 1) {
        if (isBehindNow(next[i].status) === targetBehind) {
          afterStepId = next[i].id;
          break;
        }
      }
      if (targetBehind !== movedBehind && onMoveAcrossNow) {
        onMoveAcrossNow(stepId, targetBehind, beforeStepId, afterStepId);
        return;
      }
      onReorderStep(stepId, beforeStepId, afterStepId);
    },
    [onReorderStep, onMoveAcrossNow, orderedSteps],
  );

  // Reorder is only offered on the unfiltered full-season list (a partial
  // capability/person view can't express a global order). Leaving filter
  // mode while reordering drops back to the snake.
  const canReorder = Boolean(onReorderStep) && flatSteps.length > 1;
  const isFiltering = activeThread !== null || activePerson !== null;
  const enterReorder = useCallback(() => {
    if (canReorder && !isFiltering) setIsReordering(true);
  }, [canReorder, isFiltering]);
  const exitReorder = useCallback(() => {
    setIsReordering(false);
    setReorderDragging(false);
  }, []);

  // Every capability family across the weeks elapsed so far, sorted by
  // volume. Drives both the serif takeaway headline (families[0]) and
  // the tappable chip row beneath the band chart — each chip isolates a
  // thread (chart dimming + inline week-list filter), same as tapping
  // the band itself. Keyed by `capabilityId ?? capabilityColor` to match
  // CapabilityMix's band ids exactly, so chip taps and band taps drive
  // the same thread.
  // Computed before the `!season` guard so the hook order stays stable.
  const capabilityFamilies = useMemo(() => {
    const a = season?.analysis;
    if (!a) return { families: [] as CapabilityFamily[], elapsed: 1 };
    const total = season!.weekOfTotal?.total ?? season!.weeks.length;
    const current = season!.weekOfTotal?.current ?? 1;
    const elapsed = Math.max(1, Math.min(current, total));
    const byFamily = new Map<
      string,
      { id: string; label: string; color: string; volume: number; weeks: Set<number> }
    >();
    for (const wk of a.weeklyCapabilities) {
      if (wk.weekNumber > elapsed) continue;
      for (const band of wk.bands) {
        const label = band.capabilityLabel;
        if (!label) continue;
        const vol =
          band.volume ??
          (band.plannedVolume ?? 0) + (band.provenVolume ?? 0);
        if (vol <= 0) continue;
        const id = band.capabilityId ?? band.capabilityColor;
        const entry = byFamily.get(id);
        if (entry) {
          entry.volume += vol;
          entry.weeks.add(wk.weekNumber);
        } else {
          byFamily.set(id, {
            id,
            label,
            color: band.capabilityColor,
            volume: vol,
            weeks: new Set([wk.weekNumber]),
          });
        }
      }
    }
    const families: CapabilityFamily[] = Array.from(byFamily.values())
      .map((f) => ({
        id: f.id,
        label: f.label,
        color: f.color,
        volume: f.volume,
        weeksPresent: f.weeks.size,
      }))
      .sort((a, b) =>
        b.volume !== a.volume ? b.volume - a.volume : a.label.localeCompare(b.label),
      );
    return { families, elapsed };
  }, [season]);

  // WHO SHAPED IT — every person who had input across elapsed weeks,
  // sorted by contribution count. Drives the tappable people pills that
  // mirror the capability chips: each pill isolates that person and
  // filters THE WORK log to the steps they touched (the people half of
  // the unified-surface "tap a thread or a person to filter the log").
  const peopleFamilies = useMemo<PersonFamily[]>(() => {
    const a = season?.analysis;
    if (!a || a.peers.length === 0) return [];
    const total = season!.weekOfTotal?.total ?? season!.weeks.length;
    const current = season!.weekOfTotal?.current ?? 1;
    const elapsed = Math.max(1, Math.min(current, total));
    return a.peers
      .map((p) => ({
        id: p.id,
        name: p.name?.trim() || `Peer ${p.initials}`,
        initials: p.initials,
        color: p.color,
        role: p.role,
        count: p.weeklyAppearances.reduce(
          (n, w) => (w.weekNumber <= elapsed ? n + w.count : n),
          0,
        ),
      }))
      .filter((p) => p.count > 0)
      .sort((a, b) =>
        b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name),
      );
  }, [season]);

  if (!season) return null;

  const analysis = season.analysis;
  const totalWeeks = season.weekOfTotal?.total ?? season.weeks.length;
  const currentWeek = season.weekOfTotal?.current ?? 1;

  // Dominant family drives the serif takeaway headline above the chart.
  const capabilityHeadline =
    capabilityFamilies.families.length > 0
      ? { ...capabilityFamilies.families[0], elapsed: capabilityFamilies.elapsed }
      : null;

  // Weeks where at least one reflection landed — drives the inline
  // "you paused wk 3 · wk 5" caption that replaces the old titled
  // REFLECTIONS chart header.
  const pauseWeeks = (analysis?.reflectionDensity ?? [])
    .filter((d) => d.count > 0)
    .map((d) => d.weekNumber);

  // Resolve interest-native vocab — the eyebrow verb above the season
  // title and the librarian card eyebrow should speak the user's
  // domain (sailor → "TUNING UP", entrepreneur → "PLANNING") instead
  // of the generic system label.
  const interestVocab = resolveInterestVocab(
    dataset.interest.id,
    dataset.interest.label,
  );
  // "Step N of M" for the step-counter chip. Picks the focused step's
  // ordinal within the flat season list when known; falls back to 1.
  const focusedStepIndex = flatSteps.findIndex((s) => s.id === focusStepId);
  const stepOfTotal =
    flatSteps.length > 0
      ? { current: focusedStepIndex >= 0 ? focusedStepIndex + 1 : 1, total: flatSteps.length }
      : undefined;
  const arcSubtitle = (() => {
    const weekCount = season.weekOfTotal?.total ?? season.weeks.length;
    const stepCount = flatSteps.length;
    const parts = [
      `${weekCount} ${weekCount === 1 ? 'week' : 'weeks'}`,
      `${stepCount} ${stepCount === 1 ? 'step' : 'steps'}`,
    ];
    if (season.dateRange) parts.push(season.dateRange);
    return parts.join(' · ');
  })();

  const hasAnalysis = Boolean(analysis);
  const filtering = activeThread !== null || activePerson !== null;
  // The single active lens (capability thread or person) — drives the
  // filter bar pill above THE WORK regardless of which kind is active.
  const activeFilter = activeThread
    ? {
        label: activeThread.label,
        color: activeThread.color,
        clear: () => setActiveThread(null),
      }
    : activePerson
      ? {
          label: activePerson.name,
          color: activePerson.color,
          clear: () => setActivePerson(null),
        }
      : null;
  return (
    <>
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        selectEnabled && styles.scrollContentSelecting,
        { paddingBottom: bottomInset + (selectEnabled ? 160 : 96) },
      ]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!reorderDragging}
    >
      <SeasonHeaderChips
        seasonTitle={season.title}
        periodNoun={interestVocab.periodNoun}
        subtitle={arcSubtitle}
        weekOfTotal={hideInlineCounter ? undefined : season.weekOfTotal}
        stepOfTotal={hideInlineCounter ? undefined : stepOfTotal}
        onPressSeason={() => setOpenPicker('season')}
        onPressStep={() => setOpenPicker('step')}
      />

      <VisionBlock
        statement={season.visionStatement}
        periodNoun={interestVocab.periodNoun}
        competencyIds={season.visionCompetencyIds ?? []}
        allCompetencies={orgCompetencies}
        totalWeeks={totalWeeks}
        currentWeek={currentWeek}
        provenEvidenceCount={
          analysis?.weeklyCapabilities.reduce(
            (n, w) =>
              n +
              w.bands.reduce((m, b) => m + (b.provenVolume ?? 0), 0),
            0,
          ) ?? 0
        }
        evidenceByCompetency={season.visionEvidenceByCompetency ?? {}}
        evidenceTrendByCompetency={season.visionEvidenceTrendByCompetency ?? {}}
        evidenceTrend={season.visionEvidenceTrend ?? []}
        onEdit={() => setVisionEditOpen(true)}
      />

      <AnchorStrip
        anchors={getAnchorsForRange(
          interestVocab.id,
          season.startDateISO,
          season.endDateISO,
        )}
      />

      {hasHeadlineMetric(interestVocab.id)
        ? (() => {
            const cfg = resolveHeadlineMetric(interestVocab.id)!;
            const v = cfg.resolveSeason(season);
            return v ? <HeadlineMetric label={cfg.label} value={v} /> : null;
          })()
        : null}

      {hasMoneyLane(interestVocab.id) && season.finance ? (
        <MoneyLane
          finance={season.finance}
          config={resolveMoneyConfig(interestVocab.id)!}
        />
      ) : null}

      {hasAnalysis && analysis ? (
        <View style={styles.analysisBlock}>
          {/* CAPABILITIES — the band river + its legend/filter chips, folded
              into one collapsible card so the arc rests calm. */}
          <CollapsibleModule
            icon="color-filter-outline"
            label={interestVocab.capabilityHeader}
            headline={
              capabilityHeadline
                ? `${capabilityHeadline.label}${
                    capabilityHeadline.elapsed > 1
                      ? ` · ${capabilityHeadline.weeksPresent}/${capabilityHeadline.elapsed} wks`
                      : ''
                  }`
                : undefined
            }
          >
            {(w) => (
              <>
                {flatSteps.length >= ANALYSIS_MIN_STEPS ? (
                  <>
                    {capabilityHeadline ? (
                      <Text style={[styles.sectionHeadline, styles.moduleHeadline]}>
                        <Text
                          style={[
                            styles.sectionHeadlineAccent,
                            { color: capabilityHeadline.color },
                          ]}
                        >
                          {capabilityHeadline.label}
                        </Text>
                        {capabilityHeadline.elapsed > 1
                          ? ` has anchored this ${interestVocab.periodNoun} — ${capabilityHeadline.weeksPresent} of ${capabilityHeadline.elapsed} weeks.`
                          : ` is anchoring this ${interestVocab.periodNoun} so far.`}
                      </Text>
                    ) : null}
                    <CapabilityMix
                      weeklyCapabilities={analysis.weeklyCapabilities}
                      totalWeeks={totalWeeks}
                      currentWeekNumber={currentWeek}
                      reflections={analysis.reflections}
                      markers={analysis.markers?.map((m) => ({
                        id: m.id,
                        weekNumber: m.weekNumber,
                        label: m.label,
                        color: m.capabilityColor,
                      }))}
                      width={Math.max(0, w - (ZOOM_RAIL_RESERVED_WIDTH - 16))}
                      height={188}
                      isolatedCapabilityId={activeThread?.id ?? null}
                      showBandLabels={false}
                      onCapabilityPress={(id, label, color) =>
                        toggleThread({ id, label, color })
                      }
                    />
                  </>
                ) : (
                  <View style={styles.riverEmpty}>
                    <Text style={styles.riverEmptyText}>
                      Add a few more steps to see how your work spreads across capabilities.
                    </Text>
                  </View>
                )}

                {/* CAPABILITIES pills — the river chart's legend AND its
                    drill-in filter. The bands carry no inline labels: these
                    dot·name·count chips are the only thing that tells a
                    sailor or nursing student what each colour means. Tap to
                    isolate a thread (chart dims + THE WORK filters). */}
                {capabilityFamilies.families.length > 0 &&
                flatSteps.length >= ANALYSIS_MIN_STEPS ? (
                  <View style={styles.cluster}>
                    <View style={styles.capChipsWrap}>
                      {capabilityFamilies.families.slice(0, 6).map((f) => {
                        const active = activeThread?.id === f.id;
                        return (
                          <Pressable
                            key={f.id}
                            style={[
                              styles.capChip,
                              active && [styles.capChipActive, { borderColor: f.color }],
                            ]}
                            onPress={() =>
                              toggleThread({ id: f.id, label: f.label, color: f.color })
                            }
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`${f.label}, ${f.volume} ${
                              f.volume === 1 ? 'step' : 'steps'
                            } — ${active ? 'showing only this thread' : 'isolate this thread'}`}
                          >
                            <View style={[styles.capChipDot, { backgroundColor: f.color }]} />
                            <Text style={styles.capChipLabel} numberOfLines={1}>
                              {f.label}
                            </Text>
                            <Text style={styles.capChipCount}>{f.volume}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.capChipsCaption}>
                      {activeThread
                        ? 'Showing only this thread below — tap it again to clear'
                        : 'Tap a capability to filter the log'}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </CollapsibleModule>

          {/* REFLECTIONS — pause sparkline + capture nudge. Capture the
              density into a const so its non-undefined narrowing survives
              into the render-prop closure below. */}
          {(() => {
            const density = analysis.reflectionDensity;
            if (!density || density.length === 0) return null;
            return (
              <CollapsibleModule
                icon="sparkles-outline"
                label="Reflections"
                headline={
                  pauseWeeks.length > 0
                    ? `Paused ${pauseWeeks.map((w) => `wk ${w}`).join(' · ')}`
                    : `No pauses yet this ${interestVocab.periodNoun}`
                }
              >
                {(w) => (
                  <>
                    {/* Below the river's step threshold the arc has a single
                        bucket-week, so the sparkline degenerates to one floating
                        blob — keep just the caption. */}
                    {flatSteps.length >= ANALYSIS_MIN_STEPS ? (
                      <View style={styles.sparklineWrap}>
                        <ReflectionSparkline
                          density={density}
                          totalWeeks={totalWeeks}
                          currentWeekNumber={currentWeek}
                          width={Math.max(0, w - (ZOOM_RAIL_RESERVED_WIDTH - 16))}
                          height={16}
                        />
                      </View>
                    ) : null}
                    <Text style={styles.reflectionCaption}>
                      <Text style={styles.reflectionCaptionAccent}>✷ Reflections</Text>
                      {pauseWeeks.length > 0
                        ? ` — you paused ${pauseWeeks
                            .map((wk) => `wk ${wk}`)
                            .join(' · ')}`
                        : ` — no reflection pauses yet this ${interestVocab.periodNoun}`}
                    </Text>
                    {onReflectOnStep ? (
                      <Pressable
                        onPress={() => setOpenPicker('reflect')}
                        style={({ pressed }) => [
                          styles.moduleCta,
                          pressed && styles.moduleCtaPressed,
                        ]}
                      >
                        <Text style={styles.moduleCtaText}>Reflect now →</Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </CollapsibleModule>
            );
          })()}

          {/* CREW — cohort journey + the people who shaped the arc. */}
          {analysis.peers.length > 0 ? (
            <CollapsibleModule
              icon="people-outline"
              label={interestVocab.crewHeader}
              headline={
                analysis.cohortHeadline
                  ? `${analysis.cohortHeadline.name}${
                      analysis.cohortHeadline.elapsed > 1
                        ? ` · ${analysis.cohortHeadline.weeksPresent}/${analysis.cohortHeadline.elapsed} wks`
                        : ''
                    }`
                  : undefined
              }
            >
              {(w) => (
                <>
                  {analysis.cohortHeadline ? (
                    <Text style={[styles.sectionHeadline, styles.moduleHeadline]}>
                      <Text
                        style={[
                          styles.sectionHeadlineAccent,
                          { color: analysis.cohortHeadline.color },
                        ]}
                      >
                        {analysis.cohortHeadline.name}
                      </Text>
                      {analysis.cohortHeadline.elapsed > 1
                        ? ` shaped this ${interestVocab.periodNoun} most — ${analysis.cohortHeadline.weeksPresent} of ${analysis.cohortHeadline.elapsed} weeks.`
                        : ` is shaping this ${interestVocab.periodNoun} so far.`}
                    </Text>
                  ) : null}
                  {isSparseCrew(analysis.peers) ||
                  flatSteps.length < ANALYSIS_MIN_STEPS ? (
                    <CrewSparseList
                      peers={analysis.peers}
                      totalWeeks={totalWeeks}
                      isolatedPeerId={activePerson?.id ?? null}
                    />
                  ) : (
                    <PeerJourneyChart
                      peers={analysis.peers}
                      totalWeeks={totalWeeks}
                      currentWeekNumber={currentWeek}
                      width={Math.max(0, w - (ZOOM_RAIL_RESERVED_WIDTH - 16))}
                      compact={analysis.peers.length <= 3}
                      showLegend={false}
                      peerSharedFleets={fleetCohort?.peerToFleets}
                      viewerFleets={fleetCohort?.fleets}
                      isolatedPeerId={activePerson?.id ?? null}
                    />
                  )}

                  {/* WHO SHAPED IT pills — mirror the capability pills. Each
                      isolates one person and filters THE WORK to their steps. */}
                  {peopleFamilies.length > 0 ? (
                    <View style={styles.cluster}>
                      <View style={styles.capChipsWrap}>
                        {peopleFamilies.slice(0, 8).map((p) => {
                          const active = activePerson?.id === p.id;
                          return (
                            <Pressable
                              key={p.id}
                              style={[
                                styles.personChip,
                                active && [styles.capChipActive, { borderColor: p.color }],
                              ]}
                              onPress={() =>
                                togglePerson({ id: p.id, name: p.name, color: p.color })
                              }
                              accessibilityRole="button"
                              accessibilityState={{ selected: active }}
                              accessibilityLabel={`${p.name}${
                                p.role ? `, ${p.role}` : ''
                              }, ${p.count} ${p.count === 1 ? 'step' : 'steps'} — ${
                                active ? 'showing only their steps' : 'isolate their steps'
                              }`}
                            >
                              <View
                                style={[styles.personAvatar, { backgroundColor: p.color }]}
                              >
                                <Text style={styles.personAvatarText}>{p.initials}</Text>
                              </View>
                              <Text style={styles.personName} numberOfLines={1}>
                                {p.name}
                              </Text>
                              {p.role ? (
                                <Text style={styles.personRole} numberOfLines={1}>
                                  {p.role}
                                </Text>
                              ) : null}
                              <Text style={styles.capChipCount}>{p.count}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={styles.capChipsCaption}>
                        {activePerson
                          ? 'Showing only this person below — tap it again to clear'
                          : 'Tap a person to filter the log'}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
            </CollapsibleModule>
          ) : null}

          {analysis.librarianPrompt ? (
            currentWeek <= 2 ? (
              <SeasonLibrarianPrompt
                prompt={{
                  ...analysis.librarianPrompt,
                  eyebrow: interestVocab.librarianEyebrow,
                }}
                onPrimary={onReflectOnStep ? () => setOpenPicker('reflect') : onLibrarianPrimary}
                onSecondary={onLibrarianSecondary}
                variant="compact"
              />
            ) : (
              <LibrarianAnalysisCard
                prompt={{
                  ...analysis.librarianPrompt,
                  eyebrow: interestVocab.librarianEyebrow,
                }}
                quant={analysis.quant}
                onPrimary={onReflectOnStep ? () => setOpenPicker('reflect') : onLibrarianPrimary}
                onSecondary={onLibrarianSecondary}
                onCapture={onReflectOnStep ? () => setOpenPicker('reflect') : undefined}
              />
            )
          ) : null}
        </View>
      ) : null}

      {season.weeks.length === 0 ? (
        <EmptySeasonInline periodNoun={interestVocab.periodNoun} onAddStep={onAddStep} />
      ) : null}

      <Text style={styles.browseEyebrow}>THE WORK</Text>

      {isReordering ? (
        <View style={styles.toolbar}>
          <Text style={styles.logCaption}>Drag to reorder</Text>
          <View style={styles.toolbarActions}>
            <ToolbarButton
              icon="checkmark-circle"
              label="Done"
              onPress={exitReorder}
            />
          </View>
        </View>
      ) : filtering && activeFilter ? (
        <View style={styles.filterBar}>
          <Pressable
            style={[styles.filterPill, { borderColor: activeFilter.color }]}
            onPress={activeFilter.clear}
            accessibilityRole="button"
            accessibilityLabel={`Filtering by ${activeFilter.label} — tap to clear`}
          >
            <View
              style={[styles.filterPillDot, { backgroundColor: activeFilter.color }]}
            />
            <Text style={styles.filterPillLabel} numberOfLines={1}>
              {activeFilter.label}
            </Text>
            <Ionicons name="close" size={13} color={IOS_REGISTER.labelSecondary} />
          </Pressable>
          <Text style={styles.filterCount}>
            {(() => {
              const n = visibleWeeks.reduce((acc, w) => acc + w.steps.length, 0);
              return `${n} ${n === 1 ? 'step' : 'steps'}`;
            })()}
          </Text>
        </View>
      ) : (
        <View style={styles.toolbar}>
          <Text style={styles.logCaption}>
            {(() => {
              const n = flatSteps.length;
              return `${n} ${n === 1 ? 'step' : 'steps'} · done behind, queued ahead`;
            })()}
          </Text>
          <View style={styles.toolbarActions}>
            {canReorder ? (
              <ToolbarButton
                icon="reorder-three-outline"
                label="Reorder"
                onPress={enterReorder}
              />
            ) : null}
            <ToolbarButton
              icon="checkmark-circle-outline"
              label="Select"
              onPress={onEnterSelectMode}
            />
          </View>
        </View>
      )}

      {isReordering ? (
        <SnakeReorderList
          steps={orderedSteps}
          onReorder={handleReorder}
          onDraggingChange={setReorderDragging}
        />
      ) : snakeSteps.length > 0 ? (
        <LinearWorkColumn
          steps={snakeSteps}
          focusStepId={focusStepId}
          selectEnabled={selectEnabled}
          isSelected={isSelected}
          onOpenStep={onOpenStep}
          onToggleSelect={onToggleSelect}
          onLongPressStep={canReorder && !filtering ? enterReorder : undefined}
        />
      ) : null}

      {!isReordering && snakeSteps.length > 0 ? (
        <WorkColumnLegend steps={snakeSteps} anchorNoun={interestVocab.anchorNoun} />
      ) : null}
    </ScrollView>

      <PickerListSheet<TimelineSeason>
        visible={openPicker === 'season'}
        title="Switch arc"
        items={dataset.seasons}
        keyExtractor={(s) => s.id}
        isSelected={(s) => s.id === effectiveSeasonId}
        onSelect={(s) => {
          onSelectSeason?.(s.id);
          setOpenPicker(null);
        }}
        onClose={() => setOpenPicker(null)}
        onRowEdit={onEditArc ? (s) => {
          setOpenPicker(null);
          onEditArc(s.id);
        } : undefined}
        footerAction={onAddArc ? {
          label: 'New arc',
          onPress: () => {
            setOpenPicker(null);
            onAddArc();
          },
        } : undefined}
        renderRow={(s) => {
          // Non-current lanes carry no week data (weeks: []), so fall back
          // to the date range — "0 weeks" reads as a broken arc.
          let wkCount = s.weekOfTotal?.total ?? s.weeks.length;
          if (wkCount === 0 && s.startDateISO && s.endDateISO) {
            const ms =
              new Date(s.endDateISO).getTime() - new Date(s.startDateISO).getTime();
            wkCount = Math.max(1, Math.round(ms / (7 * 24 * 3600 * 1000)));
          }
          return (
            <>
              <View style={styles.pickerTitleRow}>
                <Text style={styles.pickerPrimary} numberOfLines={1}>
                  {s.title}
                </Text>
                {s.archived ? (
                  <View style={styles.pickerArchivedTag}>
                    <Text style={styles.pickerArchivedText}>archived</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.pickerSecondary} numberOfLines={1}>
                {[
                  s.dateRange,
                  wkCount > 0 ? `${wkCount} ${wkCount === 1 ? 'week' : 'weeks'}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </>
          );
        }}
      />

      <PickerListSheet<TimelineStep>
        visible={openPicker === 'step'}
        title="Jump to step"
        items={flatSteps}
        keyExtractor={(s) => s.id}
        isSelected={(s) => s.id === focusStepId}
        onSelect={(s) => {
          setOpenPicker(null);
          onOpenStep(s.id);
        }}
        onClose={() => setOpenPicker(null)}
        renderRow={(s) => {
          const ordinal = flatSteps.findIndex((x) => x.id === s.id) + 1;
          return (
            <>
              <Text style={styles.pickerPrimary} numberOfLines={1}>
                {ordinal}. {s.title}
              </Text>
              {s.preTitle ? (
                <Text style={styles.pickerSecondary} numberOfLines={1}>
                  {s.preTitle}
                </Text>
              ) : null}
            </>
          );
        }}
      />

      <PickerListSheet<TimelineStep>
        visible={openPicker === 'reflect'}
        title="Reflect on a step"
        items={flatSteps}
        keyExtractor={(s) => s.id}
        isSelected={(s) => s.id === reflectTargetId}
        scrollToSelected
        onSelect={(s) => {
          setOpenPicker(null);
          onReflectOnStep?.(s.id);
        }}
        onClose={() => setOpenPicker(null)}
        renderRow={(s) => {
          const ordinal = flatSteps.findIndex((x) => x.id === s.id) + 1;
          const reflected = stepHasOwnerReflection(s);
          return (
            <>
              <Text style={styles.pickerPrimary} numberOfLines={1}>
                {ordinal}. {s.title}
              </Text>
              <Text style={styles.pickerSecondary} numberOfLines={1}>
                {reflected ? 'Reflected' : 'Not reflected yet'}
              </Text>
            </>
          );
        }}
      />

      <VisionEditSheet
        visible={visionEditOpen}
        onClose={() => setVisionEditOpen(false)}
        initialStatement={season.visionStatement}
        initialCompetencyIds={season.visionCompetencyIds}
        interestSlug={dataset.interest.slug}
        onSave={async (statement, competencyIds) => {
          const visionStatement = statement.length > 0 ? statement : null;
          const planId = dataset.activePlanId;
          if (planId) {
            await updatePlan.mutateAsync({
              planId,
              input: {
                vision_statement: visionStatement,
                vision_competency_ids: competencyIds,
              },
            });
          } else {
            // No plan yet for this interest — auto-create one so the
            // vision has a home. Title stays null; the user can name
            // the plan from a dedicated plan-management surface later.
            await createPlan.mutateAsync({
              interest_id: dataset.interest.id,
              vision_statement: visionStatement,
              vision_competency_ids: competencyIds,
            });
          }
          // Mirror the write to user_interests until the legacy
          // fallback path is dropped (slice C) — keeps cross-surface
          // reads consistent during the transition.
          await updateInterestVision.mutateAsync({
            interestId: dataset.interest.id,
            vision_statement: visionStatement,
            vision_competency_ids: competencyIds,
          });
        }}
      />
    </>
  );
}

function EmptySeasonInline({
  periodNoun,
  onAddStep,
}: {
  periodNoun: string;
  onAddStep?: () => void;
}) {
  return (
    <View style={styles.emptyInline}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="leaf-outline" size={22} color={IOS_REGISTER.labelTertiary} />
      </View>
      <Text style={styles.emptyTitle}>This {periodNoun} is just starting</Text>
      <Text style={styles.emptyBody}>
        Add a step to begin the {periodNoun}. The capability river will fill in as you practice.
      </Text>
      {onAddStep ? (
        <Pressable style={styles.emptyCta} onPress={onAddStep}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.emptyCtaText}>Add a step</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ToolbarButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.toolBtn} onPress={onPress}>
      <Ionicons name={icon} size={14} color={IOS_REGISTER.accentUserAction} />
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

// CREW data is "sparse" when the chart would be mostly whitespace. We
// switch to a logbook-style list in that case so a single contribution
// reads as "Name · suggested it · week 7", not a lonely dot on the
// right edge of an empty x-axis.
function isSparseCrew(peers: SeasonPeerLike[]): boolean {
  if (peers.length === 0) return true;
  if (peers.length > 2) return false;
  const total = peers.reduce(
    (n, p) => n + p.weeklyAppearances.reduce((m, w) => m + w.count, 0),
    0,
  );
  return total <= 3;
}
type SeasonPeerLike = { weeklyAppearances: { weekNumber: number; count: number }[] };

/**
 * D6 first cut — external anchor strip. Sits below VISION and above
 * the capability river, surfacing persona-tuned time pegs that fall
 * inside the current season (race weeks, exam windows, festival days,
 * fiscal deadlines). The user doesn't add these; the persona vocab
 * knows them.
 *
 * Hides silently when no anchors match — keeps the surface from
 * leading with a stub on personas (default, golf, knitting) we
 * haven't tuned yet.
 *
 * Days-away labelling uses "today" / "in N weeks" / "passed N weeks
 * ago" so the user sees what's *near* rather than reading a date
 * they'd have to do arithmetic on.
 */
function AnchorStrip({ anchors }: { anchors: ResolvedAnchor[] }) {
  // "COMING UP" only makes sense for anchors that haven't passed. The
  // season range spans past→future, so drop anchors already behind us
  // rather than pairing the header with a "Xmo ago" proximity.
  const upcoming = anchors.filter((a) => a.daysAway >= 0);
  if (upcoming.length === 0) return null;
  return (
    <View style={styles.anchorStrip}>
      <Text style={styles.anchorEyebrow}>COMING UP</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.anchorRow}
      >
        {upcoming.slice(0, 6).map((anchor) => {
          const iconName = anchorIconName(anchor.kind) as keyof typeof Ionicons.glyphMap;
          const proximity = formatAnchorProximity(anchor.daysAway);
          return (
            <View key={anchor.id} style={styles.anchorChip}>
              <Ionicons
                name={iconName}
                size={12}
                color={IOS_REGISTER.labelSecondary}
              />
              <View style={styles.anchorTextWrap}>
                <Text style={styles.anchorLabel} numberOfLines={1}>
                  {anchor.label}
                </Text>
                <Text style={styles.anchorProximity} numberOfLines={1}>
                  {proximity}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * D7 money lane — for money-on personas (entrepreneur), the season's
 * ₹ in / ₹ out is the practice, not a footnote. Renders a per-week
 * net-flow bar chart (green above the baseline for a positive week,
 * red below for a negative one), a season net total, and the working
 * capital on hand. Hidden entirely when the interest hasn't opted into
 * money — a sailor or nurse never sees it.
 *
 * The bars encode net per week (in − out); the eye reads the shape of
 * the season's cash rhythm — a Diwali run-up spike, a lean monsoon
 * trough — without parsing numbers. Tapping isn't wired in this first
 * cut; the lane is a read surface.
 */
function MoneyLane({
  finance,
  config,
}: {
  finance: SeasonFinance;
  config: MoneyConfig;
}) {
  const weekly = finance.weekly;
  if (weekly.length === 0) return null;
  const nets = weekly.map((w) => w.in - w.out);
  const seasonNet = nets.reduce((a, b) => a + b, 0);
  const maxAbs = Math.max(1, ...nets.map((n) => Math.abs(n)));
  const BAR_AREA = 36; // px of half-height above/below the baseline

  return (
    <View style={styles.moneyLane}>
      <View style={styles.moneyHeaderRow}>
        <Text style={styles.anchorEyebrow}>MONEY THIS SEASON</Text>
        <View style={styles.moneyTotals}>
          <Text
            style={[
              styles.moneyNet,
              { color: seasonNet >= 0 ? MONEY_IN : MONEY_OUT },
            ]}
          >
            {formatMoney(seasonNet, config)} net
          </Text>
          <Text style={styles.moneyCapital}>
            {formatMoney(finance.workingCapital, config)} on hand
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.moneyBarsRow}
      >
        {weekly.map((w) => {
          const net = w.in - w.out;
          const positive = net >= 0;
          const h = Math.max(2, (Math.abs(net) / maxAbs) * BAR_AREA);
          return (
            <View key={w.weekNumber} style={styles.moneyBarCol}>
              <View style={styles.moneyBarTop}>
                {positive ? (
                  <View
                    style={[
                      styles.moneyBar,
                      { height: h, backgroundColor: MONEY_IN },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.moneyBaseline} />
              <View style={styles.moneyBarBottom}>
                {!positive ? (
                  <View
                    style={[
                      styles.moneyBar,
                      { height: h, backgroundColor: MONEY_OUT },
                    ]}
                  />
                ) : null}
              </View>
              <Text style={styles.moneyWeekLabel}>{w.weekNumber}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const MONEY_IN = '#5BA46F';
const MONEY_OUT = '#C4474A';

function formatAnchorProximity(daysAway: number): string {
  if (daysAway === 0) return 'today';
  if (daysAway > 0 && daysAway < 7) return `in ${daysAway}d`;
  if (daysAway >= 7 && daysAway < 60) {
    const weeks = Math.round(daysAway / 7);
    return `in ${weeks}w`;
  }
  if (daysAway >= 60) {
    const months = Math.round(daysAway / 30);
    return `in ${months}mo`;
  }
  // Past
  const abs = Math.abs(daysAway);
  if (abs < 7) return `${abs}d ago`;
  if (abs < 60) return `${Math.round(abs / 7)}w ago`;
  return `${Math.round(abs / 30)}mo ago`;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  scrollContentSelecting: { paddingBottom: 260 },
  pickerPrimary: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  pickerSecondary: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 3,
  },
  pickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerArchivedTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  pickerArchivedText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  analysisBlock: {
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 18,
  },
  sectionHeadline: {
    fontFamily: fontFamily.serif,
    fontSize: 16,
    lineHeight: 21,
    color: IOS_REGISTER.label,
    marginLeft: 16,
    marginRight: 16,
    marginTop: 1,
    marginBottom: 10,
  },
  sectionHeadlineAccent: {
    fontWeight: '600',
  },
  // The styled headline sentence, when shown inside a module body the card
  // padding already supplies the inset — drop the full-bleed side margins.
  moduleHeadline: {
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    marginBottom: 12,
  },
  // Capture nudge inside the Reflections module.
  moduleCta: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(157,112,201,0.12)',
  },
  moduleCtaPressed: { opacity: 0.6 },
  moduleCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9D70C9',
  },
  // Pill cluster — wraps a row of filter chips + its caption. Used twice:
  // capability chips docked under the river chart, people chips under the
  // cohort chart. Each chip both legends its chart and filters THE WORK.
  cluster: {
    marginTop: 18,
  },
  // Tappable capability chips beneath the band chart — the drill-in
  // "made explicit". Each chip isolates a thread (chart dimming + inline
  // week-list filter).
  capChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  capChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  capChipActive: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: 1.5,
  },
  capChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  capChipLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  capChipCount: {
    fontSize: 11.5,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
  },
  // WHO SHAPED IT people pills — sibling to capChip but lead with an
  // avatar bubble (initials on the person's identity color) so the row
  // reads as "who" at a glance, then name · role · count.
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  personAvatar: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  personName: {
    fontSize: 12.5,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  personRole: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.1,
  },
  capChipsCaption: {
    fontSize: 11,
    fontStyle: 'italic',
    color: IOS_REGISTER.labelTertiary,
    marginTop: 8,
    letterSpacing: 0.1,
  },
  sparklineWrap: {},
  reflectionCaption: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 5,
    letterSpacing: 0.1,
  },
  reflectionCaptionAccent: {
    color: '#9D70C9',
    fontWeight: '600',
  },
  riverEmpty: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(120, 120, 130, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(120, 120, 130, 0.14)',
  },
  riverEmptyText: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
  },
  browseEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
  },
  emptyInline: {
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 22,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 13.5,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  logCaption: {
    flex: 1,
    fontSize: 11.5,
    color: IOS_REGISTER.labelTertiary,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  // Filter bar — replaces the toolbar while a capability thread is
  // active. The pill names the thread and clears it on tap; the count
  // confirms how much of the log the filter is showing.
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: 1.5,
  },
  filterPillDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  filterPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  filterCount: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  // No flex on the buttons: a flex:1 child inside the auto-width actions
  // row makes Android Yoga stretch the actions full-width and collapse the
  // flex:1 caption to zero width (it then wraps one character per line,
  // inflating the toolbar to ~500dp of whitespace). Content-sized buttons
  // render identically on iOS.
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.2,
  },
  // D6 anchor strip — horizontal scrolling row of persona-tuned time
  // pegs falling inside the season. Sits below VISION and above the
  // capability river so the user sees "what's coming" before "how
  // the work has spread."
  anchorStrip: {
    marginTop: 6,
    marginBottom: 10,
  },
  anchorEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginLeft: 16,
    marginBottom: 6,
  },
  anchorRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  anchorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: IOS_REGISTER.fillPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    maxWidth: 200,
  },
  anchorTextWrap: {
    flexShrink: 1,
  },
  anchorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  anchorProximity: {
    fontSize: 10.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 1,
    letterSpacing: 0.05,
  },
  // D7 money lane — per-week net cash-flow bars + season totals. Sits
  // below the anchor strip and above the capability river so a
  // money-on persona reads "what's coming · what came in · how the
  // work spread" top to bottom.
  moneyLane: {
    marginTop: 6,
    marginBottom: 12,
  },
  moneyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingRight: 16,
    marginBottom: 8,
  },
  moneyTotals: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  moneyNet: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  moneyCapital: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  moneyBarsRow: {
    paddingHorizontal: 16,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  moneyBarCol: {
    alignItems: 'center',
    width: 16,
  },
  moneyBarTop: {
    height: 36,
    justifyContent: 'flex-end',
  },
  moneyBarBottom: {
    height: 36,
    justifyContent: 'flex-start',
  },
  moneyBar: {
    width: 10,
    borderRadius: 2,
  },
  moneyBaseline: {
    width: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_REGISTER.separatorStrong,
  },
  moneyWeekLabel: {
    fontSize: 9,
    fontFamily: fontFamily.mono,
    fontVariant: ['tabular-nums'],
    color: IOS_REGISTER.labelTertiary,
    marginTop: 3,
  },
});
