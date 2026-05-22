/**
 * Maps the CaptureSheet's onSave payload into a useCreateLibraryItem
 * input. Each capture mode lands a slightly different shape — link mode
 * derives kind from URL pattern, paste mode becomes a 'note', upload/photo
 * remain demo flows until real file pickers ship.
 */

import type { LibraryFormat } from './types';
import type { CreateLibraryItemInput } from '@/hooks/useCreateLibraryItem';

type CaptureMode = 'link' | 'upload' | 'photo' | 'paste';

export interface CaptureSheetPayload {
  mode: CaptureMode;
  attachTo: 'standalone' | 'concept' | 'step';
  tags: string[];
  title?: string;
  url?: string;
  pastedText?: string;
  upload?: {
    publicUrl: string;
    mimeType: string;
    fileName: string;
    sizeBytes: number;
  };
  /** Interest ids selected via the "Relevant for" chip row in CaptureSheet.
   *  Pass-through into library_item_interests so M2M scoping lands at
   *  capture time. */
  interestIds: string[];
}

function deriveKindFromUrl(url: string): LibraryFormat {
  const lower = url.toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(lower)) return 'video';
  if (/\.pdf(\?|$)/.test(lower)) return 'pdf';
  if (/\.(mp3|m4a|wav|aac|ogg)(\?|$)/.test(lower)) return 'audio';
  if (/\.(png|jpe?g|gif|webp|heic)(\?|$)/.test(lower)) return 'image';
  return 'link';
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function titleFromUrl(url: string): string {
  const host = hostnameOf(url);
  if (host) return host;
  return url.slice(0, 80);
}

function titleFromPastedText(text: string): string {
  const firstLine = text.split('\n')[0]?.trim() ?? '';
  if (firstLine.length === 0) return 'Pasted note';
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
}

export function mapCapturePayloadToLibraryItem(
  payload: CaptureSheetPayload,
  interestId: string | undefined,
): CreateLibraryItemInput | null {
  // The chip row defaults to the active interest preselected, so its ids
  // already include `interestId`. Pass them through as extra_interest_ids
  // — useCreateLibraryItem dedupes against the primary interest_id.
  const base = {
    interest_id: interestId ?? null,
    topic_tags: payload.tags,
    extra_interest_ids: payload.interestIds,
  };

  if (payload.mode === 'link') {
    const url = payload.url?.trim();
    if (!url) return null;
    return {
      ...base,
      kind: deriveKindFromUrl(url),
      title: titleFromUrl(url),
      source_label: hostnameOf(url),
      url_or_blob_id: url,
    };
  }

  if (payload.mode === 'paste') {
    const text = payload.pastedText?.trim();
    if (!text) return null;
    return {
      ...base,
      kind: 'note',
      title: titleFromPastedText(text),
      source_label: 'Pasted note',
      url_or_blob_id: text,
    };
  }

  // upload / photo — backed by a real Supabase storage upload now.
  if ((payload.mode === 'upload' || payload.mode === 'photo') && payload.upload) {
    const u = payload.upload;
    return {
      ...base,
      kind: kindFromMime(u.mimeType, payload.mode),
      title: payload.title ?? u.fileName,
      source_label: payload.mode === 'photo' ? 'Photo' : 'Uploaded file',
      url_or_blob_id: u.publicUrl,
    };
  }

  return null;
}

function kindFromMime(mime: string, mode: 'upload' | 'photo'): LibraryFormat {
  if (mode === 'photo') return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'note';
}
