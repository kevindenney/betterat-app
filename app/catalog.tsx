import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '@/services/supabase'
import { useInterest } from '@/providers/InterestProvider'
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback'
import { useActivityCatalog } from '@/hooks/useActivityCatalog'
import { ActivityCatalog } from '@/components/events/ActivityCatalog'
import { TemplatePreview } from '@/components/events/TemplatePreview'
import type { ActivityTemplate } from '@/types/activities'
import { getTemplatesByOrg } from '@/services/activityCatalog'

type CatalogTab = 'interests' | 'organizations' | 'coaches' | 'people' | 'content'

type OrganizationRow = {
  id: string
  name: string
  slug: string | null
  interest_slug: string | null
  join_mode: string | null
}

type MembershipRow = {
  user_id: string
  organization_id: string
  role: string | null
  status: string | null
  membership_status: string | null
}

type UserRow = {
  id: string
  full_name: string | null
  email: string | null
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function isActiveMembership(row: MembershipRow): boolean {
  const membershipStatus = normalize(row.membership_status)
  const status = normalize(row.status)
  return membershipStatus === 'active' || status === 'active'
}

function isCoachRole(role: string | null): boolean {
  const normalized = normalize(role)
  if (!normalized) return false
  if (normalized.includes('coach')) return true
  return (
    normalized === 'admin'
    || normalized === 'preceptor'
    || normalized === 'instructor'
    || normalized === 'clinical_instructor'
    || normalized === 'evaluator'
    || normalized === 'assessor'
  )
}

export default function CatalogScreen() {
  const { allInterests, userInterests, currentInterest, addInterest, removeInterest, switchInterest } = useInterest()
  const [tab, setTab] = useState<CatalogTab>('interests')
  const [query, setQuery] = useState('')
  const [selectedInterestSlug, setSelectedInterestSlug] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([])
  const [memberships, setMemberships] = useState<MembershipRow[]>([])
  const [usersById, setUsersById] = useState<Map<string, UserRow>>(new Map())
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<ActivityTemplate | null>(null)
  const [selectedContentOrgId, setSelectedContentOrgId] = useState<string>('all')
  const [orgContentTemplates, setOrgContentTemplates] = useState<ActivityTemplate[]>([])
  const [orgContentLoading, setOrgContentLoading] = useState(false)
  const [orgContentError, setOrgContentError] = useState<string | null>(null)
  const [orgContentReloadToken, setOrgContentReloadToken] = useState(0)
  const {
    templates: catalogTemplates,
    isLoading: catalogLoading,
    error: catalogError,
    refresh: refreshCatalog,
    enroll: enrollInCatalogTemplate,
  } = useActivityCatalog()

  const visibleInterestSlugs = useMemo(() => new Set(userInterests.map((interest) => interest.slug)), [userInterests])

  useEffect(() => {
    if (currentInterest?.slug) {
      setSelectedInterestSlug(currentInterest.slug)
    }
  }, [currentInterest?.slug])

  useEffect(() => {
    const available = new Set(organizations.map((org) => org.id))
    if (selectedContentOrgId !== 'all' && !available.has(selectedContentOrgId)) {
      setSelectedContentOrgId('all')
    }
  }, [organizations, selectedContentOrgId])

  useEffect(() => {
    let cancelled = false
    const loadOrgContent = async () => {
      if (tab !== 'content' || selectedContentOrgId === 'all') {
        setOrgContentTemplates([])
        setOrgContentLoading(false)
        setOrgContentError(null)
        return
      }
      setOrgContentLoading(true)
      setOrgContentError(null)
      try {
        const rows = await getTemplatesByOrg(selectedContentOrgId)
        if (!cancelled) {
          setOrgContentTemplates(rows)
        }
      } catch (error: any) {
        if (!cancelled) {
          setOrgContentTemplates([])
          setOrgContentError(String(error?.message || 'Failed to load organization templates'))
        }
      } finally {
        if (!cancelled) setOrgContentLoading(false)
      }
    }
    void loadOrgContent()
    return () => {
      cancelled = true
    }
  }, [orgContentReloadToken, selectedContentOrgId, tab])

  const loadCatalogData = useCallback(async () => {
    setLoading(true)
    setErrorText(null)
    try {
      let organizationsResult = await supabase
        .from('organizations')
        .select('id,name,slug,interest_slug,join_mode')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (
        organizationsResult.error
        && (
          isMissingSupabaseColumn(organizationsResult.error, 'organizations.is_active')
          || isMissingSupabaseColumn(organizationsResult.error, 'organizations.join_mode')
          || isMissingSupabaseColumn(organizationsResult.error, 'organizations.interest_slug')
        )
      ) {
        organizationsResult = await supabase
          .from('organizations')
          .select('id,name,slug')
          .order('name', { ascending: true })
      }

      if (organizationsResult.error) throw organizationsResult.error

      const orgRows = (organizationsResult.data || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name || ''),
        slug: row.slug ? String(row.slug) : null,
        interest_slug: row.interest_slug ? String(row.interest_slug) : null,
        join_mode: row.join_mode ? String(row.join_mode) : null,
      }))

      const filteredOrgs = selectedInterestSlug === 'all'
        ? orgRows
        : orgRows.filter((row) => normalize(row.interest_slug) === normalize(selectedInterestSlug))

      setOrganizations(filteredOrgs)

      const orgIds = filteredOrgs.map((row) => row.id)
      if (orgIds.length === 0) {
        setMemberships([])
        setUsersById(new Map())
        return
      }

      let membershipResult = await supabase
        .from('organization_memberships')
        .select('user_id,organization_id,role,status,membership_status')
        .in('organization_id', orgIds)
        .order('created_at', { ascending: false })
        .limit(2000)

      if (membershipResult.error && isMissingSupabaseColumn(membershipResult.error, 'organization_memberships.membership_status')) {
        membershipResult = await supabase
          .from('organization_memberships')
          .select('user_id,organization_id,role,status')
          .in('organization_id', orgIds)
          .order('created_at', { ascending: false })
          .limit(2000)
      }

      if (membershipResult.error) throw membershipResult.error
      const memberRows = (membershipResult.data || []).map((row: any) => ({
        user_id: String(row.user_id || ''),
        organization_id: String(row.organization_id || ''),
        role: row.role ? String(row.role) : null,
        status: row.status ? String(row.status) : null,
        membership_status: row.membership_status ? String(row.membership_status) : null,
      }))
      setMemberships(memberRows)

      const userIds = Array.from(new Set(memberRows.map((row) => row.user_id).filter(Boolean)))
      if (userIds.length === 0) {
        setUsersById(new Map())
        return
      }

      const usersResult = await supabase
        .from('users')
        .select('id,full_name,email')
        .in('id', userIds)
        .limit(4000)

      if (usersResult.error) throw usersResult.error

      const nextUsers = new Map<string, UserRow>()
      for (const row of usersResult.data || []) {
        nextUsers.set(String((row as any).id), {
          id: String((row as any).id),
          full_name: (row as any).full_name ? String((row as any).full_name) : null,
          email: (row as any).email ? String((row as any).email) : null,
        })
      }
      setUsersById(nextUsers)
    } catch (error: any) {
      setErrorText(String(error?.message || 'Failed to load catalog'))
    } finally {
      setLoading(false)
    }
  }, [selectedInterestSlug])

  useEffect(() => {
    void loadCatalogData()
  }, [loadCatalogData])

  const organizationById = useMemo(() => {
    const map = new Map<string, OrganizationRow>()
    for (const row of organizations) {
      map.set(row.id, row)
    }
    return map
  }, [organizations])

  const peopleRows = useMemo(() => {
    const perUser = new Map<string, { user: UserRow | null; orgNames: string[]; roleSet: Set<string> }>()
    for (const row of memberships) {
      if (!isActiveMembership(row)) continue
      const user = usersById.get(row.user_id) || null
      const existing = perUser.get(row.user_id) || {
        user,
        orgNames: [],
        roleSet: new Set<string>(),
      }
      const orgName = organizationById.get(row.organization_id)?.name
      if (orgName && !existing.orgNames.includes(orgName)) {
        existing.orgNames.push(orgName)
      }
      if (row.role) {
        existing.roleSet.add(row.role)
      }
      perUser.set(row.user_id, existing)
    }
    return Array.from(perUser.entries()).map(([userId, entry]) => ({
      userId,
      name: entry.user?.full_name || entry.user?.email || userId,
      email: entry.user?.email || null,
      organizations: entry.orgNames.sort((a, b) => a.localeCompare(b)),
      roles: Array.from(entry.roleSet),
      isCoach: Array.from(entry.roleSet).some((role) => isCoachRole(role)),
    }))
  }, [memberships, organizationById, usersById])

  const coachRows = useMemo(() => peopleRows.filter((row) => row.isCoach), [peopleRows])

  const normalizedQuery = normalize(query)
  const matchesQuery = useCallback(
    (text: string) => normalize(text).includes(normalizedQuery),
    [normalizedQuery],
  )

  const filteredOrganizations = useMemo(() => {
    if (!normalizedQuery) return organizations
    return organizations.filter((row) => matchesQuery(`${row.name} ${row.slug || ''} ${row.interest_slug || ''}`))
  }, [normalizedQuery, organizations, matchesQuery])

  const filteredPeople = useMemo(() => {
    if (!normalizedQuery) return peopleRows
    return peopleRows.filter((row) => {
      const orgText = row.organizations.join(' ')
      return matchesQuery(`${row.name} ${row.email || ''} ${orgText}`)
    })
  }, [normalizedQuery, peopleRows, matchesQuery])

  const filteredCoaches = useMemo(() => {
    if (!normalizedQuery) return coachRows
    return coachRows.filter((row) => {
      const orgText = row.organizations.join(' ')
      return matchesQuery(`${row.name} ${row.email || ''} ${orgText}`)
    })
  }, [normalizedQuery, coachRows, matchesQuery])

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) || null,
    [organizations, selectedOrganizationId],
  )

  const selectedOrganizationMemberships = useMemo(
    () =>
      memberships.filter((row) => row.organization_id === selectedOrganizationId && isActiveMembership(row)),
    [memberships, selectedOrganizationId],
  )

  const selectedOrganizationPeople = useMemo(() => {
    const seen = new Set<string>()
    return selectedOrganizationMemberships
      .map((row) => {
        if (seen.has(row.user_id)) return null
        seen.add(row.user_id)
        const user = usersById.get(row.user_id)
        return {
          id: row.user_id,
          name: user?.full_name || user?.email || row.user_id,
          email: user?.email || null,
          role: row.role || null,
          isCoach: isCoachRole(row.role),
        }
      })
      .filter(Boolean) as { id: string; name: string; email: string | null; role: string | null; isCoach: boolean }[]
  }, [selectedOrganizationMemberships, usersById])

  const selectedOrganizationCoaches = useMemo(
    () => selectedOrganizationPeople.filter((person) => person.isCoach),
    [selectedOrganizationPeople],
  )

  const memberCountByOrg = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of memberships) {
      if (!isActiveMembership(row)) continue
      map.set(row.organization_id, (map.get(row.organization_id) || 0) + 1)
    }
    return map
  }, [memberships])

  const coachCountByOrg = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of memberships) {
      if (!isActiveMembership(row)) continue
      if (!isCoachRole(row.role)) continue
      map.set(row.organization_id, (map.get(row.organization_id) || 0) + 1)
    }
    return map
  }, [memberships])

  const interestOptions = useMemo(
    () => [{ slug: 'all', name: 'All interests' }, ...allInterests.map((interest) => ({ slug: interest.slug, name: interest.name }))],
    [allInterests],
  )
  const contentOrgOptions = useMemo(
    () => [{ id: 'all', name: 'All organizations' }, ...organizations.map((org) => ({ id: org.id, name: org.name }))],
    [organizations],
  )
  const effectiveContentTemplates = selectedContentOrgId === 'all' ? catalogTemplates : orgContentTemplates

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={20} color="#111827" />
        </Pressable>
        <Text style={styles.title}>Catalog</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.tabsRow}>
        {(['interests', 'organizations', 'coaches', 'people', 'content'] as CatalogTab[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setTab(item)}
            style={[styles.tabPill, tab === item && styles.tabPillActive]}
          >
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>
              {item[0].toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.interestFilterRow}>
        {interestOptions.map((option) => (
          <Pressable
            key={option.slug}
            onPress={() => setSelectedInterestSlug(option.slug)}
            style={[styles.filterPill, selectedInterestSlug === option.slug && styles.filterPillActive]}
          >
            <Text style={[styles.filterPillText, selectedInterestSlug === option.slug && styles.filterPillTextActive]}>
              {option.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.stateText}>Loading catalog…</Text>
        </View>
      ) : null}

      {!loading && errorText ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{errorText}</Text>
          <Pressable onPress={() => void loadCatalogData()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !errorText ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {tab === 'interests' ? (
            allInterests.map((interest) => {
              const added = visibleInterestSlugs.has(interest.slug)
              const isCurrent = currentInterest?.slug === interest.slug
              return (
                <View key={interest.id} style={styles.card}>
                  <View style={styles.rowBetween}>
                    <View style={styles.rowGrow}>
                      <View style={[styles.dot, { backgroundColor: interest.accent_color || '#007AFF' }]} />
                      <View style={styles.rowGrow}>
                        <Text style={styles.cardTitle}>{interest.name}</Text>
                        <Text style={styles.cardMeta}>{interest.slug}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => void (added ? removeInterest(interest.slug) : addInterest(interest.slug))}
                      style={[styles.actionBtn, added ? styles.removeBtn : styles.addBtn]}
                    >
                      <Text style={[styles.actionText, added ? styles.removeText : styles.addText]}>
                        {added ? 'Remove' : 'Add'}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardMeta}>{interest.description || 'No description'}</Text>
                    <Pressable
                      onPress={() => void switchInterest(interest.slug)}
                      style={[styles.setActiveBtn, isCurrent && styles.setActiveBtnCurrent]}
                    >
                      <Text style={[styles.setActiveText, isCurrent && styles.setActiveTextCurrent]}>
                        {isCurrent ? 'Current' : 'Set active'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )
            })
          ) : null}

          {tab === 'organizations' ? (
            filteredOrganizations.map((org) => (
              <Pressable
                key={org.id}
                style={styles.card}
                onPress={() => setSelectedOrganizationId(org.id)}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{org.name}</Text>
                    <Text style={styles.cardMeta}>
                      {(org.interest_slug || 'no-interest-tag')} · {(org.join_mode || 'invite_only')}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {(memberCountByOrg.get(org.id) || 0)} members · {(coachCountByOrg.get(org.id) || 0)} coaches
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </View>
              </Pressable>
            ))
          ) : null}

          {tab === 'coaches' ? (
            filteredCoaches.map((row) => (
              <View key={row.userId} style={styles.card}>
                <Text style={styles.cardTitle}>{row.name}</Text>
                <Text style={styles.cardMeta}>{row.email || 'No email'}</Text>
                <Text style={styles.cardMeta}>Orgs: {row.organizations.join(', ') || '—'}</Text>
              </View>
            ))
          ) : null}

          {tab === 'people' ? (
            filteredPeople.map((row) => (
              <View key={row.userId} style={styles.card}>
                <Text style={styles.cardTitle}>{row.name}</Text>
                <Text style={styles.cardMeta}>{row.email || 'No email'}</Text>
                <Text style={styles.cardMeta}>Orgs: {row.organizations.join(', ') || '—'}</Text>
              </View>
            ))
          ) : null}

          {tab === 'content' ? (
            <View style={styles.contentSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contentFilterRow}>
                {contentOrgOptions.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => setSelectedContentOrgId(option.id)}
                    style={[styles.filterPill, selectedContentOrgId === option.id && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterPillText, selectedContentOrgId === option.id && styles.filterPillTextActive]}>
                      {option.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {(catalogLoading || orgContentLoading) ? (
                <View style={styles.centerState}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.stateText}>Loading content catalog…</Text>
                </View>
              ) : null}
              {!catalogLoading && !orgContentLoading && (catalogError || orgContentError) ? (
                <View style={styles.centerState}>
                  <Text style={styles.errorText}>
                    {orgContentError || catalogError?.message || 'Failed to load content catalog.'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (selectedContentOrgId === 'all') {
                        void refreshCatalog()
                      } else {
                        setOrgContentReloadToken((prev) => prev + 1)
                      }
                    }}
                    style={styles.retryBtn}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
              {!catalogLoading && !orgContentLoading && !catalogError && !orgContentError && effectiveContentTemplates.length === 0 ? (
                <Text style={styles.emptyText}>
                  {selectedContentOrgId === 'all'
                    ? 'No templates published for your active interest yet.'
                    : 'No templates published by this organization yet.'}
                </Text>
              ) : null}
              {!catalogLoading && !orgContentLoading && !catalogError && !orgContentError && effectiveContentTemplates.length > 0 ? (
                <ActivityCatalog
                  templates={effectiveContentTemplates}
                  onSelectTemplate={setPreviewTemplate}
                  isLoading={false}
                />
              ) : null}
            </View>
          ) : null}

          {tab === 'organizations' && filteredOrganizations.length === 0 ? (
            <Text style={styles.emptyText}>No organizations found.</Text>
          ) : null}
          {tab === 'coaches' && filteredCoaches.length === 0 ? (
            <Text style={styles.emptyText}>No coaches found.</Text>
          ) : null}
          {tab === 'people' && filteredPeople.length === 0 ? (
            <Text style={styles.emptyText}>No people found.</Text>
          ) : null}
          {tab === 'content' && !catalogLoading && !orgContentLoading && !catalogError && !orgContentError && effectiveContentTemplates.length === 0 ? (
            <Text style={styles.emptyText}>Try switching interests to see more content.</Text>
          ) : null}
        </ScrollView>
      ) : null}

      <Modal
        visible={!!selectedOrganization}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedOrganizationId(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedOrganizationId(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>{selectedOrganization?.name || 'Organization'}</Text>
              <Pressable onPress={() => setSelectedOrganizationId(null)} hitSlop={8}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>
            <Text style={styles.modalMeta}>
              {(selectedOrganization?.interest_slug || 'no-interest-tag')} · {(selectedOrganization?.join_mode || 'invite_only')}
            </Text>
            <Text style={styles.modalSectionTitle}>Coaches ({selectedOrganizationCoaches.length})</Text>
            {selectedOrganizationCoaches.length === 0 ? (
              <Text style={styles.cardMeta}>No coaches found.</Text>
            ) : (
              selectedOrganizationCoaches.slice(0, 8).map((person) => (
                <Pressable
                  key={`coach-${person.id}`}
                  style={styles.modalRow}
                  onPress={() => {
                    setSelectedOrganizationId(null)
                    router.push(`/person/${person.id}`)
                  }}
                >
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRowTitle}>{person.name}</Text>
                      <Text style={styles.modalRowMeta}>{person.role || 'coach'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </View>
                </Pressable>
              ))
            )}
            <Text style={styles.modalSectionTitle}>People ({selectedOrganizationPeople.length})</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {selectedOrganizationPeople.length === 0 ? (
                <Text style={styles.cardMeta}>No active members found.</Text>
              ) : (
                selectedOrganizationPeople.slice(0, 30).map((person) => (
                <Pressable
                  key={`person-${person.id}`}
                  style={styles.modalRow}
                  onPress={() => {
                    setSelectedOrganizationId(null)
                    router.push(`/person/${person.id}`)
                  }}
                >
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalRowTitle}>{person.name}</Text>
                        <Text style={styles.modalRowMeta}>{person.email || person.role || 'member'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
            {selectedOrganization?.slug ? (
              <Pressable
                style={styles.publicPageBtn}
                onPress={() => {
                  const slug = selectedOrganization.slug || selectedOrganization.id
                  setSelectedOrganizationId(null)
                  router.push(`/org/${slug}`)
                }}
              >
                <Text style={styles.publicPageBtnText}>Open Public Organization Page</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {previewTemplate && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setPreviewTemplate(null)}
        >
          <SafeAreaView style={styles.safeArea}>
            <TemplatePreview
              template={previewTemplate}
              onEnroll={async (template) => {
                await enrollInCatalogTemplate(template)
                setPreviewTemplate(null)
              }}
              onClose={() => setPreviewTemplate(null)}
            />
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  tabPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  tabPillActive: {
    backgroundColor: '#DBEAFE',
  },
  tabText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  interestFilterRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  filterPillActive: {
    borderColor: '#007AFF',
    backgroundColor: '#EFF6FF',
  },
  filterPillText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#1D4ED8',
  },
  searchWrap: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  stateText: {
    fontSize: 13,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: '#007AFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    gap: 10,
  },
  contentSection: {
    gap: 10,
  },
  contentFilterRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowGrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  addBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  removeBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addText: { color: '#047857' },
  removeText: { color: '#B91C1C' },
  setActiveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  setActiveBtnCurrent: {
    backgroundColor: '#DBEAFE',
  },
  setActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  setActiveTextCurrent: {
    color: '#1E40AF',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 10,
    maxHeight: '78%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
    paddingRight: 8,
  },
  modalMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalSectionTitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  modalRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  modalRowMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  publicPageBtn: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    alignItems: 'center',
  },
  publicPageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
})
