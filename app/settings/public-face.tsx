import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';

import { IOS_COLORS, IOS_TYPOGRAPHY } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import {
  getDescriptorFields,
  getDescriptorIdentity,
  type DescriptorValues,
} from '@/lib/profile-descriptors';
import { getSafeImageUri } from '@/lib/utils/safeImageUri';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import {
  DEFAULT_SETTINGS,
  getPrivacySettings,
  updateProfilePrivacy,
  type PrivacySettings,
  type ProfilePrivacySettings,
} from '@/services/PrivacySettingsService';
import {
  getPublicFaceSettings,
  movePublicFaceInterest,
  setPublicFaceInterestActive,
  setPublicFacePrimaryInterest,
  updatePublicFaceDescriptors,
  type PublicFaceInterestSettings,
} from '@/services/PublicFaceSettingsService';
import { AvatarStorageService } from '@/services/storage/AvatarStorageService';
import type { TimelineStepVisibility } from '@/types/timeline-steps';
import type { StepLocationPrecision } from '@/types/step-detail';

const ICON_BACKGROUNDS = {
  blue: IOS_COLORS.systemBlue,
  green: IOS_COLORS.systemGreen,
  orange: IOS_COLORS.systemOrange,
  purple: IOS_COLORS.systemPurple,
  gray: IOS_COLORS.systemGray,
} as const;

const SECTION_TOGGLES: {
  key: keyof ProfilePrivacySettings;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}[] = [
  { key: 'show_framing', title: 'Framing', icon: 'text-outline', color: ICON_BACKGROUNDS.blue },
  { key: 'show_working_on_now', title: 'Working on now', icon: 'flask-outline', color: ICON_BACKGROUNDS.orange },
  { key: 'show_capabilities', title: 'Capabilities', icon: 'ribbon-outline', color: ICON_BACKGROUNDS.green },
  { key: 'show_practice_timeline', title: 'Practice timeline', icon: 'footsteps-outline', color: ICON_BACKGROUNDS.purple },
  { key: 'show_practice_circle', title: 'Practice circle', icon: 'people-circle-outline', color: ICON_BACKGROUNDS.blue },
  { key: 'show_orgs', title: 'Organizations', icon: 'business-outline', color: ICON_BACKGROUNDS.gray },
  { key: 'show_published_blueprints', title: 'Published plans', icon: 'documents-outline', color: ICON_BACKGROUNDS.orange },
  { key: 'show_events', title: 'Events', icon: 'trophy-outline', color: ICON_BACKGROUNDS.green },
];

const INTERACTION_TOGGLES: {
  key: keyof ProfilePrivacySettings;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}[] = [
  { key: 'allow_follow', title: 'Allow follows', icon: 'person-add-outline', color: ICON_BACKGROUNDS.blue },
  { key: 'allow_message', title: 'Allow messages', icon: 'chatbubble-outline', color: ICON_BACKGROUNDS.green },
  { key: 'allow_suggest_step', title: 'Allow step suggestions', icon: 'bulb-outline', color: ICON_BACKGROUNDS.orange },
  { key: 'allow_reflect', title: 'Allow reflections', icon: 'create-outline', color: ICON_BACKGROUNDS.purple },
];

const VISIBILITY_LABELS: Record<TimelineStepVisibility, string> = {
  private: 'Private',
  crew: 'Collaborators',
  fleet: 'Group',
  public: 'Public',
};

const PRECISION_LABELS: Record<Exclude<StepLocationPrecision, 'site'>, string> = {
  exact: 'Exact',
  neighborhood: 'Approximate',
  hidden: 'Hidden',
};

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function cleanDescriptors(values: DescriptorValues): DescriptorValues {
  const cleaned: DescriptorValues = {};
  for (const [key, value] of Object.entries(values)) {
    const trimmed = (value ?? '').trim();
    if (trimmed) cleaned[key] = trimmed;
  }
  return cleaned;
}

function leavePublicFaceSettings() {
  router.replace('/settings');
}

