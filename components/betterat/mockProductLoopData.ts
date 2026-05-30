/**
 * Front-end placeholder data for the BetterAt product-loop surfaces.
 *
 * TODO(betterat-data): Replace these fixtures with Firestore-backed reads
 * from collections such as interests, steps, userSteps, follows,
 * organizations, memberships, blueprints, resources, concepts, places,
 * placeActivity, and inboxItems.
 */

export type BetterAtInterestKey = 'nursing' | 'sail-racing' | 'golf';

export interface WatchFeedItem {
  id: string;
  personName: string;
  interest: BetterAtInterestKey;
  organization?: string;
  stepTitle: string;
  status: 'planning' | 'doing' | 'reflected' | 'completed';
  place?: string;
  resource?: string;
  reflection?: string;
  nextStep?: string;
  privacyNote?: string;
}

export interface DiscoverItem {
  id: string;
  category: DiscoverCategoryKey;
  title: string;
  subtitle: string;
  meta: string;
  interest: string;
  actionLabel: string;
  workshopLabel: string;
}

export interface WorkshopCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  target:
    | 'practice'
    | 'plans'
    | 'resources'
    | 'concepts'
    | 'network'
    | 'organizations'
    | 'saved-steps'
    | 'blueprints';
}

export type DiscoverCategoryKey =
  | 'interests'
  | 'organizations'
  | 'people'
  | 'plans'
  | 'blueprints'
  | 'resources'
  | 'places';

export const WATCH_INTEREST_OPTIONS: { key: BetterAtInterestKey; label: string }[] = [
  { key: 'nursing', label: 'Nursing' },
  { key: 'sail-racing', label: 'Sail Racing' },
  { key: 'golf', label: 'Golf' },
];

export const WATCH_FILTER_OPTIONS = [
  { id: 'following', label: 'Following' },
  { id: 'people', label: 'People' },
  { id: 'interest', label: 'Interest' },
  { id: 'organizations', label: 'Organizations' },
] as const;

export const WATCH_FEED_BY_INTEREST: Record<BetterAtInterestKey, WatchFeedItem[]> = {
  nursing: [
    {
      id: 'watch-nursing-1',
      personName: 'Emily Carter',
      interest: 'nursing',
      organization: 'Johns Hopkins School of Nursing',
      stepTitle: 'Prep for medication handoff with SBAR notes',
      status: 'planning',
      place: 'Clinical ward',
      resource: 'Shift checklist',
      reflection: 'Shared reflection — no patient-identifying details.',
      nextStep: 'Run the handoff with a preceptor before evening shift.',
      privacyNote: 'Clinical activity shared at the site level only.',
    },
    {
      id: 'watch-nursing-2',
      personName: 'Moira Campbell',
      interest: 'nursing',
      organization: 'MSN Acute Care Cohort',
      stepTitle: 'Chest-auscultation drill with simulated low-frequency findings',
      status: 'doing',
      place: 'Simulation lab',
      resource: 'Cardiac auscultation audio set',
      reflection: 'Used the bell longer on S3/S4 review after missing it last week.',
      nextStep: 'Repeat on Friday with faculty feedback.',
      privacyNote: 'Shared reflection — no patient-identifying details.',
    },
    {
      id: 'watch-nursing-3',
      personName: 'Jordan Lee',
      interest: 'nursing',
      organization: 'Mercy Clinical Placement',
      stepTitle: 'Reflect on first independent admission interview',
      status: 'reflected',
      place: 'Hospital shift site',
      resource: 'Admission interview rubric',
      reflection: 'Stayed calm, but missed one follow-up question on medication history.',
      nextStep: 'Practice the follow-up script before the next intake.',
      privacyNote: 'Shared reflection — no patient-identifying details.',
    },
  ],
  'sail-racing': [
    {
      id: 'watch-sailing-1',
      personName: 'Felix Wong',
      interest: 'sail-racing',
      organization: 'Royal Hong Kong Yacht Club',
      stepTitle: 'Rehearse start-line acceleration for Race 4',
      status: 'planning',
      place: 'Start line',
      resource: 'Line bias note from last Wednesday',
      reflection: 'Targeting two cleaner builds with less sheet trim noise.',
      nextStep: 'Add a timing-only rep before the warning signal.',
    },
    {
      id: 'watch-sailing-2',
      personName: 'Ava Hart',
      interest: 'sail-racing',
      organization: 'Dragon Fleet',
      stepTitle: 'Run three heavy-air gybe reps with the new crew call pattern',
      status: 'doing',
      place: 'Hebe Haven race area',
      resource: 'Crew comms checklist',
      reflection: 'The third rep held shape best when the bow call came earlier.',
      nextStep: 'Save the early-call pattern into tomorrow’s practice.',
    },
    {
      id: 'watch-sailing-3',
      personName: 'Marcus Tan',
      interest: 'sail-racing',
      organization: 'RHKYC Tuesday Series',
      stepTitle: 'Debrief the left-side first beat from Race 5',
      status: 'completed',
      place: 'Royal Hong Kong Yacht Club',
      resource: 'Post-race notes',
      reflection: 'Committed early and lost the shift. Need a better mid-beat check-in.',
      nextStep: 'Turn that check-in into a pre-race cue card.',
    },
  ],
  golf: [
    {
      id: 'watch-golf-1',
      personName: 'Isabella Blair',
      interest: 'golf',
      organization: 'Harbour Range',
      stepTitle: 'Fix the slice with two-ball path drill',
      status: 'doing',
      place: 'Driving range',
      resource: 'Coach path drill video',
      reflection: 'Ball two stayed straighter when the setup was narrower.',
      nextStep: 'Take the same setup to a nine-hole round this weekend.',
    },
    {
      id: 'watch-golf-2',
      personName: 'Nikhil Shah',
      interest: 'golf',
      organization: 'Peak Form Golf',
      stepTitle: 'Plan lag-putt distance reps before Saturday round',
      status: 'planning',
      place: 'Practice green',
      resource: 'Putting ladder notes',
      reflection: 'Need a clearer 20-foot reference stroke before tournament pace.',
      nextStep: 'Do six ladder reps and log misses short vs long.',
    },
    {
      id: 'watch-golf-3',
      personName: 'Grace Monroe',
      interest: 'golf',
      organization: 'Clearwater Club',
      stepTitle: 'Reflect on tee-shot choice at Hole 7',
      status: 'reflected',
      place: 'Hole 7',
      resource: 'Round strategy card',
      reflection: 'Driver brought rough into play. Hybrid would have left the same wedge.',
      nextStep: 'Save the hybrid decision into the next course plan.',
    },
  ],
};

