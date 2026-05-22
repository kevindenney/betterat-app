/**
 * /admin/[orgId] · redirect to People (the default admin landing).
 *
 * Frame 7 lands on People; until the Overview drawer ships, "go to admin"
 * funnels here.
 */

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AdminOrgIndex() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  return <Redirect href={`/admin/${orgId}/people`} />;
}
