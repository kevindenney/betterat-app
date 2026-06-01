import { Stack } from 'expo-router';

export default function FleetStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="members" />
      <Stack.Screen name="resources" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="plan/builder" />
      <Stack.Screen name="plan/[blueprintId]" />
    </Stack>
  );
}
