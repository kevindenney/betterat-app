/**
 * Join Race Screen
 *
 * Deep link handler for joining a race via invite code.
 * URL: regattaflow://join-race/ABCD1234 or /join-race/ABCD1234
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '@/components/ui/button';
import { RaceCollaborationService } from '@/services/RaceCollaborationService';
import { IOS_COLORS } from '@/components/cards/constants';
import { Users, Sailboat, AlertCircle } from 'lucide-react-native';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('JoinRaceScreen');

type JoinStatus = 'idle' | 'loading' | 'success' | 'error';

export default function JoinRaceScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<JoinStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pre-fill display name from user profile if available
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { supabase } = await import('@/services/supabase');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          if (profile?.full_name) {
            setDisplayName(profile.full_name);
          }
        }
      } catch (error) {
        // Silently fail - user can enter name manually
        logger.debug('Could not load user profile:', error);
      }
    };

    loadUserProfile();
  }, []);

  const handleJoin = async () => {
    if (!code) {
      setErrorMessage('Invalid invite code');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const result = await RaceCollaborationService.joinByInviteCode(
        code,
        displayName.trim() || undefined,
        role.trim() || undefined
      );

      if (result.success && result.regattaId) {
        setStatus('success');
        // Navigate to the race/regatta screen
        setTimeout(() => {
          router.replace(`/(tabs)/race/scrollable/${result.regattaId}`);
        }, 500);
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to join race');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    }
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Sailboat size={48} color={IOS_COLORS.blue} />
            </View>
            <Text style={styles.title}>Join Race</Text>
            <Text style={styles.subtitle}>
              You've been invited to collaborate on a race
            </Text>
          </View>

          {/* Invite Code Display */}
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Invite Code</Text>
            <Text style={styles.codeValue}>{code?.toUpperCase() || '---'}</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Your Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                placeholderTextColor={IOS_COLORS.gray2}
                autoCapitalize="words"
                autoCorrect={false}
                editable={status !== 'loading'}
              />
              <Text style={styles.inputHint}>
                This will be shown to other crew members
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Role (Optional)</Text>
              <TextInput
                style={styles.input}
                value={role}
                onChangeText={setRole}
                placeholder="e.g., Tactician, Trimmer, Bowman"
                placeholderTextColor={IOS_COLORS.gray2}
                autoCapitalize="words"
                autoCorrect={false}
                editable={status !== 'loading'}
              />
              <Text style={styles.inputHint}>
                Your position on the boat
              </Text>
            </View>
          </View>

          {/* Error Message */}
          {status === 'error' && errorMessage && (
            <View style={styles.errorContainer}>
              <AlertCircle size={20} color={IOS_COLORS.red} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Success Message */}
          {status === 'success' && (
            <View style={styles.successContainer}>
              <Users size={20} color={IOS_COLORS.green} />
              <Text style={styles.successText}>
                Successfully joined! Redirecting...
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttons}>
            <Button
              onPress={handleJoin}
              disabled={status === 'loading' || status === 'success'}
              style={styles.joinButton}
            >
              {status === 'loading' ? (
                <ActivityIndicator color={IOS_COLORS.systemBackground} />
              ) : (
                <ButtonText style={styles.joinButtonText}>Join Race</ButtonText>
              )}
            </Button>

            <Button
              variant="outline"
              onPress={handleCancel}
              disabled={status === 'loading'}
              style={styles.cancelButton}
            >
              <ButtonText style={styles.cancelButtonText}>Cancel</ButtonText>
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${IOS_COLORS.blue}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  codeContainer: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  form: {
    gap: 20,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  input: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: IOS_COLORS.label,
  },
  inputHint: {
    fontSize: 12,
    color: IOS_COLORS.gray,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${IOS_COLORS.red}15`,
    padding: 12,
    borderRadius: 10,
    marginBottom: 24,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.red,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${IOS_COLORS.green}15`,
    padding: 12,
    borderRadius: 10,
    marginBottom: 24,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.green,
  },
  buttons: {
    gap: 12,
    marginTop: 'auto',
  },
  joinButton: {
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 12,
    paddingVertical: 16,
  },
  joinButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.systemBackground,
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 16,
    borderColor: IOS_COLORS.gray4,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.gray,
  },
});
