import { AdminShell } from '@/components/admin/AdminShell';
import { AdminComingNext } from '@/components/admin/AdminComingNext';
import { useLocalSearchParams } from 'expo-router';

export default function AdminOverviewPage() {
  const { orgId: _ } = useLocalSearchParams<{ orgId: string }>();
  return (
    <AdminShell activeKey="overview">
      <AdminComingNext
        crumbs={['Admin', 'Overview']}
        title="Overview"
        icon="grid-outline"
        pitch="A single screen for the whole program: seats utilization, cohort health, blueprint engagement, and the three flags that need your attention today."
        bulletPromises={[
          'Live seat utilization and renewal countdown',
          'Cohort completion trends week over week',
          'Top 3 students by activity drop-off (mentor handoff lane)',
          'Blueprint adoption + reflection rates per author',
          'Aggregate Atlas heatmap — who is active where this week',
        ]}
      />
    </AdminShell>
  );
}
