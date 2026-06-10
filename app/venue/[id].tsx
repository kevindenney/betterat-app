/**
 * Venue Detail Screen
 *
 * Stack-pushed full-screen detail view accessed from the venue directory.
 * Shows Feed (default) and Map segments with a header containing
 * venue name, back button, and Join/Joined toggle.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  IOS_COLORS,
  IOS_SPACING,
} from '@/lib/design-tokens-ios';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { VenueFeedSegment } from '@/components/venue/segments/VenueFeedSegment';
import { VenueMapSegment } from '@/components/venue/segments/VenueMapSegment';
import { VenueDetailHeader } from '@/components/venue/VenueDetailHeader';
import { PostComposer } from '@/components/venue/post/PostComposer';
import { AddRacingAreaSheet } from '@/components/venue/AddRacingAreaSheet';
import { useQueryClient } from '@tanstack/react-query';
import { useSavedVenues } from '@/hooks/useSavedVenues';
import { communityFeedKeys } from '@/hooks/useCommunityFeed';
import { supabase } from '@/services/supabase';
import { triggerHaptic } from '@/lib/haptics';
import type { FeedPost } from '@/types/community-feed';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VenueDetailSegment = 'feed' | 'map';

interface VenueData {
  id: string;
  name: string;
  country: string;
  region: string;
  venue_type: string;
  coordinates_lat: number;
  coordinates_lng: number;
}

const SEGMENTS: { value: VenueDetailSegment; label: string }[] = [
  { value: 'feed', label: 'Feed' },
  { value: 'map', label: 'Map' },
];

// ---------------------------------------------------------------------------
// Join Button (header right)
// ---------------------------------------------------------------------------

function JoinHeaderButton({
  isJoined,
  onPress,
}: {
  isJoined: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        triggerHaptic('impactLight');
        onPress();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.headerJoinButton,
        isJoined && styles.headerJoinedButton,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.headerJoinText,
          isJoined && styles.headerJoinedText,
        ]}
      >
        {isJoined ? 'Joined' : 'Join'}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { savedVenueIds, saveVenue, unsaveVenue, refreshSavedVenues } =
    useSavedVenues();

  const [venue, setVenue] = useState<VenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<VenueDetailSegment>('feed');
  const [showComposer, setShowComposer] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [showAddArea, setShowAddArea] = useState(false);

  const actualId = Array.isArray(id) ? id[0] : id;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchVenue = useCallback(async () => {
    if (!actualId || actualId === '[id]') return;
    try {
      const { data, error } = await supabase
        .from('sailing_venues')
        .select(
          'id, name, country, region, venue_type, coordinates_lat, coordinates_lng',
        )
        .eq('id', actualId)
        .single();

      if (error) throw error;
      if (data) {
        setVenue({
          id: data.id,
          name: data.name,
          country: data.country || '',
          region: data.region || '',
          venue_type: data.venue_type || '',
          coordinates_lat: data.coordinates_lat ?? 0,
          coordinates_lng: data.coordinates_lng ?? 0,
        });
      }
    } catch {
      // silent - venue may not exist
    } finally {
      setLoading(false);
    }
  }, [actualId]);

  useEffect(() => {
    fetchVenue();
  }, [fetchVenue]);

  // ---------------------------------------------------------------------------
  // Join / Leave
  // ---------------------------------------------------------------------------

  const isJoined = venue ? savedVenueIds.has(venue.id) : false;

  const handleJoinToggle = useCallback(async () => {
    if (!venue) return;
    try {
      if (isJoined) {
        await unsaveVenue(venue.id);
      } else {
        await saveVenue(venue.id);
      }
      refreshSavedVenues();
    } catch {
      // silent
    }
  }, [venue, isJoined, saveVenue, unsaveVenue, refreshSavedVenues]);

  // ---------------------------------------------------------------------------
  // Post navigation
  // ---------------------------------------------------------------------------

  const handlePostPress = useCallback(
    (post: FeedPost) => {
      queryClient.setQueryData(communityFeedKeys.post(post.id), post);
      router.push(`/venue/post/${post.id}`);
    },
    [router, queryClient],
  );

  // ---------------------------------------------------------------------------
  // Loading / Error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{ title: '', headerShown: true, headerBackTitle: 'Local' }}
        />
        <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen
          options={{
            title: 'Venue',
            headerShown: true,
            headerBackTitle: 'Local',
          }}
        />
        <Text style={styles.errorTitle}>Venue not found</Text>
        <Text style={styles.errorSubtitle}>
          This venue may have been removed.
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: venue.name,
          headerShown: true,
          headerBackTitle: 'Local',
          headerLargeTitle: false,
          headerRight: () => (
            <JoinHeaderButton
              isJoined={isJoined}
              onPress={handleJoinToggle}
            />
          ),
        }}
      />

      {/* Segmented Control */}
      <View style={styles.segmentContainer}>
        <IOSSegmentedControl
          segments={SEGMENTS}
          selectedValue={segment}
          onValueChange={setSegment}
        />
      </View>

      {/* Feed Segment */}
      {segment === 'feed' && (
        <View style={styles.segmentContent}>
          <VenueDetailHeader
            venueId={venue.id}
            selectedAreaId={selectedAreaId}
            onAreaSelect={setSelectedAreaId}
            onAddArea={() => setShowAddArea(true)}
          />
          <VenueFeedSegment
            venueId={venue.id}
            poiId={selectedAreaId}
            onPostPress={handlePostPress}
            onCreatePost={() => setShowComposer(true)}
          />
        </View>
      )}

      {/* Map Segment */}
      {segment === 'map' && (
        <View style={styles.segmentContent}>
          <VenueMapSegment
            currentVenue={venue}
            savedVenueIds={savedVenueIds}
            onSaveVenue={handleJoinToggle}
            onAskAI={() => {}}
            loadingAI={false}
            onCompare={() => {}}
          />
        </View>
      )}

      {/* Post Composer */}
      <PostComposer
        visible={showComposer}
        venueId={venue.id}
        onDismiss={() => setShowComposer(false)}
      />

      {/* Add Racing Area Sheet */}
      <AddRacingAreaSheet
        visible={showAddArea}
        venueId={venue.id}
        onDismiss={() => setShowAddArea(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  segmentContainer: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  segmentContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    padding: IOS_SPACING.xxxl,
    gap: IOS_SPACING.sm,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  errorSubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  headerJoinButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  headerJoinedButton: {
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
  },
  headerJoinText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerJoinedText: {
    color: IOS_COLORS.label,
  },
});
