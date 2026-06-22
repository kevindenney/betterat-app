/**
 * InterestProvider
 *
 * Provides multi-interest context for the BetterAt platform.
 * Wraps inside AuthProvider and manages which "interest" (e.g. sail-racing,
 * nursing, drawing, fitness) is currently active for the user.
 *
 * Users start with zero interests and explicitly "add" the ones they want
 * to get better at. The user_interests DB table is the source of truth.
 *
 * Resolution order for current interest:
 *   1. AsyncStorage cache (fast startup)
 *   2. user_preferences.preferred_interest_id (authenticated users)
 *   3. null — InterestSelectionGate shows onboarding modal
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { createLogger } from '@/lib/utils/logger'
import {
  hasExistingProfileSignal,
  normalizeSlug,
  selectDefaultInterestForExistingUser,
  selectExplicitInterestFromSignals,
} from './InterestProvider.logic'

const logger = createLogger('InterestProvider')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Interest {
  id: string
  slug: string
  name: string
  description: string | null
  parent_id: string | null
  type: 'official' | 'org' | 'user_proposed' | 'private' | 'domain'
  status: 'active' | 'pending' | 'archived'
  visibility: 'public' | 'org_only' | 'private'
  accent_color: string
  icon_name: string | null
  organization_id: string | null
  hero_tagline: string | null
  pricing_text: string | null
  web_app_url: string | null
  created_at: string
}

export interface DomainWithInterests {
  domain: Interest
  interests: Interest[]
}

export interface ProposeInterestInput {
  name: string
  slug: string
  description: string
  parent_id?: string | null
  accent_color: string
  icon_name: string
}

interface InterestContextValue {
  /** The currently-active interest, or null while loading */
  currentInterest: Interest | null
  /** Full public interest catalog (for browsing/discovery) */
  allInterests: Interest[]
  /** Only interests the user has explicitly added */
  userInterests: Interest[]
  /** True while the initial interest data is being resolved */
  loading: boolean
  /** Switch the active interest by slug. Persists to AsyncStorage and (if signed in) user_preferences. */
  switchInterest: (slug: string) => Promise<void>
  /** Add an interest to the user's list (writes to user_interests table) */
  addInterest: (slug: string) => Promise<void>
  /** Remove an interest from the user's list (deletes from user_interests table) */
  removeInterest: (slug: string) => Promise<void>
  /** Domain rows only (type='domain') */
  domains: Interest[]
  /** Interests grouped by their parent domain */
  groupedInterests: DomainWithInterests[]
  /** Get the parent domain for a given interest id */
  getDomainForInterest: (interestId: string) => Interest | null
  /** Propose a new user-created interest (inserts with type='user_proposed') */
  proposeInterest: (input: ProposeInterestInput) => Promise<Interest>
  /** Force re-fetch interests from Supabase */
  refreshInterests: () => Promise<void>
  /** View mode: 'interest' shows only current interest, 'domain' shows all sibling interests */
  viewMode: 'interest' | 'domain'
  /** All interest IDs in the current interest's domain (includes current) */
  domainInterestIds: string[]
  /** Effective interest IDs based on viewMode: single in interest mode, all domain siblings in domain mode */
  effectiveInterestIds: string[]
  /** Toggle between interest and domain view modes */
  toggleDomainView: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ASYNC_STORAGE_KEY = 'betterat_preferred_interest'
