/**
 * useAdminOrgBilling — billing summary + invoice list for /admin/[orgId]/billing.
 *
 * The org's REAL Stripe-backed subscription (organization_subscriptions, written
 * by the stripe-webhooks function) is authoritative. When present, plan + period
 * are derived from it and payment/invoice cards degrade to empty-states (Stripe
 * invoice + payment-method sync isn't wired yet). When absent, we fall back to the
 * demo/manually-seeded org_billing + org_invoices via the admin_org_billing RPC
 * (SECURITY DEFINER + is_org_admin_member gate) so seeded demo orgs still render.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { OrgSubscriptionService, type OrgSubscription } from '@/services/OrgSubscriptionService';
import { ORG_PLANS, type OrgPlanId } from '@/lib/subscriptions/orgTiers';

export interface OrgBillingRow {
  org_id: string;
  plan_tier: string;
  plan_label: string;
  price_monthly_cents: number;
  billing_cadence: 'monthly' | 'annual';
  net_terms: number;
  seats_total: number;
  seats_used: number;
  seats_students: number;
  seats_mentors: number;
  seats_faculty: number;
  next_renewal_date: string | null;
  auto_renew: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_exp_month: number | null;
  payment_method_exp_year: number | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  pilot_locked_until: string | null;
  list_rate_monthly_cents: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface OrgInvoiceRow {
  id: string;
  org_id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  seats_billed: number;
  amount_cents: number;
  status: 'paid' | 'open' | 'void' | 'waived' | 'past_due';
  paid_at: string | null;
  due_at: string | null;
  pdf_url: string | null;
  stripe_invoice_id: string | null;
}

/** Where the rendered billing summary came from. */
export type OrgBillingSource = 'subscription' | 'demo' | null;

export interface AdminOrgBillingData {
  billing: OrgBillingRow | null;
  invoices: OrgInvoiceRow[];
  source: OrgBillingSource;
}

/**
 * Project a real Stripe subscription onto the OrgBillingRow shape the surface
 * renders. Card-on-file is synced by stripe-webhooks (null until the first
 * invoice.paid/customer.updated lands); billing-contact fields stay null (not
 * synced), so the surface degrades to a partial card rather than fiction.
 */
function billingFromSubscription(sub: OrgSubscription, memberCount: number): OrgBillingRow {
  const plan = ORG_PLANS[sub.plan_id as OrgPlanId];
  const cadence: 'monthly' | 'annual' = sub.billing_period === 'monthly' ? 'monthly' : 'annual';
  const price = sub.amount ?? (plan ? (cadence === 'annual' ? plan.annualPrice : plan.monthlyPrice) : 0);
  return {
    org_id: sub.organization_id,
    plan_tier: sub.plan_id,
    plan_label: plan?.name ?? sub.plan_id,
    price_monthly_cents: price,
    billing_cadence: cadence,
    net_terms: 0,
    seats_total: sub.seat_count ?? 0,
    seats_used: memberCount,
    seats_students: 0,
    seats_mentors: 0,
    seats_faculty: 0,
    // current_period_end is a full timestamptz; the formatters expect YYYY-MM-DD.
    next_renewal_date: sub.current_period_end ? sub.current_period_end.slice(0, 10) : null,
    auto_renew: sub.status === 'active' && !sub.cancelled_at,
    payment_method_brand: sub.payment_method_brand,
    payment_method_last4: sub.payment_method_last4,
    payment_method_exp_month: sub.payment_method_exp_month,
    payment_method_exp_year: sub.payment_method_exp_year,
    billing_contact_name: null,
    billing_contact_email: null,
    pilot_locked_until: null,
    list_rate_monthly_cents: null,
    stripe_customer_id: sub.stripe_customer_id,
    stripe_subscription_id: sub.stripe_subscription_id,
  };
}

export function useAdminOrgBilling(orgId: string) {
  const { data, isLoading, error } = useQuery<AdminOrgBillingData>({
    queryKey: ['admin-org-billing', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminOrgBillingData> => {
      // Real subscription wins; demo RPC is the fallback. Fetch both in parallel.
      const [rpcRes, subscription] = await Promise.all([
        supabase.rpc('admin_org_billing', { p_org_id: orgId }),
        OrgSubscriptionService.getSubscription(orgId),
      ]);

      const wrapped = (rpcRes.error
        ? {}
        : (rpcRes.data ?? {})) as { billing?: OrgBillingRow | null; invoices?: OrgInvoiceRow[] };
      const rpcInvoices = wrapped.invoices ?? [];

      // Real Stripe-backed subscription — authoritative. Invoices come from the
      // RPC's org_invoices (written by the stripe-webhooks invoice.paid handler);
      // an org with a subscription but no cleared invoices yet shows empty-state.
      if (subscription) {
        const { count } = await supabase
          .from('organization_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .in('status', ['active', 'verified']);
        return {
          billing: billingFromSubscription(subscription, count ?? 0),
          invoices: rpcInvoices,
          source: 'subscription',
        };
      }

      // Demo / manually-seeded billing (e.g. JHSON demo org).
      if (rpcRes.error) {
        console.warn('[useAdminOrgBilling] RPC failed', rpcRes.error);
        return { billing: null, invoices: [], source: null };
      }
      const demoBilling = wrapped.billing ?? null;
      return {
        billing: demoBilling,
        invoices: wrapped.invoices ?? [],
        source: demoBilling ? 'demo' : null,
      };
    },
  });

  return {
    billing: data?.billing ?? null,
    invoices: data?.invoices ?? [],
    source: data?.source ?? null,
    loading: isLoading,
    error,
  };
}

/** Format cents → "$1,490.00". */
export function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format cents → "$1,490" (no decimals, for headline numbers). */
export function formatMoneyShort(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/** Format a YYYY-MM-DD period range → "May 1 – May 31, 2026". */
export function formatPeriod(startIso: string, endIso: string): string {
  const start = new Date(startIso + 'T00:00:00');
  const end = new Date(endIso + 'T00:00:00');
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = sameMonth
    ? end.toLocaleDateString(undefined, { day: 'numeric', year: 'numeric' })
    : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

/** Format a YYYY-MM-DD → "Jun 1, 2026". */
export function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
