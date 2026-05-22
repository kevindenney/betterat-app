import { AdminShell } from '@/components/admin/AdminShell';
import { AdminComingNext } from '@/components/admin/AdminComingNext';

export default function AdminSSOPage() {
  return (
    <AdminShell activeKey="sso">
      <AdminComingNext
        crumbs={['Admin', 'SSO & SAML']}
        title="SSO & SAML"
        icon="shield-half-outline"
        pitch="Configure single sign-on against your existing identity provider so students never type a password and IT keeps the master roster."
        bulletPromises={[
          'SAML 2.0 with Microsoft 365, Okta, OneLogin, Google Workspace',
          'OIDC option for newer IdPs',
          'Just-in-time provisioning when a student first signs in',
          'Group-claim mapping → cohort assignment automatically',
          'Last-sync timestamp + connection health monitoring',
        ]}
      />
    </AdminShell>
  );
}
