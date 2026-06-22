/**
 * betterat.com/schools/pricing — institutional pricing calculator (Frame 10).
 *
 * Per-seat pricing with live calculator on the left and totals on the right.
 * Volume tiers auto-apply at 250+ seats. Sliders rendered as click-to-set
 * bars + value display; direct text input also accepted.
 */

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MktNav } from '@/components/marketing/MktNav';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { Footer } from './index';

const PER_SEAT_STUDENT = 9.5;       // $/mo
const PER_SEAT_AUTHOR = 19;         // $/mo
const VOLUME_DISCOUNT_THRESHOLD = 250;
const VOLUME_DISCOUNT_PER_SEAT = 0.61;  // ≈ $2,200 / 300 seats / yr — heuristic

const STUDENT_STEPS = [25, 100, 250, 500, 1000, 2500];
const AUTHOR_STEPS = [1, 4, 8, 12, 24, 48, 75];
const ADMIN_STEPS = [1, 2, 4, 8, 12, 20];

export default function SchoolsPricingPage() {
  const router = useRouter();
  const [students, setStudents] = useState(300);
  const [authors, setAuthors] = useState(12);
  const [admins, setAdmins] = useState(4);

  const totals = useMemo(() => {
    const studentAnnual = students * PER_SEAT_STUDENT * 12;
    const authorAnnual = authors * PER_SEAT_AUTHOR * 12;
    const volumeDiscount =
      students >= VOLUME_DISCOUNT_THRESHOLD
        ? students * VOLUME_DISCOUNT_PER_SEAT * 12
        : 0;
    const annualTotal = studentAnnual + authorAnnual - volumeDiscount;
    return {
      studentAnnual,
      authorAnnual,
      volumeDiscount,
      annualTotal,
      monthly: annualTotal / 12,
    };
  }, [students, authors]);
  // admins is shown in the summary but doesn't affect totals (admin seats are free) —
  // keep it out of the dep array to silence the exhaustive-deps lint.
  void admins;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <MktNav active="pricing" />

        <View style={s.titleBlock}>
          <Text style={s.titleEyebrow}>Pricing · institutional plan</Text>
          <Text style={s.title}>Per seat · billed annually · everything included</Text>
          <Text style={s.titleSub}>
            One price for every student, faculty member, and admin. No add-ons for
            SSO, mentoring, or analytics. Volume tiers kick in automatically. A
            25-seat minimum applies.
          </Text>
        </View>

        <View style={s.calcWrap}>
          <View style={s.calcCard}>
            {/* Left: inputs */}
            <View style={s.inputsCol}>
              <Text style={s.colEyebrow}>Your program</Text>
              <Text style={s.colH3}>How many seats do you need?</Text>

              <SeatSlider
                label="Students"
                value={students}
                steps={STUDENT_STEPS}
                color="#007AFF"
                onChange={setStudents}
                valueSize={32}
                showTicks
              />

              <SeatSlider
                label="Faculty / authors"
                value={authors}
                steps={AUTHOR_STEPS}
                color="#6B5BBF"
                onChange={setAuthors}
                valueSize={24}
              />

              <SeatSlider
                label="Admin accounts"
                value={admins}
                steps={ADMIN_STEPS}
                color="#28406B"
                onChange={setAdmins}
                valueSize={24}
              />

              <Text style={[s.colEyebrow, { marginTop: 28, marginBottom: 14 }]}>
                Add-ons · all included
              </Text>
              <View style={s.checklist}>
                <CheckRow label="SSO via SAML & OIDC · all major IdPs" />
                <CheckRow label="Faculty seats & co-author workflow" />
                <CheckRow label="Cohort & placement management · unlimited" />
                <CheckRow label="Program-level analytics & capability arcs" />
                <CheckRow label="BAA & SOC 2 Type II · data residency in US/EU" />
              </View>
            </View>

            {/* Right: summary */}
            <View style={s.summaryCol}>
              <Text style={s.colEyebrow}>Your annual plan</Text>
              <Text style={s.colH3}>Estimated</Text>

              <View style={s.summaryRows}>
                <SummaryRow
                  label={`${students.toLocaleString()} student seats × $${PER_SEAT_STUDENT.toFixed(
                    2,
                  )} / mo`}
                  value={`$${totals.studentAnnual.toLocaleString()}`}
                />
                <SummaryRow
                  label={`${authors} author seats × $${PER_SEAT_AUTHOR} / mo`}
                  value={`$${totals.authorAnnual.toLocaleString()}`}
                />
                <SummaryRow
                  label={`${admins} admin seats`}
                  value="free"
                  valueColor="#1E8F47"
                  valueWeight="600"
                />
                {totals.volumeDiscount > 0 ? (
                  <SummaryRow
                    label="Volume tier · 250+ seats"
                    labelColor="#1E8F47"
                    value={`−$${totals.volumeDiscount.toLocaleString()}`}
                    valueColor="#1E8F47"
                    valueWeight="600"
                  />
                ) : null}
              </View>

              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Annual total</Text>
                <Text style={s.totalValue}>
                  ${Math.round(totals.annualTotal).toLocaleString()}
                </Text>
              </View>
              <Text style={s.totalNote}>
                ${Math.round(totals.monthly).toLocaleString()} / month · or pay
                annually for 5% off
              </Text>

              <View style={s.summaryCtaCol}>
                <Pressable
                  style={s.primaryBtn}
                  onPress={() => router.push('/schools/start-pilot')}
                >
                  <Text style={s.primaryBtnText}>Start 30-day pilot · no card</Text>
                </Pressable>
                <Pressable
                  style={s.ghostBtn}
                  onPress={() => router.push('/schools/start-pilot')}
                >
                  <Text style={s.ghostBtnText}>Talk to procurement →</Text>
                </Pressable>
              </View>

              <View style={s.poCard}>
                <View style={s.poHead}>
                  <Ionicons name="receipt-outline" size={13} color="rgba(60, 60, 67, 0.6)" />
                  <Text style={s.poHeadText}>Need a PO / invoice?</Text>
                </View>
                <Text style={s.poBody}>
                  Pay by PO, ACH, wire, or card. We'll send a W-9 and a draft order
                  form before procurement asks.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.academicNote}>
          <Text style={s.academicText}>
            Per-seat pricing for K-12 districts and 501(c)(3) non-profits is 40%
            off.
          </Text>
          <Pressable onPress={() => router.push('/schools/start-pilot')}>
            <Text style={s.academicLink}>Apply for academic pricing →</Text>
          </Pressable>
        </View>

        <Footer />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Seat slider — click-to-set with optional ticks
