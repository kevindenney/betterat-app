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
 *   - Capability river chart (CapabilityRiverChart) — stacked area per
 *     week, NOW bar, inline reflection quotes
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
import type { LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useUniversalPlus } from '@/components/capture/UniversalPlusProvider';
import { StepDigestCard } from './StepDigestCard';
import { CapabilityRiverChart } from './CapabilityRiverChart';
import { PeerJourneyChart } from './PeerJourneyChart';
import { SeasonLibrarianPrompt } from './SeasonLibrarianPrompt';
import { SeasonHeaderChips } from './SeasonHeaderChips';
import { PickerListSheet } from './PickerListSheet';
import { SeasonCalendarSheet } from './SeasonCalendarSheet';
import { useDragReorder } from './useDragReorder';
import {
  composeArcEyebrow,
  pickVerbTier,
  resolveInterestVocab,
} from './interestVocab';
import type { TimelineDataset, TimelineSeason, TimelineStep } from './types';

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
  /** Frame 12 multi-select — when true, taps toggle selection instead of opening. */
  selectEnabled?: boolean;
  isSelected?: (stepId: string) => boolean;
  onToggleSelect?: (stepId: string) => void;
  /** Librarian primary CTA tap — defaults to no-op (preview surface). */
  onLibrarianPrimary?: () => void;
  /** Librarian "Not now" tap — defaults to no-op. */
  onLibrarianSecondary?: () => void;
}

