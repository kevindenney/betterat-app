/**
 * betterat.com/schools — marketing landing for institutional buyers (Frame 9).
 *
 * Hero with eyebrow + serif headline + sub + two CTAs + device-cluster
 * mockup on the right. Logo strip, three-up "How it works", CTA strip
 * to pricing.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MktNav } from '@/components/marketing/MktNav';

export default function SchoolsLanding() {
  const router = useRouter();
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <MktNav active="schools" />

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroCopy}>
            <Text style={s.eyebrow}>
              For nursing schools, medical residencies & professional programs
            </Text>
            <Text style={s.heroTitle}>
              Help every student in your program build a{' '}
              <Text style={s.heroTitleEm}>deliberate practice habit</Text> that lasts
              the whole career.
            </Text>
            <Text style={s.heroSub}>
              BetterAt for Schools gives your faculty a place to write blueprints,
              your students a place to practice and reflect, and you a place to see
              how the whole program is doing — without standing up another LMS.
            </Text>
            <View style={s.heroCtaRow}>
              <Pressable
                style={s.primaryBtn}
                onPress={() => router.push('/schools/start-pilot')}
              >
                <Text style={s.primaryBtnText}>Start a 30-day pilot</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/schools/pricing')}>
                <Text style={s.secondaryLink}>Talk to our team →</Text>
              </Pressable>
            </View>
            <Text style={s.heroFinePrint}>
              No card on file · cancel any time during the pilot · SSO + SAML on
              every plan
            </Text>
          </View>

          <View style={s.heroVisual}>
            <DashboardMock />
            <PhoneMock />
          </View>
        </View>

        {/* Logo strip */}
        <View style={s.logoStrip}>
          <Text style={s.logoStripLabel}>In use at</Text>
          <View style={s.logoStripRow}>
            <Text style={s.logoStripItem}>Johns Hopkins · MSN</Text>
            <Text style={s.logoStripItem}>UCSF Nursing</Text>
            <Text style={s.logoStripItem}>King's College London</Text>
            <Text style={s.logoStripItem}>RHKYC · Sailing Academy</Text>
            <Text style={s.logoStripItem}>UPenn Vet</Text>
          </View>
        </View>

        {/* Three-up: One platform · three lenses */}
        <View style={s.threeUp}>
          <Text style={s.sectionH2}>One platform · three lenses · same data</Text>
          <View style={s.threeUpRow}>
            <ThreeUpItem
              icon="flag"
              iconBg="rgba(0, 122, 255, 0.10)"
              iconColor="#007AFF"
              title="Students practice on their phone"
              body="Pre-shift planning, in-the-moment capture, post-shift reflection — all framed inside the blueprint their faculty wrote. Real practice, not coursework."
            />
            <ThreeUpItem
              icon="create-outline"
              iconBg="rgba(107, 91, 191, 0.12)"
              iconColor="#6B5BBF"
              title="Faculty write blueprints on iPad"
              body="Steps, capabilities, cohort settings, mentor inbox — written once, versioned, used by every cohort that comes through your program."
            />
            <ThreeUpItem
              icon="business-outline"
              iconBg="rgba(40, 64, 107, 0.12)"
              iconColor="#28406B"
              title="You administer it from one console"
              body="Seats, SSO, cohorts, roles, billing — and an aggregate view of how the whole program is practicing. No LMS to stand up, no integration build."
            />
          </View>
        </View>

        {/* CTA strip → pricing */}
        <View style={s.ctaStrip}>
          <Text style={s.ctaStripTitle}>See pricing for your program size →</Text>
          <Text style={s.ctaStripBody}>
            Per-seat pricing, volume tiers, and a free 30-day pilot for any cohort
            under 100.
          </Text>
          <View style={s.ctaStripRow}>
            <Pressable
              style={s.primaryBtnSm}
              onPress={() => router.push('/schools/pricing')}
            >
              <Text style={s.primaryBtnSmText}>Calculate your plan</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/schools/start-pilot')}>
              <Text style={s.ctaStripLink}>Book a demo →</Text>
            </Pressable>
          </View>
        </View>

        <Footer />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mock dashboard for the hero — Hopkins MSN Spring '26 cohort
