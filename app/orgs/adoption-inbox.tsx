/**
 * Adoption inbox — the founder's view of pending adoption proposals.
 *
 * Slice 4A of the create-org flow. Shows requests visible to the user via
 * RLS: pending adoptions targeting orgs they admin, requests they proposed,
 * and (for platform admins) everything. Separated into Inbox vs Outbox by
 * comparing rows against the signed-in user id.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/providers/AuthProvider';
import {
  useDecideAdoption,
  useOrgAdoptionRequests,
} from '@/hooks/useOrgAdoptionRequests';
import type { AdoptionRequestRowWithOrgs } from '@/services/OrgAdoptionService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

const C = {
  bg: '#F7FAFC',
  card: '#FFFFFF',
  ink: '#172033',
  muted: '#667085',
  line: '#D9E2EC',
  blue: '#0B63CE',
  green: '#0F766E',
  red: '#B42318',
} as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

export default function AdoptionInboxScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } =
    useOrgAdoptionRequests();
  const decide = useDecideAdoption();

  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const { inbox, outbox } = useMemo(() => {
    const rows = data || [];
    const inboxRows: AdoptionRequestRowWithOrgs[] = [];
    const outboxRows: AdoptionRequestRowWithOrgs[] = [];
    for (const row of rows) {
      if (user?.id && row.proposed_by === user.id) {
        outboxRows.push(row);
      } else {
        inboxRows.push(row);
      }
    }
    return { inbox: inboxRows, outbox: outboxRows };
  }, [data, user?.id]);

  const handleDecide = async (
    request: AdoptionRequestRowWithOrgs,
    decision: 'accepted' | 'declined' | 'withdrawn',
  ) => {
    try {
      await decide.mutateAsync({
        requestId: request.id,
        decision,
        decisionNotes: noteById[request.id],
      });
      setNoteById((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      if (decision === 'accepted' && request.target?.slug) {
        // Redirect to the (now-verified) target org so the founder lands on
        // the new state of their fleet.
        router.push(`/discover/org/${request.target.slug}?from=adopted` as any);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not update request.';
      showAlert('Adoption decision failed', message);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Adoption inbox' }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Orgs</Text>
          <Text style={styles.title}>Adoption inbox</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={() => void refetch()}>
          <Ionicons
            name={isRefetching ? 'sync' : 'refresh-outline'}
            size={16}
            color={C.ink}
          />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {error ? (
        <Text style={styles.error}>
          {error instanceof Error ? error.message : 'Could not load requests.'}
        </Text>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.blue} />
        </View>
      ) : (
        <>
          <Section title="Adoption requests for your orgs">
            {inbox.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.body}>No pending adoption requests.</Text>
              </View>
            ) : (
              inbox.map((row) => (
                <InboxCard
                  key={row.id}
                  row={row}
                  note={noteById[row.id] || ''}
                  busy={decide.isPending}
                  onChangeNote={(text) =>
                    setNoteById((prev) => ({ ...prev, [row.id]: text }))
                  }
                  onAccept={() => void handleDecide(row, 'accepted')}
                  onDecline={() => void handleDecide(row, 'declined')}
                />
              ))
            )}
          </Section>

          <Section title="Requests you proposed">
            {outbox.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.body}>None pending.</Text>
              </View>
            ) : (
              outbox.map((row) => (
                <OutboxCard
                  key={row.id}
                  row={row}
                  busy={decide.isPending}
                  onWithdraw={() => void handleDecide(row, 'withdrawn')}
                />
              ))
            )}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function InboxCard({
  row,
  note,
  busy,
  onChangeNote,
  onAccept,
  onDecline,
}: {
  row: AdoptionRequestRowWithOrgs;
  note: string;
  busy: boolean;
  onChangeNote: (text: string) => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHeadline}>
        <Text style={styles.cardOrg}>
          {row.proposedParent?.name || 'A verified org'}
        </Text>
        <Text style={styles.body}> wants to adopt </Text>
        <Text style={styles.cardOrg}>{row.target?.name || 'your org'}</Text>
      </Text>
      <Text style={styles.cardSub}>
        Proposed by {row.proposer?.full_name || row.proposer?.email || 'them'} ·{' '}
        {formatDate(row.created_at)}
      </Text>
      {row.message ? <Text style={styles.cardMessage}>{row.message}</Text> : null}
      <Text style={styles.cardHint}>
        On accept, your org becomes verified under{' '}
        {row.proposedParent?.name || 'the parent'}. Your blueprints carry over
        with a “Carried over” pill. You stay admin.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Reply note (optional)"
        placeholderTextColor={IOS_REGISTER.labelTertiary}
        value={note}
        onChangeText={onChangeNote}
        multiline
        numberOfLines={2}
      />

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.accept]}
          disabled={busy}
          onPress={onAccept}
        >
          <Text style={styles.actionText}>Accept</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.decline]}
          disabled={busy}
          onPress={onDecline}
        >
          <Text style={styles.actionText}>Decline</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OutboxCard({
  row,
  busy,
  onWithdraw,
}: {
  row: AdoptionRequestRowWithOrgs;
  busy: boolean;
  onWithdraw: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHeadline}>
        You proposed{' '}
        <Text style={styles.cardOrg}>
          {row.proposedParent?.name || 'your parent org'}
        </Text>
        <Text style={styles.body}> adopt </Text>
        <Text style={styles.cardOrg}>{row.target?.name || 'a fleet'}</Text>
      </Text>
      <Text style={styles.cardSub}>Sent {formatDate(row.created_at)}</Text>
      {row.message ? <Text style={styles.cardMessage}>{row.message}</Text> : null}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.withdraw]}
          disabled={busy}
          onPress={onWithdraw}
        >
          <Text style={styles.actionText}>Withdraw</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: { color: C.ink, fontSize: 28, fontWeight: '800' },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  refreshText: { color: C.ink, fontWeight: '800' },
  center: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  cardHeadline: { color: C.ink, fontSize: 18, fontWeight: '700', lineHeight: 24 },
  cardOrg: { color: C.ink, fontSize: 18, fontWeight: '800' },
  cardSub: { color: C.muted, fontSize: 13 },
  cardMessage: {
    color: C.ink,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
  },
  cardHint: { color: C.muted, fontSize: 12, lineHeight: 16 },
  body: { color: C.muted, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.ink,
    backgroundColor: '#FFFFFF',
    minHeight: 56,
    textAlignVertical: 'top',
  },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  accept: { backgroundColor: IOS_COLORS.systemBlue },
  decline: { backgroundColor: C.red },
  withdraw: { backgroundColor: C.muted },
  actionText: { color: '#FFFFFF', fontWeight: '800' },
  error: { color: C.red, fontWeight: '800' },
});
