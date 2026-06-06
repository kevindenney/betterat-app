/**
 * FTUE MOCKUP (dev-only) — proposed first-time user experience for a fresh
 * native install. Self-contained prototype: no real auth, no real routing.
 * Every button advances internal step state so it can be tapped through in
 * the simulator and reviewed.
 *
 * Open at: /dev/ftue-mockup
 *
 * What it proposes (vs. the current native cold-open, which dumps a brand-new
 * user straight onto the "Welcome back / Sign in to continue" login wall):
 *   1. Welcome hero        — value prop first, "no account needed to start"
 *   2. How it works        — Capture / Plan / Reflect (interest-agnostic)
 *   3. Pick your focus      — interest grid up front, before any sign-in
 *   4. Personalized value   — ONE card tailored to the chosen interest's
 *                             vocabulary (generalizes the sailing-hardcoded
 *                             /onboarding/value/* funnel into data)
 *   5. You're set           — enter as guest with demo content; account is a
 *                             soft, deferred upsell — never a gate
 */

import React, { useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#2563EB';
const BRAND_DARK = '#0B1A33';
const BG = '#FAF8F5';

// react-native-web leaves reanimated `entering` elements stuck at opacity 0,
// so the whole flow renders invisible in a browser. Only animate on native;
// on web, render immediately.
const enter = <T,>(anim: T): T | undefined => (Platform.OS === 'web' ? undefined : anim);

const sans = (weight: '400' | '600' | '700') =>
  Platform.select({
    ios: {
      fontFamily:
        weight === '700'
          ? 'Manrope-Bold'
          : weight === '600'
            ? 'Manrope-SemiBold'
            : 'Manrope-Regular',
    },
    android: {
      fontFamily:
        weight === '700'
          ? 'Manrope-Bold'
          : weight === '600'
            ? 'Manrope-SemiBold'
            : 'Manrope-Regular',
    },
    web: { fontFamily: 'Manrope, system-ui, sans-serif', fontWeight: weight as const },
  }) as object;

// ── Interest catalog (mirrors lib/landing/sampleData SAMPLE_INTERESTS) ──
type Interest = { slug: string; name: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] };
const INTERESTS: Interest[] = [
  { slug: 'sail-racing', name: 'Sail Racing', color: '#003DA5', icon: 'boat' },
  { slug: 'golf', name: 'Golf', color: '#1B5E20', icon: 'golf' },
  { slug: 'health-and-fitness', name: 'Health & Fitness', color: '#2E7D32', icon: 'barbell' },
  { slug: 'drawing', name: 'Drawing', color: '#E64A19', icon: 'color-palette' },
  { slug: 'nursing', name: 'Nursing', color: '#0097A7', icon: 'medkit' },
  { slug: 'design', name: 'Design', color: '#7B1FA2', icon: 'brush' },
  { slug: 'knitting', name: 'Knitting', color: '#E91E63', icon: 'cut' },
  { slug: 'fiber-arts', name: 'Fiber Arts', color: '#8E24AA', icon: 'color-wand' },
];

