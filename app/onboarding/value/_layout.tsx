import { Stack } from 'expo-router';

// Without this, a <Redirect> into the stack (e.g. the /welcome alias) races
// initial-route resolution and the URL can settle on the alphabetically
// first sibling (loop) while pick-craft renders.
export const unstable_settings = {
  initialRouteName: 'pick-craft',
};

export default function ValueLayout() {
  return (
    <Stack
      initialRouteName="pick-craft"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="pick-craft" />
      <Stack.Screen name="loop" />
      <Stack.Screen name="people" />
    </Stack>
  );
}
