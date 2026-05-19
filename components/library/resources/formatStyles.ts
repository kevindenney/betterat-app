import type { LibraryFormat } from './types';
import { Ionicons } from '@expo/vector-icons';

export const FORMAT_LABEL: Record<LibraryFormat, string> = {
  pdf: 'PDF',
  video: 'VIDEO',
  book: 'BOOK',
  link: 'LINK',
  audio: 'AUDIO',
  article: 'ARTICLE',
  note: 'NOTE',
  image: 'IMAGE',
};

export const FORMAT_TINT: Record<LibraryFormat, string> = {
  pdf: '#FF3B30',
  video: '#FF2D55',
  book: '#AF52DE',
  link: '#5AC8FA',
  audio: '#FF9500',
  article: '#1E63D6',
  note: '#34C759',
  image: '#FFCC00',
};

export const FORMAT_ICON: Record<LibraryFormat, keyof typeof Ionicons.glyphMap> = {
  pdf: 'document-text-outline',
  video: 'play-circle-outline',
  book: 'book-outline',
  link: 'link-outline',
  audio: 'headset-outline',
  article: 'newspaper-outline',
  note: 'create-outline',
  image: 'image-outline',
};
