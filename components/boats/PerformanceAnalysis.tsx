import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  VictoryAxis,
  VictoryChart,
  VictoryLine,
  VictoryScatter,
  VictoryTheme,
  VictoryTooltip,
  VictoryLegend,
  VictoryVoronoiContainer,
} from 'victory-native';

interface PerformanceAnalysisProps {
  boatId: string;
}

interface PerformanceMetric {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  change: string;
}

interface EquipmentCorrelation {
  equipment: string;
  avgFinish: number;
  races: number;
  winRate: string;
  impact: 'positive' | 'neutral' | 'negative';
}

interface SailPerformance {
  sailCombination: string;
  racesUsed: number;
  avgPosition: number;
  conditions: string;
  effectiveness: number;
  bestIn: string;
}

interface MaintenanceCorrelation {
  sail: string;
  age: number;
  racesUsed: number;
  avgPosition: number;
  trend: 'improving' | 'stable' | 'declining';
  recommendation: string;
  costBenefit: string;
}

interface VenueSetup {
  venue: string;
  setup: string;
  avgPosition: number;
  races: number;
}

interface FleetComparison {
  metric: string;
  yourValue: number;
  fleetAvg: number;
  percentile: number;
}

// Mock data
const PERFORMANCE_METRICS: PerformanceMetric[] = [
  { label: 'Avg Finish', value: '3.2', trend: 'up', change: '+0.5' },
  { label: 'Win Rate', value: '28%', trend: 'up', change: '+5%' },
  { label: 'Top 3 Rate', value: '62%', trend: 'stable', change: '0%' },
  { label: 'DNF Rate', value: '4%', trend: 'down', change: '-2%' },
];

const EQUIPMENT_CORRELATIONS: EquipmentCorrelation[] = [
  {
    equipment: 'Main #1 + Jib #2',
    avgFinish: 2.1,
    races: 18,
    winRate: '44%',
    impact: 'positive',
  },
  {
    equipment: 'Main #2 + Jib #2',
    avgFinish: 2.8,
    races: 12,
    winRate: '33%',
    impact: 'positive',
  },
  {
    equipment: 'Main #1 + Jib #1',
    avgFinish: 3.9,
    races: 15,
    winRate: '20%',
    impact: 'neutral',
  },
  {
    equipment: 'Main #2 + Jib #1',
    avgFinish: 5.2,
    races: 8,
    winRate: '12%',
    impact: 'negative',
  },
];

const WIND_ANALYSIS = [
  { range: '0-8 kts', avgFinish: 4.2, races: 12, bestSail: 'Main #1, Jib #1' },
  { range: '8-15 kts', avgFinish: 2.8, races: 28, bestSail: 'Main #1, Jib #2' },
  { range: '15-20 kts', avgFinish: 3.1, races: 18, bestSail: 'Main #2, Jib #2' },
  { range: '20+ kts', avgFinish: 5.5, races: 6, bestSail: 'Main #2, Jib #2' },
];

const AI_INSIGHTS = [
  {
    id: '1',
    type: 'recommendation',
    title: 'Optimal Wind Range',
    message: 'Your best performance is in 8-15 knots with Main #1 and Jib #2',
    confidence: 92,
  },
  {
    id: '2',
    type: 'warning',
    title: 'Light Air Performance',
    message: 'Consider upgrading Jib #1 - avg finish drops to 4.2 in light air',
    confidence: 85,
  },
  {
    id: '3',
    type: 'tip',
    title: 'Equipment Rotation',
    message: 'Main #2 shows wear - service before next heavy air event',
    confidence: 78,
  },
];

