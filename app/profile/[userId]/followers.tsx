/**
 * Sailor Followers List Screen
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FollowersListScreen } from '@/components/sailor/lists/FollowersListScreen';

export default function SailorFollowersRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  if (!userId) {
    return null;
  }

  return <FollowersListScreen userId={userId} type="followers" />;
}
