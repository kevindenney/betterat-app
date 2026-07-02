/**
 * Global Sailing Venues Types
 * Types for international venue intelligence and location-aware sailing features
 */

// Geographic coordinates
export type Coordinates = [longitude: number, latitude: number];

// Venue categories
export type VenueType =
  | 'championship'     // Major championship venues (America's Cup, Olympics, Worlds)
  | 'premier'          // Premier racing centers (SF Bay, Cowes, etc.)
  | 'regional'         // Regional racing hubs
  | 'local'           // Local sailing venues
  | 'club';           // Individual yacht clubs

// Sailing venue core data
export interface SailingVenue {
  id: string;
  name: string;
  coordinates: Coordinates;
  country: string;
  region: string;
  venueType: VenueType;
  establishedYear?: number;
  timeZone: string;

  // Basic sailing characteristics
  primaryClubs: YachtClub[];
  yachtClubs?: YachtClub[]; // backward compatibility alias
  sailingConditions: VenueConditionProfile;
  culturalContext: VenueCulturalProfile;
  weatherSources: WeatherSourceConfig;
  localServices: ServiceProvider[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  dataQuality: 'verified' | 'community' | 'estimated';
}

// Yacht club information
export interface YachtClub {
  id: string;
  name: string;
  shortName?: string;
  founded?: number;
  coordinates?: Coordinates;
  website?: string;
  contactInfo?: ContactInfo;
  facilities: ClubFacility[];
  prestigeLevel: 'international' | 'national' | 'regional' | 'local';
  membershipType: 'private' | 'public' | 'reciprocal';
  racingProgram?: {
    signature?: string[];
    yearRound?: string[];
    majorEvents?: string[];
  };
}

export interface ClubFacility {
  type:
    | 'marina'
    | 'launch_ramp'
    | 'dry_storage'
    | 'repair'
    | 'restaurant'
    | 'accommodation'
    | 'bar'
    | 'event_space'
    | 'fuel'
    | 'storage';
  name: string;
  available: boolean;
  reservationRequired?: boolean;
  contactInfo?: ContactInfo;
}

// Venue sailing conditions
export interface VenueConditionProfile {
  windPatterns: WindPattern[];
  currentData?: CurrentPattern[];
  tidalInformation?: TidalInfo;
  typicalConditions: {
    windSpeed: { min: number; max: number; average: number };
    windDirection: { primary: number; secondary?: number };
    waveHeight: { typical: number; maximum: number };
    visibility: { typical: number; minimum: number };
  };
  seasonalVariations: SeasonalCondition[];
  hazards: VenueHazard[];
  racingAreas: RacingArea[];
}

export interface WindPattern {
  name: string;
  description: string;
  direction: number; // degrees
  speedRange: { min: number; max: number };
  frequency: number; // percentage of time
  seasons: string[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  reliability: 'high' | 'moderate' | 'low' | 'very_high';
}

export interface CurrentPattern {
  name: string;
  direction: number;
  speedRange: { min: number; max: number };
  type: 'tidal' | 'river' | 'wind_driven' | 'oceanic';
  influence: 'major' | 'moderate' | 'minor';
  tidalDependency?: boolean;
}

export interface TidalInfo {
  range: { spring: number; neap: number };
  type: 'semidiurnal' | 'diurnal' | 'mixed';
  significance: 'critical' | 'important' | 'minor' | 'negligible';
  raceImpact: string;
}

export interface SeasonalCondition {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  months: number[];
  windCharacteristics: string;
  weatherPatterns: string;
  racingRecommendations: string;
  equipmentSuggestions?: string[];
}

export interface VenueHazard {
  type: 'shallow_water' | 'rocks' | 'traffic' | 'restricted_area' | 'weather' | 'current' | 'navigation';
  name: string;
  location?: Coordinates;
  description: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  seasonality?: string[];
  mitigation: string;
}

export interface RacingArea {
  name: string;
  coordinates: Coordinates[];
  type: 'inshore' | 'offshore' | 'harbor' | 'bay' | 'lake' | 'river' | 'protected_harbor' | 'open_water';
  depth: { min: number; max: number; average: number };
  typicalCourses: CourseType[];
  capacity: number; // maximum boats
  protection: 'sheltered' | 'semi_sheltered' | 'exposed' | 'moderate';
}

export type CourseType =
  | 'windward_leeward'
  | 'triangle'
  | 'trapezoid'
  | 'round_the_buoys'
  | 'distance'
  | 'pursuit'
  | 'coastal';

// Cultural and regional context
export interface VenueCulturalProfile {
  primaryLanguages: Language[];
  sailingCulture: SailingCultureProfile;
  racingCustoms: RacingCustom[];
  socialProtocols: SocialProtocol[];
  economicFactors: EconomicProfile;
  regulatoryEnvironment: RegulatoryProfile;
}

export interface Language {
  code: string; // ISO 639-1
  name: string;
  prevalence: 'primary' | 'common' | 'useful' | 'rare' | 'secondary';
  sailingTerminology?: boolean;
}

export interface SailingCultureProfile {
  tradition: 'historic' | 'established' | 'developing' | 'emerging' | 'modern';
  competitiveness: 'international' | 'national' | 'regional' | 'recreational';
  formality: 'formal' | 'semi_formal' | 'casual' | 'relaxed';
  inclusivity: 'open' | 'welcoming' | 'selective' | 'exclusive';
  characteristics: string[];
}

export interface RacingCustom {
  type: 'start_sequence' | 'protests' | 'awards' | 'social' | 'equipment';
  name: string;
  description: string;
  importance: 'critical' | 'important' | 'helpful' | 'nice_to_know' | 'moderate' | 'cultural';
}

export interface SocialProtocol {
  name?: string;
  context: 'pre_race' | 'post_race' | 'awards' | 'dining' | 'general' | 'social';
  protocol?: string;
  description?: string;
  importance: 'critical' | 'important' | 'helpful' | 'nice_to_know' | 'moderate' | 'high';
  consequences?: string;
}

export interface EconomicProfile {
  currency: string;
  costLevel: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low';
  entryFees: { typical: number; range: { min: number; max: number } };
  accommodation: { budget: number; moderate: number; luxury: number };
  dining: { budget: number; moderate: number; upscale: number };
  services: { rigger: number; sail_repair: number; chandlery: 'expensive' | 'moderate' | 'affordable' };
  tipping: {
    expected: boolean;
    rate?: number;
    contexts: string[];
  };
}

export interface RegulatoryProfile {
  racingRules: {
    authority: string;
    variations: string[];
    localInterpretations?: string[];
  };
  safetyRequirements: SafetyRequirement[];
  environmentalRestrictions: EnvironmentalRestriction[];
  entryRequirements: EntryRequirement[];
}

export interface SafetyRequirement {
  category: 'equipment' | 'certification' | 'experience' | 'insurance';
  requirement?: string;
  mandatory?: boolean;
  seasonality?: string[];
  name?: string;
  description?: string;
}

export interface EnvironmentalRestriction {
  type: 'marine_park' | 'wildlife' | 'fishing' | 'shipping' | 'military';
  description: string;
  area?: Coordinates[];
  timing?: 'permanent' | 'seasonal' | 'variable';
  implications: string;
  name?: string;
}

export interface EntryRequirement {
  type: 'visa' | 'passport' | 'health' | 'customs' | 'equipment';
  description: string;
  name?: string;
  processingTime?: string;
  cost?: number;
  validityPeriod?: string;
}

// Weather and data sources
export interface WeatherSourceConfig {
  primary: WeatherService;
  secondary?: WeatherService[];
  marine?: MarineWeatherService;
  local?: LocalWeatherSource[];
  updateFrequency: number; // hours
  reliability: number; // 0-1
}

export interface WeatherService {
  name: string;
  type: 'global_model' | 'regional_model' | 'local_station' | 'commercial';
  region: string;
  accuracy: 'high' | 'moderate' | 'basic';
  forecastHorizon: number; // hours
  updateFrequency: number; // hours
  specialties: string[];
}

export interface MarineWeatherService extends WeatherService {
  waveForecasting: boolean;
  currentForecasting: boolean;
  tidalPredictions: boolean;
  marineWarnings: boolean;
}

export interface LocalWeatherSource {
  name: string;
  type: 'weather_station' | 'buoy' | 'yacht_club' | 'marina';
  coordinates: Coordinates;
  parameters: WeatherParameter[];
  realTime: boolean;
  reliability: 'high' | 'moderate' | 'low';
}

export type WeatherParameter =
  | 'wind_speed'
  | 'wind_direction'
  | 'wind_gusts'
  | 'air_temperature'
  | 'water_temperature'
  | 'barometric_pressure'
  | 'humidity'
  | 'visibility'
  | 'wave_height'
  | 'wave_period'
  | 'current_speed'
  | 'current_direction';

// Service providers and contacts
export interface ServiceProvider {
  id: string;
  name: string;
  type: ServiceType;
  coordinates?: Coordinates;
  contactInfo: ContactInfo;
  services: string[];
  specialties?: string[];
  rating?: number;
  recommendations?: number;
  pricing: 'budget' | 'moderate' | 'premium' | 'luxury';
  languages: string[];
}

export type ServiceType =
  | 'marina'
  | 'dry_storage'
  | 'rigging'
  | 'sail_repair'
  | 'boat_repair'
  | 'chandlery'
  | 'transport'
  | 'accommodation'
  | 'restaurant'
  | 'coaching'
  | 'weather_routing'
  | 'customs_agent';

export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  address?: Address;
  hours?: BusinessHours;
  emergencyContact?: boolean;
}

export interface Address {
  street?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  coordinates?: Coordinates;
}

export interface BusinessHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  seasonal?: string;
  notes?: string;
}

