/**
 * Org Admin · Audit log (Frame 29 of the JHSON Admin Suite)
 *
 * Real audit_events feed via admin_audit_feed RPC. Day-grouped on the
 * client side, verb-chip tinted, with a sticky right-side detail drawer
 * showing the full event payload (JSON syntax-highlighted).
 *
 * Verbs are tone-tinted chips: add/publish (green), edit (navy),
 * del (danger), role (warn).
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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  StudioHeader,
  StudioButton,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';
import {
  useAdminAuditFeed,
  AuditEvent,
  AuditVerb,
  AuditTone,
} from '@/hooks/useAdminAuditFeed';

const MONO: any =
  Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Menlo';

function verbToneStyle(v: AuditVerb) {
  switch (v) {
    case 'invited':
    case 'published':
    case 'claimed':
    case 'membership_added':
    case 'blueprint_publish':
    case 'site_claim':
      return { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47' };
    case 'edited':
    case 'cohort_edit':
    case 'sso_config':
    case 'config_change':
    case 'login':
      return { bg: 'rgba(40, 64, 107, 0.08)', fg: '#28406B' };
    case 'removed':
    case 'membership_removed':
      return { bg: 'rgba(255, 59, 48, 0.10)', fg: '#FF3B30' };
    case 'role_changed':
      return { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632' };
  }
}

function detailIconStyle(v: AuditVerb): { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap } {
  switch (v) {
    case 'role_changed':
      return { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632', icon: 'people-circle-outline' };
    case 'published':
    case 'blueprint_publish':
      return { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47', icon: 'rocket-outline' };
    case 'invited':
    case 'membership_added':
      return { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47', icon: 'mail-outline' };
    case 'edited':
    case 'cohort_edit':
      return { bg: 'rgba(40, 64, 107, 0.08)', fg: '#28406B', icon: 'create-outline' };
    case 'claimed':
    case 'site_claim':
      return { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47', icon: 'flag-outline' };
    case 'removed':
    case 'membership_removed':
      return { bg: 'rgba(255, 59, 48, 0.10)', fg: '#FF3B30', icon: 'remove-circle-outline' };
    case 'sso_config':
    case 'config_change':
      return { bg: 'rgba(40, 64, 107, 0.08)', fg: '#28406B', icon: 'settings-outline' };
    case 'login':
      return { bg: 'rgba(40, 64, 107, 0.08)', fg: '#28406B', icon: 'log-in-outline' };
  }
}

function aviToneStyle(tone: AuditTone) {
  switch (tone) {
    case 'navy':
      return { backgroundColor: '#28406B' };
    case 'brown':
      return { backgroundColor: '#8B5A3C' };
    case 'warm':
      return { backgroundColor: '#B8855A' };
    case 'green':
      return { backgroundColor: '#6E8B5A' };
  }
}

function dayBucketFor(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / dayMs);
  if (diffDays === 0) {
    return `Today · ${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }
  if (diffDays === 1) {
    return `Yesterday · ${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const ageDays = (now - d.getTime()) / dayMs;
  if (ageDays < 2) {
    // "2:14p"
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p' : 'a';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${h12}:${minutes}${ampm}`;
  }
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function shortenEventId(id: string): string {
  return `evt ${id.replace(/-/g, '').slice(0, 4)}…${id.replace(/-/g, '').slice(-3)}`;
}

function formatPayloadJson(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

interface DayGroup {
  label: string;
  events: AuditEvent[];
}

export default function AdminAuditPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { events, loading } = useAdminAuditFeed(orgId as string, 100);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stripeOnly, setStripeOnly] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const stripeLabels = new Set([
      'Synced from Stripe',
      'Listed on Stripe',
      'Refreshed Stripe listing',
      'Subscribed via marketplace',
      'Marketplace invoice paid',
    ]);
    return events.filter((e) => {
      if (stripeOnly && !stripeLabels.has(e.verbLabel)) return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q) ||
        e.targetLabel?.toLowerCase().includes(q) ||
        e.verbLabel.toLowerCase().includes(q) ||
        e.id.includes(q)
      );
    });
  }, [events, search, stripeOnly]);

  const stripeEventCount = useMemo(() => {
    const stripeLabels = new Set([
      'Synced from Stripe',
      'Listed on Stripe',
      'Refreshed Stripe listing',
      'Subscribed via marketplace',
      'Marketplace invoice paid',
    ]);
    return events.filter((e) => stripeLabels.has(e.verbLabel)).length;
  }, [events]);

  const groups: DayGroup[] = useMemo(() => {
    const m = new Map<string, AuditEvent[]>();
    const now = new Date();
    for (const e of filtered) {
      const label = dayBucketFor(e.occurredAt, now);
      if (!m.has(label)) m.set(label, []);
      m.get(label)!.push(e);
    }
    return Array.from(m.entries()).map(([label, list]) => ({ label, events: list }));
  }, [filtered]);

  const selected = useMemo(
    () => filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const filterChips = (
    <>
      <Pressable
        style={[s.filterChip, !stripeOnly && s.filterChipOn]}
        onPress={() => setStripeOnly(false)}
      >
        <Ionicons
          name="pricetag-outline"
          size={13}
          color={!stripeOnly ? '#28406B' : 'rgba(60, 60, 67, 0.6)'}
        />
        <Text style={!stripeOnly ? s.filterChipTextOn : s.filterChipText}>All events</Text>
      </Pressable>
      <Pressable
        style={[s.filterChip, stripeOnly && s.filterChipOn]}
        onPress={() => setStripeOnly(true)}
      >
        <Ionicons
          name="card-outline"
          size={13}
          color={stripeOnly ? '#28406B' : 'rgba(60, 60, 67, 0.6)'}
        />
        <Text style={stripeOnly ? s.filterChipTextOn : s.filterChipText}>
          Stripe · {stripeEventCount}
        </Text>
      </Pressable>
      <View style={s.filterChip}>
        <Ionicons name="person-outline" size={13} color="rgba(60, 60, 67, 0.6)" />
        <Text style={s.filterChipText}>Any actor</Text>
        <Ionicons name="chevron-down" size={13} color="rgba(60, 60, 67, 0.6)" />
      </View>
      <View style={s.filterChip}>
        <Ionicons name="calendar-outline" size={13} color="rgba(60, 60, 67, 0.6)" />
        <Text style={s.filterChipText}>Last 90 days</Text>
        <Ionicons name="chevron-down" size={13} color="rgba(60, 60, 67, 0.6)" />
      </View>
    </>
  );

  return (
    <AdminShell activeKey="audit">
      <StudioHeader
        crumbs={['Admin', 'Security', 'Audit log']}
        title="Audit log"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>
              {loading ? '…' : `${events.length} events`}
            </Text>
            {' · '}retention: 7 years for SOC 2
          </Text>,
        ]}
        actions={
          <>
            <StudioButton variant="ghost" icon="calendar-outline" label="Last 90 days" />
            <StudioButton variant="ghost" icon="download-outline" label="Export" />
          </>
        }
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {/* Filter row */}
        <View style={[s.filterRow, compact && s.filterRowStacked]}>
          <View style={s.searchBox}>
            <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by target, actor, or event id…"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={s.searchInput}
            />
          </View>
          {compact ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterChipScroll}
            >
              {filterChips}
            </ScrollView>
          ) : (
            filterChips
          )}
        </View>

        {/* Feed + Detail */}
        <View style={s.split}>
          <View style={s.feed}>
            {loading ? (
              <Text style={s.emptyText}>Loading…</Text>
            ) : groups.length === 0 ? (
              <View style={s.emptyCard}>
                <Ionicons name="time-outline" size={18} color="rgba(60, 60, 67, 0.4)" />
                <Text style={s.emptyText}>
                  {search
                    ? 'No events match that search. Try clearing or broadening it.'
                    : 'No events yet. Activity will appear here as admins act on the org.'}
                </Text>
              </View>
            ) : (
              groups.map((day, di) => (
                <View key={day.label} style={[di > 0 && { marginTop: 18 }]}>
                  <View style={s.dayHead}>
                    <Text style={s.dayDate}>{day.label}</Text>
                    <Text style={s.dayMeta}>
                      {day.events.length} event{day.events.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {day.events.map((entry) => {
                    const tone = verbToneStyle(entry.verb);
                    const isSelected = entry.id === (selected?.id ?? '');
                    return (
                      <Pressable
                        key={entry.id}
                        onPress={() => setSelectedId(entry.id)}
                        style={[s.auditRow, isSelected && s.auditRowSel]}
                      >
                        <View style={[s.entryAv, aviToneStyle(entry.actorTone)]}>
                          <Text style={s.entryAvText}>{entry.actorInitials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={s.entryHeadRow}>
                            <Text
                              style={[
                                s.verbChip,
                                { backgroundColor: tone.bg, color: tone.fg },
                              ]}
                            >
                              {' '}
                              {entry.verbLabel.toUpperCase()}{' '}
                            </Text>
                          </View>
                          <Text style={s.entryText}>{entry.description}</Text>
                          <View style={s.entryMeta}>
                            <Text style={s.entryMetaText}>{formatTime(entry.occurredAt)}</Text>
                            <Text style={s.entryMetaDot}>·</Text>
                            <Text style={s.entryMetaText}>{shortenEventId(entry.id)}</Text>
                          </View>
                        </View>
                        <Text style={s.rowRight}>{formatTime(entry.occurredAt)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))
            )}
          </View>

          {/* Detail drawer (sticky) */}
          {selected ? (
            <View style={s.detail}>
              <View style={s.detailHead}>
                <View style={[s.detailIco, { backgroundColor: detailIconStyle(selected.verb).bg }]}>
                  <Ionicons
                    name={detailIconStyle(selected.verb).icon}
                    size={16}
                    color={detailIconStyle(selected.verb).fg}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.detailVerb, { color: detailIconStyle(selected.verb).fg }]}>
                    {selected.verbLabel}
                  </Text>
                  <Text style={s.detailH3}>{shortenEventId(selected.id)}</Text>
                </View>
              </View>
              <ScrollView style={{ maxHeight: 600 }}>
                <View style={s.detailBody}>
                  <DetailRow k="Actor" v={selected.actorName} />
                  {selected.targetLabel ? (
                    <DetailRow k="Target" v={selected.targetLabel} />
                  ) : null}
                  {selected.targetType ? (
                    <DetailRow k="Resource" v={selected.targetType} />
                  ) : null}
                  <DetailRow
                    k="When"
                    v={new Date(selected.occurredAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                  {selected.ip ? <DetailRow k="IP" v={selected.ip} /> : null}
                  {selected.userAgent ? <DetailRow k="Client" v={selected.userAgent} /> : null}
                  <Text style={s.payloadLabel}>Payload</Text>
                  <View style={s.payloadBox}>
                    <Text style={s.payloadText}>{formatPayloadJson(selected.payload)}</Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </AdminShell>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailK}>{k}</Text>
      <Text style={s.detailV}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 18 },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
  },
  filterRowStacked: { flexDirection: 'column', alignItems: 'stretch' },
  filterChipScroll: { flexDirection: 'row', gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F5F4EE',
  },
  searchInput: { flex: 1, fontSize: 12.5, color: '#1C1C1E', height: 32, padding: 0 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F5F4EE',
  },
  filterChipOn: { backgroundColor: 'rgba(40, 64, 107, 0.08)' },
  filterChipText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '500' },
  filterChipTextOn: { fontSize: 12, color: '#28406B', fontWeight: '600' },

  split: { flexDirection: 'row', gap: 18 },
  feed: { flex: 1 },
  detail: {
    width: 380,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },

  dayHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 },
  dayDate: { fontSize: 12, color: '#1C1C1E', fontWeight: '600' },
  dayMeta: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },

  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
  },
  auditRowSel: {
    borderColor: '#28406B',
    ...({ boxShadow: '0 0 0 3px rgba(40, 64, 107, 0.08)' } as any),
  },
  entryAv: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryAvText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  entryHeadRow: { flexDirection: 'row', marginBottom: 4 },
  entryText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  verbChip: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  entryMetaText: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', fontFamily: MONO },
  entryMetaDot: { fontSize: 11, color: 'rgba(60, 60, 67, 0.4)' },
  rowRight: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', alignSelf: 'flex-start' },

  detailHead: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIco: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailVerb: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  detailH3: { marginTop: 2, fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.15 },

  detailBody: { padding: 18, gap: 14 },
  detailRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  detailK: {
    width: 100,
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  detailV: { flex: 1, fontSize: 12.5, color: '#1C1C1E' },

  payloadLabel: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  payloadBox: {
    backgroundColor: '#F5F4EE',
    borderRadius: 8,
    padding: 14,
  },
  payloadText: {
    fontFamily: MONO,
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 18,
  },

  emptyCard: {
    paddingHorizontal: 18,
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 24,
  },
});
