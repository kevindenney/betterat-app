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
import type { LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useUniversalPlus } from '@/components/capture/UniversalPlusProvider';
import { StepDigestCard } from './StepDigestCard';
import { CapabilityMix } from './CapabilityMix';
import { PeerJourneyChart } from './PeerJourneyChart';
import { CrewSparseList } from './CrewSparseList';
import { ReflectionSparkline } from './ReflectionSparkline';
import { CapabilityFamilySheet } from './CapabilityFamilySheet';
import { VisionBlock } from './VisionBlock';
import { VisionEditSheet } from './VisionEditSheet';
import { useUpdateInterestVision } from '@/hooks/useInterestVision';
import { useUpdatePlan, useCreatePlan } from '@/hooks/usePlan';
import { useUserOrgCompetencies } from '@/hooks/useUserOrgCompetencies';
import { useViewerFleetCohort } from '@/hooks/useViewerFleetCohort';
import { SeasonLibrarianPrompt } from './SeasonLibrarianPrompt';
import { SeasonHeaderChips } from './SeasonHeaderChips';
import { PickerListSheet } from './PickerListSheet';
import { useDragReorder } from './useDragReorder';
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
  /** Picker footer "+ New arc" — opens parent's SeasonEditSheet in add mode. */
  onAddArc?: () => void;
  /** Picker per-row pencil — opens parent's SeasonEditSheet in edit mode for this arc. */
  onEditArc?: (arcId: string) => void;
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
  onAddArc,
  onEditArc,
}: L3SeasonViewProps) {
  const effectiveSeasonId = selectedSeasonId ?? dataset.currentSeasonId;
  const season = dataset.seasons.find((s) => s.id === effectiveSeasonId)
    ?? dataset.seasons.find((s) => s.id === dataset.currentSeasonId);

  const [chartWidth, setChartWidth] = useState(0);
  const [openPicker, setOpenPicker] = useState<
    'season' | 'step' | null
  >(null);
  // Open capability family for the drill-down sheet — set when the
  // user taps a band on the CapabilityMix chart.
  const [openFamily, setOpenFamily] = useState<
    { id: string; label: string; color: string } | null
  >(null);
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
  const weekOffsetsRef = useRef<Record<string, number>>({});

  const registerWeekOffset = useCallback((weekId: string, y: number) => {
    weekOffsetsRef.current[weekId] = y;
  }, []);

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
        weekOfTotal={season.weekOfTotal}
        stepOfTotal={stepOfTotal}
        onPressSeason={() => setOpenPicker('season')}
        onPressStep={() => setOpenPicker('step')}
      />

      <VisionBlock
        statement={season.visionStatement}
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
        <View style={styles.analysisBlock} onLayout={onAnalysisLayout}>
          {flatSteps.length >= 5 ? (
            <>
              <Text style={styles.sectionEyebrow}>{interestVocab.capabilityHeader}</Text>
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
                width={chartWidth}
                height={188}
                onCapabilityPress={(id, label, color) =>
                  setOpenFamily({ id, label, color })
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

          {analysis.reflectionDensity && analysis.reflectionDensity.length > 0 ? (
            <>
              <Text style={[styles.sectionEyebrow, styles.sectionEyebrowSpace]}>
                REFLECTIONS
              </Text>
              <Text style={styles.sectionSubeyebrow}>
                weeks you paused to think
              </Text>
              <View style={styles.sparklineWrap}>
                <ReflectionSparkline
                  density={analysis.reflectionDensity}
                  totalWeeks={totalWeeks}
                  currentWeekNumber={currentWeek}
                  width={chartWidth}
                />
              </View>
            </>
          ) : null}

          {analysis.peers.length > 0 ? (
            <>
              <Text style={[styles.sectionEyebrow, styles.sectionEyebrowSpace]}>
                {interestVocab.crewHeader}
              </Text>
              <Text style={styles.sectionSubeyebrow}>
                {interestVocab.inputSubtitle}
              </Text>
              {isSparseCrew(analysis.peers) ? (
                <CrewSparseList
                  peers={analysis.peers}
                  totalWeeks={totalWeeks}
                />
              ) : (
                <PeerJourneyChart
                  peers={analysis.peers}
                  totalWeeks={totalWeeks}
                  currentWeekNumber={currentWeek}
                  width={chartWidth}
                  compact={analysis.peers.length <= 3}
                  showRole
                  peerSharedFleets={fleetCohort?.peerToFleets}
                  viewerFleets={fleetCohort?.fleets}
                />
              )}
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

      <CapabilityFamilySheet
        visible={openFamily !== null}
        onClose={() => setOpenFamily(null)}
        season={season}
        capabilityId={openFamily?.id ?? null}
        capabilityLabel={openFamily?.label ?? null}
        capabilityColor={openFamily?.color ?? null}
        interestVocab={interestVocab}
        onOpenStep={onOpenStep}
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
  sectionSubeyebrow: {
    fontSize: 11,
    fontStyle: 'italic',
    color: IOS_REGISTER.labelTertiary,
    marginLeft: 16,
    marginTop: -2,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  sparklineWrap: {
    marginHorizontal: 16,
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
    color: IOS_REGISTER.labelTertiary,
    marginTop: 3,
  },
});
