import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import type { BlueprintRecord } from '@/types/blueprint';
import type { ProgramRecord } from '@/services/ProgramService';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';

// ── Design tokens (matching blueprint page) ──────────────────────────
const C = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  accent: '#00897B',
  accentBg: 'rgba(0,137,123,0.08)',
  accentLight: '#E0F2F1',
  border: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  green: '#3D8A5A',
} as const;

// ── Types ────────────────────────────────────────────────────────────

type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  join_mode: string | null;
  interest_slug: string | null;
};

type MembershipRow = {
  user_id: string;
  role: string | null;
  status: string | null;
  membership_status: string | null;
};

type PersonDisplay = {
  id: string;
  name: string;
  initials: string;
  role: string | null;
  isCoach: boolean;
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isActiveMembership(row: MembershipRow): boolean {
  const membershipStatus = normalize(row.membership_status);
  const status = normalize(row.status);
  return membershipStatus === 'active' || status === 'active';
}

function isCoachRole(role: string | null): boolean {
  const normalized = normalize(role);
  return normalized.includes('coach')
    || normalized === 'admin'
    || normalized === 'preceptor'
    || normalized === 'instructor'
    || normalized === 'clinical_instructor'
    || normalized === 'evaluator'
    || normalized === 'assessor';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatRole(role: string | null): string {
  if (!role) return 'Member';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Palette for avatar backgrounds ───────────────────────────────────
const AVATAR_COLORS = ['#E0F2F1', '#FFF3E0', '#E8EAF6', '#FCE4EC', '#E0F7FA', '#F3E5F5', '#FFF8E1', '#E8F5E9'];

export default function PublicOrganizationPage() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug.trim() : '';
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [blueprints, setBlueprints] = useState<BlueprintRecord[]>([]);
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [people, setPeople] = useState<PersonDisplay[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorText(null);
      try {
        // Fetch org
        let orgQuery = await supabase
          .from('organizations')
          .select('id,name,slug,join_mode,interest_slug')
          .eq('slug', slug)
          .maybeSingle();
        if (!orgQuery.data) {
          orgQuery = await supabase
            .from('organizations')
            .select('id,name,slug,join_mode,interest_slug')
            .eq('id', slug)
            .maybeSingle();
        }
        if (orgQuery.error || !orgQuery.data) {
          throw orgQuery.error || new Error('Organization not found');
        }

        const orgRow: OrgRow = {
          id: String((orgQuery.data as any).id),
          name: String((orgQuery.data as any).name || ''),
          slug: (orgQuery.data as any).slug ? String((orgQuery.data as any).slug) : null,
          join_mode: (orgQuery.data as any).join_mode ? String((orgQuery.data as any).join_mode) : null,
          interest_slug: (orgQuery.data as any).interest_slug ? String((orgQuery.data as any).interest_slug) : null,
        };

        // Fetch memberships
        let membershipResult = await supabase
          .from('organization_memberships')
          .select('user_id,role,status,membership_status')
          .eq('organization_id', orgRow.id)
          .limit(3000);
        if (membershipResult.error && isMissingSupabaseColumn(membershipResult.error, 'organization_memberships.membership_status')) {
          membershipResult = await supabase
            .from('organization_memberships')
            .select('user_id,role,status')
            .eq('organization_id', orgRow.id)
            .limit(3000);
        }
        if (membershipResult.error) throw membershipResult.error;

        const memberRows: MembershipRow[] = (membershipResult.data || []).map((row: any) => ({
          user_id: String(row.user_id || ''),
          role: row.role ? String(row.role) : null,
          status: row.status ? String(row.status) : null,
          membership_status: row.membership_status ? String(row.membership_status) : null,
        }));
        const activeMembers = memberRows.filter(isActiveMembership);
        const userIds = Array.from(new Set(activeMembers.map((row) => row.user_id).filter(Boolean)));

        // Fetch display names from profiles (proper names), fall back to users
        let profilesById = new Map<string, string>();
        if (userIds.length > 0) {
          const profilesResult = await supabase
            .from('profiles')
            .select('id,full_name')
            .in('id', userIds)
            .limit(4000);
          if (!profilesResult.error) {
            profilesById = new Map(
              (profilesResult.data || []).map((row: any) => [String(row.id), row.full_name ? String(row.full_name) : '']),
            );
          }

          // Fall back to users table for anyone missing from profiles
          const missingIds = userIds.filter((id) => !profilesById.get(id));
          if (missingIds.length > 0) {
            const usersResult = await supabase
              .from('users')
              .select('id,full_name,email')
              .in('id', missingIds)
              .limit(4000);
            if (!usersResult.error) {
              for (const row of usersResult.data || []) {
                const id = String((row as any).id);
                if (!profilesById.get(id)) {
                  profilesById.set(id, String((row as any).full_name || (row as any).email || 'Member'));
                }
              }
            }
          }
        }

        const nextPeople: PersonDisplay[] = activeMembers.map((row) => {
          const displayName = profilesById.get(row.user_id) || 'Member';
          return {
            id: row.user_id,
            name: displayName,
            initials: getInitials(displayName),
            role: row.role || null,
            isCoach: isCoachRole(row.role),
          };
        });

        // Fetch active programs (degree programs etc.) so they can be surfaced
        // alongside blueprints. Programs are the canonical entity; blueprints
        // are templates that may belong to a program.
        const programsResult = await supabase
          .from('programs')
          .select('*')
          .eq('organization_id', orgRow.id)
          .in('status', ['draft', 'planned', 'active'])
          .order('title', { ascending: true });

        // Fetch published blueprints
        const bpResult = await supabase
          .from('timeline_blueprints')
          .select('*')
          .eq('organization_id', orgRow.id)
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (!cancelled) {
          setOrg(orgRow);
          if (!programsResult.error) {
            setPrograms((programsResult.data as any[]) ?? []);
          }
          if (!bpResult.error) {
            setBlueprints((bpResult.data as any[]) ?? []);
          }
          setPeople(nextPeople);
        }
      } catch (error: any) {
        if (!cancelled) {
          setErrorText(String(error?.message || 'Failed to load organization'));
        }
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

  const coaches = useMemo(() => people.filter((p) => p.isCoach), [people]);
  const members = useMemo(() => people.filter((p) => !p.isCoach), [people]);

  // Degree programs = active programs with a program_path in metadata (e.g.
  // 'msn-entry-into-nursing'). Programs without program_path are legacy/internal
  // (e.g. clinical_rotation containers) and should not be promoted here.
  const degreePrograms = useMemo(
    () =>
      programs.filter((p) => {
        const path = (p.metadata as Record<string, unknown> | null)?.program_path;
        return typeof path === 'string' && path.length > 0;
      }),
    [programs],
  );

  // Only show blueprints that are linked to a surfaced degree program. This
  // hides blueprints attached to legacy programs (which would otherwise leak
  // into the public org page).
  const visibleBlueprints = useMemo(() => {
    if (degreePrograms.length === 0) return blueprints;
    const programIds = new Set(degreePrograms.map((p) => p.id));
    return blueprints.filter((bp) => bp.program_id && programIds.has(bp.program_id));
  }, [blueprints, degreePrograms]);

  const programCount = degreePrograms.length + visibleBlueprints.length;

  const Container = Platform.OS === 'web' ? View : SafeAreaView;

  if (loading) {
    return (
      <Container style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </Container>
    );
  }

  if (!org || errorText) {
    return (
      <Container style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="business-outline" size={48} color={C.labelLight} />
          <Text style={styles.emptyTitle}>Organization not found</Text>
          <Text style={styles.emptySubtitle}>{errorText || 'This organization may not exist or the URL is incorrect.'}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      {/* Header */}
      <View style={styles.navHeader}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/races' as any)}
        >
          <Ionicons name="arrow-back" size={20} color={C.accent} />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="business" size={28} color={C.accent} />
          </View>
          <Text style={styles.heroTitle}>{org.name}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{programCount}</Text>
              <Text style={styles.statLabel}>Program{programCount !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{coaches.length}</Text>
              <Text style={styles.statLabel}>Coach{coaches.length !== 1 ? 'es' : ''}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{people.length}</Text>
              <Text style={styles.statLabel}>Member{people.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>

        {/* Degree Programs */}
        {degreePrograms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Degree Programs</Text>
            <View style={styles.blueprintGrid}>
              {degreePrograms.map((prog) => {
                const meta = (prog.metadata as Record<string, unknown> | null) ?? {};
                const degreeType = typeof meta.degree_type === 'string' ? meta.degree_type : null;
                const semesters = typeof meta.duration_semesters === 'number' ? meta.duration_semesters : null;
                const clinical = typeof meta.clinical_hours === 'number'
                  ? meta.clinical_hours
                  : typeof meta.practicum_hours === 'number'
                    ? meta.practicum_hours
                    : null;
                const passRate = typeof meta.nclex_pass_rate === 'number' ? meta.nclex_pass_rate : null;
                return (
                  <View key={prog.id} style={styles.blueprintCard}>
                    <View style={styles.blueprintCardIcon}>
                      <Ionicons name="school" size={22} color={C.accent} />
                    </View>
                    <Text style={styles.blueprintCardTitle}>{prog.title}</Text>
                    {prog.description ? (
                      <Text style={styles.blueprintCardDesc} numberOfLines={3}>{prog.description}</Text>
                    ) : null}
                    {(degreeType || semesters || clinical || passRate !== null) && (
                      <View style={styles.degreeMetaRow}>
                        {degreeType && (
                          <View style={styles.degreeBadge}>
                            <Text style={styles.degreeBadgeText}>{degreeType}</Text>
                          </View>
                        )}
                        {semesters !== null && (
                          <Text style={styles.degreeMetaText}>{semesters} semesters</Text>
                        )}
                        {clinical !== null && (
                          <Text style={styles.degreeMetaText}>
                            {clinical.toLocaleString()} clinical hrs
                          </Text>
                        )}
                        {passRate !== null && (
                          <Text style={styles.degreeMetaText}>
                            {Math.round(passRate * 100)}% NCLEX pass
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Programs & Blueprints */}
        {visibleBlueprints.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Programs & Blueprints</Text>
            <View style={styles.blueprintGrid}>
              {visibleBlueprints.map((bp) => (
                <Pressable
                  key={bp.id}
                  style={({ pressed }) => [styles.blueprintCard, pressed && styles.cardPressed]}
                  onPress={() => router.push(`/blueprint/${bp.slug}`)}
                >
                  <View style={styles.blueprintCardIcon}>
                    <Ionicons name="layers" size={22} color={C.accent} />
                  </View>
                  <Text style={styles.blueprintCardTitle}>{bp.title}</Text>
                  {bp.description ? (
                    <Text style={styles.blueprintCardDesc} numberOfLines={3}>{bp.description}</Text>
                  ) : null}
                  <View style={styles.blueprintCardFooter}>
                    <Ionicons name="people-outline" size={12} color={C.labelMid} />
                    <Text style={styles.blueprintCardMeta}>
                      {bp.subscriber_count} subscriber{bp.subscriber_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.blueprintCardCta}>
                    <Text style={styles.blueprintCardCtaText}>View Program</Text>
                    <Ionicons name="arrow-forward" size={12} color={C.accent} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Coaches */}
        {coaches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coaches & Instructors</Text>
            <View style={styles.peopleList}>
              {coaches.map((person, index) => (
                <Pressable
                  key={person.id}
                  style={({ pressed }) => [styles.personRow, pressed && styles.personRowPressed]}
                  onPress={() => router.push(`/person/${person.id}`)}
                >
                  <View style={[styles.personAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                    <Text style={styles.personInitials}>{person.initials}</Text>
                  </View>
                  <View style={styles.personInfo}>
                    <Text style={styles.personName}>{person.name}</Text>
                    <Text style={styles.personRole}>{formatRole(person.role)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.labelLight} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Members */}
        {members.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Members</Text>
            <View style={styles.peopleList}>
              {members.map((person, index) => (
                <Pressable
                  key={person.id}
                  style={({ pressed }) => [styles.personRow, pressed && styles.personRowPressed]}
                  onPress={() => router.push(`/person/${person.id}`)}
                >
                  <View style={[styles.personAvatar, { backgroundColor: AVATAR_COLORS[(index + coaches.length) % AVATAR_COLORS.length] }]}>
                    <Text style={styles.personInitials}>{person.initials}</Text>
                  </View>
                  <View style={styles.personInfo}>
                    <Text style={styles.personName}>{person.name}</Text>
                    <Text style={styles.personRole}>{formatRole(person.role)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.labelLight} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    ...Platform.select({ web: { minHeight: '100vh' as any } }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.labelDark,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.labelMid,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 12,
    backgroundColor: C.accentBg,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.accent,
  },

  // Nav
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.cardBg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.accent,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },

  // Hero
  hero: {
    backgroundColor: C.cardBg,
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.labelDark,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 0,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: C.labelDark,
  },
  statLabel: {
    fontSize: 11,
    color: C.labelMid,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: C.border,
  },

  // Sections
  section: {
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.labelDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 20,
  },

  // Blueprint cards
  blueprintGrid: {
    paddingHorizontal: 16,
    gap: 10,
  },
  blueprintCard: {
    backgroundColor: C.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  cardPressed: {
    opacity: 0.85,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } as any,
    }),
  },
  blueprintCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  blueprintCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.labelDark,
    marginBottom: 4,
  },
  blueprintCardDesc: {
    fontSize: 13,
    color: C.labelMid,
    lineHeight: 18,
    marginBottom: 8,
  },
  blueprintCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  blueprintCardMeta: {
    fontSize: 11,
    color: C.labelMid,
  },
  blueprintCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: C.accentBg,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  blueprintCardCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
  },
  degreeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  degreeBadge: {
    backgroundColor: C.accentBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  degreeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.3,
  },
  degreeMetaText: {
    fontSize: 11,
    color: C.labelMid,
  },

  // People
  peopleList: {
    backgroundColor: C.cardBg,
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  personRowPressed: {
    backgroundColor: C.accentBg,
  },
  personAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: C.labelDark,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.labelDark,
  },
  personRole: {
    fontSize: 11,
    color: C.labelMid,
    marginTop: 1,
  },
});