// Sail Performance Breakdown
const SAIL_PERFORMANCE: SailPerformance[] = [
  {
    sailCombination: 'DNJ-2024 Light',
    racesUsed: 18,
    avgPosition: 2.3,
    conditions: '6-12 kts',
    effectiveness: 92,
    bestIn: '8-10 kts light air',
  },
  {
    sailCombination: 'DNS-2023 Medium',
    racesUsed: 28,
    avgPosition: 3.1,
    conditions: '12-18 kts',
    effectiveness: 85,
    bestIn: '14-16 kts moderate',
  },
  {
    sailCombination: 'DNS-2022 Heavy',
    racesUsed: 12,
    avgPosition: 4.2,
    conditions: '18+ kts',
    effectiveness: 68,
    bestIn: '20-25 kts heavy air',
  },
  {
    sailCombination: 'DNJ-2023 All-Purpose',
    racesUsed: 22,
    avgPosition: 3.8,
    conditions: '10-16 kts',
    effectiveness: 75,
    bestIn: '12-14 kts variable',
  },
];

// Setup Optimization Data (for chart)
const SETUP_OPTIMIZATION = [
  { windSpeed: 6, avgPosition: 4.2, sail: 'DNJ-2024 Light' },
  { windSpeed: 8, avgPosition: 2.1, sail: 'DNJ-2024 Light' },
  { windSpeed: 10, avgPosition: 1.8, sail: 'DNJ-2024 Light' },
  { windSpeed: 12, avgPosition: 2.5, sail: 'DNJ-2024 Light' },
  { windSpeed: 12, avgPosition: 3.2, sail: 'DNS-2023 Medium' },
  { windSpeed: 14, avgPosition: 2.8, sail: 'DNS-2023 Medium' },
  { windSpeed: 16, avgPosition: 3.1, sail: 'DNS-2023 Medium' },
  { windSpeed: 18, avgPosition: 3.9, sail: 'DNS-2023 Medium' },
  { windSpeed: 18, avgPosition: 4.8, sail: 'DNS-2022 Heavy' },
  { windSpeed: 20, avgPosition: 3.9, sail: 'DNS-2022 Heavy' },
  { windSpeed: 22, avgPosition: 4.5, sail: 'DNS-2022 Heavy' },
  { windSpeed: 25, avgPosition: 5.2, sail: 'DNS-2022 Heavy' },
];

// Maintenance Correlation
const MAINTENANCE_CORRELATION: MaintenanceCorrelation[] = [
  {
    sail: 'DNS-2023 Medium',
    age: 18,
    racesUsed: 35,
    avgPosition: 3.2,
    trend: 'declining',
    recommendation: 'Service within 10 races',
    costBenefit: 'High - prevents 0.5 position loss',
  },
  {
    sail: 'DNJ-2024 Light',
    age: 6,
    racesUsed: 18,
    avgPosition: 2.3,
    trend: 'stable',
    recommendation: 'Optimal condition',
    costBenefit: 'Continue current use',
  },
  {
    sail: 'DNS-2022 Heavy',
    age: 24,
    racesUsed: 48,
    avgPosition: 4.8,
    trend: 'declining',
    recommendation: 'Replace before championship',
    costBenefit: 'Critical - losing 1.2 positions',
  },
];

// Venue-Specific Setups
const VENUE_SETUPS: VenueSetup[] = [
  {
    venue: 'RHKYC',
    setup: 'DNJ-2024 Light',
    avgPosition: 3.0,
    races: 12,
  },
  {
    venue: 'Aberdeen',
    setup: 'DNS-2023 Medium',
    avgPosition: 2.8,
    races: 8,
  },
  {
    venue: 'Hebe Haven',
    setup: 'DNJ-2024 Light',
    avgPosition: 4.2,
    races: 6,
  },
  {
    venue: 'Stanley',
    setup: 'DNS-2022 Heavy',
    avgPosition: 3.5,
    races: 10,
  },
];

// Fleet Comparison
const FLEET_COMPARISON: FleetComparison[] = [
  {
    metric: 'Upwind VMG',
    yourValue: 4.8,
    fleetAvg: 4.5,
    percentile: 72,
  },
  {
    metric: 'Downwind VMG',
    yourValue: 6.2,
    fleetAvg: 6.5,
    percentile: 45,
  },
  {
    metric: 'Tacking Angle',
    yourValue: 82,
    fleetAvg: 85,
    percentile: 68,
  },
  {
    metric: 'Speed in 12kts',
    yourValue: 5.4,
    fleetAvg: 5.2,
    percentile: 78,
  },
];

