import { signOutEverywhere } from '@/lib/auth-actions'
import { extractOAuthDisplayName } from '@/lib/utils/oauthName'
import { nativeGoogleSignIn, nativeAppleSignIn, signOutFromNativeProviders } from '@/lib/auth/nativeOAuth'
import { createLogger } from '@/lib/utils/logger'
import { clearLastTab } from '@/lib/utils/lastTab'
import { clearLastViewState } from '@/lib/utils/lastViewState'
import { GuestStorageService } from '@/services/GuestStorageService'
import { OnboardingStateService } from '@/services/onboarding/OnboardingStateService'
import { setSentryUser } from '@/lib/sentry'
import { supabase, UserType } from '@/services/supabase'
import { bindAuthDiagnostics } from '@/utils/authDebug'
import { logAuthEvent, logAuthState } from '@/utils/errToText'
import { AuthApiError } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { UserCapabilities, DEFAULT_CAPABILITIES, CapabilityType } from '@/types/capabilities'

// Re-export UserType for backward compatibility
export type { UserType } from '@/services/supabase'
// Export capabilities types for consumers
export type { UserCapabilities, CapabilityType } from '@/types/capabilities'

type PersonaRole = Exclude<UserType, null>;
const DEFAULT_PERSONA: PersonaRole = 'sailor';

// Bind diagnostics once at app boot
bindAuthDiagnostics(supabase)

const logger = createLogger('AuthProvider');
const AUTH_DEBUG_ENABLED = false // Set to true for debugging auth issues
const authDebugLog = (...args: Parameters<typeof logger.debug>) => {
  if (!AUTH_DEBUG_ENABLED) {
    return
  }
  logger.debug(...args)
}

// Safe localStorage access - returns null on native platforms where localStorage doesn't exist
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  }
};

const isInvalidRefreshTokenError = (error: unknown): error is AuthApiError => {
  if (!error || typeof (error as any)?.message !== 'string') {
    return false;
  }
  return /refresh token/i.test((error as any).message);
};

// Smart API_BASE detection with local development fallback
const getApiBase = () => {
  const envApiBase =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_BASE_URL ||
    process.env.EXPO_PUBLIC_WEB_BASE_URL ||
    ''

  // If we're on localhost (Expo dev) but env points to production, use local vercel dev server
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1'
    const isProductionApi = envApiBase.includes('vercel.app') || envApiBase.includes('regattaflow.io')
    
    if (isLocalhost && isProductionApi) {
      if (AUTH_DEBUG_ENABLED) {
        logger.debug('🔄 Auto-switching to local vercel dev server (localhost:3000)')
      }
      return 'http://localhost:3000'
    }
  }

  return envApiBase
}

const API_BASE = getApiBase()
const POST_LOGOUT_AUTH_KEY = 'rf_force_auth_after_logout'

// 🔍 DEBUG: Log env vars at module load time
if (AUTH_DEBUG_ENABLED) {
  logger.debug('🔍 ENV DEBUG:', {
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_BASE_URL: process.env.EXPO_PUBLIC_BASE_URL,
    EXPO_PUBLIC_WEB_BASE_URL: process.env.EXPO_PUBLIC_WEB_BASE_URL,
    RESOLVED_API_BASE: API_BASE,
  })
}

type AuthState = 'checking' | 'signed_out' | 'guest' | 'ready'

type AuthCtx = {
  state: AuthState
  ready: boolean
  signedIn: boolean
  isGuest: boolean
  user: any | null
  loading: boolean
  personaLoading: boolean
  signIn: (identifier: string, password: string) => Promise<void>
  signUp: (email: string, username: string, password: string, persona: PersonaRole) => Promise<any>
  signOut: () => Promise<void>
  signInWithGoogle: (persona?: PersonaRole) => Promise<void>
  signInWithApple: (persona?: PersonaRole) => Promise<void>
  enterGuestMode: () => void
  /** True if user was authenticated at some point in this session (helps detect token expiry vs. fresh visit) */
  wasAuthenticated: boolean
  biometricAvailable: boolean
  biometricEnabled: boolean
  userProfile?: any
  userType?: UserType
  /** User capabilities (coaching, etc.) - additive on top of base user type */
  capabilities: UserCapabilities
  clubProfile: any | null
  coachProfile: any | null
  refreshPersonaContext: () => Promise<void>
  updateUserProfile: (updates: any) => Promise<void>
  fetchUserProfile: (userId?: string) => Promise<any>
  /** Add a capability to the current user (e.g., 'coaching') */
  addCapability: (type: CapabilityType) => Promise<void>
  isDemoSession: boolean
}

const Ctx = createContext<AuthCtx>({
  state: 'checking',
  ready: false,
  signedIn: false,
  isGuest: false,
  user: null,
  loading: false,
  personaLoading: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  enterGuestMode: () => {},
  wasAuthenticated: false,
  biometricAvailable: false,
  biometricEnabled: false,
  clubProfile: null,
  coachProfile: null,
  capabilities: DEFAULT_CAPABILITIES,
  refreshPersonaContext: async () => {},
  updateUserProfile: async () => {},
  fetchUserProfile: async (_userId?: string) => null,
  addCapability: async () => {},
  userType: null,
  userProfile: null,
  isDemoSession: false,
})

