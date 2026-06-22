export interface OrgMembershipStatusRow {
  status?: string | null;
  membership_status?: string | null;
}

export function resolveOrgMembershipStatus(row: OrgMembershipStatusRow): string {
  const canonical = row.status ?? null;
  const membershipStatus = row.membership_status ?? null;
  if (canonical === 'pending' || canonical === 'rejected') {
    return canonical;
  }
  if (
    canonical === 'active' ||
    canonical === 'verified' ||
    canonical === 'invite_accepted'
  ) {
    if (membershipStatus === 'pending' || membershipStatus === 'rejected') {
      return membershipStatus;
    }
    return 'active';
  }
  if (membershipStatus === 'invite_accepted') {
    return 'active';
  }
  return membershipStatus || canonical || 'pending';
}

export function isResolvedOrgMembershipActive(row: OrgMembershipStatusRow): boolean {
  return resolveOrgMembershipStatus(row) === 'active';
}

export function isResolvedOrgMembershipPending(row: OrgMembershipStatusRow): boolean {
  return resolveOrgMembershipStatus(row) === 'pending';
}
