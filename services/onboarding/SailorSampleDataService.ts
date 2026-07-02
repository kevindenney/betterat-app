/**
 * Sailor Sample Data Service
 * Creates comprehensive sample data for new sailor signups to provide
 * an immediate, realistic app experience with rig tuning, weather, etc.
 */

import { supabase } from '@/services/supabase';
import { SeasonService } from '@/services/SeasonService';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('SailorSampleDataService');

// ============================================================================
// Constants
// ============================================================================

// Dragon class ID - verified from codebase
const DRAGON_CLASS_ID = '130829e3-05dd-4ab3-bea2-e0231c12064a';

// Hong Kong Victoria Harbour coordinates
const HK_COORDINATES = {
  latitude: 22.2855,
  longitude: 114.1577,
};

// Sample boat names
const BOAT_NAMES = [
  'Swift Dragon',
  'Wind Chaser',
  'Sea Spirit',
  'Phoenix Rising',
  'Thunder',
];

// Sample crew members
const SAMPLE_CREW = [
  { name: 'Alex Chen', role: 'bowman' as const },
  { name: 'Sam Wong', role: 'tactician' as const },
];

// Sample equipment for Dragon class
// Note: boat_equipment table uses custom_name for display, condition for status
const SAMPLE_EQUIPMENT = [
  { category: 'mast', custom_name: 'Main Mast - Petticrows Dragon Standard', condition: 'good' },
  { category: 'shrouds', custom_name: 'Standing Rigging - Sta-Lok Dragon Rig Set', condition: 'good' },
  { category: 'mainsail', custom_name: 'Main A-7+ - North Sails Dragon', condition: 'good' },
  { category: 'jib', custom_name: 'Jib MG-15 - North Sails Dragon', condition: 'good' },
];

// Sample AI Coach Analysis for completed race
const SAMPLE_AI_ANALYSIS = {
  overall_summary:
    'Strong performance with a podium finish in challenging conditions. Excellent start execution and consistent upwind speed contributed to securing 3rd place.',
  start_analysis:
    'Clean start from the boat end with good acceleration. Hit the line at full speed with clear air above.',
  upwind_analysis:
    'Consistent tacking angles and good pointing ability. Stayed in phase with oscillating shifts, gaining 2-3 boat lengths on each shift.',
  downwind_analysis:
    'Smooth transitions between gybe angles. Good wave selection. Lost one position at leeward mark due to wide rounding.',
  tactical_decisions:
    'Decision to favor right side on first beat validated by persistent 10-degree shift. Smart covering on final beat.',
  boat_handling:
    'Mark roundings were clean. Tacks well-executed with minimal speed loss. Gybes showed good wave timing.',
  recommendations: [
    'Practice leeward mark approaches to tighten rounding radius',
    'Work on identifying when to be aggressive vs. conservative',
    'Continue refining upwind pointing in stronger breeze',
  ],
  confidence_score: 0.85,
};

// Sample key moment text for completed race
const SAMPLE_KEY_MOMENT =
  'Gained two positions on the final downwind leg by catching a wave set that the boats ahead missed. The commitment to sailing deeper paid off when the waves lined up perfectly.';

// Sample NOR content
const SAMPLE_NOR_CONTENT = `
NOTICE OF RACE
HONG KONG DRAGON SPRING SERIES 2025

1. RULES
1.1 The regatta will be governed by the rules as defined in The Racing Rules of Sailing (RRS 2021-2024).
1.2 The Dragon Class Rules will apply.
1.3 HKSF Prescriptions will apply.

2. ELIGIBILITY AND ENTRY
2.1 The event is open to all Dragon class boats.
2.2 Valid third-party liability insurance is required.

3. SCHEDULE
Racing Days: As per club calendar
First Warning Signal: 11:00 local time
Races per day: Up to 3

4. VENUE
4.1 Racing will take place in Victoria Harbour.
4.2 The race office is located at Royal Hong Kong Yacht Club, Kellett Island.

5. COURSES
5.1 Windward-leeward courses will be used.
5.2 Course details will be posted on the official notice board.

6. SCORING
6.1 The Low Point System of RRS Appendix A will apply.
6.2 One race is required to be completed to constitute a series.
`;

