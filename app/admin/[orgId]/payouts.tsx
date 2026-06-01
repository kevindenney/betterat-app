import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { AdminPayoutsSurface } from '@/components/admin/AdminPayoutsSurface';

export default function AdminPayoutsPage() {
  const { orgId: _ } = useLocalSearchParams<{ orgId: string }>();
  return (
    <AdminShell activeKey="payouts">
      <StudioHeader
        crumbs={['Admin', 'Plan', 'Author payouts']}
        title="Author payouts"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>
              3 authors
            </Text>
            {' · '}$8,420.00 paid out YTD · next batch May 31 · policy: 70% to author · 10%
            platform · 20% org rebate
          </Text>,
        ]}
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
