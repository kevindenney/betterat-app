/**
 * SuggestStepSheet — Bottom sheet for blueprint authors to suggest
 * a step to a specific subscriber via notification.
 *
 * Three sources:
 *  1. "Blueprint" — curated steps from this blueprint
 *  2. "My Steps"  — all of the mentor's own timeline steps (any interest)
 *  3. "Create New" — build a fresh step title + description on the spot
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
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
import { useBlueprintSteps, useSuggestStepToSubscriber } from '@/hooks/useBlueprint';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type { TimelineStepRecord } from '@/types/timeline-steps';

const C = {
  bg: '#FFFFFF',
  card: '#F8F7F6',
  border: '#E5E4E1',
  accent: '#00897B',
  accentBg: 'rgba(0,137,123,0.08)',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  radius: 12,
} as const;

type Tab = 'blueprint' | 'my_steps' | 'create';

interface Props {
  visible: boolean;
  onClose: () => void;
  blueprintId: string;
  targetUserId: string;
  targetUserName: string;
  interestId?: string;
}

export function SuggestStepSheet({
  visible,
  onClose,
  blueprintId,
  targetUserId,
  targetUserName,
  interestId,
}: Props) {
  const { data: blueprintSteps } = useBlueprintSteps(blueprintId);
  const { data: mySteps } = useMyTimeline(null); // all interests
  const suggestMutation = useSuggestStepToSubscriber();

  const [tab, setTab] = useState<Tab>('blueprint');
  const [selectedStep, setSelectedStep] = useState<TimelineStepRecord | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  // Create-new state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Filter my steps by search
  const filteredMySteps = useMemo(() => {
    if (!mySteps) return [];
    if (!search.trim()) return mySteps;
    const q = search.toLowerCase();
    return mySteps.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q),
    );
  }, [mySteps, search]);

  const resetAndClose = useCallback(() => {
    setSelectedStep(null);
    setMessage('');
    setSearch('');
    setNewTitle('');
    setNewDescription('');
    setTab('blueprint');
    onClose();
  }, [onClose]);

  const handleSend = useCallback(async () => {
    if (tab === 'create') {
      if (!newTitle.trim()) return;
      try {
        await suggestMutation.mutateAsync({
          targetUserId,
          sourceStepId: null, // no source step — free-form coach suggestion
          stepTitle: newTitle.trim(),
          stepDescription: newDescription.trim() || undefined,
          interestId,
        });
        showAlert('Suggestion Sent', `"${newTitle.trim()}" suggested to ${targetUserName}`);
        resetAndClose();
      } catch {
        showAlert('Error', 'Failed to send suggestion. Please try again.');
      }
      return;
    }

    if (!selectedStep) return;
    try {
      await suggestMutation.mutateAsync({
        targetUserId,
        sourceStepId: selectedStep.id,
        stepTitle: selectedStep.title,
        stepDescription: selectedStep.description ?? undefined,
        interestId,
      });
      showAlert('Suggestion Sent', `"${selectedStep.title}" suggested to ${targetUserName}`);
      resetAndClose();
    } catch {
      showAlert('Error', 'Failed to send suggestion. Please try again.');
    }
  }, [tab, selectedStep, newTitle, newDescription, targetUserId, targetUserName, interestId, suggestMutation, resetAndClose]);

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    setSelectedStep(null);
    setSearch('');
  }, []);

  const canSend =
    tab === 'create' ? newTitle.trim().length > 0 : selectedStep != null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <Pressable style={styles.backdrop} onPress={resetAndClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Suggest a Step</Text>
            <Text style={styles.subtitle}>
              Recommend a step to {targetUserName}
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TabButton
              label="Blueprint"
              icon="layers-outline"
              active={tab === 'blueprint'}
              onPress={() => handleTabChange('blueprint')}
            />
            <TabButton
              label="My Steps"
              icon="person-outline"
              active={tab === 'my_steps'}
              onPress={() => handleTabChange('my_steps')}
            />
            <TabButton
              label="Create New"
              icon="add-circle-outline"
              active={tab === 'create'}
              onPress={() => handleTabChange('create')}
            />
          </View>

          {/* Tab content */}
          {tab === 'blueprint' && (
            <StepPicker
              steps={blueprintSteps ?? []}
              selected={selectedStep}
              onSelect={setSelectedStep}
              emptyText="No curated steps in this blueprint"
            />
          )}

          {tab === 'my_steps' && (
            <View style={styles.myStepsContainer}>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={C.labelLight} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search your steps..."
                  placeholderTextColor={C.labelLight}
                  {...Platform.select({ web: { style: [styles.searchInput, { outlineStyle: 'none' } as any] } })}
                />
              </View>
              <StepPicker
                steps={filteredMySteps}
                selected={selectedStep}
                onSelect={setSelectedStep}
                emptyText={search ? 'No steps match your search' : 'No steps in your timeline'}
              />
            </View>
          )}

          {tab === 'create' && (
            <View style={styles.createSection}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="e.g. Practice tacking drills"
                  placeholderTextColor={C.labelLight}
                  {...Platform.select({ web: { style: [styles.fieldInput, { outlineStyle: 'none' } as any] } })}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Description (optional)</Text>
                <TextInput
                  style={[styles.fieldInput, { minHeight: 72, textAlignVertical: 'top' }]}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="What should they focus on?"
                  placeholderTextColor={C.labelLight}
                  multiline
                  numberOfLines={3}
                  {...Platform.select({ web: { style: [styles.fieldInput, { minHeight: 72, textAlignVertical: 'top', outlineStyle: 'none' } as any] } })}
                />
              </View>
            </View>
          )}

          {/* Optional message (for blueprint/my steps tabs) */}
          {tab !== 'create' && selectedStep && (
            <View style={styles.messageSection}>
              <Text style={styles.messageLabel}>Message (optional)</Text>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Add a personal note..."
                placeholderTextColor={C.labelLight}
                multiline
                numberOfLines={2}
                {...Platform.select({ web: { style: [styles.messageInput, { outlineStyle: 'none' } as any] } })}
              />
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={resetAndClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sendBtn, !canSend && { opacity: 0.4 }]}
              onPress={handleSend}
              disabled={!canSend || suggestMutation.isPending}
            >
              {suggestMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.sendBtnText}>Send Suggestion</Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Ionicons
        name={icon as any}
        size={15}
        color={active ? C.accent : C.labelMid}
      />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StepPicker({
  steps,
  selected,
  onSelect,
  emptyText,
}: {
  steps: TimelineStepRecord[];
  selected: TimelineStepRecord | null;
  onSelect: (step: TimelineStepRecord | null) => void;
  emptyText: string;
}) {
  return (
    <ScrollView style={styles.stepList} contentContainerStyle={styles.stepListContent}>
      {steps.map((step) => {
        const isSelected = selected?.id === step.id;
        return (
          <Pressable
            key={step.id}
            style={[styles.stepOption, isSelected && styles.stepOptionSelected]}
            onPress={() => onSelect(isSelected ? null : step)}
          >
            <View style={styles.stepOptionContent}>
              <Text
                style={[styles.stepOptionTitle, isSelected && { color: C.accent }]}
                numberOfLines={1}
              >
                {step.title}
              </Text>
              {step.description ? (
                <Text style={styles.stepOptionDesc} numberOfLines={2}>
                  {step.description}
                </Text>
              ) : null}
            </View>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={20} color={C.accent} />
            )}
          </Pressable>
        );
      })}
      {steps.length === 0 && (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'web' ? 20 : 34,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.labelDark,
  },
  subtitle: {
    fontSize: 13,
    color: C.labelMid,
    marginTop: 4,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabActive: {
    backgroundColor: C.accentBg,
    borderColor: C.accent,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.labelMid,
  },
  tabTextActive: {
    color: C.accent,
  },

  // Step list
  stepList: {
    maxHeight: 260,
  },
  stepListContent: {
    padding: 12,
    gap: 8,
  },
  stepOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: C.radius,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  stepOptionSelected: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  stepOptionContent: {
    flex: 1,
    marginRight: 8,
  },
  stepOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.labelDark,
  },
  stepOptionDesc: {
    fontSize: 12,
    color: C.labelMid,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: C.labelLight,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // My Steps search
  myStepsContainer: {
    // wrapper for search + list
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.labelDark,
    padding: 0,
  },

  // Create new
  createSection: {
    padding: 16,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldInput: {
    fontSize: 14,
    color: C.labelDark,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
  },

  // Message
  messageSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.labelMid,
    marginBottom: 6,
  },
  messageInput: {
    fontSize: 14,
    color: C.labelDark,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 50,
    textAlignVertical: 'top',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: C.labelMid,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
