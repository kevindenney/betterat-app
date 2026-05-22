import { AdminShell } from '@/components/admin/AdminShell';
import { AdminComingNext } from '@/components/admin/AdminComingNext';

export default function AdminBlueprintsPage() {
  return (
    <AdminShell activeKey="blueprints">
      <AdminComingNext
        crumbs={['Admin', 'Blueprints']}
        title="Blueprints"
        icon="git-branch-outline"
        pitch="Every blueprint authored under your institutional plan — versions, subscribers, and the cohorts that have it assigned."
        bulletPromises={[
          'List of authored blueprints with version + draft / live state',
          'Subscriber counts and adoption per cohort',
          'Peer-review workflow + publish gate',
          'Hopkins-managed vs Independent-sale toggle per blueprint',
          'Capability + outcome arcs surfaced for accreditation audits',
        ]}
      />
    </AdminShell>
  );
}
