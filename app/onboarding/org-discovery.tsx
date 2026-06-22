/**
 * Org Discovery Screen
 *
 * Shown after trial-activation for interest-only users (no specific org).
 * Displays organizations in their interest that they can browse and join.
 * Skippable — this is a discovery moment, not a gate.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import {
  isRequestJoinActive,
  isRequestJoinPending,
  organizationDiscoveryService,
  type OrganizationJoinMode,
} from '@/services/OrganizationDiscoveryService';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  join_mode: OrganizationJoinMode;
  member_count?: number;
}

type OrgJoinState = 'idle' | 'joining' | 'joined' | 'pending' | 'blocked';

export default function OrgDiscoveryScreen() {
  const router = useRouter();
  const [interestSlug, setInterestSlug] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinStates, setJoinStates] = useState<Record<string, OrgJoinState>>({});
  // Org ids that have an active owner/admin/manager able to approve a join.
  const [approverOrgIds, setApproverOrgIds] = useState<Set<string>>(new Set());

  const ctx = getOnboardingContext(interestSlug || undefined);

  useEffect(() => {
    loadOrgs();
    // Mount-once: org list is loaded a single time for this onboarding step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrgs = async () => {
    try {
      const slug = await AsyncStorage.getItem('onboarding_interest_slug');
      setInterestSlug(slug);

      if (!slug) {
        // No interest context — skip to app
        await cleanup();
        router.replace('/onboarding/explore-interests');
        return;
      }

      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, join_mode')
        .eq('interest_slug', slug)
        .eq('is_active', true)
        .order('name')
        .limit(20);

      if (error) throw error;

      if (!data || data.length === 0) {
        // No orgs for this interest — skip to app
        await cleanup();
        router.replace('/onboarding/explore-interests');
        return;
      }

      const loadedOrgs: OrgRow[] = data.map((o) => ({
        ...o,
        join_mode: o.join_mode || 'invite_only',
      }));
      setOrgs(loadedOrgs);

      // Resolve which orgs have an active approver. Seeded directory clubs
      // typically have none, so their join requests would go nowhere — we
      // surface those as passive ("Not on BetterAt yet") rather than offering
      // a Request button that can never be actioned.
      const { data: approverRows, error: approverError } = await supabase.rpc(
        'orgs_with_approver',
        { p_org_ids: loadedOrgs.map((o) => o.id) },
      );
      if (!approverError && approverRows) {
        setApproverOrgIds(
          new Set((approverRows as { organization_id: string }[]).map((r) => r.organization_id)),
        );
      }
    } catch (err) {
      console.error('[OrgDiscovery] Error loading orgs:', err);
      // On error, don't block — go to app
      await cleanup();
      router.replace('/onboarding/explore-interests');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (org: OrgRow) => {
    setJoinStates((prev) => ({ ...prev, [org.id]: 'joining' }));
    try {
      const result = await organizationDiscoveryService.requestJoin({
        orgId: org.id,
        mode: org.join_mode,
      });

      if (isRequestJoinActive(result)) {
        setJoinStates((prev) => ({ ...prev, [org.id]: 'joined' }));
      } else if (isRequestJoinPending(result)) {
        setJoinStates((prev) => ({ ...prev, [org.id]: 'pending' }));
      } else {
        setJoinStates((prev) => ({ ...prev, [org.id]: 'blocked' }));
      }
    } catch (err) {
      console.error('[OrgDiscovery] Join error:', err);
      setJoinStates((prev) => ({ ...prev, [org.id]: 'idle' }));
    }
  };

  const cleanup = async () => {
    // Only remove org slug — interest slug is needed by explore-interests and manifesto
    await AsyncStorage.removeItem('onboarding_org_slug');
  };

  const handleContinue = useCallback(async () => {
    await cleanup();
    router.replace('/onboarding/explore-interests');
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={ctx.color} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: ctx.color + '15' }]}>
            <Ionicons name="people" size={40} color={ctx.color} />
          </View>

          <Text style={styles.title}>
            {ctx.interestName} organizations on BetterAt
          </Text>
          <Text style={styles.subtitle}>
            Join an organization to access their programs and connect with peers.
          </Text>

          <View style={styles.orgList}>
            {orgs.map((org) => {
              const state = joinStates[org.id] || 'idle';
              const isInviteOnly = org.join_mode === 'invite_only';
              // A request_to_join org with no active approver can't action a
              // request — show it as a passive directory listing instead.
              const isUnclaimedRequest =
                org.join_mode === 'request_to_join' && !approverOrgIds.has(org.id);

              return (
                <View key={org.id} style={styles.orgCard}>
                  <View style={styles.orgInfo}>
                    <View style={[styles.orgIcon, { backgroundColor: ctx.color + '12' }]}>
                      <Ionicons name="business-outline" size={20} color={ctx.color} />
                    </View>
                    <View style={styles.orgText}>
                      <Text style={styles.orgName}>{org.name}</Text>
                      {isInviteOnly && (
                        <Text style={styles.orgMeta}>Invite only</Text>
                      )}
                      {isUnclaimedRequest ? (
                        <Text style={styles.orgMeta}>Not on BetterAt yet</Text>
                      ) : org.join_mode === 'request_to_join' ? (
                        <Text style={styles.orgMeta}>Requires approval</Text>
                      ) : null}
                    </View>
                  </View>

                  {isInviteOnly ? (
                    <View style={styles.inviteOnlyBadge}>
                      <Ionicons name="lock-closed-outline" size={14} color="#94A3B8" />
                    </View>
                  ) : isUnclaimedRequest ? (
                    <View style={styles.inviteOnlyBadge}>
                      <Ionicons name="ellipse-outline" size={14} color="#CBD5E1" />
                    </View>
                  ) : state === 'joined' ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#16A34A' }]}>
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </View>
                  ) : state === 'pending' ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#D97706' }]}>
                      <Ionicons name="time" size={16} color="#FFFFFF" />
                    </View>
                  ) : state === 'joining' ? (
                    <View style={styles.statusBadge}>
                      <ActivityIndicator size="small" color={ctx.color} />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.joinButton, { borderColor: ctx.color }]}
                      onPress={() => handleJoin(org)}
                    >
                      <Text style={[styles.joinButtonText, { color: ctx.color }]}>
                        {org.join_mode === 'request_to_join' ? 'Request' : 'Join'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: ctx.color }]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleContinue}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  orgList: {
    width: '100%',
    gap: 10,
    marginBottom: 28,
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  orgInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgText: {
    flex: 1,
  },
  orgName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  orgMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  inviteOnlyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 12,
    paddingVertical: 10,
  },
  skipButtonText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
});
