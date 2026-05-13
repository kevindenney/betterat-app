/**
 * Maintenance Guide Card
 * Displays AI-generated or cached care instructions for equipment
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { equipmentMaintenanceService } from '@/services/EquipmentMaintenanceService';
import type { AICareGuide, BoatEquipment } from '@/services/EquipmentService';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('MaintenanceGuideCard');

interface MaintenanceGuideCardProps {
  equipment: BoatEquipment;
  onGenerateGuide?: () => void;
  compact?: boolean;
}

type ExpandedSection = 'lubrication' | 'inspection' | 'cleaning' | 'storage' | 'warnings' | 'tips' | null;

export function MaintenanceGuideCard({ equipment, onGenerateGuide, compact = false }: MaintenanceGuideCardProps) {
  const [guide, setGuide] = useState<AICareGuide | null>(equipment.ai_care_guide || null);
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [error, setError] = useState<string | null>(null);

  const hasGuide = guide !== null;
  const isAIAvailable = equipmentMaintenanceService.isAvailable();

  const handleGenerateGuide = async () => {
    try {
      setLoading(true);
      setError(null);
      const newGuide = await equipmentMaintenanceService.generateAndStoreCareGuide(equipment.id);
      if (newGuide) {
        setGuide(newGuide);
        onGenerateGuide?.();
      } else {
        setError('Could not generate care guide');
      }
    } catch (err) {
      logger.error('Error generating guide', { err });
      setError('Failed to generate guide');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const openManufacturerDoc = () => {
    if (equipment.manufacturer_doc_url) {
      Linking.openURL(equipment.manufacturer_doc_url);
    }
  };

  if (compact && !hasGuide) {
    return (
      <TouchableOpacity
        style={styles.compactEmpty}
        onPress={handleGenerateGuide}
        disabled={loading || !isAIAvailable}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#3B82F6" />
        ) : (
          <>
            <Ionicons name="sparkles" size={16} color={isAIAvailable ? '#3B82F6' : '#94A3B8'} />
            <Text style={[styles.compactEmptyText, !isAIAvailable && { color: '#94A3B8' }]}>
              {isAIAvailable ? 'Generate Care Guide' : 'Unavailable'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  if (!hasGuide) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="book-outline" size={32} color="#94A3B8" />
        </View>
        <Text style={styles.emptyTitle}>No Care Guide</Text>
        <Text style={styles.emptyDescription}>
          {isAIAvailable
            ? 'Generate a maintenance guide with care instructions, lubrication schedules, and performance tips'
            : 'Guide generation is not available. Add manual care instructions in equipment settings.'}
        </Text>
        
        {equipment.manufacturer_doc_url && (
          <TouchableOpacity style={styles.docLink} onPress={openManufacturerDoc}>
            <Ionicons name="document-text-outline" size={16} color="#3B82F6" />
            <Text style={styles.docLinkText}>View Manufacturer Documentation</Text>
          </TouchableOpacity>
        )}

        {isAIAvailable && (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateGuide}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                <Text style={styles.generateButtonText}>Generate Guide</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>
    );
  }

  // Has guide - render full guide
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiIconContainer}>
            <Ionicons name="sparkles" size={16} color="#7C3AED" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Care Guide</Text>
            {guide.generated_at && (
              <Text style={styles.headerMeta}>
                Generated {new Date(guide.generated_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleGenerateGuide}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Ionicons name="refresh" size={18} color="#3B82F6" />
          )}
        </TouchableOpacity>
      </View>

      {/* Manufacturer Doc Link */}
      {equipment.manufacturer_doc_url && (
        <TouchableOpacity style={styles.manufacturerDoc} onPress={openManufacturerDoc}>
          <Ionicons name="document-text-outline" size={16} color="#3B82F6" />
          <Text style={styles.manufacturerDocText}>Manufacturer Documentation</Text>
          <Ionicons name="open-outline" size={14} color="#3B82F6" />
        </TouchableOpacity>
      )}

      {/* Lubrication Schedule */}
      {guide.lubrication_schedule && guide.lubrication_schedule.length > 0 && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => toggleSection('lubrication')}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="water-outline" size={16} color="#D97706" />
            </View>
            <Text style={styles.sectionTitle}>Lubrication Schedule</Text>
            <Ionicons
              name={expandedSection === 'lubrication' ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#64748B"
            />
          </View>
          {expandedSection === 'lubrication' && (
            <View style={styles.sectionContent}>
              {guide.lubrication_schedule.map((item, idx) => (
                <View key={idx} style={styles.lubricationItem}>
                  <View style={styles.lubricationHeader}>
                    <Text style={styles.lubricationInterval}>{item.interval}</Text>
                    <Text style={styles.lubricationType}>{item.type}</Text>
                  </View>
                  <Text style={styles.lubricationInstructions}>{item.instructions}</Text>
                  {item.parts && item.parts.length > 0 && (
                    <View style={styles.lubricationParts}>
                      {item.parts.map((part, pIdx) => (
                        <View key={pIdx} style={styles.partChip}>
                          <Text style={styles.partChipText}>{part}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Inspection Checklist */}
      {guide.inspection_checklist && guide.inspection_checklist.length > 0 && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => toggleSection('inspection')}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="checkbox-outline" size={16} color="#3B82F6" />
            </View>
            <Text style={styles.sectionTitle}>Inspection Checklist</Text>
            <Ionicons
              name={expandedSection === 'inspection' ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#64748B"
            />
          </View>
          {expandedSection === 'inspection' && (
            <View style={styles.sectionContent}>
              {guide.inspection_checklist.map((item, idx) => (
                <View key={idx} style={styles.checklistItem}>
                  <View style={styles.checklistBullet} />
                  <Text style={styles.checklistText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Cleaning Instructions */}
      {guide.cleaning_instructions && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => toggleSection('cleaning')}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="sparkles-outline" size={16} color="#059669" />
            </View>
            <Text style={styles.sectionTitle}>Cleaning</Text>
            <Ionicons
              name={expandedSection === 'cleaning' ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#64748B"
            />
          </View>
          {expandedSection === 'cleaning' && (
            <View style={styles.sectionContent}>
              <Text style={styles.sectionText}>{guide.cleaning_instructions}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Storage Recommendations */}
      {guide.storage_recommendations && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => toggleSection('storage')}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#E2E8F0' }]}>
              <Ionicons name="archive-outline" size={16} color="#475569" />
            </View>
            <Text style={styles.sectionTitle}>Storage</Text>
            <Ionicons
              name={expandedSection === 'storage' ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#64748B"
            />
          </View>
          {expandedSection === 'storage' && (
            <View style={styles.sectionContent}>
              <Text style={styles.sectionText}>{guide.storage_recommendations}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Warning Signs */}
      {guide.warning_signs && guide.warning_signs.length > 0 && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => toggleSection('warnings')}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="warning-outline" size={16} color="#DC2626" />
            </View>
            <Text style={styles.sectionTitle}>Warning Signs</Text>
            <Ionicons
              name={expandedSection === 'warnings' ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#64748B"
            />
          </View>
          {expandedSection === 'warnings' && (
            <View style={styles.sectionContent}>
              {guide.warning_signs.map((item, idx) => (
                <View key={idx} style={styles.warningItem}>
                  <Ionicons name="alert-circle" size={14} color="#DC2626" />
                  <Text style={styles.warningText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Performance Tips */}
      {guide.performance_tips && guide.performance_tips.length > 0 && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => toggleSection('tips')}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="bulb-outline" size={16} color="#7C3AED" />
            </View>
            <Text style={styles.sectionTitle}>Performance Tips</Text>
            <Ionicons
              name={expandedSection === 'tips' ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#64748B"
            />
          </View>
          {expandedSection === 'tips' && (
            <View style={styles.sectionContent}>
              {guide.performance_tips.map((item, idx) => (
                <View key={idx} style={styles.tipItem}>
                  <Ionicons name="star" size={14} color="#7C3AED" />
                  <Text style={styles.tipText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  headerMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manufacturerDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  manufacturerDocText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  sectionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  lubricationItem: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  lubricationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lubricationInterval: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  lubricationType: {
    fontSize: 12,
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lubricationInstructions: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  lubricationParts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  partChip: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  partChipText: {
    fontSize: 11,
    color: '#92400E',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checklistBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginTop: 6,
  },
  checklistText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#5B21B6',
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  emptyDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  docLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#7C3AED',
    borderRadius: 24,
    marginTop: 8,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 8,
  },
  compactEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  compactEmptyText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3B82F6',
  },
});

export default MaintenanceGuideCard;

