/**
 * Educational Strategy Demo Component
 * Demonstrates the enhanced AI system leveraging yacht club educational content
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSailingEducation, useVenueSailingEducation } from '@/hooks/useSailingEducation';

interface EducationalStrategyDemoProps {
  venueId?: string;
}

export const EducationalStrategyDemo: React.FC<EducationalStrategyDemoProps> = ({
  venueId = 'hong-kong'
}) => {
  const [selectedQuery, setSelectedQuery] = useState<string>('');
  const {
    loading,
    error,
    enhancedStrategy,
    knowledgeBaseStats,
    getEducationalStrategy,
    clearError,
  } = useSailingEducation(venueId);

  const {
    venueInsights,
  } = useVenueSailingEducation(venueId);

  const sampleQueries = [
    {
      title: 'Dragon Class Racing Tactics',
      query: 'What are the key tactical considerations for Dragon class racing in Hong Kong?',
      context: { raceType: 'fleet_racing', boatClass: 'Dragon', conditions: 'moderate_wind' },
    },
    {
      title: 'Safety Protocols for Monsoon Season',
      query: 'What safety protocols should international crews follow during monsoon season racing?',
      context: { season: 'monsoon', safety: 'offshore', international: true },
    },
    {
      title: 'Cultural Protocols at RHKYC',
      query: 'What cultural protocols should international sailors observe at Hong Kong yacht clubs?',
      context: { venue: 'hong-kong', cultural: 'yacht_club', international: true },
    },
    {
      title: 'Commercial Traffic Management',
      query: 'How should racing sailors manage commercial shipping traffic in Hong Kong harbor?',
      context: { venue: 'hong-kong', traffic: 'commercial', safety: 'navigation' },
    },
  ];

  const handleQuerySelect = async (query: string, context?: any) => {
    setSelectedQuery(query);
    clearError();
    await getEducationalStrategy(query, venueId, context);
  };

  const renderStrategySection = (
    title: string,
    items: any[],
    renderItem: (item: any, index: number) => React.ReactNode
  ) => {
    if (!items || items.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {items.map(renderItem)}
        </View>
      </View>
    );
  };

  const renderInsight = (insight: any, index: number) => (
    <View key={index} style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <Text style={styles.insightTitle}>{insight.title}</Text>
        <View style={[styles.confidenceBadge, { opacity: insight.confidence || 0.8 }]}>
          <Text style={styles.confidenceText}>
            {Math.round((insight.confidence || 0.8) * 100)}%
          </Text>
        </View>
      </View>
      <Text style={styles.insightDescription}>{insight.description}</Text>
      <Text style={styles.tacticalAdvice}>💡 {insight.tacticalAdvice}</Text>
      {insight.educationalValue && (
        <Text style={styles.educationalValue}>📚 {insight.educationalValue}</Text>
      )}
    </View>
  );

  const renderSafetyProtocol = (protocol: any, index: number) => (
    <View key={index} style={styles.protocolCard}>
      <View style={styles.protocolHeader}>
        <Text style={styles.protocolTitle}>{protocol.requirement}</Text>
        <View style={[styles.importanceBadge,
          { backgroundColor: protocol.importance === 'mandatory' ? '#FF6B6B' : '#4ECDC4' }
        ]}>
          <Text style={styles.importanceText}>{protocol.importance}</Text>
        </View>
      </View>
      {protocol.compliance && (
        <Text style={styles.complianceText}>⚖️ {protocol.compliance}</Text>
      )}
    </View>
  );

  const renderCulturalProtocol = (protocol: any, index: number) => (
    <View key={index} style={styles.culturalCard}>
      <Text style={styles.culturalSituation}>{protocol.situation}</Text>
      <Text style={styles.culturalBehavior}>✅ {protocol.expectedBehavior}</Text>
      {protocol.regionalContext && (
        <Text style={styles.regionalContext}>🌏 {protocol.regionalContext}</Text>
      )}
    </View>
  );

  const renderEquipmentRecommendation = (equipment: any, index: number) => (
    <View key={index} style={styles.equipmentCard}>
      <View style={styles.equipmentHeader}>
        <Text style={styles.equipmentItem}>{equipment.item}</Text>
        <View style={[styles.priorityBadge,
          { backgroundColor: equipment.priority === 'essential' ? '#FF6B6B' :
                            equipment.priority === 'recommended' ? '#4ECDC4' : '#95A5A6' }
        ]}>
          <Text style={styles.priorityText}>{equipment.priority}</Text>
        </View>
      </View>
      <Text style={styles.equipmentReasoning}>{equipment.reasoning}</Text>
    </View>
  );

  const renderCompetitiveIntelligence = (intelligence: any, index: number) => (
    <View key={index} style={styles.intelligenceCard}>
      <Text style={styles.intelligenceInsight}>🎯 {intelligence.insight}</Text>
      <View style={styles.intelligenceFooter}>
        <Text style={styles.strategicValue}>Value: {intelligence.strategicValue}</Text>
        <Text style={styles.applicability}>
          {intelligence.applicability?.join(', ') || 'General'}
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎓 Sailing Education Demo</Text>
        <Text style={styles.subtitle}>
          Enhanced with Yacht Club Training Standards
        </Text>
      </View>

      {/* Knowledge Base Stats */}
      {knowledgeBaseStats && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>📊 Knowledge Base</Text>
          <Text style={styles.statsText}>
            {knowledgeBaseStats.totalResources} Educational Resources
          </Text>
          <Text style={styles.statsText}>
            {knowledgeBaseStats.venuesWithInsights} Venues with Insights
          </Text>
        </View>
      )}

      {/* Query Selection */}
      <View style={styles.queryContainer}>
        <Text style={styles.queryTitle}>Sample Educational Queries:</Text>
        {sampleQueries.map((sample, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.queryButton, selectedQuery === sample.query && styles.selectedQuery]}
            onPress={() => handleQuerySelect(sample.query, sample.context)}
          >
            <Text style={styles.queryButtonText}>{sample.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🧠 Generating educational strategy...</Text>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      )}

      {/* Enhanced Strategy Results */}
      {enhancedStrategy && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>📚 Educational Strategy Results</Text>

          {/* Educational Value */}
          {enhancedStrategy.educationalValue && (
            <View style={styles.educationalValueContainer}>
              <Text style={styles.educationalValueTitle}>🎓 Educational Framework</Text>
              {enhancedStrategy.educationalValue.map((value, index) => (
                <Text key={index} style={styles.educationalValueItem}>
                  • {value}
                </Text>
              ))}
            </View>
          )}

          {/* Tactical Insights */}
          {renderStrategySection(
            '🎯 Tactical Insights',
            enhancedStrategy.insights,
            renderInsight
          )}

          {/* Safety Protocols */}
          {renderStrategySection(
            '🛡️ Safety Protocols',
            enhancedStrategy.safetyConsiderations,
            renderSafetyProtocol
          )}

          {/* Cultural Protocols */}
          {renderStrategySection(
            '🌏 Cultural Protocols',
            enhancedStrategy.culturalProtocols,
            renderCulturalProtocol
          )}

          {/* Equipment Recommendations */}
          {renderStrategySection(
            '⚙️ Equipment Recommendations',
            enhancedStrategy.equipmentRecommendations,
            renderEquipmentRecommendation
          )}

          {/* Competitive Intelligence */}
          {renderStrategySection(
            '🧠 Competitive Intelligence',
            enhancedStrategy.competitiveAdvantages,
            renderCompetitiveIntelligence
          )}
        </View>
      )}

      {/* Venue Insights Preview */}
      {venueInsights && (
        <View style={styles.venueInsightsContainer}>
          <Text style={styles.venueInsightsTitle}>
            🏆 {venueId} Educational Insights
          </Text>
          <Text style={styles.venueInsightsStats}>
            {venueInsights.tacticalKnowledge?.length ?? 0} Tactical Insights • {' '}
            {venueInsights.safetyStandards?.length ?? 0} Safety Standards • {' '}
            {venueInsights.racingProtocols?.length ?? 0} Cultural Protocols
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#2C3E50',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#BDC3C7',
    marginTop: 5,
    textAlign: 'center',
  },
  statsContainer: {
    backgroundColor: '#ECF0F1',
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  queryContainer: {
    margin: 16,
  },
  queryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  queryButton: {
    backgroundColor: '#3498DB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedQuery: {
    backgroundColor: '#2980B9',
  },
  queryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#D5DBDB',
    borderRadius: 8,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FADBD8',
    borderRadius: 8,
  },
  errorText: {
    color: '#C0392B',
    fontSize: 14,
  },
  resultsContainer: {
    margin: 16,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2C3E50',
  },
  educationalValueContainer: {
    backgroundColor: '#EBF5FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  educationalValueTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2980B9',
  },
  educationalValueItem: {
    fontSize: 14,
    color: '#34495E',
    marginBottom: 4,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2C3E50',
  },
  sectionContent: {
    gap: 8,
  },
  insightCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    boxShadow: '0px 2px',
    elevation: 2,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    color: '#2C3E50',
  },
  confidenceBadge: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  insightDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 8,
  },
  tacticalAdvice: {
    fontSize: 14,
    color: '#E67E22',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  educationalValue: {
    fontSize: 12,
    color: '#8E44AD',
    fontStyle: 'italic',
  },
  protocolCard: {
    backgroundColor: '#FEF9E7',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  protocolTitle: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    color: '#2C3E50',
  },
  importanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  importanceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  complianceText: {
    fontSize: 12,
    color: '#7F8C8D',
    fontStyle: 'italic',
  },
  culturalCard: {
    backgroundColor: '#F0F8F0',
    padding: 16,
    borderRadius: 8,
  },
  culturalSituation: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 8,
  },
  culturalBehavior: {
    fontSize: 14,
    color: '#27AE60',
    marginBottom: 4,
  },
  regionalContext: {
    fontSize: 12,
    color: '#7F8C8D',
    fontStyle: 'italic',
  },
  equipmentCard: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 8,
  },
  equipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  equipmentItem: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    color: '#2C3E50',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  equipmentReasoning: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  intelligenceCard: {
    backgroundColor: '#F5F3FF',
    padding: 16,
    borderRadius: 8,
  },
  intelligenceInsight: {
    fontSize: 14,
    color: '#2C3E50',
    marginBottom: 8,
  },
  intelligenceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strategicValue: {
    fontSize: 12,
    color: '#8E44AD',
    fontWeight: '500',
  },
  applicability: {
    fontSize: 12,
    color: '#7F8C8D',
    fontStyle: 'italic',
  },
  venueInsightsContainer: {
    backgroundColor: '#E8F6F3',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  venueInsightsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E8449',
    marginBottom: 8,
  },
  venueInsightsStats: {
    fontSize: 14,
    color: '#27AE60',
  },
});

export default EducationalStrategyDemo;
