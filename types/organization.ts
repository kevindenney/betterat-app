/**
 * Organization types — shared shapes for create-org flow and adjacent surfaces.
 *
 * See docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md for the full design and the
 * column-mapping decisions (why creation_source is the origin axis vs.
 * claim_status which is the claim-lifecycle axis).
 */

export type OrganizationKind =
  | 'club'
  | 'institution'
  | 'association'
  | 'business'
  | 'community'
  | 'other'
  | 'yacht_club'
  | 'fleet'
  | 'training_squad'
  | 'study_group'
  | 'lab_group'
  | 'chapter';

export type OrganizationJoinMode = 'invite_only' | 'request_to_join' | 'open_join';

export type OrganizationCreationSource = 'seeded' | 'user' | 'verified';

export type OrganizationClaimStatus =
  | 'unclaimed'
  | 'claim_pending'
  | 'claimed'
  | 'rejected';

export type OrganizationStatus = 'placeholder' | 'active' | 'archived';

export type OrganizationVerificationMode =
  | 'none'
  | 'email_domain'
  | 'invite_only'
  | 'sso'
  | 'admin_approval';

/**
 * Org kinds the self-serve create-org form offers. Subset of OrganizationKind —
 * we don't surface 'club' / 'institution' / 'yacht_club' as self-serve options
 * because those are reserved for the verified path (claim, not create).
 */
export const SELF_SERVE_ORG_KINDS = [
  'fleet',
  'training_squad',
  'study_group',
  'lab_group',
  'chapter',
  'community',
  'other',
] as const satisfies readonly OrganizationKind[];

export type SelfServeOrgKind = (typeof SELF_SERVE_ORG_KINDS)[number];

export const SELF_SERVE_ORG_KIND_LABELS: Record<SelfServeOrgKind, string> = {
  fleet: 'Fleet',
  training_squad: 'Training squad',
  study_group: 'Study group',
  lab_group: 'Lab group',
  chapter: 'Chapter',
  community: 'Community',
  other: 'Other',
};

/**
 * Input shape for OrgCreationService.createUserOrg.
 *
 * - parentOrgId is optional; when set the new org inherits via parent_org_id
 *   (vocab grandparent semantics per spec section "Vocabulary on adoption").
 * - interestSlug defaults to the caller's active interest at the service edge.
 */
export interface CreateUserOrgInput {
  name: string;
  kind: SelfServeOrgKind;
  joinMode: OrganizationJoinMode;
  description?: string;
  parentOrgId?: string;
  interestSlug?: string;
}

/**
 * Row shape returned by createUserOrg. Mirrors the columns the post-create
 * redirect needs to navigate to /discover/org/<slug>.
 */
export interface CreatedOrganization {
  id: string;
  name: string;
  slug: string;
  organization_type: OrganizationKind;
  join_mode: OrganizationJoinMode;
  creation_source: OrganizationCreationSource;
  interest_slug: string;
  status: OrganizationStatus;
  official: boolean;
  claim_status: OrganizationClaimStatus;
  parent_org_id: string | null;
}

/**
 * Verification request row (slice 3 will use this; included here so service
 * layer and admin queue UI share types).
 */
export interface OrgVerificationRequest {
  id: string;
  organization_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_info';
  proof: Record<string, unknown>;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  created_at: string;
  decided_at: string | null;
}
