import React from 'react';
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
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  AffinityGroupService,
  type CreateSelfServeGroupArgs,
} from '@/services/AffinityGroupService';
import type { AffinityGroupKind } from '@/hooks/useUserAffinityGroups';

type SelfServeGroupKind = Extract<AffinityGroupKind, 'crew_pod' | 'practice_group'>;

interface CreateAffinityGroupSheetProps {
  visible: boolean;
  onClose: () => void;
}

const DEFAULT_GROUP_OPTIONS: {
  value: SelfServeGroupKind;
  label: string;
  hint: string;
}[] = [
  {
    value: 'practice_group',
    label: 'Practice group',
    hint: 'A peer group working on the same skills.',
  },
  {
    value: 'crew_pod',
    label: 'Crew',
    hint: 'A small team that practices together.',
  },
];

const NURSING_GROUP_OPTIONS: typeof DEFAULT_GROUP_OPTIONS = [
  {
    value: 'practice_group',
    label: 'Study group',
    hint: 'A peer-led group for study, labs, or clinical prep.',
  },
  {
    value: 'crew_pod',
    label: 'Clinical pod',
    hint: 'A small peer group around shifts or placements.',
  },
];

function optionsForInterest(interestSlug?: string | null) {
  return interestSlug === 'nursing' ? NURSING_GROUP_OPTIONS : DEFAULT_GROUP_OPTIONS;
}

function placeholderForInterest(interestSlug?: string | null): string {
  if (interestSlug === 'nursing') return 'NCLEX study group';
  if (interestSlug === 'sail-racing') return 'Wednesday crew';
  return 'Name of the group';
}

export function CreateAffinityGroupSheet({
  visible,
  onClose,
}: CreateAffinityGroupSheetProps) {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const queryClient = useQueryClient();
  const interestSlug = currentInterest?.slug;
  const options = React.useMemo(() => optionsForInterest(interestSlug), [interestSlug]);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [kind, setKind] = React.useState<SelfServeGroupKind>(options[0].value);

  React.useEffect(() => {
    if (!visible) return;
    setName('');
    setDescription('');
    setKind(options[0].value);
  }, [visible, options]);

  const createMutation = useMutation({
    mutationFn: (input: CreateSelfServeGroupArgs) =>
      AffinityGroupService.createSelfServeGroup(input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['user-affinity-groups'] });
      queryClient.invalidateQueries({ queryKey: ['discoverable-affinity-groups'] });
      onClose();
      router.push(`/group/${created.id}` as never);
    },
    onError: (err) => {
      showAlert(
        'Could not add group',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  const canSubmit = name.trim().length >= 2 && Boolean(user?.id) && !createMutation.isPending;

  const handleSubmit = () => {
    if (!user?.id) {
      showAlert('Sign in required', 'Sign in before adding a group.');
      return;
    }
    createMutation.mutate({
      name,
      kind,
      description,
      interestSlug,
    });
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
            <Text style={styles.headerTitle}>Add group</Text>
            <Pressable
              onPress={handleSubmit}
              style={[styles.headerBtn, !canSubmit && styles.headerBtnDisabled]}
              disabled={!canSubmit}
              hitSlop={8}
            >
              {createMutation.isPending ? (
                <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
              ) : (
                <Text
                  style={[
                    styles.headerBtnText,
                    styles.headerBtnPrimary,
                    !canSubmit && styles.headerBtnTextDisabled,
                  ]}
                >
                  Create
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
              placeholder={placeholderForInterest(interestSlug)}
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              autoCapitalize="words"
              autoFocus
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.sectionGap]}>What kind?</Text>
            <View style={styles.kindList}>
              {options.map((option) => {
                const active = kind === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.kindRow, active && styles.kindRowActive]}
                    onPress={() => setKind(option.value)}
                  >
                    <View style={styles.kindText}>
                      <Text style={[styles.kindLabel, active && styles.kindLabelActive]}>
                        {option.label}
                      </Text>
                      <Text style={styles.kindHint}>{option.hint}</Text>
                    </View>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? IOS_COLORS.systemBlue : IOS_REGISTER.labelTertiary}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.note}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.noteText}>
                Official school cohorts are created by institution admins. This adds a peer-run group.
              </Text>
            </View>

            <Text style={[styles.label, styles.sectionGap]}>
              Short description <Text style={styles.labelOptional}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="A line on who this group is for"
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
    maxHeight: '86%',
    minHeight: '58%',
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  headerBtn: {
    minWidth: 64,
    paddingVertical: 4,
  },
  headerBtnDisabled: {
    opacity: 0.5,
  },
  headerBtnText: {
    fontSize: 16,
    color: IOS_COLORS.systemBlue,
  },
  headerBtnPrimary: {
    fontWeight: '700',
    textAlign: 'right',
  },
  headerBtnTextDisabled: {
    color: IOS_REGISTER.labelTertiary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
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
  sectionGap: {
    marginTop: 24,
  },
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
  inputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  kindList: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.16)',
  },
  kindRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  kindRowActive: {
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  kindText: {
    flex: 1,
  },
  kindLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  kindLabelActive: {
    color: IOS_COLORS.systemBlue,
  },
  kindHint: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    color: IOS_REGISTER.labelSecondary,
  },
  note: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: IOS_REGISTER.labelSecondary,
  },
});
