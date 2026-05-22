/**
 * useStudioBlueprint
 *
 * Data shape for the Creator Studio blueprint editor (Frame 5 of the
 * institutions pass). Currently returns a stub object — the editor renders
 * with empty/draft state until the backing schema is decided.
 *
 * For `id === 'new'` returns a fresh empty draft with sensible defaults.
 *
 * Eventual queries (TODO):
 *   - Fetch from blueprints table by id, joined with cover_image, authors,
 *     pricing_mode, cohort_assignments, capabilities.
 *   - Mutations: title/subtitle/description PATCH, cover swap, access mode,
 *     cohort assignment add/remove, author add/remove.
 */

import { useProfileMenuData } from '@/hooks/useProfileMenuData';

export type BlueprintAccessMode = 'institutional' | 'independent';
export type BlueprintStatus = 'draft' | 'in_review' | 'live' | 'archived';

export interface BlueprintAuthor {
  user_id: string;
  display_name: string;
  initials: string;
  gradient: [string, string];
  is_primary: boolean;
}

export interface BlueprintCohort {
  id: string;
  name: string;          // "Spring '26 · MSN second-years"
  state: 'pending' | 'open' | 'closed';
  opensAtLabel: string | null;
  enrolledCount: number;
  capacity: number;
}

export interface StudioBlueprintDraft {
  id: string;
  isNew: boolean;
  title: string;
  subtitle: string;
  description: string;
  status: BlueprintStatus;
  version: string;                 // "v0.4"
  lastSavedLabel: string;          // "2 minutes ago · autosaved"
  durationLabel: string;           // "14 weeks"
  skillLevel: 'introductory' | 'intermediate' | 'advanced';
  estimatedSteps: number;          // 30
  stepsWritten: number;            // 6
  coverGradient: [string, string]; // [from, to]
  coverImageUrl: string | null;
  orgShort: string | null;         // "JH" badge on cover
  orgName: string | null;          // "Hopkins · MSN"
  accessMode: BlueprintAccessMode;
  pricePerMonth: number | null;    // null in institutional mode
  authors: BlueprintAuthor[];
  cohorts: BlueprintCohort[];
  coAuthorInvited: string | null;  // "Dr. A. Patel" header chip
}

export interface UseStudioBlueprintResult {
  loading: boolean;
  blueprint: StudioBlueprintDraft;
  isInstitutional: boolean;
}

const DEFAULT_GRADIENTS: [string, string][] = [
  ['#B85A66', '#7A6A8E'],
  ['#5A8DB8', '#28406B'],
  ['#6E8B5A', '#5A8B8B'],
  ['#8B6E5A', '#7A6A8E'],
  ['#7A6A8E', '#5A8B8B'],
];

export function useStudioBlueprint(id: string): UseStudioBlueprintResult {
  const menu = useProfileMenuData();
  const activeOrg = menu.activeOrg;

  // While stubbed, return an empty draft. `id === 'new'` and `id === any-uuid`
  // both produce a placeholder shaped like the design's Pediatric Acute Care
  // draft so the editor renders cleanly.
  const isNew = id === 'new';
  const isInstitutional = !!activeOrg;

  const blueprint: StudioBlueprintDraft = {
    id: isNew ? 'new' : id,
    isNew,
    title: isNew ? 'Untitled blueprint' : 'Untitled blueprint',
    subtitle: '',
    description: '',
    status: 'draft',
    version: 'v0.1',
    lastSavedLabel: isNew ? 'Not yet saved' : 'Just now · autosaved',
    durationLabel: '',
    skillLevel: 'intermediate',
    estimatedSteps: 30,
    stepsWritten: 0,
    coverGradient: DEFAULT_GRADIENTS[0],
    coverImageUrl: null,
    orgShort: activeOrg?.org_short_name ?? null,
    orgName: activeOrg?.org_name ?? null,
    accessMode: isInstitutional ? 'institutional' : 'independent',
    pricePerMonth: isInstitutional ? null : 9,
    authors: [
      // Placeholder author = current user; replaced by real authorship join.
      {
        user_id: 'self',
        display_name: 'You',
        initials: 'KM',
        gradient: ['#B85A66', '#7A6A8E'],
        is_primary: true,
      },
    ],
    cohorts: [],
    coAuthorInvited: null,
  };

  return {
    loading: menu.loading,
    blueprint,
    isInstitutional,
  };
}

export const COVER_GRADIENT_OPTIONS = DEFAULT_GRADIENTS;
