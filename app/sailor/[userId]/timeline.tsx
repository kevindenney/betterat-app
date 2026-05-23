/**
 * Full practice timeline drill-in for a practitioner's public face.
 * Renders every settled-or-named moment in chronological order — same row
 * grammar as the preview on the public face, no medallions.
 */

import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';

import { PublicFaceListShell } from '@/components/sailor/public-face/PublicFaceListShell';
import { TrophyRowPublic } from '@/components/sailor/public-face/PublicFacePrimitives';
import { getPublicFaceEnrichment } from '@/components/sailor/public-face/enrichment';

export default function SailorTimelineRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  if (!userId) return null;
  const enrichment = getPublicFaceEnrichment(userId);
  const items = enrichment.timeline ?? [];
  return (
    <PublicFaceListShell
      firstName={enrichment.firstName ?? 'Back'}
      navContextLabel="Timeline"
      sectionHeader="Practice timeline"
      emptyLabel="No settled moments yet."
    >
      {items.map((t, i) => (
        <TrophyRowPublic
          key={i}
          title={t.title}
          settled={t.settled}
          sub={t.sub}
          when={t.when}
          onPress={
            t.trophyId
              ? () => router.push(`/sailor/${userId}/trophy/${t.trophyId}` as any)
              : undefined
          }
          isFirst={i === 0}
        />
      ))}
    </PublicFaceListShell>
  );
}
