import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MaintenanceItem {
  id: string;
  type: 'overdue' | 'due_soon' | 'scheduled' | 'completed';
  category: 'sail' | 'rigging' | 'hull' | 'electronics' | 'safety';
  item: string;
  service: string;
  dueDate?: string;
  completedDate?: string;
  cost?: number;
  vendor?: string;
  notes?: string;
}

interface MaintenanceScheduleProps {
  boatId: string;
}

// Mock data
const MOCK_MAINTENANCE: MaintenanceItem[] = [
  {
    id: '1',
    type: 'overdue',
    category: 'sail',
    item: 'Jib #1 - Light Air',
    service: 'Annual inspection & repair',
    dueDate: '2025-09-15',
    cost: 250,
    vendor: 'North Sails Hong Kong',
  },
  {
    id: '2',
    type: 'overdue',
    category: 'rigging',
    item: 'Standing rigging',
    service: 'Tension check & adjustment',
    dueDate: '2025-09-20',
    cost: 150,
  },
  {
    id: '3',
    type: 'due_soon',
    category: 'hull',
    item: 'Hull bottom',
    service: 'Anti-fouling paint',
    dueDate: '2025-10-15',
    cost: 800,
    vendor: 'RHKYC Marine Services',
  },
  {
    id: '4',
    type: 'due_soon',
    category: 'electronics',
    item: 'Wind instruments',
    service: 'Calibration',
    dueDate: '2025-10-20',
    cost: 120,
  },
  {
    id: '5',
    type: 'scheduled',
    category: 'safety',
    item: 'Life jackets',
    service: 'Inspection & certification',
    dueDate: '2025-11-01',
    cost: 80,
  },
  {
    id: '6',
    type: 'scheduled',
    category: 'sail',
    item: 'Spinnaker - Code 0',
    service: 'Seam inspection',
    dueDate: '2025-11-10',
    cost: 180,
    vendor: 'UK Sailmakers',
  },
  {
    id: '7',
    type: 'completed',
    category: 'rigging',
    item: 'Forestay',
    service: 'Replacement',
    completedDate: '2025-09-01',
    cost: 450,
    vendor: 'Seldén Mast Hong Kong',
    notes: 'Upgraded to carbon fiber',
  },
  {
    id: '8',
    type: 'completed',
    category: 'hull',
    item: 'Rudder',
    service: 'Bearing replacement',
    completedDate: '2025-08-25',
    cost: 220,
  },
];

