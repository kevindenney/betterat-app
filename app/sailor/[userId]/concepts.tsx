/**
 * Concept history drill-in — "where the current concept came from".
 *
 * Per the brief, concept history is an *affordance* on the working-on-now
 * card, not a parallel section on the public face. This route is what the
 * "Followed: …" link opens — the chronology of past concepts the
 * practitioner has worked through, newest first.
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { PublicFaceListShell } from '@/components/sailor/public-face/PublicFaceListShell';
import { TrophyRowPublic } from '@/components/sailor/public-face/PublicFacePrimitives';
import { getPublicFaceEnrichment } from '@/components/sailor/public-face/enrichment';

export default function SailorConceptsRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  if (!userId) return null;
  const enrichment = getPublicFaceEnrichment(userId);
  const items = enrichment.conceptHistory ?? [];
  return (
    <PublicFaceListShell
      firstName={enrichment.firstName ?? 'Back'}
      navContextLabel="Concept history"
      sectionHeader="Past concepts"
      emptyLabel="No past concepts yet."
    >
      {items.map((c, i) => (
        <TrophyRowPublic
          key={i}
          title={c.title}
          settled
          sub={
            c.capability
              ? `${c.capability}${c.text ? ` · ${c.text}` : ''}`
              : c.text ?? ''
          }
          when={c.closed.replace(/^Closed /, '')}
          isFirst={i === 0}
        />
      ))}
    </PublicFaceListShell>
  );
}
