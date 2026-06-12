/**
 * AvatarStorageService — the one way to turn a local picker URI into a
 * hosted avatar URL.
 *
 * RN's fetch(file://).blob() chain silently produces ZERO-BYTE uploads on
 * native, which is how device-local file:// paths ended up persisted in
 * users.avatar_url (blank-circle bug). Native must read the file as base64
 * and upload an ArrayBuffer; only web can use fetch().blob().
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/services/supabase';

const BUCKET = 'avatars';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export class AvatarStorageService {
  /**
   * Uploads a local image (file://, blob:, data:, ph://) to the public
   * `avatars` bucket under the caller's per-user folder (required by the
   * bucket's INSERT RLS) and returns a cache-busted https public URL —
   * the only kind of value that should ever reach users.avatar_url.
   */
  static async uploadAvatar(userId: string, localUri: string): Promise<string> {
    const ext = (localUri.split(/[#?]/)[0].split('.').pop() ?? '').toLowerCase();
    const safeExt = ext in CONTENT_TYPES ? ext : 'jpg';
    const contentType = CONTENT_TYPES[safeExt];
    const path = `${userId}/avatar-${Date.now()}.${safeExt}`;

    let body: Blob | ArrayBuffer;
    if (Platform.OS === 'web') {
      const response = await fetch(localUri);
      if (!response.ok) {
        throw new Error(`Failed to read image: ${response.status}`);
      }
      body = await response.blob();
      if (body.size === 0) throw new Error('Selected image is empty.');
    } else {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      body = base64ToArrayBuffer(base64);
      if (body.byteLength === 0) throw new Error('Selected image is empty.');
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: true });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }
}
