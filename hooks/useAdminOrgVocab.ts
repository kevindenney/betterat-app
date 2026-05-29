/**
 * useAdminOrgVocab — admin-domain vocabulary for an org, resolved from the
 * org's interest_slug (not the viewer's active interest). Lets every
 * /admin/[orgId]/* screen speak the vertical's native nouns: "Fleets /
 * Venues / Racers" for sailing, "SHG Sections / Villages" for an SHG org,
 * "Clinical Sites / Students" for nursing.
 */

import { useMemo } from 'react';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { getAdminVocabulary, type VocabularyMap } from '@/lib/vocabulary';

export function useAdminOrgVocab(orgId: string): VocabularyMap {
  const menu = useProfileMenuData();
  return useMemo(() => {
    const membership = menu.memberships.find((m) => m.org_id === orgId);
    return getAdminVocabulary(membership?.interest_slug);
  }, [menu.memberships, orgId]);
}
