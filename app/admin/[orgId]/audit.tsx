import { AdminShell } from '@/components/admin/AdminShell';
import { AdminComingNext } from '@/components/admin/AdminComingNext';

export default function AdminAuditPage() {
  return (
    <AdminShell activeKey="audit">
      <AdminComingNext
        crumbs={['Admin', 'Audit log']}
        title="Audit log"
        icon="time-outline"
        pitch="Who did what, and when. SOC 2 expects this trail; your IT team will too."
        bulletPromises={[
          'Every admin action: invites sent, role changes, seat removals',
          'SSO sign-in events with IP + user agent',
          'Cohort + blueprint assignment changes',
          'Filterable by actor, target, and event type',
          'Export to SIEM with one-click webhook setup',
        ]}
      />
    </AdminShell>
  );
}
