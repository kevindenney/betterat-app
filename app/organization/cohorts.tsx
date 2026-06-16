import { getActiveMembership, isActiveMembership, isOrgAdminRole, resolveActiveOrgId } from '@/lib/organizations/adminGate';
import { orgInterestLabel } from '@/lib/organizations/orgInterest';
import { fetchOrganizationInterestSlug } from '@/components/organizations/OrgContextPill';
import { OrgAdminHeader } from '@/components/organizations/OrgAdminHeader';
import { useOrganization } from '@/providers/OrganizationProvider';
import { supabase } from '@/services/supabase';
import { isUuid } from '@/utils/uuid';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type CohortRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  interest_slug: string | null;
  created_at: string;
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export default function OrganizationCohortsScreen() {
  const {
    activeOrganization,
    activeOrganizationId,
    memberships,
    loading: orgLoading,
    ready: orgReady,
  } = useOrganization();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [countsByCohortId, setCountsByCohortId] = useState<Record<string, number>>({});

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orgInterestSlug, setOrgInterestSlug] = useState<string | null>(null);

  const resolvedActiveOrgId = useMemo(
    () => resolveActiveOrgId({ activeOrganizationId, memberships: memberships as any }),
    [activeOrganizationId, memberships]
  );
  const activeOrgMembership = useMemo(
    () => getActiveMembership({ memberships: memberships as any, activeOrgId: resolvedActiveOrgId }),
    [memberships, resolvedActiveOrgId]
  );

  const hasValidActiveOrgId = Boolean(resolvedActiveOrgId && isUuid(resolvedActiveOrgId));
  const membershipStatus = activeOrgMembership?.membershipStatus || null;
  const membershipRole = activeOrgMembership?.role || null;
  const hasActiveMembership = isActiveMembership(membershipStatus);
  const hasAdminRole = isOrgAdminRole(membershipRole);
  const canEdit = hasValidActiveOrgId && hasActiveMembership && hasAdminRole;
  const canView = hasValidActiveOrgId && hasActiveMembership;

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

  const loadCohorts = useCallback(async () => {
    if (!canView || !resolvedActiveOrgId) {
      setRows([]);
      setCountsByCohortId({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorText(null);

    try {
      const { data: cohortsData, error: cohortsError } = await supabase
        .from('betterat_org_cohorts')
        .select('id,org_id,name,description,interest_slug,created_at')
        .eq('org_id', resolvedActiveOrgId)
        .order('created_at', { ascending: false });

      if (cohortsError) throw cohortsError;

      const nextRows = (cohortsData || []) as CohortRow[];
      setRows(nextRows);

      if (nextRows.length === 0) {
        setCountsByCohortId({});
        return;
      }

      const cohortIds = nextRows.map((row) => row.id);
      const { data: memberRows, error: membersError } = await supabase
        .from('betterat_org_cohort_members')
        .select('cohort_id')
        .in('cohort_id', cohortIds);

      if (membersError) throw membersError;

      const counts: Record<string, number> = {};
      for (const row of memberRows || []) {
        const cohortId = String((row as any).cohort_id || '');
        if (!cohortId) continue;
        counts[cohortId] = (counts[cohortId] || 0) + 1;
      }
      setCountsByCohortId(counts);
    } catch (error: any) {
      setRows([]);
      setCountsByCohortId({});
      setErrorText(error?.message || 'Could not load cohorts.');
    } finally {
      setLoading(false);
    }
  }, [canView, resolvedActiveOrgId]);

  useEffect(() => {
    if (!orgReady || orgLoading || !canView) {
      setRows([]);
      setCountsByCohortId({});
      setLoading(false);
      return;
    }
    void loadCohorts();
  }, [canView, loadCohorts, orgLoading, orgReady]);

  const handleCreateCohort = useCallback(async () => {
    if (!canEdit || !resolvedActiveOrgId) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorText('Cohort name is required.');
      return;
    }

    setSaving(true);
    setErrorText(null);
    try {
      const payload = {
        org_id: resolvedActiveOrgId,
        name: trimmedName,
        description: description.trim() || null,
        interest_slug: orgInterestSlug || null,
      };

      const { error } = await supabase.from('betterat_org_cohorts').insert(payload);
      if (error) throw error;

      setName('');
      setDescription('');
      await loadCohorts();
    } catch (error: any) {
      setErrorText(error?.message || 'Could not create cohort.');
    } finally {
      setSaving(false);
    }
  }, [canEdit, description, loadCohorts, name, orgInterestSlug, resolvedActiveOrgId]);

  return (
    <View style={styles.container}>
      <OrgAdminHeader
        title={`Cohorts${activeOrganization?.name ? ` · ${activeOrganization.name}` : ''}`}
        subtitle="Organize members into cohorts and teams."
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
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {canEdit ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Create cohort</Text>
              <TextInput
                style={styles.input}
                placeholder="Cohort name"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.disabledButton]}
                onPress={() => void handleCreateCohort()}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Create cohort'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.stateText}>
                {normalize(membershipRole) === 'member'
                  ? 'Your role in this org is Member. Ask an admin to promote you.'
                  : 'Admin access required to create or edit cohorts.'}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Cohorts</Text>
              <TouchableOpacity onPress={() => void loadCohorts()}>
                <Ionicons name="refresh-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            {loading ? (
              <View style={styles.centerStateCompact}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            ) : rows.length === 0 ? (
              <Text style={styles.stateText}>No cohorts yet.</Text>
            ) : (
              rows.map((row) => (
                <TouchableOpacity
                  key={row.id}
                  style={styles.row}
                  onPress={() => router.push({ pathname: '/organization/cohort/[cohortId]', params: { cohortId: row.id } })}
                >
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>{row.name}</Text>
                    {row.description ? <Text style={styles.rowDescription}>{row.description}</Text> : null}
                    <Text style={styles.rowMeta}>
                      {countsByCohortId[row.id] || 0} members{row.interest_slug ? ` · ${orgInterestLabel(row.interest_slug)}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#64748B" />
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  primaryButton: {
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  disabledButton: { opacity: 0.6 },
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
  rowTextWrap: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowDescription: { fontSize: 12, color: '#475569' },
  rowMeta: { fontSize: 11, color: '#64748B' },
  errorText: { fontSize: 12, color: '#B42318' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  centerStateCompact: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  stateText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
});
