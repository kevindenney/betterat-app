type MembershipStatusLike = {
  status?: unknown;
  membership_status?: unknown;
};

const ACTIVE_MEMBERSHIP_STATUSES = new Set(['active', 'verified']);

function normalizeStatus(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function isProfileMenuActiveMembership(row: MembershipStatusLike): boolean {
  const status = normalizeStatus(row.status);
  const membershipStatus = normalizeStatus(row.membership_status);
  return ACTIVE_MEMBERSHIP_STATUSES.has(status) &&
    (membershipStatus.length === 0 || ACTIVE_MEMBERSHIP_STATUSES.has(membershipStatus));
}
