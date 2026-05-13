/**
 * AddRaceBottomSheet Component
 *
 * Modal bottom sheet for selecting how to add races
 * Consolidates the two FAB buttons into one clear menu
 */

import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, colors, Shadows } from '@/constants/designSystem';

interface AddRaceOption {
  id: 'ai-quick' | 'manual' | 'import-csv';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

interface AddRaceBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (optionId: 'ai-quick' | 'manual' | 'import-csv') => void;
}

const options: AddRaceOption[] = [
  {
    id: 'ai-quick',
    icon: 'sparkles',
    title: 'Quick Add',
    description: 'Paste race details or upload a PDF — we\'ll extract info',
    color: colors.ai[600],
  },
  {
    id: 'manual',
    icon: 'create-outline',
    title: 'Add Manually',
    description: 'Fill out race details yourself',
    color: colors.primary[600],
  },
  {
    id: 'import-csv',
    icon: 'calendar-outline',
    title: 'Import Calendar (CSV)',
    description: 'Bulk upload multiple races from a CSV file',
    color: colors.success[600],
  },
];

export const AddRaceBottomSheet: React.FC<AddRaceBottomSheetProps> = ({
  visible,
  onClose,
  onSelect,
}) => {
  const handleSelect = (optionId: 'ai-quick' | 'manual' | 'import-csv') => {
    onSelect(optionId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Title */}
          <Text style={styles.title}>Add Races</Text>
          <Text style={styles.subtitle}>Choose how you'd like to add races</Text>

          {/* Options */}
          {options.map((option) => (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
              onPress={() => handleSelect(option.id)}
            >
              <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
                <Ionicons name={option.icon} size={24} color={option.color} />
              </View>

              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </Pressable>
          ))}

          {/* Cancel button */}
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelButtonPressed,
            ]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: BorderRadius.xlarge,
    borderTopRightRadius: BorderRadius.xlarge,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    ...Shadows.large,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.medium,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    color: colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: colors.text.secondary,
    marginBottom: Spacing.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.sm,
  },
  optionPressed: {
    opacity: 0.7,
    backgroundColor: colors.background.tertiary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.bodyBold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  optionDescription: {
    ...Typography.caption,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  cancelButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelButtonPressed: {
    opacity: 0.7,
  },
  cancelText: {
    ...Typography.bodyBold,
    color: colors.text.secondary,
  },
});
