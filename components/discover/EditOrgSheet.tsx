/**
 * EditOrgSheet — admin edits to name, kind, join mode, description.
 *
 * Owner-only modal mirroring CreateOrgSheet's UX so the form feels familiar.
 * Submit calls useUpdateOrg. RLS gates the actual UPDATE.
 *
 * State init uses the snapshot-via-ref pattern from CreateOrgSheet — caller-
 * passed props are NOT in the effect deps, so the user's in-progress edits
 * can't be clobbered by parent re-renders. See
 * feedback_useeffect_array_prop_deps memory.
 */

import React, { useMemo, useRef, useState } from 'react';
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

import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useUpdateOrg } from '@/hooks/useOrgManagement';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  SELF_SERVE_ORG_KINDS,
  SELF_SERVE_ORG_KIND_LABELS,
  type OrganizationJoinMode,
  type SelfServeOrgKind,
} from '@/types/organization';

interface EditOrgSheetProps {
  visible: boolean;
  orgId: string;
  initial: {
    name: string;
    kind: SelfServeOrgKind | string;
    joinMode: OrganizationJoinMode | string;
    description?: string | null;
  };
  onClose: () => void;
  onSaved?: () => void;
}

const JOIN_MODE_OPTIONS: {
  value: OrganizationJoinMode;
  label: string;
  hint: string;
}[] = [
  { value: 'open_join', label: 'Open', hint: 'Anyone can join immediately' },
  {
    value: 'request_to_join',
    label: 'Request to join',
    hint: 'You approve each new member',
  },
  {
    value: 'invite_only',
    label: 'Invite only',
    hint: 'Members join only via your invite',
  },
];

function normalizeKind(value: string | SelfServeOrgKind): SelfServeOrgKind {
  return (SELF_SERVE_ORG_KINDS as readonly string[]).includes(value as string)
    ? (value as SelfServeOrgKind)
    : 'other';
}

function normalizeJoinMode(value: string | OrganizationJoinMode): OrganizationJoinMode {
  if (
    value === 'open_join' ||
    value === 'request_to_join' ||
    value === 'invite_only'
  ) {
    return value;
  }
  return 'request_to_join';
}

export function EditOrgSheet({
  visible,
  orgId,
  initial,
  onClose,
  onSaved,
}: EditOrgSheetProps) {
  const updateOrg = useUpdateOrg();

  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState<SelfServeOrgKind>(normalizeKind(initial.kind));
  const [joinMode, setJoinMode] = useState<OrganizationJoinMode>(
    normalizeJoinMode(initial.joinMode),
  );
  const [description, setDescription] = useState(initial.description || '');

  // Snapshot the initial values via ref so the open-effect doesn't clobber
  // the user's edits if the parent re-renders with a new `initial` object.
  const initialRef = useRef(initial);
  initialRef.current = initial;

  React.useEffect(() => {
    if (visible) {
      const snap = initialRef.current;
      setName(snap.name);
      setKind(normalizeKind(snap.kind));
      setJoinMode(normalizeJoinMode(snap.joinMode));
      setDescription(snap.description || '');
    }
  }, [visible]);

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && !updateOrg.isPending;
  }, [name, updateOrg.isPending]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      showAlert('Name too short', 'Give your org a name of at least 2 characters.');
      return;
    }

    try {
      await updateOrg.mutateAsync({
        orgId,
        name: trimmedName,
        kind,
        joinMode,
        description: description.trim() || null,
      });
      onClose();
      onSaved?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save changes.';
      showAlert('Could not save', message);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
              <Text style={styles.headerBtnText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Edit org</Text>
            <Pressable
              onPress={handleSubmit}
              style={[styles.headerBtn, !canSubmit && styles.headerBtnDisabled]}
              disabled={!canSubmit}
              hitSlop={8}
            >
              {updateOrg.isPending ? (
                <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
              ) : (
                <Text
                  style={[
                    styles.headerBtnText,
                    styles.headerBtnPrimary,
                    !canSubmit && styles.headerBtnTextDisabled,
                  ]}
                >
                  Save
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Hong Kong Dragon Racing Fleet"
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.sectionGap]}>Kind</Text>
            <View style={styles.chipsRow}>
              {SELF_SERVE_ORG_KINDS.map((k) => {
                const active = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {SELF_SERVE_ORG_KIND_LABELS[k]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, styles.sectionGap]}>Who can join?</Text>
            <View style={styles.joinList}>
              {JOIN_MODE_OPTIONS.map((opt) => {
                const active = joinMode === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setJoinMode(opt.value)}
                    style={[styles.joinRow, active && styles.joinRowActive]}
                  >
                    <View style={styles.joinRowBody}>
                      <Text
                        style={[
                          styles.joinRowLabel,
                          active && styles.joinRowLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.joinRowHint}>{opt.hint}</Text>
                    </View>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={
                        active
                          ? IOS_COLORS.systemBlue
                          : IOS_REGISTER.labelTertiary
                      }
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, styles.sectionGap]}>
              Short description{' '}
              <Text style={styles.labelOptional}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="A line on what this org is about"
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    minHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.16)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: IOS_REGISTER.label },
  headerBtn: { minWidth: 64, paddingVertical: 4 },
  headerBtnDisabled: { opacity: 0.5 },
  headerBtnText: { fontSize: 16, color: IOS_COLORS.systemBlue },
  headerBtnPrimary: { fontWeight: '700', textAlign: 'right' },
  headerBtnTextDisabled: { color: IOS_REGISTER.labelTertiary },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  labelOptional: {
    fontWeight: '400',
    textTransform: 'none',
    color: IOS_REGISTER.labelTertiary,
  },
  sectionGap: { marginTop: 24 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.16)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: IOS_REGISTER.label,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {},
    }),
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(120,120,128,0.12)',
  },
  chipActive: { backgroundColor: IOS_COLORS.systemBlue },
  chipText: { fontSize: 14, fontWeight: '600', color: IOS_REGISTER.label },
  chipTextActive: { color: '#FFFFFF' },
  joinList: {
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.16)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.16)',
    gap: 12,
  },
  joinRowActive: { backgroundColor: 'rgba(11,99,206,0.05)' },
  joinRowBody: { flex: 1, gap: 2 },
  joinRowLabel: { fontSize: 15, fontWeight: '600', color: IOS_REGISTER.label },
  joinRowLabelActive: { color: IOS_COLORS.systemBlue },
  joinRowHint: { fontSize: 12, color: IOS_REGISTER.labelSecondary },
});
