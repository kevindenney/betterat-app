/**
 * CreateRacingAreaSheet — bottom sheet for drawing a user-defined
 * racing area. Used when the user long-presses on water in the Atlas
 * tab and their club / fleet isn't in BetterAt yet.
 *
 * Inputs are intentionally minimal:
 *   - Name (required) — e.g. "Middle Island"
 *   - Radius — three coarse chips (½ km / 1.5 km / 3 km). Fine geometry
 *     editing belongs to a later, polygon-aware flow.
 *   - Classes (free text, comma-separated) — prefilled with the user's
 *     primary boat class when available. Free-text is intentional:
 *     dragon fleets won't wait for a curated taxonomy to coalesce.
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

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useCreateRacingArea } from '@/hooks/useCreateRacingArea';

interface CreateRacingAreaSheetProps {
  visible: boolean;
  center: { lat: number; lng: number } | null;
  /** Optional pre-filled boat class — usually the user's primary class. */
  defaultBoatClass?: string | null;
  onClose: () => void;
  onCreated?: (area: { id: string; name: string; lat: number; lng: number }) => void;
}

const RADIUS_OPTIONS: { label: string; meters: number }[] = [
  { label: '½ km', meters: 500 },
  { label: '1.5 km', meters: 1500 },
  { label: '3 km', meters: 3000 },
];

export function CreateRacingAreaSheet({
  visible,
  center,
  defaultBoatClass,
  onClose,
  onCreated,
}: CreateRacingAreaSheetProps) {
  const [name, setName] = useState('');
  const [radiusMeters, setRadiusMeters] = useState<number>(1500);
  const [classesText, setClassesText] = useState('');
  const mutation = useCreateRacingArea();

  // Reset fields whenever the sheet opens. The center coord is the
  // identity of this draft — when the user dismisses and re-opens at
  // a different long-press location, nothing should leak across.
  useEffect(() => {
    if (visible) {
      setName('');
      setRadiusMeters(1500);
      setClassesText(defaultBoatClass ?? '');
    }
  }, [visible, defaultBoatClass]);

  const canSave = useMemo(
    () => name.trim().length > 0 && center !== null && !mutation.isPending,
    [name, center, mutation.isPending],
  );

  const handleSave = async () => {
    if (!center) return;
    const classes = classesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    try {
      const area = await mutation.mutateAsync({
        name,
        centerLat: center.lat,
        centerLng: center.lng,
        radiusMeters,
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

  return (
    <View style={styles.root} pointerEvents="box-none">
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
          Drop a circle so other sailors find this area. You can refine later.
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

        <Text style={styles.fieldLabel}>Size</Text>
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((opt) => {
            const selected = opt.meters === radiusMeters;
            return (
              <Pressable
                key={opt.meters}
                onPress={() => setRadiusMeters(opt.meters)}
                style={[styles.radiusChip, selected && styles.radiusChipSelected]}
              >
                <Text style={[styles.radiusChipText, selected && styles.radiusChipTextSelected]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 24,
    // Stacks above the empty-state BottomSheet ("Anchor your next
    // step to a place") which renders later in the AtlasScreen JSX
    // tree and would otherwise paint on top.
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
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
  },
  radiusChipSelected: {
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  radiusChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  radiusChipTextSelected: {
    color: '#FFFFFF',
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
