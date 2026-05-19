import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ConceptTrailQuoteRecord } from '@/types/playbook';

export function TrailOfMoments({ quotes }: { quotes: ConceptTrailQuoteRecord[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eye}>Trail of moments</Text>
      {quotes.length === 0 ? (
        <Text style={styles.empty}>No captured quotes yet. Reflect confirmations will surface here.</Text>
      ) : (
        quotes.map((quote) => (
          <View key={quote.id} style={styles.quoteRow}>
            <Text style={styles.quote}>“{quote.quote_text}”</Text>
            <Text style={styles.meta}>{quote.source_label}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    padding: 14,
    gap: 10,
  },
  eye: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: '#3C3C43',
  },
  quoteRow: {
    gap: 6,
  },
  quote: {
    fontSize: 18,
    lineHeight: 27,
    color: '#1C1C1E',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  meta: {
    fontSize: 12,
    color: 'rgba(60,60,67,0.6)',
  },
  empty: {
    fontSize: 14,
    color: 'rgba(60,60,67,0.6)',
  },
});
