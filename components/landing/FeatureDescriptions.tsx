/**
 * Feature Descriptions Component
 * Displays feature descriptions in a two-column layout around the demo
 * Similar to OnX Maps landing page design
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type FeatureId =
  | 'race-planning'
  | 'race-day-conditions'
  | 'ai-strategy'
  | 'ai-rig-tuning'
  | 'gps-tracking'
  | 'post-race-analysis'
  | 'real-coaches'
  | 'venue-intelligence'
  | 'fleet-sharing'
  | 'learning-academy'
  | 'yacht-club-integration';

interface Feature {
  id: FeatureId;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface FeatureDescriptionsProps {
  /** Currently highlighted feature */
  highlightedFeature?: FeatureId | null;
  /** Callback when a feature is clicked */
  onFeatureClick: (featureId: FeatureId, raceId?: string, sectionId?: string) => void;
  /** Which column to display (left or right) */
  column: 'left' | 'right';
  /** Currently zoomed feature */
  zoomedFeature?: FeatureId | null;
  /** Callback when a feature is zoomed */
  onFeatureZoom?: (featureId: FeatureId | null) => void;
}

// Left column features - Reduced to 4 most important
const LEFT_FEATURES: Feature[] = [
  {
    id: 'race-planning',
    title: 'Race Planning',
    description: 'Plan your races with comprehensive tools for course setup, timing, crew management, and logistics.',
    icon: 'calendar-outline',
  },
  {
    id: 'race-day-conditions',
    title: 'Race Day Conditions',
    description: 'Get real-time weather, wind, and tide data for your race venue with accurate forecasts.',
    icon: 'cloud-outline',
  },
  {
    id: 'ai-strategy',
    title: 'Strategy Recommendations',
    description: 'Receive intelligent race strategy suggestions for starts, upwind legs, and mark roundings.',
    icon: 'bulb-outline',
  },
  {
    id: 'post-race-analysis',
    title: 'Post Race Analysis',
    description: 'Analyze your race performance with insights on tactics and boat handling.',
    icon: 'analytics-outline',
  },
];

// Right column features - Reduced to 4 most important
const RIGHT_FEATURES: Feature[] = [
  {
    id: 'real-coaches',
    title: 'Real Coaches You Can Pay to Help',
    description: 'Connect with professional sailing coaches for personalized guidance and expert advice.',
    icon: 'people-outline',
  },
  {
    id: 'venue-intelligence',
    title: 'Venue Intelligence',
    description: 'Access comprehensive venue data including wind patterns, current flows, and tactical insights.',
    icon: 'location-outline',
  },
  {
    id: 'fleet-sharing',
    title: 'Fleet Sharing Strategies',
    description: 'Share strategies and insights with your fleet. Collaborate on race planning and tactics.',
    icon: 'share-social-outline',
  },
  {
    id: 'learning-academy',
    title: 'Learning Academy',
    description: 'Access educational content, tutorials, and courses to improve your sailing skills.',
    icon: 'school-outline',
  },
];


