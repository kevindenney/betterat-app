/**
 * Multi-Race Selection Screen
 * Shows when AI detects multiple races in a NOR (e.g., race series or calendar)
 * Allows users to select which races to create
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { ArrowLeft, CheckCircle, Circle, Calendar, MapPin, Clock, Filter } from 'lucide-react-native';
import type { ExtractedData, MultiRaceExtractedData } from './AIValidationScreen';

const ALL_CLASSES = '__ALL__';

/**
 * Extract a normalized, deduped, sorted list of unique class names across all races.
 * Case-insensitive dedupe but preserves the first-seen casing for display.
 */
function buildClassOptions(races: ExtractedData[]): string[] {
  const seen = new Map<string, string>(); // lowercase → first-seen original
  for (const race of races) {
    const classes = (race as any).eligibleClasses as string[] | null | undefined;
    if (!Array.isArray(classes)) continue;
    for (const cls of classes) {
      if (typeof cls !== 'string') continue;
      const trimmed = cls.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) seen.set(key, trimmed);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns true if the race's eligibleClasses contains the target class.
 * Substring + case-insensitive match so "IRC" filter catches "IRC Division 1", "IRC Monohull", etc.
 */
function raceMatchesClass(race: ExtractedData, targetClass: string): boolean {
  const classes = (race as any).eligibleClasses as string[] | null | undefined;
  if (!Array.isArray(classes) || classes.length === 0) return false; // ambiguous → excluded under specific filter
  const needle = targetClass.toLowerCase();
  return classes.some((cls) => typeof cls === 'string' && cls.toLowerCase().includes(needle));
}

interface MultiRaceSelectionScreenProps {
  extractedData: MultiRaceExtractedData;
  onConfirm: (selectedRaces: ExtractedData[]) => void;
  onCancel: () => void;
}

export function MultiRaceSelectionScreen({
  extractedData,
  onConfirm,
  onCancel,
}: MultiRaceSelectionScreenProps) {
  // Filter by class. ALL_CLASSES = no filter (shows everything including races with no eligibleClasses)
  const [selectedClass, setSelectedClass] = useState<string>(ALL_CLASSES);

  const classOptions = useMemo(() => buildClassOptions(extractedData.races), [extractedData.races]);

  // Indices of races currently visible under the active class filter
  const visibleIndices = useMemo(() => {
    if (selectedClass === ALL_CLASSES) {
      return extractedData.races.map((_, i) => i);
    }
    return extractedData.races
      .map((race, i) => (raceMatchesClass(race, selectedClass) ? i : -1))
      .filter((i) => i !== -1);
  }, [extractedData.races, selectedClass]);

  // Selected races. Resets to "all visible" whenever the filter changes —
  // simpler and more predictable than carrying selections across hidden races.
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(extractedData.races.map((_, index) => index)),
  );
  useEffect(() => {
    setSelectedIndices(new Set(visibleIndices));
  }, [visibleIndices]);

  const visibleSelectedCount = useMemo(
    () => visibleIndices.filter((i) => selectedIndices.has(i)).length,
    [visibleIndices, selectedIndices],
  );

  const toggleRace = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const toggleAll = () => {
    // Toggle only the currently visible races
    const allVisibleSelected = visibleSelectedCount === visibleIndices.length;
    const newSelected = new Set(selectedIndices);
    if (allVisibleSelected) {
      visibleIndices.forEach((i) => newSelected.delete(i));
    } else {
      visibleIndices.forEach((i) => newSelected.add(i));
    }
    setSelectedIndices(newSelected);
  };

  const handleConfirm = () => {
    // Only confirm visible + selected races (matches what the user sees on screen)
    const selectedRaces = extractedData.races.filter(
      (_, index) => selectedIndices.has(index) && visibleIndices.includes(index),
    );
    onConfirm(selectedRaces);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Date TBD';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return null;
    // Convert "HHMMhrs" to "HH:MM"
    const match = timeString.match(/(\d{2})(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    return timeString;
  };

  // Group races by series — only includes races visible under the active class filter
  const visibleSet = useMemo(() => new Set(visibleIndices), [visibleIndices]);
  const groupedRaces = extractedData.races.reduce((acc, race, index) => {
    if (!visibleSet.has(index)) return acc;
    const seriesName = race.raceSeriesName || 'Individual Races';
    if (!acc[seriesName]) {
      acc[seriesName] = [];
    }
    acc[seriesName].push({ race, index });
    return acc;
  }, {} as Record<string, { race: ExtractedData; index: number }[]>);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <ArrowLeft color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Multiple Races Detected!</Text>
          <Text style={styles.headerSubtitle}>
            {`${extractedData.documentType || 'Document'} • ${extractedData.races.length} races found`}
            {selectedClass !== ALL_CLASSES &&
              ` • showing ${visibleIndices.length} for ${selectedClass}`}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>📋 Document Summary</Text>
          <Text style={styles.summaryText}>
            {`This ${extractedData.documentType || 'document'} contains `}
            <Text style={styles.bold}>{extractedData.races.length} races</Text>
            {' in total.'}
            {extractedData.organizingAuthority && ` Organized by ${extractedData.organizingAuthority}.`}
          </Text>
          <Text style={styles.summaryText}>
            Select the races you want to add to your calendar:
          </Text>
        </View>

        {/* Class Filter — only shown if at least one race has eligibleClasses */}
        {classOptions.length > 0 && (
          <View style={styles.filterSection}>
            <View style={styles.filterLabelRow}>
              <Filter size={14} color="#475569" />
              <Text style={styles.filterLabel}>Filter by class</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              {[ALL_CLASSES, ...classOptions].map((cls) => {
                const isActive = selectedClass === cls;
                const label = cls === ALL_CLASSES ? 'All classes' : cls;
                return (
                  <TouchableOpacity
                    key={cls}
                    onPress={() => setSelectedClass(cls)}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {selectedClass !== ALL_CLASSES && (
              <Text style={styles.filterHint}>
                Hiding races where class isn't specified. Pick "All classes" to see them.
              </Text>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            onPress={toggleAll}
            disabled={visibleIndices.length === 0}
            style={[
              styles.quickActionButton,
              styles.quickActionPrimary,
              visibleIndices.length === 0 && styles.footerButtonDisabled,
            ]}
          >
            <Text style={styles.quickActionTextPrimary}>
              {visibleSelectedCount === visibleIndices.length && visibleIndices.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </Text>
          </TouchableOpacity>
          <View style={styles.selectionCount}>
            <Text style={styles.selectionCountText}>
              {visibleSelectedCount} of {visibleIndices.length} selected
            </Text>
          </View>
        </View>

        {/* Race Groups */}
        {Object.entries(groupedRaces).map(([seriesName, races]) => (
          <View key={seriesName} style={styles.seriesGroup}>
            <View style={styles.seriesHeader}>
              <Text style={styles.seriesTitle}>{seriesName}</Text>
              {races.length > 1 && (
                <Text style={styles.seriesCount}>{races.length} races</Text>
              )}
            </View>

            {races.map(({ race, index }) => {
              const isSelected = selectedIndices.has(index);
              const time = formatTime(race.warningSignalTime);

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.raceCard, isSelected && styles.raceCardSelected]}
                  onPress={() => toggleRace(index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.raceCardLeft}>
                    <View style={styles.checkbox}>
                      {isSelected ? (
                        <CheckCircle color="#3B82F6" size={24} />
                      ) : (
                        <Circle color="#CBD5E1" size={24} />
                      )}
                    </View>
                    <View style={styles.raceInfo}>
                      <Text style={[styles.raceName, isSelected && styles.raceNameSelected]}>
                        {race.raceName || 'Untitled Race'}
                      </Text>
                      <View style={styles.raceDetails}>
                        <View style={styles.raceDetail}>
                          <Calendar size={14} color="#64748B" />
                          <Text style={styles.raceDetailText}>
                            {formatDate(race.raceDate)}
                          </Text>
                        </View>
                        {time && (
                          <View style={styles.raceDetail}>
                            <Clock size={14} color="#64748B" />
                            <Text style={styles.raceDetailText}>{time}</Text>
                          </View>
                        )}
                        {(race.venue || race.venueVariant) && (
                          <View style={styles.raceDetail}>
                            <MapPin size={14} color="#64748B" />
                            <Text style={styles.raceDetailText}>
                              {race.venueVariant || race.venue}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  {race.confidenceScores?.overall && (
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>
                        {Math.round(race.confidenceScores.overall * 100)}%
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Info Box - Different text based on selection count */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {visibleSelectedCount === 1 ? (
              <>
                💡 <Text style={styles.bold}>Single Race:</Text> You'll review and edit the race details before it's added to your calendar.
              </>
            ) : visibleSelectedCount > 1 ? (
              <>
                💡 <Text style={styles.bold}>Multiple Races:</Text> All {visibleSelectedCount} races will be created with extracted details. You can edit each one individually from your Races tab.
              </>
            ) : (
              <>
                💡 <Text style={styles.bold}>Tip:</Text> Select at least one race to continue.
              </>
            )}
          </Text>
        </View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={onCancel}
          style={[styles.footerButton, styles.footerButtonCancel]}
        >
          <Text style={styles.footerButtonTextCancel}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={visibleSelectedCount === 0}
          style={[
            styles.footerButton,
            styles.footerButtonConfirm,
            visibleSelectedCount === 0 && styles.footerButtonDisabled,
          ]}
        >
          <Text style={styles.footerButtonTextConfirm}>
            {visibleSelectedCount === 0
              ? 'Select Races'
              : visibleSelectedCount === 1
                ? 'Review & Add Race'
                : `Add ${visibleSelectedCount} Races`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#3B82F6',
    paddingTop: Platform.OS === 'ios' ? 50 : Platform.OS === 'web' ? 20 : 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E0F2FE',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
    // Add padding at bottom for fixed footer + tab bar on web
    paddingBottom: Platform.OS === 'web' ? 180 : 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '600',
    color: '#1E293B',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16, // breathing room at end of horizontal scroll
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterHint: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  quickActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  quickActionPrimary: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  quickActionTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectionCount: {
    flex: 1,
    alignItems: 'flex-end',
  },
  selectionCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  seriesGroup: {
    marginBottom: 24,
  },
  seriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  seriesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  seriesCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  raceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  raceCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  raceCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    marginTop: 2,
  },
  raceInfo: {
    flex: 1,
  },
  raceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  raceNameSelected: {
    color: '#1E40AF',
  },
  raceDetails: {
    gap: 6,
  },
  raceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  raceDetailText: {
    fontSize: 13,
    color: '#64748B',
  },
  confidenceBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: Platform.OS === 'web' ? 24 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexShrink: 0,
    minHeight: 80,
    // Fix footer above tab bar on web
    ...(Platform.OS === 'web' ? {
      position: 'fixed' as const,
      bottom: 70, // Account for tab bar height
      left: 0,
      right: 0,
      zIndex: 100,
    } : {}),
  },
  footerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonCancel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  footerButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  footerButtonConfirm: {
    backgroundColor: '#3B82F6',
  },
  footerButtonDisabled: {
    opacity: 0.5,
  },
  footerButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
