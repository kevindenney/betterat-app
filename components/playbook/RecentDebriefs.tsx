/**
 * RecentDebriefs — enriched session log feed matching the Playbook mockup.
 * Shows date column, title, conditions chip, review excerpt, and crew/venue
 * metadata from timeline_steps.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import {
  usePlaybookRecentDebriefs,
  usePlaybookSuggestions,
} from '@/hooks/usePlaybook';
import type { PlaybookSuggestionRecord } from '@/types/playbook';

interface RecentDebriefsProps {
  interestId: string | undefined;
  playbookId: string | undefined;
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

function formatDay(iso: string): string {
  return new Date(iso).getDate().toString().padStart(2, '0');
}

/** Extract a short weather/conditions string from step metadata. */
function extractConditions(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const act = meta.act as Record<string, unknown> | undefined;
  const plan = meta.plan as Record<string, unknown> | undefined;

  // Try act (actual conditions) first, then plan
  const windSpeed = act?.wind_speed ?? plan?.wind_speed ?? act?.windSpeed ?? plan?.windSpeed;
  const seaState = act?.sea_state ?? plan?.sea_state ?? act?.seaState ?? plan?.seaState;
  const conditions = act?.conditions ?? plan?.conditions;

  const parts: string[] = [];
  if (windSpeed) parts.push(`${windSpeed} kn`);
  if (seaState) parts.push(String(seaState));
  if (parts.length === 0 && conditions) parts.push(String(conditions));

  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Extract a short review excerpt from step metadata. */
function extractReviewExcerpt(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const review = meta.review as Record<string, unknown> | undefined;
  if (!review) return null;

  // Common review fields
  const text =
    (review.what_i_learned as string) ??
    (review.what_went_well as string) ??
    (review.key_takeaway as string) ??
    (review.notes as string) ??
    (review.summary as string);

  if (!text || typeof text !== 'string') return null;
  return text.length > 120 ? text.slice(0, 120) + '…' : text;
}

/** Extract crew names from step metadata collaborators. */
function extractCrew(meta: Record<string, unknown> | null): string[] {
  if (!meta) return [];
  const plan = meta.plan as Record<string, unknown> | undefined;
  const collab = plan?.collaborators as { display_name?: string }[] | undefined;
  if (!Array.isArray(collab)) return [];
  return collab
    .map((c) => c.display_name ?? '')
    .filter(Boolean)
    .slice(0, 4);
}

/** Extract venue from step metadata. */
function extractVenue(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const plan = meta.plan as Record<string, unknown> | undefined;
  return (plan?.where as string) ?? (meta.venue_name as string) ?? null;
}

/** Collect step ids referenced by any suggestion's provenance. */
function extractCitedStepIds(suggestions: PlaybookSuggestionRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const s of suggestions) {
    const prov = s.provenance as Record<string, unknown> | null;
    if (!prov) continue;
    const stepIds = prov.step_ids;
    if (Array.isArray(stepIds)) {
      for (const id of stepIds) {
        if (typeof id === 'string') ids.add(id);
      }
    }
    const singleId = prov.step_id;
    if (typeof singleId === 'string') ids.add(singleId);
  }
  return ids;
}

export function RecentDebriefs({ interestId, playbookId }: RecentDebriefsProps) {
  const { data: debriefs = [] } = usePlaybookRecentDebriefs(interestId);
  const { data: suggestions = [] } = usePlaybookSuggestions(playbookId);

  const citedStepIds = useMemo(
    () => extractCitedStepIds(suggestions),
    [suggestions],
  );

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Recent sessions</Text>
          <Text style={styles.subheading}>The raw material your Playbook learns from.</Text>
        </View>
      </View>
      {debriefs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.empty}>
            When you write a reflection on a step, it shows up here and feeds the
            suggestions queue.
          </Text>
          <Pressable
            style={styles.emptyAction}
            onPress={() => router.push('/(tabs)/races' as any)}
          >
            <Text style={styles.emptyActionText}>Go to Timeline</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          {debriefs.map((d, i) => {
            const wasRead = citedStepIds.has(d.id);
            const dateStr = d.step_date ?? d.created_at;
            const conditions = extractConditions(d.metadata);
            const excerpt = extractReviewExcerpt(d.metadata);
            const crew = extractCrew(d.metadata);
            const venue = extractVenue(d.metadata);

            return (
              <Pressable
                key={d.id}
                onPress={() => router.push(`/step/${d.id}` as any)}
                style={({ pressed }) => [
                  styles.item,
                  i > 0 && styles.itemBorder,
                  pressed && styles.itemPressed,
                ]}
              >
                {/* Date column */}
                <View style={styles.dateCol}>
                  <Text style={styles.dateMonth}>{formatMonth(dateStr)}</Text>
                  <Text style={styles.dateDay}>{formatDay(dateStr)}</Text>
                </View>

                {/* Content */}
                <View style={styles.itemBody}>
                  <View style={styles.titleRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {d.title ?? 'Untitled step'}
                    </Text>
                    {conditions ? (
                      <View style={styles.conditionsChip}>
                        <Text style={styles.conditionsText}>{conditions}</Text>
                      </View>
                    ) : null}
                  </View>

                  {excerpt ? (
                    <Text style={styles.excerpt} numberOfLines={2}>{excerpt}</Text>
                  ) : null}

                  <View style={styles.metaRow}>
                    {venue ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="location-outline" size={11} color={IOS_COLORS.tertiaryLabel} />
                        <Text style={styles.metaText}>{venue}</Text>
                      </View>
                    ) : null}
                    {crew.length > 0 ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={11} color={IOS_COLORS.tertiaryLabel} />
                        <Text style={styles.metaText}>{crew.join(' · ')}</Text>
                      </View>
                    ) : null}
                    {wasRead ? (
                      <View style={styles.aiTag}>
                        <Ionicons name="sparkles" size={10} color={IOS_COLORS.systemPurple} />
                        <Text style={styles.aiTagText}>Read</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
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
  card: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    overflow: 'hidden',
  },
  emptyCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
  },
  empty: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  emptyAction: {
    marginTop: IOS_SPACING.md,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 8,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  item: {
    flexDirection: 'row',
    gap: IOS_SPACING.md,
    padding: IOS_SPACING.lg,
  },
  itemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  itemPressed: {
    opacity: 0.6,
  },
  dateCol: {
    width: 44,
    alignItems: 'center',
    flexShrink: 0,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
  dateDay: {
    fontSize: 26,
    fontWeight: '700',
    color: IOS_COLORS.label,
    lineHeight: 30,
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
    flexShrink: 1,
  },
  conditionsChip: {
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  conditionsText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
  excerpt: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(175, 82, 222, 0.12)',
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: IOS_COLORS.systemPurple,
  },
});
