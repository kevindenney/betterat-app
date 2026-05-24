/**
 * L4 — every season as a lane of capability-tinted bricks. The archive
 * lives here.
 *
 * Frame 4/8. "All your steps" headline + N seasons · M steps · since DATE.
 * Search field. Filter chips (All + capability shortcuts). Lanes per
 * season — current season in full color, archived seasons dimmed but
 * tappable. Each step is a small capability-tinted brick. Tap any brick →
 * zoom to L1 with that step focused.
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
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useDragReorder } from './useDragReorder';
import { CapabilityRiverChart } from './CapabilityRiverChart';
import type { RiverChartMarker } from './CapabilityRiverChart';
import { PeerJourneyChart } from './PeerJourneyChart';
import { SeasonLibrarianPrompt } from './SeasonLibrarianPrompt';
import type {
  LifetimeAnalysis,
  SeasonPeer,
  SeasonReflection,
  TimelineDataset,
  TimelineSeason,
  WeeklyCapabilityMix,
} from './types';

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

  const markers: RiverChartMarker[] = lifetime.trophies.map((t) => ({
    id: t.id,
    unit: t.sessionIndex,
    kind: 'trophy',
    label: t.label,
    capabilityColor: t.capabilityColor,
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
}: L4YearsViewProps) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [chartWidth, setChartWidth] = useState(0);

  const onAnalysisLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== chartWidth) setChartWidth(w);
  }, [chartWidth]);

  const lifetime = dataset.lifetime;

  // Convert lifetime data into the existing chart shapes (the charts
  // don't know about lifetime semantics — they operate on the generic
  // "unit" axis whether that's weeks or sessions).
  const adapted = useMemo(() => adaptLifetimeForCharts(lifetime), [lifetime]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>ZOOM · ALL TIME · REFLECTING ON A LIFE</Text>
        <Text style={styles.title}>All your steps</Text>
        <Text style={styles.subtitle}>
          {dataset.totalSeasons} seasons · {dataset.totalSteps} steps · since {dataset.sinceDate}
        </Text>
      </View>

      {adapted && lifetime ? (
        <View style={styles.analysisBlock} onLayout={onAnalysisLayout}>
          <Text style={styles.sectionEyebrow}>CAPABILITY RIVER</Text>
          <CapabilityRiverChart
            weeklyCapabilities={adapted.weeklyCapabilities}
            totalWeeks={adapted.totalUnits}
            currentWeekNumber={adapted.currentUnit}
            reflections={adapted.reflections}
            markers={adapted.markers}
            tickLabel={(unit) =>
              lifetime.sessions.find((s) => s.sessionIndex === unit)?.label ?? `s${unit}`
            }
            tickEveryN={1}
            nowLabel="NOW"
            width={chartWidth}
            height={150}
          />

          {adapted.peers.length > 0 ? (
            <>
              <Text style={[styles.sectionEyebrow, styles.sectionEyebrowSpace]}>
                PEERS
              </Text>
              <PeerJourneyChart
                peers={adapted.peers}
                totalWeeks={adapted.totalUnits}
                currentWeekNumber={adapted.currentUnit}
                width={chartWidth}
              />
            </>
          ) : null}

          {lifetime.librarianPrompt ? (
            <SeasonLibrarianPrompt
              prompt={lifetime.librarianPrompt}
              onPrimary={onLibrarianPrimary}
              onSecondary={onLibrarianSecondary}
            />
          ) : null}

          <Text style={styles.browseEyebrow}>BROWSE LANES</Text>
        </View>
      ) : null}

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={15} color={IOS_REGISTER.labelTertiary} />
        <Text style={styles.searchPlaceholder}>Search steps, capabilities, blueprints…</Text>
        <Ionicons
          name="mic-outline"
          size={15}
          color={IOS_REGISTER.labelTertiary}
          style={styles.searchMic}
        />
      </View>

      {onEnterSelectMode && !selectEnabled ? (
        <View style={styles.selectRow}>
          <Pressable style={styles.selectPill} onPress={onEnterSelectMode} hitSlop={6}>
            <Ionicons
              name="checkmark-circle-outline"
              size={13}
              color={IOS_REGISTER.accentUserAction}
            />
            <Text style={styles.selectPillLabel}>Select</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {dataset.capabilityFilters.map((filter) => {
          const active = filter.id === activeFilter;
          return (
            <Pressable
              key={filter.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter.id)}
            >
              {filter.icon ? (
                <Ionicons
                  name={filter.icon as keyof typeof Ionicons.glyphMap}
                  size={12}
                  color={
                    active
                      ? '#FFFFFF'
                      : filter.color ?? IOS_REGISTER.labelSecondary
                  }
                />
              ) : null}
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {dataset.seasons.map((season, idx) => (
        <SeasonLane
          key={season.id}
          season={season}
          isCurrent={idx === 0}
          onOpenStep={onOpenStep}
          onReorderStep={idx === 0 ? onReorderStep : undefined}
          selectEnabled={selectEnabled}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </ScrollView>
  );
}

interface SeasonLaneProps {
  season: TimelineSeason;
  isCurrent: boolean;
  onOpenStep: (stepId: string) => void;
  onReorderStep?: (
    stepId: string,
    beforeStepId: string | null,
    afterStepId: string | null,
  ) => void;
  selectEnabled?: boolean;
  isSelected?: (stepId: string) => boolean;
  onToggleSelect?: (stepId: string) => void;
}

function SeasonLane({
  season,
  isCurrent,
  onOpenStep,
  onReorderStep,
  selectEnabled = false,
  isSelected,
  onToggleSelect,
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
        <Text style={styles.laneCount}>{season.bricks.length}</Text>
      </View>

      <View style={styles.bricksWrap}>
        {season.bricks.map((b, i) => {
          const fill = season.archived
            ? withAlpha(b.capabilityColor, 0.45)
            : b.capabilityColor;
          if (!b.stepId) {
            return (
              <View
                key={`placeholder-${i}`}
                style={[styles.brick, { backgroundColor: fill }]}
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
            />
          );
        })}
      </View>
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

const BRICK_SIZE = 22;
const BRICK_GAP = 4;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  analysisBlock: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 8,
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
    marginTop: 16,
  },
  browseEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 4,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    height: 36,
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: IOS_REGISTER.labelTertiary,
  },
  searchMic: {
    marginLeft: 'auto',
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  filterChipActive: {
    backgroundColor: '#1F1F1F',
    borderColor: '#1F1F1F',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  lane: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  laneArchived: {
    opacity: 0.95,
  },
  laneHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  laneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  laneTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
  },
  laneTitleArchived: {
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '500',
  },
  laneDates: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    marginLeft: 4,
  },
  laneCount: {
    fontSize: 13,
    color: IOS_REGISTER.labelTertiary,
    fontWeight: '500',
  },
  bricksWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BRICK_GAP,
  },
  brick: {
    width: BRICK_SIZE,
    height: BRICK_SIZE,
    borderRadius: 3,
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
    paddingHorizontal: 16,
    marginBottom: 12,
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
