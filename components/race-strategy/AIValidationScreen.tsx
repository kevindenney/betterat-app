/**
 * AI Validation Screen
 *
 * Shows AI-extracted course data with confidence scoring
 * User can approve, edit, or switch to manual mode
 *
 * Part of vertical slice: Document Upload → AI Extraction → Visualization → Validation
 */

// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import RaceEventService from '@/services/RaceEventService';
import { RaceEventWithDetails, ExtractionStatus } from '@/types/raceEvents';
import CourseMapVisualization from './CourseMapVisualization';
import QuickDrawMode from './QuickDrawMode';

interface AIValidationScreenProps {
  raceEventId: string;
  onApprove: () => void;
  onEdit: () => void;
  onManualMode: () => void;
}

export function AIValidationScreen({
  raceEventId,
  onApprove,
  onEdit,
  onManualMode
}: AIValidationScreenProps) {
  const [raceEvent, setRaceEvent] = useState<RaceEventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showQuickDraw, setShowQuickDraw] = useState(false);

  useEffect(() => {
    loadRaceEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceEventId]);

  const loadRaceEvent = async () => {
    try {
      const { data, error: fetchError } = await RaceEventService.getRaceEvent(raceEventId);

      if (fetchError || !data) {
        throw new Error(fetchError?.message || 'Failed to load race event');
      }

      setRaceEvent(data);
    } catch (err) {
      console.error('Error loading race event:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!raceEvent) return;

    try {
      // Update extraction status to completed
      await RaceEventService.updateRaceEvent(raceEventId, {
        extraction_status: ExtractionStatus.COMPLETED
      });

      onApprove();
    } catch (err) {
      console.error('Error approving:', err);
      setError('Failed to approve');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0080ff" />
        <Text style={styles.loadingText}>Loading race data...</Text>
      </View>
    );
  }

  if (error || !raceEvent) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>⚠️ {error || 'Race event not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRaceEvent}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const confidenceScore = raceEvent.confidence_score || 0;
  const confidencePercentage = Math.round(confidenceScore * 100);
  const confidenceColor = confidenceScore >= 0.8 ? '#00cc00' : confidenceScore >= 0.6 ? '#ff9900' : '#ff0000';

  // Check if GPS coordinates are missing
  const hasGPSCoordinates = raceEvent.marks && raceEvent.marks.length > 0;

  // Prepare marks for Quick Draw (from AI extraction but without GPS)
  const extractedMarksForQuickDraw = raceEvent.marks?.map(mark => ({
    name: mark.name,
    type: mark.mark_type as any,
    confidence: 0.8 // Default confidence since race_marks table doesn't store confidence
  })) || [];

  const handleQuickDrawComplete = async (placedMarks: any[]) => {
    try {
      // Update race event with placed marks
      await RaceEventService.addCourseMarks(raceEventId, placedMarks.map(mark => ({
        name: mark.name,
        mark_type: mark.type,
        latitude: mark.lat,
        longitude: mark.lng,
        color: mark.color || null,
        shape: mark.shape || 'inflatable'
      })));

      // Reload race event to show updated marks
      await loadRaceEvent();
      setShowQuickDraw(false);
    } catch (err) {
      console.error('Error saving Quick Draw marks:', err);
      setError('Failed to save marks');
    }
  };

  if (showQuickDraw) {
    return (
      <QuickDrawMode
        extractedMarks={extractedMarksForQuickDraw}
        racingAreaName={raceEvent.racing_area_name || 'Unknown Area'}
        courseType={raceEvent.course_configuration}
        onComplete={handleQuickDrawComplete}
        onCancel={() => setShowQuickDraw(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Course Extracted from Documents</Text>
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceLabel}>Confidence:</Text>
          <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
            <Text style={styles.confidenceText}>{confidencePercentage}%</Text>
          </View>
        </View>
      </View>

      {/* Course Preview Map */}
      <View style={styles.mapContainer}>
        <Text style={styles.sectionTitle}>Course Preview</Text>
        {hasGPSCoordinates ? (
          <CourseMapVisualization
            marks={raceEvent.marks}
            racingAreaBoundary={raceEvent.racing_area_boundary}
          />
        ) : (
          <View style={styles.noMapContainer}>
            <Text style={styles.noMapText}>
              📍 No GPS coordinates in documents
            </Text>
            <Text style={styles.noMapHint}>
              AI found {extractedMarksForQuickDraw.length} marks:{' '}
              {extractedMarksForQuickDraw.map(m => m.name).join(', ')}
            </Text>
            <TouchableOpacity
              style={styles.quickDrawButton}
              onPress={() => setShowQuickDraw(true)}
            >
              <Text style={styles.quickDrawButtonText}>
                🎯 Quick Draw Racing Area
              </Text>
              <Text style={styles.quickDrawButtonHint}>
                60 sec vs 30 min manual
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Extracted Information */}
      <View style={styles.infoContainer}>
        <Text style={styles.sectionTitle}>Extracted Information</Text>

        <View style={styles.infoGrid}>
          <InfoItem label="Race Name" value={raceEvent.race_name} />
          <InfoItem label="Series" value={raceEvent.race_series} />
          <InfoItem label="Boat Class" value={raceEvent.boat_class} />
          <InfoItem
            label="Start Time"
            value={raceEvent.start_time ? new Date(raceEvent.start_time).toLocaleString() : undefined}
          />
          <InfoItem label="Racing Area" value={raceEvent.racing_area_name} />
          <InfoItem label="Venue" value={raceEvent.venue?.name} />
          <InfoItem label="Course Type" value={raceEvent.course_configuration} />
        </View>

        {/* Course Marks */}
        {raceEvent.marks && raceEvent.marks.length > 0 && (
          <View style={styles.marksSection}>
            <Text style={styles.subsectionTitle}>
              Course Marks ({raceEvent.marks.length})
            </Text>
            {raceEvent.marks
              .sort((a, b) => (a.sequence_number || 999) - (b.sequence_number || 999))
              .map((mark, _index) => (
                <View key={mark.id} style={styles.markItem}>
                  <View style={styles.markHeader}>
                    <Text style={styles.markName}>
                      {mark.sequence_number ? `${mark.sequence_number}. ` : ''}
                      {mark.mark_name}
                    </Text>
                    <Text style={styles.markType}>{mark.mark_type}</Text>
                  </View>
                  {mark.rounding_direction && (
                    <Text style={styles.markDetail}>
                      Rounding: {mark.rounding_direction}
                    </Text>
                  )}
                  {mark.mark_color && (
                    <Text style={styles.markDetail}>
                      Color: {mark.mark_color}
                    </Text>
                  )}
                  {mark.confidence_score && (
                    <Text style={styles.markConfidence}>
                      Confidence: {Math.round(mark.confidence_score * 100)}%
                    </Text>
                  )}
                </View>
              ))}
          </View>
        )}
      </View>

      {/* Validation Question */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>Does this look correct?</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={handleApprove}
        >
          <Text style={styles.actionButtonText}>✓ Yes, Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={onEdit}
        >
          <Text style={styles.actionButtonText}>✎ Edit Course</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.manualButton]}
          onPress={onManualMode}
        >
          <Text style={styles.manualButtonText}>Draw My Own Course</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/**
 * Info Item Component
 */
function InfoItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;

  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  errorText: {
    fontSize: 16,
    color: '#cc0000',
    textAlign: 'center',
    marginBottom: 16
  },
  retryButton: {
    backgroundColor: '#0080ff',
    padding: 12,
    borderRadius: 8
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000'
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  confidenceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  mapContainer: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000'
  },
  noMapContainer: {
    backgroundColor: '#fff8e1',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffd54f'
  },
  noMapText: {
    fontSize: 16,
    color: '#f57c00',
    marginBottom: 8
  },
  noMapHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16
  },
  quickDrawButton: {
    backgroundColor: '#2196f3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16
  },
  quickDrawButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  quickDrawButtonHint: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9
  },
  infoContainer: {
    padding: 20,
    backgroundColor: '#f9f9f9'
  },
  infoGrid: {
    gap: 12
  },
  infoItem: {
    marginBottom: 8
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2
  },
  infoValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500'
  },
  marksSection: {
    marginTop: 20
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000'
  },
  markItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0080ff'
  },
  markHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  markName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000'
  },
  markType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  markDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2
  },
  markConfidence: {
    fontSize: 12,
    color: '#999',
    marginTop: 4
  },
  questionContainer: {
    padding: 20,
    alignItems: 'center'
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000'
  },
  actionsContainer: {
    padding: 20,
    gap: 12
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  approveButton: {
    backgroundColor: '#00cc00'
  },
  editButton: {
    backgroundColor: '#0080ff'
  },
  manualButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#999'
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  manualButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600'
  }
});

export default AIValidationScreen;
