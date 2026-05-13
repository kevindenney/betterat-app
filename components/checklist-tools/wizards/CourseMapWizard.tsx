/**
 * CourseMapWizard
 *
 * Wizard for reviewing and studying the race course layout.
 * Shows course marks on a map, displays course details, and
 * allows reviewing/confirming understanding of the course.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Map,
  Navigation,
  Flag,
  Anchor,
  Wind,
  ArrowDown,
  ArrowUp,
  RotateCw,
  BookOpen,
  Check,
  FileText,
  Upload,
  Eye,
  Link2,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Edit3,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { ChecklistToolProps } from '@/lib/checklists/toolRegistry';
import { useRaceDocuments } from '@/hooks/useRaceDocuments';
import { useAuth } from '@/providers/AuthProvider';
import type { CourseMark } from '@/types/raceEvents';
import { courseImageExtractor, type ExtractedCourse } from '@/services/ai/CourseImageExtractor';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('CourseMapWizard');

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  purple: '#5856D6',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  gray: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  background: '#F2F2F7',
  secondaryBackground: '#FFFFFF',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
  separator: '#3C3C4349',
};

// Mark type colors
const MARK_COLORS: Record<string, string> = {
  start: '#22c55e',
  committee_boat: '#22c55e',
  pin: '#22c55e',
  finish: '#ef4444',
  windward: '#3b82f6',
  leeward: '#f59e0b',
  gate: '#8b5cf6',
  gate_left: '#8b5cf6',
  gate_right: '#8b5cf6',
  wing: '#06b6d4',
  offset: '#ec4899',
};

// Course check items
const COURSE_CHECK_ITEMS = [
  {
    id: 'marks',
    label: 'Identify All Marks',
    description: 'Colors, shapes, and positions of each mark',
    icon: <Anchor size={20} color={IOS_COLORS.blue} />,
  },
  {
    id: 'rounding',
    label: 'Rounding Directions',
    description: 'Which side to round each mark (port/starboard)',
    icon: <RotateCw size={20} color={IOS_COLORS.orange} />,
  },
  {
    id: 'start_line',
    label: 'Start Line Setup',
    description: 'Committee boat, pin position, and line bias',
    icon: <Flag size={20} color={IOS_COLORS.green} />,
  },
  {
    id: 'finish',
    label: 'Finish Location',
    description: 'Where and how to finish the race',
    icon: <CheckCircle2 size={20} color={IOS_COLORS.red} />,
  },
  {
    id: 'hazards',
    label: 'Hazards & Restrictions',
    description: 'Restricted areas, shallow water, exclusion zones',
    icon: <AlertTriangle size={20} color={IOS_COLORS.purple} />,
  },
];

type WizardStep = 'overview' | 'map' | 'marks' | 'review' | 'documents';

interface CourseMapWizardProps extends ChecklistToolProps {
  /** Race course data if available */
  course?: {
    marks?: CourseMark[];
    startLine?: { latitude: number; longitude: number }[];
    finishLine?: { latitude: number; longitude: number }[];
    type?: string;
    description?: string;
  } | null;
  /** Venue for context */
  venue?: { id: string; name: string; latitude?: number; longitude?: number } | null;
}

