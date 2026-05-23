/**
 * useAdminOrgBilling — billing summary + invoice list for /admin/[orgId]/billing.
 * Wraps admin_org_billing RPC (SECURITY DEFINER + is_org_admin_member gate).
 *
 * Returns the org_billing row and ordered org_invoices rows in one round-trip.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

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

export interface AdminOrgBillingData {
  billing: OrgBillingRow | null;
  invoices: OrgInvoiceRow[];
}

export function useAdminOrgBilling(orgId: string) {
  const { data, isLoading, error } = useQuery<AdminOrgBillingData>({
    queryKey: ['admin-org-billing', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminOrgBillingData> => {
      const { data: payload, error: rpcErr } = await supabase.rpc('admin_org_billing', {
        p_org_id: orgId,
      });
      if (rpcErr) {
        console.warn('[useAdminOrgBilling] RPC failed', rpcErr);
        return { billing: null, invoices: [] };
      }
      const wrapped = (payload ?? {}) as { billing?: OrgBillingRow | null; invoices?: OrgInvoiceRow[] };
      return {
        billing: wrapped.billing ?? null,
        invoices: wrapped.invoices ?? [],
      };
    },
  });

  return {
    billing: data?.billing ?? null,
    invoices: data?.invoices ?? [],
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
