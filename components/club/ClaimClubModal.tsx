/**
 * ClaimClubModal - Modal for claiming a club from the directory
 *
 * Allows club administrators to claim their club on BetterAt.
 * Collects verification information and creates a platform club.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { X, Flag, Mail, CheckCircle } from 'lucide-react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { ClubDiscoveryService, GlobalClubResult } from '@/services/ClubDiscoveryService';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

interface ClaimClubModalProps {
  visible: boolean;
  club: GlobalClubResult | null;
  onClose: () => void;
  onSuccess: (platformClubId: string) => void;
}

const ROLES = [
  { id: 'commodore', label: 'Commodore / Flag Officer' },
  { id: 'vice_commodore', label: 'Vice Commodore' },
  { id: 'rear_commodore', label: 'Rear Commodore' },
  { id: 'secretary', label: 'Club Secretary' },
  { id: 'race_officer', label: 'Race Officer / PRO' },
  { id: 'manager', label: 'Club Manager' },
  { id: 'admin', label: 'Administrator' },
  { id: 'other', label: 'Other (specify in message)' },
];

export function ClaimClubModal({
  visible,
  club,
  onClose,
  onSuccess,
}: ClaimClubModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Claim mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!user || !club) throw new Error('Missing data');

      return ClubDiscoveryService.claimClub(user.id, club.id, {
        email,
        role: selectedRole || 'admin',
        message,
      });
    },
    onSuccess: (result) => {
      if (result.success && result.platformClubId) {
        showAlert(
          'Club Claimed!',
          `You are now the administrator of ${club?.name}. You can start creating races and managing your club.`
        );
        onSuccess(result.platformClubId!);
      } else {
        showAlert('Error', result.error || 'Failed to claim club');
      }
    },
    onError: (error: Error) => {
      showAlert('Error', error.message || 'An unexpected error occurred');
    },
  });

  const handleSubmit = useCallback(() => {
    // Validate
    if (!email.trim()) {
      showAlert('Email Required', 'Please enter a club email address.');
      return;
    }
    if (!selectedRole) {
      showAlert('Role Required', 'Please select your role at the club.');
      return;
    }

    claimMutation.mutate();
  }, [email, selectedRole, claimMutation]);

  const handleClose = useCallback(() => {
    // Reset form
    setEmail('');
    setSelectedRole(null);
    setMessage('');
    onClose();
  }, [onClose]);

  if (!club) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={8}>
            <X size={24} color={IOS_COLORS.label} />
          </Pressable>
          <Text style={styles.headerTitle}>Claim Club</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Club Preview */}
          <View style={styles.clubPreview}>
            <View style={styles.clubIcon}>
              <Flag size={24} color={IOS_COLORS.systemOrange} />
            </View>
            <Text style={styles.clubName}>{club.name}</Text>
            {club.city && club.country && (
              <Text style={styles.clubLocation}>
                {club.city}, {club.country}
              </Text>
            )}
          </View>

          {/* Explanation */}
          <View style={styles.explanation}>
            <Text style={styles.explanationText}>
              Claiming this club will allow you to manage it on BetterAt. You'll be able to:
            </Text>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <CheckCircle size={16} color={IOS_COLORS.systemGreen} />
                <Text style={styles.benefitText}>Create and manage races</Text>
              </View>
              <View style={styles.benefitItem}>
                <CheckCircle size={16} color={IOS_COLORS.systemGreen} />
                <Text style={styles.benefitText}>Invite members to join</Text>
              </View>
              <View style={styles.benefitItem}>
                <CheckCircle size={16} color={IOS_COLORS.systemGreen} />
                <Text style={styles.benefitText}>Publish results and notices</Text>
              </View>
              <View style={styles.benefitItem}>
                <CheckCircle size={16} color={IOS_COLORS.systemGreen} />
                <Text style={styles.benefitText}>Use race management tools</Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Club Email */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>CLUB EMAIL ADDRESS</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color={IOS_COLORS.placeholderText} />
                <TextInput
                  style={styles.input}
                  placeholder="sailing@clubname.org"
                  placeholderTextColor={IOS_COLORS.placeholderText}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.fieldHint}>
                Use an official club email domain if possible
              </Text>
            </View>

            {/* Role Selection */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>YOUR ROLE AT THE CLUB</Text>
              <View style={styles.roleGrid}>
                {ROLES.map((role) => (
                  <Pressable
                    key={role.id}
                    style={[
                      styles.roleOption,
                      selectedRole === role.id && styles.roleOptionSelected,
                    ]}
                    onPress={() => setSelectedRole(role.id)}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        selectedRole === role.id && styles.roleOptionTextSelected,
                      ]}
                    >
                      {role.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Additional Message */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ADDITIONAL INFORMATION (OPTIONAL)</Text>
              <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Any additional context about your role or how you'd like to use BetterAt..."
                  placeholderTextColor={IOS_COLORS.placeholderText}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <Pressable
            style={[
              styles.submitButton,
              (!email || !selectedRole || claimMutation.isPending) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!email || !selectedRole || claimMutation.isPending}
          >
            {claimMutation.isPending ? (
              <ActivityIndicator size="small" color={'#FFFFFF'} />
            ) : (
              <>
                <Flag size={18} color={'#FFFFFF'} />
                <Text style={styles.submitButtonText}>Claim {club.name}</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  headerTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: IOS_SPACING.lg,
  },
  clubPreview: {
    alignItems: 'center',
    marginBottom: IOS_SPACING.xl,
  },
  clubIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: IOS_COLORS.systemOrange + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IOS_SPACING.md,
  },
  clubName: {
    ...IOS_TYPOGRAPHY.title3,
    color: IOS_COLORS.label,
    fontWeight: '600',
    textAlign: 'center',
  },
  clubLocation: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    marginTop: IOS_SPACING.xs,
  },
  explanation: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    padding: IOS_SPACING.lg,
    borderRadius: IOS_RADIUS.md,
    marginBottom: IOS_SPACING.xl,
  },
  explanationText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.md,
  },
  benefitsList: {
    gap: IOS_SPACING.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  benefitText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
  },
  form: {
    gap: IOS_SPACING.xl,
  },
  field: {
    gap: IOS_SPACING.sm,
  },
  fieldLabel: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
    paddingHorizontal: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
    paddingVertical: IOS_SPACING.md,
  },
  input: {
    flex: 1,
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    paddingVertical: IOS_SPACING.md,
  },
  textArea: {
    minHeight: 80,
    paddingVertical: 0,
  },
  fieldHint: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.tertiaryLabel,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.sm,
  },
  roleOption: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleOptionSelected: {
    backgroundColor: IOS_COLORS.systemBlue + '20',
    borderColor: IOS_COLORS.systemBlue,
  },
  roleOptionText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.label,
  },
  roleOptionTextSelected: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
  footer: {
    padding: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.xl,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemOrange,
    paddingVertical: IOS_SPACING.lg,
    borderRadius: IOS_RADIUS.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...IOS_TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
