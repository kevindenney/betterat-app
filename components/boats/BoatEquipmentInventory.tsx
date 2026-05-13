/**
 * Boat Equipment Inventory
 * Comprehensive equipment management with category filtering,
 * maintenance tracking, and health indicators
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { equipmentService, type BoatEquipment, type EquipmentCategory, type EquipmentHealthScore } from '@/services/EquipmentService';
import { EquipmentCard } from './EquipmentCard';
import { AddEquipmentModal } from './AddEquipmentModal';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('BoatEquipmentInventory');

interface BoatEquipmentInventoryProps {
  boatId: string;
  classId?: string;
  onEquipmentPress?: (equipment: BoatEquipment) => void;
}

// Category groupings for filtering
const CATEGORY_GROUPS = [
  { id: 'all', label: 'All', icon: 'grid-outline' },
  { id: 'rig', label: 'Rig', icon: 'git-network-outline', categories: ['mast', 'boom', 'spinnaker_pole'] },
  { id: 'standing', label: 'Standing Rigging', icon: 'git-branch-outline', categories: ['forestay', 'backstay', 'shrouds', 'spreaders'] },
  { id: 'running', label: 'Running Rigging', icon: 'swap-horizontal-outline', categories: ['halyards', 'sheets', 'control_lines'] },
  { id: 'sails', label: 'Sails', icon: 'flag-outline', categories: ['mainsail', 'jib', 'genoa', 'spinnaker', 'code_zero'] },
  { id: 'hardware', label: 'Deck Hardware', icon: 'construct-outline', categories: ['winches', 'blocks', 'cleats', 'tracks'] },
  { id: 'steering', label: 'Steering', icon: 'navigate-outline', categories: ['tiller', 'wheel', 'rudder'] },
  { id: 'electronics', label: 'Electronics', icon: 'speedometer-outline', categories: ['instruments', 'gps', 'vhf', 'compass'] },
  { id: 'safety', label: 'Safety', icon: 'shield-checkmark-outline', categories: ['life_jackets', 'safety_gear', 'anchor'] },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', categories: ['covers', 'trailer', 'other', 'keel', 'centerboard'] },
];

export function BoatEquipmentInventory({ boatId, classId, onEquipmentPress }: BoatEquipmentInventoryProps) {
  const [equipment, setEquipment] = useState<BoatEquipment[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [healthScore, setHealthScore] = useState<EquipmentHealthScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'attention'>('all');

  const loadData = useCallback(async () => {
    try {
      const [equipmentData, categoriesData, health] = await Promise.all([
        equipmentService.getEquipmentForBoat(boatId),
        equipmentService.getCategories(),
        equipmentService.getBoatEquipmentHealth(boatId),
      ]);
      
      setEquipment(equipmentData);
      setCategories(categoriesData);
      setHealthScore(health);
    } catch (error) {
      logger.error('Error loading equipment data', { boatId, error });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [boatId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const filteredEquipment = useMemo(() => {
    let filtered = equipment;

    // Filter by category group
    if (selectedGroup !== 'all') {
      const group = CATEGORY_GROUPS.find(g => g.id === selectedGroup);
      if (group?.categories) {
        filtered = filtered.filter(e => group.categories.includes(e.category));
      }
    }

    // Filter by status
    if (statusFilter === 'active') {
      filtered = filtered.filter(e => e.status === 'active');
    } else if (statusFilter === 'attention') {
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(e => {
        if (e.status !== 'active') return false;
        if (e.replacement_priority === 'critical' || e.replacement_priority === 'high') return true;
        if (e.condition_rating !== undefined && e.condition_rating < 60) return true;
        if (e.next_maintenance_date && new Date(e.next_maintenance_date) <= thirtyDays) return true;
        return false;
      });
    }

    return filtered;
  }, [equipment, selectedGroup, statusFilter]);

  // Group equipment by category for display
  const groupedEquipment = useMemo(() => {
    const groups: Record<string, BoatEquipment[]> = {};
    
    for (const item of filteredEquipment) {
      const cat = item.category;
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(item);
    }

    // Sort by category order
    const sortedGroups: { category: string; name: string; items: BoatEquipment[] }[] = [];
    for (const [category, items] of Object.entries(groups)) {
      const categoryInfo = categories.find(c => c.id === category);
      sortedGroups.push({
        category,
        name: categoryInfo?.name || category,
        items: items.sort((a, b) => a.custom_name.localeCompare(b.custom_name)),
      });
    }

    return sortedGroups.sort((a, b) => {
      const catA = categories.find(c => c.id === a.category);
      const catB = categories.find(c => c.id === b.category);
      return (catA?.sort_order || 999) - (catB?.sort_order || 999);
    });
  }, [filteredEquipment, categories]);

  const handleEquipmentAdded = useCallback((newEquipment: BoatEquipment) => {
    setEquipment(prev => [...prev, newEquipment]);
    setShowAddModal(false);
    // Refresh health score
    equipmentService.getBoatEquipmentHealth(boatId).then(setHealthScore);
  }, [boatId]);

  const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
    const cat = categories.find(c => c.id === category);
    return (cat?.icon as keyof typeof Ionicons.glyphMap) || 'cube-outline';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading equipment...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Health Score Summary */}
      {healthScore && (
        <View style={styles.healthSummary}>
          <View style={styles.healthScoreContainer}>
            <View style={[
              styles.healthScoreBadge,
              { backgroundColor: healthScore.health_score >= 80 ? '#D1FAE5' : healthScore.health_score >= 50 ? '#FEF3C7' : '#FEE2E2' }
            ]}>
              <Text style={[
                styles.healthScoreValue,
                { color: healthScore.health_score >= 80 ? '#065F46' : healthScore.health_score >= 50 ? '#92400E' : '#991B1B' }
              ]}>
                {healthScore.health_score}
              </Text>
              <Text style={styles.healthScoreLabel}>Health</Text>
            </View>
          </View>

          <View style={styles.healthMetrics}>
            <View style={styles.healthMetric}>
              <Text style={styles.metricValue}>{healthScore.total_equipment}</Text>
              <Text style={styles.metricLabel}>Total</Text>
            </View>
            {healthScore.overdue_maintenance > 0 && (
              <View style={[styles.healthMetric, styles.metricAlert]}>
                <Text style={[styles.metricValue, { color: '#DC2626' }]}>{healthScore.overdue_maintenance}</Text>
                <Text style={styles.metricLabel}>Overdue</Text>
              </View>
            )}
            {healthScore.due_soon > 0 && (
              <View style={[styles.healthMetric, styles.metricWarning]}>
                <Text style={[styles.metricValue, { color: '#D97706' }]}>{healthScore.due_soon}</Text>
                <Text style={styles.metricLabel}>Due Soon</Text>
              </View>
            )}
            <View style={[
              styles.raceReadyBadge,
              { backgroundColor: healthScore.race_ready ? '#D1FAE5' : '#FEE2E2' }
            ]}>
              <Ionicons
                name={healthScore.race_ready ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={healthScore.race_ready ? '#065F46' : '#DC2626'}
              />
              <Text style={[
                styles.raceReadyText,
                { color: healthScore.race_ready ? '#065F46' : '#DC2626' }
              ]}>
                {healthScore.race_ready ? 'Race Ready' : 'Needs Attention'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Category Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          {CATEGORY_GROUPS.map(group => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.filterTab,
                selectedGroup === group.id && styles.filterTabActive
              ]}
              onPress={() => setSelectedGroup(group.id)}
            >
              <Ionicons
                name={group.icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={selectedGroup === group.id ? '#3B82F6' : '#64748B'}
              />
              <Text style={[
                styles.filterTabText,
                selectedGroup === group.id && styles.filterTabTextActive
              ]}>
                {group.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Status Filter */}
      <View style={styles.statusFilterRow}>
        <TouchableOpacity
          style={[styles.statusChip, statusFilter === 'all' && styles.statusChipActive]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[styles.statusChipText, statusFilter === 'all' && styles.statusChipTextActive]}>
            All ({equipment.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusChip, statusFilter === 'active' && styles.statusChipActive]}
          onPress={() => setStatusFilter('active')}
        >
          <Text style={[styles.statusChipText, statusFilter === 'active' && styles.statusChipTextActive]}>
            Active ({equipment.filter(e => e.status === 'active').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusChip, statusFilter === 'attention' && styles.statusChipActive, statusFilter === 'attention' && { backgroundColor: '#FEF3C7' }]}
          onPress={() => setStatusFilter('attention')}
        >
          <Ionicons
            name="warning"
            size={14}
            color={statusFilter === 'attention' ? '#D97706' : '#64748B'}
          />
          <Text style={[styles.statusChipText, statusFilter === 'attention' && { color: '#D97706' }]}>
            Needs Attention
          </Text>
        </TouchableOpacity>
      </View>

      {/* Equipment List */}
      <ScrollView
        style={styles.equipmentList}
        contentContainerStyle={styles.equipmentListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3B82F6']}
          />
        }
      >
        {filteredEquipment.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>
              {selectedGroup !== 'all' || statusFilter !== 'all' 
                ? 'No equipment matches filters'
                : 'No equipment added yet'}
            </Text>
            <Text style={styles.emptyText}>
              {selectedGroup !== 'all' || statusFilter !== 'all'
                ? 'Try changing your filters or add new equipment'
                : 'Add your boat\'s equipment to track maintenance and get care recommendations'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Add Equipment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groupedEquipment.map(group => (
            <View key={group.category} style={styles.categoryGroup}>
              <View style={styles.categoryHeader}>
                <Ionicons
                  name={getCategoryIcon(group.category)}
                  size={18}
                  color="#64748B"
                />
                <Text style={styles.categoryTitle}>{group.name}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{group.items.length}</Text>
                </View>
              </View>
              {group.items.map(item => (
                <EquipmentCard
                  key={item.id}
                  equipment={item}
                  onPress={() => onEquipmentPress?.(item)}
                  compact
                />
              ))}
            </View>
          ))
        )}
        
        {/* Bottom spacing for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add Equipment FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Equipment Modal */}
      <AddEquipmentModal
        visible={showAddModal}
        boatId={boatId}
        classId={classId}
        onClose={() => setShowAddModal(false)}
        onEquipmentAdded={handleEquipmentAdded}
      />
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
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  healthSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  healthScoreContainer: {
    alignItems: 'center',
  },
  healthScoreBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthScoreValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  healthScoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  healthMetrics: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  healthMetric: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  metricAlert: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  metricWarning: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  raceReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 'auto',
  },
  raceReadyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterTabs: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterTabActive: {
    backgroundColor: '#DBEAFE',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  statusFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  statusChipActive: {
    backgroundColor: '#DBEAFE',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  statusChipTextActive: {
    color: '#3B82F6',
  },
  equipmentList: {
    flex: 1,
  },
  equipmentListContent: {
    padding: 16,
    gap: 16,
  },
  categoryGroup: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default BoatEquipmentInventory;

