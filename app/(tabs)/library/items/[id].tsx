/**
 * /library/items/[id] — Resource item detail.
 *
 * Reads the real library_items row by id. While the row is loading we
 * render a spinner; if the id resolves to nothing (deleted item, or a
 * demo id that doesn't exist in this project) we show a not-found card
 * with a way back to the Library.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { ResourceItemDetail } from '@/components/library/resources/ResourceItemDetail';
import { useLibraryItemDetail } from '@/hooks/useLibraryItemDetail';

export default function ResourceItemScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { data: item, isLoading, error } = useLibraryItemDetail(id);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.centered,
            { paddingTop: insets.top + IOS_SPACING.xl },
          ]}
        >
          <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
        </View>
      </>
    );
  }

  if (error || !item) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.notFound,
            { paddingTop: insets.top + IOS_SPACING.lg },
          ]}
        >
          <Pressable
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/library?zone=resources')
            }
            hitSlop={8}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={20} color="#007AFF" />
            <Text style={styles.backText}>Library</Text>
          </Pressable>
          <View style={styles.notFoundCard}>
            <Ionicons
              name="document-outline"
              size={28}
              color={IOS_COLORS.tertiaryLabel}
            />
            <Text style={styles.notFoundTitle}>Resource not found</Text>
            <Text style={styles.notFoundBlurb}>
              This item may have been removed, or the id points at a demo
              resource that isn't in this project.
            </Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ResourceItemDetail item={item} />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  notFound: {
    flex: 1,
    paddingHorizontal: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    gap: IOS_SPACING.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#007AFF',
  },
  notFoundCard: {
    margin: IOS_SPACING.md,
    padding: IOS_SPACING.lg,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  notFoundTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  notFoundBlurb: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
});
