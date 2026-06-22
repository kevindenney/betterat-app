import { coachRoleLabel } from '@/lib/organizations/roleLabels';
import { getActiveMembership, isActiveMembership, isOrgAdminRole, resolveActiveOrgId } from '@/lib/organizations/adminGate';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';
import { fetchOrganizationInterestSlug } from '@/components/organizations/OrgContextPill';
import { OrgAdminHeader } from '@/components/organizations/OrgAdminHeader';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { supabase } from '@/services/supabase';
import { isUuid } from '@/utils/uuid';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { InviteMemberSheet } from '@/components/organizations/InviteMemberSheet';
import { resolveOrgMembershipStatus } from '@/hooks/orgMembershipStatus';

type MemberBlueprint = {
  id: string;
  title: string;
  slug: string;
  is_published: boolean;
  subscriber_count: number;
};

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  membership_status: string | null;
  status: string | null;
  created_at: string | null;
  user_name: string;
  user_email: string | null;
  blueprints: MemberBlueprint[];
};

type SaveState = {
  type: 'saved' | 'error';
  message: string;
};

type StatusFilter = 'active' | 'pending' | 'rejected' | 'all';
type SortOption = 'name_asc' | 'name_desc' | 'status' | 'role';

const NURSING_ROLES = ['member', 'preceptor', 'clinical_instructor', 'instructor', 'evaluator', 'admin', 'manager'];
const SAILING_ROLES = ['member', 'coach', 'coordinator', 'staff', 'admin', 'manager'];

