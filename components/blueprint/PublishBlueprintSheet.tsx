/**
 * PublishBlueprintSheet
 *
 * Bottom sheet for timeline owners to publish their timeline as a
 * subscribable blueprint. Allows setting title, description, slug,
 * and toggling published state.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Platform,
  Share,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import {
  useCreateBlueprint,
  useUpdateBlueprint,
  useBlueprintSteps,
  useSetBlueprintSteps,
  useMigrateBlueprint,
} from '@/hooks/useBlueprint';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { generateBlueprintSlug, backfillAutoCurateSteps } from '@/services/BlueprintService';
import { StripeConnectService } from '@/services/StripeConnectService';
import { useOrgPrograms, useProgramCapabilityCount } from '@/hooks/usePrograms';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useInterest } from '@/providers/InterestProvider';
import type { BlueprintRecord, BlueprintAccessLevel, BlueprintPricingType } from '@/types/blueprint';

const C = {
  bg: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.4)',
  accent: '#00897B',
  accentBg: 'rgba(0,137,123,0.08)',
  border: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  successBg: '#E8F5E9',
  successText: '#2E7D32',
  danger: '#DC503C',
} as const;

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager', 'faculty', 'instructor']);

interface PublishBlueprintSheetProps {
  visible: boolean;
  onClose: () => void;
  interestId: string;
  interestName: string;
  /** Existing blueprints for this interest (edit mode when one is selected) */
  existingBlueprints?: BlueprintRecord[];
  /** Specific blueprint to edit (when selected from list) */
  existingBlueprint?: BlueprintRecord | null;
}