// User venue preferences and history
export interface UserVenueProfile {
  userId: string;
  venueId: string;
  homeVenue: boolean;
  visitCount: number;
  firstVisit: Date;
  lastVisit: Date;
  familiarityLevel: 'expert' | 'experienced' | 'intermediate' | 'novice' | 'first_time';

  // Performance at this venue
  racingHistory: {
    totalRaces: number;
    averageFinish: number;
    bestFinish: number;
    preferredConditions: string;
    performanceTrend: 'improving' | 'stable' | 'declining';
  };

  // Local connections
  localContacts: UserContact[];
  clubMemberships: ClubMembership[];
  crewConnections: CrewConnection[];

  // Preferences
  preferences: VenuePreferences;
  notes: string;

  // Travel planning
  travelHistory: TravelRecord[];
  upcomingEvents: PlannedEvent[];
}

export interface UserContact {
  name: string;
  relationship: 'crew' | 'local_sailor' | 'coach' | 'service_provider' | 'race_official';
  contactInfo: ContactInfo;
  notes?: string;
  trustLevel: 'high' | 'moderate' | 'new';
}

export interface ClubMembership {
  clubId: string;
  membershipType: 'full' | 'associate' | 'reciprocal' | 'guest';
  since: Date;
  privileges: string[];
  expiresAt?: Date;
}

