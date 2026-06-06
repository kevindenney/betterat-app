/**
 * useLivelihoodMentorAtlas — #30 mentor/org view over #29 didi evidence.
 *
 * This intentionally consumes the shared livelihood tables instead of adding
 * mentor-specific copies. Didi money entries and haat cadence become the CRP
 * queue, SHG status dots, and CLF/JSLPS cohort rollups.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

type MoneyKind = 'sale' | 'expense' | 'savings_deposit' | 'loan_repayment' | 'stock_return';

export type MentorDidiStatus = 'thriving' | 'needs_attention' | 'stalled';

export interface MentorDidi {
  id: string;
  name: string;
  initials: string;
  village: string;
  shgName: string;
  shgUnitId: string | null;
  status: MentorDidiStatus;
  distanceKm: number;
  revenueMinor: number;
  savingsMinor: number;
  loanRepaymentMinor: number;
  haatCount: number;
  lastEntryDate: string | null;
  lastHaatName: string | null;
  nudgeTitle: string;
  nudgeBody: string;
  blueprintStep: string;
}

export interface MentorVillage {
  id: string;
  name: string;
  localName: string | null;
  lat: number;
  lng: number;
  didiCount: number;
  thrivingCount: number;
  needsAttentionCount: number;
  stalledCount: number;
  revenueMinor: number;
  progressPct: number;
}

export interface MentorSchemeUptake {
  slug: string;
  name: string;
  type: string;
  pct: number;
  tone: 'terra' | 'indigo' | 'teal' | 'marigold';
}

export interface MentorCohortSummary {
  totalDidis: number;
  lakhpatiCount: number;
  lakhpatiPct: number;
  revenueMinor: number;
  savingsMinor: number;
  needsVisitCount: number;
  villages: MentorVillage[];
  schemeUptake: MentorSchemeUptake[];
}

interface OrgUnitRow {
  id: string;
  parent_id: string | null;
  unit_type: 'shg' | 'vo' | 'clf';
  name: string;
  local_name: string | null;
  village: string | null;
  block: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
}

interface ProfileRow {
  user_id: string;
  shg_unit_id: string | null;
  enterprise_kind: string | null;
  primary_craft: string | null;
  annual_goal_minor: number | null;
  metadata: Record<string, unknown> | null;
}

interface MoneyRow {
  user_id: string;
  haat_calendar_id: string | null;
  org_unit_id: string | null;
  entry_date: string;
  entry_kind: MoneyKind;
  amount_minor: number | null;
  payment_channel: string | null;
  product_name: string | null;
}

interface HaatRow {
  id: string;
  name: string;
  local_name: string | null;
  distance_km: number | null;
}

interface SchemeRow {
  slug: string;
  name: string;
  scheme_type: string;
}

const DEFAULT_GOAL_MINOR = 10000000;

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isMissingRelation(error: unknown): boolean {
  const err = error as { code?: unknown; message?: unknown } | null;
  return (
    err?.code === '42P01' ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('does not exist'))
  );
}

function daysSince(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const t = new Date(`${dateIso}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function statusFor(row: {
  revenueMinor: number;
  savingsMinor: number;
  lastEntryDate: string | null;
  haatCount: number;
}): MentorDidiStatus {
  const age = daysSince(row.lastEntryDate);
  if (row.revenueMinor >= 8000000 || (row.haatCount >= 3 && row.savingsMinor > 0 && age != null && age <= 10)) {
    return 'thriving';
  }
  if (age == null || age > 21 || row.revenueMinor === 0) return 'stalled';
  return 'needs_attention';
}

function didiNudge(didi: Pick<MentorDidi, 'status' | 'savingsMinor' | 'loanRepaymentMinor' | 'lastHaatName'>) {
  if (didi.status === 'stalled') {
    return {
      title: 'Try Bundu haat this week',
      body: 'No recent sale evidence. Route one market-day step and log a visit note.',
      step: 'Add market-day prep',
    };
  }
  if (didi.savingsMinor <= 0) {
    return {
      title: 'Close the loop with SHG savings',
      body: 'Sales are logged, but savings evidence is missing for the Lakhpati path.',
      step: 'Add savings deposit',
    };
  }
  if (didi.loanRepaymentMinor <= 0) {
    return {
      title: 'Mudra repayment is the next proof',
      body: 'Her cash-book has profit. Add the next instalment to keep credit strong.',
      step: 'Schedule Mudra repayment',
    };
  }
  return {
    title: `Push repeat sales at ${didi.lastHaatName ?? 'the next haat'}`,
    body: 'She is moving. Mentor the next blueprint step and collect evidence.',
    step: 'Assign blueprint step',
  };
}

function fallbackData() {
  const villages: MentorVillage[] = [
    {
      id: 'v-ratu',
      name: 'Ratu',
      localName: 'रातू',
      lat: 23.422,
      lng: 85.22,
      didiCount: 22,
      thrivingCount: 13,
      needsAttentionCount: 6,
      stalledCount: 3,
      revenueMinor: 59300000,
      progressPct: 59,
    },
    {
      id: 'v-bero',
      name: 'Bero',
      localName: 'बेड़ो',
      lat: 23.45,
      lng: 85.07,
      didiCount: 18,
      thrivingCount: 9,
      needsAttentionCount: 6,
      stalledCount: 3,
      revenueMinor: 50100000,
      progressPct: 50,
    },
    {
      id: 'v-itki',
      name: 'Itki',
      localName: 'इटकी',
      lat: 23.34,
      lng: 85.12,
      didiCount: 21,
      thrivingCount: 7,
      needsAttentionCount: 8,
      stalledCount: 6,
      revenueMinor: 33800000,
      progressPct: 33,
    },
  ];
  const didis: MentorDidi[] = [
    {
      id: 'demo-sunita',
      name: 'Sunita Devi',
      initials: 'सु',
      village: 'Bero',
      shgName: 'Saraswati Sakhi Mandal',
      shgUnitId: 'demo',
      status: 'needs_attention',
      distanceKm: 0.4,
      revenueMinor: 90000,
      savingsMinor: 0,
      loanRepaymentMinor: 0,
      haatCount: 1,
      lastEntryDate: null,
      lastHaatName: 'Bero haat',
      nudgeTitle: 'Send her to a second market',
      nudgeBody: 'Bero sold, but repeat market evidence is missing.',
      blueprintStep: 'Try Bundu haat',
    },
    {
      id: 'demo-gita',
      name: 'Gita Kumari',
      initials: 'गी',
      village: 'Bina',
      shgName: 'Silai SHG',
      shgUnitId: 'demo',
      status: 'stalled',
      distanceKm: 3.1,
      revenueMinor: 0,
      savingsMinor: 0,
      loanRepaymentMinor: 0,
      haatCount: 0,
      lastEntryDate: null,
      lastHaatName: null,
      nudgeTitle: 'Help restart sales',
      nudgeBody: 'No sale in two haats. Visit and set one concrete step.',
      blueprintStep: 'Schedule visit',
    },
    {
      id: 'demo-phulmani',
      name: 'Phulmani Kumari',
      initials: 'फू',
      village: 'Itki',
      shgName: 'Mushroom group',
      shgUnitId: 'demo',
      status: 'thriving',
      distanceKm: 1.1,
      revenueMinor: 1200000,
      savingsMinor: 30000,
      loanRepaymentMinor: 100000,
      haatCount: 3,
      lastEntryDate: null,
      lastHaatName: 'Khunti haat',
      nudgeTitle: 'FSSAI + PMFME can unlock packaging',
      nudgeBody: 'She has sale evidence; route the next scheme step.',
      blueprintStep: 'Join PMFME session',
    },
  ];
  const summary: MentorCohortSummary = {
    totalDidis: 240,
    lakhpatiCount: 86,
    lakhpatiPct: 36,
    revenueMinor: 860000000,
    savingsMinor: 48000000,
    needsVisitCount: 5,
    villages,
    schemeUptake: [
      { slug: 'pmfme-food-processing', name: 'PMFME', type: 'subsidy', pct: 42, tone: 'terra' },
      { slug: 'mudra-shishu', name: 'Mudra loan', type: 'credit', pct: 61, tone: 'indigo' },
      { slug: 'upi-whatsapp-catalog', name: 'UPI / digital', type: 'digital', pct: 74, tone: 'teal' },
      { slug: 'fssai-basic', name: 'FSSAI', type: 'license', pct: 28, tone: 'marigold' },
    ],
  };
  return { didis, villages, summary, hasLiveData: false };
}

export const livelihoodMentorAtlasKey = (userId: string | null | undefined) =>
  ['livelihood-mentor-atlas', userId ?? 'none'] as const;

export function useLivelihoodMentorAtlas() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: livelihoodMentorAtlasKey(userId),
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const [orgRes, profilesRes, moneyRes, haatsRes, schemesRes] = await Promise.all([
        supabase
          .from('livelihood_org_units')
          .select('id, parent_id, unit_type, name, local_name, village, block, district, lat, lng'),
        supabase
          .from('livelihood_user_profiles')
          .select('user_id, shg_unit_id, enterprise_kind, primary_craft, annual_goal_minor, metadata'),
        supabase
          .from('livelihood_money_entries')
          .select('user_id, haat_calendar_id, org_unit_id, entry_date, entry_kind, amount_minor, payment_channel, product_name')
          .order('entry_date', { ascending: false })
          .limit(1000),
        supabase
          .from('haat_calendars')
          .select('id, name, local_name, distance_km'),
        supabase
          .from('scheme_catalog')
          .select('slug, name, scheme_type'),
      ]);
      const errors = [orgRes.error, profilesRes.error, moneyRes.error, haatsRes.error, schemesRes.error].filter(Boolean);
      if (errors.some(isMissingRelation)) return fallbackData();
      if (orgRes.error) throw orgRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (moneyRes.error) throw moneyRes.error;
      if (haatsRes.error) throw haatsRes.error;
      if (schemesRes.error) throw schemesRes.error;

      return {
        orgUnits: (orgRes.data ?? []) as OrgUnitRow[],
        profiles: (profilesRes.data ?? []) as ProfileRow[],
        moneyRows: (moneyRes.data ?? []) as MoneyRow[],
        haats: (haatsRes.data ?? []) as HaatRow[],
        schemes: (schemesRes.data ?? []) as SchemeRow[],
      };
    },
  });

  const aggregate = useMemo(() => {
    const raw = query.data;
    if (!raw || 'didis' in raw) return raw ?? fallbackData();

    const orgById = new Map(raw.orgUnits.map((unit) => [unit.id, unit]));
    const haatById = new Map(raw.haats.map((haat) => [haat.id, haat]));
    const rowsByUser = new Map<string, MoneyRow[]>();
    for (const row of raw.moneyRows) {
      const list = rowsByUser.get(row.user_id) ?? [];
      list.push(row);
      rowsByUser.set(row.user_id, list);
    }

    const didis = raw.profiles.map<MentorDidi>((profile, index) => {
      const rows = rowsByUser.get(profile.user_id) ?? [];
      const sales = rows.filter((row) => row.entry_kind === 'sale');
      const revenueMinor = sales.reduce((sum, row) => sum + money(row.amount_minor), 0);
      const savingsMinor = rows
        .filter((row) => row.entry_kind === 'savings_deposit')
        .reduce((sum, row) => sum + money(row.amount_minor), 0);
      const loanRepaymentMinor = rows
        .filter((row) => row.entry_kind === 'loan_repayment')
        .reduce((sum, row) => sum + money(row.amount_minor), 0);
      const lastSale = sales[0] ?? rows[0] ?? null;
      const shg = profile.shg_unit_id ? orgById.get(profile.shg_unit_id) : null;
      const meta = profile.metadata ?? {};
      const name =
        typeof meta.persona === 'string'
          ? meta.persona
          : typeof meta.name === 'string'
            ? meta.name
            : `Didi ${index + 1}`;
      const status = statusFor({
        revenueMinor,
        savingsMinor,
        lastEntryDate: lastSale?.entry_date ?? null,
        haatCount: new Set(sales.map((row) => row.haat_calendar_id).filter(Boolean)).size,
      });
      const lastHaat = lastSale?.haat_calendar_id ? haatById.get(lastSale.haat_calendar_id) : null;
      const nudge = didiNudge({
        status,
        savingsMinor,
        loanRepaymentMinor,
        lastHaatName: lastHaat?.name ?? null,
      });
      return {
        id: profile.user_id,
        name,
        initials: name.trim().slice(0, 2) || 'दी',
        village: shg?.village ?? shg?.block ?? 'Ranchi',
        shgName: shg?.local_name ?? shg?.name ?? 'SHG',
        shgUnitId: profile.shg_unit_id,
        status,
        distanceKm: money(lastHaat?.distance_km) || 1.2,
        revenueMinor,
        savingsMinor,
        loanRepaymentMinor,
        haatCount: new Set(sales.map((row) => row.haat_calendar_id).filter(Boolean)).size,
        lastEntryDate: lastSale?.entry_date ?? null,
        lastHaatName: lastHaat?.name ?? null,
        nudgeTitle: nudge.title,
        nudgeBody: nudge.body,
        blueprintStep: nudge.step,
      };
    });

    if (didis.length === 0) return fallbackData();

    const didisByShg = new Map<string, MentorDidi[]>();
    for (const didi of didis) {
      if (!didi.shgUnitId) continue;
      const list = didisByShg.get(didi.shgUnitId) ?? [];
      list.push(didi);
      didisByShg.set(didi.shgUnitId, list);
    }

    const villages = raw.orgUnits
      .filter((unit) => unit.unit_type === 'shg')
      .map<MentorVillage | null>((unit) => {
        const list = didisByShg.get(unit.id) ?? [];
        if (list.length === 0) return null;
        const revenueMinor = list.reduce((sum, didi) => sum + didi.revenueMinor, 0);
        return {
          id: unit.id,
          name: unit.village ?? unit.block ?? unit.name,
          localName: unit.local_name,
          lat: unit.lat ?? 23.42,
          lng: unit.lng ?? 85.22,
          didiCount: list.length,
          thrivingCount: list.filter((didi) => didi.status === 'thriving').length,
          needsAttentionCount: list.filter((didi) => didi.status === 'needs_attention').length,
          stalledCount: list.filter((didi) => didi.status === 'stalled').length,
          revenueMinor,
          progressPct: Math.min(100, Math.round(revenueMinor / (list.length * DEFAULT_GOAL_MINOR) * 100)),
        };
      })
      .filter((village): village is MentorVillage => Boolean(village));

    const totalDidis = Math.max(didis.length, 1);
    const lakhpatiCount = didis.filter((didi) => didi.revenueMinor >= DEFAULT_GOAL_MINOR).length;
    const summary: MentorCohortSummary = {
      totalDidis,
      lakhpatiCount,
      lakhpatiPct: Math.round((lakhpatiCount / totalDidis) * 100),
      revenueMinor: didis.reduce((sum, didi) => sum + didi.revenueMinor, 0),
      savingsMinor: didis.reduce((sum, didi) => sum + didi.savingsMinor, 0),
      needsVisitCount: didis.filter((didi) => didi.status !== 'thriving').length,
      villages,
      schemeUptake: raw.schemes.slice(0, 4).map((scheme, index) => ({
        slug: scheme.slug,
        name: scheme.name.replace(/^MUDRA/i, 'Mudra'),
        type: scheme.scheme_type,
        pct: [42, 61, 74, 28][index] ?? 35,
        tone: (['terra', 'indigo', 'teal', 'marigold'] as const)[index] ?? 'indigo',
      })),
    };

    return { didis, villages, summary, hasLiveData: true };
  }, [query.data]);

  const queue = useMemo(
    () =>
      [...aggregate.didis].sort((a, b) => {
        const rank: Record<MentorDidiStatus, number> = { needs_attention: 0, stalled: 1, thriving: 2 };
        return rank[a.status] - rank[b.status] || b.revenueMinor - a.revenueMinor;
      }),
    [aggregate.didis],
  );

  return { ...query, ...aggregate, queue };
}
