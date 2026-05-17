import React from 'react';
import { Stack, router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { FollowersListScreen } from '@/components/sailor/lists/FollowersListScreen';
import { useAuth } from '@/providers/AuthProvider';
import { IOS_BLUE, LABEL } from '@/lib/design-tokens-step-loop-ios';

export default function FollowingRoute() {
  const { user } = useAuth();

  if (!user?.id) {
    return null;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Following',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: LABEL,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <ChevronLeft size={20} color={IOS_BLUE} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ),
        }}
      />
      <FollowersListScreen userId={user.id} type="following" />
    </>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  backText: {
    fontSize: 15,
    color: IOS_BLUE,
    marginLeft: -2,
  },
});
