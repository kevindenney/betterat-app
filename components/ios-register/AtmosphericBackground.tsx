/**
 * AtmosphericBackground — three-stop slate gradient ground used by the
 * On the Water capture surface. The "conditions become the surface"
 * principle from the design's side rail: the user is sailing in cool
 * slate-blue working light; the screen renders that working light.
 *
 * Cool slate at the top, warmer harbor mid-tone at the bottom. Scoped
 * to the On the Water surface only — never bleeds onto Race Prep or
 * Debrief, which both use system gray 6.
 */

import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ATM_TOP = '#4E6A85';
const ATM_MID = '#5A7488';
const ATM_BOT = '#7C7B6E';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function AtmosphericBackground({ children, style }: Props) {
  return (
    <LinearGradient
      colors={[ATM_TOP, ATM_MID, ATM_BOT]}
      locations={[0, 0.48, 1]}
      style={[styles.gradient, style]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
});
