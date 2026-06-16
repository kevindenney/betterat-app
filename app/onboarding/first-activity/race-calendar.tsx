/**
 * Race Calendar Screen - Show Upcoming Races
 * Displays races from user's club or popular races
 */

import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { OnboardingProgressDots } from '@/components/onboarding/OnboardingProgressDots';
import { useWorkspaceDomain } from '@/hooks/useWorkspaceDomain';
import { guardOnboardingRouteForDomain } from '@/lib/utils/onboardingRouting';
import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService';
import type { RaceSelection } from '@/types/onboarding';

// Mock race data - in production this would come from the API
const MOCK_RACES = [
  {
    id: '1',
    name: 'Sunday Series Race 5',
    startDate: '2024-02-04T10:00:00Z',
    venueName: 'Bay Sailing Club',
    type: 'club_race',
  },
  {
    id: '2',
    name: 'Winter Championship',
    startDate: '2024-02-10T09:00:00Z',
    venueName: 'Harbor Masters Yacht Club',
    type: 'championship',
  },
  {
    id: '3',
    name: 'Frostbite Series',
    startDate: '2024-02-11T11:00:00Z',
    venueName: 'Marina Sailing Center',
    type: 'series',
  },
  {
    id: '4',
    name: 'Wednesday Twilight Race',
    startDate: '2024-02-14T17:30:00Z',
    venueName: 'Bay Sailing Club',
    type: 'club_race',
  },
];

interface Race {
  id: string;
  name: string;
  startDate: string;
  venueName: string;
  type: string;
}

export default function RaceCalendarScreen() {
  const params = useLocalSearchParams<{ domain?: string }>();
  const router = useRouter();
  const { activeDomain } = useWorkspaceDomain();
  const paramDomain = Array.isArray(params.domain) ? params.domain[0] : params.domain;
  const resolvedDomain = paramDomain || activeDomain;
  const isSailingDomain = String(resolvedDomain || '').toLowerCase().trim() === 'sailing';
  const [races, setRaces] = useState<Race[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRaces, setSelectedRaces] = useState<string[]>([]);

  useEffect(() => {
    if (!isSailingDomain) {
      router.replace(guardOnboardingRouteForDomain('/onboarding/first-activity/race-calendar', resolvedDomain) as any);
      return;
    }

    // Simulate loading races
    const loadRaces = async () => {
      setIsLoading(true);
      try {
        // In production, fetch from API based on user's club/location
        await new Promise((resolve) => setTimeout(resolve, 500));
        setRaces(MOCK_RACES);
      } catch (error) {
        console.error('Failed to load races:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRaces();
  }, [isSailingDomain, resolvedDomain, router]);

  const handleToggleRace = useCallback((raceId: string) => {
    setSelectedRaces((prev) =>
      prev.includes(raceId)
        ? prev.filter((id) => id !== raceId)
        : [...prev, raceId]
    );
  }, []);

  const handleContinue = async () => {
    // Save selected races
    const racesToSave: RaceSelection[] = selectedRaces
      .map((id) => races.find((r) => r.id === id))
      .filter(Boolean)
      .map((race) => ({
        id: race!.id,
        name: race!.name,
        startDate: race!.startDate,
        venueName: race!.venueName,
      }));

    await OnboardingStateService.setSelectedRaces(racesToSave);
    await OnboardingStateService.completeStep('complete');

    // Navigate to add race or complete
    router.push({
      pathname: '/onboarding/first-activity/add-race',
      params: resolvedDomain ? { domain: resolvedDomain } : undefined,
    });
  };

  const handleSkip = async () => {
    await OnboardingStateService.setSelectedRaces([]);
    await OnboardingStateService.completeStep('complete');
    router.push({
      pathname: '/onboarding/first-activity/add-race',
      params: resolvedDomain ? { domain: resolvedDomain } : undefined,
    });
  };

  const handleBack = () => {
    router.back();
  };

  const renderRace = useCallback(
    ({ item, index }: { item: Race; index: number }) => {
      const isSelected = selectedRaces.includes(item.id);
      const raceDate = parseISO(item.startDate);
      const timeStr = format(raceDate, 'h:mm a');

      return (
        <Animated.View entering={FadeIn.delay(200 + index * 50).duration(300)}>
          <TouchableOpacity
            style={[styles.raceCard, isSelected && styles.raceCardSelected]}
            onPress={() => handleToggleRace(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.dateColumn}>
              <Text style={styles.dateDay}>{format(raceDate, 'EEE')}</Text>
              <Text style={styles.dateNumber}>{format(raceDate, 'd')}</Text>
              <Text style={styles.dateMonth}>{format(raceDate, 'MMM')}</Text>
            </View>
            <View style={styles.raceInfo}>
              <Text style={[styles.raceName, isSelected && styles.raceNameSelected]}>
                {item.name}
              </Text>
              <View style={styles.raceDetails}>
                <Ionicons name="location-outline" size={14} color="#64748B" />
                <Text style={styles.raceDetailText}>{item.venueName}</Text>
              </View>
              <View style={styles.raceDetails}>
                <Ionicons name="time-outline" size={14} color="#64748B" />
                <Text style={styles.raceDetailText}>{timeStr}</Text>
              </View>
            </View>
            <View
              style={[styles.checkbox, isSelected && styles.checkboxSelected]}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [selectedRaces, handleToggleRace]
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <OnboardingProgressDots
            currentStep={9}
            totalSteps={11}
            activeColor="#3B82F6"
            inactiveColor="#E2E8F0"
            completedColor="#93C5FD"
          />
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400).springify()}
          style={styles.titleContainer}
        >
          <Text style={styles.title}>Upcoming Races</Text>
          <Text style={styles.subtitle}>
            Select races you're planning to sail. We'll keep you updated with conditions and results.
          </Text>
        </Animated.View>

        {/* Race List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Finding races near you...</Text>
          </View>
        ) : (
          <FlatList
            data={races}
            renderItem={renderRace}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No upcoming races</Text>
                <Text style={styles.emptyText}>
                  Add your first race to get started
                </Text>
              </View>
            }
          />
        )}

        {/* Selection Summary */}
        {selectedRaces.length > 0 && (
          <Animated.View
            entering={FadeInUp.duration(300)}
            style={styles.selectionSummary}
          >
            <Ionicons name="calendar" size={18} color="#3B82F6" />
            <Text style={styles.selectionText}>
              {selectedRaces.length} race{selectedRaces.length > 1 ? 's' : ''} selected
            </Text>
          </Animated.View>
        )}

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(300).duration(300)} style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>
              {selectedRaces.length > 0 ? 'Add to Calendar' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  titleContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  raceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  raceCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  dateColumn: {
    width: 48,
    alignItems: 'center',
    marginRight: 14,
  },
  dateDay: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  dateNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 28,
  },
  dateMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  raceInfo: {
    flex: 1,
  },
  raceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  raceNameSelected: {
    color: '#1E40AF',
  },
  raceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  raceDetailText: {
    fontSize: 13,
    color: '#64748B',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#EFF6FF',
    marginHorizontal: 24,
    borderRadius: 10,
    marginBottom: 8,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 32,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
