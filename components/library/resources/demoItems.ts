/**
 * Inline demo data for the Wave 2e MSN-Capstone library cards rendered by
 * ResourcesZone. These ids (aacn-sepsis, jhh-code-blue, …) are static demo
 * content — not rows in library_items — so the detail route would otherwise
 * resolve "not found" when tapped. Used by useLibraryItemDetail as a
 * short-circuit before hitting Supabase.
 */

import type { ResourceItemFull } from './types';

export const DEMO_LIBRARY_ITEMS: Record<string, ResourceItemFull> = {
  'aacn-sepsis': {
    id: 'aacn-sepsis',
    format: 'pdf',
    formatLabel: 'PDF',
    meta: '8 pages · 2024',
    title: 'Severe sepsis & septic shock',
    sourceLine: 'AACN Practice Alert · Added Oct 14',
    backRefs: [
      {
        id: 'origin-lactate-perfusion',
        role: 'origin',
        title: 'Lactate as a perfusion marker',
        subtitle: 'Concept · "lactate ≥4 mmol/L signals shock" seeded this',
      },
      {
        id: 'cited-qsofa',
        role: 'cited',
        title: 'qSOFA at the bedside',
        subtitle: 'Concept · references this',
      },
      {
        id: 'in_step-medsurg-tue',
        role: 'in_step',
        title: 'Med-Surg shift · Tuesday',
        subtitle: 'Read Mon · before-shift checklist',
      },
    ],
    marks: [
      {
        id: 'mark-1',
        quote:
          'Initiate broad-spectrum antibiotics within 1 hour of recognition of severe sepsis or septic shock.',
        prov: 'p3 · highlighted Mon',
      },
      {
        id: 'mark-2',
        quote:
          'Lactate clearance of ≥10% over 2 hours is associated with improved survival.',
        prov: 'p5 · highlighted Tue',
      },
    ],
  },
  'bates-cardio': {
    id: 'bates-cardio',
    format: 'video',
    formatLabel: 'Video',
    meta: '12 min · 2023',
    title: 'Cardiovascular exam, bedside',
    sourceLine: "Bates' video series · Added last week",
    backRefs: [
      {
        id: 'origin-auscultation-order',
        role: 'origin',
        title: 'Auscultation order (aortic → mitral)',
        subtitle: 'Concept · seeded by this item',
      },
      {
        id: 'in_step-clinical-thu',
        role: 'in_step',
        title: 'Clinical · Thursday',
        subtitle: 'Included as read before shift',
      },
    ],
    marks: [],
  },
  'bates-ch8': {
    id: 'bates-ch8',
    format: 'book',
    formatLabel: 'Book',
    meta: '3 marks',
    title: 'Ch 8 · Cardiovascular system',
    sourceLine: "Bates' Guide · 13e · Added Sep 28",
    backRefs: [
      {
        id: 'cited-pmi-location',
        role: 'cited',
        title: 'Point of maximal impulse',
        subtitle: 'Concept · references this',
      },
    ],
    marks: [
      {
        id: 'mark-1',
        quote:
          'The PMI is normally located in the 5th intercostal space, just medial to the midclavicular line.',
        prov: 'p217 · highlighted Sep 30',
      },
    ],
  },
  'nejm-egdt': {
    id: 'nejm-egdt',
    format: 'link',
    formatLabel: 'Link',
    meta: '5 min read · 2001',
    title: 'Early goal-directed therapy in sepsis',
    sourceLine: 'NEJM · Added Oct 12',
    backRefs: [
      {
        id: 'origin-egdt',
        role: 'origin',
        title: 'EGDT bundle',
        subtitle: 'Concept · seeded by this item',
      },
    ],
    marks: [],
  },
  'curbsiders-lactate': {
    id: 'curbsiders-lactate',
    format: 'audio',
    formatLabel: 'Audio',
    meta: '54 min',
    title: 'Lactate, demystified',
    sourceLine: 'Curbsiders #441 · Added Oct 10',
    backRefs: [],
    marks: [],
  },
  'jhh-code-blue': {
    id: 'jhh-code-blue',
    format: 'pdf',
    formatLabel: 'PDF',
    meta: '4 pages',
    title: 'JHH Code Blue 2025 · pocket card',
    sourceLine: 'Uploaded · Added 2 hr ago',
    backRefs: [
      {
        id: 'in_step-medsurg-tue-cb',
        role: 'in_step',
        title: 'Med-Surg shift · Tuesday',
        subtitle: 'Included as read before shift',
      },
    ],
    marks: [],
  },
  'piv-ultrasound': {
    id: 'piv-ultrasound',
    format: 'video',
    formatLabel: 'Video',
    meta: '8 min',
    title: 'Bedside ultrasound for PIV access',
    sourceLine: 'From YouTube · Krista Murphy DNP · Added yesterday',
    backRefs: [],
    marks: [],
  },
  'lactate-clearance': {
    id: 'lactate-clearance',
    format: 'link',
    formatLabel: 'Link',
    meta: '6 min read',
    title: "When lactate doesn't fall: re-examining clearance",
    sourceLine: 'From Annals of EM · Added Sunday',
    backRefs: [
      {
        id: 'cited-lactate-clearance',
        role: 'cited',
        title: 'Lactate clearance',
        subtitle: 'Concept · references this',
      },
    ],
    marks: [],
  },
};
