/**
 * /discover/following — placeholder for Phase 7's followed-people browsing.
 *
 * Routed to by the universal `+` sheet's "Add a step from someone you follow" row.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { GRAY_6, IOS_BLUE, LABEL, LABEL_3 } from '@/lib/design-tokens-step-loop-ios';

export default function FollowingStub() {
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
      <View style={styles.screen}>
        <Text style={styles.headline}>People you follow</Text>
        <Text style={styles.body}>
          Borrowing a recent step from a peer or mentor lands in a later phase.
          For now, the quick-capture composer is the fastest way to add a step.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GRAY_6,
    padding: 24,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: LABEL,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: LABEL_3,
  },
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
