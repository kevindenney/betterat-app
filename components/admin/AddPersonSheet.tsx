/**
 * Add Person sheet — Frame 8 of the institutions pass.
 *
 * Modal overlay launched from the Org Admin · People dashboard's "Add person"
 * button. 720px wide, centered, dimmed scrim behind. Form lets an admin:
 *   - Pick the invite method (Email · Bulk CSV · From SSO · Invite link)
 *   - Enter multiple email addresses as tagify-style chips, with domain
 *     validation against the org's verified domains
 *   - Pick a role (Student / Blueprint author / Mentor / Admin)
 *   - Pick a cohort + leave clinical placement set-per-student
 *   - Toggle "Auto-subscribe to cohort blueprints"
 *
 * Submit is currently a stub — wiring lands when invites schema is decided.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { StudioButton } from '@/components/studio/StudioShell';

type InviteMethod = 'email' | 'csv' | 'sso' | 'link';
type PersonRole = 'student' | 'author' | 'mentor' | 'admin';

interface EmailChip {
  email: string;
  isValid: boolean;        // domain is on the org's verified list
}

export interface AddPersonSheetProps {
  visible: boolean;
  orgId: string;
  invitedByUserId: string | null;
  orgName: string;
  orgShortName: string;
  seatsAvailable: number;
  seatsTotal: number;
  verifiedDomains: string[];   // ["jh.edu", "jhmi.edu"]
  defaultBlueprints: string[]; // ["Adult Health I · M4", "MSN second-year onboarding"]
  defaultCohortLabel: string;  // "Spring '26 · MSN second-year"
  onClose: () => void;
  onSubmit?: (data: {
    emails: EmailChip[];
    role: PersonRole;
    cohort: string;
    autoSubscribe: boolean;
  }) => void;
}

const ROLE_LABEL: Record<PersonRole, string> = {
  student: 'Student',
  author: 'Blueprint author',
  mentor: 'Mentor',
  admin: 'Admin',
};

const ROLE_KEY: Record<PersonRole, string> = {
  student: 'member',
  author: 'faculty',
  mentor: 'preceptor',
  admin: 'admin',
};

export function AddPersonSheet({
  visible,
  orgId,
  invitedByUserId,
  orgName,
  orgShortName,
  seatsAvailable,
  seatsTotal,
  verifiedDomains,
  defaultBlueprints,
  defaultCohortLabel,
  onClose,
  onSubmit,
}: AddPersonSheetProps) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<InviteMethod>('email');
  const [emailDraft, setEmailDraft] = useState('');
  const [emails, setEmails] = useState<EmailChip[]>([]);
  const [role, setRole] = useState<PersonRole>('student');
  const [cohort] = useState(defaultCohortLabel);
  const [autoSubscribe, setAutoSubscribe] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!invitedByUserId) throw new Error('Not signed in');
      if (emails.length === 0) throw new Error('Add at least one email address');
      const payload = emails.map((chip) => ({
        organization_id: orgId,
        invitee_email: chip.email,
        role_label: ROLE_LABEL[role],
        role_key: ROLE_KEY[role],
        invited_by: invitedByUserId,
        channel: 'email',
        status: 'sent' as const,
        metadata: {
          auto_subscribe: autoSubscribe,
          cohort_label: cohort,
          verified_domain: chip.isValid,
        },
      }));
      const { data: inserted, error } = await supabase
        .from('organization_invites')
        .insert(payload)
        .select('id');
      if (error) throw error;

      // Dispatch the branded invite email via the edge function. We don't
      // throw on dispatch failure — the row already exists, so the admin
      // can resend later. Partial-failure detail surfaces in submitError.
      const inviteIds = (inserted ?? []).map((r) => r.id);
      if (inviteIds.length > 0) {
        const { data: dispatch, error: invokeErr } = await supabase.functions.invoke(
          'send-org-invite',
          { body: { invite_ids: inviteIds } },
        );
        if (invokeErr) {
          throw new Error(`Invite saved but email dispatch failed: ${invokeErr.message}`);
        }
        const failed = (dispatch?.results ?? []).filter(
          (r: { ok: boolean }) => !r.ok,
        ) as { email: string | null; error?: string }[];
        if (failed.length > 0) {
          const summary = failed
            .map((f) => `${f.email ?? 'unknown'}${f.error ? `: ${f.error}` : ''}`)
            .join('; ');
          throw new Error(`Invite saved but email failed for: ${summary}`);
        }
      }

      // Audit: one event for the whole batch (preserves "invited N people" framing)
      const countLabel = `${emails.length} ${emails.length === 1 ? 'person' : 'people'}`;
      const cohortLabel = cohort?.trim() ? ` to ${cohort.trim()}` : '';
      await supabase.rpc('audit_log_event', {
        p_org_id: orgId,
        p_verb: 'invited',
        p_verb_label: 'Invited',
        p_description: `Invited ${countLabel}${cohortLabel} as ${ROLE_LABEL[role]}.`,
        p_target_type: 'invite',
        p_target_id: null,
        p_target_label: countLabel,
        p_payload: {
          action: 'invite.bulk_send',
          count: emails.length,
          method: emails.length > 1 ? 'manual_batch' : 'manual_single',
          role_key: ROLE_KEY[role],
          cohort_label: cohort,
          auto_subscribe: autoSubscribe,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-people', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-feed', orgId] });
      onSubmit?.({ emails, role, cohort, autoSubscribe });
      setEmails([]);
      setSubmitError(null);
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to send invites';
      setSubmitError(msg);
    },
  });

  const seatNote = `${seatsAvailable} of ${seatsTotal} seats available · adds count against your plan`;

  const sendSummary = useMemo(() => {
    const total = emails.length;
    const ssoCount = emails.filter((e) => e.isValid).length;
    const reviewCount = total - ssoCount;
    return {
      total,
      ssoCount,
      reviewCount,
    };
  }, [emails]);

  function isValidEmail(addr: string): boolean {
    return /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(addr.trim());
  }

  function commitDraft() {
    const tokens = emailDraft
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    const validTokens = tokens.filter(isValidEmail).map((token) => {
      const domain = token.split('@')[1]?.toLowerCase() ?? '';
      return { email: token, isValid: verifiedDomains.includes(domain) };
    });
    if (validTokens.length > 0) {
      setEmails((prev) => [...prev, ...validTokens]);
    }
    setEmailDraft('');
  }

  function removeChip(idx: number) {
    setEmails((prev) => prev.filter((_, i) => i !== idx));
  }

  if (!visible) return null;

  return (
    <View style={s.scrim} pointerEvents="auto">
      <Pressable style={s.scrimPress} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.head}>
          <View style={s.headText}>
            <Text style={s.title}>Add people to {orgName}</Text>
            <Text style={s.note}>{seatNote}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
          </Pressable>
        </View>

        <View style={s.methodRow}>
          {(
            [
              { key: 'email', label: 'Invite by email' },
              { key: 'csv', label: 'Bulk · CSV' },
              { key: 'sso', label: 'From SSO directory' },
              { key: 'link', label: 'Share invite link' },
            ] as { key: InviteMethod; label: string }[]
          ).map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMethod(m.key)}
              style={[s.methodBtn, method === m.key && s.methodBtnOn]}
            >
              <Text style={[s.methodText, method === m.key && s.methodTextOn]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
          {method === 'email' ? (
            <>
              <Field label="Email addresses">
                <View style={s.chipInputWrap}>
                  {emails.map((chip, i) => (
                    <View
                      key={`${chip.email}-${i}`}
                      style={[s.chip, !chip.isValid && s.chipInvalid]}
                    >
                      <View style={[s.chipAt, !chip.isValid && s.chipAtInvalid]}>
                        <Text style={s.chipAtText}>@</Text>
                      </View>
                      <Text style={[s.chipText, !chip.isValid && s.chipTextInvalid]}>
                        {chip.email}
                      </Text>
                      {!chip.isValid ? (
                        <View style={s.chipWarnRow}>
                          <Ionicons name="warning" size={11} color="#C99632" />
                          <Text style={s.chipWarnText}>not @{verifiedDomains[0]}</Text>
                        </View>
                      ) : null}
                      <Pressable onPress={() => removeChip(i)} hitSlop={4}>
                        <Ionicons
                          name="close"
                          size={11}
                          color={chip.isValid ? '#007AFF' : '#C99632'}
                        />
                      </Pressable>
                    </View>
                  ))}
                  <TextInput
                    value={emailDraft}
                    onChangeText={setEmailDraft}
                    onBlur={commitDraft}
                    onSubmitEditing={commitDraft}
                    placeholder="Type or paste more, comma-separated…"
                    placeholderTextColor="rgba(60, 60, 67, 0.4)"
                    style={s.chipInput}
                  />
                </View>
                <Text style={s.helper}>
                  Only emails on your verified domains (
                  {verifiedDomains.map((d, i) => (
                    <React.Fragment key={d}>
                      <Text style={s.helperStrong}>@{d}</Text>
                      {i < verifiedDomains.length - 1 ? <Text>, </Text> : null}
                    </React.Fragment>
                  ))}
                  ) will auto-redeem via SSO. Others get a regular invite email.
                </Text>
              </Field>

              <Field label="Role">
                <View style={s.roleGrid}>
                  {(
                    [
                      {
                        key: 'student',
                        title: 'Student',
                        body: 'Can practice, subscribe to your blueprints, and join cohorts.',
                      },
                      {
                        key: 'author',
                        title: 'Blueprint author',
                        body: `Studio access. Can write blueprints under ${orgShortName}.`,
                      },
                      {
                        key: 'mentor',
                        title: 'Mentor',
                        body: 'Sees student timelines · can comment, no editor.',
                      },
                      {
                        key: 'admin',
                        title: 'Admin',
                        body: 'Manages people, billing, SSO. Top-level.',
                      },
                    ] as { key: PersonRole; title: string; body: string }[]
                  ).map((r) => (
                    <Pressable
                      key={r.key}
                      onPress={() => setRole(r.key)}
                      style={[s.roleCard, role === r.key && s.roleCardOn]}
                    >
                      <View style={s.roleHead}>
                        {role === r.key ? (
                          <Ionicons name="checkmark-circle" size={14} color="#007AFF" />
                        ) : null}
                        <Text
                          style={[s.roleTitle, role === r.key && s.roleTitleOn]}
                        >
                          {r.title}
                        </Text>
                      </View>
                      <Text style={s.roleBody}>{r.body}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>

              <View style={s.twoColRow}>
                <Field label="Cohort" flex={1}>
                  <Pressable style={s.selectInput}>
                    <Text style={s.selectText}>{cohort}</Text>
                    <Ionicons name="chevron-down" size={14} color="rgba(60, 60, 67, 0.4)" />
                  </Pressable>
                </Field>
                <Field label="Clinical placement" flex={1}>
                  <Pressable style={[s.selectInput, s.selectInputMuted]}>
                    <Text style={s.selectTextMuted}>Set per-student after invite</Text>
                  </Pressable>
                </Field>
              </View>

              <Pressable
                style={s.autoSub}
                onPress={() => setAutoSubscribe((v) => !v)}
              >
                <View
                  style={[
                    s.toggle,
                    autoSubscribe ? s.toggleOn : s.toggleOff,
                  ]}
                >
                  <View
                    style={[
                      s.toggleKnob,
                      autoSubscribe ? s.toggleKnobOn : s.toggleKnobOff,
                    ]}
                  />
                </View>
                <View style={s.autoSubText}>
                  <Text style={s.autoSubTitle}>Auto-subscribe to cohort blueprints</Text>
                  <Text style={s.autoSubBody}>
                    On redemption, each invitee will be subscribed to{' '}
                    {defaultBlueprints.map((b, i) => (
                      <React.Fragment key={b}>
                        <Text style={s.autoSubStrong}>{b}</Text>
                        {i < defaultBlueprints.length - 1 ? <Text> and </Text> : null}
                      </React.Fragment>
                    ))}{' '}
                    — the cohort's default blueprints.
                  </Text>
                </View>
              </Pressable>
            </>
          ) : (
            <View style={s.methodStub}>
              <Ionicons name="construct-outline" size={28} color="rgba(40, 64, 107, 0.5)" />
              <Text style={s.methodStubTitle}>
                {method === 'csv'
                  ? 'Bulk CSV upload coming next'
                  : method === 'sso'
                  ? 'SSO directory picker coming next'
                  : 'Shareable invite link coming next'}
              </Text>
              <Text style={s.methodStubBody}>
                Use "Invite by email" today — it handles single or paste-batch invites
                with the same role/cohort settings.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          <Text style={s.footerSummary}>
            {sendSummary.total} {sendSummary.total === 1 ? 'invite' : 'invites'} will be sent ·{' '}
            <Text style={s.footerSummaryStrong}>
              {sendSummary.ssoCount} will redeem via SSO automatically
            </Text>
            {sendSummary.reviewCount > 0
              ? ` · ${sendSummary.reviewCount} needs admin review (wrong domain)`
              : ''}
          </Text>
          <View style={s.footerActions}>
            {submitError ? (
              <Text style={s.submitError} numberOfLines={2}>
                {submitError}
              </Text>
            ) : null}
            <StudioButton variant="ghost" label="Cancel" onPress={onClose} />
            <StudioButton
              variant="primary"
              accent="navy"
              icon="send"
              label={sendMutation.isPending ? 'Sending…' : 'Send invites'}
              onPress={() => sendMutation.mutate()}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  children,
  flex,
}: {
  label: string;
  children: React.ReactNode;
  flex?: number;
}) {
  return (
    <View style={[s.field, flex !== undefined && { flex }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  scrimPress: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  sheet: {
    width: 720,
    maxHeight: 740,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...({
      boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)',
    } as any),
  },
  head: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  note: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },

  methodRow: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    flexWrap: 'wrap',
  },
  methodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
  },
  methodBtnOn: { backgroundColor: '#28406B' },
  methodText: { fontSize: 12.5, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },
  methodTextOn: { color: '#FFFFFF', fontWeight: '600' },

  body: { flex: 1 },
  bodyInner: { paddingHorizontal: 22, paddingVertical: 18, gap: 18 },

  field: { gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  chipInputWrap: {
    padding: 8,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 9,
    minHeight: 50,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    borderRadius: 6,
  },
  chipInvalid: { backgroundColor: 'rgba(201, 150, 50, 0.14)' },
  chipAt: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAtInvalid: { backgroundColor: '#C99632' },
  chipAtText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '700' },
  chipText: { fontSize: 12, color: '#007AFF' },
  chipTextInvalid: { color: '#C99632' },
  chipWarnRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chipWarnText: { fontSize: 10, color: '#C99632' },
  chipInput: {
    flex: 1,
    minWidth: 200,
    fontSize: 13,
    color: '#1C1C1E',
    paddingHorizontal: 6,
    paddingVertical: 4,
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  helper: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16 },
  helperStrong: { color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600' },

  roleGrid: { flexDirection: 'row', gap: 8 },
  roleCard: {
    flex: 1,
    padding: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    backgroundColor: '#FFFFFF',
  },
  roleCardOn: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
  },
  roleHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  roleTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  roleTitleOn: { color: '#007AFF' },
  roleBody: { fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 14 },

  twoColRow: { flexDirection: 'row', gap: 14 },
  selectInput: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectInputMuted: {},
  selectText: { fontSize: 13, color: '#1C1C1E' },
  selectTextMuted: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
    fontStyle: 'italic',
  },

  autoSub: {
    padding: 14,
    backgroundColor: '#EFEFF4',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  toggle: {
    width: 36,
    height: 22,
    borderRadius: 12,
    padding: 2,
    marginTop: 2,
  },
  toggleOn: { backgroundColor: '#34C759' },
  toggleOff: { backgroundColor: '#D1D1D6' },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    ...({
      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    } as any),
  },
  toggleKnobOn: { marginLeft: 14 },
  toggleKnobOff: { marginLeft: 0 },
  autoSubText: { flex: 1, minWidth: 0 },
  autoSubTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  autoSubBody: {
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 16,
    marginTop: 3,
  },
  autoSubStrong: { color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600' },

  methodStub: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  methodStubTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', marginTop: 4 },
  methodStubBody: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 400,
  },

  footer: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerSummary: { flex: 1, fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16 },
  footerSummaryStrong: { color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600' },
  footerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  submitError: {
    fontSize: 11.5,
    color: '#FF3B30',
    fontWeight: '500',
    maxWidth: 280,
    marginRight: 8,
  },
});
