/**
 * useLivelihoodAtlas — didi-facing data for the rural entrepreneur Atlas.
 *
 * Reads the shared livelihood tables that #30 will later aggregate, while #29
 * owns the first write loop: a woman logs a haat result, savings, and capability
 * evidence. The mutation also updates business_outcomes so existing money-lane
 * surfaces keep working.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useActivePlan } from '@/hooks/usePlan';
import { businessOutcomesKey } from '@/hooks/useBusinessOutcomes';

export interface HaatCalendar {
  id: string;
  name: string;
  localName: string | null;
  dayOfWeek: number;
  startsAtLocal: string | null;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  atlasPoiId: string | null;
}

export interface LivelihoodScheme {
  id: string;
  slug: string;
  name: string;
  provider: string | null;
  schemeType: string;
}

export interface LivelihoodLedgerEntry {
  id: string;
  userId: string;
  timelineStepId: string | null;
  haatCalendarId: string | null;
  orgUnitId: string | null;
  entryDate: string;
  unitsSold: number;
  revenueMinor: number;
  savingsMinor: number;
  expensesMinor: number;
  customerCount: number;
  repeatCount: number;
  currency: string;
  capabilityTags: string[];
  schemeIds: string[];
  evidenceNote: string | null;
}

export type LivelihoodMoneyEntryKind =
  | 'sale'
  | 'expense'
  | 'savings_deposit'
  | 'loan_repayment'
  | 'stock_return';

export type LivelihoodPaymentChannel = 'cash' | 'upi' | 'mixed' | 'credit' | 'unknown';

export interface LivelihoodMoneyEntry {
  id: string;
  userId: string;
  ledgerEntryId: string | null;
  timelineStepId: string | null;
  haatCalendarId: string | null;
  orgUnitId: string | null;
  entryDate: string;
  entryKind: LivelihoodMoneyEntryKind;
  productName: string | null;
  quantity: number | null;
  unitLabel: string | null;
  unitPriceMinor: number | null;
  amountMinor: number;
  paymentChannel: LivelihoodPaymentChannel;
  currency: string;
  counterparty: string | null;
  sourceText: string | null;
  isVoiceParsed: boolean;
}

export interface LivelihoodProfile {
  userId: string;
  shgUnitId: string | null;
  enterpriseKind: string | null;
  primaryCraft: string | null;
  annualGoalMinor: number;
  currency: string;
}

export interface LivelihoodHealth {
  revenueMinor: number;
  expensesMinor: number;
  profitMinor: number;
  savingsMinor: number;
  loanRepaymentMinor: number;
  annualGoalMinor: number;
  progressPct: number;
  haatCount: number;
  strongestHaatName: string | null;
  capabilityStates: {
    sourcing: boolean;
    quality: boolean;
    selling: boolean;
    money: boolean;
    digital: boolean;
  };
}

export interface LogLivelihoodEntryInput {
  timelineStepId?: string | null;
  haatCalendarId?: string | null;
  orgUnitId?: string | null;
  entryDate?: string;
  productName?: string | null;
  unitLabel?: string | null;
  unitPriceMinor?: number | null;
  paymentChannel?: LivelihoodPaymentChannel;
  sourceText?: string | null;
  isVoiceParsed?: boolean;
  unitsSold: number;
  revenueMinor: number;
  savingsMinor?: number;
  expensesMinor?: number;
  loanRepaymentMinor?: number;
  customerCount?: number;
  repeatCount?: number;
  currency?: string;
  capabilityTags?: string[];
  schemeIds?: string[];
  evidenceNote?: string | null;
}

export interface ParsedLivelihoodSale {
  productName: string;
  quantity: number;
  unitLabel: string;
  unitPriceMinor: number;
  paymentChannel: LivelihoodPaymentChannel;
}

const DEFAULT_GOAL_MINOR = 10000000; // ₹1 lakh, in paise.

function mondayOf(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function coerceTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function paymentChannel(value: unknown): LivelihoodPaymentChannel {
  return value === 'cash' || value === 'upi' || value === 'mixed' || value === 'credit'
    ? value
    : 'unknown';
}

function moneyKind(value: unknown): LivelihoodMoneyEntryKind {
  return value === 'expense' ||
    value === 'savings_deposit' ||
    value === 'loan_repayment' ||
    value === 'stock_return'
    ? value
    : 'sale';
}

export function parseLivelihoodSaleText(text: string): ParsedLivelihoodSale {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();
  const quantityMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(जार|jar|jars|बोतल|packet|packets|पैकेट|पीस|piece|pieces)/i);
  const rupeeMatch =
    normalized.match(/₹\s*(\d+(?:\.\d+)?)/) ??
    normalized.match(/(\d+(?:\.\d+)?)\s*(?:rs|रुपये|रु)/i);
  const numbers = Array.from(normalized.matchAll(/\d+(?:\.\d+)?/g)).map((match) => Number(match[0]));
  const quantity = Math.max(0, quantityMatch ? Number(quantityMatch[1]) : numbers[0] ?? 0);
  const unitPrice = Math.max(0, rupeeMatch ? Number(rupeeMatch[1]) : numbers[1] ?? 0);
  const productName = lower.includes('पापड़') || lower.includes('papad')
    ? 'पापड़'
    : lower.includes('कटहल') || lower.includes('jackfruit')
      ? 'कटहल'
      : lower.includes('lac') || lower.includes('लाह')
        ? 'लाह शिल्प'
        : 'अचार';
  const unitLabel = quantityMatch?.[2] ?? 'जार';
  const channel: LivelihoodPaymentChannel = lower.includes('upi') || lower.includes('यूपीआई')
    ? 'upi'
    : lower.includes('cash') || lower.includes('नकद')
      ? 'cash'
      : 'unknown';
  return {
    productName,
    quantity,
    unitLabel,
    unitPriceMinor: Math.round(unitPrice * 100),
    paymentChannel: channel,
  };
}

function isMissingRelation(error: unknown): boolean {
  const err = error as { code?: unknown; message?: unknown } | null;
  return (
    err?.code === '42P01' ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('does not exist'))
  );
}

export const livelihoodAtlasKey = (userId: string | null | undefined) =>
  ['livelihood-atlas', userId ?? 'none'] as const;

export function useLivelihoodAtlas() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: livelihoodAtlasKey(userId),
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const [profileRes, haatsRes, schemesRes, ledgerRes, moneyRes] = await Promise.all([
        supabase
          .from('livelihood_user_profiles')
          .select('user_id, shg_unit_id, enterprise_kind, primary_craft, annual_goal_minor, currency')
          .eq('user_id', userId as string)
          .maybeSingle(),
        supabase
          .from('haat_calendars')
          .select('id, name, local_name, day_of_week, starts_at_local, lat, lng, distance_km, atlas_poi_id')
          .order('day_of_week', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('scheme_catalog')
          .select('id, slug, name, provider, scheme_type')
          .order('scheme_type', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('livelihood_ledger_entries')
          .select(
            'id, user_id, timeline_step_id, haat_calendar_id, org_unit_id, entry_date, units_sold, revenue_minor, savings_minor, expenses_minor, customer_count, repeat_count, currency, capability_tags, scheme_ids, evidence_note',
          )
          .eq('user_id', userId as string)
          .order('entry_date', { ascending: false })
          .limit(40),
        supabase
          .from('livelihood_money_entries')
          .select(
            'id, user_id, ledger_entry_id, timeline_step_id, haat_calendar_id, org_unit_id, entry_date, entry_kind, product_name, quantity, unit_label, unit_price_minor, amount_minor, payment_channel, currency, counterparty, source_text, is_voice_parsed',
          )
          .eq('user_id', userId as string)
          .order('entry_date', { ascending: false })
          .limit(120),
      ]);

      const errors = [profileRes.error, haatsRes.error, schemesRes.error, ledgerRes.error, moneyRes.error].filter(Boolean);
      if (errors.some(isMissingRelation)) {
        return { profile: null, haats: [], schemes: [], ledger: [], moneyEntries: [] };
      }
      if (profileRes.error) throw profileRes.error;
      if (haatsRes.error) throw haatsRes.error;
      if (schemesRes.error) throw schemesRes.error;
      if (ledgerRes.error) throw ledgerRes.error;
      if (moneyRes.error) throw moneyRes.error;

      const profileRow = profileRes.data as Record<string, unknown> | null;
      const profile: LivelihoodProfile | null = profileRow
        ? {
            userId: String(profileRow.user_id),
            shgUnitId: typeof profileRow.shg_unit_id === 'string' ? profileRow.shg_unit_id : null,
            enterpriseKind:
              typeof profileRow.enterprise_kind === 'string' ? profileRow.enterprise_kind : null,
            primaryCraft:
              typeof profileRow.primary_craft === 'string' ? profileRow.primary_craft : null,
            annualGoalMinor: money(profileRow.annual_goal_minor) || DEFAULT_GOAL_MINOR,
            currency: typeof profileRow.currency === 'string' ? profileRow.currency : 'INR',
          }
        : null;

      const haats: HaatCalendar[] = ((haatsRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        name: String(row.name),
        localName: typeof row.local_name === 'string' ? row.local_name : null,
        dayOfWeek: Number(row.day_of_week),
        startsAtLocal: typeof row.starts_at_local === 'string' ? row.starts_at_local : null,
        lat: row.lat == null ? null : Number(row.lat),
        lng: row.lng == null ? null : Number(row.lng),
        distanceKm: row.distance_km == null ? null : Number(row.distance_km),
        atlasPoiId: typeof row.atlas_poi_id === 'string' ? row.atlas_poi_id : null,
      }));

      const schemes: LivelihoodScheme[] = ((schemesRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        slug: String(row.slug),
        name: String(row.name),
        provider: typeof row.provider === 'string' ? row.provider : null,
        schemeType: String(row.scheme_type ?? 'livelihood'),
      }));

      const ledger: LivelihoodLedgerEntry[] = ((ledgerRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        timelineStepId: typeof row.timeline_step_id === 'string' ? row.timeline_step_id : null,
        haatCalendarId: typeof row.haat_calendar_id === 'string' ? row.haat_calendar_id : null,
        orgUnitId: typeof row.org_unit_id === 'string' ? row.org_unit_id : null,
        entryDate: String(row.entry_date),
        unitsSold: Number(row.units_sold ?? 0),
        revenueMinor: money(row.revenue_minor),
        savingsMinor: money(row.savings_minor),
        expensesMinor: money(row.expenses_minor),
        customerCount: Number(row.customer_count ?? 0),
        repeatCount: Number(row.repeat_count ?? 0),
        currency: typeof row.currency === 'string' ? row.currency : 'INR',
        capabilityTags: coerceTags(row.capability_tags),
        schemeIds: coerceTags(row.scheme_ids),
        evidenceNote: typeof row.evidence_note === 'string' ? row.evidence_note : null,
      }));

      const moneyEntries: LivelihoodMoneyEntry[] = ((moneyRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        ledgerEntryId: typeof row.ledger_entry_id === 'string' ? row.ledger_entry_id : null,
        timelineStepId: typeof row.timeline_step_id === 'string' ? row.timeline_step_id : null,
        haatCalendarId: typeof row.haat_calendar_id === 'string' ? row.haat_calendar_id : null,
        orgUnitId: typeof row.org_unit_id === 'string' ? row.org_unit_id : null,
        entryDate: String(row.entry_date),
        entryKind: moneyKind(row.entry_kind),
        productName: typeof row.product_name === 'string' ? row.product_name : null,
        quantity: num(row.quantity),
        unitLabel: typeof row.unit_label === 'string' ? row.unit_label : null,
        unitPriceMinor: row.unit_price_minor == null ? null : money(row.unit_price_minor),
        amountMinor: money(row.amount_minor),
        paymentChannel: paymentChannel(row.payment_channel),
        currency: typeof row.currency === 'string' ? row.currency : 'INR',
        counterparty: typeof row.counterparty === 'string' ? row.counterparty : null,
        sourceText: typeof row.source_text === 'string' ? row.source_text : null,
        isVoiceParsed: row.is_voice_parsed === true,
      }));

      return { profile, haats, schemes, ledger, moneyEntries };
    },
  });

  const health = useMemo<LivelihoodHealth>(() => {
    const ledger = query.data?.ledger ?? [];
    const moneyEntries = query.data?.moneyEntries ?? [];
    const haats = query.data?.haats ?? [];
    const annualGoalMinor = query.data?.profile?.annualGoalMinor ?? DEFAULT_GOAL_MINOR;
    const hasMoneyEntries = moneyEntries.length > 0;
    const revenueMinor = hasMoneyEntries
      ? moneyEntries.filter((row) => row.entryKind === 'sale').reduce((sum, row) => sum + row.amountMinor, 0)
      : ledger.reduce((sum, row) => sum + row.revenueMinor, 0);
    const expensesMinor = hasMoneyEntries
      ? moneyEntries.filter((row) => row.entryKind === 'expense').reduce((sum, row) => sum + row.amountMinor, 0)
      : ledger.reduce((sum, row) => sum + row.expensesMinor, 0);
    const savingsMinor = hasMoneyEntries
      ? moneyEntries.filter((row) => row.entryKind === 'savings_deposit').reduce((sum, row) => sum + row.amountMinor, 0)
      : ledger.reduce((sum, row) => sum + row.savingsMinor, 0);
    const loanRepaymentMinor = moneyEntries
      .filter((row) => row.entryKind === 'loan_repayment')
      .reduce((sum, row) => sum + row.amountMinor, 0);
    const haatTotals = new Map<string, number>();
    const tags = new Set<string>();
    for (const row of ledger) {
      if (row.haatCalendarId) {
        haatTotals.set(row.haatCalendarId, (haatTotals.get(row.haatCalendarId) ?? 0) + row.revenueMinor);
      }
      row.capabilityTags.forEach((tag) => tags.add(tag));
    }
    for (const row of moneyEntries) {
      if (row.haatCalendarId && row.entryKind === 'sale') {
        haatTotals.set(row.haatCalendarId, (haatTotals.get(row.haatCalendarId) ?? 0) + row.amountMinor);
      }
      if (row.entryKind === 'sale') tags.add('selling');
      if (row.entryKind === 'savings_deposit' || row.entryKind === 'loan_repayment') tags.add('money');
      if (row.paymentChannel === 'upi') tags.add('digital');
    }
    const strongestId = Array.from(haatTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      revenueMinor,
      expensesMinor,
      profitMinor: Math.max(0, revenueMinor - expensesMinor),
      savingsMinor,
      loanRepaymentMinor,
      annualGoalMinor,
      progressPct: annualGoalMinor > 0 ? Math.min(100, Math.round((revenueMinor / annualGoalMinor) * 100)) : 0,
      haatCount: new Set(ledger.map((row) => row.haatCalendarId).filter(Boolean)).size,
      strongestHaatName: haats.find((haat) => haat.id === strongestId)?.name ?? null,
      capabilityStates: {
        sourcing: tags.has('sourcing'),
        quality: tags.has('quality'),
        selling: tags.has('selling'),
        money: tags.has('money'),
        digital: tags.has('digital'),
      },
    };
  }, [query.data]);

  return { ...query, health };
}

export function useLogLivelihoodLedgerEntry(interestId: string | null | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: activePlan } = useActivePlan(interestId ?? null);

  return useMutation({
    mutationFn: async (input: LogLivelihoodEntryInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      const entryDate = input.entryDate ?? new Date().toISOString().slice(0, 10);
      const payload = {
        user_id: user.id,
        timeline_step_id: input.timelineStepId ?? null,
        haat_calendar_id: input.haatCalendarId ?? null,
        org_unit_id: input.orgUnitId ?? null,
        entry_date: entryDate,
        units_sold: Math.max(0, input.unitsSold),
        revenue_minor: Math.max(0, input.revenueMinor),
        savings_minor: Math.max(0, input.savingsMinor ?? 0),
        expenses_minor: Math.max(0, input.expensesMinor ?? 0),
        customer_count: Math.max(0, input.customerCount ?? 0),
        repeat_count: Math.min(Math.max(0, input.repeatCount ?? 0), Math.max(0, input.customerCount ?? 0)),
        currency: input.currency ?? 'INR',
        capability_tags: input.capabilityTags ?? ['selling', 'money'],
        scheme_ids: input.schemeIds ?? [],
        evidence_note: input.evidenceNote ?? null,
        metadata: {
          source_text: input.sourceText ?? null,
          product_name: input.productName ?? null,
          payment_channel: input.paymentChannel ?? 'unknown',
        },
      };

      const { data: inserted, error } = await supabase
        .from('livelihood_ledger_entries')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;

      const ledgerEntryId = String((inserted as { id: string }).id);
      const moneyRows = [
        payload.revenue_minor > 0
          ? {
              user_id: user.id,
              ledger_entry_id: ledgerEntryId,
              timeline_step_id: payload.timeline_step_id,
              haat_calendar_id: payload.haat_calendar_id,
              org_unit_id: payload.org_unit_id,
              entry_date: entryDate,
              entry_kind: 'sale',
              product_name: input.productName ?? 'अचार',
              quantity: payload.units_sold,
              unit_label: input.unitLabel ?? 'जार',
              unit_price_minor:
                input.unitPriceMinor ?? (payload.units_sold > 0 ? Math.round(payload.revenue_minor / payload.units_sold) : null),
              amount_minor: payload.revenue_minor,
              payment_channel: input.paymentChannel ?? 'unknown',
              currency: payload.currency,
              source_text: input.sourceText ?? input.evidenceNote ?? null,
              is_voice_parsed: input.isVoiceParsed === true,
              metadata: {
                customer_count: payload.customer_count,
                repeat_count: payload.repeat_count,
              },
            }
          : null,
        payload.expenses_minor > 0
          ? {
              user_id: user.id,
              ledger_entry_id: ledgerEntryId,
              timeline_step_id: payload.timeline_step_id,
              haat_calendar_id: payload.haat_calendar_id,
              org_unit_id: payload.org_unit_id,
              entry_date: entryDate,
              entry_kind: 'expense',
              product_name: input.productName ?? null,
              quantity: null,
              unit_label: null,
              unit_price_minor: null,
              amount_minor: payload.expenses_minor,
              payment_channel: 'cash',
              currency: payload.currency,
              counterparty: 'haat costs',
              source_text: input.sourceText ?? input.evidenceNote ?? null,
              is_voice_parsed: input.isVoiceParsed === true,
              metadata: {},
            }
          : null,
        payload.savings_minor > 0
          ? {
              user_id: user.id,
              ledger_entry_id: ledgerEntryId,
              timeline_step_id: payload.timeline_step_id,
              haat_calendar_id: payload.haat_calendar_id,
              org_unit_id: payload.org_unit_id,
              entry_date: entryDate,
              entry_kind: 'savings_deposit',
              product_name: null,
              quantity: null,
              unit_label: null,
              unit_price_minor: null,
              amount_minor: payload.savings_minor,
              payment_channel: 'cash',
              currency: payload.currency,
              counterparty: 'SHG savings',
              source_text: input.sourceText ?? input.evidenceNote ?? null,
              is_voice_parsed: input.isVoiceParsed === true,
              metadata: {},
            }
          : null,
        Math.max(0, input.loanRepaymentMinor ?? 0) > 0
          ? {
              user_id: user.id,
              ledger_entry_id: ledgerEntryId,
              timeline_step_id: payload.timeline_step_id,
              haat_calendar_id: payload.haat_calendar_id,
              org_unit_id: payload.org_unit_id,
              entry_date: entryDate,
              entry_kind: 'loan_repayment',
              product_name: null,
              quantity: null,
              unit_label: null,
              unit_price_minor: null,
              amount_minor: Math.max(0, input.loanRepaymentMinor ?? 0),
              payment_channel: 'upi',
              currency: payload.currency,
              counterparty: 'Mudra loan',
              source_text: input.sourceText ?? input.evidenceNote ?? null,
              is_voice_parsed: input.isVoiceParsed === true,
              metadata: {},
            }
          : null,
      ].filter(Boolean);

      if (moneyRows.length > 0) {
        const { error: moneyError } = await supabase.from('livelihood_money_entries').insert(moneyRows);
        if (moneyError) throw moneyError;
      }

      if (activePlan?.id) {
        const weekStart = mondayOf(entryDate);
        const { data: weekRows, error: weekError } = await supabase
          .from('livelihood_money_entries')
          .select('quantity, amount_minor, currency, metadata')
          .eq('user_id', user.id)
          .eq('entry_kind', 'sale')
          .gte('entry_date', weekStart)
          .lt('entry_date', new Date(new Date(`${weekStart}T00:00:00.000Z`).getTime() + 7 * 86400000).toISOString().slice(0, 10));
        if (weekError) throw weekError;

        type WeeklyTotals = {
          units_sold: number;
          revenue_minor: number;
          customer_count: number;
          repeat_count: number;
          currency: string;
        };

        const totals = ((weekRows ?? []) as Record<string, unknown>[]).reduce<WeeklyTotals>(
          (acc, row) => {
            const meta = (row.metadata ?? {}) as Record<string, unknown>;
            acc.units_sold += Number(row.quantity ?? 0);
            acc.revenue_minor += money(row.amount_minor);
            acc.customer_count += Number(meta.customer_count ?? 0);
            acc.repeat_count += Number(meta.repeat_count ?? 0);
            if (typeof row.currency === 'string') acc.currency = row.currency;
            return acc;
          },
          { units_sold: 0, revenue_minor: 0, customer_count: 0, repeat_count: 0, currency: payload.currency },
        );

        const { error: outcomeError } = await supabase.from('business_outcomes').upsert(
          {
            user_id: user.id,
            plan_id: activePlan.id,
            week_start: weekStart,
            units_sold: totals.units_sold,
            revenue_minor: totals.revenue_minor,
            currency: totals.currency,
            customer_count: totals.customer_count,
            repeat_count: Math.min(totals.repeat_count, totals.customer_count),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,plan_id,week_start' },
        );
        if (outcomeError) throw outcomeError;
      }

      return ledgerEntryId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: livelihoodAtlasKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: businessOutcomesKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['business-outcomes'] });
      queryClient.invalidateQueries({ queryKey: ['business-outcomes-headline'] });
    },
  });
}
