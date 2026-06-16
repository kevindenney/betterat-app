/**
 * RacingAreaSelector - Dropdown to select a specific racing area or race route
 * Used to filter venue knowledge content by location
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import {
  useVenueRacingAreasAndRoutes,
  RacingAreaOrRoute,
  getRacingAreaIcon,
} from '@/hooks/useVenueRacingAreas';

interface RacingAreaSelectorProps {
  venueId: string;
  venueName: string;
  selectedAreaId: string | null;
  selectedRouteId: string | null;
  onSelect: (selection: {
    racingAreaId: string | null;
    raceRouteId: string | null;
    name: string | null;
  }) => void;
  compact?: boolean;
}

export function RacingAreaSelector({
  venueId,
  venueName,
  selectedAreaId,
  selectedRouteId,
  onSelect,
  compact = false,
}: RacingAreaSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const { items, racingAreas, raceRoutes, isLoading, error } = useVenueRacingAreasAndRoutes(venueId);

  // Find the currently selected item
  const selectedItem = items.find(
    (item) =>
      (item.type === 'racing_area' && item.id === selectedAreaId) ||
      (item.type === 'race_route' && item.id === selectedRouteId)
  );

  const handleSelect = (item: RacingAreaOrRoute | null) => {
    if (!item) {
      onSelect({ racingAreaId: null, raceRouteId: null, name: null });
    } else if (item.type === 'racing_area') {
      onSelect({ racingAreaId: item.id, raceRouteId: null, name: item.name });
    } else {
      onSelect({ racingAreaId: null, raceRouteId: item.id, name: item.name });
    }
    setModalVisible(false);
  };

  // Don't show selector if there are no racing areas or routes
  if (!isLoading && items.length === 0) {
    return null;
  }

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        style={[styles.trigger, compact && styles.triggerCompact]}
        onPress={() => setModalVisible(true)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#6B7280" />
        ) : (
          <>
            <Ionicons
              name={selectedItem ? (getRacingAreaIcon(selectedItem.type) as any) : 'location-outline'}
              size={compact ? 14 : 16}
              color={selectedItem ? '#007AFF' : '#6B7280'}
            />
            <ThemedText
              style={[
                styles.triggerText,
                compact && styles.triggerTextCompact,
                selectedItem && styles.triggerTextSelected,
              ]}
              numberOfLines={1}
            >
              {selectedItem ? selectedItem.name : `All ${venueName}`}
            </ThemedText>
            <Ionicons name="chevron-down" size={compact ? 14 : 16} color="#9CA3AF" />
          </>
        )}
      </TouchableOpacity>

      {/* Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Racing Area</ThemedText>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* "All Areas" option */}
            <TouchableOpacity
              style={[
                styles.optionItem,
                !selectedAreaId && !selectedRouteId && styles.optionItemSelected,
              ]}
              onPress={() => handleSelect(null)}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="globe-outline" size={20} color="#6B7280" />
              </View>
              <View style={styles.optionContent}>
                <ThemedText style={styles.optionTitle}>All {venueName}</ThemedText>
                <ThemedText style={styles.optionDescription}>
                  Show all discussions, documents, and tips
                </ThemedText>
              </View>
              {!selectedAreaId && !selectedRouteId && (
                <Ionicons name="checkmark-circle" size={22} color="#007AFF" />
              )}
            </TouchableOpacity>

            {/* Racing Areas Section */}
            {racingAreas.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="water-outline" size={16} color="#6B7280" />
                  <ThemedText style={styles.sectionTitle}>Racing Areas</ThemedText>
                </View>
                {racingAreas.map((area) => {
                  const item: RacingAreaOrRoute = {
                    id: area.id,
                    name: area.areaName,
                    type: 'racing_area',
                    description: area.description,
                  };
                  const isSelected = selectedAreaId === area.id;
                  return (
                    <TouchableOpacity
                      key={area.id}
                      style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={[styles.optionIcon, styles.optionIconBlue]}>
                        <Ionicons name="water" size={18} color="#007AFF" />
                      </View>
                      <View style={styles.optionContent}>
                        <ThemedText style={styles.optionTitle}>{area.areaName}</ThemedText>
                        {area.description && (
                          <ThemedText style={styles.optionDescription} numberOfLines={2}>
                            {area.description}
                          </ThemedText>
                        )}
                        {area.classesUsed && area.classesUsed.length > 0 && (
                          <View style={styles.classTags}>
                            {area.classesUsed.slice(0, 3).map((cls) => (
                              <View key={cls} style={styles.classTag}>
                                <ThemedText style={styles.classTagText}>{cls}</ThemedText>
                              </View>
                            ))}
                            {area.classesUsed.length > 3 && (
                              <ThemedText style={styles.moreClasses}>
                                +{area.classesUsed.length - 3}
                              </ThemedText>
                            )}
                          </View>
                        )}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Race Routes Section */}
            {raceRoutes.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="navigate-outline" size={16} color="#6B7280" />
                  <ThemedText style={styles.sectionTitle}>Distance Races</ThemedText>
                </View>
                {raceRoutes.map((route) => {
                  const item: RacingAreaOrRoute = {
                    id: route.id,
                    name: route.name,
                    type: 'race_route',
                    description: route.description,
                    distanceNm: route.typicalDistanceNm,
                  };
                  const isSelected = selectedRouteId === route.id;
                  return (
                    <TouchableOpacity
                      key={route.id}
                      style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={[styles.optionIcon, styles.optionIconPurple]}>
                        <Ionicons name="navigate" size={18} color="#7C3AED" />
                      </View>
                      <View style={styles.optionContent}>
                        <View style={styles.routeHeader}>
                          <ThemedText style={styles.optionTitle}>{route.name}</ThemedText>
                          {route.typicalDistanceNm && (
                            <View style={styles.distanceBadge}>
                              <ThemedText style={styles.distanceText}>
                                {route.typicalDistanceNm}nm
                              </ThemedText>
                            </View>
                          )}
                        </View>
                        {route.description && (
                          <ThemedText style={styles.optionDescription} numberOfLines={2}>
                            {route.description}
                          </ThemedText>
                        )}
                        {route.organizingClub && (
                          <ThemedText style={styles.organizingClub}>
                            {route.organizingClub}
                          </ThemedText>
                        )}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color="#7C3AED" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Error state */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={24} color="#DC2626" />
                <ThemedText style={styles.errorText}>
                  Failed to load racing areas
                </ThemedText>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  triggerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  triggerTextCompact: {
    fontSize: 13,
  },
  triggerTextSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: 'pointer',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  optionItemSelected: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#EFF6FF',
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconBlue: {
    backgroundColor: '#DBEAFE',
  },
  optionIconPurple: {
    backgroundColor: '#EDE9FE',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 18,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
  },
  organizingClub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  classTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  classTag: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  classTagText: {
    fontSize: 11,
    color: '#0284C7',
  },
  moreClasses: {
    fontSize: 11,
    color: '#9CA3AF',
    paddingVertical: 2,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
});

export default RacingAreaSelector;