// ---------------------------------------------------------------------------

function DashboardMock() {
  return (
    <View style={s.dashCard}>
      <Text style={s.dashEyebrow}>Hopkins MSN · Spring '26</Text>
      <Text style={s.dashTitle}>Cohort dashboard</Text>
      <View style={s.dashStats}>
        <View style={s.dashStat}>
          <Text style={s.dashStatLabel}>Active</Text>
          <Text style={s.dashStatValue}>28</Text>
        </View>
        <View style={s.dashStat}>
          <Text style={s.dashStatLabel}>Reflected</Text>
          <Text style={[s.dashStatValue, { color: '#1E8F47' }]}>87%</Text>
        </View>
      </View>
      <View style={s.dashHeatRow}>
        {['#B85A66', '#5A8DB8', '#B85A66', '#6E8B5A', '#B85A66', '#8B6E5A'].map(
          (color, i) => (
            <View key={i} style={[s.dashHeatCell, { backgroundColor: color }]} />
          ),
        )}
      </View>
      <View style={s.dashAlert}>
        <Text style={s.dashAlertTitle}>Emily Shaw · awaiting your reply</Text>
        <Text style={s.dashAlertBody}>
          "First time owning HF handoff — drafting an ISBAR…"
        </Text>
      </View>
    </View>
  );
}

function PhoneMock() {
  return (
    <View style={s.phoneCard}>
      <View style={s.phoneNotch} />
      <Text style={s.phoneEyebrow}>Today · 7am</Text>
      <Text style={s.phoneTitle}>Heart failure handoff in 4-South</Text>
      <View style={s.phasePillRow}>
        <View style={[s.phasePill, s.phasePillActive]}>
          <Text style={s.phasePillTextActive}>Plan</Text>
        </View>
        <View style={s.phasePill}>
          <Text style={s.phasePillText}>Do</Text>
        </View>
        <View style={s.phasePill}>
          <Text style={s.phasePillText}>Reflect</Text>
        </View>
      </View>
      <View style={s.mentorNote}>
        <Text style={s.mentorEyebrow}>Mentor · 6:55 AM</Text>
        <Text style={s.mentorBody}>
          Nice handoff plan — try ISBAR-Q for the question step.
        </Text>
      </View>
      <View style={s.phoneDivider} />
      <Text style={s.phoneFoot}>Blueprint · Adult Health I · M4</Text>
    </View>
  );
}

