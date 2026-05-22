/**
 * Curated MSN-Capstone demo content used as a fallback in ResourcesZone
 * when the signed-in user has zero library_items captured. Lets the
 * canonical screenshots / JHU demo still render on empty accounts
 * without leaking into accounts that have real captures.
 *
 * The ids here intentionally match DEMO_LIBRARY_ITEMS in demoItems.ts so
 * that tapping a card opens the rich inline demo detail screen instead
 * of resolving to a real library_items row that doesn't exist.
 */

import type { CollectionCard, LibraryItemRow } from './types';

export const DEMO_IN_PLAY: LibraryItemRow[] = [
  {
    id: 'aacn-sepsis',
    format: 'pdf',
    source: 'AACN Practice Alert',
    title: 'Severe sepsis & septic shock',
    meta: '8 pages',
    active: true,
  },
  {
    id: 'bates-cardio',
    format: 'video',
    source: "Bates' video series",
    title: 'Cardiovascular exam, bedside',
    meta: '12 min',
    active: true,
  },
  {
    id: 'bates-ch8',
    format: 'book',
    source: "Bates' Guide · 13e",
    title: 'Ch 8 · Cardiovascular system',
    meta: '3 marks',
  },
  {
    id: 'nejm-egdt',
    format: 'link',
    source: 'NEJM · 2001',
    title: 'Early goal-directed therapy in sepsis',
    meta: '5 min read',
  },
  {
    id: 'curbsiders-lactate',
    format: 'audio',
    source: 'Curbsiders #441',
    title: 'Lactate, demystified',
    meta: '54 min',
  },
];

export const DEMO_RECENT: LibraryItemRow[] = [
  {
    id: 'jhh-code-blue',
    format: 'pdf',
    source: '',
    title: 'JHH Code Blue 2025 · pocket card',
    capturedFrom: 'Uploaded',
    capturedAt: '2 hr ago',
    topicTag: 'Sepsis & rapid response',
  },
  {
    id: 'piv-ultrasound',
    format: 'video',
    source: '',
    title: 'Bedside ultrasound for PIV access',
    capturedFrom: 'From YouTube',
    capturedAt: 'Yesterday',
    topicTag: 'Krista Murphy DNP',
  },
  {
    id: 'lactate-clearance',
    format: 'link',
    source: '',
    title: "When lactate doesn't fall: re-examining clearance",
    capturedFrom: 'From Annals of EM',
    capturedAt: 'Sunday',
  },
];

export const DEMO_COLLECTIONS: CollectionCard[] = [
  {
    id: 'sepsis',
    name: 'Sepsis & rapid response',
    itemCount: 12,
    formatStrip: ['pdf', 'link', 'video', 'audio'],
  },
  {
    id: 'cardiac',
    name: 'Cardiac & telemetry',
    itemCount: 18,
    formatStrip: ['book', 'video', 'pdf'],
  },
  {
    id: 'peds',
    name: 'Pediatric vitals & meds',
    itemCount: 9,
    formatStrip: ['pdf', 'link'],
  },
  {
    id: 'pharm',
    name: 'High-alert pharmacology',
    itemCount: 14,
    formatStrip: ['book', 'pdf', 'note'],
  },
];