function normalizeStatus(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function getStatusBucket(row: Pick<MemberRow, 'membership_status' | 'status'>): Exclude<StatusFilter, 'all'> | 'other' {
  const normalizedStatus = normalizeStatus(resolveOrgMembershipStatus(row));
  if (normalizedStatus === 'active' || normalizedStatus === 'verified') return 'active';
  if (normalizedStatus === 'pending' || normalizedStatus === 'invited') return 'pending';
  if (normalizedStatus === 'rejected') return 'rejected';
  return 'other';
}

function getRoleBucketKey(role: string | null | undefined, interestSlug: string | null | undefined): string {
  const normalizedRole = normalizeStatus(role);
  const normalizedInterest = normalizeStatus(interestSlug);
  if (isOrgAdminRole(normalizedRole)) return 'org_admin';

  if (normalizedInterest === 'nursing') {
    if (normalizedRole === 'evaluator' || normalizedRole === 'assessor') return 'evaluator_assessor';
  }

  if (normalizedInterest === 'sail-racing' || normalizedInterest.includes('sail')) {
    if (normalizedRole === 'coordinator' || normalizedRole === 'tactician') return 'tactician';
    if (normalizedRole === 'staff' || normalizedRole === 'race_officer') return 'race_officer';
  }

  return normalizedRole || 'member';
}

function getRoleBucketDisplayLabel(roleBucket: string, interestSlug: string | null | undefined): string {
  if (roleBucket === 'org_admin') return 'Org Admin';
  if (roleBucket === 'evaluator_assessor') return 'Evaluator/Assessor';
  if (roleBucket === 'tactician') return 'Tactician';
  if (roleBucket === 'race_officer') return 'Race Officer';
  if (roleBucket === 'team_manager') return 'Team Manager';
  return coachRoleLabel({ interestSlug: interestSlug || '', role: roleBucket });
}

export default function OrganizationMembersScreen() {
  const { user } = useAuth();
  const {
    activeOrganization,
    activeOrganizationId,
    memberships,
    loading: orgLoading,
    ready: orgReady,
  } = useOrganization();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState | undefined>>({});
  const [memberQuery, setMemberQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  const [orgInterestSlug, setOrgInterestSlug] = useState<string | null>(null);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);

  const resolvedActiveOrgId = useMemo(
    () => resolveActiveOrgId({ activeOrganizationId, memberships: memberships as any }),
    [activeOrganizationId, memberships]
  );
  const activeOrgMembership = useMemo(
    () => getActiveMembership({ memberships: memberships as any, activeOrgId: resolvedActiveOrgId }),
    [memberships, resolvedActiveOrgId]
  );

  const membershipStatus = activeOrgMembership?.membershipStatus || null;
  const membershipRole = activeOrgMembership?.role || null;
  const hasActiveMembership = isActiveMembership(membershipStatus);
  const hasAdminRole = isOrgAdminRole(membershipRole);
  const hasValidActiveOrgId = !!resolvedActiveOrgId && isUuid(resolvedActiveOrgId);
  const canManage = hasValidActiveOrgId && hasActiveMembership && hasAdminRole;

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

  const roleOptions = useMemo(() => {
    const interest = String(orgInterestSlug || '').toLowerCase();
    if (interest === 'nursing') return NURSING_ROLES;
    if (interest === 'sail-racing' || interest.includes('sail')) return SAILING_ROLES;
    return Array.from(new Set([...NURSING_ROLES, ...SAILING_ROLES]));
  }, [orgInterestSlug]);

  const getDisplayRoleOptions = useCallback(
    (currentRole: string): string[] => {
      const normalizedCurrent = normalizeStatus(currentRole);
      const candidateRoles = normalizedCurrent && !roleOptions.includes(normalizedCurrent)
        ? [normalizedCurrent, ...roleOptions]
        : roleOptions;

      const deduped: string[] = [];
      const seenLabels = new Set<string>();
      for (const candidateRole of candidateRoles) {
        const label = coachRoleLabel({ interestSlug: orgInterestSlug || '', role: candidateRole });
        if (seenLabels.has(label)) continue;
        seenLabels.add(label);
        deduped.push(candidateRole);
      }
      return deduped;
    },
    [orgInterestSlug, roleOptions]
  );

  const loadMembers = useCallback(async () => {
    if (!canManage || !resolvedActiveOrgId) {
      setRows([]);
      return;
    }

    setLoading(true);
    setErrorText(null);

    try {
      let membershipQuery = await supabase
        .from('organization_memberships')
        .select('id,user_id,role,membership_status,status,created_at')
        .eq('organization_id', resolvedActiveOrgId)
        .order('created_at', { ascending: false });

      if (membershipQuery.error && isMissingSupabaseColumn(membershipQuery.error, 'organization_memberships.membership_status')) {
        membershipQuery = await supabase
          .from('organization_memberships')
          .select('id,user_id,role,status,created_at')
          .eq('organization_id', resolvedActiveOrgId)
          .order('created_at', { ascending: false });
      }

      const membershipRows = membershipQuery.data;
      const membershipError = membershipQuery.error;

      if (membershipError) throw membershipError;

      const userIds = Array.from(
        new Set(
          (membershipRows || [])
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

        if (usersQuery.error) throw usersQuery.error;

        usersById = new Map(
          (usersQuery.data || []).map((row: any) => [
            String(row.id),
            {
              full_name: row.full_name ?? null,
              email: row.email ?? null,
            },
          ])
        );
      }

      // Fetch published blueprints for all member user_ids
      let blueprintsByUserId = new Map<string, MemberBlueprint[]>();
      if (userIds.length > 0) {
        const { data: bpData } = await supabase
          .from('timeline_blueprints')
          .select('id,user_id,title,slug,is_published,subscriber_count')
          .in('user_id', userIds)
          .eq('is_published', true);

        if (bpData) {
          for (const bp of bpData as any[]) {
            const uid = String(bp.user_id);
            if (!blueprintsByUserId.has(uid)) blueprintsByUserId.set(uid, []);
            blueprintsByUserId.get(uid)!.push({
              id: String(bp.id),
              title: String(bp.title || ''),
              slug: String(bp.slug || ''),
              is_published: true,
              subscriber_count: Number(bp.subscriber_count || 0),
            });
          }
        }
      }

      const normalized: MemberRow[] = (membershipRows || []).map((row: any) => {
        const user = usersById.get(String(row.user_id));
        const email = typeof user?.email === 'string' ? user.email : null;
        const fullName = typeof user?.full_name === 'string' ? user.full_name.trim() : '';

        return {
          id: String(row.id),
          user_id: String(row.user_id),
          role: String(row.role || 'member'),
          membership_status: row.membership_status || null,
          status: row.status || null,
          created_at: row.created_at ? String(row.created_at) : null,
          user_name: fullName || email || 'Unknown user',
          user_email: email,
          blueprints: blueprintsByUserId.get(String(row.user_id)) || [],
        };
      });

      setRows(normalized);
    } catch (error: any) {
      setErrorText(error?.message || 'Could not load members.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canManage, resolvedActiveOrgId]);

  useEffect(() => {
    if (!orgReady || orgLoading || !canManage) {
      setLoading(false);
      setRows([]);
      return;
    }

    void loadMembers();
  }, [canManage, loadMembers, orgLoading, orgReady]);

  const handleChangeRole = useCallback(
    async (row: MemberRow, nextRole: string) => {
      if (!canManage || !resolvedActiveOrgId) return;
      const normalizedNext = normalizeStatus(nextRole);
      const normalizedCurrent = normalizeStatus(row.role);
      if (!normalizedNext || normalizedNext === normalizedCurrent) return;

      setBusyMembershipId(row.id);
      setSaveStates((prev) => ({ ...prev, [row.id]: undefined }));

      try {
        const { data, error } = await supabase
          .from('organization_memberships')
          .update({ role: normalizedNext })
          .eq('id', row.id)
          .eq('organization_id', resolvedActiveOrgId)
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          throw new Error('Member not found or you do not have access to update them.');
        }

        setRows((prev) =>
          prev.map((member) =>
            member.id === row.id
              ? {
                  ...member,
                  role: normalizedNext,
                }
              : member
          )
        );

        setSaveStates((prev) => ({
          ...prev,
          [row.id]: { type: 'saved', message: 'Saved' },
        }));
      } catch (error: any) {
        setSaveStates((prev) => ({
          ...prev,
          [row.id]: {
            type: 'error',
            message: error?.message || 'Could not update role.',
          },
        }));
      } finally {
        setBusyMembershipId(null);
      }
    },
    [canManage, resolvedActiveOrgId]
  );

  const handleRemoveAccess = useCallback(
    async (row: MemberRow) => {
      if (!canManage || !resolvedActiveOrgId) return;
      if (user?.id && row.user_id === user.id) return;

      setBusyMembershipId(row.id);
      setSaveStates((prev) => ({ ...prev, [row.id]: undefined }));

      let payload: Record<string, any> = {
        membership_status: 'rejected',
        status: 'rejected',
        is_verified: false,
        verified_at: null,
        joined_at: null,
      };

      const missingColumnMap: [string, string][] = [
        ['membership_status', 'organization_memberships.membership_status'],
        ['status', 'organization_memberships.status'],
        ['is_verified', 'organization_memberships.is_verified'],
        ['verified_at', 'organization_memberships.verified_at'],
        ['joined_at', 'organization_memberships.joined_at'],
      ];

      try {
        while (true) {
          const { data, error } = await supabase
            .from('organization_memberships')
            .update(payload)
            .eq('id', row.id)
            .eq('organization_id', resolvedActiveOrgId)
            .eq('user_id', row.user_id)
            .select('id')
            .maybeSingle();

          if (!error) {
            if (!data) {
              throw new Error('Member not found or you do not have access to remove them.');
            }
            break;
          }

          const missing = missingColumnMap.find(([key, qualified]) => payload[key] !== undefined && isMissingSupabaseColumn(error, qualified));
          if (missing) {
            const [missingKey] = missing;
            const nextPayload = { ...payload };
            delete nextPayload[missingKey];
            payload = nextPayload;
            continue;
          }

          throw error;
        }

        setRows((prev) => prev.filter((member) => member.id !== row.id));
        setSaveStates((prev) => ({
          ...prev,
          [row.id]: { type: 'saved', message: 'Access removed' },
        }));
      } catch (error: any) {
        setSaveStates((prev) => ({
          ...prev,
          [row.id]: {
            type: 'error',
            message: error?.message || 'Could not remove access.',
          },
        }));
      } finally {
        setBusyMembershipId(null);
      }
    },
    [canManage, resolvedActiveOrgId, user?.id]
  );

  const handleResetToPending = useCallback(
    (row: MemberRow) => {
      if (!canManage || !resolvedActiveOrgId) return;
      if (user?.id && row.user_id === user.id) return;

      const runReset = () => {
        void (async () => {
          setBusyMembershipId(row.id);
          setSaveStates((prev) => ({ ...prev, [row.id]: undefined }));
          try {
            const { error } = await supabase.rpc('admin_reset_org_member_to_pending', {
              p_org_id: resolvedActiveOrgId,
              p_user_id: row.user_id,
            });
            if (error) throw error;

            setSaveStates((prev) => ({
              ...prev,
              [row.id]: { type: 'saved', message: 'Reset to pending' },
            }));
            await loadMembers();
          } catch (error: any) {
            setSaveStates((prev) => ({
              ...prev,
              [row.id]: {
                type: 'error',
                message: error?.message || 'Could not reset to pending.',
              },
            }));
          } finally {
            setBusyMembershipId(null);
          }
        })();
      };

      showConfirm(
        'Reset to pending?',
        'Reset this member to pending? They will appear as a join request again.',
        runReset,
        { destructive: true },
      );
    },
    [canManage, loadMembers, resolvedActiveOrgId, user?.id]
  );

  const statusCounts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const bucket = getStatusBucket(row);
        if (bucket === 'active') acc.active += 1;
        else if (bucket === 'pending') acc.pending += 1;
        else if (bucket === 'rejected') acc.rejected += 1;
        return acc;
      },
      { active: 0, pending: 0, rejected: 0 }
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = memberQuery.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const bucket = getStatusBucket(row);
      const matchesStatus = statusFilter === 'all' || bucket === statusFilter;
      if (!matchesStatus) return false;
      const roleBucket = getRoleBucketKey(row.role, orgInterestSlug);
      const matchesRole = roleFilter === 'all' || roleBucket === roleFilter;
      if (!matchesRole) return false;
      if (!normalizedQuery) return true;
      const haystack = `${String(row.user_name || '').toLowerCase()} ${String(row.user_email || '').toLowerCase()}`;
      return haystack.includes(normalizedQuery);
    });
    const statusRank = (value: string): number => {
      if (value === 'active') return 0;
      if (value === 'pending') return 1;
      if (value === 'rejected') return 2;
      return 3;
    };
    return filtered
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        if (sortOption === 'name_asc') {
          const result = a.row.user_name.localeCompare(b.row.user_name, undefined, { sensitivity: 'base' });
          return result !== 0 ? result : a.index - b.index;
        }
        if (sortOption === 'name_desc') {
          const result = b.row.user_name.localeCompare(a.row.user_name, undefined, { sensitivity: 'base' });
          return result !== 0 ? result : a.index - b.index;
        }
        if (sortOption === 'status') {
          const result = statusRank(getStatusBucket(a.row)) - statusRank(getStatusBucket(b.row));
          if (result !== 0) return result;
          return a.row.user_name.localeCompare(b.row.user_name, undefined, { sensitivity: 'base' });
        }
        const bucketA = getRoleBucketKey(a.row.role, orgInterestSlug);
        const bucketB = getRoleBucketKey(b.row.role, orgInterestSlug);
        const rankA = bucketA === 'org_admin' ? 0 : 1;
        const rankB = bucketB === 'org_admin' ? 0 : 1;
        if (rankA !== rankB) return rankA - rankB;
        const labelA = getRoleBucketDisplayLabel(bucketA, orgInterestSlug);
        const labelB = getRoleBucketDisplayLabel(bucketB, orgInterestSlug);
        const result = labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
        if (result !== 0) return result;
        return a.row.user_name.localeCompare(b.row.user_name, undefined, { sensitivity: 'base' });
      })
      .map((entry) => entry.row);
  }, [memberQuery, orgInterestSlug, roleFilter, rows, sortOption, statusFilter]);

  const roleFilterCounts = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, row) => {
      const bucket = getRoleBucketKey(row.role, orgInterestSlug);
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {});
  }, [orgInterestSlug, rows]);

  const roleFilterOptions = useMemo(() => {
    const interest = normalizeStatus(orgInterestSlug);
    const allowedNursing = ['org_admin', 'preceptor', 'clinical_instructor', 'instructor', 'evaluator_assessor', 'member'];
    const allowedSailing = ['org_admin', 'race_officer', 'tactician', 'team_manager', 'coach', 'coordinator', 'member'];
    const allowedBase = interest === 'nursing'
      ? allowedNursing
      : (interest === 'sail-racing' || interest.includes('sail'))
        ? allowedSailing
        : ['org_admin', 'member'];

    const options = ['all'];
    for (const key of allowedBase) {
      if ((roleFilterCounts[key] || 0) > 0) {
        options.push(key);
      }
    }

    const seen = new Set(options);
    const otherKeys = Object.keys(roleFilterCounts).filter((key) => !seen.has(key) && (roleFilterCounts[key] || 0) > 0);
    otherKeys.sort((a, b) =>
      getRoleBucketDisplayLabel(a, orgInterestSlug).localeCompare(getRoleBucketDisplayLabel(b, orgInterestSlug), undefined, { sensitivity: 'base' })
    );
    for (const key of otherKeys) options.push(key);

    if (!options.includes(roleFilter)) {
      options.unshift(roleFilter);
    }
    return options;
  }, [orgInterestSlug, roleFilter, roleFilterCounts]);

  const title = useMemo(
    () => `Members${activeOrganization?.name ? ` · ${activeOrganization.name}` : ''}`,
    [activeOrganization?.name]
  );

  return (
    <View style={styles.container}>
      <OrgAdminHeader
        title={title}
        subtitle="Manage organization members and roles."
        interestSlug={orgInterestSlug}
        actions={canManage ? (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => setInviteSheetVisible(true)}
          >
            <Ionicons name="person-add-outline" size={14} color="#FFFFFF" />
            <Text style={styles.inviteButtonText}>Invite Member</Text>
          </TouchableOpacity>
        ) : undefined}
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
          <Text style={styles.stateText}>
            {normalizeStatus(membershipRole) === 'member'
              ? 'Your role in this org is Member. Ask an admin to promote you.'
              : 'Admin access required.'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Members</Text>
              <TouchableOpacity onPress={() => void loadMembers()}>
                <Ionicons name="refresh-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              value={memberQuery}
              onChangeText={setMemberQuery}
              placeholder="Search members"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort</Text>
              <View style={styles.filtersRow}>
                <TouchableOpacity
                  style={[styles.filterPill, sortOption === 'name_asc' && styles.filterPillActive]}
                  onPress={() => setSortOption('name_asc')}
                >
                  <Text style={[styles.filterPillText, sortOption === 'name_asc' && styles.filterPillTextActive]}>Name (A-Z)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, sortOption === 'name_desc' && styles.filterPillActive]}
                  onPress={() => setSortOption('name_desc')}
                >
                  <Text style={[styles.filterPillText, sortOption === 'name_desc' && styles.filterPillTextActive]}>Name (Z-A)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, sortOption === 'status' && styles.filterPillActive]}
                  onPress={() => setSortOption('status')}
                >
                  <Text style={[styles.filterPillText, sortOption === 'status' && styles.filterPillTextActive]}>Status</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, sortOption === 'role' && styles.filterPillActive]}
                  onPress={() => setSortOption('role')}
                >
                  <Text style={[styles.filterPillText, sortOption === 'role' && styles.filterPillTextActive]}>Role</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.filtersRow}>
              <TouchableOpacity
                style={[styles.filterPill, statusFilter === 'active' && styles.filterPillActive]}
                onPress={() => setStatusFilter('active')}
              >
                <Text style={[styles.filterPillText, statusFilter === 'active' && styles.filterPillTextActive]}>
                  Active ({statusCounts.active})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterPill, statusFilter === 'pending' && styles.filterPillActive]}
                onPress={() => setStatusFilter('pending')}
              >
                <Text style={[styles.filterPillText, statusFilter === 'pending' && styles.filterPillTextActive]}>
                  Pending ({statusCounts.pending})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterPill, statusFilter === 'rejected' && styles.filterPillActive]}
                onPress={() => setStatusFilter('rejected')}
              >
                <Text style={[styles.filterPillText, statusFilter === 'rejected' && styles.filterPillTextActive]}>
                  Rejected ({statusCounts.rejected})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterPill, statusFilter === 'all' && styles.filterPillActive]}
                onPress={() => setStatusFilter('all')}
              >
                <Text style={[styles.filterPillText, statusFilter === 'all' && styles.filterPillTextActive]}>
                  All ({rows.length})
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.filtersRow}>
              {roleFilterOptions.map((option) => {
                const isAll = option === 'all';
                const count = isAll ? rows.length : (roleFilterCounts[option] || 0);
                const label = isAll ? 'All' : getRoleBucketDisplayLabel(option, orgInterestSlug);
                return (
                  <TouchableOpacity
                    key={`role-filter:${option}`}
                    style={[styles.filterPill, roleFilter === option && styles.filterPillActive]}
                    onPress={() => setRoleFilter(option)}
                  >
                    <Text style={[styles.filterPillText, roleFilter === option && styles.filterPillTextActive]}>
                      {label} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            {loading ? (
              <View style={styles.centerStateCompact}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            ) : filteredRows.length === 0 ? (
              <Text style={styles.stateText}>No members match your filters.</Text>
            ) : (
              filteredRows.map((row) => {
                const saveState = saveStates[row.id];
                return (
                  <View key={row.id} style={styles.memberRow}>
                    <View style={styles.memberHeader}>
                      <TouchableOpacity
                        style={styles.memberTextWrap}
                        onPress={() => router.push({ pathname: '/organization/student/[studentId]', params: { studentId: row.user_id, orgId: resolvedActiveOrgId! } })}
                      >
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>{row.user_name}</Text>
                          <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                        </View>
                        {row.user_email ? <Text style={styles.memberEmail}>{row.user_email}</Text> : null}
                      </TouchableOpacity>
                      <View style={styles.memberHeaderBadges}>
                        <View style={[
                          styles.statusBadge,
                          getStatusBucket(row) === 'active' && styles.statusBadgeActive,
                          getStatusBucket(row) === 'pending' && styles.statusBadgePending,
                          getStatusBucket(row) === 'rejected' && styles.statusBadgeRejected,
                          getStatusBucket(row) === 'other' && styles.statusBadgeOther,
                        ]}>
                          <Text style={styles.statusBadgeText}>
                            {getStatusBucket(row) === 'active'
                              ? 'Active'
                              : getStatusBucket(row) === 'pending'
                                ? 'Pending'
                                : getStatusBucket(row) === 'rejected'
                                  ? 'Rejected'
                                  : 'Unknown'}
                          </Text>
                        </View>
                        <View style={styles.roleBadge}>
                          <Text style={styles.roleBadgeText}>
                            {getRoleBucketDisplayLabel(getRoleBucketKey(row.role, orgInterestSlug), orgInterestSlug)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {row.blueprints.length > 0 && (
                      <View style={styles.blueprintsList}>
                        {row.blueprints.map((bp) => (
                          <TouchableOpacity
                            key={bp.id}
                            style={styles.blueprintChip}
                            onPress={() => router.push(`/blueprint/${bp.slug}` as any)}
                          >
                            <Ionicons name="book-outline" size={12} color="#6D28D9" />
                            <Text style={styles.blueprintChipText} numberOfLines={1}>{bp.title}</Text>
                            {bp.subscriber_count > 0 && (
                              <Text style={styles.blueprintSubCount}>{bp.subscriber_count} sub{bp.subscriber_count !== 1 ? 's' : ''}</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <View style={styles.roleOptionsWrap}>
                      {getDisplayRoleOptions(row.role).map((optionRole) => {
                        const selected = normalizeStatus(optionRole) === normalizeStatus(row.role);
                        return (
                          <TouchableOpacity
                            key={`${row.id}:${optionRole}`}
                            style={[styles.roleOption, selected && styles.roleOptionSelected]}
                            onPress={() => void handleChangeRole(row, optionRole)}
                            disabled={busyMembershipId === row.id || selected}
                          >
                            <Text style={[styles.roleOptionText, selected && styles.roleOptionTextSelected]}>
                              {coachRoleLabel({ interestSlug: orgInterestSlug || '', role: optionRole })}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {user?.id && row.user_id !== user.id ? (
                      <View style={styles.memberActionsRow}>
                        <TouchableOpacity
                          style={[styles.resetButton, busyMembershipId === row.id && styles.actionButtonDisabled]}
                          onPress={() => void handleResetToPending(row)}
                          disabled={busyMembershipId === row.id}
                        >
                          <Text style={styles.resetButtonText}>
                            {busyMembershipId === row.id ? 'Saving...' : 'Reset to pending'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.removeButton, busyMembershipId === row.id && styles.actionButtonDisabled]}
                          onPress={() => void handleRemoveAccess(row)}
                          disabled={busyMembershipId === row.id}
                        >
                          <Text style={styles.removeButtonText}>
                            {busyMembershipId === row.id ? 'Saving...' : 'Remove access'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {saveState ? (
                      <Text style={saveState.type === 'error' ? styles.errorText : styles.savedText}>
                        {saveState.message}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {resolvedActiveOrgId && (
        <InviteMemberSheet
          visible={inviteSheetVisible}
          onClose={() => setInviteSheetVisible(false)}
          organizationId={resolvedActiveOrgId}
          organizationName={activeOrganization?.name}
          interestSlug={orgInterestSlug}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inviteButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
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
  searchInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  sortRow: {
    gap: 6,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  filterPillActive: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  filterPillText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#1D4ED8',
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
  memberRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  memberHeaderBadges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  memberTextWrap: {
    flex: 1,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  memberEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  roleBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeActive: {
    backgroundColor: '#ECFDF3',
    borderColor: '#ABEFC6',
  },
  statusBadgePending: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusBadgeRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusBadgeOther: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  blueprintsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  blueprintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  blueprintChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
    maxWidth: 200,
  },
  blueprintSubCount: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  roleOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleOption: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  roleOptionSelected: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  roleOptionText: {
    fontSize: 11,
    color: '#334155',
  },
  roleOptionTextSelected: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  memberActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  resetButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resetButtonText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  removeButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    fontSize: 12,
    color: '#B42318',
    fontWeight: '600',
  },
  actionButtonDisabled: {
    opacity: 0.6,
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
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  errorText: {
    fontSize: 12,
    color: '#B42318',
  },
  savedText: {
    fontSize: 12,
    color: '#067647',
    fontWeight: '600',
  },
});
