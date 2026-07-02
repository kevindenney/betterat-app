/**
 * SailorDiscoveryView (View A)
 *
 * Shown when the sailor has no active coaching relationship.
 * Encourages discovery with a hero section, AI matching CTA,
 * featured coaches, an empty sessions prompt, and a Become a Coach CTA.
 */

import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { TufteCoachRow } from '@/components/coaching/TufteCoachRow';
import { IOS_COLORS } from '@/components/cards/constants';
import { useCoachSpotlights } from '@/hooks/useCoachData';
import { useCoachingStatus } from '@/hooks/useCoachingStatus';
import { CoachRecruitmentBanner } from '@/components/learn/CoachRecruitmentBanner';
import { useInterestEventConfig } from '@/hooks/useInterestEventConfig';
import {
  TufteSection,
  getMockCoachesForInterest,
  styles as sharedStyles,
} from './shared';

interface SailorDiscoveryViewProps {
  toolbarOffset?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export function SailorDiscoveryView({ toolbarOffset = 0, onScroll }: SailorDiscoveryViewProps) {
  const router = useRouter();
  const { relationship, seasonCount } = useCoachingStatus();
  const eventConfig = useInterestEventConfig();
  const interestSlug = eventConfig.interestSlug;
  const isSailing = interestSlug === 'sail-racing';

  const {
    data: coaches = [],
    refetch: refetchCoaches,
  } = useCoachSpotlights({ minRating: 4, availability: 'next_30_days' });

  const [refreshing, setRefreshing] = React.useState(false);

  const mockCoaches = getMockCoachesForInterest(interestSlug);
  const coachesToUse = coaches.length > 0
    ? coaches.map((coach) => ({
        ...coach,
        hourly_rate_usd: coach.hourly_rate ?? null,
        rating: coach.average_rating ?? null,
      }))
    : mockCoaches;

  // Interest-aware hero copy
  const heroTitle = 'Find Your Coach';
  const heroSubtitle = isSailing
    ? 'Get matched with expert sailing coaches who specialize in your goals and boat class.'
    : interestSlug === 'nursing'
      ? 'Get matched with experienced clinical preceptors and NCLEX prep coaches who specialize in your learning goals.'
      : 'Get matched with expert coaches who specialize in your goals and skill level.';

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchCoaches();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={sharedStyles.scrollView}
      contentContainerStyle={[sharedStyles.scrollContent, toolbarOffset > 0 && { paddingTop: toolbarOffset }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={IOS_COLORS.blue} />
      }
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {/* Discovery Hero */}
      <View style={sharedStyles.discoveryHero}>
        <Text style={sharedStyles.discoveryTitle}>{heroTitle}</Text>
        <Text style={sharedStyles.discoverySubtitle}>
          {heroSubtitle}
        </Text>
        <TouchableOpacity
          style={sharedStyles.ctaButton}
          onPress={() => router.push('/coach/discover')}
        >
          <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
          <Text style={sharedStyles.ctaButtonText}>Coach Matching</Text>
        </TouchableOpacity>
      </View>

      {/* Coach Recruitment Banner - Dismissable prompt for experienced sailors */}
      <CoachRecruitmentBanner context="coaches_tab" style={{ marginTop: 16 }} />

      {/* Featured Coaches */}
      <TufteSection
        title="FEATURED COACHES"
        action="See all"
        onActionPress={() => router.push('/coach/discover-enhanced')}
      >
        <View style={sharedStyles.coachesContainer}>
          {coachesToUse.slice(0, 4).map((coach, index) => (
            <TufteCoachRow
              key={coach.id}
              name={coach.display_name || 'Coach'}
              bio={coach.bio}
              specialties={coach.specialties}
              rating={coach.average_rating}
              totalSessions={coach.total_sessions}
              hourlyRate={coach.hourly_rate}
              currency={coach.currency}
              location={coach.based_at || coach.available_locations?.[0]}
              onPress={() => router.push(`/coach/${coach.id}`)}
              onContact={() => router.push(`/coach/${coach.id}?action=book`)}
              isLast={index === Math.min(coachesToUse.length, 4) - 1}
            />
          ))}
        </View>
      </TufteSection>

      {/* Empty Sessions Prompt */}
      <TufteSection title="MY SESSIONS">
        <View style={sharedStyles.sessionsContainer}>
          <View style={localStyles.emptySessionsPrompt}>
            <Ionicons name="calendar-outline" size={28} color={IOS_COLORS.gray3} />
            <Text style={localStyles.emptySessionsTitle}>No sessions yet</Text>
            <Text style={localStyles.emptySessionsText}>
              Book your first coaching session to start improving faster.
            </Text>
            <TouchableOpacity
              style={sharedStyles.secondaryCta}
              onPress={() => router.push('/coach/discover')}
            >
              <Text style={sharedStyles.secondaryCtaText}>Browse Coaches</Text>
              <Ionicons name="arrow-forward" size={14} color={IOS_COLORS.blue} />
            </TouchableOpacity>
          </View>
        </View>
      </TufteSection>

      {/* Become a Coach CTA */}
      {relationship === 'NO_RELATIONSHIP' && (
        <TufteSection title="BECOME A COACH">
          <View style={sharedStyles.becomeCoachContainer}>
            <View style={sharedStyles.becomeCoachContent}>
              <Text style={sharedStyles.becomeCoachTitle}>Share Your Knowledge</Text>
              <Text style={sharedStyles.becomeCoachDescription}>
                {isSailing
                  ? (seasonCount > 0
                      ? `You\u2019ve been racing for ${seasonCount} season${seasonCount === 1 ? '' : 's'}. Share your knowledge\u00a0\u2014 become a BetterAt coach.`
                      : 'Turn your sailing knowledge into income. Coach sailors worldwide, set your own rates, and build your reputation on BetterAt.')
                  : interestSlug === 'nursing'
                    ? 'Help nursing students build confidence before clinical rotations. Share your expertise as a preceptor or NCLEX coach.'
                    : 'Turn your expertise into impact. Coach others, set your own rates, and build your reputation on BetterAt.'}
              </Text>
              <TouchableOpacity
                style={sharedStyles.becomeCoachButton}
                onPress={() => router.push('/(auth)/coach-onboarding-welcome')}
              >
                <Text style={sharedStyles.becomeCoachButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </TufteSection>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  emptySessionsPrompt: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptySessionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: 4,
  },
  emptySessionsText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
