/**
 * Fleet Plan Builder — a captain authors a curated, ordered plan of steps for
 * the fleet: the races AND the prep steps between them (practice, fleet
 * training, dinner, etc). Items are ordered by the captain's sequence, not by
 * date. Members later subscribe and selectively adopt individual steps.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import {
  PLAN_ITEM_KINDS,
  PLAN_ITEM_KIND_LABELS,
  type FleetPlanStep,
  type PlanItemKind,
  addPlanItem,
  createFleetPlan,
  getFleetPlanSteps,
  publishFleetPlan,
  removePlanItem,
  reorderPlanItems,
} from '@/services/fleetPlanService';

const COLORS = {
  background: '#FBF9F4',
  text: '#3D3832',
  secondaryText: '#6B7280',
  tertiaryText: '#9CA3AF',
  sectionLabel: '#8E8E93',
  hairline: '#E5E7EB',
  activeBlue: '#007AFF',
  successGreen: '#16A34A',
  deleteRed: '#DC2626',
  chipBg: '#F3F4F6',
};

function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatStepDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FleetPlanBuilderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const params = useLocalSearchParams<{
    fleetId?: string;
    blueprintId?: string;
    fleetName?: string;
  }>();
  const fleetId = params.fleetId ?? '';
  const fleetName = params.fleetName ?? 'fleet';

  const [planId, setPlanId] = useState<string | null>(params.blueprintId ?? null);
  const [isPublished, setIsPublished] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const [steps, setSteps] = useState<FleetPlanStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  // Add-item form
  const [kind, setKind] = useState<PlanItemKind>('race');
  const [itemTitle, setItemTitle] = useState('');
  const [itemDate, setItemDate] = useState('');
  const [itemLocation, setItemLocation] = useState('');
  const [itemDetails, setItemDetails] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const interestId = currentInterest?.id ?? '';

  const loadSteps = useCallback(async (bpId: string) => {
    setLoadingSteps(true);
    try {
      const rows = await getFleetPlanSteps(bpId);
      setSteps(rows);
    } catch (err: any) {
      showAlert('Could not load plan', err?.message ?? 'Please try again.');
    } finally {
      setLoadingSteps(false);
    }
  }, []);

  useEffect(() => {
    if (planId) void loadSteps(planId);
  }, [planId, loadSteps]);

  const handleCreatePlan = useCallback(async () => {
    if (!user?.id || !fleetId) return;
    if (!interestId) {
      showAlert('Pick an interest first', 'Set your active interest, then create the plan.');
      return;
    }
    if (!title.trim()) {
      showAlert('Name your plan', 'Give the season plan a title.');
      return;
    }
    setCreating(true);
    try {
      const plan = await createFleetPlan({
        captainId: user.id,
        fleetId,
        interestId,
        title,
        description,
      });
      setPlanId(plan.id);
      setIsPublished(plan.is_published);
    } catch (err: any) {
      showAlert('Could not create plan', err?.message ?? 'Please try again.');
    } finally {
      setCreating(false);
    }
  }, [user?.id, fleetId, interestId, title, description]);

  const handleAddItem = useCallback(async () => {
    if (!planId) return;
    if (!itemTitle.trim()) {
      showAlert('Name this step', 'Give the step a title.');
      return;
    }
    setAddingItem(true);
    try {
      await addPlanItem({
        blueprintId: planId,
        kind,
        title: itemTitle,
        details: itemDetails,
        startsAt: parseDateInput(itemDate),
        locationName: itemLocation,
      });
      setItemTitle('');
      setItemDate('');
      setItemLocation('');
      setItemDetails('');
      await loadSteps(planId);
    } catch (err: any) {
      showAlert('Could not add step', err?.message ?? 'Please try again.');
    } finally {
      setAddingItem(false);
    }
  }, [planId, kind, itemTitle, itemDetails, itemDate, itemLocation, loadSteps]);

  const handleRemoveItem = useCallback(
    (stepId: string, stepTitle: string | null) => {
      if (!planId) return;
      showConfirm(
        `Remove "${stepTitle ?? 'this step'}"?`,
        'It will be removed from the plan.',
        async () => {
          try {
            await removePlanItem(planId, stepId);
            await loadSteps(planId);
          } catch (err: any) {
            showAlert('Could not remove step', err?.message ?? 'Please try again.');
          }
        },
        { destructive: true },
      );
    },
    [planId, loadSteps],
  );

  const moveItem = useCallback(
    async (index: number, direction: -1 | 1) => {
      if (!planId) return;
      const next = [...steps];
      const target = index + direction;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      setSteps(next);
      try {
        await reorderPlanItems(planId, next.map((s) => s.step_id));
      } catch (err: any) {
        showAlert('Could not reorder', err?.message ?? 'Please try again.');
        void loadSteps(planId);
      }
    },
    [planId, steps, loadSteps],
  );

  const handlePublish = useCallback(async () => {
    if (!planId) return;
    if (steps.length === 0) {
      showAlert('Add a step first', 'A plan needs at least one step before publishing.');
      return;
    }
    setPublishing(true);
    try {
      await publishFleetPlan(planId);
      setIsPublished(true);
      showAlert('Plan published', `Members of ${fleetName} can now subscribe.`);
    } catch (err: any) {
      showAlert('Could not publish', err?.message ?? 'Please try again.');
    } finally {
      setPublishing(false);
    }
  }, [planId, steps.length, fleetName]);

  const headerTitle = useMemo(
    () => (planId ? title || 'Season plan' : 'New season plan'),
    [planId, title],
  );

  // ---- Step 1: name the plan ----
  if (!planId) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'New plan' }} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>SEASON PLAN FOR {fleetName.toUpperCase()}</Text>
          <Text style={styles.helpText}>
            Build a plan of races and the prep steps between them — practice days, fleet training,
            dinners. Members subscribe and pull the steps they want into their own timeline.
          </Text>

          <Text style={styles.fieldLabel}>Plan name</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Impala Winter Series 2025–26"
            placeholderTextColor={COLORS.tertiaryText}
          />

          <Text style={styles.fieldLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="What this season covers and who it's for."
            placeholderTextColor={COLORS.tertiaryText}
            multiline
          />

          <TouchableOpacity
            style={[styles.primaryButton, creating && styles.buttonDisabled]}
            onPress={handleCreatePlan}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Create plan & add steps</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ---- Step 2: add / order / publish steps ----
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: headerTitle }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusRow}>
          <Text style={styles.sectionLabel}>{steps.length} STEPS</Text>
          {isPublished ? (
            <View style={styles.publishedPill}>
              <Text style={styles.publishedPillText}>Published</Text>
            </View>
          ) : (
            <View style={styles.draftPill}>
              <Text style={styles.draftPillText}>Draft</Text>
            </View>
          )}
        </View>

        {/* Existing steps */}
        {loadingSteps ? (
          <ActivityIndicator color={COLORS.activeBlue} style={{ marginVertical: 20 }} />
        ) : steps.length === 0 ? (
          <Text style={styles.emptyText}>No steps yet. Add the first one below.</Text>
        ) : (
          <View style={styles.stepList}>
            {steps.map((step, index) => {
              const dateLabel = formatStepDate(step.starts_at);
              return (
                <View key={step.step_id} style={styles.stepRow}>
                  <View style={styles.stepReorder}>
                    <TouchableOpacity onPress={() => moveItem(index, -1)} disabled={index === 0}>
                      <Text style={[styles.reorderArrow, index === 0 && styles.reorderArrowDisabled]}>
                        ↑
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveItem(index, 1)}
                      disabled={index === steps.length - 1}
                    >
                      <Text
                        style={[
                          styles.reorderArrow,
                          index === steps.length - 1 && styles.reorderArrowDisabled,
                        ]}
                      >
                        ↓
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepKind}>
                      {PLAN_ITEM_KIND_LABELS[(step.category as PlanItemKind)] ?? step.category}
                    </Text>
                    <Text style={styles.stepTitle}>{step.title ?? 'Untitled step'}</Text>
                    {(dateLabel || step.location_name) && (
                      <Text style={styles.stepMeta}>
                        {[dateLabel, step.location_name].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveItem(step.step_id, step.title)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Add item form */}
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>ADD A STEP</Text>

        <View style={styles.kindRow}>
          {PLAN_ITEM_KINDS.map((k) => (
            <TouchableOpacity
              key={k}
              style={[styles.kindChip, kind === k && styles.kindChipActive]}
              onPress={() => setKind(k)}
            >
              <Text style={[styles.kindChipText, kind === k && styles.kindChipTextActive]}>
                {PLAN_ITEM_KIND_LABELS[k]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          value={itemTitle}
          onChangeText={setItemTitle}
          placeholder={kind === 'race' ? 'Race 3 — Middle Island' : 'Practice: spinnaker sets'}
          placeholderTextColor={COLORS.tertiaryText}
        />
        <TextInput
          style={styles.input}
          value={itemDate}
          onChangeText={setItemDate}
          placeholder="Date (optional) — e.g. 2026-01-10 14:00"
          placeholderTextColor={COLORS.tertiaryText}
        />
        <TextInput
          style={styles.input}
          value={itemLocation}
          onChangeText={setItemLocation}
          placeholder="Location (optional)"
          placeholderTextColor={COLORS.tertiaryText}
        />
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={itemDetails}
          onChangeText={setItemDetails}
          placeholder="Details (optional) — what to prepare, what to bring."
          placeholderTextColor={COLORS.tertiaryText}
          multiline
        />

        <TouchableOpacity
          style={[styles.secondaryButton, addingItem && styles.buttonDisabled]}
          onPress={handleAddItem}
          disabled={addingItem}
        >
          {addingItem ? (
            <ActivityIndicator color={COLORS.activeBlue} />
          ) : (
            <Text style={styles.secondaryButtonText}>+ Add step</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {!isPublished && (
          <TouchableOpacity
            style={[styles.primaryButton, publishing && styles.buttonDisabled]}
            onPress={handlePublish}
            disabled={publishing}
          >
            {publishing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Publish to {fleetName}</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.linkText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.sectionLabel,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 4,
  },
  helpText: { fontSize: 14, color: COLORS.secondaryText, lineHeight: 20, marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.hairline,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 10,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: COLORS.activeBlue,
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.activeBlue,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: COLORS.activeBlue },
  buttonDisabled: { opacity: 0.6 },
  doneButton: { alignItems: 'center', paddingVertical: 16 },
  linkText: { fontSize: 14, color: COLORS.activeBlue, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.hairline, marginVertical: 20 },

  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  publishedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 12,
  },
  publishedPillText: { fontSize: 11, fontWeight: '700', color: COLORS.successGreen },
  draftPill: {
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 12,
  },
  draftPillText: { fontSize: 11, fontWeight: '700', color: COLORS.secondaryText },

  emptyText: { fontSize: 14, color: COLORS.tertiaryText, fontStyle: 'italic', marginBottom: 8 },
  stepList: { backgroundColor: '#FFFFFF', borderRadius: 8, overflow: 'hidden' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  stepReorder: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  reorderArrow: { fontSize: 16, color: COLORS.activeBlue, paddingHorizontal: 4 },
  reorderArrowDisabled: { color: COLORS.hairline },
  stepBody: { flex: 1, gap: 2 },
  stepKind: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.tertiaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepTitle: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  stepMeta: { fontSize: 12, color: COLORS.secondaryText },
  removeText: { fontSize: 13, color: COLORS.deleteRed, fontWeight: '500' },

  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kindChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.chipBg,
  },
  kindChipActive: { backgroundColor: COLORS.activeBlue },
  kindChipText: { fontSize: 13, fontWeight: '500', color: COLORS.secondaryText },
  kindChipTextActive: { color: '#FFFFFF' },
});
