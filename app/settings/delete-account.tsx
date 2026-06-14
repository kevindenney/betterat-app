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
import { showAlert, showAlertWithButtons, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { Stack, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AlertTriangle, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

const DELETABLE_ITEMS = [
  'Your profile and personal information',
  'All your steps, history, and progress data',
  'Saved places, documents, and resources',
  'Connections, groups, and organization memberships',
  'Coaching sessions and saved plans',
  'All AI-generated insights and analysis',
  'Any active subscriptions (will be cancelled)',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      showAlert('Error', 'Please type DELETE to confirm');
      return;
    }

    if (!password) {
      showAlert('Error', 'Please enter your password to confirm');
      return;
    }

    showConfirm(
      'Final Confirmation',
      'This is your last chance. Are you absolutely sure you want to delete your account? This action cannot be undone.',
      async () => {
        setLoading(true);
        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user?.email || '',
            password: password,
          });

          if (signInError) {
            showAlert('Error', 'Password is incorrect');
            setLoading(false);
            return;
          }

          // Soft-delete: mark the account for deletion and anonymize the row.
          // Auth-user removal and full cascade run server-side within 30 days
          // (the client has no service role to call auth.admin.deleteUser).
          const { error: updateError } = await supabase
            .from('users')
            .update({
              deleted_at: new Date().toISOString(),
              email: `deleted_${Date.now()}@deleted.com`,
              full_name: 'Deleted User',
            })
            .eq('id', user?.id);

          if (updateError) throw updateError;

          await signOut();

          showAlertWithButtons(
            'Account Scheduled for Deletion',
            "Your account has been deactivated and you've been signed out. Your data will be permanently removed within 30 days. We're sorry to see you go.",
            [
              {
                text: 'OK',
                onPress: () => router.replace('/(auth)/login' as Href),
              },
            ]
          );
        } catch (error: any) {
          console.error('Error deleting account:', error);
          showAlert('Error', error.message || 'Failed to delete account');
        } finally {
          setLoading(false);
        }
      },
      { destructive: true }
    );
  };

  const submitDisabled = loading || confirmText !== 'DELETE' || !password;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Stack.Screen
        options={{
          title: 'Delete Account',
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
        <View style={styles.warningCard}>
          <AlertTriangle size={24} color={IOS_COLORS.systemRed} />
          <View style={styles.warningBody}>
            <Text style={styles.warningTitle}>Warning: This Cannot Be Undone</Text>
            <Text style={styles.warningText}>
              Deleting your account will permanently remove all your data, including:
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>What Will Be Deleted</Text>
          {DELETABLE_ITEMS.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.altCard}>
          <Text style={styles.altTitle}>Consider These Alternatives</Text>
          <Text style={styles.altText}>Instead of deleting your account, you could:</Text>
          <View style={styles.altList}>
            <Text style={styles.altItem}>• Downgrade to a free plan to pause your subscription</Text>
            <Text style={styles.altItem}>• Adjust your privacy settings to limit data collection</Text>
            <Text style={styles.altItem}>• Export your data for safekeeping before deleting</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Confirm Deletion</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Type <Text style={styles.fieldLabelEmphasis}>DELETE</Text> to confirm
            </Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={IOS_COLORS.systemGray}
              style={styles.input}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Enter your password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={IOS_COLORS.systemGray}
              secureTextEntry
              style={styles.input}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={submitDisabled}
            style={[styles.deleteButton, submitDisabled && styles.deleteButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Trash2 size={20} color="#FFFFFF" />
                <Text style={styles.deleteText}>Delete My Account</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.supportWrap}>
          <Text style={styles.supportText}>
            Having issues? Contact <Text style={styles.supportEmail}>info@better.at</Text>
          </Text>
        </View>
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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
  },
  warningBody: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#7F1D1D',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#B91C1C',
  },
  sectionCard: {
    backgroundColor: IOS_COLORS.systemBackground,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bulletMark: {
    color: IOS_COLORS.systemRed,
    marginRight: 8,
    fontSize: 15,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  altCard: {
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BFDBFE',
  },
  altTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 8,
  },
  altText: {
    fontSize: 13,
    color: '#1D4ED8',
    marginBottom: 8,
  },
  altList: {
    marginLeft: 8,
  },
  altItem: {
    fontSize: 13,
    lineHeight: 20,
    color: '#1D4ED8',
    marginBottom: 4,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  fieldLabelEmphasis: {
    fontWeight: '700',
    color: IOS_COLORS.systemRed,
  },
  input: {
    backgroundColor: IOS_COLORS.systemGray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: IOS_COLORS.label,
  },
  deleteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemRed,
    borderRadius: 10,
    paddingVertical: 14,
  },
  deleteButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray3,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  supportWrap: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  supportText: {
    textAlign: 'center',
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  supportEmail: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
});
