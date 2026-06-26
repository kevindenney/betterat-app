/**
 * LibraryUploadService — handles file picking and uploading for library resources.
 * Files are stored in the 'library-files' Supabase Storage bucket.
 */

import { supabase } from '@/services/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { createLogger } from '@/lib/utils/logger';
import { filenameToTitle } from '@/lib/utils/filenameToTitle';
import type { ResourceType, FileUploadMetadata } from '@/types/library';

const logger = createLogger('LibraryUploadService');

const BUCKET = 'library-files';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export interface PickedFile {
  name: string;
  uri: string;
  mimeType: string;
  size: number;
}

export interface UploadedFile {
  metadata: FileUploadMetadata;
  suggestedTitle: string;
  suggestedType: ResourceType;
}

/** MIME type → resource type mapping */
function mimeToResourceType(mime: string): ResourceType {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (
    mime.includes('word') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    mime === 'text/plain'
  ) return 'document';
  return 'other';
}

/**
 * Open the document picker and return the selected file.
 */
export async function pickFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'image/*',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
  }

  return {
    name: asset.name,
    uri: asset.uri,
    mimeType: asset.mimeType || 'application/octet-stream',
    size: asset.size || 0,
  };
}

/**
 * Open the image picker (camera roll) and return a PickedFile.
 *
 * Camera mode (taking a new photo) is a separate launch — keeping this
 * helper to library-only matches CaptureSheet's "Snap a textbook page"
 * affordance which we wire to either path the user prefers.
 */
export async function pickImage(opts?: { fromCamera?: boolean }): Promise<PickedFile | null> {
  const fromCamera = !!opts?.fromCamera;
  const perm = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = fromCamera
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
    throw new Error(`Image exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
  }

  const inferredName = asset.fileName ?? `photo-${Date.now()}.jpg`;
  return {
    name: inferredName,
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? 0,
  };
}

/**
 * Upload a picked file to Supabase Storage and return metadata.
 */
export async function uploadFile(userId: string, file: PickedFile): Promise<UploadedFile> {
  const storagePath = `${userId}/${Date.now()}_${file.name}`;

  let fileData: Blob | string;
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    fileData = await response.blob();
  } else {
    fileData = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileData, {
      contentType: file.mimeType,
      upsert: false,
    });

  if (uploadError) {
    logger.error('Upload failed', uploadError);
    throw new Error(uploadError.message);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const metadata: FileUploadMetadata = {
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.mimeType,
    file_size: file.size,
    public_url: urlData?.publicUrl,
  };

  return {
    metadata,
    suggestedTitle: filenameToTitle(file.name),
    suggestedType: mimeToResourceType(file.mimeType),
  };
}

/**
 * Delete an uploaded file from Supabase Storage.
 */
export async function deleteUploadedFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    logger.error('Delete failed', error);
    throw new Error(error.message);
  }
}
