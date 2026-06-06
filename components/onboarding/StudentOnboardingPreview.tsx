/**
 * Student onboarding mobile-frame previews (Frames 12-14 of the
 * institutions pass).
 *
 * Reusable phone-mockup components that render the three-step student
 * domain-claim flow:
 *
 *   - StudentEmailEntryFrame   · email input with domain-recognized card
 *   - StudentWelcomeFrame      · full-bleed navy welcome surface
 *   - StudentFirstHomeFrame    · first Practice home with JH org chip
 *
 * Each is exported as a stand-alone phone-shaped panel so the full design
 * can be reviewed at /schools/preview/student-onboarding. Production
 * integration (modifying app/(auth)/signup, post-signup welcome routing,
 * top-header org chip) is a separate follow-up once domain-claim backend
 * is real — these components plug into that work without redesign.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '@/lib/design-tokens-editorial';

// ---------------------------------------------------------------------------
// Phone frame chrome — shared
// ---------------------------------------------------------------------------

export function PhoneFrame({
  children,
  statusBarLight,
  statusBarTime = '9:41',
}: {
  children: React.ReactNode;
  statusBarLight?: boolean;
  statusBarTime?: string;
}) {
  return (
    <View style={phone.outer}>
      <View style={phone.notch} />
      <View style={[phone.statusbar, statusBarLight && phone.statusbarLight]}>
        <Text style={[phone.statusbarText, statusBarLight && phone.statusbarTextLight]}>
          {statusBarTime}
        </Text>
        <View style={phone.statusbarRight}>
          <Ionicons
            name="cellular"
            size={11}
            color={statusBarLight ? '#FFFFFF' : '#000000'}
          />
          <Ionicons
            name="wifi"
            size={11}
            color={statusBarLight ? '#FFFFFF' : '#000000'}
          />
          <Ionicons
            name="battery-three-quarters"
            size={13}
            color={statusBarLight ? '#FFFFFF' : '#000000'}
          />
        </View>
      </View>
      <View style={phone.screen}>{children}</View>
      <View style={[phone.homeIndicator, statusBarLight && phone.homeIndicatorLight]} />
    </View>
  );
}

const phone = StyleSheet.create({
  outer: {
    width: 320,
    height: 680,
    backgroundColor: '#FFFFFF',
    borderRadius: 44,
    borderWidth: 8,
    borderColor: '#0F0E0C',
    overflow: 'hidden',
    position: 'relative',
    ...({
      boxShadow: '0 30px 80px -30px rgba(0,0,0,0.28)',
    } as any),
  },
  notch: {
    position: 'absolute',
    top: 6,
    left: '50%',
    marginLeft: -45,
    width: 90,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0F0E0C',
    zIndex: 30,
  },
  statusbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 22,
    zIndex: 20,
  },
  statusbarLight: {},
  statusbarText: { fontSize: 13, fontWeight: '600', color: '#000000' },
  statusbarTextLight: { color: '#FFFFFF' },
  statusbarRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  screen: { flex: 1, overflow: 'hidden' },
  homeIndicator: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    marginLeft: -67,
    width: 134,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#000000',
  },
  homeIndicatorLight: { backgroundColor: '#FFFFFF' },
});

// ---------------------------------------------------------------------------
// Frame 12 — Email entry with domain recognition
// ---------------------------------------------------------------------------

export function StudentEmailEntryFrame() {
  return (
    <PhoneFrame>
      <View style={s.f12Root}>
        <View style={s.f12TopBar}>
          <Ionicons name="chevron-back" size={22} color="#007AFF" />
          <Text style={s.f12Back}>Back</Text>
        </View>

        <View style={s.f12Heading}>
          <Text style={s.f12Eyebrow}>Step 2 of 3</Text>
          <Text style={s.f12H1}>What's your email?</Text>
          <Text style={s.f12Sub}>
            If your school or team has BetterAt, we'll connect you automatically.
          </Text>
        </View>

        <View style={s.f12FormCol}>
          <View style={s.f12Input}>
            <Text style={s.f12InputText}>eshaw@jh.edu</Text>
            <View style={s.f12Caret} />
          </View>

          <View style={s.f12DomainCard}>
            <View style={s.f12DomainMono}>
              <Text style={s.f12DomainMonoText}>JH</Text>
            </View>
            <View style={s.f12DomainCol}>
              <Text style={s.f12DomainTitle}>We recognize @jh.edu</Text>
              <Text style={s.f12DomainBody}>
                <Text style={s.f12DomainStrong}>Johns Hopkins · MSN</Text> uses
                BetterAt. We'll add you to their workspace after verification.
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color="#1E8F47" />
          </View>

          <Text style={s.f12IndividualLink}>
            Not part of Hopkins?{' '}
            <Text style={s.f12IndividualLinkBlue}>Sign up as an individual</Text>
          </Text>
        </View>

        <View style={s.f12Sticky}>
          <View style={s.f12CtaBtn}>
            <Text style={s.f12CtaText}>Send verification code</Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </View>
          <Text style={s.f12Terms}>
            By continuing, you agree to BetterAt's{' '}
            <Text style={s.f12TermsLink}>Terms</Text> ·{' '}
            <Text style={s.f12TermsLink}>Privacy</Text>
          </Text>
        </View>
      </View>
    </PhoneFrame>
  );
}

// ---------------------------------------------------------------------------
// Frame 13 — Welcome to Hopkins MSN (full-bleed navy)
// ---------------------------------------------------------------------------

export function StudentWelcomeFrame() {
  return (
    <PhoneFrame statusBarLight>
      <View style={s.f13Root}>
        <View style={s.f13TopRow}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.65)" />
        </View>

        <View style={s.f13Hero}>
          <View style={s.f13Mono}>
            <Text style={s.f13MonoText}>JH</Text>
          </View>
          <Text style={s.f13Eyebrow}>You're seat 312 of 350</Text>
          <Text style={s.f13H1}>
            Welcome to <Text style={s.f13H1Em}>Johns Hopkins · MSN</Text>
          </Text>
          <Text style={s.f13Sub}>
            Your seat is paid for by the school. You'll have access through Spring
            2027 or until you graduate, whichever comes first.
          </Text>
        </View>

        <View style={s.f13Card}>
          <Text style={s.f13CardEyebrow}>Your cohort</Text>
          <Text style={s.f13CardTitle}>Spring '26 · MSN second-year</Text>
          <Text style={s.f13CardBody}>
            Cohort mentor: <Text style={s.f13CardStrong}>Dr. K. Murphy</Text> · 28
            classmates · 14-week program
          </Text>
        </View>

        <View style={s.f13Card}>
          <Text style={s.f13CardEyebrow}>Already on your timeline</Text>
          <View style={s.f13BpRow}>
            <View style={[s.f13BpCover, { backgroundColor: '#7A6A8E' }]} />
            <View style={s.f13BpCol}>
              <Text style={s.f13BpTitle}>Adult Health I · Module 4</Text>
              <Text style={s.f13BpSub}>41 steps · Dr. K. Murphy</Text>
            </View>
          </View>
          <View style={s.f13BpDivider} />
          <View style={s.f13BpRow}>
            <View style={[s.f13BpCover, { backgroundColor: '#B85A66' }]} />
            <View style={s.f13BpCol}>
              <Text style={s.f13BpTitle}>MSN onboarding · year 2</Text>
              <Text style={s.f13BpSub}>8 steps · school-required</Text>
            </View>
          </View>
        </View>

        <View style={s.f13Sticky}>
          <View style={s.f13Cta}>
            <Text style={s.f13CtaText}>Open your first step →</Text>
          </View>
        </View>
      </View>
    </PhoneFrame>
  );
}

// ---------------------------------------------------------------------------
// Frame 14 — First Practice home with JH chip + cohort step
// ---------------------------------------------------------------------------

export function StudentFirstHomeFrame() {
  return (
    <PhoneFrame>
      <View style={s.f14Root}>
        {/* Top header */}
        <View style={s.f14Header}>
          <View style={s.f14Interest}>
            <View style={s.f14NursingDot} />
            <Text style={s.f14InterestName}>Nursing</Text>
            <View style={s.f14OrgChip}>
              <Ionicons name="business" size={10} color="#28406B" />
              <Text style={s.f14OrgChipText}>JH</Text>
            </View>
            <Ionicons name="chevron-down" size={14} color="rgba(60, 60, 67, 0.4)" />
          </View>
          <View style={s.f14Right}>
            <Text style={s.f14StepCounter}>Step 1 of 41</Text>
            <View style={s.f14Avatar}>
              <Text style={s.f14AvatarText}>ES</Text>
              <View style={s.f14AvatarPip}>
                <Text style={s.f14AvatarPipText}>JH</Text>
              </View>
            </View>
          </View>
        </View>

        {/* One-time onboarding card */}
        <View style={s.f14OnboardCard}>
          <Ionicons name="sparkles" size={18} color="#007AFF" />
          <View style={s.f14OnboardCol}>
            <Text style={s.f14OnboardTitle}>You're set up with Hopkins MSN</Text>
            <Text style={s.f14OnboardBody}>
              Your cohort's first step is below. Switch to{' '}
              <Text style={s.f14OnboardEm}>Personal</Text> in the menu to add other
              interests.
            </Text>
          </View>
          <Ionicons name="close" size={16} color="#007AFF" />
        </View>

        {/* Step card */}
        <View style={s.f14StepCard}>
          {/* Blueprint provenance */}
          <View style={s.f14Provenance}>
            <View style={s.f14ProvLeft}>
              <View style={s.f14ProvMono}>
                <Text style={s.f14ProvMonoText}>JH</Text>
              </View>
              <View style={s.f14ProvCol}>
                <Text style={s.f14ProvTitle}>Adult Health I · Module 4</Text>
                <Text style={s.f14ProvSub}>Dr. K. Murphy · 28 also starting today</Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color="rgba(60, 60, 67, 0.4)" />
            </View>
            <View style={s.f14CohortChip}>
              <Text style={s.f14CohortChipText}>28</Text>
              <Ionicons name="people" size={10.5} color="rgba(60, 60, 67, 0.4)" />
            </View>
          </View>

          <View style={s.f14StepEyebrow}>
            <View style={s.f14StepDot} />
            <Text style={s.f14StepEyebrowText}>Today · first day of clinical</Text>
          </View>
          <Text style={s.f14StepTitle}>Set your intention for week 1</Text>
          <Text style={s.f14StepMeta}>
            Wed · JHH Bloomberg 4S{'  '}·{'  '}Preceptor: A. Ngo, RN
          </Text>

          <View style={s.f14Phases}>
            <View style={s.f14PhaseActive}>
              <Text style={s.f14PhaseActiveText}>Plan</Text>
              <View style={s.f14PhaseUnderline} />
            </View>
            <Text style={s.f14PhaseIdle}>Do</Text>
            <Text style={s.f14PhaseIdle}>Reflect</Text>
          </View>

          <View style={s.f14StepBody}>
            <Text style={s.f14StepBodyEyebrow}>
              What does Dr. Murphy want you to focus on today?
            </Text>
            <Text style={s.f14StepBodyQuote}>
              "Walk into 4-South before the brief. Find the chart of the patient
              whose handoff felt rushed yesterday — read what the night nurse
              wrote. We'll come back to it together at 7."
            </Text>
            <Text style={s.f14StepBodyAttr}>— from your cohort's blueprint</Text>
          </View>
        </View>

        {/* Tab bar */}
        <View style={s.f14Tabbar}>
          <Tab icon="flag" label="Practice" active />
          <Tab icon="book" label="Library" />
          <Tab icon="compass" label="Discover" />
          <Tab icon="time-outline" label="Reflect" />
        </View>
      </View>
    </PhoneFrame>
  );
}

