import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DashboardSection } from '../shared';
import { createLogger } from '@/lib/utils/logger';

interface RaceStrategy {
  id: string;
  raceTitle: string;
  venue: string;
  startDate: string;
  confidence: number;
  status: 'ready' | 'in_progress' | 'pending';
  aiRecommendations: string[];
  weatherConditions: {
    windSpeed: string;
    windDirection: string;
    confidence: number;
  };
  equipment: {
    sail: string;
    setup: string;
    recommendation: string;
  };
  tactical: {
    startStrategy: string;
    upwindStrategy: string;
    downwindStrategy: string;
  };
}

interface RaceStrategyTabProps {
  activeStrategy?: RaceStrategy;
  strategyLibrary: RaceStrategy[];
  onGenerateStrategy: (raceId: string) => void;
  onViewStrategy: (strategyId: string) => void;
  onUploadDocuments: () => void;
}

const logger = createLogger('RaceStrategyTab');
export function RaceStrategyTab({
  activeStrategy,
  strategyLibrary,
  onGenerateStrategy: _onGenerateStrategy,
  onViewStrategy,
  onUploadDocuments
}: RaceStrategyTabProps) {
  const [selectedSection, setSelectedSection] = useState<'overview' | 'weather' | 'equipment' | 'tactical'>('overview');

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10B981';
    if (confidence >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return '#10B981';
      case 'in_progress': return '#F59E0B';
      case 'pending': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Active Strategy Section */}
      {activeStrategy ? (
        <DashboardSection
          title="🎯 Current Race Strategy"
          subtitle={`${activeStrategy.raceTitle} • ${activeStrategy.venue}`}
          headerAction={{
            label: 'Edit Strategy',
            onPress: () => onViewStrategy(activeStrategy.id),
            icon: 'create-outline'
          }}
        >
          {/* Strategy Status Header */}
          <View style={styles.strategyHeader}>
            <View style={styles.statusCard}>
              <View style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(activeStrategy.status) }
              ]} />
              <Text style={styles.statusText}>
                {activeStrategy.status === 'ready' ? 'Strategy Ready' :
                 activeStrategy.status === 'in_progress' ? 'In Development' : 'Needs Planning'}
              </Text>
            </View>
            <View style={styles.confidenceCard}>
              <Text style={[
                styles.confidenceValue,
                { color: getConfidenceColor(activeStrategy.confidence) }
              ]}>
                {activeStrategy.confidence}%
              </Text>
              <Text style={styles.confidenceLabel}>Confidence</Text>
            </View>
          </View>

          {/* Strategy Navigation */}
          <View style={styles.strategyNav}>
            {[
              { key: 'overview', label: 'Overview', icon: 'eye-outline' },
              { key: 'weather', label: 'Weather', icon: 'cloudy-outline' },
              { key: 'equipment', label: 'Equipment', icon: 'settings-outline' },
              { key: 'tactical', label: 'Tactical', icon: 'compass-outline' },
            ].map((section) => (
              <TouchableOpacity
                key={section.key}
                style={[
                  styles.navButton,
                  selectedSection === section.key && styles.navButtonActive
                ]}
                onPress={() => setSelectedSection(section.key as any)}
              >
                <Ionicons
                  name={section.icon as any}
                  size={16}
                  color={selectedSection === section.key ? '#1E40AF' : '#64748B'}
                />
                <Text style={[
                  styles.navButtonText,
                  selectedSection === section.key && styles.navButtonTextActive
                ]}>
                  {section.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Strategy Content */}
          <View style={styles.strategyContent}>
            {selectedSection === 'overview' && (
              <View style={styles.overviewContent}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {activeStrategy.aiRecommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationCard}>
                    <Ionicons name="bulb" size={16} color="#F59E0B" />
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}

            {selectedSection === 'weather' && (
              <View style={styles.weatherContent}>
                <View style={styles.weatherCard}>
                  <Text style={styles.sectionTitle}>Expected Conditions</Text>
                  <View style={styles.weatherDetails}>
                    <View style={styles.weatherItem}>
                      <Ionicons name="speedometer" size={20} color="#3B82F6" />
                      <Text style={styles.weatherValue}>{activeStrategy.weatherConditions.windSpeed}</Text>
                      <Text style={styles.weatherLabel}>Wind Speed</Text>
                    </View>
                    <View style={styles.weatherItem}>
                      <Ionicons name="compass" size={20} color="#3B82F6" />
                      <Text style={styles.weatherValue}>{activeStrategy.weatherConditions.windDirection}</Text>
                      <Text style={styles.weatherLabel}>Direction</Text>
                    </View>
                    <View style={styles.weatherItem}>
                      <Ionicons name="checkmark-circle" size={20} color={getConfidenceColor(activeStrategy.weatherConditions.confidence)} />
                      <Text style={styles.weatherValue}>{activeStrategy.weatherConditions.confidence}%</Text>
                      <Text style={styles.weatherLabel}>Confidence</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {selectedSection === 'equipment' && (
              <View style={styles.equipmentContent}>
                <Text style={styles.sectionTitle}>Recommended Setup</Text>
                <View style={styles.equipmentGrid}>
                  <View style={styles.equipmentCard}>
                    <Ionicons name="boat" size={24} color="#3B82F6" />
                    <Text style={styles.equipmentTitle}>Sail Selection</Text>
                    <Text style={styles.equipmentValue}>{activeStrategy.equipment.sail}</Text>
                  </View>
                  <View style={styles.equipmentCard}>
                    <Ionicons name="settings" size={24} color="#3B82F6" />
                    <Text style={styles.equipmentTitle}>Boat Setup</Text>
                    <Text style={styles.equipmentValue}>{activeStrategy.equipment.setup}</Text>
                  </View>
                </View>
                <View style={styles.recommendationCard}>
                  <Ionicons name="information-circle" size={16} color="#3B82F6" />
                  <Text style={styles.recommendationText}>{activeStrategy.equipment.recommendation}</Text>
                </View>
              </View>
            )}

            {selectedSection === 'tactical' && (
              <View style={styles.tacticalContent}>
                <Text style={styles.sectionTitle}>Tactical Plan</Text>
                <View style={styles.tacticalSection}>
                  <Text style={styles.tacticalTitle}>🏁 Start Strategy</Text>
                  <Text style={styles.tacticalText}>{activeStrategy.tactical.startStrategy}</Text>
                </View>
                <View style={styles.tacticalSection}>
                  <Text style={styles.tacticalTitle}>⬆️ Upwind Strategy</Text>
                  <Text style={styles.tacticalText}>{activeStrategy.tactical.upwindStrategy}</Text>
                </View>
                <View style={styles.tacticalSection}>
                  <Text style={styles.tacticalTitle}>⬇️ Downwind Strategy</Text>
                  <Text style={styles.tacticalText}>{activeStrategy.tactical.downwindStrategy}</Text>
                </View>
              </View>
            )}
          </View>
        </DashboardSection>
      ) : (
        /* No Active Strategy */
        <DashboardSection title="🎯 Race Strategy Planning">
          <View style={styles.emptyStrategy}>
            <LinearGradient
              colors={['#9333ea', '#7e22ce']}
              style={styles.emptyGradient}
            >
              <Ionicons name="compass" size={48} color="#FFFFFF" />
              <Text style={styles.emptyTitle}>No Active Strategy</Text>
              <Text style={styles.emptyText}>Upload race documents or select an upcoming race to generate an AI-powered strategy</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={onUploadDocuments}
              >
                <Ionicons name="document-text" size={20} color="#9333ea" />
                <Text style={styles.uploadButtonText}>Upload Documents</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </DashboardSection>
      )}

      {/* Strategy Library */}
      <DashboardSection
        title="📚 Strategy Library"
        subtitle="Previous strategies and templates"
        headerAction={{
          label: 'View All',
          onPress: () => logger.debug('View all strategies'),
          icon: 'library-outline'
        }}
      >
        {strategyLibrary.slice(0, 3).map((strategy) => (
          <TouchableOpacity
            key={strategy.id}
            style={styles.libraryCard}
            onPress={() => onViewStrategy(strategy.id)}
          >
            <View style={styles.libraryHeader}>
              <View style={styles.libraryInfo}>
                <Text style={styles.libraryTitle}>{strategy.raceTitle}</Text>
                <Text style={styles.libraryVenue}>{strategy.venue}</Text>
                <Text style={styles.libraryDate}>{strategy.startDate}</Text>
              </View>
              <View style={styles.libraryMeta}>
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: getStatusColor(strategy.status) }
                ]} />
                <Text style={[
                  styles.confidenceText,
                  { color: getConfidenceColor(strategy.confidence) }
                ]}>
                  {strategy.confidence}%
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {strategyLibrary.length === 0 && (
          <View style={styles.emptyLibrary}>
            <Ionicons name="library-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyLibraryText}>No strategies yet</Text>
          </View>
        )}
      </DashboardSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  strategyHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  confidenceCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  confidenceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  strategyNav: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  navButtonActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 1px',
    elevation: 1,
  },
  navButtonText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  navButtonTextActive: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  strategyContent: {
    minHeight: 200,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  overviewContent: {
    gap: 8,
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  weatherContent: {
    gap: 16,
  },
  weatherCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  weatherItem: {
    alignItems: 'center',
    gap: 8,
  },
  weatherValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  weatherLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  equipmentContent: {
    gap: 16,
  },
  equipmentGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  equipmentCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  equipmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  equipmentValue: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  tacticalContent: {
    gap: 16,
  },
  tacticalSection: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  tacticalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  tacticalText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  emptyStrategy: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyGradient: {
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9333ea',
  },
  libraryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  libraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  libraryInfo: {
    flex: 1,
  },
  libraryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  libraryVenue: {
    fontSize: 12,
    color: '#3B82F6',
    marginBottom: 2,
  },
  libraryDate: {
    fontSize: 12,
    color: '#64748B',
  },
  libraryMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyLibrary: {
    alignItems: 'center',
    padding: 40,
  },
  emptyLibraryText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 16,
  },
});