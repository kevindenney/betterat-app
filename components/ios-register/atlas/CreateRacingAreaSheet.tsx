/**
 * CreateRacingAreaSheet — bottom sheet for drawing a user-defined
 * racing area. Used when the user long-presses on water in the Atlas
 * tab and their club / fleet isn't in BetterAt yet.
 *
 * The shape picker lets the user choose between a circle (good
 * default — "we race around here") and a rectangle (the more
 * realistic case — clubs publish bounded boxes). Rotation/bearing
 * for rectangles is deferred; v1 ships axis-aligned only.
 *
 * Saves via useCreateRacingArea; PostgrestError messages are surfaced
 * through showAlert so the user sees a concrete reason on failure.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import type { Polygon } from 'geojson';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useCreateRacingArea } from '@/hooks/useCreateRacingArea';
import { useUpdateRacingArea } from '@/hooks/useUpdateRacingArea';
import {
  shapeBoundingRadiusMeters,
  shapeToPolygon,
  type RacingAreaShape,
} from '@/lib/atlas-racing-area-shape';

export interface EditingRacingArea {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  /** Stored radius — used as initial slider value in circle mode. */
  radiusMeters: number | null;
  classesUsed: string[];
}

interface CreateRacingAreaSheetProps {
  visible: boolean;
  center: { lat: number; lng: number } | null;
  /** Optional pre-filled boat class — usually the user's primary class. */
  defaultBoatClass?: string | null;
  /**
   * When provided, the sheet enters EDIT mode: form is pre-filled with
   * the area's name/center/radius/classes, the save call UPDATEs by id
   * instead of INSERTing, and the eyebrow + button label reflect edit
   * intent.
   */
  editingArea?: EditingRacingArea | null;
  /**
   * In edit mode only: when provided, a "Move on map" link renders next
   * to the save button. Parent should close this sheet and enter the
   * tap-to-reposition flow with the supplied target.
   */
  onMoveOnMap?: (target: EditingRacingArea) => void;
  /**
   * Edit mode only: open the tap-to-trace flow where the user
   * replaces the area's simple circle/rectangle with a real polygon
   * by tapping vertices on the map.
   */
  onRetraceOnMap?: (target: EditingRacingArea) => void;
  /**
   * Pixels to push the sheet up from the bottom edge to clear floating
   * chrome like a tab bar. Matches the `bottomOffset` prop on Atlas's
   * other BottomSheet variants. Defaults to a safe iOS tab-bar height.
   */
  bottomOffset?: number;
  /**
   * Emits the current shape polygon (circle or rectangle) as the user
   * changes shape/size/center, so the parent can paint a live preview
   * on the map. Null when the sheet is closed or center is missing.
   */
  onShapeChange?: (polygon: Polygon | null) => void;
  onClose: () => void;
  onCreated?: (area: { id: string; name: string; lat: number; lng: number }) => void;
}

const DEFAULT_BOTTOM_OFFSET = 88;
const DEFAULT_RADIUS_METERS = 1500;
const DEFAULT_RECT_LENGTH_M = 2500;
const DEFAULT_RECT_WIDTH_M = 1500;

type ShapeKind = 'circle' | 'rectangle';

function formatMeters(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return km % 1 === 0 ? `${km} km` : `${km.toFixed(2)} km`;
}

/**
 * Suggested radii by class. Values reflect typical racing-area scale,
 * not exact course dimensions — Dragons race ~1nm legs (~1.85km area
 * diameter) and IRC offshore-style classes need much larger water.
 * Matching is case-insensitive substring so "International Dragon",
 * "Dragon HK", and "Dragon" all resolve.
 */
