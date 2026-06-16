import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useWorkspaceDomain } from '@/hooks/useWorkspaceDomain';
import {
  ProgramTemplateRecord,
  ProgramTemplateType,
  programService,
} from '@/services/ProgramService';

const TEMPLATE_TYPE_OPTIONS: ProgramTemplateType[] = [
  'program',
  'session',
  'checklist',
  'assessment',
  'message',
];

const formatLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function ProgramTemplatesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { user } = useAuth();
  const { activeOrganization, canManageActiveOrganization, ready } = useOrganization();
  const { activeDomain } = useWorkspaceDomain();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<ProgramTemplateRecord[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState<ProgramTemplateType>('checklist');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [hasMutations, setHasMutations] = useState(false);

  const handleBack = () => {
    if (hasMutations || !router.canGoBack()) {
      router.replace({
        pathname: '/(tabs)/programs',
        params: {
          refresh: String(Date.now()),
          action: 'templates-updated',
        },
      } as any);
      return;
    }
    router.back();
  };

  useEffect(() => {
    const rawType = String(params.type || '').toLowerCase();
    if (TEMPLATE_TYPE_OPTIONS.includes(rawType as ProgramTemplateType)) {
      setTemplateType(rawType as ProgramTemplateType);
    }
  }, [params.type]);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await programService.listProgramTemplates(
        activeOrganization?.id || null,
        activeDomain,
        templateType,
        200
      );
      setTemplates(rows);
      if (editingTemplateId && !rows.some((row) => row.id === editingTemplateId)) {
        setEditingTemplateId(null);
      }
    } catch (error: any) {
      showAlert('Unable to load templates', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeDomain, activeOrganization?.id, editingTemplateId, templateType]);

  useEffect(() => {
    if (!ready) return;
    void loadTemplates();
  }, [ready, loadTemplates]);

  const createTemplate = async () => {
    if (!user?.id) return;
    if (!canManageActiveOrganization) {
      showAlert('Permission required', 'You need organization management access to create templates.');
      return;
    }
    const nextTitle = title.trim();
    if (!nextTitle) {
      showAlert('Title required', 'Enter a template title.');
      return;
    }

    try {
      setCreating(true);
      const created = await programService.createProgramTemplate({
        created_by: user.id,
        organization_id: activeOrganization?.id || null,
        domain: activeDomain,
        template_type: templateType,
        title: nextTitle,
        description: description.trim() || null,
        is_shared: false,
      });
      setTemplates((prev) => [created, ...prev]);
      setEditingTemplateId(created.id);
      setTitle('');
      setDescription('');
      setHasMutations(true);
    } catch (error: any) {
      showAlert('Unable to create template', error?.message || 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (template: ProgramTemplateRecord) => {
    setEditingTemplateId(template.id);
    setTitle(template.title || '');
    setDescription(template.description || '');
    setTemplateType(template.template_type);
  };

  const cancelEdit = () => {
    setEditingTemplateId(null);
    setTitle('');
    setDescription('');
  };

  const updateTemplate = async () => {
    if (!editingTemplateId) return;
    if (!canManageActiveOrganization) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      showAlert('Title required', 'Enter a template title.');
      return;
    }
    try {
      setCreating(true);
      const updated = await programService.updateProgramTemplate(editingTemplateId, {
        title: nextTitle,
        description: description.trim() || null,
        template_type: templateType,
      });
      setTemplates((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setEditingTemplateId(null);
      setTitle('');
      setDescription('');
      setHasMutations(true);
    } catch (error: any) {
      showAlert('Unable to update template', error?.message || 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!canManageActiveOrganization) return;
    try {
      await programService.deleteProgramTemplate(templateId);
      setTemplates((prev) => prev.filter((row) => row.id !== templateId));
      setHasMutations(true);
    } catch (error: any) {
      showAlert('Unable to delete template', error?.message || 'Please try again.');
    }
  };

  const helperCopy = useMemo(() => {
    switch (templateType) {
      case 'checklist':
        return 'Create patient-safety and operational readiness checklists for cohorts and sessions.';
      case 'session':
        return 'Define reusable rotation/session structures and expectations.';
      case 'assessment':
        return 'Create competency rubric and evaluation templates for faculty and preceptors.';
      case 'message':
        return 'Create standard communication templates for cohort updates.';
      default:
        return 'Create reusable templates for your organization.';
    }
  }, [templateType]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Program Templates</ThemedText>
          <ThemedText style={styles.subtitle}>{helperCopy}</ThemedText>
        </View>
      </View>

      <View style={styles.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {TEMPLATE_TYPE_OPTIONS.map((option) => {
            const active = option === templateType;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setTemplateType(option)}
              >
                <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                  {formatLabel(option)}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder={`New ${formatLabel(templateType)} template title`}
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#94A3B8"
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Optional description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={[styles.primaryButton, creating && styles.disabledButton]}
          onPress={editingTemplateId ? updateTemplate : createTemplate}
          disabled={creating}
        >
          {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />}
          <ThemedText style={styles.primaryButtonText}>
            {editingTemplateId ? 'Save changes' : 'Create template'}
          </ThemedText>
        </TouchableOpacity>
        {editingTemplateId ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={cancelEdit}>
            <ThemedText style={styles.secondaryButtonText}>Cancel edit</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.card, styles.listCard]}>
        <View style={styles.listHeader}>
          <ThemedText style={styles.listTitle}>{formatLabel(templateType)} templates</ThemedText>
          <TouchableOpacity onPress={() => void loadTemplates()}>
            <Ionicons name="refresh-outline" size={18} color="#007AFF" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        ) : templates.length === 0 ? (
          <View style={styles.centerState}>
            <ThemedText style={styles.stateText}>No templates yet.</ThemedText>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {templates.map((template) => (
              <TouchableOpacity key={template.id} style={styles.templateRow} onPress={() => startEdit(template)}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.templateTitle}>{template.title}</ThemedText>
                  {template.description ? (
                    <ThemedText style={styles.templateDescription}>{template.description}</ThemedText>
                  ) : null}
                </View>
                {templateType === 'assessment' ? (
                  <TouchableOpacity
                    style={styles.useButton}
                    onPress={() => router.push((`/assessments?templateId=${template.id}`) as any)}
                  >
                    <Ionicons name="open-outline" size={14} color="#1D4ED8" />
                    <ThemedText style={styles.useButtonText}>Use</ThemedText>
                  </TouchableOpacity>
                ) : null}
                {canManageActiveOrganization ? (
                  <TouchableOpacity onPress={() => void deleteTemplate(template.id)} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
  },
  listCard: {
    flex: 1,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#EFF6FF',
  },
  chipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1D4ED8',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  centerState: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: '#64748B',
    fontSize: 13,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  templateTitle: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  templateDescription: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
  },
  useButton: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  useButtonText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
});
