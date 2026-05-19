import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { ShareCaptureSheet, ShareStepSheet } from '@/components/share';
import { FleetView, FleetCaptureCard } from '@/components/practice';
import { SharedWithYouInbox } from '@/components/discover/SharedWithYouInbox';
import type { CaptureVisibility, SharedInboxItem } from '@/types/sharing';
import type { FleetCaptureRow } from '@/services/FleetCaptureFeedService';

const DEMO_STEP = {
  id: 'demo-step',
  title: 'Light-air starts in shifty breeze',
  body: 'Hold a clean lane off the favored end. Re-check rig if puffs over 14 kn.',
};

const DEMO_RECIPIENTS = [
  { id: 'r1', initials: 'HE', name: 'Henrik' },
  { id: 'r2', initials: 'PL', name: 'Phyl' },
  { id: 'r3', initials: 'BV', name: 'Bram' },
  { id: 'r4', initials: 'SC', name: 'Sam' },
];

const DEMO_CAPTURE = {
  id: 'demo-capture',
  kind: 'voice' as const,
  body: 'Left filled at eight. Not committing yet — rule said ten.',
  timestamp: new Date().toISOString(),
  audioDurationSec: 12,
};

const DEMO_FLEET_ROWS: FleetCaptureRow[] = [
  {
    id: 'fr1',
    stepId: 'demo-step',
    authorUserId: 'me',
    authorName: 'You',
    authorInitials: 'KD',
    authorIsMe: true,
    capturedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    kind: 'voice',
    body: 'Left filled at eight. Not committing yet.',
    visibility: 'fleet',
    kindTag: 'voice',
    boatName: 'Moonraker',
  },
  {
    id: 'fr2',
    stepId: 'demo-step',
    authorUserId: 'pl',
    authorName: 'Phyl Loong',
    authorInitials: 'PL',
    authorIsMe: false,
    capturedAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    kind: 'voice',
    body: 'Same left building. Committing on the next puff.',
    visibility: 'fleet',
    kindTag: 'voice',
    boatName: 'Snowflake',
  },
];

const DEMO_INBOX: SharedInboxItem[] = [
  {
    id: 'inbox-1',
    kind: 'step',
    shared_step_id: 'inbox-1',
    step_id: 'demo-step',
    sender_user_id: 'pl',
    sender_name: 'Phyl Loong',
    sender_initials: 'PL',
    step_title: 'Pre-start fleet positioning',
    step_body: 'Stage early off the boat end. Burn time low. Tack into the lane at -45.',
    shared_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    read_at: null,
    forked_to_step_id: null,
  },
  {
    id: 'inbox-2',
    kind: 'step',
    shared_step_id: 'inbox-2',
    step_id: 'demo-step-2',
    sender_user_id: 'bv',
    sender_name: 'Bram van Olphen',
    sender_initials: 'BV',
    step_title: 'Wind-shift reading from windward mark',
    step_body: 'When right pressure builds, expect 5–8° lift on lay. Stay defensive.',
    shared_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    read_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    forked_to_step_id: 'forked-1',
  },
];

export default function Phase8Debug() {
  const [shareStepVisible, setShareStepVisible] = useState(false);
  const [captureVisible, setCaptureVisible] = useState(false);
  const [captureVis, setCaptureVis] = useState<CaptureVisibility>('private');
  const [fleetFilter, setFleetFilter] = useState<string>('all');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Phase 8 · Demo' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Share-a-step sheet">
          <Pressable style={styles.btn} onPress={() => setShareStepVisible(true)}>
            <Text style={styles.btnText}>Open share-step sheet</Text>
          </Pressable>
        </Section>

        <Section title="Share-a-capture sheet">
          <Pressable style={styles.btn} onPress={() => setCaptureVisible(true)}>
            <Text style={styles.btnText}>Open share-capture sheet ({captureVis})</Text>
          </Pressable>
        </Section>

        <Section title="Fleet view (mocked feed)">
          <View style={styles.fleetHost}>
            <FleetView
              step={{
                id: 'demo-step',
                title: 'Race 4 · 18–22 kn NE',
                settledLabel: 'Saturday',
                eventLabel: 'RHKYC Spring Series',
              }}
              stats={{ boats: 14, captures: DEMO_FLEET_ROWS.length, yours: 1, yourFinish: '7th' }}
              filterChips={[
                { id: 'all', label: 'All', count: DEMO_FLEET_ROWS.length },
                { id: 'mine', label: 'Yours', count: 1 },
                { id: 'others', label: 'Others', count: DEMO_FLEET_ROWS.length - 1 },
              ]}
              activeFilterIds={[fleetFilter]}
              onFilterToggle={setFleetFilter}
              captures={
                fleetFilter === 'mine'
                  ? DEMO_FLEET_ROWS.filter((r) => r.authorIsMe)
                  : fleetFilter === 'others'
                    ? DEMO_FLEET_ROWS.filter((r) => !r.authorIsMe)
                    : DEMO_FLEET_ROWS
              }
              timeMarkers={[{ atTime: new Date(Date.now() - 6 * 60 * 1000).toISOString(), label: 'Beat 2 · 14:08' }]}
            />
          </View>
        </Section>

        <Section title="Fleet capture card · ownership">
          <View style={styles.cardRow}>
            <FleetCaptureCard capture={DEMO_FLEET_ROWS[0]} />
            <FleetCaptureCard capture={DEMO_FLEET_ROWS[1]} />
          </View>
        </Section>

        <Section title="Shared-with-you inbox">
          <View style={styles.fleetHost}>
            <SharedWithYouInbox
              items={DEMO_INBOX}
              onView={() => undefined}
              onFork={() => undefined}
              onComment={() => undefined}
            />
          </View>
        </Section>
      </ScrollView>

      <ShareStepSheet
        visible={shareStepVisible}
        step={DEMO_STEP}
        recentRecipients={DEMO_RECIPIENTS}
        defaultGroup={{ id: 'fleet-1', name: 'RHKYC Spring', memberCount: 14 }}
        onShareDirect={async () => setShareStepVisible(false)}
        onShareToGroup={async () => setShareStepVisible(false)}
        onCopyLink={async () => 'https://better.at/s/DEMO12345'}
        onDismiss={() => setShareStepVisible(false)}
      />

      <ShareCaptureSheet
        visible={captureVisible}
        capture={DEMO_CAPTURE}
        currentVisibility={captureVis}
        isNursing={false}
        onChangeVisibility={async (v) => {
          setCaptureVis(v);
        }}
        onDismiss={() => setCaptureVisible(false)}
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
  btn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fleetHost: {
    height: 540,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  cardRow: {
    gap: 10,
  },
});
