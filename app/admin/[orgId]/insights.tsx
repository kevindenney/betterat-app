/**
 * Org Admin · Insights — competency × site evidence grid.
 *
 * The dean's killer view. "Show me where IV insertion is being evidenced
 * across my MSN program." Renders a competency-row × site-column heatmap
 * with each cell showing N / cohortSize coverage. Row totals on the right
 * surface overall competency coverage; column totals on the bottom
 * surface per-site evidence density.
 *
 * Today data is computed deterministically from real cohort size + real
 * curated sites + a stubbed competency list. When competencies + step
 * reflections are properly wired, useAdminCompetencyEvidence swaps to a
 * real RPC without changing this page.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  useAdminCompetencyEvidence,
  Competency,
  SiteSummary,
  EvidenceCell,
} from '@/hooks/useAdminCompetencyEvidence';
import { InsightsMapView } from '@/components/admin/InsightsMapView';
import { ManageCompetenciesSheet } from '@/components/admin/ManageCompetenciesSheet';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { useAdminCohorts } from '@/hooks/useAdminCohorts';
import { useAdminOrgVocab } from '@/hooks/useAdminOrgVocab';
import {
  StudioHeader,
  StudioButton,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';

type InsightsView = 'grid' | 'map';

export default function AdminInsightsPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const data = useAdminCompetencyEvidence(orgId as string, selectedCohortId);
  const cohorts = useAdminCohorts(orgId as string);
  const av = useAdminOrgVocab(orgId as string);
  const menu = useProfileMenuData();
  const [view, setView] = useState<InsightsView>('grid');
  const [manageOpen, setManageOpen] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;
  const activeOrg = menu.memberships.find((m) => m.org_id === orgId) ?? menu.activeOrg;
  const orgShortName = activeOrg ? shortNameFor(activeOrg.org_name) : 'Your org';

  return (
    <AdminShell activeKey="insights">
      <StudioHeader
        crumbs={['Admin', 'Insights']}
        title="Competency evidence"
        subtitleParts={[
          <View key="cohort" style={s.pillWrap}>
            <View style={s.pill}>
              <Text style={s.pillText}>{data.cohortName}</Text>
            </View>
          </View>,
          <Text key="meta" style={s.subText}>
            {data.cohortSize} {av.members} · {data.competencies.length} competencies ·{' '}
            {data.sites.length} {av.Sites.toLowerCase()}
          </Text>,
        ]}
        actions={
          <>
            <View style={s.viewToggle}>
              <Pressable
                onPress={() => setView('grid')}
                style={[s.viewBtn, view === 'grid' && s.viewBtnActive]}
              >
                <Ionicons
                  name="grid-outline"
                  size={13}
                  color={view === 'grid' ? '#FFFFFF' : 'rgba(60, 60, 67, 0.85)'}
                />
                <Text style={[s.viewBtnText, view === 'grid' && s.viewBtnTextActive]}>
                  Grid
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setView('map')}
                style={[s.viewBtn, view === 'map' && s.viewBtnActive]}
              >
                <Ionicons
                  name="map-outline"
                  size={13}
                  color={view === 'map' ? '#FFFFFF' : 'rgba(60, 60, 67, 0.85)'}
                />
                <Text style={[s.viewBtnText, view === 'map' && s.viewBtnTextActive]}>
                  Map
                </Text>
              </Pressable>
            </View>
            <StudioButton
              variant="ghost"
              icon="construct-outline"
              label="Manage competencies"
              onPress={() => setManageOpen(true)}
            />
            <StudioButton variant="ghost" icon="download-outline" label="Export · CSV" />
            <StudioButton
              variant="primary"
              accent="navy"
              icon="document-text-outline"
              label="Accreditation report"
              onPress={() => router.push(`/admin/${orgId}/accreditation`)}
            />
          </>
        }
      />

      <View style={s.lede}>
        <Ionicons name="bulb" size={16} color="#28406B" />
        <Text style={s.ledeText}>
          {view === 'grid' ? (
            <>
              The constellation across {av.Sites.toLowerCase()}. Each cell shows{' '}
              <Text style={s.ledeStrong}>how many {av.members}</Text> have
              evidenced this competency at this {av.Site.toLowerCase()}. Click a
              cell to see the underlying steps + reflections.
            </>
          ) : (
            <>
              Geographic view of the same data. Marker size + intensity reflect
              evidence density at the {av.Site.toLowerCase()}. Filter by a single
              competency to ask{' '}
              <Text style={s.ledeStrong}>where</Text> the program is doing best.
            </>
          )}
        </Text>
      </View>

      {cohorts.cohorts.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.cohortFilter}
          contentContainerStyle={s.cohortFilterInner}
        >
          <CohortChip
            label={`All ${av.Cohorts.toLowerCase()}`}
            active={selectedCohortId === null}
            onPress={() => setSelectedCohortId(null)}
          />
          {cohorts.cohorts.map((c) => (
            <CohortChip
              key={c.id}
              label={c.name}
              active={selectedCohortId === c.id}
              onPress={() => setSelectedCohortId(c.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {data.loading ? (
        <Text style={s.loading}>Loading evidence…</Text>
      ) : data.sites.length === 0 || data.competencies.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="pie-chart-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
          <Text style={s.emptyTitle}>Not enough data to plot</Text>
          <Text style={s.emptyBody}>
            Insights needs at least one curated {av.Site.toLowerCase()} + one{' '}
            {av.Cohort.toLowerCase()}. Visit{' '}
            <Text style={s.emptyMono}>{av.Sites}</Text> and{' '}
            <Text style={s.emptyMono}>{av.Cohorts}</Text> to seed those first.
          </Text>
        </View>
      ) : view === 'map' ? (
        <InsightsMapView
          cohortSize={data.cohortSize}
          sites={data.sites}
          competencies={data.competencies}
          evidence={data.evidence}
          colTotals={data.colTotals}
          sitesGeo={data.sitesGeo}
        />
      ) : compact ? (
        <EvidenceList data={data} cohortNoun={av.members} />
      ) : (
        <ScrollView style={s.scroll} horizontal>
          <View>
            <EvidenceGrid data={data} siteNoun={av.Site} />
          </View>
        </ScrollView>
      )}

      {/* Legend — only on grid view; map has its own legend block */}
      {data.sites.length > 0 && view === 'grid' ? (
        <View style={s.legend}>
          <Text style={s.legendLabel}>Coverage</Text>
          <View style={s.legendScale}>
            {[0.0, 0.15, 0.3, 0.5, 0.7, 0.9, 1.0].map((v, i) => (
              <View
                key={i}
                style={[s.legendSwatch, { backgroundColor: intensityToColor(v) }]}
              />
            ))}
          </View>
          <Text style={s.legendCaption}>
            None — fewer than 10% — to all {data.cohortSize}
          </Text>
        </View>
      ) : null}

      <ManageCompetenciesSheet
        visible={manageOpen}
        orgId={orgId as string}
        orgShortName={orgShortName}
        onClose={() => setManageOpen(false)}
      />
    </AdminShell>
  );
}

function CohortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function shortNameFor(orgName: string): string {
  if (orgName.includes(' · ')) return orgName.split(' · ').slice(0, 2).join(' ');
  const tokens = orgName.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return orgName;
  return tokens.map((t) => t[0]).join('').toUpperCase();
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

const COL_WIDTH = 96;
const ROW_HEIGHT = 44;
const ROW_LABEL_WIDTH = 220;
const TOTAL_COL_WIDTH = 84;

function EvidenceGrid({
  data,
  siteNoun,
}: {
  data: ReturnType<typeof useAdminCompetencyEvidence>;
  siteNoun: string;
}) {
  return (
    <View style={g.wrap}>
      {/* Column headers (site names) */}
      <View style={g.headerRow}>
        <View style={[g.cell, { width: ROW_LABEL_WIDTH }]} />
        {data.sites.map((site) => (
          <View key={site.id} style={[g.cell, g.headerCell, { width: COL_WIDTH }]}>
            <Text style={g.headerText} numberOfLines={2}>
              {site.short}
            </Text>
            <Text style={g.headerKind}>{prettyKind(site.kind)}</Text>
          </View>
        ))}
        <View style={[g.cell, g.headerCell, { width: TOTAL_COL_WIDTH }]}>
          <Text style={g.headerTotal}>Coverage</Text>
        </View>
      </View>

      {/* Competency rows */}
      {data.competencies.map((c) => (
        <CompetencyRow
          key={c.id}
          competency={c}
          sites={data.sites}
          evidence={data.evidence}
          rowTotal={data.rowTotals.get(c.id) ?? { count: 0, pct: 0 }}
          cohortSize={data.cohortSize}
        />
      ))}

      {/* Column totals (site activity density) */}
      <View style={g.totalsRow}>
        <View style={[g.cell, { width: ROW_LABEL_WIDTH }]}>
          <Text style={g.totalsLabel}>{siteNoun} activity</Text>
        </View>
        {data.sites.map((site) => {
          const t = data.colTotals.get(site.id) ?? { count: 0, pct: 0 };
          return (
            <View key={site.id} style={[g.cell, g.totalCell, { width: COL_WIDTH }]}>
              <View
                style={[
                  g.totalBar,
                  {
                    width: `${Math.round(t.pct * 100)}%`,
                    backgroundColor: 'rgba(40, 64, 107, 0.4)',
                  },
                ]}
              />
              <Text style={g.totalCount}>{t.count}</Text>
            </View>
          );
        })}
        <View style={[g.cell, { width: TOTAL_COL_WIDTH }]} />
      </View>
    </View>
  );
}

function CompetencyRow({
  competency,
  sites,
  evidence,
  rowTotal,
  cohortSize,
}: {
  competency: Competency;
  sites: SiteSummary[];
  evidence: Map<string, EvidenceCell>;
  rowTotal: { count: number; pct: number };
  cohortSize: number;
}) {
  return (
    <View style={g.row}>
      <View style={[g.cell, g.rowLabel, { width: ROW_LABEL_WIDTH }]}>
        <Text style={g.rowLabelCat}>{competency.category.toUpperCase()}</Text>
        <Text style={g.rowLabelText}>{competency.label}</Text>
      </View>
      {sites.map((site) => {
        const cell = evidence.get(`${competency.id}::${site.id}`);
        const count = cell?.count ?? 0;
        const intensity = cell?.intensity ?? 0;
        return (
          <View
            key={site.id}
            style={[
              g.cell,
              g.dataCell,
              { width: COL_WIDTH, backgroundColor: intensityToColor(intensity) },
            ]}
          >
            <Text style={[g.dataCount, intensity > 0.5 && g.dataCountInverted]}>
              {count}
            </Text>
            <Text style={[g.dataPct, intensity > 0.5 && g.dataPctInverted]}>
              {cohortSize > 0 ? `${Math.round(intensity * 100)}%` : '—'}
            </Text>
          </View>
        );
      })}
      <View style={[g.cell, g.rowTotalCell, { width: TOTAL_COL_WIDTH }]}>
        <Text style={g.rowTotalCount}>
          {rowTotal.count}
          <Text style={g.rowTotalOf}>/{cohortSize}</Text>
        </Text>
        <Text style={g.rowTotalPct}>{Math.round(rowTotal.pct * 100)}%</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Compact list (phone) — competency rows with an inline coverage-breadth bar.
// The bar encodes rowTotal.pct = students-covered / cohort-size, the same
// "coverage breadth" figure the accreditation report shows. Tap a row to
// expand the per-site breakdown, which keeps the heatmap's intensity colors.
// ---------------------------------------------------------------------------

function EvidenceList({
  data,
  cohortNoun,
}: {
  data: ReturnType<typeof useAdminCompetencyEvidence>;
  cohortNoun: string;
}) {
  return (
    <ScrollView style={s.scroll}>
      <View style={l.wrap}>
        {data.competencies.map((c) => (
          <CompetencyListRow
            key={c.id}
            competency={c}
            sites={data.sites}
            evidence={data.evidence}
            rowTotal={data.rowTotals.get(c.id) ?? { count: 0, pct: 0 }}
            cohortSize={data.cohortSize}
            cohortNoun={cohortNoun}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function CompetencyListRow({
  competency,
  sites,
  evidence,
  rowTotal,
  cohortSize,
  cohortNoun,
}: {
  competency: Competency;
  sites: SiteSummary[];
  evidence: Map<string, EvidenceCell>;
  rowTotal: { count: number; pct: number };
  cohortSize: number;
  cohortNoun: string;
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(rowTotal.pct * 100);
  return (
    <View style={l.row}>
      <Pressable
        style={l.header}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${competency.label}, ${pct}% coverage. Tap for per-site breakdown.`}
      >
        <View style={l.headTop}>
          <View style={l.headText}>
            <Text style={l.cat}>{competency.category.toUpperCase()}</Text>
            <Text style={l.label} numberOfLines={2}>
              {competency.label}
            </Text>
          </View>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="rgba(60, 60, 67, 0.4)"
          />
        </View>
        <View style={l.barRow}>
          <View style={l.barTrack}>
            <View
              style={[
                l.barFill,
                { width: `${pct}%`, backgroundColor: intensityToColor(rowTotal.pct) },
              ]}
            />
          </View>
          <Text style={l.barLabel}>
            {rowTotal.count} / {cohortSize} {cohortNoun} ·{' '}
            {cohortSize > 0 ? `${pct}%` : '—'}
          </Text>
        </View>
      </Pressable>
      {open ? (
        <View style={l.sites}>
          {sites.map((site) => {
            const cell = evidence.get(`${competency.id}::${site.id}`);
            const count = cell?.count ?? 0;
            const intensity = cell?.intensity ?? 0;
            return (
              <View key={site.id} style={l.siteRow}>
                <View
                  style={[l.swatch, { backgroundColor: intensityToColor(intensity) }]}
                />
                <View style={l.siteText}>
                  <Text style={l.siteName} numberOfLines={1}>
                    {site.short}
                  </Text>
                  <Text style={l.siteKind}>{prettyKind(site.kind)}</Text>
                </View>
                <Text style={l.siteStat}>
                  {count} · {cohortSize > 0 ? `${Math.round(intensity * 100)}%` : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function intensityToColor(v: number): string {
  // 0 → very light wash, 1 → navy. Steps through a warm-navy ramp.
  if (v <= 0) return '#F4F4F0';
  if (v < 0.15) return 'rgba(40, 64, 107, 0.08)';
  if (v < 0.3) return 'rgba(40, 64, 107, 0.18)';
  if (v < 0.5) return 'rgba(40, 64, 107, 0.32)';
  if (v < 0.7) return 'rgba(40, 64, 107, 0.5)';
  if (v < 0.9) return 'rgba(40, 64, 107, 0.7)';
  return '#28406B';
}

function prettyKind(kind: string): string {
  if (kind === 'hospital') return 'Hospital';
  if (kind === 'racing_area') return 'Racing';
  if (kind === 'course') return 'Course';
  return kind.replace(/_/g, ' ');
}

const s = StyleSheet.create({
  pillWrap: {},
  pill: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 64, 107, 0.12)',
  },
  pillText: { fontSize: 11, fontWeight: '600', color: '#28406B' },
  subText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.6)' },

  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: 8,
    padding: 2,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewBtnActive: {
    backgroundColor: '#28406B',
  },
  viewBtnText: { fontSize: 12, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },
  viewBtnTextActive: { color: '#FFFFFF', fontWeight: '600' },

  lede: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(40, 64, 107, 0.06)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#28406B',
    marginBottom: 16,
  },
  ledeText: { flex: 1, fontSize: 13, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  ledeStrong: { color: '#1C1C1E', fontWeight: '600' },

  cohortFilter: { flexGrow: 0, marginBottom: 14 },
  cohortFilterInner: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    maxWidth: 240,
  },
  chipActive: { backgroundColor: '#28406B', borderColor: '#28406B' },
  chipText: { fontSize: 12.5, fontWeight: '600', color: 'rgba(60, 60, 67, 0.85)' },
  chipTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  loading: { textAlign: 'center', paddingVertical: 32, color: 'rgba(60, 60, 67, 0.6)' },

  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 8 },
  emptyBody: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 440,
    lineHeight: 18,
  },
  emptyMono: {
    fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
    fontSize: 11.5,
    color: '#1C1C1E',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 4,
    borderRadius: 3,
  },

  legend: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    alignSelf: 'flex-start',
  },
  legendLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
  },
  legendScale: { flexDirection: 'row', gap: 2 },
  legendSwatch: { width: 22, height: 16, borderRadius: 3 },
  legendCaption: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
});

const g = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FAFAF7',
  },
  cell: {
    height: ROW_HEIGHT,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  headerCell: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 0.5,
    borderLeftColor: '#E5E5EA',
  },
  headerText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    letterSpacing: -0.05,
  },
  headerKind: {
    marginTop: 2,
    fontSize: 9.5,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  headerTotal: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  rowLabel: {
    paddingHorizontal: 14,
    backgroundColor: '#FAFAF7',
    justifyContent: 'center',
  },
  rowLabelCat: {
    fontSize: 9.5,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  rowLabelText: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.05,
  },
  dataCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(0,0,0,0.04)',
  },
  dataCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
  },
  dataCountInverted: { color: '#FFFFFF' },
  dataPct: {
    fontSize: 10,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '500',
  },
  dataPctInverted: { color: 'rgba(255,255,255,0.85)' },
  rowTotalCell: {
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 0.5,
    borderLeftColor: '#E5E5EA',
  },
  rowTotalCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
  },
  rowTotalOf: { fontWeight: '500', color: 'rgba(60, 60, 67, 0.6)' },
  rowTotalPct: {
    fontSize: 10.5,
    color: '#28406B',
    fontWeight: '600',
  },
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: '#FAFAF7',
  },
  totalsLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  totalCell: {
    height: 28,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderLeftWidth: 0.5,
    borderLeftColor: '#E5E5EA',
    position: 'relative',
  },
  totalBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 0,
  },
  totalCount: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    zIndex: 1,
  },
});

// Phone (compact) competency list: one card per competency with an inline
// coverage-breadth bar, tap to expand the per-site breakdown.
const l = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  row: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  headTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  cat: {
    fontSize: 9.5,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  label: {
    marginTop: 2,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.1,
  },
  barRow: {
    gap: 5,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F2F2F0',
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.7)',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  sites: {
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FAFAF7',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  siteText: {
    flex: 1,
    minWidth: 0,
  },
  siteName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  siteKind: {
    marginTop: 1,
    fontSize: 10.5,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  siteStat: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.8)',
    fontVariant: ['tabular-nums'],
  },
});
