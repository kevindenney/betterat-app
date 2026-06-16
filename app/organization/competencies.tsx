import { getActiveMembership, isActiveMembership, isOrgAdminRole, resolveActiveOrgId } from '@/lib/organizations/adminGate';
import { fetchOrganizationInterestSlug } from '@/components/organizations/OrgContextPill';
import { OrgAdminHeader } from '@/components/organizations/OrgAdminHeader';
import { useOrganization } from '@/providers/OrganizationProvider';
import { isUuid } from '@/utils/uuid';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import {
  getOrgCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  adoptTemplateCompetency,
  getSubCompetencies,
  createSubCompetency,
  deleteSubCompetency,
  reorderCompetencies,
} from '@/services/competencyService';
import { fetchVocabulary, vocab, getFallbackVocabulary } from '@/lib/vocabulary';
import type { Competency, UpdateCompetencyPayload } from '@/types/competency';
import type { SubCompetency } from '@/types/sub-competency';

type CompetencyWithSubs = Competency & { subCompetencies?: SubCompetency[] };

type EditingState = {
  id: string;
  title: string;
  description: string;
  category: string;
  requires_supervision: boolean;
};

export default function OrganizationCompetenciesScreen() {
  const {
    activeOrganization,
    activeOrganizationId,
    memberships,
    loading: orgLoading,
    ready: orgReady,
  } = useOrganization();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [competencies, setCompetencies] = useState<CompetencyWithSubs[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubComps, setExpandedSubComps] = useState<Set<string>>(new Set());
  const [editingComp, setEditingComp] = useState<EditingState | null>(null);
  const [orgInterestSlug, setOrgInterestSlug] = useState<string | null>(null);
  const [orgInterestId, setOrgInterestId] = useState<string | null>(null);
  const [vocabulary, setVocabulary] = useState(getFallbackVocabulary());

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newSupervision, setNewSupervision] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Sub-competency create form
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDescription, setNewSubDescription] = useState('');

  const resolvedActiveOrgId = useMemo(
    () => resolveActiveOrgId({ activeOrganizationId, memberships: memberships as any }),
    [activeOrganizationId, memberships]
  );
  const activeOrgMembership = useMemo(
    () => getActiveMembership({ memberships: memberships as any, activeOrgId: resolvedActiveOrgId }),
    [memberships, resolvedActiveOrgId]
  );

  const hasValidActiveOrgId = Boolean(resolvedActiveOrgId && isUuid(resolvedActiveOrgId));
  const membershipStatus = activeOrgMembership?.membershipStatus || null;
  const membershipRole = activeOrgMembership?.role || null;
  const hasActiveMembership = isActiveMembership(membershipStatus);
  const hasAdminRole = isOrgAdminRole(membershipRole);
  const canManage = hasValidActiveOrgId && hasActiveMembership && hasAdminRole;

  // Fetch org interest slug and ID
  useEffect(() => {
    if (!resolvedActiveOrgId || !isUuid(resolvedActiveOrgId)) {
      setOrgInterestSlug(null);
      setOrgInterestId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const interestSlug = await fetchOrganizationInterestSlug(resolvedActiveOrgId);
        if (cancelled) return;
        setOrgInterestSlug(interestSlug);

        // Fetch the interest ID from Supabase
        if (interestSlug) {
          const { supabase } = await import('@/services/supabase');
          const { data } = await supabase
            .from('interests')
            .select('id')
            .eq('slug', interestSlug)
            .maybeSingle();
          if (!cancelled && data) {
            setOrgInterestId((data as any).id);
          }
        }
      } catch {
        if (!cancelled) {
          setOrgInterestSlug(null);
          setOrgInterestId(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [resolvedActiveOrgId]);

  // Fetch vocabulary
  useEffect(() => {
    if (!orgInterestId) {
      setVocabulary(getFallbackVocabulary(orgInterestSlug));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const v = await fetchVocabulary(orgInterestId, orgInterestSlug ?? undefined);
        if (!cancelled) setVocabulary(v);
      } catch {
        if (!cancelled) setVocabulary(getFallbackVocabulary(orgInterestSlug));
      }
    })();
    return () => { cancelled = true; };
  }, [orgInterestId, orgInterestSlug]);

  const competencyLabel = vocab('Competency', vocabulary);
  const competencyLabelPlural = `${competencyLabel === 'Competency' ? 'Competencies' : `${competencyLabel}s`}`;
  const supervisionLabel = vocab('Supervision', vocabulary);

  const loadCompetencies = useCallback(async () => {
    if (!canManage || !resolvedActiveOrgId || !orgInterestId) {
      setCompetencies([]);
      return;
    }

    setLoading(true);
    setErrorText(null);
    try {
      const rows = await getOrgCompetencies(orgInterestId, resolvedActiveOrgId);
      setCompetencies(rows as CompetencyWithSubs[]);

      // Auto-expand all categories on first load
      const cats = new Set(rows.map((r) => r.category));
      setExpandedCategories(cats);
    } catch (err: any) {
      setErrorText(err?.message || 'Could not load competencies.');
      setCompetencies([]);
    } finally {
      setLoading(false);
    }
  }, [canManage, orgInterestId, resolvedActiveOrgId]);

  useEffect(() => {
    if (!orgReady || orgLoading || !canManage || !orgInterestId) {
      setCompetencies([]);
      setLoading(false);
      return;
    }
    void loadCompetencies();
  }, [canManage, loadCompetencies, orgLoading, orgReady, orgInterestId]);

  // Group competencies by category
  const categorized = useMemo(() => {
    const map = new Map<string, CompetencyWithSubs[]>();
    for (const c of competencies) {
      const cat = c.category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(c);
    }
    return map;
  }, [competencies]);

  const existingCategories = useMemo(
    () => Array.from(new Set(competencies.map((c) => c.category).filter(Boolean))),
    [competencies]
  );

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleLoadSubCompetencies = useCallback(async (compId: string) => {
    const isExpanded = expandedSubComps.has(compId);
    if (isExpanded) {
      setExpandedSubComps((prev) => {
        const next = new Set(prev);
        next.delete(compId);
        return next;
      });
      return;
    }

    try {
      const subs = await getSubCompetencies(compId);
      setCompetencies((prev) =>
        prev.map((c) => (c.id === compId ? { ...c, subCompetencies: subs as SubCompetency[] } : c))
      );
      setExpandedSubComps((prev) => new Set(prev).add(compId));
    } catch {
      // Silent fail - sub-competencies are optional
    }
  }, [expandedSubComps]);

  const handleCreate = useCallback(async () => {
    if (!canManage || !resolvedActiveOrgId || !orgInterestId) return;
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      setErrorText('Title is required.');
      return;
    }

    setSaving(true);
    setErrorText(null);
    try {
      const maxNumber = competencies.reduce((max, c) => Math.max(max, c.competency_number), 0);
      const maxSort = competencies.reduce((max, c) => Math.max(max, c.sort_order), 0);

      await createCompetency({
        interest_id: orgInterestId,
        organization_id: resolvedActiveOrgId,
        category: newCategory.trim() || 'General',
        competency_number: maxNumber + 1,
        title: trimmedTitle,
        description: newDescription.trim() || null,
        requires_supervision: newSupervision,
        sort_order: maxSort + 1,
      });

      setNewTitle('');
      setNewDescription('');
      setNewCategory('');
      setNewSupervision(false);
      setShowCreateForm(false);
      await loadCompetencies();
      setSuccessText(`Created "${trimmedTitle}".`);
      setTimeout(() => setSuccessText(null), 4000);
    } catch (err: any) {
      setErrorText(err?.message || 'Could not create competency.');
    } finally {
      setSaving(false);
    }
  }, [canManage, competencies, loadCompetencies, newCategory, newDescription, newSupervision, newTitle, orgInterestId, resolvedActiveOrgId]);

  const handleAdopt = useCallback(async (templateId: string) => {
    if (!canManage || !resolvedActiveOrgId) {
      console.warn('[competencies] handleAdopt blocked: canManage=', canManage, 'orgId=', resolvedActiveOrgId);
      return;
    }
    setSaving(true);
    setErrorText(null);
    setSuccessText(null);
    try {
      const result = await adoptTemplateCompetency(templateId, resolvedActiveOrgId);
      await loadCompetencies();
      setSuccessText(`Adopted "${result.title}" — you can now edit it.`);
      setTimeout(() => setSuccessText(null), 4000);
    } catch (err: any) {
      console.error('[competencies] Adopt failed', err);
      setErrorText(err?.message || 'Could not adopt template.');
    } finally {
      setSaving(false);
    }
  }, [canManage, loadCompetencies, resolvedActiveOrgId]);

  const handleStartEdit = useCallback((comp: Competency) => {
    setEditingComp({
      id: comp.id,
      title: comp.title,
      description: comp.description || '',
      category: comp.category,
      requires_supervision: comp.requires_supervision,
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingComp) return;
    setSaving(true);
    setErrorText(null);
    try {
      const payload: UpdateCompetencyPayload = {
        title: editingComp.title.trim(),
        description: editingComp.description.trim() || null,
        category: editingComp.category.trim() || 'General',
        requires_supervision: editingComp.requires_supervision,
      };
      await updateCompetency(editingComp.id, payload);
      setEditingComp(null);
      await loadCompetencies();
    } catch (err: any) {
      setErrorText(err?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }, [editingComp, loadCompetencies]);

  const handleDelete = useCallback((comp: Competency) => {
    showConfirm(
      `Delete ${competencyLabel}?`,
      `Delete "${comp.title}"? This cannot be undone.`,
      () => {
        void (async () => {
          setSaving(true);
          setErrorText(null);
          try {
            await deleteCompetency(comp.id);
            await loadCompetencies();
          } catch (err: any) {
            setErrorText(err?.message || 'Could not delete.');
          } finally {
            setSaving(false);
          }
        })();
      },
      { destructive: true },
    );
  }, [competencyLabel, loadCompetencies]);

  const handleMoveUp = useCallback(async (comp: Competency, categoryComps: CompetencyWithSubs[]) => {
    const idx = categoryComps.findIndex((c) => c.id === comp.id);
    if (idx <= 0) return;
    const reordered = [...categoryComps];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    try {
      await reorderCompetencies(reordered.map((c) => c.id));
      await loadCompetencies();
    } catch {
      // silent
    }
  }, [loadCompetencies]);

  const handleMoveDown = useCallback(async (comp: Competency, categoryComps: CompetencyWithSubs[]) => {
    const idx = categoryComps.findIndex((c) => c.id === comp.id);
    if (idx < 0 || idx >= categoryComps.length - 1) return;
    const reordered = [...categoryComps];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    try {
      await reorderCompetencies(reordered.map((c) => c.id));
      await loadCompetencies();
    } catch {
      // silent
    }
  }, [loadCompetencies]);

  const handleCreateSub = useCallback(async (compId: string) => {
    if (!canManage || !resolvedActiveOrgId) return;
    const trimmedTitle = newSubTitle.trim();
    if (!trimmedTitle) return;

    setSaving(true);
    try {
      await createSubCompetency({
        competency_id: compId,
        organization_id: resolvedActiveOrgId,
        title: trimmedTitle,
        description: newSubDescription.trim() || null,
      });
      setNewSubTitle('');
      setNewSubDescription('');
      setAddingSubFor(null);
      // Reload sub-competencies
      const subs = await getSubCompetencies(compId);
      setCompetencies((prev) =>
        prev.map((c) => (c.id === compId ? { ...c, subCompetencies: subs as SubCompetency[] } : c))
      );
    } catch (err: any) {
      setErrorText(err?.message || 'Could not create sub-competency.');
    } finally {
      setSaving(false);
    }
  }, [canManage, newSubDescription, newSubTitle, resolvedActiveOrgId]);

  const handleDeleteSub = useCallback((sub: SubCompetency, parentCompId: string) => {
    showConfirm(
      'Delete sub-competency?',
      `Delete "${sub.title}"?`,
      () => {
        void (async () => {
          try {
            await deleteSubCompetency(sub.id);
            const subs = await getSubCompetencies(parentCompId);
            setCompetencies((prev) =>
              prev.map((c) => (c.id === parentCompId ? { ...c, subCompetencies: subs as SubCompetency[] } : c))
            );
          } catch {
            // silent
          }
        })();
      },
      { destructive: true },
    );
  }, []);

  const isTemplate = (comp: Competency) => !comp.organization_id;

  const title = useMemo(
    () => `${competencyLabelPlural}${activeOrganization?.name ? ` · ${activeOrganization.name}` : ''}`,
    [activeOrganization?.name, competencyLabelPlural]
  );

  return (
    <View style={styles.container}>
      <OrgAdminHeader
        title={title}
        subtitle={`Manage ${competencyLabelPlural.toLowerCase()} for your organization.`}
        interestSlug={orgInterestSlug}
      />

      {!orgReady || orgLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : !hasValidActiveOrgId ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Select an active organization first.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/settings/organization-access')}>
            <Text style={styles.primaryButtonText}>Open Organization Access</Text>
          </TouchableOpacity>
        </View>
      ) : !hasActiveMembership ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Active membership required.</Text>
        </View>
      ) : !hasAdminRole ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Admin access required.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Create form */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.listHeader}
              onPress={() => setShowCreateForm((p) => !p)}
            >
              <Text style={styles.sectionTitle}>Add {competencyLabel}</Text>
              <Ionicons name={showCreateForm ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
            </TouchableOpacity>

            {showCreateForm && (
              <View style={styles.formSection}>
                <TextInput
                  style={styles.input}
                  placeholder="Title"
                  placeholderTextColor="#94A3B8"
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Description (optional)"
                  placeholderTextColor="#94A3B8"
                  value={newDescription}
                  onChangeText={setNewDescription}
                  multiline
                  numberOfLines={3}
                />
                <TextInput
                  style={styles.input}
                  placeholder={`Category (e.g. ${existingCategories[0] || 'General'})`}
                  placeholderTextColor="#94A3B8"
                  value={newCategory}
                  onChangeText={setNewCategory}
                />
                {existingCategories.length > 0 && (
                  <View style={styles.categoryChipsRow}>
                    {existingCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryChip, newCategory === cat && styles.categoryChipActive]}
                        onPress={() => setNewCategory(cat)}
                      >
                        <Text style={[styles.categoryChipText, newCategory === cat && styles.categoryChipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {supervisionLabel ? (
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{supervisionLabel}</Text>
                    <Switch value={newSupervision} onValueChange={setNewSupervision} />
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.primaryButton, saving && styles.disabledButton]}
                  onPress={() => void handleCreate()}
                  disabled={saving}
                >
                  <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : `Create ${competencyLabel}`}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Competency list by category */}
          <View style={styles.card}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>
                {competencyLabelPlural} ({competencies.length})
              </Text>
              <TouchableOpacity onPress={() => void loadCompetencies()}>
                <Ionicons name="refresh-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
            {successText ? <Text style={styles.successText}>{successText}</Text> : null}

            {loading ? (
              <View style={styles.centerStateCompact}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            ) : competencies.length === 0 ? (
              <Text style={styles.stateText}>No {competencyLabelPlural.toLowerCase()} found.</Text>
            ) : (
              Array.from(categorized.entries()).map(([category, comps]) => {
                const isExpanded = expandedCategories.has(category);
                return (
                  <View key={category} style={styles.categoryGroup}>
                    <TouchableOpacity
                      style={styles.categoryHeader}
                      onPress={() => toggleCategory(category)}
                    >
                      <Ionicons
                        name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color="#475569"
                      />
                      <Text style={styles.categoryTitle}>{category}</Text>
                      <Text style={styles.categoryCount}>{comps.length}</Text>
                    </TouchableOpacity>

                    {isExpanded &&
                      comps.map((comp, idx) => {
                        const template = isTemplate(comp);
                        const editing = editingComp?.id === comp.id;
                        const subsExpanded = expandedSubComps.has(comp.id);

                        return (
                          <View key={comp.id} style={styles.compCard}>
                            {/* Header row */}
                            <View style={styles.compHeader}>
                              <View style={styles.compTextWrap}>
                                {editing ? (
                                  <>
                                    <TextInput
                                      style={styles.editInput}
                                      value={editingComp.title}
                                      onChangeText={(v) => setEditingComp({ ...editingComp, title: v })}
                                    />
                                    <TextInput
                                      style={[styles.editInput, styles.textArea]}
                                      value={editingComp.description}
                                      onChangeText={(v) => setEditingComp({ ...editingComp, description: v })}
                                      multiline
                                      numberOfLines={2}
                                    />
                                    <TextInput
                                      style={styles.editInput}
                                      value={editingComp.category}
                                      onChangeText={(v) => setEditingComp({ ...editingComp, category: v })}
                                      placeholder="Category"
                                      placeholderTextColor="#94A3B8"
                                    />
                                    {supervisionLabel ? (
                                      <View style={styles.switchRow}>
                                        <Text style={styles.switchLabel}>{supervisionLabel}</Text>
                                        <Switch
                                          value={editingComp.requires_supervision}
                                          onValueChange={(v) => setEditingComp({ ...editingComp, requires_supervision: v })}
                                        />
                                      </View>
                                    ) : null}
                                    <View style={styles.editActions}>
                                      <TouchableOpacity
                                        style={styles.saveButton}
                                        onPress={() => void handleSaveEdit()}
                                        disabled={saving}
                                      >
                                        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => setEditingComp(null)}>
                                        <Text style={styles.cancelText}>Cancel</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </>
                                ) : (
                                  <>
                                    <Text style={styles.compTitle}>
                                      #{comp.competency_number} {comp.title}
                                    </Text>
                                    {comp.description ? (
                                      <Text style={styles.compDescription}>{comp.description}</Text>
                                    ) : null}
                                  </>
                                )}
                              </View>

                              {!editing && (
                                <View style={styles.compBadges}>
                                  <View style={[styles.scopeBadge, template ? styles.templateBadge : styles.customBadge]}>
                                    <Text style={[styles.scopeBadgeText, template ? styles.templateBadgeText : styles.customBadgeText]}>
                                      {template ? 'Template' : 'Custom'}
                                    </Text>
                                  </View>
                                  {comp.requires_supervision && supervisionLabel ? (
                                    <View style={styles.supervisionBadge}>
                                      <Text style={styles.supervisionBadgeText}>{supervisionLabel}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              )}
                            </View>

                            {/* Actions */}
                            {!editing && (
                              <View style={styles.compActions}>
                                {template ? (
                                  <TouchableOpacity
                                    style={[styles.adoptButton, saving && styles.disabledButton]}
                                    onPress={() => void handleAdopt(comp.id)}
                                    disabled={saving}
                                  >
                                    <Ionicons name="copy-outline" size={14} color="#6D28D9" />
                                    <Text style={styles.adoptButtonText}>Adopt & Customize</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <>
                                    <TouchableOpacity onPress={() => handleStartEdit(comp)} style={styles.iconButton}>
                                      <Ionicons name="pencil-outline" size={16} color="#007AFF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(comp)} style={styles.iconButton}>
                                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                    </TouchableOpacity>
                                    {idx > 0 && (
                                      <TouchableOpacity onPress={() => void handleMoveUp(comp, comps)} style={styles.iconButton}>
                                        <Ionicons name="arrow-up-outline" size={16} color="#475569" />
                                      </TouchableOpacity>
                                    )}
                                    {idx < comps.length - 1 && (
                                      <TouchableOpacity onPress={() => void handleMoveDown(comp, comps)} style={styles.iconButton}>
                                        <Ionicons name="arrow-down-outline" size={16} color="#475569" />
                                      </TouchableOpacity>
                                    )}
                                  </>
                                )}

                                <TouchableOpacity
                                  onPress={() => void handleLoadSubCompetencies(comp.id)}
                                  style={styles.iconButton}
                                >
                                  <Ionicons
                                    name={subsExpanded ? 'list' : 'list-outline'}
                                    size={16}
                                    color="#475569"
                                  />
                                </TouchableOpacity>
                              </View>
                            )}

                            {/* Sub-competencies */}
                            {subsExpanded && comp.subCompetencies && (
                              <View style={styles.subsSection}>
                                {comp.subCompetencies.length === 0 ? (
                                  <Text style={styles.subsEmpty}>No sub-competencies.</Text>
                                ) : (
                                  comp.subCompetencies.map((sub) => (
                                    <View key={sub.id} style={styles.subRow}>
                                      <View style={styles.subTextWrap}>
                                        <Text style={styles.subTitle}>{sub.title}</Text>
                                        {sub.description ? (
                                          <Text style={styles.subDescription}>{sub.description}</Text>
                                        ) : null}
                                      </View>
                                      {!template && sub.organization_id && (
                                        <TouchableOpacity
                                          onPress={() => handleDeleteSub(sub, comp.id)}
                                          style={styles.iconButton}
                                        >
                                          <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  ))
                                )}

                                {/* Add sub-competency */}
                                {!template && (
                                  <>
                                    {addingSubFor === comp.id ? (
                                      <View style={styles.subForm}>
                                        <TextInput
                                          style={styles.input}
                                          placeholder="Sub-competency title"
                                          placeholderTextColor="#94A3B8"
                                          value={newSubTitle}
                                          onChangeText={setNewSubTitle}
                                        />
                                        <TextInput
                                          style={styles.input}
                                          placeholder="Description (optional)"
                                          placeholderTextColor="#94A3B8"
                                          value={newSubDescription}
                                          onChangeText={setNewSubDescription}
                                        />
                                        <View style={styles.subFormActions}>
                                          <TouchableOpacity
                                            style={[styles.saveButton, saving && styles.disabledButton]}
                                            onPress={() => void handleCreateSub(comp.id)}
                                            disabled={saving}
                                          >
                                            <Text style={styles.saveButtonText}>Add</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity onPress={() => { setAddingSubFor(null); setNewSubTitle(''); setNewSubDescription(''); }}>
                                            <Text style={styles.cancelText}>Cancel</Text>
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    ) : (
                                      <TouchableOpacity
                                        style={styles.addSubButton}
                                        onPress={() => setAddingSubFor(comp.id)}
                                      >
                                        <Ionicons name="add-outline" size={14} color="#007AFF" />
                                        <Text style={styles.addSubButtonText}>Add sub-competency</Text>
                                      </TouchableOpacity>
                                    )}
                                  </>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formSection: { gap: 8 },
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
  editInput: {
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  primaryButton: {
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  disabledButton: { opacity: 0.6 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, color: '#334155' },
  categoryChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
  },
  categoryChipActive: { borderColor: '#93C5FD', backgroundColor: '#EFF6FF' },
  categoryChipText: { fontSize: 12, color: '#334155' },
  categoryChipTextActive: { color: '#1D4ED8', fontWeight: '600' },
  categoryGroup: { gap: 6 },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  categoryTitle: { fontSize: 14, fontWeight: '700', color: '#334155', flex: 1 },
  categoryCount: { fontSize: 12, color: '#64748B' },
  compCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginLeft: 8,
  },
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  compTextWrap: { flex: 1, gap: 4 },
  compTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  compDescription: { fontSize: 12, color: '#475569' },
  compBadges: { alignItems: 'flex-end', gap: 4 },
  scopeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  templateBadge: { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  templateBadgeText: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  customBadge: { borderColor: '#A5B4FC', backgroundColor: '#EEF2FF' },
  customBadgeText: { fontSize: 10, fontWeight: '600', color: '#4338CA' },
  scopeBadgeText: {},
  supervisionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FBBF24',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  supervisionBadgeText: { fontSize: 10, fontWeight: '600', color: '#92400E' },
  compActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  adoptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adoptButtonText: { fontSize: 12, fontWeight: '600', color: '#6D28D9' },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  saveButton: {
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  saveButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  cancelText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  subsSection: { gap: 6, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  subsEmpty: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  subTextWrap: { flex: 1, gap: 2 },
  subTitle: { fontSize: 13, fontWeight: '600', color: '#334155' },
  subDescription: { fontSize: 11, color: '#64748B' },
  subForm: { gap: 6 },
  subFormActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addSubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  addSubButtonText: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
  errorText: { fontSize: 12, color: '#B42318' },
  successText: { fontSize: 12, color: '#067647', fontWeight: '600' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  centerStateCompact: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  stateText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
});
