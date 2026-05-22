/**
 * betterat.com/schools/start-pilot — Frame 11 of the institutions pass.
 *
 * 4-step progress (Your school · Verify domain · Plan & billing · Open admin).
 * Today renders the Verify-domain step (active step #2). Domain entry,
 * additional-domain chips, two verification methods (DNS TXT default,
 * email IT admin alternate), pilot summary card on the right.
 *
 * "Verify & continue →" submission stubbed — real handler lands when the
 * org-creation + DNS verify backend wires up.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MktNav } from '@/components/marketing/MktNav';
import { Footer } from './index';

type Step = 'school' | 'verify' | 'plan' | 'open';
type VerifyMethod = 'dns' | 'email';

const STEPS: { key: Step; label: string }[] = [
  { key: 'school', label: 'Your school' },
  { key: 'verify', label: 'Verify domain' },
  { key: 'plan', label: 'Plan & billing' },
  { key: 'open', label: 'Open admin' },
];

const VERIFY_TOKEN = 'betterat-verify=ax3p7c92qz';

export default function SchoolsStartPilotPage() {
  const router = useRouter();
  const [primaryDomain, setPrimaryDomain] = useState('jh.edu');
  const [extraDomains, setExtraDomains] = useState<string[]>(['jhmi.edu', 'jhu.edu']);
  const [domainDraft, setDomainDraft] = useState('');
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>('dns');
  const activeStepIdx = 1; // verify

  function addDomain() {
    const trimmed = domainDraft.trim().replace(/^@/, '');
    if (!trimmed) return;
    if (extraDomains.includes(trimmed) || trimmed === primaryDomain) {
      setDomainDraft('');
      return;
    }
    setExtraDomains((prev) => [...prev, trimmed]);
    setDomainDraft('');
  }

  function removeDomain(d: string) {
    setExtraDomains((prev) => prev.filter((x) => x !== d));
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <MktNav active="schools" showBookDemo={false} />

        <View style={s.contentWrap}>
          {/* Progress steps */}
          <View style={s.progressRow}>
            {STEPS.map((step, i) => {
              const done = i < activeStepIdx;
              const active = i === activeStepIdx;
              return (
                <React.Fragment key={step.key}>
                  <View style={s.stepRow}>
                    <View
                      style={[
                        s.stepCircle,
                        done && s.stepCircleDone,
                        active && s.stepCircleActive,
                        !done && !active && s.stepCircleIdle,
                      ]}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      ) : (
                        <Text
                          style={[
                            s.stepCircleText,
                            active ? s.stepCircleTextActive : s.stepCircleTextIdle,
                          ]}
                        >
                          {i + 1}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        s.stepLabel,
                        active && s.stepLabelActive,
                        done && s.stepLabelDone,
                      ]}
                    >
                      {i + 1} · {step.label}
                    </Text>
                  </View>
                  {i < STEPS.length - 1 ? <View style={s.stepLine} /> : null}
                </React.Fragment>
              );
            })}
          </View>

          <View style={s.bodyRow}>
            {/* Left: form */}
            <View style={s.formCol}>
              <Text style={s.h1}>Verify your school's domain</Text>
              <Text style={s.h1Sub}>
                When a student or faculty signs in with an email at this domain,
                they'll be added to your Hopkins workspace automatically. You stay
                in control of who counts as a seat.
              </Text>

              {/* Primary domain entry */}
              <Text style={s.label}>Your school's email domain</Text>
              <View style={s.domainInput}>
                <Text style={s.domainAt}>@</Text>
                <TextInput
                  value={primaryDomain}
                  onChangeText={setPrimaryDomain}
                  style={s.domainText}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Ionicons name="checkmark" size={18} color="#1E8F47" />
              </View>
              <View style={s.domainStatusRow}>
                <Ionicons name="checkmark-circle" size={13} color="#1E8F47" />
                <Text style={s.domainStatusText}>
                  Domain available · MX records match Microsoft 365 · Hopkins.
                </Text>
              </View>

              {/* Additional domains */}
              <Text style={[s.label, { marginTop: 22 }]}>Add more domains</Text>
              <View style={s.chipRow}>
                {extraDomains.map((d) => (
                  <View key={d} style={s.domainChip}>
                    <Text style={s.domainChipText}>@{d}</Text>
                    <Pressable onPress={() => removeDomain(d)} hitSlop={6}>
                      <Ionicons name="close" size={11} color="rgba(60, 60, 67, 0.4)" />
                    </Pressable>
                  </View>
                ))}
                <View style={s.addDomain}>
                  <Ionicons name="add" size={12} color="#007AFF" />
                  <TextInput
                    value={domainDraft}
                    onChangeText={setDomainDraft}
                    onSubmitEditing={addDomain}
                    onBlur={addDomain}
                    placeholder="Add"
                    placeholderTextColor="#007AFF"
                    style={s.addDomainInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Verification method */}
              <View style={s.verifyBlock}>
                <Text style={s.verifyHead}>Prove you own {primaryDomain}</Text>
                <View style={s.verifyRow}>
                  <Pressable
                    style={[
                      s.verifyCard,
                      verifyMethod === 'dns' && s.verifyCardOn,
                    ]}
                    onPress={() => setVerifyMethod('dns')}
                  >
                    <View style={s.verifyCardHead}>
                      {verifyMethod === 'dns' ? (
                        <Ionicons name="checkmark-circle" size={14} color="#007AFF" />
                      ) : null}
                      <Text
                        style={[
                          s.verifyCardTitle,
                          verifyMethod === 'dns' && s.verifyCardTitleOn,
                        ]}
                      >
                        Add DNS TXT record
                      </Text>
                    </View>
                    <Text style={s.verifyCardBody}>
                      Add a one-line TXT record. Verifies in 2–5 minutes.
                    </Text>
                    <View style={s.codeBox}>
                      <Text style={s.codeText} numberOfLines={1}>
                        {VERIFY_TOKEN}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[
                      s.verifyCard,
                      verifyMethod === 'email' && s.verifyCardOn,
                    ]}
                    onPress={() => setVerifyMethod('email')}
                  >
                    <View style={s.verifyCardHead}>
                      {verifyMethod === 'email' ? (
                        <Ionicons name="checkmark-circle" size={14} color="#007AFF" />
                      ) : null}
                      <Text
                        style={[
                          s.verifyCardTitle,
                          verifyMethod === 'email' && s.verifyCardTitleOn,
                        ]}
                      >
                        Email an IT admin
                      </Text>
                    </View>
                    <Text style={s.verifyCardBody}>
                      We'll email{' '}
                      <Text style={s.verifyCardBodyEm}>postmaster@{primaryDomain}</Text>{' '}
                      to confirm — slower, no DNS needed.
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Footer actions */}
              <View style={s.actions}>
                <Pressable style={s.backBtn} onPress={() => router.back()}>
                  <Text style={s.backBtnText}>← Back</Text>
                </Pressable>
                <Pressable style={s.continueBtn}>
                  <Text style={s.continueBtnText}>Verify & continue →</Text>
                </Pressable>
                <Text style={s.skipText}>Skip — verify after first invoice</Text>
              </View>
            </View>

            {/* Right: pilot summary */}
            <View style={s.summaryCol}>
              <Text style={s.summaryEyebrow}>Pilot summary</Text>
              <Text style={s.summaryTitle}>Johns Hopkins University · MSN</Text>
              <View style={s.summaryRows}>
                <SummaryRow label="School" value="Johns Hopkins · MSN" />
                <SummaryRow label="Plan" value="Institutional · annual" />
                <SummaryRow label="Seats reserved" value="350 students · 12 authors" />
                <SummaryRow label="Trial duration" value="30 days · no card" />
                <SummaryRow label="First invoice" value="Sept 19, 2026" />
              </View>
              <View style={s.dueRow}>
                <Text style={s.dueLabel}>Due today</Text>
                <Text style={s.dueValue}>$0.00</Text>
              </View>
              <Text style={s.thenNote}>Then $34,736 / year if you convert</Text>

              <View style={s.complianceCard}>
                <View style={s.complianceHead}>
                  <Ionicons name="shield-half" size={13} color="#1E8F47" />
                  <Text style={s.complianceHeadText}>BAA, SOC 2 Type II, FERPA</Text>
                </View>
                <Text style={s.complianceBody}>
                  All compliance documents are countersigned during pilot setup —
                  no separate negotiation.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Footer />
      </ScrollView>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryRowLabel}>{label}</Text>
      <Text style={s.summaryRowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
  scroll: {},

  contentWrap: {
    paddingHorizontal: 56,
    paddingTop: 40,
    paddingBottom: 48,
    maxWidth: 1140,
    width: '100%',
    alignSelf: 'center',
  },

  // Progress steps
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 36, flexWrap: 'wrap' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: '#1E8F47' },
  stepCircleActive: { backgroundColor: '#007AFF' },
  stepCircleIdle: { backgroundColor: '#E5E5EA' },
  stepCircleText: { fontSize: 11, fontWeight: '700' },
  stepCircleTextActive: { color: '#FFFFFF' },
  stepCircleTextIdle: { color: 'rgba(60, 60, 67, 0.6)' },
  stepLabel: { fontSize: 12.5, fontWeight: '500', color: 'rgba(60, 60, 67, 0.6)' },
  stepLabelActive: { color: '#1C1C1E', fontWeight: '600' },
  stepLabelDone: { color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600' },
  stepLine: { height: 1, width: 36, backgroundColor: 'rgba(0,0,0,0.12)', marginHorizontal: 12 },

  // Body grid
  bodyRow: { flexDirection: 'row', gap: 40 },
  formCol: { flex: 1.3 },
  summaryCol: {
    flex: 1,
    padding: 24,
    paddingHorizontal: 26,
    backgroundColor: '#FAFAF7',
    borderRadius: 14,
    alignSelf: 'flex-start',
  },

  // Form
  h1: {
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: '#0E1117',
    marginBottom: 8,
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
  },
  h1Sub: {
    fontSize: 15,
    color: 'rgba(60, 60, 67, 0.7)',
    lineHeight: 23,
    maxWidth: 540,
    marginBottom: 28,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.55)',
    marginBottom: 8,
  },
  domainInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 10,
    maxWidth: 420,
  },
  domainAt: { fontSize: 16, color: 'rgba(60, 60, 67, 0.5)' },
  domainText: {
    flex: 1,
    fontSize: 16,
    color: '#0E1117',
    fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  domainStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  domainStatusText: { fontSize: 12, color: '#1E8F47' },

  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  domainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: '#EFEFF4',
    borderRadius: 7,
  },
  domainChipText: {
    fontSize: 13,
    color: '#1C1C1E',
    fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
  },
  addDomain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderStyle: 'dashed',
    borderRadius: 7,
  },
  addDomainInput: {
    fontSize: 13,
    color: '#007AFF',
    minWidth: 50,
    fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  verifyBlock: {
    marginTop: 28,
    padding: 18,
    backgroundColor: '#FAFAF7',
    borderRadius: 12,
  },
  verifyHead: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0E1117',
    letterSpacing: -0.1,
    marginBottom: 12,
  },
  verifyRow: { flexDirection: 'row', gap: 10 },
  verifyCard: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    backgroundColor: '#FFFFFF',
  },
  verifyCardOn: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
  },
  verifyCardHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifyCardTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  verifyCardTitleOn: { color: '#007AFF' },
  verifyCardBody: {
    marginTop: 4,
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 16,
  },
  verifyCardBodyEm: { fontStyle: 'italic' },
  codeBox: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    color: '#0E1117',
    fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
  },

  // Footer actions
  actions: { marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 10,
  },
  backBtnText: { fontSize: 14, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },
  continueBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  continueBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  skipText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.55)', marginLeft: 12 },

  // Summary
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.55)',
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0E1117',
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  summaryRows: {
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.08)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryRowLabel: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)' },
  summaryRowValue: { fontSize: 12.5, fontWeight: '500', color: '#1C1C1E' },

  dueRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  dueLabel: { fontSize: 13, color: 'rgba(60, 60, 67, 0.85)' },
  dueValue: { fontSize: 26, fontWeight: '600', color: '#0E1117', letterSpacing: -0.5 },
  thenNote: {
    marginTop: 4,
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.55)',
    textAlign: 'right',
  },

  complianceCard: {
    marginTop: 18,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  complianceHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  complianceHeadText: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
  complianceBody: {
    marginTop: 5,
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 16,
  },
});
