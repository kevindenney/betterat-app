/**
 * EditResourceSheet — bottom sheet for editing an existing library resource.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { ResourceTypeIcon, getResourceTypeLabel } from './ResourceTypeIcon';
import { useUpdateResource } from '@/hooks/useLibrary';
import type { LibraryResourceRecord, ResourceType, UpdateLibraryResourceInput } from '@/types/library';

const RESOURCE_TYPES: ResourceType[] = [
  'youtube_video',
  'youtube_channel',
  'online_course',
  'website',
  'book_digital',
  'book_physical',
  'social_media',
  'cloud_folder',
  'other',
];

interface EditResourceSheetProps {
  visible: boolean;
  resource: LibraryResourceRecord | null;
  libraryId: string;
  onClose: () => void;
}

export function EditResourceSheet({ visible, resource, libraryId, onClose }: EditResourceSheetProps) {
  const updateResource = useUpdateResource();

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('website');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');

  // Populate form when resource changes
  useEffect(() => {
    if (resource) {
      setTitle(resource.title);
      setUrl(resource.url ?? '');
      setResourceType(resource.resource_type);
      setAuthor(resource.author_or_creator ?? '');
      setDescription(resource.description ?? '');
    }
  }, [resource]);

  const handleSave = useCallback(() => {
    if (!title.trim() || !resource) return;

    const input: UpdateLibraryResourceInput = {
      title: title.trim(),
      url: url.trim() || null,
      resource_type: resourceType,
      author_or_creator: author.trim() || null,
      description: description.trim() || null,
    };

    updateResource.mutate(
      { resourceId: resource.id, input, libraryId },
      { onSuccess: () => onClose() },
    );
  }, [title, url, resourceType, author, description, resource, libraryId, updateResource, onClose]);

  if (!resource) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Resource</Text>
          <Pressable onPress={handleSave} disabled={!title.trim()}>
            <Text style={[styles.saveText, !title.trim() && styles.saveTextDisabled]}>
              Save
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Resource title"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
            />
          </View>

          {/* URL */}
          <View style={styles.field}>
            <Text style={styles.label}>URL</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://..."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Resource Type */}
          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeRow}
            >
              {RESOURCE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.typeChip,
                    resourceType === type && styles.typeChipSelected,
                  ]}
                  onPress={() => setResourceType(type)}
                >
                  <ResourceTypeIcon type={type} size={14} />
                  <Text
                    style={[
                      styles.typeChipText,
                      resourceType === type && styles.typeChipTextSelected,
                    ]}
                  >
                    {getResourceTypeLabel(type)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Author */}
          <View style={styles.field}>
            <Text style={styles.label}>Author / Creator</Text>
            <TextInput
              style={styles.input}
              value={author}
              onChangeText={setAuthor}
              placeholder="Who created this?"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Why is this resource useful?"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
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
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  cancelText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  saveTextDisabled: {
    color: IOS_COLORS.systemGray3,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.md,
    paddingBottom: 100,
  },
  field: {
    gap: IOS_SPACING.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    padding: IOS_SPACING.sm,
    fontSize: 16,
    color: IOS_COLORS.label,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  textArea: {
    minHeight: 80,
  },
  typeRow: {
    gap: IOS_SPACING.xs,
    paddingVertical: 2,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
  },
  typeChipSelected: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderColor: IOS_COLORS.systemBlue,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  typeChipTextSelected: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
});