export interface CrewConnection {
  userId: string;
  name: string;
  position: 'helm' | 'crew' | 'tactician' | 'bow' | 'pit' | 'trim';
  racesTogetherAtVenue: number;
  compatibility: number; // 0-1
  availability: 'regular' | 'occasional' | 'rare';
}

export interface VenuePreferences {
  accommodationType: 'hotel' | 'yacht_club' | 'private' | 'budget';
  transportPreference: 'rental_car' | 'taxi' | 'public_transport' | 'walking';
  diningPreference: 'yacht_club' | 'local_restaurants' | 'international' | 'budget';
  equipmentPreference: 'ship_own' | 'charter' | 'local_purchase' | 'borrow';
  socialParticipation: 'high' | 'moderate' | 'minimal' | 'observer';
}

export interface TravelRecord {
  eventName: string;
  arrivalDate: Date;
  departureDate: Date;
  accommodation?: string;
  transportUsed: string;
  equipmentMethod: 'shipped' | 'chartered' | 'purchased' | 'borrowed';
  totalCost?: number;
  satisfaction: number; // 1-5
  notes?: string;
}

export interface PlannedEvent {
  eventName: string;
  plannedArrival: Date;
  plannedDeparture: Date;
  status: 'planning' | 'booked' | 'confirmed' | 'traveling' | 'completed';
  bookings: EventBooking[];
  preparationTasks: PreparationTask[];
}

export interface EventBooking {
  type: 'accommodation' | 'transport' | 'equipment' | 'entry_fee';
  provider: string;
  bookingReference?: string;
  cost: number;
  currency: string;
  confirmationStatus: 'pending' | 'confirmed' | 'cancelled';
  bookingDate: Date;
}

export interface PreparationTask {
  task: string;
  category: 'documentation' | 'equipment' | 'travel' | 'cultural' | 'training';
  priority: 'critical' | 'important' | 'helpful' | 'optional';
  dueDate: Date;
  completed: boolean;
  completedDate?: Date;
  notes?: string;
}

// Global sailing intelligence types
export interface GlobalRacingCalendar {
  events: GlobalRacingEvent[];
  circuits: RacingCircuit[];
  qualifyingEvents: QualifyingEvent[];
  championships: ChampionshipEvent[];
}

export interface GlobalRacingEvent {
  id: string;
  name: string;
  venueId: string;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  eventType: 'regatta' | 'championship' | 'qualifier' | 'clinic' | 'social';
  boatClasses: string[];
  entryFee?: number;
  currency?: string;
  website?: string;
  contactInfo?: ContactInfo;

