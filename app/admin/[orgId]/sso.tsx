import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { AdminSecuritySurface } from '@/components/admin/AdminSecuritySurface';

export default function AdminSSOPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  return (
    <AdminShell activeKey="sso">
      <StudioHeader
        crumbs={['Admin', 'Security', 'SSO & domain']}
        title="SSO & domain"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            <Text style={{ fontWeight: '600', color: 'rgba(60, 60, 67, 0.95)' }}>
              SAML 2.0 · Okta
            </Text>
            {' · '}auto-add on · backed by org_sso_config + org_verified_domains
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
