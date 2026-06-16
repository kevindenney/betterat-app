import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DashboardSection } from '@/components/dashboard/shared';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

interface Fleet {
  id: string;
  name: string;
  slug: string;
  class_id: string;
  region: string;
  metadata: {
    fleet_size?: number;
    primary_club?: string;
    racing_schedule?: string;
  };
  boat_class?: {
    name: string;
    class_association: string | null;
  };
}

export default function FleetSelectionScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hongKongFleets, setHongKongFleets] = useState<Fleet[]>([]);
  const [selectedFleets, setSelectedFleets] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadHongKongFleets();
  }, [user?.id]);

  // Load user selections after Hong Kong fleets are loaded
  useEffect(() => {
    if (hongKongFleets.length > 0) {
      loadUserSelections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hongKongFleets.length, user?.id]);

  const loadHongKongFleets = async () => {
    logger.debug('[FleetSelect] loadHongKongFleets started');
    try {
      logger.debug('[FleetSelect] Fetching fleets from Supabase...');
      const { data, error } = await supabase
        .from('fleets')
        .select(`
          id,
          name,
          slug,
          class_id,
          region,
          metadata,
          boat_class:boat_classes(name, class_association)
        `)
        .eq('region', 'Hong Kong')
        .order('name');

      logger.debug('[FleetSelect] Query result:', { data, error, count: data?.length });

      if (error) {
        console.error('[FleetSelect] Query error:', error);
        throw error;
      }

      logger.debug('[FleetSelect] Setting Hong Kong fleets:', data?.length);
      // Transform data to ensure boat_class is a single object, not an array
      const transformedData = (data || []).map(fleet => ({
        ...fleet,
        boat_class: Array.isArray(fleet.boat_class) ? fleet.boat_class[0] : fleet.boat_class
      }));
      setHongKongFleets(transformedData);
    } catch (error) {
      console.error('[FleetSelect] Error loading Hong Kong fleets:', error);
    } finally {
      logger.debug('[FleetSelect] Setting loading to false');
      setLoading(false);
    }
  };

  const loadUserSelections = async () => {
    if (!user?.id || hongKongFleets.length === 0) return;

    try {
      // Get user's fleet memberships
      const { data: memberships, error: memberError } = await supabase
        .from('fleet_members')
        .select('fleet_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (memberError) throw memberError;

      if (memberships && memberships.length > 0) {
        const fleetIds = memberships.map(m => m.fleet_id);

        // Select fleets that are in both user memberships and Hong Kong fleets list
        const validSelections = new Set<string>();
        const hongKongFleetIds = new Set(hongKongFleets.map(f => f.id));

        fleetIds.forEach(fleetId => {
          if (hongKongFleetIds.has(fleetId)) {
            validSelections.add(fleetId);
          }
        });

        setSelectedFleets(validSelections);
      }
    } catch (error) {
      console.error('Error loading user selections:', error);
    }
  };

  const toggleFleetSelection = (fleet: Fleet) => {
    const newSelected = new Set(selectedFleets);
    if (newSelected.has(fleet.id)) {
      newSelected.delete(fleet.id);
    } else {
      newSelected.add(fleet.id);
    }
    setSelectedFleets(newSelected);
  };

  const saveSelections = async () => {
    if (!user?.id) {
      console.error('[FleetSelect] No user ID available');
      return;
    }

    const saveStartTime = Date.now();
    logger.debug(`[FleetSelect] ========== SAVE STARTED at ${new Date().toISOString()} ==========`);
    logger.debug('[FleetSelect] User ID:', user.id);
    logger.debug('[FleetSelect] Save start timestamp:', saveStartTime);

    setSaving(true);
    try {
      const selectedFleetIds = Array.from(selectedFleets);
      const selectedFleetsList = hongKongFleets.filter(f => selectedFleets.has(f.id));
      logger.debug('[FleetSelect] Selected fleet count:', selectedFleetIds.length);
      logger.debug('[FleetSelect] Selected fleet IDs:', selectedFleetIds);
      logger.debug('[FleetSelect] Selected fleet names:', selectedFleetsList.map(f => f.name));

      // Add user to selected fleets
      logger.debug('[FleetSelect] Starting upsert operations...');
      for (let i = 0; i < selectedFleetIds.length; i++) {
        const fleetId = selectedFleetIds[i];
        const upsertStartTime = Date.now();
        logger.debug(`[FleetSelect] Upserting fleet ${i + 1}/${selectedFleetIds.length}: ${fleetId}`);

        const { data, error } = await supabase
          .from('fleet_members')
          .upsert({
            fleet_id: fleetId,
            user_id: user.id,
            role: 'member',
            status: 'active',
          }, {
            onConflict: 'fleet_id,user_id',
          })
          .select();

        const upsertEndTime = Date.now();
        const upsertDuration = upsertEndTime - upsertStartTime;

        if (error) {
          logger.error(`[FleetSelect] Upsert error for fleet ${fleetId}:`, error);
        } else {
          logger.debug(`[FleetSelect] Upsert success for fleet ${fleetId} (took ${upsertDuration}ms):`, data);
        }
      }

      // Remove user from unselected fleets
      const unselectedFleetIds = hongKongFleets
        .filter(f => !selectedFleets.has(f.id))
        .map(f => f.id);

      if (unselectedFleetIds.length > 0) {
        logger.debug('[FleetSelect] Deleting unselected fleets:', unselectedFleetIds);
        const deleteStartTime = Date.now();

        const { error: deleteError } = await supabase
          .from('fleet_members')
          .delete()
          .in('fleet_id', unselectedFleetIds)
          .eq('user_id', user.id);

        const deleteEndTime = Date.now();
        const deleteDuration = deleteEndTime - deleteStartTime;

        if (deleteError) {
          logger.error('[FleetSelect] Delete error:', deleteError);
        } else {
          logger.debug(`[FleetSelect] Delete success (took ${deleteDuration}ms)`);
        }
      }

      const saveEndTime = Date.now();
      const totalDuration = saveEndTime - saveStartTime;
      logger.debug('[FleetSelect] ========== SAVE COMPLETED ==========');
      logger.debug('[FleetSelect] Save end timestamp:', saveEndTime);
      logger.debug('[FleetSelect] Total save duration:', totalDuration, 'ms');
      logger.debug('[FleetSelect] Selected fleets saved:', selectedFleetsList.map(f => f.name));

      // Wait a moment for database to sync, then navigate back
      logger.debug('[FleetSelect] Waiting 300ms before navigation...');
      setTimeout(() => {
        const navigateTime = Date.now();
        logger.debug('[FleetSelect] ========== NAVIGATING BACK ==========');
        logger.debug('[FleetSelect] Navigate timestamp:', navigateTime);
        logger.debug('[FleetSelect] Time since save completed:', navigateTime - saveEndTime, 'ms');
        logger.debug('[FleetSelect] Total time since save started:', navigateTime - saveStartTime, 'ms');
        router.back();
      }, 300);
    } catch (error) {
      const errorTime = Date.now();
      logger.error('[FleetSelect] ========== SAVE FAILED ==========');
      logger.error('[FleetSelect] Error timestamp:', errorTime);
      logger.error('[FleetSelect] Error saving fleet selections:', error);
      alert('Failed to save fleet selections. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const groupFleetsByClub = () => {
    const grouped = new Map<string, Fleet[]>();
    hongKongFleets.forEach(fleet => {
      const clubName = fleet.metadata?.primary_club || 'Hong Kong';
      if (!grouped.has(clubName)) {
        grouped.set(clubName, []);
      }
      grouped.get(clubName)!.push(fleet);
    });
    return Array.from(grouped.entries());
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Hong Kong fleets...</Text>
      </View>
    );
  }

  const groupedFleets = groupFleetsByClub();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DashboardSection
          title="Join Your Fleets"
          subtitle="Fleets are groups of sailors in the same class (separate from your individual boats)"
          showBorder={false}
        >
          <Text style={styles.instructions}>
            Join the fleets you race in. A fleet is a collection of sailors/boats in the same class at a location
            (e.g., "Hong Kong Dragon Fleet"). This is separate from your individual boats
            (e.g., your Dragon named "Dragonfly").
          </Text>
        </DashboardSection>

        {groupedFleets.map(([clubName, fleets]) => (
          <DashboardSection key={clubName} title={clubName} showBorder={false}>
            <View style={styles.fleetList}>
              {fleets.map(fleet => (
                <TouchableOpacity
                  key={fleet.id}
                  style={[
                    styles.fleetCard,
                    selectedFleets.has(fleet.id) && styles.fleetCardSelected,
                  ]}
                  onPress={() => toggleFleetSelection(fleet)}
                >
                  <View style={styles.fleetCardHeader}>
                    <View style={styles.fleetCardTitle}>
                      <MaterialCommunityIcons
                        name="sail-boat"
                        size={20}
                        color={selectedFleets.has(fleet.id) ? '#007AFF' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.fleetName,
                          selectedFleets.has(fleet.id) && styles.fleetNameSelected,
                        ]}
                      >
                        {fleet.name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        selectedFleets.has(fleet.id) && styles.checkboxSelected,
                      ]}
                    >
                      {selectedFleets.has(fleet.id) && (
                        <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </View>

                  {fleet.boat_class?.class_association && (
                    <Text style={styles.fleetAssociation}>{fleet.boat_class.class_association}</Text>
                  )}

                  <View style={styles.fleetMeta}>
                    {fleet.metadata?.fleet_size && (
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="account-group" size={14} color="#64748B" />
                        <Text style={styles.metaText}>{fleet.metadata.fleet_size} boats</Text>
                      </View>
                    )}
                    {fleet.metadata?.racing_schedule && (
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="calendar" size={14} color="#64748B" />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {fleet.metadata.racing_schedule}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </DashboardSection>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveSelections}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>
                Save {selectedFleets.size} {selectedFleets.size === 1 ? 'Fleet' : 'Fleets'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const logger = createLogger('select');
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
  instructions: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  fleetList: {
    gap: 12,
  },
  fleetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  fleetCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#EFF6FF',
  },
  fleetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fleetCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  fleetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  fleetNameSelected: {
    color: '#1E40AF',
  },
  fleetAssociation: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 30,
  },
  fleetMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginLeft: 30,
    marginTop: 4,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
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
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
