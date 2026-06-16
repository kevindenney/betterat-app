import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import {
  BlueprintIndex,
  FleetPlansView,
  HkdwStepCard,
  InstallSheet,
  RedeemLanding,
  SmartAppBanner,
  StepDiscussionView,
  WelcomeToast,
  type BlueprintIndexStep,
  type FleetPeer,
  type StepDiscussionNote,
  type StepDiscussionReaction,
} from '@/components/onboarding';

const SAMPLE_BLUEPRINT = {
  id: 'sample-blueprint',
  title: 'Prepare for the Dragon Worlds 2027.',
  stepCount: 12,
  durationMonths: 6,
  capabilities: ['heavy-air helm', 'starts', 'wind reading', 'tactical', 'crew comms'],
};

const SAMPLE_AUTHOR = {
  name: 'Kevin Denney',
  affiliation: null,
  avatarInitials: 'KD',
  role: 'your Worlds coach',
};

const FLEET_SAMPLE = [
  { initials: 'PL', color: '#4E6A85' },
  { initials: 'BV', color: '#3E6C4E' },
  { initials: 'SN', color: '#5C3F7A' },
  { initials: 'KH', color: '#4A3F2E' },
];

const BLUEPRINT_INDEX_STEPS: BlueprintIndexStep[] = [
  { id: '1', blueprintStepId: '1', number: 1, title: 'Goal-setting · your Worlds outcome', meta: 'Week 1 · Done Apr 14', status: 'done' },
  { id: '2', blueprintStepId: '2', number: 2, title: 'Crew roster & comms baseline', meta: 'Week 2 · Done Apr 22', status: 'done' },
  { id: '3', blueprintStepId: '3', number: 3, title: 'Rig tune · light-air settings', meta: 'Week 3 · Done May 03', status: 'done' },
  { id: '4', blueprintStepId: '4', number: 4, title: 'Boat-speed baseline · all points of sail', meta: 'Current step · Week 7 · due May 22', status: 'current' },
  { id: '5', blueprintStepId: '5', number: 5, title: 'Starts · light-air, shifty breeze', meta: 'Week 9 · Phyl & Bram are on this', status: 'upcoming' },
  { id: '6', blueprintStepId: '6', number: 6, title: 'Heavy-air helm work · 25–30 kt', meta: 'Week 11 · capability: heavy-air helm', status: 'upcoming' },
  { id: '7', blueprintStepId: '7', number: 7, title: 'Local conditions · Victoria Harbour', meta: 'Week 13 · on-site practice', status: 'upcoming' },
  { id: '8', blueprintStepId: '8', number: 8, title: 'Tactical · mark roundings under pressure', meta: 'Week 15 · fleet-tactics capability', status: 'upcoming' },
];

const FLEET_PEERS: FleetPeer[] = [
  {
    id: 'phyl',
    initials: 'PL',
    avatarColorKey: 'green',
    name: 'Phyl Loong',
    whereLine: 'RHKYC · HKG-12',
    activityLine: 'On Step 4 · Boat-speed baseline · captured 2 sessions',
    currentStepNumber: 4,
    totalSteps: 12,
    status: 'same-step',
  },
  {
    id: 'bram',
    initials: 'BV',
    avatarColorKey: 'purple',
    name: 'Bram van der Veer',
    whereLine: 'KNZRV · NED-7',
    activityLine: 'Finished Step 5 · Light-air starts · 2 days ago',
    currentStepNumber: 5,
    totalSteps: 12,
    status: 'ahead',
  },
  {
    id: 'sara',
    initials: 'SN',
    avatarColorKey: 'brown',
    name: 'Sara Nilsson',
    whereLine: 'KSSS · SWE-3',
    activityLine: 'On Step 4 · Boat-speed baseline · reflecting now',
    currentStepNumber: 4,
    totalSteps: 12,
    status: 'same-step',
  },
  {
    id: 'tomi',
    initials: 'TS',
    avatarColorKey: 'green',
    name: 'Tomi Sato',
    whereLine: 'NYC · JPN-9',
    activityLine: 'Finished Step 3 · Rig tune · yesterday',
    currentStepNumber: 3,
    totalSteps: 12,
    status: 'behind',
  },
];

const DISCUSSION_NOTES: StepDiscussionNote[] = [
  {
    id: 'phyl-note',
    authorInitials: 'PL',
    authorName: 'Phyl Loong',
    authorColorKey: 'green',
    when: '2h',
    subContext: 'Captured Saturday · 12–16 kt',
    body:
      '“Hit target on close reach (5.8 kt) but lost 0.3 kt on the broad reach — traveller was probably too high. Trying again Wednesday with the kicker on harder.”',
    evidence: [
      { kind: 'voice', label: '2:14 voice' },
      { kind: 'photo', label: '3 photos' },
      { kind: 'data', label: 'polar data' },
    ],
    coachReply: {
      authorInitials: 'KD',
      authorName: 'Kevin Denney',
      body:
        'Good catch on the traveller. Try 3–40 mm down from the kingpost on the broad reach with the kicker pulled on. Should pull the leech tight without stalling the top batten.',
    },
    reactions: { fire: 12, insight: 4, question: 3 },
    viewerReactions: ['fire'],
  },
  {
    id: 'sara-note',
    authorInitials: 'SN',
    authorName: 'Sara Nilsson',
    authorColorKey: 'brown',
    when: '5h',
    subContext: 'Reflecting · first attempt',
    body:
      '“Anyone else finding the upwind numbers feel faster than the polar predicts when we\'re flat?”',
    reactions: { fire: 5, insight: 9, question: 7 },
    viewerReactions: ['insight'],
  },
];

