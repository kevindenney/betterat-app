import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { AdminBillingSurface } from '@/components/admin/AdminBillingSurface';
import { useAdminOrgBilling } from '@/hooks/useAdminOrgBilling';

const subStyle = { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' };

export default function AdminInvoicesPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { invoices, loading } = useAdminOrgBilling(orgId as string);

  const subtitleText = loading
    ? 'Loading invoices…'
    : invoices.length === 0
      ? 'No invoices yet'
      : `${invoices.length} invoice${invoices.length === 1 ? '' : 's'} on file`;

  return (
    <AdminShell activeKey="invoices">
      <StudioHeader
        crumbs={['Admin', 'Plan', 'Invoices']}
        title="Invoices"
        subtitleParts={[
          <Text key="sub" style={subStyle}>
            {subtitleText}
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
