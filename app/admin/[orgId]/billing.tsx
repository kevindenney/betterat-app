import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { AdminBillingSurface } from '@/components/admin/AdminBillingSurface';

export default function AdminBillingPage() {
  const { orgId: _ } = useLocalSearchParams<{ orgId: string }>();
  return (
    <AdminShell activeKey="billing">
      <StudioHeader
        crumbs={['Admin', 'Plan', 'Billing & invoices']}
        title="Billing & invoices"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>
              Institutional · 50-seat plan
            </Text>
            {' · '}30 seats in use · $1,490 / mo · net-30 invoicing
          </Text>,
        ]}
        actions={
          <>
            <StudioButton variant="ghost" icon="mail-outline" label="Email receipts" />
            <StudioButton variant="ghost" icon="arrow-up-circle-outline" label="Upgrade plan" />
          </>
        }
      />
      <AdminBillingSurface />
    </AdminShell>
  );
}
