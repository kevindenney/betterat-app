import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FollowedPersonTimeline } from '@/components/discover/FollowedPersonTimeline';

export default function FollowedPersonTimelineRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  if (!handle) return null;
  return <FollowedPersonTimeline handle={handle} />;
}
