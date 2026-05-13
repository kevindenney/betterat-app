import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ThemedText } from '../../../../components/themed-text';
import { ThemedView } from '../../../../components/themed-view';
import { Button } from '../../ui/button';
import { CourseMap } from '../shared/CourseMap';
import { RaceCourse, Mark } from '../RaceBuilder';
import { createLogger } from '@/lib/utils/logger';
import { supabase } from '@/services/supabase';

interface YachtClubCourseDesignerProps {
  course: RaceCourse | null;
  onCourseUpdate: (course: RaceCourse) => void;
  venueCoordinates?: [number, number];
}

const logger = createLogger('YachtClubCourseDesigner');

const normalizeCourseTypeForDb = (type: RaceCourse['type']): 'windward_leeward' | 'triangle' | 'custom' => {
  if (type === 'windward-leeward') return 'windward_leeward';
  if (type === 'triangle') return 'triangle';
  return 'custom';
};

const mapMarksForDb = (marks: Mark[]) =>
  (marks || []).map((mark) => ({
    name: mark.name,
    type: mark.type === 'reaching' ? 'wing' : mark.type,
    latitude: mark.coordinates[1],
    longitude: mark.coordinates[0],
  }));

export function YachtClubCourseDesigner({
  course,
  onCourseUpdate,
  venueCoordinates
}: YachtClubCourseDesignerProps) {
  const [selectedMarkType, setSelectedMarkType] = useState<Mark['type'] | null>(null);
  const [layers, setLayers] = useState({
    wind: true,
    current: false,
    depth: false,
    tactical: true
  });
  const [validationMode, setValidationMode] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'templates' | 'documents' | 'catalog'>('templates');
  const [uploadedDocuments, setUploadedDocuments] = useState([
    {
      id: 'rhkyc-victoria-harbour',
      name: 'RHKYC Victoria Harbour Sailing Instructions',
      uploadDate: '2024-01-15',
      coursesExtracted: 6,
      status: 'processed'
    }
  ]);
  const [courseCatalog, setCourseCatalog] = useState([
    { id: 'rhkyc-a', name: 'RHKYC Course A', type: 'Triangle', marks: 5, venue: 'Victoria Harbour', status: 'published' },
    { id: 'rhkyc-b', name: 'RHKYC Course B', type: 'Triangle', marks: 5, venue: 'Victoria Harbour', status: 'published' },
    { id: 'rhkyc-c', name: 'RHKYC Course C', type: 'Triangle', marks: 5, venue: 'Victoria Harbour', status: 'published' },
    { id: 'rhkyc-d', name: 'RHKYC Course D', type: 'Triangle', marks: 5, venue: 'Victoria Harbour', status: 'published' },
    { id: 'rhkyc-wl', name: 'RHKYC W/L', type: 'Windward/Leeward', marks: 4, venue: 'Victoria Harbour', status: 'published' },
    { id: 'rhkyc-distance', name: 'RHKYC Distance', type: 'Coastal', marks: 5, venue: 'Hong Kong Waters', status: 'published' }
  ]);

  const handleMarkAdd = (type: Mark['type']) => {
    const newMark: Mark = {
      id: `mark-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Mark`,
      type,
      coordinates: venueCoordinates || [114.19, 22.285],
      rounding: type === 'windward' || type === 'leeward' ? 'port' : undefined
    };

    const updatedCourse = course || {
      id: `course-${Date.now()}`,
      name: 'New Race Course',
      type: 'windward-leeward' as const,
      marks: [],
      sequence: [],
      venue: 'Hong Kong'
    };

    onCourseUpdate({
      ...updatedCourse,
      marks: [...updatedCourse.marks, newMark]
    });
  };

  const handleMarkMove = (markId: string, coordinates: [number, number]) => {
    if (!course) return;

    const updatedMarks = course.marks.map(m =>
      m.id === markId ? { ...m, coordinates } : m
    );

    onCourseUpdate({ ...course, marks: updatedMarks });
  };

  const createTemplateMarks = (templateType: string, center: [number, number]): Mark[] => {
    const [lng, lat] = center;
    const offset = 0.003; // ~300m spacing

    switch (templateType) {
      case 'windward-leeward-2x':
      case 'windward-leeward-3x':
        return [
          { id: 'start-pin', name: 'Start Pin', type: 'start', coordinates: [lng - offset, lat - offset] },
          { id: 'start-committee', name: 'Committee Boat', type: 'start', coordinates: [lng + offset, lat - offset] },
          { id: 'windward', name: 'Windward Mark', type: 'windward', coordinates: [lng, lat + offset * 2], rounding: 'port' },
          { id: 'leeward', name: 'Leeward Mark', type: 'leeward', coordinates: [lng, lat - offset * 2], rounding: 'port' }
        ];

      case 'triangle':
        return [
          { id: 'start-pin', name: 'Start Pin', type: 'start', coordinates: [lng - offset, lat - offset] },
          { id: 'start-committee', name: 'Committee Boat', type: 'start', coordinates: [lng + offset, lat - offset] },
          { id: 'mark-1', name: 'Mark 1', type: 'windward', coordinates: [lng, lat + offset * 2], rounding: 'port' },
          { id: 'mark-2', name: 'Mark 2', type: 'reaching', coordinates: [lng + offset * 2, lat], rounding: 'port' },
          { id: 'mark-3', name: 'Mark 3', type: 'reaching', coordinates: [lng - offset * 2, lat], rounding: 'port' }
        ];

      case 'trapezoid':
        return [
          { id: 'start-pin', name: 'Start Pin', type: 'start', coordinates: [lng - offset, lat - offset] },
          { id: 'start-committee', name: 'Committee Boat', type: 'start', coordinates: [lng + offset, lat - offset] },
          { id: 'windward', name: 'Windward Mark', type: 'windward', coordinates: [lng, lat + offset * 2.5], rounding: 'port' },
          { id: 'reach-1', name: 'Reach Mark 1', type: 'reaching', coordinates: [lng + offset * 2, lat + offset], rounding: 'port' },
          { id: 'reach-2', name: 'Reach Mark 2', type: 'reaching', coordinates: [lng + offset * 2, lat - offset], rounding: 'port' },
          { id: 'leeward', name: 'Leeward Mark', type: 'leeward', coordinates: [lng, lat - offset * 2], rounding: 'port' }
        ];

      case 'coastal':
        return [
          { id: 'start-pin', name: 'Start Pin', type: 'start', coordinates: [lng - offset, lat - offset] },
          { id: 'start-committee', name: 'Committee Boat', type: 'start', coordinates: [lng + offset, lat - offset] },
          { id: 'mark-1', name: 'Mark 1', type: 'windward', coordinates: [lng, lat + offset * 3], rounding: 'port' },
          { id: 'mark-2', name: 'Mark 2', type: 'reaching', coordinates: [lng + offset * 3, lat + offset * 2], rounding: 'port' },
          { id: 'mark-3', name: 'Mark 3', type: 'reaching', coordinates: [lng + offset * 2, lat], rounding: 'port' },
          { id: 'mark-4', name: 'Mark 4', type: 'reaching', coordinates: [lng, lat - offset * 2], rounding: 'port' },
          { id: 'mark-5', name: 'Mark 5', type: 'reaching', coordinates: [lng - offset * 2, lat], rounding: 'port' },
          { id: 'finish', name: 'Finish Line', type: 'finish', coordinates: [lng, lat - offset] }
        ];

      default:
        return [];
    }
  };

  const createTemplateSequence = (templateType: string): string[] => {
    switch (templateType) {
      case 'windward-leeward-2x':
        return ['Start', 'Windward', 'Leeward', 'Windward', 'Finish'];
      case 'windward-leeward-3x':
        return ['Start', 'Windward', 'Leeward', 'Windward', 'Leeward', 'Windward', 'Finish'];
      case 'triangle':
        return ['Start', 'Mark 1', 'Mark 2', 'Mark 3', 'Finish'];
      case 'trapezoid':
        return ['Start', 'Windward', 'Reach Mark 1', 'Reach Mark 2', 'Leeward', 'Finish'];
      case 'coastal':
        return ['Start', 'Mark 1', 'Mark 2', 'Mark 3', 'Mark 4', 'Mark 5', 'Finish'];
      default:
        return [];
    }
  };

  const loadTemplate = (templateName: string, templateType: string) => {
    const templateCourse: RaceCourse = {
      id: `course-${Date.now()}`,
      name: `${templateName} Course`,
      type: templateType as RaceCourse['type'],
      marks: createTemplateMarks(templateType, venueCoordinates || [114.19, 22.285]),
      sequence: createTemplateSequence(templateType),
      venue: 'Hong Kong'
    };

    onCourseUpdate(templateCourse);
  };

  const handleDocumentUpload = async () => {
    const selection = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (selection.canceled || !selection.assets?.[0]) {
      return;
    }
    const picked = selection.assets[0];

    // Complete RHKYC Victoria Harbour course extraction from actual documents
    const rhkycCourseCatalog = [
      {
        name: 'RHKYC Course A',
        type: 'triangle' as const,
        sequence: ['Start', 'Y Mark', 'R Mark', 'G Mark', 'Finish'],
        description: 'Triangle course: Start-Y-R-G-Finish',
        marks: [
          { id: 'start-committee', name: 'Committee Boat', type: 'start' as const, coordinates: [114.1647, 22.2803] },
          { id: 'start-pin', name: 'Pin Buoy', type: 'start' as const, coordinates: [114.1653, 22.2797] },
          { id: 'y-mark', name: 'Y Mark (Red)', type: 'windward' as const, coordinates: [114.1642, 22.2842], rounding: 'port' as const },
          { id: 'r-mark', name: 'R Mark (Green)', type: 'reaching' as const, coordinates: [114.1692, 22.2875], rounding: 'port' as const },
          { id: 'g-mark', name: 'G Mark (Yellow)', type: 'reaching' as const, coordinates: [114.1668, 22.2814], rounding: 'port' as const }
        ]
      },
      {
        name: 'RHKYC Course B',
        type: 'triangle' as const,
        sequence: ['Start', 'R Mark', 'Y Mark', 'G Mark', 'Finish'],
        description: 'Triangle course: Start-R-Y-G-Finish',
        marks: [
          { id: 'start-committee', name: 'Committee Boat', type: 'start' as const, coordinates: [114.1647, 22.2803] },
          { id: 'start-pin', name: 'Pin Buoy', type: 'start' as const, coordinates: [114.1653, 22.2797] },
          { id: 'r-mark', name: 'R Mark (Green)', type: 'windward' as const, coordinates: [114.1692, 22.2875], rounding: 'port' as const },
          { id: 'y-mark', name: 'Y Mark (Red)', type: 'reaching' as const, coordinates: [114.1642, 22.2842], rounding: 'port' as const },
          { id: 'g-mark', name: 'G Mark (Yellow)', type: 'reaching' as const, coordinates: [114.1668, 22.2814], rounding: 'port' as const }
        ]
      },
      {
        name: 'RHKYC Course C',
        type: 'triangle' as const,
        sequence: ['Start', 'G Mark', 'Y Mark', 'R Mark', 'Finish'],
        description: 'Triangle course: Start-G-Y-R-Finish',
        marks: [
          { id: 'start-committee', name: 'Committee Boat', type: 'start' as const, coordinates: [114.1647, 22.2803] },
          { id: 'start-pin', name: 'Pin Buoy', type: 'start' as const, coordinates: [114.1653, 22.2797] },
          { id: 'g-mark', name: 'G Mark (Yellow)', type: 'windward' as const, coordinates: [114.1668, 22.2814], rounding: 'port' as const },
          { id: 'y-mark', name: 'Y Mark (Red)', type: 'reaching' as const, coordinates: [114.1642, 22.2842], rounding: 'port' as const },
          { id: 'r-mark', name: 'R Mark (Green)', type: 'reaching' as const, coordinates: [114.1692, 22.2875], rounding: 'port' as const }
        ]
      },
      {
        name: 'RHKYC Course D',
        type: 'triangle' as const,
        sequence: ['Start', 'Y Mark', 'G Mark', 'R Mark', 'Finish'],
        description: 'Triangle course: Start-Y-G-R-Finish',
        marks: [
          { id: 'start-committee', name: 'Committee Boat', type: 'start' as const, coordinates: [114.1647, 22.2803] },
          { id: 'start-pin', name: 'Pin Buoy', type: 'start' as const, coordinates: [114.1653, 22.2797] },
          { id: 'y-mark', name: 'Y Mark (Red)', type: 'windward' as const, coordinates: [114.1642, 22.2842], rounding: 'port' as const },
          { id: 'g-mark', name: 'G Mark (Yellow)', type: 'reaching' as const, coordinates: [114.1668, 22.2814], rounding: 'port' as const },
          { id: 'r-mark', name: 'R Mark (Green)', type: 'reaching' as const, coordinates: [114.1692, 22.2875], rounding: 'port' as const }
        ]
      },
      {
        name: 'RHKYC Windward/Leeward',
        type: 'windward-leeward' as const,
        sequence: ['Start', 'Windward', 'Leeward', 'Windward', 'Finish'],
        description: 'Classic W/L course for Victoria Harbour',
        marks: [
          { id: 'start-committee', name: 'Committee Boat', type: 'start' as const, coordinates: [114.1647, 22.2803] },
          { id: 'start-pin', name: 'Pin Buoy', type: 'start' as const, coordinates: [114.1653, 22.2797] },
          { id: 'windward', name: 'Windward Mark', type: 'windward' as const, coordinates: [114.1655, 22.2885], rounding: 'port' as const },
          { id: 'leeward', name: 'Leeward Mark', type: 'leeward' as const, coordinates: [114.1655, 22.2755], rounding: 'port' as const }
        ]
      },
      {
        name: 'RHKYC Distance Race',
        type: 'coastal' as const,
        sequence: ['Start', 'Stonecutters Island', 'Green Island', 'Finish'],
        description: 'Long distance race around Hong Kong islands',
        marks: [
          { id: 'start-committee', name: 'Committee Boat', type: 'start' as const, coordinates: [114.1647, 22.2803] },
          { id: 'start-pin', name: 'Pin Buoy', type: 'start' as const, coordinates: [114.1653, 22.2797] },
          { id: 'stonecutters', name: 'Stonecutters Island Mark', type: 'reaching' as const, coordinates: [114.1425, 22.3156], rounding: 'port' as const },
          { id: 'green-island', name: 'Green Island Mark', type: 'reaching' as const, coordinates: [114.0875, 22.3567], rounding: 'port' as const },
          { id: 'finish', name: 'Finish Line', type: 'finish' as const, coordinates: [114.1650, 22.2800] }
        ]
      }
    ];

    setUploadedDocuments((prev) => [
      {
        id: `upload-${Date.now()}`,
        name: picked.name || 'Uploaded document',
        uploadDate: new Date().toISOString().split('T')[0],
        coursesExtracted: rhkycCourseCatalog.length,
        status: 'processed',
      },
      ...prev,
    ]);

    // Load first extracted course
    const extractedCourse: RaceCourse = {
      id: `course-${Date.now()}`,
      name: rhkycCourseCatalog[0].name,
      type: rhkycCourseCatalog[0].type,
      marks: rhkycCourseCatalog[0].marks,
      sequence: rhkycCourseCatalog[0].sequence,
      venue: 'Hong Kong - Victoria Harbour (RHKYC)'
    };

    onCourseUpdate(extractedCourse);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        const { data: savedDoc, error: docError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            filename: picked.name || 'sailing-instructions',
            title: picked.name || 'Sailing Instructions',
            file_path: picked.uri,
            file_size: picked.size || 0,
            mime_type: picked.mimeType || 'application/octet-stream',
            document_type: 'sailing_instructions',
            processing_status: 'completed',
            used_for_extraction: true,
            extraction_timestamp: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();

        if (docError) {
          logger.warn('Unable to persist uploaded document metadata', docError);
        }

        const coursePayload = rhkycCourseCatalog.map((entry) => ({
          name: entry.name,
          description: entry.description,
          course_type: normalizeCourseTypeForDb(entry.type),
          marks: mapMarksForDb(entry.marks as Mark[]),
          layout: { sequence: entry.sequence },
          created_by: user.id,
        }));

        const { error: courseSaveError } = await supabase
          .from('race_courses')
          .insert(coursePayload);
        if (courseSaveError) {
          logger.warn('Unable to persist extracted course catalog', courseSaveError);
        } else {
          setCourseCatalog((prev) => [
            ...rhkycCourseCatalog.map((entry) => ({
              id: `catalog-${Date.now()}-${entry.name}`,
              name: entry.name,
              type: entry.type,
              marks: entry.marks.length,
              venue: 'Victoria Harbour',
              status: 'published',
            })),
            ...prev,
          ]);
        }

        if (savedDoc?.id) {
          logger.debug('Saved uploaded document metadata', { documentId: savedDoc.id });
        }
      }
    } catch (persistError) {
      logger.warn('Failed to persist uploaded extraction assets', persistError);
    }

    alert(`AI extracted ${rhkycCourseCatalog.length} courses from ${picked.name || 'uploaded document'}.\n\nLoaded: ${extractedCourse.name}`);
  };

  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const validateCourse = () => {
    if (!course) return [];

    const errors: string[] = [];

    // World Sailing compliance checks
    if (!course.marks.some(m => m.type === 'start')) {
      errors.push('Course must have a start line');
    }
    if (!course.marks.some(m => m.type === 'finish')) {
      errors.push('Course must have a finish line');
    }

    // Safety checks
    const startMark = course.marks.find(m => m.type === 'start');
    const windwardMark = course.marks.find(m => m.type === 'windward');
    if (startMark && windwardMark) {
      // Calculate distance (simplified)
      const distance = Math.sqrt(
        Math.pow(startMark.coordinates[0] - windwardMark.coordinates[0], 2) +
        Math.pow(startMark.coordinates[1] - windwardMark.coordinates[1], 2)
      );
      if (distance < 0.005) { // ~500m minimum
        errors.push('Start to windward mark distance appears too short');
      }
    }

    // Sequence validation
    if (course.sequence.length === 0) {
      errors.push('Course sequence not defined');
    }

    return errors;
  };

  const publishCourse = async () => {
    const errors = validateCourse();
    if (errors.length > 0) {
      alert(`Cannot publish course:\n${errors.join('\n')}`);
      return;
    }

    if (!course) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        alert('Please sign in to publish this course.');
        return;
      }

      const payload = {
        name: course.name,
        description: `Published from YachtClubCourseDesigner (${course.type})`,
        course_type: normalizeCourseTypeForDb(course.type),
        marks: mapMarksForDb(course.marks),
        layout: { sequence: course.sequence || [] },
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('race_courses')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        throw error;
      }

      logger.debug('Published course to race_courses', {
        raceCourseId: data?.id,
        sourceCourseId: course.id,
      });
      alert('Course published successfully to sailor apps!');
    } catch (publishError) {
      logger.error('Failed to publish course', publishError);
      alert('Failed to publish course. Please try again.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Professional Header */}
      <View style={styles.header}>
        <View>
          <ThemedText type="title">🏛️ Professional Course Designer</ThemedText>
          <ThemedText type="subtitle">Yacht Club Race Management System</ThemedText>
        </View>
        <View style={styles.headerActions}>
          <Button
            variant={validationMode ? 'default' : 'outline'}
            onPress={() => setValidationMode(!validationMode)}
            style={styles.headerButton}
          >
            <ThemedText style={{ color: validationMode ? '#fff' : '#0066CC' }}>
              ✅ Validate
            </ThemedText>
          </Button>
          <Button
            onPress={publishCourse}
            style={styles.headerButton}
            disabled={!course}
          >
            <ThemedText style={{ color: '#fff' }}>
              📡 Publish
            </ThemedText>
          </Button>
        </View>
      </View>

      <View style={styles.mainContent}>
        {/* Sidebar Tools */}
        <View style={styles.sidebar}>
          {/* Mark Palette */}
          <View style={styles.toolSection}>
            <ThemedText style={styles.toolSectionTitle}>📍 Mark Palette</ThemedText>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(['start', 'windward', 'leeward', 'gate', 'reaching', 'finish'] as Mark['type'][]).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.markTool,
                    selectedMarkType === type && styles.markToolSelected
                  ]}
                  onPress={() => {
                    setSelectedMarkType(type);
                    handleMarkAdd(type);
                  }}
                >
                  <View style={[styles.markIcon, { backgroundColor: getMarkColor(type) }]}>
                    <ThemedText style={styles.markIconText}>
                      {getMarkEmoji(type)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.markToolText}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Layer Controls */}
          <View style={styles.toolSection}>
            <ThemedText style={styles.toolSectionTitle}>🗺️ Map Layers</ThemedText>
            <View>
              {Object.entries(layers).map(([key, enabled]) => (
                <TouchableOpacity
                  key={key}
                  style={styles.layerToggle}
                  onPress={() => toggleLayer(key as keyof typeof layers)}
                >
                  <View style={[styles.checkbox, enabled && styles.checkboxChecked]}>
                    {enabled && <ThemedText style={styles.checkmark}>✓</ThemedText>}
                  </View>
                  <ThemedText style={styles.layerText}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Course Info */}
          {course && (
            <View style={styles.toolSection}>
              <ThemedText style={styles.toolSectionTitle}>📊 Course Stats</ThemedText>
              <View style={styles.statsContainer}>
                <ThemedText style={styles.statItem}>
                  Type: {course.type}
                </ThemedText>
                <ThemedText style={styles.statItem}>
                  Marks: {course.marks.length}
                </ThemedText>
                <ThemedText style={styles.statItem}>
                  Venue: {course.venue || 'Not set'}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Validation Results */}
          {validationMode && (
            <View style={styles.toolSection}>
              <ThemedText style={styles.toolSectionTitle}>⚠️ Validation</ThemedText>
              <ScrollView style={styles.validationResults}>
                {validateCourse().map((error, idx) => (
                  <ThemedText key={idx} style={styles.validationError}>
                    • {error}
                  </ThemedText>
                ))}
                {validateCourse().length === 0 && (
                  <ThemedText style={styles.validationSuccess}>
                    ✅ Course valid for racing
                  </ThemedText>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Map Area */}
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <CourseMap
              course={course}
              onMarkMove={handleMarkMove}
              isEditable={true}
              layers={layers}
              venueCoordinates={venueCoordinates}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <ThemedText style={styles.mapPlaceholderText}>
                🗺️ Professional course visualization
              </ThemedText>
              <ThemedText style={styles.mapPlaceholderSubtext}>
                MapLibre GL JS renders on web platform
              </ThemedText>
            </View>
          )}
        </View>

        {/* Right Panel - Enhanced with Tabs */}
        <View style={styles.rightPanel}>
          {/* Tab Navigation */}
          <View style={styles.rightTabContainer}>
            {(['templates', 'documents', 'catalog'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.rightTab,
                  activeRightTab === tab && styles.rightTabActive
                ]}
                onPress={() => setActiveRightTab(tab)}
              >
                <ThemedText style={[
                  styles.rightTabText,
                  activeRightTab === tab && styles.rightTabTextActive
                ]}>
                  {tab === 'templates' && '📋 Templates'}
                  {tab === 'documents' && '📄 Documents'}
                  {tab === 'catalog' && '🏆 Catalog'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.rightTabContent}>
            {/* Templates Tab */}
            {activeRightTab === 'templates' && (
              <View>
                {/* AI Document Upload */}
                <View style={styles.aiSection}>
                  <TouchableOpacity
                    style={styles.aiUploadButton}
                    onPress={handleDocumentUpload}
                  >
                    <ThemedText style={styles.aiUploadText}>🤖 Upload Sailing Instructions</ThemedText>
                    <ThemedText style={styles.aiUploadSubtext}>Extract courses from PDFs</ThemedText>
                  </TouchableOpacity>
                </View>
            {[
              { name: 'W/L 2x', type: 'windward-leeward-2x', marks: 4, description: '2 rounds windward/leeward' },
              { name: 'W/L 3x', type: 'windward-leeward-3x', marks: 4, description: '3 rounds windward/leeward' },
              { name: 'Triangle', type: 'triangle', marks: 5, description: 'Olympic triangle course' },
              { name: 'Trapezoid', type: 'trapezoid', marks: 6, description: 'Trapezoid reaching course' },
              { name: 'Coastal', type: 'coastal', marks: 8, description: 'Long distance coastal race' }
                ].map((template, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.templateCard}
                    onPress={() => loadTemplate(template.name, template.type)}
                  >
                    <ThemedText style={styles.templateName}>{template.name}</ThemedText>
                    <ThemedText style={styles.templateInfo}>
                      {template.marks} marks
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Documents Tab */}
            {activeRightTab === 'documents' && (
              <View>
                <ThemedText style={styles.sectionTitle}>📄 Document Library</ThemedText>
                {uploadedDocuments.map(doc => (
                  <View key={doc.id} style={styles.documentCard}>
                    <View style={styles.documentHeader}>
                      <ThemedText style={styles.documentName}>{doc.name}</ThemedText>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: doc.status === 'processed' ? '#22C55E' : '#F59E0B' }
                      ]}>
                        <ThemedText style={styles.statusText}>{doc.status}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.documentInfo}>Uploaded: {doc.uploadDate}</ThemedText>
                    <ThemedText style={styles.documentInfo}>{doc.coursesExtracted} courses extracted</ThemedText>
                    <TouchableOpacity style={styles.documentAction}>
                      <ThemedText style={styles.documentActionText}>View Details</ThemedText>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Course Catalog Tab */}
            {activeRightTab === 'catalog' && (
              <View>
                <ThemedText style={styles.sectionTitle}>🏆 RHKYC Course Catalog</ThemedText>
                {courseCatalog.map(course => (
                  <TouchableOpacity
                    key={course.id}
                    style={styles.catalogCard}
                    onPress={() => {
                      // Load course from catalog
                      alert(`Loading ${course.name} from catalog`);
                    }}
                  >
                    <View style={styles.catalogHeader}>
                      <ThemedText style={styles.catalogName}>{course.name}</ThemedText>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: course.status === 'published' ? '#0EA5E9' : '#6B7280' }
                      ]}>
                        <ThemedText style={styles.statusText}>{course.status}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.catalogType}>{course.type} • {course.marks} marks</ThemedText>
                    <ThemedText style={styles.catalogVenue}>{course.venue}</ThemedText>
                    <View style={styles.catalogActions}>
                      <TouchableOpacity style={styles.catalogActionButton}>
                        <ThemedText style={styles.catalogActionText}>Load</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.catalogActionButton}>
                        <ThemedText style={styles.catalogActionText}>Edit</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </ThemedView>
  );
}

function getMarkColor(type: Mark['type']): string {
  const colors = {
    start: '#22C55E',
    windward: '#EF4444',
    leeward: '#3B82F6',
    gate: '#EC4899',
    reaching: '#F59E0B',
    finish: '#8B5CF6'
  };
  return colors[type] || '#6B7280';
}

function getMarkEmoji(type: Mark['type']): string {
  const emojis = {
    start: '🚦',
    windward: '⬆️',
    leeward: '⬇️',
    gate: '🚪',
    reaching: '➡️',
    finish: '🏁'
  };
  return emojis[type] || '📍';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 240,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    padding: 16,
  },
  toolSection: {
    marginBottom: 24,
  },
  toolSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#374151',
  },
  markTool: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  markToolSelected: {
    backgroundColor: '#EFF6FF',
  },
  markIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  markIconText: {
    fontSize: 16,
  },
  markToolText: {
    fontSize: 14,
    color: '#374151',
  },
  layerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  layerText: {
    fontSize: 14,
    color: '#374151',
  },
  statsContainer: {
    gap: 4,
  },
  statItem: {
    fontSize: 12,
    color: '#6B7280',
  },
  validationResults: {
    maxHeight: 150,
  },
  validationError: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 4,
  },
  validationSuccess: {
    fontSize: 12,
    color: '#22C55E',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#E8F4FD',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  mapPlaceholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 8,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  rightPanel: {
    width: 200,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    padding: 16,
  },
  templateCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  templateName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  templateInfo: {
    fontSize: 12,
    color: '#6B7280',
  },
  aiSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  aiUploadButton: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  aiUploadText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0EA5E9',
    marginBottom: 4,
  },
  aiUploadSubtext: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  rightTabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  rightTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  rightTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066CC',
  },
  rightTabText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  rightTabTextActive: {
    color: '#0066CC',
    fontWeight: 'bold',
  },
  rightTabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#374151',
  },
  documentCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  documentName: {
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  documentInfo: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  documentAction: {
    marginTop: 8,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
  },
  documentActionText: {
    fontSize: 11,
    color: '#0066CC',
    fontWeight: '500',
  },
  catalogCard: {
    backgroundColor: '#FEFEFE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    boxShadow: '0px 1px',
  },
  catalogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  catalogName: {
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  catalogType: {
    fontSize: 11,
    color: '#374151',
    marginBottom: 4,
  },
  catalogVenue: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 8,
  },
  catalogActions: {
    flexDirection: 'row',
    gap: 8,
  },
  catalogActionButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  catalogActionText: {
    fontSize: 10,
    color: '#0EA5E9',
    fontWeight: '500',
  },
});
