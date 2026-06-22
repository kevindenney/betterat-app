import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Link } from 'expo-router';
import { DashboardSection } from '@/components/dashboard/shared';
import { useAuth } from '@/providers/AuthProvider';
import { useUserFleets } from '@/hooks/useFleetData';
import { useMyOrgs, type MyOrg } from '@/hooks/useMyOrgs';
import { FleetDiscoveryService, type Fleet } from '@/services/FleetDiscoveryService';
import { fleetService } from '@/services/fleetService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('FleetSelect');

export default function FleetSelectionScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const { fleets: myFleets, refresh: refreshMyFleets } = useUserFleets(user?.id);
  const { data: myOrgsData } = useMyOrgs();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [suggested, setSuggested] = useState<Fleet[]>([]);
  const [browse, setBrowse] = useState<Fleet[]>([]);
  const [searchResults, setSearchResults] = useState<Fleet[] | null>(null);
  const [orgFleets, setOrgFleets] = useState<{ org: MyOrg; fleets: Fleet[] }[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Membership ids the viewer already belongs to, to seed the Join/Joined state.
  const joinedIds = useMemo(
    () => new Set(myFleets.map((m) => m.fleet.id)),
    [myFleets],
  );

  // Default browse: suggested-for-you (by the sailor's boats) + all public fleets.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [browseFleets, suggestedFleets] = await Promise.all([
          FleetDiscoveryService.discoverFleets(undefined, undefined, 50),
          user?.id
            ? FleetDiscoveryService.getSuggestedFleets(user.id)
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setSuggested(suggestedFleets);
        setBrowse(browseFleets);
      } catch (error) {
        logger.error('[FleetSelect] Error loading fleets', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Fleets at the viewer's clubs — surfaced above the public browse list so a
  // member who joins their yacht club lands on its fleets first. Includes the
  // org's club-visibility fleets (readable here via the org-member RLS policy).
  useEffect(() => {
    let cancelled = false;
    const orgs = myOrgsData ?? [];
    if (orgs.length === 0) {
      setOrgFleets([]);
      return;
    }
    const load = async () => {
      try {
        const results = await Promise.all(
          orgs.map((org) => FleetDiscoveryService.getFleetsByOrganization(org.id, 50)),
        );
        if (cancelled) return;
        const sections = orgs
          .map((org, i) => ({ org, fleets: results[i] }))
          .filter((s) => s.fleets.length > 0);
        setOrgFleets(sections);
      } catch (error) {
        logger.error('[FleetSelect] Error loading org fleets', error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [myOrgsData]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Run the search when the debounced query changes.
  useEffect(() => {
    let cancelled = false;
    if (!debouncedQuery) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    FleetDiscoveryService.searchFleets(debouncedQuery, 50)
      .then((results) => {
        if (!cancelled) setSearchResults(results);
      })
      .catch((error) => {
        logger.error('[FleetSelect] Search failed', error);
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const handleToggleJoin = useCallback(
    async (fleet: Fleet) => {
      if (!user?.id) {
        showAlert('Sign in required', 'Please sign in to join a fleet.');
        return;
      }
      const isJoined = joinedIds.has(fleet.id);
      setBusyId(fleet.id);
      try {
        if (isJoined) {
          await fleetService.leaveFleet(user.id, fleet.id);
        } else {
          await fleetService.joinFleet(user.id, fleet.id);
        }
        await refreshMyFleets();
      } catch (error: any) {
        showAlert('Error', error?.message ?? 'Could not update fleet membership.');
      } finally {
        setBusyId(null);
      }
    },
    [user?.id, joinedIds, refreshMyFleets],
  );

  // Group a list of fleets by region for display.
  const groupByRegion = useCallback((list: Fleet[]): [string, Fleet[]][] => {
    const grouped = new Map<string, Fleet[]>();
    list.forEach((fleet) => {
      const region = fleet.region?.trim() || 'Other';
      if (!grouped.has(region)) grouped.set(region, []);
      grouped.get(region)!.push(fleet);
    });
    return Array.from(grouped.entries());
  }, []);

  const renderFleetCard = (fleet: Fleet) => {
    const isJoined = joinedIds.has(fleet.id);
    const isBusy = busyId === fleet.id;
    return (
      <View key={fleet.id} style={styles.fleetCard}>
        <View style={styles.fleetCardMain}>
          <View style={styles.fleetCardTitle}>
            <MaterialCommunityIcons
              name="sail-boat"
              size={20}
              color={isJoined ? '#007AFF' : '#64748B'}
            />
            <Text style={styles.fleetName}>{fleet.name}</Text>
          </View>
          <View style={styles.fleetMeta}>
            {fleet.boat_classes?.name && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="tag-outline" size={14} color="#64748B" />
                <Text style={styles.metaText}>{fleet.boat_classes.name}</Text>
              </View>
            )}
            {typeof fleet.member_count === 'number' && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="account-group" size={14} color="#64748B" />
                <Text style={styles.metaText}>
                  {fleet.member_count} {fleet.member_count === 1 ? 'member' : 'members'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.joinButton, isJoined && styles.joinedButton]}
          onPress={() => handleToggleJoin(fleet)}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={isJoined ? '#64748B' : '#FFFFFF'} />
          ) : (
            <Text style={[styles.joinButtonText, isJoined && styles.joinedButtonText]}>
              {isJoined ? 'Joined' : 'Join'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderRegionGroups = (list: Fleet[]) =>
    groupByRegion(list).map(([region, fleets]) => (
      <DashboardSection key={region} title={region} showBorder={false}>
        <View style={styles.fleetList}>{fleets.map(renderFleetCard)}</View>
      </DashboardSection>
    ));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Finding fleets…</Text>
      </View>
    );
  }

  const isSearchMode = debouncedQuery.length > 0;
  // In browse mode, keep the lower sections from repeating cards already shown
  // higher up: club fleets first, then suggested, then browse-all.
  const orgFleetIds = new Set(orgFleets.flatMap((s) => s.fleets.map((f) => f.id)));
  const suggestedOnly = suggested.filter((f) => !orgFleetIds.has(f.id));
  const suggestedIds = new Set(suggestedOnly.map((f) => f.id));
  const browseOnly = browse.filter((f) => !suggestedIds.has(f.id) && !orgFleetIds.has(f.id));
  const hasResults = isSearchMode
    ? (searchResults?.length ?? 0) > 0
    : orgFleets.length + suggestedOnly.length + browseOnly.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/library'))}
          accessibilityRole="button"
          accessibilityLabel="Back to Library"
        >
          <Text style={styles.backText}>‹ Library</Text>
        </TouchableOpacity>

        <DashboardSection
          title="Find Fleets"
          subtitle="Join fleets of sailors in your class and region"
          showBorder={false}
        >
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, region, or class"
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color="#94A3B8" />}
            {!searching && query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            )}
          </View>
        </DashboardSection>

        {isSearchMode ? (
          renderRegionGroups(searchResults ?? [])
        ) : (
          <>
            {orgFleets.map(({ org, fleets }) => (
              <DashboardSection key={org.id} title={`Fleets at ${org.name}`} showBorder={false}>
                <View style={styles.fleetList}>{fleets.map(renderFleetCard)}</View>
              </DashboardSection>
            ))}
            {suggestedOnly.length > 0 && (
              <DashboardSection title="Suggested for you" showBorder={false}>
                <View style={styles.fleetList}>{suggestedOnly.map(renderFleetCard)}</View>
              </DashboardSection>
            )}
            {browseOnly.length > 0 && (
              <>
                <DashboardSection title="Browse all fleets" showBorder={false}>
                  <View />
                </DashboardSection>
                {renderRegionGroups(browseOnly)}
              </>
            )}
          </>
        )}

        {!hasResults && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No fleets match</Text>
            <Text style={styles.emptySubtitle}>
              {isSearchMode
                ? 'Try a different name, region, or class — or start your own.'
                : 'No public fleets yet. Start your own.'}
            </Text>
            <Link href="/(tabs)/fleet/create" asChild>
              <TouchableOpacity style={styles.createButton}>
                <Text style={styles.createButtonText}>Create a fleet</Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  backRow: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    padding: 0,
  },
  fleetList: {
    gap: 12,
  },
  fleetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fleetCardMain: {
    flex: 1,
    gap: 8,
  },
  fleetCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fleetName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  fleetMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginLeft: 30,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  joinButton: {
    backgroundColor: '#007AFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  joinedButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  joinedButtonText: {
    color: '#64748B',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
    marginTop: 4,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
