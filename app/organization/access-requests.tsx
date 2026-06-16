import { useOrganization } from '@/providers/OrganizationProvider';
import { fetchOrganizationInterestSlug } from '@/components/organizations/OrgContextPill';
import { OrgAdminHeader } from '@/components/organizations/OrgAdminHeader';
import { NotificationService } from '@/services/NotificationService';
import { realtimeService } from '@/services/RealtimeService';
import { isUuid } from '@/utils/uuid';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';

type PendingRequestRow = {
  id: string;
  user_id: string;
  role: string | null;
  membership_status: string | null;
  status: string | null;
  created_at: string;
  user_name: string;
  user_email: string | null;
  metadata: Record<string, any> | null;
  requested_blueprint_title: string | null;
};

function formatRequestedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

export default function OrganizationAccessRequestsScreen() {
  const { activeOrganization, activeOrganizationId, memberships, loading: orgLoading, ready: orgReady } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<PendingRequestRow[]>([]);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [warningText, setWarningText] = useState<string | null>(null);
  const [orgInterestSlug, setOrgInterestSlug] = useState<string | null>(null);
  const resolvedActiveOrgId = useMemo(() => {
    const providerId = String(activeOrganizationId || '').trim();
    if (providerId) return providerId;
    const activeMembership = memberships.find((membership: any) => {
      const membershipStatus = String(
        membership?.membership_status || membership?.status || '',
      ).toLowerCase();
      return membershipStatus === 'active';
    });
    if (!activeMembership) return null;
    return String((activeMembership as any).organization_id ?? (activeMembership as any).organizationId ?? '').trim() || null;
  }, [activeOrganizationId, memberships]);

  const activeOrgMembership = useMemo(() => {
    if (!resolvedActiveOrgId) return null;
    return memberships.find((membership: any) => {
      const membershipOrgId = String(membership?.organization_id ?? membership?.organizationId ?? '').trim();
      return membershipOrgId === resolvedActiveOrgId;
    }) ?? null;
  }, [memberships, resolvedActiveOrgId]);

  const membershipStatus = String(
    activeOrgMembership?.membership_status || activeOrgMembership?.status || '',
  ).toLowerCase();
  const membershipRole = String(activeOrgMembership?.role || '').toLowerCase();
  const hasActiveMembership = membershipStatus === 'active';
  const hasAdminRole = membershipRole === 'admin' || membershipRole === 'manager' || membershipRole === 'owner';
  const hasValidActiveOrgId = !!resolvedActiveOrgId && isUuid(resolvedActiveOrgId);
  const canViewAndAct = hasValidActiveOrgId && hasActiveMembership && hasAdminRole;

  useEffect(() => {
    if (!resolvedActiveOrgId || !isUuid(resolvedActiveOrgId)) {
      setOrgInterestSlug(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const interestSlug = await fetchOrganizationInterestSlug(resolvedActiveOrgId);
        if (cancelled) return;
        setOrgInterestSlug(interestSlug);
      } catch {
        if (cancelled) return;
        setOrgInterestSlug(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedActiveOrgId]);

  const loadPendingRequests = useCallback(async () => {
    if (!canViewAndAct || !resolvedActiveOrgId) {
      setRequests([]);
      return;
    }

      setLoading(true);
      setErrorText(null);
      setWarningText(null);
    try {
      let membershipQuery = await supabase
        .from('organization_memberships')
        .select('id,user_id,role,membership_status,status,created_at,metadata')
        .eq('organization_id', resolvedActiveOrgId)
        .eq('membership_status', 'pending')
        .order('created_at', { ascending: false });

      if (membershipQuery.error && isMissingSupabaseColumn(membershipQuery.error, 'organization_memberships.membership_status')) {
        membershipQuery = await supabase
          .from('organization_memberships')
          .select('id,user_id,role,status,created_at')
          .eq('organization_id', resolvedActiveOrgId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
      }

      const membershipRows = membershipQuery.data;
      const membershipError = membershipQuery.error;

      if (membershipError) {
        throw membershipError;
      }

      const rows = membershipRows || [];
      const userIds = Array.from(
        new Set(
          rows
            .map((row: any) => row.user_id)
            .filter((id: unknown): id is string => typeof id === 'string' && isUuid(id))
        )
      );

      let usersById = new Map<string, { full_name?: string | null; email?: string | null }>();
      if (userIds.length > 0) {
        const usersQuery = await supabase
          .from('users')
          .select('id,full_name,email')
          .in('id', userIds);
        if (usersQuery.error) {
          throw usersQuery.error;
        }
        usersById = new Map(
          (usersQuery.data || []).map((row: any) => [
            String(row.id),
            { full_name: row.full_name ?? null, email: row.email ?? null },
          ])
        );
      }

      const rowsWithUsers = rows.map((row: any) => ({
        ...row,
        users: usersById.get(String(row.user_id)) || null,
      }));

      const normalized: PendingRequestRow[] = rowsWithUsers.map((row: any) => {
        const user = Array.isArray(row.users) ? row.users[0] : row.users;
        const email = typeof user?.email === 'string' ? user.email : null;
        const fullName = typeof user?.full_name === 'string' ? user.full_name.trim() : '';
        const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : null;
        return {
          id: String(row.id),
          user_id: String(row.user_id),
          role: row.role || null,
          membership_status: row.membership_status || null,
          status: row.status || null,
          created_at: String(row.created_at || ''),
          user_name: fullName || email || 'Unknown user',
          user_email: email,
          metadata,
          requested_blueprint_title: null,
        };
      });

      // Fetch blueprint titles for requests that have a requested_blueprint_id
      const blueprintIds = normalized
        .map((r) => r.metadata?.requested_blueprint_id)
        .filter((id): id is string => typeof id === 'string' && isUuid(id));

      if (blueprintIds.length > 0) {
        const uniqueIds = [...new Set(blueprintIds)];
        const { data: blueprints } = await supabase
          .from('blueprints')
          .select('id,title')
          .in('id', uniqueIds);
        if (blueprints && blueprints.length > 0) {
          const titleMap = new Map(blueprints.map((bp: any) => [bp.id, bp.title]));
          for (const req of normalized) {
            const bpId = req.metadata?.requested_blueprint_id;
            if (bpId && titleMap.has(bpId)) {
              req.requested_blueprint_title = titleMap.get(bpId) || null;
            }
          }
        }
      }

      setRequests(normalized);
    } catch (error: any) {
      if (__DEV__) {
        console.error('[OrganizationAccessRequests] Pending request fetch failed', error?.message || error);
      }
      setErrorText(error?.message || 'Could not load access requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [canViewAndAct, resolvedActiveOrgId]);

  useEffect(() => {
    if (!orgReady || orgLoading || !canViewAndAct) {
      setRequests([]);
      setLoading(false);
      return;
    }
    void loadPendingRequests();
  }, [canViewAndAct, loadPendingRequests, orgLoading, orgReady]);

  useEffect(() => {
    if (!canViewAndAct || !resolvedActiveOrgId) return;

    const channelName = `access-requests:${resolvedActiveOrgId}`;
    const handler = () => {
      void loadPendingRequests();
    };
    realtimeService.subscribe(
      channelName,
      {
        event: '*',
        schema: 'public',
        table: 'organization_memberships',
        filter: `organization_id=eq.${resolvedActiveOrgId}`,
      },
      handler
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handler);
    };
  }, [canViewAndAct, loadPendingRequests, resolvedActiveOrgId]);

  const handleUpdateRequest = useCallback(
    async (request: PendingRequestRow, nextMembershipStatus: 'active' | 'rejected') => {
      if (!resolvedActiveOrgId || !canViewAndAct) return;
      setActionBusyId(request.id);
      setErrorText(null);
      setWarningText(null);
      try {
        let updatePayload: Record<string, any> =
          nextMembershipStatus === 'active'
            ? {
                membership_status: 'active',
                status: 'active',
                is_verified: true,
                verification_source: 'admin',
                verified_at: new Date().toISOString(),
                joined_at: new Date().toISOString(),
              }
            : {
                membership_status: 'rejected',
                status: 'rejected',
                is_verified: false,
                verification_source: 'admin',
                verified_at: null,
                joined_at: null,
              };

        const missingColumnFallbacks: [string, string][] = [
          ['membership_status', 'organization_memberships.membership_status'],
          ['status', 'organization_memberships.status'],
          ['is_verified', 'organization_memberships.is_verified'],
          ['verification_source', 'organization_memberships.verification_source'],
          ['verified_at', 'organization_memberships.verified_at'],
          ['joined_at', 'organization_memberships.joined_at'],
        ];

        while (true) {
          const { error } = await supabase
            .from('organization_memberships')
            .update(updatePayload)
            .eq('id', request.id)
            .eq('organization_id', resolvedActiveOrgId);

          if (!error) break;

          const missing = missingColumnFallbacks.find(([key, qualified]) =>
            updatePayload[key] !== undefined && isMissingSupabaseColumn(error, qualified)
          );
          if (!missing) throw error;

          const [missingKey] = missing;
          const nextPayload = { ...updatePayload };
          delete nextPayload[missingKey];
          updatePayload = nextPayload;
        }

        try {
          await NotificationService.notifyOrgMembershipDecision({
            targetUserId: request.user_id,
            organizationId: resolvedActiveOrgId,
            organizationName: activeOrganization.name || 'this organization',
            decision: nextMembershipStatus === 'active' ? 'approved' : 'rejected',
          });
        } catch {
          setWarningText(
            nextMembershipStatus === 'active'
              ? 'Approved, but could not notify.'
              : 'Rejected, but could not notify.'
          );
        }

        await loadPendingRequests();
      } catch (error: any) {
        setErrorText(error?.message || 'Could not update membership request.');
      } finally {
        setActionBusyId(null);
      }
    },
    [activeOrganization?.name, canViewAndAct, loadPendingRequests, resolvedActiveOrgId]
  );

  const title = useMemo(
    () => `Access Requests${activeOrganization?.name ? ` · ${activeOrganization.name}` : ''}`,
    [activeOrganization?.name]
  );

  return (
    <View style={styles.container}>
      <OrgAdminHeader
        title={title}
        subtitle="Approve or reject pending organization membership requests."
        interestSlug={orgInterestSlug}
      />

      {!orgReady || orgLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : !hasValidActiveOrgId ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Select an active organization first.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/settings/organization-access')}>
            <Text style={styles.primaryButtonText}>Open Organization Access</Text>
          </TouchableOpacity>
        </View>
      ) : !hasActiveMembership ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Active membership required.</Text>
        </View>
      ) : !hasAdminRole ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Admin access required.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Pending requests</Text>
              <TouchableOpacity onPress={() => void loadPendingRequests()}>
                <Ionicons name="refresh-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
            {warningText ? <Text style={styles.warningText}>{warningText}</Text> : null}

            {loading ? (
              <View style={styles.centerStateCompact}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            ) : requests.length === 0 ? (
              <Text style={styles.stateText}>No pending requests.</Text>
            ) : (
              requests.map((request) => {
                const busy = actionBusyId === request.id;
                return (
                  <View key={request.id} style={styles.requestRow}>
                    <View style={styles.requestTextWrap}>
                      <Text style={styles.requestTitle}>{request.user_name}</Text>
                      {request.user_email ? <Text style={styles.requestSub}>{request.user_email}</Text> : null}
                      <Text style={styles.requestMeta}>
                        Requested {formatRequestedAt(request.created_at)}
                        {request.role ? ` · ${request.role}` : ''}
                      </Text>
                      {request.requested_blueprint_title && (
                        <Text style={styles.requestBlueprintHint}>
                          Interested in: {request.requested_blueprint_title}
                        </Text>
                      )}
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.actionButtonApprove,
                          (busy || !hasAdminRole) && styles.actionButtonDisabled,
                        ]}
                        onPress={() => void handleUpdateRequest(request, 'active')}
                        disabled={busy || !hasAdminRole}
                      >
                        <Text style={styles.actionButtonApproveText}>{busy ? 'Saving...' : 'Approve'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.actionButtonReject,
                          (busy || !hasAdminRole) && styles.actionButtonDisabled,
                        ]}
                        onPress={() => void handleUpdateRequest(request, 'rejected')}
                        disabled={busy || !hasAdminRole}
                      >
                        <Text style={styles.actionButtonRejectText}>{busy ? 'Saving...' : 'Reject'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  requestRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  requestTextWrap: {
    gap: 3,
  },
  requestTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  requestSub: {
    fontSize: 12,
    color: '#475569',
  },
  requestMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  requestBlueprintHint: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionButtonApprove: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  actionButtonReject: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  actionButtonApproveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  actionButtonRejectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
  },
  warningText: {
    fontSize: 12,
    color: '#B45309',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  centerStateCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  stateText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
