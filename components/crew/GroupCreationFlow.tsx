/**
 * GroupCreationFlow - Multi-step flow for creating a group chat
 *
 * Step 1: Select members (ContactPicker in multi-select mode)
 * Step 2: Name the group and pick an emoji
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { ContactPicker } from './ContactPicker';
import { CrewThreadService } from '@/services/CrewThreadService';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

// =============================================================================
// TYPES
// =============================================================================

interface GroupCreationFlowProps {
  onCreated: (threadId: string) => void;
  onBack: () => void;
  onClose: () => void;
  initialName?: string;
  initialEmoji?: string;
}

type Step = 'members' | 'details';

// =============================================================================
// EMOJI PICKER
// =============================================================================

const EMOJI_OPTIONS = ['⛵', '🚤', '🛥️', '🚀', '⚓', '🏆', '🎯', '💬', '👥', '🌊'];

function EmojiPicker({
  selectedEmoji,
  onSelect,
}: {
  selectedEmoji: string;
  onSelect: (emoji: string) => void;
}) {
  return (
    <View style={styles.emojiGrid}>
      {EMOJI_OPTIONS.map((emoji) => (
        <Pressable
          key={emoji}
          style={[
            styles.emojiOption,
            selectedEmoji === emoji && styles.emojiOptionSelected,
          ]}
          onPress={() => onSelect(emoji)}
        >
          <Text style={styles.emojiText}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// =============================================================================
// GROUP DETAILS STEP
// =============================================================================

function GroupDetailsStep({
  memberCount,
  onBack,
  onClose,
  onCreate,
  isCreating,
  initialName = '',
  initialEmoji = '⛵',
}: {
  memberCount: number;
  onBack: () => void;
  onClose: () => void;
  onCreate: (name: string, emoji: string) => void;
  isCreating: boolean;
  initialName?: string;
  initialEmoji?: string;
}) {
  const [groupName, setGroupName] = useState(initialName);
  const [selectedEmoji, setSelectedEmoji] = useState(initialEmoji);

  const handleCreate = useCallback(() => {
    if (!groupName.trim()) {
      showAlert('Error', 'Please enter a group name');
      return;
    }
    Keyboard.dismiss();
    onCreate(groupName.trim(), selectedEmoji);
  }, [groupName, selectedEmoji, onCreate]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={onBack}
        >
          <ChevronLeft size={24} color={IOS_COLORS.systemBlue} />
        </Pressable>

        <Text style={styles.headerTitle}>New Group</Text>

        <Pressable
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
          onPress={onClose}
        >
          <X size={20} color={IOS_COLORS.secondaryLabel} />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.detailsContent}>
        {/* Member count */}
        <View style={styles.memberCountBadge}>
          <Text style={styles.memberCountText}>
            {memberCount} member{memberCount !== 1 ? 's' : ''} selected
          </Text>
        </View>

        {/* Emoji selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose an icon</Text>
          <EmojiPicker
            selectedEmoji={selectedEmoji}
            onSelect={setSelectedEmoji}
          />
        </View>

        {/* Group name input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Group name</Text>
          <TextInput
            style={styles.textInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="e.g., Saturday Crew, Race Team"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            maxLength={50}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </View>

        {/* Create button */}
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            (!groupName.trim() || isCreating) && styles.createButtonDisabled,
            pressed && groupName.trim() && !isCreating && styles.createButtonPressed,
          ]}
          onPress={handleCreate}
          disabled={!groupName.trim() || isCreating}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>Create Group</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GroupCreationFlow({
  onCreated,
  onBack,
  onClose,
  initialName,
  initialEmoji,
}: GroupCreationFlowProps) {
  const [step, setStep] = useState<Step>('members');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleMembersNext = useCallback((userIds: string[]) => {
    setSelectedUserIds(userIds);
    setStep('details');
  }, []);

  const handleDetailsBack = useCallback(() => {
    setStep('members');
  }, []);

  const handleCreate = useCallback(
    async (name: string, emoji: string) => {
      setIsCreating(true);
      const thread = await CrewThreadService.createThread({
        name,
        avatarEmoji: emoji,
        threadType: 'group',
        memberIds: selectedUserIds,
      });
      setIsCreating(false);

      if (thread) {
        onCreated(thread.id);
      } else {
        showAlert('Error', 'Could not create group');
      }
    },
    [selectedUserIds, onCreated]
  );

  if (step === 'details') {
    return (
      <GroupDetailsStep
        memberCount={selectedUserIds.length}
        onBack={handleDetailsBack}
        onClose={onClose}
        onCreate={handleCreate}
        isCreating={isCreating}
        initialName={initialName}
        initialEmoji={initialEmoji}
      />
    );
  }

  return (
    <ContactPicker
      mode="multi"
      title="Add Members"
      onSelect={() => {}} // Not used in multi mode
      onBack={onBack}
      onClose={onClose}
      onSelectionChange={setSelectedUserIds}
      initialSelected={selectedUserIds}
      showNextButton
      onNext={handleMembersNext}
    />
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: IOS_SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  backButton: {
    padding: IOS_SPACING.sm,
    borderRadius: IOS_RADIUS.full,
  },
  backButtonPressed: {
    backgroundColor: IOS_COLORS.quaternarySystemFill,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  closeButton: {
    padding: IOS_SPACING.sm,
    borderRadius: IOS_RADIUS.full,
  },
  closeButtonPressed: {
    backgroundColor: IOS_COLORS.quaternarySystemFill,
  },

  // Details content
  detailsContent: {
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.lg,
  },

  memberCountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: IOS_COLORS.systemBlue,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.xs,
    borderRadius: IOS_RADIUS.lg,
  },
  memberCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  section: {
    gap: IOS_SPACING.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Emoji picker
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.sm,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionSelected: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  emojiText: {
    fontSize: 24,
  },

  // Text input
  textInput: {
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: IOS_RADIUS.md,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 12,
    fontSize: 16,
    color: IOS_COLORS.label,
  },

  // Create button
  createButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: IOS_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: IOS_SPACING.md,
  },
  createButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray3,
  },
  createButtonPressed: {
    opacity: 0.9,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default GroupCreationFlow;
