/**
 * SailorActivityCard
 *
 * Card component for displaying a sailor's race activity in the Watch feed.
 * Shows race name, date, venue, conditions, results, and activity type.
 * Supports tappable indicator pills that expand to show full content
 * (prep notes, tuning, lessons, debrief) via lazy-loaded enrichment data.
 * Supports comments on activity.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle, Lightbulb } from 'lucide-react-native';
import { IOS_COLORS, IOS_TYPOGRAPHY, IOS_SPACING, IOS_RADIUS } from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { useActivityCommentCount } from '@/hooks/useActivityComments';
import { useRaceEnrichment } from '@/hooks/useRaceEnrichment';
import { useAuth } from '@/providers/AuthProvider';
import { ActivityCommentSection } from './ActivityCommentSection';
import { SuggestionSubmitSheet } from '@/components/races/suggestions/SuggestionSubmitSheet';
import type { PublicRacePreview } from '@/services/CrewFinderService';
import type { ActivityType } from '@/services/ActivityCommentService';
import { getSafeImageUri } from '@/lib/utils/safeImageUri';

// =============================================================================
// TYPES
// =============================================================================

type ExpandedSection = 'prep' | 'tuning' | 'lessons' | 'debrief' | 'results' | null;

interface SailorActivityCardProps {
  race: PublicRacePreview;
  onSailorPress?: (userId: string) => void;
  /** Show comments section */
  showComments?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatWindInfo(race: PublicRacePreview): string | null {
  const { expectedWindSpeedMin, expectedWindSpeedMax, expectedWindDirection } = race;
  if (!expectedWindSpeedMin && !expectedWindSpeedMax) return null;

  const parts: string[] = [];
  if (expectedWindSpeedMin && expectedWindSpeedMax) {
    parts.push(`${expectedWindSpeedMin}-${expectedWindSpeedMax} kts`);
  } else if (expectedWindSpeedMax) {
    parts.push(`${expectedWindSpeedMax} kts`);
  } else if (expectedWindSpeedMin) {
    parts.push(`${expectedWindSpeedMin}+ kts`);
  }
  if (expectedWindDirection) {
    parts.push(expectedWindDirection);
  }
  return parts.join(' ');
}

const RACE_TYPE_LABELS: Record<string, string> = {
  fleet: 'Fleet',
  distance: 'Distance',
  match: 'Match',
  team: 'Team',
};

