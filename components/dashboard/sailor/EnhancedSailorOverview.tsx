/**
 * EnhancedSailorOverview Component
 * Comprehensive sailor dashboard with class selector, tuning guides, and crew management
 */

import { useAuth } from '@/providers/AuthProvider';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

// Import new sailor components
import { ClassSelector, CrewManagement, TuningGuidesSection } from '@/components/sailor';

// Import existing dashboard components
import { SailorOverview } from './SailorOverview';

interface EnhancedSailorOverviewProps {
  // Class data
  classes: {
    id: string;
    name: string;
    sailNumber?: string;
    boatName?: string;
    isPrimary: boolean;
    tuningGuideUrl?: string | null;
    group?: {
      id: string;
      name: string;
      ratingSystem?: string | null;
    };
  }[];
  activeClassId: string | null;
  onClassChange: (classId: string | null) => void;
  onAddBoat?: () => void;

  // Race data
  upcomingRaces: {
    id: string;
    title: string;
    venue: string;
    country: string;
    startDate: string;
    daysUntil: number;
    strategyStatus: 'ready' | 'in_progress' | 'pending';
    weatherConfidence: number;
    hasDocuments: boolean;
    hasTuningGuides?: boolean;
    hasCrewAssigned?: boolean;
    classId?: string;
  }[];

  // Stats
  stats: {
    totalRegattas: number;
    venuesVisited: number;
    avgPosition: number;
    globalRanking: number;
    recentRaces: number;
    strategyWinRate: number;
  };

  // Current venue
  currentVenue?: {
    name: string;
    country: string;
    confidence: number;
  };

  // Callbacks
  onRacePress: (raceId: string) => void;
  onPlanStrategy: (raceId: string) => void;
  onUploadDocuments: () => void;
  onCheckWeather: () => void;
  onViewVenues: () => void;
  onUploadTuningGuide?: () => void;
  onManageCrew?: (classId: string) => void;
}

export function EnhancedSailorOverview({
  classes,
  activeClassId,
  onClassChange,
  onAddBoat,
  upcomingRaces,
  stats,
  currentVenue,
  onRacePress,
  onPlanStrategy,
  onUploadDocuments,
  onCheckWeather,
  onViewVenues,
  onUploadTuningGuide,
  onManageCrew,
}: EnhancedSailorOverviewProps) {
  const { user } = useAuth();
  
  const activeClass = classes.find(c => c.id === activeClassId);
  const filteredRaces = activeClassId
    ? upcomingRaces.filter(r => r.classId === activeClassId)
    : upcomingRaces;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        
        {/* 1. Class Selector - Prominent at top */}
        <ClassSelector
          classes={classes}
          selectedClassId={activeClassId}
          onClassChange={onClassChange}
          onAddBoat={onAddBoat}
          showAddButton={true}
        />

        {/* 2. Tuning Guides Section - Only show when a class is selected */}
        {activeClass && user && (
          <TuningGuidesSection
            classId={activeClass.id}
            className={activeClass.name}
            sailorId={user.id}
            onUpload={onUploadTuningGuide}
          />
        )}

        {/* 3. Crew Management - Only show when a class is selected */}
        {activeClass && user && (
          <CrewManagement
            sailorId={user.id}
            classId={activeClass.id}
            className={activeClass.name}
            sailNumber={activeClass.sailNumber}
            compact={true}
            onManagePress={() => onManageCrew?.(activeClass.id)}
          />
        )}

        {/* 4. Traditional Sailor Overview with Enhanced Status */}
        <SailorOverview
          upcomingRaces={filteredRaces}
          stats={stats}
          currentVenue={currentVenue}
          onRacePress={onRacePress}
          onPlanStrategy={onPlanStrategy}
          onUploadDocuments={onUploadDocuments}
          onCheckWeather={onCheckWeather}
          onViewVenues={onViewVenues}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    gap: 16,
  },
});