function ThreeUpItem({
  icon,
  iconBg,
  iconColor,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
}) {
  return (
    <View style={s.threeUpItem}>
      <View style={[s.threeUpIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={s.threeUpTitle}>{title}</Text>
      <Text style={s.threeUpBody}>{body}</Text>
    </View>
  );
}

export function Footer() {
  return (
    <View style={s.footer}>
      <Text style={s.footerText}>
        BetterAt for Schools · BAA · SOC 2 Type II · FERPA · GDPR · Data residency in
        US/EU
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
  scroll: { paddingBottom: 0 },

  hero: {
    flexDirection: 'row',
    paddingHorizontal: 56,
    paddingTop: 72,
    paddingBottom: 56,
    gap: 56,
    alignItems: 'center',
  },
  heroCopy: { flex: 1.1 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#B85A66',
    marginBottom: 18,
  },
  heroTitle: {
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: -1.5,
    fontWeight: '500',
    color: '#0E1117',
    marginBottom: 22,
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
  },
  heroTitleEm: { fontStyle: 'italic' },
  heroSub: {
    fontSize: 18,
    lineHeight: 27,
    color: 'rgba(60, 60, 67, 0.78)',
    maxWidth: 540,
    marginBottom: 28,
  },
  heroCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  primaryBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryLink: { fontSize: 15, color: '#0E1117', fontWeight: '500', padding: 13 },
  heroFinePrint: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.55)',
    marginTop: 18,
  },

  heroVisual: { flex: 1, height: 480, position: 'relative', minHeight: 480 },

  // Dashboard mock (top-right card)
  dashCard: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 320,
    minHeight: 360,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    ...({
      boxShadow: '0 20px 60px -20px rgba(0,0,0,0.18)',
    } as any),
  },
  dashEyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
  },
  dashTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.2,
    marginTop: 6,
  },
  dashStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  dashStat: {
    flex: 1,
    padding: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  dashStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
  },
  dashStatValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  dashHeatRow: { flexDirection: 'row', gap: 4, marginTop: 12 },
  dashHeatCell: { flex: 1, height: 36, borderRadius: 4 },
  dashAlert: {
    marginTop: 14,
    padding: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    borderRadius: 8,
  },
  dashAlertTitle: { fontSize: 10.5, fontWeight: '600', color: '#007AFF' },
  dashAlertBody: {
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 15,
    marginTop: 3,
    fontStyle: 'italic',
  },

  // Phone mock (bottom-left card, peeking)
  phoneCard: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 220,
    height: 380,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 6,
    borderColor: '#0F0E0C',
    ...({
      boxShadow: '0 20px 60px -20px rgba(0,0,0,0.25)',
    } as any),
  },
  phoneNotch: {
    width: 50,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5EA',
    marginTop: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  phoneEyebrow: {
    fontSize: 9,
    color: '#FF6B6B',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  phoneTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    lineHeight: 15,
    letterSpacing: -0.2,
  },
  phasePillRow: { flexDirection: 'row', gap: 4, marginTop: 12 },
  phasePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
  },
  phasePillActive: { backgroundColor: 'rgba(0, 122, 255, 0.10)' },
  phasePillText: { fontSize: 9, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  phasePillTextActive: { fontSize: 9, color: '#007AFF', fontWeight: '600' },
  mentorNote: {
    marginTop: 14,
    padding: 10,
    backgroundColor: 'rgba(184, 90, 102, 0.06)',
    borderRadius: 7,
    borderLeftWidth: 2,
    borderLeftColor: '#B85A66',
  },
  mentorEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#B85A66',
  },
  mentorBody: {
    marginTop: 3,
    fontSize: 10.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 15,
    fontStyle: 'italic',
  },
  phoneDivider: { height: 1, backgroundColor: '#E5E5EA', marginTop: 14 },
  phoneFoot: {
    marginTop: 8,
    fontSize: 9.5,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '600',
  },

  // Logo strip
  logoStrip: {
    paddingHorizontal: 56,
    paddingTop: 28,
    paddingBottom: 36,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  logoStripLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.45)',
    textAlign: 'center',
    marginBottom: 14,
  },
  logoStripRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 56,
    flexWrap: 'wrap',
    opacity: 0.55,
  },
  logoStripItem: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1B1B1F',
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
  },

  // Three-up
  threeUp: {
    paddingHorizontal: 56,
    paddingVertical: 56,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  sectionH2: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: '#0E1117',
    textAlign: 'center',
    maxWidth: 720,
    alignSelf: 'center',
    marginBottom: 38,
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
  },
  threeUpRow: {
    flexDirection: 'row',
    gap: 28,
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
  },
  threeUpItem: { flex: 1 },
  threeUpIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  threeUpTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#0E1117',
    marginBottom: 8,
  },
  threeUpBody: {
    fontSize: 14.5,
    lineHeight: 22,
    color: 'rgba(60, 60, 67, 0.7)',
  },

  // CTA strip
  ctaStrip: {
    paddingHorizontal: 56,
    paddingVertical: 48,
    backgroundColor: '#FAFAF7',
    alignItems: 'center',
  },
  ctaStripTitle: {
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.4,
    color: '#0E1117',
    marginBottom: 12,
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
    textAlign: 'center',
  },
  ctaStripBody: {
    fontSize: 14.5,
    color: 'rgba(60, 60, 67, 0.7)',
    marginBottom: 22,
    textAlign: 'center',
  },
  ctaStripRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  primaryBtnSm: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 9,
  },
  primaryBtnSmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  ctaStripLink: { fontSize: 14, color: '#007AFF', fontWeight: '500', padding: 11 },

  // Footer
  footer: {
    paddingHorizontal: 56,
    paddingVertical: 32,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  footerText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.45)' },
});
