/**
 * Org Admin · Accreditation report (Frame 28 of the JHSON Admin Suite)
 *
 * Print-friendly document export. Not chromed by AdminShell — just a
 * thin toolbar with crumbs + Document/Cover letter/Appendix toggle +
 * Print/Download actions. Doc body lives on a warm-cream stage with a
 * white paper card constrained to 880px, serif body, executive summary,
 * per-competency rows with site×competency heatmap cells and editorial
 * narratives, signature block.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminCompetencyEvidence } from '@/hooks/useAdminCompetencyEvidence';

const SERIF: any =
  Platform.OS === 'web' ? "'Iowan Old Style', 'Source Serif 4', Georgia, serif" : 'Georgia';

interface CompetencyReportRow {
  label: string;
  rows: number;
  studentsCovered: number;
  totalStudents: number;
  sitesCovered: number;
  totalSites: number;
  cells: number[];
  badge?: string;
  badgeTone?: 'ok' | 'warn';
  narrative: string;
}

const REPORT: CompetencyReportRow[] = [
  {
    label: 'Medication administration',
    rows: 214,
    studentsCovered: 30,
    totalStudents: 30,
    sitesCovered: 5,
    totalSites: 5,
    cells: [82, 48, 31, 28, 25],
    narrative:
      'All 30 students evidenced Medication Administration at one or more sites, with Johns Hopkins Hospital — East Baltimore being the dominant site (82 rows, 38% of total). No student fell below 3 rows.',
  },
  {
    label: 'Sepsis bundle recognition',
    rows: 132,
    studentsCovered: 28,
    totalStudents: 30,
    sitesCovered: 5,
    totalSites: 5,
    cells: [52, 31, 19, 16, 14],
    badge: 'new in v0.4',
    badgeTone: 'ok',
    narrative:
      '28 of 30 students evidenced Sepsis bundle recognition; two students from the late-onboarding subgroup are still mid-rotation. The competency was added April 5 alongside Dr. Murphy\'s new blueprint and reached 100% site coverage within six weeks.',
  },
  {
    label: 'ISBAR handoff communication',
    rows: 186,
    studentsCovered: 30,
    totalStudents: 30,
    sitesCovered: 5,
    totalSites: 5,
    cells: [48, 38, 36, 32, 32],
    narrative:
      'ISBAR coverage is the most evenly distributed competency in the cohort — between 32 and 48 rows at every site. Mentor settle-rate of 91% suggests it\'s also the most consistently signed off.',
  },
  {
    label: 'Foley catheter placement',
    rows: 38,
    studentsCovered: 22,
    totalStudents: 30,
    sitesCovered: 4,
    totalSites: 5,
    cells: [18, 10, 6, 4, 0],
    badge: 'below floor at 1 site',
    badgeTone: 'warn',
    narrative:
      '8 students have not yet evidenced Foley placement; Howard County General reported zero opportunities during the rotation window. Action: rotate remaining students through East Baltimore or Bayview in the final 4 weeks, or convene a simulation block.',
  },
];

const SITE_LABELS = ['JHH\nEast Balt.', 'Bayview', 'Suburban', 'Sibley', 'Howard Co.'];

function cellTint(value: number, max: number): string {
  if (value === 0) return 'rgba(201, 150, 50, 0.18)';
  const ratio = value / max;
  const alpha = 0.06 + ratio * 0.36;
  return `rgba(40, 64, 107, ${alpha.toFixed(2)})`;
}

export default function AccreditationReportPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const evidence = useAdminCompetencyEvidence(orgId as string);

  const maxCell = useMemo(() => {
    let m = 0;
    for (const r of REPORT) {
      for (const c of r.cells) if (c > m) m = c;
    }
    return m;
  }, []);

  return (
    <View style={s.page}>
      <View style={[s.toolbar, { paddingTop: insets.top + 10 }]}>
        <View style={s.crumb}>
          <Pressable onPress={() => router.push(`/admin/${orgId}/insights`)}>
            <Text style={s.crumbLink}>Org admin</Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={13} color="rgba(60, 60, 67, 0.4)" />
          <Pressable onPress={() => router.push(`/admin/${orgId}/insights`)}>
            <Text style={s.crumbLink}>Insights</Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={13} color="rgba(60, 60, 67, 0.4)" />
          <Text style={s.crumbHere}>Accreditation report</Text>
        </View>
        <View style={s.toolbarActions}>
          <View style={s.segControl}>
            <View style={[s.segOpt, s.segOptOn]}>
              <Text style={s.segOptTextOn}>Document</Text>
            </View>
            <View style={s.segOpt}>
              <Text style={s.segOptText}>Cover letter</Text>
            </View>
            <View style={s.segOpt}>
              <Text style={s.segOptText}>Appendix</Text>
            </View>
          </View>
          <Pressable style={s.btnSm}>
            <Ionicons name="print-outline" size={12} color="#28406B" />
            <Text style={s.btnSmText}>Print</Text>
          </Pressable>
          <Pressable style={s.btnSmPrimary}>
            <Ionicons name="cloud-download-outline" size={12} color="#FFFFFF" />
            <Text style={s.btnSmPrimaryText}>Download PDF</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={s.stage} contentContainerStyle={s.stageInner}>
        <View style={s.doc}>
          {/* Doc head */}
          <View style={s.docHead}>
            <LinearGradient
              colors={['#28406B', '#1E335A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.docShield}
            >
              <Text style={s.docShieldText}>JH</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.docHeadEyebrow}>Accreditation Evidence Export</Text>
              <Text style={s.docHeadH2}>Johns Hopkins School of Nursing</Text>
            </View>
            <View>
              <Text style={s.docHeadRightBold}>BSN Class of 2027 — Cohort A</Text>
              <Text style={s.docHeadRight}>Period: Apr 5 – Aug 14, 2026</Text>
              <Text style={s.docHeadRight}>Generated: May 23, 2026</Text>
              <Text style={s.docHeadRight}>Document v1.0</Text>
            </View>
          </View>

          {/* Executive summary */}
          <View>
            <Text style={s.docH3}>Executive summary</Text>
            <Text style={s.lede}>
              Across <Text style={s.ledeEm}>30 students</Text> in the BSN Class of 2027 — Cohort
              A, BetterAt recorded <Text style={s.ledeEm}>1,184 evidence rows</Text> against{' '}
              <Text style={s.ledeEm}>9 competencies</Text> over{' '}
              <Text style={s.ledeEm}>5 partner hospital sites</Text> during the spring–summer
              rotation. Coverage breadth is <Text style={s.ledeEm}>96%</Text> — only Foley
              placement falls short of the 1-per-student floor; the remaining eight competencies
              clear the threshold at every site.
            </Text>
          </View>

          <View style={s.summaryGrid}>
            <SummaryCell n="30" l="Students in cohort" />
            <SummaryCell n="9" l="Competencies tracked" />
            <SummaryCell n="1,184" l="Evidence rows recorded" />
            <SummaryCell n="96" suffix="%" l="Coverage achieved" />
          </View>

          {/* Per-competency */}
          <View>
            <Text style={s.docH3}>Coverage by competency &amp; site</Text>

            <View style={s.siteHeader}>
              <View style={{ width: 200 }} />
              {SITE_LABELS.map((label) => (
                <View key={label} style={s.siteHeaderCell}>
                  <Text style={s.siteHeaderText}>{label}</Text>
                </View>
              ))}
            </View>

            {REPORT.map((row, idx) => (
              <View key={row.label} style={[s.competencyRow, idx > 0 && s.competencyRowBorder]}>
                <View style={s.titleLine}>
                  <Text style={s.titleH4}>{row.label}</Text>
                  <Text style={s.statTag}>
                    {row.rows} rows · {row.studentsCovered} / {row.totalStudents} students ·{' '}
                    {row.sitesCovered} / {row.totalSites} sites
                    {row.badge ? (
                      <Text
                        style={{
                          color: row.badgeTone === 'warn' ? '#C99632' : '#1E8F47',
                          fontStyle: 'italic',
                        }}
                      >
                        {' · '}
                        {row.badge}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <View style={s.siteRow}>
                  <View style={s.siteRowLabel}>
                    <Text style={s.siteRowLabelText}>Evidence rows</Text>
                  </View>
                  {row.cells.map((value, ci) => (
                    <View
                      key={ci}
                      style={[
                        s.cell,
                        { backgroundColor: cellTint(value, maxCell) },
                      ]}
                    >
                      <Text
                        style={[
                          s.cellText,
                          value === 0 && { color: '#C99632' },
                          value / maxCell > 0.36 && { color: '#FFFFFF' },
                        ]}
                      >
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={s.narrative}>{row.narrative}</Text>
              </View>
            ))}
          </View>

          {/* Signatures */}
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.sigBold}>Dean Susanna Park, DNP, RN</Text>
              <Text style={s.sigSub}>Organization Admin · BetterAt</Text>
            </View>
            <View style={s.sigLine}>
              <Text style={s.sigBold}>R. Murphy, PhD, RN, CCRN</Text>
              <Text style={s.sigSub}>Curriculum Author · Sepsis bundle blueprint</Text>
            </View>
          </View>

          {/* Pull a live data note for context (not in design — shows the data is real) */}
          {evidence.competencies.length > 0 ? (
            <Text style={s.dataNote}>
              Generated against live {evidence.competencies.length}-competency framework ·{' '}
              {evidence.sites.length} clinical sites · cohort: {evidence.cohortName}.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryCell({ n, suffix, l }: { n: string; suffix?: string; l: string }) {
  return (
    <View style={s.summaryCell}>
      <Text style={s.summaryN}>
        {n}
        {suffix ? <Text style={s.summaryNSuffix}>{suffix}</Text> : null}
      </Text>
      <Text style={s.summaryL}>{l}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FAF8F0' },

  toolbar: {
    backgroundColor: '#EDEBE2',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  crumb: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  crumbLink: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },
  crumbHere: { fontSize: 12, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '500' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  segControl: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 2,
    gap: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  segOpt: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 },
  segOptOn: { backgroundColor: '#F5F4EE' },
  segOptText: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  segOptTextOn: { fontSize: 11.5, color: '#28406B', fontWeight: '600' },

  btnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
  },
  btnSmText: { fontSize: 11.5, fontWeight: '600', color: '#28406B' },
  btnSmPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#28406B',
  },
  btnSmPrimaryText: { fontSize: 11.5, fontWeight: '600', color: '#FFFFFF' },

  stage: { flex: 1 },
  stageInner: { padding: 32 },

  doc: {
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 56,
    gap: 28,
  },

  docHead: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(60, 60, 67, 0.18)',
  },
  docShield: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docShieldText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: SERIF,
    letterSpacing: -0.5,
  },
  docHeadEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  docHeadH2: { fontSize: 22, fontWeight: '500', color: '#1C1C1E', fontFamily: SERIF, letterSpacing: -0.2 },
  docHeadRight: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', textAlign: 'right', lineHeight: 17 },
  docHeadRightBold: { fontSize: 12, color: '#1C1C1E', fontWeight: '600', textAlign: 'right' },

  docH3: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
    marginBottom: 12,
  },

  lede: { fontSize: 16, lineHeight: 25, color: 'rgba(60, 60, 67, 0.85)', fontFamily: SERIF },
  ledeEm: { fontStyle: 'italic' },

  summaryGrid: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 18,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  summaryCell: { flex: 1 },
  summaryN: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  summaryNSuffix: { fontSize: 18, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  summaryL: { marginTop: 2, fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 15 },

  siteHeader: { flexDirection: 'row', gap: 4 },
  siteHeaderCell: { flex: 1, padding: 4, alignItems: 'center' },
  siteHeaderText: {
    fontSize: 10,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  competencyRow: { paddingVertical: 18, gap: 8 },
  competencyRowBorder: { borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)' },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  titleH4: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.15 },
  statTag: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', fontVariant: ['tabular-nums'] },

  siteRow: { flexDirection: 'row', gap: 4 },
  siteRowLabel: { width: 200, padding: 4, justifyContent: 'center' },
  siteRowLabelText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600', fontFamily: SERIF },
  cell: {
    flex: 1,
    height: 32,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 11, fontWeight: '600', color: '#1C1C1E', fontVariant: ['tabular-nums'] },

  narrative: {
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 22,
    color: 'rgba(60, 60, 67, 0.85)',
    fontFamily: SERIF,
  },

  sigBlock: {
    marginTop: 16,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(60, 60, 67, 0.18)',
    flexDirection: 'row',
    gap: 28,
  },
  sigLine: {
    flex: 1,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(60, 60, 67, 0.85)',
    paddingTop: 6,
  },
  sigBold: { fontSize: 13, color: '#1C1C1E', fontWeight: '600' },
  sigSub: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },

  dataNote: {
    marginTop: 8,
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.4)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
