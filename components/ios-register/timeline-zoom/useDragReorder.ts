/**
 * useDragReorder — long-press-to-lift + finger-tracking drag for vertical
 * lists of step cards. Section D / Frame 13.
 *
 * Model: the caller owns an ordered array of `items` with stable ids. The
 * hook tracks which item is lifted (if any), where the finger is, and what
 * the resulting insertion index would be if released right now. On drop,
 * it calls `onReorder(itemId, fromIndex, toIndex)` and the caller persists
 * the new sort_order to the backend.
 *
 * Scroll conflict: the hook also exposes `isDragging` (React state). The
 * caller passes that into its ScrollView's `scrollEnabled` prop so the
 * list stops scrolling once a card is lifted. Without this, the parent
 * scroll would steal the pan and the drag would feel broken.
 *
 * Layout: the caller registers row layouts via `registerRowLayout(itemId,
 * rect)` from each item's `onLayout`. The hook uses those rects to compute
 * which row the finger is over.
 */

import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

interface RowRect {
  /**
   * Start of the row along the active axis (y for vertical, x for
   * horizontal) in the list's local coordinate space.
   */
  start: number;
  /** Length along the active axis (height for vertical, width for horizontal). */
  length: number;
}

export type DragAxis = 'vertical' | 'horizontal';

export interface UseDragReorderArgs<T extends { id: string }> {
  items: T[];
  /** Called when the user drops at a new index. */
  onReorder: (itemId: string, fromIndex: number, toIndex: number) => void;
  /** Disabled in non-owner mode (e.g. blueprint preview surfaces). */
  enabled?: boolean;
  /**
   * Optional drop interceptor. Called on every drop with the dropped item id
   * and its from/to indices. Return true to "consume" the drop — the hook then
   * skips the reorder (onReorder is not called). Lets a caller repurpose a drop
   * into a different action (e.g. dropping a step across NOW flips its status).
   */
  onDrop?: (itemId: string, fromIndex: number, toIndex: number) => boolean;
  /**
   * Axis the items are arranged along — 'vertical' for L3's two-up
   * weeks (default), 'horizontal' for L2's swiping carousel. Hit
   * testing uses Y or X accordingly, and the translate that the
   * caller applies to the lifted card should follow the same axis.
   */
  axis?: DragAxis;
}

export interface UseDragReorderApi {
  /** Tag the lifted item; render its overlay style on top with elevated z. */
  liftedId: string | null;
  /** Where the lifted card will land if released right now. */
  dropTargetIndex: number | null;
  /** True while a card is lifted — caller binds this to scrollEnabled. */
  isDragging: boolean;
  /** Returns a Pan-after-LongPress gesture to attach to each item. */
  buildItemGesture: (itemId: string, index: number) => ReturnType<typeof Gesture.Pan>;
  /** Bind onLayout of each row wrapper to feed hit-testing. */
  registerRowLayout: (itemId: string, rect: RowRect) => void;
  /** Translate delta along the active axis (Y for vertical, X for horizontal). */
  liftedTranslate: number;
}

const LIFT_ACTIVATION_MS = 280;

export function useDragReorder<T extends { id: string }>({
  items,
  onReorder,
  enabled = true,
  axis = 'vertical',
  onDrop,
}: UseDragReorderArgs<T>): UseDragReorderApi {
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [liftedTranslate, setLiftedTranslate] = useState(0);

  const rowRectsRef = useRef<Map<string, RowRect>>(new Map());
  const startIndexRef = useRef<number>(-1);
  const startCenterRef = useRef<number>(0);
  // Mirror dropTargetIndex into a ref so handleDrop can resolve the target
  // WITHOUT reading it inside a setState updater. Side effects a caller runs
  // on drop (e.g. showing a confirm sheet for a cross-NOW status flip) must
  // not fire from inside React's state-update phase, or the alert can swallow
  // the gesture's next touch and freeze further drags.
  const dropTargetIndexRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const axisRef = useRef(axis);
  axisRef.current = axis;

  const registerRowLayout = useCallback((itemId: string, rect: RowRect) => {
    rowRectsRef.current.set(itemId, rect);
  }, []);

  const computeIndexFromCoord = useCallback((coord: number): number => {
    // Walk in order; the first row whose midpoint along the active axis
    // is past the finger gives us the insertion index. If we never find
    // one, the finger is past the last row → append.
    const current = itemsRef.current;
    for (let i = 0; i < current.length; i++) {
      const rect = rowRectsRef.current.get(current[i].id);
      if (!rect) continue;
      const mid = rect.start + rect.length / 2;
      if (coord < mid) return i;
    }
    return current.length - 1;
  }, []);

  const handleLiftStart = useCallback((itemId: string, index: number) => {
    const rect = rowRectsRef.current.get(itemId);
    if (!rect) return;
    startIndexRef.current = index;
    startCenterRef.current = rect.start + rect.length / 2;
    setLiftedId(itemId);
    setDropTargetIndex(index);
    dropTargetIndexRef.current = index;
    setLiftedTranslate(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const handlePanUpdate = useCallback(
    (translation: number) => {
      setLiftedTranslate(translation);
      const fingerCoord = startCenterRef.current + translation;
      const idx = computeIndexFromCoord(fingerCoord);
      dropTargetIndexRef.current = idx;
      setDropTargetIndex((prev) => {
        if (prev !== idx) {
          Haptics.selectionAsync().catch(() => {});
        }
        return idx;
      });
    },
    [computeIndexFromCoord],
  );

  const handleDrop = useCallback(() => {
    const from = startIndexRef.current;
    const target = dropTargetIndexRef.current ?? from;
    // Resolve + dispatch OUTSIDE any setState updater (target comes from a
    // ref, not the updater arg) so a caller's onDrop side effect — e.g. a
    // confirm sheet — runs in a plain callback and doesn't wedge the gesture.
    if (liftedId && from >= 0 && target >= 0) {
      const consumed = onDrop?.(liftedId, from, target) === true;
      if (!consumed && from !== target) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        onReorder(liftedId, from, target);
      }
    }
    setDropTargetIndex(null);
    dropTargetIndexRef.current = null;
    setLiftedId(null);
    setLiftedTranslate(0);
    startIndexRef.current = -1;
  }, [liftedId, onReorder, onDrop]);

  const buildItemGesture = useCallback(
    (itemId: string, index: number) =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(LIFT_ACTIVATION_MS)
        .onStart(() => {
          'worklet';
          runOnJS(handleLiftStart)(itemId, index);
        })
        .onUpdate((e) => {
          'worklet';
          const t = axisRef.current === 'horizontal' ? e.translationX : e.translationY;
          runOnJS(handlePanUpdate)(t);
        })
        .onFinalize(() => {
          'worklet';
          // onFinalize covers both onEnd and cancel — ensures cleanup
          // even when the gesture is interrupted (e.g. another card
          // claims focus). handleDrop is idempotent for the cancel case.
          runOnJS(handleDrop)();
        }),
    [enabled, handleLiftStart, handlePanUpdate, handleDrop],
  );

  return {
    liftedId,
    dropTargetIndex,
    isDragging: liftedId !== null,
    buildItemGesture,
    registerRowLayout,
    liftedTranslate,
  };
}
