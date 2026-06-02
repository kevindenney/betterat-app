/**
 * WebDetailContainer — responsive reading column for the iOS-register detail
 * surfaces (Discover Person, Public face, and any future Org/Topic web page).
 *
 * The detail trio is authored as a single phone-width column (hero + grouped
 * sections). On a wide desktop browser that column stretches edge-to-edge and
 * the register reads as broken. This wrapper, on web at/above a breakpoint,
 * centres its children inside a constrained reading column so the same RN
 * primitives render unchanged but sit in a legible, app-like web layout.
 *
 * On native — or on a narrow (phone-width) web viewport — it is a no-op
 * passthrough, so the canonical phone experience is untouched.
 */

import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

/** Width at/above which web switches to the centred, constrained column. */
const WEB_BREAKPOINT = 700;
/** Reading-column max width — wide enough to breathe, narrow enough to read. */
const MAX_WIDTH = 680;

export function WebDetailContainer({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < WEB_BREAKPOINT) {
    return <>{children}</>;
  }
  return (
    <View style={styles.outer}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_WIDTH },
});
