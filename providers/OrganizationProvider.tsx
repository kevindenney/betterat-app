import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { realtimeService } from '@/services/RealtimeService';
import { fetchOrgMembershipRows, orgMembershipsQueryKey } from '@/hooks/orgMembershipsQuery';
import { createLogger } from '@/lib/utils/logger';
import { isAbortError } from '@/lib/utils/fetchWithTimeout';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const logger = createLogger('OrganizationProvider');

export type OrganizationType =
  | 'club'
  | 'institution'
  | 'association'
  | 'business'
  | 'community'
  | 'other';

export type WorkspaceDomain = 'sailing' | 'nursing' | 'drawing' | 'fitness' | 'generic';
type ResolvedActiveInterest = {
  id: string | null;
  slug: string | null;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string | null;
  interest_slug?: string | null;
  organization_type: OrganizationType;
  verification_mode: string | null;
  allowed_email_domains: string[] | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
};

export type OrganizationMembershipRecord = {
  id: string;
  organization_id: string;
  role: string;
  status: string;
  membership_status: string;
  is_verified: boolean;
  verification_source: string | null;
  joined_at: string | null;
  created_at: string | null;
  organization: OrganizationRecord | null;
};

type RawOrganizationMembershipRecord = Omit<OrganizationMembershipRecord, 'organization' | 'membership_status'> & {
  membership_status?: string;
  organization: OrganizationRecord | OrganizationRecord[] | null;
};

type OrganizationVisibilityDefault = 'public' | 'org_members';
type MembershipLoadDebug = {
  startedAt: string;
  finishedAt: string | null;
  hasSession: boolean;
  userId: string | null;
  phase: 'start' | 'success' | 'error' | 'timeout';
  table: 'organization_memberships';
  errorMessage: string | null;
  errorCode: string | null;
  errorDetails: string | null;
  errorHint: string | null;
};
type MembershipLoadErrorPayload = {
  userId: string | null;
  table: 'organization_memberships';
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
  status: number | null;
  timedOut: boolean;
  hasSession: boolean;
};

type OrganizationContextValue = {
  organizationProviderActive: boolean;
  loading: boolean;
  ready: boolean;
  providerMountedAt: string | null;
  membershipLoadAttempt: number;
  membershipLoadError: string | null;
  membershipLoadDebug: MembershipLoadDebug | null;
  membershipLoadErrorPayload: MembershipLoadErrorPayload | null;
  memberships: OrganizationMembershipRecord[];
  activeOrganizationId: string | null;
  activeMembership: OrganizationMembershipRecord | null;
  activeOrganization: OrganizationRecord | null;
  activeInterestId: string | null;
  activeInterestSlug: string | null;
  activeDomain: WorkspaceDomain;
  isSailingDomain: boolean;
  isNursingDomain: boolean;
  setActiveOrganizationId: (organizationId: string | null) => Promise<void>;
  refreshMemberships: () => Promise<void>;
  canManageActiveOrganization: boolean;
  defaultContentVisibility: OrganizationVisibilityDefault;
  updateDefaultContentVisibility: (visibility: OrganizationVisibilityDefault) => Promise<void>;
};

const ACTIVE_STATUSES = new Set(['active', 'verified']);
// The provider's old DB filter was `.in('status', [...])` on the status
// column. Re-applied client-side now that the shared read is unfiltered.
const MEMBERSHIP_DB_STATUSES = new Set(['active', 'verified', 'pending', 'invited']);
const MANAGER_ROLES = new Set(['owner', 'admin', 'manager', 'faculty', 'instructor']);

// Mirrors the old DB `.order('created_at', { ascending: false })`. Stable
// (Array.sort is stable in Hermes/V8) so equal-created_at rows keep input
// order — the closest faithful match to Postgres' unspecified tie order.
function byCreatedAtDesc(a: OrganizationMembershipRecord, b: OrganizationMembershipRecord): number {
  const av = a.created_at ?? '';
  const bv = b.created_at ?? '';
  if (av === bv) return 0;
  return av < bv ? 1 : -1;
}
const STORAGE_KEY = 'betterat.active_org_id';
const LEGACY_STORAGE_KEY = 'rf_active_organization_id';
let hasLoggedMissingOrganizationProvider = false;

