/**
 * Venue Intelligence Types
 * Type definitions for venue intelligence and yacht club data
 */

export interface VenueLocation {
  id: string;
  name: string;
  type: 'headquarters' | 'racing-station' | 'marina-facility';
  coordinates: { latitude: number; longitude: number };
  location: string;
  established?: number;
  facilities: VenueFacilities;
  accessibility?: VenueAccessibility;
  services?: VenueServices;
}

export interface VenueFacilities {
  dining?: FacilityGroup;
  recreation?: FacilityGroup;
  marine?: FacilityGroup;
  events?: FacilityGroup;
  racing?: FacilityGroup;
  training?: FacilityGroup;
  social?: FacilityGroup;
  technical?: FacilityGroup;
  amenities?: FacilityGroup;
}

export interface FacilityGroup {
  [facilityName: string]: FacilityDetails;
}

export interface FacilityDetails {
  name?: string;
  type?: string;
  capacity?: number;
  hours?: string;
  cost?: string;
  equipment?: string[];
  services?: string[];
  notes?: string;
}

export interface VenueAccessibility {
  public?: {
    mtr?: { station: string; walkTime: string; exitGate?: string };
    taxi?: { fromAirport: string; cost: string };
    bus?: { routes: string[]; nearestStop: string };
  };
  marine?: {
    clubLaunch?: { pickup: string; schedule: string; cost: string };
  };
  parking?: {
    availability: string;
    type: string;
    cost: string;
  };
}

export interface VenueServices {
  concierge?: boolean;
  wifi?: string;
  businessCenter?: boolean;
  lockers?: string;
}

export interface YachtClubData {
  id: string;
  name: string;
  founded: number;
  country: string;
  region: string;
  website: string;
  status?: 'royal-charter' | 'national' | 'regional';
  membership: ClubMembership;
  multipleVenues: boolean;
  headquarters: ClubHeadquarters;
  venues?: { [venueId: string]: VenueLocation };
  racingProgram?: RacingProgram;
  classes?: string[];
  contacts?: ClubContacts;
  administration?: ClubAdministration;
}

export interface ClubMembership {
  total: number;
  racing: number;
  international: boolean;
  reciprocal?: string[];
  exclusive?: boolean;
}

export interface ClubHeadquarters {
  name: string;
  coordinates: [number, number]; // [lng, lat]
  address: string;
  established?: number;
}

export interface RacingProgram {
  yearRound?: {
    [eventName: string]: string;
  };
  signature?: {
    [eventName: string]: SignatureEvent;
  };
  offshore?: {
    [eventName: string]: OffshoreEvent;
  };
}

export interface SignatureEvent {
  name: string;
  distance?: string;
  participation?: string;
  timing: string;
  records?: { [category: string]: string };
}

export interface OffshoreEvent {
  name?: string;
  destination?: string;
  destinations?: string[];
  distance?: string;
  timing: string;
  route?: string;
  format?: string;
  duration?: string;
  records?: { [category: string]: string };
}

export interface ClubContacts {
  general?: ContactInfo;
  racing?: ContactInfo;
  marina?: ContactInfo;
  [department: string]: ContactInfo | undefined;
}

export interface ContactInfo {
  phone: string;
  email: string;
  fax?: string;
}

export interface ClubAdministration {
  commodore: string;
  viceComodore?: string;
  rearCommodore?: string;
  honorarySecretary?: string;
  sailingManager?: string;
  generalManager?: string;
}

export interface RaceCourse {
  id: string;
  name: string;
  type: 'windward-leeward' | 'triangle' | 'coastal' | 'distance' | 'mixed';
  venue: string;
  region: string;
  description?: string;
  distance?: string;
  coordinates?: CourseCoordinates;
  conditions?: CourseConditions;
  timing?: string;
  clubs?: string[];
  classes?: string[];
  records?: { [category: string]: string };
  schedule?: string;
  characteristics?: string[];
  hazards?: string[];
  courses?: string[];
}

export interface CourseCoordinates {
  center?: [number, number];
  bounds?: {
    southwest: [number, number];
    northeast: [number, number];
  };
  marks?: { [markName: string]: [number, number] };
  checkpoints?: CourseCheckpoint[];
  start?: [number, number];
  finish?: [number, number];
  waypoints?: CourseWaypoint[];
}

export interface CourseCheckpoint {
  name: string;
  coordinates: [number, number];
  rounding?: string;
  type?: string;
}

export interface CourseWaypoint {
  name: string;
  coordinates: [number, number];
  type: string;
}

export interface CourseConditions {
  wind?: string;
  current?: string;
  challenges?: string[];
  sea?: {
    protection?: string;
    waves?: string;
    currents?: string;
  };
}

