/**
 * Org Admin · People dashboard (Frame 7 of the institutions pass)
 *
 * Sibling of Creator Studio. Same shell, navy accent, different drawers.
 * Sidebar: Hopkins MSN nav (Overview/People/Cohorts/Blueprints/Insights),
 * Plan nav (Billing & seats/Invoices/Author payouts), Security nav
 * (SSO & SAML/Domain claim/Audit log), Seats card pinned above the user
 * card.
 * Main: People table with role tabs, search/filter row, paginated rows
 * with various states (Faculty/Author, Admin "you", Student, Pending,
 * SSO-joined, Off-boarded). "Add person" launches the Frame 8 sheet.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import {
  useAdminPeople,
  AdminPersonRow,
  PersonRoleBadge,
  PersonStatus,
} from '@/hooks/useAdminPeople';
import {
  StudioShell,
  StudioHeader,
  StudioButton,
  StudioTabs,
  StudioNavSection,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';
import { AddPersonSheet } from '@/components/admin/AddPersonSheet';

type PeopleTab = 'all' | 'students' | 'authors' | 'mentors' | 'admins' | 'pending';

export default function AdminPeoplePage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const menu = useProfileMenuData();
  const data = useAdminPeople(orgId as string);

  const [tab, setTab] = useState<PeopleTab>('all');
  const [search, setSearch] = useState('');
  const [showAddSheet, setShowAddSheet] = useState(false);

  const filteredRows = useMemo(() => {
    let rows = data.rows;
    if (tab !== 'all') {
      rows = rows.filter((r) => matchesTab(r, tab));
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.cohortLabel ?? '').toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data.rows, tab, search]);

  if (width < 920) {
    return <NarrowScreenGate onBack={() => router.back()} />;
  }

  if (!user || menu.loading) {
    return <StudioLoading />;
  }

  const displayName =
    userProfile?.full_name || userProfile?.display_name || user?.email || 'You';
  const initials = getInitials(displayName);
  const activeOrg = menu.memberships.find((m) => m.org_id === orgId) ?? menu.activeOrg;
  const orgName = activeOrg?.org_name ?? 'Organization';
  const orgMono = activeOrg?.org_short_name ?? '·';
  const orgShortLabel = shortNameLabel(orgName);

  const seatsAvailable = data.seats.total - data.seats.used;
  const seatsPct = Math.round((data.seats.used / data.seats.total) * 100);

  const navSections: StudioNavSection[] = [
    {
      eyebrow: orgShortLabel,
      items: [
        { key: 'overview', icon: 'grid-outline', label: 'Overview' },
        {
          key: 'people',
          icon: 'people-outline',
          label: 'People',
          count: data.totalRows,
          active: true,
        },
        { key: 'cohorts', icon: 'school-outline', label: 'Cohorts', count: 14 },
        { key: 'blueprints', icon: 'git-branch-outline', label: 'Blueprints', count: 7 },
        {
          key: 'sites',
          icon: 'map-outline',
          label: 'Sites',
          onPress: () => router.push(`/admin/${orgId}/sites`),
        },
        { key: 'insights', icon: 'pie-chart-outline', label: 'Insights' },
      ],
    },
    {
      eyebrow: 'Plan',
      items: [
        { key: 'billing', icon: 'card-outline', label: 'Billing & seats' },
        { key: 'invoices', icon: 'document-text-outline', label: 'Invoices' },
        { key: 'payouts', icon: 'receipt-outline', label: 'Author payouts', count: '$0' },
      ],
    },
    {
      eyebrow: 'Security',
      items: [
        { key: 'sso', icon: 'shield-half-outline', label: 'SSO & SAML' },
        { key: 'domain', icon: 'key-outline', label: 'Domain claim' },
        { key: 'audit', icon: 'time-outline', label: 'Audit log' },
      ],
      footer: (
        <View>
          <Text style={styles.seatsLabel}>Seats</Text>
          <Text style={styles.seatsValue}>
            {data.seats.used}{' '}
            <Text style={styles.seatsValueSub}>of {data.seats.total}</Text>
          </Text>
          <View style={styles.seatsBar}>
            <View style={[styles.seatsBarFill, { width: `${seatsPct}%` }]} />
          </View>
          <Text style={styles.seatsFoot}>
            {seatsAvailable} seats available · renews {data.seats.renewsAt}
          </Text>
        </View>
      ),
    },
  ];

  const tabs = [
    { key: 'all', label: 'All', count: String(data.counts.all) },
    { key: 'students', label: 'Students', count: String(data.counts.students) },
    {
      key: 'authors',
      label: 'Blueprint authors',
      count: String(data.counts.authors),
    },
    { key: 'mentors', label: 'Mentors', count: String(data.counts.mentors) },
    { key: 'admins', label: 'Admins', count: String(data.counts.admins) },
    { key: 'pending', label: 'Pending', count: String(data.counts.pending) },
  ];

  return (
    <View style={styles.root}>
      <StudioShell
        accent="navy"
        org={{
          name: orgName,
          role: `Admin · ${displayName.split(' ').slice(0, 2).join(' ')}`,
          mono: orgMono,
          monoColor: 'navy',
        }}
        ctxLens="studio"
        ctxLensOptions={['practice', 'studio']}
        onCtxChange={(lens) => {
          if (lens === 'practice') router.push('/');
        }}
        navSections={navSections}
        user={{
          name: displayName,
          email: user?.email ?? '',
          initials,
          statusLine: 'Administrator',
        }}
      >
        <StudioHeader
          crumbs={[orgShortLabel, 'People']}
          title="People"
          subtitleParts={[
            <View key="seats" style={styles.seatPillWrap}>
              <View style={styles.seatPill}>
                <Text style={styles.seatPillText}>
                  {data.seats.used} of {data.seats.total} seats
                </Text>
              </View>
            </View>,
            <Text key="meta" style={styles.subText}>
              14 cohorts · {data.counts.authors} blueprint authors ·{' '}
              {data.counts.admins} admins
            </Text>,
            <Text key="sync" style={styles.subText}>
              Last SSO sync · {data.lastSsoSyncLabel}
            </Text>,
          ]}
          actions={
            <>
              <StudioButton variant="ghost" icon="download-outline" label="Export · CSV" />
              <StudioButton variant="ghost" icon="mail-outline" label="Bulk invite" />
              <StudioButton
                variant="primary"
                accent="navy"
                icon="person-add-outline"
                label="Add person"
                onPress={() => setShowAddSheet(true)}
              />
            </>
          }
        />

        <StudioTabs
          tabs={tabs}
          active={tab}
          accent="navy"
          onChange={(k) => setTab(k as PeopleTab)}
        />

        <View style={styles.filterRow}>
          <View style={styles.searchInput}>
            <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, email, cohort…"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={styles.searchInputField}
            />
          </View>
          <StudioButton variant="ghost" icon="funnel-outline" label="Cohort · all" />
          <StudioButton variant="ghost" icon="funnel-outline" label="Status · active" />
          <StudioButton variant="ghost" icon="swap-vertical-outline" label="Last active" />
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHead}>
            <View style={styles.colCheck} />
            <Text style={styles.colHeadText}>Person</Text>
            <Text style={[styles.colHeadText, { width: 130 }]}>Role</Text>
            <Text style={[styles.colHeadText, { width: 180 }]}>Cohort · placement</Text>
            <Text style={[styles.colHeadText, { width: 130 }]}>Last active</Text>
            <Text style={[styles.colHeadText, { width: 120 }]}>Status</Text>
            <View style={{ width: 32 }} />
          </View>
          <ScrollView style={styles.tableBody}>
            {filteredRows.length === 0 ? (
              <EmptyPeopleState search={search} />
            ) : (
              <>
                {filteredRows.map((row) => (
                  <PersonRow key={row.id} row={row} />
                ))}
                <Text style={styles.tableFooter}>
                  Showing {filteredRows.length} of {data.totalRows} ·{' '}
                  <Text style={styles.tableFooterLink}>load more</Text>
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </StudioShell>

      <AddPersonSheet
        visible={showAddSheet}
        orgId={orgId as string}
        invitedByUserId={user?.id ?? null}
        orgName={orgName}
        orgShortName={orgShortLabel}
        seatsAvailable={seatsAvailable}
        seatsTotal={data.seats.total}
        verifiedDomains={['jh.edu', 'jhmi.edu']}
        defaultBlueprints={['Adult Health I · M4', 'MSN second-year onboarding']}
        defaultCohortLabel="Spring '26 · MSN second-year"
        onClose={() => setShowAddSheet(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Person row + helpers
// ---------------------------------------------------------------------------

function PersonRow({ row }: { row: AdminPersonRow }) {
  const isPending = row.status === 'pending';
  const isOffboarded = row.status === 'off-boarded';
  const isSso = row.source === 'sso';

  return (
    <View
      style={[
        styles.tableRow,
        row.isYou && styles.tableRowYou,
        isPending && styles.tableRowPending,
        isOffboarded && styles.tableRowOffboarded,
      ]}
    >
      <View style={styles.colCheck} />
      <View style={styles.colPerson}>
        <View style={[styles.avi, { backgroundColor: row.gradient[0] }]}>
          {isPending ? (
            <Ionicons name="mail" size={14} color="rgba(60, 60, 67, 0.6)" />
          ) : (
            <Text style={styles.aviText}>{row.initials}</Text>
          )}
        </View>
        <View style={styles.personMeta}>
          <View style={styles.personNameRow}>
            <Text
              style={[
                styles.personName,
                isPending && styles.personNamePending,
                isOffboarded && styles.personNameOffboarded,
              ]}
              numberOfLines={1}
            >
              {row.name}
            </Text>
            {row.isYou ? <Text style={styles.youTag}>(you)</Text> : null}
            {isSso ? (
              <View style={styles.ssoTag}>
                <Text style={styles.ssoTagText}>SSO</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.personEmail, isPending && styles.personEmailItalic]} numberOfLines={1}>
            {row.email}
            {row.joinedNote ? ` · ${row.joinedNote}` : ''}
          </Text>
        </View>
      </View>
      <View style={[styles.colRole, { width: 130 }]}>
        {row.roles.map((role) => (
          <RoleBadge key={role} role={role} />
        ))}
      </View>
      <Text
        style={[
          styles.colCohort,
          { width: 180 },
          !row.cohortLabel && styles.colCohortMuted,
        ]}
        numberOfLines={1}
      >
        {row.cohortLabel ?? '—'}
      </Text>
      <Text style={[styles.colLastActive, { width: 130 }]} numberOfLines={1}>
        {row.lastActiveLabel}
      </Text>
      <View style={{ width: 120 }}>
        <StatusPill status={row.status} />
      </View>
      <Pressable hitSlop={8} style={{ width: 32, alignItems: 'center' }}>
        <Ionicons name="ellipsis-horizontal" size={16} color="rgba(60, 60, 67, 0.4)" />
      </Pressable>
    </View>
  );
}

const ROLE_BADGE_STYLES: Record<PersonRoleBadge, { bg: string; fg: string; label: string }> = {
  student: { bg: 'rgba(0, 122, 255, 0.10)', fg: '#007AFF', label: 'Student' },
  faculty: { bg: 'rgba(184, 90, 102, 0.16)', fg: '#B85A66', label: 'Faculty' },
  author: { bg: 'rgba(107, 91, 191, 0.14)', fg: '#6B5BBF', label: 'Author' },
  'co-author': { bg: 'rgba(107, 91, 191, 0.14)', fg: '#6B5BBF', label: 'Co-author' },
  mentor: { bg: 'rgba(60, 60, 67, 0.10)', fg: 'rgba(60, 60, 67, 0.85)', label: 'Mentor' },
  admin: { bg: 'rgba(40, 64, 107, 0.14)', fg: '#28406B', label: 'Admin' },
};

function RoleBadge({ role }: { role: PersonRoleBadge }) {
  const styleSet = ROLE_BADGE_STYLES[role];
  return (
    <View style={[styles.roleBadge, { backgroundColor: styleSet.bg }]}>
      <Text style={[styles.roleBadgeText, { color: styleSet.fg }]}>
        {styleSet.label}
      </Text>
    </View>
  );
}

function StatusPill({ status }: { status: PersonStatus }) {
  const cfg: Record<PersonStatus, { bg: string; fg: string; label: string }> = {
    active: { bg: 'rgba(52, 199, 89, 0.14)', fg: '#1E8F47', label: 'Active' },
    pending: { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632', label: 'Pending' },
    'off-boarded': { bg: 'rgba(0,0,0,0.06)', fg: 'rgba(60, 60, 67, 0.85)', label: 'Off-boarded' },
    suspended: { bg: 'rgba(255, 59, 48, 0.10)', fg: '#FF3B30', label: 'Suspended' },
  };
  const c = cfg[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusPillText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

function matchesTab(row: AdminPersonRow, tab: PeopleTab): boolean {
  switch (tab) {
    case 'students':
      return row.roles.includes('student');
    case 'authors':
      return row.roles.includes('author') || row.roles.includes('co-author');
    case 'mentors':
      return row.roles.includes('mentor');
    case 'admins':
      return row.roles.includes('admin');
    case 'pending':
      return row.status === 'pending';
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function EmptyPeopleState({ search }: { search: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={28} color="rgba(40, 64, 107, 0.5)" />
      <Text style={styles.emptyTitle}>
        {search ? 'No matches' : 'No people in this view'}
      </Text>
      <Text style={styles.emptyBody}>
        {search
          ? `Nothing matches "${search}". Try a different name, email, or cohort.`
          : 'Switch to another role tab or invite your first member with "Add person."'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Narrow screen gate
// ---------------------------------------------------------------------------

function NarrowScreenGate({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.gate}>
      <Ionicons name="desktop-outline" size={36} color="rgba(60, 60, 67, 0.4)" />
      <Text style={styles.gateTitle}>Org admin is a writing-class surface</Text>
      <Text style={styles.gateBody}>
        Managing seats, roles, and SSO is not a phone-screen job. Open on iPad or desktop.
      </Text>
      <StudioButton variant="ghost" icon="arrow-back" label="Back" onPress={onBack} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortNameLabel(orgName: string): string {
  if (orgName.includes(' · ')) return orgName.split(' · ').slice(0, 2).join(' ');
  const tokens = orgName.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return orgName;
  return tokens.map((t) => t[0]).join('').toUpperCase();
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFEAD8',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
  subText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.6)' },

  // Sub-h1 seat pill
  seatPillWrap: {},
  seatPill: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 64, 107, 0.12)',
  },
  seatPillText: { fontSize: 11, fontWeight: '600', color: '#28406B' },

  // Sidebar seats card
  seatsLabel: {
    fontSize: 10,
    color: '#28406B',
    letterSpacing: 0.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  seatsValue: {
    marginTop: 5,
    fontSize: 18,
    color: '#1C1C1E',
    fontWeight: '600',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  seatsValueSub: {
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '500',
  },
  seatsBar: {
    marginTop: 6,
    height: 4,
    backgroundColor: 'rgba(40, 64, 107, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seatsBarFill: {
    height: '100%',
    backgroundColor: '#28406B',
  },
  seatsFoot: {
    marginTop: 5,
    fontSize: 10.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 14,
  },

  // Filter row
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  searchInput: {
    flex: 1,
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputField: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // Table card
  tableCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    ...({ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as any),
  },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  colHeadText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
  },
  colCheck: { width: 30 },
  tableBody: { flex: 1 },

  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  tableRowYou: { backgroundColor: 'rgba(40, 64, 107, 0.025)' },
  tableRowPending: { backgroundColor: 'rgba(201, 150, 50, 0.04)' },
  tableRowOffboarded: { opacity: 0.6 },

  colPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  avi: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  personMeta: { flex: 1, minWidth: 0 },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  personName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  personNamePending: { color: 'rgba(60, 60, 67, 0.85)' },
  personNameOffboarded: { color: 'rgba(60, 60, 67, 0.85)' },
  youTag: { fontSize: 10, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  ssoTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
  },
  ssoTagText: {
    fontSize: 9.5,
    color: 'rgba(60, 60, 67, 0.6)',
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  personEmail: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },
  personEmailItalic: { fontStyle: 'italic' },

  colRole: { flexDirection: 'column', gap: 3 },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  colCohort: { fontSize: 12, color: 'rgba(60, 60, 67, 0.85)' },
  colCohortMuted: { color: 'rgba(60, 60, 67, 0.4)', fontStyle: 'italic' },
  colLastActive: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },

  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 11, fontWeight: '600' },

  tableFooter: {
    textAlign: 'center',
    paddingVertical: 14,
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.6)',
  },
  tableFooterLink: { color: '#007AFF' },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', marginTop: 4 },
  emptyBody: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 380,
  },

  // Narrow gate
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
    backgroundColor: '#EFEAD8',
  },
  gateTitle: { fontSize: 22, fontWeight: '600', color: '#1C1C1E', textAlign: 'center' },
  gateBody: {
    fontSize: 14,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 420,
  },
});
