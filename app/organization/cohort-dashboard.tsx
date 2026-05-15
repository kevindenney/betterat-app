import { getActiveMembership, isActiveMembership, isOrgAdminRole, resolveActiveOrgId } from '@/lib/organizations/adminGate';
import { fetchOrganizationInterestSlug } from '@/components/organizations/OrgContextPill';
import { OrgAdminHeader } from '@/components/organizations/OrgAdminHeader';
import { OrgAdminOnboardingCard } from '@/components/organizations/OrgAdminOnboardingCard';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useAuth } from '@/providers/AuthProvider';
import { FacultyCohortDashboard } from '@/components/organization/FacultyCohortDashboard';
import { supabase } from '@/services/supabase';
import { isUuid } from '@/utils/uuid';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useOrgAdminOnboardingCard } from '@/hooks/useOrgAdminOnboardingCard';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

type CohortOption = { id: string; name: string; memberCount: number };

export default function CohortDashboardScreen() {
  const {
    activeOrganization,
    activeOrganizationId,
    memberships,
    loading: orgLoading,
    ready: orgReady,
  } = useOrganization();
  const { userProfile } = useAuth();

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
  const canView = hasValidActiveOrgId && hasActiveMembership && hasAdminRole;

  // Fetch org interest slug
  useEffect(() => {
    if (!resolvedActiveOrgId || !isUuid(resolvedActiveOrgId)) return;
    let cancelled = false;
    void (async () => {
      try {
        const slug = await fetchOrganizationInterestSlug(resolvedActiveOrgId);
        if (!cancelled) setOrgInterestSlug(slug);
      } catch {
        if (!cancelled) setOrgInterestSlug(null);
      }
    })();
    return () => { cancelled = true; };
  }, [resolvedActiveOrgId]);

  // Fetch cohorts with member counts
  const loadCohorts = useCallback(async () => {
    if (!canView || !resolvedActiveOrgId) {
      setCohorts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: cohortRows, error: cohortErr } = await supabase
        .from('betterat_org_cohorts')
        .select('id, name')
        .eq('org_id', resolvedActiveOrgId)
        .order('created_at', { ascending: false });

      if (cohortErr) throw cohortErr;

      const results: CohortOption[] = [];
      for (const c of cohortRows ?? []) {
        const { count } = await supabase
          .from('betterat_org_cohort_members')
          .select('id', { count: 'exact', head: true })
          .eq('cohort_id', c.id);
        results.push({ id: c.id, name: c.name, memberCount: count ?? 0 });
      }

      setCohorts(results);
      if (results.length > 0 && !selectedCohortId) {
        setSelectedCohortId(results[0].id);
      }
    } catch (err: any) {
      setCohorts([]);
    } finally {
      setLoading(false);
    }
  }, [canView, resolvedActiveOrgId, selectedCohortId]);

  useEffect(() => {
    if (!orgReady || orgLoading || !canView) return;
    void loadCohorts();
  }, [canView, orgLoading, orgReady, loadCohorts]);

  const onboarding = useOrgAdminOnboardingCard(resolvedActiveOrgId);
  const adminFirstName = useMemo(() => {
    const fullName: string | null | undefined = userProfile?.full_name;
    if (!fullName || typeof fullName !== 'string') return null;
    const first = fullName.trim().split(/\s+/)[0];
    return first || null;
  }, [userProfile?.full_name]);
  const showOnboardingCard =
    FEATURE_FLAGS.JHU_ADMIN_DASHBOARD_IOS &&
    onboarding.shouldShow &&
    !loading &&
    cohorts.length > 0;

  return (
    <View style={styles.container}>
      <OrgAdminHeader
        title={`Dashboard${activeOrganization?.name ? ` · ${activeOrganization.name}` : ''}`}
        subtitle="Cohort competency overview"
        interestSlug={orgInterestSlug}
      />

      {!orgReady || orgLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : !hasValidActiveOrgId ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Select an active organization first.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/settings/organization-access')}>
            <Text style={styles.primaryButtonText}>Open Organization Access</Text>
          </TouchableOpacity>
        </View>
      ) : !canView ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Faculty or admin access required.</Text>
        </View>
      ) : loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.stateText}>Loading cohorts...</Text>
        </View>
      ) : cohorts.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="people-outline" size={48} color="#CBD5E1" />
          <Text style={styles.stateText}>No cohorts created yet.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/organization/cohorts')}>
            <Text style={styles.primaryButtonText}>Create a Cohort</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {showOnboardingCard && (
            <OrgAdminOnboardingCard
              adminName={adminFirstName}
              organizationName={activeOrganization?.name ?? null}
              onTakeTour={() => router.push('/organization/members')}
              onDismiss={() => { void onboarding.dismiss(); }}
            />
          )}
          {/* Cohort selector */}
          {cohorts.length > 1 && (
            <View style={styles.selectorRow}>
              {cohorts.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.selectorPill, selectedCohortId === c.id && styles.selectorPillActive]}
                  onPress={() => setSelectedCohortId(c.id)}
                >
                  <Text style={[styles.selectorText, selectedCohortId === c.id && styles.selectorTextActive]}>
                    {c.name} ({c.memberCount})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedCohortId && resolvedActiveOrgId && (
            <FacultyCohortDashboard
              cohortId={selectedCohortId}
              orgId={resolvedActiveOrgId}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  stateText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  primaryButton: {
    borderRadius: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  selectorRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  selectorPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  selectorPillActive: {
    backgroundColor: '#2563EB',
  },
  selectorText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  selectorTextActive: { color: '#FFFFFF' },
});
