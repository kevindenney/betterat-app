/**
 * AddToBlueprintSheet — modal for adding a step to one of the user's blueprints.
 * Shows published blueprints as selectable cards with subscriber count and success state.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { STEP_COLORS } from '@/lib/step-theme';
import { useUserBlueprints, useAddStepToBlueprint } from '@/hooks/useBlueprint';
import type { BlueprintRecord } from '@/types/blueprint';

interface AddToBlueprintSheetProps {
  visible: boolean;
  stepId: string;
  stepTitle: string;
  onClose: () => void;
}

type SheetState = 'pick' | 'adding' | 'success' | 'error' | 'duplicate';

export function AddToBlueprintSheet({
  visible,
  stepId,
  stepTitle,
  onClose,
}: AddToBlueprintSheetProps) {
  const { data: userBlueprints, isLoading } = useUserBlueprints();
  const addStep = useAddStepToBlueprint();
  const [state, setState] = useState<SheetState>('pick');
  const [selectedBlueprint, setSelectedBlueprint] = useState<BlueprintRecord | null>(null);

  const published = (userBlueprints ?? []).filter((b) => b.is_published);

  const handleSelect = useCallback((blueprint: BlueprintRecord) => {
    setSelectedBlueprint(blueprint);
    setState('adding');
    addStep.mutate(
      { blueprintId: blueprint.id, stepId },
      {
        onSuccess: () => setState('success'),
        onError: (err) => {
          const msg = err?.message || '';
          if (msg.includes('duplicate') || msg.includes('unique')) {
            setState('duplicate');
          } else {
            setState('error');
          }
        },
      },
    );
  }, [addStep, stepId]);

  const handleClose = useCallback(() => {
    setState('pick');
    setSelectedBlueprint(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="book-outline" size={20} color={STEP_COLORS.accent} />
            <Text style={styles.headerTitle}>Add to Blueprint</Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={22} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        </View>

        {/* Step being added */}
        <View style={styles.stepPreview}>
          <Ionicons name="document-text-outline" size={16} color={STEP_COLORS.secondaryLabel} />
          <Text style={styles.stepPreviewText} numberOfLines={1}>
            {stepTitle || 'Untitled step'}
          </Text>
        </View>

        {/* Content */}
        {state === 'pick' && (
          <>
            {isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={STEP_COLORS.accent} />
              </View>
            ) : published.length === 0 ? (
              <View style={styles.centered}>
                <Ionicons name="book-outline" size={48} color={IOS_COLORS.systemGray3} />
                <Text style={styles.emptyTitle}>No Published Blueprints</Text>
                <Text style={styles.emptySubtitle}>
                  Publish a blueprint first, then you can add steps to it.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
              >
                <Text style={styles.pickLabel}>Select a blueprint</Text>
                {published.map((bp) => (
                  <Pressable
                    key={bp.id}
                    style={styles.blueprintCard}
                    onPress={() => handleSelect(bp)}
                  >
                    <View style={styles.blueprintIcon}>
                      <Ionicons name="book" size={22} color={STEP_COLORS.accent} />
                    </View>
                    <View style={styles.blueprintInfo}>
                      <Text style={styles.blueprintTitle} numberOfLines={1}>
                        {bp.title}
                      </Text>
                      <View style={styles.blueprintMeta}>
                        <Ionicons name="people-outline" size={12} color={IOS_COLORS.secondaryLabel} />
                        <Text style={styles.blueprintMetaText}>
                          {bp.subscriber_count} subscriber{bp.subscriber_count !== 1 ? 's' : ''}
                        </Text>
                        {bp.access_level !== 'public' && (
                          <>
                            <Ionicons
                              name={bp.access_level === 'org_members' ? 'business-outline' : 'lock-closed-outline'}
                              size={12}
                              color={IOS_COLORS.secondaryLabel}
                              style={{ marginLeft: 8 }}
                            />
                            <Text style={styles.blueprintMetaText}>
                              {bp.access_level === 'org_members' ? 'Org' : 'Paid'}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color={STEP_COLORS.accent} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {state === 'adding' && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={STEP_COLORS.accent} />
            <Text style={styles.addingText}>Adding step...</Text>
          </View>
        )}

        {state === 'success' && selectedBlueprint && (
          <View style={styles.centered}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={56} color={STEP_COLORS.accent} />
            </View>
            <Text style={styles.successTitle}>Added to Blueprint</Text>
            <Text style={styles.successSubtitle}>
              This step is now part of{'\n'}
              <Text style={styles.successBlueprintName}>{selectedBlueprint.title}</Text>
            </Text>
            {selectedBlueprint.subscriber_count > 0 && (
              <View style={styles.subscriberNote}>
                <Ionicons name="people" size={14} color={IOS_COLORS.systemBlue} />
                <Text style={styles.subscriberNoteText}>
                  {selectedBlueprint.subscriber_count} subscriber{selectedBlueprint.subscriber_count !== 1 ? 's' : ''} will see this step
                </Text>
              </View>
            )}
            <Pressable style={styles.doneButton} onPress={handleClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        )}

        {state === 'duplicate' && selectedBlueprint && (
          <View style={styles.centered}>
            <View style={styles.duplicateIcon}>
              <Ionicons name="information-circle" size={56} color={IOS_COLORS.systemOrange} />
            </View>
            <Text style={styles.successTitle}>Already in Blueprint</Text>
            <Text style={styles.successSubtitle}>
              This step is already part of{'\n'}
              <Text style={styles.successBlueprintName}>{selectedBlueprint.title}</Text>
            </Text>
            <Pressable style={styles.doneButton} onPress={handleClose}>
              <Text style={styles.doneButtonText}>OK</Text>
            </Pressable>
          </View>
        )}

        {state === 'error' && (
          <View style={styles.centered}>
            <Ionicons name="alert-circle" size={56} color={IOS_COLORS.systemRed} />
            <Text style={styles.successTitle}>Something Went Wrong</Text>
            <Text style={styles.successSubtitle}>
              Couldn't add step to blueprint. Please try again.
            </Text>
            <Pressable
              style={[styles.doneButton, { backgroundColor: IOS_COLORS.systemBlue }]}
              onPress={() => setState('pick')}
            >
              <Text style={styles.doneButtonText}>Try Again</Text>
            </Pressable>
          </View>
        )}
      </View>
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
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_COLORS.label,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: 'rgba(61,138,90,0.06)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  stepPreviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.label,
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  emptySubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
  pickLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  blueprintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  blueprintIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(61,138,90,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueprintInfo: {
    flex: 1,
    gap: 3,
  },
  blueprintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  blueprintMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  blueprintMetaText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  addingText: {
    fontSize: 15,
    color: STEP_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  successIcon: {
    marginBottom: 4,
  },
  duplicateIcon: {
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
  },
  successBlueprintName: {
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  subscriberNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,122,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  subscriberNoteText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
  doneButton: {
    backgroundColor: STEP_COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: IOS_SPACING.md,
    minWidth: 120,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
