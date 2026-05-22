import { AdminShell } from '@/components/admin/AdminShell';
import { AdminComingNext } from '@/components/admin/AdminComingNext';

export default function AdminBillingPage() {
  return (
    <AdminShell activeKey="billing">
      <AdminComingNext
        crumbs={['Admin', 'Billing & seats']}
        title="Billing & seats"
        icon="card-outline"
        pitch="Annual institutional plan — seat counts, renewal, upgrade lanes, and PO / wire / ACH payment paths your procurement team expects."
        bulletPromises={[
          'Current plan tier + seat utilization + renewal date',
          'Add seats mid-cycle with prorated billing preview',
          'Switch billing contact + send invoices to procurement',
          'BAA, SOC 2 Type II, FERPA documents on the same page',
          'Pay by PO, ACH, wire, or card — no add-on negotiations',
        ]}
      />
    </AdminShell>
  );
}
