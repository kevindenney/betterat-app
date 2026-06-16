/**
 * ClassSelector Component
 * Allows sailors to select and manage their boat classes
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { CardMenu, CardMenuItem } from '../shared';
import { createLogger } from '@/lib/utils/logger';

export interface BoatClass {
  id: string;
  name: string;
  sailNumber?: string;
  boatName?: string;
  isPrimary: boolean;
  tuningGuideUrl?: string | null;
  equipmentAlertCount?: number;
  maintenanceDueCount?: number;
  group?: {
    id: string;
    name: string;
    ratingSystem?: string | null;
  };
}

interface ClassSelectorProps {
  classes: BoatClass[];
  selectedClass?: string | null;
  selectedClassId?: string | null;
  onClassChange?: (classId: string | null) => void;
  onClassSelect?: (classId: string) => void;
  onAddBoat?: () => void;
  showAddButton?: boolean;
}

const logger = createLogger('ClassSelector');
export function ClassSelector({
  classes,
  selectedClass,
  selectedClassId,
  onClassChange,
  onClassSelect,
  onAddBoat,
  showAddButton = true,
}: ClassSelectorProps) {

  const currentSelection = selectedClassId ?? selectedClass ?? null;

  const handleBoatPress = (classId: string) => {
    onClassChange?.(classId);
    onClassSelect?.(classId);
  };

  if (classes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="boat-outline" size={32} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No Boats Added</Text>
          <Text style={styles.emptyText}>Add your first boat to get started</Text>
          {showAddButton && onAddBoat && (
            <TouchableOpacity style={styles.addButton} onPress={onAddBoat}>
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Boat</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // If only one class, show it prominently without selector
  if (classes.length === 1 && !showAddButton) {
    const singleClass = classes[0];
    return (
      <View style={styles.container}>
        <View style={styles.singleClassCard}>
          <View style={styles.classInfo}>
            <Text style={styles.className}>{singleClass.name}</Text>
            {singleClass.sailNumber && (
              <Text style={styles.classDetail}>#{singleClass.sailNumber}</Text>
            )}
            {singleClass.boatName && (
              <Text style={styles.classDetail}>{singleClass.boatName}</Text>
            )}
            {singleClass.group && (
              <Text style={styles.groupBadge}>{singleClass.group.name}</Text>
            )}
          </View>
          {singleClass.isPrimary && (
            <View style={styles.primaryBadgeSimple}>
              <Text style={styles.primaryText}>Primary</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.boatsScroll}
      >
        {classes.map((boatClass) => {
          const isActive = boatClass.id === currentSelection;

          const menuItems: CardMenuItem[] = [
            {
              label: 'View Equipment & Maintenance',
              icon: 'construct-outline',
              onPress: () => router.push(`/boat/${boatClass.id}`),
            },
            {
              label: 'Edit Boat',
              icon: 'create-outline',
              onPress: () => logger.debug('Edit boat:', boatClass.id),
            },
            {
              label: boatClass.isPrimary ? 'Remove Primary' : 'Set as Primary',
              icon: boatClass.isPrimary ? 'star' : 'star-outline',
              onPress: () => logger.debug('Toggle primary:', boatClass.id),
            },
            {
              label: 'Remove Boat',
              icon: 'trash-outline',
              onPress: () => logger.debug('Remove boat:', boatClass.id),
              variant: 'destructive' as const,
            },
          ];

          return (
            <TouchableOpacity
              key={boatClass.id}
              style={[styles.boatCard, isActive && styles.boatCardActive]}
              onPress={() => handleBoatPress(boatClass.id)}
              activeOpacity={0.9}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.statusDot, isActive && styles.statusDotActive]} />
                <CardMenu items={menuItems} iconColor={isActive ? '#FFFFFF' : '#64748B'} />
              </View>

              <View style={[styles.boatIcon, isActive && styles.boatIconActive]}>
                <Ionicons
                  name="boat"
                  size={32}
                  color={isActive ? '#FFFFFF' : '#3B82F6'}
                />
              </View>

              <View style={styles.boatContent}>
                <Text style={[styles.boatName, isActive && styles.boatNameActive]} numberOfLines={1}>
                  {boatClass.boatName || boatClass.name}
                </Text>
                <Text style={[styles.boatClass, isActive && styles.boatClassActive]} numberOfLines={1}>
                  {boatClass.name}
                </Text>
                {boatClass.sailNumber && (
                  <Text style={[styles.sailNumber, isActive && styles.sailNumberActive]}>
                    USA {boatClass.sailNumber}
                  </Text>
                )}
              </View>

              {/* Equipment Status Indicators */}
              <View style={styles.boatFooter}>
                {boatClass.isPrimary && (
                  <View style={styles.primaryBadge}>
                    <Ionicons name="star" size={12} color="#FBBF24" />
                    <Text style={styles.primaryBadgeText}>Primary</Text>
                  </View>
                )}
                {boatClass.equipmentAlertCount && boatClass.equipmentAlertCount > 0 && (
                  <View style={[styles.alertBadge, isActive && styles.alertBadgeActive]}>
                    <Ionicons name="notifications" size={12} color={isActive ? '#FCA5A5' : '#EF4444'} />
                    <Text style={[styles.alertBadgeText, isActive && styles.alertBadgeTextActive]}>
                      {boatClass.equipmentAlertCount}
                    </Text>
                  </View>
                )}
                {boatClass.maintenanceDueCount && boatClass.maintenanceDueCount > 0 && (
                  <View style={[styles.maintenanceBadge, isActive && styles.maintenanceBadgeActive]}>
                    <Ionicons name="build" size={12} color={isActive ? '#FCD34D' : '#F59E0B'} />
                    <Text style={[styles.maintenanceBadgeText, isActive && styles.maintenanceBadgeTextActive]}>
                      {boatClass.maintenanceDueCount}
                    </Text>
                  </View>
                )}
              </View>

              {/* Quick Equipment Access Button */}
              <TouchableOpacity
                style={[styles.equipmentButton, isActive && styles.equipmentButtonActive]}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(`/boat/${boatClass.id}`);
                }}
              >
                <Ionicons name="construct" size={14} color={isActive ? '#FFFFFF' : '#3B82F6'} />
                <Text style={[styles.equipmentButtonText, isActive && styles.equipmentButtonTextActive]}>
                  Equipment
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {/* Add Boat Card */}
        {showAddButton && onAddBoat && (
          <TouchableOpacity
            style={styles.addBoatCard}
            onPress={onAddBoat}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={32} color="#3B82F6" />
            <Text style={styles.addBoatLabel}>Add Boat</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  boatsScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  boatCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0px 6px',
    elevation: 5,
  },
  boatCardActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
    borderWidth: 2,
    boxShadow: '0px 8px',
    elevation: 8,
    transform: [{ scale: 1.03 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CBD5F5',
  },
  statusDotActive: {
    backgroundColor: '#34D399',
  },
  boatIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'center',
  },
  boatIconActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  boatContent: {
    gap: 4,
    marginBottom: 8,
  },
  boatFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  boatName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  boatNameActive: {
    color: '#FFFFFF',
  },
  boatClass: {
    fontSize: 13,
    color: '#64748B',
  },
  boatClassActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  sailNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 2,
  },
  sailNumberActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alertBadgeActive: {
    backgroundColor: 'rgba(252, 165, 165, 0.3)',
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991B1B',
  },
  alertBadgeTextActive: {
    color: '#FCA5A5',
  },
  maintenanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  maintenanceBadgeActive: {
    backgroundColor: 'rgba(252, 211, 77, 0.3)',
  },
  maintenanceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  maintenanceBadgeTextActive: {
    color: '#FCD34D',
  },
  equipmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  equipmentButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  equipmentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  equipmentButtonTextActive: {
    color: '#FFFFFF',
  },
  addBoatCard: {
    width: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addBoatLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  singleClassCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  classInfo: {
    flex: 1,
    gap: 4,
  },
  className: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  classDetail: {
    fontSize: 14,
    color: '#64748B',
  },
  groupBadge: {
    fontSize: 12,
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  primaryBadgeSimple: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  primaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
