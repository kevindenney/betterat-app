/**
 * The loop — value-funnel screen 2. One screen for every craft: the
 * Plan/Do/NOW/Review sequence card rendered from valueStoryVocab, so the
 * funnel previews the real product idiom (sequence-to-anchor with the NOW
 * divider) in the visitor's own vocabulary.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ValueScreen } from '@/components/onboarding/ValueScreen';
import { resolveValueStory } from '@/lib/onboarding/valueStoryVocab';

const NOW_COLOR = '#FF6B5A';
const DONE_COLOR = '#34C759';
const PLAN_COLOR = '#7CC4FF';

function LoopCard({ story }: { story: ReturnType<typeof resolveValueStory> }) {
  return (
    <View style={styles.card}>
      <Stage dot={PLAN_COLOR} label="PLAN" text={story.planLine} />
      <Stage dot={DONE_COLOR} label="DO" text={story.doLine} />
      <View style={styles.nowRow}>
        <View style={styles.nowLine} />
        <Text style={styles.nowLabel}>NOW</Text>
        <View style={styles.nowLine} />
      </View>
      <Stage dot={NOW_COLOR} label="REVIEW" text={story.reviewLine} />
    </View>
  );
}

function Stage({ dot, label, text }: { dot: string; label: string; text: string }) {
  return (
    <View style={styles.stage}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={styles.stageBody}>
        <Text style={styles.stageLabel}>{label}</Text>
        <Text style={styles.stageText}>{text}</Text>
      </View>
    </View>
  );
}

export default function LoopScreen() {
  const params = useLocalSearchParams<{ interest?: string }>();
  const interest = typeof params.interest === 'string' ? params.interest : undefined;
  const story = resolveValueStory(interest);

  return (
    <ValueScreen
      title={story.loopHeadline}
      subtitle={story.undatedLine}
      illustration={<LoopCard story={story} />}
      gradientColors={story.gradient}
      ctaText="Next"
      nextRoute={
        interest
          ? `/onboarding/value/people?interest=${interest}`
          : '/onboarding/value/people'
      }
      currentStep={1}
      totalSteps={3}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    width: 300,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginTop: 1,
  },
  stageBody: {
    flex: 1,
  },
  stageLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: 'rgba(60,60,67,0.55)',
    marginBottom: 2,
  },
  stageText: {
    fontSize: 13.5,
    lineHeight: 18,
    color: '#1C1C1E',
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 2,
  },
  nowLine: {
    flex: 1,
    borderTopWidth: 1.5,
    borderTopColor: NOW_COLOR,
    opacity: 0.55,
  },
  nowLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: NOW_COLOR,
  },
});
