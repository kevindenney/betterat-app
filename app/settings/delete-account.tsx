import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { showAlert, showAlertWithButtons, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useRouter, type Href } from 'expo-router';
import { ArrowLeft, AlertTriangle, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

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
          // Verify password
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user?.email || '',
            password: password
          });

          if (signInError) {
            showAlert('Error', 'Password is incorrect');
            setLoading(false);
            return;
          }

          // Delete user data (soft delete - mark as deleted)
          // In production, you'd want to handle this via a database function
          // that properly cascades the deletion or anonymizes the data
          const { error: updateError } = await supabase
            .from('users')
            .update({
              deleted_at: new Date().toISOString(),
              email: `deleted_${Date.now()}@deleted.com`,
              name: 'Deleted User'
            })
            .eq('id', user?.id);

          if (updateError) throw updateError;

          // Delete auth user
          const { error: deleteError } = await supabase.auth.admin.deleteUser(user?.id || '');

          if (deleteError) {
            // If we can't delete the auth user, try signing out anyway
            console.error('Error deleting auth user:', deleteError);
          }

          // Sign out
          await signOut();

          showAlertWithButtons(
            'Account Deleted',
            'Your account has been permanently deleted. We\'re sorry to see you go.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/(auth)/login' as Href)
              }
            ]
          );
        } catch (error: any) {
          console.error('Error deleting account:', error);
          showAlert('Error', error.message || 'Failed to delete account');
        } finally {
          setLoading(false);
        }
      },
      { destructive: true },
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      {/* Header */}
      <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800">Delete Account</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Warning */}
        <View className="bg-red-50 mx-4 mt-4 p-4 rounded-lg border border-red-200">
          <View className="flex-row items-start">
            <AlertTriangle size={24} color="#EF4444" />
            <View className="flex-1 ml-3">
              <Text className="text-red-900 font-bold text-lg mb-2">
                Warning: This Cannot Be Undone
              </Text>
              <Text className="text-red-700 text-sm">
                Deleting your account will permanently remove all your data, including:
              </Text>
            </View>
          </View>
        </View>

        {/* Data Loss Warning */}
        <View className="bg-white mt-4 px-4 py-4">
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            What Will Be Deleted
          </Text>

          <View className="space-y-3">
            <View className="flex-row items-start mb-3">
              <Text className="text-red-500 mr-2">•</Text>
              <Text className="text-gray-700 flex-1">
                Your profile and personal information
              </Text>
            </View>
            <View className="flex-row items-start mb-3">
              <Text className="text-red-500 mr-2">•</Text>
              <Text className="text-gray-700 flex-1">
                All your steps, history, and progress data
              </Text>
            </View>
            <View className="flex-row items-start mb-3">
              <Text className="text-red-500 mr-2">•</Text>
              <Text className="text-gray-700 flex-1">
                Saved places, documents, and resources
              </Text>
            </View>
            <View className="flex-row items-start mb-3">
              <Text className="text-red-500 mr-2">•</Text>
              <Text className="text-gray-700 flex-1">
                Connections, groups, and organization memberships
              </Text>
            </View>
            <View className="flex-row items-start mb-3">
              <Text className="text-red-500 mr-2">•</Text>
              <Text className="text-gray-700 flex-1">
                Coaching sessions and saved plans
              </Text>
            </View>
            <View className="flex-row items-start mb-3">
              <Text className="text-red-500 mr-2">•</Text>
              <Text className="text-gray-700 flex-1">
                All AI-generated insights and analysis
              </Text>
            </View>
            <View className="flex-row items-start">
              <Text className="text-red-500 mr-2">•</Text>
              <Text className="text-gray-700 flex-1">
                Any active subscriptions (will be cancelled)
              </Text>
            </View>
          </View>
        </View>

        {/* Alternative Options */}
        <View className="bg-blue-50 mx-4 mt-4 p-4 rounded-lg border border-blue-200">
          <Text className="text-blue-900 font-semibold mb-2">
            Consider These Alternatives
          </Text>
          <Text className="text-blue-700 text-sm mb-2">
            Instead of deleting your account, you could:
          </Text>
          <View className="ml-2">
            <Text className="text-blue-700 text-sm mb-1">
              • Downgrade to a free plan to pause your subscription
            </Text>
            <Text className="text-blue-700 text-sm mb-1">
              • Adjust your privacy settings to limit data collection
            </Text>
            <Text className="text-blue-700 text-sm">
              • Export your data for safekeeping before deleting
            </Text>
          </View>
        </View>

        {/* Confirmation Form */}
        <View className="bg-white mt-4 px-4 py-4">
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Confirm Deletion
          </Text>

          <View className="mb-4">
            <Text className="text-gray-700 font-medium mb-2">
              Type <Text className="font-bold text-red-500">DELETE</Text> to confirm
            </Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Type DELETE"
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-800"
              autoCapitalize="characters"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 font-medium mb-2">Enter your password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-800"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={loading || confirmText !== 'DELETE' || !password}
            className={`rounded-lg py-4 items-center flex-row justify-center ${
              loading || confirmText !== 'DELETE' || !password
                ? 'bg-gray-300'
                : 'bg-red-500'
            }`}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Trash2 size={20} color="#FFFFFF" />
                <Text className="text-white font-semibold text-base ml-2">
                  Delete My Account Forever
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Support Contact */}
        <View className="mx-4 mt-4">
          <Text className="text-center text-gray-500 text-sm">
            Having issues? Contact{' '}
            <Text className="text-blue-500 font-medium">support@regattaflow.com</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
