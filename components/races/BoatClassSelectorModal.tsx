/**
 * BoatClassSelectorModal Component
 * Allows users to select a boat class for a race
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { tuningGuideService } from '@/services/tuningGuideService';
import { getDefaultGuidesForClass } from '@/data/default-tuning-guides';
import { createLogger } from '@/lib/utils/logger';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';

const logger = createLogger('BoatClassSelectorModal');

interface BoatClass {
  id: string;
  name: string;
  class_association?: string | null;
}

interface BoatClassSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  raceId: string;
  currentClassId?: string | null;
  onClassSelected?: (classId: string, className: string) => void;
}

export function BoatClassSelectorModal({
  visible,
  onClose,
  raceId,
  currentClassId,
  onClassSelected,
}: BoatClassSelectorModalProps) {
  const router = useRouter();
  const [classes, setClasses] = useState<BoatClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(currentClassId || null);
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null);
  const [showPostSelection, setShowPostSelection] = useState(false);
  const [checkingGuides, setCheckingGuides] = useState(false);
  const [hasGuides, setHasGuides] = useState(false);
  const [hasDefaultGuides, setHasDefaultGuides] = useState(false);
  const [fetchingGuides, setFetchingGuides] = useState(false);

  useEffect(() => {
    if (visible) {
      loadBoatClasses();
      setSelectedClassId(currentClassId || null);
      setShowPostSelection(false);
      setHasGuides(false);
      setHasDefaultGuides(false);
    }
  }, [visible, currentClassId]);

  const loadBoatClasses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('boat_classes')
        .select('id, name, class_association')
        .order('name');

      if (error) throw error;
      setClasses(data || []);
    } catch (err: any) {
      logger.error('Error loading boat classes:', err);
      showAlert('Error', 'Failed to load boat classes');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClass = async (classId: string, className: string) => {
    if (saving) return;

    try {
      setSaving(true);
      setSelectedClassId(classId);

      // First, get the current race data to preserve existing metadata
      const { data: currentRace, error: fetchError } = await supabase
        .from('regattas')
        .select('metadata')
        .eq('id', raceId)
        .single();

      if (fetchError) {
        logger.error('Error fetching current race data:', fetchError);
        showAlert('Error', 'Failed to load race data');
        setSelectedClassId(currentClassId || null);
        return;
      }

      // Update the race's class_id and metadata
      const updatedMetadata = {
        ...(currentRace?.metadata || {}),
        class_id: classId,
        class_name: className,
      };

      const { error } = await supabase
        .from('regattas')
        .update({
          class_id: classId,
          metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', raceId);

      if (error) {
        logger.error('Error updating race class:', error);
        showAlert('Error', 'Failed to update race class');
        setSelectedClassId(currentClassId || null);
        return;
      }

      logger.info('Race class updated successfully:', { raceId, classId, className });
      
      // Set selected class name for post-selection screen
      setSelectedClassName(className);
      
      // Check for tuning guides
      const guideCheckResult = await checkTuningGuides(classId, className);
      
      // Call the callback if provided
      onClassSelected?.(classId, className);
      
      // If guides exist, close modal. Otherwise show post-selection screen
      if (guideCheckResult.hasGuides || guideCheckResult.hasDefaultGuides) {
        setTimeout(() => {
          onClose();
        }, 300);
      } else {
        setShowPostSelection(true);
      }
    } catch (err: any) {
      logger.error('Exception updating race class:', err);
      showAlert('Error', 'Failed to update race class');
      setSelectedClassId(currentClassId || null);
    } finally {
      setSaving(false);
    }
  };

  const checkTuningGuides = async (classId: string, className: string): Promise<{ hasGuides: boolean; hasDefaultGuides: boolean }> => {
    try {
      setCheckingGuides(true);
      
      // Check for database guides
      const guides = await tuningGuideService.getGuidesForClass(classId, className);
      const hasDbGuides = guides.length > 0;
      setHasGuides(hasDbGuides);
      
      // Check for default/fallback guides
      const defaultGuides = getDefaultGuidesForClass(className);
      const hasDefaults = defaultGuides.length > 0;
      setHasDefaultGuides(hasDefaults);
      
      logger.info('Tuning guides check:', {
        classId,
        className,
        hasGuides: hasDbGuides,
        hasDefaultGuides: hasDefaults,
      });
      
      return { hasGuides: hasDbGuides, hasDefaultGuides: hasDefaults };
    } catch (err: any) {
      logger.error('Error checking tuning guides:', err);
      setHasGuides(false);
      setHasDefaultGuides(false);
      return { hasGuides: false, hasDefaultGuides: false };
    } finally {
      setCheckingGuides(false);
    }
  };

  const handleFetchGuides = async () => {
    if (!selectedClassId || !selectedClassName || fetchingGuides) return;

    try {
      setFetchingGuides(true);
      
      showConfirm(
        `Fetch ${selectedClassName} Tuning Guides`,
        `Search for tuning guides from North Sails, Quantum, and other major sailmakers for ${selectedClassName}?`,
        async () => {
          await tuningGuideService.triggerAutoScrape(selectedClassId);
          showAlertWithButtons(
            'Search Started',
            `Searching for ${selectedClassName} tuning guides... Check the Tuning Guides tab in a few moments.`,
            [
              {
                text: 'View Tuning Guides',
                onPress: () => {
                  onClose();
                  router.push('/(tabs)/tuning-guides');
                },
              },
              { text: 'OK', style: 'cancel' },
            ]
          );
        },
      );
    } catch (err: any) {
      logger.error('Error fetching guides:', err);
      showAlert('Error', 'Failed to start guide search');
    } finally {
      setFetchingGuides(false);
    }
  };

  const handleViewTuningGuides = () => {
    onClose();
    router.push('/(tabs)/tuning-guides');
  };

  const handleContinue = () => {
    onClose();
  };

  const _selectedClass = classes.find(c => c.id === selectedClassId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            disabled={saving}
          >
            <MaterialCommunityIcons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.title}>Select Boat Class</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content}>
          {showPostSelection && selectedClassName ? (
            <View style={styles.postSelectionContainer}>
              {checkingGuides ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.loadingText}>Checking for tuning guides...</Text>
                </View>
              ) : (
                <>
                  {/* Success Message */}
                  <View style={styles.successContainer}>
                    <MaterialCommunityIcons name="check-circle" size={48} color="#10B981" />
                    <Text style={styles.successTitle}>Class Set: {selectedClassName}</Text>
                    <Text style={styles.successText}>
                      The boat class has been set for this race.
                    </Text>
                  </View>

                  {/* No Guides Found Message */}
                  {!hasGuides && !hasDefaultGuides && (
                    <View style={styles.noGuidesContainer}>
                      <MaterialCommunityIcons name="book-cog-outline" size={40} color="#F59E0B" />
                      <Text style={styles.noGuidesTitle}>No Tuning Guide Found</Text>
                      <Text style={styles.noGuidesText}>
                        We couldn't find a tuning guide for {selectedClassName} in your library. 
                        Add one to unlock race-day rig checklists and tuning recommendations.
                      </Text>

                      {/* AI Recommendations Available Badge */}
                      <View style={styles.aiBadge}>
                        <MaterialCommunityIcons name="robot-outline" size={16} color="#7C3AED" />
                        <Text style={styles.aiBadgeText}>
                          Recommendations available even without a guide
                        </Text>
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.primaryButton]}
                          onPress={handleFetchGuides}
                          disabled={fetchingGuides}
                        >
                          {fetchingGuides ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                          )}
                          <Text style={styles.primaryButtonText}>
                            {fetchingGuides ? 'Searching...' : 'Fetch Guides'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionButton, styles.secondaryButton]}
                          onPress={handleViewTuningGuides}
                        >
                          <Ionicons name="book-outline" size={20} color="#3B82F6" />
                          <Text style={styles.secondaryButtonText}>View Tuning Guides</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Guides Found Message */}
                  {(hasGuides || hasDefaultGuides) && (
                    <View style={styles.guidesFoundContainer}>
                      <MaterialCommunityIcons name="book-check-outline" size={40} color="#10B981" />
                      <Text style={styles.guidesFoundTitle}>Tuning Guides Available</Text>
                      <Text style={styles.guidesFoundText}>
                        {hasGuides 
                          ? `Found tuning guides for ${selectedClassName} in your library.`
                          : `Default tuning guides are available for ${selectedClassName}.`
                        }
                      </Text>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={handleViewTuningGuides}
                      >
                        <Ionicons name="book-outline" size={20} color="#3B82F6" />
                        <Text style={styles.secondaryButtonText}>View Guides</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Continue Button */}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.continueButton]}
                    onPress={handleContinue}
                  >
                    <Text style={styles.continueButtonText}>Continue</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.description}>
                Select a boat class for this race to unlock rig tuning checklists and class-based start sequences.
              </Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.loadingText}>Loading boat classes...</Text>
                </View>
              ) : (
                <View style={styles.classesList}>
                  {classes.map((boatClass) => {
                    const isSelected = selectedClassId === boatClass.id;
                    const isCurrentlySelected = currentClassId === boatClass.id;

                    return (
                      <TouchableOpacity
                        key={boatClass.id}
                        style={[
                          styles.classCard,
                          isSelected && styles.classCardSelected,
                        ]}
                        onPress={() => {
                          setSelectedClassName(boatClass.name);
                          handleSelectClass(boatClass.id, boatClass.name);
                        }}
                        disabled={saving}
                      >
                        <View style={styles.classCardContent}>
                          <View style={styles.classCardLeft}>
                            <Text style={[
                              styles.className,
                              isSelected && styles.classNameSelected,
                            ]}>
                              {boatClass.name}
                            </Text>
                            {boatClass.class_association && (
                              <Text style={[
                                styles.classAssociation,
                                isSelected && styles.classAssociationSelected,
                              ]}>
                                {boatClass.class_association}
                              </Text>
                            )}
                          </View>
                          <View style={styles.classCardRight}>
                            {isCurrentlySelected && !isSelected && (
                              <View style={styles.currentBadge}>
                                <Text style={styles.currentBadgeText}>Current</Text>
                              </View>
                            )}
                            {isSelected && (
                              <MaterialCommunityIcons
                                name="check-circle"
                                size={24}
                                color="#3B82F6"
                              />
                            )}
                            {saving && isSelected && (
                              <ActivityIndicator
                                size="small"
                                color="#3B82F6"
                                style={styles.savingIndicator}
                              />
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  classesList: {
    gap: 12,
  },
  classCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  classCardSelected: {
    borderColor: '#3B82F6',
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
  },
  classCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  classCardLeft: {
    flex: 1,
  },
  classCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  classNameSelected: {
    color: '#1E40AF',
  },
  classAssociation: {
    fontSize: 13,
    color: '#64748B',
  },
  classAssociationSelected: {
    color: '#3B82F6',
  },
  currentBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  savingIndicator: {
    marginLeft: 8,
  },
  postSelectionContainer: {
    paddingVertical: 20,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  noGuidesContainer: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  noGuidesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400E',
    marginTop: 12,
    marginBottom: 8,
  },
  noGuidesText: {
    fontSize: 14,
    color: '#78350F',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  guidesFoundContainer: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  guidesFoundTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#166534',
    marginTop: 12,
    marginBottom: 8,
  },
  guidesFoundText: {
    fontSize: 14,
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 20,
  },
  aiBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
  actionButtons: {
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#3B82F6',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  continueButton: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
});

