import { MockBoat, MockRace, MOCK_BOATS, MOCK_RACES } from '@/constants/mockData';
import type { UserType } from '@/services/supabase';

export interface DemoWorkspace {
  profile: {
    full_name: string;
    email: string;
    user_type: UserType;
    onboarding_step: string;
    onboarding_completed: boolean;
  };
  races: {
    id: string;
    name: string;
    venue: string;
    date: string;
    startTime: string;
    boatClass: string;
    wind: { direction: string; speedMin: number; speedMax: number };
    tide: { state: 'flooding' | 'ebbing' | 'slack'; height: number };
    strategy: string;
  }[];
  boats: MockBoat[];
  fleets: { id: string; name: string; members: number }[];
  performanceHistory: { id: string; event: string; date: string; position: number; fleet: number }[];
  timerSessions: { id: string; race: string; completedAt: string }[];
}

const formatRace = (race: MockRace) => ({
  id: race.id,
  name: race.name,
  venue: race.venue,
  date: race.date,
  startTime: race.startTime,
  boatClass: race.venue || 'Class TBD',
  wind: race.wind,
  tide: race.tide,
  strategy: race.strategy,
});

const SAILOR_WORKSPACE: DemoWorkspace = {
  profile: {
    full_name: 'Demo Skipper',
    email: 'demo-sailor@better.at',
    user_type: 'sailor',
    onboarding_step: 'demo_sailor',
    onboarding_completed: true,
  },
  races: MOCK_RACES.map(formatRace),
  boats: MOCK_BOATS,
  fleets: [
    { id: 'demo-fleet-1', name: 'Victoria Harbour Dragons', members: 18 },
    { id: 'demo-fleet-2', name: 'Hebe Haven Mixed Keelboats', members: 24 },
  ],
  performanceHistory: [
    { id: 'demo-result-1', event: 'Harbour Sprint', date: '2025-09-12', position: 2, fleet: 18 },
    { id: 'demo-result-2', event: 'Autumn Trophy', date: '2025-09-05', position: 4, fleet: 22 },
    { id: 'demo-result-3', event: 'Typhoon Shield', date: '2025-08-27', position: 1, fleet: 20 },
  ],
  timerSessions: [
    { id: 'demo-session-1', race: 'Practice Start - Kowloon Bay', completedAt: '2025-09-10T09:10:00Z' },
  ],
};

const COACH_WORKSPACE: DemoWorkspace = {
  profile: {
    full_name: 'Demo Coach',
    email: 'demo-coach@betterat.app',
    user_type: 'coach',
    onboarding_step: 'demo_coach',
    onboarding_completed: true,
  },
  races: [],
  boats: [],
  fleets: [
    { id: 'coach-group-1', name: 'Elite Match Racing Squad', members: 6 },
    { id: 'coach-group-2', name: 'Youth Development Team', members: 12 },
  ],
  performanceHistory: [
    { id: 'coach-result-1', event: 'Client Coaching Session', date: '2025-09-08', position: 1, fleet: 5 },
  ],
  timerSessions: [],
};

const CLUB_WORKSPACE: DemoWorkspace = {
  profile: {
    full_name: 'Demo Club Manager',
    email: 'demo-club@betterat.app',
    user_type: 'club',
    onboarding_step: 'demo_club',
    onboarding_completed: true,
  },
  races: [
    {
      id: 'club-race-1',
      name: 'Autumn Harbour Series',
      venue: 'Victoria Harbour',
      date: '2025-10-04T02:00:00Z',
      startTime: '10:00',
      boatClass: 'J/80',
      wind: { direction: 'NE', speedMin: 8, speedMax: 14 },
      tide: { state: 'flooding', height: 1.5 },
      strategy: 'Harbour course with two laps. Use start tracker for committee boat.',
    },
    {
      id: 'club-race-2',
      name: 'Inshore Sprints',
      venue: 'Repulse Bay',
      date: '2025-10-11T02:00:00Z',
      startTime: '09:30',
      boatClass: 'IRC A',
      wind: { direction: 'E', speedMin: 10, speedMax: 16 },
      tide: { state: 'ebbing', height: 1.1 },
      strategy: 'Short course with gate finish. Track mark rounding times.',
    },
  ],
  boats: [],
  fleets: [
    { id: 'club-fleet-1', name: 'Wednesday Night PHRF', members: 34 },
    { id: 'club-fleet-2', name: 'Junior Dinghy Program', members: 28 },
  ],
  performanceHistory: [],
  timerSessions: [],
};

export const getDemoWorkspace = (role: UserType | null | undefined): DemoWorkspace => {
  switch (role) {
    case 'coach':
      return COACH_WORKSPACE;
    case 'club':
      return CLUB_WORKSPACE;
    case 'sailor':
    default:
      return SAILOR_WORKSPACE;
  }
};
