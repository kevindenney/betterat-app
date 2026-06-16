/**
 * Rig Tuning Card
 * Displays race-specific rig settings sourced from tuning guides and matched to forecast conditions.
 * Enhanced with equipment-aware recommendations.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { StrategyCard } from './StrategyCard';
import type { RaceTuningRecommendation } from '@/services/RaceTuningService';

interface RigTuningCardProps {
  raceId: string;
  boatClassName?: string;
  boatName?: string;  // NEW: Display which boat is being used
  recommendation?: RaceTuningRecommendation | null;
  loading?: boolean;
  errorMessage?: string | null;
  onRefresh?: () => void;
  onBoatPress?: () => void;  // NEW: Navigate to boat details
}

type CardStatus = 'ready' | 'generating' | 'not_set';

export function RigTuningCard({
  raceId,
  boatClassName,
  boatName: _boatName,
  recommendation,
  loading = false,
  errorMessage,
  onRefresh,
  onBoatPress,
}: RigTuningCardProps) {
  const status: CardStatus = loading
    ? 'generating'
    : recommendation
      ? 'ready'
      : 'not_set';

  const statusMessage = loading
    ? 'Matching rig settings to forecast...'
    : errorMessage
      ? 'Unable to load tuning recommendations'
    : recommendation
      ? undefined
      : 'Add tuning guides for this class';

  const sortedSettings = React.useMemo(() => {
    if (!recommendation?.settings) return [];

    const priority = [
      'upper_shrouds',
      'lower_shrouds',
      'forestay_length',
      'mast_rake',
      'spreader_sweep',
      'backstay_tension',
    ];

    return [...recommendation.settings].sort((a, b) => {
      const indexA = priority.indexOf(a.key);
      const indexB = priority.indexOf(b.key);

      if (indexA === -1 && indexB === -1) {
        return a.label.localeCompare(b.label);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [recommendation]);

  return (
    <StrategyCard
      icon="wrench-clock"
      title="Rig Tuning Checklist"
      status={status}
      statusMessage={statusMessage}
      actionLabel={onRefresh ? 'Refresh' : undefined}
      actionIcon={onRefresh ? 'refresh' : undefined}
      onAction={onRefresh}
    >
      <View style={styles.container}>
        {loading && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading rig recommendations…</Text>
          </View>
        )}

        {!loading && !recommendation && !errorMessage && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="book-cog-outline" size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No tuning data yet</Text>
            <Text style={styles.emptyText}>
              Add a tuning guide to your {boatClassName || 'class'} library to unlock race-day rig checklists.
            </Text>
          </View>
        )}

        {!loading && !recommendation && !!errorMessage && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#DC2626" />
            <Text style={styles.emptyTitle}>Tuning unavailable</Text>
            <Text style={styles.emptyText}>{errorMessage}</Text>
          </View>
        )}

        {!loading && recommendation && (
          <>
            {/* AI-Generated Badge (if applicable) */}
            {recommendation.isAIGenerated && (
              <View style={styles.aiBadge}>
                <MaterialCommunityIcons name="robot-outline" size={16} color="#7C3AED" />
                <Text style={styles.aiBadgeText}>
                  AI-Generated Recommendations
                  {recommendation.confidence && ` • ${Math.round(recommendation.confidence * 100)}% confidence`}
                </Text>
              </View>
            )}

            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons
                  name={recommendation.isAIGenerated ? "robot-outline" : "text-box-check-outline"}
                  size={20}
                  color={recommendation.isAIGenerated ? "#7C3AED" : "#3B82F6"}
                />
                <View>
                  <Text style={styles.headerTitle}>{recommendation.sectionTitle || 'Matched Setup'}</Text>
                  {recommendation.conditionSummary && (
                    <Text style={styles.headerSubtitle}>
                      Target wind: {recommendation.conditionSummary}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.sourceBadge,
                  recommendation.isAIGenerated && styles.aiSourceBadge
                ]}
                onPress={onRefresh}
                disabled={!onRefresh}
                accessibilityLabel="Refresh tuning recommendations"
              >
                <MaterialCommunityIcons
                  name={recommendation.isAIGenerated ? "robot-outline" : "file-document-outline"}
                  size={14}
                  color={recommendation.isAIGenerated ? "#7C3AED" : "#2563EB"}
                />
                <Text style={[
                  styles.sourceText,
                  recommendation.isAIGenerated && styles.aiSourceText
                ]}>
                  {recommendation.guideTitle}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsGrid}>
              {sortedSettings.map(setting => (
                <View key={`${raceId}-${setting.key}-${setting.value}`} style={styles.settingCard}>
                  <Text style={styles.settingLabel}>{setting.label}</Text>
                  <Text style={styles.settingValue}>{setting.value}</Text>
                  {setting.reasoning && (
                    <Text style={styles.settingReasoning}>{setting.reasoning}</Text>
                  )}
                  {setting.rawKey && setting.rawKey !== setting.label && (
                    <Text style={styles.settingMeta}>{setting.rawKey}</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Equipment Context Badge */}
            {recommendation.equipmentContext && (
              <TouchableOpacity 
                style={styles.equipmentBadge}
                onPress={onBoatPress}
                disabled={!onBoatPress}
              >
                <Ionicons name="boat-outline" size={16} color="#0D9488" />
                <View style={styles.equipmentBadgeContent}>
                  <Text style={styles.equipmentBadgeTitle}>
                    Using: {recommendation.equipmentContext.boatName || 'Your Boat'}
                  </Text>
                  {recommendation.equipmentContext.mast?.manufacturer && (
                    <Text style={styles.equipmentBadgeDetail}>
                      {recommendation.equipmentContext.mast.manufacturer} mast
                      {recommendation.equipmentContext.sails.length > 0 && 
                        ` • ${recommendation.equipmentContext.sails[0]?.manufacturer || ''} sails`}
                    </Text>
                  )}
                </View>
                {onBoatPress && (
                  <Ionicons name="chevron-forward" size={16} color="#0D9488" />
                )}
              </TouchableOpacity>
            )}

            {/* Equipment-Specific Notes */}
            {recommendation.equipmentSpecificNotes && recommendation.equipmentSpecificNotes.length > 0 && (
              <View style={styles.equipmentNotes}>
                <Ionicons name="information-circle" size={16} color="#0D9488" />
                <View style={styles.equipmentNotesList}>
                  {recommendation.equipmentSpecificNotes.map((note, idx) => (
                    <Text key={idx} style={styles.equipmentNoteText}>• {note}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Maintenance Alert */}
            {recommendation.equipmentContext?.hasMaintenanceAlerts && (
              <View style={styles.maintenanceAlert}>
                <Ionicons name="warning" size={16} color="#DC2626" />
                <Text style={styles.maintenanceAlertText}>
                  Equipment maintenance required - check before racing
                </Text>
              </View>
            )}

            {recommendation.weatherSpecificNotes && recommendation.weatherSpecificNotes.length > 0 && (
              <View style={styles.weatherNotes}>
                <MaterialCommunityIcons name="weather-partly-cloudy" size={16} color="#F59E0B" />
                <View style={styles.weatherNotesList}>
                  {recommendation.weatherSpecificNotes.map((note, idx) => (
                    <Text key={idx} style={styles.weatherNoteText}>• {note}</Text>
                  ))}
                </View>
              </View>
            )}

            {recommendation.notes && (
              <View style={styles.notes}>
                <MaterialCommunityIcons name="note-text-outline" size={16} color="#64748B" />
                <Text style={styles.notesText} numberOfLines={3}>
                  {recommendation.notes}
                </Text>
              </View>
            )}

            {recommendation.caveats && recommendation.caveats.length > 0 && (
              <View style={styles.caveats}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#F59E0B" />
                <View style={styles.caveatsList}>
                  {recommendation.caveats.map((caveat, idx) => (
                    <Text key={idx} style={styles.caveatText}>• {caveat}</Text>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Source: {recommendation.guideSource}
              </Text>
            </View>
          </>
        )}
      </View>
    </StrategyCard>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#1F2937',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  aiBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  aiSourceBadge: {
    backgroundColor: '#F3E8FF',
  },
  sourceText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  aiSourceText: {
    color: '#7C3AED',
  },
  settingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  settingCard: {
    flexBasis: '48%',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  settingReasoning: {
    fontSize: 11,
    color: '#7C3AED',
    fontStyle: 'italic',
    marginTop: 4,
  },
  settingMeta: {
    fontSize: 11,
    color: '#94A3B8',
  },
  weatherNotes: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  weatherNotesList: {
    flex: 1,
    gap: 4,
  },
  weatherNoteText: {
    fontSize: 12,
    color: '#92400E',
  },
  notes: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
  },
  notesText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  caveats: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  caveatsList: {
    flex: 1,
    gap: 4,
  },
  caveatText: {
    fontSize: 11,
    color: '#9A3412',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
  equipmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#CCFBF1',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#5EEAD4',
  },
  equipmentBadgeContent: {
    flex: 1,
    gap: 2,
  },
  equipmentBadgeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D9488',
  },
  equipmentBadgeDetail: {
    fontSize: 11,
    color: '#14B8A6',
  },
  equipmentNotes: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  equipmentNotesList: {
    flex: 1,
    gap: 4,
  },
  equipmentNoteText: {
    fontSize: 12,
    color: '#0F766E',
  },
  maintenanceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  maintenanceAlertText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
});
