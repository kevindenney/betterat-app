import { AdminShell } from '@/components/admin/AdminShell';
import { AdminComingNext } from '@/components/admin/AdminComingNext';

export default function AdminPayoutsPage() {
  return (
    <AdminShell activeKey="payouts">
      <AdminComingNext
        crumbs={['Admin', 'Author payouts']}
        title="Author payouts"
        icon="receipt-outline"
        pitch="Institutional authors don't collect personal payouts — but you can see what they've contributed and how their blueprints are doing across your cohorts."
        bulletPromises={[
          'Per-author activity: blueprints authored, subscribers, threads',
          'Cohort coverage per blueprint to show institutional value',
          'Author terms agreement signed during onboarding',
          'Faculty payouts (if any) routed via your finance system, not Stripe',
          'Quarterly export for faculty performance reviews',
        ]}
      />
    </AdminShell>
  );
}
