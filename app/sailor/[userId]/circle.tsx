/**
 * Full practice circle — the curated list of people who inform this
 * practitioner's practice. Coaches, crew, faculty, peers.
 */

import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';

import { PublicFaceListShell } from '@/components/sailor/public-face/PublicFaceListShell';
import { PracticeCircleRow } from '@/components/sailor/public-face/PublicFacePrimitives';
import { getPublicFaceEnrichment } from '@/components/sailor/public-face/enrichment';

export default function SailorCircleRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  if (!userId) return null;
  const enrichment = getPublicFaceEnrichment(userId);
  const items = enrichment.circle ?? [];
  return (
    <PublicFaceListShell
      firstName={enrichment.firstName ?? 'Back'}
      navContextLabel="Practice circle"
      sectionHeader="Practice circle"
      emptyLabel="No practice circle yet."
    >
      {items.map((p, i) => (
        <PracticeCircleRow
          key={i}
          name={p.name}
          role={p.role}
          initials={p.initials}
          markColor={p.markColor}
          tail={p.tail}
          onPress={
            p.userId ? () => router.push(`/sailor/${p.userId}` as any) : undefined
          }
          isFirst={i === 0}
        />
      ))}
    </PublicFaceListShell>
  );
}
