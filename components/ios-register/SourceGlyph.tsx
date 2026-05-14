/**
 * SourceGlyph — 22px circular badge with an icon indicating the source of
 * a piece of user content. Replaces the editorial register's italic-serif-
 * with-provenance pattern.
 *
 *   variant="voice"  → microphone icon  (spoken reflection)
 *   variant="note"   → speech-bubble    (written reflection)
 *   variant="ai"     → light bulb       (AI-tagged phrase — deferred until
 *                                        data layer supports it; renders
 *                                        but not wired yet)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

export type SourceGlyphVariant = 'voice' | 'note' | 'ai';

const ICON_MAP: Record<SourceGlyphVariant, keyof typeof Ionicons.glyphMap> = {
  voice: 'mic',
  note: 'chatbubble-outline',
  ai: 'bulb-outline',
};

export function SourceGlyph({
  variant,
  size = 22,
}: {
  variant: SourceGlyphVariant;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Ionicons
        name={ICON_MAP[variant]}
        size={Math.round(size * 0.6)}
        color={IOS_REGISTER.accentUserAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
