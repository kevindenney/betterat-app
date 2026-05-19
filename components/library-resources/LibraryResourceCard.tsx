/**
 * LibraryResourceCard — displays a single library resource.
 * For online_course resources with course_structure, shows a progress bar
 * and "Add to Timeline" action.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { ResourceTypeIcon, getResourceTypeLabel } from './ResourceTypeIcon';
import { getCourseMetadata, getCourseCompletionPercent, getFileMetadata, formatFileSize } from '@/types/library';
import type { LibraryResourceRecord } from '@/types/library';

interface LibraryResourceCardProps {
  resource: LibraryResourceRecord;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddToTimeline?: () => void;
}

export function LibraryResourceCard({ resource, onEdit, onDelete, onAddToTimeline }: LibraryResourceCardProps) {
  const isCourse = resource.resource_type === 'online_course';
  const { course_structure, progress } = getCourseMetadata(resource);
  const hasCourseStructure = isCourse && course_structure && course_structure.total_lessons > 0;
  const completionPercent = hasCourseStructure ? getCourseCompletionPercent(resource) : 0;
  const completedCount = progress?.completed_lesson_ids?.length ?? 0;
  const totalLessons = course_structure?.total_lessons ?? 0;
  const fileMeta = getFileMetadata(resource);
  const isNote = resource.resource_type === 'note';

  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        if (fileMeta?.public_url) {
          Linking.openURL(fileMeta.public_url);
        } else if (resource.url) {
          Linking.openURL(resource.url);
        }
      }}
    >
      <View style={styles.iconWrapper}>
        <ResourceTypeIcon type={resource.resource_type} size={24} />
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{resource.title}</Text>
        {resource.author_or_creator && (
          <Text style={styles.author} numberOfLines={1}>{resource.author_or_creator}</Text>
        )}
        <View style={styles.meta}>
          <Text style={styles.typeBadge}>{getResourceTypeLabel(resource.resource_type)}</Text>
          {resource.source_platform && (
            <Text style={styles.platform}>{resource.source_platform}</Text>
          )}
          {fileMeta && (
            <Text style={styles.platform}>{formatFileSize(fileMeta.file_size)}</Text>
          )}
        </View>
        {isNote && (resource.metadata as any)?.note_content && (
          <Text style={styles.notePreview} numberOfLines={2}>
            {(resource.metadata as any).note_content}
          </Text>
        )}

        {/* Course progress bar */}
        {hasCourseStructure && (
          <View style={styles.progressSection}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${completionPercent}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {completedCount}/{totalLessons} lessons
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {hasCourseStructure && onAddToTimeline && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onAddToTimeline();
            }}
            hitSlop={8}
            style={styles.actionButton}
          >
            <Ionicons name="calendar-outline" size={18} color={IOS_COLORS.systemBlue} />
          </Pressable>
        )}
        {onEdit && (
          <Pressable onPress={onEdit} hitSlop={8} style={styles.actionButton}>
            <Ionicons name="pencil-outline" size={18} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        )}
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={8} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={18} color={IOS_COLORS.systemRed} />
          </Pressable>
        )}
        {fileMeta?.public_url ? (
          <Ionicons name="download-outline" size={16} color={IOS_COLORS.tertiaryLabel} />
        ) : resource.url ? (
          <Ionicons name="open-outline" size={16} color={IOS_COLORS.tertiaryLabel} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  author: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    marginTop: 2,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
    backgroundColor: 'rgba(0,122,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  platform: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  notePreview: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 16,
    marginTop: 2,
  },
  progressSection: {
    marginTop: 4,
    gap: 3,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: IOS_COLORS.systemGreen,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  actionButton: {
    padding: 4,
  },
});
