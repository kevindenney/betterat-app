/**
 * useAdminPeople
 *
 * Data shape for Org Admin · People (Frame 7 of the institutions pass).
 * Stubbed today — backing queries land alongside Phase 4b once admin RLS
 * is decided. Returns demo rows so the Frame 7 layout reads correctly
 * during design review; swap to real org membership rows once admin
 * read-paths are wired.
 *
 * TODO:
 *   - Query organization_memberships for org_id with joined auth.users and
 *     cohort + placement metadata
 *   - SSO origin badge from organization_memberships.verification_source
 *   - Pagination cursor (limit 50, "load more")
 *   - Real filter chips (cohort dropdown, status, last-active sort)
 */

import { useMemo } from 'react';

export type PersonRoleBadge =
  | 'student'
  | 'faculty'
  | 'author'
  | 'mentor'
  | 'admin'
  | 'co-author';

export type PersonStatus = 'active' | 'pending' | 'off-boarded' | 'suspended';

export type PersonSource = 'invite' | 'sso' | 'self-join' | null;

export interface AdminPersonRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  gradient: [string, string];
  roles: PersonRoleBadge[];
  cohortLabel: string | null;
  lastActiveLabel: string;
  status: PersonStatus;
  source: PersonSource;
  isYou: boolean;
  joinedNote?: string | null;
}

export interface AdminPeopleData {
  loading: boolean;
  rows: AdminPersonRow[];
  totalRows: number;
  counts: {
    all: number;
    students: number;
    authors: number;
    mentors: number;
    admins: number;
    pending: number;
  };
  seats: { used: number; total: number; renewsAt: string };
  lastSsoSyncLabel: string;
}

const DEMO_ROWS: AdminPersonRow[] = [
  {
    id: 'demo-murphy',
    name: 'Dr. K. Murphy',
    email: 'k.murphy@jhmi.edu',
    initials: 'KM',
    gradient: ['#B85A66', '#7A6A8E'],
    roles: ['faculty', 'author'],
    cohortLabel: "Spring '26 mentor",
    lastActiveLabel: 'Active now',
    status: 'active',
    source: null,
    isYou: false,
  },
  {
    id: 'demo-patel',
    name: 'Dr. A. Patel',
    email: 'a.patel@jhmi.edu',
    initials: 'AP',
    gradient: ['#5A8DB8', '#4E6A85'],
    roles: ['faculty', 'co-author'],
    cohortLabel: 'Adult Health I · M4',
    lastActiveLabel: '3h ago',
    status: 'active',
    source: null,
    isYou: false,
  },
  {
    id: 'demo-park',
    name: 'Dean S. Park',
    email: 's.park@jhmi.edu',
    initials: 'SP',
    gradient: ['#28406B', '#4E6A85'],
    roles: ['admin'],
    cohortLabel: null,
    lastActiveLabel: 'Active now',
    status: 'active',
    source: null,
    isYou: true,
  },
  {
    id: 'demo-shaw',
    name: 'Emily Shaw',
    email: 'eshaw@jh.edu',
    initials: 'ES',
    gradient: ['#7A6A8E', '#4E6A85'],
    roles: ['student'],
    cohortLabel: "Spring '26 · 4-South",
    lastActiveLabel: 'Active 14m ago',
    status: 'active',
    source: 'invite',
    isYou: false,
  },
  {
    id: 'demo-reyes',
    name: 'Maya Reyes',
    email: 'mreyes@jh.edu',
    initials: 'MR',
    gradient: ['#B85A66', '#7C7B6E'],
    roles: ['student'],
    cohortLabel: "Spring '26 · Bayview",
    lastActiveLabel: '1h ago',
    status: 'active',
    source: 'invite',
    isYou: false,
  },
  {
    id: 'demo-lin',
    name: 'jlin@jh.edu',
    email: 'jlin@jh.edu',
    initials: '@',
    gradient: ['#E5E5EA', '#C7C7CC'],
    roles: ['student'],
    cohortLabel: "Spring '26 · 4-South",
    lastActiveLabel: '—',
    status: 'pending',
    source: 'invite',
    isYou: false,
    joinedNote: 'Invited 2 days ago · not redeemed',
  },
  {
    id: 'demo-kim',
    name: 'Jordan Kim',
    email: 'jkim@jh.edu',
    initials: 'JK',
    gradient: ['#5A8DB8', '#4E6A85'],
    roles: ['student'],
    cohortLabel: "Spring '26 · 4-South",
    lastActiveLabel: 'Yesterday',
    status: 'active',
    source: 'sso',
    isYou: false,
    joinedNote: 'joined via SAML 4 days ago',
  },
  {
    id: 'demo-hashemi',
    name: 'T. Hashemi',
    email: 'thashemi@jh.edu',
    initials: 'TH',
    gradient: ['#D1D1D6', '#C7C7CC'],
    roles: ['student'],
    cohortLabel: "Spring '26 · removed",
    lastActiveLabel: 'Apr 18',
    status: 'off-boarded',
    source: null,
    isYou: false,
    joinedNote: 'left program Apr 2026',
  },
];

export function useAdminPeople(_orgId: string): AdminPeopleData {
  // TODO: wire to real queries. Today, returns demo data shaped like Frame 7.
  const rows = DEMO_ROWS;

  const counts = useMemo(
    () => ({
      all: rows.length,
      students: rows.filter((r) => r.roles.includes('student')).length,
      authors: rows.filter((r) => r.roles.includes('author') || r.roles.includes('co-author')).length,
      mentors: rows.filter((r) => r.roles.includes('mentor')).length,
      admins: rows.filter((r) => r.roles.includes('admin')).length,
      pending: rows.filter((r) => r.status === 'pending').length,
    }),
    [rows],
  );

  return {
    loading: false,
    rows,
    totalRows: 312,                  // demo summary "Showing N of 312"
    counts,
    seats: { used: 312, total: 350, renewsAt: 'Aug 15' },
    lastSsoSyncLabel: '12 min ago',
  };
}
