/**
 * /redeem/[token] — public landing page for shareable org invite links.
 *
 * Token-based access (the URL is the credential). Signed-out visitors
 * see the preview and an "Open BetterAt" CTA that rounds back through
 * the existing /(auth)/login?returnTo=… flow. Signed-in visitors see a
 * "Join {Org} as {role}" primary action that calls
 * supabase.rpc('redeem_invite_link', { p_token }).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useInviteRedemption, InviteLinkStatus } from '@/hooks/useInviteRedemption';

const ROLE_LABEL: Record<string, string> = {
  member: 'Student',
  faculty: 'Blueprint author',
  preceptor: 'Mentor',
  admin: 'Admin',
};

function formatExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusBlurb(status: InviteLinkStatus | undefined): {
  label: string;
  tone: 'ok' | 'warn' | 'bad';
} | null {
  switch (status) {
    case 'expired':
      return { label: 'This invite has expired.', tone: 'bad' };
    case 'revoked':
      return { label: 'This invite has been revoked.', tone: 'bad' };
    case 'exhausted':
      return { label: 'This invite has no remaining uses.', tone: 'bad' };
    case 'active':
      return null;
    default:
      return null;
  }
}

export default function RedeemTokenPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, isGuest } = useAuth();
  const signedIn = !!user && !isGuest;

  const { preview, loading, redeem } = useInviteRedemption(token);
  const [redeemError, setRedeemError] = React.useState<string | null>(null);
  const [redeemed, setRedeemed] = React.useState(false);

  if (loading || !preview) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#28406B" />
        <Text style={s.loadingText}>Looking up your invite…</Text>
      </View>
    );
  }

  if (!preview.ok || preview.reason === 'not_found') {
    return (
      <View style={s.center}>
        <View style={s.icoBad}>
          <Ionicons name="link-outline" size={28} color="#C0392B" />
        </View>
        <Text style={s.h1}>Invite not found</Text>
        <Text style={s.copy}>
          Double-check the link with whoever shared it. Tokens are case-sensitive.
        </Text>
        <Pressable style={s.btnPrimary} onPress={() => router.replace('/')}>
          <Text style={s.btnPrimaryText}>Open BetterAt</Text>
        </Pressable>
      </View>
    );
  }

  const blocked = statusBlurb(preview.status);
  const roleLabel = ROLE_LABEL[preview.roleKey ?? 'member'] ?? 'Member';
  const expiry = formatExpiry(preview.expiresAt);
  const remaining =
    preview.maxUses != null
      ? Math.max(0, preview.maxUses - (preview.usesCount ?? 0))
      : null;

  const goToLogin = () => {
    const returnTo = `/redeem/${token}`;
    router.replace(`/(auth)/login?returnTo=${encodeURIComponent(returnTo)}` as any);
  };

  const handleRedeem = () => {
    setRedeemError(null);
    redeem.mutate(undefined, {
      onSuccess: () => {
        setRedeemed(true);
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Redemption failed';
        setRedeemError(msg);
      },
    });
  };

  if (redeemed) {
    return (
      <View style={s.center}>
        <View style={s.icoOk}>
          <Ionicons name="checkmark" size={32} color="#1E8F47" />
        </View>
        <Text style={s.h1}>You're in.</Text>
        <Text style={s.copy}>
          Welcome to <Text style={s.bold}>{preview.orgName}</Text>
          {preview.cohortName ? <> · joined <Text style={s.bold}>{preview.cohortName}</Text></> : null} as {roleLabel}.
        </Text>
        <Pressable style={s.btnPrimary} onPress={() => router.replace('/')}>
          <Text style={s.btnPrimaryText}>Open BetterAt</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.bodyInner}>
      <View style={s.card}>
        <View style={s.cardHead}>
          <View style={s.orgBadge}>
            <Text style={s.orgBadgeText}>{(preview.orgShortName ?? 'OR').slice(0, 2)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>You're invited to</Text>
            <Text style={s.h1}>{preview.orgName}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.row}>
          <Text style={s.fieldLabel}>Role</Text>
          <Text style={s.fieldValue}>{roleLabel}</Text>
        </View>

        {preview.cohortName ? (
          <View style={s.row}>
            <Text style={s.fieldLabel}>Cohort</Text>
            <Text style={s.fieldValue}>{preview.cohortName}</Text>
          </View>
        ) : null}

        {preview.autoSubscribe ? (
          <View style={s.row}>
            <Text style={s.fieldLabel}>On redemption</Text>
            <Text style={s.fieldValue}>Auto-subscribe to cohort blueprints</Text>
          </View>
        ) : null}

        {expiry ? (
          <View style={s.row}>
            <Text style={s.fieldLabel}>Expires</Text>
            <Text style={s.fieldValue}>{expiry}</Text>
          </View>
        ) : null}

        {remaining != null ? (
          <View style={s.row}>
            <Text style={s.fieldLabel}>Seats left</Text>
            <Text style={s.fieldValue}>
              {remaining} of {preview.maxUses}
            </Text>
          </View>
        ) : null}

        {blocked ? (
          <View style={[s.statusBlock, blocked.tone === 'bad' ? s.statusBad : s.statusWarn]}>
            <Ionicons
              name="warning"
              size={14}
              color={blocked.tone === 'bad' ? '#C0392B' : '#C99632'}
            />
            <Text
              style={[
                s.statusText,
                { color: blocked.tone === 'bad' ? '#C0392B' : '#C99632' },
              ]}
            >
              {blocked.label}
            </Text>
          </View>
        ) : null}

        {redeemError ? (
          <View style={[s.statusBlock, s.statusBad]}>
            <Ionicons name="warning" size={14} color="#C0392B" />
            <Text style={[s.statusText, { color: '#C0392B' }]}>{redeemError}</Text>
          </View>
        ) : null}

        {blocked == null ? (
          signedIn ? (
            <Pressable
              style={[s.btnPrimary, redeem.isPending && { opacity: 0.6 }]}
              disabled={redeem.isPending}
              onPress={handleRedeem}
            >
              <Text style={s.btnPrimaryText}>
                {redeem.isPending ? 'Joining…' : `Join ${preview.orgShortName ?? 'org'} as ${roleLabel}`}
              </Text>
            </Pressable>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={s.copy}>Sign in to BetterAt to accept this invite.</Text>
              <Pressable style={s.btnPrimary} onPress={goToLogin}>
                <Text style={s.btnPrimaryText}>Sign in to accept</Text>
              </Pressable>
            </View>
          )
        ) : (
          <Pressable style={s.btnGhost} onPress={() => router.replace('/')}>
            <Text style={s.btnGhostText}>Back to BetterAt</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bodyInner: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: '#F5F4EE',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F5F4EE',
    gap: 14,
  },
  loadingText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.7)' },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  copy: {
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(60, 60, 67, 0.85)',
    textAlign: 'center',
  },
  bold: { fontWeight: '700', color: '#1C1C1E' },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  orgBadge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: { height: 0.5, backgroundColor: 'rgba(0,0,0,0.08)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.55)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldValue: { fontSize: 13.5, color: '#1C1C1E', fontWeight: '500' },
  statusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  statusBad: { backgroundColor: 'rgba(192, 57, 43, 0.10)' },
  statusWarn: { backgroundColor: 'rgba(201, 150, 50, 0.12)' },
  statusText: { flex: 1, fontSize: 12.5, fontWeight: '500' },
  btnPrimary: {
    backgroundColor: '#28406B',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  btnGhost: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    marginTop: 4,
  },
  btnGhostText: { color: '#28406B', fontSize: 14, fontWeight: '600' },
  icoOk: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(30, 143, 71, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icoBad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(192, 57, 43, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
