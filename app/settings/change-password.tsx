import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert('Error', 'All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Error', 'New passwords do not match');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      showAlert('Error', passwordError);
      return;
    }

    if (currentPassword === newPassword) {
      showAlert('Error', 'New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        showAlert('Error', 'Current password is incorrect');
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      showAlert('Success', 'Your password has been changed successfully');
      router.back();
    } catch (error: any) {
      console.error('Error changing password:', error);
      showAlert('Error', error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password: string): { strength: string; color: string } => {
    if (password.length === 0) return { strength: '', color: '' };
    if (password.length < 8) return { strength: 'Weak', color: '#EF4444' };

    let score = 0;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (password.length >= 12) score++;

    if (score <= 2) return { strength: 'Weak', color: '#EF4444' };
    if (score <= 3) return { strength: 'Medium', color: '#F59E0B' };
    return { strength: 'Strong', color: '#10B981' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Stack.Screen
        options={{
          title: 'Change Password',
          headerShown: true,
          headerBackTitle: 'Settings',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="chevron-back" size={26} color={IOS_COLORS.systemBlue} />
              <Text style={{ color: IOS_COLORS.systemBlue, fontSize: 17 }}>Settings</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Lock size={20} color={IOS_COLORS.systemBlue} />
          <View style={styles.infoCardBody}>
            <Text style={styles.infoTitle}>Password Requirements</Text>
            <Text style={styles.infoText}>
              • At least 8 characters long{'\n'}
              • Contains uppercase and lowercase letters{'\n'}
              • Contains at least one number{'\n'}
              • Different from current password
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={IOS_COLORS.systemGray}
                secureTextEntry={!showCurrentPassword}
                style={styles.input}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                {showCurrentPassword ? (
                  <EyeOff size={20} color={IOS_COLORS.systemGray} />
                ) : (
                  <Eye size={20} color={IOS_COLORS.systemGray} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={IOS_COLORS.systemGray}
                secureTextEntry={!showNewPassword}
                style={styles.input}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                {showNewPassword ? (
                  <EyeOff size={20} color={IOS_COLORS.systemGray} />
                ) : (
                  <Eye size={20} color={IOS_COLORS.systemGray} />
                )}
              </TouchableOpacity>
            </View>
            {newPassword.length > 0 && (
              <View style={styles.strengthRow}>
                <Text style={styles.strengthLabel}>Strength:</Text>
                <Text style={[styles.strengthValue, { color: passwordStrength.color }]}>
                  {passwordStrength.strength}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.fieldLast}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={IOS_COLORS.systemGray}
                secureTextEntry={!showConfirmPassword}
                style={styles.input}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? (
                  <EyeOff size={20} color={IOS_COLORS.systemGray} />
                ) : (
                  <Eye size={20} color={IOS_COLORS.systemGray} />
                )}
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={loading}
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => {
            showConfirm(
              'Reset Password',
              'A password reset link will be sent to your email',
              async () => {
                try {
                  await supabase.auth.resetPasswordForEmail(user?.email || '');
                  showAlert('Success', 'Password reset link sent to your email');
                } catch (error) {
                  showAlert('Error', 'Failed to send reset link');
                }
              },
              { confirmText: 'Send Link' }
            );
          }}
          style={styles.forgotButton}
        >
          <Text style={styles.forgotText}>Forgot your current password?</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BFDBFE',
  },
  infoCardBody: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#1D4ED8',
  },
  formCard: {
    backgroundColor: IOS_COLORS.systemBackground,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  field: {
    marginBottom: 16,
  },
  fieldLast: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemGray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: IOS_COLORS.label,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  strengthLabel: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginRight: 6,
  },
  strengthValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    color: IOS_COLORS.systemRed,
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  forgotText: {
    color: IOS_COLORS.systemBlue,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
  },
});
