import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Text, Button, Card, Chip, ProgressBar } from 'react-native-paper';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { MaterialIcons } from '@expo/vector-icons';
import DocumentParsingService from '../../services/DocumentParsingService';
import RaceCourseVisualizationService from '../../services/RaceCourseVisualizationService';
import StrategicPlanningService from '../../services/StrategicPlanningService';

interface OnXMapsInterfaceProps {
  venueId?: string;
  sailorProfile?: any;
  competitionLevel?: 'club' | 'regional' | 'national' | 'international';
  onStrategyGenerated?: (strategy: any) => void;
}

interface DocumentProcessingState {
  stage: 'idle' | 'uploading' | 'parsing' | 'visualizing' | 'strategizing' | 'complete';
  progress: number;
  currentMessage: string;
}

interface CourseVisualizationState {
  courseId?: string;
  isMapLoaded: boolean;
  activeLayer: 'course' | 'wind' | 'current' | 'tactical';
  showLaylines: boolean;
  showTacticalGrid: boolean;
}

interface StrategyDisplayState {
  activeTab: 'overview' | 'tactical' | 'contingency' | 'simulation';
  selectedTacticalPoint?: any;
  showExecutionTimer: boolean;
}

export default function OnXMapsInterface({
  venueId,
  sailorProfile,
  competitionLevel = 'regional',
  onStrategyGenerated,
}: OnXMapsInterfaceProps) {
  // State management
  const [documentState, setDocumentState] = useState<DocumentProcessingState>({
    stage: 'idle',
    progress: 0,
    currentMessage: 'Ready to process sailing instructions',
  });

  const [visualizationState, setVisualizationState] = useState<CourseVisualizationState>({
    isMapLoaded: false,
    activeLayer: 'course',
    showLaylines: false,
    showTacticalGrid: false,
  });

  const [_strategyState, setStrategyState] = useState<StrategyDisplayState>({
    activeTab: 'overview',
    showExecutionTimer: false,
  });

  // Data state
  const [courseExtraction, setCourseExtraction] = useState<any>(null);
  const [venueIntelligence, setVenueIntelligence] = useState<any>(null);
  const [raceStrategy, setRaceStrategy] = useState<any>(null);
  const [_realTimeData, _setRealTimeData] = useState<any>(null);

  // UI state
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [_showStrategyModal, setShowStrategyModal] = useState(false);
  const [_showSimulationResults, setShowSimulationResults] = useState(false);

  // Refs
  const mapContainerRef = useRef<View>(null);

  // Effects
  useEffect(() => {
    if (venueId) {
      loadVenueIntelligence();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  useEffect(() => {
    if (courseExtraction && visualizationState.courseId) {
      initializeCourseVisualization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseExtraction, visualizationState.courseId]);

  // Document processing functions
  const handleDocumentUpload = async () => {
    try {
      setShowDocumentModal(true);
      setDocumentState({
        stage: 'uploading',
        progress: 10,
        currentMessage: 'Selecting sailing instructions document...',
      });

      // Select and parse document
      const { documentUri: _documentUri, courseExtraction: extracted } =
        await DocumentParsingService.selectAndParseDocument();

      setDocumentState({
        stage: 'parsing',
        progress: 40,
        currentMessage: 'Extracting course information with AI...',
      });

      setCourseExtraction(extracted);

      setDocumentState({
        stage: 'visualizing',
        progress: 70,
        currentMessage: 'Building 3D course visualization...',
      });

      // Initialize course visualization
      const courseId = await RaceCourseVisualizationService.initialize3DCourse({
        container: mapContainerRef.current || 'map-container',
        course_extraction: extracted,
        venue_intelligence: venueIntelligence,
        visualization_config: {
          theme: 'nautical',
          show_bathymetry: true,
          show_currents: true,
          show_wind_vectors: true,
          show_laylines: false,
          show_tactical_grid: false,
          animation_enabled: true,
          performance_mode: 'high',
        },
        interactive_features: {
          mark_selection: true,
          layline_drawing: true,
          wind_measurement: true,
          current_measurement: true,
          tactical_notes: true,
          strategy_overlay: true,
          real_time_tracking: false,
        },
      });

      setVisualizationState(prev => ({
        ...prev,
        courseId,
        isMapLoaded: true,
      }));

      setDocumentState({
        stage: 'strategizing',
        progress: 90,
        currentMessage: 'Generating AI race strategy...',
      });

      // Generate race strategy
      const strategy = await StrategicPlanningService.generateRaceStrategy(
        extracted,
        venueIntelligence,
        {}, // Environmental data would come from weather APIs
        sailorProfile,
        competitionLevel
      );

      setRaceStrategy(strategy);
      onStrategyGenerated?.(strategy);

      setDocumentState({
        stage: 'complete',
        progress: 100,
        currentMessage: 'OnX Maps for Sailing ready!',
      });

      // Close modal after delay
      setTimeout(() => {
        setShowDocumentModal(false);
      }, 1500);

    } catch (error) {
      console.error('Error processing document:', error);
      showAlert('Processing Error', 'Failed to process sailing instructions. Please try again.');
      setShowDocumentModal(false);
      setDocumentState({
        stage: 'idle',
        progress: 0,
        currentMessage: 'Ready to process sailing instructions',
      });
    }
  };

  const loadVenueIntelligence = async () => {
    try {
      if (!venueId) return;

      const intelligence = await DocumentParsingService.loadVenueIntelligence(venueId);
      setVenueIntelligence(intelligence);
    } catch (error) {
      console.error('Error loading venue intelligence:', error);
    }
  };

  const initializeCourseVisualization = async () => {
    try {
      if (!visualizationState.courseId || !courseExtraction) return;

      // Add wind visualization if available
      if (venueIntelligence?.local_conditions?.typical_wind_patterns) {
        const windVisualization = {
          vectors: venueIntelligence.local_conditions.typical_wind_patterns.map((pattern: any, index: number) => ({
            coordinates: [
              courseExtraction.marks[0]?.coordinates[0] + (index * 0.001),
              courseExtraction.marks[0]?.coordinates[1] + (index * 0.001),
            ],
            direction: pattern.direction_range[0],
            speed: pattern.speed_range[0],
            confidence: pattern.reliability_score,
            timestamp: Date.now(),
          })),
          shift_zones: [],
          pressure_areas: [],
          confidence_overlay: {
            grid_resolution: 100,
            confidence_data: [],
            visualization_type: 'heatmap' as const,
          },
        };

        await RaceCourseVisualizationService.addWindVisualization(
          visualizationState.courseId,
          windVisualization
        );
      }

      // Add current visualization if available
      if (venueIntelligence?.local_conditions?.current_patterns) {
        const currentVisualization = {
          vectors: venueIntelligence.local_conditions.current_patterns.map((pattern: any, index: number) => ({
            coordinates: [
              courseExtraction.marks[0]?.coordinates[0] + (index * 0.002),
              courseExtraction.marks[0]?.coordinates[1] + (index * 0.002),
            ],
            direction: pattern.direction,
            speed: pattern.speed_range[0],
            tidal_state: 'flood' as const,
            depth_layer: 'surface' as const,
          })),
          tidal_streams: [],
          eddy_zones: [],
          layline_effects: [],
        };

        await RaceCourseVisualizationService.addCurrentVisualization(
          visualizationState.courseId,
          currentVisualization
        );
      }

    } catch (error) {
      console.error('Error initializing course visualization:', error);
    }
  };

  // Visualization control functions
  const toggleVisualizationLayer = (layer: 'course' | 'wind' | 'current' | 'tactical') => {
    setVisualizationState(prev => ({
      ...prev,
      activeLayer: layer,
    }));
  };

  const toggleLaylines = () => {
    setVisualizationState(prev => ({
      ...prev,
      showLaylines: !prev.showLaylines,
    }));
  };

  const toggleTacticalGrid = () => {
    setVisualizationState(prev => ({
      ...prev,
      showTacticalGrid: !prev.showTacticalGrid,
    }));
  };

  // Strategy functions
  const openStrategyModal = () => {
    setShowStrategyModal(true);
  };

  const startExecutionTimer = () => {
    setStrategyState(prev => ({
      ...prev,
      showExecutionTimer: true,
    }));
  };

  const viewSimulationResults = () => {
    setShowSimulationResults(true);
  };

  const exportCourseImage = async () => {
    try {
      if (!visualizationState.courseId) return;

      const _imageData = await RaceCourseVisualizationService.exportCourseImage(
        visualizationState.courseId,
        {
          format: 'png',
          quality: 0.9,
          width: 1920,
          height: 1080,
        }
      );

      // Handle image export (save to device, share, etc.)
      showAlert('Export Complete', 'Course visualization exported successfully!');
    } catch (error) {
      console.error('Error exporting course image:', error);
      showAlert('Export Error', 'Failed to export course visualization.');
    }
  };

  // Render functions
  const renderDocumentProcessingModal = () => (
    <Modal
      visible={showDocumentModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDocumentModal(false)}
    >
      <View style={styles.modalOverlay}>
        <Card style={styles.processingCard}>
          <Card.Content>
            <View style={styles.processingHeader}>
              <MaterialIcons
                name="description"
                size={32}
                color="#2196F3"
              />
              <Text variant="headlineSmall" style={styles.processingTitle}>
                OnX Maps for Sailing
              </Text>
            </View>

            <Text variant="bodyMedium" style={styles.processingMessage}>
              {documentState.currentMessage}
            </Text>

            <ProgressBar
              progress={documentState.progress / 100}
              style={styles.progressBar}
            />

            <View style={styles.processingStages}>
              {['uploading', 'parsing', 'visualizing', 'strategizing', 'complete'].map((stage, index) => (
                <View key={stage} style={styles.stageIndicator}>
                  <View style={[
                    styles.stageCircle,
                    documentState.stage === stage && styles.stageActive,
                    index < ['uploading', 'parsing', 'visualizing', 'strategizing', 'complete'].indexOf(documentState.stage) && styles.stageComplete,
                  ]}>
                    <Text style={styles.stageNumber}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stageLabel}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </Text>
                </View>
              ))}
            </View>

            {documentState.stage === 'complete' && (
              <View style={styles.completionActions}>
                <MaterialIcons name="check-circle" size={48} color="#4CAF50" />
                <Text variant="bodyLarge" style={styles.completionText}>
                  Ready for tactical planning!
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </View>
    </Modal>
  );

  const renderVisualizationControls = () => (
    <View style={styles.controlsPanel}>
      <Text variant="titleMedium" style={styles.controlsTitle}>
        Visualization Layers
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.layerControls}>
        {[
          { key: 'course', label: 'Course', icon: 'location-on' },
          { key: 'wind', label: 'Wind', icon: 'air' },
          { key: 'current', label: 'Current', icon: 'waves' },
          { key: 'tactical', label: 'Tactical', icon: 'gps-fixed' },
        ].map(layer => (
          <TouchableOpacity
            key={layer.key}
            style={[
              styles.layerButton,
              visualizationState.activeLayer === layer.key && styles.layerButtonActive,
            ]}
            onPress={() => toggleVisualizationLayer(layer.key as any)}
          >
            <MaterialIcons
              name={layer.icon as any}
              size={20}
              color={visualizationState.activeLayer === layer.key ? '#fff' : '#666'}
            />
            <Text style={[
              styles.layerButtonText,
              visualizationState.activeLayer === layer.key && styles.layerButtonTextActive,
            ]}>
              {layer.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.toggleControls}>
        <TouchableOpacity
          style={[styles.toggleButton, visualizationState.showLaylines && styles.toggleButtonActive]}
          onPress={toggleLaylines}
        >
          <MaterialIcons
            name="timeline"
            size={16}
            color={visualizationState.showLaylines ? '#fff' : '#666'}
          />
          <Text style={[
            styles.toggleButtonText,
            visualizationState.showLaylines && styles.toggleButtonTextActive,
          ]}>
            Laylines
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, visualizationState.showTacticalGrid && styles.toggleButtonActive]}
          onPress={toggleTacticalGrid}
        >
          <MaterialIcons
            name="grid-on"
            size={16}
            color={visualizationState.showTacticalGrid ? '#fff' : '#666'}
          />
          <Text style={[
            styles.toggleButtonText,
            visualizationState.showTacticalGrid && styles.toggleButtonTextActive,
          ]}>
            Grid
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStrategyOverview = () => (
    <Card style={styles.strategyCard}>
      <Card.Content>
        <View style={styles.strategyHeader}>
          <MaterialIcons name="psychology" size={24} color="#FF9800" />
          <Text variant="titleMedium">Race Strategy</Text>
          <Chip icon="auto-awesome" mode="outlined" compact>
            Monte Carlo Optimized
          </Chip>
        </View>

        {raceStrategy && (
          <>
            <View style={styles.strategyMetrics}>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Predicted Position</Text>
                <Text variant="headlineSmall" style={styles.metricValue}>
                  {Math.round(raceStrategy.monte_carlo_results?.statistical_summary?.mean_finish_position || 10)}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Confidence</Text>
                <Text variant="headlineSmall" style={styles.metricValue}>
                  {Math.round((raceStrategy.confidence_metrics?.overall_confidence || 0.75) * 100)}%
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Est. Duration</Text>
                <Text variant="headlineSmall" style={styles.metricValue}>
                  {Math.round((raceStrategy.course_analysis?.estimated_duration || 45))}m
                </Text>
              </View>
            </View>

            <View style={styles.strategicHighlights}>
              <Text variant="titleSmall" style={styles.highlightsTitle}>Key Strategic Points</Text>
              {raceStrategy.tactical_plan?.start_strategy && (
                <View style={styles.highlightItem}>
                  <MaterialIcons name="play-arrow" size={16} color="#4CAF50" />
                  <Text variant="bodySmall">
                    Start: {raceStrategy.tactical_plan.start_strategy.timing_strategy} approach
                  </Text>
                </View>
              )}
              {raceStrategy.tactical_plan?.first_beat_plan && (
                <View style={styles.highlightItem}>
                  <MaterialIcons name="trending-up" size={16} color="#2196F3" />
                  <Text variant="bodySmall">
                    Beat: {raceStrategy.tactical_plan.first_beat_plan.side_selection?.initial_side} side preference
                  </Text>
                </View>
              )}
              <View style={styles.highlightItem}>
                <MaterialIcons name="warning" size={16} color="#FF9800" />
                <Text variant="bodySmall">
                  {raceStrategy.contingency_plans?.length || 0} contingency plans ready
                </Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.strategyActions}>
          <Button
            mode="contained"
            onPress={openStrategyModal}
            style={styles.strategyButton}
            icon="visibility"
          >
            View Details
          </Button>
          <Button
            mode="outlined"
            onPress={startExecutionTimer}
            style={styles.strategyButton}
            icon="timer"
          >
            Start Timer
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  const renderMainInterface = () => (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="sailing" size={28} color="#2196F3" />
          <Text variant="headlineSmall" style={styles.headerTitle}>
            OnX Maps for Sailing
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={exportCourseImage}
          >
            <MaterialIcons name="share" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={viewSimulationResults}
          >
            <MaterialIcons name="analytics" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Upload Section */}
        {!courseExtraction && (
          <Card style={styles.uploadCard}>
            <Card.Content>
              <View style={styles.uploadContent}>
                <MaterialIcons name="cloud-upload" size={64} color="#E0E0E0" />
                <Text variant="headlineSmall" style={styles.uploadTitle}>
                  Upload Sailing Instructions
                </Text>
                <Text variant="bodyMedium" style={styles.uploadDescription}>
                  Transform any sailing instruction document into a 3D tactical race course with AI-powered strategy
                </Text>
                <Button
                  mode="contained"
                  onPress={handleDocumentUpload}
                  style={styles.uploadButton}
                  icon="document-scanner"
                >
                  Select Document
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Course Visualization */}
        {courseExtraction && (
          <>
            {renderVisualizationControls()}

            <Card style={styles.mapCard}>
              <Card.Content>
                <View
                  ref={mapContainerRef}
                  style={styles.mapContainer}
                >
                  {/* MapLibre GL will render here */}
                  {!visualizationState.isMapLoaded && (
                    <View style={styles.mapPlaceholder}>
                      <ActivityIndicator size="large" color="#2196F3" />
                      <Text variant="bodyMedium" style={styles.mapPlaceholderText}>
                        Loading 3D course visualization...
                      </Text>
                    </View>
                  )}
                </View>
              </Card.Content>
            </Card>

            {/* Strategy Overview */}
            {raceStrategy && renderStrategyOverview()}
          </>
        )}
      </ScrollView>

      {/* Modals */}
      {renderDocumentProcessingModal()}
    </View>
  );

  return renderMainInterface();
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 12,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  uploadCard: {
    marginBottom: 16,
  },
  uploadContent: {
    alignItems: 'center',
    padding: 32,
  },
  uploadTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadDescription: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  uploadButton: {
    minWidth: 200,
  },
  controlsPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  controlsTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  layerControls: {
    marginBottom: 16,
  },
  layerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  layerButtonActive: {
    backgroundColor: '#2196F3',
  },
  layerButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  layerButtonTextActive: {
    color: '#fff',
  },
  toggleControls: {
    flexDirection: 'row',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  toggleButtonActive: {
    backgroundColor: '#4CAF50',
  },
  toggleButtonText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  mapCard: {
    marginBottom: 16,
  },
  mapContainer: {
    height: 400,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    marginTop: 12,
    color: '#666',
  },
  strategyCard: {
    marginBottom: 16,
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  strategyMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontWeight: '600',
    color: '#2196F3',
  },
  strategicHighlights: {
    marginBottom: 20,
  },
  highlightsTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  strategyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  strategyButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  processingCard: {
    width: '100%',
    maxWidth: 400,
  },
  processingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  processingTitle: {
    fontWeight: '600',
  },
  processingMessage: {
    marginBottom: 16,
    color: '#666',
  },
  progressBar: {
    marginBottom: 24,
    height: 8,
    borderRadius: 4,
  },
  processingStages: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  stageIndicator: {
    alignItems: 'center',
    flex: 1,
  },
  stageCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageActive: {
    backgroundColor: '#2196F3',
  },
  stageComplete: {
    backgroundColor: '#4CAF50',
  },
  stageNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  stageLabel: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
  },
  completionActions: {
    alignItems: 'center',
  },
  completionText: {
    marginTop: 8,
    color: '#4CAF50',
    fontWeight: '600',
  },
});