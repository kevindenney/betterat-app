/**
 * ProposeAdoptionSheet — verified-parent admin proposes adoption of a
 * user-created org.
 *
 * Slice 5A — closes the adoption loop so the user doesn't need raw SQL to
 * trigger a proposal. Opens from the CTA on /discover/org/[slug] when the
 * target is user-created, has no parent yet, and the viewer admins at
 * least one verified org.
 *
 * The picker only shows verified orgs the user admins (from
 * useMyVerifiedAdminOrgs). On submit, calls propose_org_adoption via the
 * service; success shows a confirmation and closes.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useProposeAdoption } from '@/hooks/useOrgAdoptionRequests';
import {
  useMyVerifiedAdminOrgs,
  type VerifiedAdminOrg,
} from '@/hooks/useMyVerifiedAdminOrgs';

interface ProposeAdoptionSheetProps {
  visible: boolean;
  targetOrgId: string;
  targetOrgName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ProposeAdoptionSheet({
  visible,
  targetOrgId,
  targetOrgName,
  onClose,
  onSuccess,
}: ProposeAdoptionSheetProps) {
  const { data: parents, isLoading: parentsLoading } = useMyVerifiedAdminOrgs();
  const propose = useProposeAdoption();

  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedParentId(parents?.[0]?.id || null);
      setMessage('');
    }
  }, [visible, parents]);

  const selectedParent: VerifiedAdminOrg | null = useMemo(() => {
    if (!selectedParentId || !parents) return null;
    return parents.find((p) => p.id === selectedParentId) || null;
  }, [selectedParentId, parents]);

  const canSubmit = !!selectedParentId && !propose.isPending;

  const handleSubmit = async () => {
    if (!selectedParentId) return;
    try {
      await propose.mutateAsync({
        parentOrgId: selectedParentId,
        targetOrgId,
        message: message.trim() || undefined,
      });
      onClose();
      onSuccess?.();
      showAlert(
        'Adoption proposed',
        `Sent to the admin of ${targetOrgName}. They'll see it in their adoption inbox.`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not propose adoption.';
      showAlert('Could not propose', message);
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
            <Text style={styles.headerTitle}>Propose adoption</Text>
            <Pressable
              onPress={handleSubmit}
              style={[styles.headerBtn, !canSubmit && styles.headerBtnDisabled]}
              disabled={!canSubmit}
              hitSlop={8}
            >
              {propose.isPending ? (
                <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
              ) : (
                <Text
                  style={[
                    styles.headerBtnText,
                    styles.headerBtnPrimary,
                    !canSubmit && styles.headerBtnTextDisabled,
                  ]}
                >
                  Send
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.intro}>
              Propose that one of your verified orgs adopts{' '}
              <Text style={styles.introBold}>{targetOrgName}</Text>. Their admin
              accepts or declines.
            </Text>

            <Text style={[styles.label, styles.sectionGap]}>
              Adopt under which of your orgs?
            </Text>

            {parentsLoading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={IOS_COLORS.systemBlue} />
              </View>
            ) : !parents || parents.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={IOS_REGISTER.labelSecondary}
                />
                <Text style={styles.emptyText}>
                  You don't admin a verified org yet. Only verified orgs can
                  adopt other orgs.
                </Text>
              </View>
            ) : (
              <View style={styles.parentList}>
                {parents.map((p) => {
                  const active = selectedParentId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setSelectedParentId(p.id)}
                      style={[
                        styles.parentRow,
                        active && styles.parentRowActive,
                      ]}
                    >
                      <View style={styles.parentRowBody}>
                        <Text
                          style={[
                            styles.parentRowName,
                            active && styles.parentRowNameActive,
                          ]}
                        >
                          {p.name}
                        </Text>
                        {p.organization_type ? (
                          <Text style={styles.parentRowMeta}>
                            {p.organization_type.replace(/_/g, ' ')}
                          </Text>
                        ) : null}
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
            )}

            <Text style={[styles.label, styles.sectionGap]}>
              Note to their admin{' '}
              <Text style={styles.labelOptional}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={message}
              onChangeText={setMessage}
              placeholder="A line on why this should sit under your org"
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              multiline
              numberOfLines={3}
            />

            <View style={styles.footnote}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.footnoteText}>
                If they accept,{' '}
                <Text style={styles.footnoteBold}>{targetOrgName}</Text> becomes
                verified under{' '}
                <Text style={styles.footnoteBold}>
                  {selectedParent?.name || 'your org'}
                </Text>
                . Their existing blueprints carry over with a “Carried over”
                pill until you review them.
              </Text>
            </View>
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
    maxHeight: '90%',
    minHeight: '60%',
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
  intro: { fontSize: 14, color: IOS_REGISTER.label, lineHeight: 20 },
  introBold: { fontWeight: '700' },
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
  sectionGap: { marginTop: 22 },
  loading: { paddingVertical: 24, alignItems: 'center' },
  empty: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F7FAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.16)',
  },
  emptyText: { flex: 1, fontSize: 13, color: IOS_REGISTER.label, lineHeight: 18 },
  parentList: {
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.16)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.16)',
    gap: 12,
  },
  parentRowActive: { backgroundColor: 'rgba(11,99,206,0.05)' },
  parentRowBody: { flex: 1, gap: 2 },
  parentRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  parentRowNameActive: { color: IOS_COLORS.systemBlue },
  parentRowMeta: { fontSize: 12, color: IOS_REGISTER.labelSecondary },
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
  footnote: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
  },
  footnoteText: {
    flex: 1,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 16,
  },
  footnoteBold: { fontWeight: '700', color: IOS_REGISTER.label },
});
