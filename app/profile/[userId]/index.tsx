/**
 * Sailor Profile Screen
 *
 * Strava-style profile with:
 * - Photo carousel
 * - Profile header with follow button
 * - Stats card
 * - Trophy case
 * - Boats list
 * - Race timeline
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PublicFaceScreen } from '@/components/sailor/public-face/PublicFaceScreen';

export default function SailorProfileRoute() {
  const { userId, preview } = useLocalSearchParams<{ userId: string; preview?: string }>();

  if (!userId) {
    return null;
  }

  return <PublicFaceScreen userId={userId} previewAsPublic={preview === '1'} />;
}
