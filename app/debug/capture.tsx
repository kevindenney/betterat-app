/**
 * /debug/capture — Wave 2f smoke route for CaptureSheet.
 * Opens the sheet immediately so we can verify it renders.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaptureSheet } from '@/components/library/resources/CaptureSheet';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

export default function CaptureDebugScreen() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(true);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>WAVE 2F · /debug/capture</Text>
        <Text style={styles.title}>Capture sheet smoke</Text>
        <Text style={styles.body}>
          The CaptureSheet should be open on first render. Close to dismiss,
          then tap below to re-open.
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setOpen(true)}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Open CaptureSheet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => router.back()}
          style={styles.linkBtn}
        >
          <Text style={styles.linkBtnText}>← Back</Text>
        </TouchableOpacity>
        <CaptureSheet visible={open} onClose={() => setOpen(false)} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  body: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 19,
  },
  btn: {
    marginTop: IOS_SPACING.md,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  linkBtn: {
    marginTop: IOS_SPACING.sm,
  },
  linkBtnText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
