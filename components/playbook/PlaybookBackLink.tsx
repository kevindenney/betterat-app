/**
 * PlaybookBackLink — inline "< Playbook" back button for sub-pages
 * (Concepts, Resources, Patterns, Reviews, Q&A).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

export function PlaybookBackLink() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + IOS_SPACING.xs }]}>
      <Pressable
        style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/library')
        }
      >
        <Ionicons name="chevron-back" size={16} color={IOS_COLORS.systemBlue} />
        <Text style={styles.text}>Playbook</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.xs,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
});
