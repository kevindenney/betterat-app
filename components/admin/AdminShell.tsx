/**
 * AdminShell — wraps StudioShell with the standard navy admin chrome so
 * each page in /admin/[orgId]/* doesn't have to rebuild the sidebar.
 *
 * Each page passes an `activeKey` matching one of the nav items and
 * renders its children inside the main slot. The hook reads real
 * org-scoped data for the nav badge counts (People · Cohorts · Sites).
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { getDashboardRoute } from '@/lib/utils/userTypeRouting';
import { isOrgAdminRole } from '@/lib/organizations/roleLabels';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { useAdminPeople } from '@/hooks/useAdminPeople';
import { useAdminOrgSites } from '@/hooks/useAdminOrgSites';
import { useAdminCohorts } from '@/hooks/useAdminCohorts';
import { useAdminPrograms } from '@/hooks/useAdminPrograms';
import { useAdminOrgBlueprints } from '@/hooks/useAdminOrgBlueprints';
import { useAdminCalendar } from '@/hooks/useAdminCalendar';
import {
  StudioShell,
  StudioNavSection,
  StudioAccent,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';
import { getAdminVocabulary } from '@/lib/vocabulary';

export type AdminNavKey =
  | 'overview'
  | 'people'
  | 'calendar'
  | 'cohorts'
  | 'programs'
  | 'blueprints'
  | 'sites'
  | 'insights'
  | 'billing'
  | 'invoices'
  | 'payouts'
  | 'sso'
  | 'domain'
  | 'audit';

export interface AdminShellProps {
  activeKey: AdminNavKey;
  accent?: StudioAccent;
  children: React.ReactNode;
}

export function AdminShell({ activeKey, accent = 'navy', children }: AdminShellProps) {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { user, userProfile, signOut, ready } = useAuth();
  const menu = useProfileMenuData();
  const people = useAdminPeople(orgId as string);
  const sites = useAdminOrgSites(orgId as string);
  const cohorts = useAdminCohorts(orgId as string);
  const programs = useAdminPrograms(orgId as string);
  const blueprints = useAdminOrgBlueprints(orgId as string);
  const calendar = useAdminCalendar(orgId as string);

  // Only admins of *this* org may see the Studio chrome. Without this gate
  // any signed-in account that lands on a stale /admin/<orgId> URL (e.g. a
  // browser tab left over from a demo admin session) renders the full org
  // dashboard. menu.memberships only contains active rows; match the server
  // gate is_org_admin_member (owner/admin/manager) via isOrgAdminRole.
  const isOrgAdmin = menu.memberships.some(
    (m) => m.org_id === orgId && isOrgAdminRole(m.role),
  );

  React.useEffect(() => {
    if (!ready || menu.loading || isOrgAdmin) return;
    if (!user) {
      router.replace({
        pathname: '/(auth)/login',
        params: { returnTo: pathname || `/admin/${orgId}` },
      } as any);
      return;
    }
    router.replace(getDashboardRoute(userProfile?.user_type ?? null));
  }, [ready, user, menu.loading, isOrgAdmin, userProfile?.user_type, router, pathname, orgId]);

  if (!ready || !user || menu.loading || !isOrgAdmin) {
    return <StudioLoading />;
  }

  const displayName =
    userProfile?.full_name || userProfile?.display_name || user?.email || 'You';
  const initials = getInitials(displayName);
  const activeOrg = menu.memberships.find((m) => m.org_id === orgId) ?? menu.activeOrg;
  const orgName = activeOrg?.org_name ?? 'Organization';
  const orgMono = activeOrg?.org_short_name ?? '·';
  const orgShortLabel = shortNameLabel(orgName);
  const av = getAdminVocabulary(activeOrg?.interest_slug);

  const seatsAvailable = people.seats.total - people.seats.used;
  const seatsPct = Math.round((people.seats.used / people.seats.total) * 100);

  const goto = (key: AdminNavKey) => router.push(`/admin/${orgId}/${key}` as any);

  const navSections: StudioNavSection[] = [
    {
      eyebrow: orgShortLabel,
      items: [
        {
          key: 'overview',
          icon: 'grid-outline',
          label: 'Overview',
          active: activeKey === 'overview',
          onPress: () => goto('overview'),
        },
        {
          key: 'people',
          icon: 'people-outline',
          label: 'People',
          count: people.totalRows || undefined,
          active: activeKey === 'people',
          onPress: () => goto('people'),
        },
        {
          key: 'calendar',
          icon: 'calendar-outline',
          label: 'Calendar',
          count: calendar.scheduledCount || undefined,
          active: activeKey === 'calendar',
          onPress: () => goto('calendar'),
        },
        {
          key: 'cohorts',
          icon: 'school-outline',
          label: av.Cohorts,
          count: cohorts.totalCount || undefined,
          active: activeKey === 'cohorts',
          onPress: () => goto('cohorts'),
        },
        {
          key: 'programs',
          icon: 'layers-outline',
          label: av.Programs,
          count: programs.totalCount || undefined,
          active: activeKey === 'programs',
          onPress: () => goto('programs'),
        },
        {
          key: 'blueprints',
          icon: 'git-branch-outline',
          label: 'Blueprints',
          count: blueprints.blueprints.length || undefined,
          active: activeKey === 'blueprints',
          onPress: () => goto('blueprints'),
        },
        {
          key: 'sites',
          icon: 'map-outline',
          label: av.Sites,
          count: sites.total || undefined,
          active: activeKey === 'sites',
          onPress: () => goto('sites'),
        },
        {
          key: 'insights',
          icon: 'pie-chart-outline',
          label: 'Insights',
          active: activeKey === 'insights',
          onPress: () => goto('insights'),
        },
      ],
    },
    {
      eyebrow: 'Plan',
      items: [
        {
          key: 'billing',
          icon: 'card-outline',
          label: 'Billing & seats',
          active: activeKey === 'billing',
          onPress: () => goto('billing'),
        },
        {
          key: 'invoices',
          icon: 'document-text-outline',
          label: 'Invoices',
          active: activeKey === 'invoices',
          onPress: () => goto('invoices'),
        },
        {
          key: 'payouts',
          icon: 'receipt-outline',
          label: 'Author payouts',
          count: '$0',
          active: activeKey === 'payouts',
          onPress: () => goto('payouts'),
        },
      ],
    },
    {
      eyebrow: 'Security',
      items: [
        {
          key: 'sso',
          icon: 'shield-half-outline',
          label: 'SSO & SAML',
          active: activeKey === 'sso',
          onPress: () => goto('sso'),
        },
        {
          key: 'domain',
          icon: 'key-outline',
          label: 'Domain claim',
          active: activeKey === 'domain',
          onPress: () => goto('domain'),
        },
        {
          key: 'audit',
          icon: 'time-outline',
          label: 'Audit log',
          active: activeKey === 'audit',
          onPress: () => goto('audit'),
        },
      ],
      footer: (
        <View>
          <Text style={s.seatsLabel}>Seats</Text>
          <Text style={s.seatsValue}>
            {people.loading ? '—' : people.seats.used}{' '}
            <Text style={s.seatsValueSub}>of {people.seats.total}</Text>
          </Text>
          <View style={s.seatsBar}>
            <View style={[s.seatsBarFill, { width: `${people.loading ? 0 : seatsPct}%` }]} />
          </View>
          <Text style={s.seatsFoot}>
            {people.loading
              ? 'Loading seats…'
              : `${seatsAvailable} seats available · renews ${people.seats.renewsAt}`}
          </Text>
        </View>
      ),
    },
  ];

  return (
    <View style={s.root}>
      <StudioShell
        accent={accent}
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
        onUserCardPress={() =>
          showConfirm('Sign out', `Sign out of ${displayName}?`, () => {
            void signOut();
          })
        }
      >
        {children}
      </StudioShell>
    </View>
  );
}

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

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFEAD8',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
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
  seatsValueSub: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  seatsBar: {
    marginTop: 6,
    height: 4,
    backgroundColor: 'rgba(40, 64, 107, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seatsBarFill: { height: '100%', backgroundColor: '#28406B' },
  seatsFoot: { marginTop: 5, fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 14 },
});
