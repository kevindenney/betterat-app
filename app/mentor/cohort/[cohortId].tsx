/**
 * /mentor/cohort/[cohortId] — Section G entry point.
 *
 * Mentor / coach / faculty view of a cohort, rendered in the iOS
 * register design language. Wraps <MentorCohortDashboard /> with the
 * route-level guards (org membership, valid cohort id) the existing
 * /organization/cohort-dashboard surface uses.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useOrganization } from '@/providers/OrganizationProvider';
import { resolveActiveOrgId } from '@/lib/organizations/adminGate';
import { isUuid } from '@/utils/uuid';
import { supabase } from '@/services/supabase';
import { MentorCohortDashboard } from '@/components/ios-register/mentor/MentorCohortDashboard';

export default function MentorCohortRoute() {
  const params = useLocalSearchParams<{ cohortId?: string }>();
  const cohortId = String(params.cohortId || '').trim();

  const { activeOrganizationId, memberships, loading: orgLoading } = useOrganization();
  const orgId = useMemo(
    () =>
      resolveActiveOrgId({
        activeOrganizationId,
        memberships: memberships as any,
      }) ?? '',
    [activeOrganizationId, memberships],
  );

  const [cohortTitle, setCohortTitle] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUuid(cohortId) || !orgId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('betterat_org_cohorts')
        .select('name')
        .eq('id', cohortId)
        .eq('org_id', orgId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setTitleError(error.message);
        return;
      }
      setCohortTitle((data as { name?: string } | null)?.name ?? 'Cohort');
    })();
    return () => {
      cancelled = true;
    };
  }, [cohortId, orgId]);

  if (orgLoading) {
    return (
      <SafeAreaView style={styles.surface} edges={['top']}>
        <Stack.Screen options={{ title: 'Cohort', headerShown: true }} />
        <View style={styles.center}>
          <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
        </View>
      </SafeAreaView>
    );
  }

  if (!orgId) {
    return (
      <SafeAreaView style={styles.surface} edges={['top']}>
        <Stack.Screen options={{ title: 'Cohort', headerShown: true }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Select an active organization first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isUuid(cohortId)) {
    return (
      <SafeAreaView style={styles.surface} edges={['top']}>
        <Stack.Screen options={{ title: 'Cohort', headerShown: true }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Invalid cohort id.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (titleError) {
    return (
      <SafeAreaView style={styles.surface} edges={['top']}>
        <Stack.Screen options={{ title: 'Cohort', headerShown: true }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{titleError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: cohortTitle ?? 'Cohort',
          headerShown: true,
        }}
      />
      <MentorCohortDashboard
        cohortId={cohortId}
        orgId={orgId}
        cohortTitle={cohortTitle ?? undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
  },
});
