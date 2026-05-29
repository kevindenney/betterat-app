/**
 * ComposerWhereField — the WHERE slot inside PlusComposerV3Sheet.
 *
 * Two ways to set a place, both feeding one structured StepLocation:
 *   1. Type a name inline (quick, name-only — coords stay null).
 *   2. Tap "Find on map" (or submit the typed name) to open
 *      LocationMapPicker, which geocodes the name to map results AND
 *      lets you drop a pin by tapping the map. Confirming there returns
 *      { name, lat, lng } so the step lands with real coordinates.
 *
 * Editing the inline text after a pin is set keeps the existing coords
 * (so you can relabel "Port Shelter" → "Port Shelter start line" without
 * losing the location); use the map again to relocate.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { LocationMapPicker } from '@/components/races/LocationMapPicker';
import type { StepLocation } from '@/types/step-detail';

interface ComposerWhereFieldProps {
  value?: StepLocation;
  onChange: (next: StepLocation | undefined) => void;
  inputRef?: (node: TextInput | null) => void;
}

export function ComposerWhereField({ value, onChange, inputRef }: ComposerWhereFieldProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const hasCoords = value?.lat != null && value?.lng != null;
  const name = value?.name ?? '';

  const handleChangeText = useCallback(
    (text: string) => {
      if (!text.trim()) {
        onChange(undefined);
        return;
      }
      // Relabel in place: keep any coords already attached to this place.
      onChange({ ...(value ?? {}), name: text });
    },
    [onChange, value],
  );

  const handlePicked = useCallback(
    (picked: { name: string; lat: number; lng: number }) => {
      onChange({
        name: picked.name,
        lat: picked.lat,
        lng: picked.lng,
        venue_id: value?.venue_id,
      });
      setPickerVisible(false);
    },
    [onChange, value?.venue_id],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={name}
          onChangeText={handleChangeText}
          onSubmitEditing={() => {
            if (name.trim()) setPickerVisible(true);
          }}
          placeholder="Type a place, or pick on the map"
          placeholderTextColor={IOS_REGISTER.labelTertiary}
          returnKeyType="search"
          accessibilityLabel="Where"
        />
        <Pressable
          style={styles.mapBtn}
          onPress={() => setPickerVisible(true)}
          accessibilityLabel="Find on map"
          hitSlop={6}
        >
          <Ionicons name="map-outline" size={18} color={IOS_COLORS.systemBlue} />
        </Pressable>
      </View>

      {hasCoords ? (
        <Text style={styles.coords}>
          {value!.lat!.toFixed(4)}, {value!.lng!.toFixed(4)}
        </Text>
      ) : name.trim() ? (
        <Pressable onPress={() => setPickerVisible(true)} hitSlop={6}>
          <Text style={styles.findHint}>Tap to find “{name.trim()}” on the map →</Text>
        </Pressable>
      ) : null}

      <LocationMapPicker
        visible={pickerVisible}
        initialName={name}
        initialLocation={hasCoords ? { lat: value!.lat!, lng: value!.lng! } : null}
        onClose={() => setPickerVisible(false)}
        onSelectLocation={handlePicked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: IOS_REGISTER.label,
    minHeight: 26,
    paddingVertical: 0,
  },
  mapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
  },
  coords: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
  },
  findHint: {
    fontSize: 12,
    color: IOS_COLORS.systemBlue,
  },
});
