import { coachRoleLabel } from '@/lib/organizations/roleLabels';
import { getActiveMembership, isActiveMembership, isOrgAdminRole, resolveActiveOrgId } from '@/lib/organizations/adminGate';
import { fetchOrganizationInterestSlug, OrgContextPill } from '@/components/organizations/OrgContextPill';
import { useOrganization } from '@/providers/OrganizationProvider';
import { supabase } from '@/services/supabase';
import { isUuid } from '@/utils/uuid';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type CohortRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  interest_slug: string | null;
};

type CohortMember = {
  id: string;
  user_id: string;
  role: string | null;
  user_name: string;
  user_email: string | null;
};

type OrgActiveMember = {
  user_id: string;
  role: string;
  user_name: string;
  user_email: string | null;
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export default function CohortDetailScreen() {
  const params = useLocalSearchParams<{ cohortId?: string }>();
  const cohortId = String(params.cohortId || '').trim();

  const {
    activeOrganizationId,
    memberships,
    loading: orgLoading,
    ready: orgReady,
  } = useOrganization();

  const [loading, setLoading] = useState(false);
  const [cohort, setCohort] = useState<CohortRow | null>(null);
  const [cohortMembers, setCohortMembers] = useState<CohortMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgActiveMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [actionBusyUserId, setActionBusyUserId] = useState<string | null>(null);
  const [orgInterestSlug, setOrgInterestSlug] = useState<string | null>(null);

  const resolvedActiveOrgId = useMemo(
    () => resolveActiveOrgId({ activeOrganizationId, memberships: memberships as any }),
    [activeOrganizationId, memberships]
  );
  const activeOrgMembership = useMemo(
    () => getActiveMembership({ memberships: memberships as any, activeOrgId: resolvedActiveOrgId }),
    [memberships, resolvedActiveOrgId]
  );

  const hasValidOrg = Boolean(resolvedActiveOrgId && isUuid(resolvedActiveOrgId));
  const membershipStatus = activeOrgMembership?.membershipStatus || null;
  const membershipRole = activeOrgMembership?.role || null;
  const hasActiveMembership = isActiveMembership(membershipStatus);
  const hasAdminRole = isOrgAdminRole(membershipRole);
  const canEdit = hasValidOrg && hasActiveMembership && hasAdminRole;
  const canView = hasValidOrg && hasActiveMembership;

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

  const loadData = useCallback(async () => {
    if (!canView || !resolvedActiveOrgId || !isUuid(cohortId)) {
      setLoading(false);
      setCohort(null);
      setCohortMembers([]);
      setOrgMembers([]);
      return;
    }

    setLoading(true);
    setErrorText(null);

    try {
      const { data: cohortData, error: cohortError } = await supabase
        .from('betterat_org_cohorts')
        .select('id,org_id,name,description,interest_slug')
        .eq('id', cohortId)
        .eq('org_id', resolvedActiveOrgId)
        .maybeSingle();

      if (cohortError) throw cohortError;
      if (!cohortData) {
        setErrorText('Cohort not found.');
        setCohort(null);
        setCohortMembers([]);
        setOrgMembers([]);
        return;
      }
      setCohort(cohortData as CohortRow);

      const { data: cohortMemberRows, error: cohortMembersError } = await supabase
        .from('betterat_org_cohort_members')
        .select('id,user_id,role')
        .eq('cohort_id', cohortId)
        .order('created_at', { ascending: false });

      if (cohortMembersError) throw cohortMembersError;

      const { data: orgMemberRows, error: orgMembersError } = await supabase
        .from('organization_memberships')
        .select('user_id,role,membership_status,status')
        .eq('organization_id', resolvedActiveOrgId)
        .order('created_at', { ascending: false });

      if (orgMembersError) throw orgMembersError;

      const allUserIds = Array.from(
        new Set(
          [...(cohortMemberRows || []), ...(orgMemberRows || [])]
            .map((row: any) => row.user_id)
            .filter((id: unknown): id is string => typeof id === 'string' && isUuid(id))
        )
      );

      const usersById = new Map<string, { full_name?: string | null; email?: string | null }>();
      if (allUserIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id,full_name,email')
          .in('id', allUserIds);

        if (usersError) throw usersError;

        for (const row of usersData || []) {
          usersById.set(String((row as any).id), {
            full_name: (row as any).full_name ?? null,
            email: (row as any).email ?? null,
          });
        }
      }

      const nextCohortMembers: CohortMember[] = (cohortMemberRows || []).map((row: any) => {
        const user = usersById.get(String(row.user_id));
        const email = user?.email || null;
        const fullName = String(user?.full_name || '').trim();
        return {
          id: String(row.id),
          user_id: String(row.user_id),
          role: row.role || null,
          user_name: fullName || email || 'Unknown user',
          user_email: email,
        };
      });

      const nextOrgMembers: OrgActiveMember[] = (orgMemberRows || [])
        .filter((row: any) => isActiveMembership(String(row.membership_status || row.status || '').trim() || null))
        .map((row: any) => {
        const user = usersById.get(String(row.user_id));
        const email = user?.email || null;
        const fullName = String(user?.full_name || '').trim();
        return {
          user_id: String(row.user_id),
          role: String(row.role || 'member'),
          user_name: fullName || email || 'Unknown user',
          user_email: email,
        };
      });

      setCohortMembers(nextCohortMembers);
      setOrgMembers(nextOrgMembers);
    } catch (error: any) {
      setErrorText(error?.message || 'Could not load cohort.');
      setCohort(null);
      setCohortMembers([]);
      setOrgMembers([]);
    } finally {
      setLoading(false);
    }
  }, [canView, cohortId, resolvedActiveOrgId]);

  useEffect(() => {
    if (!orgReady || orgLoading || !canView) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [canView, loadData, orgLoading, orgReady]);

  const cohortMemberUserIds = useMemo(() => new Set(cohortMembers.map((row) => row.user_id)), [cohortMembers]);

  const availableMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orgMembers
      .filter((member) => !cohortMemberUserIds.has(member.user_id))
      .filter((member) => {
        if (!query) return true;
        return (
          member.user_name.toLowerCase().includes(query)
          || (member.user_email || '').toLowerCase().includes(query)
          || member.role.toLowerCase().includes(query)
        );
      });
  }, [cohortMemberUserIds, orgMembers, searchQuery]);

  const handleAddMember = useCallback(async (userId: string) => {
    if (!canEdit || !isUuid(cohortId)) return;
    setActionBusyUserId(userId);
    setErrorText(null);
    try {
      const { error } = await supabase
        .from('betterat_org_cohort_members')
        .insert({
          cohort_id: cohortId,
          user_id: userId,
          role: 'member',
        });
      if (error) throw error;
      await loadData();
    } catch (error: any) {
      setErrorText(error?.message || 'Could not add member.');
    } finally {
      setActionBusyUserId(null);
    }
  }, [canEdit, cohortId, loadData]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!canEdit || !isUuid(cohortId)) return;
    setActionBusyUserId(userId);
    setErrorText(null);
    try {
      const { error } = await supabase
        .from('betterat_org_cohort_members')
        .delete()
        .eq('cohort_id', cohortId)
        .eq('user_id', userId);
      if (error) throw error;
      await loadData();
    } catch (error: any) {
      setErrorText(error?.message || 'Could not remove member.');
    } finally {
      setActionBusyUserId(null);
    }
  }, [canEdit, cohortId, loadData]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{cohort?.name || 'Cohort'}</Text>
          <Text style={styles.subtitle}>{cohort?.description || 'Manage cohort members.'}</Text>
          <OrgContextPill interestSlug={orgInterestSlug} />
        </View>
      </View>

      {!orgReady || orgLoading ? (
        <View style={styles.centerState}><ActivityIndicator size="small" color="#007AFF" /></View>
      ) : !hasValidOrg ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Select an active organization first.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/settings/organization-access')}>
            <Text style={styles.primaryButtonText}>Open Organization Access</Text>
          </TouchableOpacity>
        </View>
      ) : !hasActiveMembership ? (
        <View style={styles.centerState}><Text style={styles.stateText}>Active membership required.</Text></View>
      ) : !isUuid(cohortId) ? (
        <View style={styles.centerState}><Text style={styles.stateText}>Invalid cohort id.</Text></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <View style={styles.card}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Members in cohort</Text>
              <TouchableOpacity onPress={() => void loadData()}>
                <Ionicons name="refresh-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.centerStateCompact}><ActivityIndicator size="small" color="#007AFF" /></View>
            ) : cohortMembers.length === 0 ? (
              <Text style={styles.stateText}>No members in this cohort yet.</Text>
            ) : (
              cohortMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.row}
                  onPress={() => router.push({ pathname: '/organization/student/[studentId]', params: { studentId: member.user_id, orgId: resolvedActiveOrgId || '' } })}
                  activeOpacity={0.6}
                >
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>{member.user_name}</Text>
                    {member.user_email ? <Text style={styles.rowMeta}>{member.user_email}</Text> : null}
                        <Text style={styles.rowMeta}>
                          {coachRoleLabel({ interestSlug: orgInterestSlug || '', role: member.role || 'member' })}
                        </Text>
                  </View>
                  <View style={styles.rowActions}>
                    {canEdit ? (
                      <TouchableOpacity
                        style={[styles.secondaryButton, actionBusyUserId === member.user_id && styles.disabledButton]}
                        onPress={(e) => { e.stopPropagation(); void handleRemoveMember(member.user_id); }}
                        disabled={actionBusyUserId === member.user_id}
                      >
                        <Text style={styles.secondaryButtonText}>Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add members</Text>
            {!canEdit ? (
              <Text style={styles.stateText}>
                {normalize(membershipRole) === 'member'
                  ? 'Your role in this org is Member. Ask an admin to promote you.'
                  : 'Admin access required to edit cohort members.'}
              </Text>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Search active org members"
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />

                {availableMembers.length === 0 ? (
                  <Text style={styles.stateText}>No matching members available to add.</Text>
                ) : (
                  availableMembers.map((member) => (
                    <View key={member.user_id} style={styles.row}>
                      <View style={styles.rowTextWrap}>
                        <Text style={styles.rowTitle}>{member.user_name}</Text>
                        {member.user_email ? <Text style={styles.rowMeta}>{member.user_email}</Text> : null}
                        <Text style={styles.rowMeta}>
                          {coachRoleLabel({ interestSlug: orgInterestSlug || '', role: member.role })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.primaryButtonSmall, actionBusyUserId === member.user_id && styles.disabledButton]}
                        onPress={() => void handleAddMember(member.user_id)}
                        disabled={actionBusyUserId === member.user_id}
                      >
                        <Text style={styles.primaryButtonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#64748B' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  row: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  rowTextWrap: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  primaryButton: {
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  primaryButtonSmall: {
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  secondaryButtonText: { color: '#B42318', fontWeight: '600', fontSize: 12 },
  disabledButton: { opacity: 0.6 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  centerStateCompact: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  stateText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  errorText: { fontSize: 12, color: '#B42318' },
});
