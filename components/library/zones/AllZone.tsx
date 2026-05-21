/**
 * <AllZone> — Library "All" zone landing.
 *
 * Renders four condensed sections top-down per canonical §2/§6:
 *   1. Plans     (paths you're walking)
 *   2. People    (who you're walking near)
 *   3. Concepts  (what you understand)
 *   4. Resources (what you've kept)
 *
 * Each section is a heading row (colored dot + title + "See all N →")
 * followed by the first 2–3 real cards from that section's data source.
 * Empty sections collapse to a single muted hint line so the section
 * header still surfaces the See-all jump.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';
import { useSubscribedPlansForLibrary } from '@/hooks/useSubscribedPlansForLibrary';
import { useFollowedPeopleForLibrary } from '@/hooks/useFollowedPeopleForLibrary';
import { useLifecycleConcepts } from '@/hooks/usePlaybook';
import { useInterest } from '@/providers/InterestProvider';
import { PlanRowCard } from '@/components/library/plans/PlanRowCard';
import { PersonRowCard } from '@/components/library/people/PersonRowCard';
import { ConceptCard } from '@/components/playbook/ConceptCard';

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
        <Text style={styles.title}>{title}</Text>
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
  const { data: people, isLoading: peopleLoading } = useFollowedPeopleForLibrary();
  const { data: concepts, isLoading: conceptsLoading } = useLifecycleConcepts(
    currentInterest?.id,
  );

  const planPreview = (plans ?? []).slice(0, PREVIEW_LIMIT);
  const peoplePreview = (people ?? []).slice(0, PREVIEW_LIMIT);
  const conceptPreview = (concepts ?? []).slice(0, PREVIEW_LIMIT);

  return (
    <View style={styles.container}>
      {/* Plans */}
      <View style={styles.section}>
        <SectionHeader
          title="Plans"
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

      {/* People */}
      <View style={styles.section}>
        <SectionHeader
          title="People"
          dotColor="#8B5CF6"
          count={counts?.people}
          onSeeAll={() => onJumpToZone('people')}
        />
        {peopleLoading && !people ? (
          <LoadingRow />
        ) : peoplePreview.length === 0 ? (
          <EmptyHint>
            Follow sailors and coaches from Discover; their timelines surface here.
          </EmptyHint>
        ) : (
          <View style={styles.cardList}>
            {peoplePreview.map((person) => (
              <PersonRowCard
                key={person.userId}
                person={person}
                onPress={() => router.push(`/sailor/${person.userId}` as never)}
              />
            ))}
          </View>
        )}
      </View>

      {/* Concepts */}
      <View style={styles.section}>
        <SectionHeader
          title="Concepts"
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
          title="Resources"
          dotColor="#F59E0B"
          count={counts?.resources}
          onSeeAll={() => onJumpToZone('resources')}
        />
        <EmptyHint>
          Articles, videos, drills you've saved to come back to.
        </EmptyHint>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: IOS_SPACING.md,
    gap: IOS_SPACING.xl,
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
  title: {
    fontSize: 17,
    fontWeight: '700',
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
});
