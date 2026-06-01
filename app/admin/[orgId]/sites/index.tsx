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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { useAdminOrgSites, AdminOrgSite } from '@/hooks/useAdminOrgSites';
import {
  StudioHeader,
  StudioButton,
  StudioTabs,
} from '@/components/studio/StudioShell';
import { AdminShell } from '@/components/admin/AdminShell';

type SitesTab = 'all' | 'hospital' | 'sim_lab' | 'club' | 'racing_area';

export default function AdminSitesPage() {
  return (
    <AdminShell activeKey="sites">
      <AdminSitesBody />
    </AdminShell>
  );
}

function AdminSitesBody() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const menu = useProfileMenuData();
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

  const activeOrg = menu.memberships.find((m) => m.org_id === orgId) ?? menu.activeOrg;
  const orgName = activeOrg?.org_name ?? 'Organization';
  const orgShortLabel = shortNameLabel(orgName);

  const tabs = [
    { key: 'all', label: 'All', count: String(data.total) },
    ...data.byKind.map((k) => ({
      key: k.kind,
      label: prettyKind(k.kind),
      count: String(k.count),
    })),
  ];

  return (
    <>
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
    </>
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

});
