/**
 * Org Admin · Calendar — the org's scheduled events.
 *
 * The universal-model surface from ORG_ADMIN_CALENDAR_RACE_MODEL_SPEC.md:
 * an org event is a scheduled timeline_step, and a race is just such a step
 * with is_race = true (D30/D31). The same list carries races (badged ⛵, linked
 * to their scoring row via regatta_race_id) and ordinary scheduled steps.
 *
 * Data is real from admin_org_calendar (SECURITY DEFINER, gated by
 * is_org_admin_member) via useAdminCalendar. Authoring is a follow-up.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { CreateOrgEventSheet } from '@/components/admin/CreateOrgEventSheet';
import { useAdminCalendar } from '@/hooks/useAdminCalendar';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { AdminCalendarEvent, groupByMonth } from '@/lib/admin/adminCalendar';

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: 'rgba(0, 122, 255, 0.12)', fg: '#0A6FE0' },
  in_progress: { bg: 'rgba(255, 149, 0, 0.14)', fg: '#B25E00' },
  completed: { bg: 'rgba(48, 209, 88, 0.14)', fg: '#1B873F' },
  skipped: { bg: 'rgba(60, 60, 67, 0.10)', fg: 'rgba(60, 60, 67, 0.7)' },
};

function timeLabel(ev: AdminCalendarEvent): string | null {
  if (!ev.startsAt) return null;
  const start = new Date(ev.startsAt);
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (ev.endsAt) {
    const endTime = new Date(ev.endsAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${day} · ${startTime}–${endTime}`;
  }
  return `${day} · ${startTime}`;
}

export default function AdminCalendarPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const data = useAdminCalendar(orgId as string);
  const menu = useProfileMenuData();
  const [showCreate, setShowCreate] = useState(false);

  const orgName =
    menu.memberships.find((m) => m.org_id === orgId)?.org_name ??
    menu.activeOrg?.org_name ??
    'your club';

  const groups = useMemo(() => groupByMonth(data.events), [data.events]);

  return (
    <AdminShell activeKey="calendar">
      <StudioHeader
        crumbs={['Admin', 'Calendar']}
        title="Calendar"
        subtitleParts={[
          <View key="count" style={s.pillWrap}>
            <View style={s.pill}>
              <Text style={s.pillText}>
                {data.scheduledCount} scheduled
              </Text>
            </View>
          </View>,
          <Text key="meta" style={s.subText}>
            {data.raceCount} {data.raceCount === 1 ? 'race' : 'races'} ⛵ · org events your members
            can show up to
          </Text>,
        ]}
        actions={
          <StudioButton
            variant="primary"
            accent="navy"
            icon="add"
            label="New event"
            onPress={() => setShowCreate(true)}
          />
        }
      />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner}>
        {data.loading ? (
          <Text style={s.loading}>Loading calendar…</Text>
        ) : data.error ? (
          <View style={s.empty}>
            <Ionicons name="warning-outline" size={32} color="rgba(200, 57, 46, 0.6)" />
            <Text style={s.emptyTitle}>Couldn’t load the calendar</Text>
            <Text style={s.emptyBody}>{data.error}</Text>
          </View>
        ) : data.events.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.emptyTitle}>No events yet</Text>
            <Text style={s.emptyBody}>
              Events you put on the calendar become scheduled steps your members can adopt. Flag one
              as a race to unlock course, marks and scoring.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={s.group}>
              <Text style={s.groupLabel}>{group.label}</Text>
              {group.events.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  onPress={() => router.push(`/step/${ev.id}` as any)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <CreateOrgEventSheet
        visible={showCreate}
        orgId={orgId as string}
        orgName={orgName}
        onClose={() => setShowCreate(false)}
        onCreated={(stepId) => router.push(`/step/${stepId}` as any)}
      />
    </AdminShell>
  );
}

function EventRow({ event, onPress }: { event: AdminCalendarEvent; onPress: () => void }) {
  const tone = STATUS_TONE[event.status] ?? STATUS_TONE.pending;
  const time = timeLabel(event);
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={[s.rowIcon, event.isRace ? s.rowIconRace : s.rowIconStep]}>
        <Ionicons name={event.isRace ? 'boat' : 'calendar'} size={18} color="#FFFFFF" />
      </View>
      <View style={s.rowCol}>
        <View style={s.rowNameRow}>
          <Text style={s.rowName}>{event.title}</Text>
          {event.isRace ? (
            <View style={s.raceTag}>
              <Text style={s.raceTagText}>RACE</Text>
            </View>
          ) : null}
          <View style={[s.statusTag, { backgroundColor: tone.bg }]}>
            <Text style={[s.statusTagText, { color: tone.fg }]}>
              {event.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={s.rowMetaRow}>
          {time ? (
            <Text style={s.rowMeta}>{time}</Text>
          ) : (
            <Text style={s.rowMeta}>No date set</Text>
          )}
          {event.placeName ? (
            <>
              <View style={s.rowMetaDot} />
              <Text style={s.rowMeta}>{event.placeName}</Text>
            </>
          ) : null}
          {event.ownerName ? (
            <>
              <View style={s.rowMetaDot} />
              <Text style={s.rowMeta}>by {event.ownerName}</Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={s.rowAction}>
        <Ionicons name="chevron-forward" size={16} color="rgba(60, 60, 67, 0.4)" />
      </View>
    </Pressable>
  );
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

  scroll: { flex: 1 },
  scrollInner: { gap: 18, paddingBottom: 20 },

  loading: { textAlign: 'center', paddingVertical: 32, color: 'rgba(60, 60, 67, 0.6)' },

  group: { gap: 8 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.55)',
    marginBottom: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconRace: { backgroundColor: '#007AFF' },
  rowIconStep: { backgroundColor: '#28406B' },
  rowCol: { flex: 1, minWidth: 0 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  rowMeta: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  rowMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(60, 60, 67, 0.3)' },
  rowAction: { padding: 4 },
  raceTag: {
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  raceTagText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4, color: '#0A6FE0' },
  statusTag: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 3, borderRadius: 4 },
  statusTagText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },

  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 8 },
  emptyBody: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 440,
    lineHeight: 18,
  },
});
