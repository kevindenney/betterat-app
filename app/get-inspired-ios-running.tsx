/**
 * Get Inspired — iOS register · running state preview route
 *
 * Thin preview wrapper around the canonical
 * `components/ios-register/GetInspiredRunningScreen` kit component. The
 * kit handles all of the visual structure; this route adds:
 *
 *   - Modal stack-screen presentation chrome (router-only concern)
 *   - Fixture URL so reviewers see realistic content without the
 *     production pipeline
 *   - Auto-cycling activeIndex so the line replacement motion is visible
 *
 * Production code MUST NOT import this route file. It imports the kit
 * component directly. See CUTOVER_PATTERN.md → "do not import preview
 * components into production."
 *
 * Open at /get-inspired-ios-running.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  GetInspiredRunningScreen,
  GET_INSPIRED_NARRATION_LINES,
  GET_INSPIRED_STAGE_DURATIONS_MS,
} from '@/components/ios-register';

const FIXTURE_URL = 'sailingworld.com/heavy-air-starts-andrew-campbell';
const FIXTURE_ESTIMATE = 'About 8 seconds left. You can leave this open.';

export default function GetInspiredIosRunningPreview() {
  // Preview-mode auto-advance — cycles the active index so reviewers can
  // see the line replacement motion without wiring the real pipeline.
  // Lives in the route, not the kit, because auto-cycling is a preview-
  // only concern (production drives the index from real pipeline events).
  const [previewIndex, setPreviewIndex] = useState(2);
  useEffect(() => {
    const duration =
      GET_INSPIRED_STAGE_DURATIONS_MS[previewIndex] ?? 1800;
    const handle = setTimeout(() => {
      setPreviewIndex((i) => (i + 1) % GET_INSPIRED_NARRATION_LINES.length);
    }, duration);
    return () => clearTimeout(handle);
  }, [previewIndex]);

  return (
    <View style={styles.modal}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <GetInspiredRunningScreen
        submittedUrl={FIXTURE_URL}
        estimateLabel={FIXTURE_ESTIMATE}
        activeIndex={previewIndex}
        onStop={() => {
          if (router.canGoBack()) router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
});

// Keep IOS_COLORS referenced — preserves a future hook for raw HIG tokens
// without re-importing if a variant lands.
void IOS_COLORS;