export function PublishBlueprintSheet({
  visible,
  onClose,
  interestId,
  interestName,
  existingBlueprints = [],
  existingBlueprint,
}: PublishBlueprintSheetProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { memberships } = useOrganization();
  const createBlueprint = useCreateBlueprint();
  const updateBlueprint = useUpdateBlueprint();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [publishAs, setPublishAs] = useState<'individual' | string>('individual');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<BlueprintAccessLevel>('public');
  const [priceDollars, setPriceDollars] = useState('');
  const [pricingType, setPricingType] = useState<BlueprintPricingType>('recurring');
  const [autoCurate, setAutoCurate] = useState(false);
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<BlueprintRecord | null>(existingBlueprint ?? null);
  const activeBlueprint = selectedBlueprint;
  const isEditing = !!activeBlueprint;
  const [showBlueprintPicker, setShowBlueprintPicker] = useState(false);
  const [showStepCurator, setShowStepCurator] = useState(false);
  const [curatingBlueprintId, setCuratingBlueprintId] = useState<string | null>(null);
  const [showMoveInterest, setShowMoveInterest] = useState(false);
  const migrateBlueprintMutation = useMigrateBlueprint();
  const { userInterests } = useInterest();

  // Step curation data
  const { data: mySteps } = useMyTimeline(interestId);
  const { data: curatedSteps } = useBlueprintSteps(curatingBlueprintId);
  const setBlueprintSteps = useSetBlueprintSteps();
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());

  // Sync selected step IDs when curated steps load
  useEffect(() => {
    if (curatedSteps && curatedSteps.length > 0) {
      setSelectedStepIds(new Set(curatedSteps.map((s) => s.id)));
    } else if (mySteps && curatingBlueprintId) {
      // Default: select all non-private steps
      setSelectedStepIds(new Set(mySteps.filter((s) => s.visibility !== 'private' && !(s as any)._pinned).map((s) => s.id)));
    }
  }, [curatedSteps, mySteps, curatingBlueprintId]);

  const toggleStepSelection = useCallback((stepId: string) => {
    setSelectedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const handleSaveStepCuration = useCallback(async () => {
    if (!curatingBlueprintId) return;
    try {
      await setBlueprintSteps.mutateAsync({
        blueprintId: curatingBlueprintId,
        stepIds: Array.from(selectedStepIds),
      });
      setShowStepCurator(false);
      setCuratingBlueprintId(null);
    } catch (err: any) {
      showAlert('Save Failed', err?.message || 'Could not save step selection.');
    }
  }, [curatingBlueprintId, selectedStepIds, setBlueprintSteps]);

  // Filter to orgs where user has a manager role
  const managerOrgs = memberships.filter(
    (m) =>
      (m.membership_status === 'active' || m.status === 'active') &&
      MANAGER_ROLES.has(String(m.role || '').toLowerCase()) &&
      m.organization,
  );

  // Check Stripe Connect status when user picks paid access
  useEffect(() => {
    if (accessLevel !== 'paid' || !user?.id || stripeConnected !== null) return;
    setStripeLoading(true);
    StripeConnectService.getConnectStatus(user.id)
      .then((status) => setStripeConnected(status.connected && (status.chargesEnabled === true || status.detailsSubmitted === true)))
      .catch(() => setStripeConnected(false))
      .finally(() => setStripeLoading(false));
  }, [accessLevel, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectStripe = useCallback(async () => {
    if (!user?.id) return;
    setStripeLoading(true);
    const baseUrl = Platform.OS === 'web' ? window.location.origin : 'https://better.at';
    const result = await StripeConnectService.startOnboarding(
      user.id,
      `${baseUrl}/settings?stripe_return=true`,
      `${baseUrl}/settings?stripe_refresh=true`,
    );
    setStripeLoading(false);
    if (result.success && result.url) {
      if (Platform.OS === 'web') {
        window.location.href = result.url;
      } else {
        // On native, open in browser
        Linking.openURL(result.url);
      }
    } else {
      showAlert('Setup Failed', result.error || 'Could not start Stripe setup.');
    }
  }, [user?.id]);

  // Reset state when sheet visibility changes
  useEffect(() => {
    if (visible) {
      setJustPublished(false);
      setShowStepCurator(false);
      setCuratingBlueprintId(null);
      setSelectedBlueprint(existingBlueprint ?? null);
      // Show picker if user has existing blueprints and no specific one pre-selected
      setShowBlueprintPicker(!existingBlueprint && existingBlueprints.length > 0);
    }
  }, [visible, existingBlueprint, existingBlueprints.length]);

  useEffect(() => {
    if (justPublished) return; // Don't overwrite success state
    if (activeBlueprint) {
      setTitle(activeBlueprint.title);
      setDescription(activeBlueprint.description ?? '');
      setSlug(activeBlueprint.slug);
      setPublishAs(activeBlueprint.organization_id ?? 'individual');
      setSelectedProgramId(activeBlueprint.program_id ?? null);
      setAccessLevel(activeBlueprint.access_level ?? 'public');
      setPriceDollars(activeBlueprint.price_cents ? String(activeBlueprint.price_cents / 100) : '');
      setPricingType(activeBlueprint.pricing_type ?? 'recurring');
      setAutoCurate(activeBlueprint.auto_curate ?? false);
    } else {
      const defaultTitle = `${interestName} Blueprint`;
      setTitle(defaultTitle);
      setDescription('');
      setPublishAs('individual');
      setSelectedProgramId(null);
      setAccessLevel('public');
      setPriceDollars('');
      setPricingType('recurring');
      setSlug(generateBlueprintSlug(user?.user_metadata?.display_name ?? 'user', interestName));
    }
  }, [activeBlueprint, interestName, user, visible, justPublished]);

  const selectedOrgId = publishAs !== 'individual' ? publishAs : null;

  // Fetch programs for the selected org
  const { data: orgPrograms } = useOrgPrograms(selectedOrgId);
  const { data: capabilityCount } = useProgramCapabilityCount(selectedProgramId);

  // Update slug and reset program when publishAs changes
  useEffect(() => {
    if (isEditing) return;
    setSelectedProgramId(null);
    if (selectedOrgId) {
      const org = managerOrgs.find((m) => m.organization_id === selectedOrgId);
      const orgName = org?.organization?.name ?? 'org';
      setSlug(generateBlueprintSlug(orgName, interestName));
    } else {
      setSlug(generateBlueprintSlug(user?.user_metadata?.display_name ?? 'user', interestName));
    }
  }, [publishAs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePublish = useCallback(async () => {
    if (!user?.id || !title.trim()) return;

    const priceCents = accessLevel === 'paid' && priceDollars
      ? Math.round(parseFloat(priceDollars) * 100)
      : null;

    try {
      let publishedId: string;
      if (isEditing && activeBlueprint) {
        await updateBlueprint.mutateAsync({
          blueprintId: activeBlueprint.id,
          updates: {
            title: title.trim(),
            description: description.trim() || null,
            is_published: true,
            organization_id: selectedOrgId || null,
            program_id: selectedProgramId || null,
            access_level: accessLevel,
            price_cents: priceCents,
            pricing_type: accessLevel === 'paid' ? pricingType : 'one_time',
            auto_curate: autoCurate,
          },
        });
        publishedId = activeBlueprint.id;
        // Backfill existing steps when auto-curate is enabled
        if (autoCurate) {
          await backfillAutoCurateSteps(publishedId, user.id, interestId);
        }
      } else {
        const created = await createBlueprint.mutateAsync({
          user_id: user.id,
          interest_id: interestId,
          slug: slug.trim(),
          title: title.trim(),
          description: description.trim() || null,
          is_published: true,
          organization_id: selectedOrgId,
          program_id: selectedProgramId,
          access_level: accessLevel,
          price_cents: priceCents,
          pricing_type: accessLevel === 'paid' ? pricingType : 'one_time',
        });
        publishedId = created.id;
      }
      setCuratingBlueprintId(publishedId);
      setJustPublished(true);
    } catch (err: any) {
      console.error('[PublishBlueprintSheet] Publish failed:', err);
      showAlert('Publish Failed', err?.message || 'Something went wrong. Please try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, title, description, slug, interestId, isEditing, activeBlueprint, createBlueprint, updateBlueprint, onClose, selectedOrgId, selectedProgramId, accessLevel, priceDollars]);

  const handleUnpublish = useCallback(async () => {
    if (!activeBlueprint) return;
    await updateBlueprint.mutateAsync({
      blueprintId: activeBlueprint.id,
      updates: { is_published: false },
    });
    onClose();
  }, [activeBlueprint, updateBlueprint, onClose]);

  const handleShareLink = useCallback(async () => {
    const url = `${Platform.OS === 'web' ? window.location.origin : 'https://better.at'}/blueprint/${slug}`;
    if (Platform.OS === 'web') {
      await navigator.clipboard?.writeText(url);
    } else {
      await Share.share({ url, message: `Check out my ${interestName} blueprint: ${url}` });
    }
  }, [slug, interestName]);

  const blueprintUrl = `/blueprint/${slug}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {showStepCurator && curatingBlueprintId ? (
            <View style={{ paddingVertical: 8 }}>
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name="checkmark-done" size={20} color={C.accent} />
                </View>
                <Text style={styles.headerTitle}>Curate Blueprint Steps</Text>
                <Text style={styles.headerSubtitle}>
                  Choose which steps subscribers will see in this blueprint
                </Text>
              </View>

              {(mySteps ?? []).filter((s) => s.visibility !== 'private' && !(s as any)._pinned).map((step) => (
                <Pressable
                  key={step.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderWidth: 1,
                    borderColor: selectedStepIds.has(step.id) ? C.accent : C.border,
                    borderRadius: 10,
                    marginBottom: 8,
                    backgroundColor: selectedStepIds.has(step.id) ? C.accentBg : '#FFFFFF',
                  }}
                  onPress={() => toggleStepSelection(step.id)}
                >
                  <Ionicons
                    name={selectedStepIds.has(step.id) ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={selectedStepIds.has(step.id) ? C.accent : C.labelLight}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: C.labelDark }}>{step.title}</Text>
                    {step.description ? (
                      <Text style={{ fontSize: 11, color: C.labelMid, marginTop: 2 }} numberOfLines={1}>
                        {step.description}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: step.status === 'completed' ? C.successBg : '#F5F5F4',
                  }}>
                    <Text style={{ fontSize: 10, color: step.status === 'completed' ? C.successText : C.labelMid, fontWeight: '500' }}>
                      {step.status}
                    </Text>
                  </View>
                </Pressable>
              ))}

              <Text style={{ fontSize: 11, color: C.labelMid, textAlign: 'center', marginBottom: 12 }}>
                {selectedStepIds.size} of {(mySteps ?? []).filter((s) => s.visibility !== 'private' && !(s as any)._pinned).length} steps selected
              </Text>

              <Pressable
                style={[styles.publishBtn, setBlueprintSteps.isPending && styles.publishBtnDisabled]}
                onPress={handleSaveStepCuration}
                disabled={setBlueprintSteps.isPending}
              >
                {setBlueprintSteps.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
                <Text style={styles.publishBtnText}>
                  {setBlueprintSteps.isPending ? 'Saving...' : 'Save Step Selection'}
                </Text>
              </Pressable>

              <Pressable style={styles.cancelBtn} onPress={() => { setShowStepCurator(false); setCuratingBlueprintId(null); onClose(); }}>
                <Text style={styles.cancelText}>Skip for now</Text>
              </Pressable>
            </View>
          ) : justPublished ? (
            <View style={styles.successState}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={48} color={C.successText} />
              </View>
              <Text style={styles.successTitle}>Blueprint Published!</Text>
              <Text style={styles.successSubtitle}>
                Your timeline is now subscribable{selectedOrgId ? ' under your organization' : ''}.
              </Text>
              <View style={styles.urlRow}>
                <Text style={styles.urlPrefix}>better.at</Text>
                <Text style={styles.urlSlug}>{blueprintUrl}</Text>
                <Pressable style={styles.copyBtn} onPress={handleShareLink}>
                  <Ionicons name="copy-outline" size={14} color={C.accent} />
                </Pressable>
              </View>

              <Pressable
                style={styles.publishBtn}
                onPress={() => setShowStepCurator(true)}
              >
                <Ionicons name="checkmark-done-outline" size={16} color="#FFFFFF" />
                <Text style={styles.publishBtnText}>Curate Steps</Text>
              </Pressable>
              <Pressable
                style={[styles.publishBtn, { backgroundColor: C.accentBg }]}
                onPress={() => {
                  onClose();
                  router.push(`/blueprint/${slug}` as any);
                }}
              >
                <Ionicons name="eye-outline" size={16} color={C.accent} />
                <Text style={[styles.publishBtnText, { color: C.accent }]}>View Blueprint Page</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Done</Text>
              </Pressable>
            </View>
          ) : showBlueprintPicker ? (
            <View style={{ paddingVertical: 8 }}>
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name="layers" size={20} color={C.accent} />
                </View>
                <Text style={styles.headerTitle}>Your {interestName} Blueprints</Text>
                <Text style={styles.headerSubtitle}>
                  Select a blueprint to edit, or create a new one
                </Text>
              </View>

              {existingBlueprints.map((bp) => (
                <View
                  key={bp.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 10,
                    marginBottom: 8,
                    backgroundColor: bp.is_published ? C.successBg : '#FFFFFF',
                  }}
                >
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      setSelectedBlueprint(bp);
                      setShowBlueprintPicker(false);
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.labelDark }}>{bp.title}</Text>
                    <Text style={{ fontSize: 11, color: C.labelMid, marginTop: 2 }}>
                      {bp.is_published ? 'Published' : 'Draft'} · {bp.subscriber_count} subscriber{bp.subscriber_count !== 1 ? 's' : ''}
                    </Text>
                  </Pressable>
                  {bp.is_published && bp.slug && (
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 6,
                        backgroundColor: C.accentBg,
                        marginRight: 8,
                      }}
                      onPress={() => {
                        onClose();
                        router.push(`/blueprint/${bp.slug}` as any);
                      }}
                    >
                      <Ionicons name="eye-outline" size={14} color={C.accent} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: C.accent }}>View</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      setSelectedBlueprint(bp);
                      setShowBlueprintPicker(false);
                    }}
                  >
                    <Ionicons name="chevron-forward" size={16} color={C.labelLight} />
                  </Pressable>
                </View>
              ))}

              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: C.accent,
                  borderRadius: 10,
                  borderStyle: 'dashed',
                  marginTop: 4,
                }}
                onPress={() => setShowBlueprintPicker(false)}
              >
                <Ionicons name="add-circle-outline" size={18} color={C.accent} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.accent }}>
                  New Blueprint
                </Text>
              </Pressable>

              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
          <>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="layers" size={20} color={C.accent} />
            </View>
            <Text style={styles.headerTitle}>
              {isEditing ? 'Manage Blueprint' : 'Publish as Blueprint'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isEditing
                ? 'Edit your published blueprint settings'
                : 'Make your timeline subscribable so others can follow and adopt your steps'}
            </Text>
          </View>

          {/* Published status */}
          {isEditing && activeBlueprint?.is_published && (
            <View style={styles.statusRow}>
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={12} color={C.successText} />
                <Text style={styles.statusText}>Published</Text>
              </View>
              <Text style={styles.subscriberCount}>
                {activeBlueprint!.subscriber_count} subscriber{activeBlueprint!.subscriber_count !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Publish As — only shown when user has manager-level org memberships */}
          {managerOrgs.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Publish As</Text>
              <View style={styles.segmentRow}>
                <Pressable
                  style={[styles.segmentBtn, publishAs === 'individual' && styles.segmentBtnActive]}
                  onPress={() => { setPublishAs('individual'); setAccessLevel('public'); }}
                >
                  <Ionicons name="person-outline" size={13} color={publishAs === 'individual' ? C.accent : C.labelMid} />
                  <Text style={[styles.segmentText, publishAs === 'individual' && styles.segmentTextActive]}>
                    Yourself
                  </Text>
                </Pressable>
                {managerOrgs.map((m) => (
                  <Pressable
                    key={m.organization_id}
                    style={[styles.segmentBtn, publishAs === m.organization_id && styles.segmentBtnActive]}
                    onPress={() => {
                      setPublishAs(m.organization_id);
                      const vis = (m.organization?.metadata as any)?.default_content_visibility;
                      setAccessLevel(vis === 'org_members' ? 'org_members' : 'public');
                    }}
                  >
                    <Ionicons name="business-outline" size={13} color={publishAs === m.organization_id ? C.accent : C.labelMid} />
                    <Text
                      style={[styles.segmentText, publishAs === m.organization_id && styles.segmentTextActive]}
                      numberOfLines={1}
                    >
                      {m.organization?.name ?? 'Organization'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Access Level */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Who Can Subscribe</Text>
            <View style={styles.segmentRow}>
              <Pressable
                style={[styles.segmentBtn, accessLevel === 'public' && styles.segmentBtnActive]}
                onPress={() => { setAccessLevel('public'); setPriceDollars(''); }}
              >
                <Ionicons name="globe-outline" size={13} color={accessLevel === 'public' ? C.accent : C.labelMid} />
                <Text style={[styles.segmentText, accessLevel === 'public' && styles.segmentTextActive]}>
                  Public
                </Text>
              </Pressable>
              {selectedOrgId && (
                <Pressable
                  style={[styles.segmentBtn, accessLevel === 'org_members' && styles.segmentBtnActive]}
                  onPress={() => { setAccessLevel('org_members'); setPriceDollars(''); }}
                >
                  <Ionicons name="people-outline" size={13} color={accessLevel === 'org_members' ? C.accent : C.labelMid} />
                  <Text style={[styles.segmentText, accessLevel === 'org_members' && styles.segmentTextActive]}>
                    Members Only
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.segmentBtn, accessLevel === 'paid' && styles.segmentBtnActive]}
                onPress={() => setAccessLevel('paid')}
              >
                <Ionicons name="card-outline" size={13} color={accessLevel === 'paid' ? C.accent : C.labelMid} />
                <Text style={[styles.segmentText, accessLevel === 'paid' && styles.segmentTextActive]}>
                  Paid
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Pricing — shown when access level is paid */}
          {accessLevel === 'paid' && (
            <>
              {/* Stripe Connect banner */}
              {stripeConnected === false && (
                <View style={{ backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginBottom: 14, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="card-outline" size={16} color="#F59E0B" />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.labelDark }}>Connect your bank account</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: C.labelMid, lineHeight: 17 }}>
                    To receive payments from blueprint sales, connect a Stripe account. BetterAt takes a 15% platform fee.
                  </Text>
                  <Pressable
                    style={{ backgroundColor: '#00897B', borderRadius: 8, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    onPress={handleConnectStripe}
                    disabled={stripeLoading}
                  >
                    {stripeLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="link-outline" size={14} color="#FFFFFF" />
                    )}
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                      {stripeLoading ? 'Setting up...' : 'Connect Stripe'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Pricing type selector */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Billing</Text>
                <View style={styles.segmentRow}>
                  <Pressable
                    style={[styles.segmentBtn, pricingType === 'recurring' && styles.segmentBtnActive]}
                    onPress={() => setPricingType('recurring')}
                  >
                    <Ionicons name="repeat-outline" size={13} color={pricingType === 'recurring' ? C.accent : C.labelMid} />
                    <Text style={[styles.segmentText, pricingType === 'recurring' && styles.segmentTextActive]}>
                      Monthly
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.segmentBtn, pricingType === 'one_time' && styles.segmentBtnActive]}
                    onPress={() => setPricingType('one_time')}
                  >
                    <Ionicons name="flash-outline" size={13} color={pricingType === 'one_time' ? C.accent : C.labelMid} />
                    <Text style={[styles.segmentText, pricingType === 'one_time' && styles.segmentTextActive]}>
                      One-time
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Price input */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  Price (USD){pricingType === 'recurring' ? ' / month' : ''}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: C.labelDark, marginRight: 4 }}>$</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={priceDollars}
                    onChangeText={(text) => setPriceDollars(text.replace(/[^0-9.]/g, ''))}
                    placeholder={pricingType === 'recurring' ? '10' : '49'}
                    placeholderTextColor={C.labelLight}
                    keyboardType="decimal-pad"
                  />
                </View>
                {selectedOrgId && (
                  <Text style={{ fontSize: 11, color: C.labelMid, marginTop: 4 }}>
                    Organization members get free access. Non-members pay this price.
                  </Text>
                )}
                {pricingType === 'recurring' && (
                  <Text style={{ fontSize: 11, color: C.labelMid, marginTop: 4 }}>
                    Subscribers are charged monthly and can cancel anytime.
                  </Text>
                )}
              </View>
            </>
          )}

          {/* Program Picker — shown when publishing under an org with programs */}
          {selectedOrgId && orgPrograms && orgPrograms.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Program</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, gap: 6 }}>
                <Pressable
                  style={[styles.programChip, selectedProgramId === null && styles.programChipActive]}
                  onPress={() => setSelectedProgramId(null)}
                >
                  <Text style={[styles.programChipText, selectedProgramId === null && styles.programChipTextActive]}>
                    None
                  </Text>
                </Pressable>
                {orgPrograms.map((prog) => (
                  <Pressable
                    key={prog.id}
                    style={[styles.programChip, selectedProgramId === prog.id && styles.programChipActive]}
                    onPress={() => {
                      setSelectedProgramId(prog.id);
                      if (!isEditing) setTitle(prog.title);
                    }}
                  >
                    <Ionicons name="school-outline" size={12} color={selectedProgramId === prog.id ? C.accent : C.labelMid} />
                    <Text
                      style={[styles.programChipText, selectedProgramId === prog.id && styles.programChipTextActive]}
                      numberOfLines={1}
                    >
                      {prog.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {selectedProgramId && capabilityCount && (capabilityCount.competencies > 0 || capabilityCount.subCompetencies > 0) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <Ionicons name="flash-outline" size={12} color={C.accent} />
                  <Text style={{ fontSize: 11, color: C.accent }}>
                    This program covers {capabilityCount.competencies} capabilities
                    {capabilityCount.subCompetencies > 0 ? ` across ${capabilityCount.subCompetencies} sub-competencies` : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., MHI Global Health Playbook"
              placeholderTextColor={C.labelLight}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what subscribers will learn by following this blueprint..."
              placeholderTextColor={C.labelLight}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* URL preview */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Blueprint URL</Text>
            <View style={styles.urlRow}>
              <Text style={styles.urlPrefix}>better.at</Text>
              <Text style={styles.urlSlug}>{blueprintUrl}</Text>
              {isEditing && activeBlueprint?.is_published && (
                <Pressable style={styles.copyBtn} onPress={handleShareLink}>
                  <Ionicons name="share-outline" size={14} color={C.accent} />
                </Pressable>
              )}
            </View>
          </View>

          {/* What gets shared */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={14} color={C.labelMid} />
            <Text style={styles.infoText}>
              {isEditing
                ? 'Subscribers see the steps you curate for this blueprint. You can manage which steps are included after publishing.'
                : 'After publishing, you can curate which steps are included. By default, all your non-private steps for this interest will be visible.'}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.publishBtn, (!title.trim() || createBlueprint.isPending || updateBlueprint.isPending) && styles.publishBtnDisabled]}
              onPress={handlePublish}
              disabled={!title.trim() || createBlueprint.isPending || updateBlueprint.isPending}
            >
              {(createBlueprint.isPending || updateBlueprint.isPending) ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="rocket-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.publishBtnText}>
                {(createBlueprint.isPending || updateBlueprint.isPending)
                  ? 'Publishing...'
                  : isEditing ? 'Save Changes' : 'Publish Blueprint'}
              </Text>
            </Pressable>

            {isEditing && activeBlueprint?.is_published && (
              <>
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: C.accent,
                    borderRadius: 10,
                    paddingVertical: 11,
                  }}
                  onPress={() => {
                    setCuratingBlueprintId(activeBlueprint.id);
                    setShowStepCurator(true);
                  }}
                >
                  <Ionicons name="checkmark-done-outline" size={16} color={C.accent} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.accent }}>Curate Steps</Text>
                </Pressable>
                {/* Auto-curate toggle */}
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                  }}
                  onPress={() => setAutoCurate(!autoCurate)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name="flash-outline" size={18} color={C.labelMid} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: C.labelDark }}>Auto-publish new steps</Text>
                      <Text style={{ fontSize: 12, color: C.labelMid, marginTop: 2 }}>New timeline steps automatically appear in this blueprint</Text>
                    </View>
                  </View>
                  <View style={{
                    width: 44, height: 24, borderRadius: 12,
                    backgroundColor: autoCurate ? C.accent : '#D1D5DB',
                    justifyContent: 'center',
                    paddingHorizontal: 2,
                  }}>
                    <View style={{
                      width: 20, height: 20, borderRadius: 10,
                      backgroundColor: '#FFFFFF',
                      alignSelf: autoCurate ? 'flex-end' : 'flex-start',
                    }} />
                  </View>
                </Pressable>
                {/* Move to different interest */}
                {!showMoveInterest ? (
                  <Pressable
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: 10,
                      paddingVertical: 11,
                    }}
                    onPress={() => setShowMoveInterest(true)}
                  >
                    <Ionicons name="swap-horizontal-outline" size={16} color={C.labelMid} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.labelMid }}>Move to Different Interest</Text>
                  </Pressable>
                ) : (
                  <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.labelDark }}>Move blueprint to:</Text>
                    {userInterests
                      .filter((i) => i.id !== interestId)
                      .map((interest) => (
                        <Pressable
                          key={interest.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: C.border,
                          }}
                          onPress={() => {
                            showConfirm(
                              'Move Blueprint',
                              `Move this blueprint to ${interest.name}? Your ${activeBlueprint?.subscriber_count ?? 0} subscriber(s) will keep their adopted steps. The blueprint will appear under ${interest.name} going forward.`,
                              async () => {
                                try {
                                  await migrateBlueprintMutation.mutateAsync({
                                    blueprintId: activeBlueprint!.id,
                                    newInterestId: interest.id,
                                  });
                                  showAlert('Moved', `Blueprint moved to ${interest.name}`);
                                  setShowMoveInterest(false);
                                  onClose();
                                } catch (err: any) {
                                  showAlert('Error', err?.message ?? 'Failed to move blueprint');
                                }
                              },
                            );
                          }}
                          disabled={migrateBlueprintMutation.isPending}
                        >
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: interest.accent_color }} />
                          <Text style={{ fontSize: 14, fontWeight: '500', color: C.labelDark, flex: 1 }}>{interest.name}</Text>
                          <Ionicons name="arrow-forward" size={14} color={C.labelLight} />
                        </Pressable>
                      ))}
                    {userInterests.filter((i) => i.id !== interestId).length === 0 && (
                      <Text style={{ fontSize: 13, color: C.labelMid, textAlign: 'center', paddingVertical: 8 }}>
                        Add another interest first to move this blueprint.
                      </Text>
                    )}
                    <Pressable onPress={() => setShowMoveInterest(false)} style={{ alignSelf: 'center', paddingVertical: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: C.labelMid }}>Cancel</Text>
                    </Pressable>
                  </View>
                )}
                <Pressable style={styles.unpublishBtn} onPress={handleUnpublish}>
                  <Text style={styles.unpublishText}>Unpublish</Text>
                </Pressable>
              </>
            )}

            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
          </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'web' ? 24 : 40,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.labelDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: C.labelMid,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.successText,
  },
  subscriberCount: {
    fontSize: 11,
    color: C.labelMid,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.labelDark,
  },
  textArea: {
    minHeight: 72,
    paddingTop: 10,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F7F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  urlPrefix: {
    fontSize: 12,
    color: C.labelLight,
  },
  urlSlug: {
    fontSize: 12,
    fontWeight: '600',
    color: C.accent,
    flex: 1,
  },
  copyBtn: {
    padding: 4,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#F5F5F4',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 11,
    color: C.labelMid,
    lineHeight: 16,
    flex: 1,
  },
  actions: {
    gap: 8,
    marginBottom: 8,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 13,
  },
  publishBtnDisabled: {
    opacity: 0.5,
  },
  publishBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unpublishBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  unpublishText: {
    fontSize: 13,
    color: C.danger,
    fontWeight: '500',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 13,
    color: C.labelMid,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  programChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
  },
  programChipActive: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  programChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.labelMid,
  },
  programChipTextActive: {
    color: C.accent,
    fontWeight: '600',
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
    flex: 1,
    minWidth: 80,
    justifyContent: 'center',
  },
  segmentBtnActive: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.labelMid,
  },
  segmentTextActive: {
    color: C.accent,
    fontWeight: '600',
  },
  successState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  successIconWrap: {
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.labelDark,
  },
  successSubtitle: {
    fontSize: 14,
    color: C.labelMid,
    textAlign: 'center',
    marginBottom: 12,
  },
});