const PHASE_LABELS: Record<string, string> = {
  start: 'Start',
  upwind: 'Upwind',
  downwind: 'Downwind',
  mark_rounding: 'Marks',
  tactics: 'Tactics',
  boat_handling: 'Handling',
  boat_speed: 'Speed',
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/** Compact result badge for past races */
function ResultBadge({ position, fleetSize }: { position: number; fleetSize: number }) {
  const ratio = position / fleetSize;
  const badgeColor =
    position <= 3 ? IOS_COLORS.systemGreen :
    ratio <= 0.5 ? IOS_COLORS.systemBlue :
    IOS_COLORS.systemOrange;

  return (
    <View style={[resultStyles.badge, { backgroundColor: badgeColor + '18' }]}>
      <Text style={[resultStyles.position, { color: badgeColor }]}>
        {getOrdinal(position)}
      </Text>
      <Text style={[resultStyles.fleetSize, { color: badgeColor }]}>
        /{fleetSize}
      </Text>
    </View>
  );
}

/** Compact wind/conditions row */
function ConditionsRow({ race }: { race: PublicRacePreview }) {
  const windInfo = formatWindInfo(race);
  if (!windInfo && !race.expectedConditions) return null;

  return (
    <View style={conditionsStyles.row}>
      {windInfo && (
        <View style={conditionsStyles.chip}>
          <Ionicons name="flag-outline" size={11} color={IOS_COLORS.systemTeal} />
          <Text style={conditionsStyles.text}>{windInfo}</Text>
        </View>
      )}
      {race.expectedConditions && !windInfo && (
        <View style={conditionsStyles.chip}>
          <Ionicons name="partly-sunny-outline" size={11} color={IOS_COLORS.systemTeal} />
          <Text style={conditionsStyles.text} numberOfLines={1}>
            {race.expectedConditions}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Mini phase rating bars for debrief enrichment */
function PhaseRatingBars({ ratings }: { ratings: Record<string, number> }) {
  const entries = Object.entries(ratings).filter(([key]) => PHASE_LABELS[key]);
  if (entries.length === 0) return null;

  return (
    <View style={phaseStyles.container}>
      {entries.map(([key, value]) => {
        const pct = Math.min(Math.max((value / 5) * 100, 0), 100);
        const color =
          value >= 4 ? IOS_COLORS.systemGreen :
          value >= 3 ? IOS_COLORS.systemBlue :
          value >= 2 ? IOS_COLORS.systemOrange :
          IOS_COLORS.systemRed;
        return (
          <View key={key} style={phaseStyles.row}>
            <Text style={phaseStyles.label}>{PHASE_LABELS[key] || key}</Text>
            <View style={phaseStyles.barTrack}>
              <View style={[phaseStyles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={[phaseStyles.value, { color }]}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SailorActivityCard({
  race,
  onSailorPress,
  showComments = true,
}: SailorActivityCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [showSuggestSheet, setShowSuggestSheet] = useState(false);
  const safeAvatarUrl = getSafeImageUri(race.avatarUrl);

  // Only show suggest button on other people's races
  const isOwnRace = user?.id === race.userId;

  // Determine activity type for comments
  const activityType: ActivityType = race.isPast ? 'race_result' : 'race_entry';

  // Get comment count for badge
  const { count: commentCount } = useActivityCommentCount(activityType, race.id);

  // Lazy enrichment — only fetches when a section is expanded
  const {
    data: enrichment,
    isLoading: enrichmentLoading,
  } = useRaceEnrichment(race.id, expandedSection !== null);

  const handleRacePress = useCallback(() => {
    triggerHaptic('selection');
    router.push(`/sailor-journey/${race.userId}/${race.id}`);
  }, [router, race.id, race.userId]);

  const handleSailorPress = useCallback(() => {
    triggerHaptic('selection');
    if (onSailorPress) {
      onSailorPress(race.userId);
    } else {
      router.push(`/profile/${race.userId}`);
    }
  }, [onSailorPress, race.userId, router]);

  const handleToggleComments = useCallback(() => {
    triggerHaptic('selection');
    setCommentsExpanded((prev) => !prev);
  }, []);

  const handleSuggest = useCallback(() => {
    triggerHaptic('selection');
    setShowSuggestSheet(true);
  }, []);

  const handleToggleSection = useCallback((section: ExpandedSection) => {
    triggerHaptic('selection');
    setExpandedSection((prev) => (prev === section ? null : section));
  }, []);

  // Format the date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Format tuning settings for display
  const formatTuning = (tuning: Record<string, any> | null): string => {
    if (!tuning) return 'No tuning data';
    const entries = Object.entries(tuning);
    if (entries.length === 0) return 'No tuning data';
    return entries
      .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
      .join('\n');
  };

  // Activity type label
  const activityLabel = race.isPast ? 'Raced' : 'Racing';
  const activityIcon = race.isPast ? 'checkmark-circle' : 'time-outline';
  const raceTypeLabel = race.raceType ? RACE_TYPE_LABELS[race.raceType] : null;

  return (
    <View style={styles.cardContainer}>
      <Pressable onPress={handleRacePress} style={styles.card}>
        {/* Sailor Header */}
        <Pressable onPress={handleSailorPress} style={styles.sailorRow}>
          {safeAvatarUrl ? (
            <Image source={{ uri: safeAvatarUrl }} style={styles.avatarImage} />
          ) : (
            <View
              style={[
                styles.avatar,
                { backgroundColor: race.avatarColor || IOS_COLORS.systemGray5 },
              ]}
            >
              <Text style={styles.avatarEmoji}>{race.avatarEmoji || '⛵'}</Text>
            </View>
          )}
          <View style={styles.sailorInfo}>
            <Text style={styles.sailorName} numberOfLines={1}>
              {race.userName}
            </Text>
            <View style={styles.activityRow}>
              <Ionicons
                name={activityIcon as any}
                size={12}
                color={IOS_COLORS.secondaryLabel}
              />
              <Text style={styles.activityLabel}>
                {activityLabel} · {formatDate(race.startDate)}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Race Info */}
        <View style={styles.raceContent}>
          {/* Title row with optional result badge */}
          <View style={styles.titleRow}>
            <Text style={styles.raceName} numberOfLines={2}>
              {race.name}
            </Text>
            {race.isPast && enrichment?.position && enrichment?.fleetSize && (
              <ResultBadge position={enrichment.position} fleetSize={enrichment.fleetSize} />
            )}
          </View>

          {/* Venue + Race Type */}
          <View style={styles.metaRow}>
            {race.venue && (
              <View style={styles.venueRow}>
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={IOS_COLORS.tertiaryLabel}
                />
                <Text style={styles.venueText} numberOfLines={1}>
                  {race.venue}
                </Text>
              </View>
            )}
            {raceTypeLabel && (
              <View style={styles.raceTypeChip}>
                <Text style={styles.raceTypeText}>{raceTypeLabel}</Text>
              </View>
            )}
          </View>

          {/* Conditions row */}
          <ConditionsRow race={race} />

          {/* Content Indicators — tappable pills */}
          <View style={styles.indicatorsRow}>
            {race.boatClass && (
              <View style={styles.indicator}>
                <Ionicons name="boat-outline" size={12} color={IOS_COLORS.systemBlue} />
                <Text style={styles.indicatorText}>{race.boatClass}</Text>
              </View>
            )}
            {race.hasPrepNotes && (
              <Pressable
                onPress={() => handleToggleSection('prep')}
                style={[
                  styles.indicator,
                  styles.indicatorTappable,
                  expandedSection === 'prep' && styles.indicatorActive,
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={12}
                  color={expandedSection === 'prep' ? '#FFFFFF' : IOS_COLORS.systemGreen}
                />
                <Text
                  style={[
                    styles.indicatorText,
                    expandedSection === 'prep' && styles.indicatorTextActive,
                  ]}
                >
                  Prep Notes
                </Text>
              </Pressable>
            )}
            {race.hasTuning && (
              <Pressable
                onPress={() => handleToggleSection('tuning')}
                style={[
                  styles.indicator,
                  styles.indicatorTappable,
                  expandedSection === 'tuning' && styles.indicatorActive,
                ]}
              >
                <Ionicons
                  name="settings-outline"
                  size={12}
                  color={expandedSection === 'tuning' ? '#FFFFFF' : IOS_COLORS.systemOrange}
                />
                <Text
                  style={[
                    styles.indicatorText,
                    expandedSection === 'tuning' && styles.indicatorTextActive,
                  ]}
                >
                  Tuning
                </Text>
              </Pressable>
            )}
            {race.hasLessons && (
              <Pressable
                onPress={() => handleToggleSection('lessons')}
                style={[
                  styles.indicator,
                  styles.indicatorTappable,
                  expandedSection === 'lessons' && styles.indicatorActive,
                ]}
              >
                <Ionicons
                  name="bulb-outline"
                  size={12}
                  color={expandedSection === 'lessons' ? '#FFFFFF' : IOS_COLORS.systemPurple}
                />
                <Text
                  style={[
                    styles.indicatorText,
                    expandedSection === 'lessons' && styles.indicatorTextActive,
                  ]}
                >
                  Lessons
                </Text>
              </Pressable>
            )}
            {race.hasPostRaceNotes && (
              <Pressable
                onPress={() => handleToggleSection('debrief')}
                style={[
                  styles.indicator,
                  styles.indicatorTappable,
                  expandedSection === 'debrief' && styles.indicatorActive,
                ]}
              >
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={12}
                  color={expandedSection === 'debrief' ? '#FFFFFF' : IOS_COLORS.systemCyan}
                />
                <Text
                  style={[
                    styles.indicatorText,
                    expandedSection === 'debrief' && styles.indicatorTextActive,
                  ]}
                >
                  Debrief
                </Text>
              </Pressable>
            )}
            {race.isPast && (
              <Pressable
                onPress={() => handleToggleSection('results')}
                style={[
                  styles.indicator,
                  styles.indicatorTappable,
                  expandedSection === 'results' && styles.indicatorActive,
                ]}
              >
                <Ionicons
                  name="trophy-outline"
                  size={12}
                  color={expandedSection === 'results' ? '#FFFFFF' : IOS_COLORS.systemYellow}
                />
                <Text
                  style={[
                    styles.indicatorText,
                    expandedSection === 'results' && styles.indicatorTextActive,
                  ]}
                >
                  Results
                </Text>
              </Pressable>
            )}
          </View>

          {/* Action Row */}
          {showComments && (
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.commentButton,
                  pressed && styles.commentButtonPressed,
                ]}
                onPress={handleToggleComments}
              >
                <MessageCircle
                  size={16}
                  color={
                    commentsExpanded ? IOS_COLORS.systemBlue : IOS_COLORS.secondaryLabel
                  }
                />
                <Text
                  style={[
                    styles.commentButtonText,
                    commentsExpanded && styles.commentButtonTextActive,
                  ]}
                >
                  {commentCount > 0 ? commentCount : 'Comment'}
                </Text>
              </Pressable>
              {!isOwnRace && (
                <Pressable
                  style={({ pressed }) => [
                    styles.commentButton,
                    pressed && styles.commentButtonPressed,
                  ]}
                  onPress={handleSuggest}
                >
                  <Lightbulb size={16} color={IOS_COLORS.secondaryLabel} />
                  <Text style={styles.commentButtonText}>Suggest</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* View Chevron */}
        <View style={styles.chevronContainer}>
          <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
        </View>
      </Pressable>

      {/* Expanded Enrichment Section */}
      {expandedSection !== null && (
        <View style={styles.enrichmentContainer}>
          {enrichmentLoading ? (
            <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} style={styles.enrichmentLoader} />
          ) : (
            <>
              {expandedSection === 'prep' && (
                <View style={styles.enrichmentSection}>
                  <Text style={styles.enrichmentTitle}>Prep Notes</Text>
                  <Text style={styles.enrichmentContent}>
                    {enrichment?.prepNotes || 'No prep notes available'}
                  </Text>
                </View>
              )}
              {expandedSection === 'tuning' && (
                <View style={styles.enrichmentSection}>
                  <Text style={styles.enrichmentTitle}>Tuning Settings</Text>
                  <Text style={styles.enrichmentContent}>
                    {formatTuning(enrichment?.tuningSettings ?? null)}
                  </Text>
                </View>
              )}
              {expandedSection === 'lessons' && (
                <View style={styles.enrichmentSection}>
                  <Text style={styles.enrichmentTitle}>Lessons Learned</Text>
                  {enrichment?.lessonsLearned && enrichment.lessonsLearned.length > 0 ? (
                    enrichment.lessonsLearned.map((lesson, i) => (
                      <View key={i} style={styles.lessonItem}>
                        <Text style={styles.lessonBullet}>·</Text>
                        <Text style={styles.enrichmentContent}>{lesson}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.enrichmentContent}>No lessons recorded</Text>
                  )}
                </View>
              )}
              {expandedSection === 'debrief' && (
                <View style={styles.enrichmentSection}>
                  <Text style={styles.enrichmentTitle}>Post-Race Debrief</Text>
                  <Text style={styles.enrichmentContent}>
                    {enrichment?.postRaceNotes || 'No debrief notes available'}
                  </Text>
                  {enrichment?.phaseRatings && (
                    <View style={{ marginTop: IOS_SPACING.sm }}>
                      <Text style={[styles.enrichmentTitle, { marginBottom: 6 }]}>
                        Performance Ratings
                      </Text>
                      <PhaseRatingBars ratings={enrichment.phaseRatings} />
                    </View>
                  )}
                </View>
              )}
              {expandedSection === 'results' && (
                <View style={styles.enrichmentSection}>
                  <Text style={styles.enrichmentTitle}>Race Results</Text>
                  {enrichment?.position && enrichment?.fleetSize ? (
                    <View>
                      <View style={resultExpandedStyles.mainResult}>
                        <Text style={resultExpandedStyles.positionText}>
                          {getOrdinal(enrichment.position)}
                        </Text>
                        <Text style={resultExpandedStyles.ofText}>
                          of {enrichment.fleetSize} boats
                        </Text>
                      </View>
                      {/* Multi-race results */}
                      {enrichment.raceResults && enrichment.raceResults.length > 1 && (
                        <View style={resultExpandedStyles.multiRaceContainer}>
                          {enrichment.raceResults.map((r, i) => (
                            <View key={i} style={resultExpandedStyles.raceRow}>
                              <Text style={resultExpandedStyles.raceLabel}>
                                R{r.race_number}
                              </Text>
                              <Text style={resultExpandedStyles.racePosition}>
                                {getOrdinal(r.position)}/{r.fleet_size}
                              </Text>
                              {r.key_moment && (
                                <Text style={resultExpandedStyles.keyMoment} numberOfLines={1}>
                                  {r.key_moment}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.enrichmentContent}>No results recorded yet</Text>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Comments Section */}
      {showComments && commentsExpanded && (
        <View style={styles.commentsContainer}>
          <ActivityCommentSection
            activityType={activityType}
            activityId={race.id}
            targetUserId={race.userId}
            expanded={commentsExpanded}
            compact
          />
        </View>
      )}

      {/* Suggestion Submit Sheet */}
      <SuggestionSubmitSheet
        isOpen={showSuggestSheet}
        onClose={() => setShowSuggestSheet(false)}
        raceId={race.id}
        raceOwnerId={race.userId}
      />
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
  },
  card: {
    padding: IOS_SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sailorRow: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: IOS_SPACING.md,
    width: 56,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  sailorInfo: {
    marginTop: IOS_SPACING.xs,
    alignItems: 'center',
  },
  sailorName: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
    maxWidth: 56,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  activityLabel: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.secondaryLabel,
  },
  raceContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.xs,
  },
  raceName: {
    ...IOS_TYPOGRAPHY.body,
    fontWeight: '600',
    color: IOS_COLORS.label,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.sm,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  venueText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
    flex: 1,
  },
  raceTypeChip: {
    backgroundColor: IOS_COLORS.systemIndigo + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  raceTypeText: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.systemIndigo,
    fontWeight: '600',
  },
  indicatorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: IOS_RADIUS.sm,
  },
  indicatorTappable: {
    // Visual cue that pill is interactive
  },
  indicatorActive: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  indicatorText: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.secondaryLabel,
  },
  indicatorTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chevronContainer: {
    justifyContent: 'center',
    paddingLeft: IOS_SPACING.sm,
    alignSelf: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: IOS_SPACING.sm,
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: IOS_SPACING.xs,
    paddingHorizontal: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.sm,
  },
  commentButtonPressed: {
    opacity: 0.7,
  },
  commentButtonText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
  },
  commentButtonTextActive: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },

  // Enrichment expanded section
  enrichmentContainer: {
    paddingHorizontal: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.md,
    marginLeft: 72, // Align with race content (56 avatar + 16 padding)
  },
  enrichmentLoader: {
    paddingVertical: IOS_SPACING.md,
  },
  enrichmentSection: {
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
    padding: IOS_SPACING.md,
  },
  enrichmentTitle: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.xs,
  },
  enrichmentContent: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
    flex: 1,
  },
  lessonItem: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  lessonBullet: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },

  // Comments
  commentsContainer: {
    paddingLeft: IOS_SPACING.lg,
    paddingRight: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.md,
  },
});

const resultStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: IOS_RADIUS.sm,
  },
  position: {
    fontSize: 16,
    fontWeight: '700',
  },
  fleetSize: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
});

const conditionsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: IOS_SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: IOS_COLORS.systemTeal + '12',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  text: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.systemTeal,
    fontWeight: '500',
  },
});

const phaseStyles = StyleSheet.create({
  container: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.secondaryLabel,
    width: 52,
  },
  barTrack: {
    flex: 1,
    height: 4,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  value: {
    ...IOS_TYPOGRAPHY.caption2,
    fontWeight: '600',
    width: 16,
    textAlign: 'right',
  },
});

const resultExpandedStyles = StyleSheet.create({
  mainResult: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  positionText: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  ofText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
  },
  multiRaceContainer: {
    marginTop: IOS_SPACING.sm,
    gap: 4,
  },
  raceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  raceLabel: {
    ...IOS_TYPOGRAPHY.caption2,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    width: 24,
  },
  racePosition: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
    color: IOS_COLORS.label,
    width: 40,
  },
  keyMoment: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.secondaryLabel,
    flex: 1,
    fontStyle: 'italic',
  },
});

export default SailorActivityCard;
