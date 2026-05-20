/**
 * <PlanWithCard> — canonical §11 "With whom will you do this?" card for the
 * Plan tab. Renders the chip strip + Add-people button, and owns the
 * <AddPeoplePicker> + <CollaboratorRolePicker> modal state so consumers can
 * drop it in without wiring picker mounts themselves.
 *
 * Persistence stays with the caller: pass `onChange` to receive the merged
 * collaborator list and write it through to step metadata.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import type { StepCollaborator } from '@/types/step-detail';
import { AddPeoplePicker } from './AddPeoplePicker';
import { CollaboratorRolePicker } from './CollaboratorRolePicker';

interface PlanWithCardProps {
  collaborators: StepCollaborator[];
  readOnly?: boolean;
  /** Called with the full merged list when the user confirms picker or edits roles. */
  onChange: (next: StepCollaborator[]) => void;
  /** Optional share affordance for off-platform collaborators. */
  onShareWithCollaborator?: (displayName: string) => void;
}

export function PlanWithCard({
  collaborators,
  readOnly,
  onChange,
  onShareWithCollaborator,
}: PlanWithCardProps) {
  const [showAddPeoplePicker, setShowAddPeoplePicker] = useState(false);
  const [roleEditing, setRoleEditing] = useState<StepCollaborator | null>(null);

  const handleSetRole = useCallback(
    (collabId: string, role: string | undefined) => {
      const updated = collaborators.map((c) =>
        c.id === collabId ? { ...c, role: role || undefined } : c,
      );
      onChange(updated);
    },
    [collaborators, onChange],
  );

  const handleRemove = useCallback(
    (collabId: string) => {
      onChange(collaborators.filter((c) => c.id !== collabId));
    },
    [collaborators, onChange],
  );

  const handleConfirmPicker = useCallback(
    (next: StepCollaborator[]) => {
      // AddPeoplePicker only knows about platform users. Preserve any external
      // (off-platform) collaborators we already had.
      const externals = collaborators.filter((c) => c.type === 'external');
      onChange([...next, ...externals]);
    },
    [collaborators, onChange],
  );

  const platformIds = collaborators
    .filter((c) => c.type === 'platform' && c.user_id)
    .map((c) => c.user_id as string);
  const platformRoles = Object.fromEntries(
    collaborators
      .filter((c) => c.type === 'platform' && c.user_id)
      .map((c) => [c.user_id as string, c.role]),
  );

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="people-outline" size={12} color={STEP_COLORS.secondaryLabel} />
        <Text style={styles.eyebrow}>With whom will you do this?</Text>
      </View>

      {collaborators.length > 0 ? (
        <View style={styles.chipContainer}>
          {collaborators.map((collab) => (
            <Pressable
              key={collab.id}
              onPress={readOnly ? undefined : () => setRoleEditing(collab)}
              accessibilityRole={readOnly ? undefined : 'button'}
              accessibilityLabel={
                collab.role
                  ? `Change ${collab.display_name}'s role (currently ${collab.role})`
                  : `Assign a role to ${collab.display_name}`
              }
              style={[
                styles.chip,
                collab.type === 'platform' ? styles.chipPlatform : styles.chipExternal,
              ]}
            >
              {collab.type === 'platform' ? (
                collab.avatar_emoji ? (
                  <Text style={styles.chipEmoji}>{collab.avatar_emoji}</Text>
                ) : (
                  <Ionicons name="person" size={14} color={STEP_COLORS.accent} />
                )
              ) : (
                <Ionicons name="person-outline" size={14} color={IOS_COLORS.secondaryLabel} />
              )}
              <Text
                style={[
                  styles.chipText,
                  collab.type === 'platform' ? styles.chipTextPlatform : styles.chipTextExternal,
                ]}
                numberOfLines={1}
              >
                {collab.display_name}
              </Text>
              {collab.role ? (
                <Text style={styles.roleTag} numberOfLines={1}>
                  {collab.role}
                </Text>
              ) : null}
              {collab.type === 'external' && !readOnly && onShareWithCollaborator && (
                <Pressable
                  onPress={() => onShareWithCollaborator(collab.display_name)}
                  hitSlop={6}
                  style={styles.sendBtn}
                >
                  <Ionicons name="send-outline" size={13} color={STEP_COLORS.accent} />
                </Pressable>
              )}
              {!readOnly && (
                <Pressable onPress={() => handleRemove(collab.id)} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color={IOS_COLORS.systemGray3} />
                </Pressable>
              )}
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>No collaborators yet.</Text>
      )}

      {!readOnly && (
        <Pressable style={styles.addBtn} onPress={() => setShowAddPeoplePicker(true)}>
          <Ionicons name="person-add-outline" size={18} color={STEP_COLORS.accent} />
          <Text style={styles.addText}>Add people</Text>
        </Pressable>
      )}

      <CollaboratorRolePicker
        visible={!!roleEditing}
        collaboratorName={roleEditing?.display_name ?? ''}
        currentRole={roleEditing?.role}
        onClose={() => setRoleEditing(null)}
        onSelect={(role) => {
          if (roleEditing) handleSetRole(roleEditing.id, role);
        }}
      />
      <AddPeoplePicker
        visible={showAddPeoplePicker}
        existingUserIds={platformIds}
        existingRoles={platformRoles}
        onClose={() => setShowAddPeoplePicker(false)}
        onConfirm={handleConfirmPicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: STEP_COLORS.secondaryLabel,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  chipPlatform: {
    backgroundColor: STEP_COLORS.accentLight,
  },
  chipExternal: {
    backgroundColor: IOS_COLORS.systemGray6,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  chipTextPlatform: {
    color: STEP_COLORS.accent,
  },
  chipTextExternal: {
    color: IOS_COLORS.label,
  },
  roleTag: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.2,
    textTransform: 'lowercase',
    marginLeft: 2,
  },
  sendBtn: {
    marginLeft: 2,
    padding: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.xs,
  },
  addText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
});
