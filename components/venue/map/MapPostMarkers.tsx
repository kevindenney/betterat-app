/**
 * MapPostMarkers
 *
 * Overlay for VenueHeroMap rendering geo-pinned posts as colored dots on a
 * MapLibre map. Colors: amber=tip, blue=question, red=safety, etc.
 *
 * The legacy Callout popup is dropped — MapLibre Marker doesn't expose a
 * built-in popup. Callers should handle `onPostPress` (e.g. show a bottom
 * sheet) for the post detail UI.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Marker as MLMarker } from '@maplibre/maplibre-react-native';
import { TufteTokens } from '@/constants/designSystem';
import { POST_TYPE_CONFIG } from '@/types/community-feed';
import type { FeedPost, PostType } from '@/types/community-feed';

interface MapPostMarkersProps {
  posts: FeedPost[];
  onPostPress?: (post: FeedPost) => void;
}

const MARKER_COLORS: Record<PostType, string> = {
  tip: '#D97706',
  question: '#2563EB',
  report: '#059669',
  discussion: '#6B7280',
  safety_alert: '#DC2626',
};

export function MapPostMarkers({ posts, onPostPress }: MapPostMarkersProps) {
  return (
    <>
      {posts.map((post) => {
        if (post.location_lat == null || post.location_lng == null) return null;
        const color = MARKER_COLORS[post.post_type] || '#6B7280';
        const config = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.discussion;
        return (
          <MLMarker
            key={post.id}
            id={`post-${post.id}`}
            lngLat={[post.location_lng, post.location_lat]}
          >
            <View
              style={[styles.marker, { backgroundColor: color }]}
              onTouchEnd={() => onPostPress?.(post)}
            >
              <Ionicons name={config.icon as keyof typeof Ionicons.glyphMap} size={10} color="#FFFFFF" />
            </View>
          </MLMarker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...TufteTokens.shadows.subtle,
    shadowOpacity: 0.3,
  },
});

export default MapPostMarkers;
