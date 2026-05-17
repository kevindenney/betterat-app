/**
 * /debug/step-loop-primitives — Phase 0 smoke screen.
 *
 * Renders every step-loop primitive in every state with hardcoded data.
 * No network, no providers, no flag-gating. Lets QA verify visual
 * fidelity against the canonicals in
 *   docs/redesign/ios-register/b10-reflect-home-canonical.html
 *   docs/redesign/ios-register/step-loop-integration-canonical.html
 *
 * Brief: docs/redesign/ios-register/phase-0-shared-chrome.md (§ Smoke screen).
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, History, Plus } from 'lucide-react-native';
import { Stack } from 'expo-router';
import {
  PhaseTabs,
  StatePill,
  StepCard,
  StepStrip,
  TopHeader,
  type PhaseId,
  type PhaseState,
  type StatePillVariant,
} from '@/components/step-loop';
import {
  GRAY_5,
  GRAY_6,
  IOS_BLUE,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

const STATE_PILL_VARIANTS: { variant: StatePillVariant; label: string }[] = [
  { variant: 'planned', label: 'Planned' },
  { variant: 'current', label: 'Current' },
  { variant: 'live', label: 'Live · capturing' },
  { variant: 'complete', label: 'Complete' },
  { variant: 'reflect', label: 'Reflect · Season in view' },
  { variant: 'settled', label: 'Settled' },
  { variant: 'between', label: 'Between · hinge' },
];

const PHASE_STATES: PhaseState[] = ['pending', 'ready', 'live'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <Text style={styles.caption}>{children}</Text>;
}

function PhaseTabsRow({
  plan,
  do: doState,
  reflect,
  active,
}: {
  plan: PhaseState;
  do: PhaseState;
  reflect: PhaseState;
  active: PhaseId;
}) {
  const [current, setCurrent] = useState<PhaseId>(active);
  return (
    <PhaseTabs
      plan={plan}
      do={doState}
      reflect={reflect}
      active={current}
      onTabPress={setCurrent}
    />
  );
}

export default function StepLoopPrimitivesDebug() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Step Loop · Primitives',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: LABEL,
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.headline}>Step Loop · Phase 0 primitives</Text>
        <Text style={styles.lede}>
          Every component in every state. Hardcoded — no network. Compare against
          the canonicals in docs/redesign/ios-register/.
        </Text>

        {/* StatePill */}
        <Section title="<StatePill> · 7 variants">
          <View style={styles.pillStack}>
            {STATE_PILL_VARIANTS.map((spec) => (
              <View key={spec.variant} style={styles.pillRow}>
                <StatePill variant={spec.variant} label={spec.label} />
                <Text style={styles.variantTag}>{spec.variant}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="<StatePill> · with stats group">
          <View style={styles.pillStack}>
            <View style={styles.pillRow}>
              <View style={{ flex: 1 }}>
                <StatePill
                  variant="reflect"
                  label="Reflect · Season in view"
                  stats={[
                    { num: '24', label: 'Wks to Worlds' },
                    { num: '3', label: 'Races in' },
                  ]}
                />
              </View>
            </View>
            <View style={styles.pillRow}>
              <View style={{ flex: 1 }}>
                <StatePill
                  variant="live"
                  label="Live · capturing"
                  stats={[
                    { num: '4', label: 'Captures' },
                    { num: '12:36', label: 'Elapsed' },
                  ]}
                />
              </View>
            </View>
          </View>
        </Section>

        {/* StepStrip */}
        <Section title="<StepStrip>">
          <View style={styles.stripStack}>
            <StepStrip
              icon="flag-3"
              primary="Spring Series"
              secondary="week 7 of 12 · Race 4 in two days"
            />
            <StepStrip icon="trophy" primary="Worlds 2026" secondary="24 weeks out" />
            <StepStrip icon="flag" primary="Light-air starts in shifty breeze" />
            <StepStrip
              icon="flag-3"
              primary="A very long primary segment that should truncate gracefully"
              secondary="and a tail that is just as long and runs past the visible bound"
            />
          </View>
        </Section>

        {/* TopHeader */}
        <Section title="<TopHeader>">
          <Caption>Interest dropdown · step counter · right cluster (no card)</Caption>
          <View style={styles.headerHost}>
            <TopHeader
              interestName="Sail Racing"
              stepCounter="Step 4 of 10"
              rightCluster={
                <>
                  <Pressable hitSlop={6}>
                    <Bell size={19} color={LABEL_2} />
                  </Pressable>
                  <Pressable hitSlop={6}>
                    <History size={19} color={IOS_BLUE} />
                  </Pressable>
                  <Pressable hitSlop={6}>
                    <Plus size={19} color={LABEL_2} />
                  </Pressable>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>KD</Text>
                  </View>
                </>
              }
            />
          </View>
          <Caption>Back chevron mode · for Reflect / Trophy detail</Caption>
          <View style={styles.headerHost}>
            <TopHeader backLabel="Race 4" stepCounter="Step 4 of 10" />
          </View>
          <Caption>Minimal · interest only</Caption>
          <View style={styles.headerHost}>
            <TopHeader interestName="Nursing" />
          </View>
        </Section>

        {/* PhaseTabs */}
        <Section title="<PhaseTabs>">
          <Caption>plan=ready · do=pending · reflect=pending · active=plan</Caption>
          <View style={styles.tabsHost}>
            <PhaseTabsRow plan="ready" do="pending" reflect="pending" active="plan" />
          </View>
          <Caption>plan=ready · do=live · reflect=pending · active=do</Caption>
          <View style={styles.tabsHost}>
            <PhaseTabsRow plan="ready" do="live" reflect="pending" active="do" />
          </View>
          <Caption>plan=ready · do=ready · reflect=ready · active=reflect</Caption>
          <View style={styles.tabsHost}>
            <PhaseTabsRow plan="ready" do="ready" reflect="ready" active="reflect" />
          </View>
          <Caption>All-pending variants (3 × 3 × 3 = 27 total combos — sampling)</Caption>
          {PHASE_STATES.map((p) => (
            <View key={p} style={styles.tabsHost}>
              <PhaseTabsRow plan={p} do={p} reflect={p} active="plan" />
            </View>
          ))}
        </Section>

        {/* StepCard — full assemblies */}
        <Section title="<StepCard> · planned · plan tab active">
          <View style={styles.cardHost}>
            <StepCard
              pill={<StatePill variant="planned" label="Planned" />}
              onMenuPress={() => undefined}
              stepStrip={
                <StepStrip
                  icon="flag-3"
                  primary="Spring Series"
                  secondary="Race 4 · beat 2"
                />
              }
              titleBlock={
                <View>
                  <Text style={styles.titleBlockHeadline}>Light-air starts in shifty breeze</Text>
                  <Text style={styles.titleBlockMeta}>Step 4 of 10 · drafted yesterday</Text>
                </View>
              }
              phaseTabs={
                <PhaseTabsRow plan="pending" do="pending" reflect="pending" active="plan" />
              }
            >
              <View style={styles.cardBodyPad}>
                <Text style={styles.bodyText}>Plan body content goes here.</Text>
              </View>
            </StepCard>
          </View>
        </Section>

        <Section title="<StepCard> · live · do tab active · with stats">
          <View style={styles.cardHost}>
            <StepCard
              pill={
                <StatePill
                  variant="live"
                  label="Live · capturing"
                  stats={[
                    { num: '4', label: 'Captures' },
                    { num: '12:36', label: 'Elapsed' },
                  ]}
                />
              }
              onMenuPress={() => undefined}
              stepStrip={
                <StepStrip
                  icon="flag-3"
                  primary="Spring Series"
                  secondary="Race 4 · beat 2"
                />
              }
              phaseTabs={
                <PhaseTabsRow plan="ready" do="live" reflect="pending" active="do" />
              }
            >
              <View style={styles.cardBodyPad}>
                <Text style={styles.bodyText}>Do stream goes here — capture cards.</Text>
              </View>
            </StepCard>
          </View>
        </Section>

        <Section title="<StepCard> · reflect · season in view">
          <View style={styles.cardHost}>
            <StepCard
              pill={
                <StatePill
                  variant="reflect"
                  label="Reflect · Season in view"
                  stats={[
                    { num: '24', label: 'Wks to Worlds' },
                    { num: '3', label: 'Races in' },
                  ]}
                />
              }
              onMenuPress={() => undefined}
              stepStrip={
                <StepStrip
                  icon="flag-3"
                  primary="Spring Series"
                  secondary="week 7 of 12 · Race 4 in two days"
                />
              }
              phaseTabs={
                <PhaseTabsRow plan="ready" do="ready" reflect="ready" active="reflect" />
              }
              footer={
                <Pressable style={styles.footerCta} accessibilityRole="button">
                  <Text style={styles.footerCtaText}>Capture a reflection</Text>
                </Pressable>
              }
            >
              <View style={styles.cardBodyPad}>
                <Text style={styles.bodyText}>Reflect body — serif year-so-far paragraph here.</Text>
              </View>
            </StepCard>
          </View>
        </Section>

        <Section title="<StepCard> · complete · no menu, no strip">
          <View style={styles.cardHost}>
            <StepCard
              pill={<StatePill variant="complete" label="Complete" />}
              phaseTabs={
                <PhaseTabsRow plan="ready" do="ready" reflect="ready" active="reflect" />
              }
            >
              <View style={styles.cardBodyPad}>
                <Text style={styles.bodyText}>Closed-step body.</Text>
              </View>
            </StepCard>
          </View>
        </Section>

        <View style={{ height: 64 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GRAY_6,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  headline: {
    paddingHorizontal: 20,
    fontSize: 22,
    fontWeight: '600',
    color: LABEL,
    letterSpacing: -0.4,
  },
  lede: {
    paddingHorizontal: 20,
    fontSize: 14,
    color: LABEL_3,
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 20,
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    fontSize: 11,
    fontWeight: '700',
    color: LABEL_2,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionBody: {
    paddingHorizontal: 14,
    gap: 10,
  },
  caption: {
    paddingHorizontal: 6,
    fontSize: 11,
    color: LABEL_3,
    fontStyle: 'italic',
    marginTop: 8,
  },
  pillStack: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  variantTag: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: LABEL_3,
  },
  stripStack: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    overflow: 'hidden',
  },
  headerHost: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    overflow: 'hidden',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4E6A85',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  tabsHost: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    overflow: 'hidden',
  },
  cardHost: {
    height: 480,
  },
  cardBodyPad: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  bodyText: {
    fontSize: 14,
    color: LABEL_2,
    lineHeight: 20,
  },
  titleBlockHeadline: {
    fontSize: 21,
    fontWeight: '600',
    color: LABEL,
    letterSpacing: -0.45,
    lineHeight: 24,
  },
  titleBlockMeta: {
    fontSize: 11.5,
    color: LABEL_3,
    marginTop: 5,
  },
  footerCta: {
    backgroundColor: IOS_BLUE,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
