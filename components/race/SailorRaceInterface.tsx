import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';

interface RaceEvent {
  id: string;
  name: string;
  venue: string;
  date: string;
  status: 'upcoming' | 'active' | 'completed';
  hasStrategy: boolean;
  venueIntelligence?: any;
}

export function SailorRaceInterface() {
  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'strategy' | 'results' | 'venues'>('upcoming');

  // Mock race data for sailors
  const mockRaces: RaceEvent[] = [
    {
      id: '1',
      name: 'Spring Championship',
      venue: 'Royal Hong Kong Yacht Club',
      date: '2025-03-15',
      status: 'upcoming',
      hasStrategy: false
    },
    {
      id: '2',
      name: 'Wednesday Evening Series Race 3',
      venue: 'Victoria Harbor',
      date: '2025-02-28',
      status: 'active',
      hasStrategy: true
    },
    {
      id: '3',
      name: 'Dragon Masters Championship',
      venue: 'Deep Water Bay',
      date: '2025-02-20',
      status: 'completed',
      hasStrategy: true
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming': return '📅';
      case 'active': return '🏁';
      case 'completed': return '🏆';
      default: return '⛵';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return '#3B82F6';
      case 'active': return '#22C55E';
      case 'completed': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const TabButton = ({
    id,
    label,
    active
  }: {
    id: typeof selectedTab;
    label: string;
    active: boolean
  }) => (
    <Button
      variant={active ? "default" : "outline"}
      onPress={() => setSelectedTab(id)}
      style={styles.tabButton}
    >
      <ThemedText type="defaultSemiBold" style={{
        color: active ? '#fff' : '#0066CC'
      }}>
        {label}
      </ThemedText>
    </Button>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title">⛵ My Races</ThemedText>
        <ThemedText type="subtitle">Race strategy and venue intelligence</ThemedText>
      </View>

      {/* Tab Navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabContainer}
        contentContainerStyle={styles.tabContent}
      >
        <TabButton id="upcoming" label="📅 Upcoming" active={selectedTab === 'upcoming'} />
        <TabButton id="strategy" label="🧠 Strategy" active={selectedTab === 'strategy'} />
        <TabButton id="results" label="🏆 Results" active={selectedTab === 'results'} />
        <TabButton id="venues" label="🌍 Venues" active={selectedTab === 'venues'} />
      </ScrollView>

      {/* Content Area */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {selectedTab === 'upcoming' && (
          <View style={styles.sectionContainer}>
            <ThemedText style={styles.sectionTitle}>📅 Upcoming Races</ThemedText>

            {mockRaces.filter(race => race.status === 'upcoming' || race.status === 'active').map((race) => (
              <View key={race.id} style={styles.raceCard}>
                <View style={styles.raceHeader}>
                  <View style={styles.raceInfo}>
                    <ThemedText style={styles.raceName}>
                      {getStatusIcon(race.status)} {race.name}
                    </ThemedText>
                    <ThemedText style={styles.raceVenue}>📍 {race.venue}</ThemedText>
                    <ThemedText style={styles.raceDate}>📅 {new Date(race.date).toLocaleDateString()}</ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(race.status) }]}>
                    <ThemedText style={styles.statusText}>
                      {race.status.charAt(0).toUpperCase() + race.status.slice(1)}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.raceActions}>
                  <Button
                    variant={race.hasStrategy ? "default" : "outline"}
                    style={styles.actionButton}
                    onPress={() => {}}
                  >
                    <ThemedText style={{ color: race.hasStrategy ? '#fff' : '#0066CC' }}>
                      {race.hasStrategy ? '✏️ Edit Strategy' : '🧠 Create Strategy'}
                    </ThemedText>
                  </Button>

                  <Button
                    variant="outline"
                    style={styles.actionButton}
                    onPress={() => {}}
                  >
                    <ThemedText style={{ color: '#0066CC' }}>🌍 Venue Intel</ThemedText>
                  </Button>
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'strategy' && (
          <View style={styles.sectionContainer}>
            <ThemedText style={styles.sectionTitle}>🧠 Race Strategy</ThemedText>

            <View style={styles.strategyCard}>
              <ThemedText style={styles.cardTitle}>🎯 Strategy Planning</ThemedText>
              <ThemedText style={styles.cardDescription}>
                Race strategy based on venue intelligence, weather forecasts, and your performance history
              </ThemedText>

              <View style={styles.strategyFeatures}>
                <View style={styles.featureItem}>
                  <ThemedText style={styles.featureIcon}>📄</ThemedText>
                  <View style={styles.featureContent}>
                    <ThemedText style={styles.featureTitle}>Document Analysis</ThemedText>
                    <ThemedText style={styles.featureDescription}>
                      Upload sailing instructions for course analysis
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <ThemedText style={styles.featureIcon}>🌊</ThemedText>
                  <View style={styles.featureContent}>
                    <ThemedText style={styles.featureTitle}>Weather Integration</ThemedText>
                    <ThemedText style={styles.featureDescription}>
                      Real-time conditions and tactical recommendations
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <ThemedText style={styles.featureIcon}>🎯</ThemedText>
                  <View style={styles.featureContent}>
                    <ThemedText style={styles.featureTitle}>Venue Intelligence</ThemedText>
                    <ThemedText style={styles.featureDescription}>
                      Local knowledge and racing patterns for each venue
                    </ThemedText>
                  </View>
                </View>
              </View>

              <Button style={styles.primaryButton} onPress={() => {}}>
                <ThemedText style={{ color: '#fff' }}>🚀 Start Strategy Planning</ThemedText>
              </Button>
            </View>
          </View>
        )}

        {selectedTab === 'results' && (
          <View style={styles.sectionContainer}>
            <ThemedText style={styles.sectionTitle}>🏆 Race Results</ThemedText>

            {mockRaces.filter(race => race.status === 'completed').map((race) => (
              <View key={race.id} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <ThemedText style={styles.resultName}>{race.name}</ThemedText>
                  <ThemedText style={styles.resultVenue}>{race.venue}</ThemedText>
                </View>

                <View style={styles.resultStats}>
                  <View style={styles.statItem}>
                    <ThemedText style={styles.statValue}>3rd</ThemedText>
                    <ThemedText style={styles.statLabel}>Overall</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={styles.statValue}>2nd</ThemedText>
                    <ThemedText style={styles.statLabel}>In Class</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={styles.statValue}>+2.5%</ThemedText>
                    <ThemedText style={styles.statLabel}>vs Target</ThemedText>
                  </View>
                </View>

                <Button variant="outline" style={styles.analysisButton} onPress={() => {}}>
                  <ThemedText style={{ color: '#0066CC' }}>📊 View Analysis</ThemedText>
                </Button>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'venues' && (
          <View style={styles.sectionContainer}>
            <ThemedText style={styles.sectionTitle}>🌍 Venue Intelligence</ThemedText>

            <View style={styles.venueCard}>
              <ThemedText style={styles.cardTitle}>🏝️ Global Sailing Venues</ThemedText>
              <ThemedText style={styles.cardDescription}>
                Comprehensive intelligence for 147+ sailing venues worldwide
              </ThemedText>

              <View style={styles.venueFeatures}>
                <View style={styles.venueFeature}>
                  <ThemedText style={styles.venueFeatureIcon}>📍</ThemedText>
                  <ThemedText style={styles.venueFeatureText}>Local Racing Conditions</ThemedText>
                </View>
                <View style={styles.venueFeature}>
                  <ThemedText style={styles.venueFeatureIcon}>🌊</ThemedText>
                  <ThemedText style={styles.venueFeatureText}>Tide & Current Patterns</ThemedText>
                </View>
                <View style={styles.venueFeature}>
                  <ThemedText style={styles.venueFeatureIcon}>🏆</ThemedText>
                  <ThemedText style={styles.venueFeatureText}>Historical Race Data</ThemedText>
                </View>
                <View style={styles.venueFeature}>
                  <ThemedText style={styles.venueFeatureIcon}>🗺️</ThemedText>
                  <ThemedText style={styles.venueFeatureText}>Cultural & Protocol Guide</ThemedText>
                </View>
              </View>

              <Button style={styles.primaryButton} onPress={() => {}}>
                <ThemedText style={{ color: '#fff' }}>🗺️ Explore Venues</ThemedText>
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  raceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    boxShadow: '0px 1px',
    gap: 12,
  },
  raceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  raceInfo: {
    flex: 1,
    gap: 4,
  },
  raceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  raceVenue: {
    fontSize: 14,
    color: '#6B7280',
  },
  raceDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  raceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  strategyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    boxShadow: '0px 1px',
    gap: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  strategyFeatures: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  featureContent: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
  },
  featureDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  primaryButton: {
    backgroundColor: '#0066CC',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    boxShadow: '0px 1px',
    gap: 12,
  },
  resultHeader: {
    gap: 4,
  },
  resultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  resultVenue: {
    fontSize: 14,
    color: '#6B7280',
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  analysisButton: {
    alignSelf: 'flex-start',
  },
  venueCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    boxShadow: '0px 1px',
    gap: 16,
  },
  venueFeatures: {
    gap: 12,
  },
  venueFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  venueFeatureIcon: {
    fontSize: 16,
    width: 20,
  },
  venueFeatureText: {
    fontSize: 14,
    color: '#374151',
  },
});