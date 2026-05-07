/**
 * Firebase Auth Bridge Client Utilities
 *
 * Handles authentication flow for Dragon Worlds users accessing RegattaFlow
 * via the Firebase-to-Supabase token bridge.
 */

import { supabase } from '@/services/supabase';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ============================================================================
// TYPES
// ============================================================================

export interface FirebaseBridgeProfile {
  displayName?: string;
  boatClass?: string;
  clubName?: string;
  photoUrl?: string;
}

export interface FirebaseBridgeRequest {
  firebaseToken: string;
  profile?: FirebaseBridgeProfile;
  communitySlug?: string;
}

export interface FirebaseBridgeSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user?: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
}

export interface FirebaseBridgeResponse {
  success: boolean;
  session?: FirebaseBridgeSession;
  // Flat fields for backwards compatibility
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  user?: {
    id: string;
    email: string;
    fullName?: string;
    isNewUser: boolean;
  };
  error?: string;
}

export interface BridgeTokenPayload {
  sub: string; // User ID
  email: string;
  type: 'firebase_bridge';
  iat: number;
  exp: number;
  iss: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BRIDGE_ENDPOINT_PATH = '/functions/v1/firebase-auth-bridge';

// Dragon Worlds community slug - users will auto-join this community
export const DRAGON_WORLDS_COMMUNITY_SLUG = '2027-hk-dragon-worlds';

// URL parameter names for WebView token passing
export const AUTH_TOKEN_PARAM = 'auth_token';
export const BRIDGE_TOKEN_PARAM = 'bridge_token';
export const ACCESS_TOKEN_PARAM = 'rf_access_token';
export const REFRESH_TOKEN_PARAM = 'rf_refresh_token';

// Optional redirect target for the bridge — lets HKDW (or anything else)
// hand off to a specific in-app path after the session is established.
// Path-only, same-origin; sanitized in `extractNextRedirectFromUrl`.
export const NEXT_REDIRECT_PARAM = 'next';

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get the Supabase Functions URL
 */
function getSupabaseFunctionsUrl(): string {
  const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl
    || process.env.EXPO_PUBLIC_SUPABASE_URL
    || '';

  // Convert project URL to functions URL
  // https://xxx.supabase.co -> https://xxx.supabase.co
  return supabaseUrl;
}

/**
 * Exchange a Firebase ID token for a Supabase session via the bridge endpoint
 *
 * @param firebaseToken - Firebase ID token from Firebase Auth
 * @param profile - Optional profile data to sync from Dragon app
 * @param communitySlug - Optional community slug to auto-join (defaults to Dragon Worlds)
 * @returns Bridge response with Supabase tokens
 */
export async function exchangeFirebaseToken(
  firebaseToken: string,
  profile?: FirebaseBridgeProfile,
  communitySlug: string = DRAGON_WORLDS_COMMUNITY_SLUG
): Promise<FirebaseBridgeResponse> {
  const functionsUrl = getSupabaseFunctionsUrl();

  const response = await fetch(`${functionsUrl}${BRIDGE_ENDPOINT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Include anon key for CORS
      'apikey': Constants.expoConfig?.extra?.supabaseAnonKey
        || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
        || '',
    },
    body: JSON.stringify({
      firebaseToken,
      profile,
      communitySlug,
    } as FirebaseBridgeRequest),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Bridge request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Set a Supabase session from the bridge response tokens
 *
 * @param accessToken - The Supabase access token
 * @param refreshToken - The Supabase refresh token
 * @returns True if session was established successfully
 */
export async function setSessionFromBridgeTokens(
  accessToken: string,
  refreshToken: string
): Promise<boolean> {
  try {
    console.log('[FirebaseBridge] Setting Supabase session from bridge tokens');

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('[FirebaseBridge] Failed to set session:', error);
      return false;
    }

    if (!data.session) {
      console.error('[FirebaseBridge] No session returned after setSession');
      return false;
    }

    console.log('[FirebaseBridge] Session established successfully for user:', data.session.user?.id);
    return true;
  } catch (error) {
    console.error('[FirebaseBridge] Failed to set session:', error);
    return false;
  }
}

/**
 * Exchange the bridge token for a full Supabase session
 * Supports both old-style base64 tokens and new-style session data
 *
 * @param bridgeTokenOrData - Either a legacy bridge token string or JSON-stringified session data
 * @returns True if session was established successfully
 */
export async function exchangeBridgeTokenForSession(bridgeTokenOrData: string): Promise<boolean> {
  try {
    // First, try to parse as JSON (new format with real tokens)
    try {
      const parsed = JSON.parse(bridgeTokenOrData);
      if (parsed.access_token && parsed.refresh_token) {
        return await setSessionFromBridgeTokens(parsed.access_token, parsed.refresh_token);
      }
    } catch {
      // Not JSON, try legacy format
    }

    // Check if it looks like a JWT (contains dots and is long)
    if (bridgeTokenOrData.includes('.') && bridgeTokenOrData.length > 100) {
      // This might be an access_token passed directly
      // Try to decode it to see if it's a valid JWT
      const parts = bridgeTokenOrData.split('.');
      if (parts.length === 3) {
        console.log('[FirebaseBridge] Detected JWT-style token, attempting to set session');
        // For JWT tokens passed alone, we need to also have a refresh token
        // Check if there's a refresh token in session storage
        const refreshToken = Platform.OS === 'web' && typeof sessionStorage !== 'undefined'
          ? sessionStorage.getItem('firebase_bridge_refresh_token')
          : null;

        if (refreshToken) {
          return await setSessionFromBridgeTokens(bridgeTokenOrData, refreshToken);
        }

        console.warn('[FirebaseBridge] JWT token provided but no refresh token available');
      }
    }

    // Try legacy base64-encoded JSON format
    const payload = decodeBridgeToken(bridgeTokenOrData);
    if (!payload) {
      console.error('[FirebaseBridge] Invalid bridge token format');
      return false;
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('[FirebaseBridge] Bridge token expired');
      return false;
    }

    // Legacy: Store the bridge token temporarily for the AuthProvider to use
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('firebase_bridge_token', bridgeTokenOrData);
      sessionStorage.setItem('firebase_bridge_user_id', payload.sub);
      sessionStorage.setItem('firebase_bridge_email', payload.email);
    }

    return true;
  } catch (error) {
    console.error('[FirebaseBridge] Failed to exchange bridge token:', error);
    return false;
  }
}

/**
 * Decode a bridge token (without verification - for client-side use)
 */
export function decodeBridgeToken(token: string): BridgeTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));

    if (payload.type !== 'firebase_bridge') {
      return null;
    }

    return payload as BridgeTokenPayload;
  } catch {
    return null;
  }
}

// ============================================================================
// URL HANDLING FOR WEBVIEW
// ============================================================================

export interface ExtractedTokens {
  type: 'session' | 'bridge' | 'legacy';
  accessToken?: string;
  refreshToken?: string;
  bridgeToken?: string;
}

/**
 * Extract auth tokens from URL parameters
 * Used when Dragon app embeds RegattaFlow in a WebView
 * Supports both new session tokens and legacy bridge tokens
 *
 * @param url - The URL to parse
 * @returns Extracted tokens object or null if none found
 */
export function extractSessionTokensFromUrl(url: string): ExtractedTokens | null {
  try {
    const urlObj = new URL(url);

    // Check for new session tokens (preferred)
    const accessToken = urlObj.searchParams.get(ACCESS_TOKEN_PARAM);
    const refreshToken = urlObj.searchParams.get(REFRESH_TOKEN_PARAM);

    if (accessToken && refreshToken) {
      return {
        type: 'session',
        accessToken,
        refreshToken,
      };
    }

    // Check hash parameters for session tokens (OAuth-style)
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      const hashAccessToken = hashParams.get(ACCESS_TOKEN_PARAM);
      const hashRefreshToken = hashParams.get(REFRESH_TOKEN_PARAM);

      if (hashAccessToken && hashRefreshToken) {
        return {
          type: 'session',
          accessToken: hashAccessToken,
          refreshToken: hashRefreshToken,
        };
      }
    }

    // Check for bridge token (legacy)
    const bridgeToken = urlObj.searchParams.get(BRIDGE_TOKEN_PARAM);
    if (bridgeToken) {
      return {
        type: 'bridge',
        bridgeToken,
      };
    }

    // Check for auth token (oldest legacy)
    const authToken = urlObj.searchParams.get(AUTH_TOKEN_PARAM);
    if (authToken) {
      return {
        type: 'legacy',
        bridgeToken: authToken,
      };
    }

    // Check hash for legacy tokens
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      const hashBridgeToken = hashParams.get(BRIDGE_TOKEN_PARAM) || hashParams.get(AUTH_TOKEN_PARAM);
      if (hashBridgeToken) {
        return {
          type: 'bridge',
          bridgeToken: hashBridgeToken,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract auth token from URL parameters (legacy compatibility)
 * Used when Dragon app embeds RegattaFlow in a WebView
 *
 * @param url - The URL to parse
 * @returns The auth token if present, null otherwise
 */
export function extractAuthTokenFromUrl(url: string): string | null {
  const tokens = extractSessionTokensFromUrl(url);
  if (!tokens) return null;

  if (tokens.type === 'session' && tokens.accessToken && tokens.refreshToken) {
    // Return as JSON for the new format
    return JSON.stringify({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  }

  return tokens.bridgeToken || null;
}

/**
 * Build URL with session tokens for WebView embedding
 *
 * @param baseUrl - The RegattaFlow URL to embed
 * @param accessToken - The Supabase access token
 * @param refreshToken - The Supabase refresh token
 * @returns URL with auth token parameters
 */
export function buildAuthenticatedUrlWithSession(
  baseUrl: string,
  accessToken: string,
  refreshToken: string
): string {
  const url = new URL(baseUrl);
  url.searchParams.set(ACCESS_TOKEN_PARAM, accessToken);
  url.searchParams.set(REFRESH_TOKEN_PARAM, refreshToken);
  return url.toString();
}

/**
 * Build URL with auth token for WebView embedding (legacy)
 *
 * @param baseUrl - The RegattaFlow URL to embed
 * @param bridgeToken - The bridge token from exchangeFirebaseToken
 * @returns URL with auth token parameter
 */
export function buildAuthenticatedUrl(baseUrl: string, bridgeToken: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set(BRIDGE_TOKEN_PARAM, bridgeToken);
  return url.toString();
}

/**
 * Remove auth tokens from URL (for clean navigation after auth)
 *
 * @param url - URL to clean
 * @returns URL without auth parameters
 */
export function cleanAuthTokensFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(BRIDGE_TOKEN_PARAM);
    urlObj.searchParams.delete(AUTH_TOKEN_PARAM);
    urlObj.searchParams.delete(ACCESS_TOKEN_PARAM);
    urlObj.searchParams.delete(REFRESH_TOKEN_PARAM);
    urlObj.searchParams.delete(NEXT_REDIRECT_PARAM);
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Extract the optional `next` redirect param from a bridge URL.
 *
 * Only same-origin paths are allowed (must start with `/` and not `//`).
 * Length is capped to keep history clean and avoid open-redirect-style abuse.
 *
 * @param url - The URL to parse
 * @returns A sanitized path (including query/hash) or null
 */
export function extractNextRedirectFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const raw = urlObj.searchParams.get(NEXT_REDIRECT_PARAM);
    if (!raw) return null;
    // Same-origin path only. Reject protocols and protocol-relative URLs.
    if (!raw.startsWith('/') || raw.startsWith('//')) return null;
    if (raw.length > 1024) return null;
    return raw;
  } catch {
    return null;
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Check if there's a pending bridge token in session storage
 * (Used by AuthProvider to complete WebView auth)
 */
export function getPendingBridgeToken(): {
  token: string;
  userId: string;
  email: string;
} | null {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') {
    return null;
  }

  const token = sessionStorage.getItem('firebase_bridge_token');
  const userId = sessionStorage.getItem('firebase_bridge_user_id');
  const email = sessionStorage.getItem('firebase_bridge_email');

  if (!token || !userId || !email) {
    return null;
  }

  return { token, userId, email };
}

/**
 * Clear pending bridge token from session storage
 */
export function clearPendingBridgeToken(): void {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.removeItem('firebase_bridge_token');
  sessionStorage.removeItem('firebase_bridge_user_id');
  sessionStorage.removeItem('firebase_bridge_email');
}

/**
 * Check if current session is from Dragon Worlds bridge
 */
export async function isDragonWorldsSession(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check user metadata
    const authSource = user.user_metadata?.auth_source;
    return authSource === 'dragon_worlds';
  } catch {
    return false;
  }
}

// ============================================================================
// WEBVIEW COMMUNICATION (for Dragon app to call)
// ============================================================================

/**
 * Message types for WebView communication with Dragon app
 */
export type WebViewMessageType =
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'NAVIGATE'
  | 'OPEN_IN_APP';

export interface WebViewMessage {
  type: WebViewMessageType;
  payload?: any;
}

/**
 * Post a message to the parent WebView (Dragon app)
 * Only works when embedded in a WebView with message handler
 */
export function postMessageToParentApp(message: WebViewMessage): void {
  if (Platform.OS !== 'web') return;

  // For React Native WebView
  if (typeof (window as any).ReactNativeWebView !== 'undefined') {
    (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
    return;
  }

  // For standard postMessage (iframe embedding)
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

/**
 * Notify Dragon app that auth was successful
 */
export function notifyAuthSuccess(userId: string): void {
  postMessageToParentApp({
    type: 'AUTH_SUCCESS',
    payload: { userId },
  });
}

/**
 * Notify Dragon app that auth failed
 */
export function notifyAuthFailure(error: string): void {
  postMessageToParentApp({
    type: 'AUTH_FAILURE',
    payload: { error },
  });
}

/**
 * Request Dragon app to open RegattaFlow native app
 */
export function requestOpenInNativeApp(path?: string): void {
  postMessageToParentApp({
    type: 'OPEN_IN_APP',
    payload: { path },
  });
}
