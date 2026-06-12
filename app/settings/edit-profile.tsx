/**
 * Edit Profile Screen
 *
 * Form to edit user profile information including profile photo.
 * Uses StyleSheet for consistent styling across the app.
 */

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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save, Camera } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { TUFTE_BACKGROUND } from '@/components/cards';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { AvatarStorageService } from '@/services/storage/AvatarStorageService';
import { supabase } from '@/services/supabase';
import { getSafeImageUri } from '@/lib/utils/safeImageUri';
import { fontFamily } from '@/lib/design-tokens-editorial';

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, userProfile, updateUserProfile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = React.useState(false);
  const [fullName, setFullName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [photoUri, setPhotoUri] = React.useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const [position, setPosition] = React.useState('');
  const [boatClass, setBoatClass] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [club, setClub] = React.useState('');
  const [seasons, setSeasons] = React.useState('');
  const safePhotoUri = getSafeImageUri(photoUri);

  // Initialize from userProfile
  React.useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.full_name || '');
      setBio(userProfile.bio || '');
      setPhotoUri(userProfile.avatar_url || null);
    }
  }, [userProfile]);

  // Descriptor fields live on profiles, not users
  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('sailing_position, sailing_class, sailing_location, sailing_club, seasons_active')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPosition(data.sailing_position || '');
        setBoatClass(data.sailing_class || '');
        setLocation(data.sailing_location || '');
        setClub(data.sailing_club || '');
        setSeasons(data.seasons_active != null ? String(data.seasons_active) : '');
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  const uploadAvatar = async (uri: string): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      setUploadingPhoto(true);
      return await AvatarStorageService.uploadAvatar(user.id, uri);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const handleSave = async () => {
    if (!user) return;

    if (!fullName.trim()) {
      showAlert('Error', 'Name is required');
      return;
    }

    setSaving(true);

    try {
      const updates: { full_name: string; bio: string | null; avatar_url?: string } = {
        full_name: fullName.trim(),
        bio: bio.trim() || null,
      };

      // Upload photo if it changed (local file URI vs remote URL)
      // Check for file://, blob:, or data: URIs which indicate a new local image
      const isLocalImage = photoUri && (
        photoUri.startsWith('file://') ||
        photoUri.startsWith('blob:') ||
        photoUri.startsWith('data:')
      );
      if (isLocalImage) {
        const uploadedUrl = await uploadAvatar(photoUri);
        if (uploadedUrl) {
          updates.avatar_url = uploadedUrl;
        }
      }

      await updateUserProfile(updates);

      const seasonsNum = parseInt(seasons.trim(), 10);
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          // profiles.email is NOT NULL with no default; upsert builds the
          // full insert tuple, so omitting it fails even on existing rows
          email: user.email ?? '',
          sailing_position: position.trim() || null,
          sailing_class: boatClass.trim() || null,
          sailing_location: location.trim() || null,
          sailing_club: club.trim() || null,
          seasons_active: Number.isFinite(seasonsNum) ? seasonsNum : null,
        },
        { onConflict: 'id' },
      );
      if (profileError) throw profileError;

      queryClient.invalidateQueries({ queryKey: ['person-public-sections'] });
      queryClient.invalidateQueries({ queryKey: ['sailor-full-profile', user.id] });

      showAlert('Success', 'Profile updated successfully');
      router.back();
    } catch (error) {
      console.error('Error saving profile:', error);
      showAlert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!userProfile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={IOS_COLORS.label} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Save size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity
            style={styles.photoContainer}
            onPress={handlePickPhoto}
            disabled={saving || uploadingPhoto}
            activeOpacity={0.8}
          >
            {safePhotoUri ? (
              <Image source={{ uri: safePhotoUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.initials}>{getInitials(fullName || user?.email || '')}</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Camera size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.photoHint}>Tap to change photo</Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your name"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              value={user?.email || ''}
              editable={false}
              style={[styles.input, styles.inputDisabled]}
            />
            <Text style={styles.fieldHint}>
              Email cannot be changed here
            </Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="A couple of sentences about yourself — what you're working on and what you're into."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={[styles.input, styles.inputMultiline]}
              multiline
              numberOfLines={4}
              maxLength={400}
              textAlignVertical="top"
            />
            <Text style={styles.fieldHint}>
              {bio.length}/400 · shown on your public profile
            </Text>
          </View>

        </View>

        {/* Sailing descriptor — shown on the public person card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sailing Profile</Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Position</Text>
            <TextInput
              value={position}
              onChangeText={setPosition}
              placeholder="e.g. Helm, Trimmer, Bow"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Class</Text>
            <TextInput
              value={boatClass}
              onChangeText={setBoatClass}
              placeholder="e.g. Dragon, Etchells, ILCA 7"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Hong Kong"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Club</Text>
            <TextInput
              value={club}
              onChangeText={setClub}
              placeholder="e.g. RHKYC"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={styles.input}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Seasons Active</Text>
            <TextInput
              value={seasons}
              onChangeText={(text) => setSeasons(text.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 3"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              style={styles.input}
              keyboardType="number-pad"
            />
            <Text style={styles.fieldHint}>
              Shown as “N seasons” on your public profile
            </Text>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TUFTE_BACKGROUND,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 36,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  photoHint: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
  },
  saveButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: IOS_COLORS.label,
  },
  inputDisabled: {
    backgroundColor: '#F1F3F4',
    color: IOS_COLORS.secondaryLabel,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: 12,
    lineHeight: 22,
  },
});
