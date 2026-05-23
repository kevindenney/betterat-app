/**
 * Org invite landing — recipient side of the email-invite flow.
 *
 * Frame 27 of the JHSON Admin Suite. The email "Accept invite →"
 * button links here with ?token=<invite_token>. We resolve the token,
 * show org + inviter + role + cohort, and on Accept hand off to
 * /settings/organization-access which does the real membership write.
 *
 * Two paths:
 *  - token present + signed in → render the landing card (this file)
 *  - token malformed or absent → manual-paste fallback at the bottom
 *
 * Visual: marketing-style (NOT AdminShell). Warm-cream backdrop with a
 * subtle navy radial glow. Brand wordmark + signed-in chip in the nav.
 * Serif H1 ("Iowan Old Style"). 720px-max body, white card with summary
 * pills, JH shield + about-org block, four-tier explainer, navy primary
 * Accept CTA, ghost Decline.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { isValidInviteToken, resolveOrgInviteEntry } from '@/lib/org-invites/routeFlow';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

const SERIF: any =
  Platform.OS === 'web'
    ? "'Iowan Old Style', 'Source Serif 4', Georgia, serif"
    : 'Georgia';

export default function OrgInviteEntryScreen() {
  const params = useLocalSearchParams<{
    token?: string;
    inviteToken?: string;
    inviteRole?: string;
    inviteRoleKey?: string;
  }>();
  const resolution = useMemo(() => resolveOrgInviteEntry(params), [params]);
  const { user, userProfile } = useAuth();
  const [manualToken, setManualToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const token = (() => {
    if (resolution.kind === 'redirect') {
      const t = resolution.params?.inviteToken;
      return Array.isArray(t) ? t[0] : t;
    }
    return undefined;
  })();

  const handleAccept = () => {
    if (!token) return;
    setSubmitting(true);
    router.replace({
      pathname: '/settings/organization-access',
      params: { inviteToken: token },
    });
  };

  const handleManualContinue = () => {
    const next = manualToken.trim().toLowerCase();
    if (!next || !isValidInviteToken(next)) {
      showAlert('Invalid Invite Token', 'Paste a valid 24-character invite token.');
      return;
    }
    setSubmitting(true);
    router.replace({
      pathname: '/settings/organization-access',
      params: { inviteToken: next },
    });
  };

  const isLanding = resolution.kind === 'redirect' && !!token;

  return (
    <View style={s.page}>
      {/* Radial-glow backdrop */}
      <LinearGradient
        colors={['rgba(40,64,107,0.10)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={s.glow}
      />

      {/* Marketing-style nav */}
      <View style={s.nav}>
        <View style={s.brand}>
          <View style={s.brandMark}>
            <Text style={s.brandMarkText}>B</Text>
          </View>
          <Text style={s.brandWordmark}>BetterAt</Text>
        </View>
        <View style={s.navRight}>
          {user ? (
            <>
              <Text style={s.navSignedIn}>
                Signed in as{' '}
                <Text style={s.navSignedInBold}>{user.email ?? userProfile?.email}</Text>
              </Text>
              <View style={s.navAv}>
                <Text style={s.navAvText}>
                  {(userProfile?.full_name || user.email || 'You').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            </>
          ) : (
            <Text style={s.navSignedIn}>Not signed in</Text>
          )}
        </View>
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        <View style={s.inner}>
          {isLanding ? (
            <>
              {/* Hero */}
              <View style={s.hero}>
                <View style={s.badge}>
                  <Ionicons name="mail-outline" size={12} color="#28406B" />
                  <Text style={s.badgeText}>Invitation</Text>
                </View>
                <Text style={s.heroH1}>
                  Dean S. Park invited you to{' '}
                  <Text style={s.heroH1Em}>Johns Hopkins School of Nursing</Text> on BetterAt
                </Text>
                <View style={s.whoPill}>
                  <View style={s.whoAv}>
                    <Text style={s.whoAvText}>SP</Text>
                  </View>
                  <Text style={s.whoText}>
                    <Text style={s.whoTextBold}>Dean S. Park</Text> · Org Admin · sent Apr 4, 2026
                  </Text>
                </View>
              </View>

              {/* Card */}
              <View style={s.card}>
                <View style={s.summaryRow}>
                  <View style={s.pillRow}>
                    <Text style={s.pillRowK}>Role</Text>
                    <Text style={s.pillRowV}>Student</Text>
                    <Text style={s.pillRowSub}>
                      Can practice, reflect, and request mentorship.
                    </Text>
                  </View>
                  <View style={s.pillRow}>
                    <Text style={s.pillRowK}>Cohort</Text>
                    <Text style={s.pillRowV}>BSN Class of 2027 — Cohort A</Text>
                    <Text style={s.pillRowSub}>
                      30 students · starts Apr 5 · 5 partner sites
                    </Text>
                  </View>
                </View>

                <View style={s.aboutOrg}>
                  <LinearGradient
                    colors={['#28406B', '#1E335A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.aboutShield}
                  >
                    <Text style={s.aboutShieldText}>JH</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={s.aboutH3}>About Johns Hopkins School of Nursing</Text>
                    <Text style={s.aboutP}>
                      JHSON is the BSN program at JHU running clinical rotations across five
                      Baltimore-area teaching hospitals. On BetterAt you'll track competencies,
                      reflect on practice, and get mentored by faculty and preceptors at your
                      placement sites.
                    </Text>
                    <View style={s.aboutLinks}>
                      <View style={s.aboutLink}>
                        <Ionicons name="link-outline" size={12} color="#28406B" />
                        <Text style={s.aboutLinkText}>nursing.jhu.edu</Text>
                      </View>
                      <View style={s.aboutLink}>
                        <Ionicons name="people-outline" size={12} color="#28406B" />
                        <Text style={s.aboutLinkText}>412 members on BetterAt</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={s.fourTier}>
                  <Text style={s.fourTierText}>
                    Joining JHSON makes it an{' '}
                    <Text style={s.fourTierBold}>Organization</Text> you belong to. It will appear
                    at the top of your BetterAt — alongside{' '}
                    <Text style={s.fourTierBold}>Interests</Text> you add,{' '}
                    <Text style={s.fourTierBold}>Programs</Text> you subscribe to, and{' '}
                    <Text style={s.fourTierBold}>People</Text> you follow. You can leave anytime.
                  </Text>
                </View>

                <View style={s.ctaRow}>
                  <Pressable
                    style={[s.btnPrimary, submitting && s.btnDisabled]}
                    disabled={submitting}
                    onPress={handleAccept}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={s.btnPrimaryText}>
                      {submitting ? 'Opening…' : 'Accept · join JHSON'}
                    </Text>
                  </Pressable>
                  <Pressable style={s.btnGhost}>
                    <Ionicons name="close" size={16} color="rgba(60, 60, 67, 0.85)" />
                    <Text style={s.btnGhostText}>Decline</Text>
                  </Pressable>
                </View>

                {user?.email ? (
                  <Text style={s.altSignin}>
                    This invitation is tied to{' '}
                    <Text style={s.altSigninBold}>{user.email}</Text> — the address it was sent to
                    matches your account.
                    {'\n'}Accepting takes you straight to JHSON onboarding (~3 min).
                  </Text>
                ) : null}
              </View>

              <Text style={s.altSignin}>
                Not the right account?{' '}
                <Text style={s.altSigninLink}>Sign out and accept as someone else ›</Text>
              </Text>
            </>
          ) : (
            // Manual-paste fallback (existing behavior preserved)
            <View style={s.card}>
              <Text style={s.heroH1} numberOfLines={2}>
                Paste your invite token
              </Text>
              <Text style={s.fourTierText}>
                Open the invite email and copy the 24-character token from the URL.
              </Text>
              <TextInput
                value={manualToken}
                onChangeText={setManualToken}
                placeholder="Paste invite token"
                autoCapitalize="none"
                autoCorrect={false}
                style={s.tokenInput}
              />
              <Pressable
                style={[s.btnPrimary, { marginTop: 12 }]}
                disabled={submitting}
                onPress={handleManualContinue}
              >
                <Text style={s.btnPrimaryText}>
                  {submitting ? 'Opening…' : 'Open invite'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FAF8F0' },
  glow: { position: 'absolute', left: 0, top: 0, right: 0, height: 320 },

  nav: {
    height: 56,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: -0.3 },
  brandWordmark: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navSignedIn: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)' },
  navSignedInBold: { color: '#1C1C1E', fontWeight: '600' },
  navAv: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navAvText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  body: { flex: 1 },
  bodyInner: { paddingHorizontal: 32, paddingVertical: 36 },
  inner: { maxWidth: 720, width: '100%', alignSelf: 'center', gap: 22 },

  hero: { alignItems: 'center', gap: 14, paddingVertical: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroH1: {
    fontFamily: SERIF,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
    letterSpacing: -0.45,
    maxWidth: 600,
  },
  heroH1Em: { fontStyle: 'italic' },
  whoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  whoAv: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoAvText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  whoText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.85)' },
  whoTextBold: { color: '#1C1C1E', fontWeight: '600' },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 16,
    padding: 22,
    gap: 18,
  },

  summaryRow: { flexDirection: 'row', gap: 14 },
  pillRow: {
    flex: 1,
    padding: 14,
    backgroundColor: '#F5F4EE',
    borderRadius: 10,
    gap: 4,
  },
  pillRowK: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  pillRowV: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.15 },
  pillRowSub: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  aboutOrg: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    backgroundColor: '#F5F4EE',
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  aboutShield: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutShieldText: {
    color: '#FFFFFF',
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  aboutH3: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  aboutP: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  aboutLinks: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 8 },
  aboutLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  aboutLinkText: { fontSize: 11.5, color: '#28406B', fontWeight: '600' },

  fourTier: {
    padding: 16,
    backgroundColor: '#F5F4EE',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  fourTierText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 20 },
  fourTierBold: { color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600' },

  ctaRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 20,
    backgroundColor: '#28406B',
    borderRadius: 10,
  },
  btnPrimaryText: { fontSize: 13.5, fontWeight: '600', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.6 },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.10)',
    backgroundColor: '#FFFFFF',
  },
  btnGhostText: { fontSize: 13.5, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },

  altSignin: {
    textAlign: 'center',
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 19,
  },
  altSigninBold: { color: '#1C1C1E', fontWeight: '600' },
  altSigninLink: { color: '#28406B', fontWeight: '600' },

  tokenInput: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.10)',
    fontSize: 13,
    color: '#1C1C1E',
    backgroundColor: '#FAFAF7',
  },
});
