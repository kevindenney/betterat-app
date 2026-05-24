/**
 * WebMeta — web-only document.title + OG/Twitter meta injection.
 *
 * Mounts as a no-op on native. On web, sets the title and a small set
 * of OG + Twitter tags so shared marketplace URLs unfurl with title,
 * author/description, price. Tags are tagged with data-betterat="meta"
 * so we can clean them up on unmount and avoid leaving stale rows
 * when navigating between marketplace surfaces.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';

export interface WebMetaProps {
  title: string;
  description?: string | null;
  ogType?: string; // "website" | "product" | "article" — default "website"
  url?: string;
  imageUrl?: string;
  priceAmount?: number; // dollars
  priceCurrency?: string; // 'USD'
}

function setMeta(name: string, value: string, attr: 'name' | 'property' = 'name') {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(
    `meta[${attr}="${name}"][data-betterat="meta"]`,
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    el.setAttribute('data-betterat', 'meta');
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

export function WebMeta(props: WebMetaProps) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const prevTitle = document.title;
    document.title = props.title;

    setMeta('og:title', props.title, 'property');
    setMeta('og:site_name', 'BetterAt', 'property');
    setMeta('og:type', props.ogType ?? 'website', 'property');
    if (props.url) setMeta('og:url', props.url, 'property');
    if (props.description) {
      const desc = props.description.slice(0, 200);
      setMeta('description', desc);
      setMeta('og:description', desc, 'property');
      setMeta('twitter:description', desc);
    }
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', props.title);
    if (props.imageUrl) {
      setMeta('og:image', props.imageUrl, 'property');
      setMeta('twitter:image', props.imageUrl);
    }
    if (props.priceAmount != null && props.priceCurrency) {
      setMeta('product:price:amount', props.priceAmount.toFixed(2), 'property');
      setMeta('product:price:currency', props.priceCurrency, 'property');
    }

    return () => {
      document.title = prevTitle;
      // Remove only our tags so subsequent mounts get a clean slate.
      document
        .querySelectorAll('meta[data-betterat="meta"]')
        .forEach((el) => el.parentNode?.removeChild(el));
    };
  }, [
    props.title,
    props.description,
    props.ogType,
    props.url,
    props.imageUrl,
    props.priceAmount,
    props.priceCurrency,
  ]);

  return null;
}
