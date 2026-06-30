/**
 * FollowersListScreen - List of followers or following
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useFollowersList } from '@/hooks/useFollowersList';
import { SailorSuggestionCard } from '@/components/search/SailorSuggestionCard';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

interface FollowersListScreenProps {
  userId: string;
  type: 'followers' | 'following';
}

export function FollowersListScreen({
  userId,
  type,
}: FollowersListScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    users,
    isLoading,
    loadMore,
    isLoadingMore,
    toggleFollow,
    isFollowing,
  } = useFollowersList(userId, type);

  const title = type === 'followers' ? 'Followers' : 'Following';

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleUserPress = useCallback(
    (targetUserId: string) => {
      router.push(`/profile/${targetUserId}`);
    },
    [router]
  );

  const handleToggleFollow = useCallback(
    async (targetUserId: string) => {
      await toggleFollow(targetUserId);
    },
    [toggleFollow]
  );

  const renderUser = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <SailorSuggestionCard
        sailor={{
          userId: item.userId,
          fullName: item.displayName,
          avatarEmoji: item.avatarEmoji,
          avatarColor: item.avatarColor,
          avatarUrl: item.avatarUrl,
        }}
        isFollowing={isFollowing(item.userId)}
        onPress={() => handleUserPress(item.userId)}
        onToggleFollow={() => handleToggleFollow(item.userId)}
        showSeparator={index < users.length - 1}
      />
    ),
    [users.length, isFollowing, handleUserPress, handleToggleFollow]
  );

  const keyExtractor = useCallback((item: any) => item.userId, []);

  const ListHeader = useMemo(
    () => (
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={handleBack}
        >
          <ChevronLeft size={24} color={IOS_COLORS.systemBlue} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
    ),
    [insets.top, title, handleBack]
  );

  const ListEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>
          {type === 'followers' ? 'No Followers Yet' : 'Not Following Anyone'}
        </Text>
        <Text style={styles.emptyText}>
          {type === 'followers'
            ? 'When others follow this person, they will appear here.'
            : 'When this person follows others, they will appear here.'}
        </Text>
      </View>
    );
  }, [isLoading, type]);

  const ListFooter = useMemo(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color={IOS_COLORS.systemGray} />
      </View>
    );
  }, [isLoadingMore]);

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  backButton: {
    padding: IOS_SPACING.sm,
    borderRadius: IOS_RADIUS.full,
  },
  backButtonPressed: {
    backgroundColor: IOS_COLORS.quaternarySystemFill,
  },
  title: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    paddingBottom: IOS_SPACING.xxxxl,
  },
  loadingContainer: {
    padding: IOS_SPACING.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: IOS_SPACING.xl,
    alignItems: 'center',
    marginTop: IOS_SPACING.xxl,
  },
  emptyTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.sm,
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  footerLoading: {
    paddingVertical: IOS_SPACING.lg,
    alignItems: 'center',
  },
});