const Ctx = createContext<OrganizationContextValue>({
  organizationProviderActive: false,
  loading: false,
  ready: false,
  providerMountedAt: null,
  membershipLoadAttempt: 0,
  membershipLoadError: null,
  membershipLoadDebug: null,
  membershipLoadErrorPayload: null,
  memberships: [],
  activeOrganizationId: null,
  activeMembership: null,
  activeOrganization: null,
  activeInterestId: null,
  activeInterestSlug: null,
  activeDomain: 'generic',
  isSailingDomain: false,
  isNursingDomain: false,
  setActiveOrganizationId: async () => {},
  refreshMemberships: async () => {},
  canManageActiveOrganization: false,
  defaultContentVisibility: 'public',
  updateDefaultContentVisibility: async () => {},
});

const getStoredActiveOrganizationId = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    }
    return (await AsyncStorage.getItem(STORAGE_KEY)) || (await AsyncStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return null;
  }
};

const storeActiveOrganizationId = async (organizationId: string | null): Promise<void> => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (organizationId) {
        window.localStorage.setItem(STORAGE_KEY, organizationId);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      return;
    }
    if (organizationId) {
      await AsyncStorage.setItem(STORAGE_KEY, organizationId);
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // no-op
  }
};

const isOrgSchemaMissingError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error?.code ?? '');
  const message = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`.toLowerCase();
  return (
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('organization_memberships') ||
    message.includes('organizations')
  );
};

function normalizeMembershipRow(row: RawOrganizationMembershipRecord): OrganizationMembershipRecord {
  const organization = Array.isArray(row.organization) ? (row.organization[0] ?? null) : (row.organization ?? null);
  const membershipStatus = typeof (row as any).membership_status === 'string'
    ? (row as any).membership_status
    : row.status;
  return {
    ...row,
    membership_status: membershipStatus,
    organization,
  };
}

function dedupeMemberships(rows: OrganizationMembershipRecord[]): OrganizationMembershipRecord[] {
  const byOrgId = new Map<string, OrganizationMembershipRecord>();
  for (const row of rows) {
    if (!row.organization_id) continue;
    if (!byOrgId.has(row.organization_id)) {
      byOrgId.set(row.organization_id, row);
    }
  }

  const seenNameType = new Set<string>();
  const deduped: OrganizationMembershipRecord[] = [];
  for (const row of byOrgId.values()) {
    const orgName = row.organization?.name?.trim().toLowerCase() || '';
    const orgType = row.organization?.organization_type || '';
    const orgSlug = row.organization?.slug?.trim().toLowerCase() || '';
    const nameTypeKey = orgSlug || `${orgType}|${orgName}`;

    if (nameTypeKey && seenNameType.has(nameTypeKey)) {
      continue;
    }
    if (nameTypeKey) {
      seenNameType.add(nameTypeKey);
    }
    deduped.push(row);
  }

  return deduped;
}

function getMembershipStatusValue(row: OrganizationMembershipRecord): string {
  return String(row.membership_status || row.status || '').toLowerCase();
}

function isActiveMembership(row: OrganizationMembershipRecord): boolean {
  return ACTIVE_STATUSES.has(getMembershipStatusValue(row));
}

function rankActiveMembershipStatus(row: OrganizationMembershipRecord): number {
  const normalized = getMembershipStatusValue(row);
  if (normalized === 'active' || normalized === 'verified') return 0;
  if (normalized === 'pending' || normalized === 'invited') return 1;
  return 2;
}

function resolvePreferredActiveOrgId(
  rows: OrganizationMembershipRecord[],
  currentActiveOrgId: string | null
): string | null {
  const activeRows = rows.filter(isActiveMembership);
  if (activeRows.length === 0) return null;

  if (currentActiveOrgId) {
    const current = activeRows.find((row) => row.organization_id === currentActiveOrgId);
    if (current) return current.organization_id;
  }

  const activeManagerRows = activeRows.filter((row) =>
    MANAGER_ROLES.has(String(row.role || '').toLowerCase())
  );
  return activeManagerRows[0]?.organization_id ?? activeRows[0]?.organization_id ?? null;
}

function normalizeRealtimeMembershipRow(
  row: Record<string, any>,
  existing: OrganizationMembershipRecord | undefined
): OrganizationMembershipRecord {
  return {
    id: String(row.id || existing?.id || ''),
    organization_id: String(row.organization_id || existing?.organization_id || ''),
    role: String(row.role || existing?.role || 'member'),
    status: String(row.status || existing?.status || ''),
    membership_status: String(
      row.membership_status || row.status || existing?.membership_status || existing?.status || ''
    ),
    is_verified: Boolean(
      row.is_verified ?? existing?.is_verified ?? false
    ),
    verification_source: row.verification_source ?? existing?.verification_source ?? null,
    joined_at: row.joined_at ?? existing?.joined_at ?? null,
    created_at: row.created_at ?? existing?.created_at ?? null,
    organization: existing?.organization ?? null,
  };
}

function resolveWorkspaceDomain(org: OrganizationRecord | null): WorkspaceDomain {
  if (!org) return 'generic';

  const metadata = (org.metadata as any) || {};
  const domainFromMetadata = String(metadata?.domain || '').toLowerCase().trim();
  if (domainFromMetadata.includes('sail')) return 'sailing';
  if (domainFromMetadata.includes('nurs')) return 'nursing';
  if (domainFromMetadata.includes('draw') || domainFromMetadata.includes('art')) return 'drawing';
  if (domainFromMetadata.includes('fit') || domainFromMetadata.includes('coach')) return 'fitness';

  const interestSlug = String(
    metadata?.active_interest_slug ||
      metadata?.interest_slug ||
      '',
  )
    .toLowerCase()
    .trim();
  if (interestSlug.includes('sail') || interestSlug.includes('regatta')) return 'sailing';
  if (interestSlug.includes('nurs') || interestSlug.includes('clinical')) return 'nursing';
  if (interestSlug.includes('draw') || interestSlug.includes('art')) return 'drawing';
  if (interestSlug.includes('health') || interestSlug.includes('fit') || interestSlug.includes('golf')) return 'fitness';

  if (org.organization_type === 'institution') return 'nursing';
  if (org.organization_type === 'club') return 'sailing';
  return 'generic';
}

function normalizeInterestSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const next = value.trim().toLowerCase();
  return next.length > 0 ? next : null;
}

function normalizeInterestId(value: unknown): string | null {
  if (typeof value === 'string') {
    const next = value.trim();
    return next.length > 0 ? next : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function resolveActiveInterest(metadata: Record<string, unknown>): ResolvedActiveInterest {
  const nested = (metadata.active_interest as Record<string, unknown> | undefined) || {};
  const id =
    normalizeInterestId(metadata.active_interest_id) ||
    normalizeInterestId(metadata.interest_id) ||
    normalizeInterestId(nested.id) ||
    null;
  const slug =
    normalizeInterestSlug(metadata.active_interest_slug) ||
    normalizeInterestSlug(metadata.interest_slug) ||
    normalizeInterestSlug(nested.slug) ||
    null;

  return { id, slug };
}

function defaultInterestSlugForDomain(domain: WorkspaceDomain): string | null {
  if (domain === 'sailing') return 'sail-racing';
  if (domain === 'nursing') return 'nursing';
  if (domain === 'drawing') return 'drawing';
  if (domain === 'fitness') return 'fitness';
  return null;
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, signedIn } = useAuth();
  const queryClient = useQueryClient();
  const signedInRef = React.useRef(signedIn);
  const userIdRef = React.useRef<string | null>(user?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [providerMountedAt, setProviderMountedAt] = useState<string | null>(null);
  const [membershipLoadAttempt, setMembershipLoadAttempt] = useState(0);
  const [membershipLoadError, setMembershipLoadError] = useState<string | null>(null);
  const [membershipLoadDebug, setMembershipLoadDebug] = useState<MembershipLoadDebug | null>(null);
  const [membershipLoadErrorPayload, setMembershipLoadErrorPayload] = useState<MembershipLoadErrorPayload | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembershipRecord[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(null);
  const activeOrganizationIdRef = React.useRef<string | null>(null);
  const membershipRealtimeCommitRef = React.useRef<Map<string, number>>(new Map());
  const membershipRealtimeSubscribedOnceRef = React.useRef(false);
  // Inflight guard — dedupe concurrent refreshMemberships calls so we don't
  // stack supabase.auth.getSession() / membership queries behind each other's
  // locks (the Nth call would otherwise exceed the 10s client timeout even
  // when the server responds quickly).
  const refreshInflightRef = React.useRef<Promise<void> | null>(null);

  useEffect(() => {
    signedInRef.current = signedIn;
    userIdRef.current = user?.id ?? null;
  }, [signedIn, user?.id]);

  useEffect(() => {
    membershipRealtimeSubscribedOnceRef.current = false;
    membershipRealtimeCommitRef.current.clear();
  }, [user?.id]);

  useEffect(() => {
    activeOrganizationIdRef.current = activeOrganizationId;
  }, [activeOrganizationId]);

  useEffect(() => {
    const mountedAt = new Date().toISOString();
    setProviderMountedAt(mountedAt);
    logger.debug('mounted', mountedAt);
  }, []);

  const doRefreshMembershipsRef = React.useRef<() => Promise<void>>(async () => {});

  const refreshMemberships = useCallback(async (): Promise<void> => {
    // Dedupe: if a refresh is already running, return the same promise so
    // callers await the existing work instead of spawning parallel queries
    // that would each take a supabase-js auth lock and pile up behind each
    // other (the Nth would exceed the 10s client timeout even when the
    // server responds in ~300ms).
    if (refreshInflightRef.current) {
      return refreshInflightRef.current;
    }
    const run = doRefreshMembershipsRef.current();
    refreshInflightRef.current = run;
    try {
      await run;
    } finally {
      refreshInflightRef.current = null;
    }
  }, []);

  doRefreshMembershipsRef.current = async () => {
    const currentSignedIn = signedInRef.current;
    const currentUserId = userIdRef.current;
    const startedAt = new Date().toISOString();
    setMembershipLoadAttempt((prev) => prev + 1);
    setMembershipLoadDebug({
      startedAt,
      finishedAt: null,
      hasSession: false,
      userId: currentUserId,
      phase: 'start',
      table: 'organization_memberships',
      errorMessage: null,
      errorCode: null,
      errorDetails: null,
      errorHint: null,
    });
    let hasSession = false;
    try {
      const sessionTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('SESSION_TIMEOUT'));
        }, 10000);
      });
      const { data: sessionData } = await Promise.race([supabase.auth.getSession(), sessionTimeout]);
      hasSession = Boolean(sessionData?.session);
      setMembershipLoadDebug({
        startedAt,
        finishedAt: null,
        hasSession: true,
        userId: currentUserId,
        phase: 'start',
        table: 'organization_memberships',
        errorMessage: null,
        errorCode: null,
        errorDetails: null,
        errorHint: null,
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error ?? '');
      const timedOut = rawMessage === 'SESSION_TIMEOUT';
      const payload: MembershipLoadErrorPayload = {
        userId: currentUserId,
        table: 'organization_memberships',
        message: rawMessage || 'Unknown session load error',
        code: typeof (error as any)?.code === 'string' ? (error as any).code : null,
        details: typeof (error as any)?.details === 'string' ? (error as any).details : null,
        hint: typeof (error as any)?.hint === 'string' ? (error as any).hint : null,
        status: typeof (error as any)?.status === 'number'
          ? (error as any).status
          : typeof (error as any)?.statusCode === 'number'
            ? (error as any).statusCode
            : null,
        timedOut,
        hasSession: false,
      };
      if (isAbortError(error)) return;
      if (timedOut) {
        logger.warn('Session load timed out; continuing without organization context', payload);
        setMembershipLoadError(null);
        setMembershipLoadErrorPayload(payload);
        setMembershipLoadDebug({
          startedAt,
          finishedAt: new Date().toISOString(),
          hasSession: false,
          userId: currentUserId,
          phase: 'timeout',
          table: 'organization_memberships',
          errorMessage: 'SESSION_TIMEOUT',
          errorCode: payload.code,
          errorDetails: payload.details,
          errorHint: payload.hint,
        });
        setMemberships([]);
        setActiveOrganizationIdState(null);
        setLoading(false);
        setReady(true);
        return;
      }
      logger.error('Session load failed', payload);
      setMembershipLoadError('Could not load organizations. Retry.');
      setMembershipLoadErrorPayload(payload);
      setMembershipLoadDebug({
        startedAt,
        finishedAt: new Date().toISOString(),
        hasSession: false,
        userId: currentUserId,
        phase: timedOut ? 'timeout' : 'error',
        table: 'organization_memberships',
        errorMessage: timedOut ? 'SESSION_TIMEOUT' : (rawMessage || 'Unknown session load error'),
        errorCode: payload.code,
        errorDetails: payload.details,
        errorHint: payload.hint,
      });
      setMemberships([]);
      setActiveOrganizationIdState(null);
      setLoading(false);
      setReady(true);
      return;
    }
    if (!currentSignedIn || !currentUserId || !hasSession) {
      setMembershipLoadError(null);
      setMembershipLoadErrorPayload(null);
      setMembershipLoadDebug({
        startedAt,
        finishedAt: new Date().toISOString(),
        hasSession,
        userId: currentUserId,
        phase: 'error',
        table: 'organization_memberships',
        errorMessage: 'No active session',
        errorCode: null,
        errorDetails: null,
        errorHint: null,
      });
      setMemberships([]);
      setActiveOrganizationIdState(null);
      setLoading(false);
      setReady(true);
      return;
    }

    setLoading(true);
    setMembershipLoadError(null);
    setMembershipLoadErrorPayload(null);
    try {
      // Shared cached read (key ['profile-menu-orgs', userId]) — the same
      // query useProfileMenuData runs. fetchQuery dedupes the in-flight
      // request on cold mount and force-refreshes on explicit refresh; no
      // hand-rolled timeout race (the old ORG_MEMBERSHIP_TIMEOUT source).
      const data = await queryClient.fetchQuery({
        queryKey: orgMembershipsQueryKey(currentUserId),
        queryFn: () => fetchOrgMembershipRows(currentUserId),
      });

      // The shared read applies NO status filter and NO ordering — re-apply
      // the provider's old DB semantics client-side: status ∈ the 4-set,
      // then created_at desc (stable), then dedupe (keeps newest per org).
      const normalized = (data as unknown as RawOrganizationMembershipRecord[]).map(normalizeMembershipRow);
      const filtered = normalized.filter((row) =>
        MEMBERSHIP_DB_STATUSES.has(String(row.status || '').toLowerCase())
      );
      const sorted = [...filtered].sort(byCreatedAtDesc);
      const rows = dedupeMemberships(sorted);
      membershipRealtimeCommitRef.current.clear();
      setMemberships(rows);

      const storedId = await getStoredActiveOrganizationId();
      const activeRows = rows.filter(isActiveMembership);
      const activeManagerRows = activeRows.filter((row) =>
        MANAGER_ROLES.has(String(row.role || '').toLowerCase())
      );

      // Preserve existing in-memory choice first, then persisted choice, but only if still ACTIVE.
      // Read from ref (not the state closure) so this function is not rebuilt
      // every time activeOrganizationId changes — that was causing the useEffect
      // that depends on `refreshMemberships` to re-fire after every load.
      const currentActiveOrgId = activeOrganizationIdRef.current;
      const inMemoryActive = currentActiveOrgId
        ? activeRows.find((row) => row.organization_id === currentActiveOrgId)
        : null;
      const storedActive = storedId
        ? activeRows.find((row) => row.organization_id === storedId)
        : null;

      const preferredMembership =
        inMemoryActive ||
        storedActive ||
        activeManagerRows[0] ||
        activeRows[0] ||
        null;

      const nextId = preferredMembership?.organization_id ?? null;
      setActiveOrganizationIdState(nextId);
      await storeActiveOrganizationId(nextId);
      setMembershipLoadDebug({
        startedAt,
        finishedAt: new Date().toISOString(),
        hasSession: true,
        userId: currentUserId,
        phase: 'success',
        table: 'organization_memberships',
        errorMessage: null,
        errorCode: null,
        errorDetails: null,
        errorHint: null,
      });
    } catch (error) {
      // Missing org schema (fresh DB / migrations not applied) is an empty
      // state, not a load failure — keep it silent as the inline read did.
      if (isOrgSchemaMissingError(error)) {
        setMembershipLoadError(null);
        setMembershipLoadErrorPayload(null);
        setMemberships([]);
        setActiveOrganizationIdState(null);
        return;
      }
      const rawMessage = error instanceof Error ? error.message : String(error ?? '');
      const timedOut = rawMessage === 'ORG_MEMBERSHIP_TIMEOUT';
      const { data: latestSessionData } = await supabase.auth.getSession();
      const latestHasSession = Boolean(latestSessionData?.session);
      const payload: MembershipLoadErrorPayload = {
        userId: currentUserId,
        table: 'organization_memberships',
        message: rawMessage || 'Unknown membership load error',
        code: typeof (error as any)?.code === 'string' ? (error as any).code : null,
        details: typeof (error as any)?.details === 'string' ? (error as any).details : null,
        hint: typeof (error as any)?.hint === 'string' ? (error as any).hint : null,
        status: typeof (error as any)?.status === 'number'
          ? (error as any).status
          : typeof (error as any)?.statusCode === 'number'
            ? (error as any).statusCode
            : null,
        timedOut,
        hasSession: latestHasSession,
      };
      if (!isAbortError(error)) {
        if (timedOut) {
          logger.warn('Membership load timed out; continuing without organization context', payload);
        } else {
          logger.error('Membership load failed', payload);
        }
      }
      setMembershipLoadDebug({
        startedAt,
        finishedAt: new Date().toISOString(),
        hasSession: latestHasSession,
        userId: currentUserId,
        phase: timedOut ? 'timeout' : 'error',
        table: 'organization_memberships',
        errorMessage: rawMessage || 'Unknown membership load error',
        errorCode: payload.code,
        errorDetails: payload.details,
        errorHint: payload.hint,
      });
      if (rawMessage === 'ORG_MEMBERSHIP_TIMEOUT') {
        setMembershipLoadError(null);
      } else {
        const errorCode = typeof (error as any)?.code === 'string' ? (error as any).code : null;
        setMembershipLoadError(`Could not load organizations. ${rawMessage || 'Retry.'}${errorCode ? ` (${errorCode})` : ''}`);
      }
      setMembershipLoadErrorPayload(payload);
      setMemberships([]);
      setActiveOrganizationIdState(null);
    } finally {
      setLoading(false);
      setReady(true);
    }
  };

  useEffect(() => {
    void refreshMemberships();
  }, [refreshMemberships, signedIn, user?.id]);

  useEffect(() => {
    if (!signedIn || !user?.id) return;

    const channelName = `org-memberships:${user.id}`;
    const handleMembershipChange = (payload: RealtimePostgresChangesPayload<any>) => {
      const payloadRowId = String((payload.new as any)?.id || (payload.old as any)?.id || '');
      if (!payloadRowId) return;
      const commitTime = new Date(payload.commit_timestamp || Date.now()).getTime();
      const knownCommitTime = membershipRealtimeCommitRef.current.get(payloadRowId) ?? Number.NEGATIVE_INFINITY;
      if (commitTime < knownCommitTime) {
        return;
      }
      membershipRealtimeCommitRef.current.set(payloadRowId, commitTime);

      setMemberships((prev) => {
        let next = prev;
        if (payload.eventType === 'DELETE') {
          const deletedId = String((payload.old as any)?.id || '');
          next = prev.filter((row) => row.id !== deletedId);
        } else {
          const incoming = payload.new as Record<string, any>;
          const incomingId = String(incoming?.id || '');
          if (!incomingId) return prev;
          const existing = prev.find((row) => row.id === incomingId);
          const normalized = normalizeRealtimeMembershipRow(incoming, existing);
          const withoutIncoming = prev.filter((row) => row.id !== incomingId);
          next = dedupeMemberships([normalized, ...withoutIncoming]).sort((a, b) => {
            const statusRank = rankActiveMembershipStatus(a) - rankActiveMembershipStatus(b);
            if (statusRank !== 0) return statusRank;
            return String(a.organization?.name || '').localeCompare(String(b.organization?.name || ''));
          });
        }

        const nextActiveOrgId = resolvePreferredActiveOrgId(next, activeOrganizationIdRef.current);
        if (nextActiveOrgId !== activeOrganizationIdRef.current) {
          activeOrganizationIdRef.current = nextActiveOrgId;
          setActiveOrganizationIdState(nextActiveOrgId);
          void storeActiveOrganizationId(nextActiveOrgId);
        }
        return next;
      });
    };
    const handleMembershipStatus = (status: string) => {
      if (status === 'SUBSCRIBED') {
        if (membershipRealtimeSubscribedOnceRef.current) {
          void refreshMemberships();
        } else {
          membershipRealtimeSubscribedOnceRef.current = true;
        }
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        void refreshMemberships();
      }
    };

    realtimeService.subscribe(
      channelName,
      {
        event: '*',
        schema: 'public',
        table: 'organization_memberships',
        filter: `user_id=eq.${user.id}`,
        onStatus: handleMembershipStatus,
      },
      handleMembershipChange,
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handleMembershipChange, handleMembershipStatus);
    };
  }, [refreshMemberships, signedIn, user?.id]);

  const setActiveOrganizationId = useCallback(async (organizationId: string | null) => {
    if (!organizationId) {
      setActiveOrganizationIdState(null);
      await storeActiveOrganizationId(null);
      return;
    }

    const target = memberships.find((row) => row.organization_id === organizationId) ?? null;
    if (!target || !isActiveMembership(target)) {
      return;
    }

    setActiveOrganizationIdState(organizationId);
    await storeActiveOrganizationId(organizationId);
  }, [memberships]);

  const activeMembership = useMemo(() => {
    if (!activeOrganizationId) return null;
    return memberships.find((row) => row.organization_id === activeOrganizationId) ?? null;
  }, [activeOrganizationId, memberships]);

  const activeOrganization = activeMembership?.organization ?? null;
  const activeOrgMetadata = useMemo<Record<string, unknown>>(
    () => ((activeOrganization?.metadata as Record<string, unknown> | null) || {}),
    [activeOrganization?.metadata]
  );
  const resolvedActiveInterest = useMemo<ResolvedActiveInterest>(
    () => resolveActiveInterest(activeOrgMetadata),
    [activeOrgMetadata]
  );
  const activeInterestId = resolvedActiveInterest.id;
  const activeDomain = useMemo<WorkspaceDomain>(
    () => resolveWorkspaceDomain(activeOrganization),
    [activeOrganization]
  );
  const activeInterestSlug = useMemo<string | null>(
    () => resolvedActiveInterest.slug || defaultInterestSlugForDomain(activeDomain),
    [activeDomain, resolvedActiveInterest.slug]
  );
  const isSailingDomain = activeDomain === 'sailing';
  const isNursingDomain = activeDomain === 'nursing';

  const canManageActiveOrganization = useMemo(() => {
    if (!activeMembership) return false;
    return isActiveMembership(activeMembership)
      && MANAGER_ROLES.has(String(activeMembership.role || '').toLowerCase());
  }, [activeMembership]);

  const defaultContentVisibility: OrganizationVisibilityDefault = useMemo(() => {
    const raw = activeOrganization?.metadata?.default_content_visibility;
    return raw === 'org_members' ? 'org_members' : 'public';
  }, [activeOrganization?.metadata]);

  const updateDefaultContentVisibility = useCallback(
    async (visibility: OrganizationVisibilityDefault) => {
      if (!activeOrganization?.id || !canManageActiveOrganization) return;
      const metadata = {
        ...(activeOrganization.metadata || {}),
        default_content_visibility: visibility,
      };

      const { error } = await supabase
        .from('organizations')
        .update({ metadata })
        .eq('id', activeOrganization.id);

      if (error) throw error;

      await refreshMemberships();
    },
    [activeOrganization?.id, activeOrganization?.metadata, canManageActiveOrganization, refreshMemberships],
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizationProviderActive: true,
      loading,
      ready,
      providerMountedAt,
      membershipLoadAttempt,
      membershipLoadError,
      membershipLoadDebug,
      membershipLoadErrorPayload,
      memberships,
      activeOrganizationId,
      activeMembership,
      activeOrganization,
      activeInterestId,
      activeInterestSlug,
      activeDomain,
      isSailingDomain,
      isNursingDomain,
      setActiveOrganizationId,
      refreshMemberships,
      canManageActiveOrganization,
      defaultContentVisibility,
      updateDefaultContentVisibility,
    }),
    [
      loading,
      ready,
      providerMountedAt,
      membershipLoadAttempt,
      membershipLoadError,
      membershipLoadDebug,
      membershipLoadErrorPayload,
      memberships,
      activeOrganizationId,
      activeMembership,
      activeOrganization,
      activeInterestId,
      activeInterestSlug,
      activeDomain,
      isSailingDomain,
      isNursingDomain,
      setActiveOrganizationId,
      refreshMemberships,
      canManageActiveOrganization,
      defaultContentVisibility,
      updateDefaultContentVisibility,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrganization() {
  const ctx = useContext(Ctx);
  if ((__DEV__ || process.env.NODE_ENV !== 'production') && !ctx.organizationProviderActive && !hasLoggedMissingOrganizationProvider) {
    hasLoggedMissingOrganizationProvider = true;
    logger.warn('useOrganization is running outside <OrganizationProvider>', {
      pathname: typeof window !== 'undefined' ? window.location?.pathname || null : null,
    });
  }
  return ctx;
}
