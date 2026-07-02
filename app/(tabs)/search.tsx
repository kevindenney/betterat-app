/**
 * Search Tab Screen - app-wide text search.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { useScrollToolbarHide } from '@/hooks/useScrollToolbarHide';
import { useAuth } from '@/providers/AuthProvider';
import {
  GlobalSearchService,
  type RaceSearchResult,
  type SearchResults,
  type VenueSearchResult,
} from '@/services/search/GlobalSearchService';
import {
  IOS_COLORS,
  IOS_RADIUS,
  IOS_SPACING,
  IOS_TYPOGRAPHY,
} from '@/lib/design-tokens-ios';

const EMPTY_RESULTS: SearchResults = {
  races: [],
  sailors: [],
  venues: [],
  boatClasses: [],
  plans: [],
  concepts: [],
  resources: [],
  organizations: [],
  groups: [],
};

export default function SearchTab() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const { user } = useAuth();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const { toolbarHidden, handleScroll } = useScrollToolbarHide();
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length >= 2;
  const totalResults = useMemo(
    () =>
      results.races.length
      + results.sailors.length
      + results.venues.length
      + results.boatClasses.length
      + results.plans.length
      + results.concepts.length
      + results.resources.length
      + results.organizations.length
      + results.groups.length,
    [results],
  );

  useEffect(() => {
    const nextQuery = initialQuery ?? '';
    setQuery(nextQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!user?.id || !hasQuery) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      setErrorText(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setErrorText(null);

    const timeout = setTimeout(() => {
      GlobalSearchService.search(trimmedQuery, user.id)
        .then((nextResults) => {
          if (!cancelled) setResults(nextResults);
        })
        .catch((error) => {
          if (!cancelled) {
            setResults(EMPTY_RESULTS);
            setErrorText(error instanceof Error ? error.message : 'Search failed.');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [hasQuery, trimmedQuery, user?.id]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults(EMPTY_RESULTS);
    router.setParams({ q: '' });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!trimmedQuery) return;
    router.setParams({ q: trimmedQuery });
  }, [trimmedQuery]);

  return (
    <View style={styles.container}>
      <TabScreenToolbar
        topInset={insets.top}
        onMeasuredHeight={setToolbarHeight}
        hidden={toolbarHidden}
        title="Search"
      >
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Search size={16} color={IOS_COLORS.placeholderText} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search BetterAt"
              placeholderTextColor={IOS_COLORS.placeholderText}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleSubmit}
            />
            {query.length > 0 ? (
              <Pressable onPress={handleClear} hitSlop={8}>
                <X size={16} color={IOS_COLORS.systemGray2} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </TabScreenToolbar>

      <ScrollView
        style={styles.results}
        contentContainerStyle={[
          styles.resultsContent,
          { paddingTop: toolbarHeight + IOS_SPACING.md },
        ]}
        keyboardDismissMode="on-drag"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {!hasQuery ? (
          <EmptyState
            title="Search across BetterAt"
            body="Find plans, concepts, resources, groups, people, organizations, races, venues, and boat classes."
          />
        ) : loading && totalResults === 0 ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={IOS_COLORS.secondaryLabel} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : errorText ? (
          <EmptyState title="Search failed" body={errorText} />
        ) : totalResults === 0 ? (
          <EmptyState title="No results" body="Try a different word or name." />
        ) : (
          <>
            <ResultSection
              title="Plans"
              data={results.plans}
              renderItem={(item) => (
                <ResultRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  badge="P"
                  onPress={() =>
                    router.push((item.route ?? `/library/plans/${item.id}`) as any)
                  }
                />
              )}
            />
            <ResultSection
              title="Concepts"
              data={results.concepts}
              renderItem={(item) => (
                <ResultRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  badge="C"
                  onPress={() => router.push(`/library/concepts/${item.slug}` as any)}
                />
              )}
            />
            <ResultSection
              title="Resources"
              data={results.resources}
              renderItem={(item) => (
                <ResultRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  badge="R"
                  onPress={() => router.push(`/library/items/${item.id}` as any)}
                />
              )}
            />
            <ResultSection
              title="Groups"
              data={results.groups}
              renderItem={(item) => (
                <ResultRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  badge="G"
                  onPress={() => router.push(item.route as any)}
                />
              )}
            />
            <ResultSection
              title="People"
              data={results.sailors}
              renderItem={(item) => (
                <ResultRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  badge={item.avatarEmoji ?? initials(item.title)}
                  onPress={() => router.push(`/person/${item.id}` as any)}
                />
              )}
            />
            <ResultSection
              title="Organizations"
              data={results.organizations}
              renderItem={(item) => (
                <ResultRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  badge="O"
                  onPress={() => router.push(`/organizations/${item.slug ?? item.id}` as any)}
                />
              )}
            />
            <ResultSection
              title="Races"
              data={results.races}
              renderItem={(item) => (
                <ResultRow
                  key={item.id}
                  title={item.title}
                  subtitle={formatRaceSubtitle(item)}
                  badge="E"
                  onPress={() => router.push(`/(tabs)/race/scrollable/${item.id}` as any)}
                />
              )}
            />
            <ResultSection
              title="Venues"
              data={results.venues}
              renderItem={(item) => (
                <ResultRow
                  key={item.id}
                  title={item.title}
                  subtitle={formatVenueSubtitle(item)}
                  badge="V"
                  onPress={() => router.push(`/venue/${item.id}` as any)}
                />
              )}
            />
            <ResultSection
              title="Boat classes"
              data={results.boatClasses}
              renderItem={(item) => (
                <ResultRow
                  key={item.id}
                  title={item.title}
                  badge="B"
                />
              )}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ResultSection<T>({
  title,
  data,
  renderItem,
}: {
  title: string;
  data: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  if (data.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRows}>
        {data.map(renderItem)}
      </View>
    </View>
  );
}

function ResultRow({
  title,
  subtitle,
  badge,
  onPress,
}: {
  title: string;
  subtitle?: string;
  badge: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.resultRow}
      onPress={onPress}
      disabled={!onPress}
      android_ripple={{ color: IOS_COLORS.tertiarySystemFill }}
    >
      <View style={styles.resultBadge}>
        <Text style={styles.resultBadgeText}>{badge}</Text>
      </View>
      <View style={styles.resultText}>
        <Text style={styles.resultTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={styles.resultSubtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{body}</Text>
    </View>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

function formatRaceSubtitle(item: RaceSearchResult): string | undefined {
  return [item.subtitle, item.raceDate, item.status].filter(Boolean).join(' · ') || undefined;
}

function formatVenueSubtitle(item: VenueSearchResult): string | undefined {
  return [item.subtitle, item.venueType].filter(Boolean).join(' · ') || undefined;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    borderRadius: IOS_RADIUS.sm,
    paddingHorizontal: IOS_SPACING.md,
    height: 36,
  },
  searchInput: {
    flex: 1,
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    paddingVertical: 0,
  },
  results: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: IOS_SPACING.xxxxl,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.sm,
    paddingTop: IOS_SPACING.xl,
  },
  loadingText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
  },
  section: {
    marginBottom: IOS_SPACING.lg,
  },
  sectionTitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.xs,
  },
  sectionRows: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
    minHeight: 58,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  resultRowPressed: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  resultBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemBlue,
  },
  resultBadgeText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  resultText: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  resultSubtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  emptyContainer: {
    paddingHorizontal: IOS_SPACING.xl,
    paddingTop: IOS_SPACING.xxl,
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
