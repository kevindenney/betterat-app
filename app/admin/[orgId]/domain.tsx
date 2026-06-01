import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { AdminSecuritySurface } from '@/components/admin/AdminSecuritySurface';
import { useOrgSecurity } from '@/hooks/useOrgSecurity';

const subStyle = { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' };

export default function AdminDomainPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { config, domains, loading } = useOrgSecurity(orgId);

  const verifiedCount = domains.filter((d) => d.status === 'verified').length;
  const pendingCount = domains.filter((d) => d.status === 'pending').length;

  let subtitleText: string;
  if (loading) {
    subtitleText = 'Loading domains…';
  } else if (domains.length === 0) {
    subtitleText = 'No domains claimed yet';
  } else {
    subtitleText = `${verifiedCount} verified · ${pendingCount} pending · auto-add ${config?.autoAddVerifiedDomain ? 'on' : 'off'}`;
  }

  return (
    <AdminShell activeKey="domain">
      <StudioHeader
        crumbs={['Admin', 'Security', 'Domain claim']}
        title="SSO & domain"
        subtitleParts={[
          <Text key="sub" style={subStyle}>
            {subtitleText}
          </Text>,
        ]}
        actions={
          <>
            <StudioButton variant="ghost" icon="flask-outline" label="Test login" />
            <StudioButton variant="primary" accent="blue" icon="arrow-up-circle" label="Save changes" />
          </>
        }
      />
      <AdminSecuritySurface orgId={orgId} />
    </AdminShell>
  );
}
