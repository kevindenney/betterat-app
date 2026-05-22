import { AdminShell } from '@/components/admin/AdminShell';
import { AdminComingNext } from '@/components/admin/AdminComingNext';

export default function AdminDomainPage() {
  return (
    <AdminShell activeKey="domain">
      <AdminComingNext
        crumbs={['Admin', 'Domain claim']}
        title="Domain claim"
        icon="key-outline"
        pitch="Every email address on your verified domains auto-redeems into the right cohort. Owns the question 'who counts as a Hopkins seat?'"
        bulletPromises={[
          'Add additional domains (@jhmi.edu, @jhu.edu) post-pilot',
          'DNS TXT verification + email verification fallback',
          'Block specific subdomains if needed (e.g. @alum.jh.edu)',
          'See pending verifications and their TTL countdown',
          'Audit which students entered via which domain',
        ]}
      />
    </AdminShell>
  );
}
