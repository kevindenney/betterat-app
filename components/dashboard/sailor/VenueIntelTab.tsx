import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DashboardSection } from '../shared';
import { createLogger } from '@/lib/utils/logger';

interface VenueData {
  id: string;
  name: string;
  country: string;
  region: string;
  confidence: number;
  culturalContext: {
    primaryLanguage: string;
    currency: string;
    protocols: string[];
  };
  racingIntelligence: {
    bestConditions: string;
    commonHazards: string[];
    localTactics: string[];
    records: {
      type: string;
      value: string;
      holder: string;
    }[];
  };
  services: {
    type: string;
    name: string;
    contact: string;
    rating: number;
  }[];
}

interface NearbyVenue {
  id: string;
  name: string;
  distance: number;
  country: string;
  hasData: boolean;
}

interface VenueIntelTabProps {
  currentVenue?: VenueData;
  nearbyVenues: NearbyVenue[];
  isDetecting: boolean;
  onVenueSelect: (venueId: string) => void;
  onForceDetection: () => void;
  onViewVenueDetails: (venueId: string) => void;
}

const logger = createLogger('VenueIntelTab');
export function VenueIntelTab({
  currentVenue,
  nearbyVenues,
  isDetecting,
  onVenueSelect,
  onForceDetection,
  onViewVenueDetails
}: VenueIntelTabProps) {
  if (isDetecting) {
    return (
      <View style={styles.detectingContainer}>
        <View style={styles.detectingContent}>
          <MaterialCommunityIcons name="radar" size={48} color="#9333ea" />
          <Text style={styles.detectingTitle}>Detecting Your Location</Text>
          <Text style={styles.detectingText}>
            Searching for nearby sailing venues to provide local intelligence...
          </Text>
        </View>
      </View>
    );
  }

  if (!currentVenue) {
    return (
      <View style={styles.container}>
        <DashboardSection title="📍 Venue Detection">
          <View style={styles.noVenueContainer}>
            <LinearGradient
              colors={['#6B7280', '#9CA3AF']}
              style={styles.noVenueGradient}
            >
              <MaterialCommunityIcons name="map-marker-question" size={48} color="#FFFFFF" />
              <Text style={styles.noVenueTitle}>No Venue Detected</Text>
              <Text style={styles.noVenueText}>
                Enable location services or manually select a venue to access local sailing intelligence
              </Text>
              <TouchableOpacity
                style={styles.detectButton}
                onPress={onForceDetection}
              >
                <MaterialCommunityIcons name="map-search" size={16} color="#6B7280" />
                <Text style={styles.detectButtonText}>Detect Location</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </DashboardSection>

        {nearbyVenues.length > 0 && (
          <DashboardSection
            title="🌊 Nearby Sailing Venues"
            subtitle="Select a venue to access local intelligence"
          >
            {nearbyVenues.map((venue) => (
              <TouchableOpacity
                key={venue.id}
                style={styles.nearbyVenueCard}
                onPress={() => onVenueSelect(venue.id)}
              >
                <View style={styles.nearbyVenueInfo}>
                  <Text style={styles.nearbyVenueName}>{venue.name}</Text>
                  <Text style={styles.nearbyVenueLocation}>
                    {venue.country} • {venue.distance}km away
                  </Text>
                </View>
                <View style={styles.nearbyVenueActions}>
                  {venue.hasData && (
                    <View style={styles.dataIndicator}>
                      <MaterialCommunityIcons name="check-circle-outline" size={16} color="#10B981" />
                      <Text style={styles.dataText}>Intel Available</Text>
                    </View>
                  )}
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
                </View>
              </TouchableOpacity>
            ))}
          </DashboardSection>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Current Venue Header */}
      <DashboardSection
        title="🏛️ Current Venue Intelligence"
        subtitle={`${currentVenue.name} • ${currentVenue.country}`}
        headerAction={{
          label: 'Change Venue',
          onPress: () => logger.debug('Change venue'),
          icon: 'swap-horizontal'
        }}
      >
        <View style={styles.venueHeader}>
          <LinearGradient
            colors={['#9333ea', '#7e22ce']}
            style={styles.venueHeaderGradient}
          >
            <View style={styles.venueHeaderInfo}>
              <Text style={styles.venueHeaderName}>{currentVenue.name}</Text>
              <Text style={styles.venueHeaderLocation}>
                {currentVenue.country} • {currentVenue.region}
              </Text>
              <Text style={styles.venueHeaderConfidence}>
                Intelligence Confidence: {Math.round(currentVenue.confidence * 100)}%
              </Text>
            </View>
            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => onViewVenueDetails(currentVenue.id)}
            >
              <MaterialCommunityIcons name="information-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </DashboardSection>

      {/* Cultural Context */}
      <DashboardSection title="🌐 Cultural Context">
        <View style={styles.culturalGrid}>
          <View style={styles.culturalCard}>
            <MaterialCommunityIcons name="translate" size={24} color="#3B82F6" />
            <Text style={styles.culturalTitle}>Language</Text>
            <Text style={styles.culturalValue}>{currentVenue.culturalContext.primaryLanguage}</Text>
          </View>
          <View style={styles.culturalCard}>
            <MaterialCommunityIcons name="currency-usd" size={24} color="#10B981" />
            <Text style={styles.culturalTitle}>Currency</Text>
            <Text style={styles.culturalValue}>{currentVenue.culturalContext.currency}</Text>
          </View>
        </View>

        <View style={styles.protocolsSection}>
          <Text style={styles.protocolsTitle}>Local Protocols</Text>
          {currentVenue.culturalContext.protocols.map((protocol, index) => (
            <View key={index} style={styles.protocolItem}>
              <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={16} color="#10B981" />
              <Text style={styles.protocolText}>{protocol}</Text>
            </View>
          ))}
        </View>
      </DashboardSection>

      {/* Racing Intelligence */}
      <DashboardSection title="⛵ Racing Intelligence">
        <View style={styles.racingIntelSection}>
          <View style={styles.conditionsCard}>
            <Text style={styles.conditionsTitle}>Best Racing Conditions</Text>
            <Text style={styles.conditionsText}>
              {currentVenue.racingIntelligence.bestConditions}
            </Text>
          </View>

          <View style={styles.hazardsSection}>
            <Text style={styles.hazardsTitle}>⚠️ Common Hazards</Text>
            {currentVenue.racingIntelligence.commonHazards.map((hazard, index) => (
              <View key={index} style={styles.hazardItem}>
                <MaterialCommunityIcons name="alert-octagon-outline" size={16} color="#F59E0B" />
                <Text style={styles.hazardText}>{hazard}</Text>
              </View>
            ))}
          </View>

          <View style={styles.tacticsSection}>
            <Text style={styles.tacticsTitle}>🧠 Local Tactics</Text>
            {currentVenue.racingIntelligence.localTactics.map((tactic, index) => (
              <View key={index} style={styles.tacticItem}>
                <MaterialCommunityIcons name="compass-rose" size={16} color="#3B82F6" />
                <Text style={styles.tacticText}>{tactic}</Text>
              </View>
            ))}
          </View>
        </View>
      </DashboardSection>

      {/* Venue Records */}
      <DashboardSection title="🏆 Venue Records">
        <View style={styles.recordsGrid}>
          {currentVenue.racingIntelligence.records.map((record, index) => (
            <View key={index} style={styles.recordCard}>
              <Text style={styles.recordType}>{record.type}</Text>
              <Text style={styles.recordValue}>{record.value}</Text>
              <Text style={styles.recordHolder}>{record.holder}</Text>
            </View>
          ))}
        </View>
      </DashboardSection>

      {/* Local Services */}
      <DashboardSection
        title="🔧 Local Services"
        subtitle="Recommended services for sailors"
      >
        {currentVenue.services.map((service, index) => (
          <View key={index} style={styles.serviceCard}>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceType}>{service.type}</Text>
              <Text style={styles.serviceContact}>{service.contact}</Text>
            </View>
            <View style={styles.serviceRating}>
              <View style={styles.ratingStars}>
                {[...Array(5)].map((_, i) => (
                  <MaterialCommunityIcons
                    key={i}
                    name={i < service.rating ? 'star' : 'star-outline'}
                    size={12}
                    color="#F59E0B"
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>{service.rating.toFixed(1)}</Text>
            </View>
          </View>
        ))}
      </DashboardSection>

      {/* Nearby Venues */}
      {nearbyVenues.length > 0 && (
        <DashboardSection
          title="🌊 Nearby Venues"
          subtitle="Other sailing venues in the area"
        >
          {nearbyVenues.slice(0, 3).map((venue) => (
            <TouchableOpacity
              key={venue.id}
              style={styles.nearbyVenueCard}
              onPress={() => onVenueSelect(venue.id)}
            >
              <View style={styles.nearbyVenueInfo}>
                <Text style={styles.nearbyVenueName}>{venue.name}</Text>
                <Text style={styles.nearbyVenueLocation}>
                  {venue.country} • {venue.distance}km away
                </Text>
              </View>
              <View style={styles.nearbyVenueActions}>
                {venue.hasData && (
                  <View style={styles.dataIndicator}>
                    <MaterialCommunityIcons name="database" size={14} color="#10B981" />
                  </View>
                )}
                <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
              </View>
            </TouchableOpacity>
          ))}
        </DashboardSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  detectingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 40,
  },
  detectingContent: {
    alignItems: 'center',
    gap: 16,
  },
  detectingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  detectingText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  noVenueContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  noVenueGradient: {
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  noVenueTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noVenueText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  detectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  venueHeader: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  venueHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  venueHeaderInfo: {
    flex: 1,
  },
  venueHeaderName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  venueHeaderLocation: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  venueHeaderConfidence: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  detailsButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  culturalGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  culturalCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  culturalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  culturalValue: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  protocolsSection: {
    gap: 8,
  },
  protocolsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  protocolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  protocolText: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  racingIntelSection: {
    gap: 16,
  },
  conditionsCard: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
  },
  conditionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  conditionsText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  hazardsSection: {
    gap: 8,
  },
  hazardsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  hazardItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },
  hazardText: {
    fontSize: 14,
    color: '#92400E',
    flex: 1,
    lineHeight: 20,
  },
  tacticsSection: {
    gap: 8,
  },
  tacticsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  tacticItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },
  tacticText: {
    fontSize: 14,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 20,
  },
  recordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recordCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recordType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  recordValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  recordHolder: {
    fontSize: 10,
    color: '#92400E',
    textAlign: 'center',
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 12,
    color: '#3B82F6',
    marginBottom: 2,
  },
  serviceContact: {
    fontSize: 12,
    color: '#64748B',
  },
  serviceRating: {
    alignItems: 'flex-end',
    gap: 4,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  nearbyVenueCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nearbyVenueInfo: {
    flex: 1,
  },
  nearbyVenueName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  nearbyVenueLocation: {
    fontSize: 12,
    color: '#64748B',
  },
  nearbyVenueActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dataIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dataText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
  },
});