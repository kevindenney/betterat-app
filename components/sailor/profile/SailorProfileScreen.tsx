/**
 * SailorProfileScreen - Main Strava-style profile screen
 */

import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SailorProfileHeader } from './SailorProfileHeader';
import { SailorMediaCarousel } from './SailorMediaCarousel';
import { SailorStatsCard } from './SailorStatsCard';
import { SailorActivityChart } from './SailorActivityChart';
import { SailorTrophyCase } from './SailorTrophyCase';
import { SailorBoatList } from './SailorBoatList';
import { SailorRaceTimeline } from './SailorRaceTimeline';
import { useSailorFullProfile } from '@/hooks/useSailorFullProfile';
import { useSailorMedia } from '@/hooks/useSailorMedia';
import {
  IOS_COLORS,
  IOS_SPACING,
} from '@/lib/design-tokens-ios';

interface SailorProfileScreenProps {
  userId: string;
}

export function SailorProfileScreen({ userId }: SailorProfileScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    profile,
    isLoading,
    error,
    refetch,
    toggleFollow,
    toggleFavorite,
    toggleNotifications,
    toggleMute,
    isToggling,
    isOwnProfile,
  } = useSailorFullProfile(userId);

  const { media, refetch: refetchMedia } = useSailorMedia(userId);

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchMedia()]);
    setRefreshing(false);
  }, [refetch, refetchMedia]);

  const handleFollowersPress = useCallback(() => {
    router.push(`/profile/${userId}/followers`);
  }, [router, userId]);

  const handleFollowingPress = useCallback(() => {
    router.push(`/profile/${userId}/following`);
  }, [router, userId]);

  const handleRacePress = useCallback(
    (raceId: string) => {
      router.push(`/sailor-journey/${userId}/${raceId}`);
    },
    [router, userId]
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorEmoji}>🔍</Text>
        <Text style={styles.errorTitle}>Profile not found</Text>
        <Text style={styles.errorMessage}>
          {error ? 'Something went wrong loading this profile.' : 'This sailor profile could not be loaded.'}
        </Text>
        <TouchableOpacity style={styles.errorButton} onPress={handleBack}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: insets.top },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Profile Header */}
      <SailorProfileHeader
        profile={profile}
        onFollowersPress={handleFollowersPress}
        onFollowingPress={handleFollowingPress}
        onToggleFollow={toggleFollow}
        onToggleFavorite={toggleFavorite}
        onToggleNotifications={toggleNotifications}
        onToggleMute={toggleMute}
        isToggling={isToggling}
        onBack={handleBack}
      />

      {/* Media Carousel */}
      {(media.length > 0 || isOwnProfile) && (
        <View style={styles.section}>
          <SailorMediaCarousel
            userId={userId}
            media={media}
            isOwnProfile={isOwnProfile}
            onMediaAdded={refetchMedia}
          />
        </View>
      )}

      {/* Stats Card */}
      <View style={styles.section}>
        <SailorStatsCard stats={profile.stats} />
      </View>

      {/* Activity Chart */}
      <View style={styles.section}>
        <SailorActivityChart userId={userId} />
      </View>

      {/* Trophy Case (if has achievements) */}
      {profile.achievements.length > 0 && (
        <View style={styles.section}>
          <SailorTrophyCase achievements={profile.achievements} />
        </View>
      )}

      {/* Boats List (if has boats) */}
      {profile.boats.length > 0 && (
        <View style={styles.section}>
          <SailorBoatList boats={profile.boats} />
        </View>
      )}

      {/* Race Timeline */}
      <View style={styles.section}>
        <SailorRaceTimeline userId={userId} onRacePress={handleRacePress} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  contentContainer: {
    paddingBottom: IOS_SPACING.xxxxl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    paddingHorizontal: IOS_SPACING.xl,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: IOS_SPACING.md,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.xs,
  },
  errorMessage: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginBottom: IOS_SPACING.xl,
    lineHeight: 20,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 10,
  },
  errorButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginTop: IOS_SPACING.lg,
  },
});
