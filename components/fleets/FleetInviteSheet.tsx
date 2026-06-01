/**
 * FleetInviteSheet — modal for fleet owners/captains to invite other
 * sailors. Two-line workflow:
 *
 *   1. Type a name → debounced profile search (profile_public=true,
 *      excludes existing members/invitees).
 *   2. Tap "Invite" on a row → SECURITY DEFINER RPC creates a
 *      fleet_members row with status='invited'. Row flips to a
 *      muted "Invited ✓" state so the inviter sees confirmation
 *      without needing a roster refresh.
 *
 * The invitee finds the pending invite by reading their own
 * fleet_members rows (status='invited'); accepting is a self-update
 * to 'active' (existing RLS already allows that path — no extra
 * server work needed here).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  FleetDiscoveryService,
  type InviteCandidate,
} from '@/services/FleetDiscoveryService';
import { fleetService } from '@/services/fleetService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  visible: boolean;
  onClose: () => void;
  fleetId: string;
  fleetName: string;
}

export function FleetInviteSheet({ visible, onClose, fleetId, fleetName }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<InviteCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  // user id → 'pending' | 'sent' | 'error' — drives the per-row
  // CTA state without forcing a refetch after each invite.
  const [invitedState, setInvitedState] = useState<
    Record<string, 'pending' | 'sent' | 'error'>
  >({});
  // Email-invite state keyed by the lowercased email being invited.
  const [emailState, setEmailState] = useState<
    Record<string, 'pending' | 'sent' | 'error'>
  >({});

  // Reset internal state when the sheet opens (so opening the
  // sheet on a different fleet doesn't show stale results from a
  // prior session).
  useEffect(() => {
    if (visible) {
      setQuery('');
      setDebouncedQuery('');
      setResults([]);
      setInvitedState({});
      setEmailState({});
    }
  }, [visible]);

  // 250ms debounce keeps the profiles query off every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let alive = true;
    if (debouncedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    FleetDiscoveryService.searchInviteCandidates(fleetId, debouncedQuery)
      .then((rows) => {
        if (alive) setResults(rows);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [debouncedQuery, fleetId]);

  const handleInvite = useCallback(
    async (candidate: InviteCandidate) => {
      setInvitedState((prev) => ({ ...prev, [candidate.id]: 'pending' }));
      const result = await FleetDiscoveryService.inviteMember(fleetId, candidate.id);
      if (result) {
        setInvitedState((prev) => ({ ...prev, [candidate.id]: 'sent' }));
      } else {
        setInvitedState((prev) => ({ ...prev, [candidate.id]: 'error' }));
        showAlert('Invite failed', 'Could not send the invite. Please try again.');
      }
    },
    [fleetId],
  );

  const emailInput = debouncedQuery.toLowerCase();
  const looksLikeEmail = EMAIL_RE.test(emailInput);

  const handleEmailInvite = useCallback(
    async (email: string) => {
      setEmailState((prev) => ({ ...prev, [email]: 'pending' }));
      try {
        const result = await fleetService.inviteMemberByEmail(fleetId, email);
        setEmailState((prev) => ({ ...prev, [email]: 'sent' }));
        if (result === 'already_member') {
          showAlert('Already invited', 'That sailor is already in this fleet.');
        }
      } catch {
        setEmailState((prev) => ({ ...prev, [email]: 'error' }));
        showAlert('Invite failed', 'Could not send the invite. Please try again.');
      }
    },
    [fleetId],
  );

  const emptyMessage = useMemo(() => {
    if (loading) return null;
    if (looksLikeEmail) return null;
    if (debouncedQuery.length < 2) {
      return 'Type a name to find sailors, or enter an email to invite someone new.';
    }
    if (results.length === 0) {
      return `No sailors match "${debouncedQuery}". Enter their email to invite them to BetterAt.`;
    }
    return null;
  }, [loading, looksLikeEmail, debouncedQuery, results.length]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.headerSide}>
            <Text style={styles.headerLink}>Close</Text>
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Invite to fleet</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {fleetName}
            </Text>
          </View>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.results}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#64748B" />
              <Text style={styles.loadingText}>Searching…</Text>
            </View>
          ) : null}

          {looksLikeEmail ? (
            <Pressable
              style={styles.emailRow}
              onPress={() => handleEmailInvite(emailInput)}
              disabled={emailState[emailInput] === 'pending'}
            >
              <View style={styles.emailIcon}>
                <Ionicons name="mail-outline" size={18} color="#2563EB" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>{emailInput}</Text>
                <Text style={styles.rowMeta}>Invite by email</Text>
              </View>
              <EmailCta state={emailState[emailInput]} />
            </Pressable>
          ) : null}

          {emptyMessage ? <Text style={styles.empty}>{emptyMessage}</Text> : null}

          {results.map((candidate) => {
            const state = invitedState[candidate.id];
            return (
              <View key={candidate.id} style={styles.row}>
                <View style={styles.avatar}>
                  {candidate.avatarUrl ? (
                    <Image
                      source={{ uri: candidate.avatarUrl }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {candidate.displayName.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {candidate.displayName}
                  </Text>
                  {candidate.context ? (
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {candidate.context}
                    </Text>
                  ) : null}
                </View>
                <InviteCta
                  state={state}
                  onPress={() => handleInvite(candidate)}
                />
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface CtaProps {
  state: 'pending' | 'sent' | 'error' | undefined;
  onPress: () => void;
}

function InviteCta({ state, onPress }: CtaProps) {
  if (state === 'pending') {
    return (
      <View style={[styles.cta, styles.ctaPending]}>
        <ActivityIndicator size="small" color="#64748B" />
      </View>
    );
  }
  if (state === 'sent') {
    return (
      <View style={[styles.cta, styles.ctaSent]}>
        <Ionicons name="checkmark" size={14} color="#15803D" />
        <Text style={styles.ctaSentText}>Invited</Text>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} style={[styles.cta, styles.ctaIdle]}>
      <Text style={styles.ctaIdleText}>
        {state === 'error' ? 'Retry' : 'Invite'}
      </Text>
    </Pressable>
  );
}

function EmailCta({ state }: { state: 'pending' | 'sent' | 'error' | undefined }) {
  if (state === 'pending') {
    return (
      <View style={[styles.cta, styles.ctaPending]}>
        <ActivityIndicator size="small" color="#64748B" />
      </View>
    );
  }
  if (state === 'sent') {
    return (
      <View style={[styles.cta, styles.ctaSent]}>
        <Ionicons name="checkmark" size={14} color="#15803D" />
        <Text style={styles.ctaSentText}>Invited</Text>
      </View>
    );
  }
  return (
    <View style={[styles.cta, styles.ctaIdle]}>
      <Text style={styles.ctaIdleText}>{state === 'error' ? 'Retry' : 'Invite'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerSide: { width: 56 },
  headerLink: { fontSize: 15, color: '#2563EB' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  headerSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    padding: 0,
  },
  results: { padding: 16, paddingBottom: 32, gap: 4 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 13, color: '#64748B' },
  empty: {
    fontSize: 13,
    color: '#64748B',
    paddingVertical: 12,
    paddingHorizontal: 4,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  emailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 36, height: 36 },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '500', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    minWidth: 72,
    justifyContent: 'center',
  },
  ctaIdle: { backgroundColor: '#2563EB' },
  ctaIdleText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  ctaPending: { backgroundColor: '#F1F5F9' },
  ctaSent: { backgroundColor: '#DCFCE7' },
  ctaSentText: { fontSize: 13, fontWeight: '600', color: '#15803D' },
});
