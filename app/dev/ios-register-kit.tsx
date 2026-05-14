/**
 * iOS Register kit — dev sandbox
 *
 * Mounts all 8 iOS-register components stacked vertically so they can be
 * pixel-compared against the Race Prep HTML reference at a 393×852 iPhone
 * viewport. Not wired into navigation — open at /dev/ios-register-kit.
 *
 * Holds no business logic. When the components are wired into real
 * product surfaces (Phase 3), this route stays as a reference.
 */

import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import {
  BeatCard,
  BeatBody,
  CoralAIPromptCard,
  CrewList,
  ForecastTileGroup,
  PermissionRuleCallout,
  QuoteCard,
  ToolbarComposer,
  WorkingOnPill,
} from '@/components/ios-register';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

export default function IosRegisterKit() {
  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: 'iOS Register Kit' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ============= Title block ============= */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>SATURDAY · IN TWO DAYS</Text>
          <Text style={styles.title}>Race 4 in 18–22 knots northeast</Text>
          <View>
            <Text style={styles.titleMeta}>
              Heavy-air helm work · Week 7 of 12
            </Text>
            <Text style={styles.titleMeta}>
              Spring Series · RHKYC · 14 boats
            </Text>
          </View>
        </View>

        {/* ============= Forecast tile group ============= */}
        <ForecastTileGroup
          tiles={[
            {
              label: 'WIND',
              value: '18–22',
              unit: 'kn',
              sub: 'NE, gusts 28',
              icon: 'arrow-up',
            },
            {
              label: 'SEA',
              value: '1.2',
              unit: 'm',
              sub: 'Building',
              icon: 'water-outline',
            },
            {
              label: 'TIDE',
              value: 'Falling',
              sub: 'LW 14:08',
              icon: 'arrow-down',
            },
            {
              label: 'SKY',
              value: 'Partly',
              sub: 'Cloud lifting',
              icon: 'partly-sunny-outline',
            },
          ]}
        />
        <Text style={styles.forecastProv}>
          RHKYC weather · updated 8:00 am
        </Text>

        {/* ============= Working-on pills ============= */}
        <Text style={styles.sectHead}>WORKING ON</Text>
        <View style={styles.workPills}>
          <WorkingOnPill
            kind="capability"
            name="Heavy-air helm work"
            state="practicing"
            icon="walk-outline"
          />
          <WorkingOnPill
            kind="concept"
            name="Trust the shift, not just the side"
            live
          />
        </View>

        {/* ============= Quote cards ============= */}
        <Text style={styles.sectHead}>FROM YOUR LAST RACE</Text>
        <View style={styles.quoteStack}>
          <QuoteCard
            quote="The mistake wasn't the plan, it was not updating it when the breeze told me to."
            provenance="Race 3 Debrief · Sunday morning"
            source="voice"
          />
          <QuoteCard
            quote="Trust the shift, not just the side."
            provenance="First time you used these words · Wednesday"
            source="ai"
          />
        </View>

        {/* ============= Beat cards ============= */}
        <View style={styles.sectHeadRow}>
          <Text style={styles.sectHead}>YOUR PLAN</Text>
          <Text style={styles.sectHeadMeta}>3 beats</Text>
        </View>
        <View style={styles.beats}>
          <BeatCard title="Start" meta="5-min sequence">
            <BeatBody>
              The line favors pin in northeast. Sam and the boats with
              heavy-air pedigree will fight for it — expect a crowd. Your
              job is not to win the pin; your job is to get off the line
              with speed, with a lane, in a fleet that's going to be
              sailing harder than they did in Race 3.
            </BeatBody>
            <BeatBody>
              Settle the boat in the last forty-five seconds. Acceleration
              matters more than position.
            </BeatBody>
          </BeatCard>

          <BeatCard title="First beat" meta="to the windward mark">
            <BeatBody>
              The right side has paid the last two races, but the
              forecast says the breeze will go left through the first
              beat. The question is when. Don't commit to a side off the
              line; sail your lane and watch the compass.
            </BeatBody>
            <BeatBody>
              Look for the left shift past the first quarter of the beat.
              If it comes, this is the race. If it doesn't, you're sailing
              the right with everyone else and the start matters more.
            </BeatBody>
          </BeatCard>

          <BeatCard title="Contingency" meta="your rule">
            <BeatBody>
              You wrote the rule yesterday after watching the forecast
              settle. It's the first rule you've written for yourself
              before a race. Sam said: write the rule before the start,
              so the rule is the only thing you have to trust when the
              moment gets loud.
            </BeatBody>
            <PermissionRuleCallout
              label="YOUR RULE"
              text="If the left fills in past ten degrees on starboard, I commit."
            />
            <BeatBody>
              Don't rewrite this in your head on the water. The rule is
              the rule. The discipline isn't reading the breeze — it's
              trusting what you've already decided.
            </BeatBody>
          </BeatCard>
        </View>

        {/* ============= Coral AI prompt card ============= */}
        <Text style={styles.sectHead}>FROM YOUR PLAYBOOK</Text>
        <View style={styles.aiPromptWrap}>
          <CoralAIPromptCard
            label="FROM YOUR PLAYBOOK"
            primaryAction={{
              label: 'Open as a concept',
              onPress: () => {},
            }}
            secondaryAction={{ label: 'Not now', onPress: () => {} }}
          >
            You've written about{' '}
            <Text style={{ fontStyle: 'italic' }}>
              Trust the shift, not just the side
            </Text>{' '}
            in three reflections since March. Want to open it as a concept
            and bring its accumulated notes into this race's prep?
          </CoralAIPromptCard>
        </View>

        {/* ============= Crew list ============= */}
        <View style={styles.sectHeadRow}>
          <Text style={styles.sectHead}>WHO'S ON THE BOAT</Text>
          <Text style={styles.sectHeadMeta}>3 on Moonraker</Text>
        </View>
        <View style={styles.crewWrap}>
          <CrewList
            members={[
              {
                id: '1',
                name: 'Sam Cooke',
                role: 'Tactician · path author',
                initials: 'SC',
                avatarColor: '#7A92A8',
              },
              {
                id: '2',
                name: 'Jess Reilly',
                role: 'Trimmer',
                initials: 'JR',
                avatarColor: '#9AA88F',
              },
              {
                id: '3',
                name: 'Danny Mok',
                role: 'Bow',
                initials: 'DM',
                avatarColor: '#B0967E',
              },
            ]}
          />
        </View>

        {/* ============= Composer ============= */}
        <ToolbarComposer
          prompt="Anything else you want to think out loud about?"
          tools={[
            { key: 'list', label: 'List', icon: 'list', onPress: () => {} },
            {
              key: 'camera',
              label: 'Camera',
              icon: 'camera',
              onPress: () => {},
            },
            {
              key: 'photo',
              label: 'Photo library',
              icon: 'image',
              onPress: () => {},
            },
            {
              key: 'audio',
              label: 'Audio',
              icon: 'mic',
              onPress: () => {},
            },
            {
              key: 'location',
              label: 'Location',
              icon: 'location',
              onPress: () => {},
            },
            {
              key: 'sparkles',
              label: 'AI suggestions',
              icon: 'sparkles',
              sparkles: true,
              onPress: () => {},
            },
          ]}
        />

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  scroll: {
    paddingTop: 12,
  },
  titleBlock: {
    paddingTop: 10,
    paddingRight: 20,
    paddingBottom: 32,
    paddingLeft: 20,
  },
  titleEyebrow: {
    ...IOS_REGISTER_TEXT.titleEyebrow,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  title: {
    ...IOS_REGISTER_TEXT.title,
    color: IOS_REGISTER.label,
    marginBottom: 14,
  },
  titleMeta: {
    ...IOS_REGISTER_TEXT.titleMeta,
    color: IOS_REGISTER.labelSecondary,
  },
  forecastProv: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 24,
    marginTop: 12,
    letterSpacing: -0.1,
  },
  sectHead: {
    ...IOS_REGISTER_TEXT.sectionEyebrow,
    color: IOS_REGISTER.labelSecondary,
    paddingTop: 32,
    paddingRight: 20,
    paddingBottom: 12,
    paddingLeft: 20,
  },
  sectHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  sectHeadMeta: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: 0.3,
    paddingTop: 32,
    paddingBottom: 12,
  },
  workPills: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'flex-start',
  },
  quoteStack: {
    paddingHorizontal: 16,
    gap: 10,
  },
  beats: {
    paddingHorizontal: 16,
    gap: 12,
  },
  aiPromptWrap: {
    paddingHorizontal: 16,
  },
  crewWrap: {
    paddingHorizontal: 16,
  },
});
