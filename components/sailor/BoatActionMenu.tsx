/**
 * Boat Action Menu
 * Universal action menu for adding content and managing boat features
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface BoatActionMenuProps {
  visible: boolean;
  activeTab: 'equipment' | 'maintenance' | 'tuning' | 'alerts';
  onClose: () => void;
  onAddEquipment: () => void;
  onLogMaintenance: () => void;
  onCreateTuningSetup: () => void;
  onUploadDocument: () => void;
  onManageAlertSubscription: () => void;
}

interface ActionItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  iconLibrary: 'Ionicons' | 'MaterialCommunityIcons';
  color: string;
  action: () => void;
  relevantTabs?: ('equipment' | 'maintenance' | 'tuning' | 'alerts')[];
}

export function BoatActionMenu({
  visible,
  activeTab,
  onClose,
  onAddEquipment,
  onLogMaintenance,
  onCreateTuningSetup,
  onUploadDocument,
  onManageAlertSubscription,
}: BoatActionMenuProps) {
  const actions: ActionItem[] = [
    {
      id: 'add-equipment',
      label: 'Add Equipment',
      description: 'Log new sails, rigging, hardware, or boat parts',
      icon: 'construct',
      iconLibrary: 'Ionicons',
      color: '#3B82F6',
      action: () => {
        onClose();
        onAddEquipment();
      },
      relevantTabs: ['equipment'],
    },
    {
      id: 'log-maintenance',
      label: 'Log Maintenance',
      description: 'Record service, repairs, or inspections',
      icon: 'build',
      iconLibrary: 'Ionicons',
      color: '#F59E0B',
      action: () => {
        onClose();
        onLogMaintenance();
      },
      relevantTabs: ['maintenance', 'equipment'],
    },
    {
      id: 'create-tuning',
      label: 'Save Tuning Setup',
      description: 'Create rig/sail configuration for conditions',
      icon: 'settings',
      iconLibrary: 'Ionicons',
      color: '#8B5CF6',
      action: () => {
        onClose();
        onCreateTuningSetup();
      },
      relevantTabs: ['tuning'],
    },
    {
      id: 'upload-manual',
      label: 'Upload Manual',
      description: 'Add maintenance manual or service guide',
      icon: 'file-document',
      iconLibrary: 'MaterialCommunityIcons',
      color: '#10B981',
      action: () => {
        onClose();
        onUploadDocument();
      },
      relevantTabs: ['maintenance', 'equipment'],
    },
    {
      id: 'upload-bulletin',
      label: 'Upload Bulletin',
      description: 'Add class bulletin or technical notice',
      icon: 'newspaper-variant',
      iconLibrary: 'MaterialCommunityIcons',
      color: '#06B6D4',
      action: () => {
        onClose();
        onUploadDocument();
      },
      relevantTabs: ['equipment'],
    },
    {
      id: 'upload-instructions',
      label: 'Upload Instructions',
      description: 'Add equipment installation or setup guide',
      icon: 'text-box-check',
      iconLibrary: 'MaterialCommunityIcons',
      color: '#14B8A6',
      action: () => {
        onClose();
        onUploadDocument();
      },
      relevantTabs: ['equipment', 'maintenance'],
    },
    {
      id: 'alert-subscription',
      label: 'Manage Alert Subscription',
      description: 'Subscribe to alerts via SMS or email',
      icon: 'notifications',
      iconLibrary: 'Ionicons',
      color: '#EF4444',
      action: () => {
        onClose();
        onManageAlertSubscription();
      },
      relevantTabs: ['alerts'],
    },
  ];

  // Filter actions based on active tab (show most relevant first)
  const relevantActions = actions.filter((action) =>
    !action.relevantTabs || action.relevantTabs.includes(activeTab)
  );
  const otherActions = actions.filter(
    (action) => action.relevantTabs && !action.relevantTabs.includes(activeTab)
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <TouchableOpacity activeOpacity={1}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.dragHandle} />
              <Text style={styles.headerTitle}>Add to Boat</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Relevant Actions */}
              {relevantActions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quick Actions</Text>
                  <View style={styles.actionList}>
                    {relevantActions.map((action) => (
                      <TouchableOpacity
                        key={action.id}
                        style={styles.actionItem}
                        onPress={action.action}
                      >
                        <View
                          style={[
                            styles.actionIcon,
                            { backgroundColor: `${action.color}15` },
                          ]}
                        >
                          {action.iconLibrary === 'Ionicons' ? (
                            <Ionicons
                              name={action.icon as any}
                              size={24}
                              color={action.color}
                            />
                          ) : (
                            <MaterialCommunityIcons
                              name={action.icon as any}
                              size={24}
                              color={action.color}
                            />
                          )}
                        </View>
                        <View style={styles.actionContent}>
                          <Text style={styles.actionLabel}>{action.label}</Text>
                          <Text style={styles.actionDescription}>
                            {action.description}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#CBD5E1"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Other Actions */}
              {otherActions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>More Actions</Text>
                  <View style={styles.actionList}>
                    {otherActions.map((action) => (
                      <TouchableOpacity
                        key={action.id}
                        style={styles.actionItem}
                        onPress={action.action}
                      >
                        <View
                          style={[
                            styles.actionIcon,
                            { backgroundColor: `${action.color}15` },
                          ]}
                        >
                          {action.iconLibrary === 'Ionicons' ? (
                            <Ionicons
                              name={action.icon as any}
                              size={24}
                              color={action.color}
                            />
                          ) : (
                            <MaterialCommunityIcons
                              name={action.icon as any}
                              size={24}
                              color={action.color}
                            />
                          )}
                        </View>
                        <View style={styles.actionContent}>
                          <Text style={styles.actionLabel}>{action.label}</Text>
                          <Text style={styles.actionDescription}>
                            {action.description}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#CBD5E1"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.bottomPadding} />
            </ScrollView>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    boxShadow: '0px -4px',
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dragHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionList: {
    gap: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  bottomPadding: {
    height: 20,
  },
});