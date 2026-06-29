/**
 * /admin/[orgId] · redirect to Overview (the default admin landing).
 *
 * ContextSwitcher lands on this route, then the admin shell opens on the
 * Overview tab so the phone bottom nav has a stable first destination.
 */

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AdminOrgIndex() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  return <Redirect href={`/admin/${orgId}/overview`} />;
}
