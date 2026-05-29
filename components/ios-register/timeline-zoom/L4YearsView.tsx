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
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useDragReorder } from './useDragReorder';
import { CapabilityMix } from './CapabilityMix';
import type { CapabilityMixMarker } from './CapabilityMix';
import { PeerJourneyChart } from './PeerJourneyChart';
import { SeasonLibrarianPrompt } from './SeasonLibrarianPrompt';
import {
  detectPhaseLabelFromTitles,
  resolveInterestVocab,
  type InterestVocab,
} from './interestVocab';
import type {
  LifetimeAnalysis,
  SeasonPeer,
  SeasonReflection,
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
  onOpenStep: (stepId: string) => void;
  /**
   * Section D reorder — same neighbor-id contract as L2/L3. Only the
   * current-rotation lane is reorderable; archived lanes are placeholder
   * bricks until the archive RPC ships.
   */
  onReorderStep?: (
    stepId: string,
    beforeStepId: string | null,
    afterStepId: string | null,
  ) => void;
  /** Frame 12 — tap a Select pill to enter multi-select. */
  onEnterSelectMode?: () => void;
  selectEnabled?: boolean;
  isSelected?: (stepId: string) => boolean;
  onToggleSelect?: (stepId: string) => void;
  /** Lifetime librarian primary CTA — "Start a reflection". */
  onLibrarianPrimary?: () => void;
  /** Lifetime librarian "Not now" tap. */
  onLibrarianSecondary?: () => void;
  /** "+ New arc" affordance in the BROWSE ARCS header. */
  onAddArc?: () => void;
  /** Per-arc edit affordance from the BROWSE ARCS list. */
  onEditArc?: (arcId: string) => void;
}

/**
 * Map a LifetimeAnalysis into the unit-agnostic shapes the river +
 * peer charts already consume. The charts use "weekNumber" naming
 * because they were built for L3 first; here "weekNumber" actually
 * means sessionIndex. Same math, different label.
 */
function adaptLifetimeForCharts(lifetime: LifetimeAnalysis | undefined): {
  weeklyCapabilities: WeeklyCapabilityMix[];
  peers: SeasonPeer[];
  reflections: SeasonReflection[];
  markers: RiverChartMarker[];
  totalUnits: number;
  currentUnit: number;
} | null {
  if (!lifetime || lifetime.sessions.length === 0) return null;
  const totalUnits = lifetime.sessions.length;
  // Current session = the newest non-future session. Sessions are
  // chronological so the last one is the "now" anchor unless the
  // caller has explicitly flagged a future stub (skipped for v1).
  const currentUnit = totalUnits;

  const weeklyCapabilities: WeeklyCapabilityMix[] = lifetime.sessions.map((s) => ({
    weekNumber: s.sessionIndex,
    bands: [{ capabilityColor: s.dominantCapabilityColor, volume: Math.max(1, s.volume) }],
  }));

  const peers: SeasonPeer[] = lifetime.peers.map((p) => ({
    id: p.id,
    initials: p.initials,
    color: p.color,
    role: p.role,
    firstWeek: p.firstSessionIndex,
    weeklyAppearances: p.sessionAppearances.map((a) => ({
      weekNumber: a.sessionIndex,
      count: a.count,
    })),
  }));

  const reflections: SeasonReflection[] = lifetime.reflections.map((r) => ({
    id: r.id,
    weekNumber: r.sessionIndex,
    quote: r.quote,
    capabilityColor: r.capabilityColor,
  }));

  const markers: CapabilityMixMarker[] = lifetime.trophies.map((t) => ({
    id: t.id,
    weekNumber: t.sessionIndex,
    label: t.label,
    color: t.capabilityColor,
  }));

  return { weeklyCapabilities, peers, reflections, markers, totalUnits, currentUnit };
}

