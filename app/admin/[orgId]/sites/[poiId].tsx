/**
 * Org Admin · Site detail
 *
 * Drilled into from the Sites list. Hero with the real atlas_pois row
 * (name, kind, coords, claim badges); 4-stat strip, top-competency bars,
 * people roster, and recent practice feed all come from the
 * admin_site_activity RPC — confirmed step_capability_evidence and
 * timeline_steps located at this POI via step_location.poi_id.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  StudioHeader,
  StudioButton,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { StatRow } from '@/components/studio/StatRow';
import {
  useAdminSiteActivity,
  SiteRecentRow,
  SiteRosterRow,
} from '@/hooks/useAdminSiteActivity';
import { EditSiteSheet } from '@/components/admin/EditSiteSheet';

const AVI_TONES = ['#28406B', '#6E8B5A', '#5A6B8B', '#7A5A8B', '#B8855A', '#8B5A3C'];

function aviTone(index: number) {
  return { backgroundColor: AVI_TONES[index % AVI_TONES.length] };
}

function prettyKind(kind: string): string {
  switch (kind) {
    case 'sim_lab':
      return 'Sim lab';
    case 'racing_area':
      return 'Racing area';
    case 'club':
      return 'Club';
    case 'hospital':
      return 'Hospital';
    case 'course':
      return 'Course';
    case 'market':
      return 'Market';
    default:
      return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function kindIcon(kind: string): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'club':
      return 'boat-outline';
    case 'racing_area':
      return 'water-outline';
    case 'hospital':
      return 'medkit-outline';
    case 'sim_lab':
      return 'school-outline';
    case 'course':
      return 'golf-outline';
    case 'market':
      return 'storefront-outline';
    default:
      return 'location-outline';
  }
}

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusVerb(status: string): string {
  switch (status) {
    case 'settled':
      return 'settled';
    case 'completed':
      return 'completed';
    case 'in_progress':
      return 'is working on';
    default:
      return 'planned';
  }
}

export default function AdminSiteDetailPage() {
  const { orgId, poiId } = useLocalSearchParams<{ orgId: string; poiId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = FEATURE_FLAGS.ADMIN_PHONE_PARITY && width < STUDIO_COMPACT_BREAKPOINT;
  const { loading, poi, activity, activityError } = useAdminSiteActivity(
    orgId as string,
    poiId as string,
  );
  const [showEdit, setShowEdit] = React.useState(false);

  const siteName = poi?.name ?? 'Site';
  const kind = poi?.kind ?? 'place';
  const role =
    (poi?.metadata?.partner_role as string | undefined) ??
    (poi?.metadata?.role as string | undefined);
  const curatedLabel = poi?.metadata?.curated_label as string | undefined;

  const stats = activity?.stats;
  const settledRate =
    stats && stats.steps > 0 ? Math.round((stats.settled / stats.steps) * 100) : null;
  const maxEv = Math.max(1, ...(activity?.competencies ?? []).map((c) => c.evidence_count));

  return (
    <AdminShell activeKey="sites">
      <StudioHeader
        crumbs={['Admin', 'Sites', siteName]}
        title={siteName}
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>
              {prettyKind(kind)}
            </Text>
            {poi?.interest_slug ? ` · ${poi.interest_slug.replace(/-/g, ' ')}` : ''}
            {role ? ` · ${role.replace(/_/g, ' ')}` : ''}
          </Text>,
        ]}
        actions={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StudioButton
              variant="ghost"
              icon="arrow-back-outline"
              label="Back to Sites"
              onPress={() => router.push(`/admin/${orgId}/sites`)}
            />
            {poi ? (
              <StudioButton
                variant="primary"
                accent="navy"
                icon="create-outline"
                label="Edit"
                onPress={() => setShowEdit(true)}
              />
            ) : null}
          </View>
        }
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {loading ? (
          <Text style={s.loading}>Loading site…</Text>
        ) : !poi ? (
          <View style={s.emptyWrap}>
            <Ionicons name="map-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyTitle}>Site not found</Text>
            <Text style={s.emptyBody}>
              This place is no longer in the Atlas, or the link is stale.
            </Text>
          </View>
        ) : (
          <>
            {/* Hero */}
            <View style={[s.hero, compact && s.heroCompact]}>
              <View style={[s.heroMain, compact && s.cellCompact]}>
                <View style={s.heroRow1}>
                  <View style={s.heroShield}>
                    <Ionicons name={kindIcon(kind)} size={22} color="#28406B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.heroH2}>{siteName}</Text>
                    <Text style={s.heroKind}>
                      {curatedLabel ?? prettyKind(kind)}
                      {' · '}
                      <Text style={s.heroCoords}>
                        {poi.lat.toFixed(4)}°, {poi.lng.toFixed(4)}°
                      </Text>
                    </Text>
                  </View>
                </View>
                <View style={s.heroBadges}>
                  {poi.metadata?.curated ? (
                    <View style={[s.chip, { backgroundColor: 'rgba(30, 143, 71, 0.12)' }]}>
                      <Ionicons name="shield-checkmark" size={11} color="#1E8F47" />
                      <Text style={[s.chipText, { color: '#1E8F47' }]}>Curated site</Text>
                    </View>
                  ) : null}
                  <View style={[s.chip, { backgroundColor: 'rgba(40, 64, 107, 0.10)' }]}>
                    <Text style={[s.chipText, { color: '#28406B' }]}>
                      Claimed by your organization
                    </Text>
                  </View>
                  {poi.is_healthcare_site ? (
                    <View style={[s.chip, { backgroundColor: 'rgba(184, 90, 102, 0.16)' }]}>
                      <Text style={[s.chipText, { color: '#B85A66' }]}>
                        Healthcare · site-level precision
                      </Text>
                    </View>
                  ) : null}
                  {role ? (
                    <View style={[s.chip, { backgroundColor: '#EDEBE2' }]}>
                      <Text style={[s.chipText, { color: '#1C1C1E' }]}>
                        {role.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={[s.heroMap, compact && s.heroMapCompact]}>
                <View style={[s.ring, { width: 140, height: 140 }]} />
                <View style={[s.ring, { width: 90, height: 90 }]} />
                <View style={[s.ring, { width: 50, height: 50 }]} />
                <View style={s.pin} />
              </View>
            </View>

            {activityError ? (
              <View style={s.emptyWrap}>
                <Ionicons name="lock-closed-outline" size={28} color="rgba(60, 60, 67, 0.4)" />
                <Text style={s.emptyTitle}>Activity unavailable</Text>
                <Text style={s.emptyBody}>{activityError}</Text>
              </View>
            ) : (
              <>
                {/* Stat strip */}
                <StatRow>
                  <StatCard
                    k="People practicing here"
                    v={String(stats?.people ?? 0)}
                    d="with steps located at this site"
                  />
                  <StatCard
                    k="Located steps"
                    v={String(stats?.steps ?? 0)}
                    d={
                      stats?.last_activity
                        ? `latest ${shortDate(stats.last_activity)}`
                        : 'none yet'
                    }
                  />
                  <StatCard
                    k="Evidence confirmed"
                    v={String(stats?.evidence ?? 0)}
                    d="competency evidence on steps here"
                  />
                  <StatCard
                    k="Settled rate"
                    v={settledRate === null ? '—' : String(settledRate)}
                    vSuffix={settledRate === null ? undefined : '%'}
                    d="of steps marked settled"
                  />
                </StatRow>

                {/* Two-col row · top competencies + roster */}
                <View style={[s.twoCol, compact && s.twoColCompact]}>
                  <View style={[s.card, compact && s.cellCompact]}>
                    <View style={s.cardHead}>
                      <View>
                        <Text style={s.cardEyebrow}>Most evidenced</Text>
                        <Text style={s.cardH3}>Competencies practiced here</Text>
                      </View>
                      <Text style={s.cardHeadMeta}>confirmed evidence</Text>
                    </View>
                    <View style={s.cardBody}>
                      {(activity?.competencies ?? []).length === 0 ? (
                        <Text style={s.cardEmpty}>
                          No confirmed competency evidence at this site yet.
                        </Text>
                      ) : (
                        activity!.competencies.map((c, i) => (
                          <View key={c.short_label} style={[s.cellRow, i > 0 && s.cellRowBorder]}>
                            <Text style={s.cellLbl}>{c.full_label ?? c.short_label}</Text>
                            <Text style={s.cellNumLabel}>{c.evidence_count} ev.</Text>
                            <View style={s.cellBar}>
                              <View
                                style={[
                                  s.cellBarFill,
                                  { width: `${Math.round((c.evidence_count / maxEv) * 100)}%` },
                                ]}
                              />
                            </View>
                            <Text style={s.cellNum}>{c.people}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>

                  <View style={[s.card, compact && s.cellCompact]}>
                    <View style={s.cardHead}>
                      <View>
                        <Text style={s.cardEyebrow}>People</Text>
                        <Text style={s.cardH3}>
                          {stats?.people ?? 0} {stats?.people === 1 ? 'person has' : 'people have'}{' '}
                          steps here
                        </Text>
                      </View>
                    </View>
                    <View style={[s.cardBody, { paddingTop: 6 }]}>
                      {(activity?.roster ?? []).length === 0 ? (
                        <Text style={s.cardEmpty}>No one has located a step here yet.</Text>
                      ) : (
                        <>
                          {activity!.roster.map((r, i) => (
                            <RosterLine key={r.user_id} row={r} index={i} />
                          ))}
                          {stats && stats.people > activity!.roster.length ? (
                            <Text style={s.rosterMore}>
                              + {stats.people - activity!.roster.length} more
                            </Text>
                          ) : null}
                        </>
                      )}
                    </View>
                  </View>
                </View>

                {/* Recent practice */}
                <View style={s.card}>
                  <View style={s.cardHead}>
                    <View>
                      <Text style={s.cardEyebrow}>Recent practice at this site</Text>
                      <Text style={s.cardH3}>Latest located steps</Text>
                    </View>
                  </View>
                  <View style={[s.cardBody, { paddingTop: 6 }]}>
                    {(activity?.recent ?? []).length === 0 ? (
                      <Text style={s.cardEmpty}>No practice activity at this site yet.</Text>
                    ) : (
                      activity!.recent.map((entry, i) => (
                        <RecentLine key={entry.step_id} row={entry} index={i} />
                      ))
                    )}
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <EditSiteSheet
        visible={showEdit}
        orgId={orgId as string}
        site={poi}
        locatedStepCount={stats?.steps ?? 0}
        onClose={() => setShowEdit(false)}
      />
    </AdminShell>
  );
}

function RosterLine({ row, index }: { row: SiteRosterRow; index: number }) {
  return (
    <View style={s.rosterRow}>
      <View style={[s.avi, aviTone(index)]}>
        <Text style={s.aviText}>{row.user_initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rosterName}>{row.user_name}</Text>
        <Text style={s.rosterMeta}>
          {row.step_count} {row.step_count === 1 ? 'step' : 'steps'} · last active{' '}
          {shortDate(row.last_active)}
        </Text>
      </View>
      {row.settled_count > 0 ? (
        <View style={[s.chip, { backgroundColor: 'rgba(30, 143, 71, 0.12)' }]}>
          <Text style={[s.chipText, { color: '#1E8F47' }]}>{row.settled_count} settled</Text>
        </View>
      ) : null}
    </View>
  );
}

function RecentLine({ row, index }: { row: SiteRecentRow; index: number }) {
  return (
    <View style={s.recentRow}>
      <View style={[s.avi, aviTone(index)]}>
        <Text style={s.aviText}>{row.user_initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.recentText}>
          <Text style={s.recentStrong}>{row.user_name}</Text>
          {` ${statusVerb(row.status)} `}
          <Text style={s.recentStrong}>{row.title ?? 'a step'}</Text>.
        </Text>
        <View style={s.recentMeta}>
          <Text style={s.recentWhen}>{shortDate(row.happened_at)}</Text>
          {row.competencies.map((c) => (
            <View key={c} style={[s.chip, { backgroundColor: 'rgba(40, 64, 107, 0.10)' }]}>
              <Text style={[s.chipText, { color: '#28406B' }]}>{c}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function StatCard({
  k,
  v,
  vSuffix,
  d,
}: {
  k: string;
  v: string;
  vSuffix?: string;
  d: string;
}) {
  return (
    <View style={s.statCard}>
      <Text style={s.statK}>{k}</Text>
      <Text style={s.statV}>
        {v}
        {vSuffix ? <Text style={s.statVSuffix}>{vSuffix}</Text> : null}
      </Text>
      <Text style={s.statD}>{d}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F2F2F7' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 18 },

  loading: { textAlign: 'center', paddingVertical: 48, color: 'rgba(60, 60, 67, 0.6)' },

  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 8 },
  emptyBody: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 440,
  },

  // Hero
  hero: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  heroCompact: { flexDirection: 'column' },
  heroMain: { flex: 1, padding: 22, gap: 10 },
  // flex:1 children collapse to 0 height inside a column container — see
  // feedback_flex1_collapses_in_column_cell. flex:0 restores intrinsic size.
  cellCompact: { flex: 0 },
  heroRow1: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroShield: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroH2: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.3 },
  heroKind: { marginTop: 2, fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },
  heroCoords: { fontVariant: ['tabular-nums'] },
  heroBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },

  heroMapCompact: { width: '100%', height: 120 },
  heroMap: {
    width: 200,
    backgroundColor: '#EDEBE2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: 'rgba(40, 64, 107, 0.18)',
    borderRadius: 999,
  },
  pin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#28406B',
    shadowColor: '#28406B',
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },

  // Chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: { fontSize: 11, fontWeight: '600' },

  // Stat strip
  statCard: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  statK: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  statV: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statVSuffix: { fontSize: 13, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  statD: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  // Two-col row
  twoCol: { flexDirection: 'row', gap: 18 },
  twoColCompact: { flexDirection: 'column' },

  // Card
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  cardHead: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  cardH3: { marginTop: 4, fontSize: 15, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.2 },
  cardHeadMeta: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  cardBody: { padding: 18 },
  cardEmpty: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', paddingVertical: 8 },

  // Competency bars
  cellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  cellRowBorder: { borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)' },
  cellLbl: { flex: 1, fontSize: 12.5, color: '#1C1C1E' },
  cellNumLabel: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', minWidth: 50, textAlign: 'right' },
  cellBar: {
    width: 80,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EDEBE2',
    overflow: 'hidden',
  },
  cellBarFill: { height: '100%', backgroundColor: '#28406B', borderRadius: 3 },
  cellNum: {
    minWidth: 24,
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },

  // Roster
  avi: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  rosterName: { fontSize: 13, color: '#1C1C1E', fontWeight: '600' },
  rosterMeta: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },
  rosterMore: { paddingTop: 10, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  // Recent
  recentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  recentText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  recentStrong: { color: '#1C1C1E', fontWeight: '500' },
  recentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  recentWhen: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
});
