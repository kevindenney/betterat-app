/**
 * <CollaboratorRolePicker> — bottom-sheet menu for assigning a role to a
 * collaborator on the With card. Canonical §11 shows roles as inline pills
 * under each picker row; here we surface the same menu when the user taps an
 * existing chip on the Plan tab to change/clear the role.
 *
 * Roles are intentionally generic strings — the default set is sailing-flavoured
 * (helm/crew/foredeck/coach) plus a free-form "Other" option. Callers can pass
 * `options` to override per interest/domain.
 *
 * Canonical: docs/redesign/ios-register/library-tab-canonical.html §11
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';

export const DEFAULT_ROLE_OPTIONS = [
  'helm',
  'crew',
  'foredeck',
  'coach',
  'mentor',
];

interface CollaboratorRolePickerProps {
  visible: boolean;
  /** Name shown in the header so the user knows whose role they're editing. */
  collaboratorName: string;
  /** Current role string (lowercased) — '' means no role assigned. */
  currentRole?: string;
  /** Role options shown as quick-pick rows. Defaults to sailing roles. */
  options?: string[];
  onClose: () => void;
  /** Pass the new role string (or undefined to clear). */
  onSelect: (role: string | undefined) => void;
}

export function CollaboratorRolePicker({
  visible,
  collaboratorName,
  currentRole,
  options = DEFAULT_ROLE_OPTIONS,
  onClose,
  onSelect,
}: CollaboratorRolePickerProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');

  const handlePick = (role: string | undefined) => {
    onSelect(role);
    setCustomMode(false);
    setCustomText('');
    onClose();
  };

  const handleCustomSubmit = () => {
    const trimmed = customText.trim().toLowerCase();
    if (!trimmed) return;
    handlePick(trimmed);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.header} numberOfLines={1}>
            Role for {collaboratorName}
          </Text>
          {options.map((opt) => {
            const isActive = currentRole === opt;
            return (
              <Pressable
                key={opt}
                style={[styles.row, isActive && styles.rowActive]}
                onPress={() => handlePick(opt)}
              >
                <Text style={[styles.rowText, isActive && styles.rowTextActive]}>
                  {opt}
                </Text>
                {isActive ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={STEP_COLORS.accent}
                  />
                ) : null}
              </Pressable>
            );
          })}

          {customMode ? (
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customText}
                onChangeText={setCustomText}
                placeholder="Type a role…"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                autoFocus
                onSubmitEditing={handleCustomSubmit}
                returnKeyType="done"
                autoCapitalize="none"
              />
              <Pressable onPress={handleCustomSubmit} hitSlop={6}>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={STEP_COLORS.accent}
                />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.row}
              onPress={() => setCustomMode(true)}
            >
              <Text style={styles.rowSubtle}>Other…</Text>
            </Pressable>
          )}

          {currentRole ? (
            <Pressable
              style={[styles.row, styles.clearRow]}
              onPress={() => handlePick(undefined)}
            >
              <Text style={styles.clearText}>Clear role</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: IOS_SPACING.lg,
  },
  sheet: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  rowActive: {
    backgroundColor: 'rgba(0,122,255,0.06)',
  },
  rowText: {
    fontSize: 16,
    color: IOS_COLORS.label,
    textTransform: 'capitalize',
  },
  rowTextActive: {
    color: STEP_COLORS.accent,
    fontWeight: '600',
  },
  rowSubtle: {
    fontSize: 16,
    color: STEP_COLORS.accent,
  },
  clearRow: {
    borderBottomWidth: 0,
  },
  clearText: {
    fontSize: 15,
    color: IOS_COLORS.systemRed,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  customInput: {
    flex: 1,
    fontSize: 16,
    color: IOS_COLORS.label,
    padding: 0,
  },
});