// ── Per-interest value content (the part that's hardcoded-sailing today) ──
type ValueBullet = { icon: React.ComponentProps<typeof Ionicons>['name']; text: string };
type ValueCopy = { headline: string; bullets: ValueBullet[] };
const VALUE_BY_SLUG: Record<string, ValueCopy> = {
  'sail-racing': {
    headline: 'Built for the racecourse',
    bullets: [
      { icon: 'flag', text: 'Log every race and debrief while it’s fresh' },
      { icon: 'navigate', text: 'Wind, tide, and course conditions on the map' },
      { icon: 'people', text: 'Train alongside your fleet' },
    ],
  },
  golf: {
    headline: 'Built for your game',
    bullets: [
      { icon: 'golf', text: 'Log rounds and track strokes gained' },
      { icon: 'map', text: 'Plan strategy hole-by-hole' },
      { icon: 'people', text: 'Practice with your club' },
    ],
  },
  'health-and-fitness': {
    headline: 'Built for training',
    bullets: [
      { icon: 'barbell', text: 'Log workouts and watch progress add up' },
      { icon: 'calendar', text: 'Plan a week that fits your life' },
      { icon: 'people', text: 'Stay accountable with others' },
    ],
  },
  drawing: {
    headline: 'Built for your sketchbook',
    bullets: [
      { icon: 'camera', text: 'Capture works-in-progress as you go' },
      { icon: 'sparkles', text: 'Build a daily drawing habit' },
      { icon: 'sync', text: 'Learn from looking back at your own pieces' },
    ],
  },
  nursing: {
    headline: 'Built for clinical rotations',
    bullets: [
      { icon: 'time', text: 'Log shifts and clinical hours' },
      { icon: 'ribbon', text: 'Map competencies to real evidence' },
      { icon: 'people', text: 'Move through it with your cohort' },
    ],
  },
  design: {
    headline: 'Built for your craft',
    bullets: [
      { icon: 'images', text: 'Capture references and iterations' },
      { icon: 'compass', text: 'Plan projects that actually ship' },
      { icon: 'people', text: 'Grow with a community' },
    ],
  },
  knitting: {
    headline: 'Built for your projects',
    bullets: [
      { icon: 'camera', text: 'Photograph every finished object' },
      { icon: 'list', text: 'Plan patterns and track yardage' },
      { icon: 'people', text: 'Share with your circle' },
    ],
  },
  'fiber-arts': {
    headline: 'Built for the studio',
    bullets: [
      { icon: 'images', text: 'Document each piece you make' },
      { icon: 'compass', text: 'Plan your making, season by season' },
      { icon: 'people', text: 'Connect with fellow makers' },
    ],
  },
};
const GENERIC_VALUE: ValueCopy = {
  headline: 'Built for the work you care about',
  bullets: [
    { icon: 'camera', text: 'Capture notes, photos, and video as you go' },
    { icon: 'compass', text: 'Plan a routine you’ll actually keep' },
    { icon: 'sync', text: 'Reflect and improve from your own work' },
  ],
};

const HOW_STEPS = [
  { icon: 'sparkles' as const, color: '#2563EB', title: 'Capture', body: 'Drop notes, photos, and videos as you go — anything that helps you learn.' },
  { icon: 'compass' as const, color: '#16A34A', title: 'Plan', body: 'Build a routine that fits your life, with steps you actually want to do.' },
  { icon: 'sync' as const, color: '#DB2777', title: 'Reflect', body: 'Look back, learn, and adjust — your best ideas come from your own work.' },
];

type Step = 'hero' | 'how' | 'pick' | 'value' | 'done';
const ORDER: Step[] = ['hero', 'how', 'pick', 'value', 'done'];