// Sample SI content
const SAMPLE_SI_CONTENT = `
SAILING INSTRUCTIONS
HONG KONG DRAGON SPRING SERIES 2025

1. RULES
1.1 The regatta will be governed by the rules as defined in The Racing Rules of Sailing (RRS 2021-2024).
1.2 The Dragon Class Rules will apply.

2. NOTICES TO COMPETITORS
2.1 Notices to competitors will be posted on the official notice board.

3. CHANGES TO SAILING INSTRUCTIONS
3.1 Any change to the sailing instructions will be posted before 09:00 on the day it will take effect.

4. SIGNALS MADE ASHORE
4.1 Signals made ashore will be displayed from the race office flagpole.

5. SCHEDULE OF RACES
5.1 First warning signal: 11:00
5.2 Subsequent races will follow as soon as practicable.

6. CLASS FLAG
6.1 The class flag will be the Dragon class insignia.

7. RACING AREA
7.1 Racing will be in Victoria Harbour.

8. THE COURSES
8.1 Windward-leeward course with spreader mark.
8.2 Approximate course length: 1.2 nautical miles per lap.

9. MARKS
9.1 Windward mark: Orange inflatable cylinder
9.2 Leeward mark/gate: Yellow inflatable cylinders
9.3 Spreader mark: Green inflatable cylinder

10. THE START
10.1 The starting line will be between a staff displaying an orange flag on the signal vessel and the course side of the port-end starting mark.
10.2 A boat starting later than 4 minutes after her starting signal will be scored DNS.

11. THE FINISH
11.1 The finishing line will be between a staff displaying a blue flag on the finish vessel and the course side of the finishing mark.

12. PENALTY SYSTEM
12.1 RRS 44.1 is changed so that the Two-Turns Penalty is replaced by the One-Turn Penalty.

13. SAFETY
13.1 A boat that retires from a race shall notify the race committee as soon as possible.
`;

// ============================================================================
// Types
// ============================================================================

export interface CreateSampleDataInput {
  userId: string;
  userName: string;
  force?: boolean; // Skip duplicate check and recreate sample data
}

export interface CreateSampleDataResult {
  success: boolean;
  sailorProfileId?: string;
  boatId?: string;
  raceId?: string;
  seasonId?: string;
  error?: string;
}

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Create comprehensive sample data for a new sailor
 * This function is designed to be fire-and-forget - it should not block signup
 */
