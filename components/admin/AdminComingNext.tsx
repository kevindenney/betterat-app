/**
 * AdminComingNext — placeholder content for admin drawers that exist
 * structurally but don't have a real surface yet. Replaces dead-clicks
 * with a designed "this is what will live here" card so the demo flow
 * never bounces into nothing.
 *
 * Each placeholder names the concrete promise so a dean walking through
 * sees clear roadmap intent, not vapor.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';

export interface AdminComingNextProps {
  crumbs: string[];
  title: string;
  pitch: string;
  bulletPromises: string[];
  icon: keyof typeof Ionicons.glyphMap;
}

export function AdminComingNext({
  crumbs,
  title,
  pitch,
  bulletPromises,
  icon,
}: AdminComingNextProps) {
  return (
    <>
      <StudioHeader
        crumbs={crumbs}
        title={title}
        subtitleParts={[
          <View key="comingSoon" style={s.eyebrowPill}>
            <Text style={s.eyebrowText}>Coming next</Text>
          </View>,
        ]}
      />
      <View style={s.body}>
        <View style={s.iconWrap}>
          <Ionicons name={icon} size={28} color="rgba(40, 64, 107, 0.6)" />
        </View>
        <Text style={s.pitch}>{pitch}</Text>
        <View style={s.bullets}>
          {bulletPromises.map((b, i) => (
            <View key={i} style={s.bulletRow}>
              <Ionicons name="checkmark-circle" size={14} color="#28406B" />
              <Text style={s.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
        <View style={s.actionsRow}>
          <StudioButton variant="ghost" icon="mail-outline" label="Request access" />
          <StudioButton
            variant="primary"
            accent="navy"
            icon="calendar-outline"
            label="See it on the roadmap"
          />
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  eyebrowPill: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
  },
  eyebrowText: { fontSize: 11, fontWeight: '600', color: '#28406B' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 56,
    paddingVertical: 32,
    gap: 16,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pitch: {
    fontSize: 17,
    color: '#1C1C1E',
    textAlign: 'center',
    lineHeight: 25,
    maxWidth: 540,
    fontWeight: '500',
  },
  bullets: { gap: 8, alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletText: { fontSize: 14, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 20 },
  actionsRow: { flexDirection: 'row', gap: 10 },
});