const CLASS_RADIUS_HINTS: { match: string; radius: number }[] = [
  { match: 'optimist', radius: 500 },
  { match: 'laser', radius: 750 },
  { match: 'ilca', radius: 750 },
  { match: '420', radius: 750 },
  { match: '470', radius: 750 },
  { match: '29er', radius: 750 },
  { match: '49er', radius: 1000 },
  { match: 'nacra', radius: 1500 },
  { match: 'dragon', radius: 1500 },
  { match: 'etchells', radius: 1500 },
  { match: 'sonar', radius: 1500 },
  { match: 'j/22', radius: 1500 },
  { match: 'j/24', radius: 1500 },
  { match: 'j/70', radius: 1500 },
  { match: 'j/80', radius: 2000 },
  { match: 'melges', radius: 1500 },
  { match: 'sportsboat', radius: 1500 },
  { match: 'irc', radius: 3000 },
  { match: 'orc', radius: 3000 },
  { match: 'hkpn', radius: 3000 },
  { match: 'cruiser', radius: 3000 },
  { match: 'j/111', radius: 3000 },
  { match: 'offshore', radius: 5000 },
  { match: 'distance', radius: 5000 },
  { match: 'volvo', radius: 5000 },
  { match: 'multihull', radius: 4000 },
];

function suggestRadiusFromClasses(text: string): number | null {
  const lower = text.toLowerCase();
  for (const hint of CLASS_RADIUS_HINTS) {
    if (lower.includes(hint.match)) return hint.radius;
  }
  return null;
}