export async function createSailorSampleData(
  input: CreateSampleDataInput
): Promise<CreateSampleDataResult> {
  const { userId, userName, force } = input;

  logger.info('[SailorSampleDataService] Creating sample data for sailor', {
    userId: userId.slice(0, 8) + '...',
    userName,
    force: !!force,
  });

  try {
    // Step 0: Check if sample data already exists (avoid duplicates)
    // Skip this check if force=true (used for Reset Sample Data in Settings)
    if (!force) {
      const { data: existingSampleRaces, error: checkError } = await supabase
        .from('regattas')
        .select('id')
        .eq('created_by', userId)
        .contains('metadata', { is_sample: true })
        .limit(5);

      if (!checkError && existingSampleRaces && existingSampleRaces.length > 0) {
        logger.info('[SailorSampleDataService] Sample data already exists, skipping creation', {
          existingCount: existingSampleRaces.length,
        });
        return {
          success: true,
          raceId: existingSampleRaces[0].id,
        };
      }
    }

    // Step 1: Ensure sailor profile exists
    const sailorProfileId = await ensureSailorProfile(userId);
    logger.debug('[SailorSampleDataService] Sailor profile ready:', sailorProfileId);

    // Step 2: Ensure Dragon boat class exists
    await ensureDragonClass();

    // Step 3: Create Dragon boat (uses userId for RLS policy compliance)
    const boatId = await createSampleBoat(userId, userName);
    logger.debug('[SailorSampleDataService] Sample boat created:', boatId);

    // Step 4: Register class membership (uses userId for RLS policy compliance)
    await registerClassMembership(userId);

    // Step 5: Create sample equipment
    await createSampleEquipment(userId, boatId);
    logger.debug('[SailorSampleDataService] Sample equipment created');

    // Step 6: Create sample crew (uses userId for RLS policy compliance)
    await createSampleCrew(userId, boatId);
    logger.debug('[SailorSampleDataService] Sample crew created');

    // Step 7: Get or create season for the race date (7 days from now)
    const raceDate = getDateDaysFromNow(7);
    const season = await SeasonService.getOrCreateSeasonForDate(
      userId,
      raceDate.toISOString()
    );
    logger.debug('[SailorSampleDataService] Season ready:', season.id);

    // Step 8: Create sample race (regatta)
    const raceId = await createSampleRace(userId, boatId, raceDate);
    logger.debug('[SailorSampleDataService] Sample race created:', raceId);

    // Step 9: Link regatta to season
    await linkRegattaToSeason(raceId, season.id);
    logger.debug('[SailorSampleDataService] Regatta linked to season');

    // Step 10: Create sample NOR and SI documents
    await createSampleDocuments(userId, raceId);
    logger.debug('[SailorSampleDataService] Sample documents created');

    // =====================================================
    // NEW: Create COMPLETED sample race (7 days in the past)
    // =====================================================

    // Step 11: Get or create season for PAST race date
    const pastRaceDate = getDateDaysFromNow(-7); // 7 days AGO
    const pastSeason = await SeasonService.getOrCreateSeasonForDate(
      userId,
      pastRaceDate.toISOString()
    );
    logger.debug('[SailorSampleDataService] Past season ready:', pastSeason.id);

    // Step 12: Create COMPLETED sample race
    const completedRaceId = await createCompletedSampleRace(userId, boatId, pastRaceDate);
    logger.debug('[SailorSampleDataService] Completed race created:', completedRaceId);

    // Step 13: Link completed race to season
    await linkRegattaToSeason(completedRaceId, pastSeason.id);
    logger.debug('[SailorSampleDataService] Completed race linked to season');

    // Step 14: Create race timer session with self-reported result and key moment
    const timerSessionId = await createRaceTimerSession(userId, completedRaceId, pastRaceDate);
    logger.debug('[SailorSampleDataService] Timer session created:', timerSessionId);

    // Step 15: Create AI Coach Analysis
    await createAICoachAnalysis(timerSessionId);
    logger.debug('[SailorSampleDataService] AI analysis created');

    // Note: Coach annotations are created via database trigger (insert_sample_coach_annotations)
    // because RLS policy requires coach_id = auth.uid(), but we're running as the sailor

    // =====================================================

    logger.info('[SailorSampleDataService] Sample data created successfully', {
      sailorProfileId,
      boatId,
      upcomingRaceId: raceId,
      completedRaceId,
      seasonId: season.id,
    });

    return {
      success: true,
      sailorProfileId,
      boatId,
      raceId,
      seasonId: season.id,
    };
  } catch (error: any) {
    logger.error('[SailorSampleDataService] Failed to create sample data', {
      error: error.message,
      userId: userId.slice(0, 8) + '...',
    });

    // Return success:false but don't throw - sample data is not critical
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure sailor profile exists, create if not
 */
async function ensureSailorProfile(userId: string): Promise<string> {
  // Check if profile exists
  const { data: existing } = await supabase
    .from('sailor_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  // Create new profile
  const { data: newProfile, error } = await supabase
    .from('sailor_profiles')
    .insert({
      user_id: userId,
      experience_level: 'intermediate',
      boat_class_preferences: [DRAGON_CLASS_ID],
    })
    .select('id')
    .single();

  if (error) {
    logger.error('[SailorSampleDataService] Failed to create sailor profile:', error);
    throw error;
  }

  return newProfile.id;
}

/**
 * Ensure Dragon boat class exists in database
 */
async function ensureDragonClass(): Promise<void> {
  const { data: existing } = await supabase
    .from('boat_classes')
    .select('id')
    .eq('id', DRAGON_CLASS_ID)
    .maybeSingle();

  if (!existing) {
    // Create Dragon class if it doesn't exist
    const { error } = await supabase
      .from('boat_classes')
      .insert({
        id: DRAGON_CLASS_ID,
        name: 'Dragon',
        class_association: 'International Dragon Association',
      });

    if (error && !error.message.includes('duplicate')) {
      logger.warn('[SailorSampleDataService] Could not create Dragon class:', error);
    }
  }
}

/**
 * Create sample Dragon boat for the sailor (or return existing one)
 * Note: sailor_boats.sailor_id must be the auth user ID (not sailor_profiles.id) due to RLS policy
 */
async function createSampleBoat(
  userId: string,
  userName: string
): Promise<string> {
  // Check if user already has ANY boat
  const { data: existingBoats, error: fetchError } = await supabase
    .from('sailor_boats')
    .select('id, class_id, is_primary')
    .eq('sailor_id', userId);

  if (fetchError) {
    logger.warn('[SailorSampleDataService] Error checking existing boats:', fetchError);
  }

  // If user has any boat, use the first one (prefer primary)
  if (existingBoats && existingBoats.length > 0) {
    const primaryBoat = existingBoats.find((b) => b.is_primary);
    const boatToUse = primaryBoat || existingBoats[0];
    logger.info('[SailorSampleDataService] User already has a boat, using existing:', boatToUse.id);
    return boatToUse.id;
  }

  // Check specifically if a Dragon boat already exists with is_primary=true
  // This handles the unique constraint: idx_sailor_boats_one_primary_per_class
  const { data: existingDragonPrimary } = await supabase
    .from('sailor_boats')
    .select('id')
    .eq('sailor_id', userId)
    .eq('class_id', DRAGON_CLASS_ID)
    .eq('is_primary', true)
    .maybeSingle();

  if (existingDragonPrimary) {
    logger.info('[SailorSampleDataService] User already has a primary Dragon boat:', existingDragonPrimary.id);
    return existingDragonPrimary.id;
  }

  // Generate a memorable boat name
  const boatName = BOAT_NAMES[Math.floor(Math.random() * BOAT_NAMES.length)];

  // Generate sail number
  const sailNumber = `HKG ${100 + Math.floor(Math.random() * 900)}`;

  const { data: boat, error } = await supabase
    .from('sailor_boats')
    .insert({
      sailor_id: userId, // Must be auth user ID for RLS policy
      class_id: DRAGON_CLASS_ID,
      name: boatName,
      sail_number: sailNumber,
      is_primary: true,
      status: 'active',
      ownership_type: 'owned',
    })
    .select('id')
    .single();

  if (error) {
    // If it's a duplicate key error, try to fetch the existing boat
    if (error.message?.includes('duplicate') || error.code === '23505') {
      logger.warn('[SailorSampleDataService] Duplicate boat detected, fetching existing...');
      const { data: fallbackBoat } = await supabase
        .from('sailor_boats')
        .select('id')
        .eq('sailor_id', userId)
        .limit(1)
        .maybeSingle();

      if (fallbackBoat) {
        return fallbackBoat.id;
      }
    }
    logger.error('[SailorSampleDataService] Failed to create boat:', error);
    throw error;
  }

  return boat.id;
}

/**
 * Register sailor's Dragon class membership
 * Note: sailor_classes.sailor_id must be the auth user ID due to RLS policy
 */
async function registerClassMembership(userId: string): Promise<void> {
  const { error } = await supabase
    .from('sailor_classes')
    .upsert(
      {
        sailor_id: userId, // Must be auth user ID for RLS policy
        class_id: DRAGON_CLASS_ID,
        is_primary: true,
      },
      { onConflict: 'sailor_id,class_id' }
    );

  if (error) {
    logger.warn('[SailorSampleDataService] Could not register class membership:', error);
  }
}

/**
 * Create sample equipment for the boat
 * Note: boat_equipment table uses custom_name for display, no manufacturer/model columns
 */
async function createSampleEquipment(userId: string, boatId: string): Promise<void> {
  // Check if user already has equipment
  const { data: existingEquipment } = await supabase
    .from('boat_equipment')
    .select('id')
    .eq('sailor_id', userId)
    .limit(1)
    .maybeSingle();

  if (existingEquipment) {
    logger.debug('[SailorSampleDataService] User already has equipment, skipping');
    return;
  }

  const equipmentRecords = SAMPLE_EQUIPMENT.map((eq) => ({
    sailor_id: userId,
    boat_id: boatId,
    class_id: DRAGON_CLASS_ID,
    category: eq.category,
    custom_name: eq.custom_name,
    status: 'active' as const,
    condition: eq.condition || 'good',
  }));

  const { error } = await supabase
    .from('boat_equipment')
    .insert(equipmentRecords);

  if (error) {
    logger.warn('[SailorSampleDataService] Could not create equipment:', error);
  }
}

/**
 * Create sample crew members for the boat
 * Note: crew_members.sailor_id must be the auth user ID due to RLS policy
 * Note: Unique constraint on (sailor_id, class_id, email) requires unique emails
 */
async function createSampleCrew(userId: string, boatId: string): Promise<void> {
  // Check if user already has crew members
  const { data: existingCrew } = await supabase
    .from('crew_members')
    .select('id')
    .eq('sailor_id', userId)
    .limit(1)
    .maybeSingle();

  if (existingCrew) {
    logger.debug('[SailorSampleDataService] User already has crew, skipping');
    return;
  }

  // Use unique placeholder emails for sample crew (required by unique constraint)
  const crewRecords = SAMPLE_CREW.map((crew, index) => ({
    sailor_id: userId, // Must be auth user ID for RLS policy
    class_id: DRAGON_CLASS_ID,
    boat_id: boatId,
    name: crew.name,
    email: `sample-crew-${index + 1}@betterat.local`, // Unique placeholder email
    role: crew.role,
    access_level: 'view' as const,
    status: 'active' as const,
    is_primary: false,
    certifications: [],
    performance_notes: [],
  }));

  const { error } = await supabase
    .from('crew_members')
    .insert(crewRecords);

  if (error) {
    logger.warn('[SailorSampleDataService] Could not create crew:', error);
  }
}

/**
 * Create sample race (regatta) for the sailor
 */
async function createSampleRace(
  userId: string,
  boatId: string,
  raceDate: Date
): Promise<string> {
  const raceName = 'RHKYC Dragon Spring Series - Race 1 (Sample)';
  const startTime = new Date(raceDate);
  startTime.setHours(11, 0, 0, 0); // 11:00 AM start (typical first warning signal time)

  const metadata = {
    venue_name: 'Victoria Harbour, Hong Kong',
    class_name: 'Dragon',
    class_id: DRAGON_CLASS_ID,
    course_type: 'windward_leeward',
    // Use venue_coordinates format that extractVenueCoordinates() recognizes
    venue_coordinates: {
      lat: HK_COORDINATES.latitude,
      lng: HK_COORDINATES.longitude,
    },
    is_sample: true, // Mark as sample data
  };

  logger.info('[SailorSampleDataService] Creating race with userId:', userId);

  // Note: 'location' column is PostGIS geography type, so we use metadata for venue name
  const { data: race, error } = await supabase
    .from('regattas')
    .insert({
      name: raceName,
      event_series_name: 'RHKYC Dragon Spring Series',
      start_date: startTime.toISOString(),
      created_by: userId,
      status: 'planned',
      race_type: 'fleet',
      class_id: DRAGON_CLASS_ID,
      boat_id: boatId,
      expected_fleet_size: 15,
      vhf_channel: '72',
      metadata,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('[SailorSampleDataService] Failed to create race:', error);
    throw error;
  }

  return race.id;
}

/**
 * Link a regatta to a season via the season_regattas junction table
 */
async function linkRegattaToSeason(regattaId: string, seasonId: string): Promise<void> {
  const { error } = await supabase
    .from('season_regattas')
    .insert({
      season_id: seasonId,
      regatta_id: regattaId,
      sequence: 1, // First race in the season for this user
    });

  if (error) {
    logger.warn('[SailorSampleDataService] Could not link regatta to season:', error);
  }
}

/**
 * Create sample NOR and SI documents for the race
 */
async function createSampleDocuments(userId: string, raceId: string): Promise<void> {
  try {
    // Create NOR document
    const norResult = await createTextDocument(
      userId,
      'Sample-NOR-Dragon-Spring-Series.txt',
      SAMPLE_NOR_CONTENT,
      {
        document_type: 'nor',
        source: 'sample',
        event_name: 'Hong Kong Dragon Spring Series',
      }
    );

    if (norResult?.id) {
      await linkDocumentToRace(raceId, norResult.id, userId, 'nor');
    }

    // Create SI document
    const siResult = await createTextDocument(
      userId,
      'Sample-SI-Dragon-Spring-Series.txt',
      SAMPLE_SI_CONTENT,
      {
        document_type: 'sailing_instructions',
        source: 'sample',
        event_name: 'Hong Kong Dragon Spring Series',
      }
    );

    if (siResult?.id) {
      await linkDocumentToRace(raceId, siResult.id, userId, 'sailing_instructions');
    }
  } catch (error) {
    logger.warn('[SailorSampleDataService] Could not create documents:', error);
  }
}

/**
 * Create a text-based document record (no file upload needed)
 */
async function createTextDocument(
  userId: string,
  filename: string,
  content: string,
  metadata: Record<string, any>
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      filename,
      mime_type: 'text/plain',
      file_size: content.length,
      file_path: `sample/${userId}/${filename}`, // Virtual path for sample docs
      metadata: {
        ...metadata,
        content, // Store content in metadata for sample docs
      },
    })
    .select('id')
    .single();

  if (error) {
    logger.warn('[SailorSampleDataService] Could not create document:', error);
    return null;
  }

  return data;
}

/**
 * Link a document to a race
 */
async function linkDocumentToRace(
  raceId: string,
  documentId: string,
  userId: string,
  documentType: 'nor' | 'sailing_instructions'
): Promise<void> {
  const { error } = await supabase
    .from('race_documents')
    .insert({
      regatta_id: raceId,
      document_id: documentId,
      user_id: userId,
      document_type: documentType,
      shared_with_fleet: false,
    });

  if (error) {
    logger.warn('[SailorSampleDataService] Could not link document to race:', error);
  }
}

/**
 * Get date N days from now (or ago if negative)
 */
function getDateDaysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Create a completed sample race (7 days in the past)
 */
async function createCompletedSampleRace(
  userId: string,
  boatId: string,
  raceDate: Date
): Promise<string> {
  const raceName = 'RHKYC Dragon Winter Series - Race 4 (Sample)';
  const startTime = new Date(raceDate);
  startTime.setHours(14, 0, 0, 0); // 2:00 PM start

  const metadata = {
    venue_name: 'Victoria Harbour, Hong Kong',
    class_name: 'Dragon',
    class_id: DRAGON_CLASS_ID,
    course_type: 'windward_leeward',
    // Use venue_coordinates format that extractVenueCoordinates() recognizes
    venue_coordinates: {
      lat: HK_COORDINATES.latitude,
      lng: HK_COORDINATES.longitude,
    },
    is_sample: true,
  };

  const { data: race, error } = await supabase
    .from('regattas')
    .insert({
      name: raceName,
      event_series_name: 'RHKYC Dragon Winter Series',
      start_date: startTime.toISOString(),
      created_by: userId,
      status: 'completed',
      race_type: 'fleet',
      class_id: DRAGON_CLASS_ID,
      boat_id: boatId,
      expected_fleet_size: 14,
      vhf_channel: '72',
      metadata,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('[SailorSampleDataService] Failed to create completed race:', error);
    throw error;
  }

  return race.id;
}

/**
 * Create a race timer session for a completed race with self-reported result
 */
async function createRaceTimerSession(
  userId: string,
  regattaId: string,
  raceDate: Date
): Promise<string> {
  const startTime = new Date(raceDate);
  startTime.setHours(14, 0, 0, 0); // Race start at 2pm

  const endTime = new Date(startTime);
  endTime.setHours(15, 23, 0, 0); // Race duration ~83 minutes

  const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

  const { data: session, error } = await supabase
    .from('race_timer_sessions')
    .insert({
      sailor_id: userId,
      regatta_id: regattaId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_seconds: durationSeconds,
      wind_direction: 65, // NE wind typical for HK winter
      wind_speed: 12, // Knots
      wave_height: 0.8, // Meters
      self_reported_position: 3,
      self_reported_fleet_size: 14,
      key_moment: SAMPLE_KEY_MOMENT,
      auto_analyzed: true, // Mark as analyzed since we're inserting AI analysis
    })
    .select('id')
    .single();

  if (error) {
    logger.error('[SailorSampleDataService] Failed to create timer session:', error);
    throw error;
  }

  return session.id;
}

/**
 * Create AI Coach Analysis for a completed race timer session
 */
async function createAICoachAnalysis(timerSessionId: string): Promise<void> {
  const { error } = await supabase.from('ai_coach_analysis').insert({
    timer_session_id: timerSessionId,
    overall_summary: SAMPLE_AI_ANALYSIS.overall_summary,
    start_analysis: SAMPLE_AI_ANALYSIS.start_analysis,
    upwind_analysis: SAMPLE_AI_ANALYSIS.upwind_analysis,
    downwind_analysis: SAMPLE_AI_ANALYSIS.downwind_analysis,
    tactical_decisions: SAMPLE_AI_ANALYSIS.tactical_decisions,
    boat_handling: SAMPLE_AI_ANALYSIS.boat_handling,
    recommendations: SAMPLE_AI_ANALYSIS.recommendations,
    confidence_score: SAMPLE_AI_ANALYSIS.confidence_score,
    model_used: 'sample-data',
    analysis_version: '1.0',
  });

  if (error) {
    logger.warn('[SailorSampleDataService] Could not create AI analysis:', error);
    // Don't throw - this is not critical
  }
}