export function MaintenanceSchedule({ boatId: _boatId }: MaintenanceScheduleProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const filters = [
    { key: 'all', label: 'All', count: MOCK_MAINTENANCE.length },
    { key: 'overdue', label: 'Overdue', count: MOCK_MAINTENANCE.filter(m => m.type === 'overdue').length },
    { key: 'due_soon', label: 'Due Soon', count: MOCK_MAINTENANCE.filter(m => m.type === 'due_soon').length },
    { key: 'scheduled', label: 'Scheduled', count: MOCK_MAINTENANCE.filter(m => m.type === 'scheduled').length },
    { key: 'completed', label: 'Recent', count: MOCK_MAINTENANCE.filter(m => m.type === 'completed').length },
  ];

  const filteredMaintenance = selectedFilter === 'all'
    ? MOCK_MAINTENANCE
    : MOCK_MAINTENANCE.filter(m => m.type === selectedFilter);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      sail: 'fish',
      rigging: 'git-network',
      hull: 'boat',
      electronics: 'hardware-chip',
      safety: 'shield-checkmark',
    };
    return icons[category] || 'construct';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      overdue: '#EF4444',
      due_soon: '#F59E0B',
      scheduled: '#3B82F6',
      completed: '#10B981',
    };
    return colors[type] || '#64748B';
  };

  const getTypeBgColor = (type: string) => {
    const colors: Record<string, string> = {
      overdue: '#FEE2E2',
      due_soon: '#FEF3C7',
      scheduled: '#DBEAFE',
      completed: '#D1FAE5',
    };
    return colors[type] || '#F1F5F9';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalCost = filteredMaintenance
    .filter(m => m.type !== 'completed')
    .reduce((sum, m) => sum + (m.cost || 0), 0);

  return (
    <View style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: '#FEE2E2' }]}>
          <Ionicons name="warning" size={24} color="#DC2626" />
          <View style={styles.summaryContent}>
            <Text style={styles.summaryValue}>
              {MOCK_MAINTENANCE.filter(m => m.type === 'overdue').length}
            </Text>
            <Text style={styles.summaryLabel}>Overdue</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="time" size={24} color="#D97706" />
          <View style={styles.summaryContent}>
            <Text style={styles.summaryValue}>
              {MOCK_MAINTENANCE.filter(m => m.type === 'due_soon').length}
            </Text>
            <Text style={styles.summaryLabel}>Due Soon</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="calendar" size={24} color="#007AFF" />
          <View style={styles.summaryContent}>
            <Text style={styles.summaryValue}>
              {MOCK_MAINTENANCE.filter(m => m.type === 'scheduled').length}
            </Text>
            <Text style={styles.summaryLabel}>Scheduled</Text>
          </View>
        </View>
      </View>

      {/* Cost Summary */}
      {totalCost > 0 && (
        <View style={styles.costBanner}>
          <Ionicons name="cash-outline" size={20} color="#1E293B" />
          <Text style={styles.costText}>
            Upcoming maintenance cost: <Text style={styles.costAmount}>${totalCost}</Text>
          </Text>
        </View>
      )}

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
      >
        {filters.map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterTab,
              selectedFilter === filter.key && styles.filterTabActive,
            ]}
            onPress={() => setSelectedFilter(filter.key)}
          >
            <Text
              style={[
                styles.filterText,
                selectedFilter === filter.key && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filter.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Maintenance List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredMaintenance.map(item => {
          const isExpanded = expandedItem === item.id;
          const typeColor = getTypeColor(item.type);
          const typeBgColor = getTypeBgColor(item.type);

          return (
            <View key={item.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setExpandedItem(isExpanded ? null : item.id)}
              >
                <View style={[styles.categoryIcon, { backgroundColor: typeBgColor }]}>
                  <Ionicons
                    name={getCategoryIcon(item.category)}
                    size={20}
                    color={typeColor}
                  />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.itemName}>{item.item}</Text>
                  <Text style={styles.serviceName}>{item.service}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>

              <View style={styles.cardMeta}>
                <View style={[styles.typeBadge, { backgroundColor: typeBgColor }]}>
                  <Text style={[styles.typeText, { color: typeColor }]}>
                    {item.type.replace('_', ' ')}
                  </Text>
                </View>
                <Text style={styles.dateText}>
                  {item.type === 'completed'
                    ? `Completed: ${formatDate(item.completedDate)}`
                    : `Due: ${formatDate(item.dueDate)}`
                  }
                </Text>
              </View>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  {item.cost && (
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color="#64748B" />
                      <Text style={styles.detailText}>Cost: ${item.cost}</Text>
                    </View>
                  )}
                  {item.vendor && (
                    <View style={styles.detailRow}>
                      <Ionicons name="business-outline" size={16} color="#64748B" />
                      <Text style={styles.detailText}>{item.vendor}</Text>
                    </View>
                  )}
                  {item.notes && (
                    <View style={styles.detailRow}>
                      <Ionicons name="document-text-outline" size={16} color="#64748B" />
                      <Text style={styles.detailText}>{item.notes}</Text>
                    </View>
                  )}
                  <View style={styles.actions}>
                    {item.type !== 'completed' && (
                      <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                        <Text style={[styles.actionText, { color: '#10B981' }]}>
                          Mark Complete
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.actionButton}>
                      <Ionicons name="create-outline" size={18} color="#3B82F6" />
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  summaryContent: {
    gap: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  costBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  costText: {
    fontSize: 13,
    color: '#92400E',
  },
  costAmount: {
    fontWeight: '700',
    fontSize: 15,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  serviceName: {
    fontSize: 13,
    color: '#64748B',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#475569',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
});
