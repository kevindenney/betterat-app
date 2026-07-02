import { Stack } from 'expo-router';

export default function ValueLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="pick-craft" />
      <Stack.Screen name="loop" />
      <Stack.Screen name="people" />
    </Stack>
  );
}
