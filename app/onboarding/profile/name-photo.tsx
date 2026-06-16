/**
 * Name & Photo Screen - Single Focus Profile Setup
 * Collects user's name and optional photo
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService';
import { useAuth } from '@/providers/AuthProvider';
import { ReverseTrialService } from '@/lib/subscriptions/reverseTrialService';
import { supabase } from '@/services/supabase';
import { AvatarStorageService } from '@/services/storage/AvatarStorageService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { extractOAuthDisplayName } from '@/lib/utils/oauthName';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInterest } from '@/providers/InterestProvider';

export default function NamePhotoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addInterest, switchInterest } = useInterest();

  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill from auth provider if available (handles Google, Apple, etc.)
  useEffect(() => {
    const displayName = extractOAuthDisplayName(user?.user_metadata);
    if (displayName) {
      setName(displayName);
    }
    if (user?.user_metadata?.avatar_url) {
      setPhotoUri(user.user_metadata.avatar_url);
    }
  }, [user]);

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      showAlert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleContinue = async () => {
    if (!name.trim()) {
      showAlert('Name Required', 'Please enter your name to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save to onboarding state
      await OnboardingStateService.setUserInfo(
        user?.id || '',
        name.trim(),
        photoUri || undefined
      );
      await OnboardingStateService.completeStep('profile-setup');

      // Mark onboarding as completed in DB
      if (user?.id) {
        // Upload photo to Supabase storage if a local file was picked
        let avatarUrl: string | undefined;
        if (photoUri && !photoUri.startsWith('http')) {
          try {
            avatarUrl = await AvatarStorageService.uploadAvatar(user.id, photoUri);
          } catch (uploadErr) {
            console.warn('[NamePhoto] Photo upload failed, continuing without photo:', uploadErr);
          }
        } else if (photoUri?.startsWith('http')) {
          // OAuth-provided avatar URL — use directly
          avatarUrl = photoUri;
        }

        await supabase
          .from('users')
          .update({
            onboarding_completed: true,
            full_name: name.trim(),
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          })
          .eq('id', user.id);

        // Start reverse trial (14-day Pro access)
        const alreadyHadTrial = await ReverseTrialService.hasHadTrial(user.id);
        if (!alreadyHadTrial) {
          await ReverseTrialService.startTrial(user.id);
        }

        // Commit the interest chosen during signup so the InterestSelection modal doesn't reappear
        const onboardingSlug = await AsyncStorage.getItem('onboarding_interest_slug');
        if (onboardingSlug) {
          try {
            await addInterest(onboardingSlug);
            await switchInterest(onboardingSlug);
          } catch (e) {
            console.warn('[NamePhoto] Failed to commit onboarding interest:', e);
          }
        }
      }

      // Show trial activation screen before entering the app
      router.replace('/onboarding/trial-activation');
    } catch (error) {
      showAlert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const canContinue = name.trim().length > 0;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="chevron-back" size={24} color="#0F172A" />
            </TouchableOpacity>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            {/* Title */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(400).springify()}
              style={styles.titleContainer}
            >
              <Text style={styles.title}>What should we call you?</Text>
              <Text style={styles.subtitle}>
                Add your name and optionally a photo so others can find you.
              </Text>
            </Animated.View>

            {/* Photo Picker */}
            <Animated.View
              entering={FadeIn.delay(200).duration(400)}
              style={styles.photoContainer}
            >
              <TouchableOpacity
                style={styles.photoPicker}
                onPress={handlePickPhoto}
                activeOpacity={0.8}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoImage} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera" size={32} color="#94A3B8" />
                  </View>
                )}
                <View style={styles.photoEditBadge}>
                  <Ionicons name="pencil" size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Tap to add photo (optional)</Text>
            </Animated.View>

            {/* Name Input */}
            <Animated.View
              entering={FadeIn.delay(300).duration(400)}
              style={styles.inputContainer}
            >
              <Text style={styles.inputLabel}>Your Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your name"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  maxLength={50}
                />
                {name.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setName('')}
                    style={styles.clearButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </View>

          {/* Footer */}
          <Animated.View
            entering={FadeIn.delay(400).duration(300)}
            style={styles.footer}
          >
            <TouchableOpacity
              style={[
                styles.continueButton,
                !canContinue && styles.continueButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!canContinue || isSubmitting}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.continueButtonText,
                  !canContinue && styles.continueButtonTextDisabled,
                ]}
              >
                {isSubmitting ? 'Saving...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  titleContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  photoPicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: 'relative',
    marginBottom: 12,
  },
  photoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  photoHint: {
    fontSize: 14,
    color: '#94A3B8',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    color: '#0F172A',
    paddingVertical: 16,
  },
  clearButton: {
    padding: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 32,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  continueButtonTextDisabled: {
    color: '#94A3B8',
  },
});