export interface RaceCourseLibrary {
  standardCourses: RaceCourse[];
  customCourses: RaceCourse[];
  historicalTracks?: HistoricalRaceTrack[];
  conditions?: CourseConditions;
}

export interface HistoricalRaceTrack {
  id: string;
  name: string;
  date: string;
  course: RaceCourse;
  participants: number;
  conditions: CourseConditions;
  results: RaceResult[];
}

export interface RaceResult {
  position: number;
  sailNumber: string;
  yachtName: string;
  owner: string;
  elapsedTime: string;
  correctedTime?: string;
  class: string;
}

export interface VenueLogistics {
  transportation: TransportationHub[];
  accommodation: AccommodationOption[];
  provisioning: ProvisioningService[];
  marine: MarineService[];
  emergency: EmergencyService[];
}

export interface TransportationHub {
  type: 'airport' | 'train' | 'bus' | 'taxi' | 'car';
  name: string;
  distance: string;
  cost: string;
  duration: string;
  convenience: 'high' | 'moderate' | 'low';
  notes?: string;
}

export interface AccommodationOption {
  type: 'hotel' | 'apartment' | 'guesthouse' | 'camping';
  name: string;
  location: string;
  priceRange: 'budget' | 'moderate' | 'luxury';
  amenities: string[];
  distance: string;
  rating?: number;
}

export interface ProvisioningService {
  type: 'chandlery' | 'supermarket' | 'restaurant' | 'laundry';
  name: string;
  location: string;
  services: string[];
  hours: string;
  quality: 'excellent' | 'good' | 'adequate';
}

export interface MarineService {
  type: 'fuel' | 'water' | 'repairs' | 'haulout' | 'storage';
  name: string;
  location: string;
  capacity?: string;
  services: string[];
  pricing: 'premium' | 'moderate' | 'competitive' | 'affordable';
  availability: string;
}

export interface EmergencyService {
  type: 'medical' | 'coastguard' | 'police' | 'fire';
  name: string;
  contact: string;
  location: string;
  response: string;
  capabilities: string[];
}

export interface LocalKnowledge {
  windPatterns: WindPattern[];
  currentEffects: CurrentPattern[];
  tacticalAdvice: TacticalTip[];
  localHazards: NavigationHazard[];
  bestPractices: LocalBestPractice[];
}

export interface WindPattern {
  name: string;
  description: string;
  season: string;
  timeOfDay: string;
  strength: string;
  direction: string;
  predictability: 'high' | 'moderate' | 'low';
  racingImplications: string;
}

export interface CurrentPattern {
  name: string;
  description: string;
  strength: string;
  direction: string;
  tidalInfluence: boolean;
  affectedAreas: string[];
  racingImpact: string;
}

export interface TacticalTip {
  situation: string;
  recommendation: string;
  confidence: 'high' | 'moderate' | 'low';
  source: string;
  applicability: string[];
}

export interface NavigationHazard {
  name: string;
  type: 'shallow_water' | 'rocks' | 'traffic' | 'weather' | 'tidal';
  location: { latitude: number; longitude: number };
  description: string;
  severity: 'critical' | 'moderate' | 'minor';
  avoidance: string;
  seasonal?: boolean;
}

export interface LocalBestPractice {
  category: 'racing' | 'navigation' | 'social' | 'logistics';
  practice: string;
  explanation: string;
  importance: 'critical' | 'important' | 'helpful';
  timing: string;
}

// Map integration types
export interface VenueMapMarker {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat] for MapLibre
  type: 'club' | 'marina' | 'service' | 'hazard' | 'mark';
  subtype?: string;
  data: any;
}

export interface VenueMapLayer {
  id: string;
  name: string;
  type: 'yacht-clubs' | 'race-courses' | 'logistics' | 'weather' | 'hazards';
  visible: boolean;
  opacity: number;
  markers: VenueMapMarker[];
}

// Service interfaces
export interface VenueIntelligenceService {
  getVenueData(venueId: string): Promise<VenueData>;
  getYachtClubs(venueId: string): Promise<YachtClubData[]>;
  getRaceCourses(venueId: string): Promise<RaceCourse[]>;
  getLogistics(venueId: string): Promise<VenueLogistics>;
  getLocalKnowledge(venueId: string): Promise<LocalKnowledge>;
}

export interface VenueData {
  id: string;
  name: string;
  region: string;
  country: string;
  coordinates: { latitude: number; longitude: number };
  yachtClubs: YachtClubData[];
  raceCourses: RaceCourse[];
  logistics: VenueLogistics;
  intelligence: LocalKnowledge;
  features: VenueFeatures;
}

export interface VenueFeatures {
  monsoonWinds?: boolean;
  complexTopography?: boolean;
  internationalRacing?: boolean;
  typhoonSeason?: boolean;
  multiVenueClubs?: boolean;
  offshoreRacing?: boolean;
}
