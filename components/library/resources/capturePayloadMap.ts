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
  const base = {
    interest_id: interestId ?? null,
    topic_tags: payload.tags,
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

  // upload / photo — still demo flows. Use the sheet's hardcoded title so
  // the row reads sensibly until a real file picker lands.
  return {
    ...base,
    kind: payload.mode === 'photo' ? 'image' : 'pdf',
    title: payload.title ?? 'Untitled capture',
    source_label: payload.mode === 'photo' ? 'Photo' : 'Uploaded file',
    url_or_blob_id: null,
  };
}
