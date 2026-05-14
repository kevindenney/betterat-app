/**
 * ReflectionCard — Playbook "Recent reflections" row.
 *
 * White rounded-rect with ALL-CAPS "when" eyebrow (e.g. "Sunday morning ·
 * 2 hr ago"), 17pt first-line of the reflection (italic if voice-sourced
 * per iOS Notes / Messages convention), and a small SourceGlyph + 13pt
 * provenance row at the foot.
 *
 * Reuses the SourceGlyph variant grammar from the Race Prep quote stack.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';
import { SourceGlyph, type SourceGlyphVariant } from './SourceGlyph';

interface Props {
  /** Eyebrow row segments — joined with bullets, e.g. ["Sunday morning", "2 hr ago"]. */
  whenParts: string[];
  firstLine: string;
  source: SourceGlyphVariant;
  provenance: string;
  /** When true, render firstLine in italic per iOS Notes/Messages convention.
   *  Defaults to true for voice source, false for note/ai. */
  italic?: boolean;
  onPress?: () => void;
}

export function ReflectionCard({
  whenParts,
  firstLine,
  source,
  provenance,
  italic,
  onPress,
}: Props) {
  const renderItalic = italic ?? source === 'voice';

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.whenRow}>
        {whenParts.map((part, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <View style={styles.sep} />}
            <Text style={styles.when}>{part}</Text>
          </React.Fragment>
        ))}
      </View>
      <Text style={[styles.firstLine, renderItalic && styles.firstLineItalic]}>
        {source === 'voice' ? `“${firstLine}”` : firstLine}
      </Text>
      <View style={styles.provRow}>
        <SourceGlyph variant={source} size={20} />
        <Text style={styles.prov}>{provenance}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 14,
    paddingLeft: 16,
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  when: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IOS_REGISTER.labelTertiary,
  },
  firstLine: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.label,
    marginBottom: 10,
  },
  firstLineItalic: {
    fontStyle: 'italic',
  },
  provRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prov: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
    flex: 1,
  },
});
