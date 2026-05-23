/**
 * /mentor/cohorts — index of cohorts the viewer can mentor.
 *
 * iOS register-styled list. Tap a row → /mentor/cohort/[cohortId]
 * (Section G dashboard). Reuses the existing betterat_org_cohorts
 * query the legacy Cohort detail route does, scoped to the viewer's
 * active org.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useOrganization } from '@/providers/OrganizationProvider';
import { resolveActiveOrgId } from '@/lib/organizations/adminGate';
import { isUuid } from '@/utils/uuid';
import { supabase } from '@/services/supabase';

interface CohortRow {
  id: string;
  name: string;
  member_count: number | null;
}

export default function MentorCohortsIndex() {
  const { activeOrganizationId, memberships, loading: orgLoading } = useOrganization();
  const orgId = useMemo(
    () =>
      resolveActiveOrgId({
        activeOrganizationId,
        memberships: memberships as any,
      }) ?? '',
    [activeOrganizationId, memberships],
  );

  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !isUuid(orgId)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      // Pull cohorts for the active org, then count members in a
      // second query (Supabase select with `count` aggregate would be
      // cleaner via RPC, but a simple group-by gets us there without
      // schema work).
      const { data: cohortRows, error: cohortErr } = await supabase
        .from('betterat_org_cohorts')
        .select('id,name')
        .eq('org_id', orgId)
        .order('name', { ascending: true });

      if (cancelled) return;
      if (cohortErr) {
        setError(cohortErr.message);
        setLoading(false);
        return;
      }
      const ids = (cohortRows ?? []).map((c) => (c as { id: string }).id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: members } = await supabase
          .from('betterat_org_cohort_members')
          .select('cohort_id')
          .in('cohort_id', ids);
        for (const row of (members ?? []) as { cohort_id: string }[]) {
          counts[row.cohort_id] = (counts[row.cohort_id] ?? 0) + 1;
        }
      }
      if (cancelled) return;
      setCohorts(
        (cohortRows ?? []).map((c) => {
          const r = c as { id: string; name: string };
          return {
            id: r.id,
            name: r.name,
            member_count: counts[r.id] ?? 0,
          };
        }),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return (
    <SafeAreaView style={styles.surface} edges={['top']}>
      <Stack.Screen options={{ title: 'Cohorts', headerShown: true }} />
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cohorts</Text>
        <Text style={styles.subtitle}>
          {cohorts.length === 0
            ? orgLoading || loading
              ? ' '
              : 'No cohorts in this org yet.'
            : `${cohorts.length} ${cohorts.length === 1 ? 'cohort' : 'cohorts'}`}
        </Text>
      </View>

      {orgLoading || loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={28} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !orgId ? (
        <View style={styles.center}>
          <Text style={styles.dimText}>
            Select an active organization to see cohorts.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {cohorts.map((c) => (
            <Pressable
              key={c.id}
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: '/mentor/cohort/[cohortId]',
                  params: { cohortId: c.id },
                } as never)
              }
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{c.name}</Text>
                <Text style={styles.rowMeta}>
                  {c.member_count ?? 0}{' '}
                  {(c.member_count ?? 0) === 1 ? 'member' : 'members'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={IOS_REGISTER.labelTertiary}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  errorText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
  },
  dimText: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    marginBottom: 8,
  },
  rowText: { flex: 1 },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
});