export function PerformanceAnalysis({ boatId: _boatId }: PerformanceAnalysisProps) {
  const [_selectedPeriod, _setSelectedPeriod] = useState('season');

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return 'trending-up';
    if (trend === 'down') return 'trending-down';
    return 'remove';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'up') return '#10B981';
    if (trend === 'down') return '#EF4444';
    return '#64748B';
  };

  const getImpactColor = (impact: string) => {
    if (impact === 'positive') return '#10B981';
    if (impact === 'negative') return '#EF4444';
    return '#64748B';
  };

  const getInsightIcon = (type: string) => {
    if (type === 'recommendation') return 'bulb';
    if (type === 'warning') return 'warning';
    return 'information-circle';
  };

  const getInsightColor = (type: string) => {
    if (type === 'recommendation') return '#3B82F6';
    if (type === 'warning') return '#F59E0B';
    return '#64748B';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Performance Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Overview</Text>
        <View style={styles.metricsGrid}>
          {PERFORMANCE_METRICS.map((metric, index) => (
            <View key={index} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <View style={styles.trendContainer}>
                  <Ionicons
                    name={getTrendIcon(metric.trend)}
                    size={16}
                    color={getTrendColor(metric.trend)}
                  />
                  <Text
                    style={[
                      styles.trendText,
                      { color: getTrendColor(metric.trend) },
                    ]}
                  >
                    {metric.change}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* AI Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Insights</Text>
        {AI_INSIGHTS.map((insight) => (
          <View
            key={insight.id}
            style={[
              styles.insightCard,
              { borderLeftColor: getInsightColor(insight.type) },
            ]}
          >
            <View style={styles.insightHeader}>
              <Ionicons
                name={getInsightIcon(insight.type)}
                size={20}
                color={getInsightColor(insight.type)}
              />
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceText}>
                  {insight.confidence}% confidence
                </Text>
              </View>
            </View>
            <Text style={styles.insightMessage}>{insight.message}</Text>
          </View>
        ))}
      </View>

      {/* Equipment Correlation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Equipment Performance</Text>
        <Text style={styles.sectionSubtitle}>
          Sail combinations ranked by average finish
        </Text>
        {EQUIPMENT_CORRELATIONS.map((item, index) => (
          <View key={index} style={styles.correlationCard}>
            <View style={styles.correlationHeader}>
              <View style={styles.correlationRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.correlationInfo}>
                <Text style={styles.equipmentName}>{item.equipment}</Text>
                <Text style={styles.equipmentMeta}>
                  {item.races} races • {item.winRate} win rate
                </Text>
              </View>
              <View
                style={[
                  styles.impactDot,
                  { backgroundColor: getImpactColor(item.impact) },
                ]}
              />
            </View>
            <View style={styles.correlationStats}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Avg Finish</Text>
                <Text
                  style={[
                    styles.statValue,
                    { color: getImpactColor(item.impact) },
                  ]}
                >
                  {item.avgFinish.toFixed(1)}
                </Text>
              </View>
              <View style={styles.performanceBar}>
                <View
                  style={[
                    styles.performanceBarFill,
                    {
                      width: `${(1 / item.avgFinish) * 100}%`,
                      backgroundColor: getImpactColor(item.impact),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Wind Conditions Analysis */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wind Conditions Analysis</Text>
        {WIND_ANALYSIS.map((wind, index) => (
          <View key={index} style={styles.windCard}>
            <View style={styles.windHeader}>
              <Ionicons name="speedometer" size={20} color="#3B82F6" />
              <Text style={styles.windRange}>{wind.range}</Text>
              <Text style={styles.windRaces}>{wind.races} races</Text>
            </View>
            <View style={styles.windStats}>
              <View style={styles.windStat}>
                <Text style={styles.windStatLabel}>Avg Finish</Text>
                <Text
                  style={[
                    styles.windStatValue,
                    {
                      color:
                        wind.avgFinish < 3
                          ? '#10B981'
                          : wind.avgFinish < 4
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                >
                  {wind.avgFinish.toFixed(1)}
                </Text>
              </View>
              <View style={styles.windSail}>
                <Ionicons name="fish" size={14} color="#64748B" />
                <Text style={styles.windSailText}>{wind.bestSail}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Sail Performance Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sail Performance Breakdown</Text>
        <Text style={styles.sectionSubtitle}>
          Each sail combination's performance across races
        </Text>
        {SAIL_PERFORMANCE.map((sail, index) => (
          <View key={index} style={styles.sailCard}>
            <View style={styles.sailHeader}>
              <Text style={styles.sailName}>{sail.sailCombination}</Text>
              <View style={styles.effectivenessChip}>
                <Text style={styles.effectivenessText}>
                  {sail.effectiveness}% effective
                </Text>
              </View>
            </View>
            <View style={styles.sailMetrics}>
              <View style={styles.sailMetric}>
                <Text style={styles.sailMetricLabel}>Races Used</Text>
                <Text style={styles.sailMetricValue}>{sail.racesUsed}</Text>
              </View>
              <View style={styles.sailMetric}>
                <Text style={styles.sailMetricLabel}>Avg Position</Text>
                <Text style={[styles.sailMetricValue, {
                  color: sail.avgPosition < 3 ? '#10B981' : sail.avgPosition < 4 ? '#F59E0B' : '#EF4444'
                }]}>
                  {sail.avgPosition.toFixed(1)}
                </Text>
              </View>
              <View style={styles.sailMetric}>
                <Text style={styles.sailMetricLabel}>Conditions</Text>
                <Text style={styles.sailMetricValue}>{sail.conditions}</Text>
              </View>
            </View>
            <View style={styles.bestInContainer}>
              <Ionicons name="trophy" size={14} color="#F59E0B" />
              <Text style={styles.bestInText}>Best in: {sail.bestIn}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Setup Optimization Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Setup Optimization Chart</Text>
        <Text style={styles.sectionSubtitle}>
          Wind speed vs average position by sail combination
        </Text>
        <VictoryChart
          width={Dimensions.get('window').width - 48}
          height={300}
          theme={VictoryTheme.material}
          containerComponent={
            <VictoryVoronoiContainer
              labels={({ datum }) => `${datum.sail}\n${datum.windSpeed}kts: ${datum.avgPosition.toFixed(1)}`}
            />
          }
        >
          <VictoryAxis
            label="Wind Speed (kts)"
            style={{
              axisLabel: { padding: 30, fontSize: 12 },
              tickLabels: { fontSize: 10 },
            }}
          />
          <VictoryAxis
            dependentAxis
            label="Avg Position"
            style={{
              axisLabel: { padding: 35, fontSize: 12 },
              tickLabels: { fontSize: 10 },
            }}
          />
          <VictoryLegend
            x={20}
            y={10}
            orientation="horizontal"
            gutter={20}
            style={{ border: { stroke: 'transparent' } }}
            data={[
              { name: 'Light', symbol: { fill: '#3B82F6' } },
              { name: 'Medium', symbol: { fill: '#10B981' } },
              { name: 'Heavy', symbol: { fill: '#EF4444' } },
            ]}
          />
          {['DNJ-2024 Light', 'DNS-2023 Medium', 'DNS-2022 Heavy'].map((sailType, idx) => (
            <VictoryLine
              key={sailType}
              data={SETUP_OPTIMIZATION.filter((d) => d.sail === sailType)}
              x="windSpeed"
              y="avgPosition"
              style={{
                data: {
                  stroke: idx === 0 ? '#3B82F6' : idx === 1 ? '#10B981' : '#EF4444',
                  strokeWidth: 2,
                },
              }}
            />
          ))}
          {['DNJ-2024 Light', 'DNS-2023 Medium', 'DNS-2022 Heavy'].map((sailType, idx) => (
            <VictoryScatter
              key={`scatter-${sailType}`}
              data={SETUP_OPTIMIZATION.filter((d) => d.sail === sailType)}
              x="windSpeed"
              y="avgPosition"
              size={5}
              style={{
                data: {
                  fill: idx === 0 ? '#3B82F6' : idx === 1 ? '#10B981' : '#EF4444',
                },
              }}
              labels={({ datum: _datum }) => ''}
              labelComponent={<VictoryTooltip />}
            />
          ))}
        </VictoryChart>
      </View>

      {/* Maintenance Correlation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Maintenance Correlation</Text>
        <Text style={styles.sectionSubtitle}>
          Performance trends over sail age with service recommendations
        </Text>
        {MAINTENANCE_CORRELATION.map((item, index) => (
          <View key={index} style={styles.maintenanceCard}>
            <View style={styles.maintenanceHeader}>
              <View style={styles.maintenanceInfo}>
                <Text style={styles.maintenanceSail}>{item.sail}</Text>
                <Text style={styles.maintenanceMeta}>
                  {item.age} months old • {item.racesUsed} races
                </Text>
              </View>
              <View
                style={[
                  styles.trendBadge,
                  {
                    backgroundColor:
                      item.trend === 'declining'
                        ? '#FEE2E2'
                        : item.trend === 'stable'
                        ? '#DBEAFE'
                        : '#D1FAE5',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.trendBadgeText,
                    {
                      color:
                        item.trend === 'declining'
                          ? '#DC2626'
                          : item.trend === 'stable'
                          ? '#2563EB'
                          : '#059669',
                    },
                  ]}
                >
                  {item.trend}
                </Text>
              </View>
            </View>
            <View style={styles.maintenanceStats}>
              <View style={styles.maintenanceStat}>
                <Text style={styles.maintenanceStatLabel}>Avg Position</Text>
                <Text
                  style={[
                    styles.maintenanceStatValue,
                    {
                      color:
                        item.avgPosition < 3
                          ? '#10B981'
                          : item.avgPosition < 4
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                >
                  {item.avgPosition.toFixed(1)}
                </Text>
              </View>
            </View>
            <View style={styles.recommendationBox}>
              <Ionicons name="information-circle" size={16} color="#3B82F6" />
              <View style={{ flex: 1 }}>
                <Text style={styles.recommendationText}>{item.recommendation}</Text>
                <Text style={styles.costBenefitText}>{item.costBenefit}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Venue-Specific Setups */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Venue-Specific Setups</Text>
        <Text style={styles.sectionSubtitle}>
          What equipment works best at each venue
        </Text>
        {VENUE_SETUPS.map((venue, index) => (
          <View key={index} style={styles.venueCard}>
            <View style={styles.venueHeader}>
              <Ionicons name="location" size={20} color="#3B82F6" />
              <Text style={styles.venueName}>{venue.venue}</Text>
              <Text style={styles.venueRaces}>{venue.races} races</Text>
            </View>
            <View style={styles.venueInfo}>
              <View style={styles.venueSetup}>
                <Ionicons name="fish" size={16} color="#64748B" />
                <Text style={styles.venueSetupText}>{venue.setup}</Text>
              </View>
              <View style={styles.venuePosition}>
                <Text style={styles.venuePositionLabel}>Avg Position:</Text>
                <Text
                  style={[
                    styles.venuePositionValue,
                    {
                      color:
                        venue.avgPosition < 3
                          ? '#10B981'
                          : venue.avgPosition < 4
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                >
                  {venue.avgPosition.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Fleet Comparison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fleet Comparison</Text>
        <Text style={styles.sectionSubtitle}>
          Your performance vs fleet average
        </Text>
        {FLEET_COMPARISON.map((metric, index) => (
          <View key={index} style={styles.comparisonCard}>
            <Text style={styles.comparisonMetric}>{metric.metric}</Text>
            <View style={styles.comparisonBars}>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>You</Text>
                <View style={styles.comparisonBarContainer}>
                  <View
                    style={[
                      styles.comparisonBar,
                      {
                        width: `${metric.percentile}%`,
                        backgroundColor:
                          metric.yourValue > metric.fleetAvg ? '#10B981' : '#EF4444',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.comparisonValue}>{metric.yourValue.toFixed(1)}</Text>
              </View>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Fleet Avg</Text>
                <View style={styles.comparisonBarContainer}>
                  <View
                    style={[
                      styles.comparisonBar,
                      { width: '50%', backgroundColor: '#94A3B8' },
                    ]}
                  />
                </View>
                <Text style={styles.comparisonValue}>{metric.fleetAvg.toFixed(1)}</Text>
              </View>
            </View>
            <View style={styles.percentileContainer}>
              <Text style={styles.percentileText}>
                You're in the {metric.percentile}th percentile
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Enhanced AI Recommendations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Equipment Recommendations</Text>
        <View style={styles.aiRecommendationBox}>
          <Ionicons name="sparkles" size={24} color="#3B82F6" />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiRecommendationTitle}>
              Keep DNJ-2024 Light for 6-12kt conditions
            </Text>
            <Text style={styles.aiRecommendationText}>
              This sail shows excellent performance in light air, averaging 2.3 position.
              Your best results are in 8-10 knots.
            </Text>
          </View>
        </View>
        <View style={[styles.aiRecommendationBox, { borderLeftColor: '#F59E0B' }]}>
          <Ionicons name="warning" size={24} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiRecommendationTitle}>
              Consider servicing DNS-2023 soon
            </Text>
            <Text style={styles.aiRecommendationText}>
              Performance declining after 35 races. Service within 10 races to prevent 0.5
              position loss.
            </Text>
          </View>
        </View>
        <View style={[styles.aiRecommendationBox, { borderLeftColor: '#10B981' }]}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiRecommendationTitle}>Your upwind setup is optimal</Text>
            <Text style={styles.aiRecommendationText}>
              Your upwind VMG is 6.7% above fleet average. Current equipment configuration
              is working well.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  insightCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 8,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  insightTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  confidenceBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  insightMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  correlationCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  correlationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  correlationRank: {
    width: 32,
    height: 32,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  correlationInfo: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  equipmentMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  impactDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  correlationStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statBox: {
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  performanceBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  performanceBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  windCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  windHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  windRange: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  windRaces: {
    fontSize: 12,
    color: '#64748B',
  },
  windStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  windStat: {
    alignItems: 'center',
    gap: 2,
  },
  windStatLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  windStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  windSail: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 6,
  },
  windSailText: {
    fontSize: 12,
    color: '#475569',
  },
  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 12,
  },
  chartPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  chartPlaceholderSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  // Sail Performance Breakdown styles
  sailCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sailName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  effectivenessChip: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  effectivenessText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
  sailMetrics: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  sailMetric: {
    flex: 1,
  },
  sailMetricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  sailMetricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  bestInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 6,
  },
  bestInText: {
    fontSize: 12,
    color: '#92400E',
  },
  // Maintenance Correlation styles
  maintenanceCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  maintenanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  maintenanceInfo: {
    flex: 1,
  },
  maintenanceSail: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  maintenanceMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  trendBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  maintenanceStats: {
    marginBottom: 12,
  },
  maintenanceStat: {
    alignItems: 'center',
    gap: 4,
  },
  maintenanceStatLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  maintenanceStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  recommendationBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 6,
  },
  recommendationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  costBenefitText: {
    fontSize: 12,
    color: '#64748B',
  },
  // Venue-Specific Setup styles
  venueCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  venueName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  venueRaces: {
    fontSize: 12,
    color: '#64748B',
  },
  venueInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  venueSetup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  venueSetupText: {
    fontSize: 12,
    color: '#475569',
  },
  venuePosition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  venuePositionLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  venuePositionValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Fleet Comparison styles
  comparisonCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  comparisonMetric: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 10,
  },
  comparisonBars: {
    gap: 8,
    marginBottom: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comparisonLabel: {
    width: 70,
    fontSize: 12,
    color: '#64748B',
  },
  comparisonBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  comparisonBar: {
    height: '100%',
    borderRadius: 4,
  },
  comparisonValue: {
    width: 50,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },
  percentileContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  percentileText: {
    fontSize: 12,
    color: '#64748B',
  },
  // AI Recommendations styles
  aiRecommendationBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    marginBottom: 10,
  },
  aiRecommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  aiRecommendationText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
});