export default function PublicFaceSettingsScreen() {
  const { user, userProfile, updateUserProfile, ready } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyInterestId, setBusyInterestId] = useState<string | null>(null);
  const [profilePublic, setProfilePublic] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [descriptors, setDescriptors] = useState<DescriptorValues>({});
  const [interests, setInterests] = useState<PublicFaceInterestSettings[]>([]);
  const [privacy, setPrivacy] = useState<PrivacySettings>({ ...DEFAULT_SETTINGS });
  const mounted = useRef(true);

  const safePhotoUri = getSafeImageUri(photoUri);
  const leadInterest = useMemo(
    () => interests.find((interest) => interest.isActive && interest.isPrimary) ?? interests.find((interest) => interest.isActive) ?? null,
    [interests],
  );
  const descriptor = useMemo(() => {
    const byDescriptors = getDescriptorIdentity(leadInterest?.slug, descriptors);
    const location = descriptors.location?.trim();
    return [leadInterest?.name, location].filter(Boolean).join(' · ') || byDescriptors || 'Public face';
  }, [descriptors, leadInterest?.name, leadInterest?.slug]);
  const descriptorFields = useMemo(() => getDescriptorFields(leadInterest?.slug), [leadInterest?.slug]);

  const invalidatePublicFace = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['person-public-sections'] });
    if (user?.id) queryClient.invalidateQueries({ queryKey: ['sailor-full-profile', user.id] });
  }, [queryClient, user?.id]);

  const load = useCallback(async () => {
    if (!ready) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [faceData, privacyData] = await Promise.all([
        getPublicFaceSettings(user.id),
        getPrivacySettings(user.id),
      ]);
      if (!mounted.current) return;
      setFullName(faceData.profile.fullName || userProfile?.full_name || '');
      setBio(faceData.profile.bio || '');
      setPhotoUri(faceData.profile.avatarUrl);
      setDescriptors(faceData.profile.descriptors);
      setInterests(faceData.interests);
      setPrivacy(privacyData);
      setProfilePublic(privacyData.profile_public);
    } catch (error) {
      console.error('[PublicFaceSettings] load failed', error);
      showAlert('Unable to load public face', 'Please try again in a moment.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [ready, user?.id, userProfile?.full_name]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const updatePrivacy = useCallback(
    async <K extends keyof ProfilePrivacySettings>(key: K, value: ProfilePrivacySettings[K]) => {
      if (!user?.id) return;
      const previous = privacy;
      const next = { ...privacy, [key]: value };
      setPrivacy(next);
      if (key === 'profile_public') setProfilePublic(Boolean(value));
      try {
        await updateProfilePrivacy(user.id, { [key]: value });
        invalidatePublicFace();
      } catch (error) {
        console.error('[PublicFaceSettings] privacy update failed', error);
        setPrivacy(previous);
        if (key === 'profile_public') setProfilePublic(previous.profile_public);
        showAlert('Unable to save', 'Please try again.');
      }
    },
    [invalidatePublicFace, privacy, user?.id],
  );

  const pickPhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      showAlert('Unable to pick photo', 'Please try again.');
    }
  }, []);

  const saveIdentity = useCallback(async () => {
    if (!user?.id) return;
    const name = fullName.trim();
    if (!name) {
      showAlert('Name required', 'Add a display name before saving.');
      return;
    }

    setSaving(true);
    try {
      let avatarUrl = photoUri ?? null;
      if (
        photoUri &&
        (photoUri.startsWith('file://') || photoUri.startsWith('blob:') || photoUri.startsWith('data:'))
      ) {
        avatarUrl = await AvatarStorageService.uploadAvatar(user.id, photoUri);
      }

      await updateUserProfile({
        full_name: name,
        bio: bio.trim() || null,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      });
      await updatePublicFaceDescriptors(
        user.id,
        user.email ?? userProfile?.email ?? '',
        cleanDescriptors(descriptors),
      );
      invalidatePublicFace();
      leavePublicFaceSettings();
    } catch (error) {
      console.error('[PublicFaceSettings] save identity failed', error);
      showAlert('Unable to save public face', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    bio,
    descriptors,
    fullName,
    invalidatePublicFace,
    photoUri,
    updateUserProfile,
    user?.email,
    user?.id,
    userProfile?.email,
  ]);

  const updateInterestActive = useCallback(
    async (interest: PublicFaceInterestSettings, active: boolean) => {
      if (!user?.id) return;
      const previous = interests;
      setBusyInterestId(interest.membershipId);
      setInterests((rows) =>
        rows.map((row) =>
          row.membershipId === interest.membershipId
            ? { ...row, isActive: active, isPrimary: active ? row.isPrimary : false }
            : row,
        ),
      );
      try {
        await setPublicFaceInterestActive(user.id, interest.membershipId, active);
        await load();
        invalidatePublicFace();
      } catch (error) {
        console.error('[PublicFaceSettings] interest active update failed', error);
        setInterests(previous);
        showAlert('Unable to update interest', 'Please try again.');
      } finally {
        setBusyInterestId(null);
      }
    },
    [interests, invalidatePublicFace, load, user?.id],
  );

  const updatePrimaryInterest = useCallback(
    async (interest: PublicFaceInterestSettings) => {
      if (!user?.id) return;
      const previous = interests;
      setBusyInterestId(interest.membershipId);
      setInterests((rows) =>
        rows.map((row) => ({
          ...row,
          isActive: row.membershipId === interest.membershipId ? true : row.isActive,
          isPrimary: row.membershipId === interest.membershipId,
        })),
      );
      try {
        await setPublicFacePrimaryInterest(user.id, interest.membershipId);
        await load();
        invalidatePublicFace();
      } catch (error) {
        console.error('[PublicFaceSettings] primary update failed', error);
        setInterests(previous);
        showAlert('Unable to set lead interest', 'Please try again.');
      } finally {
        setBusyInterestId(null);
      }
    },
    [interests, invalidatePublicFace, load, user?.id],
  );

  const moveInterest = useCallback(
    async (interest: PublicFaceInterestSettings, direction: -1 | 1) => {
      if (!user?.id) return;
      setBusyInterestId(interest.membershipId);
      try {
        await movePublicFaceInterest(user.id, interest.membershipId, direction);
        await load();
        invalidatePublicFace();
      } catch (error) {
        console.error('[PublicFaceSettings] reorder failed', error);
        showAlert('Unable to reorder interests', 'Please try again.');
      } finally {
        setBusyInterestId(null);
      }
    },
    [invalidatePublicFace, load, user?.id],
  );

  const cycleDefaultVisibility = useCallback(() => {
    const values: TimelineStepVisibility[] = ['private', 'crew', 'fleet', 'public'];
    const index = values.indexOf(privacy.default_step_visibility);
    updatePrivacy('default_step_visibility', values[(index + 1) % values.length]);
  }, [privacy.default_step_visibility, updatePrivacy]);

  const cycleLocationPrecision = useCallback(() => {
    const values: (StepLocationPrecision | null)[] = [null, 'neighborhood', 'hidden'];
    const current = privacy.default_location_precision;
    const index = values.indexOf(current);
    updatePrivacy('default_location_precision', values[(index + 1) % values.length]);
  }, [privacy.default_location_precision, updatePrivacy]);

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Public face',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity
                onPress={leavePublicFaceSettings}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.headerBack}
              >
                <Ionicons name="chevron-back" size={26} color={IOS_COLORS.systemBlue} />
                <Text style={styles.headerBackText}>Settings</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
        </View>
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Stack.Screen
        options={{
          title: 'Public face',
          headerShown: true,
          headerBackTitle: 'Settings',
          headerLeft: () => (
            <TouchableOpacity
              onPress={leavePublicFaceSettings}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.headerBack}
            >
              <Ionicons name="chevron-back" size={26} color={IOS_COLORS.systemBlue} />
              <Text style={styles.headerBackText}>Settings</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={saveIdentity} disabled={saving} hitSlop={8}>
              {saving ? (
                <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
              ) : (
                <Text style={styles.doneText}>Done</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.previewStrip}>
          <Pressable onPress={pickPhoto} style={styles.avatar} accessibilityRole="button">
            {safePhotoUri ? (
              <Image source={{ uri: safePhotoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initialsForName(fullName || user?.email || 'User')}</Text>
            )}
          </Pressable>
          <View style={styles.previewBody}>
            <Text style={styles.previewName} numberOfLines={1}>{fullName || 'User'}</Text>
            <Text style={styles.previewDescriptor} numberOfLines={1}>{descriptor}</Text>
          </View>
          {user?.id ? (
            <TouchableOpacity
              onPress={() => router.push(`/profile/${user.id}?preview=1` as any)}
              style={styles.previewLink}
            >
              <Text style={styles.previewLinkText}>Preview</Text>
              <Ionicons name="chevron-forward" size={15} color={IOS_COLORS.systemBlue} />
            </TouchableOpacity>
          ) : null}
        </View>

        <SettingsGroup header="Identity">
          <TouchableOpacity style={styles.row} onPress={pickPhoto} activeOpacity={0.75}>
            <IconBadge icon="camera-outline" color={ICON_BACKGROUNDS.gray} />
            <Text style={styles.rowTitle}>Photo</Text>
            <Text style={styles.rowValue}>Change</Text>
            <Ionicons name="chevron-forward" size={18} color={IOS_COLORS.tertiaryLabel} />
          </TouchableOpacity>
          <Field
            label="Display name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
          />
          <Field
            label="Framing - your one line"
            value={bio}
            onChangeText={setBio}
            placeholder="What are you building in this practice?"
            multiline
            maxLength={240}
            footer={`Shown at the top of your public face · ${bio.length}/240`}
            serif
          />
          {descriptorFields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              value={descriptors[field.key] ?? ''}
              onChangeText={(text) =>
                setDescriptors((prev) => ({
                  ...prev,
                  [field.key]: field.type === 'number' ? text.replace(/[^0-9]/g, '') : text,
                }))
              }
              placeholder={field.placeholder}
              keyboardType={field.type === 'number' ? 'number-pad' : 'default'}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup
          header="Interests on your profile"
          footer="The lead interest sets your headline. Only enabled interests appear as chips and group your timeline."
        >
          {interests.map((interest, index) => (
            <InterestRow
              key={interest.membershipId}
              interest={interest}
              first={index === 0}
              last={index === interests.length - 1}
              busy={busyInterestId === interest.membershipId}
              onToggle={(active) => updateInterestActive(interest, active)}
              onSetPrimary={() => updatePrimaryInterest(interest)}
              onMoveUp={() => moveInterest(interest, -1)}
              onMoveDown={() => moveInterest(interest, 1)}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup
          header="Sections on your face"
          footer={profilePublic ? undefined : 'Turn on Public Profile to make these sections visible to others.'}
        >
          <SwitchRow
            title="Public profile"
            icon="globe-outline"
            color={ICON_BACKGROUNDS.blue}
            value={profilePublic}
            onValueChange={(value) => updatePrivacy('profile_public', value)}
          />
          {SECTION_TOGGLES.map((toggle) => (
            <SwitchRow
              key={toggle.key}
              title={toggle.title}
              icon={toggle.icon}
              color={toggle.color}
              value={profilePublic && Boolean(privacy[toggle.key])}
              disabled={!profilePublic}
              onValueChange={(value) => updatePrivacy(toggle.key, value)}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup header="Who can interact">
          <SwitchRow
            title="Share activity with followers"
            icon="people-outline"
            color={ICON_BACKGROUNDS.green}
            value={privacy.allow_follower_sharing}
            onValueChange={(value) => updatePrivacy('allow_follower_sharing', value)}
          />
          {INTERACTION_TOGGLES.map((toggle) => (
            <SwitchRow
              key={toggle.key}
              title={toggle.title}
              icon={toggle.icon}
              color={toggle.color}
              value={Boolean(privacy[toggle.key])}
              onValueChange={(value) => updatePrivacy(toggle.key, value)}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup header="Defaults">
          <ValueRow
            title="Default step visibility"
            value={VISIBILITY_LABELS[privacy.default_step_visibility] ?? 'Private'}
            icon="eye-outline"
            color={ICON_BACKGROUNDS.orange}
            onPress={cycleDefaultVisibility}
          />
          <ValueRow
            title="Default location sharing"
            value={
              privacy.default_location_precision
                ? PRECISION_LABELS[privacy.default_location_precision as Exclude<StepLocationPrecision, 'site'>] ?? 'Approximate'
                : 'Exact'
            }
            icon="location-outline"
            color={ICON_BACKGROUNDS.blue}
            onPress={cycleLocationPrecision}
          />
        </SettingsGroup>

        {user?.id ? (
          <TouchableOpacity
            onPress={() => router.push(`/profile/${user.id}?preview=1` as any)}
            style={styles.previewButton}
            activeOpacity={0.85}
          >
            <Ionicons name="eye-outline" size={17} color="#FFFFFF" />
            <Text style={styles.previewButtonText}>Preview as public</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SettingsGroup({
  header,
  footer,
  children,
}: {
  header: string;
  footer?: string;
  children: React.ReactNode;
}) {
  const childArray = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{header.toUpperCase()}</Text>
      <View style={styles.card}>
        {childArray.map((child, index) => (
          <React.Fragment key={index}>
            {child}
            {index < childArray.length - 1 ? <View style={styles.separator} /> : null}
          </React.Fragment>
        ))}
      </View>
      {footer ? <Text style={styles.groupFooter}>{footer}</Text> : null}
    </View>
  );
}

function IconBadge({
  icon,
  color,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.iconBadge, { backgroundColor: disabled ? IOS_COLORS.systemGray4 : color }]}>
      <Ionicons name={icon} size={17} color="#FFFFFF" />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  footer,
  multiline,
  maxLength,
  keyboardType,
  serif,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  footer?: string;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'number-pad';
  serif?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={IOS_COLORS.tertiaryLabel}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.inputMultiline, serif && styles.serifInput]}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {footer ? <Text style={styles.fieldFooter}>{footer}</Text> : null}
    </View>
  );
}

function SwitchRow({
  title,
  icon,
  color,
  value,
  disabled,
  onValueChange,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <IconBadge icon={icon} color={color} disabled={disabled} />
      <Text style={[styles.rowTitle, disabled && styles.disabledText]}>{title}</Text>
      <IosSwitch value={value} disabled={disabled} onValueChange={onValueChange} />
    </View>
  );
}

function ValueRow({
  title,
  value,
  icon,
  color,
  onPress,
}: {
  title: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={0.75}>
      <IconBadge icon={icon} color={color} />
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={18} color={IOS_COLORS.tertiaryLabel} />
    </TouchableOpacity>
  );
}

function InterestRow({
  interest,
  first,
  last,
  busy,
  onToggle,
  onSetPrimary,
  onMoveUp,
  onMoveDown,
}: {
  interest: PublicFaceInterestSettings;
  first: boolean;
  last: boolean;
  busy: boolean;
  onToggle: (active: boolean) => void;
  onSetPrimary: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const subtitle = interest.isActive
    ? `${interest.stepCount} step${interest.stepCount === 1 ? '' : 's'}${interest.isPrimary ? ' · headlines your descriptor' : ''}`
    : `${interest.stepCount} step${interest.stepCount === 1 ? '' : 's'} · hidden from profile`;
  return (
    <View style={[styles.interestRow, !interest.isActive && styles.rowDisabled]}>
      <View style={styles.reorderColumn}>
        <TouchableOpacity
          onPress={onMoveUp}
          disabled={first || busy}
          hitSlop={6}
          style={styles.reorderButton}
        >
          <Ionicons name="chevron-up" size={14} color={first ? IOS_COLORS.quaternaryLabel : IOS_COLORS.tertiaryLabel} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onMoveDown}
          disabled={last || busy}
          hitSlop={6}
          style={styles.reorderButton}
        >
          <Ionicons name="chevron-down" size={14} color={last ? IOS_COLORS.quaternaryLabel : IOS_COLORS.tertiaryLabel} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={onSetPrimary}
        disabled={busy}
        style={[styles.radio, interest.isPrimary && styles.radioOn, !interest.isActive && styles.radioOff]}
        accessibilityRole="button"
        accessibilityLabel={`Set ${interest.name} as lead interest`}
      >
        {interest.isPrimary ? <View style={styles.radioDot} /> : null}
      </TouchableOpacity>
      <View style={styles.interestBody}>
        <View style={styles.interestNameRow}>
          <Text style={[styles.interestName, !interest.isActive && styles.disabledText]} numberOfLines={1}>
            {interest.name}
          </Text>
          {interest.isPrimary ? (
            <View style={styles.leadPill}>
              <Text style={styles.leadPillText}>Lead</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.interestSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} style={styles.interestSpinner} />
      ) : (
        <IosSwitch value={interest.isActive} onValueChange={onToggle} />
      )}
    </View>
  );
}

function IosSwitch({
  value,
  disabled,
  onValueChange,
}: {
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!disabled) onValueChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[styles.switch, value && styles.switchOn, disabled && styles.switchDisabled]}
    >
      <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  scroll: { flex: 1 },
  content: {
    paddingTop: 14,
    paddingBottom: 110,
  },
  doneText: {
    color: IOS_COLORS.systemBlue,
    fontSize: 17,
    fontWeight: '600',
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackText: {
    color: IOS_COLORS.systemBlue,
    fontSize: 17,
  },
  previewStrip: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5E6B73',
  },
  avatarImage: {
    width: 56,
    height: 56,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  previewBody: {
    flex: 1,
    minWidth: 0,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: 0,
  },
  previewDescriptor: {
    marginTop: 2,
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  previewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  previewLinkText: {
    color: IOS_COLORS.systemBlue,
    fontSize: 13,
    fontWeight: '600',
  },
  group: {
    marginTop: 22,
  },
  groupHeader: {
    marginHorizontal: 20,
    marginBottom: 7,
    color: IOS_COLORS.secondaryLabel,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  groupFooter: {
    marginHorizontal: 20,
    marginTop: 7,
    color: IOS_COLORS.tertiaryLabel,
    fontSize: 12,
    lineHeight: 17,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  row: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  rowDisabled: {
    opacity: 0.58,
  },
  separator: {
    marginLeft: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
  },
  iconBadge: {
    width: 29,
    height: 29,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    color: IOS_COLORS.label,
    letterSpacing: 0,
  },
  rowValue: {
    color: IOS_COLORS.secondaryLabel,
    fontSize: 15,
  },
  disabledText: {
    color: IOS_COLORS.tertiaryLabel,
  },
  field: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  fieldLabel: {
    marginBottom: 7,
    color: IOS_COLORS.secondaryLabel,
    fontSize: 12,
  },
  input: {
    padding: 0,
    color: IOS_COLORS.label,
    fontSize: 16,
    lineHeight: 21,
  },
  inputMultiline: {
    minHeight: 68,
  },
  serifInput: {
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 23,
  },
  fieldFooter: {
    marginTop: 7,
    color: IOS_COLORS.tertiaryLabel,
    fontSize: 12,
  },
  interestRow: {
    minHeight: 61,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  reorderColumn: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButton: {
    width: 20,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: IOS_COLORS.systemGray2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: '#D97757',
  },
  radioOff: {
    opacity: 0.6,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D97757',
  },
  interestBody: {
    flex: 1,
    minWidth: 0,
  },
  interestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  interestName: {
    color: IOS_COLORS.label,
    fontSize: 16,
    letterSpacing: 0,
    flexShrink: 1,
  },
  leadPill: {
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F7E8E2',
  },
  leadPillText: {
    color: '#D97757',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  interestSubtitle: {
    marginTop: 2,
    color: IOS_COLORS.tertiaryLabel,
    fontSize: 12,
  },
  interestSpinner: {
    width: 51,
  },
  switch: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemGray5,
    padding: 2,
  },
  switchOn: {
    backgroundColor: IOS_COLORS.systemGreen,
  },
  switchDisabled: {
    opacity: 0.8,
  },
  switchThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  switchThumbOn: {
    transform: [{ translateX: 20 }],
  },
  previewButton: {
    marginHorizontal: 16,
    marginTop: 22,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#1C1C1E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontSize: IOS_TYPOGRAPHY.callout.fontSize,
    fontWeight: '600',
  },
});
