import React from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { AdminBillingSurface } from '@/components/admin/AdminBillingSurface';
import { useAdminOrgBilling, formatMoneyShort } from '@/hooks/useAdminOrgBilling';

const subStyle = { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' };
const subStrong = { fontWeight: '600' as const, color: 'rgba(60, 60, 67, 0.95)' };

export default function AdminBillingPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { billing, loading, source } = useAdminOrgBilling(orgId as string);

  let subtitle: React.ReactNode;
  if (loading) {
    subtitle = (
      <Text key="sub" style={subStyle}>
        Loading plan…
      </Text>
    );
  } else if (billing) {
    subtitle = (
      <Text key="sub" style={subStyle}>
        <Text style={subStrong}>{billing.plan_label}</Text>
        {` · ${billing.seats_used} of ${billing.seats_total} seats · ${formatMoneyShort(billing.price_monthly_cents)} / ${billing.billing_cadence === 'monthly' ? 'mo' : 'yr'}${billing.net_terms > 0 ? ` · net-${billing.net_terms} invoicing` : ''}`}
        {source === 'test' ? ' · Stripe test mode' : source === 'demo' ? ' · seeded demo data' : ''}
      </Text>
    );
  } else {
    subtitle = (
      <Text key="sub" style={subStyle}>
        No billing plan on file yet
      </Text>
    );
  }

  return (
    <AdminShell activeKey="billing">
      <StudioHeader
        crumbs={['Admin', 'Plan', 'Billing & invoices']}
        title="Billing & invoices"
        subtitleParts={[subtitle]}
        actions={
          <StudioButton
            variant="ghost"
            icon="arrow-up-circle-outline"
            label="Upgrade plan"
            onPress={() => router.push(`/admin/${orgId}/billing?showPlans=1` as any)}
          />
        }
      />
      <AdminBillingSurface />
    </AdminShell>
  );
}