export const DISCOVER_CATEGORY_OPTIONS: { key: DiscoverCategoryKey; label: string }[] = [
  { key: 'interests', label: 'Interests' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'people', label: 'People' },
  { key: 'plans', label: 'Plans' },
  { key: 'blueprints', label: 'Blueprints' },
  { key: 'resources', label: 'Resources' },
  { key: 'places', label: 'Places' },
];

export const DISCOVER_ITEMS_BY_CATEGORY: Record<DiscoverCategoryKey, DiscoverItem[]> = {
  interests: [
    {
      id: 'discover-interest-nursing',
      category: 'interests',
      title: 'Nursing',
      subtitle: 'Competencies, shifts, simulations, and shared reflections.',
      meta: '24 organizations · 130 public step examples',
      interest: 'Nursing',
      actionLabel: 'Follow interest',
      workshopLabel: 'Add to Library',
    },
    {
      id: 'discover-interest-sailing',
      category: 'interests',
      title: 'Sail Racing',
      subtitle: 'Race craft, local knowledge, crews, and blueprints.',
      meta: '19 clubs · 82 public step examples',
      interest: 'Sail Racing',
      actionLabel: 'Follow interest',
      workshopLabel: 'Add to Library',
    },
  ],
  organizations: [
    {
      id: 'discover-org-rhkyc',
      category: 'organizations',
      title: 'Royal Hong Kong Yacht Club',
      subtitle: 'Series racing, fleet activity, and local start-line knowledge.',
      meta: 'Open race notices · 6 active fleets',
      interest: 'Sail Racing',
      actionLabel: 'Join organization',
      workshopLabel: 'Save to Library',
    },
    {
      id: 'discover-org-jhu',
      category: 'organizations',
      title: 'Johns Hopkins School of Nursing',
      subtitle: 'Programs, labs, and competency-based step templates.',
      meta: 'Simulation labs · faculty blueprints',
      interest: 'Nursing',
      actionLabel: 'Join organization',
      workshopLabel: 'Save to Library',
    },
  ],
  people: [
    {
      id: 'discover-person-ava',
      category: 'people',
      title: 'Ava Hart',
      subtitle: 'Shares start-line reps and heavy-air crew communication steps.',
      meta: 'Dragon Fleet · Step reflections every week',
      interest: 'Sail Racing',
      actionLabel: 'Follow person',
      workshopLabel: 'Save to Library',
    },
    {
      id: 'discover-person-emily',
      category: 'people',
      title: 'Emily Carter',
      subtitle: 'Posts simulation-to-shift step progress with privacy-safe notes.',
      meta: 'MSN Acute Care · SBAR and intake steps',
      interest: 'Nursing',
      actionLabel: 'Follow person',
      workshopLabel: 'Save to Library',
    },
  ],
  plans: [
    {
      id: 'discover-plan-starts',
      category: 'plans',
      title: 'Wednesday Start-Line Build',
      subtitle: 'A four-step micro-plan for cleaner timing and acceleration.',
      meta: 'Coach-led plan · 18 subscribers',
      interest: 'Sail Racing',
      actionLabel: 'Subscribe',
      workshopLabel: 'Add to Library',
    },
    {
      id: 'discover-plan-handoff',
      category: 'plans',
      title: 'Shift Handoff Confidence Sprint',
      subtitle: 'Three focused steps for calmer, clearer handoffs.',
      meta: 'Faculty plan · 12 subscribers',
      interest: 'Nursing',
      actionLabel: 'Subscribe',
      workshopLabel: 'Add to Library',
    },
  ],
  blueprints: [
    {
      id: 'discover-blueprint-ward',
      category: 'blueprints',
      title: 'Clinical Ward Week Blueprint',
      subtitle: 'Observed steps, reflection prompts, and next-step scaffolding.',
      meta: 'Blueprint update cadence · weekly',
      interest: 'Nursing',
      actionLabel: 'Subscribe',
      workshopLabel: 'Save to Library',
    },
    {
      id: 'discover-blueprint-golf',
      category: 'blueprints',
      title: 'Nine-Hole Slice Repair Blueprint',
      subtitle: 'Move from range drill to on-course decision making.',
      meta: 'Coach notes included',
      interest: 'Golf',
      actionLabel: 'Subscribe',
      workshopLabel: 'Save to Library',
    },
  ],
  resources: [
    {
      id: 'discover-resource-starts',
      category: 'resources',
      title: 'Heavy-Air Starts Breakdown',
      subtitle: 'Annotated race-start resource with line setup cues.',
      meta: 'Video · 8 minutes',
      interest: 'Sail Racing',
      actionLabel: 'Save resource',
      workshopLabel: 'Add to Library',
    },
    {
      id: 'discover-resource-sbar',
      category: 'resources',
      title: 'SBAR Pocket Prompt',
      subtitle: 'One-page handoff reference for pre-shift prep.',
      meta: 'PDF · 1 page',
      interest: 'Nursing',
      actionLabel: 'Save resource',
      workshopLabel: 'Add to Library',
    },
  ],
  places: [
    {
      id: 'discover-place-hebe',
      category: 'places',
      title: 'Hebe Haven race area',
      subtitle: 'Where crews are planning and debriefing local race steps.',
      meta: 'Upcoming starts · local strategy threads',
      interest: 'Sail Racing',
      actionLabel: 'Save place',
      workshopLabel: 'Add to Library',
    },
    {
      id: 'discover-place-sim-lab',
      category: 'places',
      title: 'Simulation lab',
      subtitle: 'Practice site for skills before live clinical shifts.',
      meta: 'Faculty-assigned drills · reflection prompts',
      interest: 'Nursing',
      actionLabel: 'Save place',
      workshopLabel: 'Add to Library',
    },
  ],
};

