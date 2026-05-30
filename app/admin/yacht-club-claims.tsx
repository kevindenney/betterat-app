import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  YachtClubClaimService,
  type OrganizationClaimRow,
  type YachtClubClaimDecision,
} from '@/services/YachtClubClaimService';

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

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

function claimStatusColor(status: string): string {
  if (status === 'approved') return C.green;
  if (status === 'rejected') return C.red;
  if (status === 'needs_more_info') return C.amber;
  return C.blue;
}

export default function YachtClubClaimsAdminScreen() {
  const [claims, setClaims] = useState<OrganizationClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      setClaims(await YachtClubClaimService.listClaims());
    } catch (error: any) {
      setErrorText(error?.message || 'Could not load yacht club claims.');
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (claim: OrganizationClaimRow, decision: YachtClubClaimDecision) => {
    setBusyId(claim.id);
    setErrorText(null);
    try {
      await YachtClubClaimService.reviewClaim(claim.id, decision, noteById[claim.id]);
      await load();
    } catch (error: any) {
      setErrorText(error?.message || 'Could not update claim.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Yacht club claims' }} />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Admin Review</Text>
          <Text style={styles.title}>Yacht Club Claims</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={() => void load()}>
          <Ionicons name="refresh-outline" size={16} color={C.ink} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.blue} />
        </View>
      ) : claims.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.body}>No claims visible for this account.</Text>
        </View>
      ) : (
        claims.map((claim) => {
          const org = Array.isArray(claim.organizations) ? claim.organizations[0] : claim.organizations;
          const isPending = claim.status === 'pending' || claim.status === 'needs_more_info';
          return (
            <View key={claim.id} style={styles.card}>
              <View style={styles.claimHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orgName}>{org?.name || 'Organization'}</Text>
                  <Text style={styles.body}>
                    {claim.claimant_name} · {claim.claimant_role} · {claim.submitted_by_email}
                  </Text>
                </View>
                <Text style={[styles.status, { color: claimStatusColor(claim.status) }]}>{claim.status.replace(/_/g, ' ')}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.meta}>Submitted {formatDate(claim.created_at)}</Text>
                <Text style={styles.meta}>{org?.confidence || 'review'} confidence</Text>
                <Text style={styles.meta}>{org?.total_entry_refs || 0} entry refs</Text>
              </View>

              {claim.evidence_url ? <Text style={styles.link}>{claim.evidence_url}</Text> : null}
              {claim.claimant_message ? <Text style={styles.body}>{claim.claimant_message}</Text> : null}
              {org?.risk_flags?.length ? (
                <View style={styles.chips}>
                  {org.risk_flags.map((flag) => (
                    <View key={flag} style={styles.chip}>
                      <Text style={styles.chipText}>{flag.replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {isPending ? (
                <>
                  <TextInput
                    value={noteById[claim.id] || ''}
                    onChangeText={(text) => setNoteById((prev) => ({ ...prev, [claim.id]: text }))}
                    style={styles.input}
                    placeholder="Review note"
                  />
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.actionButton, styles.approve]}
                      disabled={busyId === claim.id}
                      onPress={() => void review(claim, 'approved')}
                    >
                      <Text style={styles.actionText}>Approve</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.moreInfo]}
                      disabled={busyId === claim.id}
                      onPress={() => void review(claim, 'needs_more_info')}
                    >
                      <Text style={styles.actionText}>More info</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.reject]}
                      disabled={busyId === claim.id}
                      onPress={() => void review(claim, 'rejected')}
                    >
                      <Text style={styles.actionText}>Reject</Text>
                    </Pressable>
                  </View>
                </>
              ) : claim.review_note ? (
                <Text style={styles.body}>Review: {claim.review_note}</Text>
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
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', padding: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: C.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: C.ink, fontSize: 30, fontWeight: '800' },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9 },
  refreshText: { color: C.ink, fontWeight: '800' },
  center: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 16, gap: 10 },
  claimHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  orgName: { color: C.ink, fontSize: 20, fontWeight: '800' },
  body: { color: C.muted, fontSize: 14, lineHeight: 20 },
  status: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { color: C.muted, backgroundColor: '#F2F4F7', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, fontWeight: '700' },
  link: { color: C.blue, fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#FFF7ED', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  chipText: { color: C.amber, fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 10, color: C.ink, backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9 },
  approve: { backgroundColor: C.green },
  moreInfo: { backgroundColor: C.amber },
  reject: { backgroundColor: C.red },
  actionText: { color: '#FFFFFF', fontWeight: '800' },
  error: { color: C.red, fontWeight: '800' },
});
