/**
 * Full published feed — reflections + threads in one section. Newest first.
 * Row type carries the difference: reflections are italic-serif quotes,
 * threads are drow-style with chatbubble glyph.
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { PublicFaceListShell } from '@/components/sailor/public-face/PublicFaceListShell';
import {
  PublishedReflectionRow,
  PublishedThreadRow,
} from '@/components/sailor/public-face/PublicFacePrimitives';
import { getPublicFaceEnrichment } from '@/components/sailor/public-face/enrichment';

export default function SailorPublishedRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  if (!userId) return null;
  const enrichment = getPublicFaceEnrichment(userId);
  const items = enrichment.published ?? [];
  return (
    <PublicFaceListShell
      firstName={enrichment.firstName ?? 'Back'}
      navContextLabel="Published"
      sectionHeader="Published"
      emptyLabel="Nothing published yet."
    >
      {items.map((p, i) =>
        p.kind === 'reflection' ? (
          <PublishedReflectionRow
            key={i}
            text={p.text}
            provenance={p.provenance}
            isFirst={i === 0}
          />
        ) : (
          <PublishedThreadRow
            key={i}
            title={p.title}
            topic={p.topic}
            replies={p.replies}
            when={p.when}
            isFirst={i === 0}
          />
        ),
      )}
    </PublicFaceListShell>
  );
}
