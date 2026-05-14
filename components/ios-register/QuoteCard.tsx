/**
 * QuoteCard — white rounded-rect card holding a single user-content quote
 * with a circular source-glyph badge + sans-serif provenance line at the
 * foot. Replaces the editorial italic-serif-with-provenance pattern.
 *
 * The disambiguation work (voice vs note vs AI-tagged) lives on the
 * SourceGlyph variant — see ./SourceGlyph.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';
import { SourceGlyph, type SourceGlyphVariant } from './SourceGlyph';

interface Props {
  quote: string;
  provenance: string;
  source: SourceGlyphVariant;
}

export function QuoteCard({ quote, provenance, source }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.quote}>{`“${quote}”`}</Text>
      <View style={styles.metaRow}>
        <SourceGlyph variant={source} />
        <Text style={styles.prov}>{provenance}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    paddingTop: 16,
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
  quote: {
    ...IOS_REGISTER_TEXT.quote,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prov: {
    ...IOS_REGISTER_TEXT.quoteProv,
    color: IOS_REGISTER.labelSecondary,
  },
});
