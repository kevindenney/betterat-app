/**
 * CreateOrgSheet — single-step self-serve org creation.
 *
 * Slice 2A of the create-org flow. Three-step UX (Identity → Where & what →
 * Membership policy) is deferred to slice 2B; this lands the data path
 * end-to-end with the smallest possible UI surface.
 *
 * Entry: DiscoverOrgsContent empty state.
 * Exit: router.push(`/discover/org/<slug>`) on success.
 *
 * See docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md for the full design.
 */

import React, { useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';

import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useCreateOrg } from '@/hooks/useCreateOrg';
import { supabase } from '@/services/supabase';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  orgCreationService,
  type SimilarOrgMatch,
} from '@/services/OrgCreationService';
import {
  SELF_SERVE_ORG_KINDS,
  SELF_SERVE_ORG_KIND_LABELS,
  type OrganizationJoinMode,
  type SelfServeOrgKind,
} from '@/types/organization';

interface CreateOrgSheetProps {
  visible: boolean;
  initialName?: string;
  onClose: () => void;
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

const SAILING_ORG_KINDS: SelfServeOrgKind[] = [
  'fleet',
  'training_squad',
  'community',
  'other',
];

const NURSING_ORG_KINDS: SelfServeOrgKind[] = [
  'institution',
];

function defaultKindForInterest(interestSlug?: string | null): SelfServeOrgKind {
  if (interestSlug === 'nursing') return 'institution';
  return 'fleet';
}

function kindOptionsForInterest(interestSlug?: string | null): SelfServeOrgKind[] {
  if (interestSlug === 'nursing') return NURSING_ORG_KINDS;
  if (interestSlug === 'sail-racing') return SAILING_ORG_KINDS;
  return [...SELF_SERVE_ORG_KINDS];
}

function placeholderForInterest(interestSlug?: string | null): string {
  if (interestSlug === 'nursing') return 'Johns Hopkins Hospital';
  if (interestSlug === 'sail-racing') return 'Hong Kong Dragon Racing Fleet';
  return 'Name of the organization';
}

export function CreateOrgSheet({ visible, initialName, onClose }: CreateOrgSheetProps) {
  const router = useRouter();
  const { currentInterest } = useInterest();
  const { user } = useAuth();
  const createOrg = useCreateOrg();
  const interestSlug = currentInterest?.slug;
  const kindOptions = useMemo(() => kindOptionsForInterest(interestSlug), [interestSlug]);

  const [memberOrgIds, setMemberOrgIds] = useState<Set<string>>(new Set());

  const [name, setName] = useState(initialName || '');
  const [kind, setKind] = useState<SelfServeOrgKind>(() => defaultKindForInterest(interestSlug));
  const [joinMode, setJoinMode] = useState<OrganizationJoinMode>('request_to_join');
  const [description, setDescription] = useState('');
  const [similar, setSimilar] = useState<SimilarOrgMatch[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const isInstitutionRequest = interestSlug === 'nursing' && kind === 'institution';

  // Reset state ONLY when the sheet transitions from closed → open. Earlier
  // version had `initialName` in deps, which caused the effect to re-fire
  // (and clobber the user's typed name) every time the parent re-rendered
  // with a fresh `searchQuery.trim() || undefined` reference. See
  // feedback_useeffect_array_prop_deps memory — caller-passed values in
  // deps will silently wipe in-progress input. Snapshot initialName via
  // ref so we still pick up the latest value at open time.
  const initialNameRef = React.useRef(initialName);
  initialNameRef.current = initialName;
  React.useEffect(() => {
    if (visible) {
      setName(initialNameRef.current || '');
      setKind(defaultKindForInterest(interestSlug));
      setJoinMode('request_to_join');
      setDescription('');
      setSimilar([]);
    }
  }, [visible, interestSlug]);

  // Load the orgs the current user already belongs to, so a dedup suggestion
  // they're already a member of reads "You're already a member → Open" rather
  // than a generic chevron that looks like a dead end.
  React.useEffect(() => {
    if (!visible || !user?.id) {
      setMemberOrgIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', user.id);
      if (cancelled) return;
      setMemberOrgIds(
        new Set(
          (data ?? [])
            .map((r: { organization_id: string }) => r.organization_id)
            .filter(Boolean),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, user?.id]);

  // Debounced fuzzy match — surfaces existing orgs that look like what the
  // user is typing so we don't pile up duplicates. ilike is enough; pg_trgm
  // isn't installed.
  React.useEffect(() => {
    if (!visible) return;
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setSimilar([]);
      return;
    }
    let cancelled = false;
    setSimilarLoading(true);
    const timer = setTimeout(async () => {
      try {
        const matches = await orgCreationService.findSimilarOrgs(trimmed);
        if (!cancelled) setSimilar(matches);
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, visible]);

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && !createOrg.isPending;
  }, [name, createOrg.isPending]);

  const handlePickExisting = (match: SimilarOrgMatch) => {
    if (!match.slug) return;
    onClose();
    router.push(`/discover/org/${match.slug}?from=create-dedup` as any);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      showAlert('Name too short', 'Give your org a name of at least 2 characters.');
      return;
    }

    try {
      const created = await createOrg.mutateAsync({
        name: trimmedName,
        kind,
        joinMode: isInstitutionRequest ? 'invite_only' : joinMode,
        description: description.trim() || undefined,
        interestSlug: currentInterest?.slug,
        requestOnly: isInstitutionRequest,
      });
      onClose();
      if (isInstitutionRequest) {
        showAlert(
          'Institution request sent',
          'Your request is now in BetterAt’s admin review queue. It will appear in Organizations after approval.',
        );
        router.replace('/(tabs)/library?zone=orgs' as any);
        return;
      }
      router.push(`/organizations/${created.slug}?from=${isInstitutionRequest ? 'institution-request' : 'create'}` as any);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create organization.';
      showAlert('Could not create', message);
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
            <Text style={styles.headerTitle}>
              {isInstitutionRequest ? 'Request institution' : 'Add an org'}
            </Text>
            <Pressable
              onPress={handleSubmit}
              style={[styles.headerBtn, !canSubmit && styles.headerBtnDisabled]}
              disabled={!canSubmit}
              hitSlop={8}
            >
              {createOrg.isPending ? (
                <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
              ) : (
                <Text
                  style={[
                    styles.headerBtnText,
                    styles.headerBtnPrimary,
                    !canSubmit && styles.headerBtnTextDisabled,
                  ]}
                >
                  {isInstitutionRequest ? 'Request' : 'Create'}
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

            {/* Fuzzy-match dedup — if an org looks similar, surface it so the
                user can pick the existing one instead of creating a duplicate.
                They can still proceed with Create if it really is different. */}
            {similar.length > 0 ? (
              <View style={styles.dedupPanel}>
                <View style={styles.dedupHeader}>
                  <Ionicons
                    name="bulb-outline"
                    size={14}
                    color={IOS_REGISTER.labelSecondary}
                  />
                  <Text style={styles.dedupTitle}>Looks like one of these?</Text>
                  {similarLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={IOS_REGISTER.labelSecondary}
                    />
                  ) : null}
                </View>
                {similar.map((match) => {
                  const alreadyMember = memberOrgIds.has(match.id);
                  return (
                    <Pressable
                      key={match.id}
                      onPress={() => handlePickExisting(match)}
                      style={styles.dedupRow}
                    >
                      <View style={styles.dedupRowBody}>
                        <Text style={styles.dedupRowName}>{match.name}</Text>
                        {alreadyMember ? (
                          <Text style={styles.dedupRowMember}>
                            You’re already a member
                          </Text>
                        ) : (
                          <Text style={styles.dedupRowMeta}>
                            {match.official ? 'Verified' : 'User-started'}
                            {match.organization_type
                              ? ` · ${match.organization_type.replace(/_/g, ' ')}`
                              : ''}
                          </Text>
                        )}
                      </View>
                      {alreadyMember ? (
                        <View style={styles.dedupOpenPill}>
                          <Text style={styles.dedupOpenText}>Open</Text>
                          <Ionicons
                            name="arrow-forward"
                            size={14}
                            color={IOS_COLORS.systemBlue}
                          />
                        </View>
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={IOS_REGISTER.labelTertiary}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Text style={[styles.label, styles.sectionGap]}>What kind?</Text>
            <View style={styles.chipsRow}>
              {kindOptions.map((k) => {
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

            {isInstitutionRequest ? (
              <View style={styles.requestNotice}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={IOS_COLORS.systemBlue}
                />
                <View style={styles.requestNoticeCopy}>
                  <Text style={styles.requestNoticeTitle}>Institutional setup is reviewed</Text>
                  <Text style={styles.requestNoticeBody}>
                    BetterAt will review this institution before it becomes official. You will be recorded as the requester and initial owner of the pending org record.
                  </Text>
                </View>
              </View>
            ) : (
              <>
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
              </>
            )}

            <Text style={[styles.label, styles.sectionGap]}>
              Short description{' '}
              <Text style={styles.labelOptional}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder={
                isInstitutionRequest
                  ? 'Website, department, or contact context for review'
                  : 'A line on what this org is about'
              }
              placeholderTextColor={IOS_REGISTER.labelTertiary}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />

            <View style={styles.footnote}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.footnoteText}>
                {isInstitutionRequest
                  ? 'This creates a hidden review placeholder and sends a real request to the BetterAt admin queue.'
                  : 'You become owner. The org shows as user-started until a verified parent adopts it.'}
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
  inputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(120,120,128,0.12)',
  },
  chipActive: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
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
  joinRowActive: {
    backgroundColor: 'rgba(11,99,206,0.05)',
  },
  joinRowBody: {
    flex: 1,
    gap: 2,
  },
  joinRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  joinRowLabelActive: {
    color: IOS_COLORS.systemBlue,
  },
  joinRowHint: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
  requestNotice: {
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.20)',
    backgroundColor: 'rgba(0,122,255,0.06)',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  requestNoticeCopy: {
    flex: 1,
    gap: 3,
  },
  requestNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  requestNoticeBody: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_REGISTER.labelSecondary,
  },
  footnote: {
    marginTop: 24,
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
  dedupPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(11,99,206,0.18)',
    backgroundColor: '#F7FAFF',
    borderRadius: 10,
    overflow: 'hidden',
  },
  dedupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  dedupTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dedupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(11,99,206,0.18)',
    gap: 10,
  },
  dedupRowBody: { flex: 1, gap: 2 },
  dedupRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  dedupRowMeta: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
  dedupRowMember: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemGreen,
  },
  dedupOpenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dedupOpenText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
});
