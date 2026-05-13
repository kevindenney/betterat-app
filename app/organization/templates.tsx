/**
 * Organization Blueprints Management
 *
 * Admin page for managing org-published blueprints.
 * Supports listing existing blueprints, toggling publish state,
 * and AI curriculum generation that creates real timeline steps
 * packaged into a blueprint.
 *
 * Note: Route is still /organization/templates for backward compat
 * with org-welcome routing. OrgAdminNav shows it as "Blueprints".
 */

import { getInterestEventConfig } from '@/configs';
import { fetchOrganizationInterestSlug } from '@/components/organizations/OrgContextPill';
import { OrgAdminHeader } from '@/components/organizations/OrgAdminHeader';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { supabase } from '@/services/supabase';
import {
  updateBlueprint,
  createBlueprintFromCurriculum,
  generateBlueprintSlug,
  createBlueprint,
} from '@/services/BlueprintService';
import { resolveInterestId } from '@/services/TimelineStepService';
import type { BlueprintRecord } from '@/types/blueprint';
import { isUuid } from '@/utils/uuid';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

type BlueprintWithStepCount = BlueprintRecord & {
  step_count: number;
};

export default function OrganizationBlueprintsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeOrganization, activeOrganizationId, canManageActiveOrganization, memberships } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [blueprints, setBlueprints] = useState<BlueprintWithStepCount[]>([]);
  const [orgInterestSlug, setOrgInterestSlug] = useState<string | null>(null);
  const [_interestLoadFailed, setInterestLoadFailed] = useState(false);

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTitle, setAiTitle] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // Manual creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const resolvedActiveOrgId = String(activeOrganizationId || '').trim()
    || String((memberships || []).find((membership: any) => {
      const status = String(membership?.membership_status || membership?.status || '').trim().toLowerCase();
      return status === 'active';
    })?.organization_id || '').trim();

  const resolvedConfig = orgInterestSlug ? getInterestEventConfig(orgInterestSlug) : null;
  const interestLabel = resolvedConfig?.eventNoun || orgInterestSlug?.replace(/-/g, ' ') || 'learning';

  // Load org interest slug
  useEffect(() => {
    if (!resolvedActiveOrgId || !isUuid(resolvedActiveOrgId)) {
      setOrgInterestSlug(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const interestSlug = await fetchOrganizationInterestSlug(resolvedActiveOrgId);
        if (cancelled) return;
        setInterestLoadFailed(false);
        setOrgInterestSlug(interestSlug);
      } catch {
        if (cancelled) return;
        setInterestLoadFailed(true);
        setOrgInterestSlug(null);
      }
    })();

    return () => { cancelled = true; };
  }, [resolvedActiveOrgId]);

  // Load org blueprints
  const loadBlueprints = useCallback(async () => {
    if (!activeOrganization?.id) {
      setBlueprints([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch all org blueprints (published and unpublished)
      const { data: allBlueprints, error } = await supabase
        .from('timeline_blueprints')
        .select('*')
        .eq('organization_id', activeOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch step counts for each blueprint
      const withCounts: BlueprintWithStepCount[] = await Promise.all(
        (allBlueprints || []).map(async (bp: any) => {
          const { count } = await supabase
            .from('blueprint_steps')
            .select('id', { count: 'exact', head: true })
            .eq('blueprint_id', bp.id);
          return { ...bp, step_count: count ?? 0 } as BlueprintWithStepCount;
        }),
      );

      setBlueprints(withCounts);
    } catch (error: any) {
      showAlert('Unable to load blueprints', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id]);

  useEffect(() => {
    void loadBlueprints();
  }, [loadBlueprints]);

  // Toggle blueprint published state
  const handleTogglePublished = useCallback(async (blueprint: BlueprintWithStepCount) => {
    if (!canManageActiveOrganization) return;
    try {
      const nextPublished = !blueprint.is_published;
      await updateBlueprint(blueprint.id, { is_published: nextPublished });
      setBlueprints((prev) =>
        prev.map((bp) => bp.id === blueprint.id ? { ...bp, is_published: nextPublished } : bp),
      );
    } catch (error: any) {
      showAlert('Unable to update blueprint', error?.message || 'Please try again.');
    }
  }, [canManageActiveOrganization]);

  // Manual blueprint creation
  const handleCreateBlueprint = useCallback(async () => {
    if (!newTitle.trim() || !activeOrganization?.id || !user?.id || !orgInterestSlug) return;

    setCreating(true);
    try {
      const interestId = await resolveInterestId(orgInterestSlug);
      if (!interestId) throw new Error('Could not resolve interest');

      const slug = generateBlueprintSlug(newTitle, orgInterestSlug);
      const bp = await createBlueprint({
        user_id: user.id,
        interest_id: interestId,
        slug,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        is_published: true,
        organization_id: activeOrganization.id,
        access_level: 'org_members',
      });

      setBlueprints((prev) => [{ ...bp, step_count: 0 }, ...prev]);
      setNewTitle('');
      setNewDescription('');
      setShowCreateForm(false);
    } catch (error: any) {
      showAlert('Unable to create blueprint', error?.message || 'Please try again.');
    } finally {
      setCreating(false);
    }
  }, [activeOrganization?.id, newTitle, newDescription, orgInterestSlug, user?.id]);

  // AI curriculum generation → blueprint
  const handleAiGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || !activeOrganization?.id || !user?.id || !orgInterestSlug) return;

    const trimmed = aiPrompt.trim();
    if (/^https?:\/\//.test(trimmed) || (/^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed) && !trimmed.includes(' '))) {
      showAlert(
        'Describe your curriculum instead',
        'Paste a description of your lessons — how many episodes, what topics they cover, and the skill progression. We can\'t scrape websites directly.',
      );
      return;
    }

    setAiGenerating(true);

    try {
      const resolvedConfig = orgInterestSlug ? getInterestEventConfig(orgInterestSlug) : null;
      const availableStepTypes = resolvedConfig?.eventSubtypes?.map((o: any) => o.id).join(', ') || 'general';

      const systemPrompt = `You are a curriculum designer for a ${interestLabel} teaching platform.
Given a curriculum description, generate a JSON object with:
- "title": string (blueprint/curriculum title)
- "description": string (1-2 sentence overview)
- "steps": array of step objects, each with:
  - "title": string (lesson/episode title)
  - "description": string (1-2 sentence description)
  - "step_type": one of [${availableStepTypes}]

Return ONLY a valid JSON object. No markdown fences, no backticks, no explanation text. Just the raw JSON starting with { and ending with }. Generate between 3-15 steps based on the curriculum described.`;

      const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
        body: {
          system: systemPrompt,
          prompt: trimmed,
          max_tokens: 2048,
        },
      });

      if (error) throw error;

      let responseText = typeof data === 'string' ? data : data?.text || data?.message || JSON.stringify(data);
      responseText = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      // Extract JSON object from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI did not return a valid curriculum. Try rephrasing your description.');

      let generated: { title: string; description?: string; steps: { title: string; description?: string; step_type?: string }[] };
      try {
        generated = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error('AI returned invalid JSON. Try a simpler description.');
      }

      if (!Array.isArray(generated.steps) || generated.steps.length === 0) {
        throw new Error('No steps generated');
      }

      const blueprintTitle = aiTitle.trim() || generated.title || 'Untitled Blueprint';

      const { blueprint } = await createBlueprintFromCurriculum({
        userId: user.id,
        organizationId: activeOrganization.id,
        interestSlug: orgInterestSlug,
        blueprintTitle,
        blueprintDescription: generated.description ?? null,
        steps: generated.steps.map((s) => ({
          title: s.title,
          description: s.description ?? null,
          step_type: s.step_type,
        })),
        accessLevel: 'org_members',
      });

      setBlueprints((prev) => [{ ...blueprint, step_count: generated.steps.length }, ...prev]);
      setAiPrompt('');
      setAiTitle('');
    } catch (error: any) {
      console.error('[Blueprints] AI generation error:', error);
      showAlert('Generation failed', error?.message || 'Please try again with a different description.');
    } finally {
      setAiGenerating(false);
    }
  }, [activeOrganization?.id, aiPrompt, aiTitle, interestLabel, orgInterestSlug, user?.id]);

  return (
    <View style={styles.container}>
      <OrgAdminHeader
        title="Blueprints"
        subtitle={`Publish ${interestLabel} learning paths for your members to follow.`}
        interestSlug={orgInterestSlug}
      />

      {!activeOrganization?.id ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Select an active organization first.</Text>
        </View>
      ) : !canManageActiveOrganization ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Organization admin access is required to manage blueprints.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* AI Curriculum Generator */}
          <View style={[styles.card, { borderColor: '#DBEAFE', borderWidth: 1, backgroundColor: '#F8FAFF' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="sparkles" size={20} color="#2563EB" />
              <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>Generate blueprint from curriculum</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>
              Describe your curriculum — we'll create a blueprint with real steps your members can adopt.
            </Text>
            <TextInput
              style={styles.input}
              value={aiTitle}
              onChangeText={setAiTitle}
              placeholder="Blueprint title (optional — we'll suggest one)"
              placeholderTextColor="#94A3B8"
              editable={!aiGenerating}
            />
            <TextInput
              style={[styles.input, styles.textArea, { minHeight: 80 }]}
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder={`e.g. "9 beginner episodes teaching ${interestLabel}. Starts with fundamentals, progresses through intermediate skills, ending with a capstone project."`}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              editable={!aiGenerating}
            />
            <TouchableOpacity
              style={[styles.primaryButton, (!aiPrompt.trim() || aiGenerating || !orgInterestSlug) && styles.disabledButton, { backgroundColor: '#2563EB' }]}
              onPress={() => void handleAiGenerate()}
              disabled={!aiPrompt.trim() || aiGenerating || !orgInterestSlug}
            >
              {aiGenerating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.primaryButtonText}>
                {aiGenerating ? 'Generating blueprint...' : 'Generate blueprint'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Manual Create */}
          {showCreateForm ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>New blueprint</Text>
              <TextInput
                style={styles.input}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Blueprint title"
                placeholderTextColor="#94A3B8"
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Description (optional)"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.primaryButton, { flex: 1 }, (!newTitle.trim() || creating) && styles.disabledButton]}
                  onPress={() => void handleCreateBlueprint()}
                  disabled={!newTitle.trim() || creating}
                >
                  {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />}
                  <Text style={styles.primaryButtonText}>Create</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, { flex: 1, backgroundColor: '#94A3B8' }]}
                  onPress={() => { setShowCreateForm(false); setNewTitle(''); setNewDescription(''); }}
                >
                  <Text style={styles.primaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
              onPress={() => setShowCreateForm(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#2563EB' }}>Create empty blueprint</Text>
            </TouchableOpacity>
          )}

          {/* Blueprint list */}
          <View style={styles.card}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Your blueprints</Text>
              <TouchableOpacity onPress={() => void loadBlueprints()}>
                <Ionicons name="refresh-outline" size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.centerStateCompact}>
                <ActivityIndicator size="small" color="#2563EB" />
              </View>
            ) : blueprints.length === 0 ? (
              <Text style={styles.stateText}>No blueprints yet. Generate one from a curriculum or create an empty one to get started.</Text>
            ) : (
              blueprints.map((bp) => (
                <TouchableOpacity
                  key={bp.id}
                  style={styles.blueprintRow}
                  onPress={() => router.push(`/blueprint/${bp.slug}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.blueprintTextWrap}>
                    <Text style={styles.blueprintTitle}>{bp.title}</Text>
                    {bp.description ? <Text style={styles.blueprintDescription} numberOfLines={2}>{bp.description}</Text> : null}
                    <Text style={styles.blueprintMeta}>
                      {bp.step_count} step{bp.step_count !== 1 ? 's' : ''} · {bp.subscriber_count} subscriber{bp.subscriber_count !== 1 ? 's' : ''}
                      {bp.access_level === 'org_members' ? ' · Members only' : bp.access_level === 'paid' ? ` · $${((bp.price_cents || 0) / 100).toFixed((bp.price_cents || 0) % 100 === 0 ? 0 : 2)}` : ' · Public'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.publishPill, bp.is_published ? styles.publishOn : styles.publishOff]}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        void handleTogglePublished(bp);
                      }}
                    >
                      <Text style={[styles.publishPillText, bp.is_published ? styles.publishOnText : styles.publishOffText]}>
                        {bp.is_published ? 'Published' : 'Hidden'}
                      </Text>
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blueprintRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  blueprintTextWrap: {
    flex: 1,
    gap: 4,
  },
  blueprintTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  blueprintDescription: {
    fontSize: 12,
    color: '#475569',
  },
  blueprintMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  publishPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  publishOn: {
    backgroundColor: '#ECFDF3',
    borderColor: '#ABEFC6',
  },
  publishOff: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  publishPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  publishOnText: {
    color: '#067647',
  },
  publishOffText: {
    color: '#334155',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerStateCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  stateText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
});
