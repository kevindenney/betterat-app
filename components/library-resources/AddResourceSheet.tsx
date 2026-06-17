/**
 * AddResourceSheet — bottom sheet form for adding a library resource.
 * When resource_type is 'online_course', shows a course lesson editor
 * with optional AI decomposition.
 */

import React, { useState, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { ResourceTypeIcon, getResourceTypeLabel } from './ResourceTypeIcon';
import { CourseLessonEditor } from './CourseLessonEditor';
import { decomposeCourse } from '@/services/ai/CourseDecompositionService';
import { detectSourcePlatform, suggestResourceType } from '@/lib/utils/detectPlatform';
import { fetchYouTubeMetadata } from '@/services/YouTubeMetadataService';
import { fetchUrlMetadata } from '@/services/UrlMetadataService';
import { pickFile, uploadFile } from '@/services/LibraryUploadService';
import { useAuth } from '@/providers/AuthProvider';
import type { ResourceType, CreateLibraryResourceInput, CourseModule, CourseStructure, FileUploadMetadata } from '@/types/library';
import { formatFileSize } from '@/types/library';

const RESOURCE_TYPES: ResourceType[] = [
  'youtube_video',
  'youtube_channel',
  'online_course',
  'website',
  'pdf',
  'image',
  'document',
  'book_digital',
  'book_physical',
  'social_media',
  'cloud_folder',
  'note',
  'other',
];

interface AddResourceSheetProps {
  visible: boolean;
  libraryId: string;
  interestName?: string;
  onSubmit: (input: CreateLibraryResourceInput) => void | Promise<void>;
  onClose: () => void;
}

export function AddResourceSheet({ visible, libraryId, interestName, onSubmit, onClose }: AddResourceSheetProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('website');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);

  // File upload state
  const [fileUploadMeta, setFileUploadMeta] = useState<FileUploadMetadata | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // Note content state
  const [noteContent, setNoteContent] = useState('');
  // Submit state
  const [isSaving, setIsSaving] = useState(false);

  const handleUrlChange = useCallback((text: string) => {
    setUrl(text);
    const platform = detectSourcePlatform(text);
    setDetectedPlatform(platform);
    const suggestedType = suggestResourceType(text);
    if (suggestedType) {
      setResourceType(suggestedType);
    }
  }, []);

  // Auto-fill state
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const isYouTube = detectedPlatform === 'YouTube';

  const handleAutoFill = useCallback(async () => {
    if (!url.trim()) return;
    setIsAutoFilling(true);
    try {
      // Check if URL points to a PDF — extract title from filename instead of fetching
      const urlLower = url.trim().toLowerCase();
      const isPdf = urlLower.endsWith('.pdf') || urlLower.includes('.pdf?') || urlLower.includes('/pdf/');
      if (isPdf) {
        const urlObj = new URL(url.trim());
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1] || '';
        // Clean up filename: remove extension, replace separators with spaces, title case
        const cleaned = lastPart
          .replace(/\.pdf$/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/(%20)+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim();
        if (cleaned && !title.trim()) setTitle(cleaned);
        // Try to extract site name as author
        const hostname = urlObj.hostname.replace('www.', '');
        const siteName = hostname.split('.')[0]?.replace(/\b\w/g, (c) => c.toUpperCase());
        if (siteName && !author.trim()) setAuthor(siteName);
        if (!resourceType || resourceType === 'website') setResourceType('other');
        setIsAutoFilling(false);
        return;
      }

      if (isYouTube) {
        // YouTube: use oEmbed for richer data (title, author, thumbnail, AI notes)
        const meta = await fetchYouTubeMetadata(url.trim(), {
          interestName: interestName || undefined,
        });
        if (meta) {
          if (meta.title && !title.trim()) setTitle(meta.title);
          if (meta.author && !author.trim()) setAuthor(meta.author);
          if (meta.description && !description.trim()) setDescription(meta.description);
        } else {
          showAlert('Could Not Extract', 'Unable to fetch video metadata. You can fill in the fields manually.');
        }
      } else {
        // Generic: extract Open Graph / meta tags from any URL
        const meta = await fetchUrlMetadata(url.trim());
        if (meta) {
          if (meta.title && !title.trim()) setTitle(meta.title);
          if (meta.author && !author.trim()) setAuthor(meta.author);
          if (meta.description && !description.trim()) setDescription(meta.description);
        } else {
          showAlert('Could Not Extract', 'Unable to fetch page metadata. You can fill in the fields manually.');
        }
      }
    } catch (err: any) {
      showAlert('Auto-fill Failed', err?.message || 'Something went wrong.');
    } finally {
      setIsAutoFilling(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- isYouTube derives from detectedPlatform
  }, [url, title, author, description, interestName, isYouTube, resourceType]);

  // File upload handler
  const handlePickFile = useCallback(async () => {
    if (!user?.id) return;
    setIsUploading(true);
    try {
      const file = await pickFile();
      if (!file) {
        setIsUploading(false);
        return;
      }
      const result = await uploadFile(user.id, file);
      setFileUploadMeta(result.metadata);
      if (!title.trim()) setTitle(result.suggestedTitle);
      setResourceType(result.suggestedType);
      setDetectedPlatform(null);
      setUrl(''); // Clear URL since this is a file upload
    } catch (err: any) {
      showAlert('Upload Failed', err?.message || 'Could not upload file.');
    } finally {
      setIsUploading(false);
    }
  }, [user?.id, title]);

  const handleRemoveFile = useCallback(() => {
    setFileUploadMeta(null);
  }, []);

  // Course-specific state
  const [courseModules, setCourseModules] = useState<CourseModule[]>([]);
  const [isDecomposing, setIsDecomposing] = useState(false);

  const isCourse = resourceType === 'online_course';
  const isNote = resourceType === 'note';

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || isSaving) return;

    const metadata: Record<string, unknown> = {};

    if (isCourse && courseModules.length > 0) {
      let totalLessons = 0;
      let totalMinutes = 0;
      for (const m of courseModules) {
        totalLessons += m.lessons.length;
        for (const l of m.lessons) {
          totalMinutes += l.duration_minutes ?? 0;
        }
      }
      const courseStructure: CourseStructure = {
        modules: courseModules,
        total_lessons: totalLessons,
        estimated_hours: totalMinutes > 0 ? Math.round(totalMinutes / 60 * 10) / 10 : undefined,
      };
      metadata.course_structure = courseStructure;
      metadata.progress = { completed_lesson_ids: [] };
    }

    // Include file upload metadata
    if (fileUploadMeta) {
      metadata.file_upload = fileUploadMeta;
    }

    // Include note content
    if (isNote && noteContent.trim()) {
      metadata.note_content = noteContent.trim();
    }

    setIsSaving(true);
    try {
      await onSubmit({
        library_id: libraryId,
        title: title.trim(),
        url: fileUploadMeta?.public_url || url.trim() || null,
        resource_type: resourceType,
        source_platform: fileUploadMeta ? 'Upload' : detectedPlatform,
        author_or_creator: author.trim() || null,
        description: description.trim() || null,
        metadata,
      });
      // Reset form only after a successful save so input survives errors
      setTitle('');
      setUrl('');
      setResourceType('website');
      setAuthor('');
      setDescription('');
      setDetectedPlatform(null);
      setCourseModules([]);
      setFileUploadMeta(null);
      setNoteContent('');
    } catch (err: any) {
      showAlert(
        'Could Not Save',
        err?.message || 'Something went wrong. Your details are still here — try again.',
      );
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, url, resourceType, author, description, libraryId, onSubmit, isCourse, courseModules, fileUploadMeta, isNote, noteContent, isSaving]);

  const handleAIDecompose = useCallback(async () => {
    if (!title.trim()) return;
    setIsDecomposing(true);
    try {
      const structure = await decomposeCourse({
        courseTitle: title.trim(),
        courseUrl: url.trim() || undefined,
        authorOrCreator: author.trim() || undefined,
        description: description.trim() || undefined,
        interestName: interestName || 'general',
      });
      setCourseModules(structure.modules);
    } catch (err: any) {
      showAlert(
        'Could Not Extract Lessons',
        err?.message || 'Extraction failed. You can add lessons manually instead.',
      );
    } finally {
      setIsDecomposing(false);
    }
  }, [title, url, author, description, interestName]);

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
          <Text style={styles.headerTitle}>Add Resource</Text>
          <Pressable onPress={handleSubmit} disabled={!title.trim() || isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
            ) : (
              <Text style={[styles.saveText, !title.trim() && styles.saveTextDisabled]}>
                Save
              </Text>
            )}
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
              placeholder="e.g., Pen & Ink Drawing Course"
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              autoFocus
            />
          </View>

          {/* File Upload or URL — mutually exclusive */}
          {fileUploadMeta ? (
            <View style={styles.field}>
              <Text style={styles.label}>Uploaded File</Text>
              <View style={styles.uploadedFileRow}>
                <ResourceTypeIcon type={resourceType} size={20} />
                <View style={styles.uploadedFileInfo}>
                  <Text style={styles.uploadedFileName} numberOfLines={1}>
                    {fileUploadMeta.original_filename}
                  </Text>
                  <Text style={styles.uploadedFileSize}>
                    {formatFileSize(fileUploadMeta.file_size)}
                  </Text>
                </View>
                <Pressable onPress={handleRemoveFile} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={IOS_COLORS.systemGray3} />
                </Pressable>
              </View>
            </View>
          ) : !isNote ? (
            <>
              {/* Upload File Button */}
              <View style={styles.field}>
                <Text style={styles.label}>Upload or Link</Text>
                <View style={styles.uploadOrLinkRow}>
                  <Pressable
                    style={styles.uploadButton}
                    onPress={handlePickFile}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.uploadButtonText}>Upload File</Text>
                      </>
                    )}
                  </Pressable>
                  <Text style={styles.orText}>or paste a URL below</Text>
                </View>
              </View>

              {/* URL */}
              <View style={styles.field}>
                <Text style={styles.label}>URL</Text>
                <TextInput
                  style={styles.input}
                  value={url}
                  onChangeText={handleUrlChange}
                  placeholder="https://..."
                  placeholderTextColor={IOS_COLORS.tertiaryLabel}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {(detectedPlatform || url.trim().startsWith('http')) && (
                  <View style={styles.detectedRow}>
                    {detectedPlatform && (
                      <Text style={styles.detectedPlatform}>Detected: {detectedPlatform}</Text>
                    )}
                    {!detectedPlatform && <View />}
                    <Pressable
                      style={styles.autoFillButton}
                      onPress={handleAutoFill}
                      disabled={isAutoFilling}
                    >
                      {isAutoFilling ? (
                        <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
                          <Text style={styles.autoFillText}>Auto-fill</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            </>
          ) : null}

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

          {/* Note Content — only for note type */}
          {isNote && (
            <View style={styles.field}>
              <Text style={styles.label}>Note Content</Text>
              <TextInput
                style={[styles.input, styles.noteArea]}
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="Write your note here..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Course Lessons Section — only for online_course */}
          {isCourse && (
            <View style={styles.courseSection}>
              <View style={styles.courseSectionHeader}>
                <Text style={styles.label}>Course Lessons</Text>
                <Pressable
                  style={styles.aiButton}
                  onPress={handleAIDecompose}
                  disabled={isDecomposing || !title.trim()}
                >
                  {isDecomposing ? (
                    <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
                      <Text style={styles.aiButtonText}>Extract Lessons</Text>
                    </>
                  )}
                </Pressable>
              </View>
              <Text style={styles.courseHint}>
                {courseModules.length === 0
                  ? 'Add lesson structure manually or extract it from the course info.'
                  : `${courseModules.reduce((n, m) => n + m.lessons.length, 0)} lessons in ${courseModules.length} module${courseModules.length !== 1 ? 's' : ''}`}
              </Text>
              <CourseLessonEditor
                modules={courseModules}
                onChange={setCourseModules}
              />
            </View>
          )}
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
    fontFamily: fontFamily.mono,
    fontWeight: '500',
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
  detectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  detectedPlatform: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
  autoFillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(175,82,222,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  autoFillText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemPurple,
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
  courseSection: {
    gap: IOS_SPACING.xs,
  },
  courseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(175,82,222,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  aiButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemPurple,
  },
  courseHint: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  uploadOrLinkRow: {
    gap: IOS_SPACING.xs,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orText: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
    marginTop: 2,
  },
  uploadedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    padding: IOS_SPACING.sm,
  },
  uploadedFileInfo: {
    flex: 1,
    gap: 1,
  },
  uploadedFileName: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  uploadedFileSize: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  noteArea: {
    minHeight: 150,
  },
});
