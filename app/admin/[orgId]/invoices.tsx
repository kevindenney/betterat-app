import { AdminShell } from '@/components/admin/AdminShell';
import { AdminComingNext } from '@/components/admin/AdminComingNext';

export default function AdminInvoicesPage() {
  return (
    <AdminShell activeKey="invoices">
      <AdminComingNext
        crumbs={['Admin', 'Invoices']}
        title="Invoices"
        icon="document-text-outline"
        pitch="Every invoice your institution has been billed, downloadable as PDF for accounting and audit reconciliation."
        bulletPromises={[
          'Year-to-date and historical invoices in one table',
          'Download as PDF or push directly to your AR system',
          'Invoice-level seat breakdown + line-item discounts',
          'Open / Paid / Overdue status synced from Stripe',
          'Resend invoice to the billing contact in one tap',
        ]}
      />
    </AdminShell>
  );
}
