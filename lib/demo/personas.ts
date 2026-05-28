/**
 * Demo persona registry — the static allowlist of personas the
 * `/demo` page exposes and the `mint_demo_session` edge function
 * accepts. Adding a persona here is half of the work; the auth.user
 * record + seed data + edge-function allowlist update is the other
 * half.
 *
 * Per the Codex-reviewed plan, this list is the source of truth and
 * must match the allowlist baked into the edge function. The function
 * REJECTS any persona key not on its own allowlist; this client-side
 * list is *not* a security boundary, just the discovery surface.
 */

export type DemoVertical = 'sail-racing' | 'nursing' | 'india-shg';

export interface DemoPersona {
  /** Stable key — also the value the edge function accepts. */
  key: string;
  /** Real human name as it should render on the card. */
  displayName: string;
  /** Short role label — "Dean", "Faculty", "Student", "Racer". */
  role: string;
  /** One-line bio that lands the pitch on the card. */
  blurb: string;
  /** Vertical it belongs to — drives the section grouping. */
  vertical: DemoVertical;
  /** Initial used as the avatar fallback when no image is shipped. */
  initial: string;
  /** Stable accent for the avatar bubble. */
  avatarColor: string;
  /**
   * Route the persona lands on after the magic link follows.
   * Org-admin personas land on the admin shell; members land on
   * `/practice`. Dynamic org ids are resolved at sign-in time by
   * the auth listener (separate slice — for v1 these are dynamic
   * placeholders).
   */
  landingRoute: string;
  /**
   * Whether this persona has a real auth.user + seed data and
   * appears in the edge-function allowlist. Personas with
   * `available = false` render disabled "Coming soon" cards so the
   * vertical's intent reads even before the seed lands.
   */
  available: boolean;
}

export interface DemoVerticalSection {
  vertical: DemoVertical;
  label: string;
  tagline: string;
  accent: string;
}

export const DEMO_VERTICALS: DemoVerticalSection[] = [
  {
    vertical: 'sail-racing',
    label: 'Sail racing',
    tagline: 'Yacht club → fleet → racer',
    accent: '#2F8FB0',
  },
  {
    vertical: 'nursing',
    label: 'Nursing — Johns Hopkins',
    tagline: 'School of Nursing → clinical site → student',
    accent: '#3155B5',
  },
  {
    vertical: 'india-shg',
    label: 'India SHG entrepreneurs',
    tagline: 'NGO → village SHG → woman entrepreneur',
    accent: '#A05A2C',
  },
];

export const DEMO_PERSONAS: DemoPersona[] = [
  // ─── Sail racing ──────────────────────────────────────────────
  {
    key: 'markus',
    displayName: 'Markus Tham',
    role: 'Racer',
    blurb: 'HK Dragons campaigner, RHKYC. Worlds 2027 prep in flight.',
    vertical: 'sail-racing',
    initial: 'M',
    avatarColor: '#2F8FB0',
    landingRoute: '/practice',
    available: true,
  },
  {
    key: 'yvonne',
    displayName: 'Yvonne Leung',
    role: 'Racer',
    blurb: 'HK Dragons crew, second helm. Following Markus on the cohort thread.',
    vertical: 'sail-racing',
    initial: 'Y',
    avatarColor: '#5BA4C2',
    landingRoute: '/practice',
    available: true,
  },

  // ─── JHU nursing ──────────────────────────────────────────────
  {
    key: 'szanton',
    displayName: 'Dr. Sarah Szanton',
    role: 'Dean',
    blurb: 'Dean of Johns Hopkins School of Nursing. Institutional view.',
    vertical: 'nursing',
    initial: 'S',
    avatarColor: '#3155B5',
    landingRoute: '/admin/johns-hopkins-school-of-nursing/overview',
    available: true,
  },
  {
    key: 'patricia',
    displayName: 'Patricia Morrison',
    role: 'Faculty',
    blurb: 'Clinical faculty, JHSON. Reviewing competency evidence for her cohort.',
    vertical: 'nursing',
    initial: 'P',
    avatarColor: '#5777D3',
    landingRoute: '/faculty-dashboard',
    available: true,
  },
  {
    key: 'maya',
    displayName: 'Maya Patel',
    role: 'Student',
    blurb: 'BSN 2027. ICU job at JHH is the vision. Also sketches + plays golf.',
    vertical: 'nursing',
    initial: 'M',
    avatarColor: '#7F9BE0',
    landingRoute: '/practice',
    available: true,
  },

  // ─── India SHG entrepreneurs ──────────────────────────────────
  {
    key: 'pradan-field',
    displayName: 'PRADAN Field Officer',
    role: 'Field Officer',
    blurb: 'Mentors the Khunti unit. Visits Savitri’s SHG monthly.',
    vertical: 'india-shg',
    initial: 'F',
    avatarColor: '#A05A2C',
    landingRoute: '/admin/pradan-khunti/overview',
    available: true,
  },
  {
    key: 'savitri',
    displayName: 'Savitri Devi Munda',
    role: 'Entrepreneur',
    blurb: 'Lac craft business, Khunti. Saving toward her daughter’s tuition.',
    vertical: 'india-shg',
    initial: 'S',
    avatarColor: '#C77D3E',
    landingRoute: '/practice',
    available: true,
  },
];

export function personasByVertical(vertical: DemoVertical): DemoPersona[] {
  return DEMO_PERSONAS.filter((p) => p.vertical === vertical);
}

export function findPersona(key: string): DemoPersona | undefined {
  return DEMO_PERSONAS.find((p) => p.key === key);
}
