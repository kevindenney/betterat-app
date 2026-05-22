/**
 * PersonDetailDrawer — slide-in panel on Org Admin · People showing one
 * member's profile. Opens when a row is tapped. Header carries the
 * gradient avatar + name + role badges + cohort + last-active; body
 * surfaces a stub competency-evidence summary tying back to the Insights
 * page so the dean can drill into one student's specific record.
 *
 * Production-roadmap: the evidence section becomes a real query joining
 * step_reflections.user_id + step_location.poi_id → competencies once
 * that schema converges. Today it reuses useAdminCompetencyEvidence's
 * stub so the per-student view is consistent with the program-level view.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AdminPersonRow, PersonRoleBadge } from '@/hooks/useAdminPeople';

export interface PersonDetailDrawerProps {
  person: AdminPersonRow | null;
  onClose: () => void;
  onSuggestAction?: (key: 'open-timeline' | 'send-message' | 'change-role' | 'flag') => void;
}

const ROLE_TONE: Record<PersonRoleBadge, { bg: string; fg: string; label: string }> = {
  student: { bg: 'rgba(0, 122, 255, 0.10)', fg: '#007AFF', label: 'Student' },
  faculty: { bg: 'rgba(184, 90, 102, 0.16)', fg: '#B85A66', label: 'Faculty' },
  author: { bg: 'rgba(107, 91, 191, 0.14)', fg: '#6B5BBF', label: 'Author' },
  'co-author': { bg: 'rgba(107, 91, 191, 0.14)', fg: '#6B5BBF', label: 'Co-author' },
  mentor: { bg: 'rgba(60, 60, 67, 0.10)', fg: 'rgba(60, 60, 67, 0.85)', label: 'Mentor' },
  admin: { bg: 'rgba(40, 64, 107, 0.14)', fg: '#28406B', label: 'Admin' },
};

export function PersonDetailDrawer({ person, onClose, onSuggestAction }: PersonDetailDrawerProps) {
  if (!person) return null;

  // Deterministic stub: each student "evidenced" ~5 of the 8 competencies.
  // Real wiring later via step_reflections × step_location join.
  const stubCompetencies = [
    'IV insertion · supervised',
    'Medication administration',
    'Head-to-toe assessment',
    'ISBAR handoff communication',
    'Discharge teach-back',
    'Foley catheter placement',
    'NG tube placement',
    'Cardiac telemetry interpretation',
  ];
  const evidenceCount = (person.id.charCodeAt(0) % 5) + 3;
  const evidencedSet = new Set(stubCompetencies.slice(0, evidenceCount));

  const stubSites = ['Hopkins East Baltimore', 'Bayview', 'Sibley Memorial', 'Suburban', 'Howard County'];
  const stubLastSite = stubSites[person.id.charCodeAt(0) % stubSites.length];

  return (
    <View style={s.scrim} pointerEvents="auto">
      <Pressable style={s.scrimPress} onPress={onClose} />
      <View style={s.drawer}>
        <View style={s.header}>
          <View style={[s.avi, { backgroundColor: person.gradient[0] }]}>
            <Text style={s.aviText}>{person.initials}</Text>
          </View>
          <View style={s.headerCol}>
            <Text style={s.name}>
              {person.name}
              {person.isYou ? <Text style={s.youTag}>{'  '}(you)</Text> : null}
            </Text>
            <Text style={s.email}>{person.email}</Text>
            <View style={s.roleRow}>
              {person.roles.map((r) => {
                const tone = ROLE_TONE[r];
                return (
                  <View key={r} style={[s.roleTag, { backgroundColor: tone.bg }]}>
                    <Text style={[s.roleTagText, { color: tone.fg }]}>{tone.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
          </Pressable>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
          {/* Meta block */}
          <View style={s.metaBlock}>
            <MetaRow icon="school-outline" label="Cohort" value={person.cohortLabel ?? 'Not assigned'} />
            <MetaRow icon="time-outline" label="Last active" value={person.lastActiveLabel} />
            <MetaRow
              icon={statusIcon(person.status)}
              label="Status"
              value={statusLabel(person.status)}
              valueColor={statusColor(person.status)}
            />
            {person.joinedNote ? (
              <MetaRow icon="mail-outline" label="Joined" value={person.joinedNote} />
            ) : null}
            {person.source === 'sso' ? (
              <MetaRow icon="shield-half-outline" label="Source" value="SSO · SAML" />
            ) : null}
          </View>

          {/* Evidence summary */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Competency evidence</Text>
              <View style={s.evidencePill}>
                <Text style={s.evidencePillText}>
                  {evidencedSet.size} of {stubCompetencies.length}
                </Text>
              </View>
            </View>
            <Text style={s.sectionLede}>
              Stub view — pulled from the same Insights data until reflections wire
              up. Last evidenced at{' '}
              <Text style={s.sectionLedeStrong}>{stubLastSite}</Text>.
            </Text>
            <View style={s.competencyList}>
              {stubCompetencies.map((c) => {
                const evidenced = evidencedSet.has(c);
                return (
                  <View key={c} style={[s.competencyRow, !evidenced && s.competencyRowEmpty]}>
                    <Ionicons
                      name={evidenced ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={evidenced ? '#28406B' : 'rgba(60, 60, 67, 0.3)'}
                    />
                    <Text
                      style={[s.competencyText, !evidenced && s.competencyTextEmpty]}
                    >
                      {c}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Actions */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Actions</Text>
            <View style={s.actionsCol}>
              <ActionRow
                icon="timeline"
                label="Open practice timeline"
                sublabel="See every step, reflection, and capture by date"
                onPress={() => onSuggestAction?.('open-timeline')}
              />
              <ActionRow
                icon="chatbubble-outline"
                label="Send a message"
                sublabel="Goes to their Practice inbox"
                onPress={() => onSuggestAction?.('send-message')}
              />
              <ActionRow
                icon="swap-horizontal-outline"
                label="Change role"
                sublabel="Student / Mentor / Faculty / Admin"
                onPress={() => onSuggestAction?.('change-role')}
              />
              <ActionRow
                icon="flag-outline"
                label="Flag for mentor follow-up"
                sublabel="Routes to faculty inbox; visible on Overview"
                onPress={() => onSuggestAction?.('flag')}
                tone="warn"
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function MetaRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={s.metaRow}>
      <Ionicons name={icon} size={14} color="rgba(60, 60, 67, 0.6)" />
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={[s.metaValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
  tone = 'default',
}: {
  icon: string;
  label: string;
  sublabel: string;
  onPress?: () => void;
  tone?: 'default' | 'warn';
}) {
  const actualIcon = (icon === 'timeline' ? 'list-outline' : icon) as keyof typeof Ionicons.glyphMap;
  return (
    <Pressable style={s.actionRow} onPress={onPress}>
      <View style={[s.actionIcon, tone === 'warn' && s.actionIconWarn]}>
        <Ionicons
          name={actualIcon}
          size={16}
          color={tone === 'warn' ? '#C99632' : '#28406B'}
        />
      </View>
      <View style={s.actionCol}>
        <Text style={s.actionLabel}>{label}</Text>
        <Text style={s.actionSub}>{sublabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color="rgba(60, 60, 67, 0.4)" />
    </Pressable>
  );
}

function statusIcon(status: AdminPersonRow['status']): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'active':
      return 'checkmark-circle-outline';
    case 'pending':
      return 'mail-outline';
    case 'off-boarded':
      return 'archive-outline';
    case 'suspended':
      return 'alert-circle-outline';
  }
}

function statusLabel(status: AdminPersonRow['status']): string {
  return status === 'active'
    ? 'Active'
    : status === 'pending'
    ? 'Pending invite'
    : status === 'off-boarded'
    ? 'Off-boarded'
    : 'Suspended';
}

function statusColor(status: AdminPersonRow['status']): string {
  return status === 'active'
    ? '#1E8F47'
    : status === 'pending'
    ? '#C99632'
    : status === 'suspended'
    ? '#FF3B30'
    : 'rgba(60, 60, 67, 0.6)';
}

const DRAWER_WIDTH = 420;

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.20)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  scrimPress: { flex: 1 },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(0,0,0,0.08)',
    ...({
      boxShadow: '-12px 0 32px -8px rgba(0,0,0,0.15)',
    } as any),
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FAFAF7',
  },
  avi: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  headerCol: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  youTag: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  email: { marginTop: 3, fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)' },
  roleRow: { flexDirection: 'row', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  roleTag: {
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  closeBtn: { padding: 4 },

  body: { flex: 1 },
  bodyInner: { paddingHorizontal: 20, paddingVertical: 18, gap: 22 },

  metaBlock: { gap: 10 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    width: 90,
  },
  metaValue: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '500',
  },

  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.1,
  },
  sectionLede: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 17 },
  sectionLedeStrong: { fontWeight: '600', color: '#28406B' },
  evidencePill: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    borderRadius: 999,
  },
  evidencePillText: { fontSize: 10.5, fontWeight: '700', color: '#28406B' },

  competencyList: { gap: 6, marginTop: 4 },
  competencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  competencyRowEmpty: { opacity: 0.6 },
  competencyText: { fontSize: 12.5, color: '#1C1C1E' },
  competencyTextEmpty: { color: 'rgba(60, 60, 67, 0.6)' },

  actionsCol: { gap: 6, marginTop: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#FAFAF7',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconWarn: { backgroundColor: 'rgba(201, 150, 50, 0.14)' },
  actionCol: { flex: 1, minWidth: 0 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  actionSub: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
});
