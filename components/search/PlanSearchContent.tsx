import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useMarketplaceBlueprints, type MarketplaceBlueprint } from '@/hooks/useMarketplaceBlueprints';
import { IOS_COLORS, IOS_TYPOGRAPHY, IOS_SPACING, IOS_RADIUS } from '@/lib/design-tokens-ios';

interface PlanSearchContentProps {
  toolbarOffset?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

function priceLabel(plan: MarketplaceBlueprint): string {
  if (plan.pricePerSeatCents <= 0) return 'Free';
  const dollars = (plan.pricePerSeatCents / 100).toFixed(plan.pricePerSeatCents % 100 === 0 ? 0 : 2);
  const cadence = plan.billingCadence === 'monthly' ? '/mo' : plan.billingCadence === 'annual' ? '/yr' : '';
  return `$${dollars}${cadence}`;
}

export function PlanSearchContent({
  toolbarOffset = 0,
  onScroll,
}: PlanSearchContentProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
  const { blueprints, loading } = useMarketplaceBlueprints();

  const results = useMemo(() => {
    if (normalizedQuery.length === 0) return blueprints;
    return blueprints.filter((p) => {
      const haystack = [
        p.title,
        p.description ?? '',
        p.authorName,
        p.orgName ?? '',
        p.interestName ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [blueprints, normalizedQuery]);

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  const renderItem = useCallback(({ item }: { item: MarketplaceBlueprint }) => {
    const subtitleParts = [item.authorName];
    if (item.interestName) subtitleParts.push(item.interestName);
    return (
      <Pressable
        style={styles.row}
        onPress={() => router.push(`/marketplace/${item.id}` as any)}
      >
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitleParts.join(' · ')}</Text>
        </View>
        <View style={[styles.priceBadge, item.pricePerSeatCents > 0 ? styles.priceBadgePaid : styles.priceBadgeFree]}>
          <Text style={[styles.priceText, item.pricePerSeatCents > 0 ? styles.priceTextPaid : styles.priceTextFree]}>
            {priceLabel(item)}
          </Text>
        </View>
      </Pressable>
    );
  }, []);

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardDismissMode="on-drag"
      ListHeaderComponent={(
        <View style={[styles.header, { paddingTop: toolbarOffset + IOS_SPACING.md }]}>
          <View style={styles.searchInputWrapper}>
            <Search
              size={16}
              color={IOS_COLORS.placeholderText}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search plans"
              placeholderTextColor={IOS_COLORS.placeholderText}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={handleClear} hitSlop={8}>
                <X size={16} color={IOS_COLORS.systemGray2} />
              </Pressable>
            )}
          </View>

          <Text style={styles.helperText}>
            Search subscribable plans by title, creator, or interest.
          </Text>
        </View>
      )}
      ListEmptyComponent={(
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            {loading ? 'Loading plans...' : 'No plans found'}
          </Text>
          <Text style={styles.emptyText}>
            {normalizedQuery.length === 0
              ? 'No plans are listed yet.'
              : 'Try a different search term.'}
          </Text>
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: IOS_SPACING.xxxxl,
  },
  header: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    borderRadius: IOS_RADIUS.sm,
    paddingHorizontal: IOS_SPACING.md,
    height: 36,
  },
  searchIcon: {
    marginRight: IOS_SPACING.xs,
  },
  searchInput: {
    flex: 1,
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    paddingVertical: 0,
  },
  helperText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginTop: IOS_SPACING.sm,
  },
  row: {
    marginHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: IOS_SPACING.sm,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    ...IOS_TYPOGRAPHY.body,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  rowSubtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  priceBadge: {
    borderRadius: IOS_RADIUS.full,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.xs,
    minWidth: 64,
    alignItems: 'center',
  },
  priceBadgePaid: {
    backgroundColor: '#FEF3C7',
  },
  priceBadgeFree: {
    backgroundColor: '#ECFDF5',
  },
  priceText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '700',
  },
  priceTextPaid: {
    color: '#92400E',
  },
  priceTextFree: {
    color: '#059669',
  },
  emptyContainer: {
    paddingHorizontal: IOS_SPACING.xl,
    paddingTop: IOS_SPACING.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginTop: IOS_SPACING.sm,
  },
});
