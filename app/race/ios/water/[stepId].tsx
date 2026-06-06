/**
 * On the Water — standalone route.
 *
 * Thin wrapper over RaceWaterCockpit (components/step/RaceWaterCockpit.tsx),
 * which is the shared surface also embedded in the Do tab for race steps.
 *
 * Open at /race/ios/water/{stepId}.
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { RaceWaterCockpit } from '@/components/step/RaceWaterCockpit';

export default function WaterIosRoute() {
  const { stepId } = useLocalSearchParams<{ stepId: string }>();
  return <RaceWaterCockpit stepId={stepId} />;
}