export default function Phase10Debug() {
  const [installVisible, setInstallVisible] = useState(false);
  const [variant, setVariant] = useState<'valid' | 'invalid'>('valid');
  const [discussionReactions, setDiscussionReactions] = useState<
    Record<string, StepDiscussionReaction[]>
  >({});

  const notesWithOptimistic: StepDiscussionNote[] = DISCUSSION_NOTES.map((n) => {
    const opt = discussionReactions[n.id];
    return opt ? { ...n, viewerReactions: opt } : n;
  });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Phase 10 · HKDW onboarding' }} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Smart App Banner (web only)">
          <View style={styles.bannerHost}>
            <SmartAppBanner
              appName="BetterAt"
              description="Open in app for voice capture & offline"
              installUrl="https://apps.apple.com/app/betterat"
              page="debug/phase10"
            />
          </View>
          <Text style={styles.note}>
            Pins to the top of every web page. 7-day localStorage dismissal. iOS Safari-only —
            native renders nothing.
          </Text>
        </Section>

        <Section title="Welcome toast — web (subscription)">
          <WelcomeToast
            variant="subscription"
            subscriptionSource="Kevin's HKDW blueprint"
            count={{ steps: 12, freeMonths: 3, fleetSize: 63 }}
          />
        </Section>

        <Section title="Welcome toast — native (You're back)">
          <WelcomeToast
            variant="native-resume"
            subscriptionSource="Kevin's HKDW blueprint"
            count={{ steps: 12, freeMonths: 3, fleetSize: 63 }}
          />
        </Section>

        <Section title="Redeem landing (mobile Safari)">
          <View style={styles.variantRow}>
            <Pressable
              style={[styles.chip, variant === 'valid' && styles.chipActive]}
              onPress={() => setVariant('valid')}
            >
              <Text style={[styles.chipText, variant === 'valid' && styles.chipTextActive]}>
                Valid token
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, variant === 'invalid' && styles.chipActive]}
              onPress={() => setVariant('invalid')}
            >
              <Text style={[styles.chipText, variant === 'invalid' && styles.chipTextActive]}>
                Invalid token
              </Text>
            </Pressable>
          </View>
          <View style={styles.landingHost}>
            {variant === 'valid' ? (
              <RedeemLanding
                token="HKDW-WLDS-2027-SAMPLE"
                blueprintAuthor={SAMPLE_AUTHOR}
                blueprint={SAMPLE_BLUEPRINT}
                fleetCount={63}
                fleetSampleAvatars={FLEET_SAMPLE}
                freeMonths={3}
                postFreePrice="$9/mo"
                welcomePillText="Welcoming you · 90 days free"
                fleetTagline="63 Worlds sailors already started"
                fleetSubline="Same race · same conditions · same fleet"
                blueprintSubtitle="A path through the conditions you'll race in November — boat speed, heavy-air helm work, starts, fleet tactics."
                blueprintVersionLine="Updated April · v3.2"
                onAccept={async () => undefined}
                onSkip={() => undefined}
              />
            ) : (
              <View style={styles.invalidHost}>
                <Text style={styles.invalidTitle}>
                  This invitation has expired or already been used
                </Text>
                <Text style={styles.invalidBody}>
                  Reach out to whoever shared it for a fresh link.
                </Text>
              </View>
            )}
          </View>
        </Section>

        <Section title="First-action step card · web variant">
          <HkdwStepCard
            variant="web"
            blueprintShortName="HKDW Prep"
            blueprintWeekLine="Week 1 of 24"
            stepCounter="Step 1 of 12"
            stepTitle="Boat-speed baseline · all points of sail"
            fromLine="Kevin's Prepare for the Worlds"
            activePhase="plan"
            totalSailors={63}
            onTapBlueprintStrip={() =>
              router.push('/practice/blueprint/hkdw-prepare-for-the-worlds' as any)
            }
          />
        </Section>

        <Section title="First-action step card · native variant">
          <HkdwStepCard
            variant="native"
            blueprintShortName="HKDW Prep"
            blueprintWeekLine="Week 1 of 24"
            stepCounter="Step 1 of 12"
            stepTitle="Boat-speed baseline · all points of sail"
            fromLine="Kevin's Prepare for the Worlds"
            fleetChipLabel="Worlds Fleet · 63 sailors"
            activePhase="plan"
            onTapBlueprintStrip={() =>
              router.push('/practice/blueprint/hkdw-prepare-for-the-worlds' as any)
            }
            onTapFleetChip={() =>
              router.push('/practice/blueprint/hkdw-prepare-for-the-worlds/fleet' as any)
            }
            onTapDiscussion={() => router.push('/practice/step/boat-speed/discussion' as any)}
          />
        </Section>

        <Section title="Install sheet (Do tab on web)">
          <Pressable style={styles.btn} onPress={() => setInstallVisible(true)}>
            <Text style={styles.btnText}>Open install sheet</Text>
          </Pressable>
        </Section>

        <Section title="Surface A · Blueprint index (full preview)">
          <View style={[styles.landingHost, { minHeight: 720 }]}>
            <BlueprintIndex
              author={{
                initials: 'KD',
                name: 'Kevin Denney',
                role: 'Worlds-qualified Dragon helm',
                version: 'v3.2',
              }}
              blueprintTitle="Prepare for the Dragon Worlds 2027."
              metaLine="12 steps · 6 months · 5 capabilities developed"
              weekLine="Week 7 of 24"
              steps={BLUEPRINT_INDEX_STEPS}
              onAddStep={() => undefined}
            />
          </View>
        </Section>

        <Section title="Surface B · Worlds Fleet (full preview)">
          <View style={[styles.landingHost, { minHeight: 720 }]}>
            <FleetPlansView
              heroTitle={'Worlds Fleet · "Prepare for the Worlds"'}
              metaLine="63 sailors subscribed · 8 in your week"
              stats={[
                { value: 63, label: 'Subscribed' },
                { value: 47, label: 'Active 7d' },
                { value: 8, label: 'On Step 4' },
              ]}
              viewerCurrentStepNumber={4}
              peers={FLEET_PEERS}
            />
          </View>
        </Section>

        <Section title="Surface C · Step discussion (full preview)">
          <View style={[styles.landingHost, { minHeight: 720 }]}>
            <StepDiscussionView
              topTitle="Step 4"
              preTitle="Step 4 · Discussion"
              stepTitle="Boat-speed baseline · all points of sail"
              metaLine="From Kevin's Prepare for the Worlds · 8 sailors on this step"
              hereNow={{
                avatars: [
                  { initials: 'PL', colorKey: 'navy' },
                  { initials: 'SN', colorKey: 'green' },
                  { initials: 'MO', colorKey: 'purple' },
                  { initials: '+5', colorKey: 'brown' },
                ],
                text: '8 sailors are working through Step 4 right now · 4 captured sessions this week',
              }}
              discussionCount={14}
              notes={notesWithOptimistic}
              composerPlaceholder="Share your boat-speed reflection…"
              onReact={(noteId, kind) => {
                setDiscussionReactions((prev) => {
                  const current =
                    prev[noteId] ?? DISCUSSION_NOTES.find((n) => n.id === noteId)?.viewerReactions ?? [];
                  const next = current.includes(kind)
                    ? current.filter((k) => k !== kind)
                    : [...current, kind];
                  return { ...prev, [noteId]: next };
                });
              }}
            />
          </View>
        </Section>

        <Section title="Live routes (in this environment)">
          <Pressable
            style={styles.btn}
            onPress={() => router.push('/r/HKDW-WLDS-2026-SAMPLE' as any)}
          >
            <Text style={styles.btnText}>Open /r/HKDW-WLDS-2026-SAMPLE (sample redeem)</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() => router.push('/practice/step/boat-speed' as any)}
          >
            <Text style={styles.btnText}>Open /practice/step/boat-speed (first-action)</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() =>
              router.push('/practice/blueprint/hkdw-prepare-for-the-worlds' as any)
            }
          >
            <Text style={styles.btnText}>Open blueprint index (sample)</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() =>
              router.push('/practice/blueprint/hkdw-prepare-for-the-worlds/fleet' as any)
            }
          >
            <Text style={styles.btnText}>Open Worlds Fleet (sample)</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() => router.push('/practice/step/boat-speed/discussion' as any)}
          >
            <Text style={styles.btnText}>Open Step Discussion (sample)</Text>
          </Pressable>
          <Text style={styles.note}>
            Sample data is mocked in dev — no DB side effects. Flag must be on
            (EXPO_PUBLIC_FF_HKDW_REDEEM_FLOW=true).
          </Text>
        </Section>
      </ScrollView>

      <InstallSheet
        visible={installVisible}
        appName="BetterAt"
        page="debug/phase10"
        onInstall={() => setInstallVisible(false)}
        onNotNow={() => setInstallVisible(false)}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  note: {
    fontSize: 12,
    color: '#6B7280',
  },
  bannerHost: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  variantRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  chipActive: {
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  landingHost: {
    minHeight: 620,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  invalidHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 80,
    gap: 8,
  },
  invalidTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  invalidBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
