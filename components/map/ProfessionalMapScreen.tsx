// @ts-nocheck
/* eslint-disable react/no-unknown-property */

/**
 * Professional Map Screen - Complete Integration
 * OnX Maps-level implementation with all professional features
 */

import React, { useState, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
// import { Canvas, useThree, useFrame } from '@react-three/fiber'; // TODO: Re-enable with ES module fix
// import { Billboard, Text as DreiText } from '@react-three/drei'; // TODO: Re-enable with Three.js
import { WebMapView } from './WebMapView';

// Import all our new professional components
import { ProfessionalMapControls } from './ProfessionalMapControls';
// import { Bathymetry3DViewer } from './Bathymetry3DViewer'; // TODO: Re-enable with Three.js
// import { WeatherOverlay3D } from './WeatherOverlay3D'; // TODO: Re-enable with Three.js
import { StrategyChatInterface } from '@/components/ai/StrategyChatInterface';

// Import types
import type {
  MapInteractionMode,
  AdvancedMapConfig,
  GeoLocation,
  BoundingBox,
  AdvancedWeatherConditions,
  NavigationResult,
  StrategyInsight
} from '@/lib/types/advanced-map';
import type { RaceMark } from '@/lib/types/map';

interface ProfessionalMapScreenProps {
  venue: string;
  marks: RaceMark[];
  initialWeather?: AdvancedWeatherConditions;
  onMarkPress?: (mark: RaceMark) => void;
  onMapPress?: (coordinates: GeoLocation) => void;
  onWeatherUpdate?: (weather: AdvancedWeatherConditions) => void;
  onNavigationCalculated?: (result: NavigationResult) => void;
  professionalMode?: boolean;
}

export function ProfessionalMapScreen({
  venue,
  marks,
  initialWeather,
  onMarkPress: _onMarkPress,
  onMapPress: _onMapPress,
  onWeatherUpdate,
  onNavigationCalculated: _onNavigationCalculated,
  professionalMode: _professionalMode = true
}: ProfessionalMapScreenProps) {
  // Map state
  const [currentMode, setCurrentMode] = useState<MapInteractionMode>('navigate');
  const [is3D, setIs3D] = useState(true);
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(45);
  const [followingGPS, setFollowingGPS] = useState(false);

  // Layer visibility
  const [showBathymetry, setShowBathymetry] = useState(true);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);
  const [showWindField, setShowWindField] = useState(true);
  const [showWindBarbs, setShowWindBarbs] = useState(true);
  const [showCurrentArrows, setShowCurrentArrows] = useState(true);
  const [showPressure, setShowPressure] = useState(false);
  const [showWaveHeight, setShowWaveHeight] = useState(false);

  // UI state
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [_showMeasurementTools, setShowMeasurementTools] = useState(false);
  const [_showWeatherAnalysis, setShowWeatherAnalysis] = useState(false);

  // Data state
  const [currentWeather, setCurrentWeather] = useState<AdvancedWeatherConditions | null>(initialWeather || null);
  const [strategicInsights, setStrategicInsights] = useState<StrategyInsight[]>([]);

  // Venue bounds (would be loaded from venue data)
  const _venueBounds: BoundingBox = getVenueBounds(venue);

  // Advanced map configuration
  const mapConfig: AdvancedMapConfig = {
    // Base config
    camera: {
      zoom: 14,
      bearing: bearing,
      pitch: pitch
    },
    layers: {
      nauticalChart: true,
      satellite: false,
      bathymetry: showBathymetry,
      windField: showWindField,
      tidalCurrents: showCurrentArrows
    },

    // Professional features
    rendering: {
      engine: 'maplibre',
      quality: 'ultra',
      frameRate: 60,
      antiAliasing: true
    },
    terrain: {
      bathymetrySource: 'noaa',
      terrainExaggeration: 2.0,
      seaFloorDetail: true,
      contourLines: {
        depths: [2, 5, 10, 20, 50, 100],
        colors: ['#E3F2FD', '#90CAF9', '#42A5F5', '#1E88E5', '#1565C0', '#0D47A1'],
        lineWidth: 1,
        labelFrequency: 3,
        smoothing: true,
        threeDimensional: is3D
      },
      highResolution: true
    },
    weather: {
      sources: [
        {
          id: 'openmeteo',
          name: 'Open-Meteo',
          url: 'https://api.open-meteo.com/v1',
          priority: 1,
          updateInterval: 900 // 15 minutes
        }
      ],
      updateInterval: 900,
      forecastHours: 72,
      resolution: 'high',
      realTimeUpdates: true
    },
    performance: {
      tileCacheSize: 500, // MB
      maxConcurrentRequests: 6,
      lodStrategy: 'balanced',
      preloadRadius: 2
    }
  };

  // Event handlers
  const handleModeChange = useCallback((mode: MapInteractionMode) => {
    setCurrentMode(mode);

    if (mode === 'weather-analysis') {
      setShowWeatherAnalysis(true);
    } else if (mode === 'measure') {
      setShowMeasurementTools(true);
    }
  }, []);

  const handleToggle3D = useCallback(() => {
    setIs3D(prev => !prev);
    if (!is3D) {
      setPitch(45); // Set reasonable 3D pitch
    } else {
      setPitch(0); // Flat for 2D
    }
  }, [is3D]);

  const handleResetNorth = useCallback(() => {
    setBearing(0);
    if (is3D) {
      setPitch(45);
    }
  }, [is3D]);

  const handleCenterOnLocation = useCallback(() => {
    setFollowingGPS(prev => !prev);
    showAlert('GPS Center', followingGPS ? 'GPS following disabled' : 'Centering on GPS location');
  }, [followingGPS]);

  const _handleWeatherUpdate = useCallback((weather: AdvancedWeatherConditions) => {
    setCurrentWeather(weather);
    onWeatherUpdate?.(weather);
  }, [onWeatherUpdate]);

  const handleInsightGenerated = useCallback((insights: StrategyInsight[]) => {
    setStrategicInsights(prev => [...prev, ...insights]);
  }, []);

  const activeLayerCount = [
    showBathymetry,
    showWeatherOverlay,
    showWindField,
    showWindBarbs,
    showCurrentArrows,
    showPressure,
    showWaveHeight
  ].filter(Boolean).length;

  return (
    <ThemedView style={styles.container}>
      {/* Professional Map View */}
      <View style={styles.mapContainer}>
        <WebMapView
          venue={venue || 'san-francisco-bay'}
          style={{
            height: '100%',
            width: '100%'
          }}
          showWindArrows={showWindField || showWindBarbs}
          showCurrentArrows={showCurrentArrows}
          windDirection={currentWeather?.wind?.direction ?? 225}
          windSpeed={currentWeather?.wind?.speed}
          // Current direction: derive from tide or use wind-based estimate
          // Typically current flows roughly perpendicular to coast or with prevailing tide
          currentDirection={currentWeather?.tide?.speed ?
            (currentWeather.tide.direction === 'flood' ? 0 :
             currentWeather.tide.direction === 'ebb' ? 180 : 90) :
            ((currentWeather?.wind?.direction ?? 225) + 90) % 360}
          currentSpeed={currentWeather?.tide?.speed}
        />
      </View>

      {/* Professional Map Controls */}
      <ProfessionalMapControls
        mapConfig={mapConfig}
        currentMode={currentMode}
        is3D={is3D}
        bearing={bearing}
        pitch={pitch}
        followingGPS={followingGPS}
        hasOfflineMaps={false} // Would check actual offline status
        activeLayerCount={activeLayerCount}
        onModeChange={handleModeChange}
        onToggle3D={handleToggle3D}
        onResetNorth={handleResetNorth}
        onCenterOnLocation={handleCenterOnLocation}
        onOpenLayerMenu={() => setShowLayerMenu(true)}
        onOpenOfflineManager={() =>
          showConfirm(
            'Offline Maps',
            'Offline map packs are managed by support right now.',
            () =>
              Linking.openURL(
                'mailto:support@regattaflow.com?subject=Offline%20Map%20Pack%20Request'
              )
          )
        }
        onOpenMeasurementTools={() => setShowMeasurementTools(true)}
        onOpenWeatherAnalysis={() => setShowWeatherAnalysis(true)}
      />

      {/* Floating Action Button for AI Chat */}
      <TouchableOpacity
        style={styles.aiChatButton}
        onPress={() => setShowAIChat(true)}
      >
        <ThemedText style={styles.aiChatButtonText}>🧠 Strategy</ThemedText>
      </TouchableOpacity>

      {/* Strategic Insights Panel */}
      {strategicInsights.length > 0 && (
        <View style={styles.insightsPanel}>
          <ThemedText style={styles.insightsTitle}>💡 Latest Insights</ThemedText>
          {strategicInsights.slice(-2).map((insight, index) => (
            <TouchableOpacity
              key={index}
              style={styles.insightChip}
              onPress={() => showAlert(insight.title, insight.description)}
            >
              <ThemedText style={styles.insightText}>{insight.title}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* AI Strategy Chat Interface */}
      <StrategyChatInterface
        visible={showAIChat}
        onClose={() => setShowAIChat(false)}
        context={{
          venue,
          conditions: currentWeather,
          race: { marks }
        }}
        onInsightGenerated={handleInsightGenerated}
      />

      {/* Layer Menu Modal */}
      {showLayerMenu && (
        <LayerMenuModal
          visible={showLayerMenu}
          onClose={() => setShowLayerMenu(false)}
          layers={{
            bathymetry: showBathymetry,
            weatherOverlay: showWeatherOverlay,
            windField: showWindField,
            windBarbs: showWindBarbs,
            currentArrows: showCurrentArrows,
            pressure: showPressure,
            waveHeight: showWaveHeight
          }}
          onLayerToggle={(layer, enabled) => {
            switch (layer) {
              case 'bathymetry':
                setShowBathymetry(enabled);
                break;
              case 'weatherOverlay':
                setShowWeatherOverlay(enabled);
                break;
              case 'windField':
                setShowWindField(enabled);
                break;
              case 'windBarbs':
                setShowWindBarbs(enabled);
                break;
              case 'currentArrows':
                setShowCurrentArrows(enabled);
                break;
              case 'pressure':
                setShowPressure(enabled);
                break;
              case 'waveHeight':
                setShowWaveHeight(enabled);
                break;
            }
          }}
        />
      )}

      {/* Performance Overlay */}
      <View style={styles.performanceOverlay}>
        <ThemedText style={styles.performanceText}>
          🎯 Professional Mode • 3D: {is3D ? 'ON' : 'OFF'} • Mode: {currentMode.toUpperCase()}
        </ThemedText>
        {currentWeather && (
          <ThemedText style={styles.weatherText}>
            🌬️ {currentWeather.wind.speed}kts @ {currentWeather.wind.direction}° •
            📊 {Math.round(currentWeather.forecast.confidence * 100)}% confidence
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
}

// Helper functions
function getVenueBounds(venue: string): BoundingBox {
  const venueBounds = {
    'san-francisco-bay': {
      north: 37.85,
      south: 37.75,
      east: -122.35,
      west: -122.45
    },
    'newport-rhode-island': {
      north: 41.52,
      south: 41.45,
      east: -71.30,
      west: -71.38
    },
    'cowes-isle-of-wight': {
      north: 50.78,
      south: 50.72,
      east: -1.28,
      west: -1.35
    },
    'sydney-harbour': {
      north: -33.82,
      south: -33.88,
      east: 151.25,
      west: 151.18
    }
  };

  return venueBounds[venue as keyof typeof venueBounds] || venueBounds['san-francisco-bay'];
}

// 3D Race Mark Component (disabled - requires @react-three/fiber + drei)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RaceMark3D({
  mark,
  bounds,
  onPress
}: {
  mark: RaceMark;
  bounds: BoundingBox;
  onPress: () => void;
}) {
  // Convert lat/lng to 3D coordinates
  const x = ((mark.position.longitude - bounds.southwest.longitude) / (bounds.northeast.longitude - bounds.southwest.longitude)) * 100 - 50;
  const z = ((bounds.northeast.latitude - mark.position.latitude) / (bounds.northeast.latitude - bounds.southwest.latitude)) * 100 - 50;

  const markColor = {
    start: '#00FF88',
    finish: '#FF6B35',
    windward: '#0066CC',
    leeward: '#FFD700',
    gate: '#FF1493',
    offset: '#8A2BE2'
  }[mark.type] || '#FFFFFF';

  return (
    <group position={[x, 5, z]} onClick={onPress}>
      {/* Mark cylinder */}
      <mesh castShadow>
        <cylinderGeometry args={[1, 1, 10, 16]} />
        <meshLambertMaterial color={markColor} />
      </mesh>

      {/* Mark label */}
      {/* eslint-disable-next-line react/jsx-no-undef */}
      <Billboard position={[0, 8, 0]}>
        {/* eslint-disable-next-line react/jsx-no-undef */}
        <Text
          fontSize={2}
          color={markColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.1}
          outlineColor="#000000"
        >
          {mark.name}
        </Text>
      </Billboard>
    </group>
  );
}

// Camera Controller Component
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CameraController({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mode,
  bearing,
  pitch,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  followGPS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBearingChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPitchChange
}: {
  mode: MapInteractionMode;
  bearing: number;
  pitch: number;
  followGPS: boolean;
  onBearingChange: (bearing: number) => void;
  onPitchChange: (pitch: number) => void;
}) {
  const { camera } = useThree();

  useFrame(() => {
    // Update camera based on bearing and pitch
    const radius = 150;
    const x = Math.sin(bearing * Math.PI / 180) * Math.cos(pitch * Math.PI / 180) * radius;
    const y = Math.sin(pitch * Math.PI / 180) * radius + 20;
    const z = Math.cos(bearing * Math.PI / 180) * Math.cos(pitch * Math.PI / 180) * radius;

    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// Layer Menu Modal Component (simplified)
function LayerMenuModal({
  visible,
  onClose,
  layers,
  onLayerToggle
}: {
  visible: boolean;
  onClose: () => void;
  layers: Record<string, boolean>;
  onLayerToggle: (layer: string, enabled: boolean) => void;
}) {
  if (!visible) return null;

  return (
    <View style={styles.layerMenu}>
      <ThemedText style={styles.layerMenuTitle}>Map Layers</ThemedText>
      {Object.entries(layers).map(([key, enabled]) => (
        <TouchableOpacity
          key={key}
          style={styles.layerItem}
          onPress={() => onLayerToggle(key, !enabled)}
        >
          <ThemedText style={styles.layerName}>
            {enabled ? '✅' : '⬜'} {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
          </ThemedText>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.layerCloseButton} onPress={onClose}>
        <ThemedText style={styles.layerCloseText}>Close</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 20,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 16,
    textAlign: 'center',
  },
  placeholderDetails: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 4,
    textAlign: 'center',
  },
  aiChatButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    backgroundColor: '#00FF88',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    boxShadow: '0px 2px',
  },
  aiChatButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  insightsPanel: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    maxWidth: 200,
  },
  insightsTitle: {
    color: '#00FF88',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  insightChip: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  insightText: {
    color: '#00FF88',
    fontSize: 10,
  },
  performanceOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 6,
    maxWidth: 300,
  },
  performanceText: {
    color: '#00FF88',
    fontSize: 11,
    fontWeight: '600',
  },
  weatherText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 2,
  },
  layerMenu: {
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 16,
    borderRadius: 8,
    minWidth: 200,
  },
  layerMenuTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  layerItem: {
    paddingVertical: 8,
  },
  layerName: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  layerCloseButton: {
    backgroundColor: '#0066CC',
    padding: 8,
    borderRadius: 4,
    marginTop: 12,
    alignItems: 'center',
  },
  layerCloseText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ProfessionalMapScreen;