const INTERESTS_QUERY_KEY = ['interests', 'all']
const USER_INTERESTS_QUERY_KEY = ['user_interests']
// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const InterestContext = createContext<InterestContextValue>({
  currentInterest: null,
  allInterests: [],
  userInterests: [],
  domains: [],
  groupedInterests: [],
  getDomainForInterest: () => null,
  loading: true,
  switchInterest: async () => {},
  addInterest: async () => {},
  removeInterest: async () => {},
  proposeInterest: async () => { throw new Error('InterestProvider not mounted') },
  refreshInterests: async () => {},
  viewMode: 'interest' as const,
  domainInterestIds: [],
  effectiveInterestIds: [],
  toggleDomainView: async () => {},
})

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function InterestProvider({ children }: PropsWithChildren) {
  const { user, userProfile, fetchUserProfile, signedIn } = useAuth()
  const queryClient = useQueryClient()

  // The slug that we have resolved as the "active" interest.
  // null means we haven't resolved yet.
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [resolving, setResolving] = useState(true)

  // Track which auth identity has already resolved an active interest so
  // ref churn in AuthProvider does not re-run the resolver, while sign-in/out
  // transitions still get a fresh resolution pass.
  const resolvedIdentityRef = useRef<string | null>(null)

  // ---------- Fetch all available interests (catalog) via react-query ----------

  const EMPTY_INTERESTS: Interest[] = useMemo(() => [], [])

  const {
    data: rawInterests,
    isLoading: interestsLoading,
    refetch: refetchInterests,
  } = useQuery<Interest[]>({
    queryKey: [...INTERESTS_QUERY_KEY, user?.id ?? 'anon'],
    queryFn: async () => {
      const cols =
        'id, slug, name, description, parent_id, type, status, visibility, accent_color, icon_name, organization_id, hero_tagline, pricing_text, web_app_url, created_at'

      // Fetch public catalog interests
      const { data: publicData, error: publicError } = await supabase
        .from('interests')
        .select(cols)
        .eq('status', 'active')
        .in('visibility', ['public'])
        .order('name')

      if (publicError) throw publicError

      // Also fetch user-proposed interests (private, owned by current user)
      let proposedData: Interest[] = []
      if (user?.id) {
        const { data, error: proposedError } = await supabase
          .from('interests')
          .select(cols)
          .eq('status', 'active')
          .eq('type', 'user_proposed')
          .eq('created_by_user_id', user.id)
          .order('name')

        if (!proposedError && data) {
          proposedData = data as Interest[]
        }
        logger.debug('Fetched proposed interests:', proposedData.length)
      }

      // Merge and deduplicate (in case a proposed interest was promoted to public)
      const seen = new Set<string>()
      const merged: Interest[] = []
      for (const row of [...(publicData ?? []), ...proposedData]) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          merged.push(row as Interest)
        }
      }

      return merged
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Stable reference: avoid creating a new [] on every render when data is undefined
  const allRows = rawInterests ?? EMPTY_INTERESTS

  // Split into domains and selectable interests
  const domains = useMemo(() => allRows.filter((i) => i.type === 'domain'), [allRows])
  const interests = useMemo(() => allRows.filter((i) => i.type !== 'domain'), [allRows])

  // ---------- Fetch user's added interests from DB ----------

  const {
    data: userInterestIds,
    isLoading: userInterestsLoading,
    refetch: refetchUserInterests,
  } = useQuery<string[]>({
    queryKey: [...USER_INTERESTS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!signedIn || !user?.id) return []
      const { data, error } = await supabase
        .from('user_interests')
        .select('interest_id')
        .eq('user_id', user.id)

      if (error) {
        logger.warn('Failed to fetch user_interests:', error.message)
        return []
      }

      return (data ?? []).map((row: any) => row.interest_id)
    },
    enabled: signedIn && !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Derive userInterests from the DB join
  const userInterests = useMemo(() => {
    if (!signedIn || !user?.id) {
      // Guest users: show all interests (they'll be prompted to sign up)
      return interests
    }
    if (!userInterestIds || userInterestIds.length === 0) return []
    const idSet = new Set(userInterestIds)
    return interests.filter((interest) => idSet.has(interest.id))
  }, [interests, userInterestIds, signedIn, user?.id])

  // Group interests by parent domain
  // Handles two-level nesting: if an interest's parent_id points to another
  // interest (not a domain), we walk up to find the domain ancestor.
  const groupedInterests = useMemo<DomainWithInterests[]>(() => {
    const domainIds = new Set(domains.map((d) => d.id))
    const interestById = new Map(interests.map((i) => [i.id, i]))

    // Resolve the domain id for a given interest
    const resolveDomainId = (interest: Interest): string => {
      if (!interest.parent_id) return '__ungrouped__'
      if (domainIds.has(interest.parent_id)) return interest.parent_id
      // Parent is another interest — walk up one level
      const parent = interestById.get(interest.parent_id)
      if (parent?.parent_id && domainIds.has(parent.parent_id)) return parent.parent_id
      return '__ungrouped__'
    }

    const domainMap = new Map<string, Interest[]>()
    for (const interest of interests) {
      const key = resolveDomainId(interest)
      const list = domainMap.get(key)
      if (list) {
        list.push(interest)
      } else {
        domainMap.set(key, [interest])
      }
    }

    const groups: DomainWithInterests[] = []
    for (const domain of domains) {
      const children = domainMap.get(domain.id) ?? []
      if (children.length > 0) {
        groups.push({ domain, interests: children })
      }
    }

    // Append ungrouped interests under a synthetic domain
    const ungrouped = domainMap.get('__ungrouped__')
    if (ungrouped && ungrouped.length > 0) {
      groups.push({
        domain: { ...ungrouped[0], id: '__ungrouped__', slug: 'other', name: 'Other', type: 'domain' as const, parent_id: null },
        interests: ungrouped,
      })
    }

    return groups
  }, [interests, domains])

  // Lookup: interest id → parent domain (walks up if parent is another interest)
  const getDomainForInterest = useCallback(
    (interestId: string): Interest | null => {
      const interest = interests.find((i) => i.id === interestId)
      if (!interest?.parent_id) return null
      const directParent = domains.find((d) => d.id === interest.parent_id)
      if (directParent) return directParent
      // Walk up: parent might be another interest whose parent is a domain
      const parentInterest = interests.find((i) => i.id === interest.parent_id)
      if (parentInterest?.parent_id) {
        return domains.find((d) => d.id === parentInterest.parent_id) ?? null
      }
      return null
    },
    [interests, domains],
  )

  // ---------- Resolve which interest should be active on mount ----------

  useEffect(() => {
    // Don't resolve until interests have loaded at least once.
    if (interestsLoading || interests.length === 0) return
    // Wait for user interests to load for signed-in users
    if (signedIn && userInterestsLoading) return
    const identityKey = signedIn && user?.id ? `user:${user.id}` : 'guest'
    // Only resolve once per auth identity.
    if (resolvedIdentityRef.current === identityKey) return

    let cancelled = false

    const resolve = async () => {
      setResolving(true)
      let chosenRoute = 'show-interest-selection'

      try {
        // 1. Fast path — check AsyncStorage
        const cachedSlug = await AsyncStorage.getItem(ASYNC_STORAGE_KEY)

        if (cachedSlug && interests.some((i) => i.slug === cachedSlug)) {
          if (!cancelled) {
            setActiveSlug(cachedSlug)
            chosenRoute = 'cached-interest'
          }
        }

        // 2. If signed in, check DB for authoritative preference
        if (signedIn && user?.id) {
          const { data: prefs, error: prefsError } = await supabase
            .from('user_preferences')
            .select('preferred_interest_id')
            .eq('user_id', user.id)
            .maybeSingle()

          if (prefsError && prefsError.code !== 'PGRST116') {
            throw prefsError
          }

          if (!cancelled && prefs?.preferred_interest_id) {
            const matched = interests.find(
              (i) => i.id === prefs.preferred_interest_id,
            )
            if (matched) {
              setActiveSlug(matched.slug)
              chosenRoute = 'db-preferred-interest'
              // Sync AsyncStorage with DB truth
              await AsyncStorage.setItem(ASYNC_STORAGE_KEY, matched.slug)
            }
          }
        }

        // 3. Existing-user fallback for fresh browsers/incognito:
        // if profile indicates this is not a new user, pick a deterministic
        // default and persist it so we don't re-enter onboarding.
        if (signedIn && user?.id && chosenRoute === 'show-interest-selection') {
          const currentProfile = userProfile ?? (await fetchUserProfile(user.id))
          const metadata = (user.user_metadata ?? {}) as Record<string, unknown>

          const explicitSlug = selectExplicitInterestFromSignals({
            profile: currentProfile,
            metadata,
            interests,
          })

          if (!cancelled && explicitSlug) {
            setActiveSlug(explicitSlug.slug)
            chosenRoute = 'server-profile-interest'
            await AsyncStorage.setItem(ASYNC_STORAGE_KEY, explicitSlug.slug)
            await supabase.from('user_preferences').upsert(
              {
                user_id: user.id,
                preferred_interest_id: explicitSlug.id,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' },
            )
          } else if (!cancelled && userInterests.length > 0) {
            // The user has explicitly added interests but has no stored
            // preference yet (e.g. just finished signup). Adding an interest
            // is a stronger signal than the profile-age heuristic below, so
            // activate the first added interest. Without this the app lands on
            // an interest-less Practice tab that spins forever on the
            // starter-step shim (currentInterest null → seeder bails).
            const defaultInterest = userInterests[0]
            setActiveSlug(defaultInterest.slug)
            chosenRoute = 'added-interest-default'
            await AsyncStorage.setItem(ASYNC_STORAGE_KEY, defaultInterest.slug)
            await supabase.from('user_preferences').upsert(
              {
                user_id: user.id,
                preferred_interest_id: defaultInterest.id,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' },
            )
          } else if (!cancelled && hasExistingProfileSignal(currentProfile)) {
            // Existing user with no preference — pick first added interest or fall back
            const defaultInterest = selectDefaultInterestForExistingUser({
              userInterests,
              interests,
            })

            if (defaultInterest) {
              setActiveSlug(defaultInterest.slug)
              chosenRoute = 'existing-user-default-interest'
              await AsyncStorage.setItem(ASYNC_STORAGE_KEY, defaultInterest.slug)
              await supabase.from('user_preferences').upsert(
                {
                  user_id: user.id,
                  preferred_interest_id: defaultInterest.id,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' },
              )
            }
          }

          if (__DEV__) {
            const normalizedProfile = currentProfile as any
            const onboardingComplete = normalizedProfile?.onboarding_completed === true
            const profileExists = !!normalizedProfile?.id
            logger.debug('InterestRouting', {
              userId: user.id,
              profileExists,
              interestsCount: interests.length,
              userInterestsCount: userInterests.length,
              onboardingComplete,
              chosenRoute,
            })
          }
        }

        // 4. If still nothing resolved, leave activeSlug as null.
        //    The InterestSelectionGate in _layout.tsx will show the onboarding
        //    modal so the user can pick their interest.
      } catch {
        // On any failure, leave as-is — the gate will prompt the user.
      } finally {
        if (!cancelled) {
          resolvedIdentityRef.current = identityKey
          setResolving(false)
        }
      }
    }

    resolve()

    return () => {
      cancelled = true
    }
    // Intentionally excludes profile-fetch deps: re-running on profile
    // changes would loop the interest resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestsLoading, userInterestsLoading, interests, userInterests, signedIn, user?.id])

  // ---------- Derived current interest ----------

  const currentInterest = useMemo(() => {
    if (!activeSlug) return null
    // For signed-in users, current interest must be one they've added.
    // For guests, check all interests.
    const pool = signedIn && user?.id ? (userInterests.length > 0 ? userInterests : interests) : interests
    return pool.find((i) => i.slug === activeSlug) ?? null
  }, [activeSlug, userInterests, interests, signedIn, user?.id])

  // Resolver watchdog: web/HMR and auth hydration can leave `resolving` true
  // even after the user's interests are already available. Prefer a stable
  // default interest over a permanent "Loading your interest…" shell.
  useEffect(() => {
    if (!signedIn || !user?.id) return
    if (currentInterest) return
    if (interestsLoading || userInterestsLoading) return
    if (userInterests.length === 0) {
      setResolving(false)
      return
    }

    const fallback = userInterests[0]
    const timeout = setTimeout(() => {
      setActiveSlug(fallback.slug)
      setResolving(false)
      resolvedIdentityRef.current = `user:${user.id}`
      void AsyncStorage.setItem(ASYNC_STORAGE_KEY, fallback.slug)
      void supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          preferred_interest_id: fallback.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
    }, 2500)

    return () => clearTimeout(timeout)
  }, [
    currentInterest,
    interestsLoading,
    signedIn,
    user?.id,
    userInterests,
    userInterestsLoading,
  ])

  const [viewMode, setViewMode] = useState<'interest' | 'domain'>('interest')

  // Derive domain interest IDs from groupedInterests
  const domainInterestIds = useMemo(() => {
    if (!currentInterest) return []
    const group = groupedInterests.find((g) =>
      g.interests.some((i) => i.id === currentInterest.id),
    )
    return group ? group.interests.map((i) => i.id) : [currentInterest.id]
  }, [currentInterest, groupedInterests])

  const effectiveInterestIds = useMemo(() => {
    if (viewMode === 'domain' && domainInterestIds.length > 1) return domainInterestIds
    return currentInterest ? [currentInterest.id] : []
  }, [viewMode, domainInterestIds, currentInterest])

  const toggleDomainView = useCallback(() => {
    setViewMode((prev) => (prev === 'interest' ? 'domain' : 'interest'))
  }, [])

  // Reset to interest view when switching interests
  useEffect(() => {
    setViewMode('interest')
  }, [activeSlug])

  // Auto-select first user interest if active slug is invalid
  useEffect(() => {
    if (!signedIn || !user?.id) return
    if (userInterestsLoading) return
    if (userInterests.length === 0) {
      // User has no interests — activeSlug should be null to trigger onboarding
      if (activeSlug) {
        logger.debug('auto-set: no userInterests, clearing activeSlug')
        setActiveSlug(null)
      }
      return
    }
    if (!activeSlug || !userInterests.some((interest) => interest.slug === activeSlug)) {
      logger.debug('auto-set: activeSlug was', JSON.stringify(activeSlug), '→ setting to', userInterests[0].slug, '(userInterests[0])')
      setActiveSlug(userInterests[0].slug)
    }
  }, [activeSlug, userInterests, userInterestsLoading, signedIn, user?.id])

  // ---------- switchInterest ----------

  const switchInterest = useCallback(
    async (slug: string) => {
      logger.debug('switchInterest called with:', slug, '| current activeSlug:', activeSlug, '| userInterests count:', userInterests.length)
      let target = interests.find((i) => i.slug === slug)

      // Cache may be stale after proposeInterest — fall back to direct DB lookup
      if (!target) {
        logger.debug('switchInterest: slug not in cache, trying DB lookup')
        const { data } = await supabase
          .from('interests')
          .select('id, slug')
          .eq('slug', slug)
          .maybeSingle()
        if (data) {
          target = data as Interest
        }
      }

      if (!target) {
        throw new Error(`Interest with slug "${slug}" not found`)
      }

      // Optimistic local update
      setActiveSlug(slug)

      // Persist to AsyncStorage (works for guests too)
      await AsyncStorage.setItem(ASYNC_STORAGE_KEY, slug)

      // Persist to DB if the user is authenticated
      if (signedIn && user?.id) {
        const { error } = await supabase
          .from('user_preferences')
          .upsert(
            {
              user_id: user.id,
              preferred_interest_id: target.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )

        if (error) {
          // Non-fatal — the local state is already updated
          logger.warn('Failed to persist interest to DB:', error.message)
        }
      }
    },
    [activeSlug, interests, userInterests, signedIn, user?.id],
  )

  // ---------- addInterest (writes to user_interests table) ----------

  const addInterest = useCallback(
    async (slug: string) => {
      const normalized = normalizeSlug(slug)
      if (!normalized) return
      let target = interests.find((interest) => interest.slug === normalized)

      // If interests haven't loaded yet (common during onboarding), look up directly from DB
      if (!target) {
        const { data } = await supabase
          .from('interests')
          .select('id, slug')
          .eq('slug', normalized)
          .maybeSingle()
        if (data) {
          target = data as any
        } else {
          logger.warn('addInterest: interest not found for slug:', normalized)
          return
        }
      }

      if (!target) return

      if (signedIn && user?.id) {
        // Write to DB
        const { error } = await supabase
          .from('user_interests')
          .upsert(
            { user_id: user.id, interest_id: target.id },
            { onConflict: 'user_id,interest_id' },
          )

        if (error) {
          logger.warn('Failed to add interest:', error.message)
          return
        }

        // Refresh the user interests query
        await queryClient.invalidateQueries({ queryKey: [...USER_INTERESTS_QUERY_KEY, user.id] })
      }
    },
    [interests, signedIn, user?.id, queryClient],
  )

  // ---------- removeInterest (deletes from user_interests table) ----------

  const removeInterest = useCallback(
    async (slug: string) => {
      const normalized = normalizeSlug(slug)
      if (!normalized) return
      const target = interests.find((interest) => interest.slug === normalized)
      if (!target) return

      // Don't allow removing the last interest
      if (userInterests.length <= 1) return

      if (signedIn && user?.id) {
        const { error } = await supabase
          .from('user_interests')
          .delete()
          .eq('user_id', user.id)
          .eq('interest_id', target.id)

        if (error) {
          logger.warn('Failed to remove interest:', error.message)
          return
        }

        // Refresh the user interests query
        await queryClient.invalidateQueries({ queryKey: [...USER_INTERESTS_QUERY_KEY, user.id] })

        // If we just removed the active interest, switch to the first remaining
        if (activeSlug === normalized) {
          const remaining = userInterests.filter((i) => i.slug !== normalized)
          if (remaining.length > 0) {
            await switchInterest(remaining[0].slug)
          }
        }
      }
    },
    [interests, userInterests, signedIn, user?.id, activeSlug, queryClient, switchInterest],
  )

  // ---------- proposeInterest (creates a new user_proposed interest) ----------

  const proposeInterest = useCallback(
    async (input: ProposeInterestInput): Promise<Interest> => {
      if (!signedIn || !user?.id) {
        throw new Error('Must be signed in to propose an interest')
      }

      // Check for slug collision
      const { data: existing } = await supabase
        .from('interests')
        .select('id')
        .eq('slug', input.slug)
        .maybeSingle()

      const finalSlug = existing
        ? `${input.slug}-${Date.now().toString(36).slice(-4)}`
        : input.slug

      // Insert the new interest
      const { data: created, error } = await supabase
        .from('interests')
        .insert({
          slug: finalSlug,
          name: input.name,
          description: input.description,
          parent_id: input.parent_id ?? null,
          type: 'user_proposed',
          status: 'active',
          visibility: 'private',
          accent_color: input.accent_color,
          icon_name: input.icon_name,
          created_by_user_id: user.id,
        })
        .select('id, slug, name, description, parent_id, type, status, visibility, accent_color, icon_name, organization_id, hero_tagline, pricing_text, web_app_url, created_at')
        .single()

      if (error) throw error

      const interest = created as Interest

      // Add it to user_interests
      await supabase
        .from('user_interests')
        .upsert(
          { user_id: user.id, interest_id: interest.id },
          { onConflict: 'user_id,interest_id' },
        )

      // Refresh caches
      await queryClient.invalidateQueries({ queryKey: INTERESTS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: [...USER_INTERESTS_QUERY_KEY, user.id] })

      return interest
    },
    [signedIn, user?.id, queryClient],
  )

  // ---------- refreshInterests ----------

  const refreshInterests = useCallback(async () => {
    await Promise.all([
      refetchInterests(),
      refetchUserInterests(),
    ])
  }, [refetchInterests, refetchUserInterests])

  // ---------- Loading state ----------

  const loading = interestsLoading || resolving || (signedIn ? userInterestsLoading : false)

  // ---------- Context value (memoised) ----------

  const value = useMemo<InterestContextValue>(
    () => ({
      currentInterest,
      allInterests: interests,
      userInterests,
      domains,
      groupedInterests,
      getDomainForInterest,
      loading,
      switchInterest,
      addInterest,
      removeInterest,
      proposeInterest,
      refreshInterests,
      viewMode,
      domainInterestIds,
      effectiveInterestIds,
      toggleDomainView,
    }),
    [currentInterest, interests, userInterests, domains, groupedInterests, getDomainForInterest, loading, switchInterest, addInterest, removeInterest, proposeInterest, refreshInterests, viewMode, domainInterestIds, effectiveInterestIds, toggleDomainView],
  )

  return (
    <InterestContext.Provider value={value}>
      {children}
    </InterestContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInterest(): InterestContextValue {
  const ctx = useContext(InterestContext)
  if (ctx === undefined) {
    throw new Error('useInterest must be used within an <InterestProvider>')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { InterestContext }
export default InterestProvider
