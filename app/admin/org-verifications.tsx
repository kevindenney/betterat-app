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
import { useAuth } from '@/providers/AuthProvider';
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

type VerificationTab = 'pending' | 'history';

function isPlatformAdminUser(user: any | null): boolean {
  if (!user) return false;
  const allowed = new Set(['admin', 'platform_admin', 'betterat_admin']);
  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  const appRoles = Array.isArray(user.app_metadata?.roles)
    ? user.app_metadata.roles
    : [];

  return (
    allowed.has(appRole) ||
    allowed.has(userRole) ||
    appRoles.some((role: unknown) => typeof role === 'string' && allowed.has(role))
  );
}

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

function statusTone(status: string | null | undefined): string {
  switch (status) {
    case 'approved':
      return C.green;
    case 'rejected':
      return C.red;
    case 'needs_info':
      return C.amber;
    default:
      return C.muted;
  }
}

export default function OrgVerificationsAdminScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<VerificationTab>('pending');
  const { data, isLoading, error, refetch, isRefetching } =
    useOrgVerificationRequests(tab);
  const review = useReviewOrgVerificationRequest();
  const canReview = isPlatformAdminUser(user);

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
      <Stack.Screen options={{ headerShown: true, title: 'Org verification queue' }} />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{canReview ? 'Admin Review' : 'Your Requests'}</Text>
          <Text style={styles.title}>
            {canReview ? 'Org Verification Queue' : 'Org Verification Requests'}
          </Text>
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

      <View style={styles.tabsRow}>
        {(['pending', 'history'] as VerificationTab[]).map((value) => {
          const active = tab === value;
          return (
            <Pressable
              key={value}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setTab(value)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {value === 'pending' ? 'Pending' : 'History'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text style={styles.error}>
          {error instanceof Error ? error.message : 'Could not load queue.'}
        </Text>
      ) : null}

      {!canReview ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            {tab === 'pending' ? 'Pending BetterAt review' : 'Review history'}
          </Text>
          <Text style={styles.body}>
            You can see requests you submitted. Only BetterAt platform admins can approve or reject them.
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.blue} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.body}>
            {tab === 'pending'
              ? 'No pending verification requests.'
              : 'No verification request history yet.'}
          </Text>
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
                <Text style={[styles.status, { color: statusTone(request.status) }]}>
                  {request.status || 'unknown'}
                </Text>
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
                {request.decided_at ? (
                  <Text style={styles.meta}>
                    decided {formatDate(request.decided_at)}
                  </Text>
                ) : null}
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

              {request.reviewer || request.reviewer_notes ? (
                <View style={styles.historyBlock}>
                  <Text style={styles.historyLabel}>Review</Text>
                  <Text style={styles.body}>
                    {request.reviewer?.full_name || request.reviewer?.email || 'BetterAt admin'}
                    {request.decided_at ? ` · ${formatDate(request.decided_at)}` : ''}
                  </Text>
                  {request.reviewer_notes ? (
                    <Text style={styles.historyNote}>{request.reviewer_notes}</Text>
                  ) : null}
                </View>
              ) : null}

              {canReview && request.status === 'pending' ? (
                <>
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
                </>
              ) : request.status === 'pending' ? (
                <Text style={styles.body}>
                  Awaiting BetterAt platform-admin review.
                </Text>
              ) : null}
              {tab === 'history' && request.status !== 'pending' && !request.reviewer_notes ? (
                <Text style={styles.body}>
                  No reviewer note recorded.
                </Text>
              ) : null}
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabBtnActive: {
    backgroundColor: '#EAF2FF',
    borderColor: '#BFD3F6',
  },
  tabText: {
    color: C.muted,
    fontWeight: '700',
  },
  tabTextActive: {
    color: C.ink,
  },
  infoCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 16,
    gap: 6,
  },
  infoTitle: { color: C.ink, fontSize: 16, fontWeight: '800' },
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
  historyBlock: {
    backgroundColor: '#FBFCFE',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: C.line,
    gap: 4,
  },
  historyLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  historyNote: {
    color: C.ink,
    fontSize: 13,
    lineHeight: 18,
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
