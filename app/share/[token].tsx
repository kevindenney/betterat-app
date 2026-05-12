/**
 * Public Share Page — /share/<token>
 *
 * Resolves a unified `share_tokens` row via the `resolve_share_token` RPC
 * (SECURITY DEFINER, anon-callable) and renders a redacted view of the
 * underlying step or blueprint. Coaches/parents/etc. can preview the content
 * without an account and convert via the "Sign up to engage" CTA.
 *
 * For blueprint shares the CTA appends `?blueprint=<slug-or-id>` so the
 * post-auth flow in `commitSignupContext` auto-subscribes them (onboarding §4
 * Step 3).
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import {
  resolveShareToken,
  type ResolvedShare,
  type ResolvedStepShare,
  type ResolvedBlueprintShare,
  type ShareResolveError,
} from '@/services/ShareTokenService';

// ---------------------------------------------------------------------------
// Design tokens (mirrors /p/step/[token].tsx for visual consistency)
// ---------------------------------------------------------------------------

const C = {
  bg: '#F5F4F1',
  cardBg: '#FFFFFF',
  cardBorder: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  accent: '#3D8A5A',
  accentBg: 'rgba(61,138,90,0.08)',
  gold: '#D4A64A',
  dotInactive: '#EDECEA',
  badgeBg: '#EDECEA',
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PublicSharePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ok'; payload: ResolvedShare } | { kind: 'err'; error: ShareResolveError }
  >({ kind: 'loading' });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await resolveShareToken(token);
      if (cancelled) return;
      if (res.ok) setState({ kind: 'ok', payload: res.payload });
      else setState({ kind: 'err', error: res.error });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (state.kind === 'err') {
    return <ErrorView error={state.error} />;
  }

  if (state.payload.target_type === 'step') {
    return <StepShareView payload={state.payload} token={token!} />;
  }
  return <BlueprintShareView payload={state.payload} token={token!} />;
}

// ---------------------------------------------------------------------------
// Step variant
// ---------------------------------------------------------------------------

function StepShareView({ payload, token }: { payload: ResolvedStepShare; token: string }) {
  const { step, author } = payload;
  const meta = (step.metadata ?? {}) as Record<string, any>;
  const plan = (meta.plan ?? {}) as Record<string, any>;
  const act = (meta.act ?? {}) as Record<string, any>;
  const review = (meta.review ?? {}) as Record<string, any>;

  const what = typeof plan.what_will_you_do === 'string' ? plan.what_will_you_do : null;
  const why = typeof plan.why_reasoning === 'string' ? plan.why_reasoning : null;
  const notes = typeof act.notes === 'string' ? act.notes : null;
  const learned = typeof review.what_learned === 'string' ? review.what_learned : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
      <Header authorName={author?.full_name ?? null} kindLabel="Practice step" />

      <Text style={styles.title}>{step.title}</Text>
      <StatusBadge status={step.status} />

      {step.description && (
        <View style={styles.section}>
          <Text style={styles.fieldValue}>{step.description}</Text>
        </View>
      )}

      {what && <FieldBlock label="WHAT" value={what} />}
      {why && <FieldBlock label="WHY" value={why} />}
      {notes && <FieldBlock label="NOTES" value={notes} />}
      {learned && <FieldBlock label="WHAT I LEARNED" value={learned} />}

      <ConvertCta token={token} />
      <Footer />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Blueprint variant
// ---------------------------------------------------------------------------

function BlueprintShareView({ payload, token }: { payload: ResolvedBlueprintShare; token: string }) {
  const { blueprint, author, step_count } = payload;
  const ref = blueprint.slug || blueprint.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
      <Header authorName={author?.full_name ?? null} kindLabel="Practice path" />

      <Text style={styles.title}>{blueprint.title}</Text>

      <View style={styles.statRow}>
        <Stat icon="list-outline" label={`${step_count} step${step_count === 1 ? '' : 's'}`} />
        {blueprint.subscriber_count != null && (
          <Stat
            icon="people-outline"
            label={`${blueprint.subscriber_count} subscriber${blueprint.subscriber_count === 1 ? '' : 's'}`}
          />
        )}
      </View>

      {blueprint.description && (
        <View style={styles.section}>
          <Text style={styles.fieldValue}>{blueprint.description}</Text>
        </View>
      )}

      <ConvertCta token={token} blueprintRef={ref} blueprintTitle={blueprint.title} />
      <Footer />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header({ authorName, kindLabel }: { authorName: string | null; kindLabel: string }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.kindBadge}>
        <Text style={styles.kindBadgeText}>{kindLabel}</Text>
      </View>
      {authorName && (
        <View style={styles.creatorBadge}>
          <Ionicons name="person-outline" size={14} color={C.accent} />
          <Text style={styles.creatorName}>{authorName}</Text>
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'completed' ? C.accent : status === 'in_progress' ? C.gold : C.labelMid;
  const label =
    status === 'completed'
      ? 'Completed'
      : status === 'in_progress'
        ? 'In progress'
        : status === 'skipped'
          ? 'Skipped'
          : 'Planned';
  return (
    <View style={[styles.statusBadge, { backgroundColor: `${color}15` }]}>
      <Ionicons
        name={status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={color}
      />
      <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={C.labelMid} />
      <Text style={styles.statText}>{label}</Text>
    </View>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function ConvertCta({
  token,
  blueprintRef,
  blueprintTitle,
}: {
  token: string;
  blueprintRef?: string;
  blueprintTitle?: string;
}) {
  const onPress = () => {
    const params = new URLSearchParams();
    params.set('returnTo', `/share/${token}`);
    if (blueprintRef) {
      params.set('blueprint', blueprintRef);
      if (blueprintTitle) params.set('blueprintName', blueprintTitle);
    }
    router.push(`/(auth)/signup?${params.toString()}` as any);
  };

  return (
    <TouchableOpacity style={styles.ctaButton} onPress={onPress}>
      <Text style={styles.ctaText}>
        {blueprintRef ? 'Sign up to subscribe' : 'Sign up to engage'}
      </Text>
      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerPowered}>Powered by BetterAt</Text>
    </View>
  );
}

function ErrorView({ error }: { error: ShareResolveError }) {
  const title =
    error === 'expired'
      ? 'Link expired'
      : error === 'revoked'
        ? 'Link revoked'
        : error === 'rate_limited'
          ? 'Try again in a moment'
          : error === 'target_missing'
            ? 'No longer available'
            : 'Link not found';
  const body =
    error === 'expired'
      ? 'This share link is past its expiration date.'
      : error === 'revoked'
        ? 'The owner has revoked this share link.'
        : error === 'rate_limited'
          ? 'This link has been opened a lot recently. Please try again in a minute.'
          : error === 'target_missing'
            ? 'The content this link pointed to has been removed.'
            : 'We could not find this share link. It may be mistyped.';
  return (
    <View style={styles.center}>
      <Ionicons name="link-outline" size={64} color={C.dotInactive} />
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorText}>{body}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  contentPadding: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: C.bg,
  },
  loadingText: { marginTop: 12, fontSize: 16, color: C.labelMid },
  errorTitle: { fontSize: 20, fontWeight: '600', color: C.labelDark, marginTop: 16 },
  errorText: { fontSize: 14, color: C.labelMid, textAlign: 'center', marginTop: 8, maxWidth: 320 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  kindBadge: {
    backgroundColor: C.badgeBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kindBadgeText: { fontSize: 12, fontWeight: '600', color: C.labelMid, letterSpacing: 0.4 },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  creatorName: { fontSize: 13, fontWeight: '500', color: C.accent },

  title: { fontSize: 24, fontWeight: '700', color: C.labelDark, marginBottom: 12 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },

  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: C.labelMid },

  section: {
    backgroundColor: C.cardBg,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.labelLight,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldValue: { fontSize: 14, color: C.labelDark, lineHeight: 21 },

  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  footer: { padding: 24, alignItems: 'center' },
  footerPowered: { fontSize: 12, color: C.labelLight },
});
