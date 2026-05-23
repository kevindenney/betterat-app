/**
 * Org Admin · Sites — lists atlas_pois claimed by this org.
 *
 * The Atlas Phase A1 data tied into the admin chrome: places this
 * institution has curated for the Atlas map. JHSON shows the Pinkard
 * sim suite + 5 affiliated hospitals; RHKYC shows the clubhouse + 4
 * racing areas. Each row carries lat/lng, kind icon, healthcare pill
 * where applicable, and the institution's metadata.
 *
 * Future: a "Claim a new site" sheet (parallel to AddPersonSheet) lets
 * an admin propose a new POI for their org without leaving this page.
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
import { useAdminOrgSites, AdminOrgSite } from '@/hooks/useAdminOrgSites';
import { useAdminPeople } from '@/hooks/useAdminPeople';
import {
  StudioShell,
  StudioHeader,
  StudioButton,
  StudioTabs,
  StudioNavSection,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';

type SitesTab = 'all' | 'hospital' | 'sim_lab' | 'club' | 'racing_area';

export default function AdminSitesPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const menu = useProfileMenuData();
  const people = useAdminPeople(orgId as string);
  const data = useAdminOrgSites(orgId as string);

  const [tab, setTab] = useState<SitesTab>('all');
  const [search, setSearch] = useState('');

  const filteredSites = useMemo(() => {
    let rows = data.sites;
    if (tab !== 'all') rows = rows.filter((s) => s.kind === tab);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.metadata?.city as string | undefined)?.toLowerCase().includes(q) ||
          s.kind.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data.sites, tab, search]);

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

  const seatsAvailable = people.seats.total - people.seats.used;
  const seatsPct = Math.round((people.seats.used / people.seats.total) * 100);

  const goAdmin = (key: string) => router.push(`/admin/${orgId}/${key}` as any);
  const navSections: StudioNavSection[] = [
    {
      eyebrow: orgShortLabel,
      items: [
        { key: 'overview', icon: 'grid-outline', label: 'Overview', onPress: () => goAdmin('overview') },
        {
          key: 'people',
          icon: 'people-outline',
          label: 'People',
          count: people.totalRows,
          onPress: () => goAdmin('people'),
        },
        { key: 'cohorts', icon: 'school-outline', label: 'Cohorts', count: 14, onPress: () => goAdmin('cohorts') },
        { key: 'blueprints', icon: 'git-branch-outline', label: 'Blueprints', count: 7, onPress: () => goAdmin('blueprints') },
        {
          key: 'sites',
          icon: 'map-outline',
          label: 'Sites',
          count: data.total,
          active: true,
        },
        { key: 'insights', icon: 'pie-chart-outline', label: 'Insights', onPress: () => goAdmin('insights') },
      ],
    },
    {
      eyebrow: 'Plan',
      items: [
        { key: 'billing', icon: 'card-outline', label: 'Billing & seats', onPress: () => goAdmin('billing') },
        { key: 'invoices', icon: 'document-text-outline', label: 'Invoices', onPress: () => goAdmin('invoices') },
        { key: 'payouts', icon: 'receipt-outline', label: 'Author payouts', count: '$0', onPress: () => goAdmin('payouts') },
      ],
    },
    {
      eyebrow: 'Security',
      items: [
        { key: 'sso', icon: 'shield-half-outline', label: 'SSO & SAML', onPress: () => goAdmin('sso') },
        { key: 'domain', icon: 'key-outline', label: 'Domain claim', onPress: () => goAdmin('domain') },
        { key: 'audit', icon: 'time-outline', label: 'Audit log', onPress: () => goAdmin('audit') },
      ],
      footer: (
        <View>
          <Text style={styles.seatsLabel}>Seats</Text>
          <Text style={styles.seatsValue}>
            {people.seats.used}{' '}
            <Text style={styles.seatsValueSub}>of {people.seats.total}</Text>
          </Text>
          <View style={styles.seatsBar}>
            <View style={[styles.seatsBarFill, { width: `${seatsPct}%` }]} />
          </View>
          <Text style={styles.seatsFoot}>
            {seatsAvailable} seats available · renews {people.seats.renewsAt}
          </Text>
        </View>
      ),
    },
  ];

  const tabs = [
    { key: 'all', label: 'All', count: String(data.total) },
    ...data.byKind.map((k) => ({
      key: k.kind,
      label: prettyKind(k.kind),
      count: String(k.count),
    })),
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
          crumbs={[orgShortLabel, 'Sites']}
          title="Sites"
          subtitleParts={[
            <View key="total" style={styles.subPillWrap}>
              <View style={styles.subPill}>
                <Text style={styles.subPillText}>
                  {data.total} curated {data.total === 1 ? 'place' : 'places'}
                </Text>
              </View>
            </View>,
            <Text key="meta" style={styles.subText}>
              {data.healthcareCount > 0
                ? `${data.healthcareCount} healthcare-tagged · site-level precision locked`
                : 'Open-precision sites · sailors can pin exact coords'}
            </Text>,
          ]}
          actions={
            <>
              <StudioButton variant="ghost" icon="download-outline" label="Export · CSV" />
              <StudioButton
                variant="primary"
                accent="navy"
                icon="add"
                label="Claim a site"
              />
            </>
          }
        />

        <StudioTabs
          tabs={tabs}
          active={tab}
          accent="navy"
          onChange={(k) => setTab(k as SitesTab)}
        />

        <View style={styles.filterRow}>
          <View style={styles.searchInput}>
            <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.6)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, city, or kind…"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={styles.searchInputField}
            />
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
          {data.loading ? (
            <Text style={styles.loading}>Loading sites…</Text>
          ) : filteredSites.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="map-outline" size={32} color="rgba(60, 60, 67, 0.4)" />
              <Text style={styles.emptyTitle}>
                {search ? 'No matches' : 'No sites yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {search
                  ? `Nothing matches "${search}" in this view.`
                  : 'When Atlas Phase A1 seed data lands, your institution\'s clinical sites and curated places appear here.'}
              </Text>
            </View>
          ) : (
            filteredSites.map((s) => (
              <SiteRow
                key={s.id}
                site={s}
                onPress={() => router.push(`/admin/${orgId}/sites/${s.id}`)}
              />
            ))
          )}
        </ScrollView>
      </StudioShell>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Site row
// ---------------------------------------------------------------------------

function SiteRow({ site, onPress }: { site: AdminOrgSite; onPress?: () => void }) {
  const city = site.metadata?.city as string | undefined;
  const role = site.metadata?.role as string | undefined;
  return (
    <Pressable onPress={onPress} style={styles.siteRow}>
      <View style={[styles.kindBadge, kindBadgeBg(site.kind)]}>
        <Ionicons name={kindIcon(site.kind)} size={16} color="#FFFFFF" />
      </View>
      <View style={styles.siteCol}>
        <View style={styles.siteNameRow}>
          <Text style={styles.siteName}>{site.name}</Text>
          {site.is_healthcare_site ? (
            <View style={styles.healthBadge}>
              <Text style={styles.healthBadgeText}>HEALTHCARE</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.siteMeta}>
          {prettyKind(site.kind)}
          {city ? ` · ${city}` : ''}
          {role ? ` · ${role.replace(/_/g, ' ')}` : ''}
          {' · '}
          <Text style={styles.siteCoords}>
            {site.lat.toFixed(4)}°, {site.lng.toFixed(4)}°
          </Text>
        </Text>
      </View>
      <View style={styles.siteAction}>
        <Ionicons name="ellipsis-horizontal" size={16} color="rgba(60, 60, 67, 0.4)" />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function kindBadgeBg(kind: string) {
  switch (kind) {
    case 'hospital':
      return { backgroundColor: '#B85A66' };
    case 'sim_lab':
      return { backgroundColor: '#7A6A8E' };
    case 'club':
    case 'racing_area':
      return { backgroundColor: '#5E7B8E' };
    default:
      return { backgroundColor: '#8E8E93' };
  }
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

function NarrowScreenGate({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.gate}>
      <Ionicons name="desktop-outline" size={36} color="rgba(60, 60, 67, 0.4)" />
      <Text style={styles.gateTitle}>Sites is a desktop surface</Text>
      <Text style={styles.gateBody}>
        Managing curated sites is not a phone-screen job. Open on iPad or desktop.
      </Text>
      <StudioButton variant="ghost" icon="arrow-back" label="Back" onPress={onBack} />
    </View>
  );
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
  subPillWrap: {},
  subPill: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 64, 107, 0.12)',
  },
  subPillText: { fontSize: 11, fontWeight: '600', color: '#28406B' },

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
  seatsBarFill: { height: '100%', backgroundColor: '#28406B' },
  seatsFoot: { marginTop: 5, fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 14 },

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

  scroll: { flex: 1 },
  scrollInner: { gap: 8, paddingBottom: 20 },

  loading: { textAlign: 'center', paddingVertical: 32, color: 'rgba(60, 60, 67, 0.6)' },

  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  kindBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteCol: { flex: 1, minWidth: 0 },
  siteNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  siteName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  healthBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(184, 90, 102, 0.16)',
    borderRadius: 4,
  },
  healthBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B85A66',
    letterSpacing: 0.4,
  },
  siteMeta: { marginTop: 3, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  siteCoords: {
    fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
    fontSize: 11,
  },
  siteAction: { padding: 4 },

  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 8 },
  emptyBody: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 440,
  },

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
