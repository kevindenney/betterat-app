/**
 * /library/items/[id] — Resource item detail (Emily Phone 2).
 * Renders the AACN Practice Alert demo regardless of [id] in Wave 2e.
 * Real DB read lands once library_items is seeded.
 */

import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ResourceItemDetail } from '@/components/library/resources/ResourceItemDetail';
import type { ResourceItemFull } from '@/components/library/resources/types';

const AACN_SEPSIS: ResourceItemFull = {
  id: 'aacn-sepsis',
  format: 'pdf',
  formatLabel: 'PDF',
  meta: '8 pages · 2025',
  title: 'AACN Practice Alert · Severe Sepsis and Septic Shock',
  sourceLine: 'American Association of Critical-Care Nurses · Added Sep 4, 2026',
  backRefs: [
    {
      id: 'br1',
      role: 'origin',
      title: 'Catch perfusion change before it becomes a code.',
      subtitle: 'Concept · "Identification of sepsis within one hour" seeded this',
    },
    {
      id: 'br2',
      role: 'cited',
      title: 'Lactate window — when to push, when to wait.',
      subtitle: 'Concept · referenced in 2 reflections',
    },
    {
      id: 'br3',
      role: 'in_step',
      title: 'Shift 5 · Med-Surg, Oct 15',
      subtitle: 'Pre-Clinical · included as read before shift',
    },
  ],
  marks: [
    {
      id: 'm1',
      quote:
        'Identification of sepsis within one hour of presentation reduces mortality by an estimated 7.6% per hour delay.',
      prov: 'Page 2 · marked Sep 14',
    },
    {
      id: 'm2',
      quote:
        'Lactate clearance of more than 10% within 2–4 hours is associated with improved outcomes.',
      prov: 'Page 4 · marked Sep 22',
    },
  ],
};

export default function ResourceItemScreen() {
  useLocalSearchParams<{ id?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ResourceItemDetail item={AACN_SEPSIS} />
    </>
  );
}