export function FeatureDescriptions({
  highlightedFeature,
  onFeatureClick,
  column,
  zoomedFeature: _zoomedFeature,
  onFeatureZoom: _onFeatureZoom,
}: FeatureDescriptionsProps) {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;
  const features = column === 'left' ? LEFT_FEATURES : RIGHT_FEATURES;

  // Inject CSS for hover effects on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'feature-card-hover-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .feature-card-hoverable:hover {
          border-color: #3E92CC !important;
          box-shadow: 0 4px 12px rgba(62, 146, 204, 0.15) !important;
          transform: translateX(4px) !important;
        }
        .feature-card-hoverable.feature-card-highlighted:hover {
          border-color: #3E92CC !important;
          box-shadow: 0 4px 12px rgba(62, 146, 204, 0.2) !important;
        }
      `;
      document.head.appendChild(style);

      return () => {
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }
  }, []);

  const handleFeaturePress = (featureId: FeatureId) => {
    onFeatureClick(featureId);
  };

  const scrollToSection = (sectionId: string) => {
    if (Platform.OS === 'web') {
      // Find the section element within the demo container
      const section = document.getElementById(sectionId);
      if (section) {
        // Scroll to the section with smooth behavior
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const getSectionId = (featureId: FeatureId): string => {
    const sectionMap: Record<FeatureId, string> = {
      'race-planning': 'race-planning-section',
      'race-day-conditions': 'conditions-section',
      'ai-strategy': 'ai-strategy-section',
      'ai-rig-tuning': 'rig-tuning-section',
      'gps-tracking': 'gps-tracking-section',
      'post-race-analysis': 'post-race-section',
      'real-coaches': 'coach-feedback-section',
      'venue-intelligence': 'venue-intelligence-section',
      'fleet-sharing': 'fleet-sharing-section',
      'learning-academy': 'racing-academy-section',
      'yacht-club-integration': 'yacht-club-section',
    };
    return sectionMap[featureId] || '';
  };

  const getRaceId = (featureId: FeatureId): string | undefined => {
    // Map features to specific race IDs
    const raceMap: Record<FeatureId, string | undefined> = {
      'race-planning': 'demo-5', // RHKYC Around the Island Race (next race)
      'race-day-conditions': 'demo-5', // Next race
      'ai-strategy': 'demo-5', // Next race
      'ai-rig-tuning': 'demo-5', // Next race
      'gps-tracking': 'demo-2', // Wednesday Evening Series Race 3 (past race with GPS)
      'post-race-analysis': 'demo-2', // Past race
      'real-coaches': 'demo-2', // Past race
      'venue-intelligence': 'demo-5', // Next race
      'fleet-sharing': 'demo-5', // Next race
      'learning-academy': undefined, // No specific race
      'yacht-club-integration': undefined, // No specific race
    };
    return raceMap[featureId];
  };

  // On mobile, render as horizontal scroll
  if (isMobile) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mobileScrollContainer}
        style={styles.mobileScrollView}
      >
        {features.map((feature) => {
          const isHighlighted = highlightedFeature === feature.id;
          
          return (
            <TouchableOpacity
              key={feature.id}
              style={[
                styles.featureCard,
                styles.featureCardMobile,
                isHighlighted && styles.featureCardHighlighted,
              ]}
              onPress={() => {
                const raceId = getRaceId(feature.id);
                const sectionId = getSectionId(feature.id);
                handleFeaturePress(feature.id);
                onFeatureClick(feature.id, raceId, sectionId);
                setTimeout(() => {
                  scrollToSection(sectionId);
                }, 500);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.featureIconContainer}>
                <Ionicons
                  name={feature.icon}
                  size={24}
                  color="#3E92CC"
                />
              </View>
              
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, isHighlighted && styles.featureTitleHighlighted]}>
                  {feature.title}
                </Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {features.map((feature) => {
        const isHighlighted = highlightedFeature === feature.id;
        
        return (
          <TouchableOpacity
            key={feature.id}
            style={[
              styles.featureCard,
              isHighlighted && styles.featureCardHighlighted,
            ]}
            // @ts-ignore - web only className
            {...(Platform.OS === 'web' ? {
              className: `feature-card-hoverable ${isHighlighted ? 'feature-card-highlighted' : ''}`,
            } : {})}
            onPress={() => {
              const raceId = getRaceId(feature.id);
              const sectionId = getSectionId(feature.id);
              handleFeaturePress(feature.id);
              onFeatureClick(feature.id, raceId, sectionId);
              // Scroll to section after a delay to allow race card scroll to complete
              setTimeout(() => {
                scrollToSection(sectionId);
              }, 500);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.featureIconContainer}>
              <Ionicons
                name={feature.icon}
                size={24}
                color="#3E92CC"
              />
            </View>
            
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, isHighlighted && styles.featureTitleHighlighted]}>
                {feature.title}
              </Text>
              <Text style={styles.featureDescription}>
                {feature.description}
              </Text>
            </View>
            
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color="#9CA3AF" 
              style={styles.featureChevron} 
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...Platform.select({
      web: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    minHeight: 120,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxSizing: 'border-box',
        '@media (max-width: 1200px)': {
          minHeight: 100,
        },
        '@media (max-width: 480px)': {
          padding: 12,
          minHeight: 90,
        },
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  featureCardHighlighted: {
    borderColor: '#3E92CC',
    backgroundColor: '#F0F9FF',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(62, 146, 204, 0.15)',
        transform: 'translateX(4px)',
      },
      default: {
        shadowColor: '#3E92CC',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  featureContent: {
    flex: 1,
    marginRight: 8,
    minWidth: 0, // Allow text to wrap
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 20,
  },
  featureTitleHighlighted: {
    color: '#3E92CC',
  },
  featureDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  featureChevron: {
    marginTop: 4,
    flexShrink: 0,
  },
  // Mobile horizontal scroll styles
  mobileScrollView: {
    marginHorizontal: -16, // Offset container padding
  },
  mobileScrollContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  featureCardMobile: {
    width: 280,
    minHeight: 100,
    marginBottom: 0,
  },
});

