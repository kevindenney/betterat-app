/**
 * PlanReview — Review/reflection component for the Plan Card "Review" phase.
 *
 * Structured reflection: What happened? What did I learn? What's next?
 * Includes optional AI summary display and rating.
 */

import React, { useCallback } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { MessageSquare, Lightbulb, ArrowRight, Star, Sparkles } from 'lucide-react-native';
import type { PlanReviewData } from '@/types/planCard';

const COLORS = {
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#C7C7CC',
  blue: '#007AFF',
  orange: '#FF9500',
  yellow: '#FFCC00',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  systemBackground: '#FFFFFF',
};

interface PlanReviewProps {
  data: PlanReviewData;
  onChange: (data: PlanReviewData) => void;
  readOnly?: boolean;
}

export function PlanReview({ data, onChange, readOnly = false }: PlanReviewProps) {
  const update = useCallback(
    (patch: Partial<PlanReviewData>) => onChange({ ...data, ...patch }),
    [data, onChange],
  );

  const setRating = useCallback(
    (rating: number) => {
      if (readOnly) return;
      update({ rating: data.rating === rating ? undefined : rating });
    },
    [data.rating, readOnly, update],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Rating */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>HOW DID IT GO?</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setRating(n)}
              activeOpacity={0.7}
              disabled={readOnly}
            >
              <Star
                size={28}
                color={COLORS.yellow}
                fill={(data.rating ?? 0) >= n ? COLORS.yellow : 'transparent'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* What Happened */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MessageSquare size={14} color={COLORS.secondaryLabel} />
          <Text style={styles.sectionLabel}>WHAT HAPPENED?</Text>
        </View>
        {readOnly ? (
          <Text style={styles.bodyText}>{data.whatHappened || '\u2014'}</Text>
        ) : (
          <TextInput
            style={[styles.input, styles.multiline]}
            value={data.whatHappened ?? ''}
            onChangeText={(t) => update({ whatHappened: t })}
            placeholder="Describe what happened during the activity..."
            placeholderTextColor={COLORS.tertiaryLabel}
            multiline
            textAlignVertical="top"
          />
        )}
      </View>

      {/* What I Learned */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Lightbulb size={14} color={COLORS.secondaryLabel} />
          <Text style={styles.sectionLabel}>WHAT DID I LEARN?</Text>
        </View>
        {readOnly ? (
          <Text style={styles.bodyText}>{data.whatLearned || '\u2014'}</Text>
        ) : (
          <TextInput
            style={[styles.input, styles.multiline]}
            value={data.whatLearned ?? ''}
            onChangeText={(t) => update({ whatLearned: t })}
            placeholder="Key insights, takeaways, or discoveries..."
            placeholderTextColor={COLORS.tertiaryLabel}
            multiline
            textAlignVertical="top"
          />
        )}
      </View>

      {/* What's Next */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ArrowRight size={14} color={COLORS.secondaryLabel} />
          <Text style={styles.sectionLabel}>WHAT'S NEXT?</Text>
        </View>
        {readOnly ? (
          <Text style={styles.bodyText}>{data.whatsNext || '\u2014'}</Text>
        ) : (
          <TextInput
            style={[styles.input, styles.multiline]}
            value={data.whatsNext ?? ''}
            onChangeText={(t) => update({ whatsNext: t })}
            placeholder="Next steps, follow-ups, or areas to explore..."
            placeholderTextColor={COLORS.tertiaryLabel}
            multiline
            textAlignVertical="top"
          />
        )}
      </View>

      {/* AI Summary */}
      {data.aiSummary && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={14} color={COLORS.orange} />
            <Text style={styles.sectionLabel}>SUMMARY</Text>
          </View>
          <View style={styles.aiSummaryCard}>
            <Text style={styles.aiSummaryText}>{data.aiSummary}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondaryLabel,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  input: {
    fontSize: 15,
    color: COLORS.label,
    padding: 12,
    backgroundColor: COLORS.gray6,
    borderRadius: 10,
  },
  multiline: { minHeight: 80, paddingTop: 12 },
  bodyText: { fontSize: 15, color: COLORS.label, lineHeight: 22, paddingHorizontal: 4 },
  aiSummaryCard: {
    padding: 14,
    backgroundColor: `${COLORS.orange}10`,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${COLORS.orange}25`,
  },
  aiSummaryText: {
    fontSize: 14,
    color: COLORS.label,
    lineHeight: 21,
  },
});

export default PlanReview;