export function L4YearsView({
  dataset,
  onOpenStep,
  onReorderStep,
  onEnterSelectMode,
  selectEnabled = false,
  isSelected,
  onToggleSelect,
  onLibrarianPrimary,
  onLibrarianSecondary,
  onAddArc,
  onEditArc,
}: L4YearsViewProps) {
  const [chartWidth, setChartWidth] = useState(0);

  const onAnalysisLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
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

  // Convert lifetime data into the existing chart shapes (the charts
  // don't know about lifetime semantics — they operate on the generic
  // "unit" axis whether that's weeks or sessions).
  const adapted = useMemo(() => adaptLifetimeForCharts(lifetime), [lifetime]);

  // Resolve interest-native vocab — L4 is by definition the reflective
  // view, so we always use the late-tier verb and the persona's native
  // librarian eyebrow.
  const interestVocab = resolveInterestVocab(
    dataset.interest.id,
    dataset.interest.label,
  );

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
          {formatLifetimeDuration(dataset.sinceTimestamp) ??
            `${dataset.totalSeasons} arcs · ${dataset.totalSteps} steps · since ${dataset.sinceDate}`}
        </Text>
      </View>

      <View style={styles.lifetimeVisionBanner}>
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
      </View>

      {adapted && lifetime ? (
        <View style={styles.analysisBlock} onLayout={onAnalysisLayout}>
          <Text style={styles.sectionEyebrow}>{interestVocab.riverHeader}</Text>
          <CapabilityMix
            weeklyCapabilities={adapted.weeklyCapabilities}
            totalWeeks={adapted.totalUnits}
            currentWeekNumber={adapted.currentUnit}
            reflections={adapted.reflections}
            markers={adapted.markers}
            unitLabel={(unit) =>
              lifetime.sessions.find((s) => s.sessionIndex === unit)?.label ?? `s${unit}`
            }
            width={chartWidth}
            height={212}
          />

          {adapted.peers.length > 0 ? (
            <>
              <Text style={[styles.sectionEyebrow, styles.sectionEyebrowSpace]}>
                {interestVocab.crewHeader}
              </Text>
              <Text style={styles.sectionSubeyebrow}>
                {interestVocab.inputSubtitle}
              </Text>
              <PeerJourneyChart
                peers={adapted.peers}
                totalWeeks={adapted.totalUnits}
                currentWeekNumber={adapted.currentUnit}
                width={chartWidth}
                compact
                showRole={false}
              />
            </>
          ) : null}

          {lifetime.librarianPrompt ? (
            <SeasonLibrarianPrompt
              prompt={{
                ...lifetime.librarianPrompt,
                eyebrow: interestVocab.librarianEyebrow.replace(
                  /^This arc/i,
                  'Across your practice',
                ),
              }}
              onPrimary={onLibrarianPrimary}
              onSecondary={onLibrarianSecondary}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.browseHeaderRow}>
        <Text style={styles.browseEyebrow}>BROWSE ARCS</Text>
        <View style={styles.browseHeaderActions}>
          {onAddArc ? (
            <Pressable
              style={styles.selectPill}
              onPress={onAddArc}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="New arc"
            >
              <Ionicons
                name="add"
                size={14}
                color={IOS_REGISTER.accentUserAction}
              />
              <Text style={styles.selectPillLabel}>New arc</Text>
            </Pressable>
          ) : null}
          {onEnterSelectMode && !selectEnabled ? (
            <Pressable style={styles.selectPill} onPress={onEnterSelectMode} hitSlop={6}>
              <Ionicons
                name="checkmark-circle-outline"
                size={13}
                color={IOS_REGISTER.accentUserAction}
              />
              <Text style={styles.selectPillLabel}>Select</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {dataset.seasons.map((season, idx) => (
        <SeasonLane
          key={season.id}
          season={season}
          isCurrent={idx === 0}
          vocab={interestVocab}
          onOpenStep={onOpenStep}
          onReorderStep={idx === 0 ? onReorderStep : undefined}
          selectEnabled={selectEnabled}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
          onEditArc={onEditArc}
        />
      ))}
    </ScrollView>
  );
}

interface SeasonLaneProps {
  season: TimelineSeason;
  isCurrent: boolean;
  vocab: InterestVocab;
  onOpenStep: (stepId: string) => void;
  onReorderStep?: (
    stepId: string,
    beforeStepId: string | null,
    afterStepId: string | null,
  ) => void;
  selectEnabled?: boolean;
  isSelected?: (stepId: string) => boolean;
  onToggleSelect?: (stepId: string) => void;
  onEditArc?: (arcId: string) => void;
}

function SeasonLane({
  season,
  isCurrent,
  vocab,
  onOpenStep,
  onReorderStep,
  selectEnabled = false,
  isSelected,
  onToggleSelect,
  onEditArc,
}: SeasonLaneProps) {
  // Bricks with a real stepId participate in drag-reorder; bricks without
  // (archived placeholders) are display-only. The drag hook needs items
  // with stable ids, so synthesize a stable id-list for the hook from
  // those bricks that have step ids.
  const reorderableItems = useMemo(
    () =>
      season.bricks
        .map((b, i) => ({ id: b.stepId ?? `placeholder-${i}`, hasStepId: Boolean(b.stepId) }))
        .filter((b) => b.hasStepId),
    [season.bricks],
  );

  // Phase D D5 — chapter signal. Surface the dominant capability,
  // people-constancy hint, and done progress as inline chips on each
  // season lane so the L4 view starts reading as a flip-through-the-
  // logbook ledger instead of an undifferentiated brick wall. Each
  // chip is information-dense and uses signal the bricks already
  // carry (capabilityLabel from D3, withOthers from earlier, status).
  const chapterSummary = useMemo(() => {
    if (season.bricks.length === 0) return null;
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
    let categoryDominant: { label: string; color: string; count: number } | null = null;
    for (const bucket of labelCounts.values()) {
      if (!categoryDominant || bucket.count > categoryDominant.count) categoryDominant = bucket;
    }
    // Prefer title-pattern detection over category dominance — the
    // category is often the generic interest name ("Sailing",
    // "Nursing") which carries no signal at the chapter level. A
    // title-pattern hit like "Tactics" / "Starts" / "Rig tuning"
    // describes the *specific work* the season pushed.
    const titleBasedLabel = detectPhaseLabelFromTitles(titles, vocab);
    return {
      dominantLabel: titleBasedLabel ?? categoryDominant?.label ?? null,
      dominantColor: categoryDominant?.color ?? null,
      withOthersCount,
      doneCount,
      totalCount: season.bricks.length,
    };
  }, [season.bricks, vocab]);

  const drag = useDragReorder<{ id: string; hasStepId: boolean }>({
    items: reorderableItems,
    axis: 'horizontal',
    enabled: Boolean(onReorderStep) && reorderableItems.length > 1,
    onReorder: useCallback(
      (id, from, to) => {
        const without = reorderableItems.filter((b) => b.id !== id);
        const clamped = Math.max(0, Math.min(to, without.length));
        const before = without[clamped - 1]?.id ?? null;
        const after = without[clamped]?.id ?? null;
        onReorderStep?.(id, before, after);
        void from;
      },
      [reorderableItems, onReorderStep],
    ),
  });

  return (
    <View style={[styles.lane, season.archived && styles.laneArchived]}>
      <View style={styles.laneHeadRow}>
        <View style={styles.laneTitleRow}>
          {season.archived ? (
            <Ionicons name="archive-outline" size={14} color={IOS_REGISTER.labelSecondary} />
          ) : null}
          <Text style={[styles.laneTitle, season.archived && styles.laneTitleArchived]}>
            {season.title}
          </Text>
          <Text style={styles.laneDates}>
            {isCurrent ? `${season.dateRange.split('—')[0].trim()} — present` : season.dateRange}
          </Text>
        </View>
        <View style={styles.laneActions}>
          {onEditArc ? (
            <Pressable
              onPress={() => onEditArc(season.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit arc"
              style={({ pressed }) => [
                styles.laneEditBtn,
                pressed && styles.lanePressed,
              ]}
            >
              <Ionicons name="pencil-outline" size={14} color={IOS_REGISTER.labelSecondary} />
            </Pressable>
          ) : null}
          <Text style={styles.laneCount}>{season.bricks.length}</Text>
        </View>
      </View>

      {chapterSummary ? (
        <View style={styles.chapterChips}>
          {chapterSummary.dominantLabel ? (
            <View
              style={[
                styles.chapterChip,
                chapterSummary.dominantColor
                  ? { backgroundColor: withAlpha(chapterSummary.dominantColor, 0.14) }
                  : null,
              ]}
            >
              {chapterSummary.dominantColor ? (
                <View
                  style={[
                    styles.chapterChipDot,
                    { backgroundColor: chapterSummary.dominantColor },
                  ]}
                />
              ) : null}
              <Text style={styles.chapterChipText} numberOfLines={1}>
                {chapterSummary.dominantLabel}
              </Text>
            </View>
          ) : null}
          {chapterSummary.withOthersCount > 0 ? (
            <View style={styles.chapterChip}>
              <Ionicons
                name="people-outline"
                size={11}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.chapterChipText}>
                {chapterSummary.withOthersCount} with people
              </Text>
            </View>
          ) : null}
          {chapterSummary.doneCount > 0 ? (
            <View style={styles.chapterChip}>
              <Ionicons
                name="checkmark-circle-outline"
                size={11}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.chapterChipText}>
                {chapterSummary.doneCount}/{chapterSummary.totalCount} done
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bricksWrap}
        style={styles.laneScroller}
      >
        {season.bricks.map((b, i) => {
          // Status-aware fill: planned bricks dim to ~45%, in-flight stay
          // saturated, done/reflected stay solid + carry a check overlay.
          // Archived seasons dim everything regardless.
          const planned = b.status === 'plan';
          const baseAlpha = season.archived ? 0.45 : planned ? 0.45 : 1;
          const fill =
            baseAlpha < 1 ? withAlpha(b.capabilityColor, baseAlpha) : b.capabilityColor;
          const showDoneGlyph = b.status === 'done' || b.status === 'reflected';
          if (!b.stepId) {
            return (
              <View
                key={`placeholder-${i}`}
                style={[
                  styles.brick,
                  { backgroundColor: fill },
                  b.withOthers && styles.brickWithOthers,
                ]}
              />
            );
          }
          const isLifted = drag.liftedId === b.stepId;
          const reorderableIndex = reorderableItems.findIndex(
            (item) => item.id === b.stepId,
          );
          const showDrop =
            drag.dropTargetIndex === reorderableIndex && !isLifted;
          const selected = isSelected?.(b.stepId) ?? false;
          const handlePress = selectEnabled
            ? () => onToggleSelect?.(b.stepId!)
            : () => onOpenStep(b.stepId!);
          return (
            <DraggableBrick
              key={b.stepId}
              stepId={b.stepId}
              reorderableIndex={reorderableIndex}
              fill={fill}
              isLifted={isLifted}
              showDropBefore={showDrop}
              liftedTranslateX={drag.liftedTranslate}
              onOpen={handlePress}
              buildGesture={drag.buildItemGesture}
              registerRowLayout={drag.registerRowLayout}
              dragEnabled={Boolean(onReorderStep) && !selectEnabled}
              selectEnabled={selectEnabled}
              selected={selected}
              withOthers={Boolean(b.withOthers)}
              showDoneGlyph={showDoneGlyph}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

interface DraggableBrickProps {
  stepId: string;
  reorderableIndex: number;
  fill: string;
  isLifted: boolean;
  showDropBefore: boolean;
  liftedTranslateX: number;
  onOpen: () => void;
  buildGesture: ReturnType<typeof useDragReorder>['buildItemGesture'];
  registerRowLayout: ReturnType<typeof useDragReorder>['registerRowLayout'];
  dragEnabled: boolean;
  selectEnabled: boolean;
  selected: boolean;
  withOthers: boolean;
  showDoneGlyph: boolean;
}

function DraggableBrick({
  stepId,
  reorderableIndex,
  fill,
  isLifted,
  showDropBefore,
  liftedTranslateX,
  onOpen,
  buildGesture,
  registerRowLayout,
  dragEnabled,
  selectEnabled,
  selected,
  withOthers,
  showDoneGlyph,
}: DraggableBrickProps) {
  const gesture = useMemo(
    () => buildGesture(stepId, reorderableIndex),
    [buildGesture, stepId, reorderableIndex],
  );

  const liftStyle = useAnimatedStyle(() => {
    if (!isLifted) return { transform: [] as never[] };
    return {
      transform: [
        { translateX: liftedTranslateX },
        { scale: 1.6 },
        { rotateZ: '4deg' },
      ],
      zIndex: 10,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 12,
    };
  }, [isLifted, liftedTranslateX]);

  // Brick is small (22px) — wrap in a Pressable so tap-to-open still works,
  // and overlay the gesture detector on top so long-press → drag wins.
  // In select mode, a selected brick FLIPS to solid iOS-blue with a
  // centered white check (the capability color hides while selected).
  // This avoids reflowing the row and is unmissable on a 22px target.
  const inner = (
    <Animated.View
      style={[
        styles.brick,
        {
          backgroundColor: selectEnabled && selected ? IOS_REGISTER.accentUserAction : fill,
        },
        withOthers && !(selectEnabled && selected) && styles.brickWithOthers,
        selectEnabled && selected && styles.brickSelected,
        liftStyle,
      ]}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        registerRowLayout(stepId, { start: x, length: width });
      }}
    >
      {selectEnabled && selected ? (
        <View style={styles.brickCheckCenter}>
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        </View>
      ) : showDoneGlyph ? (
        <View style={styles.brickCheckCenter}>
          <Ionicons name="checkmark" size={10} color="rgba(255,255,255,0.92)" />
        </View>
      ) : null}
      {showDropBefore ? <View style={styles.brickDropIndicator} /> : null}
    </Animated.View>
  );

  if (!dragEnabled) {
    return (
      <Pressable onPress={onOpen}>{inner}</Pressable>
    );
  }
  return (
    <GestureDetector gesture={gesture}>
      <Pressable onPress={onOpen}>{inner}</Pressable>
    </GestureDetector>
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

const BRICK_SIZE = 18;
const BRICK_GAP = 2;

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
  browseHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    opacity: 0.74,
  },
  browseEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  lane: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  laneArchived: {
    opacity: 0.8,
  },
  laneHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  laneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  laneTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
  },
  laneTitleArchived: {
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '500',
  },
  laneDates: {
    fontSize: 10.5,
    color: IOS_REGISTER.labelTertiary,
    marginLeft: 4,
  },
  laneCount: {
    fontSize: 10.5,
    color: IOS_REGISTER.labelTertiary,
    fontWeight: '500',
  },
  laneActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      web: 'Georgia, "Times New Roman", serif',
      default: 'Georgia',
    }) as string,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 24,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  lifetimeVisionPrompt: {
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      web: 'Georgia, "Times New Roman", serif',
      default: 'Georgia',
    }) as string,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.labelTertiary,
  },
  // Chapter summary chips on each season lane — D5 first cut. Surface
  // dominant capability + people-constancy + done progress so the L4
  // surface starts reading as a logbook of chapters, not a wall of
  // identical bricks.
  chapterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
    marginBottom: 6,
    marginHorizontal: 16,
  },
  chapterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: IOS_REGISTER.fillPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  chapterChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chapterChipText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.1,
  },
  laneEditBtn: {
    padding: 4,
  },
  lanePressed: {
    opacity: 0.55,
  },
  browseHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  laneScroller: {
    marginRight: -16,
    opacity: 0.9,
  },
  bricksWrap: {
    flexDirection: 'row',
    gap: BRICK_GAP,
    paddingTop: 1,
    paddingRight: 16,
  },
  brick: {
    width: BRICK_SIZE,
    height: BRICK_SIZE,
    borderRadius: 2.5,
  },
  // Soft outline on bricks where others were involved — reads as a
  // "with people" beat at the all-time scale without needing a glyph.
  brickWithOthers: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  brickSelected: {
    // Slight inner ring for crispness against the blue fill; not a
    // border (which would shrink the inner color area).
    shadowColor: IOS_REGISTER.accentUserAction,
    shadowOpacity: 0.6,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  brickCheckCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brickDropIndicator: {
    position: 'absolute',
    left: -BRICK_GAP / 2 - 1.5,
    top: -2,
    bottom: -2,
    width: 2,
    borderRadius: 1,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  selectRow: {
    flexDirection: 'row',
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
