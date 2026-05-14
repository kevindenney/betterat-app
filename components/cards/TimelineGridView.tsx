/**
 * TimelineGridView - "Zoom out" grid of mini race cards
 *
 * Like Photos app: toggle from single-card view to see all races at a glance.
 * Cards are grouped by month with section headers, arranged in a responsive grid.
 * Tapping a mini card zooms back to that race in the CardGrid.
 */

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CardRaceData, isRacePast, formatTimeUntilRace } from './types';
import { isItemPast as sharedIsItemPast } from '@/lib/races/isItemPast';
import { IOS_COLORS } from './constants';
import { STEP_PALETTE } from '@/lib/step-theme';
import { triggerHaptic } from '@/lib/haptics';

// =============================================================================
// TYPES
// =============================================================================

interface TimelineGridViewProps {
  races: CardRaceData[];
  /** Currently selected race ID */
  selectedRaceId?: string;
  /** Index of the next upcoming race (used for done/planned partition and the
   *  "UP NEXT" badge — single source of truth, matches what the carousel shows). */
  nextRaceIndex?: number | null;
  /** Called when user taps a mini card */
  onSelectRace: (index: number, race: CardRaceData) => void;
  /** Current user ID for ownership checks */
  userId?: string;
  /** Callback when edit is requested for a race */
  onEditRace?: (raceId: string) => void;
  /** Callback when delete is requested for a race */
  onDeleteRace?: (raceId: string, raceName: string) => void;
  /** Callback when hide is requested for a non-owned race */
  onHideRace?: (raceId: string, raceName?: string) => void;
  /** Mark a step as done */
  onMarkDone?: (raceId: string) => void;
  /** Mark a step as not done */
  onMarkNotDone?: (raceId: string) => void;
  /** Top inset to clear the toolbar */
  topInset?: number;
  /** Bulk update status for selected steps */
  onBulkUpdateStatus?: (raceIds: string[], status: 'completed' | 'pending') => Promise<void> | void;
  /** Bulk delete selected steps */
  onBulkDeleteRaces?: (raceIds: string[]) => Promise<void> | void;
  /** Persist reordered timeline race IDs */
  onReorderRaces?: (orderedRaceIds: string[]) => Promise<void> | void;
  /** Content rendered above the grid, after the summary bar */
  renderAboveGrid?: () => React.ReactNode;
  /** Content rendered below the grid, inside the ScrollView */
  renderFooter?: () => React.ReactNode;
  /** Scroll handler forwarded from parent for toolbar hide/show */
  onContentScroll?: (event: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void;
  /** When set, the grid auto-scrolls to the card with this ID after layout.
   *  Parent clears this via onPendingScrollConsumed once scroll fires. */
  pendingNewStepId?: string | null;
  /** Called once the grid has scrolled to the pendingNewStepId target. */
  onPendingScrollConsumed?: () => void;
}

interface MonthGroup {
  key: string;
  label: string;
  races: { race: CardRaceData; index: number }[];
}
type IndexedRace = { race: CardRaceData; index: number };

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Return a single flat group of indexed races.
 *
 * Dates no longer drive positioning — steps are ordered by `sort_order`
 * (manual order, creation order for new items) within each side of TODAY.
 * Done/planned split is handled by the caller via `isItemPast`; this helper
 * just preserves the caller's array order.
 *
 * Historical shape: this previously returned one group per month with an
 * "Unscheduled" bucket slotted adjacent to NOW. That's been retired — the
 * two sections (above/below TODAY) are enough structure.
 */
function groupByMonthIndexed(
  indexedRaces: IndexedRace[],
  _sortMode?: 'planned' | 'done',
  _nextRaceIdx?: number | null,
  _preserveOrder = false,
): MonthGroup[] {
  if (indexedRaces.length === 0) return [];
  return [{ key: 'all', label: '', races: indexedRaces }];
}

function isStepOverdue(race: CardRaceData): boolean {
  if (!race.isTimelineStep) return false;
  const status = race.stepStatus || race.status;
  if (status === 'completed' || status === 'in_progress') return false;
  // Steps are only overdue when the user set an explicit due date that's now
  // in the past. This matches the carousel's RaceSummaryCard rule and keeps
  // brand-new (undated) steps from immediately appearing as OVERDUE just
  // because the RPC assigns starts_at = NOW() at creation.
  const dueAt = race.due_at;
  if (!dueAt) return false;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

// A past regatta that hasn't been explicitly marked completed still has a
// debrief waiting. The carousel and grid agree on this: "Review Due" (amber),
// not "DONE" (gray). Only regattas that passed *and* were explicitly completed
// sink to the gray DONE state.
function isRegattaReviewDue(race: CardRaceData): boolean {
  if (race.isTimelineStep) return false;
  const status = String(race.status || '').toLowerCase();
  if (status === 'completed' || status === 'done') return false;
  const dateStr = race.start_date || race.date;
  if (!dateStr) return false;
  return isRacePast(dateStr, race.startTime);
}

function getRaceStatusColor(race: CardRaceData, isNext: boolean): string {
  if (isNext) return IOS_COLORS.green;
  // Past, non-completed timeline steps surface as overdue (matches the
  // carousel's "Overdue" pill on the same card).
  if (isStepOverdue(race)) return IOS_COLORS.red;
  // Past regatta with no explicit completion → review pending (amber).
  if (isRegattaReviewDue(race)) return '#B45309';
  // Timeline steps carry an explicit status — use it instead of date logic
  if (race.isTimelineStep) {
    const s = race.status;
    if (s === 'completed') return IOS_COLORS.gray3;
    if (s === 'in_progress') return IOS_COLORS.green;
    return IOS_COLORS.blue; // scheduled / abandoned
  }
  const dateStr = race.start_date || race.date;
  const isPast = isRacePast(dateStr, race.startTime);
  if (isPast) return IOS_COLORS.gray3;
  return IOS_COLORS.blue;
}

function getRaceStatusLabel(race: CardRaceData, isNext: boolean): string {
  if (isNext) return 'UP NEXT';
  if (isStepOverdue(race)) return 'OVERDUE';
  if (isRegattaReviewDue(race)) return 'REVIEW DUE';
  // Timeline steps carry an explicit status — use it instead of date logic
  if (race.isTimelineStep) {
    const s = race.stepStatus || race.status;
    if (s === 'completed') return 'DONE';
    if (s === 'in_progress') return 'IN PROGRESS';
    return 'PLANNED';
  }
  const dateStr = race.start_date || race.date;
  const isPast = isRacePast(dateStr, race.startTime);
  if (isPast) return 'DONE';
  return formatTimeUntilRace(dateStr, race.startTime);
}

function getRaceTypeIcon(race: CardRaceData): string {
  const subtype = race.metadata?.event_subtype;
  if (subtype === 'blank_activity') return 'add-circle-outline';
  switch (race.race_type) {
    case 'distance': return 'compass-outline';
    case 'match': return 'git-compare-outline';
    case 'team': return 'people-outline';
    default: return 'boat-outline';
  }
}

// Grid cards were visually anemic: date + name + venue, then 150px of empty
// white space. Every card looked identical, regardless of whether the user
// needed to *do* something about it. This helper returns a one-line next
// action hint so each card earns its real estate ("Log your result",
// "Check weather", "3 days to prepare") instead of just displaying static
// identity. Returns null when there's nothing actionable to surface.
function getRegattaNextActionHint(
  race: CardRaceData,
  isNext: boolean,
  _statusLabel: string,
): { text: string; icon: string; color: string; bg: string } | null {
  // Completed regatta — surface result if we have one, otherwise stay quiet
  const status = String(race.status || '').toLowerCase();
  if (status === 'completed' || status === 'done') {
    const result = race.result || race.finalResult;
    if (result) {
      return {
        text: typeof result === 'string' ? result : `Finished: ${result}`,
        icon: 'trophy-outline',
        color: '#6B7280',
        bg: '#F3F4F6',
      };
    }
    return null;
  }

  // Review due — past race still waiting on a debrief
  if (isRegattaReviewDue(race)) {
    return {
      text: 'Log your result',
      icon: 'create-outline',
      color: '#B45309',
      bg: '#FEF3C7',
    };
  }

  // Up next — push the immediate pre-race prep into view
  if (isNext) {
    return {
      text: 'Check weather & plan',
      icon: 'partly-sunny-outline',
      color: IOS_COLORS.green,
      bg: 'rgba(52, 199, 89, 0.1)',
    };
  }

  // Future race — show countdown if within 14 days (actionable horizon).
  // Further-out races stay quiet so the eye isn't overwhelmed.
  const dateStr = race.start_date || race.date;
  if (dateStr) {
    const dayMs = 24 * 60 * 60 * 1000;
    const diff = new Date(dateStr).getTime() - Date.now();
    const days = Math.ceil(diff / dayMs);
    if (days > 0 && days <= 14) {
      return {
        text: `${days} ${days === 1 ? 'day' : 'days'} to prepare`,
        icon: 'time-outline',
        color: IOS_COLORS.blue,
        bg: 'rgba(0, 122, 255, 0.08)',
      };
    }
  }

  return null;
}

// =============================================================================
// MINI CARD
// =============================================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MiniCard = React.memo(function MiniCard({
  race,
  isSelected,
  isNext,
  canManage,
  onEdit,
  onDelete,
  onHide,
  onOpenDetail,
  onMarkDone,
  onMarkNotDone,
  isMenuOpen,
  onOpenMenu,
  onCloseMenu,
  onPress,
  isReorderMode = false,
  isDragging = false,
  isDropTarget = false,
  isPast = false,
  reorderIndex,
  onDragStartCard,
  onDragEnterCard,
  onDropCard,
  onLongPressCard,
}: {
  race: CardRaceData;
  isSelected: boolean;
  isNext: boolean;
  canManage: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onHide?: () => void;
  onOpenDetail?: () => void;
  onMarkDone?: () => void;
  onMarkNotDone?: () => void;
  isMenuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onPress: () => void;
  isReorderMode?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  isPast?: boolean;
  reorderIndex?: number;
  onDragStartCard?: () => void;
  onDragEnterCard?: () => void;
  onDropCard?: () => void;
  onLongPressCard?: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const statusColor = getRaceStatusColor(race, isNext);
  const statusLabel = getRaceStatusLabel(race, isNext);
  const dateStr = race.start_date || race.date;
  const d = new Date(dateStr);
  const dayNum = d.getDate();
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  const isBlankActivity = race.metadata?.event_subtype === 'blank_activity';
  const isTimelineStep = !!race.isTimelineStep;

  // Compute phase badge + progress counts for timeline steps
  const stepPhase = useMemo(() => {
    if (!isTimelineStep) return null;
    const status = race.status;
    if (status === 'completed') return { label: 'Done', color: IOS_COLORS.gray3 };
    if (status === 'in_progress') return { label: 'Do', color: IOS_COLORS.green };
    return { label: 'Plan', color: IOS_COLORS.blue };
  }, [isTimelineStep, race.status]);

  const stepInfo = useMemo(() => {
    if (!isTimelineStep) return null;
    const metadata = race.metadata;
    const howSubSteps: any[] = metadata?.plan?.how_sub_steps || [];
    const subStepProgress: Record<string, boolean> = metadata?.act?.sub_step_progress || {};

    // Only count sub-steps that have real content (not empty placeholders)
    const realSubSteps = howSubSteps.filter((s: any) => s?.text?.trim());
    const totalSubSteps = realSubSteps.length;
    // Count from progress map: entries flagged true whose index falls within the
    // real sub-step range. Earlier code computed a parallel completedSubSteps
    // derived from realSubSteps; it was unused so trimmed.
    const completedCount = totalSubSteps > 0
      ? Object.entries(subStepProgress).filter(([k, v]) => v && Number(k) < howSubSteps.length).length
      : 0;

    // Plan preview — first meaningful line of "what will you do?"
    const whatRaw: string = metadata?.plan?.what_will_you_do || '';
    const planPreview = whatRaw.split(/[.\n]/).filter(Boolean)[0]?.trim().slice(0, 60) || '';

    // Due date info
    const dueAt: string | null = race.due_at || null;
    const isOverdue = !!dueAt && race.stepStatus !== 'completed' && new Date(dueAt) < new Date();
    const isDueSoon = !!dueAt && !isOverdue && race.stepStatus !== 'completed' &&
      (new Date(dueAt).getTime() - Date.now()) < 2 * 24 * 60 * 60 * 1000; // within 2 days

    // Collaborators
    const collaboratorIds: string[] = race.collaborator_user_ids || [];

    // Has any real plan content been filled in?
    const hasContent = !!planPreview || totalSubSteps > 0 || !!race.venue || !!race.blueprintTitle;

    return {
      totalSubSteps,
      completedSubSteps: completedCount,
      planPreview,
      hasContent,
      dueAt,
      isOverdue,
      isDueSoon,
      collaboratorCount: collaboratorIds.length,
    };
    // race.blueprintTitle + race.stepStatus aren't read inside this memo; their
    // values are already encoded in race.metadata for the dimensions we care about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimelineStep, race.metadata, race.venue, race.due_at, race.collaborator_user_ids]);

  // Web DnD: attach native HTML drag events via ref since AnimatedPressable
  // doesn't forward unknown DOM props like draggable/onDragStart.
  // Use stable refs for callbacks so the effect only runs when reorderMode changes,
  // preventing listener churn that breaks mid-drag event sequences.
  const dndRef = React.useRef<any>(null);
  const dndCallbacks = React.useRef({ onDragStartCard, onDragEnterCard, onDropCard });
  dndCallbacks.current = { onDragStartCard, onDragEnterCard, onDropCard };
  // HTML5 drag-and-drop disabled — tap-to-reorder is used on all platforms
  // because React Native Web's touch handling swallows click events when
  // draggable="true" is set, preventing the second tap from firing.
  React.useEffect(() => {
    if (dndRef.current) dndRef.current.removeAttribute?.('draggable');
  }, [isReorderMode]);

  return (
    <View
      ref={dndRef}
      style={[
        { flex: 1 },
        isReorderMode && Platform.OS === 'web' ? ({ userSelect: 'none', WebkitUserSelect: 'none' } as any) : null,
      ]}
    >
    <AnimatedPressable
      style={[
        miniStyles.card,
        race.isDemo && miniStyles.cardDemo,
        isSelected && miniStyles.cardSelected,
        isNext && miniStyles.cardNext,
        isPast && !isNext && !isSelected && !isDragging && miniStyles.cardPast,
        isReorderMode && miniStyles.cardReorderMode,
        isDragging && miniStyles.cardDragging,
        isDropTarget && miniStyles.cardDropTarget,
        animStyle,
      ]}
      onPress={() => {

        if (isMenuOpen) {
          onCloseMenu();
          return;
        }
        triggerHaptic('selection');
        onPress();
      }}
      onLongPress={isReorderMode && Platform.OS !== 'web' ? onLongPressCard : undefined}
      delayLongPress={140}
      onPressIn={() => {
        if (!isReorderMode) {
          scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
        }
      }}
      onPressOut={() => {
        if (!isReorderMode) {
          scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        }
      }}
    >
      {/* Up Next accent stripe on the left edge */}
      {isNext && (
        <View style={miniStyles.upNextStripe} />
      )}

      {/* Reorder mode: order badge */}
      {isReorderMode && reorderIndex != null && (
        <View pointerEvents="none" style={[miniStyles.reorderBadge, isDragging && miniStyles.reorderBadgeActive]}>
          <Text style={[miniStyles.reorderBadgeText, isDragging && miniStyles.reorderBadgeTextActive]}>
            {reorderIndex + 1}
          </Text>
        </View>
      )}

      {/* Reorder mode: "MOVING" label on selected card */}
      {isDragging && (
        <View pointerEvents="none" style={miniStyles.movingLabel}>
          <Ionicons name="move-outline" size={10} color="#FFFFFF" />
          <Text style={miniStyles.movingLabelText}>MOVING</Text>
        </View>
      )}

      {/* Reorder mode: drop target hint */}
      {isDropTarget && (
        <View pointerEvents="none" style={miniStyles.dropTargetHint}>
          <Ionicons name="arrow-down-circle-outline" size={14} color="#3B82F6" />
          <Text style={miniStyles.dropTargetHintText}>Drop here</Text>
        </View>
      )}

      <View style={miniStyles.topRow}>
        {/* Status badge + sample pill */}
        <View style={miniStyles.topRowLeft}>
          {/* Timeline step: tappable status toggle (planned ↔ done) */}
          {isTimelineStep && (onMarkDone || onMarkNotDone) ? (
            <Pressable
              style={[miniStyles.statusToggleMini, statusLabel === 'DONE' && miniStyles.statusToggleMiniDone]}
              onPress={(event) => {
                (event as any)?.stopPropagation?.();
                triggerHaptic('impactLight');
                if (statusLabel === 'DONE' && onMarkNotDone) {
                  onMarkNotDone();
                } else if (statusLabel !== 'DONE' && onMarkDone) {
                  onMarkDone();
                }
              }}
              hitSlop={4}
            >
              <Ionicons
                name={statusLabel === 'DONE' ? 'checkmark-circle' : 'ellipse-outline'}
                size={13}
                color={statusLabel === 'DONE' ? IOS_COLORS.green : IOS_COLORS.gray3}
              />
            </Pressable>
          ) : null}
          {/* Show status label for non-timeline or meaningful statuses */}
          {!(statusLabel === 'PLANNED' && isTimelineStep) && !(statusLabel === 'DONE' && isTimelineStep) && (
            <View style={[miniStyles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={miniStyles.statusText}>{statusLabel}</Text>
            </View>
          )}
          {race.isDemo && (
            <View style={miniStyles.sampleBadge}>
              <Text style={miniStyles.sampleBadgeText}>SAMPLE</Text>
            </View>
          )}
        </View>
        {!isReorderMode && (onOpenDetail || onHide || (canManage && (onEdit || onDelete || onMarkDone || onMarkNotDone))) ? (
          <Pressable
            style={miniStyles.menuButton}
            onPress={(event) => {
              (event as any)?.stopPropagation?.();
              if (isMenuOpen) {
                onCloseMenu();
                return;
              }
              onOpenMenu();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Manage ${race.name || 'race'}`}
          >
            <Ionicons name="ellipsis-horizontal" size={14} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        ) : null}
      </View>

      {isMenuOpen ? (
        <View style={miniStyles.menuPopover}>
          {onOpenDetail ? (
            <Pressable
              style={miniStyles.menuItem}
              onPress={(event) => {
                (event as any)?.stopPropagation?.();
                onCloseMenu();
                onOpenDetail();
              }}
            >
              <Text style={miniStyles.menuItemText}>Open</Text>
            </Pressable>
          ) : null}
          {onEdit ? (
            <Pressable
              style={miniStyles.menuItem}
              onPress={(event) => {
                (event as any)?.stopPropagation?.();
                onCloseMenu();
                onEdit();
              }}
            >
              <Text style={miniStyles.menuItemText}>Edit</Text>
            </Pressable>
          ) : null}
          {/* Mark Done / Mark Not Done handled by status toggle checkbox */}
          {onDelete ? (
            <Pressable
              style={miniStyles.menuItem}
              onPress={(event) => {
                (event as any)?.stopPropagation?.();
                onCloseMenu();
                onDelete();
              }}
            >
              <Text style={[miniStyles.menuItemText, miniStyles.menuItemDestructive]}>Delete</Text>
            </Pressable>
          ) : null}
          {onHide ? (
            <Pressable
              style={miniStyles.menuItem}
              onPress={(event) => {
                (event as any)?.stopPropagation?.();
                onCloseMenu();
                onHide();
              }}
            >
              <Text style={miniStyles.menuItemText}>Hide</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isTimelineStep && stepPhase ? (
        <>
          {/* Phase badge */}
          <View style={miniStyles.phaseBadgeRow}>
            <View style={[miniStyles.phaseBadge, { backgroundColor: stepPhase.color + '18' }]}>
              <Ionicons
                name={
                  stepPhase.label === 'Done'
                    ? 'checkmark-circle'
                    : stepPhase.label === 'Do'
                    ? 'play-circle'
                    : 'bulb-outline'
                }
                size={12}
                color={stepPhase.color}
              />
              <Text style={[miniStyles.phaseBadgeText, { color: stepPhase.color }]}>
                {stepPhase.label}
              </Text>
            </View>
          </View>

          {/* Step name */}
          <Text style={miniStyles.raceName} numberOfLines={2}>
            {race.name || (isBlankActivity ? 'Blank Step' : 'Untitled')}
          </Text>

          {/* Plan preview — show what the user is working on */}
          {stepInfo?.planPreview ? (
            <Text style={miniStyles.planPreview} numberOfLines={2}>
              {stepInfo.planPreview}
            </Text>
          ) : !stepInfo?.hasContent && stepPhase?.label === 'Plan' ? (
            <Text style={miniStyles.emptyHint}>Tap to start planning</Text>
          ) : null}

          {/* Venue */}
          {race.venue && race.venue !== 'Venue TBD' && (
            <Text style={miniStyles.venue} numberOfLines={1}>
              <Ionicons name="location-outline" size={10} color={IOS_COLORS.tertiaryLabel} />
              {' '}{race.venue}
            </Text>
          )}

          {/* Blueprint provenance chip */}
          {race.blueprintTitle ? (
            <View style={miniStyles.blueprintChip}>
              <Ionicons name="book-outline" size={10} color={IOS_COLORS.secondaryLabel} />
              <Text style={miniStyles.blueprintChipText} numberOfLines={1}>
                {race.blueprintTitle}
              </Text>
            </View>
          ) : null}

          {/* Bottom row: date, due date, progress, collaborators */}
          <View style={miniStyles.cardFooter}>
            {/* Scheduled date chip */}
            {dateStr && !isNaN(dayNum) && (
              <View style={miniStyles.footerChip}>
                <Ionicons name="calendar-outline" size={10} color={IOS_COLORS.secondaryLabel} />
                <Text style={miniStyles.footerChipText}>
                  {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            )}

            {/* Due date chip — highlighted if overdue or due soon */}
            {stepInfo?.dueAt && (
              <View style={[
                miniStyles.footerChip,
                stepInfo.isOverdue && miniStyles.footerChipOverdue,
                stepInfo.isDueSoon && miniStyles.footerChipDueSoon,
              ]}>
                <Ionicons
                  name={stepInfo.isOverdue ? 'alert-circle' : 'flag-outline'}
                  size={10}
                  color={stepInfo.isOverdue ? '#FF3B30' : stepInfo.isDueSoon ? '#FF9500' : IOS_COLORS.secondaryLabel}
                />
                <Text style={[
                  miniStyles.footerChipText,
                  stepInfo.isOverdue && { color: '#FF3B30', fontWeight: '600' },
                  stepInfo.isDueSoon && { color: '#FF9500' },
                ]}>
                  {stepInfo.isOverdue ? 'Overdue' : `Due ${new Date(stepInfo.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </Text>
              </View>
            )}

            {/* Sub-step progress */}
            {stepInfo && stepInfo.totalSubSteps > 0 && (
              <View style={miniStyles.footerChip}>
                <View style={miniStyles.progressBarMini}>
                  <View
                    style={[
                      miniStyles.progressBarFill,
                      { width: `${(stepInfo.completedSubSteps / stepInfo.totalSubSteps) * 100}%` as any },
                    ]}
                  />
                </View>
                <Text style={miniStyles.footerChipText}>
                  {stepInfo.completedSubSteps}/{stepInfo.totalSubSteps}
                </Text>
              </View>
            )}

            {/* Collaborator count */}
            {stepInfo && stepInfo.collaboratorCount > 0 && (
              <View style={miniStyles.footerChip}>
                <Ionicons name="people-outline" size={10} color={IOS_COLORS.secondaryLabel} />
                <Text style={miniStyles.footerChipText}>{stepInfo.collaboratorCount}</Text>
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          {/* Date circle */}
          <View style={miniStyles.dateCircle}>
            <Text style={miniStyles.dateDay}>{dayNum}</Text>
            <Text style={miniStyles.dateDayName}>{dayName}</Text>
          </View>

          {/* Race name */}
          <Text style={miniStyles.raceName} numberOfLines={2}>
            {race.name || (isBlankActivity ? 'Blank Step' : 'Untitled')}
          </Text>

          {/* Venue */}
          {race.venue && race.venue !== 'Venue TBD' && (
            <Text style={miniStyles.venue} numberOfLines={1}>
              {race.venue}
            </Text>
          )}

          {/* Race type icon */}
          <View style={miniStyles.typeRow}>
            <Ionicons
              name={getRaceTypeIcon(race) as any}
              size={12}
              color={IOS_COLORS.tertiaryLabel}
            />
            {race.boatClass && race.boatClass !== 'Class TBD' && (
              <Text style={miniStyles.boatClass} numberOfLines={1}>{race.boatClass}</Text>
            )}
          </View>

          {/* Next-action hint — fills the previously-empty bottom half so each
              card shows what to *do*, not just static identity. Derived from
              the same flags that drive the top-row badge. */}
          {(() => {
            const hint = getRegattaNextActionHint(race, isNext, statusLabel);
            if (!hint) return null;
            return (
              <View style={[miniStyles.nextActionRow, { backgroundColor: hint.bg }]}>
                <Ionicons name={hint.icon as any} size={12} color={hint.color} />
                <Text style={[miniStyles.nextActionText, { color: hint.color }]} numberOfLines={1}>
                  {hint.text}
                </Text>
              </View>
            );
          })()}
        </>
      )}
    </AnimatedPressable>
    </View>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TimelineGridView({
  races,
  selectedRaceId,
  nextRaceIndex,
  onSelectRace,
  userId,
  onEditRace,
  onDeleteRace,
  onHideRace,
  onMarkDone,
  onMarkNotDone,
  topInset = 0,
  onBulkUpdateStatus,
  onBulkDeleteRaces,
  onReorderRaces,
  renderAboveGrid,
  renderFooter,
  onContentScroll,
  pendingNewStepId,
  onPendingScrollConsumed,
}: TimelineGridViewProps) {
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  // Map of group key → measured y offset within the ScrollView content, used
  // by the pendingNewStepId auto-scroll effect below. Per-card y tracking is
  // overkill: the user just needs to land on the group where the new card is,
  // which is the "Unscheduled" bucket in the typical case.
  const groupYOffsetsRef = useRef<Map<string, number>>(new Map());
  const [openMenuRaceId, setOpenMenuRaceId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [selectedRaceIds, setSelectedRaceIds] = useState<Set<string>>(new Set());
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [dragRaceId, setDragRaceId] = useState<string | null>(null);
  const dragRaceIdRef = useRef<string | null>(null);
  // Keep ref in sync so native DnD event callbacks always read the latest value
  dragRaceIdRef.current = dragRaceId;

  // First-time reorder-mode callout. The help bar at the top of the grid is
  // easy to miss; users assumed drag-and-drop and were confused when nothing
  // happened. Show a bigger one-time tooltip on first entry into reorder
  // mode, gated with AsyncStorage so it doesn't nag after dismissal.
  const [showReorderIntro, setShowReorderIntro] = useState(false);
  useEffect(() => {
    if (!reorderMode) return;
    let cancelled = false;
    AsyncStorage.getItem('betterat.reorderIntroDismissed').then((v) => {
      if (!cancelled && v !== '1') setShowReorderIntro(true);
    }).catch(() => { /* storage unavailable — skip tooltip */ });
    return () => { cancelled = true; };
  }, [reorderMode]);
  const dismissReorderIntro = useCallback(() => {
    setShowReorderIntro(false);
    AsyncStorage.setItem('betterat.reorderIntroDismissed', '1').catch(() => {});
  }, []);

  // Portrait tile grid: pick column count from a target tile width so cards
  // stay narrow-tall (matching the zoomed-in carousel aesthetic) instead of
  // stretching to wide landscape boxes at desktop widths.
  const horizontalPadding = 16;
  const gap = 10;
  const TARGET_MINI_TILE_WIDTH = 220;
  const availableWidth = screenWidth - horizontalPadding * 2;
  const columns = screenWidth > 380
    ? Math.max(2, Math.floor((availableWidth + gap) / (TARGET_MINI_TILE_WIDTH + gap)))
    : 1;
  const cardWidth = (availableWidth - gap * (columns - 1)) / columns;

  useEffect(() => {
    const incomingIds = races.map((race) => race.id);
    setOrderedIds((prev) => {
      if (prev.length === 0) return incomingIds;
      const next = prev.filter((id) => incomingIds.includes(id));
      for (const id of incomingIds) {
        if (!next.includes(id)) next.push(id);
      }
      return next;
    });
  }, [races]);

  const orderedRaces = useMemo(() => {
    if (orderedIds.length === 0) return races;
    const raceById = new Map(races.map((race) => [race.id, race]));
    const ordered = orderedIds
      .map((id) => raceById.get(id))
      .filter((race): race is CardRaceData => !!race);
    for (const race of races) {
      if (!ordered.some((row) => row.id === race.id)) {
        ordered.push(race);
      }
    }
    return ordered;
  }, [orderedIds, races]);

  const indexedRaces = useMemo<IndexedRace[]>(
    () => orderedRaces.map((race, index) => ({ race, index })),
    [orderedRaces],
  );
  // Past/future partition is a *per-item* check, NOT a cutoff index. Using a
  // cutoff would misclassify items when the user manually orders a past-dated
  // card after a future one (manual-order-wins model) — the past item would
  // slip into the future section because it sits after a future item in the
  // linear order. Every item is classified by its own date independently so
  // past-dated cards always land in the past section regardless of position.
  //
  // Timeline steps use `due_at` as their chronological anchor; regattas use
  // `start_date`/`date`. Undated items (step with no due_at) count as
  // "future" — they fall on the future side of TODAY so the user can drag
  // an undated prep step (e.g. "buy sails") above the next race to make it
  // UP NEXT.
  //
  // Completed regattas are treated as past regardless of date so they sink
  // into the past row (matches the carousel's completed-race UX).
  const isItemPast = useCallback(
    (race: CardRaceData): boolean => sharedIsItemPast(race),
    [],
  );

  const doneIndexedRaces = useMemo<IndexedRace[]>(
    () => indexedRaces.filter(({ race }) => isItemPast(race)),
    [indexedRaces, isItemPast],
  );
  const plannedIndexedRaces = useMemo<IndexedRace[]>(
    () => indexedRaces.filter(({ race }) => !isItemPast(race)),
    [indexedRaces, isItemPast],
  );
  // In reorder mode, merge everything into one flat chronological group
  // so drag-and-drop works across the entire timeline. The NOW divider
  // is inserted inline at the correct date position instead of between sections.
  //
  // In non-reorder mode, pass `undefined` for sortMode so month grouping is
  // applied but the within-month order is preserved from `indexedRaces`
  // (which already reflects manual reorders via `orderedIds`). This keeps
  // the order stable when toggling reorder on/off — users see the same card
  // sequence in both views.
  const plannedGroups = useMemo(
    () => groupByMonthIndexed(reorderMode ? indexedRaces : plannedIndexedRaces, undefined, nextRaceIndex, reorderMode),
    [reorderMode, indexedRaces, plannedIndexedRaces, nextRaceIndex],
  );
  const doneGroups = useMemo(
    () => reorderMode ? [] as MonthGroup[] : groupByMonthIndexed(doneIndexedRaces, undefined, null, false),
    [reorderMode, doneIndexedRaces],
  );

  // Auto-scroll to the group containing a freshly-created step once the
  // grid has measured layout. We find the group key containing the target
  // id, look up its y offset (populated via onLayout), and scroll.
  useEffect(() => {
    if (!pendingNewStepId) return;
    let cancelled = false;
    const findGroupKey = (): string | null => {
      for (const g of plannedGroups) {
        if (g.races.some(({ race }) => race.id === pendingNewStepId)) return g.key;
      }
      for (const g of doneGroups) {
        if (g.races.some(({ race }) => race.id === pendingNewStepId)) return g.key;
      }
      return null;
    };
    // onLayout for groups fires after mount; poll briefly so the scroll
    // lands after layout has stabilized. Cap retries so we never loop
    // forever if the target disappears.
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const key = findGroupKey();
      const y = key ? groupYOffsetsRef.current.get(key) : undefined;
      if (y !== undefined) {
        // Leave a small top margin so the group header is visible above the card.
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
        onPendingScrollConsumed?.();
        return;
      }
      attempts += 1;
      if (attempts < 10) setTimeout(tryScroll, 50);
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [pendingNewStepId, plannedGroups, doneGroups, onPendingScrollConsumed]);

  const handleSelectRace = useCallback(
    (index: number, race: CardRaceData) => {
      setOpenMenuRaceId(null);
      if (bulkMode) {
        setSelectedRaceIds((prev) => {
          const next = new Set(prev);
          if (next.has(race.id)) {
            next.delete(race.id);
          } else {
            next.add(race.id);
          }
          return next;
        });
        return;
      }
      onSelectRace(index, race);
    },
    [bulkMode, onSelectRace],
  );

  const selectedIdsArray = useMemo(() => Array.from(selectedRaceIds), [selectedRaceIds]);
  const canBulkEdit = Boolean(onBulkUpdateStatus || onBulkDeleteRaces);
  const canReorder = Boolean(onReorderRaces);

  useEffect(() => {
    if (!canReorder && reorderMode) {
      // Flush any pending reorder before exiting
      if (pendingOrderRef.current) {
        const order = pendingOrderRef.current;
        pendingOrderRef.current = null;
        void onReorderRaces?.(order);
      }
      setReorderMode(false);
      setDragRaceId(null);
    }
  }, [canReorder, reorderMode, onReorderRaces]);

  const clearBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedRaceIds(new Set());
  }, []);

  // Pending reorder: store locally, only persist to parent when exiting reorder mode
  const pendingOrderRef = useRef<string[] | null>(null);

  const applyReorder = useCallback((fromId: string, toId: string) => {

    if (!fromId || !toId || fromId === toId) return;
    setOrderedIds((prev) => {
      const current = prev.length ? [...prev] : races.map((race) => race.id);
      const fromIdx = current.indexOf(fromId);
      const toIdx = current.indexOf(toId);

      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return current;
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);

      pendingOrderRef.current = next;
      return next;
    });
  }, [races]);

  // Use a ref so the press handler always reads the latest dragRaceId
  // without needing it in the dependency array (which would recreate the
  // callback on every selection and potentially cause stale-closure issues).
  const dragRaceIdPressRef = useRef<string | null>(null);
  dragRaceIdPressRef.current = dragRaceId;

  const handleCardPress = useCallback((index: number, race: CardRaceData) => {
    if (reorderMode) {
      const currentDrag = dragRaceIdPressRef.current;
      if (!currentDrag) {
        setDragRaceId(race.id);
        return;
      }
      if (currentDrag === race.id) {
        setDragRaceId(null);
        return;
      }
      // Apply reorder locally (no parent callback — avoids remount)
      applyReorder(currentDrag, race.id);
      // Keep card selected for further moves
      return;
    }
    handleSelectRace(index, race);
  }, [applyReorder, handleSelectRace, reorderMode]);

  // NOTE: We intentionally render a plain View (not Animated.View with
  // FadeIn) here. The 250ms fade on remount made the grid/card toggle feel
  // sluggish on Android — the button had already been tapped but the new
  // view crossfaded in over a quarter second, which the user experienced as
  // "the button is slow." Snapping into view immediately is faster.
  return (
    <View
      style={[gridStyles.container, { paddingTop: topInset + 8 }]}
    >
      <ScrollView
        ref={scrollRef}
        style={gridStyles.scrollView}
        contentContainerStyle={[
          gridStyles.scrollContent,
          { paddingHorizontal: horizontalPadding },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          setOpenMenuRaceId(null);
          onContentScroll?.(e);
        }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setOpenMenuRaceId(null)}
      >
        {/* Summary bar */}
        <View style={gridStyles.summaryBar}>
          <View style={gridStyles.summaryLeft}>
            {canBulkEdit && (
              <Pressable
                style={[gridStyles.bulkChip, bulkMode && gridStyles.bulkChipActive]}
                onPress={() => {
                  if (bulkMode) {
                    clearBulk();
                  } else {
                    setBulkMode(true);
                    setSelectedRaceIds(new Set());
                  }
                }}
              >
                <Text style={[gridStyles.bulkChipText, bulkMode && gridStyles.bulkChipTextActive]}>
                  {bulkMode ? 'Exit Bulk' : 'Bulk Edit'}
                </Text>
              </Pressable>
            )}
            {canReorder ? (
              <Pressable
                style={[gridStyles.bulkChip, reorderMode && gridStyles.bulkChipActive]}
                onPress={() => {
                  setReorderMode((prev) => {
                    if (prev) {
                      // Exiting reorder mode — flush pending order to parent
                      if (pendingOrderRef.current) {
                        const order = pendingOrderRef.current;
                        pendingOrderRef.current = null;
                        queueMicrotask(() => void onReorderRaces?.(order));
                      }
                      setDragRaceId(null);
                    }
                    return !prev;
                  });
                  setBulkMode(false);
                  setSelectedRaceIds(new Set());
                }}
              >
                <Text style={[gridStyles.bulkChipText, reorderMode && gridStyles.bulkChipTextActive]}>
                  {reorderMode ? 'Reordering…' : 'Reorder'}
                </Text>
              </Pressable>
            ) : null}
            {/* Summary "Next:" badge — hide when the parent's nextRaceIndex
                is pointing at a past/overdue item (parent uses linear order,
                not the grid's per-item isItemPast classification). Otherwise
                the badge would read e.g. "Next: hire a pro" for a step that
                was due 5 days ago, which contradicts its own Overdue pill. */}
            {(() => {
              if (nextRaceIndex == null || nextRaceIndex < 0) return null;
              const candidate = orderedRaces[nextRaceIndex];
              if (!candidate || isItemPast(candidate)) return null;
              return (
                <View style={gridStyles.summaryNextBadge}>
                  <View style={gridStyles.summaryNextDot} />
                  <Text style={gridStyles.summaryNextText} numberOfLines={1}>
                    Next: {candidate.name || 'Upcoming'}
                  </Text>
                </View>
              );
            })()}
          </View>
          {bulkMode && selectedIdsArray.length > 0 && (
            <View style={gridStyles.bulkActions}>
              <Text style={gridStyles.bulkCount}>{selectedIdsArray.length}</Text>
              {onBulkUpdateStatus ? (
                <Pressable
                  style={gridStyles.bulkActionChip}
                  onPress={() => void onBulkUpdateStatus(selectedIdsArray, 'pending')}
                >
                  <Text style={gridStyles.bulkActionText}>Not Done</Text>
                </Pressable>
              ) : null}
              {onBulkUpdateStatus ? (
                <Pressable
                  style={gridStyles.bulkActionChip}
                  onPress={() => void onBulkUpdateStatus(selectedIdsArray, 'completed')}
                >
                  <Text style={gridStyles.bulkActionText}>Done</Text>
                </Pressable>
              ) : null}
              {onBulkDeleteRaces ? (
                <Pressable
                  style={[gridStyles.bulkActionChip, gridStyles.bulkDeleteChip]}
                  onPress={() => void onBulkDeleteRaces(selectedIdsArray)}
                >
                  <Text style={[gridStyles.bulkActionText, gridStyles.bulkDeleteText]}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        {reorderMode && showReorderIntro ? (
          <Pressable onPress={dismissReorderIntro} style={gridStyles.reorderIntroCallout}>
            <View style={gridStyles.reorderIntroIconWrap}>
              <Ionicons name="hand-left" size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={gridStyles.reorderIntroTitle}>Reorder by tap, not drag</Text>
              <Text style={gridStyles.reorderIntroBody}>
                Tap a card to pick it up, then tap where you want it to go. Tap again to deselect.
              </Text>
            </View>
            <Ionicons name="close" size={18} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        ) : null}

        {reorderMode ? (
          <View style={[gridStyles.reorderHelpBar, dragRaceId && gridStyles.reorderHelpBarActive]}>
            <Ionicons
              name={dragRaceId ? 'swap-vertical' : 'hand-left-outline'}
              size={14}
              color={dragRaceId ? '#3B82F6' : IOS_COLORS.secondaryLabel}
              style={{ marginRight: 6 }}
            />
            <Text style={[gridStyles.reorderHelpText, dragRaceId && gridStyles.reorderHelpTextActive]}>
              {dragRaceId
                ? `Tap where to place "${orderedRaces.find((r) => r.id === dragRaceId)?.name || 'step'}", or tap it again to deselect`
                : 'Tap a step to select it for moving'}
            </Text>
          </View>
        ) : null}

        {renderAboveGrid?.()}

        {/* Past section first (top of grid) — mirrors the carousel's
            left-to-right past → NOW → future timeline. */}
        {doneGroups.map((group) => {
          const renderDoneMiniCard = ({ race, index }: IndexedRace) => (
            <View key={race.id} style={[{ width: cardWidth }, openMenuRaceId === race.id && { zIndex: 50 }]}>
              {(() => {
                const canManage = !!userId && race.created_by === userId && !race.isDemo;
                const isStep = !!race.isTimelineStep;
                const handleEdit = canManage
                  ? (isStep ? () => handleCardPress(index, race) : onEditRace ? () => onEditRace(race.id) : undefined)
                  : undefined;
                const handleDelete = canManage && onDeleteRace ? () => onDeleteRace(race.id, race.name) : undefined;
                const handleOpenDetail = isStep ? () => handleCardPress(index, race) : onEditRace ? () => onEditRace(race.id) : undefined;
                return (
                  <MiniCard
                    race={race}
                    isSelected={reorderMode ? false : bulkMode ? selectedRaceIds.has(race.id) : race.id === selectedRaceId}
                    // UP NEXT never applies to cards in the past section — they
                    // live above the TODAY divider and are already past/overdue.
                    // Parent's nextRaceIndex can still point at an overdue step
                    // (it uses linear order, not per-item past classification),
                    // so we hard-ignore it here to stop the green UP NEXT badge
                    // from stacking with a red Overdue/Review-Due badge on the
                    // same card.
                    isNext={false}
                    canManage={canManage}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onOpenDetail={handleOpenDetail}
                    onMarkNotDone={canManage && isStep && onMarkNotDone ? () => onMarkNotDone(race.id) : undefined}
                    isMenuOpen={reorderMode ? false : openMenuRaceId === race.id}
                    onOpenMenu={() => setOpenMenuRaceId(race.id)}
                    onCloseMenu={() => setOpenMenuRaceId((current) => (current === race.id ? null : current))}
                    onPress={() => handleCardPress(index, race)}
                    isReorderMode={reorderMode}
                    isDragging={dragRaceId === race.id}
                    isDropTarget={reorderMode && !!dragRaceId && dragRaceId !== race.id}
                    isPast
                    reorderIndex={reorderMode ? orderedIds.indexOf(race.id) : undefined}
                    onLongPressCard={() => {
                      if (!reorderMode || Platform.OS === 'web') return;
                      setDragRaceId(race.id);
                    }}
                    onDragStartCard={() => { dragRaceIdRef.current = race.id; setDragRaceId(race.id); }}
                    onDragEnterCard={() => {
                      const from = dragRaceIdRef.current;
                      if (from && from !== race.id) {
                        applyReorder(from, race.id);
                      }
                    }}
                    onDropCard={() => {
                      dragRaceIdRef.current = null; setDragRaceId(null);
                    }}
                  />
                );
              })()}
            </View>
          );

          const doneRows: React.ReactNode[] = [];
          for (let i = 0; i < group.races.length; i += columns) {
            const rowItems = group.races.slice(i, i + columns);
            doneRows.push(
              <View key={`done-${group.key}-row-${i}`} style={[gridStyles.gridRow, { gap }]}>
                {rowItems.map(renderDoneMiniCard)}
              </View>
            );
          }

          return (
            <View key={`done-${group.key}`} style={gridStyles.monthSection}>
              {group.label ? (
                <Text style={gridStyles.monthHeaderDone}>{group.label}</Text>
              ) : null}
              <View style={{ gap }}>{doneRows}</View>
            </View>
          );
        })}

        {/* TODAY divider between past and future sections */}
        {!reorderMode && doneGroups.length > 0 && plannedGroups.length > 0 ? (
          <View style={gridStyles.nowDividerWrap}>
            <View style={gridStyles.nowDividerLine} />
            <View style={gridStyles.nowDividerBadge}>
              <Text style={gridStyles.nowDividerBadgeText}>TODAY</Text>
            </View>
            <View style={gridStyles.nowDividerLine} />
          </View>
        ) : null}

        {plannedGroups.map((group, groupIdx) => {
          // Suppress the month header on the first planned group when it
          // matches the last done group's month — otherwise "April 2026"
          // would appear on both sides of the TODAY divider. The divider
          // itself already signals the boundary between past and future, so
          // repeating the month label is just noise.
          const lastDoneKey = doneGroups.length > 0 ? doneGroups[doneGroups.length - 1].key : null;
          const suppressMonthHeader =
            groupIdx === 0 &&
            !reorderMode &&
            lastDoneKey === group.key &&
            group.key !== 'unscheduled';
          // In reorder mode, find where "today" falls in the chronological list
          // so we can insert an inline TODAY marker between past and future items.
          // Uses the same per-item isItemPast logic as the non-reorder partition
          // so a step's due_at is respected (a step isn't past because its
          // start_date is missing).
          const todaySplitIndex = reorderMode ? (() => {
            const idx = group.races.findIndex(({ race }) => !isItemPast(race));
            return idx;
          })() : -1;

          const renderMiniCard = ({ race, index }: IndexedRace) => (
            <View
              key={race.id}
              style={[{ width: cardWidth }, openMenuRaceId === race.id && { zIndex: 50 }]}
            >
              {(() => {
                const canManage = !!userId && race.created_by === userId && !race.isDemo;
                const isStep = !!race.isTimelineStep;
                const handleEdit = canManage
                  ? (isStep ? () => handleCardPress(index, race) : onEditRace ? () => onEditRace(race.id) : undefined)
                  : undefined;
                const handleDelete = canManage && onDeleteRace ? () => onDeleteRace(race.id, race.name) : undefined;
                const handleHide = !canManage && onHideRace ? () => onHideRace(race.id, race.name) : undefined;
                const handleOpenDetail = isStep ? () => handleCardPress(index, race) : onEditRace ? () => onEditRace(race.id) : undefined;
                return (
              <MiniCard
                race={race}
                isSelected={reorderMode ? false : bulkMode ? selectedRaceIds.has(race.id) : race.id === selectedRaceId}
                // Match the done-section guard: UP NEXT requires the card to
                // be in the future. The planned section's filter already
                // excludes past items via isItemPast, but this extra guard
                // keeps the contract explicit (no past card ever paints the
                // green UP NEXT stripe).
                isNext={reorderMode ? false : (index === nextRaceIndex && !isItemPast(race))}
                canManage={canManage}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onHide={handleHide}
                onOpenDetail={handleOpenDetail}
                onMarkDone={canManage && isStep && onMarkDone ? () => onMarkDone(race.id) : undefined}
                isMenuOpen={reorderMode ? false : openMenuRaceId === race.id}
                onOpenMenu={() => setOpenMenuRaceId(race.id)}
                onCloseMenu={() => setOpenMenuRaceId((current) => (current === race.id ? null : current))}
                onPress={() => handleCardPress(index, race)}
                isReorderMode={reorderMode}
                isDragging={dragRaceId === race.id}
                isDropTarget={reorderMode && !!dragRaceId && dragRaceId !== race.id}
                isPast={reorderMode && isItemPast(race)}
                reorderIndex={reorderMode ? orderedIds.indexOf(race.id) : undefined}
                onLongPressCard={() => {
                  if (!reorderMode || Platform.OS === 'web') return;
                  setDragRaceId(race.id);
                }}
                onDragStartCard={() => { dragRaceIdRef.current = race.id; setDragRaceId(race.id); }}
                onDragEnterCard={() => {
                  const from = dragRaceIdRef.current;
                  if (from && from !== race.id) {
                    applyReorder(from, race.id);
                  }
                }}
                onDropCard={() => {
                  dragRaceIdRef.current = null; setDragRaceId(null);
                }}
              />
                );
              })()}
            </View>
          );

          // Chunk cards into fixed-size rows so row-mates can stretch to equal height
          const renderCardRows = (items: IndexedRace[], keyPrefix: string) => {
            const rows: React.ReactNode[] = [];
            for (let i = 0; i < items.length; i += columns) {
              const rowItems = items.slice(i, i + columns);
              rows.push(
                <View key={`${keyPrefix}-row-${i}`} style={[gridStyles.gridRow, { gap }]}>
                  {rowItems.map(renderMiniCard)}
                </View>
              );
            }
            return rows;
          };

          return (
          <View
            key={group.key}
            style={gridStyles.monthSection}
            onLayout={(e) => {
              // Track each group's y offset within the ScrollView content so
              // the pendingNewStepId effect can scroll directly to the group
              // containing the new card.
              groupYOffsetsRef.current.set(group.key, e.nativeEvent.layout.y);
            }}
          >
            {/* Month / section header — hide "Unscheduled" when it's the only group,
                hide month header when it's the same month that just appeared above
                TODAY (the divider already signals the boundary). */}
            {group.label && !suppressMonthHeader ? (
              group.key === 'unscheduled' ? (
                plannedGroups.length > 1 ? (
                  <View style={gridStyles.unscheduledHeader}>
                    <Ionicons name="calendar-outline" size={14} color={IOS_COLORS.tertiaryLabel} />
                    <Text style={gridStyles.unscheduledHeaderText}>{group.label}</Text>
                  </View>
                ) : null
              ) : (
                <Text style={gridStyles.monthHeader}>{group.label}</Text>
              )
            ) : null}

            {/* Card grid — in reorder mode, split at today with inline NOW marker */}
            {reorderMode && todaySplitIndex > 0 ? (
              <>
                <View style={{ gap }}>
                  {renderCardRows(group.races.slice(0, todaySplitIndex), `${group.key}-pre`)}
                </View>
                <View style={gridStyles.nowDividerWrap}>
                  <View style={gridStyles.nowDividerLine} />
                  <View style={gridStyles.nowDividerBadge}>
                    <Text style={gridStyles.nowDividerBadgeText}>TODAY</Text>
                  </View>
                  <View style={gridStyles.nowDividerLine} />
                </View>
                <View style={{ gap }}>
                  {renderCardRows(group.races.slice(todaySplitIndex), `${group.key}-post`)}
                </View>
              </>
            ) : (
              <View style={{ gap }}>
                {renderCardRows(group.races, group.key)}
              </View>
            )}
          </View>
          );
        })}

        {renderFooter?.()}

        {/* Bottom spacer for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const miniStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    // Portrait aspect — width/height ratio. 0.72 ≈ 220w × 305h at target
    // tile size, matching the zoomed-in carousel's narrow-tall shape.
    aspectRatio: 0.72,
    minHeight: 180,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: IOS_COLORS.blue,
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 2px #007AFF, 0 2px 8px rgba(0,122,255,0.15)',
      } as any,
      default: {
        shadowColor: IOS_COLORS.blue,
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
    }),
  },
  cardDemo: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderStyle: 'dashed' as any,
    opacity: 0.82,
    backgroundColor: '#FAFBFC',
  },
  cardNext: {
    // Green accent comes from the upNextStripe + badge — no full border needed
  },
  cardPast: {
    // Dim past cards so the time axis is legible at a glance — reinforces
    // the TODAY divider when it has scrolled off screen.
    opacity: 0.72,
    backgroundColor: '#F8FAFC',
  },
  upNextStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: IOS_COLORS.green,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    zIndex: 10,
  },
  cardReorderMode: {
    ...Platform.select({
      web: {
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as any,
    }),
  },
  cardDragging: {
    opacity: 0.85,
    borderColor: '#3B82F6',
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
    ...Platform.select({
      web: {
        cursor: 'grabbing',
        boxShadow: '0 0 0 3px rgba(59,130,246,0.3), 0 4px 12px rgba(59,130,246,0.15)',
      } as any,
    }),
  },
  cardDropTarget: {
    borderWidth: 2,
    borderColor: '#93C5FD',
    borderStyle: 'dashed' as any,
    backgroundColor: '#F0F9FF',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  reorderBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  reorderBadgeActive: {
    backgroundColor: '#3B82F6',
  },
  reorderBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  reorderBadgeTextActive: {
    color: '#FFFFFF',
  },
  movingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 3,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  movingLabelText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  dropTargetHint: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 3,
    marginBottom: 2,
  },
  dropTargetHintText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#3B82F6',
  },
  statusToggleMini: {
    padding: 2,
    marginBottom: 4,
  },
  statusToggleMiniDone: {
    opacity: 0.8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  topRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  sampleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginBottom: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.22)',
    borderStyle: 'dashed',
  },
  sampleBadgeText: {
    fontSize: 8,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.6,
  },
  menuButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.04)',
  },
  menuPopover: {
    position: 'absolute',
    top: 36,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    minWidth: 96,
    zIndex: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 6px 16px rgba(15,23,42,0.16)',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.16,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      },
    }),
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  menuItemDestructive: {
    color: IOS_COLORS.red,
  },
  dateCircle: {
    alignItems: 'center',
    marginBottom: 6,
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    lineHeight: 26,
  },
  dateDayName: {
    fontSize: 10,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  raceName: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 16,
    marginBottom: 2,
    textAlign: 'center',
  },
  venue: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
    marginBottom: 4,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 'auto' as any,
  },
  boatClass: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
    fontWeight: '500',
  },
  stepDateLine: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginBottom: 4,
  },
  phaseBadgeRow: {
    alignItems: 'center',
    marginBottom: 6,
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  phaseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  progressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  emptyHint: {
    fontSize: 11,
    fontWeight: '400',
    fontStyle: 'italic',
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 6,
  },
  planPreview: {
    fontSize: 11,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 15,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 'auto' as any,
    paddingTop: 8,
  },
  footerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  footerChipOverdue: {
    backgroundColor: '#FF3B3010',
  },
  footerChipDueSoon: {
    backgroundColor: '#FF950010',
  },
  footerChipText: {
    fontSize: 9,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  progressBarMini: {
    width: 20,
    height: 3,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: IOS_COLORS.green,
    borderRadius: 2,
  },
  blueprintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  blueprintChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    flexShrink: 1,
  },
  // Bottom action-hint pill — sits under the typeRow at the bottom of the
  // regatta card. The background tint is driven by the hint color so a
  // glance at the card's bottom tells the user whether something is overdue
  // (amber), active (green), or simply approaching (blue).
  nextActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  nextActionText: {
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
  },
});

const gridStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    ...(Platform.OS === 'web' ? { overflow: 'hidden' as any } : {}),
  },
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' ? { overflow: 'auto' as any } : {}),
  },
  scrollContent: {
    paddingTop: 8,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flexShrink: 1,
  },
  summaryNextBadge: {
    // "Next: …" pill — lavender info bg + violet text per redesign §2.4
    // (mockup 06 "from playbook" surface treatment).
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: STEP_PALETTE.bgInfo,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    flexShrink: 1,
  },
  summaryNextDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: STEP_PALETTE.textInfo,
  },
  summaryNextText: {
    fontSize: 11,
    fontWeight: '600',
    color: STEP_PALETTE.textInfo,
    maxWidth: 220,
  },
  bulkChip: {
    // Outlined neutral pill per secondary-surfaces audit §4 commit 1 —
    // replaces the indigo "EEF2FF / C7D2FE" treatment with borderSecondary.
    backgroundColor: 'transparent',
    borderColor: STEP_PALETTE.borderSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bulkChipActive: {
    backgroundColor: STEP_PALETTE.ctaBg,
    borderColor: STEP_PALETTE.ctaBg,
  },
  bulkChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: STEP_PALETTE.textSecondary,
  },
  bulkChipTextActive: {
    color: STEP_PALETTE.ctaText,
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulkCount: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    minWidth: 16,
    textAlign: 'right',
  },
  bulkActionChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bulkActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  bulkDeleteChip: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  bulkDeleteText: {
    color: '#B91C1C',
  },
  reorderHelpBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reorderIntroCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  reorderIntroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderIntroTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 2,
  },
  reorderIntroBody: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  reorderHelpBarActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  reorderHelpText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    flex: 1,
  },
  reorderHelpTextActive: {
    color: '#2563EB',
  },
  monthSection: {
    marginBottom: 20,
  },
  monthHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  unscheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  unscheduledHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
  },
  monthHeaderDone: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  nowDividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  nowDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: IOS_COLORS.green,
    opacity: 0.5,
  },
  nowDividerBadge: {
    backgroundColor: '#34D399',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  nowDividerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