export function CourseMapWizard({
  item,
  regattaId,
  boatId: _boatId,
  onComplete,
  onCancel,
  course,
  venue: _venue,
}: CourseMapWizardProps) {
  const router = useRouter();
  const { user } = useAuth();

  // State
  const [step, setStep] = useState<WizardStep>('overview');
  const [completedChecks, setCompletedChecks] = useState<Set<string>>(new Set());
  const [_selectedMark, setSelectedMark] = useState<CourseMark | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);

  // SI URL input state (separate from course diagram URL)
  const [showSIUrlInput, setShowSIUrlInput] = useState(false);
  const [siUrlValue, setSIUrlValue] = useState('');
  const [isSubmittingSIUrl, setIsSubmittingSIUrl] = useState(false);

  // Image extraction state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedCourse, setExtractedCourse] = useState<ExtractedCourse | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Load documents to check for course diagrams
  const {
    documentsForDisplay,
    loading: _docsLoading,
    upload,
    addFromUrl,
    isExtracting: siIsExtracting,
    extractionResult: siExtractionResult,
    clearExtractionResult: clearSIExtractionResult,
  } = useRaceDocuments({
    raceId: regattaId,
    userId: user?.id,
  });

  // Check if course diagram exists
  const courseDiagram = useMemo(() => {
    return documentsForDisplay.find((doc) => doc.type === 'course_diagram');
  }, [documentsForDisplay]);

  // Check if SI exists (course info often comes from SI)
  const sailingInstructions = useMemo(() => {
    return documentsForDisplay.find((doc) => doc.type === 'sailing_instructions');
  }, [documentsForDisplay]);

  // Has course data
  const hasCourseData = course?.marks && course.marks.length > 0;

  // Progress calculation
  const progress = completedChecks.size / COURSE_CHECK_ITEMS.length;
  const allChecksComplete = completedChecks.size === COURSE_CHECK_ITEMS.length;

  // Toggle a check item
  const toggleCheck = useCallback((checkId: string) => {
    setCompletedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  }, []);

  // Handle learn more - navigate to Tactical Planning module (includes course content)
  const handleLearnMore = useCallback(() => {
    onCancel(); // Close modal first
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/learn' as any,
        params: {
          moduleId: 'module-13-2', // Tactical Planning module
        },
      });
    }, 150);
  }, [router, onCancel]);

  // Handle upload - default to course_diagram type
  const handleUpload = useCallback(async () => {
    await upload('course_diagram');
  }, [upload]);

  // Handle URL submit (for course diagram)
  const handleUrlSubmit = useCallback(async () => {
    if (!urlValue.trim()) return;
    setIsSubmittingUrl(true);
    try {
      const success = await addFromUrl(urlValue.trim(), 'course_diagram');
      if (success) {
        setUrlValue('');
        setShowUrlInput(false);
      }
    } finally {
      setIsSubmittingUrl(false);
    }
  }, [urlValue, addFromUrl]);

  // Handle SI URL submit
  const handleSIUrlSubmit = useCallback(async () => {
    if (!siUrlValue.trim()) return;
    setIsSubmittingSIUrl(true);
    try {
      const success = await addFromUrl(siUrlValue.trim(), 'sailing_instructions');
      if (success) {
        setSIUrlValue('');
        setShowSIUrlInput(false);
      }
    } finally {
      setIsSubmittingSIUrl(false);
    }
  }, [siUrlValue, addFromUrl]);

  // Request camera permission
  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert(
        'Camera Permission Required',
        'Please grant camera access to take course photos.'
      );
      return false;
    }
    return true;
  };

  // Request library permission
  const requestLibraryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(
        'Photo Library Permission Required',
        'Please grant photo library access to select course diagrams.'
      );
      return false;
    }
    return true;
  };

  // Extract course from image
  const extractCourseFromImage = useCallback(async (uri: string) => {
    setIsExtracting(true);
    setExtractionError(null);

    try {
      logger.debug('Extracting course from image', { uri });
      const result = await courseImageExtractor.extractCourseFromImage(uri);

      if (result.success && result.data) {
        logger.debug('Course extraction successful', {
          markCount: result.data.marks.length,
          sequenceLength: result.data.sequence.length,
          confidence: result.data.confidence,
        });
        setExtractedCourse(result.data);
      } else {
        logger.warn('Course extraction failed', { error: result.error });
        setExtractionError(result.error || 'Could not extract course information');
      }
    } catch (error: any) {
      logger.error('Course extraction error', { error });
      setExtractionError(error.message || 'Failed to analyze course image');
    } finally {
      setIsExtracting(false);
    }
  }, []);

  // Handle camera capture
  const handleCameraCapture = useCallback(async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const uri = result.assets[0].uri;
        setImageUri(uri);
        extractCourseFromImage(uri);
      }
    } catch (error) {
      logger.error('Camera error:', { error });
      showAlert('Error', 'Failed to capture photo. Please try again.');
    }
  }, [extractCourseFromImage]);

  // Handle library selection
  const handleLibrarySelect = useCallback(async () => {
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const uri = result.assets[0].uri;
        setImageUri(uri);
        extractCourseFromImage(uri);
      }
    } catch (error) {
      logger.error('Library error:', { error });
      showAlert('Error', 'Failed to select photo. Please try again.');
    }
  }, [extractCourseFromImage]);

  // Handle retry extraction
  const handleRetryExtraction = useCallback(() => {
    if (imageUri) {
      extractCourseFromImage(imageUri);
    }
  }, [imageUri, extractCourseFromImage]);

  // Clear extracted course
  const handleClearExtraction = useCallback(() => {
    setImageUri(null);
    setExtractedCourse(null);
    setExtractionError(null);
  }, []);

  // Get mark color
  const getMarkColor = (type?: string | null): string => {
    if (!type) return IOS_COLORS.gray;
    return MARK_COLORS[type] || IOS_COLORS.gray;
  };

  // Get mark icon
  const getMarkIcon = (type?: string | null) => {
    switch (type) {
      case 'windward':
        return <ArrowUp size={16} color="#FFFFFF" />;
      case 'leeward':
        return <ArrowDown size={16} color="#FFFFFF" />;
      case 'gate_left':
      case 'gate_right':
        return <Navigation size={16} color="#FFFFFF" />;
      case 'start':
      case 'pin':
        return <Flag size={16} color="#FFFFFF" />;
      case 'finish':
        return <CheckCircle2 size={16} color="#FFFFFF" />;
      default:
        return <Anchor size={16} color="#FFFFFF" />;
    }
  };

  // Handle complete
  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Render based on step
  const renderContent = () => {
    switch (step) {
      case 'overview':
        return renderOverview();
      case 'map':
        return renderMapView();
      case 'marks':
        return renderMarks();
      case 'review':
        return renderReview();
      case 'documents':
        return renderDocuments();
      default:
        return null;
    }
  };

  const renderOverview = () => (
    <ScrollView
      style={styles.scrollContent}
      contentContainerStyle={styles.scrollContentInner}
    >
      <View style={styles.overviewHeader}>
        <View style={styles.iconCircle}>
          <Map size={32} color={IOS_COLORS.blue} />
        </View>
        <Text style={styles.overviewTitle}>Course Review</Text>
        <Text style={styles.overviewDescription}>
          Study the race course layout, marks, and key features before race day.
        </Text>
      </View>

      {/* Course Status */}
      <View style={styles.statusSection}>
        {hasCourseData ? (
          <View style={styles.statusCard}>
            <View style={[styles.statusIcon, styles.statusIconSuccess]}>
              <CheckCircle2 size={20} color={IOS_COLORS.green} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>Course Data Available</Text>
              <Text style={styles.statusDescription}>
                {course?.marks?.length || 0} marks • {course?.type || 'Standard course'}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable style={styles.statusCard} onPress={() => setStep('documents')}>
            <View style={[styles.statusIcon, styles.statusIconWarning]}>
              <AlertTriangle size={20} color={IOS_COLORS.orange} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>No Course Data</Text>
              <Text style={styles.statusDescription}>
                Tap to upload Sailing Instructions or Course Diagram
              </Text>
            </View>
            <ChevronRight size={18} color={IOS_COLORS.gray} />
          </Pressable>
        )}

        {/* Document status - tappable indicators */}
        <View style={styles.documentsRow}>
          <Pressable style={styles.docStatus} onPress={() => setStep('documents')}>
            <FileText size={16} color={sailingInstructions ? IOS_COLORS.green : IOS_COLORS.gray} />
            <Text style={[styles.docStatusText, sailingInstructions && styles.docStatusTextActive]}>
              SI {sailingInstructions ? '✓' : 'missing'}
            </Text>
            {!sailingInstructions && <ChevronRight size={14} color={IOS_COLORS.gray} />}
          </Pressable>
          <Pressable style={styles.docStatus} onPress={() => setStep('marks')}>
            <Map size={16} color={courseDiagram ? IOS_COLORS.green : IOS_COLORS.gray} />
            <Text style={[styles.docStatusText, courseDiagram && styles.docStatusTextActive]}>
              Diagram {courseDiagram ? '✓' : 'missing'}
            </Text>
            {!courseDiagram && <ChevronRight size={14} color={IOS_COLORS.gray} />}
          </Pressable>
        </View>
      </View>

      {/* Navigation Options */}
      <View style={styles.optionsList}>
        <Pressable
          style={styles.optionItem}
          onPress={() => setStep('marks')}
        >
          <View style={[styles.optionIcon, { backgroundColor: `${IOS_COLORS.blue}15` }]}>
            <Anchor size={22} color={IOS_COLORS.blue} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>Review Marks</Text>
            <Text style={styles.optionDescription}>
              {hasCourseData
                ? `${course?.marks?.length} marks to review`
                : 'Add course data to see marks'}
            </Text>
          </View>
          <ChevronRight size={20} color={IOS_COLORS.gray} />
        </Pressable>

        <Pressable
          style={styles.optionItem}
          onPress={() => setStep('review')}
        >
          <View style={[styles.optionIcon, { backgroundColor: `${IOS_COLORS.purple}15` }]}>
            <Eye size={22} color={IOS_COLORS.purple} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>Course Checklist</Text>
            <Text style={styles.optionDescription}>
              {completedChecks.size}/{COURSE_CHECK_ITEMS.length} items reviewed
            </Text>
          </View>
          <ChevronRight size={20} color={IOS_COLORS.gray} />
        </Pressable>

        {!hasCourseData && (
          <Pressable
            style={styles.optionItem}
            onPress={handleUpload}
          >
            <View style={[styles.optionIcon, { backgroundColor: `${IOS_COLORS.orange}15` }]}>
              <Upload size={22} color={IOS_COLORS.orange} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Upload Documents</Text>
              <Text style={styles.optionDescription}>
                Add SI or course diagram to extract course data
              </Text>
            </View>
            <ChevronRight size={20} color={IOS_COLORS.gray} />
          </Pressable>
        )}
      </View>

      {/* Quick Tips */}
      {item.quickTips && item.quickTips.length > 0 && (
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Quick Tips</Text>
          {item.quickTips.map((tip, index) => (
            <View key={index} style={styles.tipRow}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderMapView = () => (
    <View style={styles.mapContainer}>
      <Text style={styles.mapPlaceholder}>
        Map preview is unavailable in this mode.
        {'\n\n'}
        Review course marks and sequence in the Marks step.
      </Text>
      <Pressable style={styles.mapFallbackButton} onPress={() => setStep('marks')}>
        <Text style={styles.mapFallbackButtonText}>Go To Marks</Text>
      </Pressable>
    </View>
  );

  const renderMarks = () => (
    <ScrollView
      style={styles.scrollContent}
      contentContainerStyle={styles.scrollContentInner}
    >
      <Text style={styles.sectionTitle}>Course Marks</Text>
      {hasCourseData ? (
        <>
          <Text style={styles.sectionDescription}>
            Tap each mark to review its details and rounding direction.
          </Text>
          <View style={styles.marksGrid}>
            {course?.marks?.map((mark, index) => {
              const color = getMarkColor(mark.type);
              return (
                <Pressable
                  key={mark.id || index}
                  style={styles.markCard}
                  onPress={() => setSelectedMark(mark)}
                >
                  <View style={[styles.markIcon, { backgroundColor: color }]}>
                    {getMarkIcon(mark.type)}
                  </View>
                  <View style={styles.markContent}>
                    <Text style={styles.markName}>
                      {mark.name || `Mark ${mark.sequence || index + 1}`}
                    </Text>
                    <Text style={styles.markType}>
                      {mark.type?.replace('_', ' ') || 'Course mark'}
                    </Text>
                    {mark.rounding && (
                      <View style={styles.roundingBadge}>
                        <RotateCw size={10} color={IOS_COLORS.secondaryLabel} />
                        <Text style={styles.roundingText}>{mark.rounding}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.sequenceBadge, { backgroundColor: `${color}20` }]}>
                    <Text style={[styles.sequenceText, { color }]}>
                      {mark.sequence || index + 1}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          {/* Show extracted course from image if available */}
          {extractedCourse ? (
            <>
              {/* Image preview */}
              {imageUri && (
                <Pressable style={styles.imagePreviewCard} onPress={handleLibrarySelect}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                  <View style={styles.imageOverlay}>
                    <Edit3 size={16} color="#FFFFFF" />
                    <Text style={styles.imageOverlayText}>Change Image</Text>
                  </View>
                </Pressable>
              )}

              {/* Confidence indicator */}
              <View style={styles.confidenceCard}>
                <Sparkles size={18} color={IOS_COLORS.purple} />
                <Text style={styles.confidenceText}>
                  {extractedCourse.confidence >= 80 ? 'High' : extractedCourse.confidence >= 50 ? 'Moderate' : 'Low'} confidence ({extractedCourse.confidence}%)
                </Text>
              </View>

              {/* Extracted marks */}
              <View style={styles.extractedMarksContainer}>
                <Text style={styles.extractedSectionTitle}>Extracted Marks</Text>
                {extractedCourse.marks.map((mark, index) => (
                  <View key={index} style={styles.extractedMarkRow}>
                    <View style={[styles.markTypeBadge, { backgroundColor: `${getMarkColor(mark.type)}20` }]}>
                      <Text style={[styles.markTypeBadgeText, { color: getMarkColor(mark.type) }]}>
                        {mark.type}
                      </Text>
                    </View>
                    <Text style={styles.extractedMarkName}>{mark.name}</Text>
                    {mark.rounding && (
                      <Text style={styles.extractedMarkRounding}>
                        {mark.rounding === 'port' ? '↺' : '↻'} {mark.rounding}
                      </Text>
                    )}
                  </View>
                ))}
              </View>

              {/* Extracted sequence */}
              {extractedCourse.sequence.length > 0 && (
                <View style={styles.extractedSequenceContainer}>
                  <Text style={styles.extractedSectionTitle}>Course Sequence</Text>
                  <View style={styles.sequenceFlow}>
                    {extractedCourse.sequence.map((markName, index) => (
                      <View key={index} style={styles.sequenceFlowItem}>
                        <View style={styles.sequenceFlowNumber}>
                          <Text style={styles.sequenceFlowNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.sequenceFlowName}>{markName}</Text>
                        {index < extractedCourse.sequence.length - 1 && (
                          <ChevronRight size={14} color={IOS_COLORS.gray} style={{ marginHorizontal: 4 }} />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Wind direction */}
              {extractedCourse.windDirection && (
                <View style={styles.windDirectionRow}>
                  <Wind size={16} color={IOS_COLORS.green} />
                  <Text style={styles.windDirectionText}>Wind: {extractedCourse.windDirection}</Text>
                </View>
              )}

              {/* Clear button */}
              <Pressable style={styles.clearButton} onPress={handleClearExtraction}>
                <Text style={styles.clearButtonText}>Clear & Try Again</Text>
              </Pressable>
            </>
          ) : isExtracting ? (
            // Extracting state
            <>
              {imageUri && (
                <Image source={{ uri: imageUri }} style={styles.extractingImage} />
              )}
              <View style={styles.extractingContainer}>
                <ActivityIndicator size="large" color={IOS_COLORS.purple} />
                <Text style={styles.extractingTitle}>Analyzing Course Diagram</Text>
                <Text style={styles.extractingDescription}>
                  Identifying marks, sequence, and rounding directions...
                </Text>
              </View>
            </>
          ) : (
            // Empty state - show upload options
            <>
              <View style={styles.emptyIcon}>
                <Anchor size={40} color={IOS_COLORS.gray} />
              </View>
              <Text style={styles.emptyTitle}>No Course Data</Text>
              <Text style={styles.emptyDescription}>
                Upload a course diagram image or documents to extract course information.
              </Text>

              {/* Extraction error */}
              {extractionError && (
                <View style={styles.extractionErrorCard}>
                  <AlertTriangle size={16} color={IOS_COLORS.red} />
                  <Text style={styles.extractionErrorText}>{extractionError}</Text>
                  {imageUri && (
                    <Pressable style={styles.retryButton} onPress={handleRetryExtraction}>
                      <RotateCw size={14} color={IOS_COLORS.blue} />
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Image picker buttons */}
              <View style={styles.imagePickerSection}>
                <Text style={styles.imagePickerLabel}>Extract from Image</Text>
                <View style={styles.imagePickerButtons}>
                  <Pressable style={styles.imagePickerButton} onPress={handleLibrarySelect}>
                    <ImageIcon size={20} color={IOS_COLORS.purple} />
                    <Text style={styles.imagePickerButtonText}>Photo Library</Text>
                  </Pressable>
                  <Pressable style={styles.imagePickerButton} onPress={handleCameraCapture}>
                    <Camera size={20} color={IOS_COLORS.purple} />
                    <Text style={styles.imagePickerButtonText}>Take Photo</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.orDivider}>
                <View style={styles.orDividerLine} />
                <Text style={styles.orDividerText}>or</Text>
                <View style={styles.orDividerLine} />
              </View>

              {showUrlInput ? (
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.urlInputContainer}
                >
                  <View style={styles.urlInputWrapper}>
                    <TextInput
                      style={styles.urlInput}
                      placeholder="Paste URL to course diagram..."
                      placeholderTextColor={IOS_COLORS.tertiaryLabel}
                      value={urlValue}
                      onChangeText={setUrlValue}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="go"
                      onSubmitEditing={handleUrlSubmit}
                      editable={!isSubmittingUrl}
                    />
                    <Pressable
                      style={[
                        styles.urlLinkButton,
                        (!urlValue.trim() || isSubmittingUrl) && styles.uploadButtonDisabled,
                      ]}
                      onPress={handleUrlSubmit}
                      disabled={!urlValue.trim() || isSubmittingUrl}
                    >
                      {isSubmittingUrl ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Link2 size={18} color="#FFFFFF" />
                      )}
                    </Pressable>
                  </View>
                  <Pressable
                    style={styles.cancelUrlButton}
                    onPress={() => {
                      setShowUrlInput(false);
                      setUrlValue('');
                    }}
                  >
                    <Text style={styles.cancelUrlText}>Cancel</Text>
                  </Pressable>
                </KeyboardAvoidingView>
              ) : (
                <View style={styles.uploadActionsRow}>
                  <Pressable style={styles.uploadButton} onPress={handleUpload}>
                    <Upload size={18} color="#FFFFFF" />
                    <Text style={styles.uploadButtonText}>Upload File</Text>
                  </Pressable>
                  <Pressable
                    style={styles.urlButton}
                    onPress={() => setShowUrlInput(true)}
                  >
                    <Link2 size={18} color={IOS_COLORS.blue} />
                    <Text style={styles.urlButtonText}>Add URL</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Course Type Info */}
      {course?.type && (
        <View style={styles.courseTypeCard}>
          <Text style={styles.courseTypeLabel}>Course Type</Text>
          <Text style={styles.courseTypeName}>
            {course.type.replace(/_/g, ' ')}
          </Text>
          {course.description && (
            <Text style={styles.courseTypeDescription}>{course.description}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderReview = () => (
    <ScrollView
      style={styles.scrollContent}
      contentContainerStyle={styles.scrollContentInner}
    >
      <Text style={styles.sectionTitle}>Course Review Checklist</Text>
      <Text style={styles.sectionDescription}>
        Confirm you've reviewed each aspect of the course layout.
      </Text>

      <View style={styles.checklistContainer}>
        {COURSE_CHECK_ITEMS.map((checkItem) => {
          const isChecked = completedChecks.has(checkItem.id);

          return (
            <Pressable
              key={checkItem.id}
              style={[
                styles.checkItem,
                isChecked && styles.checkItemChecked,
              ]}
              onPress={() => toggleCheck(checkItem.id)}
            >
              <View style={styles.checkItemIcon}>{checkItem.icon}</View>
              <View style={styles.checkItemContent}>
                <Text
                  style={[
                    styles.checkItemLabel,
                    isChecked && styles.checkItemLabelChecked,
                  ]}
                >
                  {checkItem.label}
                </Text>
                <Text style={styles.checkItemDescription}>
                  {checkItem.description}
                </Text>
              </View>
              <View style={styles.checkItemCheckbox}>
                {isChecked ? (
                  <CheckCircle2 size={24} color={IOS_COLORS.green} />
                ) : (
                  <Circle size={24} color={IOS_COLORS.gray} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderDocuments = () => (
    <ScrollView
      style={styles.scrollContent}
      contentContainerStyle={styles.scrollContentInner}
    >
      <Text style={styles.sectionTitle}>Upload Documents</Text>
      <Text style={styles.sectionDescription}>
        Add documents to extract course information automatically.
      </Text>

      {/* Sailing Instructions Section */}
      <View style={styles.documentSection}>
        <View style={styles.documentSectionHeader}>
          <FileText size={20} color={IOS_COLORS.blue} />
          <Text style={styles.documentSectionTitle}>Sailing Instructions</Text>
          {sailingInstructions && (
            <View style={styles.documentCheckBadge}>
              <CheckCircle2 size={16} color={IOS_COLORS.green} />
            </View>
          )}
        </View>
        <Text style={styles.documentSectionDescription}>
          Upload NOR or SI documents (PDF link or paste text)
        </Text>

        {showSIUrlInput ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.siUrlInputContainer}
          >
            <View style={styles.urlInputWrapper}>
              <TextInput
                style={styles.urlInput}
                placeholder="Paste URL to SI document..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                value={siUrlValue}
                onChangeText={setSIUrlValue}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleSIUrlSubmit}
                editable={!isSubmittingSIUrl}
              />
              <Pressable
                style={[
                  styles.urlLinkButton,
                  (!siUrlValue.trim() || isSubmittingSIUrl) && styles.uploadButtonDisabled,
                ]}
                onPress={handleSIUrlSubmit}
                disabled={!siUrlValue.trim() || isSubmittingSIUrl}
              >
                {isSubmittingSIUrl ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Link2 size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
            <Pressable
              style={styles.cancelUrlButton}
              onPress={() => {
                setShowSIUrlInput(false);
                setSIUrlValue('');
              }}
            >
              <Text style={styles.cancelUrlText}>Cancel</Text>
            </Pressable>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.siButtonsRow}>
            <Pressable
              style={styles.documentUploadButton}
              onPress={handleUpload}
            >
              <Upload size={18} color={IOS_COLORS.blue} />
              <Text style={styles.documentUploadButtonText}>
                {sailingInstructions ? 'Update SI' : 'Add SI Document'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.siUrlButton}
              onPress={() => setShowSIUrlInput(true)}
            >
              <Link2 size={18} color={IOS_COLORS.blue} />
              <Text style={styles.documentUploadButtonText}>Add URL</Text>
            </Pressable>
          </View>
        )}

        {/* SI Extraction Status */}
        {siIsExtracting && (
          <View style={styles.siExtractingBanner}>
            <ActivityIndicator size="small" color={IOS_COLORS.blue} />
            <Text style={styles.siExtractingBannerText}>
              Extracting course data from Sailing Instructions...
            </Text>
          </View>
        )}

        {/* SI Extraction Results - show when extraction succeeds (with or without marks) */}
        {siExtractionResult?.success && siExtractionResult.data && (
          <View style={styles.siExtractionResults}>
            {/* Confidence Card */}
            <View style={styles.siConfidenceCard}>
              <Sparkles size={18} color={IOS_COLORS.blue} />
              <Text style={styles.siConfidenceText}>
                {(siExtractionResult.confidence ?? 0) >= 80 ? 'High' :
                 (siExtractionResult.confidence ?? 0) >= 50 ? 'Moderate' : 'Low'} confidence ({Math.round(siExtractionResult.confidence ?? 0)}%)
              </Text>
            </View>

            {/* Extracted Fields Summary */}
            {siExtractionResult.extractedFields && siExtractionResult.extractedFields.length > 0 && (
              <View style={styles.siCourseInfoCard}>
                <Text style={styles.siCourseInfoLabel}>Extracted {siExtractionResult.extractedFields.length} Fields</Text>
                <Text style={styles.siCourseInfoValue}>
                  {siExtractionResult.extractedFields.slice(0, 5).join(', ')}
                  {siExtractionResult.extractedFields.length > 5 && ` +${siExtractionResult.extractedFields.length - 5} more`}
                </Text>
              </View>
            )}

            {/* Extracted Marks List - only show if marks exist */}
            {siExtractionResult.data.marks && siExtractionResult.data.marks.length > 0 ? (
              <View style={styles.siExtractedMarksContainer}>
                <Text style={styles.siExtractedSectionTitle}>Course Marks from SI</Text>
                {siExtractionResult.data.marks.map((mark: any, index: number) => (
                  <View key={index} style={styles.siExtractedMarkRow}>
                    <View style={[styles.siMarkTypeBadge, { backgroundColor: `${getMarkColor(mark.type)}20` }]}>
                      <Text style={[styles.siMarkTypeBadgeText, { color: getMarkColor(mark.type) }]}>
                        {mark.type}
                      </Text>
                    </View>
                    <Text style={styles.siExtractedMarkName}>{mark.name}</Text>
                    {mark.latitude && mark.longitude && (
                      <Text style={styles.siExtractedMarkCoords}>
                        {mark.latitude.toFixed(4)}, {mark.longitude.toFixed(4)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.siNoMarksCard}>
                <Text style={styles.siNoMarksText}>
                  No course marks found in this document. Distance races often describe routes differently - check the Route Waypoints section.
                </Text>
              </View>
            )}

            {/* VHF Channels */}
            {siExtractionResult.data.vhfChannel && (
              <View style={styles.siCourseInfoCard}>
                <Text style={styles.siCourseInfoLabel}>VHF Channel</Text>
                <Text style={styles.siCourseInfoValue}>{siExtractionResult.data.vhfChannel}</Text>
              </View>
            )}

            {/* Potential Courses */}
            {siExtractionResult.data.potentialCourses && siExtractionResult.data.potentialCourses.length > 0 && (
              <View style={styles.siCourseInfoCard}>
                <Text style={styles.siCourseInfoLabel}>Potential Courses</Text>
                <Text style={styles.siCourseInfoValue}>
                  {siExtractionResult.data.potentialCourses.join(', ')}
                </Text>
              </View>
            )}

            {/* Wind Direction */}
            {siExtractionResult.data.expectedWindDirection && (
              <View style={styles.siWindDirectionRow}>
                <Wind size={16} color={IOS_COLORS.green} />
                <Text style={styles.siWindDirectionText}>
                  Expected Wind: {siExtractionResult.data.expectedWindDirection}°
                </Text>
              </View>
            )}

            {/* Clear Button */}
            <Pressable style={styles.siClearButton} onPress={clearSIExtractionResult}>
              <Text style={styles.siClearButtonText}>Clear & Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* SI Extraction Error */}
        {siExtractionResult && !siExtractionResult.success && (
          <View style={styles.siExtractionErrorBanner}>
            <AlertTriangle size={16} color={IOS_COLORS.red} />
            <Text style={styles.siExtractionErrorText}>
              {siExtractionResult.error || 'Could not extract course data'}
            </Text>
          </View>
        )}
      </View>

      {/* Course Diagram Section */}
      <View style={styles.documentSection}>
        <View style={styles.documentSectionHeader}>
          <Map size={20} color={IOS_COLORS.purple} />
          <Text style={styles.documentSectionTitle}>Course Diagram</Text>
          {courseDiagram && (
            <View style={styles.documentCheckBadge}>
              <CheckCircle2 size={16} color={IOS_COLORS.green} />
            </View>
          )}
        </View>
        <Text style={styles.documentSectionDescription}>
          Upload a course map image to extract marks automatically using AI
        </Text>
        <View style={styles.diagramButtonsRow}>
          <Pressable
            style={styles.diagramButton}
            onPress={handleLibrarySelect}
          >
            <ImageIcon size={18} color={IOS_COLORS.purple} />
            <Text style={styles.diagramButtonText}>Photo Library</Text>
          </Pressable>
          <Pressable
            style={styles.diagramButton}
            onPress={handleCameraCapture}
          >
            <Camera size={18} color={IOS_COLORS.purple} />
            <Text style={styles.diagramButtonText}>Take Photo</Text>
          </Pressable>
        </View>
      </View>

      {/* Extraction status */}
      {isExtracting && (
        <View style={styles.extractingBanner}>
          <ActivityIndicator size="small" color={IOS_COLORS.purple} />
          <Text style={styles.extractingBannerText}>Analyzing course diagram...</Text>
        </View>
      )}

      {extractionError && (
        <View style={styles.extractionErrorBanner}>
          <AlertTriangle size={16} color={IOS_COLORS.red} />
          <Text style={styles.extractionErrorBannerText}>{extractionError}</Text>
        </View>
      )}

      {extractedCourse && (
        <View style={styles.extractionSuccessBanner}>
          <CheckCircle2 size={16} color={IOS_COLORS.green} />
          <Text style={styles.extractionSuccessBannerText}>
            Extracted {extractedCourse.marks.length} marks from diagram
          </Text>
          <Pressable onPress={() => setStep('marks')}>
            <Text style={styles.viewMarksLink}>View Marks →</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.closeButton}
          onPress={step === 'overview' ? onCancel : () => setStep('overview')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {step === 'overview' ? (
            <X size={24} color={IOS_COLORS.gray} />
          ) : (
            <ChevronLeft size={24} color={IOS_COLORS.blue} />
          )}
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === 'marks' ? 'Course Marks' : step === 'review' ? 'Checklist' : step === 'documents' ? 'Documents' : 'Course Study'}
        </Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.learnIconButton} onPress={handleLearnMore}>
            <BookOpen size={20} color={IOS_COLORS.purple} />
          </Pressable>
        </View>
      </View>

      {/* Progress Bar (for review step) */}
      {step === 'review' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
                allChecksComplete && styles.progressComplete,
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {completedChecks.size} of {COURSE_CHECK_ITEMS.length} reviewed
          </Text>
        </View>
      )}

      {/* Content */}
      {renderContent()}

      {/* Bottom Action */}
      {(step === 'overview' || step === 'review') && (
        <View style={styles.bottomAction}>
          {step === 'overview' ? (
            <Pressable
              style={styles.primaryButton}
              onPress={() => setStep('review')}
            >
              <Eye size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Start Review</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.primaryButton,
                allChecksComplete
                  ? styles.primaryButtonSuccess
                  : styles.primaryButtonWarning,
              ]}
              onPress={handleComplete}
            >
              <Check size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {allChecksComplete ? 'Complete' : 'Mark as Studied'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {step === 'marks' && (
        <View style={styles.bottomAction}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => setStep('review')}
          >
            <ChevronRight size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Continue to Checklist</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  closeButton: {
    padding: 4,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  learnIconButton: {
    padding: 4,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
    gap: 6,
  },
  progressBar: {
    height: 4,
    backgroundColor: IOS_COLORS.separator,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 2,
  },
  progressComplete: {
    backgroundColor: IOS_COLORS.green,
  },
  progressText: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  // Overview
  overviewHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${IOS_COLORS.blue}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  overviewTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 8,
    textAlign: 'center',
  },
  overviewDescription: {
    fontSize: 16,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Status
  statusSection: {
    marginBottom: 24,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconSuccess: {
    backgroundColor: `${IOS_COLORS.green}15`,
  },
  statusIconWarning: {
    backgroundColor: `${IOS_COLORS.orange}15`,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  statusDescription: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  documentsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 4,
  },
  docStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docStatusText: {
    fontSize: 13,
    color: IOS_COLORS.gray,
  },
  docStatusTextActive: {
    color: IOS_COLORS.green,
    fontWeight: '500',
  },
  // Options
  optionsList: {
    gap: 10,
    marginBottom: 24,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    gap: 12,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  // Tips
  tipsContainer: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.blue,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
  // Sections
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 22,
    marginBottom: 16,
  },
  // Marks
  marksGrid: {
    gap: 10,
    marginBottom: 20,
  },
  markCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    gap: 12,
  },
  markIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markContent: {
    flex: 1,
  },
  markName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  markType: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'capitalize',
  },
  roundingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  roundingText: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'capitalize',
  },
  sequenceBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sequenceText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Course type
  courseTypeCard: {
    padding: 16,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
  },
  courseTypeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  courseTypeName: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  courseTypeDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: IOS_COLORS.separator,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 10,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadActionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  urlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: `${IOS_COLORS.blue}15`,
    borderRadius: 10,
    gap: 8,
  },
  urlButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  urlInputContainer: {
    width: '100%',
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 12,
  },
  urlInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    paddingHorizontal: 12,
    width: '100%',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  urlLinkButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelUrlButton: {
    padding: 8,
  },
  cancelUrlText: {
    fontSize: 15,
    color: IOS_COLORS.blue,
  },
  // Checklist
  checklistContainer: {
    gap: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    gap: 12,
  },
  checkItemChecked: {
    backgroundColor: `${IOS_COLORS.green}08`,
  },
  checkItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkItemContent: {
    flex: 1,
  },
  checkItemLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  checkItemLabelChecked: {
    color: IOS_COLORS.secondaryLabel,
  },
  checkItemDescription: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
  },
  checkItemCheckbox: {
    width: 24,
    height: 24,
  },
  // Map
  mapContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  mapPlaceholder: {
    fontSize: 16,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  mapFallbackButton: {
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mapFallbackButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Bottom action
  bottomAction: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.blue,
    gap: 8,
  },
  primaryButtonSuccess: {
    backgroundColor: IOS_COLORS.green,
  },
  primaryButtonWarning: {
    backgroundColor: IOS_COLORS.orange,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Image extraction styles
  imagePreviewCard: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: IOS_COLORS.separator,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  imageOverlayText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  confidenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: `${IOS_COLORS.purple}15`,
    borderRadius: 10,
    marginBottom: 16,
    width: '100%',
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.purple,
  },
  extractedMarksContainer: {
    width: '100%',
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  extractedSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  extractedMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  markTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  markTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  extractedMarkName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  extractedMarkRounding: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  extractedSequenceContainer: {
    width: '100%',
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sequenceFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  sequenceFlowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sequenceFlowNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  sequenceFlowNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sequenceFlowName: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  windDirectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: `${IOS_COLORS.green}15`,
    borderRadius: 10,
    marginBottom: 16,
    width: '100%',
  },
  windDirectionText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.green,
  },
  clearButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: IOS_COLORS.blue,
    fontWeight: '500',
  },
  extractingImage: {
    width: 180,
    height: 135,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: IOS_COLORS.separator,
  },
  extractingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  extractingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginTop: 12,
  },
  extractingDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  extractionErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: `${IOS_COLORS.red}10`,
    borderRadius: 10,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: `${IOS_COLORS.red}30`,
  },
  extractionErrorText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.red,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${IOS_COLORS.blue}15`,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  imagePickerSection: {
    width: '100%',
    marginBottom: 20,
  },
  imagePickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 10,
    textAlign: 'center',
  },
  imagePickerButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: `${IOS_COLORS.purple}15`,
    borderRadius: 10,
    gap: 8,
  },
  imagePickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.purple,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  orDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
  },
  orDividerText: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    paddingHorizontal: 12,
  },
  // Document section styles
  documentSection: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  documentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  documentSectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  documentCheckBadge: {
    padding: 2,
  },
  documentSectionDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 14,
    lineHeight: 20,
  },
  documentUploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: `${IOS_COLORS.blue}15`,
    borderRadius: 10,
    gap: 8,
  },
  documentUploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  siButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  siUrlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: `${IOS_COLORS.blue}15`,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.blue,
    borderStyle: 'dashed',
  },
  siUrlInputContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  diagramButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  diagramButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: `${IOS_COLORS.purple}15`,
    borderRadius: 10,
    gap: 8,
  },
  diagramButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.purple,
  },
  extractingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: `${IOS_COLORS.purple}10`,
    borderRadius: 10,
    marginTop: 8,
  },
  extractingBannerText: {
    fontSize: 14,
    color: IOS_COLORS.purple,
    fontWeight: '500',
  },
  extractionErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: `${IOS_COLORS.red}10`,
    borderRadius: 10,
    marginTop: 8,
  },
  extractionErrorBannerText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.red,
  },
  extractionSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: `${IOS_COLORS.green}10`,
    borderRadius: 10,
    marginTop: 8,
  },
  extractionSuccessBannerText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.green,
    fontWeight: '500',
  },
  viewMarksLink: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },
  // SI Extraction styles
  siExtractingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: `${IOS_COLORS.blue}10`,
    borderRadius: 10,
    marginTop: 12,
  },
  siExtractingBannerText: {
    fontSize: 14,
    color: IOS_COLORS.blue,
    fontWeight: '500',
  },
  siExtractionResults: {
    backgroundColor: `${IOS_COLORS.secondaryBackground}`,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    gap: 12,
  },
  siConfidenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: `${IOS_COLORS.blue}15`,
    borderRadius: 10,
  },
  siConfidenceText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  siExtractedMarksContainer: {
    gap: 8,
  },
  siExtractedSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  siExtractedMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 8,
  },
  siMarkTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  siMarkTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  siExtractedMarkName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  siExtractedMarkCoords: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  siCourseInfoCard: {
    backgroundColor: `${IOS_COLORS.blue}10`,
    borderRadius: 8,
    padding: 12,
  },
  siCourseInfoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  siCourseInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  siWindDirectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: `${IOS_COLORS.green}15`,
    borderRadius: 10,
  },
  siWindDirectionText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.green,
  },
  siClearButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
  },
  siClearButtonText: {
    fontSize: 14,
    color: IOS_COLORS.blue,
    fontWeight: '500',
  },
  siExtractionErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: `${IOS_COLORS.red}10`,
    borderRadius: 10,
    marginTop: 12,
  },
  siExtractionErrorText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.red,
  },
  siNoMarksCard: {
    backgroundColor: `${IOS_COLORS.orange}10`,
    borderRadius: 8,
    padding: 12,
  },
  siNoMarksText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
});

export default CourseMapWizard;
