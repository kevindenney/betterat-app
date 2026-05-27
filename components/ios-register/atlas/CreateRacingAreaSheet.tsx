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
import {
  shapeBoundingRadiusMeters,
  shapeToPolygon,
  type RacingAreaShape,
} from '@/lib/atlas-racing-area-shape';

interface CreateRacingAreaSheetProps {
  visible: boolean;
  center: { lat: number; lng: number } | null;
  /** Optional pre-filled boat class — usually the user's primary class. */
  defaultBoatClass?: string | null;
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
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
  onShapeChange,
  onClose,
  onCreated,
}: CreateRacingAreaSheetProps) {
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
  const mutation = useCreateRacingArea();

  useEffect(() => {
    if (visible) {
      setName('');
      setShapeKind('circle');
      setRadiusMeters(DEFAULT_RADIUS_METERS);
      setRectLengthM(DEFAULT_RECT_LENGTH_M);
      setRectWidthM(DEFAULT_RECT_WIDTH_M);
      setClassesText(defaultBoatClass ?? '');
      setSizeTouched(false);
    }
  }, [visible, defaultBoatClass]);

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
    () => name.trim().length > 0 && shape !== null && !mutation.isPending,
    [name, shape, mutation.isPending],
  );

  const handleSave = async () => {
    if (!shape) return;
    const classes = classesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    try {
      const polygon = shapeKind === 'rectangle' ? shapeToPolygon(shape) : undefined;
      const area = await mutation.mutateAsync({
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
          <Text style={styles.eyebrow}>NEW RACING AREA</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={IOS_REGISTER.labelSecondary} />
          </Pressable>
        </View>
        <Text style={styles.title}>Draw where racing happens</Text>
        <Text style={styles.subtitle}>
          Long-press a different spot on the map to move the area. Refine size + shape below.
        </Text>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Middle Island"
          placeholderTextColor={IOS_REGISTER.labelTertiary}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Text style={styles.fieldLabel}>Shape</Text>
        <View style={styles.segmented}>
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
          <>
            <View style={styles.sizeHeaderRow}>
              <Text style={styles.fieldLabel}>Size</Text>
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
            <View style={styles.sizeScaleRow}>
              <Text style={styles.sizeScaleLabel}>Dinghy</Text>
              <Text style={styles.sizeScaleLabel}>Keelboat</Text>
              <Text style={styles.sizeScaleLabel}>Offshore</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.sizeHeaderRow}>
              <Text style={styles.fieldLabel}>Length (E–W)</Text>
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
            <View style={styles.sizeHeaderRow}>
              <Text style={styles.fieldLabel}>Width (N–S)</Text>
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
            <Text style={styles.hint}>
              Axis-aligned for now. Rotation to wind axis coming soon.
            </Text>
          </>
        )}

        <Text style={styles.fieldLabel}>Boat classes</Text>
        <TextInput
          value={classesText}
          onChangeText={setClassesText}
          placeholder="Dragon, Etchells, IRC"
          placeholderTextColor={IOS_REGISTER.labelTertiary}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="done"
        />
        <Text style={styles.hint}>Comma-separated. Used to show this area to the right sailors.</Text>

        <View style={styles.actionsRow}>
          <Pressable onPress={onClose} style={[styles.btn, styles.btnSecondary]} disabled={mutation.isPending}>
            <Text style={styles.btnSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.btn, styles.btnPrimary, !canSave && styles.btnDisabled]}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnPrimaryText}>Save area</Text>
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
    padding: 18,
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
    marginBottom: 12,
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
    fontSize: 20,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginTop: 6,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: IOS_REGISTER.label,
    backgroundColor: '#FFFFFF',
  },
  hint: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 4,
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
    paddingVertical: 8,
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
  sizeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 10,
    marginBottom: 4,
  },
  sizeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: 32,
  },
  sizeScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  sizeScaleLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: IOS_REGISTER.labelTertiary,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
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
