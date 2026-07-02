/**
 * Org-operational Inbox — the admin's "what needs my attention about this org"
 * queue. Distinct from the personal capture inbox (which follows the human and
 * is suppressed on the Studio chrome). v1 surfaces the one genuinely actionable,
 * org-scoped signal that already has approve/reject infra: pending membership
 * requests. The section list is keyed by item-type so evidence-review and
 * org-directed suggestions can slot in once those gain real backing state.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
  useAdminPeople,
  useApproveMembership,
  useRejectMembership,
  AdminPersonRow,
} from '@/hooks/useAdminPeople';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  StudioHeader,
  StudioButton,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';
import { AdminShell } from '@/components/admin/AdminShell';

export default function AdminInboxPage() {
  return <AdminInboxBody />;
}

function AdminInboxBody() {
  const { orgId: orgIdParam } = useLocalSearchParams<{ orgId: string }>();
  const orgId = orgIdParam as string;
  const data = useAdminPeople(orgId);
  const menu = useProfileMenuData();
  const approve = useApproveMembership(orgId);
  const reject = useRejectMembership(orgId);
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;

  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = useMemo(
    () => data.rows.filter((r) => r.status === 'pending'),
    [data.rows],
  );

  const activeOrg = menu.memberships.find((m) => m.org_id === orgId) ?? menu.activeOrg;
  const orgName = activeOrg?.org_name ?? 'Organization';
  const orgShortLabel = shortNameLabel(orgName);

  const act = (
    row: AdminPersonRow,
    kind: 'approve' | 'reject',
  ) => {
    if (busyId) return;
    setBusyId(row.id);
    const mutation = kind === 'approve' ? approve : reject;
    mutation.mutate(row.id, {
      onError: (err) =>
        showAlert(
          kind === 'approve' ? 'Could not approve' : 'Could not decline',
          err instanceof Error ? err.message : 'Please try again.',
        ),
      onSettled: () => setBusyId(null),
    });
  };

  const total = pending.length;

  return (
    <AdminShell activeKey="inbox">
      <StudioHeader
        compact={compact}
        crumbs={[orgShortLabel, 'Inbox']}
        title="Inbox"
        subtitleParts={[
          <Text key="count" style={styles.subPart}>
            {total === 0
              ? 'Nothing needs your attention'
              : `${total} ${total === 1 ? 'request needs' : 'requests need'} a decision`}
          </Text>,
        ]}
      />

      <View style={styles.body}>
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="person-add-outline" size={15} color="#28406B" />
            <Text style={styles.sectionTitle}>Join requests</Text>
            {total > 0 ? (
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{total}</Text>
              </View>
            ) : null}
          </View>

          {data.loading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : total === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={26} color="rgba(60,60,67,0.3)" />
              <Text style={styles.emptyText}>
                You&apos;re all caught up. New join requests and unredeemed invites will land here.
              </Text>
            </View>
          ) : (
            pending.map((row) => (
              <RequestRow
                key={row.id}
                row={row}
                compact={compact}
                busy={busyId === row.id}
                disabled={!!busyId && busyId !== row.id}
                onApprove={() => act(row, 'approve')}
                onReject={() => act(row, 'reject')}
              />
            ))
          )}
        </View>
      </View>
    </AdminShell>
  );
}

function RequestRow({
  row,
  compact,
  busy,
  disabled,
  onApprove,
  onReject,
}: {
  row: AdminPersonRow;
  compact: boolean;
  busy: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={[styles.row, compact && styles.rowCompact, (busy || disabled) && styles.rowDim]}>
      <View style={styles.rowMain}>
        <View style={[styles.avi, { backgroundColor: row.gradient[0] }]}>
          <Text style={styles.aviText}>{row.initials}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {row.joinedNote ?? row.email}
          </Text>
        </View>
      </View>
      <View style={[styles.rowActions, compact && styles.rowActionsCompact]}>
        <StudioButton
          variant="danger"
          icon="close"
          label={busy ? '…' : 'Decline'}
          small
          onPress={busy || disabled ? undefined : onReject}
        />
        <StudioButton
          variant="primary"
          accent="navy"
          icon="checkmark"
          label={busy ? 'Working…' : 'Approve'}
          small
          onPress={busy || disabled ? undefined : onApprove}
        />
      </View>
    </View>
  );
}

function shortNameLabel(orgName: string): string {
  if (orgName.includes(' · ')) return orgName.split(' · ').slice(0, 2).join(' ');
  const tokens = orgName.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return orgName;
  return tokens.map((t) => t[0]).join('').toUpperCase();
}

const styles = StyleSheet.create({
  subPart: { fontSize: 13, color: 'rgba(60,60,67,0.6)' },
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48, maxWidth: 760 },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.08)',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#28406B',
  },
  sectionBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  muted: { fontSize: 13, color: 'rgba(60,60,67,0.5)', padding: 16 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 24 },
  emptyText: {
    fontSize: 13,
    color: 'rgba(60,60,67,0.5)',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 340,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowDim: { opacity: 0.55 },
  avi: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  rowSub: { fontSize: 12.5, color: 'rgba(60,60,67,0.6)', marginTop: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowActionsCompact: { justifyContent: 'flex-end' },
});