  // Event intelligence
  expectedFleetSize: number;
  competitionLevel: 'international' | 'national' | 'regional' | 'club';
  conditions: string;
  culturalEvents: CulturalEvent[];
  accommodationInfo?: string;

  // BetterAt features
  documentParsingEnabled: boolean;
  aiStrategyAvailable: boolean;
  localKnowledgeLevel: 'expert' | 'good' | 'basic' | 'limited';
}

export interface RacingCircuit {
  name: string;
  region: string;
  events: string[]; // Event IDs
  season: string;
  circuitChampionship: boolean;
  pointsSystem?: string;
  benefits: string[];
}

export interface QualifyingEvent extends GlobalRacingEvent {
  championshipId: string;
  qualifyingPoints: number;
  qualifyingSlots?: number;
  qualificationCriteria: string;
}

export interface ChampionshipEvent extends GlobalRacingEvent {
  championshipLevel: 'world' | 'continental' | 'national' | 'regional';
  qualificationRequired: boolean;
  qualifyingEvents?: string[];
  titleAtStake: string;
}

export interface CulturalEvent {
  name: string;
  date: Date;
  type: 'opening_ceremony' | 'closing_ceremony' | 'welcome_party' | 'awards_dinner' | 'cultural_tour';
  mandatory: boolean;
  cost?: number;
  dressCode?: string;
  description: string;
}

// Location detection and switching
export interface LocationDetection {
  currentLocation: Coordinates;
  detectedVenue?: SailingVenue;
  confidence: number; // 0-1
  detectionMethod: 'gps' | 'network' | 'manual';
  lastUpdated: Date;
}

export interface VenueTransition {
  fromVenue?: SailingVenue;
  toVenue: SailingVenue;
  transitionType: 'first_visit' | 'returning' | 'traveling' | 'relocating';
  transitionDate: Date;
  adaptationRequired: AdaptationRequirement[];
  culturalBriefing?: CulturalBriefing;
}

export interface AdaptationRequirement {
  category: 'language' | 'currency' | 'weather_source' | 'cultural' | 'equipment' | 'regulatory';
  description: string;
  priority: 'critical' | 'important' | 'helpful' | 'optional';
  actionRequired: string;
  userCanConfigure: boolean;
}

export interface CulturalBriefing {
  venueId: string;
  languageInfo: LanguageBriefing;
  culturalProtocols: ProtocolBriefing[];
  economicInfo: EconomicBriefing;
  practicalTips: PracticalTip[];
  localContacts?: RecommendedContact[];
}

export interface LanguageBriefing {
  primaryLanguage: Language;
  commonPhrases: Phrase[];
  sailingTerminology: SailingTerm[];
  pronunciationGuide?: string;
}

export interface Phrase {
  english: string;
  local: string;
  pronunciation?: string;
  context: 'greeting' | 'sailing' | 'emergency' | 'dining' | 'directions' | 'courtesy';
}

export interface SailingTerm {
  english: string;
  local: string;
  pronunciation?: string;
  context: string;
}

export interface ProtocolBriefing {
  situation: string;
  expectedBehavior: string;
  importance: 'critical' | 'important' | 'helpful' | 'nice_to_know' | 'high' | 'moderate';
  consequences?: string;
}

export interface EconomicBriefing {
  currency: string;
  exchangeRate?: number;
  tippingCustoms: TippingCustom[];
  typicalCosts: CostEstimate[];
  paymentMethods: PaymentMethod[];
}

export interface TippingCustom {
  service: string;
  expected: boolean;
  rate?: number;
  rateType: 'percentage' | 'fixed' | 'discretionary';
  notes?: string;
}

export interface CostEstimate {
  category: 'accommodation' | 'dining' | 'transport' | 'services' | 'entry_fees';
  description: string;
  cost: number;
  currency: string;
  notes?: string;
}

export interface PaymentMethod {
  type: 'cash' | 'card' | 'mobile' | 'bank_transfer' | 'crypto';
  acceptance: 'universal' | 'common' | 'limited' | 'rare';
  notes?: string;
}

export interface PracticalTip {
  category: 'transport' | 'accommodation' | 'dining' | 'services' | 'cultural' | 'safety';
  tip: string;
  importance: 'critical' | 'important' | 'helpful' | 'nice_to_know';
  source: 'verified' | 'community' | 'estimated';
}

export interface RecommendedContact {
  name: string;
  role: string;
  organization?: string;
  contactInfo: ContactInfo;
  specialization: string;
  languages: string[];
  trustLevel: 'verified' | 'recommended' | 'community';
  notes?: string;
}
