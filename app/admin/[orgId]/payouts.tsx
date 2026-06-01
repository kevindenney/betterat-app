import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { AdminPayoutsSurface } from '@/components/admin/AdminPayoutsSurface';
import { useAdminOrgPayouts } from '@/hooks/useAdminOrgPayouts';

const subStyle = { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' };
const subStrong = { fontWeight: '600' as const, color: 'rgba(60, 60, 67, 0.95)' };

export default function AdminPayoutsPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const data = useAdminOrgPayouts(orgId as string);

  const paidYtd = `$${Math.round(data.paidYtdCents / 100).toLocaleString()}`;
  const authorCount = data.authors.length;

  let subtitle: React.ReactNode;
  if (data.loading) {
    subtitle = (
      <Text key="sub" style={subStyle}>
        Loading payouts…
      </Text>
    );
  } else if (authorCount === 0) {
    subtitle = (
      <Text key="sub" style={subStyle}>
        No author payouts yet
      </Text>
    );
  } else {
    subtitle = (
      <Text key="sub" style={subStyle}>
        <Text style={subStrong}>
          {authorCount} author{authorCount === 1 ? '' : 's'}
        </Text>
        {` · ${paidYtd} paid out YTD`}
      </Text>
    );
  }

  return (
    <AdminShell activeKey="payouts">
      <StudioHeader
        crumbs={['Admin', 'Plan', 'Author payouts']}
        title="Author payouts"
        subtitleParts={[subtitle]}
        actions={
          <>
            <StudioButton variant="ghost" icon="time-outline" label="Payout history" />
            <StudioButton variant="ghost" icon="download-outline" label="1099 exports" />
            <StudioButton variant="primary" accent="blue" icon="send" label="Send next batch" />
          </>
        }
      />
      <AdminPayoutsSurface />
    </AdminShell>
  );
}
