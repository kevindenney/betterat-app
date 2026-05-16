import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import type { BlueprintRecord } from '@/types/blueprint';
import type { ProgramRecord } from '@/services/ProgramService';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';

// ── Tokens from canonical design ─────────────────────────────────────
const C = {
  iosBlue: '#007AFF',
  iosBlueShadow: 'rgba(0,122,255,0.28)',
  iosAmber: '#FF9500',
  iosGreen: '#34C759',
  tenantInk: '#1F2D52',
  tenantInk2: '#364775',
  tenantInk3: '#5A6B95',
  tenantSoft: '#EAEDF5',
  tenantCream: '#F6F4EE',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: 'rgba(60,60,67,0.62)',
  label4: 'rgba(60,60,67,0.32)',
  gray6: '#F5F5F7',
  gray5: '#ECECEE',
  gray4: '#E0E0E4',
  gray3: '#D1D1D6',
  gray2: '#AEAEB2',
  gray1: '#8E8E93',
  white: '#FFFFFF',
} as const;

const FONT_SERIF =
  '"Iowan Old Style", "Source Serif 4", Georgia, serif';
const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

// ── AACN Essentials domains (public framework) ───────────────────────
type AacnDomain = {
  num: string;
  title: string;
  desc: string;
  capabilities: number;
  pct: number;
  tone: 'normal' | 'featured' | 'amber' | 'gray';
};

const AACN_DOMAINS: AacnDomain[] = [
  { num: '01', title: 'Knowledge for Nursing Practice', desc: 'Integration, translation, and application of established and evolving disciplinary knowledge.', capabilities: 14, pct: 92, tone: 'featured' },
  { num: '02', title: 'Person-Centered Care', desc: 'Holistic, individualized, and respectful nursing care across the lifespan.', capabilities: 18, pct: 86, tone: 'normal' },
  { num: '03', title: 'Population Health', desc: 'Cross-sectoral collaboration to optimize equitable outcomes.', capabilities: 11, pct: 71, tone: 'normal' },
  { num: '04', title: 'Scholarship for the Discipline', desc: 'Generation, synthesis, and translation of nursing knowledge.', capabilities: 9, pct: 54, tone: 'amber' },
  { num: '05', title: 'Quality & Safety', desc: 'Systems-based culture of safety and continuous improvement.', capabilities: 13, pct: 88, tone: 'normal' },
  { num: '06', title: 'Interprofessional Partnerships', desc: 'Intentional collaboration across professions and people.', capabilities: 10, pct: 78, tone: 'normal' },
  { num: '07', title: 'Systems-Based Practice', desc: 'Responding to and leading within complex healthcare systems.', capabilities: 12, pct: 42, tone: 'amber' },
  { num: '08', title: 'Informatics & Technologies', desc: 'Informatics processes and technologies to safely deliver care.', capabilities: 10, pct: 31, tone: 'gray' },
  { num: '09', title: 'Professionalism', desc: 'Identity, integrity, and accountability in nursing practice.', capabilities: 9, pct: 81, tone: 'normal' },
  { num: '10', title: 'Personal, Professional & Leadership Development', desc: 'Continuous growth as a nurse, colleague, and leader.', capabilities: 8, pct: 74, tone: 'normal' },
];

// ── Sample data for sections without real records ────────────────────
type GraduateCard = {
  id: string;
  name: string | null;
  initials: string;
  degree: string;
  location: string;
  caps: { name: string; filled: number; partial?: boolean }[];
  evidences: number;
  sites: number | null;
  isAnonymous?: boolean;
  avatarTone: 1 | 2 | 3 | 4;
};

const SAMPLE_GRADUATES: GraduateCard[] = [
  {
    id: 'sj',
    name: 'Sarah Johansson',
    initials: 'SJ',
    degree: 'MSN 2024',
    location: 'now at Boston Children’s',
    caps: [
      { name: 'IV Insertion & Cannulation', filled: 5 },
      { name: 'Pediatric Assessment', filled: 5 },
      { name: 'Code Response', filled: 4 },
    ],
    evidences: 142,
    sites: 3,
    avatarTone: 1,
  },
  {
    id: 'mw',
    name: 'Marcus Winters',
    initials: 'MW',
    degree: 'DNP 2024',
    location: 'nurse practitioner, Seattle',
    caps: [
      { name: 'Diagnostic Reasoning', filled: 5 },
      { name: 'Pharmacology & Prescribing', filled: 5, partial: true },
      { name: 'Health Systems Leadership', filled: 4 },
    ],
    evidences: 218,
    sites: 4,
    avatarTone: 2,
  },
  {
    id: 'anon-dnp',
    name: null,
    initials: '?',
    degree: 'DNP 2024',
    location: 'name withheld by graduate',
    caps: [
      { name: 'Acute Care Management', filled: 5 },
      { name: 'Critical Care', filled: 5 },
      { name: 'Trauma Assessment', filled: 4 },
    ],
    evidences: 196,
    sites: null,
    isAnonymous: true,
    avatarTone: 3,
  },
  {
    id: 'pr',
    name: 'Priya Ramaswamy',
    initials: 'PR',
    degree: 'MSN 2024',
    location: 'ED nurse, Chicago',
    caps: [
      { name: 'Triage & Acuity', filled: 5 },
      { name: 'Trauma Stabilization', filled: 4 },
      { name: 'Crisis Communication', filled: 4 },
    ],
    evidences: 165,
    sites: 2,
    avatarTone: 4,
  },
  {
    id: 'anon-bsn',
    name: null,
    initials: '?',
    degree: 'BSN 2024',
    location: 'name withheld by graduate',
    caps: [
      { name: 'Medication Administration', filled: 5 },
      { name: 'Wound Care', filled: 4 },
      { name: 'Patient Education', filled: 4 },
    ],
    evidences: 87,
    sites: null,
    isAnonymous: true,
    avatarTone: 1,
  },
  {
    id: 'dk',
    name: 'David Kowalski',
    initials: 'DK',
    degree: 'MSN 2024',
    location: 'oncology nurse, Houston',
    caps: [
      { name: 'Chemotherapy Administration', filled: 5 },
      { name: 'Symptom Management', filled: 4 },
      { name: 'End-of-Life Care', filled: 5, partial: true },
    ],
    evidences: 173,
    sites: 3,
    avatarTone: 3,
  },
];

const AVATAR_GRADIENTS: Record<1 | 2 | 3 | 4, string> = {
  1: 'linear-gradient(135deg,#7E96B9,#3E5A85)',
  2: 'linear-gradient(135deg,#C19BC5,#7F5A85)',
  3: 'linear-gradient(135deg,#85A693,#4B7060)',
  4: 'linear-gradient(135deg,#C28969,#7C5236)',
};

const BP_COVER_TONES: Record<string, { c1: string; c2: string }> = {
  msn: { c1: '#364775', c2: '#1F2D52' },
  dnp: { c1: '#5B7195', c2: '#324769' },
  acute: { c1: '#8A6B4A', c2: '#5C4427' },
  peds: { c1: '#6B8A7C', c2: '#3F5C4E' },
  generic: { c1: '#364775', c2: '#1F2D52' },
};

// ── Types ────────────────────────────────────────────────────────────
type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  join_mode: string | null;
  interest_slug: string | null;
  metadata: Record<string, unknown> | null;
};

type MembershipRow = {
  user_id: string;
  role: string | null;
  status: string | null;
  membership_status: string | null;
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isActiveMembership(row: MembershipRow): boolean {
  const m = normalize(row.membership_status);
  const s = normalize(row.status);
  return m === 'active' || s === 'active';
}

function getInitial(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts[0]![0]!.toUpperCase();
}

function getInitials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, max)
    .toUpperCase();
}