export default function FtueMockupScreen() {
  const [step, setStep] = useState<Step>('hero');
  const [interest, setInterest] = useState<Interest | null>(null);

  const idx = ORDER.indexOf(step);
  const go = (s: Step) => setStep(s);
  const back = () => idx > 0 && setStep(ORDER[idx - 1]);

  const value = interest ? (VALUE_BY_SLUG[interest.slug] ?? GENERIC_VALUE) : GENERIC_VALUE;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {/* Mockup tag */}
      <View style={styles.mockTag}>
        <Ionicons name="construct" size={12} color="#92400E" />
        <Text style={styles.mockTagText}>FTUE MOCKUP — proposed native first-open</Text>
      </View>

      {/* Top bar: back + progress dots */}
      <View style={styles.topBar}>
        {idx > 0 ? (
          <Pressable onPress={back} hitSlop={12} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.dots}>
          {ORDER.map((s, i) => (
            <View key={s} style={[styles.dot, i === idx ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
        <View style={styles.backBtn} />
      </View>

      {step === 'hero' && <Hero onStart={() => go('how')} />}
      {step === 'how' && <How onContinue={() => go('pick')} />}
      {step === 'pick' && (
        <Pick
          onPick={(i) => {
            setInterest(i);
            go('value');
          }}
        />
      )}
      {step === 'value' && interest && (
        <ValueScreen interest={interest} value={value} onContinue={() => go('done')} />
      )}
      {step === 'done' && interest && (
        <Done interest={interest} onRestart={() => { setInterest(null); go('hero'); }} />
      )}
    </SafeAreaView>
  );
}

// ── Screen 1: Hero ──────────────────────────────────────────────────────
function Hero({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.body}>
      <View style={{ flexGrow: 0.6 }} />
      <View style={styles.heroStack}>
        <Animated.View entering={enter(FadeInDown.duration(450))} style={styles.brandBlock}>
          <View style={styles.brandRing} />
          <Image source={require('@/assets/images/brand-mark-large.png')} style={styles.brandMark} resizeMode="contain" />
        </Animated.View>
        <Animated.Text entering={enter(FadeInDown.delay(80).duration(450))} style={styles.wordmark}>BetterAt</Animated.Text>
        <Animated.Text entering={enter(FadeInDown.delay(180).duration(450))} style={styles.heroTitle}>
          Get better at the things you care about
        </Animated.Text>
        <Animated.Text entering={enter(FadeInDown.delay(260).duration(450))} style={styles.heroSub}>
          A daily practice for the stuff you actually want to improve at.
        </Animated.Text>
      </View>
      <View style={{ flexGrow: 1 }} />
      <Animated.View entering={enter(FadeInDown.delay(340).duration(450))} style={styles.ctaBlock}>
        <PrimaryBtn label="Get started" onPress={onStart} />
        <Text style={styles.reassurance}>No account needed to start</Text>
        <Pressable hitSlop={12} style={styles.secondaryLink}>
          <Text style={styles.secondaryLinkText}>
            Already have an account? <Text style={styles.secondaryLinkBold}>Log in</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ── Screen 2: How it works ──────────────────────────────────────────────
function How({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={[styles.body, { justifyContent: 'space-between' }]}>
      <View>
        <Animated.View entering={enter(FadeInDown.duration(400))} style={styles.brandPill}>
          <Image source={require('@/assets/images/brand-mark.png')} style={styles.brandPillMark} resizeMode="contain" />
          <Text style={styles.brandPillText}>BetterAt</Text>
        </Animated.View>
        <Animated.View entering={enter(FadeInDown.delay(80).duration(400))}>
          <Text style={styles.h2}>How it works</Text>
          <Text style={styles.h2sub}>Three simple ideas, one daily habit.</Text>
        </Animated.View>
        <View style={styles.stepsBlock}>
          {HOW_STEPS.map((s, i) => (
            <Animated.View key={s.title} entering={enter(FadeInDown.delay(220 + i * 110).duration(420))} style={styles.stepRow}>
              <View style={[styles.stepBadge, { backgroundColor: s.color }]}>
                <Ionicons name={s.icon} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1, paddingTop: 4 }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepBody}>{s.body}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
      <Animated.View entering={enter(FadeInDown.delay(500).duration(420))}>
        <PrimaryBtn label="Continue" onPress={onContinue} />
      </Animated.View>
    </View>
  );
}

// ── Screen 3: Pick your focus ───────────────────────────────────────────
function Pick({ onPick }: { onPick: (i: Interest) => void }) {
  return (
    <View style={styles.body}>
      <Animated.View entering={enter(FadeInDown.duration(400))}>
        <Text style={styles.h2}>What do you want to get better at?</Text>
        <Text style={styles.h2sub}>Pick one to start. You can add more later.</Text>
      </Animated.View>
      <ScrollView style={{ marginTop: 18 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {INTERESTS.map((it, i) => (
          <Animated.View key={it.slug} entering={enter(FadeInDown.delay(60 + i * 50).duration(360))} style={styles.gridCellWrap}>
            <Pressable
              onPress={() => onPick(it)}
              style={styles.interestCard}
              accessibilityLabel={`Pick ${it.name}`}
            >
              <View style={[styles.interestIcon, { backgroundColor: it.color }]}>
                <Ionicons name={it.icon} size={24} color="#fff" />
              </View>
              <Text style={styles.interestName}>{it.name}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Screen 4: Personalized value ────────────────────────────────────────
function ValueScreen({ interest, value, onContinue }: { interest: Interest; value: ValueCopy; onContinue: () => void }) {
  return (
    <View style={[styles.body, { justifyContent: 'space-between' }]}>
      <View>
        <Animated.View entering={enter(FadeIn.duration(300))} style={[styles.valueHeaderIcon, { backgroundColor: interest.color }]}>
          <Ionicons name={interest.icon} size={30} color="#fff" />
        </Animated.View>
        <Animated.Text entering={enter(FadeInDown.delay(80).duration(420))} style={styles.valueEyebrow}>
          {interest.name.toUpperCase()}
        </Animated.Text>
        <Animated.Text entering={enter(FadeInDown.delay(140).duration(420))} style={styles.h2}>
          {value.headline}
        </Animated.Text>
        <View style={styles.valueBullets}>
          {value.bullets.map((b, i) => (
            <Animated.View key={i} entering={enter(FadeInDown.delay(240 + i * 110).duration(420))} style={styles.valueBulletRow}>
              <View style={[styles.valueBulletIcon, { backgroundColor: `${interest.color}1A` }]}>
                <Ionicons name={b.icon} size={18} color={interest.color} />
              </View>
              <Text style={styles.valueBulletText}>{b.text}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
      <Animated.View entering={enter(FadeInDown.delay(560).duration(420))}>
        <PrimaryBtn label="Start exploring" onPress={onContinue} />
        <Text style={styles.reassurance}>Free to start — no card, no account yet</Text>
      </Animated.View>
    </View>
  );
}

// ── Screen 5: Done / soft sign-up ───────────────────────────────────────
function Done({ interest, onRestart }: { interest: Interest; onRestart: () => void }) {
  return (
    <View style={[styles.body, { justifyContent: 'space-between' }]}>
      <View style={{ flexGrow: 0.5 }} />
      <View style={styles.heroStack}>
        <Animated.View entering={enter(FadeInDown.duration(420))} style={[styles.valueHeaderIcon, { backgroundColor: interest.color }]}>
          <Ionicons name="checkmark" size={34} color="#fff" />
        </Animated.View>
        <Animated.Text entering={enter(FadeInDown.delay(120).duration(420))} style={styles.heroTitle}>
          You’re set up for {interest.name}
        </Animated.Text>
        <Animated.Text entering={enter(FadeInDown.delay(200).duration(420))} style={styles.heroSub}>
          We dropped a sample in so you can look around. Save your progress whenever you’re ready.
        </Animated.Text>
      </View>
      <View style={{ flexGrow: 1 }} />
      <Animated.View entering={enter(FadeInDown.delay(280).duration(420))} style={styles.ctaBlock}>
        <PrimaryBtn label="Take me in" onPress={onRestart} />
        <Pressable hitSlop={12} style={styles.secondaryLink} onPress={onRestart}>
          <Text style={styles.secondaryLinkText}>
            <Text style={styles.secondaryLinkBold}>Create a free account</Text> to save your progress
          </Text>
        </Pressable>
        <Pressable hitSlop={12} style={[styles.secondaryLink, { marginTop: 4 }]} onPress={onRestart}>
          <Text style={[styles.secondaryLinkText, { color: '#94A3B8' }]}>↺ Restart mockup</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ── Shared primary button ───────────────────────────────────────────────
function PrimaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.primaryBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  mockTag: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FEF3C7', paddingVertical: 5,
  },
  mockTagText: { fontSize: 11, color: '#92400E', letterSpacing: 0.4, ...sans('600') },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, minHeight: 44,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotActive: { backgroundColor: '#1A1A1A', width: 18 },
  dotInactive: { backgroundColor: '#D4D4D8' },

  body: { flex: 1, paddingHorizontal: 28, paddingBottom: 24 },

  // Hero / shared
  heroStack: { alignItems: 'center' },
  brandBlock: { width: 156, height: 156, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  brandRing: {
    position: 'absolute', width: 156, height: 156, borderRadius: 78,
    backgroundColor: 'rgba(37,99,235,0.06)', borderWidth: 1, borderColor: 'rgba(37,99,235,0.10)',
  },
  brandMark: {
    width: 96, height: 96, borderRadius: 24,
    shadowColor: BRAND_DARK, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 8,
  },
  wordmark: { fontSize: 22, color: BRAND_DARK, letterSpacing: -0.3, marginBottom: 22, ...sans('700') },
  heroTitle: { fontSize: 34, lineHeight: 40, color: '#1A1A1A', textAlign: 'center', letterSpacing: -0.5, marginBottom: 14, ...sans('700') },
  heroSub: { fontSize: 16, lineHeight: 23, color: '#64748B', textAlign: 'center', paddingHorizontal: 16, ...sans('400') },

  ctaBlock: { gap: 12 },
  reassurance: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 2, ...sans('400') },
  secondaryLink: { alignItems: 'center', paddingVertical: 6 },
  secondaryLinkText: { fontSize: 14, color: '#64748B', ...sans('400') },
  secondaryLinkBold: { color: ACCENT, ...sans('600') },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: ACCENT, paddingVertical: 17, paddingHorizontal: 24, borderRadius: 14,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 16, elevation: 6,
  },
  primaryBtnText: { fontSize: 17, color: '#fff', letterSpacing: 0.2, ...sans('700') },

  // Brand pill
  brandPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 10,
    marginTop: 8, marginBottom: 18, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.06)', borderWidth: 1, borderColor: 'rgba(37,99,235,0.10)',
  },
  brandPillMark: { width: 32, height: 32, borderRadius: 8 },
  brandPillText: { fontSize: 15, color: BRAND_DARK, letterSpacing: -0.1, marginRight: 4, ...sans('700') },

  // Section header (h2)
  h2: { fontSize: 30, lineHeight: 38, color: '#1A1A1A', letterSpacing: -0.4, marginBottom: 8, ...sans('700') },
  h2sub: { fontSize: 16, lineHeight: 22, color: '#64748B', ...sans('400') },

  // How-it-works steps
  stepsBlock: { gap: 24, paddingVertical: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  stepBadge: {
    width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 3,
  },
  stepTitle: { fontSize: 18, color: '#1A1A1A', marginBottom: 4, ...sans('700') },
  stepBody: { fontSize: 14.5, lineHeight: 20, color: '#64748B', ...sans('400') },

  // Interest grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 24 },
  gridCellWrap: { width: '48%', marginBottom: 14 },
  interestCard: {
    backgroundColor: '#fff', borderRadius: 18, paddingVertical: 22, paddingHorizontal: 16,
    alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#EFE9E1',
    shadowColor: BRAND_DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  interestIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  interestName: { fontSize: 15.5, color: '#1A1A1A', ...sans('600') },

  // Value screen
  valueHeaderIcon: {
    width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3,
  },
  valueEyebrow: { fontSize: 12.5, letterSpacing: 1.2, color: '#94A3B8', marginBottom: 6, ...sans('700') },
  valueBullets: { gap: 18, marginTop: 24 },
  valueBulletRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  valueBulletIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  valueBulletText: { flex: 1, fontSize: 16, lineHeight: 22, color: '#334155', ...sans('600') },
});
