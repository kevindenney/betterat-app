/**
 * StudioLoading
 *
 * Shown while useProfileMenuData / useAuth haven't resolved yet, so the
 * Studio + Org Admin surfaces don't flash from "Independent" → institutional
 * (or vice-versa) on first paint. Renders the warm-cream stage + a centered
 * tiny indicator — the eventual shell snaps in once memberships + user load.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';

export function StudioLoading() {
  return (
    <View style={s.root}>
      <View style={s.center}>
        <ActivityIndicator size="small" color="#6B5BBF" />
        <Text style={s.label}>Loading studio…</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFEAD8',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
  center: { alignItems: 'center', gap: 10 },
  label: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.55)',
    fontWeight: '500',
    letterSpacing: -0.05,
  },
});
