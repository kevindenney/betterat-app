// @ts-nocheck

/**
 * Professional Map Controls - OnX Maps Style
 * Advanced control panel for professional sailing race strategy
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type {
  MapInteractionMode,
  AdvancedMapConfig
} from '@/lib/types/advanced-map';

interface ProfessionalMapControlsProps {
  mapConfig: AdvancedMapConfig;
  currentMode: MapInteractionMode;
  is3D: boolean;
  bearing: number;
  pitch: number;
  followingGPS: boolean;
  hasOfflineMaps: boolean;
  activeLayerCount: number;
  onModeChange: (mode: MapInteractionMode) => void;
  onToggle3D: () => void;
  onResetNorth: () => void;
  onCenterOnLocation: () => void;
  onOpenLayerMenu: () => void;
  onOpenOfflineManager: () => void;
  onOpenMeasurementTools: () => void;
  onOpenWeatherAnalysis: () => void;
}

export function ProfessionalMapControls({
  mapConfig,
  currentMode,
  is3D,
  bearing,
  pitch,
  followingGPS,
  hasOfflineMaps,
  activeLayerCount,
  onModeChange,
  onToggle3D,
  onResetNorth,
  onCenterOnLocation,
  onOpenLayerMenu,
  onOpenOfflineManager,
  onOpenMeasurementTools,
  onOpenWeatherAnalysis
}: ProfessionalMapControlsProps) {
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  // Control button configuration
  const controlButtons = [
    {
      id: 'layers',
      icon: '🗂️',
      label: 'Layers',
      badge: activeLayerCount,
      onPress: onOpenLayerMenu,
      description: 'Toggle map layers'
    },
    {
      id: '3d',
      icon: is3D ? '🗻' : '🗺️',
      label: is3D ? '3D' : '2D',
      active: is3D,
      onPress: onToggle3D,
      description: 'Toggle 3D view'
    },
    {
      id: 'compass',
      icon: '🧭',
      label: `${Math.round(bearing)}°`,
      subtitle: pitch > 0 ? `${Math.round(pitch)}°` : undefined,
      active: bearing !== 0 || pitch !== 0,
      onPress: onResetNorth,
      description: 'Reset to North'
    },
    {
      id: 'gps',
      icon: followingGPS ? '📍' : '📍',
      label: 'GPS',
      active: followingGPS,
      onPress: onCenterOnLocation,
      description: 'Center on location'
    },
    {
      id: 'offline',
      icon: hasOfflineMaps ? '💾' : '📡',
      label: 'Offline',
      badge: hasOfflineMaps ? '✓' : undefined,
      onPress: onOpenOfflineManager,
      description: 'Offline maps'
    }
  ];

  const modeButtons = [
    {
      id: 'navigate' as MapInteractionMode,
      icon: '👆',
      label: 'Navigate',
      description: 'Pan and zoom'
    },
    {
      id: 'measure' as MapInteractionMode,
      icon: '📏',
      label: 'Measure',
      description: 'Distance & bearing'
    },
    {
      id: 'mark-placement' as MapInteractionMode,
      icon: '🚩',
      label: 'Marks',
      description: 'Place race marks'
    },
    {
      id: 'route-planning' as MapInteractionMode,
      icon: '🛤️',
      label: 'Route',
      description: 'Plan sailing route'
    },
    {
      id: 'weather-analysis' as MapInteractionMode,
      icon: '🌤️',
      label: 'Weather',
      description: 'Analyze conditions'
    }
  ];

  const professionalTools = [
    {
      id: 'tactical',
      icon: '🎯',
      label: 'Tactical Analysis',
      onPress: () => onModeChange('weather-analysis'),
      description: 'Race strategy analysis'
    },
    {
      id: 'performance',
      icon: '📊',
      label: 'Performance',
      onPress: onOpenMeasurementTools,
      description: 'Performance analytics'
    },
    {
      id: 'fleet',
      icon: '🚤',
      label: 'Fleet Tracking',
      onPress: () => router.push('/(tabs)/connect'),
      description: 'Track racing fleet'
    },
    {
      id: 'history',
      icon: '📈',
      label: 'Race History',
      onPress: () => router.push('/(tabs)/reflect'),
      description: 'Historical analysis'
    }
  ];

  return (
    <ThemedView style={styles.container}>
      {/* Main Control Panel */}
      <View style={styles.controlPanel}>
        {/* Primary Controls */}
        <View style={styles.primaryControls}>
          {controlButtons.map((button) => (
            <ControlButton
              key={button.id}
              {...button}
            />
          ))}
        </View>

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <ThemedText style={styles.sectionLabel}>Mode</ThemedText>
          <View style={styles.modeButtons}>
            {modeButtons.map((mode) => (
              <ModeButton
                key={mode.id}
                {...mode}
                active={currentMode === mode.id}
                onPress={() => onModeChange(mode.id)}
              />
            ))}
          </View>
        </View>

        {/* Professional Tools Toggle */}
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAdvancedControls(!showAdvancedControls)}
        >
          <ThemedText style={styles.advancedToggleText}>
            {showAdvancedControls ? '← Professional Tools' : 'Professional Tools →'}
          </ThemedText>
        </TouchableOpacity>

        {/* Professional Tools Panel */}
        {showAdvancedControls && (
          <View style={styles.professionalPanel}>
            <ThemedText style={styles.sectionLabel}>Professional Tools</ThemedText>
            <View style={styles.toolGrid}>
              {professionalTools.map((tool) => (
                <ProfessionalTool
                  key={tool.id}
                  {...tool}
                />
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <QuickActionButton
            icon="📏"
            label="Measure"
            onPress={onOpenMeasurementTools}
          />
          <QuickActionButton
            icon="🌦️"
            label="Weather"
            onPress={onOpenWeatherAnalysis}
          />
          <QuickActionButton
            icon="🗂️"
            label="Layers"
            onPress={onOpenLayerMenu}
          />
        </View>

        {/* Performance Indicator */}
        <PerformanceIndicator config={mapConfig} />
      </View>
    </ThemedView>
  );
}

// Individual Control Button Component
function ControlButton({
  icon,
  label,
  subtitle,
  badge,
  active = false,
  onPress,
  description
}: {
  icon: string;
  label: string;
  subtitle?: string;
  badge?: number | string;
  active?: boolean;
  onPress: () => void;
  description: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.controlButton, active && styles.controlButtonActive]}
      onPress={onPress}
      accessibilityLabel={description}
    >
      <View style={styles.controlButtonIcon}>
        <ThemedText style={styles.iconText}>{icon}</ThemedText>
        {badge && (
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>
              {typeof badge === 'number' && badge > 9 ? '9+' : badge}
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText style={[styles.controlButtonLabel, active && styles.controlButtonLabelActive]}>
        {label}
      </ThemedText>
      {subtitle && (
        <ThemedText style={styles.controlButtonSubtitle}>
          {subtitle}
        </ThemedText>
      )}
    </TouchableOpacity>
  );
}

// Mode Button Component
function ModeButton({
  icon,
  label,
  active,
  onPress,
  description
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
  description: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.modeButton, active && styles.modeButtonActive]}
      onPress={onPress}
      accessibilityLabel={description}
    >
      <ThemedText style={styles.modeIcon}>{icon}</ThemedText>
      <ThemedText style={[styles.modeLabel, active && styles.modeLabelActive]}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

// Professional Tool Component
function ProfessionalTool({
  icon,
  label,
  onPress,
  description
}: {
  icon: string;
  label: string;
  onPress: () => void;
  description: string;
}) {
  return (
    <TouchableOpacity
      style={styles.professionalTool}
      onPress={onPress}
      accessibilityLabel={description}
    >
      <ThemedText style={styles.toolIcon}>{icon}</ThemedText>
      <ThemedText style={styles.toolLabel}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

// Quick Action Button Component
function QuickActionButton({
  icon,
  label,
  onPress
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
      <ThemedText style={styles.quickActionIcon}>{icon}</ThemedText>
      <ThemedText style={styles.quickActionLabel}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

// Performance Indicator Component
function PerformanceIndicator({ config }: { config: AdvancedMapConfig }) {
  const [performance, _setPerformance] = useState({
    fps: 60,
    memory: 45,
    quality: config.rendering.quality
  });

  const getPerformanceColor = (fps: number) => {
    if (fps >= 55) return '#00A651'; // Excellent
    if (fps >= 30) return '#FFD700'; // Good
    return '#FF6B35'; // Needs optimization
  };

  return (
    <View style={styles.performanceIndicator}>
      <View style={styles.performanceItem}>
        <View style={[styles.performanceDot, { backgroundColor: getPerformanceColor(performance.fps) }]} />
        <ThemedText style={styles.performanceText}>
          {performance.fps}fps
        </ThemedText>
      </View>
      <View style={styles.performanceItem}>
        <View style={[styles.performanceDot, { backgroundColor: '#0066CC' }]} />
        <ThemedText style={styles.performanceText}>
          {performance.memory}MB
        </ThemedText>
      </View>
      <ThemedText style={styles.qualityText}>
        {performance.quality.toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    right: 20,
    maxWidth: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    backdropFilter: 'blur(10px)',
  },
  controlPanel: {
    gap: 16,
  },
  primaryControls: {
    gap: 8,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(0, 102, 204, 0.3)',
    borderColor: '#0066CC',
  },
  controlButtonIcon: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  controlButtonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  controlButtonLabelActive: {
    color: '#0066CC',
  },
  controlButtonSubtitle: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  sectionLabel: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modeSelector: {
    gap: 8,
  },
  modeButtons: {
    gap: 4,
  },
  modeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  modeIcon: {
    fontSize: 14,
  },
  modeLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  modeLabelActive: {
    color: '#00FF88',
  },
  advancedToggle: {
    backgroundColor: 'rgba(0, 102, 204, 0.2)',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  advancedToggleText: {
    color: '#0066CC',
    fontSize: 12,
    fontWeight: '600',
  },
  professionalPanel: {
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 12,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  professionalTool: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    minWidth: 70,
    gap: 4,
  },
  toolIcon: {
    fontSize: 16,
  },
  toolLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  quickActionIcon: {
    fontSize: 12,
  },
  quickActionLabel: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  performanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 6,
    padding: 6,
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  performanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  performanceText: {
    color: '#CCCCCC',
    fontSize: 10,
  },
  qualityText: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '600',
  },
});

export default ProfessionalMapControls;
