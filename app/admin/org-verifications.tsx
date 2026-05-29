/**
 * Admin queue — Org verification requests
 *
 * Slice 3 of the create-org flow. Modeled on yacht-club-claims.tsx for
 * visual consistency and because the underlying queue mechanics are
 * identical: pending list, per-row decision + notes, RPC-backed review.
 *
 * Gating is by RLS (is_betterat_platform_admin). Non-admin sessions get
 * an empty array, which renders as the empty card.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useOrgVerificationRequests,
  useReviewOrgVerificationRequest,
} from '@/hooks/useOrgVerificationRequests';
import type {
  AdminVerificationRequestRow,
  OrgVerificationDecision,
} from '@/services/OrgVerificationService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

const C = {
  bg: '#F7FAFC',
  card: '#FFFFFF',
  ink: '#172033',
  muted: '#667085',
  line: '#D9E2EC',
  blue: '#0B63CE',
  green: '#0F766E',
  red: '#B42318',
  amber: '#B45309',
} as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

function decisionLabel(decision: OrgVerificationDecision): string {
  switch (decision) {
    case 'approved':
      return 'Approve';
    case 'rejected':
      return 'Reject';
    case 'needs_info':
      return 'Needs info';
  }
}

export default function OrgVerificationsAdminScreen() {
  const { data, isLoading, error, refetch, isRefetching } =
    useOrgVerificationRequests();
  const review = useReviewOrgVerificationRequest();

  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const handleDecision = async (
    request: AdminVerificationRequestRow,
    decision: OrgVerificationDecision,
  ) => {
    try {
      await review.mutateAsync({
        requestId: request.id,
        decision,
        reviewerNotes: noteById[request.id],
      });
      setNoteById((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not update request.';
      showAlert('Review failed', message);
    }
  };

  const requests = data || [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Org verification queue' }} />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Admin Review</Text>
          <Text style={styles.title}>Org Verification Queue</Text>
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
          {error instanceof Error ? error.message : 'Could not load queue.'}
        </Text>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.blue} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.body}>No pending verification requests.</Text>
        </View>
      ) : (
        requests.map((request) => {
          const org = request.organizations;
          const requester = request.requester;
          const busy = review.isPending;
          const orgKindLabel = (org?.organization_type || 'org').replace(
            /_/g,
            ' ',
          );

          return (
            <View key={request.id} style={styles.card}>
              <View style={styles.claimHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orgName}>{org?.name || 'Organization'}</Text>
                  <Text style={styles.body}>
                    {requester?.full_name || 'Unknown'} ·{' '}
                    {requester?.email || 'no email'}
                  </Text>
                </View>
                <Text style={[styles.status, { color: C.amber }]}>pending</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.meta}>{orgKindLabel}</Text>
                <Text style={styles.meta}>
                  source: {org?.creation_source || 'unknown'}
                </Text>
                <Text style={styles.meta}>
                  interest: {org?.interest_slug || '—'}
                </Text>
                <Text style={styles.meta}>
                  submitted {formatDate(request.created_at)}
                </Text>
              </View>

              {request.proof && Object.keys(request.proof).length > 0 ? (
                <View style={styles.proofBlock}>
                  <Text style={styles.proofLabel}>Proof</Text>
                  <Text style={styles.proofBody}>
                    {JSON.stringify(request.proof, null, 2)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.body}>No proof attached.</Text>
              )}

              <TextInput
                value={noteById[request.id] || ''}
                onChangeText={(text) =>
                  setNoteById((prev) => ({ ...prev, [request.id]: text }))
                }
                style={styles.input}
                placeholder="Reviewer notes (optional)"
                multiline
                numberOfLines={2}
              />

              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionButton, styles.approve]}
                  disabled={busy}
                  onPress={() => void handleDecision(request, 'approved')}
                >
                  <Text style={styles.actionText}>
                    {decisionLabel('approved')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.moreInfo]}
                  disabled={busy}
                  onPress={() => void handleDecision(request, 'needs_info')}
                >
                  <Text style={styles.actionText}>
                    {decisionLabel('needs_info')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.reject]}
                  disabled={busy}
                  onPress={() => void handleDecision(request, 'rejected')}
                >
                  <Text style={styles.actionText}>
                    {decisionLabel('rejected')}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    padding: 20,
    gap: 14,
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
  title: { color: C.ink, fontSize: 30, fontWeight: '800' },
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
  center: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 16,
    gap: 10,
  },
  claimHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  orgName: { color: C.ink, fontSize: 20, fontWeight: '800' },
  body: { color: C.muted, fontSize: 14, lineHeight: 20 },
  status: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: {
    color: C.muted,
    backgroundColor: '#F2F4F7',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  proofBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  proofLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  proofBody: {
    color: C.ink,
    fontSize: 12,
    fontFamily: 'Courier',
    lineHeight: 16,
  },
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9 },
  approve: { backgroundColor: C.green },
  moreInfo: { backgroundColor: C.amber },
  reject: { backgroundColor: C.red },
  actionText: { color: '#FFFFFF', fontWeight: '800' },
  error: { color: C.red, fontWeight: '800' },
});
