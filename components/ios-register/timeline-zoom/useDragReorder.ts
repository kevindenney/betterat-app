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
  /** Top of the row relative to the list's coordinate space. */
  y: number;
  height: number;
}

export interface UseDragReorderArgs<T extends { id: string }> {
  items: T[];
  /** Called when the user drops at a new index. */
  onReorder: (itemId: string, fromIndex: number, toIndex: number) => void;
  /** Disabled in non-owner mode (e.g. blueprint preview surfaces). */
  enabled?: boolean;
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
  /** Translate-Y delta applied to the lifted card while dragging. */
  liftedTranslateY: number;
}

const LIFT_ACTIVATION_MS = 280;

export function useDragReorder<T extends { id: string }>({
  items,
  onReorder,
  enabled = true,
}: UseDragReorderArgs<T>): UseDragReorderApi {
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [liftedTranslateY, setLiftedTranslateY] = useState(0);

  const rowRectsRef = useRef<Map<string, RowRect>>(new Map());
  const startIndexRef = useRef<number>(-1);
  const startCenterYRef = useRef<number>(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const registerRowLayout = useCallback((itemId: string, rect: RowRect) => {
    rowRectsRef.current.set(itemId, rect);
  }, []);

  const computeIndexFromY = useCallback((centerY: number): number => {
    // Walk in order; the first row whose vertical midpoint is below the
    // finger gives us the insertion index. If we never find one, the
    // finger is past the last row → append.
    const current = itemsRef.current;
    for (let i = 0; i < current.length; i++) {
      const rect = rowRectsRef.current.get(current[i].id);
      if (!rect) continue;
      const mid = rect.y + rect.height / 2;
      if (centerY < mid) return i;
    }
    return current.length - 1;
  }, []);

  const handleLiftStart = useCallback((itemId: string, index: number) => {
    const rect = rowRectsRef.current.get(itemId);
    if (!rect) return;
    startIndexRef.current = index;
    startCenterYRef.current = rect.y + rect.height / 2;
    setLiftedId(itemId);
    setDropTargetIndex(index);
    setLiftedTranslateY(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const handlePanUpdate = useCallback(
    (translationY: number) => {
      setLiftedTranslateY(translationY);
      const fingerY = startCenterYRef.current + translationY;
      const idx = computeIndexFromY(fingerY);
      setDropTargetIndex((prev) => {
        if (prev !== idx) {
          Haptics.selectionAsync().catch(() => {});
        }
        return idx;
      });
    },
    [computeIndexFromY],
  );

  const handleDrop = useCallback(() => {
    const from = startIndexRef.current;
    setDropTargetIndex((to) => {
      const target = to ?? from;
      if (liftedId && from !== target && from >= 0 && target >= 0) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        onReorder(liftedId, from, target);
      }
      return null;
    });
    setLiftedId(null);
    setLiftedTranslateY(0);
    startIndexRef.current = -1;
  }, [liftedId, onReorder]);

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
          runOnJS(handlePanUpdate)(e.translationY);
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
    liftedTranslateY,
  };
}
