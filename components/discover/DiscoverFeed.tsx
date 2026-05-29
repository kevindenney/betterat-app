/**
 * DiscoverFeed — the curated front door of the Discover tab.
 *
 * Replaces the old DiscoverAll menu-of-links. Instead of asking the user to
 * pick *which kind of thing* first, this leads with the most valuable thing
 * available right now and progressively reveals the rest. Every section has a
 * "See all →" that drills into the existing focused list via `?segment=`.
 *
 * Sections (each omitted when it has no real data — no empty padding):
 *   1. This week     — home-org spotlight + this-week's pick (reuses Today's
 *                      proven hooks).              → See all → today
 *   2. Plans to follow — top published, subscribable plans.  → See all → plans
 *   3. People like you — top peer suggestions.               → See all → people
 *   4. Browse        — always-present nav into Interests / Orgs / Nearby.
 *
 * Copy says "plan"; the DB/code identifiers stay `blueprints`.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useDiscoverBlueprints } from '@/hooks/useBlueprint';
import { useSailorSuggestions } from '@/hooks/useSailorSuggestions';
import {
  useHomeOrg,
  useThisWeeksPick,
} from '@/components/discover/DiscoverTodayContent';
import {
  initialsForName,
  pickAvatarMarkColor,
  pickSquareMarkColor,
} from '@/components/discover/canonical';
import type { DiscoveredBlueprint } from '@/services/BlueprintService';

type FeedSegment = 'today' | 'plans' | 'people' | 'orgs' | 'interests' | 'nearby';

interface DiscoverFeedProps {
  toolbarOffset: number;
  onSeeAll: (segment: FeedSegment) => void;
}

export function DiscoverFeed({ toolbarOffset, onSeeAll }: DiscoverFeedProps) {
  const { currentInterest } = useInterest();
  const interestId = currentInterest?.id;
  const interestName = currentInterest?.name ?? 'your craft';

  const homeOrg = useHomeOrg();
  const thisWeeksPick = useThisWeeksPick();
  const { data: catalog = [], isLoading: plansLoading } =
    useDiscoverBlueprints(interestId);
  const { suggestions } = useSailorSuggestions();

  const topPlans = catalog.slice(0, 2);
  const topPeople = (suggestions ?? []).slice(0, 3);
  const hasThisWeek = !!homeOrg || !!thisWeeksPick;

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={{
        paddingTop: toolbarOffset + IOS_SPACING.md,
        paddingBottom: FLOATING_TAB_BAR_HEIGHT + 80,
        paddingHorizontal: IOS_SPACING.lg,
        gap: 22,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>DISCOVER</Text>
        <Text style={styles.heroTitle}>What's new in {interestName}</Text>
        <Text style={styles.heroCopy}>
          Plans, people, and orgs you don't yet practice with — curated for
          where you are right now.
        </Text>
      </View>

      {hasThisWeek ? (
        <View style={styles.section}>
          <SectionHeader label="This week" onSeeAll={() => onSeeAll('today')} />
          {homeOrg ? (
            <Pressable
              style={styles.rowCard}
              disabled={!homeOrg.slug}
              onPress={() => {
                if (homeOrg.slug) {
                  router.push(`/discover/org/${homeOrg.slug}?from=feed` as never);
                }
              }}
            >
              <View
                style={[
                  styles.squareMark,
                  { backgroundColor: pickSquareMarkColor(homeOrg.orgId) },
                ]}
              >
                <Text style={styles.markText}>{initialsForName(homeOrg.name)}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {homeOrg.name}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  Now happening at your org
                </Text>
              </View>
              {homeOrg.slug ? (
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={IOS_COLORS.tertiaryLabel}
                />
              ) : null}
            </Pressable>
          ) : null}

          {thisWeeksPick ? (
            <Pressable
              style={styles.pickCard}
              onPress={() => router.push(`/blueprint/${thisWeeksPick.id}` as never)}
            >
              <Text style={styles.pickEyebrow}>THIS WEEK'S PICK</Text>
              <Text style={styles.pickTitle} numberOfLines={2}>
                {thisWeeksPick.title}
              </Text>
              <Text style={styles.pickSource} numberOfLines={1}>
                {thisWeeksPick.authorName
                  ? `From ${thisWeeksPick.authorName}`
                  : 'Plan'}
                {thisWeeksPick.stepCount > 0
                  ? ` · ${thisWeeksPick.stepCount} step${thisWeeksPick.stepCount !== 1 ? 's' : ''}`
                  : ''}
              </Text>
              {thisWeeksPick.description ? (
                <Text style={styles.pickQuote} numberOfLines={3}>
                  {thisWeeksPick.description}
                </Text>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          label="Plans you can follow"
          onSeeAll={() => onSeeAll('plans')}
        />
        {plansLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={IOS_COLORS.systemBlue} />
          </View>
        ) : topPlans.length > 0 ? (
          topPlans.map((bp) => <PlanRow key={bp.id} bp={bp} />)
        ) : (
          <Pressable
            style={styles.inviteCard}
            onPress={() => onSeeAll('plans')}
          >
            <Ionicons name="reader-outline" size={22} color={IOS_COLORS.systemBlue} />
            <Text style={styles.inviteText}>
              No published {currentInterest?.name ?? ''} plans yet — be among the
              first to follow one when they land.
            </Text>
          </Pressable>
        )}
      </View>

      {topPeople.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            label="People like you"
            onSeeAll={() => onSeeAll('people')}
          />
          {topPeople.map((p) => (
            <Pressable
              key={p.userId}
              style={styles.rowCard}
              onPress={() =>
                router.push(
                  `/discover/person/${p.userId}?from=feed&name=${encodeURIComponent(p.fullName)}` as never,
                )
              }
            >
              <View
                style={[
                  styles.roundMark,
                  { backgroundColor: pickAvatarMarkColor(p.userId) },
                ]}
              >
                <Text style={styles.markText}>{initialsForName(p.fullName)}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {p.fullName}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {p.similarityReason?.trim() || 'Worth knowing'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={IOS_COLORS.tertiaryLabel}
              />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.browseEyebrow}>Browse</Text>
        <View style={styles.browseStack}>
          <BrowseRow
            icon="compass-outline"
            label="Interests"
            sub="Add what you're working on"
            onPress={() => onSeeAll('interests')}
          />
          <BrowseRow
            icon="business-outline"
            label="Orgs"
            sub="Schools, clubs, programs to join"
            onPress={() => onSeeAll('orgs')}
          />
          <BrowseRow
            icon="location-outline"
            label="Nearby"
            sub="What's around you"
            onPress={() => onSeeAll('nearby')}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function SectionHeader({
  label,
  onSeeAll,
}: {
  label: string;
  onSeeAll: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Pressable onPress={onSeeAll} hitSlop={8} style={styles.seeAll}>
        <Text style={styles.seeAllText}>See all</Text>
        <Ionicons name="chevron-forward" size={13} color={IOS_COLORS.systemBlue} />
      </Pressable>
    </View>
  );
}

function PlanRow({ bp }: { bp: DiscoveredBlueprint }) {
  const author = bp.organization_name ?? bp.author_name ?? 'Author';
  const badge =
    bp.access_level === 'paid'
      ? bp.price_cents && bp.price_cents > 0
        ? `${bp.currency?.toUpperCase() === 'USD' ? '$' : ''}${(bp.price_cents / 100).toFixed(0)}`
        : 'Paid'
      : bp.access_level === 'org_members'
        ? 'Members'
        : null;

  return (
    <Pressable
      style={styles.planCard}
      onPress={() =>
        router.push(`/(tabs)/library/blueprints/${bp.id}` as never)
      }
    >
      <View style={styles.planText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {bp.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {author}
          {bp.subscriber_count > 0
            ? ` · ${bp.subscriber_count} follower${bp.subscriber_count !== 1 ? 's' : ''}`
            : ''}
        </Text>
      </View>
      {badge ? (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{badge}</Text>
        </View>
      ) : (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={IOS_COLORS.tertiaryLabel}
        />
      )}
    </Pressable>
  );
}

function BrowseRow({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.browseRow} onPress={onPress}>
      <View style={styles.browseIcon}>
        <Ionicons name={icon} size={18} color={IOS_COLORS.systemBlue} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowMeta}>{sub}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={IOS_COLORS.tertiaryLabel}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  hero: {
    gap: 6,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: IOS_COLORS.systemBlue,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  heroCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  rowMeta: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  squareMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 87, 0.25)',
    padding: 16,
    gap: 4,
  },
  pickEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97757',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  pickTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  pickSource: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  pickQuote: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 6,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 14,
  },
  planText: {
    flex: 1,
    gap: 3,
  },
  planBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
  },
  loadingBox: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 14,
  },
  inviteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  browseEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  browseStack: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    overflow: 'hidden',
  },
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.10)',
  },
  browseIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
});
