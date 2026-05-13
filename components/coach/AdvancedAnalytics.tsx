import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import ComputerVisionService from '../../services/ComputerVisionService';
import IoTSensorService from '../../services/IoTSensorService';

type AnalyticsTabId = 'realtime' | 'trim' | 'sensors' | 'vision';

interface AnalyticsTab {
  id: AnalyticsTabId;
  title: string;
  icon: string;
}

interface TelemetryDisplayProps {
  telemetry: any;
  sailTelemetry: any;
  performanceMetrics: any;
}

interface SailTrimAnalysisProps {
  analysis: any;
  imageUri?: string;
}

interface SensorHealthProps {
  health: any;
}

const ANALYTICS_TABS: AnalyticsTab[] = [
  { id: 'realtime', title: 'Real-Time', icon: '📊' },
  { id: 'trim', title: 'Sail Trim', icon: '⛵' },
  { id: 'sensors', title: 'Sensors', icon: '📡' },
  { id: 'vision', title: 'Vision', icon: '👁️' },
];

function TelemetryDisplay({ telemetry, sailTelemetry, performanceMetrics }: TelemetryDisplayProps) {
  if (!telemetry) return <Text style={styles.noDataText}>No telemetry data available</Text>;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Performance Summary */}
      <View style={styles.metricsCard}>
        <Text style={styles.cardTitle}>Performance</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{telemetry.motion.speed_over_ground.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>SOG (kts)</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{performanceMetrics?.efficiency.toFixed(0)}%</Text>
            <Text style={styles.metricLabel}>Efficiency</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{performanceMetrics?.velocity_made_good.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>VMG</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{telemetry.motion.heel_angle.toFixed(0)}°</Text>
            <Text style={styles.metricLabel}>Heel</Text>
          </View>
        </View>
      </View>

      {/* Wind Data */}
      <View style={styles.metricsCard}>
        <Text style={styles.cardTitle}>Wind Conditions</Text>
        <View style={styles.windDisplay}>
          <View style={styles.windItem}>
            <Text style={styles.windValue}>{telemetry.wind.apparent_speed.toFixed(1)} kts</Text>
            <Text style={styles.windLabel}>Apparent Speed</Text>
          </View>
          <View style={styles.windItem}>
            <Text style={styles.windValue}>{telemetry.wind.apparent_angle.toFixed(0)}°</Text>
            <Text style={styles.windLabel}>Apparent Angle</Text>
          </View>
          {telemetry.wind.true_speed && (
            <>
              <View style={styles.windItem}>
                <Text style={styles.windValue}>{telemetry.wind.true_speed.toFixed(1)} kts</Text>
                <Text style={styles.windLabel}>True Speed</Text>
              </View>
              <View style={styles.windItem}>
                <Text style={styles.windValue}>{telemetry.wind.true_angle.toFixed(0)}°</Text>
                <Text style={styles.windLabel}>True Angle</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Sail Loads (if available) */}
      {sailTelemetry && (
        <View style={styles.metricsCard}>
          <Text style={styles.cardTitle}>Sail Loads</Text>
          <View style={styles.loadGrid}>
            <View style={styles.loadItem}>
              <Text style={styles.loadValue}>{sailTelemetry.main_sail.sheet_load.toFixed(0)} kg</Text>
              <Text style={styles.loadLabel}>Main Sheet</Text>
            </View>
            <View style={styles.loadItem}>
              <Text style={styles.loadValue}>{sailTelemetry.jib.sheet_load.toFixed(0)} kg</Text>
              <Text style={styles.loadLabel}>Jib Sheet</Text>
            </View>
            <View style={styles.loadItem}>
              <Text style={styles.loadValue}>{sailTelemetry.mast.forestay_tension.toFixed(0)} kg</Text>
              <Text style={styles.loadLabel}>Forestay</Text>
            </View>
            <View style={styles.loadItem}>
              <Text style={styles.loadValue}>{sailTelemetry.mast.backstay_tension.toFixed(0)} kg</Text>
              <Text style={styles.loadLabel}>Backstay</Text>
            </View>
          </View>
        </View>
      )}

      {/* Boat Systems */}
      <View style={styles.metricsCard}>
        <Text style={styles.cardTitle}>Boat Systems</Text>
        <View style={styles.systemsGrid}>
          <View style={styles.systemItem}>
            <Text style={styles.systemValue}>{telemetry.boat_systems.battery_voltage.toFixed(1)}V</Text>
            <Text style={styles.systemLabel}>Battery</Text>
          </View>
          <View style={styles.systemItem}>
            <Text style={styles.systemValue}>{telemetry.environment.water_temperature.toFixed(1)}°C</Text>
            <Text style={styles.systemLabel}>Water Temp</Text>
          </View>
          <View style={styles.systemItem}>
            <Text style={styles.systemValue}>{telemetry.environment.barometric_pressure.toFixed(0)} hPa</Text>
            <Text style={styles.systemLabel}>Pressure</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function SailTrimAnalysisComponent({ analysis, imageUri }: SailTrimAnalysisProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return '#00AA33';
    if (score >= 70) return '#FFA500';
    return '#FF6B35';
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Analysis Image */}
      {imageUri && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.analysisImage} />
        </View>
      )}

      {/* Overall Score */}
      <View style={styles.scoreCard}>
        <Text style={styles.cardTitle}>Sail Trim Analysis</Text>
        <View style={styles.scoreDisplay}>
          <Text style={[styles.scoreValue, { color: getScoreColor(analysis.overall_score) }]}>
            {analysis.overall_score}/100
          </Text>
          <Text style={styles.scoreLabel}>Overall Trim Score</Text>
        </View>
      </View>

      {/* Sail Shape Details */}
      <View style={styles.metricsCard}>
        <Text style={styles.cardTitle}>Main Sail</Text>
        <View style={styles.sailDetails}>
          <View style={styles.sailMetric}>
            <Text style={styles.sailLabel}>Twist</Text>
            <Text style={styles.sailValue}>{analysis.sail_shape.main_sail.twist}°</Text>
          </View>
          <View style={styles.sailMetric}>
            <Text style={styles.sailLabel}>Camber</Text>
            <Text style={styles.sailValue}>{analysis.sail_shape.main_sail.camber}%</Text>
          </View>
          <View style={styles.sailMetric}>
            <Text style={styles.sailLabel}>Leech Tension</Text>
            <Text style={[styles.sailValue, {
              color: analysis.sail_shape.main_sail.leech_tension === 'optimal' ? '#00AA33' : '#FFA500'
            }]}>
              {analysis.sail_shape.main_sail.leech_tension}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.metricsCard}>
        <Text style={styles.cardTitle}>Jib</Text>
        <View style={styles.sailDetails}>
          <View style={styles.sailMetric}>
            <Text style={styles.sailLabel}>Twist</Text>
            <Text style={styles.sailValue}>{analysis.sail_shape.jib.twist}°</Text>
          </View>
          <View style={styles.sailMetric}>
            <Text style={styles.sailLabel}>Camber</Text>
            <Text style={styles.sailValue}>{analysis.sail_shape.jib.camber}%</Text>
          </View>
          <View style={styles.sailMetric}>
            <Text style={styles.sailLabel}>Lead Position</Text>
            <Text style={[styles.sailValue, {
              color: analysis.sail_shape.jib.lead_position === 'optimal' ? '#00AA33' : '#FFA500'
            }]}>
              {analysis.sail_shape.jib.lead_position}
            </Text>
          </View>
        </View>
      </View>

      {/* Issues and Recommendations */}
      {analysis.issues_detected.length > 0 && (
        <View style={styles.issuesCard}>
          <Text style={styles.cardTitle}>Issues Detected</Text>
          {analysis.issues_detected.map((issue: string, index: number) => (
            <Text key={index} style={styles.issueText}>• {issue}</Text>
          ))}
        </View>
      )}

      <View style={styles.recommendationsCard}>
        <Text style={styles.cardTitle}>Recommendations</Text>
        {analysis.recommendations.map((rec: any, index: number) => (
          <View key={index} style={styles.recommendation}>
            <View style={styles.recommendationHeader}>
              <Text style={[styles.priority, {
                backgroundColor: rec.priority === 'high' ? '#FF6B35' : rec.priority === 'medium' ? '#FFA500' : '#00AA33'
              }]}>
                {rec.priority.toUpperCase()}
              </Text>
              <Text style={styles.category}>{rec.category.toUpperCase()}</Text>
            </View>
            <Text style={styles.adjustment}>{rec.adjustment}</Text>
            <Text style={styles.reason}>{rec.reason}</Text>
            <Text style={styles.instruction}>📋 {rec.control_instruction}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SensorHealth({ health }: SensorHealthProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return '#00AA33';
      case 'warning': return '#FFA500';
      case 'stale': return '#FF6B35';
      default: return '#666';
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Overall Status */}
      <View style={styles.healthCard}>
        <Text style={styles.cardTitle}>Sensor Health</Text>
        <View style={styles.healthOverall}>
          <Text style={[styles.healthStatus, { color: getStatusColor(health.overall_status) }]}>
            {health.overall_status.toUpperCase()}
          </Text>
          <Text style={styles.healthSubtext}>
            {health.sensor_statuses.length} sensors monitored
          </Text>
        </View>
      </View>

      {/* Individual Sensors */}
      <View style={styles.metricsCard}>
        <Text style={styles.cardTitle}>Sensor Status</Text>
        {health.sensor_statuses.map((sensor: any, index: number) => (
          <View key={index} style={styles.sensorItem}>
            <View style={styles.sensorInfo}>
              <Text style={styles.sensorName}>{sensor.sensor_id}</Text>
              <Text style={styles.sensorTime}>
                Last update: {new Date(sensor.last_update).toLocaleTimeString()}
              </Text>
            </View>
            <View style={[styles.sensorStatus, { backgroundColor: getStatusColor(sensor.status) }]}>
              <Text style={styles.sensorStatusText}>{sensor.status}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Issues */}
      {health.issues.length > 0 && (
        <View style={styles.issuesCard}>
          <Text style={styles.cardTitle}>Active Issues</Text>
          {health.issues.map((issue: string, index: number) => (
            <Text key={index} style={styles.issueText}>⚠️ {issue}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

export default function AdvancedAnalytics() {
  const { user: _user } = useAuth();
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('realtime');
  const [loading, setLoading] = useState(false);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [sailTelemetry, setSailTelemetry] = useState<any>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [sailTrimAnalysis, setSailTrimAnalysis] = useState<any>(null);
  const [analysisImageUri, setAnalysisImageUri] = useState<string | undefined>(undefined);
  const [sensorHealth, setSensorHealth] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  const updateInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initializeServices();
    startDataUpdates();

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
        updateInterval.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeServices = async () => {
    try {
      await IoTSensorService.initializeSensors('demo-boat');
      updateSensorHealth();
    } catch (error) {
      console.error('Error initializing services:', error);
    }
  };

  const startDataUpdates = () => {
    updateTelemetryData();

    updateInterval.current = setInterval(() => {
      updateTelemetryData();
      updateSensorHealth();
    }, 2000); // Update every 2 seconds
  };

  const updateTelemetryData = () => {
    const currentTelemetry = IoTSensorService.getCurrentTelemetry();
    const currentSailTelemetry = IoTSensorService.getCurrentSailTelemetry();

    if (currentTelemetry) {
      setTelemetry(currentTelemetry);
      const metrics = IoTSensorService.calculatePerformanceMetrics(currentTelemetry, {});
      setPerformanceMetrics(metrics);

      // Check for alerts
      IoTSensorService.checkAlertRules(currentTelemetry);
    }

    if (currentSailTelemetry) {
      setSailTelemetry(currentSailTelemetry);
    }
  };

  const updateSensorHealth = () => {
    const health = IoTSensorService.getSensorHealth();
    setSensorHealth(health);
  };

  const handleCaptureAndAnalyze = async () => {
    setLoading(true);
    try {
      const { imageUri, analysis } = await ComputerVisionService.captureAndAnalyzeTrim();
      setSailTrimAnalysis(analysis);
      setAnalysisImageUri(imageUri ?? undefined);
      setActiveTab('trim');
    } catch (error) {
      console.error('Error capturing and analyzing:', error);
      showAlert('Error', 'Failed to capture and analyze image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = () => {
    IoTSensorService.startRecording(`session-${Date.now()}`);
    setIsRecording(true);
    showAlert('Recording Started', 'Sensor data recording has started for this session.');
  };

  const handleStopRecording = async () => {
    try {
      await IoTSensorService.stopRecording();
      setIsRecording(false);
      showAlert('Recording Saved', 'Session data has been saved successfully.');
    } catch (error) {
      showAlert('Error', 'Failed to save session data.');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'realtime':
        return (
          <TelemetryDisplay
            telemetry={telemetry}
            sailTelemetry={sailTelemetry}
            performanceMetrics={performanceMetrics}
          />
        );
      case 'trim':
        return sailTrimAnalysis ? (
          <SailTrimAnalysisComponent
            analysis={sailTrimAnalysis}
            imageUri={analysisImageUri}
          />
        ) : (
          <View style={styles.noAnalysisContainer}>
            <Text style={styles.noAnalysisText}>No sail trim analysis available</Text>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCaptureAndAnalyze}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.captureButtonText}>📸 Capture & Analyze</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      case 'sensors':
        return sensorHealth ? (
          <SensorHealth health={sensorHealth} />
        ) : (
          <Text style={styles.noDataText}>Loading sensor data...</Text>
        );
      case 'vision':
        return (
          <View style={styles.visionContainer}>
            <Text style={styles.visionTitle}>Computer Vision Analytics</Text>
            <Text style={styles.visionDescription}>
              Use computer vision to analyze sail trim, crew position, and boat handling techniques.
            </Text>

            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCaptureAndAnalyze}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.captureButtonText}>📸 Analyze Sail Trim</Text>
              )}
            </TouchableOpacity>

            {analysisImageUri && (
              <View style={styles.recentAnalysis}>
                <Text style={styles.recentTitle}>Recent Analysis</Text>
                <Image source={{ uri: analysisImageUri }} style={styles.recentImage} />
                <TouchableOpacity
                  style={styles.viewAnalysisButton}
                  onPress={() => setActiveTab('trim')}
                >
                  <Text style={styles.viewAnalysisText}>View Full Analysis</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      default:
        return <Text style={styles.noDataText}>Select a tab to view data</Text>;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Advanced Analytics</Text>
        <Text style={styles.subtitle}>Computer Vision + IoT Sensors</Text>

        {/* Recording Controls */}
        <View style={styles.recordingControls}>
          {!isRecording ? (
            <TouchableOpacity style={styles.recordButton} onPress={handleStartRecording}>
              <Text style={styles.recordButtonText}>🔴 Start Recording</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopButton} onPress={handleStopRecording}>
              <Text style={styles.stopButtonText}>⏹️ Stop Recording</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {ANALYTICS_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>

      {/* Demo Notice */}
      <View style={styles.demoNotice}>
        <Text style={styles.demoText}>
          🚧 Demo: Simulated sensor data + vision analysis
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  recordingControls: {
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#666',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066CC',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#0066CC',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  metricsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px',
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  windDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  windItem: {
    alignItems: 'center',
    marginBottom: 12,
  },
  windValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00AA33',
  },
  windLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  loadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  loadItem: {
    alignItems: 'center',
    width: '45%',
    marginBottom: 12,
  },
  loadValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  loadLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  systemsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  systemItem: {
    alignItems: 'center',
  },
  systemValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  systemLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 40,
  },
  imageContainer: {
    marginBottom: 16,
  },
  analysisImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    boxShadow: '0px 2px',
    elevation: 3,
  },
  scoreDisplay: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  sailDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  sailMetric: {
    alignItems: 'center',
  },
  sailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  sailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  issuesCard: {
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE5B3',
  },
  issueText: {
    fontSize: 14,
    color: '#B8860B',
    marginBottom: 4,
  },
  recommendationsCard: {
    backgroundColor: '#E6F3FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recommendation: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  priority: {
    fontSize: 10,
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    fontWeight: '600',
  },
  category: {
    fontSize: 10,
    color: '#666',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    fontWeight: '600',
  },
  adjustment: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  reason: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  instruction: {
    fontSize: 14,
    color: '#0066CC',
    fontWeight: '500',
  },
  healthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    boxShadow: '0px 2px',
    elevation: 3,
  },
  healthOverall: {
    alignItems: 'center',
  },
  healthStatus: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  healthSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  sensorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sensorInfo: {
    flex: 1,
  },
  sensorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sensorTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sensorStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sensorStatusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  noAnalysisContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noAnalysisText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
  },
  captureButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  captureButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  visionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  visionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  visionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  recentAnalysis: {
    marginTop: 32,
    alignItems: 'center',
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  recentImage: {
    width: 200,
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
  },
  viewAnalysisButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewAnalysisText: {
    fontSize: 14,
    color: '#0066CC',
    fontWeight: '500',
  },
  demoNotice: {
    backgroundColor: '#FFF4E6',
    padding: 12,
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE5B3',
  },
  demoText: {
    fontSize: 12,
    color: '#B8860B',
    textAlign: 'center',
  },
});
