/**
 * Widget Manager Component
 * UI for clubs to create and manage embeddable widgets
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import {
  Code,
  Copy,
  Trash2,
  Plus,
  ExternalLink,
  Eye,
  EyeOff,
  Settings,
  Check,
  X,
} from 'lucide-react-native';
import { PublicPublishingService, WidgetConfig, WidgetType, CreateWidgetInput } from '@/services/PublicPublishingService';

interface WidgetManagerProps {
  clubId: string;
  regattaId?: string;
  onClose?: () => void;
}

const WIDGET_TYPES: { type: WidgetType; label: string; description: string; icon: string }[] = [
  { type: 'results', label: 'Results', description: 'Live standings table', icon: '🏆' },
  { type: 'schedule', label: 'Schedule', description: 'Daily race schedule', icon: '📅' },
  { type: 'notices', label: 'Notices', description: 'Official announcements', icon: '📢' },
  { type: 'standings', label: 'Standings', description: 'Series leaderboard', icon: '📊' },
  { type: 'calendar', label: 'Calendar', description: 'Upcoming events', icon: '🗓️' },
  { type: 'countdown', label: 'Countdown', description: 'Time to event', icon: '⏱️' },
  { type: 'weather', label: 'Weather', description: 'Forecast conditions', icon: '🌤️' },
  { type: 'entry_list', label: 'Entry List', description: 'Registered competitors', icon: '📋' },
];

export function WidgetManager({ clubId, regattaId, onClose }: WidgetManagerProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create modal state
  const [newWidget, setNewWidget] = useState<CreateWidgetInput>({
    clubId,
    regattaId,
    widgetType: 'results',
    name: '',
    theme: 'light',
    accentColor: '#0EA5E9',
    showBranding: true,
  });

  useEffect(() => {
    loadWidgets();
  }, [clubId]);

  const loadWidgets = async () => {
    setLoading(true);
    const data = await PublicPublishingService.getClubWidgets(clubId);
    setWidgets(data);
    setLoading(false);
  };

  const handleCreateWidget = async () => {
    if (!newWidget.name.trim()) {
      showAlert('Error', 'Please enter a widget name');
      return;
    }

    const widget = await PublicPublishingService.createWidget(newWidget);
    if (widget) {
      setWidgets([widget, ...widgets]);
      setShowCreateModal(false);
      setNewWidget({
        clubId,
        regattaId,
        widgetType: 'results',
        name: '',
        theme: 'light',
        accentColor: '#0EA5E9',
        showBranding: true,
      });
    } else {
      showAlert('Error', 'Failed to create widget');
    }
  };

  const handleToggleActive = async (widget: WidgetConfig) => {
    const updated = await PublicPublishingService.updateWidget(widget.id, {
      active: !widget.active,
    });
    if (updated) {
      setWidgets(widgets.map(w => w.id === widget.id ? updated : w));
    }
  };

  const handleDeleteWidget = async (widget: WidgetConfig) => {
    showConfirm(
      'Delete Widget',
      `Are you sure you want to delete "${widget.name}"? Existing embeds will stop working.`,
      async () => {
        const success = await PublicPublishingService.deleteWidget(widget.id);
        if (success) {
          setWidgets(widgets.filter(w => w.id !== widget.id));
        }
      },
      { destructive: true }
    );
  };

  const handleCopyCode = async (widget: WidgetConfig) => {
    const code = PublicPublishingService.generateEmbedCode(widget);
    
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(widget.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for mobile
      setShowCodeModal(widget.id);
    }
  };

  const getWidgetTypeInfo = (type: WidgetType) => {
    return WIDGET_TYPES.find(w => w.type === type) || WIDGET_TYPES[0];
  };

  const renderWidget = (widget: WidgetConfig) => {
    const typeInfo = getWidgetTypeInfo(widget.widgetType);
    
    return (
      <View key={widget.id} style={styles.widgetCard}>
        <View style={styles.widgetHeader}>
          <View style={styles.widgetIcon}>
            <Text style={styles.widgetEmoji}>{typeInfo.icon}</Text>
          </View>
          <View style={styles.widgetInfo}>
            <Text style={styles.widgetName}>{widget.name}</Text>
            <Text style={styles.widgetType}>{typeInfo.label}</Text>
          </View>
          <TouchableOpacity
            style={[styles.statusBadge, widget.active ? styles.activeBadge : styles.inactiveBadge]}
            onPress={() => handleToggleActive(widget)}
          >
            {widget.active ? (
              <Eye size={14} color="#059669" />
            ) : (
              <EyeOff size={14} color="#9CA3AF" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.widgetStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{widget.impressions.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{widget.embedCount}</Text>
            <Text style={styles.statLabel}>Embeds</Text>
          </View>
          <View style={styles.stat}>
            <View style={[styles.themeIndicator, { backgroundColor: widget.accentColor }]} />
            <Text style={styles.statLabel}>{widget.theme}</Text>
          </View>
        </View>

        <View style={styles.widgetActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCopyCode(widget)}
          >
            {copiedId === widget.id ? (
              <Check size={16} color="#059669" />
            ) : (
              <Copy size={16} color="#6B7280" />
            )}
            <Text style={styles.actionText}>
              {copiedId === widget.id ? 'Copied!' : 'Copy Code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowCodeModal(widget.id)}
          >
            <Code size={16} color="#6B7280" />
            <Text style={styles.actionText}>View Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteWidget(widget)}
          >
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Embed Code Modal */}
        {showCodeModal === widget.id && (
          <Modal
            visible={true}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCodeModal(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.codeModal}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Embed Code</Text>
                  <TouchableOpacity onPress={() => setShowCodeModal(null)}>
                    <X size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText} selectable>
                    {PublicPublishingService.generateEmbedCode(widget)}
                  </Text>
                </View>
                <Text style={styles.codeHint}>
                  Copy and paste this code into your website's HTML where you want the widget to appear.
                </Text>
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Embeddable Widgets</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Plus size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Widget</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.description}>
        Create widgets to embed race results, schedules, and more on your club's website.
      </Text>

      {/* Widget List */}
      <ScrollView style={styles.list}>
        {loading ? (
          <Text style={styles.loadingText}>Loading widgets...</Text>
        ) : widgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Code size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Widgets Yet</Text>
            <Text style={styles.emptyText}>
              Create your first widget to embed race content on external websites.
            </Text>
          </View>
        ) : (
          widgets.map(renderWidget)
        )}
      </ScrollView>

      {/* Create Widget Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.createModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Widget</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Widget Name */}
              <Text style={styles.inputLabel}>Widget Name</Text>
              <TextInput
                style={styles.input}
                value={newWidget.name}
                onChangeText={(text) => setNewWidget({ ...newWidget, name: text })}
                placeholder="e.g., Homepage Results"
                placeholderTextColor="#9CA3AF"
              />

              {/* Widget Type */}
              <Text style={styles.inputLabel}>Widget Type</Text>
              <View style={styles.typeGrid}>
                {WIDGET_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.type}
                    style={[
                      styles.typeCard,
                      newWidget.widgetType === type.type && styles.typeCardSelected,
                    ]}
                    onPress={() => setNewWidget({ ...newWidget, widgetType: type.type })}
                  >
                    <Text style={styles.typeEmoji}>{type.icon}</Text>
                    <Text style={[
                      styles.typeLabel,
                      newWidget.widgetType === type.type && styles.typeLabelSelected,
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Theme */}
              <Text style={styles.inputLabel}>Theme</Text>
              <View style={styles.themeOptions}>
                {(['light', 'dark', 'auto'] as const).map((theme) => (
                  <TouchableOpacity
                    key={theme}
                    style={[
                      styles.themeOption,
                      newWidget.theme === theme && styles.themeOptionSelected,
                    ]}
                    onPress={() => setNewWidget({ ...newWidget, theme })}
                  >
                    <Text style={[
                      styles.themeOptionText,
                      newWidget.theme === theme && styles.themeOptionTextSelected,
                    ]}>
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Accent Color */}
              <Text style={styles.inputLabel}>Accent Color</Text>
              <View style={styles.colorOptions}>
                {['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6B7280'].map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      newWidget.accentColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setNewWidget({ ...newWidget, accentColor: color })}
                  >
                    {newWidget.accentColor === color && (
                      <Check size={16} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Branding Toggle */}
              <TouchableOpacity
                style={styles.brandingToggle}
                onPress={() => setNewWidget({ ...newWidget, showBranding: !newWidget.showBranding })}
              >
                <View style={[
                  styles.checkbox,
                  newWidget.showBranding && styles.checkboxChecked,
                ]}>
                  {newWidget.showBranding && <Check size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.brandingLabel}>Show "Powered by BetterAt"</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateWidget}
              >
                <Text style={styles.submitButtonText}>Create Widget</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    padding: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  list: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  widgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetEmoji: {
    fontSize: 22,
  },
  widgetInfo: {
    flex: 1,
    marginLeft: 12,
  },
  widgetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  widgetType: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    padding: 8,
    borderRadius: 8,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
  },
  inactiveBadge: {
    backgroundColor: '#F3F4F6',
  },
  widgetStats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  themeIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginBottom: 4,
  },
  widgetActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createModal: {
    width: '90%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  codeModal: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalContent: {
    padding: 16,
  },
  codeContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#E5E7EB',
    lineHeight: 20,
  },
  codeHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 12,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCard: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    borderColor: '#0EA5E9',
    backgroundColor: '#EFF6FF',
  },
  typeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  typeLabelSelected: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionSelected: {
    borderColor: '#0EA5E9',
    backgroundColor: '#EFF6FF',
  },
  themeOptionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  themeOptionTextSelected: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  colorOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  brandingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  brandingLabel: {
    fontSize: 14,
    color: '#374151',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default WidgetManager;
