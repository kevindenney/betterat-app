/**
 * WeeklyReviewsPreview — shows the 2 most recent weekly reviews inline on
 * PlaybookHome, matching the mockup's treatment with week range, title (first
 * sentence of summary), body preview, and metadata.
 */

import React from 'react';
import { ActivityIndicator, View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { usePlaybookReviews } from '@/hooks/usePlaybook';

interface WeeklyReviewsPreviewProps {
  playbookId: string | undefined;
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

/** Extract first sentence as title, rest as body. */
function splitSummary(md: string): { title: string; body: string } {
  const dot = md.indexOf('.');
  if (dot > 0 && dot < 100) {
    return { title: md.slice(0, dot + 1), body: md.slice(dot + 1).trim() };
  }
  return { title: md.slice(0, 80) + (md.length > 80 ? '…' : ''), body: '' };
}

export function WeeklyReviewsPreview({ playbookId }: WeeklyReviewsPreviewProps) {
  const { data: reviews = [], isLoading } = usePlaybookReviews(playbookId);

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.heading}>Weekly reviews</Text>
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={IOS_COLORS.systemTeal} />
        </View>
      </View>
    );
  }

  if (reviews.length === 0) return null;

  const latest2 = reviews.slice(0, 2);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Weekly reviews</Text>
          <Text style={styles.subheading}>Every week, your Playbook compiles what you learned.</Text>
        </View>
        {reviews.length > 2 ? (
          <Pressable onPress={() => router.push('/library/reviews' as any)}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.grid}>
        {latest2.map((review, i) => {
          const { title, body } = splitSummary(review.summary_md);
          const isLatest = i === 0;
          return (
            <TouchableOpacity
              key={review.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push('/library/reviews' as any)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.weekLabel}>
                  {formatWeekRange(review.period_start, review.period_end)}
                </Text>
                {isLatest ? (
                  <View style={styles.latestBadge}>
                    <Text style={styles.latestBadgeText}>Latest</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
              {body ? (
                <Text style={styles.cardBody} numberOfLines={3}>{body}</Text>
              ) : null}
              <View style={styles.cardMeta}>
                {review.updated_pages?.length > 0 ? (
                  <Text style={styles.metaText}>
                    Updated {review.updated_pages.length} concept page{review.updated_pages.length !== 1 ? 's' : ''}
                  </Text>
                ) : null}
                {review.focus_suggestion_md ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>Focus suggested</Text>
                  </>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: IOS_SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  subheading: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemTeal,
  },
  grid: {
    flexDirection: 'row',
    gap: IOS_SPACING.md,
    flexWrap: 'wrap',
  },
  card: {
    flex: 1,
    minWidth: 260,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
  latestBadge: {
    backgroundColor: '#fff6e5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  latestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#8a5a00',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
    lineHeight: 22,
  },
  cardBody: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  metaDot: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    marginHorizontal: 4,
  },
});
