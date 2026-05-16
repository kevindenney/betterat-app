/**
 * Season Picker Modal
 *
 * Simple picker for selecting which season to filter races by.
 * Shows:
 * - "All Races" option (no filter)
 * - Current active season (highlighted)
 * - Recent/past seasons
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { IOS_COLORS, TUFTE_BACKGROUND } from '@/components/cards/constants';
import type { SeasonWithSummary, SeasonListItem } from '@/types/season';

// =============================================================================
// TYPES
// =============================================================================

export interface SeasonPickerModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Currently selected season ID (null = All Races) */
  selectedSeasonId: string | null;
  /** Current active season */
  currentSeason: SeasonWithSummary | null;
  /** All user seasons */
  allSeasons: SeasonListItem[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when a season is selected */
  onSelectSeason: (seasonId: string | null) => void;
  /** Callback to open season settings (create/edit) */
  onManageSeasons: () => void;
  /** Vocabulary-aware event noun plural (e.g., "Shifts", "Workouts") */
  eventNounPlural?: string;
  /** Vocabulary-aware period term (e.g., "Season", "Rotation", "Training Block") */
  periodTerm?: string;
  /**
   * When true, render the canonical Phase I action-sheet layout
   * (docs/redesign/ios-register/series-feature-canonical.html Frame 2).
   * When false (default), keep the existing legacy picker layout.
   */
  useCanonicalLayout?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SeasonPickerModal({
  visible,
  selectedSeasonId,
  currentSeason,
  allSeasons,
  isLoading,
  onClose,
  onSelectSeason,
  onManageSeasons,
  eventNounPlural,
  periodTerm,
  useCanonicalLayout,
}: SeasonPickerModalProps) {
  const eventsLabel = eventNounPlural?.toLowerCase() || 'races';
  const periodLabel = periodTerm || 'Season';
  const periodLabelLower = periodLabel.toLowerCase();
  const periodLabelUpper = periodLabel.toUpperCase() + 'S';

  const handleSelectSeason = (seasonId: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectSeason(seasonId);
    onClose();
  };

  const handleManageSeasons = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    // Small delay to allow modal to close before opening settings
    setTimeout(() => {
      onManageSeasons();
    }, 100);
  };

  // Filter out archived seasons for cleaner list, keep active/completed
  const displaySeasons = allSeasons.filter(s => s.status !== 'archived');

  if (useCanonicalLayout) {
    return (
      <CanonicalSheet
        visible={visible}
        selectedSeasonId={selectedSeasonId}
        currentSeason={currentSeason}
        allSeasons={allSeasons}
        isLoading={isLoading}
        onClose={onClose}
        onSelectSeason={handleSelectSeason}
        onManageSeasons={handleManageSeasons}
        periodLabel={periodLabel}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Select {periodLabel}</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={IOS_COLORS.secondaryLabel}
                />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* All Races Option */}
              <TouchableOpacity
                style={[
                  styles.option,
                  selectedSeasonId === null && styles.optionSelected,
                ]}
                onPress={() => handleSelectSeason(null)}
              >
                <View style={styles.optionIconContainer}>
                  <MaterialCommunityIcons
                    name="calendar-multiple"
                    size={22}
                    color={selectedSeasonId === null ? IOS_COLORS.blue : IOS_COLORS.secondaryLabel}
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    selectedSeasonId === null && styles.optionTitleSelected,
                  ]}>
                    All {eventNounPlural || 'Races'}
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    Show {eventsLabel} from all {periodLabelLower}s
                  </Text>
                </View>
                {selectedSeasonId === null && (
                  <MaterialCommunityIcons
                    name="check"
                    size={22}
                    color={IOS_COLORS.blue}
                  />
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <Text style={styles.dividerText}>{periodLabelUpper}</Text>
              </View>

              {/* Current Active Season (if exists) */}
              {currentSeason && (
                <TouchableOpacity
                  style={[
                    styles.option,
                    selectedSeasonId === currentSeason.id && styles.optionSelected,
                  ]}
                  onPress={() => handleSelectSeason(currentSeason.id)}
                >
                  <View style={[styles.optionIconContainer, styles.activeSeasonIcon]}>
                    <MaterialCommunityIcons
                      name="flag"
                      size={22}
                      color={IOS_COLORS.green}
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <View style={styles.optionTitleRow}>
                      <Text style={[
                        styles.optionTitle,
                        selectedSeasonId === currentSeason.id && styles.optionTitleSelected,
                      ]}>
                        {currentSeason.name}
                      </Text>
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    </View>
                    <Text style={styles.optionSubtitle}>
                      {currentSeason.summary.completed_races} of {currentSeason.summary.total_races} completed
                    </Text>
                  </View>
                  {selectedSeasonId === currentSeason.id && (
                    <MaterialCommunityIcons
                      name="check"
                      size={22}
                      color={IOS_COLORS.blue}
                    />
                  )}
                </TouchableOpacity>
              )}

              {/* Other Seasons */}
              {displaySeasons
                .filter(s => s.id !== currentSeason?.id)
                .map((season) => (
                  <TouchableOpacity
                    key={season.id}
                    style={[
                      styles.option,
                      selectedSeasonId === season.id && styles.optionSelected,
                    ]}
                    onPress={() => handleSelectSeason(season.id)}
                  >
                    <View style={styles.optionIconContainer}>
                      <MaterialCommunityIcons
                        name={season.status === 'completed' ? 'flag-checkered' : 'calendar'}
                        size={22}
                        color={selectedSeasonId === season.id ? IOS_COLORS.blue : IOS_COLORS.secondaryLabel}
                      />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[
                        styles.optionTitle,
                        selectedSeasonId === season.id && styles.optionTitleSelected,
                      ]}>
                        {season.name}
                      </Text>
                      <Text style={styles.optionSubtitle}>
                        {season.completed_count} of {season.race_count} completed
                        {season.status === 'completed' && ' • Ended'}
                      </Text>
                    </View>
                    {selectedSeasonId === season.id && (
                      <MaterialCommunityIcons
                        name="check"
                        size={22}
                        color={IOS_COLORS.blue}
                      />
                    )}
                  </TouchableOpacity>
                ))}

              {/* No seasons message */}
              {!currentSeason && displaySeasons.length === 0 && (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name="calendar-blank"
                    size={32}
                    color={IOS_COLORS.tertiaryLabel}
                  />
                  <Text style={styles.emptyStateText}>
                    No {periodLabelLower}s yet
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    Create a {periodLabelLower} to organize your {eventsLabel}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer - Manage Seasons */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.manageButton}
                onPress={handleManageSeasons}
              >
                <MaterialCommunityIcons
                  name="cog"
                  size={18}
                  color={IOS_COLORS.blue}
                />
                <Text style={styles.manageButtonText}>
                  {currentSeason ? `Manage ${periodLabel}` : `Create ${periodLabel}`}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// CANONICAL (Phase I Frame 2) — iOS-native action sheet treatment
// =============================================================================

type SeasonRowKind = 'active' | 'past' | 'upcoming';

type GroupedSeasons = {
  active: SeasonWithSummary | null;
  past: SeasonListItem[];
  upcoming: SeasonListItem[];
};

function partitionSeasons(
  currentSeason: SeasonWithSummary | null,
  allSeasons: SeasonListItem[],
): GroupedSeasons {
  const now = Date.now();
  const active = currentSeason;
  const activeId = currentSeason?.id;
  const past: SeasonListItem[] = [];
  const upcoming: SeasonListItem[] = [];

  for (const season of allSeasons) {
    if (activeId && season.id === activeId) continue;
    if (season.status === 'upcoming' || season.status === 'draft') {
      upcoming.push(season);
      continue;
    }
    if (season.status === 'completed' || season.status === 'archived') {
      past.push(season);
      continue;
    }
    // status === 'active' but not the currentSeason (rare) — fall back to date math.
    const start = season.start_date ? Date.parse(season.start_date) : NaN;
    const end = season.end_date ? Date.parse(season.end_date) : NaN;
    if (!Number.isNaN(end) && end < now) past.push(season);
    else if (!Number.isNaN(start) && start > now) upcoming.push(season);
    else past.push(season);
  }

  return { active, past, upcoming };
}

function formatDateRange(startISO?: string | null, endISO?: string | null): string | null {
  if (!startISO || !endISO) return null;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString(undefined, opts);
  const sameYear = start.getFullYear() === end.getFullYear();
  const endStr = sameYear
    ? `${end.toLocaleDateString(undefined, opts)}, ${end.getFullYear()}`
    : end.toLocaleDateString(undefined, { ...opts, year: 'numeric' });
  return sameYear ? `${startStr} – ${endStr}` : `${startStr}, ${start.getFullYear()} – ${endStr}`;
}

function pillStateFor(kind: SeasonRowKind, status?: string): { label: string; style: any } {
  if (kind === 'active') {
    return { label: 'Active', style: canonicalStyles.pillActive };
  }
  if (kind === 'past') {
    const isArchived = status === 'archived';
    return {
      label: isArchived ? 'Archived' : 'Completed',
      style: isArchived ? canonicalStyles.pillArchived : canonicalStyles.pillPast,
    };
  }
  return { label: 'Planning', style: canonicalStyles.pillPlanning };
}

interface CanonicalSheetProps {
  visible: boolean;
  selectedSeasonId: string | null;
  currentSeason: SeasonWithSummary | null;
  allSeasons: SeasonListItem[];
  isLoading?: boolean;
  onClose: () => void;
  onSelectSeason: (seasonId: string | null) => void;
  onManageSeasons: () => void;
  periodLabel: string;
}

function CanonicalSheet({
  visible,
  selectedSeasonId: _selectedSeasonId,
  currentSeason,
  allSeasons,
  onClose,
  onSelectSeason,
  onManageSeasons,
  periodLabel,
}: CanonicalSheetProps) {
  const groups = partitionSeasons(currentSeason, allSeasons);
  const title = `Switch ${periodLabel.toLowerCase()}`;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={canonicalStyles.scrim} onPress={onClose}>
        <SafeAreaView edges={['bottom']} style={canonicalStyles.safeArea}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={canonicalStyles.sheet}
          >
            <View style={canonicalStyles.card}>
              <Text style={canonicalStyles.title}>{title}</Text>

              {groups.active && (
                <CanonicalRow
                  kind="active"
                  name={groups.active.name}
                  subline={formatDateRange(groups.active.start_date, groups.active.end_date)}
                  progressText={`${groups.active.summary.completed_races} of ${groups.active.summary.total_races}`}
                  isFirstInSection
                  showCheck
                  onPress={() => onSelectSeason(groups.active!.id)}
                />
              )}

              {groups.past.length > 0 && (
                <View style={canonicalStyles.sectionHead}>
                  <Text style={canonicalStyles.sectionHeadText}>
                    Past {periodLabel.toLowerCase()}s
                  </Text>
                </View>
              )}
              {groups.past.map((season, idx) => (
                <CanonicalRow
                  key={season.id}
                  kind="past"
                  status={season.status}
                  name={season.name}
                  subline={formatDateRange(season.start_date, season.end_date)}
                  progressText={`${season.completed_count} of ${season.race_count}`}
                  isFirstInSection={idx === 0}
                  onPress={() => onSelectSeason(season.id)}
                />
              ))}

              {groups.upcoming.length > 0 && (
                <View style={canonicalStyles.sectionHead}>
                  <Text style={canonicalStyles.sectionHeadText}>
                    Upcoming {periodLabel.toLowerCase()}s
                  </Text>
                </View>
              )}
              {groups.upcoming.map((season, idx) => (
                <CanonicalRow
                  key={season.id}
                  kind="upcoming"
                  name={season.name}
                  subline={formatDateRange(season.start_date, season.end_date)}
                  progressText={`${season.completed_count} of ${season.race_count}`}
                  isFirstInSection={idx === 0}
                  onPress={() => onSelectSeason(season.id)}
                />
              ))}
            </View>

            <View style={canonicalStyles.card}>
              <CanonicalActionRow
                icon="sparkles"
                label={`Create new ${periodLabel.toLowerCase()}`}
                onPress={onManageSeasons}
                isFirstInSection
              />
              <CanonicalActionRow
                icon="settings-sharp"
                label={`Manage ${periodLabel.toLowerCase()}s`}
                onPress={onManageSeasons}
              />
            </View>

            <Pressable
              onPress={onClose}
              style={canonicalStyles.cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              testID="series-picker-cancel"
            >
              <Text style={canonicalStyles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

interface CanonicalRowProps {
  kind: SeasonRowKind;
  status?: string;
  name: string;
  subline: string | null;
  progressText: string;
  isFirstInSection?: boolean;
  showCheck?: boolean;
  onPress: () => void;
}

function CanonicalRow({
  kind,
  status,
  name,
  subline,
  progressText,
  isFirstInSection,
  showCheck,
  onPress,
}: CanonicalRowProps) {
  const pill = pillStateFor(kind, status);
  const glyphStyle =
    kind === 'active'
      ? canonicalStyles.glyphActive
      : kind === 'past'
        ? canonicalStyles.glyphPast
        : canonicalStyles.glyphUpcoming;
  const trophyColor = kind === 'active' ? '#8A5A00' : kind === 'past' ? '#6B5F3A' : '#8E8E93';

  return (
    <Pressable
      onPress={onPress}
      style={[canonicalStyles.row, !isFirstInSection && canonicalStyles.rowDivider]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${pill.label}`}
      testID={`series-picker-row-${kind}`}
    >
      <View style={[canonicalStyles.glyph, glyphStyle]}>
        <Ionicons name="trophy" size={16} color={trophyColor} />
      </View>
      <View style={canonicalStyles.rowText}>
        <Text
          style={[canonicalStyles.rowName, kind !== 'active' && canonicalStyles.rowNameMuted]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={canonicalStyles.rowSubRow}>
          <Text style={canonicalStyles.rowSub} numberOfLines={1}>
            {subline ? `${subline} · ` : ''}
            {progressText}
          </Text>
          <View style={[canonicalStyles.pill, pill.style]}>
            <Text style={[canonicalStyles.pillText, kind === 'active' && canonicalStyles.pillTextActive]}>
              {pill.label.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      {showCheck ? (
        <Ionicons name="checkmark" size={18} color={IOS_COLORS.blue} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      )}
    </Pressable>
  );
}

interface CanonicalActionRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  isFirstInSection?: boolean;
}

function CanonicalActionRow({ icon, label, onPress, isFirstInSection }: CanonicalActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[canonicalStyles.row, !isFirstInSection && canonicalStyles.rowDivider]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`series-picker-action-${String(icon)}`}
    >
      <View style={[canonicalStyles.glyph, canonicalStyles.glyphAction]}>
        <Ionicons name={icon} size={16} color={IOS_COLORS.blue} />
      </View>
      <Text style={canonicalStyles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const canonicalStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.36)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    paddingHorizontal: 8,
  },
  sheet: {
    gap: 8,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: 'rgba(248, 248, 250, 0.96)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  title: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.05,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  sectionHead: {
    paddingTop: 12,
    paddingBottom: 6,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.015)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  sectionHeadText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.18)',
  },
  glyph: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphActive: { backgroundColor: '#FFD789' },
  glyphPast: { backgroundColor: '#D9D2BD' },
  glyphUpcoming: { backgroundColor: '#E5E5EA' },
  glyphAction: { backgroundColor: `${IOS_COLORS.blue}15` },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
  },
  rowNameMuted: {
    color: IOS_COLORS.secondaryLabel,
  },
  rowSubRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  rowSub: {
    fontSize: 12.5,
    color: IOS_COLORS.secondaryLabel,
    flexShrink: 1,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  pillActive: { backgroundColor: 'rgba(52,199,89,0.18)' },
  pillPast: { backgroundColor: '#E5E5EA' },
  pillArchived: { backgroundColor: 'rgba(60,60,67,0.10)' },
  pillPlanning: { backgroundColor: `${IOS_COLORS.blue}1A` },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: IOS_COLORS.secondaryLabel,
  },
  pillTextActive: {
    color: '#1A7B36',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: IOS_COLORS.blue,
    letterSpacing: -0.3,
  },
  cancel: {
    backgroundColor: 'rgba(248, 248, 250, 0.96)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.blue,
    letterSpacing: -0.3,
  },
});

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    maxHeight: '70%',
  },
  container: {
    backgroundColor: TUFTE_BACKGROUND,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '100%',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  closeButton: {
    padding: 4,
  },

  // Content
  content: {
    maxHeight: 400,
  },

  // Option
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: IOS_COLORS.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  optionSelected: {
    backgroundColor: `${IOS_COLORS.blue}08`,
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.tertiarySystemBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activeSeasonIcon: {
    backgroundColor: `${IOS_COLORS.green}15`,
  },
  optionContent: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  optionTitleSelected: {
    color: IOS_COLORS.blue,
  },
  optionSubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: `${IOS_COLORS.green}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.green,
  },

  // Divider
  divider: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: IOS_COLORS.tertiarySystemBackground,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 4,
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
});

export default SeasonPickerModal;
