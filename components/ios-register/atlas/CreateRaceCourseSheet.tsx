/**
 * CreateRaceCourseSheet — bottom sheet for authoring a venue race course
 * from a single tapped point. The user picks a start-line center on the
 * water, dials in wind direction + line/leg geometry, and the sheet
 * derives committee/pin endpoints (buildCourseParams) and a full overlay
 * preview (venueCoursesToFeatureCollection) that the parent paints
 * ungated while the sheet is open.
 *
 * Saves via useCreateVenueRaceCourse, which persists CourseGeometryParams
 * as JSONB and invalidates both the venue-scoped and Atlas-overlay reads.
 * PostgrestError messages surface through showAlert.
 *
 * NOTE: committee/pin handedness about the wind axis is parametric and
 * still pending visual verification in the sim — see courseAuthoring.ts
 * + ATLAS_RACE_COURSE_GEOMETRY_SPEC §4.2.
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
import type { FeatureCollection } from 'geojson';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useCreateVenueRaceCourse } from '@/hooks/useCreateVenueRaceCourse';
import {
  buildCourseParams,
  DEFAULT_BOAT_LENGTH_M,
  DEFAULT_LEG_LENGTH_NM,
  DEFAULT_START_BOX_DEPTH_BOAT_LENGTHS,
  DEFAULT_START_LINE_LENGTH_M,
  DEFAULT_TACK_ANGLE_DEG,
} from '@/lib/courseAuthoring';
import { venueCoursesToFeatureCollection } from '@/lib/venueCourseGeoJSON';
import type { VenueRaceCourse } from '@/types/courses';

interface CreateRaceCourseSheetProps {
  visible: boolean;
  /** Start-line center the user tapped on the water. */
  center: { lat: number; lng: number } | null;
  /** Racing area this course belongs to (or venueId — at least one). */
  racingAreaId?: string | null;
  venueId?: string | null;
  /** Optional pre-filled boat class — usually the user's primary class. */
  defaultBoatClass?: string | null;
  /**
   * Initial WIND FROM value (degrees the wind blows from). Defaults to the
   * live observed wind at the area so the course starts oriented correctly —
   * windward upwind — rather than locked to due north. User can still dial it.
   */
  defaultWindDirectionDeg?: number;
  /** Pixels to push the sheet up to clear floating chrome (tab bar). */
  bottomOffset?: number;
  /**
   * Emits the derived overlay FeatureCollection as the user dials in
   * geometry, so the parent can paint a live (ungated) preview. Null
   * when the sheet is closed or center is missing.
   */
  onPreviewChange?: (collection: FeatureCollection | null) => void;
  onClose: () => void;
  onCreated?: (course: { id: string; name: string }) => void;
}

const DEFAULT_BOTTOM_OFFSET = 88;
const PREVIEW_COURSE_ID = '__preview__';

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function formatWind(deg: number): string {
  const idx = Math.round(deg / 45) % 8;
  return `${Math.round(deg)}° ${COMPASS_POINTS[idx]}`;
}
function formatMeters(m: number): string {
  return `${Math.round(m)} m`;
}
function formatNm(nm: number): string {
  return `${nm.toFixed(2)} nm`;
}

