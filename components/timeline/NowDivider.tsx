import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * NowDivider — vertical dashed line + "NOW" pill marking the boundary
 * between Done (left) and Upcoming (right) in HorizontalTimeline.
 * Renders inline between cards.
 */
export function NowDivider() {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.line} />
      <View style={styles.pill}>
        <Text style={styles.pillText}>NOW</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    width: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#FF3B30',
    borderStyle: 'dashed',
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FF3B30',
    marginVertical: 4,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
});
