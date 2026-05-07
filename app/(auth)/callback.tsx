import {useEffect, useRef, useState} from 'react'
import {router} from 'expo-router'
import {supabase} from '@/services/supabase'
import {logSession, dumpSbStorage} from '@/utils/authDebug'
import {getDashboardRoute} from '@/lib/utils/userTypeRouting'
import {extractOAuthDisplayName} from '@/lib/utils/oauthName'
import {ActivityIndicator, Image, View, Text,
} from "react-native"
import {createLogger} from '@/lib/utils/logger'
// Sample data is created in profile-setup.tsx or races.tsx fallback
import {GuestStorageService} from '@/services/GuestStorageService'
import AsyncStorage from '@react-native-async-storage/async-storage'

const logger = createLogger('OAuthCallback')

// [TRAIL] Persist a diagnostic trail of the OAuth flow to localStorage so we
// can post-mortem failures by reading it via Chrome DevTools after the fact.
// Capped to last 50 entries. Key: 'auth_trail'.
const trail = (stage: string, data?: any) => {
  try {
    if (typeof window === 'undefined') return
    const arr = JSON.parse(window.localStorage.getItem('auth_trail') || '[]')
    arr.push({ t: Date.now(), stage, data })
    while (arr.length > 50) arr.shift()
    window.localStorage.setItem('auth_trail', JSON.stringify(arr))
  } catch {}
}

type PersonaRole = 'sailor' | 'coach' | 'club'

// Storage key for pending persona from signup flow
const OAUTH_PENDING_PERSONA_KEY = 'oauth_pending_persona'

// Get and clear the pending persona from localStorage (web only)
const getPendingPersona = (): PersonaRole | null => {
  // Check both window and localStorage exist (localStorage doesn't exist on React Native)
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null
  try {
    const persona = window.localStorage.getItem(OAUTH_PENDING_PERSONA_KEY)
    if (persona && ['sailor', 'coach', 'club'].includes(persona)) {
      window.localStorage.removeItem(OAUTH_PENDING_PERSONA_KEY)
      logger.info('Retrieved pending persona from localStorage:', persona)
      return persona as PersonaRole
    }
  } catch (e) {
    logger.warn('Failed to read pending persona from localStorage:', e)
  }
  return null
}