// ---------------------------------------------------------------------------

function SeatSlider({
  label,
  value,
  steps,
  color,
  onChange,
  valueSize,
  showTicks,
}: {
  label: string;
  value: number;
  steps: number[];
  color: string;
  onChange: (v: number) => void;
  valueSize: number;
  showTicks?: boolean;
}) {
  const min = steps[0];
  const max = steps[steps.length - 1];
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  // Track geometry captured on layout so the PanResponder can convert
  // touch coords → value.
  const trackRef = useRef<View>(null);
  const trackGeom = useRef({ pageX: 0, width: 0 });

  function valueFromX(locationX: number): number {
    const ratio = Math.min(1, Math.max(0, locationX / Math.max(1, trackGeom.current.width)));
    // Piecewise-linear interpolation across the steps so each gap
    // between two ticks gets the same drag distance regardless of the
    // numeric jump (10 → 100 feels the same speed as 1000 → 2500+).
    const segments = steps.length - 1;
    const t = ratio * segments;
    const segIdx = Math.min(segments - 1, Math.floor(t));
    const segFrac = t - segIdx;
    const v = steps[segIdx] + (steps[segIdx + 1] - steps[segIdx]) * segFrac;
    return Math.round(v);
  }

  // Web: native HTML <input type="range"> gives us native drag, momentum,
  // and accessibility for free. Hidden, but covers the track area.
  const webRangeOverlay = Platform.OS === 'web' ? (
    <input
      type="range"
      min={0}
      max={1000}
      step={1}
      value={Math.round(pct * 10)}
      onChange={(e: any) => {
        const ratio = parseInt(e.target.value, 10) / 1000;
        const segments = steps.length - 1;
        const t = ratio * segments;
        const segIdx = Math.min(segments - 1, Math.floor(t));
        const segFrac = t - segIdx;
        const v = steps[segIdx] + (steps[segIdx + 1] - steps[segIdx]) * segFrac;
        onChange(Math.round(v));
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: -8,
        height: 36,
        width: '100%',
        opacity: 0,
        cursor: 'pointer',
        margin: 0,
        WebkitAppearance: 'none',
        appearance: 'none',
      } as any}
      aria-label={label}
    />
  ) : null;

  // Native: PanResponder for drag + tap.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          onChange(valueFromX(evt.nativeEvent.locationX));
        },
        onPanResponderMove: (evt) => {
          onChange(valueFromX(evt.nativeEvent.locationX));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps],
  );

  return (
    <View style={ss.wrap}>
      <View style={ss.headRow}>
        <Text style={ss.label}>{label}</Text>
        <TextInput
          style={[ss.valueInput, { fontSize: valueSize }]}
          value={String(value)}
          onChangeText={(text) => {
            const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
            else if (text === '') onChange(min);
          }}
          keyboardType="numeric"
        />
      </View>
      <View
        ref={trackRef}
        style={ss.barWrap}
        onLayout={(e) => {
          trackGeom.current.width = e.nativeEvent.layout.width;
        }}
        {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      >
        <View style={ss.barTrack}>
          <View
            style={[
              ss.barFill,
              { width: `${pct}%`, backgroundColor: color },
            ]}
          />
        </View>
        <View
          style={[
            ss.knob,
            { left: `${pct}%`, borderColor: color },
          ]}
          pointerEvents="none"
        />
        {/* Per-step snap-targets (still useful for keyboard nav) */}
        <View style={ss.stepRow} pointerEvents={Platform.OS === 'web' ? 'none' : 'auto'}>
          {steps.map((s) => (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              style={ss.stepBtn}
              accessibilityLabel={`Set ${label} to ${s}`}
            />
          ))}
        </View>
        {webRangeOverlay}
      </View>
      {showTicks ? (
        <View style={ss.tickRow}>
          {steps.map((step) => (
            <Text key={step} style={ss.tickText}>
              {step.toLocaleString()}
              {step === max ? '+' : ''}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CheckRow({ label }: { label: string }) {
  return (
    <View style={s.checkRow}>
      <Ionicons name="checkmark" size={16} color="#1E8F47" />
      <Text style={s.checkRowText}>{label}</Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  labelColor,
  valueColor,
  valueWeight,
}: {
  label: string;
  value: string;
  labelColor?: string;
  valueColor?: string;
  valueWeight?: '500' | '600' | '700';
}) {
  return (
    <View style={s.summaryRow}>
      <Text style={[s.summaryRowLabel, labelColor && { color: labelColor }]}>
        {label}
      </Text>
      <Text
        style={[
          s.summaryRowValue,
          valueColor && { color: valueColor },
          valueWeight && { fontWeight: valueWeight },
        ]}
      >
        {value}
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
  scroll: {},

  // Title block
  titleBlock: { paddingHorizontal: 56, paddingTop: 48, paddingBottom: 24, alignItems: 'center' },
  titleEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.55)',
    marginBottom: 10,
  },
  title: {
    fontSize: 44,
    fontWeight: '500',
    letterSpacing: -1,
    color: '#0E1117',
    fontFamily: fontFamily.serif,
    marginBottom: 12,
    textAlign: 'center',
  },
  titleSub: {
    fontSize: 16,
    color: 'rgba(60, 60, 67, 0.7)',
    maxWidth: 640,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Calculator wrapper
  calcWrap: { paddingHorizontal: 56, paddingTop: 24, paddingBottom: 48 },
  calcCard: {
    flexDirection: 'row',
    maxWidth: 1080,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    ...({ boxShadow: '0 20px 60px -30px rgba(0,0,0,0.12)' } as any),
  },
  inputsCol: { flex: 1.1, padding: 32, paddingHorizontal: 36 },
  summaryCol: {
    flex: 1,
    padding: 32,
    paddingHorizontal: 36,
    backgroundColor: '#FAFAF7',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(0,0,0,0.06)',
  },
  colEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.55)',
    marginBottom: 8,
  },
  colH3: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0E1117',
    letterSpacing: -0.3,
    marginBottom: 24,
  },

  // Checks
  checklist: { gap: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkRowText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.85)' },

  // Summary rows
  summaryRows: {
    flexDirection: 'column',
    gap: 10,
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.08)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  summaryRowLabel: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.85)' },
  summaryRowValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  totalRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: { fontSize: 14, color: 'rgba(60, 60, 67, 0.85)' },
  totalValue: {
    fontSize: 38,
    fontWeight: '600',
    color: '#0E1117',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  totalNote: {
    marginTop: 2,
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.55)',
    textAlign: 'right',
  },

  summaryCtaCol: { marginTop: 22, gap: 9 },
  primaryBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  ghostBtn: {
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  ghostBtnText: { color: '#0E1117', fontSize: 14, fontWeight: '500' },

  poCard: {
    marginTop: 22,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  poHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  poHeadText: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
  poBody: { marginTop: 5, fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16 },

  // Academic note
  academicNote: {
    paddingHorizontal: 56,
    paddingBottom: 72,
    maxWidth: 1080,
    width: '100%',
    alignSelf: 'center',
  },
  academicText: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.55)',
    lineHeight: 18,
    textAlign: 'center',
  },
  academicLink: { color: '#007AFF' },
});

const ss = StyleSheet.create({
  wrap: { marginBottom: 28 },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: 'rgba(60, 60, 67, 0.7)',
    textTransform: 'uppercase',
  },
  valueInput: {
    fontWeight: '600',
    color: '#0E1117',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    minWidth: 80,
    textAlign: 'right',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  barWrap: { height: 20, position: 'relative' },
  barTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 7,
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  knob: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    marginLeft: -10,
    ...({ boxShadow: '0 2px 6px rgba(0,0,0,0.12)' } as any),
  },
  stepRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  stepBtn: { flex: 1 },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  tickText: { fontSize: 11, color: 'rgba(60, 60, 67, 0.45)' },
});
