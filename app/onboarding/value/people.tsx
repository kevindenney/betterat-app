/**
 * People — value-funnel screen 3. Watch how others practice, adapt what
 * works, subscribe to programs — the four-tier social story (follow people,
 * join groups, subscribe to programs) in the visitor's vocabulary.
 *
 * The cards are illustrative archetypes rendered from valueStoryVocab —
 * deliberately NOT real accounts (launch truth-state: no fake social proof).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ValueScreen } from '@/components/onboarding/ValueScreen';
import { resolveValueStory } from '@/lib/onboarding/valueStoryVocab';

function PeopleCards({ story }: { story: ReturnType<typeof resolveValueStory> }) {
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.who}>
          <View style={[styles.avatar, { backgroundColor: '#007AFF' }]}>
            <Text style={styles.avatarText}>
              {story.peerName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.whoText}>
            {story.peerName} · {story.peerRole}
          </Text>
        </View>
        <Text style={styles.what}>{story.peerStep}</Text>
        <View style={styles.action}>
          <Text style={styles.actionText}>⊕ Adapt to my practice</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.who}>
          <View style={[styles.avatar, { backgroundColor: '#8B5CF6' }]}>
            <Text style={styles.avatarText}>
              {story.groupName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.whoText}>{story.groupName} · program</Text>
        </View>
        <Text style={styles.what}>{story.groupProgram}</Text>
        <View style={styles.action}>
          <Text style={styles.actionText}>⊕ Subscribe</Text>
        </View>
      </View>
    </View>
  );
}

export default function PeopleScreen() {
  const params = useLocalSearchParams<{ interest?: string }>();
  const interest = typeof params.interest === 'string' ? params.interest : undefined;
  const story = resolveValueStory(interest);

  return (
    <ValueScreen
      title={story.peopleHeadline}
      subtitle="Follow people. Join groups. Subscribe to programs. Steps arrive only when you pull them."
      illustration={<PeopleCards story={story} />}
      gradientColors={story.gradient}
      ctaText="Create account"
      nextRoute={
        interest
          ? `/onboarding/auth-choice-new?interest=${interest}`
          : '/onboarding/auth-choice-new'
      }
      skipText="Sign in"
      skipRoute="/(auth)/login"
      currentStep={2}
      totalSteps={3}
    />
  );
}

const styles = StyleSheet.create({
  stack: {
    width: 300,
    gap: 11,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 14,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  whoText: {
    fontSize: 12.5,
    color: 'rgba(60,60,67,0.6)',
    flexShrink: 1,
  },
  what: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: 9,
    backgroundColor: 'rgba(0,122,255,0.09)',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#007AFF',
  },
});
