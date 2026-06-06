/**
 * Atlas — iOS register preview
 *
 * The fifth lens. Practice is when. Library is kind. Discover is what's next.
 * Profile is who I am. Atlas is the missing fifth — where. Centered in the
 * tab order (supersedes "No fifth tab"); pins are steps, venues/sites/marks
 * are decorative layers.
 *
 * This preview route cycles the canonical frames from the design handoff:
 *   F1 Felix · first-run · Causeway Bay overview
 *   F2 Felix · race marks at zoom 14+
 *   F3 Felix · world Dragon (class lens, cross-fleet)
 *   F4 Emily · Baltimore cold (nursing, no JHU curation)
 *   F5 Emily · JHU curated (institution layer + competency overlay)
 *   F6 commit-mode (opened from Plan tab's Where field)
 *   F7 Ranchi didi entrepreneur Atlas
 *   F8 Ranchi mentor / org Atlas
 *
 * Wire-up status:
 *   Preview only — sample data drawn from the canonical handoff. F7 uses the
 *   live MapLibre canvas so the entrepreneur Atlas can be tested against real
 *   geography; older handoff frames keep static backdrops where intentionally
 *   mocked.
 *
 * Open at /atlas-ios.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { AtlasScreen, type AtlasFrameId } from '@/components/ios-register/atlas/AtlasScreen';

interface FramePickerItem {
  id: AtlasFrameId;
  label: string;
  sub: string;
}

const FRAMES: FramePickerItem[] = [
  { id: 'f1', label: 'F1', sub: 'Felix · overview' },
  { id: 'f2', label: 'F2', sub: 'Felix · race marks' },
  { id: 'f3', label: 'F3', sub: 'Felix · world' },
  { id: 'f4', label: 'F4', sub: 'Emily · cold' },
  { id: 'f5', label: 'F5', sub: 'Emily · curated' },
  { id: 'f6', label: 'F6', sub: 'commit-mode' },
  { id: 'f7', label: 'F7', sub: 'Ranchi · didi' },
  { id: 'f8', label: 'F8', sub: 'Ranchi · mentor' },
];

const VALID_FRAMES: AtlasFrameId[] = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];

export default function AtlasIosPreview() {
  // Allow deep-linking to a specific frame via ?frame=f4 — useful for
  // reviewer round-trips and for the screenshot-based dev loop.
  const params = useLocalSearchParams<{ frame?: string }>();
  const initial =
    params.frame && (VALID_FRAMES as string[]).includes(params.frame)
      ? (params.frame as AtlasFrameId)
      : 'f1';
  const [frame, setFrame] = useState<AtlasFrameId>(initial);
  const useRealMapPreview = frame === 'f7';
  const previewNextEvent =
    frame === 'f7'
      ? undefined
      : {
          label: 'Race 4',
          when: 'Sat 10am',
          where: 'Victoria Harbour, favoured end',
          conditions: '12kn ESE · ebb 0.4kn',
        };

  // Keep the in-memory frame in sync when the URL ?frame=... param changes
  // (e.g. arriving via a fresh deep-link while the screen is already mounted).
  useEffect(() => {
    if (params.frame && (VALID_FRAMES as string[]).includes(params.frame)) {
      setFrame(params.frame as AtlasFrameId);
    }
  }, [params.frame]);

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topChrome}>
        <View style={styles.leftPad} />
        <Pressable
          style={styles.glyphBtn}
          hitSlop={8}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/practice' as never);
          }}
          accessibilityLabel="Close iOS preview"
        >
          <Ionicons name="close" size={22} color={IOS_REGISTER.accentUserAction} />
        </Pressable>
      </View>

      <PreviewBanner />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.framePickerScroll}
        contentContainerStyle={styles.framePickerRow}
      >
        {FRAMES.map((item) => {
          const active = item.id === frame;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFrame(item.id)}
              style={[styles.framePickerChip, active && styles.framePickerChipActive]}
            >
              <Text style={[styles.framePickerLabel, active && styles.framePickerLabelActive]}>
                {item.label}
              </Text>
              <Text style={[styles.framePickerSub, active && styles.framePickerSubActive]}>
                {item.sub}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.phoneStage}>
        <View style={styles.phoneFrame}>
          <AtlasScreen
            frame={frame}
            useMapLibre={useRealMapPreview}
            // Preview keeps the canonical Race 4 fixture so the handoff
            // mockup matches the design exactly. The live tab passes real
            // next_event_resolver data (or null) — see (tabs)/atlas.tsx.
            nextEvent={previewNextEvent}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function PreviewBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons name="information-circle" size={14} color={IOS_REGISTER.labelSecondary} />
      <Text style={styles.bannerText}>
        Preview: canonical Atlas handoff frames with sample pins. F7 uses the
        live MapLibre canvas; older frames keep static backdrops when they are
        intentionally mocked.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftPad: { width: 22 },
  glyphBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
    letterSpacing: -0.05,
  },
  framePickerScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  framePickerRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    alignItems: 'flex-start',
  },
  framePickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    alignItems: 'center',
    minWidth: 64,
  },
  framePickerChipActive: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  framePickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  framePickerLabelActive: {
    color: '#FFFFFF',
  },
  framePickerSub: {
    marginTop: 1,
    fontSize: 9.5,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  framePickerSubActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  phoneStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  phoneFrame: {
    width: 360,
    maxWidth: '100%',
    height: '100%',
    maxHeight: 760,
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#0F172A',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});
