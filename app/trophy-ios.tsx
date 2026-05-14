/**
 * Trophy of Becoming — iOS register preview
 *
 * Ninth iOS-register preview surface. Path-completion synthesis artifact.
 * Six elements on the surface; four typographic, one 60×1px line, one
 * floating nav. The whole composition vertically centered.
 *
 * Architectural commitments (from the design's side rail):
 *   - Italic 32px title — the only iOS register that breaks upright.
 *     Licensed because the title is literal user speech, not chrome.
 *   - Full-bleed #FAFAFA (half-step warmer than system gray 6 — Apple
 *     Books book-detail trick). If you can name the color shift
 *     consciously, it's gone too far.
 *   - Trophy doesn't scroll. What you see is the whole surface.
 *   - The coral rule is the entire ornamental vocabulary. 60px wide,
 *     1px tall. Not a divider; a margin pencil mark.
 *
 * Wire-up status:
 *   - Title text + attribution + capability label + context line are
 *     placeholder. Real Trophy data depends on a completed-path
 *     synthesis service that doesn't exist yet — it would extract one
 *     standout sentence from path-completion reflections + map to the
 *     completed capability + the path metadata.
 *
 * Open at /trophy-ios.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';

const TROPHY_BG = '#FAFAFA';

export default function TrophyIosPreview() {
  return (
    <View style={[styles.page, { backgroundColor: TROPHY_BG }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topChrome}>
          <View style={styles.leftPad} />
          <Pressable
            style={styles.glyphBtn}
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : null)}
            accessibilityLabel="Close iOS preview"
          >
            <Ionicons
              name="close"
              size={22}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
        </View>

        {/* Composition — vertically centered with slight upward bias */}
        <View style={styles.composition}>
          <Text style={styles.title}>
            “I can read the shift now before I have to commit.”
          </Text>
          <Text style={styles.attribution}>
            From your Race 4 Debrief · Sunday, March 23
          </Text>
          <View style={styles.coralRule} />
          <Text style={styles.capability}>Heavy-air helm work</Text>
          <View style={styles.contextRow}>
            <Text style={styles.context}>Week 7 of 12</Text>
            <View style={styles.contextSep} />
            <Text style={styles.context}>Spring Series</Text>
            <View style={styles.contextSep} />
            <Text style={styles.context}>RHKYC</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  leftPad: { width: 1 },
  glyphBtn: { padding: 6 },
  composition: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    transform: [{ translateY: -22 }],
  },
  title: {
    fontSize: 32,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 40,
    letterSpacing: -0.5,
    color: IOS_REGISTER.label,
    textAlign: 'center',
    marginBottom: 24,
  },
  attribution: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    letterSpacing: -0.1,
    marginBottom: 36,
  },
  coralRule: {
    width: 60,
    height: 1,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
    marginBottom: 36,
  },
  capability: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  context: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  contextSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
});
