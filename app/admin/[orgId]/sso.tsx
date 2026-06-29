import React from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import { StudioHeader, StudioButton, STUDIO_COMPACT_BREAKPOINT } from '@/components/studio/StudioShell';
import { AdminSecuritySurface } from '@/components/admin/AdminSecuritySurface';
import { useOrgSecurity } from '@/hooks/useOrgSecurity';

const subStyle = { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' };
const subStrong = { fontWeight: '600' as const, color: 'rgba(60, 60, 67, 0.95)' };

export default function AdminSSOPage() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { config, domains, loading } = useOrgSecurity(orgId);
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;

  const verifiedCount = domains.filter((d) => d.status === 'verified').length;
  const configured = !!config?.enabled && !!config?.metadataFilename;

  let subtitle: React.ReactNode;
  if (loading) {
    subtitle = (
      <Text key="sub" style={subStyle}>
        Loading SSO config…
      </Text>
    );
  } else if (configured) {
    subtitle = (
      <Text key="sub" style={subStyle}>
        <Text style={subStrong}>SAML 2.0 · Connected</Text>
        {` · auto-add ${config?.autoAddVerifiedDomain ? 'on' : 'off'} · ${verifiedCount} verified domain${verifiedCount === 1 ? '' : 's'}`}
      </Text>
    );
  } else {
    subtitle = (
      <Text key="sub" style={subStyle}>
        <Text style={subStrong}>SAML 2.0</Text>
        {' · not configured yet'}
      </Text>
    );
  }

  return (
    <AdminShell activeKey="sso">
      <StudioHeader
        compact={compact}
        crumbs={['Admin', 'Security', 'SSO & domain']}
        title="SSO & domain"
        subtitleParts={[subtitle]}
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
