/**
 * useStudioBlueprint
 *
 * Data layer for the Creator Studio blueprint editor (Frame 5+). Loads the
 * blueprint by id from public.blueprints, joins blueprint_cohorts for
 * cohort context, counts step templates for stepsWritten, and resolves
 * org name/short via organization_memberships.
 *
 * For `id === 'new'` returns a fresh empty draft tied to the user's
 * currently-active org so the cover renders the right shield.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { useAuth } from '@/providers/AuthProvider';

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
  name: string;
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
  version: string;
  lastSavedLabel: string;
  durationLabel: string;
  skillLevel: 'introductory' | 'intermediate' | 'advanced';
  estimatedSteps: number;
  stepsWritten: number;
  coverGradient: [string, string];
  coverImageUrl: string | null;
  orgId: string | null;
  orgShort: string | null;
  orgName: string | null;
  accessMode: BlueprintAccessMode;
  pricePerMonth: number | null;
  authors: BlueprintAuthor[];
  cohorts: BlueprintCohort[];
  coAuthorInvited: string | null;
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

function gradientForSeed(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DEFAULT_GRADIENTS[h % DEFAULT_GRADIENTS.length];
}

function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '··';
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}

function relativeLabel(iso: string | null): string {
  if (!iso) return 'Not yet saved';
  const d = new Date(iso);
  const seconds = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'Just now · autosaved';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m ago · autosaved`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago · autosaved`;
  const days = hours / 24;
  if (days < 14) return `${Math.round(days)}d ago · autosaved`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · autosaved';
}

function shortNameFor(orgName: string): string {
  if (!orgName) return '·';
  const tokens = orgName.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '·';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

function statusFromRow(status: string): BlueprintStatus {
  switch (status) {
    case 'live':
      return 'live';
    case 'review':
      return 'in_review';
    case 'archived':
      return 'archived';
    default:
      return 'draft';
  }
}

interface BlueprintRow {
  id: string;
  org_id: string;
  author_user_id: string | null;
  title: string;
  slug: string;
  category: string;
  version: string;
  status: string;
  description: string | null;
  last_edited_at: string;
  published_at: string | null;
}

interface CohortAssignmentRow {
  cohort_id: string;
  cohort: {
    id: string;
    name: string;
    status: string | null;
    max_seats: number | null;
    start_date: string | null;
  };
}

interface OrgRow {
  id: string;
  name: string;
}

interface AuthorRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function useStudioBlueprint(id: string): UseStudioBlueprintResult {
  const menu = useProfileMenuData();
  const { user } = useAuth();
  const activeOrg = menu.activeOrg;
  const isNew = id === 'new';

  const { data, isLoading } = useQuery({
    queryKey: ['studio-blueprint', id],
    enabled: !isNew && !!id,
    staleTime: 30_000,
    queryFn: async (): Promise<{
      bp: BlueprintRow | null;
      org: OrgRow | null;
      author: AuthorRow | null;
      cohorts: CohortAssignmentRow[];
      stepsWritten: number;
    }> => {
      const { data: bp, error } = await supabase
        .from('blueprints')
        .select(
          'id, org_id, author_user_id, title, slug, category, version, status, description, last_edited_at, published_at',
        )
        .eq('id', id)
        .maybeSingle();
      if (error || !bp) {
        if (error) console.warn('[useStudioBlueprint] query failed', error);
        return { bp: null, org: null, author: null, cohorts: [], stepsWritten: 0 };
      }
      const row = bp as BlueprintRow;

      const [orgRes, authorRes, cohortsRes, stepsRes] = await Promise.all([
        supabase.from('organizations').select('id, name').eq('id', row.org_id).maybeSingle(),
        row.author_user_id
          ? supabase
              .from('users')
              .select('id, full_name, email')
              .eq('id', row.author_user_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
        supabase
          .from('blueprint_cohorts')
          .select('cohort_id, cohort:betterat_org_cohorts(id, name, status, max_seats, start_date)')
          .eq('blueprint_id', id),
        supabase
          .from('blueprint_step_templates')
          .select('id', { count: 'exact', head: true })
          .eq('blueprint_id', id),
      ]);

      const cohorts = ((cohortsRes.data ?? []) as unknown as CohortAssignmentRow[]).filter(
        (c) => c.cohort,
      );

      return {
        bp: row,
        org: (orgRes.data ?? null) as OrgRow | null,
        author: (authorRes.data ?? null) as AuthorRow | null,
        cohorts,
        stepsWritten: stepsRes.count ?? 0,
      };
    },
  });

  // Empty draft for `new` route — tied to the user's currently-active org
  if (isNew) {
    const orgName = activeOrg?.org_name ?? null;
    return {
      loading: menu.loading,
      isInstitutional: !!activeOrg,
      blueprint: {
        id: 'new',
        isNew: true,
        title: 'Untitled blueprint',
        subtitle: '',
        description: '',
        status: 'draft',
        version: 'v0.1',
        lastSavedLabel: 'Not yet saved',
        durationLabel: '',
        skillLevel: 'intermediate',
        estimatedSteps: 30,
        stepsWritten: 0,
        coverGradient: DEFAULT_GRADIENTS[0],
        coverImageUrl: null,
        orgId: activeOrg?.org_id ?? null,
        orgShort: activeOrg?.org_short_name ?? null,
        orgName,
        accessMode: activeOrg ? 'institutional' : 'independent',
        pricePerMonth: activeOrg ? null : 9,
        authors: [
          {
            user_id: user?.id ?? 'self',
            display_name: 'You',
            initials: initialsFor(user?.email ?? 'You'),
            gradient: gradientForSeed(user?.id ?? 'self'),
            is_primary: true,
          },
        ],
        cohorts: [],
        coAuthorInvited: null,
      },
    };
  }

  // Real-row path
  const bp = data?.bp ?? null;
  const org = data?.org ?? null;
  const author = data?.author ?? null;
  const isInstitutional = !!org;

  const authorName = author
    ? (author.full_name?.trim() || author.email || 'Author')
    : 'Unknown author';
  const authorInitials = initialsFor(authorName);

  const blueprint: StudioBlueprintDraft = {
    id: id,
    isNew: false,
    title: bp?.title ?? 'Untitled blueprint',
    subtitle: '',
    description: bp?.description ?? '',
    status: statusFromRow(bp?.status ?? 'draft'),
    version: bp?.version ?? 'v0.1',
    lastSavedLabel: relativeLabel(bp?.last_edited_at ?? null),
    durationLabel: '',
    skillLevel: 'intermediate',
    estimatedSteps: 30,
    stepsWritten: data?.stepsWritten ?? 0,
    coverGradient: gradientForSeed(bp?.id ?? id),
    coverImageUrl: null,
    orgId: bp?.org_id ?? null,
    orgShort: org?.name ? shortNameFor(org.name) : null,
    orgName: org?.name ?? null,
    accessMode: isInstitutional ? 'institutional' : 'independent',
    pricePerMonth: isInstitutional ? null : 9,
    authors: author
      ? [
          {
            user_id: author.id,
            display_name: authorName,
            initials: authorInitials,
            gradient: gradientForSeed(author.id),
            is_primary: true,
          },
        ]
      : [],
    cohorts: (data?.cohorts ?? []).map((c) => ({
      id: c.cohort.id,
      name: c.cohort.name,
      state:
        c.cohort.status === 'completed' || c.cohort.status === 'archived'
          ? 'closed'
          : c.cohort.status === 'recruiting'
          ? 'pending'
          : 'open',
      opensAtLabel: c.cohort.start_date
        ? new Date(c.cohort.start_date + 'T00:00:00').toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })
        : null,
      enrolledCount: 0,
      capacity: c.cohort.max_seats ?? 0,
    })),
    coAuthorInvited: null,
  };

  return {
    loading: isLoading || menu.loading,
    isInstitutional,
    blueprint,
  };
}

export const COVER_GRADIENT_OPTIONS = DEFAULT_GRADIENTS;
