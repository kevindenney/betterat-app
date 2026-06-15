/**
 * Sailor Profile Layout
 */

import { Stack } from 'expo-router';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

export default function SailorProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: IOS_COLORS.systemGroupedBackground,
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="followers"
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="following"
        options={{
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