export function CreateRacingAreaSheet({
  visible,
  center,
  defaultBoatClass,
  editingArea,
  onMoveOnMap,
  onRetraceOnMap,
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
  onShapeChange,
  onClose,
  onCreated,
}: CreateRacingAreaSheetProps) {
  const isEditing = Boolean(editingArea);
  const [name, setName] = useState('');
  const [shapeKind, setShapeKind] = useState<ShapeKind>('circle');
  const [radiusMeters, setRadiusMeters] = useState<number>(DEFAULT_RADIUS_METERS);
  const [rectLengthM, setRectLengthM] = useState<number>(DEFAULT_RECT_LENGTH_M);
  const [rectWidthM, setRectWidthM] = useState<number>(DEFAULT_RECT_WIDTH_M);
  const [classesText, setClassesText] = useState('');
  // Track whether the user has touched the slider. We auto-suggest a
  // class-appropriate radius while this is false; once they move the
  // slider their explicit choice wins, even if they then edit classes.
  const [sizeTouched, setSizeTouched] = useState(false);
  const createMutation = useCreateRacingArea();
  const updateMutation = useUpdateRacingArea();
  const mutationPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!visible) return;
    if (editingArea) {
      setName(editingArea.name);
      setShapeKind('circle');
      setRadiusMeters(editingArea.radiusMeters ?? DEFAULT_RADIUS_METERS);
      setRectLengthM(DEFAULT_RECT_LENGTH_M);
      setRectWidthM(DEFAULT_RECT_WIDTH_M);
      setClassesText(editingArea.classesUsed.join(', '));
      // Treat the existing radius as user-chosen so the class-based
      // auto-suggester doesn't overwrite it while they edit.
      setSizeTouched(true);
      return;
    }
    setName('');
    setShapeKind('circle');
    setRadiusMeters(DEFAULT_RADIUS_METERS);
    setRectLengthM(DEFAULT_RECT_LENGTH_M);
    setRectWidthM(DEFAULT_RECT_WIDTH_M);
    setClassesText(defaultBoatClass ?? '');
    setSizeTouched(false);
  }, [visible, defaultBoatClass, editingArea]);

  // Smart default: as the user types classes ("Dragon", "IRC", …),
  // snap the circle slider to a sensible radius. Only applies to the
  // circle shape — rectangle defaults are sailing-generic for v1.
  useEffect(() => {
    if (sizeTouched || shapeKind !== 'circle') return;
    const suggested = suggestRadiusFromClasses(classesText);
    if (suggested != null && suggested !== radiusMeters) {
      setRadiusMeters(suggested);
    }
  }, [classesText, sizeTouched, shapeKind, radiusMeters]);

  const handleRadiusChange = (value: number) => {
    setRadiusMeters(value);
    if (!sizeTouched) setSizeTouched(true);
  };
  const handleLengthChange = (value: number) => {
    setRectLengthM(value);
    if (!sizeTouched) setSizeTouched(true);
  };
  const handleWidthChange = (value: number) => {
    setRectWidthM(value);
    if (!sizeTouched) setSizeTouched(true);
  };

  // Compose the current shape — recomputed whenever shape kind, size,
  // or center change. Used for the live preview AND the save call so
  // what the user sees is exactly what gets persisted.
  const shape = useMemo<RacingAreaShape | null>(() => {
    if (!center) return null;
    if (shapeKind === 'circle') {
      return {
        kind: 'circle',
        centerLat: center.lat,
        centerLng: center.lng,
        radiusMeters,
      };
    }
    return {
      kind: 'rectangle',
      centerLat: center.lat,
      centerLng: center.lng,
      lengthMeters: rectLengthM,
      widthMeters: rectWidthM,
    };
  }, [center, shapeKind, radiusMeters, rectLengthM, rectWidthM]);

  // Mirror the polygon up to the parent for the on-map preview. Emits
  // null when the sheet is closed or center is missing, so stale
  // rings don't linger on the map after dismiss.
  useEffect(() => {
    if (!visible) {
      onShapeChange?.(null);
      return;
    }
    onShapeChange?.(shape ? shapeToPolygon(shape) : null);
  }, [visible, shape, onShapeChange]);

  const canSave = useMemo(
    () => name.trim().length > 0 && shape !== null && !mutationPending,
    [name, shape, mutationPending],
  );

  const handleSave = async () => {
    if (!shape) return;
    const classes = classesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const polygon = shapeKind === 'rectangle' ? shapeToPolygon(shape) : undefined;
    try {
      if (editingArea) {
        await updateMutation.mutateAsync({
          id: editingArea.id,
          name,
          centerLat: shape.centerLat,
          centerLng: shape.centerLng,
          radiusMeters: shapeBoundingRadiusMeters(shape),
          polygon,
          classesUsed: classes,
        });
        onCreated?.({
          id: editingArea.id,
          name: name.trim(),
          lat: shape.centerLat,
          lng: shape.centerLng,
        });
        onClose();
        return;
      }
      const area = await createMutation.mutateAsync({
        name,
        centerLat: shape.centerLat,
        centerLng: shape.centerLng,
        radiusMeters: shapeBoundingRadiusMeters(shape),
        polygon,
        classesUsed: classes,
      });
      onCreated?.({
        id: area.id,
        name: area.area_name,
        lat: area.center_lat,
        lng: area.center_lng,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save racing area';
      showAlert('Could not save', message);
    }
  };

  if (!visible) return null;

  const isCircle = shapeKind === 'circle';

  return (
    <View style={[styles.root, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>
            {isEditing ? 'EDIT RACING AREA' : 'NEW RACING AREA'}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={IOS_REGISTER.labelSecondary} />
          </Pressable>
        </View>
        <Text style={styles.title}>Racing area</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name (e.g. Middle Island)"
          placeholderTextColor={IOS_REGISTER.labelTertiary}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <View style={[styles.segmented, styles.fieldGap]}>
          <Pressable
            onPress={() => setShapeKind('circle')}
            style={[styles.segment, isCircle && styles.segmentActive]}
          >
            <Ionicons
              name="ellipse-outline"
              size={14}
              color={isCircle ? '#FFFFFF' : IOS_REGISTER.label}
            />
            <Text style={[styles.segmentText, isCircle && styles.segmentTextActive]}>
              Circle
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShapeKind('rectangle')}
            style={[styles.segment, !isCircle && styles.segmentActive]}
          >
            <Ionicons
              name="square-outline"
              size={14}
              color={!isCircle ? '#FFFFFF' : IOS_REGISTER.label}
            />
            <Text style={[styles.segmentText, !isCircle && styles.segmentTextActive]}>
              Rectangle
            </Text>
          </Pressable>
        </View>

        {isCircle ? (
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Size</Text>
              <Text style={styles.sizeValue}>{formatMeters(radiusMeters)}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={250}
              maximumValue={5000}
              step={250}
              value={radiusMeters}
              onValueChange={handleRadiusChange}
              minimumTrackTintColor={IOS_REGISTER.accentUserAction}
              maximumTrackTintColor={IOS_REGISTER.fillPill}
              thumbTintColor={IOS_REGISTER.accentUserAction}
            />
          </View>
        ) : (
          <>
            <View style={styles.sliderBlock}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Length (E–W)</Text>
                <Text style={styles.sizeValue}>{formatMeters(rectLengthM)}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={500}
                maximumValue={10000}
                step={250}
                value={rectLengthM}
                onValueChange={handleLengthChange}
                minimumTrackTintColor={IOS_REGISTER.accentUserAction}
                maximumTrackTintColor={IOS_REGISTER.fillPill}
                thumbTintColor={IOS_REGISTER.accentUserAction}
              />
            </View>
            <View style={styles.sliderBlock}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Width (N–S)</Text>
                <Text style={styles.sizeValue}>{formatMeters(rectWidthM)}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={250}
                maximumValue={6000}
                step={250}
                value={rectWidthM}
                onValueChange={handleWidthChange}
                minimumTrackTintColor={IOS_REGISTER.accentUserAction}
                maximumTrackTintColor={IOS_REGISTER.fillPill}
                thumbTintColor={IOS_REGISTER.accentUserAction}
              />
            </View>
          </>
        )}

        <TextInput
          value={classesText}
          onChangeText={setClassesText}
          placeholder="Boat classes — Dragon, Etchells, IRC"
          placeholderTextColor={IOS_REGISTER.labelTertiary}
          style={[styles.input, styles.fieldGap]}
          autoCapitalize="words"
          returnKeyType="done"
        />

        {isEditing && editingArea ? (
          <View style={styles.mapLinkRow}>
            {onMoveOnMap ? (
              <Pressable
                onPress={() => onMoveOnMap(editingArea)}
                style={({ pressed }) => [styles.moveOnMapLink, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Move on map"
              >
                <Ionicons name="move" size={14} color={IOS_REGISTER.accentUserAction} />
                <Text style={styles.moveOnMapLinkText}>Move on map</Text>
              </Pressable>
            ) : null}
            {onRetraceOnMap ? (
              <Pressable
                onPress={() => onRetraceOnMap(editingArea)}
                style={({ pressed }) => [styles.moveOnMapLink, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Trace actual shape on map"
              >
                <Ionicons name="create-outline" size={14} color={IOS_REGISTER.accentUserAction} />
                <Text style={styles.moveOnMapLinkText}>Trace actual shape</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable onPress={onClose} style={[styles.btn, styles.btnSecondary]} disabled={mutationPending}>
            <Text style={styles.btnSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.btn, styles.btnPrimary, !canSave && styles.btnDisabled]}
          >
            {mutationPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {isEditing ? 'Save changes' : 'Save area'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 1000,
    elevation: 24,
  },
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separatorStrong,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginTop: 2,
    marginBottom: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: IOS_REGISTER.label,
    backgroundColor: '#FFFFFF',
  },
  fieldGap: {
    marginTop: 8,
  },
  segmented: {
    flexDirection: 'row',
    gap: 6,
    padding: 3,
    borderRadius: 10,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  sliderBlock: {
    marginTop: 6,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
  },
  sizeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: 28,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  mapLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  moveOnMapLink: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(10, 132, 255, 0.10)',
  },
  moveOnMapLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: IOS_REGISTER.fillPill,
  },
  btnSecondaryText: {
    color: IOS_REGISTER.label,
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
