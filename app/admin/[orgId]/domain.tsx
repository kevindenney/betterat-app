import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton } from '@/components/studio/StudioShell';
import { AdminSecuritySurface } from '@/components/admin/AdminSecuritySurface';

export default function AdminDomainPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  return (
    <AdminShell activeKey="domain">
      <StudioHeader
        crumbs={['Admin', 'Security', 'Domain claim']}
        title="SSO & domain"
        subtitleParts={[
          <Text key="sub" style={{ fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' }}>
            DNS TXT status · auto-add policy from org_verified_domains
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
