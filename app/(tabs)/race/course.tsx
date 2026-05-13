/**
 * Course Visualization Screen - OnX Maps-Style Implementation
 * Professional-grade race course visualization with comprehensive layer system
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import {
  Layers,
  Wind,
  Waves,
  Droplets,
  Navigation,
  TrendingUp,
  Users,
  MapPin,
  Ruler,
  Route,
  Play,
  Settings,
  ChevronLeft,
  Info,
  Download,
} from 'lucide-react-native';
import { WebMapView } from '@/components/map/WebMapView';

const { height } = Dimensions.get('window');

// Layer categories matching OnX Maps
interface MapLayers {
  // Environmental Layers
  windVectors: boolean;
  windForecast: boolean;
  tidalCurrent: boolean;
  tidePredictions: boolean;
  waveHeight: boolean;
  weatherRadar: boolean;

  // Racing Layers
  courseMarks: boolean;
  startLineBias: boolean;
  tacticalLaylines: boolean;
  favoredSide: boolean;
  historicalTracks: boolean;
  winningRoutes: boolean;

  // Social Layers
  fleetPositions: boolean;
  checkIns: boolean;
  communityTips: boolean;

  // Base Maps
  nauticalChart: boolean;
  satellite: boolean;
  hybrid: boolean;
}

interface WeatherData {
  wind: {
    speed: number;
    direction: number;
    gusts: number;
  };
  tide: {
    height: number;
    direction: string;
    speed: number;
    cycle: string;
  };
  waves: {
    height: number;
    period: number;
  };
  temp: number;
}

interface CourseDetails {
  name: string;
  venue: string;
  date: string;
  startTime: string;
  courseType: string;
  length: number;
}

const CourseViewScreen = () => {
  // Map state
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [routeSimulator, setRouteSimulator] = useState(false);
  const [baseMapStyle, setBaseMapStyle] = useState<'nautical' | 'satellite' | 'hybrid'>('nautical');

  // Layer visibility state
  const [layers, setLayers] = useState<MapLayers>({
    // Environmental (default on)
    windVectors: true,
    windForecast: false,
    tidalCurrent: true,
    tidePredictions: false,
    waveHeight: false,
    weatherRadar: false,

    // Racing (default on)
    courseMarks: true,
    startLineBias: true,
    tacticalLaylines: true,
    favoredSide: true,
    historicalTracks: false,
    winningRoutes: false,

    // Social (default off)
    fleetPositions: false,
    checkIns: false,
    communityTips: false,

    // Base maps
    nauticalChart: true,
    satellite: false,
    hybrid: false,
  });

  // Mock course data (would come from API)
  const courseDetails: CourseDetails = {
    name: 'RHKYC Spring Series Course',
    venue: 'Victoria Harbour, Hong Kong',
    date: 'May 15, 2025',
    startTime: '14:00',
    courseType: 'Windward-Leeward',
    length: 1.2,
  };

  const weatherData: WeatherData = {
    wind: {
      speed: 12,
      direction: 45, // NE
      gusts: 18,
    },
    tide: {
      height: 1.2,
      direction: 'SW',
      speed: 0.8,
      cycle: 'Flood',
    },
    waves: {
      height: 0.5,
      period: 4,
    },
    temp: 22,
  };

  // Toggle layer
  const toggleLayer = useCallback((layerKey: keyof MapLayers) => {
    setLayers((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  }, []);

  // Active layer count
  const activeLayerCount = Object.values(layers).filter(Boolean).length;

  // Layer panel content
  const renderLayerPanel = () => (
    <Modal
      visible={showLayerPanel}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowLayerPanel(false)}
    >
      <View style={styles.layerPanelContainer}>
        <View style={styles.layerPanel}>
          {/* Header */}
          <View style={styles.layerPanelHeader}>
            <View style={styles.layerPanelHeaderLeft}>
              <Layers color="#0066CC" size={24} />
              <Text style={styles.layerPanelTitle}>Map Layers</Text>
            </View>
            <TouchableOpacity onPress={() => setShowLayerPanel(false)}>
              <Text style={styles.layerPanelClose}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.layerPanelContent}>
            {/* Environmental Layers */}
            <View style={styles.layerCategory}>
              <Text style={styles.layerCategoryTitle}>⛅ ENVIRONMENTAL LAYERS</Text>

              <LayerToggle
                icon={<Wind color="#0066CC" size={20} />}
                label="Wind Vectors"
                sublabel="Real-time wind arrows with speed"
                enabled={layers.windVectors}
                onToggle={() => toggleLayer('windVectors')}
              />
              <LayerToggle
                icon={<Wind color="#0066CC" size={20} />}
                label="Wind Forecast"
                sublabel="Animated 48hr forecast"
                enabled={layers.windForecast}
                onToggle={() => toggleLayer('windForecast')}
                badge="PRO"
              />
              <LayerToggle
                icon={<Waves color="#0066CC" size={20} />}
                label="Tidal Current"
                sublabel="Flow direction and strength"
                enabled={layers.tidalCurrent}
                onToggle={() => toggleLayer('tidalCurrent')}
              />
              <LayerToggle
                icon={<Waves color="#0066CC" size={20} />}
                label="Tide Predictions"
                sublabel="Height graph for race window"
                enabled={layers.tidePredictions}
                onToggle={() => toggleLayer('tidePredictions')}
              />
              <LayerToggle
                icon={<Droplets color="#0066CC" size={20} />}
                label="Wave Height"
                sublabel="Significant wave height overlay"
                enabled={layers.waveHeight}
                onToggle={() => toggleLayer('waveHeight')}
                badge="PRO"
              />
              <LayerToggle
                icon={<Droplets color="#0066CC" size={20} />}
                label="Weather Radar"
                sublabel="Precipitation overlay"
                enabled={layers.weatherRadar}
                onToggle={() => toggleLayer('weatherRadar')}
                badge="PRO"
              />
            </View>

            {/* Racing Layers */}
            <View style={styles.layerCategory}>
              <Text style={styles.layerCategoryTitle}>🏁 RACING LAYERS</Text>

              <LayerToggle
                icon={<MapPin color="#00AA33" size={20} />}
                label="Course Marks"
                sublabel="3D buoy positioning"
                enabled={layers.courseMarks}
                onToggle={() => toggleLayer('courseMarks')}
              />
              <LayerToggle
                icon={<TrendingUp color="#00AA33" size={20} />}
                label="Start Line Bias"
                sublabel="Visual indicator of favored end"
                enabled={layers.startLineBias}
                onToggle={() => toggleLayer('startLineBias')}
              />
              <LayerToggle
                icon={<Navigation color="#00AA33" size={20} />}
                label="Tactical Laylines"
                sublabel="Wind-dependent laylines"
                enabled={layers.tacticalLaylines}
                onToggle={() => toggleLayer('tacticalLaylines')}
              />
              <LayerToggle
                icon={<TrendingUp color="#00AA33" size={20} />}
                label="Favored Side"
                sublabel="AI heat map showing advantage areas"
                enabled={layers.favoredSide}
                onToggle={() => toggleLayer('favoredSide')}
                badge="AI"
              />
              <LayerToggle
                icon={<Route color="#00AA33" size={20} />}
                label="Historical Tracks"
                sublabel="GPS tracks from past races"
                enabled={layers.historicalTracks}
                onToggle={() => toggleLayer('historicalTracks')}
              />
              <LayerToggle
                icon={<Route color="#00AA33" size={20} />}
                label="Winning Routes"
                sublabel="Routes taken by top finishers"
                enabled={layers.winningRoutes}
                onToggle={() => toggleLayer('winningRoutes')}
                badge="PRO"
              />
            </View>

            {/* Social Layers */}
            <View style={styles.layerCategory}>
              <Text style={styles.layerCategoryTitle}>👥 SOCIAL LAYERS</Text>

              <LayerToggle
                icon={<Users color="#FF6B35" size={20} />}
                label="Fleet Positions"
                sublabel="Other RegattaFlow users at venue"
                enabled={layers.fleetPositions}
                onToggle={() => toggleLayer('fleetPositions')}
              />
              <LayerToggle
                icon={<MapPin color="#FF6B35" size={20} />}
                label="Check-ins"
                sublabel="Fleet member locations"
                enabled={layers.checkIns}
                onToggle={() => toggleLayer('checkIns')}
              />
              <LayerToggle
                icon={<Info color="#FF6B35" size={20} />}
                label="Community Tips"
                sublabel="Tactical notes from others"
                enabled={layers.communityTips}
                onToggle={() => toggleLayer('communityTips')}
              />
            </View>

            {/* Base Map Style */}
            <View style={styles.layerCategory}>
              <Text style={styles.layerCategoryTitle}>🗺️ BASE MAP</Text>

              <TouchableOpacity
                style={[
                  styles.baseMapOption,
                  baseMapStyle === 'nautical' && styles.baseMapOptionActive,
                ]}
                onPress={() => setBaseMapStyle('nautical')}
              >
                <Text style={styles.baseMapOptionText}>
                  {baseMapStyle === 'nautical' ? '◉' : '○'} Nautical Chart (Default)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.baseMapOption,
                  baseMapStyle === 'satellite' && styles.baseMapOptionActive,
                ]}
                onPress={() => setBaseMapStyle('satellite')}
              >
                <Text style={styles.baseMapOptionText}>
                  {baseMapStyle === 'satellite' ? '◉' : '○'} Satellite
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.baseMapOption,
                  baseMapStyle === 'hybrid' && styles.baseMapOptionActive,
                ]}
                onPress={() => setBaseMapStyle('hybrid')}
              >
                <Text style={styles.baseMapOptionText}>
                  {baseMapStyle === 'hybrid' ? '◉' : '○'} Hybrid (Satellite + Nautical)
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <ChevronLeft color="white" size={28} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Course Visualization</Text>
          <Text style={styles.headerSubtitle}>{courseDetails.name}</Text>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Settings color="white" size={24} />
        </TouchableOpacity>
      </View>

      {/* Main Map View */}
      <View style={styles.mapContainer}>
        <WebMapView
          venue="victoria-harbour"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Map Controls Overlay */}
        <View style={styles.mapControls}>
          {/* Left side controls */}
          <View style={styles.leftControls}>
            {/* 2D/3D Toggle */}
            <View style={styles.viewModeToggle}>
              <TouchableOpacity
                style={[styles.viewModeButton, viewMode === '2d' && styles.viewModeButtonActive]}
                onPress={() => setViewMode('2d')}
              >
                <Text style={viewMode === '2d' ? styles.viewModeTextActive : styles.viewModeText}>
                  2D
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewModeButton, viewMode === '3d' && styles.viewModeButtonActive]}
                onPress={() => setViewMode('3d')}
              >
                <Text style={viewMode === '3d' ? styles.viewModeTextActive : styles.viewModeText}>
                  3D
                </Text>
              </TouchableOpacity>
            </View>

            {/* Weather Summary Card */}
            <View style={styles.weatherCard}>
              <View style={styles.weatherRow}>
                <Wind color="#0066CC" size={16} />
                <Text style={styles.weatherText}>
                  {weatherData.wind.speed}kt @ {weatherData.wind.direction}°
                </Text>
              </View>
              <View style={styles.weatherRow}>
                <Waves color="#0066CC" size={16} />
                <Text style={styles.weatherText}>
                  {weatherData.tide.direction} {weatherData.tide.speed}kt
                </Text>
              </View>
              <View style={styles.weatherRow}>
                <Droplets color="#0066CC" size={16} />
                <Text style={styles.weatherText}>{weatherData.waves.height}m waves</Text>
              </View>
            </View>
          </View>

          {/* Right side controls */}
          <View style={styles.rightControls}>
            {/* Layers Button */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setShowLayerPanel(true)}
            >
              <Layers color="#0066CC" size={24} />
              <View style={styles.controlBadge}>
                <Text style={styles.controlBadgeText}>{activeLayerCount}</Text>
              </View>
            </TouchableOpacity>

            {/* Measurement Tool */}
            <TouchableOpacity
              style={[styles.controlButton, measurementMode && styles.controlButtonActive]}
              onPress={() => setMeasurementMode(!measurementMode)}
            >
              <Ruler color={measurementMode ? '#FFFFFF' : '#0066CC'} size={24} />
            </TouchableOpacity>

            {/* Route Simulator */}
            <TouchableOpacity
              style={[styles.controlButton, routeSimulator && styles.controlButtonActive]}
              onPress={() => setRouteSimulator(!routeSimulator)}
            >
              <Route color={routeSimulator ? '#FFFFFF' : '#0066CC'} size={24} />
            </TouchableOpacity>

            {/* Download for Offline */}
            <TouchableOpacity style={styles.controlButton}>
              <Download color="#0066CC" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Layer Indicators */}
        {activeLayerCount > 0 && (
          <View style={styles.activeLayersBar}>
            <Text style={styles.activeLayersText}>
              {activeLayerCount} layer{activeLayerCount !== 1 ? 's' : ''} active
            </Text>
            {layers.windVectors && <Text style={styles.layerChip}>🌬️ Wind</Text>}
            {layers.tidalCurrent && <Text style={styles.layerChip}>🌊 Tide</Text>}
            {layers.favoredSide && <Text style={styles.layerChip}>🎯 Strategy</Text>}
          </View>
        )}

        {/* Measurement Tool Overlay */}
        {measurementMode && (
          <View style={styles.toolOverlay}>
            <Text style={styles.toolOverlayTitle}>📏 Measurement Tool</Text>
            <Text style={styles.toolOverlayText}>Tap on map to measure distance & bearing</Text>
          </View>
        )}

        {/* Route Simulator Overlay */}
        {routeSimulator && (
          <View style={styles.toolOverlay}>
            <Text style={styles.toolOverlayTitle}>🎮 Route Simulator</Text>
            <Text style={styles.toolOverlayText}>Draw your route to see time estimates</Text>
            <View style={styles.simulatorControls}>
              <TouchableOpacity style={styles.simulatorButton}>
                <Play color="#FFFFFF" size={16} />
                <Text style={styles.simulatorButtonText}>Simulate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Layer Panel Modal */}
      {renderLayerPanel()}

      {/* Bottom Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionButton}>
          <Info color="#666" size={20} />
          <Text style={styles.quickActionText}>Course Info</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton}>
          <Users color="#666" size={20} />
          <Text style={styles.quickActionText}>Fleet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton}>
          <TrendingUp color="#666" size={20} />
          <Text style={styles.quickActionText}>Strategy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton}>
          <Route color="#666" size={20} />
          <Text style={styles.quickActionText}>Tracks</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Layer Toggle Component
const LayerToggle = ({
  icon,
  label,
  sublabel,
  enabled,
  onToggle,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  enabled: boolean;
  onToggle: () => void;
  badge?: string;
}) => (
  <TouchableOpacity style={styles.layerToggle} onPress={onToggle}>
    <View style={styles.layerToggleLeft}>
      {icon}
      <View style={styles.layerToggleText}>
        <View style={styles.layerToggleLabelRow}>
          <Text style={styles.layerToggleLabel}>{label}</Text>
          {badge && (
            <View style={[styles.layerBadge, badge === 'PRO' && styles.layerBadgePro, badge === 'AI' && styles.layerBadgeAI]}>
              <Text style={styles.layerBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.layerToggleSublabel}>{sublabel}</Text>
      </View>
    </View>
    <View style={[styles.layerToggleSwitch, enabled && styles.layerToggleSwitchOn]}>
      <View style={[styles.layerToggleThumb, enabled && styles.layerToggleThumbOn]} />
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#0066CC',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBackButton: {
    padding: 4,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#CCE5FF',
    fontSize: 14,
    marginTop: 4,
  },
  headerButton: {
    padding: 8,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  leftControls: {
    alignItems: 'flex-start',
    gap: 12,
  },
  rightControls: {
    alignItems: 'flex-end',
    gap: 12,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  viewModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#0066CC',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  viewModeTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  weatherCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    minWidth: 180,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weatherText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  controlButtonActive: {
    backgroundColor: '#0066CC',
  },
  controlBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  controlBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activeLayersBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  activeLayersText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  layerChip: {
    backgroundColor: 'rgba(0, 102, 204, 0.3)',
    color: '#FFFFFF',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0066CC',
  },
  toolOverlay: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 16,
  },
  toolOverlayTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  toolOverlayText: {
    color: '#CCCCCC',
    fontSize: 13,
  },
  simulatorControls: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  simulatorButton: {
    backgroundColor: '#00AA33',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  simulatorButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  quickActions: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
  },
  quickActionText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  // Layer Panel Styles
  layerPanelContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  layerPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.85,
  },
  layerPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  layerPanelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  layerPanelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  layerPanelClose: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066CC',
  },
  layerPanelContent: {
    flex: 1,
  },
  layerCategory: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  layerCategoryTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    letterSpacing: 1,
    marginBottom: 12,
  },
  layerToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  layerToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  layerToggleText: {
    flex: 1,
  },
  layerToggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  layerToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  layerToggleSublabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  layerBadge: {
    backgroundColor: '#00AA33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  layerBadgePro: {
    backgroundColor: '#FFB020',
  },
  layerBadgeAI: {
    backgroundColor: '#9333ea',
  },
  layerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  layerToggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  layerToggleSwitchOn: {
    backgroundColor: '#0066CC',
  },
  layerToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  layerToggleThumbOn: {
    alignSelf: 'flex-end',
  },
  baseMapOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  baseMapOptionActive: {
    backgroundColor: '#E5F2FF',
    borderWidth: 1,
    borderColor: '#0066CC',
  },
  baseMapOptionText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
});

export default CourseViewScreen;
