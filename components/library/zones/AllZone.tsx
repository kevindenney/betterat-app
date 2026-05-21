/**
 * <AllZone> — Library "All" zone landing.
 *
 * Per canonical §2/§6 the "All" view shows three sections top-down:
 *   1. Plans     (paths you're walking)
 *   2. Concepts  (what you've come to understand)
 *   3. Resources (what you've kept)
 *
 * People is not in the canonical "All" — it exists as its own zone tab
 * for sailors who want a dedicated followee view, but the canonical
 * landing keeps the focus on path/insight/material so this surface
 * stays calm.
 *
 * Each section uses a small uppercase eyebrow ("PLANS") with a colored
 * dot and a See-all jump. Empty sections collapse to a muted hint so
 * the See-all link is still reachable.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';
import { useSubscribedPlansForLibrary } from '@/hooks/useSubscribedPlansForLibrary';
import { useLifecycleConcepts } from '@/hooks/usePlaybook';
import { useLibraryResourcesPreview } from '@/hooks/useLibraryResourcesPreview';
import { useInterest } from '@/providers/InterestProvider';
import { PlanRowCard } from '@/components/library/plans/PlanRowCard';
import { ConceptCard } from '@/components/playbook/ConceptCard';
import { RecentItemRow } from '@/components/library/resources/RecentItemRow';

const PREVIEW_LIMIT = 3;

interface AllZoneProps {
  counts?: Partial<Record<LibraryZone, number>>;
  onJumpToZone: (zone: LibraryZone) => void;
}

interface SectionHeaderProps {
  title: string;
  dotColor: string;
  count?: number;
  onSeeAll: () => void;
}

function SectionHeader({ title, dotColor, count, onSeeAll }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.headLeft}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.eyebrow}>{title}</Text>
      </View>
      <Pressable
        onPress={onSeeAll}
        accessibilityRole="link"
        accessibilityLabel={`See all ${title}`}
        hitSlop={6}
        style={styles.seeAllBtn}
      >
        <Text style={styles.seeAllText}>
          {typeof count === 'number' ? `See all ${count}` : 'See all'}
        </Text>
        <Ionicons name="chevron-forward" size={12} color={IOS_COLORS.systemBlue} />
      </Pressable>
    </View>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.emptyHint}>{children}</Text>;
}

function LoadingRow() {
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator size="small" color={IOS_COLORS.tertiaryLabel} />
    </View>
  );
}

export function AllZone({ counts, onJumpToZone }: AllZoneProps) {
  const { currentInterest } = useInterest();
  const { data: plans, isLoading: plansLoading } = useSubscribedPlansForLibrary(
    currentInterest?.id,
  );
  const { data: concepts, isLoading: conceptsLoading } = useLifecycleConcepts(
    currentInterest?.id,
  );
  const { data: resources, isLoading: resourcesLoading } =
    useLibraryResourcesPreview(PREVIEW_LIMIT);

  const planPreview = (plans ?? []).slice(0, PREVIEW_LIMIT);
  const conceptPreview = (concepts ?? []).slice(0, PREVIEW_LIMIT);
  const resourcePreview = resources ?? [];

  return (
    <View style={styles.container}>
      {/* Plans */}
      <View style={styles.section}>
        <SectionHeader
          title="PLANS"
          dotColor="#3B82F6"
          count={counts?.plans}
          onSeeAll={() => onJumpToZone('plans')}
        />
        {plansLoading && !plans ? (
          <LoadingRow />
        ) : planPreview.length === 0 ? (
          <EmptyHint>
            Subscribe to a coach-bundled path from Discover to see it here.
          </EmptyHint>
        ) : (
          <View style={styles.cardList}>
            {planPreview.map((plan) => (
              <PlanRowCard
                key={plan.blueprintId}
                plan={plan}
                onPress={() =>
                  router.push(`/(tabs)/library/plans/${plan.blueprintId}` as never)
                }
              />
            ))}
          </View>
        )}
      </View>

      {/* Concepts */}
      <View style={styles.section}>
        <SectionHeader
          title="CONCEPTS"
          dotColor="#A855F7"
          count={counts?.concepts}
          onSeeAll={() => onJumpToZone('concepts')}
        />
        {conceptsLoading && !concepts ? (
          <LoadingRow />
        ) : conceptPreview.length === 0 ? (
          <EmptyHint>
            Capture an insight from the universal + to start a concept.
          </EmptyHint>
        ) : (
          <View style={styles.conceptList}>
            {conceptPreview.map((concept) => (
              <ConceptCard
                key={concept.id}
                state={concept.state}
                title={concept.title}
                whenLabel={`${concept.linked_step_count} linked steps`}
                meta={[
                  { icon: 'steps', label: `${concept.linked_step_count} steps` },
                  { icon: 'quotes', label: `${concept.quote_count} quotes` },
                ]}
                onPress={() =>
                  router.push(`/(tabs)/library/concept/${concept.id}` as never)
                }
              />
            ))}
          </View>
        )}
      </View>

      {/* Resources */}
      <View style={styles.section}>
        <SectionHeader
          title="RESOURCES"
          dotColor="#F59E0B"
          count={counts?.resources}
          onSeeAll={() => onJumpToZone('resources')}
        />
        {resourcesLoading && !resources ? (
          <LoadingRow />
        ) : resourcePreview.length === 0 ? (
          <EmptyHint>
            Articles, videos, drills you've saved to come back to.
          </EmptyHint>
        ) : (
          <View style={styles.resourceList}>
            {resourcePreview.map((item) => (
              <RecentItemRow
                key={item.id}
                item={item}
                onPress={() => router.push(`/library/items/${item.id}` as never)}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: IOS_SPACING.md,
    gap: IOS_SPACING.lg,
  },
  section: {
    gap: IOS_SPACING.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: IOS_COLORS.label,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: IOS_SPACING.md,
  },
  cardList: {
    gap: IOS_SPACING.sm,
  },
  conceptList: {
    gap: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.md,
  },
  resourceList: {
    marginHorizontal: IOS_SPACING.md,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
});
