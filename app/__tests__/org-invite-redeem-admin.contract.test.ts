import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('organization invite, redeem, and admin access user flows', () => {
  const invitePage = readSource('app/invite/[token].tsx');
  const redeemPage = readSource('app/redeem/[token].tsx');
  const orgAccess = readSource('app/settings/organization-access.tsx');
  const inviteHook = readSource('hooks/useInviteRedemption.ts');
  const routeFlow = readSource('lib/org-invites/routeFlow.ts');
  const adminShell = readSource('components/admin/AdminShell.tsx');

  it('loads organization invite links, marks them opened, and displays org/program/inviter context', () => {
    expect(invitePage).toContain('organizationInviteService.getInviteByToken(token)');
    expect(invitePage).toContain('organizationInviteService.markInviteOpenedByToken(token)');
    expect(invitePage).toContain(".from('organizations')");
    expect(invitePage).toContain(".select('name,slug,interest_slug')");
    expect(invitePage).toContain(".from('programs')");
    expect(invitePage).toContain(".select('title')");
    expect(invitePage).toContain(".from('users')");
    expect(invitePage).toContain(".select('full_name')");
    expect(invitePage).toContain('This invite link is invalid or has expired');
    expect(invitePage).toContain('Join <Text style={styles.orgName}>{orgName || \'an organization\'}</Text>');
    expect(invitePage).toContain('{invite?.invitee_email && (');
  });

  it('accepts and declines invites without blocking on optional side effects', () => {
    expect(invitePage).toContain('await organizationInviteService.acceptInviteTokenForCurrentUser(token);');
    expect(invitePage).toContain('setAccepted(true);');
    expect(invitePage).toContain('const isHidden = !userInterests.some((i) => i.slug === orgInterestSlug);');
    expect(invitePage).toContain('if (isHidden) await addInterest(orgInterestSlug);');
    expect(invitePage).toContain('await switchInterest(orgInterestSlug);');
    expect(invitePage).toContain('NotificationService.notifyOrgInviteAccepted');
    expect(invitePage).toContain('await organizationInviteService.declineInviteByTokenForCurrentUser(token);');
    expect(invitePage).toContain("const destination: Parameters<typeof router.replace>[0] = isGuest");
    expect(invitePage).toContain("router.replace(destination);");
  });

  it('routes accepted admins, faculty, and members to the appropriate next organization experience', () => {
    expect(invitePage).toContain('const ADMIN_ROLE_KEYS = new Set');
    expect(invitePage).toContain('const FACULTY_ROLE_KEYS = new Set');
    expect(invitePage).toContain("router.replace('/organization/members' as any);");
    expect(invitePage).toContain("setWelcomeStep('blueprints');");
    expect(invitePage).toContain('await AsyncStorage.setItem(ONBOARDING_ORG_SLUG_KEY, orgSlug);');
    expect(invitePage).toContain('await AsyncStorage.setItem(ONBOARDING_INTEREST_SLUG_KEY, orgInterestSlug);');
    expect(invitePage).toContain("router.replace('/onboarding/org-welcome?fromInvite=1' as any);");
    expect(invitePage).toContain('publishedBlueprints.map((bp) => (');
    expect(invitePage).toContain('<BlueprintPickerCard');
    expect(invitePage).toContain('Start Building Your Timeline');
  });

  it('lets signed-out users preview redeem links and return through login, while signed-in users redeem through RPC', () => {
    expect(redeemPage).toContain('const signedIn = !!user && !isGuest;');
    expect(redeemPage).toContain('const { preview, loading, redeem } = useInviteRedemption(token);');
    expect(redeemPage).toContain('const returnTo = `/redeem/${token}`;');
    expect(redeemPage).toContain("router.replace(`/(auth)/login?returnTo=${encodeURIComponent(returnTo)}` as any);");
    expect(redeemPage).toContain('redeem.mutate(undefined, {');
    expect(redeemPage).toContain('setRedeemed(true);');
    expect(redeemPage).toContain('setRedeemError(msg);');
    expect(redeemPage).toContain('Auto-subscribe to cohort blueprints');
    expect(redeemPage).toContain('Seats left');

    expect(inviteHook).toContain(".rpc('resolve_invite_link'");
    expect(inviteHook).toContain(".rpc('redeem_invite_link'");
    expect(inviteHook).toContain("queryClient.invalidateQueries({ queryKey });");
    expect(inviteHook).toContain("queryClient.invalidateQueries({ queryKey: ['org-invite-links'] });");
  });

  it('validates manual organization invite tokens and prevents responses from mismatched accounts', () => {
    expect(routeFlow).toContain('export const INVITE_TOKEN_REGEX = /^[a-z0-9]{24}$/;');
    expect(routeFlow).toContain('return String(raw || \'\').trim().toLowerCase();');
    expect(routeFlow).toContain("return { kind: 'manual', reason: 'malformed', malformedToken: inviteToken };");
    expect(routeFlow).toContain("return status === 'draft' || status === 'sent' || status === 'opened';");
    expect(routeFlow).toContain("return status === 'accepted' || status === 'declined';");

    expect(orgAccess).toContain('const token = normalizeInviteToken(params.inviteToken);');
    expect(orgAccess).toContain('if (!isValidInviteToken(token)) {');
    expect(orgAccess).toContain("showAlert(\n          'Invalid Invite Token',");
    expect(orgAccess).toContain('organizationInviteService.markInviteOpenedByToken(normalized)');
    expect(orgAccess).toContain('String(resolvedTokenInvite.invitee_email).trim().toLowerCase() ===');
    expect(orgAccess).toContain("showAlert(\n          'Invite Email Mismatch',");
    expect(orgAccess).toContain('organizationInviteService.acceptInviteByTokenForCurrentUser(token)');
    expect(orgAccess).toContain('organizationInviteService.declineInviteByTokenForCurrentUser(token)');
    expect(orgAccess).toContain('await refreshMemberships();');
  });

  it('records admin-created invites and routes unauthorized admin visitors safely', () => {
    expect(orgAccess).toContain('organizationInviteService.createInvite({');
    expect(orgAccess).toContain('organization_id: activeOrganization.id');
    expect(orgAccess).toContain("status: 'sent'");
    expect(orgAccess).toContain("channel: 'email'");
    expect(orgAccess).toContain("source: 'organization_access'");
    expect(orgAccess).toContain('const inviteLink = inviteToken');
    expect(orgAccess).toContain('const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;');
    expect(orgAccess).toContain('await Linking.openURL(mailto);');
    expect(orgAccess).toContain("if (params.autoInvite !== '1') return;");
    expect(orgAccess).toContain('disabled={!canManageActiveOrganization}');

    expect(adminShell).toContain('isOrgAdminRole(m.role)');
    expect(adminShell).toContain('if (!ready || menu.loading || isOrgAdmin) return;');
    expect(adminShell).toContain("pathname: '/(auth)/login'");
    expect(adminShell).toContain('params: { returnTo: pathname || `/admin/${orgId}` }');
    expect(adminShell).toContain('router.replace(getDashboardRoute(userProfile?.user_type ?? null));');
    expect(adminShell).toContain('if (!ready || !user || menu.loading || !isOrgAdmin) {');
    expect(adminShell).toContain('return <StudioLoading />;');
  });
});
