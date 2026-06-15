/**
 * Sailor Following List Screen
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FollowersListScreen } from '@/components/sailor/lists/FollowersListScreen';

export default function SailorFollowingRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  if (!userId) {
    return null;
  }

  return <FollowersListScreen userId={userId} type="following" />;
}