export function AuthProvider({children}:{children: React.ReactNode}) {
  const [ready, setReady] = useState(false) // Start as not ready until we check session
  const [signedIn, setSignedIn] = useState(false)
  const [isGuest, setIsGuest] = useState(false) // Guest mode for freemium experience
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [personaLoading, setPersonaLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [userType, setUserType] = useState<UserType>(null)
  const [clubProfile, setClubProfile] = useState<any | null>(null)
  const [coachProfile, setCoachProfile] = useState<any | null>(null)
  const [capabilities, setCapabilities] = useState<UserCapabilities>(DEFAULT_CAPABILITIES)
  const [isDemoSession, setIsDemoSession] = useState(false)

  // Track whether the user was ever authenticated in this session.
  // Used to distinguish "fresh visitor" from "token expired" — prevents
  // races.tsx from entering guest mode when the user should be re-authing.
  const wasAuthenticatedRef = useRef(false)

  const setPostLogoutAuthFlag = useCallback(async () => {
    try {
      await AsyncStorage.setItem(POST_LOGOUT_AUTH_KEY, '1')
      safeLocalStorage.setItem(POST_LOGOUT_AUTH_KEY, '1')
    } catch {}
  }, [])

  const consumePostLogoutAuthFlag = useCallback(async () => {
    try {
      const nativeValue = await AsyncStorage.getItem(POST_LOGOUT_AUTH_KEY)
      const webValue = safeLocalStorage.getItem(POST_LOGOUT_AUTH_KEY)
      const shouldForceAuth = nativeValue === '1' || webValue === '1'
      if (shouldForceAuth) {
        await AsyncStorage.removeItem(POST_LOGOUT_AUTH_KEY)
        safeLocalStorage.removeItem(POST_LOGOUT_AUTH_KEY)
      }
      return shouldForceAuth
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    consumePostLogoutAuthFlagRef.current = consumePostLogoutAuthFlag
  }, [consumePostLogoutAuthFlag])

  // Ref to prevent duplicate profile fetches during race conditions
  const profileFetchInProgress = useRef<string | null>(null)

  // Ref to track if initial auth check is in progress (prevents onAuthStateChange from racing with initializeAuth)
  const initialAuthInProgress = useRef(true)
  const readyRef = useRef(ready)
  const userProfileRef = useRef<any>(userProfile)
  const userTypeRef = useRef<UserType>(userType)
  const fetchUserProfileRef = useRef<(userId?: string) => Promise<any>>(async () => null)
  const consumePostLogoutAuthFlagRef = useRef<() => Promise<boolean>>(async () => false)

  useEffect(() => {
    readyRef.current = ready
  }, [ready])

  useEffect(() => {
    userProfileRef.current = userProfile
  }, [userProfile])

  useEffect(() => {
    userTypeRef.current = userType
  }, [userType])

  const clearInvalidSession = useCallback(async (context: string, error?: unknown) => {
    authDebugLog(`[AUTH] Clearing invalid session (${context})`, {
      message: (error as any)?.message,
    })
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (signOutError) {
      console.warn(`[AUTH] Failed to sign out after invalid session (${context}):`, signOutError)
    }
    setSignedIn(false)
    setUser(null)
    setUserProfile(null)
    setUserType(null)
    setLoading(false)
    setPersonaLoading(false)
    setClubProfile(null)
    setCoachProfile(null)
    setCapabilities(DEFAULT_CAPABILITIES)
  }, [])

  const fetchUserProfile = async (userId?: string) => {
    const uid = userId || user?.id
    authDebugLog('[fetchUserProfile] Called with userId:', uid)
    if (!uid) {
      authDebugLog('[fetchUserProfile] ❌ No userId provided')
      return null
    }

    // Prevent duplicate fetches during race conditions (e.g., initializeAuth + onAuthStateChange)
    if (profileFetchInProgress.current === uid) {
      authDebugLog('[fetchUserProfile] Skipping duplicate fetch for:', uid)
      return null
    }
    profileFetchInProgress.current = uid

    const inferUserType = async (): Promise<PersonaRole> => {
      // 1. Check coach profile
      const { data: coachProfile, error: coachError } = await supabase
        .from('coach_profiles')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle();

      if (coachProfile && !coachError) {
        authDebugLog('[fetchUserProfile] Inferred coach persona from coach_profiles');
        return 'coach';
      }

      if (coachError && coachError.code !== 'PGRST116') {
        authDebugLog('[fetchUserProfile] coach_profiles lookup error:', coachError.message);
      }

      // 2. Check club profile ownership
      const { data: clubProfile, error: clubError } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle();

      if (clubProfile && !clubError) {
        authDebugLog('[fetchUserProfile] Inferred club persona from club_profiles');
        return 'club';
      }

      if (clubError && clubError.code !== 'PGRST116') {
        authDebugLog('[fetchUserProfile] club_profiles lookup error:', clubError.message);
      }

      authDebugLog('[fetchUserProfile] Falling back to default persona');
      return DEFAULT_PERSONA;
    };

    try {
      authDebugLog('[fetchUserProfile] Querying database for user:', uid)

      // Add timeout to prevent hanging forever on network issues
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .maybeSingle()

      // 20s timeout — 5s was tripping on slow networks and wiping state.
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout after 20 seconds')), 20000)
      )

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      authDebugLog('[fetchUserProfile] Database response:', {
        hasData: !!data,
        hasError: !!error,
        user_type: data?.user_type,
        onboarding_completed: data?.onboarding_completed,
        error: error?.message
      })

      if (error) {
        return null
      }

      if (!data) {
        return null
      }

      let resolvedProfile = data
      const userTypeWasMissing = !data?.user_type

      let resolvedUserType: PersonaRole = userTypeWasMissing
        ? await inferUserType()
        : (data.user_type as PersonaRole)

      // Backfill full_name if missing (common for Apple/Google OAuth users)
      const needsNameBackfill = !data?.full_name && user

      if (userTypeWasMissing || needsNameBackfill) {
        authDebugLog('[fetchUserProfile] Backfilling profile:', { userTypeWasMissing, needsNameBackfill })
        const updatePayload: Record<string, any> = {}

        if (userTypeWasMissing) {
          updatePayload.user_type = resolvedUserType
          updatePayload.onboarding_completed = true
        }
        if (needsNameBackfill) {
          const backfilledName = extractOAuthDisplayName(user?.user_metadata)
            || (data?.email ? data.email.split('@')[0] : '')
          if (backfilledName) {
            updatePayload.full_name = backfilledName
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          try {
            await supabase
              .from('users')
              .update(updatePayload)
              .eq('id', uid)
          } catch (updateError) {
            console.warn('[fetchUserProfile] Failed to backfill profile:', updateError)
          }
        }

        resolvedProfile = {
          ...data,
          ...updatePayload,
          ...(userTypeWasMissing ? { user_type: resolvedUserType, onboarding_completed: true } : {}),
        }
      }

      authDebugLog('[fetchUserProfile] Setting userProfile and userType')
      setUserProfile(resolvedProfile)
      setUserType(resolvedUserType as UserType)
      profileFetchInProgress.current = null
      return resolvedProfile
    } catch (error) {
      // On timeout, NEVER overwrite an already-loaded profile (a transient
      // network blip would otherwise wipe name / avatar / home_club / etc.).
      // If nothing is loaded yet, also leave userProfile as-is and return
      // null — the consumer can show a loading state and the next fetch
      // attempt will fill it in. The previous behavior of stubbing
      // { id, user_type: 'sailor' } caused real users to be silently
      // demoted to a blank sailor profile on slow networks.
      const isTimeout = error instanceof Error && error.message.includes('timeout')
      if (isTimeout) {
        profileFetchInProgress.current = null
        return null
      }

      profileFetchInProgress.current = null
      return null
    }
  }

  fetchUserProfileRef.current = fetchUserProfile

  const updateUserProfile = async (updates: any) => {
    const uid = user?.id
    if (!uid) throw new Error('No user ID available')

    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .maybeSingle()

      let result
      if (existingProfile) {
        // Update existing profile
        result = await supabase
          .from('users')
          .update(updates)
          .eq('id', uid)
          .select()
          .single()
      } else {
        // Create new profile - include email and full_name from auth user
        const profileData = {
          id: uid,
          email: user?.email || '',
          full_name: extractOAuthDisplayName(user?.user_metadata) || '',
          ...updates
        }

        try {
          result = await supabase
            .from('users')
            .insert(profileData)
            .select()
            .single()
        } catch (insertError: any) {
          // If insert fails due to duplicate key (profile was created by trigger), try to fetch existing profile
          if (insertError.code === '23505') {
            const { error: fetchError } = await supabase
              .from('users')
              .select('*')
              .eq('id', uid)
              .single()

            if (fetchError) throw fetchError

            // Now update the existing profile with the provided updates
            result = await supabase
              .from('users')
              .update(updates)
              .eq('id', uid)
              .select()
              .single()
          } else {
            throw insertError
          }
        }
      }

      if (result.error) throw result.error

      setUserProfile(result.data)
      setUserType(result.data?.user_type as UserType)

      // Sync name to profiles table (belt + suspenders with DB trigger)
      if (updates.full_name) {
        supabase
          .from('profiles')
          .update({ full_name: updates.full_name })
          .eq('id', uid)
          .then(({ error: profileErr }) => {
            if (profileErr) console.warn('Failed to sync name to profiles:', profileErr.message)
          })
      }

      return result.data
    } catch (error) {
      console.error('Failed to update user profile:', error)
      throw error
    }
  }

  const loadPersonaContext = useCallback(async () => {
    const currentUserId = user?.id
    authDebugLog('[loadPersonaContext] Called with:', {
      userId: currentUserId,
      userType,
      isDemoSession,
      clubId: userProfile?.club_id ?? null
    })

    if (!currentUserId || isDemoSession) {
      authDebugLog('[loadPersonaContext] Early return - no user or demo session')
      setClubProfile(null)
      setCoachProfile(null)
      setCapabilities(DEFAULT_CAPABILITIES)
      setPersonaLoading(false)
      return
    }

    setPersonaLoading(true)
    authDebugLog('[loadPersonaContext] Starting to load persona context')

    // Direct Supabase query for club profile - no external API needed
    const resolveClubWorkspaceDirect = async () => {
      authDebugLog('[loadPersonaContext] Resolving club workspace directly from Supabase')

      // First check if user has a club membership (avoid relation joins; resolve club in a second query)
      const { data: membership, error: membershipError } = await supabase
        .from('club_members')
        .select('*')
        .eq('user_id', currentUserId)
        .maybeSingle()

      if (membershipError && membershipError.code !== 'PGRST116') {
        authDebugLog('[loadPersonaContext] Club membership query error:', membershipError)
        throw membershipError
      }

      if (membership?.club_id) {
        const { data: membershipClub, error: membershipClubError } = await supabase
          .from('clubs')
          .select('*')
          .eq('id', membership.club_id)
          .maybeSingle()

        if (membershipClubError && membershipClubError.code !== 'PGRST116') {
          authDebugLog('[loadPersonaContext] Club lookup from membership failed:', membershipClubError)
          throw membershipClubError
        }

        if (membershipClub) {
          authDebugLog('[loadPersonaContext] Found club via membership:', membershipClub.name)
          return { club: membershipClub, membership }
        }
      }

      // Check if user owns a club via club_members with role='owner'
      const { data: ownerMembership, error: ownerError } = await supabase
        .from('club_members')
        .select('*, clubs(*)')
        .eq('user_id', currentUserId)
        .eq('role', 'owner')
        .maybeSingle()

      if (ownerError && ownerError.code !== 'PGRST116') {
        authDebugLog('[loadPersonaContext] Owner membership query error:', ownerError)
        throw ownerError
      }

      if (ownerMembership?.clubs) {
        authDebugLog('[loadPersonaContext] Found owned club:', (ownerMembership.clubs as any).name)
        return { club: ownerMembership.clubs, membership: { role: 'owner' } }
      }

      authDebugLog('[loadPersonaContext] No club found for user')
      return null
    }

    try {
      // 1. Load user capabilities from user_capabilities table
      authDebugLog('[loadPersonaContext] Loading user capabilities...')
      const { data: capabilityRecords, error: capError } = await supabase
        .from('user_capabilities')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (capError && capError.code !== 'PGRST116') {
        authDebugLog('[loadPersonaContext] Capabilities query error:', capError.message)
      }

      const hasCoachingCapability = capabilityRecords?.some(
        (c: any) => c.capability_type === 'coaching'
      ) ?? false

      authDebugLog('[loadPersonaContext] Capabilities loaded:', {
        hasCoaching: hasCoachingCapability,
        count: capabilityRecords?.length ?? 0
      })

      // 2. Always try to load coach profile (for robustness - in case capability insert failed)
      authDebugLog('[loadPersonaContext] Loading coach profile with user.id:', user.id)

      const { data: coachData, error: coachError } = await supabase
        .from('coach_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      authDebugLog('[loadPersonaContext] Coach profile query result:', {
        hasData: !!coachData,
        profilePublished: coachData?.profile_published,
        error: coachError?.message
      })

      if (coachError && coachError.code !== 'PGRST116') {
        console.warn('[loadPersonaContext] Coach profile query error:', coachError.message)
      }

      const loadedCoachProfile = coachData ?? null
      setCoachProfile(loadedCoachProfile)
      authDebugLog('[loadPersonaContext] Coach profile set:', !!loadedCoachProfile)

      // 3. Determine hasCoaching - use capability OR legacy user_type OR published coach profile
      const hasCoaching = hasCoachingCapability || userType === 'coach' || loadedCoachProfile?.profile_published === true

      // 4. Update capabilities state with loaded data
      setCapabilities({
        hasCoaching,
        coachingProfile: loadedCoachProfile,
        rawCapabilities: capabilityRecords ?? [],
      })

      // 4. Load club context if applicable
      const effectiveUserType =
        userType ?? (userProfile?.club_id ? ('club' as UserType) : null)

      if (effectiveUserType === 'club' || userProfile?.club_id) {
        authDebugLog('[loadPersonaContext] Loading club profile for user:', currentUserId)

        const workspace = await resolveClubWorkspaceDirect()

        authDebugLog('[loadPersonaContext] Workspace result:', {
          hasClub: !!workspace?.club,
          clubId: workspace?.club?.id ?? null,
          role: workspace?.membership?.role ?? null,
        })

        if (workspace?.club) {
          setClubProfile(workspace.club)
          if (workspace.club.id) {
            setUserProfile((prev: any) =>
              prev ? { ...prev, club_id: workspace.club.id } : prev
            )
          }
        } else {
          // Club user without a club yet - that's fine, they'll create one in onboarding
          setClubProfile(null)
        }
      } else {
        setClubProfile(null)
      }
    } catch (error) {
      console.error('[AuthProvider] Failed to load persona context:', error)
      authDebugLog('[loadPersonaContext] Exception caught:', error)
      setClubProfile(null)
      setCoachProfile(null)
      setCapabilities(DEFAULT_CAPABILITIES)
    } finally {
      setPersonaLoading(false)
      authDebugLog('[loadPersonaContext] Completed, personaLoading set to false')
    }
  }, [user?.id, userType, isDemoSession, userProfile?.club_id])

  // Detect tokens passed via URL for web→mobile auth handoff (BetterAt dev flow)
  useEffect(() => {
    // This flow only applies on web — `window.location.search` is a browser-only
    // concept. The previous guard (`typeof window === 'undefined' || !window.location?.search`)
    // crashed on Android Hermes, which provides a stub `window` where accessing
    // `location.search` can throw "Cannot read property 'search' of undefined".
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !window.location || typeof window.location.search !== 'string' || !window.location.search) return;
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) return;

    authDebugLog('[AUTH] Handoff tokens detected in URL, setting session...');
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) authDebugLog('[AUTH] Handoff setSession failed:', error);
        else authDebugLog('[AUTH] Handoff session set successfully');
        // Clean tokens from URL
        const clean = new URL(window.location.href);
        clean.searchParams.delete('access_token');
        clean.searchParams.delete('refresh_token');
        window.history.replaceState({}, '', clean.toString());
      });
  }, []);

  // Initial auth state setup with proper session restoration
  useEffect(() => {
    authDebugLog('🔥 [AUTH] useEffect initialization starting...')
    let alive = true

    const initializeAuth = async () => {
      try {
        authDebugLog('[AUTH] Starting initialization...')

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          authDebugLog('[AUTH] getSession error:', sessionError)
          if (isInvalidRefreshTokenError(sessionError)) {
            console.warn('[AUTH] Invalid refresh token detected - clearing session and redirecting to login')
            await clearInvalidSession('getSession', sessionError)
            setReady(true)
            // Redirect to login page
            try {
              router.replace('/(auth)/login')
            } catch (navError) {
              // Fallback: reload to clear bad state
              if (typeof window !== 'undefined') {
                window.location.href = '/'
              }
            }
            return
          }
        }

        if (!alive) {
          return
        }

        const session = sessionData?.session
        const authUser = session?.user

        authDebugLog('[AUTH] Session check result:', {
          hasSession: !!session,
          hasUser: !!authUser,
          userEmail: authUser?.email
        })

        setSignedIn(!!session)
        setUser(authUser || null)

        // If no session, check if user has guest data (freemium mode)
        if (!session) {
          const shouldForceAuth = await consumePostLogoutAuthFlagRef.current()
          if (shouldForceAuth) {
            setIsGuest(false)
            setReady(true)
            try {
              router.replace('/(auth)/login')
            } catch {}
            return
          }

          const hasGuestRace = await GuestStorageService.hasGuestRace()
          if (hasGuestRace) {
            authDebugLog('[AUTH] Guest race found, entering guest mode')
            setIsGuest(true)
          }
        }

        if (authUser?.id) {
          authDebugLog('[AUTH] Fetching user profile for:', authUser.id)
          try {
            const profile = await fetchUserProfileRef.current(authUser.id)
            authDebugLog('[AUTH] Profile fetch result:', {
              hasProfile: !!profile,
              user_type: profile?.user_type,
              onboarding_completed: profile?.onboarding_completed,
              email: profile?.email
            })
            if (profile?.user_type) {
              setUserType(profile.user_type as UserType)
              authDebugLog('[AUTH] userType set to:', profile.user_type)
            } else {
              setUserType(null)
            }
          } catch (e) {
            console.error('[AUTH] User profile fetch failed:', e)
            setUserType(null)
          }
        } else {
          setUserType(null)
          authDebugLog('[AUTH] No authUser.id')
        }

        authDebugLog('[AUTH] Initialization complete, setting ready=true')
        initialAuthInProgress.current = false
        setReady(true)
      } catch (e) {
        console.error('[AUTH] Initialization failed:', e)
        initialAuthInProgress.current = false
        if (alive) setReady(true)
      }
    }

    // Set a watchdog timer as fallback
    const watchdogTimer = setTimeout(() => {
      if (alive && !readyRef.current) {
        initialAuthInProgress.current = false
        setReady(true)
      }
    }, 3000)

    initializeAuth()

    return () => {
      alive = false
      clearTimeout(watchdogTimer)
    }
  }, [clearInvalidSession]) // Run once on mount

  useEffect(() => {
    if (!signedIn || !user?.id || isDemoSession) {
      setClubProfile(null)
      setCoachProfile(null)
      setCapabilities(DEFAULT_CAPABILITIES)
      setPersonaLoading(false)
      return
    }

    loadPersonaContext()
  }, [loadPersonaContext, signedIn, user?.id, userType, isDemoSession])

  // Auth state change listener - depends on router for navigation
  useEffect(()=>{
    let alive = true

    const {data:sub} = supabase.auth.onAuthStateChange(async (evt, session)=>{
      authDebugLog('🔔 [AUTH] ===== AUTH STATE CHANGE EVENT =====')
      authDebugLog('🔔 [AUTH] Event:', evt, 'hasSession:', !!session)
      authDebugLog('🔔 [AUTH] Component alive:', alive)

      // Enhanced diagnostics
      logAuthEvent('auth_state_change', {
        event: evt,
        hasSession: !!session,
        sessionUser: session?.user?.email || 'N/A',
        componentAlive: alive
      })

      if (!alive) {
        authDebugLog('🔔 [AUTH] Component not alive, returning early')
        return
      }

      authDebugLog('🔔 [AUTH] Updating auth state...')
      setSignedIn(!!session)
      setUser(session?.user || null)
      // Identify user in Sentry for error attribution
      setSentryUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
      if (session?.user) {
        wasAuthenticatedRef.current = true
        setIsDemoSession(false)
        setIsGuest(false) // Clear guest mode when user signs in
      }
      authDebugLog('🔔 [AUTH] Auth state updated:', { signedIn: !!session, hasUser: !!session?.user })

      // Log updated state
      logAuthState('after_state_update', {
        ready: true, // We're in auth listener so ready should be true
        signedIn: !!session,
        user: session?.user,
        userProfile: userProfileRef.current,
        userType: userTypeRef.current,
        loading: false
      })

      // Note: TOKEN_REFRESH_FAILED may not be in Supabase's type union but we handle it defensively
      if (evt === 'SIGNED_OUT' || (evt as string) === 'TOKEN_REFRESH_FAILED') {
        const reason =
          (evt as string) === 'TOKEN_REFRESH_FAILED'
            ? 'TOKEN_REFRESH_FAILED (invalid/expired session)'
            : 'SIGNED_OUT';
        authDebugLog(`🚪 [AUTH] ===== ${reason} EVENT RECEIVED =====`)
        authDebugLog('🚪 [AUTH] Starting state cleanup...')

        if ((evt as string) === 'TOKEN_REFRESH_FAILED') {
          console.warn('[AUTH] Token refresh failed. Clearing session and forcing re-authentication.')
          await clearInvalidSession('auth_state_change:refresh_failed')
        }

        // Clear all cached auth state
        authDebugLog('🚪 [AUTH] Clearing signedIn state...')
        setSignedIn(false)
        authDebugLog('🚪 [AUTH] Clearing user state...')
        setUser(null)
        setIsGuest(false)
        authDebugLog('🚪 [AUTH] Clearing userProfile state...')
        setUserProfile(null)
        authDebugLog('🚪 [AUTH] Clearing userType state...')
        setUserType(null)
        authDebugLog('🚪 [AUTH] Clearing loading state...')
        setLoading(false)
        setPersonaLoading(false)
        setClubProfile(null)
        setCoachProfile(null)
        setCapabilities(DEFAULT_CAPABILITIES)

        authDebugLog('🚪 [AUTH] State cleanup complete. Starting navigation...')
        
        // Explicit sign-out should route to landing page.
        authDebugLog('🚪 [AUTH] Navigating to landing page...')
        try {
          if (typeof window !== 'undefined') {
            authDebugLog('🚪 [AUTH] Replacing browser history state to landing...')
            window.history.replaceState(null, '', '/')
          }
          router.replace('/')
        } catch (historyError) {
          console.warn('🚪 [AUTH] History replace error:', historyError)
          // Fallback: force navigation to landing
          try {
            router.replace('/')
          } catch (navError) {
            console.warn('🚪 [AUTH] Navigation fallback failed:', navError)
          }
        }
        authDebugLog('🚪 [AUTH] ===== SIGNED_OUT HANDLER COMPLETE =====')
      }

      if (evt === 'SIGNED_IN' && session?.user?.id) {
        authDebugLog('🔔 [AUTH] SIGNED_IN event - fetching profile...')

        // Skip profile fetch if initial auth is still in progress - initializeAuth will handle it
        if (initialAuthInProgress.current) {
          authDebugLog('🔔 [AUTH] ⏭️ Skipping profile fetch - initial auth in progress')
          return
        }

        // Use loading state instead of toggling ready (prevents infinite loop)
        setLoading(true)
        authDebugLog('🔔 [AUTH] Set loading=true while fetching profile')

        try {
          // Check for guest race data to migrate
          try {
            const hasGuestRace = await GuestStorageService.hasGuestRace()
            if (hasGuestRace) {
              authDebugLog('🔔 [AUTH] Found guest race data, migrating to account...')
              const newRaceId = await GuestStorageService.migrateToAccount(session.user.id)
              if (newRaceId) {
                authDebugLog('🔔 [AUTH] Successfully migrated guest race:', newRaceId)
                await GuestStorageService.clearGuestData()
              }
            }
          } catch (migrationError) {
            console.warn('[AUTH] Guest data migration failed, continuing anyway:', migrationError)
          }

          // Check for pending race data (saved when guest tried to add 2nd race before signup)
          try {
            const pendingRace = await GuestStorageService.getPendingRace()
            if (pendingRace) {
              authDebugLog('🔔 [AUTH] Found pending race data, migrating to account...')
              const newPendingRaceId = await GuestStorageService.migratePendingRaceToAccount(session.user.id)
              if (newPendingRaceId) {
                authDebugLog('🔔 [AUTH] Successfully migrated pending race:', newPendingRaceId)
              }
            }
          } catch (pendingMigrationError) {
            console.warn('[AUTH] Pending race migration failed, continuing anyway:', pendingMigrationError)
          }

          // Fetch profile and update state - let gates handle routing
          authDebugLog('🔔 [AUTH] Fetching profile data...')
          const profileData = await fetchUserProfileRef.current(session.user.id)
          authDebugLog('🔔 [AUTH] Profile data received:', profileData)
          if (profileData?.user_type) {
            setUserType(profileData.user_type as UserType)
            authDebugLog('🔔 [AUTH] ✅ userType set')
          } else {
            authDebugLog('🔔 [AUTH] ⚠️ No user_type on profile')
          }
          authDebugLog('🔔 [AUTH] State updated - gates will handle routing')
        } catch (e) {
          console.warn('[AUTH] Profile fetch error:', e)
          setUserType(null)
        } finally {
          setLoading(false)
          authDebugLog('🔔 [AUTH] Profile fetch complete, loading=false')
        }
      }
    })

    return ()=>{ alive=false; sub.subscription.unsubscribe() }
  }, [clearInvalidSession])

  const identifierToAuthEmail = (value: string) => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      throw new Error('Identifier is required')
    }
    if (normalized.includes('@')) {
      return normalized
    }
    return `${normalized}@users.regattaflow.io`
  }

  const signIn = async (identifier: string, password: string) => {
    const email = identifierToAuthEmail(identifier)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Set user and signedIn state - profile fetch will happen in onAuthStateChange
      if (data.user?.id) {
        setUser(data.user)
        setSignedIn(true)
        // Don't fetch profile here - let onAuthStateChange handle it to avoid duplication
      }

      // Don't set loading(false) here - let onAuthStateChange handle it after user/profile are set
    } catch (error: any) {
      console.error('🔐 [AUTH] signIn error:', error)
      setLoading(false)
      throw error
    }
    // Note: Don't set loading(false) in finally - let onAuthStateChange handle it
  }

  const signOut = async () => {
    // Clear saved tab and view state so next login starts fresh
    clearLastTab();
    clearLastViewState();

    authDebugLog('🚪 [AUTH] ===== SIGNOUT PROCESS STARTING =====')
    authDebugLog('🚪 [AUTH] Current state before signOut:', {
      signedIn,
      user: !!user,
      userProfile: !!userProfile,
      loading,
      ready
    })

    // Force auth-first behavior after explicit logout.
    await setPostLogoutAuthFlag()

    // Navigate to landing page immediately before clearing auth state.
    authDebugLog('🚪 [AUTH] Navigating to landing page immediately...')
    try {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/')
      }
      router.replace('/')
    } catch (navError) {
      console.warn('🚪 [AUTH] Initial navigation error:', navError)
    }

    if (isDemoSession) {
      authDebugLog('🚪 [AUTH] Demo session detected, performing local sign out.')
      setSignedIn(false)
      setIsGuest(false)
      setUser(null)
      setUserProfile(null)
      setUserType(null)
      setPersonaLoading(false)
      setLoading(false)
      setClubProfile(null)
      setCoachProfile(null)
      setCapabilities(DEFAULT_CAPABILITIES)
      setIsDemoSession(false)
      return
    }

    setLoading(true)
    authDebugLog('🚪 [AUTH] Loading set to true')

    let fallbackTriggered = false

    const fallbackTimer = setTimeout(() => {
      if (!fallbackTriggered) {
        console.warn('🚪 [AUTH] Fallback signOut triggered (timeout)')
        fallbackTriggered = true
        setSignedIn(false)
        setIsGuest(false)
        setUser(null)
        setUserProfile(null)
        setUserType(null)
        setLoading(false)
        setPersonaLoading(false)
        setClubProfile(null)
        setCoachProfile(null)
        setCapabilities(DEFAULT_CAPABILITIES)
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState(null, '', '/')
          } catch (historyError) {
            console.warn('🚪 [AUTH] History replace failed in fallback:', historyError)
          }
        }
        router.replace('/')
      }
    }, 4000)

    try {
      authDebugLog('🚪 [AUTH] About to call signOutEverywhere()...')
      await signOutEverywhere()
      authDebugLog('🚪 [AUTH] signOutEverywhere() completed successfully')

      // Sign out from native OAuth providers (Google, etc.)
      if (Platform.OS !== 'web') {
        await signOutFromNativeProviders()
        authDebugLog('🚪 [AUTH] Native OAuth providers signed out')
      }

      // Clear state immediately - don't wait for SIGNED_OUT event
      // (Event may not fire if network is down but local storage was cleared)
      authDebugLog('🚪 [AUTH] Clearing auth state immediately after local cleanup...')
      setSignedIn(false)
      setIsGuest(false)
      setUser(null)
      setUserProfile(null)
      setUserType(null)
      setLoading(false)
      setPersonaLoading(false)
      setClubProfile(null)
      setCoachProfile(null)
      setCapabilities(DEFAULT_CAPABILITIES)
      clearTimeout(fallbackTimer)
      authDebugLog('🚪 [AUTH] Auth state cleared successfully')
    } catch (error) {
      console.error('🚪 [AUTH] ERROR in signOut process:', error)
      authDebugLog('🚪 [AUTH] Manual cleanup due to error')
      setSignedIn(false)
      setUser(null)
      setUserProfile(null)
      setUserType(null)
      setLoading(false)
      setPersonaLoading(false)
      setClubProfile(null)
      setCoachProfile(null)
      setCapabilities(DEFAULT_CAPABILITIES)
      if (typeof window !== 'undefined') {
        try {
          window.history.replaceState(null, '', '/')
        } catch (historyError) {
          console.warn('🚪 [AUTH] History replace failed after error:', historyError)
        }
      }
      router.replace('/')
      clearTimeout(fallbackTimer)
      throw error
    } finally {
      clearTimeout(fallbackTimer)
    }
  }

  const signUp = async (email: string, username: string, password: string, persona: PersonaRole) => {
    const trimmedEmail = email.trim()
    const displayName = username.trim()
    const personaRole = persona

    // Validate inputs
    if (!trimmedEmail) {
      throw new Error('Email is required')
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error('Invalid email address')
    }

    if (!displayName) {
      throw new Error('Username is required')
    }

    if (displayName.length < 3) {
      throw new Error('Username must be at least 3 characters long')
    }

    if (!personaRole) {
      throw new Error('A persona is required')
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long')
    }

    authDebugLog('🚀 [AUTH] signUp called with:', {
      email: trimmedEmail,
      username: displayName,
      persona: personaRole,
      hasPassword: !!password
    })

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            username: displayName,
            persona: personaRole,
            full_name: displayName,
            name: displayName
          },
          emailRedirectTo: Platform.OS === 'web'
            ? `${window.location.origin}/callback`
            : undefined
        }
      })

      if (error) {
        throw error
      }

      authDebugLog('✅ [AUTH] Supabase signUp successful:', data)

      if (data.user?.id) {
        // For learners, start the 14-day Pro trial in the same upsert
        // to avoid race conditions with session establishment.
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);
        const isLearner = personaRole === 'sailor';

        const profilePayload: Record<string, any> = {
          id: data.user.id,
          email: trimmedEmail,
          full_name: displayName,
          user_type: personaRole,
          onboarding_completed: isLearner, // Learners complete onboarding inline during signup
          ...(isLearner ? {
            subscription_tier: 'individual',
            subscription_status: 'trialing',
            trial_started_at: new Date().toISOString(),
            trial_ends_at: trialEnd.toISOString(),
          } : {
            onboarding_completed: false,
          }),
        }

        authDebugLog('[AUTH] Upserting user profile:', profilePayload)

        const { error: profileError } = await supabase
          .from('users')
          .upsert(profilePayload, { onConflict: 'id' })

        if (profileError) {
          console.error('[AUTH] ❌ Profile upsert failed during signUp:', profileError)
          logger.warn('[AUTH] Profile upsert failed during signUp:', profileError)
        } else {
          authDebugLog('[AUTH] ✅ Profile upsert successful')
          setUserProfile((prev: any) => ({
            ...(prev ?? {}),
            ...profilePayload
          }))
        }
        setUserType(personaRole)
        authDebugLog('[AUTH] userType set to:', personaRole)

        try {
          authDebugLog('🔍 [AUTH] Refreshing profile after signUp...')
          await fetchUserProfile(data.user.id)
        } catch (profileError) {
          logger.warn('[AUTH] Profile fetch after signUp failed:', profileError)
        }
      }

      return data
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async (persona?: PersonaRole) => {
    setLoading(true)
    try {
      authDebugLog('🔍 [LOGIN] Google sign-in button clicked')
      authDebugLog('🔍 [LOGIN] Calling signInWithGoogle() with persona:', persona)

      // Store the selected persona in localStorage before OAuth redirect (web only)
      if (persona && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem('oauth_pending_persona', persona)
        authDebugLog('🔍 [LOGIN] Stored pending persona in localStorage:', persona)
      }

      // Preserve a `returnTo` query param across the OAuth redirect so users
      // who arrive at /login?returnTo=/community/...?post=... actually land
      // on the post (not the default dashboard) after sign-in. The OAuth
      // redirect drops our URL, so we stash it before jumping out and the
      // callback reads it back.
      if (typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search)
          const returnTo = params.get('returnTo')
          // [TRAIL] persist click-time state for diagnostic post-mortems
          try {
            const arr = JSON.parse(window.localStorage.getItem('auth_trail') || '[]')
            arr.push({ t: Date.now(), stage: 'oauth_click', data: { url: window.location.href, returnTo, willStash: !!(returnTo && returnTo.startsWith('/')) } })
            while (arr.length > 50) arr.shift()
            window.localStorage.setItem('auth_trail', JSON.stringify(arr))
          } catch {}
          if (returnTo && returnTo.startsWith('/')) {
            window.sessionStorage.setItem('oauth_return_to', returnTo)
          }
        } catch {}
      }

      if (Platform.OS === 'web') {
        // Dynamic origin configuration - works on any port
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
        const redirectTo = `${currentOrigin}/callback`

        authDebugLog('🔍 [LOGIN] Dynamic OAuth redirect:', redirectTo)

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo
          }
        })
        if (error) throw error
      } else {
        // Native mobile: Store persona in AsyncStorage, then use native OAuth
        if (persona) {
          await AsyncStorage.setItem('oauth_pending_persona', persona)
          authDebugLog('🔍 [LOGIN] Stored pending persona in AsyncStorage:', persona)
        }

        authDebugLog('🔍 [LOGIN] Starting native Google sign-in')
        const result = await nativeGoogleSignIn()
        authDebugLog('🔍 [LOGIN] Native Google sign-in successful:', result?.user?.id)

        // Handle profile creation for new users with persona
        if (result?.user?.id && persona) {
          await handleNativeOAuthProfile(result.user, persona)
        }

        // Clear stored persona after successful sign-in
        await AsyncStorage.removeItem('oauth_pending_persona')
      }
    } catch (error) {
      console.error('🔍 [LOGIN] Google sign-in failed:', error)
      // Clear the stored persona on error
      if (Platform.OS === 'web') {
        safeLocalStorage.removeItem('oauth_pending_persona')
      } else {
        await AsyncStorage.removeItem('oauth_pending_persona')
      }
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Helper to handle profile creation after native OAuth sign-in
  const handleNativeOAuthProfile = async (user: any, persona: PersonaRole) => {
    try {
      authDebugLog('🔍 [LOGIN] Checking/creating profile for OAuth user:', user.id)

      // Check if profile already has a user_type set
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id, user_type')
        .eq('id', user.id)
        .maybeSingle()

      if (existingProfile?.user_type) {
        authDebugLog('🔍 [LOGIN] Existing profile found with user_type:', existingProfile.user_type)
        return // Profile already set up, nothing to do
      }

      // Create/update profile with the selected persona
      const profilePayload = {
        id: user.id,
        email: user.email,
        full_name: extractOAuthDisplayName(user.user_metadata),
        user_type: persona,
        onboarding_completed: false, // All users go through practical onboarding
      }

      authDebugLog('🔍 [LOGIN] Upserting OAuth profile:', profilePayload)
      const { error: upsertError } = await supabase
        .from('users')
        .upsert(profilePayload, { onConflict: 'id' })

      if (upsertError) {
        console.error('🔍 [LOGIN] Profile upsert failed:', upsertError)
      } else {
        authDebugLog('🔍 [LOGIN] Profile upsert successful')
        setUserProfile((prev: any) => ({ ...(prev ?? {}), ...profilePayload }))
        setUserType(persona)

        // Sample data will be created by races.tsx fallback if needed
        authDebugLog('🔍 [LOGIN] Sailor profile saved, sample data will be created on races page')
      }
    } catch (error) {
      console.error('🔍 [LOGIN] handleNativeOAuthProfile error:', error)
    }
  }

  const signInWithApple = async (persona?: PersonaRole) => {
    setLoading(true)
    try {
      authDebugLog('🔍 [LOGIN] Apple sign-in button clicked')
      authDebugLog('🔍 [LOGIN] Calling signInWithApple() with persona:', persona)

      // Store the selected persona in localStorage before OAuth redirect (web only)
      if (persona && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem('oauth_pending_persona', persona)
        authDebugLog('🔍 [LOGIN] Stored pending persona in localStorage:', persona)
      }

      // Preserve a `returnTo` query param across the OAuth redirect so users
      // who arrive at /login?returnTo=/community/...?post=... actually land
      // on the post (not the default dashboard) after sign-in. The OAuth
      // redirect drops our URL, so we stash it before jumping out and the
      // callback reads it back.
      if (typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search)
          const returnTo = params.get('returnTo')
          // [TRAIL] persist click-time state for diagnostic post-mortems
          try {
            const arr = JSON.parse(window.localStorage.getItem('auth_trail') || '[]')
            arr.push({ t: Date.now(), stage: 'oauth_click', data: { url: window.location.href, returnTo, willStash: !!(returnTo && returnTo.startsWith('/')) } })
            while (arr.length > 50) arr.shift()
            window.localStorage.setItem('auth_trail', JSON.stringify(arr))
          } catch {}
          if (returnTo && returnTo.startsWith('/')) {
            window.sessionStorage.setItem('oauth_return_to', returnTo)
          }
        } catch {}
      }

      if (Platform.OS === 'web') {
        // Dynamic origin configuration - works on any port
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
        const redirectTo = `${currentOrigin}/callback`

        // For web, use Supabase's OAuth flow
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo
          }
        })
        if (error) throw error
      } else {
        // Native mobile (iOS only): Use native Apple Sign-In
        if (persona) {
          await AsyncStorage.setItem('oauth_pending_persona', persona)
          authDebugLog('🔍 [LOGIN] Stored pending persona in AsyncStorage:', persona)
        }

        authDebugLog('🔍 [LOGIN] Starting native Apple sign-in')
        const result = await nativeAppleSignIn()
        authDebugLog('🔍 [LOGIN] Native Apple sign-in successful:', result?.user?.id)

        // Handle profile creation for new users with persona
        if (result?.user?.id && persona) {
          await handleNativeOAuthProfile(result.user, persona)
        }

        // Clear stored persona after successful sign-in
        await AsyncStorage.removeItem('oauth_pending_persona')
      }
    } catch (error) {
      console.error('🔍 [LOGIN] Apple sign-in failed:', error)
      // Clear the stored persona on error
      if (Platform.OS === 'web') {
        safeLocalStorage.removeItem('oauth_pending_persona')
      } else {
        await AsyncStorage.removeItem('oauth_pending_persona')
      }
      throw error
    } finally {
      setLoading(false)
    }
  }

  /**
   * Add a capability to the current user (e.g., 'coaching')
   * Creates the capability record and reloads persona context
   */
  const addCapability = useCallback(async (capabilityType: CapabilityType) => {
    if (!user?.id) {
      throw new Error('No user logged in')
    }

    authDebugLog('[AUTH] Adding capability:', capabilityType)

    try {
      // Insert the capability record
      const { data, error } = await supabase
        .from('user_capabilities')
        .insert({
          user_id: user.id,
          capability_type: capabilityType,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        // Handle duplicate (user already has this capability)
        if (error.code === '23505') {
          authDebugLog('[AUTH] User already has capability:', capabilityType)
          // Reactivate if it was deactivated
          const { error: updateError } = await supabase
            .from('user_capabilities')
            .update({ is_active: true, deactivated_at: null })
            .eq('user_id', user.id)
            .eq('capability_type', capabilityType)

          if (updateError) {
            throw updateError
          }
        } else {
          throw error
        }
      }

      authDebugLog('[AUTH] Capability added successfully:', data)

      // Reload persona context to pick up the new capability
      await loadPersonaContext()

    } catch (error) {
      console.error('[AUTH] Failed to add capability:', error)
      throw error
    }
  }, [user?.id, loadPersonaContext])

  /**
   * Enter guest mode for freemium experience
   * Called when user chooses to continue without signing up
   */
  const enterGuestMode = useCallback(() => {
    authDebugLog('[AUTH] Entering guest mode')
    setIsGuest(true)
    // Mark onboarding as seen so any residual checks treat the user correctly
    OnboardingStateService.markOnboardingSeen()
    // Navigate to races tab
    router.replace('/(tabs)/races')
  }, [])

  const value = useMemo<AuthCtx>(() => {
    // Compute state from ready, signedIn, isGuest, and userType
    let state: AuthState = 'checking'
    if (!ready) {
      state = 'checking'
    } else if (signedIn) {
      state = 'ready'
    } else if (isGuest) {
      state = 'guest'
    } else {
      state = 'signed_out'
    }

    return {
      state,
      ready,
      signedIn,
      isGuest,
      user,
      loading,
      personaLoading,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
      signInWithApple,
      enterGuestMode,
      wasAuthenticated: wasAuthenticatedRef.current,
      biometricAvailable: false,
      biometricEnabled: false,
      userProfile,
      userType,
      capabilities,
      clubProfile,
      coachProfile,
      refreshPersonaContext: loadPersonaContext,
      updateUserProfile,
      fetchUserProfile,
      addCapability,
      isDemoSession
    }
  // Intentionally memoized on state-like inputs only; auth handlers remain stable in practice.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, isGuest, user, loading, personaLoading, userProfile, userType, capabilities, clubProfile, coachProfile, loadPersonaContext, isDemoSession, enterGuestMode, addCapability])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
