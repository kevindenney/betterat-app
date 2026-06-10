/**
 * AddRacingAreaSheet
 *
 * Modal for proposing a new community racing area.
 * Submits via useCreateRacingArea (atlas_pois, kind='racing_area').
 * New areas start as "pending" and get verified after 3 community confirmations.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { useCreateRacingArea } from '@/hooks/useCreateRacingArea';
import { triggerHaptic } from '@/lib/haptics';

interface AddRacingAreaSheetProps {
  visible: boolean;
  venueId: string;
  onDismiss: () => void;
  onSuccess?: () => void;
}

export function AddRacingAreaSheet({
  visible,
  venueId,
  onDismiss,
  onSuccess,
}: AddRacingAreaSheetProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const createArea = useCreateRacingArea();

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
  }, []);

  const handleDismiss = useCallback(() => {
    resetForm();
    onDismiss();
  }, [resetForm, onDismiss]);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showAlert('Name Required', 'Please enter a name for the racing area.');
      return;
    }

    setSubmitting(true);
    try {
      await createArea.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
        venueId,
        // Default center coordinates — the area will be positioned at the venue
        // In a future iteration, users could pick a location on the map
        centerLat: 0,
        centerLng: 0,
      });

      triggerHaptic('notificationSuccess');
      resetForm();
      onDismiss();
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      showAlert('Error', message);
    } finally {
      setSubmitting(false);
    }
  }, [name, description, venueId, createArea, resetForm, onDismiss, onSuccess]);

  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleDismiss} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Propose Racing Area</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            hitSlop={8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  !canSubmit && styles.submitTextDisabled,
                ]}
              >
                Submit
              </Text>
            )}
          </Pressable>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Area Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Victoria Harbor, Port Shelter"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus
              returnKeyType="next"
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Brief description of this racing area..."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>

          {/* Info notice */}
          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={IOS_COLORS.systemBlue}
            />
            <Text style={styles.infoText}>
              New areas start as pending and become verified after 3 community
              confirmations from other sailors.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  cancelText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  submitTextDisabled: {
    color: IOS_COLORS.tertiaryLabel,
  },
  form: {
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.lg,
  },
  inputGroup: {
    gap: IOS_SPACING.xs,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 12,
    fontSize: 16,
    color: IOS_COLORS.label,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {},
    }),
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
});

export default AddRacingAreaSheet;
