/**
 * ProfileCard
 *
 * Apple ID-style profile card rendered inside an IOSListSection.
 * Shows avatar image (or initials fallback), name, email, home club/venue, and a chevron.
 * Supports inline editing — tap the card row to start editing fields.
 * Supports photo picking — tap the avatar to change profile picture.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { IOS_COLORS, IOS_TYPOGRAPHY } from '@/lib/design-tokens-ios';
import { accountStyles, getInitials, formatMemberSince } from './accountStyles';
import { IOSListSection } from '@/components/ui/ios/IOSListSection';
import { AvatarStorageService } from '@/services/storage/AvatarStorageService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { getSafeImageUri } from '@/lib/utils/safeImageUri';

interface ProfileUpdates {
  full_name?: string;
  home_club?: string;
  home_venue?: string;
  avatar_url?: string;
}

interface ProfileCardProps {
  name: string;
  email?: string;
  avatarUrl?: string;
  userId?: string;
  homeClub?: string;
  homeVenue?: string;
  memberSince?: string | Date | null;
  onSave?: (updates: ProfileUpdates) => Promise<void>;
}

export function TufteProfileHeader({
  name,
  email,
  avatarUrl,
  userId,
  homeClub,
  homeVenue,
  memberSince,
  onSave,
}: ProfileCardProps) {
  const initials = getInitials(name);
  const memberSinceText = formatMemberSince(memberSince);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const safeAvatarUrl = getSafeImageUri(localAvatarUrl);

  // Update local avatar when prop changes
  React.useEffect(() => {
    setLocalAvatarUrl(avatarUrl);
  }, [avatarUrl]);

  const handlePickPhoto = useCallback(async () => {
    if (!userId || !onSave) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setLocalAvatarUrl(uri); // Show preview immediately
        setUploadingAvatar(true);

        try {
          const finalUrl = await AvatarStorageService.uploadAvatar(userId, uri);
          setLocalAvatarUrl(finalUrl);

          // Save to profile
          await onSave({ avatar_url: finalUrl });
        } catch (error) {
          console.error('Error uploading avatar:', error);
          setLocalAvatarUrl(avatarUrl); // Revert on error
          showAlert('Error', 'Failed to upload photo. Please try again.');
        } finally {
          setUploadingAvatar(false);
        }
      }
    } catch (error) {
      showAlert('Error', 'Failed to pick image. Please try again.');
    }
  }, [userId, onSave, avatarUrl]);

  // Inline editing state
  const [editingField, setEditingField] = useState<'name' | 'club' | 'venue' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleStartEdit = useCallback((field: 'name' | 'club' | 'venue') => {
    if (!onSave) return;
    const currentValue = field === 'name' ? name : field === 'club' ? homeClub : homeVenue;
    setEditValue(currentValue || '');
    setEditingField(field);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [name, homeClub, homeVenue, onSave]);

  const handleSave = useCallback(async () => {
    if (!editingField || !onSave) return;

    const trimmedValue = editValue.trim();
    const currentValue = editingField === 'name' ? name : editingField === 'club' ? homeClub : homeVenue;

    if (trimmedValue === (currentValue || '')) {
      setEditingField(null);
      return;
    }

    setIsSaving(true);
    try {
      const updates: ProfileUpdates = {};
      if (editingField === 'name') updates.full_name = trimmedValue;
      else if (editingField === 'club') updates.home_club = trimmedValue;
      else if (editingField === 'venue') updates.home_venue = trimmedValue;
      await onSave(updates);
      setEditingField(null);
    } catch (error) {
      console.error('[ProfileCard] Save error:', error);
      setEditingField(null);
    } finally {
      setIsSaving(false);
    }
  }, [editingField, editValue, name, homeClub, homeVenue, onSave]);

  const handleCardPress = useCallback(() => {
    if (onSave && !editingField) {
      handleStartEdit('name');
    }
  }, [onSave, editingField, handleStartEdit]);

  // Build subtitle
  const homeLocation = [homeClub, homeVenue].filter(Boolean).join(' \u00b7 ');
  const subtitleParts: string[] = [];
  if (email) subtitleParts.push(email);
  if (homeLocation) {
    subtitleParts.push(homeLocation);
  } else if (onSave) {
    subtitleParts.push('Add home club & venue');
  }

  // Render editing inline field
  const renderEditField = (field: 'name' | 'club' | 'venue', placeholder: string) => {
    if (editingField !== field) return null;
    return (
      <View style={localStyles.editContainer}>
        <TextInput
          ref={inputRef}
          style={[localStyles.editInput, isSaving && localStyles.editInputSaving]}
          value={editValue}
          onChangeText={setEditValue}
          onBlur={handleSave}
          onSubmitEditing={handleSave}
          placeholder={placeholder}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          returnKeyType="done"
          autoCapitalize="words"
          editable={!isSaving}
          selectTextOnFocus
        />
        {isSaving && (
          <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} style={{ marginLeft: 6 }} />
        )}
      </View>
    );
  };

  return (
    <IOSListSection footer={memberSinceText || undefined}>
      <View style={accountStyles.profileCardRow}>
        {/* Avatar with tap to change photo */}
        <TouchableOpacity
          style={localStyles.avatarContainer}
          onPress={handlePickPhoto}
          disabled={!onSave || uploadingAvatar}
          activeOpacity={0.7}
        >
          {safeAvatarUrl ? (
            <Image source={{ uri: safeAvatarUrl }} style={accountStyles.profileAvatar} />
          ) : (
            <View style={accountStyles.profileAvatar}>
              <Text style={accountStyles.profileAvatarText}>{initials}</Text>
            </View>
          )}
          {onSave && (
            <View style={localStyles.cameraBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Text content - tappable for editing */}
        <TouchableOpacity
          style={accountStyles.profileTextContainer}
          onPress={handleCardPress}
          activeOpacity={0.6}
          disabled={!!editingField}
        >
          {editingField === 'name' ? (
            renderEditField('name', 'Your Name')
          ) : (
            <Text style={accountStyles.profileName} numberOfLines={1}>{name}</Text>
          )}

          {subtitleParts.map((part, i) => (
            <Text
              key={i}
              style={[
                accountStyles.profileSubtitle,
                part === 'Add home club & venue' && accountStyles.profilePlaceholder,
              ]}
              numberOfLines={1}
            >
              {part}
            </Text>
          ))}

          {/* Inline edit fields for club/venue when editing */}
          {editingField === 'club' && renderEditField('club', 'Home Club')}
          {editingField === 'venue' && renderEditField('venue', 'Home Venue')}
        </TouchableOpacity>

        {/* Trailing chevron */}
        {!editingField && (
          <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.tertiaryLabel} />
        )}
      </View>
    </IOSListSection>
  );
}

const localStyles = StyleSheet.create({
  avatarContainer: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  editInput: {
    flex: 1,
    fontSize: IOS_TYPOGRAPHY.body.fontSize,
    color: IOS_COLORS.label,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemBlue,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  editInputSaving: {
    opacity: 0.6,
  },
});
