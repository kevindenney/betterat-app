/**
 * oEmbed lookup for link captures — fetches title + thumbnail from
 * YouTube / Vimeo so a library item carries a real title and preview
 * image instead of just the URL hostname.
 *
 * All providers return JSON shaped like:
 *   { title, author_name, thumbnail_url, ... }
 * Errors fail silent — caller falls back to hostname-only title.
 */

interface OEmbedResult {
  title?: string;
  thumbnailUrl?: string;
  authorName?: string;
}

const TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function oembedEndpoint(url: string): string | null {
  const lower = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(lower)) {
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  }
  if (/vimeo\.com/.test(lower)) {
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
  }
  return null;
}

export async function fetchOEmbedMetadata(
  url: string,
): Promise<OEmbedResult | null> {
  const endpoint = oembedEndpoint(url);
  if (!endpoint) return null;
  try {
    const res = await withTimeout(fetch(endpoint), TIMEOUT_MS);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: json.title,
      authorName: json.author_name,
      thumbnailUrl: json.thumbnail_url,
    };
  } catch {
    return null;
  }
}
