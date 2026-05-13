/**
 * Alert Subscription Modal
 * Manage AI alert subscriptions for boat maintenance and equipment
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface AlertSubscriptionModalProps {
  visible: boolean;
  boatId: string;
  onClose: () => void;
  onSave: (subscription: AlertSubscriptionData) => void;
}

export interface AlertSubscriptionData {
  emailEnabled: boolean;
  email?: string;
  smsEnabled: boolean;
  phoneNumber?: string;
  alertTypes: {
    maintenanceDue: boolean;
    equipmentLifecycle: boolean;
    performanceOptimization: boolean;
    venueRecommendations: boolean;
    urgentIssues: boolean;
  };
  frequency: 'immediate' | 'daily_digest' | 'weekly_digest';
}

export function AlertSubscriptionModal({
  visible,
  boatId: _boatId,
  onClose,
  onSave,
}: AlertSubscriptionModalProps) {
  const [subscription, setSubscription] = useState<AlertSubscriptionData>({
    emailEnabled: false,
    smsEnabled: false,
    alertTypes: {
      maintenanceDue: true,
      equipmentLifecycle: true,
      performanceOptimization: false,
      venueRecommendations: false,
      urgentIssues: true,
    },
    frequency: 'immediate',
  });

  const handleSave = () => {
    onSave(subscription);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alert Subscription</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <Text style={styles.infoBannerText}>
              Get alerts for maintenance, equipment lifecycle, and
              performance optimization
            </Text>
          </View>

          {/* Notification Channels */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Channels</Text>

            {/* Email */}
            <View style={styles.channelCard}>
              <View style={styles.channelHeader}>
                <View style={styles.channelIcon}>
                  <Ionicons name="mail" size={20} color="#3B82F6" />
                </View>
                <View style={styles.channelContent}>
                  <Text style={styles.channelLabel}>Email Alerts</Text>
                  <Text style={styles.channelDescription}>
                    Receive detailed alerts via email
                  </Text>
                </View>
                <Switch
                  value={subscription.emailEnabled}
                  onValueChange={(value) =>
                    setSubscription({ ...subscription, emailEnabled: value })
                  }
                  trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                />
              </View>
              {subscription.emailEnabled && (
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={subscription.email}
                  onChangeText={(text) =>
                    setSubscription({ ...subscription, email: text })
                  }
                />
              )}
            </View>

            {/* SMS */}
            <View style={styles.channelCard}>
              <View style={styles.channelHeader}>
                <View style={styles.channelIcon}>
                  <Ionicons name="chatbubble" size={20} color="#10B981" />
                </View>
                <View style={styles.channelContent}>
                  <Text style={styles.channelLabel}>SMS Alerts</Text>
                  <Text style={styles.channelDescription}>
                    Get urgent alerts via text message
                  </Text>
                </View>
                <Switch
                  value={subscription.smsEnabled}
                  onValueChange={(value) =>
                    setSubscription({ ...subscription, smsEnabled: value })
                  }
                  trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                />
              </View>
              {subscription.smsEnabled && (
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 123-4567"
                  keyboardType="phone-pad"
                  value={subscription.phoneNumber}
                  onChangeText={(text) =>
                    setSubscription({ ...subscription, phoneNumber: text })
                  }
                />
              )}
            </View>
          </View>

          {/* Alert Types */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alert Types</Text>

            <View style={styles.alertTypeCard}>
              <View style={styles.alertTypeRow}>
                <Ionicons name="calendar" size={20} color="#F59E0B" />
                <View style={styles.alertTypeContent}>
                  <Text style={styles.alertTypeLabel}>Maintenance Due</Text>
                  <Text style={styles.alertTypeDescription}>
                    Reminders for scheduled service
                  </Text>
                </View>
                <Switch
                  value={subscription.alertTypes.maintenanceDue}
                  onValueChange={(value) =>
                    setSubscription({
                      ...subscription,
                      alertTypes: { ...subscription.alertTypes, maintenanceDue: value },
                    })
                  }
                />
              </View>

              <View style={styles.alertTypeRow}>
                <Ionicons name="time" size={20} color="#8B5CF6" />
                <View style={styles.alertTypeContent}>
                  <Text style={styles.alertTypeLabel}>Equipment Lifecycle</Text>
                  <Text style={styles.alertTypeDescription}>
                    When equipment reaches 80% of expected life
                  </Text>
                </View>
                <Switch
                  value={subscription.alertTypes.equipmentLifecycle}
                  onValueChange={(value) =>
                    setSubscription({
                      ...subscription,
                      alertTypes: {
                        ...subscription.alertTypes,
                        equipmentLifecycle: value,
                      },
                    })
                  }
                />
              </View>

              <View style={styles.alertTypeRow}>
                <Ionicons name="trending-up" size={20} color="#3B82F6" />
                <View style={styles.alertTypeContent}>
                  <Text style={styles.alertTypeLabel}>Performance Tips</Text>
                  <Text style={styles.alertTypeDescription}>
                    AI-powered optimization suggestions
                  </Text>
                </View>
                <Switch
                  value={subscription.alertTypes.performanceOptimization}
                  onValueChange={(value) =>
                    setSubscription({
                      ...subscription,
                      alertTypes: {
                        ...subscription.alertTypes,
                        performanceOptimization: value,
                      },
                    })
                  }
                />
              </View>

              <View style={styles.alertTypeRow}>
                <Ionicons name="location" size={20} color="#06B6D4" />
                <View style={styles.alertTypeContent}>
                  <Text style={styles.alertTypeLabel}>Venue Recommendations</Text>
                  <Text style={styles.alertTypeDescription}>
                    Equipment suggestions for upcoming venues
                  </Text>
                </View>
                <Switch
                  value={subscription.alertTypes.venueRecommendations}
                  onValueChange={(value) =>
                    setSubscription({
                      ...subscription,
                      alertTypes: {
                        ...subscription.alertTypes,
                        venueRecommendations: value,
                      },
                    })
                  }
                />
              </View>

              <View style={styles.alertTypeRow}>
                <Ionicons name="warning" size={20} color="#EF4444" />
                <View style={styles.alertTypeContent}>
                  <Text style={styles.alertTypeLabel}>Urgent Issues</Text>
                  <Text style={styles.alertTypeDescription}>
                    Critical alerts requiring immediate attention
                  </Text>
                </View>
                <Switch
                  value={subscription.alertTypes.urgentIssues}
                  onValueChange={(value) =>
                    setSubscription({
                      ...subscription,
                      alertTypes: { ...subscription.alertTypes, urgentIssues: value },
                    })
                  }
                />
              </View>
            </View>
          </View>

          {/* Frequency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Frequency</Text>
            <View style={styles.frequencyContainer}>
              <TouchableOpacity
                style={[
                  styles.frequencyButton,
                  subscription.frequency === 'immediate' && styles.frequencyButtonActive,
                ]}
                onPress={() =>
                  setSubscription({ ...subscription, frequency: 'immediate' })
                }
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    subscription.frequency === 'immediate' &&
                      styles.frequencyButtonTextActive,
                  ]}
                >
                  Immediate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.frequencyButton,
                  subscription.frequency === 'daily_digest' &&
                    styles.frequencyButtonActive,
                ]}
                onPress={() =>
                  setSubscription({ ...subscription, frequency: 'daily_digest' })
                }
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    subscription.frequency === 'daily_digest' &&
                      styles.frequencyButtonTextActive,
                  ]}
                >
                  Daily Digest
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.frequencyButton,
                  subscription.frequency === 'weekly_digest' &&
                    styles.frequencyButtonActive,
                ]}
                onPress={() =>
                  setSubscription({ ...subscription, frequency: 'weekly_digest' })
                }
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    subscription.frequency === 'weekly_digest' &&
                      styles.frequencyButtonTextActive,
                  ]}
                >
                  Weekly Digest
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cancelButton: {
    width: 80,
  },
  cancelText: {
    fontSize: 16,
    color: '#64748B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  saveButton: {
    width: 80,
    alignItems: 'flex-end',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  channelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelContent: {
    flex: 1,
  },
  channelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  channelDescription: {
    fontSize: 13,
    color: '#64748B',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    marginTop: 12,
  },
  alertTypeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  alertTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alertTypeContent: {
    flex: 1,
  },
  alertTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  alertTypeDescription: {
    fontSize: 12,
    color: '#64748B',
  },
  frequencyContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    alignItems: 'center',
  },
  frequencyButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  frequencyButtonTextActive: {
    color: '#FFFFFF',
  },
  bottomPadding: {
    height: 40,
  },
});