import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { AdminBillingSurface } from '@/components/admin/AdminBillingSurface';

export default function AdminInvoicesPage() {
  const { orgId: _ } = useLocalSearchParams<{ orgId: string }>();
  return (
    <AdminShell activeKey="invoices">
      <StudioHeader
        crumbs={['Admin', 'Plan', 'Invoices']}
        title="Invoices"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            14 invoices on file · same surface as Billing for context
          </Text>,
        ]}
        actions={
          <>
            <StudioButton variant="ghost" icon="download-outline" label="Export CSV" />
          </>
        }
      />
      <AdminBillingSurface />
    </AdminShell>
  );
}
