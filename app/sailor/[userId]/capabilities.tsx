/**
 * Full capabilities-at-hand list. Same CapabilityRow grammar as the public
 * face — name + status pill + italic-serif evidence quote + provenance.
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { PublicFaceListShell } from '@/components/sailor/public-face/PublicFaceListShell';
import { CapabilityRow } from '@/components/sailor/public-face/PublicFacePrimitives';
import { getPublicFaceEnrichment } from '@/components/sailor/public-face/enrichment';

export default function SailorCapabilitiesRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  if (!userId) return null;
  const enrichment = getPublicFaceEnrichment(userId);
  const items = enrichment.capabilities ?? [];
  return (
    <PublicFaceListShell
      firstName={enrichment.firstName ?? 'Back'}
      navContextLabel="Capabilities"
      sectionHeader="Capabilities at hand"
      emptyLabel="No capabilities surfaced yet."
    >
      {items.map((c, i) => (
        <CapabilityRow
          key={i}
          name={c.name}
          status={c.status}
          evidence={c.evidence}
          provenance={c.provenance}
          isFirst={i === 0}
        />
      ))}
    </PublicFaceListShell>
  );
}
