import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { BlueprintTimeline } from '@/components/playbook/BlueprintTimeline';

export default function BlueprintTimelineRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <BlueprintTimeline blueprintId={id} />;
}
