/**
 * ResourceTypeIcon — maps resource_type to an Ionicon name + color.
 */

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ResourceType } from '@/types/library';

const TYPE_CONFIG: Record<ResourceType, { icon: string; color: string }> = {
  online_course: { icon: 'school-outline', color: '#5856D6' },
  youtube_channel: { icon: 'logo-youtube', color: '#FF0000' },
  youtube_video: { icon: 'play-circle-outline', color: '#FF0000' },
  website: { icon: 'globe-outline', color: '#007AFF' },
  book_digital: { icon: 'tablet-portrait-outline', color: '#FF9500' },
  book_physical: { icon: 'book-outline', color: '#A2845E' },
  social_media: { icon: 'share-social-outline', color: '#FF2D55' },
  cloud_folder: { icon: 'cloud-outline', color: '#5AC8FA' },
  pdf: { icon: 'document-text-outline', color: '#E34234' },
  image: { icon: 'image-outline', color: '#34C759' },
  document: { icon: 'document-outline', color: '#5856D6' },
  note: { icon: 'create-outline', color: '#FF9500' },
  other: { icon: 'link-outline', color: '#8E8E93' },
};

interface ResourceTypeIconProps {
  type: ResourceType;
  size?: number;
}

export function ResourceTypeIcon({ type, size = 20 }: ResourceTypeIconProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.other;
  return (
    <Ionicons name={config.icon as any} size={size} color={config.color} />
  );
}

export function getResourceTypeLabel(type: ResourceType): string {
  const labels: Record<ResourceType, string> = {
    online_course: 'Online Course',
    youtube_channel: 'YouTube Channel',
    youtube_video: 'YouTube Video',
    website: 'Website',
    book_digital: 'Digital Book',
    book_physical: 'Physical Book',
    social_media: 'Social Media',
    cloud_folder: 'Cloud Folder',
    pdf: 'PDF',
    image: 'Image',
    document: 'Document',
    note: 'Note',
    other: 'Other',
  };
  return labels[type] ?? 'Other';
}
