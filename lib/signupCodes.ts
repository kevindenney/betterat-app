/**
 * Shared signup codes (e.g. printed at events or embedded in partner-app
 * links like better.at/signup?code=DRAGONWORLDS27). A recognized code maps
 * to a blueprint grant that rides the existing ?blueprint= auto-subscribe
 * pipeline in signup.tsx / commitSignupContext.
 */

import { HKDW_BLUEPRINT_SLUG } from '@/lib/hkdwPhaseP';

export interface SignupCodeGrant {
  blueprintRef: string;
  blueprintName: string;
}

const SIGNUP_CODES: Record<string, SignupCodeGrant> = {
  DRAGONWORLDS27: {
    blueprintRef: HKDW_BLUEPRINT_SLUG,
    blueprintName: 'Dragon Worlds 2027 Prep Plan',
  },
};

export function resolveSignupCode(code: string | undefined): SignupCodeGrant | undefined {
  if (!code) return undefined;
  return SIGNUP_CODES[code.trim().toUpperCase()];
}
