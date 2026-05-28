/**
 * DemoSessionService — typed client for the `mint_demo_session` edge
 * function. The edge function is Codex's backend slice (Wave 1); this
 * service exists ahead of it so the `/demo` page UI can integrate
 * against a typed contract rather than waiting on the function deploy.
 *
 * When the function isn't deployed (local dev, env flag off, etc.),
 * `mintDemoSession` surfaces a typed `DemoSessionUnavailableError` so
 * the page can render a clear "demo mode not enabled" state instead
 * of an opaque crash.
 *
 * The acceptance criteria locked with Codex round 2:
 *   - Hard allowlist of persona keys in the edge function (we read
 *     them from `lib/demo/personas.ts` on the client; the function
 *     has its own copy and rejects anything not in it).
 *   - `SUPABASE_DEMO_MODE` env flag required; without it the function
 *     returns 410 Gone.
 *   - Rate-limit 5 mints/IP/min.
 *   - Magic-link expires in 5 minutes.
 *   - `demo_session_audit` records every mint.
 */

import { Linking, Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import { findPersona } from '@/lib/demo/personas';

export interface MintDemoSessionInput {
  /** Persona key — must match an entry in DEMO_PERSONAS. */
  personaKey: string;
  /**
   * Where to redirect after the magic link is consumed. Optional —
   * the edge function falls back to the persona's landing route from
   * its own allowlist when omitted.
   */
  redirectTo?: string;
}

export interface MintDemoSessionResult {
  /** The Supabase auth magic-link the client follows to sign in. */
  actionLink: string;
  /** ISO timestamp the link expires at (5 minutes from mint). */
  expiresAt: string;
  /** Echoed persona key so the caller can sanity-check the response. */
  personaKey: string;
}

/**
 * Thrown when the edge function isn't reachable or the env flag is
 * off. Lets the UI render an explanatory state instead of "Error".
 */
export class DemoSessionUnavailableError extends Error {
  constructor(message = 'Demo sign-in is not currently enabled.') {
    super(message);
    this.name = 'DemoSessionUnavailableError';
  }
}

export class DemoPersonaUnknownError extends Error {
  constructor(personaKey: string) {
    super(`Unknown demo persona: ${personaKey}`);
    this.name = 'DemoPersonaUnknownError';
  }
}

export async function mintDemoSession(
  input: MintDemoSessionInput,
): Promise<MintDemoSessionResult> {
  if (!findPersona(input.personaKey)) {
    throw new DemoPersonaUnknownError(input.personaKey);
  }

  const { data, error } = await supabase.functions.invoke<MintDemoSessionResult>(
    'mint-demo-session',
    {
      body: {
        persona_key: input.personaKey,
        redirect_to: input.redirectTo,
      },
    },
  );

  if (error) {
    // FunctionsHttpError on 410 = demo mode disabled. Surface as the
    // typed "unavailable" state so the page can render "demo not
    // enabled" copy rather than a generic failure.
    const status = (error as { context?: { status?: number } })?.context?.status;
    if (status === 410 || status === 404) {
      throw new DemoSessionUnavailableError();
    }
    throw new Error(error.message || 'Failed to mint demo session');
  }
  if (!data?.actionLink) {
    throw new Error('Demo session response was missing action link');
  }

  return data;
}

/**
 * Follow the magic link in-context. On web we navigate the current
 * tab; on native we hand off to the OS (which deep-links back into
 * the app via the registered URL scheme).
 */
export async function followDemoMagicLink(actionLink: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(actionLink);
    return;
  }
  const can = await Linking.canOpenURL(actionLink);
  if (!can) {
    throw new Error('Cannot open demo magic link on this device');
  }
  await Linking.openURL(actionLink);
}
