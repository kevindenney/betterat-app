/**
 * useScrollHideChrome — Safari-style "scroll down to hide the top bar".
 *
 * Returns a JS-thread scroll handler and a Reanimated animated style.
 * Attach the handler to any inner ScrollView (StepCard, FlatList, etc.)
 * and apply the style to the outer chrome row (AppChromeRow wrapper).
 * When the user scrolls down past the dead-zone the chrome translates
 * up and fades out; when they scroll back up it returns.
 *
 * Plain JS onScroll (throttled to 16ms by the consumer) is sufficient
 * for chrome hide/show — the animation runs on the UI thread via
 * Reanimated, so we don't need useAnimatedScrollHandler / a Reanimated
 * ScrollView wrapper.
 */

import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface UseScrollHideChromeOptions {
  /** Distance the chrome translates up when hidden. Defaults to 56. */
  hideDistance?: number;
  /** Px scrolled past the top before hide kicks in. Defaults to 24. */
  topDeadZone?: number;
  /** Px of downward scroll accumulation needed to trigger hide. Defaults to 8. */
  downAccumThreshold?: number;
}

export function useScrollHideChrome({
  hideDistance = 56,
  topDeadZone = 24,
  downAccumThreshold = 8,
}: UseScrollHideChromeOptions = {}) {
  // 0 = visible, 1 = hidden. Drives translateY + opacity on the chrome.
  const hidden = useSharedValue(0);
  const lastY = useRef(0);
  // Accumulator so a single tiny down-tick doesn't immediately hide; we
  // wait for a sustained downward intent.
  const downAccum = useRef(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      lastY.current = y;

      if (y < topDeadZone) {
        // Near the top — always show the chrome regardless of direction.
        downAccum.current = 0;
        hidden.value = withTiming(0, { duration: 180 });
        return;
      }

      if (dy > 0) {
        downAccum.current += dy;
        if (downAccum.current > downAccumThreshold) {
          hidden.value = withTiming(1, { duration: 200 });
        }
      } else if (dy < -2) {
        // Any meaningful upward gesture brings the chrome back.
        downAccum.current = 0;
        hidden.value = withTiming(0, { duration: 180 });
      }
    },
    [hidden, topDeadZone, downAccumThreshold],
  );

  const chromeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden.value * -hideDistance }],
    opacity: 1 - hidden.value * 0.5,
  }));

  return { onScroll, chromeAnimStyle };
}