export function L3SeasonView({
  dataset,
  focusStepId,
  selectedSeasonId,
  onSelectSeason,
  onOpenStep,
  onEnterSelectMode,
  onReorderStep,
  selectEnabled = false,
  isSelected,
  onToggleSelect,
  onLibrarianPrimary,
  onLibrarianSecondary,
}: L3SeasonViewProps) {
  const effectiveSeasonId = selectedSeasonId ?? dataset.currentSeasonId;
  const season = dataset.seasons.find((s) => s.id === effectiveSeasonId)
    ?? dataset.seasons.find((s) => s.id === dataset.currentSeasonId);

  const [chartWidth, setChartWidth] = useState(0);
  const [openPicker, setOpenPicker] = useState<
    'season' | 'step' | 'calendar' | null
  >(null);
  const scrollRef = useRef<ScrollView>(null);
  const weekOffsetsRef = useRef<Record<string, number>>({});

  const registerWeekOffset = useCallback((weekId: string, y: number) => {
    weekOffsetsRef.current[weekId] = y;
  }, []);

  const scrollToWeekByIndex = useCallback(
    (weekIndex: number) => {
      if (!season) return;
      const target = season.weeks.find((w) => w.number === weekIndex);
      if (!target) return;
      const y = weekOffsetsRef.current[target.id];
      if (typeof y === 'number') {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      }
    },
    [season],
  );

  const onAnalysisLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== chartWidth) setChartWidth(w);
  }, [chartWidth]);

  // Flatten the current season's steps into one ordered list. The drag
  // hook reasons in this flat coordinate space; the UI still renders
  // them grouped by week. Row layouts are stored per step id so the
  // grouping doesn't matter for hit-testing.
  const flatSteps: TimelineStep[] = useMemo(() => {
    if (!season) return [];
    return season.weeks.flatMap((w) => w.steps);
  }, [season]);

  const drag = useDragReorder<TimelineStep>({
    items: flatSteps,
    enabled: Boolean(onReorderStep),
    onReorder: useCallback(
      (id, from, to) => {
        const without = flatSteps.filter((s) => s.id !== id);
        const clamped = Math.max(0, Math.min(to, without.length));
        const before = without[clamped - 1]?.id ?? null;
        const after = without[clamped]?.id ?? null;
        onReorderStep?.(id, before, after);
        void from;
      },
      [flatSteps, onReorderStep],
    ),
  });

  if (!season) return null;

  const analysis = season.analysis;
  const totalWeeks = season.weekOfTotal?.total ?? season.weeks.length;
  const currentWeek = season.weekOfTotal?.current ?? 1;

  // Resolve interest-native vocab — the eyebrow verb above the season
  // title and the librarian card eyebrow should speak the user's
  // domain (sailor → "TUNING UP", entrepreneur → "PLANNING") instead
  // of the generic system label.
  const interestVocab = resolveInterestVocab(
    dataset.interest.id,
    dataset.interest.label,
  );
  const verbTier = pickVerbTier(currentWeek, totalWeeks);
  const arcEyebrow = composeArcEyebrow(interestVocab, verbTier);

  // "Step N of M" for the step-counter chip. Picks the focused step's
  // ordinal within the flat season list when known; falls back to 1.
  const focusedStepIndex = flatSteps.findIndex((s) => s.id === focusStepId);
  const stepOfTotal =
    flatSteps.length > 0
      ? { current: focusedStepIndex >= 0 ? focusedStepIndex + 1 : 1, total: flatSteps.length }
      : undefined;

  // Sticky week headers: the ScrollView's stickyHeaderIndices points at
  // each WEEK N row's index among the top-level scroll children. With
  // the analysis layer in the tree, we count the fixed children before
  // the per-week pairs and add per-week pairs from there.
  const hasAnalysis = Boolean(analysis);
  const fixedChildrenBeforeWeeks =
    // headerChips + browseWeeksEyebrow + toolbar
    3
    // analysis block (one wrapper View if present)
    + (hasAnalysis ? 1 : 0);
  const stickyHeaderIndices = season.weeks.map(
    (_w, i) => fixedChildrenBeforeWeeks + i * 2,
  );

  return (
    <>
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!drag.isDragging}
      stickyHeaderIndices={stickyHeaderIndices}
    >
      <SeasonHeaderChips
        seasonTitle={season.title}
        dateRange={season.dateRange}
        weekOfTotal={season.weekOfTotal}
        stepOfTotal={stepOfTotal}
        eyebrow={arcEyebrow}
        onPressSeason={() => setOpenPicker('season')}
        onPressDate={() => setOpenPicker('calendar')}
        onPressStep={() => setOpenPicker('step')}
      />

      {hasAnalysis && analysis ? (
        <View style={styles.analysisBlock} onLayout={onAnalysisLayout}>
          {flatSteps.length >= 5 ? (
            <>
              <Text style={styles.sectionEyebrow}>{interestVocab.riverHeader}</Text>
              <CapabilityRiverChart
                weeklyCapabilities={analysis.weeklyCapabilities}
                totalWeeks={totalWeeks}
                currentWeekNumber={currentWeek}
                reflections={analysis.reflections}
                phases={analysis.phases}
                markers={analysis.markers?.map((m) => ({
                  id: m.id,
                  unit: m.weekNumber,
                  kind: m.kind,
                  label: m.label,
                  capabilityColor: m.capabilityColor,
                }))}
                onPhasePress={(phase) => scrollToWeekByIndex(phase.startWeek)}
                shapeMode="flow"
                nowDoublePill
                columnBleed={8}
                bandOpacity={0.9}
                width={chartWidth}
                height={188}
                tickEveryN={2}
              />
            </>
          ) : (
            <View style={styles.riverEmpty}>
              <Text style={styles.riverEmptyText}>
                Add a few more steps to see how your work spreads across capabilities.
              </Text>
            </View>
          )}

          {analysis.peers.length > 0 ? (
            <>
              <Text style={[styles.sectionEyebrow, styles.sectionEyebrowSpace]}>
                {interestVocab.crewHeader}
              </Text>
              <PeerJourneyChart
                peers={analysis.peers}
                totalWeeks={totalWeeks}
                currentWeekNumber={currentWeek}
                width={chartWidth}
                compact={analysis.peers.length <= 3}
                showRole={analysis.peers.length > 2}
              />
            </>
          ) : null}

          {analysis.librarianPrompt ? (
            <SeasonLibrarianPrompt
              prompt={{
                ...analysis.librarianPrompt,
                eyebrow: interestVocab.librarianEyebrow,
              }}
              onPrimary={onLibrarianPrimary}
              onSecondary={onLibrarianSecondary}
              variant={currentWeek <= 2 ? 'compact' : 'full'}
            />
          ) : null}
        </View>
      ) : null}

      {season.weeks.length === 0 ? <EmptySeasonInline /> : null}

      <Text style={styles.browseEyebrow}>BROWSE WEEKS</Text>

      <View style={styles.toolbar}>
        <ToolbarButton icon="swap-vertical-outline" label="Sort" />
        <ToolbarButton icon="filter-outline" label="Capability" />
        <ToolbarButton
          icon="checkmark-circle-outline"
          label="Select"
          onPress={onEnterSelectMode}
        />
      </View>

      {season.weeks.flatMap((week) => [
        <View
          key={`hdr-${week.id}`}
          style={styles.weekHeaderSticky}
          onLayout={(e) => registerWeekOffset(week.id, e.nativeEvent.layout.y)}
        >
          <View style={styles.weekHeadRow}>
            <Text style={styles.weekHead}>
              WEEK {week.number}
              {week.isCurrent ? '  ·  THIS WEEK' : ''}
            </Text>
            <Text style={styles.weekRange}>{week.dateRange}</Text>
          </View>
        </View>,
        <View key={`body-${week.id}`} style={styles.weekBody}>
          <View style={styles.cardPair}>
            {week.steps.slice(0, 2).map((step) => {
              const flatIndex = flatSteps.findIndex((s) => s.id === step.id);
              const isLifted = drag.liftedId === step.id;
              const showDropIndicatorBefore =
                drag.dropTargetIndex === flatIndex && !isLifted;
              const selected = isSelected?.(step.id) ?? false;
              const handlePress = selectEnabled
                ? () => onToggleSelect?.(step.id)
                : () => onOpenStep(step.id);
              return (
                <DraggableCardSlot
                  key={step.id}
                  step={step}
                  flatIndex={flatIndex}
                  isLifted={isLifted}
                  showDropIndicatorBefore={showDropIndicatorBefore}
                  liftedTranslateY={drag.liftedTranslate}
                  highlighted={step.id === focusStepId || selected}
                  selected={selected}
                  selectEnabled={selectEnabled}
                  onOpen={handlePress}
                  buildGesture={drag.buildItemGesture}
                  registerRowLayout={drag.registerRowLayout}
                />
              );
            })}
            {week.steps.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        </View>,
      ])}
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
        renderRow={(s) => {
          const wkCount = s.weekOfTotal?.total ?? s.weeks.length;
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
                {s.dateRange} · {wkCount} {wkCount === 1 ? 'week' : 'weeks'}
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

      <SeasonCalendarSheet
        visible={openPicker === 'calendar'}
        seasonTitle={season.title}
        dateRange={season.dateRange}
        currentWeek={currentWeek}
        totalWeeks={totalWeeks}
        onPickWeek={(weekIndex) => {
          setOpenPicker(null);
          scrollToWeekByIndex(weekIndex);
        }}
        onClose={() => setOpenPicker(null)}
      />
    </>
  );
}

interface DraggableCardSlotProps {
  step: TimelineStep;
  flatIndex: number;
  isLifted: boolean;
  showDropIndicatorBefore: boolean;
  liftedTranslateY: number;
  highlighted: boolean;
  selected: boolean;
  selectEnabled: boolean;
  onOpen: () => void;
  buildGesture: ReturnType<typeof useDragReorder>['buildItemGesture'];
  registerRowLayout: ReturnType<typeof useDragReorder>['registerRowLayout'];
}

function DraggableCardSlot({
  step,
  flatIndex,
  isLifted,
  showDropIndicatorBefore,
  liftedTranslateY,
  highlighted,
  selected,
  selectEnabled,
  onOpen,
  buildGesture,
  registerRowLayout,
}: DraggableCardSlotProps) {
  const gesture = useMemo(
    () => buildGesture(step.id, flatIndex),
    [buildGesture, step.id, flatIndex],
  );

  const liftStyle = useAnimatedStyle(() => {
    if (!isLifted) return { transform: [] as never[] };
    return {
      transform: [
        { translateY: liftedTranslateY },
        { scale: 1.04 },
        { rotateZ: '1.5deg' },
      ],
      zIndex: 10,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    };
  }, [isLifted, liftedTranslateY]);

  const cardBody = (
    <Animated.View
      style={[styles.slotFlex, liftStyle]}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        registerRowLayout(step.id, { start: y, length: height });
      }}
    >
      <StepDigestCard
        step={step}
        compact
        highlighted={highlighted}
        onPress={onOpen}
      />
      {selectEnabled ? (
        <View style={[styles.selectBadge, selected && styles.selectBadgeOn]}>
          {selected ? (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );

  return (
    <View style={styles.dropSlotWrap}>
      {showDropIndicatorBefore ? <View style={styles.dropIndicator} /> : null}
      {selectEnabled ? (
        cardBody
      ) : (
        <GestureDetector gesture={gesture}>{cardBody}</GestureDetector>
      )}
    </View>
  );
}

function EmptySeasonInline() {
  const universalPlus = useUniversalPlus();
  return (
    <View style={styles.emptyInline}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="leaf-outline" size={22} color={IOS_REGISTER.labelTertiary} />
      </View>
      <Text style={styles.emptyTitle}>This rotation is just starting</Text>
      <Text style={styles.emptyBody}>
        Add a step to begin the season arc. The capability river will fill in as you practice.
      </Text>
      {universalPlus.isAvailable ? (
        <Pressable style={styles.emptyCta} onPress={universalPlus.open}>
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

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
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
  riverEmpty: {
    marginHorizontal: 16,
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
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    borderRadius: 10,
    paddingVertical: 8,
  },
  toolLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  weekHeaderSticky: {
    backgroundColor: IOS_REGISTER.groundBg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  weekBody: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  weekHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  weekHead: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  weekRange: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
  },
  cardPair: {
    flexDirection: 'row',
    gap: 10,
  },
  dropSlotWrap: {
    flex: 1,
    position: 'relative',
  },
  slotFlex: { flex: 1 },
  dropIndicator: {
    position: 'absolute',
    left: -6,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.accentUserAction,
    zIndex: 5,
  },
  selectBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.separatorStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBadgeOn: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
});
