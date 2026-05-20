/**
 * DistanceRouteMap - Native iOS/Android Implementation
 *
 * Click-to-add waypoint map for distance racing using react-native-maps.
 * Provides the same interface as the web version.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit2,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react-native';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';

import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
  type CameraRef,
  type PressEvent,
} from '@maplibre/maplibre-react-native';

// Types
export interface RouteWaypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'start' | 'waypoint' | 'gate' | 'finish';
  required: boolean;
}

interface DistanceRouteMapProps {
  waypoints: RouteWaypoint[];
  onWaypointsChange: (waypoints: RouteWaypoint[]) => void;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  totalDistanceNm?: number;
  onTotalDistanceChange?: (distance: number) => void;
  onReimportWaypoints?: () => void;
}

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Waypoint type colors
const WAYPOINT_TYPE_COLORS = {
  start: '#22c55e',    // green
  waypoint: '#3b82f6', // blue
  gate: '#f59e0b',     // amber
  finish: '#ef4444',   // red
};

// Calculate distance between two points in nautical miles
function calculateDistanceNm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate total route distance
function calculateTotalDistance(waypoints: RouteWaypoint[]): number {
  if (waypoints.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += calculateDistanceNm(
      waypoints[i - 1].latitude,
      waypoints[i - 1].longitude,
      waypoints[i].latitude,
      waypoints[i].longitude
    );
  }
  return Math.round(total * 10) / 10;
}

export function DistanceRouteMap({
  waypoints,
  onWaypointsChange,
  initialCenter = { lat: 22.28, lng: 114.16 },
  onTotalDistanceChange,
  onReimportWaypoints: _onReimportWaypoints,
}: DistanceRouteMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [isAddingWaypoint, setIsAddingWaypoint] = useState(true);
  const [nextWaypointType, setNextWaypointType] = useState<RouteWaypoint['type']>('start');
  const [editingWaypoint, setEditingWaypoint] = useState<RouteWaypoint | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<RouteWaypoint['type']>('waypoint');

  // Calculate and report total distance
  useEffect(() => {
    const distance = calculateTotalDistance(waypoints);
    onTotalDistanceChange?.(distance);
  }, [waypoints, onTotalDistanceChange]);

  // Calculate initial center + zoom
  const initialView = useMemo(() => {
    const valid = waypoints.filter((wp) => wp.latitude && wp.longitude);
    if (valid.length > 0) {
      const lats = valid.map((wp) => wp.latitude);
      const lngs = valid.map((wp) => wp.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const latDelta = Math.max((maxLat - minLat) * 1.5, 0.05);
      return {
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number],
        zoom: Math.max(2, Math.min(20, Math.log2(360 / latDelta))),
      };
    }
    return {
      center: [initialCenter.lng, initialCenter.lat] as [number, number],
      zoom: 11,
    };
  }, [initialCenter, waypoints]);

  // Handle map press to add waypoint
  const handleMapPress = useCallback((event: { nativeEvent: PressEvent }) => {
    if (!isAddingWaypoint) return;

    const [longitude, latitude] = event.nativeEvent.lngLat;

    const getWaypointName = () => {
      if (nextWaypointType === 'start') return 'Start';
      if (nextWaypointType === 'finish') return 'Finish';
      if (nextWaypointType === 'gate') {
        const gateCount = waypoints.filter(w => w.type === 'gate').length + 1;
        return `Gate ${gateCount}`;
      }
      const waypointCount = waypoints.filter(w => w.type === 'waypoint').length + 1;
      return `Waypoint ${waypointCount}`;
    };

    const newWaypoint: RouteWaypoint = {
      id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: getWaypointName(),
      latitude,
      longitude,
      type: nextWaypointType,
      required: nextWaypointType === 'start' || nextWaypointType === 'finish',
    };

    onWaypointsChange([...waypoints, newWaypoint]);

    // Auto-advance type
    if (nextWaypointType === 'start') {
      setNextWaypointType('waypoint');
    }
  }, [isAddingWaypoint, nextWaypointType, waypoints, onWaypointsChange]);

  // MapLibre RN markers aren't draggable — edits go through the list UI instead.

  // Start editing a waypoint
  const startEditWaypoint = useCallback((wp: RouteWaypoint) => {
    setEditingWaypoint(wp);
    setEditName(wp.name);
    setEditType(wp.type);
  }, []);

  // Save edited waypoint
  const saveEditWaypoint = useCallback(() => {
    if (!editingWaypoint || !editName.trim()) return;

    const updated = waypoints.map(wp =>
      wp.id === editingWaypoint.id
        ? { ...wp, name: editName.trim(), type: editType }
        : wp
    );
    onWaypointsChange(updated);
    setEditingWaypoint(null);
  }, [editingWaypoint, editName, editType, waypoints, onWaypointsChange]);

  // Remove waypoint
  const removeWaypoint = useCallback((id: string) => {
    onWaypointsChange(waypoints.filter(wp => wp.id !== id));
  }, [waypoints, onWaypointsChange]);

  // Move waypoint up/down
  const moveWaypointUp = useCallback((index: number) => {
    if (index === 0) return;
    const newWaypoints = [...waypoints];
    [newWaypoints[index - 1], newWaypoints[index]] = [newWaypoints[index], newWaypoints[index - 1]];
    onWaypointsChange(newWaypoints);
  }, [waypoints, onWaypointsChange]);

  const moveWaypointDown = useCallback((index: number) => {
    if (index === waypoints.length - 1) return;
    const newWaypoints = [...waypoints];
    [newWaypoints[index], newWaypoints[index + 1]] = [newWaypoints[index + 1], newWaypoints[index]];
    onWaypointsChange(newWaypoints);
  }, [waypoints, onWaypointsChange]);

  // Clear all waypoints
  const clearWaypoints = useCallback(() => {
    showConfirm(
      'Clear All Waypoints',
      'Are you sure you want to remove all waypoints?',
      () => {
        onWaypointsChange([]);
        setNextWaypointType('start');
      },
      { destructive: true },
    );
  }, [onWaypointsChange]);

  // Undo last waypoint
  const undoLastWaypoint = useCallback(() => {
    if (waypoints.length > 0) {
      onWaypointsChange(waypoints.slice(0, -1));
    }
  }, [waypoints, onWaypointsChange]);

  const totalDistance = calculateTotalDistance(waypoints);

  // Polyline as a GeoJSON LineString feature.
  const polylineFeature = useMemo(() => {
    const valid = waypoints.filter((wp) => wp.latitude && wp.longitude);
    if (valid.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: valid.map((wp) => [wp.longitude, wp.latitude] as [number, number]),
      },
    };
  }, [waypoints]);

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <Pressable
            onPress={() => setIsAddingWaypoint(!isAddingWaypoint)}
            style={[styles.addButton, isAddingWaypoint && styles.addButtonActive]}
          >
            <Plus size={16} color={isAddingWaypoint ? '#fff' : '#9333ea'} />
            <Text style={[styles.addButtonText, isAddingWaypoint && styles.addButtonTextActive]}>
              {isAddingWaypoint ? 'Tap Map to Add' : 'Add'}
            </Text>
          </Pressable>

          <Pressable
            onPress={undoLastWaypoint}
            disabled={waypoints.length === 0}
            style={[styles.iconButton, waypoints.length === 0 && styles.iconButtonDisabled]}
          >
            <RotateCcw size={16} color={waypoints.length === 0 ? '#9ca3af' : '#9333ea'} />
          </Pressable>

          <Pressable
            onPress={clearWaypoints}
            disabled={waypoints.length === 0}
            style={[styles.iconButton, waypoints.length === 0 && styles.iconButtonDisabled]}
          >
            <Trash2 size={16} color={waypoints.length === 0 ? '#9ca3af' : '#ef4444'} />
          </Pressable>
        </View>

        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>{totalDistance} nm</Text>
        </View>
      </View>

      {/* Waypoint Type Selector */}
      {isAddingWaypoint && (
        <View style={styles.typeSelector}>
          {(['start', 'waypoint', 'gate', 'finish'] as const).map((type) => (
            <Pressable
              key={type}
              onPress={() => setNextWaypointType(type)}
              style={[styles.typeButton, nextWaypointType === type && styles.typeButtonActive]}
            >
              <View style={[styles.typeIndicator, { backgroundColor: WAYPOINT_TYPE_COLORS[type] }]} />
              <Text style={[styles.typeButtonText, nextWaypointType === type && styles.typeButtonTextActive]}>
                {type}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Map */}
      <MLMap mapStyle={MAP_STYLE_URL} style={styles.map} onPress={handleMapPress}>
        <MLCamera
          ref={cameraRef}
          initialViewState={{ center: initialView.center, zoom: initialView.zoom }}
        />
        {polylineFeature ? (
          <MLGeoJSONSource id="route-polyline" data={polylineFeature}>
            <MLLayer
              id="route-polyline-layer"
              type="line"
              source="route-polyline"
              style={{
                lineColor: '#9333ea',
                lineWidth: 3,
                lineDasharray: [3, 1.5],
              }}
            />
          </MLGeoJSONSource>
        ) : null}
        {waypoints.map((wp, index) => (
          <MLMarker
            key={wp.id}
            id={`wp-${wp.id}`}
            lngLat={[wp.longitude, wp.latitude]}
          >
            <View
              style={[styles.marker, { backgroundColor: WAYPOINT_TYPE_COLORS[wp.type] }]}
              onTouchEnd={() => !isAddingWaypoint && startEditWaypoint(wp)}
            >
              <Text style={styles.markerText}>
                {wp.type === 'start'
                  ? 'S'
                  : wp.type === 'finish'
                    ? 'F'
                    : wp.type === 'gate'
                      ? 'G'
                      : index + 1}
              </Text>
            </View>
          </MLMarker>
        ))}
      </MLMap>

      {/* Waypoint List */}
      {waypoints.length > 0 && (
        <View style={styles.waypointList}>
          <Text style={styles.listTitle}>Route ({waypoints.length} waypoints)</Text>
          <ScrollView style={styles.listScroll} nestedScrollEnabled>
            {waypoints.map((wp, index) => (
              <View key={wp.id} style={styles.waypointItem}>
                <Text style={styles.waypointIndex}>{index + 1}.</Text>
                <View style={[styles.typeIndicator, { backgroundColor: WAYPOINT_TYPE_COLORS[wp.type] }]} />
                <Text style={[styles.typeName, { color: WAYPOINT_TYPE_COLORS[wp.type] }]}>
                  {wp.type.toUpperCase()}
                </Text>
                <Text style={styles.waypointName} numberOfLines={1}>{wp.name}</Text>

                <View style={styles.reorderButtons}>
                  <Pressable
                    onPress={() => moveWaypointUp(index)}
                    disabled={index === 0}
                    style={styles.reorderButton}
                  >
                    <ArrowUp size={14} color={index === 0 ? '#9ca3af' : '#64748b'} />
                  </Pressable>
                  <Pressable
                    onPress={() => moveWaypointDown(index)}
                    disabled={index === waypoints.length - 1}
                    style={styles.reorderButton}
                  >
                    <ArrowDown size={14} color={index === waypoints.length - 1 ? '#9ca3af' : '#64748b'} />
                  </Pressable>
                </View>

                <Pressable onPress={() => startEditWaypoint(wp)} style={styles.editButton}>
                  <Edit2 size={14} color="#64748b" />
                </Pressable>

                <Pressable onPress={() => removeWaypoint(wp.id)} style={styles.deleteButton}>
                  <Trash2 size={14} color="#ef4444" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Edit Modal */}
      <Modal
        visible={editingWaypoint !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingWaypoint(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Waypoint</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Waypoint name"
              style={styles.textInput}
              autoFocus
            />

            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeSelector}>
              {(['start', 'waypoint', 'gate', 'finish'] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setEditType(type)}
                  style={[styles.typeButton, editType === type && styles.typeButtonActive]}
                >
                  <View style={[styles.typeIndicator, { backgroundColor: WAYPOINT_TYPE_COLORS[type] }]} />
                  <Text style={[styles.typeButtonText, editType === type && styles.typeButtonTextActive]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditingWaypoint(null)}
                style={styles.cancelButton}
              >
                <X size={16} color="#64748B" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveEditWaypoint}
                disabled={!editName.trim()}
                style={[styles.saveButton, !editName.trim() && styles.saveButtonDisabled]}
              >
                <Check size={16} color="#fff" />
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Instructions */}
      {waypoints.length === 0 && !isAddingWaypoint && (
        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>
            Tap "Add" then tap on map to define your race route
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#faf5ff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9d5ff',
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3e8ff',
  },
  addButtonActive: {
    backgroundColor: '#9333ea',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c3aed',
  },
  addButtonTextActive: {
    color: '#fff',
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3e8ff',
  },
  iconButtonDisabled: {
    backgroundColor: '#f1f5f9',
  },
  distanceBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c3aed',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    backgroundColor: '#faf5ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9d5ff',
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    borderColor: '#c4b5fd',
    backgroundColor: '#f3e8ff',
  },
  typeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  typeButtonText: {
    fontSize: 11,
    textTransform: 'capitalize',
    color: '#64748b',
  },
  typeButtonTextActive: {
    color: '#7c3aed',
    fontWeight: '600',
  },
  map: {
    height: 300,
    width: '100%',
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  markerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  waypointList: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9d5ff',
    padding: 12,
  },
  listTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  listScroll: {
    maxHeight: 150,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  waypointIndex: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
    width: 20,
  },
  typeName: {
    fontSize: 10,
    fontWeight: '600',
    width: 56,
    marginRight: 8,
  },
  waypointName: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
  },
  reorderButtons: {
    flexDirection: 'row',
    marginRight: 8,
  },
  reorderButton: {
    padding: 4,
  },
  editButton: {
    padding: 4,
    marginRight: 4,
  },
  deleteButton: {
    padding: 4,
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  fallbackText: {
    fontSize: 14,
    color: '#64748b',
  },
  fallbackSubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9333ea',
  },
  instructions: {
    backgroundColor: '#faf5ff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9d5ff',
  },
  instructionsText: {
    fontSize: 12,
    color: '#7c3aed',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#9333ea',
  },
  saveButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default DistanceRouteMap;