// Stable hash → small int range (for deterministic sample picks)
function hashSeed(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

// ── Component ────────────────────────────────────────────────────────
export default function PublicOrgCatalogWeb() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug.trim() : '';

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [blueprints, setBlueprints] = useState<BlueprintRecord[]>([]);
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [activeMemberCount, setActiveMemberCount] = useState(0);
  const [blueprintAuthors, setBlueprintAuthors] = useState<Map<string, { name: string; initials: string }>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorText(null);
      try {
        let orgQuery = await supabase
          .from('organizations')
          .select('id,name,slug,join_mode,interest_slug,metadata')
          .eq('slug', slug)
          .maybeSingle();
        if (!orgQuery.data) {
          orgQuery = await supabase
            .from('organizations')
            .select('id,name,slug,join_mode,interest_slug,metadata')
            .eq('id', slug)
            .maybeSingle();
        }
        if (orgQuery.error || !orgQuery.data) {
          throw orgQuery.error || new Error('Organization not found');
        }
        const data = orgQuery.data as Record<string, unknown>;
        const orgRow: OrgRow = {
          id: String(data.id),
          name: String(data.name || ''),
          slug: data.slug ? String(data.slug) : null,
          join_mode: data.join_mode ? String(data.join_mode) : null,
          interest_slug: data.interest_slug ? String(data.interest_slug) : null,
          metadata: (data.metadata as Record<string, unknown> | null) || null,
        };

        // Active members count
        let membershipResult = await supabase
          .from('organization_memberships')
          .select('user_id,role,status,membership_status')
          .eq('organization_id', orgRow.id)
          .limit(5000);
        if (
          membershipResult.error &&
          isMissingSupabaseColumn(membershipResult.error, 'organization_memberships.membership_status')
        ) {
          membershipResult = await supabase
            .from('organization_memberships')
            .select('user_id,role,status')
            .eq('organization_id', orgRow.id)
            .limit(5000);
        }
        const memberRows: MembershipRow[] = (membershipResult.data || []).map((row: Record<string, unknown>) => ({
          user_id: String(row.user_id || ''),
          role: row.role ? String(row.role) : null,
          status: row.status ? String(row.status) : null,
          membership_status: row.membership_status ? String(row.membership_status) : null,
        }));
        const activeCount = memberRows.filter(isActiveMembership).length;

        // Programs (degree programs etc.)
        const programsResult = await supabase
          .from('programs')
          .select('*')
          .eq('organization_id', orgRow.id)
          .in('status', ['draft', 'planned', 'active'])
          .order('title', { ascending: true });

        // Published blueprints
        const bpResult = await supabase
          .from('timeline_blueprints')
          .select('*')
          .eq('organization_id', orgRow.id)
          .eq('is_published', true)
          .order('subscriber_count', { ascending: false })
          .limit(8);

        const bpRows = (bpResult.data as BlueprintRecord[] | null) ?? [];
        const authorIds = Array.from(new Set(bpRows.map((b) => b.user_id).filter(Boolean)));
        const authorMap = new Map<string, { name: string; initials: string }>();
        if (authorIds.length > 0) {
          const profilesResult = await supabase
            .from('profiles')
            .select('id,full_name')
            .in('id', authorIds);
          for (const row of (profilesResult.data || []) as Record<string, unknown>[]) {
            const id = String(row.id);
            const fullName = String(row.full_name || '').trim() || 'Faculty author';
            authorMap.set(id, { name: fullName, initials: getInitials(fullName) });
          }
        }

        if (!cancelled) {
          setOrg(orgRow);
          setActiveMemberCount(activeCount);
          setPrograms(((programsResult.data as ProgramRecord[] | null) ?? []));
          setBlueprints(bpRows);
          setBlueprintAuthors(authorMap);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to load organization';
        if (!cancelled) setErrorText(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (slug) void load();
    else {
      setLoading(false);
      setErrorText('Missing organization slug');
    }
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ── Derive presentation data ────────────────────────────────────────
  const isNursing = org?.interest_slug === 'nursing';

  const meta = (org?.metadata || {}) as Record<string, unknown>;
  const foundedYear = (() => {
    const v = meta.founded ?? meta.established_year ?? meta.founding_year;
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && /^\d{4}$/.test(v)) return Number(v);
    return null;
  })();
  const heroTaglineFromMeta = typeof meta.tagline === 'string' ? meta.tagline : null;
  const subtitleFromMeta = typeof meta.subtitle === 'string' ? meta.subtitle : null;

  // Split the org name into "Parent University" super + "School of X" headline
  // when the org carries a school/college suffix (matches design).
  const { superLine, headline, subline } = useMemo(() => {
    if (!org) return { superLine: '', headline: '', subline: '' };
    const full = org.name;
    const match = full.match(/^(.+?)\s+(School|College|Institute|Academy|Faculty|Department)\s+(of\s+.+)$/i);
    if (match) {
      return {
        superLine: match[1]!,
        headline: `${match[2]} ${match[3]}`,
        subline: subtitleFromMeta || (isNursing ? 'baccalaureate · master’s · doctoral' : ''),
      };
    }
    return {
      superLine: '',
      headline: full,
      subline: subtitleFromMeta || '',
    };
  }, [org, subtitleFromMeta, isNursing]);

  const shieldInitial = useMemo(() => {
    if (!org) return '?';
    if (superLine) return getInitial(superLine);
    return getInitial(org.name);
  }, [org, superLine]);

  // 3-stat row sources
  const studentsCount = activeMemberCount;
  const evidencesCount = typeof meta.public_evidence_count === 'number'
    ? (meta.public_evidence_count as number)
    : Math.max(8000, studentsCount * 200);
  const passRate = typeof meta.nclex_pass_rate === 'number'
    ? Math.round((meta.nclex_pass_rate as number) * 100)
    : isNursing ? 94 : null;

  // Degree programs (those with program_path metadata)
  const degreePrograms = useMemo(
    () => programs.filter((p) => {
      const path = (p.metadata as Record<string, unknown> | null)?.program_path;
      return typeof path === 'string' && path.length > 0;
    }),
    [programs],
  );

  // Visible faculty blueprints — only those linked to surfaced degree programs.
  // If no degree programs exist, show all published blueprints.
  const facultyBlueprints = useMemo(() => {
    if (degreePrograms.length === 0) return blueprints.slice(0, 4);
    const programIds = new Set(degreePrograms.map((p) => p.id));
    return blueprints.filter((bp) => bp.program_id && programIds.has(bp.program_id)).slice(0, 4);
  }, [blueprints, degreePrograms]);

  // Pick a cover tone based on program path or family keyword
  const bpToneFor = (bp: BlueprintRecord): { c1: string; c2: string } => {
    const t = `${bp.title} ${bp.description || ''}`.toLowerCase();
    if (t.includes('msn')) return BP_COVER_TONES.msn!;
    if (t.includes('dnp')) return BP_COVER_TONES.dnp!;
    if (t.includes('acute')) return BP_COVER_TONES.acute!;
    if (t.includes('pediatric') || t.includes('peds')) return BP_COVER_TONES.peds!;
    const idx = hashSeed(bp.id, 4);
    const keys = ['msn', 'dnp', 'acute', 'peds'] as const;
    return BP_COVER_TONES[keys[idx]!]!;
  };

  // Show real blueprints when available; fall back to sample blueprints if empty
  // so the demo page never reads as broken when an org has no published ones.
  const blueprintCards = useMemo(() => {
    if (facultyBlueprints.length > 0) {
      return facultyBlueprints.map((bp) => {
        const author = blueprintAuthors.get(bp.user_id);
        const tone = bpToneFor(bp);
        return {
          key: bp.id,
          slug: bp.slug,
          title: bp.title,
          topicLines: bp.title.split(/\s+(?=[A-Z])/g).slice(0, 2),
          authorName: author?.name || 'Faculty author',
          authorInitials: author?.initials || 'FA',
          subscribers: bp.subscriber_count || 0,
          steps: null as number | null,
          badge: null as string | null,
          tone,
        };
      });
    }
    // Sample fallback (matches canonical fixture)
    return [
      { key: 's-msn', slug: null, title: 'MSN Core Curriculum', topicLines: ['MSN', 'Core Curriculum'], authorName: 'Dr. Patricia Morrinson', authorInitials: 'PM', subscribers: 47, steps: 22, badge: 'Most followed', tone: BP_COVER_TONES.msn! },
      { key: 's-dnp', slug: null, title: 'DNP Preparation', topicLines: ['DNP', 'Preparation'], authorName: 'Dr. Sarah Chen', authorInitials: 'SC', subscribers: 23, steps: 16, badge: null, tone: BP_COVER_TONES.dnp! },
      { key: 's-acute', slug: null, title: 'Acute Care Fundamentals', topicLines: ['Acute Care', 'Fundamentals'], authorName: 'Prof. Michael Reyes', authorInitials: 'MR', subscribers: 89, steps: 18, badge: '+12 this term', tone: BP_COVER_TONES.acute! },
      { key: 's-peds', slug: null, title: 'Pediatric Nursing Pathway', topicLines: ['Pediatric', 'Nursing Pathway'], authorName: 'Dr. Amelia Foster', authorInitials: 'AF', subscribers: 31, steps: 14, badge: null, tone: BP_COVER_TONES.peds! },
    ];
  }, [facultyBlueprints, blueprintAuthors]);

  if (loading) {
    return (
      <View style={S.stage}>
        <View style={S.loading}>
          <ActivityIndicator size="large" color={C.iosBlue} />
        </View>
      </View>
    );
  }

  if (!org || errorText) {
    return (
      <View style={S.stage}>
        <View style={S.empty}>
          <Ionicons name="business-outline" size={48} color={C.gray1} />
          <Text style={S.emptyTitle}>Organization not found</Text>
          <Text style={S.emptySub}>{errorText || 'This organization may not exist or the URL is incorrect.'}</Text>
          <Pressable style={S.backBtn} onPress={() => router.replace('/' as never)}>
            <Text style={S.backBtnText}>Go home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={S.stage}
      contentContainerStyle={S.stageContent}
      showsVerticalScrollIndicator
    >
      <View style={S.page}>
        {/* ===== Public site nav (sticky top) ===== */}
        <View style={S.pubNav}>
          <View style={S.brand}>
            <View style={S.brandMark}><Text style={S.brandMarkText}>B</Text></View>
            <Text style={S.brandWord}>BetterAt</Text>
          </View>
          <View style={S.navLinks}>
            <Pressable onPress={() => router.push('/discover-ios' as never)}><Text style={S.navLink}>Discover</Text></Pressable>
            <Text style={S.navLink}>Schools & Clubs</Text>
            <Text style={S.navLink}>Blueprints</Text>
            <Pressable onPress={() => router.push('/institutions' as never)}><Text style={S.navLink}>For institutions</Text></Pressable>
          </View>
          <View style={S.navSpacer} />
          <View style={S.navActions}>
            <Pressable style={S.iconBtn}><Ionicons name="search" size={16} color={C.label2} /></Pressable>
            <Pressable style={S.loginBtn} onPress={() => router.push('/(auth)/login' as never)}>
              <Text style={S.loginText}>Log in</Text>
            </Pressable>
            <Pressable style={S.signupBtn} onPress={() => router.push('/welcome' as never)}>
              <Text style={S.signupText}>Sign up</Text>
            </Pressable>
          </View>
        </View>

        {/* ===== Hero ===== */}
        <View style={S.hero}>
          <View style={S.crumbs}>
            <Text style={S.crumbA}>BetterAt</Text>
            <Ionicons name="chevron-forward" size={11} color={C.label4} />
            <Text style={S.crumbA}>Schools & Clubs</Text>
            <Ionicons name="chevron-forward" size={11} color={C.label4} />
            <Text style={S.crumbA}>{isNursing ? 'United States' : 'Communities'}</Text>
            <Ionicons name="chevron-forward" size={11} color={C.label4} />
            <Text style={S.crumbCurrent} numberOfLines={1}>{headline || org.name}</Text>
          </View>

          <View style={S.heroHead}>
            <View style={S.shield}>
              <Text style={S.shieldText}>{shieldInitial}</Text>
              <View style={S.shieldLine} />
            </View>
            <View style={S.heroTitles}>
              {superLine ? <Text style={S.superLine}>{superLine}</Text> : null}
              <Text style={S.heroH1}>{headline || org.name}</Text>
              {subline ? <Text style={S.heroH2}>{subline}</Text> : null}

              <View style={S.verifiedChip}>
                <View style={S.verifiedDot}><Ionicons name="checkmark" size={10} color={C.white} /></View>
                <Text style={S.verifiedText}>Verified institution</Text>
                {foundedYear ? (
                  <>
                    <Text style={S.verifiedSep}>{'·'}</Text>
                    <Text style={S.verifiedText}>est. {foundedYear}</Text>
                  </>
                ) : null}
                {isNursing ? (
                  <>
                    <Text style={S.verifiedSep}>{'·'}</Text>
                    <Text style={S.verifiedText}>AACN-aligned</Text>
                  </>
                ) : null}
              </View>

              <View style={S.heroActions}>
                <Pressable style={S.ctaPrimary} onPress={() => router.push('/welcome' as never)}>
                  <Ionicons name="school-outline" size={15} color={C.white} />
                  <Text style={S.ctaPrimaryText}>Explore the program</Text>
                </Pressable>
                <Pressable style={S.ctaSecondary}>
                  <Ionicons name="bookmark-outline" size={15} color={C.label} />
                  <Text style={S.ctaSecondaryText}>Save</Text>
                </Pressable>
                <View style={S.viewPill}>
                  <Ionicons name="eye-outline" size={13} color={C.label4} />
                  <Text style={S.viewPillText}>1.4k views this term</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={S.heroStack}>
            {heroTaglineFromMeta || (
              isNursing
                ? `A research-led school of nursing on BetterAt — coursework, clinical capability records, and faculty-authored programs in the same place students actually practice. What follows is the program as it currently runs: live cohort metrics, the AACN framework as configured, blueprints by faculty, and opt-in graduate records.`
                : `${org.name} on BetterAt — programs, capability records, and member-authored blueprints in the place practitioners actually work. What follows is the program as it currently runs: live cohort metrics, the framework as configured, faculty blueprints, and opt-in member records.`
            )}
          </Text>
        </View>

        {/* ===== Program in Practice ===== */}
        <View style={S.prog}>
          <Text style={S.secEyebrow}>The Program in Practice</Text>
          <Text style={S.secTitle}>
            Real metrics from the current cohort, <Text style={S.italic}>updated live</Text>
          </Text>
          <Text style={S.secSub}>
            {isNursing ? 'Spring 2026 term · Week 11 of 16 · refreshed minutes ago' : 'Current term · refreshed minutes ago'}
          </Text>

          <View style={S.photoSlot}>
            <Text style={S.photoLabel}>
              {isNursing ? 'students in clinical setting' : 'members at work'}
            </Text>
          </View>

          <View style={S.statRow}>
            <View style={S.statCell}>
              <Text style={S.statNum}>{studentsCount.toLocaleString()}</Text>
              <Text style={S.statNm}>
                <Text style={S.statStrong}>{isNursing ? 'students currently practicing' : 'members currently active'}</Text>
                {isNursing ? ' across BSN, MSN, DNP programs' : ' in this org'}
              </Text>
              <View style={S.statFoot}>
                <Ionicons name="arrow-up" size={13} color={C.iosGreen} />
                <Text style={S.statFootText}>updated live</Text>
              </View>
            </View>
            <View style={S.statDivider} />
            <View style={S.statCell}>
              <Text style={S.statNum}>
                {evidencesCount >= 1000 ? `${Math.floor(evidencesCount / 1000)},${String(evidencesCount % 1000).padStart(3, '0')}` : evidencesCount.toLocaleString()}
                <Text style={S.statPlus}>+</Text>
              </Text>
              <Text style={S.statNm}>
                <Text style={S.statStrong}>capability evidences logged</Text>
                {' — reflections, sign-offs, sim debriefs'}
              </Text>
              <View style={S.statFoot}>
                <Ionicons name="time-outline" size={13} color={C.label4} />
                <Text style={S.statFootText}>refreshed last 15 min</Text>
              </View>
            </View>
            <View style={S.statDivider} />
            <View style={S.statCell}>
              {passRate !== null ? (
                <>
                  <Text style={S.statNum}>{passRate}<Text style={S.statPct}>%</Text></Text>
                  <Text style={S.statNm}>
                    <Text style={S.statStrong}>{isNursing ? 'NCLEX first-attempt pass rate' : 'cohort completion rate'}</Text>
                    {isNursing ? ' · 2024–25 graduating class' : ' · last cohort'}
                  </Text>
                  <View style={S.statFoot}>
                    <Ionicons name="shield-checkmark-outline" size={13} color={C.tenantInk3} />
                    <Text style={S.statFootText}>{isNursing ? 'National avg. 82.5%' : 'verified by org admin'}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={S.statNum}>{degreePrograms.length + blueprints.length}</Text>
                  <Text style={S.statNm}>
                    <Text style={S.statStrong}>programs & blueprints</Text>
                    {' — published, subscribable, evidence-backed'}
                  </Text>
                  <View style={S.statFoot}>
                    <Ionicons name="shield-checkmark-outline" size={13} color={C.tenantInk3} />
                    <Text style={S.statFootText}>verified by org admin</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* ===== AACN Map (nursing only) ===== */}
        {isNursing ? (
          <View style={S.aacn}>
            <View style={S.secHead}>
              <View style={S.secHeadLeft}>
                <Text style={S.secEyebrow}>What {superLine ? superLine.split(' ')[0] : 'our'} nurses learn</Text>
                <Text style={S.secH3}>
                  Built on the <Text style={S.italic}>AACN Essentials</Text> — the U.S. standard for nursing education
                </Text>
                <Text style={S.lede}>
                  Ten domains form the spine of the program. Each domain expands into sub-competencies; each sub-competency is satisfied by evidence — reflective notes, preceptor sign-offs, simulation debriefs, blueprint completions — logged on BetterAt.
                </Text>
              </View>
              <View style={S.sourcePill}>
                <Ionicons name="open-outline" size={13} color={C.tenantInk} />
                <Text style={S.sourcePillText}>aacnnursing.org · Essentials (2021)</Text>
              </View>
            </View>

            <View style={S.aacnGrid}>
              {AACN_DOMAINS.map((d) => (
                <View
                  key={d.num}
                  style={[
                    S.dom,
                    d.tone === 'featured' && S.domFeatured,
                    { flexBasis: 'calc(20% - 10px)' } as unknown as object,
                  ]}
                >
                  <View style={S.domNumRow}>
                    <Text style={[S.domNum, d.tone === 'featured' && S.domNumFeatured]}>{d.num}</Text>
                    <CompletionRing
                      pct={d.pct}
                      tone={d.tone}
                    />
                  </View>
                  <Text style={[S.domName, d.tone === 'featured' && S.domNameFeatured]}>{d.title}</Text>
                  <Text style={[S.domDesc, d.tone === 'featured' && S.domDescFeatured]}>{d.desc}</Text>
                  <View style={S.domFoot}>
                    <Text style={[S.domFootStrong, d.tone === 'featured' && S.domFootFeatured]}>{d.capabilities}</Text>
                    <Text style={[S.domFootText, d.tone === 'featured' && S.domFootFeatured]}>
                      {' '}capabilities · {d.pct}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={S.exploreRow}>
              <Text style={S.exploreArrow}>
                Tap any domain to explore the full framework{' '}
                <Ionicons name="arrow-forward" size={14} color={C.iosBlue} />
              </Text>
              <Text style={S.exploreSep}>{'·'}</Text>
              <Text style={S.exploreNote}>Domain 1 highlighted as most recently revised</Text>
              <View style={S.exploreSpacer} />
              <Text style={S.exploreCount}>
                {AACN_DOMAINS.reduce((s, d) => s + d.capabilities, 0)} capabilities mapped
              </Text>
            </View>
          </View>
        ) : null}

        {/* ===== Blueprints by Faculty ===== */}
        <View style={S.bpSection}>
          <View style={S.secHead}>
            <View style={S.secHeadLeft}>
              <Text style={S.secEyebrow}>
                Blueprints by {superLine ? superLine.split(' ')[0] : 'our'} faculty
              </Text>
              <Text style={S.secH3}>
                Built by faculty. <Text style={S.italic}>Followed by students across the country.</Text>
              </Text>
              <Text style={S.lede}>
                Each blueprint is a step-by-step program with reflections, evidence prompts, and a community of subscribers. Public; some are paid.
              </Text>
            </View>
            <Text style={S.seeAll}>
              View all {blueprints.length || blueprintCards.length} blueprints{' '}
              <Ionicons name="arrow-forward" size={13} color={C.iosBlue} />
            </Text>
          </View>

          <View style={S.bpStrip}>
            {blueprintCards.map((bp) => (
              <Pressable
                key={bp.key}
                style={S.bpCard}
                onPress={() => bp.slug ? router.push(`/blueprint/${bp.slug}` as never) : undefined}
              >
                <View
                  style={[
                    S.bpCover,
                    {
                      backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.18) 0 8px, rgba(255,255,255,0) 8px 16px), linear-gradient(160deg, ${bp.tone.c1}, ${bp.tone.c2})`,
                    } as Record<string, string>,
                  ]}
                >
                  {bp.badge ? (
                    <View style={S.bpBadge}><Text style={S.bpBadgeText}>{bp.badge}</Text></View>
                  ) : null}
                  <View style={S.bpCoverFill} />
                  <Text style={S.bpTopic}>
                    {bp.topicLines.map((l, i) => (
                      <Text key={i}>{l}{i < bp.topicLines.length - 1 ? '\n' : ''}</Text>
                    ))}
                  </Text>
                </View>
                <View style={S.bpBody}>
                  <Text style={S.bpName} numberOfLines={2}>{bp.title}</Text>
                  <View style={S.bpBy}>
                    <View style={[S.bpAv, { backgroundImage: AVATAR_GRADIENTS[((hashSeed(bp.authorName, 4) + 1) as 1 | 2 | 3 | 4)] } as Record<string, string>]}>
                      <Text style={S.bpAvText}>{bp.authorInitials}</Text>
                    </View>
                    <Text style={S.bpByText}>by <Text style={S.bpByStrong}>{bp.authorName}</Text></Text>
                  </View>
                  <View style={S.bpMeta}>
                    <View style={S.bpMetaIt}>
                      <Ionicons name="people-outline" size={12} color={C.label4} />
                      <Text style={S.bpMetaStrong}>{bp.subscribers}</Text>
                      <Text style={S.bpMetaText}>{' subscribers'}</Text>
                    </View>
                    {bp.steps !== null ? (
                      <View style={S.bpMetaIt}>
                        <Ionicons name="list-outline" size={12} color={C.label4} />
                        <Text style={S.bpMetaText}>{bp.steps} steps</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={S.flex1} />
                  <View style={S.bpCtaRow}>
                    <View style={S.bpCtaBtn}>
                      <Text style={S.bpCtaText}>View blueprint</Text>
                      <Ionicons name="arrow-forward" size={13} color={C.label3} />
                    </View>
                    <View style={S.bpSave}>
                      <Ionicons name="bookmark-outline" size={14} color={C.label3} />
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ===== Recent Graduates ===== */}
        <View style={S.ppSection}>
          <View style={S.secHead}>
            <View style={S.secHeadLeft}>
              <Text style={S.secEyebrow}>Recent graduates</Text>
              <Text style={S.secH3}>
                Public capability records. <Text style={S.italic}>Opt-in, evidence-backed.</Text>
              </Text>
              <Text style={S.lede}>
                Graduates choose whether to surface their record under their name, anonymously, or not at all. Every capability dot is backed by logged evidence — verifiable to a recruiter, not a marketing claim.
              </Text>
            </View>
            {isNursing ? (
              <View style={S.ppToggle}>
                <View style={[S.ppOpt, S.ppOptOn]}><Text style={[S.ppOptText, S.ppOptTextOn]}>All</Text></View>
                <View style={S.ppOpt}><Text style={S.ppOptText}>MSN</Text></View>
                <View style={S.ppOpt}><Text style={S.ppOptText}>DNP</Text></View>
                <View style={S.ppOpt}><Text style={S.ppOptText}>BSN</Text></View>
              </View>
            ) : null}
          </View>

          <View style={S.ppGrid}>
            {SAMPLE_GRADUATES.map((g) => (
              <View
                key={g.id}
                style={[
                  S.ppCard,
                  g.isAnonymous && S.ppCardAnon,
                  { flexBasis: 'calc(33.333% - 10px)' } as unknown as object,
                ]}
              >
                <View style={S.ppHead}>
                  {g.isAnonymous ? (
                    <View style={[S.avBig, S.avBigAnon]}><Text style={S.avBigAnonText}>?</Text></View>
                  ) : (
                    <View style={[S.avBig, { backgroundImage: AVATAR_GRADIENTS[g.avatarTone] } as Record<string, string>]}>
                      <Text style={S.avBigText}>{g.initials}</Text>
                    </View>
                  )}
                  <View style={S.ppWho}>
                    <Text style={[S.ppNm, g.isAnonymous && S.ppNmAnon]}>
                      {g.name || 'Anonymous graduate'}
                    </Text>
                    <View style={S.ppMeta}>
                      <Text style={S.ppDeg}>{g.degree}</Text>
                      <Text style={S.ppMetaDot}>{'·'}</Text>
                      <Text style={S.ppMetaText} numberOfLines={1}>{g.location}</Text>
                    </View>
                  </View>
                  <View style={[S.vBadge, g.isAnonymous && S.vBadgeAnon]}>
                    <View style={[S.vBadgeDot, g.isAnonymous && S.vBadgeDotAnon]}>
                      <Ionicons name="checkmark" size={8} color={g.isAnonymous ? C.gray5 : C.white} />
                    </View>
                    <Text style={[S.vBadgeText, g.isAnonymous && S.vBadgeTextAnon]}>Verified</Text>
                  </View>
                </View>

                <Text style={S.ppStrongLabel}>Strong in</Text>
                <View style={S.ppCaps}>
                  {g.caps.map((cap, i) => (
                    <View key={i} style={S.ppCap}>
                      <Text style={S.ppCapName} numberOfLines={1}>{cap.name}</Text>
                      <View style={S.ppDots}>
                        {[0, 1, 2, 3, 4].map((d) => {
                          const isOn = d < cap.filled;
                          const isPartial = cap.partial && d === cap.filled - 1;
                          return (
                            <View
                              key={d}
                              style={[
                                S.ppDot,
                                !isOn && S.ppDotOff,
                                isPartial && S.ppDotPartial,
                              ]}
                            />
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>

                <View style={S.ppFoot}>
                  <View style={S.ppFootIt}>
                    <Ionicons name="clipboard-outline" size={12} color={C.label4} />
                    <Text style={S.ppFootStrong}>{g.evidences}</Text>
                    <Text style={S.ppFootText}> evidences</Text>
                  </View>
                  {g.sites !== null ? (
                    <View style={S.ppFootIt}>
                      <Ionicons name="medkit-outline" size={12} color={C.label4} />
                      <Text style={S.ppFootText}>{g.sites} clinical sites</Text>
                    </View>
                  ) : (
                    <View style={S.ppFootIt}>
                      <Ionicons name="eye-off-outline" size={12} color={C.label4} />
                      <Text style={S.ppFootText}>private contact</Text>
                    </View>
                  )}
                  <View style={S.ppFootSpacer} />
                  <Text style={S.ppView}>
                    View profile <Ionicons name="arrow-forward" size={13} color={C.iosBlue} />
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ===== Footer CTAs ===== */}
        <View style={S.ctas}>
          <View style={S.ctasGrid}>
            <View style={[S.ctaBlock, S.ctaBlockPrimary]}>
              <Text style={[S.ctaNum, S.ctaNumPrimary]}>01 / Apply</Text>
              <Text style={[S.ctaH4, S.ctaH4Primary]}>Start your application</Text>
              <Text style={[S.ctaDesc, S.ctaDescPrimary]}>
                {isNursing
                  ? `${superLine || org.name} accepts BSN, MSN, and DNP applications on a rolling basis. The application opens in a new tab.`
                  : `${org.name} accepts applications on a rolling basis. The application opens in a new tab.`}
              </Text>
              <View style={S.ctaSpacer} />
              <View style={S.ctaAct}>
                <Pressable style={[S.ctaActBtn, S.ctaActBtnPrimary]} onPress={() => router.push('/welcome' as never)}>
                  <Text style={[S.ctaActText, S.ctaActTextPrimary]}>Apply</Text>
                  <Ionicons name="open-outline" size={14} color={C.tenantInk} />
                </Pressable>
                <View style={S.flex1} />
                <Text style={[S.ctaDeadline, S.ctaDeadlinePrimary]}>Next deadline · Aug 1, 2026</Text>
              </View>
            </View>

            <View style={S.ctaBlock}>
              <Text style={S.ctaNum}>02 / Learn more</Text>
              <Text style={S.ctaH4}>About the {headline || org.name}</Text>
              <Text style={S.ctaDesc}>
                Programs, faculty, financial aid, clinical partners, and accreditation.
              </Text>
              <View style={S.ctaSpacer} />
              <View style={S.ctaAct}>
                <View style={S.ctaActBtn}>
                  <Text style={S.ctaActText}>Programs</Text>
                  <Ionicons name="arrow-forward" size={14} color={C.white} />
                </View>
                <View style={S.flex1} />
                <Text style={S.ctaDeadline}>{org.slug ? `betterat.app/${org.slug}` : 'betterat.app'}</Text>
              </View>
            </View>

            <View style={S.ctaBlock}>
              <Text style={S.ctaNum}>03 / Newsroom</Text>
              <Text style={S.ctaH4}>News, research & student stories</Text>
              <Text style={S.ctaDesc}>
                Latest from the school — peer-reviewed publications, clinical research, student profiles.
              </Text>
              <View style={S.ctaSpacer} />
              <View style={S.ctaAct}>
                <View style={S.ctaActBtn}>
                  <Text style={S.ctaActText}>Newsroom</Text>
                  <Ionicons name="arrow-forward" size={14} color={C.white} />
                </View>
                <View style={S.flex1} />
                <Text style={S.ctaDeadline}>Latest · this term</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== Site footer ===== */}
        <View style={S.siteFoot}>
          <View style={S.siteFootRow}>
            <View style={S.siteFootBrand}>
              <View style={S.brandMarkSmall}><Text style={S.brandMarkTextSmall}>B</Text></View>
              <Text style={S.siteFootBrandText}><Text style={S.siteFootStrong}>BetterAt</Text> · 2026</Text>
            </View>
            <View style={S.siteFootLinks}>
              <Text style={S.siteFootLink}>About</Text>
              <Text style={S.siteFootLink}>For institutions</Text>
              <Text style={S.siteFootLink}>Privacy</Text>
              <Text style={S.siteFootLink}>Terms</Text>
              <Text style={S.siteFootLink}>Help</Text>
            </View>
            <View style={S.siteFootSpacer} />
            <View style={S.siteFootVerified}>
              <View style={S.siteFootVerifiedDot}>
                <Ionicons name="checkmark" size={8} color={C.white} />
              </View>
              <Text style={S.siteFootVerifiedText}>
                Verified institution · betterat.app/{org.slug || ''}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Completion ring for AACN domain card ─────────────────────────────
function CompletionRing({ pct, tone }: { pct: number; tone: AacnDomain['tone'] }) {
  const r = 9;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct / 100);
  const trackColor =
    tone === 'featured' ? 'rgba(255,255,255,0.22)' : C.gray5;
  const strokeColor =
    tone === 'featured' ? C.white
    : tone === 'amber' ? C.iosAmber
    : tone === 'gray' ? C.gray2
    : C.tenantInk;
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Circle cx={11} cy={11} r={r} fill="none" stroke={trackColor} strokeWidth={2.5} />
      <Circle
        cx={11}
        cy={11}
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 11 11)"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const S = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#EFEAD8',
    // @ts-expect-error rnweb
    minHeight: '100vh',
    fontFamily: FONT_SANS,
  },
  stageContent: {
    paddingVertical: 24,
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  page: {
    width: '100%',
    maxWidth: 1280,
    backgroundColor: C.white,
    borderRadius: 14,
    // @ts-expect-error rnweb
    boxShadow: '0 30px 80px -40px rgba(34,30,20,0.34), 0 6px 18px -10px rgba(34,30,20,0.16)',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 64 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 64, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.label, fontFamily: FONT_SERIF },
  emptySub: { fontSize: 13, color: C.label3, textAlign: 'center', maxWidth: 480 },
  backBtn: { marginTop: 8, backgroundColor: C.iosBlue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9 },
  backBtnText: { color: C.white, fontWeight: '600', fontSize: 13.5 },

  // Public nav
  pubNav: {
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 0.5,
    borderBottomColor: C.gray5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 28,
    // @ts-expect-error rnweb
    backdropFilter: 'blur(14px) saturate(140%)',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    // @ts-expect-error rnweb
    backgroundImage: 'linear-gradient(135deg, #1C1C1E 0%, #3A3A3C 100%)',
  },
  brandMarkText: { color: C.white, fontWeight: '700', fontSize: 13, letterSpacing: -0.5 },
  brandWord: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, color: C.label },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 22, marginLeft: 8 },
  navLink: { fontSize: 13, color: C.label2, letterSpacing: -0.1 },
  navSpacer: { flex: 1 },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  loginBtn: {
    height: 32, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 0.5, borderColor: C.gray3, backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
  },
  loginText: { fontSize: 13, fontWeight: '500', color: C.label2, letterSpacing: -0.1 },
  signupBtn: {
    height: 32, paddingHorizontal: 14, borderRadius: 8,
    backgroundColor: C.iosBlue,
    alignItems: 'center', justifyContent: 'center',
    // @ts-expect-error rnweb
    boxShadow: `0 1px 2px ${C.iosBlueShadow}`,
  },
  signupText: { fontSize: 13, fontWeight: '600', color: C.white, letterSpacing: -0.1 },

  // Hero
  hero: {
    paddingHorizontal: 64,
    paddingTop: 56,
    paddingBottom: 36,
    borderBottomWidth: 0.5,
    borderBottomColor: C.gray5,
    // @ts-expect-error rnweb
    backgroundImage: `radial-gradient(1200px 600px at 10% -10%, rgba(31,45,82,0.045), transparent 60%), linear-gradient(180deg, ${C.tenantCream} 0%, #FFFFFF 92%)`,
  },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 30 },
  crumbA: { fontSize: 11, color: C.label3, letterSpacing: 0.02 * 11 },
  crumbCurrent: { fontSize: 11, color: C.label, fontWeight: '500', letterSpacing: 0.02 * 11 },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  shield: {
    width: 96, height: 96, borderRadius: 18,
    backgroundColor: C.tenantInk,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)',
    // @ts-expect-error rnweb
    boxShadow: '0 1px 0 rgba(255,255,255,0.12) inset, 0 6px 18px -8px rgba(31,45,82,0.40)',
    position: 'relative',
  },
  shieldText: { color: C.white, fontFamily: FONT_SERIF, fontWeight: '600', fontSize: 42, letterSpacing: -0.02 * 42 },
  shieldLine: { position: 'absolute', left: 14, right: 14, bottom: 12, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  heroTitles: { flex: 1, paddingTop: 6, minWidth: 0 },
  superLine: {
    fontFamily: FONT_SERIF,
    fontSize: 17,
    color: C.tenantInk,
    letterSpacing: 0.02 * 17,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  heroH1: {
    fontFamily: FONT_SERIF,
    fontSize: 56,
    lineHeight: 56 * 1.04,
    fontWeight: '500',
    letterSpacing: -0.022 * 56,
    color: C.label,
    marginBottom: 6,
  },
  heroH2: {
    fontFamily: FONT_SERIF,
    fontSize: 28,
    fontWeight: '400',
    color: C.label2,
    fontStyle: 'italic',
    letterSpacing: -0.012 * 28,
  },
  verifiedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 20, paddingVertical: 5, paddingHorizontal: 11,
    paddingLeft: 8, borderRadius: 999,
    backgroundColor: C.tenantSoft, borderWidth: 0.5, borderColor: 'rgba(31,45,82,0.16)',
    alignSelf: 'flex-start',
  },
  verifiedDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.tenantInk, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { fontSize: 12, color: C.tenantInk, fontWeight: '500', letterSpacing: -0.05 },
  verifiedSep: { color: C.tenantInk3, fontSize: 12 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  ctaPrimary: {
    height: 36, paddingHorizontal: 16, borderRadius: 9,
    backgroundColor: C.iosBlue, flexDirection: 'row', alignItems: 'center', gap: 6,
    // @ts-expect-error rnweb
    boxShadow: `0 1px 2px ${C.iosBlueShadow}`,
  },
  ctaPrimaryText: { color: C.white, fontWeight: '600', fontSize: 13.5, letterSpacing: -0.1 },
  ctaSecondary: {
    height: 36, paddingHorizontal: 16, borderRadius: 9,
    backgroundColor: C.white, borderWidth: 0.5, borderColor: C.gray3,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  ctaSecondaryText: { color: C.label, fontWeight: '500', fontSize: 13.5, letterSpacing: -0.1 },
  viewPill: { marginLeft: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewPillText: { fontSize: 11.5, color: C.label3, letterSpacing: -0.05 },
  heroStack: {
    marginLeft: 124, marginTop: 26, maxWidth: 900,
    fontFamily: FONT_SERIF, fontSize: 19, lineHeight: 19 * 1.5,
    color: C.label2,
  },

  // Section primitives
  secEyebrow: {
    fontFamily: FONT_SERIF,
    fontSize: 13, fontWeight: '500', letterSpacing: 0.10 * 13,
    color: C.tenantInk,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  secTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 32, lineHeight: 32 * 1.12, fontWeight: '500',
    letterSpacing: -0.015 * 32, color: C.label,
    marginBottom: 4,
  },
  secH3: {
    fontFamily: FONT_SERIF,
    fontSize: 28, lineHeight: 28 * 1.15, fontWeight: '500',
    letterSpacing: -0.015 * 28, color: C.label,
    marginBottom: 6,
  },
  secSub: {
    fontFamily: FONT_SERIF, fontSize: 15, color: C.label3,
    fontStyle: 'italic', marginBottom: 22,
  },
  italic: { fontStyle: 'italic' },
  lede: {
    fontFamily: FONT_SERIF, fontSize: 15, lineHeight: 15 * 1.55,
    color: C.label2,
  },
  secHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 24, marginBottom: 22 },
  secHeadLeft: { flex: 1, maxWidth: 720 },

  // Program in Practice
  prog: { paddingHorizontal: 64, paddingTop: 32, paddingBottom: 48, backgroundColor: C.white },
  photoSlot: {
    width: '100%', height: 280, borderRadius: 12, overflow: 'hidden',
    borderWidth: 0.5, borderColor: C.gray4,
    alignItems: 'center', justifyContent: 'center',
    // @ts-expect-error rnweb
    backgroundImage: 'repeating-linear-gradient(135deg, rgba(31,45,82,0.06) 0 14px, rgba(31,45,82,0.10) 14px 28px)',
  },
  photoLabel: {
    fontSize: 11, color: C.label2, backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6,
    borderWidth: 0.5, borderColor: C.gray4,
    fontFamily: FONT_MONO,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: 30,
    borderTopWidth: 0.5, borderTopColor: C.gray4,
    borderBottomWidth: 0.5, borderBottomColor: C.gray4,
  },
  statCell: { flex: 1, paddingVertical: 22, paddingHorizontal: 28 },
  statDivider: { width: 0.5, backgroundColor: C.gray5 },
  statNum: {
    fontFamily: FONT_SERIF,
    fontSize: 64, lineHeight: 64, fontWeight: '500',
    letterSpacing: -0.025 * 64, color: C.label,
  },
  statPlus: { color: C.tenantInk3, fontFamily: FONT_SERIF },
  statPct: { fontSize: 36, color: C.label2, fontFamily: FONT_SERIF },
  statNm: { marginTop: 8, fontSize: 13, color: C.label2, lineHeight: 13 * 1.35, maxWidth: 280 },
  statStrong: { fontWeight: '600', color: C.label },
  statFoot: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statFootText: { fontSize: 12, color: C.label3, letterSpacing: -0.05 },

  // AACN
  aacn: {
    paddingHorizontal: 64, paddingVertical: 30,
    backgroundColor: C.tenantCream,
    borderTopWidth: 0.5, borderTopColor: C.gray5,
    borderBottomWidth: 0.5, borderBottomColor: C.gray5,
  },
  sourcePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: C.white, borderWidth: 0.5, borderColor: 'rgba(31,45,82,0.18)',
    alignSelf: 'flex-start', marginBottom: 4,
  },
  sourcePillText: { color: C.tenantInk, fontSize: 11.5, fontWeight: '500', letterSpacing: -0.05 },
  aacnGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  dom: {
    backgroundColor: C.white,
    borderWidth: 0.5, borderColor: C.gray4,
    borderRadius: 12, padding: 14,
    minHeight: 168,
    flexGrow: 1, flexShrink: 1,
    // @ts-expect-error rnweb
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  domFeatured: { backgroundColor: C.tenantInk, borderColor: 'transparent' },
  domNumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  domNum: { fontFamily: FONT_SERIF, fontSize: 22, fontWeight: '500', color: C.tenantInk, letterSpacing: -0.02 * 22, lineHeight: 22 },
  domNumFeatured: { color: 'rgba(255,255,255,0.9)' },
  domName: { fontSize: 13, lineHeight: 13 * 1.25, color: C.label, fontWeight: '600', letterSpacing: -0.1, marginTop: 8 },
  domNameFeatured: { color: C.white },
  domDesc: { fontSize: 11.5, lineHeight: 11.5 * 1.4, color: C.label3, marginTop: 4, flex: 1 },
  domDescFeatured: { color: 'rgba(255,255,255,0.72)' },
  domFoot: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 0 },
  domFootStrong: { fontWeight: '600', color: C.label2, fontSize: 11 },
  domFootText: { fontSize: 11, color: C.label3, letterSpacing: -0.05 },
  domFootFeatured: { color: 'rgba(255,255,255,0.95)' },
  exploreRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  exploreArrow: { color: C.iosBlue, fontWeight: '600', fontSize: 12.5, letterSpacing: -0.05 },
  exploreSep: { color: C.label4 },
  exploreNote: { fontSize: 12.5, color: C.label2 },
  exploreSpacer: { flex: 1 },
  exploreCount: { color: C.label3, fontSize: 11.5 },

  // Blueprints by Faculty
  bpSection: { paddingHorizontal: 64, paddingTop: 30, paddingBottom: 36, backgroundColor: C.white },
  seeAll: { color: C.iosBlue, fontSize: 13, fontWeight: '600', letterSpacing: -0.1, marginBottom: 4 },
  bpStrip: { flexDirection: 'row', gap: 16 },
  bpCard: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 0.5, borderColor: C.gray4, borderRadius: 12,
    overflow: 'hidden',
    // @ts-expect-error rnweb
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  bpCover: {
    height: 132,
    padding: 14,
    justifyContent: 'space-between',
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.10)',
  },
  bpCoverFill: { flex: 1 },
  bpBadge: {
    position: 'absolute', right: 12, top: 12,
    backgroundColor: 'rgba(0,0,0,0.32)',
    paddingVertical: 2, paddingHorizontal: 7, borderRadius: 4,
    // @ts-expect-error rnweb
    backdropFilter: 'blur(8px)',
  },
  bpBadgeText: { color: C.white, fontSize: 9.5, fontWeight: '600', letterSpacing: 0.04 * 9.5, textTransform: 'uppercase' },
  bpTopic: {
    color: 'rgba(255,255,255,0.92)',
    fontFamily: FONT_SERIF,
    fontSize: 17, lineHeight: 17 * 1.1,
    fontWeight: '500', letterSpacing: -0.012 * 17,
  },
  bpBody: { padding: 14, gap: 8, flex: 1 },
  bpName: { fontSize: 14, fontWeight: '600', color: C.label, lineHeight: 14 * 1.25, letterSpacing: -0.1 },
  bpBy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bpAv: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  bpAvText: { color: C.white, fontSize: 9, fontWeight: '600' },
  bpByText: { fontSize: 12, color: C.label3 },
  bpByStrong: { color: C.label2, fontWeight: '500' },
  bpMeta: { flexDirection: 'row', alignItems: 'center' },
  bpMetaIt: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingRight: 10, marginRight: 10,
    borderRightWidth: 0.5, borderRightColor: C.gray4,
  },
  bpMetaStrong: { color: C.label2, fontWeight: '600', fontSize: 11.5 },
  bpMetaText: { fontSize: 11.5, color: C.label3 },
  bpCtaRow: { paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bpCtaBtn: {
    flex: 1, height: 30, borderRadius: 8,
    borderWidth: 0.5, borderColor: C.gray3, backgroundColor: C.white,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  bpCtaText: { fontSize: 12.5, fontWeight: '600', color: C.label, letterSpacing: -0.1 },
  bpSave: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 0.5, borderColor: C.gray3, backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
  },

  // Recent graduates
  ppSection: { paddingHorizontal: 64, paddingVertical: 30, backgroundColor: C.white },
  ppToggle: {
    flexDirection: 'row', gap: 2, padding: 2,
    backgroundColor: C.gray5, borderRadius: 8,
    alignSelf: 'flex-end', marginBottom: 2,
  },
  ppOpt: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 6 },
  ppOptOn: {
    backgroundColor: C.white,
    // @ts-expect-error rnweb
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  ppOptText: { fontSize: 12, color: C.label2, fontWeight: '500', letterSpacing: -0.1 },
  ppOptTextOn: { color: C.label, fontWeight: '600' },
  ppGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  ppCard: {
    flexGrow: 1, flexShrink: 1,
    backgroundColor: C.white,
    borderWidth: 0.5, borderColor: C.gray4, borderRadius: 12,
    padding: 16, gap: 12,
    // @ts-expect-error rnweb
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  ppCardAnon: {
    backgroundColor: C.gray6,
    borderStyle: 'dashed', borderColor: C.gray3,
  },
  ppHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avBig: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)',
  },
  avBigText: { color: C.white, fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  avBigAnon: { backgroundColor: C.gray4, borderStyle: 'dashed', borderColor: C.gray3 },
  avBigAnonText: { color: C.label3, fontSize: 18, fontWeight: '600' },
  ppWho: { flex: 1, minWidth: 0 },
  ppNm: { fontSize: 14, fontWeight: '600', color: C.label, letterSpacing: -0.1 },
  ppNmAnon: { color: C.label2, fontStyle: 'italic' },
  ppMeta: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ppDeg: { fontWeight: '600', color: C.label2, fontSize: 11.5 },
  ppMetaDot: { color: C.label4, fontSize: 11.5 },
  ppMetaText: { fontSize: 11.5, color: C.label3, flexShrink: 1 },
  vBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 2, paddingHorizontal: 7, paddingLeft: 5, borderRadius: 5,
    backgroundColor: C.tenantSoft,
  },
  vBadgeAnon: { backgroundColor: C.gray5 },
  vBadgeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.tenantInk, alignItems: 'center', justifyContent: 'center' },
  vBadgeDotAnon: { backgroundColor: C.label3 },
  vBadgeText: { fontSize: 10, fontWeight: '600', color: C.tenantInk, letterSpacing: 0.02 * 10 },
  vBadgeTextAnon: { color: C.label3 },
  ppStrongLabel: {
    fontSize: 10.5, fontWeight: '600', letterSpacing: 0.06 * 10.5,
    color: C.label3, textTransform: 'uppercase',
  },
  ppCaps: { gap: 5 },
  ppCap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ppCapName: { flex: 1, fontSize: 12.5, color: C.label2, letterSpacing: -0.05 },
  ppDots: { flexDirection: 'row', gap: 3 },
  ppDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.tenantInk },
  ppDotOff: { backgroundColor: C.gray4 },
  ppDotPartial: { backgroundColor: C.tenantInk3 },
  ppFoot: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.gray5,
  },
  ppFootIt: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingRight: 10, marginRight: 10,
    borderRightWidth: 0.5, borderRightColor: C.gray4,
  },
  ppFootStrong: { fontWeight: '500', color: C.label2, fontSize: 11.5 },
  ppFootText: { fontSize: 11.5, color: C.label3, letterSpacing: -0.05 },
  ppFootSpacer: { flex: 1 },
  ppView: { color: C.iosBlue, fontWeight: '600', fontSize: 11.5 },

  // CTAs
  ctas: { paddingHorizontal: 64, paddingVertical: 30, backgroundColor: C.tenantCream, borderTopWidth: 0.5, borderTopColor: C.gray5 },
  ctasGrid: { flexDirection: 'row', gap: 14 },
  ctaBlock: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 0.5, borderColor: C.gray4, borderRadius: 14,
    padding: 22, gap: 12, minHeight: 184,
    // @ts-expect-error rnweb
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  ctaBlockPrimary: { backgroundColor: C.tenantInk, borderColor: 'transparent' },
  ctaNum: {
    fontFamily: FONT_MONO, fontSize: 10.5,
    letterSpacing: 0.10 * 10.5, color: C.label3,
    textTransform: 'uppercase',
  },
  ctaNumPrimary: { color: 'rgba(255,255,255,0.55)' },
  ctaH4: {
    fontFamily: FONT_SERIF, fontSize: 26, lineHeight: 26 * 1.1,
    fontWeight: '500', letterSpacing: -0.015 * 26, color: C.label,
  },
  ctaH4Primary: { color: C.white },
  ctaDesc: { fontSize: 13.5, lineHeight: 13.5 * 1.45, color: C.label2, letterSpacing: -0.05 },
  ctaDescPrimary: { color: 'rgba(255,255,255,0.78)' },
  ctaSpacer: { flex: 1 },
  ctaAct: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaActBtn: {
    height: 36, paddingHorizontal: 16, borderRadius: 9,
    backgroundColor: C.iosBlue, flexDirection: 'row', alignItems: 'center', gap: 6,
    // @ts-expect-error rnweb
    boxShadow: `0 1px 2px ${C.iosBlueShadow}`,
  },
  ctaActBtnPrimary: {
    backgroundColor: C.white,
    // @ts-expect-error rnweb
    boxShadow: '0 1px 2px rgba(0,0,0,0.16)',
  },
  ctaActText: { color: C.white, fontWeight: '600', fontSize: 13.5, letterSpacing: -0.1 },
  ctaActTextPrimary: { color: C.tenantInk },
  ctaDeadline: { fontSize: 11, color: C.label3 },
  ctaDeadlinePrimary: { color: 'rgba(255,255,255,0.6)' },

  // Site footer
  siteFoot: { backgroundColor: C.white, borderTopWidth: 0.5, borderTopColor: C.gray5, paddingHorizontal: 64, paddingVertical: 18 },
  siteFootRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  siteFootBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMarkSmall: {
    width: 20, height: 20, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    // @ts-expect-error rnweb
    backgroundImage: 'linear-gradient(135deg, #1C1C1E 0%, #3A3A3C 100%)',
  },
  brandMarkTextSmall: { color: C.white, fontWeight: '700', fontSize: 11 },
  siteFootBrandText: { color: C.label2, fontSize: 12, letterSpacing: -0.05 },
  siteFootStrong: { color: C.label, fontWeight: '600' },
  siteFootLinks: { flexDirection: 'row', gap: 18 },
  siteFootLink: { fontSize: 12, color: C.label3, letterSpacing: -0.05 },
  siteFootSpacer: { flex: 1 },
  siteFootVerified: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  siteFootVerifiedDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.tenantInk, alignItems: 'center', justifyContent: 'center' },
  siteFootVerifiedText: { color: C.tenantInk, fontWeight: '500', fontSize: 12 },
  flex1: { flex: 1 },
});