export function CreateRaceCourseSheet({
  visible,
  center,
  racingAreaId,
  venueId,
  defaultBoatClass,
  defaultWindDirectionDeg = 0,
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
  onPreviewChange,
  onClose,
  onCreated,
}: CreateRaceCourseSheetProps) {
  const [name, setName] = useState('');
  const [windDirectionDeg, setWindDirectionDeg] = useState(defaultWindDirectionDeg);
  const [startLineLengthM, setStartLineLengthM] = useState(DEFAULT_START_LINE_LENGTH_M);
  const [legLengthNm, setLegLengthNm] = useState(DEFAULT_LEG_LENGTH_NM);
  const [tackAngleDeg, setTackAngleDeg] = useState(DEFAULT_TACK_ANGLE_DEG);
  const [startBoxDepth, setStartBoxDepth] = useState(DEFAULT_START_BOX_DEPTH_BOAT_LENGTHS);
  const [classesText, setClassesText] = useState('');
  const createMutation = useCreateVenueRaceCourse();
  const mutationPending = createMutation.isPending;

  useEffect(() => {
    if (!visible) return;
    setName('');
    setWindDirectionDeg(defaultWindDirectionDeg);
    setStartLineLengthM(DEFAULT_START_LINE_LENGTH_M);
    setLegLengthNm(DEFAULT_LEG_LENGTH_NM);
    setTackAngleDeg(DEFAULT_TACK_ANGLE_DEG);
    setStartBoxDepth(DEFAULT_START_BOX_DEPTH_BOAT_LENGTHS);
    setClassesText(defaultBoatClass ?? '');
  }, [visible, defaultBoatClass, defaultWindDirectionDeg]);

  // Derive the course params + overlay preview. Recomputed whenever the
  // tapped center or any geometry dial changes, so the on-map preview is
  // exactly what gets persisted on save.
  const previewCollection = useMemo<FeatureCollection | null>(() => {
    if (!center) return null;
    const params = buildCourseParams({
      center,
      windDirectionDeg,
      startLineLengthM,
      legLengthNm,
      tackAngleDeg,
      boatLengthM: DEFAULT_BOAT_LENGTH_M,
      startBoxDepthBoatLengths: startBoxDepth,
    });
    const draft: VenueRaceCourse = {
      id: PREVIEW_COURSE_ID,
      racingAreaId: racingAreaId ?? null,
      venueId: venueId ?? null,
      name: name.trim() || 'New course',
      courseType: 'windward_leeward',
      geometry: params,
      classesUsed: [],
      isActive: true,
      createdBy: null,
    };
    return venueCoursesToFeatureCollection([draft]);
  }, [
    center,
    windDirectionDeg,
    startLineLengthM,
    legLengthNm,
    tackAngleDeg,
    startBoxDepth,
    racingAreaId,
    venueId,
    name,
  ]);

  // Mirror the preview up to the parent. Emits null when closed/no center
  // so a stale overlay doesn't linger after dismiss.
  useEffect(() => {
    if (!visible) {
      onPreviewChange?.(null);
      return;
    }
    onPreviewChange?.(previewCollection);
  }, [visible, previewCollection, onPreviewChange]);

  const canSave = useMemo(
    () => name.trim().length > 0 && center !== null && !mutationPending,
    [name, center, mutationPending],
  );

  const handleSave = async () => {
    if (!center) return;
    const classes = classesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const params = buildCourseParams({
      center,
      windDirectionDeg,
      startLineLengthM,
      legLengthNm,
      tackAngleDeg,
      boatLengthM: DEFAULT_BOAT_LENGTH_M,
      startBoxDepthBoatLengths: startBoxDepth,
    });
    try {
      const course = await createMutation.mutateAsync({
        name,
        racingAreaId: racingAreaId ?? null,
        venueId: venueId ?? null,
        geometry: params,
        classesUsed: classes,
      });
      onCreated?.({ id: course.id, name: course.name });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save race course';
      showAlert('Could not save', message);
    }
  };

  if (!visible) return null;

  return (
    <View style={[styles.root, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>NEW RACE COURSE</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={IOS_REGISTER.labelSecondary} />
          </Pressable>
        </View>
        <Text style={styles.title}>Race course</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name (e.g. Victoria Harbour — W/L)"
          placeholderTextColor={IOS_REGISTER.labelTertiary}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <View style={[styles.sliderBlock, styles.fieldGap]}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Wind from</Text>
            <Text style={styles.sizeValue}>{formatWind(windDirectionDeg)}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={359}
            step={1}
            value={windDirectionDeg}
            onValueChange={setWindDirectionDeg}
            minimumTrackTintColor={IOS_REGISTER.accentUserAction}
            maximumTrackTintColor={IOS_REGISTER.fillPill}
            thumbTintColor={IOS_REGISTER.accentUserAction}
          />
        </View>

        <View style={styles.sliderBlock}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Start line</Text>
            <Text style={styles.sizeValue}>{formatMeters(startLineLengthM)}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={50}
            maximumValue={500}
            step={10}
            value={startLineLengthM}
            onValueChange={setStartLineLengthM}
            minimumTrackTintColor={IOS_REGISTER.accentUserAction}
            maximumTrackTintColor={IOS_REGISTER.fillPill}
            thumbTintColor={IOS_REGISTER.accentUserAction}
          />
        </View>

        <View style={styles.sliderBlock}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Leg length</Text>
            <Text style={styles.sizeValue}>{formatNm(legLengthNm)}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0.25}
            maximumValue={2}
            step={0.05}
            value={legLengthNm}
            onValueChange={setLegLengthNm}
            minimumTrackTintColor={IOS_REGISTER.accentUserAction}
            maximumTrackTintColor={IOS_REGISTER.fillPill}
            thumbTintColor={IOS_REGISTER.accentUserAction}
          />
        </View>

        <View style={styles.sliderBlock}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Tack angle</Text>
            <Text style={styles.sizeValue}>{Math.round(tackAngleDeg)}°</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={30}
            maximumValue={55}
            step={1}
            value={tackAngleDeg}
            onValueChange={setTackAngleDeg}
            minimumTrackTintColor={IOS_REGISTER.accentUserAction}
            maximumTrackTintColor={IOS_REGISTER.fillPill}
            thumbTintColor={IOS_REGISTER.accentUserAction}
          />
        </View>

        <View style={styles.sliderBlock}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Start box depth</Text>
            <Text style={styles.sizeValue}>{Math.round(startBoxDepth)} boat lengths</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={2}
            maximumValue={10}
            step={1}
            value={startBoxDepth}
            onValueChange={setStartBoxDepth}
            minimumTrackTintColor={IOS_REGISTER.accentUserAction}
            maximumTrackTintColor={IOS_REGISTER.fillPill}
            thumbTintColor={IOS_REGISTER.accentUserAction}
          />
        </View>

        <TextInput
          value={classesText}
          onChangeText={setClassesText}
          placeholder="Boat classes — Dragon, Etchells"
          placeholderTextColor={IOS_REGISTER.labelTertiary}
          style={[styles.input, styles.fieldGap]}
          autoCapitalize="words"
          returnKeyType="done"
        />

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
              <Text style={styles.btnPrimaryText}>Save course</Text>
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
