import fs from 'fs';
import path from 'path';
import {
  isResolvedOrgMembershipActive,
  isResolvedOrgMembershipPending,
  resolveOrgMembershipStatus,
} from '../orgMembershipStatus';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('useOrgViewerMembership contracts', () => {
  it('resolves split membership status conservatively', () => {
    expect(
      resolveOrgMembershipStatus({
        status: 'pending',
        membership_status: 'active',
      }),
    ).toBe('pending');
    expect(
      resolveOrgMembershipStatus({
        status: 'rejected',
        membership_status: 'active',
      }),
    ).toBe('rejected');
    expect(
      resolveOrgMembershipStatus({
        status: 'active',
        membership_status: 'pending',
      }),
    ).toBe('pending');
    expect(
      resolveOrgMembershipStatus({
        status: 'invite_accepted',
        membership_status: null,
      }),
    ).toBe('active');
    expect(isResolvedOrgMembershipActive({ status: 'active' })).toBe(true);
    expect(
      isResolvedOrgMembershipActive({
        status: 'pending',
        membership_status: 'active',
      }),
    ).toBe(false);
    expect(isResolvedOrgMembershipPending({ status: 'pending' })).toBe(true);
  });

  it('uses the shared resolver for member/admin UI gates', () => {
    const source = readSource('hooks/useOrgViewerMembership.ts');
    const legacyOrgDetail = readSource('app/discover/org/[slug].tsx');
    const myOrgs = readSource('hooks/useMyOrgs.ts');
    const verifiedAdminOrgs = readSource('hooks/useMyVerifiedAdminOrgs.ts');
    const discoverToday = readSource('components/discover/DiscoverTodayContent.tsx');
    const discoverOrgs = readSource('components/discover/DiscoverOrgsContent.tsx');
    const discoverInterests = readSource('components/discover/DiscoverInterestsContent.tsx');
    const publishBlueprint = readSource('components/blueprint/PublishBlueprintSheet.tsx');
    const nursingSites = readSource('hooks/useNursingCuratedSites.ts');
    const knowledgeAudiences = readSource('hooks/useKnowledgeAudiences.ts');
    const orgTemplates = readSource('app/organization/templates.tsx');
    const accessRequests = readSource('app/organization/access-requests.tsx');
    const organizationMembers = readSource('app/organization/members.tsx');
    const organizationCohorts = readSource('app/organization/cohorts.tsx');
    const organizationCohortDetail = readSource('app/organization/cohort/[cohortId].tsx');
    const organizationCompetencies = readSource('app/organization/competencies.tsx');
    const organizationCohortDashboard = readSource('app/organization/cohort-dashboard.tsx');
    const libraryAll = readSource('components/library/zones/AllZone.tsx');
    const orgBrowser = readSource('components/landing/OrganizationBrowserPage.tsx');
    const publicOrg = readSource('app/org/[slug].tsx');
    const catalog = readSource('app/catalog.tsx');
    const person = readSource('app/person/[userId].tsx');
    const personPublicSections = readSource('hooks/usePersonPublicSections.ts');
    const atlasSearch = readSource('components/ios-register/atlas/AtlasSearchSheet.tsx');
    const orgMembers = readSource('hooks/useOrgMembers.ts');
    const adminPeople = readSource('hooks/useAdminPeople.ts');
    const adminGate = readSource('lib/organizations/adminGate.ts');
    const learn = readSource('app/(tabs)/learn.tsx');
    const organizationSearch = readSource('components/search/OrganizationSearchContent.tsx');

    expect(source).toContain('status: resolveOrgMembershipStatus(r)');
    expect(source).not.toContain("status: r.membership_status || r.status || 'pending'");
    expect(legacyOrgDetail).toContain(
      "import { resolveOrgMembershipStatus } from '@/hooks/orgMembershipStatus'",
    );
    expect(legacyOrgDetail).toContain('const membershipStatus = resolveOrgMembershipStatus');
    expect(legacyOrgDetail).not.toContain(
      "my.status === 'active' || my.membership_status === 'active'",
    );
    for (const consumer of [
      myOrgs,
      verifiedAdminOrgs,
      discoverToday,
      discoverOrgs,
      discoverInterests,
      publishBlueprint,
      nursingSites,
      knowledgeAudiences,
      orgTemplates,
      accessRequests,
      organizationCohortDetail,
      publicOrg,
      catalog,
      person,
      personPublicSections,
      atlasSearch,
    ]) {
      expect(consumer).toContain('isResolvedOrgMembershipActive');
    }
    for (const consumer of [
      libraryAll,
      orgBrowser,
      orgMembers,
      adminPeople,
      adminGate,
      organizationMembers,
      accessRequests,
      learn,
      organizationSearch,
    ]) {
      expect(consumer).toContain('resolveOrgMembershipStatus');
    }
    expect(personPublicSections).not.toContain(".eq('membership_status', 'active')");
    expect(atlasSearch).not.toContain(".eq('membership_status', 'active')");
    expect(learn).not.toContain(".in('membership_status', ['active', 'verified'])");
    for (const consumer of [
      organizationMembers,
      organizationCohorts,
      organizationCohortDetail,
      organizationCompetencies,
      organizationCohortDashboard,
    ]) {
      expect(consumer).toContain('getActiveMembership');
      expect(consumer).toContain('isActiveMembership(membershipStatus)');
    }
  });
});
