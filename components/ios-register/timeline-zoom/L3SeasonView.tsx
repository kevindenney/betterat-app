/**
 * L3 — current season in full, weeks as section heads, vertical scroll.
 *
 * Frame 3/7. Season title (e.g. "Spring '26 clinical"), org chip, date
 * range and "Week N of M". Sticky toolbar: Sort / Capability / Select.
 * Vertical sections per week with WEEK header + 2-up step cards.
 * Today's card is outlined iOS blue.
 *
 * Section D drag-reorder (Frame 13): long-press any digest card to lift
 * it and drag to a new position. The hook tracks finger Y vs. row
 * midpoints and fires `onReorder` on drop. The parent canvas persists
 * the new sort_order via the existing updateStep mutation.
 */

import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { StepDigestCard } from './StepDigestCard';
import { useDragReorder } from './useDragReorder';
import type { TimelineDataset, TimelineStep } from './types';

interface L3SeasonViewProps {
  dataset: TimelineDataset;
  focusStepId: string;
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
}

export function L3SeasonView({
  dataset,
  focusStepId,
  onOpenStep,
  onEnterSelectMode,
  onReorderStep,
}: L3SeasonViewProps) {
  const season = dataset.seasons.find((s) => s.id === dataset.currentSeasonId);

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
        // Resolve neighbor ids in the post-drop ordering. Remove the
        // moved item first; the indices the hook hands us are already
        // expressed as the target insertion index in the full list,
        // but we need it in the without-moved list for the neighbor
        // lookup to be unambiguous.
        const without = flatSteps.filter((s) => s.id !== id);
        const clamped = Math.max(0, Math.min(to, without.length));
        const before = without[clamped - 1]?.id ?? null;
        const after = without[clamped]?.id ?? null;
        onReorderStep?.(id, before, after);
        // `from` participated in computing `to`; silence the unused-arg
        // lint without changing the public contract.
        void from;
      },
      [flatSteps, onReorderStep],
    ),
  });

  if (!season) return null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!drag.isDragging}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.title}>{season.title}</Text>
        <View style={styles.metaRow}>
          {season.orgChip ? (
            <View style={styles.orgChip}>
              <View style={styles.orgMonogram}>
                <Text style={styles.orgMonogramText}>{season.orgChip.monogram}</Text>
              </View>
              <Text style={styles.orgLabel}>{season.orgChip.label}</Text>
            </View>
          ) : null}
          <Text style={styles.dateRange}>{season.dateRange}</Text>
        </View>
        {season.weekOfTotal ? (
          <Text style={styles.weekOf}>
            Week {season.weekOfTotal.current} of {season.weekOfTotal.total}
          </Text>
        ) : null}
      </View>

      <View style={styles.toolbar}>
        <ToolbarButton icon="swap-vertical-outline" label="Sort" />
        <ToolbarButton icon="filter-outline" label="Capability" />
        <ToolbarButton
          icon="checkmark-circle-outline"
          label="Select"
          onPress={onEnterSelectMode}
        />
      </View>

      {season.weeks.map((week) => (
        <View key={week.id} style={styles.weekBlock}>
          <View style={styles.weekHeadRow}>
            <Text style={styles.weekHead}>
              WEEK {week.number}
              {week.isCurrent ? '  ·  THIS WEEK' : ''}
            </Text>
            <Text style={styles.weekRange}>{week.dateRange}</Text>
          </View>
          <View style={styles.cardPair}>
            {week.steps.slice(0, 2).map((step) => {
              const flatIndex = flatSteps.findIndex((s) => s.id === step.id);
              const isLifted = drag.liftedId === step.id;
              const showDropIndicatorBefore =
                drag.dropTargetIndex === flatIndex && !isLifted;
              return (
                <DraggableCardSlot
                  key={step.id}
                  step={step}
                  flatIndex={flatIndex}
                  isLifted={isLifted}
                  showDropIndicatorBefore={showDropIndicatorBefore}
                  liftedTranslateY={drag.liftedTranslate}
                  highlighted={step.id === focusStepId}
                  onOpen={() => onOpenStep(step.id)}
                  buildGesture={drag.buildItemGesture}
                  registerRowLayout={drag.registerRowLayout}
                />
              );
            })}
            {week.steps.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

interface DraggableCardSlotProps {
  step: TimelineStep;
  flatIndex: number;
  isLifted: boolean;
  showDropIndicatorBefore: boolean;
  liftedTranslateY: number;
  highlighted: boolean;
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

  return (
    <View style={styles.dropSlotWrap}>
      {showDropIndicatorBefore ? <View style={styles.dropIndicator} /> : null}
      <GestureDetector gesture={gesture}>
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
        </Animated.View>
      </GestureDetector>
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
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 14,
    paddingLeft: 2,
    paddingRight: 10,
    paddingVertical: 2,
    gap: 6,
  },
  orgMonogram: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6E2E8B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgMonogramText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  orgLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  dateRange: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  weekOf: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 6,
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
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
    paddingVertical: 10,
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  weekBlock: {
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
});