export const WORKSHOP_CATEGORIES: WorkshopCategory[] = [
  {
    id: 'plans',
    title: 'Plans',
    description: 'Blueprints and sequences you can turn into your next step.',
    icon: 'map-outline',
    target: 'plans',
  },
  {
    id: 'resources',
    title: 'Resources',
    description: 'Notes, videos, links, and files you bring into practice.',
    icon: 'document-text-outline',
    target: 'resources',
  },
  {
    id: 'concepts',
    title: 'Concepts',
    description: 'Ideas you are shaping, testing, and refining through steps.',
    icon: 'bulb-outline',
    target: 'concepts',
  },
  {
    id: 'network',
    title: 'Network',
    description: 'People you follow and learn from while adapting their steps.',
    icon: 'people-outline',
    target: 'network',
  },
  {
    id: 'organizations',
    title: 'Organizations',
    description: 'Clubs, schools, and groups that can feed your library.',
    icon: 'business-outline',
    target: 'organizations',
  },
  {
    id: 'saved-steps',
    title: 'Saved Steps',
    description: 'Ideas worth adapting into your own practice timeline.',
    icon: 'bookmark-outline',
    target: 'saved-steps',
  },
  {
    id: 'blueprints',
    title: 'Blueprints',
    description: 'Subscribed structures you can pull into practice when needed.',
    icon: 'layers-outline',
    target: 'blueprints',
  },
];
