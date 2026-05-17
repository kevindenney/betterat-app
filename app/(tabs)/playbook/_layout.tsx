/**
 * Playbook Layout
 *
 * Stack layout for the /playbook route tree. Replaces the former /library
 * section — Library's deep links now redirect into /playbook/resources.
 */

import { Stack } from 'expo-router';

export default function PlaybookLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Playbook' }} />
      <Stack.Screen name="blueprints/index" options={{ title: 'Blueprints' }} />
      <Stack.Screen name="blueprints/[id]/index" options={{ title: 'Blueprint timeline' }} />
      <Stack.Screen
        name="blueprints/[id]/co-practitioners"
        options={{ title: 'Co-practitioners' }}
      />
      <Stack.Screen name="concepts/index" options={{ title: 'Concepts' }} />
      <Stack.Screen name="concepts/[slug]" options={{ title: 'Concept' }} />
      <Stack.Screen name="resources/index" options={{ title: 'Resources' }} />
      <Stack.Screen name="patterns/index" options={{ title: 'Patterns' }} />
      <Stack.Screen name="reviews/index" options={{ title: 'Reviews' }} />
      <Stack.Screen name="qa/index" options={{ title: 'Q&A' }} />
      <Stack.Screen
        name="shared/[playbookId]/index"
        options={{ title: 'Shared Playbook' }}
      />
      <Stack.Screen
        name="instructor/index"
        options={{ title: 'Student Playbooks' }}
      />
    </Stack>
  );
}
