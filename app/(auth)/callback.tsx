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

    // Safety timeout - if callback takes longer than 10s, force redirect
    const safetyTimeout = setTimeout(() => {
      logger.error('Safety timeout triggered after 10 seconds')
      router.replace(getDashboardRoute(null) as any)
    }, 10000)

    const run = async ()=>{
      try {
        // Extract hash parameters
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (!accessToken) {
          // If we don't see tokens in the hash, check if a session already exists (e.g. user reloaded /callback)
          const { data: existingSession } = await supabase.auth.getSession()
          if (existingSession.session?.user) {
            const destination = getDashboardRoute(existingSession.session.user.user_metadata?.user_type ?? null)
            logger.warn('No access token in callback but session exists, routing to dashboard:', destination)
            clearTimeout(safetyTimeout)
            router.replace(destination as any)
            return
          }

          logger.error('No access token in OAuth callback')
          setStatus('Something went wrong. Redirecting to login...')
          clearTimeout(safetyTimeout)
          setTimeout(() => router.replace('/(auth)/login'), 2000)
          return
        }

        setStatus('Signing you in...')

        const {data: tokenData, error: tokenError} = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        })

        if (tokenError) {
          logger.error('Token exchange error:', tokenError)
          setStatus('Something went wrong. Redirecting to login...')
          clearTimeout(safetyTimeout)
          setTimeout(() => router.replace('/(auth)/login'), 2000)
          return
        }

        await logSession(supabase, 'AFTER_MANUAL_EXCHANGE')
        dumpSbStorage()

        const session = tokenData?.session
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
          }
          if (returnTo) {
            logger.info('Redirecting to returnTo:', returnTo)
            setStatus('Almost there...')
            setTimeout(() => {
              router.replace(returnTo as any)
            }, 100)
          } else {
            const dest = getDashboardRoute(effectiveUserType ?? null)
            logger.info('Redirecting to dashboard:', dest)
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