function Tab({
  icon,
  label,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
}) {
  return (
    <View style={s.tab}>
      <Ionicons name={icon} size={20} color={active ? '#007AFF' : 'rgba(60, 60, 67, 0.6)'} />
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  // ──────────────── Frame 12 ────────────────
  f12Root: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 8 },
  f12TopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    height: 52,
  },
  f12Back: { fontSize: 16, color: '#007AFF', marginLeft: 4 },
  f12Heading: { paddingHorizontal: 28, paddingTop: 18 },
  f12Eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
  },
  f12H1: {
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 33,
    letterSpacing: -0.5,
    color: '#000000',
    marginTop: 12,
    marginBottom: 10,
  },
  f12Sub: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: -0.1,
  },
  f12FormCol: { paddingHorizontal: 24, paddingTop: 28 },
  f12Input: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    gap: 6,
  },
  f12InputText: { flex: 1, fontSize: 17, color: '#000000', letterSpacing: -0.2 },
  f12Caret: { width: 2, height: 20, backgroundColor: '#007AFF' },
  f12DomainCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(40, 64, 107, 0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(40, 64, 107, 0.16)',
    borderRadius: 12,
  },
  f12DomainMono: {
    width: 40,
    height: 40,
    borderRadius: 9,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f12DomainMonoText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  f12DomainCol: { flex: 1, minWidth: 0 },
  f12DomainTitle: { fontSize: 13.5, fontWeight: '600', color: '#28406B' },
  f12DomainBody: {
    marginTop: 2,
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 17,
  },
  f12DomainStrong: { fontWeight: '600' },
  f12IndividualLink: {
    marginTop: 14,
    paddingLeft: 4,
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 18,
  },
  f12IndividualLinkBlue: { color: '#007AFF' },
  f12Sticky: { position: 'absolute', bottom: 28, left: 24, right: 24 },
  f12CtaBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  f12CtaText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.24 },
  f12Terms: {
    marginTop: 14,
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.3)',
    textAlign: 'center',
  },
  f12TermsLink: { color: 'rgba(60, 60, 67, 0.6)' },

  // ──────────────── Frame 13 ────────────────
  f13Root: { flex: 1, backgroundColor: '#28406B', paddingTop: 60 },
  f13TopRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 22 },
  f13Hero: { paddingHorizontal: 32, paddingTop: 36, alignItems: 'center' },
  f13Mono: {
    width: 78,
    height: 78,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  f13MonoText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', letterSpacing: 1.04 },
  f13Eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  f13H1: {
    marginTop: 12,
    marginBottom: 14,
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 33,
    letterSpacing: -0.5,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: fontFamily.serif,
  },
  f13H1Em: { fontStyle: 'italic' },
  f13Sub: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    maxWidth: 240,
  },
  f13Card: {
    marginTop: 14,
    marginHorizontal: 22,
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
  },
  f13CardEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  f13CardTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  f13CardBody: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 17,
  },
  f13CardStrong: { fontWeight: '600', color: '#FFFFFF' },
  f13BpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  f13BpCover: { width: 28, height: 36, borderRadius: 5 },
  f13BpCol: { flex: 1, minWidth: 0 },
  f13BpTitle: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' },
  f13BpSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  f13BpDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 6,
  },
  f13Sticky: { position: 'absolute', bottom: 28, left: 22, right: 22 },
  f13Cta: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f13CtaText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#28406B',
    letterSpacing: -0.24,
  },

  // ──────────────── Frame 14 ────────────────
  f14Root: { flex: 1, backgroundColor: '#F2F2F7', paddingTop: 4 },
  f14Header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  f14Interest: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  f14NursingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7A6A8E' },
  f14InterestName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  f14OrgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(40, 64, 107, 0.12)',
    borderRadius: 4,
  },
  f14OrgChipText: { fontSize: 10, fontWeight: '700', color: '#28406B' },
  f14Right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  f14StepCounter: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  f14Avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#7A6A8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f14AvatarText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  f14AvatarPip: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#28406B',
    borderWidth: 1.5,
    borderColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f14AvatarPipText: { fontSize: 8, fontWeight: '700', color: '#FFFFFF' },

  f14OnboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    marginTop: 4,
    marginBottom: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    borderRadius: 12,
  },
  f14OnboardCol: { flex: 1, minWidth: 0 },
  f14OnboardTitle: { fontSize: 12.5, fontWeight: '600', color: '#007AFF' },
  f14OnboardBody: {
    marginTop: 1,
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 16,
  },
  f14OnboardEm: { fontStyle: 'italic' },

  f14StepCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
    ...({
      boxShadow: '0 8px 22px -10px rgba(0,0,0,0.10)',
    } as any),
  },
  f14Provenance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(40, 64, 107, 0.05)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  f14ProvLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  f14ProvMono: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f14ProvMonoText: { fontSize: 8.5, fontWeight: '700', color: '#FFFFFF' },
  f14ProvCol: {},
  f14ProvTitle: { fontSize: 11, fontWeight: '600', color: '#1C1C1E', lineHeight: 13 },
  f14ProvSub: {
    fontSize: 10.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 12,
    marginTop: 1,
  },
  f14CohortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  f14CohortChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.85)',
  },

  f14StepEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  f14StepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#007AFF' },
  f14StepEyebrowText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#007AFF',
  },
  f14StepTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: '#1C1C1E',
    lineHeight: 26,
    paddingHorizontal: 18,
    marginTop: 6,
  },
  f14StepMeta: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.6)',
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 12,
  },

  f14Phases: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  f14PhaseActive: {
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 12,
    position: 'relative',
  },
  f14PhaseActiveText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },
  f14PhaseUnderline: {
    position: 'absolute',
    bottom: -0.5,
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: '#007AFF',
    borderRadius: 1,
  },
  f14PhaseIdle: {
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
  },

  f14StepBody: { padding: 18, paddingTop: 12 },
  f14StepBodyEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
    marginBottom: 8,
  },
  f14StepBodyQuote: {
    fontSize: 13,
    lineHeight: 19,
    color: '#1C1C1E',
    fontStyle: 'italic',
    fontFamily: fontFamily.serif,
    marginBottom: 10,
  },
  f14StepBodyAttr: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },

  f14Tabbar: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    ...({
      backdropFilter: 'blur(20px)',
    } as any),
  },
  tab: { alignItems: 'center', gap: 2, paddingHorizontal: 12 },
  tabText: { fontSize: 10, color: 'rgba(60, 60, 67, 0.6)' },
  tabTextActive: { color: '#007AFF', fontWeight: '600' },
});
