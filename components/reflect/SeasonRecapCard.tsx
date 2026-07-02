/**
 * SeasonRecapCard - Spotify Wrapped-style year in review
 *
 * Shows a comprehensive season summary with highlights,
 * top races, and year-over-year comparisons.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
  Modal,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SHADOWS } from '@/lib/design-tokens-ios';
import type { SeasonRecap, SeasonHighlight } from '@/hooks/useReflectProfile';

interface SeasonRecapCardProps {
  recap?: SeasonRecap;
  onShare?: () => void;
  onViewFullRecap?: () => void;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes}m`;
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getHighlightIcon(type: SeasonHighlight['type']): string {
  const icons: Record<SeasonHighlight['type'], string> = {
    best_race: 'trophy',
    longest_streak: 'flame',
    most_races_month: 'calendar',
    biggest_improvement: 'trending-up',
    new_venue: 'location',
    milestone: 'star',
  };
  return icons[type] || 'star';
}

function getHighlightColor(type: SeasonHighlight['type']): string {
  const colors: Record<SeasonHighlight['type'], string> = {
    best_race: IOS_COLORS.systemYellow,
    longest_streak: IOS_COLORS.systemOrange,
    most_races_month: IOS_COLORS.systemBlue,
    biggest_improvement: IOS_COLORS.systemGreen,
    new_venue: IOS_COLORS.systemPurple,
    milestone: IOS_COLORS.systemPink,
  };
  return colors[type] || IOS_COLORS.systemBlue;
}

function HighlightBadge({ highlight }: { highlight: SeasonHighlight }) {
  const color = getHighlightColor(highlight.type);
  const icon = getHighlightIcon(highlight.type);

  return (
    <View style={styles.highlightBadge}>
      <View style={[styles.highlightIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={styles.highlightContent}>
        <Text style={styles.highlightTitle}>{highlight.title}</Text>
        <Text style={[styles.highlightValue, { color }]}>{highlight.value}</Text>
        {highlight.detail && (
          <Text style={styles.highlightDetail}>{highlight.detail}</Text>
        )}
      </View>
    </View>
  );
}

function TopRaceRow({
  race,
  rank,
}: {
  race: SeasonRecap['topRaces'][0];
  rank: number;
}) {
  const medalColors = [IOS_COLORS.systemYellow, '#C0C0C0', '#CD7F32'];
  const medalColor = medalColors[rank - 1] || IOS_COLORS.secondaryLabel;

  return (
    <View style={styles.topRaceRow}>
      <View style={[styles.rankBadge, { backgroundColor: medalColor + '20' }]}>
        <Text style={[styles.rankNumber, { color: medalColor }]}>#{rank}</Text>
      </View>
      <View style={styles.topRaceInfo}>
        <Text style={styles.topRaceName} numberOfLines={1}>
          {race.name}
        </Text>
        <Text style={styles.topRaceMeta}>
          {race.venue} • {new Date(race.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>
      <View style={styles.topRaceResult}>
        <Text style={styles.topRacePosition}>
          {race.position === 1 ? '1st' : race.position === 2 ? '2nd' : race.position === 3 ? '3rd' : `${race.position}th`}
        </Text>
        <Text style={styles.topRaceFleet}>of {race.fleetSize}</Text>
      </View>
    </View>
  );
}

function ComparisonRow({
  label,
  currentValue,
  change,
  isLowerBetter = false,
}: {
  label: string;
  currentValue: string | number;
  change: number | null;
  isLowerBetter?: boolean;
}) {
  if (change === null) return null;

  const isPositive = isLowerBetter ? change < 0 : change > 0;
  const displayChange = isLowerBetter ? -change : change;
  const color = isPositive ? IOS_COLORS.systemGreen : IOS_COLORS.systemRed;

  return (
    <View style={styles.comparisonRow}>
      <Text style={styles.comparisonLabel}>{label}</Text>
      <View style={styles.comparisonValues}>
        <Text style={styles.comparisonCurrent}>{currentValue}</Text>
        {change !== 0 && (
          <View style={[styles.changeBadge, { backgroundColor: color + '15' }]}>
            <Ionicons
              name={displayChange > 0 ? 'arrow-up' : 'arrow-down'}
              size={10}
              color={color}
            />
            <Text style={[styles.changeText, { color }]}>
              {Math.abs(displayChange)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function FullRecapModal({
  recap,
  visible,
  onClose,
  onShare,
}: {
  recap: SeasonRecap | undefined;
  visible: boolean;
  onClose: () => void;
  onShare?: () => void;
}) {
  if (!recap) return null;

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }

    const shareText = `My ${recap.year} Sailing Season

${recap.totalRaces} races completed
${recap.totalWins} wins | ${recap.totalPodiums} podiums
${formatTime(recap.timeOnWater)} on the water
${recap.venuesVisited} venues raced

Top moment: ${recap.highlights[0]?.title} - ${recap.highlights[0]?.value}

#BetterAt #Sailing #YearInReview`;

    try {
      await Share.share({ message: shareText });
    } catch (error) {
      showAlert('Error', 'Could not share recap');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalYear}>{recap.year}</Text>
            <Text style={styles.modalTitle}>Year in Review</Text>
          </View>
          <View style={styles.modalActions}>
            {recap.isShareable && (
              <Pressable
                style={({ pressed }) => [
                  styles.shareModalButton,
                  pressed && styles.shareModalButtonPressed,
                ]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={20} color={IOS_COLORS.systemBlue} />
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color={IOS_COLORS.label} />
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Big Stats */}
          <View style={styles.bigStatsGrid}>
            <View style={styles.bigStat}>
              <Text style={styles.bigStatValue}>{recap.totalRaces}</Text>
              <Text style={styles.bigStatLabel}>Races</Text>
            </View>
            <View style={styles.bigStat}>
              <Text style={styles.bigStatValue}>{recap.totalWins}</Text>
              <Text style={styles.bigStatLabel}>Wins</Text>
            </View>
            <View style={styles.bigStat}>
              <Text style={styles.bigStatValue}>{recap.totalPodiums}</Text>
              <Text style={styles.bigStatLabel}>Podiums</Text>
            </View>
            <View style={styles.bigStat}>
              <Text style={styles.bigStatValue}>
                {formatTime(recap.timeOnWater)}
              </Text>
              <Text style={styles.bigStatLabel}>On Water</Text>
            </View>
          </View>

          {/* Highlights */}
          <Text style={styles.modalSectionTitle}>Season Highlights</Text>
          <View style={styles.highlightsGrid}>
            {recap.highlights.map((highlight, index) => (
              <HighlightBadge key={index} highlight={highlight} />
            ))}
          </View>

          {/* Top Races */}
          <Text style={styles.modalSectionTitle}>Top Races</Text>
          <View style={styles.topRacesList}>
            {recap.topRaces.map((race, index) => (
              <TopRaceRow key={index} race={race} rank={index + 1} />
            ))}
          </View>

          {/* Venues */}
          <View style={styles.venuesSection}>
            <View style={styles.venuesStat}>
              <Ionicons
                name="location"
                size={20}
                color={IOS_COLORS.systemPurple}
              />
              <Text style={styles.venuesStatValue}>
                {recap.venuesVisited} venues raced
              </Text>
            </View>
            {recap.newVenues.length > 0 && (
              <Text style={styles.newVenuesText}>
                New: {recap.newVenues.join(', ')}
              </Text>
            )}
          </View>

          {/* Year over Year */}
          {recap.comparedToPreviousYear && (
            <>
              <Text style={styles.modalSectionTitle}>
                vs {recap.year - 1}
              </Text>
              <View style={styles.comparisonsContainer}>
                <ComparisonRow
                  label="Races"
                  currentValue={recap.totalRaces}
                  change={recap.comparedToPreviousYear.races}
                />
                <ComparisonRow
                  label="Wins"
                  currentValue={recap.totalWins}
                  change={recap.comparedToPreviousYear.wins}
                />
                <ComparisonRow
                  label="Avg Finish"
                  currentValue={recap.averageFinish?.toFixed(1) || '-'}
                  change={recap.comparedToPreviousYear.avgFinish}
                  isLowerBetter
                />
              </View>
            </>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export function SeasonRecapCard({
  recap,
  onShare,
  onViewFullRecap,
}: SeasonRecapCardProps) {
  const [showFullRecap, setShowFullRecap] = useState(false);

  if (!recap) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>Season Recap</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons
            name="calendar-outline"
            size={40}
            color={IOS_COLORS.systemGray3}
          />
          <Text style={styles.emptyText}>No Season Data</Text>
          <Text style={styles.emptySubtext}>
            Complete races to see your season recap
          </Text>
        </View>
      </View>
    );
  }

  const handleViewFull = () => {
    setShowFullRecap(true);
    onViewFullRecap?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{recap.year} Season</Text>
        {recap.isShareable && (
          <Pressable
            style={({ pressed }) => [
              styles.shareButton,
              pressed && styles.shareButtonPressed,
            ]}
            onPress={onShare}
          >
            <Ionicons name="share-outline" size={18} color={IOS_COLORS.systemBlue} />
          </Pressable>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.recapCard,
          pressed && styles.recapCardPressed,
        ]}
        onPress={handleViewFull}
      >
        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Ionicons name="flag" size={16} color={IOS_COLORS.systemBlue} />
            <Text style={styles.quickStatValue}>{recap.totalRaces}</Text>
            <Text style={styles.quickStatLabel}>races</Text>
          </View>
          <View style={styles.quickStat}>
            <Ionicons name="trophy" size={16} color={IOS_COLORS.systemYellow} />
            <Text style={styles.quickStatValue}>{recap.totalWins}</Text>
            <Text style={styles.quickStatLabel}>wins</Text>
          </View>
          <View style={styles.quickStat}>
            <Ionicons name="medal" size={16} color={IOS_COLORS.systemOrange} />
            <Text style={styles.quickStatValue}>{recap.totalPodiums}</Text>
            <Text style={styles.quickStatLabel}>podiums</Text>
          </View>
          <View style={styles.quickStat}>
            <Ionicons name="time" size={16} color={IOS_COLORS.systemTeal} />
            <Text style={styles.quickStatValue}>
              {formatTime(recap.timeOnWater)}
            </Text>
            <Text style={styles.quickStatLabel}>sailing</Text>
          </View>
        </View>

        {/* Top Highlight */}
        {recap.highlights.length > 0 && (
          <View style={styles.topHighlight}>
            <HighlightBadge highlight={recap.highlights[0]} />
          </View>
        )}

        {/* View Full Button */}
        <View style={styles.viewFullRow}>
          <Text style={styles.viewFullText}>View Full Recap</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={IOS_COLORS.systemBlue}
          />
        </View>
      </Pressable>

      <FullRecapModal
        recap={recap}
        visible={showFullRecap}
        onClose={() => setShowFullRecap(false)}
        onShare={onShare}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonPressed: {
    opacity: 0.7,
  },
  recapCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
    ...IOS_SHADOWS.sm,
  },
  recapCardPressed: {
    opacity: 0.7,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  quickStatLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
  topHighlight: {
    marginBottom: 12,
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 10,
    padding: 10,
  },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightContent: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
  highlightValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  highlightDetail: {
    fontSize: 12,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
  },
  viewFullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  viewFullText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
  emptyState: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingTop: 20,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalYear: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  shareModalButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.systemBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalButtonPressed: {
    opacity: 0.7,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.systemGray5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  bigStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  bigStat: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  bigStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  bigStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  highlightsGrid: {
    gap: 8,
    marginBottom: 12,
  },
  topRacesList: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  topRaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  topRaceInfo: {
    flex: 1,
  },
  topRaceName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  topRaceMeta: {
    fontSize: 12,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
  },
  topRaceResult: {
    alignItems: 'flex-end',
  },
  topRacePosition: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.systemYellow,
  },
  topRaceFleet: {
    fontSize: 11,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
  },
  venuesSection: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  venuesStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  venuesStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  newVenuesText: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS_COLORS.systemPurple,
    marginTop: 6,
  },
  comparisonsContainer: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  comparisonLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  comparisonValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comparisonCurrent: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});

export default SeasonRecapCard;
