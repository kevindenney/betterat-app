import { supabase } from '@/services/supabase';

export type YachtClubClaimStatus = 'unclaimed' | 'claim_pending' | 'claimed' | 'rejected';
export type YachtClubPricingTier = 'club_free' | 'club_plus' | 'club_pro' | 'enterprise';
export type YachtClubClaimDecision = 'approved' | 'rejected' | 'needs_more_info';

export type YachtClubOrganization = {
  id: string;
  name: string;
  slug: string | null;
  organization_type: string | null;
  status: 'placeholder' | 'active' | 'archived' | null;
  official: boolean | null;
  claim_status: YachtClubClaimStatus | null;
  confidence: 'high' | 'medium' | 'low' | null;
  source: string | null;
  source_summary: string | null;
  source_urls: string[];
  aliases: string[];
  risk_flags: string[];
  clubspot_apac_entry_refs: number;
  clubspot_worlds_entry_refs: number;
  total_entry_refs: number;
  pricing_tier: YachtClubPricingTier | null;
};

export type OrganizationEvidenceRow = {
  id: string;
  organization_id: string;
  source_type: string;
  source_url: string | null;
  note: string | null;
  matched_on: string[];
};

export type OrganizationClaimRow = {
  id: string;
  organization_id: string;
  submitted_by_user_id: string;
  submitted_by_email: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_more_info';
  verification_method: string;
  claimant_name: string;
  claimant_role: string;
  claimant_message: string | null;
  evidence_url: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  organizations?: {
    name: string | null;
    slug: string | null;
    source: string | null;
    confidence: string | null;
    total_entry_refs: number | null;
    risk_flags: string[] | null;
  } | null;
};

export type SubmitYachtClubClaimInput = {
  organizationId: string;
  claimantName: string;
  claimantRole: string;
  submittedByEmail: string;
  verificationMethod: 'email_domain' | 'official_website_link' | 'authorization_letter' | 'manual_admin';
  claimantMessage?: string;
  evidenceUrl?: string;
};

const ORG_SELECT = [
  'id',
  'name',
  'slug',
  'organization_type',
  'status',
  'official',
  'claim_status',
  'confidence',
  'source',
  'source_summary',
  'source_urls',
  'aliases',
  'risk_flags',
  'clubspot_apac_entry_refs',
  'clubspot_worlds_entry_refs',
  'total_entry_refs',
  'pricing_tier',
].join(',');

function normalizeArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
}

function mapOrganization(row: any): YachtClubOrganization {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    slug: row.slug ? String(row.slug) : null,
    organization_type: row.organization_type ? String(row.organization_type) : null,
    status: row.status || null,
    official: typeof row.official === 'boolean' ? row.official : null,
    claim_status: row.claim_status || null,
    confidence: row.confidence || null,
    source: row.source || null,
    source_summary: row.source_summary || null,
    source_urls: normalizeArray(row.source_urls),
    aliases: normalizeArray(row.aliases),
    risk_flags: normalizeArray(row.risk_flags),
    clubspot_apac_entry_refs: Number(row.clubspot_apac_entry_refs || 0),
    clubspot_worlds_entry_refs: Number(row.clubspot_worlds_entry_refs || 0),
    total_entry_refs: Number(row.total_entry_refs || 0),
    pricing_tier: row.pricing_tier || null,
  };
}

export class YachtClubClaimService {
  static async getOrganizationBySlug(slug: string): Promise<YachtClubOrganization | null> {
    const cleanSlug = String(slug || '').trim();
    if (!cleanSlug) return null;

    const { data, error } = await supabase
      .from('organizations')
      .select(ORG_SELECT)
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (error) throw error;
    return data ? mapOrganization(data) : null;
  }

  static async getEvidence(organizationId: string): Promise<OrganizationEvidenceRow[]> {
    const { data, error } = await supabase
      .from('organization_evidence')
      .select('id,organization_id,source_type,source_url,note,matched_on')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data || []) as any[]).map((row) => ({
      id: String(row.id),
      organization_id: String(row.organization_id),
      source_type: String(row.source_type || ''),
      source_url: row.source_url ? String(row.source_url) : null,
      note: row.note ? String(row.note) : null,
      matched_on: normalizeArray(row.matched_on),
    }));
  }

  static async submitClaim(input: SubmitYachtClubClaimInput): Promise<OrganizationClaimRow> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const userId = authData.user?.id;
    if (!userId) throw new Error('Sign in required to claim an organization.');

    const payload = {
      organization_id: input.organizationId,
      submitted_by_user_id: userId,
      submitted_by_email: input.submittedByEmail.trim(),
      verification_method: input.verificationMethod,
      claimant_name: input.claimantName.trim(),
      claimant_role: input.claimantRole.trim(),
      claimant_message: input.claimantMessage?.trim() || null,
      evidence_url: input.evidenceUrl?.trim() || null,
    };

    const { data, error } = await supabase
      .from('organization_claims')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as OrganizationClaimRow;
  }

  static async listClaims(): Promise<OrganizationClaimRow[]> {
    const { data, error } = await supabase
      .from('organization_claims')
      .select('*, organizations(name,slug,source,confidence,total_entry_refs,risk_flags)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return (data || []) as OrganizationClaimRow[];
  }

  static async reviewClaim(
    claimId: string,
    decision: YachtClubClaimDecision,
    reviewNote?: string,
  ): Promise<OrganizationClaimRow> {
    const { data, error } = await supabase.rpc('review_organization_claim', {
      p_claim_id: claimId,
      p_decision: decision,
      p_review_note: reviewNote?.trim() || null,
    });

    if (error) throw error;
    return data as OrganizationClaimRow;
  }
}
