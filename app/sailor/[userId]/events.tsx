/**
 * Full events list — race log for sailing, generalises to rotation log /
 * milestone ledger for other verticals. Plain-text result column, no medal
 * glyphs, no podium icons.
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { PublicFaceListShell } from '@/components/sailor/public-face/PublicFaceListShell';
import { EventRow } from '@/components/sailor/public-face/PublicFacePrimitives';
import { getPublicFaceEnrichment } from '@/components/sailor/public-face/enrichment';

export default function SailorEventsRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  if (!userId) return null;
  const enrichment = getPublicFaceEnrichment(userId);
  const items = enrichment.events ?? [];
  return (
    <PublicFaceListShell
      firstName={enrichment.firstName ?? 'Back'}
      navContextLabel="Events"
      sectionHeader="Events"
      emptyLabel="No events logged yet."
    >
      {items.map((e, i) => (
        <EventRow
          key={i}
          dateTop={e.dateTop}
          dateBottom={e.dateBottom}
          name={e.name}
          venue={e.venue}
          resultTop={e.resultTop}
          resultBottom={e.resultBottom}
          isFirst={i === 0}
        />
      ))}
    </PublicFaceListShell>
  );
}