export default function Callback(){
  const ran = useRef(false)
  const [status, setStatus] = useState('Signing you in...')

  useEffect(()=>{
    if (ran.current) {
      return
    }
    ran.current = true

    trail('callback:enter', {
      url: window.location.href,
      hash: window.location.hash,
      search: window.location.search,
      sessionStorage: {
        oauth_return_to: window.sessionStorage.getItem('oauth_return_to'),
        auth_settling_at: window.sessionStorage.getItem('auth_settling_at'),
      },
      sbKeys: Object.keys(window.localStorage).filter(k => k.startsWith('sb-')),
    })

    // Safety timeout - if callback takes longer than 25s, force redirect.
    // 25s sits under the supabase fetch wrapper's 30s timeout so a hung
    // /auth/v1/user validation call inside setSession() can resolve or fail
    // naturally before we give up; the previous 10s window fired in the
    // middle of setSession on slow LTE connections, dumping users on /.
    const safetyTimeout = setTimeout(() => {
      logger.error('Safety timeout triggered after 25 seconds')
      trail('callback:safety_timeout_fired', {
        url: window.location.href,
        oauth_return_to: window.sessionStorage.getItem('oauth_return_to'),
        auth_settling_at: window.sessionStorage.getItem('auth_settling_at'),
      })
      router.replace(getDashboardRoute(null) as any)
    }, 25000)

    const run = async ()=>{
      try {
        // Extract hash parameters
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        // [TRAIL] Also capture query for PKCE detection
        const queryParams = new URLSearchParams(window.location.search)
        const codeParam = queryParams.get('code')
        trail('callback:parsed_url', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasCodeParam: !!codeParam,
          hashLen: window.location.hash.length,
          searchLen: window.location.search.length,
        })

        if (!accessToken) {
          trail('callback:no_access_token:start_getSession')
          // If we don't see tokens in the hash, check if a session already exists (e.g. user reloaded /callback)
          const { data: existingSession } = await supabase.auth.getSession()
          trail('callback:no_access_token:getSession_returned', {
            hasSession: !!existingSession.session,
            userId: existingSession.session?.user?.id,
          })
          if (existingSession.session?.user) {
            const destination = getDashboardRoute(existingSession.session.user.user_metadata?.user_type ?? null)
            logger.warn('No access token in callback but session exists, routing to dashboard:', destination)
            trail('callback:no_access_token:routing_dashboard', { destination })
            clearTimeout(safetyTimeout)
            router.replace(destination as any)
            return
          }

          logger.error('No access token in OAuth callback')
          trail('callback:no_access_token:routing_login')
          setStatus('Something went wrong. Redirecting to login...')
          clearTimeout(safetyTimeout)
          setTimeout(() => router.replace('/(auth)/login'), 2000)
          return
        }

        setStatus('Signing you in...')

        // Stash auth_settling_at BEFORE setSession runs. setSession can take
        // several seconds on slow networks (it calls /auth/v1/user to validate
        // the token), and if the safety timeout fires mid-call, AuthGate must
        // still see this hold-off marker and not bounce the user to /.
        try {
          window.sessionStorage.setItem('auth_settling_at', String(Date.now()))
        } catch {}

        trail('callback:setSession:start')
        // Race setSession() against a 5s timeout. setSession internally calls
        // /auth/v1/user to validate the access_token; on flaky LTE this hangs
        // for >25s and trips the safety timeout, dumping users on /. The JWT
        // itself is signed by Supabase, so if validation hangs we fall back to
        // decoding it locally and writing the session to storage directly. The
        // user's subsequent PostgREST/RPC calls will validate the JWT server
        // side, so we lose nothing security-wise.
        const setSessionPromise = supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        }).then(r => ({ kind: 'resolved' as const, ...r }))
        const setSessionTimeoutPromise = new Promise<{kind: 'timeout'}>(resolve =>
          setTimeout(() => resolve({ kind: 'timeout' }), 5000)
        )
        const setSessionRaceResult = await Promise.race([setSessionPromise, setSessionTimeoutPromise])

        let session: any = null
        let tokenError: any = null

        if (setSessionRaceResult.kind === 'timeout') {
          // Manual fallback: decode JWT, build a session, write to localStorage
          // in Supabase v2 storage format, then call getSession() so the client
          // picks it up and broadcasts SIGNED_IN.
          trail('callback:setSession:timeout_falling_back')
          try {
            const parts = accessToken.split('.')
            const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
            const padded = b64 + '==='.slice((b64.length + 3) % 4)
            const payload = JSON.parse(atob(padded))
            const user = {
              id: payload.sub,
              email: payload.email,
              app_metadata: payload.app_metadata || { provider: 'email', providers: ['email'] },
              user_metadata: payload.user_metadata || {},
              aud: payload.aud || 'authenticated',
              role: payload.role || 'authenticated',
              created_at: new Date((payload.iat || Math.floor(Date.now()/1000)) * 1000).toISOString(),
            }
            const sessionData = {
              access_token: accessToken,
              refresh_token: refreshToken || '',
              token_type: 'bearer',
              expires_in: (payload.exp || 0) - Math.floor(Date.now()/1000),
              expires_at: payload.exp,
              user,
            }
            const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim()
            const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
            if (ref && typeof window !== 'undefined') {
              window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sessionData))
              trail('callback:setSession:manual_write_storage', { ref, userId: user.id })
            }
            // Trigger the client to read from storage. getSession() reads the
            // local cache without making a network call, then broadcasts.
            const getSessionPromise = supabase.auth.getSession()
            const getSessionTimeout = new Promise<null>(resolve =>
              setTimeout(() => resolve(null), 2000)
            )
            const getSessionResult: any = await Promise.race([getSessionPromise, getSessionTimeout])
            if (getSessionResult?.data?.session) {
              session = getSessionResult.data.session
              trail('callback:setSession:manual_write_getSession_ok', { userId: session.user?.id })
            } else {
              // Even if getSession didn't return, the storage write succeeded.
              // AuthProvider on next mount will pick it up. Use our synthesized
              // session for the rest of this callback's logic.
              session = sessionData
              trail('callback:setSession:manual_write_using_synth_session', { userId: user.id })
            }
          } catch (e) {
            tokenError = e
            trail('callback:setSession:manual_write_failed', { err: String(e) })
          }
        } else {
          tokenError = setSessionRaceResult.error
          session = setSessionRaceResult.data?.session
          trail('callback:setSession:returned', {
            hasError: !!tokenError,
            errorMsg: tokenError?.message,
            hasSession: !!session,
            userId: session?.user?.id,
          })
        }

        if (tokenError) {
          logger.error('Token exchange error:', tokenError)
          trail('callback:setSession_error_routing_login', { errorMsg: tokenError?.message })
          setStatus('Something went wrong. Redirecting to login...')
          clearTimeout(safetyTimeout)
          setTimeout(() => router.replace('/(auth)/login'), 2000)
          return
        }

        await logSession(supabase, 'AFTER_MANUAL_EXCHANGE')
        dumpSbStorage()

        if (!session?.user) {
          logger.warn('No session after OAuth callback')
          setStatus('Something went wrong. Redirecting to login...')
          clearTimeout(safetyTimeout)
          setTimeout(() => router.replace('/(auth)/login'), 2000)
          return
        }

      setStatus('Loading your profile...')

      // Mark "auth is settling" so AuthGate can hold off on the next route
      // bounce. Supabase's onAuthStateChange listener is async; if we navigate
      // to a protected route before it broadcasts, AuthGate sees signedIn=false
      // and kicks the user back to `/`. Mirrors the existing rf_access_token
      // hold-off pattern in app/_layout.tsx.
      try {
        window.sessionStorage.setItem('auth_settling_at', String(Date.now()))
      } catch {}

      // Clean up URL hash immediately
      try {
        window.history.replaceState(null, '', '/callback')
      } catch (e) {
        logger.error('History replace error:', e)
      }

      // Check for pending persona from signup flow
      const pendingPersona = getPendingPersona()
      logger.info('Pending persona from signup:', pendingPersona)

      // Fetch user profile to determine routing with timeout
      try {
        logger.info('Fetching user profile for user:', session.user.id, session.user.email)

        const result = await Promise.race([
          supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
          )
        ])

        const {data: profile, error: profileError} = result as any

        logger.info('Profile fetch result:', {
          hasProfile: !!profile,
          profileData: profile,
          hasError: !!profileError,
          error: profileError
        })

        // Determine the user type - use pending persona if profile doesn't have one yet
        let effectiveUserType = profile?.user_type
        const isNewUser = !profile || !profile.user_type
        const needsOnboarding = !profile?.onboarding_completed && (profile?.user_type || pendingPersona)

        // Handle existing users with null user_type (fix their profile)
        if (profile && !profile.user_type && !pendingPersona) {
          logger.info('Existing user with null user_type, defaulting to sailor')
          setStatus('Setting up your account...')

          // Also backfill full_name if missing
          const fixPayload: Record<string, any> = {
            user_type: 'sailor',
            onboarding_completed: true,
          }
          if (!profile.full_name) {
            fixPayload.full_name = extractOAuthDisplayName(session.user.user_metadata)
          }

          const { error: fixError } = await supabase
            .from('users')
            .update(fixPayload)
            .eq('id', session.user.id)

          if (fixError) {
            logger.warn('Failed to fix user_type, continuing anyway:', fixError)
          } else {
            logger.info('Fixed user profile with default sailor type')
          }
          effectiveUserType = 'sailor'
        }

        // Check for guest race data to migrate
        try {
          const hasGuestRace = await GuestStorageService.hasGuestRace()
          if (hasGuestRace) {
            logger.info('Found guest race data, migrating to account...')
            setStatus('Importing your data...')
            const newRaceId = await GuestStorageService.migrateToAccount(session.user.id)
            if (newRaceId) {
              logger.info('Successfully migrated guest race:', newRaceId)
              await GuestStorageService.clearGuestData()
            }
          }
        } catch (migrationError) {
          logger.warn('Guest data migration failed, continuing anyway:', migrationError)
        }

        if (pendingPersona && isNewUser) {
          logger.info('Applying pending persona to new OAuth user:', pendingPersona)
          setStatus('Setting up your account...')

          // Create or update the user profile with the selected persona
          // Note: onboarding_completed stays false - sailors must complete onboarding too
          const profilePayload = {
            id: session.user.id,
            email: session.user.email,
            full_name: extractOAuthDisplayName(session.user.user_metadata),
            user_type: pendingPersona,
            onboarding_completed: false, // All users must complete onboarding
          }

          const { error: upsertError } = await supabase
            .from('users')
            .upsert(profilePayload, { onConflict: 'id' })

          if (upsertError) {
            logger.error('Failed to save persona to profile:', upsertError)
          } else {
            logger.info('Successfully saved persona to profile:', pendingPersona)
            effectiveUserType = pendingPersona
          }
        }

        if (profileError && !pendingPersona) {
          logger.warn('Profile fetch error, routing to default dashboard:', profileError)
          setStatus('Setting up your account...')
          const destination = getDashboardRoute(null)
          setTimeout(() => router.replace(destination as any), 100)
          clearTimeout(safetyTimeout)
          return
        }

        // Route based on the effective user type
        // Route to onboarding if: (1) new OAuth user with pending persona, OR (2) existing user who hasn't completed onboarding
        // All user types must complete onboarding
        const personaForOnboarding = pendingPersona || effectiveUserType
        if (needsOnboarding && personaForOnboarding) {
          logger.info('Routing user to onboarding for persona:', personaForOnboarding)
          setStatus('Almost there...')

          let onboardingRoute: string
          if (personaForOnboarding === 'sailor' || personaForOnboarding === 'coach') {
            // Sailors (and legacy coach signups) go through name-only onboarding
            onboardingRoute = '/onboarding/profile/name-photo'
          } else if (personaForOnboarding === 'club') {
            onboardingRoute = '/(auth)/club-onboarding-chat'
          } else {
            onboardingRoute = getDashboardRoute(personaForOnboarding) as string
          }

          setTimeout(() => {
            router.replace(onboardingRoute as any)
          }, 100)
        } else {
          // Check for a returnTo destination, preferring the one captured from
          // the URL right before the OAuth redirect (web sessionStorage). Falls
          // back to the older AsyncStorage key used by other flows (e.g.
          // blueprint auto-subscribe).
          let returnTo: string | null = null
          if (typeof window !== 'undefined') {
            try {
              const fromSession = window.sessionStorage.getItem('oauth_return_to')
              trail('callback:returnTo:read_sessionStorage', { fromSession })
              if (fromSession && fromSession.startsWith('/')) {
                returnTo = fromSession
                window.sessionStorage.removeItem('oauth_return_to')
              }
            } catch {}
          }
          if (!returnTo) {
            returnTo = await AsyncStorage.getItem('post_onboarding_return_to')
            if (returnTo) {
              await AsyncStorage.removeItem('post_onboarding_return_to')
            }
            trail('callback:returnTo:read_asyncStorage', { returnTo })
          }
          if (returnTo) {
            logger.info('Redirecting to returnTo:', returnTo)
            trail('callback:routing_returnTo', { returnTo })
            setStatus('Almost there...')
            setTimeout(() => {
              router.replace(returnTo as any)
            }, 100)
          } else {
            const dest = getDashboardRoute(effectiveUserType ?? null)
            logger.info('Redirecting to dashboard:', dest)
            trail('callback:routing_dashboard_no_returnTo', { dest, effectiveUserType })
            setStatus('Almost there...')
            setTimeout(() => {
              router.replace(dest as any)
            }, 100)
          }
        }
      } catch (e) {
        logger.error('Profile fetch error:', e)
        setStatus('Setting up your account...')
        const destination = getDashboardRoute(null)
        setTimeout(() => router.replace(destination as any), 100)
      } finally {
        clearTimeout(safetyTimeout)
      }
    } catch (criticalError) {
      logger.error('Critical error in callback handler:', criticalError)
      setStatus('Something went wrong. Redirecting to login...')
      setTimeout(() => router.replace('/(auth)/login'), 2000)
      clearTimeout(safetyTimeout)
    }
  }
  run()

  return () => {
    clearTimeout(safetyTimeout)
  }
  },[])

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF'}}>
      <Image
        source={require('@/assets/images/logo-full.png')}
        style={{width: 160, height: 48, marginBottom: 32}}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={{marginTop: 16, fontSize: 16, color: '#64748B'}}>{status}</Text>
    </View>
  )
}
