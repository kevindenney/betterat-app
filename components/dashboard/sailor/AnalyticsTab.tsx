import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashboardSection, DashboardKPICard } from '../shared';

interface PerformanceData {
  raceResults: {
    id: string;
    event: string;
    venue: string;
    date: string;
    position: number;
    fleet: number;
    conditions: string;
  }[];
  stats: {
    totalRaces: number;
    avgPosition: number;
    bestPosition: number;
    topThreeFinishes: number;
    improvementTrend: number;
    consistencyScore: number;
  };
  venuePerformance: {
    venue: string;
    races: number;
    avgPosition: number;
    bestPosition: number;
  }[];
  conditionsAnalysis: {
    conditions: string;
    races: number;
    avgPosition: number;
    strength: 'weak' | 'average' | 'strong';
  }[];
  equipmentCorrelation: {
    setup: string;
    races: number;
    avgPosition: number;
    effectiveness: number;
  }[];
}

interface AnalyticsTabProps {
  performanceData: PerformanceData;
  onViewRaceDetails: (raceId: string) => void;
  onViewVenueAnalysis: (venue: string) => void;
}

export function AnalyticsTab({
  performanceData,
  onViewRaceDetails,
  onViewVenueAnalysis
}: AnalyticsTabProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'month' | 'season' | 'year' | 'all'>('season');
  const [selectedAnalysis, setSelectedAnalysis] = useState<'overview' | 'venues' | 'conditions' | 'equipment'>('overview');

  const getTrendColor = (trend: number) => {
    if (trend > 0) return '#10B981';
    if (trend < 0) return '#EF4444';
    return '#6B7280';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return 'trending-up';
    if (trend < 0) return 'trending-down';
    return 'remove';
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return '#10B981';
      case 'average': return '#F59E0B';
      case 'weak': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const renderOverview = () => (
    <View style={styles.overviewContent}>
      {/* Performance KPIs */}
      <View style={styles.kpiGrid}>
        <DashboardKPICard
          title="Total Races"
          value={performanceData.stats.totalRaces}
          icon="trophy-outline"
          iconColor="#FF9800"
        />
        <DashboardKPICard
          title="Average Position"
          value={performanceData.stats.avgPosition.toFixed(1)}
          icon="podium-outline"
          iconColor="#4CAF50"
          trend={{
            direction: performanceData.stats.improvementTrend > 0 ? 'up' : 'down',
            value: `${Math.abs(performanceData.stats.improvementTrend).toFixed(1)}`
          }}
        />
        <DashboardKPICard
          title="Best Result"
          value={performanceData.stats.bestPosition}
          icon="medal-outline"
          iconColor="#FFD700"
        />
        <DashboardKPICard
          title="Top 3 Finishes"
          value={performanceData.stats.topThreeFinishes}
          icon="ribbon-outline"
          iconColor="#9C27B0"
        />
      </View>

      {/* Recent Race Results */}
      <View style={styles.recentRacesSection}>
        <Text style={styles.sectionTitle}>Recent Race Results</Text>
        {performanceData.raceResults.slice(0, 5).map((race) => (
          <TouchableOpacity
            key={race.id}
            style={styles.raceResultCard}
            onPress={() => onViewRaceDetails(race.id)}
          >
            <View style={styles.raceResultHeader}>
              <View style={styles.raceResultInfo}>
                <Text style={styles.raceResultEvent}>{race.event}</Text>
                <Text style={styles.raceResultVenue}>{race.venue}</Text>
                <Text style={styles.raceResultDate}>{race.date}</Text>
              </View>
              <View style={styles.raceResultPosition}>
                <Text style={[
                  styles.positionNumber,
                  { color: race.position <= 3 ? '#10B981' : race.position <= 10 ? '#F59E0B' : '#64748B' }
                ]}>
                  {race.position}
                </Text>
                <Text style={styles.positionSuffix}>/{race.fleet}</Text>
              </View>
            </View>
            <View style={styles.raceResultFooter}>
              <Text style={styles.raceConditions}>{race.conditions}</Text>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Performance Trends */}
      <View style={styles.trendsSection}>
        <Text style={styles.sectionTitle}>Performance Trends</Text>
        <View style={styles.trendCard}>
          <View style={styles.trendItem}>
            <Ionicons
              name={getTrendIcon(performanceData.stats.improvementTrend) as any}
              size={20}
              color={getTrendColor(performanceData.stats.improvementTrend)}
            />
            <Text style={styles.trendLabel}>Position Improvement</Text>
            <Text style={[
              styles.trendValue,
              { color: getTrendColor(performanceData.stats.improvementTrend) }
            ]}>
              {performanceData.stats.improvementTrend > 0 ? '+' : ''}{performanceData.stats.improvementTrend.toFixed(1)}
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Ionicons name="analytics" size={20} color="#3B82F6" />
            <Text style={styles.trendLabel}>Consistency Score</Text>
            <Text style={styles.trendValue}>{performanceData.stats.consistencyScore}/100</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderVenueAnalysis = () => (
    <View style={styles.venueContent}>
      <Text style={styles.sectionTitle}>Venue Performance Analysis</Text>
      {performanceData.venuePerformance.map((venue, index) => (
        <TouchableOpacity
          key={index}
          style={styles.venueCard}
          onPress={() => onViewVenueAnalysis(venue.venue)}
        >
          <View style={styles.venueHeader}>
            <Text style={styles.venueName}>{venue.venue}</Text>
            <View style={styles.venueStats}>
              <Text style={styles.venueRaces}>{venue.races} races</Text>
            </View>
          </View>
          <View style={styles.venueMetrics}>
            <View style={styles.venueMetric}>
              <Text style={styles.metricLabel}>Average</Text>
              <Text style={styles.metricValue}>{venue.avgPosition.toFixed(1)}</Text>
            </View>
            <View style={styles.venueMetric}>
              <Text style={styles.metricLabel}>Best</Text>
              <Text style={[
                styles.metricValue,
                { color: venue.bestPosition <= 3 ? '#10B981' : '#64748B' }
              ]}>
                {venue.bestPosition}
              </Text>
            </View>
            <View style={styles.venueMetric}>
              <Text style={styles.metricLabel}>Strength</Text>
              <View style={[
                styles.strengthIndicator,
                { backgroundColor: venue.avgPosition <= 5 ? '#10B981' : venue.avgPosition <= 10 ? '#F59E0B' : '#EF4444' }
              ]}>
                <Text style={styles.strengthText}>
                  {venue.avgPosition <= 5 ? 'Strong' : venue.avgPosition <= 10 ? 'Good' : 'Developing'}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderConditionsAnalysis = () => (
    <View style={styles.conditionsContent}>
      <Text style={styles.sectionTitle}>Conditions Performance</Text>
      <Text style={styles.sectionSubtitle}>
        Understand your strengths and areas for improvement in different racing conditions
      </Text>
      {performanceData.conditionsAnalysis.map((condition, index) => (
        <View key={index} style={styles.conditionCard}>
          <View style={styles.conditionHeader}>
            <Text style={styles.conditionName}>{condition.conditions}</Text>
            <View style={[
              styles.strengthBadge,
              { backgroundColor: getStrengthColor(condition.strength) }
            ]}>
              <Text style={styles.strengthBadgeText}>
                {condition.strength.charAt(0).toUpperCase() + condition.strength.slice(1)}
              </Text>
            </View>
          </View>
          <View style={styles.conditionStats}>
            <View style={styles.conditionStat}>
              <Text style={styles.conditionStatLabel}>Races</Text>
              <Text style={styles.conditionStatValue}>{condition.races}</Text>
            </View>
            <View style={styles.conditionStat}>
              <Text style={styles.conditionStatLabel}>Avg Position</Text>
              <Text style={[
                styles.conditionStatValue,
                { color: condition.avgPosition <= 5 ? '#10B981' : condition.avgPosition <= 10 ? '#F59E0B' : '#EF4444' }
              ]}>
                {condition.avgPosition.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderEquipmentAnalysis = () => (
    <View style={styles.equipmentContent}>
      <Text style={styles.sectionTitle}>Equipment Performance</Text>
      <Text style={styles.sectionSubtitle}>
        Analyze how different boat setups correlate with your race results
      </Text>
      {performanceData.equipmentCorrelation.map((equipment, index) => (
        <View key={index} style={styles.equipmentCard}>
          <View style={styles.equipmentHeader}>
            <Text style={styles.equipmentSetup}>{equipment.setup}</Text>
            <View style={styles.effectivenessContainer}>
              <View style={[
                styles.effectivenessBar,
                { width: `${equipment.effectiveness}%` },
                { backgroundColor: equipment.effectiveness >= 70 ? '#10B981' : equipment.effectiveness >= 40 ? '#F59E0B' : '#EF4444' }
              ]} />
              <Text style={styles.effectivenessText}>{equipment.effectiveness}%</Text>
            </View>
          </View>
          <View style={styles.equipmentStats}>
            <View style={styles.equipmentStat}>
              <Text style={styles.equipmentStatLabel}>Races Used</Text>
              <Text style={styles.equipmentStatValue}>{equipment.races}</Text>
            </View>
            <View style={styles.equipmentStat}>
              <Text style={styles.equipmentStatLabel}>Avg Position</Text>
              <Text style={[
                styles.equipmentStatValue,
                { color: equipment.avgPosition <= 5 ? '#10B981' : equipment.avgPosition <= 10 ? '#F59E0B' : '#EF4444' }
              ]}>
                {equipment.avgPosition.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Time Frame Selector */}
      <DashboardSection title="📊 Performance Analytics" showBorder={false}>
        <View style={styles.timeframeSelector}>
          {[
            { key: 'month', label: 'This Month' },
            { key: 'season', label: 'This Season' },
            { key: 'year', label: 'This Year' },
            { key: 'all', label: 'All Time' },
          ].map((timeframe) => (
            <TouchableOpacity
              key={timeframe.key}
              style={[
                styles.timeframeButton,
                selectedTimeframe === timeframe.key && styles.timeframeButtonActive
              ]}
              onPress={() => setSelectedTimeframe(timeframe.key as any)}
            >
              <Text style={[
                styles.timeframeButtonText,
                selectedTimeframe === timeframe.key && styles.timeframeButtonTextActive
              ]}>
                {timeframe.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </DashboardSection>

      {/* Analysis Type Selector */}
      <DashboardSection title="" showBorder={false} padding={0}>
        <View style={styles.analysisSelector}>
          {[
            { key: 'overview', label: 'Overview', icon: 'analytics' },
            { key: 'venues', label: 'Venues', icon: 'location' },
            { key: 'conditions', label: 'Conditions', icon: 'cloudy' },
            { key: 'equipment', label: 'Equipment', icon: 'settings' },
          ].map((analysis) => (
            <TouchableOpacity
              key={analysis.key}
              style={[
                styles.analysisButton,
                selectedAnalysis === analysis.key && styles.analysisButtonActive
              ]}
              onPress={() => setSelectedAnalysis(analysis.key as any)}
            >
              <Ionicons
                name={analysis.icon as any}
                size={16}
                color={selectedAnalysis === analysis.key ? '#1E40AF' : '#64748B'}
              />
              <Text style={[
                styles.analysisButtonText,
                selectedAnalysis === analysis.key && styles.analysisButtonTextActive
              ]}>
                {analysis.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </DashboardSection>

      {/* Analysis Content */}
      <DashboardSection title="" showBorder={false}>
        {selectedAnalysis === 'overview' && renderOverview()}
        {selectedAnalysis === 'venues' && renderVenueAnalysis()}
        {selectedAnalysis === 'conditions' && renderConditionsAnalysis()}
        {selectedAnalysis === 'equipment' && renderEquipmentAnalysis()}
      </DashboardSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  timeframeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 1px',
    elevation: 1,
  },
  timeframeButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  timeframeButtonTextActive: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  analysisSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    boxShadow: '0px 1px',
    elevation: 1,
  },
  analysisButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  analysisButtonActive: {
    backgroundColor: '#EFF6FF',
  },
  analysisButtonText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  analysisButtonTextActive: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  overviewContent: {
    gap: 24,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: -4,
  },
  recentRacesSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  raceResultCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  raceResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  raceResultInfo: {
    flex: 1,
  },
  raceResultEvent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  raceResultVenue: {
    fontSize: 12,
    color: '#3B82F6',
    marginBottom: 2,
  },
  raceResultDate: {
    fontSize: 12,
    color: '#64748B',
  },
  raceResultPosition: {
    alignItems: 'center',
  },
  positionNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  positionSuffix: {
    fontSize: 12,
    color: '#64748B',
    marginTop: -4,
  },
  raceResultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  raceConditions: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  trendsSection: {
    gap: 12,
  },
  trendCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trendLabel: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
  },
  trendValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  venueContent: {
    gap: 12,
  },
  venueCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  venueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  venueStats: {
    alignItems: 'flex-end',
  },
  venueRaces: {
    fontSize: 12,
    color: '#64748B',
  },
  venueMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  venueMetric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  strengthIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  strengthText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  conditionsContent: {
    gap: 12,
  },
  conditionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  conditionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  conditionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  strengthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  strengthBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  conditionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  conditionStat: {
    alignItems: 'center',
  },
  conditionStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  conditionStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  equipmentContent: {
    gap: 12,
  },
  equipmentCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  equipmentHeader: {
    marginBottom: 12,
  },
  equipmentSetup: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  effectivenessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  effectivenessBar: {
    height: 6,
    borderRadius: 3,
    flex: 1,
  },
  effectivenessText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  equipmentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  equipmentStat: {
    alignItems: 'center',
  },
  equipmentStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  equipmentStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
});