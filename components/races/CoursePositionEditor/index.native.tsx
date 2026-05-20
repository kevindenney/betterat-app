/**
 * CoursePositionEditor - Native Implementation
 *
 * Full course positioning editor for mobile using react-native-maps.
 * Features:
 * - Tap to place start line center
 * - Draggable markers for course marks
 * - Wind direction and leg length controls
 * - Course type selection
 *
 * Uses react-native-maps (requires development build, not Expo Go)
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save,
  Target,
  X,
  Anchor,
  Flag,
  Wind,
  Minus,
  Plus,
} from 'lucide-react-native';
import type {
  CourseType,
  PositionedCourse,
  PositionedMark,
  StartLinePosition,
} from '@/types/courses';
import {
  CoursePositioningService,
  COURSE_TEMPLATES,
} from '@/services/CoursePositioningService';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { IOS_COLORS } from '@/components/cards/constants';

import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
  type CameraRef,
  type PressEvent,
} from '@maplibre/maplibre-react-native';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const logger = createLogger('CoursePositionEditor.native');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mark colors by type
const MARK_COLORS: Record<string, string> = {
  windward: '#eab308', // yellow
  leeward: '#ef4444', // red
  gate: '#f97316', // orange
  wing: '#22c55e', // green
  offset: '#3b82f6', // blue
  start: '#22c55e', // green
  finish: '#ef4444', // red
};

// Wind direction presets
const WIND_PRESETS: { label: string; degrees: number }[] = [
  { label: 'N', degrees: 0 },
  { label: 'NE', degrees: 45 },
  { label: 'E', degrees: 90 },
  { label: 'SE', degrees: 135 },
  { label: 'S', degrees: 180 },
  { label: 'SW', degrees: 225 },
  { label: 'W', degrees: 270 },
  { label: 'NW', degrees: 315 },
];

// Leg length options
const LEG_LENGTH_OPTIONS = [0.25, 0.35, 0.5, 0.75, 1.0, 1.5];

interface CoursePositionEditorProps {
  visible: boolean;
  regattaId: string;
  sourceDocumentId?: string;
  initialCourseType?: CourseType;
  initialLocation?: { lat: number; lng: number };
  initialWindDirection?: number;
  onSave: (positionedCourse: PositionedCourse) => void;
  onCancel: () => void;
}

export function CoursePositionEditor({
  visible,
  regattaId,
  sourceDocumentId,
  initialCourseType = 'windward_leeward',
  initialLocation,
  initialWindDirection = 180,
  onSave,
  onCancel,
}: CoursePositionEditorProps) {
  const cameraRef = useRef<CameraRef>(null);
  const insets = useSafeAreaInsets();

  // State
  const [saving, setSaving] = useState(false);
  const [courseType, setCourseType] = useState<CourseType>(initialCourseType);
  const [windDirection, setWindDirection] = useState(initialWindDirection);
  const [legLengthNm, setLegLengthNm] = useState(
    COURSE_TEMPLATES[initialCourseType].defaultLegLengthNm
  );
  const [startLineCenter, setStartLineCenter] = useState<{ lat: number; lng: number } | null>(
    initialLocation || null
  );
  const [marks, setMarks] = useState<PositionedMark[]>([]);
  const [startLine, setStartLine] = useState<StartLinePosition | null>(null);
  const [isPlacingStartLine, setIsPlacingStartLine] = useState(!initialLocation);
  const [hasChanges, setHasChanges] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Calculate course positions when parameters change
  const calculateCourse = useCallback(() => {
    if (!startLineCenter) return;

    const result = CoursePositioningService.calculatePositionedCourse({
      startLineCenter,
      windDirection,
      legLengthNm,
      courseType,
    });

    setMarks(result.marks);
    setStartLine(result.startLine);
    setHasChanges(true);
  }, [startLineCenter, windDirection, legLengthNm, courseType]);

  // Recalculate when parameters change
  useEffect(() => {
    calculateCourse();
  }, [calculateCourse]);

  // Initial view (center + zoom) for map
  const initialView = useMemo(() => {
    const center = startLineCenter || initialLocation || { lat: 22.28, lng: 114.16 };
    return {
      center: [center.lng, center.lat] as [number, number],
      zoom: 13,
    };
  }, [startLineCenter, initialLocation]);

  // Handle map press for placing start line
  const handleMapPress = useCallback(
    (event: { nativeEvent: PressEvent }) => {
      if (!isPlacingStartLine) return;
      const [longitude, latitude] = event.nativeEvent.lngLat;
      setStartLineCenter({ lat: latitude, lng: longitude });
      setIsPlacingStartLine(false);
      cameraRef.current?.flyTo({
        center: [longitude, latitude],
        zoom: 14,
        duration: 400,
      });
    },
    [isPlacingStartLine]
  );

  // Mark drag isn't supported on MapLibre RN — edits go through controls below the map.

  // Handle course type change
  const handleCourseTypeChange = useCallback((type: CourseType) => {
    setCourseType(type);
    setLegLengthNm(COURSE_TEMPLATES[type].defaultLegLengthNm);
  }, []);

  // Handle wind direction change
  const handleWindDirectionChange = useCallback(
    (direction: number) => {
      if (startLineCenter && marks.length > 0) {
        const newMarks = CoursePositioningService.recalculateForWindChange(
          marks,
          startLineCenter,
          windDirection,
          direction,
          legLengthNm,
          courseType
        );
        setMarks(newMarks);

        const newStartLine = CoursePositioningService.calculateStartLine(
          startLineCenter,
          direction
        );
        setStartLine(newStartLine);
      }
      setWindDirection(direction);
      setHasChanges(true);
    },
    [startLineCenter, marks, windDirection, legLengthNm, courseType]
  );

  // Handle leg length change
  const handleLegLengthChange = useCallback(
    (length: number) => {
      if (startLineCenter && marks.length > 0) {
        const newMarks = CoursePositioningService.recalculateForLegLengthChange(
          marks,
          startLineCenter,
          windDirection,
          legLengthNm,
          length,
          courseType
        );
        setMarks(newMarks);
      }
      setLegLengthNm(length);
      setHasChanges(true);
    },
    [startLineCenter, marks, windDirection, legLengthNm, courseType]
  );

  // Reset course
  const handleReset = useCallback(() => {
    if (startLineCenter) {
      const template = COURSE_TEMPLATES[courseType];
      setLegLengthNm(template.defaultLegLengthNm);
      calculateCourse();
    }
  }, [startLineCenter, courseType, calculateCourse]);

  // Re-place start line
  const handleReplaceStartLine = useCallback(() => {
    setIsPlacingStartLine(true);
    setMarks([]);
    setStartLine(null);
    setStartLineCenter(null);
  }, []);

  // Save course
  const handleSave = async () => {
    if (!startLineCenter || !startLine || marks.length === 0) {
      showAlert('Error', 'Please position the course before saving.');
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        showAlert('Error', 'You must be logged in to save.');
        return;
      }

      const hasManualAdjustments = marks.some((m) => m.isUserAdjusted);

      const courseData = {
        regatta_id: regattaId,
        source_document_id: sourceDocumentId || null,
        user_id: user.id,
        course_type: courseType,
        wind_direction: windDirection,
        leg_length_nm: legLengthNm,
        start_pin_lat: startLine.pin.lat,
        start_pin_lng: startLine.pin.lng,
        start_committee_lat: startLine.committee.lat,
        start_committee_lng: startLine.committee.lng,
        marks: marks,
        has_manual_adjustments: hasManualAdjustments,
      };

      const { data, error } = await supabase
        .from('race_positioned_courses')
        .insert(courseData)
        .select()
        .single();

      if (error) throw error;

      const positionedCourse: PositionedCourse = {
        id: data.id,
        regattaId,
        sourceDocumentId,
        userId: user.id,
        courseType,
        marks,
        startLine,
        windDirection,
        legLengthNm,
        hasManualAdjustments,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      onSave(positionedCourse);
    } catch (error: any) {
      logger.error('Failed to save positioned course:', error);
      showAlert('Error', error.message || 'Failed to save course position.');
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      showConfirm(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        onCancel,
        { destructive: true },
      );
    } else {
      onCancel();
    }
  }, [hasChanges, onCancel]);

  // Get wind direction label
  const getWindLabel = (degrees: number): string => {
    const index = Math.round(degrees / 45) % 8;
    return WIND_PRESETS[index].label;
  };

  // Get mark label
  const getMarkLabel = (mark: PositionedMark, index: number): string => {
    if (mark.type === 'windward') return 'W';
    if (mark.type === 'leeward') return 'L';
    if (mark.type === 'gate') return 'G';
    if (mark.type === 'wing') return 'R';
    if (mark.type === 'offset') return 'O';
    return (index + 1).toString();
  };

  // Start-line GeoJSON LineString (pin → committee)
  const startLineFeature = useMemo(() => {
    if (!startLine) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [startLine.pin.lng, startLine.pin.lat],
          [startLine.committee.lng, startLine.committee.lat],
        ] as [number, number][],
      },
    };
  }, [startLine]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={styles.closeButton}>
            <X size={24} color={IOS_COLORS.label} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Position Course</Text>
            <Text style={styles.headerSubtitle}>
              {isPlacingStartLine ? 'Tap to place start line' : 'Drag marks to adjust'}
            </Text>
          </View>
          <Pressable
            onPress={handleSave}
            disabled={saving || !startLineCenter || marks.length === 0}
            style={[
              styles.saveButton,
              (saving || !startLineCenter || marks.length === 0) && styles.saveButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Save size={20} color={!startLineCenter || marks.length === 0 ? IOS_COLORS.gray : '#fff'} />
            )}
          </Pressable>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <MLMap mapStyle={MAP_STYLE_URL} style={styles.map} onPress={handleMapPress}>
            <MLCamera
              ref={cameraRef}
              initialViewState={{ center: initialView.center, zoom: initialView.zoom }}
            />

            {/* Start Line */}
            {startLineFeature ? (
              <MLGeoJSONSource id="cpe-start-line" data={startLineFeature}>
                <MLLayer
                  id="cpe-start-line-layer"
                  type="line"
                  source="cpe-start-line"
                  style={{ lineColor: '#22c55e', lineWidth: 4 }}
                />
              </MLGeoJSONSource>
            ) : null}

            {/* Course Marks (drag not supported on MapLibre RN) */}
            {marks.map((mark, index) => (
              <MLMarker
                key={mark.id}
                id={`cpe-mark-${mark.id}`}
                lngLat={[mark.longitude, mark.latitude]}
              >
                <View style={styles.markContainer}>
                  <View
                    style={[
                      styles.markCircle,
                      { backgroundColor: MARK_COLORS[mark.type] || '#64748b' },
                      mark.isUserAdjusted && styles.markCircleEdited,
                    ]}
                  >
                    <Text style={styles.markLabel}>{getMarkLabel(mark, index)}</Text>
                  </View>
                </View>
              </MLMarker>
            ))}

            {/* Start Line Endpoints */}
            {startLine ? (
              <>
                <MLMarker
                  id="cpe-start-pin"
                  lngLat={[startLine.pin.lng, startLine.pin.lat]}
                >
                  <View style={[styles.startLineEndpoint, { backgroundColor: '#f97316' }]}>
                    <Text style={styles.startLineLabel}>P</Text>
                  </View>
                </MLMarker>
                <MLMarker
                  id="cpe-start-committee"
                  lngLat={[startLine.committee.lng, startLine.committee.lat]}
                >
                  <View style={[styles.startLineEndpoint, { backgroundColor: '#3b82f6' }]}>
                    <Text style={styles.startLineLabel}>C</Text>
                  </View>
                </MLMarker>
              </>
            ) : null}
          </MLMap>

          {/* Placement Instructions */}
          {isPlacingStartLine && (
            <View style={styles.instructionOverlay}>
              <Target size={20} color="#f97316" />
              <Text style={styles.instructionText}>Tap on map to place start line center</Text>
            </View>
          )}

          {/* Course Info Badge */}
          {startLineCenter && !isPlacingStartLine && (
            <View style={styles.courseInfoBadge}>
              <View style={styles.courseInfoItem}>
                <Wind size={14} color="#6366f1" />
                <Text style={styles.courseInfoText}>{windDirection}°</Text>
              </View>
              <View style={styles.courseInfoItem}>
                <Anchor size={14} color="#22c55e" />
                <Text style={styles.courseInfoText}>{legLengthNm}nm</Text>
              </View>
              <View style={styles.courseInfoItem}>
                <Flag size={14} color="#f97316" />
                <Text style={styles.courseInfoText}>{marks.length} marks</Text>
              </View>
            </View>
          )}

          {/* Toggle Controls Button */}
          <Pressable
            style={styles.toggleControlsButton}
            onPress={() => setShowControls(!showControls)}
          >
            {showControls ? <ChevronDown size={24} color="#64748b" /> : <ChevronUp size={24} color="#64748b" />}
          </Pressable>
        </View>

        {/* Controls Panel */}
        {showControls && (
          <View style={[styles.controlsPanel, { paddingBottom: insets.bottom + 8 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Course Type */}
              <View style={styles.controlSection}>
                <Text style={styles.controlLabel}>COURSE TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.optionRow}>
                    {Object.values(COURSE_TEMPLATES)
                      .filter((t) => t.type !== 'custom')
                      .map((template) => {
                        const isSelected = courseType === template.type;
                        return (
                          <Pressable
                            key={template.type}
                            onPress={() => handleCourseTypeChange(template.type)}
                            style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                          >
                            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                              {template.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>
                </ScrollView>
              </View>

              {/* Wind Direction */}
              <View style={styles.controlSection}>
                <View style={styles.controlHeader}>
                  <View style={styles.controlLabelRow}>
                    <Wind size={14} color="#6366f1" />
                    <Text style={styles.controlLabel}>WIND DIRECTION</Text>
                  </View>
                  <Text style={styles.controlValue}>
                    {windDirection}° ({getWindLabel(windDirection)})
                  </Text>
                </View>
                <View style={styles.optionRow}>
                  {WIND_PRESETS.map((preset) => {
                    const isSelected = Math.abs(windDirection - preset.degrees) < 23;
                    return (
                      <Pressable
                        key={preset.label}
                        onPress={() => handleWindDirectionChange(preset.degrees)}
                        style={[styles.compassButton, isSelected && styles.compassButtonSelected]}
                      >
                        <Text style={[styles.compassText, isSelected && styles.compassTextSelected]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.adjustRow}>
                  <Pressable
                    onPress={() => handleWindDirectionChange((windDirection - 10 + 360) % 360)}
                    style={styles.adjustButton}
                  >
                    <RotateCcw size={16} color="#64748b" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleWindDirectionChange((windDirection - 1 + 360) % 360)}
                    style={styles.adjustButton}
                  >
                    <Minus size={16} color="#64748b" />
                  </Pressable>
                  <View style={styles.adjustSpacer} />
                  <Pressable
                    onPress={() => handleWindDirectionChange((windDirection + 1) % 360)}
                    style={styles.adjustButton}
                  >
                    <Plus size={16} color="#64748b" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleWindDirectionChange((windDirection + 10) % 360)}
                    style={styles.adjustButton}
                  >
                    <ChevronUp size={16} color="#64748b" />
                  </Pressable>
                </View>
              </View>

              {/* Leg Length */}
              <View style={styles.controlSection}>
                <View style={styles.controlHeader}>
                  <View style={styles.controlLabelRow}>
                    <Anchor size={14} color="#22c55e" />
                    <Text style={styles.controlLabel}>LEG LENGTH</Text>
                  </View>
                  <Text style={[styles.controlValue, { color: '#22c55e' }]}>{legLengthNm} nm</Text>
                </View>
                <View style={styles.optionRow}>
                  {LEG_LENGTH_OPTIONS.map((length) => {
                    const isSelected = Math.abs(legLengthNm - length) < 0.05;
                    return (
                      <Pressable
                        key={length}
                        onPress={() => handleLegLengthChange(length)}
                        style={[styles.lengthButton, isSelected && styles.lengthButtonSelected]}
                      >
                        <Text style={[styles.lengthText, isSelected && styles.lengthTextSelected]}>
                          {length}nm
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {startLineCenter && (
                  <Pressable onPress={handleReplaceStartLine} style={styles.actionButton}>
                    <Target size={16} color="#f97316" />
                    <Text style={styles.actionButtonText}>Re-place Start</Text>
                  </Pressable>
                )}
                <Pressable onPress={handleReset} style={styles.actionButton}>
                  <RotateCcw size={16} color="#64748b" />
                  <Text style={styles.actionButtonText}>Reset</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerSubtitle: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  headerRight: {
    width: 44,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: IOS_COLORS.gray5,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  instructionOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#c2410c',
  },
  courseInfoBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  courseInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  courseInfoText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  toggleControlsButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  markContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markCircleEdited: {
    borderColor: '#f97316',
  },
  markLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  startLineEndpoint: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  startLineLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  controlsPanel: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.gray5,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  controlSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  controlValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
  },
  optionButtonSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  optionTextSelected: {
    color: '#1d4ed8',
  },
  compassButton: {
    width: 36,
    height: 32,
    borderRadius: 6,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassButtonSelected: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  compassText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  compassTextSelected: {
    color: '#4338ca',
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  adjustButton: {
    width: 40,
    height: 36,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustSpacer: {
    flex: 1,
  },
  lengthButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
  },
  lengthButtonSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  lengthText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  lengthTextSelected: {
    color: '#15803d',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: 16,
  },
  fallbackText: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  fallbackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderRadius: 10,
  },
  fallbackActions: {
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  fallbackButtonSecondary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.gray3,
  },
  fallbackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
});

export default CoursePositionEditor;
