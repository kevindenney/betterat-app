/**
 * MeasurementCaptureModal — manual structured-measurement entry for the Do tab.
 *
 * Writes a generic label / value / unit triple that the controller wraps as a
 * PerformanceMeasurement into metadata.act.measurements.extracted[]. Preset
 * chips (per interest) prefill the label + unit so common metrics are one tap.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IOS_BLUE = '#007AFF';
const GRAY_5 = '#E5E5EA';
const GRAY_6 = '#F2F2F7';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';

export interface MeasurementInput {
  label: string;
  value: number;
  unit?: string;
  note?: string;
}

interface Preset {
  label: string;
  unit?: string;
}

const MEASUREMENT_PRESETS_BY_SLUG: Record<string, Preset[]> = {
  sailing: [
    { label: 'Boat speed', unit: 'kn' },
    { label: 'Wind speed', unit: 'kn' },
    { label: 'Heart rate', unit: 'bpm' },
    { label: 'Heel angle', unit: '°' },
  ],
  golf: [
    { label: 'Drive distance', unit: 'yds' },
    { label: 'Putts', unit: '' },
    { label: 'Fairways hit', unit: '' },
  ],
  fitness: [
    { label: 'Weight', unit: 'lbs' },
    { label: 'Reps', unit: '' },
    { label: 'Distance', unit: 'mi' },
  ],
  entrepreneur: [
    { label: 'Revenue', unit: '$' },
    { label: 'Units sold', unit: '' },
    { label: 'Leads', unit: '' },
  ],
};

const DEFAULT_PRESETS: Preset[] = [
  { label: 'Time', unit: 's' },
  { label: 'Count', unit: '' },
];

export interface MeasurementCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: MeasurementInput) => void;
  interestSlug?: string | null;
}

export function MeasurementCaptureModal({
  visible,
  onClose,
  onSubmit,
  interestSlug,
}: MeasurementCaptureModalProps) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');

  // Reset fields each time the sheet opens so a prior entry doesn't linger.
  useEffect(() => {
    if (visible) {
      setLabel('');
      setValue('');
      setUnit('');
      setNote('');
    }
  }, [visible]);

  const presets = useMemo(() => {
    const slug = (interestSlug ?? '').toLowerCase();
    return MEASUREMENT_PRESETS_BY_SLUG[slug] ?? DEFAULT_PRESETS;
  }, [interestSlug]);

  const numericValue = Number(value);
  const canSave = label.trim().length > 0 && value.trim().length > 0 && Number.isFinite(numericValue);

  const handleSave = () => {
    if (!canSave) return;
    onSubmit({
      label: label.trim(),
      value: numericValue,
      unit: unit.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close measurement" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add a measurement</Text>

          {presets.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetRow}
            >
              {presets.map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => {
                    setLabel(p.label);
                    setUnit(p.unit ?? '');
                  }}
                  style={({ pressed }) => [styles.presetChip, pressed && styles.pressed]}
                >
                  <Text style={styles.presetChipText}>{p.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <Text style={styles.fieldLabel}>What</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Boat speed"
            placeholderTextColor={LABEL_3}
            style={styles.input}
            returnKeyType="next"
          />

          <View style={styles.row}>
            <View style={styles.flex2}>
              <Text style={styles.fieldLabel}>Value</Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder="0"
                placeholderTextColor={LABEL_3}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.fieldLabel}>Unit</Text>
              <TextInput
                value={unit}
                onChangeText={setUnit}
                placeholder="kn"
                placeholderTextColor={LABEL_3}
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Context for this number"
            placeholderTextColor={LABEL_3}
            style={styles.input}
          />

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
              pressed && canSave && styles.pressed,
            ]}
          >
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Save measurement</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: GRAY_5,
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: LABEL,
    marginBottom: 10,
  },
  presetRow: {
    gap: 8,
    paddingBottom: 12,
  },
  presetChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: GRAY_6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: LABEL_2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: LABEL_3,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    fontSize: 15,
    color: LABEL,
    backgroundColor: GRAY_6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  flex2: {
    flex: 2,
  },
  flex1: {
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: IOS_BLUE,
  },
  saveButtonDisabled: {
    backgroundColor: '#B0CFFF',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
});

export default MeasurementCaptureModal;
